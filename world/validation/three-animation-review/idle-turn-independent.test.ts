import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fileURLToPath} from 'node:url';
import {readCharacter} from '../characters/inspect';
import {CHARACTER_KITS} from '../../src/characters/catalog';
import {CharacterKit} from '../../src/characters/characterKit';
import {MountedIdleTurn} from '../../src/mountedIdleTurn';
const legs=/^H_(Fore(Upper|Cannon|Hoof)|Hind(Thigh|Shin|Cannon|Hoof))_[LR]$/;
async function pair(disableAutomatic=true){
 const {gltf}=await readCharacter(fileURLToPath(CHARACTER_KITS.napoleonMounted.assetUrl));
 const second=await readCharacter(fileURLToPath(CHARACTER_KITS.napoleonMounted.assetUrl));
 const a=new CharacterKit(gltf,CHARACTER_KITS.napoleonMounted),b=new CharacterKit(second.gltf,CHARACTER_KITS.napoleonMounted);assert.notEqual(a.model,b.model);
 // Helper boundary tests explicitly disable the default hook on BOTH actors,
 // avoiding a fixed-vs-fixed or double-application comparison.
 if(disableAutomatic)for(const actor of[a,b]){const host=actor as unknown as {idleTurn?:MountedIdleTurn};host.idleTurn?.dispose();host.idleTurn=undefined;}
 const candidate=new MountedIdleTurn(b.root,b.model),bones:T.Object3D[]=[];a.model.traverse(o=>{if((o as T.Bone).isBone)bones.push(o)});
 const exact=(all=false)=>{assert.deepEqual(b.root.position.toArray(),a.root.position.toArray());assert.deepEqual(b.root.quaternion.toArray(),a.root.quaternion.toArray());assert.equal(a.clipTime,b.clipTime);for(const bone of bones){const other=b.model.getObjectByName(bone.name)!;assert.deepEqual(other.position.toArray(),bone.position.toArray());assert.deepEqual(other.scale.toArray(),bone.scale.toArray());if(all||!legs.test(bone.name))assert.deepEqual(other.quaternion.toArray(),bone.quaternion.toArray(),bone.name);}};
 const step=(yaw:number,state='idle',dt=1/60)=>{candidate.restore();a.root.rotation.y=b.root.rotation.y=yaw;a.play(state);b.play(state);a.update(dt);b.update(dt);candidate.apply(dt,b.state);exact();};
 return {a,b,candidate,bones,exact,step,dispose(){candidate.reset();a.dispose();b.dispose();}};
}
test('production helper native idle-turn wrap/reversal/stop and state handoff retain non-leg ownership',async t=>{
 const p=await pair();try{let yaw=Math.PI-.08;for(let i=0;i<30;i++)p.step(yaw);for(let i=0;i<30;i++){p.step(yaw+(i%2?.0002:-.0002));p.exact(true);}let lifted=0;
 for(let i=0;i<180;i++){yaw+=(i<90?1:-1)*.025;p.step(Math.atan2(Math.sin(yaw),Math.cos(yaw)));const a=p.a.model.getObjectByName('H_ForeHoof_L')!.getWorldPosition(new T.Vector3()),b=p.b.model.getObjectByName('H_ForeHoof_L')!.getWorldPosition(new T.Vector3());if(b.y-a.y>.02)lifted++;}
 assert.ok(lifted>10);for(let i=0;i<30;i++)p.step(yaw);p.exact(true);
 for(const state of ['walk','run','attack']){for(let i=0;i<12;i++)p.step(yaw+.02*i);p.step(yaw,state);p.exact(true);}t.diagnostic(JSON.stringify({lifted,...p.candidate.diagnostics}));
 }finally{p.dispose();}});
test('production helper native idle-turn invalid dt inert; reset/translation/discontinuous yaw release anchors',async()=>{
 const p=await pair();try{for(let i=0;i<60;i++)p.step(i*.025);const snapshot=()=>p.bones.map(b=>p.b.model.getObjectByName(b.name)!.quaternion.toArray());const before=snapshot(),frames=p.candidate.diagnostics.frames;
 for(const dt of [0,-1,NaN,Infinity,.101]){p.candidate.apply(dt,'idle');assert.deepEqual(snapshot(),before);assert.equal(p.candidate.diagnostics.frames,frames);}
 p.candidate.reset();p.exact(true);p.step(1.5);p.a.root.position.x=p.b.root.position.x=20;p.step(1.52);p.exact(true);for(let i=0;i<12;i++)p.step(1.52+i*.02);p.step(-1.5);p.exact(true);p.candidate.reset();p.step(-1.5);p.exact(true);
 }finally{p.dispose();}});

test('production helper native idle-turn rejects tilted root instead of treating pitch as a yaw step',async()=>{
 const p=await pair();try{for(let i=0;i<20;i++)p.step(0);for(let i=1;i<=12;i++){p.candidate.restore();p.a.root.rotation.x=p.b.root.rotation.x=i*.01;p.a.update(1/60);p.b.update(1/60);p.candidate.apply(1/60,'idle');p.exact(true);}}finally{p.dispose();}
});

test('production helper active turn is canonicalized only on private X clone, preserving source and framing',async()=>{
 const {UltimateStage}=await import('../../src/ultimateStage');const p=await pair(),a=new UltimateStage(),b=new UltimateStage();
 try{for(let i=0;i<45;i++)p.step(i*.03);assert.ok(p.candidate.diagnostics.frames>0);const sourceBefore=p.bones.map(o=>p.b.model.getObjectByName(o.name)!.quaternion.toArray());
 a.begin({identity:'napoleon',sourceRoot:p.a.root,clips:p.a.presentationClips});b.begin({identity:'napoleon',sourceRoot:p.b.root,clips:p.b.presentationClips});
 for(const frame of [{elapsed:0,phase:'intro' as const,progress:0,pulse:0},{elapsed:.5,phase:'intro' as const,progress:.5,pulse:0},{elapsed:2,phase:'charge' as const,progress:.5,pulse:0}]){a.update(frame);b.update(frame);a.scene.updateMatrixWorld(true);b.scene.updateMatrixWorld(true);for(const bone of p.bones){const x=a.scene.getObjectByName(bone.name)!,y=b.scene.getObjectByName(bone.name)!;assert.deepEqual(y.position.toArray(),x.position.toArray(),bone.name);assert.deepEqual(y.quaternion.toArray(),x.quaternion.toArray(),bone.name);assert.deepEqual(y.scale.toArray(),x.scale.toArray(),bone.name);}assert.deepEqual(b.camera.position.toArray(),a.camera.position.toArray());assert.deepEqual(b.camera.quaternion.toArray(),a.camera.quaternion.toArray());}
 assert.deepEqual(p.bones.map(o=>p.b.model.getObjectByName(o.name)!.quaternion.toArray()),sourceBefore);
 }finally{a.dispose();b.dispose();p.dispose();}
});

test('default native constructor positively applies turn steps and pause/state exit retains ownership',async()=>{
 const p=await pair(false);try{
 const baseline=p.a as unknown as {idleTurn?:MountedIdleTurn};assert.ok(baseline.idleTurn);baseline.idleTurn.dispose();baseline.idleTurn=undefined;
 const live=p.b as unknown as {idleTurn?:MountedIdleTurn};assert.ok(live.idleTurn);let changed=0;
 for(let i=0;i<90;i++){p.a.root.rotation.y=p.b.root.rotation.y=i*.025;p.a.update(1/60);p.b.update(1/60);p.exact();const x=p.a.model.getObjectByName('H_ForeUpper_L')!,y=p.b.model.getObjectByName('H_ForeUpper_L')!;if(x.quaternion.angleTo(y.quaternion)>1e-4)changed++;}
 assert.ok(changed>30);assert.ok(live.idleTurn.diagnostics.frames>30);const before=p.bones.map(o=>p.b.model.getObjectByName(o.name)!.quaternion.toArray());p.b.update(.1,true);assert.deepEqual(p.bones.map(o=>p.b.model.getObjectByName(o.name)!.quaternion.toArray()),before);
 p.a.play('attack');p.b.play('attack');p.exact(true);for(let i=0;i<120;i++){p.a.update(1/60);p.b.update(1/60);p.exact(true);}
 }finally{p.dispose();}
});
