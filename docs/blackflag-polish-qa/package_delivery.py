#!/usr/bin/env python3
"""Create a hash-verified incremental cloud-only source/evidence ZIP, no publication."""
from pathlib import Path
import json,hashlib,zipfile
ROOT=Path(__file__).resolve().parents[2];QA=Path(__file__).resolve().parent
OUT=ROOT.parent/'blackflag-polish-delivery';OUT.mkdir(exist_ok=True)
audit=json.loads((QA/'final-evidence-audit.json').read_text());assert not audit['failures']
current=hashlib.sha256((ROOT/'arena-maps/blackflag/assets/blackflag_visual.glb').read_bytes()).hexdigest();assert current==audit['visualSha256']
diff=json.loads((QA/'diff-manifest.json').read_text());selected=set()
for entry in diff['files']:
 assert entry['status']!='deleted', 'Deletion requires explicit patch instructions'
 selected.add(entry['path'])
for p in QA.iterdir():
 if p.is_file() and p.name!='initial-protected-check.json':selected.add(str(p.relative_to(ROOT)))
for folder in ['before','after']:
 selected.update(str(p.relative_to(ROOT)) for p in (QA/folder).iterdir() if p.is_file())
logs=['arena-tests.log','arena-typecheck.log','arena-build.log','after-render.log','before-high-detail-render.log','cannon-review-render.log','shared-glb-check.log','authored-art-check.log','effects-audit-native.log','deterministic-rebuild-1.log','deterministic-rebuild-2.log','asset-identity-final.log','build-artifacts.log']
selected.update(str((QA/'logs'/name).relative_to(ROOT)) for name in logs)
assert all((ROOT/name).is_file() for name in selected)
assert not any('/node_modules/'in name or '/dist/'in name or '__pycache__'in name or 'polish-draft'in name for name in selected)
entries=[{'path':name,'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()}for name in sorted(selected)]
manifest={'baseline':'24b0f13 published full-map fix','finalVisualSha256':current,'kind':'incremental source/resources and offline QA evidence; not a deployed build','files':entries}
readme='''# 黑帆战舰精修 · 云端增量源码与验证包\n\n基线：已发布修复版24b0f13。请先备份原项目，再按本包相对目录核对需要替换的文件。本包不是完整项目，也不是已部署网站；不含依赖目录或构建产物，不会自动安装、启动、推送或发布。\n\n只改BLACKFLAG船体/桅帆/炮架/材质/独立氛围特效与相关预览、测试。完整地图碰撞、路线、共享规则、其他地图和World保持不变。\n\n阅读 docs/blackflag-polish-qa/QA_REPORT.md 查看完整检查、预算与限制；comparison-overview.jpg和comparison-lane.jpg是同镜头真实GLB前后对比；after/目录包含最终七张原始离线渲染。\n\n318项自动化测试、两个TypeScript项目、生产构建、449+446项资产检查、11文件连续重建、702文件保护指纹及最终产物一致性检查通过。\n\n限制：普通浏览器启动受本云环境socket权限限制；这些图片不是浏览器/游戏截图。未验证真实GPU/FPS、Safari、完整人工试玩或公网Worker；没有绕过沙箱、访问Mac、推送或部署。\n\n本次保留50k三角形/4MB模型上限；实际49,879三角形、3,507,008字节、141材质primitive。批次上限明确由128调整为160，没有宣称性能提升。\n\nBLACKFLAG_POLISH_MANIFEST.json列出每个交付文件的SHA256。原完整基线项目保留的其余文件不在此增量包重复携带。\n'''
zip_path=OUT/'Parhelion-Blackflag-Polish-20261028.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for entry in entries:z.write(ROOT/entry['path'],entry['path'])
 z.writestr('BLACKFLAG_POLISH_README_ZH.md',readme)
 z.writestr('BLACKFLAG_POLISH_MANIFEST.json',json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
with zipfile.ZipFile(zip_path)as z:
 assert z.testzip() is None
 for entry in entries:assert hashlib.sha256(z.read(entry['path'])).hexdigest()==entry['sha256']
report={'path':str(zip_path),'bytes':zip_path.stat().st_size,'sha256':hashlib.sha256(zip_path.read_bytes()).hexdigest(),'projectFiles':len(entries),'manifestFiles':2,'zipCRCVerified':True,'allEntrySha256Verified':True,'finalVisualSha256':current}
(OUT/'package-verification.json').write_text(json.dumps(report,indent=2)+'\n')
(OUT/'deliverable-file-list.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(report,indent=2))
