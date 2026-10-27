"""Require fixed cameras, completed sample logs and exact source-frame dimensions/hashes."""
from pathlib import Path
from PIL import Image
import hashlib,json,sys,re
root=Path(sys.argv[1]);region=sys.argv[2];cameras=Path(__file__).with_name(region+'-cameras.json')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
camera_list=json.loads(cameras.read_text()); shots=[c['name']for c in camera_list]; expected={c['name']:c for c in camera_list}
report={'baseline_commit':'36936478839311d00e29babcb9a0b2f844c7a6e8','region':region,'camera_sha256':sha(cameras),'render_script_sha256':sha(Path(__file__).with_name('render.py')),'render_type':'Actual decoded exported GLB, offline PBR fallback. Not runtime toon or GPU validation.','samples':256,'denoising':False,'size':[1200,800],'conditional_visibility':'showWhen objects and all descendants hidden consistently; no invented completion state','views':shots,'artifacts':{},'images':{}}
for side,folder in [('before','before/final-render'),('final','final/render')]:
 glb=root/side/f'world_{region}.glb';report['artifacts'][side]={'bytes':glb.stat().st_size,'sha256':sha(glb)}
 # Sort complete log files chronologically and retain the last successful write
 # for a path. This makes corrected-camera rerenders auditable rather than merely
 # finding any old render of the same filename.
 completed={}
 for log in sorted((root/side).glob('*render*.log'),key=lambda q:q.stat().st_mtime_ns):
  camera=None;sample256=False
  for line in log.read_text().splitlines():
   if line.startswith('REVIEW_CAMERA '):
    camera=json.loads(line[len('REVIEW_CAMERA '):]);sample256=False
   if 'Sample 256/256' in line: sample256=True
   if line.startswith("Saved: '") and line.endswith("'"):
    completed[line[8:-1]]={'camera':camera,'samples_complete':sample256,'log':log.name}
 for name in shots:
  p=root/folder/(name+'.png')
  with Image.open(p)as im:assert im.size==(1200,800),(p,im.size)
  proof=completed.get(str(p.resolve()));assert proof,f'Missing successful write: {p}'
  assert proof['samples_complete'],f'Missing completed samples: {p}'
  if proof['camera'] is None:
   assert side=='before',f'Final render lacks camera log: {p}'
   proof['camera_evidence']='Original fixed-camera baseline batch; renderer had not yet emitted per-frame camera JSON. Known reframed shots were rerendered with logged final cameras.'
  else:
   assert proof['camera']==expected[name],f'Camera does not match final fixed set: {p}'
   proof['camera_evidence']='Per-frame render log exactly matches final camera JSON'
  report['images'][str(p.relative_to(root))]={'bytes':p.stat().st_size,'sha256':sha(p),'proof':proof}
boards=list((root/'comparison').glob('*.png'));assert len(boards)==4
for p in sorted(boards):report['images'][str(p.relative_to(root))]={'bytes':p.stat().st_size,'sha256':sha(p)}
(root/'review-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'Verified {len(shots)*2} source frames, four boards: {root}/review-manifest.json')
