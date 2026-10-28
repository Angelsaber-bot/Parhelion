"""CAM LANN: fictional early-medieval-inspired low ruins, turf and timber.
Editable Python/mesh-kit source, not an archaeological reconstruction.
"""
from pathlib import Path
import sys, math, random
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT.parent/'_lib'))
from glbkit import Mesh
from chapterkit import Chapter, mat, beam, ring, flag, mountain, box_edges, bevelbox, cone, frustum, brazier, torch, tent
from surfaces import build as build_surfaces, ground_atlas
P=dict(turf=mat('#9caf78'), moss=mat('#6f8d5e'), earth=mat('#947a59'), path=mat('#c5af87'),
    stone=mat('#bdc6b9'), stoneShade=mat('#9aaba5'), stoneLight=mat('#d1d3bd'), timber=mat('#a37f50'),
    grain=mat('#555043'), cloth=mat('#425f88'), gold=mat('#d5b36c',.65,.45), iron=mat('#68767b',.65,.58),
    heather=mat('#b9a8c1'), distant=mat('#9baeb8'), thatch=mat('#bca46b'), thatchShade=mat('#8f8159'),
    leaf=mat('#92aa68'), leafLight=mat('#b9be78'), bark=mat('#645947'), flower=mat('#e6cf98'), hill=mat('#91a68e'), distantFar=mat('#bac5cb'), battlefield=mat('#ffffff'),
    flame=mat('#ff9a3c',0,1,3.2), flameCore=mat('#ffe6a0',0,1,4.5), coal=mat('#c2461e',0,.9,1.6), ash=mat('#4c4640'),
    leather=mat('#6e4c33'), shieldRed=mat('#8e3a30'), canvas=mat('#d9c9a3'), canvasShade=mat('#ad9a77'),
    castle=mat('#a9a6a4'), castleShade=mat('#8a8c93'), castleRoof=mat('#5d6c86'), windowGlow=mat('#ffc477',0,1,2.4))
c=Chapter(ROOT,'camlann','CAM LANN 誓约荒原',64,48,'oathfield',P); D=c.detail; rng=random.Random(917)
surfaces=build_surfaces(ROOT/'assets/materials')
c.textures={name:dict(surfaces[family],scale=scale) for name,family,scale in [
    ('stone','fieldstone',.75),('stoneShade','fieldstone',.75),('stoneLight','fieldstone',.75),
    ('timber','oak',.7),('grain','oak',.7),('bark','oak',.5),('thatch','oak',1.2),('thatchShade','oak',1.2),
    ('turf','turf',.45),('moss','turf',.45),('hill','turf',.16),('earth','earth',.65),('path','earth',.8),
    ('cloth','linen',1.1),('iron','iron',.8)]}
TRACKS=[([(-29,-3),(-17,-1),(-13,9),(-15,20),(19,21),(27,21)],2.1),([(-18,-9),(0,-6),(0,9),(18,10)],1.6)]
ground_atlas(ROOT/'assets/materials/battlefield_ground.png',TRACKS)
c.textures['battlefield']=dict(baseColor=ROOT/'assets/materials/battlefield_ground.png',scale=1)
c.box('battlefield_floor',[0,-.4,0],[64,.8,48],'turf','floor')
# Boundaries read as low earth/stone banks, not four complete castle facades.
for x in (-32,32): c.box('earthbank_x_'+str(x),[x,1.4,0],[1,2.8,48],'earth','structure')
for z in (-24,24): c.box('earthbank_z_'+str(z),[0,1.4,z],[64,2.8,1],'earth','structure')
# Timber breastwork sits on the actual bank crest, not inside a fighting lane.
for x in (-32,32): c.box('crest_palisade_x_'+str(x),[x,3.5,0],[.5,1.4,48],'timber','structure')
for z in (-24,24): c.box('crest_palisade_z_'+str(z),[0,3.5,z],[64,1.4,.5],'timber','structure')
for side in (-1,1):
    # The visible inner earth slopes are real ramp collision, leaving the route loop flat.
    c.ramp('turf_berm_x_'+str(side),[side*30.5,0,0],[2,2.8,46],'x',-side,'turf')
    c.ramp('turf_berm_z_'+str(side),[0,0,side*22.5],[61,2.8,2],'z',-side,'turf')
for side,team in [(-1,'west'),(1,'east')]:
    c.box('spawn_broken_wall_'+team,[side*24,1.8,side*12],[.9,3.6,13],'stone','structure')
    for i,z in enumerate((side*11,side*15)):
        c.anchor(f'spawn_{team}_{i}','spawn',[side*28,0,z],yaw=-side*1.5708,team=team)
    c.anchor('cover_spawn_'+team,'cover',[side*26,0,side*12],height=3.6)
    c.box('spawn_cloth_'+team,[side*30,.02,side*12],[1.3,.04,3.5],'cloth' if side<0 else 'gold','wayfinding',False)
# Three offset terrain/ruin islands make a loose figure eight, not a symmetric palace.
# North: a raised foundation, approachable from BOTH ends by broad ordinary ramps.
c.box('hall_foundation',[0,.6,-15],[18,1.2,9],'earth','floor')
for side in (-1,1): c.ramp('foundation_ramp_'+str(side),[side*12,0,-15],[6,1.2,5],'x',side,'path')
for x,w,h in [(-6,6,1.5),(4.5,3,2.2)]: c.box('hall_backwall_'+str(x),[x,1.2+h/2,-19],[w,h,1],'stone')
c.box('hall_west_stump',[-8.5,2.2,-17.6],[1,2,3.3],'stone')
c.box('hall_east_stump',[8.5,1.95,-12.5],[1,1.5,3],'stone')
for x in (-6,4):
    # Exposed front timber supports are solid too; roof ribs remain above standing clearance.
    c.box('hall_frame_post_'+str(x),[x,3.05,-11.5],[.34,3.7,.34],'timber','structure')
c.anchor('objective_hall','objective',[0,1.2,-15],radius=2)
# Central breach: long low ruin segments rather than a solid indoor hall.
c.box('ruin_west_wall',[-6.5,1.1,1],[9,2.2,1.2],'stone')
c.box('ruin_west_return',[-10.5,.8,4],[1,1.6,5],'stoneShade')
c.box('ruin_east_wall',[7.5,1.35,5],[8,2.7,1.2],'stone')
c.box('ruin_east_return',[11,1,2],[1,2,5],'stoneShade')
# Southern earthwork is low and broken, while its broad front stays open.
c.box('southern_bank',[-4,.7,15],[12,1.4,4],'earth')
c.box('palisade_stump',[3,1.2,17],[1.1,2.4,7],'timber')
c.box('fallen_cart',[17,.75,-4],[3.6,1.5,2.4],'timber')
c.box('rubble_west',[-18,.7,-4],[3.5,1.4,2.5],'stoneShade')
# Three deliberate fighting islands, outside the existing broad route network.
# An abandoned baggage breastwork on the western flank, a collapsed hall beam
# beside the central breach, and a dry-stone outwork on the open southern field.
c.box('baggage_breastwork',[-21, .95,9],[4.5,1.9,2.2],'timber')
c.box('baggage_return',[-22.5,.7,11],[1.5,1.4,1.8],'timber')
c.box('fallen_hall_beams',[7.5,.85,-2.7],[4,1.7,2],'timber')
c.box('south_outwork',[15,.85,15],[5,1.7,1.2],'stone')
c.box('south_outwork_return',[17,1.1,16.5],[1,2.2,3],'stoneShade')
for name,pos,h in [('baggage',[-21,0,6.7],1.9),('fallen_beams',[7.5,0,-.6],1.7),('outwork',[14,0,12.7],1.7)]:
    c.anchor('cover_'+name,'cover',pos,height=h)
for name,p,h in [('west_wall',[-6.5,0,-.4],2.2),('east_wall',[7.5,0,6.5],2.7),('earthwork',[-4,0,11.7],1.4),('cart',[17,0,-1.8],1.5),('hall',[4,1.2,-17],2.2)]:
    c.anchor('cover_'+name,'cover',p,height=h)
c.anchor('objective_breach','objective',[0,0,4],radius=2)
c.route('north_foundation',[[-28,0,-11],[-28,0,-21],[-20,0,-21],[-17,0,-15],[-8,1.2,-15],[8,1.2,-15],[17,0,-15],[21,0,-12],[21,0,3],[28,0,3],[28,0,11]])
c.route('south_flank',[[-28,0,-11],[-28,0,-3],[-20,0,-1],[-15,0,10],[-15,0,20],[0,0,21],[20,0,21],[28,0,21],[28,0,15]])
c.route('central_breach',[[-20,0,-1],[-22,0,-1],[-22,0,-7],[-15,0,-7],[0,0,-6],[0,0,3],[0,0,9],[16,0,10],[20,0,3]])
c.route('figure_eight',[[-15,0,-7],[-15,0,9],[-13,0,10],[0,0,9],[0,0,3],[0,0,-6],[14,0,-8],[21,0,-8],[21,0,10],[16,0,10],[13,0,9]])
# Uneven broken-wall crowns are actual solid segments, not tall invisible boxes under chipped art.
shaped=[]
for o in c.objects:
    w,h,d=o['size']; x,y,z=o['position']; along=w>d; span=w if along else d
    if o['type']=='box' and o['material'] in ('stone','stoneShade') and span>=5 and not o['id'].startswith('south_outwork'):
        count=round(span/1.35)
        for i in range(count):
            sh=h-[.02,.24,.09,.41,.17,.3][(i+len(o['id']))%6]
            p=[x+(i+.5)*span/count-span/2,y-h/2+sh/2,z] if along else [x,y-h/2+sh/2,z+(i+.5)*span/count-span/2]
            s=[span/count,sh,d] if along else [w,sh,span/count]
            shaped.append(dict(o,id=o['id']+'_fragment_'+str(i),position=p,size=s))
    else: shaped.append(o)
c.objects=shaped
# Worn tracks are painted into battlefield_ground.png on the one continuous floor.
# No raised path sheets or grass-stain polygons remain.
# Sparse moss lives at cracks rather than a repeating tuft on every wall module.
for o in c.objects:
    if o['type']!='box' or o['material'] not in ('stone','stoneShade'): continue
    x,y,z=o['position']; w,h,d=o['size']; along_x=w>d; span=w if along_x else d
    cols=max(1,int(span/.9))
    # Uneven crowns only a few centimetres beyond cover; no invisible high wall shapes.
    for j in range(cols):
        t=-span/2+(j+.5)*span/cols
        p=[x+t,y+h/2+.035,z] if along_x else [x,y+h/2+.035,z+t]
        if (j+sum(ord(v) for v in o['id']))%5==0: D.blob('moss',p,.18+.06*(j%3),.12)
# Exposed timber hall ribs (not Gothic): one low ridge, two incomplete frames above clear headroom.
for x in (-6,4):
    beam(D,'timber',(x,1.2,-18.5),(x,4.9,-18.5),.16,7)
    beam(D,'timber',(x,1.2,-11.5),(x,4.9,-11.5),.16,7)
    beam(D,'timber',(x,4.9,-18.5),(x,6.3,-15),.18,7)
    beam(D,'timber',(x,6.3,-15),(x,4.9,-11.5),.18,7)
beam(D,'timber',(-7.6,6.3,-15),(5,6.3,-15),.2,7)
for x in (-6,4):
    for z in (-18.5,-11.5):
        # Mortise collars, oak pegs and diagonal knee braces add readable joinery.
        D.cbox('grain',[x,4.55,z],[.39,.13,.39])
        beam(D,'timber',(x,3.85,z),(x,4.9,z+(1 if z<-15 else -1)),.09,6)
        D.blob('gold',(x-.18,4.5,z),.055)
# The ruined hall is the hero silhouette: a torn thatch roof at one end, a broken
# ridge and readable exposed ribs elsewhere. All overhead geometry clears players.
for x in (-8.4,-4.2,0,7.7):
    for z in (-18.7,-11.3):
        # Front frame ends stay above the existing floor; supporting posts remain at
        # the original colliding x=-6/4 positions, the extra ribs attach overhead.
        beam(D,'timber',(x,4.85,z),(x,6.45,-15),.12,6)
beam(D,'timber',(-8.8,6.45,-15),(-2.8,6.45,-15),.2,7)
beam(D,'timber',(2.4,6.45,-15),(8.4,6.45,-15),.2,7)
beam(D,'grain',(-2.8,6.45,-15),(-.3,5.8,-14.7),.16,6)
beam(D,'timber',(2.4,6.45,-15),(1.2,6.1,-15.15),.14,6)
for a,b in [((-.3,5.8,-14.7),(.3,5.65,-14.66)),((1.2,6.1,-15.15),(.6,5.85,-15.2))]:
    beam(D,'thatchShade',a,b,.035,4)
for side in (-1,1):
    z= -15+side*4.05
    # Thick remaining roof masses at two ends; the broken inner edge changes at
    # each roof course. Central hole, snapped ridge and exposed ribs stay legible.
    for end in (-1,1):
        outer=end*9.1
        inner=[end*v for v in ([4.6,3.9,4.5,3.3,3.6] if side<0 else [4.2,4.8,3.8,4.3,3.5])]
        for j in range(4):
            a,b=j/4,(j+1)/4
            ya,yb=4.9+1.7*a,4.9+1.7*b; za,zb=z*(1-a)-15*a,z*(1-b)-15*b
            p=[(outer,ya,za),(inner[j],ya,za),(inner[j+1],yb,zb),(outer,yb,zb)]
            D.quad('thatch',*p)
            q=[(x,y-.28,z_) for x,y,z_ in p]
            D.quad('thatchShade',q[3],q[2],q[1],q[0])
            D.quad('thatchShade',p[1],q[1],q[2],p[2])
            D.quad('thatchShade',p[0],p[3],q[3],q[0])
            if j==0: D.quad('thatchShade',p[0],q[0],q[1],p[1])
            if j==3: D.quad('thatchShade',p[2],q[2],q[3],p[3])
        for k in range(18):
            xx=outer+(end*4.85-outer)*(k+.5)/18
            D.quad('thatchShade',(xx-.015,4.91,z),(xx+.015,4.91,z),(xx+.05,6.61,-15),(xx+.02,6.61,-15))
        # Frayed straw ends vary in length along the eave, never down at head height.
        for k in range(10):
            xx=outer+(inner[0]-outer)*(k+.5)/10
            D.tri('thatch',(xx-.1,4.9,z),(xx+.1,4.9,z),(xx+.04,4.53+(k%3)*.06,z+side*.08))
    # Laths and broken pegs carry the missing end of the roof.
    for t in (.3,.66):
        zz=z*(1-t)-15*t; yy=4.9*(1-t)+6.5*t
        beam(D,'grain',(-2.9,yy,zz),(1.2-(.8 if t<.5 else 0),yy-.1,zz),.065,5)
# Surviving carved bargeboard, gold/blue hanging oath cloth, scorched floorboards.
beam(D,'grain',(-9,4.85,-19.15),(-9,6.67,-15),.14,6)
beam(D,'grain',(-9,6.67,-15),(-9,4.85,-10.85),.14,6)
for x in (-8,-7,-6,-5,-4):
    D.cbox('grain',[x,1.213,-15],[.85,.024,7.8])
for x in (-6,4):
    D.quad('cloth',(x-.55,4.55,-11.48),(x+.55,4.55,-11.48),(x+.45,2.8,-11.45),(x-.4,3.05,-11.45))
    D.tri('gold',(x-.25,4.2,-11.43),(x+.25,4.2,-11.43),(x,3.5,-11.41))
# High central oath cloth is the colour focal point; lower edge clears standing heads.
D.quad('cloth',(-1.3,5.9,-16.2),(1.3,5.9,-16.2),(1.05,3.45,-16.05),(-1.15,3.7,-16.05))
D.tri('cloth',(-1.15,3.7,-16.05),(-.6,3.35,-16),(0,3.6,-16.05))
D.tri('gold',(-.65,5.35,-16.12),(.65,5.35,-16.12),(0,4.1,-15.98))
D.tri('cloth',(-.3,5.15,-16.1),(.3,5.15,-16.1),(0,4.55,-15.95))
beam(D,'gold',(-1.4,5.92,-16.2),(1.4,5.92,-16.2),.055,5)
# One unmistakable sword-in-stone landmark, in an existing cover footprint. Broad
# bevelled blade facets catch the key light; no repeated magic runes or neon effect.
sx,sz=-18,-4
for sign in (-1,1):
    D.quad('iron',(sx,1.15,sz+sign*.09),(sx+.2,1.65,sz),(sx+.2,3.05,sz),(sx,3.12,sz+sign*.09))
    D.quad('stoneLight',(sx,1.15,sz+sign*.09),(sx,3.12,sz+sign*.09),(sx-.2,3.05,sz),(sx-.2,1.65,sz))
beam(D,'gold',(sx-.65,3.14,sz),(sx+.65,3.14,sz),.085,7)
beam(D,'cloth',(sx,3.17,sz),(sx,3.79,sz),.095,8)
for yy in (3.25,3.39,3.53,3.67): D.prism('gold',(sx,0,sz),.103,.03,n=8,y0=yy)
D.blob('gold',(sx,3.93,sz),.18,.8)
# The blade stands on the reachable rubble mound: give it a slim real collider.
c.box('sword_in_stone',[sx,(1.15+4.1)/2,sz],[.46,2.95,.3],'iron','prop')
# Broken lintel above the middle breach and one quiet cloth landmark, no glowing-rune noise.
# One fractured fallen lintel lies on an existing low earthwork rather than blocking a route.
bevelbox(D,'stoneShade',[-5,1.52,15],[3.1,.24,.9],.13)
beam(D,'timber',(3,2.1,17),(3,5.5,17),.07,7)
D.quad('cloth',(3,5.3,17),(1.2,5.1,17.2),(1.4,4.35,17.3),(3,4,17))
D.tri('cloth',(1.2,5.1,17.2),(.9,4.7,17.3),(1.4,4.35,17.3))
D.tri('gold',(2.8,5.1,17.02),(2.55,4.3,17.08),(2.3,5.05,17.1))
for z in (14,15.3,16.6,18,19.4):
    h=2.2+(int(z*7)%3)*.15
    D.prism('timber',(3,0,z),.48,h,n=5)
    D.tri('grain',(2.7,h,z-.3),(3.3,h,z+.3),(3.1,h+.2,z))
# Low scattered rubble remains tightly clustered at existing cover, not across traversable lanes.
for cx,cz in [(-11,4),(12,5),(-6,16),(6,-20)]:
    for i in range(7):
        x=cx+rng.uniform(-.65,.65); z=cz+rng.uniform(-.65,.65)
        D.blob('stoneShade',(x,.1,z),rng.uniform(.15,.35),.45)
# Visible plank hardware on fallen cart, wheels within its authoritative cover footprint.
cart=next(o for o in c.objects if o['id']=='fallen_cart'); box_edges(D,'iron',cart['position'],cart['size'],.05)
for x in (15.8,18.2): beam(D,'grain',(x,.6,-5.1),(x,.6,-2.9),.5,10)
# Irregular silhouette beyond the safe playing boundary: turf banks, occasional timber and wind-bent trees.
for i in range(25):
    a=math.tau*i/25+rng.uniform(-.05,.05); x=math.cos(a)*rng.uniform(35,40); z=math.sin(a)*rng.uniform(28,32)
    r=rng.uniform(2,5); y=rng.uniform(.3,1.4); sq=rng.uniform(.25,.5)
    # Corner mounds used to overlap the playable rectangle (walk-through ghost hills):
    # push each mound until its whole footprint clears the earth bank.
    while abs(x)-r<33 and abs(z)-r<25: x*=1.04; z*=1.04
    D.blob('moss' if i%4 else 'earth',(x,y,z),r,sq)
# Soil face strata and sparse rooted grass break up the perimeter without a repeated boulder fence.
for x in range(-30,31,4):
    for z in (-23.42,23.42):
        for j in range(3):
            xx=x+j*.22; yy=2.78
            D.tri('moss',(xx-.1,yy,z),(xx+.1,yy,z),(xx+.06,yy+.42,z+.1))
for n,(x,z,scale) in enumerate([(-40,-19,1.25),(42,-13,1.1),(-35,31,1.1),(25,35,.9),(-17,-35,1.05),(22,-35,1.2),(47,22,.8),(-49,6,1.4)]):
    beam(D,'bark',(x,-.4,z),(x+1.5*scale,7.5*scale,z),.33*scale,9)
    for j in range(5):
        a=j*1.9+n*.7; dx,dz=math.cos(a)*2.8*scale,math.sin(a)*2.2*scale
        tip=(x+1.5*scale+dx,(6.5+(j%3)*.65)*scale,z+dz)
        beam(D,'bark',(x+.9*scale,4.6*scale,z),tip,.13*scale,6)
        for k in range(3):
            D.blob('leaf' if (j+k+n)%3 else 'leafLight',(tip[0]+(k-1)*.95*scale,tip[1]+.7*scale,tip[2]+((k+n)%2-.5)*1.2*scale),(1.55+.23*(k%2))*scale,.64)
# Layered terrain skirts remove the board floating in a void. Outside play bounds
# only: these hills never replace or disguise the authoritative arena collision.
def terrain_height(x,z):
    edge=max(abs(x)-32,abs(z)-24)
    return -.3+min(max(edge,0)/20,1)*(4+2.6*math.sin(x*.065+z*.026)+2*math.cos(z*.072-x*.025))
for x in range(-120,120,8):
    for z in range(-112,96,8):
        if -40<x<32 and -32<z<24: continue
        a=(x,terrain_height(x,z),z); b=(x+8,terrain_height(x+8,z),z)
        cc=(x+8,terrain_height(x+8,z+8),z+8); d=(x,terrain_height(x,z+8),z+8)
        D.quad('hill',a,b,cc,d)
# Continuous surrounding ridges: no finite billboard ends poking up as triangles
# when the player turns away from the review camera.
for layer,(radius,height,color) in enumerate([(112,13,'hill'),(155,23,'distant'),(205,31,'distantFar')]):
    for i in range(72):
        a,b=math.tau*i/72,math.tau*(i+1)/72
        h=lambda t:height+3*math.sin(3*t+layer)+2.5*math.cos(5*t-layer)
        ax,az=math.cos(a)*radius,math.sin(a)*radius
        bx,bz=math.cos(b)*radius,math.sin(b)*radius
        D.quad(color,(ax,-8,az),(bx,-8,bz),(bx,h(b),bz),(ax,h(a),az))
# Clustered low heath patches provide scale and rough ground without noisy blocking rubble.
for cx,cz in [(-20,14),(17,17),(-20,-18),(18,-19),(-4,20),(24,-8)]:
    for j in range(9):
        x=cx+rng.uniform(-1.2,1.2); z=cz+rng.uniform(-.8,.8)
        rr=rng.uniform(.2,.5)
        if j%3==0: D.blob('heather',(x,.14,z),.13,.6)
    for j in range(28):
        x=cx+rng.uniform(-1.1,1.1); z=cz+rng.uniform(-.75,.75); h=rng.uniform(.16,.4)
        D.tri('moss',(x-.035,.025,z),(x+.035,.025,z),(x+.08,h,z+.035))
        if j%3==0: D.tri('leaf',(x,.025,z-.035),(x,.025,z+.035),(x-.04,h*.8,z+.07))
# Broad low-contrast irregular turf stains and sparse blades break the uniform tabletop look.
for k,(cx,cz,rx,rz) in enumerate([(-19,8,4,3),(18,-15,5,3),(8,18,4,2),(-3,-5,4,2),(-18,-16,3,3),(23,8,2,3),(-8,9,3,1.3)]):
    y=.002+k*.0001
    for j in range(9):
        x=cx+rng.uniform(-rx,rx)*.7; z=cz+rng.uniform(-rz,rz)*.7
        D.tri('turf',(x-.1,y,z),(x+.1,y,z),(x+.03,y+.22,z+.06))
        if j%4==0:
            D.blob('flower',(x,.2,z),.07,.6)
# ---------------------------------------------------------------- 2026-10-28 light & war dressing
# Fires, war debris, a distant Camelot and an army camp give the evening battlefield
# depth like SAKURA's lantern-lit precinct. Everything here is decorative: flames and
# braziers stand on existing solids, flat debris stays below 0.35 m, and the camp,
# castle and smoke are far outside the playable earth banks.
GLOWS,POOLS,EMBERS,SMOKE=[],[],[],[]
def solid_top(x,z):
    best=0
    for o in c.objects:
        if not o['collision'] or o['type']!='box': continue
        (px,py,pz),(w,h,d)=o['position'],o['size']
        if abs(x-px)<=w/2 and abs(z-pz)<=d/2: best=max(best,py+h/2)
    return best
PROP_ART={}
def fire(x,z,s=1,y=None,ground=None,pool=3.2,legs=True,solid=False):
    y=solid_top(x,z) if y is None else y
    if solid:
        # Braziers on reachable tops (<=1.45 m) are real little obstacles: their art
        # lives in the VIS node of a matching collision box, so nobody walks through fire.
        pid=f'brazier_{len(PROP_ART)}'
        c.box(pid,[x,round(y+.8*s-.01,3),z],[round(.8*s,3),round(1.6*s+.02,3),round(.8*s,3)],'iron','prop')
        PROP_ART[pid]=lambda m,x=x,y=y,z=z,s=s,legs=legs: brazier(m,x,y,z,s,legs)
        fx,fy,fz=brazier(Mesh(),x,y,z,s,legs)
    else: fx,fy,fz=brazier(D,x,y,z,s,legs)
    GLOWS.append([round(fx,3),round(fy+.1*s,3),round(fz,3),round(2.1*s,2),'#ffa34d',.8])
    EMBERS.append([round(fx,3),round(fy,3),round(fz,3),round(.35*s,2)])
    if pool: POOLS.append([round(x,3),round(solid_top(x,z) if ground is None else ground,3),round(z,3),pool,'#ff9b4a',.55])
# Hall: fires on both surviving wall stumps light the foundation floor.
fire(-8.5,-17.6,1.05,ground=1.2); fire(8.5,-12.5,1.05,ground=1.2)
# Sword stone: two low iron fire bowls flank the blade on its rubble mound.
fire(-19.3,-4.8,.8,ground=0,pool=2.6,solid=True); fire(-16.7,-3.2,.8,ground=0,pool=2.6,solid=True)
# Outworks and the baggage line each keep one watch fire.
fire(14,15,.9,ground=0); fire(-8.7,15.2,.9,ground=0,solid=True); fire(-22.6,9,.8,ground=0,pool=2.4)
fire(17,-4,.75,ground=0,pool=2.4)
# Spawn rally fires on the broken spawn walls, team-tinted pools.
for side,col in ((-1,'#ffb066'),(1,'#ffb066')):
    fire(side*24,side*7.2,.95,ground=0,pool=3.4)
# Torches along the palisade crest frame the arena edge at night-ish contrast.
for zz in (-18,-6,6,18):
    for xx in (-32,32):
        fx,fy,fz=torch(D,xx,4.2,zz,1.1); GLOWS.append([fx,round(fy+.05,3),fz,1.5,'#ffad5c',.9])
for xx in (-24,-12,0,12,24):
    for zz in (-24,24):
        fx,fy,fz=torch(D,xx,4.2,zz,1.1); GLOWS.append([fx,round(fy+.05,3),fz,1.5,'#ffad5c',.9])
# Battlefield remnants: dropped shields, broken spears and spent arrows, all lying
# flat (< .3 m) and kept out of the main worn tracks so they read, not clutter.
for k,(x,z) in enumerate([(-11,-10),(4,-9),(12,12),(-17,16),(20,6),(-25,1),(9,19),(-3,-20),(23,-14),(-12,19),(2,13),(24,13)]):
    a=rng.uniform(0,math.tau)
    if k%2==0:
        # round shield, face up, slightly tilted on its boss
        for i in range(10):
            t0,t1=math.tau*i/10,math.tau*(i+1)/10
            D.tri('shieldRed' if k%4==0 else 'cloth',(x,.11,z),(x+.42*math.cos(t1),.05+.03*math.sin(t1),z+.42*math.sin(t1)),(x+.42*math.cos(t0),.05+.03*math.sin(t0),z+.42*math.sin(t0)))
        D.blob('iron',(x,.12,z),.08,.5)
        beam(D,'leather',(x-.42,.06,z),(x+.42,.09,z),.025,4)
    # broken spear shaft with its head
    dx,dz=math.cos(a),math.sin(a)
    beam(D,'timber',(x+dx*.6,.04,z+dz*.6),(x+dx*2.1,.07,z+dz*2.1),.03,5)
    cone(D,'iron',(x+dx*2.1,.07,z+dz*2.1),.05,.0001+.01,4)
    D.quad('iron',(x+dx*2.1-dz*.05,.07,z+dz*2.1+dx*.05),(x+dx*2.4,.08,z+dz*2.4),(x+dx*2.1+dz*.05,.07,z+dz*2.1-dx*.05),(x+dx*2.05,.07,z+dz*2.05))
    for j in range(3):
        # spent arrows still standing in the turf, knee-high at most
        ax,az=x+rng.uniform(-1.6,1.6),z+rng.uniform(-1.6,1.6); lean=rng.uniform(-.12,.12)
        beam(D,'timber',(ax,0,az),(ax+lean,.3,az+lean*.5),.012,3)
        D.tri('canvas',(ax+lean,.3,az+lean*.5),(ax+lean,.22,az+lean*.5+.04),(ax+lean,.22,az+lean*.5-.04))
# Planted swords around the stone (on the rubble mound, below the blade landmark).
for k,(x,z) in enumerate([(-19.1,-3.1),(-17.1,-5),(-18.9,-5.2),(-16.6,-4.2)]):
    yy=1.4; lean=(.08 if k%2 else -.07)
    D.quad('iron',(x-.03,yy,z),(x+.03,yy,z),(x+.03+lean,yy+.62,z),(x-.03+lean,yy+.62,z))
    beam(D,'gold',(x+lean-.12,yy+.62,z),(x+lean+.12,yy+.62,z),.02,4)
    beam(D,'leather',(x+lean,yy+.62,z),(x+lean*1.2,yy+.8,z),.022,4)
# Ash and scorched earth rings under the fires on the ground.
for gx,gy,gz,rad,_,_ in POOLS:
    if gy==0: D.blob('ash',(gx,-.06,gz),rad*.28,.06)
# Team banners rise from the broken spawn walls (above head height, off the floor).
for side in (-1,1):
    top=solid_top(side*24,side*16)
    beam(D,'timber',(side*24,top,side*16),(side*24,top+3.2,side*16),.05,6)
    D.quad('cloth' if side<0 else 'shieldRed',(side*24,top+3.1,side*16),(side*24-side*1.4,top+3,side*16+.15),(side*24-side*1.25,top+1.5,side*16+.2),(side*24,top+1.65,side*16))
    D.tri('gold',(side*24-side*.25,top+2.8,side*16+.02),(side*24-side*1.05,top+2.7,side*16+.1),(side*24-side*.6,top+2.1,side*16+.08))
# --- Beyond the banks: the army camp (west and east), standing stones and Camelot.
for side in (-1,1):
    for k,(dx,z,w) in enumerate([(6,-14,4.2),(10,-4,3.6),(7,7,4.6),(12,15,3.8),(15,-11,3.4),(16,3,4.2)]):
        x=side*(32+dx); y=terrain_height(x,z)-.15
        tent(D,x,y,z,w,2.8,2.1,'canvas' if k%3 else 'cloth','canvasShade')
    for k,(dx,z) in enumerate([(9,0),(13,-7),(10,11)]):
        x=side*(32+dx); y=terrain_height(x,z)
        fx,fy,fz=brazier(D,x,y,z,1.3,legs=False)
        GLOWS.append([round(fx,2),round(fy+.2,2),round(fz,2),3.2,'#ff9c45',.8]); EMBERS.append([round(fx,2),round(fy,2),round(fz,2),.5])
        SMOKE.append([round(fx,2),round(fy+1,2),round(fz,2),.35,'#7d746c'])
    for k,z in enumerate((-20,-9,2,13)):
        x=side*(36+k%2*5); y=terrain_height(x,z)
        flag(D,'cloth' if side<0 else 'shieldRed',(x,y+4.2,z),side,1.1)
# A ring of weathered standing stones on the south-east rise.
for i in range(11):
    a=math.tau*i/11; x=58+math.cos(a)*9; z=34+math.sin(a)*7; y=terrain_height(x,z)
    h=2.4+(i*7%5)*.35
    D.cbox('stoneShade' if i%3 else 'stone',[x,y+h/2-.2,z],[1.1,h,.7])
    if i%4==0: D.cbox('stone',[x+.6,y+h+.15,z],[2.4,.45,.75])
# Camelot on the far northern ridge: the chapter's landmark, like SAKURA's pagoda.
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
# Distant pyres of the battle still smoulder on the horizon.
SMOKE.extend([[-70,2,-60,1.4,'#857b72'],[75,3,-25,1.6,'#857b72'],[40,4,-85,1.8,'#8a8079'],[-85,2,40,1.5,'#857b72']])
for x,y,z in [(-70,2,-60),(75,3,-25),(40,4,-85),(-85,2,40)]:
    GLOWS.append([x,y+1,z,5,'#ff8a3a',.6])
# Denser wildflower and grass at wall feet (below the ghost band, no collision needed).
for o in c.objects:
    if o['type']!='box' or o['material'] not in ('stone','stoneShade','timber') or o['role']=='structure': continue
    (x,y,z),(w,h,d)=o['position'],o['size']
    if y-h/2>.05: continue
    for j in range(int((w+d)*2.2)):
        side=rng.choice((-1,1)); along=rng.random()<w/(w+d)
        px=x+(rng.uniform(-w/2,w/2) if along else side*(w/2+rng.uniform(.05,.3)))
        pz=z+(side*(d/2+rng.uniform(.05,.3)) if along else rng.uniform(-d/2,d/2))
        hh=rng.uniform(.18,.34)
        D.tri('moss' if j%3 else 'leafLight',(px-.05,.01,pz),(px+.05,.01,pz),(px+rng.uniform(-.06,.06),hh,pz+.03))
        if j%7==0: D.blob('flower' if j%2 else 'heather',(px,hh,pz),.05,.7)
c.data['presentation'].update(glows=GLOWS,pools=POOLS,embers=EMBERS,smoke=SMOKE,
    field=dict(kind='pollen',count=160,color='#ffe2a6',size=.05,min=[-30,.4,-22],max=[30,5,22]))
c.data['designNotes']=['Early-medieval-inspired fictional battlefield, not a dated reconstruction.','Three offset cover islands with a broad central breach and two foundation ramps.','Rubble chips and distant turf are decorative; no scattered micro-colliders.']
def rough_stone(m,material,p,s,r):
    x,y,z=p; w,h,d=s
    # Irregular eight-corner section, different upper/lower contours, but no vertex outside proxy.
    def contour(yy,top):
        b=.08
        pts=[(-.5+b,-.5),(.5-b,-.5),(.5,-.5+b),(.5,.5-b),(.5-b,.5),(-.5+b,.5),(-.5,.5-b),(-.5,-.5+b)]
        return [(x+(px+r.uniform(-.025,.025))*w*.93,yy+r.uniform(-.035,.035)*h,z+(pz+r.uniform(-.025,.025))*d*.93) for px,pz in pts]
    low=contour(y-h*.43,False); high=contour(y+h*.43,True)
    for j in range(8):
        m.quad(material,low[j],low[(j+1)%8],high[(j+1)%8],high[j])
        m.tri(material,(x,y+h*.48,z),high[j],high[(j+1)%8])
        m.tri(material,(x,y-h*.48,z),low[(j+1)%8],low[j])
def crafted(m,o):
    if o['id'] in PROP_ART:
        PROP_ART[o['id']](m); return True
    if o['id']=='sword_in_stone':
        # Hidden core inside the visible blade keeps the node honest; the art is detail.
        m.cbox('iron',[o['position'][0],2.4,o['position'][2]],[.04,1.6,.04]); return True
    if o['id'].startswith('south_outwork'):
        # Low-cost authored masonry: closed mortar core, offset stone courses,
        # kept in the source object's exact authoritative footprint.
        x,y,z=o['position'];w,h,d=o['size']; along=w>d; span=w if along else d
        m.cbox('stoneShade',[x,y,z],[w*.96,h*.98,d*.96])
        rows=3; cols=max(2,round(span/.9))
        for row in range(rows):
            for j in range(cols):
                t=(j+.5)*span/cols-span/2; yy=y-h/2+(row+.5)*h/rows
                p=[x+t,yy,z] if along else [x,yy,z+t]
                sz=[span/cols-.025,h/rows-.025,d] if along else [w,h/rows-.025,span/cols-.025]
                m.cbox(('stone','stoneLight','stoneShade')[(j+row)%3],p,sz)
        return True
    if o['id'].startswith('crest_palisade_'):
        # Sharpened oak stakes on a solid backing board: the backing keeps the proxy
        # honestly opaque (no false shoot-through slits), the stakes give the crest
        # an irregular hand-built silhouette instead of a flat brown fence.
        x,y,z=o['position']; w,h,d=o['size']; along=w>d; span=w if along else d
        bottom,top=y-h/2,y+h/2
        m.cbox('grain',[x,bottom+h*.36,z],[w*.55 if not along else w,h*.72,d*.55 if along else d])
        rr=random.Random(len(o['id'])*31+int(abs(x+z)))
        n=int(span/.42)
        for i in range(n):
            t=-span/2+(i+.5)*span/n
            cx,cz=(x+t,z) if along else (x,z+t)
            r=.17+rr.uniform(-.02,.03); tip=.24+rr.uniform(0,.06)
            hh=h-tip-rr.uniform(0,.22)
            m.prism('timber' if i%5 else 'bark',(cx,bottom,cz),r,hh,n=5,rot=rr.uniform(0,1))
            cone(m,'grain' if i%3==0 else 'timber',(cx,bottom+hh,cz),r,tip,5,rr.uniform(0,1))
        for yy in (bottom+.35,bottom+.85):
            m.cbox('leather',[x,yy,z],[w-.02 if along else w*.98,.07,d*.98 if along else d-.02])
        return True
    if o['id']=='fallen_hall_beams':
        # A collapsed stack of squared hall timbers around a closed core.
        x,y,z=o['position']; w,h,d=o['size']; bottom=y-h/2
        m.cbox('grain',[x,y,z],[w*.92,h*.9,d*.8])
        rows=[(3,.29),(2,.29),(1,.27)]
        for row,(count,r) in enumerate(rows):
            yy=bottom+r+row*r*1.72
            for j in range(count):
                zz=z+(j-(count-1)/2)*r*2.02
                beam(m,'timber' if (j+row)%2 else 'bark',(x-w/2+.04+row*.12,yy,zz),(x+w/2-.04-row*.2,yy,zz),r,7)
        return True
    if o['id'] in ('baggage_breastwork','baggage_return'):
        x,y,z=o['position']; w,h,d=o['size']; bottom=y-h/2
        bevelbox(m,'timber',o['position'],o['size'],.09)
        for j in range(4):
            yy=bottom+(j+.5)*h/4
            for zz in (z-d/2+.035,z+d/2-.035):
                m.cbox('timber',[x,yy,zz],[w-.06,h/4-.025,.065])
        for xx in (x-w*.34,x+w*.34):
            m.cbox('iron',[xx,y,z],[.09,h-.03,d-.01])
        # Blue shield faces and old iron bosses stay within the same solid cover.
        if o['id']=='baggage_breastwork':
            for xx in (x-.95,x+.95):
                m.cbox('cloth',[xx,y,z-d/2+.008],[.7,1.3,.012])
                m.cbox('gold',[xx,y,z-d/2+.005],[.08,1.15,.008])
        return True
    if o['id']=='battlefield_floor':
        m.cbox('earth',o['position'],o['size'],top_mat='battlefield')
        # One painted atlas; no world tiling on this particular authored floor.
        positions=m.prims['battlefield'][0]
        m.uvs['battlefield']=[value for j in range(0,len(positions),3) for value in ((positions[j]+32)/64,(positions[j+2]+24)/48)]
        return True
    if o['id']=='hall_foundation':
        x,y,z=o['position']; w,h,d=o['size']
        m.cbox('earth',[x,y,z],[w-.36,h,d-.36],top_mat='path')
        for row in range(3):
            yy=y-h/2+(row+.5)*h/3
            for i in range(15):
                xx=x-w/2+(i+.5)*w/15
                colour=['stone','stoneShade','stoneLight'][(i+row*2)%3]
                for zz in (z-d/2+.09,z+d/2-.09):
                    m.cbox(colour,[xx,yy,zz],[w/15-.035,h/3-.025,.18])
            for i in range(8):
                zz=z-d/2+(i+.5)*d/8
                for xx in (x-w/2+.09,x+w/2-.09):
                    m.cbox('stoneShade' if (i+row)%3 else 'stone',[xx,yy,zz],[.18,h/3-.025,d/8-.035])
        return True
    if o['id'].startswith('earthbank_'):
        m.cbox('earth',o['position'],o['size'],top_mat='turf')
        return True
    if o['id']=='rubble_west':
        x,y,z=o['position']; w,h,d=o['size']; base=y-h/2
        lower=[]; upper=[]
        for i in range(8):
            a=math.tau*i/8
            lower.append((x+math.cos(a)*w*.5,base,z+math.sin(a)*d*.5))
            upper.append((x+math.cos(a)*w*.42,base+h*(.5+[.13,.06,.2,.12][i%4]),z+math.sin(a)*d*.42))
        for i in range(8):
            m.quad('stoneShade',lower[i],lower[(i+1)%8],upper[(i+1)%8],upper[i])
            m.tri('stone' if i%3 else 'stoneLight',upper[i],upper[(i+1)%8],(x-.15,base+h,z+.1))
        return True
    if o['type']=='box' and o['material'] in ('stone','stoneShade'):
        x,y,z=o['position']; w,h,d=o['size']; along=w>d; span=w if along else d
        rr=random.Random(sum(ord(v)*(i+1) for i,v in enumerate(o['id'])))
        # A slightly inset dark mortar mass closes tiny interstices while each fieldstone stays separate.
        m.cbox('stoneShade',[x,y,z],[w*.9,h*.96,d*.9])
        rows=max(2,round(h/.42))
        for row in range(rows):
            yy=y-h/2+(row+.5)*h/rows
            cuts=[-span/2]; pos=-span/2+(.34 if row%2 else .65)
            while pos<span/2-.12:
                cuts.append(pos); pos+=rr.uniform(.45,.72)
            cuts.append(span/2)
            for j,(a,b) in enumerate(zip(cuts,cuts[1:])):
                t=(a+b)/2; color=['stone','stoneShade','stoneLight'][rr.randrange(3)]
                p=[x+t,yy,z] if along else [x,yy,z+t]
                s=[b-a-.012,h/rows,d] if along else [w,h/rows,b-a-.012]
                rough_stone(m,color,p,s,rr)
        return True
    return False
c.save(render_object=crafted)
