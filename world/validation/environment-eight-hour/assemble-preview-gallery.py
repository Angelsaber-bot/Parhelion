"""Copy accepted existing CPU frames verbatim; no rerender, crop, retouch or publication.
Usage: python assemble-preview-gallery.py EVIDENCE_ENVIRONMENT OUTPUT_DIR
"""
from pathlib import Path
import sys,hashlib,json,shutil,html
root,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
sections=[
 ('旧收讯阵 / Crafted receiver array','实际场景几何与受限结构阴影的离线预览。 / Offline preview of actual scene geometry and bounded structural shadow flags.',[
 ('收讯阵 / Receiver array','field-shadow-split/on/alpha-battle.png')]),
 ('港口工作台视线 / Harbor workstation sightline','同一玩家高度相机，保留旧支柱。 / Same player-height camera; original pillar preserved.',[
 ('调整前 / Before','campaign-player-frontage/blacksail-player-frontage.png'),('调整后 / After','harbor-frontage-fixed/renders/blacksail-player-frontage.png')]),
 ('京都纸档庇护所 / Kyoto paper refuge','可进入的任务空间；离线构图预览，不是 GPU 截图。 / Enterable task space; offline composition preview, not a GPU screenshot.',[
 ('纸档庇护所 / Paper refuge','campaign-side-residents/renders/kyoto-campaign.png')]),
 ('证人艾妲 / Ada, oath witness','实际角色查阅笔记姿态；不是完整动画视频。 / Actual note-check pose, not a full motion video.',[
 ('查阅笔记 / Checking notes','resident-acting-v2/read/ada.png')]),
]
manifest=[];parts=[];index=0
for title,note,items in sections:
 figures=[]
 for caption,source in items:
  index+=1;p=root/source;assert p.is_file(),p;dest=f'{index:02d}-{p.name}';shutil.copyfile(p,out/dest)
  digest=hashlib.sha256(p.read_bytes()).hexdigest();assert hashlib.sha256((out/dest).read_bytes()).hexdigest()==digest
  manifest.append({'source':source,'file':dest,'sha256':digest,'caption':caption})
  figures.append(f'<figure><img loading="lazy" src="{html.escape(dest)}" alt="{html.escape(caption)}"><figcaption>{html.escape(caption)}</figcaption></figure>')
 parts.append(f'<section><h2>{html.escape(title)}</h2><p>{html.escape(note)}</p><div class="row">'+''.join(figures)+'</div></section>')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Parhelion — Environment offline previews</title><style>body{margin:0;background:#151c24;color:#e5e8ec;font:16px/1.55 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:28px}h1{font-size:28px}h2{font-size:21px;margin-top:34px}.note{border-left:3px solid #c2a56c;padding:12px 18px;background:#202a35}.row{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;flex:1 1 420px;min-width:260px}img{display:block;width:100%;height:auto;border:1px solid #35424f;box-sizing:border-box}figcaption{padding:8px 0;color:#c6d2df}p{color:#b6c4d1}</style><main><h1>幻日 · 场景改进离线预览<br>Parhelion · Environment offline previews</h1><p class="note">所有图片均来自真实游戏几何与已审核的 CPU 渲染，不是 AI 概念图，也不是实时 GPU 截图。材质、光照、阴影、角色/HUD 呈现不等同于最终运行画面；不证明 FPS。原图逐字节复制，未修图。<br>Actual game geometry and reviewed CPU renders, not AI concept art or live GPU screenshots. Materials, lighting, shadows and actor/HUD presentation differ from runtime; no FPS claim. Source image bytes are unchanged.</p>'''+''.join(parts)+'</main></html>'
(out/'index.html').write_text(page);(out/'manifest.json').write_text(json.dumps({'published':False,'images':manifest},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'images':len(manifest),'bytes':sum(p.stat().st_size for p in out.iterdir() if p.is_file()),'output':str(out)}))
