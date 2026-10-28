#!/usr/bin/env python3
"""Static relative-base asset routing audit, not an HTTP/browser test."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import re,json,sys
ROOT=Path(__file__).resolve().parents[2]
class Links(HTMLParser):
    def __init__(self): super().__init__();self.links=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='script' and 'src' in attrs:self.links.append(attrs['src'])
        if tag=='link' and attrs.get('rel') in ('stylesheet','modulepreload','icon') and 'href' in attrs:self.links.append(attrs['href'])
results=[];failures=[]
for app in ('world','arena-game'):
    dist=ROOT/app/'dist';index=dist/'index.html'
    if not index.is_file():failures.append(f'{app}: missing built index');continue
    parser=Links();parser.feed(index.read_text());refs=[]
    for link in parser.links:
        url=urlsplit(link)
        if url.scheme or url.netloc or link.startswith('data:'):continue
        if link.startswith('/'):failures.append(f'{app}: non-relative index asset {link}')
        path=dist/url.path.lstrip('/');refs.append(str(path.relative_to(ROOT)))
        if not path.is_file():failures.append(f'{app}: missing index asset {link}')
    for js in (dist/'assets').glob('*.js'):
        text=js.read_text()
        # Vite's hashed URL imports use either ./file.ext relative to this chunk or ./assets/file.ext relative to document base.
        for ref in re.findall(r'''["'`]((?:\./)?(?:assets/)?[A-Za-z0-9_.-]+\.(?:glb(?:\.gz)?|gz|png|jpg|webp|json))["'`]''',text):
            path=(dist/ref) if ref.startswith(('./assets/','assets/')) else (js.parent/ref)
            refs.append(str(path.relative_to(ROOT)))
            if not path.is_file():failures.append(f'{app}: missing chunk asset {ref}')
    if app=='world':
        for asset in (ROOT/'world/public/assets').iterdir():
            built=dist/'assets'/asset.name
            if not built.is_file() or built.read_bytes()!=asset.read_bytes():failures.append(f'world: stale or missing public asset {asset.name}')
    results.append({'app':app,'relativeIndexAssetLinks':len(parser.links),'assetReferences':len(set(refs)),'builtFiles':sum(p.is_file() for p in dist.rglob('*'))})
print(json.dumps({'kind':'static-artifact-routing','results':results,'failures':failures,'notVerified':['current production homepage','HTTP transport','browser runtime','GPU performance']},indent=2))
sys.exit(bool(failures))
