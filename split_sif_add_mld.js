// ONE-OFF (idempotent): two taxonomy changes.
//
//   node split_sif_add_mld.js [--html <p>] [--apply]
//
// 1. SIF splits by underlying strategy. Every SIF was asset_class "Hybrid" / product_class "SIF",
//    including the equity long-short ones. They now become:
//       Equity  / "Equity SIF"  — Equity Long-Short, Equity Ex-Top 100 Long-Short, Sector Rotation
//       Hybrid  / "Hybrid SIF"  — Hybrid Long-Short, Active Asset Allocator Long-Short
//    The strategy is only present in the scheme name, so the classifier reads it from there and
//    refuses to guess: anything it cannot place is reported and left alone.
//
//    THE SIBLING MUST BE WRITTEN TOO. Centricity_SIF_Refresh.js drops every product_class "SIF"
//    row and concats its own hard-coded array of 28 on each page load, so a change made only to
//    the embedded block is gone in the browser.
//
// 2. MLD added as a Debt product class with its first instrument.
const fs = require('fs');
const path = require('path');
const B = require('./blocklib');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const HTML = flag('--html') || path.join(__dirname, 'index.html');
const SIB = path.join(path.dirname(HTML), 'Centricity_SIF_Refresh.js');

// SEBI's SIF strategy families. Order matters: "Active Asset Allocator" must be tested before the
// bare /equity/ rule, and "Sector Rotation" is an equity strategy despite not saying "equity".
const RULES = [
  [/active\s+asset\s+allocator/i, 'Hybrid', 'Hybrid SIF'],
  [/\bhybrid\b/i,                 'Hybrid', 'Hybrid SIF'],
  [/ex-?top\s*100/i,              'Equity', 'Equity SIF'],
  [/sector\s+rotation/i,          'Equity', 'Equity SIF'],
  [/\bequity\b/i,                 'Equity', 'Equity SIF'],
];
function classify(name) {
  for (const [re, ac, pc] of RULES) if (re.test(name)) return { asset_class: ac, product_class: pc, sub_category: pc };
  return null;
}

const MLD = {
  name: 'Neo Market Services Limited',
  asset_class: 'Debt', product_class: 'MLD', sub_category: 'MLD',
  irr_low: 0.10, irr_high: 0.12,
  aum: null, r1m: null, r3m: null, r6m: null, r1y: null, r2y: null, r3y: null, r5y: null,
  r10y: null, si: null, expense: null, inception: null, fund_mgr: null,
  exit_load: 'Close Ended; Hold Till Maturity (Aug-2029)',
  mcap_large: null, mcap_mid: null, mcap_small: null, mcap_other: null,
  ytm: null, avg_maturity: null, mod_duration: null, bond_issuer: null, bond_rating: null,
};

function reclass(list, label) {
  const out = [], moved = [], stuck = [];
  for (const r of list) {
    if (!/^(SIF|Equity SIF|Hybrid SIF)$/.test(r.product_class)) { out.push(r); continue; }
    const c = classify(r.name);
    if (!c) { stuck.push(r.name); out.push(r); continue; }
    if (r.asset_class === c.asset_class && r.product_class === c.product_class) { out.push(r); continue; }
    out.push(Object.assign({}, r, c));
    moved.push({ name: r.name, from: r.asset_class + ' / ' + r.product_class, to: c.asset_class + ' / ' + c.product_class });
  }
  if (moved.length || stuck.length) {
    console.log('\n' + label + ': reclassified ' + moved.length);
    moved.forEach(m => console.log('   ' + m.to.padEnd(20) + m.name));
    if (stuck.length) { console.log('   *** strategy not recognised — left alone:'); stuck.forEach(s => console.log('       ' + s)); }
  } else console.log('\n' + label + ': already classified');
  return { out, stuck };
}

// ---------- 1a. baseline MASTER — deliberately NOT reclassified ----------
// The embedded block still holds 12 legacy product_class "SIF" rows. None of them share a name
// with the sibling's 28 (they are workbook-named leftovers, plus three that are not SIFs at all:
// the two Kotak Optimus hybrid AIFs and ASK Absolute Return). The sibling DELETES every
// product_class "SIF" row before concatenating its own list, so those 12 never reach the browser.
// Reclassifying them would take them out of that filter's reach and duplicate the whole bucket.
const MASTER = B.read(HTML, 'window.MASTER = ').value;
const legacy = MASTER.filter(r => r.product_class === 'SIF');
console.log('index.html baseline: ' + legacy.length + ' legacy "SIF" rows left as-is — the sibling deletes them at load');
const baseRes = { out: MASTER, stuck: [] };
let next = baseRes.out;

// ---------- 2. MLD ----------
const hasMld = next.some(r => r.name === MLD.name);
if (hasMld) console.log('\nMLD: "' + MLD.name + '" already present');
else { next = next.concat([MLD]); console.log('\nMLD: adding "' + MLD.name + '"  Debt / MLD  IRR 10%-12%  ' + MLD.exit_load); }

// ---------- 1b. the sibling ----------
const sibSrc = fs.readFileSync(SIB, 'utf8');
const sibLoc = B.locate(sibSrc, 'var SIF = ');
const sibRes = reclass(sibLoc.value, 'Centricity_SIF_Refresh.js');

// ---------- gates ----------
console.log('\n---------------- gates ----------------');
let fail = baseRes.stuck.length > 0 || sibRes.stuck.length > 0;
console.log('GATE every SIF strategy recognised: ' + (fail ? '*** some unclassified' : 'PASS'));

const tally = list => list.filter(r => /SIF$/.test(r.product_class))
  .reduce((a, r) => { const k = r.asset_class + ' / ' + r.product_class; a[k] = (a[k] || 0) + 1; return a; }, {});
console.log('GATE sibling split: ' + JSON.stringify(tally(sibRes.out)));
console.log('GATE baseline split: ' + JSON.stringify(tally(next)));

const names = next.map(r => r.name);
const dupes = names.filter((x, i) => names.indexOf(x) !== i);
console.log('GATE no duplicate names: ' + (dupes.length ? '*** ' + dupes.join(' | ') : 'PASS'));
if (dupes.length) fail = true;

const sibNames = new Set(sibRes.out.map(r => r.name));
const overlap = next.filter(r => /SIF$/.test(r.product_class) && sibNames.has(r.name)).length;
console.log('GATE baseline SIF also in the sibling (sibling wins at load): ' + overlap +
  ' of ' + next.filter(r => /SIF$/.test(r.product_class)).length);
console.log('GATE record count: ' + MASTER.length + ' -> ' + next.length + (hasMld ? '' : '  (+1 MLD)'));

if (!APPLY) { console.log('\n[dry run] pass --apply to write'); process.exit(fail ? 1 : 0); }
if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }

B.writeBlocks(HTML, [{ prefix: 'window.MASTER = ', value: next }]);
console.log('\nWROTE ' + HTML);
B.writeBlocks(SIB, [{ prefix: 'var SIF = ', value: sibRes.out }]);
console.log('WROTE ' + SIB);
