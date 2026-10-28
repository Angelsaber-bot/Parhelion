#!/usr/bin/env python3
"""Read-only Arena production artifact checks, no HTTP/browser claim."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import re,json,hashlib,sys
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent;DIST=ROOT/'arena-game/dist'
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='script' and 'src'in a:self.links.append(a['src'])
  if tag=='link' and a.get('rel')in('stylesheet','modulepreload','icon')and'href'in a:self.links.append(a['href'])
fails=[];refs=[];p=Links();p.feed((DIST/'index.html').read_text())
for link in p.links:
 url=urlsplit(link)
 if url.scheme or url.netloc or link.startswith('data:'):continue
 if link.startswith('/'):fails.append('non-relative index asset: '+link)
 local=DIST/url.path.lstrip('/');refs.append(str(local.relative_to(ROOT)))
 if not local.is_file():fails.append('missing index asset: '+link)
for js in (DIST/'assets').glob('*.js'):
 for ref in re.findall(r'''["'`]((?:\./)?(?:assets/)?[A-Za-z0-9_.-]+\.(?:glb(?:\.gz)?|gz|png|jpg|webp|json))["'`]''',js.read_text()):
  local=DIST/ref if ref.startswith(('./assets/','assets/')) else js.parent/ref
  refs.append(str(local.relative_to(ROOT)))
  if not local.is_file():fails.append('missing chunk asset: '+ref)
source=ROOT/'arena-maps/blackflag/assets/blackflag_visual.glb'
assets=list((DIST/'assets').glob('blackflag_visual-*.glb'))
if len(assets)!=1 or assets[0].read_bytes()!=source.read_bytes():fails.append('built Blackflag GLB is missing, duplicated or stale')
report={'scope':'Static Arena production artifact identity and relative asset routing; not HTTP/browser validation','failures':fails,'indexReferences':len(p.links),'assetReferences':len(set(refs)),'builtFiles':sum(p.is_file() for p in DIST.rglob('*')),'sourceVisualSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'builtVisualAssets':[str(p.relative_to(ROOT)) for p in assets]}
(OUT/'build-artifacts.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));sys.exit(bool(fails))
