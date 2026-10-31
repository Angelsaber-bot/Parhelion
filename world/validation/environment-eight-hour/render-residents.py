"""Actual six-batch resident geometry; offline studio light, not runtime GPU evidence."""
import bpy,json,sys,os
from mathutils import Vector
source,out=sys.argv[sys.argv.index('--')+1:][:2]
os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
mat=bpy.data.materials.new('Runtime vertex palette');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.86
attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='RuntimeColor';mat.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])
for entry in json.load(open(source))['meshes']:
 p=entry['positions'];xyz=[(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)];ix=entry['indices'];mesh=bpy.data.meshes.new(entry['name']);mesh.from_pydata(xyz,[],[ix[i:i+3] for i in range(0,len(ix),3)]);mesh.update();mesh.materials.append(mat)
 color=mesh.color_attributes.new(name='RuntimeColor',type='FLOAT_COLOR',domain='POINT');color.data.foreach_set('color',entry['colors']);obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj)
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
for name,pos,power,size in [('Key',(-3,-5,6),650,5),('Fill',(4,-2,3),220,4)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;fm=bpy.data.materials.new('Neutral studio floor');fm.diffuse_color=(.12,.15,.18,1);floor.data.materials.append(fm)
data=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO'
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.resolution_x=1500;scene.render.resolution_y=650;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
for label,pos,aim,scale in [('residents',(2,-10,3.1),(0,0,.95),7.4),('faces',(0,-10,2),(0,0,1.52),6.6)]:
 cam.location=pos;cam.rotation_euler=(Vector(aim)-cam.location).to_track_quat('-Z','Y').to_euler();data.ortho_scale=scale;scene.render.filepath=os.path.join(out,label+'.png');bpy.ops.render.render(write_still=True)
