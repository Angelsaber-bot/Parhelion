"""Offline CPU render of exact exported meshes/albedo materials; not browser/WebGL evidence."""
import bpy,json,os,sys
import numpy as np
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];source,out=args[:2];os.makedirs(out,exist_ok=True)
for filename in sorted(os.listdir(source)):
 if not filename.endswith('.json'):continue
 if len(args)>2 and not filename.startswith(args[2]):continue
 manifest=json.load(open(os.path.join(source,filename)));bpy.ops.wm.read_factory_settings(use_empty=True)
 materials={}
 for entry in manifest['meshes']:
  raw=open(os.path.join(source,entry['file']),'rb').read();n=entry['count'];xyz=np.frombuffer(raw,dtype='<f4',count=n*3).reshape((-1,3)).copy();xyz[:,[1,2]]=np.column_stack((-xyz[:,2],xyz[:,1]))
  uv=np.frombuffer(raw,dtype='<f4',offset=n*12,count=n*2).reshape((-1,2)).copy();uv[:,1]=1-uv[:,1]
  indices=np.frombuffer(raw,dtype='<u4',offset=n*20,count=entry['indices']).reshape((-1,3))
  mesh=bpy.data.meshes.new(entry['name']);mesh.from_pydata(xyz.tolist(),[],indices.tolist());mesh.update()
  for item in entry['materials']:
   name=item['name'];mat=materials.get(name)
   if mat is None:
    mat=bpy.data.materials.new(name);mat.use_nodes=True;node=mat.node_tree.nodes.get('Principled BSDF');node.inputs['Base Color'].default_value=tuple(item['color'])+(1,);node.inputs['Metallic'].default_value=item['metalness'];node.inputs['Roughness'].default_value=item['roughness'];node.inputs['Alpha'].default_value=item['opacity']
    node.inputs['Emission Color'].default_value=tuple(item['emissive'])+(1,);node.inputs['Emission Strength'].default_value=item['emissiveIntensity']
    if item['pattern']:
     size=item['patternSize'];pixels=np.fromfile(os.path.join(source,item['pattern']),dtype=np.uint8).reshape((size,size,4)).astype(np.float32)/255
     # Blender's generated pixel arrays are linear; decode the sRGB albedo exactly.
     rgb=pixels[:,:,:3];pixels[:,:,:3]=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
     image=bpy.data.images.new(item['pattern'],width=size,height=size,alpha=True);image.colorspace_settings.name='Linear Rec.709';image.pixels.foreach_set(np.flipud(pixels).reshape(-1));image.update()
     tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Linear';tex.extension='REPEAT';coords=mat.node_tree.nodes.new('ShaderNodeUVMap');coords.uv_map='UVMap';mat.node_tree.links.new(coords.outputs['UV'],tex.inputs['Vector'])
     mix=mat.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[1].default_value=tuple(item['color'])+(1,);mat.node_tree.links.new(tex.outputs['Color'],mix.inputs[2]);mat.node_tree.links.new(mix.outputs[0],node.inputs['Base Color'])
    materials[name]=mat
   mesh.materials.append(mat)
  for group in entry['groups']:
   for poly in mesh.polygons[group['start']//3:(group['start']+group['count'])//3]:poly.material_index=group['materialIndex']
  layer=mesh.uv_layers.new(name='UVMap');layer.data.foreach_set('uv',uv[indices.reshape(-1)].reshape(-1).tolist())
  obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj)
 scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Neutral armory');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.16,.19,.24,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
 # Each weapon uses one fixed camera across all six finishes, no per-finish reframing.
 points=[obj.matrix_world@Vector(corner) for obj in scene.objects if obj.type=='MESH' for corner in obj.bound_box];lo=Vector(tuple(min(v[i] for v in points)for i in range(3)));hi=Vector(tuple(max(v[i] for v in points)for i in range(3)));center=(lo+hi)/2;size=max(hi.x-lo.x,hi.y-lo.y,hi.z-lo.z)
 for name,offset,power in [('key',(-2,-3,4),260),('fill',(2,-1,2),180),('rim',(0,3,3),300)]:
  data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=2;obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=center+Vector(offset);obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
 data=bpy.data.cameras.new('Fixed finish camera');camera=bpy.data.objects.new('Fixed finish camera',data);scene.collection.objects.link(camera);scene.camera=camera;camera.location=center+Vector((size*.30,-size*2,size*.65));camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=size*1.23
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.resolution_x=960;scene.render.resolution_y=540;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(out,manifest['id']+'.png');scene.view_settings.view_transform='AgX';bpy.ops.render.render(write_still=True);print('FINISH_RENDERED',manifest['id'],flush=True)
