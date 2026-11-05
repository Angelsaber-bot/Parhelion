import {readFileSync,writeFileSync} from 'node:fs';
const dir=process.argv[2]??'/tmp/parhelion-exhaustive',d=JSON.parse(readFileSync(`${dir}/inventory.json`,'utf8')),bin=readFileSync(`${dir}/construction.bin`);
const issues:any[]=[],stats:any={components:0,triangles:0,nonFinite:0,invertedClosed:0,degenerate:0,degenerateByType:{},byType:{}};
for(const c of d.components){
 const positions=new Float32Array(bin.buffer,bin.byteOffset+c.offset,c.count*3),indices=new Uint32Array(bin.buffer,bin.byteOffset+c.offset+c.count*24,c.indices),o=c.min.map((v:number,i:number)=>(v+c.max[i])/2);
 let vol=0,degenerate=0;
 for(let k=0;k<indices.length;k+=3){const a=indices[k]*3,b=indices[k+1]*3,e=indices[k+2]*3;
  const ax=positions[a]-o[0],ay=positions[a+1]-o[1],az=positions[a+2]-o[2],bx=positions[b]-o[0],by=positions[b+1]-o[1],bz=positions[b+2]-o[2],cx=positions[e]-o[0],cy=positions[e+1]-o[1],cz=positions[e+2]-o[2];
  const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az,cross=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
  if(cross.every(v=>v===0))degenerate++;
  vol+=(ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;
 }
 for(const v of positions)if(!Number.isFinite(v))stats.nonFinite++;
 const p=c.parameters,closed=c.type==='BoxGeometry'||c.type==='ExtrudeGeometry'||(c.type==='CylinderGeometry'&&p&&!p.openEnded&&(p.thetaLength??Math.PI*2)>=Math.PI*2-1e-6)||(c.type==='ConeGeometry'&&p&&!p.openEnded);
 if(closed&&vol<-1e-8){issues.push({component:c.id,owner:c.owner,batch:c.batch,type:c.type,parameters:p,volume:vol,source:c.source});stats.invertedClosed++;}
 if(degenerate){stats.degenerate+=degenerate;stats.degenerateByType[c.type]=(stats.degenerateByType[c.type]??0)+degenerate;}
 stats.byType[c.type]=(stats.byType[c.type]??0)+1;stats.components++;stats.triangles+=c.indices/3;
}
writeFileSync(`${dir}/geometry-findings.json`,JSON.stringify({stats,issues},null,2));console.log(JSON.stringify(stats));console.log('inverted samples',JSON.stringify(issues.slice(0,18),null,2));
