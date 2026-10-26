"""ZENITH sky terrace art: builds assets/zenith_visual.glb and assets/zenith_collision.glb from
runtime/map.json. Pure Python 3 (no Blender, no packages), deterministic output.

Visual GLB layout matches the ASTER export the game already reads:
  VIS_<object id>   one node per map object, extras {source_id, role, collision, decorative: false}
  DETAIL_<material> decorative batches, extras {decorative: true, collision: false, role: 'detail_batch'}
Materials are factor-only PBR (no textures); arena-game swaps them for its cel shader at load.
Decorative pieces never add collision; the game collides only against map.json.

Run: python3 source/build_glb.py
"""
from pathlib import Path
import json, math, struct

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'runtime/map.json').read_text())


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x < .04045 else ((x + .055) / 1.055) ** 2.4 for x in c]


# name: (sRGB hex, metallic, roughness, emissive strength, alpha)
MATS = {
    'floor': ('#e3d8c4', .05, .8, 0, 1), 'tile': ('#d0c2aa', .05, .78, 0, 1), 'wall': ('#b58b72', .1, .7, 0, 1),
    'dark': ('#4a4872', .3, .45, 0, 1), 'cover': ('#f1e9da', .1, .55, 0, 1), 'stone': ('#cdbfa8', .04, .85, 0, 1),
    'hedge': ('#79c48a', 0, .9, 0, 1), 'leaf': ('#a5dc8c', 0, .9, 0, 1), 'cyan': ('#5fd0d8', .2, .4, 0, 1),
    'amber': ('#f2b25c', .2, .4, 0, 1), 'white': ('#f8f4ec', .1, .5, 0, 1), 'gold': ('#f3cd6b', .6, .35, 0, 1),
    'coral': ('#ee8c7a', .05, .6, 0, 1), 'seam': ('#8f7c6c', .1, .8, 0, 1), 'sail': ('#fff1e4', 0, .7, .45, 1),
    'glass': ('#bfe6fa', .1, .1, 0, .2), 'cloud': ('#ffffff', 0, 1, .55, 1), 'spire': ('#dfe8f3', .1, .6, 0, 1),
    'light_warm': ('#ffd9a0', .1, .3, 1.6, 1), 'light_cyan': ('#9cf1f2', .1, .3, 1.6, 1),
    'light_amber': ('#ffc27a', .1, .3, 1.6, 1), 'flower_pink': ('#ffa6c4', 0, .8, 0, 1),
}


class Mesh:
    def __init__(self):
        self.prims = {}  # material -> [positions, normals, indices]

    def tri_list(self, mat):
        return self.prims.setdefault(mat, [[], [], []])

    def quad(self, mat, a, b, c, d):
        """Planar quad a-b-c-d counter-clockwise seen from the front."""
        P, N, I = self.tri_list(mat)
        u = [b[i] - a[i] for i in range(3)]; v = [d[i] - a[i] for i in range(3)]
        n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        L = math.sqrt(sum(x * x for x in n)) or 1
        n = [x / L for x in n]
        base = len(P) // 3
        for p in (a, b, c, d):
            P.extend(p); N.extend(n)
        I.extend([base, base + 1, base + 2, base, base + 2, base + 3])

    def tri(self, mat, a, b, c):
        P, N, I = self.tri_list(mat)
        u = [b[i] - a[i] for i in range(3)]; v = [c[i] - a[i] for i in range(3)]
        n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        L = math.sqrt(sum(x * x for x in n)) or 1
        base = len(P) // 3
        for p in (a, b, c):
            P.extend(p); N.extend([x / L for x in n])
        I.extend([base, base + 1, base + 2])

    def box(self, mat, lo, hi, skip_bottom=False):
        x0, y0, z0 = lo; x1, y1, z1 = hi
        q = self.quad
        q(mat, (x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0))  # top
        if not skip_bottom:
            q(mat, (x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1))
        q(mat, (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))  # +z
        q(mat, (x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0))  # -z
        q(mat, (x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1))  # +x
        q(mat, (x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0))  # -x

    def cbox(self, mat, c, s, **kw):
        self.box(mat, [c[i] - s[i] / 2 for i in range(3)], [c[i] + s[i] / 2 for i in range(3)], **kw)

    def wedge(self, mat, o):
        """Ramp solid exactly as the game's collision: box clipped by the slope."""
        x, y, z = o['position']; w, h, d = o['size']
        ax, la = o['axis'], o['lowAt']

        def top(px, pz):
            c, ctr, half = (px, x, w / 2) if ax == 'x' else (pz, z, d / 2)
            t = max(-1, min(1, (c - ctr) / half))
            return y + h * (1 - t * la) / 2
        xs, zs = (x - w / 2, x + w / 2), (z - d / 2, z + d / 2)
        c = {(i, k): (xs[i], top(xs[i], zs[k]), zs[k]) for i in (0, 1) for k in (0, 1)}
        b = {(i, k): (xs[i], y, zs[k]) for i in (0, 1) for k in (0, 1)}
        q = self.quad
        q(mat, c[0, 1], c[1, 1], c[1, 0], c[0, 0])
        for (i0, k0), (i1, k1) in [((0, 1), (1, 1)), ((1, 0), (0, 0)), ((1, 1), (1, 0)), ((0, 0), (0, 1))]:
            if abs(c[i0, k0][1] - y) < 1e-6 and abs(c[i1, k1][1] - y) < 1e-6:
                continue
            if abs(c[i0, k0][1] - y) < 1e-6:
                self.tri(mat, b[i0, k0], b[i1, k1], c[i1, k1])
            elif abs(c[i1, k1][1] - y) < 1e-6:
                self.tri(mat, b[i0, k0], b[i1, k1], c[i0, k0])
            else:
                q(mat, b[i0, k0], b[i1, k1], c[i1, k1], c[i0, k0])
        return top

    def prism(self, mat, c, r, h, n=12, y0=None, rot=0.0):
        """Vertical n-gon prism (columns, lantern posts, ring segments)."""
        cx, cy, cz = c
        y0 = cy if y0 is None else y0
        pts = [(cx + r * math.cos(rot + 2 * math.pi * i / n), cz + r * math.sin(rot + 2 * math.pi * i / n)) for i in range(n)]
        for i in range(n):
            (ax_, az), (bx, bz) = pts[i], pts[(i + 1) % n]
            self.quad(mat, (bx, y0, bz), (ax_, y0, az), (ax_, y0 + h, az), (bx, y0 + h, bz))
            self.tri(mat, (cx, y0 + h, cz), (bx, y0 + h, bz), (ax_, y0 + h, az))
            self.tri(mat, (cx, y0, cz), (ax_, y0, az), (bx, y0, bz))

    def blob(self, mat, c, r, squash=1.0):
        """Low-poly octahedral sphere (foliage, clouds): 32 faces."""
        def v(x, y, z):
            L = math.sqrt(x * x + y * y + z * z)
            return (c[0] + r * x / L, c[1] + r * squash * y / L, c[2] + r * z / L)
        oct_ = [((1, 0, 0), (0, 1, 0), (0, 0, 1)), ((0, 0, 1), (0, 1, 0), (-1, 0, 0)), ((-1, 0, 0), (0, 1, 0), (0, 0, -1)),
                ((0, 0, -1), (0, 1, 0), (1, 0, 0)), ((1, 0, 0), (0, 0, 1), (0, -1, 0)), ((0, 0, 1), (-1, 0, 0), (0, -1, 0)),
                ((-1, 0, 0), (0, 0, -1), (0, -1, 0)), ((0, 0, -1), (1, 0, 0), (0, -1, 0))]
        for a, b, cc in oct_:
            ab = [(a[i] + b[i]) / 2 for i in range(3)]; bc = [(b[i] + cc[i]) / 2 for i in range(3)]; ca = [(cc[i] + a[i]) / 2 for i in range(3)]
            for t in [(a, ab, ca), (ab, b, bc), (ca, bc, cc), (ab, bc, ca)]:
                self.tri(mat, v(*t[0]), v(*t[1]), v(*t[2]))


def xform_flip(p):
    return (-p[0], p[1], -p[2])


# ---------------------------------------------------------------- base objects (VIS_*)
nodes = []  # (name, Mesh, extras)
ramps = {}
for o in data['objects']:
    m = Mesh()
    x, y, z = o['position']; w, h, d = o['size']
    mat = o['material']
    if o['type'] == 'ramp':
        ramps[o['id']] = (o, m.wedge('stone', o))
    elif o['id'].startswith('wall_'):
        # 1.2 m stone parapet; the glass windbreak above is a separate, non-shadowing batch
        m.box('wall', (x - w / 2, 0, z - d / 2), (x + w / 2, 1.2, z + d / 2))
    elif mat == 'hedge':
        m.box('stone', (x - w / 2, 0, z - d / 2), (x + w / 2, .8, z + d / 2))
        m.box('hedge', (x - w / 2 + .05, .8, z - d / 2 + .05), (x + w / 2 - .05, y + h / 2, z + d / 2 - .05), skip_bottom=True)
    elif mat == 'stone' and o['role'] == 'cover':
        m.box('stone', (x - w / 2, 0, z - d / 2), (x + w / 2, y + h / 2 - .12, z + d / 2))
        m.box('hedge', (x - w / 2 + .12, y + h / 2 - .12, z - d / 2 + .12), (x + w / 2 - .12, y + h / 2, z + d / 2 - .12), skip_bottom=True)
    else:
        m.cbox(mat if mat in MATS else 'cover', o['position'], o['size'], skip_bottom=o['role'] == 'wayfinding')
    nodes.append(('VIS_' + o['id'], m, dict(source_id=o['id'], role=o['role'], collision=o['collision'], decorative=False)))

# ---------------------------------------------------------------- decorative details
D = Mesh()
G = Mesh()  # glass, kept apart so it never casts shadows
objs = {o['id']: o for o in data['objects']}
bmin, bmax = data['bounds']['min'], data['bounds']['max']
X, Z = bmax[0], bmax[2]

# floor: 4 m checker tiles and seams; brass sundial ring on the dais
for i in range(-7, 8):
    for k in range(-5, 6):
        if (i + k) % 2 == 0:
            x0, z0 = i * 4 - 2, k * 4 - 2
            x0, x1 = max(x0, -X + .25), min(x0 + 4, X - .25); z0, z1 = max(z0, -Z + .25), min(z0 + 4, Z - .25)
            if x1 > x0 and z1 > z0:
                D.box('tile', (x0, 0, z0), (x1, .006, z1), skip_bottom=True)
for i in range(-7, 8):
    D.box('seam', (i * 4 - 2 - .03, 0, -Z + .25), (i * 4 - 2 + .03, .008, Z - .25), skip_bottom=True)
for k in range(-5, 6):
    D.box('seam', (-X + .25, 0, k * 4 - 2 - .03), (X - .25, .008, k * 4 - 2 + .03), skip_bottom=True)
for i in range(24):
    a0, a1 = 2 * math.pi * i / 24, 2 * math.pi * (i + 1) / 24
    for r0, r1, yy, mat in ((3.0, 3.25, .246, 'gold'), (2.05, 2.15, .246, 'gold')):
        D.quad(mat, (r0 * math.cos(a0), yy, r0 * math.sin(a0)), (r0 * math.cos(a1), yy, r0 * math.sin(a1)),
               (r1 * math.cos(a1), yy, r1 * math.sin(a1)), (r1 * math.cos(a0), yy, r1 * math.sin(a0)))
    if i % 2 == 0:  # hour marks
        a = a0
        c, s_ = math.cos(a), math.sin(a)
        p = [(2.25 * c - .05 * s_, .246, 2.25 * s_ + .05 * c), (2.9 * c - .05 * s_, .246, 2.9 * s_ + .05 * c),
             (2.9 * c + .05 * s_, .246, 2.9 * s_ - .05 * c), (2.25 * c + .05 * s_, .246, 2.25 * s_ - .05 * c)]
        D.quad('gold', p[3], p[2], p[1], p[0])
D.box('white', (-3.55, .2, -3.55), (3.55, .26, -3.45)); D.box('white', (-3.55, .2, 3.45), (3.55, .26, 3.55))
D.box('white', (-3.55, .2, -3.45), (-3.45, .26, 3.45)); D.box('white', (3.45, .2, -3.45), (3.55, .26, 3.45))

# gnomon: gold pyramidion and a floating parhelion halo (the map's landmark)
g = objs['gnomon']; gy = g['position'][1] + g['size'][1] / 2; gh = g['size'][0] / 2
apex = (0, gy + 1.6, 0)
corners = [(-gh, gy, -gh), (gh, gy, -gh), (gh, gy, gh), (-gh, gy, gh)]
for i in range(4):
    D.tri('gold', corners[i], apex, corners[(i + 1) % 4])
for i in range(4):
    D.box('gold', (-gh - .06, .24, -gh - .06), (gh + .06, .5, gh + .06))
for sx in (-1, 1):
    for sz in (-1, 1):
        D.box('light_warm', (sx * gh - .05 - (.0 if sx < 0 else .0), 1.2, sz * gh - .05), (sx * gh + .05, 3.3, sz * gh + .05))
for r0, r1, yy, n, mat in ((2.5, 2.75, 8.2, 48, 'light_warm'), (3.3, 3.4, 8.2, 48, 'gold')):
    for i in range(n):  # flat annulus, both faces (double-sided material)
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        D.quad(mat, (r0 * math.cos(a0), yy, r0 * math.sin(a0)), (r0 * math.cos(a1), yy, r0 * math.sin(a1)),
               (r1 * math.cos(a1), yy, r1 * math.sin(a1)), (r1 * math.cos(a0), yy, r1 * math.sin(a0)))
D.blob('light_warm', (0, 8.25, 0), .7)
for i in range(4):  # parhelia: the two mock suns either side, and above/below
    a = i * math.pi / 2
    D.blob('light_warm', (2.62 * math.cos(a), 8.2, 2.62 * math.sin(a)), .26)

# windbreak: stone coping, white mullions, glass above, gold top rail
for wid in ('wall_west', 'wall_east', 'wall_north', 'wall_south'):
    o = objs[wid]; x, y, z = o['position']; w, h, d = o['size']
    lo, hi = (x - w / 2, z - d / 2), (x + w / 2, z + d / 2)
    D.box('white', (lo[0] - .08, 1.2, lo[1] - .08), (hi[0] + .08, 1.32, hi[1] + .08))
    D.box('gold', (lo[0] - .05, 4.9, lo[1] - .05), (hi[0] + .05, 5.02, hi[1] + .05))
    G.box('glass', (lo[0] + .1, 1.32, lo[1] + .1), (hi[0] - .1, 4.9, hi[1] - .1))
    along_x = w > d
    L = w if along_x else d
    for i in range(int(L // 4) + 1):
        t = -L / 2 + i * 4
        cx, cz = (x + t, z) if along_x else (x, z + t)
        D.box('white', (cx - .07, 1.32, cz - .07), (cx + .07, 4.9, cz + .07))

# building edge outside the windbreak: ledge, tower body, cloud sea, distant spires
D.box('stone', (-X - 2.2, -.6, -Z - 2.2), (X + 2.2, 0, -Z + .2)); D.box('stone', (-X - 2.2, -.6, Z - .2), (X + 2.2, 0, Z + 2.2))
D.box('stone', (-X - 2.2, -.6, -Z), (-X + .2, 0, Z)); D.box('stone', (X - .2, -.6, -Z), (X + 2.2, 0, Z))
D.box('gold', (-X - 2.25, -.7, -Z - 2.25), (X + 2.25, -.6, Z + 2.25))
D.box('wall', (-X - 1.6, -30, -Z - 1.6), (X + 1.6, -.7, Z + 1.6))
for i in range(-6, 7):
    D.box('white', (i * 5 - .3, -24, -Z - 1.75), (i * 5 + .3, -.7, -Z - 1.6))
    D.box('white', (i * 5 - .3, -24, Z + 1.6), (i * 5 + .3, -.7, Z + 1.75))
seed = 7
def rnd():
    global seed
    seed = (seed * 1103515245 + 12345) % 2 ** 31
    return seed / 2 ** 31
for i in range(70):
    a = rnd() * 2 * math.pi; r = 48 + rnd() * 70
    D.blob('cloud', (r * math.cos(a), -9 - rnd() * 6, r * math.sin(a) * .85), 7 + rnd() * 9, squash=.38)
for i, (a, r, hgt) in enumerate([(.4, 95, 60), (1.3, 120, 80), (2.2, 105, 50), (3.0, 130, 95), (3.9, 100, 65), (4.8, 125, 75), (5.6, 110, 55)]):
    cx, cz = r * math.cos(a), r * math.sin(a)
    D.prism('spire', (cx, -20, cz), 4 + i % 3, hgt, n=8, y0=-20)
    D.prism('gold', (cx, 0, cz), 4.6 + i % 3, .8, n=8, y0=-20 + hgt * .7)
    D.prism('light_cyan' if i % 2 else 'light_amber', (cx, 0, cz), 1.2, 6, n=6, y0=-20 + hgt)

# spawn screens and pockets: team light band, coping, team banners on the back wall
for side, light, team in ((-1, 'light_cyan', 'cyan'), (1, 'light_amber', 'amber')):
    label = 'west' if side < 0 else 'east'
    o = objs[f'{label}_spawn_screen']; x, y, z = o['position']; w, h, d = o['size']
    D.box('white', (x - w / 2 - .06, h, z - d / 2 - .06), (x + w / 2 + .06, h + .12, z + d / 2 + .06))
    D.box(light, (x - w / 2 - .03, 3.2, z - d / 2 - .03), (x + w / 2 + .03, 3.4, z + d / 2 + .03))
    for sz in (-1, 1):
        D.box(light, (x - w / 2 - .03, 0, z + sz * d / 2 - .12), (x + w / 2 + .03, 3.2, z + sz * d / 2 + .12))
        p = objs[f'{label}_pocket_{"n" if sz < 0 else "s"}']; px, py, pz = p['position']; pw, ph, pd = p['size']
        D.box('white', (px - pw / 2 - .05, ph, pz - pd / 2 - .05), (px + pw / 2 + .05, ph + .1, pz + pd / 2 + .05))
    bx = side * (X - .3)
    D.box(team, (bx - .04, 1.5, -2.2), (bx + .04, 4.6, 2.2))
    D.box('white', (bx - .05, 2.6, -1.2), (bx + .05, 3.6, 1.2))
    D.box(light, (bx - .06, 2.9, -.3), (bx + .06, 3.3, .3))

# terraces: gold edge trim, lanterns at the back corners, deck soffit lights, ramp stripes and coping
for suffix, light in (('_a', 'light_cyan'), ('_b', 'light_amber')):
    o = objs['terrace_deck' + suffix]; x, y, z = o['position']; w, h, d = o['size']
    top, x0, x1, z0, z1 = y + h / 2, x - w / 2, x + w / 2, z - d / 2, z + d / 2
    for a, b_ in (((x0, z0 - .04), (x1, z0 + .08)), ((x0, z1 - .08), (x1, z1 + .04)), ((x0 - .04, z0), (x0 + .08, z1)), ((x1 - .08, z0), (x1 + .04, z1))):
        D.box('gold', (a[0], top - .25, a[1]), (b_[0], top + .03, b_[1]))
    for i in range(4):
        lx = x0 + 2 + i * (w - 4) / 3
        D.box(light, (lx - .4, y - h / 2 - .06, z - .12), (lx + .4, y - h / 2 - .02, z + .12))
    back_z = z0 + .25 if suffix == '_a' else z1 - .25
    for lx in (x0 + .25, x1 - .25):
        D.prism('dark', (lx, 0, back_z), .06, 1.4, n=6, y0=top)
        D.box('light_warm', (lx - .14, top + 1.4, back_z - .14), (lx + .14, top + 1.72, back_z + .14))
        D.box('gold', (lx - .17, top + 1.72, back_z - .17), (lx + .17, top + 1.78, back_z + .17))
for rid, (o, top) in ramps.items():
    x, y, z = o['position']; w, h, d = o['size']
    stripe = 'cyan' if rid.endswith('_a') else 'amber'
    if o['axis'] == 'x':
        n = int(w)
        for i in range(n):
            c0 = x - w / 2 + (i + .35) * w / n; c1 = c0 + .3 * w / n
            za, zb = z - d / 2 + .35, z + d / 2 - .35
            D.quad(stripe, (c0, top(c0, z) + .012, zb), (c1, top(c1, z) + .012, zb), (c1, top(c1, z) + .012, za), (c0, top(c0, z) + .012, za))
        for zz in (z - d / 2, z + d / 2):
            xa, xb = x - w / 2, x + w / 2
            D.quad('white', (xa, top(xa, z) + .03, zz + .1), (xb, top(xb, z) + .03, zz + .1), (xb, top(xb, z) + .03, zz - .1), (xa, top(xa, z) + .03, zz - .1))
    else:
        n = int(d)
        for i in range(n):
            c0 = z - d / 2 + (i + .35) * d / n; c1 = c0 + .3 * d / n
            xa, xb = x - w / 2 + .3, x + w / 2 - .3
            D.quad(stripe, (xa, top(x, c1) + .012, c1), (xb, top(x, c1) + .012, c1), (xb, top(x, c0) + .012, c0), (xa, top(x, c0) + .012, c0))
        for xx in (x - w / 2, x + w / 2):
            za, zb = z - d / 2, z + d / 2
            D.quad('white', (xx - .1, top(x, zb) + .03, zb), (xx + .1, top(x, zb) + .03, zb), (xx + .1, top(x, za) + .03, za), (xx - .1, top(x, za) + .03, za))

# covers: caps and dark plinths; columns get gold collars
for o in data['objects']:
    if not o['collision']:
        continue
    x, y, z = o['position']; w, h, d = o['size']
    lo, hi = (x - w / 2, y - h / 2, z - d / 2), (x + w / 2, y + h / 2, z + d / 2)
    if o['material'] == 'cover' and o['role'] == 'cover':
        cap = 'coral' if h < 1.5 else 'gold'
        D.box(cap, (lo[0] - .03, hi[1], lo[2] - .03), (hi[0] + .03, hi[1] + .06, hi[2] + .03))
        D.box('dark', (lo[0] - .02, lo[1], lo[2] - .02), (hi[0] + .02, lo[1] + .14, hi[2] + .02))
        if h > 1.5:
            D.box('coral', (lo[0] - .02, hi[1] - .55, lo[2] - .02), (hi[0] + .02, hi[1] - .45, hi[2] + .02))
    elif o['id'].startswith('terrace_parapet'):
        D.box('gold', (lo[0] - .03, hi[1], lo[2] - .03), (hi[0] + .03, hi[1] + .05, hi[2] + .03))
    elif o['id'].startswith('terrace_column'):
        D.box('gold', (lo[0] - .05, hi[1] - .3, lo[2] - .05), (hi[0] + .05, hi[1] - .2, hi[2] + .05))
        D.box('dark', (lo[0] - .04, 0, lo[2] - .04), (hi[0] + .04, .2, hi[2] + .04))
    elif o['material'] == 'hedge':
        k = 0
        for i in range(max(1, int(w // .9))):
            for j in range(max(1, int(d // .9))):
                k += 1
                px = lo[0] + (i + .5) * w / max(1, int(w // .9)); pz = lo[2] + (j + .5) * d / max(1, int(d // .9))
                D.blob('leaf' if k % 3 else 'hedge', (px, hi[1] - .05, pz), .42, squash=.55)
                if k % 4 == 1:
                    D.blob('flower_pink' if k % 8 == 1 else 'gold', (px + .2, hi[1] + .12, pz - .15), .1)
        D.box('white', (lo[0] - .03, .8, lo[2] - .03), (hi[0] + .03, .88, hi[2] + .03))
    elif o['material'] == 'stone' and o['role'] == 'cover':
        for i, (fx, fz) in enumerate(((-.5, -.5), (.4, -.2), (-.1, .45), (.5, .5))):
            D.blob('flower_pink' if i % 2 else 'gold', (x + fx * w * .6, hi[1] + .06, z + fz * d * .6), .12)
        D.box('white', (lo[0] - .03, hi[1] - .12, lo[2] - .03), (hi[0] + .03, hi[1] - .06, hi[2] + .03))
    elif o['id'].startswith('garden_screen'):
        # white trellis lattice on both faces, and a shade-sail pole on each end
        for face in (lo[2] - .03, hi[2] + .03):
            for i in range(8):
                xx = lo[0] + .3 + i * (w - .6) / 7
                D.box('white', (xx - .04, .4, face - .02), (xx + .04, hi[1] - .1, face + .02))
            for yy in (1.1, 2.2, 3.2):
                D.box('white', (lo[0] + .2, yy - .04, face - .02), (hi[0] - .2, yy + .04, face + .02))
        D.box('coral', (lo[0] - .04, hi[1], lo[2] - .04), (hi[0] + .04, hi[1] + .1, hi[2] + .04))

# shade sails over each garden (point mirrored), on poles that stand inside walls/screens
for flip in (False, True):
    f = xform_flip if flip else (lambda p: p)
    tri_a = [f((3, 6.4, -21.7)), f((19, 5.6, -21.7)), f((11.5, 5.0, -9.2))]
    tri_b = [f((19, 5.6, -21.7)), f((26, 6.2, -14)), f((11.5, 5.0, -9.2))]
    for t in (tri_a, tri_b):
        D.tri('sail', t[0], t[2], t[1])  # normal up: the sun-lit face
    for p in (tri_a[0], tri_a[1], tri_b[1]):
        D.prism('white', (p[0], 0, p[2]), .07, p[1] - 4.9 + .1, n=6, y0=4.9)
    p = tri_a[2]
    D.prism('white', (p[0], 0, p[2]), .07, p[1] - 3.6, n=6, y0=3.6)

nodes.append(('DETAIL_batch', D, dict(decorative=True, collision=False, role='detail_batch')))
nodes.append(('DETAIL_glass', G, dict(decorative=True, collision=False, role='detail_batch')))


# ---------------------------------------------------------------- glTF writer
def write_glb(path, node_list, materials_used):
    mat_index = {n: i for i, n in enumerate(materials_used)}
    gl = dict(asset=dict(version='2.0', generator='Parhelion ZENITH build_glb.py'), scene=0, scenes=[dict(nodes=[])],
              nodes=[], meshes=[], materials=[], accessors=[], bufferViews=[], buffers=[])
    ext = set()
    for n in materials_used:
        hx, metal, rough, emit, alpha = MATS[n]
        rgb = lin(hx)
        m = dict(name=n, doubleSided=True, pbrMetallicRoughness=dict(baseColorFactor=[*rgb, alpha], metallicFactor=metal, roughnessFactor=rough))
        if emit:
            m['emissiveFactor'] = [c * min(1, emit) for c in rgb]  # <= 1: a soft self-lit lift (sails, clouds)
            if emit > 1:
                m['extensions'] = dict(KHR_materials_emissive_strength=dict(emissiveStrength=emit)); ext.add('KHR_materials_emissive_strength')
        if alpha < 1:
            m['alphaMode'] = 'BLEND'
        gl['materials'].append(m)
    if ext:
        gl['extensionsUsed'] = sorted(ext)
    blob = bytearray()

    def view(raw, target):
        while len(blob) % 4:
            blob.append(0)
        gl['bufferViews'].append(dict(buffer=0, byteOffset=len(blob), byteLength=len(raw), target=target))
        blob.extend(raw)
        return len(gl['bufferViews']) - 1
    tris = 0
    for name, mesh, extras in node_list:
        prims = []
        # split per material: a batch mesh holds one primitive per material, in palette order
        for mat in materials_used:
            if mat not in mesh.prims:
                continue
            P, N, I = mesh.prims[mat]
            if not I:
                continue
            nv = len(P) // 3
            pos = struct.pack(f'<{len(P)}f', *P); nor = struct.pack(f'<{len(N)}f', *N)
            idx = struct.pack(f'<{len(I)}I', *I)
            mn = [min(P[i::3]) for i in range(3)]; mx = [max(P[i::3]) for i in range(3)]
            a0 = len(gl['accessors'])
            gl['accessors'] += [dict(bufferView=view(pos, 34962), componentType=5126, count=nv, type='VEC3', min=mn, max=mx),
                                dict(bufferView=view(nor, 34962), componentType=5126, count=nv, type='VEC3'),
                                dict(bufferView=view(idx, 34963), componentType=5125, count=len(I), type='SCALAR')]
            prims.append(dict(attributes=dict(POSITION=a0, NORMAL=a0 + 1), indices=a0 + 2, material=mat_index[mat]))
            tris += len(I) // 3
        if not prims:
            continue
        gl['meshes'].append(dict(name=name, primitives=prims))
        gl['nodes'].append(dict(name=name, mesh=len(gl['meshes']) - 1, extras=extras))
        gl['scenes'][0]['nodes'].append(len(gl['nodes']) - 1)
    while len(blob) % 4:
        blob.append(0)
    gl['buffers'].append(dict(byteLength=len(blob)))
    js = json.dumps(gl, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
    path.write_bytes(out)
    return dict(nodes=len(gl['nodes']), meshes=len(gl['meshes']), materials=len(gl['materials']), triangles=tris, bytes=len(out))


used = [n for n in MATS if any(n in mesh.prims for _, mesh, _ in nodes)]
vis = write_glb(ROOT / 'assets/zenith_visual.glb', nodes, used)

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
col = write_glb(ROOT / 'assets/zenith_collision.glb', col_nodes, ['stone'])
print(json.dumps(dict(visual=vis, collision=col)))
