import bpy,os,math,random
from mathutils import Vector
from math import sin,cos,pi,exp
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/character_form.blend',load_ui=False,use_scripts=False)
random.seed(312)
# Utilities for explicit editable garment and hardware topology.
def mat(n,c,metal=0,rough=.5):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
cloth=mat('BB dark umber trouser cloth',(.043,.022,.019),0,.89)
red=mat('BB deep crimson trouser panels',(.20,.012,.016),0,.78)
leather=mat('BB dark glove and boot leather',(.025,.011,.008),0,.6)
steel=mat('BB pale silver armor',(.48,.53,.56),.78,.3)
edge=mat('BB bright silver bevels',(.63,.67,.67),.85,.24)
gold=mat('BB rich antique gold',(.55,.31,.055),.78,.29)
fur=mat('BB warm ivory fur',(.55,.51,.40),0,.95)
wrap=mat('BB pale linen wrap',(.62,.59,.49),0,.9)
black=mat('BB dark plate insets',(.013,.017,.021),.3,.48)

# Original seamless textile/leather albedo maps, embedded for glTF portability.
for m,filename in [(cloth,'umber_weave.png'),(red,'crimson_weave.png'),(leather,'dark_leather.png')]:
 im=bpy.data.images.load(ROOT+'/textures/'+filename,check_existing=True);im.pack();nd=m.node_tree.nodes.new('ShaderNodeTexImage');nd.image=im;m.node_tree.links.new(nd.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 if m!=leather:
  imn=bpy.data.images.load(ROOT+'/textures/woven_normal.png',check_existing=True);imn.colorspace_settings.name='Non-Color';imn.pack();tx=m.node_tree.nodes.new('ShaderNodeTexImage');tx.image=imn;nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.20;m.node_tree.links.new(tx.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],m.node_tree.nodes.get('Principled BSDF').inputs['Normal'])

def mesh(n,v,f,m,sub=0):
 me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);o.data.materials.append(m)
 for p in me.polygons:p.use_smooth=True
 if m in [cloth,red,leather]:
  layer=me.uv_layers.new(name='Cloth weave UV')
  for poly in me.polygons:
   for li in poly.loop_indices:
    vv=me.vertices[me.loops[li].vertex_index].co;side=1 if vv.x>0 else -1;cx=side*(.15 if vv.z>.60 else .20);layer.data[li].uv=(math.atan2(vv.y+.015,vv.x-cx)/(2*pi)*8,vv.z*12)
 if sub:mo=o.modifiers.new('Garment surface finish','SUBSURF');mo.levels=sub
 return o

def loft(n,rings,m,N=40,sub=1,fold=0):
 v=[]
 for k,(x,y,z,rx,ry) in enumerate(rings):
  for i in range(N):
   a=2*pi*i/N;f=fold*(.65*sin(7*a+z*11)+.35*sin(11*a-z*7))
   v.append((x+(rx+f)*cos(a),y+(ry+f)*sin(a),z))
 f=[(k*N+i,k*N+(i+1)%N,(k+1)*N+(i+1)%N,(k+1)*N+i) for k in range(len(rings)-1) for i in range(N)]
 return mesh(n,v,f,m,sub)

def line(n,pts,r,m):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=8;c.bevel_depth=r;c.bevel_resolution=2;sp=c.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for b,p in zip(sp.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);o.data.materials.append(m);return o

def panel(n,rows,m,sub=1,thick=.004):
 N=len(rows[0]);v=[p for r in rows for p in r];f=[(k*N+i,k*N+i+1,(k+1)*N+i+1,(k+1)*N+i) for k in range(len(rows)-1) for i in range(N-1)];o=mesh(n,v,f,m,sub)
 if thick:mo=o.modifiers.new('Real material thickness','SOLIDIFY');mo.thickness=thick
 return o

def uv(n,loc,scale,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=loc);o=bpy.context.object;o.name=n;o.scale=scale;o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o

def plate(n,outline,m,thickness=.007,bevel=.002):
 # outline is a polygon in 3D, symmetric thickness along Y
 v=[tuple(p) for p in outline]+[(x,y+thickness,z) for x,y,z in outline];N=len(outline)
 f=[tuple(reversed(range(N))),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
 o=mesh(n,v,f,m)
 for p in o.data.polygons:p.use_smooth=False
 if bevel:mo=o.modifiers.new('Machined plate bevel','BEVEL');mo.width=bevel;mo.segments=2;o.modifiers.new('Weighted plate normals','WEIGHTED_NORMAL')
 return o
# The upper yoke is distinct from the billowing leg pieces, as in the reference.
loft('BB trouser waist yoke',[(0,0,1.02,.24,.16),(0,0,1.05,.255,.17),(0,-.028,1.14,.207,.141),(0,-.035,1.185,.192,.135)],cloth,48,2,.004)
for s in [-1,1]:
 rings=[(s*.188,-.015,.57,.090,.102),(s*.184,-.012,.60,.095,.108),(s*.177,-.009,.65,.135,.13),(s*.167,-.005,.73,.169,.15),(s*.153,.001,.84,.177,.164),(s*.14,.008,.95,.172,.17),(s*.12,.012,1.045,.157,.16),(s*.105,.012,1.075,.145,.152)]
 loft('BB billowing trouser leg '+str(s),rings,cloth,48,2,.009)
 # broad crimson inset follows the outer front quarter, bounded by raised folded trim.
 rows=[]
 for k,(cx,cy,z,rx,ry) in enumerate(rings):
  row=[]
  for j in range(7):
   a=-pi/2+s*(.18+j*.12);rr=.004+.009*(.65*sin(7*a+z*11)+.35*sin(11*a-z*7));row.append((cx+(rx+rr)*cos(a),cy+(ry+rr)*sin(a),z))
  rows.append(row)
 panel('BB crimson inset '+str(s),rows,red,1,.004)
 for side in [0,-1]:line('BB raised red leg seam',[r[side] for r in rows],.006,red)
 # irregular scalloped edging around side panels
 for k in range(15):
  t=k/14;z=.64+.40*t;cx=s*(.13+.02*sin(t*pi));x=cx+s*(.13+.034*sin(t*pi));y=-.075-.03*sin(t*pi)
  uv('BB gathered crimson trim',(x,y,z),(.010,.009,.017),red)
# Central codpiece panel and front lacing, its silhouette cleanly joined into waist.
rows=[]
for z,w,y in [(1.184,.083,-.15),(1.10,.087,-.176),(1.01,.075,-.181),(.92,.050,-.176),(.855,.020,-.15)]:rows.append([(-w,y+.018,z),(0,y,z-.006),(w,y+.018,z)])
panel('BB central black trouser panel',rows,leather,2,.006)
for s in [-1,1]:line('BB codpiece crimson binding',[(s*w,y+.01,z) for z,w,y in [(1.184,.083,-.15),(1.10,.087,-.176),(1.01,.075,-.181),(.92,.05,-.176),(.855,.02,-.15)]],.007,red)
# Four layered waist straps, broad flat leather rather than round spaghetti.
for k in range(4):
 z=1.18-k*.046
 loft('BB layered waist belt %d'%k,[(0,-.035,z-.012,.196+k*.013,.137+k*.008),(0,-.035,z+.013,.196+k*.013,.137+k*.008)],leather,48,1)
 for s in [-1,1]:
  x=s*(.075+k*.012);y=-.175-k*.002
  # metal eyelets and crossing ivory laces
  pts=[(x+.009*cos(a),y-.003,z+.009*sin(a)) for a in [j*2*pi/16 for j in range(17)]];line('BB silver lace eyelet',pts,.002,edge)
 if k<3:
  w=.075+k*.012;wn=.075+(k+1)*.012
  line('BB crossed waist lace',[(-w,-.187,z),(0,-.196,z-.023),(wn,-.19,z-.046)],.0037,wrap)
  line('BB crossed waist lace',[(w,-.19,z),(0,-.200,z-.023),(-wn,-.191,z-.046)],.0037,wrap)
# Two deliberate draped chains: each oval aligns to the catenary tangent; alternating planes interlock.
for side in [-1,1]:
 def path(t):return Vector((side*(.047+.220*t),-.208+.065*t*t,1.10-.11*sin(pi*t)))
 for k in range(13):
  t=k/12;c=path(t);tangent=(path(min(1,t+.02))-path(max(0,t-.02))).normalized()
  normal=Vector((0,-1,0));cross=tangent.cross(normal).normalized()
  if k%2:cross=normal
  pts=[c+tangent*(.021*cos(a))+cross*(.012*sin(a)) for a in [2*pi*j/20 for j in range(21)]]
  line('BB draped interlocked waist chain',pts,.0034,steel)
# Boot shafts, foot volumes, soles and pointed armored toes.
for s in [-1,1]:
 x=s*.200
 bootstart=set(bpy.data.objects)
 loft('BB fitted boot shaft '+str(s),[(x,.015,.10,.072,.080),(x,.01,.16,.075,.077),(x,.015,.30,.085,.09),(x,.015,.45,.092,.102),(x,.01,.575,.092,.104),(x,.01,.60,.093,.105)],leather,40,2,.002)
 loft('BB boot foot leather '+str(s),[(x,-.073,.023,.086,.169),(x,-.073,.034,.091,.175),(x,-.066,.075,.091,.167),(x,-.045,.125,.078,.135),(x,.005,.172,.071,.084)],leather,40,2)
 loft('BB heavy sole '+str(s),[(x,-.074,.014,.091,.176),(x,-.074,.022,.094,.179),(x,-.074,.040,.094,.179)],black,40,1)
 # articulated toe plate with long pointed front
 plate('BB pointed silver toe '+str(s),[(x-.085,-.16,.078),(x-.07,-.246,.065),(x+s*.025,-.31,.10),(x+.079,-.22,.075),(x+.085,-.15,.09),(x,-.125,.126)],steel,.012,.003)
 line('BB toe armor centre ridge',[(x+s*.025,-.31,.102),(x,-.215,.104),(x,-.135,.13)],.002,edge)
 # fur bands are layers of small angular tufts around circumference
 for z,rx,ry in [(.155,.084,.10),(.586,.106,.116)]:
  loft('BB fur band support',[(x,.01,z-.025,rx,ry),(x,.01,z+.024,rx,ry)],fur,40,1)
  for k in range(38):
   a=2*pi*k/38;d=random.uniform(.013,.023);cx=x+rx*cos(a);cy=.01+ry*sin(a)
   v=[(cx-.010*cos(a+.6),cy-.01*sin(a+.6),z+.02),(cx+.010*cos(a+.6),cy+.01*sin(a+.6),z+.018),(cx+.007*cos(a),cy+.007*sin(a),z-d)]
   o=mesh('BB irregular fur tuft',v,[(0,1,2)],fur);mo=o.modifiers.new('Tuft thickness','SOLIDIFY');mo.thickness=.002
 # flat criss-cross cloth wraps; spiral band as a 2-column strip
 for phase in [0,pi]:
  rows=[]
  for j in range(49):
   t=j/48;a=phase+2*pi*1.65*t;z=.20+.34*t;rx=.080+.015*t;ry=.091+.014*t
   rows.append([(x+rx*cos(a),.01+ry*sin(a),z-.010),(x+rx*cos(a),.01+ry*sin(a),z+.010)])
  panel('BB diagonal linen boot binding',rows,wrap,1,.002)
 # asymmetrical angular knee guard from reference, 3D folded central ridge
 c=x;z=.61
 outline=[(c-.10,-.09,z+.12),(c-.035,-.15,z+.17),(c+.087,-.105,z+.10),(c+.094,-.12,z-.025),(c+.025,-.18,z-.12),(c-.07,-.14,z-.065)]
 if s<0:outline=[(xx,yy,zz+(.02 if xx<c else 0)) for xx,yy,zz in outline]
 plate('BB angular knee shell '+str(s),outline,steel,.012,.003)
 inner=[(c-.061,-.156,z+.09),(c-.023,-.18,z+.117),(c+.05,-.155,z+.065),(c+.05,-.17,z-.015),(c+.018,-.199,z-.067),(c-.04,-.175,z-.035)]
 plate('BB dark knee inset '+str(s),inner,black,.003,.001)
 line('BB knee crimson enamel edge',inner+[inner[0]],.0025,red)
 line('BB silver knee ridge',[(c-.02,-.188,z+.12),(c+.003,-.206,z+.01),(c+.022,-.201,z-.075)],.003,edge)
 # Align foot/tibia surfaces; foot points outward with the real authored foot.
 for o in set(bpy.data.objects)-bootstart:
  def fit(p):
   if p.z<.18:
    a=s*.30;dx=p.x-x;dy=p.y-.014;p.x=x+dx*cos(a)-dy*sin(a);p.y=.014+dx*sin(a)+dy*cos(a)
   else:p.x+=s*(-.012)*min(1,(p.z-.18)/.40)
  if o.type=='MESH':
   for v in o.data.vertices:fit(v.co)
  elif o.type=='CURVE':
   for spl in o.data.splines:
    for p in spl.bezier_points:fit(p.co);fit(p.handle_left);fit(p.handle_right)

# Align all boot geometry around the actual A-pose foot axis. Existing body will be culled under clothes after weighting.
for o in set(bpy.data.objects)-bootstart:
 pass
# Shoulder harness follows a fitted top arch, with two distinct flat silver rails.
for s in [-1,1]:
 for k in range(2):
  xc=s*(.185+k*.055)
  rows=[]
  for j in range(17):
   t=j/16;a=-pi/2+pi*t;yy=-.112*cos(pi*t);zz=1.595+.082*sin(pi*t)-.02*k
   rows.append([(xc-s*.020,yy,zz),(xc+s*.020,yy,zz-.005)])
  o=panel('BB silver shoulder harness rail',rows,steel,2,.009)
  line('BB harness polished edge',[r[0] for r in rows],.0022,edge);line('BB harness polished edge',[r[-1] for r in rows],.0022,edge)
 # angular chest-facing endplate
 c=s*.22
 outline=[(c-s*.055,-.119,1.61),(c+s*.045,-.116,1.595),(c+s*.057,-.12,1.55),(c+s*.025,-.145,1.56),(c+s*.012,-.154,1.522),(c-s*.015,-.147,1.555),(c-s*.048,-.14,1.54)]
 plate('BB pointed harness front plaque',outline,steel,.011,.002)
 # inset dark slots and gold fasteners
 for k in range(2):
  uv('BB harness rivet',(c+s*(k-.5)*.044,-.145,1.585),(.005,.002,.005),edge)
 # outer shoulder down-strap, rests over deltoid
 #panel('BB deltoid silver band', [[(s*.275,-.082,1.59),(s*.31,-.06,1.57)],[(s*.315,-.065,1.54),(s*.342,-.04,1.515)],[(s*.332,-.04,1.49),(s*.36,-.02,1.47)]],steel,1,.008)
for o in bpy.data.objects:
 if 'knee' in o.name:o.location.y-=.030
# Chest hair: slender matte strokes grounded on torso, not thick bars.
body=bpy.data.objects['BB - authored anatomical body'];bpy.context.view_layer.update()
for k in range(100):
 x=random.uniform(-.095,.095);z=random.uniform(1.40,1.58)
 if abs(x)>.095*(.4+.6*(z-1.4)/.18):continue
 hit,loc,n,idx=body.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
 if hit:
  y=loc.y-.001
  line('BB fine chest hair',[(x,y,z),(x*.96,y-.0007,z-.008),(x*.90,y,z-.014)],.00045,bpy.data.materials['BB near black hair'])
# Add wrist armor and glove shells after exact rig wrist alignment in integration pass.
scene=bpy.context.scene;cam=scene.camera
scene.render.resolution_x=1100;scene.render.resolution_y=1300;scene.cycles.samples=80
cam.location=(3,-7,3.1);cam.rotation_euler=(Vector((0,0,1.05))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.40
# Studio floor
floor=mat('BB studio floor',(.038,.047,.06),0,.8);bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.009));bpy.context.object.name='Studio floor';bpy.context.object.data.materials.append(floor)
scene['status']='Reference outfit checkpoint, before rig and finishing'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/outfit.blend');scene.render.filepath=ROOT+'/previews/outfit_threequarter.png';# intermediate render disabled; integrate first
