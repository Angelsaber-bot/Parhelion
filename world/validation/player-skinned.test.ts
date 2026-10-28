import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { SkinnedCharacterAnimator, loadSkinnedCharacter } from '../src/skinnedCharacter.ts';
import { attachExplorerRifle } from '../src/weaponArt.ts';
import { playerFixture } from './player-fixture.ts';
import { MeshBVH } from 'three-mesh-bvh';
import { ShoulderAim } from '../src/aim.ts';

const base = { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: 0 };
test('default player is a real skeleton with anatomical laterality and preserved UV1/alpha materials', async () => {
  const f = await playerFixture(); const { rig } = f;
  assert.equal(rig.skeletons.length, 1);
  assert.ok(rig.skeletons[0].bones.length >= 75);
  for (const name of ['Arm_R', 'Forearm_R', 'Hand_R', 'Arm_L', 'Hand_L', 'Foot_R', 'Toe_L']) assert.equal((rig.joints[name] as THREE.Bone).isBone, true);
  assert.ok(rig.rest.get(rig.joints.Hand_R as THREE.Bone)!.rootP.x < 0, 'true anatomical right is model-local −X after proper rotation');
  assert.ok(rig.rest.get(rig.joints.Hand_L as THREE.Bone)!.rootP.x > 0);
  const skinned = rig.meshes.filter(m => (m as THREE.SkinnedMesh).isSkinnedMesh) as THREE.SkinnedMesh[];
  for (const mesh of skinned) {
    assert.equal(mesh.skeleton, rig.skeletons[0]);
    const weights = mesh.geometry.getAttribute('skinWeight'), indices = mesh.geometry.getAttribute('skinIndex');
    for (let i = 0; i < weights.count; i++) {
      assert.ok(Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1) < 1e-5);
      for (let c = 0; c < 4; c++) assert.ok(indices.getComponent(i, c) >= 0 && indices.getComponent(i, c) < rig.skeletons[0].bones.length);
    }
  }
  const skin = skinned.find(m => /Head_Skin/.test(m.name))!;
  assert.ok(skin.geometry.hasAttribute('uv1'));
  assert.equal((skin.material as THREE.MeshStandardMaterial).map?.channel, 1);
  for (const name of ['Iris', 'Lid_Lines']) {
    const mesh = skinned.find(m => m.name === name)!;
    assert.equal((mesh.material as THREE.MeshStandardMaterial).alphaTest, .5);
    assert.ok((mesh.material as THREE.MeshStandardMaterial).map);
  }
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /await loadSkinnedCharacter/);
  assert.doesNotMatch(main, /from ['"]\.\/character['"]|deformUniformCloth/);
  f.dispose();
});

test('actual Dawn AR palm sockets meet grip/support over full TPS pitch range', async () => {
  const f = await playerFixture(); const { rig } = f, animator = new SkinnedCharacterAnimator(rig);
  for (const pitch of [-1.5, -1.4, -.5, 0, .5, 1.4, 1.5]) for (const aim of [0, .25, .5, .75, 1]) {
    for (let i = 0; i < 90; i++) animator.update(1 / 60, { ...base, aim, pitch });
    for (const [side, key] of [['R', 'grip'], ['L', 'support']] as const) {
      const error = rig.handSockets[side].getWorldPosition(new THREE.Vector3()).distanceTo(rig.joints.Gun.localToWorld(rig.gunAnchors[key].clone()));
      assert.ok(error < .002, `${side} palm error ${error} at aim=${aim}, pitch=${pitch}`);
    }
    const muzzle = f.rifle.muzzleWorld();
    assert.ok(muzzle.toArray().every(Number.isFinite));
    if (aim === 1) {
      const barrel = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.joints.Gun.quaternion);
      assert.ok(barrel.distanceTo(new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch))) < 1e-6);
    }
  }
  f.dispose();
});

test('glider actual visible handle contacts, smooth return, and immediate airborne firing ownership', async () => {
  const f = await playerFixture(); const { rig } = f, animator = new SkinnedCharacterAnimator(rig);
  const glide = { ...base, speed: 8, onGround: false, gliding: true, vy: -2 };
  for (let i = 0; i < 180; i++) animator.update(1 / 60, glide);
  assert.equal(rig.diagnostics.mode, 'glide'); assert.equal(rig.glider.root.visible, true);
  for (const side of ['R', 'L'] as const) {
    assert.ok(rig.glider.root.getObjectByName(`GliderHandle_${side}`));
    assert.ok(rig.handSockets[side].getWorldPosition(new THREE.Vector3()).distanceTo(rig.glider.grips[side].getWorldPosition(new THREE.Vector3())) < .002);
  }
  animator.update(1 / 60, { ...glide, firing: true });
  for (const [side, key] of [['R', 'grip'], ['L', 'support']] as const)
    assert.ok(rig.handSockets[side].getWorldPosition(new THREE.Vector3()).distanceTo(rig.joints.Gun.localToWorld(rig.gunAnchors[key].clone())) < .002, 'no shot delay/back-slung muzzle');
  assert.equal(rig.glider.root.visible, true, 'shooting does not change flight/deploy physics');
  for (let i = 0; i < 180; i++) animator.update(1 / 60, glide);
  assert.equal(rig.diagnostics.mode, 'glide');
  for (let i = 0; i < 180; i++) animator.update(1 / 60, base);
  assert.equal(rig.glider.root.visible, false);
  f.dispose();
});

test('animation changes GPU bone matrices, never CPU position/normal buffers; outlines share skin and morphs', async () => {
  const f = await playerFixture(true); const { rig } = f, animator = new SkinnedCharacterAnimator(rig);
  const meshes = rig.meshes.filter(m => (m as THREE.SkinnedMesh).isSkinnedMesh) as THREE.SkinnedMesh[];
  const snapshots = meshes.map(m => [m.geometry.attributes.position.version, m.geometry.attributes.normal.version]);
  let outlines = 0;
  rig.root.traverse(o => {
    if (!o.userData.playerOutline) return;
    const m = o as THREE.SkinnedMesh, parent = o.parent as THREE.SkinnedMesh;
    assert.equal(m.isSkinnedMesh, true); assert.equal(m.skeleton, parent.skeleton); assert.equal(m.geometry, parent.geometry);
    assert.equal(m.morphTargetInfluences, parent.morphTargetInfluences); outlines++;
  });
  assert.ok(outlines > 0);
  for (const state of [base, { ...base, speed: 9 }, { ...base, swimming: true, onGround: false, speed: 3 }, { ...base, gliding: true, onGround: false, speed: 8 }])
    for (let i = 0; i < 120; i++) {
      animator.update(1 / 60, state);
      for (const bone of Object.values(rig.bones)) { assert.equal(bone.matrixAutoUpdate, true); assert.ok(bone.matrixWorld.elements.every(Number.isFinite)); }
    }
  meshes.forEach((m, i) => assert.deepEqual([m.geometry.attributes.position.version, m.geometry.attributes.normal.version], snapshots[i]));
  f.dispose(); f.dispose();
});

test('default load/weapon failure is explicit, never installs rejected segmented or invisible shooting fallback', async () => {
  await assert.rejects(loadSkinnedCharacter({ load: async () => { throw new Error('offline'); } }), /offline/);
  const f = await playerFixture(); f.rifle.dispose();
  const rifle = attachExplorerRifle(f.rig, undefined, async () => { throw new Error('offline'); });
  await assert.rejects(rifle.ready, /Dawn AR/); assert.equal(f.rig.joints.Gun.userData.artState, 'error');
  rifle.dispose(); f.rig.dispose();
});

test('ordinary glide deploy, production ADS release and landing have bounded hand travel', async () => {
  const f = await playerFixture(), animator = new SkinnedCharacterAnimator(f.rig), aim = new ShoulderAim();
  const glide = { ...base, speed:8, onGround:false, gliding:true, vy:-2, pitch:.3 };
  for (let i=0;i<120;i++) animator.update(1/60,{...base,pitch:.3});
  let previous = (['R','L'] as const).map(side => f.rig.handSockets[side].getWorldPosition(new THREE.Vector3()));
  let max = 0;
  for (const [state, held] of [[glide,false],[glide,true],[glide,false],[{...base,pitch:.3},false]] as const) {
    aim.held=held;
    for(let i=0;i<180;i++) {
      animator.update(1/60,{...state,aim:aim.step(1/60,true)});
      const next=(['R','L'] as const).map(side=>f.rig.handSockets[side].getWorldPosition(new THREE.Vector3()));
      max=Math.max(max,...next.map((p,index)=>p.distanceTo(previous[index])));previous=next;
    }
  }
  assert.ok(max < .07, `ordinary transfer moved a hand ${max}m in one 60Hz frame`);
  assert.equal(f.rig.glider.root.visible,false);f.dispose();
});

test('right index reaches the actual trigger-guard region rather than dangling below the pistol grip', async () => {
  const f=await playerFixture(),animator=new SkinnedCharacterAnimator(f.rig);
  const trigger=f.rig.joints.Gun.getObjectByName('01_Dawn_AR__trigger');assert.ok(trigger);
  for(const state of [base,{...base,aim:1,pitch:.5},{...base,onGround:false,gliding:true,firing:true}]) {
    for(let i=0;i<120;i++)animator.update(1/60,state);
    const actualBounds=new THREE.Box3().setFromObject(trigger);
    const indexJoint=f.rig.bones.J_Bip_R_Index2.getWorldPosition(new THREE.Vector3());
    assert.ok(actualBounds.distanceToPoint(indexJoint)<.01,'index joint must enter the real guard/trigger region; this is not a fingertip contact claim');
  }
  f.dispose();
});

test('real skinned head and actual Dawn surfaces do not cross at former intermediate/extreme ADS failures', async () => {
  const f=await playerFixture(),animator=new SkinnedCharacterAnimator(f.rig);
  const heads=f.rig.meshes.filter(m=>/Head_Skin|Hair_Editable|Hair_Underlayer/.test(m.name)) as THREE.SkinnedMesh[];
  const guns:THREE.Mesh[]=[];f.rig.joints.Gun.traverse(o=>{if((o as THREE.Mesh).isMesh)guns.push(o as THREE.Mesh);});
  assert.equal(heads.length,3);assert.ok(guns.length>20);
  const gunTrees=guns.map(m=>new MeshBVH(m.geometry));
  for(const [pitch,aim]of [[0,0],[-.5,.25],[-.5,.5],[-.5,.75],[-.75,.25],[-.75,.5],[-.75,1],[-1,.25],[-1,.75],[-1.5,1],[1.5,1],[.5,1]] as const) {
    for(let i=0;i<100;i++)animator.update(1/60,{...base,pitch,aim});
    for(const head of heads) {
      const geometry=new THREE.BufferGeometry(),position=new Float32Array(head.geometry.attributes.position.count*3),v=new THREE.Vector3();
      for(let i=0;i<position.length/3;i++)head.getVertexPosition(i,v).toArray(position,i*3);
      geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.setIndex(head.geometry.index!.clone());
      const tree=new MeshBVH(geometry),inverse=head.matrixWorld.clone().invert();
      guns.forEach((gun,i)=>{
        const crossed=tree.bvhcast(gunTrees[i],new THREE.Matrix4().multiplyMatrices(inverse,gun.matrixWorld),{
          intersectsTriangles:(a,b)=>a.intersectsTriangle(b,undefined,true),
        });
        assert.equal(crossed,false,`${head.name}/${gun.name} surfaces cross at pitch${pitch},aim${aim}`);
      });
      geometry.dispose();
    }
  }
  f.dispose();
});
