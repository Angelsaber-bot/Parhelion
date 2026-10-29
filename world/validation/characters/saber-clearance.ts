/** Actual CPU-skinned blade/body triangle-BVH clearance at exported full-cycle phases. */
import * as THREE from 'three';
import assert from 'node:assert/strict';
import {MeshBVH} from 'three-mesh-bvh';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {readCharacter} from './inspect.ts';
import {SERVANT_MODELS} from '../../src/servant.ts';
const source=process.argv[2]??'/tmp/saber-after-review',label=process.argv[3]??'after',fullSword=process.argv.includes('--full-sword');const result:any={scope:(fullSword?'Whole sword including crossguard/pommel, excluding wrapped grip and hand/fingers contact region. ':'Blade portion >13cm from the authored hand axis; gripping hand excluded. ')+'Actual Three CPU skins; full blade vertex to non-hand body/clothing triangle-BVH distance, plus triangle intersection. Phases recorded explicitly in samplePhases; exact triangle-to-triangle minimum is also recorded. Not GPU/browser evidence.',outfits:{}};
const selected=process.argv.find(arg=>arg.startsWith('--frames='))?.slice(9).split(',').map(Number);
const frameIds=selected?selected.map(frame=>({suffix:`phase-${frame}`,phase:frame/120})):Array.from({length:12},(_,frame)=>({suffix:String(frame).padStart(2,'0'),phase:frame/12}));
result.samplePhases=frameIds.map(frame=>frame.phase);
for(const outfit of (process.argv.includes('--armor-only')?['armor']:['armor','civilian'])as ('armor'|'civilian')[]){
 const {gltf}=await readCharacter(fileURLToPath(new URL(SERVANT_MODELS[outfit]))),mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(c=>c.name==='Idle')!).play();mixer.update(0);gltf.scene.updateMatrixWorld(true);
 const hand=gltf.scene.getObjectByName('mixamorigRightHand')!,handY=hand.getWorldPosition(new THREE.Vector3()).y,entries:any[]=[];let offset=0;const targetIndices:number[]=[],bladeIndices:number[]=[],bladeTriangles:number[]=[],footIndices:number[]=[];
 gltf.scene.traverse(object=>{const mesh=object as THREE.SkinnedMesh;if(!mesh.isMesh)return;if(mesh.isSkinnedMesh)mesh.skeleton.update();const count=mesh.geometry.attributes.position.count,weights=mesh.geometry.attributes.skinWeight,joints=mesh.geometry.attributes.skinIndex;
  const rigidHand:boolean[]=[],blade:boolean[]=[];for(let i=0;i<count;i++){
   let h=0,f=0,handFamily=0;if(mesh.isSkinnedMesh)for(let c=0;c<4;c++){const n=mesh.skeleton.bones[joints.getComponent(i,c)].name,w=weights.getComponent(i,c);if(n==='mixamorigRightHand')h+=w;if(n.startsWith('mixamorigRightHand'))handFamily+=w;if(/(?:Foot|Toe)/.test(n))f+=w;}
   const p=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);rigidHand[i]=(fullSword?handFamily:h)>.95;blade[i]=h>.95&&(fullSword?/brushed_silver|gold_bevel|silver_bevel|sword_royal_enamel|warm_forged_gold/.test(mesh.name):p.y>handY+.13);
   if(blade[i])bladeIndices.push(offset+i);if(f>.8)footIndices.push(offset+i);
  }
  const index=mesh.geometry.index;for(let i=0;i<(index?.count??count);i+=3){const tri=[0,1,2].map(c=>index?index.getX(i+c):i+c);if(tri.every(i=>!rigidHand[i]))targetIndices.push(...tri.map(i=>offset+i));if(tri.every(i=>blade[i]))bladeTriangles.push(...tri.map(i=>offset+i));}
  entries.push({name:mesh.name,count,offset});offset+=count;
 });
 const surfaceVertices=new Set(bladeTriangles);
 const positions=new Float32Array(offset*3),target=new THREE.BufferGeometry();target.setAttribute('position',new THREE.BufferAttribute(positions,3));target.setIndex(targetIndices);
 const bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',target.attributes.position);bladeGeometry.setIndex(bladeTriangles);let bvh:MeshBVH|undefined,bladeBvh:MeshBVH|undefined;const rows:any[]=[];console.log(outfit,'classified',bladeIndices.length,'blade vertices',bladeTriangles.length/3,'blade triangles',targetIndices.length/3,'body triangles');
 for(const frame of frameIds){
  const id=`saber-${label}-${outfit}-${frame.suffix}`,manifest=JSON.parse(await readFile(`${source}/${id}.json`,'utf8'));
  for(const entry of entries){const part=manifest.meshes.find((m:any)=>m.name===entry.name),bytes=await readFile(`${source}/${part.file}`);positions.set(new Float32Array(bytes.buffer,bytes.byteOffset,entry.count*3),entry.offset*3);}
  target.attributes.position.needsUpdate=true;if(!bvh){bvh=new MeshBVH(target);bladeBvh=new MeshBVH(bladeGeometry);(bladeGeometry as THREE.BufferGeometry & {boundsTree:MeshBVH}).boundsTree=bladeBvh;}else{bvh.refit();bladeBvh!.refit();}let clearance=Infinity,minBladeY=Infinity,minFootY=Infinity,nearest:any;const point=new THREE.Vector3();
  for(const index of bladeIndices){point.fromArray(positions,index*3);minBladeY=Math.min(minBladeY,point.y);if(!surfaceVertices.has(index))continue;const closest=bvh.closestPointToPoint(point);if(closest&&closest.distance<clearance){clearance=closest.distance;const vertex=target.index!.getX(closest.faceIndex*3),entry=entries.find(e=>vertex>=e.offset&&vertex<e.offset+e.count);nearest={bodyMesh:entry?.name,bladePosition:point.toArray(),bodyPosition:closest.point.toArray()};}}
  for(const index of footIndices)minFootY=Math.min(minFootY,positions[index*3+1]);
  // Invalidate the lazily created bounds after each CPU pose, before the exact triangle check.
  bladeGeometry.computeBoundingBox();bladeGeometry.computeBoundingSphere();
  // A vertex-to-surface distance is a valid upper bound on surface-to-surface
  // distance; use it to prune the exact dual-BVH search on the dense armor.
  const surface=bvh.closestPointToGeometry(bladeGeometry,new THREE.Matrix4(),undefined,undefined,0,clearance+1e-6);console.log(outfit,frame.phase,'min surface distance',surface?.distance);rows.push({phase:frame.phase,minBladeY,minFootY,bladeBodyDistance:clearance,bladeBodySurfaceDistance:surface?.distance,nearest,bladeBodyIntersection:bvh.intersectsGeometry(bladeGeometry,new THREE.Matrix4())});
 }
 result.outfits[outfit]={bladeVertices:bladeIndices.length,bladeTriangles:bladeTriangles.length/3,bodyTriangles:targetIndices.length/3,minBladeY:Math.min(...rows.map(r=>r.minBladeY)),minFootY:Math.min(...rows.map(r=>r.minFootY)),minBladeBodyDistance:Math.min(...rows.map(r=>r.bladeBodyDistance)),minBladeBodySurfaceDistance:Math.min(...rows.map(r=>r.bladeBodySurfaceDistance)),intersections:rows.filter(r=>r.bladeBodyIntersection).length,samples:rows};
 if(process.argv.includes('--assert-clear')){const summary=result.outfits[outfit];assert.ok(summary.bladeVertices>0&&summary.bodyTriangles>0,'actual geometry selection must not be empty');assert.equal(summary.intersections,0,`${outfit}: sword/body intersection`);assert.ok(summary.minBladeY>.1,`${outfit}: sword must clear the ground`);assert.ok(summary.minBladeBodySurfaceDistance>.001,`${outfit}: at least 1 mm surface margin`);assert.ok(summary.minFootY>-.001,`${outfit}: original foot tolerance`);}console.log(outfit,JSON.stringify(result.outfits[outfit]));mixer.stopAllAction();
}
await writeFile(`${source}/clearance-${label}${fullSword?'-full-sword':''}.json`,JSON.stringify(result,null,2));
