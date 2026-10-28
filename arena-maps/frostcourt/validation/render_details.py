"""Close inspection of the actual GLB; same neutral lights as chapter QA."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'validation/renders-r4';SRC=ROOT/'assets/frostcourt_visual.glb'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(SRC))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48;scene.cycles.use_denoising=False
scene.render.resolution_x=960;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='Standard';scene.view_settings.exposure=0;scene.view_settings.gamma=1
world=bpy.data.worlds.new('QA World');world.use_nodes=True;scene.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.26,.33,.43,1);world.node_tree.nodes['Background'].inputs[1].default_value=.8
light=bpy.data.lights.new('QA Sun','SUN');light.energy=2.3;light.angle=math.radians(8);sun=bpy.data.objects.new('QA Sun',light);scene.collection.objects.link(sun);sun.rotation_euler=(.48,-.4,-.55)
def coord(p):return Vector((p[0],-p[2],p[1]))
manifest=[]
for name,p,t,lens in [('fountain',[-7,3.7,8],[0,2.15,0],41),('wagon',[7,2.1,10],[13,1.3,5],45),('arcade',[-16,2.95,-11.5],[7,3.3,-17.2],24)]:
    data=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=coord(p);obj.rotation_euler=(coord(t)-obj.location).to_track_quat('-Z','Y').to_euler();data.lens=lens;data.clip_end=1000;scene.camera=obj
    scene.render.filepath=str(OUT/f'frostcourt-{name}.png');bpy.ops.render.render(write_still=True)
    manifest.append(dict(view=name,camera=p,target=t,lens=lens,sourceSha256=hashlib.sha256(SRC.read_bytes()).hexdigest(),renderer='Blender CPU Cycles',samples=48,lighting='Same neutral world/sun as render_arena_assets.py',limitations='Actual GLB inspection, not browser screenshot or GPU/runtime acceptance.'))
    bpy.data.objects.remove(obj,do_unlink=True)
(OUT/'detail-render-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
