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
| 3 | L4189 | `Centricity_June_Refresh.js` | `MASTER`, `EQUITY_ANALYTICS`, `DATA_DATES` | 7452 → 7456; **REPLACES the whole GIFT City bucket** |
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
| `merge_pms_performance.js` + `pin_pms_alias.js` | LIVE — the PMS performance refresh |
| `merge_reckoner.js` + `reck_parse.js` + `reck_narrative.js` + `pptx.js` | LIVE — the Centricity Select refresh |
| `add_reckoner_funds.js` | LIVE — adds instruments the deck recommends but MASTER lacks (a **universe** change) |
| `merge_analytics.js` | LIVE — re-bakes ONE analytics class; `bake_month.js` does all three plus the monitor |
| `rekey_sif_analytics.js` | LIVE — **required after every analytics bake**; see *SIF analytics are keyed differently* |
| `merge_pms_aif_analytics.js` | LIVE — PMS/AIF equity look-through; **writes the sibling too** |
| `merge_aif_performance.js` | LIVE — AIF performance + benchmarks, parsed out of the Reckoner deck |
| `fold_index_funds.js` | LIVE — one-off/idempotent: Index Fund → a sub-category of Mutual Fund |
| `split_sif_add_mld.js` | LIVE — one-off/idempotent: SIF split by strategy + the MLD product class |
| `update_closing_slides.js` | LIVE — re-renders the Disclaimer / Thank You slides into `EXTRA_SLIDES` |
| `blocklib.js` | LIVE — brace-matching splicer; **every merge_*.js tool requires it** |
| `verify_page.js` | LIVE — runs the page in a Node `vm` and prints the true in-browser counts |
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
| **L1031** | **`MASTER` — 7,599 records (the baseline universe)** |
| L1032 | `EQUITY_ANALYTICS` 1,110 · `HYBRID_ANALYTICS` 199 · `DEBT_ANALYTICS` 490 |
| L1037 | `CENTRICITY_SELECT` — 178 (Aug-2026 Reckoner) |
| L1041 | `MF_BENCHMARK_PERF` — 26 categories |
| L1045 | `DATA_DATES` (4 keys here; a 5th, `riskMatrix`, is added at L4192) |
| L1043 / L1428 | `window.H` helpers + extensions |
| L2161 | Risk profiles, strategy options, benchmark mapping |
| L2194 | `PMS_PERFORMANCE` → `pms` 690 · `aif` 11 · `benchmarks` 4 |
| L2401 | In-browser xlsx parsers (the Section 7 uploaders) |
| L2971 | Excel + PowerPoint export |
| L4189–4191 | siblings 3–5 |
| **L4192** | **`RISK_MATRIX` — 1,088 funds, baked inline** + `RISK_MATRIX_BENCH_SD` |
| L4202 | UI primitives + Sections 1–3 |
| L5827 | Section 4 + Section 5 Master Editor |
| L7316 | Main App (`ReactDOM.createRoot`) |

`window.MASTER` is also assigned at L2629, L2829, L2949, L7593–94, L7629–30 — those are **runtime
uploader / add-fund handlers**, not data blocks. Only L1031 is the baseline.

### Effective in-browser universe (after all five siblings run): **7,608**

Direct Equity 5,353 · Bonds 50 (Invictus 36 · OneDigital 14) · MLD 1 · Equity SIF 15 · Hybrid SIF 13 · Mutual Fund 1,744
(522 of them Index Fund, folded in 21-Aug-2026) · ETF 252 · the rest as before.

`EQUITY_ANALYTICS` 1,155 · `HYBRID_ANALYTICS` 246 · `DEBT_ANALYTICS` 495 · `DIRECT_PERF` 1,676 ·
`MF_BENCHMARK_PERF` 47 · `RISK_MATRIX` 1,088.

Effective `DATA_DATES`: performance / analytics / pms = `31st July 2026`,
`riskMatrix` = `30 Jun 2026`, **`sif` = `—` (still unset)**.

**`Centricity_June_Refresh.js` used to stamp `DATA_DATES.analytics = "30th June 2026"` on every
page load**, silently reverting any later analytics bake. Removed 13-Aug-2026. If an as-on date
ever refuses to stick, check the siblings before the embedded block.

---

## Layout (13-Aug-2026)

Three-column workspace inside `.layout`: a collapsible **left rail** holding Section 7 Data
Refresh, `main.col-main` with sections 1-6 plus the Master Editor, and a right-hand
**`SectionNav`** jump list. `SectionCard` emits `id="sec-<num>"`; the Master Editor shell is
`sec-master`. The nav is navigation only — it renders no proposal data.

- The two in-flow Section 7 cards are still in the App tree but guarded by `false &&`. The panel
  itself is rendered once, inside the rail. Delete the dead branches only after confirming the
  rail covers both the live and the shared/frozen case.
- **Nav scrolling is animated by hand, not `behavior:"smooth"`.** Chrome ignores the smooth flag
  on a hidden or throttled page, and a hidden page also gets zero `requestAnimationFrame`
  callbacks — the link would then do nothing at all. There is a `document.hidden` short-circuit
  and a `setTimeout` safety net that lands on the target if frames never arrive. The Browser
  pane in this harness reports `visibilityState: "hidden"`, so it exercises exactly that path;
  do not "simplify" it back to `scrollIntoView({behavior:"smooth"})`.
- Scroll target clears the sticky header by measuring `.app-header` at click time rather than
  trusting a fixed `scroll-margin-top`.
- The skin is a liquid-glass layer appended at the end of the stylesheet: ambient wash on
  `body::before`, grain on `body::after`, `backdrop-filter` on cards, rails and KPI tiles.
  **No palette token changed** — the glass tints are alpha mixes of `--gold`/`--gold-deep`/`--tan`.
  `backdrop-filter` needs something behind it, which is why the ambient wash exists.
- **Collapsing the rail drops the grid to TWO tracks.** The rail becomes `position:fixed` (a slim
  re-open tab on the viewport edge), which takes it out of the grid flow — leaving three tracks
  would place `<main>` into the now-zero-width first one and the content column measures 0.
  `.layout.left-collapsed` therefore sets `grid-template-columns: minmax(0,1fr) var(--nav-w)`.
- **`.tab` must not carry `margin-bottom:-2px`.** The Live Output strip wraps to two rows in a
  narrow column, and the negative margin pulled the second row up into the first — the tabs
  literally overlapped. Verify with a rect-intersection sweep over `.tabs`, `.kpi-row`,
  `thead tr` and `.dl-bar`, not by eye.
- Content column: ~1,120px with the rail open at 1680px wide, ~1,430px (85% of viewport) with it
  closed — at which point the tab strip fits on one row and the Master table stops scrolling.
- Do not put `overflow:hidden` on `.section-card`: the Centricity Select and Switch popovers
  overflow their card by design.
- Fixed while here: the stylesheet used to end on a truncated `.shared-ba` selector.

---
## Traps

**SIF is split by strategy into TWO product classes** (21-Aug-2026): `Equity SIF` (15, asset_class
Equity — Equity Long-Short, Equity Ex-Top 100, Sector Rotation) and `Hybrid SIF` (13, asset_class
Hybrid — Hybrid Long-Short, Active Asset Allocator). The strategy exists only in the scheme name,
so `split_sif_add_mld.js` reads it from there and refuses to guess.

**The split lives in `Centricity_SIF_Refresh.js`, not the embedded block.** The sibling deletes
every SIF row and concatenates its own hard-coded array of 28 on each load, so that array is the
one that matters. The 12 legacy `product_class: SIF` rows still in `index.html` are deliberately
left unclassified — they share no name with the sibling's 28 (three are not even SIFs: the two
Kotak Optimus hybrid AIFs and ASK Absolute Return), and the sibling's delete filter finds them by
that exact class. Reclassify them and they escape the filter and duplicate the whole bucket.

`H.isHybridScheme` now accepts `Hybrid SIF`; `H.isEquitySIF` sends the equity ones down the
equity path instead. Both scope gates and both aggregators go through those two predicates —
keep it that way. The sibling's delete filter and `parseSif`, plus `rekey_sif_analytics.js`,
all match `/SIF$/` so they cover both classes and anything predating the split.

**MLD is a Debt product class** with one instrument (Neo Market Services Limited, IRR 10-12%,
close ended to Aug-2029). Tenure resolves via an explicit `pc === 'MLD'` case that must come
*before* the asset-class branches in the tenure function.

**An MLD is its own holding, like a bond.** `H.isSelfDescribingDebt` (Bonds + MLD) is what both
the debt scope gate and the debt aggregator test, so the chip list can never disagree with what is
aggregated. The look-through reads `bond_issuer` / `bond_rating` straight off the record — Neo is
stored as issuer "Neo", rating "Unrated" — and MLDs get their own `MLD` sector bucket rather than
being folded into "Direct Bonds". **A missing rating on an MLD defaults to "Unrated", not to the
bond desk's "AAA & Equiv"**, which would otherwise overstate portfolio credit quality.

**Index Fund is a SUB-CATEGORY of Mutual Fund, not a product class** (21-Aug-2026). The 522
index funds carry `product_class: "Mutual Fund"`, `sub_category: "Index Fund"`, so they sit beside
Flexi Cap and Mid Cap in the taxonomy tree, the proposal table, the Portfolio Roll-Up, the exports
and the allocation sheet alike. Before this they were their own `product_class` and only
`H.displayPC` nested them — which fixed the tree and nothing else.

Three places make it stick; miss any one and it half-reverts:

| | |
|---|---|
| `SHEET_MAP['Index']` | `['Equity', 'Mutual Fund', 'Index Fund']` — a new fund off the Monitor's *Index* sheet must be filed like one off *Flexi Cap Fund*, or the next upload re-creates the old bucket |
| `H.fofUnderlyingName` | its candidate pool matches index funds on **`sub_category`**; testing `product_class` would empty it of all 522 |
| `PC_ORDER` | "Index Fund" removed |

`H.displayPC` is now a plain accessor. `DEFAULT_STRATEGIES`, `LIQUIDITY_MAP` and the scope gates
still carry harmless `'Index Fund'` keys whose values are identical to the `'Mutual Fund'` ones —
left as defensive fallbacks, not live paths. The monthly tools all test
`['Mutual Fund','Index Fund','ETF'].includes(...)`, which still matches. Rerun
`node fold_index_funds.js --apply` (idempotent) if a stray record ever reappears.

**ETF remains a separate product class** (252 records) and was not touched. 257 of the folded
records are named "…ETF" but were filed as index funds upstream — that pre-dates this change.

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

- **Issuer names carry the instrument, not just the issuer**, and the layout changed with the
  July file. `H.parseIssuer` collapses them for the Top Issuers table; it must strip coupon,
  series and maturity from **both ends** — the older files wrote `7.85% Muthoot Finance Ltd.`,
  July writes `Muthoot Finance Ltd. 7.85%`, `… OP I 08.52%`, `… -362D`, `… -SR-XXV 07.35%`.
  Miss the trailing form and one issuer fragments into a row per instrument. Special cases that
  must stay: Treasury Bills (one row per maturity, and the leading `91`/`182`/`364` looks exactly
  like a coupon), State Development Loans (646 raw strings → 34, one per state), TREPS, GOI,
  Net Current Asset. Truncated dates in the source (`(13-Dec-28`, `(06-Febr-2030`) leave an
  unclosed bracket, so strip the trailing parenthetical *before* the coupon.
  Whole-universe check: **2,617 raw issuer strings → 555 distinct**, none retaining a `%`.
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
- **A new GIFT City record must go into `Centricity_June_Refresh.js`, not just the embedded block.**
  Sibling #3 runs
  `window.MASTER = window.MASTER.filter(f => f.product_class !== "GIFT City").concat(NEW_GIFT)`
  on every page load — it drops the entire baseline GIFT City bucket and substitutes its own
  list. A fund added only to L1031 is present in the file, parses fine, passes a baseline count
  check, and is simply gone in the browser. `add_reckoner_funds.js` writes both and re-runs
  idempotently to repair drift; the giveaway is a `CENTRICITY_SELECT` key that no longer
  resolves once the siblings have run, which is why `verify_page.js` prints that count.
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

## The deck logo goes on EVERY slide

Whatever the user picks in the header switcher (Centricity / Invictus / OneDigital / an uploaded
file) reaches the export as `window.__SELECTED_LOGO`, and `stampLogo` puts it on every slide —
native *and* full-bleed image ones. Two boxes, defined once:

| | |
|---|---|
| `LOGO_HEADER` | `x 11.21, y 0.22, w 2.02, h 0.44` — the house position, used by `applyMaster` and by every image slide |
| `LOGO_CLOSING` | `x 8.47, y 4.33, w 4.06, h 0.89` — the larger slot the Thank You slide's own design uses; same 4.6:1 aspect, so one image serves both |

**No slide image may carry a baked-in logo any more**, or the deck double-stamps. The Disclaimer
and Thank You renders have their logo picture shape deleted before export (see below); the
dividers and Market Update slides never had one — their top-right is empty by design.

**`forEach(imgSlide)` is a trap.** `forEach` passes *(value, index, array)*, and `imgSlide`'s
second parameter is the logo box, so the index lands there as a bogus box and the logo silently
vanishes. Only `market[0]` survived, because index 0 is falsy and fell back to the default. Always
wrap: `(ES.market || []).forEach(img => imgSlide(img))`.

Verify by geometry, not by data: PptxGenJS rewrites `obj.image` to `"preencoded.png"`, so compare
each image object's `options` box against the two constants. Intercept `PptxGenJS.prototype.writeFile`
to capture the built deck — do **not** wait on `write('base64')`, which stalls forever on a hidden
page. `window.EXPORTS.exportPpt(selected, corpus, unit)` drives a build directly, which avoids
needing 100% allocated to enable the toolbar button.

## Refreshing the closing slides (Disclaimer / Thank You)

Same story as the Market Update deck — native shapes, `ppt/media` holds only the photo, so the
slides must be **rendered**:

```powershell
$sh.Delete()   # every type-13 picture narrower than 400pt = the logo; and the slide-number placeholder
$pres.Slides.Item($i).Export($path, "PNG", 2001, 1125)
```

```bash
node update_closing_slides.js --dir "<render dir>" --apply
```

- **2001 x 1125**, like every other image in `EXTRA_SLIDES`; the tool gates on it.
- **PNG for the Disclaimer** (text-heavy — crisper *and* smaller here: 288 KB vs 343 KB JPEG),
  **JPEG for the Thank You** (photographic — 96 KB vs 250 KB PNG).
- Delete the source deck's own slide-number placeholder too, or a stray "1" shows mid-proposal.
- The tool refuses to write unless `marketDivider`, `portfolioDivider`, `annexureDivider` and all
  five `market` images come through untouched.

## Refreshing the Market Update slides

The deck's slides are native PowerPoint shapes — **there are no embedded images to extract**
(`ppt/media/` is empty). They have to be *rendered*. PowerPoint COM does it faithfully; there is
no LibreOffice on this machine.

```powershell
$app  = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open($src, -1, 0, 0)          # ReadOnly, no window
1..$pres.Slides.Count | % { $pres.Slides.Item($_).Export("slide$_.jpg", "JPG", 2001, 1125) }
$pres.Close(); $app.Quit()
```

```bash
node update_market_slides.js --slides "<dir of slide1..5.jpg>" --apply
```

- **2001 × 1125** — every image in `EXTRA_SLIDES` is this size; the tool gates on it.
- PowerPoint's own JPEG quality is heavy (1,743 KB for 5 slides in August). Re-encoding at
  quality 82 via `System.Drawing` gives 1,284 KB with no visible loss on chart text. Always eyeball
  the densest slide after re-encoding — it is a second lossy pass.
- Only `market` is replaced. `marketDivider`, `portfolioDivider`, `annexureDivider` and
  `thankyou` are separate keys and must survive; the tool prints them as a gate.
- Verify by decoding all 9 images in the browser (`new Image()` per data URI), not by file size.

The source deck was renamed from `Monthly Outlook Pagers- <Month Year>.pptx` to
`Market Update Slide_<Month Year>.pptx` with the August 2026 edition.

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
| `Market Update Slide_<Month Year>.pptx` | `EXTRA_SLIDES.market` → `update_market_slides.js` |

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
6. **Editable past returns** — 1Y / 3Y / 5Y in Section 4 are `PctInput`s like the IRR range,
   stored as `r1yOv` / `r3yOv` / `r5yOv` on the *selection entry*, never on the shared MASTER
   record, so an edit belongs to one proposal and cannot leak into the base data.

   **`H.applyOverrides` must run AFTER `H.applyPlanSelected`** (see the `planSelected` memo).
   `H.toDirect` substitutes `r1y/r3y/r5y` wholesale, so with the old order flipping to Direct
   silently discarded a hand-edited return. An explicit edit outranks the plan overlay.
   IRR overrides were unaffected either way — `toDirect` does not touch `irr_low/irr_high`.

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

### SIF is a hybrid scheme — `H.isHybridScheme` decides, nothing else

A SIF has an equity leg and a debt leg in one vehicle, exactly like a hybrid MF; it is a separate
`product_class` only because SEBI registers it separately. Four gates each carried their own copy
of `asset_class === 'Hybrid' && product_class === 'Mutual Fund'`:

| | |
|---|---|
| `H.inEquityScope` | which selected funds the Equity Analytics tab lists |
| `H.inDebtScope` | same for Debt Analytics |
| `H.aggEquityScoped` | the equity look-through itself |
| `H.aggDebtScoped` | the debt look-through |

All four excluded SIF, so a SIF fund was dropped from the analytics **even with its holdings
present and correctly keyed** — `H.hasEqHoldings` returned true and nothing downstream cared.
Fixing only the key names (see above) is not enough; both halves were needed. All four now call
the single predicate `H.isHybridScheme(f)` — keep it that way rather than re-inlining the test.

**An equity-only long-short SIF is filed as Hybrid but its holdings land in `EQUITY_ANALYTICS`,**
where the fields are unprefixed (`mcap`/`sector`/`stocks`/`total`) rather than the `eq_*` set a
hybrid record carries. `aggEquityScoped` therefore tries the hybrid store first and falls back to
the equity store for a hybrid-class fund — the order matters, so a fund present in both is still
read from its hybrid record.

Verify with the aggregators, not the store: `H.aggEquityScoped([{fund, pct:100}], 100, new Set())`
should return a non-zero `exposure_cr` plus real sectors and stocks. Live result for a 100 Cr
single-fund selection: Edelweiss Altiva Hybrid 45.21 Cr equity / 45.91 Cr debt, Tata Titanium
Hybrid 49.20 / 39.90, Edelweiss Altiva Equity Ex-Top 100 100.00 equity and correctly *skipped* on
the debt side. Currently 23 of 28 SIF funds reach equity analytics and 11 of 28 reach debt.

### PMS/AIF look-through is written in TWO places

```bash
node merge_pms_aif_analytics.js "<PMS & AIF Analytics <Month Year>.xlsx>" --as-on "31st July 2026" --apply
```

The workbook is one row per holding — `Product Category | Scheme Name | Company Name | Corrected
Name | Holding(%) | Sector | ISIN | SEBI Mcap`. Two things to get right:

- **`Holding(%)` is a FRACTION**, not a percent: each scheme sums to ~1.0, so everything is
  scaled by 100 to reach the store's percent scale. Check the per-scheme sum before trusting it.
- **`Corrected Name` is the security name to key on**, not `Company Name`.

**`Centricity_June_Refresh.js` carries its own `EQ` object of 12 PMS/AIF records from the
May-2026 file and re-assigns them on every page load** (`window.EQUITY_ANALYTICS[k] = EQ[k]`).
Baking a newer month into the embedded block alone leaves those schemes silently reverting to May
— the same trap as the GIFT City bucket. The tool updates the sibling's `EQ` for every scheme it
shares (9 in the July run) and leaves the sibling-only ones untouched (Vedartha, Carnelian Bharat
Amritkaal and Motilal Oswal Founders still carry May data).

Scheme names need pinning by hand — `Abakkus All Cap Approach` → `Abakkus All Cap PMS`,
`Stallion Asset Core Fund Portfolio` → `Stallion Asset Core Fund`, and so on. `Product Category`
is what separates the PMS `Buoyant Capital- Opportunities Strategy` from the AIF
`Buoyant Capital – Opportunities Strategy` (they differ only by dash character).

July mapped 13 of 15 schemes; `3P INDIA EQUITY FUND 1` and `AlfAccurate India Equity Fund Scheme 1`
have no MASTER instrument and are reported, not invented. Effective PMS/AIF with look-through:
**17 of 55**.

**Rahul re-issues this file mid-cycle.** The 20-Aug morning copy had 10 schemes; the 11:22 copy had
15, adding the five ICICI strategies. Re-check the scheme count before assuming a re-run is a no-op.

**`blocklib.writeBlocks` derives its `</html>` guard from the input**, so it keeps the guarantee
for `index.html` and still works on the `.js` siblings. It refused rather than corrupting the
sibling when the guard was unconditional — do not weaken it to a caller-supplied flag.

### SIF analytics are keyed by the scheme name, not the fund name

The analytics workbooks name a SIF by its scheme alone — `Altiva Hybrid Long-Short Fund-Reg(G)`
— while MASTER names it with the AMC in front: `Edelweiss Altiva Hybrid Long-Short Fund`. Every
other analytics key is the MASTER name, so the holdings parse fine, land in the store, and are
then simply unreachable: the fund shows no sectors, no stocks and no credit profile, and
`H.hasEqHoldings` / `H.hasDbHoldings` drop it from the analytics and overlap sections. Nothing
errors and no count looks wrong — the store size is right, the keys are not.

```bash
node rekey_sif_analytics.js --apply
```

No fuzzy matching is involved: `Centricity_SIF_Refresh.js` records the workbook name on each
record as **`sif_raw`**, so the join is exact. The tool moves the entry and deletes the old key,
and re-running is a no-op. **`parseAnalytics` re-creates the workbook-named keys, so this must
be re-run after every bake** — same standing requirement as `fill_variant_analytics.js`.

Currently 23 of 28 SIF funds resolve. The other five are absent from the July workbooks
altogether and need chasing upstream, not re-keying: Kotak Infinity Hybrid, Mirae Asset Platinum
Hybrid, Quants Qsif Sector Rotation, Franklin Sapphire Equity, **Tata Titanium Equity**.

**Equity and hybrid records have different field names.** An `EQUITY_ANALYTICS` record is
`{mcap, sector, stocks, total}`; a `HYBRID_ANALYTICS` one is
`{eq_mcap, eq_sector, eq_stocks, eq_total, db_sector, db_holdings, db_rating, db_total}`.
Probing a hybrid field on an equity record returns undefined and reads as "no holdings".

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
| PMS/AIF look-through | `PMS & AIF Analytics <Month Year>.xlsx` (Desktop root) | monthly | 31 Jul 2026 |
| PMS scheme performance | `PMS_Scheme_Performance_<Month Year>.xlsx` | monthly | 31 Jul 2026 |
| AIF performance + benchmarks | the Reckoner deck itself → `merge_aif_performance.js` | monthly | 31 Jul 2026 |
| Direct Equity | `Listed Direct Equity_<Month>.xlsx` | monthly | 28 Jul 2026 |
| Bonds | `Bond List_<date>.xlsx` → `merge_bond_list.js` | periodic | Invictus 6 Aug 2026; OneDigital older |
| GIFT City / Offshore | `Gift City Master List.xlsx` | periodic | Jun 2026 (sibling) |
| SIF universe + perf | `SIF Master List_<Month Year>.xlsx` | monthly | universe Jul 2026; **perf unset** |
| Expected IRR | Exit Load & Expected IRR file (**format changed** — verify columns each run) | monthly | — |
| Portfolio Matrix | `NAV Data as on <date>.xlsx` | monthly | 30 Jun 2026 (1,088 funds) |
| Market Update slides | `Market Update Slide_<Month Year>.pptx` | monthly | August 2026 (5 slides) |
| Centricity Select | `Monthly Investment Reckoner - <Month Year>.pptx` | monthly | Aug 2026 |

**Procedure for any refresh:**
1. Identify which embedded block *or* which sibling the source file drives.
2. Back up first: `index.html.bak_<tag>_<yyyymmdd>`.
3. Replace only that block.
4. Verify by reading the changed line ranges directly, plus the checks below.
5. Confirm the file still ends with `</html>`.

---

## The monthly Reckoner (Centricity Select + PMS performance)

Two separate refreshes, both driven by files Rahul drops in the month folder. Run PMS first — the
Reckoner's own index is the tie-breaker for the alias pins.

```bash
node merge_pms_performance.js "<PMS_Scheme_Performance_<Month Year>.xlsx>" --as-on "31st July 2026" --html index.html
node pin_pms_alias.js --html index.html
node merge_reckoner.js "<Monthly Investment Reckoner - <Month Year>.pptx>" --html index.html
node verify_page.js .
```

All four are dry-run by default; add `--apply` to write. Gates refuse to write on a regression.

### PMS performance

`PMS_PERFORMANCE.pms` is **replaced wholesale**; `aif` and `benchmarks` are carried forward
verbatim — **this file is PMS-only and cannot update AIF**. AIF comes from the deck instead; see
*AIF performance* below.

- **The vendor renames schemes.** July 2026 arrived with only 118 of 314 old keys intact
  (`ICICI - Value Strategy` → `ICICI Prudential - Value Portfolio`). That silently broke 9 alias
  pins. `PMS_PERF_ALIAS` is **maintained by hand, never guessed** — a wrong pin puts another
  manager's numbers on a client's fund. The `REPIN` map at the top of `merge_pms_performance.js`
  is where renames go; the gate is *MASTER PMS funds with performance must not fall*.
- **AUM units are decided per column, not per row.** The old ">10 lakh means rupees" rule turned a
  genuine 7-lakh-rupee scheme into 700,000 Cr. `const inRupees = Math.max(...aums) > 1e8`.
- AUM values arrive as comma-formatted **strings** (`"20,41,79,00,000.00"`), so `parseFloat` after
  stripping commas — not `Number()`.
- The m-cap columns and the `Top Sector` sheet were **entirely empty** in July, so `top_sector_pct`
  could not be derived. Check before assuming the runbook's shape still holds.

Four pins are still `null` because the file genuinely has no counterpart: Burman Capital,
Phillip Conservative Credit, Sundaram F.I.R.S.T. Debt, Julius Baer Premier Focused.

### AIF performance

AIF had no recurring workbook and sat frozen at May 2026. It does have a source: the deck's own
**"AIF PERFORMANCE (CAT III) – LISTED EQUITY"** slide, which is a full performance grid —
`Strategy | Inception Date | AUM (Cr) | 1M | 3M | 6M | 1Y | 3Y | 5Y | SI | Large | Mid | Small |
Cash & Others` — on the deck's own as-on date.

```bash
node merge_aif_performance.js "<Monthly Investment Reckoner - <Month Year>.pptx>" --apply
```

- `pms` is carried forward untouched; `merge_pms_performance.js` owns that half.
- **The AIF grid has no 2Y column**, so `benchmarks` is taken from the **PMS – EQUITY** grid, which
  carries all four indices *with* 2Y on the same as-on date and agrees with the AIF grid's other
  columns to the rounding the deck prints. Do not source benchmarks from the AIF slide alone.
- The deck writes 2-digit years (`03-Dec-25`); all are 20xx. `inception` is stored as `"Dec, 2025"`
  with `inception_full` as an ISO first-of-month, matching the existing records.
- Deck rows are footnoted with `*` when a different series is being shown — `Motilal Oswal Founders
  Fund*` is Series VII (inception Dec-25), not the Series I that the May block carried. The numbers
  are *supposed* to move a long way.
- **A market-allocation bucket left blank does not get back-filled.** Singularity Equity Fund I has
  an empty `Small` cell and sums to 93.8%; spreading the residual into Cash & Others would put a
  fabricated number on a client-facing allocation. The gate fails only when a split exceeds 100%
  (which means the columns were misread) and merely reports a shortfall.

**Where the deck prints "-", MASTER keeps the IRR-band midpoint** that the embedded record already
carried (17-19% → 18.0%, 20-22% → 21.0%). That is the pre-existing convention for AIF and unlisted
records, not a value this tool writes — it only touches `PMS_PERFORMANCE`, never a MASTER record.

### Centricity Select

`merge_reckoner.js` rebuilds `CENTRICITY_SELECT` from the deck's **performance grids** — a table
whose first header cell reads `Scheme Name` / `Strategy` and that has ≥8 columns. Everything else
on a slide is narrative (fee ladders, "About the strategy" boxes) and must not parse as a fund;
an earlier looser parser turned `Fixed` / `Hybrid` / `Variable` into 300 phantom funds.

- **Membership comes from the deck; the dashboard's 33 categories do not change.** `GRID` maps a
  deck heading to an existing `sheet`/`category`. Deck buckets the dashboard has no Select bucket
  for (Overnight, Liquid, Floater, target-maturity FoF, plain index trackers, ETF, International,
  Aggressive Hybrid, Equity Savings, Conservative Hybrid, Dynamic Asset Allocation) are **reported,
  never auto-added** — a Select badge is a house recommendation, not a data point.
- **The deck merged Sectoral and Thematic into one heading** in August. The split is taken from
  MASTER's own `sub_category`, not from a judgement call in the script.
- **Smart Beta is a factor tilt, not a cap-weighted tracker.** Only momentum / low-vol / value-20 /
  alpha-50 / equal-weight / quality names come out of the deck's `Index Funds` heading.
- `reckonerName`, `category` and `sheet` are **metadata only** — the UI reads `rationale`, the five
  risk ratios, `benchmark` and `details`. `category` is the one shown, as the popover's sub-head.
- **Retained funds keep their rationale and ratios.** New PMS / AIF / Unlisted / Gift entries take
  both from their own narrative slide. New **MF** entries get neither: the deck's MF pages are
  performance grids with no per-fund rationale, and no risk-ratio workbook shipped in July. The
  script lists them at the end — they render with `—` until someone writes the text.
- Two traps in the narrative extractor, both fixed, both easy to reintroduce:
  the unlisted-equity slides carry a ~900-character risk **disclaimer that is longer than the real
  "About" text**, so longest-paragraph picks the wrong one (`BOILERPLATE` filters it); and every
  product slide has 2-column **Top Holdings / Top Sectors** tables, so taking all 2-column tables
  turned an 11-row fact card into a 35-row dump of stock weights (only the table headed
  `Particulars` / `Fund Structure` / `Details` counts).
- Every key must exist in `MASTER` or the badge can never render — that is the write gate. The
  August run also cleared the two pre-existing orphans (`Alchemy India Long Term Fund` was missing
  its ` (Inbound)` suffix; `Motilal Oswal Alternative Investment` has no MASTER record at all).

**Deck products with no MASTER instrument** — the badge has nothing to attach to, so they are
skipped and reported. Adding them is a universe change, not a refresh:
`Alf Accurate Budding Beasts PMS` (MASTER has AlfAccurate *India Opportunities*, a different
strategy), `Motilal Oswal Gift City India Equity Fund`, `Carnelian Private Growth & Innovation
Fund`, `Inquant Debt Plus Fund`.

---

## Verifying

Re-derive the counts rather than trusting any document (including this one). A faithful check runs
the page's scripts in document order in a Node `vm` sandbox with a `window`/`document` shim — that
reproduces the true browser state including all five sibling mutations. Expected results:

```
MASTER baseline 7599  →  effective 7607
EQUITY_ANALYTICS 1110 →  effective 1138      RISK_MATRIX 1088
CENTRICITY_SELECT 178     PMS_AIF_TERMS 73    EXTRA_SLIDES 10 images (3 dividers + 5 market + disclaimer + thankyou)
PMS_PERFORMANCE.pms 690   PMS_PERF_ALIAS 27 (4 null)   MASTER PMS with perf 23 of 27
HYBRID_ANALYTICS 246 (July workbook covers 241)   DEBT_ANALYTICS 495
0 duplicate names         file ends </body></html>
```

Skip the `React is not defined` errors from the UI blocks — expected without a DOM.

---

## Open items

1. Fold siblings 3–5 into the embedded blocks and retire them (six-file deploy → one).
2. Reconcile or rewrite `README.md` — confirm where, or whether, the git repo and build scripts live.
3. Decide `Centricity_Dashboard.html`'s fate: retire it or resume syncing.
4. Archive `*.bak_*` older than ~60 days out of OneDrive.
5. ~~Re-establish a recurring AIF performance + benchmarks source.~~ Done 20-Aug-2026 — the
   Reckoner deck carries it; see *AIF performance*.
6. Set the SIF performance as-on date (`DATA_DATES.sif` is `—`).
7. `Risk_Matrix_Update_Prompt.md` flags: re-confirm Rf = 4.5% is still the desk convention
   (91-day T-Bill is ~5.26%).

## Related projects — do not confuse

- **Portfolio Review** — sister dashboard (reviews *existing* holdings, 6-slide deck). Separate
  deliverable; its build prompt lives here. Shares this project's analytics/AMC/overlap engine, so a
  refresh here should prompt a check there.
- **Centricity MF Screener** — entirely separate repo, AMFI-scheme-code keyed, no shared code. Its
  known-issues catalogue (the `centricity-dashboard-issues` skill) **does not apply here.**
