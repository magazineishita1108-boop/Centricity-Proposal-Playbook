# Equity & Debt Look-Through Analytics — End-to-End Build Prompt

> **Purpose of this prompt.** Paste this into a new project to reproduce the exact Equity & Debt analytics engine used in the Centricity Proposal Playbook dashboard. It specifies (A) the **data pipeline** that builds the per-fund analytics JSON from source factsheets, and (B) the **look-through aggregation engine** that rolls those holdings up across a selected portfolio into market-cap split, sector allocation, top stocks, issuer/rating breakdown, and fund-overlap. The two layers are decoupled — the engine reads three JSON dictionaries; the pipeline produces them. Build them to the contract below and they interoperate.

---

## 0. Core idea in one paragraph

A client portfolio is a list of `{fund, pct}` selections plus a total corpus in ₹ Crore. Mutual funds, hybrids, PMS, bonds etc. are **containers** — what actually sits inside them is stocks (equity) and debt instruments (issuers). "Analytics" means **looking through** each container to its underlying holdings, weighting every holding by how much money the client has in that container, and then summing across the whole portfolio to answer: *what is my true market-cap mix, sector exposure, single-stock concentration, debt issuer concentration, and credit-rating profile — as if I held the underlying securities directly?* Hybrids are split into an equity sleeve and a debt sleeve so each lands in the right bucket. The output is always normalized to **% of the asset class** (equity buckets sum to 100% of equity, debt buckets to 100% of debt), never % of the whole portfolio.

---

## PART A — DATA PIPELINE (build the analytics JSON)

You produce **three** dictionaries, each **keyed by the fund's exact name** (the same string used as the fund identifier everywhere else in the app — names must match the master/holdings list character-for-character, or the look-up silently misses). All percentages are stored as plain numbers on a **0–100 scale** (e.g. `28.76`, not `0.2876`); the engine divides by 100 when it consumes them.

### A.1 `EQUITY_ANALYTICS` — one entry per pure-equity product

```json
"<Fund Name>": {
  "mcap":   { "Large": 99.41, "Mid": 0, "Small": 0, "Others": 0.59 },
  "sector": { "Bank": 28.77, "Crude Oil": 9.81, "IT": 8.56, "...": "..." },
  "stocks": [ { "name": "HDFC Bank Ltd.", "pct": 10.71 },
              { "name": "Reliance Industries Ltd.", "pct": 8.76 }, "..." ],
  "total":  100.0
}
```

- `mcap` — market-cap split of the equity holdings. Four fixed keys: `Large`, `Mid`, `Small`, `Others`. Should sum to ~`total`.
- `sector` — sector → % of portfolio. Free-form sector labels (keep them consistent across funds so they aggregate).
- `stocks` — array of `{name, pct}`, one per holding, pct = % of the fund's portfolio. Sort descending by pct.
- `total` — total equity exposure of the fund as a %. For a pure-equity fund this is ≈100 (minus cash). **This is the number the engine uses to weight the fund's equity sleeve**, so it matters.

### A.2 `HYBRID_ANALYTICS` — one entry per hybrid product (equity **and** debt sleeves)

```json
"<Fund Name>": {
  "eq_mcap":     { "Large": 27.05, "Mid": 7.05, "Small": 9.54, "Others": 1.97 },
  "eq_sector":   { "Bank": 7.43, "Finance": 5.45, "...": "..." },
  "eq_stocks":   [ { "name": "HDFC Bank Ltd.", "pct": 2.39 }, "..." ],
  "eq_total":    45.61,
  "db_sector":   { "Finance": 27.20, "G-Sec": 14.31, "...": "..." },
  "db_holdings": [ { "issuer": "REC Ltd. -SR-223 A 07.46% (30-Jun-2028)", "rating": "AAA", "pct": 4.76 }, "..." ],
  "db_rating":   { "SOV": 14.31, "AA+": 4.59, "AAA": 30.95 },
  "db_total":    49.86
}
```

- `eq_*` mirror the equity schema; `eq_total` = equity sleeve weight (% of fund in equity).
- `db_sector` — debt sector/segment → %; `db_holdings` — array of `{issuer, rating, pct}`; `db_rating` — rating → % (raw agency labels).
- `db_total` — debt sleeve weight. `eq_total + db_total + cash ≈ 100`.
- **The split is the whole point of the hybrid block** — the engine routes `eq_*` into equity analytics and `db_*` into debt analytics, each weighted by the respective sleeve total.

### A.3 `DEBT_ANALYTICS` — one entry per pure-debt product

```json
"<Fund Name>": {
  "sector":   { "G-Sec": 46.82, "Finance": 39.04, "Power": 5.12, "...": "..." },
  "holdings": [ { "issuer": "07.26% GOI - 22-Aug-2032", "rating": "SOV", "pct": 11.29 }, "..." ],
  "rating":   { "SOV": 46.82, "AAA": 23.48, "AA+": 12.18, "Cash & Equivalent": 4.18, "...": "..." }
}
```

- `sector` — debt segment → %; `holdings` — `{issuer, rating, pct}` per instrument; `rating` — rating → %.
- Ratings are kept as the **raw labels from the factsheet** (`SOV`, `AAA`, `AA+`, `AA-`, `Cash & Equivalent`, `REITs & InvITs`, `UNRATED`, …). The engine does **not** re-bucket them; it just sums and strips near-zero entries. Keep labels consistent across funds so they aggregate cleanly.

### A.4 Pipeline rules (how to generate the above)

1. **Source** — monthly AMC factsheets / ACE portfolio-holdings exports (one as-on date for the whole set). Parse each fund's holdings table: security name, %-to-NAV, market-cap class (for equity), instrument sector/segment, credit rating (for debt).
2. **Classify each holding** equity vs debt; for hybrids keep both and tag each sleeve. Compute `total` / `eq_total` / `db_total` as the summed weight of each sleeve.
3. **Market-cap bucketing** — map each equity holding to `Large / Mid / Small / Others` (use the source's SEBI mcap class; cash/derivatives/unclassified → `Others`).
4. **Keying** — key every entry by the fund's canonical name. **Names must exactly match** the names in the portfolio/master list, or the engine won't find the block (it then falls back to coarse fund-level data — see B.6).
5. **IDCW → Growth aliasing** — analytics files usually name a fund by its **dividend (IDCW) plan**, but portfolios reference the **growth (G) plan**; same portfolio, different name. After loading, alias every IDCW/Dividend/Div/`(D)`-suffixed key to its `(G)` equivalent so growth-plan look-ups resolve. Regex on the trailing option in the name, replace with `(G)`, copy the analytics across.
6. **As-on dates** — track the analytics as-on date **separately** from the returns/performance as-on date (they refresh on different cadences). Surface both to the user (e.g. *"Performance as on 15-May-2026 & Analytics as on 30-Apr-2026"*).
7. **Never fabricate** — if a fund has no holdings file, leave it out of these dicts. The engine degrades gracefully (B.6). Cite the source and as-on date for every refresh.

---

## PART B — AGGREGATION ENGINE (look-through roll-up)

### B.0 Common signature

```
input:  selected = [ { fund: <masterRow>, pct: <0–100 allocation> }, ... ]
        corpus   = total investable amount (₹ Cr)
per fund: A = corpus * pct / 100      // rupee amount in this fund; skip if A <= 0
```

Every aggregation walks `selected`, computes `A`, pulls the fund's analytics block (or a sleeve of it), multiplies each underlying weight by `A`, and accumulates into rupee-denominated buckets. At the end it normalizes by the relevant **exposure** total (not by corpus) so the result is "% of equity" / "% of debt".

### B.1 `aggEquityScoped(selected, corpus)` — equity look-through

**Scope — which products contribute to equity analytics:**

| Product | Treatment |
|---|---|
| Equity Mutual Fund | full `EQUITY_ANALYTICS` block |
| Equity Index Fund | full `EQUITY_ANALYTICS` block |
| Equity ETF | full `EQUITY_ANALYTICS` block |
| Equity PMS | full `EQUITY_ANALYTICS` block |
| Equity FOF (Fund-of-Funds) | resolve to underlying ETF/Index, then use its block |
| Hybrid Mutual Fund | **equity sleeve only** — `HYBRID_ANALYTICS.eq_*`, weighted by `eq_total` |
| Listed Direct Equity (single stock) | 100% of `A` into the stock's own SEBI mcap bucket + its sector + the stock list |
| *(everything else — AIF, Unlisted, Global/International, debt, gold)* | **excluded** |

**Accumulation (rupee-weighted):**

```
For an EQUITY_ANALYTICS block eqA:
  eq_mcap[k]   += eqA.mcap[k]/100   * A      // for k in Large/Mid/Small/Others
  eq_sector[s] += eqA.sector[s]/100 * A      // for each sector s
  eq_stocks[n] += st.pct/100        * A      // for each holding {name:n, pct}
  eq_exposure  += eqA.total/100     * A      // <-- equity rupees this fund adds

For a HYBRID_ANALYTICS block hyA (equity sleeve):
  ...same, using hyA.eq_mcap / hyA.eq_sector / hyA.eq_stocks
  eq_exposure  += hyA.eq_total/100  * A      // only the equity sleeve

For Listed Direct Equity (no block):
  bucket = from fund.sebi_mcap string (contains "large"/"mid"/"small" else Others)
  eq_mcap[bucket] += A ;  eq_sector[fund.sector] += A ;  eq_stocks[fund.name] += A
  eq_exposure     += A
```

**Normalize & output** — once all funds are summed, divide every bucket by `eq_exposure` and ×100:

```
mcap     : { Large, Mid, Small, Others }            // % of equity, sums to 100
sectors  : [ [sector, pct], ... ] sorted desc       // % of equity
stocks   : [ [name,   pct], ... ] sorted desc       // % of equity (single-stock concentration)
exposure_cr : eq_exposure                            // absolute ₹ Cr in equity
```

> **Why weight by `total` / `eq_total`, not by `A`?** A fund that is only 92% invested (8% cash), or a hybrid that is 45% equity, should contribute only its *actual* equity rupees to the equity picture. `eq_exposure` is the true denominator, so a 45%-equity hybrid doesn't overstate the portfolio's equity tilt.

### B.2 `aggDebtScoped(selected, corpus)` — debt look-through

**Scope:**

| Product | Treatment |
|---|---|
| Debt Mutual Fund / Index / ETF | full `DEBT_ANALYTICS` block |
| Debt FOF | resolve to underlying ETF/Index, then its block |
| Hybrid Mutual Fund | **debt sleeve only** — `HYBRID_ANALYTICS.db_*`, weighted by `db_total` |
| Direct Bonds | issuer = `bond_issuer` (or parsed from name); rating = `bond_rating` (default `AAA & Equiv`); sector = `"Direct Bonds"`; 100% of `A` |
| Fixed Deposit | issuer = bank; rating `AAA & Equiv`; sector `"Fixed Deposits"`; 100% of `A` |
| *(everything else)* | excluded |

**Accumulation** — three parallel buckets: `sector`, `issuers` (`{pct, rating}` per issuer), `rating`:

```
For a DEBT_ANALYTICS block dbA:
  sector[s] += dbA.sector[s]/100 * A
  for each holding h in dbA.holdings:
      iss = parseIssuer(h.issuer)                  // collapse instrument → entity (B.4)
      issuers[iss].pct += h.pct/100 * A ; issuers[iss].rating = h.rating
      rating[h.rating] += h.pct/100 * A
  debt_exposure += A                                // pure debt = 100% of A

For a HYBRID_ANALYTICS block (debt sleeve): same using db_sector/db_holdings; debt_exposure += db_total/100 * A
```

**Normalize** by `debt_exposure` (×100), then **strip ratings < 0.001%**. Output:

```
sectors  : [ [sector, pct], ... ] sorted desc
issuers  : [ [issuer, {pct, rating}], ... ] sorted desc by pct   // issuer concentration
rating   : { SOV: .., AAA: .., AA+: .., ... }                    // credit-quality profile
exposure_cr : debt_exposure
```

### B.3 Fund overlap (equity only)

For any two equity funds, overlap = **sum over common stocks of `min(weightA, weightB)`**, where each fund's stock weights are first re-normalized to 100% *within its equity sleeve* (so a hybrid is compared on its equity portion, not diluted by its debt). Hybrids use `eq_stocks`.

```
overlap(A,B) = Σ over stocks s:  min( wA(s), wB(s) )      // wX re-normalized within equity sleeve
```

Build a fund×fund matrix; the diagonal is 100. Suggested colour bands: `<15` low, `15–30` moderate, `30–50` high, `≥50` very high, `=100` diagonal. Use it to flag duplicated bets across managers.

### B.4 `parseIssuer(name)` — collapse an instrument string to its issuing entity

Debt holdings are messy strings (`"REC Ltd. -SR-223 A 07.46% (30-Jun-2028)"`, `"07.26% GOI - 22-Aug-2032"`). Collapse to the entity so all of an issuer's papers sum together:

1. Special cases first: anything matching `GOI | G-Sec | Government of India` → **"Government of India"**; `TREPS | Tri-Party Repo` → **"Tri-Party Repo (TREPS)"**; `Clearing Corporation` → **"Clearing Corporation of India Ltd."**
2. Strip a leading coupon (`^\d+(\.\d+)?%?\s+`), trailing maturity dates (`\s+\d{1,2}[-/]?[A-Z]{3}[-/]?\d{4}`, `\(\d{1,2}-[A-Za-z]{3}-\d{4}\)`), and series/perp/call noise (`(PERP|CALL|SR\s+\w+)`), then dangling parentheses.
3. If the result is ALL-CAPS, Title-Case it (keeping `Ltd`/`Limited`).

### B.5 FOF resolution

A fund is a FOF if its name matches `\bFOF\b | \bFoF\b | Fund of Funds?`. Its holdings live on the underlying ETF/Index record, so: tokenize the FOF name (drop noise words like `etf, fof, reg, g, idcw, fund, plan, direct, growth, dividend, option, scheme`), and pick the master ETF/Index whose token set best overlaps (prefer same asset class — Equity FOF→Equity ETF, Debt FOF→Debt ETF). Aggregate under the FOF's allocation weight but read analytics from the underlying.

### B.6 Graceful degradation (no analytics block found)

Never drop a fund silently from the headline numbers:

- **Equity fund, no block** → fall back to fund-level `mcap_large/mid/small/other` fields if present; `eq_exposure += (sum of those) * A`.
- **Debt fund, no block** → bucket as sector `"Diversified Debt"`, rating `80% AAA & Equiv / 20% SOV (Govt)`; `debt_exposure += A`.
- These fallbacks keep totals honest while clearly flagging (in source notes) that the fund lacked a holdings file.

### B.7 Companion roll-ups (same `{fund, pct}` input — build alongside)

- **AMC concentration** — group MF/Index/ETF allocations by AMC, % of MF sleeve.
- **Liquidity** — classify each holding Open-/Close-ended (lock-ins, exit loads), % of corpus.
- **Weighted returns / KPIs** — corpus-weighted blended return (use realized `r3y/r5y` where on file, else the fund's IRR estimate range); roll up by Asset Class → Product Class → Sub-Category.
- **Risk profile check** — sum equity-type exposure vs the client's mandated equity cap; flag over/under.

---

## PART C — INVARIANTS & TEST CASES (verify the build)

1. **Scale:** every analytics value is 0–100; engine divides by 100 exactly once. A single equity fund at 100% allocation must reproduce its own `mcap`/`sector`/`stocks` (within rounding).
2. **Normalization denominator is exposure, not corpus.** A 60/40 equity/debt portfolio: equity `mcap` sums to 100 (% of equity), debt `rating` sums to 100 (% of debt) — neither sums to 60 or 40.
3. **Hybrid splits correctly:** a 100%-allocation hybrid contributes `eq_total`% to `eq_exposure` and `db_total`% to `debt_exposure`; it appears in *both* equity and debt analytics, weighted by the respective sleeve.
4. **Cash drag:** a fund with `total = 92` puts only 92% of its `A` into `eq_exposure` — equity % is computed on real equity rupees.
5. **Name-keying:** an IDCW-named analytics block resolves for a `(G)`-named portfolio holding after aliasing; a typo'd name falls through to B.6 fallback (and should be flagged, not hidden).
6. **Issuer collapse:** three different REC papers with different maturities sum into a single `"REC Ltd."` issuer line; all GOI/G-Sec papers collapse to `"Government of India"`.
7. **Overlap diagonal = 100; symmetric; two disjoint funds = 0.**

---

## Notes for adapting to a different project

- The engine only needs the three JSON dicts + a `selected[]` list with `asset_class`, `product_class`, `sub_category`, and (for fallbacks) `mcap_*`, `bond_issuer`, `bond_rating`, `sebi_mcap`. Swap the product taxonomy strings to match your own master schema, but keep the *scoping intent* (what counts as equity vs debt).
- All look-ups use loose `== null` checks, so a compact record (only a few keys) is safe — missing fields render as "—" / 0.
- Percentages: 2 decimals; AUM/amounts in ₹ Crore; annualized returns; negative values flagged in red (data only, never as a brand colour).
