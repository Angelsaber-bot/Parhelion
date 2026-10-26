"""Checks a map's exported GLBs against its runtime/map.json.
Usage: python3 _lib/check_glb.py <map dir> <asset prefix>   e.g. sakura sakura

- every map object has a VIS_ node; every collision object has a COL_ node
- each COL_ node's bounds equal the object's collision box exactly
- each VIS_ node stays inside its object's box (art never sticks out of what you collide with)
- materials are factor-only (no textures, no external URIs); budget for triangles and size
"""
from pathlib import Path
import json, struct, sys

ROOT = Path(sys.argv[1]).resolve()
PREFIX = sys.argv[2]
m = json.loads((ROOT / 'runtime/map.json').read_text())


def load(p):
    b = p.read_bytes()
    assert b[:4] == b'glTF', p
    jl = struct.unpack('<I', b[12:16])[0]
    return json.loads(b[20:20 + jl]), len(b)


def node_bounds(g, node):
    lo, hi = [1e9] * 3, [-1e9] * 3
    for prim in g['meshes'][node['mesh']]['primitives']:
        a = g['accessors'][prim['attributes']['POSITION']]
        lo = [min(lo[i], a['min'][i]) for i in range(3)]; hi = [max(hi[i], a['max'][i]) for i in range(3)]
    return lo, hi


def obj_box(o):
    (x, y, z), (w, h, d) = o['position'], o['size']
    if o['type'] == 'ramp':
        return [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2]
    return [x - w / 2, y - h / 2, z - d / 2], [x + w / 2, y + h / 2, z + d / 2]


fails, checks = [], 0
def check(ok, msg):
    global checks
    checks += 1
    if not ok:
        fails.append(msg)

vis, vis_bytes = load(ROOT / ('assets/' + PREFIX + '_visual.glb'))
col, col_bytes = load(ROOT / ('assets/' + PREFIX + '_collision.glb'))
vn = {n['name']: n for n in vis['nodes']}; cn = {n['name']: n for n in col['nodes']}
tris = sum(vis['accessors'][p['indices']]['count'] // 3 for me in vis['meshes'] for p in me['primitives'])
for o in m['objects']:
    lo, hi = obj_box(o)
    n = vn.get('VIS_' + o['id'])
    check(n is not None, f'missing VIS_{o["id"]}')
    if n:
        a, b = node_bounds(vis, n)
        check(all(a[i] >= lo[i] - 1e-4 and b[i] <= hi[i] + 1e-4 for i in range(3)), f'VIS_{o["id"]} outside its box {a} {b} vs {lo} {hi}')
        check(n['extras'].get('decorative') is False and n['extras'].get('source_id') == o['id'], f'VIS_{o["id"]} extras')
    if o['collision']:
        c = cn.get('COL_' + o['id'])
        check(c is not None, f'missing COL_{o["id"]}')
        if c:
            a, b = node_bounds(col, c)
            check(all(abs(a[i] - lo[i]) < 1e-4 and abs(b[i] - hi[i]) < 1e-4 for i in range(3)), f'COL_{o["id"]} bounds {a} {b} vs {lo} {hi}')
check(len(cn) == sum(o['collision'] for o in m['objects']), 'collision node count')
for g in (vis, col):
    check('images' not in g and 'textures' not in g and all('uri' not in b for b in g['buffers']), 'no textures or external buffers')
check(all(n['extras'].get('decorative') for n in vis['nodes'] if n['name'].startswith('DETAIL_')), 'detail batches are decorative')
check(tris < 60000 and vis_bytes < 4_000_000, f'budget: {tris} triangles, {vis_bytes} bytes')
report = dict(mapId=m['mapId'], version=m['version'], checks=checks, failed=fails, visualNodes=len(vis['nodes']),
              visualTriangles=tris, visualBytes=vis_bytes, collisionNodes=len(col['nodes']), collisionBytes=col_bytes)
(ROOT / 'validation/glb_report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
sys.exit(1 if fails else 0)
