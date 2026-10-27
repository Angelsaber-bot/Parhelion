import bpy,os,math,json
from mathutils import Vector
from math import sin,cos,pi
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
hat=bpy.data.collections.new('BLACKBEARD - Optional tricorn');bpy.context.scene.collection.children.link(hat)

def mat(n,c,metal=0,rough=.5):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
leather=mat('Tricorn weathered near-black leather',(.022,.014,.012),0,.59)
lining=mat('Dark oxblood underside',(.055,.014,.015),0,.72)
red=mat('Deep red grosgrain ribbon',(.16,.016,.022),0,.77)
gold=mat('Aged brass narrow binding',(.34,.19,.05),.75,.36)
thread=mat('Subdued linen saddle stitches',(.22,.14,.065),0,.8)
black=mat('Recessed compass backing',(.018,.023,.027),.55,.5)

def mesh(n,v,f,m,sub=0,thick=0):
 me=bpy.data.meshes.new(n+' mesh');me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);hat.objects.link(o);o.data.materials.append(m)
 for p in me.polygons:p.use_smooth=True
 if sub:q=o.modifiers.new('Leather surface subdivision','SUBSURF');q.levels=sub
 if thick:q=o.modifiers.new('Leather thickness','SOLIDIFY');q.thickness=thick;q.offset=0
 return o

def line(n,pts,r,m,closed=False):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=3;c.bevel_depth=r;c.bevel_resolution=1;s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
 for b,p in zip(s.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 s.use_cyclic_u=closed;o=bpy.data.objects.new(n,c);hat.objects.link(o);o.data.materials.append(m);return o

def uv(n,loc,sc,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc);o=bpy.context.object;o.name=n;o.scale=sc
 for c in list(o.users_collection):c.objects.unlink(o)
 hat.objects.link(o);o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return o

# A folded brim is a single connected annular sheet, not three separate flaps.
# Corners project front-left / front-right / rear; the three inter-corner sides curl upward.
def brim(a,t):
 fold=(.5-.5*cos(3*(a+pi/6)))
 ri=1/math.sqrt((cos(a)/.121)**2+(sin(a)/.122)**2)
 ro=.188+.043*cos(3*(a+pi/6))
 # Subtle asymmetry from handled leather, restrained enough to preserve three-corner identity.
 ro+=.0025*sin(a*2+.4)
 r=ri+(ro-ri)*t-.002*max(0,(t-.90)/.1)
 z=2.005+.120*(fold**.78)*(t**2.9)+.003*sin(a*2+.6)*t
 return (r*cos(a),.015+r*sin(a),z)
N=96;ts=[0,.025,.12,.32,.55,.72,.85,.95,1]
v=[brim(2*pi*i/N,t) for t in ts for i in range(N)];f=[]
for j in range(len(ts)-1):
 for i in range(N):f.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
brimob=mesh('01 Continuous three-fold brim',v,f,leather,1,.0032)
brimob.data.materials.append(lining);brimob.modifiers['Leather thickness'].material_offset=1
# Crown: shaped oval, slight pinched forward top, open bottom to fit existing hair.
rings=[(2.003,.119,.120),(2.009,.120,.121),(2.027,.119,.119),(2.068,.116,.115),(2.117,.108,.107),(2.144,.096,.096),(2.151,.075,.075),(2.154,.032,.031)]
v=[]
for k,(z,rx,ry) in enumerate(rings):
 for i in range(64):
  a=2*pi*i/64
  dent=.0025*sin(a*3+.5)*sin(pi*k/(len(rings)-1))
  v.append(((rx+dent)*cos(a),.015+(ry+dent)*sin(a),z+.0015*cos(a*2)))
f=[]
for k in range(len(rings)-1):
 for i in range(64):f.append((k*64+i,k*64+(i+1)%64,(k+1)*64+(i+1)%64,(k+1)*64+i))
f.append(tuple((len(rings)-1)*64+i for i in range(64)))
crown=mesh('02 Shaped leather crown',v,f,leather,1,.0025)
crown.data.materials.append(lining);crown.modifiers['Leather thickness'].material_offset=1
# Intentional piping follows the real folded edge exactly.
line('03 Deep red edge welt',[brim(2*pi*i/64,1) for i in range(64)],.0026,red,True)
line('04 Brass outer bound edge',[(x,y,z+.0017) for x,y,z in [brim(2*pi*i/64,1) for i in range(64)]],.00105,gold,True)
line('05 Inner crown seam',[(.1205*cos(a),.015+.122*sin(a),2.010) for a in [2*pi*i/64 for i in range(64)]],.00075,thread,True)
# Original texture-free grosgrain band with separately readable top and bottom edges.
v=[]
for z,rx,ry in [(2.019,.121,.122),(2.021,.1215,.1225),(2.041,.1205,.1205),(2.043,.1198,.1200)]:
 for i in range(64):a=2*pi*i/64;v.append((rx*cos(a),.015+ry*sin(a),z+.001*sin(a*2)))
f=[(k*64+i,k*64+(i+1)%64,(k+1)*64+(i+1)%64,(k+1)*64+i) for k in range(3) for i in range(64)]
mesh('06 Crimson crown ribbon',v,f,red,1,.0012)
for z,rx,ry in [(2.021,.1218,.1228),(2.041,.121,.121)]:line('07 Ribbon woven edge',[(rx*cos(a),.015+ry*sin(a),z+.001*sin(a*2)) for a in [2*pi*i/64 for i in range(64)]],.0005,lining,True)
# Flat cross stitches ride on the curved brim, combined in one mesh for runtime.
sv=[];sf=[]
for i in range(90):
 a=2*pi*i/90;p0=Vector(brim(a-.008,.90));p1=Vector(brim(a+.008,.90));p0.z+=.002;p1.z+=.002
 tangent=(p1-p0).normalized();u=tangent.cross(Vector((0,0,1))).normalized();w=tangent.cross(u).normalized();base=len(sv)
 for p in [p0,p1]:
  for j in range(6):sv.append(p+.00038*(u*cos(j*pi/3)+w*sin(j*pi/3)))
 for j in range(6):sf.append((base+j,base+(j+1)%6,base+6+(j+1)%6,base+6+j))
mesh('08 Fine saddle stitching',sv,sf,thread)
# Small original compass emblem, relief against the raised front brim.
# Compass is original geometry, not a borrowed franchise insignia.
center=Vector((0,-.1305,2.084))
# Front fold at this height is near Y=-.128..-.131; keep badge flush to the outer side.
v=[]
for i in range(24):a=2*pi*i/24;v.append((.017*cos(a),center.y,center.z+.017*sin(a)))
back=mesh('09 Compass dark roundel',v,[tuple(range(24))],black,0,.001)
line('10 Compass fine brass rim',[(.017*cos(a),center.y-.001,center.z+.017*sin(a)) for a in [2*pi*i/24 for i in range(24)]],.0009,gold,True)
v=[(0,center.y-.002,center.z)];
for i in range(16):
 a=2*pi*i/16;r=.0135 if i%4==0 else (.0105 if i%2==0 else .0034)
 v.append((r*cos(a),center.y-.0025,center.z+r*sin(a)))
f=[(0,1+i,1+(i+1)%16) for i in range(16)];mesh('11 Eight point compass star',v,f,gold,0,.0009)
uv('12 Compass center stud',(0,center.y-.003,center.z),(.0022,.0015,.0022),gold)
# Two stitched crown darts, geometry subtle and modeled, not printed broad stripes.
for side in [-1,1]:line('13 Crown tailored seam',[(side*.101,.052,2.06),(side*.098,.047,2.105),(side*.074,.040,2.145),(side*.035,.027,2.155)],.00065,lining)
# Convert curve trim to editable mesh and set world-origin object coordinates.
bpy.context.view_layer.update()
for o in list(hat.objects):
 if o.type=='CURVE':bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
for o in hat.objects:
 o['optional_accessory']=True;o['bind_bone']='Head';o['source']='Original Parhelion geometry/materials'
bpy.ops.object.empty_add(type='PLAIN_AXES',location=(0,0,0));root=bpy.context.object;root.name='Blackbeard_Optional_Tricorn_ROOT';root.empty_display_size=.04
for c in list(root.users_collection):c.objects.unlink(root)
hat.objects.link(root)
for o in hat.objects:
 if o!=root:o.parent=root
root['optional']=True;root['bind_to']='Head';root['coordinates']='Character rest world coordinates, Z up; preserve placement while binding'
# Minimal studio in native file, outside asset collection.
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=64;s.cycles.use_denoising=False;s.render.resolution_x=1100;s.render.resolution_y=1000;s.view_settings.view_transform='AgX';s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.13,.18,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
for loc,power,size in [((-.6,-.8,2.8),45,.8),((.7,-.4,2.3),30,.7),((0,.8,2.7),50,.7)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name='STUDIO hat softbox';o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,2.07))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(.55,-.85,2.42));cam=bpy.context.object;cam.name='STUDIO hat camera';s.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=.58;cam.rotation_euler=(Vector((0,0,2.075))-cam.location).to_track_quat('-Z','Y').to_euler()
s['status']='Optional accessory; not default costume';s['authorship']='Original mesh and materials for Parhelion'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blackbeard_tricorn_editable.blend')
bpy.ops.object.select_all(action='DESELECT')
for o in hat.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/blackbeard_tricorn_accessory.glb',export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
s.render.filepath=ROOT+'/previews/01_hat_threequarter.png';bpy.ops.render.render(write_still=True)
# Append-only private QA scene: never overwrite main character files.
source=os.path.abspath('Parhelion/assets/characters/blackbeard/refined/costume_complete.blend')
bpy.ops.wm.open_mainfile(filepath=source,load_ui=False,use_scripts=False)
with bpy.data.libraries.load(ROOT+'/blackbeard_tricorn_editable.blend',link=False) as (src,dst):dst.collections=['BLACKBEARD - Optional tricorn']
for c in dst.collections:bpy.context.scene.collection.children.link(c)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=64;s.cycles.use_denoising=False;s.render.resolution_x=1100;s.render.resolution_y=1100;s.render.resolution_percentage=100;cam=s.camera
cam.location=(.7,-2.3,2.12);cam.rotation_euler=(Vector((0,-.03,1.91))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.68
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/qa/tricorn_on_character_QA.blend')
s.render.filepath=ROOT+'/previews/02_on_head.png';bpy.ops.render.render(write_still=True)
cam.location=(0,-2.5,2.05);cam.rotation_euler=(Vector((0,-.03,1.91))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.68;s.render.filepath=ROOT+'/previews/03_on_head_front.png';bpy.ops.render.render(write_still=True)
