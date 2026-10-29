"""Contact sheets and cycle GIFs from actual CPU-skinned frames, never synthetic imagery."""
from pathlib import Path
from PIL import Image,ImageDraw
import sys
subject=sys.argv[1];out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
after=sys.argv[3] if len(sys.argv)>3 else 'after'
if subject=='saber':
 states=['armor','civilian'];count=12;prefix='saber-';root='/tmp/saber';duration=[80,70]*6
else:
 states=['unarmed','carry'];count=8;prefix='';root='/tmp/player-wrist';duration=[70,60,70,60,70,60,70,70]
for state in states:
 frames=[]
 for i in range(count):
  canvas=Image.new('RGB',(640,696),(20,25,34));draw=ImageDraw.Draw(canvas)
  draw.text((10,8),f'{subject.upper()} {state.upper()} / ACTUAL CPU SKIN / OFFLINE - NOT GAMEPLAY',fill='white')
  for row,view in enumerate(['front','side']):
   for col,version in enumerate(['before',after]):
    number=f'{i:02}' if subject=='saber' else str(i)
    p=Path(f'{root}-{version}-{view}')/f'{prefix}{version}-{state}-{number}.png'
    image=Image.open(p).convert('RGB').resize((320,320))
    canvas.paste(image,(col*320,32+row*328));draw.text((col*320+8,36+row*328),f'{version.upper()} / {view.upper()} / {i+1:02}/{count}',fill='white')
  frames.append(canvas)
 frames[0].save(out/f'{subject}-{state}-before-after.gif',save_all=True,append_images=frames[1:],duration=duration,loop=0,optimize=True,disposal=2)
 # Selected opposite phases; preserve square pixel aspect.
 sheet=Image.new('RGB',(1280,696),(20,25,34))
 sheet.paste(frames[0],(0,0));sheet.paste(frames[count//2],(640,0));sheet.save(out/f'{subject}-{state}-before-after.jpg',quality=92)
print('Assembled verified complete phase sets',subject)
