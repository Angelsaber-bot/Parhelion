import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {regionLoader,bakeQuantized} from '../src/rendering/glb';
import {makeCombatTerrain} from '../src/combat/combatTerrain';
import {createOrleansCampaignScene} from '../src/environment/orleansCampaignScene';
import {createEgyptCampaignScene} from '../src/environment/egyptCampaignScene';
import {createQinCampaignScene} from '../src/environment/qinCampaignScene';
import {createEgyptConfluenceLandscape} from '../src/environment/egyptConfluenceLandscape';
import {createEgyptRiverworksLandscape} from '../src/environment/egyptRiverworksLandscape';
import {createEgyptTempleMaintenance} from '../src/environment/egyptTempleMaintenance';
import {createEgyptReedMarket} from '../src/environment/egyptReedMarket';
import {QIN_CAMPAIGN as Q} from '../src/story/qinCampaign';
import {ORLEANS_CAMPAIGN as O} from '../src/story/orleansCampaign';
import type {Collider} from '../src/player/player';
for(const region of ['orleans','egypt','qin'] as const)test(`${region}: every new chapter interaction has an actual supported, clear standing point`,async()=>{
 const bytes=readFileSync(new URL(`../public/assets/world_${region}.core.glb`,import.meta.url));
 const {scene}=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');bakeQuantized(scene);
 scene.position.set(region==='egypt'?0:-720,0,region==='qin'?-720:-1440);if(region!=='orleans')scene.rotation.y=Math.PI;scene.updateMatrixWorld(true);
 const gs:THREE.BufferGeometry[]=[];scene.getObjectByName('COLLISION')!.traverse(o=>{if(o instanceof THREE.Mesh){let g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index)g=g.toNonIndexed();gs.push(new THREE.BufferGeometry().setAttribute('position',g.getAttribute('position')));}});
 const merged=mergeGeometries(gs);const colliders:Collider[]=[{name:region,enabled:true,bvh:new MeshBVH(merged)}];
 const layout=JSON.parse(readFileSync(new URL(`../public/assets/world_${region}.layout.json`,import.meta.url),'utf8'));
 const queries=makeCombatTerrain(colliders,layout),ground=(x:number,z:number,y:number)=>queries.ground(x,z,y)?.point.y??null;
 const extras:{dispose():void}[]=[];
 if(region==='egypt'){
  for(const make of [createEgyptReedMarket,createEgyptRiverworksLandscape,createEgyptTempleMaintenance]){const e=make(ground);extras.push(e);colliders.push(e.collider);}
  const e=createEgyptConfluenceLandscape(ground);extras.push(e);colliders.push(...e.colliders);
 }
 const make={orleans:createOrleansCampaignScene,egypt:createEgyptCampaignScene,qin:createQinCampaignScene}[region];
 const s=make(ground,p=>queries.clear(p,.38,1.8));
 try{
  if(region==='qin'){
   const qin=s as ReturnType<typeof createQinCampaignScene>;
   for(let i=0;i<=80;i++){
    qin.apply(new Set([Q.halt,Q.loan,Q.take]),i/80);qin.root.updateMatrixWorld(true);
    for(const name of ['QinReverseProcessionBeamCrew','Resident_qin_chapter_linhe',...Array.from({length:4},(_,n)=>`QinBeamCarrier_${n}`)]){
     const p=qin.root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());const floor=ground(p.x,p.z,p.y+.3);
     assert.ok(floor!==null&&Math.abs(floor-p.y)<.08,`${name}: floating at transit ${i}`);
     assert.ok(queries.clear(p,.3,1.5),`${name}: blocked at transit ${i}`);
    }
   }
  }
  if(region==='orleans'){
   const orleans=s as ReturnType<typeof createOrleansCampaignScene>;
   colliders.push(...orleans.colliders);
   for(const branch of [O.bridge,O.ferry]){
    orleans.apply(new Set([O.assembled,branch,O.agree,O.screen]),()=>1);
    const trial=orleans.markers.find(m=>m.id===O.trial)!;
    assert.ok(queries.clear(new THREE.Vector3(trial.p[0],trial.p[1]-.9,trial.p[2]),.38,1.8),`${branch}: trial blocked`);
   }
  }
  for(const m of s.markers){const p=new THREE.Vector3(m.p[0],m.p[1]-.9,m.p[2]);const y=ground(p.x,p.z,p.y+.3);assert.ok(y!==null&&Math.abs(y-p.y)<.12,`${m.id}: unsupported`);assert.ok(queries.clear(p,.38,1.8),`${m.id}: blocked`);}}
 finally{s.dispose();extras.forEach(e=>e.dispose());merged.dispose();gs.forEach(g=>g.dispose());}
});
