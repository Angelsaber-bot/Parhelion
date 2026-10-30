/** CPU-only matched workload; not GPU/rendered FPS. Run from world with node --import tsx.
 * For baseline: git show <base>:world/src/{file}.ts > world/src/{file}.before.ts
 * for enemyVisuals and valleySentinel, then set ENEMY_BENCH_SUFFIX=.before. Remove copies after.
 */
import * as THREE from 'three';
import { performance } from 'node:perf_hooks';
import { WorldCombatState } from '../src/combat.ts';
import { parseLocalGlb } from './player-fixture.ts';
const suffix=process.env.ENEMY_BENCH_SUFFIX??'';
const {EnemyVisuals}=await import(`../src/enemyVisuals${suffix}.ts`);
const {makeValleySentinel}=await import(`../src/valleySentinel${suffix}.ts`);
const measure=(name:string,run:()=>void)=>{
  for(let i=0;i<30;i++)run();
  const samples=[];for(let s=0;s<7;s++){const start=performance.now();for(let i=0;i<200;i++)run();samples.push((performance.now()-start)/200);}
  samples.sort((a,b)=>a-b);console.log(JSON.stringify({name,medianMsPerFrame:samples[3],min:samples[0],max:samples[6]}));
};
const visuals=new EnemyVisuals();
(visuals as any).cache.set('ashigaru',await parseLocalGlb(new URL('../public/assets/enemies/ashigaru.glb',import.meta.url)));
const state=new WorldCombatState(Array.from({length:24},(_,i)=>({id:`bench_${i}`,kind:'shade' as const,p:{x:0,y:0,z:720}})),[]);
const parents=state.enemies.map(()=>new THREE.Group()),fallbacks=state.enemies.map(()=>new THREE.Group());
const enemies=(dt:number)=>state.enemies.forEach((e,i)=>visuals.update(e,'ashigaru',parents[i],fallbacks[i],dt,5,true));
const coldSamples:number[]=[];let coldClones=0;
for(let i=0;i<35;i++) {
  for(const e of state.enemies)visuals.release(e.id);
  visuals.tick(1/60);const start=performance.now();enemies(0);
  if(i>=5)coldSamples.push(performance.now()-start);coldClones=visuals.activeMixers;
}
coldSamples.sort((a,b)=>a-b);
console.log(JSON.stringify({name:'cold crowd first frame actual GLB clone burst',medianMs:coldSamples[15],clones:coldClones}));
for(let i=0;i<12;i++){visuals.tick(1/60);enemies(0);}
console.log(JSON.stringify({name:'eventual detailed population',activeMixers:visuals.activeMixers}));
measure('24 real GLB enemy active updates',()=>enemies(1/60));measure('24 real GLB enemy paused updates',()=>enemies(0));visuals.dispose();
const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[];
const guardians=Array.from({length:16},()=>makeValleySentinel(geometries,materials));let time=0;
measure('16 articulated guardians active updates',()=>{time+=1/60;for(const g of guardians)g.update(time,true,false);});
measure('16 articulated guardians paused updates',()=>{for(const g of guardians)g.update(time,true,false);});
geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
