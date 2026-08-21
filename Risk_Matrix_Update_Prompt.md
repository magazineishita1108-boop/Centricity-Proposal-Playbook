# Portfolio Matrix — Monthly Risk Matrix Refresh

**What this does.** Regenerates the **Portfolio Matrix** tab's data (`window.RISK_MATRIX`) from that month's
NAV Data workbook and refreshes the dashboard. As of 2026-07-24 the matrix is **baked inline inside
`index.html`** (self-contained — no external sibling needed). `build_risk_matrix.py` still emits a
standalone `Centricity_Risk_Matrix.js` (handy as the generator's output / a diff reference), but the live
dashboard reads the inline copy.

**Give me each month:** the new `NAV Data as on <date>.xlsx` (same 3 sheets: `NAV Data-MF`,
`CATEGORY FOR MF`, `NAV Data-Benchmark`). MASTER fund names come from the current `index.html`.

## Steps
1. Generate the matrix JS:
   ```
   python3 build_risk_matrix.py  "NAV Data as on <date>.xlsx"  "index.html"  "<AS_ON e.g. 31 Jul 2026>"  "Centricity_Risk_Matrix.js"
   ```
2. **Bake it into `index.html`** — replace the existing inline block (the `<script>` element that contains
   `window.RISK_MATRIX = {…}` … `window.RISK_MATRIX_BENCH_SD = {…}`) with the freshly generated content.
   (First time it replaced the old `<script src="Centricity_Risk_Matrix.js">` tag.) Back up index.html first
   (`index.html.bak_matrixbake_<date>`).
3. Deploy `index.html`. The Portfolio Matrix tab and its PPT slide both read `window.RISK_MATRIX` at runtime.

## Output schema (per fund, keyed by exact MASTER name)
`c`=3Y CAGR%, `be`=Beta, `sd`=StdDev%, `so`=Sortino, `sh`=Sharpe, `ir`=Info Ratio, `dc`=Down Capture% (1dp),
`al`=Alpha (derived), `co`=Correlation (derived), `bm`=Benchmark, `rr`=3Y Rolling avg%. Eligible (≥250 NAV
days in the 3Y window) get all fields; ineligible get `bm` only; rolling-computed add `rr`. Equity-only →
debt/hybrid render "—". Also sets `window.DATA_DATES.riskMatrix='<AS_ON>'` and `window.RISK_MATRIX_BENCH_SD`.

## Method (baked into `build_risk_matrix.py` — don't change without re-verifying)
- **Base metrics** per the "3Y Rolling + Risk Ratios" spec. Benchmark returns aligned to **each fund's own
  NAV dates** (NOT the full calendar) — special exchange sessions make every eligible fund gappy; the wrong
  alignment silently distorts Beta / TE / Capture / Info.
- **Category → benchmark:** Large→NIFTY 100 TRI · Mid→Midcap 150 TRI · Small→Smallcap 250 TRI · else→NIFTY 500 TRI.
- **Rolling `rr`:** begin = every **market trading day** in [D_5Y, D_3Y] (≈496 for a full fund); begin & end
  NAV = nearest prior fund NAV; average of (End/Begin)^(1/3)−1. Only funds with a NAV on/before D_5Y.
- **Alpha `al`** = Rp−[rf+β(Rb−rf)], Rb=Rp−IR·TE, rf=4.5% — from the 2dp published values.
- **Correlation `co`** = β·σ_bench/σ_fund, cap 0.999; σ_bench = median over each index's funds of
  √((TE²−SD²)/(1−2β)) (full precision; 2dp value stored in `RISK_MATRIX_BENCH_SD`). Rounded 3dp.
- **Rounding:** most 2dp; `dc` 1dp; `co` 3dp.
- **Join:** NAV name → MASTER name. Exact match, else swap `(IDCW…)`→`(G)` / strip share-class to the unique
  equity MASTER fund.

## Verify before deploying
- `joined == NAV funds` (0 unjoined). Investigate any unjoined name.
- Counts reconcile: records-with-metrics = eligible; records-with-`rr` = rolling-computed.
- Inline block parses: 1088 keys (30-Jun), `window.MASTER` still intact, file ends with `</html>`.
- Spot-check 2 funds vs the `Risk Ratios` workbook sheet.
- **Re-confirm Rf = 4.5%** is still the desk convention (current repo ~5.25% / 91-day T-Bill ~5.26% are higher).

*30-Jun-2026 baseline reproduces the earlier deployed sibling exactly on every base metric + Alpha + rolling;
12 correlations differ by 0.001 (third-decimal rounding).*
