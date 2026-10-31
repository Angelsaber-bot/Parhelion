/** Constructor provenance audit of actual-main objects, not a WebGL test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
test('remaining procedural Three guards accept actual-main objects and cleanup emits real disposal events',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true});const w=h.world,T=(h.window as any).require('three');
 try{
  const census:Record<string,{branded:number;constructor:number}>={};
  for(const kind of ['Mesh','SkinnedMesh','InstancedMesh','Light']){const row=census[kind]={branded:0,constructor:0};w.scene.traverse((o:any)=>{if(o[`is${kind}`]){row.branded++;if(o instanceof T[kind])row.constructor++;}});}
  assert.ok(census.Mesh.branded>1000);assert.ok(census.Mesh.branded>census.Mesh.constructor,'actual external GLTF objects exercise a distinct constructor lineage');
  const roots=['Chapter_Lived_In_Hubs','SettlementResidents','Settlement_Road_Approaches','Campaign_Working_Spaces','False_Dawn_Action_Fields','ValleyStory_ResidenceSignal',...w.eraStoryScenes.map((s:any)=>s.group.name)];
  const rows:any[]=[];const disposal=new Map<any,number>();const labels=new Map<any,string>();
  for(const name of roots){const root=w.scene.getObjectByName(name);assert.ok(root,name);let meshes=0,triangles=0;
   root.traverse((o:any)=>{if(!o.isMesh)return;meshes++;assert.ok(o instanceof T.Mesh,`${name}/${o.name}: guarded procedural mesh recognized`);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    if(name==='Chapter_Lived_In_Hubs')assert.ok([o.material].flat().every((m:any)=>m.isMeshToonMaterial),'actual settlement adapter positively converted each material');
    else if(!disposal.has(o.geometry)){disposal.set(o.geometry,0);labels.set(o.geometry,`${name}/${o.name}`);o.geometry.addEventListener('dispose',()=>disposal.set(o.geometry,disposal.get(o.geometry)!+1));}
   });assert.ok(meshes>0);rows.push({name,meshes,triangles});
  }
  const residents=w.scene.getObjectByName('SettlementResidents');for(const r of residents.children){let triangles=0;r.traverse((o:any)=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});assert.ok(triangles>0);assert.equal(r.userData.triangles,triangles,'guarded resident triangle accounting is positive and exact');}
  const instanced=new Map<any,number>();for(const visual of w.combat.visuals.values())visual.root.traverse((o:any)=>{if(o.isInstancedMesh){assert.ok(o instanceof T.InstancedMesh);instanced.set(o,0);o.addEventListener('dispose',()=>instanced.set(o,instanced.get(o)!+1));}});
  let pacifiedMaterials=0;for(const id of ['wild_48','wild_48b']){const visual=w.combat.visuals.get(id);assert.ok(visual?.applyPacified);const materials=new Set<any>();visual.fallback.traverse((o:any)=>{if(o.isMesh&&o.material.isMeshStandardMaterial){assert.ok(o instanceof T.Mesh);assert.ok(o.material instanceof T.MeshStandardMaterial);materials.add(o.material);}});assert.ok(materials.size>0);const before=[...materials].map(material=>({material,color:material.color.clone(),emissive:material.emissiveIntensity}));visual.applyPacified(true);for(const entry of before){assert.ok(entry.material.color.equals(entry.color.clone().multiplyScalar(.55)));assert.equal(entry.material.emissiveIntensity,0);}visual.applyPacified(false);for(const entry of before){assert.ok(entry.material.color.equals(entry.color));assert.equal(entry.material.emissiveIntensity,entry.emissive);}pacifiedMaterials+=materials.size;}
  h.window.dispatchEvent(new h.window.PageTransitionEvent('pagehide',{persisted:true}));for(const count of disposal.values())assert.equal(count,0,'BFCache must preserve resources');
  assert.ok(w.scene.fog instanceof T.Fog,'twilight fog guard accepts authored fog');
  assert.ok(w.renderer instanceof T.WebGLRenderer);assert.equal(typeof w.renderer.getContext,'undefined','bloom intentionally excludes the no-GPU renderer on capability, not foreign identity');
  h.window.dispatchEvent(new h.window.PageTransitionEvent('pagehide',{persisted:false}));
  for(const count of instanced.values())assert.equal(count,1,'actual fallback instance resources disposed');
  for(const [g,count]of disposal)assert.equal(count,1,`procedural geometry ${labels.get(g)} disposed exactly once`);
  h.window.dispatchEvent(new h.window.PageTransitionEvent('pagehide',{persisted:false}));for(const count of disposal.values())assert.equal(count,1);
  console.log(JSON.stringify({census,procedural:rows,disposedGeometries:disposal.size,instancedDisposed:instanced.size,pacifiedMaterials,bloom:'intentionally unavailable: no GPU capabilities'}));assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});
