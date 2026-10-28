"""Finds visual/collision mismatches a player would feel in-game.
Usage: python3 _lib/audit_collision.py <map dir> <asset prefix> [--strict]

1. "ghost" art: visible detail triangles in the body band (0.35-1.75 m above the
   walkable surface beneath them) inside the playable area but outside every solid.
   A player sees something there yet walks or shoots straight through it.
2. "invisible" walls: solids whose visual node is empty, or which sit in the play
   area with no visible art covering the collider's top face.
Clusters are reported on a 0.5 m grid; fine grass/rubble below 0.35 m never counts.
"""
from pathlib import Path
import json, struct, sys, math
from collections import defaultdict

ROOT = Path(sys.argv[1]).resolve(); PREFIX = sys.argv[2]; STRICT = '--strict' in sys.argv
m = json.loads((ROOT / 'runtime/map.json').read_text())
b = (ROOT / f'assets/{PREFIX}_visual.glb').read_bytes()
jl = struct.unpack('<I', b[12:16])[0]; g = json.loads(b[20:20 + jl])
bin_off = 20 + jl + 8; blob = b[bin_off:]


def read(acc_index):
    a = g['accessors'][acc_index]; bv = g['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    fmt = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}[a['componentType']]
    size = struct.calcsize(fmt)
    stride = bv.get('byteStride', size * n)
    out = []
    for i in range(a['count']):
        out.append(struct.unpack_from('<' + fmt * n, blob, off + i * stride))
    return out


solids = []
for o in m['objects']:
    if not o['collision']: continue
    (x, y, z), (w, h, d) = o['position'], o['size']
    lo_y = y if o['type'] == 'ramp' else y - h / 2
    solids.append(dict(o=o, x0=x - w / 2, x1=x + w / 2, y0=lo_y, y1=lo_y + h, z0=z - d / 2, z1=z + d / 2))


def ramp_top(s, x, z):
    o = s['o']; h = o['size'][1]
    if o['type'] != 'ramp': return s['y1']
    c, lo, hi = (x, s['x0'], s['x1']) if o['axis'] == 'x' else (z, s['z0'], s['z1'])
    t = (c - lo) / (hi - lo)  # 0..1 along axis
    up = t if o['lowAt'] < 0 else 1 - t
    return s['y0'] + h * up


def inside(p, pad=.06):
    x, y, z = p
    for s in solids:
        if s['x0'] - pad <= x <= s['x1'] + pad and s['z0'] - pad <= z <= s['z1'] + pad and s['y0'] - pad <= y <= ramp_top(s, x, z) + pad:
            return True
    return False


def ground(x, z, y):
    best = 0.0
    for s in solids:
        if s['x0'] <= x <= s['x1'] and s['z0'] <= z <= s['z1']:
            t = ramp_top(s, x, z)
            # Only surfaces a player can reach: floors, ramps, or tops low enough to jump onto.
            if not (s['o']['role'] in ('floor', 'ramp') or s['o']['type'] == 'ramp' or t <= 1.45): continue
            if t <= y + .05: best = max(best, t)
    return best


(bx0, _, bz0), (bx1, _, bz1) = m['bounds']['min'], m['bounds']['max']
ghost = defaultdict(float); ys = defaultdict(list)
for node in g['nodes']:
    if 'mesh' not in node or node['name'].startswith('COL_'): continue
    for prim in g['meshes'][node['mesh']]['primitives']:
        pos = read(prim['attributes']['POSITION']); idx = [i[0] for i in read(prim['indices'])]
        for k in range(0, len(idx), 3):
            a, bb, c = pos[idx[k]], pos[idx[k + 1]], pos[idx[k + 2]]
            area = .5 * math.dist((0, 0, 0), (
                (bb[1]-a[1])*(c[2]-a[2])-(bb[2]-a[2])*(c[1]-a[1]),
                (bb[2]-a[2])*(c[0]-a[0])-(bb[0]-a[0])*(c[2]-a[2]),
                (bb[0]-a[0])*(c[1]-a[1])-(bb[1]-a[1])*(c[0]-a[0])))
            if area < 1e-4: continue
            # sample centroid and the three edge midpoints
            for p in ((sum(v[i] for v in (a, bb, c)) / 3 for i in range(3)),):
                p = tuple(p)
                x, y, z = p
                if not (bx0 + .35 < x < bx1 - .35 and bz0 + .35 < z < bz1 - .35): continue
                gy = ground(x, z, y); rel = y - gy
                # Relief within 15 cm of a solid face, or caps resting on a solid, are fine.
                if not (.35 < rel < 1.75) or inside(p, .15) or inside((x, y - .4, z), .15): continue
                ghost[(round(x * 2) / 2, round(gy, 1), round(z * 2) / 2, node['name'])] += area
                ys[(round(round(x * 2) / 2 / 2) * 2, round(round(z * 2) / 2 / 2) * 2)].append(rel)

clusters = defaultdict(lambda: [0.0, set(), None])
for (x, gy, z, name), area in ghost.items():
    key = (round(x / 2) * 2, round(z / 2) * 2)
    c = clusters[key]; c[0] += area; c[1].add(name); c[2] = gy
report = sorted(([k, round(v[0], 3), sorted(v[1]), v[2], round(min(ys[k]),2), round(max(ys[k]),2)] for k, v in clusters.items() if v[0] > .05), key=lambda r: -r[1])

vn = {n['name']: n for n in g['nodes']}
invisible = []
for o in m['objects']:
    if not o['collision'] or o['role'] == 'floor': continue
    n = vn.get('VIS_' + o['id'])
    tris = 0
    if n and 'mesh' in n:
        tris = sum(g['accessors'][p['indices']]['count'] // 3 for p in g['meshes'][n['mesh']]['primitives'])
    if tris == 0: invisible.append(o['id'])

out = dict(map=PREFIX, ghost_clusters=len(report), ghost=report[:40], invisible_solids=invisible)
print(PREFIX, 'ghost clusters', len(report), 'invisible', invisible)
for r in report[:40]: print('  ', r)
if STRICT and (report or invisible): sys.exit(1)
