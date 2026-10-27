import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scripts'))
bpy.ops.wm.open_mainfile(filepath=str(R/'Musashi_Working.blend'),load_ui=False,use_scripts=False)
arm=bpy.data.objects['Musashi_Rig'];sc=bpy.context.scene
# Clear construction pose before deriving rest data.
for p in arm.pose.bones:p.rotation_quaternion=(1,0,0,0)
bpy.context.view_layer.update()
# Transfer skirt stitch and panel line weights from nearest wrap surface: no floating trim.
from mathutils.kdtree import KDTree
panels=[o for o in sc.objects if o.type=='MESH' and ('overlapping angled front panel' in o.name or 'wrapped rear and right skirt' in o.name)]
pts=[(o,v) for o in panels for v in o.data.vertices];kd=KDTree(len(pts))
for i,(o,v) in enumerate(pts):kd.insert(o.matrix_world@v.co,i)
kd.balance()
for o in sc.objects:
 if o.type=='MESH' and any(t in o.name for t in ['outer hem','hem stitch','long angled gold-red']):
  for g in list(o.vertex_groups):o.vertex_groups.remove(g)
  for bn in ['Hips','LeftUpLeg','RightUpLeg']:o.vertex_groups.new(name='mixamorig:'+bn)
  for v in o.data.vertices:
   _,i,_=kd.find(o.matrix_world@v.co);ob,sv=pts[i]
   for g in sv.groups:
    name=ob.vertex_groups[g.group].name
    if name in o.vertex_groups:o.vertex_groups[name].add([v.index],g.weight,'REPLACE')
# Transfer cuff embroidery weights to actual glove surface to avoid floating ornaments.
for side in ['Left','Right']:
 sleeve=next(o for o in sc.objects if o.type=='MESH' and o.name.startswith(side+' • seamless above-elbow'))
 kd=KDTree(len(sleeve.data.vertices))
 for v in sleeve.data.vertices:kd.insert(sleeve.matrix_world@v.co,v.index)
 kd.balance()
 for o in sc.objects:
  if o.type!='MESH' or not o.name.startswith(side) or not ('glove gold' in o.name):continue
  for g in list(o.vertex_groups):o.vertex_groups.remove(g)
  for g in sleeve.vertex_groups:o.vertex_groups.new(name=g.name)
  for v in o.data.vertices:
   _,i,_=kd.find(o.matrix_world@v.co)
   for g in sleeve.data.vertices[i].groups:o.vertex_groups[g.group].add([v.index],g.weight,'REPLACE')
import animation
metadata=animation.build();(R/'qa/animation-metadata.json').write_text(json.dumps(metadata,indent=2))
sc.cycles.use_denoising=False;sc.cycles.samples=48;sc.render.resolution_percentage=75
bpy.ops.wm.save_as_mainfile(filepath=str(R/'Musashi_Animated_Working.blend'))
if '--build-only' in sys.argv:sys.exit(0)
c=sc.camera
for name,clip,frame,pos,target,scale in [('idle-hero','Idle',1,(3,-7,2.7),(0,-.12,1.35),3.0),('walk-contact','Walk',9,(3,-7,2.6),(0,-.12,1.35),3.0),('run-flight','Run',6,(3,-7,2.6),(0,-.12,1.35),3.0),('attack-first','Attack',20,(3,-7,2.6),(0,-.12,1.35),3.2),('attack-second','Attack',34,(3,-7,2.6),(0,-.12,1.35),3.2),('hand-grip','Idle',1,(2,-5,1.8),(-.34,-.15,1.45),.65)]:
 if '--grip-only' in sys.argv and name!='hand-grip':continue
 if '--idle-only' in sys.argv and name!='idle-hero':continue
 if '--run-only' in sys.argv and name!='run-flight':continue
 arm.animation_data.action=bpy.data.actions[clip];sc.frame_set(frame);bpy.context.view_layer.update();c.location=pos;c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=scale;sc.render.filepath=str(R/'renders'/f'{name}.png');bpy.ops.render.render(write_still=True)
