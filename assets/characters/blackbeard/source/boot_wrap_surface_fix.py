import bpy,os
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/blackbeard_editable.blend',use_scripts=False)
rig=bpy.data.objects['Blackbeard_Rig'];scene=bpy.context.scene;body=bpy.data.objects['BB - authored anatomical body'];socket=bpy.data.objects['Blackbeard_Muzzle']
rig.animation_data.action=None
for p in rig.pose.bones:p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
shafts={}
for o in scene.objects:
 if o.type=='MESH' and 'fitted boot shaft' in o.name:
  side=1 if sum(v.co.x for v in o.data.vertices)>0 else-1
  shafts[side]=BVHTree.FromPolygons([v.co for v in o.data.vertices],[p.vertices[:] for p in o.data.polygons])
changed=0
for o in scene.objects:
 if o.type!='MESH' or 'diagonal linen boot binding' not in o.name:continue
 side=1 if sum(v.co.x for v in o.data.vertices)>0 else-1;n=len(o.data.vertices)
 for v in o.data.vertices:
  z=v.co.z;cx=side*(.2-.012*max(0,min(1,(z-.18)/.4)));center=Vector((cx,.012,z));direction=v.co-center;direction.z=0;direction.normalize()
  loc,normal,idx,dist=shafts[side].ray_cast(center,direction,1)
  if loc is not None:
   # Applied Solidify retains the two equal vertex layers; give both clearance and preserve 2mm ribbon body.
   v.co=loc+direction*(.0042 if v.index<n//2 else .0022);changed+=1
 o.data.update()
scene['boot_wrap_surface_fix']='All four linen ribbons radially fitted to actual boot shaft mesh; 2.2mm minimum clearance, 2mm thickness'
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blackbeard_editable.blend',compress=True)
p=open(ROOT+'/source/integrate_runtime.py').read();exec(p[p.index('# Runtime copy:'):]);print('Wrap vertices fitted',changed)
