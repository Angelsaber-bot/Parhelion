import bpy,os,json,struct,hashlib,math
import numpy as np
from mathutils import Vector,Quaternion
from pathlib import Path
exec(Path(__file__).with_name('_paths.py').read_text())
bpy.ops.wm.open_mainfile(filepath=D+'/sculpt/02_chaldea_skinned_master.blend')
arm=bpy.data.objects['Ritsuka_Skeleton'];headnames={'Authored_Male_Brows','Eye_Back','Hair_Underlayer_Continuous_Fitted','Head_Skin_Editable','Iris','Lid_Lines','Mouth_Interior','Ritsuka_Hair_Editable_CC0_Adaptation','Sclera'}
body=[o for o in bpy.data.objects if o.type=='MESH'and o.name not in headnames and not o.hide_render]
parts={o.name:{'vertices':len(o.data.vertices),'material':o.data.materials[0].name}for o in body};report={'source_body_objects':len(body),'head_objects_preserved':len(headnames),'pose_tests':{}}
def rot(n,axis,deg):
 p=arm.pose.bones[n];p.rotation_mode='QUATERNION';p.rotation_quaternion=Quaternion(p.bone.matrix_local.to_quaternion().inverted()@Vector(axis),math.radians(deg))
def pose(state):
 for p in arm.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
 if state!='bind':
  for side,sgn in [('R',1),('L',-1)]:
   rot('J_Bip_'+side+'_UpperArm',(0,1,0),sgn*(65 if state=='run'else -26));rot('J_Bip_'+side+'_LowerArm',(0,0,1),-sgn*65)
   rot('J_Bip_'+side+'_UpperLeg',(1,0,0),sgn*35 if state=='run'else 8);rot('J_Bip_'+side+'_LowerLeg',(1,0,0),-45 if sgn==1 else -12)
   rot('UniformFront_'+side,(1,0,0),max(0,sgn)*42 if state=='run'else 0);rot('UniformBack_'+side,(1,0,0),-max(0,-sgn)*30 if state=='run'else 0)
   for finger in ['Index','Middle','Ring','Little']:
    for n,a in [('1',25),('2',45),('3',30)]:rot('J_Bip_'+side+'_'+finger+n,(0,1,0),sgn*a)
  rot('J_Bip_C_Neck',(1,0,0),12);rot('J_Bip_C_Head',(0,0,1),-10)
 bpy.context.view_layer.update()
def snapshot(objects):
 result={};dg=bpy.context.evaluated_depsgraph_get()
 for o in objects:
  ev=o.evaluated_get(dg);me=ev.to_mesh();me.calc_loop_triangles();coords=np.array([tuple(o.matrix_world@v.co)for v in me.vertices]);tris=np.array([tuple(t.vertices)for t in me.loop_triangles]);key=o.data.materials[0].name;result.setdefault(key,[]).append(coords[tris]);ev.to_mesh_clear()
 # Sorting is by triangle centroid + sorted vertex coordinates. Compare actual coordinates, not only hashes/counts.
 out={}
 for name,arrays in result.items():
  a=np.concatenate(arrays,axis=0);order=np.lexsort((a[:,:,2],a[:,:,1],a[:,:,0]),axis=1);a=np.take_along_axis(a,order[:,:,None],axis=1);flat=a.reshape(-1,9);idx=np.lexsort(tuple(np.round(flat,7)[:,i]for i in reversed(range(9))));out[name]=flat[idx]
 return out
before={}
for state in ['bind','run','glide']:pose(state);before[state]=snapshot(body)
pose('bind');groups={}
for o in body:groups.setdefault(o.data.materials[0].name,[]).append(o)
merged=[]
for mi,(name,objects)in enumerate(groups.items()):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 if len(objects)>1:bpy.ops.object.join()
 o=bpy.context.object;o.name='BodyBatch_'+str(mi).zfill(2)+'_'+name.split('•')[-1].strip().replace(' ','_');o['source_parts']=json.dumps([n for n,p in parts.items()if p['material']==name]);merged.append(o)
for state in ['bind','run','glide']:
 pose(state);after=snapshot(merged);records={}
 for name,a in before[state].items():
  b=after[name];assert a.shape==b.shape;error=float(np.max(np.abs(a-b)));assert error<1e-6,(state,name,error);records[name]={'triangles':len(a),'max_deformed_position_difference_m':error}
 report['pose_tests'][state]=records
pose('bind');report['batched_body_objects']=len(merged);report['all_pose_tests_passed']=True;json.dump(report,open(D+'/qa/material-batch-pose-parity.json','w'),indent=2)
bpy.ops.wm.save_as_mainfile(filepath=D+'/sculpt/03_chaldea_game_export.blend')
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True)
objs=merged+[bpy.data.objects[n]for n in headnames]
for o in objs:o.select_set(True)
TMP=OUT+'/player_v2.pending.glb';bpy.ops.export_scene.gltf(filepath=TMP,export_format='GLB',use_selection=True,export_apply=False,export_yup=True,export_animations=False,export_morph=False,export_skins=True,export_materials='EXPORT',export_all_influences=False)
data=open(TMP,'rb').read();jl,jt=struct.unpack_from('<II',data,12);doc=json.loads(data[20:20+jl]);binary=data[20+jl:]
for m in doc['materials']:
 if m.get('name')in ['Ritsuka_Iris_BlueCyan','Ritsuka_Lid_Line']:m['alphaMode']='MASK';m['alphaCutoff']=.5
jb=json.dumps(doc,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4);open(TMP,'wb').write(struct.pack('<III',0x46546c67,2,20+len(jb)+len(binary))+struct.pack('<II',len(jb),0x4e4f534a)+jb+binary);os.replace(TMP,OUT+'/player_v2.glb')
manifest=json.load(open(OUT+'/manifest.json'));manifest['source_part_inventory']=parts;manifest['meshes']={}
for o in objs:o.data.calc_loop_triangles();manifest['meshes'][o.name]={'vertices':len(o.data.vertices),'triangles':len(o.data.loop_triangles),'material':o.data.materials[0].name}
manifest['render_meshes']=len(doc['meshes']);manifest['render_primitives']=sum(len(m['primitives'])for m in doc['meshes']);manifest['render_materials']=len(doc['materials']);manifest['glb_bytes']=os.path.getsize(OUT+'/player_v2.glb');manifest['sha256']=hashlib.sha256(open(OUT+'/player_v2.glb','rb').read()).hexdigest();manifest['batch_pose_parity_report']='material-batch-pose-parity.json';manifest['editable_master']='02_chaldea_skinned_master.blend';manifest['packed_export_master']='03_chaldea_game_export.blend'
json.dump(manifest,open(OUT+'/manifest.json','w'),indent=2);print(json.dumps(report,indent=2));print('BATCHED',manifest['render_meshes'],manifest['render_primitives'],manifest['glb_bytes'],manifest['sha256'])
