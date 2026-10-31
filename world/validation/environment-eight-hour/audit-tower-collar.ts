/** Read-only actual-collider component traversal. One supported diagnostic setup per
 * trial, then production Player.step inputs only; no forced grounding or geometry edits. */
import assert from 'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';import path from'node:path';import * as THREE from'three';import{Player}from'../../src/player';import{bootWorldWithoutGpu}from'../world-dom-boot.fixture';
const out=process.argv[2];assert(out);await mkdir(out,{recursive:true});const h=await bootWorldWithoutGpu({deterministic:true,worldRoot:process.env.WORLD_REVIEW_ROOT});const w=h.world;const center=[0,-162];
const ground=(x:number,z:number)=>{const ray=new THREE.Ray(new THREE.Vector3(x,80,z),new THREE.Vector3(0,-1,0));let best:any=null;for(const c of w.colliders)if(c.enabled){const hit=c.bvh.raycastFirst(ray,THREE.DoubleSide);if(hit&&(!best||hit.distance<best.distance))best={...hit,collider:c.name};}return best;};
const profile:any[]=[],trials:any[]=[];
try{
 assert(!w.scene.getObjectByName("Tower_West_Access"),"Use WORLD_REVIEW_ROOT with original Alpha fixture; do not layer candidate on shipped access");
 for(let angle=0;angle<360;angle+=15)for(let r=14;r<=24;r+=.25){const a=angle*Math.PI/180,x=Math.cos(a)*r,z=center[1]+Math.sin(a)*r,g=ground(x,z);profile.push({angle,r,x,z,y:g?.point.y,normalY:g?.face?.normal.y,collider:g?.collider});}
 for(let angle=0;angle<360;angle+=30)for(const trigger of [0,20,19,18.5,18,17.5]){
  const a=angle*Math.PI/180,start=[Math.cos(a)*26,center[1]+Math.sin(a)*26],g=ground(...start as [number,number]);assert(g);const p=new Player(w.colliders,w.player.waterLevel);p.updrafts=w.layout.updrafts??[];p.teleport(start[0],g.point.y+.08,start[1]);
  for(let i=0;i<180;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});const setup=p.pos.toArray(),supported=p.onGround;let jumped=false,jumpAt:any=null,maxY=p.pos.y,minRadius=Infinity,groundedInner=false;const trace:any[]=[];
  for(let i=0;i<1200&&supported;i++){
   const radius=Math.hypot(p.pos.x,p.pos.z-center[1]);p.yaw=Math.atan2(p.pos.x,p.pos.z-center[1]);const jump=!!trigger&&!jumped&&radius<=trigger&&p.onGround;if(jump){jumped=true;jumpAt={frame:i,feet:p.pos.toArray(),radius};}
   p.step(1/120,{x:0,z:1,jump,sprint:true});maxY=Math.max(maxY,p.pos.y);minRadius=Math.min(minRadius,Math.hypot(p.pos.x,p.pos.z-center[1]));if(i%12===0||jump)trace.push({frame:i,feet:p.pos.toArray(),ground:p.onGround,vy:p.vel.y,jump,gliding:p.gliding});
   if(minRadius<13.5&&p.onGround&&p.pos.y>30){groundedInner=true;break;}
  }
  const row={angle,trigger,setup,supported,jumped,jumpAt,maxY,minRadius,groundedInner,end:p.pos.toArray(),onGround:p.onGround,trace};trials.push(row);console.log(JSON.stringify({...row,trace:undefined}));
 }
 await writeFile(path.join(out,'tower-collar.json'),JSON.stringify({center,updrafts:w.layout.updrafts,profile,trials},null,2)+'\n');
}finally{await h.close();}
