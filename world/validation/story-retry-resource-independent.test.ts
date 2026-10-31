/** Independent no-GPU scene resource retention stress, not GPU memory accounting. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {FALSE_DAWN as F} from '../src/falseDawnCampaign';
function census(root:THREE.Object3D){let nodes=0,meshes=0;const geos=new Set(),mats=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();root.traverse(o=>{nodes++;const m=o as THREE.Mesh;if(m.isMesh){meshes++;geos.add(m.geometry);}if(m.material)for(const mat of Array.isArray(m.material)?m.material:[m.material])mats.add(mat);});for(const material of mats)for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);return{nodes,meshes,geometries:geos.size,materials:mats.size,textures:textures.size};}
test('fifty actual-main deliberate story retries leave bounded scene resources and no stale actors',async()=>{
 const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT,deterministic:true});const{world:w,window}=h,d=window.document;let now=0;
 const key=(code:string)=>{for(const type of ['keydown','keyup'])d.body.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));};
 const frame=()=>h.frame(now+=1000/60);
 try{
  for(const f of ['armory_rack',F.receiver])w.done.add(f);(d.getElementById('start')as HTMLElement).click();await Promise.resolve();
  const m=w.layout.markers.find((m:any)=>m.id===F.recorder),x=m.p[0],z=m.p[2]+.65,g=w.combat.geometry.ground(x,z,m.p[1]+3);assert.ok(g);
  w.player.teleport(x,g.point.y+.04,z);w.player.onGround=true;w.player.flying=w.player.swimming=w.player.gliding=false;
  let stable:ReturnType<typeof census>|undefined;const ids=new Set<string>();
  for(let cycle=0;cycle<51;cycle++){
   key('KeyF');for(let page=0;w.narrative.open&&!w.narrative.choosing&&page<60;page++)key('KeyF');assert.ok(w.narrative.choosing);key('Digit1');key('KeyF');assert.equal(w.combat.storyEncounter?.id,'false_dawn_courier');frame();
   const actors=w.combat.state.enemies.filter((e:any)=>e.storyEncounter);assert.ok(actors.length&&actors.length<=3);
   for(const actor of actors){assert.equal(ids.has(actor.id),false,'retry actor IDs cannot alias stale targets');ids.add(actor.id);}
   await h.settleAssets();frame();w.combat.cancelStoryEncounter();frame();await h.settleAssets();frame();
   assert.equal(w.combat.storyEncounter,null);assert.equal(w.combat.state.enemies.filter((e:any)=>e.storyEncounter).length,0);
   for(const actor of actors)assert.equal(w.scene.getObjectByName(actor.id),undefined);
   const count=census(w.scene);if(cycle===0)stable=count;else assert.deepEqual(count,stable,`scene resource retention after retry ${cycle}`);
   assert.equal(w.done.has('false_dawn_courier_cleared'),false,'cancellation cannot award victory');
  }
  console.log('51cycle scene census',stable,'distinct actor IDs',ids.size,'visual diagnostics',w.combat.visualDiagnostics);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});
