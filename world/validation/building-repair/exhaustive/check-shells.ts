/** Exhaustive per-instance shell checks over all surviving source primitives. */
import{readFileSync,writeFileSync}from'node:fs';
const root=process.argv[2]??'/tmp/parhelion-exhaustive-after',d=JSON.parse(readFileSync(root+'/inventory.json','utf8')),bin=readFileSync(root+'/construction.bin');
let checked=0,roofs=0;const issues:any[]=[];
function check(c:any){const p=new Float32Array(bin.buffer,bin.byteOffset+c.offset,c.count*3),ix=new Uint32Array(bin.buffer,bin.byteOffset+c.offset+c.count*24,c.indices),edges=new Map<string,{count:number;direction:number}>();
 const vertex=(i:number)=>[p[ix[i]*3],p[ix[i]*3+1],p[ix[i]*3+2]].map(x=>Math.round(x*1e5)).join(',');
 for(let i=0;i<ix.length;i+=3){const a=[0,1,2].map(j=>vertex(i+j));if(new Set(a).size<3)continue;for(let j=0;j<3;j++){const x=a[j],y=a[(j+1)%3],k=x<y?`${x}|${y}`:`${y}|${x}`,old=edges.get(k)??{count:0,direction:0};old.count++;old.direction+=x<y?1:-1;edges.set(k,old);}}
 const bad=[...edges.values()].filter(x=>x.count!==2||x.direction!==0);if(bad.length)issues.push({component:c.id,owner:c.owner,type:c.type,source:c.source,badEdges:bad.length,parameters:c.parameters});checked++;
}
for(const c of d.components){const p=c.parameters;
 if(c.type==='BoxGeometry'||c.type==='ExtrudeGeometry'||((c.type==='CylinderGeometry'||c.type==='ConeGeometry')&&p&&!p.openEnded&&(p.thetaLength??Math.PI*2)>Math.PI*2-1e-6))check(c);
}
for(const rec of d.records.filter((r:any)=>r.name==='addKyotoRoof')){const first=d.components.find((c:any)=>c.scope?.includes(rec.id));if(first){roofs++;check(first);}}
const report={checkedClosedComponents:checked,kyotoRoofInstances:roofs,issues};writeFileSync(root+'/shell-findings.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,issues:issues.slice(0,8)},null,2));
