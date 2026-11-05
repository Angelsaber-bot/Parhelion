import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createArmoryWorkshop,ARMORY_WORKSHOP} from '../src/armoryWorkshop';
import {settlementGrassClearance} from '../src/grassClearance';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {WORLD_PROGRESS_KEY} from '../src/progress';

test('fitted workshop has bounded static batches, an open entry and actual circulation aisles',()=>{
 const kit=createArmoryWorkshop();kit.root.updateMatrixWorld(true);
 let triangles=0;const meshes:THREE.Mesh[]=[];
 kit.root.traverse(o=>{if(o instanceof THREE.Mesh){meshes.push(o);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.ok(!o.userData.solid);}});
 assert.equal(meshes.length,3);assert.ok(triangles>3000&&triangles<12000,`${triangles}`);
 const hit=(p:number[],d:number[],far:number)=>new THREE.Raycaster(new THREE.Vector3(...p),new THREE.Vector3(...d),0,far).intersectObject(kit.root,true).length>0;
 for(const z of[244.5,250,255.5])assert.equal(hit([-90,11.6,z],[1,0,0],7),false,'actual west entrance is visually open');
 for(const z of[246.3,253.7])assert.equal(hit([-84,11.5,z],[1,0,0],18),false,'two aisles remain open around the original bench');
 for(const z of[244,250,256])assert.equal(hit([-66,11.9,z],[1,0,0],3),true,'weapons have real receiver / magazine geometry in front of the rack');
 const bounds=new THREE.Box3().setFromObject(kit.root);assert.ok(bounds.min.x>-88&&bounds.max.x<-62);assert.ok(bounds.min.y>=10&&bounds.max.y<=17);
 const counts=new Map<THREE.BufferGeometry,number>();for(const m of meshes)m.geometry.addEventListener('dispose',()=>counts.set(m.geometry,(counts.get(m.geometry)??0)+1));
 kit.dispose();kit.dispose();assert.ok([...counts.values()].every(n=>n===1));assert.equal(kit.root.children.length,0);
});

test('the original workshop, its paved west entrance and range exclude grass, surrounding meadow remains',()=>{
 const grid={nx:81,nz:71,x0:-120,z0:225,cell:1};
 const mask=settlementGrassClearance(grid,[],[],ARMORY_WORKSHOP.clearance);
 const at=(x:number,z:number)=>mask[(z-grid.z0)*grid.nx+x-grid.x0];
 for(const[x,z]of[[-101,250],[-86,250],[-74,250],[-65,256],[-75,276]])assert.equal(at(x,z),1);
 for(const[x,z]of[[-112,250],[-95,240],[-55,275]])assert.equal(at(x,z),0);
});

test('production grounded input still claims and persists equipment at the original rack',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true}),w=h.world,d=h.window.document;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=()=>{for(const type of['keydown','keyup'])d.body.dispatchEvent(new h.window.KeyboardEvent(type,{code:w.settings.bindingsFor('interact')[0],bubbles:true}));};
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();
  const rack=w.layout.markers.find((m:any)=>m.id==='armory_rack');assert.deepEqual(Array.from(rack.p),[-65,10,250]);
  assert.equal(w.done.has('armory_rack'),false);
  w.player.teleport(-65,10.2,250);frame(90);assert.ok(w.player.onGround);frame();
  key();frame();assert.ok(w.done.has('armory_rack'));assert.equal(w.worldProgress.armed,true);
  const saved=JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!);
  assert.equal(saved.done.filter((id:string)=>id==='armory_rack').length,1);
  assert.equal(w.layout.markers.filter((m:any)=>m.id==='armory_rack').length,1);
  assert.equal(h.errors.length,0);
 }finally{await h.close();}
});
