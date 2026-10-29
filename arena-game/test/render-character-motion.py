"""Offline CPU rendering of actual exported procedural fighter meshes, not WebGL."""
import bpy,json,sys,os
import numpy as np
from mathutils import Vector
source,out=sys.argv[sys.argv.index('--')+1:][:2];os.makedirs(out,exist_ok=True)
for capture in json.load(open(source))['captures']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 mat=bpy.data.materials.new('Actual vertex colors');mat.use_nodes=True;n=mat.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Color';mat.node_tree.links.new(n.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color']);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8
 for i,m in enumerate(capture['meshes']):
  xyz=np.array(m['positions']).reshape((-1,3));xyz[:,[1,2]]=np.column_stack((-xyz[:,2],xyz[:,1]));faces=np.array(m['indices']).reshape((-1,3));mesh=bpy.data.meshes.new(str(i));mesh.from_pydata(xyz.tolist(),[],faces.tolist());mesh.update();mesh.materials.append(mat)
  color=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT');rgb=np.array(m['colors']).reshape((-1,3));rgba=np.column_stack((rgb,np.ones(len(rgb))));color.data.foreach_set('color',rgba.flatten().tolist());obj=bpy.data.objects.new(str(i),mesh);bpy.context.collection.objects.link(obj)
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.65 if capture['name']=='apex' else -.02));floor=bpy.context.object;fm=bpy.data.materials.new('Floor');fm.diffuse_color=(.08,.1,.13,1);floor.data.materials.append(fm)
 scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.22,.27,.36,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5;target=Vector((0,0,.95))
 for name,pos,power in [('key',(-4,-4,7),800),('fill',(4,-1,5),550),('rim',(1,4,6),800)]:
  data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=4;obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
 data=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',data);scene.collection.objects.link(cam);scene.camera=cam;cam.location=(2.5,-4,1.8);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=2.3
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8;scene.cycles.use_denoising=False;scene.render.resolution_x=400;scene.render.resolution_y=480;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.render.filepath=os.path.join(out,capture['version']+'-'+capture['name']+'.png');bpy.ops.render.render(write_still=True)
 print('POSE_RENDERED',capture['version'],capture['name'],flush=True)
