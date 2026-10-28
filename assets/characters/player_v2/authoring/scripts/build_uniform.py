import bpy,bmesh,math,json,os,struct,hashlib
from mathutils import Vector, Matrix
from pathlib import Path
exec(Path(__file__).with_name('_paths.py').read_text())
CX=.0005088
bpy.ops.wm.open_mainfile(filepath=D+'/sculpt/00_base_rigged.blend')
arm=bpy.data.objects['Armature'];arm.name='Ritsuka_Skeleton'
for o in list(bpy.data.objects):
 if o not in [arm,bpy.data.objects['Body']]:bpy.data.objects.remove(o,do_unlink=True)
source=bpy.data.objects['Body'];source.name='SOURCE_Body_Editable';source.hide_render=True;source.hide_set(True)
# Materials are deliberately matte woven cloth, soft leather and restrained warm alloy.
def material(name,color,rough=.85,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Specular IOR Level'].default_value=.25;return m
white=material('Chaldea • porcelain-white tailored twill',(.72,.74,.77),.88)
seam=material('Chaldea • cool-gray seam piping',(.24,.28,.34),.93)
dark=material('Chaldea • charcoal trouser wool',(.024,.028,.039),.94)
leather=material('Chaldea • matte black harness leather',(.011,.014,.02),.69)
shoe=material('Chaldea • soft dark shoe leather',(.025,.029,.036),.61)
gold=material('Chaldea • brushed old-gold fittings',(.53,.37,.095),.4,.7)
skin=material('Ritsuka • bare hands warm skin',(.57,.38,.26),.86)
red=material('Ritsuka • anatomical right dorsal command seal',(.38,.012,.016),.9)
# Generic helpers.
def active(o):
 bpy.ops.object.select_all(action='DESELECT');o.hide_set(False);o.select_set(True);bpy.context.view_layer.objects.active=o

def bind(o):
 for m in list(o.modifiers):
  if m.type=='ARMATURE':o.modifiers.remove(m)
 mod=o.modifiers.new('Formal skeletal deformation','ARMATURE');mod.object=arm;mod.use_deform_preserve_volume=False;o.parent=arm

def weight(o,i,ws):
 for name,w in ws.items():
  if w<1e-7:continue
  g=o.vertex_groups.get(name)or o.vertex_groups.new(name=name);g.add([i],w,'REPLACE')

def uniform_weight(o,bone):
 o.vertex_groups.clear()
 for i in range(len(o.data.vertices)):weight(o,i,{bone:1})

def extract(name,keep):
 o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o);o.name=name;o.hide_render=False;o.hide_set(False)
 if o.data.shape_keys:o.shape_key_clear()
 bm=bmesh.new();bm.from_mesh(o.data)
 bmesh.ops.delete(bm,geom=[f for f in bm.faces if not keep(f)],context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000008);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();return o

def setmat(o,m):
 o.data.materials.clear();o.data.materials.append(m)
 for p in o.data.polygons:p.material_index=0;p.use_smooth=True

def mesh(name,verts,faces,mat,weights=None):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);setmat(o,mat)
 if weights:
  for i,w in enumerate(weights):weight(o,i,w)
 return o

def solidify(o,thickness=.0015):
 active(o);m=o.modifiers.new('Sewn cloth edge thickness','SOLIDIFY');m.thickness=thickness;m.offset=0;bpy.ops.object.modifier_apply(modifier=m.name)

def tube(name,pts,r,mat,bone=None,weights=None,sides=6):
 verts=[];faces=[];ws=[]
 for i,p in enumerate(pts):
  p=Vector(p);closed=(Vector(pts[0])-Vector(pts[-1])).length<1e-7
  t=(Vector(pts[(i+1)%(len(pts)-1)])-Vector(pts[(i-1)%(len(pts)-1)])).normalized() if closed else (Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(i-1,0)])).normalized();a=t.cross(Vector((0,1,0)))
  if a.length<.1:a=t.cross(Vector((1,0,0)))
  a.normalize();b=t.cross(a).normalized()
  for j in range(sides):
   an=2*math.pi*j/sides;verts.append(tuple(p+r*(a*math.cos(an)+b*math.sin(an))));ws.append(weights[i] if weights else {bone:1})
 for i in range(len(pts)-1):
  for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
 o=mesh(name,verts,faces,mat,ws);bind(o);return o

def patch(name,points,mat,bone,thick=.002):
 o=mesh(name,points,[tuple(range(len(points)))],mat,[{bone:1}for p in points]);solidify(o,thick);bind(o);return o
# Main garment starts with an actual anatomical continuous weighted surface, not segmented limb shells.
top=extract('Uniform_Continuous_Torso_Sleeves',lambda f:f.material_index==0 and min(v.co.z for v in f.verts)>1.06 and max(abs(v.co.x-CX)for v in f.verts)<.604)
for m in list(top.modifiers):top.modifiers.remove(m)
bm=bmesh.new();bm.from_mesh(top.data)
# Precise open boundaries for collar, hem and cuffs; source group interpolation survives bisect.
for pt,no in [((0,0,1.087),(0,0,-1)),((0,0,1.465),(0,0,1)),((.594+CX,0,0),(1,0,0)),((-.594+CX,0,0),(-1,0,0))]:
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=pt,plane_no=no,clear_outer=True,clear_inner=False)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
bmesh.ops.join_triangles(bm,faces=list(bm.faces),angle_face_threshold=.8,angle_shape_threshold=.8,cmp_uvs=False,cmp_materials=False)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.normal_update()
for v in bm.verts:
 x,y,z=v.co;ax=abs(x-CX)
 # Relax anatomical contour into fitted cloth with sleeve ease, localized elbow/waist folds.
 v.co+=v.normal*(.009+(.003 if ax>.18 else .003))
 if ax<.17:
  v.co.x=CX+(v.co.x-CX)*1.06;v.co.y=(v.co.y-.008)*1.06+.008
  v.co.y+=.0028*math.sin(65*(z-1.08)+x*27)*math.exp(-((z-1.115)/.045)**2)*(1 if y>0 else -1)
 else:
  centerz=1.404-ax*.006
  v.co.z=centerz+(v.co.z-centerz)*1.05
  # fine directed sleeve compression rather than rigid elbow ring
  disp=.0032*math.sin(90*(ax-.37)+y*36)*math.exp(-((ax-.37)/.065)**2)
  v.co+=v.normal*disp
# Tailoring: suppress body-muscle imprint and form a clean fitted elliptical waist.
for v in bm.verts:
 x,y,z=v.co;ax=abs(x-CX)
 if ax<.175 and z<1.385:
  rx=.142+.022*max(0,min(1,(z-1.11)/.23));ry=.102+.008*max(0,min(1,(z-1.11)/.23))
  rho=math.sqrt(((x-CX)/rx)**2+((y-.008)/ry)**2)
  amount=1 if z<1.15 else .75
  v.co.x=CX+(x-CX)*(1-amount+amount/max(rho,.1));v.co.y=.008+(y-.008)*(1-amount+amount/max(rho,.1))
bm.to_mesh(top.data);bm.free();setmat(top,white)
# One smoothing level only, applied prior to binding; keeps shoulders/arm joints connected.
active(top);sub=top.modifiers.new('Tailored surface refinement L1','SUBSURF');sub.levels=1;sub.render_levels=1;bpy.ops.object.modifier_apply(modifier=sub.name)
bind(top) # Main opaque cloth remains single-surface; no hidden full inner duplicate.
# Continuous source hands, including every real finger phalanx and nail surface. Keep wrist under cuff.
hands=extract('Bare_Articulated_Hands',lambda f:f.material_index==0 and min(abs(v.co.x-CX)for v in f.verts)>.569)
setmat(hands,skin);bind(hands)
# Trousers from continuous source garment; calibrated wider drape not skin-colored leg tubes.
pants=extract('Trousers_Continuous_Tailored',lambda f:f.material_index==3)
setmat(pants,dark)
for v in pants.data.vertices:
 x,y,z=v.co;center=CX+(.068 if x>CX else -.068)
 # retain source knee fold loops and expand only calf's outer silhouette subtly
 if z<.9:
  v.co.x=center+(x-center)*1.10;v.co.y=(y-.008)*1.06+.008
 # Hidden upper fly/waist volume stays under the fitted tunic instead of crossing its front panel.
 if z>1.0 and y>.008:v.co.y=.008+(v.co.y-.008)*(1-.22*max(0,min(1,(z-1.0)/.04)))
for m in list(pants.modifiers):pants.modifiers.remove(m)
active(pants);bm=bmesh.new();bm.from_mesh(pants.data);bmesh.ops.join_triangles(bm,faces=list(bm.faces),angle_face_threshold=.8,angle_shape_threshold=.8,cmp_uvs=False,cmp_materials=False);bm.to_mesh(pants.data);bm.free();su=pants.modifiers.new('Trouser fold refinement L1','SUBSURF');su.levels=1;bpy.ops.object.modifier_apply(modifier=su.name);bind(pants)
# Original low-shoe silhouette is re-authored as a connected soft leather last, not a hard sneaker block.
for side,sgn in [('R',1),('L',-1)]:
 vv=[];ff=[];ww=[];N=48;cx=CX+sgn*.057
 for ring,(t,zz) in enumerate([(0,.003),(0,.007),(0,.018),(.025,.024),(.17,.043),(.42,.059),(.72,.079),(1,.094)]):
  for j in range(N):
   a=2*math.pi*j/N;co=math.cos(a);si=math.sin(a)
   rx=(.046-.009*max(0,-co))*(1-t)+.029*t
   y=(.044+.128*co)*(1-t)+(-.024+.034*co)*t
   x=cx+rx*si
   z=zz-(.016*max(0,co)*math.sin(t*math.pi) if ring>2 else 0)
   vv.append((x,y,z));toe=max(0,min(.55,(y-.065)/.15));ww.append({'J_Bip_'+side+'_Foot':1-toe,'J_Bip_'+side+'_ToeBase':toe})
 for r in range(7):
  for j in range(N):ff.append((r*N+j,r*N+(j+1)%N,(r+1)*N+(j+1)%N,(r+1)*N+j))
 ff.append(tuple(reversed(range(N))))
 o=mesh('Low_Soft_Leather_Shoe_'+side,vv,ff,shoe,ww)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 active(o);su=o.modifiers.new('Soft rounded shoe last','SUBSURF');su.levels=1;bpy.ops.object.modifier_apply(modifier=su.name);bind(o)
# Source skin hidden beneath opaque garments is intentionally not exported.
# Add four two-link panel chains under pelvis. Names encode anatomical L/R, not image position.
active(arm);bpy.ops.object.mode_set(mode='EDIT')
for side,sgn in [('R',1),('L',-1)]:
 for front,yy in [('Front',.086),('Back',-.078)]:
  n='Uniform'+front+'_'+side;b=arm.data.edit_bones.new(n);b.head=(CX+sgn*.092,yy,1.092);b.tail=(CX+sgn*.108,yy*1.15,.985);b.parent=arm.data.edit_bones['J_Bip_C_Hips'];t=arm.data.edit_bones.new(n+'_Tip');t.head=b.tail;t.tail=(CX+sgn*.128,yy*1.38,.865);t.parent=b;t.use_connect=True
bpy.ops.object.mode_set(mode='OBJECT')
# Curved split tunic panels: sewn at waist, eased outward over hips. Four overlapping seam allowances.
for side,sgn in [('R',1),('L',-1)]:
 for front,fs in [('Front',1),('Back',-1)]:
  n='Uniform'+front+'_'+side;verts=[];faces=[];ww=[];rows=9;cols=17
  for r in range(rows):
   t=r/(rows-1)
   for c in range(cols):
    u=c/(cols-1);theta=.016+(math.pi/2-.032)*u
    rx=.143+.035*t;ry=.104+.028*t
    # angle starts center and moves to side; front has a real center split, back subtle seam
    x=CX+sgn*(rx*math.sin(theta)+(.006*t if front=='Front' else 0))
    y=.008+fs*ry*math.cos(theta)
    z=1.097-.218*t+(.022*u*t if front=='Front' else .01*u*t)
    ripple=.0025*math.sin(u*math.pi*4+.7)*math.sin(t*math.pi)*t
    x+=sgn*ripple*math.sin(theta);y+=fs*ripple*math.cos(theta)
    verts.append((x,y,z));a=max(0,1-t*2.8);tip=max(0,(t-.35)/.65);base=(1-a)*(1-tip);ww.append({'J_Bip_C_Hips':a,n:base,n+'_Tip':(1-a)*tip})
  for r in range(rows-1):
   for c in range(cols-1):
    face=(r*cols+c,r*cols+c+1,(r+1)*cols+c+1,(r+1)*cols+c)
    if fs*sgn<0:face=tuple(reversed(face))
    faces.append(face)
  o=mesh(n+'_Fabric',verts,faces,white,ww);solidify(o,.0018);bind(o)
  # Discreet gray stitch line only along true hem and closure edge, no cartoon black ring.
  for label,ids in [('Hem',[(rows-1)*cols+c for c in range(cols)]),('Closure',[r*cols for r in range(rows)])]:
   pts=[Vector(verts[i])+Vector((0,fs*.0017,0))for i in ids];tube(n+'_'+label+'_Stitch',pts,.00075,seam,weights=[ww[i]for i in ids],sides=4)
# Contoured black belt, shared pelvis weights. One continuous flexible loop.
verts=[];faces=[]
for row,z in enumerate([1.076,1.083,1.112,1.119]):
 for i in range(64):
  a=2*math.pi*i/64;verts.append((CX+.151*math.sin(a),.008+.112*math.cos(a),z))
for r in range(3):
 for i in range(64):faces.append((r*64+i,r*64+(i+1)%64,(r+1)*64+(i+1)%64,(r+1)*64+i))
belt=mesh('Waist_Belt_Continuous',verts,faces,leather,[{'J_Bip_C_Hips':1}for p in verts]);solidify(belt,.004);bind(belt)
# Rectangular hollow buckle and narrow keeper.
for name,pts,r in [('Gold_Buckle',[(CX-.032,.126,1.079),(CX+.033,.126,1.079),(CX+.033,.126,1.118),(CX-.032,.126,1.118),(CX-.032,.126,1.079)],.0038),('Buckle_Pin',[(CX-.028,.131,1.099),(CX+.018,.131,1.099)],.0018)]:tube(name,pts,r,gold,'J_Bip_C_Hips',sides=8)
for sx in [-1,1]:
 x=CX+sx*.073;y=.008+.116*math.sqrt(1-(sx*.073/.154)**2);patch('Belt_Leather_Keeper_'+str(sx),[(x-.006,y,1.072),(x+.006,y,1.072),(x+.006,y,1.122),(x-.006,y,1.122)],leather,'J_Bip_C_Hips',.003)
# Collar sits on the shirt/neck surface, with 2mm layer separation, not a floating chest badge.
from mathutils.bvhtree import BVHTree
bv=BVHTree.FromObject(top,bpy.context.evaluated_depsgraph_get())
def collar_y(x,z):
 if z>1.46:return .006+math.sqrt(max(.0001,.049**2-(x-CX)**2))+.002
 hit=bv.ray_cast(Vector((x,1,z)),Vector((0,-1,0)),2)
 return hit[0].y+.0025 if hit[0] else .06
# Crisp asymmetric collar lapels wrap the actual neck; separate layers are sewn details, all skinned.
patch('Collar_Left_Overlapping_Lapel',[(CX-.052,.043,1.475),(CX-.009,.055,1.482),(CX-.031,.087,1.438),(CX-.084,.067,1.458)],white,'J_Bip_C_UpperChest',.002)
patch('Collar_Right_Under_Lapel',[(CX+.009,.055,1.482),(CX+.051,.043,1.475),(CX+.085,.065,1.455),(CX+.039,.086,1.440)],white,'J_Bip_C_UpperChest',.002)
# Soft standing collar band around sides/rear, clear from jaw.
vv=[];ff=[]
for r,z in enumerate([1.45,1.486]):
 for i in range(25):
  a=math.pi*.34+(math.pi*1.32)*i/24;vv.append((CX+.056*math.sin(a),.001+.05*math.cos(a),z-(.01 if r else 0)*abs(math.sin(a))))
for i in range(24):ff.append((i,i+1,25+i+1,25+i))
o=mesh('Collar_Rear_Stand',vv,ff,white,[{'J_Bip_C_UpperChest':.75,'J_Bip_C_Neck':.25}for p in vv]);solidify(o,.002);bind(o)
# Patterned throat tab and double silver central fastening.
patch('Throat_Tab',[(CX-.012,.060,1.474),(CX+.012,.060,1.474),(CX+.016,.099,1.438),(CX,.113,1.425),(CX-.016,.099,1.438)],leather,'J_Bip_C_UpperChest')
for zz,rr in [(1.462,.007),(1.444,.006)]:tube('Throat_Embroidery',[(CX,.115,zz+rr),(CX+rr,.115,zz),(CX,.115,zz-rr),(CX-rr,.115,zz),(CX,.115,zz+rr)],.0008,gold,'J_Bip_C_UpperChest',sides=4)
for o in bpy.data.objects:
 if o.type=='MESH' and o.name.startswith('Throat_Embroidery'):
  for v in o.data.vertices:v.co.y=.060+(1.474-v.co.z)*1.08+.0035
# Torso nearest-front surface sampling, so seams are sewn to the rounded shirt rather than floating.
from mathutils.bvhtree import BVHTree
bv=BVHTree.FromObject(top,bpy.context.evaluated_depsgraph_get())
def fronty(x,z,offset=.0016):
 hit=bv.ray_cast(Vector((x,1,z)),Vector((0,-1,0)),2)
 return hit[0].y+offset if hit[0] else .11

def torso_weights(z):
 if z>=1.31:return {'J_Bip_C_UpperChest':1}
 if z>=1.23:
  t=(z-1.23)/.08;return {'J_Bip_C_Chest':1-t,'J_Bip_C_UpperChest':t}
 if z>=1.15:
  t=(z-1.15)/.08;return {'J_Bip_C_Spine':1-t,'J_Bip_C_Chest':t}
 t=max(0,min(1,(z-1.08)/.07));return {'J_Bip_C_Hips':1-t,'J_Bip_C_Spine':t}
for sx in [-1,1]:
 pts=[];ww=[]
 for i in range(36):
  z=1.12+(1.437-1.12)*i/35;x=CX+sx*.0021+.001*math.sin((z-1.1)*13);pts.append((x,fronty(x,z),z));ww.append(torso_weights(z))
 tube('Central_Fastening_'+str(sx),pts,.0009,seam,weights=ww,sides=4)
# Chest harness follows continuous chest; triangular gold fittings sit beside the armhole.
vv=[];ff=[];ww=[]
for r,dz in enumerate([-.009,.009]):
 for i in range(33):
  x=CX-.151+.302*i/32;z=1.365+dz;vv.append((x,fronty(x,z,.004),z));ww.append({'J_Bip_C_UpperChest':1})
for i in range(32):ff.append((i,i+1,33+i+1,33+i))
o=mesh('Upper_Chest_Harness',vv,ff,leather,ww);solidify(o,.0028);bind(o)
for sx in [-1,1]:
 x=CX+sx*.151;y=fronty(x,1.365,.008)
 tube('Triangular_Chest_Fitting_'+str(sx),[(x-sx*.011,y,1.354),(x+sx*.011,y,1.365),(x-sx*.011,y,1.378),(x-sx*.011,y,1.354)],.0018,gold,'J_Bip_C_UpperChest',sides=6)
 # pale shoulder strap, outlined fine stitched perimeter
 points=[(CX+sx*.153,fronty(CX+sx*.153,1.374,.0028),1.374),(CX+sx*.13,fronty(CX+sx*.13,1.418,.0028),1.418),(CX+sx*.105,.046,1.465)]
 tube('Shoulder_Seam_'+str(sx),points,.0011,seam,'J_Bip_C_UpperChest',sides=5)
# Restrained cuff facings follow forearm, no isolated exposed elbow/knee rings.
for side,sgn in [('R',1),('L',-1)]:
 vv=[];ff=[]
 for row,xx in enumerate([.568,.587,.595]):
  for j in range(24):
   a=2*math.pi*j/24;vv.append((CX+sgn*xx,.011+.034*math.cos(a),1.401+.0305*math.sin(a)))
 for r in range(2):
  for j in range(24):ff.append((r*24+j,r*24+(j+1)%24,(r+1)*24+(j+1)%24,(r+1)*24+j))
 o=mesh('Cuff_'+side,vv,ff,white,[{'J_Bip_'+side+'_LowerArm':1}for p in vv]);solidify(o,.002);bind(o)
 pts=[(CX+sgn*.582,.011+.035*math.cos(2*math.pi*j/24),1.401+.0315*math.sin(2*math.pi*j/24))for j in range(25)];tube('Cuff_Gray_Edge_'+side,pts,.0018,seam,'J_Bip_'+side+'_LowerArm',sides=5)
# Dorsal anatomical RIGHT hand: palm in source T-pose is downward (-Z), back faces +Z.
# Stylized original three-branch red seal built as skin-following small ribbons, not a mirrored left-hand tattoo.
paths=[[(.621,.043),(.635,.049),(.651,.050),(.642,.039),(.632,.026),(.620,.020)],[(.620,.044),(.634,.033),(.647,.024),(.657,.029),(.647,.036)],[(.626,.031),(.629,.017),(.639,.010),(.647,.012),(.641,.019)]]
# Use hand surface BVH; downward ray lands on back of source mesh.
hb=BVHTree.FromObject(hands,bpy.context.evaluated_depsgraph_get())
for num,path in enumerate(paths):
 pts=[]
 for a,b in zip(path[:-1],path[1:]):
  for k in range(5):
   t=k/5;x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t;hit=hb.ray_cast(Vector((x+CX,y,1.50)),Vector((0,0,-1)),.3);z=hit[0].z+.00045 if hit[0]else 1.411;pts.append((x+CX,y,z))
 # A printed skin mark: flat conforming ribbons, not raised red tubes.
 from mathutils.geometry import barycentric_transform
 vv=[];ff=[];ww=[]
 for i,p in enumerate(pts):
  tangent=(Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(i-1,0)])).normalized();perp=Vector((-tangent.y,tangent.x,0)).normalized()
  for side in [-1,1]:
   q=Vector(p)+perp*(side*.00078);hit=hb.ray_cast(Vector((q.x,q.y,1.50)),Vector((0,0,-1)),.3)
   if not hit[0]:raise RuntimeError('Seal point misses right dorsal surface')
   q=hit[0]+Vector((0,0,.00012));vv.append(tuple(q));poly=hands.data.polygons[hit[2]];ids=list(poly.vertices);assert len(ids)==3
   bc=barycentric_transform(hit[0],*[hands.data.vertices[j].co for j in ids],Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
   weights={}
   for vi,factor in zip(ids,bc):
    for g in hands.data.vertices[vi].groups:
     name=hands.vertex_groups[g.group].name;weights[name]=weights.get(name,0)+g.weight*max(0,factor)
   total=sum(weights.values());ww.append({n:w/total for n,w in weights.items()if w>1e-7})
 for i in range(len(pts)-1):ff.append((2*i+1,2*i,2*i+2,2*i+3))
 o=mesh('Right_Dorsal_Command_Seal_'+str(num),vv,ff,red,ww);bind(o)
# Approved head portable art is appended without touching shape/UV/material bytes.
with bpy.data.libraries.load(H+'/approved_head_portable.blend',link=False)as (a,b):b.objects=[n for n in a.objects if n in ['Authored_Male_Brows','Eye_Back','Hair_Underlayer_Continuous_Fitted','Head_Skin_Editable','Iris','Lid_Lines','Mouth_Interior','Ritsuka_Hair_Editable_CC0_Adaptation','Sclera']]
weights=json.load(open(D+'/qa/approved-head-evaluated-weights.json'));headreport={}
for o in b.objects:
 bpy.context.collection.objects.link(o);n=o.name;w=weights[n];assert len(o.data.vertices)==len(w['vertices']);err=max((v.co-Vector(p)).length for v,p in zip(o.data.vertices,w['vertices']));assert err<1e-7,(n,err)
 o.vertex_groups.clear()
 # Stable group definitions; equivalent equal-weight joint-slot permutations are checked semantically.
 for bone in arm.data.bones:o.vertex_groups.new(name=bone.name)
 for i,ws in enumerate(w['weights']):weight(o,i,ws)
 for v in o.data.vertices:v.co+=Vector((CX,0,1.603))
 bind(o);headreport[n]={'vertices':len(o.data.vertices),'approved_geometry_max_error_before_translation_m':err}
# Clean export groups to actual skeleton; normalize four max influences, preserve head eye labels.
objects=[o for o in bpy.data.objects if o.type=='MESH' and not o.hide_render]
for o in objects:
 for v in o.data.vertices:
  ws=sorted([(o.vertex_groups[g.group].name,g.weight)for g in v.groups if g.weight>1e-7 and o.vertex_groups[g.group].name in arm.data.bones],key=lambda t:-t[1])[:4]
  for g in list(v.groups):o.vertex_groups[g.group].remove([v.index])
  if not ws:raise RuntimeError('Unweighted '+o.name+' '+str(v.index))
  total=sum(w for n,w in ws)
  for n,w in ws:weight(o,v.index,{n:w/total})
# Eliminate invisible authoring source from final scene (preserved in initial rigged blend).
bpy.data.objects.remove(source,do_unlink=True)
# Save native editable rig plus export exact neutral pose.
sc=bpy.context.scene;sc.render.engine='BLENDER_EEVEE_NEXT';sc.world=bpy.data.worlds.new('Studio World');sc.world.color=(.15,.17,.2)
bpy.ops.wm.save_as_mainfile(filepath=D+'/sculpt/02_chaldea_skinned_master.blend')
active(arm)
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT+'/player_v2.glb',export_format='GLB',use_selection=True,export_apply=False,export_yup=True,export_animations=False,export_morph=False,export_skins=True,export_materials='EXPORT',export_all_influences=False)
p=OUT+'/player_v2.glb';data=open(p,'rb').read();jlen,jtyp=struct.unpack_from('<II',data,12);doc=json.loads(data[20:20+jlen]);binary=data[20+jlen:]
for m in doc.get('materials',[]):
 if m.get('name')in ['Ritsuka_Iris_BlueCyan','Ritsuka_Lid_Line']:m['alphaMode']='MASK';m['alphaCutoff']=.5
jb=json.dumps(doc,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4);open(p,'wb').write(struct.pack('<III',0x46546c67,2,20+len(jb)+len(binary))+struct.pack('<II',len(jb),0x4e4f534a)+jb+binary)
json.dump(headreport,open(D+'/qa/head-exact-geometry-transfer.json','w'),indent=2)
manifest={'status':'WIP art candidate; neutral full-body/posed visual gates pending','source_orientation':'meters, glTF Y-up, faces -Z; NO mirror or extra Y rotation','bones':len(arm.data.bones),'source_bones':67,'cloth_bones':8,'hand_dorsal_source_blender':[0,0,1],'hand_palm_source_blender':[0,0,-1],'original_54_expressions_recovered':False,'expression_policy':'neutral only','head_policy':'Exact approved geometry + UVs/maps/materials, source correspondence-derived weight recovery; hair rigid to Head','meshes':{},'glb_bytes':os.path.getsize(p),'sha256':hashlib.sha256(open(p,'rb').read()).hexdigest(),'materials':[m['name']for m in doc['materials']]}
for o in objects:
 o.data.calc_loop_triangles();manifest['meshes'][o.name]={'vertices':len(o.data.vertices),'triangles':len(o.data.loop_triangles)}
manifest['triangles']=sum(m['triangles']for m in manifest['meshes'].values());manifest['vertices']=sum(m['vertices']for m in manifest['meshes'].values());json.dump(manifest,open(OUT+'/manifest.json','w'),indent=2);print(json.dumps({k:v for k,v in manifest.items()if k!='meshes'},indent=2))
