"""Homeward Circuit: one deterministic source for tactical collision and authored art.
Run python3 arena-maps/homeward/source/build.py from any directory. No Blender required.
"""
from pathlib import Path
import sys,json,math
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'_lib'))
from glbkit import Mesh,write_glb
from erakit import gable,beam,synth_materials
from town_finish import civic_finish
objects=[];anchors=[];routes=[];zones=[]
def box(id,x,y,z,w,h,d,mat='plaster',role='wall',collision=True):
    objects.append(dict(id=id,type='box',position=[x,y,z],size=[w,h,d],material=mat,collision=collision,role=role))
def wall(id,x,z,w,d,h=3.6,mat='plaster'):box(id,x,h/2,z,w,h,d,mat)
def route(id,points):routes.append(dict(id=id,name=id,points=[[x,y,z] for x,y,z in points]))
box('floor',0,-.2,0,60,.4,44,'paving','floor')
for s in (-1,1):
    wall(f'edge_x{s}',s*29.8,0,.4,44,5,'stone')
    wall(f'edge_z{s}',0,s*21.8,60,.4,5,'stone')
    wall(f'spawn_screen{s}',s*22,0,1,12,4.8) # ray audit: cover high-angle stair views
    wall(f'spawn_wing{s}',s*23.4,0,2.8,1.2,3.2,'stone')
    # Side/back pockets retain two separate exits; outer side spawns have frontal baffles.
    for z in (-18,18):
        wall(f'pocket_front{s}_{z}',s*19,z-math.copysign(2,z),4.8,.4)
        wall(f'pocket_back{s}_{z}',s*19,z+math.copysign(2,z),4.8,.4)
        wall(f'pocket_inner{s}_{z}',s*16.55,z-math.copysign(.6,z),.4,1.8)
    for i,(x,z) in enumerate([(s*26,-4),(s*26,4),(s*19,-18),(s*19,18)]):
        # Spawn view follows a clear exit instead of aiming directly into the safety screen.
        # Three's horizontal forward vector is [-sin(yaw), -cos(yaw)].
        yaw=math.atan2(s*2,-math.copysign(3.4,z)) if i<2 else -s*math.pi/2
        anchors.append(dict(id=f'spawn_{s}_{i}',kind='spawn',team='west' if s<0 else 'east',position=[x,0,z],facingYaw=round(yaw,6)))
        zones.append(dict(team='A' if s<0 else 'B',min=[x-1.5,z-1.5],max=[x+1.5,z+1.5],padding=3))
# Four offset doors: split wall segments, with lintels matching 2.6m clearance.
for side,axis,coord,door in [('west','z',-5.4,-2.6),('east','z',5.4,2.6),('north','x',-5.4,2.6),('south','x',5.4,-2.6)]:
    for j,(lo,hi) in enumerate([(-5.4,door-1.2),(door+1.2,5.4)]):
        if axis=='z':wall(f'hall_{side}_{j}',coord,(lo+hi)/2,.24,hi-lo,3.2)
        else:wall(f'hall_{side}_{j}',(lo+hi)/2,coord,hi-lo,.24,3.2)
    if axis=='z':box(f'lintel_{side}',coord,2.9,door,.24,.6,2.4,'timber')
    else:box(f'lintel_{side}',door,2.9,coord,2.4,.6,.24,'timber')
wall('central_cabinet',0,0,3.2,3.2,3.2,'timber')
# Offset outside corners stop the two-door cross-map diagonal without narrowing doors.
wall('north_entry_screen',5.4,-6.6,2.4,.35,3.2,'stone')
wall('south_entry_screen',-5.4,6.6,2.4,.35,3.2,'stone')
# A service kiosk breaks the long rear street into two readable encounters.
wall('street_service_kiosk',0,16,2.4,5.2,3.4,'plaster')
# Two yards: reliable full height cover; offsets break north/south long lines.
wall('lamp_cover',-13,-3,4,1.4,2.6,'stone')
wall('cargo_cover',13,3,4,1.4,2.6,'timber')
wall('lamp_elbow',-15,-5,.5,3,2.6,'stone')
wall('cargo_elbow',15,5,.5,3,2.6,'timber')
wall('lamp_crossing_cover',-16,0,4,1.4,2.4,'stone')
wall('cargo_crossing_cover',16,0,4,1.4,2.4,'timber')
for s in (-1,1):
    wall(f'workshop{s}',s*11,-19.3,8,5,4.8,'plaster')
    wall(f'living{s}',s*10,18.275,9,7.05,4.5,'plaster')
    wall(f'outer_shutter{s}',s*27,12,5,4,4.3,'plaster')
    wall(f'outer_shop{s}',s*27,-12,5,4,4.3,'plaster')
    wall(f'outer_stall{s}',s*20,3,3,2.2,2.6,'plaster')
    wall(f'north_turn{s}',s*19,-10,.5,4,3.6,'stone')
    wall(f'south_turn{s}',s*19,10,.5,4,3.6,'stone')
    # Closed service booths cut the formerly unbroken 58 m south crossing.
    wall(f'south_occluder{s}',s*4,10,2,5,3.6,'plaster')
# Sealed platform base and two ordinary collision ramps; art stair treads lie on ramps.
box('terrace_base',0,1.3,-12,6,2.6,5,'stone')
# The rear radio equipment room breaks the north-front transverse sightline.
# It joins the sealed platform; both side stair entrances and z=-18 back route stay open.
wall('radio_service_cabinet',0,-15.6,2.6,2.2,3.6,'plaster')
for s in (-1,1):
    objects.append(dict(id=f'stair{s}',type='ramp',position=[s*5.5,0,-14],size=[5,2.6,2.4],axis='x',lowAt=s,material='metal',role='ramp',collision=True))
box('terrace_back',0,3.6,-14.4,6,2,.2,'metal')
for s in (-1,1):
    box(f'terrace_flank{s}',s*2.9,3.6,-10.8,.2,2,4,'metal')
    box(f'terrace_front{s}',s*2,3.6,-9.55,2,2,.2,'metal')
# The north door can be seen, both yards remain shielded by the deep flanks.
for s in (-1,1):
    wall(f'terrace_baffle{s}',s*4,-7.6,2,1,5,'plaster')
# Unique yard landmarks, outside the playable silhouette at critical corners.
wall('lamp_pedestal',-11,-10,1.1,1.1,.6,'stone')
box('lamp_column',-11,2.1,-10,.18,3,.18,'metal')
box('return_lantern',-11,3.65,-10,.65,.7,.65,'glow',collision=False)
box('cargo_canopy',11,3.4,9,6,.2,4,'roof')
for x in (8.2,13.8):
    for z in (7.2,10.8):wall(f'cargo_post{x}_{z}',x,z,.25,.25,3.4,'timber')
wall('cargo_stack',11,10,3,1.2,1.3,'timber')
# Navigation anchors are outside the cabinet, never the occupied centre.
for id,x,y,z in [('lamp_yard',-9,0,-6),('cargo_yard',9,0,6),('hall_w',-3.4,0,0),('hall_e',3.4,0,0),('terrace',0,2.6,-11),('north',0,0,-18),('south',0,0,12.8)]:anchors.append(dict(id=id,kind='objective',position=[x,y,z]))
ring=[(-3.4,0,0),(-3.4,0,-3.4),(0,0,-3.4),(3.4,0,-3.4),(3.4,0,0),(3.4,0,3.4),(0,0,3.4),(-3.4,0,3.4),(-3.4,0,0)]
route('hall_eight_corner_ring',ring)
route('yards_short', [(-9,0,-6),(-7,0,-2.6),(-3.4,0,-2.6),(-3.4,0,-3.4),(3.4,0,-3.4),(3.4,0,2.6),(7,0,2.6),(9,0,6)])
for s in (-1,1):
    route(f'stairs_{s}',[(s*19,0,-13),(s*9,0,-14),(s*8,0,-14),(s*3,2.6,-14),(0,2.6,-13),(0,2.6,-11)])
    route(f'spawn_exit_{s}',[(s*26,0,-4),(s*24,0,-7.4),(s*20.5,0,-7.4),(s*17,0,-7)])
    route(f'south_exit_{s}',[(s*26,0,4),(s*24,0,7.4),(s*20.5,0,7.4),(s*17,0,7)])
route('north_outer',[(-19,0,-13),(-16,0,-13),(-9,0,-13),(-9,0,-14),(-8,0,-14)])
route('south_outer',[(-17,0,13),(-5,0,13),(0,0,12.8),(5,0,13),(17,0,13)])
callouts=[dict(name=n,min=a,max=b,surface=s) for n,a,b,s in [('灯前小院 · Lamp yard',[-18,-12],[-6,0],'stone'),('货棚后院 · Cargo yard',[6,0],[18,12],'wood'),('公共穿堂 · Passage',[-5.4,-5.4],[5.4,5.4],'stone'),('晾台 · Terrace',[-8,-15.2],[8,-9.5],'metal'),('广播后廊 · Radio lane',[-16,-21],[16,-15.2],'stone'),('生活回街 · Back street',[-18,12],[18,21],'stone')]]
data=dict(mapId='homeward',version='1.2.0-homecoming',bounds=dict(min=[-30,-.4,-22],max=[30,12,22]),objects=objects,anchors=anchors,routes=routes,player=dict(radius=.32,height=1.8,eyeHeight=1.62,walkSpeed=5.2,stepHeight=.32),presentation=dict(preset='homecoming',glows=[[-11,3.65,-10,1.3,'#ffcf84',.08]],pools=[[-11,.025,-10,2,'#ffc875',.3]]),tactical=dict(spawnZones=zones,callouts=callouts))
(ROOT/'runtime/map.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
MATS={'paving':('#8f9997',0,.93,0,1),'plaster':('#bda889',0,.9,0,1),'stone':('#727f83',.05,.85,0,1),'timber':('#68482f',0,.8,0,1),'metal':('#526b73',.5,.5,0,1),'roof':('#3d6668',.3,.65,0,1),'glow':('#ffd399',.1,.4,1.3,1),'paper':('#f3e7cc',0,.9,0,1),'ink':('#344b59',0,.8,0,1),'green':('#688878',0,.9,0,1),'red':('#b66a50',0,.8,0,1)}
nodes=[]
for o in objects:
    mesh=Mesh();x,y,z=o['position'];w,h,d=o['size'];mat=o['material']
    if o['type']=='ramp':mesh.wedge(mat,o)
    else:mesh.cbox(mat,(x,y,z),(w,h,d))
    nodes.append(('VIS_'+o['id'],mesh,dict(source_id=o['id'],role=o['role'],decorative=not o['collision'])))
# Architectural finish follows collision bounds: skirting, seams, shutters, roofing, gutters.
D=Mesh()
for o in objects:
    x,y,z=o['position'];w,h,d=o['size']
    if o['material']=='plaster' and o['role']=='wall':
        D.cbox('stone',(x,.18,z),(w+.015,.36,d+.015))
        if h>4:
            D.cbox('roof',(x,h+.08,z),(w+.04,.16,d+.04))
            for side in (-1,1):
                zz=z+side*(d/2+.015)
                for xx in [x-w*.28,x+w*.28]:
                    D.cbox('metal',(xx,2.2,zz),(1.3,1.4,.02))
                    for j in range(5):D.cbox('timber',(xx,1.65+j*.26,zz+side*.02),(1.24,.1,.03))
                D.cbox('timber',(x,1.05,zz),(1.1,2.1,.03))
                D.cbox('glow',(x,2.65,zz),(.22,.24,.08))
    if o['material']=='timber' and o['role']=='wall':
        for j in range(max(1,int(h/.28))):D.cbox('ink',(x,y-h/2+j*.28,z-d/2-.003),(w,.012,.008))
# Timetable, public benches, workshop target boards, radio aerial and sheltered notice cases.
for x,z in [(-9,-18),(9,-18)]:
    for j in range(3):D.cbox('paper',(x-.5+j*.5,1.8,z+2.52),(.42,.7,.02))
    for j in range(7):D.cbox('ink',(x,1.55+j*.07,z+2.54),(1.3,.015,.012))
# Benches are outside the boundary: the old positions sat directly on spawn exit routes.
for x,z in [(-33,16),(33,16)]:
    D.cbox('timber',(x,.45,z),(1.4,.12,.45));D.cbox('timber',(x,.85,z+.23),(1.4,.65,.08))
    for s in (-1,1):D.cbox('metal',(x+s*.5,.22,z),(.08,.44,.4))
# Upper wires and laundry stay above aim height; no new invisible collider.
for j in range(3):
    D.cbox('metal',(-10+j*2,5.8,0),(.02,.02,25))
    D.cbox(['paper','red','green'][j],(-10+j*2,5.3,11),(.75,.8,.025))
D.prism('metal',(0,5.5,-19),.08,7,10,y0=2)
D.cbox('metal',(0,8.5,-19),(3,.05,.05))
# Paving joints and direction bands, legible but quiet under fire.
for x in range(-28,29,4):D.cbox('stone',(x,.003,0),(.018,.004,43))
for z in range(-20,21,4):D.cbox('stone',(0,.003,z),(59,.004,.018))
for s in (-1,1):
    for z in (-4,4):D.cbox('glow',(s*26,.012,z),(1.8,.012,.08))
# Out-of-bounds homes, station sign and water-wheel silhouette provide town identity.
for x in range(-35,36,10):
    D.cbox('plaster',(x,3,-27),(7,6,5));D.cbox('roof',(x,6.2,-27),(7.5,.4,5.5));D.cbox('glow',(x,2,-24.48),(1,1.3,.02))
# The eastern canal wheel is authored vertically in town_finish.civic_finish.
D.cbox('timber',(-33,4,8),(.2,8,.2));D.cbox('paper',(-33,5.5,8),(3,1,.1))
# Finished town architecture: slate roofs, timber bays and warm window insets.
# Dressing stays on solid facades or above inaccessible buildings; movement geometry is unchanged.
for o in objects:
    x,y,z=o['position'];w,h,d=o['size']
    if o['material']=='plaster' and h>4 and w>3 and d>3:
        gable(D,'roof','plaster',x-w/2,x+w/2,z-d/2,z+d/2,h+.18,h+1.45,over=.28,rows=10,row_mat='metal')
        for side in (-1,1):
            zz=z+side*(d/2+.04)
            D.cbox('timber',(x,h-.08,zz),(w,.18,.07))
            D.cbox('timber',(x,.65,zz),(w,.12,.07))
            for xx in [x-w/2+.15,x+w/2-.15]:D.cbox('timber',(xx,h/2,zz),(.14,h,.09))
            for xx in [x-w*.28,x+w*.28]:
                D.cbox('glow',(xx,2.28,zz+side*.015),(1.15,1.18,.016))
                D.cbox('timber',(xx,2.28,zz+side*.03),(.065,1.3,.04))
                D.cbox('timber',(xx,2.28,zz+side*.03),(1.3,.065,.04))
                D.cbox('stone',(xx,1.55,zz),(1.55,.12,.18))
        # Chimney sits entirely over the sealed building.
        D.cbox('stone',(x+w*.24,h+1.2,z),( .6,1.6,.65))
        D.cbox('ink',(x+w*.24,h+2.02,z),(.8,.14,.85))
    if o['material']=='stone' and h>1 and w>1:
        for yy in range(1,int(h*3)):
            D.cbox('paving',(x,yy/3,z-d/2-.006),(w,.018,.012))
            D.cbox('paving',(x,yy/3,z+d/2+.006),(w,.018,.012))
    if o['id'].startswith('hall_'):
        # Shallow reveals, kept within each existing door/wall boundary.
        D.cbox('timber',(x,3.08,z),(w+.01,.18,d+.01))
        if w<d:
            for zz in [z-d/2+.08,z+d/2-.08]:D.cbox('timber',(x,1.6,zz),(w+.02,3.2,.12))
        else:
            for xx in [x-w/2+.08,x+w/2-.08]:D.cbox('timber',(xx,1.6,z),(.12,3.2,d+.02))
# Narrow ground inlays distinguish the yards without adding cover or visual noise at eye level.
for side,material in [(-1,'roof'),(1,'red')]:
    for z in range(-12,13):
        D.cbox(material,(side*7,.006,z),(.16,.008,.7))
# Roofed backdrop and a warm terminal facade fill the horizon beyond the arena wall.
for x in range(-35,36,10):
    gable(D,'roof','plaster',x-3.5,x+3.5,-29.5,-24.5,6.4,8,rows=9,row_mat='metal')
    for xx in [x-2,x+2]:
        D.cbox('glow',(xx,3.5,-24.47),(1,1.4,.02))
        D.cbox('timber',(xx,3.5,-24.44),(.07,1.5,.03))
# Brass trims and slatted crates make the cargo landmark readable at a glance.
for x in [9.7,10.5,11.3,12.1]:D.cbox('metal',(x,1.15,9.38),(.08,1.1,.045))
for xx in [-11.34,-10.66]:D.cbox('metal',(xx,3.65,-10),(.045,.8,.72))
D.cbox('roof',(-11,4.08,-10),(.9,.12,.9))
# The central solid cover is a framed notice kiosk, not an untextured cube.
gable(D,'roof','timber',-1.6,1.6,-1.6,1.6,3.25,4.15,rows=7,row_mat='metal')
for side in (-1,1):
    for xx in [-1.45,1.45]:D.cbox('metal',(xx,1.6,side*1.61),(.10,3.2,.035))
    D.cbox('paper',(0,1.7,side*1.62),(2.4,1.8,.03))
    for i in range(6):D.cbox('ink',(-.25,1.1+i*.23,side*1.65),(1.6,.045,.015))
    D.cbox('red',(.9,2.25,side*1.65),(.22,.45,.02))
# Facade plaques and recessed stall fronts keep the cover silhouette readable.
for o in objects:
    if 'outer_stall' in o['id'] or o['id']=='street_service_kiosk' or o['id'].startswith('south_occluder') or o['id']=='radio_service_cabinet':
        x,y,z=o['position'];w,h,d=o['size']
        D.cbox('timber',(x,1.1,z-d/2-.015),(w*.8,1.7,.025))
        D.cbox('roof',(x,h+.06,z),(w+.12,.12,d+.12))
        D.cbox('paper',(x,2.1,z-d/2-.04),(w*.65,.4,.025))
        for j in range(3):D.cbox('ink',(x-.3+j*.3,2.1,z-d/2-.06),(.08,.2,.015))
nodes.append(('town_details',D,dict(decorative=True,role='dressing')))
# Continuous softened ridge strips ground the town skyline; no isolated pyramid peaks.
H=Mesh()
profile=[(-108,10),(-88,15),(-72,13),(-57,20),(-41,17),(-25,23),(-8,18),(10,22),(27,18),(43,25),(62,20),(81,17),(108,10)]
for (xa,ya),(xb,yb) in zip(profile,profile[1:]):
    H.quad('ridge',(xa,-.44,-54),(xb,-.44,-54),(xb,yb,-79),(xa,ya,-79))
    H.quad('ridge_far',(xa,ya,-79),(xb,yb,-79),(xb,yb*.62,-98),(xa,ya*.62,-98))
nodes.append(('distant_ridges',H,dict(decorative=True,role='backdrop')))
nodes.extend(civic_finish(objects))
MATS.update(courtyard=('#c7b99a',0,.92,0,1),hall_tile=('#cbbd9f',0,.88,0,1),street_tile=('#9b7860',0,.93,0,1),cobble=('#64716e',0,.94,0,1),brick=('#8e6d54',0,.94,0,1),canvas=('#e0d1a9',0,.94,0,1),brass=('#b89b5c',.6,.48,0,1),earth=('#6b7962',0,1,0,1),foliage=('#718565',0,.93,0,1),water=('#527b7c',.25,.3,0,1),ridge=('#76878a',0,1,0,1),ridge_far=('#869397',0,1,0,1))
used=set(k for _,m,_ in nodes for k in m.prims)
texdir=ROOT/'assets/materials'
recipes=dict(paving=dict(kind='paving',rows=5,cols=3,contrast=30,bump=1.2),plaster=dict(kind='plaster',contrast=30),stone=dict(kind='blocks',rows=4,cols=2,contrast=32,bump=1.5),timber=dict(kind='wood',rows=18,cols=5,contrast=32,bump=.65),roof=dict(kind='tile',rows=8,cols=6,contrast=28,bump=.8),metal=dict(kind='metal',contrast=24,metal=200,rough=160))
recipes.update(courtyard=dict(kind='paving',rows=4,cols=3,contrast=16,bump=.65),hall_tile=dict(kind='tile',rows=4,cols=4,contrast=12,bump=.4),street_tile=dict(kind='brick',rows=6,cols=3,contrast=20,bump=.6),cobble=dict(kind='paving',rows=6,cols=5,contrast=24,bump=.75),brick=dict(kind='brick',rows=7,cols=3,contrast=24,bump=.6),canvas=dict(kind='cloth',contrast=13,bump=.3))
synth_materials(texdir,recipes,seed=1472,size=256)
textures={name:dict(baseColor=texdir/f'{name}_basecolor.png',orm=texdir/f'{name}_orm.png',normal=texdir/f'{name}_normal.png',scale=.5 if name=='paving' else .7,normalScale=.5) for name in recipes}
write_glb(ROOT/'assets/homeward_visual.glb',nodes,sorted(used),MATS,generator='Parhelion Homeward civic finish 3.0',textures=textures)
print(f'Homeward: {len(objects)} objects, {len(anchors)} anchors, {len(routes)} routes')
