"""Verify fixed-view review inputs and record reproducible image/artifact hashes."""
from pathlib import Path
from PIL import Image
import hashlib, json, sys
root=Path(sys.argv[1]); cameras=Path(__file__).with_name('cameras.json')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
shots=[c['name'] for c in json.loads(cameras.read_text())]
report={'camera_sha256':sha(cameras),'render_script_sha256':sha(Path(__file__).with_name('render.py')),
 'render_type':'Actual decoded exported GLB / offline PBR fallback; not runtime toon or GPU validation',
 'lighting':{'cool_ambient_strength':.45,'warm_sun_energy':1.5,'exposure':-.35},
 'samples':256,'denoising':False,'views':shots,'artifacts':{},'images':{}}
for side,folder in [('before','before/final-render'),('final','final/render')]:
    glb=root/side/'world_winter.glb';report['artifacts'][side]={'bytes':glb.stat().st_size,'sha256':sha(glb)}
    logs='\n'.join(p.read_text() for p in (root/side).glob('*render*.log'))
    for name in shots:
        p=root/folder/(name+'.png')
        with Image.open(p) as im: assert im.size==(1200,800),(str(p),im.size)
        # Each successful write must follow a completed 256-sample frame in a captured renderer log.
        marker="Saved: '"+str(p)+"'"
        assert marker in logs, f'Missing successful renderer write: {p}'
        before=logs[:logs.index(marker)]
        assert 'Sample 256/256' in before.rsplit("Saved: '",1)[-1],f'Missing 256-sample completion: {p}'
        report['images'][str(p.relative_to(root))]={'bytes':p.stat().st_size,'sha256':sha(p)}
for p in sorted((root/'comparison').glob('*.png')):
    report['images'][str(p.relative_to(root))]={'bytes':p.stat().st_size,'sha256':sha(p)}
(root/'review-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print('Verified 32 fixed-view source renders; manifest:',root/'review-manifest.json')
