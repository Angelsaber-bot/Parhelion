// Seat trees, bushes and rocks (and their trunk/rock colliders) on the current ground in
// the continental join bands of the five original tiles. Only the Y component of whole
// connected props changes, in the stored int16 units, and every change is listed in
// validation/join-band-seating.edits.json so tests can reverse it to the reviewed bytes.
// Props standing on architecture are left alone. Props whose ground is now sea, and large
// boulders that would land on the open seam strip, sink fully below the ground instead.
//   node --import tsx tools/reground-scatter.ts [--region=britain] [--dry]
import * as THREE from 'three';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {MeshBVH} from 'three-mesh-bvh';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {regionLoader,bakeQuantized} from '../src/rendering/glb';
import {WorldGrid} from '../src/map/grid';
import {components} from './reground-scatter-parts';
import {TILE_JOINS,toTile} from './gen/continent';
import {REGIONS,regionToWorld} from '../src/map/regions';
import {EXPANSION_CONNECTIONS,distanceToLine} from '../src/map/worldPlan';
import {applySeating,type SeatingEdits} from '../validation/join-band-seating';
import {scatterFingerprint} from './scatter-seating-record';

const TARGET=/^(Trees_Trunks|Trees_Leaves|Rocks|Bushes|COL_Props)/,BAND=220,WATER=.25;
const EDITS=new URL('../validation/join-band-seating.edits.json',import.meta.url);
const selected=process.argv.find(a=>a.startsWith('--region='))?.slice(9),dry=process.argv.includes('--dry');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const record:SeatingEdits=existsSync(EDITS)?JSON.parse(readFileSync(EDITS,'utf8')):{reason:'',band:BAND,regions:{}};
record.reason='Continental join bands and cross-region road decks: whole trees, bushes, rocks and their prop colliders move only vertically onto the current ground, or sink below it where the ground is now sea, the open seam strip or a road. Values are int16 Y deltas per vertex range.';
record.band=BAND;
type Part={verts:number[];x:number;z:number;minY:number;maxY:number;r:number};
for(const id of ['alpha','britain','winter','kyoto','blacksail'].filter(r=>!selected||r===selected)){
  const url=new URL(`../public/assets/world_${id}.glb`,import.meta.url),bytes=readFileSync(url);
  const doc=await io.readBinary(bytes);
  const nodes=doc.getRoot().listNodes().filter(n=>TARGET.test(n.getName()));
  const expected=record.appliedHashes?.[id];
  if(expected&&expected!==scatterFingerprint(nodes))throw new Error(`${id}: seating ledger belongs to another mesh export; regenerate this region before seating it`);
  // back to the reviewed bytes first, so repeated runs never stack shifts
  applySeating(record.regions[id]??{},nodes,-1);
  const {scene}=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  bakeQuantized(scene);scene.updateMatrixWorld(true);
  const grid=new WorldGrid([scene.getObjectByName('Terrain') as THREE.Mesh],-360,-360,720,2);
  const built:THREE.BufferGeometry[]=[];
  scene.getObjectByName('COLLISION')!.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||/^COL_(Terrain|Props)/.test(m.name))return;let g=new THREE.BufferGeometry().setAttribute('position',m.geometry.attributes.position.clone());if(m.geometry.index)g.setIndex(m.geometry.index.clone());g.applyMatrix4(m.matrixWorld);if(g.index)g=g.toNonIndexed();built.push(g);});
  const structures=built.length?new MeshBVH(mergeGeometries(built)):null,ray=new THREE.Ray();
  const onStructure=(pt:Part)=>{if(!structures)return false;for(const [dx,dz] of [[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6]]){ray.set(new THREE.Vector3(pt.x+dx,pt.minY+1.2,pt.z+dz),new THREE.Vector3(0,-1,0));const hit=structures.raycastFirst(ray,THREE.DoubleSide);if(hit&&hit.distance<3)return true;}return false;};
  const ground=(pt:Part)=>{let g=Infinity;for(const [dx,dz] of [[0,0],[pt.r*.5,0],[-pt.r*.5,0],[0,pt.r*.5],[0,-pt.r*.5]]){const y=grid.sampleHeight(pt.x+dx,pt.z+dz);if(y!=null)g=Math.min(g,y);}return g;};
  // Cross-region roads stay clear: props on a road deck sink below the ground.
  const def=REGIONS.find(r=>r.id===id)!;
  const onRoad=(pt:Part)=>{const [wx,wz]=regionToWorld(def,pt.x,pt.z);return EXPANSION_CONNECTIONS.some(c=>distanceToLine(wx,wz,c.points)<c.width/2+1.5+pt.r);};
  const seamDistance=(ax:number,az:number)=>{const [x,z]=toTile(id,ax,az);return Math.min(...TILE_JOINS[id].map(s=>s==='N'?z+360:s==='S'?360-z:s==='W'?x+360:360-x));};
  // decode the reviewed positions (uniform-scale quantized nodes, no rotation)
  const decoded=new Map<string,{node:typeof nodes[number];array:Int16Array;scale:number;t:number[];parts:Part[]}>();
  for(const node of nodes){
    const prim=node.getMesh()!.listPrimitives();if(prim.length!==1)throw new Error(`${id}/${node.getName()}: ${prim.length} primitives`);
    const acc=prim[0].getAttribute('POSITION')!,array=acc.getArray() as Int16Array,m=node.getWorldMatrix();
    if(!(array instanceof Int16Array)||!acc.getNormalized()||acc.getElementSize()!==3||m[1]||m[2]||m[4]||m[6]||m[8]||m[9]||m[0]!==m[5]||m[5]!==m[10])throw new Error(`${id}/${node.getName()}: unexpected encoding`);
    const scale=m[5]/32767,t=[m[12],m[13],m[14]],n=acc.getCount(),f=new Float32Array(n*3);
    for(let i=0;i<n*3;i++)f[i]=array[i]*scale+t[i%3];
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(f,3)),idx=prim[0].getIndices();if(idx)g.setIndex(Array.from(idx.getArray()!));
    const parts=components(g).map(verts=>{let minY=Infinity,maxY=-Infinity,sx=0,sz=0;for(const i of verts){minY=Math.min(minY,f[i*3+1]);maxY=Math.max(maxY,f[i*3+1]);sx+=f[i*3];sz+=f[i*3+2];}const x=sx/verts.length,z=sz/verts.length;let r=0;for(const i of verts)r=Math.max(r,Math.hypot(f[i*3]-x,f[i*3+2]-z));return {verts,x,z,minY,maxY,r};});
    decoded.set(node.getName(),{node,array,scale,t,parts});
  }
  const shift=new Map<string,Map<number,number>>(),stats={moved:0,sunk:0,onStructure:0,crowns:0,colliders:0};
  const moved:{x:number;z:number;oldMin:number;dy:number}[]=[];
  const apply=(name:string,pt:Part,dy:number)=>{if(dy===0)return;const m=shift.get(name)??shift.set(name,new Map()).get(name)!;for(const i of pt.verts)m.set(i,dy);};
  const seat=(pt:Part,kind:'trunk'|'rock'|'bush')=>{
    const gy=ground(pt);if(!Number.isFinite(gy))return 0;
    if(onRoad(pt)&&pt.maxY>gy-1&&!onStructure(pt)){const dy=gy-1-pt.maxY;stats.sunk++;moved.push({x:pt.x,z:pt.z,oldMin:pt.minY,dy});return dy;}
    if(Math.max(Math.abs(pt.x),Math.abs(pt.z))<BAND)return 0;
    const height=pt.maxY-pt.minY,sink=kind==='trunk'?.3:kind==='rock'?Math.min(1.2,.25*height):Math.min(.2,.15*height);
    let dy=gy-sink-pt.minY;
    if(Math.abs(dy)<Math.min(.35,Math.max(.08,.5*height)))return 0;
    if(dy<0&&onStructure(pt)){stats.onStructure++;return 0;}
    const boulderOnSeam=kind==='rock'&&pt.r>1.2&&Math.abs(dy)>2&&seamDistance(pt.x,pt.z)<45;
    if(gy<WATER||boulderOnSeam){dy=gy-1-pt.maxY;stats.sunk++;}else stats.moved++;
    moved.push({x:pt.x,z:pt.z,oldMin:pt.minY,dy});return dy;
  };
  const trunks:(Part&{dy:number})[]=[];
  for(const [name,d] of decoded)if(/^Trees_Trunks/.test(name))for(const pt of d.parts){const dy=seat(pt,'trunk');apply(name,pt,dy);trunks.push({...pt,dy});}
  const crownOf=(pt:Part)=>{let best:(typeof trunks)[number]|undefined,bd=3;for(const t of trunks){const d=Math.hypot(t.x-pt.x,t.z-pt.z);if(d<bd&&pt.minY>t.minY+.5){bd=d;best=t;}}return best;};
  for(const [name,d] of decoded){
    if(/^Trees_Trunks/.test(name)||name==='COL_Props')continue;
    const leaves=/^Trees_Leaves/.test(name),rock=/^Rocks/.test(name);
    for(const pt of d.parts){const t=rock?undefined:crownOf(pt);if(t){if(t.dy)stats.crowns++;apply(name,pt,t.dy);continue;}if(!leaves)apply(name,pt,seat(pt,rock?'rock':'bush'));}
  }
  const col=decoded.get('COL_Props');
  if(col)for(const pt of col.parts){let best:(typeof moved)[number]|undefined,bd=1.6;for(const t of moved){const d=Math.hypot(t.x-pt.x,t.z-pt.z);if(d<bd&&Math.abs(pt.minY-t.oldMin)<1.6){bd=d;best=t;}}if(best){apply('COL_Props',pt,best.dy);stats.colliders++;}}
  // encode as int16 deltas over vertex ranges
  const region:Record<string,[number,[number,number][]][]>={};
  for(const [name,map] of shift){
    const d=decoded.get(name)!,byDq=new Map<number,number[]>();
    for(const [v,dy] of map){const dq=Math.round(dy/d.scale);if(dq===0)continue;const q=d.array[v*3+1]+dq;if(q<-32767||q>32767)throw new Error(`${id}/${name}: vertex ${v} leaves the quantization range`);(byDq.get(dq)??byDq.set(dq,[]).get(dq)!).push(v);}
    region[name]=[...byDq].map(([dq,vs])=>{vs.sort((a,b)=>a-b);const ranges:[number,number][]=[];for(const v of vs){const last=ranges[ranges.length-1];if(last&&last[1]===v-1)last[1]=v;else ranges.push([v,v]);}return [dq,ranges];});
  }
  console.log(id,JSON.stringify(stats),Object.entries(region).map(([k,v])=>`${k}:${v.reduce((s,[,r])=>s+r.reduce((a,[b,c])=>a+c-b+1,0),0)}`).join(' '));
  if(dry)continue;
  record.regions[id]=region;
  applySeating(region,nodes,1);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const packed=await io.writeBinary(doc);
  writeFileSync(url,packed);
  const saved=await io.readBinary(packed);
  (record.appliedHashes??={})[id]=scatterFingerprint(saved.getRoot().listNodes());
}
if(!dry)writeFileSync(EDITS,JSON.stringify(record));
