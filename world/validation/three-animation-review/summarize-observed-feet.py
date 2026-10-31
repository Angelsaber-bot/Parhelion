"""Diagnostic low-foot bands, never a claim of planted sole contact."""
import json,math,sys
p=json.load(open(sys.argv[1]));rows=[r for r in p['continuity']['rows'] if r['scope']=='world' and r['visible']]
names=[n['name']for n in rows[0]['nodes']if 'Foot' in n['name']or'Hoof'in n['name']];result={}
for name in names:
 values=[next(n['p']for n in r['nodes']if n['name']==name)[1]-r['root'][1]for r in rows];base=min(values);selected=[]
 for i in range(1,len(rows)):
  a,b=rows[i-1:i+1];dt=b['seconds']-a['seconds'];pa=next(n['p']for n in a['nodes']if n['name']==name);pb=next(n['p']for n in b['nodes']if n['name']==name)
  rootV=[(v-u)/dt for u,v in zip(a['root'],b['root'])];footV=[(v-u)/dt for u,v in zip(pa,pb)]
  if values[i]<base+.015 and values[i-1]<base+.015 and abs(rootV[1])<.1 and abs(footV[1])<.1 and math.hypot(rootV[0],rootV[2])>.2:selected.append({'seconds':b['seconds'],'footHorizontalSpeed':math.hypot(footV[0],footV[2]),'rootHorizontalSpeed':math.hypot(rootV[0],rootV[2])})
 result[name]={'relativeBoneMin':base,'lowBandAndLowVerticalPairs':len(selected),'meanHorizontalFootSpeed':sum(x['footHorizontalSpeed']for x in selected)/len(selected)if selected else None,'worst':max(selected,key=lambda x:x['footHorizontalSpeed'])if selected else None}
print(json.dumps({'scope':'Actual-input low-foot-bone +15mm screening with vertical-speed<.1m/s and moving root; does NOT establish anatomical sole stance. Terrain drop frames excluded.','feet':result},indent=2))
