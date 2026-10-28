"""Art-only contract: immutable gameplay, embedded materials and deterministic export."""
from pathlib import Path
import json,hashlib,struct,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
def sha(b):return hashlib.sha256(b).hexdigest()
def glb(p):
    b=p.read_bytes();return json.loads(b[20:20+struct.unpack('<I',b[12:16])[0]])
subprocess.run([sys.executable,str(ROOT.parent/'_lib/check_glb.py'),str(ROOT),'frostcourt'],check=True)
data=json.loads((ROOT/'runtime/map.json').read_text());baseline=json.loads((ROOT/'validation/layout-baseline.json').read_text())['sha256']
checks={}
for k in ['bounds','player','objects','anchors','routes']:
    checks[f'unchanged_{k}']=sha(json.dumps(data[k],sort_keys=True,separators=(',',':')).encode())==baseline[k]
checks['unchanged_collision_bytes']=sha((ROOT/'assets/frostcourt_collision.glb').read_bytes())==baseline['collisionGLB']
g=glb(ROOT/'assets/frostcourt_visual.glb');tris=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'])
checks['under_50k_triangles']=tris<50000
checks['batched_49_nodes']=len(g['nodes'])==49
checks['embedded_images']=len(g.get('images',[]))==18 and all('bufferView' in im and 'uri' not in im for im in g['images'])
textured=[m for m in g['materials'] if 'baseColorTexture' in m.get('pbrMetallicRoughness',{})]
checks['all_surface_channels_present']=len(textured)==18 and all('normalTexture' in m and 'occlusionTexture' in m and 'metallicRoughnessTexture' in m['pbrMetallicRoughness'] for m in textured)
checks['no_external_uris']=all('uri' not in b for b in g['buffers'])
manifest=json.loads((ROOT/'assets/materials/provenance.json').read_text())
checks['material_provenance_hashes']=all(sha((ROOT/'assets/materials'/name).read_bytes())==h for name,h in manifest['files'].items())
paths=[ROOT/'runtime/map.json',ROOT/'assets/frostcourt_visual.glb',ROOT/'assets/frostcourt_collision.glb']
before=[sha(p.read_bytes()) for p in paths]
subprocess.run([sys.executable,str(ROOT/'source/build.py')],check=True,stdout=subprocess.DEVNULL)
checks['deterministic_rebuild']=before==[sha(p.read_bytes()) for p in paths]
report=dict(checks=checks,passed=sum(checks.values()),failed=[k for k,v in checks.items() if not v],visualTriangles=tris,visualBytes=paths[1].stat().st_size,visualNodes=len(g['nodes']),materialPrimitives=sum(len(m['primitives']) for m in g['meshes']),texturedMaterials=len(textured),embeddedImages=len(g.get('images',[])),visualSha256=before[1],collisionSha256=before[2],limitations=['Offline GLB/material/layout verification, not browser or human PvP/GPU performance acceptance.'])
(ROOT/'validation/art_report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));sys.exit(bool(report['failed']))
