import bpy,os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/blackbeard_runtime.blend',use_scripts=False)
s=bpy.context.scene;s.cycles.samples=40;s.render.resolution_x=1000;s.render.resolution_y=1200;cam=s.camera;rig=bpy.data.objects['Blackbeard_Rig']
shots=[('01_full',(3,-7,3.0),(0,0,1.06),2.38,'Idle',1),('02_face',(.8,-3,1.98),(0,-.03,1.84),.56,'Idle',1),('03_front',(0,-7,2.0),(0,0,1.05),2.35,'Idle',1),('04_profile',(7,0,2.0),(0,0,1.05),2.35,'Idle',1),('05_back',(2,7,2.7),(0,0,1.05),2.35,'Idle',1),('06_attack',(3,-7,2.7),(0,-.12,1.08),2.5,'Attack',18),('07_run',(3,-7,2.5),(0,0,1.05),2.35,'Run',7)]
if os.getenv('BB_FACE_ONLY'):shots=[shots[1]]
if os.getenv('BB_SHOTS'):shots=[sh for sh in shots if sh[0] in os.getenv('BB_SHOTS').split(',')]
for name,loc,target,scale,act,frame in shots:
 rig.animation_data.action=bpy.data.actions[act];s.frame_set(frame);cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;s.render.filepath=ROOT+'/previews/runtime_'+name+'.png';bpy.ops.render.render(write_still=True)
