/** Isolated component candidate; does not mutate main colliders or shipped assets. */
import assert from'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';import path from'node:path';import * as THREE from'three';import{MeshBVH}from'three-mesh-bvh';import{Player}from'../../src/player';import{bootWorldWithoutGpu}from'../world-dom-boot.fixture';import{buildTowerAccess}from'../../tools/gen/valley/tower-access';
const out=process.argv[2];assert(out);await mkdir(out,{recursive:true});const h=await bootWorldWithoutGpu({deterministic:true,worldRoot:process.env.WORLD_REVIEW_ROOT}),w=h.world;
try{
 assert(!w.scene.getObjectByName("Tower_West_Access"),"Use WORLD_REVIEW_ROOT with original Alpha fixture; do not layer candidate on shipped access");
 const ground=(x:number,z:number)=>{const g=w.combat.geometry.ground(x,z,80);assert(g);return g.point.y;};
 const candidate=buildTowerAccess(ground),built=candidate.batch.build();assert(built.vis&&built.col);const extra={name:'COL_Tower_West_Access_candidate',enabled:true,bvh:new MeshBVH(built.col)},colliders=[...w.colliders,extra];
 const p=new Player(colliders,w.player.waterLevel);p.updrafts=w.layout.updrafts??[];p.teleport(-29,ground(-29,-159.5)+.08,-159.5);for(let i=0;i<180;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});assert(p.onGround);const setup=p.pos.toArray(),results:any[]=[];
 for(const [x,z]of[[-13,-159.5],[-9,-162],[-8,-154],[-2,-154],[-2,-149],[-2,-154],[-8,-154],[-9,-162],[-13,-159.5],[-29,-159.5]]){
  let reached=false,airborne=0;for(let i=0;i<3000;i++){if(Math.hypot(p.pos.x-x,p.pos.z-z)<.18){reached=true;break;}p.yaw=Math.atan2(-(x-p.pos.x),-(z-p.pos.z));p.step(1/120,{x:0,z:1,jump:false,sprint:false});if(!p.onGround)airborne++;}
  for(let i=0;i<60;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});const row={target:[x,z],reached,feet:p.pos.toArray(),onGround:p.onGround,airborne};results.push(row);console.log(JSON.stringify(row));assert(reached&&p.onGround,'candidate ordinary walk');
 }
 await writeFile(path.join(out,'component.json'),JSON.stringify({setup,start:candidate.start,end:candidate.end,width:3.6,slopeDegrees:candidate.slopeDegrees,artTriangles:built.vis.attributes.position.count/3,collisionTriangles:built.col.attributes.position.count/3,results},null,2)+'\n');
 await writeFile(path.join(out,'geometry.json'),JSON.stringify({name:candidate.batch.name,material:candidate.batch.material,positions:[...built.vis.attributes.position.array],normals:[...built.vis.attributes.normal.array],colors:[...built.vis.attributes.color.array],collision:[...built.col.attributes.position.array]},null,2)+'\n');
 built.vis.dispose();built.col.dispose();for(const g of[...candidate.batch.vis,...candidate.batch.col])g.dispose();
}finally{await h.close();}
