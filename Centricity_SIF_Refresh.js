// ============================================================================
//  Centricity_SIF_Refresh.js   —   SIF (Specialised Investment Funds) refresh
//  Universe : "SIF Master List_June 2026.xlsx" (Products team).
//  Perf     : "SIF Monitor_31st August 2026.xlsx", baked in by merge_sif_monitor.js.
//
//  Runs AFTER Centricity_IRR_Offshore.js, so it wins last. It:
//   (1) Removes ALL pre-existing product_class==="SIF" rows, AND removes SIF
//       long-short funds that were mis-filed in the base data as ordinary
//       "Mutual Fund" rows under Equity/Hybrid (Large Cap, Mid Cap, etc.) —
//       matched precisely by the Excel scheme names. GIFT City long/short &
//       absolute-return funds and stocks (Sapphire Foods, Optimus Finance) are
//       NOT SIFs and are left untouched.
//   (2) Adds the 29 rows below — every SIF now sits ONLY under Equity/Hybrid SIF.
//       Expected-return range -> irr_low/irr_high; exit load -> exit_load.
//       Actual returns (r1m/r3m/r6m/si/aum/inception) are BAKED IN as on the
//       date in DATA_DATES.sif — re-bake each month with:
//         node merge_sif_monitor.js "<SIF Monitor_<date>.xlsx>" --apply
//   (3) Registers REFRESH.parseSif, which backs the Section 7 "SIF Monitor"
//       card — the same parser merge_sif_monitor.js runs, so an upload and a
//       bake of one file produce identical data. Users can upload a monitor as
//       on any date they like; the picker beats the file name beats the file.
//
//  Keep deployed next to index.html. Fold the rows into the embedded
//  window.MASTER at the next clean refresh, then delete this file.
// ============================================================================
(function () {
  try {
    var SIF = [{"name":"Edelweiss Altiva Equity Ex-Top 100 Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.13,"irr_high":0.15,"aum":1366.062,"r1m":0.034653,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.11635999999999999,"expense":null,"inception":"2026-06-07","fund_mgr":null,"exit_load":"0.50% on or before 90D, Nil after 90D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Edelweiss","sif_raw":"Altiva Equity Ex-Top 100 Long-Short Fund-Reg(G)"},{"name":"Edelweiss Altiva Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":9267.6255,"r1m":0.010650999999999999,"r3m":0.04091,"r6m":0.066946,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.1035,"expense":null,"inception":"2025-10-19","fund_mgr":null,"exit_load":"0.50% on or before 30D, NIL after 30D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Edelweiss","sif_raw":"Altiva Hybrid Long-Short Fund-Reg(G)"},{"name":"Aditya Birla Apex Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":176.2858,"r1m":0.019847999999999998,"r3m":0.064321,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.0739,"expense":null,"inception":"2026-03-24","fund_mgr":null,"exit_load":"0.50% on or before 90D, Nil after 90D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Aditya Birla","sif_raw":"Apex Hybrid Long-Short Fund-Reg(G)"},{"name":"Union Arthaya Equity Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.11,"irr_high":0.13,"aum":132.5296,"r1m":-0.01161,"r3m":0.2232,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.116,"expense":null,"inception":"2026-05-24","fund_mgr":null,"exit_load":"1% on or before 1Y, Nil after 1Y","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Union","sif_raw":"Arthaya Equity Long Short Fund-Reg(G)"},{"name":"Bandhan Arudha Equity Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.11,"irr_high":0.13,"aum":127.874123659,"r1m":0.2193,"r3m":0.045875000000000006,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.051,"expense":null,"inception":"2026-03-23","fund_mgr":null,"exit_load":"0.50% on or before 30D, Nil after 30D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Bandhan","sif_raw":"Arudha Equity Long-Short Fund-Reg(G)"},{"name":"Bandhan Arudha Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":146.933221404,"r1m":0.1645,"r3m":0.02181,"r6m":0.027794,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.0354,"expense":null,"inception":"2026-01-27","fund_mgr":null,"exit_load":"NIL","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Bandhan","sif_raw":"Arudha Hybrid Long-Short Fund-Reg(G)"},{"name":"ITI Diviniti Equity Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.11,"irr_high":0.13,"aum":291.4713,"r1m":-0.368,"r3m":0.02108,"r6m":-0.045050999999999994,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":-0.069895,"expense":null,"inception":"2025-11-30","fund_mgr":null,"exit_load":"Nil upto 10% of units and 0.50% for remaining units on or before 6M, Nil after 6M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"ITI","sif_raw":"Diviniti Equity Long Short Fund-Reg(G)"},{"name":"360 One DynaSIF Active Asset Allocator Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":214.436841164294,"r1m":0.011734,"r3m":0.034579,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.051070000000000004,"expense":null,"inception":"2026-03-24","fund_mgr":null,"exit_load":"0.50% on or before 3M, Nil after 3M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"360 One","sif_raw":"DynaSIF Active Asset Allocator Long-Short Fund-Reg(G)"},{"name":"360 One DynaSIF Equity Ex-Top 100 Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.13,"irr_high":0.15,"aum":150.547768541988,"r1m":0.062154,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.11198999999999999,"expense":null,"inception":"2026-06-23","fund_mgr":null,"exit_load":"0.50% on or before 3M, Nil after 3M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"360 One","sif_raw":"DynaSIF Equity Ex-Top 100 Long-Short Fund-Reg(G)"},{"name":"360 One DynaSIF Equity Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.11,"irr_high":0.13,"aum":370.398245694837,"r1m":-0.164,"r3m":0.0354,"r6m":0.06489099999999999,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.06553,"expense":null,"inception":"2026-02-24","fund_mgr":null,"exit_load":"0.50% on or before 3M, Nil after 3M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"360 One","sif_raw":"DynaSIF Equity Long-Short Fund-Reg(G)"},{"name":"Kotak Infinity Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":859.0227,"r1m":0.015038000000000001,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.0327,"expense":null,"inception":"2026-07-05","fund_mgr":null,"exit_load":"NIL","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Kotak","sif_raw":"Infinity Hybrid Long-Short Fund-Reg(G)"},{"name":"ICICI iSIF Active Asset Allocator Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":983.8303815,"r1m":0.011998,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.04173,"expense":null,"inception":"2026-06-04","fund_mgr":null,"exit_load":"1% on or before 12M, Nil after 12M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"ICICI","sif_raw":"iSIF Active Asset Allocator Long-Short Fund-Reg(G)"},{"name":"ICICI iSIF Equity Ex-Top 100 Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.13,"irr_high":0.15,"aum":2475.266030368,"r1m":0.4845,"r3m":0.047474999999999996,"r6m":0.051724,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.037000000000000005,"expense":null,"inception":"2026-02-03","fund_mgr":null,"exit_load":"1% on or before 12M, Nil after 12M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"ICICI","sif_raw":"iSIF Equity Ex-Top 100 Long-Short Fund-Reg(G)"},{"name":"ICICI iSIF Equity Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.11,"irr_high":0.13,"aum":599.338060329,"r1m":0.03916,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.08800000000000001,"expense":null,"inception":"2026-06-04","fund_mgr":null,"exit_load":"1% on or before 12M, Nil after 12M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"ICICI","sif_raw":"iSIF Equity Long-Short Fund-Reg(G)"},{"name":"ICICI iSIF Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":1323.109131633,"r1m":0.019696,"r3m":0.081502,"r6m":0.07347000000000001,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.06807,"expense":null,"inception":"2026-02-03","fund_mgr":null,"exit_load":"1% on or before 12M, NIL after 12M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"ICICI","sif_raw":"iSIF Hybrid Long-Short Fund-Reg(G)"},{"name":"SBI Magnum Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":4001.1655,"r1m":0.8664,"r3m":0.030828,"r6m":0.036595,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.055990000000000005,"expense":null,"inception":"2025-10-22","fund_mgr":null,"exit_load":"0.50% on or before 15D, 0.25% after 15D but on on or before 30D, Nil after 30D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"SBI","sif_raw":"Magnum Hybrid Long Short Fund-Reg(G)"},{"name":"Mirae Asset Platinum Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":369.6591,"r1m":0.354,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.0206,"expense":null,"inception":"2026-06-09","fund_mgr":null,"exit_load":"1% on or before 30D, Nil after 30D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Mirae Asset","sif_raw":"Platinum Hybrid Long-Short Fund-Reg(G)"},{"name":"Quants Qsif Active Asset Allocator Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":167.4534,"r1m":0.8964,"r3m":0.117408,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.14693,"expense":null,"inception":"2026-04-20","fund_mgr":null,"exit_load":"1% on or before 15D, Nil after 15D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Quants","sif_raw":"Qsif Active Asset Allocator Long-Short Fund-Reg(G)"},{"name":"Quants Qsif Equity Ex-Top 100 Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.13,"irr_high":0.15,"aum":419.9892,"r1m":0.022194,"r3m":0.145115,"r6m":0.23399699999999998,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.14452,"expense":null,"inception":"2025-11-11","fund_mgr":null,"exit_load":"1% on or before 15D, Nil after 15D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Quants","sif_raw":"Qsif Equity Ex-Top 100 Long-Short Fund-Reg(G)"},{"name":"Quants Qsif Equity Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.11,"irr_high":0.13,"aum":758.2099,"r1m":0.011158999999999999,"r3m":0.07817199999999999,"r6m":0.13491799999999998,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.10642,"expense":null,"inception":"2025-10-06","fund_mgr":null,"exit_load":"1% on or before 15D, Nil after 15D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Quants","sif_raw":"Qsif Equity Long-Short Fund-Reg(G)"},{"name":"Quants Qsif Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":213.7062,"r1m":0.016339,"r3m":0.063754,"r6m":0.111258,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.09788999999999999,"expense":null,"inception":"2025-10-14","fund_mgr":null,"exit_load":"1% on or before 15D, Nil after 15D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Quants","sif_raw":"Qsif Hybrid Long-Short Fund-Reg(G)"},{"name":"Quants Qsif Sector Rotation Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.1,"irr_high":0.12,"aum":48.5784,"r1m":0.01598,"r3m":0.018614,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.02551,"expense":null,"inception":"2026-05-14","fund_mgr":null,"exit_load":"1% on or before 15D, Nil after 15D","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Quants","sif_raw":"Qsif Sector Rotation Long-Short Fund-Reg(G)"},{"name":"HSBC RedHex Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":1072.8421,"r1m":0.8156,"r3m":null,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.018500000000000003,"expense":null,"inception":"2026-06-18","fund_mgr":null,"exit_load":"2% on or before 1Y, NIL after 1Y","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"HSBC","sif_raw":"RedHex Hybrid Long-Short Fund-Reg(G)"},{"name":"Franklin Sapphire Equity Long-Short SIF","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.11,"irr_high":0.13,"aum":null,"r1m":0.2394,"r3m":0.021963,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.012036,"expense":null,"inception":"2026-04-28","fund_mgr":null,"exit_load":"1% on or before 1Y, Nil after 1Y","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Franklin","sif_raw":"Sapphire Equity Long-Short SIF-Reg(G)"},{"name":"Tata Titanium Equity Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.11,"irr_high":0.13,"aum":207.8544029121,"r1m":0.012816000000000001,"r3m":0.057005,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.05821,"expense":null,"inception":"2026-05-13","fund_mgr":null,"exit_load":"1% on or before 1M, Nil after 1M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Tata","sif_raw":"Titanium Equity Long-Short Fund-Reg(G)"},{"name":"Tata Titanium Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":0.09,"irr_high":0.11,"aum":548.7242902827,"r1m":0.5505,"r3m":0.02754,"r6m":0.010708,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.01746,"expense":null,"inception":"2025-12-10","fund_mgr":null,"exit_load":"1% on or before 1M, NIL after 1M","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"Tata","sif_raw":"Titanium Hybrid Long-Short Fund-Reg(G)"},{"name":"The Wealth Company WSIF Equity Ex-Top 100 Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.13,"irr_high":0.15,"aum":48.452974467,"r1m":0.5532,"r3m":0.08327,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.07612000000000001,"expense":null,"inception":"2026-05-05","fund_mgr":null,"exit_load":"NIL","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"The Wealth Company","sif_raw":"WSIF Equity Ex-Top 100 Long-Short Fund-Reg(G)"},{"name":"The Wealth Company WSIF Equity Long-Short Fund","asset_class":"Equity","product_class":"Equity SIF","sub_category":"Equity SIF","irr_low":0.11,"irr_high":0.13,"aum":33.728577737,"r1m":-0.7103,"r3m":0.066063,"r6m":null,"r1y":null,"r2y":null,"r3y":null,"r5y":null,"r10y":null,"si":0.05535999999999999,"expense":null,"inception":"2026-05-05","fund_mgr":null,"exit_load":"NIL","mcap_large":null,"mcap_mid":null,"mcap_small":null,"mcap_other":null,"ytm":null,"avg_maturity":null,"mod_duration":null,"bond_issuer":null,"bond_rating":null,"sif_amc":"The Wealth Company","sif_raw":"WSIF Equity Long-Short Fund-Reg(G)"},{"name":"Prism Hybrid Long-Short Fund","asset_class":"Hybrid","product_class":"Hybrid SIF","sub_category":"Hybrid SIF","irr_low":null,"irr_high":null,"sif_amc":null,"sif_raw":"Prism Hybrid Long-Short Fund-Reg(G)","aum":297.048781092,"r1m":0.01314,"si":0.01773,"inception":"2026-07-16","exit_load":"NIL"}];

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
        // Drops the legacy "SIF" rows still in the embedded block AND anything already carrying
        // the split classes, so re-applying never doubles the bucket.
        if (f.product_class === 'SIF' || f.product_class === 'Equity SIF' || f.product_class === 'Hybrid SIF') return false;
        if (_sifKeys[_normSif(f.name)]) { dupNames.push(f.name); return false; } // drop SIF funds mis-filed as MF rows
        return true;
      });
      var removed = before - window.MASTER.length;
      window.MASTER = window.MASTER.concat(SIF);
      window.__SIF_REFRESH_APPLIED = { removed: removed, dupRemoved: dupNames.length, dupNames: dupNames, added: SIF.length, total: window.MASTER.length };
    }

    // ---- Taxonomy / display metadata for the SIF tab (only set if missing) ----
    // Assigned unconditionally, not behind a !sif guard: this file SHIPS the SIF performance,
    // so it owns the date that describes it (index.html's embedded placeholder is truthy and
    // would otherwise win). An upload still wins — REFRESH.parseSif runs long after this does.
    if (window.DATA_DATES) window.DATA_DATES.sif = "31st August 2026";  // baked from SIF Monitor_31st August 2026.xlsx
    if (window.RATIONALE && !window.RATIONALE["Hybrid SIF"]) window.RATIONALE["Hybrid SIF"] =
      "Specialised Investment Funds — SEBI's new category (Rs 10 lakh minimum) permitting long-short strategies with up to 25% unhedged shorts inside a mutual-fund-like wrapper. Gives the investor access to long-short alpha previously restricted to AIFs, with daily-NAV operational comfort.";
    if (window.BENCHMARKS && !window.BENCHMARKS["Hybrid SIF"]) window.BENCHMARKS["Hybrid SIF"] = ["NIFTY 50 - TRI"];
    if (window.LIQUIDITY_MAP && !window.LIQUIDITY_MAP["SIF"]) window.LIQUIDITY_MAP["SIF"] = ["Close Ended", "SIF lock-in"];

    // ======================================================================
    //  REFRESH.parseSif — merge an uploaded SIF Monitor into the SIF rows by
    //  (normalised) scheme name; stamp DATA_DATES.sif.
    //
    //  Mirrors REFRESH.parseMfMonitor deliberately, so the two upload cards
    //  behave the same way:
    //    - as-on date precedence: the picker -> the FILE NAME -> the in-file
    //      Inception/as-on header. Leaving the picker blank is the normal case.
    //    - a scheme in the monitor but not yet in MASTER is APPENDED, filed
    //      from the file's own "Asset Type" column (Equity SIF / Hybrid SIF).
    //      Nothing is guessed: no AMC prefix and no IRR band is invented, so a
    //      new scheme reads under its workbook name until the desk pins one.
    //    - non-null merge: a blank cell never overwrites a stored value.
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

        var sifRecs = (window.MASTER || []).filter(function (f) { return /SIF$/.test(f.product_class || ''); });
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
        // Columns the SIF Monitor carries beside the returns. Kept out of colKind(), which is
        // returns-only — "Inception Date" reaching 'si' through /incept/ would store a date as
        // a percentage.
        function metaKind(h) {
          var t = String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
          if (!t) return null;
          if (/^inception date$/.test(t)) return 'inception';
          if (/^remark$|^exit load$/.test(t)) return 'exit_load';
          if (/^asset type$/.test(t)) return 'assetType';
          return null;
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

        var matched = 0, updatedFields = 0, missed = [], added = [];
        var fileDate = null;   // an as-on date found inside the workbook
        wb.SheetNames.forEach(function (sn) {
          var sheet = wb.Sheets[sn]; if (!sheet || !sheet['!ref']) return;
          var range = XLSX.utils.decode_range(sheet['!ref']);
          var HR = -1, nameCol = -1;
          for (var rr = range.s.r; rr <= Math.min(range.s.r + 30, range.e.r) && HR < 0; rr++) {
            for (var cc = range.s.c; cc <= range.e.c; cc++) {
              var t = String(cv(sheet, rr, cc) || '').toLowerCase().trim();
              // A banner row above the header often reads "As on 31-Aug-2026".
              if (/^as on\b/.test(t)) { var bd = parseDateLite(String(cv(sheet, rr, cc)).replace(/^as on\s*/i, '')); if (bd && (!fileDate || bd > fileDate)) fileDate = bd; }
              if (t === 'scheme name' || t === 'fund name' || t === 'scheme' || t === 'name' || t === 'fund' || /scheme name|fund name/.test(t)) { HR = rr; nameCol = cc; break; }
            }
          }
          if (HR < 0) return;
          var colMap = {}, used = {}, metaMap = {};
          for (var c = range.s.c; c <= range.e.c; c++) {
            if (c === nameCol) continue;
            var hv = cv(sheet, HR, c);
            var mk = metaKind(hv);
            if (mk && !metaMap[mk]) { metaMap[mk] = c; continue; }   // meta cols never enter colMap
            var k = colKind(hv);
            if (k && !used[k]) { colMap[c] = k; used[k] = 1; }
          }
          for (var r = HR + 1; r <= range.e.r; r++) {
            var nm = cv(sheet, r, nameCol);
            if (nm == null || String(nm).trim() === '') continue;
            var low = String(nm).toLowerCase();
            if (/benchmark|average|^total|nifty|^index\b/.test(low)) continue;
            // Accord's disclaimer paragraph sits in the name column below the data. A scheme
            // name is short and a footnote is not \u2014 this also drops any other stray prose.
            if (String(nm).trim().length > 120) continue;
            var rec = matchRec(nm);
            if (!rec) {
              // New scheme: file it from the workbook's own "Asset Type" rather than guessing.
              // Needs a numeric AUM, the same bar parseMfMonitor sets for a fund row.
              var aumCol = null;
              Object.keys(colMap).forEach(function (ci) { if (colMap[ci] === 'aum') aumCol = parseInt(ci, 10); });
              var aumRaw = aumCol == null ? null : cv(sheet, r, aumCol);
              var at = metaMap.assetType == null ? null : String(cv(sheet, r, metaMap.assetType) || '').trim();
              if (aumRaw == null || aumRaw === '' || isNaN(Number(aumRaw)) || !(at === 'Equity' || at === 'Hybrid')) {
                missed.push(String(nm).trim());
                continue;
              }
              rec = {
                name: String(nm).trim().replace(/-\s*Reg\s*\(G\)\s*$/i, '').replace(/\(G\)\s*$/i, '').trim(),
                asset_class: at, product_class: at + ' SIF', sub_category: at + ' SIF',
                irr_low: null, irr_high: null, sif_amc: null, sif_raw: String(nm).trim()
              };
              window.MASTER.push(rec);
              sifRecs.push(rec);
              [rec.sif_raw, rec.name].forEach(function (k) { var nk = norm(k); if (nk && !index[nk]) index[nk] = rec; });
              added.push(rec.name);
            }
            var got = false;
            Object.keys(colMap).forEach(function (ci) {
              var field = colMap[ci], raw = cv(sheet, r, parseInt(ci, 10));
              var val = field === 'aum'
                ? ((raw == null || raw instanceof Date || !isFinite(Number(raw))) ? null : Number(raw))
                : pctToDec(raw);
              if (val != null && !(typeof val === 'number' && isNaN(val))) { rec[field] = val; got = true; updatedFields++; }
            });
            if (metaMap.inception != null) {
              var iv = cv(sheet, r, metaMap.inception), id = parseDateLite(iv);
              if (id) { rec.inception = id.toISOString().slice(0, 10); got = true; updatedFields++; }
            }
            if (metaMap.exit_load != null) {
              var ev = cv(sheet, r, metaMap.exit_load);
              // "." / "NA" are placeholders for missing, not an exit load of nothing.
              if (ev != null && String(ev).trim() !== '' && !/^(\.|na|n\/a)$/i.test(String(ev).trim())) { rec.exit_load = String(ev).trim(); got = true; updatedFields++; }
            }
            if (got) matched++;
          }
        });

        // As-on precedence, same as the MF Monitor: the picker (explicit intent) beats the file
        // name, which beats whatever the workbook says about itself.
        var d = parseDateLite(opts.asOn);
        var asOnStr = d ? fmtAsOnLite(d) : (typeof opts.asOn === 'string' && opts.asOn.trim() ? opts.asOn.trim() : null);
        if (!asOnStr) {
          // The whole file name is never a parseable date, so pull the date out of it first:
          // "SIF Monitor_31st August 2026.xlsx" or "...2026-08-31.xlsx".
          var stem = String((file && file.name) || '').replace(/\.[a-z]+$/i, '');
          var dm = stem.match(/(\d{1,2})(?:st|nd|rd|th)?[\s_.-]+([A-Za-z]{3,9})[\s_.-]+(\d{4})/)
                || stem.match(/(\d{4})-(\d{2})-(\d{2})/);
          var fd = dm ? parseDateLite(dm[0]) : null;
          if (fd) asOnStr = fmtAsOnLite(fd);
          else if (fileDate) asOnStr = fmtAsOnLite(fileDate);
        }
        if (asOnStr && window.DATA_DATES) window.DATA_DATES.sif = asOnStr;

        if (matched === 0) return { ok: false, error: 'No SIF schemes matched the file. Ensure it has a "Scheme Name" column and return columns (1M/3M/6M/SI). Unmatched sample: ' + missed.slice(0, 4).join(' | ') };
        return { ok: true, message: 'SIF Monitor loaded \u2014 ' + matched + ' scheme(s), ' + updatedFields + ' value(s)'
          + (added.length ? (' (+' + added.length + ' new: ' + added.slice(0, 3).join(', ') + ')') : '')
          + (asOnStr ? ' \u00b7 as on ' + asOnStr : '')
          + (missed.length ? (' \u00b7 ' + missed.length + ' unmatched') : '') };
      } catch (err) {
        console.error('parseSif error', err);
        return { ok: false, error: err && err.message ? err.message : String(err) };
      }
    };
  } catch (e) {
    console.error('SIF refresh override failed:', e);
  }
})();
