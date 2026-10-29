"""Contact sheet of actual authored runtime geometry, offline studio-lit CPU renders."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import sys
base=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
labels={'alpha':'PHANTOM SUN VALLEY | Companion Residence','britain':'SUNSET KINGDOM | Forge, Stable and Abbey','blacksail':'BLACKSAIL | Tidemark Customs House','winter':'ETERNAL WINTER | Aid and Supply Post','kyoto':'KYOTO | Swordsmith and Wayfarer Lane'}
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
w,h=1600,450;sheet=Image.new('RGB',(w,h*5+90),'#171d27');d=ImageDraw.Draw(sheet)
d.text((24,14),'PARHELION | FIVE LIVED-IN CHAPTER HUBS',font=font,fill='white');d.text((24,44),'Actual runtime mesh geometry + resident NPCs. Offline studio lighting; not a browser or FPS capture.',font=small,fill='#bec9d8')
for row,(region,label)in enumerate(labels.items()):
 y=90+row*h;d.text((20,y+8),label,font=font,fill='white')
 for col,suffix in enumerate(['','-interior']):
  image=Image.open(base/(region+suffix+'.png')).convert('RGB');image.save(out/(region+suffix+'.jpg'),quality=88)
  image.thumbnail((790,400));sheet.paste(image,(col*800+(800-image.width)//2,y+43+(400-image.height)//2))
sheet.save(out/'Parhelion-five-chapter-hubs-review.jpg',quality=90)
