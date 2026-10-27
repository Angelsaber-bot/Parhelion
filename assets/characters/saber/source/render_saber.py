import bpy,os
from mathutils import Vector
BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,'saber_contract_servant.blend'))
s=bpy.context.scene;s.cycles.use_denoising=False;s.cycles.samples=40
cam=s.camera
views=[('01_hero',(2.3,-4.8,2.2),(0,0,.87),2.1,(1040,1280)),('02_face',(.58,-2.9,1.72),(0,-.015,1.558),.44,(1040,1040)),('03_back',(-2.2,4.6,2.0),(0,0,.86),2.05,(1040,1280)),('04_front',(0,-5,1.55),(0,0,.86),2.04,(1040,1280)),('05_tps_scale',(2.7,4.2,2.7),(0,0,.92),3.1,(1280,880))]
if os.environ.get('SABER_VIEW'):views=[q for q in views if q[0] in os.environ['SABER_VIEW'].split(',')]
for name,loc,target,scale,res in views:
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;s.render.resolution_x=res[0];s.render.resolution_y=res[1];s.render.filepath=os.path.join(BASE,'renders',name+'.png');bpy.ops.render.render(write_still=True)
