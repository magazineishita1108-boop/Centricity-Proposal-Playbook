// Add instruments the Reckoner recommends but MASTER does not carry. This is a UNIVERSE change,
// not a refresh: merge_reckoner.js deliberately refuses to invent MASTER records, so anything it
// reports under "DECK NAMES WITH NO MASTER MATCH" lands here.
//
//   node add_reckoner_funds.js "<Reckoner .pptx>" --pms "<PMS_Scheme_Performance.xlsx>" --html index.html [--apply]
//
// Facts come from each product's own narrative slide; returns and ratios for the PMS entry come
// from the PMS performance workbook. Expected IRR has no per-fund source anywhere in the pack, so
// each band is taken from the fund's PEER CATEGORY in MASTER — asserted below and re-derived at
// run time, so the run fails loudly if a peer group ever stops being unanimous.
const fs = require('fs');
const path = require('path');
const B = require('./blocklib');
const N = require('./reck_narrative');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const HTML = flag('--html') || path.join(__dirname, 'index.html');
const PMSX = flag('--pms');
const SRC = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--html' && argv[i - 1] !== '--pms');
if (!SRC) { console.error('Usage: node add_reckoner_funds.js "<pptx>" --pms "<xlsx>" --html <p> [--apply]'); process.exit(2); }

// slide = the product's own page in the deck; peer = the MASTER group whose IRR band it inherits.
const ADD = [
  {
    name: 'AlfAccurate Budding Beasts PMS',
    deckName: 'Alf Accurate Budding Beasts PMS',
    reckonerName: 'AAA Budding Beasts Fund',
    slide: 37,
    asset_class: 'Equity', product_class: 'PMS', sub_category: 'Equity PMS',
    peer: { product_class: 'PMS', sub_category: 'Equity PMS', category: 'MID & SMALL CAP PMS' },
    select: { category: 'MID & SMALL CAP PMS', sheet: 'Equity Mid & Small Cap PMS', kind: 'pms' },
    pmsKey: 'AlfAccurate Advisors - AAA Budding Beasts',
    exit_load: '2% for 1 year, Nil thereafter',
  },
  {
    name: 'Carnelian Private Growth & Innovation Fund',
    deckName: 'Carnelian Private Growth & Innovation Fund',
    reckonerName: 'Carnelian Private Growth & Innovation Fund (CAT II AIF)',
    slide: 55,
    asset_class: 'Equity', product_class: 'AIF', sub_category: 'AIF CAT II - Unlisted Equity',
    peer: { product_class: 'AIF', sub_category: 'AIF CAT II - Unlisted Equity' },
    select: { category: 'EQUITY AIFs- Unlisted Equities', sheet: 'EQUITY AIFs- Unlisted Equities', kind: 'aif' },
    exit_load: 'Close Ended: 6 years 9 months from the first close, extendable by 2 years',
  },
  {
    name: 'Inquant Debt Plus Fund',
    deckName: 'Inquant Debt Plus Fund',
    reckonerName: 'Inquant Debt Plus Fund (Cat III AIF)',
    slide: 80,
    asset_class: 'Debt', product_class: 'AIF', sub_category: 'Debt AIF',
    // The Debt AIF band spans 8-17% across strategies, so the whole sub_category is not a peer
    // group. The deck files this under DEBT AIF (SHORT TERM) alongside Northern Arc and Vivriti;
    // Vivriti Short Term Debt is the comparable short-duration strategy, and its 12-13% band also
    // matches this fund's own stated breakup (~3.5% fixed income + ~9.5% arbitrage = ~13%).
    peer: { names: ['Vivriti Short Term Debt Fund '] },
    select: { category: 'DEBT AIFs', sheet: 'DEBT AIF ', kind: 'aif' },
    exit_load: 'Nil',
  },
  {
    name: 'Motilal Oswal Alternative Investment (Inbound)',
    deckName: 'Motilal Oswal Alternative Investment',
    reckonerName: 'Motilal Oswal Gift City India Equity Fund',
    slide: 105,
    asset_class: 'Global Funds', product_class: 'GIFT City', sub_category: 'GIFT City',
    peer: { product_class: 'GIFT City', sub_category: 'GIFT City' },
    select: { category: 'GIFT CITY FUNDS', sheet: 'Gift City Funds', kind: 'gift' },
    exit_load: 'Upto 6 months - 4%, >6 to 12 months - 3%, >12 to 24 months - 2%, >24 to 36 months - 1%, >36 months - Nil',
  },
];

const MASTER = B.read(HTML, 'window.MASTER = ').value;
const SELECT = B.read(HTML, 'window.CENTRICITY_SELECT = ').value;
const ALIAS = B.read(HTML, 'window.PMS_PERF_ALIAS = ').value;
const PERF = B.read(HTML, 'window.PMS_PERFORMANCE = ').value;
const byName = new Set(MASTER.map(r => r.name));

// Every field a MASTER record carries, so a new one has the same shape as its peers.
const FIELDS = ['name', 'asset_class', 'product_class', 'sub_category', 'irr_low', 'irr_high', 'aum',
  'r1m', 'r3m', 'r6m', 'r1y', 'r2y', 'r3y', 'r5y', 'r10y', 'si', 'expense', 'inception', 'fund_mgr',
  'exit_load', 'mcap_large', 'mcap_mid', 'mcap_small', 'mcap_other', 'ytm', 'avg_maturity',
  'mod_duration', 'bond_issuer', 'bond_rating'];

// Peer IRR band. Must be unanimous, or we are guessing rather than inheriting.
function peerBand(spec) {
  const peers = spec.names
    ? MASTER.filter(r => spec.names.includes(r.name))
    : MASTER.filter(r => r.product_class === spec.product_class && r.sub_category === spec.sub_category
        && (!spec.category || (SELECT[r.name] && SELECT[r.name].category === spec.category)));
  if (!peers.length) return { err: 'no peers matched' };
  const lows = [...new Set(peers.map(r => r.irr_low))];
  const highs = [...new Set(peers.map(r => r.irr_high))];
  if (lows.length !== 1 || highs.length !== 1) {
    return { err: 'peer band not unanimous — low ' + lows.join('/') + ', high ' + highs.join('/') };
  }
  return { low: lows[0], high: highs[0], n: peers.length, sample: peers.slice(0, 3).map(r => r.name) };
}

const slides = N.slides(SRC);
const pct = v => v == null ? '—' : (v * 100).toFixed(2) + '%';

const newRecs = [], newSelect = {}, aliasAdds = {};
let fail = false;

for (const spec of ADD) {
  console.log('\n=== ' + spec.name + ' ===');
  if (byName.has(spec.name)) { console.log('   already in MASTER — skipping'); continue; }

  const sl = slides[spec.slide - 1];
  const about = N.about(sl);
  const details = N.details(sl);
  const fact = {};
  details.forEach(d => { fact[d.label.toLowerCase().replace(/[^a-z]/g, '')] = d.value; });

  const band = peerBand(spec.peer);
  if (band.err) { console.error('   *** IRR peer band: ' + band.err); fail = true; continue; }
  console.log('   IRR ' + pct(band.low) + ' - ' + pct(band.high) + '   (from ' + band.n +
    ' peer' + (band.n === 1 ? '' : 's') + ': ' + band.sample.join(', ') + ')');

  const rec = {};
  for (const f of FIELDS) rec[f] = null;
  rec.name = spec.name;
  rec.asset_class = spec.asset_class;
  rec.product_class = spec.product_class;
  rec.sub_category = spec.sub_category;
  rec.irr_low = band.low;
  rec.irr_high = band.high;
  rec.exit_load = spec.exit_load;

  if (spec.pmsKey) {
    const p = PERF.pms[spec.pmsKey];
    if (!p) { console.error('   *** PMS key not in PMS_PERFORMANCE.pms: "' + spec.pmsKey + '"'); fail = true; continue; }
    for (const f of ['aum', 'r1m', 'r3m', 'r6m', 'r1y', 'r2y', 'r3y', 'r5y', 'si', 'pe',
                     'sd1y', 'sd3y', 'sharpe1y', 'sharpe3y', 'sortino1y', 'sortino3y',
                     'alpha1y', 'alpha3y', 'beta1y', 'beta3y']) {
      if (p[f] != null) rec[f] = p[f];
    }
    rec._pms_source = spec.pmsKey;
    aliasAdds[spec.name] = spec.pmsKey;
    console.log('   perf from "' + spec.pmsKey + '": 1Y ' + pct(rec.r1y) + '  3Y ' + pct(rec.r3y) +
      '  5Y ' + pct(rec.r5y) + '  AUM ' + rec.aum + ' Cr');
  } else {
    // Peers with no return series carry the band midpoint at 1Y/3Y/5Y — match that convention
    // rather than leaving the fund with no return at all in the Performance Sheet.
    const mid = +(((band.low + band.high) / 2)).toFixed(4);
    rec.r1y = rec.r3y = rec.r5y = mid;
    console.log('   no return series in the pack — 1Y/3Y/5Y set to the band midpoint ' + pct(mid) +
      ' (the convention every peer in this group already follows)');
  }
  // AUM straight off the fact card when the pack has no performance row for it.
  // "Target Fund Size" is deliberately NOT accepted: a fund still raising has no AUM, and its
  // peers all carry null rather than the number it hopes to reach.
  if (rec.aum == null) {
    const raw = fact.aum || fact.aumcr || fact.aumincrs || '';
    const m = String(raw).replace(/,/g, '').match(/([\d.]+)\s*(mn|m\b|cr|crore)?/i);
    if (m) {
      let v = parseFloat(m[1]);
      if (/usd|us\$|\$/i.test(raw) && /mn|m\b/i.test(raw)) v = v * 8.8;   // USD mn -> INR Cr, ~88/USD
      if (isFinite(v)) { rec.aum = +v.toFixed(2); console.log('   AUM from the fact card: "' + raw + '" -> ' + rec.aum + ' Cr'); }
    }
  }
  if (fact.inceptiondate) rec.inception = fact.inceptiondate;
  if (fact.fundmanagers || fact.fundmanager || fact.fundmngmtteam) rec.fund_mgr = fact.fundmanagers || fact.fundmanager || fact.fundmngmtteam;

  newRecs.push(rec);
  newSelect[spec.name] = Object.assign({ reckonerName: spec.reckonerName }, spec.select,
    about ? { rationale: about } : {}, details.length ? { details: details } : {});
  console.log('   Select: ' + spec.select.category + '   rationale ' + (about ? about.length + ' chars' : '*** NONE') +
    '   details ' + details.length + ' rows');
  if (!about) fail = true;
}

// ---------- gates ----------
console.log('\n---------------- gates ----------------');
console.log('MASTER baseline ' + MASTER.length + ' -> ' + (MASTER.length + newRecs.length));
console.log('CENTRICITY_SELECT ' + Object.keys(SELECT).length + ' -> ' + (Object.keys(SELECT).length + Object.keys(newSelect).length));
const allNames = MASTER.map(r => r.name).concat(newRecs.map(r => r.name));
const dupes = allNames.filter((x, i) => allNames.indexOf(x) !== i);
console.log('GATE no duplicate MASTER names: ' + (dupes.length ? '*** ' + dupes.join(' | ') : 'PASS'));
if (dupes.length) fail = true;
const shape = newRecs.every(r => FIELDS.every(f => f in r));
console.log('GATE new records carry the full field set: ' + (shape ? 'PASS' : '*** missing fields'));
if (!shape) fail = true;
const irrOk = newRecs.every(r => r.irr_low > 0 && r.irr_high > r.irr_low && r.irr_high < 0.5);
console.log('GATE IRR bands sane (0 < low < high < 50%): ' + (irrOk ? 'PASS' : '*** out of range'));
if (!irrOk) fail = true;
console.log('GATE alias pins to add: ' + (Object.keys(aliasAdds).length ? Object.entries(aliasAdds).map(([a, b]) => a + ' -> ' + b).join('; ') : 'none'));

// A GIFT City record added to the embedded block does not survive page load. Sibling #3,
// Centricity_June_Refresh.js, does
//     window.MASTER = window.MASTER.filter(f => f.product_class !== "GIFT City").concat(NEW_GIFT)
// which drops the whole baseline bucket and substitutes its own list. So the record has to go
// into NEW_GIFT too. It is written to both: the sibling is what runs today, and the baseline is
// what will be left once the siblings are folded in (open item #1).
const SIBLING = path.join(path.dirname(HTML), 'Centricity_June_Refresh.js');
// Every GIFT City fund this script is responsible for, whether it was added on this run or an
// earlier one — so re-running repairs a sibling that has drifted instead of silently skipping.
const giftNames = new Set(ADD.filter(a => a.product_class === 'GIFT City').map(a => a.name));
const giftRecs = MASTER.concat(newRecs).filter(r => giftNames.has(r.name));
if (giftRecs.length) {
  const s = fs.readFileSync(SIBLING, 'utf8');
  const at = s.indexOf('var NEW_GIFT = [');
  if (at < 0) { console.error('\n*** NEW_GIFT not found in ' + path.basename(SIBLING) + ' — a GIFT City add would be silently wiped'); fail = true; }
  else {
    const end = s.indexOf('}];', at);
    if (end < 0) { console.error('\n*** could not find the end of NEW_GIFT'); fail = true; }
    else console.log('\nGATE GIFT City records also written to ' + path.basename(SIBLING) +
      ' NEW_GIFT (it replaces the whole bucket at load): ' + giftRecs.map(r => r.name).join(', '));
  }
}

if (!APPLY) { console.log('\n[dry run] pass --apply to write'); process.exit(fail ? 1 : 0); }
if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }

const bytes = B.writeBlocks(HTML, [
  { prefix: 'window.MASTER = ', value: MASTER.concat(newRecs) },
  { prefix: 'window.CENTRICITY_SELECT = ', value: Object.assign({}, SELECT, newSelect) },
  { prefix: 'window.PMS_PERF_ALIAS = ', value: Object.assign({}, ALIAS, aliasAdds) },
]);
console.log('\nWROTE ' + HTML + ' — ' + bytes + ' bytes');

if (giftRecs.length) {
  let s = fs.readFileSync(SIBLING, 'utf8');
  const at = s.indexOf('var NEW_GIFT = [');
  const end = s.indexOf('}];', at);
  const already = giftRecs.filter(r => s.slice(at, end).includes('"name":"' + r.name + '"'));
  const toAdd = giftRecs.filter(r => !already.includes(r));
  if (toAdd.length) {
    // NEW_GIFT holds plain MASTER records; drop the non-schema keys the sibling never carries
    const plain = toAdd.map(r => { const o = {}; for (const f of FIELDS) o[f] = r[f]; return o; });
    s = s.slice(0, end + 1) + ',' + plain.map(o => JSON.stringify(o)).join(',') + s.slice(end + 1);
    fs.writeFileSync(SIBLING, s, 'utf8');
    console.log('WROTE ' + SIBLING + ' — NEW_GIFT +' + toAdd.length);
  } else {
    console.log('NEW_GIFT already carries ' + already.map(r => r.name).join(', ') + ' — sibling unchanged');
  }
}
