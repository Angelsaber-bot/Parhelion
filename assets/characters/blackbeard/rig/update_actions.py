import bpy,math,json,os
from mathutils import Vector,Matrix,Quaternion
from math import sin,cos,pi,acos,sqrt
ROOT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/rigged_body.blend',use_scripts=False)
rig=bpy.data.objects['Blackbeard_Rig'];body=bpy.data.objects['BB - authored anatomical body']
m=json.load(open(ROOT+'/rig_manifest.json'));bones={n:(Vector(v['head']),Vector(v['tail']),v['parent']) for n,v in m['skeleton'].items()};empty=[]
rig.animation_data.action=None
for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
for name in ['Idle','Walk','Run','Attack','Melee']:
 if name in bpy.data.actions:bpy.data.actions.remove(bpy.data.actions[name])
rest={n:rig.data.bones[n].matrix_local.copy() for n in bones}

direct_cache={}
def reset():
 direct_cache.clear()
 for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)

def rotate_world(n,axis,angle):
 q=rest[n].to_quaternion();rig.pose.bones[n].rotation_quaternion=q.inverted()@Quaternion(Vector(axis),angle)@q

def direct(n,head,tail):
 h,t,p=bones[n];q=(t-h).rotation_difference(Vector(tail)-Vector(head));mat=q.to_matrix().to_4x4()@rest[n];mat.translation=Vector(head)
 parent=bones[n][2]
 if parent:
  pm=direct_cache.get(parent,rig.pose.bones[parent].matrix.copy())
  basis=(pm@rest[parent].inverted()@rest[n]).inverted()@mat
 else:basis=rest[n].inverted()@mat
 rig.pose.bones[n].matrix_basis=basis
 direct_cache[n]=mat

def leg(side,ankle,bob,roll=0):
 h0,k0,p=bones['Thigh.'+side];k0,a0,p=bones['Shin.'+side];h=h0+Vector((0,0,bob));ankle=Vector(ankle);d=ankle-h;D=min(d.length,(k0-h0).length+(a0-k0).length-.0001);u=d.normalized();ankle=h+u*D;L1=(k0-h0).length;L2=(a0-k0).length
 a=(L1*L1-L2*L2+D*D)/(2*D);height=sqrt(max(.000001,L1*L1-a*a));forward=Vector((0,-1,0));perp=(forward-u*forward.dot(u)).normalized();k=h+u*a+perp*height
 direct('Thigh.'+side,h,k);direct('Shin.'+side,k,ankle)
 ft=(bones['Foot.'+side][1]-bones['Foot.'+side][0]);ft=Quaternion((1,0,0),roll)@ft
 direct('Foot.'+side,ankle,ankle+ft)
 toevec=bones['Toe.'+side][1]-bones['Toe.'+side][0];direct('Toe.'+side,ankle+ft,ankle+ft+Quaternion((1,0,0),roll)@toevec)

def grip(side,strength,index=.6):
 # Curl toward palm (medial X) about anatomical finger transverse axis.
 sign=1 if side=='L' else -1
 for fname in ['Index','Middle','Ring','Pinky']:
  for k,amt in [(1,1.05),(2,1.15),(3,.80)]:rotate_world(fname+str(k)+'.'+side,(0,1,0),sign*strength*amt*(index if fname=='Index' else 1))
 rotate_world('Thumb1.'+side,(0,0,1),(-.20 if side=='L' else .20)*strength)
 for k in [2,3]:rotate_world('Thumb'+str(k)+'.'+side,(0,1,0),sign*.34*strength)

def key(frame):
 for pb in rig.pose.bones:
  pb.keyframe_insert('location',frame=frame,group=pb.name);pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)

def start_action(name):
 rig.animation_data_create();act=bpy.data.actions.new(name);rig.animation_data.action=act;return act
fps=30;bpy.context.scene.render.fps=fps
manifest={}
for name,length in [('Idle',90),('Walk',32),('Run',24),('Attack',42),('Melee',42)]:
 print('ACTION',name,flush=True)
 act=start_action(name)
 first_pose=None
 for frame in range(1,length+2):
  t=(frame-1)/length;reset();bob=0
  if name=='Idle':
   bob=-.005+.003*sin(t*2*pi);rig.pose.bones['Hips'].location=rest['Hips'].to_3x3().inverted()@Vector((0,0,bob))
   rotate_world('Chest',(1,0,0),.009*sin(t*2*pi));rotate_world('Head',(0,0,1),.018*sin(t*2*pi))
   for s,side in [(1,'L'),(-1,'R')]:rotate_world('UpperArm.'+side,(0,1,0),s*.12);rotate_world('Forearm.'+side,(1,0,0),-.07);grip(side,.15 if side=='L' else .85)
   bpy.context.view_layer.update()
   for side in ['L','R']:
    a=bones['Shin.'+side][1];leg(side,a,bob)
  elif name in ['Walk','Run']:
   running=name=='Run';stance=.38 if running else .60;stride=.34 if running else .21;lift=.17 if running else .075;bob=(-.085 if running else -.035)+(.025 if running else .012)*cos(t*4*pi)
   rig.pose.bones['Hips'].location=rest['Hips'].to_3x3().inverted()@Vector((0,0,bob))
   rotate_world('Chest',(1,0,0),(-.09 if running else -.015));rotate_world('Chest',(0,0,1),(.045 if running else .028)*sin(t*2*pi))
   bpy.context.view_layer.update()
   for s,side,off in [(1,'L',0),(-1,'R',.5)]:
    phase=(t+off)%1;a=bones['Shin.'+side][1].copy()
    if phase<stance:
     q=phase/stance;a.y=-stride+2*stride*q;a.z+=.0;roll=.08*(1-q)-.10*max(0,(q-.8)/.2)
    else:
     q=(phase-stance)/(1-stance);a.y=stride*cos(pi*q);a.z+=lift*sin(pi*q);roll=-.12*sin(pi*q)
    leg(side,a,bob,roll)
    swing=(.7 if running else .32)*sin(2*pi*(t+off));rotate_world('UpperArm.'+side,(1,0,0),swing)
    # Upper arms held closer to flank without collapsing clavicles.
    q=rig.pose.bones['UpperArm.'+side].rotation_quaternion.copy();r=rest['UpperArm.'+side].to_quaternion();rig.pose.bones['UpperArm.'+side].rotation_quaternion=q@(r.inverted()@Quaternion((0,1,0),s*.11)@r)
    rotate_world('Forearm.'+side,(1,0,0),-.72 if running else -.16);grip(side,.25 if side=='L' else .85)
  else:
   # Attack and recovery: stance, raise, fire at frame 18, recoil and lower.
   a=min(1,max(0,(frame-1)/10));recover=max(0,min(1,(frame-27)/15));a*=1-recover
   if name=='Melee':a=min(1,max(0,(frame-1)/8))*(1-max(0,min(1,(frame-27)/15)))
   bob=-.012*a;rig.pose.bones['Hips'].location=rest['Hips'].to_3x3().inverted()@Vector((0,0,bob))
   rotate_world('Chest',(0,0,1),-.075*a);rotate_world('Head',(0,0,1),.045*a)
   bpy.context.view_layer.update()
   for side in ['L','R']:leg(side,bones['Shin.'+side][1],bob)
   rotate_world('UpperArm.L',(0,1,0),.14);rotate_world('Forearm.L',(1,0,0),-.22);grip('L',.32)
   rh=rig.pose.bones['Clavicle.R'].tail.copy();rE=bones['UpperArm.R'][1];rW=bones['Forearm.R'][1];rH=bones['Hand.R'][1]
   recoil=max(0,1-abs(frame-19)/3)*.045 if name=='Attack' else 0
   if name=='Attack':
    E=Vector((-.31,-.282,1.51+bob+recoil));W=Vector((-.31,-.552+recoil,1.51+bob+recoil*1.4));H=W+Vector((0,-.079,-.015))
   else:
    swing=sin(max(0,min(1,(frame-8)/16))*pi);E=Vector((-.28,-.22,1.64+bob-.24*swing));W=Vector((.08-.50*swing,-.42,1.82-.65*swing));H=W+Vector((-.035,-.06,-.02))
   E=rE.lerp(E,a);W=rW.lerp(W,a);H=rH.lerp(H,a)
   E=rh+(E-rh).normalized()*(bones['UpperArm.R'][1]-bones['UpperArm.R'][0]).length
   W=E+(W-E).normalized()*(bones['Forearm.R'][1]-bones['Forearm.R'][0]).length
   H=W+(H-W).normalized()*(bones['Hand.R'][1]-bones['Hand.R'][0]).length
   direct('UpperArm.R',rh,E);direct('Forearm.R',E,W);direct('Hand.R',W,H);grip('R',.95,index=.35)
   rr=rest['Index1.R'].to_quaternion();rig.pose.bones['Index1.R'].rotation_quaternion @= rr.inverted()@Quaternion((1,0,0),-.35)@rr
  bpy.context.view_layer.update()
  if frame==1:first_pose={pb.name:pb.matrix_basis.copy() for pb in rig.pose.bones}
  elif frame==length+1:
   for pb in rig.pose.bones:pb.matrix_basis=first_pose[pb.name]
   bpy.context.view_layer.update()
  key(frame)
 for fc in act.fcurves:
  for kp in fc.keyframe_points:kp.interpolation='LINEAR'
 act.use_fake_user=True;manifest[name]={'start':1,'end':length+1,'duration_seconds':length/fps,'loop':name in ['Idle','Walk','Run'],'fire_frame':18 if name=='Attack' else None}
# Weapon rest transform solved from the actual firing pose, not guessed from A-pose axes.
rig.animation_data.action=bpy.data.actions['Attack'];bpy.context.scene.frame_set(15);bpy.context.view_layer.update()
palm=rig.pose.bones['Hand.R'].matrix@Vector((0,.042,0))
aim=Matrix.Identity(4);aim.translation=palm+Vector((.025,-.040,-.012))
weapon_rest=rig.data.bones['Hand.R'].matrix_local@rig.pose.bones['Hand.R'].matrix.inverted()@aim
manifest['weapon_attachment']={'parent_bone':'Hand.R','rest_world_matrix':[list(row) for row in weapon_rest],'desired_firing_muzzle_axis':[0,-1,0],'desired_firing_up_axis':[0,0,1],'firing_reference_frame':15,'palm_world_at_fire':list(palm),'note':'For local firearm coordinates muzzle -Y, up +Z, origin at palm, transform mesh into rest_world_matrix then skin rigidly to Hand.R. Rest matrix handles corrected authored hand coordinates.'}
manifest['skeleton']={n:{'head':list(h),'tail':list(t),'parent':p} for n,(h,t,p) in bones.items()}
manifest['body_vertex_count']=len(body.data.vertices);manifest['repaired_unweighted_vertices']=len(empty);manifest['max_influences']=max(len(v.groups) for v in body.data.vertices)
json.dump(manifest,open(ROOT+'/rig_manifest.json','w'),indent=2)
# Direct weight transfer by stable vertex index for main-agent integration.
weights={vg.index:vg.name for vg in body.vertex_groups}
json.dump({'vertex_count':len(body.data.vertices),'groups':list(weights.values()),'weights':[[[weights[g.group],g.weight] for g in v.groups] for v in body.data.vertices]},open(ROOT+'/body_weights.json','w'))
rig.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(1)
for name in ['Idle','Walk','Run','Attack','Melee']:
 track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,bpy.data.actions[name]);strip.name=name;track.mute=True
bpy.context.scene['animation_notes']='Original in-place humanoid clips; analytic planted-foot gait; no locomotion root translation. Weapon muzzle flash/sound are engine events at Attack frame 18.'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/rigged_body.blend')
# Export skeletal test: only body + rig, no review camera/light.
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=ROOT+'/rigged_body_test.glb',export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_anim_slide_to_zero=True,export_nla_strips=False,export_force_sampling=True,export_frame_range=False,export_skins=True,export_all_influences=False,export_extras=True)
print('RIG DONE',manifest['body_vertex_count'],manifest['max_influences'],manifest['repaired_unweighted_vertices'])
