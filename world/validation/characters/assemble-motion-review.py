"""Labeled before/after actual-runtime CPU render boards; not WebGL/game capture."""
from pathlib import Path
from PIL import Image,ImageDraw
import sys
before,after,out=map(Path,sys.argv[1:4]);out.mkdir(parents=True,exist_ok=True)
paths=lambda d: sorted(d.glob('musashi-after-walk-*.png'),key=lambda p:int(p.stem.rsplit('-',1)[1]))
b,a=paths(before),paths(after)
assert len(b)==len(a)==16
bg=(19,24,32);fg=(235,239,245)
sheet=Image.new('RGB',(1920,1040),bg);draw=ImageDraw.Draw(sheet)
draw.text((16,12),'MUSASHI WALK / ACTUAL RUNTIME CPU SKINNING / SAME ASSET AND CAMERA / OFFLINE, NOT GAME SCREENSHOTS',fill=fg)
for row,(label,images)in enumerate([('BEFORE: published runtime',b),('AFTER: current runtime',a)]):
 for col,i in enumerate([0,4,8,12]):
  x,y=col*480,36+row*502;sheet.paste(Image.open(images[i]).convert('RGB').resize((480,480)),(x,y));draw.text((x+14,y+480),f'{label} - phase {i+1:02}/16',fill=fg)
sheet.save(out/'musashi-walk-before-after.jpg',quality=92)
frames=[]
for i in range(16):
 image=Image.new('RGB',(960,530),bg);image.paste(Image.open(b[i]).convert('RGB'),(0,32));image.paste(Image.open(a[i]).convert('RGB'),(480,32));d=ImageDraw.Draw(image)
 d.text((12,10),'BEFORE / published runtime',fill=fg);d.text((492,10),'AFTER / arm refinement',fill=fg);d.text((12,513),f'Phase {i+1:02}/16 - offline CPU posed-mesh preview, NOT browser gameplay/FPS',fill=fg);frames.append(image)
frames[0].save(out/'musashi-walk-before-after.gif',save_all=True,append_images=frames[1:],duration=[70 if i%3!=1 else 60 for i in range(16)],loop=0,optimize=False,disposal=2)
print(out)
