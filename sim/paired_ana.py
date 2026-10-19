# Uso: python sim/out/ana.py A.jsonl[,A2.jsonl] B.jsonl[,B2.jsonl]  -> comparación emparejada por Pokémon (B = variante)
import json,sys,collections,statistics as st,math
def load(spec):
    out={}
    for f in spec.split(','):
        for l in open(f,encoding='utf8'):
            if l.strip():
                r=json.loads(l)
                if not r.get('error'): out[(r['dex'],r['seed'])]=r
    return out
A,B=load(sys.argv[1]),load(sys.argv[2])
keys=sorted(set(A)&set(B))
by=collections.defaultdict(list)
for k in keys: by[k[0]].append((A[k],B[k]))
fmt=lambda s:f"{int(s//60)}:{int(s%60):02d}"
lv=lambda r,m:{x['m']:x for x in r['curve']}.get(m,{}).get('lv')
tot=[]
print(f"{'Pokémon':13}{'n':>3}  {'mediana A→B':>13}  {'llegan30 A→B':>12}  {'nv15 A→B':>10}  {'derrot. A→B':>14}  ×geo")
for d,ps in sorted(by.items(),key=lambda kv:kv[1][0][0]['name']):
    ta=[a['time'] for a,b in ps]; tb=[b['time'] for a,b in ps]
    g=math.exp(st.mean(math.log(b['time']/a['time']) for a,b in ps)); tot+= [math.log(b['time']/a['time']) for a,b in ps]
    la=[lv(a,15) for a,b in ps if lv(a,15)]; lb=[lv(b,15) for a,b in ps if lv(b,15)]
    print(f"{ps[0][0]['name'][:13]:13}{len(ps):3}  {fmt(st.median(ta)):>6}→{fmt(st.median(tb)):<6}  {sum(t>=1800 for t in ta):>5}→{sum(t>=1800 for t in tb):<5}  {st.median(la) if la else 0:>4}→{st.median(lb) if lb else 0:<4}  {st.median([a['kills'] for a,b in ps]):>6}→{st.median([b['kills'] for a,b in ps]):<6}  ×{g:.2f}")
se=st.stdev(tot)/math.sqrt(len(tot)); g=math.exp(st.mean(tot))
print(f"TOTAL {len(tot)} parejas: ×{g:.2f} (IC95 ×{math.exp(st.mean(tot)-1.96*se):.2f}-×{math.exp(st.mean(tot)+1.96*se):.2f}); llegan30 {sum(a['time']>=1800 for k in keys for a in [A[k]])}→{sum(B[k]['time']>=1800 for k in keys)}")
