import bpy,os,json,math,struct
from mathutils import Vector
BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p=os.path.join(BASE,'saber_contract_servant.glb');blob=open(p,'rb').read();n,typ=struct.unpack_from('<II',blob,12);doc=json.loads(blob[20:20+n]);off=20+n;bn,bt=struct.unpack_from('<II',blob,off);binary=blob[off+8:off+8+bn]
COMPS={5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)};WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def accessor(idx):
 a=doc['accessors'][idx];v=doc['bufferViews'][a['bufferView']];fmt,size=COMPS[a['componentType']];w=WIDTH[a['type']];stride=v.get('byteStride',w*size);offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*w,binary,offset+i*stride) for i in range(a['count'])]
report={'glb_bytes':len(blob),'meshes':len(doc['meshes']),'materials':len(doc.get('materials',[])),'skins':len(doc.get('skins',[])),'joints':len(doc['skins'][0]['joints']),'triangle_count':0,'primitives':len(doc['meshes'][0]['primitives']),'clips':{},'checks':{}}
mins=[1e9]*3;maxs=[-1e9]*3;maxweight_error=0;normerrors=0
for m in doc['meshes']:
 for prim in m['primitives']:
  attr=prim['attributes'];assert all(k in attr for k in ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])
  report['triangle_count']+=doc['accessors'][prim['indices']]['count']//3
  for v in accessor(attr['POSITION']):
   assert all(math.isfinite(x) for x in v)
   for j in range(3):mins[j]=min(mins[j],v[j]);maxs[j]=max(maxs[j],v[j])
  for v in accessor(attr['NORMAL']):
   assert all(math.isfinite(x) for x in v);normerrors=max(normerrors,abs(sum(x*x for x in v)-1))
  for v in accessor(attr['TEXCOORD_0']):assert all(math.isfinite(x) for x in v)
  for v in accessor(attr['WEIGHTS_0']):maxweight_error=max(maxweight_error,abs(sum(v)-1))
  for v in accessor(attr['JOINTS_0']):assert max(v)<report['joints']
for anim in doc['animations']:
 variants=0;duration=0
 for sampler in anim['samplers']:
  t=accessor(sampler['input']);v=accessor(sampler['output']);duration=max(duration,max(x[0] for x in t))
  if any(sum((a-b)**2 for a,b in zip(x,v[0]))>1e-10 for x in v[1:]):variants+=1
 report['clips'][anim['name']]={'duration_seconds':duration,'channels':len(anim['channels']),'nonstatic_samplers':variants}
 assert variants>0
assert set(report['clips'])=={'Idle','Walk','Attack'}
assert report['triangle_count']<65000
assert maxweight_error<1e-4
report['checks'].update({'finite_positions_uvs_normals':True,'normalized_skin_weights':True,'max_weight_error':maxweight_error,'max_normal_squared_error':normerrors,'all_joint_indices_valid':True,'real_animation_channels_vary':True,'bounds_gltf_y_up':{'min':mins,'max':maxs},'no_external_resources':all(not b.get('uri') for b in doc.get('buffers',[]))})
# Actual clean Blender glTF reimport, not merely parsing file metadata.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=p)
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
assert len(rigs)==1 and len(meshes)==1
rig=rigs[0];mesh=meshes[0]
report['reimport']={'armatures':len(rigs),'meshes':len(meshes),'bones':len(rig.data.bones),'animation_actions':[],'mesh_deformation':{}}
acts=[]
for track in rig.animation_data.nla_tracks:
 for strip in track.strips:
  acts.append((track.name,strip.action));report['reimport']['animation_actions'].append({'track':track.name,'action':strip.action.name})
 track.mute=True
for name,act in acts:
 rig.animation_data.action=act
 bpy.context.scene.frame_set(1);dg=bpy.context.evaluated_depsgraph_get();me=mesh.evaluated_get(dg).to_mesh();p0=[v.co.copy() for v in me.vertices];mesh.evaluated_get(dg).to_mesh_clear()
 mid=act.frame_range[0]+(act.frame_range[1]-act.frame_range[0])*.25
 if 'Attack' in name:mid=act.frame_range[0]+(act.frame_range[1]-act.frame_range[0])*.32
 bpy.context.scene.frame_set(int(mid));dg=bpy.context.evaluated_depsgraph_get();me=mesh.evaluated_get(dg).to_mesh();delta=max((v.co-p0[v.index]).length for v in me.vertices);mesh.evaluated_get(dg).to_mesh_clear()
 report['reimport']['mesh_deformation'][name]={'max_vertex_displacement_m':delta,'sample_frame':int(mid)}
 assert delta>1e-5,(name,delta)
rig.animation_data.action=None;bpy.context.scene.frame_set(1)
with open(os.path.join(BASE,'qa','validation.json'),'w') as f:json.dump(report,f,indent=2)
print('VALIDATED_SABER',json.dumps(report))
