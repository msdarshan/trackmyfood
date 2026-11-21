// TrackMyFood widget for the Scriptable app (iOS).
// Shows today's calories and protein against your targets.
// Sizes: small, medium, and lock-screen (circular / rectangular / inline).
// Setup: TrackMyFood app → Settings → iPhone widget → Copy widget script, then paste it into a new Scriptable script.
// The line below is filled in by the app with your personal setup code. Keep it private.
const PRESET = "";

const APP_URL = "https://msdarshan.github.io/trackmyfood/";
const KEY = "trackmyfood_cfg";
const C = {
  bg: new Color("#0f0e0d"), card: new Color("#1b1917"), track: new Color("#302c28"),
  ink: new Color("#f3efe9"), mute: new Color("#a19a90"),
  kcal: new Color("#f08a3c"), pro: new Color("#6f9bff"), over: new Color("#ff6b57"), ok: new Color("#5fcf8a")
};

function decodeCfg(str) {
  if (!str) return null;
  try {
    let code = String(str).trim();
    const i = code.indexOf("cfg=");
    if (i >= 0) code = code.slice(i + 4);
    code = code.split(/[\s&]/)[0];
    const c = JSON.parse(Data.fromBase64String(code).toRawString());
    return c && c.u && c.t ? c : null;
  } catch (e) { return null; }
}

async function getCfg() {
  let c = decodeCfg(args.widgetParameter) || decodeCfg(PRESET) || (Keychain.contains(KEY) ? decodeCfg(Keychain.get(KEY)) : null);
  if (!c && config.runsInApp) {
    const a = new Alert();
    a.title = "Connect TrackMyFood";
    a.message = "Paste your TrackMyFood setup link (the one with #cfg=). It is saved in this phone's keychain.";
    a.addTextField("https://…#cfg=…", Pasteboard.paste() || "");
    a.addAction("Save");
    a.addCancelAction("Cancel");
    if (await a.present() === 0) {
      const v = a.textFieldValue(0);
      c = decodeCfg(v);
      if (c) Keychain.set(KEY, v);
    }
  }
  return c;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), "trackmyfood-widget-cache.json");

async function load(cfg) {
  try {
    const r = new Request(cfg.u);
    r.method = "POST";
    r.timeoutInterval = 20;
    r.body = JSON.stringify({ action: "summary", token: cfg.t, date: todayStr() });
    const j = await r.loadJSON();
    if (!j.ok) throw new Error(j.error || "Request failed");
    j.fetchedAt = Date.now();
    fm.writeString(cachePath, JSON.stringify(j));
    return j;
  } catch (e) {
    if (fm.fileExists(cachePath)) {
      const j = JSON.parse(fm.readString(cachePath));
      if (j.date === todayStr()) { j.stale = true; return j; }
    }
    return { error: e.message || String(e) };
  }
}

// ---- drawing helpers ----
function ring(size, pct, color, width, label, sub) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const r = (size - width) / 2, cx = size / 2, cy = size / 2;
  const arc = (from, to, col) => {
    const steps = Math.max(2, Math.ceil((to - from) * 90));
    for (let i = 0; i < steps; i++) {
      const a = (-0.25 + from + (to - from) * i / steps) * 2 * Math.PI;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      ctx.setFillColor(col);
      ctx.fillEllipse(new Rect(x - width / 2, y - width / 2, width, width));
    }
  };
  arc(0, 1, C.track);
  const p = Math.max(0, Math.min(pct, 1));
  if (p > 0) arc(0, p, pct > 1 ? C.over : color);
  if (label) {
    ctx.setTextAlignedCenter();
    ctx.setTextColor(C.ink);
    ctx.setFont(Font.boldRoundedSystemFont(size * 0.2));
    ctx.drawTextInRect(label, new Rect(0, cy - size * 0.17, size, size * 0.26));
    if (sub) {
      ctx.setTextColor(C.mute);
      ctx.setFont(Font.mediumSystemFont(size * 0.095));
      ctx.drawTextInRect(sub, new Rect(0, cy + size * 0.08, size, size * 0.14));
    }
  }
  return ctx.getImage();
}

function bar(w, h, pct, color) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const path = (width) => { const p = new Path(); p.addRoundedRect(new Rect(0, 0, width, h), h / 2, h / 2); return p; };
  ctx.addPath(path(w)); ctx.setFillColor(C.track); ctx.fillPath();
  const p = Math.max(0, Math.min(pct, 1));
  if (p > 0) { ctx.addPath(path(Math.max(h, w * p))); ctx.setFillColor(pct > 1 ? C.over : color); ctx.fillPath(); }
  return ctx.getImage();
}

function weekChart(w, h, week, target) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const max = Math.max(target * 1.2, ...week.map(d => d.kcal), 1);
  const bw = w / week.length;
  week.forEach((d, i) => {
    const bh = Math.max(3, (h - 2) * d.kcal / max);
    const p = new Path();
    p.addRoundedRect(new Rect(i * bw + bw * 0.2, h - bh, bw * 0.6, bh), 2, 2);
    ctx.addPath(p);
    ctx.setFillColor(d.kcal === 0 ? C.track : d.kcal > target ? C.over : (i === week.length - 1 ? C.kcal : new Color("#f08a3c", 0.55)));
    ctx.fillPath();
  });
  const ty = h - (h - 2) * target / max;
  ctx.setFillColor(new Color("#f3efe9", 0.35));
  for (let x = 0; x < w; x += 6) ctx.fillRect(new Rect(x, ty, 3, 1));
  return ctx.getImage();
}

const fmt = n => Math.round(n).toLocaleString("en-IN");
function text(stack, s, font, color, opts) {
  const t = stack.addText(s);
  t.font = font; t.textColor = color || C.ink;
  if (opts && opts.min) t.minimumScaleFactor = opts.min;
  t.lineLimit = 1;
  return t;
}

// ---- layouts ----
function errorWidget(msg) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  text(w, "TrackMyFood", Font.boldSystemFont(14), C.kcal);
  w.addSpacer(6);
  const t = w.addText(msg);
  t.font = Font.systemFont(12); t.textColor = C.mute;
  w.url = APP_URL;
  return w;
}

function smallWidget(d) {
  const t = d.today, g = d.targets;
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(12, 12, 12, 12);
  const top = w.addStack(); top.centerAlignContent();
  text(top, "Today", Font.semiboldSystemFont(12), C.mute);
  top.addSpacer();
  text(top, d.stale ? "offline" : "", Font.systemFont(10), C.mute);
  w.addSpacer(4);
  const row = w.addStack(); row.addSpacer();
  const img = row.addImage(ring(180, t.kcal / g.kcal, C.kcal, 18, fmt(t.kcal), "of " + fmt(g.kcal) + " kcal"));
  img.imageSize = new Size(86, 86);
  row.addSpacer();
  w.addSpacer(6);
  const pr = w.addStack(); pr.centerAlignContent();
  text(pr, "Protein", Font.semiboldSystemFont(11));
  pr.addSpacer();
  text(pr, Math.round(t.pro) + "/" + Math.round(g.pro) + " g", Font.mediumSystemFont(11), C.pro);
  w.addSpacer(3);
  const b = w.addImage(bar(260, 12, t.pro / g.pro, C.pro));
  b.imageSize = new Size(130, 6);
  return w;
}

function mediumWidget(d) {
  const t = d.today, g = d.targets;
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(12, 14, 12, 14);
  const main = w.addStack(); main.centerAlignContent();
  main.addImage(ring(200, t.kcal / g.kcal, C.kcal, 20, fmt(t.kcal), "kcal")).imageSize = new Size(84, 84);
  main.addSpacer(10);
  main.addImage(ring(200, t.pro / g.pro, C.pro, 20, Math.round(t.pro) + "g", "protein")).imageSize = new Size(84, 84);
  main.addSpacer(14);
  const col = main.addStack(); col.layoutVertically();
  const left = g.kcal - t.kcal, pLeft = g.pro - t.pro;
  text(col, left >= 0 ? fmt(left) + " kcal left" : fmt(-left) + " kcal over", Font.boldSystemFont(14), left >= 0 ? C.ink : C.over, { min: 0.7 });
  text(col, pLeft > 0 ? Math.round(pLeft) + " g protein to go" : "Protein target hit", Font.mediumSystemFont(12), pLeft > 0 ? C.pro : C.ok, { min: 0.7 });
  text(col, "C " + Math.round(t.carb) + " · F " + Math.round(t.fat) + " · Fib " + Math.round(t.fib) + " g", Font.systemFont(11), C.mute, { min: 0.7 });
  col.addSpacer(6);
  col.addImage(weekChart(260, 56, d.week, g.kcal)).imageSize = new Size(130, 28);
  text(col, "Last 7 days" + (d.stale ? " · offline" : ""), Font.systemFont(9), C.mute);
  return w;
}

function circularWidget(d) {
  const w = new ListWidget();
  const img = w.addImage(ring(120, d.today.kcal / d.targets.kcal, Color.white(), 12, fmt(d.today.kcal), "kcal"));
  img.imageSize = new Size(58, 58);
  return w;
}

function rectWidget(d) {
  const t = d.today, g = d.targets;
  const w = new ListWidget();
  text(w, "🍽 " + fmt(t.kcal) + " / " + fmt(g.kcal) + " kcal", Font.boldSystemFont(13), Color.white(), { min: 0.7 });
  w.addSpacer(2);
  w.addImage(bar(300, 10, t.kcal / g.kcal, Color.white())).imageSize = new Size(150, 5);
  w.addSpacer(3);
  text(w, "P " + Math.round(t.pro) + " / " + Math.round(g.pro) + " g", Font.mediumSystemFont(12), Color.white(), { min: 0.7 });
  w.addSpacer(2);
  w.addImage(bar(300, 10, t.pro / g.pro, Color.white())).imageSize = new Size(150, 5);
  return w;
}

// ---- main ----
const cfg = await getCfg();
let widget;
const fam = config.widgetFamily || "medium";
if (!cfg) {
  widget = errorWidget("Open this script in Scriptable once and paste your setup link.");
} else {
  const d = await load(cfg);
  if (d.error) widget = errorWidget(d.error);
  else if (fam === "small") widget = smallWidget(d);
  else if (fam === "accessoryCircular") widget = circularWidget(d);
  else if (fam === "accessoryRectangular") widget = rectWidget(d);
  else if (fam === "accessoryInline") { widget = new ListWidget(); widget.addText(fmt(d.today.kcal) + " kcal · " + Math.round(d.today.pro) + " g protein"); }
  else widget = mediumWidget(d);
}
widget.url = APP_URL;
widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(widget);
else if (fam === "small") await widget.presentSmall();
else await widget.presentMedium();
Script.complete();
