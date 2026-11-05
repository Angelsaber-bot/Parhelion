/** Actual supplemental production-main meshes, including currently hidden state geometry. */
import {bootWorldWithoutGpu} from '../../world-dom-boot.fixture.ts';
import * as THREE from 'three';import{mkdirSync,writeFileSync}from'node:fs';
const dir=process.argv[2]??'/tmp/parhelion-exhaustive-runtime';mkdirSync(dir,{recursive:true});
const h=await bootWorldWithoutGpu({deterministic:true});
try{await h.settleAssets();const w=h.world;h.frame(16);w.scene.updateMatrixWorld(true);const components:any[]=[],owners=new Map<string,any>(),buffers:Buffer[]=[];let offset=0;
 const groups:any[]=[];const world=w.scene.children.find((o:any)=>o.name==='World');
 for(const child of world.children){if(!child.name||child.name==='World'||child.name.startsWith('Streamed_')||child.name==='AmbientLife')continue;if(['Chapter_Lived_In_Hubs','Campaign_Working_Spaces','False_Dawn_Action_Fields'].includes(child.name))groups.push(...child.children);else groups.push(child);}
 for(const child of w.scene.children)if(/^(AuthoredTraversal|EraStory_|ValleyStory_)/.test(child.name))groups.push(child);
 const v=new THREE.Vector3();
 for(const group of groups)group.traverse((m:any)=>{if(!m.isMesh||!m.geometry?.attributes.position||m.name.startsWith('OUTLINE_'))return;
  const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry,p=g.attributes.position,c=g.attributes.color,positions=new Float32Array(p.count*3),colors=new Float32Array(p.count*3);const box=new THREE.Box3();
  const materials=Array.isArray(m.material)?m.material:[m.material];
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);box.expandByPoint(v);positions.set(v.toArray(),i*3);const drawIndex=i,mi=g.groups.find((s:any)=>drawIndex>=s.start&&drawIndex<s.start+s.count)?.materialIndex??0,mat=materials[mi]??materials[0],rgb=mat?.color??new THREE.Color(1,1,1);for(let k=0;k<3;k++)colors[i*3+k]=rgb.getComponent?rgb.getComponent(k)*((c&&mat?.vertexColors)?c.getComponent(i,k):1):[rgb.r,rgb.g,rgb.b][k]*((c&&mat?.vertexColors)?c.getComponent(i,k):1);}
  const center=box.getCenter(new THREE.Vector3());const region=center.x< -360?'britain':center.x>360?'blacksail':center.z< -360?'winter':center.z>360?'kyoto':'alpha';
  const cell=['OpenWorldAdventure','SunwardExploration','KingdomGate_ReturnRoad','AuthoredTraversalAprons','Settlement_Road_Approaches'].includes(group.name)?`-${Math.floor(center.x/24)}-${Math.floor(center.z/24)}`:'';
  const id=`runtime-${region}-${group.name}${cell}`;let owner=owners.get(id);if(!owner){owner={id,region,kind:'runtime-'+group.name,components:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],review:'pending'};owners.set(id,owner);}for(let k=0;k<3;k++){owner.min[k]=Math.min(owner.min[k],box.min.getComponent(k));owner.max[k]=Math.max(owner.max[k],box.max.getComponent(k));}
  const indices=new Uint32Array(g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i)),buffer=Buffer.concat([Buffer.from(positions.buffer),Buffer.from(colors.buffer),Buffer.from(indices.buffer)]);
  owner.components.push(components.length);components.push({id:components.length,owner:id,region,batch:m.name,count:p.count,indices:indices.length,offset,bytes:buffer.length,min:box.min.toArray(),max:box.max.toArray(),material:materials.map((x:any)=>({name:x.name,side:x.side,opacity:x.opacity})),visible:m.visible,ancestorVisibility:(()=>{let o=m;const a=[];while(o){a.push({name:o.name,visible:o.visible});o=o.parent;}return a;})()});buffers.push(buffer);offset+=buffer.length;
 });
 writeFileSync(`${dir}/construction.bin`,Buffer.concat(buffers));writeFileSync(`${dir}/inventory.json`,JSON.stringify({components,inventory:[...owners.values()]}));writeFileSync(`${dir}/review-items.json`,JSON.stringify([...owners.values()]));console.log(JSON.stringify({groups:groups.map(x=>x.name),owners:owners.size,components:components.length,bytes:offset}));
}finally{await h.close();}
