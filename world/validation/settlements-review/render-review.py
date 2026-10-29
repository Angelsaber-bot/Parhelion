"""Offline studio-lit CPU geometry review. Authored practical light watts are approximated; not WebGL lighting acceptance."""
import bpy, json, sys, os, math
import numpy as np
from mathutils import Vector
source,out=sys.argv[sys.argv.index('--')+1:][:2]
os.makedirs(out,exist_ok=True)
for region in ['alpha','britain','blacksail','winter','kyoto']:
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
     attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='RuntimeColor';mat.node_tree.links.new(attr.outputs['Color'],n.inputs['Base Color'])
    material_cache[key]=mat
   mesh.materials.append(material_cache[key])
  for group in entry['groups']:
   for poly in mesh.polygons[group['start']//3:(group['start']+group['count'])//3]:poly.material_index=group['materialIndex']
  layer=mesh.color_attributes.new(name='RuntimeColor',type='FLOAT_COLOR',domain='POINT');rgba=np.ones((len(colors),4));rgba[:,:3]=colors;layer.data.foreach_set('color',rgba.reshape(-1).tolist())
  obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj)
 scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Review sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.32,.4,.55,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
 for l in manifest.get('lights',[]):
  ld=bpy.data.lights.new('Authored practical','POINT');ld.energy=l['intensity']*10;ld.color=l['color'];lo=bpy.data.objects.new('Authored practical',ld);scene.collection.objects.link(lo);lo.location=(l['position'][0],-l['position'][2],l['position'][1])
 width,depth=manifest['footprint'];span=max(width,depth);target=Vector((0,0,3))
 data=bpy.data.lights.new('Sun','SUN');data.energy=2.2;data.angle=.15;sun=bpy.data.objects.new('Sun',data);scene.collection.objects.link(sun);sun.rotation_euler=(.6,-.4,-.5)
 bpy.ops.mesh.primitive_plane_add(size=span*4,location=(0,0,manifest['bounds']['min'][1]-.2));ground=bpy.context.object;mat=bpy.data.materials.new('Review ground');mat.diffuse_color=(.22,.26,.23,1);ground.data.materials.append(mat)
 data=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=span*1.35
 cam.location=(span*.8,-span*.9,span*.72);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=False;scene.render.resolution_x=1100;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.render.filepath=os.path.join(out,region+'.png');bpy.ops.render.render(write_still=True);print('SETTLEMENT_RENDERED',region,flush=True)

 inside={'alpha':((0,1.7,-2.5),(0,1.4,-10)),'britain':((-10,1.7,4.5),(-10,1.4,-6)),'blacksail':((0,1.7,6),(-4,1.4,-5)),'winter':((-8,1.7,2),(-8,1.4,-6)),'kyoto':((8,1.7,2),(5,1.2,-6))}
 pos,aim=inside[region];cam.location=(pos[0],-pos[2],pos[1]);target=Vector((aim[0],-aim[2],aim[1]));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();data.type='PERSP';data.lens=22;fill_data=bpy.data.lights.new('Offline review fill','AREA');fill_data.energy=500;fill_data.size=4;fill=bpy.data.objects.new('Offline review fill',fill_data);scene.collection.objects.link(fill);fill.location=cam.location+Vector((0,0,1));fill.rotation_euler=(target-fill.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=os.path.join(out,region+'-interior.png');bpy.ops.render.render(write_still=True);print('INTERIOR_RENDERED',region,flush=True)
