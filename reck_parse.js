// Pull the recommended-fund list out of the Reckoner's PERFORMANCE tables only.
// A performance grid is a table whose first cell reads "Scheme Name" / "Strategy" / "Fund Name"
// and that has at least 8 columns; everything else on the slide is narrative (fee structures,
// "About the strategy" boxes) and must not parse as a fund.
const P = require('./pptx');
const fs = require('fs');

const BENCH = /(\bTRI\b|^NIFTY|^Nifty|^BSE\b|^S&P|^CRISIL|^Crisil|^MSCI|^Domestic Price of|Index$|^Nasdaq-100$|^Gold$|^Silver$|Benchmark)/;
const HEAD0 = /^(Scheme Name|Fund Name|Strategy|Scheme|Name of the Scheme)$/i;

function parse(SRC) {
  const z = P.entries(SRC);
  const pres = z.get('ppt/presentation.xml').toString('utf8');
  const rels = z.get('ppt/_rels/presentation.xml.rels').toString('utf8');
  const relMap = {};
  for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2].replace(/^\.\.\//, '');
  const order = [...pres.matchAll(/<p:sldId[^>]*r:id="([^"]+)"/g)].map(m => relMap[m[1]]).filter(n => /slides\/slide/.test(n));

  const out = [];
  order.forEach((name, i) => {
    const xml = z.get('ppt/' + name).toString('utf8');
    const title = P.slideText(xml.replace(/<a:tbl>[\s\S]*?<\/a:tbl>/g, ''))[0] || '';
    for (const rows of P.slideTables(xml)) {
      const hdr = rows[0] || [];
      const c00 = (hdr[0] || '').replace(/\s+/g, ' ').trim();
      if (!HEAD0.test(c00)) continue;
      if (hdr.filter(c => (c || '').trim()).length < 8) continue;
      const cols = hdr.map(c => (c || '').replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim());
      let heading = null;
      for (const r of rows.slice(1)) {
        const c0 = (r[0] || '').replace(/\s+/g, ' ').trim();
        if (!c0 || HEAD0.test(c0)) continue;
        const rest = r.slice(1).map(x => (x || '').trim()).filter(Boolean);
        if (rest.length === 0) { heading = c0; continue; }
        if (BENCH.test(c0)) continue;
        const rec = {};
        cols.forEach((h, ci) => { if (h) rec[h] = (r[ci] || '').replace(/\s*\|\s*/g, ' ').trim(); });
        out.push({ slide: i + 1, title, heading, name: c0, cols: rec });
      }
    }
  });
  return out;
}

if (require.main === module) {
  const rec = parse(process.argv[2]);
  fs.writeFileSync(process.argv[3], JSON.stringify(rec, null, 1), 'utf8');
  const byHeading = new Map();
  rec.forEach(r => { const k = r.title + '  ::  ' + (r.heading || '(no heading)'); if (!byHeading.has(k)) byHeading.set(k, []); byHeading.get(k).push(r.name); });
  console.log(`fund rows: ${rec.length}   groups: ${byHeading.size}\n`);
  for (const [k, v] of byHeading) { console.log(k + '   (' + v.length + ')'); v.forEach(n => console.log('      ' + n)); }
}
module.exports = { parse };
