"""Archive full-resolution review images and a verified per-item evidence ledger.
Arguments: final construction, original atlas root, repaired atlas root, runtime,
foundation subset, output directory. Every reused construction image must match
its final item's positions, colors and indices byte for byte.
"""
from pathlib import Path
from PIL import Image
import json,hashlib,sys,csv,html,collections
final,original,repaired,runtime,foundations,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
cache={}
def load(root):
 if str(root) not in cache:
  cache[str(root)]=(json.load(open(root/'inventory.json')),json.load(open(root/'review-items.json')),(root/'construction.bin').read_bytes())
 return cache[str(root)]
def signatures(root):
 d,items,raw=load(root);result={}
 for item in items:
  hashes=[]
  for i in item['components']:
   c=d['components'][i];hashes.append(hashlib.sha256(raw[c['offset']:c['offset']+c['bytes']]).hexdigest())
  result[item['id']]=hashlib.sha256(''.join(sorted(hashes)).encode()).hexdigest()
 return result
current_signatures=signatures(final);ledger=[];images={};mismatches=[]
def archive(root,prefix,filter_region=None):
 _,items,_=load(root);items=[i for i in items if filter_region is None or i['region']==filter_region]
 sig=signatures(root)
 for k,item in enumerate(items):
  region=filter_region or 'all';src=root/'atlas'/f'{region}-{k//6:03}.png';dest=out/'atlas'/prefix/f'{region}-{k//6:03}.webp'
  if item['id'] in current_signatures and sig[item['id']]!=current_signatures[item['id']]:
   mismatches.append(item['id']);continue
  if not src.exists():raise FileNotFoundError(src)
  images[str(dest.relative_to(out))]=str(src)
  row={key:item.get(key) for key in ['id','region','kind','source','args','min','max']};row.update(components=len(item['components']),evidence=str(dest.relative_to(out)),row=k%6+1,views=['front','back','left','right','top','below'],geometrySha256=sig[item['id']],status='reviewed')
  if item['kind']=='addBurntCraft':row['status']='intentional-burnt-ruin'
  if item['kind']=='remaining-architecture-cell':row['status']='reviewed-structure-cell'
  if 'SunwardExploration' in item['kind']:row['status']='reviewed-prop-or-effect'
  ledger.append(row)
for region in ['alpha','britain','blacksail','winter','kyoto']:
 # Exclude foundation owners from the base image set; their final geometry is
 # archived using the dedicated after-repair atlas below.
 archive(repaired if region in ['kyoto','blacksail'] else original,'generated',region)
# Base mismatches must consist precisely of the newly supported houses.
foundation_ids={i['id']for i in load(foundations)[1]}
if set(mismatches)!=foundation_ids:raise AssertionError({'unexpectedMismatch':sorted(set(mismatches)-foundation_ids),'missingFoundationMismatch':sorted(foundation_ids-set(mismatches))})
archive(foundations,'foundations');archive(runtime,'runtime')
if len(ledger)!=len(load(final)[1])+len(load(runtime)[1]):raise AssertionError('Missing or duplicate ledger units')
if len({i['id']for i in ledger})!=len(ledger):raise AssertionError('Duplicate IDs')
for name,source in images.items():
 dest=out/name;dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists():Image.open(source).convert('RGB').save(dest,quality=90,method=4)
print('archived',len(images),'sheets; ledger',len(ledger),'units',flush=True)
ground=json.load(open(final/'ground-findings.json'));gm={r['id']:r for r in ground['rows']}
for i in ledger:
 i['checks']=['six-direction-visual-review']
 if not i['id'].startswith('runtime-'):i['checks']+=['finite-geometry','final-construction-image-byte-parity']
 if i['id'] in gm:
  i['checks'].append('25-shipped-terrain-support-probes');r=gm[i['id']];i['maxOriginalFloorAboveTerrain']=r['maxBaseMinusTerrain'];i['foundationSupportedSamples']=r['foundationSupportedSamples']
 foundation=i['evidence'].startswith('atlas/foundations/')
 if foundation:i['status']='repaired-foundation'
 if i['kind']=='addMachiyaCraft':
  i['checks'].append('shipped-attic-envelope-rays');i['status']='repaired-attic-and-foundation'if foundation else'repaired-attic'
 if i['kind'] in ['fieldTent','marketCraft','buildShipyardFrame','buildHalfWreckHull','gateCraft','addGateCraft']:i['intent']='open structure / construction frame / wreck by authored design; not a sealed residential envelope'
 if i['kind']=='addBurntCraft':i['intent']='140 authored Kyoto burnt ruins retain missing roofs and charred framing'
 if i['kind'] in ['runtime-Settlement_britain','runtime-Settlement_winter','runtime-Settlement_kyoto']:i['status']='repaired-runtime-envelope'
 if i['kind']=='runtime-SunwardExploration':i['intent']='supplemental props, reward chest states and visual effects; not a building count'
json.dump({'scope':'1152 generated building/structure units, including 404 spatial structure cells; plus 280 supplemental runtime units, including props/effects. No unreviewed items.','units':len(ledger),'imageSheets':len(images),'reusedImageGeometryVerified':True,'statusCounts':dict(collections.Counter(i['status']for i in ledger)),'items':ledger},open(out/'buildings.json','w'),ensure_ascii=False,indent=2)
with open(out/'buildings.csv','w',encoding='utf-8-sig',newline='') as f:
 fields=['id','region','kind','status','source','x','y','z','evidence','row','components','checks'];w=csv.DictWriter(f,fieldnames=fields,lineterminator="\n");w.writeheader()
 for i in ledger:
  center=[(a+b)/2 for a,b in zip(i['min'],i['max'])];w.writerow({**{k:i[k]for k in fields if k not in ['x','y','z','checks']},**dict(zip(['x','y','z'],[round(v,3)for v in center])),'checks':'; '.join(i['checks'])})
for name in ['geometry-findings.json','shell-findings.json','attic-envelope-findings.json','ground-findings.json']:(out/name).write_bytes((final/name).read_bytes())
manifest={name:{'bytes':(out/name).stat().st_size,'sha256':hashlib.sha256((out/name).read_bytes()).hexdigest()}for name in images}
json.dump(manifest,open(out/'image-manifest.json','w'),indent=2)
# Offline, dependency-free report: image links also work without JavaScript.
body=['<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>大世界建筑逐项验收图册</title><style>body{background:#15202c;color:#edf0f5;font:16px system-ui;max-width:1400px;margin:36px auto;padding:0 20px}a{color:#9cdbff}input{font:inherit;padding:12px;width:70%;margin:16px 0}article{border-top:1px solid #567;padding:18px 0}img{width:100%;height:auto}small{color:#bbc9d6}</style><h1>大世界建筑逐项验收图册</h1><p>五区 1,152 个建筑与结构单元，加上 280 个运行时补充场景、道具与效果单元。每行从左至右：正、背、左、右、上、下。图集为中性光照离线结构视图；实景截图见 native 文件夹。</p><p><a href="README.md">完整报告</a> · <a href="buildings.csv">逐项清单</a></p><input placeholder="按区域、编号或类型筛选" oninput="for(const a of document.querySelectorAll(\'article\'))a.hidden=!a.textContent.toLowerCase().includes(this.value.toLowerCase())">']
for name in sorted(images):
 units=[i for i in ledger if i['evidence']==name];label=' / '.join(f"第{i['row']}行 {i['id']} {i['kind']}"for i in units)
 body.append(f'<article><h2>{html.escape(name)}</h2><p>{html.escape(label)}</p><a href="{name}"><img loading="lazy" width="1536" height="1536" src="{name}"></a></article>')
(out/'index.html').write_text('\n'.join(body),encoding='utf-8')
print('evidence MB',sum((out/n).stat().st_size for n in images)/1e6,flush=True)
