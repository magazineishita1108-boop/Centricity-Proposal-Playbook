// Five funds sit in MASTER TWICE under two spellings, each copy carrying DIFFERENT returns, so a
// proposal picks up whichever row the user happens to click. They pre-date the Aug-2026 SEBI
// rename (all ten names are in index.html.bak_aug_20260917) — `rename_schemes.js` did not create
// them and cannot fix them: it only pairs a MASTER name against a monitor name the monitor still
// carries, and here BOTH spellings are already in MASTER, so every name-keyed gate sees two
// distinct funds and passes. Logged as open item 8 in CLAUDE.md.
//
//   node fold_duplicate_names.js --monitor "<Daily MF Monitor ....xlsx>" [--html <p>] [--apply]
//
// WHICH ROW WINS IS NOT A JUDGEMENT CALL — THE MONITOR DECIDES. The pair list below says which
// two names to consider; the monitor says which of the two is the live instrument. Whatever the
// monitor carries is what next month's bake will keep re-creating, so the other one can only ever
// be an orphan freezing last month's returns. The tool refuses rather than guesses when the
// monitor carries both spellings (two genuinely different funds) or neither (can't tell).
//
// The orphan is FOLDED, not merely deleted:
//   - house/static fields the survivor lacks are carried over (the Expected-IRR band above all —
//     it drives the FV projection and none of the five survivors has one);
//   - name-keyed store entries move to the survivor's name where the survivor has none of its own;
//   - `prev_name` on the survivor records the dropped spelling, so an allocation sheet or proposal
//     saved against the old name still resolves (H.buildFundIndex indexes prev_name in a second
//     pass, behind the live name).
//
// Re-running is a no-op: once an orphan is out of MASTER its pair reports "already folded".
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
  console.error('Usage: node fold_duplicate_names.js --monitor "<Daily MF Monitor ....xlsx>" [--html <p>] [--apply]');
  process.exit(2);
}

// ---------- the pairs ----------
// Maintained BY HAND, never derived. A near-miss between two scheme names is not evidence that
// they are one fund — "HDFC Mid Cap" and "HDFC Small Cap" are one token apart. Each entry here
// was confirmed against the monitor: same AMC, same sub-category, inception one day apart (the
// monitor's inception runs a day behind MASTER's stored value for these records), and exactly one
// of the two spellings still quoted. Order within the pair is irrelevant — the monitor picks.
const PAIRS = [
  ['ITI Multi-Cap Fund-Reg(G)',            'ITI Multi Cap Fund-Reg(G)'],
  ['Quantum Nifty 50 ETF FoF-Reg(G)',      'Quantum Nifty 50 ETF FOF-Reg(G)'],
  ['ITI Ultra Short Duration Fund-Reg(G)', 'ITI Ultra Short Term Fund-Reg(G)'],
  ['ITI Dynamic Bond Fund-Reg(G)',         'ITI Dynamic Term Fund-Reg(G)'],
  ['Quantum Dynamic Bond Fund-Reg(G)',     'Quantum Dynamic Term Fund-Reg(G)'],
];

// House/static fields only. A field the monitor refreshes every cycle is DELIBERATELY absent:
// the orphan is by definition the row the monitor stopped quoting, so its returns, AUM, TER, YTM
// and duration are stale and the survivor's are current. The m-cap split is excluded for the
// separate reason that it is atomic — merging a partial split across two sources is what produced
// a set summing to 108% in the July Direct merge. `inception` is excluded too: the survivor's
// comes from the monitor, and rename_schemes.js identifies a scheme by inception+AMC, so
// overwriting it with MASTER's day-later value would break next month's rename matching.
const CARRY = ['exit_load', 'fund_mgr', 'bond_issuer', 'bond_rating'];

// ---------- read the monitor ----------
// Same sheet walk as rename_schemes.js: find the 'Scheme Name' header row, stop at the footer.
const wb = XLSX.readFile(MON, { cellDates: true });
const cv = (sh, r, c) => { const x = sh[XLSX.utils.encode_cell({ r, c })]; return x ? x.v : null; };
const monInc = new Map(), monSheet = new Map();
let monRows = 0;
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
    monRows++;
    if (monInc.has(nm)) continue;             // a scheme can be quoted on two sheets (the Quantum
    let inc = null;                           // FoF is on both Equity Oriented and Debt Oriented)
    if (ic >= 0) { const v = cv(sh, r, ic); if (v instanceof Date && !isNaN(v)) inc = v.toISOString().slice(0, 10); else if (v) inc = String(v).slice(0, 10); }
    monInc.set(nm, inc); monSheet.set(nm, sn);
  }
}
console.log(`monitor        : ${path.basename(MON)}  (${monRows} fund rows, ${monInc.size} distinct names)`);

// ---------- load the page ----------
const html = fs.readFileSync(HTML, 'utf8');
const master = blocklib.locate(html, 'window.MASTER = ').value;
console.log(`${path.basename(HTML)}     : MASTER baseline ${master.length}\n`);
const idxOf = nm => { const out = []; master.forEach((f, i) => { if (f.name === nm) out.push(i); }); return out; };

// ---------- decide each pair ----------
const folds = [], skipped = [];
let abort = false;
for (const [a, b] of PAIRS) {
  const ia = idxOf(a), ib = idxOf(b);
  const inMon = [a, b].filter(n => monInc.has(n));

  // idempotency: one side already gone means an earlier run folded this pair
  if (ia.length === 0 || ib.length === 0) {
    if (ia.length === 0 && ib.length === 0) { skipped.push(`${a} / ${b} — NEITHER in MASTER, nothing to do`); continue; }
    const gone = ia.length === 0 ? a : b, kept = ia.length === 0 ? b : a;
    const rec = master[(ia.length === 0 ? ib : ia)[0]];
    skipped.push(`${kept} — already folded${rec.prev_name === gone ? ` (prev_name = "${gone}")` : `  *** but prev_name is ${JSON.stringify(rec.prev_name)}, expected "${gone}"`}`);
    continue;
  }
  if (ia.length > 1 || ib.length > 1) {
    console.error(`*** "${ia.length > 1 ? a : b}" appears ${Math.max(ia.length, ib.length)}x in MASTER — a literal duplicate, not this tool's job. Aborting.`);
    abort = true; continue;
  }
  if (inMon.length !== 1) {
    console.error(`*** the monitor carries ${inMon.length === 0 ? 'NEITHER' : 'BOTH'} of "${a}" / "${b}" — cannot tell which is live. Not folding this pair.`);
    abort = true; continue;
  }

  const survivorName = inMon[0], orphanName = survivorName === a ? b : a;
  const survivor = master[idxOf(survivorName)[0]], orphan = master[idxOf(orphanName)[0]];

  // The pair must be the same instrument in the taxonomy, or the pair list is wrong.
  for (const k of ['asset_class', 'product_class', 'sub_category']) {
    if (survivor[k] !== orphan[k]) {
      console.error(`*** "${survivorName}" and "${orphanName}" disagree on ${k} (${JSON.stringify(survivor[k])} vs ${JSON.stringify(orphan[k])}) — not one fund. Aborting.`);
      abort = true;
    }
  }
  // The survivor should be the monitor-driven record: its stored inception must match the
  // monitor's. Reported rather than fatal — the known artefact is the orphan sitting one day
  // later, and it is the survivor's value that has to agree with the monitor.
  const mi = monInc.get(survivorName);
  const si = survivor.inception ? String(survivor.inception).slice(0, 10) : null;
  const incNote = si === mi ? 'matches monitor' : `*** survivor inception ${si} != monitor ${mi}`;

  if (survivor.prev_name && survivor.prev_name !== orphanName) {
    console.error(`*** "${survivorName}" already carries prev_name ${JSON.stringify(survivor.prev_name)}; overwriting it would strand that alias. Aborting.`);
    abort = true;
  }
  folds.push({ survivorName, orphanName, survivor, orphan, incNote, monSheet: monSheet.get(survivorName), monInc: mi, orphanInc: orphan.inception });
}

for (const s of skipped) console.log(`   skip  ${s}`);
if (abort) { console.error('\naborted — nothing written.'); process.exit(1); }
if (!folds.length) { console.log('\nnothing to fold.'); process.exit(0); }

// ---------- what gets carried ----------
console.log(`\nfolds          : ${folds.length}\n`);
for (const F of folds) {
  console.log(`  KEEP  ${F.survivorName}`);
  console.log(`  DROP  ${F.orphanName}`);
  console.log(`        monitor sheet "${F.monSheet}" · inception ${F.monInc} (${F.incNote}) · orphan inception ${F.orphanInc}`);
  console.log(`        r1y  survivor ${F.survivor.r1y}   orphan ${F.orphan.r1y}   (orphan's is stale — the monitor stopped quoting that name)`);

  // The IRR band is one range: carry both ends or neither, never half.
  F.carried = [];
  if (F.survivor.irr_low == null && F.survivor.irr_high == null && F.orphan.irr_low != null && F.orphan.irr_high != null) {
    F.carried.push(['irr_low', F.orphan.irr_low], ['irr_high', F.orphan.irr_high]);
  }
  for (const k of CARRY) {
    if (F.survivor[k] == null && F.orphan[k] != null) F.carried.push([k, F.orphan[k]]);
  }
  console.log(`        carry over : ${F.carried.length ? F.carried.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('  ') : '(survivor already complete)'}`);
  console.log(`        prev_name  : "${F.orphanName}"\n`);
}

// ---------- apply to MASTER ----------
const orphanNames = new Set(folds.map(f => f.orphanName));
for (const F of folds) {
  for (const [k, v] of F.carried) F.survivor[k] = v;
  F.survivor.prev_name = F.orphanName;
}
const kept = master.filter(f => !orphanNames.has(f.name));

// ---------- re-key the name-keyed stores ----------
// Move the orphan's entry onto the survivor's name only where the survivor has none of its own.
// Where both hold an entry the survivor's is the current one (this month's bake wrote it under
// the monitor's spelling) and the orphan's is last month's under a name the source has dropped —
// so it goes. Same rule as rename_schemes.js: the newer entry wins, the stale one is discarded.
const STORES = ['window.EQUITY_ANALYTICS = ', 'window.HYBRID_ANALYTICS = ', 'window.DEBT_ANALYTICS = ',
                'window.DIRECT_PERF = ', 'window.RISK_MATRIX = ', 'window.CENTRICITY_SELECT = '];
const updates = [{ prefix: 'window.MASTER = ', value: kept }];
console.log('name-keyed stores:');
function rekey(store, label) {
  const moved = [], dropped = [];
  const out = {};
  for (const k of Object.keys(store)) {
    const F = folds.find(f => f.orphanName === k);
    if (!F) { out[k] = store[k]; continue; }
    if (F.survivorName in store) { dropped.push(k); }          // survivor's own entry is current
    else { out[F.survivorName] = store[k]; moved.push(k); }
  }
  const before = Object.keys(store).length, after = Object.keys(out).length;
  console.log(`  ${label.padEnd(18)} ${before} -> ${after}   moved ${moved.length}${moved.length ? ' [' + moved.join(', ') + ']' : ''}   dropped-as-stale ${dropped.length}${dropped.length ? ' [' + dropped.join(', ') + ']' : ''}`);
  if (after !== before - dropped.length) throw new Error(`${label}: key count does not reconcile`);
  return out;
}
for (const prefix of STORES) {
  let store;
  try { store = blocklib.locate(html, prefix).value; } catch (e) { console.log(`  (skipped ${prefix.trim()} — ${e.message})`); continue; }
  updates.push({ prefix, value: rekey(store, prefix.replace('window.', '').replace(' = ', '')) });
}

// ---------- the sibling ----------
// Centricity_IRR_Offshore.js re-applies `IRR[f.name] -> irr_low/irr_high` on EVERY page load,
// keyed by exact MASTER name. All five bands live there under the ORPHAN spelling, so left
// un-rekeyed the five survivors would show no Expected-IRR band and so no FV projection —
// the same failure rename_schemes.js guards against for its 215 renames.
const SIBLINGS = [{ file: 'Centricity_IRR_Offshore.js', prefix: 'var IRR = ' }];
const sibWrites = [];
console.log('\nsiblings:');
for (const s of SIBLINGS) {
  const p = path.join(path.dirname(HTML), s.file);
  if (!fs.existsSync(p)) { console.log(`  (skipped ${s.file} — not found)`); continue; }
  let store;
  try { store = blocklib.read(p, s.prefix).value; } catch (e) { console.log(`  (skipped ${s.file} — ${e.message})`); continue; }
  const out = rekey(store, `${s.file} ${s.prefix.trim()}`);
  sibWrites.push({ p, file: s.file, updates: [{ prefix: s.prefix, value: out }] });
}

// ---------- gates ----------
console.log('\ngates:');
let fail = 0;
const gate = (ok, msg) => { console.log(`  ${ok ? 'PASS' : '*** FAIL'}  ${msg}`); if (!ok) fail++; };

gate(kept.length === master.length - folds.length,
     `MASTER ${master.length} -> ${kept.length} (expected -${folds.length})`);
const keptNames = kept.map(f => f.name);
const dupes = keptNames.filter((n, i) => keptNames.indexOf(n) !== i);
gate(dupes.length === 0, `0 duplicate MASTER names${dupes.length ? ' — ' + JSON.stringify(dupes.slice(0, 8)) : ''}`);
gate(folds.every(F => keptNames.filter(n => n === F.survivorName).length === 1), 'every survivor present exactly once');
gate(folds.every(F => !keptNames.includes(F.orphanName)), 'every orphan gone from MASTER');
gate(folds.every(F => F.survivor.prev_name === F.orphanName), 'every survivor carries prev_name = the dropped name');
// A survivor must not come out of this worse off on the one field that drives the projection.
const noIrr = folds.filter(F => F.survivor.irr_low == null || F.survivor.irr_high == null);
gate(noIrr.length === 0, `every survivor has an Expected-IRR band${noIrr.length ? ' — missing: ' + JSON.stringify(noIrr.map(F => F.survivorName)) : ''}`);
const irrSib = sibWrites.length ? sibWrites[0].updates[0].value : null;
if (irrSib) {
  gate(folds.every(F => !(F.orphanName in irrSib)), 'no orphan name left in the IRR sibling');
  // The sibling overwrites irr_low/irr_high on every load, so what it holds for the survivor is
  // what the browser will actually show — it has to agree with what was just written to MASTER.
  const bad = folds.filter(F => irrSib[F.survivorName] &&
    (irrSib[F.survivorName][0] !== F.survivor.irr_low || irrSib[F.survivorName][1] !== F.survivor.irr_high));
  gate(bad.length === 0, `IRR sibling agrees with MASTER's band for every survivor${bad.length ? ' — ' + JSON.stringify(bad.map(F => F.survivorName)) : ''}`);
}

if (fail) { console.error('\naborted — nothing written.'); process.exit(1); }

// Informational: the unloaded build artefact. No <script src> points at it (CLAUDE.md), so a
// stale name in there cannot reach the browser — but build_risk_matrix.py would re-emit it.
const artefact = path.join(path.dirname(HTML), 'Centricity_Risk_Matrix.js');
if (fs.existsSync(artefact)) {
  const src = fs.readFileSync(artefact, 'utf8');
  const hits = folds.filter(F => src.includes(F.orphanName)).map(F => F.orphanName);
  if (hits.length) console.log(`\nnote: Centricity_Risk_Matrix.js (NOT loaded — build artefact only) still names ${JSON.stringify(hits)}`);
}

if (!APPLY) { console.log(`\n[dry run] pass --apply to write ${path.basename(HTML)}${sibWrites.length ? ' + ' + sibWrites.map(w => w.file).join(', ') : ''}`); process.exit(0); }
const size = blocklib.writeBlocks(HTML, updates);
console.log(`\nwrote ${path.basename(HTML)} (${size} bytes)`);
for (const w of sibWrites) console.log(`wrote ${w.file} (${blocklib.writeBlocks(w.p, w.updates)} bytes)`);
