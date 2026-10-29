"""Byte audit: all non-test/non-doc production files outside the explicit motion allowlist."""
import hashlib,json,sys
from pathlib import Path
base,current,out=map(Path,sys.argv[1:4]);base=base.resolve();current=current.resolve()
allow={
 'arena-game/src/characterMotion.ts','arena-game/src/fighter.ts','arena-game/src/scene.ts',
 'world/src/mountedCharge.ts','world/src/skinnedCharacter.ts','world/src/playerLocomotion.ts','world/src/playerEquipment.ts','world/src/servant.ts','world/src/kitCompanion.ts',
 'world/src/characters/actionBlend.ts','world/src/characters/characterKit.ts','world/src/characters/companionMotion.ts','world/src/characters/musashiLocomotion.ts','world/src/characters/mountedChargeMotion.ts',
}
exclude={'node_modules','dist','__pycache__','.git','docs','validation','test'}
def files(root):return {p.relative_to(root).as_posix():p for p in root.rglob('*')if p.is_file()and not any(v in exclude for v in p.relative_to(root).parts)}
a,b=files(base),files(current)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()if p else None
rows=[{'path':p,'before':sha(a.get(p)),'after':sha(b.get(p)),'motionAllowlisted':p in allow}for p in sorted(a.keys()|b.keys())]
changed=[r for r in rows if r['before']!=r['after']]
violations=[r for r in changed if not r['motionAllowlisted']]
report={'baseline':str(base),'candidate':str(current),'scope':'Every non-doc/non-test production file; excludes dependencies, generated dist and Python caches. Hash byte equality does not imply browser/visual/FPS QA. Allowlisted Arena scene changes require separate hunk review.','checked':len(rows),'protectedChecked':sum(not r['motionAllowlisted']for r in rows),'protectedIdentical':sum(not r['motionAllowlisted']and r['before']==r['after']for r in rows),'unexpectedChanges':violations,'changed':changed,'files':rows}
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items()if k!='files'},indent=2));raise SystemExit(bool(violations))
