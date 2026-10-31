"""Assemble CPU mesh-snapshot review with real sample durations, never synthetic FPS proof."""
import json,sys,os,subprocess
from PIL import Image,ImageDraw,ImageFont
source,renders,out=sys.argv[1:4]
os.makedirs(out,exist_ok=True)
data=json.load(open(os.path.join(source,'timeline.data.json')))
frames=[row for row in data['timeline'] if row['type']=='frame']
contacts=[row for row in data['timeline'] if row['type']=='contact']
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
paths=[]
for row in frames:
    path=os.path.join(renders,row['id']+'.png')
    if not os.path.isfile(path):raise RuntimeError('Render not yet complete: '+path)
    picture=Image.open(path).convert('RGB');canvas=Image.new('RGB',(picture.width,picture.height+60),'#14252c');canvas.paste(picture,(0,30));draw=ImageDraw.Draw(canvas)
    draw.text((12,6),'CPU SNAPSHOT REVIEW • actual simulation samples • fixed review camera',font=font,fill='#ddf6f7')
    draw.text((12,picture.height+36),f"t={row['time']:.3f}s  {row['attack'].upper()} / {row['mode']}  HP {row['playerHp']}  contact {row['contactSequence']}  |  not WebGL/FPS evidence",font=small,fill='#ddf6f7')
    output=os.path.abspath(os.path.join(out,row['id']+'.png'));canvas.save(output);paths.append(output)
concat=os.path.join(out,'samples.ffconcat')
with open(concat,'w')as stream:
    stream.write('ffconcat version 1.0\n')
    for i,path in enumerate(paths):
        duration=frames[i+1]['time']-frames[i]['time'] if i+1<len(frames) else 1/7.5-1/60
        stream.write("file '"+path.replace("'","'\\''")+"'\noption framerate 60\n"+f'duration {duration:.9f}\n')
    stream.write("file '"+paths[-1].replace("'","'\\''")+"'\noption framerate 60\n")
subprocess.run(['ffmpeg','-hide_banner','-loglevel','warning','-y','-f','concat','-safe','0','-i',concat,'-fps_mode','vfr','-c:v','libx264','-crf','20','-enc_time_base','1:60','-video_track_timescale','60000','-pix_fmt','yuv420p',os.path.join(out,'actual-contact-review.mp4')],check=True)
# Verify encoded presentation timestamps; the image demuxer's default25Hz would
# otherwise quantize actual1/60 contact times despite a variable-frame-rate output.
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',os.path.join(out,'actual-contact-review.mp4')]))
pts=[float(frame['best_effort_timestamp_time']) for frame in probe['frames']]
assert len(pts)==len(frames)+1
for row,timestamp in zip(frames,pts):assert abs(timestamp-(row['time']-frames[0]['time']))<.0001,(row['id'],timestamp,row['time'])
# The contact sheet is supplementary; the MP4 retains all exported temporal samples.
width,height=480,300;sheet=Image.new('RGB',(width*5,height*len(contacts)),'#14252c')
selected=[]
for row_index,contact in enumerate(contacts):
    for column,delta in enumerate([-1,-.15,0,.13,.53]):
        row=min(frames,key=lambda frame:abs(frame['time']-(contact['time']+delta)))
        picture=Image.open(os.path.join(out,row['id']+'.png')).convert('RGB');picture.thumbnail((width,height));sheet.paste(picture,(column*width,row_index*height));selected.append({'attack':contact['attack'],'offsetRequested':delta,'id':row['id'],'time':row['time']})
sheet.save(os.path.join(out,'actual-contact-phases.jpg'),quality=92)
with open(os.path.join(out,'review-index.json'),'w')as stream:json.dump({'evidence':data['evidence'],'samples':len(frames),'contacts':contacts,'sheet':selected,'note':'Video uses exported sample timestamps; mostly 7.5 Hz plus exact contacts, no interpolation. Not GPU gameplay capture.'},stream,indent=2)
print(json.dumps({'frames':len(frames),'contacts':len(contacts),'output':out}))
