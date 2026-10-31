/** Export actual weapon meshes/private finish materials for offline CPU review. */
import * as THREE from 'three';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {parseLocalGlb} from '../player-fixture.ts';
import {WEAPON_FINISHES} from '../../src/weaponFinishes.ts';
import {createWeaponFinishMaterials} from '../../src/weaponFinishMaterials.ts';
const out=path.resolve(process.argv[2]??'../artifacts/weapon-finish-review');await mkdir(out,{recursive:true});
for(const weapon of ['01_Dawn_AR','06_Refract_Blade']){
 const gltf=await parseLocalGlb(new URL(`../../../assets/weapons/glb/${weapon}.glb`,import.meta.url)),root=gltf.scene,finish=createWeaponFinishMaterials(root,{patterns:weapon==='01_Dawn_AR'});root.updateMatrixWorld(true);
 for(const definition of WEAPON_FINISHES){
  finish.apply(definition.id);const id=`${weapon}-${definition.id}`,meshes:any[]=[],writes:Promise<void>[]=[];
  root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
   const count=o.geometry.attributes.position.count,position=new Float32Array(count*3),uv=new Float32Array(count*2),point=new THREE.Vector3();
   for(let i=0;i<count;i++){o.getVertexPosition(i,point).applyMatrix4(o.matrixWorld);position.set(point.toArray(),i*3);const attribute=o.geometry.attributes.uv;if(attribute){uv[i*2]=attribute.getX(i);uv[i*2+1]=attribute.getY(i);}}
   const indices=new Uint32Array(o.geometry.index?Array.from(o.geometry.index.array):Array.from({length:count},(_,i)=>i));
   const file=`${id}-${meshes.length}.bin`;writes.push(writeFile(path.join(out,file),Buffer.concat([Buffer.from(position.buffer),Buffer.from(uv.buffer),Buffer.from(indices.buffer)])));
   const materials=[o.material].flat().map(source=>{const m=source as THREE.MeshStandardMaterial,texture=m.map instanceof THREE.DataTexture?m.map:undefined,pattern=texture?`${texture.name}.rgba`:null;
    if(texture)writes.push(writeFile(path.join(out,pattern!),Buffer.from(texture.image.data as Uint8Array)));
    return{name:m.name,color:m.color.toArray(),metalness:m.metalness,roughness:m.roughness,opacity:m.opacity,transparent:m.transparent,emissive:m.emissive.toArray(),emissiveIntensity:m.emissiveIntensity,pattern,patternSize:texture?.image.width};});
   meshes.push({name:o.name,file,count,indices:indices.length,groups:o.geometry.groups,materials});
  });
  await Promise.all(writes);await writeFile(path.join(out,`${id}.json`),JSON.stringify({id,weapon,finish:definition.id,label:definition.name,meshes}));console.log(id);
 }
 finish.dispose();
}
