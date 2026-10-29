"""FROSTCOURT: snow over a pale ceremonial court; intentional anime fiction.
Run: python3 arena-maps/frostcourt/source/build.py
"""
from pathlib import Path
import sys, math, random
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT.parent/'_lib'))
from chapterkit import Chapter, mat, beam, flag, mountain, bevelbox, hiproof, cone, frustum, lantern, brazier
P=dict(stone=mat('#a9b0b8'), limestone=mat('#d9d4c7'), stoneLight=mat('#c1c4c8'), stoneDark=mat('#909aa8'),
    pavement=mat('#8e9bab'), pavementAlt=mat('#99a5b2'), pavementWarm=mat('#a6abb1'), joint=mat('#68788c'),
    snow=mat('#eef0f3'), snowShade=mat('#cdd9e7'), snowBlue=mat('#bccddd'), slate=mat('#425870'), slateLight=mat('#566d83'),
    iron=mat('#344455',.5,.55), ironEdge=mat('#66778a',.45,.45), timber=mat('#6c4e3d'), timberLight=mat('#977354'), timberDark=mat('#4d3b33'),
    canvas=mat('#b8af99'), canvasLight=mat('#cec3a8'), canvasShade=mat('#8f938f'), rope=mat('#8d816c'),
    blue=mat('#365578'), blueLight=mat('#4a698d'), gold=mat('#bda06b',.62,.42), ice=mat('#8bb8cc',.12,.34), iceLight=mat('#c0dce5',.08,.28),
    window=mat('#45617e',.1,.36), windowLight=mat('#7b9ab2',.1,.4), amber=mat('#d8a66c',.15,.58,.08), distant=mat('#9baac1'), winterNeedle=mat('#526773'), winterNeedleLight=mat('#6d828b'),
    windowGlow=mat('#ffbf73',0,1,2.3), lampGlass=mat('#ffd9a0',0,1,3.0), flame=mat('#ff9a3c',0,1,3.2), flameCore=mat('#ffe6a0',0,1,4.5),
    coal=mat('#c2461e',0,.9,1.6), cityStone=mat('#8c93a6'), cityRoof=mat('#4c5a78'), dome=mat('#c9a35c',.6,.4), domeBlue=mat('#3f5f93',.3,.5),
    fireSky=mat('#ff8a48',0,1,1.4))
c=Chapter(ROOT,'frostcourt','FROSTCOURT 永冬庭院',60,48,'snowcourt',P); D=c.detail
# 2026-10-28 long-range rework (max: each map its own style). FROSTCOURT is the
# long-range map: a frozen canal trench across the court, raised garden terraces
# with balustrades on the south (sniper balconies facing the arcade), a balustraded
# arcade terrace on the north and low snow drifts for crouch cover in between.
# The court floor is split around the canal; everything is mirrored in x.
def Bc(id,x0,x1,y0,y1,z0,z1,material,role='cover',art=None):
    o=dict(id=id,type='box',position=[round((x0+x1)/2,3),round((y0+y1)/2,3),round((z0+z1)/2,3)],size=[round(x1-x0,3),round(y1-y0,3),round(z1-z0,3)],
        material=material,collision=True,role=role,batch='court')
    c.objects.append(o); COURT_ART[id]=art or {}
    return o
COURT_ART={}
CANAL=(6,9.5)
c.box('court_floor',[0,-.6,-9],[60,1.2,30],'snow','floor')
c.box('court_floor_south',[0,-.6,16.75],[60,1.2,14.5],'snow','floor')
for side in (-1,1):
    c.box(f'court_floor_end_{side}',[side*27,-.6,7.75],[6,1.2,3.5],'snow','floor')
c.box('canal_ice',[0,-1.2,7.75],[48,.6,3.5],'ice','floor')
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
    c.box('supply_wagon_'+str(side),[side*13,1.3,side*2.4],[4,2.6,2.6],'timber')
    c.box('park_low_wall_'+str(side),[side*10,.75,14],[8,1.5,.7],'stone')
    c.box('park_gatepost_'+str(side),[side*4,1.1,14],[1.2,2.2,1.2],'limestone')
    c.anchor('cover_wagon_'+str(side),'cover',[side*13,0,side*5],height=2.6)
    c.anchor('cover_park_'+str(side),'cover',[side*10,0,16],height=1.5)
    c.anchor('cover_fountain_'+str(side),'cover',[side*4.2,0,0],height=1.7)
c.anchor('objective_fountain','objective',[0,0,5],radius=2)
# 2026-10-28 collision audit: these visible solids used to be walk-through art.
# The palace portico (columns/piers up to 1.4 m proud of the east wall), the two
# garden urns and the south-wall piers now have matching authoritative boxes.
c.box('palace_portico',[28.975,2.65,0],[1.45,5.3,13.4],'limestone','structure')
for x in (-20,20): c.box(f'garden_urn_{x}',[x,3.1,22.8],[1.8,1.4,1.8],'limestone','prop')
for x in range(-27,28,6): c.box(f'south_wall_pier_{x}',[x,1.5,23.63],[.8,3,.74],'stone','structure')
# West-wall window bays: sills and reveals stand 0.6 m proud of the wall face.
for z in (-18,-12,12,18): c.box(f'west_window_bay_{z}',[-29.4,2.75,z],[.62,2.9,2.4],'stone','structure')
for side in (-1,1):
    sx=lambda x:side*x
    def X(x0,x1): return (min(sx(x0),sx(x1)),max(sx(x0),sx(x1)))
    # Bridges over the canal: centre (once) and one per side, with low parapets.
    xa,xb=X(12,15)
    Bc(f'bridge_{side}',xa,xb,-.9,0,6,9.5,'stone','floor',dict(kind='bridge'))
    for x0,x1 in (X(12,12.3),X(14.7,15)):
        Bc(f'bridge_parapet_{side}_{int(abs(x0)*10)}',x0,x1,0,.9,6,9.5,'limestone','cover',dict(kind='parapet',axis='z'))
    # Each canal stretch has one stair down; its other end is a bridge abutment.
    x0,x1=X(21,24)
    c.objects.append(dict(id=f'canal_steps_outer_{side}',type='ramp',position=[round((x0+x1)/2,3),-.9,7.75],size=[3,.9,3.5],
        material='stone',collision=True,role='ramp',axis='x',lowAt=-side,batch='court')); COURT_ART[f'canal_steps_outer_{side}']=dict(kind='steps')
    # The inner stretch climbs out to the north bank (its ends are bridge abutments).
    x0,x1=X(4,6)
    c.objects.append(dict(id=f'canal_steps_inner_{side}',type='ramp',position=[round((x0+x1)/2,3),-.9,7.25],size=[2,.9,2.5],
        material='stone',collision=True,role='ramp',axis='z',lowAt=1,batch='court')); COURT_ART[f'canal_steps_inner_{side}']=dict(kind='steps')
    # Garden terrace (sniper balcony): 2.4 m, balustrade toward the court, stair from the park.
    xa,xb=X(14.6,23.4)
    Bc(f'garden_terrace_{side}',xa,xb,0,2.4,17.5,23.7,'limestone','floor',dict(kind='terrace'))
    for x0,x1 in (X(14.6,19.2),X(20.2,23.4)):
        Bc(f'terrace_balustrade_{side}_{int(abs(x0)*10)}',x0,x1,2.4,3.4,17.5,17.9,'limestone','cover',dict(kind='balustrade',axis='x'))
    c.objects.append(dict(id=f'terrace_stair_{side}',type='ramp',position=[side*11.6,0,20.5],size=[6,2.4,2],material='limestone',collision=True,role='ramp',axis='x',lowAt=-side,batch='court'))
    COURT_ART[f'terrace_stair_{side}']=dict(kind='steps')
    # Arcade balustrades in the outer bays turn the terrace into a firing line.
    xa,xb=X(9.4,17.6)
    Bc(f'arcade_balustrade_{side}',xa,xb,1.3,2.3,-14.9,-14.1,'limestone','cover',dict(kind='balustrade',axis='x'))
    # Snow drifts: crouch-height cover in the open court.
    xa,xb=X(17.6,18.4); Bc(f'drift_east_{side}',xa,xb,0,1.1,-6.5,-2.5,'snow','cover',dict(kind='drift',axis='z'))
    xa,xb=X(5.5,9.5); Bc(f'drift_canal_{side}',xa,xb,0,1.1,4.2,4.8,'snow','cover',dict(kind='drift',axis='x'))
    xa,xb=X(18,22); Bc(f'drift_park_{side}',xa,xb,0,1.1,11.6,12.2,'snow','cover',dict(kind='drift',axis='x'))
    c.anchor(f'cover_terrace_{side}','cover',[side*19.7,2.4,18.4],height=1)
    c.anchor(f'cover_canal_{side}','cover',[side*8,-.9,8.9],height=.9)
    c.anchor(f'cover_drift_{side}','cover',[side*7.5,0,3.8],height=1.1)
    c.anchor(f'cover_arcade_rail_{side}','cover',[side*13.5,1.3,-15.5],height=1)
Bc('bridge_centre',-2,2,-.9,0,6,9.5,'stone','floor',dict(kind='bridge'))
for x0,x1 in ((-2,-1.7),(1.7,2)):
    Bc(f'bridge_centre_parapet_{int(x0*10)}',x0,x1,0,.9,6,9.5,'limestone','cover',dict(kind='parapet',axis='z'))
c.ramp('arcade_front_steps',[0,0,-12.7],[6,1.3,2.6],'z',1,'pavement'); c.objects[-1]['batch']='court'; COURT_ART['arcade_front_steps']=dict(kind='steps')
c.anchor('objective_bridge','objective',[0,0,7.75],radius=2)
for bx_ in (-13.5,0,13.5):
    for dx in (-1.85,1.85):
        x=bx_+dx; Bc(f'bridge_lamp_{int(x*10)}',x-.15,x+.15,0,3.2,5.45,5.75,'iron','structure',dict(kind='lamppost'))
c.route('covered_arcade',[[-27.5,0,-2],[-27.5,0,-18],[-25.5,0,-18],[-18,1.3,-18],[18,1.3,-18],[25.5,0,-18],[27.5,0,-18],[27.5,0,-2]])
c.route('park_loop',[[-27.5,0,2],[-27.5,0,4],[-26.5,0,7.75],[-26,0,12],[-20,0,15],[-12,0,16.5],[0,0,16.5],[12,0,16.5],[20,0,15],[26,0,12],[26.5,0,7.75],[27.5,0,4],[27.5,0,2]])
c.route('fountain_breach',[[-22,0,-8],[-15,0,-10],[-6,0,-8],[6,0,-8],[20,0,-8],[22,0,0],[22,0,4.4],[13.5,0,5.2],[13.5,0,10.5],[0,0,11],[-13.5,0,10.5],[-13.5,0,5.2],[-22,0,4.4],[-22,0,0],[-22,0,-8]])
c.route('arcade_to_terrace',[[4.5,1.3,-18],[19.5,1.3,-18],[26,0,-18],[26,0,-8],[20,0,-8],[20,0,0],[13.5,0,5.2],[13.5,0,10.5],[15.5,0,11],[15,0,16.5],[8,0,20.5],[15.2,2.4,20.5],[19.7,2.4,19]])
c.route('canal_trench',[[-26.5,0,7.75],[-22.5,-.45,7.75],[-16,-.9,7.75]])
c.route('front_steps',[[0,0,-9],[1.5,0,-11],[1.5,1.3,-15.6],[-6,1.3,-17]])
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
        if 5<z<11: continue
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
LIT=[]
def window_face(x,y,z,sign=1,width=1.8,height=2.35,lit=False):
    D.cbox('stoneDark',[x,y,z],[.08,height+.44,width+.45])
    D.cbox('iron',[x-sign*.055,y,z],[.055,height+.10,width+.1])
    D.cbox('windowGlow' if lit else 'window',[x-sign*.09,y,z],[.025,height,width])
    if lit and y<4: LIT.append((x-sign*.6,z,width))
    # Desaturated sky reflected in upper panes, no false hole through collision wall.
    D.cbox('windowLight',[x-sign*.11,y+height*.23,z-width*.24],[.015,height*.42,width*.44])
    for zz in (z-width/2-.16,z+width/2+.16): D.cbox('limestone',[x-sign*.20,y,zz],[.24,height+.6,.22])
    for yy in (y-height/2-.20,y+height/2+.20): D.cbox('stoneLight',[x-sign*.24,yy,z],[.38,.22,width+.78])
    D.cbox('limestone',[x-sign*.15,y,z],[.11,height,.075])
    D.cbox('limestone',[x-sign*.15,y+.06,z],[.11,.075,width])
    D.cbox('stone',[x-sign*.28,y-height/2-.34,z],[.5,.10,width+.87])
    D.cbox('snow',[x-sign*.25,y+height/2+.35,z],[.4,.09,width+.72])
for z in (-16,-11,11,16):
    # Warm occupied rooms behind the facade: lamplight against the cold court.
    for y in (3,8): window_face(30.45,y,z,1,lit=(y==3)!=(abs(z)==11))
    for y in (3,8): window_face(37.56,y,z,-1,lit=(z==11 and y==3))
for z in (-4.6,0,4.6): window_face(28.99,7.7,z,1,1.6,2.1,lit=z==0)
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
    bevelbox(D,'lampGlass',[28.48,3.55,z],[.3,.55,.3],.04)
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
for z in (-18,-12,12,18): window_face(-29.64,2.75,z,-1,1.5,2,lit=z in (-12,18))
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
    lathe(D,'limestone',x,22.8,[(.64,2.52),(.64,2.70),(.45,2.85),(.4,3.05),(.74,3.3),(.82,3.6),(.88,3.7),(.66,3.8)],16)
    D.blob('snow',(x,3.83,22.8),.73,.10)
for i in range(24):
    x=-27+i*2.3;z=22.4+(i%3)*.2;D.blob('snow',(x,.03,z),1.5,.055)
for x in (-29,29):
    for z in (-21,-15,15,21): D.blob('snowShade',(x,.025,z),1.6,.04)
for x in (-18,18): flag(D,'blue',(x,6.3,-21.8),-1 if x<0 else 1,.9)
# Park lamps are small decorative crowns on existing solid gateposts, not new blockers.
for x in (-4,4):
    z=14
    bevelbox(D,'lampGlass',[x,2.54,z],[.40,.47,.40],.035)
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
# ---------------------------------------------------------------- 2026-10-28 light & winter dressing
# Warm lamplight against blue snow (SAKURA's lantern contrast, in a winter key), icicles
# and drifts for texture, and a burning city on the northern horizon for depth and story.
GLOWS,POOLS,EMBERS,SMOKE=[],[],[],[]
for z in (-7.3,7.3):
    GLOWS.append([28.48,3.55,z,1.5,'#ffc27a',.25]); POOLS.append([28.3,0,z,2.6,'#ffb066',.45])
for x in (-4,4):
    GLOWS.append([x,2.54,14,1.6,'#ffc27a',.2]); POOLS.append([x,0,14.9,2.8,'#ffb066',.45])
for x,z,w in LIT:
    POOLS.append([round(x,2),0,z,1.8,'#ffb36a',.35])
# Lanterns hung under the arcade between piers, above head height on the terrace.
for x in (-13.5,-4.5,4.5,13.5):
    beam(D,'iron',(x,5.55,-18),(x,4.95,-18),.018,4)
    lx,ly,lz=lantern(D,x,4.55,-18,1.1)
    GLOWS.append([lx,ly,lz,1.4,'#ffc27a',.25]); POOLS.append([x,1.3,-18,2.6,'#ffb066',.5])
# Warming braziers on the spawn screens' coping (unreachable 3.4 m tops).
for side in (-1,1):
    for zz in (-3.6,3.6):
        fx,fy,fz=brazier(D,side*24,3.42,zz,.8,legs=False)
        GLOWS.append([fx,round(fy+.08,2),fz,1.7,'#ffa34d',.8]); EMBERS.append([fx,fy,fz,.3])
        POOLS.append([side*24-side*1.6,0,zz,2.4,'#ff9b4a',.35])
# Icicles along every eave the player sees: arcade roof edges and the palace cornice.
for z in (-22.75,-13.25):
    for i in range(80):
        x=-20+i*.5+rng.uniform(-.15,.15); L=rng.uniform(.18,.62)
        cone(D,'iceLight' if i%3 else 'ice',(x,6.02,z),.045+L*.05,-L,4,rng.uniform(0,1))
for i in range(70):
    z=-19.5+i*.56+rng.uniform(-.1,.1)
    if abs(z)<7.6: continue
    L=rng.uniform(.2,.7); cone(D,'iceLight' if i%2 else 'ice',(29.92,10.9,z),.05+L*.05,-L,4,rng.uniform(0,1))
for z in [i*.5-7.4 for i in range(30)]:
    L=rng.uniform(.15,.5); cone(D,'iceLight',(28.62,10.48,z),.04+L*.05,-L,4,rng.uniform(0,1))
# Wind-packed drifts at the feet of walls, piers and screens (thin, below the body band).
for x in range(-28,29,3):
    D.blob('snow',(x+rng.uniform(-.6,.6),.02,-23.25),rng.uniform(1,1.8),.12)
for z in range(-20,21,3):
    if abs(z)<9: continue
    D.blob('snow',(-29.25,.02,z+rng.uniform(-.6,.6)),rng.uniform(.9,1.5),.14)
for x in (-18,-9,0,9,18):
    for z in (-21.5,-14.5): D.blob('snowShade',(x,1.32,z),.7,.1)
for side in (-1,1):
    for zz in (-5,5): D.blob('snow',(side*24-side*.5,.02,zz),.9,.16)
# Sled and boot tracks pressed into the southern park snow.
for k,(z0,dz) in enumerate([(17.2,.3),(18.8,-.25)]):
    for i in range(40):
        x0=-24+i*1.2; x1=x0+1.15
        for off in (-.45,.45):
            ribbon(D,'snowBlue',(x0,.017,z0+off+dz*math.sin(i*.3)),(x1,.017,z0+off+dz*math.sin((i+1)*.3)),.09)
# Stacked muskets in tripods against the arcade terrace front (inside the terrace face band).
# Burning city on the northern horizon: onion domes, a tall bell tower, walls and smoke.
CZ=-118
def city_block(x,z,w,d,h):
    D.cbox('cityStone',[x,h/2-4,z],[w,h+8,d])
    hiproof(D,'cityRoof',x-w/2,x+w/2,z-d/2,z+d/2,h-4,h-4+min(w,d)*.45)
def onion(x,z,r,y,gold=True):
    frustum(D,'cityStone',(x,y-4,z),r*.75,r*.7,4+r*1.2,10)
    yy=y+r*1.2
    D.blob('dome' if gold else 'domeBlue',(x,yy+r*.55,z),r*1.05,1.05)
    cone(D,'dome' if gold else 'domeBlue',(x,yy+r*1.3,z),r*.45,r*1.1,8)
    beam(D,'gold',(x,yy+r*2.3,z),(x,yy+r*2.3+1.6,z),.08,4)
rr=random.Random(1812)
for i in range(26):
    x=-110+i*9+rr.uniform(-2,2); z=CZ+rr.uniform(-12,10); w=rr.uniform(6,11); d=rr.uniform(5,9); h=rr.uniform(12,20)
    city_block(x,z,w,d,h)
D.cbox('cityStone',[-10,4,CZ+14],[150,16,2.5])
for i in range(16): cone(D,'cityRoof',(-82+i*10,14,CZ+14),1.9,5,4,math.pi/4); frustum(D,'cityStone',(-82+i*10,-4,CZ+14),1.9,1.8,18,4)
for x,z,r,y,g in [(-20,CZ-6,5,30,True),(-31,CZ-2,3.4,25,False),(-9,CZ-1,3.4,25,True),(-25,CZ+3,2.6,21,True),(-14,CZ+4,2.6,21,False),(40,CZ-4,4,26,False),(49,CZ,2.8,22,True),(-70,CZ-2,3.4,23,True)]:
    onion(x,z,r,y,g)
# Bell tower (a tall stepped octagon), the skyline's vertical accent.
TIERS=[(5,22),(4.1,14),(3.2,12),(2.4,9)]
for k,(r,h) in enumerate(TIERS):
    frustum(D,'cityStone' if k%2==0 else 'limestone',(12,-4+sum(hh for _,hh in TIERS[:k]),CZ-8),r,r*.92,h,8)
D.blob('dome',(12,54.6,CZ-8),2.6,1.1); cone(D,'dome',(12,56.8,CZ-8),1,3,8)
# The fire: glowing low cloud bank, rising smoke and a scatter of burning windows.
for i in range(9):
    x=-90+i*20+rr.uniform(-5,5); z=CZ-4+rr.uniform(-6,6)
    D.blob('fireSky',(x,16,z),rr.uniform(8,12),.5)
    GLOWS.append([round(x,1),24,round(z,1),30,'#ff7a35',.5])
    SMOKE.append([round(x,1),24,round(z,1),2.6,'#6c6670'])
for i in range(30):
    x=-105+rr.uniform(0,170); z=CZ+rr.uniform(-10,10)
    D.cbox('windowGlow',[x,rr.uniform(6,16),z+4.6],[1.1,1.5,.2])
for bx_ in (-13.5,0,13.5):
    for dx in (-1.85,1.85):
        GLOWS.append([bx_+dx,2.85,5.6,1.5,'#ffc27a',.25]); POOLS.append([bx_+dx,0,5.2,2.4,'#ffb066',.4])
    POOLS.append([bx_,-.9,7.75,2.2,'#ffb066',.25])
# Canal: dressed stone embankments, coping, cracked blue ice, snow banked in the corners.
for zf,sg in ((6,1),(9.5,-1)):
    for i in range(48):
        xa=-24+i; xb=xa+1
        if any(a0<=xa+.5<=a1 for a0,a1 in ((-15,-12),(-2,2),(12,15))): continue
        D.quad('stone' if i%3 else 'stoneDark',(xa,-.9,zf+sg*.004),(xb,-.9,zf+sg*.004),(xb,-.02,zf+sg*.004),(xa,-.02,zf+sg*.004))
        D.cbox('stoneLight',[xa+.5,.02,zf-sg*.2],[.98,.04,.4])
for i in range(70):
    x=rng.uniform(-23.5,23.5)
    if any(a0-.2<=x<=a1+.2 for a0,a1 in ((-15,-12),(-2,2),(12,15))): continue
    z=rng.uniform(6.3,9.2); a_=rng.uniform(0,math.pi); L=rng.uniform(.4,1.4)
    ribbon(D,'iceLight',(x,-.895,z),(x+L*math.cos(a_),-.895,max(6.1,min(9.4,z+L*math.sin(a_)))),.02)
for x in (-24,-15,-12,-2,2,12,15,24):
    for zz in (6.25,9.25): D.blob('snow',(x+(.3 if x in (-24,-12,2,15) else -.3),-.9,zz),.55,.25)
# Snow lying on the terraces and along the balustrade feet.
for side in (-1,1):
    for i in range(7):
        D.blob('snow',(side*(16.6+i*1.05),2.4,23.3),.6,.12)
c.data['presentation'].update(glows=GLOWS,pools=POOLS,embers=EMBERS,smoke=SMOKE,
    field=dict(kind='glitter',count=220,color='#eaf4ff',size=.06,min=[-28,.3,-22],max=[28,6,22]))
c.data['designNotes']=['Snow has no friction/visibility gameplay modifier.','North arcade and open south park are deliberately different bypasses.','Fictional ceremonial architecture; no named historical battle claim.','R4 material and sculptural pass preserves every authoritative collision, route, anchor and spawn.']
def court_art(m,o,a):
    (x,y,z),(w,h,d)=o['position'],o['size']; k=a.get('kind')
    x0,x1,z0,z1=x-w/2,x+w/2,z-d/2,z+d/2; y0,y1=(y,y+h) if o['type']=='ramp' else (y-h/2,y+h/2)
    box=lambda mat,a0,a1,b0,b1,c0,c1: m.box(mat,[a0,b0,c0],[a1,b1,c1])
    if k=='steps':
        ax=o['axis']; low=o['lowAt']; L=w if ax=='x' else d; n=max(2,round(h/.2))
        lo_end=(x if ax=='x' else z)+(L/2 if low>0 else -L/2); sg=-1 if low>0 else 1
        for i in range(n):
            a0,a1=sorted((lo_end+sg*L*i/n,lo_end+sg*L*(i+1)/n)); top=y+(i+.5)*h/n
            mat='stoneLight' if i%2 else o['material']
            if ax=='x': box(mat,a0,a1,y,top,z0,z1)
            else: box(mat,x0,x1,y,top,a0,a1)
            if ax=='x': box('snow',a0,min(a1,a0+.12),top-.002,top,z0+.15,z1-.15)
            else: box('snow',x0+.15,x1-.15,top-.002,top,a0,min(a1,a0+.12))
        return True
    if k=='bridge':
        # Body set back 2 cm; each canal-facing face is drawn as a shadowed arch in a
        # stone spandrel, so the abutment reads as a bridge rather than a block.
        box('stoneDark',x0+.02,x1-.02,y0,y1-.08,z0,z1); box('pavement',x0,x1,y1-.08,y1,z0,z1)
        top=y1-.08
        for fx,sg in ((x0,-1),(x1,1)):
            pts=[(z+1.4*math.cos(math.pi*i/10),y0+.55*math.sin(math.pi*i/10)) for i in range(11)]
            Q=(lambda *p: m.quad('stone',*p)) if sg>0 else (lambda a_,b_,c_,d_: m.quad('stone',d_,c_,b_,a_))
            for (za,ya),(zb,yb) in zip(pts,pts[1:]):
                Q((fx,ya,za),(fx,yb,zb),(fx,top,zb),(fx,top,za))
            for za,zb in ((z0,z-1.4),(z+1.4,z1)):
                Q((fx,y0,zb),(fx,y0,za),(fx,top,za),(fx,top,zb))
        return True
    if k in ('parapet','balustrade'):
        along_x=a['axis']=='x'
        box('stoneLight',x0,x1,y0,y0+.16,z0,z1)
        if along_x: box('limestone',x0+.06,x1-.06,y0+.16,y1-.14,z0+.05,z1-.05)
        else: box('limestone',x0+.05,x1-.05,y0+.16,y1-.14,z0+.06,z1-.06)
        box('stoneLight',x0,x1,y1-.14,y1,z0,z1)
        L=(x1-x0) if along_x else (z1-z0); n=max(1,int(L/.85))
        for j in range(n+1):
            t=(x0 if along_x else z0)+min(L-.16,max(0,j*L/n-.08))
            if along_x: box('stoneLight',t,t+.16,y0+.16,y1-.14,z0+.02,z1-.02)
            else: box('stoneLight',x0+.02,x1-.02,y0+.16,y1-.14,t,t+.16)
        if along_x: box('snow',x0+.05,x1-.05,y1-.002,y1,z0+.03,z1-.03)
        else: box('snow',x0+.03,x1-.03,y1-.002,y1,z0+.05,z1-.05)
        return True
    if k=='terrace':
        box('stone',x0+.04,x1-.04,y0,y1-.3,z0+.04,z1-.04)
        for row in range(int((y1-.3-y0)/.52)):
            yy=y0+row*.52
            box('limestone' if row%2 else 'stoneLight',x0,x1,yy+.02,yy+.5,z0,z1)
        box('stoneLight',x0,x1,y1-.3,y1-.06,z0,z1); box('pavement',x0,x1,y1-.06,y1,z0,z1)
        return True
    if k=='drift':
        along_x=a['axis']=='x'; n=10; L=(x1-x0) if along_x else (z1-z0); W=(z1-z0) if along_x else (x1-x0)
        def P(t,u,v):  # t along, u across -1..1 at height v
            return (x0+t,v,(z0+z1)/2+u*W/2) if along_x else ((x0+x1)/2+u*W/2,v,z0+t)
        prof=[(-1,0),(-.92,.45),(-.65,.85),(-.25,1),(.3,.96),(.7,.7),(.95,.3),(1,0)]
        for j in range(n):
            ta,tb=L*j/n,L*(j+1)/n
            sa=math.sin(math.pi*(j/n))**.35; sb=math.sin(math.pi*((j+1)/n))**.35
            for (ua,va),(ub,vb) in zip(prof,prof[1:]):
                q=[P(ta,ua,y0+va*h*sa),P(tb,ua,y0+va*h*sb),P(tb,ub,y0+vb*h*sb),P(ta,ub,y0+vb*h*sa)]
                m.quad('snow' if va+vb>.9 else 'snowShade',*(q if along_x else q[::-1]))
        return True
    if k=='lamppost':
        frustum(m,'iron',(x,y0,z),.15,.08,.3,6)
        beam(m,'iron',(x,y0+.3,z),(x,y1-.55,z),.05,6)
        lantern(m,x,y1-.55,z,1.0)
        return True
    return False
def crafted(m,o):
    if o['id'] in COURT_ART and COURT_ART[o['id']]: return court_art(m,o,COURT_ART[o['id']])
    if o['id']=='palace_portico':
        # The portico art is in the detail batch; a core hidden inside the south pier.
        m.cbox('limestone',[28.78,2.35,2.6],[.4,4.5,.38]); return True
    if o['id'].startswith('garden_urn_'):
        x=o['position'][0]; m.cbox('limestone',[x,3.1,22.8],[.5,1.1,.5]); return True
    if o['id'].startswith('west_window_bay_'):
        z=o['position'][2]; m.cbox('stoneDark',[-29.66,2.75,z],[.06,2.3,1.9]); return True
    if o['id'].startswith('south_wall_pier_'):
        x=o['position'][0]; m.cbox('stone',[x,1.5,23.63],[.7,2.9,.66]); return True
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
# 2026-10-29 frame rate: every remaining solid piece joins the court batch (one draw per
# material). Floors and wayfinding stay separate nodes so they keep out of the shadow pass.
for o in c.objects:
    if not o.get('batch') and o['role'] not in ('floor','wayfinding'): o['batch']='court'
c.save(render_object=crafted)
