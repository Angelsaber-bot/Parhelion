#!/usr/bin/env python3
"""Serve final game outputs read-only under one-origin /arena/ and /world/ and audit local HTTP routes.
This intentionally does not create, replace or claim verification of a production homepage.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from urllib.request import Request,urlopen
from urllib.parse import urlsplit,unquote,quote
import threading,json,sys,hashlib
ROOT=Path(__file__).resolve().parents[2]
mounts={'arena':ROOT/'arena-game/dist','world':ROOT/'world/dist'}
class Handler(SimpleHTTPRequestHandler):
    def translate_path(self,path):
        parts=unquote(urlsplit(path).path).lstrip('/').split('/',1)
        if parts[0] not in mounts:return str(ROOT/'docs/chapter-qa/not-a-homepage')
        base=mounts[parts[0]];target=(base/(parts[1] if len(parts)>1 else '')).resolve()
        return str(target) if target==base or base in target.parents else str(ROOT/'docs/chapter-qa/not-a-homepage')
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
base=f'http://127.0.0.1:{server.server_port}';rows=[];failures=[]
try:
    for mount,directory in mounts.items():
        files=[p for p in directory.rglob('*') if p.is_file()]
        if not files:failures.append(f'{mount}: build missing');continue
        with urlopen(base+'/'+mount+'/',timeout=5)as response:
            if response.read()!=(directory/'index.html').read_bytes():failures.append(f'{mount}: entrypoint mismatch')
        for file in files:
            url=base+'/'+mount+'/'+quote(file.relative_to(directory).as_posix())
            try:
                with urlopen(Request(url,method='HEAD'),timeout=5)as response:
                    if response.status!=200 or int(response.headers['Content-Length'])!=file.stat().st_size:failures.append(f'{mount}: size/status {file.name}')
            except Exception as error:failures.append(f'{url}: {error}')
        rows.append({'mount':'/'+mount+'/','entrypointBytesMatch':True,'filesAvailableOverHTTP':len(files)})
finally:server.shutdown();server.server_close();thread.join()
print(json.dumps({'kind':'local-one-origin-game-mounts','results':rows,'failures':failures,'notVerified':['current production homepage/build source','browser runtime/WebGL','deployed Cloudflare Worker','GPU performance']},indent=2))
sys.exit(bool(failures))
