"""Design-preserving Musashi geometry remaster; original rig/face/clips/materials untouched.
Usage: python remaster_runtime.py ORIGINAL.glb OUTPUT.glb REPORT.json [--lod]
Original BIN retained as prefix; replace only two blade primitives and curved hair surface accessors.
"""
import json,struct,math,sys,hashlib,gzip,copy,heapq
from pathlib import Path
source,out,report=map(Path,sys.argv[1:4]);lod='--lod'in sys.argv
raw=source.read_bytes();jn=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+jn]);old=copy.deepcopy(j);binary=bytearray(raw[28+jn:]);oldbin=bytes(binary)
sha=lambda b:hashlib.sha256(b).hexdigest()
size={5121:1,5123:2,5125:4,5126:4};fmt={5121:'B',5123:'H',5125:'I',5126:'f'};dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def read(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];n=dims[a['type']];stride=v.get('byteStride',n*size[a['componentType']]);off=v.get('byteOffset',0)+a.get('byteOffset',0)
 return[list(struct.unpack_from('<'+fmt[a['componentType']]*n,binary,off+k*stride))for k in range(a['count'])]
def append(data,typ,component=5126,bounds=False):
 while len(binary)%4:binary.append(0)
 off=len(binary);flat=[x for row in data for x in row];binary.extend(struct.pack('<'+fmt[component]*len(flat),*flat));view=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(binary)-off});a={'bufferView':view,'componentType':component,'count':len(data),'type':typ}
 if bounds:a.update(min=[min(v[i]for v in data)for i in range(dims[typ])],max=[max(v[i]for v in data)for i in range(dims[typ])])
 i=len(j['accessors']);j['accessors'].append(a);return i
norm=lambda v:[x/(math.sqrt(sum(t*t for t in v))or 1)for x in v]
sub=lambda a,b:[x-y for x,y in zip(a,b)]
cross=lambda a,b:[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
rows=[];changed=[]
materials={m['name']:i for i,m in enumerate(j['materials'])};steelMat=materials['Katana • folded polished steel'];edgeMat=materials['Katana • honed silver edge'];hairMats={i for name,i in materials.items() if name in ['Hair • pale rose directional strand finish','Warm porcelain rose hair']}
for index,side in[(10,'Left'),(34,'Right')]:assert side+'Hand' in j['nodes'][j['skins'][0]['joints'][index]]['name']
# Reconnect the EXISTING floating fringe roots. All tips and lower silhouettes
# stay unchanged; only the top 45mm of each front-facing connected lock blends
# into the actual cap, with a 1mm embed margin. No new hairstyle/comb overlay.
cap_name='Hair • pale rose directional strand finish' if 'Hair • pale rose directional strand finish'in materials else 'Warm porcelain rose hair'
cap_primitive=next(p for m in old['meshes']for p in m['primitives']if old['materials'][p['material']]['name']==cap_name)
cap_positions=read(cap_primitive['attributes']['POSITION']);center=[0,2.18*.72,-.034*.72]
if lod:
 cap_positions=[p for p in cap_positions if abs(sum(((p[k]-center[k])/r)**2 for k,r in enumerate([.165*.72,.191*.72,.187*.72]))-1)<.12]
cap_directions=[norm(sub(p,center))for p in cap_positions];cap_radii=[math.dist(p,center)for p in cap_positions]
root_patches={};root_grid={};root_total=0
for mi,mesh in enumerate(old['meshes']):
 for primitive in mesh['primitives']:
  if old['materials'][primitive['material']]['name']!='Warm porcelain rose hair':continue
  attrs={k:read(v)for k,v in primitive['attributes'].items()};ps=attrs['POSITION'];ns=attrs['NORMAL'];original_ps=copy.deepcopy(ps);indices=[v[0]for v in read(primitive['indices'])];parents=list(range(len(ps)))
  def find(i):
   while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
   return i
  def join(a,b):parents[find(a)]=find(b)
  for a,b,c in zip(indices[::3],indices[1::3],indices[2::3]):join(a,b);join(b,c)
  weld={}
  for i,p in enumerate(ps):
   key=tuple(round(x,6)for x in p)
   if key in weld:join(i,weld[key])
   else:weld[key]=i
  components={}
  for i in range(len(ps)):components.setdefault(find(i),[]).append(i)
  affected=set();locks=0
  for ids in components.values():
   if len(ids)<12:continue
   ymin=min(ps[i][1]for i in ids);ymax=max(ps[i][1]for i in ids);zmin=min(ps[i][2]for i in ids);zmax=max(ps[i][2]for i in ids)
   if not(1.60<ymax<1.73 and zmin>.018 and zmax>.065 and ymax-ymin>.045):continue
   locks+=1;band=min(.045,(ymax-ymin)*.32)
   for i in ids:
    p=ps[i];u=(p[1]-(ymax-band))/band
    if u<=0:continue
    direction=norm(sub(p,center));near=heapq.nsmallest(4,range(len(cap_positions)),key=lambda k:1-sum(cap_directions[k][axis]*direction[axis]for axis in range(3)));weights=[1/max(1e-7,1-sum(cap_directions[k][axis]*direction[axis]for axis in range(3)))for k in near];radius=sum(cap_radii[k]*w for k,w in zip(near,weights))/sum(weights)-.001
    if math.dist(p,center)<radius:continue
    blend=min(1,u);blend=blend*blend*(3-2*blend);target=[center[k]+direction[k]*radius for k in range(3)];delta=[(target[k]-p[k])*blend for k in range(3)]
    ps[i]=[p[k]+delta[k]for k in range(3)];affected.add(i);root_total+=1;key=tuple(math.floor(v/.014)for v in p);root_grid.setdefault(key,[]).append((p[:],delta))
  # Refresh only the deformed root normals from their adjacent native triangles.
  accum={i:[0.,0.,0.]for i in affected}
  for a,b,c in zip(indices[::3],indices[1::3],indices[2::3]):
   n=cross(sub(ps[b],ps[a]),sub(ps[c],ps[a]))
   for i in[a,b,c]:
    if i in accum:accum[i]=[x+y for x,y in zip(accum[i],n)]
  for i,n in accum.items():ns[i]=norm(n)
  root_patches[mi]=(ps,ns,len(affected),locks)
def root_delta(point):
 key=tuple(math.floor(v/.014)for v in point);best=.014;found=None
 for x in[-1,0,1]:
  for y in[-1,0,1]:
   for z in[-1,0,1]:
    for sample,delta in root_grid.get((key[0]+x,key[1]+y,key[2]+z),[]):
     distance=math.dist(point,sample)
     if distance<best:best=distance;found=delta
 return found
# Original tailoring surface for a common displacement field shared by silk and
# its existing red piping. The trim moves with the cloth; it is not inflated.
cloth_samples=[];cloth_grid={}
for mesh in old['meshes']:
 for primitive in mesh['primitives']:
  if old['materials'][primitive['material']]['name']!='Kimono • deep violet blue silk':continue
  ps=read(primitive['attributes']['POSITION']);ns=read(primitive['attributes']['NORMAL'])
  for point,normal in zip(ps,ns):
   x,y,z=point
   if abs(x)<.19 and 1.18<y<1.37 and z>-.015:
    taper=max(0,min(1,(y-1.18)/.045,(1.37-y)/.025));delta=[n*.0022*taper for n in normal];key=tuple(math.floor(v/.012)for v in point);cloth_grid.setdefault(key,[]).append((point,delta))
def piping_delta(point):
 key=tuple(math.floor(v/.012)for v in point);best=.012;found=None
 for x in[-1,0,1]:
  for y in[-1,0,1]:
   for z in[-1,0,1]:
    for sample,delta in cloth_grid.get((key[0]+x,key[1]+y,key[2]+z),[]):
     distance=math.dist(point,sample)
     if distance<best:best=distance;found=delta
 return found
# Rebuild proper mune/shinogi/ha cross-sections, not a sharp diamond back.
blades={steelMat:{k:[]for k in['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']},edgeMat:{k:[]for k in['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']}}
def tri(mat,points,uv,joint):
 # Source canonical (blade width, thickness, length) -> GLB mesh bind coordinates.
 anchor=.90418 if joint==10 else -.92585
 ps=[[.72*(anchor+p[1]),.72*(1.82825+p[0]),.72*(p[2]-.0491)]for p in points];n=norm(cross(sub(ps[1],ps[0]),sub(ps[2],ps[0])))
 for p,t in zip(ps,uv):
  for key,value in [('POSITION',p),('NORMAL',n),('TEXCOORD_0',t),('JOINTS_0',[joint,0,0,0]),('WEIGHTS_0',[1,0,0,0])]:blades[mat][key].append(value)
for joint,length in[(34,1.14),(10,.98)]:
 steps=64 if not lod else 40
 def section(t):
  c=.075*t*t;tip=max(.0004,min(1,(1-t)/.105));w=.018*(1-.28*t)*tip;thick=tip*(1-.25*t)
  return[(c-w,-.0025*thick,.145+t*length),(c-.006*tip,-.0055*thick,.145+t*length),(c+.004*tip,-.0045*thick,.145+t*length),(c+w,0,.145+t*length),(c+.004*tip,.0045*thick,.145+t*length),(c-.006*tip,.0055*thick,.145+t*length),(c-w,.0025*thick,.145+t*length)]
 for i in range(steps):
  a,b=section(i/steps),section((i+1)/steps)
  for k in range(7):
   q=(k+1)%7;mat=edgeMat if k in[2,3]else steelMat;uv=[[k/7,i/steps],[q/7,i/steps],[q/7,(i+1)/steps],[k/7,(i+1)/steps]]
   tri(mat,[a[k],a[q],b[q]],uv[:3],joint);tri(mat,[a[k],b[q],b[k]],[uv[0],uv[2],uv[3]],joint)
 # Fine physical temper ribbons follow the bevel; they do not float inside it.
 for sign in[-1,1]:
  def line(t,offset):
   c=.075*t*t;w=.018*(1-.28*t);x=.010*(1-.28*t)+.0012*math.sin(t*72)+offset;y=.0045*(1-.25*t)*(w-x)/(w-.004)
   return(c+x,sign*(y+.00012),.145+t*length)
  for i in range(steps):
   a=.02+i/steps*.85;b=.02+(i+1)/steps*.85;p=[line(a,-.00035),line(a,.00035),line(b,.00035),line(b,-.00035)]
   tri(edgeMat,p[:3],[[0,a],[1,a],[1,b]],joint);tri(edgeMat,[p[0],p[2],p[3]],[[0,a],[1,b],[0,b]],joint)
for mi,mesh in enumerate(j['meshes']):
 for pi,p in enumerate(mesh['primitives']):
  mat=p['material'];name=j['materials'][mat]['name'];before=j['accessors'][p.get('indices',p['attributes']['POSITION'])]['count']//3
  if mat in[steelMat,edgeMat]:
   a=blades[mat];p['attributes']={k:append(v,{'POSITION':'VEC3','NORMAL':'VEC3','TEXCOORD_0':'VEC2','JOINTS_0':'VEC4','WEIGHTS_0':'VEC4'}[k],5121 if k=='JOINTS_0'else 5126,k=='POSITION')for k,v in a.items()};p.pop('indices',None);changed.append([mi,pi]);rows.append({'mesh':mi,'name':name,'beforeTriangles':before,'afterTriangles':len(a['POSITION'])//3});continue
  if name=='Rose hair strand shadow':
   positions=read(p['attributes']['POSITION']);adjusted=0
   for point in positions:
    delta=root_delta(point)
    if delta:
     for k in range(3):point[k]+=delta[k]
     adjusted+=1
   p['attributes']['POSITION']=append(positions,'VEC3',5126,True);changed.append([mi,pi]);rows.append({'mesh':mi,'name':name,'beforeTriangles':before,'afterTriangles':before,'rootEtchingFollowVertices':adjusted});continue
  if name=='Carmine red piping':
   positions=read(p['attributes']['POSITION']);adjusted=0
   for point in positions:
    delta=piping_delta(point)
    if delta:
     for k in range(3):point[k]+=delta[k]
     adjusted+=1
   p['attributes']['POSITION']=append(positions,'VEC3',5126,True);changed.append([mi,pi]);rows.append({'mesh':mi,'name':name,'beforeTriangles':before,'afterTriangles':before,'trimFollowVertices':adjusted});continue
  if name=='Kimono • deep violet blue silk':
   attrs={k:read(v)for k,v in p['attributes'].items()};adjusted=0
   for i,point in enumerate(attrs['POSITION']):
    x,y,z=point
    if abs(x)<.19 and 1.18<y<1.37 and z>-.015:
     taper=min(1,(y-1.18)/.045,(1.37-y)/.025);delta=.0022*max(0,taper)
     for k in range(3):point[k]+=attrs['NORMAL'][i][k]*delta
     adjusted+=1
   p['attributes']['POSITION']=append(attrs['POSITION'],'VEC3',5126,True);changed.append([mi,pi]);rows.append({'mesh':mi,'name':name,'beforeTriangles':before,'afterTriangles':before,'tailoringClearanceVertices':adjusted,'maxOutwardOffset':.0022});continue
  if mat not in hairMats:continue
  # Adaptive Phong edge tessellation rounds broad curved lock/scalp facets while
  # retaining every original vertex, UV seam, bone binding and silhouette anchor.
  attrs={k:read(v)for k,v in p['attributes'].items()};indices=[x[0]for x in read(p['indices'])];
  if mi in root_patches:attrs['POSITION'],attrs['NORMAL']=root_patches[mi][:2]
  pos=attrs['POSITION'];normal=attrs['NORMAL'];edges={};threshold=.018 if lod else .012
  def mid(a,b):
   key=tuple(sorted((a,b)))
   if key in edges:return edges[key]
   pa,pb=pos[a],pos[b];length=math.dist(pa,pb);angle=1-sum(x*y for x,y in zip(normal[a],normal[b]))
   if length<threshold or angle<.0008:return None
   center=[(x+y)/2 for x,y in zip(pa,pb)];delta=[0.,0.,0.]
   for index in[a,b]:
    dot=sum((center[k]-pos[index][k])*normal[index][k]for k in range(3))
    for k in range(3):delta[k]-=normal[index][k]*dot*.36
   mag=math.sqrt(sum(x*x for x in delta));factor=min(1,.0015/(mag or 1));point=[center[k]+delta[k]*factor for k in range(3)];new=len(pos)
   weights={}
   for vertex in[a,b]:
    for joint,weight in zip(attrs['JOINTS_0'][vertex],attrs['WEIGHTS_0'][vertex]):
     if weight>1e-8:weights[joint]=weights.get(joint,0)+weight*.5
   influences=sorted(weights.items(),key=lambda item:-item[1]);assert len(influences)<=4,'hair blend would exceed four bone weights';total_weight=sum(w for _,w in influences);newj=[i for i,_ in influences]+[0]*(4-len(influences));neww=[w/total_weight for _,w in influences]+[0]*(4-len(influences))
   for name,values in attrs.items():
    if name=='POSITION':value=point
    elif name=='JOINTS_0':value=newj
    elif name=='WEIGHTS_0':value=neww
    else:value=[(x+y)/2 for x,y in zip(values[a],values[b])];value=norm(value)if name=='NORMAL'else value
    values.append(value)
   edges[key]=new;return new
  output=[]
  for a,b,c in zip(indices[::3],indices[1::3],indices[2::3]):
   ids=[a,b,c];m=[mid(a,b),mid(b,c),mid(c,a)];count=sum(x is not None for x in m)
   if not count:output.extend(ids);continue
   if count==3:ab,bc,ca=m;output.extend([a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca]);continue
   if count==1:
    k=next(i for i,x in enumerate(m)if x is not None);a,b,c=ids[k],ids[(k+1)%3],ids[(k+2)%3];q=m[k];output.extend([a,q,c,q,b,c]);continue
   k=next(i for i,x in enumerate(m)if x is None);a,b,c=ids[k],ids[(k+1)%3],ids[(k+2)%3];bc,ca=m[(k+1)%3],m[(k+2)%3];output.extend([a,b,bc,a,bc,ca,ca,bc,c])
  ribbons=0
  p['attributes']={k:append(v,j['accessors'][p['attributes'][k]]['type'],j['accessors'][p['attributes'][k]]['componentType'],k=='POSITION')for k,v in attrs.items()};p['indices']=append([[x]for x in output],'SCALAR',5125);changed.append([mi,pi]);rows.append({'mesh':mi,'name':name,'beforeTriangles':before,'afterTriangles':len(output)//3,'gatheredReliefLocks':ribbons,'reconnectedRootVertices':root_patches.get(mi,(0,0,0,0))[2],'reconnectedLocks':root_patches.get(mi,(0,0,0,0))[3],'addedCurvedEdgeVertices':len(edges),'maxNewEdgeDisplacement':.0015})
# Identity authority: all nodes, skins, animations, materials, images/textures exact.
for key in['nodes','skins','animations','materials','images','textures','scenes']:assert j.get(key)==old.get(key),key
j['buffers'][0]['byteLength']=len(binary);encoded=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode();encoded+=b' '*((-len(encoded))%4);result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(result);Path(str(out)+'.gz').write_bytes(gzip.compress(result,compresslevel=9,mtime=0));report.write_text(json.dumps({'inputSha256':sha(raw),'outputSha256':sha(result),'gzipSha256':sha(Path(str(out)+'.gz').read_bytes()),'oldBinaryPrefixExact':bytes(binary[:len(oldbin)])==oldbin,'unchanged':['nodes','skins','animations','materials','images','textures','scenes'],'changedPrimitives':changed,'rows':rows,'byteDelta':len(result)-len(raw)},indent=2)+'\n');print(report.read_text())
