// Refresh ONE analytics class (equity / hybrid / debt) from its workbook, using index.html's own
// REFRESH.parseAnalytics inside a Node vm sandbox — so the result is identical to what the
// Section 7 uploader would produce. Use this when only one class needs re-baking; bake_month.js
// does all three plus the MF Monitor.
//
//   node merge_analytics.js --hybrid "<Hybrid Analytics_July 2026.xlsx>" --as-on "31st July 2026" [--apply]
//
// parseAnalytics MERGES: a scheme in last month's block but absent from this month's workbook
// keeps its old holdings under the new date. The run reports exactly which ones those are, split
// by whether this workbook is even supposed to cover them.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const ASON = flag('--as-on');
const HTML = flag('--html') || path.join(__dirname, 'index.html');
const KINDS = [['equity', 'EQUITY_ANALYTICS'], ['hybrid', 'HYBRID_ANALYTICS'], ['debt', 'DEBT_ANALYTICS']]
  .map(([k, g]) => ({ kind: k, global: g, src: flag('--' + k) }))
  .filter(x => x.src);
if (!KINDS.length || !ASON) {
  console.error('Usage: node merge_analytics.js --hybrid "<xlsx>" --as-on "31st July 2026" [--equity <xlsx>] [--debt <xlsx>] [--html <p>] [--apply]');
  process.exit(2);
}
for (const k of KINDS) {
  if (!fs.existsSync(k.src)) { console.error('*** missing source: ' + k.src); process.exit(2); }
  console.log(k.kind.padEnd(7) + ' <- ' + path.basename(k.src));
}

// ---------- sandbox: run the baseline data + helpers + parsers, not the UI or the siblings ----------
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
let ran = 0;
for (const b of blocks) {
  if (b.src) continue;                                          // CDN + the five siblings
  if (/ReactDOM\.createRoot/.test(b.body)) continue;
  try { vm.runInContext(b.body, sandbox, { timeout: 120000 }); ran++; } catch (e) { /* UI blocks need React */ }
}
const W = sandbox.window;
if (!W.REFRESH || !W.REFRESH.parseAnalytics) { console.error('*** window.REFRESH.parseAnalytics not available'); process.exit(1); }
console.log('sandbox: ran ' + ran + ' inline blocks\n');

// The "Scheme Name" column of a workbook — what this month's file actually covers.
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
const fileOf = p => ({ name: path.basename(p), arrayBuffer: async () => fs.readFileSync(p) });

(async () => {
  const pcByName = new Map(W.MASTER.map(r => [r.name, r.product_class]));
  const writes = [];
  let fail = false;

  for (const k of KINDS) {
    const store = W[k.global];
    const before = new Set(Object.keys(store));
    const covered = schemeNames(k.src);

    const r = await W.REFRESH.parseAnalytics(fileOf(k.src), k.kind);
    console.log('parseAnalytics(' + k.kind + '): ' + (r.ok ? r.message : 'FAILED ' + r.error));
    if (!r.ok) { fail = true; continue; }

    const after = Object.keys(store);
    const added = after.filter(n => !before.has(n));
    const refreshed = after.filter(n => before.has(n) && covered.has(n));
    const stale = [...before].filter(n => !covered.has(n));
    const mfStale = stale.filter(n => ['Mutual Fund', 'Index Fund', 'ETF'].includes(pcByName.get(n)));
    const otherStale = stale.filter(n => !mfStale.includes(n));

    console.log('  ' + k.global + ': ' + before.size + ' -> ' + after.length +
      '   (workbook covers ' + covered.size + ' schemes)');
    console.log('    refreshed from this workbook : ' + refreshed.length);
    console.log('    newly added                  : ' + added.length);
    console.log('    NOT in this workbook         : ' + stale.length +
      '  =  ' + mfStale.length + ' MF/Index/ETF (STALE — still last month\'s holdings) + ' +
      otherStale.length + ' PMS/AIF/other (expected; different source file)');
    if (added.length) added.slice(0, 12).forEach(n => console.log('      + ' + n));
    if (mfStale.length) mfStale.slice(0, 20).forEach(n => console.log('      ! ' + n));

    // sanity: holdings should sum to something plausible, not 0 and not >>100
    const bad = [];
    for (const n of refreshed.slice(0, 400)) {
      const v = store[n];
      const tot = (v.eq_total || 0) + (v.db_total || 0);
      if (tot > 0 && (tot < 30 || tot > 130)) bad.push(n + ' total=' + tot.toFixed(1) + '%');
    }
    console.log('    GATE holdings total in 30-130%: ' + (bad.length ? '*** ' + bad.slice(0, 4).join(' | ') : 'PASS'));
    if (bad.length) fail = true;
    if (!refreshed.length && !added.length) { console.log('    *** this workbook refreshed nothing — wrong file or wrong kind?'); fail = true; }

    writes.push(['window.' + k.global + ' = ', store]);
  }

  if (!APPLY) { console.log('\n[dry run] pass --apply to write'); process.exit(fail ? 1 : 0); }
  if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }

  const B = require('./blocklib');
  B.writeBlocks(HTML, writes.map(([prefix, value]) => ({ prefix, value })));
  let h = fs.readFileSync(HTML, 'utf8');
  h = h.replace(/(analytics:\s*)"[^"]*"/, '$1"' + ASON + '"');
  fs.writeFileSync(HTML, h, 'utf8');
  console.log('\nWROTE ' + HTML + ' — ' + h.length + ' bytes; DATA_DATES.analytics = "' + ASON + '"');
})();
