#!/usr/bin/env python3
"""Final stale-artifact guard: require checks, build, thumbnails and renders to match."""
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[2];QA=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
current=sha(ROOT/'arena-maps/blackflag/assets/blackflag_visual.glb');fails=[]
def require(ok,message):
 if not ok:fails.append(message)
for name in ('after/render-manifest.json','../../arena-maps/blackflag/previews/render-manifest.json'):
 p=QA/name;items=json.loads(p.read_text())
 for x in items:
  require(x['sha256']==current,f'{name}:{x["view"]}: stale GLB')
  require(x['imageSha256']==sha(ROOT/x['output']),f'{name}:{x["view"]}: changed image')
  require(x['sourceStillMatches'] and x['lighting']=='neutral' and x['samples']==64 and x['resolution']==[1296,864],f'{name}:{x["view"]}: render settings')
for view in ('overview','lane'):
 require((QA/f'after/blackflag-{view}.png').read_bytes()==(ROOT/f'arena-maps/blackflag/previews/blackflag-{view}.png').read_bytes(),f'{view}: canonical preview differs')
checks=json.loads((QA/'checked-inputs.json').read_text())
for name,want in checks.items():require((ROOT/name).is_file() and sha(ROOT/name)==want,f'checked source changed: {name}')
for name in ('candidate-report.json','independent-art_report.json'):
 r=json.loads((QA/name).read_text());require(r['visualSha256']==current,f'{name}: stale visual identity')
exits=json.loads((QA/'check-exits.json').read_text());require(all(x['exitCode']==0 for x in exits.values()),'test/typecheck/build failure')
require(not json.loads((QA/'input-stability.json').read_text())['changedDuringChecks'],'source changed during checks')
b=json.loads((QA/'build-artifacts.json').read_text());require(b['sourceVisualSha256']==current and not b['failures'],'build report mismatch')
for name in b['builtVisualAssets']:require(sha(ROOT/name)==current,'built GLB changed')
provenance=json.loads((ROOT/'arena-maps/chapter-preview-sources.json').read_text())
x=next(x for x in provenance if x['map']=='blackflag')
require(x['assetSha256']==current,'thumbnail provenance stale asset')
require(x['thumbnailSha256']==sha(ROOT/x['thumbnail']),'thumbnail provenance stale output')
require(x['imageSha256']==sha(QA/'after/blackflag-overview.png'),'thumbnail provenance stale source PNG')
t=json.loads((QA/'thumbnail-derivation.json').read_text());require(t['assetSha256']==current and t['sourceSha256']==sha(QA/'after/blackflag-overview.png') and t['sha256']==sha(ROOT/t['output']),'thumbnail derivation mismatch')
for x in json.loads((QA/'comparison-manifest.json').read_text()):
 require(x['after']['sha256']==current,'comparison stale source GLB')
 require(x['sha256']==sha(ROOT/x['output']),'comparison image changed')
 require(x['after']['imageSha256']==sha(ROOT/x['after']['output']),'comparison stale after image')
 require(x['before']['imageSha256']==sha(ROOT/x['before']['output']),'comparison stale before image')
report={'scope':'Final source/check/build/render/thumbnail/comparison consistency, not browser verification','visualSha256':current,'checkedSourceFiles':len(checks),'failures':fails}
(QA/'final-evidence-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));sys.exit(bool(fails))
