// Locate and parse a `window.X = {...}` / `[...]` literal inside index.html, and splice a new
// value back in. Brace-matching respects strings and escapes, so a name containing a bracket
// cannot end the scan early.
const fs = require('fs');

function matchEnd(s, start) {
  const open = s[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return i; }
  }
  throw new Error('unbalanced literal from offset ' + start);
}

function locate(html, prefix) {
  const i = html.indexOf(prefix);
  if (i < 0) throw new Error('not found: ' + prefix);
  const s = i + prefix.length;
  const open = html[s];
  if (open !== '{' && open !== '[') throw new Error(prefix + ' is not followed by a literal');
  const e = matchEnd(html, s);
  return { s, e, value: JSON.parse(html.slice(s, e + 1)) };
}

function read(file, prefix) { return locate(fs.readFileSync(file, 'utf8'), prefix); }

// Splice several blocks in one pass; writes from the end backwards so earlier offsets stay valid.
function writeBlocks(file, updates) {
  let html = fs.readFileSync(file, 'utf8');
  const spots = updates.map(u => ({ ...locate(html, u.prefix), value: u.value, prefix: u.prefix }));
  spots.sort((a, b) => b.s - a.s);
  for (const sp of spots) html = html.slice(0, sp.s) + JSON.stringify(sp.value) + html.slice(sp.e + 1);
  if (!html.trimEnd().endsWith('</html>')) throw new Error('output does not end with </html>');
  fs.writeFileSync(file, html, 'utf8');
  return html.length;
}

module.exports = { locate, read, writeBlocks, matchEnd };
