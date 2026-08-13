// Replace EXTRA_SLIDES.market with this month's rendered Market Update slides.
// The dividers and the thank-you slide are left untouched.
//   node update_market_slides.js --slides <dir of slide1..N.jpg> [--apply] [--js <Centricity_ExtraSlides.js>]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const SLIDES = flag('--slides');
const JS = flag('--js') || path.join(__dirname, 'Centricity_ExtraSlides.js');
if (!SLIDES || !fs.existsSync(SLIDES)) { console.error('Usage: node update_market_slides.js --slides <dir> [--apply] [--js <p>]'); process.exit(2); }

const files = fs.readdirSync(SLIDES)
  .filter(f => /^slide\d+\.(jpe?g|png)$/i.test(f))
  .sort((a, b) => (+a.match(/\d+/)[0]) - (+b.match(/\d+/)[0]));
if (!files.length) { console.error('*** no slideN.jpg files in ' + SLIDES); process.exit(1); }

// JPEG/PNG dimensions, so a mis-exported slide cannot slip in silently.
function dims(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { type: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  for (let j = 2; j < buf.length - 9;) {
    if (buf[j] !== 0xFF) { j++; continue; }
    const m = buf[j + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC)
      return { type: 'jpeg', h: buf.readUInt16BE(j + 5), w: buf.readUInt16BE(j + 7) };
    j += 2 + buf.readUInt16BE(j + 2);
  }
  return { type: '?', w: 0, h: 0 };
}

const src = fs.readFileSync(JS, 'utf8');
const sandbox = { console }; sandbox.window = {};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const ES = sandbox.window.EXTRA_SLIDES;
if (!ES || !Array.isArray(ES.market)) { console.error('*** EXTRA_SLIDES.market not found'); process.exit(1); }

const oldMarket = ES.market;
const oldDims = dims(Buffer.from(oldMarket[0].slice(oldMarket[0].indexOf(',') + 1), 'base64'));
console.log(`current market slides : ${oldMarket.length}  (${oldDims.w}x${oldDims.h} ${oldDims.type})`);

const built = [];
let bytes = 0, fail = false;
for (const f of files) {
  const buf = fs.readFileSync(path.join(SLIDES, f));
  const d = dims(buf);
  const ok = d.w === oldDims.w && d.h === oldDims.h;
  if (!ok) fail = true;
  console.log(`  ${f.padEnd(12)} ${d.type} ${d.w}x${d.h}  ${String(Math.round(buf.length / 1024)).padStart(4)} KB  ${ok ? '' : '*** dimensions differ from the existing slides'}`);
  built.push(`data:image/${d.type};base64,` + buf.toString('base64'));
  bytes += buf.length;
}
console.log(`new market slides     : ${built.length}  (${Math.round(bytes / 1024)} KB raw)`);

// ---- gates ----
console.log(`\nGATE slide count ${oldMarket.length} -> ${built.length}${built.length === oldMarket.length ? '  (unchanged)' : '  *** CHANGED — confirm this is intended'}`);
console.log(`GATE dimensions match existing: ${fail ? '*** FAIL' : 'PASS'}`);
const otherKeys = Object.keys(ES).filter(k => k !== 'market');
console.log(`GATE untouched keys: ${otherKeys.join(', ')}`);
if (built.some(s => s.length < 5000)) { console.log('GATE *** a slide looks suspiciously small'); fail = true; }

ES.market = built;
const out = src.slice(0, src.indexOf('\n') + 1) + 'window.EXTRA_SLIDES = ' + JSON.stringify(ES) + ';\n';
console.log(`\nfile ${src.length} -> ${out.length} bytes (${out.length > src.length ? '+' : ''}${Math.round((out.length - src.length) / 1024)} KB)`);

if (!APPLY) { console.log('\n[dry run] pass --apply to write'); process.exit(0); }
if (fail) { console.error('\n*** a gate failed — refusing to write'); process.exit(1); }
fs.writeFileSync(JS, out, 'utf8');
console.log(`WROTE ${JS}`);
