// Rebuild the embedded window.DIRECT_PERF by running index.html's OWN (fixed)
// REFRESH.parseMfMonitorDirect over the Direct monitor — so the baked overlay and the Section 7
// upload path are provably the same code.
//   node rebuild_directperf.js "<Daily MF Monitor_Direct_<date>.xlsx>" [--apply] [--html <p>]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const SRC = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--html');
const HTML = flag('--html') || path.join(__dirname, 'index.html');
if (!SRC || !fs.existsSync(SRC)) { console.error('Usage: node rebuild_directperf.js "<Direct monitor.xlsx>" [--apply] [--html <p>]'); process.exit(2); }

const html = fs.readFileSync(HTML, 'utf8');
const blocks = [];
{ const re = /<script\b([^>]*)>/gi; let m;
  while ((m = re.exec(html)) !== null) {
    const s0 = /\bsrc\s*=\s*"([^"]+)"/i.exec(m[1]);
    const s = m.index + m[0].length, c = html.indexOf('</script>', s), e = c === -1 ? html.length : c;
    blocks.push({ src: s0 ? s0[1] : null, body: s0 ? '' : html.slice(s, e) });
    re.lastIndex = e;
  } }
const sandbox = { console, JSON, Math, Object, Array, String, Number, Boolean, Date, RegExp, Map, Set, Promise,
  parseFloat, parseInt, isNaN, isFinite, XLSX, Error, TypeError, Symbol, ArrayBuffer, Uint8Array, setTimeout, clearTimeout,
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }), addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {} } } };
sandbox.window = {}; sandbox.globalThis = sandbox; sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
for (const b of blocks) { if (b.src || /ReactDOM\.createRoot/.test(b.body)) continue;
  try { vm.runInContext(b.body, sandbox, { timeout: 120000 }); } catch (e) {} }
const W = sandbox.window;

(async () => {
  const oldDP = W.DIRECT_PERF;
  const oldExpense = new Map(Object.entries(oldDP).filter(([, v]) => v.expense != null).map(([k, v]) => [k, v.expense]));
  console.log(`before: ${Object.keys(oldDP).length} funds, ${oldExpense.size} with expense`);

  W.DIRECT_PERF = {};
  const res = await W.REFRESH.parseMfMonitorDirect(
    { name: path.basename(SRC), arrayBuffer: async () => fs.readFileSync(SRC) },
    { asOn: '' });
  if (!res.ok) { console.error('*** parser failed: ' + res.error); process.exit(1); }
  console.log(res.message);
  const DP = W.DIRECT_PERF;

  // ---- gates: every field must sit on the same scale as MASTER ----
  const M = new Map(W.MASTER.map(r => [r.name, r]));
  const stats = {};
  const bump = (k, ok) => { stats[k] = stats[k] || { n: 0, bad: 0 }; stats[k].n++; if (!ok) stats[k].bad++; };
  const worst = {};
  for (const [name, v] of Object.entries(DP)) {
    const m = M.get(name); if (!m) continue;
    for (const k of ['mcap_large', 'mcap_mid', 'mcap_small', 'mcap_other', 'ytm', 'expense']) {
      if (v[k] == null) continue;
      const ok = v[k] >= -0.5 && v[k] <= 1.5;                     // decimals, never percentages
      bump(k, ok);
      if (!ok && !worst[k]) worst[k] = `${name}=${v[k]}`;
    }
    if (v.mcap_large != null) {
      const sum = (v.mcap_large || 0) + (v.mcap_mid || 0) + (v.mcap_small || 0) + (v.mcap_other || 0);
      bump('mcap_sum~1', Math.abs(sum - 1) < 0.05);
      if (Math.abs(sum - 1) >= 0.05 && !worst['mcap_sum~1']) worst['mcap_sum~1'] = `${name} sums to ${sum.toFixed(3)}`;
    }
  }
  let fail = false;
  console.log('\nGATES (values must be decimals on MASTER\'s scale):');
  for (const [k, s] of Object.entries(stats)) {
    const bad = s.bad > 0;
    if (bad) fail = true;
    console.log(`  ${k.padEnd(12)} ${String(s.n).padStart(5)} checked  ${bad ? '*** ' + s.bad + ' BAD  e.g. ' + worst[k] : 'PASS'}`);
  }
  const keptExpense = [...oldExpense.keys()].filter(k => DP[k] && DP[k].expense != null).length;
  console.log(`\nexpense present after rebuild: ${Object.values(DP).filter(v => v.expense != null).length} (was ${oldExpense.size}; ${keptExpense} of the old ones still covered)`);

  // side-by-side against MASTER for one fund
  const probe = 'Bandhan Large & Mid Cap Fund-Reg(G)';
  const pm = M.get(probe), pd = DP[probe];
  if (pm && pd) {
    console.log(`\nSAMPLE ${probe}`);
    for (const k of ['mcap_large', 'mcap_mid', 'mcap_small', 'mcap_other', 'expense', 'r3y']) {
      console.log(`  ${k.padEnd(12)} master=${String(pm[k]).slice(0, 10).padEnd(12)} direct=${String(pd[k]).slice(0, 10)}`);
    }
  }
  console.log(`\nDIRECT_PERF ${Object.keys(oldDP).length} -> ${Object.keys(DP).length}`);

  if (!APPLY) { console.log('\n[dry run] pass --apply to write index.html'); return; }
  if (fail) { console.error('\n*** a scale gate failed — refusing to write'); process.exit(1); }
  const prefix = 'window.DIRECT_PERF = ';
  const i = html.indexOf(prefix); const s = i + prefix.length;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let k = s; k < html.length; k++) { const ch = html[k];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { end = k; break; } } }
  const out = html.slice(0, s) + JSON.stringify(DP) + html.slice(end + 1);
  if (!out.trimEnd().endsWith('</html>')) { console.error('*** does not end with </html>'); process.exit(1); }
  fs.writeFileSync(HTML, out, 'utf8');
  console.log(`\nWROTE ${HTML} — ${out.length} bytes (was ${html.length})`);
})();
