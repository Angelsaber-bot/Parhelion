import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {settlementGrassClearance} from '../src/grassClearance';
import {createKingdomGateScene} from '../src/kingdomGateScene';
import {KINGDOM_GATE} from '../src/kingdomGate';
import {buildAlphaSettlement} from '../src/settlements/alpha';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {CHESTS,flagChest,markerChest} from '../src/exploration/catalog';
import {makeGrassField} from '../src/fx';

test('occupied low floors, ramps and connecting paths exclude grass without clearing the surrounding meadow',()=>{
 const grid={nx:81,nz:61,x0:-40,z0:-30,cell:1};
 const placement={id:'alpha' as const,name:['家','Home'] as [string,string],position:[0,3,0] as [number,number,number],entry:[0,3,15] as [number,number,number],footprint:[34,30] as [number,number],groundRange:.1};
 const mask=settlementGrassClearance(grid,[placement],[{region:'alpha',points:[[0,2,24],[8,2,24],[8,2,28]],length:12}]);
 const at=(x:number,z:number)=>mask[(z-grid.z0)*grid.nx+x-grid.x0];
 for(let x=-17;x<=17;x++)for(let z=-15;z<=15;z++)assert.equal(at(x,z),1,`${x},${z}`);
 assert.equal(at(0,22),1);assert.equal(at(5,24),1);assert.equal(at(8,27),1);
 assert.equal(at(29,0),0);assert.equal(at(20,24),0);assert.equal(mask.length,grid.nx*grid.nz);
});

test('grass detects paving coplanar with terrain without mistaking the adjacent meadow for construction',()=>{
 const built=new MeshBVH(new THREE.BoxGeometry(1,.1,1).translate(0,1.95,0));
 const height=new THREE.DataTexture(new Float32Array(9).fill(2),3,3,THREE.RedFormat,THREE.FloatType);
 const grid={nx:3,nz:3,x0:0,z0:0,cell:2,span:4,spanZ:4,h:new Float32Array(9).fill(2),ny:new Float32Array(9).fill(1),col:new Float32Array(Array.from({length:9},()=>[.3,.7,.2]).flat()),heightTexture:()=>height};
 const field=makeGrassField(grid as any,built,0,{count:1,size:8});
 const data=(field.mesh.material as THREE.ShaderMaterial).uniforms.tC.value.image.data;
 assert.equal(data[3],0,'flush stone floor');assert.equal(data[7],255,'bare meadow');
 field.mesh.geometry.dispose();(field.mesh.material as THREE.ShaderMaterial).uniforms.tC.value.dispose();field.mesh.material.dispose();height.dispose();built.geometry.dispose();
});

test('residence windows are physical openings and its 4.2m entrance remains clear',()=>{
 const kit=buildAlphaSettlement(),bvhs:MeshBVH[]=[];kit.group.updateMatrixWorld(true);
 kit.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.solid)bvhs.push(new MeshBVH(o.geometry.clone().applyMatrix4(o.matrixWorld)));});
 const wallHit=(x:number,y:number)=>bvhs.some(b=>b.raycastFirst(new THREE.Ray(new THREE.Vector3(x,y,-.3),new THREE.Vector3(0,0,-1)),THREE.DoubleSide,0,1));
 assert.equal(wallHit(0,1),false);assert.equal(wallHit(0,3.5),false);
 for(const x of[-11,-5.5,5.5,11]){assert.equal(wallHit(x,2.5),false);assert.equal(wallHit(x,.8),true);assert.equal(wallHit(x,3.9),true);}
});

test('gate escort uses detailed distinct residents with articulated walking, settled poses and bounded cost',()=>{
 const gate=createKingdomGateScene(),actors:THREE.Object3D[]=[];
 gate.people.traverse(o=>{if(o.userData.settlementNpc)actors.push(o);});
 assert.equal(actors.length,2);
 for(const actor of actors){
  assert.ok(actor.getObjectByName('ResidentFaceAndHair'));assert.ok(actor.getObjectByName('ResidentEyes'));
  assert.ok(actor.getObjectByName('ResidentHip_-1'));assert.ok(actor.userData.triangles<14000);
  let meshes=0;actor.traverse(o=>{if(o instanceof THREE.Mesh)meshes++;});assert.equal(meshes,7);
 }
 gate.apply(new Set([KINGDOM_GATE.open]),.2);
 assert.notEqual(actors[0].getObjectByName('ResidentHip_-1')!.rotation.x,0);
 gate.root.updateMatrixWorld(true);gate.root.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
 gate.apply(new Set([KINGDOM_GATE.open,KINGDOM_GATE.rescued]),1);
 for(const actor of actors)assert.equal(actor.getObjectByName('ResidentHip_-1')!.rotation.x,0);
 const disposed=new Map<THREE.BufferGeometry,number>();
 gate.root.traverse(o=>{if(o instanceof THREE.Mesh){disposed.set(o.geometry,0);o.geometry.addEventListener('dispose',()=>disposed.set(o.geometry,disposed.get(o.geometry)!+1));}});
 gate.dispose();gate.dispose();assert.ok([...disposed.values()].every(count=>count===1));
});

test('all real chest actions award once, and lake / tower / legacy discoveries open through real grounded input',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true});
 const w=h.world,d=h.window.document;let now=0;
 const frame=()=>h.frame(now+=1000/60);
 const key=()=>{for(const type of['keydown','keyup'])d.body.dispatchEvent(new h.window.KeyboardEvent(type,{code:w.settings.bindingsFor('interact')[0],bubbles:true}));};
 try{
  (d.getElementById('start') as HTMLElement).click();await Promise.resolve();
  const expected:Record<string,number>={britain_lake_platform:w.exploration.state.puzzles.get('swordlake').heights[1],britain_tower_top:w.exploration.state.puzzles.get('camelot').heights[1],alpha_secret_pillar:11.6,alpha_secret_cave:2.4};
  for(const [id,y]of Object.entries(expected)){
   const chest=w.exploration.state.chests.get(id),m=w.layout.markers.find((m:any)=>m.id===markerChest(id));
   assert.ok(Math.abs(chest.base.y-y)<.02,`${id}: ${chest.base.y} vs ${y}`);
   w.player.teleport(m.p[0],chest.base.y+.1,m.p[2]);
   for(let i=0;i<180&&!w.player.onGround;i++)frame();frame();
   assert.ok(w.player.onGround,`${id}: no stable standing point at ${w.player.pos.toArray()}`);
   key();assert.ok(w.done.has(flagChest(id)),`${id}: grounded input failed to open`);
  }
  for(const c of CHESTS){
   const m=w.layout.markers.find((m:any)=>m.id===markerChest(c.id));assert.ok(m&&w.exploration.owns(m.id),c.id);
   if(c.requires)w.done.add(c.requires);
   // Excavated chests deliberately finish their 1.43 s emergence before interaction.
   if(c.buried)for(let i=0;i<100;i++)frame();
   if(!w.done.has(flagChest(c.id))){
    const rt=w.exploration.state.chests.get(c.id);
    const stands=[[m.p[0],m.p[2]],...Array.from({length:8},(_,i)=>[c.p[0]+Math.sin(i*Math.PI/4)*1.4,c.p[1]+Math.cos(i*Math.PI/4)*1.4])];
    for(const [x,z]of stands){
     w.player.teleport(x,rt.base.y+.12,z);
     for(let i=0;i<90&&!w.player.onGround;i++)frame();frame();
     if(w.player.onGround&&!w.player.swimming){key();if(w.done.has(flagChest(c.id)))break;}
    }
    assert.ok(w.done.has(flagChest(c.id)),`${c.id}: no grounded opening point, last feet ${w.player.pos.toArray()}`);
   }
   const flags=[...w.done];w.exploration.interact(m.id);assert.deepEqual([...w.done],flags,`${c.id}: repeat reward`);
  }
  const claimed=w.scene.getObjectByName('Treasure_Chest'),treasure=w.layout.markers.find((m:any)=>m.id==='shard_treasure');
  assert.ok(claimed&&treasure,'legacy story treasure remains in the real exported map');
  claimed.updateWorldMatrix(true,true);
  const hit=new THREE.Raycaster(new THREE.Vector3(treasure.p[0],treasure.p[1]+3,treasure.p[2]),new THREE.Vector3(0,-1,0)).intersectObject(claimed,true)[0];
  assert.ok(hit&&hit.point.y-treasure.p[1]<.3,'claimed story chest is visibly open and hollow, not another closed reward');
  assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});
