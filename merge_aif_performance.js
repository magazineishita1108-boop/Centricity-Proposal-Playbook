// MONTHLY: rebuild PMS_PERFORMANCE.aif + .benchmarks from the Reckoner deck.
//
//   node merge_aif_performance.js "<Monthly Investment Reckoner - <Month Year>.pptx>" [--html <p>] [--apply]
//
// AIF had no recurring source and sat frozen at May 2026, but the deck's
// "AIF PERFORMANCE (CAT III) – LISTED EQUITY" slide is exactly one: Strategy | Inception Date |
// AUM (Cr) | 1M | 3M | 6M | 1Y | 3Y | 5Y | SI | Large | Mid | Small | Cash & Others, as on the
// deck's own performance date. `pms` is carried forward untouched — merge_pms_performance.js owns it.
//
// The AIF grid has no 2Y column, so the benchmark block is taken from the PMS – EQUITY grid
// instead: it carries all four indices WITH 2Y, on the same as-on date, and its 1M/3M/6M/1Y/3Y/5Y
// values match the AIF grid's to the rounding the deck prints.
const fs = require('fs');
const path = require('path');
const B = require('./blocklib');
const PPT = require('./pptx');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const HTML = flag('--html') || path.join(__dirname, 'index.html');
const SRC = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--html');
if (!SRC) { console.error('Usage: node merge_aif_performance.js "<pptx>" [--html <p>] [--apply]'); process.exit(2); }

// Deck strategy name -> MASTER AIF name. The asterisk marks a footnoted series in the deck.
const PIN = {
  'Motilal Oswal Founders Fund*':       'Motilal Oswal Founders Fund',
  'Alchemy Long Term Ventures Fund*':   'Alchemy Long Term Ventures Fund',
  'Vedartha India Opportunities Fund I':'Vedartha India Opportunities Fund – Series 1',
};
const BENCH_RE = /^(NIFTY 50 - TRI|Nifty Midcap 150 - TRI|Nifty Smallcap 250 - TRI|BSE 500 ?- ?TRI)$/i;
const BENCH_KEY = { 'nifty 50 - tri': 'NIFTY 50 - TRI', 'nifty midcap 150 - tri': 'Nifty Midcap 150 - TRI',
  'nifty smallcap 250 - tri': 'Nifty Smallcap 250 - TRI', 'bse 500 - tri': 'BSE 500 - TRI', 'bse 500- tri': 'BSE 500 - TRI' };

const clean = s => String(s == null ? '' : s).replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
const MISSING = /^(-|–|—|na|n\.?a\.?|)$/i;
function pct(v) {                                    // "4.9%" / "-" -> 0.049 / null
  const t = clean(v).replace(/%/g, '');
  if (MISSING.test(t)) return null;
  const n = parseFloat(t.replace(/,/g, ''));
  return isFinite(n) ? +(n / 100).toFixed(6) : null;
}
function num(v) {
  const t = clean(v);
  if (MISSING.test(t)) return null;
  const n = parseFloat(t.replace(/,/g, ''));
  return isFinite(n) ? n : null;
}
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function inception(v) {                              // "03-Dec-25" -> {label:"Dec, 2025", iso:"2025-12-01"}
  const m = clean(v).match(/^(\d{1,2})[-\/ ]([A-Za-z]{3})[A-Za-z]*[-\/ ](\d{2,4})$/);
  if (!m) return { label: null, iso: null };
  const mi = MON.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
  if (mi < 0) return { label: null, iso: null };
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;                            // the deck writes 2-digit years; all are 20xx
  return { label: MON[mi] + ', ' + y, iso: y + '-' + String(mi + 1).padStart(2, '0') + '-01' };
}

// ---------- locate the two grids ----------
const z = PPT.entries(SRC);
let aifRows = null, benchRows = null, aifSlide = 0, benchSlide = 0;
for (let n = 1; n <= 200; n++) {
  let xml; try { xml = z.get('ppt/slides/slide' + n + '.xml').toString('utf8'); } catch (e) { continue; }
  const title = clean(PPT.slideText(xml.replace(/<a:tbl>[\s\S]*?<\/a:tbl>/g, ''))[0] || '');
  for (const rows of PPT.slideTables(xml)) {
    const hdr = (rows[0] || []).map(clean);
    if (!/^Strategy$/i.test(hdr[0] || '')) continue;
    if (!aifRows && /AIF PERFORMANCE/i.test(title)) { aifRows = rows; aifSlide = n; }
    if (!benchRows && /PMS\s*[–-]\s*EQUITY/i.test(title) && hdr.some(h => /^2 ?Y$/i.test(h))) { benchRows = rows; benchSlide = n; }
  }
}
if (!aifRows) { console.error('*** no "AIF PERFORMANCE" grid found — deck layout changed'); process.exit(1); }
console.log('AIF grid: slide ' + aifSlide + '   benchmark grid: slide ' + (benchSlide || '(none — 2Y will be dropped)'));

// column index by header label, tolerating the deck's spacing ("1 M" vs "1M")
function cols(rows) {
  const hdr = rows[0].map(clean);
  const at = re => hdr.findIndex(h => re.test(h.replace(/\s+/g, '')));
  return { inception: at(/^InceptionDate$/i), aum: at(/^AUM/i), r1m: at(/^1M$/i), r3m: at(/^3M$/i),
    r6m: at(/^6M$/i), r1y: at(/^1Y$/i), r2y: at(/^2Y$/i), r3y: at(/^3Y$/i), r5y: at(/^5Y$/i), si: at(/^SI$/i) };
}
const AC = cols(aifRows);
for (const k of ['inception', 'aum', 'r1m', 'r1y', 'si']) {
  if (AC[k] < 0) { console.error('*** AIF grid column missing: ' + k); process.exit(1); }
}
// The market-allocation sub-header sits on row 2; its four cells are the last four columns.
const width = Math.max(...aifRows.map(r => r.length));
const MC = { large: width - 4, mid: width - 3, small: width - 2, other: width - 1 };
const sub = (aifRows[1] || []).map(clean);
if (!/^Large$/i.test(sub[MC.large] || '')) console.log('  (note: market-allocation sub-header not where expected — mcap may be off)');

// ---------- build ----------
const cur = B.read(HTML, 'window.PMS_PERFORMANCE = ').value;
const MASTER = B.read(HTML, 'window.MASTER = ').value;
const aifNames = new Set(MASTER.filter(r => r.product_class === 'AIF').map(r => r.name));

const aif = {}, report = [], unresolved = [];
let fail = false;
for (const r of aifRows.slice(1)) {
  const name = clean(r[0]);
  if (!name || /^Strategy$/i.test(name) || BENCH_RE.test(name) || /^Benchmark$/i.test(name)) continue;
  if (clean(r[AC.r1m]) === '' && clean(r[AC.aum]) === '') continue;      // section heading row
  const target = PIN[name] || name;
  if (!aifNames.has(target)) { unresolved.push(name + (PIN[name] ? '  (pinned to "' + target + '", which is not a MASTER AIF)' : '')); continue; }

  const inc = inception(r[AC.inception]);
  const rec = {};
  if (inc.label) { rec.inception = inc.label; rec.inception_full = inc.iso; }
  const a = num(r[AC.aum]); if (a != null) rec.aum = a;
  for (const k of ['r1m', 'r3m', 'r6m', 'r1y', 'r3y', 'r5y', 'si']) {
    if (AC[k] < 0) continue;
    const v = pct(r[AC[k]]); if (v != null) rec[k] = v;
  }
  const L = pct(r[MC.large]), Mi = pct(r[MC.mid]), S = pct(r[MC.small]), O = pct(r[MC.other]);
  if (L != null || Mi != null || S != null || O != null) {
    rec.mcap_large = L || 0; rec.mcap_mid = Mi || 0; rec.mcap_small = S || 0; rec.mcap_other = O || 0;
  }
  aif[target] = rec;
  const prev = cur.aif[target];
  report.push({ name: target, deck: name, prev: prev, rec: rec });
}

// ---------- benchmarks ----------
let benchmarks = cur.benchmarks;
if (benchRows) {
  const BC = cols(benchRows);
  const next = {};
  for (const r of benchRows) {
    const n0 = clean(r[0]);
    if (!BENCH_RE.test(n0)) continue;
    const key = BENCH_KEY[n0.toLowerCase().replace(/\s+/g, ' ')] || n0;
    if (next[key]) continue;
    const b = {};
    for (const k of ['r1m', 'r3m', 'r6m', 'r1y', 'r2y', 'r3y', 'r5y']) b[k] = BC[k] >= 0 ? pct(r[BC[k]]) : null;
    b.si = null;                                     // the deck prints "-" for benchmark SI
    next[key] = b;
  }
  if (Object.keys(next).length === Object.keys(cur.benchmarks).length) benchmarks = next;
  else { console.log('  benchmark count differs (' + Object.keys(next).length + ' found vs ' +
    Object.keys(cur.benchmarks).length + ' stored) — carrying the stored block forward'); }
}

// ---------- report ----------
const p2 = v => v == null ? '—' : (v * 100).toFixed(1) + '%';
console.log('\naif ' + Object.keys(cur.aif).length + ' -> ' + Object.keys(aif).length + '\n');
console.log('  ' + 'fund'.padEnd(44) + 'AUM (Cr)'.padStart(10) + '     1Y            3Y            SI');
report.forEach(x => {
  const o = x.prev || {}, n = x.rec;
  const cmp = (a, b) => (p2(a) + ' → ' + p2(b)).padEnd(14);
  console.log('  ' + x.name.slice(0, 42).padEnd(44) +
    String((o.aum == null ? '—' : o.aum) + ' → ' + (n.aum == null ? '—' : n.aum)).padStart(10) + '  ' +
    cmp(o.r1y, n.r1y) + cmp(o.r3y, n.r3y) + cmp(o.si, n.si) + (x.prev ? '' : '  (NEW)'));
});
if (unresolved.length) { console.log('\ndeck rows with no MASTER AIF record:'); unresolved.forEach(u => console.log('   ! ' + u)); }

console.log('\n---------------- gates ----------------');
console.log('GATE every key is a MASTER AIF record: ' + (Object.keys(aif).every(k => aifNames.has(k)) ? 'PASS' : '*** no'));
const bad = [], short = [];
for (const [k, v] of Object.entries(aif)) {
  for (const f of ['r1m', 'r3m', 'r6m', 'r1y', 'r3y', 'r5y', 'si'])
    if (v[f] != null && Math.abs(v[f]) > 1) bad.push(k + '.' + f + '=' + v[f]);
  if (v.aum != null && (v.aum <= 0 || v.aum > 1e6)) bad.push(k + '.aum=' + v.aum);
  if (v.mcap_large != null) {
    const s = v.mcap_large + v.mcap_mid + v.mcap_small + v.mcap_other;
    // Over 100% means the columns were misread or double-counted — that is a parsing bug, so fail.
    // Under 100% means the deck left a bucket blank. Report it; do not spread the residual into
    // "Cash & Others", which would put a fabricated number on a client-facing allocation.
    if (s > 1.02) bad.push(k + ' mcap sums ' + (s * 100).toFixed(1) + '% (>100%)');
    else if (s < 0.98) short.push(k + ' ' + (s * 100).toFixed(1) + '%');
  }
}
console.log('GATE returns in range and mcap never over 100%: ' + (bad.length ? '*** ' + bad.slice(0, 4).join(' | ') : 'PASS'));
if (bad.length) fail = true;
if (short.length) console.log('  note — the deck leaves a market-allocation bucket blank, so these do not reach 100%: ' + short.join(' | '));
const before = MASTER.filter(r => r.product_class === 'AIF' && cur.aif[r.name]).length;
const after = MASTER.filter(r => r.product_class === 'AIF' && aif[r.name]).length;
console.log('GATE MASTER AIF funds with performance: ' + before + ' -> ' + after);
if (after < before) fail = true;
console.log('GATE pms carried forward untouched: ' + Object.keys(cur.pms).length);
console.log('GATE benchmarks: ' + Object.keys(benchmarks).length + (benchmarks === cur.benchmarks ? ' (unchanged)' : ' (refreshed, incl. 2Y)'));

if (!APPLY) { console.log('\n[dry run] pass --apply to write'); process.exit(fail ? 1 : 0); }
if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }
const bytes = B.writeBlocks(HTML, [
  { prefix: 'window.PMS_PERFORMANCE = ', value: { pms: cur.pms, aif: aif, benchmarks: benchmarks } },
]);
console.log('\nWROTE ' + HTML + ' — ' + bytes + ' bytes');
