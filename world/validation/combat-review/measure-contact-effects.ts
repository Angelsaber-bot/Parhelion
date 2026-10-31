/** Paired CPU-only BVH/contact-geometry measurement, never FPS. No gameplay damage. */
import assert from 'node:assert/strict';import * as THREE from 'three';import {mkdir,writeFile} from 'node:fs/promises';
import {bootWorldWithoutGpu} from '../world-dom-boot.fixture';import {EnemyContactEffects,ENEMY_CONTACT_EFFECT_BUDGET} from '../../src/enemyContactEffects';import type {CombatEvent} from '../../src/combat';import {getFalseDawnEncounterSpec} from '../../src/falseDawnEncounterCatalog';
const h=await bootWorldWithoutGpu({deterministic:true}),w=h.world;
try{
 const anchor=getFalseDawnEncounterSpec('false_dawn_warden')!.anchor,g=w.combat.geometry,groups=[new THREE.Group(),new THREE.Group()],effects=[new EnemyContactEffects(groups[0],{ground:g.ground,cast:g.cast}),new EnemyContactEffects(groups[1],g)],rows:any[]=[];
 const at=(x:number,z:number)=>({x:anchor.x+x,y:g.ground(anchor.x+x,anchor.z+z,anchor.y+4).point.y+.04,z:anchor.z+z});
 let sequence=0;for(const attack of ['thrust','sweep','burst']as const){const times:number[][]=[[],[]];
  for(let sample=0;sample<33;sample++){sequence++;const event:Extract<CombatEvent,{type:'attackContact'}>={type:'attackContact',id:'cpu',sequence,storyPattern:'echo-warden',attack,origin:at(-1.45,-1.75),target:at(-.2,-2.9),radius:attack==='thrust'?.95:attack==='sweep'?3.5:2.8,...(attack==='thrust'?{length:7.5}:{})};
   for(const index of sample%2?[1,0]:[0,1]){effects[index].clear();const start=process.hrtime.bigint();effects[index].emit(event);if(sample>=3)times[index].push(Number(process.hrtime.bigint()-start)/1e6);}
   const points=groups.map(group=>{const mesh=group.children.find(m=>m.visible)as THREE.Mesh;assert.ok(mesh);return Array.from(mesh.geometry.getAttribute('position').array.slice(0,mesh.geometry.drawRange.count*3));});assert.deepEqual(points[0],points[1],'scoped broadphase must produce byte-identical full-world contact vertices');
  }
  const fresh:{setupMs:number;firstContactMs:number}[]=[];
  for(let repeat=0;repeat<12;repeat++){
   const parent=new THREE.Group(),setupStart=process.hrtime.bigint(),effect=new EnemyContactEffects(parent,g),setupMs=Number(process.hrtime.bigint()-setupStart)/1e6;
   const event:Extract<CombatEvent,{type:'attackContact'}>={type:'attackContact',id:'fresh',sequence:1,storyPattern:'echo-warden',attack,origin:at(-1.45,-1.75),target:at(-.2,-2.9),radius:attack==='thrust'?.95:attack==='sweep'?3.5:2.8,...(attack==='thrust'?{length:7.5}:{})};
   const start=process.hrtime.bigint();effect.emit(event);fresh.push({setupMs,firstContactMs:Number(process.hrtime.bigint()-start)/1e6});effect.dispose();assert.equal(parent.children.length,0);
  }
  rows.push({attack,baseline:summary(times[0]),scoped:summary(times[1]),freshPoolSetup:summary(fresh.map(row=>row.setupMs)),freshPoolFirstContact:summary(fresh.map(row=>row.firstContactMs)),build:effects[1].diagnostics.lastBuild});
 }
 const report={budget:ENEMY_CONTACT_EFFECT_BUDGET,freshPoolNote:'12 independent new pools per attack. First-contact cold refers to a fresh presentation pool, NOT cleared CPU/JIT/OS caches. Each disposed immediately; setup and first-contact measured separately.',evidence:'Paired CPU-only actual production world BVH queries,30warm samples per attack after3warmups, alternating order. No renderer/GPU/FPS claim. All full-world/scoped output vertices exactly equal.',rows};await mkdir('../artifacts/enemy-performance',{recursive:true});await writeFile('../artifacts/enemy-performance/contact-broadphase.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));effects.forEach(effect=>effect.dispose());
}finally{await h.close();}
function summary(values:number[]){values.sort((a,b)=>a-b);return{medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.min(values.length-1,Math.floor(values.length*.95))],maxMs:values.at(-1)};}
