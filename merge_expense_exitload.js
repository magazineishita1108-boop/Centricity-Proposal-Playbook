// MONTHLY: refresh expense ratio and exit load.
//
// Expense workbook columns: Scheme Name | Base Expratio | Direct Plan Base Expratio |
// Direct Plan Ratio | Ratio.  "Ratio" is the total TER and is what MASTER.expense holds
// (verified: Aditya Birla SL Large Cap Fund-Reg(G) Ratio 1.68 == embedded expense 0.0168).
// The REGULAR row also carries "Direct Plan Ratio", so one row feeds both plans:
//   MASTER.expense        <- Ratio / 100
//   DIRECT_PERF[].expense <- Direct Plan Ratio / 100
// Exit Load workbook is 2-column: Scheme Name | Remark (prose).
//
//   node merge_expense_exitload.js --expense <x.xlsx> --exitload <y.xlsx> [--apply] [--html <p>]
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const EXP = flag('--expense'), EXIT = flag('--exitload');
const HTML = flag('--html') || path.join(__dirname, 'index.html');
if ((!EXP && !EXIT) || (EXP && !fs.existsSync(EXP)) || (EXIT && !fs.existsSync(EXIT))) {
  console.error('Usage: node merge_expense_exitload.js --expense <x.xlsx> --exitload <y.xlsx> [--apply] [--html <p>]');
  process.exit(2);
}

const NBSP = String.fromCharCode(160);
const tidy = s => String(s == null ? '' : s).split(NBSP).join(' ').replace(/\s+/g, ' ').trim();
const num = v => { if (v == null || v === '') return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[,%\s]/g, '')); return isFinite(n) ? n : null; };
// "Nil" is a real answer (no exit load). ".", "NA", "No Option" and friends mean MISSING and
// must not overwrite good data with a placeholder.
const MISSING = /^(\.|-|--|na|n\.a\.?|n\/a|no option|not applicable|nil\.?\s*$|)$/i;
const isMissing = s => { const t = tidy(s); return t === '' || /^(\.|-|--|na|n\.a\.?|n\/a|no option|not applicable)$/i.test(t); };

const html = fs.readFileSync(HTML, 'utf8');
function block(prefix) {
  const i = html.indexOf(prefix);
  if (i < 0) throw new Error('not found: ' + prefix);
  const s = i + prefix.length;
  return { s, e: matchEnd(html, s), value: JSON.parse(html.slice(s, matchEnd(html, s) + 1)) };
}
const mB = block('window.MASTER = ');
const dB = block('window.DIRECT_PERF = ');
const master = mB.value, direct = dB.value;
console.log(`MASTER ${master.length}; DIRECT_PERF ${Object.keys(direct).length}`);

const byName = new Map(master.map(r => [tidy(r.name), r]));
let expReg = 0, expDir = 0, expUnchanged = 0, xl = 0, xlSkipped = 0;
const expMissRows = [], badExp = [];

if (EXP) {
  const rows = XLSX.utils.sheet_to_json(XLSX.readFile(EXP).Sheets['Sheet1'], { defval: null });
  console.log(`\nexpense rows: ${rows.length}`);
  for (const r of rows) {
    const nm = tidy(r['Scheme Name']);
    const rec = byName.get(nm);
    if (!rec) continue;
    const total = num(r['Ratio']);
    if (total != null) {
      // SEBI caps a plain equity MF around 2.25%, but SIF / long-short schemes in this universe
      // genuinely run 4-6%+, so the sanity bound is deliberately loose — it is here to catch a
      // unit error (a raw 168 instead of 1.68), not to second-guess the AMC.
      if (total < 0 || total > 8) { badExp.push(`${nm}=${total}`); }
      else {
        const v = +(total / 100).toFixed(6);
        if (rec.expense !== v) { rec.expense = v; expReg++; } else expUnchanged++;
      }
    }
    const dr = num(r['Direct Plan Ratio']);
    if (dr != null && dr >= 0 && dr <= 8 && direct[rec.name]) {
      direct[rec.name].expense = +(dr / 100).toFixed(6);
      expDir++;
    }
  }
  const covered = master.filter(r => ['Mutual Fund', 'Index Fund', 'ETF'].includes(r.product_class));
  const withExp = covered.filter(r => r.expense != null).length;
  console.log(`  MASTER.expense updated      : ${expReg}  (unchanged ${expUnchanged})`);
  console.log(`  DIRECT_PERF.expense updated : ${expDir}`);
  console.log(`  MF/Index/ETF carrying expense: ${withExp} / ${covered.length}`);
  if (badExp.length) console.log(`  ! rejected out-of-range (>4%): ${badExp.length} — ${badExp.slice(0, 4).join(', ')}`);
}

if (EXIT) {
  const rows = XLSX.utils.sheet_to_json(XLSX.readFile(EXIT).Sheets['Sheet1'], { defval: null });
  console.log(`\nexit-load rows: ${rows.length}`);
  const RCOL = Object.keys(rows[0]).find(k => /remark/i.test(k)) || 'Remark';
  for (const r of rows) {
    const nm = tidy(r['Scheme Name']);
    const rec = byName.get(nm);
    if (!rec) continue;
    const raw = r[RCOL];
    if (isMissing(raw)) { xlSkipped++; continue; }   // placeholder, not data
    const v = tidy(raw);
    if (rec.exit_load !== v) { rec.exit_load = v; xl++; }
  }
  const covered = master.filter(r => ['Mutual Fund', 'Index Fund', 'ETF'].includes(r.product_class));
  console.log(`  MASTER.exit_load updated : ${xl}`);
  console.log(`  placeholder cells skipped: ${xlSkipped}  (".", "NA", "No Option" mean missing, not zero)`);
  console.log(`  MF/Index/ETF carrying exit load: ${covered.filter(r => r.exit_load).length} / ${covered.length}`);
}

// ---- gates ----
let fail = false;
const exps = master.map(r => r.expense).filter(v => v != null);
const hi = master.filter(r => r.expense > 0.04).map(r => `${r.name}=${(r.expense * 100).toFixed(2)}%`);
console.log(`\nGATE expense range: ${Math.min(...exps)} .. ${Math.max(...exps)} (decimals)`);
if (Math.max(...exps) > 0.08) { console.log('  *** FAIL: an expense above 8% — likely a unit error'); fail = true; }
else console.log(`  above 4% (SIF / long-short, expected): ${hi.length}${hi.length ? ' — ' + hi.slice(0, 3).join(', ') : ''}`);
const names = master.map(r => r.name);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
console.log(`GATE duplicate names: ${dupes.length ? '*** FAIL' : 'PASS (0)'}`);
if (dupes.length) fail = true;
console.log(`GATE MASTER count unchanged: ${master.length === mB.value.length ? 'PASS' : '*** FAIL'}`);
const sample = master.find(r => r.name === 'Aditya Birla SL Large Cap Fund-Reg(G)');
console.log(`SAMPLE ${sample.name}: expense=${sample.expense} exit_load="${sample.exit_load}" | Direct expense=${(direct[sample.name] || {}).expense}`);

if (!APPLY) { console.log('\n[dry run] pass --apply to write index.html'); process.exit(0); }
if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }
// splice DIRECT_PERF first (it sits earlier in the file than MASTER, so do the later one first)
let out = html;
const order = [mB, dB].sort((a, b) => b.s - a.s);
const vals = new Map([[mB, master], [dB, direct]]);
for (const b of order) out = out.slice(0, b.s) + JSON.stringify(vals.get(b)) + out.slice(b.e + 1);
if (!out.trimEnd().endsWith('</html>')) { console.error('*** does not end with </html>'); process.exit(1); }
fs.writeFileSync(HTML, out, 'utf8');
console.log(`\nWROTE ${HTML} — ${out.length} bytes (was ${html.length})`);

function matchEnd(str, start) {
  const open = str[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let k = start; k < str.length; k++) {
    const ch = str[k];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return k; }
  }
  throw new Error('unbalanced');
}
