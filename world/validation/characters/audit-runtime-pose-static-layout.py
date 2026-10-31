"""Read-only compact pose layout audit. Usage: python script.py EVIDENCE_ROOT OUTPUT_JSON."""
import os,json,collections,sys
root=os.path.abspath(sys.argv[1]);output=os.path.abspath(sys.argv[2])
reports=[];issues=[]
for base in [root+'/animation',root+'/environment/era-servant-grounded']:
 for directory,_,files in os.walk(base):
  signatures=collections.defaultdict(set);frames=entries=0
  for f in files:
   if not f.endswith('.json'):continue
   path=os.path.join(directory,f)
   try:d=json.load(open(path))
   except (ValueError,OSError):continue
   if not isinstance(d,dict) or not isinstance(d.get('meshes'),list):continue
   compact=[m for m in d['meshes'] if isinstance(m,dict) and 'staticFile'in m]
   if not compact:continue
   frames+=1
   for m in compact:
    entries+=1;static=os.path.join(directory,m['staticFile']);sig=(m.get('name'),m['count'],m['indices'],json.dumps(m.get('groups'),sort_keys=True));signatures[m['staticFile']].add(sig)
    expected=m['count']*24+m['indices']*4
    if not os.path.isfile(static) or os.path.getsize(static)!=expected:issues.append({'file':path,'mesh':m.get('name'),'kind':'static-size','actual':os.path.getsize(static)if os.path.isfile(static)else None,'expected':expected})
    if m.get('uv1File'):
     uv=os.path.join(directory,m['uv1File'])
     if not os.path.isfile(uv)or os.path.getsize(uv)!=m['count']*8:issues.append({'file':path,'mesh':m.get('name'),'kind':'uv1-size'})
  for file,sigs in signatures.items():
   if len(sigs)>1:issues.append({'directory':directory,'staticFile':file,'kind':'multiple-mesh-signatures','signatures':list(sigs)})
  if frames:reports.append({'directory':directory,'frames':frames,'entries':entries,'staticPayloads':len(signatures)})
result={'scope':'Read-only manifest/static-byte-length and stable mesh-name/count/index/group census. Does not prove every UV/color byte or GPU shader identity. Historical originals unchanged.','directories':reports,'frames':sum(x['frames']for x in reports),'entries':sum(x['entries']for x in reports),'issues':issues}
json.dump(result,open(output,'w'),indent=2);print(json.dumps({'directories':len(reports),'frames':result['frames'],'entries':result['entries'],'issues':issues[:12],'issueCount':len(issues)}))
