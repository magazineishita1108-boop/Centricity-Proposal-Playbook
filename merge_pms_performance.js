// MONTHLY: rebuild window.PMS_PERFORMANCE.pms from PMS_Scheme_Performance_<Month Year>.xlsx.
// aif + benchmarks are carried forward verbatim — this file is PMS-only.
//
// The July-2026 file arrived under a wholesale vendor rename ("ICICI - Value Strategy" became
// "ICICI Prudential - Value Portfolio" and so on), which silently broke 9 of the 16 alias pins.
// REPIN below re-points them by hand; the runbook is explicit that this map is maintained, not
// guessed, because a wrong pin puts another manager's numbers on a client's fund.
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const B = require('./blocklib');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const ASON = flag('--as-on'), HTML = flag('--html');
const SRC = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--as-on' && argv[i - 1] !== '--html');
if (!SRC || !ASON || !HTML) { console.error('Usage: node pms_final.js "<xlsx>" --as-on "..." --html <p> [--apply]'); process.exit(2); }

// MASTER PMS fund name -> exact scheme key in THIS month's file.
const REPIN = {
  'ICICI Prudential Large Cap':              'ICICI Prudential - Large Cap Portfolio',
  'ICICI Pru Contra Strategy':               'ICICI Prudential - Contra Portfolio',
  'ICICI Prudential Value Strategy':         'ICICI Prudential - Value Portfolio',
  'ICICI Pru PIPE Strategy':                 'ICICI Prudential - Pipe Portfolio',
  'Carnelian Shift Strategy':                'Carnelian Capital - Shift Strategy',
  'Girik Multi Cap Growth Equity Strategy':  'Girik Capital - Multi Cap Growth Equity Strategy',
  'Buoyant Capital- Opportunities Strategy': 'Buoyant - Opportunities',
  'Aditya Birla ISOP':                       'Aditya Birla Sun Life (ABSL) - India Special Opportunities (ISOP)',
  'UNIFI Blended PMS':                       'Unifi Blended - Rangoli',
  // previously pinned null because the scheme was absent; it is back this month
  'Neo Yield Enhancer':                      'Neo Yield Enhancer',
  'Abakkus Diversified Alpha Approach Portfolio': 'Abakkus Diversified Alpha Approach',
  // The 03-Sep file drops the doubled apostrophe the vendor used to write ("India''s" -> "Indias").
  // Same scheme, same manager — only the punctuation moved.
  'Emkay Golden Decade PMS':                 'Emkay Investments - Indias Golden Decade of Growth',
};
// Left as null deliberately — see the report at the end of the run.
const STILL_NULL_NOTES = {
  'Negen Capital- Special Situation & Tech Fund':
    'file offers "Negen Special Situations & Dynamic Allocation Strategy" — the strategy name changed from Technology to Dynamic Allocation, which may be a mandate change rather than a rename',
  'Karma Capital Wealth Builder': 'file offers "Karma - Wealth Builder" — looks right, but this pin was set to null specifically to block a Fractal Capital false positive',
  'Emkay Golden Decade PMS': 'file offers "Emkay Investments - India\'\'s Golden Decade of Growth" (note the doubled apostrophe in the source)',
  'Motilal Oswal Founders Portfolio': 'no clear counterpart in this file',
  'Burman Capital Management PMS': 'no clear counterpart in this file',
  'TCG Transformative Growth Portfolio': 'no clear counterpart in this file',
  'Phillip Conservative Credit Portfolio': 'no clear counterpart in this file',
  'Sundaram F.I.R.S.T. Debt PMS': 'no clear counterpart in this file',
  'Julius Baer Premier Focused Portfolio': 'no clear counterpart in this file',
};

const MISSING = /^(|-|--|na|n\.?a\.?|#n\/a|undis\.?|nil\.?)$/i;
const raw = v => (v == null ? '' : String(v).trim());
function num(v) { const t = raw(v); if (MISSING.test(t)) return null; const n = parseFloat(t.replace(/,/g, '')); return isFinite(n) ? n : null; }
const pct = v => { const n = num(v); return n == null ? null : +(n / 100).toFixed(6); };
const plain = v => num(v);

const fmtRate = r => String(+r.toFixed(2)).replace(/\.0+$/, '');
const ord = i => i === 2 ? '2nd' : i === 3 ? '3rd' : i + 'th';
function mergeExitLoad(a, b, c) {
  if (a == null && b == null && c == null) return null;
  const r = [a, b, c].map(v => (v == null ? 0 : v));
  if (r.every(v => v === 0)) return 'Nil';
  let last = 2; while (last >= 0 && r[last] === 0) last--;
  const seg = []; let i = 0;
  while (i <= last) {
    let j = i; while (j + 1 <= last && r[j + 1] === r[i]) j++;
    let span;
    if (i === 0 && j === 0) span = 'for 1 year';
    else if (i === 0) span = 'for ' + (j + 1) + ' years';
    else if (i === j) span = 'for ' + ord(i + 1) + ' year';
    else span = 'for ' + ord(i + 1) + ' year & ' + ord(j + 1) + ' year';
    seg.push(fmtRate(r[i]) + '% ' + span);
    i = j + 1;
  }
  return seg.join(', ') + ', Nil thereafter';
}
function parseExitLoadText(txt) {
  const t = raw(txt);
  if (!t || MISSING.test(t)) return null;
  const get = yr => { const m = t.match(new RegExp(yr + '\\s*(?:year|yr)?\\s*[:\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*%?', 'i')); return m ? parseFloat(m[1]) : null; };
  const a = get('1'), b = get('2'), c = get('3');
  return (a == null && b == null && c == null) ? null : mergeExitLoad(a, b, c);
}

// Find the performance sheet by its HEADER, not its name. The vendor ships the same 33-column
// layout under different tab names — "PMS Performance" in one month's file, a bare "Sheet1" in
// the next. Keying on the name silently yielded zero schemes.
function pickSheet(wb) {
  for (const name of wb.SheetNames) {
    const r = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null, raw: false });
    if (r.length && 'Scheme Name' in r[0] && 'Scheme Return 1 Year' in r[0]) {
      if (name !== 'PMS Performance') console.log('performance sheet found as "' + name + '" (not "PMS Performance")');
      return r;
    }
  }
  console.error('*** no sheet with a "Scheme Name" + "Scheme Return 1 Year" header — layout changed, aborting');
  process.exit(1);
}
const rows = pickSheet(XLSX.readFile(SRC));
const C = { name: 'Scheme Name', aum: 'AUM', pe: 'P/E Ratio', L: 'Large Cap', M: 'Mid Cap', S: 'Small Cap', el: 'Exit Load',
  r1m: 'Scheme Return 1 Month', r3m: 'Scheme Return 3 Month', r6m: 'Scheme Return 6 Month', r1y: 'Scheme Return 1 Year',
  r2y: 'Scheme Return 2 Year', r3y: 'Scheme Return 3 Year', r5y: 'Scheme Return 5 Year', si: 'Scheme Return Since Inception',
  sd1y: 'Standard Deviation 1 Year', sd3y: 'Standard Deviation 3 Year', sharpe1y: 'Sharpe Ratio 1 Year', sharpe3y: 'Sharpe Ratio 3 Year',
  sortino1y: 'Sortino Ratio 1 Year', sortino3y: 'Sortino Ratio 3 Year', alpha1y: 'Alpha 1 Year', alpha3y: 'Alpha 3 Year',
  beta1y: 'Beta 1 Year', beta3y: 'Beta 3 Year' };
for (const h of Object.values(C)) if (!(h in rows[0])) { console.error('*** column missing: ' + h); process.exit(1); }

// AUM units are decided for the COLUMN, not per row: the old per-row ">10 lakh" rule turned a
// genuine 7-lakh-rupee scheme into 700000 Cr.
const aums = rows.map(r => num(r[C.aum])).filter(v => v != null);
const inRupees = Math.max(...aums) > 1e8;
console.log(`AUM column treated as ${inRupees ? 'rupees (all / 1e7)' : 'crore (as-is)'} — max raw ${Math.max(...aums).toLocaleString('en-IN')}`);

const pms = {};
let empties = 0;
const dupeNames = [];
for (const r of rows) {
  const name = raw(r[C.name]); if (!name) continue;
  const rec = {}; const set = (k, v) => { if (v != null) rec[k] = v; };
  const a = num(r[C.aum]);
  if (a != null) set('aum', +(inRupees ? a / 1e7 : a).toFixed(2));
  const el = parseExitLoadText(r[C.el]); if (el) set('exit_load', el);
  for (const k of ['r1m','r3m','r6m','r1y','r2y','r3y','r5y','si','sd1y','sd3y','alpha1y','alpha3y']) set(k, pct(r[C[k]]));
  for (const k of ['sharpe1y','sharpe3y','sortino1y','sortino3y','beta1y','beta3y']) set(k, plain(r[C[k]]));
  set('pe', plain(r[C.pe]));
  const L = pct(r[C.L]), Mi = pct(r[C.M]), S = pct(r[C.S]);
  if (L != null && Mi != null && S != null) { set('mcap_large', L); set('mcap_mid', Mi); set('mcap_small', S); set('mcap_other', +Math.max(0, 1 - (L + Mi + S)).toFixed(6)); }
  if (!Object.keys(rec).length) { empties++; continue; }
  // A scheme can appear twice: once complete, once as a stub carrying a different AUM and no
  // returns (Axis Pure Contra Portfolio in the 03-Sep file). Plain last-wins let the stub blank
  // out real performance, so keep whichever row actually carries more data.
  const prev = pms[name];
  if (prev) {
    const fields = o => Object.keys(o).length;
    dupeNames.push(name + '  ' + fields(prev) + ' vs ' + fields(rec) + ' fields — kept the ' +
      (fields(rec) > fields(prev) ? 'later' : 'earlier'));
    if (fields(rec) <= fields(prev)) continue;
  }
  pms[name] = rec;
}
if (dupeNames.length) {
  console.log('\nduplicate scheme rows resolved by field count: ' + dupeNames.length);
  dupeNames.forEach(d => console.log('   ' + d));
}

const cur = B.read(HTML, 'window.PMS_PERFORMANCE = ').value;
const alias = B.read(HTML, 'window.PMS_PERF_ALIAS = ').value;
const master = B.read(HTML, 'window.MASTER = ').value;
const nextAlias = Object.assign({}, alias);
let repinned = 0;
for (const [m, k] of Object.entries(REPIN)) {
  if (!(m in alias)) { console.error(`*** REPIN target not in the alias map: "${m}"`); process.exit(1); }
  if (!pms[k]) { console.error(`*** REPIN key not in this file: "${k}"`); process.exit(1); }
  nextAlias[m] = k; repinned++;
}

console.log(`schemes: ${Object.keys(pms).length}  (name-only rows skipped: ${empties})`);
console.log(`pms ${Object.keys(cur.pms).length} -> ${Object.keys(pms).length}`);
console.log(`alias pins re-pointed: ${repinned}`);

const pmsFunds = master.filter(r => r.product_class === 'PMS');
const before = pmsFunds.filter(f => alias[f.name] && cur.pms[alias[f.name]]).length;
const after = pmsFunds.filter(f => nextAlias[f.name] && pms[nextAlias[f.name]]).length;
console.log(`\nGATE MASTER PMS funds with performance: ${before} -> ${after} (of ${pmsFunds.length})`);
let fail = after < before;
const bad = [];
for (const [k, v] of Object.entries(pms)) {
  for (const f of ['r1m','r3m','r6m','r1y','r2y','r3y','r5y','si','sd1y','sd3y','alpha1y','alpha3y'])
    if (v[f] != null && Math.abs(v[f]) > 10) bad.push(`${k}.${f}=${v[f]}`);
  if (v.aum != null && (v.aum < 0 || v.aum > 2e5)) bad.push(`${k}.aum=${v.aum}`);
}
console.log(`GATE values in range: ${bad.length ? '*** ' + bad.slice(0, 4).join(' | ') : 'PASS'}`);
if (bad.length) fail = true;
console.log(`GATE aif untouched: ${Object.keys(cur.aif).length} | benchmarks untouched: ${Object.keys(cur.benchmarks).length}`);

console.log('\nre-pointed pins now resolve to:');
for (const [m, k] of Object.entries(REPIN)) {
  const v = pms[k];
  console.log(`   ${m.padEnd(46)} 1Y ${v.r1y != null ? (v.r1y * 100).toFixed(2) + '%' : '—'}  AUM ${v.aum != null ? v.aum.toLocaleString('en-IN') + ' Cr' : '—'}`);
}
console.log('\nstill pinned null — confirm before I pin these:');
for (const [m, why] of Object.entries(STILL_NULL_NOTES)) console.log(`   ${m}\n      ${why}`);

if (!APPLY) { console.log('\n[dry run] pass --apply to write'); process.exit(0); }
if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }
B.writeBlocks(HTML, [
  { prefix: 'window.PMS_PERFORMANCE = ', value: { pms, aif: cur.aif, benchmarks: cur.benchmarks } },
  { prefix: 'window.PMS_PERF_ALIAS = ', value: nextAlias },
]);
let h = fs.readFileSync(HTML, 'utf8');
h = h.replace(/(pms:\s*)"[^"]*"/, `$1"${ASON}"`);
fs.writeFileSync(HTML, h, 'utf8');
console.log(`\nWROTE ${HTML} — ${h.length} bytes; DATA_DATES.pms = "${ASON}"`);
