"""Render the exact exported runtime geometry; save an editable master scene."""
import bpy,sys,os,math
from mathutils import Vector
source,out=sys.argv[sys.argv.index('--')+1:][:2]
os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(source))
scene=bpy.context.scene
scene.world=bpy.data.worlds.new('Portrait studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.10,.16,.22,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
for name,location,power,size,color in [('Key',(-3,-4,5),500,4,(1,.86,.72)),('Fill',(4,-2,3),300,3,(.68,.84,1)),('Rim',(1,2,4),650,3,(.62,.9,1))]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
 obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=location;obj.rotation_euler=(Vector((0,0,1.0))-obj.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Cast camera');camera=bpy.data.objects.new('Cast camera',data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO'
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.resolution_percentage=100
camera.location=(.15,-8,2.4);camera.rotation_euler=(Vector((0,0,.90))-camera.location).to_track_quat('-Z','Y').to_euler();data.ortho_scale=7.1
scene.render.resolution_x=1600;scene.render.resolution_y=650
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.abspath(out),'Main_Cast.blend'))
scene.render.filepath=os.path.join(os.path.abspath(out),'cast-lineup.png');bpy.ops.render.render(write_still=True)
for i,name in enumerate(['lan','ada','mara','mikhail','sumi']):
 x=(i-2)*1.25;camera.location=(x+.20,-3,1.65);target=Vector((x,0,1.42));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();data.ortho_scale=.72
 scene.render.resolution_x=560;scene.render.resolution_y=680;scene.render.filepath=os.path.join(os.path.abspath(out),name+'-portrait.png');bpy.ops.render.render(write_still=True)
