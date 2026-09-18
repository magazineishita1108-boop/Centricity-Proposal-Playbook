// MONTHLY: refresh the Portfolio Matrix tab (window.RISK_MATRIX) from the pre-computed
// "Fund Risk Ratios & 3Y Rolling - All Funds (as on <date>).xlsx" workbook.
//
// This is the SECOND route into RISK_MATRIX. The first is build_risk_matrix.py, which derives
// everything from the raw NAV Data workbook. Use the Python route when you can — it is the
// authority and it also emits `c` (3Y CAGR) and RISK_MATRIX_BENCH_SD. This tool exists because
// the desk machine has no Python installed, and because the risk-ratios workbook now ships the
// full 1,088-fund universe rather than the sample it used to be.
//
// What this tool CAN and CANNOT set:
//   sets  -> be sd al so sh co ir dc rr   (every field the tab and the PPT slide actually render)
//   keeps -> bm                            (benchmark is a per-category constant; carried forward)
//   drops -> c                             (3Y CAGR; absent from this workbook and read by nothing)
//
// `c` is deliberately NOT carried forward. It is unreferenced by any renderer (verified: the tab's
// COLS and the export's MCOLS are the same nine keys), so keeping last month's CAGR under this
// month's as-on date would be stale data wearing a fresh label for no benefit at all.
//
//   node merge_risk_matrix.js "<Fund Risk Ratios & 3Y Rolling ....xlsx>" --as-on "31 Aug 2026"
//   ... add --apply to write. Dry run prints the join tiers and the gates; always read them.
//
// Requires: npm install xlsx@0.18.5
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const blocklib = require('./blocklib.js');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const ASON = flag('--as-on');
const HTML = flag('--html') || path.join(__dirname, 'index.html');
const SRC = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--as-on' && argv[argv.indexOf(a) - 1] !== '--html');
if (!SRC || !ASON) {
  console.error('Usage: node merge_risk_matrix.js "<Fund Risk Ratios ....xlsx>" --as-on "31 Aug 2026" [--html <p>] [--apply]');
  process.exit(2);
}
if (!fs.existsSync(SRC)) { console.error('*** source not found: ' + SRC); process.exit(2); }

// ---------- read the workbook ----------
const wb = XLSX.readFile(SRC);
const SHEET = wb.SheetNames.find(s => /risk\s*ratios/i.test(s));
if (!SHEET) { console.error('*** no "Risk Ratios" sheet; found: ' + wb.SheetNames.join(' | ')); process.exit(1); }

// Header sits below a title + methodology note; find it rather than pinning a row index.
const raw = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, defval: null });
const hRow = raw.findIndex(r => r && String(r[0] || '').trim().toLowerCase() === 'fund name');
if (hRow < 0) { console.error('*** no "Fund Name" header row'); process.exit(1); }
const hdr = raw[hRow].map(h => String(h == null ? '' : h).trim());
const col = re => hdr.findIndex(h => re.test(h));

// Workbook column -> RISK_MATRIX key. CMV / Wt % / Rationale are portfolio-specific and ship blank.
const MAP = [
  ['be', /^beta$/i], ['sd', /^sd\b|std\s*dev/i], ['al', /^alpha$/i],
  ['so', /^sortino$/i], ['sh', /^sharpe$/i], ['co', /^corr/i],
  ['ir', /^info/i], ['dc', /^down\s*cap/i], ['rr', /^3y\s*rolling/i],
];
const idx = {};
for (const [k, re] of MAP) {
  const i = col(re);
  if (i < 0) { console.error(`*** column for "${k}" not found in: ${hdr.join(' | ')}`); process.exit(1); }
  idx[k] = i;
}
console.log(`sheet     : ${SHEET}`);
console.log(`columns   : ${MAP.map(([k]) => k + '=' + hdr[idx[k]]).join('  ')}`);

// A dash means "fewer than 250 NAV days in the window" — missing, not zero.
const num = v => {
  if (v == null || v === '' || v === '-' || v === '—') return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
};

// Accord's methodology paragraph sits in the name column below the data; skip prose.
const rows = raw.slice(hRow + 1)
  .filter(r => r && r[0] != null && String(r[0]).trim() !== '' && String(r[0]).trim().length <= 120);
console.log(`data rows : ${rows.length}`);

// Benchmark per fund, where the Data Flags tab names it.
const flagSheet = wb.SheetNames.find(s => /data\s*flags/i.test(s));
const bmFromFlags = new Map(), flagOf = new Map();
if (flagSheet) {
  const fr = XLSX.utils.sheet_to_json(wb.Sheets[flagSheet], { header: 1, defval: null });
  const fh = fr.findIndex(r => r && String(r[0] || '').trim().toLowerCase() === 'fund name');
  if (fh >= 0) {
    const fhdr = fr[fh].map(h => String(h == null ? '' : h).trim());
    const ci = { bm: fhdr.findIndex(h => /benchmark/i.test(h)), fl: fhdr.findIndex(h => /flag/i.test(h)) };
    for (const r of fr.slice(fh + 1)) {
      if (!r || !r[0]) continue;
      const n = String(r[0]).trim();
      if (ci.bm >= 0 && r[ci.bm]) bmFromFlags.set(n, String(r[ci.bm]).trim());
      if (ci.fl >= 0 && r[ci.fl]) flagOf.set(n, String(r[ci.fl]).trim());
    }
  }
}
console.log(`data flags: ${flagOf.size} fund(s) flagged`);

// ---------- join to MASTER ----------
const MASTER = blocklib.read(HTML, 'window.MASTER = ').value;
const OLD = blocklib.read(HTML, 'window.RISK_MATRIX = ').value;
const liveName = new Set(MASTER.map(f => f.name));
const byPrev = new Map();
for (const f of MASTER) if (f.prev_name && !byPrev.has(f.prev_name)) byPrev.set(f.prev_name, f.name);

// Plan/option suffix whitelist ONLY — see CLAUDE.md. "(Inbound)", "(OneDigital)", "(Lock in)" and
// friends distinguish genuinely different instruments and must survive.
const baseName = s => String(s || '')
  .replace(/ /g, ' ')
  .replace(/\((?:G|IDCW|D|Growth|Dividend)(?:[^()]*)\)/gi, '')
  .replace(/-\s*(?:Reg|Dir|Direct)(?:ular)?\s*Plan\b/gi, '')
  .replace(/-\s*(?:Reg|Dir)\b/gi, '')
  .replace(/\bDirect\s*Plan\b/gi, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();

// Base name -> live MASTER names, preferring a Growth/Regular row when several options exist.
const byBase = new Map();
for (const f of MASTER) {
  const b = baseName(f.name);
  if (!b) continue;
  if (!byBase.has(b)) byBase.set(b, []);
  byBase.get(b).push(f.name);
  const p = f.prev_name && baseName(f.prev_name);
  if (p && p !== b) { if (!byBase.has(p)) byBase.set(p, []); byBase.get(p).push(f.name); }
}
const preferGrowthReg = names => {
  const uniq = [...new Set(names)];
  if (uniq.length === 1) return uniq;
  const g = uniq.filter(n => /\(G\)/i.test(n));
  const gr = g.filter(n => /-Reg\(G\)|^(?!.*Direct)/i.test(n));
  return (gr.length ? gr : (g.length ? g : uniq));
};

const tiers = { exact: 0, prev: 0, base: 0 };
const NEW = {};
const unmatched = [], ambiguous = [], collisions = [];

for (const r of rows) {
  const nm = String(r[0]).trim();
  let target = null;
  if (liveName.has(nm)) { target = nm; tiers.exact++; }
  else if (byPrev.has(nm)) { target = byPrev.get(nm); tiers.prev++; }
  else {
    const cands = preferGrowthReg(byBase.get(baseName(nm)) || []);
    if (cands.length === 1) { target = cands[0]; tiers.base++; }
    else if (cands.length > 1) { ambiguous.push(nm + '  -> ' + cands.slice(0, 3).join(' | ')); continue; }
    else { unmatched.push(nm); continue; }
  }

  const rec = {};
  for (const [k] of MAP) { const v = num(r[idx[k]]); if (v != null) rec[k] = v; }
  // Benchmark: the flags tab names it for flagged funds; otherwise it is a per-category constant
  // that has not changed, so the existing block is a safe carry-forward.
  const bm = bmFromFlags.get(nm) || (OLD[target] && OLD[target].bm) || null;
  if (bm) rec.bm = bm;

  if (NEW[target]) { collisions.push(nm + ' -> ' + target); continue; }
  NEW[target] = rec;
}

const withMetrics = Object.values(NEW).filter(v => v.be != null).length;
const withRolling = Object.values(NEW).filter(v => v.rr != null).length;
const withBm = Object.values(NEW).filter(v => v.bm).length;

console.log(`\njoin tiers: exact=${tiers.exact}  prev_name=${tiers.prev}  plan-base=${tiers.base}`);
console.log(`unmatched : ${unmatched.length}${unmatched.length ? '  ' + unmatched.slice(0, 8).join(' | ') : ''}`);
console.log(`ambiguous : ${ambiguous.length}  (reported, never guessed)`);
ambiguous.slice(0, 8).forEach(a => console.log('   ? ' + a));
console.log(`collisions: ${collisions.length}${collisions.length ? '  ' + collisions.slice(0, 5).join(' | ') : ''}`);

const oldVals = Object.values(OLD);
console.log(`\nRISK_MATRIX : ${Object.keys(OLD).length} -> ${Object.keys(NEW).length}`);
console.log(`  with metrics (be): ${oldVals.filter(v => v.be != null).length} -> ${withMetrics}`);
console.log(`  with rolling (rr): ${oldVals.filter(v => v.rr != null).length} -> ${withRolling}`);
console.log(`  with benchmark   : ${oldVals.filter(v => v.bm).length} -> ${withBm}`);
console.log(`  dropped 'c' (3Y CAGR, unread): ${oldVals.filter(v => v.c != null).length} -> 0`);

// ---------- gates ----------
const notInMaster = Object.keys(NEW).filter(k => !liveName.has(k));
const gates = [
  ['every key exists in MASTER', notInMaster.length === 0, notInMaster.slice(0, 5).join(' | ')],
  ['no ambiguous joins', ambiguous.length === 0, ambiguous.length + ' ambiguous'],
  ['no join collisions', collisions.length === 0, collisions.length + ' collisions'],
  ['fund count did not shrink', Object.keys(NEW).length >= Object.keys(OLD).length, ''],
  ['funds with metrics did not shrink', withMetrics >= oldVals.filter(v => v.be != null).length, ''],
  ['benchmark coverage complete', withBm === Object.keys(NEW).length, (Object.keys(NEW).length - withBm) + ' missing bm'],
];
console.log('');
let pass = true;
for (const [label, ok, detail] of gates) {
  console.log(`GATE ${label}: ${ok ? 'PASS' : 'FAIL'}${ok || !detail ? '' : '  ' + detail}`);
  if (!ok) pass = false;
}
if (!pass) { console.error('\n*** gates failed — not writing'); process.exit(1); }

if (!APPLY) { console.log('\n[dry run] pass --apply to write ' + path.basename(HTML)); process.exit(0); }

const len = blocklib.writeBlocks(HTML, [{ prefix: 'window.RISK_MATRIX = ', value: NEW }]);

// `riskMatrix` is NOT a key of the pretty-printed `window.DATA_DATES = {…}` object near the top of
// the page — it is assigned on its own line just after the matrix block, which is why this is a
// targeted line rewrite rather than a blocklib splice. (blocklib parses JSON; that object is
// hand-formatted and would not round-trip.)
let html = fs.readFileSync(HTML, 'utf8');
const RE = /(window\.DATA_DATES\.riskMatrix\s*=\s*)(['"])(.*?)\2\s*;/;
const m = html.match(RE);
if (!m) { console.error('*** window.DATA_DATES.riskMatrix assignment not found — matrix written, date NOT stamped'); process.exit(1); }
const was = m[3];
html = html.replace(RE, `$1'${ASON.replace(/'/g, "\\'")}';`);
if (!html.trimEnd().endsWith('</html>')) { console.error('*** refusing to write: output does not end with </html>'); process.exit(1); }
fs.writeFileSync(HTML, html, 'utf8');
console.log(`\nwrote ${path.basename(HTML)} (${html.length} bytes)`);
console.log(`DATA_DATES.riskMatrix: "${was}" -> "${ASON}"`);
