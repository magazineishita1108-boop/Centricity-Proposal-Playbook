// PERIODIC: replace one Bonds desk sub-list in window.MASTER from a Bond List workbook.
// Set DESK below to the sub_category being refreshed ("Invictus" / "OneDigital"); every other
// desk is left byte-for-byte alone and a gate enforces that.
//
//   node merge_bond_list.js "<Bond List_<date>.xlsx>"            # dry run
//   node merge_bond_list.js "<Bond List_<date>.xlsx>" --apply    # writes index.html
//   ... [--html <path>]   defaults to index.html beside this script
//
// Expected sheet layout (row 1-2 are a two-tier merged header, data from row 3):
//   B Issuer | C Rating | D/E Expected Pre Tax IRR (low/high) | F Maturity Date | H Residual Tenor
//
// Things this handles, because the source has done all of them:
//  - The maturity CELL has a recurring century typo (2030 stored as 1930). The date embedded in
//    the issuer NAME wins; any disagreement between the two is reported.
//  - The same bond is listed twice in different formats ("7.7942 L&T FINANCE LIMITED 27JUN2031"
//    and "7.7942% L& T Finance 2031"), sometimes with the coupon omitted entirely
//    ("NAVI FINSERV 31.08.2029"). Rows are deduped on issuer + maturity, and the best-formed
//    name is kept. Same issuer and maturity but genuinely different coupons stay separate.
//  - Ratings arrive as "Sov" or "SOV"; both normalise to "SOV", which is what DEBT_ANALYTICS
//    holdings use, so the credit-quality chart does not split into two sovereign slices.
//
// Requires SheetJS: npm install xlsx@0.18.5. Back up index.html first.
// 06-Aug-2026 run: 39 rows -> 36 unique bonds, Invictus 14 -> 36, MASTER 7452 -> 7474.
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const argv = process.argv.slice(2);
let APPLY = false, SRC = null, HTML = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--apply') { APPLY = true; continue; }
  if (a === '--html') { HTML = argv[++i] || null; continue; }
  if (a.startsWith('--')) { console.error('unknown flag: ' + a); process.exit(2); }
  if (SRC === null) SRC = a;
}
HTML = HTML || path.join(__dirname, 'index.html');
if (!SRC || !fs.existsSync(SRC)) { console.error('Usage: node merge_bond_list.js "<Bond List.xlsx>" [--apply] [--html <index.html>]'); process.exit(2); }
if (!fs.existsSync(HTML)) { console.error('*** index.html not found: ' + HTML); process.exit(2); }

// Which Bonds sub_category this workbook represents. Every other desk is left untouched.
const DESK = 'Invictus';
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const clean = s => String(s == null ? '' : s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const serialToDate = n => new Date(Date.UTC(1899, 11, 30) + Number(n) * 86400000);
const fmtDate = d => `${d.getUTCDate()}-${MON[d.getUTCMonth()]}-${d.getUTCFullYear()}`;

// --- read ---
const wb = XLSX.readFile(SRC, { cellDates: false });
const ws = wb.Sheets[wb.SheetNames[0]];
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
const C = { NAME: 1, RATING: 2, IRR_LO: 3, IRR_HI: 4, MAT: 5, TENOR: 7 };

const rows = [];
for (let i = 2; i < aoa.length; i++) {
  const r = aoa[i] || [];
  const nm = clean(r[C.NAME]);
  if (!nm) continue;
  if (/^(issuer|structure|total|grand total)$/i.test(nm)) continue;
  const lo = Number(r[C.IRR_LO]), hi = Number(r[C.IRR_HI]);
  if (!isFinite(lo)) { console.log(`  ! row ${i + 1} has no IRR, skipped: ${nm}`); continue; }
  rows.push({ excelRow: i + 1, name: nm, rating: clean(r[C.RATING]), lo, hi: isFinite(hi) ? hi : lo, mat: r[C.MAT], tenor: r[C.TENOR] });
}
console.log(`parsed ${rows.length} bond rows from ${path.basename(SRC)}\n`);

// --- maturity: prefer the date embedded in the NAME (the source's date cell has a history of a
//     century typo, 2030 stored as 1930). Cross-check the two and report any disagreement. ---
function dateFromName(nm) {
  let m = nm.match(/(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})/);                       // 14JUN2027
  if (m) { const mo = MON.findIndex(x => x.toLowerCase() === m[2].toLowerCase()); if (mo >= 0) return new Date(Date.UTC(+m[3], mo, +m[1])); }
  m = nm.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);                       // 31.08.2029
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
}
let typoFixed = 0, mismatches = 0;
for (const b of rows) {
  const fromName = dateFromName(b.name);
  const fromCell = (b.mat != null && isFinite(Number(b.mat))) ? serialToDate(b.mat) : null;
  if (fromName && fromCell && fromName.getUTCFullYear() !== fromCell.getUTCFullYear()) {
    mismatches++;
    if (fromCell.getUTCFullYear() < 2000) typoFixed++;
    console.log(`  ~ row ${b.excelRow}: name says ${fromName.getUTCFullYear()}, cell says ${fromCell.getUTCFullYear()} -> using name  [${b.name}]`);
  }
  b.date = fromName || fromCell;
  if (!b.date) console.log(`  ! row ${b.excelRow}: no parseable maturity: ${b.name}`);
}
console.log(`name/cell year mismatches: ${mismatches} (of which century typos: ${typoFixed})\n`);

// --- dedupe: the workbook lists some bonds twice in different formats. Same coupon + issuer +
//     maturity = same instrument. Prefer the row whose NAME carries an explicit day-month-year. ---
const couponOf = nm => { const m = clean(nm).match(/^(\d+(?:\.\d+)?)\s*%?\s+/); return m ? parseFloat(m[1]).toFixed(4) : null; };
const issuerKey = nm => clean(nm).toLowerCase()
  .replace(/^\d+(\.\d+)?\s*%?\s*/, '')
  .replace(/\d{1,2}\s*[a-z]{3}\s*\d{4}|\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{4}|\b(19|20)\d{2}\b/g, '')
  .replace(/\((secured|unsecured)\)/g, '')
  .replace(/\b(limited|ltd|private|pvt)\b/g, '')
  .replace(/[^a-z0-9]+/g, '');
// Group on issuer + maturity first; a row that omits the coupon ("NAVI FINSERV 31.08.2029")
// is the same instrument as one that states it, so an absent coupon must not split the group.
const groups = new Map();
for (const b of rows) {
  const k = `${issuerKey(b.name)}|${b.date ? b.date.toISOString().slice(0, 10) : '?'}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(b);
}
// Prefer the best-formed name: explicit coupon, then a DDMMMYYYY date, then first-listed.
const quality = x => (couponOf(x.name) ? 2 : 0) + (/\d{1,2}\s*[A-Za-z]{3}\s*\d{4}/.test(x.name) ? 1 : 0);
const picked = [];
for (const [, list] of groups) {
  // Same issuer + maturity but genuinely different coupons = different instruments; keep both.
  const byCoupon = new Map();
  for (const x of list) {
    const c = couponOf(x.name);
    const key = c === null ? '?' : c;
    if (!byCoupon.has(key)) byCoupon.set(key, []);
    byCoupon.get(key).push(x);
  }
  const known = [...byCoupon.keys()].filter(k => k !== '?');
  let buckets;
  if (known.length <= 1) buckets = [list];                       // one coupon (or none stated)
  else {
    buckets = known.map(k => byCoupon.get(k));
    const unknown = byCoupon.get('?') || [];
    if (unknown.length) { console.log(`  ! coupon-less row(s) beside ${known.length} distinct coupons, kept separately: ${unknown.map(x => 'r' + x.excelRow).join(', ')}`); buckets.push(unknown); }
  }
  for (const b of buckets) {
    if (b.length > 1) {
      console.log(`  = duplicate (${b.length}): ${b.map(x => `r${x.excelRow} "${x.name}"`).join('  ||  ')}`);
      const irrs = new Set(b.map(x => x.hi));
      if (irrs.size > 1) console.log(`      *** differing IRR across duplicates: ${[...irrs].join(', ')} — keeping the best-formed row`);
      const rts = new Set(b.map(x => clean(x.rating).toUpperCase()));
      if (rts.size > 1) console.log(`      *** differing rating across duplicates: ${[...rts].join(', ')}`);
    }
    picked.push(b.slice().sort((x, y) => quality(y) - quality(x) || x.excelRow - y.excelRow)[0]);
  }
}
console.log(`\n${rows.length} rows -> ${picked.length} unique bonds (${rows.length - picked.length} duplicate row(s) dropped)\n`);

// --- build records in the shape the existing Invictus rows use ---
const normRating = r => { const v = clean(r); return /^sov$/i.test(v) ? 'SOV' : v.toUpperCase(); };
const built = picked.map(b => {
  const nm = `${b.name} (${DESK})`;
  return {
    name: nm, asset_class: 'Debt', product_class: 'Bonds', sub_category: DESK,
    irr_low: b.lo, irr_high: b.hi, aum: null,
    r1m: null, r3m: null, r6m: null, r1y: b.hi, r2y: null, r3y: b.hi, r5y: b.hi, r10y: null, si: null,
    expense: null, inception: null, fund_mgr: null,
    exit_load: b.date ? `Hold-to-maturity (${fmtDate(b.date)})` : 'Hold-to-maturity',
    mcap_large: null, mcap_mid: null, mcap_small: null, mcap_other: null,
    ytm: null, avg_maturity: null, mod_duration: null,
    bond_issuer: clean(b.name)
      .replace(/^\d+(\.\d+)?\s*%?\s+/, '')                              // leading coupon
      .replace(/\s*\d{1,2}\s*[A-Za-z]{3}\s*\d{4}\s*$/, '')              // trailing 14JUN2027
      .replace(/\s*\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{4}\s*$/, '')          // trailing 31.08.2029
      .replace(/\s*\((secured|unsecured)\)\s*$/i, '')
      .replace(/\s*\b(19|20)\d{2}\b\s*$/, '')                           // trailing bare year
      .trim(),
    bond_rating: normRating(b.rating),
  };
});

// --- splice into the MASTER block ---
const html = fs.readFileSync(HTML, 'utf8');
const lines = html.split('\n');
const li = lines.findIndex(l => l.startsWith('<script>window.MASTER = '));
if (li < 0) { console.error('*** MASTER line not found'); process.exit(1); }
const line = lines[li];
const a = line.indexOf('['), z = line.lastIndexOf(']');
const master = JSON.parse(line.slice(a, z + 1));

const before = master.filter(r => r.product_class === 'Bonds');
const oldInv = before.filter(r => r.sub_category === DESK);
const oneDigitalBefore = before.filter(r => r.sub_category !== DESK).map(r => r.name);
console.log(`MASTER baseline ${master.length}; Bonds ${before.length} (Invictus ${oldInv.length}, other ${before.length - oldInv.length})`);

const firstIdx = master.findIndex(r => r.product_class === 'Bonds' && r.sub_category === DESK);
const kept = master.filter(r => !(r.product_class === 'Bonds' && r.sub_category === DESK));
const at = firstIdx >= 0 ? Math.min(firstIdx, kept.length) : kept.length;
const next = kept.slice(0, at).concat(built, kept.slice(at));

// --- gates ---
let fail = false;
const dup = {}; next.forEach(r => dup[r.name] = (dup[r.name] || 0) + 1);
const dupes = Object.entries(dup).filter(([, c]) => c > 1);
console.log(`\nGATE duplicate names in MASTER: ${dupes.length ? '*** FAIL: ' + dupes.map(d => d[0]).join(' | ') : 'PASS (0)'}`);
if (dupes.length) fail = true;

const od = next.filter(r => r.product_class === 'Bonds' && r.sub_category !== DESK).map(r => r.name);
const odSame = od.length === oneDigitalBefore.length && od.every((n, i) => n === oneDigitalBefore[i]);
console.log(`GATE other bond desks untouched: ${odSame ? 'PASS (' + od.length + ' rows)' : '*** FAIL'}`);
if (!odSame) fail = true;

console.log(`GATE MASTER count: ${master.length} -> ${next.length}  (Invictus ${oldInv.length} -> ${built.length})`);
const badIrr = built.filter(r => !(r.irr_low > 0 && r.irr_low < 0.30 && r.irr_high >= r.irr_low));
console.log(`GATE IRR sane (0-30%, high>=low): ${badIrr.length ? '*** FAIL: ' + badIrr.map(r => r.name).join(' | ') : 'PASS'}`);
if (badIrr.length) fail = true;
// Every bond must carry a maturity, and it must be in the future — a past date means the
// century typo slipped through or the row is stale.
const yearOf = r => { const m = r.exit_load.match(/-(\d{4})\)$/); return m ? +m[1] : null; };
const badDate = built.filter(r => { const y = yearOf(r); return y === null || y < 2026; });
console.log(`GATE maturity present and not in the past: ${badDate.length ? '*** FAIL: ' + badDate.map(r => `${r.name} [${r.exit_load}]`).join(' | ') : 'PASS'}`);
if (badDate.length) fail = true;
const yrs = built.map(yearOf).filter(Boolean);
console.log(`GATE maturity range: ${Math.min(...yrs)} .. ${Math.max(...yrs)}`);
console.log(`GATE ratings: ${[...new Set(built.map(r => r.bond_rating))].join(', ')}`);

console.log('\n--- new Invictus list ---');
built.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. ${r.bond_rating.padEnd(4)} ${(r.irr_high * 100).toFixed(2).padStart(6)}%  ${r.exit_load.replace(/^Hold-to-maturity \(?|\)$/g, '').padEnd(12)}  ${r.name}`));

if (!APPLY) { console.log('\n[dry run] pass --apply to write index.html'); process.exit(0); }
if (fail) { console.error('\n*** a gate failed — refusing to write'); process.exit(1); }
lines[li] = line.slice(0, a) + JSON.stringify(next) + line.slice(z + 1);
const out = lines.join('\n');
if (!out.trimEnd().endsWith('</html>')) { console.error('*** output does not end with </html> — refusing'); process.exit(1); }
fs.writeFileSync(HTML, out, 'utf8');
console.log(`\nWROTE ${HTML} — ${out.length} bytes (was ${html.length})`);
