import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import{MeshBVH}from'three-mesh-bvh';import{fileURLToPath}from'node:url';
import{readCharacter}from'./characters/inspect.ts';import{ContractServant,SERVANT_MODELS}from'../src/servant.ts';import{FirstContract}from'../src/contracts.ts';import{ServantAppearance}from'../src/servantAppearance.ts';
for(const outfit of ['armor','civilian']as const)for(const hz of [30,60,120])test(`${outfit} ${hz}Hz: actual follow pivots retain finite reach, sole clearance and world stance`,async t=>{
 const{gltf}=await readCharacter(fileURLToPath(SERVANT_MODELS[outfit]));const sourceClips=JSON.stringify(gltf.animations.map(c=>c.toJSON()));gltf.scene.updateMatrixWorld(true);
 const feet=['Left','Right'].map(s=>gltf.scene.getObjectByName('mixamorig'+s+'Foot')!);
 const soles:{mesh:THREE.SkinnedMesh;ids:number[]}[]=[];const point=new THREE.Vector3();
 gltf.scene.traverse(o=>{const m=o as THREE.SkinnedMesh;if(!m.isSkinnedMesh)return;const ids:number[]=[],ix=m.geometry.attributes.skinIndex,w=m.geometry.attributes.skinWeight;
  for(let i=0;i<ix.count;i++){let weight=0;for(let c=0;c<4;c++)if(/Foot|Toe/.test(m.skeleton.bones[ix.getComponent(i,c)].name))weight+=w.getComponent(i,c);if(weight>.8&&m.getVertexPosition(i,point).applyMatrix4(m.matrixWorld).y<.08)ids.push(i);}if(ids.length)soles.push({mesh:m,ids});});
 const appearance=new ServantAppearance();appearance.select(outfit);const floor=new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2);
 const actor=new ContractServant({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,colliders:[{name:'floor',enabled:true,bvh:new MeshBVH(floor)}],load:async()=>gltf,target:()=>null,strike:()=>null});await actor.ensureLoaded();
 const player=new THREE.Vector3();let previous=feet.map(f=>f.getWorldPosition(new THREE.Vector3())),previousPlanted=[false,false],maxDrift=0,minSole=Infinity,minRunSole=Infinity,contacts=0,maxFootStep=0;let runFrames=0,flightFrames=0,worstSole:any;
 for(let tick=0;tick<=8*hz;tick++){
  const time=tick/hz;let speed=0,yaw=Math.PI/2;if(time>=.5&&time<2.5)speed=5.5;else if(time>=3&&time<4)speed=9;else if(time>=4&&time<5){speed=5.5;yaw=Math.PI/2*(5-time);}else if(time>=5&&time<6){speed=5.5;yaw=-Math.PI/2;}
  if(tick){player.x+=Math.sin(yaw)*speed/hz;player.z+=Math.cos(yaw)*speed/hz;}actor.update(1/hz,player,yaw,true,false);actor.root.updateMatrixWorld(true);
  const diag=actor.strideDiagnostics??{planted:[false,false],reachReleases:0,maxAnchorError:0,weight:0};
  for(let side=0;side<2;side++){const p=feet[side].getWorldPosition(new THREE.Vector3());if(diag.planted[side]&&diag.weight>.99999&&previousPlanted[side]){maxDrift=Math.max(maxDrift,p.distanceTo(previous[side])*hz);contacts++;}if(tick)maxFootStep=Math.max(maxFootStep,p.distanceTo(previous[side]));previous[side]=p;previousPlanted[side]=diag.planted[side]&&diag.weight>.99999;}
  if(actor.animation==='Run'){runFrames++;if(!diag.planted[0]&&!diag.planted[1])flightFrames++;}
  if(tick%Math.max(1,Math.round(hz/30))===0)for(const{mesh,ids}of soles){mesh.skeleton.update();for(const i of ids){const y=mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).y;if(actor.animation==='Run'&&(actor as any).clips.get('run').getEffectiveWeight()>.995)minRunSole=Math.min(minRunSole,y);if(y<minSole){minSole=y;worstSole={time,state:actor.animation,weight:(actor as any).clips.get('run').getEffectiveWeight(),mesh:mesh.name,index:i};}}}
 }
 t.diagnostic(JSON.stringify({outfit,hz,maxDrift,minSole,minRunSole,worstSole,maxFootStep,contacts,runFrames,flightFrames,diagnostics:actor.strideDiagnostics}));
 assert.equal(JSON.stringify(gltf.animations.map(c=>c.toJSON())),sourceClips,'runtime correction never rewrites authored clips');assert.ok(maxFootStep*hz<9.5,'no transition snap hidden by contact-only metrics');
 assert.ok(contacts>20);assert.ok(maxDrift<.001);assert.ok(minRunSole>-.0002,`runtime run sole penetrates ${minRunSole}`);assert.ok(minSole>-.001,`sole limit regressed ${minSole}`);assert.ok(actor.strideDiagnostics!.maxAnchorError<.00001);assert.ok(actor.strideDiagnostics!.reachReleases<12);assert.ok(flightFrames>0,'legitimate running flight is not removed to game support metrics');
 actor.dispose();floor.dispose();
});
test('world stance releases safely for a discontinuous rejoin and remains idempotent for zero-time aim queries',async()=>{
 const{gltf}=await readCharacter(fileURLToPath(SERVANT_MODELS.civilian));const appearance=new ServantAppearance();appearance.select('civilian');
 const actor=new ContractServant({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,colliders:[{name:'actual-rejoin-floor',enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2))}],load:async()=>gltf,target:()=>null,strike:()=>null});await actor.ensureLoaded();const internal=actor as any;
 internal.play('run',false,1.2);internal.strideSpeed=5.5;for(let i=0;i<60;i++){actor.root.position.z+=5.5/60;internal.tick(1/60);}
 const snapshot=()=>{const q:number[]=[];gltf.scene.traverse(o=>q.push(...o.quaternion.toArray()));return q;};const before=snapshot();for(let i=0;i<100;i++)internal.tick(0);const after=snapshot();assert.ok(Math.max(...after.map((x,i)=>Math.abs(x-before[i])))<1e-9,'queries cannot integrate/release a planted foot');
 actor.root.position.add(new THREE.Vector3(50,3,-40));internal.tick(1/60);assert.deepEqual(actor.strideDiagnostics!.planted,[false,false]);
 const root=actor.root.position.clone();for(const side of ['Left','Right']){const foot=gltf.scene.getObjectByName('mixamorig'+side+'Foot')!.getWorldPosition(new THREE.Vector3());assert.ok(foot.distanceTo(root)<1,'rejoin cannot retain old world anchors');}
 internal.play('attack',true);for(let i=0;i<30;i++)internal.tick(1/60);assert.equal(actor.strideDiagnostics!.weight,0);assert.deepEqual(actor.strideDiagnostics!.planted,[false,false]);
 const attack=gltf.animations.find(c=>c.name==='Attack')!;for(const track of attack.tracks.filter(t=>/^(?:mixamorig(?:Left|Right)(?:UpLeg|Leg|Foot|ToeBase)|RuntimeSkirt(?:Front|Back))\.quaternion$/.test(t.name))){const curve=(track as THREE.QuaternionKeyframeTrack&{createInterpolant():THREE.Interpolant}).createInterpolant();const expected=new THREE.Quaternion().fromArray(curve.evaluate(internal.clips.get('attack').time)).normalize(),actual=gltf.scene.getObjectByName(track.name.slice(0,-11))!.quaternion.clone().normalize();assert.ok(actual.angleTo(expected)<1e-6,'attack leg/cloth curves regain exact authored ownership');}actor.dispose();
});
test('interrupted run-idle-walk-run fade preserves a still-visible gait clock and pose',async()=>{
 const{gltf}=await readCharacter(fileURLToPath(SERVANT_MODELS.civilian));const appearance=new ServantAppearance();appearance.select('civilian');
 const actor=new ContractServant({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,colliders:[],load:async()=>gltf,target:()=>null,strike:()=>null});await actor.ensureLoaded();const a=actor as any;
 a.play('run',false,1.2);a.strideSpeed=5.5;for(let i=0;i<30;i++)a.tick(1/60);
 a.play('idle');for(let i=0;i<3;i++)a.tick(1/60);
 a.play('walk',false,.8);for(let i=0;i<3;i++)a.tick(1/60);
 const run=a.clips.get('run'),phase=run.time;assert.ok(run.getEffectiveWeight()>.1&&run.getEffectiveWeight()<.9);
 const pose=()=>{const values:number[]=[];gltf.scene.traverse(o=>values.push(...o.quaternion.toArray()));return values;};a.tick(0);const before=pose();
 a.play('run',false,1.2);assert.equal(run.time,phase,'visible Run action must not be rephased from a newly started Walk');a.tick(0);const after=pose();assert.ok(Math.max(...after.map((v,i)=>Math.abs(v-before[i])))<1e-8,'clock-only re-entry must not pop geometry');actor.dispose();
});
test('one-leg or incomplete rig keeps authored playback and never partially applies procedural IK',async()=>{
 const model=new THREE.Group(),upper=new THREE.Bone(),lower=new THREE.Bone(),foot=new THREE.Bone();upper.name='mixamorigLeftUpLeg';lower.name='mixamorigLeftLeg';foot.name='mixamorigLeftFoot';upper.add(lower);lower.add(foot);model.add(upper);lower.position.y=-.4;foot.position.y=-.4;
 const gltf={scene:model,animations:['Idle','Walk','Run','Attack'].map(name=>new THREE.AnimationClip(name,1,[]))}as any;
 const actor=new ContractServant({scene:new THREE.Scene(),marker:{id:'partial',type:'interact',label:'partial',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),colliders:[{name:'floor',enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2))}],load:async()=>gltf,target:()=>null,strike:()=>null});await actor.ensureLoaded();const a=actor as any;assert.equal(a.stride.supported,false);const before=[...upper.quaternion.toArray(),...lower.quaternion.toArray(),...foot.quaternion.toArray()],player=new THREE.Vector3();
 for(let i=0;i<180;i++){player.z+=6/60;const p=actor.root.position.clone();actor.update(1/60,player,0,true,false);if(actor.animation==='Run')assert.ok(Math.abs(actor.root.position.distanceTo(p)*60-a.current.getEffectiveTimeScale()*1.9983)<1e-8);}
 assert.deepEqual([...upper.quaternion.toArray(),...lower.quaternion.toArray(),...foot.quaternion.toArray()],before);assert.deepEqual(actor.strideDiagnostics!.planted,[false,false]);assert.equal(actor.groundDiagnostics!.patch.heightQueries,0);actor.dispose();
});
