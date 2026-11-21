/**
 * TrackMyFood — Google Apps Script backend.
 * Bind this to a Google Sheet (Extensions > Apps Script), run setup() once,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 *
 * Script properties (Project Settings > Script properties):
 *   APP_TOKEN          created by setup(); paste it into the app's Settings
 *   GEMINI_API_KEY     Google AI Studio key (free tier) used for photo recognition
 *   ANTHROPIC_API_KEY  optional: Claude API key, used only if GEMINI_API_KEY is not set
 *   GEMINI_MODEL       optional: override the Gemini model id
 */

var NK = ['kcal','pro','carb','fat','fib','sug','sfat','na','k','ca','fe','vc','va'];
var NUT_HEAD = ['kcal','protein_g','carbs_g','fat_g','fibre_g','sugar_g','satfat_g','sodium_mg','potassium_mg','calcium_mg','iron_mg','vitc_mg','vita_mcg'];
var SLOT_LABEL = {breakfast:'Breakfast', msnack:'Morning snack', lunch:'Lunch', esnack:'Evening snack', dinner:'Dinner'};
var LOG_HEAD = ['id','date','meal','name','qty','unit','grams'].concat(NUT_HEAD).concat(['source','food_id','rule_id','deleted','updated_at','slot_key']);
var GENERIC_HEAD = ['id','name','updated_at','deleted','json'];
var SHEETS = {
  Log: LOG_HEAD,
  Daily: ['date'].concat(NUT_HEAD).concat(['items']),
  MyMeals: GENERIC_HEAD,
  Recurring: GENERIC_HEAD,
  CustomFoods: GENERIC_HEAD,
  Settings: GENERIC_HEAD
};
var KIND_SHEET = {meal:'MyMeals', rule:'Recurring', food:'CustomFoods', settings:'Settings'};
// Used when the script is not bound to the sheet. Set SHEET_ID in Script properties (setup() does this when bound).
var DEFAULT_SHEET_ID = '';

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

function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (name === 'Log' || name === 'Daily') sh.getRange(2, name === 'Log' ? 2 : 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
  }
  return sh;
}

function doGet() {
  return ContentService.createTextOutput('TrackMyFood backend is running.');
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var tok = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
    if (tok && req.token !== tok) return out_({ok: false, error: 'Wrong token. Copy APP_TOKEN from the script into the app.'});
    if (req.action === 'ping') return out_({ok: true});
    if (req.action === 'push') return out_(push_(req.ops || []));
    if (req.action === 'pull') return out_(pull_(req.from));
    if (req.action === 'claude') return out_(claude_(req.body));
    if (req.action === 'vision') return out_(vision_(req));
    return out_({ok: false, error: 'Unknown action'});
  } catch (err) {
    return out_({ok: false, error: String(err && err.message || err)});
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '');
}

/* ---------- push: upsert records by id ---------- */
function push_(ops) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var touched = {};
    var entries = ops.filter(function (o) { return o.kind === 'entry'; }).map(function (o) { return o.rec; });
    if (entries.length) {
      upsert_(sheet_('Log'), entries.map(function (r) {
        touched[r.date] = true;
        var n = r.n || {};
        return ['' + r.id, '' + r.date, SLOT_LABEL[r.slot] || r.slot, r.name, round_(r.qty), r.unit, round_(r.grams)]
          .concat(NK.map(function (k) { return round_(n[k]); }))
          .concat([r.src || '', r.foodId || '', r.ruleId || '', !!r.deleted, r.updatedAt || Date.now(), r.slot]);
      }));
    }
    Object.keys(KIND_SHEET).forEach(function (kind) {
      var recs = ops.filter(function (o) { return o.kind === kind; }).map(function (o) { return o.rec; });
      if (recs.length) upsert_(sheet_(KIND_SHEET[kind]), recs.map(function (r) {
        return ['' + r.id, r.name || r.id, r.updatedAt || Date.now(), !!r.deleted, JSON.stringify(r)];
      }));
    });
    var dates = Object.keys(touched);
    if (dates.length) daily_(dates);
    return {ok: true, count: ops.length};
  } finally {
    lock.releaseLock();
  }
}

function round_(x) { return Math.round((+x || 0) * 100) / 100; }

function upsert_(sh, rows) {
  var last = sh.getLastRow();
  var ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var idx = {};
  ids.forEach(function (id, i) { idx[id] = i + 2; });
  var appends = [];
  rows.forEach(function (row) {
    var at = idx[row[0]];
    if (at) sh.getRange(at, 1, 1, row.length).setValues([row]);
    else { appends.push(row); idx[row[0]] = -1; }
  });
  if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, appends[0].length).setValues(appends);
}

/* ---------- Daily summary per date ---------- */
function daily_(dates) {
  var log = sheet_('Log'), last = log.getLastRow();
  if (last < 2) return;
  var vals = log.getRange(2, 1, last - 1, LOG_HEAD.length).getValues();
  var delCol = LOG_HEAD.indexOf('deleted');
  var want = {};
  dates.forEach(function (d) { want[d] = {n: NK.map(function () { return 0; }), c: 0}; });
  vals.forEach(function (r) {
    var d = ymd_(r[1]);
    if (!want[d] || r[delCol] === true || r[delCol] === 'TRUE') return;
    for (var i = 0; i < NK.length; i++) want[d].n[i] += +r[7 + i] || 0;
    want[d].c++;
  });
  var dsh = sheet_('Daily');
  var rows = dates.map(function (d) { return [d].concat(want[d].n.map(round_)).concat([want[d].c]); });
  upsert_(dsh, rows);
  if (dsh.getLastRow() > 2) dsh.getRange(2, 1, dsh.getLastRow() - 1, SHEETS.Daily.length).sort(1);
}

/* ---------- pull: everything since a date ---------- */
function pull_(from) {
  from = from || '0000-00-00';
  var log = sheet_('Log'), last = log.getLastRow(), entries = [];
  if (last > 1) {
    log.getRange(2, 1, last - 1, LOG_HEAD.length).getValues().forEach(function (r) {
      var d = ymd_(r[1]);
      if (!r[0] || d < from) return;
      var n = {};
      NK.forEach(function (k, i) { n[k] = +r[7 + i] || 0; });
      entries.push({
        id: String(r[0]), date: d, slot: r[LOG_HEAD.indexOf('slot_key')] || 'lunch', name: r[3],
        qty: +r[4], unit: r[5], grams: +r[6], n: n,
        src: r[20], foodId: r[21], ruleId: r[22],
        deleted: r[23] === true || r[23] === 'TRUE', updatedAt: +r[24] || 0
      });
    });
  }
  var res = {ok: true, entries: entries, meals: generic_('MyMeals'), rules: generic_('Recurring'), foods: generic_('CustomFoods')};
  var st = generic_('Settings');
  if (st.length) res.settings = st[0];
  return res;
}

function generic_(name) {
  var sh = sheet_(name), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 5).getValues().map(function (r) {
    try { var o = JSON.parse(r[4]); o.updatedAt = +r[2] || o.updatedAt; o.deleted = r[3] === true || r[3] === 'TRUE'; return o; }
    catch (e) { return null; }
  }).filter(function (x) { return x; });
}

/* ---------- Claude proxy (keeps the API key out of the phone) ---------- */
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
    if (code === 400 || code === 401 || code === 403) {
      if (/API key/i.test(lastErr)) break; // bad key: no point trying other models
    }
    // 404 (model unavailable) or 429 (quota) -> try the next model
  }
  return {ok: false, error: lastErr};
}

/* Run this once from the editor to check the Gemini key without the app. */
function testGemini() {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
    method: 'post', contentType: 'application/json', headers: {'x-goog-api-key': key}, muteHttpExceptions: true,
    payload: JSON.stringify({contents: [{parts: [{text: 'Reply with the single word OK'}]}]})
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
}
