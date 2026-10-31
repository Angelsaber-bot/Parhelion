"""Bounded native stage review. One mutable frame buffer; no stored raw sequence.
Run through the shared small-output gate. CPU lighting only, no GPU/bloom claim.
"""
import argparse,os,pathlib,subprocess,sys,json,runpy,shutil,hashlib
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
p=argparse.ArgumentParser();p.add_argument('--world',required=True);p.add_argument('--work',required=True);p.add_argument('--out',required=True);p.add_argument('--keys');p.add_argument('--export-only',action='store_true');a=p.parse_args(args)
script=pathlib.Path(__file__).resolve();own_world=script.parents[2];work=pathlib.Path(a.work).resolve();out=pathlib.Path(a.out).resolve();work.mkdir(parents=True,exist_ok=True);out.mkdir(parents=True,exist_ok=True)
command=['node','--import','tsx',str(script.with_name('stream-x-stage.ts')),str(work),'--identity=musashi','--world='+str(pathlib.Path(a.world).resolve()),'--fps='+('12' if a.keys else '30')]
if a.keys:command.append('--frames='+a.keys)
log=open(out/'native-export.log','w');producer=subprocess.Popen(command,cwd=own_world,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=log,text=True,bufsize=1)
video=None;frames=[];os.environ.update(ULTIMATE_WIDTH='360',ULTIMATE_HEIGHT='202',ULTIMATE_SAMPLES=('16' if a.keys else '4'),ULTIMATE_BLOOM='0',ULTIMATE_REUSE_MATERIALS='0')
try:
 for line in producer.stdout:
  entry=json.loads(line);manifest=json.load(open(work/'current.json'));raw_bytes=sum(f.stat().st_size for f in work.iterdir() if f.is_file());assert raw_bytes<24*1024*1024,'single-frame workspace exceeds 24 MiB budget'
  if a.export_only:
   frames.append({**entry,'singleFrameBytes':raw_bytes,'camera':manifest['camera'],'assetSha256':manifest['assetSha256'],'sourceHashes':manifest['sourceHashes']});print(json.dumps({'singleFrameBytes':raw_bytes,'entry':entry,'camera':manifest['camera']}),flush=True);producer.stdin.write('next\n');producer.stdin.flush();continue
  sys.argv=[str(script.with_name('render-stage-frame.py')),'--',str(work),str(work),'current']
  runpy.run_path(sys.argv[0],run_name='__main__')
  png=(work/'current.png').read_bytes();record={**entry,'camera':manifest['camera'],'assetSha256':manifest['assetSha256'],'sourceHashes':manifest['sourceHashes'],'sha256':hashlib.sha256(png).hexdigest(),'bytes':len(png)};frames.append(record)
  if a.keys:shutil.copyfile(work/'current.png',out/(entry['sourceId']+'.png'))
  else:
   if video is None:
    video=subprocess.Popen(['ffmpeg','-n','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','png','-framerate','30','-i','pipe:0','-vf',"drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='OFFLINE NATIVE X - FULL CYCLE':fontcolor=white:fontsize=10:x=8:y=8",'-c:v','libx264','-threads','1','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'preview.mp4')],stdin=subprocess.PIPE)
   video.stdin.write(png)
  producer.stdin.write('next\n');producer.stdin.flush()
finally:
 producer.stdin.close();producer.wait(timeout=30);log.close()
 if video is not None:video.stdin.close();assert video.wait(timeout=30)==0,'video encoding failed'
 json.dump({'world':str(pathlib.Path(a.world).resolve()),'rendererSha256':hashlib.sha256(script.with_name('render-stage-frame.py').read_bytes()).hexdigest(),'samples':16 if a.keys else 4,'resolution':[360,202],'frames':frames,'complete':producer.returncode==0 and not a.export_only,'scope':'Native CPU-skinned stage and original materials; same exposure and no compositor bloom. Does not reproduce WebGL additive blending, UnrealBloomPass, fog or GPU performance. One overwritten working frame; old evidence untouched.'},open(out/'stream-report.json','w'),indent=2)
assert producer.returncode==0,producer.returncode
