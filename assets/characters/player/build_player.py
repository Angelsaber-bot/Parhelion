"""Original authored fan-character surfaces. FGO Fujimaru visual reference; no imported mesh.
Model coordinates are game X/right Y/up Z/front, converted to Blender Z/up.
"""
import bpy, bmesh, math, json, os, sys
from mathutils import Vector
from math import sin,cos,pi,exp
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../..'))
OUT=os.path.join(ROOT,'assets/characters/player')
REVIEW=os.path.join(os.path.dirname(ROOT),'protagonist-review/player')
os.makedirs(REVIEW,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
MATS={}
def mat(name,h,rough=.75,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*h,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*h,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 MATS[name]=m;return m
mat('Skin',(0.82,.57,.40));mat('SkinLight',(.91,.69,.51));mat('SkinShadow',(.60,.35,.26));mat('Lip',(.36,.16,.13));mat('Hair',(.021,.014,.012));mat('HairRidge',(.033,.021,.017));mat('EyeWhite',(.88,.88,.83));mat('Lash',(.017,.014,.018));mat('Iris',(.025,.30,.40));mat('IrisLight',(.04,.52,.62));mat('Pupil',(.008,.034,.045));mat('Highlight',(1,1,1));mat('Uniform',(.82,.84,.85));mat('UniformLight',(.94,.94,.92));mat('Seam',(.31,.34,.37));mat('Trousers',(.045,.052,.064));mat('Leather',(.027,.031,.036),.58);mat('Gold',(.58,.36,.08),.32,.65);mat('Steel',(.24,.26,.29),.3,.6)
def cv(p):return (p[0],-p[2],p[1])
JOINTS={}; PARTS=[]; FACE_OBJ=None
def joint(n,parent,p):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.empty_display_size=.025;o.location=cv(p)
 if parent:o.parent=JOINTS[parent]
 JOINTS[n]=o;return o
joint('Explorer',None,(0,0,0));joint('Hips','Explorer',(0,.92,0));joint('Spine','Hips',(0,.10,0));joint('Head','Spine',(0,.56,.01))
for n,p,xyz in [('CoatTails','Hips',(0,.06,0)),('ScarfTail','Spine',(.06,.46,-.10)),('Ponytail','Head',(0,.2,-.13)),('Glider','Spine',(0,.36,-.24))]:joint(n,p,xyz)
for s in [-1,1]:
 side='L' if s<0 else 'R';joint('Arm_'+side,'Spine',(.235*s,.42,0));joint('Forearm_'+side,'Arm_'+side,(0,-.27,0));joint('Thigh_'+side,'Hips',(.09*s,-.06,0));joint('Shin_'+side,'Thigh_'+side,(0,-.42,0))
def mesh(n,v,f,material='Skin',j='Head',smooth=True):
 if FACE_OBJ is not None and (n.startswith(('Almond','Iris','Pupil','Eye glint','Upper eyelid','Lower eyelid','Eyebrow','Mouth','Lower lip','Nose underside'))):
  vv=[]
  for x,y,z in v:
   hit,loc,normal,index=FACE_OBJ.ray_cast(Vector(cv((x,y,1))),Vector(cv((0,0,-1))))
   off=.0012
   if n.startswith('Iris rim'):off=.0020
   elif n.startswith('Iris teal'):off=.0025
   elif n.startswith('Iris lower'):off=.0030
   elif n.startswith('Pupil'):off=.0035
   elif n.startswith('Eye glint'):off=.0040
   vv.append((x,y,-loc.y+off) if hit else (x,y,z))
  v=vv
 me=bpy.data.meshes.new(n);me.from_pydata([cv(p) for p in v],[],f);me.materials.append(MATS[material]);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);o.parent=JOINTS[j]
 for p in me.polygons:p.use_smooth=smooth
 PARTS.append((o,j,material));return o

def rings(n,levels,material,j='Head',segments=48,warp=None):
 # each level: height, width, depth, z centre; authored anatomical/clothing profiles
 v=[];f=[]
 for i,(y,w,d,z) in enumerate(levels):
  for k in range(segments):
   a=2*pi*k/segments;x=w*sin(a);zz=z+d*cos(a)
   if warp:x,y1,zz=warp(x,y,zz,a,i)
   else:y1=y
   v.append((x,y1,zz))
 for i in range(len(levels)-1):
  for k in range(segments):
   a=i*segments+k;b=i*segments+(k+1)%segments;f.append((a,b,b+segments,a+segments))
 f+=[tuple(reversed(range(segments))),tuple((len(levels)-1)*segments+k for k in range(segments))]
 return mesh(n,v,f,material,j)
def tube(n,path,r,material,j='Head',sides=7):
 v=[];f=[]
 for i,p in enumerate(path):
  tang=Vector(path[min(i+1,len(path)-1)])-Vector(path[max(0,i-1)]);tang.normalize();a=tang.cross(Vector((0,0,1)))
  if a.length<.01:a=tang.cross(Vector((0,1,0)))
  a.normalize();b=tang.cross(a).normalized();rr=r[i] if isinstance(r,list) else r
  for k in range(sides):v.append(tuple(Vector(p)+rr*(cos(2*pi*k/sides)*a+sin(2*pi*k/sides)*b)))
 for i in range(len(path)-1):
  for k in range(sides):a=i*sides+k;b=i*sides+(k+1)%sides;f.append((a,b,b+sides,a+sides))
 return mesh(n,v,f,material,j)
def bezier(ps,t):return tuple((1-t)**3*ps[0][k]+3*t*(1-t)**2*ps[1][k]+3*t*t*(1-t)*ps[2][k]+t**3*ps[3][k] for k in range(3))
def line(n,ps,r,material,j='Head',steps=18):return tube(n,[bezier(ps,i/steps) for i in range(steps+1)],r,material,j)
def oval(n,c,rx,ry,material,j='Head',depth=.003,steps=32):
 v=[(c[0],c[1],c[2]+depth)];f=[]
 for k in range(steps):a=k*2*pi/steps;v.append((c[0]+rx*cos(a),c[1]+ry*sin(a),c[2]))
 for k in range(steps):f.append((0,k+1,(k+1)%steps+1))
 return mesh(n,v,f,material,j)
# Jaw->temple->cranium rings sculpt a continuous head. Front has nose ridge, cheeks and eye sockets.
levels=[(-.025,.004,.010,.041),(-.014,.034,.038,.025),(0,.055,.061,.012),(.025,.072,.077,.001),(.05,.089,.089,-.002),(.065,.097,.094,-.004),(.08,.102,.097,-.005),(.095,.108,.101,-.0065),(.11,.113,.104,-.008),(.125,.114,.106,-.008),(.14,.115,.107,-.008),(.17,.116,.109,-.01),(.20,.112,.106,-.014),(.23,.095,.095,-.018),(.25,.066,.072,-.02),(.265,.012,.017,-.02)]
def facewarp(x,y,z,a,i):
 front=max(0,cos(a))**10
 if cos(a)>0:
  yy,ww,dd,zz=levels[i];z=zz+dd*(max(0,1-(abs(x)/max(ww,.001))**3.3))**(1/3.3)
 z+=front*(.025*exp(-((x/.016)**2)-((y-.077)/.020)**2)+.013*exp(-(x/.015)**2-((y-.110)/.038)**2))
 z-=front*.004*exp(-((abs(x)-.052)/.03)**2-((y-.13)/.023)**2)
 return x,y,z
head=rings('Face | continuous jaw cheek nose topology',levels,'SkinLight',segments=64,warp=facewarp)
# smooth subdiv once (editable cage retained in source)
mod=head.modifiers.new('Facial surface refinement','SUBSURF');mod.levels=1;mod.render_levels=1
bpy.context.view_layer.update();FACE_OBJ=head.evaluated_get(bpy.context.evaluated_depsgraph_get())
rings('Neck anatomical taper',[(-.10,.038,.036,-.006),(-.06,.040,.035,-.007),(-.025,.043,.038,-.006),(.015,.044,.039,-.006)],'Skin',segments=32)
# ears have distinct helix and concha contours, no floating spheres
for s in [-1,1]:
 ear=[(s*(.106+.024*sin(pi*i/16)),.066+.063*i/16,.005+.006*sin(pi*i/16)) for i in range(17)]
 tube('Ear helix '+str(s),ear,[.006+.002*sin(pi*i/16) for i in range(17)],'SkinLight',sides=8)
 line('Ear concha '+str(s),[(s*.117,.079,.010),(s*.125,.082,.017),(s*.125,.112,.016),(s*.116,.119,.012)],.003,'SkinShadow')
# almond-shaped sclera, restrained masculine eyes, faceted limbal rings; slight upward outer corner
for s in [-1,1]:
 cx=.050*s;cy=.125;cz=.099
 v=[(cx,cy,cz+.006)];f=[]
 for k in range(40):
  a=k*2*pi/40;xx=.034*cos(a);yy=.013*sin(a)*(0.85+.15*abs(sin(a)))+.10*s*xx
  v.append((cx+xx,cy+yy,cz-.012*(abs(xx)/.034)**1.5))
 for k in range(40):f.append((0,k+1,(k+1)%40+1))
 mesh('Almond sclera '+str(s),v,f,'EyeWhite')
 oval('Iris rim '+str(s),(cx,cy,.105),.0108,.0124,'Pupil',depth=.001)
 oval('Iris teal '+str(s),(cx,cy-.001,.1062),.0091,.0108,'Iris',depth=.001)
 oval('Iris lower light '+str(s),(cx,cy-.005,.1075),.008,.006,'IrisLight',depth=.0005)
 oval('Pupil '+str(s),(cx,cy+.001,.1082),.0043,.0076,'Pupil',depth=.0005)
 oval('Eye glint '+str(s),(cx-.004,cy+.007,.1095),.0018,.0020,'Highlight',depth=.0002,steps=16)
 line('Upper eyelid '+str(s),[(cx-.034,cy-.003*s,.088),(cx-.018,cy+.015,.103),(cx+.019,cy+.016,.103),(cx+.034,cy+.003*s,.088)],.0021,'Lash')
 line('Lower eyelid '+str(s),[(cx-.032,cy-.002*s,.089),(cx-.015,cy-.015,.102),(cx+.019,cy-.014,.102),(cx+.032,cy+.002*s,.089)],.00045,'SkinShadow')
 line('Eyebrow '+str(s),[(cx-.030,cy+.035-.005*s,.090),(cx-.014,cy+.040-.002*s,.102),(cx+.015,cy+.040+.002*s,.101),(cx+.033,cy+.035+.005*s,.088)],.0025,'Hair')
# subtle mouth, Cupid bow, not a stuck-on block
line('Mouth seam',[(-.022,.029,.086),(-.011,.029,.097),(.012,.028,.097),(.022,.030,.086)],.00085,'Lip')
line('Lower lip light',[(-.012,.021,.091),(-.006,.019,.095),(.006,.019,.095),(.013,.022,.091)],.0006,'Skin')
line('Nose underside',[(-.006,.065,.116),(-.002,.061,.122),(.003,.061,.122),(.008,.065,.114)],.0007,'SkinShadow')
# Continuous sculpted scalp underlying radial, surface-following locks.
v=[];f=[];N=18;K=64
for i in range(N+1):
 t=i/N
 for k in range(K):
  a=2*pi*k/K;low=.083+.092*max(0,cos(a))**2+.023*abs(sin(a))+.010*sin(7*a);y=low+(.288-low)*t
  radial=math.sqrt(max(.0002,1-(max(0,y-.157)/.132)**2))*(1-.8*max(0,.10-y))
  v.append((.126*radial*sin(a),y,-.024+(.119+.023*max(0,cos(a))**4)*radial*cos(a)))
for i in range(N):
 for k in range(K):a=i*K+k;b=i*K+(k+1)%K;f.append((a,b,b+K,a+K))
top=len(v);v.append((0,.290,-.024))
for k in range(K):f.append((N*K+k,N*K+(k+1)%K,top))
mesh('Continuous coiffure foundation',v,f,'Hair')
def lock(n,ps,width,material='Hair',normal=(0,0,1),bulge=.005):
 v=[];f=[];N=16;K=6;norm=Vector(normal).normalized()
 for layer in [0,1]:
  for i in range(N+1):
   t=i/N;c=Vector(bezier(ps,t));tangent=Vector(bezier(ps,min(1,t+.002)))-Vector(bezier(ps,max(0,t-.002)));tangent.normalize()
   axis=Vector((1,0,0)) if abs(norm.z)>.5 else Vector((0,0,1))
   w=width*(1-t)**.85+.00003
   for k in range(K+1):
    u=2*k/K-1;p=c+axis*w*u+norm*(bulge*sin(pi*k/K)*(1-t)**.3 if layer==0 else -.001)
    v.append(tuple(p))
 stride=(N+1)*(K+1)
 for layer in [0,1]:
  for i in range(N):
   for k in range(K):a=layer*stride+i*(K+1)+k;q=(a,a+1,a+K+2,a+K+1);f.append(q if layer==0 else tuple(reversed(q)))
 for i in range(N):
  for k in [0,K]:a=i*(K+1)+k;b=a+K+1;f.append((a,b,b+stride,a+stride))
 for i in [0,N]:
  front=[i*(K+1)+k for k in range(K+1)];f.append(tuple(front+[q+stride for q in reversed(front)]))
 o=mesh(n,v,f,material)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 return o
bangs=[(-.109,.163,.035),(-.066,.142,.024),(-.026,.137,.015),(.026,.160,.031),(.074,.181,.020),(.116,.130,.027)]
for i,(tx,ty,w) in enumerate(bangs):
 x=tx*.85
 lock('Sculpted asymmetric fringe %02d'%i,[(x*.65-.015,.238,-.065),(x-.018,.295,.043),(tx+.018+(.008 if i%2 else -.014),ty+.058,.128),(tx,ty,.113)],w,'HairRidge' if i==1 else 'Hair',bulge=.0012)
# smaller off-axis companion lock creates the deliberately asymmetrical forehead split
lock('Diagonal narrow fringe',[(.012,.240,-.030),(.034,.274,.085),(.027,.185,.137),(-.001,.145,.117)],.012,bulge=.002)
for s in [-1,1]:
 for i in range(3):
  z=.010-i*.050
  lock('Temple overlapping lock %s %s'%(s,i),[(s*.067,.185,z-.008),(s*.119,.220,z+.005),(s*.139,.164-i*.011,z-.006),(s*(.139+.009*i),.139-i*.016,z-.025)],.019,normal=(s,0,.15),bulge=.003)
for i in range(7):
 x=(i-3)*.029
 lock('Nape texture %02d'%i,[(x*.36,.170,-.075),(x,.207,-.118),(x*1.16,.127,-.139),(x*1.20,.087+.009*cos(i),-.143)],.019,normal=(0,0,-1),bulge=.004)
# Four short offset nape tufts break the cropped silhouette without a hair curtain.
for side in [-1,1]:
 for k in range(2):
  lock('Short outward nape tuft %s %s'%(side,k),[(side*.074,.164,-.071),(side*.118,.141,-.085),(side*.138,.097,-.091),(side*(.153-.006*k),.101-.027*k,-.106-.012*k)],.018,normal=(side*.7,0,-.7),bulge=.003)
# Unequal short crown wisps use the same tapered ribbon topology, with broad buried roots.
for i,ps in enumerate([
 [(-.058,.240,-.025),(-.070,.277,-.010),(-.091,.294,-.005),(-.117,.286,-.010)],
 [(-.018,.254,-.039),(-.015,.283,-.032),(-.004,.306,-.030),(.015,.305,-.032)],
 [(.050,.242,-.046),(.072,.273,-.048),(.099,.278,-.052),(.124,.262,-.059)]
]):lock('Short crown wisp '+str(i),ps,.019,normal=(0,0,1),bulge=.0015)
# no decorative giant antenna: keep the natural crown silhouette
# shoulder-to-waist tailored tunic with authored folds and narrow waist
levels=[(0,.147,.097,0),(.04,.152,.103,0),(.10,.151,.103,0),(.16,.147,.100,0),(.22,.161,.105,0),(.29,.179,.106,0),(.36,.197,.107,0),(.41,.205,.105,0),(.44,.185,.090,0),(.47,.075,.054,0)]
def clothwarp(x,y,z,a,i):
 z+=max(0,cos(a))*.003*sin(19*y+abs(x)*23);return x,y,z
rings('Tunic tailored torso',levels,'UniformLight','Spine',segments=48,warp=clothwarp)
# collar, black neck inset, front split zipper and seam piping
rings('Dark high collar',[(.44,.060,.048,0),(.49,.055,.046,0),(.51,.051,.043,0)],'Leather','Spine',32)
for s in [-1,1]:
 mesh('White pointed collar '+str(s),[(s*.008,.505,.047),(s*.053,.505,.021),(s*.083,.455,.067),(s*.033,.428,.107),(s*.006,.478,.060)],[(0,1,2,3,4)],'UniformLight','Spine',False)
 line('Tunic princess seam '+str(s),[(s*.115,.035,.068),(s*.101,.17,.088),(s*.147,.28,.079),(s*.173,.39,.066)],.001,'Seam','Spine')
line('Front zipper',[(0,.03,.108),(0,.18,.109),(0,.34,.109),(0,.452,.065)],.0024,'Seam','Spine')
# horizontal harness mapped to convex chest, sewn edge
line('Chest harness',[(-.178,.365,.061),(-.11,.368,.116),(.11,.368,.116),(.178,.365,.061)],.012,'Leather','Spine',28)
line('Chest harness stitch',[(-.176,.371,.068),(-.10,.375,.124),(.10,.375,.124),(.176,.371,.068)],.0007,'Seam','Spine',28)
# Complete fitted uniform: split tunic skirt, belt furniture, sleeves, bare hands and boots.
def bevelbox(n,c,d,material,j,bevel=.003):
 x,y,z=c;w,h,b=[q/2 for q in d];v=[(x+sx*w,y+sy*h,z+sz*b) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
 o=mesh(n,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],material,j,False)
 mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=2;mod.affect='EDGES'
 return o
rings('Trouser hip block',[(-.13,.139,.084,0),(-.08,.152,.091,0),(.035,.151,.099,0),(.10,.147,.097,0)],'Trousers','Hips',40)
rings('Flexible inner waist overlap',[(.04,.134,.084,0),(.10,.139,.087,0),(.18,.136,.084,0),(.21,.127,.079,0)],'Trousers','Hips',40)
rings('Tailored leather waist belt',[(.048,.157,.111,0),(.057,.159,.112,0),(.092,.155,.108,0),(.100,.153,.107,0)],'Leather','Hips',48)
bevelbox('Buckle recessed plate',(0,.075,.119),(.058,.039,.007),'Leather','Hips',.004)
for x in [-.034,.034]:bevelbox('Gold buckle upright '+str(x),(x,.075,.126),(.007,.045,.006),'Gold','Hips',.002)
for y in [.052,.098]:bevelbox('Gold buckle crossbar '+str(y),(0,y,.126),(.068,.006,.006),'Gold','Hips',.002)
bevelbox('Buckle pin',(.005,.075,.130),(.038,.003,.003),'Steel','Hips',.001)
for s in [-1,1]:
 for a in [.55,2.55]:
  x=s*.157*sin(a);z=.111*cos(a)
  bevelbox('Uniform belt keeper',(x,.074,z),(.012,.060,.009),'Uniform','Hips',.002)
# Front has a V opening. Back and side panels are different shaped, not box tails.
for s in [-1,1]:
 v=[];f=[];ny=7;na=26
 for i in range(ny+1):
  t=i/ny
  for k in range(na+1):
   a=(.025+.20*t)+(pi-(.025+.20*t))*k/na
   w=.160+.031*t;d=.108+.031*t;y=-.020-.205*t+.014*t*cos(2*a)
   fold=.004*t*sin(a*5+.4)
   v.append((s*(w+fold)*sin(a),y,(d+fold)*cos(a)))
 for i in range(ny):
  for k in range(na):a=i*(na+1)+k;face=(a,a+1,a+na+2,a+na+1);f.append(tuple(reversed(face)) if s>0 else face)
 panel=mesh('Split tunic skirt '+str(s),v,f,'UniformLight','CoatTails');mod=panel.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.0025
# geometric crest below throat; silver relief separates from black collar
for s in [-1,1]:
 tube('Collar crest diamond '+str(s),[(0,.478,.058),(s*.013,.464,.073),(0,.447,.083)],.0018,'Steel','Spine',6)
 tube('Chest clasp '+str(s),[(s*.167,.379,.079),(s*.184,.365,.075),(s*.167,.351,.081),(s*.158,.365,.090),(s*.167,.379,.079)],.0025,'Gold','Spine',8)
# Sleeves are profile surfaces with locally authored elbow compression folds.
for s in [-1,1]:
 side='L' if s<0 else 'R';arm='Arm_'+side;fore='Forearm_'+side;thigh='Thigh_'+side;shin='Shin_'+side
 def sleevewarp(x,y,z,a,i):
  fold=.0018*sin(37*y+2*a)+.0014*sin(73*y-a);return x*(1+fold*9),y,z+fold*cos(a)
 rings('Upper sleeve '+side,[(-.287,.046,.042,0),(-.246,.049,.044,0),(-.205,.053,.046,0),(-.135,.057,.048,0),(-.070,.061,.052,0),(-.022,.058,.050,0),(.005,.046,.044,0),(.022,.026,.030,0),(.031,.006,.009,0)],'UniformLight',arm,28,sleevewarp)
 line('Outer sleeve seam '+side,[(s*.052,-.02,0),(s*.065,-.08,0),(s*.053,-.20,0),(s*.046,-.267,0)],.0009,'Seam',arm)
 rings('Forearm sleeve '+side,[(-.239,.037,.032,0),(-.215,.041,.036,0),(-.185,.042,.039,0),(-.145,.045,.041,0),(-.09,.050,.043,0),(-.041,.046,.040,0),(.032,.039,.037,0)],'UniformLight',fore,28,sleevewarp)
 rings('Elbow cloth transition '+side,[(-.042,.026,.028,0),(-.025,.038,.039,0),(0,.044,.043,0),(.025,.037,.037,0),(.042,.012,.015,0)],'UniformLight',fore,24)
 rings('Dark cuff band '+side,[(-.242,.039,.034,0),(-.236,.041,.036,0),(-.218,.043,.038,0),(-.214,.041,.037,0)],'Seam',fore,28)
 rings('White cuff lip '+side,[(-.249,.038,.033,0),(-.242,.041,.036,0),(-.237,.041,.036,0)],'UniformLight',fore,28)
 # Anatomical palm flattened depth, distinct thumb saddle and four curled fingers.
 rings('Bare palm '+side,[(-.309,.024,.018,.002),(-.290,.032,.021,0),(-.269,.034,.021,0),(-.252,.027,.019,0),(-.240,.026,.019,0)],'SkinLight',fore,24)
 for finger in range(4):
  x=(finger-1.5)*.013;length=[.031,.038,.036,.028][finger];start=-.291
  ps=[(x,start,.006),(x,start-length*.70,.013),(x,start-length,.031),(x,start-length*.38,.034)]
  line('Curled finger %s %s'%(side,finger),ps,.0061,'SkinLight',fore,12)
  line('Finger crease %s %s'%(side,finger),[(x-.004,start-length*.78,.028),(x-.002,start-length*.82,.030),(x+.002,start-length*.82,.030),(x+.004,start-length*.78,.028)],.00045,'Skin',fore,6)
 line('Opposing thumb '+side,[(s*.027,-.262,.003),(s*.044,-.276,.017),(s*.027,-.294,.034),(s*.012,-.298,.035)],.008,'SkinLight',fore,16)
 # Subtle hand tendons; no gloves on this uniform.
 for x in [-.012,.012]:line('Hand tendon '+side+str(x),[(x*.5,-.251,-.019),(x,-.269,-.022),(x,-.284,-.022),(x,-.293,-.018)],.0006,'Skin',fore,10)
 if s>0:
  if 'CommandSeal' not in MATS:mat('CommandSeal',(.48,.025,.021))
  for sign in [-1,1]:
   tube('Right hand command seal side '+str(sign),[(sign*.004,-.257,-.021),(sign*.014,-.268,-.023),(sign*.005,-.279,-.023),(sign*.016,-.290,-.020)],.0011,'CommandSeal',fore,5)
  tube('Right hand command seal centre',[(0,-.257,-.021),(0,-.279,-.023),(0,-.296,-.019)],.0012,'CommandSeal',fore,5)
 def pantswarp(x,y,z,a,i):
  pinch=.0028*sin(39*y+2*a)*exp(-((y+.36)/.12)**2);return x+pinch*sin(a),y,z+pinch*cos(a)
 rings('Tailored trouser thigh '+side,[(-.462,.050,.047,.003),(-.441,.057,.052,.002),(-.405,.062,.056,0),(-.360,.060,.058,0),(-.270,.068,.061,0),(-.150,.073,.064,0),(-.04,.078,.070,0),(.025,.076,.065,0)],'Trousers',thigh,28,pantswarp)
 line('Trouser outer seam '+side,[(s*.074,-.02,0),(s*.074,-.16,0),(s*.063,-.32,0),(s*.058,-.423,0)],.00075,'Seam',thigh)
 rings('Tapered trouser calf '+side,[(-.340,.043,.042,0),(-.31,.049,.044,0),(-.270,.048,.045,0),(-.205,.051,.047,0),(-.120,.058,.050,0),(-.040,.057,.051,0),(.03,.054,.050,0)],'Trousers',shin,28,pantswarp)
 rings('Knee cloth transition '+side,[(-.045,.035,.035,0),(-.027,.049,.046,0),(0,.056,.052,0),(.027,.048,.046,0),(.045,.022,.023,0)],'Trousers',shin,24)
 # Shoe last: shaped toe, instep, heel cup and sole rather than an enlarged block.
 levels=[(-.427,.049,.109,.041),(-.421,.052,.115,.041),(-.411,.052,.114,.041),(-.393,.051,.109,.041),(-.373,.047,.092,.030),(-.351,.041,.063,.005),(-.326,.045,.048,-.005),(-.292,.045,.046,-.005),(-.265,.042,.043,-.005)]
 boot=rings('Leather ankle boot '+side,levels,'Leather',shin,40)
 rings('Boot outsole '+side,[(-.430,.050,.111,.041),(-.423,.054,.117,.041),(-.413,.053,.116,.041)],'Trousers',shin,40)
 def boot_z(x,y):
  for lo,hi in zip(levels,levels[1:]):
   if lo[0]<=y<=hi[0]:
    t=(y-lo[0])/(hi[0]-lo[0]);w=lo[1]*(1-t)+hi[1]*t;d=lo[2]*(1-t)+hi[2]*t;z=lo[3]*(1-t)+hi[3]*t
    return z+d*math.sqrt(max(0,1-(x/w)**2))+.001
  return .1
 path=[(x,-.390,boot_z(x,-.390)) for x in [-.042+i*.084/20 for i in range(21)]]
 tube('Shoe toe welt stitch '+side,path,.0007,'Seam',shin,5)
 for k in range(3):
  y=-.355-k*.009;path=[(x,y,boot_z(x,y)) for x in [-.018+i*.036/8 for i in range(9)]]
  tube('Boot lace '+side+str(k),path,.001,'Seam',shin,6)
# viewport and render
bpy.context.view_layer.update()
world=bpy.data.worlds.new('Soft neutral studio');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.23,.29,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=False;scene.render.resolution_x=720;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
def area(n,p,power,size):
 data=bpy.data.lights.new(n,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(n,data);bpy.context.collection.objects.link(o);o.location=cv(p);o.rotation_euler=(Vector(cv((0,1.55,0)))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key softbox',(-2,3.1,3),250,3);area('Fill',(2,1.9,1.8),100,2);area('Rim',(0,2.6,-2),180,2)
camdata=bpy.data.cameras.new('Portrait camera');cam=bpy.data.objects.new('Portrait camera',camdata);bpy.context.collection.objects.link(cam);scene.camera=cam;camdata.type='ORTHO';camdata.ortho_scale=.57
for name,pos in [('front',(0,1.76,2.5)),('threequarter',(1.45,1.77,2.4)),('profile',(2.5,1.76,.12))]:
 cam.location=cv(pos);target=Vector(cv((0,1.72,0)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=os.path.join(REVIEW,'head-'+name+'.png');bpy.ops.render.render(write_still=True)
# A neutral full-body review uses the same geometry, not a separate beauty-only character.
camdata.ortho_scale=2.12;scene.render.resolution_x=720;scene.render.resolution_y=960
for name,pos in [('front',(0,1.13,4)),('threequarter',(2.3,1.35,4)),('back',(0,1.2,-4))]:
 cam.location=cv(pos);cam.rotation_euler=(Vector(cv((0,.94,0)))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=os.path.join(REVIEW,'body-'+name+'.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'fujimaru_player_editable.blend'))
# Quantized indexed buffers retain normals and linear vertex colours, avoiding multi-MB JSON arrays.
import struct,base64,hashlib
batches={};deps=bpy.context.evaluated_depsgraph_get()
for o,j,material in PARTS:
 ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles()
 batch=batches.setdefault(j,{'v':[],'i':[],'map':{}})
 colour=tuple(max(0,min(255,round(v*255))) for v in MATS[material].diffuse_color[:3])
 for tri in me.loop_triangles:
  for li in tri.loops:
   loop=me.loops[li];p=o.matrix_local@me.vertices[loop.vertex_index].co;n=o.matrix_local.to_3x3()@loop.normal;n.normalize()
   key=tuple(round(v*10000) for v in (p.x,p.z,-p.y))+tuple(max(-127,min(127,round(v*127))) for v in (n.x,n.z,-n.y))+colour
   if key not in batch['map']:batch['map'][key]=len(batch['v']);batch['v'].append(key)
   batch['i'].append(batch['map'][key])
 ev.to_mesh_clear()
# Discard quantization-collapsed faces identically in both transport formats.
for batch in batches.values():
 clean=[]
 for offset in range(0,len(batch['i']),3):
  ids=batch['i'][offset:offset+3];a,b,c=[Vector(batch['v'][k][:3]) for k in ids]
  if (b-a).cross(c-a).length_squared>0:clean.extend(ids)
 batch['i']=clean
result={'version':1,'positionScale':10000,'vertexStride':12,'source':'Original modeled fan character; official FGO First Order visual reference, no imported character mesh.','parts':[]}
for j,b in batches.items():
 assert len(b['v'])<65536,(j,len(b['v']))
 vb=b''.join(struct.pack('<3h3b3B',*v) for v in b['v']);ib=struct.pack('<'+'H'*len(b['i']),*b['i'])
 result['parts'].append({'joint':j,'vertices':len(b['v']),'triangles':len(b['i'])//3,'data':base64.b64encode(vb).decode(),'indices':base64.b64encode(ib).decode()})
data_path=os.path.join(ROOT,'world/src/generated/player-mesh.json')
with open(data_path,'w') as f:json.dump(result,f,separators=(',',':'))
# Export exactly the quantized geometry with preserved hierarchy for inspection and interchange.
runtime_mat=bpy.data.materials.new('M_PlayerVertexColor');runtime_mat.use_nodes=True;p=runtime_mat.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.85
attr=runtime_mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Color';runtime_mat.node_tree.links.new(attr.outputs['Color'],p.inputs['Base Color'])
bpy.ops.object.select_all(action='DESELECT')
for j,b in batches.items():
 verts=[cv((v[0]/10000,v[1]/10000,v[2]/10000)) for v in b['v']];faces=[tuple(b['i'][i:i+3]) for i in range(0,len(b['i']),3)]
 me=bpy.data.meshes.new('Runtime '+j);me.from_pydata(verts,[],faces);me.materials.append(runtime_mat);me.update()
 me.normals_split_custom_set_from_vertices([cv((v[3]/127,v[4]/127,v[5]/127)) for v in b['v']])
 for p in me.polygons:p.use_smooth=True
 col=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
 for i,v in enumerate(b['v']):col.data[i].color=(*[q/255 for q in v[6:9]],1)
 o=bpy.data.objects.new('PlayerPart_'+j,me);bpy.context.collection.objects.link(o);o.parent=JOINTS[j];o.select_set(True)
for o in JOINTS.values():o.select_set(True)
glb=os.path.join(ROOT,'world/public/assets/character_explorer.glb')
bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=True,export_apply=True,export_animations=False)
metrics={'triangles':sum(p['triangles'] for p in result['parts']),'vertices':sum(p['vertices'] for p in result['parts']),'bodyMeshCount':len(result['parts']),'gpuDrawCallsMeasured':False,'materialCount':1,'generatedJsonBytes':os.path.getsize(data_path),'glbBytes':os.path.getsize(glb),'glbSha256':hashlib.sha256(open(glb,'rb').read()).hexdigest(),'parts':[{k:p[k] for k in ('joint','vertices','triangles')} for p in result['parts']]}
with open(os.path.join(OUT,'player-metrics.json'),'w') as f:json.dump(metrics,f,indent=2)
print('PLAYER_METRICS',json.dumps(metrics))
