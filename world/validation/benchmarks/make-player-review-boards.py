"""Contact sheets only: original render pixels resized to fit; no retouching/generation."""
from PIL import Image,ImageDraw,ImageFont
import sys,os
review=sys.argv[1];runtime=sys.argv[2];out=os.path.join(review,'delivery');os.makedirs(out,exist_ok=True)
font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
def board(name,items,columns,title):
 cw,ch=480,610;rows=(len(items)+columns-1)//columns
 im=Image.new('RGB',(columns*cw,100+rows*ch),(25,29,37));d=ImageDraw.Draw(im);f=ImageFont.truetype(font,23);small=ImageFont.truetype(font,18)
 d.text((22,16),title,font=f,fill='white');d.text((22,53),'实际运行时模型离线渲染 / 美术候选 · 非实时游戏截图 · 原图拼接，未修图美化',font=small,fill=(190,200,210))
 for i,(path,label) in enumerate(items):
  image=Image.open(path).convert('RGB');image.thumbnail((cw-12,ch-42));x=(i%columns)*cw+(cw-image.width)//2;y=100+(i//columns)*ch
  im.paste(image,(x,y));d.text(((i%columns)*cw+12,y+ch-32),label,font=small,fill='white')
 im.save(os.path.join(out,name))
# Both are actual runtime poses; baseline exposure differs and is stated explicitly.
board('player-comparison.png',[(os.path.join(review,'player-runtime-before/ready-front.png'),'旧版：低模旅人（旧灯光曝光）'),(os.path.join(runtime,'ready-front.png'),'新版：男性主角候选 / 真AR'),(os.path.join(runtime,'ready-side.png'),'新版：侧面 / 真AR')],3,'PARHELION · 主角重建对照（同机位全身，旧/新曝光不同）')
board('player-equipped-poses.png',[(os.path.join(runtime,file),label)for file,label in [('ready-front.png','低位持枪'),('aim_up-side.png','向上瞄准'),('aim_down-front.png','向下瞄准'),('run-threequarter.png','奔跑'),('swim-side.png','游泳 / 背负'),('glide-back.png','滑翔 / 背负')]],3,'PARHELION · 最终候选 + 实际 Dawn AR 装备姿态')
