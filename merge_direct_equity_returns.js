// MONTHLY: join Listed Direct Equity returns onto the Direct Equity records in window.MASTER.
//
// Source is the RETURNS workbook ("Listed Direct equity_<date>.xlsx", ~8,400 rows, columns
// BRetSimplebse_<date>_3M/6M/1Y/2Y_CAGR/3Y_CAGR/5Y_CAGR) — NOT the sector/mcap workbook of a
// similar name in the Analytics folder, which has no returns in it at all.
//
// Source returns are in PERCENT units; MASTER stores decimals, so everything is /100.
// Join key is ISIN (MASTER carries `isin`), falling back to a normalised company name.
//
// Update SRC to this month's file, then:
//   node merge_direct_equity_returns.js            # dry run — prints join stats and gates
//   node merge_direct_equity_returns.js --apply    # writes index.html
//
// Requires SheetJS: npm install xlsx@0.18.5
// Back up index.html first. The script refuses to write if the top-10-by-mktcap "Large Cap"
// regression gate fails or the output does not end with </html>.
// Baseline 30-Jun-2026: 5,257 Direct Equity records, 4,259 matched by ISIN + 271 by name,
// 727 unmatched (thinly traded small caps absent from the returns file — they show no
// return pills, which is correct).
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const APPLY = process.argv.includes('--apply');
const DIR = "C:\\Users\\IshitaMagazine\\OneDrive - CENTRICITY FINANCIAL DISTRIBUTION PRIVATE LIMITED\\Documents\\Claude\\Projects\\Centricity Proposal Playbook";
const SRC = "C:\\Users\\IshitaMagazine\\OneDrive - CENTRICITY FINANCIAL DISTRIBUTION PRIVATE LIMITED\\Desktop\\Listed Direct equity_30th June 2026.xlsx";
const HTML = path.join(DIR, 'index.html');

// --- data hygiene: NBSP + doubled internal spaces are endemic in these source files ---
const clean = s => String(s == null ? '' : s)
  .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const normName = s => clean(s).toLowerCase()
  .replace(/[.,]/g, '').replace(/\s+(ltd|limited|inc|corp)\b/g, ' ltd').trim();

// --- 1. read the returns workbook ---
const wb = XLSX.readFile(SRC, { cellDates: false });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
console.log(`source rows: ${rows.length}`);
console.log(`source columns: ${Object.keys(rows[0]).slice(0, 12).join(' | ')}`);

// map the BRetSimplebse_<date>_<tenor> headers onto MASTER field names
const HEADERS = Object.keys(rows[0]);
const findCol = (suffix) => HEADERS.find(h =>
  new RegExp(`_${suffix}$`, 'i').test(h.replace(/\s+/g, '')));
const COLMAP = [
  ['r3m', findCol('3M')],
  ['r6m', findCol('6M')],
  ['r1y', findCol('1Y')],
  ['r2y', findCol('2Y_CAGR')],
  ['r3y', findCol('3Y_CAGR')],
  ['r5y', findCol('5Y_CAGR')],
];
const ISIN_COL = HEADERS.find(h => /isin/i.test(h));
const NAME_COL = HEADERS.find(h => /company\s*name/i.test(h));
console.log('column map:', COLMAP.map(([k, v]) => `${k}<-${v}`).join(', '));
console.log(`isin col: ${ISIN_COL} | name col: ${NAME_COL}`);
if (COLMAP.some(([, v]) => !v) || !ISIN_COL || !NAME_COL) {
  console.error('\n*** Column layout changed — aborting. Verify headers each month.');
  process.exit(1);
}

const num = v => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[, %]/g, ''));
  if (!isFinite(n)) return null;
  return n;
};

const byIsin = new Map(), byName = new Map();
let srcWithAny = 0, outOfRange = 0;
for (const r of rows) {
  const rec = {};
  let any = false;
  for (const [field, col] of COLMAP) {
    const n = num(r[col]);
    if (n == null) continue;
    // sanity gate: a stock return outside -100%..+2000% is a source error, not a datapoint
    if (n < -100 || n > 2000) { outOfRange++; continue; }
    rec[field] = +(n / 100).toFixed(6);
    any = true;
  }
  if (!any) continue;
  srcWithAny++;
  const isin = clean(r[ISIN_COL]).toUpperCase();
  if (isin) byIsin.set(isin, rec);
  const nn = normName(r[NAME_COL]);
  if (nn && !byName.has(nn)) byName.set(nn, rec);
}
console.log(`rows with >=1 return: ${srcWithAny}  (values rejected as out-of-range: ${outOfRange})`);
console.log(`unique ISINs: ${byIsin.size} | unique names: ${byName.size}`);

// --- 2. locate and parse the MASTER block ---
const html = fs.readFileSync(HTML, 'utf8');
const lines = html.split('\n');
const li = lines.findIndex(l => l.startsWith('<script>window.MASTER = '));
if (li < 0) { console.error('*** could not find the MASTER line'); process.exit(1); }
const line = lines[li];
const a = line.indexOf('['), b = line.lastIndexOf(']');
const master = JSON.parse(line.slice(a, b + 1));
console.log(`\nMASTER line ${li + 1}: ${master.length} records`);

// --- 3. join ---
let viaIsin = 0, viaName = 0, unmatched = 0, de = 0;
const misses = [];
for (const rec of master) {
  if (rec.product_class !== 'Direct Equity') continue;
  de++;
  let hit = null;
  const isin = clean(rec.isin).toUpperCase();
  if (isin && byIsin.has(isin)) { hit = byIsin.get(isin); viaIsin++; }
  else {
    const nn = normName(rec.name);
    if (byName.has(nn)) { hit = byName.get(nn); viaName++; }
  }
  if (!hit) { unmatched++; if (misses.length < 12) misses.push(rec.name); continue; }
  for (const [field] of COLMAP) {
    if (hit[field] == null) delete rec[field];
    else rec[field] = hit[field];
  }
}
console.log(`Direct Equity records: ${de}`);
console.log(`  matched by ISIN : ${viaIsin}`);
console.log(`  matched by name : ${viaName}`);
console.log(`  unmatched       : ${unmatched}`);
if (misses.length) console.log(`  sample unmatched: ${misses.join(' | ')}`);

// --- 4. regression gates ---
const deRecs = master.filter(r => r.product_class === 'Direct Equity');
const top10 = deRecs.filter(r => r.mktcap != null).sort((x, y) => y.mktcap - x.mktcap).slice(0, 10);
const mcapOk = top10.every(r => /large/i.test(String(r.sebi_mcap || '')));
console.log(`\nGATE top-10 by mktcap all "Large Cap": ${mcapOk ? 'PASS' : '*** FAIL ***'}`);
if (!mcapOk) console.log('  ' + top10.map(r => `${r.name}=${r.sebi_mcap}`).join('\n  '));

const withRet = deRecs.filter(r => r.r1y != null || r.r3y != null).length;
console.log(`GATE Direct Equity with returns: ${withRet}`);
const sample = deRecs.find(r => r.name.startsWith('20 Microns'));
console.log('SAMPLE 20 Microns Ltd.:', JSON.stringify(sample));
const allR = deRecs.flatMap(r => COLMAP.map(([f]) => r[f]).filter(v => v != null));
console.log(`GATE return range: min=${Math.min(...allR).toFixed(4)} max=${Math.max(...allR).toFixed(4)} (decimals)`);

// non-Direct-Equity records must be untouched
const mfSample = master.find(r => r.product_class === 'Mutual Fund');
console.log('CHECK an MF record still intact:', mfSample.name, JSON.stringify({ r1y: mfSample.r1y, r3y: mfSample.r3y }));

// --- 5. write ---
if (!APPLY) { console.log('\n[dry run] pass --apply to write index.html'); process.exit(0); }
if (!mcapOk) { console.error('\n*** regression gate failed — refusing to write'); process.exit(1); }
lines[li] = line.slice(0, a) + JSON.stringify(master) + line.slice(b + 1);
const out = lines.join('\n');
if (!out.trimEnd().endsWith('</html>')) { console.error('*** output does not end with </html> — refusing'); process.exit(1); }
fs.writeFileSync(HTML, out, 'utf8');
console.log(`\nWROTE index.html — ${out.length} bytes (was ${html.length})`);
