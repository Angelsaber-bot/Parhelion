import json,math
from pathlib import Path
R=Path(__file__).resolve().parent
rs=json.loads((R/'three-validation.json').read_text());meta=json.loads((R/'animation-metadata.json').read_text());summaries=[]
for r in rs:
 errors=[];warnings=[]
 if not all(x['present'] for x in r['requiredClips']):errors.append('Missing required animation')
 if r['boneCount']<50:errors.append('Missing skeleton bones')
 if max(m['morphTargets'] for m in r['meshes'])<56:errors.append('Missing facial morph targets')
 if any(m['zeroWeightVertices'] or m['badWeights'] or m['maxInfluences']>4 or m['maxSumError']>1e-5 for m in r['meshes']):errors.append('Invalid skin weights')
 loops=[];stance=[]
 for c in r['clips']:
  if c['movingTracks']<10:errors.append(c['name']+' insufficient motion')
  if any(f['nonfinite'] for f in c['frames']):errors.append(c['name']+' nonfinite deformed vertices')
  f0,f1=c['frames'][0],c['frames'][-1]
  err=max(abs(f0['bbox'][key][i]-f1['bbox'][key][i]) for key in ['min','max'] for i in range(3));loops.append({'clip':c['name'],'endpoint_bbox_delta_m':err})
  if err>2e-4:errors.append(c['name']+' endpoint discontinuity')
  if c['name'] in ['Walk','Run']:
   info=meta['clips'][c['name']];speed=info['nominal_speed_source_mps']*.72;duty=info['stance_duty'];vals=[]
   for a,b in zip(c['frames'],c['frames'][1:]):
    for side,offset in [('Left',0),('Right',.5)]:
     pa=(a['time']/c['duration']+offset)%1;pb=(b['time']/c['duration']+offset)%1
     if pa<duty and pb<duty and pb>pa:
      key=next(k for k in a['feet'] if k.endswith(side+'Foot'));actual=(b['feet'][key][2]-a['feet'][key][2])/(b['time']-a['time']);vals.append(abs(actual+speed))
   maxerr=max(vals,default=0);stance.append({'clip':c['name'],'nominal_forward_mps':speed,'max_stance_compensation_velocity_error_mps':maxerr})
   if maxerr>.015:errors.append(c['name']+' stance foot-slide error')
 for tr in r['transitions']:
  if any(f['nonfinite'] for f in tr['samples']):errors.append('Nonfinite crossfade '+tr['from']+' -> '+tr['to'])
 if r['warnings']:warnings+=r['warnings']
 summaries.append({'file':r['file'],'pass':not errors,'errors':errors,'warnings':warnings,'triangles':r['triangles'],'draw_material_groups':r['meshCount'],'bones':r['boneCount'],'morph_targets':max(m['morphTargets'] for m in r['meshes']),'loop_endpoints':loops,'stance_checks':stance,'crossfades_tested':len(r['transitions']),'note':'Actual Three.js CPU vertex skinning, morph loading and AnimationMixer. Texture loading stubbed in Node; not a browser/GPU claim.'})
(R/'validation-summary.json').write_text(json.dumps(summaries,indent=2));print(json.dumps(summaries,indent=2))
if any(not x['pass'] for x in summaries):raise SystemExit(1)
