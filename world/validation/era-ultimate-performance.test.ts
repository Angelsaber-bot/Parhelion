import{createBaselineMusashiUltimatePerformance}from'./musashi-continuity/baseline-performance';
import{test}from'node:test';import assert from'node:assert/strict';import * as T from'three';import{clone}from'three/examples/jsm/utils/SkeletonUtils.js';import{readCharacter}from'./characters/inspect.ts';import{CHARACTER_KITS}from'../src/characters/catalog.ts';import{fileURLToPath}from'node:url';import{createEraUltimatePerformance}from'../src/eraUltimatePerformance.ts';
test('Musashi three contacts author right, left, then crossed dual strokes without touching source',async()=>{const{gltf}=await readCharacter(fileURLToPath(CHARACTER_KITS.musashi.assetUrl)),source=gltf.scene,copy=clone(source),p=createEraUltimatePerformance('musashi',copy);const before=JSON.stringify(source.toJSON());p.update({phase:'charge',elapsed:2,progress:1});const r=copy.getObjectByName('mixamorigRightHand')!,l=copy.getObjectByName('mixamorigLeftHand')!,rp=r.getWorldPosition(new T.Vector3()),lp=l.getWorldPosition(new T.Vector3());p.update({phase:'release',elapsed:3,progress:.1,strikeCount:1});p.update({phase:'release',elapsed:3.18,progress:.2,strikeCount:1});assert.ok(r.getWorldPosition(new T.Vector3()).distanceTo(rp)>.3);assert.ok(l.getWorldPosition(new T.Vector3()).y>lp.y+.25,'left prepares high while right performs first cut');p.update({phase:'release',elapsed:3.5,progress:.3,strikeCount:1});const lhigh=l.getWorldPosition(new T.Vector3());p.update({phase:'release',elapsed:3.6,progress:.4,strikeCount:2});p.update({phase:'release',elapsed:3.78,progress:.5,strikeCount:2});assert.ok(l.getWorldPosition(new T.Vector3()).distanceTo(lhigh)>.3);p.update({phase:'release',elapsed:4.2,progress:.7,strikeCount:3});p.update({phase:'release',elapsed:4.38,progress:.8,strikeCount:3});assert.ok(r.getWorldPosition(new T.Vector3()).x>l.getWorldPosition(new T.Vector3()).x);assert.equal(JSON.stringify(source.toJSON()),before);copy.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));p.dispose();});
test('Musashi 60Hz sequence has no contact-boundary wrist teleport',async()=>{const{gltf}=await readCharacter(fileURLToPath(CHARACTER_KITS.musashi.assetUrl)),copy=clone(gltf.scene),p=createEraUltimatePerformance('musashi',copy),hands=['mixamorigRightHand','mixamorigLeftHand'].map(n=>copy.getObjectByName(n)!),previous=hands.map(()=>new T.Vector3());let maxStep=0;for(let tick=0;tick<=312;tick++){const elapsed=tick/60,phase=elapsed<.65?'intro':elapsed<2.55?'charge':'release',progress=phase==='intro'?elapsed/.65:phase==='charge'?(elapsed-.65)/1.9:(elapsed-2.55)/2.9;p.update({phase,elapsed,progress,strikeCount:[3.07327731,3.25994398,3.72505388].filter(t=>elapsed>=t).length});hands.forEach((h,i)=>{const pos=h.getWorldPosition(new T.Vector3());if(tick>0)maxStep=Math.max(maxStep,pos.distanceTo(previous[i]));previous[i].copy(pos);});}assert.ok(maxStep<.16,`wrist step ${maxStep}m`);p.dispose();});
test('Mounted entire saber segment stays outboard of horse neck/head through contact sweep',async()=>{const{gltf}=await readCharacter(fileURLToPath(CHARACTER_KITS.napoleonMounted.assetUrl)),copy=clone(gltf.scene),p=createEraUltimatePerformance('napoleon',copy,gltf.animations);const grip=copy.getObjectByName('SaberSocket')!,tip=copy.getObjectByName('SaberTip')!,neck=copy.getObjectByName('H_Neck')!,head=copy.getObjectByName('H_Head')!;let minClearance=Infinity;for(let i=0;i<=30;i++){const elapsed=3+i/120;p.update({phase:'release',elapsed,progress:.3+i/600,strikeCount:1});const a=grip.getWorldPosition(new T.Vector3()),b=tip.getWorldPosition(new T.Vector3()),n=neck.getWorldPosition(new T.Vector3()),h=head.getWorldPosition(new T.Vector3());for(let j=0;j<=20;j++){const point=a.clone().lerp(b,j/20);if(point.y>=n.y-.2&&point.y<=h.y+.35&&point.z>=n.z-.3&&point.z<=h.z+.35){const clearance=n.x-.30-point.x;minClearance=Math.min(minClearance,clearance);assert.ok(clearance>.035,`blade/neck outboard clearance ${clearance}`);}}}assert.ok(Number.isFinite(minClearance));p.dispose();});

test('Musashi contact cross exits by staggered release recovery while the frozen legacy hold stays documented',async t=>{
 const {gltf}=await readCharacter(fileURLToPath(CHARACTER_KITS.musashi.assetUrl)),copy=clone(gltf.scene),p=createEraUltimatePerformance('musashi',copy);
 const names=['mixamorigRightHand','mixamorigLeftHand','mixamorigLeftFoot','mixamorigRightFoot'],bones=names.map(n=>copy.getObjectByName(n)!);
 const legacyRoot=clone(gltf.scene),legacy=createBaselineMusashiUltimatePerformance(legacyRoot);legacy.update({phase:'release',elapsed:3,progress:.8,strikeCount:3});legacy.update({phase:'release',elapsed:3.5,progress:1,strikeCount:3});assert.ok(legacyRoot.getObjectByName('mixamorigRightHand')!.getWorldPosition(new T.Vector3()).x>legacyRoot.getObjectByName('mixamorigLeftHand')!.getWorldPosition(new T.Vector3()).x,'frozen 6be held its crossing through +.5s');legacy.dispose();
 p.update({phase:'release',elapsed:3,progress:.8,strikeCount:3});p.update({phase:'release',elapsed:3.1,progress:.9,strikeCount:3});
 const cross=bones.slice(0,2).map(b=>b.getWorldPosition(new T.Vector3()));p.update({phase:'release',elapsed:3.5,progress:1,strikeCount:3});const previous=bones.map(b=>b.getWorldPosition(new T.Vector3()));assert.ok(previous[0].x<previous[1].x,'new release exits its crossing before outro');let maxStep=0,minFoot=Infinity;
 for(let i=0;i<=60;i++){
  p.update({phase:'outro',elapsed:3.5+i/60,progress:i/60,strikeCount:3});
  bones.forEach((bone,j)=>{const position=bone.getWorldPosition(new T.Vector3());if(j<2)maxStep=Math.max(maxStep,position.distanceTo(previous[j]));else minFoot=Math.min(minFoot,position.y);previous[j].copy(position);});
 }
 assert.ok(cross[0].x>cross[1].x);assert.ok(previous[0].x<previous[1].x-.4);assert.ok(maxStep<.04);assert.ok(minFoot>-.02);
 t.diagnostic(JSON.stringify({maxRecoveryHandStep:maxStep,minFootHeight:minFoot}));p.dispose();
});
test('mounted aftermath raises saber outboard while left rein contact remains stable',async()=>{
 const {gltf}=await readCharacter(fileURLToPath(CHARACTER_KITS.napoleonMounted.assetUrl)),copy=clone(gltf.scene),p=createEraUltimatePerformance('napoleon',copy,gltf.animations);
 p.update({phase:'release',elapsed:3,progress:.7,strikeCount:1});p.update({phase:'release',elapsed:3.4,progress:1,strikeCount:1});
 const grip=copy.getObjectByName('SaberSocket')!,tip=copy.getObjectByName('SaberTip')!,hand=copy.getObjectByName('HandL')!,rein=copy.getObjectByName('H_ReinGrip')!;
 const before=tip.getWorldPosition(new T.Vector3()).sub(grip.getWorldPosition(new T.Vector3())).normalize();
 for(let i=0;i<=60;i++){p.update({phase:'outro',elapsed:3.4+i/60,progress:i/60,strikeCount:1});assert.ok(hand.getWorldPosition(new T.Vector3()).distanceTo(rein.getWorldPosition(new T.Vector3()))<.08);}
 const after=tip.getWorldPosition(new T.Vector3()).sub(grip.getWorldPosition(new T.Vector3())).normalize();assert.ok(after.y>before.y+.5);assert.ok(after.x<-.2);p.dispose();
});

test('Musashi stage calibration does not capture a running foot or live attack lean as its rest pose',async t=>{
 const {CharacterKit}=await import('../src/characters/characterKit.ts');const {UltimateStage}=await import('../src/ultimateStage.ts');
 const {gltf}=await readCharacter(fileURLToPath(CHARACTER_KITS.musashi.assetUrl)),actor=new CharacterKit(gltf,CHARACTER_KITS.musashi,{transitionSeconds:0});
 const result:T.Vector3[][]=[];
 for(const state of ['idle','run','attack']){
  actor.play(state,{restart:true});actor.update(.23);actor.root.updateMatrixWorld(true);
  const before=new Map<T.Object3D,{p:T.Vector3;q:T.Quaternion}>();actor.root.traverse(o=>before.set(o,{p:o.position.clone(),q:o.quaternion.clone()}));
  const stage=new UltimateStage();stage.begin({identity:'musashi',sourceRoot:actor.root,clips:actor.presentationClips});stage.update({phase:'intro',elapsed:.3,progress:.25,pulse:0,strikeCount:0,sourceRoot:actor.root});
  const copy=(stage as any).clone as T.Object3D;result.push(['mixamorigHips','mixamorigLeftFoot','mixamorigRightFoot'].map(n=>copy.getObjectByName(n)!.getWorldPosition(new T.Vector3())));
  for(const[o,saved]of before){assert.ok(o.position.equals(saved.p));assert.ok(o.quaternion.equals(saved.q));}
  stage.dispose();
 }
 let maxDelta=0;for(const positions of result.slice(1))positions.forEach((p,i)=>maxDelta=Math.max(maxDelta,p.distanceTo(result[0][i])));
 t.diagnostic(JSON.stringify({maxStageStartPoseDelta:maxDelta}));assert.ok(maxDelta<1e-6);actor.dispose();
});

// Remaster release is actual live animation, not a second strike-counter-driven
// fake swing. Feed the real CharacterKit clock and verify its event snapshots.
for(const id of ['blackbeard','napoleonMounted'] as const)test(`${id} remaster windup converges to native live contact/recovery without owning damage`,async()=>{
 const {CharacterKit}=await import('../src/characters/characterKit.ts');const{gltf}=await readCharacter(fileURLToPath(CHARACTER_KITS[id].assetUrl));const events:any[]=[];
 const actor=new CharacterKit(gltf,CHARACTER_KITS[id],{transitionSeconds:0,onEvent:e=>events.push(e)});actor.update(.01);const copy=clone(actor.root),p=createEraUltimatePerformance(id,copy,actor.presentationClips);
 p.update({phase:'charge',elapsed:3,progress:1});const hand=copy.getObjectByName('HandR')!,prepared=hand.getWorldPosition(new T.Vector3());
 if(id==='blackbeard'){const direction=new T.Vector3(0,0,1).applyQuaternion(p.anchors.socket!.getWorldQuaternion(new T.Quaternion()));assert.ok(direction.z>.9);}
 else{const left=copy.getObjectByName('HandL')!,rein=copy.getObjectByName('H_ReinGrip')!;assert.ok(left.getWorldPosition(new T.Vector3()).distanceTo(rein.getWorldPosition(new T.Vector3()))<.08);const hoof=copy.getObjectByName('H_ForeHoof_L')!,before=hoof.getWorldPosition(new T.Vector3());p.update({phase:'charge',elapsed:3.2,progress:1});assert.ok(hoof.getWorldPosition(new T.Vector3()).distanceTo(before)>.05);}
 const sourceNodes:T.Object3D[]=[],copyNodes:T.Object3D[]=[];actor.root.traverse(o=>sourceNodes.push(o));copy.traverse(o=>copyNodes.push(o));assert.equal(sourceNodes.length,copyNodes.length);
 actor.play('attack',{restart:true});let maxMotion=0;const socket=id==='blackbeard'?'Blackbeard_Muzzle':'SaberTip';
 for(let i=0;i<160;i++){if(i)actor.update(1/120);for(let j=1;j<sourceNodes.length;j++){copyNodes[j].position.copy(sourceNodes[j].position);copyNodes[j].quaternion.copy(sourceNodes[j].quaternion);copyNodes[j].scale.copy(sourceNodes[j].scale);}actor.root.updateMatrixWorld(true);const before=actor.model.getObjectByName(socket)!.getWorldPosition(new T.Vector3());p.update({phase:'release',elapsed:5+i/120,progress:i/350,strikeCount:events.length});copy.updateMatrixWorld(true);if(i>=18)assert.ok(copy.getObjectByName(socket)!.getWorldPosition(new T.Vector3()).distanceTo(before)<1e-6,'visible weapon follows exact live clock before/at/after contact');maxMotion=Math.max(maxMotion,hand.getWorldPosition(new T.Vector3()).distanceTo(prepared));}
 assert.equal(events.length,1);assert.equal(events[0].at,id==='blackbeard'?17/30:23/30);assert.ok(maxMotion>.12,'positive authored release/recovery');p.dispose();actor.dispose();
});
