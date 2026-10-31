import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {CharacterKit,type CharacterKitDefinition}from'../../src/characters/characterKit';import{KitCompanion}from'../../src/kitCompanion';
function fixture(events=[.04,.08],id='qa'){
 const scene=new THREE.Group(),bone=new THREE.Bone();bone.name='qa-hand';scene.add(bone);
 const names=['idle','walk','run','attack'];const clips=names.map(name=>new THREE.AnimationClip(name,1.6,[new THREE.NumberKeyframeTrack('qa-hand.position[x]',[0,.8,1.6],name==='attack'?[0,2,0]:[0,1,0])]));
 const def:CharacterKitDefinition={id,defaultState:'idle',assetUrl:'qa',rootMotion:'in-place',clips:Object.fromEntries(names.map(name=>[name,{name,duration:1.6,loop:name!=='attack',...(name==='attack'?{events:events.map(at=>({at,kind:'hit' as const,socket:'hand'}))}:{nominalSpeed:1})}])),sockets:{hand:{node:'qa-hand'}}};
 const hits:any[]=[];const actor=new CharacterKit({scene,animations:clips}as any,def,{onEvent:e=>hits.push(e)});const actions=(actor as any).actions as Map<string,THREE.AnimationAction>;return{actor,hits,actions};
}
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('independent dual-clock splits at authored events without multiplying visual time',()=>{
 const f=fixture();try{f.actor.play('run');f.actor.update(.2);const run=f.actions.get('run')!;const start=run.time;f.actor.play('attack');f.actor.update(.1,false,.02);
 near(f.actor.clipTime,.1);near(f.actions.get('attack')!.time,.1);near(run.time-start,.02);near(run.getEffectiveWeight(),1-.02/.18);assert.deepEqual(f.hits.map(h=>h.at),[.04,.08]);
 }finally{f.actor.dispose();}
});
test('independent zero-clip hold advances outgoing gait/fade but cannot move attack clock or emit contact; pause/invalid/zero default are inert',()=>{
 const f=fixture();try{f.actor.play('run');f.actor.update(.2);f.actor.play('attack');f.actor.update(.01,false,.01);const run=f.actions.get('run')!,attack=f.actions.get('attack')!,start=run.time,target=attack.time;f.actor.update(0,false,.03);near(run.time-start,.03);near(attack.time,target);near(f.actor.clipTime,.01);assert.equal(f.hits.length,0);
 const snap=()=>JSON.stringify([...f.actions].map(([id,a])=>[id,a.time,a.getEffectiveWeight()]));const before=snap();for(const dt of[0,-1,NaN,Infinity])f.actor.update(dt);f.actor.update(.1,true,.1);assert.equal(snap(),before);assert.equal(f.hits.length,0);
 }finally{f.actor.dispose();}
});
test('independent ordinary/default path matches explicit equal clocks for all transitions and pauses',()=>{
 const a=fixture(),b=fixture();try{for(const state of['walk','run','idle','attack','run','attack']){a.actor.play(state);b.actor.play(state);for(let i=0;i<50;i++){const dt=i%7===0?.1:1/120,paused=i%11===0;a.actor.update(dt,paused);b.actor.update(dt,paused,dt);near(a.actor.clipTime,b.actor.clipTime);for(const[id,x]of a.actions){const y=b.actions.get(id)!;near(x.time,y.time);near(x.getEffectiveWeight(),y.getEffectiveWeight());}near(a.actor.model.getObjectByName('qa-hand')!.position.x,b.actor.model.getObjectByName('qa-hand')!.position.x);}}assert.deepEqual(a.hits.map(x=>x.at),b.hits.map(x=>x.at));}finally{a.actor.dispose();b.actor.dispose();}
});
test('independent companion cycle/slice boundaries conserve caller time and retain contacts/cancel',()=>{
 for(const dt of[1/30,1/60,1/120,.1]){
  const f=fixture([19/30,33/30],'musashi'),player=new THREE.Vector3();const follow=new KitCompanion({colliders:[],range:4,damage:1,target:()=>null,strike:()=>null});const original=(f.actor as any).options.onEvent;(f.actor as any).options.onEvent=(e:any)=>{original(e);follow.onEvent(f.actor,e);};f.actor.play('run',{rate:3});f.actor.update(.2);
  const calls:{clip:number;visual:number|undefined}[]=[];const update=f.actor.update.bind(f.actor);f.actor.update=(clip,paused=false,visual?)=>{calls.push({clip,visual});update(clip,paused,visual);};let contacts=0,finished=false;
  assert.equal(follow.startSkillPose(f.actor,{slot:'ultimate',direction:{x:0,y:0,z:1},contacts:3,onContact:()=>contacts++,onFinish:ok=>{finished=ok;}},player,0),true);let split=false,hold=false;
  for(let i=0;i<400&&!finished;i++){calls.length=0;follow.update(f.actor,dt,player,0,false);const supplied=calls.filter(c=>c.visual!==undefined);const sum=supplied.reduce((n,c)=>n+c.visual!,0);assert.ok(sum<=dt+1e-9,`visual time duplicated at dt ${dt}: ${sum}`);split||=supplied.length>1;hold||=supplied.some(c=>c.clip===0&&c.visual!>0);}
  assert.equal(contacts,3);assert.equal(finished,true);assert.ok(hold);if(dt===.1)assert.ok(split);const count=f.hits.length;follow.release(f.actor);for(let i=0;i<40;i++)f.actor.update(dt);assert.equal(f.hits.length,count);f.actor.dispose();
 }
});

test('ordinary ActionBlend poses, times and weights remain bit-exact against explicit pre-dual-clock fixture',async()=>{
 const {ActionBlend}=await import('../../src/characters/actionBlend');const{ActionBlend:Legacy}=await import('../fixtures/action-blend-pre-dual-clock');
 const make=(Blend:typeof ActionBlend|typeof Legacy)=>{const root=new THREE.Group();root.name='actor';const mixer=new THREE.AnimationMixer(root);const clips=[0,1,2].map(i=>new THREE.AnimationClip('state'+i,1+i*.2,[new THREE.NumberKeyframeTrack('.position[x]',[0,.5,1+i*.2],[i,2-i,i])]));return{root,mixer,actions:clips.map(c=>mixer.clipAction(c)),blend:new Blend()};};
 const a=make(ActionBlend),b=make(Legacy);
 for(let f=0;f<900;f++){if(f%19===0||f===0){const id=Math.floor(f/19)%3;for(const v of[a,b]){const action=v.actions[id];v.blend.start(action,.18,()=>{action.reset().setEffectiveTimeScale(id===1?2.7:1).setLoop(THREE.LoopRepeat,Infinity).play();});}}
 const dt=[1/30,1/60,1/120,.1][f%4];a.blend.update(a.mixer,dt);b.blend.update(b.mixer,dt);assert.deepEqual(a.root.position.toArray(),b.root.position.toArray());assert.deepEqual(a.actions.map(x=>[x.time,x.getEffectiveWeight(),x.getEffectiveTimeScale()]),b.actions.map(x=>[x.time,x.getEffectiveWeight(),x.getEffectiveTimeScale()]));}
});
