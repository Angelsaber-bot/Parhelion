"""Assemble unretouched CPU-render evidence and hash its exact inputs/outputs."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,sys,os
script_dir=Path(__file__).resolve().parent
root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else script_dir
out=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else script_dir
out.mkdir(parents=True,exist_ok=True)
for folder in ['before','after','inactive']:
 if not (root/folder).is_dir():raise SystemExit('Missing raw evidence directory '+str(root/folder)+'. Pass the retained evidence root as the first argument; raw inputs are intentionally not published.')
font=os.environ.get('ERA_QA_FONT','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
regions=['britain','blacksail','winter','kyoto']
labels=['BRITAIN','BLACK SAIL','WINTER','KYOTO']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def sheet(name,title,rows):
 w,h=320,365;im=Image.new('RGB',(w*4,120+(h+45)*2),(25,32,39));d=ImageDraw.Draw(im)
 d.text((20,15),title,font=ImageFont.truetype(font,23),fill=(240,228,201))
 d.text((20,57),'Actual source geometry + surface maps | Blender CPU, matched camera/light | NOT browser or FPS evidence',font=ImageFont.truetype(font,13),fill=(182,192,202))
 for row,(folder,label) in enumerate(rows):
  y=115+row*(h+45)
  for col,region in enumerate(regions):
   x=col*w;im.paste(Image.open(root/folder/(region+'.png')).convert('RGB').resize((w,h),Image.Resampling.LANCZOS),(x,y+35));d.text((x+14,y+6),f'{label}: {labels[col]}',font=ImageFont.truetype(font,16),fill=(240,228,201))
 im.save(out/name,optimize=True)
sheet('stations-before-after.png','PARHELION / four era stations / restrained craft polish',[('before','BEFORE'),('after','AFTER')])
sheet('stations-state-readability.png','PARHELION / saved-state art projection / dormant vs complete',[('inactive','DORMANT'),('after','COMPLETE')])
records=[]
for folder in ['before','after','inactive']:
 for region in regions:
  p=root/folder/(region+'.json');meshes=json.loads(p.read_text());records.append({'region':region,'state':'dormant' if folder=='inactive' else 'complete','version':folder,'geometryJsonSha256':sha(p),'imageSha256':sha(p.with_suffix('.png')),'triangles':sum(len(m['index'])//3 if m['index'] else len(m['position'])//9 for m in meshes),'draws':len(meshes),'textureBaseBytes':sum(len(m['texture']['data']) if m.get('texture') else 0 for m in meshes)})
manifest={'sourceSha256':sha(script_dir.parents[1]/'src/eraStoryScenes.ts'),'baselineSource':'b3a230c62d8271f4c04baebb6e2a8f55c1e050de:world/src/eraStoryScenes.ts','renderer':'Blender Cycles CPU','samples':32,'denoising':False,'resolution':[720,820],'camera':[5,-8,5],'target':[0,0,1.85],'orthographicScale':5.1,'lighting':'identical neutral sky + soft area light','sourceChannels':['positions','indices','normals','UVs','vertex colors','base color','emissive','roughness','metalness','actual RGBA surface map pixels'],'limitations':'Offline geometry/material inspection only. Runtime camera, surrounding maps, Three.js lighting/tone-mapping, cast-shadow policy, movement/combat, browser GPU and FPS are not reproduced or verified. Blender may print an irrelevant read-only extensions-cache warning after successful PNG writes.','records':records,'contactSheets':{name:sha(out/name) for name in ['stations-before-after.png','stations-state-readability.png']}}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
