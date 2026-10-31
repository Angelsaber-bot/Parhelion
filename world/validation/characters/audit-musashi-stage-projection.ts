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
if(process.argv.includes('--camera-candidate')){const internal=stage as any,helper=new MusashiWindupCamera(internal.actor),cinema=internal.eraCinema,original=cinema.update.bind(cinema);cinema.update=(frame:any,camera:THREE.PerspectiveCamera,reduced:boolean)=>{original(frame,camera,reduced);cinema.aim.copy(helper.update(frame,camera,reduced,cinema.aim));};}
const contacts=definition.clips.attack.events.map(e=>e.at),contact=contacts[0],wanted=identity==='napoleon'?1:3;const cycles:{start:number;duration:number;profile:ReturnType<typeof skillAnimationProfile>}[]=[],hits:number[]=[];let total=0;
for(let cycle=0;hits.length<wanted;cycle++){const profile=skillAnimationProfile(definition.id,'ultimate',cycle),sample=skillAnimationSample(profile,0,attack.duration,contact);cycles.push({start:total,duration:sample.duration,profile});for(const event of contacts){if(hits.length>=wanted)break;let lo=0,hi=sample.duration;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(skillAnimationSample(profile,mid,attack.duration,contact).clipTime<event)lo=mid;else hi=mid;}hits.push(total+hi);}total+=sample.duration;}
const fps=Number(process.argv.find(x=>x.startsWith('--fps='))?.split('=')[1]??12);
if(!Number.isFinite(fps)||fps<1||fps>60||60%fps!==0)throw Error('fps must divide 60');
const stride=60/fps,clock=new UltimateClock();clock.begin(identity,'full');
let releaseStart=-1,notified=0;const keys=new Set([Math.round(.5*fps),Math.round(1.5*fps),Math.round(2.5*fps),Math.round(3.5*fps),Math.round(4.5*fps)]);
if(selected){keys.clear();for(const n of selected.split(','))keys.add(Number(n));}
const seen=new Set<string>(),rows:any[]=[];
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

 const phaseKey=process.argv.includes('--sweep')&&phase==='charge'?`charge-${Math.floor(progress*20)}`:phase==='charge'&&progress>=.9?'late-charge':phase;
 if((phase==='charge'&&progress>=.45||phase==='release'&&progress>=.1)&&!seen.has(phaseKey)){seen.add(phaseKey);rows.push({elapsed,phase,progress,strikeCount,projection:nativeStageProjection(stage)});}
}
stage.dispose();await writeFile(path.join(out,'projection.json'),JSON.stringify({identity,asset,sourceHashes,scope:'component native stage at production clock; no actual input or GPU claim',rows},null,2));console.log(JSON.stringify(rows.map(r=>({phase:r.phase,progress:r.progress,clipped:r.projection.map((p:any)=>({aspect:p.aspect,meshes:p.meshes.filter((m:any)=>m.outside||m.behind).map((m:any)=>({name:m.name,outside:m.outside,min:m.min,max:m.max}))}))}))));
