"""BLACKFLAG final authored-art invariants; complements the shared proxy checker."""
from pathlib import Path
import hashlib,io,json,math,struct,subprocess,sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
b=(ROOT/'assets/blackflag_visual.glb').read_bytes();jl=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+jl]);blob=b[28+jl:]
data=json.loads((ROOT/'runtime/map.json').read_text())
fails=[];checks=0
def check(ok,message):
    global checks
    checks+=1
    if not ok:fails.append(message)
keys=['objects','anchors','routes','bounds','player']
physics=hashlib.sha256(json.dumps({k:data[k] for k in keys},sort_keys=True,separators=(',',':')).encode()).hexdigest()
check(physics=='48c6ec6560269764fb0837aeeabd4358be958a3d816d0952b961fc36a9eb3fd6','Approved 2026-10-28 cover/perimeter layout is unchanged')
collision=hashlib.sha256((ROOT/'assets/blackflag_collision.glb').read_bytes()).hexdigest()
check(collision=='cf9471555c918843b43065bb751d2a616c780e94bb2cda908ca7f310d18ff6e8','Cover/perimeter collision GLB matches approved layout')
textures=[]
for im in g.get('images',[]):
    v=g['bufferViews'][im['bufferView']];raw=blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
    image=Image.open(io.BytesIO(raw));image.load()
    check(image.mode in ('RGB','RGBA'),'image colour mode')
    check(all(n>0 and n&(n-1)==0 for n in image.size),'power-of-two dimensions support mipmaps')
    check(max(image.size)<=1024,'texture size budget')
    textures.append(dict(name=im.get('name'),size=list(image.size),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()))
for s in g.get('samplers',[]):
    check(s.get('minFilter')==9987 and s.get('magFilter')==9729,'trilinear mipmap and linear magnification')
    check(s.get('wrapS')==10497 and s.get('wrapT')==10497,'repeat sampler')
for me in g['meshes']:
    for p in me['primitives']:
        if 'TEXCOORD_0' not in p['attributes']:continue
        a=g['accessors'][p['attributes']['TEXCOORD_0']];v=g['bufferViews'][a['bufferView']]
        vals=struct.unpack_from('<'+'f'*a['count']*2,blob,v.get('byteOffset',0)+a.get('byteOffset',0))
        check(all(math.isfinite(x) for x in vals),'finite UVs')
        if g['materials'][p['material']]['name']=='blackSail':check(min(vals)>=0 and max(vals)<=1,'heraldic sail uses dedicated unwrapped 0–1 UVs')
triangles=sum(g['accessors'][p['indices']]['count']//3 for me in g['meshes'] for p in me['primitives'])
primitives=sum(len(me['primitives']) for me in g['meshes'])
check(triangles<50000,'under 50k triangles');check(len(b)<4_000_000,'under 4MB total GLB');check(primitives<=160,'at most 160 material primitives: precise sail/gallery shadow groups and modeled period craft; no FPS claim')
check(not g.get('extensions',{}).get('KHR_lights_punctual'),'no embedded lights')
shadow_nodes={n['name']:n.get('extras',{}) for n in g['nodes'] if n['name'].startswith('DETAIL_')}
check(shadow_nodes.get('DETAIL_ship_sails',{}).get('castShadow') is True,'upper ship sails explicitly cast shadows')
check(shadow_nodes.get('DETAIL_ship_gallery',{}).get('castShadow') is True,'stern gallery explicitly casts shadows')
check(shadow_nodes.get('DETAIL_chapter_craft',{}).get('castShadow') is False,'sea and distant background never enter decorative shadow pass')
for me in g['meshes']:
    for p in me['primitives']:
        a=g['accessors'][p['attributes']['NORMAL']];v=g['bufferViews'][a['bufferView']]
        ns=struct.unpack_from('<'+'f'*a['count']*3,blob,v.get('byteOffset',0)+a.get('byteOffset',0))
        check(all(math.isfinite(x) for x in ns),'finite indexed smooth-spar normals')
        check(all(abs(sum(n*n for n in ns[i:i+3])-1)<1e-4 for i in range(0,len(ns),3)),'unit normals on indexed smooth-spar geometry')
check(all(m.get('alphaMode','OPAQUE')=='OPAQUE' for m in g['materials']),'no alpha sorting / extra transparency passes')
report=dict(checks=checks,failed=fails,physicsHash=physics,collisionSha256=collision,visualSha256=hashlib.sha256(b).hexdigest(),triangles=triangles,bytes=len(b),authoredMaterialPrimitives=primitives,embeddedLights=0,textures=textures,source='Original project-authored surfaces.py raster paintings. No external textures.',limits='Offline structural/material QA. Not browser frame rate, screenshot parity or human PvP balance.')
(ROOT/'validation/art_report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));sys.exit(bool(fails))
