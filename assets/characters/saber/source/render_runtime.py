"""Render the actual reimported GLB with the same studio, including real clip poses."""
import bpy,os
from mathutils import Vector
BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,'saber_contract_servant.blend'))
for o in bpy.data.collections['SABER | authored character'].objects:o.hide_render=True
bpy.context.view_layer.active_layer_collection=bpy.context.view_layer.layer_collection
before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=os.path.join(BASE,'saber_contract_servant.glb'));new=set(bpy.context.scene.objects)-before
rig=next(o for o in new if o.type=='ARMATURE');rig.hide_render=False
for o in new:
 if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers):o.hide_render=False
acts={}
for tr in rig.animation_data.nla_tracks:
 for st in tr.strips:acts[tr.name]=st.action
 tr.mute=True
rig.animation_data.action=None
s=bpy.context.scene;s.cycles.use_denoising=False;s.cycles.samples=36;cam=s.camera
views=[
 ('06_runtime_glb',(2.3,-4.8,2.2),(0,0,.87),2.1,(1040,1280),None,1),
 ('07_walk_pose',(2.4,-4.6,2.1),(0,0,.88),2.13,(1040,1280),'Walk',9),
 ('08_attack_pose',(2.4,-4.6,2.1),(0,0,.92),2.2,(1040,1280),'Attack',11),
 ('09_runtime_face',(.58,-2.9,1.72),(0,-.015,1.558),.44,(1040,1040),None,1)]
if os.environ.get('SABER_VIEW'):views=[q for q in views if q[0] in os.environ['SABER_VIEW'].split(',')]
for name,loc,target,scale,res,clip,frame in views:
 for b in rig.pose.bones:b.matrix_basis.identity()
 rig.animation_data.action=next((a for n,a in acts.items() if clip and clip.lower() in n.lower()),None)
 s.frame_set(frame);cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;s.render.resolution_x=res[0];s.render.resolution_y=res[1];s.render.filepath=os.path.join(BASE,'renders',name+'.png');bpy.ops.render.render(write_still=True)
print('RUNTIME_REIMPORT_POSES',list(acts))
