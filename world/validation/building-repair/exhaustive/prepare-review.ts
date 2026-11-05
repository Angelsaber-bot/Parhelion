import {readFileSync,writeFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';import{ALL_EXTENSIONS}from'@gltf-transform/extensions';import{MeshoptDecoder}from'meshoptimizer';
const dir=process.argv[2]??'/tmp/parhelion-exhaustive',d=JSON.parse(readFileSync(`${dir}/inventory.json`,'utf8'));
await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const parity:any[]=[];
for(const region of ['alpha','britain','blacksail','winter','kyoto']){const doc=await io.read(`public/assets/world_${region}.glb`);const map=new Map(doc.getRoot().listNodes().map(n=>[n.getName(),n.getMesh()?.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??p.getAttribute('POSITION')!.getCount())/3,0)]));
 for(const b of d.batches.filter((b:any)=>b.region===region)){const shipped=map.get(b.name)??0;if(shipped!==b.sourceTriangles)parity.push({...b,shipped});}}
if(parity.length)throw Error(`Construction / production mismatch: ${JSON.stringify(parity)}`);
const byId=new Map(d.inventory.map((o:any)=>[o.id,o]));
const excluded=(c:any)=> /^(Trees_|Bushes|Rocks(?:_|$)|Glow_Props|Kyoto_Flames|Waterfall|Fire_|Hall_Fire|.*_Beam|.*_Veil|TGT_|Shard_|.*_Core(?:_|$)|Dark_Sun|Cold_Lamp|Warm_Lamp|Vortex_Debris|Arashiyama_Foliage|Arashiyama_GardenWater|Ice_Bay|Gorge)/.test(c.batch);
const items=new Map<string,any>();const alias=new Map<string,string>();
// Match separately-authored roof/body calls by exact plan center, retaining every instance.
for(const o of d.inventory.filter((x:any)=>['addKyotoRoof','addKyotoAttic'].includes(x.kind))){const [_,x,y,z]=o.args;const body=d.inventory.find((b:any)=>b.region===o.region&&['addMachiyaCraft','addBurntCraft','addGateCraft','addKiyomizuCraft','addKinkakuCraft','addHonnojiCraft','addPagodaLevelCraft'].includes(b.kind)&&Math.abs((b.args[1]??Infinity)-x)<.02&&Math.abs((b.args[3]??Infinity)-z)<.02);if(body)alias.set(o.id,body.id);}
const buildingOwners=d.inventory.filter((x:any)=>x.kind!=='batch'&&!['addKyotoRoof','addKyotoAttic'].includes(x.kind));
for(const c of d.components){if(excluded(c))continue;let owner=byId.get(c.owner) as any,id=alias.get(c.owner)??c.owner;
 if(owner.kind==='batch'){
  const center=c.min.map((v:number,i:number)=>(v+c.max[i])/2),near=buildingOwners.filter((b:any)=>b.region===c.region&&center[0]>=b.min[0]-.5&&center[0]<=b.max[0]+.5&&center[2]>=b.min[2]-.5&&center[2]<=b.max[2]+.5&&c.max[0]-c.min[0]<b.max[0]-b.min[0]+2&&c.max[2]-c.min[2]<b.max[2]-b.min[2]+2).sort((a:any,b:any)=>(a.max[0]-a.min[0])*(a.max[2]-a.min[2])-(b.max[0]-b.min[0])*(b.max[2]-b.min[2]));
  if(near.length)id=near[0].id;
  else id=`${c.region}-cell-${Math.floor(center[0]/24)}-${Math.floor(center[2]/24)}`;
 }
 let item=items.get(id);if(!item){const ref=byId.get(id) as any;item={id,region:c.region,kind:ref?.kind??'remaining-architecture-cell',source:ref?.source??null,args:ref?.args??[],components:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],review:'pending'};items.set(id,item);}
 item.components.push(c.id);for(let k=0;k<3;k++){item.min[k]=Math.min(item.min[k],c.min[k]);item.max[k]=Math.max(item.max[k],c.max[k]);}
}
const entries=[...items.values()].sort((a,b)=>a.region.localeCompare(b.region)||a.id.localeCompare(b.id));
writeFileSync(`${dir}/review-items.json`,JSON.stringify(entries));writeFileSync('validation/building-repair/exhaustive/provenance.json',JSON.stringify({sourceBatchCount:d.batches.length,parityMismatches:parity,reviewItems:entries.length,componentsIncluded:entries.reduce((n,x)=>n+x.components.length,0),componentsExcludedAsNatureOrEffects:d.components.filter(excluded).length,regions:entries.reduce((a,x)=>(a[x.region]=(a[x.region]??0)+1,a),{} as any)},null,2));
console.log('review items',entries.length,entries.reduce((a,x)=>(a[x.kind]=(a[x.kind]??0)+1,a),{} as any));
