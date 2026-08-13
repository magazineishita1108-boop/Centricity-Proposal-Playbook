// Monthly bake: run index.html's OWN parsers over this month's workbooks in a Node vm sandbox,
// then write the resulting globals back into the embedded blocks. Reusing the page's parsers
// means the baked data is identical to what the Section 7 uploader would produce.
//
// The five sibling override files are deliberately NOT executed: they mutate MASTER at runtime
// on every page load, so the baseline block must stay pre-sibling or their edits would be
// baked in and then re-applied on top.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const DIR = flag('--dir');            // month folder
const ASON = flag('--as-on');         // e.g. "31st July 2026"
const ASON_AN = flag('--as-on-analytics') || ASON;
const HTML = flag('--html') || path.join(__dirname, 'index.html');
if (!DIR || !ASON) { console.error('Usage: node bake_month.js --dir "<month folder>" --as-on "31st July 2026" [--as-on-analytics "..."] [--html <p>] [--apply]'); process.exit(2); }

const P = {
  eq:   path.join(DIR, 'Analytics', fs.readdirSync(path.join(DIR, 'Analytics')).find(f => /^Equity Analytics_/i.test(f)) || ''),
  hy:   path.join(DIR, 'Analytics', fs.readdirSync(path.join(DIR, 'Analytics')).find(f => /^Hybrid Analytics_/i.test(f)) || ''),
  db:   path.join(DIR, 'Analytics', fs.readdirSync(path.join(DIR, 'Analytics')).find(f => /^Debt Analytics_/i.test(f)) || ''),
  reg:  path.join(DIR, fs.readdirSync(DIR).find(f => /^Daily MF ?monitor_\d/i.test(f)) || ''),
  dir:  path.join(DIR, fs.readdirSync(DIR).find(f => /^Daily MF Monitor_Direct/i.test(f)) || ''),
};
for (const [k, v] of Object.entries(P)) {
  if (!v || !fs.existsSync(v)) { console.error(`*** missing source for "${k}": ${v}`); process.exit(2); }
  console.log(`${k.padEnd(5)} <- ${path.basename(v)}`);
}
console.log('');

// ---------- sandbox: run the baseline data + helper + parser blocks ----------
const html = fs.readFileSync(HTML, 'utf8');
const blocks = [];
{
  const re = /<script\b([^>]*)>/gi; let m;
  while ((m = re.exec(html)) !== null) {
    const src = /\bsrc\s*=\s*"([^"]+)"/i.exec(m[1]);
    const s = m.index + m[0].length;
    const c = html.indexOf('</script>', s);
    const e = c === -1 ? html.length : c;
    blocks.push({ src: src ? src[1] : null, body: src ? '' : html.slice(s, e) });
    re.lastIndex = e;
  }
}
const sandbox = {
  console, JSON, Math, Object, Array, String, Number, Boolean, Date, RegExp, Map, Set, Promise,
  parseFloat, parseInt, isNaN, isFinite, XLSX, Error, TypeError, Symbol, ArrayBuffer, Uint8Array,
  setTimeout, clearTimeout,
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }), addEventListener() {},
    head: { appendChild() {} }, body: { appendChild() {} } },
};
sandbox.window = {}; sandbox.globalThis = sandbox; sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
let ran = 0, skipped = 0;
for (const b of blocks) {
  if (b.src) { skipped++; continue; }                                  // CDN + the five siblings
  if (/ReactDOM\.createRoot/.test(b.body)) { skipped++; continue; }
  try { vm.runInContext(b.body, sandbox, { timeout: 120000 }); ran++; }
  catch (e) { if (!/React is not defined/.test(e.message)) console.log(`  (block error, ignored) ${e.message.slice(0, 90)}`); skipped++; }
}
const W = sandbox.window;
console.log(`sandbox: ran ${ran} inline blocks, skipped ${skipped} (siblings + UI)\n`);
if (!W.REFRESH) { console.error('*** window.REFRESH not available'); process.exit(1); }

const fileOf = p => ({ name: path.basename(p), arrayBuffer: async () => fs.readFileSync(p) });
const snap = () => ({
  MASTER: W.MASTER.length, EQ: Object.keys(W.EQUITY_ANALYTICS).length,
  HY: Object.keys(W.HYBRID_ANALYTICS).length, DB: Object.keys(W.DEBT_ANALYTICS).length,
  DP: Object.keys(W.DIRECT_PERF || {}).length, BM: Object.keys(W.MF_BENCHMARK_PERF || {}).length,
});
const before = snap();
console.log('BEFORE:', JSON.stringify(before));

(async () => {
  // ---------- 1. analytics ----------
  const eqBefore = new Set(Object.keys(W.EQUITY_ANALYTICS));
  for (const [kind, p] of [['equity', P.eq], ['hybrid', P.hy], ['debt', P.db]]) {
    const r = await W.REFRESH.parseAnalytics(fileOf(p), kind);
    console.log(`  parseAnalytics(${kind}): ${r.ok ? r.message : 'FAILED ' + r.error}`);
    if (!r.ok) process.exit(1);
  }
  // parseAnalytics MERGES, so a scheme present in June but absent from the July workbook keeps
  // its June holdings under a July label. Surface those explicitly, split by whether the MF
  // analytics workbook is even supposed to cover them (PMS/AIF come from a separate file).
  const julySchemes = schemeNames(P.eq);
  const pcByName = new Map(W.MASTER.map(r => [r.name, r.product_class]));
  const notInJuly = [...eqBefore].filter(k => !julySchemes.has(k));
  const mfStale = notInJuly.filter(k => ['Mutual Fund', 'Index Fund', 'ETF'].includes(pcByName.get(k)));
  const otherStale = notInJuly.filter(k => !mfStale.includes(k));
  console.log(`  equity analytics: ${before.EQ} -> ${Object.keys(W.EQUITY_ANALYTICS).length}  (July file covered ${julySchemes.size} schemes)`);
  console.log(`    not in the July workbook: ${notInJuly.length}  =  ${mfStale.length} MF/Index/ETF (STALE - still June holdings) + ${otherStale.length} PMS/AIF/other (expected; different source file)`);
  if (mfStale.length) mfStale.slice(0, 12).forEach(n => console.log(`      ! ${n}`));

  // ---------- 2. MF Monitor — Regular ----------
  const mBefore = new Set(W.MASTER.map(r => r.name));
  const r1 = await W.REFRESH.parseMfMonitor(fileOf(P.reg), { asOn: ASON });
  console.log(`  parseMfMonitor(Regular): ${r1.ok ? r1.message : 'FAILED ' + r1.error}`);
  if (!r1.ok) process.exit(1);
  const added = W.MASTER.filter(r => !mBefore.has(r.name)).map(r => r.name);
  if (added.length) { console.log(`  NEW funds added to MASTER (${added.length}):`); added.forEach(n => console.log(`      + ${n}`)); }

  // ---------- 3. MF Monitor — Direct -> DIRECT_PERF ----------
  const dpBefore = new Set(Object.keys(W.DIRECT_PERF || {}));
  const rd = buildDirectPerf(P.dir, W);
  const dpAfter = new Set(Object.keys(W.DIRECT_PERF));
  const lostDp = [...dpBefore].filter(k => !dpAfter.has(k));
  console.log(`  DIRECT_PERF: ${before.DP} -> ${Object.keys(W.DIRECT_PERF).length}  (matched ${rd.matched}, unmatched ${rd.unmatched})`);
  if (rd.sampleUnmatched.length) console.log(`    sample unmatched: ${rd.sampleUnmatched.slice(0, 6).join(' | ')}`);
  if (lostDp.length) {
    console.log(`    lose their Direct overlay (${lostDp.length}) -> these fall back to Regular values:`);
    lostDp.slice(0, 12).forEach(n => console.log(`      - ${n}`));
    if (lostDp.length > 12) console.log(`      ... +${lostDp.length - 12} more`);
  }

  // ---------- 4. dates ----------
  W.DATA_DATES.performance = ASON;
  W.DATA_DATES.analytics = ASON_AN;

  const after = snap();
  console.log('AFTER :', JSON.stringify(after));

  // ---------- gates ----------
  let fail = false;
  const names = W.MASTER.map(r => r.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  console.log(`\nGATE duplicate names: ${dupes.length ? '*** FAIL ' + [...new Set(dupes)].slice(0, 5).join(' | ') : 'PASS (0)'}`);
  if (dupes.length) fail = true;
  for (const [k, lo] of [['MASTER', before.MASTER], ['EQ', before.EQ], ['HY', before.HY], ['DB', before.DB], ['DP', 1000]]) {
    if (after[k] < lo) { console.log(`GATE ${k} did not shrink: *** FAIL (${lo} -> ${after[k]})`); fail = true; }
  }
  if (!fail) console.log('GATE no block shrank: PASS');
  const withR1y = W.MASTER.filter(r => r.r1y != null).length;
  console.log(`GATE MASTER records carrying r1y: ${withR1y}`);
  console.log(`GATE DATA_DATES: ${JSON.stringify(W.DATA_DATES)}`);

  if (!APPLY) { console.log('\n[dry run] pass --apply to write index.html'); return; }
  if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }

  // ---------- write back ----------
  let out = html;
  const writes = [
    ['window.DIRECT_PERF = ', W.DIRECT_PERF],
    ['window.MASTER = ', W.MASTER],
    ['window.EQUITY_ANALYTICS = ', W.EQUITY_ANALYTICS],
    ['window.HYBRID_ANALYTICS = ', W.HYBRID_ANALYTICS],
    ['window.DEBT_ANALYTICS = ', W.DEBT_ANALYTICS],
    ['window.MF_BENCHMARK_PERF = ', W.MF_BENCHMARK_PERF],
  ];
  for (const [prefix, value] of writes) {
    const i = out.indexOf(prefix);
    if (i < 0) { console.error(`*** could not find "${prefix}"`); process.exit(1); }
    const s = i + prefix.length;
    const open = out[s];
    if (open !== '{' && open !== '[') { console.error(`*** "${prefix}" is not followed by a literal (found ${JSON.stringify(out.slice(s, s + 20))})`); process.exit(1); }
    const end = matchEnd(out, s);
    out = out.slice(0, s) + JSON.stringify(value) + out.slice(end + 1);
    console.log(`  wrote ${prefix.trim()} (${JSON.stringify(value).length} bytes)`);
  }
  out = out.replace(/(performance:\s*)"[^"]*"/, `$1"${ASON}"`)
           .replace(/(analytics:\s*)"[^"]*"/, `$1"${ASON_AN}"`);
  if (!out.trimEnd().endsWith('</html>')) { console.error('*** output does not end with </html>'); process.exit(1); }
  fs.writeFileSync(HTML, out, 'utf8');
  console.log(`\nWROTE ${HTML} — ${out.length} bytes (was ${html.length})`);
})();

// Distinct "Scheme Name" values in an analytics workbook (column A under the header row).
function schemeNames(src) {
  const wb = XLSX.readFile(src, { cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rg = XLSX.utils.decode_range(ws['!ref']);
  const cell = (r, c) => { const x = ws[XLSX.utils.encode_cell({ r, c })]; return x ? x.v : null; };
  let hdr = -1, col = 0;
  outer: for (let r = 0; r <= Math.min(25, rg.e.r); r++) {
    for (let c = 0; c <= Math.min(3, rg.e.c); c++) {
      const v = cell(r, c);
      if (v && String(v).trim().toLowerCase() === 'scheme name') { hdr = r; col = c; break outer; }
    }
  }
  const out = new Set();
  if (hdr < 0) return out;
  for (let r = hdr + 1; r <= rg.e.r; r++) { const v = cell(r, col); if (v) out.add(String(v).trim()); }
  return out;
}

// Scan forward from an opening brace/bracket to its match, respecting strings and escapes.
function matchEnd(s, start) {
  const open = s[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return i; }
  }
  throw new Error('unbalanced literal');
}

// Build DIRECT_PERF keyed by the REGULAR fund name, from the Direct monitor workbook.
// Direct names read "X Fund(G)-Direct Plan"; MASTER reads "X Fund-Reg(G)". Both reduce to the
// same plan-base, which is how the two plans are paired.
function buildDirectPerf(src, W) {
  const wb = XLSX.readFile(src, { cellDates: true });
  const NUM = [['mtd', 'MTD'], ['r1m', '1 Month'], ['r3m', '3 Months'], ['r6m', '6 Months'],
    ['r1y', '1 Year'], ['r2y', '2 Years'], ['r3y', '3 Years'], ['r5y', '5 Years'],
    ['r10y', '10 Years'], ['si', 'SINCE INCEPTION']];
  const PLAIN = [['aum', 'AUM (Cr.)'], ['expense', 'Expense Ratio'],
    ['mcap_large', 'Large Cap'], ['mcap_mid', 'Mid Cap'], ['mcap_small', 'Small Cap'],
    ['ytm', 'YTM'], ['avg_maturity', 'Average Maturity'], ['mod_duration', 'Modified Duration']];
  // "X Fund(G)-Direct Plan", "X Fund(G)-Direct Plan(Adjusted)" and "X Fund-Reg(G)" must all
  // reduce to the same base. "(Adjusted)" marks a restated series, not a different scheme.
  const NBSP = String.fromCharCode(160);
  const base = s => {
    let t = String(s || "").split(NBSP).join(" ").replace(/\s+/g, " ").trim().toLowerCase();
    for (let k = 0; k < 5; k++) {
      const prev = t;
      t = t.replace(/\s*\(\s*adjusted\s*\)\s*$/i, "")
           .replace(/\s*[-\u2013\u2014]?\s*direct\s*plan\s*$/i, "")
           .replace(/\s*[-\u2013\u2014]\s*(dir|direct|reg|regular)\s*$/i, "")
           .replace(/\s*\(\s*(?:g|growth|idcw|d|div|dividend)\s*\)\s*$/i, "")
           .replace(/\s*[-\u2013\u2014]+\s*$/, "").trim();
      if (t === prev) break;
    }
    return t;
  };

  const regByBase = new Map();
  for (const f of W.MASTER) { const b = base(f.name); if (b && !regByBase.has(b)) regByBase.set(b, f.name); }

  const pct = v => { if (v == null || v === '') return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[,%\s]/g, '')); return isFinite(n) ? n / 100 : null; };
  const num = v => { if (v == null || v === '') return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[,\s]/g, '')); return isFinite(n) ? n : null; };
  const cell = (ws, r, c) => { const x = ws[XLSX.utils.encode_cell({ r, c })]; return x ? x.v : null; };

  const out = {}; let matched = 0, unmatched = 0; const sampleUnmatched = [];
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn]; if (!ws || !ws['!ref']) continue;
    const rg = XLSX.utils.decode_range(ws['!ref']);
    let hdr = -1;
    for (let r = rg.s.r; r <= Math.min(rg.s.r + 25, rg.e.r); r++) {
      const v = cell(ws, r, 0);
      if (v && String(v).trim().toLowerCase() === 'scheme name') { hdr = r; break; }
    }
    if (hdr < 0) continue;
    const heads = [];
    for (let c = rg.s.c; c <= rg.e.c; c++) { const v = cell(ws, hdr, c); heads.push(v != null ? String(v).trim() : ''); }
    for (let r = hdr + 1; r <= rg.e.r; r++) {
      const raw = cell(ws, r, 0);
      if (!raw) continue;
      const nm = String(raw).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
      if (!nm || /^(average|benchmark|bench mark)$/i.test(nm)) continue;   // footer rows
      if (!/direct/i.test(nm)) continue;                                    // only Direct rows
      const reg = regByBase.get(base(nm));
      if (!reg) { unmatched++; if (sampleUnmatched.length < 12) sampleUnmatched.push(nm); continue; }
      const rec = out[reg] || (out[reg] = {});
      for (const [k, h] of NUM) { const i = heads.indexOf(h); if (i >= 0) { const v = pct(cell(ws, r, i)); if (v != null) rec[k] = v; } }
      for (const [k, h] of PLAIN) { const i = heads.indexOf(h); if (i >= 0) { const v = num(cell(ws, r, i)); if (v != null) rec[k] = v; } }
      matched++;
    }
  }
  W.DIRECT_PERF = out;
  return { matched, unmatched, sampleUnmatched };
}
