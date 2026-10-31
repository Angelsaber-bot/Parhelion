"""Compare captured actual-controller baseline/candidate/live production, no state injection."""
import gzip,json,sys,math
from pathlib import Path
base,candidate,production,out=map(Path,sys.argv[1:])
def read(path):
 p=path/'capture.json.gz'
 return json.load(gzip.open(p,'rt'))
a,b,c=map(read,(base,candidate,production));assert len(a['frames'])==len(b['frames'])==len(c['frames'])
assert a['events']==b['events']==c['events'],'actual native/Q callbacks differ'
exceptions=[];exact=0;max_difference=0
for x,y,z in zip(a['frames'],b['frames'],c['frames']):
 for key in ['t','root','yaw','state','clipTime','mountedPhase']:assert x[key]==y[key]==z[key],(z['t'],key)
 for name in ['RiderSeatAnchor','SaddleSocket','HandL','HandR']:
  assert x['joints'][name]==z['joints'][name],(z['t'],name)
 delta=max(abs(m-n) for u,v in zip(y['bones'],z['bones']) for m,n in zip(u,v));max_difference=max(max_difference,delta)
 if delta:
  assert z['state']=='attack',('unexpected pose difference',z['t'],delta)
  assert x['bones']==z['bones'],'production transition must release to exact original native pose'
  exceptions.append({'t':z['t'],'maxBoneMatrixDifferenceFromCandidate':delta,'productionMatchesOriginalNative':True,'reason':'play(attack) restores immediately; historical update-only wrapper retained preceding turn until next update'})
 else:exact+=1
assert len(exceptions)<=1
result={'scope':'Actual KitCompanion + flat fixture, scripted target/Q; no wrapper in production run. Not World terrain or HP playthrough.','frames':len(c['frames']),'eventsExact':True,'rootStateAndRiderExact':True,'candidateExactBoneFrames':exact,'immediateNativeHandoffFrames':exceptions,'maxCandidateBoneDifference':max_difference,'productionHashes':c['hashes'],'assetSha256':c['assetSha256']}
out.write_text(json.dumps(result,indent=2));print(json.dumps(result))
