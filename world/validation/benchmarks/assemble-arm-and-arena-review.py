"""Assemble fixed-camera actual-runtime offline render comparisons."""
from PIL import Image,ImageDraw
from pathlib import Path
import sys
before,after,arena,out=map(Path,sys.argv[1:5]);out.mkdir(parents=True,exist_ok=True)
bg=(19,24,32);fg=(235,239,245)
for mode in ['unarmed','carry']:
 sheet=Image.new('RGB',(1280,1120),bg);draw=ImageDraw.Draw(sheet);draw.text((12,10),f'PLAYER {mode.upper()} WALK / ACTUAL CPU-SKINNED RUNTIME POSES / OFFLINE, NOT GAMEPLAY',fill=fg)
 for row,(label,root)in enumerate([('before',before),('after',after)]):
  for col in range(4):
   image=Image.open(root/f'{label}-{mode}-{col}.png').convert('RGB').crop((160,110,480,650));x,y=col*320,32+row*544;sheet.paste(image,(x,y));draw.text((x+10,y+522),f'{label.upper()} / gait phase {col+1}/4',fill=fg)
 sheet.save(out/f'player-{mode}-arms-before-after.jpg',quality=92)
sheet=Image.new('RGB',(2000,1040),bg);draw=ImageDraw.Draw(sheet);draw.text((14,10),'ARENA VEGA / ACTUAL EXPORTED MESHES / OFFLINE CPU POSES, NOT GAMEPLAY OR FPS',fill=fg)
for row,label in enumerate(['before','after']):
 for col,state in enumerate(['forward','backward','strafe','apex','reset']):
  image=Image.open(arena/f'{label}-{state}.png').convert('RGB');x,y=col*400,32+row*502;sheet.paste(image,(x,y));draw.text((x+12,y+480),f'{label.upper()} / {state}',fill=fg)
draw.text((14,1026),'Apex uses the same displayed floor lowered by 0.65m for both versions; actor vertices remain captured rig-local world transforms.',fill=fg)
sheet.save(out/'arena-motion-before-after.jpg',quality=92)
