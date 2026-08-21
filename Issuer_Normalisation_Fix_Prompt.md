# Prompt — fix debt "Top Issuers" fragmentation

Paste the section below into the other dashboard's project. It is written to stand alone: it
assumes no knowledge of the Proposal Playbook and no particular function or file names.

---

## The task

The **Top Issuers** table and the **Credit Rating Distribution** chart on the debt analytics
slide are fragmenting: one real-world issuer appears as several near-duplicate rows, so the
table shows instruments rather than issuers and each row's weight is understated.

Find the function that turns a raw holding name from the analytics workbook into a display
issuer name (in the Proposal Playbook it is `H.parseIssuer`, called from the debt aggregation),
and fix it as described. Do not change the aggregation maths — only the name normalisation.

## Root cause

The function strips coupon/series/maturity detail from the **front** of the holding name only:

```
7.85% Muthoot Finance Ltd.        ->  Muthoot Finance Ltd.     correct
```

The analytics source now writes that detail at the **back**, which the strip never sees:

```
Muthoot Finance Ltd. 7.85%        ->  Muthoot Finance Ltd. 7.85%
Muthoot Finance Ltd. OP I 08.52%  ->  Muthoot Finance Ltd. OP I 08.52%
Muthoot Finance Ltd. -362D        ->  Muthoot Finance Ltd. -362D
```

Three rows instead of one, each with a fraction of the true weight. Check both name layouts —
older files may still use the leading form, so keep that strip as well.

## What the fix must handle

**1. Strip instrument detail from the tail.** Coupon (`7.85%`, `07.55%`), series
(`SR-XXV`, `SR.181`, `SR-G1`, `TR-1`, `OP I`), tenor (`-362D`) and trailing markers
(`PERP`, `CALL`, `BD`).

**2. Order matters — trailing bracket first.** The source contains truncated and misspelled
dates that leave an **unclosed** bracket:

```
Tata Capital Housing Finance Ltd. 8.10% (13-Dec-28
PNB Housing Finance Ltd 8.05% (06-Febr-2030
```

If the trailing parenthetical is stripped last, the open bracket shields the coupon in front of
it and the `%` survives. Strip the trailing `(...)` — closed or not — **before** the coupon.

**3. Loop the tail cleanup.** Coupon, series and maturity arrive in any order, so run the
replacements in a small loop (4 passes is plenty) until the string stops changing.

**4. Treasury bills — special case, and easy to get wrong.** The source names every maturity
separately, so they produce a row per bill:

```
91 Days Treasury Bill - 06-Aug-2026
182 Days Treasury Bill - 21-Aug-2026
364 Days Treasury Bill - 04-Mar-2027
```

Worse, the leading `91` / `182` / `364` looks exactly like a coupon to the leading strip, so it
gets eaten and the issuer becomes `Days Treasury Bill - 06-Aug-2026`. Match treasury bills
**before** any stripping and collapse them all to a single `Treasury Bills`.

**5. State Development Loans — same shape.** `Gujarat SDL - 08-Feb-2035`,
`Madhya Pradesh SDL - 08-Feb-2033`, one string per state and maturity. Collapse to the issuing
state (`Gujarat SDL`), not to a single blob — the state is the issuer and worth keeping. Match
this before the generic stripping too, and allow for a leading coupon on the SDL name.

**6. Keep the existing early returns** for `GOI` / `G-Sec` / `Government of India`, `TREPS` /
`Tri-Party Repo`, `Clearing Corporation`, and add `Net Current Asset`.

**7. Do not strip the trailing full stop.** It belongs to `Ltd.` — a cleanup of trailing
punctuation will silently turn `Muthoot Finance Ltd.` into `Muthoot Finance Ltd` and produce a
second issuer that differs from the bond-side name by one character. Strip trailing spaces,
dashes and commas only.

## Reference implementation

```js
function parseIssuer(name) {
  let s = (name || "").trim();
  if (/GOI|G-Sec|Government of India/i.test(s)) return "Government of India";
  if (/TREPS|Tri-Party Repo/i.test(s)) return "Tri-Party Repo (TREPS)";
  if (/Clearing Corporation/i.test(s)) return "Clearing Corporation of India Ltd.";
  if (/treasury\s*bill|\bT-?bills?\b|\bDTB\b/i.test(s)) return "Treasury Bills";
  if (/net\s*current\s*asset/i.test(s)) return "Net Current Asset";

  const sdl = s.match(/^\s*(?:\d+(?:\.\d+)?\s*%?\s*)?(.+?)\s+SDL\b/i);
  if (sdl) return sdl[1].replace(/\s+/g, " ").trim() + " SDL";

  s = s.replace(/^\d+(\.\d+)?%?\s+/, "");                 // leading coupon
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s.replace(/\s*\([^)]*\)?\s*$/, "");                // trailing (...) even if unclosed
    s = s.replace(/\s+\d{1,2}[-/]?[A-Za-z]{3,4}[-/]?\d{2,4}\b\.?/g, "");
    s = s.replace(/\s*[-–—]?\s*\bSR[-.\s]?\s?[A-Za-z0-9]+\b/g, "");
    s = s.replace(/\s*[-–—]?\s*\bTR[-\s]?\d+\b/g, "");
    s = s.replace(/\s*\bOP\s+[IVX]+\b/g, "");
    s = s.replace(/\s*[-–—]?\s*\d+(\.\d+)?\s*%/g, "");     // coupon anywhere on the tail
    s = s.replace(/\s*[-–—]\s*\d+\s*D\b/gi, "");           // "-362D"
    s = s.replace(/\s+(PERP|CALL|BD)\b/gi, "");
    s = s.trim();
    if (s === before) break;
  }
  s = s.replace(/[\s\-–—,]+$/, "").trim();                 // never the full stop

  if (s === s.toUpperCase() && /[A-Z]/.test(s)) {
    s = s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
         .replace(/\bLtd\b/, "Ltd").replace(/\bLimited\b/, "Limited");
  }
  return s;
}
```

## How to verify

These inputs must map exactly as shown:

| Input | Expected |
|---|---|
| `91 Days Treasury Bill - 06-Aug-2026` | `Treasury Bills` |
| `364 Days Treasury Bill - 04-Mar-2027` | `Treasury Bills` |
| `Muthoot Finance Ltd. 7.85%` | `Muthoot Finance Ltd.` |
| `Muthoot Finance Ltd. OP I 08.52%` | `Muthoot Finance Ltd.` |
| `Muthoot Finance Ltd. -362D` | `Muthoot Finance Ltd.` |
| `Poonawalla Fincorp Ltd. SR-G1 TR-1 07.55%` | `Poonawalla Fincorp Ltd.` |
| `Bharti Telecom Ltd. -SR-XXV 07.35%` | `Bharti Telecom Ltd.` |
| `Tata Capital Housing Finance Ltd. 8.10% (13-Dec-28` | `Tata Capital Housing Finance Ltd.` |
| `Indian Railway Finance Corpn Ltd. SR.181 07.37% (31-July-2029` | `Indian Railway Finance Corpn Ltd.` |
| `7.26% Gujarat SDL - 08-Feb-2035` | `Gujarat SDL` |
| `05.74% GOI - 15-Nov-2026` | `Government of India` |
| `Tri-Party Repo (TREPS)` | `Tri-Party Repo (TREPS)` |
| `Axis Bank Ltd. (18-Aug-2026)` | `Axis Bank Ltd.` |
| `Small Industries Development Bank of India (14-Jan-2027)` | `Small Industries Development Bank of India` |

Then sweep every holding in the debt and hybrid analytics stores and assert on the normalised
set — this is what actually proves it, since the table shows whatever survives:

```js
const norm = new Set();
for (const v of Object.values(window.DEBT_ANALYTICS))  (v.holdings || []).forEach(h => norm.add(parseIssuer(h.issuer)));
for (const v of Object.values(window.HYBRID_ANALYTICS)) (v.db_holdings || []).forEach(h => norm.add(parseIssuer(h.issuer)));
const arr = [...norm];
console.log({
  distinct:       arr.length,
  strayPercent:   arr.filter(n => /%/.test(n)).length,        // must be 0
  unclosedParen:  arr.filter(n => /\([^)]*$/.test(n)).length, // must be 0
  empty:          arr.filter(n => !n.trim()).length,          // must be 0
  sdlRows:        arr.filter(n => /\bSDL\b/i.test(n)).length, // ~one per state, not per maturity
});
```

Also confirm nothing regressed: bond records carry their own issuer field and must be
unaffected, and a portfolio's issuer weights should still total the same as before — the rows
merge, the total does not move.

For reference, on the Proposal Playbook's July-2026 data this took **2,617 raw issuer strings
down to 555 distinct issuers**, SDLs from 646 to 34, with zero stray percentages, zero unclosed
brackets and zero empty names. Your numbers will differ; the three zeros should not.

## Related issue worth checking while you are in there

The credit-rating chart may not total 100%. If the analytics parser stores only each fund's top
N debt holdings (`.slice(0, 20)` in the Proposal Playbook), the tail is missing and the chart
sums to roughly 98%. Chart.js normalises a doughnut to the sum of its values, so it still looks
full while every slice is slightly overstated. That is a separate decision — raising the cap
grows the embedded data — but check whether the same cap exists before concluding the chart is
correct.
