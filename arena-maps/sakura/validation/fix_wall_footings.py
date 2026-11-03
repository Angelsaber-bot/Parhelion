"""Separate plaster walls from their timber footings without regenerating unrelated art.
Only plaster POSITION.y values/bounds in four VIS_wall_* meshes may change.
"""
from pathlib import Path
import json,struct,hashlib
root=Path(__file__).resolve().parents[1]
p=root/'assets/sakura_visual.glb';raw=p.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=bytearray(raw[28+n:]);before=bytes(binary);allowed=set();rows=[]
for m in g['meshes']:
 if not m.get('name','').startswith('VIS_wall_'):continue
 for prim in m['primitives']:
  if g['materials'][prim['material']]['name']!='plaster':continue
  a=g['accessors'][prim['attributes']['POSITION']];v=g['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12);changed=0
  for i in range(a['count']):
   off=start+i*stride+4;y=struct.unpack_from('<f',binary,off)[0]
   if y<.5:
    struct.pack_into('<f',binary,off,.5);allowed.update(range(off,off+4));changed+=1
  if changed:a['min'][1]=.5
  rows.append({'mesh':m['name'],'raisedVertices':changed})
assert len(rows)==4 and all(r['raisedVertices']==8 for r in rows),rows
assert all(i in allowed for i,(a,b)in enumerate(zip(before,binary))if a!=b)
js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
out=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
p.write_bytes(out)
report={'beforeSha256':hashlib.sha256(raw).hexdigest(),'afterSha256':hashlib.sha256(out).hexdigest(),'changedByteCount':sum(a!=b for a,b in zip(before,binary)),'onlyWallPlasterPositionYChanged':True,'walls':rows}
(root/'validation/wall-footing-fix.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
