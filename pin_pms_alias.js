// Re-point PMS_PERF_ALIAS entries that the August Reckoner and the July PMS file jointly resolve.
// Each pin below is corroborated by two sources: the deck names the strategy Centricity actually
// recommends, and the performance file carries exactly one scheme matching that strategy.
//   node pin_pms_alias.js --html <index.html> [--apply]
const B = require('./blocklib');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const HTML = flag('--html');
if (!HTML) { console.error('Usage: node pin_pms_alias.js --html <index.html> [--apply]'); process.exit(2); }

const PINS = {
  // deck index (slide 2): "Negen Capital – Special Situations & Dynamic Allocation Fund".
  // The July file offers two Negen schemes; only one is the Special Situations mandate.
  'Negen Capital- Special Situation & Tech Fund': ['Negen Special Situations & Dynamic Allocation Strategy',
    'the Technology-era name is retired; the deck itself now calls it Special Situations & Dynamic Allocation'],
  // The Fractal false positive this pin used to block is "Fractal Capital - Wealth Builder";
  // "Karma - Wealth Builder" is the Karma house name, and the deck recommends it (slide 26).
  'Karma Capital Wealth Builder ': ['Karma - Wealth Builder',
    'distinct from Fractal Capital - Wealth Builder, which is a different manager'],
  'TCG Transformative Growth Portfolio': ['TCG Transformative Growth Portfolio',
    'the file carries this name verbatim'],
  'Emkay Golden Decade PMS': ["Emkay Investments - India''s Golden Decade of Growth",
    'doubled apostrophe is in the source; the only Emkay Golden Decade strategy in the file'],
  'Motilal Oswal Founders Portfolio': ['Motilal Oswal-Founders',
    'the only Founders strategy among the 10 Motilal Oswal schemes in the file'],
};

const alias = B.read(HTML, 'window.PMS_PERF_ALIAS = ').value;
const perf = B.read(HTML, 'window.PMS_PERFORMANCE = ').value;
const master = B.read(HTML, 'window.MASTER = ').value;
const next = Object.assign({}, alias);

let fail = false;
for (const m of Object.keys(PINS)) {
  const key = PINS[m][0];
  if (!(m in alias)) { console.error('*** not in the alias map: "' + m + '"'); fail = true; continue; }
  if (!perf.pms[key]) { console.error('*** key not in PMS_PERFORMANCE.pms: "' + key + '"'); fail = true; continue; }
  const v = perf.pms[key];
  console.log('  ' + m);
  console.log('      -> ' + key);
  console.log('         ' + PINS[m][1]);
  console.log('         1Y ' + (v.r1y != null ? (v.r1y * 100).toFixed(2) + '%' : '—') +
              '   3Y ' + (v.r3y != null ? (v.r3y * 100).toFixed(2) + '%' : '—') +
              '   AUM ' + (v.aum != null ? v.aum.toLocaleString('en-IN') + ' Cr' : '—'));
  next[m] = key;
}

const pmsFunds = master.filter(r => r.product_class === 'PMS');
const before = pmsFunds.filter(f => alias[f.name] && perf.pms[alias[f.name]]).length;
const after = pmsFunds.filter(f => next[f.name] && perf.pms[next[f.name]]).length;
console.log('\nGATE MASTER PMS funds with performance: ' + before + ' -> ' + after + ' (of ' + pmsFunds.length + ')');
console.log('GATE still pinned null: ' + Object.keys(next).filter(k => next[k] === null).join(' | '));
if (after < before) fail = true;

if (!APPLY) { console.log('\n[dry run] pass --apply to write'); process.exit(0); }
if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }
const bytes = B.writeBlocks(HTML, [{ prefix: 'window.PMS_PERF_ALIAS = ', value: next }]);
console.log('\nWROTE ' + HTML + ' — ' + bytes + ' bytes');
