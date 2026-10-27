"""Actual model reference pose, no image-generation proxy."""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(R/'Musashi_Animated_Working.blend'),load_ui=False,use_scripts=False)
src=(R/'scripts/animation.py').read_text()
src=src.replace("CLIPS={'Idle':90,'Walk':32,'Run':20,'Attack':48}","CLIPS={'ReferencePose':1}")
src=src.replace("                # Analytic ankle target", "                if clip=='ReferencePose':\n                    ankle.x+=.035 if label=='Left' else -.035;ankle.y+=.08 if label=='Left' else -.04\n                # Analytic ankle target")
src=src.replace("            for label in ['Left','Right']:\n", "            targets={'Right':Vector((-.43,.12,1.99)), 'Left':Vector((.36,-.18,1.32))}\n            for label in ['Left','Right']:\n")
src=src.replace("                setworld(label+'Hand',target,handq)", "                direction=Vector((1,0,0)) if label=='Right' else Vector((-.72,-.12,-.68)).normalized()\n                delta=Vector((0,-1,0)).rotation_difference(direction);handq=delta@rest[nm(label+'Hand')].to_quaternion()\n                setworld(label+'Hand',target,handq)")
src=src.replace("arm.animation_data.action=bpy.data.actions.get('Idle')","arm.animation_data.action=bpy.data.actions.get('ReferencePose')")
ns={};exec(compile(src,'reference_pose_animation','exec'),ns);ns['build']()
s=bpy.context.scene;s.cycles.use_denoising=False;s.cycles.samples=96;s.render.resolution_percentage=100;c=s.camera
bpy.ops.wm.save_as_mainfile(filepath=str(R/'Musashi_Reference_Presentation.blend'))
for name,pos,target,scale in [('reference-hero',(3,-7,2.35),(0,0,1.33),2.98),('reference-front',(0,-7,2.25),(0,0,1.33),2.98),('reference-side',(6,-2,2.3),(0,0,1.33),2.98),('reference-back',(3,7,2.4),(0,0,1.33),2.98),('face-detail',(.8,-5,2.28),(0,0,2.21),.79),('costume-detail',(2,-6,2),(0,-.03,1.48),1.10)]:
 if '--hero-only' in sys.argv and name!='reference-hero':continue
 if '--back-only' in sys.argv and name!='reference-back':continue
 c.location=pos;c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=scale;s.render.filepath=str(R/'renders'/f'{name}.png');bpy.ops.render.render(write_still=True)
