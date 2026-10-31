import * as THREE from 'three';
const clamp=THREE.MathUtils.clamp;
/** Actual rest-mesh revision, not a shader/portrait overlay. Original authored
 * UVs, skin weights, topology and textures remain; hands, weapons and soles do not move. */
export function sculptCaptainCavalry(model:THREE.Object3D,mounted:boolean):()=>void {
 const edits:{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];copy:THREE.BufferGeometry|undefined;copies:THREE.Material[]}[]=[];
 const gaussian=(v:number,center:number,width:number)=>Math.exp(-(((v-center)/width)**2));
 model.traverse(o=>{
  const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;
  const list=Array.isArray(mesh.material)?mesh.material:[mesh.material],names=list.map(m=>m.name).join(' '),horse=/^Horse_|^Rein_/.test(mesh.name),weapon=/firearm/i.test(mesh.name)||/saber (?:steel|edge|brass|leather)|cavalry saber|keen saber/i.test(names);
  const face=!horse&&!weapon&&/skin|hair|sclera|iris|pupil|glint|catchlight|eyebrow|tooth|mouth/i.test(names),horseHead=mounted&&horse&&/Body|Mane|Eyes|Tack|Fittings|Stirrup|Rein/.test(mesh.name);
  const materialEligible=!weapon&&/skin|hair|wool|crimson|leather|silver|armor|gold|brass|microdetail|mane|saddlecloth/i.test(names);
  if(!face&&!horseHead&&!materialEligible)return;
  const originalGeometry=mesh.geometry;let copy:THREE.BufferGeometry|undefined;
  if(face||horseHead){copy=mesh.geometry.clone();const p=copy.attributes.position;
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);let nx=x,ny=y,nz=z;
    if(face){const localY=y-(mounted?.735:0),front=clamp((z+.01)/.14,0,1),jaw=gaussian(localY,1.755,.065)*front,cheek=gaussian(localY,1.825,.042)*front;
     // Stronger adult cheek/jaw planes while keeping eyelids aligned with the eyes.
     nx=x*(1+(mounted?.105:.14)*jaw+.035*cheek);ny=y-.008*jaw;nz=z+.007*jaw+.004*cheek;
     if(!mounted&&/near black hair|hair ridges/.test(names)&&localY<1.80&&localY>1.61&&z>.065){const beard=gaussian(localY,1.70,.075);nx*=1+.18*beard;ny-=.022*beard;nz+=.012*beard;}
     if(mounted&&/auburn red hair/.test(names)){const crown=clamp((y-2.64)/.14,0,1);nx+=.032*crown;nz-=.026*crown;ny-=.007*crown;}
    }else if(horseHead){const faceWeight=clamp((z-.95)/.32,0,1)*clamp((y-1.45)/.24,0,1);nx=x*(1-.045*faceWeight);nz=z+.008*faceWeight;}
    p.setXYZ(i,nx,ny,nz);
   }
   copy.computeVertexNormals();copy.computeBoundingBox();copy.computeBoundingSphere();copy.userData.captainCavalrySculptRevision=2;mesh.geometry=copy;
  }
  const copies=list.map(m=>{const result=m.clone() as THREE.MeshStandardMaterial;if(result.isMeshStandardMaterial){
   if(/skin/i.test(result.name)){result.roughness=.67;result.metalness=0;result.color.multiplyScalar(.97);}
   if(/midnight purple wool/.test(result.name)){result.color.setHex(0x26354b);result.roughness=.88;}
   if(/auburn red hair/.test(result.name)){result.color.setHex(0x95472e);result.roughness=.78;}
   if(/near black hair/.test(result.name)){result.color.setHex(0x171b20);result.roughness=.82;}
   if(/silver|armor/i.test(result.name)){result.color.multiplyScalar(.78);result.roughness=.40;result.metalness=.67;}
   if(/gold|brass/i.test(result.name)){result.roughness=.40;result.metalness=.72;}
   if(/leather/i.test(result.name))result.roughness=.68;
   if(/microdetail/.test(result.name)){result.color.setHex(0xf2f0e7);result.roughness=.88;result.metalness=0;}
  }return result;});const original=mesh.material;mesh.material=Array.isArray(original)?copies:copies[0];mesh.userData.captainCavalrySculptRevision=2;edits.push({mesh,geometry:originalGeometry,material:original,copy,copies});
 });
 let disposed=false;return()=>{if(disposed)return;disposed=true;for(const e of edits){if(e.copy){e.mesh.geometry=e.geometry;e.copy.dispose();}e.mesh.material=e.material;e.copies.forEach(m=>m.dispose());delete e.mesh.userData.captainCavalrySculptRevision;}};
}
