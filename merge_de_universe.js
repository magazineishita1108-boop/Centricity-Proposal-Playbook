// MONTHLY: refresh the Direct Equity universe (sector / industry / market cap / SEBI mcap bucket)
// from "Listed Direct Equity_<Month>.xlsx" — the ~5,300-row Analytics file, NOT the returns file.
//
// sebi_mcap MUST be joined BY COMPANY NAME. Joining by row position shipped for ~8 months and
// mislabelled large caps as small caps in client-facing analytics. The regression gate below
// (top 10 by market cap must all read "Large Cap") exists to catch a repeat.
//
//   node merge_de_universe.js "<Listed Direct Equity_<Month>.xlsx>" [--apply] [--html <p>]
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const argv = process.argv.slice(2);
let APPLY = false, SRC = null, HTML = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--apply') { APPLY = true; continue; }
  if (a === '--html') { HTML = argv[++i] || null; continue; }
  if (a.startsWith('--')) { console.error('unknown flag: ' + a); process.exit(2); }
  if (SRC === null) SRC = a;
}
HTML = HTML || path.join(__dirname, 'index.html');
if (!SRC || !fs.existsSync(SRC)) { console.error('Usage: node merge_de_universe.js "<Listed Direct Equity_<Month>.xlsx>" [--apply] [--html <p>]'); process.exit(2); }

const NBSP = String.fromCharCode(160);
const clean = s => String(s == null ? '' : s).split(NBSP).join(' ').replace(/\s+/g, ' ').trim();
const key = s => clean(s).toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();

const rows = XLSX.utils.sheet_to_json(XLSX.readFile(SRC).Sheets[XLSX.readFile(SRC).SheetNames[0]], { defval: null });
const H = Object.keys(rows[0]);
const find = re => H.find(h => re.test(clean(h)));
const cName = find(/company\s*name/i), cSec = find(/sector/i), cInd = find(/industry/i),
      cMcap = find(/market\s*cap/i), cBucket = find(/mcap\s*alloc/i);
console.log(`source rows: ${rows.length}`);
console.log(`columns: name=${cName} | sector=${cSec} | industry=${cInd} | mktcap=${cMcap} | bucket=${cBucket}`);
if (!cName || !cSec || !cMcap || !cBucket) { console.error('*** column layout changed — aborting'); process.exit(1); }

const byName = new Map();
let dupSrc = 0;
for (const r of rows) {
  const n = clean(r[cName]); if (!n) continue;
  const k = key(n);
  if (byName.has(k)) { dupSrc++; continue; }
  const mc = typeof r[cMcap] === 'number' ? r[cMcap] : parseFloat(String(r[cMcap] || '').replace(/,/g, ''));
  byName.set(k, {
    name: n,
    sector: clean(r[cSec]) || null,
    industry: cInd ? (clean(r[cInd]) || null) : null,
    mktcap: isFinite(mc) ? mc : null,
    bucket: clean(r[cBucket]) || null,
  });
}
console.log(`unique companies: ${byName.size}${dupSrc ? `  (${dupSrc} duplicate source row(s) ignored)` : ''}`);

const html = fs.readFileSync(HTML, 'utf8');
const i = html.indexOf('window.MASTER = ');
if (i < 0) { console.error('*** MASTER not found'); process.exit(1); }
const s = i + 'window.MASTER = '.length;
const end = matchEnd(html, s);
const master = JSON.parse(html.slice(s, end + 1));
const de = master.filter(r => r.product_class === 'Direct Equity');
console.log(`\nMASTER ${master.length}; Direct Equity ${de.length}`);

let upSector = 0, upMcap = 0, upBucket = 0, matched = 0;
const missing = [];
for (const rec of de) {
  const hit = byName.get(key(rec.name));
  if (!hit) { missing.push(rec.name); continue; }
  matched++;
  if (hit.sector && hit.sector !== rec.sub_category) { rec.sub_category = hit.sector; upSector++; }
  if (hit.mktcap != null && hit.mktcap !== rec.mktcap) { rec.mktcap = hit.mktcap; upMcap++; }
  if (hit.bucket && hit.bucket !== rec.sebi_mcap) { rec.sebi_mcap = hit.bucket; upBucket++; }
}
console.log(`  matched by name : ${matched}`);
console.log(`  sector changed  : ${upSector}`);
console.log(`  mktcap changed  : ${upMcap}`);
console.log(`  mcap bucket chg : ${upBucket}`);
console.log(`  in MASTER but not in this month's file: ${missing.length} (left as-is, not deleted)`);
if (missing.length) console.log(`    sample: ${missing.slice(0, 6).join(' | ')}`);

// new listings
const haveKeys = new Set(de.map(r => key(r.name)));
const fresh = [...byName.values()].filter(v => !haveKeys.has(key(v.name)));
console.log(`  new listings in the file but not in MASTER: ${fresh.length}`);
if (fresh.length) console.log(`    sample: ${fresh.slice(0, 6).map(f => f.name).join(' | ')}`);
const lastDe = master.map(r => r.product_class).lastIndexOf('Direct Equity');
const built = fresh.map(v => ({
  name: v.name, asset_class: 'Equity', product_class: 'Direct Equity',
  sub_category: v.sector || 'Others', sebi_mcap: v.bucket || null, mktcap: v.mktcap, isin: null,
}));
const next = master.slice(0, lastDe + 1).concat(built, master.slice(lastDe + 1));

// ---- gates ----
let fail = false;
const deNext = next.filter(r => r.product_class === 'Direct Equity');
const top10 = deNext.filter(r => r.mktcap != null).sort((a, b) => b.mktcap - a.mktcap).slice(0, 10);
const ok = top10.every(r => /large/i.test(String(r.sebi_mcap || '')));
console.log(`\nGATE top-10 by market cap all "Large Cap": ${ok ? 'PASS' : '*** FAIL'}`);
top10.slice(0, 5).forEach(r => console.log(`    ${String(r.sebi_mcap).padEnd(10)} ${Math.round(r.mktcap).toLocaleString('en-IN').padStart(12)}  ${r.name}`));
if (!ok) fail = true;
const names = next.map(r => r.name);
const dupes = [...new Set(names.filter((n, k2) => names.indexOf(n) !== k2))];
console.log(`GATE duplicate names: ${dupes.length ? '*** FAIL ' + dupes.slice(0, 5).join(' | ') : 'PASS (0)'}`);
if (dupes.length) fail = true;
const buckets = {}; deNext.forEach(r => buckets[r.sebi_mcap] = (buckets[r.sebi_mcap] || 0) + 1);
console.log(`GATE mcap buckets: ${JSON.stringify(buckets)}`);
console.log(`GATE Direct Equity ${de.length} -> ${deNext.length};  MASTER ${master.length} -> ${next.length}`);

if (!APPLY) { console.log('\n[dry run] pass --apply to write index.html'); process.exit(0); }
if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }
const out = html.slice(0, s) + JSON.stringify(next) + html.slice(end + 1);
if (!out.trimEnd().endsWith('</html>')) { console.error('*** does not end with </html>'); process.exit(1); }
fs.writeFileSync(HTML, out, 'utf8');
console.log(`\nWROTE ${HTML} — ${out.length} bytes (was ${html.length})`);

function matchEnd(str, start) {
  const open = str[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let k = start; k < str.length; k++) {
    const ch = str[k];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return k; }
  }
  throw new Error('unbalanced');
}
