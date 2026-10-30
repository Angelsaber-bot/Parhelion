"""Offline CPU + cut-in UI reconstruction; never browser/GPU capture.
Usage: python compose-era-preview.py EXPORTS RENDERS OUTPUT IDENTITY
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json, sys
source, renders, out = map(Path, sys.argv[1:4]); identity = sys.argv[4]
out.mkdir(parents=True, exist_ok=True)
art = Image.open(Path(__file__).resolve().parents[2] / 'assets' / 'cinematics' / f'{identity}-cut-in-v2.webp').convert('RGBA')
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
background = {'blackbeard':(4,23,31,255),'napoleon':(16,30,48,255),'musashi':(21,11,28,255)}[identity]
for manifest in sorted(source.glob(identity+'-*.json')):
    data=json.loads(manifest.read_text()); image=Image.open(renders/(data['id']+'.png')).convert('RGBA');w,h=image.size;state=data['cutin']
    if state['visible']:
        panel=Image.new('RGBA',(w,h),background);scale=min(w/art.width,h/art.height);fit=art.resize((round(art.width*scale),round(art.height*scale)));panel.alpha_composite(fit,((w-fit.width)//2,(h-fit.height)//2))
        mask=Image.new('L',(w,h));draw=ImageDraw.Draw(mask);r,e=state['reveal'],state['exit']
        if identity=='blackbeard': draw.rectangle((e*w,(1-r)*h*.5,w,(1-(1-r)*.5)*h),fill=255)
        elif identity=='napoleon':
            draw.rectangle(((1-r)*w*.5,e*h,(1-(1-r)*.5)*w,h),fill=255)
        else:
            a=max(0,r*(1-e))*.5;points=[(0,0),(a,0),(.5,.5-a),(1-a,0),(1,0),(1,a),(.5+a,.5),(1,1-a),(1,1),(1-a,1),(.5,.5+a),(a,1),(0,1),(0,1-a),(.5-a,.5),(0,a)];draw.polygon([(x*w,y*h) for x,y in points],fill=255)
        panel.putalpha(mask)
        if identity=='napoleon':
            zoom=1.04-r*.04;panel=panel.resize((round(w*zoom),round(h*zoom)));image.alpha_composite(panel,((w-panel.width)//2,(h-panel.height)//2))
        else:image.alpha_composite(panel)
    d=ImageDraw.Draw(image);d.rectangle((0,0,w,21),fill=(6,12,22,255));d.text((7,4),'OFFLINE CPU + CUT-IN UI RECONSTRUCTION | NOT BROWSER / GPU',font=font,fill='white');d.rectangle((0,h-20,w,h),fill=(6,12,22,255));d.text((7,h-17),f"{identity.upper()}   {data['elapsed']:.2f}s   {data['phase'].upper()}   authored contacts: {data['strikeCount']}",font=font,fill=(228,208,150,255));image.convert('RGB').save(out/(data['id']+'.png'))
print(out)
