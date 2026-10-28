"""Assemble the actual offline renders and explicit collision diagnostic labels."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import sys
out=Path(sys.argv[1]);w=1600;panelw=780;panelh=507;head=116;rowh=560
img=Image.new('RGB',(w,head+rowh*4+60),'#101b29');d=ImageDraw.Draw(img)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
large=ImageFont.truetype(font,27);small=ImageFont.truetype(font,18);medium=ImageFont.truetype(font,21)
d.text((24,19),'ALPHA | Pillar-aligned chapter barriers',font=large,fill='white')
d.text((24,58),'Actual exported GLB - offline Blender / additive material approximation - NOT WebGL',font=small,fill='#b8c8d8')
d.text((24,84),'LEFT: eye-level geometry   RIGHT: overhead diagnostic | cyan = aligned / red = removed old wall',font=small,fill='#b8c8d8')
labels=[('west','WEST  x: -334.5 -> -310'),('north','NORTH  z: -342 -> -318'),('east','EAST  x: 342.5 -> 318'),('south','SOUTH  z: 342 -> 318')]
for row,(name,label) in enumerate(labels):
    y=head+row*rowh;d.text((20,y+6),label,font=medium,fill='white')
    for col,kind in enumerate(['eye','top']):
        x=10+col*800;p=Image.open(out/f'{name}-{kind}.png').convert('RGB').resize((panelw,panelh),Image.Resampling.LANCZOS)
        img.paste(p,(x,y+40))
d.text((24,img.height-44),'Shared ART/COL triangles; original summon_circle unlock, reset and V debug noclip preserved.',font=small,fill='#c1cfdb')
img.save(out/'alignment-board.jpg',quality=91,subsampling=0)
