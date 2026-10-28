import bpy,math,json,numpy as np
from mathutils import Vector,Quaternion
from mathutils.bvhtree import BVHTree
from pathlib import Path
exec(Path(__file__).with_name('_paths.py').read_text())
bpy.ops.wm.open_mainfile(filepath=D+'/sculpt/02_chaldea_skinned_master.blend');arm=bpy.data.objects['Ritsuka_Skeleton']
def rot(n,deg):
 p=arm.pose.bones[n];p.rotation_mode='QUATERNION';p.rotation_quaternion=Quaternion(p.bone.matrix_local.to_quaternion().inverted()@Vector((1,0,0)),math.radians(deg))
def pose(thigh,front,tip,back):
 for p in arm.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion=(1,0,0,0)
 for s,sgn in [('R',1),('L',-1)]:
  rot('J_Bip_'+s+'_UpperLeg',sgn*thigh);rot('J_Bip_'+s+'_LowerLeg',-45 if s=='R'else -12);rot('UniformFront_'+s,front if s=='R'else 0);rot('UniformFront_'+s+'_Tip',tip if s=='R'else 0);rot('UniformBack_'+s,-back if s=='L'else 0)
 bpy.context.view_layer.update()
def triangles(o):
 dg=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(dg);me=ev.to_mesh();me.calc_loop_triangles();vs=[o.matrix_world@v.co for v in me.vertices];inds=[tuple(t.vertices)for t in me.loop_triangles];a=np.array([[tuple(vs[i])for i in t]for t in inds]);bv=BVHTree.FromPolygons(vs,inds,all_triangles=True);ev.to_mesh_clear();return a,bv
def segment_triangle(p0,p1,t):
 # Moller-Trumbore intersection constrained to actual finite segment and triangle.
 d=p1-p0;e1=t[1]-t[0];e2=t[2]-t[0];h=np.cross(d,e2);a=np.dot(e1,h)
 if abs(a)<1e-12:return False
 f=1/a;s=p0-t[0];u=f*np.dot(s,h)
 if u<-1e-7 or u>1+1e-7:return False
 q=np.cross(s,e1);v=f*np.dot(d,q)
 if v<-1e-7 or u+v>1+1e-7:return False
 tau=f*np.dot(e2,q);return 1e-6<tau<1-1e-6
report=[]
for thigh,front,tip,back in [(0,0,0,0),(35,26,-6,24),(45,34,-6,30),(60,47,-6,40)]:
 pose(thigh,front,tip,back);pants,pbv=triangles(bpy.data.objects['Trousers_Continuous_Tailored']);record={'source_thigh_degrees':thigh,'front_base_degrees':front,'front_tip_degrees':tip,'back_base_degrees':-back,'panels':{}}
 for name in ['UniformFront_R_Fabric','UniformFront_L_Fabric','UniformBack_R_Fabric','UniformBack_L_Fabric']:
  ts,bv=triangles(bpy.data.objects[name]);pairs=bv.overlap(pbv);cross=[]
  for i,j in pairs:
   a,b=ts[i],pants[j]
   if any(segment_triangle(a[k],a[(k+1)%3],b)or segment_triangle(b[k],b[(k+1)%3],a)for k in range(3)):cross.append([i,j])
  record['panels'][name]={'bvh_candidates':len(pairs),'exact_noncoplanar_edge_triangle_crossings':len(cross),'examples':cross[:12],'crossing_cloth_bounds':[[float(ts[[i for i,j in cross],:,k].min()),float(ts[[i for i,j in cross],:,k].max())]for k in range(3)] if cross else []}
 report.append(record)
json.dump({'method':'Actual skinned mesh triangle positions; BVH broad phase, finite Moller-Trumbore segment/triangle test. Coplanar overlaps and physical cloth collision simulation NOT established.','sweeps':report},open(D+'/qa/cloth-pants-clearance.json','w'),indent=2);print(json.dumps(report,indent=2))
