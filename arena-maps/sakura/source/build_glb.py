"""SAKURA shrine art: builds assets/sakura_visual.glb and assets/sakura_collision.glb from
runtime/map.json with the shared toolkit (arena-maps/_lib/glbkit.py). Pure Python 3.

VIS_<object id> nodes stay inside each object's box; everything else (roofs over the hall,
torii beams, lanterns, cherry trees, pond life, mountains) is decorative with no collision.
Run: python3 source/build_glb.py
"""
from pathlib import Path
import json, math, sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / '_lib'))
from glbkit import Mesh, write_glb  # noqa: E402

data = json.loads((ROOT / 'runtime/map.json').read_text())
objs = {o['id']: o for o in data['objects']}

# name: (sRGB hex, metallic, roughness, emissive, alpha)
MATS = {
    'floor': ('#d9c9ad', .02, .9, 0, 1), 'gravel': ('#cbbfa9', .02, .95, 0, 1), 'path': ('#bdb3a3', .03, .85, 0, 1),
    'stone': ('#b9b2a6', .04, .85, 0, 1), 'stone_dark': ('#8e877e', .04, .9, 0, 1), 'moss': ('#7fae6a', 0, .9, 0, 1),
    'wood': ('#a8573f', .05, .7, 0, 1), 'woodDark': ('#5a2f2a', .05, .7, 0, 1), 'plaster': ('#f3ead9', .02, .85, 0, 1),
    'roof': ('#3f4a63', .3, .5, 0, 1), 'roof_edge': ('#2a3247', .3, .5, 0, 1), 'red': ('#d4483a', .05, .55, 0, 1),
    'gold': ('#f0c46a', .6, .35, 0, 1), 'paper': ('#fff1d6', 0, .8, 1.8, 1), 'paper_red': ('#ff8a6a', 0, .8, 1.6, 1),
    'water': ('#4f9fc2', .3, .15, .12, .82), 'water_hi': ('#9fd8ec', .2, .2, .25, .7), 'lily': ('#6fae5e', 0, .8, 0, 1),
    'koi': ('#ff8a3d', 0, .5, .2, 1), 'koi_white': ('#fff5ea', 0, .5, .2, 1), 'blossom': ('#ffb7cf', 0, .85, .18, 1),
    'blossom2': ('#ff9fbf', 0, .85, .18, 1), 'trunk': ('#5b3b35', 0, .9, 0, 1), 'rope': ('#e8d8a8', 0, .9, 0, 1),
    'shide': ('#ffffff', 0, .9, .3, 1), 'cyan': ('#5fd0d8', .2, .4, 0, 1), 'amber': ('#f2b25c', .2, .4, 0, 1),
    'light_cyan': ('#9cf1f2', .1, .3, 1.6, 1), 'light_amber': ('#ffc27a', .1, .3, 1.6, 1),
    'mountain': ('#7c6a9a', 0, 1, .15, 1), 'mountain2': ('#a385a8', 0, 1, .2, 1), 'pagoda': ('#4a3a5a', 0, .9, 0, 1),
}

seed = 11
def rnd():
    global seed
    seed = (seed * 1103515245 + 12345) % 2 ** 31
    return seed / 2 ** 31


def hip_roof(m, x0, x1, z0, z1, y0, y1, mat='roof', inset=.0):
    """Four-sided roof from an eave rectangle at y0 up to a ridge line at y1."""
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    rx = max((x1 - x0) / 2 - (z1 - z0) / 2, 0)
    ra, rb = (cx - rx, y1, cz), (cx + rx, y1, cz)
    m.quad(mat, (x0, y0, z1), (x1, y0, z1), rb, ra)
    m.quad(mat, (x1, y0, z0), (x0, y0, z0), ra, rb)
    m.tri(mat, (x1, y0, z1), (x1, y0, z0), rb)
    m.tri(mat, (x0, y0, z0), (x0, y0, z1), ra)
    return ra, rb


def lantern(m, x, z, h=1.6, light='paper'):
    """Stone toro: base, post, firebox (lit), cap."""
    m.box('stone_dark', (x - .5, 0, z - .5), (x + .5, .2, z + .5))
    m.box('stone', (x - .18, .2, z - .18), (x + .18, h * .55, z + .18))
    m.box(light, (x - .3, h * .55, z - .3), (x + .3, h * .8, z + .3))
    hip_roof(m, x - .55, x + .55, z - .55, z + .55, h * .8, h + .05, 'stone')
    m.blob('stone', (x, h + .08, z), .1)


def sakura_tree(m, x, z, s=1.0):
    m.prism('trunk', (x, 0, z), .28 * s, 3.2 * s, n=7, y0=-.2)
    m.prism('trunk', (x + .6 * s, 0, z), .14 * s, 1.6 * s, n=6, y0=2.4 * s)
    for i in range(7):
        a = rnd() * 6.28; r = rnd() * 1.6 * s
        m.blob('blossom' if i % 3 else 'blossom2', (x + math.cos(a) * r, (3.6 + rnd() * 1.4) * s, z + math.sin(a) * r), (1.2 + rnd() * .7) * s, squash=.7)


# ---------------------------------------------------------------- base objects (VIS_*)
nodes = []
ramps = {}
for o in data['objects']:
    m = Mesh()
    x, y, z = o['position']; w, h, d = o['size']
    lo = (x - w / 2, y - h / 2, z - d / 2); hi = (x + w / 2, y + h / 2, z + d / 2)
    mat = o['material'] if o['material'] in MATS else 'stone'
    if o['type'] == 'ramp':
        from glbkit import Mesh as _M  # noqa: F401
        ramps[o['id']] = (o, m.wedge('wood' if o['id'].startswith('bridge') else 'stone', o))
    elif o['id'] == 'floor_precinct':
        m.box('gravel', lo, hi)
    elif o['id'].startswith('wall_'):
        m.box('plaster', lo, (hi[0], 3.2, hi[2]), skip_bottom=True)
        m.box('woodDark', (lo[0], 0, lo[2]), (hi[0], .5, hi[2]))
    elif o['id'] == 'hall_roof':
        m.box('roof_edge', lo, hi)
    elif o['id'] == 'pond':
        m.box('water', lo, hi, skip_bottom=True)
    elif o['material'] == 'stone' and o['role'] == 'cover' and ('rock' in o['id']):
        m.box('stone_dark', lo, (hi[0], lo[1] + .3, hi[2]))
        m.box('stone', (lo[0], lo[1] + .3, lo[2]), hi)
    elif o['material'] == 'plaster':
        m.box('plaster', lo, hi)
    else:
        m.box(mat, lo, hi, skip_bottom=o['role'] == 'wayfinding')
    nodes.append(('VIS_' + o['id'], m, dict(source_id=o['id'], role=o['role'], collision=o['collision'], decorative=False)))

D = Mesh()
X, Z = data['bounds']['max'][0], data['bounds']['max'][2]

# ground: stone path of the sando, paved courtyard band, stepping stones, moss
for i in range(-23, 24):
    D.box('path', (i - .46, 0, -18.9), (i + .46, .02, -15.1), skip_bottom=True)
for i in range(-20, 21, 2):
    for k in range(-9, 10, 2):
        if abs(i) < 9 and abs(k) < 6:
            continue  # inside the hall
        D.box('path', (i - .9, 0, k - .9), (i + .9, .012, k + .9), skip_bottom=True)
for x, z in [(-13, 13.5), (-11.5, 14.8), (-10.5, 18.8), (10.5, 18.8), (11.5, 14.8), (13, 13.5), (-6.5, 14.2), (6.5, 14.2)]:
    D.prism('stone', (x, 0, z), .45, .05, n=8, y0=.01)
for i in range(30):
    x = (rnd() - .5) * 60; z = 12 + rnd() * 9 if i % 2 else -21 + rnd() * 2
    D.prism('moss', (x, 0, z), .4 + rnd() * .5, .02, n=7, y0=.005)

# outer wall: dark tile coping with a little hip roof, wooden posts; cherry trees beyond, lanterns on top
for wid in ('wall_west', 'wall_east', 'wall_north', 'wall_south'):
    o = objs[wid]; x, y, z = o['position']; w, h, d = o['size']
    x0, x1, z0, z1 = x - w / 2, x + w / 2, z - d / 2, z + d / 2
    hip_roof(D, x0 - .5, x1 + .5, z0 - .5, z1 + .5, 3.2, 3.75, 'roof')
    along_x = w > d
    L = w if along_x else d
    for i in range(int(L // 3) + 1):
        t = -L / 2 + i * 3
        cx, cz = (x + t, z) if along_x else (x, z + t)
        D.box('woodDark', (cx - .16, 0, cz - .16), (cx + .16, 3.2, cz + .16))
for i in range(22):
    a = i / 22 * 6.283
    sakura_tree(D, math.cos(a) * (X + 5 + rnd() * 4), math.sin(a) * (Z + 5 + rnd() * 4), 1.1 + rnd() * .5)

# torii: red pillars (collision) carry the nuki and the black-topped kasagi, gold plaque
torii_x = sorted({o['position'][0] for o in data['objects'] if o['id'].startswith('torii_')})
for x in torii_x:
    D.box('red', (x - .22, 3.1, -20.4), (x + .22, 3.45, -13.6))
    D.box('red', (x - .3, 3.95, -21), (x + .3, 4.3, -13))
    D.box('roof_edge', (x - .38, 4.3, -21.4), (x + .38, 4.55, -12.6))
    D.box('gold', (x - .06, 3.45, -17.5), (x + .06, 3.95, -16.5))
    for z in (-19.6, -14.4):
        D.box('woodDark', (x - .45, 0, z - .45), (x + .45, .25, z + .45))

# stone lanterns: the collision boxes get a proper toro on top of a hidden core
for o in data['objects']:
    if 'lantern' in o['id'] and o['type'] == 'box':
        x, y, z = o['position']; w, h, d = o['size']
        lantern(D, x, z, h + .05)

# haiden hall: wooden frame on the plaster, big hip roof with gold ridge, hanging paper lanterns
hall = objs['hall_roof']; hx, hy, hz = hall['position']; hw, hh, hd = hall['size']
x0, x1, z0, z1 = hx - hw / 2 - 1.2, hx + hw / 2 + 1.2, hz - hd / 2 - 1.2, hz + hd / 2 + 1.2
ra, rb = hip_roof(D, x0, x1, z0, z1, hy + hh / 2, 7.2, 'roof')
D.box('gold', (ra[0], 7.15, ra[2] - .12), (rb[0], 7.4, rb[2] + .12))
for p in (ra, rb):
    D.blob('gold', (p[0], 7.55, p[2]), .3)
D.box('roof_edge', (x0, hy + hh / 2 - .15, z0), (x1, hy + hh / 2, z1))
for o in data['objects']:
    if o['id'].startswith('hall_wall'):
        x, y, z = o['position']; w, h, d = o['size']
        lo, hi = (x - w / 2 - .04, 0, z - d / 2 - .04), (x + w / 2 + .04, h, z + d / 2 + .04)
        D.box('woodDark', (lo[0], h - .4, lo[2]), (hi[0], h - .2, hi[2]))
        D.box('woodDark', (lo[0], .9, lo[2]), (hi[0], 1.05, hi[2]))
        D.box('woodDark', (lo[0], 0, lo[2]), (hi[0], .3, hi[2]))
for x in (-8.2, -2, 2, 8.2):
    for z in (-5.2, 5.2):
        D.box('red', (x - .22, 0, z - .22), (x + .22, 3.4, z + .22))
for x in (-6, -3.5, 3.5, 6):
    for z in (-6.2, 6.2):
        D.prism('rope', (x, 0, z), .02, .5, n=4, y0=2.85)
        D.blob('paper_red' if x < 0 else 'paper', (x, 2.6, z), .32, squash=1.3)
for z in (-1.9, 1.9):
    for x in (-9.0, 9.0):
        D.prism('rope', (x, 0, z), .02, .5, n=4, y0=2.85)
        D.blob('paper', (x, 2.6, z), .3, squash=1.3)
# shimenawa rope over the north/south doors with paper shide
for z in (-5.35, 5.35):
    for i in range(12):
        t0, t1 = -2 + i / 3, -2 + (i + 1) / 3
        sag = lambda t: 3.05 - .25 * (1 - (t / 2) ** 2)  # noqa: E731
        D.box('rope', (t0, sag(t0) - .07, z - .07), (t1, sag(t0) + .07, z + .07))
    for t in (-1.2, 0, 1.2):
        D.quad('shide', (t - .08, 2.75, z), (t + .08, 2.75, z), (t + .08, 2.35, z), (t - .08, 2.35, z))
# honden: small roof, gold mirror, offering steps
hd_ = objs['honden']; x, y, z = hd_['position']; w, h, d = hd_['size']
hip_roof(D, x - w / 2 - .4, x + w / 2 + .4, z - d / 2 - .4, z + d / 2 + .4, y + h / 2, y + h / 2 + 1.0, 'roof')
D.prism('gold', (x, 0, z - d / 2 - .02), .35, .04, n=16, y0=1.2)

# stages: red rails along the open sides, drum stand, paper streamers
for side in (-1, 1):
    st = objs['stage_' + ('a' if side < 0 else 'b')]; x, y, z = st['position']; w, h, d = st['size']
    top = y + h / 2
    D.box('red', (x - w / 2 - .05, top - .12, z - d / 2 - .05), (x + w / 2 + .05, top, z + d / 2 + .05))
    for zz in (z - d / 2, z + d / 2):
        for i in range(5):
            xx = x - w / 2 + .3 + i * (w - .6) / 4
            D.box('red', (xx - .07, top, zz - .07), (xx + .07, top + 1.1, zz + .07))
    D.box('rope', (x - w / 2, top + 1.25, z - d / 2 - .03), (x + w / 2, top + 1.32, z - d / 2 + .03))
    D.box('rope', (x - w / 2, top + 1.25, z + d / 2 - .03), (x + w / 2, top + 1.32, z + d / 2 + .03))
    team, light = ('cyan', 'light_cyan') if side < 0 else ('amber', 'light_amber')
    D.quad(team, (x - 1.2, top + 2.6, z - d / 2 - .1), (x + 1.2, top + 2.6, z - d / 2 - .1), (x + 1.2, top + 1.4, z - d / 2 - .1), (x - 1.2, top + 1.4, z - d / 2 - .1))
    sx = side * (X - .3)
    D.box(team, (sx - .05, 1.2, -2.4), (sx + .05, 4.6, 2.4))
    D.box(light, (sx - .07, 3.4, -.4), (sx + .07, 3.9, .4))
    scr = objs['spawn_screen_' + ('a' if side < 0 else 'b')]; px, py, pz = scr['position']; pw, ph, pd = scr['size']
    hip_roof(D, px - .5, px + .5, pz - pd / 2 - .3, pz + pd / 2 + .3, ph, ph + .5, 'roof')
    D.box(light, (px - pw / 2 - .03, 2.6, pz - pd / 2), (px + pw / 2 + .03, 2.75, pz + pd / 2))

# ramps: wooden treads on the stage stairs and the bridge, red bridge rails
for rid, (o, top) in ramps.items():
    x, y, z = o['position']; w, h, d = o['size']
    n = int(w * 2.5)
    for i in range(n):
        c0 = x - w / 2 + (i + .1) * w / n; c1 = c0 + .55 * w / n
        D.quad('woodDark', (c0, top(c0, z) + .012, z + d / 2 - .1), (c1, top(c1, z) + .012, z + d / 2 - .1),
               (c1, top(c1, z) + .012, z - d / 2 + .1), (c0, top(c0, z) + .012, z - d / 2 + .1))
    if o['id'].startswith('bridge'):
        for zz in (z - d / 2, z + d / 2):
            for i in range(6):
                xx = x - w / 2 + .2 + i * (w - .4) / 5
                D.box('red', (xx - .06, top(xx, z), zz - .06), (xx + .06, top(xx, z) + 1.0, zz + .06))
            xa, xb = x - w / 2, x + w / 2
            D.quad('red', (xa, top(xa, z) + 1.0, zz), (xb, top(xb, z) + 1.0, zz), (xb, top(xb, z) + .9, zz), (xa, top(xa, z) + .9, zz))
br = objs['bridge_top']; x, y, z = br['position']
for zz in (z - 1.2, z + 1.2):
    D.box('red', (x - 1, 2.1, zz - .06), (x + 1, 2.2, zz + .06))
    for xx in (-.9, .9):
        D.box('red', (x + xx - .07, 1.2, zz - .07), (x + xx + .07, 2.2, zz + .07))

# pond: ripples, lily pads, koi, stone bank
pd_ = objs['pond']; x, y, z = pd_['position']; w, h, d = pd_['size']
for i in range(10):
    cx, cz, r = x + (rnd() - .5) * w * .8, z + (rnd() - .5) * d * .7, .4 + rnd() * .8
    for k in range(16):
        a0, a1 = k / 16 * 6.283, (k + 1) / 16 * 6.283
        D.quad('water_hi', (cx + r * math.cos(a0), .03, cz + r * math.sin(a0)), (cx + r * math.cos(a1), .03, cz + r * math.sin(a1)),
               (cx + (r + .05) * math.cos(a1), .03, cz + (r + .05) * math.sin(a1)), (cx + (r + .05) * math.cos(a0), .03, cz + (r + .05) * math.sin(a0)))
for i in range(16):
    D.prism('lily', (x + (rnd() - .5) * w * .9, 0, z + (rnd() - .5) * d * .8), .25 + rnd() * .2, .02, n=7, y0=.025)
for i in range(9):
    kx, kz = x + (rnd() - .5) * w * .8, z + (rnd() - .5) * d * .6
    D.blob('koi' if i % 3 else 'koi_white', (kx, .0, kz), .18, squash=.35)
    D.blob('koi', (kx + .22, .0, kz), .1, squash=.35)
for i in range(40):
    t = i / 40
    for zz in (z - d / 2, z + d / 2):
        D.blob('stone', (x - w / 2 + t * w, .05, zz + (rnd() - .5) * .3), .28 + rnd() * .15, squash=.5)
# moss on rocks
for o in data['objects']:
    if 'rock' in o['id']:
        x, y, z = o['position']; w, h, d = o['size']
        D.blob('moss', (x, y + h / 2, z), min(w, d) * .45, squash=.25)

# spawn lanterns, courtyard planters: shrubs and flowers
for o in data['objects']:
    if o['id'].startswith('court_planter'):
        x, y, z = o['position']; w, h, d = o['size']
        for i in range(3):
            D.blob('moss', (x - w / 3 + i * w / 3, y + h / 2 + .1, z), .45, squash=.6)
            D.blob('blossom', (x - w / 3 + i * w / 3 + .1, y + h / 2 + .35, z + .1), .14)

# lane walls: tile coping and hanging lantern strings toward the hall
for o in data['objects']:
    if o['id'].startswith('lane_wall'):
        x, y, z = o['position']; w, h, d = o['size']
        hip_roof(D, x - w / 2 - .3, x + w / 2 + .3, z - d / 2 - .4, z + d / 2 + .4, h, h + .45, 'roof')
        for i in range(5):
            xx = x - w / 2 + 1 + i * (w - 2) / 4
            D.prism('rope', (xx, 0, z), .02, .4, n=4, y0=h + .1)
            D.blob('paper', (xx, h - .15, z + (.5 if z > 0 else -.5)), .22, squash=1.3)

# far scenery: layered mountains and a pagoda silhouette (the sky shader draws the clouds)
for i in range(26):
    a = i / 26 * 6.283 + rnd() * .2
    r = 110 + rnd() * 50
    hgt = 25 + rnd() * 35
    cx, cz = math.cos(a) * r, math.sin(a) * r
    w_ = 28 + rnd() * 20
    tx, tz = -math.sin(a) * w_, math.cos(a) * w_
    D.tri('mountain' if i % 2 else 'mountain2', (cx - tx, -6, cz - tz), (cx + tx, -6, cz + tz), (cx, hgt, cz))
    D.tri('mountain' if i % 2 else 'mountain2', (cx + tx, -6, cz + tz), (cx - tx, -6, cz - tz), (cx, hgt, cz))
px, pz = -70, -55
for lvl in range(5):
    y0 = lvl * 5.5
    D.box('pagoda', (px - 3 + lvl * .4, y0, pz - 3 + lvl * .4), (px + 3 - lvl * .4, y0 + 4, pz + 3 - lvl * .4))
    hip_roof(D, px - 5.2 + lvl * .5, px + 5.2 - lvl * .5, pz - 5.2 + lvl * .5, pz + 5.2 - lvl * .5, y0 + 4, y0 + 5.5, 'roof_edge')
D.prism('gold', (px, 0, pz), .25, 6, n=6, y0=27.5)

nodes.append(('DETAIL_batch', D, dict(decorative=True, collision=False, role='detail_batch')))

used = [n for n in MATS if any(n in mesh.prims for _, mesh, _ in nodes)]
vis = write_glb(ROOT / 'assets/sakura_visual.glb', nodes, used, MATS)
col_nodes = []
for o in data['objects']:
    if not o['collision']:
        continue
    m = Mesh()
    if o['type'] == 'ramp':
        m.wedge('stone', o)
    else:
        m.cbox('stone', o['position'], o['size'])
    col_nodes.append(('COL_' + o['id'], m, dict(source_id=o['id'], role=o['role'], collision=True, decorative=False)))
col = write_glb(ROOT / 'assets/sakura_collision.glb', col_nodes, ['stone'], MATS)
print(json.dumps(dict(visual=vis, collision=col)))
