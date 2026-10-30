import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshBVH } from 'three-mesh-bvh';
import { CompanionMotion, COMPANION_MOTION, companionGait, turnCompanion } from '../src/characters/companionMotion.ts';
import { CharacterKit, type CharacterKitDefinition } from '../src/characters/characterKit.ts';
import { KitCompanion } from '../src/kitCompanion.ts';
import { ContractServant, SERVANT_CLIPS, SERVANT_MOTION } from '../src/servant.ts';
import { FirstContract } from '../src/contracts.ts';

function kitFixture() {
  const scene = new THREE.Group(), point = new THREE.Object3D(); point.name = 'Point'; scene.add(point);
  const definition: CharacterKitDefinition = { id: 'motion-test', assetUrl: 'local-only', defaultState: 'idle', rootMotion: 'in-place', sockets: {}, clips: {
    idle: { name: 'Idle', duration: 3, loop: true }, walk: { name: 'Walk', duration: 1, loop: true, nominalSpeed: .75 },
    run: { name: 'Run', duration: .65, loop: true, nominalSpeed: 2 }, attack: { name: 'Attack', duration: 1.4, loop: false, events: [{ at: .6, kind: 'hit' }] },
  } };
  const animations = Object.values(definition.clips).map((clip, i) => new THREE.AnimationClip(clip.name, clip.duration, [new THREE.VectorKeyframeTrack('Point.position', [0, clip.duration], [i, 0, 0, i, 0, 0])]));
  const actor = new CharacterKit({ scene, animations } as GLTF, definition);
  return { actor, point };
}
const floor = () => [{ name: 'floor', enabled: true, bvh: new MeshBVH(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2)) }];

test('companion reversals turn along the short arc, obey a finite angular speed and do not moonwalk', () => {
  const root = new THREE.Group(); root.rotation.y = Math.PI - .05;
  const before = root.rotation.y; turnCompanion(root, -Math.PI + .05, .01);
  assert.ok(Math.abs(root.rotation.y - before - .08) < 1e-8, 'wrap uses the 0.1-radian short path');
  root.rotation.y = 0; const motion = new CompanionMotion(), goal = new THREE.Vector3(0, 0, -10);
  for (let i = 0; i < 10; i++) {
    const heading = root.rotation.y, position = root.position.clone(); motion.step(root, goal, 1 / 120, 6);
    assert.ok(Math.abs(root.rotation.y - heading) <= COMPANION_MOTION.turnRate / 120 + 1e-9);
    assert.ok(root.position.distanceTo(position) < 1e-9, 'wait for a forward-facing hemisphere before moving');
  }
});

test('follow starts and brakes without overshoot and selects gait from authored stride speed', () => {
  const root = new THREE.Group(), motion = new CompanionMotion(), goal = new THREE.Vector3(0, 0, 10);
  let previous = 0, maximum = 0;
  for (let i = 0; i < 600; i++) {
    const speed = motion.step(root, goal, 1 / 120, 6); maximum = Math.max(maximum, speed);
    assert.ok(speed <= 6 + 1e-9); assert.ok(speed - previous <= COMPANION_MOTION.acceleration / 120 + 1e-9); previous = speed;
    assert.ok(root.position.z <= 9.75 + 1e-9);
  }
  assert.ok(maximum > 5.9, 'preserve existing chase speed'); assert.ok(goal.distanceTo(root.position) < .26);
  assert.equal(companionGait(1, .75, false), 'walk'); assert.equal(companionGait(1.5, .75, false), 'run');
  assert.equal(companionGait(1.2, .75, true), 'run', 'hysteresis prevents threshold chatter');
});

test('walking/running preserve contact phase and synchronize the fading gait even when speed changes', () => {
  const { actor } = kitFixture(); actor.play('walk', { speed: .75 }); actor.update(.25); actor.update(.12);
  const phase = actor.clipTime / actor.definition.clips.walk.duration;
  actor.play('run', { speed: 4 });
  assert.ok(Math.abs(actor.clipTime / actor.definition.clips.run.duration - phase) < 1e-8);
  const actions = (actor as any).actions as Map<string, THREE.AnimationAction>;
  actor.update(.03); actor.play('run', { speed: 3 }); actor.update(.03);
  const walkPhase = actions.get('walk')!.time / actor.definition.clips.walk.duration;
  const runPhase = actions.get('run')!.time / actor.definition.clips.run.duration;
  assert.ok(Math.abs(walkPhase - runPhase) < 1e-8);
  actor.play('attack'); assert.equal(actor.clipTime, 0, 'an attack always begins at authored anticipation, not a gait phase'); actor.dispose();
});

test('rapid crossfade interruptions preserve the current blended pose and normalized weights', () => {
  const { actor, point } = kitFixture(); actor.update(.01); actor.play('walk'); actor.update(.05);
  for (const state of ['run', 'idle', 'walk', 'run', 'idle']) {
    const position = point.position.clone(); actor.play(state); (actor as any).blend.update(actor.mixer, 0);
    assert.ok(point.position.distanceTo(position) < 1e-8, `${state}: no weight-reset pose jump`);
    actor.update(.025);
    const weights = [...((actor as any).actions as Map<string, THREE.AnimationAction>).values()].filter(a => a.enabled && a.isScheduled()).reduce((sum, a) => sum + a.getEffectiveWeight(), 0);
    assert.ok(Math.abs(weights - 1) < 1e-8);
  }
  actor.dispose();
});

test('walking kits keep actual follow displacement and animation stride speed matched through walk/run/stop', () => {
  const { actor } = kitFixture(), follow = new KitCompanion({ colliders: floor(), range: 3.5, damage: 9, target: () => null, strike: () => null }), player = new THREE.Vector3();
  follow.update(actor, 1 / 60, player, 0, false);
  let runFrames = 0, walkFrames = 0;
  for (let i = 0; i < 480; i++) {
    if (i < 240) player.z += (i < 120 ? 1 : 5) / 60;
    const p = actor.root.position.clone(), yaw = actor.root.rotation.y;
    follow.update(actor, 1 / 60, player, 0, false);
    const speed = actor.root.position.distanceTo(p) * 60;
    assert.ok(Math.abs(actor.root.rotation.y - yaw) <= COMPANION_MOTION.turnRate / 60 + 1e-8);
    if (actor.state === 'walk' || actor.state === 'run') {
      const expected = actor.playbackRate * actor.definition.clips[actor.state].nominalSpeed!;
      assert.ok(Math.abs(speed - expected) < 1e-8, `${actor.state} displacement ${speed} vs gait ${expected}`);
      actor.state === 'run' ? runFrames++ : walkFrames++;
    }
  }
  assert.ok(runFrames > 50 && walkFrames > 50); assert.equal(actor.state, 'idle'); actor.dispose();
});

test('Saber actual follow speeds use the same stride budget and preserve 6m/s chase within its 3x run limit', async () => {
  const scene = new THREE.Group(), gltf = { scene, animations: SERVANT_CLIPS.map(name => new THREE.AnimationClip(name, name === 'Attack' ? 1.2 : 1, [])) } as GLTF;
  const servant = new ContractServant({ scene: new THREE.Scene(), marker: { id: 'saber_contract', type: 'interact', label: 'Saber', p: [0, 0, 0] }, contract: new FirstContract(new Set(['saber_contract'])), colliders: floor(), load: async () => gltf, target: () => null, strike: () => null });
  await servant.ensureLoaded(); const player = new THREE.Vector3(); servant.update(1 / 60, player, 0, true, false);
  let maximum = 0;
  for (let i = 0; i < 180; i++) {
    player.z += 6 / 60; const p = servant.root.position.clone(); servant.update(1 / 60, player, 0, true, false);
    const speed = servant.root.position.distanceTo(p) * 60; maximum = Math.max(maximum, speed);
    if (servant.animation === 'Walk' || servant.animation === 'Run') {
      const action = (servant as any).current as THREE.AnimationAction;
      const nominal = servant.animation === 'Walk' ? SERVANT_MOTION.walkSpeed : SERVANT_MOTION.runSpeed;
      assert.ok(Math.abs(speed - action.getEffectiveTimeScale() * nominal) < 1e-8);
    }
  }
  assert.ok(maximum > 5.8 && maximum <= SERVANT_MOTION.runSpeed * SERVANT_MOTION.maxRate + 1e-8); servant.dispose();
});


test('re-entering a still-visible gait during stop/start retains its clock instead of snapping weighted limbs to frame zero', () => {
  const { actor, point } = kitFixture();
  const walk = ((actor as any).actions as Map<string, THREE.AnimationAction>).get('walk')!;
  // Non-constant channel makes phase resets visible, unlike a static weight fixture.
  const track = walk.getClip().tracks[0]; track.values[3] = 5;
  actor.play('walk'); actor.update(.25); actor.update(.13); actor.play('idle'); actor.update(.04);
  const position = point.position.clone(), phase = walk.time;
  actor.play('walk'); (actor as any).blend.update(actor.mixer, 0);
  assert.ok(Math.abs(actor.clipTime - phase) < 1e-8);
  assert.ok(point.position.distanceTo(position) < 1e-8, 'weighted gait pose is continuous at re-entry'); actor.dispose();
});

test('sprinting and sharp player turns keep a foot companion recoverable with supported, non-attacking regroup',()=>{
 const {actor}=kitFixture(),player=new THREE.Vector3(),colliders=floor();let rejoins=0,contacts=0;
 const follow=new KitCompanion({colliders,range:3.5,damage:9,target:()=>null,strike:()=>{contacts++;return null;},onRejoin:()=>rejoins++});
 follow.update(actor,1/60,player,0,false);
 let largestGap=0;
 for(let i=0;i<900;i++) {
  const yaw=i<450?0:Math.PI/2;
  if(i<720){player.x+=i<450?0:9/60;player.z+=i<450?9/60:0;}
  const before=actor.root.position.clone(),count=rejoins;
  follow.update(actor,1/60,player,yaw,false);
  largestGap=Math.max(largestGap,actor.root.position.distanceTo(player));
  if(rejoins===count)assert.ok(actor.root.position.distanceTo(before)<=.10001,'walking never exceeds authored stride budget');
  else {assert.ok(actor.root.position.distanceTo(player)<4);assert.ok(Math.abs(actor.root.position.y)<1e-7);assert.notEqual(actor.state,'attack');}
 }
 assert.ok(rejoins>0,'a 9m/s player can outpace the 6m/s rig, so explicit safe regroup is exercised');
 assert.ok(largestGap<33,`no indefinitely abandoned follower: ${largestGap}`);
 assert.ok(actor.root.position.distanceTo(player)<4);assert.equal(contacts,0);actor.dispose();
});

test('failed safe-regroup placement backs off, but a clearly moved player gets a fresh collision check',()=>{
 const {actor}=kitFixture(),player=new THREE.Vector3(100,0,0);
 const follow=new KitCompanion({colliders:[],range:3.5,damage:9,target:()=>null,strike:()=>null});
 const nav=(follow as any).navigation, original=nav.safeReturn.bind(nav);let checks=0;
 nav.safeReturn=(...args:any[])=>{checks++;return original(...args);};
 for(let i=0;i<120;i++)follow.update(actor,1/60,player,0,false);
 assert.ok(checks>=4&&checks<=8,`failed placement must not run every frame: ${checks}`);
 assert.ok(actor.root.position.distanceTo(player)>90,'missing floor never becomes a cached successful placement');
 while((follow as any).rejoinRetry<.2)follow.update(actor,1/60,player,0,false);
 const before=checks;player.x+=3;follow.update(actor,1/60,player,0,false);
 assert.equal(checks,before+1,'meaningful movement invalidates failure backoff');
 follow.release(actor);assert.equal((follow as any).rejoinRetry,0);actor.dispose();
});

test('committed ordinary attacks track their one target without rescanning engagement candidates every frame',()=>{
 const {actor}=kitFixture(),player=new THREE.Vector3(),enemy={id:'enemy',position:new THREE.Vector3(0,0,3)};
 let engagements=0,observations=0,hits=0;
 const follow=new KitCompanion({colliders:floor(),range:3.5,damage:9,target:()=>enemy,track:()=>{observations++;return enemy;},engage:()=>{engagements++;return enemy;},strike:()=>{hits++;return enemy;}});
 for(let i=0;i<300&&actor.state!=='attack';i++)follow.update(actor,1/60,player,0,false);
 assert.equal(actor.state,'attack');const count=engagements;
 while(actor.state==='attack') {enemy.position.x+=.001;follow.update(actor,1/60,player,0,false);assert.equal(engagements,count);}
 assert.ok(observations>0); // Event wiring is owned by production CharacterKit fixtures, not this motion-only rig.
 follow.release(actor);actor.dispose();
});
