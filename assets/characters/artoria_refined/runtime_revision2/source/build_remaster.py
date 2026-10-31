"""Original geometry/material/acting revision of the project's approved native Saber.
No downloaded model/texture assets. Keeps original skins, morph targets, clip clocks,
idle/walk/run tracks, feet and hand sockets. Run from repository root with Python.
"""
import pathlib,gzip,json,struct,hashlib,math
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[5]
OUT=pathlib.Path(__file__).resolve().parents[1]

def qm(a,b):
 x,y,z,w=a;X,Y,Z,W=b
 return np.array([w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z])
def matrix(n):
 if 'matrix'in n:return np.array(n['matrix']).reshape(4,4).T
 x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4);m[:3,:3]=[[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]];m[:3,:3]*=np.array(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m

def build(outfit):
 source=OUT.parent/'runtime_revision1'/outfit/f'artoria_{outfit}.glb.gz';raw=gzip.decompress(source.read_bytes());ln=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+ln]);data=bytearray(raw[28+ln:]);parents={c:i for i,n in enumerate(j['nodes'])for c in n.get('children',[])}
 def world(i):return world(parents[i])@matrix(j['nodes'][i])if i in parents else matrix(j['nodes'][i])
 def arr(ai):
  a=j['accessors'][ai];v=j['bufferViews'][a['bufferView']];c={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];return np.ndarray((a['count'],c),dtype=dt,buffer=data,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dt).itemsize*c),np.dtype(dt).itemsize))
 def append(values,typ,component=5126):
  nonlocal data
  values=np.asarray(values,dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[component]);data=data+b'\0'*((-len(data))%4);offset=len(data);data=data+values.tobytes();vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':values.nbytes});ai=len(j['accessors']);a={'bufferView':vi,'componentType':component,'count':len(values),'type':typ};
  if typ=='VEC3':a.update(min=values.min(0).tolist(),max=values.max(0).tolist())
  j['accessors'].append(a);return ai
 # Better differentiated gold hair, royal cobalt cloth and cool forged plate.
 for m in j['materials']:
  n=m.get('name','').lower();p=m.setdefault('pbrMetallicRoughness',{})
  if n=='hair':p.update(baseColorFactor=[1,.88,.59,1],roughnessFactor=.43)
  elif n=='face':p.update(baseColorFactor=[1,.97,.94,1],roughnessFactor=.63)
  elif 'deep teal blue' in n or 'midnight peacock' in n:p['baseColorFactor']=[.014,.045,.22,1];p['roughnessFactor']=.48
  elif 'cobalt fired' in n:p['baseColorFactor']=[.016,.055,.32,1];p['roughnessFactor']=.26
  elif 'brushed pearl' in n:p.update(baseColorFactor=[.68,.74,.82,1],metallicFactor=.69,roughnessFactor=.28)
  elif 'satin steel tassets' in n:p.update(baseColorFactor=[.67,.73,.82,1],roughnessFactor=.29)
 # Sculpt continuous cheek/jaw/nose planes while preserving all facial morph deltas.
 for node in j['nodes']:
  if node.get('name')!='Face':continue
  node.setdefault('extras',{})['geometry_policy']='R3 restrained cheek/jaw/nose sculpt; all 56 native expression targets transformed consistently'
  for primitive in j['meshes'][node['mesh']]['primitives']:
   ai=primitive['attributes']['POSITION'];old=arr(ai).copy()
   def sculpt(v):
    q=v.copy();front=np.clip((v[:,2]-.015)/.035,0,1);jaw=np.exp(-((v[:,1]-1.465)/.055)**2)*front
    q[:,0]*=1-.025*jaw
    nose=np.exp(-(v[:,0]/.018)**2-((v[:,1]-1.493)/.023)**2)*front;q[:,2]+=.0025*nose
    q[:,1]+=.002*np.exp(-((v[:,1]-1.414)/.018)**2)*front
    return q
   updated=sculpt(old)
   transformed=[]
   for target in primitive.get('targets',[]):
    if 'POSITION'in target:
     accessor=j['accessors'][target['POSITION']];delta=arr(target['POSITION']).copy()if'bufferView'in accessor else np.zeros_like(old)
     if 'sparse'in accessor:
      sparse=accessor['sparse'];si=sparse['indices'];sv=sparse['values'];iv=j['bufferViews'][si['bufferView']];vv=j['bufferViews'][sv['bufferView']];ids=np.frombuffer(data,dtype={5121:'u1',5123:'<u2',5125:'<u4'}[si['componentType']],count=sparse['count'],offset=iv.get('byteOffset',0)+si.get('byteOffset',0));values=np.frombuffer(data,dtype='<f4',count=sparse['count']*3,offset=vv.get('byteOffset',0)+sv.get('byteOffset',0)).reshape(-1,3);delta[ids]=values
     transformed.append((target,sculpt(old+delta)-updated))
   arr(ai)[:]=updated;j['accessors'][ai].update(min=updated.min(0).tolist(),max=updated.max(0).tolist())
   for target,delta in transformed:target['POSITION']=append(delta,'VEC3')
 # Re-tailor the lower silhouette into eight restrained radial folds. All
 # dress layers, stitched hems, armor tassets and trim share the same field.
 lower_names=['outer dress','jacquard','petal','reverse silk','tassets','edge shadow','champagne gold']
 for mesh in j['meshes']:
  for primitive in mesh['primitives']:
   material=j['materials'][primitive.get('material',0)].get('name','').lower();at=primitive['attributes'];pos=arr(at['POSITION'])
   if outfit=='armor' and any(n in material for n in lower_names):
    x,y,z=pos[:,0].copy(),pos[:,1].copy(),pos[:,2].copy();theta=np.arctan2(x,z);r=np.sqrt(x*x+z*z);hem=np.clip((.98-y)/.50,0,1);mask=(y<.98)&(r>.10)
    radial=(.018+.014*np.cos(8*theta))*hem
    pos[mask,0]+=radial[mask]*np.sin(theta[mask]);pos[mask,2]+=radial[mask]*np.cos(theta[mask]);pos[mask,1]+=.022*np.cos(8*theta[mask])*hem[mask]**3
   elif outfit=='armor' and ('brushed pearl'in material or 'cobalt fired'in material or 'dark steel seams'in material):
    x,y,z=pos[:,0].copy(),pos[:,1].copy(),pos[:,2].copy();mask=(np.abs(x)<.135)&(y>1.06)&(y<1.37)&(z>.09);keel=.009*np.exp(-(x/.045)**2)*np.sin(np.pi*np.clip((y-1.06)/.31,0,1));pos[mask,2]+=keel[mask]
   elif material=='hair':
    continue # Side locks are replaced by continuous tapered geometry below, not stretched alpha cutouts.
   else:continue
   j['accessors'][at['POSITION']].update(min=pos.min(0).tolist(),max=pos.max(0).tolist())
   if 'NORMAL'in at:
    ix=arr(primitive['indices'])[:,0].reshape(-1,3);normal=np.zeros_like(pos);cross=np.cross(pos[ix[:,1]]-pos[ix[:,0]],pos[ix[:,2]]-pos[ix[:,0]])
    for k in range(3):np.add.at(normal,ix[:,k],cross)
    length=np.linalg.norm(normal,axis=1);valid=length>1e-12;normal[valid]/=length[valid,None];arr(at['NORMAL'])[:]=normal
 # The native determined morph supplies a quiet, non-blank resting eye line.
 face=next(n for n in j['nodes']if n.get('name')=='Face');mesh=j['meshes'][face['mesh']];weights=list(face.get('weights',mesh.get('weights',[0]*len(mesh['primitives'][0].get('targets',[])))));weights[1]=.16;face['weights']=weights
 # Candidate proportion correction: rigid silver blade only, guard/grip unchanged.
 socket=next(i for i,n in enumerate(j['nodes'])if n.get('name')=='WeaponSocket_R');S=world(socket);I=np.linalg.inv(S);shortened=0;j['nodes'][socket].setdefault('extras',{})['saberBladeTip']=1.412
 for mesh in j['meshes']:
  for p in mesh['primitives']:
   name=j['materials'][p.get('material',0)].get('name','').lower()
   if not ('brushed silver'in name or 'silver bevel'in name):continue
   at=p['attributes'];pos=arr(at['POSITION']);weights=arr(at['WEIGHTS_0']);joint=arr(at['JOINTS_0']);hand=next(k for k,n in enumerate(j['skins'][0]['joints'])if j['nodes'][n].get('name')=='mixamorig:RightHand');mask=((joint==hand)*weights).sum(1)>.95
   local=(np.column_stack((pos,np.ones(len(pos))))@I.T)[:,:3];mask&=local[:,1]>.14201
   local[mask,1]=.142+(local[mask,1]-.142)*(1.27/1.505);pos[mask]=(np.column_stack((local[mask],np.ones(mask.sum())))@S.T)[:,:3];shortened+=int(mask.sum());a=j['accessors'][at['POSITION']];a.update(min=pos.min(0).tolist(),max=pos.max(0).tolist())
 # Distributed anticipation and recovery, exactly zero at existing contact/end.
 changed=0
 for anim in j['animations']:
  if anim['name']!='Attack':continue
  for c in anim['channels']:
   name=j['nodes'][c['target']['node']].get('name','');weight={'mixamorig:Spine':.20,'mixamorig:Spine1':.35,'mixamorig:Spine2':.45}.get(name)
   if weight is None or c['target']['path']!='rotation':continue
   sampler=anim['samplers'][c['sampler']];times=arr(sampler['input'])[:,0];values=arr(sampler['output'])
   for i,t in enumerate(times):
    # Smooth bump before impact; restrained counter-settle after impact.
    if t<2/3-1e-6:a=-.30*math.sin(math.pi*max(0,float(t))/(2/3))**2
    elif t>2/3+1e-6:a=.16*math.sin(math.pi*(float(t)-2/3)/(1.2-2/3))**2
    else:a=0
    a*=weight;q=qm(values[i].astype(float),[0,math.sin(a/2),0,math.cos(a/2)]);values[i]=q/np.linalg.norm(q);changed+=1
 # Retire the old short split ahoge, replaced below by one continuous sculpted lock.
 for mesh in j['meshes']:
  for p in mesh['primitives']:
   if j['materials'][p.get('material',0)].get('name')!='hair':continue
   pos=arr(p['attributes']['POSITION']);ix=arr(p['indices']);tri=ix[:,0].reshape(-1,3);components=np.arange(len(pos))
   def component(i):
    while components[i]!=i:components[i]=components[components[i]];i=components[i]
    return i
   for triangle in tri:
    for vertex in triangle[1:]:components[component(vertex)]=component(triangle[0])
   components=np.array([component(i)for i in range(len(pos))]);old_lock=set(components[pos[:,1]>1.69]);removed=np.array([c in old_lock for c in components]);keep=tri[~removed[tri].any(1)].reshape(-1);ix[:len(keep),0]=keep;j['accessors'][p['indices']]['count']=len(keep);hairSurface=pos[~removed].copy()
 # New authored layered crown filaments: real skinned volumetric geometry.
 mat=len(j['materials']);j['materials'].append({'name':'R3 | sculpted warm gold hair edges','pbrMetallicRoughness':{'baseColorFactor':[.67,.43,.13,1],'metallicFactor':0,'roughnessFactor':.46}})
 positions=[];normals=[];indices=[]
 def strand(points,width,flatten=1,conform=False):
  start=len(positions);segments=24;sides=6
  pts=np.array(points)
  if conform:
   pts=np.array([hairSurface[np.argmin(np.linalg.norm(hairSurface-point,axis=1))]for point in pts]);pts[:,2]+=.0008
   if width>.004:pts[-1,1]-=.008
  for k in range(segments+1):
   t=k/segments;center=(1-t)**3*pts[0]+3*(1-t)**2*t*pts[1]+3*(1-t)*t*t*pts[2]+t**3*pts[3];rad=width*(math.sin(math.pi*t)**.65+.06)
   tangent=3*(1-t)**2*(pts[1]-pts[0])+6*(1-t)*t*(pts[2]-pts[1])+3*t*t*(pts[3]-pts[2]);tangent/=np.linalg.norm(tangent);u=np.cross(tangent,[0,0,1]);u/=np.linalg.norm(u);v=np.cross(tangent,u)
   for s in range(sides):
    n=u*math.cos(s*math.tau/sides)+v*math.sin(s*math.tau/sides);shape=u*math.cos(s*math.tau/sides)+v*math.sin(s*math.tau/sides)*flatten;positions.append(center+shape*rad);normals.append(n)
  for k in range(segments):
   for s in range(sides):a=start+k*sides+s;b=start+k*sides+(s+1)%sides;indices.extend([a,b,a+sides,b,b+sides,a+sides])
 for side in [-1,1]:
  for k in range(3):
   x=side*(.018+k*.022);strand([(x*.6,1.678,.035),(x,1.681,.063),(x*1.35,1.635,.096),(x*1.25,1.589-k*.007,.092)],.0017,1,True)
 for side in [-1,1]:strand([(side*.100,1.560,.062),(side*.119,1.510,.075),(side*.111,1.435,.070),(side*.100,1.397,.065)],.008,.45,True)
 strand([hairSurface[np.argmin(np.linalg.norm(hairSurface-np.array([-.025,1.678,.020]),axis=1))].tolist(),(-.055,1.727,.020),(.025,1.724,.022),(.045,1.700,.028)],.0032)
 headNode=next(i for i,n in enumerate(j['nodes'])if n.get('name')=='mixamorig:Head');head=j['skins'][0]['joints'].index(headNode);count=len(positions)
 p={'attributes':{'POSITION':append(positions,'VEC3'),'NORMAL':append(normals,'VEC3'),'JOINTS_0':append([[head,0,0,0]]*count,'VEC4',5123),'WEIGHTS_0':append([[1,0,0,0]]*count,'VEC4')},'indices':append(np.array(indices).reshape(-1,1),'SCALAR',5125),'material':mat}
 mi=len(j['meshes']);j['meshes'].append({'name':'Saber R3 sculpted crown strands','primitives':[p]});ni=len(j['nodes']);j['nodes'].append({'name':'Saber_R3_Crown_Strands','mesh':mi,'skin':0,'extras':{'originalGeometry':True}});parent=parents[next(i for i,n in enumerate(j['nodes'])if n.get('name')=='Face')];j['nodes'][parent]['children'].append(ni)
 # Original layered heraldic breast-keel. Small physical facets, not a decal.
 if outfit=='armor':
  armor_positions=np.array([[0,1.18,.174],[-.005,1.20,.171],[-.006,1.30,.171],[0,1.325,.172],[.006,1.30,.171],[.005,1.20,.171],[0,1.255,.177]])
  armor_normals=np.zeros_like(armor_positions);armor_indices=[]
  for i in range(6):
   a,b,c=6,(i+1)%6,i;n=np.cross(armor_positions[b]-armor_positions[a],armor_positions[c]-armor_positions[a]);armor_normals[a]+=n;armor_normals[b]+=n;armor_normals[c]+=n;armor_indices.extend([a,b,c])
  armor_normals/=np.maximum(np.linalg.norm(armor_normals,axis=1)[:,None],1e-9)
  steel=next(i for i,m in enumerate(j['materials'])if 'brushed pearl'in m.get('name','').lower());spine=j['skins'][0]['joints'].index(next(i for i,n in enumerate(j['nodes'])if n.get('name')=='mixamorig:Spine2'));count=len(armor_positions)
  primitive={'attributes':{'POSITION':append(armor_positions,'VEC3'),'NORMAL':append(armor_normals,'VEC3'),'JOINTS_0':append([[spine,0,0,0]]*count,'VEC4',5123),'WEIGHTS_0':append([[1,0,0,0]]*count,'VEC4')},'indices':append(np.array(armor_indices).reshape(-1,1),'SCALAR',5125),'material':steel}
  mi=len(j['meshes']);j['meshes'].append({'name':'Saber R3 layered heraldic breast keel','primitives':[primitive]});ni=len(j['nodes']);j['nodes'].append({'name':'Saber_R3_Layered_Breast_Keel','mesh':mi,'skin':0});j['nodes'][parent]['children'].append(ni)
 j.setdefault('asset',{}).setdefault('extras',{})['parhelionRemaster']='2026-10-31 Saber R3 candidate; original additions, existing licensed project geometry retained';j['buffers'][0]['byteLength']=len(data);js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4);data=data+b'\0'*((-len(data))%4);out=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(data))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(data),0x004e4942)+data
 dest=OUT/outfit;dest.mkdir(parents=True,exist_ok=True);path=dest/f'artoria_{outfit}.glb.gz';path.write_bytes(gzip.compress(out,compresslevel=6,mtime=0));return {'outfit':outfit,'path':str(path.relative_to(ROOT)),'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'rawBytes':len(out),'rawSHA256':hashlib.sha256(out).hexdigest(),'shortenedBladeVertices':shortened,'newCrownVertices':1350,'newCrownTriangles':len(indices)//3,'attackRotationSamples':changed,'clipDurationsUnchanged':True,'status':'model freeze candidate accepted; final integrated QA pending'}
if __name__=='__main__':
 results=[build(o)for o in ['armor','civilian']];(OUT/'manifest.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
