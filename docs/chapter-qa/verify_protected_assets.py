#!/usr/bin/env python3
"""Independent, read-only protected asset and local asset-reference verification.
Run from any directory. JSON result is printed; nonzero exit means regression.
"""
from pathlib import Path
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[2]
baseline=json.loads((ROOT/'docs/chapter-qa/protected-baseline.json').read_text())
failures=[]
for name,want in baseline['files'].items():
    path=ROOT/name
    actual=hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    if actual!=want: failures.append({'kind':'protected-file-changed','path':name,'expected':want,'actual':actual})
asset_refs=[]
for directory in ('world/src','arena-game/src'):
    for path in (ROOT/directory).rglob('*.ts'):
        source=path.read_text()
        refs=re.findall(r"new URL\(['\"]([^'\"]+)['\"],\s*import\.meta\.url\)",source)
        refs+=re.findall(r"(?:from\s*|import\s*)['\"]([^'\"]+\.(?:glb|glb\.gz|png|jpg|webp|json)(?:\?url)?)['\"]",source)
        for ref in refs:
            if not ref.startswith('.'): continue
            local=(path.parent/ref.split('?')[0]).resolve()
            asset_refs.append({'source':str(path.relative_to(ROOT)),'reference':ref,'exists':local.is_file()})
            if not local.is_file(): failures.append({'kind':'missing-source-asset','source':str(path.relative_to(ROOT)),'reference':ref})
result={'baselineCommit':baseline['baselineCommit'],'protectedFilesChecked':len(baseline['files']),'localAssetReferencesChecked':len(asset_refs),'failures':failures}
print(json.dumps(result,indent=2))
sys.exit(bool(failures))
