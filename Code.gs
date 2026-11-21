/**
 * TrackMyFood — Google Apps Script backend (multi-user).
 * Deploy > Web app (Execute as: Me, Who has access: Anyone). Run setup() once.
 *
 * Script properties (Project Settings > Script properties):
 *   APP_TOKEN          main admin token (created by setup())
 *   ADMIN_NAME         optional: display name of the main admin
 *   GEMINI_API_KEY     Google AI Studio key (free tier) used for photo recognition
 *   GEMINI_MODEL       optional: override the Gemini model id
 *   ANTHROPIC_API_KEY  optional: Claude API key, used only if GEMINI_API_KEY is not set
 *   SHEET_ID           optional: spreadsheet id when the script is not bound to a sheet
 *
 * Every data row carries a user_id. Rows without one belong to the main admin ("admin").
 * Profile tokens are stored only as SHA-256 hashes in the Users tab.
 */

var NK = ['kcal','pro','carb','fat','fib','sug','sfat','na','k','ca','fe','vc','va'];
var NUT_HEAD = ['kcal','protein_g','carbs_g','fat_g','fibre_g','sugar_g','satfat_g','sodium_mg','potassium_mg','calcium_mg','iron_mg','vitc_mg','vita_mcg'];
var SLOT_LABEL = {breakfast:'Breakfast', msnack:'Morning snack', lunch:'Lunch', esnack:'Evening snack', dinner:'Dinner'};
var LOG_HEAD = ['id','date','meal','name','qty','unit','grams'].concat(NUT_HEAD).concat(['source','food_id','rule_id','deleted','updated_at','slot_key','user_id']);
var GENERIC_HEAD = ['id','name','updated_at','deleted','json','user_id'];
var SHEETS = {
  Log: LOG_HEAD,
  Daily: ['date'].concat(NUT_HEAD).concat(['items','user_id']),
  MyMeals: GENERIC_HEAD,
  Recurring: GENERIC_HEAD,
  CustomFoods: GENERIC_HEAD,
  Settings: GENERIC_HEAD,
  Users: ['id','name','role','token_hash','active','created_at','updated_at']
};
var KIND_SHEET = {meal:'MyMeals', rule:'Recurring', food:'CustomFoods', settings:'Settings'};
var ADMIN_ID = 'admin';
var LOG_USER = LOG_HEAD.indexOf('user_id');
var DAILY_USER = SHEETS.Daily.length - 1;
var GEN_USER = GENERIC_HEAD.indexOf('user_id');
// Used when the script is not bound to the sheet.
var DEFAULT_SHEET_ID = '';
var checked_ = {};

function ss_() {
  var a = SpreadsheetApp.getActive();
  if (a) return a;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
  return SpreadsheetApp.openById(id);
}

function setup() {
  var ss = ss_();
  Object.keys(SHEETS).forEach(function (n) { sheet_(n); });
  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('APP_TOKEN')) props.setProperty('APP_TOKEN', Utilities.getUuid());
  Logger.log('APP_TOKEN = ' + props.getProperty('APP_TOKEN'));
  if (!props.getProperty('GEMINI_API_KEY') && !props.getProperty('ANTHROPIC_API_KEY')) Logger.log('Remember to add GEMINI_API_KEY in Project Settings > Script properties.');
}

/* Returns the sheet, creating it or extending its header row when columns were added. */
function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  var head = SHEETS[name];
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (name === 'Log' || name === 'Daily') sh.getRange(2, name === 'Log' ? 2 : 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    checked_[name] = true;
  } else if (!checked_[name]) {
    var cur = sh.getRange(1, 1, 1, head.length).getValues()[0];
    if (cur.join('|') !== head.join('|')) sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    checked_[name] = true;
  }
  return sh;
}

function doGet() {
  return ContentService.createTextOutput('TrackMyFood backend is running.');
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var me = auth_(req.token);
    if (!me) return out_({ok: false, error: 'This link is not valid any more. Ask your admin for a new setup link.'});
    var isAdmin = me.role === 'admin';
    switch (req.action) {
      case 'ping': return out_({ok: true, me: me});
      case 'push': return out_(push_(req.ops || [], me));
      case 'pull':
        var target = (req.asUser && isAdmin) ? String(req.asUser) : me.id;
        var r = pull_(req.from, target);
        r.me = me;
        return out_(r);
      case 'vision': return out_(vision_(req));
      case 'claude': return out_(claude_(req.body));
      case 'users': return out_(isAdmin ? {ok: true, users: listUsers_()} : denied_());
      case 'userCreate': return out_(isAdmin ? createUser_(req) : denied_());
      case 'userUpdate': return out_(isAdmin ? updateUser_(req, me) : denied_());
    }
    return out_({ok: false, error: 'Unknown action'});
  } catch (err) {
    return out_({ok: false, error: String(err && err.message || err)});
  }
}

function denied_() { return {ok: false, error: 'Only an admin can do that'}; }

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '');
}

function uidOf_(v) { return String(v || '') || ADMIN_ID; }

function isTrue_(v) { return v === true || v === 'TRUE' || v === 'true'; }

/* ---------- users & auth ---------- */
function hash_(token) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token)).map(function (b) {
    var h = (b & 255).toString(16); return h.length === 1 ? '0' + h : h;
  }).join('');
}

function usersRows_() {
  var sh = sheet_('Users'), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, SHEETS.Users.length).getValues().map(function (r, i) {
    return {row: i + 2, id: String(r[0]), name: r[1], role: r[2] || 'user', token_hash: r[3], active: isTrue_(r[4]), created_at: r[5], updated_at: r[6]};
  }).filter(function (u) { return u.id; });
}

function auth_(token) {
  if (!token) return null;
  var props = PropertiesService.getScriptProperties();
  var adminTok = props.getProperty('APP_TOKEN');
  if (adminTok && token === adminTok) return {id: ADMIN_ID, name: props.getProperty('ADMIN_NAME') || 'Admin', role: 'admin', main: true};
  var h = hash_(token), users = usersRows_();
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (u.active && u.token_hash === h) return {id: u.id, name: u.name, role: u.role === 'admin' ? 'admin' : 'user'};
  }
  return null;
}

function listUsers_() {
  var props = PropertiesService.getScriptProperties();
  var list = [{id: ADMIN_ID, name: props.getProperty('ADMIN_NAME') || 'Admin', role: 'admin', active: true, main: true}];
  usersRows_().forEach(function (u) { list.push({id: u.id, name: u.name, role: u.role, active: u.active, created_at: u.created_at}); });
  return list;
}

function createUser_(req) {
  var name = String(req.name || '').trim();
  if (!name) return {ok: false, error: 'Name is required'};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var token = Utilities.getUuid();
    var id = 'u_' + Utilities.getUuid().slice(0, 8);
    var now = Date.now();
    var role = req.role === 'admin' ? 'admin' : 'user';
    sheet_('Users').appendRow([id, name, role, hash_(token), true, now, now]);
    return {ok: true, user: {id: id, name: name, role: role, active: true}, token: token};
  } finally { lock.releaseLock(); }
}

function updateUser_(req, me) {
  var id = String(req.id || '');
  if (id === ADMIN_ID) {
    if (req.name) { PropertiesService.getScriptProperties().setProperty('ADMIN_NAME', String(req.name).trim()); return {ok: true}; }
    return {ok: false, error: 'The main admin can only be renamed'};
  }
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var u = usersRows_().filter(function (x) { return x.id === id; })[0];
    if (!u) return {ok: false, error: 'Profile not found'};
    if (id === me.id && (req.active === false || req.role === 'user')) return {ok: false, error: 'You cannot remove your own admin access'};
    var sh = sheet_('Users'), token = null;
    if (req.name) sh.getRange(u.row, 2).setValue(String(req.name).trim());
    if (req.role === 'admin' || req.role === 'user') sh.getRange(u.row, 3).setValue(req.role);
    if (req.active === true || req.active === false) sh.getRange(u.row, 5).setValue(req.active);
    if (req.resetToken) { token = Utilities.getUuid(); sh.getRange(u.row, 4).setValue(hash_(token)); }
    sh.getRange(u.row, 7).setValue(Date.now());
    return {ok: true, token: token};
  } finally { lock.releaseLock(); }
}

/* ---------- push: upsert the caller's records ---------- */
function push_(ops, me) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var uid = me.id, touched = {};
    var entries = ops.filter(function (o) { return o.kind === 'entry'; }).map(function (o) { return o.rec; });
    if (entries.length) {
      upsert_(sheet_('Log'), entries.map(function (r) {
        touched[r.date] = true;
        var n = r.n || {};
        return ['' + r.id, '' + r.date, SLOT_LABEL[r.slot] || r.slot, r.name, round_(r.qty), r.unit, round_(r.grams)]
          .concat(NK.map(function (k) { return round_(n[k]); }))
          .concat([r.src || '', r.foodId || '', r.ruleId || '', !!r.deleted, r.updatedAt || Date.now(), r.slot, uid]);
      }), 0, LOG_USER);
    }
    Object.keys(KIND_SHEET).forEach(function (kind) {
      var recs = ops.filter(function (o) { return o.kind === kind; }).map(function (o) { return o.rec; });
      if (recs.length) upsert_(sheet_(KIND_SHEET[kind]), recs.map(function (r) {
        return ['' + r.id, r.name || r.id, r.updatedAt || Date.now(), !!r.deleted, JSON.stringify(r), uid];
      }), 0, GEN_USER);
    });
    var dates = Object.keys(touched);
    if (dates.length) daily_(dates, uid);
    return {ok: true, count: ops.length};
  } finally {
    lock.releaseLock();
  }
}

function round_(x) { return Math.round((+x || 0) * 100) / 100; }

/* Upsert rows keyed by (row[keyCol], user in row[userCol]). Blank user cells count as the main admin. */
function upsert_(sh, rows, keyCol, userCol) {
  var last = sh.getLastRow(), width = rows[0].length;
  var idx = {};
  if (last > 1) {
    sh.getRange(2, 1, last - 1, width).getValues().forEach(function (r, i) {
      idx[uidOf_(r[userCol]) + '|' + String(r[keyCol])] = i + 2;
    });
  }
  var appends = [];
  rows.forEach(function (row) {
    var k = uidOf_(row[userCol]) + '|' + String(row[keyCol]);
    var at = idx[k];
    if (at > 0) sh.getRange(at, 1, 1, width).setValues([row]);
    else if (at !== -1) { appends.push(row); idx[k] = -1; }
  });
  if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, width).setValues(appends);
}

/* ---------- Daily summary per user and date ---------- */
function daily_(dates, uid) {
  var log = sheet_('Log'), last = log.getLastRow();
  if (last < 2) return;
  var vals = log.getRange(2, 1, last - 1, LOG_HEAD.length).getValues();
  var delCol = LOG_HEAD.indexOf('deleted');
  var want = {};
  dates.forEach(function (d) { want[d] = {n: NK.map(function () { return 0; }), c: 0}; });
  vals.forEach(function (r) {
    var d = ymd_(r[1]);
    if (!want[d] || uidOf_(r[LOG_USER]) !== uid || isTrue_(r[delCol])) return;
    for (var i = 0; i < NK.length; i++) want[d].n[i] += +r[7 + i] || 0;
    want[d].c++;
  });
  var dsh = sheet_('Daily');
  var rows = dates.map(function (d) { return [d].concat(want[d].n.map(round_)).concat([want[d].c, uid]); });
  upsert_(dsh, rows, 0, DAILY_USER);
  if (dsh.getLastRow() > 2) dsh.getRange(2, 1, dsh.getLastRow() - 1, SHEETS.Daily.length).sort([{column: DAILY_USER + 1, ascending: true}, {column: 1, ascending: true}]);
}

/* ---------- pull: one user's data since a date ---------- */
function pull_(from, uid) {
  from = from || '0000-00-00';
  var log = sheet_('Log'), last = log.getLastRow(), entries = [];
  if (last > 1) {
    log.getRange(2, 1, last - 1, LOG_HEAD.length).getValues().forEach(function (r) {
      var d = ymd_(r[1]);
      if (!r[0] || d < from || uidOf_(r[LOG_USER]) !== uid) return;
      var n = {};
      NK.forEach(function (k, i) { n[k] = +r[7 + i] || 0; });
      entries.push({
        id: String(r[0]), date: d, slot: r[LOG_HEAD.indexOf('slot_key')] || 'lunch', name: r[3],
        qty: +r[4], unit: r[5], grams: +r[6], n: n,
        src: r[20], foodId: r[21], ruleId: r[22],
        deleted: isTrue_(r[23]), updatedAt: +r[24] || 0
      });
    });
  }
  var res = {ok: true, entries: entries, meals: generic_('MyMeals', uid), rules: generic_('Recurring', uid), foods: generic_('CustomFoods', uid)};
  var st = generic_('Settings', uid);
  if (st.length) res.settings = st[0];
  return res;
}

function generic_(name, uid) {
  var sh = sheet_(name), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, GENERIC_HEAD.length).getValues().filter(function (r) {
    return uidOf_(r[GEN_USER]) === uid;
  }).map(function (r) {
    try { var o = JSON.parse(r[4]); o.updatedAt = +r[2] || o.updatedAt; o.deleted = isTrue_(r[3]); return o; }
    catch (e) { return null; }
  }).filter(function (x) { return x; });
}

/* ---------- Claude proxy (used only if no Gemini key) ---------- */
function claude_(body) {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) return {ok: false, error: 'ANTHROPIC_API_KEY is not set in Script properties'};
  if (!body || !body.messages) return {ok: false, error: 'Bad request'};
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {'x-api-key': key, 'anthropic-version': '2023-06-01'},
    payload: JSON.stringify({model: body.model, max_tokens: Math.min(+body.max_tokens || 2000, 4000), messages: body.messages}),
    muteHttpExceptions: true
  });
  var j = JSON.parse(res.getContentText());
  if (res.getResponseCode() >= 300) return {ok: false, error: (j.error && j.error.message) || ('Claude API error ' + res.getResponseCode())};
  return {ok: true, data: j};
}

/* ---------- Photo recognition: Gemini (free tier) first, Claude as fallback ---------- */
var GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

function vision_(req) {
  var props = PropertiesService.getScriptProperties();
  if (!req.image || !req.prompt) return {ok: false, error: 'Bad request'};
  var gkey = props.getProperty('GEMINI_API_KEY');
  if (gkey) return gemini_(gkey, req, props.getProperty('GEMINI_MODEL'));
  if (props.getProperty('ANTHROPIC_API_KEY')) {
    var r = claude_({model: req.claudeModel || 'claude-sonnet-5-5', max_tokens: 2000, messages: [{role: 'user', content: [
      {type: 'image', source: {type: 'base64', media_type: 'image/jpeg', data: req.image}}, {type: 'text', text: req.prompt}]}]});
    if (!r.ok) return r;
    return {ok: true, text: (r.data.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join(''), provider: 'claude'};
  }
  return {ok: false, error: 'No AI key set. Add GEMINI_API_KEY in Apps Script > Project Settings > Script properties.'};
}

function gemini_(key, req, override) {
  var models = (override ? [override] : []).concat(GEMINI_MODELS);
  var lastErr = '';
  for (var i = 0; i < models.length; i++) {
    var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(models[i]) + ':generateContent', {
      method: 'post',
      contentType: 'application/json',
      headers: {'x-goog-api-key': key},
      payload: JSON.stringify({
        contents: [{role: 'user', parts: [{inline_data: {mime_type: 'image/jpeg', data: req.image}}, {text: req.prompt}]}],
        generationConfig: {temperature: 0.2, responseMimeType: 'application/json'}
      }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode(), j = {};
    try { j = JSON.parse(res.getContentText()); } catch (e) {}
    if (code < 300) {
      var parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
      var text = parts.map(function (p) { return p.text || ''; }).join('');
      if (text) return {ok: true, text: text, provider: 'gemini', model: models[i]};
      lastErr = 'Gemini returned no text' + (j.promptFeedback && j.promptFeedback.blockReason ? ' (' + j.promptFeedback.blockReason + ')' : '');
      continue;
    }
    lastErr = (j.error && j.error.message) || ('Gemini error ' + code);
    if ((code === 400 || code === 401 || code === 403) && /API key/i.test(lastErr)) break;
  }
  return {ok: false, error: lastErr};
}

/* Run this once from the editor to check the Gemini key without the app. */
function testGemini() {
  var props = PropertiesService.getScriptProperties();
  var model = props.getProperty('GEMINI_MODEL') || GEMINI_MODELS[0];
  var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
    method: 'post', contentType: 'application/json', headers: {'x-goog-api-key': props.getProperty('GEMINI_API_KEY')}, muteHttpExceptions: true,
    payload: JSON.stringify({contents: [{parts: [{text: 'Reply with the single word OK'}]}]})
  });
  Logger.log(model + ': ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
}
