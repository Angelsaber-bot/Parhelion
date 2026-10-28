import bpy,os,math,sys,json
from mathutils import Vector,Matrix,Quaternion
from pathlib import Path
exec(Path(__file__).with_name('_paths.py').read_text())
mode=next((a for a in _remaining if a in ['neutral','bind','run','glide','swim']), 'neutral')
bpy.ops.wm.open_mainfile(filepath=D+'/sculpt/02_chaldea_skinned_master.blend')
sc=bpy.context.scene;sc.render.engine='BLENDER_EEVEE_NEXT';sc.render.resolution_x=850;sc.render.resolution_y=1100;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG'
sc.world.use_nodes=True;sc.world.node_tree.nodes.get('Background').inputs[0].default_value=(.19,.22,.28,1);sc.world.node_tree.nodes.get('Background').inputs[1].default_value=.4
sc.view_settings.view_transform='AgX';sc.view_settings.look='AgX - Medium High Contrast'
for name,pos,power,size in [('Key',(-2,3,3),300,3),('Fill',(2,2,1.8),160,3),('Rim',(1,-2,2.4),220,2)]:
 l=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,l);sc.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler();l.energy=power;l.shape='DISK';l.size=size
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));floor=bpy.context.object;floor.name='STUDIO_FLOOR';mat=bpy.data.materials.new('Studio ground');mat.diffuse_color=(.11,.13,.17,1);floor.data.materials.append(mat)
camd=bpy.data.cameras.new('Review Camera');cam=bpy.data.objects.new('Review Camera',camd);sc.collection.objects.link(cam);sc.camera=cam;camd.type='ORTHO';camd.ortho_scale=2.05
arm=bpy.data.objects['Ritsuka_Skeleton']
# Use pose bone world orientation relative to actual rest matrices, not assumptions about source axes.
def rotate_world(name,axis,angle):
 p=arm.pose.bones[name];R=Matrix.Rotation(angle,4,axis);rest=p.bone.matrix_local.copy();target=R@rest.to_3x3().to_4x4();target.translation=p.head.copy();p.matrix=target;bpy.context.view_layer.update()
def rot_local_axis_world(name,axis,angle):
 p=arm.pose.bones[name];v=p.bone.matrix_local.to_quaternion().inverted()@Vector(axis);p.rotation_mode='QUATERNION';p.rotation_quaternion=Quaternion(v,angle)
if mode!='bind':
 # Relaxed A-to-idle pose. Source anatomical Right +X rotates toward down using +Y, Left opposite.
 for side,sgn in [('R',1),('L',-1)]:
  rot_local_axis_world('J_Bip_'+side+'_UpperArm',(0,1,0),math.radians(sgn*77));rot_local_axis_world('J_Bip_'+side+'_LowerArm',(0,0,1),math.radians(-sgn*7))
  for finger in ['Index','Middle','Ring','Little']:
   for n,a in [('1',12),('2',20),('3',12)]:
    name='J_Bip_'+side+'_'+finger+n
    if name in arm.pose.bones:rot_local_axis_world(name,(0,1,0),math.radians(sgn*a))
if mode=='run':
 for side,sgn in [('R',1),('L',-1)]:
  rot_local_axis_world('J_Bip_'+side+'_UpperLeg',(1,0,0),math.radians(sgn*35));rot_local_axis_world('J_Bip_'+side+'_LowerLeg',(1,0,0),math.radians(-45 if sgn==1 else -12))
  rot_local_axis_world('J_Bip_'+side+'_UpperArm',(0,1,0),math.radians(sgn*65));rot_local_axis_world('J_Bip_'+side+'_LowerArm',(0,0,1),math.radians(-sgn*65))
 for side,sgn in [('R',1),('L',-1)]:
  rot_local_axis_world('UniformFront_'+side,(1,0,0),math.radians(max(0,sgn)*26));rot_local_axis_world('UniformBack_'+side,(1,0,0),math.radians(-max(0,-sgn)*24));rot_local_axis_world('UniformFront_'+side+'_Tip',(1,0,0),math.radians(-max(0,sgn)*6))
if mode=='glide':
 for side,sgn in [('R',1),('L',-1)]:
  rot_local_axis_world('J_Bip_'+side+'_UpperArm',(0,1,0),math.radians(sgn*-26));rot_local_axis_world('J_Bip_'+side+'_LowerArm',(0,0,1),math.radians(-sgn*65));rot_local_axis_world('J_Bip_'+side+'_UpperLeg',(1,0,0),math.radians(8));rot_local_axis_world('J_Bip_'+side+'_LowerLeg',(1,0,0),math.radians(-24))
if mode=='swim':
 rot_local_axis_world('J_Bip_C_Hips',(1,0,0),math.radians(-72))
 for side,sgn in [('R',1),('L',-1)]:
  rot_local_axis_world('J_Bip_'+side+'_UpperArm',(0,1,0),math.radians(sgn*-68));rot_local_axis_world('J_Bip_'+side+'_LowerLeg',(1,0,0),math.radians(-sgn*16))
bpy.context.view_layer.update()
angles=[(0,'front'),(40,'threequarter'),(90,'profile'),(180,'rear')]if mode in ['neutral','bind']else[(40,'threequarter'),(90,'profile')]
for angle,label in angles:
 a=math.radians(angle);cam.location=(4*math.sin(a),4*math.cos(a),1.0);target=Vector((0,0,.9));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();sc.render.filepath=D+'/renders/'+mode+'-'+label+'.png';bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=D+'/sculpt/QA_'+mode+'.blend')
