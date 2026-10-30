import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameWorkBudget } from '../src/frameWorkBudget';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

test('continuous map work stays at 30Hz under 120Hz frames, without starvation', () => {
  const budget = new FrameWorkBudget(30); let count = 0;
  for (let frame = 0; frame < 1200; frame++) if (budget.due(frame * 1000 / 120, { active: true })) count++;
  assert.equal(count, 300);
});
test('unchanged idle work skips but discrete state changes and invalidation paint immediately', () => {
  const budget = new FrameWorkBudget(30);
  assert.equal(budget.due(0, { active: false, revision: 'closed:zh:0' }), true);
  assert.equal(budget.due(1, { active: false, revision: 'closed:zh:0' }), false);
  for (const revision of ['open:zh:0', 'open:en:0', 'open:en:1', 'closed:en:1'])
    assert.equal(budget.due(2, { active: false, revision }), true, revision);
  budget.invalidate(); assert.equal(budget.due(3, { active: false, revision: 'closed:en:1' }), true);
  assert.equal(budget.due(10000, { active: false, revision: 'closed:en:1' }), false);
});
test('stopping movement paints final position even inside the interval', () => {
  const budget = new FrameWorkBudget(30);
  assert.equal(budget.due(0, { active: true }), true);
  assert.equal(budget.due(4, { active: true }), false);
  assert.equal(budget.due(8, { active: false }), true);
  assert.equal(budget.due(12, { active: false }), false);
  assert.equal(budget.due(16, { active: true }), false);
  assert.equal(budget.due(42, { active: true }), true);
});
test('large jumps emit once, backwards clock recovers, invalid samples cannot corrupt cadence', () => {
  const budget = new FrameWorkBudget(4), state = { active: true };
  assert.equal(budget.due(0, state), true);
  assert.equal(budget.due(100000, state), true);
  assert.equal(budget.due(100001, state), false);
  assert.equal(budget.due(1, state), true);
  for (const now of [NaN, Infinity, -Infinity]) assert.equal(budget.due(now, state), false);
  assert.equal(budget.due(250, state), false);
  assert.equal(budget.due(251, state), true);
});
test('task schedules remain independent; invalid rates fail early', () => {
  const map = new FrameWorkBudget(30), stats = new FrameWorkBudget(4), state = { active: true };
  assert.equal(map.due(0, state), true); assert.equal(stats.due(0, state), true);
  assert.equal(map.due(34, state), true); assert.equal(stats.due(34, state), false);
  map.invalidate(); assert.equal(map.due(35, state), true); assert.equal(stats.due(35, state), false);
  for (const hz of [0, -1, NaN, Infinity]) assert.throws(() => new FrameWorkBudget(hz), RangeError);
});

test('production map/HUD/stat integration actually schedules less work and invalidates discrete changes',()=>{
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  const mapStart=source.indexOf('if (mapBudget.due(now,'),mapEnd=source.indexOf('timeUniform.value',mapStart);
  const hud=source.split('\n').find(line=>line.includes('if (hudBudget.due(now,'))!;
  const statsStart=source.indexOf('if (statsBudget.due(now,'),statsEnd=source.indexOf('requestAnimationFrame(frame)',statsStart);
  assert.ok(mapStart>0&&mapEnd>mapStart&&hud&&statsStart>0&&statsEnd>statsStart);
  let miniDraws=0,bigDraws=0,hudDraws=0,statWrites=0,open=false;
  const stats={set textContent(_value:string){statWrites++;}};
  const context=vm.createContext({now:0,hudRevision:0,mapBudget:new FrameWorkBudget(30),hudBudget:new FrameWorkBudget(10),statsBudget:new FrameWorkBudget(4),
    map:{draw:(_canvas:unknown,_position:unknown,_yaw:unknown,options:{full:boolean})=>options.full?bigDraws++:miniDraws++},
    mini:{},big:{},player:{pos:{x:0,y:0,z:0},yaw:0},done:new Set(),found:new Set(),mt:null,
    $:()=>({classList:{contains:()=>open}}),renderContract(){},actionHud:{update(){hudDraws++;}},actions:{},gameplayActive:()=>true,inspectServant:false,
    stats,fps:120,dpr:1.25,info:{calls:0,triangles:0},bilingual:(zh:string)=>zh});
  vm.runInContext(transformSync(`globalThis.tick=()=>{${source.slice(mapStart,mapEnd)}\n${hud}\n${source.slice(statsStart,statsEnd)}}`,{loader:'ts'}).code,context);
  for(let i=0;i<120;i++){context.now=i*1000/120;context.tick();}
  assert.equal(miniDraws,30);assert.equal(bigDraws,0);assert.equal(hudDraws,10);assert.equal(statWrites,4);
  open=true;context.hudRevision++;context.now+=1;context.tick();assert.equal(bigDraws,1);assert.equal(hudDraws,11);assert.equal(statWrites,5);
  context.hudRevision++;context.now+=1;context.tick();assert.equal(bigDraws,2,'locale/progress revision paints before the next period');
});
