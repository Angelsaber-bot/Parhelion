import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KitCompanion } from '../src/kitCompanion.ts';
import { CharacterKit } from '../src/characters/characterKit.ts';
import { CHARACTER_KITS } from '../src/characters/catalog.ts';
import { ContractSkills } from '../src/contractSkills.ts';
import { FirstContract } from '../src/contracts.ts';
import { ContractServant, SERVANT_CLIPS, SERVANT_MOTION } from '../src/servant.ts';
import type { StrikeOriginGeometry } from '../src/combatActions';
import type { SkillPoseCommand } from '../src/skillPose.ts';
import { readCharacter } from './characters/inspect.ts';
import { fileURLToPath } from 'node:url';
const floor = () => ({ name: 'floor', enabled: true, bvh: new MeshBVH(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2)) });
function kitFixture(id: keyof typeof CHARACTER_KITS, asset?: GLTF) {
  const definition = CHARACTER_KITS[id], scene = new THREE.Group();
  for (const socket of Object.values(definition.sockets)) if (!scene.getObjectByName(socket.node)) { const o = new THREE.Object3D(); o.name = socket.node; o.position.y = 1; scene.add(o); }
  const gltf = asset ?? { scene, animations: Object.values(definition.clips).map(c => new THREE.AnimationClip(c.name, c.duration, [])) } as GLTF;
  let ordinary = 0, enemy: { id: string; position: THREE.Vector3 } | null = { id: 'enemy', position: new THREE.Vector3(0, 0, 7) };
  const colliders = [floor()], player = new THREE.Vector3();
  const follow = new KitCompanion({ colliders, range: 4.5, damage: 16, target: (_p, _r, id) => !id || id === enemy?.id ? enemy : null, engage: () => enemy, strike: () => { ordinary++; return enemy; } });
  const actor = new CharacterKit(gltf, definition, { onEvent: event => follow.onEvent(actor, event) });
  const tick = (dt = .05, paused = false) => follow.update(actor, dt, player, 0, paused);
  return { actor, follow, player, colliders, tick, ordinary: () => ordinary, removeEnemy() { enemy = null; } };
}
function recorder(contacts: number) {
  const hits: { position: THREE.Vector3; socket?: string; geometry?: StrikeOriginGeometry }[] = [], ended: boolean[] = [];
  const command: SkillPoseCommand = { direction: { x: 0, y: 0, z: 1 }, contacts, onContact: (p, _d, socket, geometry) => hits.push({ position: new THREE.Vector3(p.x, p.y, p.z), socket, geometry }), onFinish: completed => ended.push(completed) };
  return { command, hits, ended };
}
test('Blackbeard volley uses each authored muzzle contact and suppresses ordinary ally strikes', () => {
  const f = kitFixture('blackbeard'), r = recorder(3);
  assert.equal(f.follow.startSkillPose(f.actor, r.command, f.player, 0), true);
  for (let i = 0; i < 11; i++) f.tick(); assert.equal(r.hits.length, 0);
  f.tick(); assert.equal(r.hits.length, 1); assert.equal(r.hits[0].socket, 'muzzle'); assert.deepEqual(r.hits[0].geometry, { losOffset: 0, casterFeetY: f.actor.root.position.y }); assert.equal(r.hits[0].position.y, 1 + CHARACTER_KITS.blackbeard.visualOffset[1]);
  for (let i = 0; i < 90 && !r.ended.length; i++) f.tick();
  assert.equal(r.hits.length, 3); assert.deepEqual(r.ended, [true]); assert.equal(f.ordinary(), 0); f.actor.dispose();
});
test('Musashi paired authored right/left contacts are distinct, ultimate third contact cannot leak a fourth', () => {
  for (const contacts of [2, 3]) {
    const f = kitFixture('musashi'), r = recorder(contacts);
    f.follow.startSkillPose(f.actor, r.command, f.player, 0);
    for (let i = 0; i < 100 && !r.ended.length; i++) f.tick();
    assert.ok(r.hits.every(h => h.geometry?.losOffset === 0 && h.geometry.casterFeetY === f.actor.root.position.y));
    assert.deepEqual(r.hits.map(h => h.socket), contacts === 2 ? ['rightKatana', 'leftKatana'] : ['rightKatana', 'leftKatana', 'rightKatana']);
    assert.deepEqual(r.ended, [true]); assert.equal(f.ordinary(), 0); f.actor.dispose();
  }
});
test('pose waits to face its snapshotted aim before playing the attack', () => {
  const f = kitFixture('blackbeard'), r = recorder(1); f.actor.root.rotation.y = Math.PI;
  f.follow.startSkillPose(f.actor, r.command, f.player, 0); f.tick();
  assert.notEqual(f.actor.state, 'attack'); assert.equal(r.hits.length, 0);
  for (let i = 0; i < 80 && !r.ended.length; i++) f.tick();
  assert.equal(r.hits.length, 1); assert.ok(Math.abs(f.actor.root.rotation.y) < .08); f.actor.dispose();
});
test('recall/pause/teleport cancel montages once and no delayed contact resumes', () => {
  for (const mode of ['pause', 'release', 'teleport']) {
    const f = kitFixture('musashi'), r = recorder(2); f.follow.startSkillPose(f.actor, r.command, f.player, 0); f.tick();
    if (mode === 'pause') f.tick(.1, true); else if (mode === 'release') f.follow.release(f.actor); else { f.player.x = 100; f.tick(); }
    f.follow.cancelSkillPose(f.actor); assert.deepEqual(r.ended, [false], mode); assert.equal(r.hits.length, 0); f.actor.dispose();
  }
});
test('Napoleon skill uses supported staging/charge and one authored contact, never ordinary extra damage', () => {
  const f = kitFixture('napoleonMounted'), r = recorder(1);
  assert.equal(f.follow.startSkillPose(f.actor, r.command, f.player, 0), true);
  const initial = f.actor.root.position.clone();
  for (let i = 0; i < 150 && !r.ended.length; i++) f.tick();
  assert.equal(r.hits.length, 1); assert.deepEqual(r.ended, [true]); assert.equal(f.ordinary(), 0);
  assert.ok(r.hits[0].position.distanceTo(initial) > 2); assert.equal(r.hits[0].geometry?.losOffset, 1); assert.equal(r.hits[0].geometry?.casterFeetY, r.hits[0].position.y); f.actor.dispose();
});
test('Napoleon rejects unsafe/missing target before resource spend; obstruction cancels without a hit', () => {
  const missing = kitFixture('napoleonMounted'), a = recorder(1); missing.removeEnemy();
  assert.equal(missing.follow.startSkillPose(missing.actor, a.command, missing.player, 0), false); assert.deepEqual(a.ended, []); missing.actor.dispose();
  const f = kitFixture('napoleonMounted'), r = recorder(1);
  const wall = { name: 'wall', enabled: true, bvh: new MeshBVH(new THREE.BoxGeometry(30, 4, .3).translate(0, 2, 3)) }; f.colliders.push(wall);
  assert.equal(f.follow.startSkillPose(f.actor, r.command, f.player, 0), false);
  wall.enabled = false; assert.equal(f.follow.startSkillPose(f.actor, r.command, f.player, 0), true);
  for (let i = 0; i < 100 && f.follow.mountedPhase !== 'charge'; i++) f.tick();
  wall.enabled = true; f.tick(); f.tick(); assert.equal(r.hits.length, 0); assert.deepEqual(r.ended, [false]); f.actor.dispose();
});
test('Saber skill uses loaded attack contact and restores idle; unloaded command rejected', async () => {
  const root = new THREE.Group(), contract = new FirstContract(new Set(['saber_contract'])), r = recorder(1); let normal = 0;
  const servant = new ContractServant({ scene: new THREE.Scene(), contract, colliders: [floor()], marker: { id: 'saber_contract', type: 'interact', label: 'Saber', p: [0, 0, 0] }, target: () => null, strike: () => { normal++; return null; }, load: async () => ({ scene: root, animations: SERVANT_CLIPS.map(name => new THREE.AnimationClip(name, name === 'Attack' ? 1.2 : 1, [])) } as GLTF) });
  assert.equal(servant.startSkillPose(r.command), false); await servant.ensureLoaded();
  assert.equal(servant.startSkillPose(r.command), true);
  const contact = 1.2 * SERVANT_MOTION.attackContact;
  for (let t = 0; t < contact - .05; t += .05) servant.update(.05, new THREE.Vector3(), 0, true, false);
  assert.equal(r.hits.length, 0); servant.update(.05, new THREE.Vector3(), 0, true, false); assert.equal(r.hits.length, 1);
  for (let i = 0; i < 20 && !r.ended.length; i++) servant.update(.05, new THREE.Vector3(), 0, true, false);
  assert.deepEqual(r.ended, [true]); assert.equal(normal, 0); assert.equal(r.hits[0].geometry?.losOffset, 1); assert.equal(r.hits[0].geometry?.casterFeetY, r.hits[0].position.y); assert.equal(servant.animation, 'Idle'); servant.dispose();
});
test('authored skill generation ignores timer contacts, stale callbacks and extra authored hits', () => {
  const s = new ContractSkills(), ctx = { enabled: true, origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } };
  s.setIdentity('musashi'); s.activate('skill', ctx); const token = s.bindPresentation()!; s.drainEvents();
  for (let i = 0; i < 20; i++) s.update(.1, true); assert.deepEqual(s.drainEvents(), []);
  assert.equal(s.contact(token), true); assert.equal(s.contact(token), true); assert.equal(s.contact(token), false);
  s.finishPresentation(token); assert.equal(s.drainEvents().length, 2);
  s.reset(); s.activate('skill', ctx); const newer = s.bindPresentation()!; s.drainEvents();
  s.finishPresentation(token, false); assert.equal(s.casting, true); assert.equal(s.contact(token), false); assert.equal(s.contact(newer), true);
});
test('real delivered GLBs run skill montages with their original attack events and finite socket transforms', async () => {
  for (const [id, count] of [['blackbeard', 3], ['musashi', 2], ['napoleonMounted', 1]] as const) {
    const definition = CHARACTER_KITS[id], { gltf } = await readCharacter(fileURLToPath(new URL(definition.assetUrl)));
    const sourceAttack = gltf.animations.find(c => c.name === definition.clips.attack.name)!;
    const snapshot = sourceAttack.tracks.map(t => Array.from(t.values));
    const f = kitFixture(id, gltf), r = recorder(count);
    assert.equal(f.follow.startSkillPose(f.actor, r.command, f.player, 0), true, id);
    for (let i = 0; i < 900 && !r.ended.length; i++) f.tick(1 / 120);
    assert.equal(r.hits.length, count, id); assert.deepEqual(r.ended, [true], id); assert.equal(f.ordinary(), 0, id);
    assert.ok(r.hits.every(h => h.position.toArray().every(Number.isFinite)), id);
    assert.deepEqual(sourceAttack.tracks.map(t => Array.from(t.values)), snapshot, `${id} authored attack unchanged`);
    f.follow.release(f.actor); f.actor.dispose();
  }
});

test('Q/X remapping keeps exact authored event clocks across fine/coarse frames and bounded spikes',()=>{
 for(const id of ['blackbeard','musashi'] as const)for(const slot of ['skill','ultimate'] as const){
  const contacts=id==='blackbeard'?(slot==='skill'?1:3):(slot==='skill'?2:3),runs:number[][]=[];
  for(const dt of [1/120,.1,10]){
   const f=kitFixture(id),r=recorder(contacts),times:number[]=[],clipTimes:number[]=[];let now=0;
   r.command.slot=slot;const record=r.command.onContact;r.command.onContact=(...args)=>{times.push(now);clipTimes.push(f.actor.clipTime);record(...args);};
   f.follow.startSkillPose(f.actor,r.command,f.player,0);
   for(let i=0;i<900&&!r.ended.length;i++){now+=Math.min(.1,dt);f.tick(dt);}
   assert.deepEqual(r.ended,[true],`${id}/${slot}/${dt}`);assert.equal(r.hits.length,contacts);assert.equal(f.ordinary(),0);
   const authored=CHARACTER_KITS[id].clips.attack.events.map(e=>e.at);
   clipTimes.forEach((t,i)=>assert.ok(Math.abs(t-authored[i%authored.length])<1e-8,'never moves authored contact time'));
   runs.push(times);f.actor.dispose();
  }
  for(const times of runs.slice(1))times.forEach((t,i)=>assert.ok(Math.abs(t-runs[0][i])<=.101,`${id}/${slot} frame partition shifted event ${i}`));
 }
});

test('Q/X cancellation inside a real contact callback cannot deliver later contacts or ordinary damage',()=>{
 for(const slot of ['skill','ultimate'] as const){
  const f=kitFixture('musashi'),r=recorder(slot==='skill'?2:3);r.command.slot=slot;
  const record=r.command.onContact;r.command.onContact=(...args)=>{record(...args);f.follow.release(f.actor);};
  f.follow.startSkillPose(f.actor,r.command,f.player,0);for(let i=0;i<40&&!r.ended.length;i++)f.tick(.1);
  assert.equal(r.hits.length,1);assert.deepEqual(r.ended,[false]);assert.equal(f.ordinary(),0);assert.equal(f.actor.state,'idle');f.actor.dispose();
 }
});

test('real GLB Q/X holds are distinct poses while contact socket transforms remain authored and unchanged',async()=>{
 for(const id of ['blackbeard','musashi'] as const){
  const definition=CHARACTER_KITS[id],{gltf}=await readCharacter(fileURLToPath(new URL(definition.assetUrl)));
  const source=gltf.animations.find(c=>c.name===definition.clips.attack.name)!,snapshot=source.tracks.map(t=>Array.from(t.values));
  // Reuse the loaded asset only within one actor; each run returns to the same origin/yaw.
  const f=kitFixture(id,gltf),samples:number[][]=[],contacts:THREE.Vector3[][]=[];
  for(const slot of [undefined,'skill','ultimate'] as const){
   f.follow.release(f.actor);const r=recorder(id==='musashi'?2:1);r.command.slot=slot;f.actor.root.rotation.y=0;
   f.follow.startSkillPose(f.actor,r.command,f.player,0);
   for(let i=0;i<90;i++)f.tick(1/120);
   f.actor.root.updateMatrixWorld(true);const positions:number[]=[];
   f.actor.model.traverse(o=>{if(o instanceof THREE.Bone)positions.push(...o.getWorldPosition(new THREE.Vector3()).toArray());});samples.push(positions);
   for(let i=0;i<700&&!r.ended.length;i++)f.tick(1/120);
   assert.deepEqual(r.ended,[true]);contacts.push(r.hits.map(h=>h.position));
  }
  assert.ok(samples[0].length>30);assert.ok(samples[0].some((n,i)=>Math.abs(n-samples[1][i])>.03),`${id} Q differs from ordinary pose`);
  assert.ok(samples[1].some((n,i)=>Math.abs(n-samples[2][i])>.03),`${id} Q differs from X pose`);
  for(const run of contacts.slice(1))run.forEach((p,i)=>assert.ok(p.distanceTo(contacts[0][i])<1e-4,`${id} authored socket changed`));
  assert.deepEqual(source.tracks.map(t=>Array.from(t.values)),snapshot);f.actor.dispose();
 }
});

test('real Saber X holds the raised sword pose, Q releases sooner, and leash cancellation cannot revive a hit',async()=>{
 const {SERVANT_MODELS}=await import('../src/servant.ts');
 const {gltf}=await readCharacter(fileURLToPath(new URL(SERVANT_MODELS.armor))),source=gltf.animations.find(c=>c.name==='Attack')!,tracks=source.tracks.map(t=>Array.from(t.values));
 const contract=new FirstContract(new Set(['saber_contract']));let normal=0;
 const servant=new ContractServant({scene:new THREE.Scene(),contract,colliders:[floor()],marker:{id:'saber_contract',type:'interact',label:'Saber',p:[0,0,0]},target:()=>null,strike:()=>{normal++;return null;},load:async()=>gltf});
 await servant.ensureLoaded();const hands:number[]=[],hitHands:THREE.Vector3[]=[];
 for(const slot of [undefined,'skill','ultimate'] as const){
  const r=recorder(1);r.command.slot=slot;servant.root.rotation.y=0;
  const record=r.command.onContact;r.command.onContact=(...args)=>{servant.root.updateMatrixWorld(true);hitHands.push(gltf.scene.getObjectByName('mixamorigRightHand')!.getWorldPosition(new THREE.Vector3()));record(...args);};
  assert.equal(servant.startSkillPose(r.command),true);
  for(let i=0;i<55;i++)servant.update(1/120,new THREE.Vector3(),0,true,false);
  servant.root.updateMatrixWorld(true);hands.push(gltf.scene.getObjectByName('mixamorigRightHand')!.getWorldPosition(new THREE.Vector3()).y);
  for(let i=0;i<300&&!r.ended.length;i++)servant.update(1/120,new THREE.Vector3(),0,true,false);
  assert.deepEqual(r.ended,[true]);assert.equal(r.hits.length,1);
 }
 assert.ok(hands[2]>hands[1]+.2,'X visibly holds sword arm above already-released Q');
 for(const hand of hitHands.slice(1))assert.ok(hand.distanceTo(hitHands[0])<1e-4,'same real contact pose');
 assert.deepEqual(source.tracks.map(t=>Array.from(t.values)),tracks);assert.equal(normal,0);
 const cancel=recorder(1);cancel.command.slot='ultimate';servant.startSkillPose(cancel.command);servant.update(.1,new THREE.Vector3(),0,true,false);
 servant.update(.1,new THREE.Vector3(30,0,0),0,true,false);assert.deepEqual(cancel.ended,[false]);
 for(let i=0;i<30;i++)servant.update(.1,new THREE.Vector3(),0,true,false);assert.equal(cancel.hits.length,0);servant.dispose();
});

test('cancelled mounted skill recovers in place instead of pretending to be newly summoned',()=>{
 const f=kitFixture('napoleonMounted'),r=recorder(1);assert.equal(f.follow.startSkillPose(f.actor,r.command,f.player,0),true);
 for(let i=0;i<100&&f.follow.mountedPhase!=='charge';i++)f.tick();assert.equal(f.follow.mountedPhase,'charge');
 const at=f.actor.root.position.clone();f.follow.cancelSkillPose(f.actor);assert.deepEqual(r.ended,[false]);
 for(let i=0;i<3;i++)f.tick();assert.ok(at.distanceTo(f.actor.root.position)<1e-8);assert.equal(r.hits.length,0);f.actor.dispose();
});
