import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import * as THREE from 'three';
import { Player } from '../src/player';
import * as travel from '../src/safeTravel';

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const start = source.indexOf('function travelContext()');
const end = source.indexOf('const travelPanel =', start);
assert.ok(start >= 0 && end > start, 'production travel strategy is available');
const code = transformSync(source.slice(start, end), { loader: 'ts' }).code;
const panelEnd = source.indexOf('const travelOpen=', end);
assert.ok(panelEnd > end);
const panelCode = transformSync(source.slice(end, panelEnd), { loader: 'ts' }).code;
function fixture() {
  const done = new Set(['summon_circle']), found = new Set(['travel_britain']);
  const player = new Player([], 0); player.teleport(0,10,0); player.onGround = true;
  const actions = { skills: { casting: false, energy: 67, cooldown: 12 }, melee: { active: false }, evade: { active: false }, cancel() {} };
  const fortCannon = { mounted: false, cancel() {} };
  let clearCount = 0, animationResets = 0;
  const messages: string[] = [];
  const combat = {
    defeated: false, bossStarted: false, state: { enemies: [] as any[], quietFor: 5, hp: 61 },
    geometry: { ground: (_x: number, _z: number, _ceiling: number): {point:THREE.Vector3}|null => ({ point: new THREE.Vector3(100,10,15) }), clear: (_p: THREE.Vector3, _r: number, _h: number) => true },
  };
  const stops = travel.createSafeTravelStops([{ id:'britain', name:['据点','Stop'], position:[100,10,0], entry:[100,10,15], footprint:[30,30], groundRange:0 }]);
  // Existing travel assertions exercise the ordinary (non-cinematic) action gates.
  const context = vm.createContext({ ultimateDirector: undefined, ...travel, player, combat, actions, fortCannon, done, found, travelStops: stops,
    optionalPin:{sentinel:true}, hudRevision:0, camDist:3.6, acc:1, inspectServant:false, travelOpenState:false,
    createTravelPanel:(options:unknown)=>options, document:{pointerLockElement:{},exitPointerLock(){}},
    spawn:{id:'old_spawn'}, prevPos:new THREE.Vector3(), rig:{root:{position:new THREE.Vector3()}}, worldProgress:{armed:true},
    anim:{reset(){animationResets++;}},
    clearInput(){ clearCount++; actions.skills.casting=false; actions.melee.active=false; actions.evade.active=false; fortCannon.mounted=false; },
    toast:(message:string)=>messages.push(message), bilingual:(_zh:string,en:string)=>en,
  });
  vm.runInContext(code + panelCode + '\nglobalThis.runTravel=executeSafeTravel;globalThis.readTravelContext=travelContext;globalThis.panelHooks=travelPanel;', context);
  return { context, done, found, player, actions, fortCannon, combat, messages,
    execute:()=>context.runTravel('travel_britain'), clears:()=>clearCount, resets:()=>animationResets };
}

test('production execution validates active casts before clearInput can cancel them', () => {
  const f = fixture(); f.actions.skills.casting=true;
  assert.equal(f.execute(), false);
  assert.equal(f.clears(), 0); assert.equal(f.actions.skills.casting, true);
  assert.equal(f.player.pos.x, 0); assert.equal(f.context.spawn.id, 'old_spawn');
  assert.match(f.messages[0], /finish your current action/);
});

test('production execution rechecks every unsafe state rather than trusting an old enabled panel button', () => {
  const blocks: ((f: ReturnType<typeof fixture>)=>void)[] = [
    f=>{f.combat.defeated=true;}, f=>{f.combat.bossStarted=true;}, f=>{f.combat.state.quietFor=4.9;},
    f=>{f.combat.state.enemies.push({active:true,pacified:false,mode:'chase',p:{x:2,y:10,z:0}});},
    f=>{f.player.flying=true;}, f=>{f.player.gliding=true;}, f=>{f.player.swimming=true;}, f=>{f.player.onGround=false;},
    f=>{f.fortCannon.mounted=true;}, f=>{f.actions.melee.active=true;}, f=>{f.actions.evade.active=true;},
    f=>{f.found.clear();}, f=>{f.done.clear();},
  ];
  for (const block of blocks) {
    const f=fixture(); block(f);
    assert.equal(f.execute(), false); assert.equal(f.clears(), 0);
    assert.equal(f.context.spawn.id,'old_spawn'); assert.equal(f.player.pos.x,0);
    assert.equal(f.combat.state.hp,61); assert.equal(f.actions.skills.energy,67); assert.equal(f.actions.skills.cooldown,12);
  }
});

test('invalid arrival geometry rejects before changing location, spawn, input or progress', () => {
  for (const fail of ['missing','height','blocked']) {
    const f=fixture();
    if (fail==='missing') f.combat.geometry.ground=()=>null;
    if (fail==='height') f.combat.geometry.ground=()=>({point:new THREE.Vector3(100,25,15)});
    if (fail==='blocked') f.combat.geometry.clear=()=>false;
    assert.equal(f.execute(),false); assert.equal(f.clears(),0); assert.equal(f.context.spawn.id,'old_spawn');
    assert.equal(f.player.pos.x,0); assert.deepEqual([...f.done],['summon_circle']); assert.deepEqual([...f.found],['travel_britain']);
  }
});

test('successful production travel uses checked ground, clears momentum, sets respawn and preserves resources', () => {
  const f=fixture(); f.player.vel.set(3,-5,4);
  assert.equal(f.execute(),true); assert.equal(f.clears(),1); assert.equal(f.resets(),1);
  assert.deepEqual(f.player.pos.toArray(),[100,10.25,15]); assert.deepEqual(f.player.vel.toArray(),[0,0,0]);
  assert.equal(f.context.spawn.id,'travel_britain'); assert.deepEqual([...f.context.spawn.p],[100,10,15]);
  assert.equal(f.context.optionalPin,null); assert.equal(f.context.acc,0);
  assert.equal(f.combat.state.hp,61); assert.equal(f.actions.skills.energy,67); assert.equal(f.actions.skills.cooldown,12);
  assert.deepEqual([...f.done],['summon_circle']); assert.deepEqual([...f.found],['travel_britain']);
});


test('production panel opening cannot cancel a cast or cannon first and thereby launder its busy state', () => {
  for (const busy of ['cast','melee','evade','cannon']) {
    const f = fixture();
    if (busy === 'cast') f.actions.skills.casting=true;
    if (busy === 'melee') f.actions.melee.active=true;
    if (busy === 'evade') f.actions.evade.active=true;
    if (busy === 'cannon') f.fortCannon.mounted=true;
    assert.equal(f.context.panelHooks.onOpen(), false);
    assert.equal(f.clears(),0); assert.equal(f.context.travelOpenState,false);
    assert.equal(f.execute(),false, 'opening did not erase busy state');
  }
  const safe = fixture();
  assert.equal(safe.context.panelHooks.onOpen(),true);
  assert.equal(safe.context.travelOpenState,true); assert.equal(safe.clears(),1);
});
