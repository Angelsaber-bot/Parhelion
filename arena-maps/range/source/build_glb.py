"""TRAINING RANGE art: builds assets/range_visual.glb and assets/range_collision.glb from
runtime/map.json with the shared toolkit (arena-maps/_lib/glbkit.py). Pure Python 3.

VIS_<object id> nodes stay inside each object's box. Everything else is decorative and has no
collision: lane stripes, distance lines with seven-segment numbers, target posts, the hall's
light beams and acoustic panels.
Run: python3 source/build_glb.py
"""
from pathlib import Path
import json, sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / '_lib'))
from glbkit import Mesh, write_glb  # noqa: E402

data = json.loads((ROOT / 'runtime/map.json').read_text())
objs = {o['id']: o for o in data['objects']}
R = data['range']; LINE = R['firingLine']

# name: (sRGB hex, metallic, roughness, emissive, alpha)
MATS = {
    'floor': ('#c9d3df', .02, .85, 0, 1), 'lane': ('#b4c0cf', .02, .9, 0, 1), 'line': ('#ffd36b', .05, .6, .35, 1),
    'wall': ('#e9eef4', .02, .9, 0, 1), 'panel': ('#d6dee8', .02, .95, 0, 1), 'trim': ('#5b6b80', .4, .45, 0, 1),
    'cover': ('#8494a8', .1, .7, 0, 1), 'cover_top': ('#ff6b5a', .05, .6, .15, 1), 'pit': ('#7d6a5a', .05, .9, 0, 1),
    'sand': ('#d8c39a', 0, 1, 0, 1), 'glow': ('#7fe0ff', .1, .3, 1.8, 1), 'digit': ('#ffffff', 0, .5, 1.4, 1),
    'red': ('#ff5a4a', .05, .5, .6, 1), 'post': ('#2f3a4a', .5, .4, 0, 1),
}

nodes = []
for o in data['objects']:
    m = Mesh(); x, y, z = o['position']; w, h, d = o['size']
    lo, hi = (x - w / 2, y - h / 2, z - d / 2), (x + w / 2, y + h / 2, z + d / 2)
    if o['id'] == 'floor_range':
        m.box('floor', lo, hi)
    elif o['id'].startswith('wall_'):
        m.box('trim', lo, (hi[0], .4, hi[2]))
        m.box('wall', (lo[0], .4, lo[2]), hi, skip_bottom=True)
    elif o['role'] == 'cover' and o['material'] == 'cover':
        m.box('cover', lo, (hi[0], hi[1] - .08, hi[2]))
        m.box('cover_top', (lo[0], hi[1] - .08, lo[2]), hi, skip_bottom=True)
    else:
        m.box(o['material'] if o['material'] in MATS else 'cover', lo, hi)
    nodes.append(('VIS_' + o['id'], m, dict(source_id=o['id'], role=o['role'], collision=o['collision'], decorative=False)))

D = Mesh()
# Lanes: darker stripes, lane edge lines, and the yellow firing line.
for zc in R['lanes'].values():
    D.box('lane', (LINE, 0, zc - 2.6), (35, .012, zc + 2.6), skip_bottom=True)
    for e in (-2.6, 2.6):
        D.box('line', (LINE, .012, zc + e - .04), (35, .02, zc + e + .04), skip_bottom=True)
D.box('line', (LINE - .1, .012, -20), (LINE + .1, .022, 20), skip_bottom=True)

# Seven-segment digits drawn with boxes, so every distance is readable from the firing line.
SEG = {'0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg'}
def digit(ch, x, y, z, s=.5, mat='digit'):
    t = s * .16
    segs = dict(a=((0, s * 2), (s, s * 2)), b=((s, s), (s, s * 2)), c=((s, 0), (s, s)), d=((0, 0), (s, 0)),
                e=((0, 0), (0, s)), f=((0, s), (0, s * 2)), g=((0, s), (s, s)))
    for k in SEG[ch]:
        (u0, v0), (u1, v1) = segs[k]
        # Board faces west (toward the player, who looks +x): their right hand is +z, so text runs along +z.
        D.box(mat, (x - .03, y + min(v0, v1) - t / 2, z + min(u0, u1) - t / 2), (x + .03, y + max(v0, v1) + t / 2, z + max(u0, u1) + t / 2))
def number(text, x, y, z, s=.5):
    w = len(text) * s * 1.5
    for i, ch in enumerate(text):
        digit(ch, x, y, z - w / 2 + i * s * 1.5 + s * .25, s)

for dist in R['distances']:
    x = LINE + dist
    D.box('line', (x - .06, .012, -20), (x + .06, .022, 20), skip_bottom=True)
    for zc in R['lanes'].values():
        zz = zc - 3.4
        D.box('post', (x - .08, 0, zz - .08), (x + .08, 2.6, zz + .08))
        D.box('trim', (x - .06, 2.55, zz - .9), (x + .06, 3.45, zz + .9))
        number(str(dist), x - .1, 2.65, zz, .3)
# Target posts: a small plinth and ring where each dummy stands (see shared/trainingRange.ts).
for x, z in [(LINE + 10, -10), (LINE + 20, -10), (LINE + 30, -10), (LINE + 45, -10), (LINE + 15, 0), (LINE + 30, 0),
             (LINE + 20.4, 8), (LINE + 25, 4.5), (5.4, 17.4), (-21, -17), (-17, -17), (-13, -17)]:
    D.prism('post', (x, 0, z), .55, .04, n=20, y0=.01)
    D.prism('red', (x, 0, z), .62, .015, n=20, y0=.052)
# Grenade pit floor.
p = objs['pit_front']
D.box('sand', (2.2, .005, 15.1), (8, .03, 19.7), skip_bottom=True)
# Hall: light beams over the lanes and acoustic panels on the long walls.
for i in range(9):
    x = -32 + i * 8
    D.box('trim', (x - .2, 7.2, -22.5), (x + .2, 7.6, 22.5))
    D.box('glow', (x - .08, 7.1, -20), (x + .08, 7.2, 20))
for z0 in (-22.7, 22.45):
    for i in range(18):
        x = -34 + i * 4
        D.box('panel', (x, 1.2, z0), (x + 3.4, 4.6, z0 + .25))
# Range title strip behind the targets.
D.box('glow', (37.6, 6.2, -18), (37.7, 6.4, 18))

nodes.append(('DETAIL_batch', D, dict(decorative=True, collision=False, role='detail_batch')))
used = [n for n in MATS if any(n in mesh.prims for _, mesh, _ in nodes)]
vis = write_glb(ROOT / 'assets/range_visual.glb', nodes, used, MATS)
col_nodes = []
for o in data['objects']:
    if not o['collision']:
        continue
    m = Mesh(); m.cbox('cover', o['position'], o['size'])
    col_nodes.append(('COL_' + o['id'], m, dict(source_id=o['id'], role=o['role'], collision=True, decorative=False)))
col = write_glb(ROOT / 'assets/range_collision.glb', col_nodes, ['cover'], MATS)
print(json.dumps(dict(visual=vis, collision=col)))
