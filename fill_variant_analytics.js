// A fund whose Growth record has no entry in this month's analytics workbook often IS in the
// workbook under another option of the SAME scheme (IDCW / IDCW Reinvest / Direct). The holdings
// are identical across options — it is one portfolio — so the sibling row is a valid source.
//
// This runs index.html's own parseAnalytics into an EMPTY store to get exactly this month's
// output keyed by this month's names, then fills any MASTER fund still missing an entry from a
// plan-variant sibling. Nothing already present is overwritten.
//
//   node fill_variant_analytics.js --dir "<Month folder>" [--apply] [--html <p>]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const DIR = flag('--dir');
const HTML = flag('--html') || path.join(__dirname, 'index.html');
if (!DIR) { console.error('Usage: node fill_variant_analytics.js --dir "<Month folder>" [--apply] [--html <p>]'); process.exit(2); }
const AN = path.join(DIR, 'Analytics');
const pick = re => path.join(AN, fs.readdirSync(AN).find(f => re.test(f)));
const SRC = { equity: pick(/^Equity Analytics_/i), hybrid: pick(/^Hybrid Analytics_/i), debt: pick(/^Debt Analytics_/i) };

// ---- sandbox with the page's parsers ----
const html = fs.readFileSync(HTML, 'utf8');
const blocks = [];
{
  const re = /<script\b([^>]*)>/gi; let m;
  while ((m = re.exec(html)) !== null) {
    const s0 = /\bsrc\s*=\s*"([^"]+)"/i.exec(m[1]);
    const s = m.index + m[0].length, c = html.indexOf('</script>', s), e = c === -1 ? html.length : c;
    blocks.push({ src: s0 ? s0[1] : null, body: s0 ? '' : html.slice(s, e) });
    re.lastIndex = e;
  }
}
const sandbox = { console, JSON, Math, Object, Array, String, Number, Boolean, Date, RegExp, Map, Set, Promise,
  parseFloat, parseInt, isNaN, isFinite, XLSX, Error, TypeError, Symbol, ArrayBuffer, Uint8Array, setTimeout, clearTimeout,
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }), addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {} } } };
sandbox.window = {}; sandbox.globalThis = sandbox; sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
for (const b of blocks) {
  if (b.src || /ReactDOM\.createRoot/.test(b.body)) continue;
  try { vm.runInContext(b.body, sandbox, { timeout: 120000 }); } catch (e) { /* React blocks */ }
}
const W = sandbox.window;
const MASTER = W.MASTER;
const fileOf = p => ({ name: path.basename(p), arrayBuffer: async () => fs.readFileSync(p) });

// Plan / option markers only. Never strip a distinguishing tag such as (Inbound) or (Invictus).
const NBSP = String.fromCharCode(160);
const tidy = s => String(s == null ? '' : s).split(NBSP).join(' ').replace(/\s+/g, ' ').trim();
function planBase(s) {
  let t = tidy(s).toLowerCase();
  for (let i = 0; i < 6; i++) {
    const prev = t;
    t = t.replace(/\s*\(\s*adjusted\s*\)\s*$/i, '')
         .replace(/\s*[-–—]?\s*direct\s*plan\s*$/i, '')
         .replace(/\s*\(\s*(?:g|growth|idcw(?:\s*(?:reinvest|payout|re-?invest)?)?|d|div|dividend|b|bonus|adr|q|m|h|w|a)\s*\)\s*$/i, '')
         .replace(/\s*[-–—]\s*(?:reg|regular|dir|direct)\s*$/i, '')
         .replace(/\s*[-–—]+\s*$/, '').trim();
    if (t === prev) break;
  }
  return t;
}
// Prefer a Growth + Regular sibling when several options exist.
function rank(n) {
  let r = 0;
  if (/\(\s*g\s*\)|\(growth\)/i.test(n)) r -= 4;
  if (/idcw|dividend/i.test(n)) r += 3;
  if (/reinvest/i.test(n)) r += 1;
  if (/direct/i.test(n)) r += 2;
  return r;
}

(async () => {
  const KINDS = [
    { kind: 'equity', store: 'EQUITY_ANALYTICS', ok: f => f.asset_class === 'Equity' && ['Mutual Fund', 'Index Fund', 'ETF'].includes(f.product_class) },
    { kind: 'hybrid', store: 'HYBRID_ANALYTICS', ok: f => f.asset_class === 'Hybrid' && ['Mutual Fund', 'Index Fund', 'ETF'].includes(f.product_class) },
    { kind: 'debt',   store: 'DEBT_ANALYTICS',   ok: f => f.asset_class === 'Debt' && ['Mutual Fund', 'Index Fund', 'ETF'].includes(f.product_class) },
  ];
  const patch = {};   // store -> { masterName: entry }
  for (const K of KINDS) {
    // parse this month's file into an EMPTY store so we see exactly what it covers
    const keep = W[K.store];
    W[K.store] = {};
    const r = await W.REFRESH.parseAnalytics(fileOf(SRC[K.kind]), K.kind);
    const monthOut = W[K.store];
    W[K.store] = keep;
    if (!r.ok) { console.error(`  parseAnalytics(${K.kind}) failed: ${r.error}`); process.exit(1); }

    const byBase = new Map();
    for (const n of Object.keys(monthOut)) {
      const b = planBase(n); if (!b) continue;
      if (!byBase.has(b)) byBase.set(b, []);
      byBase.get(b).push(n);
    }
    const eligible = MASTER.filter(K.ok);
    const missing = eligible.filter(f => !Object.prototype.hasOwnProperty.call(monthOut, f.name));
    const filled = [], stillMissing = [];
    for (const f of missing) {
      const cands = byBase.get(planBase(f.name));
      if (!cands || !cands.length) { stillMissing.push(f.name); continue; }
      const best = cands.slice().sort((a, b) => rank(a) - rank(b) || a.length - b.length)[0];
      patch[K.store] = patch[K.store] || {};
      patch[K.store][f.name] = { from: best, entry: monthOut[best] };
      filled.push(`${f.name}  <-  ${best}`);
    }
    console.log(`\n${K.kind.toUpperCase()}  eligible ${eligible.length} | covered by name ${eligible.length - missing.length} | missing ${missing.length}`);
    console.log(`  filled from a plan-variant sibling: ${filled.length}`);
    filled.slice(0, 30).forEach(x => console.log(`    ${x}`));
    if (filled.length > 30) console.log(`    ... +${filled.length - 30} more`);
    console.log(`  still no entry anywhere in the ${K.kind} workbook: ${stillMissing.length}`);
    stillMissing.slice(0, 10).forEach(x => console.log(`    ! ${x}`));
  }

  // ---- apply ----
  const total = Object.values(patch).reduce((a, o) => a + Object.keys(o).length, 0);
  console.log(`\nTOTAL entries to add: ${total}`);
  if (!APPLY) { console.log('[dry run] pass --apply to write index.html'); return; }
  if (!total) { console.log('nothing to do'); return; }

  let out = html;
  const targets = [];
  for (const store of Object.keys(patch)) {
    const prefix = `window.${store} = `;
    const i = out.indexOf(prefix);
    if (i < 0) { console.error('*** not found: ' + prefix); process.exit(1); }
    targets.push({ store, s: i + prefix.length });
  }
  targets.sort((a, b) => b.s - a.s);   // splice from the end so earlier offsets stay valid
  for (const t of targets) {
    const e = matchEnd(out, t.s);
    const obj = JSON.parse(out.slice(t.s, e + 1));
    // Every name in the patch is a fund this month's workbook does NOT cover under its own name,
    // so whatever is currently stored for it is last month's holdings. Replacing it with a
    // same-scheme sibling row from THIS month is the whole point — an existing entry is the
    // stale case, not a reason to skip.
    let added = 0, replaced = 0;
    for (const [name, v] of Object.entries(patch[t.store])) {
      if (Object.prototype.hasOwnProperty.call(obj, name)) replaced++; else added++;
      obj[name] = v.entry;
    }
    out = out.slice(0, t.s) + JSON.stringify(obj) + out.slice(e + 1);
    console.log(`  ${t.store}: ${added} added + ${replaced} refreshed (were last month's) -> ${Object.keys(obj).length}`);
  }
  if (!out.trimEnd().endsWith('</html>')) { console.error('*** does not end with </html>'); process.exit(1); }
  fs.writeFileSync(HTML, out, 'utf8');
  console.log(`\nWROTE ${HTML} — ${out.length} bytes (was ${html.length})`);
})();

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
