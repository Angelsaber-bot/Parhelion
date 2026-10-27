"""Actual exported geometry renders, fixed cameras and lighting, no artistic replacement.
blender -b -t 4 -P validation/blacksail/render.py -- decoded.glb output_dir cameras.json [shot]
"""
import bpy, sys, json, math, os
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
source,out,cameras=args[:3]; selected=args[3] if len(args)>3 else None
os.makedirs(out,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(source))
for ob in list(bpy.data.objects):
    if ob.name.startswith(('COL_','MK_')) or ob.name in ['COLLISION','MARKERS'] or ob.get('showWhen'):
        ob.hide_render=True
        for child in ob.children_recursive: child.hide_render=True
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=int(os.environ.get('BLACKSAIL_RENDER_SAMPLES','256')); scene.cycles.use_denoising=False
scene.render.resolution_x=1200; scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(0.30,0.46,0.55)
scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.38,0.57,0.68,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.45
bpy.ops.object.light_add(type='SUN',location=(0,0,300)); sun=bpy.context.object
sun.rotation_euler=(math.radians(25),math.radians(-30),math.radians(-25)); sun.data.energy=1.5; sun.data.angle=math.radians(12);sun.data.color=(1,0.86,0.68)
scene.view_settings.view_transform='Standard'; scene.view_settings.look='Medium High Contrast' if bpy.app.version < (4,0,0) else 'Medium High Contrast'
scene.view_settings.exposure=-0.35;scene.view_settings.gamma=1
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.lens=32;cam.data.clip_end=2500
cv=lambda p: Vector((p[0],-p[2],p[1]))
for shot in json.load(open(cameras)):
    if selected and selected!=shot['name']: continue
    cam.location=cv(shot['eye']); target=cv(shot['target']);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.abspath(os.path.join(out,shot['name']+'.png'))
    bpy.ops.render.render(write_still=True)
if os.environ.get('BLACKSAIL_SAVE_BLEND') == '1':
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(out,'blacksail-review.blend')))
