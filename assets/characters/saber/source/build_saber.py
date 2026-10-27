"""Original procedural fan-art mesh; no game/model assets are used.
Blender 4.3.2. Run: blender -b -t 4 --python source/build_saber.py
Units m. Blender forward -Y; glTF forward +Z. All authored geometry is editable.
"""
import bpy, math, os, json, random
from mathutils import Vector
from math import sin,cos,pi
BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(17)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in bpy.data.materials: bpy.data.materials.remove(d)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1
asset=bpy.data.collections.new('SABER | authored character'); scene.collection.children.link(asset)
rendercol=bpy.data.collections.new('STUDIO | excluded from export'); scene.collection.children.link(rendercol)
def mat(name,col,metal=0,rough=.5,emission=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*col,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*col,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
 if emission: p.inputs['Emission Color'].default_value=(*col,1); p.inputs['Emission Strength'].default_value=emission
 return m
M={
 'skin':mat('01 | porcelain warm skin',(.79,.56,.39),0,.72),
 'skinshade':mat('02 | eyelid warmth',(.52,.24,.16),0,.68),
 'ink':mat('03 | deep indigo linework',(.015,.021,.042),.04,.65),
 'white':mat('04 | ivory silk and eye whites',(.87,.88,.78),0,.61),
 'hair':mat('05 | golden wheat hair',(.60,.39,.095),.0,.44),
 'hairlight':mat('06 | sunlit hair ridges',(.88,.64,.22),0,.45),
 'hairdark':mat('07 | honey hair grooves',(.32,.18,.038),0,.57),
 'blue':mat('08 | royal blue velvet',(.009,.024,.19),.05,.56),
 'bluelight':mat('09 | cerulean silk fold',(.018,.060,.30),.06,.48),
 'bluedark':mat('10 | blue shadow lining',(.009,.019,.077),.03,.72),
 'silver':mat('11 | brushed silver armor',(.52,.61,.70),.72,.29),
 'silverlight':mat('12 | polished armor bevel',(.78,.84,.90),.83,.22),
 'silverdark':mat('13 | armor inset shadows',(.14,.20,.29),.66,.39),
 'gold':mat('14 | heraldic satin gold',(.65,.41,.08),.69,.26),
 'green':mat('15 | emerald iris',(.014,.20,.105),.04,.4,.12),
 'greenlight':mat('16 | jade iris light',(.15,.56,.23),.04,.4,.15),
 'pupil':mat('17 | iris deep core',(.006,.022,.021),0,.3),
 'glint':mat('18 | eye catchlight',(.97,1,.96),.02,.19,.35),
 'lip':mat('19 | rose neutral lips',(.43,.16,.12),0,.65)
}
parts=[]
def collect(o,material,bone=None):
 for c in list(o.users_collection): c.objects.unlink(o)
 asset.objects.link(o); parts.append(o)
 if material:o.data.materials.append(M[material])
 if bone:
  g=o.vertex_groups.new(name=bone); g.add(list(range(len(o.data.vertices))),1,'REPLACE')
 o['authoring']='Original geometry for Parhelion; reference-only fan art'
 return o

def mesh(name,v,f,material,bone=None,smooth=True):
 d=bpy.data.meshes.new(name+' mesh'); d.from_pydata(v,[],f); d.update()
 o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); collect(o,material,bone)
 for p in d.polygons:p.use_smooth=smooth
 uv=d.uv_layers.new(name='UVMap')
 xs=[x[0] for x in v]; zs=[x[2] for x in v]; dx=max(xs)-min(xs) or 1; dz=max(zs)-min(zs) or 1
 for p in d.polygons:
  for li in p.loop_indices:
   co=d.vertices[d.loops[li].vertex_index].co; uv.data[li].uv=((co.x-min(xs))/dx,(co.z-min(zs))/dz)
 return o

def sphere(name,loc,scale,material,bone=None,seg=24,rings=14):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc)
 o=bpy.context.object; o.name=name; o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for p in o.data.polygons:p.use_smooth=True
 return collect(o,material,bone)

def bevel(o,width=.003,segments=2):
 m=o.modifiers.new('Polished edge radius','BEVEL');m.width=width;m.segments=segments
 m=o.modifiers.new('Weighted plate normals','WEIGHTED_NORMAL');m.keep_sharp=True
 return o

def loft(name,rings,material,bone=None,n=48,fold=0,phase=0,cap=True):
 # rings: z, rx, ry, center y
 v=[]
 for z,rx,ry,cy in rings:
  for j in range(n):
   a=2*pi*j/n; r=1+fold*cos(12*a+phase)
   v.append((rx*sin(a)*r,cy-ry*cos(a)*r,z))
 f=[]
 for i in range(len(rings)-1):
  for j in range(n):f.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
 if cap:f += [tuple(range(n-1,-1,-1)),tuple((len(rings)-1)*n+j for j in range(n))]
 return mesh(name,v,f,material,bone)

def interp(points,steps=6):
 p=[Vector(x) for x in points]; out=[]
 for i in range(len(p)-1):
  a=p[max(i-1,0)];b=p[i];c=p[i+1];d=p[min(i+2,len(p)-1)]
  for j in range(steps):
   t=j/steps; out.append((b*2+(c-a)*t+(a*2-b*5+c*4-d)*t*t+(-a+b*3-c*3+d)*t*t*t)*.5)
 out.append(p[-1]);return out

def tube(name,points,radius,material,bone=None,sides=8,steps=4):
 p=interp(points,steps);v=[];f=[]
 for i,c in enumerate(p):
  t=(p[min(i+1,len(p)-1)]-p[max(0,i-1)]).normalized(); ref=Vector((0,1,0))
  if abs(t.dot(ref))>.92:ref=Vector((1,0,0))
  a=t.cross(ref).normalized();b=t.cross(a).normalized()
  r=radius if isinstance(radius,(int,float)) else radius[0]+(radius[-1]-radius[0])*i/(len(p)-1)
  for k in range(sides):v.append(c+r*(cos(2*pi*k/sides)*a+sin(2*pi*k/sides)*b))
 for i in range(len(p)-1):
  for k in range(sides):f.append((i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k))
 f += [tuple(range(sides-1,-1,-1)),tuple((len(p)-1)*sides+j for j in range(sides))]
 return mesh(name,v,f,material,bone)

def capsule(name,a,b,r1,r2,material,bone,segments=16):
 a,b=Vector(a),Vector(b);t=(b-a).normalized();side=t.cross(Vector((0,1,0))).normalized();other=t.cross(side).normalized()
 v=[]
 for k in range(5):
  u=k/4;c=a.lerp(b,u);r=(r1*(1-u)+r2*u)*(0.86+0.14*sin(pi*u))
  for j in range(segments):v.append(c+r*(cos(j*2*pi/segments)*side+sin(j*2*pi/segments)*other))
 f=[]
 for k in range(4):
  for j in range(segments):f.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
 f+=[tuple(range(segments-1,-1,-1)),tuple(4*segments+j for j in range(segments))]
 return mesh(name,v,f,material,bone)

# -- RIG: native FK skeleton, deform weights on every authored vertex --
arm=bpy.data.armatures.new('Saber humanoid skeleton');rig=bpy.data.objects.new('Saber_Rig',arm);asset.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
bones={}
def bone(name,a,b,parent=None):
 q=arm.edit_bones.new(name);q.head=a;q.tail=b
 if parent:q.parent=arm.edit_bones[parent]
 bones[name]=(a,b,parent)
 return q
bone('Root',(0,0,0),(0,0,.15));bone('Hips',(0,0,.96),(0,0,1.08),'Root')
bone('Spine',(0,0,1.08),(0,0,1.23),'Hips');bone('Chest',(0,0,1.23),(0,0,1.37),'Spine')
bone('Neck',(0,0,1.37),(0,0,1.45),'Chest');bone('Head',(0,0,1.45),(0,0,1.665),'Neck')
for s,side in [(1,'L'),(-1,'R')]:
 bone('Clavicle.'+side,(0,0,1.34),(s*.185,0,1.34),'Chest')
 bone('UpperArm.'+side,(s*.185,0,1.34),(s*.275,-.005,1.115),'Clavicle.'+side)
 bone('Forearm.'+side,(s*.275,-.005,1.115),(s*.305,-.025,.92),'UpperArm.'+side)
 bone('Hand.'+side,(s*.305,-.025,.92),(s*.31,-.033,.835),'Forearm.'+side)
 bone('Thigh.'+side,(s*.085,0,1.0),(s*.105,-.015,.56),'Hips')
 bone('Shin.'+side,(s*.105,-.015,.56),(s*.11,.0,.15),'Thigh.'+side)
 bone('Foot.'+side,(s*.11,0,.15),(s*.11,-.115,.065),'Shin.'+side)
 bone('Toe.'+side,(s*.11,-.115,.065),(s*.11,-.175,.06),'Foot.'+side)
 for j in range(4):
  x=s*(.282+j*.016); bone('Finger%d.%s'%(j+1,side),(x,-.034,.85),(x,-.043,.79),'Hand.'+side)
 bone('Thumb.'+side,(s*.278,-.027,.88),(s*.259,-.058,.84),'Hand.'+side)
for j in range(8):
 a=2*pi*j/8; bone('Skirt.%02d'%j,(.145*sin(a),-.10*cos(a),1.01),(.32*sin(a),-.23*cos(a),.32),'Hips')
bone('Ahoge',(0,-.012,1.67),(.015,-.025,1.76),'Head')
bone('Sword',( -.31,-.055,.855),(-.31,-.06,.35),'Hand.R')
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False);rig.show_in_front=True

def bind(o):
 if not o.vertex_groups:
  o.vertex_groups.new(name='Hips').add(list(range(len(o.data.vertices))),1,'REPLACE')
 mo=o.modifiers.new('Saber skeletal deformation','ARMATURE');mo.object=rig;o.parent=rig

def skirt_weights(o):
 # top anchors at hips, hem interpolates to circumferential skirt controls
 o.vertex_groups.clear();g0=o.vertex_groups.new(name='Hips');gs=[o.vertex_groups.new(name='Skirt.%02d'%i) for i in range(8)]
 for v in o.data.vertices:
  co=o.matrix_world@v.co; a=math.atan2(co.x/.36,-co.y/.25)%(2*pi);q=a/(2*pi)*8;i=int(q)%8;w=q-int(q)
  k=min(.97,max(0,(1.05-co.z)/.54));g0.add([v.index],1-k,'REPLACE');gs[i].add([v.index],k*(1-w),'REPLACE');gs[(i+1)%8].add([v.index],k*w,'REPLACE')

# -- Sculped face: a continuous custom head surface, no featureless primitive --
prof=[(1.449,.016,.040,-.006),(1.459,.037,.055,-.003),(1.477,.061,.067,0),(1.49,.079,.075,.002),(1.52,.089,.078,.003),(1.55,.094,.079,.003),(1.58,.096,.081,.005),(1.61,.094,.082,.006),(1.64,.081,.073,.009),(1.66,.059,.056,.012),(1.674,.024,.027,.012),(1.677,.001,.002,.01)]
v=[];n=64
for z,rx,ry,cy in prof:
 for j in range(n):
  a=2*pi*j/n;x=rx*sin(a);y=cy-ry*(max(0,cos(a))**.35 if cos(a)>=0 else cos(a))
  # softly flattened front plane and integrated subtle bridge/tip
  fr=max(0,cos(a))**8
  nose=.016*math.exp(-(x/.014)**2-((z-1.525)/.024)**2)
  y-=fr*nose
  v.append((x,y,z))
f=[]
for i in range(len(prof)-1):
 for j in range(n):f.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
f += [tuple(range(n-1,-1,-1)),tuple((len(prof)-1)*n+j for j in range(n))]
head=mesh('Face | continuous cheek jaw bridge surface',v,f,'skin','Head')
sub=head.modifiers.new('Facial surface refinement','SUBSURF');sub.levels=2;sub.render_levels=2
loft('Neck',[(1.365,.039,.035,0),(1.405,.033,.031,0),(1.455,.035,.034,0)],'skin','Neck',32)
for s in [-1,1]:
 sphere('Ear '+str(s),(s*.092,.004,1.523),(.014,.011,.026),'skin','Head',20,12)
 sphere('Ear inset '+str(s),(s*.102,-.001,1.523),(.005,.007,.015),'skinshade','Head',16,10)
 # almond-shaped raised eye white patches; custom lid curves and iris discs
 cx=s*.0415;cz=1.563;w=.030;h=.0105
 outline=[]
 for j in range(33):
  t=j/32*2*pi; xx=w*cos(t); zz=h*sin(t)*(1 if sin(t)>0 else .78)
  zz+=s*xx*.11; outline.append((cx+xx,-.0785+.15*(abs(cx+xx)/.09)**2*.025,cz+zz))
 # curved patch fan, white against the lid
 eyev=[(cx,-.0845,cz)]+outline; eyef=[]
 for j in range(32):eyef.append((0,j+1,j+2))
 mesh('Almond sclera '+str(s),eyev,eyef,'white','Head')
 # iris as concentric convex radial rings, top gets a dark rim, no external texture
 irx=.0124;irz=.0127;irisx=cx-s*.001
 vv=[(irisx,-.087,cz)];ff=[];rings=[(.48,-.0869),(.65,-.0865),(.90,-.0858),(1,-.0848)]
 for r,y in rings:
  for j in range(40):
   a=2*pi*j/40;xx=irisx+irx*r*cos(a);zz=cz+irz*r*sin(a)
   aperture=math.sqrt(max(0,1-((xx-cx)/w)**2));upper=cz+h*aperture+s*(xx-cx)*.11;lower=cz-h*.78*aperture+s*(xx-cx)*.11
   zz=max(lower+.0006,min(upper-.0006,zz));vv.append((xx,y,zz))
 for j in range(40):ff.append((0,1+j,1+(j+1)%40))
 for k in range(3):
  for j in range(40):ff.append((1+k*40+j,1+(k+1)*40+j,1+(k+1)*40+(j+1)%40,1+k*40+(j+1)%40))
 iris=mesh('Emerald iris radial facets '+str(s),vv,ff,'green','Head')
 iris.data.materials.append(M['greenlight']);iris.data.materials.append(M['pupil'])
 for p in iris.data.polygons:
  if p.index<40:p.material_index=2
  elif p.index>=120:p.material_index=2
  elif (p.index%40)>20:p.material_index=1
 sphere('Eye bright catchlight '+str(s),(irisx-.0035,-.088,cz+.006),(.0024,.0009,.0027),'glint','Head',16,8)
 sphere('Eye secondary catchlight '+str(s),(irisx+.0045,-.0873,cz-.0055),(.0010,.0007,.0013),'glint','Head',12,6)
 up=[];lo=[]
 for j in range(13):
  xx=-w+2*w*j/12; zz=h*math.sqrt(max(0,1-(xx/w)**2)); y=-.0798+.00375*(abs(cx+xx)/.09)**2
  up.append((cx+xx,y-.008,cz+zz+s*xx*.11));lo.append((cx+xx,y-.0065,cz-zz*.78+s*xx*.11))
 tube('Upper ink eyelid '+str(s),up,.0020,'ink','Head',6,2)
 tube('Lower fine eyelid '+str(s),lo,.00065,'skinshade','Head',6,2)
 outer=cx+s*w
 tube('Outer lash wing '+str(s),[(outer-s*.009,-.08,cz+.010),(outer+s*.004,-.077,cz+.004),(outer+s*.007,-.073,cz+.009)],.0011,'ink','Head',6,3)
 # determined, slim blonde eyebrows
 tube('Eyebrow '+str(s),[(cx-s*.025,-.076,cz+.020),(cx,-.080,cz+.026),(cx+s*.026,-.072,cz+.025)],.0019,'hairdark','Head',6,6)
# tiny anatomical mouth and nose shadow, not a heavy line
# integrated nose surface; no separate spherical tip
tube('Nose side line',[(.004,-.090,1.527),(.004,-.091,1.523),(.001,-.092,1.522)],.00065,'skinshade','Head',6,3)
tube('Quiet mouth', [(-.015,-.077,1.499),(-.007,-.081,1.500),(0,-.082,1.499),(.008,-.081,1.500),(.015,-.077,1.501)],.00085,'lip','Head',6,4)
tube('Lower lip reflected light',[(-.008,-.080,1.496),(0,-.082,1.495),(.008,-.080,1.496)],.00065,'skin','Head',6,3)

# -- Layered hair: shaped clumps with complementary golden ridges --
def lock(name,pts,widths,thick=.007,material='hair',bone='Head',ridge=True):
 pts=[tuple(q) for q in pts]
 if name.startswith('Bangs'):
  widths=list(widths);widths[0]=.0025
  q=list(pts[0]);q[1]+=.021;q[2]-=.009;pts[0]=tuple(q)
 if name.startswith('Swept crown'):
  widths=list(widths);widths[0]=.0015
  q=list(pts[0]);q[2]-=.014;pts[0]=tuple(q)
 p=interp(pts,7);v=[];f=[];nr=12
 for i,c in enumerate(p):
  u=i/(len(p)-1); pos=u*(len(widths)-1); k=min(int(pos),len(widths)-2);a=pos-k;w=widths[k]*(1-a)+widths[k+1]*a
  t=(p[min(i+1,len(p)-1)]-p[max(i-1,0)]).normalized(); front=Vector((0,-1,0));side=t.cross(front).normalized(); dep=t.cross(side).normalized()
  for j in range(nr):
   ang=2*pi*j/nr;v.append(c+side*(w*cos(ang))+dep*(thick*sin(ang)*(0.6+0.4*sin(pi*u))))
 for i in range(len(p)-1):
  for j in range(nr):f.append((i*nr+j,i*nr+(j+1)%nr,(i+1)*nr+(j+1)%nr,(i+1)*nr+j))
 f += [tuple(range(nr-1,-1,-1)),tuple((len(p)-1)*nr+j for j in range(nr))]
 o=mesh(name,v,f,material,bone)
 if ridge:
  qs=[]
  for j in range(1,len(pts)-1):
   q=Vector(pts[j]);q.y-=thick*.88;qs.append(tuple(q))
  if len(qs)>=2:tube(name+' | strand ridge',qs,[.0018,.0004],'hairlight',bone,5,4)
 return o
# fitted skull shell: hemisphere with variable hairline toward sides and nape
v=[];f=[];nn=64;rr=14
for k in range(rr+1):
 u=k/rr
 for j in range(nn):
  a=2*pi*j/nn;bottom=1.603-0.095*(1-cos(a))*.5
  z=1.686-(1.686-bottom)*u;h=math.sqrt(max(0.002,1-((z-1.568)/.121)**2))
  v.append((.104*h*sin(a),.012-.095*h*cos(a),z))
for k in range(rr):
 for j in range(nn):f.append((k*nn+j,k*nn+(j+1)%nn,(k+1)*nn+(j+1)%nn,(k+1)*nn+j))
mesh('Hair | fitted crown shell',v,f,'hair','Head')
# broad root masses narrowing into purposeful overlapping points
bangs=[
 ([(-.055,-.044,1.67),(-.062,-.081,1.635),(-.056,-.089,1.604),(-.044,-.092,1.575)],[.017,.022,.017,.0008]),
 ([(-.03,-.057,1.677),(-.037,-.089,1.636),(-.027,-.096,1.605),(-.021,-.096,1.585)],[.019,.022,.015,.0007]),
 ([(-.005,-.063,1.68),(-.012,-.095,1.638),(-.005,-.099,1.610),(-.009,-.100,1.593)],[.020,.023,.013,.0005]),
 ([(.022,-.057,1.676),(.020,-.092,1.64),(.026,-.099,1.612),(.018,-.100,1.582)],[.022,.022,.015,.0007]),
 ([(.046,-.045,1.672),(.051,-.081,1.638),(.053,-.093,1.611),(.045,-.096,1.592)],[.023,.024,.017,.0008]),
 ([(.066,-.032,1.66),(.080,-.067,1.624),(.075,-.086,1.593),(.084,-.075,1.569)],[.024,.025,.013,.0008]),
 ([(-.074,-.027,1.659),(-.087,-.064,1.623),(-.080,-.080,1.589),(-.077,-.075,1.574)],[.023,.022,.015,.0008])]
for i,(p,w) in enumerate(bangs):lock('Bangs | layered lock %02d'%i,p,w,.0035, 'hair')
for s in [-1,1]:
 lock('Temple long side lock '+str(s),[(s*.081,-.040,1.654),(s*.096,-.052,1.579),(s*.098,-.058,1.486),(s*.068,-.078,1.401)],[.020,.025,.018,.0007],.009)
 lock('Temple outer lock '+str(s),[(s*.09,-.01,1.63),(s*.108,-.020,1.556),(s*.107,-.034,1.482),(s*.092,-.055,1.441)],[.018,.018,.012,.0006],.009)
 # back swept combed locks from crown into bun
 for j in range(3):
  y=.012+j*.025
  lock('Swept crown %s %s'%(s,j),[(s*.024,y*.35,1.681),(s*.082,y,1.65),(s*.102,y+.018,1.59),(s*.073,y+.033,1.535)],[.012,.015,.011,.002],.005,ridge=(j%2==0))

# Fine secondary fringe tips and strand grooves break up the main sculpted masses.
for i,(p,w) in enumerate(bangs):
 if i<5:
  q=[(p[0][0]+.006,p[0][1]+.020,p[0][2]-.010),(p[1][0]+.006,p[1][1]-.002,p[1][2]-.005),(p[2][0]+.008,p[2][1]-.004,p[2][2]-.002),(p[3][0]+.012,p[3][1]-.003,p[3][2]-.010)]
  lock('Fine fringe tip %02d'%i,q,[.0015,.0045,.0035,.0002],.0018,'hair','Head',False)
  groove=[(p[1][0]-.004,p[1][1]-.004,p[1][2]),(p[2][0]-.003,p[2][1]-.004,p[2][2]+.003),(p[3][0],p[3][1]-.001,p[3][2]+.008)]
  tube('Hair engraved fine strand %02d'%i,groove,[.00065,.00015],'hairdark','Head',5,5)

# braided bun: interlaced strands around a compact oval, not a spherical blob
sphere('Braided bun core',(0,.099,1.565),(.071,.036,.069),'hairdark','Head',24,16)
for j in range(18):
 a=2*pi*j/18;x=.071*cos(a);z=1.566+.070*sin(a)
 pts=[(.071*cos(a-.19),.105,z-.014*cos(a)),(x,.133, z),(.068*cos(a+.22),.112,z+.013*cos(a))]
 lock('Braid | interlaced plait %02d'%j,pts,[.011,.016,.009],.008,'hair' if j%2 else 'hairlight',ridge=False)
# iconic single ahoge with a slender rising arch
lock('Ahoge | king signature',[(.002,-.006,1.679),(.012,-.008,1.728),(.056,-.007,1.748),(.090,-.006,1.724)],[.0065,.006,.0035,.0003],.0028,'hairlight','Ahoge',False)
# blue folded ribbon at nape
for s in [-1,1]:
 lock('Ribbon bow '+str(s),[(s*.008,.127,1.518),(s*.049,.15,1.542),(s*.084,.132,1.521),(s*.013,.13,1.51)],[.013,.027,.025,.006],.009,'blue','Head',False)
 lock('Ribbon trailing end '+str(s),[(s*.008,.13,1.506),(s*.032,.15,1.468),(s*.043,.139,1.437)],[.016,.018,.023],.004,'blue','Head',False)
sphere('Ribbon knot',(0,.137,1.514),(.018,.014,.016),'bluelight','Head',20,10)

# -- Tailored under-suit and sculpted breastplate --
loft('Royal blue fitted bodice',[(1.015,.145,.10,0),(1.10,.117,.076,0),(1.20,.135,.085,0),(1.30,.161,.091,0),(1.355,.147,.079,0),(1.38,.070,.048,0)],'blue','Chest',48)
# Keep cloth behind the backplate rather than coplanar with its metal shell.
for vv in parts[-1].data.vertices:vv.co.y*=.84
# corset abdomen wraps, overlapped plates
loft('Armor | cuirass torso',[(1.09,.122,.080,0),(1.14,.125,.083,0),(1.22,.144,.092,-.003),(1.29,.151,.098,-.006),(1.34,.142,.086,0)],'silver','Chest',48)
# front convex single anatomical breastplate shaped as a heraldic shield
outline=[(0,1.365),(.085,1.355),(.135,1.329),(.151,1.29),(.135,1.238),(.086,1.203),(0,1.183),(-.086,1.203),(-.135,1.238),(-.151,1.29),(-.135,1.329),(-.085,1.355)]
v=[(0,-.137,1.278)]
for scale in [.38,.72,1]:
 for x,z in outline:
  zz=1.278+(z-1.278)*scale; xx=x*scale; yy=-.095-.042*(1-scale*scale)
  v.append((xx,yy,zz))
f=[];nn=len(outline)
for j in range(nn):f.append((0,1+(j+1)%nn,1+j))
for k in range(2):
 for j in range(nn):f.append((1+k*nn+j,1+k*nn+(j+1)%nn,1+(k+1)*nn+(j+1)%nn,1+(k+1)*nn+j))
o=mesh('Armor | sculpted heraldic breastplate',v,f,'silver','Chest');sol=o.modifiers.new('Forged thickness','SOLIDIFY');sol.thickness=.006;bevel(o,.002,2)
tube('Breastplate dark recessed perimeter',[(x,-.091-.009*sin((z-1.18)/.19*pi),z) for x,z in outline+[outline[0]]],.003,'silverdark','Chest',8,4)
tube('Breastplate silver rolled edge',[(x*.985,-.094-.009*sin((z-1.18)/.19*pi),1.278+(z-1.278)*.985) for x,z in outline+[outline[0]]],.0017,'silverlight','Chest',6,4)
# flowing original indigo heraldic ornament, geometry inlay (not copied textures)
for s in [-1,1]:
 tube('Chest lily scroll '+str(s),[(s*.003,-.127,1.221),(s*.028,-.127,1.245),(s*.069,-.119,1.268),(s*.080,-.114,1.289),(s*.059,-.122,1.284)],.0026,'blue','Chest',7,5)
 tube('Chest upper lily '+str(s),[(0,-.128,1.272),(s*.014,-.127,1.302),(s*.038,-.119,1.320),(s*.044,-.114,1.307)],.0020,'blue','Chest',7,5)
 tube('Chest side laurel '+str(s),[(s*.018,-.126,1.23),(s*.036,-.125,1.257),(s*.048,-.125,1.272)],.0035,'blue','Chest',7,4)
tube('Chest central heraldic stem',[(0,-.130,1.224),(0,-.130,1.258),(0,-.129,1.29)],.0019,'blue','Chest',7,4)
# Project original ornament onto the convex forged surface, clear of the underlying plate.
for deco in parts:
 if deco.name.startswith(('Chest lily','Chest upper','Chest side','Chest central')):
  for vv in deco.data.vertices:
   rr=min(1,(vv.co.x/.151)**2+((vv.co.z-1.278)/.095)**2)
   vv.co.y=-.095-.042*(1-rr)-.0045
# gorget and standing blue collar
loft('High royal collar',[(1.357,.050,.043,0),(1.423,.044,.038,0)],'bluedark','Neck',32)
loft('Armor | silver gorget',[(1.354,.078,.053,0),(1.375,.068,.047,0),(1.400,.052,.041,0)],'silver','Neck',40)
tube('Gorget upper rolled rim',[ (.052*sin(2*pi*j/32),-.042*cos(2*pi*j/32),1.401) for j in range(33)],.002,'silverlight','Neck',6,2)
for s in [-1,1]:
 tube('Gorget flourish '+str(s),[(s*.002,-.051,1.37),(s*.018,-.047,1.386),(s*.031,-.042,1.381),(s*.023,-.047,1.369)],.0018,'blue','Neck',6,4)
# flexible armor fauld, three overlapping waist lames
for i in range(3):
 z=1.14-i*.041; rx=.125+i*.009;ry=.082+i*.006
 loft('Armor | fauld lame %02d'%i,[(z-.045,rx+.012,ry+.008,0),(z,rx,ry,0)],'silver','Spine' if i==0 else 'Hips',40)
 tube('Fauld dark edge %s'%i,[( (rx+.012)*sin(2*pi*j/40),-(ry+.009)*cos(2*pi*j/40),z-.044) for j in range(41)],.0021,'silverdark','Spine' if i==0 else 'Hips',6,2)
# belt with royal gold center, not a modern buckle
loft('Waist dark leather belt',[(1.033,.153,.104,0),(1.056,.148,.100,0)],'bluedark','Hips',48)
bevel(mesh('Waist shield gold clasp',[(-.021,-.111,1.059),(.021,-.111,1.059),(.018,-.114,1.030),(0,-.118,1.014),(-.018,-.114,1.030)],[(0,1,2,3,4)],'gold','Hips'),.002)

# -- Arms: puffed cloth, overlapped vambraces, articulated gauntlets --
for s,side in [(1,'L'),(-1,'R')]:
 upper='UpperArm.'+side;fore='Forearm.'+side;hand='Hand.'+side
 sphere('Blue puff sleeve '+side,(s*.19,.001,1.322),(.065,.063,.071),'blue',upper,24,16)
 # seams over sleeves as slim golden piping
 for offset in [-.027,.029]:
  tube('Sleeve piping '+side+str(offset),[(s*.139,offset,1.369),(s*.183,offset-.014,1.391),(s*.228,offset-.016,1.363),(s*.249,offset,1.315)],.0018,'gold',upper,6,5)
 capsule('Upper arm blue sleeve '+side,(s*.215,0,1.291),(s*.274,-.006,1.113),.051,.036,'blue',upper)
 for j in range(3):
  sphere('Tailored elbow fabric fold '+side+str(j),(s*(.262+j*.003),-.002,1.16-j*.021),(.040,.039,.013),'bluelight',upper,20,10)
 sphere('Elbow articulated joint '+side,(s*.275,-.004,1.112),(.041,.041,.043),'silverdark',fore,20,12)
 # bracer tapered loft along forearm, several plates
 capsule('Armor | forearm main bracer '+side,(s*.276,-.009,1.115),(s*.303,-.023,.926),.039,.026,'silver',fore,20)
 for j in range(4):
  z=1.09-j*.044; xx=s*(.278+j*.0062)
  cuff=loft('Armor | overlapping bracer lame '+side+str(j),[(z-.025,.045-j*.003,.041-j*.002,-.012),(z+.020,.048-j*.003,.044-j*.002,-.010)],'silver',fore,24)
  for vv in cuff.data.vertices:vv.co.x+=xx
  tube('Bracer polished transverse edge '+side+str(j),[(xx-.035,-.045,z-.018),(xx,-.055+j*.002,z-.023),(xx+.035,-.045,z-.018)],.002,'silverlight',fore,6,4)
  for ss in [-1,1]:sphere('Bracer rivet '+side+str(j)+str(ss),(xx+ss*.034,-.053,z+.007),(.0026,.0021,.0026),'silverdark',fore,10,6)
 # pointed elbow wing in side silhouette
 pts=[(s*.31,-.018,1.16),(s*.347,-.01,1.117),(s*.308,-.02,1.081),(s*.291,-.044,1.12)]
 o=mesh('Armor | elbow wing '+side,pts,[(0,1,2,3)],'silver',fore);so=o.modifiers.new('Plate thickness','SOLIDIFY');so.thickness=.008;bevel(o,.004)
 sphere('Gauntlet dark palm '+side,(s*.31,-.031,.873),(.038,.027,.047),'bluedark',hand,20,12)
 sphere('Armor | gauntlet backplate '+side,(s*.31,-.048,.882),(.036,.015,.035),'silver',hand,20,12)
 for j in range(4):
  x=s*(.282+j*.016);b='Finger%d.%s'%(j+1,side)
  capsule('Gauntlet finger foundation '+side+str(j),(x,-.035,.853),(x,-.046,.797+j*.002),.009,.007,'bluedark',b,10)
  for k in range(3):
   sphere('Finger plate '+side+str(j)+str(k),(x,-.048-k*.001,.847-k*.018+j*.002),(.0093,.010,.0105),'silver',b,12,8)
 capsule('Gauntlet thumb '+side,(s*.277,-.029,.886),(s*.26,-.055,.845),.012,.009,'silver','Thumb.'+side,12)
 # legs (proper complete silhouette inside skirt)
 capsule('Blue thigh '+side,(s*.085,0,.99),(s*.105,-.016,.56),.070,.047,'bluedark','Thigh.'+side,20)
 capsule('Armored lower leg '+side,(s*.105,-.015,.57),(s*.11,0,.13),.052,.035,'silver','Shin.'+side,24)
 tube('Shin central raised ridge '+side,[(s*.105,-.064,.55),(s*.108,-.052,.35),(s*.11,-.040,.14)],.0026,'silverlight','Shin.'+side,6,5)
 sphere('Knee guard '+side,(s*.105,-.049,.555),(.055,.034,.057),'silver','Shin.'+side,24,14)
 # shaped sabaton foot, pointed toe and heel
 foot=loft('Armor | sabaton foot '+side,[(0,.050,.105,-.053),(.048,.051,.119,-.057),(.078,.045,.105,-.053),(.12,.037,.062,-.01),(.145,.034,.037,.002)],'silver','Foot.'+side,32)
 for vert in foot.data.vertices:vert.co.x+=s*.11
 for k in range(3):
  yy=-.050-k*.038;zz=.103-k*.012
  tube('Sabaton overlapping band '+side+str(k),[(s*.11-.043,yy,zz-.012),(s*.11,yy-.008,zz+.004),(s*.11+.043,yy,zz-.012)],.0035,'silverdark','Foot.'+side,6,4)

# -- Long tailored dress. Radial folds and eight deforming skirt bones. --
skirtrings=[(1.025,.151,.105,0),(.94,.183,.132,0),(.80,.237,.171,.004),(.63,.295,.211,.012),(.45,.347,.247,.019),(.285,.385,.275,.025)]
dress=loft('Dress | royal blue pleated outer skirt',skirtrings,'blue',None,96,.035,.18,False);skirt_weights(dress)
# front-to-back fold highlights slim, subtle satin seams
for j in range(12):
 a=2*pi*j/12;pts=[]
 for z,rx,ry,cy in skirtrings:
  pts.append((rx*1.036*sin(a),cy-ry*1.036*cos(a),z))
 o=tube('Dress | pleat crest %02d'%j,pts,.0028,'bluelight',None,6,4);skirt_weights(o)
# ivory scalloped underdress with authored hem rhythm
v=[];f=[];nn=144
for k in range(3):
 for j in range(nn):
  a=2*pi*j/nn;z=[.319,.261,.225][k]
  if k==2:z+=.018*(.5+.5*cos(a*48))
  rx=[.355,.380,.397][k];ry=[.252,.272,.286][k]
  v.append((rx*sin(a),.024-ry*cos(a),z))
for k in range(2):
 for j in range(nn):f.append((k*nn+j,k*nn+(j+1)%nn,(k+1)*nn+(j+1)%nn,(k+1)*nn+j))
o=mesh('Dress | ivory scalloped petticoat',v,f,'white');skirt_weights(o)
# blue overskirt gold hem, binding and original small drop stitch motifs
for z,rx,ry in [(.286,.388,.278),(.301,.384,.274)]:
 o=tube('Dress | gold hem binding %.3f'%z,[(rx*(1+.034*cos(12*a+.18))*sin(a),.025-ry*(1+.034*cos(12*a+.18))*cos(a),z) for a in [j*2*pi/144 for j in range(145)]],.0025,'gold',None,6,2);skirt_weights(o)
for j in range(24):
 a=2*pi*j/24;xx=.389*sin(a);yy=.025-.279*cos(a)
 o=sphere('Petticoat small gold embroidery %02d'%j,(xx,yy,.253),(.002,.002,.006),'gold',None,10,6);skirt_weights(o)
# Front skirt split panel: deeper indigo inset bounded by curved gold piping
for s in [-1,1]:
 pts=[]
 for z,rx,ry,cy in skirtrings:
  a=s*.36;pts.append((rx*sin(a),cy-ry*1.040*cos(a),z))
 o=tube('Dress | front tailored gold seam '+str(s),pts,.0025,'gold',None,6,4);skirt_weights(o)
# Three overlapping silver tassets on both sides, with four individual curved sectors.
for side in [-1,1]:
 for back in [False,True]:
  for row in range(3):
   top=[1.035,.824,.631][row];bottom=[.801,.608,.408][row]
   start,end=((.56,1.65) if not back else (1.69,2.67));start*=side;end*=side
   ns=16;nt=5;v=[];f=[]
   def skirt_rad(z):
    t=(1.025-z)/.74;return (.153+.236*t,.108+.169*t,.025*t)
   for k in range(nt):
    t=k/(nt-1);z=top*(1-t)+bottom*t
    for j in range(ns+1):
     u=j/ns;a=start+(end-start)*u;zz=z+.016*sin(pi*u)*(1 if k==0 else -.3)
     rx,ry,cy=skirt_rad(zz);rx+=.015+(2-row)*.008;ry+=.014+(2-row)*.008
     v.append((rx*sin(a),cy-ry*cos(a),zz))
   for k in range(nt-1):
    for j in range(ns):f.append((k*(ns+1)+j,k*(ns+1)+j+1,(k+1)*(ns+1)+j+1,(k+1)*(ns+1)+j))
   name='Armor | tasset %s %s %s'%(side,'rear' if back else 'front',row)
   o=mesh(name,v,[tuple(reversed(q)) for q in f] if side==1 else f,'silver');so=o.modifiers.new('Forged tasset thickness','SOLIDIFY');so.thickness=.005;bevel(o,.0025);skirt_weights(o)
   # border uses original vertex perimeter slightly outset, so polished silver reads at TPS scale
   ids=list(range(ns+1))+[(k+1)*(ns+1)-1 for k in range(1,nt)]+list(range(nt*(ns+1)-2,(nt-1)*(ns+1)-1,-1))+[k*(ns+1) for k in range(nt-2,-1,-1)]
   pts=[(v[i][0]*1.008,(v[i][1]-.01)*1.008+.01,v[i][2]) for i in ids];pts.append(pts[0])
   o=tube(name+' | dark rolled perimeter',pts,.0024,'silverdark',None,6,2);skirt_weights(o)
   # low relief rivet field at plate corners
   for idx in [1,ns-1,(nt-1)*(ns+1)+1,nt*(ns+1)-2]:
    x,y,z=v[idx];o=sphere(name+' | rivet '+str(idx),(x*1.015,y*1.015,z),(.0025,.0025,.0025),'silverlight',None,10,6);skirt_weights(o)

# -- Original Excalibur-inspired ceremonial sword, rigidly weighted to right hand --
# downward rest sword beside body, authored blade facets and gold/blue guard
sx=-.31;sy=-.064
# Grip runs from hand .85 toward guard .74, blade to .04.
loft('Sword | blue wrapped grip',[(.746,.012,.012,sy),(.882,.011,.011,sy)],'blue','Sword',16)
o=parts[-1]
for v in o.data.vertices:v.co.x+=sx
for i in range(8):
 tube('Sword | grip wrap %s'%i,[(sx+.012*sin(a),sy-.012*cos(a),.755+i*.015+a/(2*pi)*.006) for a in [j*2*pi/20 for j in range(21)]],.0014,'gold','Sword',5,1)
sphere('Sword | faceted pommel',(sx,sy,.9),(.016,.014,.025),'gold','Sword',12,8)
# guard, swept quillons
for s in [-1,1]:
 pts=[(sx,sy,.746),(sx+s*.035,sy,.751),(sx+s*.085,sy,.732),(sx+s*.112,sy,.742)]
 tube('Sword | golden swept crossguard '+str(s),pts,.009,'gold','Sword',8,5)
 tube('Sword | royal blue guard inlay '+str(s),[(x,y-.009,z) for x,y,z in pts],.003,'blue','Sword',6,5)
# long diamond section tapered blade
v=[];rings=[(.737,.025),(.672,.030),(.12,.018),(.045,.0)]
for z,w in rings:v.extend([(sx-w,sy,z),(sx,sy-.006,z),(sx+w,sy,z),(sx,sy+.006,z)])
f=[]
for k in range(3):
 for j in range(4):f.append((k*4+j,k*4+(j+1)%4,(k+1)*4+(j+1)%4,(k+1)*4+j))
mesh('Sword | diamond section blade',v,f,'silverlight','Sword',False)
# gilded forte and central blue ribbon at root
for s in [-1,1]:
 tube('Sword | gilded forte '+str(s),[(sx+s*.021,sy-.004,.72),(sx+s*.026,sy-.004,.67),(sx+s*.014,sy-.007,.61)],.0023,'gold','Sword',6,4)
tube('Sword | blade blue fuller',[(sx,sy-.007,.69),(sx,sy-.007,.60),(sx,sy-.007,.55)],.0035,'blue','Sword',6,3)
for i in range(7):
 z=.64-i*.038
 tube('Sword | original rune %s'%i,[(sx-.004,sy-.0068,z+.006),(sx+.004,sy-.0068,z),(sx-.003,sy-.0068,z-.005)],.0008,'gold','Sword',5,2)
sphere('Sword | emerald hilt jewel',(sx,sy-.014,.747),(.007,.004,.012),'green','Sword',12,8)

# -- All mesh parts skin deform; rig contains 45-ish named bones. --
for o in parts:bind(o)
# Store neutral rest plus genuine keyframed FK clips in NLA.
rig.animation_data_create()
for b in rig.pose.bones:b.rotation_mode='XYZ'
def clear_pose():
 for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
def key(frame):
 for b in rig.pose.bones:
  b.keyframe_insert('rotation_euler',frame=frame,group=b.name)
  if b.name in ['Root','Hips']:b.keyframe_insert('location',frame=frame,group=b.name)
def make_action(name,frames,fn):
 clear_pose();a=bpy.data.actions.new(name);rig.animation_data.action=a
 for fr,t in frames:
  clear_pose();fn(t);key(fr)
 for fc in a.fcurves:
  for kp in fc.keyframe_points:kp.interpolation='BEZIER'
 a.use_fake_user=True
 tr=rig.animation_data.nla_tracks.new();tr.name=name;strip=tr.strips.new(name,1,a);strip.name=name
 tr.mute=True
 return a
def idle(t):
 q=sin(2*pi*t);rig.pose.bones['Chest'].rotation_euler.x=.012*q
 rig.pose.bones['Head'].rotation_euler.z=.014*sin(2*pi*t+.4)
 rig.pose.bones['Hips'].location.y=.002*q
 for s in ['L','R']:rig.pose.bones['Forearm.'+s].rotation_euler.x=-.025+.012*q
 rig.pose.bones['Ahoge'].rotation_euler.x=.035*q
 for j in range(8):rig.pose.bones['Skirt.%02d'%j].rotation_euler.x=.01*sin(2*pi*t+j*.6)
def walk(t):
 q=sin(2*pi*t);rig.pose.bones['Hips'].location.y=.011*(1-cos(4*pi*t))
 rig.pose.bones['Chest'].rotation_euler.z=.035*q
 for s,side in [(1,'L'),(-1,'R')]:
  p=q*s;rig.pose.bones['Thigh.'+side].rotation_euler.x=.16*p
  rig.pose.bones['Shin.'+side].rotation_euler.x=max(0,-p)*.20
  rig.pose.bones['Foot.'+side].rotation_euler.x=-.06*p
  rig.pose.bones['UpperArm.'+side].rotation_euler.x=-.18*p
  rig.pose.bones['Forearm.'+side].rotation_euler.x=-.09
 for j in range(8):
  rig.pose.bones['Skirt.%02d'%j].rotation_euler.x=.025*q*cos(j*pi/4)
  rig.pose.bones['Skirt.%02d'%j].rotation_euler.z=.012*sin(2*pi*t+j*pi/4)
 rig.pose.bones['Ahoge'].rotation_euler.x=.055*q
# One-handed controlled diagonal slash, in-place with no physics/root displacement.
def attack(t):
 if t<.32:k=t/.32
 elif t<.58:k=1-(t-.32)/.26*1.8
 else:k=-.8*(1-(t-.58)/.42)
 rig.pose.bones['Chest'].rotation_euler.z=-.32*k
 rig.pose.bones['UpperArm.R'].rotation_euler.x=-1.05*k
 rig.pose.bones['UpperArm.R'].rotation_euler.z=-.48*k
 rig.pose.bones['Forearm.R'].rotation_euler.x=-.35*max(k,0)
 rig.pose.bones['Hand.R'].rotation_euler.z=.25*k
 rig.pose.bones['UpperArm.L'].rotation_euler.x=.3*k
 rig.pose.bones['Head'].rotation_euler.z=.13*k
 rig.pose.bones['Hips'].rotation_euler.x=.045*sin(pi*t)
 for j in range(8):rig.pose.bones['Skirt.%02d'%j].rotation_euler.z=.035*k
idle_action=make_action('Idle',[(1,0),(16,.25),(31,.5),(46,.75),(61,1)],idle)
make_action('Walk',[(1,0),(5,.125),(9,.25),(13,.375),(17,.5),(21,.625),(25,.75),(29,.875),(33,1)],walk)
make_action('Attack',[(1,0),(7,.2),(11,.32),(15,.46),(19,.58),(25,.8),(31,1)],attack)
clear_pose();rig.animation_data.action=None;scene.frame_set(1)
# -- Studio lighting / cameras; deliberately not exported. --
def stage_object(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 rendercol.objects.link(o);return o
floor=mat('Studio | midnight',(.014,.023,.046),.15,.5)
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=.62,depth=.045,location=(0,.025,-.032));o=stage_object(bpy.context.object);o.name='Display plinth';o.data.materials.append(floor);bevel(o,.012,3)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.06));o=stage_object(bpy.context.object);o.name='Studio floor';o.data.materials.append(floor)
# restrained warm summoning ring visual in preview only
ringmat=mat('Studio | dim halo gold',(.62,.3,.05),.4,.3,.3)
bpy.ops.mesh.primitive_torus_add(major_segments=96,minor_segments=8,location=(0,.025,-.006),major_radius=.52,minor_radius=.002);o=stage_object(bpy.context.object);o.data.materials.append(ringmat)
def track(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,energy,color,size):
 bpy.ops.object.light_add(type='AREA',location=loc);o=stage_object(bpy.context.object);o.name=name;o.data.energy=energy;o.data.color=color;o.data.shape='DISK';o.data.size=size;track(o,(0,0,1.0))
light('Key | broad warm softbox',(-3,-4,5),300,(1,.88,.74),3.0)
light('Fill | cool front',(3,-2,2.8),150,(.72,.82,1),2.5)
light('Rim | gold hair separation',(1,2.0,3.1),420,(1,.79,.48),2)
light('Face | small fill',(0,-3,1.8),60,(1,.95,.88),1.6)
world=bpy.data.worlds.new('Midnight studio world');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.071,.11,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35
bpy.ops.object.camera_add(location=(2.3,-4.8,2.2));cam=stage_object(bpy.context.object);cam.name='Camera | hero';cam.data.type='ORTHO';cam.data.ortho_scale=2.15;track(cam,(0,0,.87));scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=False
scene.render.resolution_x=1300;scene.render.resolution_y=1600;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.render.fps=30
scene['asset_role']='Sunset Kingdom first contract servant — original fan-art Saber / Artoria Pendragon'
scene['rights_note']='Unofficial fan art. Character rights belong to TYPE-MOON / FGO PROJECT. No third-party mesh or texture reused.'
scene['build_version']='1.0.0';scene['forward_blender']='-Y';scene['forward_gltf']='+Z'
# Save fully editable source before any export merges.
for o in bpy.context.selected_objects:o.select_set(False)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE,'saber_contract_servant.blend'),compress=True)
# Apply modeling modifiers to a duplicate, preserving the original source objects in .blend.
exportparts=[]
for o in parts:
 cp=o.copy();cp.data=o.data.copy();asset.objects.link(cp);cp.name='EXPORT | '+o.name
 for mod in list(cp.modifiers):
  if mod.type=='ARMATURE':continue
  bpy.context.view_layer.objects.active=cp;cp.select_set(True)
  try:bpy.ops.object.modifier_apply(modifier=mod.name)
  except Exception as e:print('MODIFIER',o.name,str(e))
  cp.select_set(False)
 exportparts.append(cp)
for o in bpy.context.selected_objects:o.select_set(False)
for o in exportparts:o.select_set(True)
bpy.context.view_layer.objects.active=exportparts[0];bpy.ops.object.join();joined=bpy.context.object;joined.name='Saber_SkinnedMesh'
# normalize normals and weights, robust to transform application
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
dec=joined.modifiers.new('Runtime triangle budget','DECIMATE');dec.ratio=.50;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
tri=joined.modifiers.new('Runtime triangulation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
for o in bpy.context.selected_objects:o.select_set(False)
joined.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE,'saber_contract_servant.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_force_sampling=True,export_frame_range=False,export_skins=True,export_normals=True,export_texcoords=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
for tr in rig.animation_data.nla_tracks:tr.mute=True
stats={'triangles':len(joined.data.polygons),'vertices':len(joined.data.vertices),'bones':len(rig.data.bones),'materials':len(joined.data.materials),'editable_parts':len(parts),'clips':{a.name:[a.frame_range[0],a.frame_range[1]] for a in bpy.data.actions},'blender_units':'metres','gltf_forward':'+Z','origin':'feet','estimated_height_without_ahoge_m':1.686,'glb_bytes':os.path.getsize(os.path.join(BASE,'saber_contract_servant.glb'))}
with open(os.path.join(BASE,'qa','build_stats.json'),'w') as f:json.dump(stats,f,indent=2)
bpy.data.objects.remove(joined,do_unlink=True)
clear_pose();scene.frame_set(1)
# Rendering can be suppressed for mesh-only re-runs using SABER_SKIP_RENDER.
if not os.environ.get('SABER_SKIP_RENDER'):
 for name,loc,target,scale,res in [
 ('01_hero',(2.3,-4.8,2.2),(0,0,.87),2.1,(1300,1600)),
 ('02_face',(.58,-2.9,1.72),(0,-.015,1.558),.44,(1300,1300)),
 ('03_back',(-2.2,4.6,2.0),(0,0,.86),2.05,(1300,1600)),
 ('04_front',(0,-5,1.55),(0,0,.86),2.04,(1300,1600)),
 ('05_tps_scale',(2.7,4.2,2.7),(0,0,.92),3.1,(1600,1100))]:
  cam.location=loc;track(cam,target);cam.data.ortho_scale=scale;scene.render.resolution_x=res[0];scene.render.resolution_y=res[1];scene.render.filepath=os.path.join(BASE,'renders',name+'.png');bpy.ops.render.render(write_still=True)
print('SABER_BUILD_STATS',json.dumps(stats))
