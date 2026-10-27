import bpy,os,math,json
from mathutils import Vector
from math import sin,cos,pi
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/outfit.blend',load_ui=False,use_scripts=False)
body=bpy.data.objects['BB - authored anatomical body']
leather=bpy.data.materials['BB dark glove and boot leather'];steel=bpy.data.materials['BB pale silver armor']
gold=bpy.data.materials.get('BB rich antique gold') or bpy.data.materials.new('BB rich antique gold');gold.diffuse_color=(.55,.31,.055,1);gold.use_nodes=True
p=gold.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=gold.diffuse_color;p.inputs['Metallic'].default_value=.78;p.inputs['Roughness'].default_value=.29
def mesh(n,v,f,m,sub=0):
 me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);o.data.materials.append(m)
 for p in me.polygons:p.use_smooth=True
 if sub:mo=o.modifiers.new('Surface finish','SUBSURF');mo.levels=sub
 return o

def line(n,pts,r,m):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=8;c.bevel_depth=r;c.bevel_resolution=2;sp=c.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for b,p in zip(sp.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);o.data.materials.append(m);return o

def axisband(n,center,axis,r1,r2,length,m,N=32):
 axis=Vector(axis).normalized();u=axis.cross(Vector((0,1,0))).normalized();w=axis.cross(u).normalized();center=Vector(center);v=[]
 for z,r in [(-length/2,r1),(-length/2+.001,r2),(length/2-.001,r2),(length/2,r1)]:
  for i in range(N):a=2*pi*i/N;v.append(center+axis*z+u*cos(a)*r+w*sin(a)*r*.89)
 f=[(k*N+i,k*N+(i+1)%N,(k+1)*N+(i+1)%N,(k+1)*N+i) for k in range(3) for i in range(N)]
 return mesh(n,v,f,m,1)
manifest=json.load(open(ROOT+'/rig/rig_manifest.json'))
print('MANIFEST KEYS',manifest.keys())
for s in [-1,1]:
 suffix='R' if s<0 else 'L';wrist=Vector((s*.460,-.086,1.022));palm=Vector((s*.482,-.127,.949));elbow=Vector((s*.377,-.045,1.285));handaxis=(palm-wrist).normalized();foreaxis=(elbow-wrist).normalized()
 # Anatomically fitted glove shell extracted from existing hand topology.
 verts=[];faces=[];ids={}
 def eligible(v):
  d=(v-wrist).dot(handaxis)
  return v.x*s>.425 and -.009<d<.102 and (v-wrist-handaxis*d).length<.12
 for poly in body.data.polygons:
  if all(eligible(body.data.vertices[i].co) for i in poly.vertices):
   row=[]
   for idx in poly.vertices:
    if idx not in ids:
     ids[idx]=len(verts);v=body.data.vertices[idx];verts.append(v.co+v.normal*.0017)
    row.append(ids[idx])
   faces.append(row)
 o=mesh('BB fitted fingerless glove.'+suffix,verts,faces,leather);o['bind_region']='Hand.'+suffix
 # Raised stitched cuff / armored bracer flanges, each explicit ring surface.
 for k in range(3):
  c=wrist+foreaxis*(.020+k*.033);r=.040+k*.006
  o=axisband('BB gold bracer band.'+suffix,c,foreaxis,r,r+.004,.022,gold);o['bind_region']='Forearm.'+suffix
  for t in [-.010,.010]:
   oo=axisband('BB bracer polished lip.'+suffix,c+foreaxis*t,foreaxis,r+.003,r+.005,.003,gold);oo['bind_region']='Forearm.'+suffix
 # leather separation between gold bands
 for k in range(2):
  c=wrist+foreaxis*(.037+k*.033);o=axisband('BB bracer dark separation.'+suffix,c,foreaxis,.044+k*.006,.045+k*.006,.009,leather);o['bind_region']='Forearm.'+suffix
 # Large handback angular gold plate sits on glove, follows real handplane.
 c=palm+Vector((s*.022,.013,.025));u=Vector((0,.024,-.011));v=handaxis*.032
 points=[c-u-v,c+u-v,c+u*.8+v,c-u*.8+v];o=mesh('BB gloveback gold plate.'+suffix,points,[(0,1,2,3)],gold);mo=o.modifiers.new('Gold plate thickness','SOLIDIFY');mo.thickness=.004;o['bind_region']='Hand.'+suffix
 # finger rings on exposed index and middle proximal phalanges
 for name,y,z in [('Index',-.192,.946),('Middle',-.164,.936)]:
  c=Vector((s*.481,y,z))
  o=axisband('BB '+name+' ring.'+suffix,c,handaxis,.010,.012,.008,gold,24);o['bind_region']=name+'1.'+suffix
# Ear hoops, actual anatomical earlobe area.
for s in [-1,1]:
 for k in range(2 if s>0 else 1):
  x=s*(.105+k*.005);y=-.013;z=1.805+k*.022
  o=line('BB ear hoop',[(x+.012*cos(a),y-.003*sin(a),z+.016*sin(a)) for a in [2*pi*j/24 for j in range(25)]],.0023,gold);o['bind_region']='Head'
# Source/license metadata kept with final editable scene.
scene=bpy.context.scene;scene['base_credit']='Body/head/hands: Dan Ulrich, Blender Studio Human Base Meshes v1.4.1, CC0. Original custom clothes, hair, beard, armor and firearm.'
scene['status']='Reference costume assembled; rig and runtime validation pending'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/costume_complete.blend')
