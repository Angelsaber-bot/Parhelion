import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {ADVENTURE as A,getAdventureGuide,adventureTravelOpen} from '../src/openWorldCampaign';
import {adventureEncounter} from '../src/adventureRuntime';
import {Player} from '../src/player';

test('adventure: action sockets, final encounters, cart route and optional ramps use real collision',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:[A.started,'armory_rack'],found:[]})}}),w=h.world;let time=0;
 const frames=(n=1)=>{for(let i=0;i<n;i++)h.frame(time+=1000/60);};
 try{
  (h.window.document.getElementById('start')as HTMLElement).click();await Promise.resolve();frames(2);
  const q=w.combat.geometry,issues:string[]=[];
  for(const a of w.adventureSites.actions.values()){
   const floor=q.ground(a.p[0],a.p[2],a.p[1]+2);
   if(!floor||floor.point.y<w.layout.world.waterLevel+.05||Math.abs(floor.point.y-a.p[1])>.6||!q.clear({x:a.p[0],y:a.p[1]+.04,z:a.p[2]},.35,1.8))issues.push(`${a.id}: ${a.p} floor=${floor?.point.y}`);
  }
  assert.deepEqual(issues,[],'every required interaction has grounded body clearance');
  for(const id of [...A.emitters,'adventure_guardian']){
   const action=w.adventureSites.actions.get(id)!;const spec=adventureEncounter(action,id==='adventure_guardian');
   for(const actor of spec.actors)if(!q.safeAdventureSpawn(spec,spec.anchor.x+actor.offset[0],spec.anchor.z+actor.offset[1])){
    const candidates:number[][]=[];for(let dx=-7;dx<=7;dx+=2)for(let dz=-7;dz<=7;dz+=2){const candidate={...spec,actors:[{...actor,offset:[dx,dz]}]};if(q.safeAdventureSpawn(candidate,spec.anchor.x+dx,spec.anchor.z+dz))candidates.push([dx,dz]);}
    console.log(id,action.p,candidates);assert.fail(`legal guard socket ${id} ${actor.offset}`);
   }
  }
  const path=w.adventureSites.convoyPath;
  for(let leg=0;leg<path.length-1;leg++)for(let i=0;i<=100;i++){
   const p=new THREE.Vector3(...path[leg]).lerp(new THREE.Vector3(...path[leg+1]),i/100),g=q.ground(p.x,p.z,p.y+2);
   assert.ok(g&&Math.abs(g.point.y-p.y)<.6,`cart floor leg ${leg} at ${i}: ${g?.point.y} vs ${p.y}`);
   for(const dx of[-.9,.9])assert.ok(q.clear({x:p.x+dx,y:g.point.y+.04,z:p.z},.15,1.3),`cart body ${leg}/${i} ${dx}`);
  }
  function walk(route:number[][]){const p=new Player(w.colliders,w.layout.world.waterLevel);p.teleport(route[0][0],route[0][1]+.3,route[0][2]);let k=1;
   for(let n=0;n<18000&&k<route.length;n++){const target=route[k],dx=target[0]-p.pos.x,dz=target[2]-p.pos.z;if(Math.hypot(dx,dz)<.8){k++;continue;}p.yaw=Math.atan2(-dx,-dz);p.step(1/120,{x:0,z:1,jump:false,sprint:false});}
   assert.equal(k,route.length,`ramp stuck ${p.pos.toArray()} next ${route[k]}`);
  }
  w.done.add('adventure_kingdom_abbey');w.adventureSites.apply(w.done);walk(w.adventureSites.abbeyRoute);
  w.done.add(A.water);w.adventureSites.apply(w.done);walk(w.adventureSites.roofRoute);walk([[-43,4.45,740],[-53,8.8,740],[-59,8.8,740],[-77,4.7,740]]);
 }finally{await h.close();}
});
