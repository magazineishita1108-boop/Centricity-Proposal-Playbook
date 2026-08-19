// ============================================================================
//  Centricity_SIF_Refresh.js   —   SIF (Specialised Investment Funds) refresh
//  Source: "SIF Master List_June 2026.xlsx" (28 funds, Products team).
//
//  Runs AFTER Centricity_IRR_Offshore.js, so it wins last. It:
//   (1) Removes ALL pre-existing product_class==="SIF" rows, AND removes SIF
//       long-short funds that were mis-filed in the base data as ordinary
//       "Mutual Fund" rows under Equity/Hybrid (Large Cap, Mid Cap, etc.) —
//       matched precisely by the 28 Excel scheme names. GIFT City long/short &
//       absolute-return funds and stocks (Sapphire Foods, Optimus Finance) are
//       NOT SIFs and are left untouched.
//   (2) Adds the 28 rows below — every SIF now sits ONLY under Hybrid > SIF.
//       Expected-return range -> irr_low/irr_high; exit load -> exit_load.
//       Actual returns (r1y/r3y/r5y/si/aum) are left null on purpose — filled
//       by the "SIF Performance" uploader in Section 7 (REFRESH.parseSif).
//   (3) Registers REFRESH.parseSif so an uploaded SIF performance sheet merges
//       returns by scheme name and stamps DATA_DATES.sif ("as on <date>").
//
//  Keep deployed next to index.html. Fold the 28 rows into the embedded
//  window.MASTER at the next clean refresh, then delete this file.
// ============================================================================
(function () {
  try {
    var SIF = [{"name":"Edelweiss Altiva Equity Ex-Top 100 Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.13,"irr_high":0.15,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"0.50% on or before 90D, Nil after 90D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Edelweiss","sif_raw":"Altiva Equity Ex-Top 100 Long-Short Fund-Reg(G)"},{"name":"Edelweiss Altiva Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"0.50% on or before 90D, Nil after 90D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Edelweiss","sif_raw":"Altiva Hybrid Long-Short Fund-Reg(G)"},{"name":"Aditya Birla Apex Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"0.50% on or before 90D, Nil after 90D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Aditya Birla","sif_raw":"Apex Hybrid Long-Short Fund-Reg(G)"},{"name":"Union Arthaya Equity Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.11,"irr_high":0.13,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 1Y, Nil after 1Y","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Union","sif_raw":"Arthaya Equity Long Short Fund-Reg(G)"},{"name":"Bandhan Arudha Equity Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.11,"irr_high":0.13,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"0.50% on or before 30D, Nil after 30D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Bandhan","sif_raw":"Arudha Equity Long-Short Fund-Reg(G)"},{"name":"Bandhan Arudha Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"NIL","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Bandhan","sif_raw":"Arudha Hybrid Long-Short Fund-Reg(G)"},{"name":"ITI Diviniti Equity Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.11,"irr_high":0.13,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"Nil upto 10% of units and 0.50% for remaining units on or before 6M, Nil after 6M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"ITI","sif_raw":"Diviniti Equity Long Short Fund-Reg(G)"},{"name":"360 One DynaSIF Active Asset Allocator Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"0.50% on or before 3M, Nil after 3M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"360 One","sif_raw":"DynaSIF Active Asset Allocator Long-Short Fund-Reg(G)"},{"name":"360 One DynaSIF Equity Ex-Top 100 Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.13,"irr_high":0.15,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"0.50% on or before 3M, Nil after 3M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"360 One","sif_raw":"DynaSIF Equity Ex-Top 100 Long-Short Fund-Reg(G)"},{"name":"360 One DynaSIF Equity Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.11,"irr_high":0.13,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"0.50% on or before 3M, Nil after 3M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"360 One","sif_raw":"DynaSIF Equity Long-Short Fund-Reg(G)"},{"name":"Kotak Infinity Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"NIL","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Kotak","sif_raw":"Infinity Hybrid Long-Short Fund-Reg(G)"},{"name":"ICICI iSIF Active Asset Allocator Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 12M, Nil after 12M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"ICICI","sif_raw":"iSIF Active Asset Allocator Long-Short Fund-Reg(G)"},{"name":"ICICI iSIF Equity Ex-Top 100 Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.13,"irr_high":0.15,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 12M, Nil after 12M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"ICICI","sif_raw":"iSIF Equity Ex-Top 100 Long-Short Fund-Reg(G)"},{"name":"ICICI iSIF Equity Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.11,"irr_high":0.13,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 12M, Nil after 12M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"ICICI","sif_raw":"iSIF Equity Long-Short Fund-Reg(G)"},{"name":"ICICI iSIF Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 12M, NIL after 12M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"ICICI","sif_raw":"iSIF Hybrid Long-Short Fund-Reg(G)"},{"name":"SBI Magnum Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"0.50% on or before 15D, 0.25% after 15D but on on or before 30D, Nil after 30D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"SBI","sif_raw":"Magnum Hybrid Long Short Fund-Reg(G)"},{"name":"Mirae Asset Platinum Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 30D, Nil after 30D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Mirae Asset","sif_raw":"Platinum Hybrid Long-Short Fund-Reg(G)"},{"name":"Quants Qsif Active Asset Allocator Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 15D, Nil after 15D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Quants","sif_raw":"Qsif Active Asset Allocator Long-Short Fund-Reg(G)"},{"name":"Quants Qsif Equity Ex-Top 100 Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.13,"irr_high":0.15,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 15D, Nil after 15D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Quants","sif_raw":"Qsif Equity Ex-Top 100 Long-Short Fund-Reg(G)"},{"name":"Quants Qsif Equity Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.11,"irr_high":0.13,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 15D, Nil after 15D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Quants","sif_raw":"Qsif Equity Long-Short Fund-Reg(G)"},{"name":"Quants Qsif Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 15D, Nil after 15D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Quants","sif_raw":"Qsif Hybrid Long-Short Fund-Reg(G)"},{"name":"Quants Qsif Sector Rotation Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.1,"irr_high":0.12,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 15D, Nil after 15D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Quants","sif_raw":"Qsif Sector Rotation Long-Short Fund-Reg(G)"},{"name":"HSBC RedHex Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"2% on or before 1Y, NIL after 1Y","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"HSBC","sif_raw":"RedHex Hybrid Long-Short Fund-Reg(G)"},{"name":"Franklin Sapphire Equity Long-Short SIF","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.11,"irr_high":0.13,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 1Y, Nil after 1Y","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Franklin","sif_raw":"Sapphire Equity Long-Short SIF-Reg(G)"},{"name":"Tata Titanium Equity Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.11,"irr_high":0.13,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 1M, Nil after 1M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Tata","sif_raw":"Titanium Equity Long-Short Fund-Reg(G)"},{"name":"Tata Titanium Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"1% on or before 1Y, Nil after 1Y","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Tata","sif_raw":"Titanium Hybrid Long-Short Fund-Reg(G)"},{"name":"The Wealth Company WSIF Equity Ex-Top 100 Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.13,"irr_high":0.15,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"NIL","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"The Wealth Company","sif_raw":"WSIF Equity Ex-Top 100 Long-Short Fund-Reg(G)"},{"name":"The Wealth Company WSIF Equity Long-Short Fund","asset_class":"Hybrid","product_class":"SIF","sub_category":"Hybrid SIF","irr_low":0.11,"irr_high":0.13,"aum":null,"r1m":null,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":null,"expense":null,"inception":null,"fund_mgr":null,"exit_load":"NIL","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"The Wealth Company","sif_raw":"WSIF Equity Long-Short Fund-Reg(G)"}];

    // Normalised-name key -> strip plan/suffix noise so "iSIF Equity ...-Reg(G)"
    // (base-data MF row) and the Excel scheme name collapse to the same key.
    function _normSif(s){ return String(s==null?'':s).toLowerCase()
      .replace(/-\s*reg\s*\(g\)|-\s*reg\s*\(d\)/g,' ')
      .replace(/\(g\)|\(d\)|\(idcw\)/g,' ')
      .replace(/\breg\b|\bregular\b|\bgrowth\b|\bidcw\b|\bplan\b|\boption\b|\bfund\b|\bsif\b/g,' ')
      .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }

    if (window.MASTER && Array.isArray(window.MASTER)) {
      // Build the removal key-set from the 28 Excel scheme names (raw + display).
      var _sifKeys = {};
      SIF.forEach(function (r) { [r.sif_raw, r.name].forEach(function (k) { var n = _normSif(k); if (n) _sifKeys[n] = 1; }); });

      var before = window.MASTER.length, dupNames = [];
      window.MASTER = window.MASTER.filter(function (f) {
        if (!f) return false;
        if (f.product_class === 'SIF') return false;                 // drop old SIF rows (Hybrid SIF + mis-filed Equity SIF)
        if (_sifKeys[_normSif(f.name)]) { dupNames.push(f.name); return false; } // drop SIF funds mis-filed as MF rows
        return true;
      });
      var removed = before - window.MASTER.length;
      window.MASTER = window.MASTER.concat(SIF);
      window.__SIF_REFRESH_APPLIED = { removed: removed, dupRemoved: dupNames.length, dupNames: dupNames, added: SIF.length, total: window.MASTER.length };
    }

    // ---- Taxonomy / display metadata for the SIF tab (only set if missing) ----
    if (window.DATA_DATES && !window.DATA_DATES.sif) window.DATA_DATES.sif = "\u2014"; // no perf uploaded yet
    if (window.RATIONALE && !window.RATIONALE["Hybrid SIF"]) window.RATIONALE["Hybrid SIF"] =
      "Specialised Investment Funds — SEBI's new category (Rs 10 lakh minimum) permitting long-short strategies with up to 25% unhedged shorts inside a mutual-fund-like wrapper. Gives the investor access to long-short alpha previously restricted to AIFs, with daily-NAV operational comfort.";
    if (window.BENCHMARKS && !window.BENCHMARKS["Hybrid SIF"]) window.BENCHMARKS["Hybrid SIF"] = ["NIFTY 50 - TRI"];
    if (window.LIQUIDITY_MAP && !window.LIQUIDITY_MAP["SIF"]) window.LIQUIDITY_MAP["SIF"] = ["Close Ended", "SIF lock-in"];

    // ======================================================================
    //  REFRESH.parseSif — merge an uploaded SIF performance sheet into the
    //  28 SIF rows by (normalised) scheme name; stamp DATA_DATES.sif.
    //  opts.asOn = the "as on" date typed in the upload card (string or Date).
    // ======================================================================
    window.REFRESH = window.REFRESH || {};
    window.REFRESH.parseSif = async function (file, opts) {
      try {
        opts = opts || {};
        if (typeof XLSX === 'undefined') throw new Error('Excel library (XLSX) not loaded');
        var buf = await file.arrayBuffer();
        var wb = XLSX.read(buf, { type: 'array', cellDates: true });

        function cv(sheet, r, c) { var a = XLSX.utils.encode_cell({ r: r, c: c }); var cell = sheet[a]; return cell ? cell.v : null; }
        // Auto-detect percent vs decimal: 12.5 -> 0.125 ; 0.125 -> 0.125
        // Returns only. A Date cell reads as epoch milliseconds through Number(), and an absurd
        // magnitude means the column was mis-identified — reject rather than store 1760898590000%.
        function pctToDec(v) {
          if (v == null || v === '') return null;
          if (v instanceof Date) return null;
          var n = Number(v); if (!isFinite(n)) return null;
          var d = Math.abs(n) >= 1 ? n / 100 : n;
          return Math.abs(d) > 10 ? null : d;   // beyond 1000% is a mis-mapped column, not a return
        }
        function norm(s) { return _normSif(s); }
        function fmtAsOnLite(d) { var M = ['January','February','March','April','May','June','July','August','September','October','November','December']; var day = d.getDate(), j = day % 10, k = day % 100; var s = (j === 1 && k !== 11) ? 'st' : (j === 2 && k !== 12) ? 'nd' : (j === 3 && k !== 13) ? 'rd' : 'th'; return day + s + ' ' + M[d.getMonth()] + ' ' + d.getFullYear(); }
        function parseDateLite(x) { if (x instanceof Date) return isNaN(x) ? null : x; var d = new Date(x); if (!isNaN(d)) return d; var m = String(x).match(/(\d{1,2})(?:st|nd|rd|th)?[\s_.-]+([A-Za-z]{3,9})[\s_.-]+(\d{4})/); if (m) { var MON = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 }; var mo = MON[m[2].slice(0,3).toLowerCase()]; if (mo != null) { var dd = new Date(+m[3], mo, +m[1]); if (!isNaN(dd)) return dd; } } return null; }

        var sifRecs = (window.MASTER || []).filter(function (f) { return f.product_class === 'SIF'; });
        if (!sifRecs.length) throw new Error('No SIF rows in dataset to update');
        var index = {};
        sifRecs.forEach(function (f) {
          var keys = [f.sif_raw, f.name, (f.sif_amc ? f.name.slice(String(f.sif_amc).length) : '')];
          keys.forEach(function (k) { var nk = norm(k); if (nk && !index[nk]) index[nk] = f; });
        });
        function matchRec(nm) {
          var nk = norm(nm); if (!nk) return null;
          if (index[nk]) return index[nk];
          var hits = sifRecs.filter(function (f) {
            var a = norm(f.sif_raw), b = norm(f.name);
            return (a && (a.indexOf(nk) >= 0 || nk.indexOf(a) >= 0)) || (b && (b.indexOf(nk) >= 0 || nk.indexOf(b) >= 0));
          });
          return hits.length === 1 ? hits[0] : null;
        }
        function colKind(h) {
          var t = String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
          if (!t) return null;
          // "Inception Date" must not reach 'si' through /incept/ — a date column is never a
          // return and never an AUM.
          if (/\bdate\b/.test(t)) return null;
          if (/\baum\b/.test(t)) return 'aum';
          if (/since inception|incept|^si$/.test(t)) return 'si';
          if (/\b10\s*y/.test(t)) return 'r10y';
          if (/\b1\s*y/.test(t)) return 'r1y';
          if (/\b2\s*y/.test(t)) return 'r2y';
          if (/\b3\s*y/.test(t)) return 'r3y';
          if (/\b5\s*y/.test(t)) return 'r5y';
          if (/\b1\s*m/.test(t)) return 'r1m';
          if (/\b3\s*m/.test(t)) return 'r3m';
          if (/\b6\s*m/.test(t)) return 'r6m';
          return null;
        }

        var matched = 0, updatedFields = 0, missed = [];
        wb.SheetNames.forEach(function (sn) {
          var sheet = wb.Sheets[sn]; if (!sheet || !sheet['!ref']) return;
          var range = XLSX.utils.decode_range(sheet['!ref']);
          var HR = -1, nameCol = -1;
          for (var rr = range.s.r; rr <= Math.min(range.s.r + 30, range.e.r) && HR < 0; rr++) {
            for (var cc = range.s.c; cc <= range.e.c; cc++) {
              var t = String(cv(sheet, rr, cc) || '').toLowerCase().trim();
              if (t === 'scheme name' || t === 'fund name' || t === 'scheme' || t === 'name' || t === 'fund' || /scheme name|fund name/.test(t)) { HR = rr; nameCol = cc; break; }
            }
          }
          if (HR < 0) return;
          var colMap = {}, used = {};
          for (var c = range.s.c; c <= range.e.c; c++) {
            if (c === nameCol) continue;
            var k = colKind(cv(sheet, HR, c));
            if (k && !used[k]) { colMap[c] = k; used[k] = 1; }
          }
          for (var r = HR + 1; r <= range.e.r; r++) {
            var nm = cv(sheet, r, nameCol);
            if (nm == null || String(nm).trim() === '') continue;
            var low = String(nm).toLowerCase();
            if (/benchmark|average|^total|nifty|^index\b/.test(low)) continue;
            var rec = matchRec(nm);
            if (!rec) { missed.push(String(nm).trim()); continue; }
            var got = false;
            Object.keys(colMap).forEach(function (ci) {
              var field = colMap[ci], raw = cv(sheet, r, parseInt(ci, 10));
              var val = field === 'aum'
                ? ((raw == null || raw instanceof Date || !isFinite(Number(raw))) ? null : Number(raw))
                : pctToDec(raw);
              if (val != null && !(typeof val === 'number' && isNaN(val))) { rec[field] = val; got = true; updatedFields++; }
            });
            if (got) matched++;
          }
        });

        var d = parseDateLite(opts.asOn);
        var asOnStr = d ? fmtAsOnLite(d) : (typeof opts.asOn === 'string' && opts.asOn.trim() ? opts.asOn.trim() : null);
        if (asOnStr && window.DATA_DATES) window.DATA_DATES.sif = asOnStr;

        if (matched === 0) return { ok: false, error: 'No SIF schemes matched the file. Ensure it has a "Scheme Name" column and return columns (1Y/3Y/5Y). Unmatched sample: ' + missed.slice(0, 4).join(' | ') };
        return { ok: true, message: 'SIF performance updated \u2014 ' + matched + ' fund(s), ' + updatedFields + ' value(s)' + (asOnStr ? ' \u00b7 as on ' + asOnStr : '') + (missed.length ? (' \u00b7 ' + missed.length + ' unmatched') : '') };
      } catch (err) {
        console.error('parseSif error', err);
        return { ok: false, error: err && err.message ? err.message : String(err) };
      }
    };
  } catch (e) {
    console.error('SIF refresh override failed:', e);
  }
})();
