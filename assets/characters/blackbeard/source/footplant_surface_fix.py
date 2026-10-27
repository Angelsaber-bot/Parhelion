import bpy,os,json,math
from mathutils import Vector,Quaternion
from math import sin,cos,pi,sqrt
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/blackbeard_editable.blend',use_scripts=False)
rig=bpy.data.objects['Blackbeard_Rig'];scene=bpy.context.scene;body=bpy.data.objects['BB - authored anatomical body'];socket=bpy.data.objects['Blackbeard_Muzzle']
m=json.load(open(ROOT+'/rig/rig_manifest.json'));bones={n:(Vector(v['head']),Vector(v['tail']),v['parent']) for n,v in m['skeleton'].items()};rest={n:rig.data.bones[n].matrix_local.copy()for n in bones};cache={}
feet={'L':[],'R':[]}
for o in scene.objects:
 if o.type!='MESH' or not any(md.type=='ARMATURE' for md in o.modifiers):continue
 for side in feet:
  ids={g.index for g in o.vertex_groups if g.name in ['Foot.'+side,'Toe.'+side]}
  verts=[v.index for v in o.data.vertices if sum(g.weight for g in v.groups if g.group in ids)>.5]
  if verts:feet[side].append((o,verts))
def minsole(side):
 dep=bpy.context.evaluated_depsgraph_get();ans=99
 for o,ids in feet[side]:
  ev=o.evaluated_get(dep);me=ev.to_mesh();ans=min(ans,min((o.matrix_world@me.vertices[i].co).z for i in ids));ev.to_mesh_clear()
 return ans
def direct(n,head,tail):
 h,t,p=bones[n];q=(t-h).rotation_difference(Vector(tail)-Vector(head));mat=q.to_matrix().to_4x4()@rest[n];mat.translation=Vector(head);parent=bones[n][2]
 pm=cache.get(parent,rig.pose.bones[parent].matrix.copy());rig.pose.bones[n].matrix_basis=(pm@rest[parent].inverted()@rest[n]).inverted()@mat;cache[n]=mat

def leg(side,ankle,bob,roll):
 cache.clear();h0,k0,p=bones['Thigh.'+side];k0,a0,p=bones['Shin.'+side];h=h0+Vector((0,0,bob));d=ankle-h;D=min(d.length,(k0-h0).length+(a0-k0).length-.0001);u=d.normalized();ankle=h+u*D;L1=(k0-h0).length;L2=(a0-k0).length;a=(L1*L1-L2*L2+D*D)/(2*D);height=sqrt(max(.000001,L1*L1-a*a));forward=Vector((0,-1,0));perp=(forward-u*forward.dot(u)).normalized();k=h+u*a+perp*height
 direct('Thigh.'+side,h,k);direct('Shin.'+side,k,ankle);rot=Quaternion((1,0,0),roll);ft=rot@(bones['Foot.'+side][1]-bones['Foot.'+side][0]);direct('Foot.'+side,ankle,ankle+ft);tv=rot@(bones['Toe.'+side][1]-bones['Toe.'+side][0]);direct('Toe.'+side,ankle+ft,ankle+ft+tv)
legnames=[prefix+'.'+s for s in feet for prefix in ['Thigh','Shin','Foot','Toe']];report={}
for name,length in [('Walk',32),('Run',24)]:
 act=bpy.data.actions[name];rig.animation_data.action=act;records=[];first=None
 for frame in range(1,length+2):
  scene.frame_set(frame);bpy.context.view_layer.update();t=(frame-1)/length;running=name=='Run';stance=.38 if running else .60;stride=.34 if running else .21;lift=.17 if running else .075;bob=(-.085 if running else -.035)+(.025 if running else .012)*cos(t*4*pi)
  for side,off in [('L',0),('R',.5)]:
   phase=(t+off)%1;a=bones['Shin.'+side][1].copy()
   if phase<stance:
    q=phase/stance;a.y=-stride+2*stride*q;roll=.08*(1-q)-.10*max(0,(q-.8)/.2);swingheight=0
   else:
    q=(phase-stance)/(1-stance);a.y=stride*cos(pi*q);swingheight=lift*sin(pi*q);a.z+=swingheight;roll=-.12*sin(pi*q)
   target=.014+swingheight;startz=a.z
   for iteration in range(3):
    leg(side,a,bob,roll);bpy.context.view_layer.update();actual=minsole(side);error=target-actual
    if abs(error)<.00002:break
    a.z+=error
   records.append({'frame':frame,'side':side,'stance':phase<stance,'target':target,'sole':actual,'ankle_compensation':a.z-startz})
  if frame==1:first={n:rig.pose.bones[n].matrix_basis.copy()for n in legnames}
  if frame==length+1:
   for n in legnames:rig.pose.bones[n].matrix_basis=first[n]
  for n in legnames:
   p=rig.pose.bones[n];p.keyframe_insert('location',frame=frame,group=n);p.keyframe_insert('rotation_quaternion',frame=frame,group=n)
 for fc in act.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 report[name]={'samples':records,'max_keyframe_sole_error':max(abs(x['sole']-x['target'])for x in records),'max_ankle_correction':max(abs(x['ankle_compensation'])for x in records)}
 print(name,report[name]['max_keyframe_sole_error'],report[name]['max_ankle_correction'],flush=True)
# Dense interpolation check: report both feet, support-foot penetration, and preserved root.
for name,length in [('Walk',32),('Run',24)]:
 rig.animation_data.action=bpy.data.actions[name];mins=[];stanceerrors=[]
 for i in range(length*4+1):
  frame=1+i/4;scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update();t=(frame-1)/length;phaseL=t%1;stance=.38 if name=='Run' else .60
  for side,off in [('L',0),('R',.5)]:
   v=minsole(side);mins.append(v)
   if (t+off)%1<stance:stanceerrors.append(v-.014)
 report[name]['dense_min_y']=min(mins);report[name]['dense_stance_max_abs_error']=max(abs(x)for x in stanceerrors)
 print('DENSE',name,report[name]['dense_min_y'],report[name]['dense_stance_max_abs_error'],flush=True)
json.dump(report,open(ROOT+'/qa/footplant_surface_fix.json','w'),indent=2)
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1);scene['footplant_revision']='Walk/Run ankle IK compensated from actual boot-sole surface; hips/root untouched; stance plane .014m'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blackbeard_editable.blend',compress=True)
p=open(ROOT+'/source/integrate_runtime.py').read();exec(p[p.index('# Runtime copy:'):])
