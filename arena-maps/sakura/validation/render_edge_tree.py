"""Actual GLB CPU before/after, 1.65m player eye/78deg FOV. Not WebGL/toon parity.
blender -b -t 2 -P render_edge_tree.py -- BEFORE.glb AFTER.glb OUTPUT
"""
import bpy,math,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
before,after,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
def coord(p):return Vector((p[0],-p[2],p[1]))
manifest=[]
for name,src in [('before',before),('after',after)]:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(src.resolve()));scene=bpy.context.scene
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
 world=bpy.data.worlds.new('Offline dusk review');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.34,.3,1);world.node_tree.nodes['Background'].inputs[1].default_value=.7;scene.world=world
 light=bpy.data.lights.new('Source-direction dusk sun','SUN');light.energy=2.3;light.color=(1,.66,.43);light.angle=.14;obj=bpy.data.objects.new('Sun',light);scene.collection.objects.link(obj);obj.location=coord((-46,13,10));obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
 data=bpy.data.cameras.new('Player-height review');cam=bpy.data.objects.new('Camera',data);scene.collection.objects.link(cam);scene.camera=cam;data.sensor_fit='VERTICAL';data.sensor_height=32;data.lens=32/(2*math.tan(math.radians(78)/2));data.clip_end=300
 for view,pos,target in [('walk',(25.3,1.65,20.58090591430664),(28.1,1.65,20.58090591430664)),('corner',(20,1.65,16.5),(27,2.8,22))]:
  cam.location=coord(pos);cam.rotation_euler=(coord(target)-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str((out/f'{name}-{view}.png').resolve());bpy.ops.render.render(write_still=True)
  manifest.append({'asset':str(src),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'variant':name,'view':view,'position':pos,'target':target,'eyeHeight':1.65,'verticalFov':78,'renderer':'Blender Cycles CPU','lighting':'Offline approximate dusk; not runtime sky/toon/fog/PCF/bloom acceptance'})
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
