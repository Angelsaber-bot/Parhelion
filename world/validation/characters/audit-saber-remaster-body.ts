/** Actual CPU-skinned blade/body triangle-BVH clearance at exported full-cycle phases. */
import * as THREE from 'three';
import assert from 'node:assert/strict';
import {MeshBVH} from 'three-mesh-bvh';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {readCharacter} from './inspect.ts';
import {ContractServant,SERVANT_MODELS} from '../../src/servant.ts';
import {FirstContract} from '../../src/contracts.ts';import {ServantAppearance} from '../../src/servantAppearance.ts';
const source=process.argv[2]??'/tmp/saber-after-review',label=process.argv[3]??'after',fullSword=process.argv.includes('--full-sword');const result:any={outfits:{}};
const revision=Number(process.argv.find(x=>x.startsWith('--revision='))?.split('=')[1]??2);
result.scope='Full native silver blade triangles against non-hand body/clothing BVH during actual 8-second follow route; guard/grip excluded. CPU geometry, not GPU or universal clearance.';
const runtimeTimes=process.argv.includes('--runtime-times');
const selected=process.argv.find(arg=>arg.startsWith('--frames='))?.slice(9).split(',').map(Number);
const frameIds=selected?selected.map(frame=>({suffix:`phase-${frame}`,phase:frame/(runtimeTimes?60:120)})):Array.from({length:12},(_,frame)=>({suffix:String(frame).padStart(2,'0'),phase:frame/12}));
if(runtimeTimes)result.sampleTimesSeconds=Array.from({length:81},(_,i)=>i/10);else result.samplePhases=frameIds.map(frame=>frame.phase);
for(const outfit of (process.argv.includes('--armor-only')?['armor']:process.argv.includes('--civilian-only')?['civilian']:['armor','civilian'])as ('armor'|'civilian')[]){
 const {gltf,sha256:assetSha256}=await readCharacter(fileURLToPath(new URL(SERVANT_MODELS[outfit])).replace(/runtime_revision\d/,'runtime_revision'+revision)),mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(c=>c.name==='Idle')!).play();mixer.update(0);gltf.scene.updateMatrixWorld(true);
 const hand=gltf.scene.getObjectByName('mixamorigRightHand')!,handY=hand.getWorldPosition(new THREE.Vector3()).y,entries:any[]=[];let offset=0;const targetIndices:number[]=[],bladeIndices:number[]=[],bladeTriangles:number[]=[],footIndices:number[]=[];
 gltf.scene.traverse(object=>{const mesh=object as THREE.SkinnedMesh;if(!mesh.isMesh)return;if(mesh.isSkinnedMesh)mesh.skeleton.update();const count=mesh.geometry.attributes.position.count,weights=mesh.geometry.attributes.skinWeight,joints=mesh.geometry.attributes.skinIndex;
  const rigidHand:boolean[]=[],blade:boolean[]=[];for(let i=0;i<count;i++){
   let h=0,f=0,handFamily=0;if(mesh.isSkinnedMesh)for(let c=0;c<4;c++){const n=mesh.skeleton.bones[joints.getComponent(i,c)].name,w=weights.getComponent(i,c);if(n==='mixamorigRightHand')h+=w;if(n.startsWith('mixamorigRightHand'))handFamily+=w;if(/(?:Foot|Toe)/.test(n))f+=w;}
   const p=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);rigidHand[i]=(fullSword?handFamily:h)>.95;blade[i]=h>.95&&/brushed_silver|silver_bevel/.test(mesh.name);
   if(blade[i])bladeIndices.push(offset+i);if(f>.8)footIndices.push(offset+i);
  }
  const index=mesh.geometry.index;for(let i=0;i<(index?.count??count);i+=3){const tri=[0,1,2].map(c=>index?index.getX(i+c):i+c);if(tri.every(i=>!rigidHand[i]))targetIndices.push(...tri.map(i=>offset+i));if(tri.every(i=>blade[i]))bladeTriangles.push(...tri.map(i=>offset+i));}
  entries.push({name:mesh.name,count,offset,mesh});offset+=count;
 });
 const surfaceVertices=new Set(bladeTriangles);
 const positions=new Float32Array(offset*3),target=new THREE.BufferGeometry();target.setAttribute('position',new THREE.BufferAttribute(positions,3));target.setIndex(targetIndices);
 const bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',target.attributes.position);bladeGeometry.setIndex(bladeTriangles);let bvh:MeshBVH|undefined,bladeBvh:MeshBVH|undefined;const rows:any[]=[];console.log(outfit,'classified',bladeIndices.length,'blade vertices',bladeTriangles.length/3,'blade triangles',targetIndices.length/3,'body triangles');
 mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);const appearance=new ServantAppearance();appearance.select(outfit);const floor=new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2),actor=new ContractServant({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,colliders:[{name:'audit-floor',enabled:true,bvh:new MeshBVH(floor)}],load:async()=>gltf,target:()=>null,strike:()=>null});await actor.ensureLoaded();const player=new THREE.Vector3(),vertex=new THREE.Vector3();
 for(let tick=0;tick<=480;tick++){const time=tick/60;let speed=0,yaw=Math.PI/2;if(time>=.5&&time<2.5)speed=5.5;else if(time>=3&&time<4)speed=9;else if(time>=4&&time<5){speed=5.5;yaw=Math.PI/2*(5-time);}else if(time>=5&&time<6){speed=5.5;yaw=-Math.PI/2;}if(tick){player.x+=Math.sin(yaw)*speed/60;player.z+=Math.cos(yaw)*speed/60;}actor.update(1/60,player,yaw,true,false);actor.root.updateMatrixWorld(true);if(tick%6)continue;const frame={phase:time};
 for(const entry of entries){const mesh=entry.mesh;if(mesh.isSkinnedMesh)mesh.skeleton.update();for(let i=0;i<entry.count;i++){mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);positions.set(vertex.toArray(),(entry.offset+i)*3);}}
  target.attributes.position.needsUpdate=true;if(!bvh){bvh=new MeshBVH(target);bladeBvh=new MeshBVH(bladeGeometry);(bladeGeometry as THREE.BufferGeometry & {boundsTree:MeshBVH}).boundsTree=bladeBvh;}else{bvh.refit();bladeBvh!.refit();}let clearance=Infinity,minBladeY=Infinity,minFootY=Infinity,nearest:any;const point=new THREE.Vector3();
  for(const index of bladeIndices){point.fromArray(positions,index*3);minBladeY=Math.min(minBladeY,point.y);if(tick%30!==0||!surfaceVertices.has(index))continue;const closest=bvh.closestPointToPoint(point);if(closest&&closest.distance<clearance){clearance=closest.distance;const vertex=target.index!.getX(closest.faceIndex*3),entry=entries.find(e=>vertex>=e.offset&&vertex<e.offset+e.count);nearest={bodyMesh:entry?.name,bladePosition:point.toArray(),bodyPosition:closest.point.toArray()};}}
  for(const index of footIndices)minFootY=Math.min(minFootY,positions[index*3+1]);
  // Invalidate the lazily created bounds after each CPU pose, before the exact triangle check.
  bladeGeometry.computeBoundingBox();bladeGeometry.computeBoundingSphere();
  // A vertex-to-surface distance is a valid upper bound on surface-to-surface
  // distance; use it to prune the exact dual-BVH search on the dense armor.
  const surface=tick%30===0?bvh.closestPointToGeometry(bladeGeometry,new THREE.Matrix4(),undefined,undefined,0,clearance+1e-6):undefined;console.log(outfit,frame.phase,'min surface distance',surface?.distance);rows.push({phase:frame.phase,minBladeY,minFootY,bladeBodyDistance:clearance,bladeBodySurfaceDistance:surface?.distance,nearest,bladeBodyIntersection:bvh.intersectsGeometry(bladeGeometry,new THREE.Matrix4())});
 }
 result.outfits[outfit]={assetSha256,bladeVertices:bladeIndices.length,bladeTriangles:bladeTriangles.length/3,bodyTriangles:targetIndices.length/3,minBladeY:Math.min(...rows.map(r=>r.minBladeY)),minFootY:Math.min(...rows.map(r=>r.minFootY)),minBladeBodyDistance:Math.min(...rows.map(r=>r.bladeBodyDistance)),minBladeBodySurfaceDistance:Math.min(...rows.filter(r=>r.bladeBodySurfaceDistance!==undefined).map(r=>r.bladeBodySurfaceDistance)),intersections:rows.filter(r=>r.bladeBodyIntersection).length,samples:rows};
 if(process.argv.includes('--assert-clear')){const summary=result.outfits[outfit];assert.ok(summary.bladeVertices>0&&summary.bodyTriangles>0,'actual geometry selection must not be empty');assert.equal(summary.intersections,0,`${outfit}: sword/body intersection`);assert.ok(summary.minBladeY>.1,`${outfit}: sword must clear the ground`);assert.ok(summary.minBladeBodySurfaceDistance>.001,`${outfit}: at least 1 mm surface margin`);assert.ok(summary.minFootY>-.001,`${outfit}: original foot tolerance`);}console.log(outfit,JSON.stringify(result.outfits[outfit]));actor.dispose();floor.dispose();
}
await writeFile(`${source}/temporal-clearance-${label}${fullSword?'-full-sword':''}.json`,JSON.stringify(result,null,2));
