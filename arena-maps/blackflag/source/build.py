"""BLACKFLAG: authored ship arena using the mesh kit and original Pillow-painted surfaces.
Run from any directory: python3 arena-maps/blackflag/source/build.py
"""
from pathlib import Path
import sys, math
from surfaces import painted_surfaces
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'_lib'))
from chapterkit import Chapter, mat, beam, ring, flag, box_edges, bevelbox, hiproof

P=dict(timber=mat('#9b623a'), deck=mat('#c29662'), plank=mat('#ad7c4d'), grain=mat('#805738'),
       tar=mat('#303a43'), iron=mat('#505d63',.5,.65), brass=mat('#d5ae65',.6,.5),
       canvas=mat('#e7d8b6'), canvasShade=mat('#c2ad8a'), teal=mat('#4c9b9c'), red=mat('#b95d4e'),
       sea=mat('#397c89',.1,.4), foam=mat('#81bdc4'), glass=mat('#8fc4be',.15,.4,.12), distant=mat('#697e9b'), blackSail=mat('#ffffff'), woodLight=mat('#be925a'),
       woodDark=mat('#654229'), lamp=mat('#ffe2a0',0,.65,.55), deepSea=mat('#285b70'), farRock=mat('#6c97a4'))
c=Chapter(ROOT,'blackflag','BLACKFLAG 黑帆战舰',64,34,'seabreeze',P); D=c.detail
# A broad 64 x 34m game-scaled deck: no obligatory gangplanks or jump gaps.
c.box('main_deck',[0,-.45,0],[64,.9,34],'deck','floor')
for z in (-17,17): c.box('bulwark_'+str(z),[0,.9,z],[64,1.8,.5],'tar','structure')
# Raised decks need their own continuous 1.8m side protection.
for x in (-27,27):
    for z in (-17,17): c.box(f'raised_bulwark_{x}_{z}',[x,3,z],[10,2.4,.5],'tar','structure')
for x in (-32,32): c.box('end_bulwark_'+str(x),[x,2,0],[.5,4,34],'tar','structure')
for sign,tag,team in [(-1,'bow','west'),(1,'stern','east')]:
    c.box(tag+'_deck',[sign*27,1.2,0],[10,2.4,33.5],'timber','floor')
    c.box(tag+'_screen',[sign*24,4.25,0],[.7,3.7,10],'tar','structure')
    for z in (-10,10): c.ramp(tag+'_ramp_'+str(z),[sign*19,0,z],[6,2.4,5],'x',-sign,'deck')
    for i,z in enumerate((-2,2)):
        c.anchor(f'spawn_{team}_{i}','spawn',[sign*28,2.4,z],yaw=-sign*1.5708,team=team)
    c.anchor('cover_'+tag,'cover',[sign*26,2.4,0],height=3.7)
    for z in (-14,14):
        c.box(tag+'_gun_'+str(z),[sign*26,3.05,z],[3.2,1.3,1.6],'timber')
    c.box(tag+'_team_mark',[sign*30,2.425,0],[1.2,.05,4],'teal' if sign<0 else 'red','wayfinding',False)
# Ship anatomy is collision, not a render-only shell. Wide loops surround two staggered cover islands.
c.box('hatch_coaming',[0,.7,0],[7,1.4,6],'timber')
c.box('main_mast',[0,8,0],[.9,16,.9],'timber','structure')
c.box('fore_mast',[-13,6,-2],[.7,12,.7],'timber','structure')
c.box('cargo_bow',[-9,1.4,4],[4,2.8,3],'canvas')
c.box('cargo_stern',[10,1.5,-4],[4,3,3],'timber')
for x,z in [(-11,-13),(9,13),(-3,13),(3,-13)]:
    c.box(f'gun_{x}_{z}',[x,.65,z],[3.4,1.3,1.8],'timber')
# Staggered middeck packing islands break up empty exposed approaches without
# narrowing the two 5m-wide broadside loops or blocking cross-deck connections.
c.box('cargo_crate_fore',[-8.5,.9,-1.1],[3,1.8,2.6],'timber')
c.box('cargo_crate_aft',[9,.95,2],[3.4,1.9,2.5],'timber')
for x,z in [(3,-14.8),(-3,14.8)]:
    c.box(f'gun_breastwork_{x}',[x,.9,z],[6,1.8,.9],'timber')
for name,pos,h in [('fore',[-8.5,0,-3.6],1.8),('aft',[9,0,4.5],1.9),('port_battery',[6.8,0,-13],1.8)]:
    c.anchor('cover_added_'+name,'cover',pos,height=h)
for n,p in [('cargo_bow',[-11.8,0,4]),('cargo_stern',[12.8,0,-4]),('hatch_n',[0,0,-4]),('hatch_s',[0,0,4])]: c.anchor('cover_'+n,'cover',p,height=1.4)
c.anchor('objective_deck','objective',[4.8,0,0],radius=2)
c.route('port_loop',[[-28,2.4,-2],[-28,2.4,-10],[-23,2.4,-10],[-15,0,-10],[15,0,-10],[23,2.4,-10],[28,2.4,-10],[28,2.4,-2]])
c.route('starboard_loop',[[-28,2.4,2],[-28,2.4,10],[-23,2.4,10],[-15,0,10],[15,0,10],[23,2.4,10],[28,2.4,10],[28,2.4,2]])
c.route('deck_breach',[[-15,0,-10],[-7,0,-8],[-5,0,-4],[5,0,-4],[6,0,5],[15,0,8],[15,0,10]])
c.route('cross_deck',[[-15,0,-10],[-15,0,10],[-5,0,10],[-5,0,4],[5,0,4],[5,0,10],[15,0,10],[15,0,-10]])
# Shared texture exporter embeds original paintings and per-face UVs; no URI fetches.
tex=painted_surfaces()
for name in ('timber','deck','plank','grain','tar','woodLight','woodDark'):
    c.textures[name]=dict(baseColor=tex/'oak_basecolor.png',orm=tex/'oak_orm.png',scale=.125)
for name in ('canvas','canvasShade'):
    c.textures[name]=dict(baseColor=tex/'canvas_basecolor.png',orm=tex/'canvas_orm.png',scale=.5)
c.textures['blackSail']=dict(baseColor=tex/'blackflag_sail_basecolor.png',orm=tex/'canvas_orm.png')
for name in ('iron','brass'):c.textures[name]=dict(orm=tex/'metal_orm.png',scale=.5)

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

def lantern(m,x,y,z,scale=1):
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

# Raised quarterdeck / stern gallery: layered carved transom, window bays and curved roof.
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
    # Ramp-edge brass strips are only 1cm above the authoritative slopes.
    for z in (-12.38,-7.62,7.62,12.38):
        beam(D,'woodDark',(sign*16,.015,z),(sign*22,2.415,z),.045,4)

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
            beam(D,'canvasShade',(x+off,h-1,z),(x+3+off,.95,side*16.95),.035,5)
        for step in range(3,13):
            t=step/14
            yy=(h-1)*(1-t)+.95*t;zz=z*(1-t)+side*16.95*t
            beam(D,'grain',(x+3*t,yy,zz),(x+1.3+3*t,yy,zz),.019,4)
    beam(D,'canvasShade',(x,h-.7,z-w/2),(x+2.2,3.2,z-w*.62),.034,5)
    beam(D,'canvasShade',(x,h-.7,z+w/2),(x+2.2,3.2,z+w*.62),.034,5)
# Long luffing pennant above the mast; solid flag fabric (no alpha pass).
beam(D,'timber',(0,15.8,0),(0,19,0),.09,7)
for i in range(8):
    a=i/8;b=(i+1)/8
    D.quad('tar',(a*5,18.5-a*.25,math.sin(a*6)*.4),(b*5,18.5-b*.25,math.sin(b*6)*.4),(b*4.8,17.3+b*.8,math.sin(b*6)*.4),(a*4.8,17.3+a*.8,math.sin(a*6)*.4))
# Fore stays and triangular jib explain the prow/mast relationship.
beam(D,'canvasShade',(-48,5.2,0),(-13,11.6,-2),.045,5)
D.tri('canvasShade',(-46,5.3,0),(-14,11,-2),(-25,5.5,-1))

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
    # Cornice and original crossing blades flank the door as a focal arch.
    D.cbox('brass',[x,6.13,0],[.88,.14,10.8]);D.cbox('tar',[x,6.25,0],[1.1,.13,11.1])
    for side in (-1,1):lantern(D,face-sign*.2,4.7,side*4.4,.6)

# Rail carpentry: broad cap, inset navy panels, short turned stanchions and fairleads.
for side in (-1,1):
    z=side*17
    D.cbox('woodLight',[0,1.85,z],[64,.12,.68])
    for x in range(-30,31,3):
        D.cbox('timber',[x,.9,z-side*.29],[.23,1.8,.08])
        D.cbox('brass',[x,1.7,z-side*.3],[.33,.12,.1])
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
    if id.startswith('cargo_crate_') or id.startswith('gun_breastwork_'):
        # Closed plank backing, recessed seams and iron lashings match solid collision.
        bevelbox(m,'woodDark',o['position'],o['size'],.075)
        for j in range(4):
            yy=bottom+(j+.5)*h/4
            for zz in (z-d/2+.035,z+d/2-.035):
                m.cbox('plank' if j%2 else 'timber',[x,yy,zz],[w-.06,h/4-.025,.065])
        for xx in (x-w*.34,x+w*.34):
            m.cbox('iron',[xx,y,z],[.1,h-.025,d-.015])
        m.cbox('woodLight',[x,bottom+h-.045,z],[w-.1,.08,d-.1])
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
        # Real trucks, axle hubs, stepped cheek pieces, tapered bore and breech fittings.
        side=1 if z>0 else -1
        bevelbox(m,'woodDark',[x,bottom+.36,z],[w-.18,.2,d-.18],.05)
        for xx in (x-w/2+.32,x+w/2-.32):
            bevelbox(m,'timber',[xx,bottom+.62,z],[.28,.72,d-.22],.07)
            for zz in (z-d/2+.33,z+d/2-.33):
                beam(m,'tar',(xx-.14,bottom+.29,zz),(xx+.14,bottom+.29,zz),.27,14)
                beam(m,'brass',(xx-.155,bottom+.29,zz),(xx+.155,bottom+.29,zz),.085,10)
        # Barrel points broadside and remains fully within its cover proxy.
        cy=bottom+1.03
        for j in range(16):
            a=math.tau*j/16;b=math.tau*(j+1)/16
            def point(t,r,angle):return(x+r*math.cos(angle),cy+r*math.sin(angle),z+t*side)
            sections=[(-d*.34,.25),(-d*.2,.27),(d*.1,.22),(d*.40,.19)]
            for (t,r),(nt,nr) in zip(sections,sections[1:]):m.quad('iron',point(t,r,a),point(t,r,b),point(nt,nr,b),point(nt,nr,a))
            m.quad('brass',point(d*.40,.22,a),point(d*.40,.22,b),point(d*.435,.22,b),point(d*.435,.22,a))
            m.quad('iron',point(d*.438,.22,a),point(d*.438,.22,b),point(d*.438,.135,b),point(d*.438,.135,a))
            m.quad('tar',point(d*.438,.135,a),point(d*.438,.135,b),point(d*.25,.135,b),point(d*.25,.135,a))
            m.tri('tar',(x,cy,z+d*.24*side),point(d*.25,.135,b),point(d*.25,.135,a))
        beam(m,'brass',(x,cy,z-d*.34*side),(x,cy,z-d*.42*side),.13,12)
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
            for i in range(12):
                a=tarp(i/12,side);b=tarp((i+1)/12,side)
                lowa=(a[0],bottom+2.13+.10*math.cos(i*math.pi/2),a[2]);lowb=(b[0],bottom+2.13+.10*math.cos((i+1)*math.pi/2),b[2])
                m.quad('canvas',a,b,lowb,lowa)
                beam(m,'canvasShade',lowa,lowb,.013,4)
            for i in range(8):
                a=tarp(side,i/8);b=tarp(side,(i+1)/8)
                lowa=(a[0],bottom+2.13+.10*math.cos(i*math.pi/2),a[2]);lowb=(b[0],bottom+2.13+.10*math.cos((i+1)*math.pi/2),b[2])
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

c.save(render_object=crafted)
