/** Deterministic actual WebGL scene capture. No portrait compositor or simulated screenshot. */
import * as THREE from 'three';
import { UltimateStage } from '../../src/ultimateStage';
import { UltimateClock } from '../../src/ultimateDirector';
import { SERVANT_MODELS,SERVANT_MOTION,loadServantGltf } from '../../src/servant';
import { CHARACTER_KITS } from '../../src/characters/catalog';
import {skillAnimationProfile,skillAnimationSample} from '../../src/skillAnimationProfile';
const identity=new URLSearchParams(location.search).get('identity')||'saber';
const def=identity==='saber'?null:CHARACTER_KITS[identity==='napoleon'?'napoleonMounted':identity as 'blackbeard'|'musashi'];
const gltf=await loadServantGltf(def?.assetUrl||SERVANT_MODELS.armor);
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=.98;
const stage=new UltimateStage(),root=gltf.scene,mixer=new THREE.AnimationMixer(root);
const idle=gltf.animations.find(c=>c.name===(def?.clips.idle.name||'Idle'))!,attack=gltf.animations.find(c=>c.name===(def?.clips.attack.name||'Attack'))!;
const contact=def?.clips.attack.events[0].at??attack.duration*SERVANT_MOTION.attackContact;
const contacts=def?.clips.attack.events.map(e=>e.at)||[contact];const wanted=identity==='blackbeard'||identity==='musashi'?3:1;
let time=0,releaseStart=-1,strikes=0,done=false;let clock=new UltimateClock();
const cycles:{start:number;duration:number;profile:ReturnType<typeof skillAnimationProfile>}[]=[],hits:number[]=[];let total=0;
for(let cycle=0;hits.length<wanted;cycle++){const profile=skillAnimationProfile(def?.id||'saber','ultimate',cycle),sample=skillAnimationSample(profile,0,attack.duration,contact);cycles.push({start:total,duration:sample.duration,profile});for(const event of contacts){if(hits.length>=wanted)break;let lo=0,hi=sample.duration;for(let i=0;i<40;i++){let mid=(lo+hi)/2;if(skillAnimationSample(profile,mid,attack.duration,contact).clipTime<event)lo=mid;else hi=mid;}hits.push(total+hi);}total+=sample.duration;}
function reset(){stage.end();mixer.stopAllAction();mixer.clipAction(idle).reset().play();mixer.setTime(.01);clock=new UltimateClock();clock.begin(identity,'full');stage.begin({identity,sourceRoot:root,clips:gltf.animations});time=0;releaseStart=-1;strikes=0;done=false;}
function step(dt:number){time+=dt;clock.tick(dt);if(clock.releasing){if(releaseStart<0){releaseStart=time;mixer.stopAllAction();const action=mixer.clipAction(attack).reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();}const age=time-releaseStart;const cycle=cycles.find(c=>age<c.start+c.duration)||cycles[cycles.length-1];mixer.setTime(skillAnimationSample(cycle.profile,age-cycle.start,attack.duration,contact).clipTime);const n=hits.filter(h=>age>=h).length;while(strikes<n){strikes++;clock.notifyStrike();}if(age>=total)clock.complete();}const frame=clock.frame;if(frame)stage.update({...frame,sourceRoot:root});else done=true;}
function draw(){stage.render(renderer,innerWidth/innerHeight);}
reset();draw();
(window as any).__cinema={ready:true,identity,totalRelease:total,hits,seek(t:number){if(t<time)reset();while(time+1e-7<t&&!done)step(Math.min(1/60,t-time));draw();return {time,frame:clock.frame,strikes,done,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},reset,render:draw,renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER)};

// Manual isolated-scene review, never controls or injects a production combat cast.
const controls=document.querySelector<HTMLElement>('#controls')!,play=document.querySelector<HTMLButtonElement>('#play')!;
if(new URLSearchParams(location.search).has('capture'))controls.style.display='none';
let playing=false,last=0;
function toggle(){if(done)reset();playing=!playing;play.textContent=playing?'Pause':'Play';last=performance.now();}
play.onclick=toggle;document.querySelector<HTMLButtonElement>('#restart')!.onclick=()=>{reset();draw();playing=true;last=performance.now();play.textContent='Pause';};
addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();toggle();}else if(event.code==='KeyR'){reset();draw();}});
function animate(now:number){if(playing){step(Math.min(.1,Math.max(0,(now-last)/1000)));draw();if(done){playing=false;play.textContent='Play';}}last=now;requestAnimationFrame(animate);}
requestAnimationFrame(animate);
