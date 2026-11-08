import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/rendering/glb.ts';
import { Player, PLAYER } from '../src/player/player.ts';
import { Batch } from '../tools/gen/geo.ts';
import { architecturePieces, resetArchitecture, winterHouse } from '../tools/gen/winter/architecture.ts';

type House = { id:number; p:[number,number,number]; size:[number,number,number]; ry:number };
const bytes=readFileSync(new URL('../public/assets/world_winter.glb',import.meta.url));
const gltf=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
const art=gltf.scene.getObjectByName('ART')!;
const collision=gltf.scene.getObjectByName('COLLISION')!;
const ruins=gltf.scene.getObjectByName('COL_Winter_Ruin_Shells')!.userData.houses as House[];
const local=(h:House,x:number,y:number,z:number)=>new THREE.Vector3(x,y,z).applyAxisAngle(new THREE.Vector3(0,1,0),h.ry).add(new THREE.Vector3(...h.p));
for(const root of [art,collision])root.traverse(o=>{
 const m=o as THREE.Mesh;if(!m.isMesh)return;
 for(const material of Array.isArray(m.material)?m.material:[m.material])material.side=THREE.DoubleSide;
});
const ray=(root:THREE.Object3D,from:THREE.Vector3,to:THREE.Vector3)=>new THREE.Raycaster(from,to.clone().sub(from).normalize(),0,from.distanceTo(to)).intersectObject(root,true)[0];
const geometries:THREE.BufferGeometry[]=[];
collision.traverse(o=>{
 const m=o as THREE.Mesh;if(!m.isMesh||m.userData.opensWhen||m.userData.target)return;
 let g=new THREE.BufferGeometry().setAttribute('position',m.geometry.attributes.position.clone());
 if(m.geometry.index)g.setIndex(m.geometry.index.clone());g.applyMatrix4(m.matrixWorld);
 if(g.index)g=g.toNonIndexed();geometries.push(g);
});
const bvh=new MeshBVH(mergeGeometries(geometries));
const settle=(p:Player)=>{for(let i=0;i<240;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});};
const walk=(p:Player,to:THREE.Vector3,seconds=4)=>{
 for(let i=0;i<120*seconds;i++){
  if(Math.hypot(p.pos.x-to.x,p.pos.z-to.z)<.22)return;
  p.yaw=Math.atan2(-(to.x-p.pos.x),-(to.z-p.pos.z));
  p.step(1/120,{x:0,z:1,jump:false,sprint:false});
 }
};

test('all 13 burned-open houses pass shots through the real opening but retain visible low/side-wall cover',()=>{
 assert.equal(ruins.length,13);
 for(const h of ruins){
  const [w,,d]=h.size;
  for(const side of [-1,1]){
   let clear=0;
   // Check the actual building opening; nearby retained houses/trees can still
   // block a shot beyond it. Sample its width rather than assuming an empty city.
   for(const x of [-w*.2,0,w*.2]){
    const from=local(h,x,2.1,side*(d/2+.08)),through=local(h,x,2.1,-side*(d/2+.08));
    const artHit=ray(art,from,through),colHit=ray(collision,from,through);
    if(!artHit){clear++;assert.ok(!colHit,`house ${h.id}: clear aperture blocked by ${colHit?.object.name} at ${colHit?.distance}`);}
   }
   assert.ok(clear>0,`house ${h.id}: at least one real through-opening`);
   for(const [a,b,label] of [
    [local(h,0,1,side*(d/2+1)),local(h,0,1,0),'low wall'],
    [local(h,side*(w/2+1),2.1,0),local(h,0,2.1,0),'side wall'],
   ] as const){
    const visible=ray(art,a,b),physical=ray(collision,a,b);
    assert.ok(visible&&physical,`house ${h.id}: ${label} is real cover`);
    assert.ok(Math.abs(visible.distance-physical.distance)<.025,`house ${h.id}: ${label} ART/COL agree`);
   }
  }
 }
});

test('actual Player settles on each ruin visible interior and exits both open ends without jumping',()=>{
 for(const h of ruins)for(const side of [-1,1]){
  // Start below the burned rafters, then ray-test the real internal floor.
  // These authored ruins have a solid 1.55m rubble plinth, not a hollow pit.
  const origin=local(h,0,h.size[1]-.05,0),down=local(h,0,-1,0);
  const visible=ray(art,origin,down),physical=ray(collision,origin,down);
  assert.ok(visible&&physical,`house ${h.id}: internal floor`);
  assert.ok(Math.abs(visible.point.y-(h.p[1]+1.55))<.025,`house ${h.id}: authored rubble floor`);
  assert.ok(Math.abs(visible.point.y-physical.point.y)<.025,`house ${h.id}: no invisible ceiling floor`);
  let escaped=false;const attempts:number[][]=[];
  // Existing tree trunks/neighboring houses can stand in the centre line;
  // test genuine capsule routes through both sides of the broad opening too.
  for(const x of [0,-h.size[0]*.2,h.size[0]*.2]){
   const p=new Player([{name:'winter',bvh,enabled:true}],-.25);
   p.teleport(origin.x,physical.point.y+.1,origin.z);settle(p);
   assert.ok(p.onGround&&Math.abs(p.pos.y-physical.point.y)<.08,`house ${h.id}: real settled feet`);
   walk(p,local(h,x,0,0));walk(p,local(h,x,0,side*(h.size[2]/2+1.2)));settle(p);
   const relative=p.pos.clone().sub(new THREE.Vector3(...h.p)).applyAxisAngle(new THREE.Vector3(0,1,0),-h.ry);attempts.push(relative.toArray());
   if(relative.z*side>h.size[2]/2+.65&&p.onGround&&!p.swimming){escaped=true;break;}
  }
  assert.ok(escaped,`house ${h.id}, side ${side}: real no-jump exit (${JSON.stringify(attempts)})`);
 }
});

test('raised rubble is not a false walk-in door: actual capsule remains outside all 13 solid plinths',()=>{
 for(const h of ruins)for(const side of [-1,1]){
  const start=local(h,0,h.size[1]+1,side*(h.size[2]/2+1.2));
  const ground=ray(collision,start,local(h,0,-3,side*(h.size[2]/2+1.2)));
  assert.ok(ground);
  const p=new Player([{name:'winter',bvh,enabled:true}],-.25);
  p.teleport(start.x,ground.point.y+.1,start.z);settle(p);walk(p,local(h,0,0,0),2);
  const relative=p.pos.clone().sub(new THREE.Vector3(...h.p)).applyAxisAngle(new THREE.Vector3(0,1,0),-h.ry);
  assert.ok(relative.z*side>=h.size[2]/2+PLAYER.radius-.04,`house ${h.id}: visible plinth blocks ordinary walking`);
 }
});

test('ruin collision reuses every authored solid without changing art, while intact house families retain their proxies',()=>{
 for(let id=0;id<5;id++)for(const burnt of [false,true]){
  resetArchitecture();const source=new Batch('Moscow'),shell=new Batch('Winter_Ruin_Shells');
  winterHouse(source,20,5,-30,.24,7,6,3.8,burnt,id,shell);
  const visual=architecturePieces().flatMap(p=>p.batch.vis);
  if(burnt&&(id===0||id===4)){
   assert.equal(shell.col.length,23);
   const positions=(g:THREE.BufferGeometry)=>Buffer.from(g.attributes.position.array.buffer).toString('base64');
   assert.deepEqual(shell.col.map(positions).sort(),visual.map(positions).sort(),'one collision shape per actual solid');
  }else assert.equal(shell.col.length,0,'ordinary house collision remains managed by build.ts');
 }
});

test('every exported ruin collision vertex matches its authored solid, within only GLB quantization error',()=>{
 resetArchitecture();const shell=new Batch('Winter_Ruin_Shells');
 for(const h of ruins)winterHouse(new Batch('Moscow'),...h.p,h.ry,h.size[0],h.size[2],h.size[1],true,h.id,shell);
 const expected=shell.build().col!;
 const actual=gltf.scene.getObjectByName('COL_Winter_Ruin_Shells') as THREE.Mesh;
 const positions=actual.geometry.attributes.position,index=actual.geometry.index,vertex=new THREE.Vector3();
 assert.equal(index?.count??positions.count,expected.attributes.position.count);
 for(let i=0;i<expected.attributes.position.count;i++){
  vertex.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(actual.matrixWorld);
  assert.ok(vertex.distanceTo(new THREE.Vector3().fromBufferAttribute(expected.attributes.position,i))<.004,`exported shell vertex ${i} follows the actual art solid`);
 }
});
