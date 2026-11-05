"""Render every inventoried construction instance in six orthographic views.
Uses exact source vertex colors/geometry, with shipped batch triangle parity checked
separately. Neutral CPU lighting; not a WebGL/shader performance claim.
"""
import bpy, sys, json, math, os, struct
import numpy as np
from mathutils import Vector, Matrix
args=sys.argv[sys.argv.index('--')+1:];root,out=args[:2];region=args[2] if len(args)>2 else None
os.makedirs(out,exist_ok=True)
d=json.load(open(root+'/inventory.json'));items=json.load(open(root+'/review-items.json'));raw=np.memmap(root+'/construction.bin',dtype=np.uint8,mode='r')
items=[x for x in items if not region or x['region']==region]
views=[('front',0,12),('back',180,12),('left',-90,12),('right',90,12),('top',35,68),('below',35,-28)]
per=6;index=[]
for page in range(math.ceil(len(items)/per)):
 target=os.path.join(out,f'{region or "all"}-{page:03d}.png')
 batch=items[page*per:(page+1)*per]
 if os.path.exists(target):continue
 bpy.ops.wm.read_factory_settings(use_empty=True)
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=6;scene.cycles.use_denoising=False
 scene.render.resolution_x=1536;scene.render.resolution_y=1536;scene.render.resolution_percentage=100
 scene.render.image_settings.file_format='PNG';scene.world=bpy.data.worlds.new('Inspection');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.16,.19,.23,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
 scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=0
 mat=bpy.data.materials.new('Construction vertex color');mat.use_nodes=True;n=mat.node_tree.nodes;vc=n.new('ShaderNodeVertexColor');vc.layer_name='Tint';bs=n.get('Principled BSDF');mat.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.85
 geometry=n.new('ShaderNodeNewGeometry');transparent=n.new('ShaderNodeBsdfTransparent');mix=n.new('ShaderNodeMixShader');mat.node_tree.links.new(geometry.outputs['Backfacing'],mix.inputs[0]);mat.node_tree.links.new(bs.outputs['BSDF'],mix.inputs[1]);mat.node_tree.links.new(transparent.outputs[0],mix.inputs[2]);mat.node_tree.links.new(mix.outputs[0],n.get('Material Output').inputs['Surface'])
 # Single fixed camera, arranging independent projections in non-overlapping cells.
 camera=bpy.data.objects.new('Atlas camera',bpy.data.cameras.new('Atlas camera'));scene.collection.objects.link(camera);scene.camera=camera;camera.location=(0,0,60);camera.rotation_euler=(0,0,0);camera.data.type='ORTHO';camera.data.ortho_scale=36;camera.data.clip_end=150
 for name,energy,pos in [('Key',2,(0,0,50)),('Fill',.6,(-40,20,30))]:
  light=bpy.data.objects.new(name,bpy.data.lights.new(name,'SUN'));scene.collection.objects.link(light);light.data.energy=energy;light.rotation_euler=(math.radians(15),math.radians(-25),0)
 for row,item in enumerate(batch):
  points=[];colors=[];faces=[];offset=0
  for cid in item['components']:
   c=d['components'][cid];n=c['count'];p=np.frombuffer(raw,dtype='<f4',offset=c['offset'],count=n*3).reshape(-1,3);co=np.frombuffer(raw,dtype='<f4',offset=c['offset']+n*12,count=n*3).reshape(-1,3);ix=np.frombuffer(raw,dtype='<u4',offset=c['offset']+n*24,count=c['indices']).reshape(-1,3)
   points.append(p);colors.append(co);faces.append(ix+offset);offset+=n
  xyz=np.concatenate(points);rgb=np.concatenate(colors);tri=np.concatenate(faces);center=(xyz.min(0)+xyz.max(0))/2;local=xyz-center
  mesh=bpy.data.meshes.new(item['id']);mesh.from_pydata(local.tolist(),[],tri.tolist());mesh.materials.append(mat)
  tint=mesh.color_attributes.new(name='Tint',type='FLOAT_COLOR',domain='POINT');rgba=np.ones((len(rgb),4),dtype=np.float32);rgba[:,:3]=rgb;tint.data.foreach_set('color',rgba.ravel())
  for col,(label,az,el) in enumerate(views):
   az,el=math.radians(az),math.radians(el);forward=np.array([math.sin(az)*math.cos(el),math.sin(el),math.cos(az)*math.cos(el)]);right=np.array([math.cos(az),0,-math.sin(az)]);up=np.cross(forward,right);basis=np.stack([right,up,forward]);projected=local@basis.T
   scale=4.9/max(np.ptp(projected[:,0]),np.ptp(projected[:,1]),.01);basis*=scale
   obj=bpy.data.objects.new(item['id']+'-'+label,mesh);scene.collection.objects.link(obj)
   obj.matrix_world=Matrix([[*basis[0],-15+col*6],[*basis[1],15-row*6],[*basis[2],0],[0,0,0,1]])
   # Non-geometry annotation sits in front of the projection, leaving it unretouched.
   font=bpy.data.curves.new('Label','FONT');font.body=f'{item["id"]}\n{label}';font.size=.21;font.align_x='CENTER';font_obj=bpy.data.objects.new('Label',font);scene.collection.objects.link(font_obj);font_obj.location=(-15+col*6,12.18-row*6,15)
   fm=bpy.data.materials.get('Label') or bpy.data.materials.new('Label');fm.diffuse_color=(1,1,1,1);font.materials.append(fm)
  index.append({'sheet':os.path.basename(target),'row':row,'id':item['id'],'kind':item['kind'],'views':[v[0] for v in views]})
 scene.render.filepath=target;bpy.ops.render.render(write_still=True);print('ATLAS_DONE',target,flush=True)
 with open(os.path.join(out,(region or 'all')+'-index.json'),'w')as f:json.dump(index,f)
