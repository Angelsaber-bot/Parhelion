/** Actual player + Refract GLB geometry; not proxy mannequin or browser acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import {playerFixture,parseLocalGlb} from './player-fixture';
import {SkinnedCharacterAnimator} from '../src/skinnedCharacter';
import {attachExplorerBlade,REFRACT_GRIP,REFRACT_PALM_OFFSET} from '../src/playerBladeArt';
import {MELEE_BEATS,PlayerMelee} from '../src/playerMelee';
const base={speed:0,onGround:true,swimming:false,vy:0,moveYaw:0};
const v=()=>new THREE.Vector3();
async function fixture(){const f=await playerFixture();const blade=attachExplorerBlade(f.rig,()=>parseLocalGlb(new URL('../../assets/weapons/glb/06_Refract_Blade.glb',import.meta.url)));await blade.ready;return{...f,blade,dispose(){blade.dispose();f.dispose();}};}
test('all three real sword contacts meet the palm, point ahead, and retain natural wrist / elbow continuity',async t=>{
 const f=await fixture(),a=new SkinnedCharacterAnimator(f.rig);const bladeMeshes:THREE.Mesh[]=[];f.blade.root.traverse(o=>{if(o instanceof THREE.Mesh)bladeMeshes.push(o);});assert.ok(bladeMeshes.length>5);
 const model=f.blade.root.children[0].children[0];let maxGrip=0,maxWrist=0,maxStep=0,maxReach=0;
 for(const combo of[0,1,2]){let previous:THREE.Quaternion|undefined;a.reset(true);for(let j=0;j<60;j++)a.update(1/60,base);
  for(let i=0;i<=120;i++){const phase=i/120;a.update(1/120,{...base,melee:{phase,combo,yaw:0}});f.blade.update(true);f.rig.root.updateMatrixWorld(true);
   const q=f.rig.handSockets.R.getWorldQuaternion(new THREE.Quaternion());if(previous)maxStep=Math.max(maxStep,q.angleTo(previous));previous=q;
   maxGrip=Math.max(maxGrip,model.localToWorld(REFRACT_GRIP.clone()).distanceTo(f.rig.handSockets.R.localToWorld(REFRACT_PALM_OFFSET.clone())));
   if(phase>=.14&&phase<=.8){const hand=f.rig.joints.Hand_R.getWorldPosition(v()),forearm=hand.clone().sub(f.rig.joints.Forearm_R.getWorldPosition(v())).normalize(),distal=f.rig.bones.J_Bip_R_Middle1.getWorldPosition(v()).sub(hand).normalize();maxWrist=Math.max(maxWrist,forearm.angleTo(distal));}
   maxReach=Math.max(maxReach,f.rig.diagnostics.armReachError.R);assert.ok(f.rig.joints.Forearm_R.getWorldPosition(v()).x<.1,'right elbow cannot invert across the torso');
  }
  const phase=MELEE_BEATS[combo].contact/MELEE_BEATS[combo].duration;a.update(1/120,{...base,melee:{phase,combo,yaw:0}});f.blade.update(true);f.rig.root.updateMatrixWorld(true);
  let farthest=v( );let maxSourceX=-Infinity;for(const m of bladeMeshes){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){const point=m.localToWorld(v().fromBufferAttribute(p,i));if(point.z>maxSourceX){maxSourceX=point.z;farthest.copy(point);}}}
  const direction=new THREE.Vector3(0,0,1).applyQuaternion(f.rig.handSockets.R.getWorldQuaternion(new THREE.Quaternion()));assert.ok(direction.z>.35,`combo ${combo} blade must cut ahead, not down into the floor`);assert.ok(farthest.z>.65&&farthest.z<1.7,`actual blade contact reach ${farthest.z}`);t.diagnostic(JSON.stringify({combo,contact:phase,bladeTip:farthest.toArray(),direction:direction.toArray()}));
 }
 t.diagnostic(JSON.stringify({maxGrip,maxWristDegrees:THREE.MathUtils.radToDeg(maxWrist),maxFrameDegrees:THREE.MathUtils.radToDeg(maxStep),maxReach}));assert.ok(maxGrip<1e-6);assert.ok(maxWrist<.23);assert.ok(maxStep<.22);assert.ok(maxReach<.002);f.dispose();
});
test('actual blade triangles never cut the actual deformed head, hand-back seal or central torso through all beats',async()=>{
 const f=await fixture(),a=new SkinnedCharacterAnimator(f.rig),blades:THREE.Mesh[]=[];f.blade.root.traverse(o=>{if(o instanceof THREE.Mesh)blades.push(o);});const trees=blades.map(m=>new MeshBVH(m.geometry));
 for(const combo of[0,1,2])for(const phase of[.08,.14,.2,.3,.4,.5,.6,.7,.8,.9]){a.update(1/120,{...base,melee:{phase,combo,yaw:0}});f.blade.update(true);if(!f.blade.root.visible)continue;
  for(const mesh of f.rig.meshes){if(!(mesh instanceof THREE.SkinnedMesh))continue;const leftHand=/bare_hands/.test(mesh.name);const head=/Head_Skin|Hair_Editable|Hair_Underlayer|command_seal/.test(mesh.name);const positions:number[]=[],p=mesh.geometry.attributes.position,idx=mesh.geometry.index;const verts=Array.from({length:p.count},(_,i)=>mesh.getVertexPosition(i,v()).applyMatrix4(mesh.matrixWorld));
   for(let i=0;i<(idx?.count??p.count);i+=3){const tri=[0,1,2].map(j=>verts[idx?idx.getX(i+j):i+j]);const center=tri[0].clone().add(tri[1]).add(tri[2]).multiplyScalar(1/3);if(head||(leftHand?center.x>.12:(Math.abs(center.x)<.16&&center.y>.75&&center.y<1.48&&Math.abs(center.z)<.19)))for(const point of tri)positions.push(...point.toArray());}
   if(!positions.length)continue;const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),tree=new MeshBVH(geometry);
   blades.forEach((blade,i)=>{const crossed=tree.bvhcast(trees[i],blade.matrixWorld,{intersectsTriangles:(a,b)=>a.intersectsTriangle(b,undefined,true)});assert.equal(crossed,false,`combo${combo} phase${phase} ${mesh.name}/${blade.name}`);});geometry.dispose();
  }
 }f.dispose();
});
test('blade draw waits for the melee grip; cancellation, failed load, and late disposal do not leave a visible weapon',async()=>{
 const f=await fixture(),a=new SkinnedCharacterAnimator(f.rig);a.update(1/60,base);f.blade.update(true);assert.equal(f.blade.root.visible,false);a.update(1/60,{...base,melee:{phase:.4,combo:0,yaw:0}});f.blade.update(true);assert.equal(f.blade.root.visible,true);f.blade.update(false);assert.equal(f.blade.root.visible,false);f.blade.dispose();f.blade.update(true);assert.equal(f.blade.root.visible,false);f.dispose();
 const g=await playerFixture();const failed=attachExplorerBlade(g.rig,async()=>{throw new Error('offline');});await assert.rejects(failed.ready,/Refract Blade/);assert.equal(failed.root.userData.artState,'error');failed.dispose();g.dispose();
});

test('melee pose stays reachable during locomotion and transformed headings without changing gait ownership',async()=>{
 const f=await fixture(),a=new SkinnedCharacterAnimator(f.rig);
 for(const speed of[0,5.5,9])for(const armed of[true,false])for(const yaw of[0,Math.PI/2,-Math.PI]){a.reset(armed);for(let i=0;i<60;i++)a.update(1/120,{...base,speed,armed,moveYaw:yaw});for(let combo=0;combo<3;combo++)for(const phase of[.15,.38,.55,.8]){a.update(1/120,{...base,speed,armed,moveYaw:yaw,melee:{phase,combo,yaw}});assert.ok(f.rig.diagnostics.armReachError.R<.002);assert.ok(f.rig.root.matrixWorld.elements.every(Number.isFinite));assert.equal(f.rig.root.rotation.y,yaw);}}
 f.dispose();
});
test('late asynchronous blade resolution cannot resurrect a disposed attachment',async()=>{
 const f=await playerFixture();let resolve!:(value:{scene:THREE.Group})=>void;const pending=new Promise<{scene:THREE.Group}>(r=>resolve=r),blade=attachExplorerBlade(f.rig,()=>pending);blade.dispose();const asset=await parseLocalGlb(new URL('../../assets/weapons/glb/06_Refract_Blade.glb',import.meta.url));let disposedGeometries=0;asset.scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.addEventListener('dispose',()=>disposedGeometries++);});resolve(asset);await blade.ready;blade.update(true);assert.equal(blade.loaded,false);assert.equal(blade.root.visible,false);assert.equal(blade.root.parent,null);assert.equal(blade.root.userData.artState,'disposed');assert.ok(disposedGeometries>0);f.dispose();
});

test('full-body melee loads hips and bends knees while both idle foot contacts and controller root remain planted',async t=>{
 const f=await fixture(),a=new SkinnedCharacterAnimator(f.rig);let maxFoot=0,maxDrop=0,maxKnee=0;
 for(const combo of[0,1,2]){a.reset(true);for(let i=0;i<60;i++)a.update(1/120,base);const hipY=f.rig.joints.Hips.getWorldPosition(v()).y;
  for(let i=0;i<=120;i++){a.update(1/120,{...base,melee:{phase:i/120,combo,yaw:0}});assert.deepEqual(f.rig.root.position.toArray(),[0,0,0]);maxDrop=Math.max(maxDrop,hipY-f.rig.joints.Hips.getWorldPosition(v()).y);
   for(const side of['R','L']){const foot=f.rig.joints[`Foot_${side}`] as THREE.Bone,hip=f.rig.joints[`Thigh_${side}`].getWorldPosition(v()),knee=f.rig.joints[`Shin_${side}`].getWorldPosition(v()),ankle=foot.getWorldPosition(v());const drift=ankle.distanceTo(f.rig.rest.get(foot)!.rootP);maxFoot=Math.max(maxFoot,drift);if(i>22&&i<98)assert.ok(drift<1e-5,'active load must not slide either planted foot');maxKnee=Math.max(maxKnee,knee.clone().sub(hip).angleTo(ankle.clone().sub(knee)));}
  }
 }
 t.diagnostic(JSON.stringify({maxFootDrift:maxFoot,pelvisLoad:maxDrop,kneeFlexDegrees:THREE.MathUtils.radToDeg(maxKnee)}));assert.ok(maxFoot<.004);assert.ok(maxDrop>.08&&maxDrop<.15);assert.ok(maxKnee>.5&&maxKnee<1.5);f.dispose();
});

test('queued three-beat animation keeps the sword drawn, blends heavy preparation, and recovers without resetting locomotion',async t=>{
 const f=await fixture(),a=new SkinnedCharacterAnimator(f.rig),m=new PlayerMelee();for(let i=0;i<120;i++)a.update(1/120,base);m.press(0);let previous:THREE.Quaternion|undefined,maxStep=0;let transitions=0,lastCombo=0;
 for(let frame=0;frame<300;frame++){if(m.active&&m.phase>.6)m.press(0);m.update(1/120,true);a.update(1/120,{...base,melee:m.active?{phase:m.phase,combo:m.combo,yaw:0}:undefined});f.blade.update(m.active);const q=f.rig.handSockets.R.getWorldQuaternion(new THREE.Quaternion());if(previous)maxStep=Math.max(maxStep,q.angleTo(previous));previous=q;if(m.active&&m.combo>0)assert.equal(f.blade.root.visible,true,'do not sheath/redraw between queued beats');if(m.active&&m.combo!==lastCombo){transitions++;lastCombo=m.combo;}}
 assert.equal(transitions,2);assert.ok(maxStep<.29);assert.equal(f.blade.root.visible,false);assert.notEqual(f.rig.diagnostics.mode,'melee');t.diagnostic(JSON.stringify({maxSequenceFrameDegrees:THREE.MathUtils.radToDeg(maxStep)}));f.dispose();
});

test('explicit input-event shot interrupts melee recovery into the original exact rifle sockets',async()=>{
 const f=await fixture(),a=new SkinnedCharacterAnimator(f.rig);a.update(1/60,{...base,melee:{phase:.6,combo:2,yaw:0}});a.prepareShot(new THREE.Vector3(0,0,1));f.blade.update(true);assert.equal(f.blade.root.visible,false);
 for(const[side,key]of[['R','grip'],['L','support']]as const)assert.ok(f.rig.handSockets[side].getWorldPosition(v()).distanceTo(f.rig.joints.Gun.localToWorld(f.rig.gunAnchors[key].clone()))<.002);f.dispose();
});

test('canceling during initial draw fades from its actual partial weight instead of jumping to a full sword pose',async()=>{
 const f=await fixture(),a=new SkinnedCharacterAnimator(f.rig);for(let i=0;i<60;i++)a.update(1/120,base);a.update(1/120,{...base,melee:{phase:.04,combo:0,yaw:0}});const before=f.rig.handSockets.R.getWorldQuaternion(new THREE.Quaternion());a.update(1/120,base);const after=f.rig.handSockets.R.getWorldQuaternion(new THREE.Quaternion());assert.ok(before.angleTo(after)<.3);f.blade.update(false);assert.equal(f.blade.root.visible,false);f.dispose();
});
