"""ORLEANS 奥尔良: a walled river town on the Loire, anime fiction of the relieved city.
Run: python3 arena-maps/orleans/source/build.py        (add --materials to re-synthesise surfaces)

Play idea: a town you fight through on three storeys.
  * market square: stalls, a hay cart and the bronze standard-bearer on her plinth;
  * four half-timbered houses you can enter, each with an inner stair to an upper room
    whose windows command the square, the lane or the quay;
  * the north rampart: a wall walk the length of the town, through a covered gate tower;
  * the quay: a lower level along the river, reached by four stairs, hidden from the square.
Teams start behind the west and east town gates. Collision is mirrored in x.
"""
from pathlib import Path
import sys, math, random
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT.parent / '_lib'))
from glbkit import Mesh
from chapterkit import mat, beam, cone, frustum, flame, lantern, hiproof
from erakit import Era, ext, place, lathe, loft, rect, tbox, steps, arch, gable, rope, scatter, synth_materials, bind_textures

P = dict(
    limestone=mat('#d9cdb2'), limestoneShade=mat('#bfb296'), limestoneLight=mat('#e8dec6'), cobble=mat('#a39a8a'), cobbleDark=mat('#8a8275'), cobbleWarm=mat('#b3a68f'),
    plaster=mat('#eadfc6'), plasterWarm=mat('#e3cfa6'), plasterRose=mat('#dcc0aa'), timber=mat('#5a4334'), timberDark=mat('#3f3028'), oak=mat('#93714c'), oakLight=mat('#b08a5e'),
    slate=mat('#4b5f76'), slateLight=mat('#637991'), slateDark=mat('#394a5e'), brick=mat('#a8644b'),
    blue=mat('#3f5f93'), blueLight=mat('#5b7fb4'), white=mat('#f1eadb'), gold=mat('#c9a955', .7, .38), red=mat('#a8483c'),
    bronze=mat('#4d7868', .7, .45), bronzeDark=mat('#345349', .65, .5), iron=mat('#3b3f45', .55, .5), glass=mat('#6f8fa6', .1, .25), glassLit=mat('#ffd08a', 0, 1, 2.2),
    canvas=mat('#e9e0cc'), canvasShade=mat('#cdbfa3'), hay=mat('#d2b566'), rope=mat('#9b8762'), sack=mat('#bca980'),
    leaf=mat('#7d9a58'), leafLight=mat('#98ad66'), leafDark=mat('#5f7f4a'), trunk=mat('#6b5140'), pear=mat('#c9b25a'),
    water=('#4f8ea6', .1, .22, 0, .82), waterDeep=mat('#3a6f86'), bank=mat('#a9b08a'), farStone=mat('#c9c2b4'), farRoof=mat('#6f8198'), farShade=mat('#a7a79f'),
    lampGlass=mat('#ffd9a0', 0, 1, 3.0), flame=mat('#ff9a3c', 0, 1, 3.2), flameCore=mat('#ffe6a0', 0, 1, 4.5), coal=mat('#c2461e', 0, .9, 1.6),
    bread=mat('#c99a5c'), fruit=mat('#b9503c'), cloth=mat('#7c5c8c'))
QUAY = -1.6
c = Era(ROOT, 'orleans', 'ORLEANS 奥尔良', 60, 44, 'loire', P, height=12, lowest=QUAY); D = c.detail
rng = random.Random(1429)
WALK = 4.0; UP = 3.25; EAVE = 6.2

# ------------------------------------------------------------------ collision layout
c.B('floor_town', -30, 30, -2.6, 0, -22, 15.4, 'cobble', 'floor', dict(kind='townfloor'))
c.B('quay_floor', -30, 30, -2.6, QUAY, 15.4, 22, 'cobbleWarm', 'floor')
for sx in (-1, 1):
    c.B(f'boundary_x_{sx}', sx * 30, sx * 29.4, QUAY, 6.4, -22, 22, 'limestone', 'structure', dict(kind='townwall', sx=sx))
# North rampart: outer parapet on the boundary, the wall walk inside it.
c.B('rampart_parapet', -29.4, 29.4, 0, WALK + 1.3, -22, -21.5, 'limestone', 'structure', dict(kind='battlement'))
c.B('rampart_walk', -29.4, 29.4, 0, WALK, -21.5, -19, 'limestone', 'floor', dict(kind='walk'))
c.B('tower_inner_wall', -2.2, 2.2, WALK, WALK + 2.9, -19.3, -19, 'limestone', 'structure', dict(kind='towerwall'))
c.B('tower_roof', -2.6, 2.6, WALK + 2.9, WALK + 5.6, -22, -19, 'slate', 'roof', dict(kind='towerroof'), collision=False)
for sx in (-1, 1):
    c.B(f'corner_tower_{sx}', sx * 29.4, sx * 27, WALK, WALK + 3.2, -21.5, -19, 'limestone', 'structure', dict(kind='cornertower'))
    c.R(f'rampart_stair_{sx}', sx * 14, sx * 4, 0, WALK, -19, -17.2, 'x', -sx, 'limestone', dict(kind='stonestair'))
    c.anchor(f'cover_rampart_{sx}', 'cover', [sx * 20, WALK, -20.3], height=1.3)
c.anchor('objective_rampart', 'objective', [0, WALK, -20.4], radius=2)

def house(name, x0, x1, z0, z1, sx, back):
    """Two-storey half-timbered house. `sx` is its side of the map; `back` (+1/-1) is the z side its stair runs along."""
    T = .4; sq = x1                               # square-facing wall plane (outer face); callers pass the outer x first
    out = x0                                      # wall away from the square
    off = lambda d: out - sx * d                  # a distance in from the outer wall, mirrored with the house
    zb, zf = (z1, z0) if back > 0 else (z0, z1)   # back wall plane, front (street) wall plane
    ax0, ax1 = min(x0, x1), max(x0, x1)
    def W(id, xa, xb, ya, yb, za, zb_, level, axis, face, part='wall'):
        c.B(f'{name}_{id}', xa, xb, ya, yb, za, zb_, 'limestone' if level == 'g' else 'plaster', 'structure', dict(kind='hwall', level=level, axis=axis, face=face, part=part))
    for level, y0, y1 in (('g', 0, 3.0), ('u', UP, EAVE)):
        # wall away from the square: solid
        xa, xb = (out, out + T) if sx < 0 else (out - T, out)
        W(f'{level}_out', xa, xb, y0, y1, z0, z1, level, 'x', sx)
        # back wall: solid at ground; above, a window toward the quay or the rampart lane
        za, zb_ = (zb - T, zb) if back > 0 else (zb, zb + T)
        if level == 'g': W('g_back', ax0 + T, ax1 - T, y0, y1, za, zb_, level, 'z', back)
        else:
            wx0, wx1 = (ax1 - 3.0, ax1 - 1.8) if sx < 0 else (ax0 + 1.8, ax0 + 3.0)
            W('u_back_sill', ax0 + T, ax1 - T, UP, 4.15, za, zb_, 'u', 'z', back, 'sill')
            W('u_back_a', ax0 + T, wx0, 4.15, 5.4, za, zb_, 'u', 'z', back, 'pier'); W('u_back_b', wx1, ax1 - T, 4.15, 5.4, za, zb_, 'u', 'z', back, 'pier')
            W('u_back_head', ax0 + T, ax1 - T, 5.4, EAVE, za, zb_, 'u', 'z', back, 'head')
        # front wall: street door at ground; one window above
        za, zb_ = (zf, zf + T) if back > 0 else (zf - T, zf)
        dx0, dx1 = sorted((off(2.7), off(4.3)))
        if level == 'g':
            W('g_front_a', ax0 + T, dx0, 0, 3.0, za, zb_, 'g', 'z', -back); W('g_front_b', dx1, ax1 - T, 0, 3.0, za, zb_, 'g', 'z', -back)
            W('g_front_lintel', dx0, dx1, 2.3, 3.0, za, zb_, 'g', 'z', -back, 'lintel')
        else:
            W('u_front_sill', ax0 + T, ax1 - T, UP, 4.15, za, zb_, 'u', 'z', -back, 'sill')
            wa, wb = sorted((off(3.4), off(4.6)))
            W('u_front_a', ax0 + T, wa, 4.15, 5.4, za, zb_, 'u', 'z', -back, 'pier'); W('u_front_b', wb, ax1 - T, 4.15, 5.4, za, zb_, 'u', 'z', -back, 'pier')
            W('u_front_head', ax0 + T, ax1 - T, 5.4, EAVE, za, zb_, 'u', 'z', -back, 'head')
        # square wall: a door at ground, two windows above
        xa, xb = (sq - T, sq) if sx < 0 else (sq, sq + T)
        zc = (z0 + z1) / 2
        if level == 'g':
            W('g_sq_a', xa, xb, 0, 3.0, z0, zc - .8, 'g', 'x', -sx); W('g_sq_b', xa, xb, 0, 3.0, zc + .8, z1, 'g', 'x', -sx)
            W('g_sq_lintel', xa, xb, 2.3, 3.0, zc - .8, zc + .8, 'g', 'x', -sx, 'lintel')
        else:
            W('u_sq_sill', xa, xb, UP, 4.15, z0, z1, 'u', 'x', -sx, 'sill')
            for i, (za_, zb2) in enumerate(((z0, zc - 2.3), (zc - 1.1, zc + 1.1), (zc + 2.3, z1))): W(f'u_sq_pier_{i}', xa, xb, 4.15, 5.4, za_, zb2, 'u', 'x', -sx, 'pier')
            W('u_sq_head', xa, xb, 5.4, EAVE, z0, z1, 'u', 'x', -sx, 'head')
    # inner stair along the back wall, rising away from the square; the upper floor leaves its well open
    sz0, sz1 = (zb - T - 1.3, zb - T) if back > 0 else (zb + T, zb + T + 1.3)
    stx_top, stx_low = (ax0 + T, ax0 + T + 5.6) if sx < 0 else (ax1 - T, ax1 - T - 5.6)
    c.R(f'{name}_stair', stx_top, stx_low, 0, UP, sz0, sz1, 'x', -sx, 'oak', dict(kind='woodstair'))
    fz0, fz1 = (z0 + T, sz0) if back > 0 else (sz1, z1 - T)
    c.B(f'{name}_floor', ax0 + T, ax1 - T, 3.0, UP, fz0, fz1, 'oak', 'floor', dict(kind='boards'))
    c.B(f'{name}_roof', ax0 - .5, ax1 + .5, EAVE, EAVE + 3.6, z0 - .5, z1 + .5, 'slate', 'roof', dict(kind='houseroof', sx=sx, back=back), collision=False)
    zc = (z0 + z1) / 2; doorx = sq + (-sx) * 1.2
    c.anchor(f'cover_{name}_door', 'cover', [doorx, 0, zc + 1.6], height=3.0)
    c.anchor(f'cover_{name}_upper', 'cover', [(ax0 + ax1) / 2, UP, (fz0 + fz1) / 2], height=.9)
    return dict(sq=sq, zc=zc, stair=(stx_top, stx_low, sz0, sz1), floor=(fz0, fz1), ax=(ax0, ax1))

HOUSES = {}
for sx in (-1, 1):
    side = 'w' if sx < 0 else 'e'
    HOUSES['n' + side] = house('house_n' + side, sx * 20, sx * 12, -15, -8, sx, -1)
    HOUSES['s' + side] = house('house_s' + side, sx * 20, sx * 12, 5, 12, sx, 1)

# Town gates in front of the spawn yards.
for sx in (-1, 1):
    team = 'west' if sx < 0 else 'east'
    c.B(f'gate_wall_{team}_n', sx * 23.6, sx * 22.4, 0, 6, -9, -4, 'limestone', 'structure', dict(kind='gatewall', sx=sx))
    c.B(f'gate_wall_{team}_s', sx * 23.6, sx * 22.4, 0, 6, -1.2, 9, 'limestone', 'structure', dict(kind='gatewall', sx=sx))
    c.B(f'gate_lintel_{team}', sx * 23.6, sx * 22.4, 3.3, 6, -4, -1.2, 'limestone', 'structure', dict(kind='gatearch', sx=sx))
    for i, z in enumerate((-2, 2)): c.anchor(f'spawn_{team}_{i}', 'spawn', [sx * 27, 0, z], yaw=-sx * 1.5708, team=team)
    c.B(f'spawn_mark_{team}', sx * 27.8, sx * 26.2, 0, .04, -2.8, 2.8, 'blue' if sx < 0 else 'red', 'wayfinding', collision=False)
    c.anchor(f'cover_gate_{team}', 'cover', [sx * 24.4, 0, 3], height=6)
    c.B(f'yard_well_{team}', sx * 28.6, sx * 27, 0, 1.0, 10.4, 12, 'limestone', 'cover', dict(kind='well'))
    # market square furniture
    c.B(f'stall_{team}_n', sx * 7.4, sx * 5, 0, 1.15, -6.6, -4.6, 'oak', 'cover', dict(kind='stall', goods='bread'))
    c.B(f'stall_{team}_s', sx * 7.4, sx * 5, 0, 1.15, 2.2, 4.2, 'oak', 'cover', dict(kind='stall', goods='cloth'))
    c.B(f'cart_{team}', sx * 10.6, sx * 8.4, 0, 1.5, -.8, .8, 'oak', 'cover', dict(kind='cart', sx=sx))
    c.anchor(f'cover_stall_{team}', 'cover', [sx * 8.2, 0, -5.6], height=1.15)
    c.anchor(f'cover_cart_{team}', 'cover', [sx * 11.4, 0, 0], height=1.5)
    # quay: parapet on the street edge, two stairs down, cargo on the lower level
    for i, (x0, x1) in enumerate(((12.2, 22.8), (26.2, 29.4))):
        c.B(f'quay_parapet_{team}_{i}', sx * x0, sx * x1, 0, 1.0, 15.0, 15.4, 'limestone', 'cover', dict(kind='qparapet'))
    for i, (x0, x1) in enumerate(((9, 12), (23, 26))):
        c.R(f'quay_stair_{team}_{i}', sx * x0, sx * x1, QUAY, 0, 15.4, 19.4, 'z', 1, 'limestone', dict(kind='stonestair'))
    c.B(f'crates_{team}', sx * 7, sx * 5, QUAY, QUAY + 1.2, 16.6, 18.2, 'oak', 'cover', dict(kind='crates'))
    c.B(f'barrels_{team}', sx * 17.2, sx * 15, QUAY, QUAY + 1.15, 20.4, 22, 'oak', 'cover', dict(kind='barrels'))
    c.anchor(f'cover_crates_{team}', 'cover', [sx * 6, QUAY, 19], height=1.2)
    c.anchor(f'cover_parapet_{team}', 'cover', [sx * 17, 0, 14.4], height=1.0)
c.B('quay_parapet_centre', -8.8, 8.8, 0, 1.0, 15.0, 15.4, 'limestone', 'cover', dict(kind='qparapet'))
c.B('crane', -1.5, 1.5, QUAY, QUAY + 2.4, 15.4, 17.6, 'oak', 'structure', dict(kind='crane'))
c.B('statue_plinth', -1.6, 1.6, 0, 2.0, -2.4, 2.4, 'limestone', 'structure', dict(kind='plinth'))
c.B('statue', -.75, .75, 2.0, 5.4, -2.0, 2.0, 'bronze', 'structure', dict(kind='statue'))
c.anchor('objective_square', 'objective', [0, 0, -4.4], radius=2)
c.anchor('objective_quay', 'objective', [0, QUAY, 19.6], radius=2)
c.anchor('cover_plinth', 'cover', [2.4, 0, 0], height=2.0)

c.route('market_square', [[-27, 0, -2], [-25, 0, -2.6], [-11.4, 0, -2.6], [-4, 0, -3.6], [4, 0, -3.6], [11.4, 0, -2.6], [25, 0, -2.6], [27, 0, -2]])
c.route('rampart_walk', [[-27, 0, -2], [-25.6, 0, -12], [-21.2, 0, -16.1], [-3.5, 0, -16.1], [-3.5, 0, -18.1], [-13.8, WALK, -18.1], [-13.8, WALK, -20.3], [13.8, WALK, -20.3], [13.8, WALK, -18.1], [3.5, 0, -18.1], [3.5, 0, -16.1], [21.2, 0, -16.1]])
c.route('river_quay', [[-27, 0, 2], [-24.5, 0, 12], [-24.5, 0, 15], [-24.5, QUAY, 19.6], [-10.5, QUAY, 19.3], [10.5, QUAY, 19.3], [24.5, QUAY, 19.6], [24.5, 0, 15], [24.5, 0, 12], [27, 0, 2]])
c.route('quay_stair', [[-10.5, 0, 13.6], [-10.5, 0, 15.2], [-10.5, QUAY, 19.6]])
H_ = HOUSES['nw']
c.route('upper_room', [[-9, 0, -11.5], [-13.2, 0, -11.5], [-13.2, 0, -13.95], [-19.3, UP, -13.95], [-19.3, UP, -11], [-13.4, UP, -11]])
H_ = HOUSES['sw']
c.route('quay_house', [[-9, 0, 8.5], [-13.2, 0, 8.5], [-13.2, 0, 10.95], [-19.3, UP, 10.95], [-19.3, UP, 8], [-13.4, UP, 8]])

# ------------------------------------------------------------------ object art
def framing(m, axis, plane, sign, u0, u1, y0, y1, part, depth=.045):
    """Timber frame on a plaster panel: sill and head rails, studs and braces, flush with the face."""
    def bar(ua, ub, ya, yb, mat_='timber'):
        if axis == 'x': m.box(mat_, (min(plane, plane - sign * depth), ya, ua), (max(plane, plane - sign * depth), yb, ub))
        else: m.box(mat_, (ua, ya, min(plane, plane - sign * depth)), (ub, yb, max(plane, plane - sign * depth)))
    def diag(ua, ya, ub, yb, w=.09):
        p = plane - sign * depth / 2
        a, b = ((p, ya, ua), (p, yb, ub)) if axis == 'x' else ((ua, ya, p), (ub, yb, p))
        n = 5
        for k in range(n):   # a brace as a short run of stepped blocks, kept inside the face
            t0, t1 = k / n, (k + 1) / n; uu0, uu1 = ua + (ub - ua) * t0, ua + (ub - ua) * t1; yy0, yy1 = ya + (yb - ya) * t0, ya + (yb - ya) * t1
            bar(min(uu0, uu1) - w / 2, max(uu0, uu1) + w / 2, min(yy0, yy1), max(yy0, yy1), 'timberDark')
    L = u1 - u0
    if part in ('sill', 'wall'):
        bar(u0, u1, y0, y0 + .14); bar(u0, u1, y1 - .1, y1)
        n = max(1, round(L / 1.1))
        for k in range(n + 1): uu = min(max(u0 + L * k / n, u0 + .06), u1 - .06); bar(uu - .06, uu + .06, y0, y1)
        for k in range(n):
            ua, ub = u0 + L * k / n + .08, u0 + L * (k + 1) / n - .08
            if k % 2 == 0: diag(ua, y0 + .16, ub, y1 - .12)
            else: diag(ub, y0 + .16, ua, y1 - .12)
    elif part == 'pier':
        bar(u0, u0 + .12, y0, y1); bar(u1 - .12, u1, y0, y1)
        if L > 1.4: bar((u0 + u1) / 2 - .06, (u0 + u1) / 2 + .06, y0, y1)
    else:
        bar(u0, u1, y0, y0 + .12); bar(u0, u1, y1 - .14, y1)
        n = max(1, round(L / .9))
        for k in range(n + 1): uu = min(max(u0 + L * k / n, u0 + .05), u1 - .05); bar(uu - .05, uu + .05, y0, y1)


def hwall(m, o, a):
    """House wall piece. Ground storey: dressed limestone with a plinth course. Upper: plaster in a timber frame."""
    x0, x1, y0, y1, z0, z1 = ext(o); axis, face, part = a['axis'], a['face'], a.get('part', 'wall')
    plane = (x1 if face > 0 else x0) if axis == 'x' else (z1 if face > 0 else z0)
    back = (x0 if face > 0 else x1) if axis == 'x' else (z0 if face > 0 else z1)
    u0, u1 = (z0, z1) if axis == 'x' else (x0, x1)
    if a['level'] == 'g':
        m.box('limestone', (x0, y0, z0), (x1, y1, z1))
        if part == 'lintel':
            if axis == 'x': m.box('limestoneLight', (min(plane, plane - face * .02), y0, z0), (max(plane, plane - face * .02), y0 + .28, z1))
            else: m.box('limestoneLight', (x0, y0, min(plane, plane - face * .02)), (x1, y0 + .28, max(plane, plane - face * .02)))
        elif y0 < .01:
            for pl, sg in ((plane, face), (back, -face)):
                if axis == 'x': m.box('limestoneShade', (min(pl, pl - sg * .02), y0, z0), (max(pl, pl - sg * .02), y0 + .45, z1))
                else: m.box('limestoneShade', (x0, y0, min(pl, pl - sg * .02)), (x1, y0 + .45, max(pl, pl - sg * .02)))
        return True
    tone = ('plaster', 'plasterWarm', 'plasterRose')[int(abs(x0) + abs(z0)) % 3]
    ins = .05
    if axis == 'x': m.box(tone, (x0 + (ins if face < 0 else 0), y0, z0), (x1 - (ins if face > 0 else 0), y1, z1))
    else: m.box(tone, (x0, y0, z0 + (ins if face < 0 else 0)), (x1, y1, z1 - (ins if face > 0 else 0)))
    framing(m, axis, plane, face, u0, u1, y0, y1, part)
    return True


def boards(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o); x = x0; i = 0
    m.box('timber', (x0, y0, z0), (x1, y0 + .1, z1))
    while x < x1 - .01:
        w = min(.32, x1 - x); m.box('oakLight' if i % 2 else 'oak', (x + .01, y0 + .1, z0), (x + w - .01, y1, z1)); x += .32; i += 1
    return True


def houseroof(m, o, a):
    """Steep slate roof with tile courses, bargeboards, a chimney and a dormer toward the square."""
    x0, x1, y0, y1, z0, z1 = ext(o); sx = a['sx']
    gable(m, 'slate', 'plasterWarm', x0 + .5, x1 - .5, z0 + .5, z1 - .5, y0 + .2, y1 - .5, 'z', .36, .12, rows=7, row_mat='slateLight')
    xc = (x0 + x1) / 2
    for zz in (z0 + .5, z1 - .5):   # gable-end timbers
        for s in (-1, 1): beam(m, 'timber', (xc + s * (x1 - x0 - 1.3) / 2, y0 + .3, zz), (xc, y1 - .66, zz), .07, 4)
        m.box('timber', (xc - .07, y0 + .2, zz - .05), (xc + .07, y1 - .7, zz + .05))
    cz = z0 + 1.6 if a['back'] > 0 else z1 - 1.6
    m.box('brick', (xc - sx * 1.6 - .32, y0 + 1.2, cz - .32), (xc - sx * 1.6 + .32, y1 - .12, cz + .32)); m.box('limestoneShade', (xc - sx * 1.6 - .38, y1 - .12, cz - .38), (xc - sx * 1.6 + .38, y1, cz + .38))
    # dormer on the square side
    xd = (x1 - .9) if sx < 0 else (x0 + .9); zc = (z0 + z1) / 2
    xa, xb = sorted((xd, xd + sx * 1.5))   # the dormer runs back from the square-side eave
    m.box('plaster', (xa, y0 + .2, zc - .6), (xb, y0 + 1.5, zc + .6)); m.box('glass', (xd if sx < 0 else xd - .02, y0 + .5, zc - .35), (xd + .02 if sx < 0 else xd, y0 + 1.3, zc + .35))
    for s in (-1, 1): m.quad('slateLight', (xa, y0 + 1.5, zc + s * .7), (xb, y0 + 1.5, zc + s * .7), (xb, y0 + 2.0, zc), (xa, y0 + 2.0, zc))
    return True


def woodstair(m, o, a):
    steps(m, o, 'oakLight', 'oak', 'timber', .25)
    return True


def stonestair(m, o, a):
    steps(m, o, 'limestoneLight', 'limestone', 'limestoneShade', .2)
    return True


def townfloor(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('cobble', (x0, y0, z0), (x1, y1, z1))
    return True


def townwall(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('limestone', (x0, y0, z0), (x1, y1 - .5, z1)); m.box('limestoneShade', (x0, y1 - .5, z0), (x1, y1 - .36, z1))
    z = z0 + .2; i = 0
    while z < z1 - 1:
        if i % 2 == 0: m.box('limestoneLight', (x0, y1 - .36, z), (x1, y1, z + 1.1))
        z += 1.1; i += 1
    return True


def battlement(m, o, a):
    """Rampart parapet: a breast wall with a string course, merlons with arrow loops between open crenels."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('limestone', (x0, y0, z0), (x1, WALK + .55, z1)); m.box('limestoneShade', (x0, WALK - .2, z0), (x1, WALK - .05, z1))
    x = x0 + .3; i = 0
    while x < x1 - 1.5:
        m.box('limestone', (x, WALK + .55, z0), (x + 1.3, y1 - .1, z1)); m.box('limestoneLight', (x - .04, y1 - .1, z0), (x + 1.34, y1, z1))
        m.box('iron', (x + .6, WALK + .7, z1 - .02), (x + .7, y1 - .35, z1))
        x += 2.1; i += 1
    return True


def walk(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('limestone', (x0, y0, z0), (x1, y1 - .08, z1), top_mat='limestoneShade'); m.box('cobbleWarm', (x0, y1 - .08, z0), (x1, y1, z1 - .25))
    m.box('limestoneLight', (x0, y1 - .08, z1 - .25), (x1, y1, z1))
    for x in range(int(x0) + 2, int(x1) - 1, 4):   # shallow buttress pilasters on the town face
        m.box('limestoneShade', (x - .35, y0, z1 - .06), (x + .35, y1 - .6, z1)) if abs(x) > 14.5 or abs(x) < 3.5 else None
    return True


def towerwall(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('limestone', (x0, y0, z0), (x1, y1, z1))
    for x in (x0 + 1.1, x1 - 1.5): m.box('iron', (x, y0 + 1.0, z1 - .02), (x + .4, y0 + 1.9, z1))
    return True


def towerroof(m, o, a):
    """Gate-tower cap: a floor of beams over the wall walk and a steep hipped slate roof with a finial."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('timber', (x0 + .3, y0, z0 + .1), (x1 - .3, y0 + .3, z1 - .1))
    for x in (x0 + .3, x1 - .5): m.box('limestone', (x, y0 - .0, z0 + .1), (x + .2, y0 + .3, z1 - .1))
    hiproof(m, 'slate', x0, x1, z0, z1, y0 + .3, y1 - .5)
    xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    beam(m, 'gold', (xc, y1 - .6, zc), (xc, y1 - .05, zc), .04, 5)
    return True


def cornertower(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('limestone', (x0, y0, z0), (x1, y1 - .7, z1)); m.box('limestoneShade', (x0, y1 - .7, z0), (x1, y1 - .56, z1))
    for (xa, xb) in ((x0, x0 + .8), (x1 - .8, x1)): m.box('limestoneLight', (xa, y1 - .56, z0), (xb, y1, z1))
    m.box('iron', ((x0 + x1) / 2 - .06, y0 + 1.0, z1 - .02), ((x0 + x1) / 2 + .06, y0 + 2.0, z1))
    return True


def gatewall(m, o, a):
    """Town gate curtain: ashlar with a string course, a blue banner and crenels on top."""
    x0, x1, y0, y1, z0, z1 = ext(o); sx = a['sx']
    m.box('limestone', (x0, y0, z0), (x1, y1 - .7, z1)); m.box('limestoneShade', (x0, 3.2, z0), (x1, 3.34, z1)); m.box('limestoneShade', (x0, y0, z0), (x1, .4, z1))
    z = z0; i = 0
    while z < z1 - .4:
        if i % 2 == 0: m.box('limestoneLight', (x0, y1 - .7, z), (x1, y1, min(z1, z + 1.0)))
        z += 1.0; i += 1
    return True


def gatearch(m, o, a):
    """The gate head: a pointed arch ring under a machicolated lintel, portcullis teeth showing."""
    x0, x1, y0, y1, z0, z1 = ext(o); zc = (z0 + z1) / 2
    m.box('limestone', (x0, y0 + .5, z0), (x1, y1 - .7, z1)); m.box('limestoneLight', (x0, y1 - .7, z0 + .9), (x1, y1, z1 - .9))
    for xf in (x0 + .001, x1 - .13):
        for k in range(7):
            t0, t1 = k / 7, (k + 1) / 7
            za, zb = z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1; h0 = .5 * (1 - abs(2 * t0 - 1)); h1 = .5 * (1 - abs(2 * t1 - 1))
            m.box('limestoneLight' if k % 2 else 'limestoneShade', (xf, y0 + min(h0, h1) * 0, za + .01), (xf + .129, y0 + .5, zb - .01))
    for k in range(6):
        z = z0 + .3 + k * (z1 - z0 - .6) / 5; m.box('iron', ((x0 + x1) / 2 - .05, y0, z - .05), ((x0 + x1) / 2 + .05, y0 + .5, z + .05))
    return True


def well(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o); xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    lathe(m, 'limestone', xc, zc, [(.78, y0), (.78, y1 - .12), (.8, y1 - .12), (.8, y1), (.6, y1), (.6, y0 + .3)], 14, cap=False)
    lathe(m, 'waterDeep', xc, zc, [(.6, y0 + .32), (0, y0 + .32)], 14, cap=False)
    return True


def stall(m, o, a):
    """Market counter with trestle legs and goods laid out; its striped awning is hung above (decor)."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('oak', (x0, y1 - .26, z0), (x1, y1 - .14, z1))
    for xx in (x0 + .12, x1 - .24):
        for zz in (z0 + .12, z1 - .24): m.box('timber', (xx, y0, zz), (xx + .12, y1 - .26, zz + .12))
    m.box('timberDark', (x0 + .1, y0 + .3, z0 + .14), (x1 - .1, y0 + .38, z1 - .14))
    n = 4
    for i in range(n):
        for k in range(2):
            px, pz = x0 + .35 + i * (x1 - x0 - .7) / (n - 1), z0 + .55 + k * (z1 - z0 - 1.1)
            if a['goods'] == 'bread': lathe(m, 'bread', px, pz, [(.17, y1 - .14), (.19, y1 - .08), (.1, y1 - .01)], 8)
            else: m.box(('cloth', 'blue', 'red', 'white')[(i + k) % 4], (px - .2, y1 - .14, pz - .34), (px + .2, y1 - .02 - .03 * ((i + k) % 2), pz + .34))
    return True


def cart(m, o, a):
    """Hay cart: plank bed, staved sides, two spoked wheels and a load of hay."""
    x0, x1, y0, y1, z0, z1 = ext(o); xc = (x0 + x1) / 2
    m.box('oak', (x0 + .1, y0 + .55, z0 + .18), (x1 - .1, y0 + .65, z1 - .18))
    for zz in (z0 + .18, z1 - .24): m.box('timber', (x0 + .1, y0 + .65, zz), (x1 - .1, y0 + 1.0, zz + .06))
    for s, zz in ((-1, z0 + .07), (1, z1 - .07)):
        for k in range(12):
            t0, t1 = math.tau * k / 12, math.tau * (k + 1) / 12; r = .55
            m.quad('timber', (xc + r * math.cos(t0), y0 + r + r * math.sin(t0), zz - .05), (xc + r * math.cos(t1), y0 + r + r * math.sin(t1), zz - .05), (xc + r * math.cos(t1), y0 + r + r * math.sin(t1), zz + .05), (xc + r * math.cos(t0), y0 + r + r * math.sin(t0), zz + .05))
            if k % 2 == 0: beam(m, 'oak', (xc, y0 + r, zz), (xc + (r - .03) * math.cos(t0), y0 + r + (r - .03) * math.sin(t0), zz), .025, 4)
    loft(m, 'hay', [rect(x0 + .16, x1 - .16, y0 + .65, z0 + .26, z1 - .26), rect(x0 + .1, x1 - .1, y0 + 1.1, z0 + .2, z1 - .2), rect(x0 + .4, x1 - .4, y1, z0 + .36, z1 - .36)])
    return True


def qparapet(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('limestone', (x0, y0, z0 + .04), (x1, y1 - .14, z1 - .04)); m.box('limestoneLight', (x0, y1 - .14, z0), (x1, y1, z1))
    return True


def crates(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    def crate(xa, xb, ya, yb, za, zb):
        m.box('oakLight', (xa + .03, ya, za + .03), (xb - .03, yb, zb - .03))
        for (p, q) in (((xa, ya, za), (xb, ya + .07, zb)), ((xa, yb - .07, za), (xb, yb, zb))): m.box('timber', p, q)
        for xx in (xa, xb - .06):
            for zz in (za, zb - .06): m.box('timber', (xx, ya, zz), (xx + .06, yb, zz + .06))
    crate(x0, x0 + 1.0, y0, y0 + .8, z0, z0 + 1.0); crate(x0 + 1.0, x1, y0, y0 + .7, z0 + .1, z1 - .2); crate(x0 + .1, x0 + .95, y0, y0 + .6, z0 + 1.0, z1)
    crate(x0 + .25, x0 + .85, y0 + .8, y1, z0 + .2, z0 + .8)
    m.blob('sack', (x1 - .45, y0 + .82, (z0 + z1) / 2 - .2), .28, .6)
    return True


def barrels(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    for (x, z, hh) in ((x0 + .42, z0 + .42, .95), (x0 + 1.25, z0 + .42, .95), (x1 - .42, z0 + .45, .9), (x0 + .5, z1 - .45, .92), (x0 + 1.4, z1 - .42, .9), (x0 + .85, z0 + .5, 0)):
        if not hh:   # one stacked on the pair
            lathe(m, 'oak', x, z + .25, [(.26, y0 + .92), (.3, y0 + 1.03), (.26, y1)], 10)
            continue
        lathe(m, 'oak', x, z, [(.33, y0), (.4, y0 + hh * .5), (.33, y0 + hh)], 12)
        for yy in (.16, .5, .82): lathe(m, 'iron', x, z, [(.37 + .03 * (1 - abs(yy - .5) * 2) + .005, y0 + hh * yy - .03), (.37 + .03 * (1 - abs(yy - .5) * 2) + .005, y0 + hh * yy + .03)], 12, cap=False)
    return True


def crane(m, o, a):
    """Treadwheel crane house on the quay: the big wheel shows through its open side; the jib is above (decor)."""
    x0, x1, y0, y1, z0, z1 = ext(o); xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    for xx in (x0, x1 - .16):
        for zz in (z0, z1 - .16): m.box('timber', (xx, y0, zz), (xx + .16, y1, zz + .16))
    m.box('timber', (x0, y1 - .16, z0), (x1, y1, z1)); m.box('oak', (x0, y0, z0), (x1, y0 + .14, z1))
    for k in range(16):
        t0, t1 = math.tau * k / 16, math.tau * (k + 1) / 16; r = 1.02; yc = y0 + .14 + r + .04
        for (za, zb) in ((zc - .55, zc + .55),):
            m.quad('oakLight', (xc + r * math.cos(t0), yc + r * math.sin(t0), za), (xc + r * math.cos(t1), yc + r * math.sin(t1), za), (xc + r * math.cos(t1), yc + r * math.sin(t1), zb), (xc + r * math.cos(t0), yc + r * math.sin(t0), zb))
        if k % 2 == 0:
            for zz in (zc - .55, zc + .55): beam(m, 'oak', (xc, yc, zz), (xc + (r - .03) * math.cos(t0), yc + (r - .03) * math.sin(t0), zz), .035, 4)
    beam(m, 'timberDark', (xc, y0 + 1.2, z0 + .08), (xc, y0 + 1.2, z1 - .08), .09, 6)
    return True


def plinth(m, o, a):
    """Stepped limestone pedestal with a moulded cap and bronze relief panels."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    tbox(m, 'limestoneShade', x0, x1, z0, z1, y0, y0 + .3, .06); tbox(m, 'limestone', x0 + .14, x1 - .14, z0 + .14, z1 - .14, y0 + .3, y0 + .55, .05)
    m.box('limestoneLight', (x0 + .3, y0 + .55, z0 + .3), (x1 - .3, y1 - .3, z1 - .3))
    tbox(m, 'limestone', x0 + .3, x1 - .3, z0 + .3, z1 - .3, y1 - .3, y1 - .14, -.2); m.box('limestoneShade', (x0 + .08, y1 - .14, z0 + .08), (x1 - .08, y1, z1 - .08))
    for xf, sg in ((x0 + .3, -1), (x1 - .3, 1)):
        m.box('bronzeDark', (min(xf, xf + sg * .03), y0 + .75, z0 + .7), (max(xf, xf + sg * .03), y1 - .5, z1 - .7))
        for k in range(3): m.box('gold', (min(xf + sg * .03, xf + sg * .045), y0 + 1.0 + k * .22, z0 + 1.0), (max(xf + sg * .03, xf + sg * .045), y0 + 1.06 + k * .22, z1 - 1.0 - k * .5))
    return True


def statue(m, o, a):
    """Bronze standard-bearer on a walking horse, facing the river (+z); the banner is fixed to the lance."""
    x0, x1, y0, y1, z0, z1 = ext(o); B_, BD = 'bronze', 'bronzeDark'
    def ring(z, y, w, h, n=8): return [(w / 2 * math.cos(math.tau * i / n), y + h / 2 * math.sin(math.tau * i / n), z) for i in range(n)]
    m.box(BD, (-.6, y0, -1.75), (.6, y0 + .08, 1.75))
    loft(m, B_, [ring(-1.2, y0 + 1.5, .4, .52), ring(-.95, y0 + 1.55, .58, .72), ring(-.2, y0 + 1.5, .6, .72), ring(.55, y0 + 1.56, .58, .76), ring(.85, y0 + 1.64, .42, .6)])
    loft(m, B_, [ring(.8, y0 + 1.7, .34, .52), ring(1.05, y0 + 2.0, .26, .4), ring(1.2, y0 + 2.22, .2, .3)], close=False)
    loft(m, B_, [ring(1.16, y0 + 2.26, .22, .3), ring(1.45, y0 + 2.12, .17, .23), ring(1.66, y0 + 1.98, .12, .15)])
    for s in (-1, 1):
        m.tri(BD, (s * .07, y0 + 2.38, 1.12), (s * .1, y0 + 2.38, 1.2), (s * .09, y0 + 2.55, 1.15))
        for (z, lift, back) in ((.7, .25 if s > 0 else 0, 0), (-.9, 0 if s > 0 else .12, 1)):
            knee = (s * .17, y0 + .78 + lift, z + (.2 if lift else 0)); hoof = (s * .17, y0 + .1 + lift * .6, z + (.05 if lift else 0))
            beam(m, B_, (s * .17, y0 + 1.3, z), knee, .09, 6); beam(m, B_, knee, hoof, .065, 6); m.box(BD, (hoof[0] - .08, hoof[1] - .02, hoof[2] - .09), (hoof[0] + .08, hoof[1] + .08, hoof[2] + .1))
    beam(m, BD, (0, y0 + 1.72, -1.2), (0, y0 + 1.0, -1.62), .07, 6)                                           # tail
    for k in range(5): m.box(BD, (-.03, y0 + 1.86 + k * .09, .84 + k * .08), (.03, y0 + 2.0 + k * .09, .9 + k * .08))  # mane
    # rider in plate: skirted cuirass, pauldrons, bare head with a bob of hair
    m.box(BD, (-.34, y0 + 1.84, -.5), (.34, y0 + 1.92, .2))                                                       # saddle
    for s in (-1, 1):
        beam(m, B_, (s * .25, y0 + 1.95, -.1), (s * .36, y0 + 1.35, .12), .1, 6); beam(m, B_, (s * .36, y0 + 1.35, .12), (s * .36, y0 + .95, .0), .08, 6)
        m.box(BD, (s * .36 - .07, y0 + .86, -.05), (s * .36 + .07, y0 + .96, .22))
    loft(m, B_, [rect(-.26, .26, y0 + 1.9, -.36, .04), rect(-.2, .2, y0 + 2.2, -.3, 0), rect(-.26, .26, y0 + 2.62, -.32, .02), rect(-.3, .3, y0 + 2.78, -.3, 0), rect(-.12, .12, y0 + 2.86, -.24, -.06)])
    for s in (-1, 1): m.blob(B_, (s * .32, y0 + 2.76, -.15), .13, .8)
    beam(m, B_, (-.32, y0 + 2.72, -.15), (-.38, y0 + 2.3, .08), .07, 6); beam(m, B_, (-.38, y0 + 2.3, .08), (-.2, y0 + 2.15, .42), .06, 6)   # rein arm
    beam(m, B_, (.32, y0 + 2.72, -.15), (.46, y0 + 2.42, .1), .07, 6); beam(m, B_, (.46, y0 + 2.42, .1), (.46, y0 + 2.7, .3), .06, 6)       # lance arm
    m.blob(B_, (0, y0 + 3.02, -.14), .15, 1.12); m.box(BD, (-.17, y0 + 2.94, -.3), (.17, y0 + 3.16, -.12)); m.box(BD, (-.17, y0 + 2.9, -.3), (-.1, y0 + 3.1, -.02)); m.box(BD, (.1, y0 + 2.9, -.3), (.17, y0 + 3.1, -.02))
    beam(m, 'gold', (.46, y0 + 1.7, .34), (.46, y1 - .05, .22), .03, 6)                                          # lance
    m.tri('gold', (.42, y1 - .3, .22), (.5, y1 - .3, .22), (.46, y1, .22))
    # the standard: a long white swallow-tailed banner flown back along the horse
    yb = y1 - .45
    m.quad('white', (.46, yb, .2), (.46, yb, -1.3), (.46, yb - .85, -1.2), (.46, yb - .9, .2)); m.quad('white', (.47, yb, -1.3), (.47, yb, .2), (.47, yb - .9, .2), (.47, yb - .85, -1.2))
    m.tri('white', (.46, yb, -1.3), (.46, yb - .2, -1.9), (.46, yb - .42, -1.26)); m.tri('white', (.46, yb - .42, -1.26), (.46, yb - .62, -1.9), (.46, yb - .85, -1.2))
    for k in range(3): m.box('gold', (.455, yb - .28 - k * .18, -.2 - k * .3), (.475, yb - .2 - k * .18, -.04 - k * .3))
    return True


KINDS = dict(hwall=hwall, boards=boards, houseroof=houseroof, woodstair=woodstair, stonestair=stonestair, townfloor=townfloor, townwall=townwall,
             battlement=battlement, walk=walk, towerwall=towerwall, towerroof=towerroof, cornertower=cornertower, gatewall=gatewall, gatearch=gatearch,
             well=well, stall=stall, cart=cart, qparapet=qparapet, crates=crates, barrels=barrels, crane=crane, plinth=plinth, statue=statue,
             steps=stonestair)

# ------------------------------------------------------------------ decorative craft
GLOWS, POOLS, EMBERS = [], [], []
# Square paving: a ring of pale setts round the statue, gutters toward the gates, worn strips to the doors.
for k in range(40):
    t0, t1 = math.tau * k / 40, math.tau * (k + 1) / 40
    for (ra, rb, mm) in ((3.4, 3.9, 'limestoneShade'), (6.0, 6.3, 'cobbleDark'), (9.2, 9.5, 'cobbleWarm')):
        D.quad(mm if k % 2 else 'cobbleWarm', (ra * math.cos(t1), .012, ra * math.sin(t1) * .82), (ra * math.cos(t0), .012, ra * math.sin(t0) * .82), (rb * math.cos(t0), .012, rb * math.sin(t0) * .82), (rb * math.cos(t1), .012, rb * math.sin(t1) * .82))
for sx in (-1, 1):
    D.box('cobbleDark', (sx * 22.4 if sx < 0 else 11.8, 0, -2.85), (-11.8 if sx < 0 else sx * 22.4, .012, -2.35))
    for z in (-15.6, 13.2): D.box('cobbleDark', (min(sx * 22, sx * 3), 0, z - .12), (max(sx * 22, sx * 3), .012, z + .12))
# Stall awnings: striped canvas on poles, clear of the body band.
for sx in (-1, 1):
    for (z0, z1) in ((-6.6, -4.6), (2.2, 4.2)):
        xa, xb = sorted((sx * 7.6, sx * 4.8))
        for xx in (xa + .08, xb - .08):
            for zz in (z0 - .1, z1 + .1): beam(D, 'timber', (xx, 1.0, zz), (xx, 2.5 if zz < (z0 + z1) / 2 else 2.2, zz), .035, 5)
        n = 7
        for k in range(n):
            ua, ub = xa + (xb - xa) * k / n, xa + (xb - xa) * (k + 1) / n; mm = 'blue' if k % 2 else 'white'
            D.quad(mm, (ua, 2.5, z0 - .2), (ub, 2.5, z0 - .2), (ub, 2.2, z1 + .2), (ua, 2.2, z1 + .2)); D.quad('canvasShade', (ub, 2.49, z0 - .2), (ua, 2.49, z0 - .2), (ua, 2.19, z1 + .2), (ub, 2.19, z1 + .2))
            D.tri(mm, (ua, 2.2, z1 + .2), (ub, 2.2, z1 + .2), ((ua + ub) / 2, 1.98, z1 + .22))
# House dressing: shop signs, shutters, flower boxes and lit windows; chimneys smoke.
SMOKE = []
for key, h in HOUSES.items():
    sx = -1 if key.endswith('w') else 1; sq, zc = h['sq'], h['zc']; face = -sx
    xs = sq + face * .03
    for dz in (-1.7, 1.7):   # shutters and flower boxes at the two upper windows
        for s in (-1, 1):
            za, zb = sorted((zc + dz + s * .62, zc + dz + s * .98)); D.box('blue' if key[0] == 'n' else 'red', (min(xs, xs + face * .05), 4.2, za), (max(xs, xs + face * .05), 5.36, zb))
        D.box('timber', (min(xs, xs + face * .26), 3.98, zc + dz - .6), (max(xs, xs + face * .26), 4.14, zc + dz + .6))
        for k in range(5): D.blob(('leaf', 'fruit', 'leafLight', 'pear', 'leaf')[k], (xs + face * .14, 4.2, zc + dz - .44 + k * .22), .11, .9)
    # hanging sign on an iron bracket by the door
    zs = zc + 1.5
    beam(D, 'iron', (xs, 2.75, zs), (xs + face * .9, 2.75, zs), .025, 4); beam(D, 'iron', (xs, 2.45, zs), (xs + face * .55, 2.75, zs), .02, 4)
    D.box('oak', (min(xs + face * .35, xs + face * .85), 2.1, zs - .03), (max(xs + face * .35, xs + face * .85), 2.6, zs + .03))
    D.box('gold', (min(xs + face * .48, xs + face * .72), 2.25, zs - .04), (max(xs + face * .48, xs + face * .72), 2.45, zs + .04))
    p = lantern(D, xs + face * .9, 2.36, zs - .0, .8); GLOWS.append([round(p[0], 2), round(p[1], 2), round(p[2], 2), 1.0, '#ffc47a', .3]); POOLS.append([round(p[0], 2), .02, round(p[2], 2), 3.0, '#ffc27a', .35])
    ax0, ax1 = h['ax']; xch = (ax0 + ax1) / 2 - sx * 1.6
    SMOKE.append([round(xch, 2), EAVE + 3.9, round((-13.4 if key[0] == 'n' else 6.6), 2), 1.2, '#cfcbc2'])
    # jetty: the upper storey's bressummer and brackets over the square-side door
    D.box('timber', (min(xs, xs + face * .22), 2.98, h['zc'] - 3.5), (max(xs, xs + face * .22), 3.26, h['zc'] + 3.5))
    for dz in (-3.2, -1.1, 1.1, 3.2): beam(D, 'timberDark', (xs, 2.6, zc + dz), (xs + face * .2, 2.98, zc + dz), .06, 4)
    # a table and stools on the ground floor, a bed and chest upstairs
    fz0, fz1 = h['floor']; xin = (ax0 + ax1) / 2
    D.box('oak', (xin - .7, .72, (fz0 + fz1) / 2 - .45), (xin + .7, .8, (fz0 + fz1) / 2 + .45))
    for s in (-1, 1): D.box('timber', (xin + s * .6 - .05, 0, (fz0 + fz1) / 2 - .4), (xin + s * .6 + .05, .72, (fz0 + fz1) / 2 + .4))
    xb0 = ax0 + .5 if sx < 0 else ax1 - 2.5
    zb0 = fz1 - 1.1 if key[0] == 'n' else fz0 + .1
    D.box('timber', (xb0, UP, zb0), (xb0 + 2.0, UP + .3, zb0 + 1.0)); D.box('canvas', (xb0 + .05, UP + .3, zb0 + .05), (xb0 + 1.95, UP + .42, zb0 + .95)); D.box('blue', (xb0 + .9, UP + .42, zb0 + .05), (xb0 + 1.95, UP + .46, zb0 + .95))
# Gate dressing: blue banners with a gold lily-like device (abstract), torches by the arch.
for sx in (-1, 1):
    xf = sx * 22.4 - sx * .0; face = -sx
    for z in (-6.5, 4):
        xq = xf + face * .03
        pts = [(xq, 5.0, z - .6), (xq, 5.0, z + .6), (xq, 2.7, z + .6), (xq, 2.3, z), (xq, 2.7, z - .6)]
        for k in range(1, 4): D.tri('blue' if sx < 0 else 'red', pts[0], pts[k], pts[k + 1]) if face > 0 else D.tri('blue' if sx < 0 else 'red', pts[0], pts[k + 1], pts[k])
        D.box('gold', (min(xq, xq + face * .02), 5.0, z - .7), (max(xq, xq + face * .02), 5.08, z + .7))
        for (dz, ya, yb) in ((0, 3.3, 4.5), (-.25, 3.5, 4.1), (.25, 3.5, 4.1)): D.box('gold', (min(xq + face * .01, xq + face * .025), ya, z + dz - .06), (max(xq + face * .01, xq + face * .025), yb, z + dz + .06))
        D.box('gold', (min(xq + face * .01, xq + face * .025), 3.42, z - .34), (max(xq + face * .01, xq + face * .025), 3.5, z + .34))
    for z in (-4.5, -.7):
        beam(D, 'iron', (xf + face * .02, 2.5, z), (xf + face * .32, 2.7, z), .03, 4); p = flame(D, xf + face * .32, 2.74, z, .6)
        GLOWS.append([round(p[0], 2), round(p[1], 2), z, 1.1, '#ff9c4a', .5]); EMBERS.append([round(p[0], 2), round(p[1], 2), z, .2])
# Tower passage arches, a banner pole on the gate tower, lanterns along the wall walk.
for xx in (-2.2, 2.2):
    arch(D, 'limestoneLight', (xx, WALK + .0, -20.25), 2.2, 2.3, .34, .22, 'z', 10, True, 'limestoneShade')
for x in (-22, -9, 9, 22):
    beam(D, 'iron', (x, WALK + 1.3, -21.5), (x, WALK + 2.5, -21.5), .03, 4); p = lantern(D, x, WALK + 2.2, -21.2, .8); beam(D, 'iron', (x, WALK + 2.5, -21.5), (x, WALK + 2.5, -21.2), .02, 4)
    GLOWS.append([x, round(p[1], 2), -21.2, .9, '#ffc47a', .3])
beam(D, 'timber', (0, WALK + 5.5, -20.5), (0, WALK + 8.0, -20.5), .05, 5)
D.quad('blue', (0, WALK + 7.9, -20.5), (2.2, WALK + 7.7, -20.4), (2.0, WALK + 6.9, -20.35), (0, WALK + 7.0, -20.5)); D.quad('blue', (0, WALK + 7.9, -20.5), (0, WALK + 7.0, -20.5), (2.0, WALK + 6.9, -20.35), (2.2, WALK + 7.7, -20.4))
# Quay: bollards and chain along the edge, the crane jib with its rope and load, nets and coiled rope.
for x in range(-28, 29, 4):
    lathe(D, 'iron', x, 21.7, [(.16, QUAY), (.13, QUAY + .35), (.18, QUAY + .42), (.12, QUAY + .5)], 8)
for x in range(-28, 25, 4): rope(D, 'iron', (x, QUAY + .4, 21.7), (x + 4, QUAY + .4, 21.7), .14, .02, 5)
beam(D, 'timber', (0, QUAY + 2.4, 16.5), (0, QUAY + 6.2, 16.5), .14, 6); beam(D, 'timber', (0, QUAY + 5.9, 16.3), (0, QUAY + 7.6, 23.4), .11, 6); beam(D, 'timberDark', (0, QUAY + 3.6, 16.6), (0, QUAY + 6.6, 19.6), .07, 5)
rope(D, 'rope', (0, QUAY + 7.55, 23.2), (0, QUAY + 2.6, 23.2), 0, .025, 2); D.box('oakLight', (-.5, QUAY + 1.7, 22.7), (.5, QUAY + 2.6, 23.7))
for (x, z) in ((-12.5, 21.2), (12.5, 21.2), (-20, 16.4), (20, 16.4)):
    for k in range(4): lathe(D, 'rope', x, z, [(.36 - k * .03, QUAY + k * .06), (.36 - k * .03, QUAY + k * .06 + .06), (.2, QUAY + k * .06 + .06)], 10, cap=False)
# The Loire: water, two moored barges, the far bank with houses, the old bridge and the cathedral.
D.quad('water', (-120, QUAY - .5, 22), (120, QUAY - .5, 22), (120, QUAY - .5, 95), (-120, QUAY - .5, 95))
D.box('limestoneShade', (-30, QUAY - 1.4, 22), (30, QUAY, 22.3))
def barge(x, z, yaw, L=7.5):
    b = Mesh(); secs = []
    for k in range(9):
        t = -1 + 2 * k / 8; hw = 1.15 * (1 - abs(t) ** 3 * .7); yb = .1 + .35 * t * t; secs.append([(t * L / 2, yb, -hw * .6), (t * L / 2, yb, hw * .6), (t * L / 2, .95 + .25 * t * t, hw), (t * L / 2, .95 + .25 * t * t, -hw)])
    for a_, b_ in zip(secs, secs[1:]):
        for j in range(4): b.quad('timber' if j != 3 else 'oak', a_[(j + 1) % 4], a_[j], b_[j], b_[(j + 1) % 4])
    b.box('oak', (-L * .3, .5, -.95), (L * .3, .6, .95)); b.box('sack', (-1.6, .6, -.6), (-.4, 1.15, .6)); b.box('oakLight', (.3, .6, -.5), (1.3, 1.2, .5))
    beam(b, 'timber', (L * .12, .6, 0), (L * .12, 5.2, 0), .07, 6)
    b.quad('canvas', (L * .12, 4.9, -.02), (L * .12, 1.5, -1.6), (L * .12, 1.5, 1.6), (L * .12, 4.9, .02))
    place(D, b, x, QUAY - .75, z, yaw)
barge(-16, 24.2, .04); barge(15, 24.6, -.05); barge(-52, 46, .5, 6); barge(40, 58, -.3, 6)
D.quad('bank', (-120, QUAY - .3, 95), (120, QUAY - .3, 95), (120, 1.5, 125), (-120, 1.5, 125))
for i in range(22):
    x = -105 + i * 10 + rng.uniform(-2, 2); w = rng.uniform(5, 8); hh = rng.uniform(4, 7)
    D.box('farStone' if i % 3 else 'farShade', (x - w / 2, 0, 100), (x + w / 2, hh, 108)); gable(D, 'farRoof', 'farShade', x - w / 2, x + w / 2, 100, 108, hh, hh + rng.uniform(2.5, 4), 'x', .2, .1)
for k in range(8):   # the bridge of nine arches across the river, east of the town
    x0 = 44 + k * 9.5
    D.box('farStone', (x0, QUAY - .5, 60), (x0 + 2.2, 4.2, 64)); arch(D, 'farShade', (x0 + 5.85, 1.2, 62), 7.3, 3.0, 4, .5, 'x', 10)
D.box('farStone', (40, 4.2, 60), (125, 5.0, 64)); D.box('farShade', (40, 5.0, 60), (125, 5.5, 60.3)); D.box('farShade', (40, 5.0, 63.7), (125, 5.5, 64))
# Beyond the rampart: the cathedral's twin towers and nave, roofs of the upper town.
def far_cathedral(x, z):
    D.box('farStone', (x - 9, 0, z - 30), (x + 9, 16, z)); gable(D, 'farRoof', 'farStone', x - 9, x + 9, z - 30, z, 16, 24, 'z', .3, .2)
    for s in (-1, 1):
        D.box('farStone', (x + s * 11 - 3.5, 0, z - 1), (x + s * 11 + 3.5, 26, z + 6)); D.box('farShade', (x + s * 11 - 3.8, 26, z - 1.3), (x + s * 11 + 3.8, 27, z + 6.3))
        cone(D, 'farRoof', (x + s * 11, 27, z + 2.5), 3.6, 11, 8)
        for yy in (8, 15, 21): D.box('farShade', (x + s * 11 - 1, yy, z + 6), (x + s * 11 + 1, yy + 4, z + 6.05))
    for k in range(16):
        t0, t1 = math.tau * k / 16, math.tau * (k + 1) / 16
        D.tri('glass', (x, 12, z + .05), (x + 3 * math.cos(t0), 12 + 3 * math.sin(t0), z + .05), (x + 3 * math.cos(t1), 12 + 3 * math.sin(t1), z + .05))
far_cathedral(6, -46)
for i in range(16):
    x = -74 + i * 10 + rng.uniform(-2, 2); w = rng.uniform(6, 9); hh = rng.uniform(6, 9); z = rng.uniform(-34, -28)
    if abs(x - 6) < 16: continue
    D.box('farStone' if i % 2 else 'farShade', (x - w / 2, 0, z - 8), (x + w / 2, hh, z)); gable(D, 'farRoof', 'farShade', x - w / 2, x + w / 2, z - 8, z, hh, hh + 3.5, 'x', .2, .1)
# Town houses seen over the west and east walls, and pear trees in the spawn yards.
for sx in (-1, 1):
    for i in range(5):
        z = -18 + i * 9; hh = rng.uniform(7.5, 10)
        xa, xb = sorted((sx * 31.5, sx * 39)); D.box('plasterWarm' if i % 2 else 'plaster', (xa, 0, z - 4), (xb, hh, z + 4)); gable(D, 'slate', 'plaster', xa, xb, z - 4, z + 4, hh, hh + 3.6, 'x', .3, .12)
def tree(x, z, y=0, h=3.2, r=1.5):
    beam(D, 'trunk', (x, y, z), (x + .1, y + h, z + .05), .14, 6)
    for k in range(6):
        t = math.tau * k / 6; D.blob(('leaf', 'leafLight', 'leafDark')[k % 3], (x + r * .55 * math.cos(t), y + h + rng.uniform(-.2, .5), z + r * .55 * math.sin(t)), r * rng.uniform(.6, .8), .85)
    D.blob('leafLight', (x, y + h + .9, z), r * .75, .85)
    for k in range(5): t = rng.uniform(0, math.tau); D.blob('pear', (x + r * .7 * math.cos(t), y + h - .25, z + r * .7 * math.sin(t)), .09, 1.3)
for sx in (-1, 1):
    tree(sx * 27.6, -12.5); tree(sx * 26.4, 7.6, 0, 3.0, 1.3)
    for (x, z) in ((sx * 25.2, -6.2), (sx * 28.4, 4.6)):   # sacks and a hand barrow in the yards
        D.blob('sack', (x, .22, z), .32, .7); D.blob('sack', (x + .4, .2, z + .25), .28, .7)
c.data['presentation'].update(glows=GLOWS, pools=POOLS, embers=EMBERS, smoke=SMOKE,
    field=dict(kind='pollen', count=110, color='#fff3d2', size=.05, min=[-11, .4, -8], max=[11, 5, 5]))

if '--materials' in sys.argv or not (ROOT / 'assets/materials/limestone_basecolor.png').exists():
    synth_materials(ROOT / 'assets/materials', dict(
        limestone=dict(kind='blocks', rows=5, cols=3, joint=.04, contrast=11, vary=.5, bump=1.1),
        cobble=dict(kind='paving', rows=7, cols=7, contrast=17, bump=1.6),
        plaster=dict(kind='plaster', contrast=8, bump=.5, warm=.3),
        timber=dict(kind='wood', rows=8, cols=1, contrast=16, bump=1.0),
        oak=dict(kind='wood', rows=6, cols=4, contrast=18, bump=1.1),
        slate=dict(kind='tile', rows=7, cols=5, contrast=15, bump=1.4),
        bronze=dict(kind='metal', contrast=14, bump=.5, rough=140, metal=190, roughVary=30),
        canvas=dict(kind='cloth', contrast=7, bump=.5)), seed=1429)
bind_textures(c, ROOT, dict(limestone=(.5, .45, ['limestone', 'limestoneShade', 'limestoneLight']), cobble=(.45, .6, ['cobble', 'cobbleDark', 'cobbleWarm']),
    plaster=(.9, .3, ['plaster', 'plasterWarm', 'plasterRose']), timber=(1.2, .4, ['timber', 'timberDark']), oak=(.8, .45, ['oak', 'oakLight']),
    slate=(.9, .5, ['slate', 'slateLight', 'slateDark']), bronze=(1.3, .3, ['bronze', 'bronzeDark']), canvas=(1.6, .3, ['canvas', 'canvasShade', 'white'])))
c.save(render_object=c.renderer(KINDS))
