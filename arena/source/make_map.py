"""Original Arena revision 0.2: roomier route spacing, metre-scale player unchanged."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
objects,anchors=[],[]
palette=dict(floor='#c1cbd1',wall='#8796a6',dark='#27394b',cover='#dae1df',cyan='#63d9db',amber='#efb76a',white='#eaf0ee',red='#d98282')
def box(name,p,s,mat='wall',collision=True,role='structure'):
    objects.append(dict(id=name,type='box',position=p,size=s,material=mat,collision=collision,role=role))
def ramp(name,x,z,w,d,axis,low_at):
    objects.append(dict(id=name,type='ramp',position=[x,0,z],size=[w,3,d],material='cyan',collision=True,role='ramp',axis=axis,lowAt=low_at))
def anchor(name,kind,p,**extra):anchors.append(dict(id=name,kind=kind,position=p,**extra))
box('floor_station',[0,-.3,0],[72,.6,56],'floor',role='floor')
box('wall_west',[-36,2.5,0],[.5,5,56]);box('wall_east',[36,2.5,0],[.5,5,56])
box('wall_north',[0,2.5,-28],[72,5,.5]);box('wall_south',[0,2.5,28],[72,5,.5])
for side in (-1,1):
    label='west' if side<0 else 'east';mat='cyan' if side<0 else 'amber'
    box(f'{label}_spawn_screen',[side*26,2.2,0],[.6,4.4,16],'dark')
    for sign in (-1,1):
        box(f'{label}_pocket_{sign}',[side*33.7,2.2,sign*7.5],[4.4,4.4,.5])
        box(f'{label}_door_trim_{sign}',[side*26,.04,sign*9],[3,.08,4],mat,False,'wayfinding')
    box(f'{label}_spawn_pad',[side*32,.025,0],[4,.05,5],mat,False,'wayfinding')
    anchor(f'spawn_{label}_01','spawn',[side*32,0,-1.5],yaw=1.5708 if side<0 else -1.5708,team=label)
    anchor(f'spawn_{label}_02','spawn',[side*33,0,1.5],yaw=1.5708 if side<0 else -1.5708,team=label)
    anchor(f'dash_lane_{label}','reserved_dash',[side*21,0,7],length=10,width=5)
# 6 m clear side entries. North wall no longer crowds the side ramp bodies.
for z in (-9,11):
    for x in (-15.5,15.5):box(f'court_wall_{x}_{z}',[x,1.8,z],[5,3.6,.45])
    if z==11:box('south_court_screen',[0,1.8,z],[14,3.6,.45])
    else:
        for x in (-5,5):box(f'north_court_wing_{x}',[x,1.8,z],[4,3.6,.45])
box('gallery_deck',[0,2.8,-18],[24,.4,8],'white',role='floor')
ramp('ramp_gallery_west',-17,-18,10,8,'x',-1)
ramp('ramp_gallery_east',17,-18,10,8,'x',1)
ramp('ramp_gallery_central',0,-9.5,6,9,'z',1)
for x in (-8,8):
    box(f'gallery_half_cover_{x}',[x,3.55,-14.3],[4,1.1,.6],'dark',role='cover')
    anchor(f'cover_gallery_{x}','cover',[x,3,-15.5],height=1.1,exposure='court and multiple ramp approaches')
for x in (-5,5):box(f'gallery_panel_{x}',[x,3.85,-21],[1.2,1.7,.6],'cover',role='cover')
box('gallery_route_strip',[0,3.025,-19],[22,.05,.14],'cyan',False,'wayfinding')
# Off-centre reactor gives a 4 m landing apron below the counter ramp.
box('reactor_plinth',[0,.2,1.2],[4.4,.4,4.4],'dark',role='cover')
box('reactor_core',[0,2,1.2],[3.6,3.6,3.6],'white',role='cover')
box('reactor_band',[0,2.8,1.2],[3.7,.18,3.7],'cyan',False,'landmark')
for x,z,h in [(-9,-4,1.15),(9,4,1.15),(-9,4,1.85),(9,-4,1.85)]:
    n=f'court_cover_{x}_{z}';box(n,[x,h/2,z],[3.2,h,1.6],'cover',role='cover')
    box(n+'_cap',[x,h+.04,z],[3.26,.08,1.66],'amber',False,'wayfinding')
    anchor(n+'_anchor','cover',[x,0,z+1.3 if z<0 else z-1.3],height=h)
anchor('objective_console','objective',[0,0,7],radius=2,interaction='future objective, no capture logic')
box('objective_pad',[0,.025,7],[4,.05,3],'cyan',False,'wayfinding')
box('objective_console_visual',[0,.7,9.5],[2.6,1.4,.7],'dark',role='cover')
anchor('shield_socket_court','reserved_shield',[5,0,7],width=2.4,height=2,remainingBypass=4)
for x,z in [(-10,19),(0,17),(10,19)]:
    box(f'lab_pod_{x}',[x,1.6,z],[3,3.2,3],'white',role='cover')
    box(f'lab_pod_band_{x}',[x,2.7,z],[3.06,.18,3.06],'amber',False,'wayfinding')
    anchor(f'cover_lab_{x}','cover',[x-2.2,0,z],height=3.2)
box('lab_route_strip',[0,.035,24],[47,.07,.15],'amber',False,'wayfinding')
anchor('shield_socket_lab','reserved_shield',[5,0,16],width=2.4,height=2,remainingBypass=4.5)
for x in (-10,10):
    for z in (-7,9):box(f'entry_marker_{x}_{z}',[x,.03,z],[.18,.06,3],'cyan' if z<0 else 'amber',False,'wayfinding')
routes=[
 dict(id='direct_west_objective',name='Court / objective',points=[[-32,0,-1.5],[-29,0,-1.5],[-29,0,9],[-22,0,9],[-16,0,9],[-10,0,8],[-5,0,7],[0,0,7]]),
 dict(id='south_flank',name='Lab / ground flank',points=[[-32,0,-1.5],[-29,0,-1.5],[-29,0,9],[-24,0,18],[-18,0,24],[18,0,24],[24,0,18],[29,0,9],[29,0,-1.5],[32,0,-1.5]]),
 dict(id='north_gallery',name='Gallery / high ground',points=[[-32,0,-1.5],[-29,0,-1.5],[-29,0,-9],[-24,0,-18],[-22.3,0,-18],[-12,3,-18],[12,3,-18],[22.3,0,-18],[24,0,-18],[29,0,-9],[29,0,-1.5],[32,0,-1.5]]),
 dict(id='gallery_counter',name='Court to gallery counter ramp',points=[[0,0,7],[-5,0,5],[-5,0,-4.8],[0,0,-4.8],[0,3,-14],[0,3,-18]]),
 dict(id='east_objective',name='East court entry',points=[[32,0,-1.5],[29,0,-1.5],[29,0,9],[22,0,9],[16,0,9],[10,0,8],[5,0,7],[0,0,7]])]
data=dict(mapId='aster_research_station',version='0.3.0-art-pass',mode='arena',supportedTeamLayouts=['1v1','1v2','2v2'],units='metres',upAxis='Y',bounds=dict(min=[-36,0,-28],max=[36,7,28]),palette=palette,objects=objects,anchors=anchors,routes=routes,player=dict(radius=.32,height=1.8,eyeHeight=1.65,walkSpeed=4.2,stepHeight=.28),planning=dict(hoursPerWeek=70,testingReserveHours=14,note='Planning budget only; map prototype, no AI, networking, weapons or abilities.'),clearances=dict(spawnTurn=5.2,sideEntries=6,rampFrontLane=4.775,labFrontLane=4.275,labRearLane=7.25,reactorCoverBypass=5.2))
(ROOT/'runtime/map.json').write_text(json.dumps(data,indent=2)+'\n')
print(f'Wrote {len(objects)} objects, {len(anchors)} anchors; 72 x 56 m Arena')
