/** Read-only native animation diagnostic. No GPU, damage, or human-playability claims. */
import * as THREE from 'three';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const world=resolve(process.argv[2]??'.'),output=resolve(process.argv[3]);
const {CharacterKit}=await import(pathToFileURL(resolve(world,'src/characters/characterKit.ts')).href);
const {CHARACTER_KITS}=await import(pathToFileURL(resolve(world,'src/characters/catalog.ts')).href);
const {readCharacter}=await import(pathToFileURL(resolve(world,'validation/characters/inspect.ts')).href);
const head=()=>execFileSync('git',['-C',world,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sha=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex');
const sourcePaths=['src/characters/characterKit.ts','src/characters/actionBlend.ts','src/characters/catalog.ts','src/characters/musashiLocomotion.ts','src/characters/mountedChargeMotion.ts','src/captainCavalryClip.ts'];
const source=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,await sha(resolve(world,p))])));
const report:any={headBefore:head(),sourceBefore:await source(),scope:'CPU native CharacterKit; in-place state transitions. Nominal-root foot speeds are synthetic straight +Z motion, not actual controller stance proof. Bone positions are not sole mesh clearance.',units:{position:'metres/second',rotation:'radians/second',acceleration:'metres/second²',minFootBoneY:'metres'},actors:[]};
for(const id of ['musashi','blackbeard','napoleonMounted']){
 const definition=CHARACTER_KITS[id],loaded=await readCharacter(fileURLToPath(new URL(definition.assetUrl)));
 const events:any[]=[];let frame=0;const actor=new CharacterKit(loaded.gltf,definition,{onEvent:(event:any)=>events.push({frame,at:event.at,state:event.state,socket:event.socket,position:event.transform?.position.toArray()})});
 const names=id==='musashi'?['mixamorigHips','mixamorigLeftFoot','mixamorigRightFoot','mixamorigLeftHand','mixamorigRightHand','Attachment_LeftHand_Katana','Attachment_RightHand_Katana']:id==='blackbeard'?['Hips','FootL','FootR','UpperArmL','ForearmL','HandL','UpperArmR','ForearmR','HandR','Blackbeard_Muzzle']:['H_ForeHoof_L','H_ForeHoof_R','H_HindHoof_L','H_HindHoof_R','RiderSeatAnchor','SaddleSocket','SaberTip','SaberSocket','Head','UpperArmR','ForearmR','HandR'];
 const nodes=names.map(name=>({name,node:actor.model.getObjectByName(name)}));
 const missing=nodes.filter(v=>!v.node).map(v=>v.name);const valid=nodes.filter(v=>v.node);
 const sample=()=>{actor.root.updateWorldMatrix(true,true);return valid.map(({node}:any)=>({p:node.getWorldPosition(new THREE.Vector3()),q:node.getWorldQuaternion(new THREE.Quaternion()).normalize()}));};
 const result:any={id,assetSha:loaded.sha256,rawAssetSha:loaded.rawSha256,missingNodes:missing,scenarios:[]};
 for(const hz of [30,60,120]){
  const dt=1/hz;
  for(const from of ['idle','walk','run','attack'])for(const to of ['idle','walk','run','attack']){
   actor.play(from,{restart:true});for(let i=0;i<Math.ceil(.45*hz);i++)actor.update(dt);
   let prev=sample(),prevV=prev.map(()=>new THREE.Vector3());
   actor.play(to,{restart:true});events.length=0;
   const contactWindows:any[]=[];const worst:any={position:{value:0},rotation:{value:0},acceleration:{value:0}};let minFootY=Infinity,maxSeatGap=0,finite=true;
   const frames=Math.ceil((definition.clips[to].duration+.5)*hz);
   for(frame=0;frame<frames;frame++){
    actor.update(dt);const now=sample();
    for(let i=0;i<valid.length;i++){
     const velocity=now[i].p.clone().sub(prev[i].p).divideScalar(dt),speed=velocity.length(),rotation=now[i].q.angleTo(prev[i].q)/dt,acceleration=velocity.clone().sub(prevV[i]).length()/dt;
     finite&&=Number.isFinite(speed)&&Number.isFinite(rotation);
     for(const [key,value]of [['position',speed],['rotation',rotation],['acceleration',acceleration]]as const)if((key!=='acceleration'||frame>0)&&value>worst[key].value)worst[key]={value,node:valid[i].name,time:(frame+1)*dt,state:actor.state,clipTime:actor.clipTime};
     if(/Foot|Hoof/.test(valid[i].name))minFootY=Math.min(minFootY,now[i].p.y);
     prevV[i]=velocity;
    }
    if(id==='napoleonMounted'){const a=valid.findIndex(v=>v.name==='RiderSeatAnchor'),b=valid.findIndex(v=>v.name==='SaddleSocket');if(a>=0&&b>=0)maxSeatGap=Math.max(maxSeatGap,now[a].p.distanceTo(now[b].p));}
    if(to==='attack'&&(definition.clips.attack.events??[]).some((e:any)=>Math.abs(actor.clipTime-e.at)<.07))contactWindows.push({time:(frame+1)*dt,clipTime:actor.clipTime,nodes:valid.map((v,i)=>({name:v.name,p:now[i].p.toArray(),q:now[i].q.toArray()}))});
    prev=now;
   }
   result.scenarios.push({hz,from,to,explicitRestart:true,sameStateForcedRestart:from===to,frames,finite,minFootBoneY:minFootY,maxSeatGap,worst,contactWindows,events:[...events],finalState:actor.state});
  }
  // Steady native gait: approximate low-foot band, not a planted-foot contact label.
  for(const state of ['walk','run']){
   actor.play(state,{restart:true});for(let i=0;i<hz;i++)actor.update(dt);const samples:any[]=[];
   const frames=Math.ceil(definition.clips[state].duration*2*hz);
   for(let i=0;i<frames;i++){actor.update(dt);samples.push(sample());}
   const feet=valid.map((v,i)=>({name:v.name,i})).filter(v=>/Foot|Hoof/.test(v.name));
   result.scenarios.push({hz,state,steady:true,nominalSpeed:definition.clips[state].nominalSpeed,feet:feet.map(({name,i})=>{const minY=Math.min(...samples.map(s=>s[i].p.y));const speeds:number[]=[];for(let f=1;f<samples.length;f++)if(samples[f][i].p.y<minY+.015&&samples[f-1][i].p.y<minY+.015){const v=samples[f][i].p.clone().sub(samples[f-1][i].p).divideScalar(dt);v.z+=definition.clips[state].nominalSpeed;speeds.push(Math.hypot(v.x,v.z));}return{name,minBoneY:minY,lowBandPairs:speeds.length,syntheticWorldSpeedMean:speeds.length?speeds.reduce((a,b)=>a+b,0)/speeds.length:null,syntheticWorldSpeedMax:speeds.length?Math.max(...speeds):null};})});
  }
 }
 actor.dispose();report.actors.push(result);console.log('COMPLETE',id,'scenarios',result.scenarios.length,'missing',missing);
}
report.headAfter=head();report.sourceAfter=await source();report.sourceStable=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);await writeFile(output,JSON.stringify(report,null,2),{flag:'wx'});console.log('REPORT',output,'stable',report.sourceStable);
