import json,struct,pathlib,math
ROOT=pathlib.Path(__file__).resolve().parent.parent
p=ROOT/'blackbeard_tricorn.glb';d=p.read_bytes();magic,ver,total=struct.unpack_from('<III',d);assert magic==0x46546c67 and ver==2 and total==len(d)
o=12;j=None;binary=None
while o<len(d):
 n,t=struct.unpack_from('<II',d,o);o+=8;c=d[o:o+n];o+=n
 if t==0x4e4f534a:j=json.loads(c)
 if t==0x004e4942:binary=c
assert j and binary
fmts={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'};sizes={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(idx):
 a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']];fmt='<'+fmts[a['componentType']]*sizes[a['type']];sz=struct.calcsize(fmt);start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',sz)
 return [struct.unpack_from(fmt,binary,start+i*stride) for i in range(a['count'])]
animations=[]
for a in j.get('animations',[]):
 times=[t[0] for s in a['samplers'] for t in acc(s['input'])];mn=min(times);mx=max(times)
 assert abs(mn)<1e-6 and mx>0,(a['name'],mn,mx)
 animations.append({'name':a['name'],'start_seconds':mn,'duration_seconds':mx,'channels':len(a['channels'])})
assert {x['name'] for x in animations}=={'Idle','Walk','Run','Attack','Melee'}
node=next(n for n in j['nodes'] if n.get('name')=='Blackbeard_optional_tricorn');skin=j['skins'][node['skin']];headids=[i for i,nid in enumerate(skin['joints']) if j['nodes'][nid].get('name')=='Head'];assert len(headids)==1;head=headids[0]
hat=j['meshes'][node['mesh']];count=0;hat_tri=0
for pr in hat['primitives']:
 at=pr['attributes'];js=acc(at['JOINTS_0']);ws=acc(at['WEIGHTS_0']);ps=acc(at['POSITION']);count+=len(ps);hat_tri+=len(acc(pr['indices']))//3
 for joint,w in zip(js,ws):
  assert abs(sum(w)-1)<1e-5
  assert all(joint[k]==head for k,weight in enumerate(w) if weight>1e-6)
 assert all(math.isfinite(c) for v in ps for c in v)
socket=next(n for n in j['nodes'] if n.get('name')=='Blackbeard_Muzzle')
report={'file':str(p),'bytes':len(d),'mesh_count':len(j['meshes']),'primitive_count':sum(len(m['primitives']) for m in j['meshes']),'materials':len(j['materials']),'skins':len(j['skins']),'animations':animations,'hat_vertices_exported':count,'hat_triangles':hat_tri,'hat_rigid_head_weights_verified':True,'muzzle_socket_preserved':True,'all_animation_starts_zero':True}
(ROOT/'qa/runtime_variant_glb.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
