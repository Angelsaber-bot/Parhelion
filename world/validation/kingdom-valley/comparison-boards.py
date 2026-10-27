"""Arrange original decoded-GLB render pixels, with labels only; no scene retouching."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import sys,json
root=Path(sys.argv[1]);region=sys.argv[2];out=root/'comparison';out.mkdir(exist_ok=True)
shots=[c['name']for c in json.loads(Path(__file__).with_name(region+'-cameras.json').read_text())]
font=lambda n:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',n)
title={'britain':'SUNSET KINGDOM / ARTHURIAN ROMANCE','alpha':'PARHELION VALLEY / OBSERVATORY HUB'}[region]
for group in range(4):
 names=shots[group*4:(group+1)*4];canvas=Image.new('RGB',(2448,164+len(names)*850+70),'#111925');d=ImageDraw.Draw(canvas)
 d.text((24,16),title+' / ACTUAL GEOMETRY',font=font(34),fill='#f3ead9')
 d.text((24,65),'BEFORE',font=font(27),fill='#b8c7d9');d.text((1248,65),'AFTER',font=font(27),fill='#d7bea2')
 d.text((24,109),'Same camera + lighting / Cycles 256 samples / GLB PBR fallback, NOT runtime toon screenshots',font=font(23),fill='#a7b6c9')
 for row,name in enumerate(names):
  y=164+row*850;d.text((24,y),name.upper().replace('-',' / '),font=font(25),fill='#e8dfcf')
  for col,folder in enumerate(['before/final-render','final/render']):
   im=Image.open(root/folder/(name+'.png')).convert('RGB');assert im.size==(1200,800)
   canvas.paste(im,(24+1224*col,y+36))
 d.text((24,canvas.height-48),'Source: TypeScript generators + world_'+region+'.glb. Offline PBR review only; runtime toon shading is not shown.',font=font(22),fill='#a7b6c9')
 canvas.save(out/f'{group+1:02d}-{region}.png')
print(out)
