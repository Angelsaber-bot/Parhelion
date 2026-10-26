"""Parhelion / ASTER Arena 0.3.0. Original editable architectural model.
Run Blender --background --factory-startup --python-exit-code 1 --python source/build_blender.py.
Runtime uses exported PBR materials; collision layout remains the tested 0.2 geometry.
"""
import bpy, json, math, random, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'runtime/map.json').read_text())
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name!='Collection':bpy.data.collections.remove(c)
scene=bpy.context.scene;bpy.context.preferences.filepaths.save_version=0
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene['mapId']=data['mapId'];scene['version']=data['version'];scene['one_unit_metres']=1.0
cols={}
for n in ['VISUAL','COLLISION','DETAIL_ARCHITECTURE','DETAIL_EQUIPMENT','DETAIL_FLOOR','ANCHORS','PRESENTATION','EXPORT_BATCHES']:
    cols[n]=bpy.data.collections.new(n);scene.collection.children.link(cols[n])
def lin(c):return c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4
materials={}
def material(n,h,metal=0,rough=.5,emit=0):
    rgb=tuple(lin(int(h[i:i+2],16)/255) for i in (1,3,5));m=bpy.data.materials.new(n);m.diffuse_color=(*rgb,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    if emit:bs.inputs['Emission Color'].default_value=(*rgb,1);bs.inputs['Emission Strength'].default_value=emit
    materials[n]=m;return m
for args in [('floor','#8c9da8',.12,.78),('wall','#718591',.48,.42),('dark','#202f40',.65,.32),('cover','#e0e4dc',.28,.42),('cyan','#54c8ce',.4,.32),('amber','#e8ad54',.36,.4),('white','#dbe1dc',.22,.48),('red','#bf6960',.25,.5),('seam','#334858',.3,.72),('steel','#9dafb5',.82,.28),('rubber','#182631',.02,.91),('glass','#174c60',.65,.2),('light_cyan','#8ee9e6',.15,.26,2),('light_warm','#ffdda0',.1,.28,1.5),('concrete','#a8b6b9',.03,.86),('tile_light','#95a6ae',.12,.73),('tile_dark','#82959f',.14,.77)]:material(*args)
def conv(v):return(v[0],-v[2],v[1])
def move_col(obj,col):
    for c in list(obj.users_collection):c.objects.unlink(obj)
    cols[col].objects.link(obj)
def finish(obj,n,mat,col,bevel=0):
    obj.name=n;move_col(obj,col);obj.data.materials.append(materials[mat]);obj['decorative']=col.startswith('DETAIL');obj['collision']=False
    if bevel:
        b=obj.modifiers.new('Machined edge radius','BEVEL');b.width=bevel;b.segments=2
        b.affect='EDGES'
        wn=obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');wn.keep_sharp=True;wn.weight=50
    return obj
def box(n,p,s,mat='dark',col='DETAIL_ARCHITECTURE',bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=conv(p));o=bpy.context.object;o.dimensions=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,n,mat,col,min(bevel,min(s)*.28))
def cyl(n,p,r,depth,mat='steel',col='DETAIL_EQUIPMENT',axis='y',verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=conv(p));o=bpy.context.object
    if axis=='x':o.rotation_euler.y=math.pi/2
    if axis=='z':o.rotation_euler.x=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return finish(o,n,mat,col,min(.025,depth*.2))
def text(n,body,p,size=.5,mat='white',rot=(math.pi/2,0,0)):
    cu=bpy.data.curves.new(n,'FONT');cu.body=body;cu.size=size;cu.extrude=.001;cu.align_x='CENTER';cu.space_character=1.15
    o=bpy.data.objects.new(n,cu);cols['DETAIL_ARCHITECTURE'].objects.link(o);o.location=conv(p);o.rotation_euler=rot;cu.materials.append(materials[mat]);o['decorative']=True;return o
def base(o,col):
    x,y,z=o['position'];w,h,d=o['size'];prefix='VIS_' if col=='VISUAL' else 'COL_'
    if o['type']=='box':obj=box(prefix+o['id'],[x,y,z],[w,h,d],o['material'],col,.065 if col=='VISUAL' and o['role']!='floor' else 0)
    else:
        verts=[]
        for xx,zz in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]:verts.append(conv([x+xx,y,z+zz]))
        for xx,zz in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]:
            v=xx/(w/2) if o['axis']=='x' else zz/(d/2);verts.append(conv([x+xx,y+h*(1-v*o['lowAt'])/2,z+zz]))
        me=bpy.data.meshes.new(prefix+o['id']);fs=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)];me.from_pydata(verts,[],[tuple(reversed(f)) for f in fs]);me.update();obj=bpy.data.objects.new(prefix+o['id'],me);cols[col].objects.link(obj);obj.data.materials.append(materials['dark' if col=='VISUAL' else o['material']])
    obj['source_id']=o['id'];obj['role']=o['role'];obj['collision']=col=='COLLISION'
    if col=='COLLISION':obj.display_type='WIRE';obj.hide_render=True
    return obj
for o in data['objects']:
    base(o,'VISUAL')
    if o['collision']:base(o,'COLLISION')
# Floor: real recessed seams / subtly varied low-profile ceramic-concrete plates.
random.seed(32)
for ix in range(18):
    for iz in range(14):
        x=-34+4*ix;z=-26+4*iz
        box(f'FLOOR_tile_{ix:02}_{iz:02}',[x,.002,z],[3.976,.004,3.976],random.choice(['floor','floor','tile_light','tile_dark']),'DETAIL_FLOOR',0)
# Perimeter modular wall skins and exterior structural fins. Everything below 6m sits
# within the existing wall solid or outside the 72x56 playable footprint.
for sign in [-1,1]:
    z=sign*28
    for i,x in enumerate(range(-32,33,8)):
        box(f'WALL_{sign}_{i}_panel',[x,2.55,z-sign*.265],[7.65,3.6,.045],'concrete')
        box(f'WALL_{sign}_{i}_base',[x,.43,z-sign*.28],[7.72,.7,.06],'dark')
        box(f'WALL_{sign}_{i}_reveal',[x,4.56,z-sign*.29],[7.7,.19,.07],'dark')
        box(f'WALL_{sign}_{i}_lamp',[x,4.57,z-sign*.34],[3.1,.055,.03],'light_cyan' if sign<0 else 'light_warm')
        box(f'WALL_{sign}_{i}_fin',[x-3.9,3.3,z+sign*.34],[.34,6.6,1.1],'dark',bevel=.1)
        box(f'WALL_{sign}_{i}_fin_cap',[x-3.9,6.5,z+sign*.34],[.54,.25,1.2],'steel')
        for k in range(4):box(f'WALL_{sign}_{i}_vent{k}',[x+2,1.05+k*.16,z-sign*.30],[1.3,.065,.04],'seam')
    # overhead service rails against perimeter, above any player.
    box(f'WALL_{sign}_upper_beam',[0,6.1,z],[72,.42,.8],'dark',bevel=.09)
for side in [-1,1]:
    x=side*36;mat='cyan' if side<0 else 'amber';tag='01' if side<0 else '02'
    for z in range(-24,25,8):
        box(f'END_{side}_{z}_panel',[x-side*.27,2.5,z],[.04,3.7,7.6],'wall')
        box(f'END_{side}_{z}_pier',[x+side*.25,3.3,z+3.8],[1.1,6.6,.35],'dark')
        box(f'END_{side}_{z}_strip',[x-side*.31,4.5,z],[.04,.12,5.9],mat)
    # Arrival screen: panel insets, insulated foot, upper rib crown, opposing readable IDs.
    x=side*26
    box(f'ARRIVAL_{side}_boot',[x,.24,0],[.64,.48,15.8],'rubber')
    box(f'ARRIVAL_{side}_crown',[x,4.47,0],[.65,.18,16.1],'steel')
    for face in [-1,1]:
        for j,z in enumerate([-6,-2,2,6]):
            box(f'ARRIVAL_{side}_{face}_{j}_inset',[x+face*.31,2.25,z],[.035,3.65,3.72],'wall')
            box(f'ARRIVAL_{side}_{face}_{j}_accent',[x+face*.335,3.86,z],[.018,.11,3.1],mat)
            for k in range(4):box(f'ARRIVAL_{side}_{face}_{j}_louvre{k}',[x+face*.34,.86+k*.18,z],[.02,.07,2.7],'dark')
    for z in [-7.8,7.8]:
        box(f'ARRIVAL_{side}_{z}_edge',[x,2.2,z],[.68,4.3,.16],mat)
    text(f'ARRIVAL_{side}_sign',f'{tag}  /  ARRIVAL',[x+(-.36 if side<0 else .36),2.5,0],.48,mat,(math.pi/2,0, -math.pi/2 if side<0 else math.pi/2))
# Court screen architecture: top rails, framed panels, seams and hardware; remain flush.
for o in data['objects']:
    if not any(o['id'].startswith(p) for p in ['court_wall','north_court_wing','south_court_screen']):continue
    x,y,z=o['position'];w,h,d=o['size'];n=o['id']
    box(n+'_foot',[x,.2,z],[w,.4,d+.04],'dark')
    box(n+'_rail',[x,h-.08,z],[w+.03,.16,d+.05],'steel')
    for sign in [-1,1]:
        box(n+f'_skin{sign}',[x,1.95,z+sign*(d/2+.017)],[w-.25,2.85,.034],'cover')
        box(n+f'_stripe{sign}',[x,3.15,z+sign*(d/2+.039)],[w-.6,.065,.012],'cyan' if z<0 else 'amber')
        for xx in [x-w/2+.18,x+w/2-.18]:
            box(n+f'_post{sign}_{xx}',[xx,1.85,z+sign*(d/2+.038)],[.1,3.3,.04],'dark')
# Gallery: inset fascia, ribs, toe detail; all foot-height detailing inside deck solid.
box('GALLERY_front_fascia',[0,2.82,-13.985],[23.8,.27,.03],'dark')
for x in range(-11,12,2):
    box(f'GALLERY_fascia_rib{x}',[x,2.82,-13.96],[.08,.27,.035],'steel')
box('GALLERY_lamp',[0,2.84,-13.94],[22,.065,.018],'light_cyan')
for x in [-8,8]:
    box(f'GALLERY_cover_face{x}',[x,3.57,-13.982],[3.7,.8,.04],'wall')
    box(f'GALLERY_cover_glow{x}',[x,4.06,-14.3],[3.65,.035,.5],'cyan')
# Ramps: slender inset grippy treads follow exact slope and stop short of route edges.
for o in data['objects']:
    if o['type']!='ramp':continue
    x,_,z=o['position'];w,h,d=o['size'];axis=o['axis'];L=w if axis=='x' else d
    for i in range(1,20):
        t=-L/2+L*i/20;yy=h*(1-(t/(L/2))*o['lowAt'])/2
        p=[x+t if axis=='x' else x,yy+.009,z if axis=='x' else z+t]
        size=[.07,.018,d-.6] if axis=='x' else [w-.6,.018,.07]
        ob=box(f'{o["id"]}_tread{i}',p,size,'rubber','DETAIL_FLOOR',0)
        if axis=='x':ob.rotation_euler.y=math.atan(h/L)*o['lowAt']
        else:ob.rotation_euler.x=math.atan(h/L)*o['lowAt']
# Cover systems: rubber feet, light armor plates, seam channels, recessed access ports.
for o in data['objects']:
    if o['role']!='cover' or o['id']=='reactor_plinth':continue
    x,y,z=o['position'];w,h,d=o['size'];n=o['id'];top=y+h/2
    if n=='reactor_core':continue
    box(n+'_sole',[x,y-h/2+.09,z],[w+.025,.18,d+.025],'rubber','DETAIL_EQUIPMENT')
    if w>2 and h>1:
        for sign in [-1,1]:
            box(n+f'_armor{sign}',[x,y+.03,z+sign*(d/2+.018)],[w-.24,h-.34,.036],'white','DETAIL_EQUIPMENT',.06)
            box(n+f'_insert{sign}',[x,y+.12,z+sign*(d/2+.041)],[w*.59,min(.32,h*.24),.018],'glass','DETAIL_EQUIPMENT',.02)
            for dx in [-w*.4,w*.4]:cyl(n+f'_latch{sign}_{dx}',[x+dx,y,z+sign*(d/2+.05)],.052,.026,'steel',axis='z',verts=8)
    if n.startswith('lab_pod'):
        # Three lab cartridges carry broad flush observation windows and crown vents.
        box(n+'_window',[x,y+.15,z-1.525],[2.35,1.6,.04],'glass','DETAIL_EQUIPMENT',.07)
        for dx in [-.85,0,.85]:box(n+f'_window_div{dx}',[x+dx,y+.15,z-1.55],[.045,1.6,.026],'steel','DETAIL_EQUIPMENT')
        for dx in [-.8,-.4,0,.4,.8]:box(n+f'_roof_vent{dx}',[x+dx,top+.035,z],[.17,.07,2.5],'dark','DETAIL_EQUIPMENT')
        text(n+'_id','SPECIMEN / '+str(int(x)+11).zfill(2),[x,2.85,z-1.57],.19,'amber')
# Central heliostat experiment. Armored cube keeps its original cover footprint;
# collar, layered lens, mast and split crown form the strong focal silhouette.
box('HELIOS_core_armor',[0,2,1.2],[3.62,3.56,3.62],'dark','DETAIL_EQUIPMENT',.2)
for sign in [-1,1]:
    for axis in ['x','z']:
        p=[sign*1.825,2,1.2] if axis=='x' else [0,2,1.2+sign*1.825]
        s=[.07,2.65,2.95] if axis=='x' else [2.95,2.65,.07]
        box(f'HELIOS_{axis}_{sign}_skin',p,s,'white','DETAIL_EQUIPMENT',.1)
        pp=[sign*1.87,2.03,1.2] if axis=='x' else [0,2.03,1.2+sign*1.87]
        cyl(f'HELIOS_{axis}_{sign}_housing',pp,.9,.12,'dark',axis=axis,verts=32)
        pp[0 if axis=='x' else 2]+=sign*.072
        cyl(f'HELIOS_{axis}_{sign}_glass',pp,.72,.04,'glass',axis=axis,verts=32)
        pp[0 if axis=='x' else 2]+=sign*.025
        cyl(f'HELIOS_{axis}_{sign}_lens',pp,.39,.015,'light_cyan',axis=axis,verts=32)
for y,r,h,mat in [(3.86,1.7,.14,'steel'),(4.02,1.46,.18,'dark'),(4.18,1.2,.16,'glass'),(4.33,.7,.14,'light_cyan'),(4.72,.28,.65,'steel')]:cyl(f'HELIOS_crown_{y}',[0,y,1.2],r,h,mat,verts=32)
for x in [-1.24,1.24]:
    box(f'HELIOS_split_fin{x}',[x,4.53,1.2],[.3,1.28,2.8],'dark','DETAIL_EQUIPMENT',.09)
    box(f'HELIOS_split_light{x}',[x,5.08,1.2],[.31,.07,2.45],'light_cyan','DETAIL_EQUIPMENT')
text('HELIOS_label','H E L I O S  /  07',[0,3.12,3.08],.19,'dark')
# Objective console and flush HUD panels.
box('CONSOLE_screen',[0,1.43,9.5],[2.26,.04,.52],'glass','DETAIL_EQUIPMENT')
for x in [-.72,0,.72]:box(f'CONSOLE_readout{x}',[x,1.455,9.5],[.45,.008,.26],'light_cyan','DETAIL_EQUIPMENT',0)
# Back-wall high service header and transparent-looking opaque glazing panels stay
# on the solid perimeter: no new player-height collision or open routes obstructed.
text('NORTH_identity','P A R H E L I O N',[0,5.14,-27.65],1.0,'white')
text('NORTH_subtitle','ASTER  /  HELIOSTAT RESEARCH',[0,4.25,-27.65],.32,'cyan')
text('SOUTH_identity','03    /    BIOLOGICAL SYSTEMS',[0,4.68,27.64],.65,'amber',(math.pi/2,0,math.pi))
for a in data['anchors']:
    ob=bpy.data.objects.new(a['id'],None);cols['ANCHORS'].objects.link(ob);ob.location=conv(a['position']);ob.empty_display_type='ARROWS';ob.empty_display_size=.65
    for k,v in a.items():
        if k!='position':ob[k]=json.dumps(v) if isinstance(v,(dict,list)) else v
for r in data['routes']:
    cu=bpy.data.curves.new(r['id'],'CURVE');cu.dimensions='3D';s=cu.splines.new('POLY');s.points.add(len(r['points'])-1)
    for p,v in zip(s.points,r['points']):p.co=(*conv([v[0],v[1]+.08,v[2]]),1)
    ob=bpy.data.objects.new('ROUTE_'+r['id'],cu);cols['ANCHORS'].objects.link(ob)
# Export baseline solids separately, then batch all evaluated decoration by material.
# Editable named modules remain intact in DETAIL collections in the .blend.
dg=bpy.context.evaluated_depsgraph_get();groups={}
for cn in ['DETAIL_ARCHITECTURE','DETAIL_EQUIPMENT','DETAIL_FLOOR']:
    for ob in cols[cn].objects:
        ev=ob.evaluated_get(dg);me=bpy.data.meshes.new_from_object(ev,depsgraph=dg);me.transform(ob.matrix_world)
        if not me.vertices:continue
        name=ob.data.materials[0].name;groups.setdefault(name,[]).append(me)
for mat,parts in groups.items():
    vs=[];fs=[]
    for me in parts:
        off=len(vs);vs.extend(tuple(v.co) for v in me.vertices);fs.extend(tuple(i+off for i in p.vertices) for p in me.polygons);bpy.data.meshes.remove(me)
    me=bpy.data.meshes.new('BATCH_'+mat);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new('DETAIL_'+mat,me);cols['EXPORT_BATCHES'].objects.link(ob);me.materials.append(materials[mat]);ob['decorative']=True;ob['collision']=False;ob['role']='detail_batch'
for col,file in [('VISUAL','station_visual.glb'),('COLLISION','station_collision.glb')]:
    bpy.ops.object.select_all(action='DESELECT')
    for ob in cols[col].objects:ob.select_set(True)
    if col=='VISUAL':
        for ob in cols['EXPORT_BATCHES'].objects:ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets'/file),export_format='GLB',use_selection=True,export_extras=True,export_apply=True)
cols['EXPORT_BATCHES'].hide_render=True;cols['EXPORT_BATCHES'].hide_viewport=True
cols['COLLISION'].hide_render=True;cols['COLLISION'].hide_viewport=True
# Presentation lighting matches runtime direction and palette, without texture dependencies.
world=scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.23,.33,.42,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
bpy.ops.object.light_add(type='SUN',location=(-20,-12,30));sun=bpy.context.object;sun.name='Late afternoon / broad shadows';sun.rotation_euler=(.42,-.48,-.55);sun.data.energy=2.5;sun.data.angle=.12;move_col(sun,'PRESENTATION')
for p,energy,color,size in [((0,4,22),2600,(.67,.85,1),35),((0,-18,12),1600,(.4,.85,1),20),((0,20,14),1900,(1,.76,.47),24)]:
    bpy.ops.object.light_add(type='AREA',location=p);l=bpy.context.object;l.data.energy=energy;l.data.color=color;l.data.shape='DISK';l.data.size=size;move_col(l,'PRESENTATION')
bpy.ops.object.camera_add(location=(48,60,53));cam=bpy.context.object;move_col(cam,'PRESENTATION');cam.name='Preview / overview';cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=87;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.view_settings.view_transform='AgX';scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=80;area.spaces.active.region_3d.view_location=(0,0,1);area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion();area.spaces.active.shading.type='MATERIAL'
bpy.ops.object.select_all(action='DESELECT');bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/aster_research_station.blend'))
(ROOT/'previews').mkdir(exist_ok=True)
if '--no-render' in sys.argv:
    print('ASTER_BUILD_OK_NO_RENDER');sys.exit(0)
scene.render.filepath=str(ROOT/'previews/01-overview.png');bpy.ops.render.render(write_still=True)
cam.data.type='PERSP';cam.data.lens=23;cam.location=conv([-14,7,14]);cam.rotation_euler=(Vector(conv([0,2,0]))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/'previews/02-court.png');bpy.ops.render.render(write_still=True)
cam.location=conv([13,5.8,-20]);cam.rotation_euler=(Vector(conv([-4,2,3]))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/'previews/03-gallery.png');bpy.ops.render.render(write_still=True)
print('ASTER_BUILD_OK',len(cols['VISUAL'].objects),len(cols['COLLISION'].objects),len(cols['EXPORT_BATCHES'].objects),'batches',sum(len(cols[c].objects) for c in cols if c.startswith('DETAIL')),'editable details')
