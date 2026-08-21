# CENTRICITY WEALTHTECH — PORTFOLIO REVIEW DASHBOARD
## Complete Build Prompt for Claude

> Paste this entire document into a **new Claude project chat ("Portfolio Review")** as the first message. Then, separately, upload (a) the monthly/weekly **reference data files** (analytics + performance) and (b) one **client base file** to generate from. The agent must produce a single self-contained `Portfolio_Review.html` dashboard that ingests a client's existing-holdings Excel and outputs a downloadable PowerPoint (and matching Excel) of the **6 core review slides + an Observations slide**, in Centricity's exact design language.
>
> This prompt is the single source of truth. Anything not stated here defaults to the visual language of the sample deck **`Portfolio Update_ Mr. S Palanivel Family_20th May 2026.pptx`** and the sister build **`Dashboard_Build_Prompt.md`** (Centricity Proposal Playbook). The Portfolio Review reuses the Proposal Playbook's design system, analytics engine, performance tables, and overlap matrix verbatim — only the inputs (an actual client portfolio, not a hand-built proposal) and the slide set differ.

---

## 0. Identity & Audience

**You are building for:** Centricity WealthTech Pvt. Ltd. — a Gurugram-based wealth manager serving HNI, UHNI and Family Office clients exclusively (80+ branches).

**Built by:** The Products Team. They run periodic **portfolio reviews** of a client/family's *existing* holdings and present findings to Partners and clients.

**Audience for the dashboard:** Internal team operating it. **Audience for the exported deck:** the client/family and their Partner.

**Difference from the Proposal Playbook:** The Playbook *constructs* a forward-looking proposal by picking funds to 100%. This tool *reviews* a portfolio the client already owns — the holdings, values and weights come from an uploaded base file, not from manual selection. There is no corpus input and no "must equal 100%" gate; weights are whatever the live portfolio is.

**Tone of every label, heading and observation:** Professional, institutional, direct. No marketing fluff, no hedging.

---

## 1. Brand & Design System — Non-Negotiable

Identical to the Proposal Playbook. Reuse exactly.

| Token | Value | Use |
|---|---|---|
| `--black` | `#000000` | Header bar, footer, titles, body text, table dark fills, Grand Total rows |
| `--gold` | `#BD9568` | PRIMARY brand colour — accent strip, chart bars, AMC bars, table accents |
| `--tan` | `#DBC8B2` | SECONDARY fill — card fills, content boxes, product-class table rows |
| `--grey-m` | `#BFBFBF` | Asset-class header rows in tables; decorative circles on divider slides |
| `--grey-l` | `#D9D9D9` | Sub-category header rows, dividers, alternating table rows |
| `--bg-yellow` | `#FFF8E1` | Benchmark row fill (pale honey) in performance tables |
| `--brown-text` | `#5C3E17` | Italic text inside benchmark rows |
| `--red` | `#931621` | ONLY for negative returns / losses / AMC-cap breaches; never decorative |
| `--green` | `#2E7D32` | Positive-confirmation states only |
| `--bg` | `#FFFFFF` | Slide & page backgrounds — always white |

**Font:** Cambria across 95% of the surface. No sans-serif except in-chart numeric labels where Cambria collides.

**Slide dimensions:** 13.333" × 7.500" (16:9 widescreen), `LAYOUT_WIDE`.

**Universal slide master — matches the sample deck coordinates exactly:**
- Black rectangle header bar: `(0, 0, 13.333, 0.90)`
- Gold separator strip below header: `(0, 0.88, 13.333, 0.05)`
- Slide title text: `(0.15, 0.15, 12.04, 0.69)`, 22pt Cambria bold white, ALL CAPS
- Centricity logo (top-right): picture at `(11.21, 0.22, 2.02, 0.44)` — white-text-on-transparent, sits in the black header bar
- Black footer bar: `(0, 7.23, 13.333, 0.26)` with centred 8pt tan text: *"CENTRICITY WEALTHTECH PVT. LTD. | CONFIDENTIAL | PREPARED FOR CLIENT REVIEW"*
- Bottom-right slide number in white.

**Anti-patterns to avoid:** decorative accent lines under titles; cream/beige backgrounds (always white); centred body paragraphs (left-align everything except titles); mixing serif + sans-serif in one component; any percent without 2 decimals.

---

## 2. The Workflow

Two distinct upload moments:

**(A) Reference data — uploaded monthly/weekly, baked into the dashboard.** These supply the *standardised* analytics, performance and overlap data that the client base file does **not** contain. Same files as the Proposal Playbook (see §3b). When the user refreshes these, regenerate the embedded JSON blocks (`MASTER`, `EQUITY_ANALYTICS`, `HYBRID_ANALYTICS`, `DEBT_ANALYTICS`, `PMS_PERFORMANCE`, benchmarks) exactly as the Proposal Playbook does, and string-replace them in place. Carry a single `DATA_DATES` label (`analytics`, `performance`) shown in slide footnotes.

**(B) Client base file — uploaded per review at run time.** A single Excel of the family's existing holdings (see §3a). On upload the dashboard:
1. Parses every holding row.
2. **Fuzzy-matches** each `Instrument Name` to the embedded reference `MASTER`/analytics/performance keys (see §3c) to attach stock-level holdings, sector, market-cap, standardised returns and overlap data.
3. Renders the 6 review surfaces on screen + an auto-generated Observations panel.
4. Exposes **⬇ PowerPoint** and **⬇ Excel** download buttons that produce the deck/workbook.

There is **no corpus input** and **no 100% gate** — downloads are always enabled once a base file is loaded and at least one row matches.

---

## 3. Data Inputs

### 3a. Client Base File (uploaded per review)

A workbook whose primary sheet is named **`Base File`** (the tool should also tolerate the holdings being on the first sheet). One row per holding. Exact columns (mirror the sample `Portfolio Update_ Mr. S Palanivel Family_20th May 2026.xlsx`):

| # | Column | Meaning / format |
|---|---|---|
| 1 | `Client Name` | Family member, e.g. `S PALANIVEL`, `G BHUVANESWARI`. Drives per-client holding slides. May contain double spaces — normalise whitespace for display. |
| 2 | `Instrument Name` | Scheme/instrument name, e.g. `HDFC Mid Cap Fund Growth`. **Fuzzy-match key.** |
| 3 | `Category Name` | SEBI sub-category, e.g. `Mid Cap Funds`, `Flexi Cap Funds`, `Focused Funds`. Drives analytics/performance grouping. |
| 4 | `Asset Name` | `Equity` · `Debt` · `Hybrid`. Top-level asset bucket. |
| 5 | `Folio No` | Display/identification only. |
| 6 | `AMC` | Short AMC token, e.g. `HDFC`, `SBI`, `Aditya`, `Parag`, `PGIM`. Drives the AMC Allocation slide. Expand to display names where natural (e.g. `Aditya → Aditya Birla Sun Life`, `Parag → PPFAS`, `Mirae → Mirae Asset`). |
| 7 | `Product Name` | Product class: `Mutual Funds` · `PMS` · `AIF` · etc. Drives asset-allocation nesting & performance buckets. |
| 8 | `Distributor Name` | Display only. |
| 9 | `Units` | Display only. |
| 10 | `Invested Value (₹)` | Rupees. |
| 11 | `Market Value (₹)` | Rupees. |
| 12 | `Total Gain/Loss (₹)` | Rupees. |
| 13 | `Invested Value (Cr.)` | **₹ Crore** — use in tables. |
| 14 | `Current Market Value (Cr.)` | **₹ Crore** — use in tables; basis for all weights. |
| 15 | `Total Gain/Loss (Cr.)` | **₹ Crore**. |
| 16 | `Allocation (%)` | **Stored as a decimal fraction** (`0.0879` = 8.79%). Portfolio-level weight = holding CMV ÷ total CMV. **Multiply by 100 for display.** |
| 17 | `XIRR (%)` | Decimal fraction (`0.19042` = 19.04%). Holding's annualised return. |
| 18 | `BMXIRR (%)` | Decimal fraction. Benchmark XIRR for that holding — used to flag under-performers (XIRR < BMXIRR). |
| 19 | `Avg. Holding Days` | Integer days. |

**Critical parsing rules:**
- Columns 16–18 are **fractions, not percentages** — always `×100` before rendering and append `%` with 2 decimals.
- All money in tables is **₹ Crore** (columns 13–15), 2 decimals.
- A holding may repeat (same scheme, different folio/client) — keep rows distinct in holding sheets; **sum** them when aggregating analytics/AMC/asset-allocation.
- Trim double spaces in names; treat case-insensitively for matching.

### 3b. Reference data files (uploaded monthly/weekly — same as Proposal Playbook)

| File | Supplies |
|---|---|
| `MF Monitor_<month>.xlsx` | Standardised performance for the Performance Sheet: AUM, 1M/3M/6M/1Y/2Y/3Y/5Y/10Y/SI, Inception, market-cap split (Large/Mid/Small/Others). Debt sheets carry YTM/Avg Maturity/Mod Duration. |
| `Equity analytics_<month>.xlsx` | Per-scheme stock holdings: Scheme, Company, In/Out, Holding(%), Sector, Asset, SEBI MCAP Type. Skip `In/Out = Out`. → `EQUITY_ANALYTICS`. |
| `Hybrid analytics_<month>.xlsx` | Same shape, rows split `Asset=Equity` / `Asset=Debt`; aggregate each side separately. → `HYBRID_ANALYTICS`. |
| `Debt analytics_<month>.xlsx` | Bond-level holdings per debt MF: Sector, Rating, Company. → `DEBT_ANALYTICS`. |
| `Equity PMS.xlsx` | PMS scheme holdings (Holding stored as fraction → ×100). → feeds analytics + overlap for PMS. |
| `PMS & AIF Performance.xlsx` | PMS/AIF standardised returns for the Performance Sheet (see column layout in §4F). |
| `Exit Load & Expected IRR Return Range.xlsx` | Optional — IRR band + exit-load text per scheme. |

Embed these as inline JSON so the dashboard runs offline, exactly as the Proposal Playbook does. **Reuse the Proposal Playbook's master/analytics schema verbatim.**

### 3c. Fuzzy Matching — instrument name → reference key

The base file's `Instrument Name` rarely matches a reference key character-for-character (`HDFC Mid Cap Fund Growth` vs `HDFC Mid Cap Fund-Reg(G)`). Reuse the Proposal Playbook matcher:

- Normalise both sides: lowercase, strip `Reg`, `Regular`, `Direct`, `Growth`, `(G)`, `Payout`, `IDCW`, punctuation, plan suffixes; collapse whitespace.
- Score by **shared-token count**.
- **Match threshold = ≥ 3 shared tokens.** This is deliberate — at ≥2 the curated files throw false positives (the documented bug: *"Vivriti Short Term Debt Fund" → "Alchemy Long Term Ventures Fund"* on the shared tokens *term+fund*). Every legitimate match scored ≥3.
- For a legitimate 2-token-only name, add an **explicit alias** rather than lowering the threshold.
- **After every run, validate:** each base-file instrument resolves to at most one reference scheme, and no reference scheme is wrongly claimed. Surface unmatched instruments in the UI ("N holdings could not be matched to reference data — analytics/performance unavailable for these") rather than fabricating data.

---

## 4. The Six Core Slides + Observations

Render each on screen as a card, and as one PPT slide. All tables/charts in Centricity tokens (§1).

### 4A. Slide 1 — ASSET ALLOCATION  *(format: sample slide 7)*

**Left: a 4-column summary table.**

| Asset Class | Investment Amount (Cr.) | Current Market Value (Cr.) | % CMV |

- Hierarchy of rows: each **Asset Class** present (`Equity → Hybrid → Debt`, gold/`grey-m` fill) → its **Product Class** rows beneath (`Mutual Funds`, `PMS`, `AIF` …, white/tan fill) → final **Grand Total** row (black fill, white text).
- `Investment Amount (Cr.)` = Σ `Invested Value (Cr.)`; `Current Market Value (Cr.)` = Σ `Current Market Value (Cr.)`.
- `% CMV` = row CMV ÷ Grand-Total CMV, 2 decimals. Grand Total = `100.00%`.

**Right: two pie charts** (match sample — labelled, percentage callouts):
1. **Asset Allocation by Asset Class** — Equity / Hybrid / Debt share of total CMV.
2. **Liquidity / Structure** — Open Ended vs Close Ended share (classify via the Proposal Playbook liquidity table: MF/ETF/Index = Open Ended; ELSS, AIF, SIF, GIFT, Solution/Children's = Close Ended; PMS = Open Ended; Bonds/FD = Open Ended). The sample shows `Open Ended 100%`.

Footnote bottom-right, italic: *"\*Portfolio as on `<DD Mon YYYY>`"* (the review-as-on date).

### 4B. Slide 2 — AMC ALLOCATION (ACROSS MUTUAL FUND)  *(format: Proposal Playbook AMC chart)*

- **Horizontal bar chart** of each AMC's share **within the Mutual Fund book only** (`Product Name = Mutual Funds`; include Index/ETF if present). Weight = AMC's MF CMV ÷ total MF CMV, **normalised to 100% of the MF allocation**. Sort descending.
- Use the base file `AMC` column (expanded to display names). Sum duplicate holdings of the same AMC.
- **20% cap rule:** draw a reference line at 20%. Any AMC whose share **> 20.00%** is rendered in `--red` (`#931621`) and flagged with a small "BREACH" tag. List breaching AMCs beneath the chart.
- This breach status feeds Observation #2 (§4G).

### 4C. Slide 3 — HOLDING SHEET (CLIENT LEVEL)  *(format: sample slides 9–10)*

One slide **per client** in the base file (e.g. one for `S PALANIVEL`, one for `G BHUVANESWARI`). Title: `PORTFOLIO HOLDINGS - <CLIENT NAME>`.

7-column table:

| Instrument Name | Invested Value (Cr) | Current Market Value (Cr) | Total Gain/Loss (Cr) | Allocation (%) | XIRR (%) | BMXIRR (%) |

- Hierarchy: **Asset Name** row (e.g. `Equity`, `grey-m`) → **Product Name** row (e.g. `Mutual Funds`, `grey-l`/tan) → **instrument rows** (white), sorted by CMV descending → **Grand Total** row (black).
- **`Allocation (%)` is RE-BASED to that client's own total CMV** (not the family total). In the sample, HDFC Mid Cap shows 15.95% on S Palanivel's sheet (0.97 ÷ 6.07) vs 8.79% family-wide. Compute per-client.
- Asset/Product/Grand-Total **XIRR & BMXIRR** = CMV-weighted average of the rows beneath (use the base file's totals row if it provides one).
- Negative `Total Gain/Loss` values in `--red`. If a sheet overflows, split across continuation slides (`… (cont.)`).

### 4D. Slide 4 — PORTFOLIO ANALYTICS (EQUITY & DEBT)  *(format: sample slide 11 + Proposal Playbook analytics)*

Reuse the Proposal Playbook analytics engine exactly, **weighting by each holding's `Current Market Value (Cr.)`** instead of corpus×pct.

**Equity Analytics** (title `PORTFOLIO ANALYTICS — EQUITY`), three blocks:
- **Top Market Cap** — column chart, 4 bars (Large / Mid / Small / Others), % of total equity exposure.
- **Top Sectors** — horizontal bar, top 10, % of total equity exposure.
- **Top Underlying Holdings** — table, top 20 stocks with `% Eq`.

**Debt Analytics** (title `PORTFOLIO ANALYTICS — DEBT`), only if debt/hybrid-debt exposure exists, three blocks:
- **Top Sectors / Asset Types** — horizontal bar.
- **Credit Rating Distribution** — doughnut (`SOV` / `AAA & Equiv` / `AA` / `A` / `Cash & Equivalent` / `Others` / `Unrated`).
- **Top 20 Issuers** — table.

**Hybrid handling (critical):** for any holding matched to `HYBRID_ANALYTICS`, route its **equity portion into Equity Analytics** and its **debt portion into Debt Analytics** — never double-count. Aggregate in ₹ Cr, **normalise to 100% only at the end** so each block sums to exactly `100.00%`.

Footnote: *"\*Analytics as on `<DATA_DATES.analytics>`."*

### 4E. Slide 5 — OVERLAP MATRIX  *(format: sample slide 12 + Proposal Playbook overlap)*

- Computed for **Mutual Funds and PMS** holdings that have stock-level reference data (silently skip ineligible holdings).
- **Formula:** `overlap(A, B) = Σ over stocks held by both of min(weight_in_A %, weight_in_B %)`. Diagonal = 100% by construction. Use the top-20 stocks per fund.
- **Render** the heat-coded matrix on a dark-slate background with gold-gradient cells, matching sample slide 12. Title: `OVERLAP MATRIX — LISTED EQUITY`. Legend strip below: `Diagonal (100%)` · `<15% low` · `15–30% moderate` · `30–50% high` · `>50% very high`. (If the user prefers the dashboard's RGB palette instead — diagonal `#FFB1B1`, `<15%` green `#C8F1CB`, `15–30%` `#FBEAA8`, `30–50%` `#F8B194`, `>50%` `#FBA0A0` — keep it consistent across screen, PPT and Excel.)
- High-overlap pairs (>40–50%) feed Observation #4 (duplication).

### 4F. Slide 6 — PERFORMANCE SHEET (ALL BUCKETS PRESENT)  *(format: sample slides 14 & 19)*

One grouped table **per bucket that exists in the uploaded portfolio**: `Equity MF` · `Hybrid MF` · `Debt MF` · `PMS` · `AIF`. Only schemes present in the base file (resolved via fuzzy match) appear; pull standardised returns from the embedded performance data.

- **Equity / Hybrid / PMS layout (equity columns):** Scheme · Inception · AUM (Cr.) · 3M · 6M · 1Y · 3Y · 5Y · 10Y · S.I. · Large · Mid · Small · Others. *(PMS/AIF additionally carry `1M` and `2Y`, matching the PMS & AIF Performance file: Inception · AUM · 1M · 3M · 6M · 1Y · 2Y · 3Y · 5Y · SI · Large · Mid · Small · Others — AIF drops `2Y`.)*
- **Debt MF layout (debt columns):** 1M · 3M · 6M · 1Y · 2Y · 3Y · 5Y · S.I. · YTM (%) · Avg Mat · Mod Dur.
- Group with sub-category sub-header rows; **below each sub-category place a benchmark row** in `--bg-yellow` italic `--brown-text`, using the Proposal Playbook benchmark table (Large Cap → NIFTY 100 TRI, Mid Cap → NIFTY Midcap 150 TRI, Small Cap → NIFTY Smallcap 250 TRI, Flexi/Focused/Multi/Value/Thematic → NIFTY 500 TRI family, Equity PMS → BSE 500 TRI, etc.).
- Negative returns in `--red`; missing data renders `—`, never `0`.
- Footnote: *"\*Performance as on `<DATA_DATES.performance>`."*

### 4G. Observations Slide — PORTFOLIO OBSERVATIONS  *(format: sample slide 8)*

A left-aligned, single-column list of short observation paragraphs (Cambria, black). Generate dynamically from the loaded portfolio. **Four mandatory observations, in this order, plus auto-generated extras:**

**1 — Asset allocation profile (always).** State the asset mix and what risk profile it implies, then the market-cap breakdown.
> *e.g. "The overall portfolio asset allocation reflects an aggressive risk profile, with 100% allocation towards equity. Market-cap allocation is distributed as: 38.91% large-cap, 35.53% mid-cap, 18.60% small-cap and 6.96% others."*
Logic: equity share → {≥85% Aggressive, 60–85% Growth, 40–60% Balanced, <40% Conservative}; pull the mcap split from §4D.

**2 — AMC breach (cap 20% per AMC, of MF allocation) + impact.** If any AMC exceeds 20% of the MF book, name it/them and explain the concentration risk; if none, state the portfolio respects the cap.
> *Breach (illustrative): "ABC Mutual Fund constitutes 24.70% of the mutual-fund allocation, breaching Centricity's 20% per-AMC cap. Over-reliance on a single fund house concentrates manager and operational risk; trimming ABC schemes towards the cap would improve diversification and reduce house-level risk."*
> *No breach: "No single fund house exceeds Centricity's 20% per-AMC cap (largest is `<AMC>` at `XX.XX%`), indicating well-diversified AMC exposure across the mutual-fund book."*

**3 — Single product-class concentration → introduce PMS & AIF (Centricity-focused).** If the portfolio is concentrated in one product class (e.g. ~100% Mutual Funds), recommend broadening into Centricity's focused PMS and AIF strategies.
> *e.g. "The portfolio is currently invested entirely in mutual funds. Introducing selective PMS and AIF strategies — from Centricity's focused list — would broaden diversification across investment styles and asset classes and create additional avenues for long-term return generation."*
Logic: trigger when any single `Product Name` ≥ ~85% of CMV.

**4 — Self-generated opportunities & weaknesses (include the relevant ones).** Derived from the actual portfolio:
- **Overlap:** if any eligible pair >40–50%, note that reducing overlapping schemes improves efficiency and avoids duplication.
- **Under-performers:** if schemes show `XIRR < BMXIRR` (or weak vs peers), suggest reviewing them for replacement with stronger alternatives.
- **Low-allocation clutter:** if several holdings sit below ~1–2% each, suggest consolidating to streamline the portfolio.
- **No international exposure:** if global/international = nil, suggest selective global investments for geographic diversification.
- **Rebalancing:** suggest periodic rebalancing to keep allocation aligned with objectives and market conditions.
- **Duplicate strategies:** if multiple schemes share a sub-category/strategy, suggest consolidation.

Keep each observation to 1–2 sentences, factual and specific (cite the actual numbers). Never fabricate — only raise an observation when the data supports it.

---

## 5. Calculations — Exact Formulas

**Total CMV** = Σ `Current Market Value (Cr.)` across all rows. All weights are CMV-based.

**Portfolio weight of a holding** = holding CMV ÷ Total CMV (the base file's `Allocation (%)` already equals this — verify it reconciles).

**Per-client weight (holding sheet)** = holding CMV ÷ that client's total CMV.

**Asset / Product / Grand-Total XIRR & BMXIRR** = Σ(holding XIRR × holding CMV) ÷ Σ(holding CMV) (CMV-weighted). Prefer the base file's own totals row if present.

**AMC weight (MF only)** = Σ CMV of holdings of that AMC where `Product Name ∈ {Mutual Funds, Index Fund, ETF}` ÷ Σ CMV of all MF holdings. Breach if > 20.00%.

**Analytics aggregation (weight by CMV, normalise last)** — reuse Proposal Playbook §4:
```
for each matched holding h with CMV = C:
  eqA = EQUITY_ANALYTICS[h.matched_name]      // pure equity MF/PMS
  hyA = HYBRID_ANALYTICS[h.matched_name]      // hybrid split
  dbA = DEBT_ANALYTICS[h.matched_name]         // pure debt MF
  if eqA:  eq_mcap[b]   += (eqA.mcap[b]/100)*C ; eq_sector[s] += (eqA.sector[s]/100)*C ;
           eq_stock[k]  += (eqA.stock[k]/100)*C ; eq_exposure += (Σmcap/100)*C
  if hyA:  apply hyA.eq_* to eq_*  (eq_exposure += hyA.eq_total/100*C)
           apply hyA.db_* to debt_* (debt_exposure += hyA.db_total/100*C)
  if dbA:  apply dbA.sector/issuer/rating to debt_* ; debt_exposure += C
Final: eq_mcap[b] = eq_mcap[b]/eq_exposure*100   (each block → 100.00%)
```

**Overlap** = `Σ min(w_A, w_B)` over common top-20 stocks; diagonal = 100%.

**Issuer / rating canonicalisation for debt** — reuse the Proposal Playbook parser (strip leading coupon, trailing maturity dates, `PERP`/`CALL`/`SR`; map GOI→Government of India, TREPS→Tri-Party Repo, Clearing Corporation→Clearing Corporation of India Ltd.; Title-case ALL-CAPS; default rating `AAA` where missing).

---

## 6. PPT Export Spec

Use **PptxGenJS (`@3.12.0`)**, `LAYOUT_WIDE`. Every slide uses the universal master (§1). **Slide order (no cover, no annexure, no disclaimer, no market-update — per scope decision):**

1. **ASSET ALLOCATION** (§4A) — table + 2 pies.
2. **AMC ALLOCATION (ACROSS MUTUAL FUND)** (§4B) — horizontal bar + 20% line + breach flags.
3. **PORTFOLIO HOLDINGS – `<CLIENT>`** (§4C) — one slide per client (+ continuation slides if long).
4. **PORTFOLIO ANALYTICS — EQUITY** (§4D); then **PORTFOLIO ANALYTICS — DEBT** if debt exposure exists.
5. **OVERLAP MATRIX — LISTED EQUITY** (§4E) — only if ≥2 eligible funds.
6. **PERFORMANCE SHEET** (§4F) — one slide per bucket present (Equity MF / Hybrid MF / Debt MF / PMS / AIF), splitting long buckets across slides.
7. **PORTFOLIO OBSERVATIONS** (§4G).

Filename: `Portfolio Review_<Family/Client Name>_<DD Mon YYYY>.pptx`. Match the sample deck's fonts, fills and coordinates slide-for-slide. Never let text overflow a container — split, shrink or relayout.

---

## 7. Excel Export Spec (mirror the deck)

Use **SheetJS (`xlsx@0.18.5`)**. Sheets in this order, mirroring the sample workbook:
1. **Base File** — the parsed holdings (all 19 columns).
2. **Asset Allocation** — the §4A table.
3. **AMC Allocation** — AMC · % of MF · Breach flag.
4. One sheet per client (e.g. **S Palanivel**, **G Bhuvne…**) — the §4C holding sheet, hierarchical with Grand Total.
5. **Equity Analytics** — Market Cap (4) + Top 10 Sectors + Top 20 Stocks.
6. **Debt Analytics** — Sectors + Rating + Top 20 Issuers (if applicable).
7. **Overlap Matrix** — eligible funds × eligible funds, diagonal 100.
8. **Performance** — one block per bucket with benchmark rows.
9. **Observations** — the generated observation list.

Percentages 2 decimals; ₹ Crore; flag outliers; negatives in red number format.

---

## 8. Behavioural Rules

1. **Never fabricate data** — unmatched instruments or missing metrics render `—` and are surfaced as "unmatched", not zero-filled.
2. **Fuzzy-match threshold = ≥3 shared tokens**; validate one-to-one matching every run; prefer explicit aliases over lowering the threshold.
3. **Every percent has 2 decimals.** Base-file `Allocation/XIRR/BMXIRR` are fractions → ×100 first.
4. **All money in ₹ Crore**, 2 decimals (columns 13–15).
5. **AMC cap = 20% of the Mutual Fund allocation**; breaches in `--red` + flag + Observation #2.
6. **Hybrid funds split** — equity side → equity analytics, debt side → debt analytics; never double-count.
7. **Normalise analytics last** — accumulate ₹ Cr, divide by exposure at the end so each block = 100.00%.
8. **Overlap only for funds with stock-level data**; skip the rest silently.
9. **Per-client holding sheets re-base allocation to that client's total**, not the family total.
10. **Negatives & breaches only in `#931621`** — red is never decorative.
11. **No corpus input, no 100% gate** — this reviews a real portfolio; downloads enable once a base file loads and ≥1 row matches.
12. Persist UI state in memory only — no `localStorage` unless asked.

---

## 9. Acceptance Criteria

- [ ] Single `Portfolio_Review.html` opens with no console errors; CDN: `chart.js@4.4.0`, `xlsx@0.18.5`, `pptxgenjs@3.12.0`.
- [ ] Uploading the sample base file populates all six surfaces + Observations.
- [ ] Asset Allocation table nests Asset → Product → Grand Total with `% CMV` summing to 100.00%; two pies render.
- [ ] AMC chart shows MF-only AMC weights normalised to 100%, with a 20% line and breaches in red.
- [ ] One holding slide per client; per-client allocation re-based; XIRR/BMXIRR CMV-weighted; negatives red.
- [ ] Equity & Debt analytics each sum to 100.00%; hybrid funds split correctly with no double-counting.
- [ ] Overlap matrix diagonal = 100%, off-diagonals colour-coded, legend present.
- [ ] Performance sheet shows every bucket present in the portfolio with benchmark rows; missing data `—`.
- [ ] Observations include the 4 mandatory items (allocation, AMC breach, product concentration, self-generated) with real numbers.
- [ ] PPT carries the Centricity logo on every slide; Cambria throughout; white backgrounds; no accent lines under titles.
- [ ] Unmatched instruments are surfaced, never fabricated.

---

## 10. Suggested Build Order

1. Embed the reference JSON (reuse Proposal Playbook `MASTER`/analytics/performance/benchmarks) + `DATA_DATES`.
2. Build the base-file uploader + parser (19 columns, fraction→% handling, whitespace normalisation).
3. Implement the fuzzy matcher (≥3 tokens) + unmatched-instrument report.
4. Asset Allocation (table + pies) → AMC Allocation (bar + breach).
5. Per-client Holding Sheets (re-based weights, weighted XIRR).
6. Analytics engine (CMV-weighted, hybrid split, normalise last) → Equity & Debt blocks.
7. Overlap matrix.
8. Performance sheet (all buckets, benchmark rows).
9. Observations engine (4 logics + auto).
10. PPT + Excel exporters; visual QA slide-by-slide against the sample deck.

---

## 11. Smoke Test

Use the sample family `Portfolio Update_ Mr. S Palanivel Family_20th May 2026.xlsx`. Expected:
- 100% Equity, 100% Mutual Funds; family CMV ≈ ₹11.01 Cr.
- Mcap split ≈ Large 38.91% / Mid 35.53% / Small 18.60% / Others 6.96%.
- Two client holding slides (S Palanivel ≈ ₹6.07 Cr CMV, G Bhuvaneswari ≈ ₹4.94 Cr CMV) with per-client weights (HDFC Mid Cap = 15.95% on S Palanivel's sheet).
- AMC chart: **no breach** in this sample — the largest AMC (HDFC) is ≈ 13.08% of the MF book, under the 20% cap. So Observation #2 should *confirm the portfolio respects the per-AMC cap*, not flag a breach. (A breach would only show if an AMC exceeded 20.00%.)
- Overlap matrix with the ~11 eligible equity funds.
- Observations: aggressive 100%-equity profile; AMC-cap respected (max ≈13.08%); "all mutual funds → introduce Centricity-focused PMS/AIF"; plus overlap/under-performer/rebalancing notes.

---

*End of build prompt. Hand this document — together with the monthly/weekly reference data files and one client base file — to the build agent and ask for the `Portfolio_Review.html` dashboard plus the PowerPoint and Excel exports.*
