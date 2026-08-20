// MONTHLY: refresh window.CENTRICITY_SELECT from Monthly Investment Reckoner - <Month Year>.pptx
//
//   node merge_reckoner.js "<pptx>" --html <index.html> [--apply]
//
// Membership comes from the deck. The dashboard's own category structure is preserved: a deck
// heading maps to an existing `sheet`/`category` pair, and headings the dashboard has no Select
// bucket for are reported, not invented (putting a Select badge on a liquid fund or a plain index
// tracker is a house recommendation, not a data refresh).
//
// Retained funds keep their rationale, risk ratios and details. New PMS/AIF/Unlisted/Gift entries
// take their rationale and details from their own narrative slide. New MF entries have no source
// for either — the deck's MF pages are performance grids only — so they are listed at the end.
const fs = require('fs');
const B = require('./blocklib');
const R = require('./reck_parse');
const N = require('./reck_narrative');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const HTML = flag('--html');
const SRC = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--html');
if (!SRC || !HTML) { console.error('Usage: node merge_reckoner.js "<pptx>" --html <index.html> [--apply]'); process.exit(2); }

// ---------- deck heading -> dashboard bucket ----------
const GRID = {
  'Large Cap Funds':                           ['Large Cap Funds', 'LARGE CAP FUNDS', 'mf'],
  'Large & Mid Cap Funds':                     ['Large&Mid and Flexi', 'DIVERSIFIED EQUITY FUNDS', 'mf'],
  'Flexi Cap Funds':                           ['Large&Mid and Flexi', 'DIVERSIFIED EQUITY FUNDS', 'mf'],
  'Multi Cap Funds':                           ['Multi Cap and Focused', 'DIVERSIFIED EQUITY FUNDS', 'mf'],
  'Focused Funds':                             ['Multi Cap and Focused', 'DIVERSIFIED EQUITY FUNDS', 'mf'],
  'Midcap Fund':                               ['Mid Cap Funds', 'MID CAP FUNDS', 'mf'],
  'Small Cap Funds':                           ['Small Cap Funds', 'SMALL CAP FUNDS', 'mf'],
  'ELSS Funds':                                ['ELSS', 'ELSS FUNDS', 'mf'],
  'Sectoral':                                  ['@SECTORAL_SPLIT', null, 'mf'],
  'Index Funds':                               ['@SMART_BETA', null, 'mf'],
  'Ultra Short Duration Fund':                 ['Debt Ultra Short Duration Funds', 'ULTRA-SHORT DURATION FUNDS', 'mf'],
  'Low Duration Fund':                         ['Debt Low Duration Funds', 'LOW DURATION FUNDS', 'mf'],
  'Money Market Fund':                         ['Debt Money Market Funds', 'MONEY MARKET FUNDS', 'mf'],
  'Short Duration Fund':                       ['Debt Short Duration Funds', 'SHORT DURATION BONDS', 'mf'],
  'Banking and PSU Fund':                      ['Debt Banking & PSU Funds', 'BANKING & PSU FUNDS', 'mf'],
  'Corporate Bond Fund':                       ['Debt Corporate Bond Fund', 'CORPORATE BOND FUNDS', 'mf'],
  'Medium Duration Fund':                      ['Debt Medium Duration Funds', 'MEDIUM DURATION FUNDS', 'mf'],
  'Long Duration':                             ['Debt Long Duration Funds', 'INCOME/LONG DURATION FUNDS', 'mf'],
  'Dynamic Bond Fund':                         ['Debt Dynamic Bond Funds', 'DYNAMIC BOND FUNDS', 'mf'],
  'Credit Risk Fund':                          ['Debt Credit Risk Funds', 'CREDIT RISK FUNDS', 'mf'],
  'Gilt Fund with 10 Years Constant Maturity': ['Debt Gilt Funds', 'GILT FUNDS', 'mf'],
  'Balanced Advantage':                        ['BAF', 'BALANCED ADVANTAGE FUNDS', 'mf'],
  'Arbitrage Fund':                            ['Arbitrage', 'ARBITRAGE FUNDS', 'mf'],
  'Multi Asset- Equity':                       ['Multi Asset Fund', 'MULTI ASSET ALLOCATION FUNDS', 'mf'],
  'Multi Asset Fund- Debt':                    ['Multi Asset Fund', 'MULTI ASSET ALLOCATION FUNDS', 'mf'],
  'GOLD':                                      ['Commodities', 'COMMODITIES', 'mf'],
  'SILVER':                                    ['Commodities', 'COMMODITIES', 'mf'],
  'Large Cap Fund':                            ['Equity Large & Multi Cap PMS', 'LARGE & MULTI CAP PMS', 'pms'],
  'Multi Cap Fund':                            ['Equity Multi Cap PMS', 'MULTI CAP PMS', 'pms'],
  'Mid & Small Cap':                           ['Equity Mid & Small Cap PMS', 'MID & SMALL CAP PMS', 'pms'],
  'AIF (CAT III) - Listed Equity':             ['EQUITY AIFs- Listed Equities', 'EQUITY AIFs- Listed Equities', 'aif'],
};
// Deck buckets with no Select category in the dashboard — reported, never auto-added.
const OUT_OF_SCOPE = ['Overnight Fund', 'Liquid Fund', 'Floater Fund', 'Fund of Funds', 'ETF',
  'International', 'Aggressive Hybrid', 'Equity Saving', 'Conservative Hybrid', 'Dynamic Asset Allocation Fund'];
// Smart beta = a factor tilt, not a cap-weighted tracker.
const SMART_BETA = /(momentum|low\s*vol|value\s*20|alpha\s*50|equal\s*weight|quality)/i;

// Products that live on their own narrative slide instead of a performance grid; taken from the
// deck's own index pages (slides 2-4). Names here are MASTER names.
const NARRATIVE = {
  'Income Plus Arbitrage': { cat: 'INCOME PLUS ARBITRAGE', kind: 'mf', names: [
    'HDFC Income Plus Arbitrage Active FOF-Reg(G)', 'Bandhan Income Plus Arbitrage Active FOF-Reg(G)',
    'Kotak Income Plus Arbitrage Omni FOF-Reg(G)', 'ICICI Pru Income plus Arbitrage Omni FOF(G)'] },
  'Debt PMS': { cat: 'DEBT PMS', kind: 'pms', names: [
    'Neo Yield Enhancer', 'Phillip Conservative Credit Portfolio', 'Sundaram F.I.R.S.T. Debt PMS'] },
  'DEBT AIF ': { cat: 'DEBT AIFs', kind: 'aif', names: [
    'Northern Arc Money Market Alpha Fund', 'Vivriti Short Term Debt Fund ', 'Mosaic Multiyield Fund Series I',
    'UTI Structured Debt Fund IV', 'Neo Infra Income Opportunities Fund II', 'InCred Credit Opportunities Fund III '] },
  'EQUITY AIFs- Unlisted Equities': { cat: 'EQUITY AIFs- Unlisted Equities', kind: 'aif', names: [
    'InCred Growth Partners Fund II', '360 0ne Early-Stage Fund Series I ', 'Campus Fund III ',
    'ValueQuest S.C.A.L.E. Fund II '] },
  'Unlisted Equity ': { cat: 'UNLISTED EQUITIES', kind: 'unlisted', names: [
    'Orbis', 'Parag Parikh Financial Advisory Services', 'Goodluck Defence & Aerospace', 'ESDS Software Solution'] },
  'Gift City Funds': { cat: 'GIFT CITY FUNDS', kind: 'gift', names: [
    'Mirae Asset Global Asset Allocation Fund (Outbound)', 'Ashoka Whiteoak Emerging Fund (Outbound)',
    'DSP Global Equity Fund (Outbound)', 'Alchemy India Long Term Fund (Inbound)'] },
};
// Deck name -> MASTER name, where normalisation cannot bridge the gap on its own.
const PIN = {
  'ICICI Prudential Large cap':                 'ICICI Prudential Large Cap',
  'Negen Capital- Sp. Situation & Dynamic All': 'Negen Capital- Special Situation & Tech Fund',
  'Karma Capital Wealth Builder':               'Karma Capital Wealth Builder ',
  'Motilal Oswal Founders Fund*':               'Motilal Oswal Founders Fund',
  'Alchemy Long Term Ventures Fund*':           'Alchemy Long Term Ventures Fund',
  'Vedartha India Opportunities Fund I':        'Vedartha India Opportunities Fund – Series 1',
  'HDFC Multi-Asset Fund(G)':                   'HDFC Multi-Asset Allocation Fund(G)',
  'SBI Constant Maturity Fund-Reg(G)':          'SBI Constant Maturity 10 Year Gilt Fund-Reg(G)',
  // added to the universe 20-Aug-2026 by add_reckoner_funds.js; MASTER uses the AMC's own
  // one-word spelling, and the GIFT City record carries the (Inbound) suffix its peers use
  'Alf Accurate Budding Beasts PMS':             'AlfAccurate Budding Beasts PMS',
  'Motilal Oswal Alternative Investment':        'Motilal Oswal Alternative Investment (Inbound)',
};
// In the deck but with no MASTER instrument to hang the badge on. Adding one is a universe
// change — run add_reckoner_funds.js, do not let this script invent records.
const NO_MASTER_NOTE = {};

// ---------- resolve deck names against MASTER ----------
const norm = s => String(s).toLowerCase()
  .replace(/[‘’“”`']/g, '').replace(/\s*[-–—]\s*/g, ' ')
  .replace(/[().,&*]/g, ' ').replace(/\bwhiteoak\b|\bwoc\b/g, 'woc')
  .replace(/\breg\b|\bdir\b|\bg\b|\bidcw\b|\bgrowth\b|\bfund\b|\bfunds\b|\bthe\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

const S0 = B.read(HTML, 'window.CENTRICITY_SELECT = ').value;
const MASTER = B.read(HTML, 'window.MASTER = ').value;
const exact = new Set(MASTER.map(r => r.name));
const byNorm = new Map();
for (const r of MASTER) { const k = norm(r.name); if (!byNorm.has(k)) byNorm.set(k, []); byNorm.get(k).push(r.name); }
const subOf = new Map(MASTER.map(r => [r.name, r.sub_category]));

const unresolved = [];
function resolve(name) {
  if (PIN[name] && exact.has(PIN[name])) return PIN[name];
  if (exact.has(name)) return name;
  const c = byNorm.get(norm(name)) || [];
  if (c.length === 1) return c[0];
  unresolved.push(name + (c.length ? '  (ambiguous x' + c.length + ')' : '  (no MASTER record)'));
  return null;
}

// ---------- build the new membership ----------
const rows = R.parse(SRC);
const next = new Map();
const skipped = new Map();
const note = (k, v) => { if (!skipped.has(k)) skipped.set(k, []); skipped.get(k).push(v); };

for (const r of rows) {
  const h = r.heading || '';
  if (OUT_OF_SCOPE.includes(h)) { note(h, r.name); continue; }
  const g = GRID[h];
  if (!g) { note('(unmapped) ' + h, r.name); continue; }
  const m = resolve(r.name);
  if (!m) continue;
  let sheet = g[0], cat = g[1];
  const kind = g[2];
  if (sheet === '@SECTORAL_SPLIT') {
    const thematic = subOf.get(m) === 'Thematic';
    sheet = thematic ? 'Thematic Funds' : 'Sectoral Funds';
    cat = thematic ? 'THEMATIC FUNDS' : 'SECTORAL FUNDS';
  } else if (sheet === '@SMART_BETA') {
    if (!SMART_BETA.test(r.name)) { note('Index Funds (cap-weighted trackers)', r.name); continue; }
    sheet = 'Smart Beta Funds'; cat = 'SMART BETA FUNDS';
  }
  if (!next.has(m)) next.set(m, { sheet: sheet, category: cat, kind: kind, deckName: r.name });
}
for (const sheet of Object.keys(NARRATIVE)) {
  const spec = NARRATIVE[sheet];
  for (const n of spec.names) {
    const m = resolve(n);
    if (!m) continue;
    if (!next.has(m)) next.set(m, { sheet: sheet, category: spec.cat, kind: spec.kind, deckName: n });
  }
}

// ---------- narrative slides supply rationale + details for the non-MF entries ----------
const sl = N.slides(SRC);
function findSlide(deckName) {
  const toks = norm(deckName).split(' ').filter(t => t.length > 3);
  if (toks.length < 2) return null;
  let best = null, bestScore = 0;
  for (const s of sl) {
    const head = norm(s.body.slice(0, 6).join(' '));
    const hit = toks.filter(t => head.includes(t)).length;
    if (hit > bestScore) { bestScore = hit; best = s; }
  }
  return bestScore / toks.length >= 0.6 ? best : null;
}

// ---------- assemble ----------
const out = {};
const kept = [], added = [], dropped = [], noRationale = [];
for (const entry of next) {
  const m = entry[0], spec = entry[1];
  const prev = S0[m];
  if (prev) {
    out[m] = Object.assign({}, prev, { category: spec.category, sheet: spec.sheet });
    kept.push(m);
  } else {
    const e = { reckonerName: spec.deckName, category: spec.category, sheet: spec.sheet, kind: spec.kind };
    if (spec.kind !== 'mf') {
      const s = findSlide(spec.deckName);
      if (s) {
        const a = N.about(s); if (a) e.rationale = a;
        const d = N.details(s); if (d.length) e.details = d;
      }
    }
    if (!e.rationale) noRationale.push(m + '   [' + spec.category + ']');
    out[m] = e;
    added.push(m + '   [' + spec.category + ']');
  }
}
for (const k of Object.keys(S0)) if (!next.has(k)) dropped.push(k + '   [' + S0[k].category + ']');

// ---------- report ----------
console.log('CENTRICITY_SELECT ' + Object.keys(S0).length + ' -> ' + Object.keys(out).length +
  '   (+' + added.length + ' added, -' + dropped.length + ' dropped, ' + kept.length + ' retained)');
const badKeys = Object.keys(out).filter(k => !exact.has(k));
console.log('\nGATE every key exists in MASTER: ' + (badKeys.length ? '*** ' + badKeys.join(' | ') : 'PASS'));
console.log('GATE rationale present: ' + Object.values(out).filter(v => v.rationale).length + '/' + Object.keys(out).length);
const cats = {}; Object.values(out).forEach(v => { cats[v.category] = (cats[v.category] || 0) + 1; });
console.log('GATE categories: ' + Object.keys(cats).length + ' (was 33)');

console.log('\n================ ADDED ================');
added.sort().forEach(a => console.log('  + ' + a));
console.log('\n================ DROPPED (not in the August Reckoner) ================');
dropped.sort().forEach(d => console.log('  - ' + d));
if (unresolved.length) {
  console.log('\n================ DECK NAMES WITH NO MASTER MATCH ================');
  [...new Set(unresolved)].forEach(u => {
    console.log('  ! ' + u);
    const n = Object.keys(NO_MASTER_NOTE).find(k => u.indexOf(k) === 0);
    if (n) console.log('      ' + NO_MASTER_NOTE[n]);
  });
}
console.log('\n================ NEW ENTRIES WITH NO RATIONALE ================');
noRationale.sort().forEach(n => console.log('  ? ' + n));
console.log('\n================ DECK BUCKETS THE DASHBOARD HAS NO SELECT CATEGORY FOR ================');
for (const pair of skipped) console.log('  [' + pair[0] + ']  ' + pair[1].length + ': ' + pair[1].slice(0, 4).join(', ') + (pair[1].length > 4 ? ', …' : ''));
console.log('\ncounts per category:');
Object.keys(cats).sort().forEach(c => console.log('   ' + String(cats[c]).padStart(3) + '  ' + c));

if (!APPLY) { console.log('\n[dry run] pass --apply to write'); process.exit(0); }
if (badKeys.length) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }
const bytes = B.writeBlocks(HTML, [{ prefix: 'window.CENTRICITY_SELECT = ', value: out }]);
console.log('\nWROTE ' + HTML + ' — ' + bytes + ' bytes');
