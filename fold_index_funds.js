// ONE-OFF: make Index Fund a sub-category of Mutual Fund rather than its own product class,
// the same way Flexi Cap / Mid Cap / ELSS are.
//
//   node fold_index_funds.js [--html <p>] [--apply]
//
// Every affected record keeps sub_category "Index Fund"; only product_class moves. The code half
// of the change is in index.html itself (SHEET_MAP, fofUnderlyingName, PC_ORDER, displayPC) —
// this script only rewrites MASTER and re-checks the invariants.
//
// Re-running is a no-op once the fold is done.
const fs = require('fs');
const path = require('path');
const B = require('./blocklib');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const HTML = flag('--html') || path.join(__dirname, 'index.html');

const MASTER = B.read(HTML, 'window.MASTER = ').value;
const targets = MASTER.filter(r => r.product_class === 'Index Fund');
console.log('records with product_class "Index Fund": ' + targets.length);
if (!targets.length) { console.log('nothing to fold — already done'); process.exit(0); }

const subs = {};
targets.forEach(r => { const k = r.asset_class + ' > ' + r.sub_category; subs[k] = (subs[k] || 0) + 1; });
console.log('  they sit in: ' + Object.entries(subs).map(([k, n]) => k + ' (' + n + ')').join(', '));
const odd = Object.keys(subs).filter(k => !/> Index Fund$/.test(k));
if (odd.length) { console.error('*** unexpected sub_category among them: ' + odd.join(' | ') + ' — aborting'); process.exit(1); }

const next = MASTER.map(r => r.product_class === 'Index Fund'
  ? Object.assign({}, r, { product_class: 'Mutual Fund' })   // sub_category deliberately untouched
  : r);

// ---------- gates ----------
console.log('\n---------------- gates ----------------');
const names = next.map(r => r.name);
const dupes = names.filter((x, i) => names.indexOf(x) !== i);
console.log('GATE no duplicate names introduced: ' + (dupes.length ? '*** ' + dupes.slice(0, 3).join(' | ') : 'PASS'));
let fail = dupes.length > 0;

console.log('GATE record count unchanged: ' + MASTER.length + ' -> ' + next.length +
  (MASTER.length === next.length ? '  PASS' : '  *** CHANGED'));
if (MASTER.length !== next.length) fail = true;

const onlyPc = next.every((r, i) => {
  const o = MASTER[i];
  return Object.keys(r).every(k => k === 'product_class' || JSON.stringify(r[k]) === JSON.stringify(o[k]));
});
console.log('GATE only product_class changed on any record: ' + (onlyPc ? 'PASS' : '*** other fields moved'));
if (!onlyPc) fail = true;

const subKept = next.filter(r => r.sub_category === 'Index Fund').length;
console.log('GATE sub_category "Index Fund" preserved: ' + subKept + ' (was ' + targets.length + ')' +
  (subKept === targets.length ? '  PASS' : '  *** LOST'));
if (subKept !== targets.length) fail = true;

const before = {}, after = {};
MASTER.forEach(r => { before[r.product_class] = (before[r.product_class] || 0) + 1; });
next.forEach(r => { after[r.product_class] = (after[r.product_class] || 0) + 1; });
console.log('\nproduct_class before -> after:');
[...new Set([...Object.keys(before), ...Object.keys(after)])].sort().forEach(k =>
  console.log('   ' + k.padEnd(18) + String(before[k] || 0).padStart(6) + ' -> ' + String(after[k] || 0).padStart(6) +
    (before[k] !== after[k] ? '   <—' : '')));

console.log('\nEquity sub-categories under Mutual Fund after the fold:');
const eq = {};
next.filter(r => r.product_class === 'Mutual Fund' && r.asset_class === 'Equity')
  .forEach(r => { eq[r.sub_category] = (eq[r.sub_category] || 0) + 1; });
Object.entries(eq).sort((a, b) => b[1] - a[1]).forEach(([k, n]) =>
  console.log('   ' + String(n).padStart(4) + '  ' + k + (k === 'Index Fund' ? '   <— folded in' : '')));

if (!APPLY) { console.log('\n[dry run] pass --apply to write'); process.exit(fail ? 1 : 0); }
if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }
const bytes = B.writeBlocks(HTML, [{ prefix: 'window.MASTER = ', value: next }]);
console.log('\nWROTE ' + HTML + ' — ' + bytes + ' bytes');
