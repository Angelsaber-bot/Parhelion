import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {createHash} from 'node:crypto';
import {SiteArt,buildCampaignSite} from '../src/campaignSites';import {createFalseDawnSites} from '../src/falseDawnSites';
const digest=(geos:THREE.BufferGeometry[])=>{const h=createHash('sha256');for(const g of geos)for(const a of Object.values(g.attributes)){const v=a.array;h.update(Buffer.from(v.buffer,v.byteOffset,v.byteLength));}return h.digest('hex');};
test('all campaign and False Dawn builders release construction bins without mutating final state resources',()=>{
 const captured:SiteArt[]=[],finish=SiteArt.prototype.finish;SiteArt.prototype.finish=function(region){finish.call(this,region);captured.push(this);};
 let campaigns:ReturnType<typeof buildCampaignSite>[]=[];let fields:ReturnType<typeof createFalseDawnSites>|undefined;
 try{
  campaigns=(['alpha','britain','blacksail','winter','kyoto']as const).map(buildCampaignSite);fields=createFalseDawnSites(undefined,{nearStructureShadows:true});assert.equal(captured.length,8);
  const snapshots=captured.map(a=>{assert.equal((a as any).bins.size,0);const geos=[...a.root.children.map(m=>(m as THREE.Mesh).geometry),...a.solids];assert(geos.length>0);return{a,geos,hash:digest(geos)};});
  const choices=[['broadcast','listen'],['names','seats'],['families','supplies'],['shelter','convoy'],['records','refuge']];
  for(let i=0;i<40;i++){campaigns.forEach((s,j)=>s.applyState({stage:(i%4)as 0|1|2|3,choice:choices[j][i%2]}));fields.applyState({stage:i%2?'complete':'array',anchors:[true,!!(i%2),false],route:i%2?'harbor':'winter',ending:i%2?'repurpose':null});}
  for(const s of snapshots){assert.equal((s.a as any).bins.size,0);assert.deepEqual([...s.a.root.children.map(m=>(m as THREE.Mesh).geometry),...s.a.solids],s.geos);assert.equal(digest(s.geos),s.hash);}
 }finally{SiteArt.prototype.finish=finish;campaigns.forEach(s=>s.dispose());fields?.dispose();}
});
test('finish clears only owned construction references, never the borrowed source or final buffers',()=>{
 const source=new THREE.BoxGeometry(),sourceHash=digest([source]);let sourceDisposals=0;source.addEventListener('dispose',()=>sourceDisposals++);
 const art=new SiteArt();art.add(source,'#abcdef',[0,1,0],[1,1,1],true);const parts=[...(art as any).bins.values()].flat()as THREE.BufferGeometry[];let partDisposals=0;parts.forEach(g=>g.addEventListener('dispose',()=>partDisposals++));
 art.finish('alpha');assert.equal((art as any).bins.size,0);assert.equal(partDisposals,parts.length);assert.equal(sourceDisposals,0);assert.equal(digest([source]),sourceHash);
 const output=[...art.root.children.map(m=>(m as THREE.Mesh).geometry),...art.solids];for(const g of output)for(const a of Object.values(g.attributes))assert(a.count>0);
 for(const g of output)g.dispose();Object.values(art.materials).forEach(m=>m.dispose());source.dispose();
});
