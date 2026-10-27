import bpy,math,os,json
from mathutils import Vector
from math import sin,cos,pi
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for m in bpy.data.materials:bpy.data.materials.remove(m)
weapon=bpy.data.collections.new('BLACKBEARD - Flintlock components');bpy.context.scene.collection.children.link(weapon)

def finish(o,n,m):
 o.name=n
 for c in list(o.users_collection):c.objects.unlink(o)
 weapon.objects.link(o)
 if m:o.data.materials.append(m)
 if o.type=='MESH':
  for p in o.data.polygons:p.use_smooth=True
 return o

def mat(n,c,metal=0,rough=.4):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
wood=mat('Walnut - warm figured stock',(.13,.038,.012),0,.36)
brass=mat('Antique gold brass',(.48,.265,.065),.8,.31)
steel=mat('Blued forged steel',(.038,.055,.072),.88,.3)
steelhi=mat('Polished steel edges',(.23,.28,.32),.85,.24)
black=mat('Bore and engraving shadow',(.009,.012,.016),.3,.65)
flint=mat('Chipped gray flint',(.18,.20,.19),0,.78)
# Original generated color texture, exportable in glTF.
N=512;im=bpy.data.images.new('Original walnut grain',width=N,height=N);px=[]
for y in range(N):
 v=y/(N-1)
 for x in range(N):
  u=x/(N-1);wave=u*80+2.7*sin(v*7)+.75*sin(v*19+u*3);fine=.5+.5*sin(wave*2*pi);grain=(fine**12)*.32;shade=1-grain+.06*sin(u*29+v*9)+.025*sin(u*230+v*37)
  px.extend((.19*shade,.065*shade,.022*shade,1))
im.pixels=px;im.filepath_raw=ROOT+'/textures/walnut_original.png';im.file_format='PNG';im.save();im.pack()
nt=wood.node_tree;tex=nt.nodes.new('ShaderNodeTexImage');tex.image=im;nt.links.new(tex.outputs['Color'],nt.nodes['Principled BSDF'].inputs['Base Color'])

def mesh(n,v,f,m,sub=0,bevel=0):
 me=bpy.data.meshes.new(n+' mesh');me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);weapon.objects.link(o);o.data.materials.append(m)
 for p in me.polygons:p.use_smooth=True
 if sub:mod=o.modifiers.new('Surface refinement','SUBSURF');mod.levels=sub
 if bevel:mod=o.modifiers.new('Crafted edge bevel','BEVEL');mod.width=bevel;mod.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def line(n,pts,r,m,closed=False):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=6;c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
 for b,p in zip(s.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 s.use_cyclic_u=closed;o=bpy.data.objects.new(n,c);weapon.objects.link(o);o.data.materials.append(m);return o

def cube(n,loc,sc,m,bevel=.002):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=finish(bpy.context.object,n,m);o.scale=sc;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:mod=o.modifiers.new('Soft edge','BEVEL');mod.width=bevel;mod.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def uv(n,loc,sc,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc);o=finish(bpy.context.object,n,m);o.scale=sc;return o

def profile(n,outline,xc,thick,m,bev=.001):
 # Outline is a YZ polygon, extruded in X.
 v=[(xc+side*thick/2,y,z) for side in [-1,1] for y,z in outline];N=len(outline);f=[tuple(reversed(range(N))),tuple(N+i for i in range(N))]
 f +=[(i,(i+1)%N,N+(i+1)%N,N+i) for i in range(N)]
 return mesh(n,v,f,m,0,bev)

def barrel(n,y0,y1,z,r0,r1,m,sides=16,inside=False):
 v=[]
 sections=[(y0,r0),(y0-.001,r0),(y1+.001,r1),(y1,r1)]
 if inside:sections +=[(y1,r1*.67),(y1+.035,r1*.67)]
 for y,r in sections:
  for i in range(sides):a=2*pi*i/sides+pi/8;v.append((r*cos(a),y,z+r*sin(a)))
 f=[]
 for k in range(len(sections)-1):
  for i in range(sides):f.append((k*sides+i,k*sides+(i+1)%sides,(k+1)*sides+(i+1)%sides,(k+1)*sides+i))
 if not inside:f.append(tuple(reversed(range(sides))));f.append(tuple((len(sections)-1)*sides+i for i in range(sides)))
 return mesh(n,v,f,m)

# Continuous shaped stock: butt, palm swell, curved grip, breech and slender fore-end.
sections=[(.068,-.080,.023,.023),(.070,-.075,.030,.025),(.058,-.051,.029,.026),(.030,-.015,.024,.028),(.012,.020,.023,.030),(.002,.052,.025,.033),(-.008,.078,.029,.034),(-.035,.093,.032,.027),(-.075,.098,.031,.023),(-.13,.101,.028,.021),(-.22,.105,.024,.018),(-.32,.108,.022,.017),(-.365,.111,.020,.016),(-.37,.111,.017,.014)]
v=[];Nc=20
for y,z,rx,rz in sections:
 for j in range(Nc):a=2*pi*j/Nc;v.append((rx*cos(a),y,z+rz*sin(a)))
f=[]
for k in range(len(sections)-1):
 for j in range(Nc):f.append((k*Nc+j,k*Nc+(j+1)%Nc,(k+1)*Nc+(j+1)%Nc,(k+1)*Nc+j))
f+=[tuple(reversed(range(Nc))),tuple((len(sections)-1)*Nc+j for j in range(Nc))]
stock=mesh('01 Walnut stock - continuous curved grip',v,f,wood,2)
# UV built by longitudinal rings.
uvlayer=stock.data.uv_layers.new(name='Wood grain UV')
for p in stock.data.polygons:
 for li in p.loop_indices:
  vi=stock.data.loops[li].vertex_index;k,j=divmod(vi,Nc);uvlayer.data[li].uv=(j/Nc,k/(len(sections)-1))
# Sculpted steel barrel and breech tang, true open muzzle.
breech=barrel('02 Octagonal breech barrel',.005,-.122,.143,.0255,.0235,steel,8)
for p in breech.data.polygons:p.use_smooth=False
barrel('03 Long tapered muzzle barrel',-.117,-.443,.143,.0235,.021,steel,16,True)
barrel('04 Muzzle polished crown',-.437,-.445,.143,.0222,.0222,steelhi,16,True)
# Dark disk at end of bore; internal opening remains visible.
barrel('05 Dark bore depth',-.410,-.411,.143,.0138,.0138,black,24)
profile('06 Breech tang',[(-.01,.149),(.032,.149),(.035,.142),(-.01,.139)],0,.016,steelhi,.001)
# Brass bands follow barrel / fore-end with bridges, not floating rings.
for idx,y in enumerate([-.14,-.325]):
 pts=[(.026*cos(a),y,.137+.031*sin(a)) for a in [2*pi*j/24 for j in range(24)]]
 line('07 Barrel band '+str(idx),pts,.0037,brass,True)
 cube('08 Band underlug '+str(idx),(0,y,.107),(.039,.012,.009),brass,.003)
# Long thin polished brass ramrod underneath, tip forward.
line('09 Ramrod',[(0,-.095,.077),(0,-.22,.079),(0,-.405,.091)],.0045,steelhi)
barrel('10 Ramrod tip',-.39,-.418,.091,.006,.006,brass,12)
for y,z in [(-.18,.079),(-.31,.085)]:
 line('11 Ramrod pipe',[(.006*cos(a),y,z+.006*sin(a)) for a in [2*pi*j/16 for j in range(16)]],.0017,brass,True)
# Stock brass butt cap hugs grip, spine extension and subtle side scroll inlay.
capoutline=[(.095,-.064),(.088,-.09),(.067,-.108),(.039,-.091),(.04,-.076),(.062,-.052)]
# Butt shape uses flattened ellipsoid, positioned across end grip path.
cap=uv('12 Rounded brass butt cap',(0,.069,-.082),(.032,.020,.014),brass);cap.rotation_euler.x=.65
line('13 Butt spine ornament',[(0,.070,-.057),(0,.058,-.023),(0,.030,.014),(0,.012,.052)],.0038,brass)
for side in [-1,1]:
 x=side*.026
 line('14 Stock inlay sweeping vine',[(x,.062,-.055),(x,.039,-.032),(x,.021,.001),(x,.013,.031)],.0015,brass)
 line('15 Stock inlay leaf',[(x,.039,-.028),(x,.024,-.017),(x,.024,-.005),(x,.031,-.016),(x,.039,-.028)],.001,brass)
 # grip escutcheon pointed diamond.
 profile('16 Grip brass escutcheon',[(.014,.016),(.008,.002),(.016,-.015),(.024,.001)],side*.0255,.0018,brass,.0005)
# Lockplate follows the side of the wood just below breech.
lockoutline=[(.008,.119),(-.028,.132),(-.072,.131),(-.105,.116),(-.108,.100),(-.073,.087),(-.020,.087),(.013,.099)]
profile('17 Fitted steel lockplate',lockoutline,.032,.005,steelhi,.002)
# Narrow gold border along same plate.
line('18 Lockplate engraved rim',[(.035,y,z) for y,z in lockoutline],.0011,brass,True)
# Fine etched scrollwork on the plate, with no borrowed emblem.
for shift in [0,.032]:
 line('18b Etched lockplate scroll',[(.0358,-.034-shift,.119),(.0358,-.025-shift,.114),(.0358,-.030-shift,.102),(.0358,-.044-shift,.100),(.0358,-.050-shift,.107),(.0358,-.043-shift,.113),(.0358,-.037-shift,.109)],.00065,black)
line('18c Etched floral stem',[(.0358,-.025,.099),(.0358,-.048,.103),(.0358,-.072,.117)],.0006,black)
# Screw heads are recessed-cross steel with clearly readable slots.
for y,z in [(-.007,.108),(-.077,.110)]:
 uv('19 Lockplate screw',(.036,y,z),(.0028,.005,.005),steel)
 line('20 Screw slot',[(.039,y-.003,z),(.039,y+.003,z)],.0008,black)
# S-shaped hammer/cock, a broad shaped plate with curl and adjustable flint jaws.
cockoutline=[(-.012,.107),(.000,.112),(.004,.132),(-.004,.150),(-.022,.164),(-.027,.179),(-.022,.193),(-.035,.198),(-.047,.187),(-.047,.171),(-.038,.155),(-.020,.140),(-.018,.123)]
profile('21 Cock forged S profile',cockoutline,.042,.009,steelhi,.002)
uv('22 Cock pivot',(.048,-.008,.117),(.004,.010,.010),brass)
line('23 Cock pivot slot',[(.052,-.013,.117),(.052,-.003,.117)],.0008,black)
# Jaws point toward pan and muzzle (-Y).
cube('24 Lower flint jaw',(.042,-.045,.193),(.018,.035,.008),steelhi,.001)
cube('25 Upper flint jaw',(.042,-.045,.210),(.017,.029,.006),steelhi,.001)
# Chipped flint, irregular edges.
profile('26 Flint wedge',[(-.031,.198),(-.060,.197),(-.067,.201),(-.061,.207),(-.035,.206)],.042,.014,flint,.0004)
line('27 Jaw clamp screw',[(.042,-.035,.210),(.042,-.035,.224)],.003,steel)
uv('28 Clamp thumb head',(.042,-.035,.225),(.006,.007,.003),steelhi)
# Pan and standing frizzen meet directly, closed ready position.
uv('29 Powder pan',(.036,-.078,.144),(.011,.017,.005),brass)
profile('30 Frizzen face',[(-.084,.144),(-.086,.167),(-.092,.192),(-.098,.196),(-.103,.192),(-.098,.163),(-.094,.146)],.042,.017,steel,.0015)
line('31 Frizzen spring',[(.040,-.075,.106),(.040,-.100,.115),(.040,-.111,.131),(.040,-.095,.143)],.0024,steelhi)
# Ergonomic bow guard from tang to forward support.
line('32 Trigger guard bow',[(0,.012,.063),(0,-.008,.035),(0,-.043,.019),(0,-.086,.025),(0,-.111,.048),(0,-.102,.082)],.0055,brass)
profile('33 Trigger blade',[(-.028,.083),(-.037,.080),(-.043,.064),(-.055,.047),(-.049,.044),(-.034,.054),(-.026,.069)],0,.006,steelhi,.001)
line('34 Trigger guard tang',[(0,.008,.060),(0,.016,.036),(0,.024,.009)],.004,brass)
# Sight bead and shallow engraved rings, no text clutter.
cube('35 Front sight',(0,-.418,.166),(.004,.012,.008),brass,.001)
profile('36 Rear sight notch',[(-.050,.167),(-.050,.174),(-.044,.174),(-.044,.167)],0,.024,steelhi,.0006)
# Attachment metadata and empty at ergonomic grip center.
bpy.ops.object.empty_add(type='PLAIN_AXES',location=(0,.022,.005));grip=bpy.context.object;grip.name='GRIP_ATTACH - palm center';grip.empty_display_size=.025
for c in list(grip.users_collection):c.objects.unlink(grip)
weapon.objects.link(grip)
grip['barrel_forward_local']='-Y';grip['up_local']='+Z';grip['dominant_hand']='right';grip['notes']='Palm wraps around curved walnut grip; trigger finger extends toward -Y.'
# Convert curves to editable meshes for game export; keep source script as parametric source.
bpy.context.view_layer.update()
for o in list(weapon.objects):
 if o.type=='CURVE':bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
# Parent all parts under an empty at grip. Origin of complete asset is palm attachment.
bpy.ops.object.empty_add(type='PLAIN_AXES',location=(0,0,0));root=bpy.context.object;root.name='Blackbeard_Flintlock_ROOT';root.empty_display_size=.03
for c in list(root.users_collection):c.objects.unlink(root)
weapon.objects.link(root)
for o in list(weapon.objects):
 if o!=root:o.parent=root
# Shift complete assembly so palm location is local origin.
for o in list(weapon.objects):
 if o!=root:o.location-=Vector((0,.022,.005))
root['author']='Original geometry and textures authored for Parhelion';root['weapon_role']='Primary flintlock firearm';root['axis']='Muzzle -Y, up +Z; origin palm center';root['units']='meters'
# Render studio objects are outside export collection.
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=96;s.cycles.use_denoising=False;s.render.resolution_x=1400;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX';s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.14,.19,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.5
floor=mat('Studio floor',(.025,.035,.05),0,.7)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.125));o=bpy.context.object;o.name='STUDIO floor';o.data.materials.append(floor)
def light(loc,power,size):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name='STUDIO softbox';o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,-.15,.05))-o.location).to_track_quat('-Z','Y').to_euler()
light((.5,-.2,.8),45,.7);light((-.5,-.2,.6),30,.6);light((.2,.5,.5),35,.4)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='STUDIO camera';s.camera=cam;cam.data.type='ORTHO'
def render(name,loc,scale):
 cam.location=loc;cam.rotation_euler=(Vector((0,-.17,.055))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;s.render.filepath=ROOT+'/previews/'+name+'.png';bpy.ops.render.render(write_still=True)
cam.location=(.75,-.75,.45);cam.rotation_euler=(Vector((0,-.17,.055))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.68
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blackbeard_flintlock_editable.blend')
# Selected export contains only real asset, no floor/light/camera.
bpy.ops.object.select_all(action='DESELECT')
for o in weapon.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/blackbeard_flintlock.glb',export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
render('01_threequarter',(.75,-.75,.45),.68)
render('02_side',(.9,-.17,.14),.66)
render('03_lockdetail',(.6,-.12,.28),.31)
# Geometry validation from evaluated meshes.
dg=bpy.context.evaluated_depsgraph_get();verts=[];triangles=0
for o in weapon.objects:
 if o.type=='MESH':
  ev=o.evaluated_get(dg);me=ev.to_mesh();me.calc_loop_triangles();triangles+=len(me.loop_triangles);verts.extend([o.matrix_world@v.co for v in me.vertices]);ev.to_mesh_clear()
report={'mesh_objects':sum(o.type=='MESH' for o in weapon.objects),'triangles':triangles,'bounds_min':[min(v[i] for v in verts) for i in range(3)],'bounds_max':[max(v[i] for v in verts) for i in range(3)],'axes':{'muzzle':'-Y','up':'+Z','origin':'ergonomic palm center'},'source':'Original Blender mesh and original generated walnut texture; no third-party model assets'}
open(ROOT+'/qa/geometry.json','w').write(json.dumps(report,indent=2));print(report)
