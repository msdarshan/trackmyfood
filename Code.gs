/**
 * TrackMyFood — Google Apps Script backend (multi-user).
 * Deploy > Web app (Execute as: Me, Who has access: Anyone). Run setup() once.
 *
 * Script properties (Project Settings > Script properties):
 *   APP_TOKEN          main admin token (created by setup())
 *   ADMIN_NAME         optional: display name of the main admin
 *   GEMINI_API_KEY     Google AI Studio key (free tier), first choice for photo/text AI
 *   GROQ_API_KEY       optional fallback (free tier at console.groq.com)
 *   OPENROUTER_API_KEY optional fallback (free models at openrouter.ai)
 *   ANTHROPIC_API_KEY  optional fallback (paid Claude API)
 *   AI_CHAIN           optional order, e.g. gemini,groq,openrouter,claude
 *   GEMINI_MODEL / GROQ_MODEL / OPENROUTER_MODEL / CLAUDE_MODEL  optional: model to try first
 *   SHEET_ID           optional: spreadsheet id when the script is not bound to a sheet
 *
 * Every data row carries a user_id. Rows without one belong to the main admin ("admin").
 * Profile tokens are stored only as SHA-256 hashes in the Users tab.
 */

var NK = ['kcal','pro','carb','fat','fib','sug','sfat','na','k','ca','fe','vc','va'];
var NUT_HEAD = ['kcal','protein_g','carbs_g','fat_g','fibre_g','sugar_g','satfat_g','sodium_mg','potassium_mg','calcium_mg','iron_mg','vitc_mg','vita_mcg'];
var SLOT_LABEL = {breakfast:'Breakfast', msnack:'Morning snack', lunch:'Lunch', esnack:'Evening snack', dinner:'Dinner'};
var EXTRA_NK = ['vd','b12'];
var EXTRA_HEAD = ['vitd_mcg','b12_mcg'];
var LOG_HEAD = ['id','date','meal','name','qty','unit','grams'].concat(NUT_HEAD).concat(['source','food_id','rule_id','deleted','updated_at','slot_key','user_id']).concat(EXTRA_HEAD);
var GENERIC_HEAD = ['id','name','updated_at','deleted','json','user_id'];
var SHEETS = {
  Log: LOG_HEAD,
  Daily: ['date'].concat(NUT_HEAD).concat(['items','user_id']).concat(EXTRA_HEAD),
  MyMeals: GENERIC_HEAD,
  Recurring: GENERIC_HEAD,
  CustomFoods: GENERIC_HEAD,
  Settings: GENERIC_HEAD,
  Weights: GENERIC_HEAD,
  Users: ['id','name','role','token_hash','active','created_at','updated_at']
};
var KIND_SHEET = {meal:'MyMeals', rule:'Recurring', food:'CustomFoods', settings:'Settings', weight:'Weights'};
var ADMIN_ID = 'admin';
var LOG_USER = LOG_HEAD.indexOf('user_id');
var DAILY_USER = SHEETS.Daily.indexOf('user_id');
var LOG_EXTRA = LOG_HEAD.indexOf('vitd_mcg');
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
      case 'summary': return out_(summary_(req, me));
      case 'vision': return out_(vision_(req));
      case 'claude': return out_(claude_(req.body));
      case 'aiTest': return out_(isAdmin ? aiTest_() : denied_());
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
          .concat([r.src || '', r.foodId || '', r.ruleId || '', !!r.deleted, r.updatedAt || Date.now(), r.slot, uid])
          .concat(EXTRA_NK.map(function (k) { return round_(n[k]); }));
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
  dates.forEach(function (d) { want[d] = {n: NK.map(function () { return 0; }), x: EXTRA_NK.map(function () { return 0; }), c: 0}; });
  vals.forEach(function (r) {
    var d = ymd_(r[1]);
    if (!want[d] || uidOf_(r[LOG_USER]) !== uid || isTrue_(r[delCol])) return;
    for (var i = 0; i < NK.length; i++) want[d].n[i] += +r[7 + i] || 0;
    for (var j = 0; j < EXTRA_NK.length; j++) want[d].x[j] += +r[LOG_EXTRA + j] || 0;
    want[d].c++;
  });
  var dsh = sheet_('Daily');
  var rows = dates.map(function (d) { return [d].concat(want[d].n.map(round_)).concat([want[d].c, uid]).concat(want[d].x.map(round_)); });
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
      EXTRA_NK.forEach(function (k, i) { n[k] = +r[LOG_EXTRA + i] || 0; });
      entries.push({
        id: String(r[0]), date: d, slot: r[LOG_HEAD.indexOf('slot_key')] || 'lunch', name: r[3],
        qty: +r[4], unit: r[5], grams: +r[6], n: n,
        src: r[20], foodId: r[21], ruleId: r[22],
        deleted: isTrue_(r[23]), updatedAt: +r[24] || 0
      });
    });
  }
  var res = {ok: true, entries: entries, meals: generic_('MyMeals', uid), rules: generic_('Recurring', uid), foods: generic_('CustomFoods', uid), weights: generic_('Weights', uid)};
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

/* ---------- summary for the home-screen widget ---------- */
var DEF_TARGETS = {kcal: 2000, pro: 90, carb: 250, fat: 65, fib: 30};

function summary_(req, me) {
  var today = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(req.date || '')) ? String(req.date) : ymd_(new Date());
  var p = today.split('-').map(Number), days = [], sums = {};
  for (var i = 6; i >= 0; i--) {
    var d = Utilities.formatDate(new Date(Date.UTC(p[0], p[1] - 1, p[2] - i)), 'UTC', 'yyyy-MM-dd');
    days.push(d); sums[d] = {date: d, kcal: 0, pro: 0, carb: 0, fat: 0, fib: 0, items: 0};
  }
  var log = sheet_('Log'), last = log.getLastRow();
  if (last > 1) {
    log.getRange(2, 1, last - 1, LOG_HEAD.length).getValues().forEach(function (r) {
      var s = sums[ymd_(r[1])];
      if (!s || uidOf_(r[LOG_USER]) !== me.id || isTrue_(r[23])) return;
      s.kcal += +r[7] || 0; s.pro += +r[8] || 0; s.carb += +r[9] || 0; s.fat += +r[10] || 0; s.fib += +r[11] || 0; s.items++;
    });
  }
  var st = generic_('Settings', me.id)[0], t = {};
  Object.keys(DEF_TARGETS).forEach(function (k) { t[k] = (st && st.targets && +st.targets[k]) || DEF_TARGETS[k]; });
  var week = days.map(function (d) { var s = sums[d]; return {date: d, kcal: Math.round(s.kcal), pro: round_(s.pro), items: s.items}; });
  var td = sums[today];
  return {ok: true, name: me.name, date: today, today: {kcal: Math.round(td.kcal), pro: round_(td.pro), carb: round_(td.carb), fat: round_(td.fat), fib: round_(td.fib), items: td.items}, targets: t, week: week};
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

/* ---------- AI router: Gemini -> Groq -> OpenRouter -> Claude, with retries ---------- */
// Script properties: GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY (any subset).
// Optional: AI_CHAIN (e.g. "gemini,groq,openrouter,claude"), GEMINI_MODEL, GROQ_MODEL, OPENROUTER_MODEL, CLAUDE_MODEL.
var AI_ORDER = ['gemini', 'groq', 'openrouter', 'claude'];
var AI_KEYS = {gemini: 'GEMINI_API_KEY', groq: 'GROQ_API_KEY', openrouter: 'OPENROUTER_API_KEY', claude: 'ANTHROPIC_API_KEY'};
var GROQ_MODELS = ['qwen/qwen3.8-27b', 'meta-models/muse-spark-open', 'qwen/qwen3.6-27b'];
var OPENROUTER_MODELS = ['openrouter/free'];
var CLAUDE_MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5'];
var BUSY_CODES = {429: 1, 500: 1, 502: 1, 503: 1, 504: 1};

function aiChain_() {
  var props = PropertiesService.getScriptProperties();
  var order = (props.getProperty('AI_CHAIN') || AI_ORDER.join(',')).split(',').map(function (x) { return x.trim().toLowerCase(); });
  return order.filter(function (p) { return AI_KEYS[p] && props.getProperty(AI_KEYS[p]); });
}

function vision_(req) {
  if (!req.prompt) return {ok: false, error: 'Bad request'};
  var chain = aiChain_();
  if (!chain.length) return {ok: false, error: 'No AI key set. Add GEMINI_API_KEY (or GROQ_API_KEY / OPENROUTER_API_KEY) in Apps Script > Project Settings > Script properties.'};
  var tried = [], started = Date.now();
  for (var i = 0; i < chain.length; i++) {
    if (Date.now() - started > 100000) break; // stay well inside the 6-minute limit and the phone's patience
    var r = callProvider_(chain[i], req, started);
    tried = tried.concat(r.tried || []);
    if (r.ok) { r.tried = tried; return r; }
  }
  var busy = tried.some(function (t) { return BUSY_CODES[t.code]; });
  return {ok: false, tried: tried, error: (busy ? 'All AI models are busy right now. ' : 'AI request failed. ') + tried.map(function (t) { return t.provider + ' ' + t.model + ': ' + t.error; }).slice(-4).join(' | ')};
}

function callProvider_(provider, req, started) {
  var props = PropertiesService.getScriptProperties(), key = props.getProperty(AI_KEYS[provider]);
  var models = provider === 'gemini' ? geminiModels_(key)
    : provider === 'groq' ? GROQ_MODELS : provider === 'openrouter' ? OPENROUTER_MODELS : CLAUDE_MODELS;
  var override = props.getProperty(provider.toUpperCase() + '_MODEL');
  if (override) models = [override].concat(models.filter(function (m) { return m !== override; }));
  var tried = [];
  for (var i = 0; i < Math.min(models.length, provider === 'gemini' ? 4 : 3); i++) {
    for (var attempt = 0; attempt < 2; attempt++) {
      if (started && Date.now() - started > 100000) return {ok: false, tried: tried};
      var t0 = Date.now(), r;
      try { r = providerFetch_(provider, key, models[i], req); }
      catch (e) { r = {code: 0, error: String(e && e.message || e)}; }
      if (r.text) return {ok: true, text: r.text, provider: provider, model: models[i], ms: Date.now() - t0, tried: tried};
      tried.push({provider: provider, model: models[i], code: r.code, error: String(r.error || 'no text').slice(0, 140), ms: Date.now() - t0});
      if (r.code === 401 || r.code === 403 || /api key|invalid.*key|unauthori|credit balance|billing|quota exceeded/i.test(r.error || '')) return {ok: false, tried: tried}; // bad key / no credit: skip provider
      if (!BUSY_CODES[r.code] || attempt === 1) break; // not a busy error, or already retried: next model
      Utilities.sleep(1500); // brief back-off, then retry the same model once
    }
  }
  return {ok: false, tried: tried};
}

function providerFetch_(provider, key, model, req) {
  var img = req.image ? 'data:image/jpeg;base64,' + req.image : '';
  var opts = {method: 'post', contentType: 'application/json', muteHttpExceptions: true}, url;
  if (provider === 'gemini') {
    url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
    opts.headers = {'x-goog-api-key': key};
    opts.payload = JSON.stringify({
      contents: [{role: 'user', parts: (req.image ? [{inline_data: {mime_type: 'image/jpeg', data: req.image}}] : []).concat([{text: req.prompt}])}],
      generationConfig: {temperature: 0.2, responseMimeType: 'application/json'}
    });
  } else if (provider === 'claude') {
    url = 'https://api.anthropic.com/v1/messages';
    opts.headers = {'x-api-key': key, 'anthropic-version': '2023-06-01'};
    opts.payload = JSON.stringify({model: model, max_tokens: 2500, messages: [{role: 'user', content:
      (req.image ? [{type: 'image', source: {type: 'base64', media_type: 'image/jpeg', data: req.image}}] : []).concat([{type: 'text', text: req.prompt}])}]});
  } else {
    url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
    opts.headers = {'Authorization': 'Bearer ' + key};
    if (provider === 'openrouter') { opts.headers['HTTP-Referer'] = 'https://msdarshan.github.io/trackmyfood/'; opts.headers['X-Title'] = 'TrackMyFood'; }
    opts.payload = JSON.stringify({model: model, temperature: 0.2, max_tokens: 3000, messages: [{role: 'user', content:
      [{type: 'text', text: req.prompt}].concat(img ? [{type: 'image_url', image_url: {url: img}}] : [])}]});
  }
  var res = UrlFetchApp.fetch(url, opts), code = res.getResponseCode(), j = {};
  try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (code >= 300) return {code: code, error: (j.error && (j.error.message || j.error)) || ('HTTP ' + code)};
  var text = '';
  if (provider === 'gemini') text = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(function (p) { return p.text || ''; }).join('');
  else if (provider === 'claude') text = (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
  else text = ((((j.choices || [])[0] || {}).message || {}).content) || '';
  text = String(text);
  var tk = text.indexOf('<think>'), te = text.indexOf('</think>');
  if (tk >= 0 && te > tk) text = text.slice(0, tk) + text.slice(te + 8); // reasoning models may prepend their thinking
  text = text.trim();
  if (!text) return {code: code, error: provider === 'gemini' && j.promptFeedback && j.promptFeedback.blockReason ? 'blocked: ' + j.promptFeedback.blockReason : 'empty reply'};
  return {code: code, text: text};
}

/* Gemini models this key can use, fastest first (Flash-Lite, then Flash), cached for 6 hours. */
function geminiModels_(key) {
  var cache = CacheService.getScriptCache(), hit = cache.get('gemini_models');
  if (hit) return JSON.parse(hit);
  var list = [];
  try {
    var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {headers: {'x-goog-api-key': key}, muteHttpExceptions: true});
    var j = JSON.parse(res.getContentText());
    list = (j.models || []).filter(function (m) {
      var n = String(m.name || '');
      return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0 && /gemini-[0-9.]+-flash/.test(n) && !/(image|tts|audio|live|thinking|exp|embed|computer)/.test(n);
    }).map(function (m) { return String(m.name).replace('models/', ''); });
  } catch (e) {}
  var ver = function (n) { var v = (n.match(/gemini-([0-9.]+)/) || [0, '0'])[1].split('.'); return (+v[0] || 0) * 100 + (+v[1] || 0); };
  list.sort(function (a, b) {
    var la = /lite/.test(a) ? 0 : 1, lb = /lite/.test(b) ? 0 : 1, pa = /preview/.test(a) ? 1 : 0, pb = /preview/.test(b) ? 1 : 0;
    return la - lb || pa - pb || ver(b) - ver(a);
  });
  if (!list.length) list = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest'];
  cache.put('gemini_models', JSON.stringify(list.slice(0, 8)), 21600);
  return list.slice(0, 8);
}

/* Admin: try every configured provider with a tiny photo and report what works. */
var TEST_JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCABgAGADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD2aiiigAooooAKKKKACiiigAooooAKKKKACiiigApGYKpZiAAMkntQzBVLMQABkk9q5zVNUN2xhhJEAP4v7/SuPF4uGGhzS36I1pUnUdkX7rXYYiyQIZXBxuP3fr71nSa3fO2VdYxjoqj+uaz6K+Yq5jiaj+K3poelHD049C+mtXyuGMquB/CyDB/Kr1t4gRgFuYypz95OR+X/AOusKippZhiabupX9dQlQpy6HaI6SIHjZXU9CpyDTq5bTtRexkwctEx+Zf6j3rpopUmjWSNgyMMgivp8HjYYmOmklujzq1F035D6KKK7jEKKKKAMrXboxW6wI5DyH5sf3f8A6/8AQ1z1aGtyF9SdSBiNQox9M/1rPr4zMarqYmXlp9x69CPLTQUUUVwG4UUUUAFbWgXR3Pau5xjdGD29R/n3rFqzpshi1GBlAyXC8+/H9a6sFVdKvGS7/gzKtHmg0dbRRRX3B4wUUUUAcxrSMupyFhgOAV9xjH9DVCt3xBbBo0uVByp2Ngdu36/zrCr4rMKTp4mSfXX7z16EuamgoooriNwooooAKsaejSahAFGSJAfwHJ/lVetfQLYPO9wwOIxheO56/p/OunCUnVrxiu5lVlywbN+iiivuTxgooooAa6LJG0bjKsCCPUVzGo6c9jJkZaJj8rf0PvXU0yWJJo2jkUMjDBBrhxuDjiYW2ktmbUazpvyOMorautAOWe1kBGciNu3tms6TTb2JtrW0hOM/KN38q+Vq4KvSdpRf5o9ONaEtmVqKsJp95I4UW0oJ/vLgfmav22gSuA1xIIxn7q8n8+g/WlSwleq7RiwlVhHdlCyspb6by4+FH3nPRRXU28CW0Cwx52qOMnmiC3ito/LhQIuc4FS19RgcDHDRu9ZPd/ojza1Z1H5BRRRXomAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB//9k=';
function aiTest_() {
  var props = PropertiesService.getScriptProperties(), out = [];
  AI_ORDER.forEach(function (p) {
    if (!props.getProperty(AI_KEYS[p])) { out.push({provider: p, configured: false}); return; }
    var t0 = Date.now(), r = callProvider_(p, {prompt: 'What colour is the circle in this image? Reply with only this JSON: {"colour":"<one word>"}', image: TEST_JPEG}, Date.now());
    var sawImage = r.ok && /yellow|gold|orange|amber/i.test(r.text || '');
    out.push({provider: p, configured: true, ok: !!r.ok, vision: sawImage, model: r.model || '', ms: Date.now() - t0,
      error: r.ok ? (sawImage ? '' : 'answered, but did not read the test photo correctly: ' + String(r.text).slice(0, 80)) : ((r.tried || []).map(function (t) { return t.model + ': ' + t.error; }).join(' | ') || 'failed')});
  });
  return {ok: true, chain: aiChain_(), results: out, geminiModels: props.getProperty('GEMINI_API_KEY') ? geminiModels_(props.getProperty('GEMINI_API_KEY')) : []};
}

/* Run from the editor to see the provider report in the execution log. */
function testAI() { Logger.log(JSON.stringify(aiTest_(), null, 2)); }
