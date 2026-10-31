/** Diagnose original tavern roof visibility using actual FrontSide art + authoritative collision. */
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bootWorldWithoutGpu } from '../world-dom-boot.fixture';
const out=process.argv[2];if(!out)throw Error('OUTPUT_DIR');
const quality=process.argv.includes('--low')?'low':'med';
const h=await bootWorldWithoutGpu({worldRoot:process.env.WORLD_REVIEW_ROOT,deterministic:true,effectsQuality:quality}),w=h.world;
try{
 (h.window.document.getElementById('start')as HTMLElement).click();await Promise.resolve();
 w.player.teleport(592,3.5,130);for(let i=0;i<60;i++)h.frame(i*1000/60);
 w.scene.updateMatrixWorld(true);
 const meshes:THREE.Object3D[]=[];w.scene.getObjectByName('World').traverseVisible((o:any)=>{if(o.isMesh&&!o.name.endsWith('__outline'))meshes.push(o);});
 const lining=w.scene.getObjectByName('Nassau_Tavern_Timber_Underside');
 const liningMetadata=lining?{quality,materialSide:lining.material.side,materialReused:meshes.some((m:any)=>m!==lining&&m.name.startsWith('Nassau_Craft_Timber')&&m.material===lining.material),triangles:lining.geometry.attributes.position.count/3,castShadow:lining.castShadow}:null;
 const results=[];
 for(const x of[590.5,593.5])for(const z of[126,130]){
  const p=new THREE.Vector3(x,5,z),up=new THREE.Vector3(0,1,0),down=up.clone().negate();
  const artUp=new THREE.Raycaster(p,up,0,15).intersectObjects(meshes,false),artDown=new THREE.Raycaster(new THREE.Vector3(x,20,z),down,0,15).intersectObjects(meshes,false),physical=w.combat.geometry.cast(p,up,15);
  const hit=(a:any)=>a?{mesh:a.object?.name,point:a.point.toArray(),distance:a.distance}:null;
  results.push({from:p.toArray(),artUp:hit(artUp[0]),artDown:hit(artDown[0]),physicalUp:hit(physical)});
 }
 if(process.argv.includes('--expect-lined')){
  assert(liningMetadata && liningMetadata.materialSide===THREE.FrontSide && liningMetadata.materialReused && liningMetadata.triangles===6);
  for(const row of results){
   assert.equal(row.artUp?.mesh,'Nassau_Tavern_Timber_Underside');
   assert.equal(row.artDown?.mesh,'Nassau_Craft_Terracotta');
   assert(row.physicalUp && row.artUp && row.physicalUp.point[1]<row.artUp.point[1]);
  }
 }
 await mkdir(out,{recursive:true});await writeFile(path.join(out,'lining-runtime.json'),JSON.stringify(liningMetadata,null,2)+'\n');await writeFile(path.join(out,'tavern-roof-rays.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
}finally{await h.close();}
