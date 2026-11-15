"""Homeward's civic / workshop identity, fitted to the established combat geometry.

Only flat paving overlays, facade-bound details, and out-of-bounds architecture.
No eye-level foliage or decorative crates are placed in a playable route.
"""
import math
from glbkit import Mesh
from erakit import beam, gable


def ground(m, material, x0, x1, z0, z1, y=.011):
    m.quad(material, (x0,y,z1), (x1,y,z1), (x1,y,z0), (x0,y,z0))


def window(m, x, y, z, w=1, h=1.4):
    """Shallow recess placed directly against a solid south-facing wall."""
    m.cbox('ink',(x,y,z),(w+.18,h+.18,.05))
    m.cbox('paper',(x,y,z+.03),(w,h,.025))
    for xx in (x-w/2,x,x+w/2):
        m.cbox('timber',(xx,y,z+.055),(.055,h+.12,.04))
    for yy in (y-h/2,y,y+h/2):
        m.cbox('timber',(x,yy,z+.055),(w+.12,.055,.04))
    m.cbox('stone',(x,y-h/2-.12,z+.035),(w+.35,.12,.25))


def tree(m, x, z, height=9, radius=2.7):
    # All trees are beyond the arena walls: no silhouette concealment in combat.
    beam(m,'timber',(x,-.2,z),(x,height*.7,z),.16,6)
    for dx,dz,dy,r in ((0,0,0,1),(-.7,.4,-.7,.7),(.8,-.2,-.3,.75),(0,0,1,.7)):
        m.blob('foliage',(x+dx*radius,height+dy,z+dz*radius),radius*r,.8)


def civic_finish(objects):
    nodes=[]
    paving=Mesh()
    # Readable material families correspond to the existing tactical callouts.
    ground(paving,'courtyard',-18,-6,-12,0)
    ground(paving,'timber',6,18,0,12)
    ground(paving,'hall_tile',-5.27,5.27,-5.27,5.27)
    ground(paving,'cobble',-16,16,-21.5,-16.81)
    ground(paving,'street_tile',-18,18,12.1,14.7)
    # Thin, flush border stones mark changes of surface, never create trip hazards.
    for x0,x1,z0,z1 in ((-18,-6,-12,0),(6,18,0,12),(-5.27,5.27,-5.27,5.27)):
        for z in (z0,z1): ground(paving,'stone',x0,x1,z-.10,z+.10,.014)
        for x in (x0,x1): ground(paving,'stone',x-.10,x+.10,z0,z1,.014)
    # Thresholds lead the eye through the four offset doors. Their physical width is unchanged.
    for x,z,w,d in ((-5.4,-2.6,.6,2.3),(5.4,2.6,.6,2.3),(2.6,-5.4,2.3,.6),(-2.6,5.4,2.3,.6)):
        ground(paving,'paper',x-w/2,x+w/2,z-d/2,z+d/2,.016)
    # Drain grates are inlaid rather than raised cover.
    for s in (-1,1):
        for z in (-8.3,8.3):
            ground(paving,'ink',s*24-.5,s*24+.5,z-.2,z+.2,.017)
            for dx in (-.4,-.2,0,.2,.4): ground(paving,'metal',s*24+dx-.025,s*24+dx+.025,z-.18,z+.18,.019)
    nodes.append(('courtyard_surface_identity',paving,dict(decorative=True,role='ground_finish')))

    facade=Mesh()
    # Existing solid cover gets useful environmental meaning: lamp-yard masonry and cargo stacks.
    for o in objects:
        x,y,z=o['position'];w,h,d=o['size']
        if o['id'] in ('cargo_cover','cargo_crossing_cover','cargo_stack'):
            for side in (-1,1):
                zz=z+side*(d/2+.012)
                for xx in (x-w/2+.1,x+w/2-.1): facade.cbox('metal',(xx,y,zz),(.10,h-.1,.025))
                for yy in (y-h/2+.12,y+h/2-.12): facade.cbox('metal',(x,yy,zz),(w-.1,.07,.025))
                facade.cbox('paper',(x,y+.25,zz+side*.02),(.60,.45,.018))
                # A simple shipping diamond has no readable text to alias at distance.
                p=[(x,y+.43,zz+side*.031),(x+.18,y+.25,zz+side*.031),(x,y+.07,zz+side*.031),(x-.18,y+.25,zz+side*.031)]
                facade.quad('red',*p)
        if o['id'] in ('lamp_cover','lamp_crossing_cover'):
            facade.cbox('courtyard',(x,y+h/2+.025,z),(w+.02,.05,d+.02))
            for side in (-1,1):
                for xx in (x-w*.32,x+w*.32):
                    facade.cbox('stone',(xx,y,z+side*(d/2+.012)),(.22,h,.024))
        # The four thick return screens are clearly solid town walls, not traversable doors.
        if o['id'].startswith('spawn_screen'):
            facade.cbox('roof',(x,y+h/2+.055,z),(w+.05,.11,d+.05))
            for zz in (z-d/2+.12,z+d/2-.12): facade.cbox('stone',(x,y,zz),(w+.025,h,.2))
        if o['id'].startswith(('workshop','living','outer_shutter','outer_shop')):
            # Horizontal plaster/brick division and all four corner posts ground the house mass.
            for side in (-1,1):
                zz=z+side*(d/2+.015)
                facade.cbox('brick',(x,.45,zz),(w,.9,.03))
                facade.cbox('metal',(x,h-.25,zz),(w,.05,.05))
                # Lattice frieze stays above the sightline and inside the facade silhouette.
                for xx in [x-w/2+.45+k*.7 for k in range(max(1,int((w-.8)/.7)))]:
                    beam(facade,'timber',(xx,h-.9,zz),(xx+.4,h-.35,zz),.025,4)
            for xx in (x-w/2-.015,x+w/2+.015):
                facade.cbox('brick',(xx,.45,z),(.03,.9,d))
                facade.cbox('timber',(xx,h-.1,z),(.04,.15,d))
    # Cargo canopy already has a physical roof collider: cloth sits on that roof, not over a new lane.
    for i in range(12):
        x=8.02+i*.5
        facade.cbox('canvas' if i%2 else 'red',(x+.23,3.515,9),(.46,.025,3.94))
        facade.cbox('canvas' if i%2 else 'red',(x+.23,3.33,7.025),(.46,.30,.025))
    # Lamp enclosure remains within its existing .65 m square; a brass sun crest makes it identifiable.
    for axis in (0,2):
        for side in (-1,1):
            for delta in (-.18,.18):
                pos=[-11,3.65,-10];pos[axis]+=side*.34;pos[2 if axis==0 else 0]+=delta
                facade.cbox('brass',pos,(.025,.7,.025))
    for angle in range(8):
        a=angle*math.tau/8
        beam(facade,'brass',(-11+math.sin(a)*.15,4.18,-10+math.cos(a)*.15),(-11+math.sin(a)*.36,4.18,-10+math.cos(a)*.36),.025,4)
    # Bay numbers are broad geometric markers on sealed facades, not distracting text in a firing lane.
    for s,mat in ((-1,'roof'),(1,'red')):
        x=s*11
        facade.cbox(mat,(x,3.8,-16.77),(2.6,.8,.035))
        for dx in (-.6,0,.6): facade.cbox('paper',(x+dx,3.8,-16.743),(.12,.40,.022))
        # A workshop fan / ventilation louvre uses the solid front wall as its backing.
        for i in range(7): facade.cbox('metal',(x,1.9+i*.13,-16.76),(2,.045,.04))
    # Existing public notice cabinet gains timber dividers and a copper fascia.
    for side in (-1,1):
        facade.cbox('brass',(0,3.12,side*1.625),(2.95,.11,.035))
        for xx in (-.6,.6):facade.cbox('timber',(xx,1.7,side*1.669),(.05,1.8,.024))
    nodes.append(('civic_facade_craft',facade,dict(decorative=True,role='facade_finish')))

    skyline=Mesh()
    # A single civic clock tower marks north / the radio terrace from both yards.
    # Everything in this batch is beyond the collision perimeter, never mistaken for playable cover.
    skyline.cbox('earth',(0,-.68,0),(256,.5,208))
    # Raise only the OOB skirt bands to building ground level, never coplanar with arena floor.
    for s in (-1,1):
        skyline.cbox('earth',(s*79,-.225,0),(98,.45,208))
        skyline.cbox('earth',(0,-.225,s*63),(60,.45,82))
    skyline.cbox('stone',(0,1,-28),(5,2,5))
    skyline.cbox('plaster',(0,6,-28),(4.3,10,4.3))
    for x in (-2.13,2.13):
        skyline.cbox('timber',(x,6,-25.82),(.14,10,.12))
    for y in (2,5.4,9.6,10.8): skyline.cbox('stone',(0,y,-28),(4.65,.16,4.65))
    window(skyline,0,3.8,-25.81,1.3,1.9)
    # Clock is 24 segments; face and hands are geometry, so it stays crisp at runtime.
    cy,cz=8.1,-25.78
    for i in range(24):
        a=i*math.tau/24;b=(i+1)*math.tau/24
        p=(math.sin(a)*1.35,cy+math.cos(a)*1.35,cz)
        q=(math.sin(b)*1.35,cy+math.cos(b)*1.35,cz)
        skyline.tri('paper',(0,cy,cz),p,q)
        beam(skyline,'brass',p,q,.055,4)
        if i%2==0:
            beam(skyline,'ink',(math.sin(a)*1.08,cy+math.cos(a)*1.08,cz+.03),(math.sin(a)*1.21,cy+math.cos(a)*1.21,cz+.03),.035,4)
    beam(skyline,'ink',(0,cy,cz+.05),(-.56,cy+.65,cz+.05),.06,4)
    beam(skyline,'ink',(0,cy,cz+.055),(.73,cy+.12,cz+.055),.04,4)
    gable(skyline,'roof','plaster',-2.4,2.4,-30.4,-25.6,11.1,13.3,rows=12,row_mat='metal')
    beam(skyline,'brass',(0,13.4,-28),(0,14.4,-28),.06,6)
    # South-side street fronts and groves complete the view, rather than a floating rectangle in sky.
    for x,z,w,h in ((-26,28,8,5.7),(-15,29,9,7.1),(-2,29,9,5.9),(11,28,8,6.8),(24,29,9,5.8)):
        skyline.cbox('plaster',(x,h/2,z),(w,h,5))
        gable(skyline,'roof','plaster',x-w/2,x+w/2,z-2.5,z+2.5,h,h+1.7,rows=11,row_mat='metal')
        # North-facing fronts remain shallow: visual town beyond the hard boundary.
        for dx in (-w*.28,w*.28):
            skyline.cbox('ink',(x+dx,2.8,z-2.52),(1.4,1.8,.04))
            skyline.cbox('glow',(x+dx,2.8,z-2.55),(1.16,1.5,.025))
            skyline.cbox('timber',(x+dx,2.8,z-2.57),(.06,1.6,.03))
    for x,z,h,r in ((-35,-16,9,2.4),(-36,12,10,2.7),(36,-15,8,2.5),(36,18,11,3),(20,36,10,3),(-22,35,10,3)):
        tree(skyline,x,z,h,r)
    # Correctly oriented waterwheel beside the eastern canal; no playable invisible walls.
    ground(skyline,'water',31,35,-20,22,.015)
    for side in (-1,1):
        xx=33+side*.45
        for i in range(24):
            a=i*math.tau/24;b=(i+1)*math.tau/24
            p=(xx,2.7+2.7*math.sin(a),8+2.7*math.cos(a));q=(xx,2.7+2.7*math.sin(b),8+2.7*math.cos(b))
            beam(skyline,'timber',p,q,.12,5)
        for i in range(8):
            a=i*math.tau/8
            beam(skyline,'timber',(xx,2.7,8),(xx,2.7+2.6*math.sin(a),8+2.6*math.cos(a)),.07,4)
    for i in range(16):
        a=i*math.tau/16
        beam(skyline,'timber',(32.5,2.7+2.6*math.sin(a),8+2.6*math.cos(a)),(33.5,2.7+2.6*math.sin(a),8+2.6*math.cos(a)),.18,4)
    beam(skyline,'metal',(31.7,2.7,8),(34.3,2.7,8),.13,8)
    nodes.append(('homeward_clock_station_and_canal',skyline,dict(decorative=True,role='backdrop')))
    return nodes
