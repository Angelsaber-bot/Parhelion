"""Pair identical-clock CPU frames without retiming/interpolation or pixel enhancement.
Run under the shared evidence admission wrapper when other CPU renders are active.
"""
import argparse, os, subprocess
from PIL import Image, ImageDraw, ImageFont
p=argparse.ArgumentParser();p.add_argument('before');p.add_argument('after');p.add_argument('output');p.add_argument('--outfit',required=True);p.add_argument('--fps',type=int,default=30);p.add_argument('--ground-mm',type=float,default=-25);p.add_argument('--prefix');p.add_argument('--expected',type=int);p.add_argument('--terrain',action='store_true');args=p.parse_args();prefix=args.prefix or 'follow-'+args.outfit+'-'
files=sorted(n for n in os.listdir(args.before) if n.startswith(prefix) and n.endswith('.png'))
assert len(files)==(args.expected or args.fps*8+1), 'Require the declared complete temporal window'
assert files==sorted(n for n in os.listdir(args.after) if n.startswith(prefix) and n.endswith('.png'))
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',11)
frames=[]
for index,name in enumerate(files):
    before=Image.open(os.path.join(args.before,name)).convert('RGB');after=Image.open(os.path.join(args.after,name)).convert('RGB');assert before.size==after.size
    w,h=before.size;canvas=Image.new('RGB',(w*2,h+56),'#121923');draw=ImageDraw.Draw(canvas)
    canvas.paste(before,(0,24));canvas.paste(after,(w,24));draw.text((8,5),'Preserved baseline',font=font,fill='white');draw.text((w+8,5),'Anchor-aware terrain candidate' if args.terrain else 'Stride candidate',font=font,fill='white')
    draw.text((8,h+29),f'{index/args.fps:.3f}s | {args.fps} fps | same controller path | CPU offline',font=font,fill='white')
    draw.text((8,h+42),'Actual collision triangles; neutral QA surface, not game lighting' if args.terrain else f'Legacy QA plane {args.ground_mm:g} mm; contact metrics use true ground y=0',font=font,fill='#bdc7d7')
    frames.append(canvas)
durations=[round((i+1)*1000/args.fps)-round(i*1000/args.fps) for i in range(len(frames))]
frames[0].save(args.output+'.webp',save_all=True,append_images=frames[1:],duration=durations,loop=0,quality=90,method=4)
w,h=frames[0].size
process=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{h}','-r',str(args.fps),'-i','-','-an','-c:v','libx264','-threads','2','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',args.output+'.mp4'],stdin=subprocess.PIPE)
for frame in frames:process.stdin.write(frame.tobytes())
process.stdin.close();assert process.wait()==0
# Dense consecutive frames around ordinary travel, turning and settling.
for label,start in ([('ordinary',.4),('turn',1.1),('settle',2.0)] if args.terrain else [('ordinary',1.2),('turn',4.4),('settle',7.0)]):
    first=round(start*args.fps);chosen=frames[first:first+16];sheet=Image.new('RGB',(w*4,h*4),'#121923')
    for i,frame in enumerate(chosen):sheet.paste(frame,((i%4)*w,(i//4)*h))
    sheet.save(args.output+'-'+label+'-consecutive.jpg',quality=92)
print(args.output,len(frames),args.fps,flush=True)
