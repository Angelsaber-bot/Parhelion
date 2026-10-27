"""Lay out unaltered actual-GLB renders; never invent or retouch scene pixels."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import sys, json, hashlib
root=Path(sys.argv[1]); out=root/'comparison'; out.mkdir(exist_ok=True)
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=lambda n: ImageFont.truetype(font_path,n)
groups=[('01-moscow',['overview','city-street','street-ground','kremlin-bell']),('02-landmarks',['basil-square','basil-detail','ivan-detail','imperial-tent']),('03-campaign',['napoleon-camp','canvas-detail','berezina-crossing','bridge-detail']),('04-ice-and-fire',['beacon-snowfield','beacon-detail','gorge-cavern','cavern-mouth'])]
for title,shots in groups:
    canvas=Image.new('RGB',(2448,164+len(shots)*850+70),'#111925'); d=ImageDraw.Draw(canvas)
    d.text((24,16),'EVERWINTER 1812 / ACTUAL EXPORTED GEOMETRY',font=font(36),fill='#f3ead9')
    d.text((24,65),'BEFORE',font=font(27),fill='#b8c7d9'); d.text((1248,65),'AFTER',font=font(27),fill='#d7bea2')
    d.text((24,109),'Same camera + lighting / Cycles 256 samples / GLB PBR fallback, NOT runtime toon screenshots',font=font(23),fill='#a7b6c9')
    for row,name in enumerate(shots):
        y=164+row*850; d.text((24,y),name.upper().replace('-',' / '),font=font(25),fill='#e8dfcf')
        for col,folder in enumerate(['before/final-render','final/render']):
            im=Image.open(root/folder/(name+'.png')).convert('RGB')
            assert im.size==(1200,800),f'Unexpected render size: {im.size}'
            canvas.paste(im,(24+1224*col,y+36))
    d.text((24,canvas.height-48),'Canonical deliverables: TypeScript generators + world_winter.glb. Blender scene is an editable PBR review copy.',font=font(22),fill='#a7b6c9')
    canvas.save(out/(title+'.png'))
print(out)
hero=Image.new('RGB',(1248,938),'#111925');d=ImageDraw.Draw(hero)
d.text((24,16),'EVERWINTER 1812 / REFINED MAP',font=font(32),fill='#f3ead9')
d.text((24,62),'Actual exported GLB / Cycles 256 samples / PBR fallback, not runtime toon',font=font(22),fill='#a7b6c9')
hero.paste(Image.open(root/'final/render/overview.png').convert('RGB'),(24,108))
hero.save(out/'00-everwinter-overview-PBR-review.png')
