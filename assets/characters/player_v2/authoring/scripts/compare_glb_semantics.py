"""Compare a frozen export and a reconstruction, including equivalent joint-slot permutations."""
import argparse,sys,struct,json,hashlib
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
p=argparse.ArgumentParser();p.add_argument('frozen',type=Path);p.add_argument('rebuilt',type=Path);p.add_argument('--report',type=Path);o=p.parse_args(args)
def read(path):
 data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0];return json.loads(data[20:20+n]),data[28+n:],data
a,ab,ad=read(o.frozen);b,bb,bd=read(o.rebuilt);assert a==b,'glTF JSON contract differs'
def view(doc,bin,i):
 v=doc['bufferViews'][i];return bin[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
def accessor(doc,bin,i):
 ac=doc['accessors'][i];v=doc['bufferViews'][ac['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[ac['type']];ct={5121:'B',5123:'H',5125:'I',5126:'f'}[ac['componentType']];fmt='<'+str(n)+ct;stride=v.get('byteStride',struct.calcsize(fmt));start=v.get('byteOffset',0)+ac.get('byteOffset',0);return [struct.unpack_from(fmt,bin,start+i*stride)for i in range(ac['count'])]
allowed=set();changes=[]
for mi,m in enumerate(a['meshes']):
 for pr in m['primitives']:
  at=pr['attributes'];ji=at.get('JOINTS_0');wi=at.get('WEIGHTS_0')
  if ji is None:continue
  jv=a['accessors'][ji]['bufferView'];allowed.add(jv)
  if view(a,ab,jv)==view(b,bb,jv):continue
  aj,bj,aw,bw=accessor(a,ab,ji),accessor(b,bb,ji),accessor(a,ab,wi),accessor(b,bb,wi)
  for vi,(ja,jb,wa,wb)in enumerate(zip(aj,bj,aw,bw)):
   if ja==jb and wa==wb:continue
   def mapping(j,w):
    out={}
    for i,x in zip(j,w):
     if x:out[i]=out.get(i,0)+x
    return out
   assert mapping(ja,wa)==mapping(jb,wb),('Non-equivalent weights',m['name'],vi)
   changes.append({'node_names':[n.get('name')for n in a['nodes']if n.get('mesh')==mi],'attribute_vertex':vi,'frozen_joint_slots':ja,'rebuilt_joint_slots':jb,'weights':wa,'bone_weight_map_identical':True})
for i in range(len(a['bufferViews'])):
 if i not in allowed:assert view(a,ab,i)==view(b,bb,i),('Non-joint buffer changed',i)
report={'blender_version_tested':'4.3.2','frozen_glb_sha256':hashlib.sha256(ad).hexdigest(),'rebuilt_glb_sha256':hashlib.sha256(bd).hexdigest(),'frozen_bytes':len(ad),'rebuilt_bytes':len(bd),'bitwise_equal':ad==bd,'gltf_json_exactly_equal':True,'all_non_joint_buffers_byte_identical':True,'all_vertex_bone_weight_maps_exactly_equal':True,'semantic_reproduction_passed':True,'equivalent_joint_slot_permutations':changes,'source_contract':'Only bundled source files and repo-relative/explicit paths; no network or private scratch input dependency.'}
if o.report:o.report.parent.mkdir(parents=True,exist_ok=True);o.report.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
