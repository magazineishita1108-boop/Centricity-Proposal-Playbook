// Pull the per-product narrative slides: the "About" prose and the Particulars/Details grid.
// These feed `rationale` and `details` for the PMS / AIF / Unlisted / Gift City entries, which
// have no risk ratios and are rendered as a label/value list instead.
const P = require('./pptx');

const NOISE = /^(About\s*:?|Fee Structure|Fee|Structure|Corpus|Particulars|Details|Top \d+ Holdings|Top Holdings|Top Sectors|Top \d+ Sectors|Weight|Weight %|Allocation %|Fixed|Hybrid|Variable|Performance|Past Fund Perf|Fund Performance|Disclaimer|\d+|Mngmt\. Fees|Management Fees?)$/i;

function slides(SRC) {
  const z = P.entries(SRC);
  const pres = z.get('ppt/presentation.xml').toString('utf8');
  const rels = z.get('ppt/_rels/presentation.xml.rels').toString('utf8');
  const relMap = {};
  for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2].replace(/^\.\.\//, '');
  const order = [...pres.matchAll(/<p:sldId[^>]*r:id="([^"]+)"/g)].map(m => relMap[m[1]]).filter(n => /slides\/slide/.test(n));
  return order.map((n, i) => {
    const xml = z.get('ppt/' + n).toString('utf8');
    const body = P.slideText(xml.replace(/<a:tbl>[\s\S]*?<\/a:tbl>/g, ''));
    return { no: i + 1, body, tables: P.slideTables(xml), xml };
  });
}

// Boilerplate that is longer than the real "About" text and would otherwise win on length.
// The unlisted-equity slides carry a ~900-character risk disclaimer; the description is ~500.
const BOILERPLATE = /AMFI Registration Number|Mutual Fund Distribution Services|read all scheme related documents|past performance is not indicative|expressly disclaims|Prospective investors|subject to market risk/i;

// Longest paragraph on the slide that reads like prose, minus the boilerplate.
function about(sl) {
  const seen = new Set();
  const cands = sl.body.filter(t => {
    if (t.length < 120) return false;
    if (BOILERPLATE.test(t)) return false;
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
  cands.sort((a, b) => b.length - a.length);
  return cands[0] || '';
}

// The fund-fact grid -> [{label, value}].
//
// Only the table the deck heads "Particulars | Details" (or "Fund Structure") counts. Every
// product slide also carries 2-column Top Holdings / Top Sectors / strategy-allocation tables,
// and taking those too turned an 11-row fact card into a 35-row dump of stock weights.
const FACT_HEAD = /^(Particulars|Fund Structure|Details)$/i;
function details(sl) {
  for (const rows of sl.tables) {
    const w = Math.max(...rows.map(r => r.length));
    if (w !== 2) continue;
    const h0 = (rows[0][0] || '').replace(/\s+/g, ' ').trim();
    if (!FACT_HEAD.test(h0)) continue;
    const out = [];
    for (const r of rows.slice(1)) {
      const l = (r[0] || '').replace(/\s+/g, ' ').trim();
      const v = (r[1] || '').replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if (!l || !v || NOISE.test(l)) continue;
      if (out.some(d => d.label === l)) continue;
      out.push({ label: l, value: v });
    }
    if (out.length) return out;
  }
  return [];
}
module.exports = { slides, about, details };
