#!/usr/bin/env python3
"""Read-only final Blackflag polish QA; writes only its own JSON evidence.
This is structural/source/asset verification, not browser gameplay or GPU benchmarking.
"""
from pathlib import Path
import hashlib,io,json,struct,sys,os
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
BASE=json.loads((OUT/'protected-baseline.json').read_text())
BASE_ROOT=Path(os.environ.get('QA_BASELINE_ROOT',BASE['baselineRoot']))
IGNORE={'node_modules','dist','.git','.wrangler','__pycache__'}
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def inventory(root):
 return {str(p.relative_to(root)):sha(p) for p in root.rglob('*') if p.is_file() and not any(x in IGNORE for x in p.parts) and p.relative_to(root).parts[0]!='docs'}
failures=[]
for name,want in BASE['files'].items():
 p=ROOT/name;got=sha(p) if p.is_file() else None
 if got!=want:failures.append({'kind':'protected-changed','path':name,'expected':want,'actual':got})
before=inventory(BASE_ROOT);after=inventory(ROOT)
changed=[p for p in sorted(set(before)|set(after)) if before.get(p)!=after.get(p)]
(OUT/'diff-manifest.json').write_text(json.dumps({'baselineLabel':BASE['baselineLabel'],'scope':'Non-doc source/resource changes only; docs evidence listed separately','files':[{'path':name,'status':'new' if name not in before else 'deleted' if name not in after else 'modified','baselineSha256':before.get(name),'candidateSha256':after.get(name),'bytes':(ROOT/name).stat().st_size if (ROOT/name).is_file() else 0}for name in changed]},indent=2)+'\n')
allowed_exact={'arena-game/src/scene.ts','arena-game/src/blackflagPresentation.ts','arena-game/test/blackflag-presentation.test.ts','arena-game/src/assets/maps/blackflag.webp','arena-maps/chapter-preview-sources.json'}
for name in changed:
 if not(name.startswith('arena-maps/blackflag/') or name in allowed_exact):failures.append({'kind':'out-of-scope-change','path':name})
provenance='arena-maps/chapter-preview-sources.json'
old_entries=json.loads((BASE_ROOT/provenance).read_text());new_entries=json.loads((ROOT/provenance).read_text())
if [x for x in old_entries if x['map']!='blackflag'] != [x for x in new_entries if x['map']!='blackflag']:failures.append({'kind':'other-map-preview-provenance-changed'})
thumb=Image.open(ROOT/'arena-game/src/assets/maps/blackflag.webp')
if thumb.size!=(640,427) or thumb.format!='WEBP':failures.append({'kind':'thumbnail-format-dimensions'})
asset=ROOT/'arena-maps/blackflag/assets/blackflag_visual.glb';raw=asset.read_bytes()
magic,version,length=struct.unpack_from('<III',raw);assert magic==0x46546c67 and version==2 and length==len(raw)
jl,jtype=struct.unpack_from('<II',raw,12);assert jtype==0x4e4f534a
g=json.loads(raw[20:20+jl]);bl,btype=struct.unpack_from('<II',raw,20+jl);assert btype==0x004e4942
blob=raw[28+jl:];assert bl==len(blob)
textures=[]
for im in g.get('images',[]):
 if 'uri' in im:failures.append({'kind':'external-image','name':im.get('name')});continue
 v=g['bufferViews'][im['bufferView']];data=blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
 image=Image.open(io.BytesIO(data));image.load()
 textures.append({'name':im.get('name'),'width':image.width,'height':image.height,'mode':image.mode,'encodedBytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'pixelExtrema':image.getextrema()})
 if image.width>1024 or image.height>1024:failures.append({'kind':'image-size-budget','name':im.get('name')})
 if not all(n>0 and n&(n-1)==0 for n in image.size):failures.append({'kind':'image-non-power-two','name':im.get('name')})
triangles=sum(g['accessors'][p['indices']]['count']//3 for me in g['meshes'] for p in me['primitives'])
primitives=sum(len(me['primitives']) for me in g['meshes'])
if triangles>=50000:failures.append({'kind':'triangle-budget','actual':triangles,'limitExclusive':50000})
if len(raw)>=4_000_000:failures.append({'kind':'glb-byte-budget','actual':len(raw),'limitExclusive':4_000_000})
if primitives>160:failures.append({'kind':'primitive-budget','actual':primitives,'limitInclusive':160})
lights=len(g.get('extensions',{}).get('KHR_lights_punctual',{}).get('lights',[]))
if lights:failures.append({'kind':'embedded-lights','actual':lights})
for m in g['materials']:
 if m.get('alphaMode','OPAQUE')!='OPAQUE':failures.append({'kind':'alpha-pass','material':m.get('name')})
for buffer in g['buffers']:
 if 'uri' in buffer:failures.append({'kind':'external-buffer'})
report={'baselineLabel':BASE['baselineLabel'],'protectedFilesChecked':len(BASE['files']),'failures':failures,'changedNonDocsFiles':changed,'visualSha256':sha(asset),'visualBytes':len(raw),'triangles':triangles,'nodes':len(g['nodes']),'materialPrimitives':primitives,'baselineMaterialPrimitives':126,'primitiveBudget':{'previousCap':128,'approvedLocalCap':160,'rationale':'Explicit selective-shadow groups and richer ship craft; parent approved documented local budget. No GPU/FPS improvement claim.'},'materials':len(g['materials']),'embeddedLights':lights,'textures':textures,'encodedTextureBytes':sum(t['encodedBytes'] for t in textures),'limits':'Independent structural and identity QA only. No browser/WebGL compilation, gameplay capture, live networking, GPU FPS or PvP balance claim.'}
(OUT/'candidate-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='textures'},indent=2))
sys.exit(bool(failures))
