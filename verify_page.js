// Run index.html's scripts in document order inside a vm with a window/document shim, so the
// counts below are the real in-browser state including all five sibling mutations.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = process.argv[2];
const HTML = path.join(DIR, 'index.html');
const html = fs.readFileSync(HTML, 'utf8');

const noop = () => {};
const el = () => new Proxy({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  appendChild: noop, setAttribute: noop, addEventListener: noop, getBoundingClientRect: () => ({ top: 0, height: 0 }),
  querySelector: () => null, querySelectorAll: () => [] }, { get: (t, k) => (k in t ? t[k] : noop) });
const documentShim = { createElement: el, getElementById: () => null, querySelector: () => null,
  querySelectorAll: () => [], addEventListener: noop, head: el(), body: el(), hidden: false, visibilityState: 'visible' };
const sandbox = { console, setTimeout, clearTimeout, requestAnimationFrame: noop, document: documentShim,
  navigator: { userAgent: 'node' }, location: { href: 'http://localhost/' }, fetch: noop, alert: noop };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const errors = [];
function run(code, label) {
  try { vm.runInContext(code, sandbox, { filename: label }); }
  catch (e) { errors.push(`${label}: ${e.message}`); }
}

// Walk <script> tags in document order; external ones load from disk (the CDNs are skipped).
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, n = 0;
while ((m = re.exec(html))) {
  const attrs = m[1] || '';
  const src = (attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1];
  n++;
  if (src) {
    if (/^https?:/i.test(src)) continue;                    // CDN — not available offline
    const p = path.join(DIR, src);
    if (!fs.existsSync(p)) { errors.push(`MISSING SIBLING: ${src}`); continue; }
    run(fs.readFileSync(p, 'utf8'), src);
  } else {
    run(m[2], `inline #${n}`);
  }
}

const W = sandbox;
const cnt = o => (Array.isArray(o) ? o.length : o ? Object.keys(o).length : 0);
const master = W.MASTER || [];
const names = master.map(r => r.name);
const dupes = names.filter((x, i) => names.indexOf(x) !== i);
const select = W.CENTRICITY_SELECT || {};
const inMaster = Object.keys(select).filter(k => names.includes(k)).length;

console.log('MASTER effective          ' + cnt(master));
console.log('CENTRICITY_SELECT         ' + cnt(select) + '   (keys present in MASTER: ' + inMaster + ')');
console.log('  with rationale          ' + Object.values(select).filter(v => v.rationale).length);
console.log('  with risk ratios        ' + Object.values(select).filter(v => v.beta != null).length);
console.log('  with details            ' + Object.values(select).filter(v => Array.isArray(v.details) && v.details.length).length);
console.log('PMS_PERFORMANCE.pms       ' + cnt(W.PMS_PERFORMANCE && W.PMS_PERFORMANCE.pms));
console.log('PMS_PERFORMANCE.aif       ' + cnt(W.PMS_PERFORMANCE && W.PMS_PERFORMANCE.aif));
console.log('PMS_PERFORMANCE.benchmark ' + cnt(W.PMS_PERFORMANCE && W.PMS_PERFORMANCE.benchmarks));
console.log('PMS_PERF_ALIAS            ' + cnt(W.PMS_PERF_ALIAS) + '   (null pins: ' + Object.values(W.PMS_PERF_ALIAS || {}).filter(v => v === null).length + ')');
console.log('EQUITY_ANALYTICS          ' + cnt(W.EQUITY_ANALYTICS));
console.log('RISK_MATRIX               ' + cnt(W.RISK_MATRIX));
console.log('PMS_AIF_TERMS             ' + cnt(W.PMS_AIF_TERMS));
console.log('EXTRA_SLIDES              ' + cnt(W.EXTRA_SLIDES));
console.log('DATA_DATES                ' + JSON.stringify(W.DATA_DATES));
console.log('duplicate MASTER names    ' + dupes.length + (dupes.length ? '  *** ' + dupes.slice(0, 5).join(' | ') : ''));
console.log('file ends </html>         ' + (html.trimEnd().endsWith('</html>') ? 'yes' : '*** NO'));

// how many MASTER PMS funds now resolve to a performance record
const alias = W.PMS_PERF_ALIAS || {};
const pmsPerf = (W.PMS_PERFORMANCE || {}).pms || {};
const pmsFunds = master.filter(r => r.product_class === 'PMS');
const hit = pmsFunds.filter(f => alias[f.name] && pmsPerf[alias[f.name]]).length;
console.log('MASTER PMS with perf      ' + hit + ' of ' + pmsFunds.length);

const real = errors.filter(e => !/React|ReactDOM|Chart|XLSX|PptxGenJS| is not defined/.test(e));
console.log('\nscript errors (excluding the CDN globals): ' + real.length);
real.slice(0, 8).forEach(e => console.log('   *** ' + e));
