"""FROSTCOURT: snow over a pale ceremonial court; intentional anime fiction.
Run: python3 arena-maps/frostcourt/source/build.py
"""
from pathlib import Path
import sys, math, random
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT.parent/'_lib'))
from chapterkit import Chapter, mat, beam, flag, mountain, bevelbox, hiproof
P=dict(stone=mat('#a9b0b8'), limestone=mat('#d9d4c7'), stoneLight=mat('#c1c4c8'), stoneDark=mat('#909aa8'),
    pavement=mat('#8e9bab'), pavementAlt=mat('#99a5b2'), pavementWarm=mat('#a6abb1'), joint=mat('#68788c'),
    snow=mat('#eef0f3'), snowShade=mat('#cdd9e7'), snowBlue=mat('#bccddd'), slate=mat('#425870'), slateLight=mat('#566d83'),
    iron=mat('#344455',.5,.55), ironEdge=mat('#66778a',.45,.45), timber=mat('#6c4e3d'), timberLight=mat('#977354'), timberDark=mat('#4d3b33'),
    canvas=mat('#b8af99'), canvasLight=mat('#cec3a8'), canvasShade=mat('#8f938f'), rope=mat('#8d816c'),
    blue=mat('#365578'), blueLight=mat('#4a698d'), gold=mat('#bda06b',.62,.42), ice=mat('#8bb8cc',.12,.34), iceLight=mat('#c0dce5',.08,.28),
    window=mat('#45617e',.1,.36), windowLight=mat('#7b9ab2',.1,.4), amber=mat('#d8a66c',.15,.58,.08), distant=mat('#9baac1'), winterNeedle=mat('#526773'), winterNeedleLight=mat('#6d828b'))
c=Chapter(ROOT,'frostcourt','FROSTCOURT 永冬庭院',60,48,'snowcourt',P); D=c.detail
c.box('court_floor',[0,-.3,0],[60,.6,48],'snow','floor')
for x in (-30,30): c.box('boundary_x_'+str(x),[x,2.5,0],[.6,5,48],'limestone','structure')
for z in (-24,24): c.box('boundary_z_'+str(z),[0,2.5 if z<0 else 1.4,z],[60,5 if z<0 else 2.8,.6],'limestone','structure')
for side,team in [(-1,'west'),(1,'east')]:
    c.box('spawn_screen_'+team,[side*24,1.7,0],[.65,3.4,10],'limestone','structure')
    for i,z in enumerate((-2,2)): c.anchor(f'spawn_{team}_{i}','spawn',[side*27.5,0,z],yaw=-side*1.5708,team=team)
    c.box('spawn_mark_'+team,[side*28,.025,0],[1.4,.05,5],'blue' if side<0 else 'amber','wayfinding',False)
    c.anchor('cover_screen_'+team,'cover',[side*26,0,0],height=3.4)
# A single roofed northern arcade contrasts an open southern park-edge route.
c.box('arcade_terrace',[0,.65,-18],[38,1.3,8],'stone','floor')
for side in (-1,1): c.ramp('terrace_ramp_'+str(side),[side*22,0,-18],[6,1.3,5],'x',side,'pavement')
c.box('arcade_roof',[0,5.8,-18],[40,.5,9],'slate','roof')
for x in (-18,-9,0,9,18):
    for z in (-21.5,-14.5): c.box(f'arcade_pier_{x}_{z}',[x,3.45,z],[.8,4.3,.8],'limestone','structure')
c.anchor('objective_arcade','objective',[0,1.3,-18],radius=2)
# Fountain is a real occluder, with a frozen basin visually distinguishing its silhouette.
c.box('fountain_plinth',[0,.85,0],[6,1.7,6],'limestone')
c.box('fountain_column',[0,2.7,0],[1.8,3.7,1.8],'stone','structure')
for side in (-1,1):
    c.box('supply_wagon_'+str(side),[side*13,1.3,side*5],[4,2.6,2.6],'timber')
    c.box('park_low_wall_'+str(side),[side*10,.75,14],[8,1.5,.7],'stone')
    c.box('park_gatepost_'+str(side),[side*4,1.1,14],[1.2,2.2,1.2],'limestone')
    c.anchor('cover_wagon_'+str(side),'cover',[side*13,0,side*8],height=2.6)
    c.anchor('cover_park_'+str(side),'cover',[side*10,0,16],height=1.5)
    c.anchor('cover_fountain_'+str(side),'cover',[side*4.2,0,0],height=1.7)
c.anchor('objective_fountain','objective',[0,0,5],radius=2)
c.route('covered_arcade',[[-27.5,0,-2],[-27.5,0,-18],[-25.5,0,-18],[-18,1.3,-18],[18,1.3,-18],[25.5,0,-18],[27.5,0,-18],[27.5,0,-2]])
c.route('park_loop',[[-27.5,0,2],[-27.5,0,10],[-20,0,18],[0,0,18],[20,0,18],[27.5,0,10],[27.5,0,2]])
c.route('fountain_breach',[[-22,0,-8],[-15,0,-10],[-6,0,-8],[6,0,-8],[20,0,-8],[22,0,0],[22,0,8],[7,0,9],[0,0,7],[-7,0,9],[-20,0,8],[-22,0,0],[-22,0,-8]])
c.route('arcade_to_park',[[4.5,1.3,-18],[19.5,1.3,-18],[26,0,-18],[26,0,-8],[20,0,-8],[20,0,9],[17,0,18]])
# Local sculptural helpers: all small craft stays in one material-batched detail mesh.
rng=random.Random(1764)
def ribbon(m,material,a,b,width=.025):
    # Surface crack/grain stroke on horizontal paving/ice.
    dx,dz=b[0]-a[0],b[2]-a[2]; le=math.hypot(dx,dz) or 1; ox,oz=-dz/le*width/2,dx/le*width/2
    m.quad(material,(a[0]+ox,a[1],a[2]+oz),(b[0]+ox,b[1],b[2]+oz),(b[0]-ox,b[1],b[2]-oz),(a[0]-ox,a[1],a[2]-oz))
def lathe(m, material, x,z, profile,n=24):
    for (r0,y0),(r1,y1) in zip(profile,profile[1:]):
        for i in range(n):
            a,b=math.tau*i/n,math.tau*(i+1)/n
            m.quad(material,(x+r0*math.cos(a),y0,z+r0*math.sin(a)),(x+r1*math.cos(a),y1,z+r1*math.sin(a)),
                (x+r1*math.cos(b),y1,z+r1*math.sin(b)),(x+r0*math.cos(b),y0,z+r0*math.sin(b)))
def snowline(m, x0,x1,y,z,depth=.45,seed=0):
    rr=random.Random(seed); steps=max(3,int((x1-x0)/.65)); pts=[]
    for i in range(steps+1):
        x=x0+(x1-x0)*i/steps; pts.append((x,y+rr.uniform(-.025,.03),z+rr.uniform(-.10,.07)))
    for a,b in zip(pts,pts[1:]):
        m.quad('snow',a,b,(b[0],y+.09,z+depth),(a[0],y+.09,z+depth))
        m.quad('snowShade',(a[0],a[1]-.065,a[2]),(b[0],b[1]-.065,b[2]),b,a)
def arched_band(m,cx,z,depth,spring,rx,ry,thick=.28,n=14):
    # Extruded elliptical stone voussoirs, with tiny dark separation instead of flat Y-braces.
    for i in range(n):
        a=math.pi*i/n+.008; b=math.pi*(i+1)/n-.008
        p=lambda t,outer,zz:(cx+(rx+(thick if outer else 0))*math.cos(t),spring+(ry+(thick if outer else 0))*math.sin(t),zz)
        front,back=z-depth/2,z+depth/2
        material='limestone' if i%4 else 'stoneLight'
        m.quad(material,p(a,False,front),p(b,False,front),p(b,True,front),p(a,True,front))
        m.quad(material,p(a,True,back),p(b,True,back),p(b,False,back),p(a,False,back))
        m.quad('stone',p(a,False,back),p(b,False,back),p(b,False,front),p(a,False,front))
        m.quad(material,p(a,True,front),p(b,True,front),p(b,True,back),p(a,True,back))
        for t in (a,b): m.quad(material,p(t,False,front),p(t,True,front),p(t,True,back),p(t,False,back))

def snow_hip(x0,x1,z0,z1,eave,ridge,seed):
    """Continuous thin hipped cap, with sculpted drift fringe and exposed tile border."""
    hiproof(D,'slate',x0,x1,z0,z1,eave,ridge)
    # A single welded-by-position hip surface avoids intersecting snow sheets at roof ends.
    hiproof(D,'snow',x0+.38,x1-.38,z0+.38,z1-.38,eave+.26,ridge+.14)
    rr=random.Random(seed)
    if x1-x0>z1-z0:
        class Swap:
            def quad(self,mat,*pts): D.quad(mat,*[(p[2],p[1],p[0]) for p in reversed(pts)])
        target=Swap();x0,x1,z0,z1=z0,z1,x0,x1
    else: target=D
    half=(x1-x0)/2
    for sign in (-1,1):
        edge=x0 if sign<0 else x1
        # Restrict the fringe to the planar side slope between the hip seams.
        start=z0+half*.75;end=z1-half*.75;n=28;prev=None
        for i in range(n+1):
            z=start+(end-start)*i/n;amount=.26+.055*math.sin(i*.8)+rr.uniform(-.025,.025)
            low=(edge-sign*amount,eave+.26+(amount-.38)*(ridge-eave)/half,z)
            top=(edge-sign*.60,eave+.26+.22*(ridge-eave)/half+.012,z)
            if prev:
                a,b=prev;target.quad('snow',a,low,top,b)
                target.quad('snowShade',(a[0],a[1]-.075,a[2]),(low[0],low[1]-.075,low[2]),low,a)
            prev=(low,top)
        for j in range(28):
            z=z0+(z1-z0)*j/28;zb=z0+(z1-z0)*(j+1)/28-.025
            xx=edge-sign*.18;yy=eave+(ridge-eave)*.18/half+.012
            target.quad('slateLight' if j%4==0 else 'slate',(edge,eave+.01,z),(edge,eave+.01,zb),(xx,yy,zb),(xx,yy,z))

# Cleared limestone paving. Small deterministic colour/joint variation survives runtime cel/PBR.
for x in range(-26,27,2):
    for z in range(-10,11,2):
        if abs(x)<4 and abs(z)<4: continue
        material=rng.choices(['pavement','pavementAlt','pavementWarm'],[8,3,1])[0]
        D.cbox(material,[x,.012,z],[1.97,.022,1.97])
        if rng.random()<.11:
            ribbon(D,'stoneDark',(x-.8,.027,z-.6),(x-.2,.028,z+.4),.016)
for x in range(-18,19,2): D.cbox('pavement',[x,1.308,-18],[1.97,.014,6.8])
for x in range(-20,21,2): D.cbox('snowShade',[x,.008,18],[1.95,.012,3.2])
# Two thin formal inlay bands frame the circulation without creating collision or extra routes.
for z in (-11.5,11.5):
    D.cbox('stoneLight',[0,.021,z],[47,.018,.34])
    for x in range(-22,23,2): D.cbox('joint',[x,.032,z],[.055,.012,.34])
# Palace side wings and central risalit: cornice/pediment replace the old blank billboard.
D.cbox('limestone',[34,5.45,0],[7,10.9,38])
D.cbox('stone',[34,.65,0],[7.15,1.3,38.15])
for y,w,h in ((5.25,7.25,.17),(5.55,7.5,.22),(10.35,7.15,.18),(10.65,7.6,.25),(10.91,8,.18)):
    D.cbox('stoneLight',[34,y,0],[w,h,38.6])
snow_hip(29.7,38.3,-19.7,19.7,11.05,13.9,35)
# Central front projects in relief but remains behind the established screen/court edge.
D.cbox('limestone',[32.8,5.4,0],[7.5,10.8,13.7])
for y in (.4,5.25,10.2): D.cbox('stoneLight',[28.98,y,0],[.25,.27,14.2])
for y,w,h in ((9.92,14.3,.18),(10.17,14.65,.24),(10.47,15,.22)):
    D.cbox('stoneLight',[28.9,y,0],[.6,h,w])
# Closed triangular tympanum with real depth; pediment has moulded, sloping raking cornices.
for xx in (28.9,29.6): D.tri('limestone',(xx,10.6,-7.5),(xx,10.6,7.5),(xx,13.2,0))
for side in (-1,1):
    beam(D,'stoneLight',(28.7,10.6,side*7.65),(28.7,13.33,0),.16,4)
    beam(D,'snow',(28.68,10.78,side*7.65),(28.68,13.48,0),.095,5)
D.cbox('stone',[28.72,10.72,0],[.24,.16,15.2])
# Restrained sunburst crest: geometric fictional emblem, not a historical insignia.
beam(D,'blue',(28.67,11.56,0),(28.55,11.56,0),.60,24)
beam(D,'gold',(28.52,11.56,0),(28.48,11.56,0),.30,12)
for i in range(12):
    a=math.tau*i/12
    beam(D,'gold',(28.47,11.56+.72*math.cos(a),.72*math.sin(a)),(28.47,11.56+.94*math.cos(a),.94*math.sin(a)),.027,4)
# Recessed windows read as layered glass, deep reveal, sash and carved lintel at eye height.
def window_face(x,y,z,sign=1,width=1.8,height=2.35,lit=False):
    D.cbox('stoneDark',[x,y,z],[.08,height+.44,width+.45])
    D.cbox('iron',[x-sign*.055,y,z],[.055,height+.10,width+.1])
    D.cbox('amber' if lit else 'window',[x-sign*.09,y,z],[.025,height,width])
    # Desaturated sky reflected in upper panes, no false hole through collision wall.
    D.cbox('windowLight',[x-sign*.11,y+height*.23,z-width*.24],[.015,height*.42,width*.44])
    for zz in (z-width/2-.16,z+width/2+.16): D.cbox('limestone',[x-sign*.20,y,zz],[.24,height+.6,.22])
    for yy in (y-height/2-.20,y+height/2+.20): D.cbox('stoneLight',[x-sign*.24,yy,z],[.38,.22,width+.78])
    D.cbox('limestone',[x-sign*.15,y,z],[.11,height,.075])
    D.cbox('limestone',[x-sign*.15,y+.06,z],[.11,.075,width])
    D.cbox('stone',[x-sign*.28,y-height/2-.34,z],[.5,.10,width+.87])
    D.cbox('snow',[x-sign*.25,y+height/2+.35,z],[.4,.09,width+.72])
for z in (-16,-11,11,16):
    for y in (3,8): window_face(30.45,y,z,1)
    for y in (3,8): window_face(37.56,y,z,-1,lit=(z==11 and y==3))
for z in (-4.6,0,4.6): window_face(28.99,7.7,z,1,1.6,2.1)
# Double portal in a shadowed surround; actual filled panels preserve the boundary solidity.
D.cbox('stoneDark',[28.99,2.2,0],[.06,4.4,4.85])
for z in (-1.1,1.1):
    D.cbox('blue',[28.92,2.1,z],[.09,4.1,2.12])
    for yy in (.82,2.17,3.52):
        D.cbox('gold',[28.86,yy,z],[.025,1.05,1.65]);D.cbox('blue',[28.83,yy,z],[.025,.94,1.52])
    beam(D,'gold',(28.79,1.7,z/5),(28.79,2.15,z/5),.035,6)
for z in (-2.6,2.6):
    D.cbox('limestone',[28.78,2.35,z],[.5,4.7,.48]);D.cbox('stoneLight',[28.7,.3,z],[.72,.6,.74])
D.cbox('stoneLight',[28.68,4.65,0],[.75,.25,5.9]);D.cbox('snow',[28.68,4.83,0],[.75,.11,5.95])
# Slender engaged Ionic-inspired shafts are fictional, proportioned around the portal.
for z in (-6.2,-3.4,3.4,6.2):
    lathe(D,'limestone',28.73,z,[(.4,.35),(.4,.52),(.29,.65),(.26,4.7),(.37,4.85),(.42,5.0)],16)
    D.cbox('stoneLight',[28.73,.25,z],[.9,.5,.9]);D.cbox('stoneLight',[28.73,5.1,z],[.95,.18,.95])
for z in (-18.7,-8.1,8.1,18.7):
    D.cbox('limestone',[30.28,5.1,z],[.42,10.2,.65])
    for y in (.4,5.55,10.4): D.cbox('stoneLight',[30.2,y,z],[.65,.25,1.05])
# A handful of dressed quoins, not blanket ornamental noise.
for z in (-18.7,18.7):
    for y in [1.3+i*.65 for i in range(14)]: D.cbox('stoneLight',[30.2,y,z],[.45,.56,.9 if int(y*10)%2 else .7])
# Narrow upper-frieze dentils add scale to the oversized facade.
for z in [i*.65 for i in range(-28,29)]:
    if abs(z)>7.7: D.cbox('limestone',[30.04,10.38,z],[.30,.3,.22])
# Tailored blue/gold pennants give the pale facade an unmistakable imperial colour cue.
for z in (-6.2,6.2):
    D.quad('blue',(28.67,9.65,z-.55),(28.67,9.65,z+.55),(28.64,6.6,z+.51),(28.64,6.6,z-.51))
    for zz in (z-.50,z+.50): beam(D,'gold',(28.62,9.61,zz),(28.59,6.66,zz),.018,4)
    D.quad('gold',(28.60,8.3,z),(28.60,7.9,z+.24),(28.60,7.5,z),(28.60,7.9,z-.24))
    beam(D,'iron',(28.6,9.7,z-.7),(28.6,9.7,z+.7),.045,6)
# Small wall lanterns use glass/metal geometry and restrained warm material, no fake scene lights.
for z in (-7.3,7.3):
    beam(D,'iron',(29.1,3.9,z),(28.55,3.9,z),.045,6)
    bevelbox(D,'amber',[28.48,3.55,z],[.3,.55,.3],.04)
    for zz in (z-.16,z+.16): D.cbox('iron',[28.48,3.55,zz],[.35,.035,.035])
    D.prism('iron',(28.48,0,z),.26,.08,n=4,y0=3.9,rot=math.pi/4)
# West entry: open iron grille over a dark recess, squat dressed piers and crown cornices.
for z in (-8,8):
    bevelbox(D,'stone',[-32,4,z],[3,8,3],.15)
    for y in (1.05,1.8,2.55,3.3,4.05,4.8,5.55,6.3): D.cbox('stoneLight',[-30.47,y,z],[.08,.035,3])
    for y,w in ((.25,3.3),(7.5,3.25),(7.85,3.6)): D.cbox('stoneLight',[-32,y,z],[w,.28,w])
    D.blob('snow',(-32,8.12,z),1.8,.07)
    lathe(D,'gold',-32,z,[(.3,8.15),(.4,8.35),(.32,8.65),(.06,8.95)],12)
D.cbox('iron',[-30.4,3,0],[.08,5.5,12])
for z in [i*.45 for i in range(-13,14)]:
    D.cbox('ironEdge',[-29.63,2.7,z],[.06,4.9,.045])
    if int(z/.45)%3==0: beam(D,'gold',(-29.62,5.1,z),(-29.62,5.45,z),.07,4)
for y in (1.1,3.6,4.8): D.cbox('gold',[-29.60,y,0],[.045,.04,11.8])
for z in (-18,-12,12,18): window_face(-29.64,2.75,z,-1,1.5,2)
# Arcade has complete curved soffits, explicit capitals and shadowed coffers.
snow_hip(-20.7,20.7,-23,-13,6.06,7.6,82)
for x in (-13.5,-4.5,4.5,13.5):
    for z in (-21.5,-14.5): arched_band(D,x,z,.65,4.12,4.1,1.22,.32,16)
    for z in (-19.6,-16.4):
        D.cbox('stoneDark',[x,5.53,z],[7.8,.08,2.6]);D.cbox('stone',[x,5.48,z],[7.5,.07,2.28])
for x in (-18,-9,0,9,18):
    for z in (-21.5,-14.5):
        bevelbox(D,'stoneLight',[x,1.48,z],[1.1,.36,1.1],.05)
        D.cbox('stoneLight',[x,4.15,z],[1.12,.18,1.12])
        D.cbox('limestone',[x,4.31,z],[.98,.16,.98])
        for yy in (2.1,2.9,3.7): D.cbox('stone',[x,yy,z],[.815,.025,.815])
for z in (-22.55,-13.45):
    D.cbox('stoneLight',[0,5.75,z],[41,.23,.4]);D.cbox('limestone',[0,5.98,z],[41.25,.15,.52])
    for x in range(-19,20): D.cbox('stoneLight',[x,5.52,z],[.24,.24,.4])
# Fountain: layered clipped-corner basin keeps its full 6m cover envelope; lathed stem/bowl.
for y,w,h in ((.2,5.98,.4),(.48,5.75,.17),(1.48,5.8,.16)):
    bevelbox(D,'stoneLight',[0,y,0],[w,h,w],.35)
for side in (-1,1):
    for t in (-1.5,0,1.5):
        D.cbox('stone',[side*2.765,.98,t],[.025,.62,1.18]);D.cbox('stoneLight',[side*2.78,1.3,t],[.05,.05,1.25])
        D.cbox('stone',[t,.98,side*2.765],[1.18,.62,.025]);D.cbox('stoneLight',[t,1.3,side*2.78],[1.25,.05,.05])
D.prism('ice',(0,0,0),2.66,.035,n=32,y0=1.73)
lathe(D,'stoneLight',0,0,[(2.62,1.72),(2.72,1.86),(2.94,1.86),(2.98,1.72)],32)
lathe(D,'stoneLight',0,0,[(.86,1.77),(.87,1.91),(.64,2.02),(.48,2.30),(.36,2.9),(.54,3.12),(.92,3.22),(1.45,3.46),(1.58,3.62),(1.56,3.73),(1.35,3.73)],32)
D.prism('ice',(0,0,0),1.32,.025,n=32,y0=3.69)
lathe(D,'limestone',0,0,[(.3,3.71),(.3,3.85),(.44,3.98),(.44,4.13),(.28,4.37),(.13,4.5),(.02,4.55)],20)
D.blob('snow',(0,4.55,0),.26,.25)
for i in range(12):
    a=math.tau*i/12;r=1.49;xx,zz=r*math.cos(a),r*math.sin(a);bottom=2.61+.42*(i%3)/2
    beam(D,'ice',(xx,bottom,zz),(xx,3.56,zz),.035+(i%3)*.014,5)
    D.blob('iceLight',(xx,3.56,zz),.10,.38)
for i in range(7):
    a=i*math.tau/7;rr=1.9
    p0=(1.0*math.cos(a),1.769,1.0*math.sin(a));p1=(rr*math.cos(a+.1),1.77,rr*math.sin(a+.1));p2=(2.53*math.cos(a-.06),1.77,2.53*math.sin(a-.06))
    ribbon(D,'iceLight',p0,p1,.018);ribbon(D,'iceLight',p1,p2,.012)
# Sparse ridge snow has irregular edges rather than white slabs on every object.
for o in c.objects:
    x,y,z=o['position'];w,h,d=o['size']
    if 'spawn_screen' in o['id']:
        for yy in (.65,1.3,1.95,2.6): D.cbox('stone',[x,yy,z],[w+.035,.025,d])
        D.cbox('stoneLight',[x,3.35,z],[w+.25,.15,d+.18])
        for zz in (-4.7,0,4.7): D.cbox('stone',[x,1.7,zz],[w+.1,3.4,.28])
        for sign in (-1,1):
            D.cbox('blue',[x+sign*(w/2+.03),2,z],[.04,1.5,1.3]);D.cbox('gold',[x+sign*(w/2+.06),2,z],[.02,.045,1.05])
        for zz in [z-d/2+i*.9 for i in range(12)]: D.blob('snow',(x,3.48,zz),.52,.09)
    if 'park_low_wall' in o['id']:
        for yy in (.45,.95): D.cbox('stoneDark',[x,yy,z],[w,.024,d+.025])
        for xx in [x-w/2+i*1.0 for i in range(9)]: D.cbox('stoneDark',[xx,.72,z],[.025,1.4,d+.025])
        D.cbox('stoneLight',[x,1.5,z],[w+.1,.13,d+.18]);snowline(D,x-w/2,x+w/2,1.59,z-.36,.7,int(x+50))
    if 'boundary_z' in o['id']:
        D.cbox('stoneLight',[x,y+h/2,z],[w,.17,d+.12]);snowline(D,-29.6,29.6,y+h/2+.12,z-.28,.6,int(z+30))
    if 'park_gatepost' in o['id']:
        bevelbox(D,'stoneLight',[x,2.1,z],[1.28,.22,1.28],.05);D.blob('snow',(x,2.26,z),.72,.11)
# Timber wagons are reconstructed inside the existing authoritative cover proxies.
def wagon(m,o):
    x,y,z=o['position'];w,h,d=o['size']
    bevelbox(m,'timberDark',[x,.67,z],[3.85,.35,2.25],.06)
    # Long horizontal boards, with painted rail, fasteners, edge wear and internal grain.
    for j in range(4):
        yy=.82+j*.19
        for sign in (-1,1):
            zz=z+sign*1.16;bevelbox(m,'timber' if j%2 else 'timberLight',[x,yy,zz],[3.9,.17,.12],.012)
            for k in range(3):
                xx=x-1.5+k*1.2
                m.cbox('timberDark',[xx,yy+.025,zz+sign*.065],[.7,.012,.009])
    for xx in (x-1.88,x+1.88):
        for j in range(4): bevelbox(m,'timber',[xx,.82+j*.19,z],[.14,.17,2.28],.015)
    for sign in (-1,1):
        zz=z+sign*1.235
        for xx in (x-1.7,x,x+1.7):
            m.cbox('iron',[xx,1.08,zz],[.075,.82,.045])
            for yy in (.75,1.4): beam(m,'ironEdge',(xx,yy,zz-sign*.01),(xx,yy,zz+sign*.035),.04,6)
        m.cbox('blue',[x,1.51,zz],[3.88,.14,.08])
        for xx in (x-1.3,x+1.3):
            # Wheel planes are perpendicular to the axle, with steel tyres and wood spokes.
            cy=.50;zo=z+sign*1.19
            for i in range(18):
                a,b=math.tau*i/18,math.tau*(i+1)/18
                def pt(r,t,off): return (xx+r*math.cos(t),cy+r*math.sin(t),zo+off)
                for off in (-.085,.085):
                    m.quad('iron',pt(.49,a,off),pt(.49,b,off),pt(.39,b,off),pt(.39,a,off))
                m.quad('ironEdge',pt(.49,a,-.085),pt(.49,b,-.085),pt(.49,b,.085),pt(.49,a,.085))
                if i%2==0: beam(m,'timberLight',(xx,cy,zo),(xx+.405*math.cos(a),cy+.405*math.sin(a),zo),.034,5)
            beam(m,'iron',(xx,cy,zo-.095),(xx,cy,zo+.095),.13,10)
        beam(m,'iron',(x-1.3,.5,z-1.2),(x-1.3,.5,z+1.2),.07,6)
        beam(m,'iron',(x+1.3,.5,z-1.2),(x+1.3,.5,z+1.2),.07,6)
    # Covered wagon silhouette: arched canvas panels, seam bands and sagged end closure.
    def cp(xx,t,offset=0): return (xx,1.5+(1.055+offset)*math.sin(t),z+(1.16+offset)*math.cos(t))
    for j in range(5):
        xa=x-1.92+3.84*j/5;xb=x-1.92+3.84*(j+1)/5
        for k in range(12):
            a,b=math.pi*k/12,math.pi*(k+1)/12
            m.quad('canvas' if (j+k)%5 else 'canvasLight',cp(xa,a),cp(xb,a),cp(xb,b),cp(xa,b))
    for xx in [x-1.92+i*.96 for i in range(5)]:
        for k in range(12):
            a,b=math.pi*k/12,math.pi*(k+1)/12
            m.quad('canvasShade',cp(xx-.02,a,.008),cp(xx+.02,a,.008),cp(xx+.02,b,.008),cp(xx-.02,b,.008))
    for xx in (x-1.925,x+1.925):
        for k in range(12):
            a,b=math.pi*k/12,math.pi*(k+1)/12
            m.tri('canvasShade',(xx,1.48,z),cp(xx,a),cp(xx,b))
        for zz in (z-.63,z+.63): beam(m,'rope',(xx,1.55,zz),(xx,2.13,zz*.0+z+(zz-z)*.65),.012,5)
        m.cbox('blue',[xx,1.75,z],[.018,.31,.48])
        m.cbox('gold',[xx,1.75,z],[.024,.035,.36])
    # Uneven thin snow rests on the canvas ridge, not a square roof plate.
    for j in range(6):
        xa=x-1.8+j*.6;xb=xa+.58
        for k in range(4):
            a=1.19+k*.18;b=1.19+(k+1)*.18
            m.quad('snow',cp(xa,a,.025),cp(xb,a-.025,.025),cp(xb,b-.025,.025),cp(xa,b,.025))
    return True
# Garden urns, sparse snowdrifts and a wrought-iron park silhouette keep the south route airy.
for x in range(-27,28,6):
    bevelbox(D,'stone',[x,1.5,23.63],[.8,3,.7],.06);D.cbox('stoneLight',[x,2.92,23.63],[1.0,.17,.9]);D.blob('snow',(x,3.08,23.63),.63,.10)
for x in (-20,20):
    lathe(D,'limestone',x,21,[(.64,.12),(.64,.30),(.45,.45),(.4,.65),(.74,.9),(.82,1.2),(.88,1.3),(.66,1.4)],16)
    D.blob('snow',(x,1.43,21),.73,.10)
for i in range(24):
    x=-27+i*2.3;z=22.4+(i%3)*.2;D.blob('snow',(x,.03,z),1.5,.055)
for x in (-29,29):
    for z in (-21,-15,15,21): D.blob('snowShade',(x,.025,z),1.6,.04)
for x in (-18,18): flag(D,'blue',(x,6.3,-21.8),-1 if x<0 else 1,.9)
# Park lamps are small decorative crowns on existing solid gateposts, not new blockers.
for x in (-4,4):
    z=14
    bevelbox(D,'amber',[x,2.54,z],[.40,.47,.40],.035)
    for xx in (x-.23,x+.23):
        for zz in (z-.23,z+.23): beam(D,'iron',(xx,2.27,zz),(xx,2.83,zz),.025,5)
    D.cbox('iron',[x,2.27,z],[.55,.08,.55]);D.cbox('iron',[x,2.83,z],[.58,.09,.58])
    hiproof(D,'slate',x-.34,x+.34,z-.34,z+.34,2.88,3.08)
    D.blob('snow',(x,3.06,z),.29,.14)
# Snow-laden fir silhouettes live beyond the court wall: winter framing, never lane clutter.
for tid,(x,z,h) in enumerate([(-29,28,7.2),(-12,31,6.5),(17,31,7.6),(29,28,6.9)]):
    beam(D,'timberDark',(x,0,z),(x,h,z),.16,7)
    for layer in range(4):
        yy=1.8+layer*h*.16;radius=2.2-layer*.40;rise=2.35-layer*.25
        n=14;rr=random.Random(120+tid*13+layer)
        ringpoints=[]
        for i in range(n):
            a=math.tau*i/n;r=radius*(.88+rr.random()*.16)
            ringpoints.append((x+r*math.cos(a),yy+rr.uniform(-.12,.12),z+r*math.sin(a)))
        for i in range(n):
            a=ringpoints[i];b=ringpoints[(i+1)%n];peak=(x,yy+rise,z)
            D.tri('winterNeedle' if i%3 else 'winterNeedleLight',a,b,peak)
            # A thin snow saddle leaves irregular green underskirts at each tier.
            aa=(x+(a[0]-x)*.88,a[1]+rise*.16+.045,z+(a[2]-z)*.88)
            bb=(x+(b[0]-x)*.88,b[1]+rise*.16+.045,z+(b[2]-z)*.88)
            D.tri('snow' if i%4 else 'snowShade',aa,bb,(x,yy+rise+.08,z))
# Background tree silhouettes branch naturally; entirely beyond the authoritative boundary.
for i,x in enumerate((-26,-15,-4,8,21)):
    z=29+(i%2)*3;h=7+(i%3);beam(D,'timberDark',(x,0,z),(x+.35,h,z),.21,7)
    for j in range(4):
        side=(-1)**j;a=(x+.18,h*(.42+j*.10),z);b=(x+side*(1.8+j*.18),h*(.78+j*.035),z+side*.6)
        beam(D,'timberDark',a,b,.075,5)
        beam(D,'timberDark',b,(b[0]+side*.7,b[1]+1.1,b[2]-.4),.032,5)
        beam(D,'snow',(a[0],a[1]+.06,a[2]),(b[0],b[1]+.06,b[2]),.045,5)
for i in range(10): mountain(D,'distant',-100+i*23,-95,25,12+(i*7%13))
c.data['designNotes']=['Snow has no friction/visibility gameplay modifier.','North arcade and open south park are deliberately different bypasses.','Fictional ceremonial architecture; no named historical battle claim.','R4 material and sculptural pass preserves every authoritative collision, route, anchor and spawn.']
def crafted(m,o):
    if o['id']=='fountain_plinth':
        # Stepped octagonal section: a shadowed waist and rolled rim, not a solid cube.
        def contour(w,yy):
            h=w/2; b=.43
            return [(-h+b,yy,-h),(h-b,yy,-h),(h,yy,-h+b),(h,yy,h-b),(h-b,yy,h),(-h+b,yy,h),(-h,yy,h-b),(-h,yy,-h+b)]
        rows=[contour(w,yy) for w,yy in [(5.8,0),(6,.18),(6,.35),(5.5,.52),(5.5,1.35),(5.9,1.5),(6,1.62),(5.94,1.7)]]
        for aa,bb in zip(rows,rows[1:]):
            for j in range(8): m.quad('limestone',aa[j],aa[(j+1)%8],bb[(j+1)%8],bb[j])
        for j in range(8): m.tri('limestone',(0,1.7,0),rows[-1][j],rows[-1][(j+1)%8])
        return True
    if o['id']=='fountain_column':
        # Readable fluted core; no floating thin spindle over invisible wide cover.
        lathe(m,'stone',0,0,[(.88,.85),(.88,1.55),(.72,1.85),(.52,2.35),(.43,2.85),(.61,3.15),(.58,3.46),(.40,3.80),(.28,4.25),(.12,4.55)],24)
        return True
    if o['id'].startswith('supply_wagon'): return wagon(m,o)
    return False
# Embedded small repeatable maps, not external URLs or Blender-only surface nodes.
texroot=ROOT/'assets/materials'
for group,names,scale in [
    ('stone',['stone','limestone','stoneLight','stoneDark'],.75),
    ('paving',['pavement','pavementAlt','pavementWarm'],.65),
    ('wood',['timber','timberLight','timberDark'],1),
    ('snow',['snow','snowShade','snowBlue'],1.5),
    ('canvas',['canvas','canvasLight','canvasShade'],2),
    ('slate',['slate','slateLight'],1.2),
]:
    for name in names:
        c.textures[name]=dict(baseColor=texroot/f'{group}_basecolor.png',orm=texroot/f'{group}_orm.png',normal=texroot/f'{group}_normal.png',scale=scale,normalScale=.28 if group=='snow' else .4)
c.save(render_object=crafted)
