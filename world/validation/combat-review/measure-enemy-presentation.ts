/** CPU-only native presentation microbenchmark, not GPU frame rate or gameplay timing. */
import assert from 'node:assert/strict';import * as THREE from 'three';import {performance} from 'node:perf_hooks';import {writeFile,mkdir} from 'node:fs/promises';
import {EnemyVisuals,type EnemyModel} from '../../src/enemyVisuals';import {WorldCombatState,enemyAttackTiming} from '../../src/combat';import {parseLocalGlb} from '../player-fixture';import {nativeMusketeerContactMuzzle} from '../../src/enemyShotSocket';
const models:EnemyModel[]=['samurai','sunward_guard','deck_raider','officer','musketeer','ashigaru'],assets=new Map();for(const model of models)assets.set(model,await parseLocalGlb(new URL(`../../public/assets/enemies/${model}.glb`,import.meta.url)));
const results:any[]=[];
for(const count of [2,12,24])for(const attacking of [false,true]){
 const visuals=new EnemyVisuals(),parents=Array.from({length:count},()=>new THREE.Group()),fallbacks=parents.map(()=>new THREE.Group()),state=new WorldCombatState(Array.from({length:count},(_,i)=>({id:`bench_${i}`,kind:'shade' as const,role:'duelist' as const,p:{x:i*3,y:0,z:0}})),[]);
 for(const [model,asset]of assets)(visuals as any).cache.set(model,asset);
 const run=(frame:number)=>{for(let i=0;i<count;i++){const e=state.enemies[i],model=models[i%models.length];e.active=true;e.attackCount=e.contactSequence=1;e.attack=model==='musketeer'?'shot':model==='ashigaru'?'thrust':'sweep';e.mode=attacking?'windup':'chase';e.timer=attacking?.1:enemyAttackTiming(e).windup;visuals.update(e,model,parents[i],fallbacks[i],1/60,5,true);}};
 for(let i=0;i<60;i++)run(i);assert.equal(visuals.diagnostics.activeMixers,count);const times:number[]=[];for(let i=0;i<300;i++){const start=performance.now();run(i);times.push(performance.now()-start);}times.sort((a,b)=>a-b);results.push({count,attacking,medianMs:times[150],p95Ms:times[285],maxMs:times.at(-1),note:attacking&&count>2?'Synthetic simultaneous-windup ceiling, not a normal pack state':'Native update-only CPU proxy'});
 // Templates are reused across cases; detach cache so this local instance teardown
 // cannot dispose shared benchmark assets before the remaining cases.
 (visuals as any).cache.clear();visuals.dispose();
}
const asset=assets.get('musketeer'),start=performance.now();for(let i=0;i<10000;i++)nativeMusketeerContactMuzzle(asset);const cachedSocket10000Ms=performance.now()-start;
const report={evidence:'Single-process CPU visual update benchmark: excludes renderer, GPU, physics, DOM and human frame pacing. Shared host load may affect timings.',results,cachedSocket10000Ms};await mkdir('../artifacts/enemy-performance',{recursive:true});await writeFile('../artifacts/enemy-performance/native-presentation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
