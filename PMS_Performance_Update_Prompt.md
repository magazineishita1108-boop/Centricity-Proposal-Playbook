# Monthly PMS Scheme Performance Update — Prompt & Spec

**Use:** every month, attach the new `PMS_Scheme_Performance_<Month Year>.xlsx` (template: `PMS_Scheme_Performance_Template.xlsx` in this folder) and paste the prompt below.

---

## PROMPT (paste this with the file attached)

> Monthly PMS performance update for the Proposal Playbook dashboard. Attached is `PMS_Scheme_Performance_<Month Year>.xlsx`. Apply it to `index.html` exactly per `PMS_Performance_Update_Prompt.md` in this folder: REPLACE `window.PMS_PERFORMANCE.pms` with all schemes in the file (merged exit-load statements, standard unit conversions), leave `aif` + `benchmarks` untouched, keep `window.PMS_PERF_ALIAS` in sync, stamp `DATA_DATES.pms` from the filename, then run the full verification checklist and show me the matcher simulation result before finishing. Flag any scheme renames, new schemes, or schemes that dropped out vs last month.

---

## FILE FORMAT ACCEPTED (either)

1. **Template format** — single sheet `PMS Performance`, one merged `Exit Load` column, optional `Top Sector (%)` column.
2. **Raw vendor format** — sheet `PMS Performance` with `Exit Load 1 Year / 2 Year / 3 Year` columns (auto-merged) + optional `Top Sector` sheet (Scheme Name | Top Sector Value).

Join key = **Scheme Name** (`AMC - Strategy`). Renames must be flagged in chat, else old scheme drops + "new" one appears.

## PROCESSING RULES

- **Missing data** (blank, `-`, `NA`, `#N/A`, `Undis.`): store nothing (field omitted → dashboard keeps embedded value via non-null merge). In the template sheet, show `-`.
- **AUM**: raw ₹ if value > 10 lakh → divide by 1e7 to ₹ Cr; else already Cr. Round 2 dp.
- **Returns 1M/3M/6M/1Y/2Y/3Y/5Y/SI**: numbers in % terms (5.60 = 5.60%) → store as fractions (0.056), 6 dp.
- **SD 1Y/3Y, Alpha 1Y/3Y**: in % terms (15.15 = 15.15%) → fractions, keys `sd1y sd3y alpha1y alpha3y`.
- **Sharpe/Sortino/Beta 1Y/3Y, P/E**: plain ratios, stored as-is (`sharpe1y sharpe3y sortino1y sortino3y beta1y beta3y pe`).
- **M-cap Large/Mid/Small**: % → fractions; `mcap_other` = max(0, 1 − (L+M+S)) only when all three present; `Undis.` → all omitted.
- **Top Sector** → `top_sector_pct` fraction.
- **Exit-load merge grammar** (1Y/2Y/3Y → one statement; partial missing treated as 0, all missing → omit field):
  - all zero → `Nil`
  - 3/0/0 → `3% for 1 year, Nil thereafter`
  - 2/1/0 → `2% for 1 year, 1% for 2nd year, Nil thereafter`
  - 3/2/1 → `3% for 1 year, 2% for 2nd year, 1% for 3rd year, Nil thereafter`
  - equal consecutive years compress: 1/1/1 → `1% for 3 years, Nil thereafter`; 1.5/1/1 → `1.5% for 1 year, 1% for 2nd year & 3rd year, Nil thereafter`
  - rates formatted without trailing zeros: `3%`, `1.5%`, `0.75%`

## WHERE IT LANDS (index.html)

- `window.PMS_PERFORMANCE = {pms, aif, benchmarks}` — **REPLACE `pms` wholesale** with the file's schemes (confirmed semantics; schemes absent from the new file are dropped → those funds revert to embedded MASTER data, per 17-Jul-2026 decision). `aif` + `benchmarks` are carried forward verbatim (PMS-only file). Update the comment header above the block with the new as-on date.
- `window.PMS_PERF_ALIAS` — pins every MASTER PMS fund name → exact file key; `null` = never match (blocks fuzzy false positives, e.g. Karma Capital Wealth Builder → Fractal Capital - Wealth Builder at ≥3 shared tokens). **Maintain when**: a MASTER PMS fund is added/renamed, or a previously-absent scheme (re)appears in the file (replace its `null` with the file key). AIF funds are not in the map and still fuzzy-match (threshold ≥3).
- `applyPmsPerformance()` copies (non-null only): returns, `si`, `aum`, `exit_load`, `pe`, mcap splits, `sd1y/3y`, `sharpe1y/3y`, `sortino1y/3y`, `alpha1y/3y`, `beta1y/3y`, `top_sector_pct`.
- `window.DATA_DATES.pms` — stamp "30th <Month> <Year>" (filename-authoritative).

## VERIFICATION CHECKLIST (mandatory, after every refresh)

1. Backup first: `index.html.bak_pmsperf_<yyyymmdd>`.
2. New `PMS_PERFORMANCE` line JSON-parses; scheme count = file row count; file still ends `</html>`.
3. **Simulate the matcher end-to-end** (extract MASTER + map + alias + function from the saved file, execute): every MASTER PMS fund resolves to its pinned key or cleanly to none; no file scheme claimed twice; AIF matches unchanged (11 as of Jun-2026).
4. Spot-check ≥3 schemes raw→backend (AUM ÷1e7, one exit-load merge, one SD/alpha fraction, mcap_other derivation).
5. Diff scheme names vs previous month: report new / dropped / likely-renamed (similar name, similar AUM) to the user.
6. Verify edits via **Read tool** on index.html (bash mount can be stale mid-session — see memory note; if bash mount is stale, use a runtime override sibling instead of baking).
7. Remind: deploy = upload `index.html` to GitHub Pages repo (magazineishita1108-boop/Centricity-Proposal-Playbook). `Centricity_Dashboard.html` sister copy has drifted (Jun-2026) — do not sync unless asked.

## KNOWN DATA GAPS (Jun 2026)

- All UNIFI schemes: AUM + returns blank in vendor file → dashboard keeps older embedded values (exit loads did update). Chase UNIFI numbers if needed.
- 7 schemes have no exit-load data (`NA`) → existing dashboard text retained.
- Not in file, reverted to embedded per user decision: Motilal Oswal Founders, Emkay Golden Decade, Burman Capital, TCG Transformative Growth, Karma Capital Wealth Builder (+ Julius Baer, Abakkus Diversified Alpha, and the 3 Debt PMS were never in it).
