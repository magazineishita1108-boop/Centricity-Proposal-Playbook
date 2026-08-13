# Centricity Proposal Playbook — working notes for Claude Code

Internal investment-proposal builder for the Centricity Products team (HNI / UHNI / Family Office).
No backend, no database, no build step: `index.html` is a single self-contained React page with the
entire fund universe embedded in `<script>` tags.

**Authoritative spec:** `Centricity_Dashboard_PRD.docx` (30-Jul-2026). This file is the short
operating manual; the PRD has the full feature history and rationale. Where they disagree, the
live code wins — see *Verifying* below.

Owner/admin: Rahul Yadav (rahul.yadav@centricity.co.in). Verified against the live files 31-Jul-2026.

---

## The one rule that breaks production

**A deploy is SIX files, not one.** `index.html` alone silently reverts the dashboard to an older
state — no error, just stale data.

```
index.html
Centricity_ExtraSlides.js
Centricity_PMS_AIF_Terms.js
Centricity_June_Refresh.js
Centricity_IRR_Offshore.js
Centricity_SIF_Refresh.js
```

Load order is fixed and load order matters:

| # | Loaded at | File | Mutates | Effect on `window.MASTER` |
|---|---|---|---|---|
| 1 | L836 | `Centricity_ExtraSlides.js` | `EXTRA_SLIDES` | — (independent of MASTER, so it can load early) |
| 2 | L837 | `Centricity_PMS_AIF_Terms.js` | `PMS_AIF_TERMS` (73) | — |
| 3 | L4189 | `Centricity_June_Refresh.js` | `MASTER`, `EQUITY_ANALYTICS`, `DATA_DATES` | 7452 → 7456 |
| 4 | L4190 | `Centricity_IRR_Offshore.js` | `MASTER`, `BENCHMARKS`, `RATIONALE`, `LIQUIDITY_MAP` | 7456 → 7456 (reclassifies 4 → `Offshore Funds`) |
| 5 | L4191 | `Centricity_SIF_Refresh.js` | `MASTER`, `DATA_DATES`, `REFRESH`, `BENCHMARKS` | 7456 → 7460 (SIF 12 → 28) |

- #4 must load **after** #3 — it edits the GIFT City bucket #3 installs.
- #5 must load **after** #4 — otherwise a fund-name collision.
- Each sibling is idempotent-guarded (`window.__JUNE_REFRESH_APPLIED` etc.) and re-applies on
  *every page load*. Folding them into the embedded blocks and deleting them is the standing
  intent — still outstanding for #3, #4, #5.

`Centricity_Risk_Matrix.js` is **NOT** loaded — no `<script src>` points at it. Since 24-Jul-2026
its content is baked inline (see L4192). It survives only as `build_risk_matrix.py`'s output.
Do not re-add a script tag for it without first checking the inline block would not be duplicated.

---

## Files: what to touch

| File | Status |
|---|---|
| `index.html` | **LIVE — this is the one you edit** |
| the 5 siblings above | **LIVE — ship with index.html** |
| `Centricity_Dashboard.html` | **DEPRECATED.** Predecessor, last synced 22-Jun-2026, missing later features. An edit to `index.html` does *not* apply to it. Confirm before touching. |
| `README.md` | **STALE — do not follow it.** Documents `tools/build_*.py` scripts, a GitHub Pages repo and `cdnjs.cloudflare.com`. None exist: the folder has **zero subfolders** (no `tools/`, no `.git`) and the CDNs are actually unpkg + jsdelivr. |
| `build_risk_matrix.py` + `Risk_Matrix_Update_Prompt.md` | LIVE — the monthly Portfolio Matrix runbook |
| `PMS_Performance_Update_Prompt.md` | LIVE — monthly PMS performance runbook |
| `*_Build_Prompt.md` | Historical build specs, reference only |
| `*.bak*`, `*.broken*` | 49 rollback snapshots. Archive candidates >60 days old. |

74 files, ~298 MB, flat (no subfolders).

---

## Architecture map

`index.html` — 10,404,383 bytes, 7,853 lines, ends `</body></html>`.
Line numbers below are as of 28-Jul-2026 and **drift with every edit** — re-derive, don't trust.

| Line | Block |
|---|---|
| L828–832 | CDN: React 18.3.1, ReactDOM, Chart.js 4.4.0, SheetJS 0.18.5, PptxGenJS 3.12.0 |
| L833 | `CENTRICITY_LOGO` (base64) |
| L834 | `DIRECT_PERF` — 1,688 funds (Regular/Direct plan toggle overlay) |
| L836–837 | siblings 1–2 |
| L838 | header comments |
| **L1031** | **`MASTER` — 7,452 records (the baseline universe)** |
| L1032 | `EQUITY_ANALYTICS` 1,110 · `HYBRID_ANALYTICS` 199 · `DEBT_ANALYTICS` 490 |
| L1037 | `CENTRICITY_SELECT` — 149 |
| L1041 | `MF_BENCHMARK_PERF` — 26 categories |
| L1045 | `DATA_DATES` (4 keys here; a 5th, `riskMatrix`, is added at L4192) |
| L1043 / L1428 | `window.H` helpers + extensions |
| L2161 | Risk profiles, strategy options, benchmark mapping |
| L2194 | `PMS_PERFORMANCE` → `pms` 314 · `aif` 11 · `benchmarks` 4 |
| L2401 | In-browser xlsx parsers (the Section 7 uploaders) |
| L2971 | Excel + PowerPoint export |
| L4189–4191 | siblings 3–5 |
| **L4192** | **`RISK_MATRIX` — 1,088 funds, baked inline** + `RISK_MATRIX_BENCH_SD` |
| L4202 | UI primitives + Sections 1–3 |
| L5827 | Section 4 + Section 5 Master Editor |
| L7316 | Main App (`ReactDOM.createRoot`) |

`window.MASTER` is also assigned at L2629, L2829, L2949, L7593–94, L7629–30 — those are **runtime
uploader / add-fund handlers**, not data blocks. Only L1031 is the baseline.

### Effective in-browser universe (after all five siblings run): **7,603**

Direct Equity 5,353 · Bonds 50 (Invictus 36 · OneDigital 14) · SIF 28 · the rest as before.

`EQUITY_ANALYTICS` 1,152 · `HYBRID_ANALYTICS` 246 · `DEBT_ANALYTICS` 495 · `DIRECT_PERF` 1,676 ·
`MF_BENCHMARK_PERF` 47 · `RISK_MATRIX` 1,088.

Effective `DATA_DATES`: performance / analytics = `31st July 2026`, pms = `30th June 2026`,
`riskMatrix` = `30 Jun 2026`, **`sif` = `—` (still unset)**.

**`Centricity_June_Refresh.js` used to stamp `DATA_DATES.analytics = "30th June 2026"` on every
page load**, silently reverting any later analytics bake. Removed 13-Aug-2026. If an as-on date
ever refuses to stick, check the siblings before the embedded block.

---

## Traps

**`product_class: "Mutual Funds"` (plural) is deliberate — do not "fix" it.** All 67 such records are
`asset_class: "Global Funds", sub_category: "International"`. It is a real marker for international
feeder funds, listed separately in `PC_ORDER` (L1082) and explicitly filtered out of the main product
list at L4509. Singular `"Mutual Fund"` (1,200) is the domestic MF bucket. Merging them breaks the
Global Funds tab.

**OneDrive / bash-mount staleness.** The Linux sandbox's view of large files here lags edits made
through the Edit tool, in both directions. Never trust a bash-side `node --check` or `grep` on
`index.html`. Verify by reading the specific changed line ranges, or via PowerShell/Node on the
Windows path.

**Multi-megabyte lines.** `EQUITY_ANALYTICS` is a single 6.7 MB line; `MASTER` is 2.4 MB. PowerShell
`-match`/`-replace` on these hangs for minutes. Use Node (`fs.readFileSync` + index arithmetic) or
`Grep` with `-o`. Never `Read` the whole file.

### Data-hygiene traps on every refresh

- Non-breaking spaces and doubled internal spaces in security / sector / scheme names (seen in
  Direct Equity and PMS sources) — normalise before matching or you get large numbers of fake
  adds and fake changes. Trailing spaces exist in live data (`"Kotak Optimus Fund (Moderate 50:50) "`).
- Footer rows in MF Monitor sheets (`Average`, `BenchMark`, bare index names) must not parse as funds.
- Exit-load text cells (`Nil`, `.`, `No Option`, `NA`) mean *missing*, not zero. Only a numeric
  `0.00%` run becomes the word "Nil".
- Bond maturity dates have a recurring century typo (2030 stored as 1930) — parse the date from the
  issuer-name string, not the date cell. (`merge_bond_list.js` does this and reports any
  name-vs-cell disagreement. The 06-Aug-2026 workbook arrived with the typo already corrected,
  but an earlier copy of the same file still had it — always re-check.)
- The Bond List repeats the same bond in two formats within one sheet
  (`7.7942 L&T FINANCE LIMITED 27JUN2031` and `7.7942% L& T Finance 2031`), and sometimes drops
  the coupon entirely (`NAVI FINSERV 31.08.2029`). Dedupe on issuer + maturity, not on the name.
- Reclassifying a fund without checking for an existing same-named record silently creates a
  duplicate. There are currently **0 duplicate names** in the effective MASTER — keep it that way.
- `sebi_mcap` must be joined **by company name, not row position** (this bug shipped for ~8 months,
  fixed 28-Jul-2026). Regression gate: after any Direct Equity refresh, the top 10 stocks by market
  cap must all read "Large Cap".

---

## Running it locally

```bash
node .claude/serve.js
```

Serves the project folder on http://localhost:8080 (also wired as the `playbook` preview config in
`.claude/launch.json`). Use http, not `file://` — the siblings load fine either way but the export
paths and uploaders don't. Confirm on load: universe reads **7460 instruments** and the console is
clean. Needs internet for the five CDN libraries.

---

## Monthly source files

Rahul drops these each cycle. June 2026 set lives at:

`Desktop\AI Dashboard Updates\For Centricity Proposal Playbook Portal\<Month Year>\`

| File | Feeds |
|---|---|
| `Daily MF Monitor_<date>.xlsx` | `MASTER` performance |
| `Daily MF Monitor_Direct_<date>.xlsx` | `DIRECT_PERF` overlay |
| `Analytics\Equity Analytics_<Month>.xlsx` | `EQUITY_ANALYTICS` |
| `Analytics\Hybrid Analytics_<Month>.xlsx` | `HYBRID_ANALYTICS` |
| `Analytics\Debt Analytics_<Month>.xlsx` | `DEBT_ANALYTICS` |
| `Analytics\Listed Direct Equity_<Month>.xlsx` | Direct Equity sector / mcap / ISIN (**join `sebi_mcap` by name**) |
| `Listed Direct equity_<date>.xlsx` *(Desktop root)* | Direct Equity **returns** → `merge_direct_equity_returns.js` |
| `NAV Data as on <date>.xlsx` | `RISK_MATRIX` via `build_risk_matrix.py` |
| `3Y Rolling + Risk Ratios - MF (as on <date>).xlsx` | spot-check reference for the above |
| `SIF Master List_<Month Year>.xlsx` | `Centricity_SIF_Refresh.js` |
| `Exit Load_MF_<Month>.xlsx` | exit-load text (2-col Name→Remark since Jul-2026) |
| `Monthly Outlook Pagers- <Month Year>.pptx` | `EXTRA_SLIDES.market` |

**Two files share the "Listed Direct Equity" name and are not interchangeable.** The one in
`Analytics\` carries sector / industry / market cap / ISIN (~5,300 rows). The one at the Desktop
root carries the price returns (~8,400 rows) and nothing else. Only the second one feeds returns.

**Expense ratio and exit load ARE wired** (corrected 13-Aug-2026 — an earlier note here said they
weren't). `MASTER.expense` and `MASTER.exit_load` both exist and are ~99% populated. Refresh with:

```bash
node merge_expense_exitload.js --expense "<Expense ratio_<Month>.xlsx>" --exitload "<Exit Load_MF_<Month>.xlsx>"
```

The expense workbook's **`Ratio`** column is the total TER that `expense` holds (verified against
the embedded value). The **Regular row also carries `Direct Plan Ratio`**, so one row feeds both
plans — `MASTER.expense` and `DIRECT_PERF[].expense`. Sanity bound is 8%, not the usual 2.25% MF
cap: SIF / long-short schemes in this universe genuinely run 4–6%+.

**Not wired to anything yet** — no field exists in `MASTER`: `AMFI CODE.xlsx`,
`Fund Manager_MF_<Month>.xlsx` ("Fund Manager" appears only as free text inside
`CENTRICITY_SELECT` Reckoner rationales). Adding them is a feature, not a refresh.

### Changes shipped 31-Jul-2026

1. **MF Monitor as-on date** — Section 7's MF Monitor card now has an "As on date" picker
   mirroring SIF's. `REFRESH.parseMfMonitor(file, {asOn})`; precedence is picker → file name →
   in-file date. Worth having: the 30-Jun workbook's *internal* date is 29 June.
2. **Direct Equity returns** — `r3m/r6m/r1y/r2y/r3y/r5y` baked onto Direct Equity records, shown
   as pills in the pick list and as a new **"Listed Direct Equity"** bucket in the Performance
   Sheet (on-screen, Excel and PPT). Re-run each month (dry run first, always read the gates):

   ```bash
   node merge_direct_equity_returns.js "<Desktop>/Listed Direct equity_<date>.xlsx"
   ```

   Add `--apply` to write. `--html <path>` overrides the target; it defaults to `index.html`
   beside the script. Needs `npm install xlsx@0.18.5`.
3. **No-holdings funds excluded from analytics** — `H.hasEqHoldings` / `H.hasDbHoldings` gate both
   the chip list and the aggregation. Removed two fallbacks that fabricated data: an equity
   fund-level mcap guess that added exposure but no sectors/stocks (diluting every percentage),
   and a debt "80% AAA / 20% SOV" profile that put invented numbers in a client-facing credit
   chart. Excluded names are listed under the chips rather than dropped silently.
4. **Allocation sheet round-trip** — "⬇ Allocation Sheet" / "⬆ Upload Allocation" in the Section 4
   download bar. Five columns only (Asset Class, Product Class, Instrument Name, % Total,
   Amount (Cr.)). The reader takes any column order, derives % from Amount when there's no %
   column, rescales 0–1 fractions (Excel percent formatting) and reports unmatched names.
5. **Closest-name matching on re-upload** — `H.resolveFundName(name, H.buildFundIndex(master))`,
   tiered: exact → case/space-normalised → **plan-suffix stripped** → unique prefix → token
   similarity. Hand-typed names usually omit the plan suffix ("ICICI Pru Equity Savings Fund"
   for `…Fund-Reg(G)`).

   **`H.planBaseName` strips a whitelist only** — `(G)`, `(IDCW)`, `(D)`, `(Growth)`,
   `(Dividend)`, `-Reg`, `-Dir`. Do NOT widen it to generic parentheses: `(Inbound)`,
   `(Outbound)`, `(OneDigital)`, `(Invictus)`, `(Lock in)`, `(SFoF II)` distinguish genuinely
   different instruments. As written only 5 of 7,455 base groups collide, all benign.

   The similarity tier requires **every** meaningful typed word to be present in the candidate,
   so "HDFC Mid Cap Fund" can never land on "HDFC Small Cap Fund", and it returns *ambiguous*
   rather than picking when two candidates tie (e.g. a bond offered by both desks). Ties prefer
   Growth over IDCW and Regular over Direct. Anything not matched verbatim is listed in the
   status line — this allocates real money, so substitutions must stay visible.

---

## Deploying to GitHub

Repo: `https://github.com/magazineishita1108-boop/Centricity-Proposal-Playbook` (branch `main`).
The project folder has **no `.git`** — it is not currently a working copy; pushes have been made
some other way.

**⚠ The repo is PUBLIC.** README asks that the tool not be shared beyond the Products team, and
`robots.txt` only stops search engines — it does nothing about GitHub. The whole fund universe,
Centricity Select rationales, PMS/AIF terms and house IRR bands are world-readable. Raise this
before pushing.

**Before any push, two things must be fixed:**

1. **`Centricity_SIF_Refresh.js` is missing from the repo.** `index.html` L4191 `<script src>`s it,
   so the deployed site 404s and silently falls back to the 12 legacy SIF rows instead of the
   current 28-scheme universe. It is not gitignored — it was just never committed.
2. **`.gitignore` does not catch the backups.** `*.bak` matches only names *ending* in `.bak`, so
   `index.html.bak_directeq_20260728` and the other ~48 dated snapshots are **not** ignored. A
   naive `git add .` would push ~250 MB of backups. Add `*.bak_*` and `*.bak[0-9]` first.

Also on the repo but harmless: `Centricity_Risk_Matrix.js` (157,454 bytes) — the build artifact,
not loaded by anything, and it's the `.bak_regen` copy rather than the current 156,775-byte one.

---

## The monthly bake

`bake_month.js` runs **index.html's own parsers** (`REFRESH.parseAnalytics`, `parseMfMonitor`) over
the month's workbooks inside a Node `vm` sandbox, then writes the resulting globals back into the
embedded blocks — so a bake produces exactly what the Section 7 uploader would.

```bash
node bake_month.js --dir "<Month folder>" --as-on "31st July 2026"          # dry run
node bake_month.js --dir "<Month folder>" --as-on "31st July 2026" --apply
node merge_de_universe.js "<Analytics/Listed Direct Equity_<Month>.xlsx>" --apply
node merge_direct_equity_returns.js "<Listed Direct Equity Returns_<date>.xlsx>" --apply
node merge_expense_exitload.js --expense "<...>" --exitload "<...>" --apply
```

**It deliberately does not execute the five siblings.** They mutate `MASTER` on every page load, so
the baseline block must stay pre-sibling — otherwise their edits get baked in *and* re-applied.

Two things to know:

- **`parseAnalytics` MERGES, it does not replace.** A scheme in last month's block but absent from
  this month's workbook keeps its old holdings under the new date. Always run the variant fill
  below afterwards, then chase whatever is still missing upstream.

**Always follow a bake with `fill_variant_analytics.js`:**

```bash
node fill_variant_analytics.js --dir "<Month folder>" --apply
```

A fund missing from the workbook under its Growth name is usually **present under another option
of the same scheme** — `SBI Contra Fund-Reg(G)` is absent but `SBI Contra Fund-Reg(IDCW)` is there.
Options of one scheme share a single portfolio, so the sibling row is a valid source. The July run
recovered **29 equity + 3 debt** funds this way (SBI Contra, DSP Flexi Cap, Aditya Birla SL ELSS,
SBI ELSS, the whole SBI/UTI sector-fund block…), all of which would otherwise have carried June
holdings under a July label.

It parses the month's file into an empty store first, so it can tell "this month covers it under
another name" from "this month does not cover it at all", and it prefers a Growth/Regular sibling
when several options exist. What remains unmatched is mostly FoFs (resolved via their underlying
anyway), direct-only AMCs (JioBlackRock, Zerodha) and Quantum unclaimed plans — all legitimately
absent from an MF holdings workbook.
- **`DIRECT_PERF` is rebuilt, not merged**, so a fund absent from this month's Direct monitor loses
  its overlay and falls back to Regular values. July dropped 29 (mostly SIF long-short and GIFT
  City feeders that arguably should never have had MF Direct data).

### `DIRECT_PERF` must sit on MASTER's scale

`H.toDirect` substitutes these fields wholesale, so a scale mismatch shows up directly in the
client-facing Performance Sheet — a 39% m-cap slice rendered as **3935%**. Match `parseMfMonitor`
exactly:

| Field | Source column | Scale |
|---|---|---|
| returns, `ytm` | `MTD`…`SINCE INCEPTION`, `YTM (%)` | `pctToDec` (÷100) |
| `mcap_large/mid/small/other` | `Large Cap`, `Mid Cap`, `Small Cap`, **`Others`** | `mcapDec` (÷100) |
| `expense` | **`Ratio`** | `pctToDec` (÷100) |
| `aum`, `avg_maturity`, `mod_duration` | `AUM (Cr.)`, `Average Maturity Years`, `Modified Duration Years` | **raw** |

Header spellings differ from what you'd guess — it is `YTM (%)` not `YTM`, `Average Maturity Years`
not `Average Maturity`, and the expense ratio lives in a column called `Ratio`. Getting a name
wrong fails silently: the field is simply never set and the Direct view quietly shows Regular data.

**The four m-cap buckets are one split — take them atomically**, treating a blank cell as zero.
Merging a partial Direct split onto the Regular one produced a set summing to 108%. Equity-style
sheets carry the m-cap columns, pure debt sheets carry the debt stats, and hybrid sheets carry both
but must be treated as equity so the two plans agree.

Regular and Direct hold the *same portfolio*, so a correct m-cap split is identical across plans —
if the two differ, the scale or the merge is wrong. Only returns, TER and AUM should differ.

---

## Refresh workflows

| Domain | Source file | Cadence | As-on now |
|---|---|---|---|
| MASTER performance | `Daily MF monitor_<date>.xlsx` (48 sheets) | ~15 days | 30 Jun 2026 |
| Direct-plan overlay | `Daily MF Monitor_Direct_<date>.xlsx` | with above | 30 Jun 2026 |
| Equity/Hybrid/Debt Analytics | `<Class> Analytics_<Month>.xlsx` | monthly | 30 Jun 2026 |
| PMS look-through | `PMS Analytics_<Month>.xlsx` | monthly | 30 Jun 2026 |
| PMS scheme performance | `PMS_Scheme_Performance_<Month Year>.xlsx` | monthly | 30 Jun 2026 |
| AIF performance + benchmarks | *no recurring source* | frozen | May 2026 |
| Direct Equity | `Listed Direct Equity_<Month>.xlsx` | monthly | 28 Jul 2026 |
| Bonds | `Bond List_<date>.xlsx` → `merge_bond_list.js` | periodic | Invictus 6 Aug 2026; OneDigital older |
| GIFT City / Offshore | `Gift City Master List.xlsx` | periodic | Jun 2026 (sibling) |
| SIF universe + perf | `SIF Master List_<Month Year>.xlsx` | monthly | universe Jul 2026; **perf unset** |
| Expected IRR | Exit Load & Expected IRR file (**format changed** — verify columns each run) | monthly | — |
| Portfolio Matrix | `NAV Data as on <date>.xlsx` | monthly | 30 Jun 2026 (1,088 funds) |
| Monthly Outlook Pagers | `Monthly Outlook Pagers- <Month Year>.pptx` | monthly | July 2026 (5 slides) |
| Centricity Select | `Monthly Investment Reckoner - <Month>.pptx` | monthly | Jun 2026 |

**Procedure for any refresh:**
1. Identify which embedded block *or* which sibling the source file drives.
2. Back up first: `index.html.bak_<tag>_<yyyymmdd>`.
3. Replace only that block.
4. Verify by reading the changed line ranges directly, plus the checks below.
5. Confirm the file still ends with `</html>`.

---

## Verifying

Re-derive the counts rather than trusting any document (including this one). A faithful check runs
the page's scripts in document order in a Node `vm` sandbox with a `window`/`document` shim — that
reproduces the true browser state including all five sibling mutations. Expected results:

```
MASTER baseline 7452  →  effective 7460
EQUITY_ANALYTICS 1110 →  effective 1138      RISK_MATRIX 1088
CENTRICITY_SELECT 149     PMS_AIF_TERMS 73    EXTRA_SLIDES 9 images (3 dividers + 5 market + thankyou)
0 duplicate names         file ends </body></html>
```

Skip the `React is not defined` errors from the UI blocks — expected without a DOM.

---

## Open items

1. Fold siblings 3–5 into the embedded blocks and retire them (six-file deploy → one).
2. Reconcile or rewrite `README.md` — confirm where, or whether, the git repo and build scripts live.
3. Decide `Centricity_Dashboard.html`'s fate: retire it or resume syncing.
4. Archive `*.bak_*` older than ~60 days out of OneDrive.
5. Re-establish a recurring AIF performance + benchmarks source (frozen at May 2026).
6. Set the SIF performance as-on date (`DATA_DATES.sif` is `—`).
7. `Risk_Matrix_Update_Prompt.md` flags: re-confirm Rf = 4.5% is still the desk convention
   (91-day T-Bill is ~5.26%).

## Related projects — do not confuse

- **Portfolio Review** — sister dashboard (reviews *existing* holdings, 6-slide deck). Separate
  deliverable; its build prompt lives here. Shares this project's analytics/AMC/overlap engine, so a
  refresh here should prompt a check there.
- **Centricity MF Screener** — entirely separate repo, AMFI-scheme-code keyed, no shared code. Its
  known-issues catalogue (the `centricity-dashboard-issues` skill) **does not apply here.**
