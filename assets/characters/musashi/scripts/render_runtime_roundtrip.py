import bpy,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];lod='--lod1' in sys.argv;file='Musashi_Runtime_LOD1.glb' if lod else 'Musashi_Runtime.glb'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(R/file));s=bpy.context.scene;a=next(o for o in s.objects if o.type=='ARMATURE')
# glTF importer stores named animation references in NLA; activate the matching action.
for tr in a.animation_data.nla_tracks:tr.mute=True
idle=next(x for x in bpy.data.actions if x.name.startswith('Idle'));a.animation_data.action=idle;s.frame_set(1);bpy.context.view_layer.update()
s.render.engine='CYCLES';s.cycles.samples=96;s.cycles.use_denoising=False;s.render.resolution_x=900;s.render.resolution_y=1200;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast'
w=bpy.data.worlds.new('Roundtrip studio');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.12,.15,.20,1);w.node_tree.nodes['Background'].inputs[1].default_value=.5
for name,loc,power,size,color in [('Key',(-3,-4,5),450,3,(1,.9,.8)),('Fill',(3,-3,3),300,3,(.8,.88,1)),('Rim',(1,3,4),500,2.5,(.95,.86,1))]:
 d=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=Vector(loc)*.72;d.energy=power*.72**2;d.shape='DISK';d.size=size*.72;d.color=color;o.rotation_euler=(Vector((0,0,1.4))*.72-o.location).to_track_quat('-Z','Y').to_euler()
c=bpy.data.objects.new('Roundtrip camera',bpy.data.cameras.new('Camera'));s.collection.objects.link(c);s.camera=c;c.data.type='ORTHO';c.location=Vector((3,-7,2.7))*.72;c.rotation_euler=(Vector((0,-.12,1.35))*.72-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=3.0*.72
s.render.filepath=str(R/'renders'/('runtime-lod1-roundtrip.png' if lod else 'runtime-lod0-roundtrip.png'));bpy.ops.render.render(write_still=True)
