"""Offline studio-lit CPU geometry review. Authored practical light watts are approximated; not WebGL lighting acceptance."""
import bpy, json, sys, os, math
import numpy as np
from mathutils import Vector
arguments=sys.argv[sys.argv.index('--')+1:];source,out=arguments[:2];views=arguments[2].split(',') if len(arguments)>2 else None;regions=arguments[3].split(',') if len(arguments)>3 else None
os.makedirs(out,exist_ok=True)
for region in ['alpha','blacksail','winter']:
 if regions and region not in regions:continue
 if not os.path.exists(os.path.join(source,region+'.json')):continue
 manifest=json.load(open(os.path.join(source,region+'.json')))
 bpy.ops.wm.read_factory_settings(use_empty=True)
 material_cache={}
 for entry in manifest['meshes']:
  raw=open(os.path.join(source,entry['file']),'rb').read();n=entry['count']
  xyz=np.frombuffer(raw,dtype='<f4',count=n*3).reshape((-1,3)).copy(); xyz[:,[1,2]]=np.column_stack((-xyz[:,2],xyz[:,1]))
  colors=np.frombuffer(raw,dtype='<f4',offset=n*12,count=n*3).reshape((-1,3)).copy()
  faces=np.frombuffer(raw,dtype='<u4',offset=n*24,count=entry['indices']).reshape((-1,3))
  mesh=bpy.data.meshes.new(entry['name']);mesh.from_pydata(xyz.tolist(),[],faces.tolist());mesh.update()
  for m in entry['materials']:
   key=json.dumps(m,sort_keys=True)
   if key not in material_cache:
    mat=bpy.data.materials.new(m['name'] or 'Material');mat.use_nodes=True;n=mat.node_tree.nodes.get('Principled BSDF')
    n.inputs['Base Color'].default_value=tuple(m['color'])+(m['opacity'],);n.inputs['Roughness'].default_value=m['roughness'];n.inputs['Metallic'].default_value=m['metalness']
    n.inputs['Emission Color'].default_value=tuple(m['emissive'])+(1,);n.inputs['Emission Strength'].default_value=m['emissiveIntensity']
    if m.get('vertexColors'):
     attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='RuntimeColor';multiply=mat.node_tree.nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1;multiply.inputs[2].default_value=tuple(m['color'])+(1,);mat.node_tree.links.new(attr.outputs['Color'],multiply.inputs[1]);mat.node_tree.links.new(multiply.outputs['Color'],n.inputs['Base Color'])
    material_cache[key]=mat
   mesh.materials.append(material_cache[key])
  for group in entry['groups']:
   for poly in mesh.polygons[group['start']//3:(group['start']+group['count'])//3]:poly.material_index=group['materialIndex']
  layer=mesh.color_attributes.new(name='RuntimeColor',type='FLOAT_COLOR',domain='POINT');rgba=np.ones((len(colors),4));rgba[:,:3]=colors;layer.data.foreach_set('color',rgba.reshape(-1).tolist())
  obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj)
 scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Review sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.32,.4,.55,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
 for l in manifest.get('lights',[]):
  ld=bpy.data.lights.new('Authored practical','POINT');ld.energy=l['intensity']*10;ld.color=l['color'];lo=bpy.data.objects.new('Authored practical',ld);scene.collection.objects.link(lo);lo.location=(l['position'][0],-l['position'][2],l['position'][1])

 data=bpy.data.lights.new('Sun','SUN');data.energy=2.2;data.angle=.15;sun=bpy.data.objects.new('Sun',data);scene.collection.objects.link(sun);sun.rotation_euler=(.6,-.4,-.5)
 data=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',data);scene.collection.objects.link(cam);scene.camera=cam
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
 for label,pos,target,lens in [('context',(42,-48,37),(0,0,2),42),('approach',(manifest['approachCamera'][0],-manifest['approachCamera'][2],manifest['approachCamera'][1]),(0,0,1.3),38),('detail',(16,-17,10),(0,0,1),40),('battle',(manifest.get('battleCamera',[3,1.65,5])[0],-manifest.get('battleCamera',[3,1.65,5])[2],manifest.get('battleCamera',[3,1.65,5])[1]),(-1,3,1.5),30)]:
  if views and label not in views:continue
  cam.location=pos;target=Vector(target);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();data.type='PERSP';data.lens=lens
  scene.render.filepath=os.path.join(out,region+'-'+label+'.png');bpy.ops.render.render(write_still=True);print('FIELD_RENDERED',region,label,flush=True)
