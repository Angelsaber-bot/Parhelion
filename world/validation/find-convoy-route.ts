import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {writeFileSync} from 'node:fs';
import {medicineCartPathClear,cartBodyClear} from '../src/story/medicineCartNavigation';
import {CONVOY_ROUTE} from '../src/story/convoyRoute';
const h=await bootWorldWithoutGpu({deterministic:true});const w=h.world,local=w.combat.geometry.contactSurface({minX:-5,maxX:125,minZ:-657,maxZ:-451}),q={...local,clear:(p:any,r:number,h:number)=>cartBodyClear(local,p,r,h)};
const cache=new Map<string,number|null>();
function floor(x:number,z:number){const id=`${x},${z}`;if(cache.has(id))return cache.get(id)!;const g=q.ground(x,z);let y:number|null=g?.point.y??null;if(y!==null&&(y<1.05||y>16||Math.abs(g?.face?.normal.y??0)<.8||!q.clear({x,y:y!+.04,z},1.6,1.4)))y=null;cache.set(id,y);return y;}
const key=(x:number,z:number)=>`${x},${z}`,start=[40,-650],end=[36,-458],open=[{x:start[0],z:start[1],g:0,f:192}],scores=new Map([[key(...start as [number,number]),0]]),prev=new Map<string,string>();let result:string|null=null;
while(open.length){open.sort((a,b)=>b.f-a.f);const a=open.pop()!,id=key(a.x,a.z);if(scores.get(id)!<a.g)continue;if(a.x===end[0]&&a.z===end[1]){result=id;break;}const y=floor(a.x,a.z);if(y===null)continue;
 for(const[dx,dz]of[[2,0],[-2,0],[0,2],[0,-2]]){const x=a.x+dx,z=a.z+dz;if(x<0||x>120||z<-652||z>-456)continue;const b=floor(x,z);if(b===null||Math.abs(b-y)>.7)continue;
  const blocked=!medicineCartPathClear(q,[a.x,y,a.z],[x,b,z]);
  if(blocked)continue;
  const g=a.g+2,id2=key(x,z);if(g>=(scores.get(id2)??Infinity))continue;scores.set(id2,g);prev.set(id2,id);open.push({x,z,g,f:g+Math.hypot(end[0]-x,end[1]-z)});
 }
}
if(!result)throw Error(`No convoy path: ${scores.size} nodes range ${Math.max(...[...scores.keys()].map(k=>Number(k.split(',')[1])))} end ${floor(end[0],end[1])}`);const path:number[][]=[];for(let id:string|undefined=result;id;id=prev.get(id)){const[x,z]=id.split(',').map(Number);path.push([x,floor(x,z)!,z]);}path.reverse();
// Keep checkpoint numbers compatible with saves on the original medicine route.
// Remove only collinear nodes, then subdivide straight segments without cutting corners.
for(let i=path.length-2;i>0;i--){const a=path[i-1],b=path[i],c=path[i+1];if(Math.abs((b[0]-a[0])*(c[2]-b[2])-(b[2]-a[2])*(c[0]-b[0]))<1e-8)path.splice(i,1);}
if(path.length>CONVOY_ROUTE.length)throw Error('Route requires more turns than the saved checkpoint budget');
while(path.length<CONVOY_ROUTE.length){let best=1;for(let i=2;i<path.length;i++)if(Math.hypot(path[i][0]-path[i-1][0],path[i][2]-path[i-1][2])>Math.hypot(path[best][0]-path[best-1][0],path[best][2]-path[best-1][2]))best=i;const a=path[best-1],b=path[best],x=(a[0]+b[0])/2,z=(a[2]+b[2])/2,y=floor(x,z);if(y===null)throw Error('Subdivision lost cart support');path.splice(best,0,[x,y,z]);}

for(let leg=0;leg<path.length-1;leg++)for(let i=0;i<=100;i++){
 const a=path[leg],b=path[leg+1],t=i/100,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t,g=q.ground(x,z,y+2);
 if(!g||Math.abs(g.point.y-y)>.6||[-.9,.9].some(dx=>!q.clear({x:x+dx,y:g.point.y+.04,z},.15,1.3)))throw Error(`Cart clearance failed at ${leg}/${i}`);
}
writeFileSync(new URL('../src/story/convoyRoute.ts',import.meta.url),`/** Grounded medicine route audited against the shipped five-region collision. */\nexport const CONVOY_ROUTE:readonly [number,number,number][]=${JSON.stringify(path)};\n`);console.log(path.length);await h.close();
