"""Append six tavern-only ART faces. Preserve every original GLB binary byte and JSON entry.
Input must be the audited shipped asset. Never overwrites input; no full regeneration.
Usage: python patch-tavern-underside.py ORIGINAL.glb LINING_SOURCE.json OUTPUT.glb PROOF.json
"""
import sys,json,struct,hashlib,copy
from pathlib import Path
source,geometry,output,proof=map(Path,sys.argv[1:])
assert source.resolve()!=output.resolve(),'Output must be separate candidate'
old=source.read_bytes();sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(old)=='1a9bc4b360464f0783917c6ed6ec98e63c955a4f9ef9874fbc9766e6787faf35','Unexpected source; audit before changing whitelist'
assert struct.unpack_from('<III',old,0)==(0x46546c67,2,len(old))
jn,jt=struct.unpack_from('<II',old,12);assert jt==0x4e4f534a
original=json.loads(old[20:20+jn]);d=copy.deepcopy(original)
bn,bt=struct.unpack_from('<II',old,20+jn);assert bt==0x004e4942
binary=old[28+jn:28+jn+bn];assert len(binary)==bn==original['buffers'][0]['byteLength']
g=json.loads(geometry.read_text());assert g['name']=='Nassau_Tavern_Timber_Underside'
assert len(g['positions'])==len(g['normals'])==len(g['colors'])==54
assert all(g['normals'][i]<-.1 for i in range(1,54,3)),'Every face points inward/down'
material=next(i for i,m in enumerate(d['materials'])if m['name']==g['material'])
node_id=len(d['nodes']);mesh_id=len(d['meshes']);new_binary=bytearray(binary);attrs={}
for name,key in [('POSITION','positions'),('NORMAL','normals'),('COLOR_0','colors')]:
 while len(new_binary)%4:new_binary.append(0)
 offset=len(new_binary);payload=struct.pack('<54f',*g[key]);new_binary.extend(payload)
 view=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(payload),'target':34962})
 accessor={'bufferView':view,'componentType':5126,'count':18,'type':'VEC3'}
 if name=='POSITION':
  accessor['min']=[min(g[key][i::3])for i in range(3)];accessor['max']=[max(g[key][i::3])for i in range(3)]
 attrs[name]=len(d['accessors']);d['accessors'].append(accessor)
d['meshes'].append({'name':g['name'],'primitives':[{'attributes':attrs,'mode':4,'material':material}]})
d['nodes'].append({'name':g['name'],'mesh':mesh_id,'extras':{'outline':False,'dynamic':False}})
art=next(i for i,n in enumerate(d['nodes'])if n.get('name')=='ART');d['nodes'][art]['children'].append(node_id)
d['buffers'][0]['byteLength']=len(new_binary)
# Strict semantic whitelist: only three append-only arrays, ART child append, and BIN length.
recovered=copy.deepcopy(d)
for key in ['meshes','nodes','accessors','bufferViews']:recovered[key]=recovered[key][:len(original[key])]
recovered['nodes'][art]['children']=recovered['nodes'][art]['children'][:-1]
recovered['buffers'][0]['byteLength']=original['buffers'][0]['byteLength']
assert recovered==original,'Unrelated JSON mutation'
assert bytes(new_binary[:len(binary)])==binary,'Unrelated original binary mutation'
encoded=json.dumps(d,separators=(',',':'),ensure_ascii=False).encode();encoded+=b' '*((-len(encoded))%4)
result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(new_binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(new_binary),0x004e4942)+new_binary
output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(result)
report={'inputSha256':sha(old),'outputSha256':sha(result),'originalBinarySha256':sha(binary),'originalBinaryBytes':len(binary),'originalBinaryPrefixExact':True,'originalJsonAfterRemovingWhitelistedAppendsExact':True,'appendedBinaryBytes':len(new_binary)-len(binary),'trianglesAdded':6,'drawPrimitivesAdded':1,'materialsAdded':0,'texturesAdded':0,'colliderChanges':0,'newNode':node_id,'newMesh':mesh_id,'newAccessors':attrs,'reusedMaterialIndex':material,'positionMin':d['accessors'][attrs['POSITION']]['min'],'positionMax':d['accessors'][attrs['POSITION']]['max'],'sourceGeometrySha256':sha(geometry.read_bytes())}
proof.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
