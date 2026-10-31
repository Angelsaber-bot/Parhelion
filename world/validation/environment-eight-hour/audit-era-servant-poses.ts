/** Actual-main native actor snapshots. Explicit recruitment/position/target/meter fixtures;
 * normal follow/attack/ultimate handlers thereafter. Not natural-progression or GPU QA. */
import assert from 'node:assert/strict';import * as THREE from 'three';
import {mkdir,writeFile,readFile}from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';
import{bootWorldWithoutGpu}from'../world-dom-boot.fixture';import{SERVANTS}from'../../src/contracts';import{CHARACTER_KITS}from'../../src/characters/catalog';import{RuntimePoseExporter}from'../characters/export-runtime-pose';
const out=process.argv[2];assert(out,'OUTPUT_DIR');await mkdir(out,{recursive:true});
const h=await bootWorldWithoutGpu({deterministic:true,effectsQuality:'med'}),w=h.world,d=h.window.document;let now=0;
const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};const key=(code:string)=>{for(const type of['keydown','keyup'])d.body.dispatchEvent(new h.window.KeyboardEvent(type,{code,bubbles:true}));};
const all:any[]=[];const center=w.layout.markers.find((m:any)=>m.id==='boss_vacant_king').p;
const floor=(x:number,z:number)=>{const ray=new THREE.Ray(new THREE.Vector3(x,center[1]+3,z),new THREE.Vector3(0,-1,0));let best=Infinity;for(const c of w.colliders)if(c.enabled){const hit=c.bvh.raycastFirst(ray,THREE.DoubleSide);if(hit&&Math.abs(hit.face?.normal.y??0)>.7)best=Math.min(best,hit.distance);}assert(Number.isFinite(best));return center[1]+3-best;};
const enemy=w.combat.state.enemies.find((e:any)=>e.kind!=='king'&&!e.miniboss);
try{
 w.done.add('armory_rack');for(const s of SERVANTS)w.contract.recruit(s.contract);(d.getElementById('start')as HTMLElement).click();await Promise.resolve();frame(2);await h.settleAssets();
 for(const e of w.combat.state.enemies){e.mode='dead';e.timer=Infinity;e.hp=0;e.active=false;}
 for(const id of ['musashi','blackbeard','napoleon']as const){
  const kit=id==='napoleon'?'napoleonMounted':id,definition=CHARACTER_KITS[kit],asset=fileURLToPath(definition.assetUrl),exporter=new RuntimePoseExporter(path.join(out,id));
  w.ultimateDirector.abort();w.actions.reset();w.contract.select(id);w.player.teleport(center[0],floor(center[0],center[2]+9)+.08,center[2]+9);w.player.yaw=0;
  frame(120);await h.settleAssets();frame(180);
  const root=w.scene.children.find((o:any)=>o.name===`CharacterKit:${kit}`)as THREE.Group;assert(root&&root.visible);const originalScale=root.scale.toArray(),originalParent=root.parent;
  const records:any[]=[];let materialIdentity:any[]|undefined,meshIdentity:any[]|undefined;
  async function capture(label:string){
   root.updateWorldMatrix(true,true);const meshes:any[]=[];root.traverse((o:any)=>{if(o.isMesh)meshes.push(o);});assert(meshes.length>0);
   const materials=meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]);if(materialIdentity){assert.deepEqual(materials,materialIdentity);assert.deepEqual(meshes,meshIdentity);}else{materialIdentity=materials;meshIdentity=meshes;}
   const bounds=new THREE.Box3(),p=new THREE.Vector3();let triangles=0,vertices=0;
   for(const m of meshes){if(m.isSkinnedMesh)m.skeleton.update();assert(m.geometry.attributes.position);for(const mat of Array.isArray(m.material)?m.material:[m.material]){assert(mat);assert(mat.color?.toArray().every(Number.isFinite));assert(Number.isFinite(mat.opacity));}
    const a=m.geometry.attributes.position;vertices+=a.count;triangles+=(m.geometry.index?.count??a.count)/3;for(let i=0;i<a.count;i++){m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld);assert(p.toArray().every(Number.isFinite));bounds.expandByPoint(p);}
   }
   const sockets=Object.fromEntries(Object.entries(definition.sockets).map(([name,spec])=>{const socket=root.getObjectByName(spec.node);assert(socket);return[name,{node:socket.name,parent:socket.parent?.name,position:socket.getWorldPosition(new THREE.Vector3()).toArray(),local:socket.position.toArray(),quaternion:socket.quaternion.toArray()}];}));
   const bones:any[]=[];root.traverse((o:any)=>{if(o.isBone)bones.push([o.name,...o.position.toArray(),...o.quaternion.toArray()]);});assert.deepEqual(root.scale.toArray(),originalScale);assert.equal(root.parent,originalParent);
   const size=bounds.getSize(new THREE.Vector3());assert(size.y>.7&&size.y<5&&size.length()<9,'finite native scale');
   const row={id,label,time:now/1000,root:root.position.toArray(),rootYaw:root.rotation.y,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},triangles,vertices,meshes:meshes.length,materials:new Set(materials).size,sockets,boneHash:createHash('sha256').update(JSON.stringify(bones)).digest('hex'),ultimateActive:w.ultimateDirector.active,skillCasting:w.actions.skills.casting};records.push(row);
   await exporter.frame(`${id}-${label}`,root,{asset:asset.replace(/\.gz$/,''),label:`${id} actual main ${label}; explicit fixture, offline CPU pose`,rootYaw:root.rotation.y,reviewYaw:root.rotation.y,groundY:root.position.y,trackLights:true,lightingOrigin:root.position.toArray(),framing:{center:bounds.getCenter(new THREE.Vector3()).toArray(),size:Math.max(size.x,size.y,size.z)*1.03},actualMain:row},w.colliders,root.position);console.log(JSON.stringify({id,label,root:row.root,vertices,triangles}));
  }
  await capture('idle');const followStart=root.position.clone();d.body.dispatchEvent(new h.window.KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));frame(90);await capture('follow');d.body.dispatchEvent(new h.window.KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));assert(root.position.distanceTo(followStart)>.2,'actual following moved actor');frame(120);
  const ex=w.player.pos.x,ez=w.player.pos.z-5;Object.assign(enemy.p,{x:ex,y:floor(ex,ez),z:ez});Object.assign(enemy.home,enemy.p);enemy.hp=enemy.maxHp=10000;enemy.mode='recover';enemy.timer=100;enemy.active=true;enemy.pacified=false;
  const hp=enemy.hp;for(let i=0;i<1200&&enemy.hp===hp;i++)frame();assert(enemy.hp<hp,`${id}: ordinary native attack contact`);await capture('attack-contact');
  enemy.mode='recover';enemy.timer=100;const ultimateHpBefore=enemy.hp;w.actions.skills.energyValue=100;w.camera.lookAt(enemy.p.x,enemy.p.y+1,enemy.p.z);w.camera.updateMatrixWorld();key('KeyX');assert(w.actions.skills.casting,`${id}: actual ultimate accepted`);
  for(let i=0;i<1200&&(w.ultimateDirector.active||w.actions.skills.casting);i++)frame();assert(!w.ultimateDirector.active&&!w.actions.skills.casting);assert(enemy.hp<ultimateHpBefore,'accepted ultimate reaches actual native contact damage');const ultimateDamage=ultimateHpBefore-enemy.hp;enemy.active=false;enemy.mode='dead';enemy.hp=0;enemy.timer=Infinity;frame(180);await capture('ultimate-return');
  const returnBone=records.at(-1).boneHash;frame(30);root.updateWorldMatrix(true,true);const bones:any[]=[];root.traverse((o:any)=>{if(o.isBone)bones.push([o.name,...o.position.toArray(),...o.quaternion.toArray()]);});assert.notEqual(createHash('sha256').update(JSON.stringify(bones)).digest('hex'),returnBone,'idle after ultimate is not frozen');
  for(const name of Object.keys(records[0].sockets))for(const row of records){assert.equal(row.sockets[name].parent,records[0].sockets[name].parent);assert(row.sockets[name].local.every((v:number,i:number)=>Math.abs(v-records[0].sockets[name].local[i])<1e-5),'weapon/socket attachment local offset unchanged within authored animation float noise');}
  all.push({id,ultimateDamage,assetSha256:createHash('sha256').update(await readFile(asset)).digest('hex'),records});
 }
 assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
}finally{await writeFile(path.join(out,'audit.json'),JSON.stringify({fixture:'Pre-recruited, supported setup, isolated recovering target, meter set100 for ultimate; no actor bone/pose/scale writes',results:all},null,2)+'\n');await h.close();}
