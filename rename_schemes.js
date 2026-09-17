// SEBI scheme-name standardisation (first seen in the Aug-2026 Monitor): AMCs renamed ~210
// existing schemes — "Flexicap"→"Flexi Cap", "Low Duration"→"Ultra Short to Short Term",
// "Dynamic Bond"→"Dynamic Term", "Equity & Debt"→"Aggressive Hybrid", and so on.
//
// RUN THIS BEFORE bake_month.js. The bake matches by name, so on a renamed scheme it would
// append a SECOND record under the new name and leave the old one behind carrying last month's
// returns — ~210 duplicate funds in a client-facing pick list, half of them stale.
//
// Identity is INCEPTION DATE + AMC, never the scheme name — the name is exactly what changed.
// A tie (same AMC, same inception, two schemes) is broken by the monitor sheet's own taxonomy
// against the record's sub_category; anything still ambiguous is REPORTED, never guessed.
//
//   node rename_schemes.js --monitor "<Daily MF Monitor ....xlsx>" [--html <p>] [--apply]
//
// Renames every store keyed by fund name: MASTER, EQUITY/HYBRID/DEBT_ANALYTICS, DIRECT_PERF,
// RISK_MATRIX and CENTRICITY_SELECT. Re-running is a no-op (the old names are gone by then).
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const blocklib = require('./blocklib.js');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const MON = flag('--monitor');
const HTML = flag('--html') || path.join(__dirname, 'index.html');
if (!MON || !fs.existsSync(MON)) {
  console.error('Usage: node rename_schemes.js --monitor "<Daily MF Monitor ....xlsx>" [--html <p>] [--apply]');
  process.exit(2);
}

// ---------- the monitor's own taxonomy, mirrored from index.html's SHEET_MAP ----------
// Only the sub-category is needed here (the tie-break), so this is the third element alone.
const SHEET_SUB = {
  'Large Cap Fund': 'Large Cap', 'Large & Mid Cap': 'Large & Mid Cap', 'Flexi Cap Fund': 'Flexi Cap',
  'Multi Cap Fund': 'Multi Cap', 'Focused Fund': 'Focused', 'Mid Cap Fund': 'Mid Cap',
  'Small cap Fund': 'Small Cap', 'Value Fund': 'Value / Contra', 'Thematic Fund': 'Thematic',
  'Contra': 'Value / Contra', 'Dividend Yield': 'Dividend Yield', 'Sector': 'Sectoral',
  'Equity Linked Savings Scheme': 'ELSS', 'Index': 'Index Fund', 'Equity Oriented': 'Equity ETF',
  'Global': 'International', 'Overnight Fund': 'Overnight', 'Liquid': 'Liquid',
  'Ultra Short Duration': 'Ultra Short Duration', 'Low Duration': 'Low Duration',
  'Money Market': 'Money Market', 'Short Duration': 'Short Duration',
  'Banking and PSU Fund': 'Banking & PSU', 'Corporate Bond': 'Corporate Bond',
  'Dynamic Bond': 'Dynamic Bond', 'Floating Rate': 'Floating Rate', 'Short & Mid Term': 'Short & Mid Term',
  'Medium Duration': 'Medium Duration', 'Medium to Long Duration': 'Medium to Long Duration',
  'Long Duration': 'Long Duration', 'Credit Risk Fund': 'Credit Risk',
  'Gilt Fund with 10 year constan': 'Gilt 10Y', 'Debt Oriented': 'Debt ETF', 'Debt': 'Gilt',
  'Arbitrage Fund': 'Arbitrage', 'Equity Savings': 'Equity Savings',
  'Conservative Hybrid Fund': 'Conservative Hybrid', 'Balanced Advantage': 'Balanced Advantage',
  'Dynamic Asset Allocation': 'Dynamic Asset Allocation', 'Multi Asset Allocation': 'Multi Asset Allocation',
  'Aggressive Hybrid Fund': 'Aggressive Hybrid', 'Silver': 'Silver', 'Gold': 'Gold',
};

// ---------- read the monitor ----------
const wb = XLSX.readFile(MON, { cellDates: true });
const cv = (sh, r, c) => { const x = sh[XLSX.utils.encode_cell({ r, c })]; return x ? x.v : null; };
const mon = [];
for (const sn of wb.SheetNames) {
  const sh = wb.Sheets[sn]; if (!sh || !sh['!ref']) continue;
  const rg = XLSX.utils.decode_range(sh['!ref']);
  let HR = -1;
  for (let rr = rg.s.r; rr <= Math.min(rg.s.r + 25, rg.e.r); rr++) {
    const c0 = cv(sh, rr, 0);
    if (c0 && String(c0).trim().toLowerCase() === 'scheme name') { HR = rr; break; }
  }
  if (HR < 0) continue;                       // benchmark-only or nav sheet
  const hdr = [];
  for (let c = rg.s.c; c <= rg.e.c; c++) { const v = cv(sh, HR, c); hdr.push(v != null ? String(v).trim() : ''); }
  const ic = hdr.indexOf('Inception Date');
  for (let r = HR + 1; r <= rg.e.r; r++) {
    const raw = cv(sh, r, 0); if (raw == null || raw === '') continue;
    const nm = String(raw).trim(), low = nm.toLowerCase();
    if (low === 'average' || low.startsWith('benchmark')) break;
    const aum = cv(sh, r, 1); if (aum == null || aum === '' || isNaN(Number(aum))) continue;
    let inc = null;
    if (ic >= 0) { const v = cv(sh, r, ic); if (v instanceof Date && !isNaN(v)) inc = v.toISOString().slice(0, 10); else if (v) inc = String(v).slice(0, 10); }
    mon.push({ name: nm, sheet: sn, sub: SHEET_SUB[sn] || null, inception: inc });
  }
}
console.log(`monitor        : ${path.basename(MON)}  (${mon.length} fund rows)`);

// ---------- name normalisation that survives the tidy-up ----------
// Drops plan suffixes and treats "&" / the word "and" as nothing, so "Large and Mid Cap",
// "Large & Midcap" and "Large & Mid Cap" all collapse to the same key.
const PLAN = /(\(g\)|\(idcw\)|\(d\)|\(growth\)|\(dividend\)|-reg\b|-dir\b|-direct plan|direct plan)/g;
const norm = s => String(s || '').toLowerCase().replace(/ /g, ' ').replace(PLAN, ' ')
  .replace(/&/g, ' ').replace(/\band\b/g, ' ').replace(/[^a-z0-9]+/g, '');

// AMC = the leading brand words. Multi-word houses are listed; everything else is its first
// word. A wrong guess here can only make a pair ambiguous or unmatched — never mis-joined.
const MULTI = ['aditya birla sl', 'bank of india', 'baroda bnp paribas', 'canara rob', 'franklin india',
  'invesco india', 'lic mf', 'mahindra manulife', 'mirae asset', 'nippon india', 'motilal oswal',
  'icici pru', 'the wealth company', 'bajaj finserv', '360 one', 'pgim india', 'whiteoak capital'];
function amc(nameRaw) {
  const s = String(nameRaw || '').toLowerCase().replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  for (const m of MULTI) if (s.startsWith(m)) return m.replace(/[^a-z0-9]/g, '');
  return s.split(' ')[0].replace(/[^a-z0-9]/g, '');
}

// ---------- load the page's blocks ----------
let html = fs.readFileSync(HTML, 'utf8');
const master = blocklib.locate(html, 'window.MASTER = ').value;
const MF = f => /Mutual Fund|ETF|Index Fund/i.test(f.product_class || '');
const mfRecs = master.filter(MF);
const masterNames = new Set(master.map(f => f.name));
const monNames = new Set(mon.map(m => m.name));

const byNorm = new Map(), byInc = new Map();
for (const f of mfRecs) {
  const k = norm(f.name); if (!byNorm.has(k)) byNorm.set(k, []); byNorm.get(k).push(f);
  if (!f.inception) continue;
  const i = String(f.inception).slice(0, 10);
  if (!byInc.has(i)) byInc.set(i, []); byInc.get(i).push(f);
}

// ---------- build the map ----------
// A MASTER record still present in the monitor under its own name is never a rename target.
const claimed = new Set(), seen = new Set();
const renames = [], ambiguous = [], fresh = [], leftover = [];
for (const m of mon) {
  if (seen.has(m.name)) continue; seen.add(m.name);
  if (masterNames.has(m.name)) continue;                    // unchanged this month
  const free = f => !monNames.has(f.name) && !claimed.has(f.name);

  const nh = (byNorm.get(norm(m.name)) || []).filter(free);
  if (nh.length === 1) { renames.push({ from: nh[0].name, to: m.name, how: 'name', sub: nh[0].sub_category }); claimed.add(nh[0].name); continue; }

  let cands = (byInc.get(m.inception) || []).filter(f => free(f) && amc(f.name) === amc(m.name));
  if (cands.length > 1 && m.sub) {
    // Two schemes of one AMC launched the same day: the monitor sheet says which is which.
    const narrowed = cands.filter(f => f.sub_category === m.sub);
    if (narrowed.length === 1) cands = narrowed;
  }
  if (cands.length === 1) { renames.push({ from: cands[0].name, to: m.name, how: 'inception', sub: cands[0].sub_category }); claimed.add(cands[0].name); }
  else if (cands.length > 1) ambiguous.push({ to: m.name, inception: m.inception, sheet: m.sheet, from: cands.map(c => c.name) });
  else leftover.push(m);
}

// ---- tier 3: one-to-one inside an (AMC, category) cell ----------------------------------
// Aug-2026: JioBlackRock renamed "Low Duration" -> "Ultra Short to Short Term" AND moved from
// direct-only to a Regular plan in the same month, so the name matched nothing and the monitor's
// inception (the Regular plan's launch, 2026-08-16) matched nothing either. But the AMC had
// exactly one unmatched scheme in that category on each side, which settles it.
// Deliberately strict: it fires only on 1-to-1, so a house launching a second fund in a category
// it also renamed falls through to "new" rather than being paired off by guesswork.
const cell = (a, s) => a + ' ' + s;
const freeOld = mfRecs.filter(f => !monNames.has(f.name) && !claimed.has(f.name));
const oldByCell = new Map(), newByCell = new Map();
for (const f of freeOld) { const k = cell(amc(f.name), f.sub_category); if (!oldByCell.has(k)) oldByCell.set(k, []); oldByCell.get(k).push(f); }
for (const m of leftover) { if (!m.sub) continue; const k = cell(amc(m.name), m.sub); if (!newByCell.has(k)) newByCell.set(k, []); newByCell.get(k).push(m); }
const pairedByCell = new Set();
for (const [k, news] of newByCell) {
  const olds = oldByCell.get(k);
  if (!olds || olds.length !== 1 || news.length !== 1) continue;
  renames.push({ from: olds[0].name, to: news[0].name, how: 'category', sub: olds[0].sub_category });
  claimed.add(olds[0].name);
  pairedByCell.add(news[0].name);
}
for (const m of leftover) if (!pairedByCell.has(m.name)) fresh.push(m);

// Renames already applied in an earlier run are recoverable from `prev_name`, so a second run
// still reaches anything the first one missed (a sibling added later, say) instead of finding
// the old names gone and quietly doing nothing.
const priorMap = new Map();
for (const f of master) if (f.prev_name && f.prev_name !== f.name) priorMap.set(f.prev_name, f.name);
if (priorMap.size) console.log(`already renamed: ${priorMap.size} (from prev_name — will be re-applied to the siblings)`);

console.log(`renames        : ${renames.length}  (${renames.filter(r => r.how === 'name').length} by name, ${renames.filter(r => r.how === 'inception').length} by inception+AMC, ${renames.filter(r => r.how === 'category').length} by AMC+category 1-to-1)`);
console.log(`ambiguous      : ${ambiguous.length}`);
console.log(`new to MASTER  : ${fresh.length}   (left for bake_month.js to add)\n`);
for (const r of renames) console.log(`   ${r.from}   ->   ${r.to}      [${r.sub} · ${r.how}]`);
if (ambiguous.length) {
  console.log('\n*** AMBIGUOUS — not renamed, resolve by hand: ***');
  for (const a of ambiguous) console.log(`   ${a.to}  [inc ${a.inception} · ${a.sheet}]  <-  ${JSON.stringify(a.from)}`);
}

// ---------- gates ----------
const fromSet = new Set(renames.map(r => r.from));
const toSet = new Set(renames.map(r => r.to));
if (fromSet.size !== renames.length) { console.error('\n*** a MASTER name is renamed twice — aborting'); process.exit(1); }
if (toSet.size !== renames.length) { console.error('\n*** two MASTER names map to one new name — aborting'); process.exit(1); }
for (const r of renames) {
  if (masterNames.has(r.to)) { console.error(`\n*** "${r.to}" already exists in MASTER — renaming "${r.from}" onto it would collide. Aborting.`); process.exit(1); }
}
console.log('\nGATE unique from/to: PASS');
console.log(`GATE no collision with an existing MASTER name: PASS`);

if (!renames.length && !priorMap.size) { console.log('\nnothing to rename.'); process.exit(0); }

// ---------- apply ----------
const map = new Map([...priorMap, ...renames.map(r => [r.from, r.to])]);
let hits = { MASTER: 0 };
for (const f of master) {
  const t = map.get(f.name);
  // `prev_name` keeps the pre-SEBI name resolvable: an allocation sheet saved last month, or a
  // hand-typed name off an older proposal, still lands on the right instrument. H.buildFundIndex
  // indexes it behind the live name, so a current name always wins.
  if (t) { f.prev_name = f.name; f.name = t; hits.MASTER++; }
}

const updates = [{ prefix: 'window.MASTER = ', value: master }];
for (const prefix of ['window.EQUITY_ANALYTICS = ', 'window.HYBRID_ANALYTICS = ', 'window.DEBT_ANALYTICS = ',
                      'window.DIRECT_PERF = ', 'window.RISK_MATRIX = ', 'window.CENTRICITY_SELECT = ']) {
  let store;
  try { store = blocklib.locate(html, prefix).value; } catch (e) { console.log(`   (skipped ${prefix.trim()} — ${e.message})`); continue; }
  const label = prefix.replace('window.', '').replace(' = ', '');
  let n = 0;
  const out = {};
  for (const k of Object.keys(store)) {
    const t = map.get(k);
    // A key the rename would overwrite is left alone: the newer entry wins and the stale one
    // is dropped, which is what a merge means here.
    if (t && !(t in store)) { out[t] = store[k]; n++; } else out[k] = store[k];
  }
  hits[label] = n;
  updates.push({ prefix, value: out });
}
console.log('\nkeys renamed per store:', JSON.stringify(hits));

const dupes = master.map(f => f.name).filter((n, i, a) => a.indexOf(n) !== i);
console.log(`GATE duplicate MASTER names after rename: ${dupes.length ? 'FAIL ' + JSON.stringify(dupes.slice(0, 8)) : 'PASS (0)'}`);
if (dupes.length) process.exit(1);

// ---------- the siblings ----------
// These re-apply themselves on EVERY page load, keyed by exact MASTER name. Left un-renamed,
// Centricity_IRR_Offshore.js would silently stop matching 215 funds and they would lose their
// Expected-IRR band — which drives the proposal's future-value projection.
const SIBLINGS = [
  { file: 'Centricity_IRR_Offshore.js', prefix: 'var IRR = ' },
];
const sibWrites = [];
for (const s of SIBLINGS) {
  const p = path.join(path.dirname(HTML), s.file);
  if (!fs.existsSync(p)) { console.log(`   (skipped ${s.file} — not found)`); continue; }
  let store;
  try { store = blocklib.read(p, s.prefix).value; } catch (e) { console.log(`   (skipped ${s.file} — ${e.message})`); continue; }
  let n = 0;
  const out = {};
  for (const k of Object.keys(store)) {
    const t = map.get(k);
    if (t && !(t in store)) { out[t] = store[k]; n++; } else out[k] = store[k];
  }
  console.log(`${s.file} :: ${s.prefix.trim()} — ${n} key(s) renamed of ${Object.keys(store).length}`);
  sibWrites.push({ p, file: s.file, updates: [{ prefix: s.prefix, value: out }] });
}

if (!APPLY) { console.log('\n[dry run] pass --apply to write ' + path.basename(HTML) + ' + siblings'); process.exit(0); }
const size = blocklib.writeBlocks(HTML, updates);
console.log(`\nwrote ${path.basename(HTML)} (${size} bytes)`);
for (const w of sibWrites) console.log(`wrote ${w.file} (${blocklib.writeBlocks(w.p, w.updates)} bytes)`);
