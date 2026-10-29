"""BLACKFLAG: authored ship arena using the mesh kit and original Pillow-painted surfaces.
Run from any directory: python3 arena-maps/blackflag/source/build.py
"""
from pathlib import Path
import sys, math, json
from surfaces import painted_surfaces
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'_lib'))
from chapterkit import Chapter, mat, ring, flag, box_edges, bevelbox, hiproof
from glbkit import Mesh, write_glb


def beam(m, material, a, b, radius, sides=6):
    """Indexed, smooth-sided spar/rope: same profile, no duplicated side vertices.

    The old mesh kit stored ten vertices per side including cap fans. Sharing
    radial side normals and using n-2 cap triangles leaves budget for actual
    ship joinery, rather than invisible vertices. Each cap keeps its hard edge.
    """
    v=[b[i]-a[i] for i in range(3)]; length=math.sqrt(sum(x*x for x in v))
    if length < 1e-9:return
    v=[x/length for x in v]; up=[0,1,0] if abs(v[1])<.95 else [1,0,0]
    u=[v[1]*up[2]-v[2]*up[1],v[2]*up[0]-v[0]*up[2],v[0]*up[1]-v[1]*up[0]]
    length_u=math.sqrt(sum(x*x for x in u));u=[x/length_u for x in u]
    w=[v[1]*u[2]-v[2]*u[1],v[2]*u[0]-v[0]*u[2],v[0]*u[1]-v[1]*u[0]]
    P,N,I=m.tri_list(material);UV=m.uvs.setdefault(material,[]);base=len(P)//3
    for end,origin in enumerate((a,b)):
        for j in range(sides+1):
            angle=math.tau*j/sides
            n=[u[k]*math.cos(angle)+w[k]*math.sin(angle) for k in range(3)]
            P.extend(origin[k]+radius*n[k] for k in range(3));N.extend(n)
            UV.extend((j/sides*math.tau*radius,end*length))
    for j in range(sides):
        lo=base+j;hi=lo+sides+1;I.extend((lo,lo+1,hi+1,lo,hi+1,hi))
    # Rope/trim endpoints are subpixel and meet other pieces; omit hidden caps.
    if radius < .095:return
    for end,origin in enumerate((a,b)):
        start=len(P)//3
        for j in range(sides):
            angle=math.tau*j/sides
            P.extend(origin[k]+radius*(u[k]*math.cos(angle)+w[k]*math.sin(angle)) for k in range(3))
            N.extend((1 if end else -1)*k for k in v)
            UV.extend((radius*math.cos(angle),radius*math.sin(angle)))
        for j in range(1,sides-1):
            I.extend((start,start+j,start+j+1) if end else (start,start+j+1,start+j))


class ShipChapter(Chapter):
    """Blackflag-only visual groups; physics export stays byte-identical."""
    def save(self, render_object=None):
        if self.textures:
            self.data['artPipeline']=dict(embeddedMaterialTextures=True,projection='world-metre planar per face',channels=['baseColor','occlusionRoughnessMetallic','normal'])
        # Runtime semantic palette stays byte-compatible; revised PBR colours and
        # dark mizzen textile live in the self-contained GLB material table only.
        runtime_palette={k:v[0] for k,v in self.palette.items() if k!='tarCloth'}
        runtime_palette.update(iron='#505d63',brass='#d5ae65')
        self.data.update(palette=runtime_palette,objects=self.objects,anchors=self.anchors,routes=self.routes)
        (self.root/'runtime/map.json').write_text(json.dumps(self.data,indent=2,ensure_ascii=False)+'\n')
        nodes=[];cols=[]
        for o in self.objects:
            visual=Mesh();collision=Mesh();custom=render_object and render_object(visual,o)
            if o['type']=='ramp':visual.wedge(o['material'],o);collision.wedge('collision',o)
            else:
                if not custom:visual.cbox(o['material'],o['position'],o['size'])
                collision.cbox('collision',o['position'],o['size'])
            extra=dict(source_id=o['id'],role=o['role'],collision=o['collision'],decorative=False)
            # The upper deck is a floor that must still shade the gun deck below it.
            if o['id'].startswith('upper_deck_'):extra['castShadow']=True
            nodes.append(('VIS_'+o['id'],visual,extra))
            if o['collision']:cols.append(('COL_'+o['id'],collision,dict(source_id=o['id'],role=o['role'],collision=True,decorative=False)))
        for name,mesh,shadow in [('chapter_craft',self.detail,False),('ship_sails',self.sails,True),('ship_gallery',self.gallery,True)]:
            nodes.append(('DETAIL_'+name,mesh,dict(role='detail_batch',collision=False,decorative=True,castShadow=shadow)))
        mats={**self.palette,'collision':('#adbbce',0,1,0,1)}
        vis=write_glb(self.root/f'assets/{self.id}_visual.glb',nodes,list(self.palette),mats,textures=self.textures)
        col=write_glb(self.root/f'assets/{self.id}_collision.glb',cols,['collision'],mats)
        print(json.dumps(dict(id=self.id,visual=vis,collision=col)))

P=dict(timber=mat('#9b623a'), deck=mat('#c29662'), plank=mat('#ad7c4d'), grain=mat('#805738'),
       tar=mat('#303a43'), iron=mat('#485962',.88,.88), brass=mat('#d6b878',.9,.7),
       canvas=mat('#e7d8b6'), canvasShade=mat('#c2ad8a'), teal=mat('#4c9b9c'), red=mat('#b95d4e'),
       sea=mat('#397c89',.1,.4), foam=mat('#81bdc4'), glass=mat('#8fc4be',.15,.4,.12), distant=mat('#697e9b'), blackSail=mat('#ffffff'), woodLight=mat('#be925a'),
       woodDark=mat('#654229'), lamp=mat('#ffe2a0',0,.65,2.0), deepSea=mat('#285b70'), farRock=mat('#6c97a4'), tarCloth=mat('#33414b',0,.9))
c=ShipChapter(ROOT,'blackflag','BLACKFLAG 黑帆战舰',64,34,'seabreeze',P); D=c.detail
c.sails=Mesh();c.gallery=Mesh()
# A broad 64 x 34m game-scaled deck: no obligatory gangplanks or jump gaps.
c.box('main_deck',[0,-.45,0],[64,.9,34],'deck','floor')
# 2026-10-29: the side walls rise to 4.2 m so they enclose both the gun deck and the
# upper deck (1.8 m above it), like the raised decks' bulwarks.
for z in (-17,17): c.box('bulwark_'+str(z),[0,2.1,z],[64,4.2,.5],'tar','structure')
# Raised decks need their own continuous 1.8m side protection.
for x in (-27,27):
    for z in (-17,17): c.box(f'raised_bulwark_{x}_{z}',[x,3,z],[10,2.4,.5],'tar','structure')
for x in (-32,32): c.box('end_bulwark_'+str(x),[x,2,0],[.5,4,34],'tar','structure')
for sign,tag,team in [(-1,'bow','west'),(1,'stern','east')]:
    c.box(tag+'_deck',[sign*27,1.2,0],[10,2.4,33.5],'timber','floor')
    c.box(tag+'_screen',[sign*24,4.25,0],[.7,3.7,10],'tar','structure')
    for i,z in enumerate((-2,2)):
        c.anchor(f'spawn_{team}_{i}','spawn',[sign*28,2.4,z],yaw=-sign*1.5708,team=team)
    c.anchor('cover_'+tag,'cover',[sign*26,2.4,0],height=3.7)
    for z in (-14,14):
        c.box(tag+'_gun_'+str(z),[sign*26,3.05,z],[3.2,1.3,1.6],'timber')
    c.box(tag+'_team_mark',[sign*30,2.425,0],[1.2,.05,4],'teal' if sign<0 else 'red','wayfinding',False)
# Ship anatomy is collision, not a render-only shell. Wide loops surround two staggered cover islands.
c.box('hatch_coaming',[0,.7,0],[7,1.4,6],'timber')
# 2026-10-28 collision audit: the helmsman's wheel stood on the stern deck with no
# collider, so players walked through it. A slim box matches the wheel's disc.
c.box('stern_helm',[29,3.75,0],[.5,2.7,2.2],'timber','prop')
c.box('main_mast',[0,8,0],[.9,16,.9],'timber','structure')
c.box('fore_mast',[-13,6,-2],[.7,12,.7],'timber','structure')
for x,z in [(-11,-13),(9,13),(-3,13),(3,-13)]:
    c.box(f'gun_{x}_{z}',[x,.65,z],[3.4,1.3,1.8],'timber')
# Staggered middeck packing islands break up empty exposed approaches without
# narrowing the two 5m-wide broadside loops or blocking cross-deck connections.
c.box('cargo_crate_fore',[-8.5,.9,-1.1],[3,1.8,2.6],'timber')
c.box('cargo_crate_aft',[9,.95,2],[3.4,1.9,2.5],'timber')
# 2026-10-28 stuck scan: at z=+-14.8 the breastwork left a 0.45 m slot behind the gun.
# Stepping off the gun dropped players into it with no way out; it now backs the gun.
for x,z in [(3,-14.35),(-3,14.35)]:
    c.box(f'gun_breastwork_{x}',[x,.9,z],[6,1.8,.9],'timber')
# 2026-10-29 two-deck rework (max: the open gangways were useless, you were shot
# from above). BLACKFLAG is now a real two-storey ship: a solid upper deck at the
# quarterdeck height (2.4 m) covers the whole waist, and the gun deck below is
# enclosed, reached only by two stairwells (point-symmetric) and from nowhere else.
UPPER=[(-22,-13,-16.75,16.75),(-13,-7,-16.75,2.6),(-13,-7,5,16.75),(-7,7,-16.75,16.75),(7,13,-16.75,-5),(7,13,-2.6,16.75),(13,22,-16.75,16.75)]
for k,(x0,x1,z0,z1) in enumerate(UPPER):
    c.box(f'upper_deck_{k}',[(x0+x1)/2,2.25,(z0+z1)/2],[x1-x0,.3,z1-z0],'deck','floor')
for sg in (-1,1):
    # Stair down: high end at the upper deck edge, low end on the gun deck.
    c.ramp(f'stair_{sg}',[sg*-10,0,sg*3.8],[6,2.4,2.4],'x',sg,'deck')
    # Coamings round each stairwell are waist-high cover on the upper deck.
    for zz in (2.45,5.15):
        c.box(f'stair_coaming_{sg}_{int(zz*100)}',[sg*-10,2.85,sg*zz],[6,.9,.3],'timber','cover')
    c.box(f'stair_coaming_end_{sg}',[sg*-7.15,2.85,sg*3.8],[.3,.9,2.4],'timber','cover')
    # Upper-deck cover: the ship's boat on its chocks, deck cargo and water casks.
    c.box(f'ship_boat_{sg}',[0,2.95,sg*-9],[6,1.1,2.2],'woodLight','cover')
    c.box(f'deck_cargo_{sg}',[sg*-16,3.1,sg*-8],[2.6,1.4,1.8],'timber','cover')
    c.box(f'water_casks_{sg}',[sg*-17,3.0,sg*9],[1.8,1.2,1.8],'timber','cover')
    c.anchor(f'cover_boat_{sg}','cover',[0,2.4,sg*-11],height=1.1)
    c.anchor(f'cover_deck_cargo_{sg}','cover',[sg*-16,2.4,sg*-6.7],height=1.4)
    c.anchor(f'cover_stairwell_{sg}','cover',[sg*-10,2.4,sg*6],height=.9)
    c.anchor(f'cover_gundeck_{sg}','cover',[sg*-10,0,sg*-6],height=1.8)
c.anchor('objective_upper','objective',[5.5,2.4,5],radius=2)
for name,pos,h in [('fore',[-8.5,0,-3.6],1.8),('aft',[9,0,4.5],1.9),('port_battery',[6.8,0,-13],1.8)]:
    c.anchor('cover_added_'+name,'cover',pos,height=h)
for n,p in [('hatch_n',[0,0,-4]),('hatch_s',[0,0,4])]: c.anchor('cover_'+n,'cover',p,height=1.4)
c.anchor('objective_deck','objective',[4.8,0,0],radius=2)
c.route('upper_port',[[-28,2.4,-2],[-28,2.4,-10],[-23,2.4,-12],[21,2.4,-12],[28,2.4,-10],[28,2.4,-2]])
c.route('upper_starboard',[[-28,2.4,2],[-28,2.4,10],[-23,2.4,12],[21,2.4,12],[28,2.4,10],[28,2.4,2]])
c.route('down_and_through',[[-20,2.4,3.8],[-13.5,2.4,3.8],[-7.6,0,3.8],[-5,0,8],[0,0,10],[5.5,0,6],[5.5,0,-3.8],[7.6,0,-3.8],[13.5,2.4,-3.8],[20,2.4,-3.8]])
c.route('deck_breach',[[-15,0,-10],[-7,0,-8],[-5,0,-4],[5,0,-4],[6,0,5],[15,0,8],[15,0,10]])
c.route('cross_deck',[[-15,0,-10],[-15,0,10],[-5,0,10],[-5,0,4],[5,0,4],[5,0,10],[15,0,10],[15,0,-10]])
# Shared texture exporter embeds original paintings and per-face UVs; no URI fetches.
tex=painted_surfaces()
for name in ('timber','deck','plank','grain','tar','woodLight','woodDark'):
    c.textures[name]=dict(baseColor=tex/'oak_basecolor.png',orm=tex/'oak_orm.png',scale=.125)
for name in ('canvas','canvasShade','tarCloth'):
    c.textures[name]=dict(baseColor=tex/'canvas_basecolor.png',orm=tex/'canvas_orm.png',scale=.5)
c.textures['blackSail']=dict(baseColor=tex/'blackflag_sail_basecolor.png',orm=tex/'canvas_orm.png')
for name in ('iron','brass'):
    c.textures[name]=dict(orm=tex/f'{name}_orm.png',scale=.5)

# Original visual craft helpers; every solid gameplay object remains inside its proxy.
def polyline(m,material,points,radius,sides=6):
    for a,b in zip(points,points[1:]):beam(m,material,a,b,radius,sides)

def barrel(m,x,y,z,r=.6,h=1.55):
    N=14
    profile=[(0,r*.82),(.09,r*.91),(h*.24,r),(h*.5,r*1.06),(h*.76,r),(h-.09,r*.91),(h,r*.82)]
    for j in range(N):
        a=math.tau*j/N;b=math.tau*(j+1)/N
        material=('timber','plank','woodLight')[j%3]
        for (yy,rr),(ny,nr) in zip(profile,profile[1:]):
            m.quad(material,(x+rr*math.cos(a),y+yy,z+rr*math.sin(a)),(x+rr*math.cos(b),y+yy,z+rr*math.sin(b)),(x+nr*math.cos(b),y+ny,z+nr*math.sin(b)),(x+nr*math.cos(a),y+ny,z+nr*math.sin(a)))
        m.tri('woodDark',(x,y+h-.04,z),(x+r*.81*math.cos(a),y+h-.04,z+r*.81*math.sin(a)),(x+r*.81*math.cos(b),y+h-.04,z+r*.81*math.sin(b)))
        # Stave seams follow the belly, not a stack of featureless cylinders.
        # Stave edges are carried by painted grain and alternating shaped faces.
    for yy,rr in ((.12,r*.94),(h*.28,r*1.035),(h*.73,r*1.035),(h-.15,r*.95)):
        for j in range(N):
            a=math.tau*j/N;b=math.tau*(j+1)/N
            m.quad('iron',(x+rr*math.cos(a),y+yy-.035,z+rr*math.sin(a)),(x+rr*math.cos(b),y+yy-.035,z+rr*math.sin(b)),(x+rr*math.cos(b),y+yy+.035,z+rr*math.sin(b)),(x+rr*math.cos(a),y+yy+.035,z+rr*math.sin(a)))
    for zz in (-r*.36,0,r*.36):beam(m,'plank',(x-r*.7,y+h-.025,z+zz),(x+r*.7,y+h-.025,z+zz),.025,4)
    m.prism('brass',(x+.18,0,z),.07,.035,8,y0=y+h-.02)

LANTERNS=[]
def lantern(m,x,y,z,scale=1):
    LANTERNS.append((x,y+.42*scale,z,scale))
    m.prism('brass',(x,0,z),.28*scale,.12*scale,6,y0=y)
    m.prism('lamp',(x,0,z),.2*scale,.58*scale,6,y0=y+.13*scale)
    for i in range(6):
        a=math.tau*i/6;xx=x+.23*scale*math.cos(a);zz=z+.23*scale*math.sin(a)
        beam(m,'tar',(xx,y+.08*scale,zz),(xx,y+.76*scale,zz),.025*scale,4)
    m.prism('brass',(x,0,z),.31*scale,.12*scale,6,y0=y+.71*scale)
    m.blob('brass',(x,y+.92*scale,z),.14*scale)

# Curved multi-strake hull: rounded bilge, deep keel, raised counter and spear-like prow.
# All exterior geometry is outside/below the safe rectangular deck.
outline=[(-44,0),(-41,-6),(-37,-12),(-32,-17.8),(-25,-18.8),(-15,-19.1),(4,-19.1),(22,-18.8),(34,-17.8),(39,-13),(40,-7),(40,7),(39,13),(34,17.8),(22,18.8),(4,19.1),(-15,19.1),(-25,18.8),(-32,17.8),(-37,12),(-41,6)]
levels=[(-.4,1,1),(-1.1,1,.997),(-1.8,.995,.98),(-2.5,.98,.94),(-3.2,.95,.88),(-3.9,.91,.78),(-4.6,.85,.62),(-5.3,.78,.41),(-5.8,.73,.15)]
for row,((y,sx,sz),(ny,nsx,nsz)) in enumerate(zip(levels,levels[1:])):
    for i,(x,z) in enumerate(outline):
        xx,zz=outline[(i+1)%len(outline)]
        D.quad(('tar','woodDark','timber','woodDark','tar','timber','woodDark','tar')[row],(x*sx,y,z*sz),(xx*sx,y,zz*sz),(xx*nsx,ny,zz*nsz),(x*nsx,ny,z*nsz))
        polyline(D,'grain',[(x*sx,y+.018,z*sz),(xx*sx,y+.018,zz*sz)],.028,4)
        if row in (0,4):beam(D,'brass',(x*sx,y+.05,z*sz),(xx*sx,y+.05,zz*sz),.075,6)
        if i%2==0:beam(D,'tar',(x*sx,y,z*sz),(x*nsx,ny,z*nsz),.13,6)
# Narrow external gunport rhythm and scalloped gilded gallery accents.
for side in (-1,1):
    for x in range(-25,31,7):
        zz=side*18.8
        bevelbox(D,'tar',[x,-1.55,zz],[1.75,1.25,.15],.09)
        D.cbox('grain',[x,-1.55,zz+side*.1],[1.35,.89,.08])
        for yy in (-2.2,-.9):D.cbox('brass',[x,yy,zz+side*.11],[1.92,.07,.08])
        beam(D,'iron',(x,-1.55,zz),(x,-1.55,zz+side*1.05),.2,12)
    # Layered rubbing strake gives long warm sides contour and catches the sun.
    polyline(D,'brass',[(-38,.03,side*10),(-32,.03,side*17.8),(-24,.03,side*18.9),(22,.03,side*18.9),(35,.03,side*17.3),(39,.03,side*12)],.12,6)
# Forecastle extension; the raised safe playing deck and end wall remain unchanged.
D.tri('deck',(-32,2.38,-17.6),(-32,2.38,17.6),(-44,2.38,0))
for side in (-1,1):
    pts=[(-32,3.4,side*17.7),(-37,3.6,side*11.9),(-41,3.7,side*6),(-44,3.7,0)]
    polyline(D,'tar',pts,.22,8);polyline(D,'brass',[(x,y+.19,z) for x,y,z in pts],.07,6)
    for i in range(8):
        t=i/8;x=-32-12*t;z=side*17.7*(1-t)
        beam(D,'timber',(x,2.4,z),(x,3.45,z),.09,6)
beam(D,'timber',(-31,2.7,0),(-48,5.2,0),.32,12)
beam(D,'brass',(-47.2,4.7,0),(-47.5,5.5,0),.14,8)
polyline(D,'brass',[(-43,-3,0),(-44,-1,0),(-45,1.3,0),(-45.7,2.7,0),(-45.4,3.8,0)],.2,8)
# Stylized gilded winged figurehead, outside play boundary, not a floating billboard.
for side in (-1,1):
    for k in range(5):
        D.quad('brass',(-43.6,1.5,side*.2),(-43.1,2.6,side*.4),(-40.7+k*.22,2.8+k*.23,side*(1.8+k*.32)),(-41.1+k*.17,1.8+k*.18,side*(1.3+k*.28)))
D.blob('brass',(-44.1,2.3,0),.6,.7)

# Stocked anchors hang from the external catheads: visible stocks,
# curved arms, forged flukes and hemp sling instead of decorative floating icons.
for side in (-1,1):
    x=-35.3;z=side*14.9
    beam(D,'timber',(-32,3.4,side*15.5),(-34.4,3.7,side*18.8),.21,8)
    beam(D,'iron',(x,1.9,z),(x,-2.55,z),.14,10)
    beam(D,'woodDark',(x-1.65,.7,z),(x+1.65,.7,z),.21,8)
    for dx in (-1.2,1.2):beam(D,'iron',(x+dx,.48,z),(x+dx,.92,z),.08,6)
    polyline(D,'iron',[(x-1.9,-1.35,z),(x-1.5,-2.05,z),(x,-2.65,z),(x+1.5,-2.05,z),(x+1.9,-1.35,z)],.17,8)
    for sign in (-1,1):
        D.tri('iron',(x+sign*1.15,-1.55,z-.25),(x+sign*2.05,-1.1,z),(x+sign*1.8,-2.1,z+.25))
    # Bow ring stands in the anchor plane, not a horizontal floor ring.
    polyline(D,'iron',[(x+.38*math.cos(a),2+.38*math.sin(a),z) for a in [j*math.tau/16 for j in range(17)]],.055,6)
    polyline(D,'canvasShade',[(-34.4,3.7,side*18.8),(-35,3,side*17),(x,2.2,z)],.075,6)
# Chainplates and paired deadeyes express how the rigging loads meet the hull.
for x,z0 in [(0,0),(-13,-2)]:
    for side in (-1,1):
        for off in (0,.65,1.3):
            xx=x+3+off;zz=side*18.95
            beam(D,'iron',(xx,-2.1,zz*.97),(xx,.65,zz),.045,5)
            for yy in (.65,1.1):beam(D,'woodDark',(xx,yy,zz-.06),(xx,yy,zz+.06),.16,10)
            for dx in (-.07,.07):beam(D,'canvasShade',(xx+dx,.65,zz),(xx+dx,1.1,zz),.02,4)
            beam(D,'canvasShade',(xx,1.1,zz),(xx,.98,side*16.95),.035,5)

# Raised quarterdeck / stern gallery: layered carved transom, window bays and curved roof.
D=c.gallery
D.cbox('tar',[34.3,2.8,0],[5.2,6.1,21.8])
for yy in (.1,.8,5.35,5.85):D.cbox('brass',[36.97,yy,0],[.16,.12,22.4])
for z in (-10.9,-8,-4,0,4,8,10.9):
    bevelbox(D,'timber',[37,2.75,z],[.3,6.15,.35],.07)
    for yy in (.15,5.4):D.cbox('brass',[37.13,yy,z],[.18,.23,.62])
for z in (-8,-4,0,4,8):
    D.cbox('woodDark',[37.01,3.65,z],[.1,2.65,2.8])
    D.cbox('glass',[37.08,3.72,z],[.1,2.32,2.4])
    for zz in (-1.25,0,1.25):D.cbox('brass',[37.17,3.72,z+zz],[.1,2.5,.07])
    for yy in (2.48,3.5,4.3,4.96):D.cbox('brass',[37.17,yy,z],[.1,.07,2.55])
    # Raised relief curls as geometry, not a normal-map illusion.
    for sign in (-1,1):
        pts=[]
        for i in range(20):
            a=i*math.pi*2/19;r=.68*(1-i/25)
            pts.append((37.2,.9+r*math.sin(a),z+sign*(.6+r*math.cos(a))))
        polyline(D,'brass',pts,.035,5)
# Segmented curved roof plus gilded eaves, deliberately unlike a simple flat shed.
for i in range(12):
    z0=-12+i*2;z1=z0+2
    y0=6.05+1.5*(1-(z0/12)**2);y1=6.05+1.5*(1-(z1/12)**2)
    D.quad('tar',(30.8,y0,z0),(37.8,y0,z0),(37.8,y1,z1),(30.8,y1,z1))
    beam(D,'grain',(31,y0+.04,z0),(37.6,y0+.04,z0),.06,5)
for x in (30.8,37.8):polyline(D,'brass',[(x,6.1+1.5*(1-(z/12)**2),z) for z in range(-12,13,2)],.11,6)
# Stern captain's crest and high swan-neck lanterns create a designed end landmark.
for z in (-11.6,11.6):
    polyline(D,'brass',[(36,5.8,z),(36,7.4,z),(35.4,7.75,z),(34.9,7.2,z)],.06,6)
    lantern(D,34.9,6.35,z,.8)

# Side quarter galleries: glazing rhythm and raised wooden mouldings carry
# the stern architecture around the corners, not just across its rear face.
for side in (-1,1):
    z=side*10.99
    for x in (32.2,34.2,36.2):
        D.cbox('woodDark',[x,3.55,z],[1.65,2.8,.12])
        D.cbox('glass',[x,3.65,z+side*.08],[1.32,2.25,.06])
        for dx in (-.7,0,.7):D.cbox('brass',[x+dx,3.65,z+side*.13],[.055,2.5,.045])
        for yy in (2.45,3.2,4.1,4.86):D.cbox('brass',[x,yy,z+side*.13],[1.48,.055,.045])
    for yy in (1.5,5.15):D.cbox('brass',[34.3,yy,z+side*.12],[5.7,.11,.12])
    # Carved brackets below the bays and leaf tips at the outer corners.
    for x in (32.2,34.2,36.2):
        polyline(D,'timber',[(x,.3,z),(x,1,z+side*.45),(x,1.6,z+side*.35),(x,2.1,z)],.12,6)
# A raised sunburst transom cartouche ties the carved ship to its original sail
# heraldry without borrowing a historical vessel's specific coat of arms.
crestx=38.02;cy=6.6
for i in range(16):
    a=i*math.tau/16;b=a+.065
    D.tri('brass',(crestx,cy+1.03*math.sin(a),1.03*math.cos(a)),(crestx,cy+1.65*math.sin(a+.035),1.65*math.cos(a+.035)),(crestx,cy+1.03*math.sin(b),1.03*math.cos(b)))
polyline(D,'brass',[(crestx+.02,cy+.92*math.sin(i*math.tau/32),1.1*math.cos(i*math.tau/32)) for i in range(33)],.075,6)
beam(D,'woodDark',(crestx,cy,0),(crestx+.08,cy,0),.87,20)
for side in (-1,1):
    D.quad('brass',(crestx+.1,cy+.38,side*.12),(crestx+.1,cy+.2,side*.56),(crestx+.1,cy-.05,side*.5),(crestx+.1,cy+.04,side*.15))
D.tri('brass',(crestx+.1,cy+.07,0),(crestx+.1,cy-.23,-.14),(crestx+.1,cy-.23,.14))
for z in (-.34,-.11,.11,.34):D.cbox('brass',[crestx+.1,cy-.42,z],[.03,.25,.09])

D=c.detail

# Broad eye-level deck surfaces use painted oak; geometry adds only meaningful edge work.
# Inset contrasting margin planks visually frame both broad loops without becoming obstacles.
for z in (-15.9,15.9):D.cbox('woodDark',[0,.014,z],[43.6,.018,.22])
for sign in (-1,1):
    # Front face of raised end deck: horizontal timber framing and diagonal ship knees.
    x=sign*21.98
    for yy in (.1,.65,1.3,2.22):D.cbox('woodDark',[x,yy,0],[.045,.09,33.1])
    for z in (-15.5,-5.8,0,5.8,15.5):
        D.cbox('tar',[x,1.2,z],[.065,2.36,.22])
        beam(D,'brass',(x-sign*.02,.35,z-.65),(x-sign*.02,1.7,z+.65),.045,5)
    D.cbox('brass',[sign*22,2.42,0],[.15,.035,14.7])

D=c.sails
# Billowing square sails: cut silhouette, soft curved body, sewn panels and finished hem.
# Cloth stays above eye band; enlarged silhouette anchors the chapter like Sakura's hall roof.
def sail(x,z,top,width,height,material):
    def pt(u,v):
        edge=.83+.17*v
        return (x+2.3*math.sin(math.pi*u)*math.sin(math.pi*v*.86)+.18*math.sin(u*math.tau),
                top-v*height+.38*math.sin(math.pi*u)*v, z+(u-.5)*width*edge)
    for j in range(8):
        for i in range(16):
            u,v=i/16,j/8;pts=[pt(u,v),pt(u+1/16,v),pt(u+1/16,v+1/8),pt(u,v+1/8)]
            D.quad(material,*pts)
            if material=='blackSail':D.uvs[material][-8:]=[u,v,u+1/16,v,u+1/16,v+1/8,u,v+1/8]
    for v in (0,1):polyline(D,'canvasShade',[pt(i/16,v) for i in range(17)],.055,5)
    for u in (0,1):polyline(D,'canvasShade',[pt(u,i/8) for i in range(9)],.045,5)
    for u in (.25,.5,.75):polyline(D,'canvasShade',[pt(u,i/8) for i in range(9)],.018,4)
    return pt
main=sail(.05,0,15.2,21.6,8,'blackSail')
fore=sail(-13,-2,11.2,15.5,5.6,'canvas')
for x,z,h,w in [(0,0,16,22),(-13,-2,12,16)]:
    beam(D,'woodDark',(x,h-.7,z-w/2),(x,h-.7,z+w/2),.17,12)
    for side in (-1,1):
        # Tensioned standing rigging / shrouds anchored only at the rail, never across a route.
        for off in (0,.65,1.3):
            # Shrouds land on the bulwark cap above the upper deck, outside the walkway.
            beam(D,'canvasShade',(x+off,h-1,z),(x+3+off,4.22,side*16.95),.035,5)
        for step in range(3,13):
            t=step/14
            yy=(h-1)*(1-t)+4.22*t;zz=z*(1-t)+side*16.95*t
            beam(D,'grain',(x+3*t,yy,zz),(x+1.3+3*t,yy,zz),.019,4)
    beam(D,'canvasShade',(x,h-.7,z-w/2),(x+2.2,3.2,z-w*.62),.034,5)
    beam(D,'canvasShade',(x,h-.7,z+w/2),(x+2.2,3.2,z+w*.62),.034,5)
# Tiered topmasts and topsails give this fictional ship its age-of-sail
# silhouette. All new vertical structure starts above playable collision height.
for x,z,base,top,width in [(0,0,16.1,24.5,14.8),(-13,-2,12.1,19.0,10.6)]:
    beam(D,'timber',(x,base-.3,z),(x,top+1.5,z),.18 if x==0 else .13,12)
    D.prism('woodDark',(x,0,z),1.12 if x==0 else .85,.18,16,y0=base)
    ring(D,'brass',x,base+.2,z,1.06 if x==0 else .79,.07,20)
    sail(x+.08,z,top,width,top-base-.8,'canvas')
    beam(D,'woodDark',(x,top+.1,z-width*.44),(x,top+.1,z+width*.44),.11,10)
    for side in (-1,1):
        beam(D,'canvasShade',(x,top+1,z),(x,base+.2,z+side*width*.4),.028,5)
        beam(D,'canvasShade',(x,top+.1,z+side*width*.44),(x+.8,base-.5,z+side*width*.5),.023,5)
        for j in range(3):
            zz=side*(.35+j*.27)
            beam(D,'tar',(x,base+.1,zz+z),(x,base+.85,zz+z),.035,5)
    # Rope-lashed mast cap rather than an unarticulated pole.
    for yy in (base+.25,base+.4,base+.55):D.prism('canvasShade',(x,0,z),.23,.045,12,y0=yy)
# Rear lateen mizzen: the raked yard and narrow dark triangular cloth prevent
# the three-mast composition becoming a repetitive row of square signboards.
beam(D,'timber',(34,5.8,0),(34,21.6,0),.21,12)
beam(D,'woodDark',(22,10.7,0),(39,23,0),.15,10)
def lateen(u,v):
    a=(22.6,10.9,.12);b=(38.3,22.2,.12);c0=(35.7,10.3,.12)
    return tuple(a[k]*(1-u-v)+b[k]*u+c0[k]*v+(1.05*math.sin(math.pi*u)*math.sin(math.pi*v) if k==2 else 0) for k in range(3))
for row in range(10):
    for col in range(10-row):
        u,v=row/10,col/10
        D.tri('tarCloth',lateen(u,v),lateen(u+.1,v),lateen(u,v+.1))
        if row+col<9:D.tri('tarCloth',lateen(u+.1,v),lateen(u+.1,v+.1),lateen(u,v+.1))
for a,b in [((22.6,10.9,.13),(38.3,22.2,.13)),((38.3,22.2,.13),(35.7,10.3,.13)),((35.7,10.3,.13),(22.6,10.9,.13))]:beam(D,'canvasShade',a,b,.045,5)
for v in (.2,.4,.6):polyline(D,'canvasShade',[lateen(j/10*(1-v),v) for j in range(11)],.018,4)
beam(D,'canvasShade',(34,21,0),(39,5,11),.035,5)
beam(D,'canvasShade',(34,21,0),(39,5,-11),.035,5)
beam(D,'canvasShade',(-13,19.5,-2),(-46,5.3,0),.035,5)
beam(D,'canvasShade',(0,25.5,0),(-13,12.5,-2),.035,5)

# Long luffing pennant above the mast; solid flag fabric (no alpha pass).
beam(D,'timber',(0,15.8,0),(0,27,0),.14,10)
for i in range(8):
    a=i/8;b=(i+1)/8
    D.quad('tar',(a*5,26.5-a*.25,math.sin(a*6)*.4),(b*5,26.5-b*.25,math.sin(b*6)*.4),(b*4.8,25.3+b*.8,math.sin(b*6)*.4),(a*4.8,25.3+a*.8,math.sin(a*6)*.4))
# Fore stays and triangular jib explain the prow/mast relationship.
beam(D,'canvasShade',(-48,5.2,0),(-13,11.6,-2),.045,5)
D.tri('canvasShade',(-46,5.3,0),(-14,11,-2),(-25,5.5,-1))

D=c.detail

# Helmsman wheel is vertical, with carved spokes and pegs; mounted behind screen cover.
beam(D,'timber',(29,2.45,0),(29,4.25,0),.16,8)
for i in range(24):
    a=math.tau*i/24;b=math.tau*(i+1)/24
    beam(D,'brass',(29,4.05+.82*math.cos(a),.82*math.sin(a)),(29,4.05+.82*math.cos(b),.82*math.sin(b)),.065,5)
for i in range(10):
    a=math.tau*i/10;beam(D,'timber',(29,4.05,0),(29,4.05+1.03*math.cos(a),1.03*math.sin(a)),.045,5)
beam(D,'brass',(28.85,4.05,0),(29.15,4.05,0),.16,10)
# Hatch is closed and backed: slats never imply a fall-through hole.
for xx in (-3,-2.25,-1.5,-.75,0,.75,1.5,2.25,3):D.cbox('tar',[xx,1.415,0],[.12,.03,5.55])
for zz in (-2.5,-1.25,0,1.25,2.5):D.cbox('woodDark',[0,1.43,zz],[6.4,.035,.12])
for xx in (-2.8,2.8):
    for zz in (-2.5,2.5):ring(D,'brass',xx,1.46,zz,.12,.035,12)
# Deck rope coils, flush enough not to contradict collision; all detail batching.
for x,z in [(-18,14),(19,-14),(29,9)]:
    y=2.42 if x>22 else .025
    for radius in (.35,.45,.55,.65):ring(D,'canvasShade',x,y,z,radius,.05,18)

# Compass rose marquetry is flush with the existing walking surface. It gives
# central deck negative space a designed focal point without another blocker.
for i in range(16):
    a=i*math.tau/16;half=math.pi/16;r=2.1 if i%2==0 else 1.3
    tip=(5.8+r*math.cos(a),.022,r*math.sin(a))
    left=(5.8+.45*math.cos(a-half),.022,.45*math.sin(a-half))
    right=(5.8+.45*math.cos(a+half),.022,.45*math.sin(a+half))
    D.tri('brass' if i%2==0 else 'woodDark',(5.8,.022,0),left,tip)
    D.tri('woodDark' if i%2==0 else 'plank',(5.8,.022,0),tip,right)
ring(D,'woodDark',5.8,.022,0,2.26,.045,48)
ring(D,'brass',5.8,.023,0,.44,.055,24)
# Cast ship's bell and timber bracket are inset into the existing bow screen.
# Inspired by early-18th-century bronze bells; no reconstruction claim or text.
bellx=-23.5;belly=5.1;bellz=0
beam(D,'woodDark',(-23.65,5.75,-.9),(-23.65,5.75,.9),.13,8)
profile=[(0,.34),(.07,.36),(.13,.28),(.35,.23),(.55,.14),(.58,.09)]
for (yy,r),(ny,nr) in zip(profile,profile[1:]):
    for i in range(16):
        a=i*math.tau/16;b=(i+1)*math.tau/16
        D.quad('brass',(bellx+r*math.cos(a),belly+yy,bellz+r*math.sin(a)),(bellx+r*math.cos(b),belly+yy,bellz+r*math.sin(b)),(bellx+nr*math.cos(b),belly+ny,bellz+nr*math.sin(b)),(bellx+nr*math.cos(a),belly+ny,bellz+nr*math.sin(a)))
beam(D,'iron',(bellx,belly-.08,0),(bellx,belly+.18,0),.045,6)
polyline(D,'canvasShade',[(bellx,belly-.08,0),(bellx,4.8,.02),(bellx,4.65,.13)],.018,4)

# Bulkhead screens become joinery, glazed portholes and inset double doors.
for sign in (-1,1):
    x=sign*24;face=x-sign*.365
    for yy in (2.65,3.15,3.65,4.15,4.65,5.15,5.65):D.cbox('grain',[face,yy,0],[.035,.035,9.75])
    for zz in (-4.7,-2.3,2.3,4.7):
        bevelbox(D,'timber',[face-sign*.025,4.25,zz],[.1,3.65,.2],.03)
        for yy in (2.5,5.9):D.cbox('brass',[face-sign*.045,yy,zz],[.08,.14,.38])
    D.cbox('woodDark',[face-sign*.035,3.55,0],[.07,2.25,2.1])
    for zz in (-.52,.52):
        D.cbox('timber',[face-sign*.08,3.55,zz],[.04,2.05,.9])
        D.cbox('brass',[face-sign*.115,3.47,zz*.3],[.04,.19,.07])
    for zz in (-3.5,3.5):
        beam(D,'brass',(face,4.55,zz),(face-sign*.09,4.55,zz),.53,16)
        beam(D,'glass',(face-sign*.1,4.55,zz),(face-sign*.12,4.55,zz),.41,16)
        for j in range(8):
            a=math.tau*j/8;D.blob('iron',(face-sign*.13,4.55+.47*math.cos(a),zz+.47*math.sin(a)),.035)
    # Arched fanlight and raised panel joinery turn the broad gameplay screen
    # into a crafted cabin front. All relief hugs its established solid face.
    front=face-sign*.15
    for i in range(16):
        a=i*math.pi/16;b=(i+1)*math.pi/16
        D.tri('woodDark',(front,4.6,0),(front,4.6+1.0*math.sin(a),1.06*math.cos(a)),(front,4.6+1.0*math.sin(b),1.06*math.cos(b)))
        D.tri('glass',(front-sign*.016,4.67,0),(front-sign*.016,4.67+.77*math.sin(a),.85*math.cos(a)),(front-sign*.016,4.67+.77*math.sin(b),.85*math.cos(b)))
    polyline(D,'brass',[(front-sign*.035,4.6+1.03*math.sin(i*math.pi/20),1.1*math.cos(i*math.pi/20)) for i in range(21)],.055,6)
    for a in (math.pi/6,math.pi/3,math.pi/2,math.pi*2/3,math.pi*5/6):
        beam(D,'brass',(front-sign*.045,4.67,0),(front-sign*.045,4.67+.78*math.sin(a),.86*math.cos(a)),.025,5)
    D.cbox('brass',[front-sign*.04,4.65,0],[.04,.06,1.88])
    for zz in (-.52,.52):
        for yy in (3.08,3.91):
            D.cbox('woodDark',[front,yy,zz],[.04,.66,.7])
            for dy in (-.33,.33):D.cbox('woodLight',[front-sign*.025,yy+dy,zz],[.04,.055,.76])
            for dz in (-.37,.37):D.cbox('woodLight',[front-sign*.025,yy,zz+dz],[.04,.7,.055])
        for yy in (2.82,4.18):D.cbox('iron',[front-sign*.03,yy,zz+(.28 if zz>0 else -.28)],[.045,.065,.2])
    # Restrained carved scroll knees, with a leaf-tip highlight on the navy frame.
    for side in (-1,1):
        z0=side*4.55
        pts=[]
        for i in range(17):
            a=i*math.pi*1.6/16;r=.48*(1-i/24)
            pts.append((front,5.35+r*math.sin(a),z0+side*r*math.cos(a)))
        polyline(D,'brass',pts,.032,5)
        polyline(D,'woodLight',[(front,2.65,z0),(front,2.83,z0-side*.32),(front,3.12,z0-side*.2),(front,3.38,z0)],.055,5)
    # Layered cornice and compact lanterns frame the crafted cabin front.
    D.cbox('brass',[x,6.13,0],[.88,.14,10.8]);D.cbox('tar',[x,6.25,0],[1.1,.13,11.1])
    for side in (-1,1):lantern(D,face-sign*.2,4.7,side*4.4,.6)

# Rail carpentry: broad cap, inset navy panels, short turned stanchions and fairleads.
for side in (-1,1):
    z=side*17
    D.cbox('woodLight',[0,1.85,z],[64,.12,.68])
    for x in range(-30,31,3):
        D.cbox('timber',[x,.9,z-side*.29],[.23,1.8,.08])
        D.cbox('brass',[x,1.7,z-side*.3],[.33,.12,.1])
    # Recessed dado and delicate gilded inner bead add eye-level depth while
    # leaving the full 5 m broadside loops unobstructed.
    D.cbox('woodDark',[0,.19,z-side*.275],[43.7,.15,.045])
    D.cbox('brass',[0,1.61,z-side*.296],[43.7,.035,.028])
    for x in range(-18,19,6):
        for direction in (-1,1):
            D.quad('woodLight',(x,.3,z-side*.298),(x+direction*.11,.3,z-side*.298),(x+direction*.43,1.55,z-side*.298),(x+direction*.27,1.55,z-side*.298))
    for x in (-28,-20,-12,-4,4,12,20,28):
        # Metal eyes sit on the bulwark cap; not extra light sources.
        D.prism('iron',(x,0,z),.18,.12,8,y0=1.91)
# Carved relief at end rails, visible from approach rather than hidden on the rear.
for sign in (-1,1):
    x=sign*31.74
    for z in range(-15,16,3):
        D.cbox('timber',[x,2.9,z],[.035,1.8,.16])
    for yy in (2.5,3.8):D.cbox('brass',[x,yy,0],[.045,.075,33.8])

# Layered maritime background: no new lights, alpha effects, moving ship simulation or collision.
D.cbox('sea',[0,-6.05,0],[500,.05,500])
# Directional broken wave strokes vary length and curvature instead of parallel white noise.
for side in (-1,1):
    for i in range(55):
        x=(i*23%180)-90;z=side*(24+(i*31%120));length=2+i%7
        pts=[(x+j*length/4,-6.005+.015*math.sin(j),z+.4*math.sin(j*.8+i)) for j in range(5)]
        for a,b in zip(pts,pts[1:]):D.quad('foam' if i%4==0 else 'deepSea',a,b,(b[0],b[1],b[2]+.09),(a[0],a[1],a[2]+.09))
# Broken hull wake ribbons and blue troughs sit at sea level, well below play.
# Varied width, open ends and two interrupted bands avoid a neon outline.
for side in (-1,1):
    for k in range(7):
        x0=-39+k*11.4
        for band in (0,1):
            pts=[]
            for j in range(9):
                t=j/8;x=x0+t*7.4
                z=side*(20.5+band*1.4+.9*math.sin((x+35)/13))
                pts.append((x,-5.98+band*.005,z))
            for j,(a,b) in enumerate(zip(pts,pts[1:])):
                width=(.08+.19*math.sin(math.pi*(j+.5)/8))*(1 if not band else .5)
                D.quad('foam' if not band else 'deepSea',a,b,(b[0],b[1],b[2]+side*width),(a[0],a[1],a[2]+side*width))

# Sidelit island contours lift the horizon; low-poly silhouette deliberately kept background scale.
for x,z,w,h in [(-100,-130,38,20),(-45,-145,25,13),(95,-150,46,24),(145,105,35,16),(-120,105,40,20)]:
    D.tri('farRock',(x-w,-6,z),(x+w,-6,z),(x,h,z-9))
    D.tri('distant',(x+w,-6,z),(x+6,-6,z-28),(x,h,z-9))
# Distant brig is a hull-shaped silhouette, not a cube, with two staggered sails.
for x,z,s in [(64,-92,1),(-73,96,.55)]:
    shape=[(-18,0),(-13,-4),(12,-4.5),(17,-2),(17,2),(12,4.5),(-13,4)]
    for i,(xx,zz) in enumerate(shape):
        nx,nz=shape[(i+1)%len(shape)];D.quad('distant',(x+xx*s,-3,z+zz*s),(x+nx*s,-3,z+nz*s),(x+nx*s*.75,-5.7,z+nz*s*.7),(x+xx*s*.75,-5.7,z+zz*s*.7))
    for dx,h in [(0,18),(-9,13)]:
        beam(D,'distant',(x+dx*s,-3,z),(x+dx*s,h*s,z),.18*s,6)
        D.quad('canvasShade',(x+dx*s,h*s,z-7*s),(x+dx*s,h*s,z+7*s),(x+(dx+1)*s,(h-7)*s,z+6*s),(x+(dx+1)*s,(h-7)*s,z-6*s))

c.data['designNotes']=['Game-scaled fictional ship; not a historical reconstruction.','Both raised end decks have two 5m ramps.','Ropes and sail cloth are decorative; solid masts and cargo are authoritative collision.']

def crafted(m,o):
    x,y,z=o['position'];w,h,d=o['size'];id=o['id'];bottom=y-h/2
    if id=='stern_helm':
        # The wheel art stays in the detail batch; a core hidden inside its hub.
        m.cbox('brass',[29,4.05,0],[.2,.2,.2]); return True
    if id.startswith('cargo_crate_') or id.startswith('gun_breastwork_'):
        # Closed plank backing, recessed seams and iron lashings match solid collision.
        bevelbox(m,'woodDark',o['position'],o['size'],.075)
        for j in range(4):
            yy=bottom+(j+.5)*h/4
            for zz in (z-d/2+.055,z+d/2-.055):
                m.cbox('plank' if j%2 else 'timber',[x,yy,zz],[w-.06,h/4-.025,.065])
        for xx in (x-w*.34,x+w*.34):
            m.cbox('iron',[xx,y,z],[.1,h-.025,d-.015])
        m.cbox('woodLight',[x,bottom+h-.045,z],[w-.1,.08,d-.1])
        for side in (-1,1):
            xx=x+side*(w/2-.035)
            m.cbox('plank',[xx,y,z],[.055,h-.1,d-.11])
            for zz in (z-d*.35,z+d*.35):m.cbox('woodLight',[xx-side*.01,y,zz],[.06,h-.12,.14])
            # A broad cut brace sits on the face, rather than disappearing inside it.
            xf=x+side*(w/2-.004)
            m.quad('woodLight',(xf,bottom+.13,z-d*.39),(xf,bottom+.30,z-d*.39),(xf,bottom+h-.13,z+d*.39),(xf,bottom+h-.30,z+d*.39))
        for xx in (x-w*.34,x+w*.34):
            for zz in (z-d/2+.02,z+d/2-.02):
                for yy in (bottom+.2,bottom+h-.2):beam(m,'iron',(xx,yy,zz-.009),(xx,yy,zz+.009),.035,6)
        return True
    if id.startswith('upper_deck_'):
        # Planked upper deck; the gun deck sees a dark ceiling.
        m.cbox('woodDark',[x,y-.04,z],[w,h-.08,d])
        along_x=w>=d; W=d if along_x else w; n=max(2,int(W/.32))
        for j in range(n):
            t=-W/2+(j+.5)*W/n
            if along_x: m.cbox('deck' if j%4 else 'plank',[x,y+h/2-.04,z+t],[w,.08,W/n-.018])
            else: m.cbox('deck' if j%4 else 'plank',[x+t,y+h/2-.04,z],[W/n-.018,.08,d])
        return True
    if id.startswith('stair_coaming') or id.startswith('deck_cargo_') or id.startswith('water_casks_'):
        bevelbox(m,'timber' if 'coaming' in id else 'woodDark',o['position'],o['size'],.05)
        m.cbox('woodLight',[x,bottom+h-.04,z],[w-.02,.08,d-.02])
        if 'coaming' not in id:
            for k in (-.3,.3):
                m.cbox('iron',[x+k*w,y,z],[.06,h-.02,d+.0])
        return True
    if id.startswith('ship_boat_'):
        # Clinker-built boat upside down on its chocks: hull inside the cover box.
        m.cbox('woodDark',[x,bottom+.12,z],[w,.24,d])
        for k in range(5):
            t=k/4; ww=w*(.98-.12*abs(t-.5)); dd=d*(.95-.5*(t-.5)**2)
            m.cbox('woodLight' if k%2 else 'timber',[x,bottom+.24+(k+.5)*(h-.24)/5,z],[ww*(1-.25*t),(h-.24)/5,dd*(1-.45*t)])
        return True
    if id.startswith('raised_bulwark_'):
        bevelbox(m,'tar',o['position'],o['size'],.04)
        m.cbox('woodLight',[x,bottom+h-.06,z],[w-.02,.12,d-.01])
        for dx in (-4,-2,0,2,4):
            m.cbox('timber',[x+dx,y,z-((1 if z>0 else -1)*.21)],[.16,h-.12,.06])
        return True
    if id=='main_deck':
        # Crisp shaped edges, uninterrupted flush walking plane.
        bevelbox(m,'deck',o['position'],o['size'],.09);return True
    if id.endswith('_deck'):
        bevelbox(m,'timber',o['position'],o['size'],.06,top_material='deck');return True
    if '_mast' in id:
        m.prism('timber',(x,0,z),w/2,h,n=16,y0=bottom)
        for yy in range(1,int(h),2):m.prism('iron',(x,0,z),w/2,.1,n=16,y0=yy)
        return True
    if '_gun_' in id or id.startswith('gun_'):
        # The broad arena proxy is a gun station, NOT an impossibly wide carriage.
        # A compact naval truck carriage and closed side ammunition chests visibly
        # occupy that same safe footprint; no collision or route edits are needed.
        side=1 if z>0 else -1
        bevelbox(m,'woodDark',[x,bottom+.10,z],[w-.035,.20,d-.035],.035)
        bevelbox(m,'timber',[x,bottom+.30,z],[1.12,.19,d-.18],.045)
        # Six-point cheek silhouettes rise to the trunnion and step down at the
        # muzzle: actual longitudinal carriage anatomy, rather than two blocks.
        cheek=[(-d*.43,.22),(-d*.43,.64),(-d*.13,.91),(d*.25,.83),(d*.40,.45),(d*.40,.22)]
        for sign in (-1,1):
            inner=x+sign*.33;outer=x+sign*.51
            for i,(t,yy) in enumerate(cheek):
                nt,ny=cheek[(i+1)%len(cheek)]
                m.quad('timber',(inner,bottom+yy,z+t*side),(outer,bottom+yy,z+t*side),(outer,bottom+ny,z+nt*side),(inner,bottom+ny,z+nt*side))
            for face in (inner,outer):
                for i in range(1,len(cheek)-1):
                    m.tri('timber',(face,bottom+cheek[0][1],z+cheek[0][0]*side),(face,bottom+cheek[i][1],z+cheek[i][0]*side),(face,bottom+cheek[i+1][1],z+cheek[i+1][0]*side))
            for t in (-d*.31,d*.29):
                xx=x+sign*.57;zz=z+t*side
                beam(m,'woodDark',(xx-sign*.08,bottom+.29,zz),(xx+sign*.08,bottom+.29,zz),.22,10)
                beam(m,'iron',(xx+sign*.08,bottom+.29,zz),(xx+sign*.10,bottom+.29,zz),.09,6)
        cy=bottom+.98
        # Smooth turned iron profile, subtle reinforcement rings and a true deep
        # muzzle. Explicit radial normals remove the old polygonal toy appearance.
        family=(int(abs(x))+int(abs(z)))%3
        shoulder=(.216,.226,.211)[family]
        profile=[(-d*.38,.16),(-d*.32,shoulder),(-d*.19,shoulder-.012),(-d*.11,.195),(d*.03,.175),(d*.34,.143),(d*.425,.163),(d*.465,.163)]
        N=20;positions,normals,indices=m.tri_list('iron');uv=m.uvs.setdefault('iron',[]);base=len(positions)//3
        for row,(t,r) in enumerate(profile):
            left=profile[max(0,row-1)];right=profile[min(len(profile)-1,row+1)]
            slope=(right[1]-left[1])/(right[0]-left[0]);length=math.sqrt(1+slope*slope)
            for j in range(N+1):
                angle=math.tau*j/N;ca=math.cos(angle);sa=math.sin(angle)
                positions.extend((x+r*ca,cy+r*sa,z+t*side))
                normals.extend((ca/length,sa/length,-side*slope/length));uv.extend((j/N,t))
        for row in range(len(profile)-1):
            for j in range(N):
                lo=base+row*(N+1)+j;hi=lo+N+1
                indices.extend((lo,lo+1,hi+1,lo,hi+1,hi) if side>0 else (lo,hi,hi+1,lo,hi+1,lo+1))
        def gp(t,r,angle):return(x+r*math.cos(angle),cy+r*math.sin(angle),z+t*side)
        for j in range(N):
            a=math.tau*j/N;b=math.tau*(j+1)/N
            m.quad('iron',gp(d*.466,.163,a),gp(d*.466,.163,b),gp(d*.466,.101,b),gp(d*.466,.101,a))
            m.quad('tar',gp(d*.466,.101,a),gp(d*.466,.101,b),gp(d*.28,.101,b),gp(d*.28,.101,a))
            m.tri('tar',(x,cy,z+d*.279*side),gp(d*.28,.101,b),gp(d*.28,.101,a))
            m.tri('iron',(x,cy,z-d*.38*side),gp(-d*.38,.16,a),gp(-d*.38,.16,b))
            for t,r in [(-d*.29,shoulder+.009),(d*.42,.168)]:
                m.quad('iron',gp(t-.014,r,a),gp(t-.014,r,b),gp(t+.014,r,b),gp(t+.014,r,a))
        beam(m,'iron',(x,cy,z-d*.38*side),(x,cy,z-d*.44*side),.075,10)
        m.blob('iron',(x,cy,z-d*.44*side),.082)
        beam(m,'iron',(x-.54,cy-.05,z-d*.12*side),(x+.54,cy-.05,z-d*.12*side),.075,10)
        for dx in (-.42,.42):m.cbox('iron',[x+dx,cy-.025,z-d*.12*side],[.22,.065,.25])
        bevelbox(m,'timber',[x,bottom+.74,z-d*.26*side],[.29,.12,.28],.022)
        for sign in (-1,1):
            polyline(m,'woodDark',[(x+sign*.12,cy-.03,z-d*.41*side),(x+sign*.34,bottom+.47,z-d*.39*side),(x+sign*.48,bottom+.44,z-d*.13*side)],.035,5)
            # Closed powder/shot chest: deliberate solid cover, not an implied
            # walk-through gap at the old oversized cannon's proxy edges.
            xx=x+sign*(w/2-.45);cw=.78;ch=1.08
            bevelbox(m,'woodDark',[xx,bottom+ch/2+.08,z],[cw,ch,d-.07],.045)
            m.cbox('timber',[xx,bottom+1.17,z],[cw-.02,.1,d-.085])
            for t in (-d*.28,d*.28):
                m.cbox('iron',[xx,bottom+.64,z+t],[cw-.008,1.04,.045])
            for yy in (.34,.62,.90):
                m.cbox('timber',[xx+sign*(cw/2-.004),bottom+yy,z],[.006,.018,d-.13])
            m.cbox('brass',[xx,bottom+1.04,z-d*.467*side],[.11,.16,.025])
        return True
    if id=='cargo_bow':
        # Barrel cargo is backed by a real low packing case, so proxy gaps aren't deceptive.
        bevelbox(m,'woodDark',[x,bottom+.14,z],[w-.02,.28,d-.02],.06)
        # Closed rack infill sits behind curved staves: dark gaps are recesses, not shoot-through holes.
        m.cbox('woodDark',[x,bottom+1.2,z],[w-.44,2.4,d-.66])
        for dx in (-1.25,0,1.25):
            for dz in (-.78,.78):barrel(m,x+dx,bottom+.1,z+dz,.57,2.35)
        # A real draped cloth surface, not a cream box: taut crown, curved hems, folded corners.
        def tarp(u,v):
            return(x+(u-.5)*(w-.03),bottom+2.66+.10*math.sin(math.pi*u)*math.sin(math.pi*v)+.025*math.cos(u*math.tau*3),z+(v-.5)*(d-.03))
        for j in range(8):
            for i in range(12):m.quad('canvas',tarp(i/12,j/8),tarp((i+1)/12,j/8),tarp((i+1)/12,(j+1)/8),tarp(i/12,(j+1)/8))
        for side in (0,1):
            for i in range(24):
                a=tarp(i/24,side);b=tarp((i+1)/24,side)
                def hem(t):return bottom+2.18+.045*math.cos(t*math.tau*3)+.025*math.sin(t*math.tau)
                lowa=(a[0],hem(i/24),a[2]);lowb=(b[0],hem((i+1)/24),b[2])
                m.quad('canvas',a,b,lowb,lowa)
                beam(m,'canvasShade',lowa,lowb,.013,4)
            for i in range(16):
                a=tarp(side,i/16);b=tarp(side,(i+1)/16)
                lowa=(a[0],bottom+2.17+.04*math.cos(i*math.tau/8),a[2]);lowb=(b[0],bottom+2.17+.04*math.cos((i+1)*math.tau/8),b[2])
                m.quad('canvas',a,b,lowb,lowa)
                # X-side cloth hem remains within the original cargo box.

        for dx in (-1.25,0,1.25):
            for zz in (z-d/2+.045,z+d/2-.045):beam(m,'canvasShade',(x+dx,bottom+1.9,zz),(x+dx,bottom+2.72,zz),.028,5)
            beam(m,'canvasShade',(x+dx,bottom+2.745,z-d/2+.06),(x+dx,bottom+2.745,z+d/2-.06),.03,5)
        return True
    if id=='cargo_stern':
        bevelbox(m,'woodDark',o['position'],o['size'],.10)
        for yy,hh in [(bottom+.75,1.4),(bottom+2.25,1.4)]:
            for dx in (-1.0,1.0):
                for zz in (z-d/2+.065,z+d/2-.065):
                    bevelbox(m,'timber',[x+dx,yy,zz],[1.9,hh,.04],.006)
                    for i in range(4):m.cbox('grain',[x+dx-.72+i*.48,yy,zz],[.018,hh-.06,.048])
                    for yyy in (yy-hh/2+.07,yy+hh/2-.07):m.cbox('woodLight',[x+dx,yyy,zz],[1.86,.12,.049])
                    beam(m,'plank',(x+dx-.83,yy-hh/2+.17,zz),(x+dx+.83,yy+hh/2-.17,zz),.05,4)
        for xx in (x-w/2+.08,x+w/2-.08):
            for zz in (z-d/2+.08,z+d/2-.08):m.cbox('brass',[xx,y,zz],[.14,h-.08,.14])
        return True
    if id.startswith('bulwark_') or id.startswith('end_bulwark_') or id.endswith('_screen'):
        bevelbox(m,'tar',o['position'],o['size'],.04);return True
    if id=='hatch_coaming':
        bevelbox(m,'timber',o['position'],o['size'],.10);return True
    return False

# Lantern light: hung from both masts above head height, plus every carved lantern.
for x,z,side in [(0,0,1),(0,0,-1),(-13,-2,1),(-13,-2,-1)]:
    beam(D,'brass',(x,4.9,z+side*.4),(x,4.9,z+side*.95),.03,4)
    lantern(D,x,4.25,z+side*.95,.55)
# 2026-10-29 two-deck dressing: upper rail cap and stanchions, ceiling beams over the
# gun deck (above head height) and small lamps hung from them.
D=c.detail
for zs in (-1,1):
    D.cbox('woodLight',[0,4.25,zs*17],[44,.1,.66])
    for x in range(-21,22,3):
        D.cbox('timber',[x,3.3,zs*16.72],[.2,1.8,.06])
for x in range(-21,22,3):
    if -13<=x<=-7 or 7<=x<=13: continue
    D.cbox('woodDark',[x,2.03,0],[.22,.14,33.4])
for x,z in [(-16,-6),(-16,6),(-4,-12),(-4,12),(4,-12),(4,12),(16,-6),(16,6),(-10,-10),(10,10)]:
    lantern(D,x,1.77,z,.34)
c.data['presentation'].update(
    glows=[[round(x,3),round(y,3),round(z,3),round(1.7*s,2),'#ffd08a',.3] for x,y,z,s in LANTERNS],
    pools=[[round(x,3),2.4 if (abs(x)>22 or y>2.5) else 1.43 if abs(x)<3.5 and abs(z)<3 else 0,round(z,3),2.2,'#ffb36a',.35] for x,y,z,s in LANTERNS if y<6])
c.save(render_object=crafted)
