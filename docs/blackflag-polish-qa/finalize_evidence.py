#!/usr/bin/env python3
"""Verify render identity, refresh authorized Blackflag previews, compose comparisons."""
from pathlib import Path
import hashlib,json,shutil
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2];QA=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
asset=ROOT/'arena-maps/blackflag/assets/blackflag_visual.glb';current=sha(asset)
limits='Neutral offline actual-GLB geometry/material inspection only. Not browser/gameplay/FPS evidence. Runtime Three.js PBR hook, selective shadow policy, sky, fog, fill light, particles and postprocessing are not reproduced.'
manifests={}
for stage in ('before','after'):
 p=QA/stage/'render-manifest.json';items=json.loads(p.read_text())
 for item in items:
  image=QA/stage/f"blackflag-{item['view']}.png"
  assert item['sourceStillMatches'] and item['imageSha256']==sha(image)
  assert item['samples']==64 and item['resolution']==[1296,864] and item['lighting']=='neutral'
  if stage=='after':assert item['sha256']==current
  item['output']=str(image.relative_to(ROOT));item['limitations']=limits
 p.write_text(json.dumps(items,indent=2)+'\n');manifests[stage]={x['view']:x for x in items}
assert set(manifests['after'])=={'overview','lane','rigging','deck','cannon','cannon-front','stern'}
assert set(manifests['before'])=={'overview','lane'}
canonical=ROOT/'arena-maps/blackflag/previews';canonical_entries=[]
for view,jpg in [('overview','01-overview.jpg'),('lane','02-lane.jpg')]:
 src=QA/'after'/f'blackflag-{view}.png';dst=canonical/src.name;shutil.copy2(src,dst)
 Image.open(src).convert('RGB').save(canonical/jpg,quality=92,optimize=True)
 entry=dict(manifests['after'][view]);entry['output']=str(dst.relative_to(ROOT));entry['imageSha256']=sha(dst);entry['artRevision']='2026-10-28-blackflag-polish';canonical_entries.append(entry)
(canonical/'render-manifest.json').write_text(json.dumps(canonical_entries,indent=2)+'\n')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',28)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',23)
comparisons=[]
for view in ('overview','lane'):
 b=manifests['before'][view];a=manifests['after'][view]
 for key in ('camera','target','samples','lighting','orthographicScale','resolution','lensMm'):assert b[key]==a[key],(view,key)
 before=Image.open(ROOT/b['output']).convert('RGB');after=Image.open(ROOT/a['output']).convert('RGB')
 board=Image.new('RGB',(2592,956),(24,31,40));draw=ImageDraw.Draw(board)
 draw.text((24,14),'BEFORE - frozen published baseline',font=font,fill=(233,237,242));draw.text((1320,14),'AFTER - Blackflag polish',font=font,fill=(233,237,242))
 board.paste(before,(0,56));board.paste(after,(1296,56))
 draw.text((24,928),'Same camera / neutral Blender CPU / 64 samples. Model and material comparison, not in-game lighting or FPS evidence.',font=small,fill=(207,216,224))
 output=QA/f'comparison-{view}.jpg';board.save(output,quality=92,optimize=True)
 comparisons.append({'view':view,'output':str(output.relative_to(ROOT)),'sha256':sha(output),'before':b,'after':a,'composition':'No retouching or relighting; original rendered PNGs retained separately. Side-by-side labels and JPEG encoding only.'})
(QA/'comparison-manifest.json').write_text(json.dumps(comparisons,indent=2)+'\n')
print('Verified seven final PNGs, two matched comparisons, refreshed canonical PNG/JPG previews.')
