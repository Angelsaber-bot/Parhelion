"""Isolated append-only ART+COL tower access candidate. Never overwrites input.
Usage: python patch-tower-access.py ORIGINAL.glb GEOMETRY.json CANDIDATE.glb PROOF.json
"""
import sys,json,struct,hashlib,copy
from pathlib import Path
source,geometry,output,proof=map(Path,sys.argv[1:]);assert source.resolve()!=output.resolve()
sha=lambda b:hashlib.sha256(b).hexdigest();old=source.read_bytes();assert sha(old)=='1fb8d6823f2afcbdd11586d92013df4250243505a956c49db98fb14624f2e850'
jn,jt=struct.unpack_from('<II',old,12);assert jt==0x4e4f534a;original=json.loads(old[20:20+jn]);d=copy.deepcopy(original);bn,bt=struct.unpack_from('<II',old,20+jn);assert bt==0x004e4942
binary=old[28+jn:28+jn+bn];assert len(binary)==bn==d['buffers'][0]['byteLength'];new=bytearray(binary);g=json.loads(geometry.read_text());assert g['name']=='Tower_West_Access';assert len(g['positions'])==len(g['normals'])==len(g['colors'])==264*9;assert len(g['collision'])==24*9
parents=[];appended=[]
for name,parent,material,attributes in [(g['name'],'ART','M_Toon',{'POSITION':'positions','NORMAL':'normals','COLOR_0':'colors'}),('COL_'+g['name'],'COLLISION','M_Collision',{'POSITION':'collision'})]:
 attrs={}
 for semantic,key in attributes.items():
  data=g[key];offset=len(new);payload=struct.pack('<%df'%len(data),*data);new.extend(payload);view=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(payload),'target':34962})
  accessor={'bufferView':view,'componentType':5126,'count':len(data)//3,'type':'VEC3'}
  if semantic=='POSITION':accessor.update(min=[min(data[i::3])for i in range(3)],max=[max(data[i::3])for i in range(3)])
  attrs[semantic]=len(d['accessors']);d['accessors'].append(accessor)
 mi=next(i for i,m in enumerate(d['materials'])if m['name']==material);mesh=len(d['meshes']);node=len(d['nodes']);d['meshes'].append({'name':name,'primitives':[{'attributes':attrs,'mode':4,'material':mi}]});d['nodes'].append({'name':name,'mesh':mesh,**({'extras':{'outline':False,'dynamic':False}}if parent=='ART' else{})});pi=next(i for i,n in enumerate(d['nodes'])if n.get('name')==parent);d['nodes'][pi]['children'].append(node);parents.append(pi);appended.append({'name':name,'node':node,'mesh':mesh,'accessors':attrs})
d['buffers'][0]['byteLength']=len(new);recovered=copy.deepcopy(d)
for key in ['nodes','meshes','bufferViews','accessors']:recovered[key]=recovered[key][:len(original[key])]
for pi in parents:recovered['nodes'][pi]['children']=recovered['nodes'][pi]['children'][:-1]
recovered['buffers'][0]['byteLength']=original['buffers'][0]['byteLength'];assert recovered==original;assert new[:len(binary)]==binary
encoded=json.dumps(d,separators=(',',':'),ensure_ascii=False).encode();encoded+=b' '*((-len(encoded))%4);result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(new))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(new),0x004e4942)+new
output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(result)
report={'inputSha256':sha(old),'outputSha256':sha(result),'originalBinarySha256':sha(binary),'originalBinaryBytes':len(binary),'originalBinaryPrefixExact':True,'originalJsonAfterRemovingWhitelistedAppendsExact':True,'appendedBinaryBytes':len(new)-len(binary),'glbByteDelta':len(result)-len(old),'artTrianglesAdded':264,'collisionTrianglesAdded':24,'artPrimitivesAdded':1,'collisionPrimitivesAdded':1,'materialsAdded':0,'texturesAdded':0,'existingColliderChanges':0,'appended':appended};proof.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
