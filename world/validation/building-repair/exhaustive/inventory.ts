/** Offline source provenance inventory. Instruments only a temporary copy; production code is never patched. */
import * as THREE from 'three';
import { cpSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
const output=resolve(process.argv[2]??'validation/building-repair/exhaustive');
const temp=resolve('/tmp/parhelion-building-audit');mkdirSync(temp,{recursive:true});mkdirSync(output,{recursive:true});
cpSync('tools/gen',`${temp}/tools/gen`,{recursive:true});
if(!existsSync(`${temp}/node_modules`))symlinkSync(resolve('node_modules'),`${temp}/node_modules`);
if(!existsSync(`${temp}/src`))symlinkSync(resolve('src'),`${temp}/src`);
writeFileSync(`${temp}/package.json`,'{"type":"module"}');
const selected=new Set(['townHouse','roundTower','pavilion','roundHall','bridgeCraft','gateCraft','keepCrown','farFoundation','shrineCraft','portHouse','tavernCraft','pierCraft','millCraft','lighthouseCraft','fortCraft','reefCraft','marketCraft','lighthouseGallery','buildMaritimeShip','buildSmallCraft','buildHalfWreckHull','buildShipyardFrame','fieldTent','buildCrossingTimber','imperialPavilion','winterHouse','basilCathedral','cathedral','ivanTower','kremlinFortifications','oldPalace','bellScaffoldDetail','addMachiyaCraft','addCityBlock','addGateCraft','addKiyomizuCraft','addKinkakuCraft','addHonnojiCraft','addBurntCraft','addPagodaLevelCraft','addKyotoRoof','addKyotoAttic','torii','toro','observatoryShell','frostCavernPieces']);
const records:any[]=[],stack:any[]=[];let region='';
(globalThis as any).__buildingAudit={
 enter(name:string,file:string,line:number,args:any[]){const rec={id:`${region}-${records.length.toString().padStart(4,'0')}`,region,name,file,line,args:args.map(v=>typeof v==='number'||typeof v==='string'||typeof v==='boolean'?v:null),parent:stack.at(-1)?.id};records.push(rec);stack.push(rec);},
 exit(){stack.pop();},
};
const {readdirSync}=await import('node:fs');
function instrument(dir:string){for(const f of readdirSync(dir,{withFileTypes:true})){const path=resolve(dir,f.name);if(f.isDirectory()){instrument(path);continue;}if(!f.name.endsWith('.ts'))continue;
 const source=readFileSync(path,'utf8'), edits:{at:number;text:string}[]=[];
 // A small balanced-delimiter scanner; source remains TypeScript and tsx handles
 // resolution. It skips comments/strings so braces in labels cannot end a body.
 function closing(start:number,open:string,close:string){let depth=0;
  for(let i=start;i<source.length;i++){const ch=source[i];
   if(ch==='"'||ch==="'"||ch==='`'){const quote=ch;for(i++;i<source.length;i++){if(source[i]==='\\'){i++;continue;}if(source[i]===quote)break;}continue;}
   if(ch==='/'&&source[i+1]==='/'){i=source.indexOf('\n',i);if(i<0)return -1;continue;}
   if(ch==='/'&&source[i+1]==='*'){i=source.indexOf('*/',i+2)+1;continue;}
   if(ch===open)depth++;if(ch===close){depth--;if(depth===0)return i;}
  }return -1;
 }
 for(const match of source.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)){
  if(!selected.has(match[1]))continue;const paren=source.indexOf('(',match.index),end=closing(paren,'(',')'),start=source.indexOf('{',end),finish=closing(start,'{','}');
  if(end<0||start<0||finish<0)throw Error(`Cannot instrument ${path}/${match[1]}`);
  const line=source.slice(0,match.index).split('\n').length,file=relative(temp,path);
  edits.push({at:start+1,text:`\n(globalThis as any).__buildingAudit.enter(${JSON.stringify(match[1])},${JSON.stringify(file)},${line},Array.from(arguments));try {\n`},{at:finish,text:'\n}finally{(globalThis as any).__buildingAudit.exit();}\n'});
 }
 let result=source;for(const e of edits.sort((a,b)=>b.at-a.at))result=result.slice(0,e.at)+e.text+result.slice(e.at);writeFileSync(path,result);
}}
instrument(`${temp}/tools/gen`);
const {Batch}=await import(pathToFileURL(`${temp}/tools/gen/geo.ts`).href);
const oldAdd=Batch.prototype.add;
Batch.prototype.add=function(g:any,color:any,m:any,collide:any){const result=oldAdd.call(this,g,color,m,collide);const v=this.vis.at(-1);v.userData.audit={owners:stack.map(r=>r.id),type:g.type,parameters:g.parameters,source:new Error().stack?.split('\n').filter((s:string)=>s.includes('/tools/gen/')&&!s.includes('geo.ts')).slice(0,4)};return result;};
const entry=[['alpha','terrain','buildTerrain','structures','buildStructures'],['britain','britain/terrain','buildBritainTerrain','britain/build','buildBritain'],['blacksail','blacksail/terrain','buildBlacksailTerrain','blacksail/build','buildBlacksail'],['winter','winter/terrain','buildWinterTerrain','winter/build','buildWinter'],['kyoto','kyoto/terrain','buildKyotoTerrain','kyoto/build','buildKyoto']];
const inventory:any[]=[],components:any[]=[],batches:any[]=[];
let binOffset=0;const buffers:Buffer[]=[];
for(const[id,terrainFile,terrainFn,buildFile,buildFn]of entry){region=id;const terrain=await import(pathToFileURL(`${temp}/tools/gen/${terrainFile}.ts`).href),builder=await import(pathToFileURL(`${temp}/tools/gen/${buildFile}.ts`).href);const t=terrain[terrainFn](),{pieces}=builder[buildFn](t.heightAt);
 const owners=new Map<string,any>();
 for(const piece of pieces){let batchTriangles=0;for(const g of piece.batch.vis){
  g.computeBoundingBox();const box=g.boundingBox!,tag=g.userData.audit??{};
  const rec=tag.owners?.map((id:string)=>records.find(r=>r.id===id)).find((r:any)=>r.name!=='addKyotoRoof')??tag.owners?.map((id:string)=>records.find(r=>r.id===id)).at(-1);
  const id=rec?.id??`${region}-batch-${piece.name}`;
  let owner=owners.get(id);if(!owner){owner={id,region,kind:rec?.name??'batch',source:rec?`${rec.file}:${rec.line}`:null,args:rec?.args??[],parent:rec?.parent??null,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],pieces:[],components:0,triangles:0,rendered:false,review:'pending'};owners.set(id,owner);}
  for(let k=0;k<3;k++){owner.min[k]=Math.min(owner.min[k],box.min.getComponent(k));owner.max[k]=Math.max(owner.max[k],box.max.getComponent(k));}if(!owner.pieces.includes(piece.name))owner.pieces.push(piece.name);
  const p=g.attributes.position,c=g.attributes.color,triangles=(g.index?.count??p.count)/3;owner.triangles+=triangles;owner.components++;batchTriangles+=triangles;
  // Construction geometry is kept unmerged for checking provenance and shell topology.
  const pos=new Float32Array(p.count*3),col=new Float32Array(p.count*3).fill(1);for(let i=0;i<p.count;i++)for(let k=0;k<3;k++){pos[i*3+k]=p.getComponent(i,k);if(c)col[i*3+k]=c.getComponent(i,k);}
  const indices=new Uint32Array(g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i));const buffer=Buffer.concat([Buffer.from(pos.buffer),Buffer.from(col.buffer),Buffer.from(indices.buffer)]);
  components.push({id:components.length,owner:id,region,batch:piece.name,material:piece.material,dynamic:!!piece.dynamic,conditions:piece.userData??{},min:box.min.toArray(),max:box.max.toArray(),scope:tag.owners??[],type:tag.type??'custom',parameters:tag.parameters??null,source:tag.source??[],count:p.count,indices:indices.length,offset:binOffset,bytes:buffer.length});buffers.push(buffer);binOffset+=buffer.length;
 }batches.push({region,name:piece.name,sourceTriangles:batchTriangles,collisionComponents:piece.batch.col.length});}
 inventory.push(...owners.values());console.log(id,owners.size,components.filter(x=>x.region===id).length);
}
writeFileSync(`${output}/construction.bin`,Buffer.concat(buffers));
writeFileSync(`${output}/inventory.json`,JSON.stringify({scope:'Every surviving generated structure ART component; vegetation added by buildVegetation is separate. Runtime supplemental sites are inventoried separately. Construction copy is instrumented; source batch triangle totals must match shipped GLB.',inventory,components,batches,records},null,2));
console.log('inventory',inventory.length,'components',components.length,'MB',binOffset/1e6);
