/** Scene projection audit, not gameplay completion: explicit preboot saves, direct
 * visual-state stress, then real reset key. No GPU/texture or human-readability claim. */
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import * as THREE from 'three';
import { bootWorldWithoutGpu } from '../world-dom-boot.fixture';
import { CAMPAIGN_REGIONS,CAMPAIGN_EPISODES,campaignEpisodeFlags } from '../../src/campaignEpisodes';
import { FALSE_DAWN } from '../../src/falseDawnCampaign';
import { WORLD_PROGRESS_KEY } from '../../src/progress';
const out=process.argv[2];assert(out,'OUTPUT_DIR');await mkdir(out,{recursive:true});
const results:any[]=[];
const hash=(a:ArrayBufferView)=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
for(const quality of ['low','med']as const)for(const branch of [0,1]){
 const flags=CAMPAIGN_REGIONS.flatMap(r=>{const f=campaignEpisodeFlags(r);return[f.met,f.workFirst,f.work,f.complete,f.choice(CAMPAIGN_EPISODES[r].choices[branch].id),...CAMPAIGN_EPISODES[r].evidence];});
 flags.push(FALSE_DAWN.started,FALSE_DAWN.complete,...FALSE_DAWN.anchors,branch?FALSE_DAWN.routeWinter:FALSE_DAWN.routeHarbor,branch?FALSE_DAWN.sealed:FALSE_DAWN.rescued);
 const h=await bootWorldWithoutGpu({deterministic:true,effectsQuality:quality,initialStorage:{[WORLD_PROGRESS_KEY]:JSON.stringify({done:flags,found:[]})}}),w=h.world;let now=0;
 const frame=()=>h.frame(now+=1000/60);
 try{
  (h.window.document.getElementById('start')as HTMLElement).click();await Promise.resolve();frame();await h.settleAssets();
  w.scene.updateMatrixWorld(true);
  const roots=[w.campaignSites.root,w.falseDawnSites.root],meshes:any[]=[];
  for(const root of roots)root.traverse((o:any)=>{if(o.isMesh)meshes.push(o);});
  assert.equal(new Set(meshes).size,meshes.length,'no mesh object duplicated across roots');
  for(const site of [...w.campaignSites.sites,...w.falseDawnSites.sites])assert.equal(new Set(site.root.children.map((m:any)=>m.name)).size,site.root.children.length,'unique layers within each site; shared layer names across separate sites are intentional');
  const materials=new Set(meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]));
  const snapshot=meshes.map(m=>({m,g:m.geometry,mat:m.material,matrix:m.matrixWorld.toArray(),positions:hash(m.geometry.attributes.position.array),bounds:[new THREE.Box3().setFromObject(m).min.toArray(),new THREE.Box3().setFromObject(m).max.toArray()]}));
  const colliders=[...w.campaignSites.collisionGeometries,...w.falseDawnSites.collisionGeometries],collisionHashes=colliders.map((g:any)=>hash(g.attributes.position.array));
  const oldMaterials=new Map<any,string>(),oldColors=new Map<any,string>();let normalizedByteColors=0;
  w.scene.getObjectByName('World').traverse((o:any)=>{if(!o.isMesh||o.name==='Tower_Halo'||o.name.endsWith('__outline'))return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(!materials.has(m))oldMaterials.set(m,JSON.stringify({color:m.color?.toArray(),emissive:m.emissive?.toArray(),intensity:m.emissiveIntensity,side:m.side,opacity:m.opacity}));const c=o.geometry.attributes.color;if(c){const storage=c.isInterleavedBufferAttribute?c.data.array:c.array;oldColors.set(c,hash(storage));if(c.normalized&&storage instanceof Uint8Array)normalizedByteColors++;for(const i of [0,Math.floor(c.count/2),c.count-1])for(const v of [c.getX(i),c.getY(i),c.getZ(i)])assert(Number.isFinite(v)&&v>=0&&v<=1);}});
  assert(normalizedByteColors>0,'actual compact normalized colors present');
  const branchBounds:any[]=[];
  function inspectCampaign(index:number,stage=3){
   for(const site of w.campaignSites.sites){
    for(const [suffix,wanted]of [['briefed',stage>=1],['choiceA',stage>=2&&index===0],['choiceB',stage>=2&&index===1],['resolved',stage===3]]as const){const m=site.root.getObjectByName(`Campaign_${site.region}_${suffix}`);assert(m);assert.equal(m.visible,wanted,`${quality}/${site.region}/${suffix}`);}
    const residents:any[]=[];w.scene.traverse((o:any)=>{if(o.name===`Resident_${site.npc.id}`)residents.push(o);});assert.equal(residents.length,1,'one resident per socket');assert(Math.hypot(residents[0].position.x-site.npc.position[0],residents[0].position.z-site.npc.position[2])<.01);
    const layer=site.root.getObjectByName(`Campaign_${site.region}_choice${index?'B':'A'}`),b=new THREE.Box3().setFromObject(layer);assert(!b.isEmpty());assert(b.min.toArray().concat(b.max.toArray()).every(Number.isFinite));branchBounds.push({region:site.region,index,stage,min:b.min.toArray(),max:b.max.toArray()});
   }
  }
  inspectCampaign(branch);
  for(const layer of ['briefed','choiceA','choiceB'])assert.equal(w.falseDawnSites.sites[0].art.layers.get(layer)?.visible,branch===0,'fresh ending restores each accepted cue or dark seal');
  for(const site of w.falseDawnSites.sites){assert.equal(site.root.userData.falseDawnStage,'complete');assert.equal(site.art.layers.get('resolved')?.visible,!branch&&(site.region==='alpha'||site.region==='blacksail'));}
  for(const manager of [w.campaignSites,w.falseDawnSites]){
   for(const site of manager.sites){manager.update({x:site.origin[0],z:site.origin[2]});assert.equal(site.root.visible,true);}
   manager.update({x:10000,z:10000});assert(manager.sites.every((s:any)=>!s.root.visible));
  }
  for(let i=0;i<40;i++){
   const index=i%2;for(const site of w.campaignSites.sites)site.applyState({stage:3,choice:CAMPAIGN_EPISODES[site.region as keyof typeof CAMPAIGN_EPISODES].choices[index].id});
   w.falseDawnSites.applyState({stage:'complete',anchors:[true,true,true],route:index?'winter':'harbor',ending:index?'seal':'repurpose'});
   if(i<2)inspectCampaign(index);
  }
  for(const s of snapshot){assert.equal(s.m.geometry,s.g);assert.equal(s.m.material,s.mat);assert.deepEqual(s.m.matrixWorld.toArray(),s.matrix);assert.equal(hash(s.g.attributes.position.array),s.positions);}
  assert.deepEqual(colliders.map((g:any)=>hash(g.attributes.position.array)),collisionHashes);
  for(const [m,signature]of oldMaterials)assert.equal(JSON.stringify({color:m.color?.toArray(),emissive:m.emissive?.toArray(),intensity:m.emissiveIntensity,side:m.side,opacity:m.opacity}),signature,'old material untouched by branch projection');
  for(const [c,signature]of oldColors)assert.equal(hash(c.isInterleavedBufferAttribute?c.data.array:c.array),signature,'decoded color storage untouched');
  h.window.confirm=()=>true;for(const type of ['keydown','keyup'])h.window.document.body.dispatchEvent(new h.window.KeyboardEvent(type,{code:'KeyR',bubbles:true}));frame();assert.equal(w.done.size,0);inspectCampaign(0,0);
  for(const site of w.falseDawnSites.sites){assert.equal(site.root.userData.falseDawnStage,'locked');assert.equal(site.art.layers.get('resolved')?.visible,false);}
  for(const layer of ['briefed','choiceA','choiceB'])assert.equal(w.falseDawnSites.sites[0].art.layers.get(layer)?.visible,false);
  assert.deepEqual(colliders.map((g:any)=>hash(g.attributes.position.array)),collisionHashes);for(const s of snapshot){assert.equal(s.m.geometry,s.g);assert.equal(s.m.material,s.mat);assert.equal(hash(s.g.attributes.position.array),s.positions);}assert.deepEqual(h.errors,[]);
  const sceneBounds=[...w.campaignSites.sites,...w.falseDawnSites.sites].map((s:any)=>{const b=new THREE.Box3().setFromObject(s.root);return{region:s.region,min:b.min.toArray(),max:b.max.toArray()};});
  results.push({quality,branch,meshCount:meshes.length,oldMaterials:oldMaterials.size,normalizedByteColors,branchBounds,sceneBounds,collisionHashes,collisionImmutable:true,resetPassed:true});console.log(JSON.stringify({quality,branch,passed:true}));
 }finally{await h.close();}
}
for(const branch of [0,1]){const low=results.find(r=>r.quality==='low'&&r.branch===branch),med=results.find(r=>r.quality==='med'&&r.branch===branch);assert.deepEqual(low.branchBounds,med.branchBounds,'quality never moves branch props');assert.deepEqual(low.sceneBounds,med.sceneBounds,'quality split never changes field extents');assert.deepEqual(low.collisionHashes,med.collisionHashes,'quality never changes authoritative collision');}
await writeFile(path.join(out,'branch-scene-consistency.json'),JSON.stringify({scope:'Preboot saved visual branches;40direct projection switches;production R reset;not gameplay/GPU',results},null,2)+'\n');
