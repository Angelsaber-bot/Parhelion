#!/usr/bin/env python3
"""Run the real Arena suite, both TypeScript projects, and production build."""
from pathlib import Path
import subprocess,json,hashlib,time
root=Path(__file__).resolve().parents[2];out=Path(__file__).resolve().parent;game=root/'arena-game'
def inputs():
 paths=[p for p in game.rglob('*') if p.is_file() and not any(x in {'node_modules','dist'} for x in p.relative_to(game).parts)]
 paths+=list((root/'arena-maps/blackflag/assets').rglob('*'));paths+=[root/'arena-maps/blackflag/runtime/map.json',root/'arena-maps/blackflag/source/build.py',root/'arena-maps/blackflag/source/surfaces.py',root/'arena-maps/blackflag/validation/check_art.py']
 return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()}
before=inputs();(out/'checked-inputs.json').write_text(json.dumps(before,indent=2)+'\n');results={}
for name,args in [('arena-tests',['npm','test']),('arena-typecheck',['npm','run','typecheck']),('arena-build',['npm','run','build'])]:
 start=time.time()
 with (out/'logs'/f'{name}.log').open('w') as log:r=subprocess.run(args,cwd=game,stdout=log,stderr=subprocess.STDOUT)
 results[name]={'exitCode':r.returncode,'seconds':round(time.time()-start,2)}
 (out/'check-exits.json').write_text(json.dumps(results,indent=2)+'\n');print(name,results[name],flush=True)
after=inputs();changes=[p for p in set(before)|set(after) if before.get(p)!=after.get(p)]
(out/'input-stability.json').write_text(json.dumps({'filesChecked':len(before),'changedDuringChecks':changes},indent=2)+'\n')
print('input changes',changes)
raise SystemExit(bool(changes) or any(x['exitCode']!=0 for x in results.values()))
