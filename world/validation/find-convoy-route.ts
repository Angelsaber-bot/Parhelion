import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {writeFileSync} from 'node:fs';
const h=await bootWorldWithoutGpu({deterministic:true});const w=h.world,q=w.combat.geometry;
const cache=new Map<string,number|null>();
function floor(x:number,z:number){const id=`${x},${z}`;if(cache.has(id))return cache.get(id)!;const g=q.ground(x,z);let y:number|null=g?.point.y??null;if(y!==null&&(y<1.05||y>16||Math.abs(g?.face?.normal.y??0)<.8||[-.9,0,.9].some(dx=>!q.clear({x:x+dx,y:y!+.04,z},.2,1.3))))y=null;cache.set(id,y);return y;}
const key=(x:number,z:number)=>`${x},${z}`,start=[40,-650],end=[36,-458],open=[{x:start[0],z:start[1],g:0,f:192}],scores=new Map([[key(...start as [number,number]),0]]),prev=new Map<string,string>();let result:string|null=null;
while(open.length){open.sort((a,b)=>b.f-a.f);const a=open.pop()!,id=key(a.x,a.z);if(scores.get(id)!<a.g)continue;if(a.x===end[0]&&a.z===end[1]){result=id;break;}const y=floor(a.x,a.z);if(y===null)continue;
 for(const[dx,dz]of[[2,0],[-2,0],[0,2],[0,-2]]){const x=a.x+dx,z=a.z+dz;if(x<0||x>120||z<-652||z>-456)continue;const b=floor(x,z);if(b===null||Math.abs(b-y)>.7)continue;
  let blocked=false;for(const side of[-.9,.9])if(q.cast({x:a.x+side,y:y+1,z:a.z},{x:dx,y:b-y,z:dz},2.3))blocked=true;if(blocked)continue;
  for(let j=1;j<10&&!blocked;j++){const px=a.x+dx*j/10,pz=a.z+dz*j/10,py=y+(b-y)*j/10,g=q.ground(px,pz,py+2);if(!g||Math.abs(g.point.y-py)>.5||[-.9,0,.9].some(side=>!q.clear({x:px+side,y:g.point.y+.04,z:pz},.2,1.3)))blocked=true;}
  if(blocked)continue;
  const g=a.g+2,id2=key(x,z);if(g>=(scores.get(id2)??Infinity))continue;scores.set(id2,g);prev.set(id2,id);open.push({x,z,g,f:g+Math.hypot(end[0]-x,end[1]-z)});
 }
}
if(!result)throw Error(`No convoy path: ${scores.size} nodes range ${Math.max(...[...scores.keys()].map(k=>Number(k.split(',')[1])))} end ${floor(end[0],end[1])}`);const path:number[][]=[];for(let id:string|undefined=result;id;id=prev.get(id)){const[x,z]=id.split(',').map(Number);path.push([x,floor(x,z)!,z]);}path.reverse();
writeFileSync('src/convoyRoute.ts',`/** Grounded medicine route audited against the shipped five-region collision. */\nexport const CONVOY_ROUTE:readonly [number,number,number][]=${JSON.stringify(path)};\n`);console.log(path.length);await h.close();
