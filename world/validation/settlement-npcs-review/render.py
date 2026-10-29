"""CPU preview of actual resident vertices and vertex colors; not WebGL acceptance."""
import bpy,json,sys,os
from mathutils import Vector
source,out=sys.argv[sys.argv.index('--')+1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
m=bpy.data.materials.new('Resident vertex colors');m.use_nodes=True;n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Color';b=m.node_tree.nodes.get('Principled BSDF');m.node_tree.links.new(n.outputs['Color'],b.inputs['Base Color']);b.inputs['Roughness'].default_value=.86
for entry in json.load(open(source))['meshes']:
 p=entry['positions'];verts=[(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)];ix=entry['indices'];faces=[tuple(ix[i:i+3]) for i in range(0,len(ix),3)];mesh=bpy.data.meshes.new(entry['name']);mesh.from_pydata(verts,[],faces);mesh.update();attribute=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT');attribute.data.foreach_set('color',entry['colors']);mesh.materials.append(m)
 for poly in mesh.polygons:poly.use_smooth=True
 obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj)
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.3,.36,.47,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));ground=bpy.context.object;mat=bpy.data.materials.new('Floor');mat.diffuse_color=(.12,.15,.19,1);ground.data.materials.append(mat)
center=Vector((0,0,.85))
for name,loc,power in [('Key',(-3,-4,5),900),('Fill',(4,-2,4),700)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=5;obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Camera');camera=bpy.data.objects.new('Camera',data);scene.collection.objects.link(camera);scene.camera=camera;camera.location=(.5,-8,2.3);camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=7.2
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=20;scene.cycles.use_denoising=False;scene.render.resolution_x=1600;scene.render.resolution_y=650;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.render.filepath=out;bpy.ops.render.render(write_still=True)
