import bpy,os,json,math,hashlib
from mathutils import Vector,Matrix
R=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); O=R+'/rig/final_qa'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=R+'/blackbeard.glb')
s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE');meshes=[o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)];socket=bpy.data.objects.get('Blackbeard_Muzzle')
rep={'source_sha256':hashlib.sha256(open(R+'/blackbeard.glb','rb').read()).hexdigest(),'bones':len(r.data.bones),'meshes':[],'actions':[],'socket':{'exists':socket is not None}}
for ob in meshes:
 weights=[sum(g.weight for g in v.groups) for v in ob.data.vertices];rep['meshes'].append({'name':ob.name,'vertices':len(weights),'unweighted':sum(w<.001 for w in weights),'max_weight_sum_error':max(abs(w-1) for w in weights)})
def sample(act,f):
 r.animation_data.action=act;s.frame_set(math.floor(f),subframe=f-math.floor(f));bpy.context.view_layer.update();dep=bpy.context.evaluated_depsgraph_get();ps=[]
 for ob in meshes:
  ev=ob.evaluated_get(dep);me=ev.to_mesh();ps.extend([ob.matrix_world@v.co for v in me.vertices]);ev.to_mesh_clear()
 return ps
for a in bpy.data.actions:
 lo,hi=a.frame_range;p=sample(a,lo);q=sample(a,lo+(hi-lo)*.25);end=sample(a,hi);rep['actions'].append({'name':a.name,'frames':[lo,hi],'moving_delta':max((x-y).length for x,y in zip(p,q)),'loop_delta':max((x-y).length for x,y in zip(p,end)),'bounds_max_abs':max(abs(t) for v in q for t in v)})
# Socket should follow hand rigidly; position relative to hand cannot change.
if socket:
 vals=[]
 for a in bpy.data.actions:
  for f in [a.frame_range[0],sum(a.frame_range)/2]:
   sample(a,f);h=r.matrix_world@r.pose.bones['Hand.R'].matrix;vals.append(h.inverted()@socket.matrix_world)
 rep['socket']['hand_relative_max_drift']=max(abs(vals[0][i][j]-v[i][j]) for v in vals for i in range(4) for j in range(4));rep['socket']['hand_relative_matrix']=[list(row) for row in vals[0]]
json.dump(rep,open(O+'/validation.json','w'),indent=2)
# Actual imported GLB renders, no native meshes substituted.
s.render.engine='CYCLES';s.cycles.samples=20;s.cycles.use_denoising=False;s.render.resolution_x=720;s.render.resolution_y=900;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new('QA world');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.17,.21,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for loc,power,size in [((3,-4,5),700,4),((-3,-2,3),450,3),((1,3,4),850,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);ob=bpy.context.object;ob.data.energy=power;ob.data.shape='DISK';ob.data.size=size;ob.rotation_euler=(Vector((0,0,1))-ob.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-5,2.2));c=bpy.context.object;s.camera=c;c.data.type='ORTHO';c.data.ortho_scale=2.4;c.rotation_euler=(Vector((0,-.1,1.05))-c.location).to_track_quat('-Z','Y').to_euler()
for name,ratio in [('Run',.25),('Attack',14/42)]:
 a=next(a for a in bpy.data.actions if a.name.startswith(name));f=a.frame_range[0]+(a.frame_range[1]-a.frame_range[0])*ratio;sample(a,f);s.render.filepath=O+'/'+name+'.png';bpy.ops.render.render(write_still=True)
print(json.dumps(rep))

s.render.resolution_x=512;s.render.resolution_y=640;s.cycles.samples=16
a=next(a for a in bpy.data.actions if a.name.startswith('Run'))
for i in range(12):
 f=a.frame_range[0]+(a.frame_range[1]-a.frame_range[0])*i/12;sample(a,f);s.render.filepath=O+'/Run_loop_%02d.png'%i;bpy.ops.render.render(write_still=True)
