"""CAM LANN: a fictional early-medieval ruined town at the edge of the last battle.
Editable Python/mesh-kit source, not an archaeological reconstruction.

2026-10-28 rebuild (max: "建筑多一点，多一点废墟"): the open heath became a burned
town for close and mid-range fighting. Layout is point-symmetric, (x, z) -> (-x, -z),
so both teams get the same town turned 180 degrees:
  * a roofless two-storey great hall per side (loft with high windows over the square),
  * a broken watch tower with a rubble ramp (the one high ground per side),
  * cottage lanes with doors and windows (tight corners, short sightlines),
  * a ruined chapel and a barn, and a market square round the sword in the stone.
The perimeter is a plain vertical bank: the old inner turf berm ramps left 0.4 m pits
in the four corners that players could fall into and not climb out of.
"""
from pathlib import Path
import sys, math, random
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT.parent/'_lib'))
from glbkit import Mesh
from chapterkit import Chapter, mat, beam, flag, cone, frustum, brazier, torch, tent, lantern, hiproof, box_edges
from surfaces import build as build_surfaces, ground_atlas
P=dict(turf=mat('#9caf78'), moss=mat('#6f8d5e'), earth=mat('#947a59'), path=mat('#c5af87'),
    stone=mat('#bdc6b9'), stoneShade=mat('#9aaba5'), stoneLight=mat('#d1d3bd'), timber=mat('#a37f50'),
    grain=mat('#555043'), cloth=mat('#425f88'), gold=mat('#d5b36c',.65,.45), iron=mat('#68767b',.65,.58),
    heather=mat('#b9a8c1'), distant=mat('#9baeb8'), thatch=mat('#bca46b'), thatchShade=mat('#8f8159'),
    leaf=mat('#92aa68'), leafLight=mat('#b9be78'), bark=mat('#645947'), flower=mat('#e6cf98'), hill=mat('#91a68e'), distantFar=mat('#bac5cb'), battlefield=mat('#ffffff'),
    flame=mat('#ff9a3c',0,1,3.2), flameCore=mat('#ffe6a0',0,1,4.5), coal=mat('#c2461e',0,.9,1.6), ash=mat('#4c4640'),
    leather=mat('#6e4c33'), shieldRed=mat('#8e3a30'), canvas=mat('#d9c9a3'), canvasShade=mat('#ad9a77'),
    castle=mat('#a9a6a4'), castleShade=mat('#8a8c93'), castleRoof=mat('#5d6c86'), windowGlow=mat('#ffc477',0,1,2.4),
    plaster=mat('#e2d6bb'), charred=mat('#3b3530'), flag=mat('#b3a68e'), lampGlass=mat('#ffd08a',0,1,2.2), water=mat('#3d4c55',.2,.25))
c=Chapter(ROOT,'camlann','CAM LANN 誓约荒原',64,48,'oathfield',P); D=c.detail; rng=random.Random(917)
surfaces=build_surfaces(ROOT/'assets/materials')
c.textures={name:dict(surfaces[family],scale=scale) for name,family,scale in [
    ('stone','fieldstone',.75),('stoneShade','fieldstone',.75),('stoneLight','fieldstone',.75),('flag','fieldstone',.45),
    ('timber','oak',.7),('grain','oak',.7),('bark','oak',.5),('thatch','oak',1.2),('thatchShade','oak',1.2),('charred','oak',.7),
    ('turf','turf',.45),('moss','turf',.45),('hill','turf',.16),('earth','earth',.65),('path','earth',.8),('plaster','earth',.35),
    ('cloth','linen',1.1),('canvas','linen',1.1),('iron','iron',.8)]}

# ---------------------------------------------------------------- authoring helpers
MIRROR=[]; ART={}; DOORS=[]
def r3(v): return round(v,3)
def B(id,x0,x1,y0,y1,z0,z1,material,role='cover',mirror=True,batch='town',art=None,collision=True):
    """Box by extents. West-side pieces are mirrored to the east at the end (point symmetry)."""
    id=id+'_w' if mirror else id
    o=dict(id=id,type='box',position=[r3((x0+x1)/2),r3((y0+y1)/2),r3((z0+z1)/2)],size=[r3(x1-x0),r3(y1-y0),r3(z1-z0)],
        material=material,collision=collision,role=role)
    if batch: o['batch']=batch
    c.objects.append(o)
    if mirror: MIRROR.append(o)
    if art: ART[id]=art
    return o
def R(id,x0,x1,z0,z1,h,axis,low,material):
    id=id+'_w'
    o=dict(id=id,type='ramp',position=[r3((x0+x1)/2),0,r3((z0+z1)/2)],size=[r3(x1-x0),h,r3(z1-z0)],material=material,collision=True,role='ramp',axis=axis,lowAt=low,batch='town')
    c.objects.append(o); MIRROR.append(o); return o
def wall(id,axis,a0,a1,c0,c1,h,holes=(),crown=(0,),material='stone',lintel='stoneLight',chunk=1.6):
    """A wall along `axis` from a0 to a1, thickness c0..c1. holes: (h0,h1,sill,head); a head
    above the wall height leaves the hole open to the sky (a breach). Solid stretches are cut
    into chunks with ruined crown heights; door and window heads keep the full height."""
    def put(k,s0,s1,y0,y1,art):
        if axis=='x': B(f'{id}_{k}',s0,s1,y0,y1,c0,c1,material,'structure',art=art)
        else: B(f'{id}_{k}',c0,c1,y0,y1,s0,s1,material,'structure',art=art)
    k=0; cur=a0; spans=[]
    for h0,h1,sill,head in sorted(holes):
        if sill==0: DOORS.append((id,axis,h0,h1,c0,c1))
        if h0>cur+.01: spans.append(('solid',cur,h0,0,0))
        spans.append(('hole',h0,h1,sill,head)); cur=h1
    if cur<a1-.01: spans.append(('solid',cur,a1,0,0))
    ci=0
    for kind,s0,s1,sill,head in spans:
        if kind=='solid':
            n=max(1,round((s1-s0)/chunk))
            for j in range(n):
                t0,t1=s0+(s1-s0)*j/n,s0+(s1-s0)*(j+1)/n
                hh=h-crown[ci%len(crown)]; ci+=1
                ends=('q0' if abs(t0-a0)<.01 else '')+('q1' if abs(t1-a1)<.01 else '')
                put(k,t0,t1,0,hh,dict(kind='wall',axis=axis,ends=ends)); k+=1
        else:
            if sill>0: put(k,s0,s1,0,sill,dict(kind='sill',axis=axis)); k+=1
            if head<h: put(k,s0,s1,head,h,dict(kind='lintel',axis=axis,lintel=lintel)); k+=1
def A(id,kind,p,mirror=True,**kw):
    if mirror:
        c.anchor(id+'_w',kind,p,**{**kw,**({'team':'west'} if kind=='spawn' else {})})
        e=dict(kw); e.update(team='east') if kind=='spawn' else None
        if 'yaw' in e: e['yaw']=-e['yaw']
        c.anchor(id+'_e',kind,[-p[0],p[1],-p[2]],**e)
    else: c.anchor(id,kind,p,**kw)

c.box('battlefield_floor',[0,-.4,0],[64,.8,48],'turf','floor')
# The perimeter is a vertical earth bank with a palisade on its crest. No inner berm ramps:
# their overlap left corner pits (stuck-scan found four, one per corner).
for x in (-32,32): c.box('earthbank_x_'+str(x),[x,1.4,0],[1,2.8,48],'earth','structure')
for z in (-24,24): c.box('earthbank_z_'+str(z),[0,1.4,z],[64,2.8,1],'earth','structure')
for x in (-32,32): c.box('crest_palisade_x_'+str(x),[x,3.5,0],[.5,1.4,48],'timber','structure')
for z in (-24,24): c.box('crest_palisade_z_'+str(z),[0,3.5,z],[64,1.4,.5],'timber','structure')

# ---------------------------------------------------------------- west half (mirrored east)
# Spawn court behind a broken gate wall; spawns face the town.
A('spawn_0','spawn',[-28.5,0,-5],yaw=1.5708); A('spawn_1','spawn',[-28.5,0,-9],yaw=1.5708)
wall('spawn_gate','z',-14,0,-24.45,-23.55,3.6,crown=(0,.35,.15,.5,.2))
B('spawn_cloth',-30.65,-29.35,0,.04,-8.75,-5.25,'cloth','wayfinding',batch=None,collision=False)
A('cover_spawn','cover',[-25.8,0,-7],height=3.6)

# Great hall: roofless, 5 m walls, a timber loft along the south wall reached by a stair.
# The loft looks over the square through three high windows; two ground doors under it,
# a west door to the spawn court, an east door and a collapsed breach to the north lane.
wall('hall_n','x',-20,-6,-23.5,-22.9,5.2,crown=(0,.3,1.1,.5,1.8,.2,.9,0))
wall('hall_s','x',-20,-6,-15.1,-14.5,5,holes=[(-19,-17.6,3.5,4.6),(-16.5,-14.5,0,2.6),(-13.6,-11.6,3.5,4.6),(-10.5,-8.5,0,2.6),(-8,-6.8,3.5,4.6)],crown=(0,.4,.2,.9,.1,.6))
wall('hall_west','z',-22.9,-15.1,-20,-19.4,5,holes=[(-20,-18,0,2.6)],crown=(.2,0,.7))
wall('hall_east','z',-22.9,-15.1,-6.6,-6,5,holes=[(-22.9,-21.5,1.1,99),(-19.5,-17.5,0,2.6)],crown=(1.5,.4,2.1,.8))
B('hall_loft',-19.4,-6.6,2.3,2.6,-16.6,-15.1,'timber','floor',art=dict(kind='loft'))
R('hall_stair',-12.6,-7.6,-18.1,-16.6,2.6,'x',1,'timber')
for x in (-18.35,-12.25): B(f'hall_post_{int(-x*10)}',x-.15,x+.15,0,2.3,-16.45,-16.15,'timber','structure',art=dict(kind='post'))
B('hall_table',-16.5,-12.5,0,.9,-21.2,-20.2,'timber',art=dict(kind='table'))
B('hall_fallen_beam',-12,-8.2,0,.7,-22.7,-21.9,'charred',art=dict(kind='log'))
A('cover_hall_table','cover',[-14.5,0,-19.6],height=.9)
A('cover_hall_loft','cover',[-12.6,2.6,-15.8],height=2.4)
A('objective_hall','objective',[-13.5,0,-18.8],radius=2)

# Watch tower: a 2.4 m stone plinth with broken parapets, climbed by its rubble slope
# from the square. The only high ground on each side; it sees down both main lanes.
B('tower_plinth',-3.2,1.2,0,2.4,-14.2,-9.8,'stone','floor',art=dict(kind='plinth'))
R('tower_rubble',-2.4,.4,-9.8,-5,2.4,'z',1,'stoneShade')
B('tower_parapet_n',-2,1.2,2.4,3.5,-14.2,-13.7,'stone','cover',art=dict(kind='wall',axis='x',ends='q1'))
B('tower_stub',-3.2,-2,2.4,7.4,-14.2,-13,'stone','structure',art=dict(kind='stub'))
B('tower_parapet_w',-3.2,-2.7,2.4,3.3,-13,-11.2,'stone','cover',art=dict(kind='wall',axis='z',ends='q1'))
B('tower_parapet_e',.7,1.2,2.4,3.2,-13.7,-12,'stone','cover',art=dict(kind='wall',axis='z',ends='q1'))
A('cover_tower','cover',[-1,2.4,-12.4],height=1.1)
A('objective_tower','objective',[-1,2.4,-11],radius=1.5)

# Market square round the sword stone: a stall, a cart, a well.
B('stall_counter',-7.3,-4.7,0,1,3,4,'timber',art=dict(kind='counter'))
for x in (-7.3,-4.9): B(f'stall_post_{int(-x*10)}',x,x+.2,0,2.5,4.5,4.7,'timber','structure',art=dict(kind='post'))
B('stall_canopy',-7.5,-4.5,2.5,2.62,2.6,4.8,'cloth','structure',art=dict(kind='canopy'))
B('cart',-10.7,-7.3,0,1.4,-4.9,-3.1,'timber',art=dict(kind='cart'))
B('well',-5.8,-4.2,0,.95,-7.8,-6.2,'stone',art=dict(kind='well'))
A('cover_stall','cover',[-6,0,2.3],height=1)
A('cover_cart','cover',[-9,0,-2.4],height=1.4)
A('cover_well','cover',[-5,0,-5.5],height=.95)
A('objective_square','objective',[-3,0,2.8],radius=2)

# A burned house reduced to a vaultable wall, an L return and its chimney.
wall('ruin_house_n','x',-18,-13.6,-10.3,-9.8,1.4,crown=(0,.3,.1,.4))
B('ruin_chimney',-13.6,-12.6,0,4.6,-10.3,-9.3,'stone','structure',art=dict(kind='chimney'))
wall('ruin_house_w','z',-9.8,-5,-18,-17.5,2.4,crown=(0,.6,1.1,.3))
A('cover_ruin','cover',[-15.5,0,-9.2],height=1.2)

# Cottage lanes: four whole houses, roofed, with real doors (2026-10-29: max saw the half roof,
# low ruined wall tops and the fallen-in cottage as missing pieces). A door in every wall.
wall('c1_n','x',-22,-17,6,6.5,2.4,holes=[(-20.2,-18.8,0,2)],material='plaster',lintel='timber')
wall('c1_s','x',-22,-17,9.5,10,2.4,holes=[(-20.7,-19.3,0,2)],material='plaster',lintel='timber')
wall('c1_w','z',6.5,9.5,-22,-21.5,2.4,holes=[(7.3,8.7,0,2)],material='plaster',lintel='timber')
wall('c1_e','z',6.5,9.5,-17.5,-17,2.4,holes=[(7,8.4,0,2)],material='plaster',lintel='timber')
B('c1_roof',-22.35,-16.65,2.4,4.3,5.65,10.35,'thatch','structure',art=dict(kind='roof'))
B('c1_crate',-18.3,-17.5,0,.8,8.7,9.5,'timber',art=dict(kind='crate'))
wall('c2_n','x',-14,-9,8,8.5,2.4,holes=[(-12.6,-11.2,0,2)],material='plaster',lintel='timber')
wall('c2_s','x',-14,-9,11.5,12,2.4,holes=[(-12,-10.6,0,2)],material='plaster',lintel='timber')
wall('c2_w','z',8.5,11.5,-14,-13.5,2.4,holes=[(9.3,10.7,0,2)],material='plaster',lintel='timber')
wall('c2_e','z',8.5,11.5,-9.5,-9,2.4,holes=[(9.3,10.7,0,2)],material='plaster',lintel='timber')
B('c2_roof',-14.35,-8.65,2.4,4.3,7.65,12.35,'thatch','structure',art=dict(kind='roof'))
wall('c3_n','x',-21,-15,15,15.5,2.4,holes=[(-18.7,-17.3,0,2)],material='plaster',lintel='timber')
wall('c3_s','x',-21,-15,19.5,20,2.4,holes=[(-19.7,-18.3,0,2)],material='plaster',lintel='timber')
wall('c3_w','z',15.5,19.5,-21,-20.5,2.4,holes=[(16.7,18.1,0,2)],material='plaster',lintel='timber')
wall('c3_e','z',15.5,19.5,-15.5,-15,2.4,holes=[(17.8,19.2,0,2)],material='plaster',lintel='timber')
B('c3_roof',-21.35,-14.65,2.4,4.4,14.65,20.35,'thatch','structure',art=dict(kind='roof'))
B('c3_crates',-16.4,-15.6,0,1.5,15.7,16.5,'timber',art=dict(kind='crate'))
wall('c4_n','x',-11,-7,17,17.5,2.4,holes=[(-9.7,-8.3,0,2)],material='plaster',lintel='timber')
wall('c4_s','x',-11,-7,20.5,21,2.4,holes=[(-9.7,-8.3,0,2)],material='plaster',lintel='timber')
wall('c4_w','z',17.5,20.5,-11,-10.5,2.4,holes=[(18.3,19.7,0,2)],material='plaster',lintel='timber')
wall('c4_e','z',17.5,20.5,-7.5,-7,2.4,holes=[(18.3,19.7,0,2)],material='plaster',lintel='timber')
B('c4_roof',-11.35,-6.65,2.4,4.2,16.65,21.35,'thatch','structure',art=dict(kind='roof'))
A('cover_c1','cover',[-19.5,0,8],height=2.4)
A('cover_c2','cover',[-11.5,0,10],height=2.4)
A('cover_c3','cover',[-18,0,17.5],height=2.4)
A('cover_c4','cover',[-9,0,19],height=2.4)

# Ruined chapel against the south bank: arched door, a breach on the west side,
# an east door and a lancet window, two broken pilasters in the north corners and the altar.
wall('chapel_n','x',-5,0,16,16.6,4.6,holes=[(-3.2,-1.8,0,3)],crown=(.6,0,.8))
wall('chapel_w','z',16.6,23.5,-5,-4.4,3.6,holes=[(18.4,19.9,0,99),(21,22,1.4,2.8)],crown=(0,.9,.3))
wall('chapel_e','z',16.6,23.5,-.6,0,3.4,holes=[(17.7,19.1,0,2.6),(20.6,21.4,1.2,2.6)],crown=(.2,0,.7))
wall('chapel_apse','x',-4.4,-.6,23,23.5,4.2,crown=(0,.5))
B('chapel_altar',-3.3,-1.7,0,1,22,23,'stoneLight',art=dict(kind='altar'))
B('chapel_column_a',-4.4,-3.8,0,1.6,16.6,17.2,'stone',art=dict(kind='column'))
B('chapel_column_b',-1.2,-.6,0,2.8,16.6,17.2,'stone',art=dict(kind='column'))
A('cover_chapel','cover',[-2.5,0,21.6],height=1)

# Barn in the spawn court's south corner: an open timber shed with hay.
B('barn_back',-29,-28.6,0,2.6,14,20,'timber','structure',art=dict(kind='planks',axis='z'))
for z in (14,16.85,19.7): B(f'barn_post_{int(z*10)}',-24.3,-24,0,2.6,z,z+.3,'timber','structure',art=dict(kind='post'))
B('barn_roof',-29.35,-23.7,2.6,4,13.65,20.35,'thatch','structure',art=dict(kind='roof'))
B('barn_side',-28.6,-24.3,0,1.2,19.6,20,'timber','cover',art=dict(kind='planks',axis='x'))
B('barn_hay_a',-28.4,-27,0,.9,14.6,15.8,'thatch',art=dict(kind='hay'))
B('barn_hay_b',-26.6,-25.4,0,1.8,18.4,19.6,'thatch',art=dict(kind='hay'))
A('cover_barn','cover',[-26.4,0,15.2],height=.9)

# Centre: the sword in the stone on its mound (single, on the symmetry point).
B('sword_mound',-1.5,1.5,0,1.2,-1.1,1.1,'stone','cover',mirror=False,art=dict(kind='mound'))
B('sword_in_stone',-.23,.23,1.2,4.15,-.15,.15,'iron','prop',mirror=False,batch=None)

# ---------------------------------------------------------------- mirror to the east
for o in MIRROR:
    e=dict(o,id=o['id'][:-2]+'_e',position=[-o['position'][0],o['position'][1],-o['position'][2]])
    if o['type']=='ramp': e['lowAt']=-o['lowAt']
    if o['id'] in ART: ART[e['id']]=ART[o['id']]
    c.objects.append(e)
for o in c.objects:
    if o['id']=='spawn_cloth_e': o['material']='gold'

# No pillar, prop or furniture may stand in a doorway: keep 1.2 m clear on both sides.
def door_clear():
    bad=[]
    for wid,axis,h0,h1,c0,c1 in DOORS:
        for side in (-1,1):
            z0,z1=(c0-1.2,c0) if side<0 else (c1,c1+1.2)
            for o in c.objects:
                if not o['collision'] or o['type']!='box' or o['role']=='floor' or o['id'].startswith(wid+'_'): continue
                (px,py,pz),(sx,sy,sz)=o['position'],o['size']
                if py-sy/2>1.8 or py+sy/2<.3: continue
                lo,hi=(px-sx/2,px+sx/2),(pz-sz/2,pz+sz/2)
                if axis=='z': lo,hi=hi,lo
                if lo[0]<h1-.01 and lo[1]>h0+.01 and hi[0]<z1-.01 and hi[1]>z0+.01: bad.append((wid,o['id']))
    assert not bad,f'doorways blocked: {bad}'
door_clear()

# Routes run spawn to spawn; each is point-symmetric so both directions mirror.
c.route('north_hall',[[-28.5,0,-9],[-28,0,-19],[-21.5,0,-19],[-19,0,-19],[-13,0,-19.3],[-7.4,0,-18.6],[-5.4,0,-18.6],[-4.5,0,-15.2],[1.6,0,-15.2],
    [5.5,0,-15.2],[13,0,-14],[23,0,-13],[27,0,-3],[28.5,0,5]])
c.route('market',[[-28.5,0,-5],[-26,0,2],[-18,0,3],[-8,0,1],[0,0,2.5],[8,0,-1],[18,0,-3],[26,0,-2],[28.5,0,5]])
c.route('cottage_lanes',[[-28.5,0,-5],[-26,0,4],[-19.5,0,12.5],[-13,0,14.5],[-7.5,0,14.6],[-2,0,15.2],[0,0,15.2],[4.5,0,13],[14,0,12.5],[21.5,0,12.5],[22.5,0,16],[27,0,15],[28.5,0,9]])
c.route('through_houses',[[-28.5,0,-5],[-26,0,4],[-24,0,7.9],[-19.5,0,7.9],[-15.5,0,7.9],[-15.5,0,10],[-11.5,0,10],[-7,0,10],[-4,0,8],[0,0,2.5],[8,0,-1],[18,0,-3],[26,0,-2],[28.5,0,5]])
c.route('tower_climb',[[-8,0,1],[-3,0,-3],[-1,0,-4.5],[-1,2.4,-10.5],[-1,2.4,-12.2]])
c.route('loft_climb',[[-9.5,0,-12],[-9.5,0,-15.8],[-7.1,0,-17.35],[-12.3,2.6,-17.35],[-12.3,2.6,-15.8],[-17,2.6,-15.8]])

# ---------------------------------------------------------------- ground paint
TRACKS=[([(-28.5,-7),(-26,2),(-18,3),(-8,1),(0,2.5),(8,-1),(18,-3),(26,-2),(28.5,7)],1.7),
    ([(-28,-19),(-21.5,-19),(-13,-19.3),(-5.4,-18.6),(-4.5,-15.2),(5.5,-15.2),(13,-14),(23,-13),(27,-3)],1.2),
    ([(28,19),(21.5,19),(13,19.3),(5.4,18.6),(4.5,15.2),(-5.5,15.2),(-13,14),(-23,13),(-27,3)],1.2),
    ([(-26,4),(-19.5,12.5),(-13,14.5),(-7.5,14.6)],1.1),([(26,-4),(19.5,-12.5),(13,-14.5),(7.5,-14.6)],1.1),
    ([(-6,-3),(-1,-4.5),(1,4.5),(6,3)],2.4)]
ground_atlas(ROOT/'assets/materials/battlefield_ground.png',TRACKS)
c.textures['battlefield']=dict(baseColor=ROOT/'assets/materials/battlefield_ground.png',scale=1)

# ---------------------------------------------------------------- object art
def ext(o):
    (x,y,z),(w,h,d)=o['position'],o['size']
    return x-w/2,x+w/2,y-h/2,y+h/2,z-d/2,z+d/2
def bx(m,material,x0,x1,y0,y1,z0,z1,**kw): m.box(material,[x0,y0,z0],[x1,y1,z1],**kw)
def bxs(m,material,x0,x1,y0,y1,z0,z1): m.box(material,[x0,y0,z0],[x1,y1,z1],skip_bottom=True)
def coursed(m,x0,x1,ya,yb,z0,z1,along_x,rr,ends=''):
    """Coursed fieldstone between heights ya..yb: a dark mortar core, then rows of
    stones of random length, each set back by 0-4 cm, so joints and faces read in
    raking light. Quoins at a wall's true ends are long/short dressed blocks."""
    if along_x: bxs(m,'stoneShade',x0+.02,x1-.02,ya,yb,z0+.045,z1-.045)
    else: bxs(m,'stoneShade',x0+.045,x1-.045,ya,yb,z0+.02,z1-.02)
    L=(x1-x0) if along_x else (z1-z0); n=max(1,round((yb-ya)/.42)); ch=(yb-ya)/n
    for row in range(n):
        yy=ya+row*ch; t=0
        while t<L-.05:
            q=('q0' in ends and t==0) or ('q1' in ends and L-t<1.0)
            ln=(.55 if row%2 else .32) if ('q0' in ends and t==0) else rr.uniform(.42,.95)
            if L-t-ln<.3: ln=L-t
            if 'q1' in ends and L-t-ln<.62 and L-t>.62 and not q: ln=L-t-(.55 if row%2 else .32)
            col='stoneLight' if (q and (t==0 or L-t-ln<.01)) else rr.choice(('stone','stone','stoneLight','stoneShade'))
            ins=rr.choice((0,0,.018,.035))
            a,b=t+.012,t+ln-.012; y_a,y_b=yy+.012,yy+ch-.012
            if along_x: bxs(m,col,x0+a,x0+b,y_a,y_b,z0+ins,z1-ins)
            else: bxs(m,col,x0+ins,x1-ins,y_a,y_b,z0+a,z0+b)
            t+=ln
def masonry(m,o,a):
    """A wall piece: darker footing, coursed body (or half-timbered daub for cottages)
    and a cap course. Everything stays inside the collider."""
    x0,x1,y0,y1,z0,z1=ext(o); along_x=a.get('axis')=='x'; body=o['material']
    plaster=body=='plaster'
    rr=random.Random(sum(ord(v)*(i+1) for i,v in enumerate(o['id'])))
    foot=min(.45 if plaster else .32,(y1-y0)*.4)
    bx(m,'stoneShade' if not plaster else 'stone',x0,x1,y0,y0+foot,z0,z1)
    bx(m,'timber' if plaster else 'stoneShade',x0,x1,y1-.1,y1,z0,z1)
    if not plaster:
        coursed(m,x0,x1,y0+foot,y1-.1,z0,z1,along_x,rr,a.get('ends',''))
        return
    ins=.03
    if along_x: bx(m,body,x0,x1,y0+foot,y1-.1,z0+ins,z1-ins)
    else: bx(m,body,x0+ins,x1-ins,y0+foot,y1-.1,z0,z1)
    # Half-timber frame: corner posts, a mid rail and one brace per panel, all set
    # into the wall faces (inside the collider).
    L=(x1-x0) if along_x else (z1-z0)
    for t in ([0,L-.16] if L>.5 else [0]):
        if along_x: bx(m,'timber',x0+t,x0+t+.16,y0+foot,y1-.1,z0,z1)
        else: bx(m,'timber',x0,x1,y0+foot,y1-.1,z0+t,z0+t+.16)
    if y1-y0>1.6:
        yy=y0+foot+(y1-y0-foot)*.55
        bx(m,'timber',x0,x1,yy,yy+.1,z0,z1)
        if L>.9:
            flip=rr.random()<.5; d=(z1-z0) if along_x else (x1-x0)
            for face in (-1,1):
                off=face*(d/2-.05)
                p0,p1=(.2,L-.2) if flip else (L-.2,.2)
                if along_x: pa,pb=(x0+p0,yy+.1,(z0+z1)/2+off),(x0+p1,y1-.12,(z0+z1)/2+off)
                else: pa,pb=((x0+x1)/2+off,yy+.1,z0+p0),((x0+x1)/2+off,y1-.12,z0+p1)
                beam(m,'timber',pa,pb,.045,4)
def crafted(m,o):
    a=ART.get(o['id']); x0,x1,y0,y1,z0,z1=ext(o)
    if o['id'] in PROP_ART:
        PROP_ART[o['id']](m); return True
    if o['id']=='sword_in_stone':
        m.cbox('iron',[o['position'][0],2.4,o['position'][2]],[.04,1.6,.04]); return True
    if o['id']=='battlefield_floor':
        m.cbox('earth',o['position'],o['size'],top_mat='battlefield')
        positions=m.prims['battlefield'][0]
        m.uvs['battlefield']=[value for j in range(0,len(positions),3) for value in ((positions[j]+32)/64,(positions[j+2]+24)/48)]
        return True
    if o['id'].startswith('earthbank_'):
        m.cbox('earth',o['position'],o['size'],top_mat='turf'); return True
    if o['id'].startswith('crest_palisade_'):
        x,y,z=o['position']; w,h,d=o['size']; along=w>d; span=w if along else d
        bottom=y-h/2
        m.cbox('grain',[x,bottom+h*.36,z],[w*.55 if not along else w,h*.72,d*.55 if along else d])
        rr=random.Random(len(o['id'])*31+int(abs(x+z)))
        n=int(span/.5)
        for i in range(n):
            t=-span/2+(i+.5)*span/n
            cx,cz=(x+t,z) if along else (x,z+t)
            rad=.2+rr.uniform(-.02,.04); tip=.24+rr.uniform(0,.06)
            hh=h-tip-rr.uniform(0,.22)
            m.prism('timber' if i%5 else 'bark',(cx,bottom,cz),rad,hh,n=5,rot=rr.uniform(0,1))
            cone(m,'grain' if i%3==0 else 'timber',(cx,bottom+hh,cz),rad,tip,5,rr.uniform(0,1))
        for yy in (bottom+.35,bottom+.85):
            m.cbox('leather',[x,yy,z],[w-.02 if along else w*.98,.07,d*.98 if along else d-.02])
        return True
    if o['type']=='ramp':
        # Steps under the collision slope: each tread's top sits half a riser below
        # the slope at its upper edge, so the art never rises above what you walk on.
        (x,y,z),(w,h,d)=o['position'],o['size']; ax=o['axis']; low=o['lowAt']
        L=w if ax=='x' else d; n=max(2,round(h/.22)); rr=random.Random(len(o['id']))
        stone=o['material']!='timber'
        for i in range(n):
            u0,u1=L*i/n,L*(i+1)/n; top=y+(i+.5)*h/n
            # distance u from the low end -> world range along the axis
            lo_end=(x if ax=='x' else z)+(L/2 if low>0 else -L/2); sgn=-1 if low>0 else 1
            a0,a1=sorted((lo_end+sgn*u0,lo_end+sgn*u1))
            if stone:
                parts=3; W=(d if ax=='x' else w)
                for k in range(parts):
                    c0=-W/2+W*k/parts; c1=c0+W/parts; dt=rr.uniform(-.06,0)
                    col=rr.choice(('stone','stoneShade','stoneLight','stoneShade'))
                    if ax=='x': bx(m,col,a0,a1,y,top+dt,z+c0,z+c1)
                    else: bx(m,col,x+c0,x+c1,y,top+dt,a0,a1)
            else:
                if ax=='x': bx(m,'timber' if i%2 else 'grain',a0,a1,y,top,z-d/2+.06,z+d/2-.06)
                else: bx(m,'timber' if i%2 else 'grain',x-w/2+.06,x+w/2-.06,y,top,a0,a1)
        if not stone:
            for side in (-1,1):
                # stringers follow the slope, inside the wedge
                if ax=='x':
                    zz=z+side*(d/2-.03)
                    hi_x=x-L/2 if low>0 else x+L/2; lo_x=x+L/2 if low>0 else x-L/2
                    dr=1 if hi_x>lo_x else -1
                    beam(m,'grain',(lo_x+dr*.45,y+.08,zz),(hi_x-dr*.05,y+h-.3,zz),.03,4)
        return True
    if not a: return False
    k=a['kind']
    if k=='wall': masonry(m,o,a); return True
    if k=='sill':
        bx(m,'stoneShade' if o['material']=='stone' else 'stone',x0,x1,y0,y1-.08,z0,z1)
        bx(m,'stoneLight' if o['material']=='stone' else 'timber',x0,x1,y1-.08,y1,z0,z1); return True
    if k=='lintel':
        bx(m,a['lintel'],x0,x1,y0,y0+.22,z0,z1)
        if y1-y0>.32:
            if o['material']=='plaster':
                if a['axis']=='x': bx(m,'plaster',x0,x1,y0+.22,y1-.1,z0+.03,z1-.03)
                else: bx(m,'plaster',x0+.03,x1-.03,y0+.22,y1-.1,z0,z1)
            else: coursed(m,x0,x1,y0+.22,y1-.1,z0,z1,a['axis']=='x',random.Random(len(o['id'])+int(x0*7+z0*13)))
            bx(m,'timber' if o['material']=='plaster' else 'stoneShade',x0,x1,y1-.1,y1,z0,z1)
        return True
    if k=='stub':
        masonry(m,o,dict(axis='x',ends='q0q1'))
        return True
    if k=='chimney':
        masonry(m,o,dict(axis='x',ends='q0q1'))
        bx(m,'charred',x0+.25,x1-.25,y1-.02,y1,z0+.25,z1-.25)
        return True
    if k=='plinth':
        bx(m,'stoneShade',x0,x1,y0,y0+.4,z0,z1)
        for row in range(4):
            yy=y0+.4+row*.48
            for j in range(9):
                t=x0+(x1-x0)*j/9
                col=('stone','stoneLight','stone','stoneShade')[(j+row)%4]
                bx(m,col,t,t+(x1-x0)/9,yy,yy+.48,z0,z1) if row<3 else None
        bx(m,'stone',x0,x1,y0+1.84,y1-.12,z0,z1)
        bx(m,'flag',x0,x1,y1-.12,y1,z0,z1)
        return True
    if k=='loft':
        bx(m,'grain',x0,x1,y0,y0+.14,z0,z1)
        n=int((x1-x0)/.3)
        for j in range(n):
            t=x0+(x1-x0)*j/n
            bx(m,'timber' if j%3 else 'grain',t+.01,t+(x1-x0)/n-.01,y0+.14,y1,z0,z1)
        return True
    if k=='post':
        bx(m,'timber',x0,x1,y0,y1,z0,z1)
        bx(m,'grain',x0,x1,y1-.25,y1-.12,z0,z1); return True
    if k=='table':
        bx(m,'timber',x0,x1,y1-.1,y1,z0,z1)
        for xx in (x0,x1-.12):
            bx(m,'grain',xx,xx+.12,y0,y1-.1,z0+.05,z1-.05)
        bx(m,'grain',x0+.12,x1-.12,y0+.3,y0+.4,(z0+z1)/2-.05,(z0+z1)/2+.05)
        return True
    if k=='log':
        L=z1-z0; r=min(y1-y0,L)/2
        for j,(dz,rr_) in enumerate([(0,r)]):
            beam(m,'charred',(x0,y0+rr_,(z0+z1)/2),(x1,y0+rr_,(z0+z1)/2),rr_*.98,7)
        return True
    if k=='counter':
        bx(m,'grain',x0+.05,x1-.05,y0,y1-.1,z0+.05,z1-.05)
        bx(m,'timber',x0,x1,y1-.1,y1,z0,z1)
        for j in range(5):
            t=x0+.05+(x1-x0-.1)*j/5
            bx(m,'timber' if j%2 else 'bark',t,t+(x1-x0-.1)/5-.02,y0+.06,y1-.14,z0,z0+.06)
        return True
    if k=='canopy':
        n=8
        for j in range(n):
            t=x0+(x1-x0)*j/n
            m.quad('cloth' if j%2 else 'canvas',(t,y0+.02,z1),(t+(x1-x0)/n,y0+.02,z1),(t+(x1-x0)/n,y1,z0),(t,y1,z0))
            m.quad('canvasShade',(t,y1,z0),(t+(x1-x0)/n,y1,z0),(t+(x1-x0)/n,y0+.02,z1),(t,y0+.02,z1))
        return True
    if k=='cart':
        cx,cz=(x0+x1)/2,(z0+z1)/2
        bx(m,'timber',x0+.1,x1-.1,y0+.55,y0+.72,z0+.2,z1-.2)
        bx(m,'grain',x0+.3,x1-.3,y0+.05,y0+.55,z0+.4,z1-.4)
        for zz in (z0+.2,z1-.32):
            bx(m,'timber',x0+.1,x1-.1,y0+.72,y1-.05,zz,zz+.12)
        # sacks and a broken crate in the bed
        for j,(dx,dz,r) in enumerate([(-.9,-.3,.36),(-.2,.25,.4),(.6,-.2,.34)]):
            m.blob('canvas' if j%2 else 'canvasShade',(cx+dx,y0+.72+r*.7,cz+dz),r,.7)
        bx(m,'timber',x1-.95,x1-.15,y0+.72,y1-.02,z0+.35,z1-.35)
        for xx in (cx-1.0,cx+1.0):
            for zz,zz2 in ((z0+.01,z0+.18),(z1-.18,z1-.01)):
                beam(m,'grain',(xx,.56,zz),(xx,.56,zz2),.55,10)
                beam(m,'iron',(xx,.56,zz-.0),(xx,.56,zz2),.08,6)
        return True
    if k=='well':
        cx,cz=(x0+x1)/2,(z0+z1)/2
        frustum(m,'stone',(cx,y0,cz),.8,.78,y1-y0-.1,10)
        frustum(m,'stoneLight',(cx,y1-.1,cz),.8,.8,.1,10)
        m.quad('water',(cx-.5,y1-.0,cz-.5),(cx-.5,y1-.0,cz+.5),(cx+.5,y1-.0,cz+.5),(cx+.5,y1-.0,cz-.5))
        return True
    if k=='crate':
        n=max(1,round((y1-y0)/.75))
        for j in range(n):
            yy=y0+(y1-y0)*j/n; hh=(y1-y0)/n
            bx(m,'timber',x0,x1,yy,yy+hh-.01,z0,z1)
            box_edges(m,'grain',[(x0+x1)/2,yy+hh/2,(z0+z1)/2],[x1-x0-.04,hh-.04,z1-z0-.04],.05)
        return True
    if k=='roof':
        hiproof(m,'thatch',x0,x1,z0,z1,y0,y1)
        m.quad('grain',(x0,y0+.01,z0),(x1,y0+.01,z0),(x1,y0+.01,z1),(x0,y0+.01,z1))
        return True
    if k=='halfroof':
        # The west slope survives up to the ridge; the east slope fell in, leaving the
        # ridge beam and rafter stubs over the open half of the house.
        e=y0+.05
        m.quad('thatch',(x0,e,z1),(x0,e,z0),(x1-.25,y1-.12,z0),(x1-.25,y1-.12,z1))
        m.quad('thatchShade',(x0,e+.01,z0),(x0,e+.01,z1),(x1-.25,y1-.13,z1),(x1-.25,y1-.13,z0))
        for zz in (z0+.01,z1-.01):
            m.tri('thatchShade',(x0,e,zz),(x1-.25,y1-.12,zz),(x1-.25,e,zz))
        beam(m,'charred',(x1-.13,y1-.13,z0+.02),(x1-.13,y1-.13,z1-.02),.11,6)
        for t in range(6):
            zz=z0+.35+t*(z1-z0-.7)/5
            beam(m,'charred',(x0+.3,e+.18,zz),(x1-.13,y1-.2,zz),.06,4)
        return True
    if k=='rubble':
        cx,cz=(x0+x1)/2,(z0+z1)/2
        bx(m,'stoneShade',x0+.1,x1-.1,y0,y0+.3,z0+.1,z1-.1)
        for j,(dx,dz,r) in enumerate([(-.5,-.15,.36),(.3,.12,.42),(.6,-.2,.3),(-.2,.25,.3)]):
            m.blob('stone' if j%2 else 'stoneShade',(cx+dx,y0+.32,cz+dz),r,.75)
        for j in range(3):
            beam(m,'charred',(x0+.1,y0+.45+j*.06,z0+.2+j*.35),(x1-.1,y0+.5,z0+.3+j*.3),.08,5)
        return True
    if k=='altar':
        bx(m,'stoneShade',x0,x1,y0,y0+.2,z0,z1)
        bx(m,'stoneLight',x0+.08,x1-.08,y0+.2,y1-.1,z0+.08,z1-.08)
        bx(m,'stoneLight',x0,x1,y1-.1,y1,z0,z1)
        return True
    if k=='column':
        cx,cz=(x0+x1)/2,(z0+z1)/2
        bx(m,'stoneShade',x0,x1,y0,y0+.25,z0,z1)
        frustum(m,'stoneLight',(cx,y0+.25,cz),.29,.27,y1-y0-.35,8)
        frustum(m,'stone',(cx,y1-.1,cz),.28,.24,.1,8)
        return True
    if k=='mound':
        bx(m,'stoneShade',x0,x1,y0,y0+.35,z0,z1)
        bx(m,'stone',x0+.15,x1-.15,y0+.35,y1-.15,z0+.12,z1-.12)
        bx(m,'stoneLight',x0+.3,x1-.3,y1-.15,y1,z0+.25,z1-.25)
        for j,(dx,dz) in enumerate([(-1.2,-.85),(1.2,.85),(-1.25,.8),(1.2,-.8)]):
            m.blob('stoneShade',((x0+x1)/2+dx,y0+.4,dz),.22,.8)
        return True
    if k=='planks':
        along_x=a['axis']=='x'; L=(x1-x0) if along_x else (z1-z0); n=max(1,int(L/.28))
        for j in range(n):
            t=j*L/n
            if along_x: bx(m,'timber' if j%3 else 'grain',x0+t,x0+t+L/n-.015,y0,y1,z0,z1)
            else: bx(m,'timber' if j%3 else 'grain',x0,x1,y0,y1,z0+t,z0+t+L/n-.015)
        return True
    if k=='hay':
        n=max(1,round((y1-y0)/.9))
        for j in range(n):
            yy=y0+(y1-y0)*j/n; hh=(y1-y0)/n
            bx(m,'thatch',x0+.02,x1-.02,yy,yy+hh-.02,z0+.02,z1-.02)
            for t in (.3,.7):
                xx=x0+(x1-x0)*t
                bx(m,'leather',xx-.025,xx+.025,yy,yy+hh-.01,z0,z1)
        return True
    return False

# ---------------------------------------------------------------- decoration (per side)
GLOWS,POOLS,EMBERS,SMOKE=[],[],[],[]
def solid_top(x,z):
    best=0
    for o in c.objects:
        if not o['collision'] or o['type']!='box': continue
        (px,py,pz),(w,h,d)=o['position'],o['size']
        if abs(x-px)<=w/2 and abs(z-pz)<=d/2 and py+h/2<=2.7: best=max(best,py+h/2)
    return best
PROP_ART={}
def floor_flags(x0,x1,z0,z1,X,Z):
    D.quad('earth',(X(x0),.006,Z(z0)),(X(x0),.006,Z(z1)),(X(x1),.006,Z(z1)),(X(x1),.006,Z(z0)))
    zz=z0
    while zz<z1-.05:
        dz=min(rng.uniform(.6,1.1),z1-zz); xx=x0
        while xx<x1-.05:
            dx=min(rng.uniform(.5,1.2),x1-xx)
            if rng.random()>.06:
                col=rng.choice(('flag','flag','stoneShade','path'))
                D.quad(col,(X(xx+.03),.014,Z(zz+.03)),(X(xx+.03),.014,Z(zz+dz-.03)),(X(xx+dx-.03),.014,Z(zz+dz-.03)),(X(xx+dx-.03),.014,Z(zz+.03)))
            xx+=dx
        zz+=dz
def fire(x,z,s=1,y=None,ground=None,pool=3.2,legs=True,solid=False):
    y=solid_top(x,z) if y is None else y
    if solid:
        pid=f'brazier_{len(PROP_ART)}'
        c.box(pid,[x,round(y+.8*s-.01,3),z],[round(.8*s,3),round(1.6*s+.02,3),round(.8*s,3)],'iron','prop')
        PROP_ART[pid]=lambda m,x=x,y=y,z=z,s=s,legs=legs: brazier(m,x,y,z,s,legs)
        fx,fy,fz=brazier(Mesh(),x,y,z,s,legs)
    else: fx,fy,fz=brazier(D,x,y,z,s,legs)
    GLOWS.append([round(fx,3),round(fy+.1*s,3),round(fz,3),round(2.1*s,2),'#ffa34d',.8])
    EMBERS.append([round(fx,3),round(fy,3),round(fz,3),round(.35*s,2)])
    if pool: POOLS.append([round(x,3),round(solid_top(x,z) if ground is None else ground,3),round(z,3),pool,'#ff9b4a',.55])
def wall_torch(x,y,z,dx,dz):
    """Iron bracket torch on a wall face; (dx,dz) points away from the wall."""
    beam(D,'iron',(x,y,z),(x+dx*.32,y+.12,z+dz*.32),.025,4)
    fx,fy,fz=torch(D,x+dx*.34,y-.45,z+dz*.34,.8)
    GLOWS.append([r3(fx),r3(fy+.05),r3(fz),1.4,'#ffad5c',.9])
    POOLS.append([r3(x+dx*1.2),0,r3(z+dz*1.2),2.2,'#ff9b4a',.35])
def hang_lantern(x,y,z):
    beam(D,'iron',(x,y+.45,z),(x,y+.75,z),.012,3)
    lx,ly,lz=lantern(D,x,y,z,1.0)
    GLOWS.append([r3(lx),r3(ly),r3(lz),1.1,'#ffc77a',.25])
def shield(x,z,k):
    for i in range(10):
        t0,t1=math.tau*i/10,math.tau*(i+1)/10
        D.tri('shieldRed' if k%2==0 else 'cloth',(x,.11,z),(x+.42*math.cos(t1),.05+.03*math.sin(t1),z+.42*math.sin(t1)),(x+.42*math.cos(t0),.05+.03*math.sin(t0),z+.42*math.sin(t0)))
    D.blob('iron',(x,.12,z),.08,.5)
def spear(x,z,a):
    dx,dz=math.cos(a),math.sin(a)
    beam(D,'timber',(x,.04,z),(x+dx*1.5,.07,z+dz*1.5),.03,5)
    D.quad('iron',(x+dx*1.5-dz*.05,.07,z+dz*1.5+dx*.05),(x+dx*1.8,.08,z+dz*1.8),(x+dx*1.5+dz*.05,.07,z+dz*1.5-dx*.05),(x+dx*1.45,.07,z+dz*1.45))

for s in (1,-1):
    X=lambda x:s*x; Z=lambda z:s*z
    # Hall: flagstone floor, broken roof trusses high above, banners and torches on
    # the north wall, a hearth fire, and charred boards fallen from the roof.
    floor_flags(-19.4,-6.6,-22.9,-15.1,X,Z)
    for k,xx in enumerate((-18,-15,-12,-9)):
        if k==2: continue  # one truss fell in
        a,b,cc=(X(xx),5.25,Z(-23.2)),(X(xx),7.6,Z(-19)),(X(xx),5.25,Z(-14.8))
        beam(D,'timber',a,b,.16,6); beam(D,'timber' if k!=1 else 'charred',b,cc if k!=1 else (X(xx),6.2,Z(-17)),.16,6)
        beam(D,'grain',(X(xx),5.4,Z(-23)),(X(xx),5.4,Z(-15)),.12,6)
    beam(D,'charred',(X(-18),7.6,Z(-19)),(X(-13),7.45,Z(-19)),.17,6)
    beam(D,'charred',(X(-9),7.6,Z(-19)),(X(-11),7.1,Z(-19.3)),.15,6)
    for xx,col in ((-16.5,'cloth'),(-10.5,'shieldRed' if s<0 else 'cloth')):
        z0=Z(-22.85); dz=-s*.0
        D.quad(col,(X(xx-.7),4.7,Z(-22.88)),(X(xx+.7),4.7,Z(-22.88)),(X(xx+.6),2.6,Z(-22.88)),(X(xx-.6),2.9,Z(-22.88)))
        D.tri('gold',(X(xx-.3),4.3,Z(-22.86)),(X(xx+.3),4.3,Z(-22.86)),(X(xx),3.4,Z(-22.86)))
        beam(D,'gold',(X(xx-.8),4.72,Z(-22.84)),(X(xx+.8),4.72,Z(-22.84)),.04,5)
    for xx in (-19,-13.5,-7.6):
        wall_torch(X(xx),3.9,Z(-22.9),0,s)
    fire(X(-9.5),Z(-20.6),.95,ground=0,solid=True)
    for j in range(5):
        x=-11.5+j*.7; D.quad('charred',(X(x),.03,Z(-21.6+j*.1)),(X(x+.5),.03,Z(-21.5+j*.12)),(X(x+.6),.03,Z(-20.9)),(X(x+.1),.03,Z(-21)))
    wall_torch(X(-19.4),3.9,Z(-21.5),s,0)
    # Tower: ivy down the stub, a war banner on top, rubble at the foot of the slope.
    beam(D,'timber',(X(-2.6),7.4,Z(-13.6)),(X(-2.6),10,Z(-13.6)),.06,6)
    D.quad('cloth' if s>0 else 'shieldRed',(X(-2.6),9.9,Z(-13.6)),(X(-2.6+1.6),9.75,Z(-13.6)),(X(-2.6+1.4),8.4,Z(-13.6)),(X(-2.6),8.55,Z(-13.6)))
    D.quad('cloth' if s>0 else 'shieldRed',(X(-2.6),8.55,Z(-13.6)),(X(-2.6+1.4),8.4,Z(-13.6)),(X(-2.6+1.6),9.75,Z(-13.6)),(X(-2.6),9.9,Z(-13.6)))
    for j in range(9):
        D.blob('moss' if j%2 else 'leaf',(X(-3.22),3.0+j*.45,Z(-13.6+(j%3)*.25)),.16+.04*(j%2),.4)
    for j in range(10):
        x=-2.4+rng.uniform(0,2.8); z=-5.4+rng.uniform(-.5,.9)
        D.blob('stoneShade' if j%3 else 'stone',(X(x),.05,Z(z)),rng.uniform(.12,.25),.5)
    fx,fy,fz=torch(D,X(-2.3),7.4,Z(-13.3),.9); GLOWS.append([r3(fx),r3(fy+.05),r3(fz),1.5,'#ffad5c',.9])
    # Market: goods on the counter (low), lantern at the front, scattered baskets.
    for j,(dx,col) in enumerate([(-.9,'shieldRed'),(-.2,'leafLight'),(.6,'flower')]):
        D.prism('grain',(X(-6+dx),1,Z(3.5)),.26,.14,n=8)
        for q in range(4): D.blob(col,(X(-6+dx+(q%2-.5)*.18),1.17,Z(3.5+(q//2-.5)*.16)),.07,1)
    hang_lantern(X(-6),2.05,Z(2.75))
    for j,(x,z) in enumerate([(-4.2,4.6),(-8,2.6),(-3.6,-5.6)]):
        D.prism('grain',(X(x),0,Z(z)),.22,.3,n=8)
    # Burned house: soot, a fallen roof beam on the ground, the hearth embers.
    for j in range(4): beam(D,'charred',(X(-17+j*1),.06,Z(-9.2+j*.6)),(X(-15.5+j*.8),.08,Z(-7.9+j*.4)),.07,5)
    EMBERS.append([X(-13.1),.3,Z(-8.8),.5]); POOLS.append([X(-13.1),0,Z(-8.6),1.8,'#ff8a3a',.45])
    SMOKE.append([X(-13.1),4.8,Z(-9.8),.25,'#6e655d'])
    # Cottage interiors: lanterns under the roofs (intact houses are dark inside).
    hang_lantern(X(-19.5),1.95,Z(8)); hang_lantern(X(-18),1.95,Z(17.5)); hang_lantern(X(-12.8),1.95,Z(10))
    hang_lantern(X(-9),1.95,Z(19))
    # Chapel: candles on the altar, a bell gable over the door, a fallen bell.
    for j in range(3):
        cx=-3+j*.5
        beam(D,'flower',(X(cx),1,Z(22.5)),(X(cx),1.18,Z(22.5)),.03,5)
        cone(D,'flameCore',(X(cx),1.18,Z(22.5)),.025,.07,4)
        GLOWS.append([X(cx),1.24,Z(22.5),.45,'#ffd38a',.6])
    POOLS.append([X(-2.5),0,Z(21.5),2.6,'#ffc070',.4])
    for xx in (-3.0,-2.0): D.cbox('stone',[X(xx),5.1,Z(16.3)],[.32,1.0,.5])
    D.cbox('stoneShade',[X(-2.5),5.7,Z(16.3)],[2.2,.25,.55])
    floor_flags(-4.4,-.6,16.6,23,X,Z)
    # Glass lancet over the altar and the stumps of the fallen vault ribs.
    for k,(cx,col) in enumerate([(-3.1,'cloth'),(-2.5,'gold'),(-1.9,'shieldRed')]):
        D.quad(col,(X(cx-.26),2.0,Z(22.98)),(X(cx+.26),2.0,Z(22.98)),(X(cx+.26),3.1+(k==1)*.3,Z(22.98)),(X(cx-.26),3.1+(k==1)*.3,Z(22.98)))
        D.tri(col,(X(cx-.26),3.1+(k==1)*.3,Z(22.98)),(X(cx+.26),3.1+(k==1)*.3,Z(22.98)),(X(cx),3.45+(k==1)*.3,Z(22.98)))
    GLOWS.append([X(-2.5),2.8,Z(22.8),1.6,'#ffd9a0',.1])
    for zz,full in ((17.4,False),(19.3,True),(21.2,True),(22.7,False)):
        beam(D,'stoneLight',(X(-4.4),3.3,Z(zz)),(X(-2.5),5.0,Z(zz)),.13,5)
        if full: beam(D,'stoneLight',(X(-2.5),5.0,Z(zz)),(X(-.6),3.2,Z(zz)),.13,5)
    # Barn: loose hay on the floor, a lantern on the front post.
    for j in range(14):
        x=-28.3+rng.uniform(0,4); z=14.3+rng.uniform(0,5.4)
        D.tri('thatch',(X(x),.02,Z(z)),(X(x+.4),.02,Z(z+.1)),(X(x+.15),.02,Z(z+.35)))
    hang_lantern(X(-25),2.1,Z(17))
    # Spawn court: a rally fire and the team banner on the gate wall.
    fire(X(-26),Z(-13),.95,ground=0,solid=True)
    top=3.6
    beam(D,'timber',(X(-24),top-.3,Z(-12)),(X(-24),top+3,Z(-12)),.05,6)
    D.quad('cloth' if s>0 else 'shieldRed',(X(-24),top+2.9,Z(-12)),(X(-24),top+2.9,Z(-12)-s*1.4),(X(-24),top+1.4,Z(-12)-s*1.25),(X(-24),top+1.55,Z(-12)))
    D.quad('cloth' if s>0 else 'shieldRed',(X(-24),top+1.55,Z(-12)),(X(-24),top+1.4,Z(-12)-s*1.25),(X(-24),top+2.9,Z(-12)-s*1.4),(X(-24),top+2.9,Z(-12)))
    for zz in (-3,-11):
        wall_torch(X(-24.45),2.9,Z(zz),-s,0)
    # Square: flanking fire bowls by the sword stone, a lantern post by the well.
    fire(X(-2.6),Z(-1.9),.8,ground=0,pool=2.8,solid=True)
    # War debris along the lanes (all flat, below knee height).
    for k,(x,z) in enumerate([(-11,-12.2),(-3,-7.4),(-15,4.8),(-24,5),(-12,6.2),(-5.5,13.4),(-26,-17),(-9,-1.6)]):
        if k%2==0: shield(X(x),Z(z),k)
        spear(X(x+.5),Z(z+.3),rng.uniform(0,math.tau))
        for j in range(3):
            ax,az=x+rng.uniform(-1.4,1.4),z+rng.uniform(-1,1); lean=rng.uniform(-.12,.12)
            beam(D,'timber',(X(ax),0,Z(az)),(X(ax+lean),.3,Z(az+lean*.5)),.012,3)
    # Rubble at wall feet and grass along the bank.
    for o in list(c.objects):
        if o.get('batch')!='town' or o['material'] not in ('stone','plaster') or o['id'][-2:]!=('_w' if s>0 else '_e'): continue
        if ART.get(o['id'],{}).get('kind')!='wall' or o['size'][1]<2: continue
        (x,y,z),(w,h,d)=o['position'],o['size']
        for j in range(2):
            along=w>d; t=rng.uniform(-.4,.4)
            side=rng.choice((-1,1))
            px=x+(t*w if along else side*(w/2+.18)); pz=z+(side*(d/2+.18) if along else t*d)
            D.blob('stoneShade' if j else 'stone',(px,.04,pz),rng.uniform(.1,.18),.55)
            D.tri('moss',(px-.06,.01,pz),(px+.06,.01,pz),(px+.03,rng.uniform(.18,.3),pz+.03))
# The sword in the stone, on its mound in the middle of the square.
sx,sz,sy=0,0,1.2
for sign in (-1,1):
    D.quad('iron',(sx,sy,sz+sign*.09),(sx+.2,sy+.5,sz),(sx+.2,sy+1.9,sz),(sx,sy+1.97,sz+sign*.09))
    D.quad('stoneLight',(sx,sy,sz+sign*.09),(sx,sy+1.97,sz+sign*.09),(sx-.2,sy+1.9,sz),(sx-.2,sy+.5,sz))
beam(D,'gold',(sx-.65,sy+1.99,sz),(sx+.65,sy+1.99,sz),.085,7)
beam(D,'cloth',(sx,sy+2.02,sz),(sx,sy+2.64,sz),.095,8)
for yy in (.1,.24,.38,.52): D.prism('gold',(sx,0,sz),.103,.03,n=8,y0=sy+2.0+yy)
D.blob('gold',(sx,sy+2.78,sz),.18,.8)
GLOWS.append([0,sy+2.2,0,1.2,'#ffe2a0',.15])
# Torches along the palisade crest frame the arena edge.
for zz in (-18,-6,6,18):
    for xx in (-32,32):
        fx,fy,fz=torch(D,xx,4.2,zz,1.1); GLOWS.append([fx,round(fy+.05,3),fz,1.5,'#ffad5c',.9])
for xx in (-24,-12,0,12,24):
    for zz in (-24,24):
        fx,fy,fz=torch(D,xx,4.2,zz,1.1); GLOWS.append([fx,round(fy+.05,3),fz,1.5,'#ffad5c',.9])
for x in range(-30,31,4):
    for z in (-23.42,23.42):
        for j in range(3):
            xx=x+j*.22
            D.tri('moss',(xx-.1,2.78,z),(xx+.1,2.78,z),(xx+.06,3.2,z+.1))
# Ash rings under ground fires.
for gx,gy,gz,rad,_,_ in POOLS:
    if gy==0 and rad>2.5: D.blob('ash',(gx,-.06,gz),rad*.25,.06)

# ---------------------------------------------------------------- beyond the banks
# Irregular silhouette beyond the playing boundary: turf mounds and wind-bent trees.
for i in range(25):
    a=math.tau*i/25+rng.uniform(-.05,.05); x=math.cos(a)*rng.uniform(35,40); z=math.sin(a)*rng.uniform(28,32)
    r=rng.uniform(2,5); y=rng.uniform(-.7,.3); sq=rng.uniform(.3,.55)
    while abs(x)-r<33 and abs(z)-r<25: x*=1.04; z*=1.04
    D.blob('moss' if i%4 else 'earth',(x,y,z),r,sq)
for n,(x,z,scale) in enumerate([(-40,-19,1.25),(42,-13,1.1),(-35,31,1.1),(25,35,.9),(-17,-35,1.05),(22,-35,1.2),(47,22,.8),(-49,6,1.4)]):
    beam(D,'bark',(x,-.4,z),(x+1.5*scale,7.5*scale,z),.33*scale,9)
    for j in range(5):
        a=j*1.9+n*.7; dx,dz=math.cos(a)*2.8*scale,math.sin(a)*2.2*scale
        tip=(x+1.5*scale+dx,(6.5+(j%3)*.65)*scale,z+dz)
        beam(D,'bark',(x+.9*scale,4.6*scale,z),tip,.13*scale,6)
        for k in range(3):
            D.blob('leaf' if (j+k+n)%3 else 'leafLight',(tip[0]+(k-1)*.95*scale,tip[1]+.7*scale,tip[2]+((k+n)%2-.5)*1.2*scale),(1.55+.23*(k%2))*scale,.64)
def terrain_height(x,z):
    edge=max(abs(x)-32,abs(z)-24)
    return -.3+min(max(edge,0)/20,1)*(4+2.6*math.sin(x*.065+z*.026)+2*math.cos(z*.072-x*.025))
for x in range(-120,120,8):
    for z in range(-112,96,8):
        if -40<x<32 and -32<z<24: continue
        a=(x,terrain_height(x,z),z); b=(x+8,terrain_height(x+8,z),z)
        cc=(x+8,terrain_height(x+8,z+8),z+8); d=(x,terrain_height(x,z+8),z+8)
        D.quad('hill',a,b,cc,d)
for layer,(radius,height,color) in enumerate([(112,13,'hill'),(155,23,'distant'),(205,31,'distantFar')]):
    for i in range(72):
        a,b=math.tau*i/72,math.tau*(i+1)/72
        h=lambda t:height+3*math.sin(3*t+layer)+2.5*math.cos(5*t-layer)
        ax,az=math.cos(a)*radius,math.sin(a)*radius
        bx_,bz=math.cos(b)*radius,math.sin(b)*radius
        D.quad(color,(ax,-8,az),(bx_,-8,bz),(bx_,h(b),bz),(ax,h(a),az))
# The rest of the town burns beyond the banks: roofless house shells and smoke.
for k,(x,z,w,d,h) in enumerate([(-38,-8,6,4,3.2),(-37,12,5,5,2.6),(39,9,6,4,3.4),(38,-14,5,5,2.4),(-14,-30,6,4,3),(12,30,6,4,3),(20,-31,5,4,2.6),(-22,31,5,4,2.8)]):
    y=terrain_height(x,z)-.2
    for (ax,az,bw,bd) in ((x,z-d/2,w,.5),(x,z+d/2,w,.5),(x-w/2,z,.5,d),(x+w/2,z,.5,d)):
        hh=h-(k%3)*.6
        D.cbox('stoneShade' if k%2 else 'plaster',[ax,y+hh/2,az],[bw,hh,bd])
    if k%2==0:
        hiproof(D,'charred',x-w/2,x+w/2,z-d/2,z+d/2,y+h,y+h+1.4)
    else:
        GLOWS.append([x,y+1.5,z,4,'#ff8a3a',.7]); EMBERS.append([x,y+1,z,1.2]); SMOKE.append([x,y+3,z,.6,'#6e655d'])
# The army camps (west and east), a ring of standing stones and Camelot.
for side in (-1,1):
    for k,(dx,z,w) in enumerate([(10,-4,3.6),(12,15,3.8),(15,-11,3.4),(16,3,4.2)]):
        x=side*(32+dx); y=terrain_height(x,z)-.15
        tent(D,x,y,z,w,2.8,2.1,'canvas' if k%3 else 'cloth','canvasShade')
    for k,(dx,z) in enumerate([(13,-7),(10,11)]):
        x=side*(32+dx); y=terrain_height(x,z)
        fx,fy,fz=brazier(D,x,y,z,1.3,legs=False)
        GLOWS.append([round(fx,2),round(fy+.2,2),round(fz,2),3.2,'#ff9c45',.8]); EMBERS.append([round(fx,2),round(fy,2),round(fz,2),.5])
        SMOKE.append([round(fx,2),round(fy+1,2),round(fz,2),.35,'#7d746c'])
    for k,z in enumerate((-20,-9,2,13)):
        x=side*(36+k%2*5); y=terrain_height(x,z)
        flag(D,'cloth' if side<0 else 'shieldRed',(x,y+4.2,z),side,1.1)
for i in range(11):
    a=math.tau*i/11; x=58+math.cos(a)*9; z=34+math.sin(a)*7; y=terrain_height(x,z)
    h=2.4+(i*7%5)*.35
    D.cbox('stoneShade' if i%3 else 'stone',[x,y+h/2-.2,z],[1.1,h,.7])
    if i%4==0: D.cbox('stone',[x+.6,y+h+.15,z],[2.4,.45,.75])
CX,CZ=-30,-150; base=10
def tower(x,z,r,h,roof=True,n=8):
    frustum(D,'castle',(x,base-6,z),r*1.08,r,h+6,n)
    for i in range(n):
        a=math.tau*(i+.5)/n
        D.cbox('castleShade',[x+math.cos(a)*r*.95,base+h+.35,z+math.sin(a)*r*.95],[r*.5,.7,r*.5])
    if roof: cone(D,'castleRoof',(x,base+h+.6,z),r*1.15,r*2.4,n)
    for k in range(3):
        a=k*2.1+x
        D.cbox('windowGlow',[x+math.cos(a)*r*1.01,base+h*(.45+.15*k),z+math.sin(a)*r*1.01],[.5,1.1,.5])
D.cbox('castleShade',[CX,base+2,CZ],[46,16,10])
for i in range(12): D.cbox('castle',[CX-22+i*4,base+10.6,CZ+5],[2,1.4,1])
for x,z,r,h in [(-23,4,3,18),(23,4,3,18),(-12,-3,2.4,22),(12,-3,2.4,22),(0,-6,4,30),(-6,6,1.8,14),(6,6,1.8,14)]:
    tower(CX+x,CZ+z,r,h)
cone(D,'gold',(CX,base+30+.6+4*2.4,CZ-6),.25,3,4)
for k in range(8):
    x=CX-18+k*5; D.cbox('windowGlow',[x,base+4+(k%3)*2.5,CZ+5.05],[.6,1.2,.1])
GLOWS.extend([[CX,base+25,CZ-1,9,'#ffc477',0],[CX-12,base+16,CZ+1,6,'#ffc477',0],[CX+12,base+16,CZ+1,6,'#ffc477',0]])
SMOKE.extend([[-70,2,-60,1.4,'#857b72'],[75,3,-25,1.6,'#857b72'],[40,4,-85,1.8,'#8a8079'],[-85,2,40,1.5,'#857b72']])
for x,y,z in [(-70,2,-60),(75,3,-25),(40,4,-85),(-85,2,40)]:
    GLOWS.append([x,y+1,z,5,'#ff8a3a',.6])

c.data['presentation'].update(glows=GLOWS,pools=POOLS,embers=EMBERS,smoke=SMOKE,
    field=dict(kind='pollen',count=140,color='#ffe2a6',size=.05,min=[-30,.4,-22],max=[30,6,22]))
c.data['designNotes']=['Early-medieval-inspired fictional ruined town, not a dated reconstruction.',
    'Point-symmetric: each side has a two-storey roofless hall, a watch tower on a rubble slope, cottage lanes, a chapel and a barn.',
    'Close quarters in the lanes and hall, mid range across the market square; the towers are the only high ground.',
    'Town walls are batched per material into BATCH_town; chapterkit checks each piece stays inside its collider before merging.']
c.save(render_object=crafted)
