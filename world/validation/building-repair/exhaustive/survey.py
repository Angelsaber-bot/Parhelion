"""Build four-sheet contact views for review; retain full resolution atlases separately."""
from PIL import Image,ImageDraw
from pathlib import Path
import json,sys
root,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True);rows=[]
for region in sys.argv[3:] or ['alpha','britain','blacksail','winter','kyoto','all']:
 paths=sorted(root.glob(region+'-*.png'))
 for j in range(0,len(paths),4):
  dest=out/f'{region}-{j//4:02}.jpg';img=Image.new('RGB',(1536,1584),'#161e28');draw=ImageDraw.Draw(img)
  for k,p in enumerate(paths[j:j+4]):
   im=Image.open(p).convert('RGB').resize((768,768));x=(k%2)*768;y=(k//2)*792;img.paste(im,(x,y+24));draw.text((x+8,y+5),p.name,fill='white')
  img.save(dest,quality=93);rows.append({'survey':str(dest),'sheets':[str(p)for p in paths[j:j+4]]})
json.dump(rows,open(out/'index.json','w'),indent=2);print('surveys',len(rows))
