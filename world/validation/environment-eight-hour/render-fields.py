"""Offline studio-lit CPU geometry review. Authored practical light watts are approximated; not WebGL lighting acceptance."""
import bpy, json, sys, os, math
import numpy as np
from mathutils import Vector
arguments=sys.argv[sys.argv.index('--')+1:];source,out=arguments[:2];views=arguments[2].split(',') if len(arguments)>2 else None;regions=arguments[3].split(',') if len(arguments)>3 else None
shadow_mode=arguments[4] if len(arguments)>4 else 'runtime'
assert shadow_mode in ['runtime','candidate','studio']
ambient_mode=arguments[5] if len(arguments)>5 else 'studio'
assert ambient_mode in ['studio','unoccluded-hemi-diagnostic']
print('SHADOW_REVIEW_MODE',shadow_mode,'AMBIENT_REVIEW_MODE',ambient_mode,flush=True)
os.makedirs(out,exist_ok=True)
for region in ['alpha','britain','blacksail','winter','kyoto']:
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
    surface=n.outputs['BSDF']
    if ambient_mode=='unoccluded-hemi-diagnostic':
     # A bounded diagnostic of Three's unoccluded hemisphere term, not GPU parity.
     # Keep it camera-only so emissive ambient does not create invented bounce lights.
     if not manifest.get('hemisphereLights'):raise ValueError('Export actual hemisphere metadata first')
     for hemi in manifest['hemisphereLights']:
      geom=mat.node_tree.nodes.new('ShaderNodeNewGeometry');dot=mat.node_tree.nodes.new('ShaderNodeVectorMath');dot.operation='DOT_PRODUCT';dot.inputs[1].default_value=(hemi['direction'][0],-hemi['direction'][2],hemi['direction'][1]);mat.node_tree.links.new(geom.outputs['Normal'],dot.inputs[0])
      weight=mat.node_tree.nodes.new('ShaderNodeMath');weight.operation='MULTIPLY_ADD';weight.inputs[1].default_value=.5;weight.inputs[2].default_value=.5;mat.node_tree.links.new(dot.outputs['Value'],weight.inputs[0])
      hue=mat.node_tree.nodes.new('ShaderNodeMixRGB');hue.inputs[1].default_value=tuple(hemi['groundColor'])+(1,);hue.inputs[2].default_value=tuple(hemi['color'])+(1,);mat.node_tree.links.new(weight.outputs[0],hue.inputs[0])
      product=mat.node_tree.nodes.new('ShaderNodeMixRGB');product.blend_type='MULTIPLY';product.inputs[0].default_value=1;mat.node_tree.links.new(hue.outputs[0],product.inputs[1])
      if m.get('vertexColors'):mat.node_tree.links.new(multiply.outputs[0],product.inputs[2])
      else:product.inputs[2].default_value=tuple(m['color'])+(1,)
      lightpath=mat.node_tree.nodes.new('ShaderNodeLightPath');strength=mat.node_tree.nodes.new('ShaderNodeMath');strength.operation='MULTIPLY';strength.inputs[1].default_value=hemi['intensity']/math.pi;mat.node_tree.links.new(lightpath.outputs['Is Camera Ray'],strength.inputs[0])
      ambient=mat.node_tree.nodes.new('ShaderNodeVectorMath');ambient.operation='SCALE';mat.node_tree.links.new(product.outputs[0],ambient.inputs[0]);mat.node_tree.links.new(strength.outputs[0],ambient.inputs['Scale'])
      emission=mat.node_tree.nodes.new('ShaderNodeMixRGB');emission.blend_type='ADD';emission.inputs[0].default_value=1;emission.inputs[1].default_value=tuple(v*m['emissiveIntensity'] for v in m['emissive'])+(1,);mat.node_tree.links.new(ambient.outputs[0],emission.inputs[2]);mat.node_tree.links.new(emission.outputs[0],n.inputs['Emission Color']);n.inputs['Emission Strength'].default_value=1
     mat.node_tree.links.new(surface,mat.node_tree.nodes.get('Material Output').inputs['Surface'])
    # Three FrontSide/BackSide controls primary visibility. Cycles otherwise exposes
    # backfaces when a spring-arm camera enters foliage; preserve other ray behavior.
    if m.get('side',2)!=2:
     geometry=mat.node_tree.nodes.new('ShaderNodeNewGeometry');pathnode=mat.node_tree.nodes.new('ShaderNodeLightPath');facing=geometry.outputs['Backfacing']
     if m['side']==1:
      invert=mat.node_tree.nodes.new('ShaderNodeMath');invert.operation='SUBTRACT';invert.inputs[0].default_value=1;mat.node_tree.links.new(facing,invert.inputs[1]);facing=invert.outputs[0]
     factor=mat.node_tree.nodes.new('ShaderNodeMath');factor.operation='MULTIPLY';mat.node_tree.links.new(facing,factor.inputs[0]);mat.node_tree.links.new(pathnode.outputs['Is Camera Ray'],factor.inputs[1])
     transparent=mat.node_tree.nodes.new('ShaderNodeBsdfTransparent');mix=mat.node_tree.nodes.new('ShaderNodeMixShader');mat.node_tree.links.new(factor.outputs[0],mix.inputs[0]);mat.node_tree.links.new(surface,mix.inputs[1]);mat.node_tree.links.new(transparent.outputs[0],mix.inputs[2]);mat.node_tree.links.new(mix.outputs[0],mat.node_tree.nodes.get('Material Output').inputs['Surface'])
    material_cache[key]=mat
   mesh.materials.append(material_cache[key])
  for group in entry['groups']:
   for poly in mesh.polygons[group['start']//3:(group['start']+group['count'])//3]:poly.material_index=group['materialIndex']
  layer=mesh.color_attributes.new(name='RuntimeColor',type='FLOAT_COLOR',domain='POINT');rgba=np.ones((len(colors),4));rgba[:,:3]=colors;layer.data.foreach_set('color',rgba.reshape(-1).tolist())
  obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj)
  if shadow_mode!='studio':
   if 'runtimeCastShadow' not in entry:raise ValueError('Re-export geometry with runtime shadow metadata before property-faithful review')
   obj.visible_shadow=entry['runtimeCastShadow'] or (shadow_mode=='candidate' and entry.get('candidateFieldCaster',False))
 scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Review sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.32,.4,.55,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
 if ambient_mode=='unoccluded-hemi-diagnostic':
  pathnode=scene.world.node_tree.nodes.new('ShaderNodeLightPath');strength=scene.world.node_tree.nodes.new('ShaderNodeMath');strength.operation='MULTIPLY';strength.inputs[1].default_value=.6;scene.world.node_tree.links.new(pathnode.outputs['Is Camera Ray'],strength.inputs[0]);scene.world.node_tree.links.new(strength.outputs[0],scene.world.node_tree.nodes['Background'].inputs['Strength'])
 for l in manifest.get('lights',[]):
  ld=bpy.data.lights.new('Authored practical','POINT');ld.energy=l['intensity']*10;ld.color=l['color'];lo=bpy.data.objects.new('Authored practical',ld);scene.collection.objects.link(lo);lo.location=(l['position'][0],-l['position'][2],l['position'][1])

 data=bpy.data.lights.new('Sun','SUN');data.energy=2.2;data.angle=.15;sun=bpy.data.objects.new('Sun',data);scene.collection.objects.link(sun);sun.rotation_euler=(.6,-.4,-.5)
 data=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',data);scene.collection.objects.link(cam);scene.camera=cam
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32 if ambient_mode=='unoccluded-hemi-diagnostic' else 24;scene.cycles.use_denoising=False;scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
 if manifest.get('cameras'):
  coord=lambda p:(p[0],-p[2],p[1])
  shots=[(c['label'],coord(c['position']),coord(c['target']),None) for c in manifest['cameras']]
  scene.render.resolution_x=1280;scene.render.resolution_y=720
  if manifest.get('directionalLights'):
   light=manifest['directionalLights'][0];sun.data.color=light['color'];sun.data.energy=light['intensity'];sun.location=coord(light['position']);sun.rotation_euler=(Vector(coord(light['target']))-sun.location).to_track_quat('-Z','Y').to_euler()
 else:
  shots=[('context',(42,-48,37),(0,0,2),42),('approach',(manifest['approachCamera'][0],-manifest['approachCamera'][2],manifest['approachCamera'][1]),(0,0,1.3),38),('detail',(16,-17,10),(0,0,1),40),('battle',(manifest.get('battleCamera',[3,1.65,5])[0],-manifest.get('battleCamera',[3,1.65,5])[2],manifest.get('battleCamera',[3,1.65,5])[1]),(-1,3,1.5),30)]
 for label,pos,target,lens in shots:
  if views and label not in views:continue
  cam.location=pos;target=Vector(target);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();data.type='PERSP'
  if lens is not None:data.lens=lens
  else:
   source_camera=next(c for c in manifest['cameras'] if c['label']==label);data.sensor_fit='VERTICAL';data.sensor_height=32;data.lens=32/(2*math.tan(math.radians(source_camera['fov'])/2))
  scene.render.filepath=os.path.join(out,region+'-'+label+'.png');bpy.ops.render.render(write_still=True);print('FIELD_RENDERED',region,label,flush=True)
