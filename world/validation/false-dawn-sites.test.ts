import test from'node:test';import assert from'node:assert/strict';import * as THREE from'three';
import{createFalseDawnSites,FALSE_DAWN_SITE_LIMITS}from'../src/falseDawnSites';import{FALSE_DAWN_CENTERS,FALSE_DAWN_ANCHORS,FALSE_DAWN_ACTOR_OFFSETS}from'../src/falseDawnSitesData';
import{readFileSync}from'node:fs';
test('False Dawn coordinate data has no runtime renderer dependency',()=>{const s=readFileSync(new URL('../src/falseDawnSitesData.ts',import.meta.url),'utf8');assert.doesNotMatch(s,/import.*three|import.*Sites['"]/);assert.equal(FALSE_DAWN_ANCHORS.length,3);assert.equal(FALSE_DAWN_ACTOR_OFFSETS.length,3);assert.equal(Object.keys(FALSE_DAWN_CENTERS).length,3);});
test('False Dawn props fit audited footprints and strict material/mesh/triangle budgets',()=>{
 const scene=createFalseDawnSites();assert.equal(scene.sites.length,3);assert.equal(scene.markers.length,8);assert.equal(new Set(scene.markers.map(m=>m.id)).size,8);assert.equal(scene.markers.filter(m=>m.type==='interact').length,7);
 for(const s of scene.sites){let triangles=0,meshes=0;const materials=new Set<THREE.Material>();s.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(s.root);assert.ok(b.min.x>=s.origin[0]-9&&b.max.x<=s.origin[0]+9);assert.ok(b.min.z>=s.origin[2]-9&&b.max.z<=s.origin[2]+9);
  s.root.traverse(o=>{assert.ok(!(o instanceof THREE.Light));if(!(o instanceof THREE.Mesh))return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.equal(o.castShadow,false);materials.add(o.material as THREE.Material);assert.equal((o.material as THREE.MeshStandardMaterial).map,null);for(const a of Object.values(o.geometry.attributes))for(const v of a.array)assert.ok(Number.isFinite(v));const normals=o.geometry.attributes.normal;for(let i=0;i<normals.count;i++)assert.ok(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))>.8,'opposing canvas sides must not cancel their normals');});
  assert.ok(meshes<=FALSE_DAWN_SITE_LIMITS.meshesPerField);assert.ok(triangles<FALSE_DAWN_SITE_LIMITS.trianglesPerField);assert.ok(materials.size<=FALSE_DAWN_SITE_LIMITS.materialsPerField);assert.equal(s.spawnPoints.length,3);
 }scene.dispose();
});
test('three emitter states are independent, resettable and dark after sealing',()=>{
 const scene=createFalseDawnSites(),alpha=scene.sites[0],layers=['briefed','choiceA','choiceB']as const;
 for(let i=0;i<3;i++){const anchors=[false,false,false];anchors[i]=true;scene.applyState({stage:'array',anchors,ending:null});layers.forEach((layer,j)=>assert.equal(alpha.art.layers.get(layer)!.visible,i===j));}
 scene.applyState({stage:'complete',anchors:[true,true,true],ending:'seal'});for(const layer of layers)assert.equal(alpha.art.layers.get(layer)!.visible,false);assert.equal(alpha.art.materials.glow.emissiveIntensity,0);assert.ok(scene.sites.find(s=>s.region==='winter')!.art.materials.glow.emissiveIntensity>0,'physical brazier stays lit');
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
 for(const s of scene.sites)for(const m of s.markers)assert.ok(Math.abs(m.p[1]-(10+m.p[0]*.001+m.p[2]*.001+(m.type==='interact'?.9:0)))<1e-9);
 scene.update({x:-52,z:-100});assert.equal(scene.sites[0].root.visible,true);assert.equal(scene.sites[1].root.visible,false);scene.update({x:3000,z:3000});assert.ok(scene.sites.every(s=>!s.root.visible));scene.dispose();
});

test('every authored start/transition interaction disc stays over two metres from actor sockets',()=>{
 const scene=createFalseDawnSites();for(const s of scene.sites)for(const m of s.markers.filter(m=>m.type==='interact'))for(const spawn of s.spawnPoints){const distance=Math.hypot(m.p[0]-spawn[0],m.p[2]-spawn[2]);assert.ok(distance>(m.radius??2.4)+2.05,`${s.region}:${m.id} actor only ${distance}m from marker center`);}scene.dispose();
});

test('Winter relay warmth is a visible passive source, not an interaction or reward',()=>{const scene=createFalseDawnSites();const warm=scene.markers.find(m=>m.id==='false_dawn_warm_repeater')!;assert.equal(warm.type,'poi');assert.equal(warm.radius,4);assert.match(warm.id,/(^|_)warm_/);assert.equal(warm.requires,undefined);const winter=scene.sites.find(s=>s.region==='winter')!;assert.ok(winter.art.layers.get('glow'));scene.dispose();});

test('completion never claims the unchosen remote route was resolved',()=>{
 const fields=createFalseDawnSites();
 const resolved=(region:string)=>fields.sites.find(s=>s.region===region)!.root.children.find(o=>o.name.includes('resolved'));
 fields.applyState({stage:'complete',anchors:[true,true,true],ending:'repurpose',route:'harbor'});
 assert.equal(resolved('alpha')?.visible,true);assert.equal(resolved('blacksail')?.visible,true);assert.equal(resolved('winter')?.visible,false);
 fields.applyState({stage:'complete',anchors:[true,true,true],ending:'repurpose',route:'winter'});
 assert.equal(resolved('blacksail')?.visible,false);assert.equal(resolved('winter')?.visible,true);
 fields.dispose();
});

test('Valley foundations extend beneath low-side terrain instead of floating on slopes',()=>{
 const fields=createFalseDawnSites((x,z)=>3+x*.08+z*.03),alpha=fields.sites[0];assert.equal(alpha.foundationSupports.length,8);
 for(const support of alpha.foundationSupports){assert.ok(support.bottom<support.groundMin-.075,`Unsupported footing at ${support.x},${support.z}`);assert.ok(support.top>support.groundMin);}
 const widths=[[1.3,1.3],[1.3,1.3],[2.12,1.1],[1.85,1.12],[1.5,1.05]];alpha.foundationSupports.slice(0,5).forEach((s,i)=>{for(const dx of[-widths[i][0]/2,widths[i][0]/2])for(const dz of[-widths[i][1]/2,widths[i][1]/2]){const actual=3+(alpha.origin[0]+s.x+dx)*.08+(alpha.origin[2]+s.z+dz)*.03-alpha.origin[1];assert.ok(s.bottom<actual-.075);}});
 fields.dispose();
});

test('settled service court is front-facing from the player side without enabling double-sided materials',()=>{
 const fields=createFalseDawnSites(()=>3),alpha=fields.sites[0];fields.root.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(alpha.origin[0]+2,10,alpha.origin[2]+1),new THREE.Vector3(0,-1,0));
 const hits=ray.intersectObject(alpha.root,true);assert.ok(hits.some(h=>Math.abs(h.point.y-3.018)<.005),'upward-facing service court tile must render from above');
 alpha.root.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])assert.equal(m.side,THREE.FrontSide);});fields.dispose();
});

test('remote completion indicators remain in front of instrument face detailing',()=>{
 const fields=createFalseDawnSites(()=>3);fields.root.updateMatrixWorld(true);
 for(const [region,route]of[['blacksail','harbor'],['winter','winter']]as const){fields.applyState({stage:'complete',anchors:[true,true,true],ending:'repurpose',route});const site=fields.sites.find(s=>s.region===region)!,indicator=site.art.layers.get('resolved')!,center=new THREE.Box3().setFromObject(indicator).getCenter(new THREE.Vector3());
  const ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(0,0,1)),new THREE.Vector3(0,0,-1),0,1.1),hits=ray.intersectObject(site.root,true);assert.equal(hits[0]?.object,indicator,`${region} completion cue hidden behind new housing`);
 }fields.dispose();
});

test('optional structural shadows preserve every visual triangle, collider and marker',()=>{
 const off=createFalseDawnSites(),on=createFalseDawnSites(undefined,{nearStructureShadows:true});assert.deepEqual(on.markers,off.markers);assert.equal(off.sites[0].root.children.length,7);assert.equal(on.sites[0].root.children.length,8);
 const triangles=(root:THREE.Group)=>{const rows:string[]=[];root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const g=o.geometry,ix=g.index,attrs=['position','normal','color'].map(n=>g.getAttribute(n));for(let t=0;t<(ix?.count??attrs[0].count);t+=3){const row:number[]=[];for(let j=0;j<3;j++){const i=ix?ix.getX(t+j):t+j;for(const a of attrs)row.push(a.getX(i),a.getY(i),a.getZ(i));}rows.push(row.join(','));}});return rows.sort();};
 for(let i=0;i<3;i++)assert.deepEqual(triangles(on.sites[i].root),triangles(off.sites[i].root));
 assert.equal(on.collisionGeometries.length,off.collisionGeometries.length);on.collisionGeometries.forEach((g,i)=>assert.deepEqual(g.attributes.position.array,off.collisionGeometries[i].attributes.position.array));
 assert.equal(on.sites[0].art.layers.get('ground')!.material,on.sites[0].art.layers.get('body')!.material);off.dispose();on.dispose();
});

test('near structural shadow prototype has hysteresis and a hard two-caster cap',()=>{
 const fields=createFalseDawnSites(undefined,{nearStructureShadows:true}),alpha=fields.sites[0];const casters=()=>{const ms:THREE.Mesh[]=[];fields.root.traverse(o=>{if(o instanceof THREE.Mesh&&o.castShadow)ms.push(o);});return ms;};
 const at=(distance:number)=>fields.update({x:alpha.origin[0]+distance,z:alpha.origin[2]});
 assert.equal(casters().length,0);at(69);assert.equal(casters().length,2);at(79);assert.equal(casters().length,2);at(86);assert.equal(casters().length,0);at(79);assert.equal(casters().length,0);at(69);assert.equal(casters().length,2);
 const resources=fields.sites.flatMap(s=>s.root.children.map(o=>(o as THREE.Mesh).geometry));
 for(let i=0;i<600;i++){const site=fields.sites[i%3];fields.update({x:site.origin[0],z:site.origin[2]});fields.applyState({stage:i%2?'complete':'locked',ending:i%3?'repurpose':'seal',route:i%2?'harbor':'winter',anchors:[!!(i%2),true,false]});assert.equal(casters().length,2);for(const mesh of casters())assert.ok(['body','metal'].includes(mesh.userData.campaignLayer));}
 assert.deepEqual(fields.sites.flatMap(s=>s.root.children.map(o=>(o as THREE.Mesh).geometry)),resources);fields.update({x:NaN,z:0});assert.equal(casters().length,0);
 at(0);const last=casters();fields.dispose();assert.ok(last.every(m=>!m.castShadow));fields.update({x:alpha.origin[0],z:alpha.origin[2]});assert.equal(casters().length,0);
});

test('default and explicit low-quality shadow setting retain zero casters nearby',()=>{
 for(const options of[{}, {nearStructureShadows:false}]){const fields=createFalseDawnSites(undefined,options);for(const s of fields.sites){fields.update({x:s.origin[0],z:s.origin[2]});fields.root.traverse(o=>{if(o instanceof THREE.Mesh)assert.equal(o.castShadow,false);});}fields.dispose();}
});

test('retry/save projection lights only accepted grounding circuits, not unaccepted emitters',()=>{
 const fields=createFalseDawnSites(),alpha=fields.sites[0],layers=['briefed','choiceA','choiceB']as const,materials=new Set(Object.values(alpha.art.materials));
 for(const anchors of[[true,false,false],[true,true,false],[true,false,false],[false,false,false]]){fields.applyState({stage:'array',anchors});layers.forEach((layer,i)=>{const mesh=alpha.art.layers.get(layer)!;assert.equal(mesh.visible,anchors[i]);assert.equal(mesh.material,alpha.art.materials.glow);assert.equal(mesh.castShadow,false);});assert.ok(alpha.art.materials.glow.emissiveIntensity>0);}
 assert.equal(materials.size,3);assert.notEqual(alpha.art.layers.get('metal')!.material,alpha.art.materials.glow,'outer emitter structures stay neutral');
 fields.applyState({stage:'complete',anchors:[true,true,true],ending:'seal'});layers.forEach(layer=>assert.equal(alpha.art.layers.get(layer)!.visible,false));assert.equal(alpha.art.materials.glow.emissiveIntensity,0);fields.dispose();
});

test('supported shadow toggles are idempotent and never rebuild or enable unsplit ground',()=>{
 const low=createFalseDawnSites();assert.equal(low.structureShadowsSupported,false);assert.equal(low.setStructureShadowsEnabled(true),false);assert.equal(low.structureShadowsEnabled,false);assert.equal(low.setStructureShadowsEnabled(false),true);low.dispose();
 const fields=createFalseDawnSites(undefined,{nearStructureShadows:true}),site=fields.sites[0],geometries=fields.sites.flatMap(s=>s.root.children.map(m=>(m as THREE.Mesh).geometry)),colliders=[...fields.collisionGeometries],markers=JSON.stringify(fields.markers);fields.update({x:site.origin[0],z:site.origin[2]});
 for(let i=0;i<50;i++){assert.equal(fields.setStructureShadowsEnabled(false),true);assert.equal(fields.setStructureShadowsEnabled(false),true);fields.root.traverse(o=>{if(o instanceof THREE.Mesh)assert.equal(o.castShadow,false);});assert.equal(fields.setStructureShadowsEnabled(true),true);fields.update({x:site.origin[0],z:site.origin[2]});assert.equal(site.root.children.filter(o=>(o as THREE.Mesh).castShadow).length,2);assert.equal(site.art.layers.get('ground')!.castShadow,false);}
 assert.deepEqual(fields.sites.flatMap(s=>s.root.children.map(m=>(m as THREE.Mesh).geometry)),geometries);assert.deepEqual(fields.collisionGeometries,colliders);assert.equal(JSON.stringify(fields.markers),markers);fields.dispose();assert.equal(fields.setStructureShadowsEnabled(true),false);assert.equal(fields.structureShadowsEnabled,false);
});
