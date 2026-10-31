"""Actual Three skin matrices -> bounded CPU render -> ffmpeg pipe, no raw frame cache."""
import bpy,sys,os,json,gzip,subprocess,math
import numpy as np
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];source,out=args[:2];start=float(args[2]) if len(args)>2 else 0;end=float(args[3]) if len(args)>3 else 99
os.makedirs(out,exist_ok=True);capture_path=os.path.join(source,'capture.json.gz' if os.path.isfile(os.path.join(source,'capture.json.gz')) else 'capture.json');data=json.load(gzip.open(capture_path,'rt') if capture_path.endswith('.gz') else open(capture_path))
bpy.ops.wm.read_factory_settings(use_empty=True)
asset=data['asset'];temporary=None
if asset.endswith('.gz'):
 temporary=os.path.join(out,'.render-source.glb')
 with gzip.open(asset,'rb') as a,open(temporary,'wb') as b:b.write(a.read())
 asset=temporary
bpy.ops.import_scene.gltf(filepath=asset);materials={m.name:m for m in bpy.data.materials}
for m in materials.values():m.use_fake_user=True
for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
objects=[]
for mesh_number,entry in enumerate(data['meshes']):
 raw=open(os.path.join(source,entry['file']),'rb').read();n=entry['n'];p=np.frombuffer(raw,'<f4',n*3).reshape(n,3).copy();uv=np.frombuffer(raw,'<f4',n*2,n*12).reshape(n,2).copy();uv[:,1]=1-uv[:,1];w=np.frombuffer(raw,'<f4',n*4,n*20).reshape(n,4);j=np.frombuffer(raw,'<u2',n*4,n*36).reshape(n,4);ix=np.frombuffer(raw,'<u4',entry['indices'],n*44).reshape(-1,3)
 mesh=bpy.data.meshes.new(entry['name']);mesh.from_pydata(p.tolist(),[],ix.tolist());mesh.update()
 for spec in entry['materials']:mesh.materials.append(materials.get(spec['name']) or bpy.data.materials.new(spec['name']))
 for group in entry['groups']:
  for poly in mesh.polygons[group['start']//3:(group['start']+group['count'])//3]:poly.material_index=group['materialIndex']
 for poly in mesh.polygons:poly.use_smooth=True
 layer=mesh.uv_layers.new(name='UVMap');layer.data.foreach_set('uv',uv[ix.reshape(-1)].reshape(-1))
 colorfile=os.path.join(source,entry.get('colorFile',f'mesh-{mesh_number}-color.bin'));colors=np.fromfile(colorfile,'<f4')
 names={node.layer_name for material in mesh.materials if material.use_nodes for node in material.node_tree.nodes if node.type=='VERTEX_COLOR'}
 for name in names:
  attribute=mesh.color_attributes.new(name=name or 'Color',type='FLOAT_COLOR',domain='POINT');attribute.data.foreach_set('color',colors)
 ob=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(ob)
 homo=np.column_stack([p,np.ones(n)])
 if entry['skin']>=0:homo=homo@np.asarray(entry['bind']).reshape(4,4)
 objects.append((ob,entry,homo,w,j))
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Neutral audit');scene.world.color=(.09,.10,.12)
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.location.z=-.02;fm=bpy.data.materials.new('Floor');fm.diffuse_color=(.08,.1,.13,1);floor.data.materials.append(fm)
for loc,power,size in [((-3,-4,6),650,5),((4,2,5),850,4)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,1.6))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-7,2.2) if '--front' in args else (4,-6,2.5));camera=bpy.context.object;scene.camera=camera;mounted=data['identity']=='napoleonMounted';camera.rotation_euler=(Vector((0,0,1.5 if mounted else 1.05))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=4.4 if mounted else 2.8
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=4;scene.cycles.use_denoising=False;scene.render.resolution_x=320;scene.render.resolution_y=400;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(out,'.working-frame.png');scene.view_settings.view_transform='AgX'
video=os.path.join(out,'continuous.mp4');encoder=subprocess.Popen(['ffmpeg','-v','error','-y','-f','image2pipe','-vcodec','png','-r',str(data['fps']),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p',video],stdin=subprocess.PIPE)
frames=[]
try:
 for fi,frame in enumerate(data['frames']):
  if frame['t']<start or frame['t']>end:continue
  offset=Vector((frame['root'][0],-frame['root'][2],frame['root'][1]));camera.location=offset+Vector((0,-7,2.2) if '--front' in args else (4,-6,2.5));camera.rotation_euler=(offset+Vector((0,0,1.5 if mounted else 1.05))-camera.location).to_track_quat('-Z','Y').to_euler()
  bones=[np.asarray(s).reshape(-1,4,4).transpose(0,2,1) for s in frame['bones']]
  for mi,(ob,entry,p,w,j) in enumerate(objects):
   if entry['skin']>=0:
    sk=np.zeros_like(p)
    for c in range(4):sk+=np.einsum('nij,nj->ni',bones[entry['skin']][j[:,c]],p)*w[:,c,None]
    local=sk@np.asarray(frame['inverses'][mi]).reshape(4,4)
   else:local=p
   world=local@np.asarray(frame['world'][mi]).reshape(4,4)
   indices=[0,len(p)//2,len(p)-1];error=np.max(np.abs(world[indices,:3]-np.asarray(frame['probes'][mi])))
   if error>1e-5:raise RuntimeError('CPU skin mismatch '+entry['name']+' '+str(error))
   xyz=np.column_stack([world[:,0],-world[:,2],world[:,1]]).astype('float32');ob.data.vertices.foreach_set('co',xyz.ravel());ob.data.update()
  bpy.context.view_layer.update();bpy.ops.render.render(write_still=True)
  with open(scene.render.filepath,'rb') as f:encoder.stdin.write(f.read())
  if not frames or fi%30==0:
   import shutil;shutil.copy2(scene.render.filepath,os.path.join(out,f'frame-{fi:04d}.png'))
  frames.append({'frame':fi,'time':frame['t'],'state':frame['state'],'clipTime':frame['clipTime']});print('CONTINUOUS_FRAME',fi,flush=True)
finally:
 encoder.stdin.close();code=encoder.wait()
 if temporary and os.path.exists(temporary):os.remove(temporary)
 if os.path.exists(scene.render.filepath):os.remove(scene.render.filepath)
json.dump({'rendererSha256':__import__('hashlib').sha256(open(__file__,'rb').read()).hexdigest(),'captureSha256':__import__('hashlib').sha256(open(capture_path,'rb').read()).hexdigest(),'assetSha256':data['assetSha256'],'sourceHashes':data['hashes'],'frames':frames,'fps':data['fps'],'scope':data['scope'],'limitations':['CPU Cycles 4-sample low-resolution continuous proof, not WebGL/FPS','Real runtime skin matrices, no image interpolation','Neutral studio camera/floor, not World environment']},open(os.path.join(out,'manifest.json'),'w'),indent=2)
if code:raise RuntimeError('ffmpeg failed '+str(code))
