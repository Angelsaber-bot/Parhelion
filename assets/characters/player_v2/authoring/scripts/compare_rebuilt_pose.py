"""Blender evaluated deformation parity for frozen/reconstructed full-body exports."""
import bpy,sys,argparse,json,math,hashlib,numpy as np
from pathlib import Path
from mathutils import Vector,Quaternion
args=sys.argv[sys.argv.index('--')+1:];p=argparse.ArgumentParser();p.add_argument('frozen',type=Path);p.add_argument('rebuilt',type=Path);p.add_argument('--report',required=True,type=Path);opts=p.parse_args(args)
states=['bind','neutral','run','swim','glide']
def capture(path):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path.resolve()));arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');meshes=[o for o in bpy.data.objects if o.type=='MESH'];res={}
 def rot(n,axis,deg):
  b=arm.pose.bones[n];b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion(b.bone.matrix_local.to_quaternion().inverted()@Vector(axis),math.radians(deg))
 for state in states:
  for b in arm.pose.bones:b.rotation_mode='QUATERNION';b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
  if state!='bind':
   for side,sgn in [('R',1),('L',-1)]:
    rot('J_Bip_'+side+'_UpperArm',(0,1,0),sgn*({'neutral':77,'run':65,'swim':-68,'glide':-26}[state]));rot('J_Bip_'+side+'_LowerArm',(0,0,1),sgn*(-7 if state=='neutral'else -65))
    for finger in ['Index','Middle','Ring','Little']:
     for n,deg in [('1',12),('2',35),('3',20)]:rot('J_Bip_'+side+'_'+finger+n,(0,1,0),sgn*deg)
   rot('J_Bip_C_Neck',(1,0,0),8);rot('J_Bip_C_Head',(0,0,1),-7);rot('J_Adj_L_FaceEye',(0,0,1),4);rot('J_Adj_R_FaceEye',(0,0,1),4)
  if state=='run':
   for side,sgn in [('R',1),('L',-1)]:
    rot('J_Bip_'+side+'_UpperLeg',(1,0,0),sgn*35);rot('J_Bip_'+side+'_LowerLeg',(1,0,0),-45 if side=='R'else -12);rot('UniformFront_'+side,(1,0,0),26 if side=='R'else 0);rot('UniformFront_'+side+'_Tip',(1,0,0),-6 if side=='R'else 0);rot('UniformBack_'+side,(1,0,0),-24 if side=='L'else 0)
  if state=='swim':rot('J_Bip_C_Hips',(1,0,0),-72)
  if state=='glide':
   for side in ['L','R']:rot('J_Bip_'+side+'_UpperLeg',(1,0,0),8);rot('J_Bip_'+side+'_LowerLeg',(1,0,0),-24)
  bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();res[state]={}
  for o in meshes:
   ev=o.evaluated_get(dg);me=ev.to_mesh();res[state][o.name]=np.array([tuple(o.matrix_world@v.co)for v in me.vertices]);ev.to_mesh_clear()
 return res
A=capture(opts.frozen);B=capture(opts.rebuilt);report={'method':'Actual Blender evaluated armature deformation; same named bone poses, every exported mesh vertex compared in world space. Not a browser/GPU performance test.','frozen_sha256':hashlib.sha256(opts.frozen.read_bytes()).hexdigest(),'rebuilt_sha256':hashlib.sha256(opts.rebuilt.read_bytes()).hexdigest(),'poses':{}}
maximum=0
for state in states:
 rec={}
 for name,a in A[state].items():
  b=B[state][name];assert a.shape==b.shape;e=float(np.linalg.norm(a-b,axis=1).max());maximum=max(maximum,e);rec[name]={'vertices':len(a),'max_evaluated_position_error_m':e}
 report['poses'][state]=rec
report['max_error_m']=maximum;report['passed_tolerance_1um']=maximum<1e-6;assert report['passed_tolerance_1um'];opts.report.parent.mkdir(parents=True,exist_ok=True);opts.report.write_text(json.dumps(report,indent=2)+'\n');print('REBUILT POSE PARITY MAX ERROR METERS:',maximum)
