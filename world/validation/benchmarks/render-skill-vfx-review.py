"""Offline actual GLB poses and runtime VFX. Vertex RGBA × material RGB/opacity matches
Three's USE_COLOR_ALPHA multiplication. Camera framing is ordinary TPS (75° FOV).
Blender's transparent ray compositing is NOT WebGL depth-write/sorting or browser QA.
"""
import bpy,json,sys,os,math
import numpy as np
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];source,output=args[:2];os.makedirs(output,exist_ok=True)
only=set(args[2].split(',')) if len(args)>2 else None
for filename in sorted(os.listdir(source)):
 if not filename.endswith('.json') or (only and filename not in only):continue
 manifest=json.load(open(os.path.join(source,filename)));bpy.ops.wm.read_factory_settings(use_empty=True)
 for asset in manifest['assets']:bpy.ops.import_scene.gltf(filepath=asset)
 originals={m.name:m for m in bpy.data.materials}
 for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
 for e in manifest['meshes']:
  raw=open(os.path.join(source,e['file']),'rb').read();n=e['count'];xyz=np.frombuffer(raw,dtype='<f4',count=n*3).reshape((-1,3)).copy();xyz[:,[1,2]]=np.column_stack((-xyz[:,2],xyz[:,1]));uv=np.frombuffer(raw,dtype='<f4',offset=n*12,count=n*4).reshape((-1,4)).copy();uv[:,[1,3]]=1-uv[:,[1,3]];rgba=np.frombuffer(raw,dtype='<f4',offset=n*28,count=n*4).reshape((-1,4)).copy();faces=np.frombuffer(raw,dtype='<u4',offset=n*44,count=e['indices']).reshape((-1,3));g=bpy.data.meshes.new(e['name']);g.from_pydata(xyz.tolist(),[],faces.tolist());g.update()
  layer=g.color_attributes.new(name='RuntimeRGBA',type='FLOAT_COLOR',domain='POINT');layer.data.foreach_set('color',rgba.reshape(-1).tolist())
  for m in e['materials']:
   if m['basic']:
    mat=bpy.data.materials.new(m['name'] or 'Runtime VFX');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');transparent=nodes.new('ShaderNodeBsdfTransparent');emission=nodes.new('ShaderNodeEmission');emission.inputs['Color'].default_value=tuple(m['color'])+(1,);emission.inputs['Strength'].default_value=1;mix=nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=m['opacity'];links=mat.node_tree.links;links.new(transparent.outputs[0],mix.inputs[1]);links.new(emission.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs['Surface'])
    if m['vertexColors']:
     vertex=nodes.new('ShaderNodeVertexColor');vertex.layer_name='RuntimeRGBA';color=nodes.new('ShaderNodeMixRGB');color.blend_type='MULTIPLY';color.inputs[0].default_value=1;color.inputs[2].default_value=tuple(m['color'])+(1,);links.new(vertex.outputs['Color'],color.inputs[1]);links.new(color.outputs[0],emission.inputs['Color']);alpha=nodes.new('ShaderNodeMath');alpha.operation='MULTIPLY';alpha.inputs[1].default_value=m['opacity'];links.new(vertex.outputs['Alpha'],alpha.inputs[0]);links.new(alpha.outputs[0],mix.inputs[0])
   else:
    mat=originals.get(m['name'])
    if mat is None:
     mat=bpy.data.materials.new(m['name'] or 'Runtime solid');mat.use_nodes=True;node=mat.node_tree.nodes.get('Principled BSDF');node.inputs['Base Color'].default_value=tuple(m['color'])+(1,);node.inputs['Roughness'].default_value=m['roughness'];node.inputs['Metallic'].default_value=m['metalness']
   g.materials.append(mat)
  for group in e['groups']:
   for poly in g.polygons[group['start']//3:(group['start']+group['count'])//3]:poly.material_index=group['materialIndex']
  if not any(m['basic'] for m in e['materials']):
   for poly in g.polygons:poly.use_smooth=True
  for channel,name in enumerate(['UVMap','UVMap.001']):
   layer=g.uv_layers.new(name=name);layer.data.foreach_set('uv',uv[faces.reshape(-1),channel*2:channel*2+2].reshape(-1).tolist())
  o=bpy.data.objects.new(e['name'],g);bpy.context.collection.objects.link(o)
  if any(m['basic'] for m in e['materials']):o.visible_shadow=False
 scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Review daylight');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.26,.33,.42,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55
 bpy.ops.mesh.primitive_plane_add(size=100);ground=bpy.context.object;mat=bpy.data.materials.new('Muted terrain');mat.diffuse_color=(.17,.21,.14,1);ground.data.materials.append(mat)
 data=bpy.data.lights.new('Daylight','SUN');data.energy=1.8;data.angle=.2;sun=bpy.data.objects.new('Daylight',data);scene.collection.objects.link(sun);sun.rotation_euler=(.4,-.4,-.5)
 convert=lambda p:Vector((p[0],-p[2],p[1]));camera=manifest['camera'];data=bpy.data.cameras.new('Ordinary TPS');cam=bpy.data.objects.new('Ordinary TPS',data);scene.collection.objects.link(cam);scene.camera=cam;cam.location=convert(camera['position']);target=convert(camera['target']);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();data.type='PERSP';data.sensor_fit='VERTICAL';data.angle=math.radians(camera['fov'])
 scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=False;scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.view_settings.view_transform='Standard';scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(output,manifest['id']+'.png');bpy.ops.render.render(write_still=True);print('VFX_RENDERED',manifest['id'],flush=True)
