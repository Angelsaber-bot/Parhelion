"""Real GLB model/clip review, CPU Cycles. No GPU/runtime timing claim."""
import bpy,sys,os,math,json
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];asset,out,identity,variant=args[:4]
os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=asset)
roots=[o for o in bpy.context.scene.objects if not o.parent]
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False
scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.world=bpy.data.worlds.new('Review environment');scene.world.color=(.10,.10,.10)
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.fps=30
for ob in rigs:
 if ob.animation_data:
  for track in ob.animation_data.nla_tracks:track.mute=True
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012));floor=bpy.context.object
mat=bpy.data.materials.new('neutral review ground');mat.diffuse_color=(.075,.095,.12,1);floor.data.materials.append(mat)
def area(name,location,power,size,color):
 bpy.ops.object.light_add(type='AREA',location=location);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1.6))-o.location).to_track_quat('-Z','Y').to_euler()
area('large warm key',(-3,-4,5),650,4,(1,.84,.69));area('cool sky fill',(3,-1,3),400,4,(.65,.8,1));area('rim',(1,4,4),750,3,(.82,.9,1))
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO'
mounted=identity=='napoleon';prefix='Mounted' if mounted else ''
shots=[('idle-front','Idle',.5,'front'),('idle-side','Idle',.5,'side'),('run','Run',.2,'front'),('attack-prepare','Attack',.26,'front'),('attack-contact','Attack',23/30 if mounted else 17/30,'front'),('attack-recovery','Attack',1.15,'front')]
if "--quick" in args:shots=[shots[0],shots[1],shots[4]]
manifest=[]
for label,clip,time,view in shots:
 for rig in rigs:
  action=bpy.data.actions.get(prefix+clip)
  if not action:action=next((a for a in bpy.data.actions if a.name.startswith(prefix+clip)),None)
  if action:
   rig.animation_data_create();rig.animation_data.action=action
 scene.frame_set(1+int(time*30),subframe=(time*30)%1)
 target=Vector((0,0,1.55 if mounted else 1.08));camera.location=(6,-.3,2.5) if view=='side' else (3.5,-7,3.0 if mounted else 2.5)
 camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=4.15 if mounted else 2.75
 path=os.path.join(out,f'{identity}-{variant}-{label}.png');scene.render.filepath=path;bpy.ops.render.render(write_still=True)
 manifest.append({'file':path,'clip':prefix+clip,'seconds':time,'camera':list(camera.location),'target':list(target),'ortho_scale':camera.data.ortho_scale})
json.dump({'asset':asset,'identity':identity,'variant':variant,'cpu_only':True,'shots':manifest},open(os.path.join(out,f'{identity}-{variant}.json'),'w'),indent=2)
