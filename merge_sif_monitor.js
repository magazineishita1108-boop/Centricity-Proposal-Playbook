// MONTHLY: bake the SIF Monitor into Centricity_SIF_Refresh.js's embedded `var SIF` block, so
// the dashboard ships with SIF returns already filled instead of the blanks it carried while
// DATA_DATES.sif read "—".
//
// Runs the sibling's OWN REFRESH.parseSif over the workbook inside a Node vm sandbox — the same
// trick bake_month.js uses — so what is baked in is byte-for-byte what the Section 7 "SIF
// Monitor" card would produce from the same file. There is no second parser to drift.
//
//   node merge_sif_monitor.js "<SIF Monitor_<date>.xlsx>" --as-on "31st August 2026" [--apply]
//
// Also stamps the as-on date into the sibling's DATA_DATES.sif fallback, which is what the page
// shows before anyone uploads anything.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');
const blocklib = require('./blocklib.js');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const ASON = flag('--as-on');
const SIB = flag('--sibling') || path.join(__dirname, 'Centricity_SIF_Refresh.js');
const SRC = argv.find(a => !a.startsWith('--') && a !== ASON && a !== SIB);
if (!SRC || !fs.existsSync(SRC)) {
  console.error('Usage: node merge_sif_monitor.js "<SIF Monitor_<date>.xlsx>" [--as-on "31st August 2026"] [--sibling <p>] [--apply]');
  process.exit(2);
}
console.log(`monitor : ${path.basename(SRC)}`);
console.log(`sibling : ${path.basename(SIB)}\n`);

const sibSrc = fs.readFileSync(SIB, 'utf8');
const before = blocklib.locate(sibSrc, 'var SIF = ').value;

// ---------- sandbox ----------
// The sibling filters window.MASTER and concats its own SIF rows, then registers parseSif. A
// MASTER seeded with nothing but a deep copy of those rows is enough: parseSif reads MASTER,
// not the page.
const sandbox = {
  console,
  XLSX,
  window: {
    MASTER: [],
    DATA_DATES: {},
    RATIONALE: {}, BENCHMARKS: {}, LIQUIDITY_MAP: {},
  },
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(sibSrc, sandbox, { filename: path.basename(SIB) });

const applied = sandbox.window.__SIF_REFRESH_APPLIED || {};
console.log(`sandbox : sibling installed ${applied.added} SIF rows`);
if (typeof sandbox.window.REFRESH?.parseSif !== 'function') { console.error('*** REFRESH.parseSif not registered — aborting'); process.exit(1); }

// A File-alike with the two members parseSif actually touches.
const buf = fs.readFileSync(SRC);
const fileLike = { name: path.basename(SRC), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };

(async () => {
  const res = await sandbox.window.REFRESH.parseSif(fileLike, { asOn: ASON || '' });
  if (!res || !res.ok) { console.error('*** parseSif failed: ' + (res && res.error)); process.exit(1); }
  console.log(`parseSif: ${res.message}\n`);

  const after = sandbox.window.MASTER.filter(f => /SIF$/.test(f.product_class || ''));
  const asOn = sandbox.window.DATA_DATES.sif;

  // ---------- what changed ----------
  const byName = new Map(before.map(r => [r.name, r]));
  const FIELDS = ['aum', 'r1m', 'r3m', 'r6m', 'r1y', 'r2y', 'r3y', 'r5y', 'si', 'inception', 'exit_load'];
  let filled = 0, changed = 0;
  const fresh = [];
  for (const r of after) {
    const b = byName.get(r.name);
    if (!b) { fresh.push(r); continue; }
    for (const k of FIELDS) {
      const o = b[k] == null ? null : b[k], n = r[k] == null ? null : r[k];
      if (o === n) continue;
      if (o === null) filled++; else changed++;
    }
  }
  const cover = k => after.filter(r => r[k] != null).length;
  console.log(`SIF rows          : ${before.length} -> ${after.length}`);
  console.log(`values filled     : ${filled} (were blank)`);
  console.log(`values changed    : ${changed}`);
  console.log(`carrying AUM      : ${cover('aum')} of ${after.length}`);
  console.log(`carrying 1M / SI  : ${cover('r1m')} / ${cover('si')}`);
  console.log(`carrying inception: ${cover('inception')}`);
  console.log(`DATA_DATES.sif    : ${asOn}`);
  if (fresh.length) {
    console.log(`\nNEW schemes added (no AMC prefix or IRR band — the workbook carries neither):`);
    for (const r of fresh) console.log(`   + ${r.name}   [${r.product_class} | AUM ${r.aum} | inc ${r.inception}]`);
  }

  // ---------- gates ----------
  const bad = after.filter(r => ['r1m', 'r3m', 'r6m', 'r1y', 'r3y', 'r5y', 'si'].some(k => r[k] != null && Math.abs(r[k]) > 3));
  console.log(`\nGATE returns within +-300% (decimals): ${bad.length ? 'FAIL ' + bad.map(b => b.name).join(', ') : 'PASS'}`);
  if (bad.length) process.exit(1);
  const noPerf = after.filter(r => r.si == null && r.r1m == null);
  console.log(`GATE every SIF row has at least one return: ${noPerf.length ? 'WARN — ' + noPerf.map(n => n.name).join(', ') : 'PASS'}`);
  const dupes = after.map(r => r.name).filter((n, i, a) => a.indexOf(n) !== i);
  console.log(`GATE duplicate SIF names: ${dupes.length ? 'FAIL ' + dupes.join(', ') : 'PASS (0)'}`);
  if (dupes.length) process.exit(1);
  if (after.length < before.length) { console.error('*** SIF block shrank — aborting'); process.exit(1); }

  if (!APPLY) { console.log('\n[dry run] pass --apply to write ' + path.basename(SIB)); return; }

  const size = blocklib.writeBlocks(SIB, [{ prefix: 'var SIF = ', value: after }]);
  // The fallback the page shows before anyone uploads: "—" until a monitor has been baked in.
  let out = fs.readFileSync(SIB, 'utf8');
  const re = /(if \(window\.DATA_DATES\) window\.DATA_DATES\.sif = )"[^"]*";([^\n]*)/;
  if (!re.test(out)) { console.error('*** DATA_DATES.sif fallback line not found — aborting before it goes stale'); process.exit(1); }
  out = out.replace(re, `$1${JSON.stringify(asOn)};  // baked from ${path.basename(SRC)}`);
  fs.writeFileSync(SIB, out, 'utf8');
  console.log(`\nwrote ${path.basename(SIB)} (${out.length} bytes; SIF block ${size} bytes)`);
  console.log(`DATA_DATES.sif fallback set to "${asOn}"`);
})();
