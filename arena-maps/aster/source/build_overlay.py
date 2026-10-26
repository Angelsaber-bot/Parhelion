"""ASTER art overlay: assets/aster_overlay.glb, a purely decorative layer drawn on top of
ChatGPT's original station (arena/assets/station_visual.glb, untouched). It turns ASTER into a
polar research station at aurora twilight: snow on every cover and wall top, a snowy plateau with
pines and peaks around the station, a radio-telescope landmark, the HELIOS light pillar rising
from the reactor with a floating collector ring, and cyan light strips along the outer walls.
Nothing here has collision; the game still collides only against arena/runtime/map.json.
Run: python3 source/build_overlay.py
"""
from pathlib import Path
import json, math, sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / '_lib'))
from glbkit import Mesh, write_glb  # noqa: E402

data = json.loads((ROOT.parents[1] / 'arena/runtime/map.json').read_text())
MATS = {
    'snow': ('#f4f8ff', 0, .85, .08, 1), 'snow_shade': ('#dfe8f8', 0, .9, .05, 1), 'ice': ('#bfe4f6', .2, .2, .1, 1),
    'rock': ('#5d6a80', 0, .95, 0, 1), 'rock_dark': ('#3b4559', 0, .95, 0, 1), 'pine': ('#2f5a55', 0, .9, 0, 1),
    'steel': ('#9aa8b8', .7, .35, 0, 1), 'steel_dark': ('#3a4658', .7, .4, 0, 1), 'white': ('#eef3f8', .2, .5, 0, 1),
    'light_cyan': ('#7ff6ff', 0, .3, 2.6, 1), 'beam': ('#9ff8ff', 0, .2, 2.0, .22), 'beam_core': ('#e8ffff', 0, .2, 2.4, .5),
    'beacon': ('#ff6b6b', 0, .3, 3.0, 1), 'window': ('#ffd99a', 0, .5, 1.8, 1), 'gold': ('#f4c95d', .6, .35, .2, 1),
}
seed = 5
def rnd():
    global seed
    seed = (seed * 1103515245 + 12345) % 2 ** 31
    return seed / 2 ** 31

D = Mesh()      # opaque decor
B = Mesh()      # translucent light beam (no shadows, separate node)
objs = {o['id']: o for o in data['objects']}

# snow caps on wall tops, screens and cover (slightly inset, a few cm thick, with drift lumps)
for o in data['objects']:
    if not o['collision'] or o['type'] != 'box' or o['role'] == 'floor' or o['id'].startswith('lab_pod') or o['id'].startswith('reactor'):
        continue
    x, y, z = o['position']; w, h, d = o['size']
    top = y + h / 2
    ins = min(.04, w * .1, d * .1)
    D.box('snow', (x - w / 2 + ins, top, z - d / 2 + ins), (x + w / 2 - ins, top + .06, z + d / 2 - ins), skip_bottom=True)
    n = max(1, int(max(w, d) / 1.6))
    for i in range(n):
        t = (i + .5) / n - .5
        px, pz = (x + t * w, z) if w >= d else (x, z + t * d)
        D.blob('snow' if i % 2 else 'snow_shade', (px, top + .04, pz), min(.35, min(w, d) * .5), squash=.3)

# outer walls: cyan light strip on the inner top edge and lamp heads every 8 m
for wid in ('wall_west', 'wall_east', 'wall_north', 'wall_south'):
    o = objs[wid]; x, y, z = o['position']; w, h, d = o['size']
    top = y + h / 2
    inward = (-1 if x > 0 else 1, 0) if d > w else (0, -1 if z > 0 else 1)
    if d > w:
        xx = x + inward[0] * (w / 2 + .03)
        D.box('light_cyan', (xx - .03, top - .5, z - d / 2 + 1), (xx + .03, top - .42, z + d / 2 - 1))
    else:
        zz = z + inward[1] * (d / 2 + .03)
        D.box('light_cyan', (x - w / 2 + 1, top - .5, zz - .03), (x + w / 2 - 1, top - .42, zz + .03))

# the HELIOS pillar: a column of light from the reactor into the sky, with a slowly glowing ring
rx, rz = objs['reactor_core']['position'][0], objs['reactor_core']['position'][2]
B.prism('beam', (rx, 0, rz), 1.1, 90, n=16, y0=7)
B.prism('beam_core', (rx, 0, rz), .35, 90, n=10, y0=7)
for r0, r1, yy in ((5.5, 6.0, 14), (8.0, 8.25, 16.5)):
    for i in range(48):
        a0, a1 = 2 * math.pi * i / 48, 2 * math.pi * (i + 1) / 48
        D.quad('light_cyan', (rx + r0 * math.cos(a0), yy, rz + r0 * math.sin(a0)), (rx + r0 * math.cos(a1), yy, rz + r0 * math.sin(a1)),
               (rx + r1 * math.cos(a1), yy, rz + r1 * math.sin(a1)), (rx + r1 * math.cos(a0), yy, rz + r1 * math.sin(a0)))
for i in range(4):  # ring stays: thin struts out to the walls' corners, high above play
    a = math.pi / 4 + i * math.pi / 2
    D.prism('steel_dark', (rx + 5.75 * math.cos(a), 0, rz + 5.75 * math.sin(a)), .06, 2.5, n=6, y0=14)

# beyond the walls: snowy plateau, drifts against the walls, pines, peaks, a radio telescope
D.box('snow', (-400, -2.6, -400), (400, -2.5, 400))
for i in range(90):
    a = rnd() * 6.283; r = 44 + rnd() * 40
    D.blob('snow' if i % 3 else 'snow_shade', (math.cos(a) * r, -2.5, math.sin(a) * r * .85), 3 + rnd() * 5, squash=.35)
for side in (-1, 1):
    for k in range(9):
        D.blob('snow', (side * 37.5, -1.2, -24 + k * 6), 2.2 + rnd(), squash=.6)
        D.blob('snow', (-32 + k * 8, -1.2, side * 29.6), 2.2 + rnd(), squash=.6)
for i in range(70):
    a = rnd() * 6.283; r = 48 + rnd() * 60
    px, pz = math.cos(a) * r, math.sin(a) * r
    hgt = 5 + rnd() * 7
    D.prism('rock_dark', (px, 0, pz), .25, 1.5, n=6, y0=-2.6)
    for k in range(3):
        D.prism('pine', (px, 0, pz), (1.6 - k * .45) * hgt / 8, hgt * .3, n=7, y0=-1.2 + k * hgt * .25)
        D.prism('snow', (px, 0, pz), (1.0 - k * .3) * hgt / 8, .25, n=7, y0=-1.2 + k * hgt * .25 + hgt * .3 - .1)
for i in range(22):
    a = i / 22 * 6.283 + rnd() * .15
    r = 150 + rnd() * 60
    cx, cz = math.cos(a) * r, math.sin(a) * r
    hgt = 45 + rnd() * 55; wd = 35 + rnd() * 25
    tx, tz = -math.sin(a) * wd, math.cos(a) * wd
    ux, uz = -math.cos(a), -math.sin(a)  # toward the station: the snow cap sits just in front of the rock face
    for mat, f, off in (('rock', 1.0, 0.0), ('snow', .45, 1.5)):
        top = (cx + ux * off, -3 + hgt + .3 * (off > 0), cz + uz * off)
        b0 = (cx - tx * f + ux * off, -3 + hgt * (1 - f), cz - tz * f + uz * off)
        b1 = (cx + tx * f + ux * off, -3 + hgt * (1 - f), cz + tz * f + uz * off)
        D.tri(mat, b0, b1, top); D.tri(mat, b1, b0, top)
# radio telescope on its own rock spur to the north-east: tower, tilted dish, feed horn, beacon
tx, tz = 62, -48
D.prism('steel_dark', (tx, 0, tz), 2.2, 16, n=8, y0=-3)
D.box('white', (tx - 3, 13, tz - 3), (tx + 3, 15, tz + 3))
for i in range(28):  # dish: a shallow cone fan tipped toward the station
    a0, a1 = 2 * math.pi * i / 28, 2 * math.pi * (i + 1) / 28
    c = (tx - 2, 24, tz + 2)
    def p(a, rr=11):
        return (c[0] + rr * math.cos(a) * .8, c[1] + rr * math.sin(a) * .55 + 3, c[2] + rr * math.sin(a) * .6 + rr * math.cos(a) * .2)
    D.tri('white', (c[0] + 2, c[1] - 1, c[2] - 2), p(a0), p(a1))
D.prism('steel', (tx - 2, 0, tz + 2), .25, 8, n=6, y0=16)
D.blob('beacon', (tx - 2, 31, tz + 2), .7)
# comm masts with red beacons, a couple of lit station huts outside the wall
for mx, mz, h in ((-46, 34, 26), (48, 30, 22), (-50, -36, 30)):
    D.prism('steel', (mx, 0, mz), .35, h, n=6, y0=-2.6)
    for k in range(4):
        D.box('steel_dark', (mx - 1.2, -2.6 + h * (k + 1) / 5, mz - .05), (mx + 1.2, -2.6 + h * (k + 1) / 5 + .1, mz + .05))
    D.blob('beacon', (mx, h - 2.4, mz), .45)
for hx, hz in ((-44, -10), (44, 12)):
    D.box('white', (hx - 4, -2.6, hz - 3), (hx + 4, 1.2, hz + 3))
    D.box('snow', (hx - 4.3, 1.2, hz - 3.3), (hx + 4.3, 1.6, hz + 3.3))
    for k in range(3):
        D.box('window', (hx - 3 + k * 2.4, -.6, hz + (3.02 if hz > 0 else -3.08)), (hx - 2 + k * 2.4, .4, hz + (3.08 if hz > 0 else -3.02)))

nodes = [('DETAIL_overlay', D, dict(decorative=True, collision=False, role='detail_batch')),
         ('DETAIL_helios_beam', B, dict(decorative=True, collision=False, role='detail_batch'))]
used = [n for n in MATS if any(n in m.prims for _, m, _ in nodes)]
print(json.dumps(write_glb(ROOT / 'assets/aster_overlay.glb', nodes, used, MATS)))
