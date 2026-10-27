import bpy,math,os,random
from mathutils import Vector
from math import sin,cos,pi,exp
random.seed(95)
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/anatomy_base.blend',load_ui=False,use_scripts=False)
body=bpy.data.objects['BB - authored anatomical body'];bpy.context.view_layer.objects.active=body
for m in list(body.modifiers):bpy.ops.object.modifier_apply(modifier=m.name)
def G(x,c,w):return exp(-((x-c)/w)**2)
# Broad muscular adult build. Keep authored topology and smooth region falloffs.
for v in body.data.vertices:
 x,y,z=v.co;ax=abs(x)
 # widened clavicles/chest and arms; narrow midsection stays intact
 widen=.20*G(z,1.55,.21)
 v.co.x=x*(1+widen)
 v.co.y=y*(1+.12*G(z,1.50,.22))
 # integrated pectoral and rectus volume, controlled front/back surface weighting
 front=max(0,min(1,(-y+.005)/.09))
 if ax<.23 and 1.12<z<1.66:
  pec=.014*G(ax,.13,.09)*G(z,1.50,.085)
  absvol=sum(.022*G(ax,.049,.038)*G(z,zz,.032) for zz in [1.21,1.29,1.37])
  v.co.y-=front*(pec+absvol)
 # neck and jaw thicker and stronger, not stretched
 v.co.x*=1+.14*G(z,1.72,.075)
 # wider grin and cheek structure
 if z>1.68 and y<-.07:
  mouth=G(z,1.769,.028)*G(ax,0,.068)
  v.co.x*=1+.44*mouth
  # lips separate naturally using the existing mouth cavity
  if z<1.7728:
   v.co.z-=.008*G(z,1.771,.030)*exp(-(ax/.049)**6)
  else:v.co.z+=.0035*G(z,1.775,.010)*G(ax,0,.052)
  v.co.z+=.013*G(ax,.044,.026)*G(z,1.773,.041)
  # Integrated heavy brow planes and smiling cheek lift.
  v.co.y-=.006*G(ax,.037,.035)*G(z,1.884,.012)
  v.co.z-=.003*G(ax,.02,.015)*G(z,1.884,.015)
  # nose tip and bridge more angular/projecting, no separate wedge
  v.co.y-=.022*G(x,0,.018)*G(z,1.807,.025)
  v.co.x*=1-.09*G(z,1.810,.017)*G(x,0,.030)
  # subtle raised cheek expression
  v.co.y-=.004*G(ax,.055,.02)*G(z,1.806,.023)
  # mildly enlarge existing integrated eye opening
  for s in [-1,1]:
   w=G(x,s*.039,.025)*G(z,1.858,.020)
   v.co.x+=(x-s*.039)*.16*w;v.co.z-=(z-1.858)*.38*w
   v.co.z+=.0015*G(x,s*.059,.011)*G(z,1.86,.013)
# rich matte colors; no procedural shader dependency in export
skin=body.data.materials[0];skin.diffuse_color=(.37,.185,.085,1);p=skin.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=skin.diffuse_color;p.inputs['Roughness'].default_value=.7;p.inputs['Specular IOR Level'].default_value=.18
# utils

def mat(n,c,metal=0,rough=.5):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
hair=mat('BB near black hair',(.009,.007,.006),0,.82);hair.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.10;ridge=mat('BB warm hair ridges',(.019,.014,.011),0,.7)
ivory=mat('BB warm tooth enamel',(.68,.61,.48),0,.4);mouthmat=mat('BB mouth interior',(.035,.009,.007),0,.85)
iris=mat('BB dark amber iris',(.10,.043,.013),0,.47);pupil=mat('BB deep pupil',(.002,.002,.002),0,.34);glint=mat('BB eye glint',(.9,.85,.72),0,.1)
def mesh(n,v,f,m,sub=0):
 me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);o.data.materials.append(m)
 for p in me.polygons:p.use_smooth=True
 if sub:mo=o.modifiers.new('Surface finish','SUBSURF');mo.levels=sub
 return o

def uv(n,loc,scale,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=loc);o=bpy.context.object;o.name=n;o.scale=scale;o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return o

def line(n,pts,r,m):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=8;c.bevel_depth=r;c.bevel_resolution=2;sp=c.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for b,p in zip(sp.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);o.data.materials.append(m);return o

def lock(n,pts,ws,ds,m):
 # flattened leaf/strand geometry with 6 cross-section vertices and sharp end
 N=8;v=[]
 for k,p in enumerate(pts):
  p=Vector(p);t=(Vector(pts[min(k+1,len(pts)-1)])-Vector(pts[max(0,k-1)])).normalized();normal=Vector((p.x*.5,-1,.15)) if p.y<.03 else Vector((p.x*.7,1,.15))
  u=t.cross(normal).normalized();w=u.cross(t).normalized()
  for i in range(N):
   a=2*pi*i/N;v.append(p+u*(ws[k]*cos(a))+w*(ds[k]*sin(a)))
 f=[(k*N+i,k*N+(i+1)%N,(k+1)*N+(i+1)%N,(k+1)*N+i) for k in range(len(pts)-1) for i in range(N)];f +=[tuple(reversed(range(N))),tuple((len(pts)-1)*N+i for i in range(N))]
 o=mesh(n,v,f,m,1)
 layer=o.data.uv_layers.new(name='Hair flow UV')
 for poly in o.data.polygons:
  for li in poly.loop_indices:
   vi=o.data.loops[li].vertex_index;layer.data[li].uv=((vi%N)/N,(vi//N)/max(1,len(pts)-1))
 return o
# Correctly placed source eyeballs; enlarge subtly but retain socket seating.
for o in [o for o in bpy.data.objects if '.eye.' in o.name]:
 center=sum((v.co for v in o.data.vertices),Vector())/len(o.data.vertices)
 for v in o.data.vertices:v.co=center+(v.co-center)*1.10
 s=1 if center.x>0 else -1
 # Iris on anterior globe, not floating outside the eyelids.
 uv('BB iris '+str(s),(center.x,-.159,center.z),(.0064,.0016,.0078),iris)
 uv('BB pupil '+str(s),(center.x,-.1605,center.z),(.0036,.001,.0042),pupil)
 uv('BB catchlight '+str(s),(center.x-.0024,-.1615,center.z+.0026),(.0016,.0006,.0016),glint)
for side in [-1,1]:
 line('BB fine upper lash definition',[(side*.018,-.160,1.858),(side*.033,-.166,1.863),(side*.049,-.163,1.864),(side*.062,-.151,1.860)],.00075,hair)
for o in [o for o in bpy.data.objects if '.eye.' in o.name]:
 m=o.data.materials[0];m.diffuse_color=(.84,.81,.73,1);m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=m.diffuse_color
# Broad stylized upper tooth arcade, a coherent curved band rather than floating individual teeth.
rows=[]
for i in range(17):
 x=-.056+.112*i/16;t=abs(x)/.056;y=-.182+.024*t*t
 rows.append([(x,y,1.783+.008*t*t),(x,y-.001,1.762+.014*t*t)])
verts=[p for row in rows for p in row];faces=[(i*2,i*2+1,(i+1)*2+1,(i+1)*2) for i in range(16)]
o=mesh('BB broad upper tooth arcade',verts,faces,ivory,1);mo=o.modifiers.new('Tooth thickness','SOLIDIFY');mo.thickness=.003
# Tiny tooth separation only at bottom edge; never giant black gaps.
for x in [-.034,-.025,-.016,-.008,0,.008,.016,.025,.034]:
 t=abs(x)/.056;y=-.181+.024*t*t;z=1.762+.014*t*t
 line('BB fine tooth division',[(x,y,z),(x,y,z+.003)],.00016,mouthmat)
# Eyebrows are flat thin clumps conforming to authored brow ridge.
for s in [-1,1]:
 lock('BB angled brow',[(s*.014,-.179,1.872),(s*.032,-.182,1.883),(s*.053,-.175,1.891),(s*.071,-.149,1.888)],[.001,.006,.005,.0002],[.0008,.0017,.0014,.0001],hair)
# Body raycast: surface-anchored hair roots instead of geometry floating in front of face.
bpy.context.view_layer.update()
def front_surface(x,z):
 hit,loc,n,idx=body.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
 return loc.y if hit else -.10
# Tight scalp support extracted directly from head topology, anatomically fitted.
verts=[];faces=[];remap={}
for poly in body.data.polygons:
 ids=list(poly.vertices);good=True
 for idx in ids:
  v=body.data.vertices[idx].co;x,y,z=v
  boundary=1.938 if y<-.04 else 1.86
  if z<boundary:good=False;break
 if good:
  new=[]
  for idx in ids:
   if idx not in remap:
    remap[idx]=len(verts);v=body.data.vertices[idx];verts.append(v.co+v.normal*.0017)
   new.append(remap[idx])
  faces.append(new)
mesh('BB close fitting hair root cap',verts,faces,hair)
# Hand-directed, asymmetric silhouette guides: diagonal flow, broken forehead exposure.
# Large forms carry the silhouette; strand texture supplies small detail.
front_guides=[
 [(-.074,.006,2.003),(-.093,-.060,1.995),(-.108,-.125,1.954),(-.092,-.161,1.913)],
 [(-.041,.002,2.014),(-.070,-.061,2.002),(-.069,-.132,1.974),(-.036,-.168,1.942)],
 [(-.005,.007,2.017),(-.027,-.062,2.006),(-.020,-.141,1.967),(.012,-.170,1.906)],
 [(.038,.017,2.013),(.020,-.053,2.006),(.013,-.130,1.983),(.045,-.163,1.948)],
 [(.072,.018,1.997),(.057,-.045,1.996),(.064,-.116,1.968),(.082,-.150,1.918)],
 [(-.084,.025,1.978),(-.108,-.017,1.961),(-.124,-.074,1.926),(-.119,-.103,1.868)],
 [(.087,.025,1.982),(.111,-.014,1.960),(.123,-.066,1.937),(.119,-.097,1.879)],
]
for k,pts in enumerate(front_guides):
 w=[.021,.028,.027,.024,.022,.020,.022][k]
 lock('BB asymmetric swept bang %02d'%k,pts,[w*.42,w,w*.76,.0001],[.002,.0045,.003,.0001],hair)
# Offset crown patches overlap smoothly, with individual tips pointing diagonally out/back.
for k in range(11):
 a=.12+k*(2*pi/11);x=.076*cos(a);y=.03+.069*sin(a)
 pts=[(x*.4,y*.3,2.004),(x*.85,y*.8,2.014-random.uniform(0,.013)),(x*1.27,y*1.28,1.972),(x*1.44+random.uniform(-.012,.012),y*1.35,1.935-random.uniform(0,.025))]
 lock('BB broken crown sweep',pts,[.010,.026,.019,.0001],[.002,.0045,.003,.0001],hair)
for side in [-1,1]:
 for k in range(6):
  t=k/5;y=-.032+.13*t;z=1.948-random.uniform(0,.02)
  pts=[(side*.082,y*.80,z),(side*.105,y,z-.018),(side*(.13+random.uniform(-.008,.008)),y+.008,z-.045),(side*(.115+random.uniform(-.012,.018)),y+.024,z-.084-random.uniform(0,.03))]
  lock('BB wild temple silhouette',pts,[.012,.022,.016,.0001],[.002,.004,.003,.0001],hair)
 for k in range(5):
  y=.07+k*.009;x=side*(.018+.016*k)
  lock('BB ragged nape fan',[(x,y,1.913),(x+side*.017,y+.018,1.86),(x+side*.029,y+.025,1.81),(x+side*.024,y+.022,1.772+random.uniform(-.006,.016))],[.012,.021,.015,.0001],[.002,.004,.003,.0001],hair)
lock('BB signature stray lock',[(-.025,.005,1.99),(-.040,-.005,2.032),(-.023,-.018,2.06),(.035,-.02,2.045)],[.004,.004,.0025,.0001],[.0015,.002,.001,.0001],hair)
# Continuous shaped beard mass follows the real jaw, then tapers into a pointed goatee.
# A curved boundary and irregular fine directional ridges avoid rectangular pasted-on side panels.
def beard_point(u,t):
 x=u*(.085*(1-t)+.050*t)
 ztop=1.738+.032*abs(u)**1.4
 zbottom=1.650+.068*abs(u)**1.4+.0035*sin(u*61)
 z=ztop*(1-t)+zbottom*t
 ytop=front_surface(u*.085,ztop)-.003
 ybottom=-.126+.039*abs(u)
 y=ytop*(1-t)+ybottom*t-.012*sin(pi*t)
 return Vector((x,y,z))
N=49;T=15;vv=[]
for j in range(T):
 t=j/(T-1)
 for i in range(N):
  u=-1+2*i/(N-1);pnt=beard_point(u,t)
  pnt.y-=.0007*sin(u*95+t*3)*sin(pi*t)
  vv.append(pnt)
ff=[(j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i) for j in range(T-1) for i in range(N-1)]
o=mesh('BB full tapered jaw beard',vv,ff,hair,1);mo=o.modifiers.new('Beard volume','SOLIDIFY');mo.thickness=.006
uvl=o.data.uv_layers.new(name='Hair flow UV')
for poly in o.data.polygons:
 for li in poly.loop_indices:
  vi=o.data.loops[li].vertex_index;uvl.data[li].uv=((vi%N)/(N-1),(vi//N)/(T-1))
for i in range(61):
 u=-.98+1.96*i/60
 pts=[beard_point(u+random.uniform(-.003,.003),t)+Vector((0,-.0015,0)) for t in [.02,.25,.5,.75,.98]]
 line('BB fine directional beard ridge',pts,.00065,ridge)
for i in range(35):
 u=-.95+1.90*i/34;p0=beard_point(u,.70);p1=beard_point(u,.93);p2=beard_point(u,1)+Vector((random.uniform(-.002,.002),0,-random.uniform(.002,.008)))
 lock('BB ragged beard tip',[p0,p1,p2],[.0018,.0024,.0001],[.0006,.0009,.0001],hair)
# Narrow fitted sideburn ribbons join scalp to jaw beard without square cheek panels.
for side in [-1,1]:
 vv=[];N=7;T=15
 for j in range(T):
  t=j/(T-1);z=1.855-.088*t;xc=side*(.087-.005*t);width=.005+.004*sin(pi*t*.8)
  for i in range(N):
   a=-1+2*i/(N-1);x=xc+a*width;y=front_surface(x,z)-.0015-.0015*(1-a*a)
   vv.append((x,y,z))
 ff=[(j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i) for j in range(T-1) for i in range(N-1)]
 ob=mesh('BB tapered sideburn transition',vv,ff,hair,1)
 bpy.context.view_layer.objects.active=ob
 for mod in list(ob.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 for v in ob.data.vertices:v.co.y=front_surface(v.co.x,v.co.z)-.0035
 layer=ob.data.uv_layers.new(name='Hair flow UV')
 for poly in ob.data.polygons:
  for li in poly.loop_indices:
   vi=ob.data.loops[li].vertex_index;v=ob.data.vertices[vi].co;layer.data[li].uv=((v.x-side*.082)/.018,(v.z-1.767)/.088)
 for k in range(8):
  x=side*(.083+random.uniform(-.004,.004));z=1.77+random.uniform(0,.012);y=front_surface(x,z)-.002
  lock('BB sideburn lower tip',[(x,y,z),(x,y-.002,z-.012),(x-side*.002,y,z-.024)],[.0015,.0023,.0001],[.0005,.0008,.0001],hair)
# Moustache angled strands, not sausage shapes.
for side in [-1,1]:
 for k in range(16):
  t=k/15;x=side*(.004+.034*t);z=1.791-.009*t;y=front_surface(x,z)-.002
  lock('BB moustache strand',[(x,y,z),(x+side*.006,y-.003,z-.005),(x+side*.012,y-.001,z-.012)],[.0012,.002,.0001],[.0006,.0009,.0001],hair)
# Vertex color beard roots/stubble and subtle skin tonal structure, runtime-exportable.
attr=body.data.color_attributes.new(name='CaptainSkin',type='FLOAT_COLOR',domain='CORNER')
for poly in body.data.polygons:
 for li in poly.loop_indices:
  v=body.data.vertices[body.data.loops[li].vertex_index];x,y,z=v.co;ax=abs(x)
  base=Vector((.37,.185,.085))
  if 1.688<z<1.866 and y<-.045:
   beard=max(0,min(1,(1.752-z)/.020))
   # Sideburn color is carried by fitted hair ribbon, not painted square skin patches.
   if z<1.708:beard*=max(0,(z-1.688)/.020)
   if y>-.075:beard*=max(0,(-y-.045)/.03)
   base=base.lerp(Vector((.009,.006,.004)),min(1,beard))
  attr.data[li].color=(*base,1)
nd=skin.node_tree.nodes.new('ShaderNodeVertexColor');nd.layer_name='CaptainSkin';skin.node_tree.links.new(nd.outputs['Color'],p.inputs['Base Color'])
# Original strand-flow albedo texture; no external photograph or AI image.
import numpy as np
W=512;xx,yy=np.meshgrid(np.arange(W)/W,np.arange(W)/W)
wave=np.sin((xx*43+.17*np.sin(yy*5))*2*pi)*.010+np.sin(xx*123*2*pi)*.004
shade=.055+wave*.7+.016*np.exp(-((xx-.36-.025*np.sin(yy*4))/.12)**2)
arr=np.stack([shade,shade*.88,shade*.76,np.ones_like(shade)],axis=-1).astype('float32')
im=bpy.data.images.new('BB original dark hair flow',W,W);im.pixels.foreach_set(arr.ravel());im.filepath_raw=ROOT+'/textures/hair_flow.png';im.file_format='PNG';im.save();im.pack()
nd=hair.node_tree.nodes.new('ShaderNodeTexImage');nd.image=im;hair.node_tree.links.new(nd.outputs['Color'],hair.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
# Clay anatomy + final facial hair checkpoint.
scene=bpy.context.scene;cam=scene.camera
scene.render.resolution_x=1100;scene.render.resolution_y=1200;scene.cycles.samples=80
cam.location=(.8,-3,1.95);cam.rotation_euler=(Vector((0,-.05,1.82))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.56
scene['status']='Blackbeard authored-base facial and anatomy checkpoint; not final'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/character_form.blend')
scene.render.filepath=ROOT+'/previews/form_face.png';bpy.ops.render.render(write_still=True) if not os.environ.get('BB_BUILD_ONLY') else None
# skip torso render for facial art gate
exit()
cam.location=(1,-3,1.9);cam.rotation_euler=(Vector((0,0,1.5))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=1.15;scene.render.filepath=ROOT+'/previews/form_torso.png';bpy.ops.render.render(write_still=True) if not os.environ.get('BB_BUILD_ONLY') else None
