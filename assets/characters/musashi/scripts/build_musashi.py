"""Authored reference-led Musashi derivative: only licensed base anatomy/face/rig reused.
All hair, kimono, obi, boots, gloves, ornaments and katana authored here.
Source units are retained until export, where a 0.72 root produces adult 1.67m stature.
"""
import bpy,math,json,bmesh,sys,os
from pathlib import Path
from mathutils import Vector,Quaternion
from mathutils.kdtree import KDTree
R=Path(__file__).resolve().parents[1]
SRC=Path(os.environ.get('MUSASHI_BASE_BLEND',str(R.parents[2]/'research/creator-artoria/default-import-inspection.blend')))
if not SRC.is_file():raise FileNotFoundError('Set MUSASHI_BASE_BLEND to the licensed mastjie base import. See README; delivered blends/GLBs are self-contained.')
bpy.ops.wm.open_mainfile(filepath=str(SRC),load_ui=False,use_scripts=False)
sc=bpy.context.scene
arm=bpy.data.objects['Armature'];arm.animation_data_clear();arm.name='Musashi_Rig'
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
for p in arm.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
for o in list(bpy.data.objects):
 if o not in [arm,bpy.data.objects.get('Body'),bpy.data.objects.get('Face')]:bpy.data.objects.remove(o,do_unlink=True)
body=bpy.data.objects['Body'];face=bpy.data.objects['Face']
col=bpy.data.collections.new('MUSASHI • authored costume and hair');sc.collection.children.link(col)
def mat(name,c,metal=0,rough=.5):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
blue=mat('Kimono • deep violet blue silk',(.035,.008,.255),0,.46)
red=mat('Lacquer and silk • wine crimson',(.24,.009,.026),.03,.4)
redlight=mat('Carmine red piping',(.47,.018,.043),0,.48)
gold=mat('Antique gold braid',(.66,.37,.035),.68,.31)
goldlight=mat('Raised gold thread',(.85,.59,.12),.45,.38)
dark=mat('Charcoal plum gloves and stockings',(.038,.023,.029),0,.68)
black=mat('Obsidian ribbon and fittings',(.009,.007,.012),.12,.4)
hair=mat('Warm porcelain rose hair',(.57,.45,.46),0,.4)
hairlight=mat('Pearl hair highlight',(.78,.66,.63),0,.42)
hairshadow=mat('Rose hair strand shadow',(.42,.29,.33),0,.49)
skin=mat('Warm skin satin',(.91,.70,.56),0,.72)
silver=mat('Katana • folded polished steel',(.54,.61,.70),.85,.22)
edge=mat('Katana • honed silver edge',(.81,.85,.88),.92,.17)
blue.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.65
blue.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.23
for m in [blue,red,dark]:
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Sheen Weight'].default_value=.18
 n=m.node_tree.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=500;b=m.node_tree.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.11;b.inputs['Distance'].default_value=.0004;m.node_tree.links.new(n.outputs['Fac'],b.inputs['Height']);m.node_tree.links.new(b.outputs['Normal'],p.inputs['Normal'])
for m in [hair,hairlight]:m.node_tree.nodes.get('Principled BSDF').inputs['Anisotropic'].default_value=.36
# World-coordinate sculpt on all facial keys preserves their relative deformation.
def sculpt(v):
 x,y,z=v
 if z>1.95:
  x*=.96
  # Less childlike cheek width, slightly longer adult lower face.
  z=2.16+(z-2.16)*1.015
  z-=.13*(z-2.14)*math.exp(-((abs(x)-.069)/.057)**4-((z-2.14)/.073)**4)
  if y<-.04:y-=.006*math.exp(-(x/.035)**2-((z-2.078)/.045)**2)
 else:
  if .9<z<1.45:x*=1+.015*math.exp(-((z-1.22)/.2)**2)
  if 1.52<z<1.85 and y<0:
   y-=.044*math.exp(-((abs(x)-.102)/.09)**2-((z-1.745)/.10)**2)*min(1,max(0,-y/.07))
 return Vector((x,y,z))
for ob in [body,face]:
 inv=ob.matrix_world.inverted()
 if ob.data.shape_keys:
  for key in ob.data.shape_keys.key_blocks:
   for v in key.data:v.co=inv@sculpt(ob.matrix_world@v.co)
 else:
  for v in ob.data.vertices:v.co=inv@sculpt(ob.matrix_world@v.co)
 for p in ob.data.polygons:p.use_smooth=True
body.data.materials.clear();body.data.materials.append(skin)
face.name='Musashi • sculpted anime face • 56 preserved morphs';body.name='Musashi • fitted adult base anatomy'
# Semantic names below verified by actual one-hot face renders, not index guessing.
morph_names={'target_1':'Angry','target_5':'Surprised','target_13':'Blink','target_14':'BlinkRight','target_15':'BlinkLeft','target_17':'HappyEyes','target_23':'HideIrises','target_32':'MouthOpenA'}
for old,new in morph_names.items():face.data.shape_keys.key_blocks[old].name=new
face['verified_morph_semantics']=json.dumps(morph_names)
# Repaint only face texture's green iris area and blonde brows, not skin or eyelashes.
import numpy as np
fm=face.data.materials[0].copy();fm.name='Musashi • blue eyes and pale brows';face.data.materials[0]=fm
tex=next(n for n in fm.node_tree.nodes if n.type=='TEX_IMAGE');im=tex.image.copy();im.name='Musashi_Face_Albedo';w,h=im.size;pix=np.array(im.pixels[:],dtype=np.float32).reshape(h,w,4)
mask=(pix[:,:,1]>pix[:,:,0]*1.06)&(pix[:,:,1]>pix[:,:,2]*1.06)&(pix[:,:,0]<.65)
lum=pix[:,:,:3].mean(2);pix[mask,0]=lum[mask]*.48;pix[mask,1]=lum[mask]*.87;pix[mask,2]=np.minimum(1,lum[mask]*1.2)
yy,xx=np.mgrid[0:h,0:w];bm=(yy>h*.91)&(xx>w*.55)&(pix[:,:,0]>.45)&(pix[:,:,2]<pix[:,:,0]*.92)
pix[bm,0]=.61;pix[bm,1]=.46;pix[bm,2]=.45
im.pixels[:]=pix.ravel();im.pack();tex.image=im
p=fm.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.72;p.inputs['Specular IOR Level'].default_value=.2
# Mesh helpers, UVs and weights are present on every authored part.
def rig(ob,bone='Hips'):
 if bone:
  g=ob.vertex_groups.new(name='mixamorig:'+bone);g.add(list(range(len(ob.data.vertices))),1,'REPLACE');md=ob.modifiers.new('Musashi skinning','ARMATURE');md.object=arm
 return ob
def mesh(name,vs,fs,ma,bone='Hips',solid=0,bev=0,smooth=True):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);col.objects.link(o);me.materials.append(ma)
 for p in me.polygons:p.use_smooth=smooth
 uv=me.uv_layers.new(name='UVMap')
 for p in me.polygons:
  for li in p.loop_indices:
   c=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(c.x*.5+.5,c.z/2.5)
 if solid:m=o.modifiers.new('Tailored thickness','SOLIDIFY');m.thickness=solid;m.offset=0
 if bev:m=o.modifiers.new('Soft crafted edges','BEVEL');m.width=bev;m.segments=2
 rig(o,bone);return o
def surf(name,fn,nu,nv,ma,bone='Hips',solid=.002,bev=0):
 vs=[fn(i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)];fs=[(j*(nu+1)+i,j*(nu+1)+i+1,(j+1)*(nu+1)+i+1,(j+1)*(nu+1)+i) for j in range(nv) for i in range(nu)];o=mesh(name,vs,fs,ma,bone,solid,bev)
 uv=o.data.uv_layers.active
 for loop in o.data.loops:idx=loop.vertex_index;uv.data[loop.index].uv=(idx%(nu+1)/nu,idx//(nu+1)/nv)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(o.data);bm.free()
 return o
def tube(name,pts,r,ma,bone='Hips',sides=8):
 vs=[]
 for i,p in enumerate(pts):
  p=Vector(p);t=(Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(i-1,0)])).normalized();q=t.cross(Vector((0,0,1)))
  if q.length<.01:q=t.cross(Vector((0,1,0)))
  q.normalize();b=t.cross(q)
  for j in range(sides):a=j*2*math.pi/sides;vs.append(p+r*(q*math.cos(a)+b*math.sin(a)))
 fs=[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j) for i in range(len(pts)-1) for j in range(sides)]+[tuple(range(sides-1,-1,-1)),tuple((len(pts)-1)*sides+j for j in range(sides))]
 return mesh(name,vs,fs,ma,bone)
def bez(ctrl,n=32):
 P=[Vector(v) for v in ctrl];res=[]
 for i in range(n+1):
  t=i/n;v=P.copy()
  while len(v)>1:v=[a.lerp(b,t) for a,b in zip(v[:-1],v[1:])]
  res.append(v[0])
 return res
def curve(name,ctrl,r,ma,bone='Hips',n=32):return tube(name,bez(ctrl,n),r,ma,bone)
def sphere(name,loc,scale,ma,bone='Head',segments=32,rings=20):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(ma)
 for p in o.data.polygons:p.use_smooth=True
 rig(o,bone);return o
# Weight-copy from adjacent anatomical surface for sleeves and continuous boots.
def clipped_skin(name,planes,ma,offset=.003):
 o=body.copy();o.data=body.data.copy();col.objects.link(o);o.name=name;o.data.materials.clear();o.data.materials.append(ma)
 bm=bmesh.new();bm.from_mesh(o.data);inv=o.matrix_world.inverted()
 for co,no,keep_positive in planes:
  bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=inv@Vector(co),plane_no=o.matrix_world.to_3x3().transposed()@Vector(no),clear_inner=keep_positive,clear_outer=not keep_positive)
 bm.normal_update()
 for v in bm.verts:v.co+=v.normal*offset
 bm.to_mesh(o.data);bm.free()
 if 'stocking' in name:
  side='Left' if name.startswith('Left') else 'Right';sign=1 if side=='Left' else -1
  for g in list(o.vertex_groups):o.vertex_groups.remove(g)
  for bn in ['UpLeg','Leg','Foot']:o.vertex_groups.new(name='mixamorig:'+side+bn)
  for v in o.data.vertices:
   p=o.matrix_world@v.co;z=p.z;t=max(0,min(1,(z-.115)/.12));p.y=.04+(p.y-.04)*(.72+.28*t);p.x=sign*.118+(p.x-sign*.118)*(.86+.14*t);v.co=o.matrix_world.inverted()@p
   u=max(0,min(1,(z-.60)/.21));u=u*u*(3-2*u);f=max(0,min(1,(z-.115)/.14));f=1-f*f*(3-2*f)
   for gi,w in enumerate([u,max(0,1-u-f),f]):
    if w>1e-6:o.vertex_groups[gi].add([v.index],w,'REPLACE')
 su=o.modifiers.new('Anatomical fabric subdivision','SUBSURF');su.levels=1;su.render_levels=1
 # Place subdivision before skin deformation to interpolate original skin weights.
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_move_up(modifier=su.name)
 m=o.modifiers.new('Fine fabric thickness','SOLIDIFY');m.thickness=.0015;return o
for s,side in [(1,'Left'),(-1,'Right')]:
 clipped_skin(side+' • seamless above-elbow arm cover',[((s*.31,0,0),(s,0,0),True),((s*.815,0,0),(s,0,0),False)],dark)
 clipped_skin(side+' • continuous thigh high stocking',[((0,0,1.025),(0,0,1),False),((0,0,.115),(0,0,1),True),((0,0,0),(s,0,0),True)],dark)
# Reference kimono: tailored sleeveless upper crossover, not a generic shirt.
profiles=[(1.40,.190,.153),(1.49,.154,.131),(1.58,.172,.139),(1.68,.204,.185),(1.75,.215,.196),(1.82,.189,.146),(1.90,.205,.10)]
def interp(rows,z):
 i=next((i for i in range(len(rows)-1) if rows[i][0]<=z<=rows[i+1][0]),0 if z<rows[0][0] else len(rows)-2);t=max(0,min(1,(z-rows[i][0])/(rows[i+1][0]-rows[i][0])));return [rows[i][k]*(1-t)+rows[i+1][k]*t for k in range(1,len(rows[0]))]
def torso(a,z,extra=0):
 rx,ry=interp(profiles,z);f=max(0,math.cos(a));cy=-.041+.066*max(0,min(1,(z-1.80)/.11))**2
 return Vector(((rx+extra)*math.sin(a),cy-(ry+extra)*math.cos(a),z))
def top(a):
 a=(a+math.pi)%(2*math.pi)-math.pi
 return 1.775+.135*math.exp(-((abs(a)-.72)/.37)**2) if abs(a)<=math.pi/2 else 1.92-.145*math.sin(a)**2
shirt=surf('Kimono • fitted sleeveless silk bodice',lambda u,v:torso(u*2*math.pi,1.40+.325*v),96,40,blue,'Spine1',.003)
# Blend upper-body garment weights through three spine joints.
for g in list(shirt.vertex_groups):shirt.vertex_groups.remove(g)
for bn in ['Spine','Spine1','Spine2']:shirt.vertex_groups.new(name='mixamorig:'+bn)
for v in shirt.data.vertices:
 z=v.co.z;t=max(0,min(2,(z-1.48)/.18));i=min(1,int(t));f=t-i
 shirt.vertex_groups[i].add([v.index],1-f,'REPLACE');shirt.vertex_groups[i+1].add([v.index],f,'REPLACE')
# Continuous V-wrap surface fitted to an anatomical torso proxy, not loose panels.
# Clipping the proxy's outstretched arms keeps radial fits inside the real armholes.
bpy.data.objects.remove(shirt,do_unlink=True)
proxy=body.copy();proxy.data=body.data.copy();col.objects.link(proxy);proxy.name='TEMP torso fitting proxy'
for md in list(proxy.modifiers):proxy.modifiers.remove(md)
bm=bmesh.new();bm.from_mesh(proxy.data);inv=proxy.matrix_world.inverted()
for side in [-1,1]:
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=inv@Vector((side*.227,0,0)),plane_no=proxy.matrix_world.to_3x3().transposed()@Vector((side,0,0)),clear_inner=False,clear_outer=True)
bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary]);bm.normal_update();bm.to_mesh(proxy.data);bm.free();proxy.data.update();bpy.context.view_layer.update()
def wrap_top(a):
 a=(a+math.pi)%(2*math.pi)-math.pi
 return interp([(0,1.805),(.55,1.89),(.90,1.90),(math.pi/2,1.795)],abs(a))[0] if abs(a)<=math.pi/2 else 1.94-.145*math.sin(a)**2
def wrap_point(a,z):
 cy=-.04+.065*max(0,min(1,(z-1.80)/.12));center=Vector((0,cy,z));radial=Vector((math.sin(a),-math.cos(a),0));origin=center+radial*.6
 hit,loc,no,idx=proxy.ray_cast(proxy.matrix_world.inverted()@origin,proxy.matrix_world.to_3x3().inverted()@(-radial))
 p=proxy.matrix_world@loc+radial*.009 if hit else torso(a,z,.005)
 # Silk bridges the breast-to-waist concavity rather than vacuum-wrapping anatomy.
 f=max(0,min(1,(z-1.77)/.09));p.y=torso(a,z,.008).y*(1-f)+p.y*f
 if math.cos(a)<0:p.y+=.009
 return p
shirt=surf('Kimono • continuous anatomical V crossover wrap',lambda u,v:wrap_point(u*2*math.pi,1.40+(wrap_top(u*2*math.pi)-1.40)*v),112,48,blue,'Spine1',.002)
tube('Kimono • crimson V neckline',[wrap_point(-math.pi/2+i/96*math.pi,wrap_top(-math.pi/2+i/96*math.pi)) for i in range(97)],.0028,redlight,'Spine2')
tube('Kimono • back shoulder edge',[wrap_point(math.pi/2+i/96*math.pi,wrap_top(math.pi/2+i/96*math.pi)) for i in range(97)],.0024,red,'Spine2')
bpy.data.objects.remove(proxy,do_unlink=True)
def body_y(x,z,front=True):
 origin=Vector((x,-1 if front else 1,z));direction=Vector((0,1 if front else -1,0));hit,loc,n,idx=body.ray_cast(body.matrix_world.inverted()@origin,body.matrix_world.to_3x3().inverted()@direction)
 return (body.matrix_world@loc).y+(-.010 if front else .010) if hit else (-.06 if front else .11)
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
body.data.calc_loop_triangles();skin_vs=[body.matrix_world@v.co for v in body.data.vertices];skin_tris=[tuple(t.vertices) for t in body.data.loop_triangles];skin_bvh=BVHTree.FromPolygons(skin_vs,skin_tris,all_triangles=True)
def transfer_skin(ob):
 for g in list(ob.vertex_groups):ob.vertex_groups.remove(g)
 for g in body.vertex_groups:ob.vertex_groups.new(name=g.name)
 for v in ob.data.vertices:
  loc,no,idx,dist=skin_bvh.find_nearest(ob.matrix_world@v.co)
  if idx is None:continue
  ids=skin_tris[idx];weights=barycentric_transform(loc,*[skin_vs[i] for i in ids],Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)));acc={}
  for vi,w in zip(ids,weights):
   for g in body.data.vertices[vi].groups:acc[g.group]=acc.get(g.group,0)+g.weight*max(0,w)
  total=sum(acc.values())
  for gi,w in acc.items():
   if w>1e-7:ob.vertex_groups[gi].add([v.index],w/total,'REPLACE')
transfer_skin(shirt)
for o in list(sc.objects):
 if o.type=='MESH' and ('crimson V neckline' in o.name or 'back shoulder edge' in o.name):transfer_skin(o)
# Crossover diagonal red piping from high collar down to left waist.
def lapel_y(x,z):
 hit,loc,no,idx=shirt.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
 return loc.y-.003 if hit else body_y(x,z,True)
pts=[]
for i in range(65):
 t=i/64;z=1.915-.45*t;x=.09-.22*t;pts.append((x,lapel_y(x,z),z))
tube('Kimono • diagonal crimson lapel',pts,.0033,redlight,'Spine1')
# A narrow gold stitch along the folded red lapel.
tube('Kimono • lapel gold running stitch',[(x+.005,y-.0005,z) for x,y,z in pts],.0008,gold,'Spine1',5)
for o in list(sc.objects):
 if o.type=='MESH' and ('diagonal crimson lapel' in o.name or 'lapel gold running' in o.name):transfer_skin(o)
# Standing collar, open at the front, follows neck.
surf('Kimono • raised standing collar',lambda u,v:(.081*math.sin(.26+u*(2*math.pi-.52)),.028-.076*math.cos(.26+u*(2*math.pi-.52)),1.89+.077*v),56,6,blue,'Neck',.003)
for z in [1.89,1.967]:tube('Collar • red rolled edge',[(.081*math.sin(.26+i/64*(2*math.pi-.52)),.028-.076*math.cos(.26+i/64*(2*math.pi-.52)),z) for i in range(65)],.0025,redlight,'Neck')
# Wide red-gold obi, individually stitched border and embroidered floral scatter.
def obi(a,z,ex=0):
 p=torso(a,z,.012+ex);p.z+=.006*math.sin(a)
 if math.cos(a)<0:p.y+=.014*math.cos(a)**2
 return p
surf('Obi • broad dark crimson silk',lambda u,v:obi(u*2*math.pi,1.398+.133*v),96,8,red,'Spine',.004)
for z in [1.404,1.52]:tube('Obi • raised gold border',[obi(i/96*2*math.pi,z,.003) for i in range(97)],.0023,gold,'Spine')
# Ornamental golden cloud/flower brocade conforms to obi ellipse.
for j in range(13):
 a=-1.3+j*.22;z=1.44+(j%3)*.024
 for petal in range(5):
  t=petal*2*math.pi/5;pts=[]
  for k in range(13):
   t2=k*2*math.pi/12;da=.038*math.cos(t)+.026*math.cos(t2);dz=.007*math.sin(t)+.006*math.sin(t2);pts.append(obi(a+da,z+dz,.005))
  tube('Obi • embroidered five-petal blossom',pts,.00105,goldlight,'Spine',6)
# Asymmetric overlapping short skirt panels: high open side, deep front angled hems.
def skirt(a,v,front=True):
 # Two wrap panels, cut to expose upper thighs at sides as in supplied sprite.
 ztop=1.40
 end=.905+.255*abs(math.sin(a-.30))+.025*math.sin(a)
 z=ztop+(end-ztop)*v;rx=.187+.078*math.sin(v*math.pi*.70);ry=.168+.015*v
 wave=.007*math.sin(a*10+v*2)*v
 return Vector(((rx+wave)*math.sin(a),-.012-(ry+wave)*math.cos(a),z))
for idx,(a0,a1) in enumerate([(-1.68,.68),(.42,4.65)]):
 fn=lambda u,v,a0=a0,a1=a1:skirt(a0+(a1-a0)*u,v)+Vector((0,-.004 if idx==0 else 0,0))
 o=surf('Kimono • '+['overlapping angled front panel','wrapped rear and right skirt'][idx],fn,64,24,blue,'Hips',.003)
 # Minimal leg influence at hem creates readable motion without rigid hip skirt.
 for bn in ['LeftUpLeg','RightUpLeg']:o.vertex_groups.new(name='mixamorig:'+bn)
 for vv in o.data.vertices:
  influence=max(0,min(.86,(1.40-vv.co.z)*3.1));left=max(0,min(1,.5+vv.co.x/.16));o.vertex_groups['mixamorig:Hips'].add([vv.index],1-influence,'REPLACE');o.vertex_groups['mixamorig:LeftUpLeg'].add([vv.index],influence*left,'REPLACE');o.vertex_groups['mixamorig:RightUpLeg'].add([vv.index],influence*(1-left),'REPLACE')
 border=[fn(i/64,1) for i in range(65)]+[fn(1,1-i/32) for i in range(1,33)]
 tube('Kimono • crimson outer hem',border,.004,redlight,'Hips')
 for vv in [.942,.975]:
  inset=[fn(i/64,vv)+Vector((0,-.002,0)) for i in range(65)];tube('Kimono • paired golden hem stitch',inset,.0013,gold,'Hips')
# Front vertical inset red/gold design tracks the panel folds.
for a in [-.52,-.46]:tube('Kimono • long angled gold-red panel line',[skirt(a+.18*v,v)+Vector((0,-.006,0)) for v in [i/40 for i in range(41)]],.0017,gold if a==-.46 else redlight,'Hips')
# Short under-wrap only, prevents unseen exposure beneath outer panel.
# Gold knotted cord at reference right hip, loops and hanging ends.
for z in [1.425,1.441]:tube('Obi • fine waist tie',[obi(i/96*2*math.pi,z,.009) for i in range(97)],.0032,gold,'Spine')
for j,z in enumerate([1.463,1.416,1.371]):
 pts=[(.188+.035*math.sin(t),-.092-.014*math.cos(t),z+.035*math.cos(t)) for t in [i*2*math.pi/36 for i in range(37)]];tube('Obi • sculpted bow loop',pts,.0042,gold,'Hips')
for off in [0,.024]:
 pts=bez([(.19,-.10,1.41),(.23,-.14,1.30),(.21+off,-.17,1.18),(.26+off,-.12,1.10)],40);tube('Obi • free gold cord end',pts,.0033,gold,'Hips')
 for k in range(5):tube('Obi • gold tassel filament',[pts[-1]+Vector((k*.0015-.003,0,0)),pts[-1]+Vector((k*.002-.004,0,-.037))],.0009,goldlight,'Hips',5)
# Red rear knot, with actual folded ribbon surfaces rather than blocks.
for s in [-1,1]:
 surf('Obi • folded rear bow',lambda u,v,s=s:(s*(.02+.17*u),.177+.025*math.sin(math.pi*u)*math.cos(math.pi*v),1.46+(v-.5)*(.04+.09*math.sin(math.pi*u))),24,10,red,'Hips',.003)
sphere('Obi • rear knot',(0,.177,1.46),(.034,.022,.04),red,'Hips')
# Hair: swept skull cap, sculpted overlapping locks, gathered high bun + spiked pony.
# A closed cap is hidden by layered strand geometry, never primitive balls in silhouette.
def cap(u,v):
 a=u*2*math.pi;theta=.02+v*(1.40+.58*math.sin(a)**2+1.02*max(0,-math.cos(a)));return (.165*math.sin(theta)*math.sin(a),.034-.187*math.sin(theta)*math.cos(a),2.18+.191*math.cos(theta))
surf('Hair • fitted swept scalp',cap,80,36,hair,'Head',.001)
def lock(name,ctrl,width,ma=hair,depth=.009,lines=True):
 if 'pony' in name:
  ctrl=[(p[0],p[1]+.06*i/(len(ctrl)-1),2.36+(p[2]-2.36)*.75) for i,p in enumerate(ctrl)];width*=.86
 pts=bez(ctrl,32);vs=[];widths=[]
 for i,p in enumerate(pts):
  t=i/32;w=width*(.65+.35*math.sin(math.pi*t))*(1-t)**.45+.0003 if 'pony' in name else width*(.35+.65*math.sin(math.pi*t*.9)**.65)*(1-t**7)+.0005;widths.append(w)
  tangent=(pts[min(i+1,32)]-pts[max(i-1,0)]).normalized();side=tangent.cross(Vector((0,-1,0)))
  if side.length<.1:side=Vector((1,0,0))
  side.normalize()
  for j in range(7):
   u=j/6*2-1;vs.append(p+side*(u*w)+Vector((0,-depth*(1-u*u),0)))
 fs=[(i*7+j,i*7+j+1,(i+1)*7+j+1,(i+1)*7+j) for i in range(32) for j in range(6)]
 ob=mesh(name,vs,fs,ma,'Head',.002)
 if lines:
  for uu in [-.70,.58]:
   ps=[]
   for i in range(2,30):ps.append(Vector(vs[i*7+int((uu+1)*3)])+Vector((0,-.0016,0)))
   tube(name+' • etched strand',ps,.00065,hairshadow,'Head',5)
 return ob
# Central diagonal bangs overlap, revealing one brow and tapering across the other.
frontlocks=[([(-.035,-.075,2.355),(-.11,-.155,2.315),(-.145,-.167,2.23),(-.128,-.151,2.09)],.041),
([(-.045,-.08,2.354),(.015,-.168,2.32),(.104,-.174,2.19),(.145,-.117,2.10)],.043),
([(-.02,-.085,2.36),(.03,-.168,2.28),(.05,-.17,2.20),(.105,-.14,2.155)],.031),
([(-.045,-.1,2.35),(-.04,-.172,2.28),(-.018,-.166,2.21),(.018,-.143,2.17)],.027),
([(-.075,-.073,2.35),(-.13,-.155,2.29),(-.157,-.13,2.16),(-.17,-.11,2.04)],.027)]
for i,(c,wid) in enumerate(frontlocks):lock('Hair • sweeping fringe '+str(i+1),c,wid)
# Long single face-framing lock drops to the left chest, distinctive sprite silhouette.
lock('Hair • long left cheek and chest lock',[(-.12,-.11,2.29),(-.18,-.125,2.10),(-.18,-.16,1.91),(-.195,-.19,1.78)],.027,depth=.010)
lock('Hair • inner left cheek strand',[(-.14,-.10,2.27),(-.18,-.125,2.08),(-.19,-.135,1.91),(-.210,-.16,1.83)],.014,depth=.005)
# Side-swept curved ribbons hug the cap and converge on the rear-high pony anchor.
for s in [-1,1]:
 for i in range(8):
  z=2.13+i*.025
  lock('Hair • gathered side wave',[((.145-i*.003)*s,.01,z),((.183-i*.004)*s,.10,z+.015),(.13*s,.185,2.25+i*.009),(.045*s,.184,2.35)],.020,depth=.006,lines=i%2==0)
# Swept nape locks cover the occipital surface and converge into the bun.
for i in range(13):
 x=(i-6)*.022
 lock('Hair • swept rear nape lock',[(x,.152,2.035+.02*abs(i-6)/6),(x*1.15,.239,2.12),(x*.7,.235,2.29),(.018,.19,2.36)],.020,depth=.005,lines=False)
# Bun sculpted with overlapping curved locks, not exposed spheres.
for i in range(14):
 a=i*2*math.pi/14
 c=[(.04*math.cos(a),.168,2.33+.04*math.sin(a)),(.10*math.cos(a),.245,2.34+.10*math.sin(a)),(.072*math.cos(a+.7),.27,2.36+.07*math.sin(a+.7)),(.022,.19,2.41)]
 lock('Hair • coiled bun section',c,.024,depth=.012,lines=i%3==0)
# Irregular upswept pony, bending rearward rather than an upright feather fan.
pony=[([(.01,.19,2.36),(-.01,.27,2.49),(.015,.35,2.59),(-.015,.38,2.62)],.040),
([(.02,.19,2.37),(.03,.28,2.52),(.10,.37,2.61),(.135,.41,2.61)],.055),
([(.03,.20,2.36),(.08,.29,2.49),(.14,.39,2.54),(.185,.43,2.49)],.040)]
for i,(ctrl,wid) in enumerate(pony):lock('Hair • irregular swept pony clump '+str(i),ctrl,wid,depth=.010)
for i,c in enumerate([[(-.01,.19,2.38),(-.08,.23,2.52),(-.13,.30,2.58)],[(.04,.2,2.36),(.14,.24,2.40),(.23,.34,2.38)],[(.02,.21,2.34),(.05,.32,2.34),(.12,.44,2.29)]]):lock('Hair • fine escaped pony tuft '+str(i),c,.010,depth=.003,lines=False)
# Compact asymmetric black/red folded bow, tilted diagonally across the gathered hair.
for name,outline in [('upper',[(.005,.16,2.35),(-.075,.18,2.515),(-.106,.17,2.53),(-.097,.145,2.412)]),('side',[(.006,.17,2.36),(.087,.20,2.465),(.103,.185,2.422),(.067,.145,2.345)])]:
 ob=mesh('Hair ribbon • diagonal '+name+' black fold',outline,[(0,1,2,3)],black,'Head',.004,.001,False)
 center=sum((Vector(v) for v in outline),Vector())/4;inner=[center+(Vector(v)-center)*.66+Vector((0,-.004,0)) for v in outline]
 mesh('Hair ribbon • crimson inset fold',inner,[(0,1,2,3)],redlight,'Head',.001,0,False)
curve('Hair ribbon • close bun binding',[(-.053,.13,2.34),(-.035,.15,2.39),(.033,.19,2.40),(.064,.19,2.34)],.010,black,'Head')
# Earrings: small red cross-shaped drop (visible in sprite).
for s in [-1,1]:
 tube('Earring • gold stem',[(s*.147,.015,2.09),(s*.15,.006,2.06)],.0015,gold,'Head')
 tube('Earring • red vertical cross',[(s*.15,.005,2.065),(s*.15,.005,2.025)],.0043,redlight,'Head')
 tube('Earring • red horizontal cross',[(s*.138,.005,2.052),(s*.162,.005,2.052)],.004,redlight,'Head')
# Stocking and glove gold geometric trim derived from sprite diamond embroidery.
def skinfront(x,z):
 hit,loc,n,idx=body.ray_cast(body.matrix_world.inverted()@Vector((x,-1,z)),body.matrix_world.to_3x3().inverted()@Vector((0,1,0)))
 if not hit and abs(x)>.28:
  hit,loc,n,idx=body.ray_cast(body.matrix_world.inverted()@Vector((x,-1,1.839)),body.matrix_world.to_3x3().inverted()@Vector((0,1,0)))
 return (body.matrix_world@loc).y-.009 if hit else -.11
for s,side in [(1,'Left'),(-1,'Right')]:
 # Asymmetric pointed sleeve top, following the arm rather than a straight tube cuff.
 def glove_cap(u,v,s=s):
  a=u*2*math.pi;front=max(0,math.cos(a));tip=(.290 if s==1 else .305)-.048*front**3;x=tip+(.37-tip)*v;r=.062-.014*v
  center=Vector((s*x,.039,1.839));radial=Vector((0,-math.cos(a),math.sin(a)));origin=center+radial*.30
  hit,loc,n,idx=body.ray_cast(body.matrix_world.inverted()@origin,body.matrix_world.to_3x3().inverted()@(-radial))
  return (body.matrix_world@loc+radial*.006) if hit else (s*x,.039-r*.88*math.cos(a),1.839+r*math.sin(a))
 cap_ob=surf(side+' • pointed asymmetric glove upper',glove_cap,48,12,dark,side+'Arm',.001);transfer_skin(cap_ob)
 top_edge=tube(side+' • glove gold pointed top edge',[glove_cap(i/64,0) for i in range(65)],.0018,gold,side+'Arm');transfer_skin(top_edge)
 # Above-elbow cuff in rest T pose.
 for x in []:
  tube(side+' • glove gold cuff',[(s*x,.039+.054*math.cos(a),1.839+.060*math.sin(a)) for a in [i*2*math.pi/40 for i in range(41)]],.0017,gold,side+'Arm')
 for x in [.33,.60,.67,.735]:
  pts=[];corners=[(0,.038),(.014,0),(0,-.038),(-.014,0),(0,.038)]
  for (dx0,dz0),(dx1,dz1) in zip(corners,corners[1:]):
   for k in range(8):
    t=k/8;dx=dx0+(dx1-dx0)*t;dz=(dz0+(dz1-dz0)*t)*(1 if x<.4 else .58);radius=.060 if x<.4 else .039-.010*max(0,(x-.63)/.15);yy=skinfront(s*(x+dx),1.839+dz);pts.append((s*(x+dx),yy,1.839+dz))
  pts.append(pts[0]);tube(side+' • glove gold diamond inlay',pts,.0016,gold,side+('Arm' if x<.4 else 'ForeArm'))
 for j in range(3):
  xc=s*(.10+(j-1)*.03);pts=[(xx,skinfront(xx,zz),zz) for xx,zz in [(xc,1.025),(xc+s*.016,.983),(xc,.942),(xc-s*.016,.983),(xc,1.025)]];tube(side+' • thigh gold lattice',pts,.0018,gold,side+'UpLeg')
 # Fitted leather heeled shoe loft, not enlarged boots.
 xc=s*.116
 rows=[(-.225,.003,.024),(-.205,.028,.033),(-.158,.045,.047),(-.095,.047,.066),(-.025,.043,.106),(.045,.037,.145),(.082,.027,.12),(.091,.008,.085)]
 def shoe(u,v):
  yy=-.225+v*.316;ww,hh=interp(rows,yy);a=math.pi*u;rise=.065*max(0,min(1,(yy+.08)/.10));return(xc+ww*math.cos(a),yy,.01+rise+hh*math.sin(a))
 surf(side+' • refined heeled shoe upper',shoe,40,45,dark,side+'Foot',.003)
 # A fitted continuous ankle bridge closes the stocking-to-heeled-shoe transition.
 def ankle_bridge(u,v):
  a=u*2*math.pi;return(xc+(.035+.005*v)*math.sin(a),.040-(.051+.015*v)*math.cos(a),.085+.145*v)
 collar=surf(side+' • fitted boot ankle transition',ankle_bridge,48,16,dark,side+'Foot',.001)
 collar.vertex_groups.clear();collar.vertex_groups.new(name='mixamorig:'+side+'Leg');collar.vertex_groups.new(name='mixamorig:'+side+'Foot')
 for vv in collar.data.vertices:
  t=max(0,min(1,(vv.co.z-.115)/.14));leg=t*t*(3-2*t);collar.vertex_groups[0].add([vv.index],leg,'REPLACE');collar.vertex_groups[1].add([vv.index],1-leg,'REPLACE')
 outline=[(-.004,-.228),(-.029,-.199),(-.045,-.15),(-.049,-.09),(-.041,.02),(-.029,.09),(.029,.09),(.041,.02),(.049,-.09),(.045,-.15),(.029,-.199),(.004,-.228)]
 vs=[(xc+x,y,z+.072*max(0,min(1,(y+.06)/.10))) for z in [.005,.014] for x,y in outline];n=len(outline);mesh(side+' • beveled shoe sole',vs,[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],black,side+'Foot',bev=.002)
 # Narrow block heel, just as reference heel, integrated into shoe rear.
 vs=[(xc+x,y,z) for z,w in [(0,.012),(.088,.024)] for x,y in [(-w,.052),(-w,.083),(w,.083),(w,.052)]];mesh(side+' • shaped low block heel',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],black,side+'Foot',bev=.003)
 for yy in [-.16,-.13]:
  ww,hh=interp(rows,yy);tube(side+' • red shoe vamp piping',[(xc+ww*math.cos(a),yy,.013+hh*math.sin(a)) for a in [i*math.pi/30 for i in range(31)]],.0028,redlight,side+'Foot')
# Hide only body surfaces guaranteed to be inside costume; skin remains at shoulders, hands, thighs.
# Exact bmesh face removal is editable in source base, runtime has no redundant covered skin.
bm=bmesh.new();bm.from_mesh(body.data);inv=body.matrix_world.inverted()
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=inv@Vector((0,0,1.022)),plane_no=body.matrix_world.to_3x3().transposed()@Vector((0,0,1)),clear_inner=True,clear_outer=False)
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=inv@Vector((0,0,1.205)),plane_no=body.matrix_world.to_3x3().transposed()@Vector((0,0,1)),clear_inner=False,clear_outer=False)
kill=[]
for f in bm.faces:
 c=body.matrix_world@f.calc_center_median();x,y,z=c
 cy=-.04+.065*max(0,min(1,(z-1.80)/.12));aa=math.atan2(x,-(y-cy));covered_torso=1.38<z<min(1.94,wrap_top(aa)-.010) and abs(x)<.225
 if (1.205<z<1.38 and abs(x)<.29) or covered_torso or (.315<abs(x)<.81 and z>1.74):kill.append(f)
bmesh.ops.delete(bm,geom=kill,context='FACES');bm.to_mesh(body.data);bm.free()
# Keep torso skin under upper neckline; back inferred from consistent wrap tailoring.
# Weapons authored separately below, enabling real hand-bound attachments.
exec((R/'scripts/weapons.py').read_text(),globals())
# Studio setup and editable relaxed pose checkpoint.
sc.render.engine='CYCLES';sc.cycles.samples=48;sc.cycles.use_denoising=False
sc.render.resolution_x=900;sc.render.resolution_y=1200;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG'
sc.world=bpy.data.worlds.new('Musashi warm studio');sc.world.use_nodes=True;sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.15,.20,1);sc.world.node_tree.nodes['Background'].inputs[1].default_value=.5
sc.view_settings.view_transform='AgX';sc.view_settings.look='AgX - Medium High Contrast'
for name,loc,power,size,color in [('Key',(-3,-4,5),450,3,(1,.9,.8)),('Fill',(3,-3,3),300,3,(.8,.88,1)),('Rim',(1,3,4),500,2.5,(.95,.86,1))]:
 d=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,d);sc.collection.objects.link(o);o.location=loc;d.energy=power;d.shape='DISK';d.size=size;d.color=color;o.rotation_euler=(Vector((0,0,1.4))-o.location).to_track_quat('-Z','Y').to_euler()
c=bpy.data.objects.new('Musashi presentation camera',bpy.data.cameras.new('Camera'));sc.collection.objects.link(c);sc.camera=c;c.data.type='ORTHO'
def camera(pos,target,scale):c.location=pos;c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=scale
for side,sgn in [('Left',1),('Right',-1)]:
 b=arm.pose.bones['mixamorig:'+side+'Arm'];axis=b.bone.matrix_local.to_3x3().inverted()@arm.matrix_world.to_3x3().inverted()@Vector((0,1,0));b.rotation_quaternion=Quaternion(axis,math.radians(62*sgn))
sc['design_reference']='User supplied Screenshot 2026-10-27 at 12.16.09 AM; rear garment folds inferred, not certified exact.'
sc['source_attribution']='mastjie licensed authored VRoid base anatomy, face/morph topology and Mixamo rig; Musashi costume, hair and weapons newly authored.'
sc['rights']='Creator modification/redistribution terms do not grant TYPE-MOON / FGO character rights.'
bpy.context.view_layer.update();bpy.ops.file.pack_all();camera((3,-7,2.9),(0,0,1.34),2.95)
bpy.ops.wm.save_as_mainfile(filepath=str(R/'Musashi_Working.blend'))
if '--build-only' in sys.argv:sys.exit(0)
for name,pos,target,scale in [('checkpoint-front',(0,-7,2.4),(0,0,1.34),2.94),('checkpoint-hero',(3,-7,2.7),(0,0,1.34),2.94),('checkpoint-face',(.8,-5,2.4),(0,0,2.22),.91),('checkpoint-back',(3,7,2.6),(0,0,1.34),2.94)]:
 camera(pos,target,scale);sc.render.filepath=str(R/'renders'/f'{name}.png');bpy.ops.render.render(write_still=True)
