// MONTHLY: PMS / AIF equity look-through from "PMS & AIF Analytics <Month Year>.xlsx".
//
//   node merge_pms_aif_analytics.js "<xlsx>" --as-on "31st July 2026" [--html <p>] [--apply]
//
// The workbook is one row per holding: Product Category | Scheme Name | Company Name |
// Corrected Name | Holding(%) | Sector | ISIN | SEBI Mcap. `Corrected Name` is the normalised
// security name and is what the store keys on; `Holding(%)` is a FRACTION (each scheme sums to
// ~1.0), so everything is scaled by 100 to reach the store's percent scale.
//
// THE ENTRY MUST BE WRITTEN TWICE. Centricity_June_Refresh.js carries its own `EQ` object of 12
// PMS/AIF look-through records from the May-2026 file and re-assigns them on EVERY page load:
//     window.EQUITY_ANALYTICS[k] = EQ[k]
// Baking July into the embedded block alone leaves those schemes silently reverting to May — the
// same trap as the GIFT City bucket. This tool updates the sibling's EQ for any scheme it shares.
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const B = require('./blocklib');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const ASON = flag('--as-on');
const HTML = flag('--html') || path.join(__dirname, 'index.html');
const SRC = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--html' && argv[i - 1] !== '--as-on');
if (!SRC || !ASON) { console.error('Usage: node merge_pms_aif_analytics.js "<xlsx>" --as-on "31st July 2026" [--html <p>] [--apply]'); process.exit(2); }

// Workbook scheme name -> MASTER name. Maintained by hand: a wrong pin puts one manager's
// holdings on another manager's fund. `Product Category` disambiguates the two Buoyant records
// (a PMS and an AIF share the strategy name, differing only by dash character).
const PIN = {
  'Negen Special Situations & Dynamic Allocation Strategy': 'Negen Capital- Special Situation & Tech Fund',
  'Stallion Asset Core Fund Portfolio':                     'Stallion Asset Core Fund',
  'Abakkus All Cap Approach':                               'Abakkus All Cap PMS',
  'Abakkus Emerging Opportunities Approach Portfolio':      'Abakkus Emerging Opportunities Fund',
  'AlfAccurate Budding Beasts':                             'AlfAccurate Budding Beasts PMS',
};
// In the workbook but with no MASTER instrument. Adding one is a universe change
// (add_reckoner_funds.js), not a refresh — so the holdings are reported and skipped.
const NO_MASTER_NOTE = {
  '3P INDIA EQUITY FUND 1': 'MASTER carries only "3P India Gift City Fund (Inbound)", a different vehicle',
  'AlfAccurate India Equity Fund Scheme 1': 'no PMS or AIF record of this name in MASTER',
};

const clean = s => String(s == null ? '' : s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const r2 = n => Math.round(n * 100) / 100;

// ---------- read ----------
const wb = XLSX.readFile(SRC);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
const C = { cat: 'Product Category', scheme: 'Scheme Name', name: 'Corrected Name',
  pct: 'Holding(%)', sector: 'Sector', mcap: 'SEBI Mcap' };
for (const h of Object.values(C)) if (!(h in rows[0])) { console.error('*** column missing: "' + h + '" — layout changed, aborting'); process.exit(1); }

const bySch = new Map();
for (const r of rows) {
  const s = clean(r[C.scheme]);
  if (!s) continue;
  if (!bySch.has(s)) bySch.set(s, { cat: clean(r[C.cat]), rows: [] });
  bySch.get(s).rows.push(r);
}
console.log('source: ' + path.basename(SRC) + '   rows ' + rows.length + '   schemes ' + bySch.size + '\n');

// ---------- resolve + build ----------
const MASTER = B.read(HTML, 'window.MASTER = ').value;
const EQ0 = B.read(HTML, 'window.EQUITY_ANALYTICS = ').value;
const byName = new Map(MASTER.map(r => [r.name, r]));
const MCAP_KEYS = ['Large', 'Mid', 'Small', 'Others'];

const built = {}, unmapped = [], report = [];
let fail = false;
for (const [scheme, v] of bySch) {
  const target = PIN[scheme] || (byName.has(scheme) ? scheme : null);
  if (!target || !byName.has(target)) { unmapped.push({ scheme: scheme, cat: v.cat }); continue; }
  const m = byName.get(target);
  if (m.product_class !== 'PMS' && m.product_class !== 'AIF') {
    console.error('*** "' + scheme + '" resolves to ' + target + ' which is ' + m.product_class + ', not PMS/AIF');
    fail = true; continue;
  }

  const mcap = { Large: 0, Mid: 0, Small: 0, Others: 0 };
  const sector = {};
  const stockMap = new Map();
  let total = 0;
  for (const r of v.rows) {
    const p = Number(r[C.pct]);
    if (!isFinite(p)) continue;
    const pct = p * 100;                                   // the column is a fraction
    total += pct;
    const mk = clean(r[C.mcap]).replace(/\s*Cap$/i, '');
    mcap[MCAP_KEYS.indexOf(mk) >= 0 ? mk : 'Others'] += pct;
    const sec = clean(r[C.sector]) || 'Others';
    sector[sec] = (sector[sec] || 0) + pct;
    const nm = clean(r[C.name]) || clean(r['Company Name']);
    if (nm) stockMap.set(nm, (stockMap.get(nm) || 0) + pct);
  }
  for (const k of MCAP_KEYS) mcap[k] = r2(mcap[k]);
  for (const k of Object.keys(sector)) sector[k] = r2(sector[k]);
  const stocks = [...stockMap.entries()].sort((a, b) => b[1] - a[1]).map(e => ({ name: e[0], pct: r2(e[1]) }));

  built[target] = { mcap: mcap, sector: sector, stocks: stocks, total: r2(total) };
  const prev = EQ0[target];
  report.push({ scheme: scheme, target: target, cat: v.cat, n: stocks.length, total: r2(total),
    prevN: prev ? (prev.stocks || []).length : null });
}

console.log('mapped ' + Object.keys(built).length + ' of ' + bySch.size + ' schemes:');
report.forEach(x => console.log('   ' + x.cat.padEnd(4) + x.scheme.slice(0, 44).padEnd(46) + '-> ' +
  x.target.slice(0, 44).padEnd(46) + x.n + ' stocks (was ' + (x.prevN == null ? 'none' : x.prevN) + '), total ' + x.total.toFixed(1) + '%'));
if (unmapped.length) {
  console.log('\nno MASTER instrument — holdings skipped:');
  unmapped.forEach(u => { console.log('   ! ' + u.cat + '  ' + u.scheme); if (NO_MASTER_NOTE[u.scheme]) console.log('       ' + NO_MASTER_NOTE[u.scheme]); });
}

// ---------- the sibling that would revert this ----------
const SIB = path.join(path.dirname(HTML), 'Centricity_June_Refresh.js');
let sibEQ = null, sibOverlap = [];
try { sibEQ = B.read(SIB, 'var EQ = ').value; } catch (e) { console.error('\n*** could not read EQ from ' + path.basename(SIB) + ': ' + e.message); fail = true; }
if (sibEQ) {
  sibOverlap = Object.keys(built).filter(k => k in sibEQ);
  console.log('\n' + path.basename(SIB) + ' re-assigns ' + Object.keys(sibEQ).length +
    ' PMS/AIF entries on every page load; ' + sibOverlap.length + ' of them are refreshed here:');
  sibOverlap.forEach(k => console.log('   ~ ' + k));
}

// ---------- gates ----------
console.log('\n---------------- gates ----------------');
const bad = [];
for (const [k, a] of Object.entries(built)) {
  if (a.total < 95 || a.total > 105) bad.push(k + ' total=' + a.total);
  const ms = Object.values(a.mcap).reduce((x, y) => x + y, 0);
  const ss = Object.values(a.sector).reduce((x, y) => x + y, 0);
  const ks = a.stocks.reduce((x, y) => x + y.pct, 0);
  if (Math.abs(ms - a.total) > 1) bad.push(k + ' mcap sums ' + ms.toFixed(2) + ' vs total ' + a.total);
  if (Math.abs(ss - a.total) > 1) bad.push(k + ' sector sums ' + ss.toFixed(2) + ' vs total ' + a.total);
  if (Math.abs(ks - a.total) > 1) bad.push(k + ' stocks sum ' + ks.toFixed(2) + ' vs total ' + a.total);
}
console.log('GATE totals ~100 and mcap/sector/stocks reconcile: ' + (bad.length ? '*** ' + bad.slice(0, 4).join(' | ') : 'PASS'));
if (bad.length) fail = true;
console.log('GATE every mapped key is a MASTER PMS/AIF record: ' +
  (Object.keys(built).every(k => byName.has(k)) ? 'PASS' : '*** unresolved'));
const next = Object.assign({}, EQ0, built);
const pmsAif = MASTER.filter(r => r.product_class === 'PMS' || r.product_class === 'AIF');
const before = pmsAif.filter(r => EQ0[r.name]).length;
const after = pmsAif.filter(r => next[r.name]).length;
console.log('GATE MASTER PMS/AIF with look-through: ' + before + ' -> ' + after + ' (of ' + pmsAif.length + ')');
if (after < before) fail = true;
console.log('GATE EQUITY_ANALYTICS ' + Object.keys(EQ0).length + ' -> ' + Object.keys(next).length);

if (!APPLY) { console.log('\n[dry run] pass --apply to write'); process.exit(fail ? 1 : 0); }
if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }

B.writeBlocks(HTML, [{ prefix: 'window.EQUITY_ANALYTICS = ', value: next }]);
let h = fs.readFileSync(HTML, 'utf8');
h = h.replace(/(analytics:\s*)"[^"]*"/, '$1"' + ASON + '"');
fs.writeFileSync(HTML, h, 'utf8');
console.log('\nWROTE ' + HTML + ' — ' + h.length + ' bytes; DATA_DATES.analytics = "' + ASON + '"');

if (sibOverlap.length) {
  const nextSib = Object.assign({}, sibEQ);
  for (const k of sibOverlap) nextSib[k] = built[k];
  B.writeBlocks(SIB, [{ prefix: 'var EQ = ', value: nextSib }]);
  console.log('WROTE ' + SIB + ' — EQ refreshed for ' + sibOverlap.length + ' scheme' + (sibOverlap.length === 1 ? '' : 's'));
}
