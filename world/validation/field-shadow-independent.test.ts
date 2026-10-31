/** Independent optional shadow-budget/ownership test, no GPU shadow cost claim. */
import test from'node:test';import assert from'node:assert/strict';import*as THREE from'three';import{createFalseDawnSites}from'../src/falseDawnSites';
test('field shadows remain default-off; opt-in has one near site, hysteresis, no ground casters or resource churn',()=>{
 for(const enabled of [false,true]){
  const fields=enabled?createFalseDawnSites(()=>0,{nearStructureShadows:true}):createFalseDawnSites(()=>0);
  const geos=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();let disposals=0;
  fields.root.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;geos.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:[m.material])materials.add(mat);});
  for(const g of geos)g.addEventListener('dispose',()=>disposals++);
  const casters=()=>{const result:THREE.Mesh[]=[];fields.root.traverse(o=>{if((o as THREE.Mesh).isMesh&&o.castShadow)result.push(o as THREE.Mesh);});return result;};
  try{
   for(let turn=0;turn<100;turn++)for(const site of fields.sites){const[x,,z]=site.origin;
    fields.update({x:x+69.9,z});assert.equal(casters().length,enabled?2:0);
    fields.update({x:x+80,z});assert.equal(casters().length,enabled?2:0,'incumbent retained inside exit radius');
    fields.update({x:x+85.1,z});assert.equal(casters().length,0);
    fields.update({x:x+80,z});assert.equal(casters().length,0,'outside enter radius does not immediately reacquire');
    fields.update({x,z});for(const m of casters()){assert.ok(['body','metal'].includes(m.userData.campaignLayer));assert.equal(m.parent,site.root);}
   }
   fields.update({x:NaN,z:0});assert.equal(casters().length,0);
   fields.root.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;assert.ok(geos.has(m.geometry));for(const mat of Array.isArray(m.material)?m.material:[m.material])assert.ok(materials.has(mat));if(m.userData.campaignLayer==='ground')assert.equal(m.castShadow,false);});
   assert.equal(disposals,0);fields.dispose();assert.equal(disposals,geos.size);fields.dispose();assert.equal(disposals,geos.size);assert.equal(fields.root.children.length,0);
  }finally{fields.dispose();}
 }
});
