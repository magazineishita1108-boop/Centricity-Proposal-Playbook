#!/usr/bin/env python3
"""
Centricity — Portfolio Matrix backend generator.
Input : monthly NAV Data workbook (3 sheets) + index.html (for window.MASTER names)
Output: Centricity_Risk_Matrix.js  (window.RISK_MATRIX keyed by MASTER name,
        + DATA_DATES.riskMatrix + RISK_MATRIX_BENCH_SD)
Usage : python3 build_risk_matrix.py <NAV.xlsx> <index.html> <AS_ON e.g. "30 Jun 2026"> <out.js>
Method verified to reproduce the deployed 30-Jun-2026 sibling (base metrics + Alpha exact).
"""
import sys, re, json, math, statistics, collections, warnings
from decimal import Decimal, ROUND_HALF_UP
import numpy as np, pandas as pd
from dateutil.relativedelta import relativedelta
warnings.filterwarnings('ignore')

NAV, IDX, ASLABEL, OUT = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
Rf=0.045; Rf_day=Rf/252; SQ=math.sqrt(252)
BMAP={'Large Cap':'NIFTY 100 - TRI','Mid Cap':'Nifty Midcap 150 - TRI','Small Cap':'Nifty Smallcap 250 - TRI'}
BDISP={'NIFTY 100 - TRI':'NIFTY 100 TRI','Nifty Midcap 150 - TRI':'Nifty Midcap 150 TRI',
       'Nifty Smallcap 250 - TRI':'Nifty Smallcap 250 TRI','NIFTY 500 - TRI':'NIFTY 500 TRI'}
bcol=lambda c: BMAP.get(c,'NIFTY 500 - TRI')

# ---------- 1. Parse NAV workbook ----------
raw=pd.read_excel(NAV, sheet_name='NAV Data-MF', header=0)
data=raw.iloc[1:].copy(); data['Date']=pd.to_datetime(data['Date'])
data=data.set_index('Date').sort_index()
fund_names=list(data.columns); data=data.apply(pd.to_numeric,errors='coerce')
cat_raw=pd.read_excel(NAV, sheet_name='CATEGORY FOR MF', header=None)
cat_map={}
for _,row in cat_raw.iterrows():
    nm,ct=row.iloc[0],row.iloc[1]
    if nm is None or (isinstance(nm,float) and pd.isna(nm)): continue
    nm=str(nm).strip()
    if ct=='Category' or nm=='Instrument Name': continue
    cat_map[nm]=(str(ct).strip() if ct is not None and not(isinstance(ct,float) and pd.isna(ct)) else None)
bench=pd.read_excel(NAV, sheet_name='NAV Data-Benchmark', header=0)
bench['Date']=pd.to_datetime(bench['Date']); bench=bench.set_index('Date').sort_index()
bench=bench.apply(pd.to_numeric,errors='coerce'); bench_td=bench.reindex(data.index)
td=data.index; AS_ON=td.max()
prior=lambda t: td[td.searchsorted(pd.Timestamp(t),side='right')-1]
D_3Y=prior(AS_ON-relativedelta(years=3)); D_5Y=prior(AS_ON-relativedelta(years=5))
MKT_BEGINS=td[(td>=D_5Y)&(td<=D_3Y)]                       # every market trading day (spec §4.2)
etmap={pd.Timestamp(b):pd.Timestamp(b)+relativedelta(years=3) for b in MKT_BEGINS}

# ---------- 2. Full-precision metrics ----------
def compute(f):
    cat=cat_map.get(f); bc=bcol(cat); s=data[f].dropna()
    r={'bm':BDISP[bc],'elig':False,'rr':None}
    s3=s[(s.index>=D_3Y)&(s.index<=AS_ON)]
    if len(s3)>=250:
        rr_=s3.pct_change(fill_method=None).dropna(); mu=rr_.mean(); sd=rr_.std(ddof=0)*SQ
        d0,d1=s3.index[0],s3.index[-1]; days=(d1-d0).days
        CAGR=(s3.iloc[-1]/s3.iloc[0])**(365.25/days)-1
        sh=(mu*252-Rf)/sd if sd>0 else None
        e=rr_-Rf_day; dn=e[e<0]; dd=dn.std(ddof=0)*SQ if len(dn)>=2 else None
        so=(mu*252-Rf)/dd if (dd and dd>0) else None
        b=bench_td[bc].reindex(s3.index).pct_change(fill_method=None)
        al=pd.concat([rr_,b],axis=1); al.columns=['r','b']; al=al.dropna()
        fr,bb=al['r'],al['b']; vb=((bb-bb.mean())**2).sum()
        be=((fr-fr.mean())*(bb-bb.mean())).sum()/vb if vb>0 else None
        TE=(fr-bb).std(ddof=0)*SQ
        Bf,Bl=bench_td[bc].loc[d0],bench_td[bc].loc[d1]; Bann=(Bl/Bf)**(365.25/days)-1
        ir=(CAGR-Bann)/TE if TE>0 else None
        up=bb>0; dw=bb<0
        Dn=(fr[dw].mean()/bb[dw].mean()*100) if bb[dw].mean()!=0 else None
        r.update(elig=True,c=CAGR*100,be=be,sd=sd*100,so=so,sh=sh,ir=ir,te=TE*100,dc=Dn)
    if len(s)>0 and s.index[0]<=D_5Y:
        fv=s.index.values; fn=s.values; last=s.index[-1]; cg=[]
        for b in MKT_BEGINS:                                        # begin = every market trading day
            et=etmap[pd.Timestamp(b)]
            if et>last: continue
            bi=np.searchsorted(fv,np.datetime64(b),side='right')-1  # begin NAV: nearest prior fund NAV
            ei=np.searchsorted(fv,np.datetime64(et),side='right')-1 # end   NAV: nearest prior fund NAV
            if bi>=0 and ei>=0: cg.append((fn[ei]/fn[bi])**(1/3)-1)
        if cg: r['rr']=float(np.mean(cg))*100
    return r
FULL={f:compute(f) for f in fund_names}

# ---------- 3. MASTER names from index.html ----------
def extract(text,marker,op,cl):
    i=text.find(marker); j=text.find(op,i); depth=0; instr=False; esc=False; q=None; k=j
    while k<len(text):
        c=text[k]
        if instr:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c==q: instr=False
        else:
            if c in ('"',"'"): instr=True; q=c
            elif c==op: depth+=1
            elif c==cl:
                depth-=1
                if depth==0: return text[j:k+1]
        k+=1
idx=open(IDX,encoding='utf-8',errors='replace').read()
master=json.loads(extract(idx,'window.MASTER','[',']'))
mnames=set(m['name'] for m in master)
EQPC={'Mutual Fund','Index Fund','ETF','Mutual Funds'}
def strip_sc(n):
    n=re.sub(r'\s*-?Reg\([^)]*\)\s*$','',n); n=re.sub(r'\s*-?Dir(ect)?\s*Plan.*$','',n,flags=re.I)
    n=re.sub(r'\s*\((G|IDCW[^)]*)\)\s*$','',n); return n.strip()
eq_by_base=collections.defaultdict(list)
for m in master:
    if m.get('product_class') in EQPC and m.get('asset_class')=='Equity':
        eq_by_base[strip_sc(m['name'])].append(m['name'])

# ---------- 4. Join NAV name -> MASTER key ----------
def master_key(nav):
    if nav in mnames: return nav
    cand=re.sub(r'\(IDCW[^)]*\)','(G)',nav)
    if cand in mnames: return cand
    hits=eq_by_base.get(strip_sc(nav),[])
    if len(hits)==1: return hits[0]
    return None
KEY={f:master_key(f) for f in fund_names}
unjoined=[f for f,k in KEY.items() if k is None]

# ---------- 5. BENCH_SD median-solve + derive Alpha/Correl ----------
r2=lambda x: round(x,2)
be2map=collections.defaultdict(list)
for f,r in FULL.items():
    if not r['elig']: continue
    te,sd,be=r2(r['te']),r2(r['sd']),r2(r['be']); den=1-2*be; num=te*te-sd*sd
    if den!=0 and num/den>0: be2map[r['bm']].append(math.sqrt(num/den))
SIG={k:statistics.median(v) for k,v in be2map.items()}          # full-precision median sigma_bench
BENCH_SD={k:round(v,2) for k,v in SIG.items()}                  # stored (display) 2dp
def hu(x,n): return float(Decimal(str(float(x))).quantize(Decimal('1.'+'0'*n),rounding=ROUND_HALF_UP))
def alpha(r):
    c,ir,te,be=r2(r['c']),r2(r['ir']),r2(r['te']),r2(r['be']); Rb=c-ir*te
    return round(c-(4.5+be*(Rb-4.5)),2)
def correl(r):
    return hu(min(0.999, r2(r['be'])*SIG[r['bm']]/r2(r['sd'])),3)   # full sigma, half-up

# ---------- 6. Emit ----------
RM={}
for f in fund_names:
    k=KEY[f]
    if k is None: continue
    r=FULL[f]; rec={}
    if r['elig']:
        rec.update({'c':r2(r['c']),'be':r2(r['be']),'sd':r2(r['sd']),'so':r2(r['so']),
                    'sh':r2(r['sh']),'ir':r2(r['ir']),'dc':round(r['dc'],1),
                    'al':alpha(r),'co':correl(r)})
    rec['bm']=r['bm']
    if r['rr'] is not None: rec['rr']=r2(r['rr'])
    RM[k]=rec
hdr=f"/* Centricity_Risk_Matrix.js  —  3Y Rolling + Risk & Risk-Adjusted Ratios (as on {AS_ON.strftime('%d-%b-%Y')})\n   Source: NAV Data workbook -> risk ratios; keyed by exact MASTER fund name. Generated by build_risk_matrix.py. */\n"
body="window.RISK_MATRIX = "+json.dumps(RM,ensure_ascii=False,separators=(',',':'))+";\n"
dd=("window.DATA_DATES = window.DATA_DATES || {};\n"
    f"window.DATA_DATES.riskMatrix = '{ASLABEL}';\n")
bsd="window.RISK_MATRIX_BENCH_SD = "+json.dumps(BENCH_SD,ensure_ascii=False)+";\n"
open(OUT,'w',encoding='utf-8').write(hdr+body+dd+bsd)

print(f"AS_ON={AS_ON.date()} D_3Y={D_3Y.date()} D_5Y={D_5Y.date()}")
print(f"NAV funds={len(fund_names)}  joined={len(RM)}  unjoined={len(unjoined)}")
if unjoined: print("  UNJOINED:",unjoined[:20])
print("BENCH_SD:",BENCH_SD)
print(f"records with metrics={sum(1 for v in RM.values() if 'c' in v)}  with rr={sum(1 for v in RM.values() if 'rr' in v)}")
print("wrote",OUT,"bytes",len(hdr+body+dd+bsd))
