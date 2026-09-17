// MONTHLY: refresh MASTER.fund_mgr from "Fund Manager Data_<date>.xlsx".
//
// The Daily MF Monitor already fills fund_mgr, but only from its "[Fund Manager 1]" column —
// one name, even where a scheme is run by three or four people. This workbook is one row per
// manager per stint (Scheme Name | Inception Date | Fund Manager | From Date | To Date), so it
// can name the whole current team.
//
//   node merge_fund_managers.js "<Fund Manager Data_<date>.xlsx>" [--html <p>] [--apply]
//
// "Current" is decided PER SCHEME, not against one global date: AMCs report to different
// month-ends in the same file (Aug-2026 had 1,123 rows at 30-Aug and 3,317 at 30-Jul). A
// manager is current when their To Date is the latest To Date that scheme has — provided that
// date is recent enough to trust (within RECENT_DAYS of the file's own latest). A scheme whose
// roster stopped updating long ago keeps whatever the Monitor gave it rather than being
// credited to whoever happened to be there last.
//
// fund_mgr is internal — the Master Editor column and the Section 3 search box. It is not shown
// to clients, so a multi-name string is safe here.
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const blocklib = require('./blocklib.js');

const RECENT_DAYS = 90;

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const HTML = flag('--html') || path.join(__dirname, 'index.html');
const SRC = argv.find(a => !a.startsWith('--') && a !== HTML);
if (!SRC || !fs.existsSync(SRC)) {
  console.error('Usage: node merge_fund_managers.js "<Fund Manager Data_<date>.xlsx>" [--html <p>] [--apply]');
  process.exit(2);
}
console.log(`source : ${path.basename(SRC)}`);

const wb = XLSX.readFile(SRC, { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
const H = Object.keys(rows[0] || {});
const find = re => H.find(h => re.test(String(h).trim()));
const cScheme = find(/^scheme name$/i), cMgr = find(/^fund manager$/i),
      cFrom = find(/^from date$/i), cTo = find(/^to date$/i);
if (!cScheme || !cMgr || !cTo) { console.error(`*** column layout changed (${H.join(' | ')}) — aborting`); process.exit(1); }

const iso = d => (d instanceof Date && !isNaN(d)) ? d.toISOString().slice(0, 10) : null;
const data = rows.filter(r => r[cMgr] && String(r[cMgr]).trim() && iso(r[cTo]));
console.log(`rows   : ${rows.length} (${data.length} with a manager and a To Date)`);

// The file's own latest To Date is the yardstick for "recent".
let fileMax = '';
for (const r of data) { const d = iso(r[cTo]); if (d > fileMax) fileMax = d; }
const cutoff = new Date(new Date(fileMax + 'T00:00:00Z').getTime() - RECENT_DAYS * 86400000).toISOString().slice(0, 10);
console.log(`latest To Date in file: ${fileMax}   (a scheme is "live" if its own latest is >= ${cutoff})\n`);

// ---------- per-scheme current roster ----------
const bySch = new Map();
for (const r of data) {
  const s = String(r[cScheme]).trim();
  if (!bySch.has(s)) bySch.set(s, []);
  bySch.get(s).push({ mgr: String(r[cMgr]).trim(), from: iso(r[cFrom]) || '', to: iso(r[cTo]) });
}
const roster = new Map();
let stale = 0;
for (const [s, list] of bySch) {
  const max = list.reduce((a, b) => (b.to > a ? b.to : a), '');
  if (max < cutoff) { stale++; continue; }
  const cur = list.filter(x => x.to === max);
  // Longest-serving first, so the lead manager reads first; de-duped, a manager can have two stints.
  cur.sort((a, b) => (a.from || '9999').localeCompare(b.from || '9999'));
  const names = [];
  for (const c of cur) if (!names.includes(c.mgr)) names.push(c.mgr);
  if (names.length) roster.set(s, names.join(', '));
}
console.log(`schemes in file       : ${bySch.size}`);
console.log(`with a current roster : ${roster.size}`);
console.log(`roster too stale      : ${stale}  (left on the Monitor's value)\n`);

// ---------- join ----------
const html = fs.readFileSync(HTML, 'utf8');
const master = blocklib.locate(html, 'window.MASTER = ').value;
const norm = s => String(s || '').toLowerCase().replace(/ /g, ' ').replace(/[^a-z0-9]+/g, '');
const byName = new Map(), byNorm = new Map();
for (const f of master) {
  byName.set(f.name, f);
  if (f.prev_name) byName.set(f.prev_name, f);          // survives the SEBI rename either way
  const k = norm(f.name); if (!byNorm.has(k)) byNorm.set(k, f);
}

let exact = 0, viaNorm = 0, unmatched = 0, changed = 0, same = 0, enriched = 0;
const misses = [], samples = [];
for (const [s, names] of roster) {
  let f = byName.get(s);
  if (f) exact++;
  else { f = byNorm.get(norm(s)); if (f) viaNorm++; }
  if (!f) { unmatched++; if (misses.length < 10) misses.push(s); continue; }
  const before = f.fund_mgr || null;
  if (before === names) { same++; continue; }
  if (before && names.includes(before)) enriched++;      // Monitor's single name, now the full team
  changed++;
  if (samples.length < 8) samples.push(`${f.name}\n       was: ${before || '(none)'}\n       now: ${names}`);
  f.fund_mgr = names;
}
console.log(`matched exactly       : ${exact}`);
console.log(`matched normalised    : ${viaNorm}`);
console.log(`unmatched             : ${unmatched}${misses.length ? '   e.g. ' + misses.slice(0, 4).join(' | ') : ''}`);
console.log(`\nfund_mgr unchanged    : ${same}`);
console.log(`fund_mgr rewritten    : ${changed}  (of which ${enriched} just gained the rest of the team)`);
console.log('\nsamples:');
samples.forEach(s => console.log('   ' + s));

// ---------- gates ----------
const MF = f => /Mutual Fund|ETF|Index Fund/i.test(f.product_class || '');
const mf = master.filter(MF);
const cover = mf.filter(f => f.fund_mgr).length;
console.log(`\nGATE MF/ETF/Index carrying fund_mgr: ${cover} of ${mf.length}`);
const empty = master.filter(f => f.fund_mgr != null && String(f.fund_mgr).trim() === '');
console.log(`GATE no blank fund_mgr written: ${empty.length ? 'FAIL ' + empty.length : 'PASS'}`);
if (empty.length) process.exit(1);
const longest = master.reduce((a, f) => (f.fund_mgr && f.fund_mgr.length > (a.fund_mgr || '').length ? f : a), {});
console.log(`GATE longest fund_mgr: ${(longest.fund_mgr || '').length} chars — "${longest.fund_mgr}"`);
const dupes = master.map(f => f.name).filter((n, i, a) => a.indexOf(n) !== i);
console.log(`GATE duplicate MASTER names: ${dupes.length ? 'FAIL' : 'PASS (0)'}`);
if (dupes.length) process.exit(1);

if (!APPLY) { console.log('\n[dry run] pass --apply to write ' + path.basename(HTML)); process.exit(0); }
const size = blocklib.writeBlocks(HTML, [{ prefix: 'window.MASTER = ', value: master }]);
console.log(`\nwrote ${path.basename(HTML)} (${size} bytes)`);
