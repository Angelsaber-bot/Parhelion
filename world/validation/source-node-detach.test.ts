import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { sourceNodeHandles } from './source-node-detach.fixture';

test('detaching consumed source COLLISION/MARKERS preserves production capsule, gate, target and reset paths',async()=>{
 const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_SOURCE_QA_ROOT});const {world:w,window}=h;
 try{
  const sources=sourceNodeHandles(w.scene);assert.equal(sources.handles.filter(h=>h.node.name==='COLLISION').length,5);assert.equal(sources.handles.filter(h=>h.node.name==='MARKERS').length,5);
  const sourceObjects=new Set<THREE.Object3D>(),sourceGeometry=new Set<THREE.BufferGeometry>();
  for(const {node}of sources.handles)node.traverse(o=>{sourceObjects.add(o);if((o as THREE.Mesh).isMesh)sourceGeometry.add((o as THREE.Mesh).geometry);});
  console.log('Consumed source inventory',sources.handles.map(({node})=>{let nodes=0;node.traverse(()=>nodes++);return{name:node.name,nodes};}));
  let disposed=0;for(const g of sourceGeometry)g.addEventListener('dispose',()=>disposed++);
  const colliders=[...w.colliders],bvhGeometry=colliders.map(c=>c.bvh.geometry),markers=JSON.stringify(w.layout.markers);
  for(const g of bvhGeometry)assert.ok(!sourceGeometry.has(g),'production BVHs own copies');
  const art:THREE.Mesh[]=[];w.scene.getObjectByName('World').traverse((o:THREE.Object3D)=>{if((o as THREE.Mesh).isMesh&&!sourceObjects.has(o))art.push(o as THREE.Mesh);});
  const targets=art.filter(o=>o.name.startsWith('TGT_'));assert.ok(targets.length>10);
  const key=(code:string)=>{window.dispatchEvent(new window.KeyboardEvent('keydown',{code,bubbles:true}));window.dispatchEvent(new window.KeyboardEvent('keyup',{code,bubbles:true}));};
  // A genuine HQ interaction invokes applyWorldState in both old and new main;
  // locale changes only refreshed text in the published baseline.
  const refresh=()=>{
   window.document.exitPointerLock();(window.document.getElementById('start') as HTMLElement).click();
   const hq=w.layout.markers.find((m:any)=>m.id==='hq_terminal');w.player.teleport(...hq.p);w.player.onGround=true;w.done.delete('hq_terminal');key('KeyF');
   assert.ok(w.done.has('hq_terminal'),'real HQ interaction applied progress');
   const dialogue=window.document.getElementById('world-dialogue') as HTMLElement|null;if(dialogue&&!dialogue.hidden)key('KeyF');
  };
  const state=(done:string[])=>{w.done.clear();for(const id of done)w.done.add(id);refresh();};
  const exercise=()=>{
   const paths:any[]=[];
   for(const [name,x,z,dx,dz]of [['west',-280,-30,-1,0],['east',280,30,1,0],['north',0,-280,0,-1],['south',40,280,0,1]] as [string,number,number,number,number][]){
    for(const open of [false,true]){
     state(open?['summon_circle']:[]);const gate=w.colliders.find((c:any)=>c.name===`COL_Seam_${name}_Gate`);assert.equal(gate.enabled,!open);
     const ground=w.combat.geometry.ground(x,z);assert.ok(ground);w.player.teleport(x,ground.point.y+.2,z);for(let settle=0;settle<120;settle++)w.player.step(1/120,{x:0,z:0,jump:false,sprint:false});w.player.yaw=Math.atan2(-dx,-dz);
     for(let i=0;i<1800;i++)w.player.step(1/120,{x:0,z:1,jump:false,sprint:true});
     const distance=(w.player.pos.x-x)*dx+(w.player.pos.z-z)*dz;
     assert.ok(open?distance>100:distance<70,`${name} ${open?'open':'closed'} actual capsule: ${distance}; pos=${w.player.pos.toArray()}; ground=${ground.point.y}; flying=${w.player.flying}`);
     paths.push([name,open,...w.player.pos.toArray()]);
    }
   }
   const hits=[];state(['summon_circle']);
   for(const id of ['kikyo_banner_1','kikyo_banner_2','kikyo_banner_3']){
    const target=targets.find(t=>t.userData.target===id)!;assert.ok(target);assert.equal(target.visible,true);
    const from=new THREE.Vector3(-224,w.ground(-224,840)+1.62,840),center=new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3());
    const ray=new THREE.Raycaster(from,center.sub(from).normalize());const hit=ray.intersectObject(target,false)[0];assert.ok(hit,`real ART target ray ${id}`);hits.push(hit.distance);
    state(['summon_circle',id]);assert.equal(target.visible,false);assert.equal(w.colliders.find((c:any)=>c.name===`COL_${target.name}`).enabled,false);state(['summon_circle']);
   }
   (window.document.getElementById('start') as HTMLElement).click();window.confirm=()=>true;
   state(['summon_circle','kikyo_banner_1']);key('KeyR');assert.equal(w.done.size,0);
   assert.equal(w.colliders.find((c:any)=>c.name==='COL_Seam_west_Gate').enabled,true);assert.equal(targets.find(t=>t.userData.target==='kikyo_banner_1')!.visible,true);
   return{paths,hits,resetPosition:w.player.pos.toArray()};
  };
  const attached=exercise();console.log('Attached actual route/target/reset result',JSON.stringify(attached));sources.detach();const detached=exercise();assert.deepEqual(detached,attached);
  assert.ok(w.colliders.length===colliders.length&&w.colliders.every((c:any,i:number)=>c===colliders[i]),'collider references unchanged');assert.ok(w.colliders.every((c:any,i:number)=>c.bvh.geometry===bvhGeometry[i]),'BVH geometry references unchanged');assert.equal(JSON.stringify(w.layout.markers),markers);
  const reachable=new Set<THREE.Object3D>();w.scene.traverse((o:THREE.Object3D)=>reachable.add(o));for(const mesh of art)assert.ok(reachable.has(mesh),`ART identity remains reachable: ${mesh.name}`);
  assert.equal(disposed,0);assert.equal(h.errors.length,0);sources.restore();
 }finally{await h.close();}
});
