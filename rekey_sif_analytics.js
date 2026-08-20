// Re-key SIF analytics entries from the workbook's scheme name to the MASTER fund name.
//
//   node rekey_sif_analytics.js [--html <p>] [--apply]
//
// The analytics workbooks name a SIF by its scheme alone — "Altiva Hybrid Long-Short Fund-Reg(G)"
// — while MASTER names it with the AMC in front: "Edelweiss Altiva Hybrid Long-Short Fund". The
// analytics stores are keyed by MASTER name everywhere else, so the holdings load fine and are
// then simply unreachable: the fund shows no sectors, no stocks, no credit profile, and
// H.hasEqHoldings / H.hasDbHoldings drop it from the analytics and overlap sections entirely.
//
// No fuzzy matching is needed. Centricity_SIF_Refresh.js already records the workbook name on
// each record as `sif_raw`, so the join is exact.
//
// RUN THIS AFTER EVERY ANALYTICS BAKE — parseAnalytics re-creates the workbook-named keys, the
// same way fill_variant_analytics.js has to be re-run.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const B = require('./blocklib');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const HTML = flag('--html') || path.join(__dirname, 'index.html');
const DIR = path.dirname(HTML);

// ---------- the analytics blocks, straight from the file (baseline, pre-sibling) ----------
const STORES = [
  { g: 'EQUITY_ANALYTICS', prefix: 'window.EQUITY_ANALYTICS = ' },
  { g: 'HYBRID_ANALYTICS', prefix: 'window.HYBRID_ANALYTICS = ' },
  { g: 'DEBT_ANALYTICS',   prefix: 'window.DEBT_ANALYTICS = ' },
];
for (const s of STORES) s.value = B.read(HTML, s.prefix).value;

// ---------- sif_raw -> MASTER name, by running the siblings that build the SIF bucket ----------
// Only MASTER is read back out. The analytics globals are deliberately NOT taken from the sandbox:
// sibling #3 mutates EQUITY_ANALYTICS, and baking that in would re-apply it on every page load.
const sandbox = {
  console: { log() {}, warn() {}, error() {} }, JSON, Math, Object, Array, String, Number, Boolean,
  Date, RegExp, Map, Set, Promise, parseFloat, parseInt, isNaN, isFinite, Error, TypeError,
  setTimeout() {}, clearTimeout() {},
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }), addEventListener() {},
    head: { appendChild() {} }, body: { appendChild() {} } },
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
sandbox.MASTER = B.read(HTML, 'window.MASTER = ').value;
sandbox.EQUITY_ANALYTICS = {}; sandbox.HYBRID_ANALYTICS = {}; sandbox.DEBT_ANALYTICS = {};
sandbox.DATA_DATES = {}; sandbox.BENCHMARKS = {}; sandbox.RATIONALE = {}; sandbox.LIQUIDITY_MAP = {};
sandbox.REFRESH = {};
for (const f of ['Centricity_June_Refresh.js', 'Centricity_IRR_Offshore.js', 'Centricity_SIF_Refresh.js']) {
  const p = path.join(DIR, f);
  if (!fs.existsSync(p)) { console.error('*** missing sibling: ' + f); process.exit(1); }
  try { vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f }); }
  catch (e) { console.error('*** ' + f + ': ' + e.message); process.exit(1); }
}
const sif = sandbox.MASTER.filter(r => r.product_class === 'SIF');
console.log('SIF funds after the siblings run: ' + sif.length +
  '   (carrying sif_raw: ' + sif.filter(r => r.sif_raw).length + ')\n');

// ---------- re-key ----------
const moved = [], already = [], missing = [], replaced = [];
for (const r of sif) {
  if (!r.sif_raw) { missing.push(r.name + '   (no sif_raw on the record)'); continue; }
  const hit = STORES.find(s => s.value[r.sif_raw]);
  const under = STORES.find(s => s.value[r.name]);
  if (under && !hit) { already.push(under.g + '  ' + r.name); continue; }
  if (!hit) { missing.push(r.name + '   (workbook name "' + r.sif_raw + '" not in any analytics store)'); continue; }
  // Both keys present means a bake ran after the last re-key: parseAnalytics merged this month's
  // rows back in under the workbook name, while the MASTER-named copy is last month's. The
  // workbook-named one is the fresher of the two, so it wins.
  if (under) {
    if (under !== hit) delete under.value[r.name];      // class changed between months
    replaced.push(hit.g.slice(0, 2).toLowerCase() + '  ' + r.name + '   (refreshed from "' + r.sif_raw + '")');
  } else {
    moved.push(hit.g.slice(0, 2).toLowerCase() + '  ' + r.sif_raw + '   ->   ' + r.name);
  }
  hit.value[r.name] = hit.value[r.sif_raw];
  delete hit.value[r.sif_raw];
}

console.log('re-keyed: ' + moved.length);
moved.forEach(m => console.log('   ' + m));
if (replaced.length) { console.log('\nrefreshed from a newer bake: ' + replaced.length); replaced.forEach(r => console.log('   ' + r)); }
if (already.length) { console.log('\nalready keyed by MASTER name: ' + already.length); already.forEach(a => console.log('   ' + a)); }
if (missing.length) {
  console.log('\nno analytics anywhere for ' + missing.length + ' SIF fund' + (missing.length === 1 ? '' : 's') +
    ' — absent from the source workbooks, chase upstream:');
  missing.forEach(m => console.log('   ! ' + m));
}

// ---------- gates ----------
console.log('\n---------------- gates ----------------');
const counts = STORES.map(s => s.g + ' ' + Object.keys(s.value).length).join(' | ');
console.log('GATE store sizes unchanged (re-key moves, never adds): ' + counts);
let fail = false;
const nowReachable = sif.filter(r => STORES.some(s => s.value[r.name])).length;
console.log('GATE SIF funds with reachable analytics: ' + nowReachable + ' of ' + sif.length);
const leftovers = STORES.flatMap(s => Object.keys(s.value).filter(k => sif.some(r => r.sif_raw === k)));
console.log('GATE no workbook-named SIF keys left behind: ' + (leftovers.length ? '*** ' + leftovers.join(' | ') : 'PASS'));
if (leftovers.length) fail = true;

if (!moved.length && !replaced.length) { console.log('\nnothing to do — already re-keyed'); process.exit(fail ? 1 : 0); }
if (!APPLY) { console.log('\n[dry run] pass --apply to write'); process.exit(fail ? 1 : 0); }
if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }
const bytes = B.writeBlocks(HTML, STORES.map(s => ({ prefix: s.prefix, value: s.value })));
console.log('\nWROTE ' + HTML + ' — ' + bytes + ' bytes');
