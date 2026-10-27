"""Lay out unaltered actual-GLB renders; never invent or retouch scene pixels."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import sys, json, hashlib
root=Path(sys.argv[1]); out=root/'comparison'; out.mkdir(exist_ok=True)
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=lambda n: ImageFont.truetype(font_path,n)
groups=[('01-nassau', ['overview', 'nassau-street', 'tavern', 'fort']), ('02-fleet', ['port-piers', 'small-boats', 'flagship-deck', 'hull-macro']), ('03-islands', ['sky-wrecks', 'windmill', 'reef', 'lighthouse']), ('04-craft', ['canvas-rigging', 'cannon-detail', 'boss-arena', 'wreck-inside'])]
for title,shots in groups:
    canvas=Image.new('RGB',(2448,164+len(shots)*850+70),'#111925'); d=ImageDraw.Draw(canvas)
    d.text((24,16),'BLACK SAIL 1718 / ACTUAL EXPORTED GEOMETRY',font=font(36),fill='#f3ead9')
    d.text((24,65),'BEFORE',font=font(27),fill='#b8c7d9'); d.text((1248,65),'AFTER',font=font(27),fill='#d7bea2')
    d.text((24,109),'Same camera + lighting / Cycles 256 samples / GLB PBR fallback, NOT runtime toon screenshots',font=font(23),fill='#a7b6c9')
    for row,name in enumerate(shots):
        y=164+row*850; d.text((24,y),name.upper().replace('-',' / '),font=font(25),fill='#e8dfcf')
        for col,folder in enumerate(['before/final-render','final/render']):
            im=Image.open(root/folder/(name+'.png')).convert('RGB')
            assert im.size==(1200,800),f'Unexpected render size: {im.size}'
            canvas.paste(im,(24+1224*col,y+36))
    d.text((24,canvas.height-48),'Source: TypeScript generators + world_blacksail.glb. Offline PBR review only; runtime toon shading is not shown.',font=font(22),fill='#a7b6c9')
    canvas.save(out/(title+'.png'))
print(out)
