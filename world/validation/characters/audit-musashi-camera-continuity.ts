import{MusashiWindupCamera}from'../../src/musashiWindupCamera';
import{nativeStageProjection}from'../remaster-review/native-stage-projection';
/** Continuous CPU temporal QA; no WebGL/GPU claim. */
import * as THREE from 'three';import {mkdir,writeFile,readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';
import {UltimateClock} from '../../src/ultimateDirector.ts';
import {CHARACTER_KITS} from '../../src/characters/catalog.ts';
import {readCharacter} from './inspect.ts';import {SERVANT_MODELS,SERVANT_MOTION} from '../../src/servant.ts';import {UltimateStage} from '../../src/ultimateStage.ts';import {skillAnimationProfile,skillAnimationSample} from '../../src/skillAnimationProfile.ts';
const out=process.argv[2];if(!out)throw Error('output directory required');await mkdir(out,{recursive:true});const selected=process.argv.find(x=>x.startsWith('--frames='))?.split('=')[1];const keyOnly=process.argv.includes('--keyframes')||!!selected;
const sourceHashes:Record<string,string>={};for(const f of ['../../src/musashiWindupCamera.ts','../../src/musashiUltimatePerformance.ts','../../src/ultimateStage.ts','../../src/saberStageArt.ts','../../src/eraStageArt.ts','../../src/mountedStageArt.ts','../../src/musashiStageArt.ts','../../src/eraBladeTrace.ts','../../tools/gen/blacksail/ships.ts','../../src/ultimateEnergy.ts','../../src/ultimatePerformance.ts','../../src/eraUltimatePerformance.ts','../../src/eraCinematicRemake.ts','../../src/cinematicTricorn.ts','../../src/cinematicTricornData.json','../../src/ultimateDirector.ts','../../src/ultimateDirector.css','../../assets/cinematics/saber-cut-in-v2.webp','../../assets/cinematics/blackbeard-cut-in-v2.webp','../../assets/cinematics/napoleon-cut-in-v2.webp','../../assets/cinematics/musashi-cut-in-v2.webp','./export-era-ultimate-sequence.ts','./render-ultimate-stages.py'])sourceHashes[f]=createHash('sha256').update(await readFile(new URL(f,import.meta.url))).digest('hex');
const identity=(process.argv.find(x=>x.startsWith('--identity='))?.split('=')[1]??'blackbeard') as 'blackbeard'|'napoleon'|'musashi';
const definition=CHARACTER_KITS[identity==='napoleon'?'napoleonMounted':identity];const asset=fileURLToPath(definition.assetUrl);const {gltf}=await readCharacter(asset);const root=gltf.scene,mixer=new THREE.AnimationMixer(root),idle=gltf.animations.find(c=>c.name===definition.clips.idle.name)!,attack=gltf.animations.find(c=>c.name===definition.clips.attack.name)!;mixer.clipAction(idle).play();mixer.update(.01);
const stage=new UltimateStage();stage.begin({identity,sourceRoot:root,clips:gltf.animations,reducedEffects:process.argv.includes('--reduced')});
const contacts=definition.clips.attack.events.map(e=>e.at),contact=contacts[0],wanted=identity==='napoleon'?1:3;const cycles:{start:number;duration:number;profile:ReturnType<typeof skillAnimationProfile>}[]=[],hits:number[]=[];let total=0;
for(let cycle=0;hits.length<wanted;cycle++){const profile=skillAnimationProfile(definition.id,'ultimate',cycle),sample=skillAnimationSample(profile,0,attack.duration,contact);cycles.push({start:total,duration:sample.duration,profile});for(const event of contacts){if(hits.length>=wanted)break;let lo=0,hi=sample.duration;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(skillAnimationSample(profile,mid,attack.duration,contact).clipTime<event)lo=mid;else hi=mid;}hits.push(total+hi);}total+=sample.duration;}
const fps=Number(process.argv.find(x=>x.startsWith('--fps='))?.split('=')[1]??12);
if(!Number.isFinite(fps)||fps<1||fps>60||60%fps!==0)throw Error('fps must divide 60');
const stride=60/fps,clock=new UltimateClock();clock.begin(identity,'full');
let releaseStart=-1,notified=0;const keys=new Set([Math.round(.5*fps),Math.round(1.5*fps),Math.round(2.5*fps),Math.round(3.5*fps),Math.round(4.5*fps)]);
if(selected){keys.clear();for(const n of selected.split(','))keys.add(Number(n));}
const rows:{elapsed:number;phase:string;progress:number;strikeCount:number;position:number[];quaternion:number[];fov:number}[]=[];
for(let tick=0;tick<=1200;tick++){
 if(tick>0)clock.tick(1/60);
 if(clock.releasing){
  if(releaseStart<0){releaseStart=tick/60;mixer.stopAllAction();const action=mixer.clipAction(attack).reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();if(!selected){for(const hit of hits)for(const offset of[0,.08,.18])keys.add(Math.round((releaseStart+hit+offset)*fps));keys.add(Math.round((releaseStart+total+.4)*fps));}}
  const age=tick/60-releaseStart,cycle=cycles.find(c=>age<c.start+c.duration)??cycles[cycles.length-1];mixer.setTime(skillAnimationSample(cycle.profile,age-cycle.start,attack.duration,contact).clipTime);
  const count=hits.filter(h=>age>=h).length;while(notified<count){notified++;clock.notifyStrike();}if(age>=total)clock.complete();
 }
 const frame=clock.frame;if(!frame)break;
 const{elapsed,phase,progress,pulse,strikeCount}=frame,frameIndex=Math.round(tick/stride);
 stage.update({...frame,sourceRoot:root});stage.setAspect(16/9);stage.scene.updateMatrixWorld(true);stage.camera.updateMatrixWorld(true);


 const camera=stage.camera;rows.push({elapsed,phase,progress,strikeCount,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov});
}
const jumps=rows.slice(1).map((r,i)=>({time:r.elapsed,phase:r.phase,progress:r.progress,strikeCount:r.strikeCount,phaseChanged:r.phase!==rows[i].phase,contactChanged:r.strikeCount!==rows[i].strikeCount,distance:new THREE.Vector3(...r.position as[number,number,number]).distanceTo(new THREE.Vector3(...rows[i].position as[number,number,number]))}));const maximum=(list:typeof jumps)=>list.reduce((a,b)=>a.distance>b.distance?a:b);const report={scope:'Native complete component stage camera, no GPU or actual input claim',sourceHashes,rows,maxSamePhaseNoContact:maximum(jumps.filter(r=>!r.phaseChanged&&!r.contactChanged)),chargePointThree:jumps.filter(r=>r.phase==='charge'&&r.progress>.28&&r.progress<.32),intentionalCuts:jumps.filter(r=>r.phaseChanged||r.contactChanged)};await writeFile(path.join(out,'camera-continuity.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined},null,2));stage.dispose();
