"""Isolated, version/root-aware local viewer; never stops an occupied port."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import argparse,functools,threading,webbrowser,urllib.request,json,hashlib
ROOT=Path(__file__).resolve().parent
MAP=json.loads((ROOT/'runtime/map.json').read_text())
IDENTITY={'mapId':MAP['mapId'],'version':MAP['version'],'rootId':hashlib.sha256(str(ROOT).encode()).hexdigest()[:16]}
parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8744);parser.add_argument('--open',action='store_true');args=parser.parse_args()
url=f'http://127.0.0.1:{args.port}/runtime/'
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
    def do_GET(self):
        if self.path=='/arena-viewer.json':
            raw=json.dumps(IDENTITY).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
        else:super().do_GET()
try:server=ThreadingHTTPServer(('127.0.0.1',args.port),functools.partial(Handler,directory=str(ROOT)))
except OSError as e:
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{args.port}/arena-viewer.json',timeout=2) as response:existing=json.load(response)
        if existing==IDENTITY:
            if args.open:webbrowser.open(url)
            print('This Arena viewer is already running:',url);raise SystemExit(0)
    except (OSError,ValueError):pass
    raise SystemExit(f'Port {args.port} belongs to another viewer/process; nothing was stopped. Try --port {args.port+1}. {e}')
print('ASTER isolated map viewer:',url,flush=True)
if args.open:threading.Timer(.4,lambda:webbrowser.open(url)).start()
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
