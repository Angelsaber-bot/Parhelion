"""NEON harbour art: builds assets/neon_visual.glb and assets/neon_collision.glb from runtime/map.json
with the shared toolkit (arena-maps/_lib/glbkit.py). Pure Python 3.

Night scene: emissive neon (signs, container stripes, mast lights, the city skyline) carries the
look under the client's night atmosphere and bloom. Decorative pieces have no collision.
Run: python3 source/build_glb.py
"""
from pathlib import Path
import json, math, sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / '_lib'))
from glbkit import Mesh, write_glb  # noqa: E402

data = json.loads((ROOT / 'runtime/map.json').read_text())
objs = {o['id']: o for o in data['objects']}

MATS = {
    'asphalt': ('#2b2f3e', .1, .75, 0, 1), 'asphalt_wet': ('#1b2033', .5, .12, .05, 1), 'paint': ('#f2c94c', .05, .6, .25, 1),
    'steel': ('#5d6680', .7, .35, 0, 1), 'steel_dark': ('#30364a', .7, .4, 0, 1), 'grate': ('#454c63', .7, .4, 0, 1),
    'red': ('#c9434c', .3, .5, 0, 1), 'blue': ('#3a6fc4', .3, .5, 0, 1), 'teal': ('#2a9d93', .3, .5, 0, 1),
    'orange': ('#d97a33', .3, .5, 0, 1), 'yellow': ('#e6bb3f', .3, .5, 0, 1), 'white': ('#d9dfea', .3, .5, 0, 1),
    'hazard': ('#f2c94c', .2, .5, .2, 1), 'black': ('#14161f', .2, .6, 0, 1),
    'neon_pink': ('#ff4fb3', 0, .3, 2.6, 1), 'neon_cyan': ('#3ff2ff', 0, .3, 2.6, 1), 'neon_violet': ('#9b6bff', 0, .3, 2.4, 1),
    'neon_amber': ('#ffb347', 0, .3, 2.4, 1), 'lamp': ('#fff1d0', 0, .3, 3.0, 1),
    'cyan': ('#5fd0d8', .2, .4, .3, 1), 'amber': ('#f2b25c', .2, .4, .3, 1),
    'fence': ('#7c86a8', .6, .4, .08, .35), 'water': ('#0f2448', .4, .1, .08, 1), 'water_glint': ('#3ff2ff', 0, .2, 1.4, 1),
    'city': ('#1a1f3a', .2, .7, 0, 1), 'window': ('#ffd78a', 0, .5, 1.8, 1), 'window2': ('#7fd8ff', 0, .5, 1.8, 1),
    'moon': ('#f4f1ff', 0, 1, 1.6, 1), 'wood': ('#8a5a3c', .05, .8, 0, 1),
}

seed = 23
def rnd():
    global seed
    seed = (seed * 1103515245 + 12345) % 2 ** 31
    return seed / 2 ** 31


nodes = []
ramps = {}
for o in data['objects']:
    m = Mesh()
    x, y, z = o['position']; w, h, d = o['size']
    lo = (x - w / 2, y - h / 2, z - d / 2); hi = (x + w / 2, y + h / 2, z + d / 2)
    mat = o['material'] if o['material'] in MATS else 'steel'
    if o['type'] == 'ramp':
        ramps[o['id']] = (o, m.wedge('steel_dark', o))
    elif o['id'].startswith('wall_'):
        m.box('steel_dark', lo, (hi[0], .6, hi[2]))  # concrete kerb; the fence above is a glass-like batch
    elif o['id'] == 'floor_quay':
        m.box('asphalt', lo, hi)
    elif o['id'].startswith('crate'):
        m.box('wood', lo, hi)
    else:
        m.box(mat, lo, hi, skip_bottom=o['role'] == 'wayfinding')
    nodes.append(('VIS_' + o['id'], m, dict(source_id=o['id'], role=o['role'], collision=o['collision'], decorative=False)))

D = Mesh()
F = Mesh()  # fence mesh, kept apart (translucent, no shadows)
X = data['bounds']['max'][0]

# ground: wet patches that catch the neon, painted bay lines and arrows
for i in range(26):
    cx, cz = (rnd() - .5) * 50, (rnd() - .5) * 50
    D.prism('asphalt_wet', (cx, 0, cz), 1 + rnd() * 2.2, .006, n=9, y0=.002)
for k in range(-4, 5):
    D.box('paint', (-27, 0, k * 6 - .06), (27, .01, k * 6 + .06), skip_bottom=True)
for i in range(-26, 27, 4):
    D.box('paint', (i - .8, 0, -.06 + 12), (i + .8, .012, .06 + 12), skip_bottom=True)
    D.box('paint', (i - .8, 0, -.06 - 12), (i + .8, .012, .06 - 12), skip_bottom=True)

# containers: corrugation ribs, a dark frame, door bars on one end, a glowing team-neutral stripe
for o in data['objects']:
    if o['role'] != 'cover' or o['material'] not in ('red', 'blue', 'teal', 'orange', 'yellow', 'white'):
        continue
    x, y, z = o['position']; w, h, d = o['size']
    x0, x1, y0, y1, z0, z1 = x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2
    along_x = w > d
    mat = o['material']
    for e in (.0, 1.0):  # frame
        D.box('steel_dark', (x0 - .03, y0 + e * (h - .12), z0 - .03), (x1 + .03, y0 + e * (h - .12) + .12, z1 + .03))
    L = w if along_x else d
    for i in range(int(L / .5)):
        t = -L / 2 + .25 + i * .5
        if along_x:
            for zz in (z0 - .05, z1):
                D.box(mat, (x + t - .06, y0 + .12, zz), (x + t + .06, y1 - .12, zz + .05))
        else:
            for xx in (x0 - .05, x1):
                D.box(mat, (xx, y0 + .12, z + t - .06), (xx + .05, y1 - .12, z + t + .06))
    if along_x:
        for k in range(4):
            zz = z0 + .4 + k * (d - .8) / 3
            D.box('steel', (x1, y0 + .2, zz - .03), (x1 + .06, y1 - .2, zz + .03))
        D.box('neon_cyan' if rnd() < .5 else 'neon_pink', (x0 + .3, y1 - .45, z1 + .04), (x1 - .3, y1 - .38, z1 + .07))
    else:
        for k in range(4):
            xx = x0 + .4 + k * (w - .8) / 3
            D.box('steel', (xx - .03, y0 + .2, z1), (xx + .03, y1 - .2, z1 + .06))
        D.box('neon_cyan' if rnd() < .5 else 'neon_pink', (x1 + .04, y1 - .45, z0 + .3), (x1 + .07, y1 - .38, z1 - .3))

# stairs: treads with hazard nosing, side rails
for rid, (o, top) in ramps.items():
    x, y, z = o['position']; w, h, d = o['size']
    n = int(w * 2.5)
    for i in range(n):
        c0 = x - w / 2 + (i + .05) * w / n; c1 = c0 + .3 * w / n
        D.quad('hazard' if i % 2 else 'black', (c0, top(c0, z) + .015, z + d / 2 - .05), (c1, top(c1, z) + .015, z + d / 2 - .05),
               (c1, top(c1, z) + .015, z - d / 2 + .05), (c0, top(c0, z) + .015, z - d / 2 + .05))
    for zz in (z - d / 2 - .05, z + d / 2 + .05):
        for i in range(4):
            xx = x - w / 2 + .2 + i * (w - .4) / 3
            D.box('yellow', (xx - .04, top(xx, z), zz - .04), (xx + .04, top(xx, z) + 1.0, zz + .04))
        xa, xb = x - w / 2, x + w / 2
        D.quad('yellow', (xa, top(xa, z) + 1.0, zz), (xb, top(xb, z) + 1.0, zz), (xb, top(xb, z) + .92, zz), (xa, top(xa, z) + .92, zz))

# gantry: grated deck with rails, the legs rise into a crane frame with a cabin and neon sign
deck = objs['gantry_deck']; x, y, z = deck['position']; w, h, d = deck['size']
top = y + h / 2
for i in range(int(w / .5)):
    xx = x - w / 2 + .25 + i * .5
    D.box('grate', (xx - .02, top, z - d / 2), (xx + .02, top + .01, z + d / 2))
for zz in (z - d / 2, z + d / 2):
    for i in range(9):
        xx = x - w / 2 + .3 + i * (w - .6) / 8
        if abs(xx) > 3.6 and zz < 0 and xx < 0:
            continue  # keep the catwalk landings open
        if abs(xx) > 3.6 and zz > 0 and xx > 0:
            continue
        D.box('yellow', (xx - .04, top, zz - .04), (xx + .04, top + 1.0, zz + .04))
    D.box('yellow', (x - w / 2, top + .95, zz - .04), (x - w / 2 + 6, top + 1.02, zz + .04)) if zz > 0 else D.box('yellow', (x + w / 2 - 6, top + .95, zz - .04), (x + w / 2, top + 1.02, zz + .04))
for sx in (-1, 1):
    for sz in (-1, 1):
        lx, lz = sx * 5.3, sz * 3.3
        D.box('yellow', (lx - .25, 5, lz - .25), (lx + .25, 15, lz + .25))
D.box('yellow', (-5.8, 15, -3.8), (5.8, 15.8, -2.8)); D.box('yellow', (-5.8, 15, 2.8), (5.8, 15.8, 3.8))
D.box('yellow', (-30, 16.2, -.6), (30, 17.2, .6))          # the boom, out over the quay
D.box('steel_dark', (-2, 13.2, -1.6), (2, 15, 1.6))         # cabin
D.box('window2', (-1.8, 13.8, -1.65), (1.8, 14.6, -1.6))
D.box('neon_pink', (-4.6, 11.6, -3.86), (4.6, 12.6, -3.8))
D.box('neon_cyan', (-4.6, 11.6, 3.8), (4.6, 12.6, 3.86))
for i in range(12):  # sign "lettering" blocks
    xx = -4.2 + i * .75
    D.box('black', (xx, 11.75, -3.9), (xx + .45, 12.45, -3.87))
    D.box('black', (xx, 11.75, 3.87), (xx + .45, 12.45, 3.9))
for cw in ('catwalk_a', 'catwalk_b'):
    o = objs[cw]; x, y, z = o['position']; w, h, d = o['size']
    for xx in (x - w / 2, x + w / 2):
        D.box('yellow', (xx - .04, y + h / 2, z - d / 2), (xx + .04, y + h / 2 + 1.0, z + d / 2))

# fence: posts, a translucent chain-link panel, razor-wire coil; mast lights in the corners
for wid in ('wall_west', 'wall_east', 'wall_north', 'wall_south'):
    o = objs[wid]; x, y, z = o['position']; w, h, d = o['size']
    lo, hi = (x - w / 2, z - d / 2), (x + w / 2, z + d / 2)
    F.box('fence', (lo[0] + .1, .6, lo[1] + .1), (hi[0] - .1, 6.8, hi[1] - .1))
    along_x = w > d
    L = w if along_x else d
    for i in range(int(L // 3) + 1):
        t = -L / 2 + i * 3
        cx, cz = (x + t, z) if along_x else (x, z + t)
        D.box('steel', (cx - .06, .6, cz - .06), (cx + .06, 7.2, cz + .06))
    D.box('steel', (lo[0] - .02, 6.8, lo[1] - .02), (hi[0] + .02, 6.9, hi[1] + .02))
for sx in (-1, 1):
    for sz in (-1, 1):
        mx, mz = sx * (X + 3), sz * (X + 3)
        D.prism('steel_dark', (mx, 0, mz), .25, 18, n=8, y0=-1)
        D.box('lamp', (mx - 1.2, 17, mz - .4), (mx + 1.2, 17.6, mz + .4))

# neon signs on the fence and the tall stacks; spawn team lights
for i, (p, mat, w_, h_) in enumerate([((-27.6, 4.5, -10), 'neon_pink', 4, 1.2), ((27.6, 4.5, 10), 'neon_cyan', 4, 1.2),
                                       ((-8, 4.2, -27.6), 'neon_violet', 6, 1.0), ((8, 4.2, 27.6), 'neon_amber', 6, 1.0)]):
    x, y, z = p
    if abs(x) > abs(z):
        D.box(mat, (x - .05, y - h_ / 2, z - w_ / 2), (x + .05, y + h_ / 2, z + w_ / 2))
        D.box('black', (x - .08, y - h_ / 2 + .15, z - w_ / 2 + .2), (x + .08, y + h_ / 2 - .15, z - w_ / 2 + .5))
    else:
        D.box(mat, (x - w_ / 2, y - h_ / 2, z - .05), (x + w_ / 2, y + h_ / 2, z + .05))
for sfx_, light in (('_a', 'cyan'), ('_b', 'amber')):
    for wall in ('spawn_wall_e', 'spawn_wall_n'):
        o = objs[wall + sfx_]; x, y, z = o['position']; w, h, d = o['size']
        D.box(light, (x - w / 2 - .02, y + h / 2, z - d / 2 - .02), (x + w / 2 + .02, y + h / 2 + .12, z + d / 2 + .02))

# beyond the fence: dark water with neon glints, a skyline with lit windows, quay cranes, the moon
D.box('water', (-150, -1.2, -150), (150, -1.1, 150))
D.box('asphalt', (-X - 6, -1.1, -X - 6), (X + 6, -.05, X + 6))
for i in range(60):
    a = rnd() * 6.283; r = 40 + rnd() * 80
    cx, cz = math.cos(a) * r, math.sin(a) * r
    D.box('water_glint', (cx - 1.5 - rnd() * 3, -1.08, cz - .05), (cx + 1.5, -1.07, cz + .05))
for i in range(40):
    a = i / 40 * 6.283 + rnd() * .1
    r = 120 + rnd() * 40
    cx, cz = math.cos(a) * r, math.sin(a) * r
    bw, bh = 8 + rnd() * 10, 15 + rnd() * 55
    D.box('city', (cx - bw / 2, -1, cz - bw / 2), (cx + bw / 2, bh, cz + bw / 2))
    for k in range(int(bh / 4)):
        if rnd() < .55:
            yy = 2 + k * 4
            nx, nz = -math.cos(a), -math.sin(a)
            fx, fz = cx + nx * (bw / 2 + .05), cz + nz * (bw / 2 + .05)
            tx, tz = -nz, nx
            off = (rnd() - .5) * bw * .6
            D.box('window' if rnd() < .6 else 'window2', (fx + tx * off - .9 - abs(nx) * .05, yy, fz + tz * off - .9 - abs(nz) * .05),
                  (fx + tx * off + .9 + abs(nx) * .05, yy + 1.4, fz + tz * off + .9 + abs(nz) * .05))
for k, (cx, cz) in enumerate([(-60, -40), (55, 48), (-48, 62)]):
    for lx in (-3, 3):
        D.box('steel_dark', (cx + lx - .5, -1, cz - .5), (cx + lx + .5, 30, cz + .5))
    D.box('neon_amber' if k % 2 else 'red', (cx - 18, 30, cz - .8), (cx + 18, 32, cz + .8))
D.blob('moon', (60, 70, -110), 9)

nodes.append(('DETAIL_batch', D, dict(decorative=True, collision=False, role='detail_batch')))
nodes.append(('DETAIL_fence', F, dict(decorative=True, collision=False, role='detail_batch')))

used = [n for n in MATS if any(n in mesh.prims for _, mesh, _ in nodes)]
vis = write_glb(ROOT / 'assets/neon_visual.glb', nodes, used, MATS)
col_nodes = []
for o in data['objects']:
    if not o['collision']:
        continue
    m = Mesh()
    if o['type'] == 'ramp':
        m.wedge('steel', o)
    else:
        m.cbox('steel', o['position'], o['size'])
    col_nodes.append(('COL_' + o['id'], m, dict(source_id=o['id'], role=o['role'], collision=True, decorative=False)))
col = write_glb(ROOT / 'assets/neon_collision.glb', col_nodes, ['steel'], MATS)
print(json.dumps(dict(visual=vis, collision=col)))
