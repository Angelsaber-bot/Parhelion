"""SUNTEMPLE 日轮神殿: a sun temple on the river, anime fiction after the New Kingdom temples.
Run: python3 arena-maps/suntemple/source/build.py        (add --materials to re-synthesise surfaces)

Play idea: three readings of one temple axis; the main decision is when to expose yourself
crossing open ground for a better angle.
  * the hypostyle hall: papyrus columns under a roof, a forest of thin cover, with its middle
    row fallen so a lateral aisle crosses the hall;
  * the hall roof: two terraces joined by an exposed bridge, the rest of the roof built up into
    a clerestory sanctuary and roof chapels. Each terrace has its own outer stair; a public
    stair inside the hall rises to the bridge, so no terrace can be held from one spot;
  * the sun court: two colossi, obelisks and a sunken lotus basin with three ways out.
Teams start behind the west and east pylons in three spawn pockets; a screen wall inside each
gate cuts the roof's line into the spawn court. The north sphinx avenue is the flank.
Collision is mirrored in x.

Revised 2026-11 from the arena map design report (S01-S05): spawn screen and pockets, roof
terraces, public stair, lateral aisle, basin steps and avenue stelae.
"""
from pathlib import Path
import sys, math, random
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT.parent / '_lib'))
from glbkit import Mesh
from chapterkit import mat, beam, cone, frustum, flame, brazier, mountain
from erakit import Era, ext, place, lathe, loft, rect, tbox, steps, rope, scatter, synth_materials, bind_textures

P = dict(
    sand=mat('#d9bb86'), sandDune=mat('#e4c592'), sandShade=mat('#c5a271'),
    limestone=mat('#e6d8bb'), limestoneShade=mat('#cdbd9c'), sandstone=mat('#d2a874'), sandstoneDark=mat('#b38a5c'), sandstoneLight=mat('#e2bf8b'),
    granite=mat('#8e4f45'), graniteDark=mat('#5d3631'), basalt=mat('#33343a'),
    lapis=mat('#2f5f9e', .05, .5), lapisDark=mat('#1f3f74', .05, .5), ochre=mat('#b6492f'), malachite=mat('#2f8a76'), turquoise=mat('#3fa7a8', .05, .45),
    white=mat('#f0e9d8'), black=mat('#24211f'), gold=mat('#d7a940', .78, .32), goldPale=mat('#e9c76a', .72, .36),
    water=('#3e9fb0', .1, .26, 0, .78), waterDeep=mat('#2a6f86', .05, .2), lotus=mat('#4f8a52'), lotusFlower=mat('#f1c6d2'), papyrus=mat('#6f9a4f'), papyrusHead=mat('#9ab86a'),
    palm=mat('#5f8a43'), palmDark=mat('#46703a'), palmTrunk=mat('#8a6a48'), linen=mat('#f2eadb'), linenShade=mat('#d7cbb6'), cedar=mat('#7a5634'),
    distant=mat('#d8b98d'), distantShade=mat('#c39d70'), pyramid=mat('#e3cda2'),
    flame=mat('#ff9a3c', 0, 1, 3.2), flameCore=mat('#ffe6a0', 0, 1, 4.5), coal=mat('#c2461e', 0, .9, 1.6), iron=mat('#47413a', .55, .5),
    sunDisc=mat('#ffd36b', .5, .3, 1.6))
c = Era(ROOT, 'suntemple', 'SUNTEMPLE 日轮神殿', 60, 48, 'sunblaze', P, height=12, lowest=-1.2); D = c.detail
rng = random.Random(1352)
ROOF = 5.2; ROOFTOP = 5.6

def proxy(id, x0, x1, y0, y1, z0, z1):
    """Collision-only part of a modelled object drawn by a visual-only object: bullets meet the
    model's actual mass, not its bounding box (2026-11 bullet-fit pass)."""
    c.B(id, x0, x1, y0, y1, z0, z1, 'sandstone', 'cover', dict(kind='proxy'))

# ------------------------------------------------------------------ collision layout
c.B('floor_north', -30, 30, -1, 0, -24, 11, 'sand', 'floor')
c.B('floor_south', -30, 30, -1, 0, 19, 24, 'sand', 'floor')
for sx in (-1, 1):
    c.B(f'floor_court_{sx}', sx * 30, sx * 7, -1, 0, 11, 19, 'sand', 'floor')
c.B('basin_floor', -7, 7, -2.2, -1.2, 11, 19, 'waterDeep', 'floor', dict(kind='basinfloor'))
for sx in (-1, 1):
    c.B(f'boundary_x_{sx}', sx * 30, sx * 29.4, 0, 5, -24, 24, 'sandstone', 'structure', dict(kind='enclosure', face=-sx, axis='x'))
for sz in (-1, 1):
    c.B(f'boundary_z_{sz}', -29.4, 29.4, 0, 5, sz * 24, sz * 23.4, 'sandstone', 'structure', dict(kind='enclosure', face=-sz, axis='z'))

# Hypostyle hall: walls, thirty columns and a walkable roof.
HX, HZ0, HZ1 = 11, -15, 5
# The roof slab casts the hall's shade; it is open only over the public stair's upper flight.
WELL = (-1.2, 1.2, -12.1, -5.5)   # stairwell through the roof: x0, x1, z0, z1
for i, (x0, x1, z0, z1) in enumerate(((-HX, WELL[0], HZ0, HZ1), (WELL[1], HX, HZ0, HZ1), (WELL[0], WELL[1], HZ0, WELL[2]), (WELL[0], WELL[1], WELL[3], HZ1))):
    c.B(f'hall_roof_{i}', x0, x1, ROOF, ROOFTOP, z0, z1, 'sandstone', 'structure', dict(kind='roof'))
for sx in (-1, 1):
    c.B(f'hall_wall_side_{sx}_door', sx * HX, sx * (HX - .6), 0, ROOF, HZ0, HZ0 + .6, 'sandstone', 'structure', dict(kind='wall', face=sx, axis='x'))
    c.B(f'hall_wall_side_{sx}', sx * HX, sx * (HX - .6), 0, ROOF, HZ0 + 2.4, HZ1, 'sandstone', 'structure', dict(kind='wall', face=sx, axis='x'))
    c.B(f'hall_lintel_side_{sx}', sx * HX, sx * (HX - .6), 3.1, ROOF, HZ0 + .6, HZ0 + 2.4, 'sandstone', 'structure', dict(kind='lintel', axis='z'))
# south wall (court side): central door and two side doors; north wall: central door.
SOUTH = [(-HX, -9.4), (-7.6, -1.5), (1.5, 7.6), (9.4, HX)]
for i, (x0, x1) in enumerate(SOUTH):
    c.B(f'hall_wall_south_{i}', x0, x1, 0, ROOF, HZ1 - .6, HZ1, 'sandstone', 'structure', dict(kind='wall', face=1, axis='z'))
for i, (x0, x1) in enumerate(((-9.4, -7.6), (-1.5, 1.5), (7.6, 9.4))):
    c.B(f'hall_lintel_south_{i}', x0, x1, 3.4 if i == 1 else 3.1, ROOF, HZ1 - .6, HZ1, 'sandstone', 'structure', dict(kind='lintel', axis='x'))
for i, (x0, x1) in enumerate(((-HX, -9.4), (-7.6, 7.6), (9.4, HX))):
    c.B(f'hall_wall_north_{i}', x0, x1, 0, ROOF, HZ0, HZ0 + .6, 'sandstone', 'structure', dict(kind='wall', face=-1, axis='z'))
for i, (x0, x1) in enumerate(((-9.4, -7.6), (7.6, 9.4))):
    c.B(f'hall_lintel_north_{i}', x0, x1, 3.1, ROOF, HZ0, HZ0 + .6, 'sandstone', 'structure', dict(kind='lintel', axis='x'))
COLX = (-8.25, -4.95, -1.65, 1.65, 4.95, 8.25); COLZ = (-11.4, -8.1, -4.8, -1.5, 1.8)
FALLEN_ROW = 2                       # z = -4.8: only stumps below step height remain
STAIR_COLS = {(2, 0), (3, 0), (2, 1), (3, 1)}
for i, x in enumerate(COLX):
    for k, z in enumerate(COLZ):
        if k == FALLEN_ROW or (i, k) in STAIR_COLS: continue
        c.B(f'column_{i}_{k}', x - .62, x + .62, 0, ROOF, z - .62, z + .62, 'sandstone', 'structure', dict(kind='column', nave=abs(x) < 2), collision=False)
        # round shaft as an octagon of three boxes; square base and abacus as modelled
        cid = f'column_{i}_{k}'
        proxy(f'{cid}_base', x - .56, x + .56, 0, .24, z - .56, z + .56)
        for j, (hx, hz) in enumerate(((.52, .215), (.215, .52), (.37, .37))): proxy(f'{cid}_shaft_{j}', x - hx, x + hx, .24, ROOF - .42, z - hz, z + hz)
        proxy(f'{cid}_abacus', x - .62, x + .62, ROOF - .42, ROOF, z - .62, z + .62)
# Public stair (S02): two flights rise from the north doors to a landing on the axis, then one
# flight climbs the nave through the roof well to the bridge between the terraces.
STAIR_MID = 2.8
c.B('sun_stair_landing', -1.2, 1.2, 0, STAIR_MID, HZ0 + .6, WELL[2], 'sandstone', 'structure', dict(kind='stairblock', face='landing'))
c.B('sun_stair_base', -1.2, 1.2, 0, STAIR_MID, WELL[2], WELL[3], 'sandstone', 'structure', dict(kind='stairblock', face='base'))
c.R('sun_stair_upper', -1.2, 1.2, STAIR_MID, ROOFTOP, WELL[2], WELL[3], 'z', -1, 'limestone', dict(kind='steps'))
for sx in (-1, 1):
    c.R(f'sun_stair_{sx}', sx * 1.2, sx * 7, 0, STAIR_MID, HZ0 + .6, WELL[2], 'x', sx, 'limestone', dict(kind='steps'))
# Roof parapets: cover on the high ground, open where the stairs arrive.
# Roof (S02): a west and an east terrace (x 4.2..10.55, z -11.2..4.55) joined by a bridge along the
# south edge (z 0.8..4.55). Everything else is built up 2.8 m (out of jump reach): the clerestory
# sanctuary over the nave with the stair's covered passage through it, two roof chapels at the
# north corners and a kiosk on each terrace's south-west corner, so a terrace watches part of
# the court through one opening instead of patrolling the whole edge.
BUILT = ROOFTOP + 2.8
TER_N, BRIDGE_N = -11.2, .8
for i, (x0, x1) in enumerate(((-6.6, -1.4), (1.4, 6.6))):
    c.B(f'roof_parapet_south_{i}', x0, x1, ROOFTOP, ROOFTOP + 1.0, HZ1 - .45, HZ1, 'limestone', 'cover', dict(kind='parapet', axis='x'))
for sx in (-1, 1):
    side = 'w' if sx < 0 else 'e'
    for i, (z0, z1) in enumerate(((-7.4, -2.2), (-.2, 2.0))):
        c.B(f'roof_parapet_side_{sx}_{i}', sx * HX, sx * (HX - .45), ROOFTOP, ROOFTOP + 1.0, z0, z1, 'limestone', 'cover', dict(kind='parapet', axis='z'))
    c.R(f'roof_stair_{sx}', sx * 13.6, sx * HX, 0, ROOFTOP, -10.6, 3.4, 'z', 1, 'limestone', dict(kind='roofstair', sx=sx))
    c.B(f'roof_sanctuary_{side}', sx * WELL[1], sx * 4.2, ROOFTOP, BUILT, HZ0, BRIDGE_N, 'sandstone', 'structure', dict(kind='sanctuary', face=(0, sx, 1), disc=False))
    c.B(f'roof_chapel_{side}', sx * 4.2, sx * HX, ROOFTOP, BUILT, HZ0, TER_N, 'sandstone', 'structure', dict(kind='sanctuary', face=(1, 0, 0), disc=False))
    c.B(f'roof_kiosk_{side}', sx * 6.6, sx * HX, ROOFTOP, BUILT, 2.0, HZ1, 'sandstone', 'structure', dict(kind='sanctuary', face=(-1, -sx, 0), disc=False))
    # one altar on each terrace: cover for one task at a time, not for the court, stair and bridge at once
    c.B(f'roof_altar_{side}', sx * 8.2, sx * 7.0, ROOFTOP, ROOFTOP + 1.2, -4.4, -3.0, 'granite', 'cover', dict(kind='offering'))
    c.anchor(f'cover_terrace_{side}', 'cover', [sx * 9.2, ROOFTOP, -3.7], height=1.2)
c.B('roof_sanctuary_n', WELL[0], WELL[1], ROOFTOP, BUILT, HZ0, WELL[2], 'sandstone', 'structure', dict(kind='sanctuary', face=(0, 0, 1), disc=True))
# The stair's passage leaves the sanctuary facing a short screen, so whoever arrives turns
# toward one terrace instead of standing in both terraces' fire.
c.B('roof_bridge_screen', -1.6, 1.6, ROOFTOP, ROOFTOP + 1.8, 2.2, 2.6, 'granite', 'cover', dict(kind='screenwall', axis='z'))

# Pylon gates in front of each spawn court.
for sx in (-1, 1):
    team = 'west' if sx < 0 else 'east'
    for sz in (-1, 1):
        c.B(f'pylon_{team}_{sz}', sx * 22.6, sx * 20.4, 0, 9, sz * 3, sz * 10, 'sandstone', 'structure', dict(kind='pylon', sx=sx, sz=sz))
    # S01: the gate head comes down to 3.4 m, so high ground east of it cannot look down through the gate
    c.B(f'pylon_lintel_{team}', sx * 22.4, sx * 20.6, 3.4, 7.4, -3, 3, 'sandstone', 'structure', dict(kind='gatelintel'))
    # Spawn court (S01): a screen wall inside the gate cuts the roof's line through the gate
    # opening; three pockets (centre behind the screen, north and south behind the pylons) each
    # leave by their own side.
    c.B(f'gate_screen_{team}', sx * 25.6, sx * 25.0, 0, 3.6, -4.0, 4.0, 'sandstone', 'structure', dict(kind='screenwall', axis='x'))
    for i, (x, z) in enumerate(((27.6, -1.6), (27.6, 1.6), (24.2, -7.0), (24.2, 7.0))):   # side pockets in the pylons' shadow
        c.anchor(f'spawn_{team}_{i}', 'spawn', [sx * x, 0, z], yaw=-sx * 1.5708, team=team)
    c.B(f'spawn_mark_{team}', sx * 28.4, sx * 26.8, 0, .04, -2.4, 2.4, 'lapis' if sx < 0 else 'ochre', 'wayfinding', collision=False)
    for sz in (-1, 1):
        c.B(f'spawn_mark_{team}_{sz}', sx * 25.0, sx * 23.4, 0, .04, sz * 6.2, sz * 7.8, 'lapis' if sx < 0 else 'ochre', 'wayfinding', collision=False)
    c.anchor(f'cover_pylon_{team}', 'cover', [sx * 23.3, 0, 6], height=9)
    c.anchor(f'cover_screen_{team}', 'cover', [sx * 24.4, 0, 0], height=3.6)
    # offering stands divide the centre pocket from the side pockets
    for sz in (-1, 1):
        c.B(f'offering_{team}_{sz}', sx * 29.0, sx * 28.0, 0, 1.2, sz * 4.4, sz * 5.8, 'granite', 'cover', dict(kind='offering'))
    # forecourt: fallen column drums and a toppled statue between pylon and hall
    c.B(f'drums_{team}', sx * 16.6, sx * 14.4, 0, 1.15, -6.4, -4.2, 'sandstone', 'cover', dict(kind='drums', sx=sx))
    c.B(f'fallen_{team}', sx * 17.8, sx * 15.4, 0, 1.3, 9.6, 13.2, 'granite', 'cover', dict(kind='fallen', sx=sx))
    c.B(f'palm_bed_{team}', sx * 18.2, sx * 15.8, 0, .5, -1.2, 1.2, 'sandstone', 'cover', dict(kind='palmbed'))
    c.anchor(f'cover_drums_{team}', 'cover', [sx * 15.5, 0, -3.5], height=1.15)
    c.anchor(f'cover_fallen_{team}', 'cover', [sx * 16.6, 0, 14], height=1.3)
    # sun court: a colossus either side of the central door, an obelisk outside each
    c.B(f'colossus_{team}', sx * 6.2, sx * 3.6, 0, 5.8, 6.4, 9.6, 'sandstone', 'cover', dict(kind='colossus', sx=sx), collision=False)
    c.B(f'obelisk_{team}', sx * 10.9, sx * 9.5, 0, 8.6, 8.3, 9.7, 'granite', 'structure', dict(kind='obelisk'), collision=False)
    # seated king (model faces +z from his centre): plinth, throne, back, legs, torso, head, crown
    kx, kz = sx * 4.9, 8.0
    for part, (hx, za, zb, ya, yb) in dict(plinth=(1.3, -1.6, 1.6, 0, .55), throne=(1.15, -1.55, .35, .55, 2.15), back=(.95, -1.55, -1.15, 2.15, 3.75),
                                            legs=(.63, -.65, 1.45, .55, 2.4), torso=(.78, -1.12, -.22, 2.4, 3.75), head=(.62, -1.0, -.2, 3.75, 4.72),
                                            crown=(.44, -1.0, -.3, 4.72, 5.62)).items():
        proxy(f'colossus_{team}_{part}', kx - hx, kx + hx, ya, yb, kz + za, kz + zb)
    # obelisk: base, a shaft in two tapering steps, pyramidion
    ox, oz = sx * 10.2, 9.0
    for part, (h, ya, yb) in dict(base=(.7, 0, .5), lower=(.46, .5, 4.2), upper=(.38, 4.2, 7.9), tip=(.2, 7.9, 8.45)).items():
        proxy(f'obelisk_{team}_{part}', ox - h, ox + h, ya, yb, oz - h, oz + h)
    c.anchor(f'cover_colossus_{team}', 'cover', [sx * 4.9, 0, 10.4], height=5.8)
    # north avenue sphinxes face the barque shrine
    for i, (x0, x1) in enumerate(((5, 8.6), (11, 14.6), (17, 20.6))):
        c.B(f'sphinx_{team}_{i}', sx * x0, sx * x1, 0, 1.7, -21.6, -19.8, 'sandstone', 'cover', dict(kind='sphinx', sx=sx), collision=False)
        # plinth, then one block for body and head (tall enough that the plinth is no step onto its back);
        # the forepaws and the space beside the flanks are open
        mx = sx * (x0 + x1) / 2
        proxy(f'sphinx_{team}_{i}_plinth', *sorted((sx * x0, sx * x1)), 0, .35, -21.6, -19.8)
        proxy(f'sphinx_{team}_{i}_body', *sorted((mx - sx * 1.6, mx + sx * 1.14)), .35, 1.75, -20.7 - .52, -20.7 + .52)
        c.anchor(f'cover_sphinx_{team}_{i}', 'cover', [sx * (x0 + x1) / 2, 0, -19.2], height=1.7)
    # avenue stela (S05): a push node between the spawn side and the hall's north door
    c.B(f'stela_{team}', sx * 14.6, sx * 13.0, 0, 2.6, -17.6, -16.0, 'granite', 'cover', dict(kind='stela', sx=sx))
    c.anchor(f'cover_stela_{team}', 'cover', [sx * 13.8, 0, -15.3], height=2.6)
    # south lane offering tables against the enclosure
    for i, (x0, x1) in enumerate(((8, 10.4), (16, 18.4))):
        c.B(f'table_{team}_{i}', sx * x0, sx * x1, 0, 1.0, 22.4, 23.4, 'limestone', 'cover', dict(kind='table'))
    # basin steps
    c.R(f'basin_steps_{team}', sx * 7, sx * 4.6, -1.2, 0, 13.4, 16.6, 'x', -sx, 'limestone', dict(kind='bsteps'))
    # S04: a third way out, up to the south lane beside the barque, off the bridge's axis
    c.R(f'basin_steps_south_{team}', sx * 4.4, sx * 2.4, -1.2, 0, 16.8, 19.0, 'z', -1, 'limestone', dict(kind='bsteps'))
c.B('barque_shrine', -2.6, 2.6, 0, 3.6, -21.8, -18, 'granite', 'structure', dict(kind='shrine'))
c.B('basin_barque', -2.2, 2.2, -1.2, -.15, 14.3, 15.7, 'gold', 'cover', dict(kind='barque'))
for sx in (-1, 1):
    c.anchor(f'cover_basin_{sx}', 'cover', [sx * 3, -1.2, 12.2], height=1.2)
c.anchor('objective_basin', 'objective', [0, -1.2, 12.4], radius=2)
c.anchor('objective_roof', 'objective', [0, ROOFTOP, 1.5], radius=2)
c.anchor('objective_shrine', 'objective', [0, 0, -16.6], radius=2)
c.anchor('cover_hall', 'cover', [-3.3, 0, -6.45], height=ROOF)

c.route('south_lane', [[-27, 0, 2], [-27, 0, 20.6], [27, 0, 20.6], [27, 0, 2]])
c.route('sphinx_avenue', [[-27, 0, -2], [-27, 0, -18.7], [-11.5, 0, -18.7], [-11.5, 0, -17.2], [11.5, 0, -17.2], [11.5, 0, -18.7], [27, 0, -18.7], [27, 0, -2]])
c.route('hypostyle', [[-27, 0, 0], [-27, 0, -11.5], [-19, 0, -13.7], [-9.6, 0, -13.7], [-9.6, 0, -6.45], [-6.6, 0, -6.45], [-6.6, 0, 3.4], [0, 0, 3.4], [0, 0, 6.2], [0, 0, 10.4]])
c.route('lateral_aisle', [[-9.6, 0, -4.8], [9.6, 0, -4.8]])
c.route('hall_roof', [[-12.3, 0, 4.4], [-12.3, ROOFTOP, -10.35], [-9.4, ROOFTOP, -10.35], [-5.4, ROOFTOP, -1.0], [-5.4, ROOFTOP, 3.6], [5.4, ROOFTOP, 3.6], [5.4, ROOFTOP, -1.0], [9.4, ROOFTOP, -10.35], [12.3, ROOFTOP, -10.35], [12.3, 0, 4.4]])
c.route('public_stair', [[-8.5, 0, -17.0], [-8.5, 0, -13.25], [0, STAIR_MID, -13.25], [0, STAIR_MID, -12.0], [0, ROOFTOP, -5.3], [0, ROOFTOP, 1.5], [-2.6, ROOFTOP, 1.5], [-2.6, ROOFTOP, 3.6], [-5.4, ROOFTOP, 3.6], [-5.6, ROOFTOP, -2.0]])
c.route('lotus_basin', [[-12, 0, 15], [-4, -1.2, 15], [-3, -1.2, 12.3], [3, -1.2, 12.3], [4, -1.2, 15], [12, 0, 15]])
c.route('lotus_steps', [[-3.4, 0, 21.0], [-3.4, -1.2, 16.4], [-3.4, -1.2, 12.3]])
c.route('north_door', [[8.5, 0, -17.0], [8.5, 0, -13.25], [9.6, 0, -13.25], [9.6, 0, -6.45], [3.3, 0, -6.45], [3.3, 0, 0]])

# ------------------------------------------------------------------ painted relief helpers
def face_frame(o, face, axis):
    """Return (u0,u1,y0,y1,plane,sign) for the painted face of a wall box."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    if axis == 'x': return (z0, z1, y0, y1, x1 if face > 0 else x0, face)
    return (x0, x1, y0, y1, z1 if face > 0 else z0, face)


def paint(m, material, axis, plane, sign, u0, u1, v0, v1, depth=.006):
    """Flat painted panel lying just inside the face plane (never outside the collider)."""
    p = plane - sign * depth
    if axis == 'x':
        a, b, cc, d = (p, v0, u0), (p, v0, u1), (p, v1, u1), (p, v1, u0)
    else:
        a, b, cc, d = (u0, v0, p), (u1, v0, p), (u1, v1, p), (u0, v1, p)
    q = (a, b, cc, d)
    # front faces outward: for +x the quad (z0->z1) is CCW from +x when ... decide by sign
    if (axis == 'x') == (sign > 0): m.quad(material, *q[::-1])
    else: m.quad(material, *q)


def relief_figure(m, axis, plane, sign, u, v, s=1.0, colour='ochre', facing=1, offering=False):
    """A striding painted figure in profile: kilt, torso, arms, wig; stylised, no script."""
    def P(mat_, a, b, c_, d_): paint(m, mat_, axis, plane, sign, u + facing * a * s if facing > 0 else u - b * s, u + facing * b * s if facing > 0 else u - a * s, v + c_ * s, v + d_ * s, .004)
    P('black', -.08, .1, 1.5, 1.7)                # wig
    P(colour, -.05, .08, 1.36, 1.52)              # face
    P(colour, -.12, .12, .92, 1.36)               # torso
    P('white', -.14, .16, .55, .92)               # kilt
    P('gold', -.13, .15, .9, .95)                 # belt
    P(colour, -.12, -.03, 0, .56); P(colour, .05, .14, 0, .56)    # striding legs
    P(colour, .1, .36, 1.18, 1.26)                # forward arm
    if offering: P('gold', .32, .46, 1.18, 1.36)  # offering bowl
    P('lapis', -.16, .16, 1.3, 1.36)              # broad collar


def winged_disc(m, axis, plane, sign, u, v, w, depth=.006):
    """Sun disc with spread wings across a lintel, inside the face."""
    paint(m, 'gold', axis, plane, sign, u - .22 * w / 3, u + .22 * w / 3, v - .2 * w / 3, v + .2 * w / 3, depth)
    for k, (span, hh, col) in enumerate(((w * .48, .07, 'lapis'), (w * .44, .07, 'turquoise'), (w * .4, .06, 'ochre'), (w * .34, .06, 'lapis'))):
        y = v + .12 - k * .1
        paint(m, col, axis, plane, sign, u - span, u - .25 * w / 3, y - hh, y, depth)
        paint(m, col, axis, plane, sign, u + .25 * w / 3, u + span, y - hh, y, depth)


# ------------------------------------------------------------------ object art
def wall(m, o, a):
    """Sandstone wall with a dado, a register of painted offering scenes, a frieze and torus edging."""
    x0, x1, y0, y1, z0, z1 = ext(o); axis, face = a['axis'], a['face']
    m.box('sandstone', (x0, y0, z0), (x1, y1, z1))
    u0, u1, _, _, plane, sign = face_frame(o, face, axis)
    back = (x0 if face > 0 else x1) if axis == 'x' else (z0 if face > 0 else z1)
    length = u1 - u0
    for pl, sg in ((plane, sign), (back, -sign)):
        paint(m, 'sandstoneDark', axis, pl, sg, u0, u1, 0, .55)
        paint(m, 'ochre', axis, pl, sg, u0, u1, .55, .62)
        paint(m, 'lapis', axis, pl, sg, u0, u1, y1 - .62, y1 - .5)
        for k in range(int(length / .5)):        # kheker frieze along the top
            uu = u0 + .1 + k * .5
            if uu + .3 > u1: break
            paint(m, 'gold' if k % 2 else 'ochre', axis, pl, sg, uu, uu + .2, y1 - .45, y1 - .12)
    if length > 2.5:
        n = int((length - .6) / 1.6)
        for k in range(n):
            u = u0 + .8 + k * (length - 1.6) / max(1, n - 1) if n > 1 else (u0 + u1) / 2
            relief_figure(m, axis, plane, sign, u, 1.3, 1.25, ('ochre', 'sandstoneDark', 'ochre')[k % 3], 1 if (k // 3) % 2 == 0 else -1, k % 2 == 0)
        paint(m, 'lapisDark', axis, plane, sign, u0 + .2, u1 - .2, 1.15, 1.2); paint(m, 'lapisDark', axis, plane, sign, u0 + .2, u1 - .2, 3.5, 3.55)
        # inner face: star band and painted columns of plain cartouches
        for k in range(int(length / 2.2)):
            u = u0 + 1.1 + k * 2.2
            if u + .3 > u1: break
            paint(m, 'gold', axis, back, -sign, u - .22, u + .22, 1.6, 3.2); paint(m, 'white', axis, back, -sign, u - .17, u + .17, 1.66, 3.14, .009)
            for j in range(4): paint(m, 'lapis', axis, back, -sign, u - .1, u + .1, 1.85 + j * .32, 1.98 + j * .32, .012)
    return True


def lintel(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('sandstoneLight', (x0, y0, z0), (x1, y1, z1))
    if a['axis'] == 'x':
        for pl, sg in ((z1, 1), (z0, -1)):
            winged_disc(m, 'z', pl, sg, (x0 + x1) / 2, y0 + .62, (x1 - x0) * .9)
            paint(m, 'ochre', 'z', pl, sg, x0, x1, y0, y0 + .08)
    else:
        for pl, sg in ((x1, 1), (x0, -1)):
            winged_disc(m, 'x', pl, sg, (z0 + z1) / 2, y0 + .62, (z1 - z0) * .9)
    return True


def flute_lathe(m, material, x, z, profile, n=24, lobes=8, depth=.07, rot=0.0):
    """Bundle-column shaft: radius pulled in between lobes, so it reads as tied papyrus stems."""
    for (r0, y0), (r1, y1) in zip(profile, profile[1:]):
        for i in range(n):
            ta, tb = rot + math.tau * i / n, rot + math.tau * (i + 1) / n
            fa, fb = 1 - depth * (1 - abs(math.cos(lobes * ta / 2))), 1 - depth * (1 - abs(math.cos(lobes * tb / 2)))
            m.quad(material, (x + r0 * fb * math.cos(tb), y0, z + r0 * fb * math.sin(tb)), (x + r0 * fa * math.cos(ta), y0, z + r0 * fa * math.sin(ta)),
                   (x + r1 * fa * math.cos(ta), y1, z + r1 * fa * math.sin(ta)), (x + r1 * fb * math.cos(tb), y1, z + r1 * fb * math.sin(tb)))


def papyrus_column(m, x, z, y0, top, nave=False):
    """Closed-bud papyrus column: round base, bundled shaft, five tie bands, sepal-painted bud, abacus."""
    lathe(m, 'limestoneShade', x, z, [(.6, y0), (.6, y0 + .14), (.55, y0 + .24)], 20)
    flute_lathe(m, 'sandstone', x, z, [(.47, y0 + .24), (.54, y0 + .55), (.52, y0 + 1.6), (.46, top - 1.6)], 24, 8, .08)
    for k in range(5):
        yy = top - 1.6 + k * .1
        lathe(m, ('gold', 'lapis', 'ochre', 'lapis', 'gold')[k], x, z, [(.47, yy), (.47, yy + .1)], 20, cap=False)
    flute_lathe(m, 'sandstoneLight', x, z, [(.46, top - 1.1), (.55, top - .82), (.56, top - .6), (.44, top - .42)], 24, 8, .05)
    for i in range(8):   # painted sepals round the bud
        t = math.tau * (i + .5) / 8; ca, sa = math.cos(t), math.sin(t)
        m.tri('malachite', (x + .555 * ca + .1 * -sa, top - 1.08, z + .555 * sa + .1 * ca), (x + .555 * ca - .1 * -sa, top - 1.08, z + .555 * sa - .1 * ca), (x + .57 * ca, top - .72, z + .57 * sa))
    for i in range(16):  # vertical colour stripes on the lower shaft
        t = math.tau * i / 16
        if i % 2: m.quad('lapis' if i % 4 == 1 else 'ochre', *[(x + r * math.cos(t + d), yy, z + r * math.sin(t + d)) for (r, yy, d) in ((.545, y0 + .6, -.05), (.545, y0 + .6, .05), (.525, y0 + 1.55, .05), (.525, y0 + 1.55, -.05))][::-1])
    m.box('sandstoneDark', (x - .62, top - .42, z - .62), (x + .62, top, z + .62), top_mat='sandstone')
    if nave:
        for i in range(4):
            t = math.tau * i / 4 + math.pi / 4
            m.box('gold', (x + .54 * math.cos(t) - .04, top - .3, z + .54 * math.sin(t) - .04), (x + .54 * math.cos(t) + .04, top - .1, z + .54 * math.sin(t) + .04))


def column(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    papyrus_column(m, (x0 + x1) / 2, (z0 + z1) / 2, y0, y1, a.get('nave'))
    return True


def roof(m, o, a):
    """Roof slabs laid across the hall; the soffit under them is lapis with gold stars."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    x = x0
    while x < x1 - .01:
        w = min(1.1, x1 - x)
        m.box('sandstone' if round(x * 10) % 3 else 'sandstoneLight', (x + .01, y0 + .06, z0), (x + w - .01, y1, z1), top_mat='sandstoneLight' if round(x) % 2 else 'sandstone')
        x += 1.1
    m.box('lapisDark', (x0, y0, z0), (x1, y0 + .06, z1))
    return True


def parapet(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('limestone', (x0, y0, z0), (x1, y1 - .18, z1)); m.box('limestoneShade', (x0, y1 - .18, z0), (x1, y1, z1))
    return True


def roofstair(m, o, a):
    """Outer stair against the hall wall: treads, a solid podium and a limestone cheek with a torus edge."""
    steps(m, o, 'limestone', 'sandstoneDark', None, .22)
    x0, x1, y0, y1, z0, z1 = ext(o); sx = a['sx']; xo = x1 if sx > 0 else x0
    # outer cheek wall following the slope
    t = .2; xi = xo - sx * t
    m.quad('sandstoneLight', (xo, y0, z1), (xo, y0, z0), (xo, y1, z0), (xo, y0 + .22, z1)) if sx < 0 else m.quad('sandstoneLight', (xo, y0, z0), (xo, y0, z1), (xo, y0 + .22, z1), (xo, y1, z0))
    return True


def sunshrine(m, o, a):
    """Roof altar of the sun: a granite naos with a gilded disc between two horns."""
    x0, x1, y0, y1, z0, z1 = ext(o); xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    tbox(m, 'graniteDark', x0, x1, z0, z1, y0, y0 + .3, .05); tbox(m, 'granite', x0 + .1, x1 - .1, z0 + .1, z1 - .1, y0 + .3, y0 + .95, .08)
    m.box('gold', (x0 + .12, y0 + .95, z0 + .12), (x1 - .12, y0 + 1.0, z1 - .12))
    for k in range(18):
        t0, t1 = math.tau * k / 18, math.tau * (k + 1) / 18; r = .5; yc = y0 + 1.07 + r * .0
        for zz, flip in ((zc - .03, 1), (zc + .03, 0)):
            q = [(xc, y1 - .55, zz), (xc + r * math.cos(t0), y1 - .55 + r * math.sin(t0), zz), (xc + r * math.cos(t1), y1 - .55 + r * math.sin(t1), zz)]
            m.tri('sunDisc', *(q if flip else q[::-1]))
    for s in (-1, 1):
        beam(m, 'gold', (xc + s * .2, y0 + 1.0, zc), (xc + s * .6, y0 + 1.25, zc), .04, 5); beam(m, 'gold', (xc + s * .6, y0 + 1.25, zc), (xc + s * .5, y0 + 1.45, zc), .035, 5)
    return True


def cavetto(m, material, x0, x1, z0, z1, y, h, out, band=None):
    """Egyptian gorge cornice: a cove flaring outward round a rectangle, closed on top."""
    rings = []
    for k in range(6):
        t = k / 5; o_ = out * (t ** 2) ; yy = y + h * t
        rings.append(rect(x0 - o_, x1 + o_, yy, z0 - o_, z1 + o_))
    for a_, b_ in zip(rings, rings[1:]):
        for j in range(4): m.quad(material, a_[(j + 1) % 4], a_[j], b_[j], b_[(j + 1) % 4])
    m.quad(material, *rings[-1][::-1])
    if band:  # torus roll under the cornice
        r0 = rect(x0 - .03, x1 + .03, y - .12, z0 - .03, z1 + .03); r1 = rect(x0 - .03, x1 + .03, y, z0 - .03, z1 + .03)
        for j in range(4): m.quad(band, r0[(j + 1) % 4], r0[j], r1[j], r1[(j + 1) % 4])


def pylon(m, o, a):
    """Battered pylon tower: sloping faces, torus edging, gorge cornice, flagstaff niches, painted reliefs."""
    x0, x1, y0, y1, z0, z1 = ext(o); sx, sz = a['sx'], a['sz']; bat = .55
    tbox(m, 'sandstone', x0, x1, z0, z1, y0, y1 - .9, bat, top_material='sandstoneLight')
    cavetto(m, 'sandstoneLight', x0 + bat, x1 - bat, z0 + bat, z1 - bat, y1 - .9, .9, bat - .02, band='gold')
    # painted reliefs on the battered court face (facing the centre, -sx) and on the outer face
    for face, xf in ((-sx, x0 if sx > 0 else x1), (sx, x1 if sx > 0 else x0)):
        lean = lambda y: face * bat * (y - y0) / (y1 - .9 - y0)
        def panel(mat_, za, zb, ya, yb, d=.01):
            xa, xb = xf - lean(ya) + face * d, xf - lean(yb) + face * d
            q = [(xa, ya, za), (xa, ya, zb), (xb, yb, zb), (xb, yb, za)]
            m.quad(mat_, *(q[::-1] if face > 0 else q))
        za, zb = (z0 + .6, z1 - .6) if True else (0, 0)
        panel('sandstoneDark', z0 + .3, z1 - .3, .2, .7)
        # king smiting: a tall striding figure with a raised arm, the foes kneeling before him
        zc = (z0 + z1) / 2
        panel('ochre', zc - .55, zc + .55, 1.1, 4.6, .012); panel('white', zc - .6, zc + .6, 1.1, 2.2, .016); panel('gold', zc - .62, zc + .62, 2.15, 2.28, .02)
        panel('lapis', zc - .45, zc + .45, 4.6, 5.6, .014); panel('gold', zc - .2, zc + .2, 5.6, 5.95, .016)
        panel('ochre', zc + .5, zc + 1.6, 4.3, 4.5, .016); panel('gold', zc + 1.5, zc + 1.75, 4.2, 4.9, .02)
        for k in range(3): panel('sandstoneDark', zc - 2.3 + k * .55, zc - 1.95 + k * .55, 1.1, 2.2 - k * .2, .012)
        for k in range(6): panel('lapis' if k % 2 else 'turquoise', z0 + .5, z1 - .5, 6.2 + k * .14, 6.27 + k * .14, .01)
    # flagstaff grooves with cedar masts, clamped at two heights, on the court face
    xf = x1 if sx < 0 else x0; inward = sx      # court face of the west tower is its +x side
    for zf in (z0 + 1.6, z1 - 1.6):
        beam(m, 'cedar', (xf + inward * .12, y0, zf), (xf + inward * .12, y1 - .1, zf), .11, 6)
        for k in range(2):
            yy = 2.4 + k * 3.4; xs = xf - inward * (0) + inward * (bat * (yy - y0) / (y1 - .9 - y0))
            m.box('gold', (min(xs, xf + inward * .12) - .02, yy, zf - .16), (max(xs, xf + inward * .12) + .02, yy + .14, zf + .16))
    return True


def gatelintel(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('sandstoneLight', (x0, y0, z0), (x1, y1, z1))
    for pl, sg in ((x1, 1), (x0, -1)): winged_disc(m, 'x', pl, sg, (z0 + z1) / 2, y0 + .7, (z1 - z0) * .95)
    return True


def enclosure(m, o, a):
    """Temenos wall: mud-brick body in wavy courses, limestone coping."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('sandstoneDark', (x0, y0, z0), (x1, y1 - .3, z1)); m.box('limestone', (x0, y1 - .3, z0), (x1, y1, z1))
    return True


def offering(m, o, a):
    """Granite offering stand: a waisted pillar with a bowl of fruit and a lotus bunch."""
    x0, x1, y0, y1, z0, z1 = ext(o); xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    tbox(m, 'graniteDark', x0, x1, z0, z1, y0, y0 + .2, .04)
    lathe(m, 'granite', xc, zc, [(.4, y0 + .2), (.28, y0 + .4), (.24, y0 + .8), (.42, y0 + .98)], 12)
    lathe(m, 'gold', xc, zc, [(.42, y0 + .98), (.48, y1 - .08), (.36, y1 - .06)], 14, cap=True)
    for k in range(5):
        t = math.tau * k / 5; m.blob(('ochre', 'goldPale', 'malachite', 'ochre', 'lotusFlower')[k], (xc + .16 * math.cos(t), y1 - .1, zc + .16 * math.sin(t)), .1, .9)
    return True


def drums(m, o, a):
    """Fallen column drums: one standing, two rolled on their sides, painted bands still visible."""
    x0, x1, y0, y1, z0, z1 = ext(o); xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    flute_lathe(m, 'sandstone', xc - .45, zc - .5, [(.52, y0), (.52, y1)], 20, 8, .08); lathe(m, 'sandstoneLight', xc - .45, zc - .5, [(0, y1), (0, y1)], 4, cap=False)
    m.box('sandstoneLight', (xc - .97, y1 - .02, zc - 1.02), (xc + .07, y1, zc + .02)) if False else None
    for k in range(20):
        t0, t1 = math.tau * k / 20, math.tau * (k + 1) / 20
        m.tri('sandstoneLight', (xc - .45, y1, zc - .5), (xc - .45 + .48 * math.cos(t1), y1, zc - .5 + .48 * math.sin(t1)), (xc - .45 + .48 * math.cos(t0), y1, zc - .5 + .48 * math.sin(t0)))
    for (dx, dz, yaw) in ((.5, .45, 0.0), (-.55, .55, math.pi / 2)):
        r = .5; L = .95; cx, cz = xc + dx, zc + dz; ca, sa = math.cos(yaw), math.sin(yaw); y0 = ext(o)[2] + .012
        n = 16
        for k in range(n):
            t0, t1 = math.tau * k / n, math.tau * (k + 1) / n
            def p(t, s): return (cx + ca * s * L / 2 + sa * 0, y0 + r + r * math.sin(t), cz - sa * s * L / 2 + ca * 0 + 0) if False else (cx + ca * (s * L / 2) - sa * (r * math.cos(t)), y0 + r + r * math.sin(t), cz - sa * (s * L / 2) - ca * (r * math.cos(t)))
            m.quad('sandstone' if k % 2 else 'sandstoneLight', p(t0, -1), p(t1, -1), p(t1, 1), p(t0, 1))
            m.tri('sandstoneLight', (cx - ca * L / 2, y0 + r, cz + sa * L / 2), p(t1, -1), p(t0, -1))
            m.tri('sandstoneLight', (cx + ca * L / 2, y0 + r, cz - sa * L / 2), p(t0, 1), p(t1, 1))
        for s in (-.2, .2):
            for k in range(n):
                t0, t1 = math.tau * k / n, math.tau * (k + 1) / n
                q = lambda t, sh: (cx + ca * (sh) - sa * ((r + .01) * math.cos(t)), y0 + r + (r + .01) * math.sin(t), cz - sa * (sh) - ca * ((r + .01) * math.cos(t)))
                m.quad('lapis' if s < 0 else 'ochre', q(t0, s - .04), q(t1, s - .04), q(t1, s + .04), q(t0, s + .04))
    return True


def fallen(m, o, a):
    """A toppled granite king lying face up, crown broken off beside him."""
    x0, x1, y0, y1, z0, z1 = ext(o); xc = (x0 + x1) / 2
    m.box('graniteDark', (x0 + .1, y0, z0 + .2), (x1 - .1, y0 + .25, z1 - .2))
    loft(m, 'granite', [rect(xc - .7, xc + .7, y0 + .25, z0 + .3, z0 + 1.2), rect(xc - .78, xc + .78, y0 + .9, z0 + .3, z0 + 1.2)])     # legs block
    loft(m, 'granite', [rect(xc - .8, xc + .8, y0 + .25, z0 + 1.2, z1 - 1.1), rect(xc - .9, xc + .9, y0 + 1.05, z0 + 1.2, z1 - 1.1)])   # torso
    loft(m, 'granite', [rect(xc - .62, xc + .62, y0 + .25, z1 - 1.1, z1 - .3), rect(xc - .7, xc + .7, y0 + 1.2, z1 - 1.05, z1 - .35), rect(xc - .45, xc + .45, y1, z1 - .95, z1 - .45)])  # nemes head
    m.box('gold', (xc - .82, y0 + .98, z1 - 1.25), (xc + .82, y0 + 1.08, z1 - 1.05))
    for s in (-1, 1): beam(m, 'granite', (xc + s * .86, y0 + .7, z0 + 2.4), (xc + s * .7, y0 + .7, z0 + 1.3), .2, 6)
    m.blob('granite', (xc + .78, y0 + .3, z0 + .6), .3, .7); m.blob('graniteDark', (xc - .8, y0 + .22, z1 - .5), .22, .8)
    return True


def palmbed(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o); xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    tbox(m, 'sandstoneDark', x0, x1, z0, z1, y0, y1, .06); m.box('sand', (x0 + .14, y1 - .04, z0 + .14), (x1 - .14, y1 + .0, z1 - .14))
    return True


def colossus_model(scale=1.0):
    """Seated king facing +z on his throne, double crown, nemes, kilt and broad collar. 2.6 x 5.8 x 3.2."""
    m = Mesh(); S, SL, SD, G = 'sandstone', 'sandstoneLight', 'sandstoneDark', 'gold'
    tbox(m, SD, -1.3, 1.3, -1.6, 1.6, 0, .55, .04, top_material=S)
    m.box(G, (-1.26, .45, 1.555), (1.26, .5, 1.565))
    # throne block, its sides carved with the knot of the two lands (abstract)
    m.box(S, (-1.15, .55, -1.55), (1.15, 2.15, .35))
    m.box(SL, (-.95, 2.15, -1.55), (.95, 3.75, -1.15))
    for s in (-1, 1):
        x = s * 1.152
        side = lambda mm, za, zb, ya, yb: m.quad(mm, *([(x, ya, za), (x, ya, zb), (x, yb, zb), (x, yb, za)] if s > 0 else [(x, ya, zb), (x, ya, za), (x, yb, za), (x, yb, zb)]))
        side(G, -1.2, .1, .75, .82); side(G, -1.2, .1, 1.95, 2.02)
        side('lapis', -.6, -.48, .9, 1.62)                                   # the central stem
        for k in range(5): side('lapis', -.62 - .06 * k - .08, -.62 - .06 * k, 1.5 + .06 * k, 1.56 + .06 * k)   # papyrus side, curving out
        for k in range(5): side('lapis', -.46 + .06 * k, -.46 + .06 * k + .08, 1.5 + .06 * k, 1.56 + .06 * k)   # lotus side
        side('malachite', -1.0, -.86, 1.78, 1.88); side('lotusFlower', -.22, -.08, 1.78, 1.88)
        side('lapis', -.72, -.36, 1.62, 1.68)
    # legs: shins standing on the plinth, thighs along the seat
    for s in (-1, 1):
        xl = s * .38
        loft(m, S, [rect(xl - .2, xl + .2, .55, .95, 1.45), rect(xl - .22, xl + .22, .7, .98, 1.42)])           # feet
        loft(m, S, [rect(xl - .2, xl + .2, .7, 1.0, 1.32), rect(xl - .23, xl + .23, 2.05, 1.0, 1.36)])          # shins
        loft(m, S, [rect(xl - .24, xl + .24, 1.92, -.65, 1.36), rect(xl - .25, xl + .25, 2.3, -.65, 1.36)])     # thighs
    loft(m, 'white', [rect(-.2, .2, 1.9, .7, 1.38), rect(-.32, .32, 2.32, -.3, 1.38)])                           # kilt panel
    for k in range(4): m.box(G, (-.24 + k * .16, 2.1, 1.36), (-.2 + k * .16, 2.32, 1.39))
    # torso, collar and arms resting on the thighs
    loft(m, S, [rect(-.52, .52, 2.3, -1.12, -.3), rect(-.62, .62, 2.95, -1.12, -.22), rect(-.78, .78, 3.55, -1.12, -.28), rect(-.7, .7, 3.75, -1.08, -.42)])
    for k, (r_, col) in enumerate(((.62, 'lapis'), (.56, 'gold'), (.5, 'turquoise'), (.44, 'gold'))):
        y = 3.62 - k * .09
        m.quad(col, (-r_, y - .085, -.25), (r_, y - .085, -.25), (r_ * .9, y, -.27), (-r_ * .9, y, -.27))
    for s in (-1, 1):
        beam(m, S, (s * .76, 3.55, -.75), (s * .78, 2.55, -.62), .17, 7)
        beam(m, S, (s * .78, 2.55, -.62), (s * .55, 2.35, .95), .14, 7)
        m.blob(SL, (s * .5, 2.38, 1.08), .16, .8)
    # head: nemes headdress with striped lappets, face, beard, uraeus and the double crown
    loft(m, S, [rect(-.62, .62, 3.6, -1.0, -.36), rect(-.6, .6, 4.1, -1.0, -.34), rect(-.42, .42, 4.6, -.95, -.42), rect(-.26, .26, 4.72, -.86, -.5)])
    for s in (-1, 1):
        loft(m, 'lapis', [rect(s * .44 - .13, s * .44 + .13, 3.25, -.42, -.3), rect(s * .42 - .12, s * .42 + .12, 4.05, -.38, -.28)])
        for k in range(5): m.box(G, (s * .44 - .135, 3.3 + k * .15, -.309), (s * .44 + .135, 3.36 + k * .15, -.297))
    loft(m, SL, [rect(-.27, .27, 3.85, -.5, -.22), rect(-.28, .28, 4.4, -.5, -.2), rect(-.24, .24, 4.55, -.48, -.25)])  # face
    m.box(SL, (-.05, 4.06, -.22), (.05, 4.24, -.14)); m.box('black', (-.2, 4.25, -.205), (-.07, 4.29, -.195)); m.box('black', (.07, 4.25, -.205), (.2, 4.29, -.195))
    loft(m, SD, [rect(-.07, .07, 3.4, -.32, -.18), rect(-.08, .08, 3.86, -.34, -.2)])                                   # beard
    lathe(m, 'white', 0, -.66, [(.36, 4.62), (.38, 4.95), (.26, 5.35), (.12, 5.55), (0, 5.62)], 12)                     # white crown
    loft(m, 'ochre', [rect(-.44, .44, 4.6, -.98, -.84), rect(-.42, .42, 5.25, -.98, -.86)])                              # red crown plate
    beam(m, 'ochre', (0, 4.72, -.4), (.12, 5.05, -.26), .025, 4)
    m.box(G, (-.04, 4.55, -.5), (.04, 4.75, -.44)); m.blob(G, (0, 4.78, -.47), .05, 1)                                   # uraeus
    return m


COLOSSUS = colossus_model()

def colossus(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    place(m, COLOSSUS, (x0 + x1) / 2, y0, (z0 + z1) / 2, 0, 1.0, 1.0)
    return True


def obelisk(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o); xc, zc = (x0 + x1) / 2, (z0 + z1) / 2; hw = (x1 - x0) / 2
    tbox(m, 'graniteDark', x0, x1, z0, z1, y0, y0 + .5, .05)
    tbox(m, 'granite', xc - .48, xc + .48, zc - .48, zc + .48, y0 + .5, y1 - .7, .17)
    loft(m, 'gold', [rect(xc - .31, xc + .31, y1 - .7, zc - .31, zc + .31), [(xc, y1, zc)] * 4], close=False)
    m.quad('gold', *rect(xc - .31, xc + .31, y1 - .7, zc - .31, zc + .31)[::-1])
    # three columns of incised marks on each face, abstract (no legible script)
    for f in range(4):
        for col in (-.18, 0, .18):
            for k in range(12):
                yy = y0 + .9 + k * .55; w = .48 - .17 * (yy - y0 - .5) / (y1 - .7 - y0 - .5)
                if k % 4 == 3: continue
                L = .06 + .05 * ((k * 7 + int(col * 10)) % 3)
                o_ = w + .004
                pts = [(col * w / .48 - L / 2, yy), (col * w / .48 + L / 2, yy), (col * w / .48 + L / 2, yy + .07), (col * w / .48 - L / 2, yy + .07)]
                q = [((u if f in (0, 2) else (o_ if f == 1 else -o_)), v, (o_ if f == 0 else -o_) if f in (0, 2) else u) for u, v in pts]
                q = [(xc + p[0], p[1], zc + p[2]) for p in q]
                m.quad('graniteDark', *(q if f in (0, 3) else q[::-1]))
    return True


def sphinx_model():
    """Couchant lion with the king's head, facing +x, on its plinth. 3.6 x 1.7 x 1.8."""
    m = Mesh(); S, SL, SD = 'sandstone', 'sandstoneLight', 'sandstoneDark'
    tbox(m, SD, -1.8, 1.8, -.9, .9, 0, .35, .03, top_material=S)
    def ring(x, y, w, h, n=10): return [(x, y + h / 2 * math.sin(math.tau * i / n), w / 2 * math.cos(math.tau * i / n)) for i in range(n)]
    loft(m, S, [ring(-1.55, .72, .7, .5), ring(-1.25, .82, 1.05, .9), ring(-.4, .82, 1.0, .82), ring(.35, .9, 1.08, 1.06), ring(.62, .92, .9, 1.0)])
    for s in (-1, 1):
        loft(m, S, [rect(.35, 1.62, .35, s * .3 - .14, s * .3 + .14), rect(.35, 1.6, .55, s * .3 - .13, s * .3 + .13)])            # forelegs
        for k in range(3): m.box(SL, (1.55, .35, s * .3 - .12 + k * .085), (1.66, .5, s * .3 - .05 + k * .085))                   # toes
        loft(m, S, [rect(-1.5, -.6, .35, s * .4 - .16, s * .4 + .16), rect(-1.42, -.7, .72, s * .42 - .14, s * .42 + .14)])        # haunches
    beam(m, S, (-1.58, .5, .45), (-.6, .42, .62), .07, 5); m.blob(S, (-.55, .43, .63), .1, 1)                                     # tail
    # head with nemes and lappets
    loft(m, S, [rect(.42, .98, 1.2, -.42, .42), rect(.44, .96, 1.5, -.4, .4), rect(.5, .86, 1.7, -.26, .26)])
    for s in (-1, 1):
        loft(m, 'lapis', [rect(.86, .98, .95, s * .3 - .09, s * .3 + .09), rect(.85, .96, 1.45, s * .3 - .08, s * .3 + .08)])
    loft(m, SL, [rect(.95, 1.12, 1.18, -.2, .2), rect(.95, 1.14, 1.5, -.21, .21), rect(.94, 1.08, 1.62, -.17, .17)])                # face
    m.box(SD, (1.12, 1.0, -.05), (1.18, 1.2, .05))                                                                                 # beard
    m.box('black', (1.141, 1.4, -.15), (1.15, 1.44, -.05)); m.box('black', (1.141, 1.4, .05), (1.15, 1.44, .15))
    return m


SPHINX = sphinx_model()

def sphinx(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    place(m, SPHINX, (x0 + x1) / 2, y0, (z0 + z1) / 2, 0 if a['sx'] > 0 else math.pi, 1.0, 1.0)
    return True


def shrine(m, o, a):
    """Barque chapel: battered granite naos with torus edges, gorge cornice and a winged disc over a dark doorway."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    tbox(m, 'granite', x0, x1, z0, z1, y0, y1 - .55, .18)
    cavetto(m, 'graniteDark', x0 + .18, x1 - .18, z0 + .18, z1 - .18, y1 - .55, .55, .16, band='gold')
    zf = z1 - .18 * (0) ; zf = z1 - .001
    for xx in (x0 + .9, x1 - .9): m.box('graniteDark', (xx - .25, y0, z1 - .18), (xx + .25, y0 + 2.6, z1 - .1))
    m.box('black', (x0 + 1.2, y0, z1 - .2), (x1 - 1.2, y0 + 2.3, z1 - .19))
    m.box('graniteDark', (x0 + .7, y0 + 2.6, z1 - .19), (x1 - .7, y0 + 2.95, z1 - .1))
    winged_disc(m, 'z', z1 - .1, 1, (x0 + x1) / 2, y0 + 2.78, (x1 - x0) * .55, .004)
    for xf, sg in ((x0, -1), (x1, 1)):
        lean = lambda y: -sg * .18 * (y - y0) / (y1 - .55 - y0)
        for (ya, yb, mm) in ((.25, .35, 'gold'), (2.55, 2.62, 'gold'), (2.66, 2.74, 'lapis'), (2.78, 2.86, 'turquoise')):
            xa, xb = xf + lean(ya) + sg * .006, xf + lean(yb) + sg * .006
            q = [(xa, y0 + ya, z0 + .4), (xa, y0 + ya, z1 - .4), (xb, y0 + yb, z1 - .4), (xb, y0 + yb, z0 + .4)]
            m.quad(mm, *(q if sg > 0 else q[::-1]))
    return True


def table(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('limestone', (x0, y1 - .14, z0), (x1, y1, z1))
    for xx in (x0 + .15, x1 - .35):
        for zz in (z0 + .1, z1 - .3): m.box('limestoneShade', (xx, y0, zz), (xx + .2, y1 - .14, zz + .2))
    for k in range(5):
        m.blob(('goldPale', 'ochre', 'malachite', 'lotusFlower', 'linen')[k], (x0 + .35 + k * (x1 - x0 - .7) / 4, y1 + .0, (z0 + z1) / 2), .13, .8) if False else None
    for k in range(4):   # bread loaves and jars, kept within the table box
        xx = x0 + .4 + k * (x1 - x0 - .8) / 3
        lathe(m, 'ochre' if k % 2 else 'linen', xx, (z0 + z1) / 2, [(.12, y1 - .14), (.15, y1 - .1), (.07, y1 - .02)], 8)
    return True


def bsteps(m, o, a):
    steps(m, o, 'limestone', 'limestoneShade', None, .2)
    return True


def basinfloor(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('waterDeep', (x0, y0, z0), (x1, y1, z1))
    return True


def barque(m, o, a):
    """The sun barque in the basin: a gilded papyrus boat with a shrine cabin and the disc on its prow."""
    x0, x1, y0, y1, z0, z1 = ext(o); zc = (z0 + z1) / 2; L = (x1 - x0) / 2 - .14
    m.box('granite', (x0 + .5, y0, z0 + .3), (x1 - .5, y0 + .3, z1 - .3))
    hull = []
    for k in range(9):
        t = -1 + 2 * k / 8; x = t * (L - .05); hw = .62 * (1 - t * t * .75); yb = y0 + .35 + .15 * t * t; yt = y0 + .65 + .2 * t ** 4
        hull.append([(x, yb, zc - hw * .4), (x, yb, zc + hw * .4), (x, yt, zc + hw), (x, yt, zc - hw)])
    for a_, b_ in zip(hull, hull[1:]):
        for j in range(4): m.quad('gold', a_[(j + 1) % 4], a_[j], b_[j], b_[(j + 1) % 4])
    for end in (hull[0], hull[-1]): m.quad('gold', *end)
    for s in (-1, 1):   # papyrus-umbel prow and stern
        beam(m, 'gold', (s * (L - .05), y0 + .85, zc), (s * (L - .02), y1 - .05, zc), .06, 6)
        lathe(m, 'goldPale', s * (L - .02), zc, [(.04, y1 - .2), (.12, y1 - .08), (.13, y1 - .05)], 8)
    m.box('lapis', (-.45, y0 + .65, zc - .32), (.45, y1 - .25, zc + .32)); m.box('gold', (-.5, y1 - .25, zc - .36), (.5, y1 - .18, zc + .36))
    for k in range(12):
        t0, t1 = math.tau * k / 12, math.tau * (k + 1) / 12
        for zz, flip in ((zc - .02, 1), (zc + .02, 0)):
            q = [(.0, y1 - .02 - .17, zz), (.17 * math.cos(t0), y1 - .19 + .17 * math.sin(t0), zz), (.17 * math.cos(t1), y1 - .19 + .17 * math.sin(t1), zz)]
            m.tri('sunDisc', *(q if flip else q[::-1]))
    return True


def stairblock(m, o, a):
    """Solid stone under the public stair: a dado, an ochre band and a winged disc on its long faces."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('sandstone', (x0, y0, z0), (x1, y1, z1), top_mat='limestone')
    for pl, sg in ((x0, -1), (x1, 1)):
        paint(m, 'sandstoneDark', 'x', pl, sg, z0 + .05, z1 - .05, y0, y0 + .5)
        paint(m, 'ochre', 'x', pl, sg, z0 + .05, z1 - .05, y1 - .4, y1 - .32)
        if z1 - z0 > 4: winged_disc(m, 'x', pl, sg, (z0 + z1) / 2, y0 + 1.5, 3.0)
    return True


def screenwall(m, o, a):
    """Free-standing screen wall: a dado, a register of painted offering figures and a gorge cornice.
    `axis` is the wall's face normal, as for the hall walls."""
    x0, x1, y0, y1, z0, z1 = ext(o); axis = a['axis']
    th = (x1 - x0) if axis == 'x' else (z1 - z0); out = min(.12, th * .2)
    m.box('sandstone', (x0 + out, y0, z0 + out), (x1 - out, y1 - .45, z1 - out))
    cavetto(m, 'sandstoneLight', x0 + out, x1 - out, z0 + out, z1 - out, y1 - .45, .45, out - .005, band='gold')
    if axis == 'x': faces, u0, u1 = ((x0 + out, -1), (x1 - out, 1)), z0 + out, z1 - out
    else: faces, u0, u1 = ((z0 + out, -1), (z1 - out, 1)), x0 + out, x1 - out
    for pl, sg in faces:
        paint(m, 'sandstoneDark', axis, pl, sg, u0, u1, y0, y0 + .45)
        paint(m, 'lapis', axis, pl, sg, u0, u1, y1 - .62, y1 - .55)
        n = max(1, int((u1 - u0) / 1.3)); fig = min(.95, (y1 - y0 - 1.2) / 1.75)
        for k in range(n):
            relief_figure(m, axis, pl, sg, u0 + (k + .5) * (u1 - u0) / n, y0 + .55, fig, ('ochre', 'sandstoneDark')[k % 2], 1 if k % 2 else -1, k % 2 == 0)
    return True


def sanctuary(m, o, a):
    """Built-up roof: clerestory sanctuary and roof chapels, ashlar under a gorge cornice, painted bands;
    the north sanctuary carries the gilded sun disc that used to stand loose on the roof."""
    x0, x1, y0, y1, z0, z1 = ext(o); out = .2
    m.box('sandstone', (x0 + out, y0, z0 + out), (x1 - out, y1 - .6, z1 - out), top_mat='sandstoneLight')
    cavetto(m, 'sandstoneLight', x0 + out, x1 - out, z0 + out, z1 - out, y1 - .6, .6, out - .005, band='gold')
    for axis, pl, sg, u0, u1 in (('x', x0 + out, -1, z0 + out, z1 - out), ('x', x1 - out, 1, z0 + out, z1 - out),
                                 ('z', z0 + out, -1, x0 + out, x1 - out), ('z', z1 - out, 1, x0 + out, x1 - out)):
        paint(m, 'sandstoneDark', axis, pl, sg, u0, u1, y0, y0 + .35)
        paint(m, 'ochre', axis, pl, sg, u0, u1, y0 + .35, y0 + .42)
        paint(m, 'lapis', axis, pl, sg, u0, u1, y1 - .85, y1 - .75)
        for k in range(int((u1 - u0) / .5)):
            uu = u0 + .1 + k * .5
            if uu + .3 > u1: break
            paint(m, 'gold' if k % 2 else 'turquoise', axis, pl, sg, uu, uu + .2, y1 - 1.25, y1 - .9)
        if u1 - u0 > 2.4 and not a.get('disc'):
            winged_disc(m, axis, pl, sg, (u0 + u1) / 2, y0 + 1.15, min(2.6, (u1 - u0) * .5))
    if a.get('disc'):   # the sun on the south face, over the stair's passage
        xc = (x0 + x1) / 2; zf = z1 - out + .01
        for k in range(18):
            t0, t1 = math.tau * k / 18, math.tau * (k + 1) / 18
            m.tri('sunDisc', (xc, y0 + 1.3, zf), (xc + .5 * math.cos(t0), y0 + 1.3 + .5 * math.sin(t0), zf), (xc + .5 * math.cos(t1), y0 + 1.3 + .5 * math.sin(t1), zf))
        winged_disc(m, 'z', z1 - out, 1, xc, y0 + .6, 2.4)
    return True


def stela(m, o, a):
    """Granite stela on the avenue: a squared shaft with a painted relief of the king before the sun, under a pyramid cap."""
    x0, x1, y0, y1, z0, z1 = ext(o); xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    tbox(m, 'graniteDark', x0, x1, z0, z1, y0, y0 + .35, .05)
    m.box('granite', (x0 + .1, y0 + .35, z0 + .1), (x1 - .1, y1 - .55, z1 - .1))
    loft(m, 'gold', [rect(x0 + .1, x1 - .1, y1 - .55, z0 + .1, z1 - .1), [(xc, y1, zc)] * 4], close=False)
    for pl, sg in ((x0 + .1, -1), (x1 - .1, 1)):
        paint(m, 'graniteDark', 'x', pl, sg, z0 + .3, z1 - .3, y0 + .55, y1 - .75)
        relief_figure(m, 'x', pl, sg, zc - .25, y0 + .7, .85, 'gold', 1, True)
        for k in range(12):
            t0, t1 = math.pi * k / 12, math.pi * (k + 1) / 12; cy = y1 - 1.05
            paint(m, 'goldPale', 'x', pl, sg, zc + .3 + .22 * math.cos(t1), zc + .3 + .22 * math.cos(t0), cy + .2 * math.sin(t0) - .03, cy + .2 * math.sin(t0) + .03, .009)
    for pl, sg in ((z0 + .1, -1), (z1 - .1, 1)):
        paint(m, 'lapis', 'z', pl, sg, x0 + .3, x1 - .3, y1 - .95, y1 - .85)
        paint(m, 'ochre', 'z', pl, sg, x0 + .3, x1 - .3, y0 + .55, y0 + .62)
    return True


KINDS = dict(proxy=lambda m, o, a: True, stairblock=stairblock, screenwall=screenwall, sanctuary=sanctuary, stela=stela, wall=wall, lintel=lintel, column=column, roof=roof, parapet=parapet, roofstair=roofstair, sunshrine=sunshrine, pylon=pylon,
             gatelintel=gatelintel, enclosure=enclosure, offering=offering, drums=drums, fallen=fallen, palmbed=palmbed, colossus=colossus,
             obelisk=obelisk, sphinx=sphinx, shrine=shrine, table=table, bsteps=bsteps, basinfloor=basinfloor, barque=barque,
             steps=lambda m, o, a: steps(m, o, 'limestone', 'limestoneShade', None, .2))

# ------------------------------------------------------------------ decorative craft
# Processional paving: limestone slabs on the temple axis, the hall floor and the court ring.
def slabs(x0, x1, z0, z1, y=.012, size=1.1, mats=('limestone', 'limestoneShade')):
    z = z0; row = 0
    while z < z1 - .05:
        x = x0 + (size / 2 if row % 2 else 0)
        if row % 2: D.box(mats[0], (x0, 0, z + .02), (x - .02, y, min(z1, z + size) - .02))
        while x < x1 - .05:
            D.box(mats[(row + int(x * 3)) % 2], (x + .02, 0, z + .02), (min(x1, x + size) - .02, y, min(z1, z + size) - .02)); x += size
        z += size; row += 1
slabs(-10.4, 10.4, -14.4, 4.4)
slabs(-2.2, 2.2, 4.4, 11)
slabs(-2.2, 2.2, -18, -15)
slabs(-8, 8, 19, 21.6); slabs(-8.6, -7, 10.4, 19.6); slabs(7, 8.6, 10.4, 19.6); slabs(-8.6, 8.6, 10, 11)
for sx in (-1, 1):
    slabs(sx * 29.4 if sx < 0 else 19, -19 if sx < 0 else 29.4, -2.4, 2.4)
# Basin: limestone kerb, a sheet of water a hand deep, lotus pads and blooms, papyrus at the corners.
for (x0, x1, z0, z1) in ((-7.2, 7.2, 10.8, 11.0), (-7.2, -4.4, 19.0, 19.2), (-2.4, 2.4, 19.0, 19.2), (4.4, 7.2, 19.0, 19.2), (-7.2, -7.0, 11, 13.4), (-7.2, -7.0, 16.6, 19), (7.0, 7.2, 11, 13.4), (7.0, 7.2, 16.6, 19)):
    D.box('limestone', (x0, -.02, z0), (x1, .06, z1))
D.box('water', (-7, -1.12, 11), (7, -1.1, 19))
for (x, z) in scatter(rng, 26, -6.5, 6.5, 11.5, 18.5, lambda x, z: not (abs(x) < 2.6 and 13.8 < z < 16.2) and not (abs(x) > 4.4 and 13.2 < z < 16.8) and not (2.0 < abs(x) < 4.8 and z > 16.4), .55):
    r = rng.uniform(.18, .32)
    for k in range(9):
        t0, t1 = math.tau * k / 10 + .3, math.tau * (k + 1) / 10 + .3
        D.tri('lotus', (x, -1.085, z), (x + r * math.cos(t1), -1.085, z + r * math.sin(t1)), (x + r * math.cos(t0), -1.085, z + r * math.sin(t0)))
    if rng.random() < .4:
        for k in range(6):
            t = math.tau * k / 6; cone(D, 'lotusFlower', (x + .04 * math.cos(t), -1.08, z + .04 * math.sin(t)), .05, .14, 3, t)
def papyrus_clump(x, z, y=0, n=11, h=1.6):
    for k in range(n):
        t = rng.uniform(0, math.tau); r = rng.uniform(0, .35); hh = h * rng.uniform(.7, 1.1); lean = rng.uniform(-.12, .12)
        bx, bz = x + r * math.cos(t), z + r * math.sin(t); tx, tz = bx + lean + .15 * math.cos(t), bz + lean * .5 + .15 * math.sin(t)
        beam(D, 'papyrus', (bx, y, bz), (tx, y + hh, tz), .018, 3)
        cone(D, 'papyrusHead', (tx, y + hh - .02, tz), .14, .16, 6)
for (x, z) in ((-6.4, 11.6), (6.4, 11.6), (-6.4, 18.4), (6.4, 18.4)): papyrus_clump(x, z, -1.1, 12, 1.4)
for sx in (-1, 1):
    for z in (-1.0, .9): papyrus_clump(sx * 17, z, .5, 6, 1.0)
# Palms: in the spawn courts, the palm beds and beyond the enclosure; date clusters in the crowns.
def palm(x, z, y=0, h=6.5, lean=(0, 0)):
    pts = [(x + lean[0] * (k / 6) ** 1.6, y + h * k / 6, z + lean[1] * (k / 6) ** 1.6) for k in range(7)]
    for k, (p, q) in enumerate(zip(pts, pts[1:])):
        beam(D, 'palmTrunk', p, q, .22 - k * .015, 7)
        D.box('cedar', (p[0] - .2, p[1] + .5, p[2] - .2), (p[0] + .2, p[1] + .56, p[2] + .2)) if False else None
    top = pts[-1]
    for i in range(11):
        t = math.tau * i / 11 + rng.uniform(-.1, .1); L = rng.uniform(2.2, 2.9); droop = rng.uniform(.9, 1.5)
        mid = (top[0] + math.cos(t) * L * .5, top[1] + .25, top[2] + math.sin(t) * L * .5); tip = (top[0] + math.cos(t) * L, top[1] - droop, top[2] + math.sin(t) * L)
        for a_, b_, w in ((top, mid, .42), (mid, tip, .28)):
            nx, nz = -math.sin(t) * w, math.cos(t) * w
            D.quad('palm' if i % 2 else 'palmDark', (a_[0] - nx, a_[1], a_[2] - nz), (a_[0] + nx, a_[1], a_[2] + nz), (b_[0] + nx * .5, b_[1] - .05, b_[2] + nz * .5), (b_[0] - nx * .5, b_[1] - .05, b_[2] - nz * .5))
            D.quad('palm' if i % 2 else 'palmDark', (a_[0] + nx, a_[1], a_[2] + nz), (a_[0] - nx, a_[1], a_[2] - nz), (b_[0] - nx * .5, b_[1] - .05, b_[2] - nz * .5), (b_[0] + nx * .5, b_[1] - .05, b_[2] + nz * .5))
    for k in range(4):
        t = math.tau * k / 4 + .4; D.blob('ochre', (top[0] + .3 * math.cos(t), top[1] - .35, top[2] + .3 * math.sin(t)), .2, 1.3)
for sx in (-1, 1):
    palm(sx * 17, 0, .5, 6.8, (sx * .5, .3))
    for z in (-14, -9, 15, 19.5): palm(sx * 27.4, z, 0, rng.uniform(5.8, 7.2), (rng.uniform(-.6, .6), rng.uniform(-.6, .6)))
    for z in range(-30, 34, 7): palm(sx * rng.uniform(33, 40), z, -.5, rng.uniform(6.5, 9), (rng.uniform(-1, 1), rng.uniform(-1, 1)))
for x in range(-32, 33, 6): palm(x + rng.uniform(-1.5, 1.5), rng.uniform(27, 33), -.5, rng.uniform(6.5, 9), (rng.uniform(-1, 1), rng.uniform(-1, 1)))
# Cornice and frieze round the hall roof, the clerestory band and gold architraves under the roof.
from erakit import tbox as _tb
for (x0, x1, z0, z1) in ((-HX - .02, HX + .02, HZ1 - .02, HZ1 + .38), (-HX - .02, HX + .02, HZ0 - .38, HZ0 + .02), (-HX - .38, -HX + .02, HZ0, HZ1), (HX - .02, HX + .38, HZ0, HZ1)):
    D.box('gold', (x0, ROOF - .25, z0), (x1, ROOF - .15, z1))
    D.box('sandstoneLight', (x0, ROOF - .15, z0), (x1, ROOF + .02, z1))
for k, z in enumerate(COLZ):
    if k == FALLEN_ROW: continue
    spans = ((-HX + .6, WELL[0] - .05), (WELL[1] + .05, HX - .6)) if WELL[2] < z < WELL[3] else ((-HX + .6, HX - .6),)
    for xa, xb in spans:
        D.box('sandstoneDark', (xa, ROOF - .5, z - .5), (xb, ROOF, z + .5))
        D.box('lapis', (xa, ROOF - .5, z - .505), (xb, ROOF - .38, z + .505))
    for i, x in enumerate(COLX):
        if (i, k) in STAIR_COLS: continue
        for s in (-1, 1): D.box('gold', (x - .7, ROOF - .36, z + s * .502 - .003), (x + .7, ROOF - .3, z + s * .502 + .003))
# The fallen middle row: drums lying low and split bases, all under step height (no collision).
for x in COLX:
    z = COLZ[FALLEN_ROW]
    lathe(D, 'limestoneShade', x, z, [(.6, 0), (.6, .1), (.55, .16)], 20)
    lathe(D, 'sandstone', x, z, [(.47, .16), (.5, .22), (.0, .22)], 16)
    D.blob('sandstoneDark', (x + .5, .02, z + .55), .22, .45); D.blob('sandstone', (x - .55, .02, z - .4), .18, .4)
for i in range(160):   # stars on the lapis soffit between the architraves
    x, z = rng.uniform(-10.2, 10.2), rng.uniform(-14.2, 4.2)
    if min(abs(z - zz) for zz in COLZ) < .65 or (WELL[0] - .1 < x < WELL[1] + .1 and WELL[2] < z < WELL[3]): continue
    s = rng.uniform(.06, .1)
    for k in range(5):
        t = math.tau * k / 5; D.tri('goldPale', (x, ROOF - .007, z), (x + s * math.cos(t), ROOF - .007, z + s * math.sin(t)), (x + s * .4 * math.cos(t + .63), ROOF - .007, z + s * .4 * math.sin(t + .63)))
# Sun disc standards on the roof corners and the clerestory light: shafts of sun through the roof slits.
GLOWS, POOLS, EMBERS = [], [], []
for sx in (-1, 1):
    for z in (-14.4, 4.4):
        x = sx * 10.3; beam(D, 'cedar', (x, ROOFTOP, z), (x, ROOFTOP + 3.2, z), .06, 6)
        for k in range(14):
            t0, t1 = math.tau * k / 14, math.tau * (k + 1) / 14
            for zz, flip in ((z - .02, 1), (z + .02, 0)):
                q = [(x, ROOFTOP + 3.5, zz), (x + .32 * math.cos(t0), ROOFTOP + 3.5 + .32 * math.sin(t0), zz), (x + .32 * math.cos(t1), ROOFTOP + 3.5 + .32 * math.sin(t1), zz)]
                D.tri('sunDisc', *(q if flip else q[::-1]))
        GLOWS.append([x, ROOFTOP + 3.5, z, 1.4, '#ffd36b', .1])
for sx in (-1, 1):
    xm = sx * 20.4 + sx * .12 if sx > 0 else -20.4 + sx * .12
    xm = (-20.4 - .12) if sx < 0 else (20.4 + .12)
    for z in (-8.4, -4.6, 4.6, 8.4):
        top = 8.9
        for k, col in enumerate(('ochre', 'linen', 'lapis')):
            ya = top - .15 - k * .32
            D.quad(col, (xm, ya, z), (xm - sx * 2.1, ya - .25 - k * .05, z + .25), (xm - sx * 2.0, ya - .5 - k * .05, z + .28), (xm, ya - .3, z))
            D.quad(col, (xm, ya, z), (xm, ya - .3, z), (xm - sx * 2.0, ya - .5 - k * .05, z + .28), (xm - sx * 2.1, ya - .25 - k * .05, z + .25))
# Braziers at the doors and inside the hall, their light pooled on the floor.
for (x, z) in ((-3.3, 6.2), (3.3, 6.2), (-6.3, -16.0), (6.3, -16.0)):
    p = brazier(D, x, 0, z, 1.1); GLOWS.append([round(p[0], 2), round(p[1], 2), round(p[2], 2), 1.3, '#ff9a48', .5]); POOLS.append([x, .02, z, 3.8, '#ffb063', .55]); EMBERS.append([x, p[1], z, .25])
for (x, z) in ((-3.3, -9.75), (3.3, -9.75), (-3.3, -3.15), (3.3, -3.15)):
    lathe(D, 'gold', x, z, [(.18, 0), (.08, .2), (.05, 1.0), (.2, 1.2), (.22, 1.3)], 10)
    p = flame(D, x, 1.3, z, .7); GLOWS.append([x, 1.55, z, 1.0, '#ffb35c', .5]); POOLS.append([x, .02, z, 3.2, '#ffb060', .5])
# Linen awnings over the spawn courts (shade on the start), on cedar poles.
for sx in (-1, 1):
    for z0, z1 in ((-9.5, -4.5), (4.5, 9.5)):
        xa, xb = sorted((sx * 28.8, sx * 24.8))
        for xx in (xa + .1, xb - .1):
            for zz in (z0, z1): beam(D, 'cedar', (xx, 0, zz), (xx, 3.3, zz), .07, 6)
        D.quad('linen', (xa, 3.3, z0), (xb, 3.3, z0), (xb, 3.0, z1), (xa, 3.0, z1)); D.quad('linenShade', (xa, 3.3, z0), (xa, 3.0, z1), (xb, 3.0, z1), (xb, 3.3, z0))
        for k in range(5): D.box('ochre' if k % 2 else 'lapis', (xa, 3.0 - .3 * (k % 2), z0 + k * (z1 - z0) / 5), (xb, 3.02, z0 + (k + .5) * (z1 - z0) / 5)) if False else None
        for k in range(6): D.quad('ochre' if k % 2 else 'lapis', (xa + k * (xb - xa) / 6, 3.0, z1), (xa + (k + 1) * (xb - xa) / 6, 3.0, z1), (xa + (k + 1) * (xb - xa) / 6, 2.7, z1), (xa + k * (xb - xa) / 6, 2.7, z1))
# Sand drifts against the enclosure, wind ripples and scattered potsherds.
for sx in (-1, 1):
    for z in range(-22, 23, 4):
        x = sx * 29.4; D.blob('sandDune', (x - sx * .3, -.25, z + rng.uniform(-1, 1)), rng.uniform(.9, 1.6), .35)
for sz in (-1, 1):
    for x in range(-27, 28, 4): D.blob('sandDune', (x + rng.uniform(-1, 1), -.25, sz * 23.1), rng.uniform(.9, 1.5), .32)
for i in range(70):
    x, z = rng.uniform(-28, 28), rng.uniform(-22, 22)
    if abs(x) < 11.5 and -15.5 < z < 5.5 or (abs(x) < 7.5 and 10.5 < z < 19.5): continue
    D.box('sandShade', (x - .9, 0, z - .02), (x + .9, .015, z + .02)) if i % 2 else D.blob('ochre', (x, .03, z), .07, .5)
# Desert beyond the walls: dunes, the river with sails, and three pyramids on the western horizon.
for i in range(14):
    x = -95 + i * 14.5 + rng.uniform(-4, 4); z = -48 - (i % 3) * 9 - rng.uniform(0, 6)
    for k in range(3): D.blob('distant' if (i + k) % 2 else 'distantShade', (x + k * 6 - 6, -1.6, z - k * 2), 9 + 3 * math.sin(i + k), .32)
for (x, z, s) in ((-78, -150, 26), (-44, -165, 34), (-14, -172, 20)):
    for k in range(4):
        a0, a1 = math.tau * k / 4 + math.pi / 4, math.tau * (k + 1) / 4 + math.pi / 4
        D.tri('pyramid' if k in (1, 2) else 'distantShade', (x, s * .95, z), (x + s * math.cos(a1), -2, z + s * math.sin(a1)), (x + s * math.cos(a0), -2, z + s * math.sin(a0)))
    for k in range(4):
        a0, a1 = math.tau * k / 4 + math.pi / 4, math.tau * (k + 1) / 4 + math.pi / 4; sc = .1
        D.tri('gold', (x, s * .95 + .01, z), (x + s * sc * math.cos(a1), s * .95 * (1 - sc) + .01, z + s * sc * math.sin(a1)), (x + s * sc * math.cos(a0), s * .95 * (1 - sc) + .01, z + s * sc * math.sin(a0)))
D.quad('water', (-90, -.6, 40), (90, -.6, 40), (90, -.6, 70), (-90, -.6, 70))
for (x, z) in ((-30, 50), (12, 58), (40, 46)):
    D.box('cedar', (x - 3, -.5, z - .6), (x + 3, .1, z + .6)); beam(D, 'cedar', (x, .1, z), (x, 6, z), .08, 5)
    D.quad('linen', (x - 2.2, 5.6, z), (x + 2.2, 5.6, z), (x + 1.9, 1.2, z), (x - 1.9, 1.2, z)); D.quad('linenShade', (x + 2.2, 5.6, z), (x - 2.2, 5.6, z), (x - 1.9, 1.2, z), (x + 1.9, 1.2, z))
c.data['presentation'].update(glows=GLOWS, pools=POOLS, embers=EMBERS,
    field=dict(kind='pollen', count=140, color='#ffe6a8', size=.06, min=[-10.5, .3, -14.5], max=[10.5, 4.8, 4.5]))

if '--materials' in sys.argv or not (ROOT / 'assets/materials/sandstone_basecolor.png').exists():
    synth_materials(ROOT / 'assets/materials', dict(
        sandstone=dict(kind='blocks', rows=4, cols=2, joint=.035, contrast=12, vary=.45, bump=1.1, warm=.4),
        limestone=dict(kind='paving', rows=2, cols=2, contrast=10, bump=.8),
        sand=dict(kind='sand', rows=9, contrast=12, bump=1.0, warm=.5),
        granite=dict(kind='plaster', contrast=16, bump=.5, rough=170, grain=.9),
        cedar=dict(kind='wood', rows=9, cols=2, contrast=18, bump=1.0),
        linen=dict(kind='cloth', contrast=8, bump=.5),
        gold=dict(kind='metal', contrast=10, bump=.4, rough=120, metal=200, roughVary=25)), seed=1352)
bind_textures(c, ROOT, dict(sandstone=(.6, .45, ['sandstone', 'sandstoneDark', 'sandstoneLight']), limestone=(.5, .35, ['limestone', 'limestoneShade']),
    sand=(.35, .55, ['sand', 'sandDune', 'sandShade']), granite=(1.1, .35, ['granite', 'graniteDark']), cedar=(1, .4, ['cedar', 'palmTrunk']),
    linen=(1.6, .3, ['linen', 'linenShade']), gold=(1.4, .25, ['gold', 'goldPale'])))
c.save(render_object=c.renderer(KINDS))
