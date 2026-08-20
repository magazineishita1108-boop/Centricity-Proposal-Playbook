// Minimal pptx reader: pulls slide XML out of the zip without a dependency.
const fs = require('fs'), zlib = require('zlib');

function entries(file) {
  const buf = fs.readFileSync(file);
  const out = new Map();
  let i = 0;
  while ((i = buf.indexOf('PK\x01\x02', i, 'binary')) !== -1) {
    const nlen = buf.readUInt16LE(i + 28), elen = buf.readUInt16LE(i + 30), clen = buf.readUInt16LE(i + 32);
    const off = buf.readUInt32LE(i + 42);
    const name = buf.toString('utf8', i + 46, i + 46 + nlen);
    out.set(name, off);
    i += 46 + nlen + elen + clen;
  }
  const read = off => {
    const nlen = buf.readUInt16LE(off + 26), elen = buf.readUInt16LE(off + 28);
    const method = buf.readUInt16LE(off + 8);
    let csize = buf.readUInt32LE(off + 18);
    const start = off + 30 + nlen + elen;
    if (csize === 0 || csize === 0xffffffff) {              // sizes live in the data descriptor
      let end = buf.indexOf('PK\x03\x04', start, 'binary');
      if (end === -1) end = buf.indexOf('PK\x01\x02', start, 'binary');
      csize = end - start - 16;
    }
    const raw = buf.slice(start, start + csize);
    return method === 0 ? raw : zlib.inflateRawSync(raw);
  };
  return { names: [...out.keys()], get: n => read(out.get(n)) };
}

// Paragraph-aware text extraction: <a:p> is a line, <a:t> are its runs.
function slideText(xml) {
  const paras = [];
  const pre = xml.replace(/<a:br\s*\/>/g, '<a:t>\n</a:t>');
  for (const m of pre.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)) {
    let t = '';
    for (const r of m[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)) t += r[1];
    t = t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
         .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d))
         .replace(/&amp;/g, '&').replace(/\u00a0/g, ' ');
    if (t.trim()) paras.push(t.replace(/[ \t]+/g, ' ').trim());
  }
  return paras;
}

// Table-aware: returns [[cell,...],...] per <a:tbl>
function slideTables(xml) {
  const tables = [];
  for (const tbl of xml.matchAll(/<a:tbl>[\s\S]*?<\/a:tbl>/g)) {
    const rows = [];
    for (const tr of tbl[0].matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)) {
      const cells = [];
      for (const tc of tr[0].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)) cells.push(slideText(tc[0]).join(' | '));
      rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

module.exports = { entries, slideText, slideTables };
