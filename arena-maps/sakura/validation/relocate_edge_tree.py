"""Precisely relocate one shipped decorative tree; no full GLB regeneration churn.
Usage: python relocate_edge_tree.py INPUT.glb OUTPUT.glb REPORT.json
INPUT must be the preserved original visual asset (git 4ba44f0:path also works).
The ordinary builder has the same authored +3m offset. Its platform-dependent
far-mountain near-zero normals are intentionally NOT substituted into this asset.
"""
from pathlib import Path
import hashlib,json,struct,sys
BASE_SHA='83f504ce7db5b0242979b2bb76a817ef7d39e22479b1c57344fd7be9a7f52ee3'
RANGES={'trunk':(390,520),'blossom2':(864,1152),'blossom':(1152,1536)}
DELTA_Z=3.0
src,out,report=map(Path,sys.argv[1:4]);raw=src.read_bytes()
assert hashlib.sha256(raw).hexdigest()==BASE_SHA,'Unexpected source: do not patch a changed or already-relocated asset'
magic,version,total=struct.unpack_from('<III',raw);assert magic==0x46546c67 and version==2 and total==len(raw)
jslen,jskind=struct.unpack_from('<II',raw,12);assert jskind==0x4e4f534a
g=json.loads(raw[20:20+jslen]);before_json=json.loads(raw[20:20+jslen]);binlen,binkind=struct.unpack_from('<II',raw,20+jslen);assert binkind==0x004e4942
original=raw[28+jslen:];binary=bytearray(original);assert len(binary)==binlen
allowed=set();rows=[];bounds_changes=[]
for mesh in g['meshes']:
 if mesh.get('name')!='DETAIL_batch':continue
 for prim in mesh['primitives']:
  material=g['materials'][prim['material']]['name']
  if material not in RANGES:continue
  ai=prim['attributes']['POSITION'];a=g['accessors'][ai];v=g['bufferViews'][a['bufferView']];assert a['componentType']==5126 and a['type']=='VEC3'
  start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12);first,last=RANGES[material];assert last<=a['count'];points=[]
  for i in range(first,last):
   offset=start+i*stride;point=struct.unpack_from('<fff',binary,offset);points.append(point)
   # The whitelist is one southeast tree, not every vertex in these material batches.
   assert 20<point[0]<33 and 13<point[2]<27 and -.21<=point[1]<10
   struct.pack_into('<f',binary,offset+8,point[2]+DELTA_Z);allowed.update(range(offset+8,offset+12))
  all_z=[struct.unpack_from('<f',binary,start+i*stride+8)[0]for i in range(a['count'])]
  # Preserve untouched bounds metadata exactly. Update only affected Z extrema.
  for key,fn in [('min',min),('max',max)]:
   old=a[key][2];new=fn(all_z)
   if abs(new-old)>1e-5:
    bounds_changes.append({'accessor':ai,'field':key+'[2]','before':old,'after':new});a[key][2]=new
  rows.append({'material':material,'accessor':ai,'firstVertex':first,'endVertex':last,'vertices':last-first,'delta':[0,0,DELTA_Z], 'beforeBounds':[[min(p[k]for p in points)for k in range(3)],[max(p[k]for p in points)for k in range(3)]]})
assert len(rows)==3
changed=[i for i,(a,b)in enumerate(zip(original,binary))if a!=b];assert all(i in allowed for i in changed)
# No normals, indices, materials, texture data, transform or unrelated POSITION bytes may change.
check=json.loads(json.dumps(g))
for c in bounds_changes:
 key=c['field'].split('[')[0];check['accessors'][c['accessor']][key][2]=c['before']
assert check==before_json
js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
if not bounds_changes:assert js==raw[20:20+jslen],'Unexpected JSON serialization churn'
result=struct.pack('<III',magic,version,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),jskind)+js+struct.pack('<II',len(binary),binkind)+binary
out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(result)
proof={'inputSha256':BASE_SHA,'outputSha256':hashlib.sha256(result).hexdigest(),'changedBinaryBytes':len(changed),'allowedPositionByteCount':len(allowed),'vertexRanges':rows,'boundsChanges':bounds_changes,'allUnrelatedBinaryBytesExact':True,'allUnrelatedJsonExact':True,'normalIndexMaterialTransformBytesExact':True}
report.parent.mkdir(parents=True,exist_ok=True);report.write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
