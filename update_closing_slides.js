// Replace the Disclaimer / Thank You slides in EXTRA_SLIDES from rendered images.
//
//   node update_closing_slides.js --dir "<dir with disclaimer.* and thankyou.*>" [--apply]
//
// The deck's slides are native PowerPoint shapes — ppt/media is empty — so they have to be
// RENDERED, not extracted. PowerPoint COM does it; there is no LibreOffice on this machine:
//
//   $pres.Slides.Item($i).Export($path, "PNG", 2001, 1125)
//
// 2001 x 1125 is the size every other image in EXTRA_SLIDES uses; the gate below enforces it.
// Delete the logo picture shape BEFORE exporting — the deck no longer carries a baked-in logo,
// because the export overlays whichever logo the user picked in the header switcher.
const fs = require('fs');
const path = require('path');
const B = require('./blocklib');

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const DIR = flag('--dir');
const SIB = flag('--sibling') || path.join(__dirname, 'Centricity_ExtraSlides.js');
if (!DIR) { console.error('Usage: node update_closing_slides.js --dir "<render dir>" [--apply]'); process.exit(2); }

// PNG for the text-heavy disclaimer (crisper and, here, smaller than JPEG); JPEG for the
// photographic thank-you.
const WANT = [
  { key: 'disclaimer', file: 'disclaimer.png', mime: 'image/png' },
  { key: 'thankyou',   file: 'thankyou.jpg',   mime: 'image/jpeg' },
];

// Minimal PNG/JPEG dimension readers so the size gate does not need a decoder.
function dims(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC)
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

const ES = B.read(SIB, 'window.EXTRA_SLIDES = ').value;
console.log('EXTRA_SLIDES today: ' + Object.keys(ES).map(k => k + (Array.isArray(ES[k]) ? '[' + ES[k].length + ']' : '')).join(', '));

const next = Object.assign({}, ES);
let fail = false;
for (const w of WANT) {
  const p = path.join(DIR, w.file);
  if (!fs.existsSync(p)) { console.error('*** missing render: ' + p); fail = true; continue; }
  const buf = fs.readFileSync(p);
  const d = dims(buf);
  const ok = d && d.w === 2001 && d.h === 1125;
  const before = ES[w.key] ? Math.round(String(ES[w.key]).length / 1024) + ' KB' : 'absent';
  console.log('  ' + w.key.padEnd(12) + w.file.padEnd(18) +
    (d ? d.w + 'x' + d.h : '??').padEnd(12) + (ok ? 'OK' : '*** expected 2001x1125') +
    '   ' + before + ' -> ' + Math.round(buf.length * 1.37 / 1024) + ' KB');
  if (!ok) { fail = true; continue; }
  next[w.key] = 'data:' + w.mime + ';base64,' + buf.toString('base64');
}

console.log('\n---------------- gates ----------------');
console.log('GATE renders are 2001x1125: ' + (fail ? '*** no' : 'PASS'));
// The other keys must survive — this tool only ever touches disclaimer + thankyou.
const keep = Object.keys(ES).filter(k => !WANT.some(w => w.key === k));
const kept = keep.every(k => next[k] === ES[k]);
console.log('GATE untouched keys carried through (' + keep.join(', ') + '): ' + (kept ? 'PASS' : '*** changed'));
if (!kept) fail = true;
console.log('GATE market slides still ' + (next.market || []).length + ' images');
if ((next.market || []).length !== (ES.market || []).length) fail = true;
const total = Object.values(next).flat().reduce((a, v) => a + String(v).length, 0);
console.log('GATE sibling payload: ' + Math.round(total / 1024 / 1024 * 10) / 10 + ' MB');

if (!APPLY) { console.log('\n[dry run] pass --apply to write'); process.exit(fail ? 1 : 0); }
if (fail) { console.error('\n*** gate failed — refusing to write'); process.exit(1); }
const bytes = B.writeBlocks(SIB, [{ prefix: 'window.EXTRA_SLIDES = ', value: next }]);
console.log('\nWROTE ' + SIB + ' — ' + bytes + ' bytes');
