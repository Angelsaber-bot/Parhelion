import test from'node:test';import assert from'node:assert/strict';import * as THREE from'three';
import{createFalseDawnSites,FALSE_DAWN_SITE_LIMITS}from'../src/falseDawnSites';import{FALSE_DAWN_CENTERS,FALSE_DAWN_ANCHORS,FALSE_DAWN_ACTOR_OFFSETS}from'../src/falseDawnSitesData';
import{readFileSync}from'node:fs';
test('False Dawn coordinate data has no runtime renderer dependency',()=>{const s=readFileSync(new URL('../src/falseDawnSitesData.ts',import.meta.url),'utf8');assert.doesNotMatch(s,/import.*three|import.*Sites['"]/);assert.equal(FALSE_DAWN_ANCHORS.length,3);assert.equal(FALSE_DAWN_ACTOR_OFFSETS.length,3);assert.equal(Object.keys(FALSE_DAWN_CENTERS).length,3);});
test('False Dawn props fit audited footprints and strict material/mesh/triangle budgets',()=>{
 const scene=createFalseDawnSites();assert.equal(scene.sites.length,3);assert.equal(scene.markers.length,7);assert.equal(new Set(scene.markers.map(m=>m.id)).size,7);
 for(const s of scene.sites){let triangles=0,meshes=0;const materials=new Set<THREE.Material>();s.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(s.root);assert.ok(b.min.x>=s.origin[0]-9&&b.max.x<=s.origin[0]+9);assert.ok(b.min.z>=s.origin[2]-9&&b.max.z<=s.origin[2]+9);
  s.root.traverse(o=>{assert.ok(!(o instanceof THREE.Light));if(!(o instanceof THREE.Mesh))return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.equal(o.castShadow,false);materials.add(o.material as THREE.Material);assert.equal((o.material as THREE.MeshStandardMaterial).map,null);for(const a of Object.values(o.geometry.attributes))for(const v of a.array)assert.ok(Number.isFinite(v));});
  assert.ok(meshes<=FALSE_DAWN_SITE_LIMITS.meshesPerField);assert.ok(triangles<FALSE_DAWN_SITE_LIMITS.trianglesPerField);assert.ok(materials.size<=FALSE_DAWN_SITE_LIMITS.materialsPerField);assert.equal(s.spawnPoints.length,3);
 }scene.dispose();
});
test('three emitter states are independent, resettable and dark after sealing',()=>{
 const scene=createFalseDawnSites(),alpha=scene.sites[0],layers=['briefed','choiceA','choiceB']as const;
 for(let i=0;i<3;i++){const anchors=[false,false,false];anchors[i]=true;scene.applyState({stage:'array',anchors,ending:null});layers.forEach((layer,j)=>assert.equal(alpha.art.layers.get(layer)!.visible,i===j));}
 scene.applyState({stage:'complete',anchors:[true,true,true],ending:'seal'});for(const layer of layers)assert.equal(alpha.art.layers.get(layer)!.visible,false);for(const s of scene.sites)assert.equal(s.art.materials.glow.emissiveIntensity,0);
 scene.applyState({stage:'complete',anchors:[true,true,true],ending:'repurpose'});for(const layer of layers)assert.equal(alpha.art.layers.get(layer)!.visible,true);for(const s of scene.sites)assert.ok(s.art.materials.glow.emissiveIntensity>0);
 scene.applyState({stage:'locked',anchors:[false,false,false],ending:null});for(const layer of layers)assert.equal(alpha.art.layers.get(layer)!.visible,false);scene.dispose();
});
test('False Dawn progress does not move collision, rebuild resources or duplicate dispose',()=>{
 const scene=createFalseDawnSites(),meshes:THREE.Mesh[]=[];scene.root.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});const geometries=meshes.map(m=>m.geometry),materials=meshes.map(m=>m.material),collision=[...scene.collisionGeometries],arrays=collision.map(g=>Array.from(g.attributes.position.array));
 for(let i=0;i<1000;i++)scene.applyState({stage:i%2?'array':'complete',anchors:[!!(i%2),!!(i%3),!!(i%5)],ending:i%2?null:'repurpose'});
 assert.deepEqual(meshes.map(m=>m.geometry),geometries);assert.deepEqual(meshes.map(m=>m.material),materials);assert.deepEqual(scene.collisionGeometries,collision);assert.deepEqual(collision.map(g=>Array.from(g.attributes.position.array)),arrays);
 let calls=0;for(const g of[...geometries,...collision])g.addEventListener('dispose',()=>calls++);scene.dispose();scene.dispose();assert.equal(calls,geometries.length+collision.length);
});
test('False Dawn ground sampling is per prop, fails clearly for invalid terrain, and culls locally',()=>{
 assert.throws(()=>createFalseDawnSites(()=>null),/terrain unavailable/);const scene=createFalseDawnSites((x,z)=>10+x*.001+z*.001);
 for(const s of scene.sites)for(const m of s.markers)assert.ok(Math.abs(m.p[1]-(10+m.p[0]*.001+m.p[2]*.001+.9))<1e-9);
 scene.update({x:-52,z:-100});assert.equal(scene.sites[0].root.visible,true);assert.equal(scene.sites[1].root.visible,false);scene.update({x:3000,z:3000});assert.ok(scene.sites.every(s=>!s.root.visible));scene.dispose();
});

test('every authored start/transition interaction disc stays over two metres from actor sockets',()=>{
 const scene=createFalseDawnSites();for(const s of scene.sites)for(const m of s.markers)for(const spawn of s.spawnPoints){const distance=Math.hypot(m.p[0]-spawn[0],m.p[2]-spawn[2]);assert.ok(distance>(m.radius??2.4)+2.05,`${s.region}:${m.id} actor only ${distance}m from marker center`);}scene.dispose();
});
