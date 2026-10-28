"""Checks a map's exported GLBs against its runtime/map.json.
Usage: python3 _lib/check_glb.py <map dir> <asset prefix>   e.g. sakura sakura

- every map object has a VIS_ node; every collision object has a COL_ node
- each COL_ node's bounds equal the object's collision box exactly
- each VIS_ node stays inside its object's box (art never sticks out of what you collide with)
- legacy/proxy materials are factor-only; opted-in new chapter textures must be embedded with UVs
- budget: 60k triangles, 4MB geometry/JSON (textured chapters: 110k / 9MB), plus <=1MB embedded surface textures
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
    check(all('uri' not in b for b in g['buffers']), 'no external buffers')
    textured = bool(m.get('artPipeline', {}).get('embeddedMaterialTextures')) and g is vis
    if textured:
        for im in g.get('images', []):
            check('uri' not in im and im.get('mimeType') in ('image/png','image/jpeg') and isinstance(im.get('bufferView'), int) and 0 <= im['bufferView'] < len(g['bufferViews']), 'texture image is embedded')
        for me in g['meshes']:
            for p in me['primitives']:
                material = g['materials'][p['material']]
                pbr = material.get('pbrMetallicRoughness', {})
                if any(k in pbr for k in ('baseColorTexture','metallicRoughnessTexture')) or 'normalTexture' in material:
                    check('TEXCOORD_0' in p['attributes'], 'textured primitive has UVs')
                    if 'TEXCOORD_0' in p['attributes']:
                        check(g['accessors'][p['attributes']['TEXCOORD_0']]['count'] == g['accessors'][p['attributes']['POSITION']]['count'], 'UV vertex count matches')
    else:
        check('images' not in g and 'textures' not in g, 'legacy/proxy remains factor-only')
check(all(n['extras'].get('decorative') for n in vis['nodes'] if n['name'].startswith('DETAIL_')), 'detail batches are decorative')
texture_bytes = sum(vis['bufferViews'][im['bufferView']]['byteLength'] for im in vis.get('images', []) if 'bufferView' in im)
# Legacy maps keep the established geometry budget. The three textured chapter maps
# (2026-10-28 polish pass) may use up to 110k triangles / 9MB of flat-shaded geometry:
# still a single static, material-batched scene well inside desktop GPU limits and the
# 25 MiB Pages file cap. Embedded surface images (<=1MB) are counted separately.
chapter = bool(m.get('artPipeline', {}).get('embeddedMaterialTextures'))
max_tris, max_geo = (110_000, 9_000_000) if chapter else (60_000, 4_000_000)
check(tris < max_tris and vis_bytes - texture_bytes < max_geo and texture_bytes < 1_000_000,
      f'budget: {tris} triangles, {vis_bytes - texture_bytes} geometry/json bytes, {texture_bytes} texture bytes')
report = dict(mapId=m['mapId'], version=m['version'], checks=checks, failed=fails, visualNodes=len(vis['nodes']),
              visualTriangles=tris, visualBytes=vis_bytes, embeddedTextureBytes=texture_bytes,
              collisionNodes=len(col['nodes']), collisionBytes=col_bytes)
(ROOT / 'validation/glb_report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
sys.exit(1 if fails else 0)
