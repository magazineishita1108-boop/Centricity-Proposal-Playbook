# Centricity Proposal Dashboard

Internal investment-proposal tool for the Centricity Products team. Builds Investment Proposals, deployment plans and analytics for HNI / UHNI / Family Office clients across MF, ETF, Index, PMS, AIF, SIF, Bonds, REITs and Gift City products.

**Live URL:** `https://<your-github-username>.github.io/<repo-name>/`

> Anyone who has this link can use the dashboard. Do not share it outside the Products team or beyond the wealth-management organisation.

---

## For team members (using the dashboard)

1. Open the live URL above in Chrome or Edge.
2. Set the client's corpus and risk profile in Sections 1 and 2.
3. Pick funds in Section 3. The gold **Centricity Select** chip marks the firm's shortlisted picks for each sub-category — click the chip to see the risk-reward ratios (Sharpe, Sortino, Beta, Std Dev, Alpha) for mutual funds, or the Reckoner-style detail card (target return, minimum investment, fund structure, fee structure, etc.) for PMS, AIF, SIF and Gift City products. Shortlisting parameters appear at the bottom of every popover.
4. Adjust allocations in Section 4. PMS / AIF rows enforce their regulatory minimum (`₹50 L` for PMS, `₹1 Cr` for AIF, `₹1 Cr` for Neo Yield Enhancer, `₹5 Cr` for Campus Fund III) — the stepper will not let you go below it. If the corpus is too small to accommodate the minimum, the Add button is disabled.
5. Section 7 — Data Refresh — lets you drop in the latest **MF Monitor** xlsx for your session if your performance numbers need to be more current than the dashboard's embedded base. **This refresh applies only to your browser session** and is reset when you close the tab. It does not affect the dashboard for anyone else.
6. Download the proposal as Excel or PowerPoint when 100% is allocated. Both files land in your local Downloads folder.

Nothing you do in the browser is shared back to anyone else. Every user gets a clean copy of the dashboard each time they open the page.

### Need fresher base data?

Base data (the underlying universe, the analytics, the Centricity Select picks) is refreshed by the Products admin once a month. If a fund is missing or your numbers look stale, ping the admin (see below).

---

## For the admin (refreshing base data)

You are the only person with push access to this repo, so you are the only one who can refresh the base data the team sees.

### Monthly refresh — what changes

| What | Source | Refresh cadence |
|---|---|---|
| `MASTER` (universe + performance) | `Daily MF monitor_*.xlsx` | every 15 days |
| `EQUITY_ANALYTICS` | `Equity Analytics_*.xlsx` | monthly |
| `HYBRID_ANALYTICS` | `Hybrid_For Analytics_*.xlsx` | monthly |
| `DEBT_ANALYTICS` | `Debt_For Analytics_*.xlsx` | monthly |
| `EQUITY_ANALYTICS` (PMS schemes only) | `PMS_Analytics *.xlsx` | monthly |
| `CENTRICITY_SELECT` | `OneDigital Reckoner_*.xlsx` | monthly |

### Steps each refresh

1. **Drop the new xlsx files** into your local `uploads/` workspace (the same place you used in Claude before).
2. **Run the build scripts in order:**
   ```
   python tools/build_basedata.py             # MASTER + Equity/Hybrid/Debt Analytics
   python tools/build_pms_analytics.py        # PMS holdings (merges into Equity Analytics)
   python tools/build_centricity_select_v3.py # Centricity Select picks
   ```
   Each script rewrites the relevant `window.<...>` block inside `index.html`.
3. **Sanity-check** the new file:
   ```
   node --check <(grep -oP '<script[^>]*>\K[\s\S]*?(?=</script>)' index.html)
   ```
   or just open it in a browser locally and confirm it renders.
4. **Commit and push:**
   ```
   git add index.html
   git commit -m "Refresh base data — <month> <year>"
   git push
   ```
5. GitHub Pages auto-deploys in ~1–2 minutes. The team picks up the new version the next time they refresh the page.

If a refresh ships something broken, GitHub's commit history is your rollback — `git revert <commit>` and push. Pages redeploys the previous good version automatically.

### What never goes in the repo

The build scripts are tracked, but the **input xlsx files are not**. They live only on your machine. The `.gitignore` blocks them so they cannot be accidentally pushed.

---

## Tech notes

- The dashboard is a single self-contained HTML file (~5 MB). All base data is embedded directly inside `<script>` tags so the page works offline once loaded.
- External libraries (React, XLSX-JS, PptxGenJS, etc.) load from `cdnjs.cloudflare.com` — users need internet access to fetch them. After the first load, the browser caches them.
- The page contains no client data and no PII. Only fund-universe metadata, returns, analytics and shortlisting rationales.
- The `robots.txt` blocks search engines from indexing the page so the URL stays effectively private.

---

*Maintained by the Centricity Products team. Questions: `rahul.yadav@centricity.co.in`*
