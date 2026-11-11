import * as THREE from 'three';
import {Batch} from '../geo';
import type {Piece} from '../structures';
import type {ExpansionPlan,RoutePoint} from '../../../src/map/worldPlan';
import {ORLEANS_BASTILLE as BA,ORLEANS_BRIDGE_MILL as BM,ORLEANS_COUNTRY_LANES,ORLEANS_FIELDS,ORLEANS_GRANGE as GR,ORLEANS_SANDBARS,ORLEANS_SCORCH,ORLEANS_TOURELLES as TR,ORLEANS_VINEYARD as VY,ORLEANS_WINDMILL as WM,fieldAt,laneDistance} from '../../../src/map/orleansOutskirts';
import {ORLEANS_RIVER,riverDistance} from './landscape';
import {C,CYL,CONE,Frame,strip} from './craft';
import {ICO0,ICO1,Solid,blob,rod} from './kit';
import {buildBastille,buildBridgeMill,buildGrange,buildTourelles,buildVineyard,buildWindmill,type Anchors} from './landmarks';
import {T} from '../geo';

type Height=(x:number,z:number)=>number;
/** Ground already claimed by a second-ring landmark, field or lane (keeps scattered trees out). */
export function outskirtsOccupied(x:number,z:number):boolean{
  const near=(p:{x:number;z:number},r:number)=>Math.hypot(x-p.x,z-p.z)<r;
  if(near(TR,26)||near(VY,24)||near(GR,34)||near(WM,16)||near(BA,BA.half+12)||near(BM,16))return true;
  const k=ORLEANS_SCORCH,dx=x-k.x,dz=z-k.z,u=Math.cos(k.a)*dx-Math.sin(k.a)*dz,v=Math.sin(k.a)*dx+Math.cos(k.a)*dz;
  return Math.hypot(u/(k.rx+6),v/(k.rz+6))<1||!!fieldAt(x,z)||laneDistance(x,z)<6;
}
function densify(points:readonly RoutePoint[],step:number){
  const out:{x:number;y:number;z:number;tx:number;tz:number}[]=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1,n=Math.max(1,Math.ceil(len/step));
    for(let j=i===1?0:1;j<=n;j++){const t=j/n;out.push({x:a[0]+dx*t,y:a[1]+(b[1]-a[1])*t,z:a[2]+dz*t,tx:dx/len,tz:dz/len});}
  }
  return out;
}
/**
 * A road deck that stands clear of the ground gets something to stand on: an earth
 * levee where there is land beneath it, a pile trestle where it crosses water.
 */
function causeway(land:Batch,timber:Batch,points:readonly RoutePoint[],hw:number,h:Height,skip:(x:number,z:number)=>boolean){
  const s=densify(points,3).map(p=>({...p,g:h(p.x,p.z)}));
  // Low fills are earth; anything taller than a man and a half, or over water, stands on piles.
  const mode=s.map(p=>skip(p.x,p.z)?0:p.g<1.2||p.y-p.g>3.6?2:p.y-p.g>.3?1:0),world=new Frame(timber,0,0,0);
  for(let i=0;i<s.length;){
    if(mode[i]!==1){i++;continue;}
    let j=i;while(j+1<s.length&&mode[j+1]===1)j++;
    const bank=new Solid(),rows:{row:number[];nx:number;nz:number}[]=[];
    for(let k=Math.max(0,i-1);k<=Math.min(s.length-1,j+1);k++){
      const p=s[k],nx=-p.tz,nz=p.tx,gap=Math.max(0,p.y+.1-p.g),row:number[]=[];
      for(const sign of [-1,1]){
        const off=hw+gap*1.7+.8,ox=p.x+nx*sign*off,oz=p.z+nz*sign*off;
        row.push(bank.p(p.x+nx*sign*hw,p.y+.1,p.z+nz*sign*hw),bank.p(ox,Math.min(p.y,h(ox,oz))-.3,oz));
      }
      rows.push({row,nx,nz});
    }
    for(let k=1;k<rows.length;k++){
      const A=rows[k-1],B=rows[k];
      bank.quad(A.row[0],B.row[0],B.row[1],A.row[1],[-A.nx*.5,.85,-A.nz*.5]);bank.quad(A.row[2],B.row[2],B.row[3],A.row[3],[A.nx*.5,.85,A.nz*.5]);
    }
    // Close the fill where it hands over to the trestle, so no open end shows.
    for(const [edge,dir] of [[0,-1],[rows.length-1,1]] as const){
      const k=edge===0?Math.max(0,i-1):Math.min(s.length-1,j+1);if(mode[k]===0)continue;
      const R=rows[edge];bank.quad(R.row[1],R.row[0],R.row[2],R.row[3],[s[k].tx*dir,0,s[k].tz*dir]);
    }
    bank.emit(new Frame(land,0,0,0),C.turf);i=j+1;
  }
  for(let i=0;i<s.length;i++){
    if(mode[i]!==2)continue;
    const p=s[i],nx=-p.tz,nz=p.tx,f=new Frame(timber,p.x,0,p.z,Math.atan2(p.tx,p.tz)),foot=Math.min(p.g,0)-1.6;
    if(i%2===0){
      for(const sign of [-1,1]){f.box(sign*(hw+.25),(foot+p.y-.3)/2,0,.34,p.y-.3-foot,.34,C.wood);f.box(sign*(hw+.5),p.y+.58,0,.16,1.2,.16,C.oak,false);}
      f.box(0,p.y-.42,0,2*hw+1.3,.3,.4,C.wood);
      if(p.y-foot>5){
        const mid=(Math.max(p.g,.4)+p.y)/2;
        f.beam([-(hw+.25),Math.max(p.g,.4)+.6,0],[hw+.25,p.y-1,0],.16,C.oak);f.beam([hw+.25,Math.max(p.g,.4)+.6,0],[-(hw+.25),p.y-1,0],.16,C.oak);
        f.box(0,mid,0,2*hw+1.1,.22,.26,C.wood,false);
        // Raking shores brace the tall bents against the current.
        for(const sign of [-1,1])f.beam([sign*(hw+.25),p.y-1.2,0],[sign*(hw+2.9),foot,0],.26,C.wood);
      }
    }
    const q=s[i+1];if(!q||mode[i+1]!==2)continue;
    for(const sign of [-1,1]){
      const a=[p.x+nx*sign*(hw+.5),p.y,p.z+nz*sign*(hw+.5)],b=[q.x-q.tz*sign*(hw+.5),q.y,q.z+q.tx*sign*(hw+.5)];
      world.beam([a[0],a[1]+1.15,a[2]],[b[0],b[1]+1.15,b[2]],.14,C.oak,true);world.beam([a[0],a[1]+.6,a[2]],[b[0],b[1]+.6,b[2]],.08,C.wood);
      world.beam([p.x+nx*sign*(hw-.5),p.y-.2,p.z+nz*sign*(hw-.5)],[q.x-q.tz*sign*(hw-.5),q.y-.2,q.z+q.tx*sign*(hw-.5)],.24,C.wood);
    }
  }
  for(let i=0;i<s.length;){
    if(mode[i]!==2){i++;continue;}
    let j=i;while(j+1<s.length&&mode[j+1]===2)j++;
    // Planks run one bay past the last bent, onto the bank or the pier they land on.
    strip(timber,s.slice(Math.max(0,i-1),Math.min(s.length,j+2)).map(p=>[p.x,p.y+.02,p.z] as RoutePoint),2*hw+1.5,C.oak);
    i=j+1;
  }
}
/** A stone span with a solid spandrel: the soffit, both faces and the piers are real surfaces. */
function archSpan(f:Frame,z0:number,z1:number,hw:number,spring:number,top:number){
  const r=(z1-z0)/2,zc=(z0+z1)/2,n=12,body=new Solid(),soffit=new Solid(),A:number[][]=[[],[]],U:number[][]=[[],[]],S:number[][]=[[],[]];
  for(const [si,sx] of [-1,1].entries())for(let i=0;i<=n;i++){
    const a=i/n*Math.PI,z=zc-Math.cos(a)*r,y=spring+Math.sin(a)*r;A[si].push(body.p(sx*hw,y,z));U[si].push(body.p(sx*hw,top,z));S[si].push(soffit.p(sx*hw,y,z));
  }
  for(let i=0;i<n;i++){
    for(const [si,sx] of [-1,1].entries())body.quad(A[si][i],A[si][i+1],U[si][i+1],U[si][i],[sx,0,0]);
    const a=(i+.5)/n*Math.PI;soffit.quad(S[0][i],S[0][i+1],S[1][i+1],S[1][i],[0,-Math.sin(a),Math.cos(a)]);
    for(const sx of [-1,1]){
      const a0=i/n*Math.PI,a1=(i+1)/n*Math.PI;
      f.beam([sx*(hw+.07),spring+Math.sin(a0)*(r+.3),zc-Math.cos(a0)*(r+.3)],[sx*(hw+.07),spring+Math.sin(a1)*(r+.3),zc-Math.cos(a1)*(r+.3)],.56,i%2?C.pale:C.stone);
    }
  }
  body.emit(f,C.stone);soffit.emit(f,C.joint);
  for(const sx of [-1,1])f.box(sx*(hw+.1),spring+r+.5,zc,.4,1,.8,C.pale,false);
}
/** 东渡长桥: the old road's second crossing, east of the town, on a row of stone arches. */
function longBridge(b:Batch,access:readonly RoutePoint[],h:Height){
  let first=-1,last=-1;
  for(const [i,p] of access.entries())if(p[0]>40&&p[0]<240&&riverDistance(p[0],p[2])<60&&h(p[0],p[2])<p[1]-1){if(first<0)first=i;last=i;}
  if(first<0)return null;
  first=Math.max(0,first-2);last=Math.min(access.length-1,last+2);
  const a=access[first],e=access[last],deck=Math.min(...access.slice(first,last+1).map(p=>p[1])),dx=e[0]-a[0],dz=e[2]-a[2],L=Math.hypot(dx,dz);
  const f=new Frame(b,(a[0]+e[0])/2,0,(a[2]+e[2])/2,Math.atan2(dx,dz)),W=12.4,hw=W/2-.3,top=deck-.8,n=Math.max(2,Math.round(L/13.2)),s=L/n,pt=2.6,r=(s-pt)/2,spring=top-.7-r;
  f.box(0,top+.35,0,W,.7,L+4,C.stone);
  for(const side of [-1,1]){
    f.box(side*(W/2-.3),deck+.45,0,.6,1.1,L+4,C.pale);f.box(side*(W/2-.3),deck+1.06,0,.82,.14,L+4,C.joint,false);
    f.box(side*(W/2+.06),top-.12,0,.22,.3,L+4,C.pale,false);
  }
  for(let i=0;i<=n;i++){
    const z=-L/2+i*s,p=f.point(0,0,z),bed=Math.min(h(p.x,p.z),...[-1,1].map(o=>{const q=f.point(o*hw,0,z);return h(q.x,q.z);}))-1.4;
    f.box(0,(bed+top)/2,z,2*hw,top-bed,pt,C.stone);
    if(bed>spring-2)continue; // abutments on the banks need no cutwater
    for(const side of [-1,1]){
      const c=new Solid(),P=[[side*hw,z-pt/2-.3],[side*hw,z+pt/2+.3],[side*(hw+3.2),z]],hi=spring+.9,lo=P.map(([x,zz])=>c.p(x,bed,zz)),up=P.map(([x,zz])=>c.p(x,hi,zz)),tip=c.p(side*hw,hi+1.6,z);
      c.quad(lo[0],lo[2],up[2],up[0],[side,0,-1]);c.quad(lo[1],lo[2],up[2],up[1],[side,0,1]);
      c.tri(up[0],up[2],tip,[side,1,-1]);c.tri(up[1],up[2],tip,[side,1,1]);c.emit(f,C.joint);
      f.box(side*(hw+.22),(hi+1.6+deck+1)/2,z,.44,deck+1-hi-1.6,pt-.8,C.joint,false);
    }
  }
  for(let i=0;i<n;i++)archSpan(f,-L/2+i*s+pt/2,-L/2+(i+1)*s-pt/2,hw,spring,top);
  // A wayside cross on the town end marks the old ferry landing the bridge replaced.
  const end=f.point(W/2+2.2,0,L/2+1),ey=h(end.x,end.z),cross=new Frame(b,end.x,ey,end.z,f.a);
  cross.box(0,.3,0,1.6,.6,1.6,C.stone);cross.box(0,.85,0,1.1,.5,1.1,C.joint);cross.box(0,2.6,0,.3,3,.3,C.pale);cross.box(0,3.5,0,1.5,.3,.3,C.pale,false);
  return {from:[a[0],deck,a[2]] as RoutePoint,to:[e[0],deck,e[2]] as RoutePoint,spans:n,length:L};
}

export function buildOrleansOutskirts(plan:ExpansionPlan,h:Height,access:readonly RoutePoint[]):Piece[]{
  const pieces:Piece[]=[],make=(name:string,material='M_OrleansCraft',outline=true)=>{const b=new Batch(`orleans_${name}`,material);pieces.push({name:b.name,material,batch:b,outline});return b;};
  const land=make('Levees','M_OrleansCraft',false),lanesBatch=make('CountryLanes','M_OrleansCraft',false),trestles=make('RiverTrestles'),bridge=make('LongBridge');
  const fort=make('Tourelles'),mill=make('BridgeMill'),vines=make('VineyardPress'),farm=make('ScorchedGrange'),tower=make('Windmill'),siege=make('SiegeBastille'),cloth=make('SiegeCloth','M_OrleansCraft',false);
  const dressing=make('Countryside'),foliage=make('CountrysideFoliage','M_Foliage',false),glow=make('OutskirtsLamps','M_Emissive',false);
  const anchors:Anchors={};
  // The riverfront loop leaves the town across the water and along the west spit.
  const loop=plan.routes.find(r=>r.id==='riverfront')!.points.slice(4);
  const pier=(x:number,z:number)=>{const dx=x-BM.x,dz=z-BM.z,lx=Math.cos(BM.yaw)*dx-Math.sin(BM.yaw)*dz,lz=Math.sin(BM.yaw)*dx+Math.cos(BM.yaw)*dz;return Math.abs(lx)<7.4&&lz>-8.2&&lz<16;};
  causeway(land,trestles,loop,2.5,h,pier);
  const crossing=longBridge(bridge,access,h);
  buildTourelles(fort,glow,h,anchors);buildBridgeMill(mill,glow,anchors);buildVineyard(vines,foliage,h,anchors);
  buildGrange(farm,foliage,glow,h,anchors);buildWindmill(tower,h);buildBastille(siege,cloth,glow,h,anchors);
  // Country lanes: bare earth draped on the ground, the same line the ground is painted along.
  const lanes=ORLEANS_COUNTRY_LANES.map(lane=>{
    const curve=new THREE.CatmullRomCurve3(lane.points.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
    const points=curve.getSpacedPoints(Math.ceil(curve.getLength()/1.5)).map(p=>[p.x,h(p.x,p.z),p.z] as RoutePoint);
    strip(lanesBatch,points.map(p=>[p[0],p[1]+.07,p[2]] as RoutePoint),2.8,'#a8976f',false);
    return {id:lane.id,name:lane.name,points};
  });
  // Lombardy-style poplars line the lanes and the old road: the tall, narrow trees of the valley.
  const sites=[TR,VY,GR,WM,BA,BM],roadLines=[...plan.routes.map(r=>r.points.map(p=>[p[0],p[2]] as const)),access.map(p=>[p[0],p[2]] as const)];
  const roadDistance=(x:number,z:number)=>{let d=Infinity;for(const line of roadLines)for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],ex=b[0]-a[0],ez=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*ex+(z-a[1])*ez)/(ex*ex+ez*ez||1)));d=Math.min(d,Math.hypot(x-a[0]-ex*t,z-a[1]-ez*t));}return d;};
  let count=0;
  const poplar=(x:number,z:number)=>{
    if(Math.abs(x)>345||Math.abs(z)>345||riverDistance(x,z)<34||fieldAt(x,z)||laneDistance(x,z)<3.2||roadDistance(x,z)<6.5||sites.some(s=>Math.hypot(x-s.x,z-s.z)<(s===BA?BA.half+6:s===GR?16:13)))return;
    const y=h(x,z);if(y<3)return;
    const hh=9+(count%4)*1.3,w=1.35+(count%3)*.15;
    dressing.add(CYL,C.wood,T(x,y+1.6,z,0,.3,3.6,.3));
    blob(foliage,x,y+3+hh*.5,z,w,hh*.55,w,count%2?'#6f8f52':'#7d9a58',ICO1,count);blob(foliage,x+.2,y+3+hh*.92,z-.1,w*.6,hh*.24,w*.6,count%2?'#7d9a58':'#8aa55f',ICO0,count);
    count++;
  };
  for(const lane of lanes){
    let run=7,side=1;
    for(let i=1;i<lane.points.length;i++){
      const a=lane.points[i-1],b=lane.points[i],len=Math.hypot(b[0]-a[0],b[2]-a[2]);run+=len;
      if(run<15)continue;run=0;side=-side;poplar(b[0]-(b[2]-a[2])/len*side*4.4,b[2]+(b[0]-a[0])/len*side*4.4);
    }
  }
  for(let i=6;i<access.length-1;i+=8){
    const a=access[i],b=access[i+1],len=Math.hypot(b[0]-a[0],b[2]-a[2])||1;if(riverDistance(a[0],a[2])<52)continue;
    for(const side of [-1,1])if((i/8+(side>0?1:0))%2===0)poplar(a[0]-(b[2]-a[2])/len*side*9.5,a[2]+(b[0]-a[0])/len*side*9.5);
  }
  // Hedgerows close the open fields; gaps are left where a lane or road passes.
  for(const fd of ORLEANS_FIELDS.filter(v=>v.crop!=='vine')){
    const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([su,sv])=>{const u=su*(fd.w/2+1.4),v=sv*(fd.d/2+1.4);return [fd.x+Math.cos(fd.a)*u+Math.sin(fd.a)*v,fd.z-Math.sin(fd.a)*u+Math.cos(fd.a)*v];});
    for(let k=0;k<4;k++){
      const a=corners[k],b=corners[(k+1)%4],len=Math.hypot(b[0]-a[0],b[1]-a[1]),m=Math.round(len/2.3);
      for(let j=0;j<m;j++){
        const x=a[0]+(b[0]-a[0])*j/m,z=a[1]+(b[1]-a[1])*j/m;
        if(laneDistance(x,z)<4.5||roadDistance(x,z)<8||riverDistance(x,z)<36||(j*5+k*3)%17===0||Math.abs(x)>350||Math.abs(z)>350)continue;
        blob(foliage,x,h(x,z)+.75,z,1.5,.95+(j%3)*.15,1.15,j%2?'#6c8a50':'#7b9658',ICO0,j);
      }
    }
    if(fd.crop==='wheat')for(const [u,v] of [[-.25,-.2],[.2,.25],[.3,-.3]]){
      const x=fd.x+Math.cos(fd.a)*u*fd.w+Math.sin(fd.a)*v*fd.d,z=fd.z-Math.sin(fd.a)*u*fd.w+Math.cos(fd.a)*v*fd.d;
      if(laneDistance(x,z)<5||Math.hypot(x-GR.x,z-GR.z)<40)continue;
      const y=h(x,z);dressing.add(CYL,C.hay,T(x,y+.85,z,0,1.9,1.7,1.9));dressing.add(CONE,'#bfa55c',T(x,y+2.75,z,0,2.05,2.1,2.05),false);
    }
  }
  // Reed beds on the wet margins and the sandbanks; a beached punt and driftwood on the widest bar.
  let reeds=0;
  const reed=(x:number,z:number)=>{
    const y=h(x,z);if(y<.2||y>3.2||roadDistance(x,z)<7||Math.hypot(x-BM.x,z-BM.z)<16)return;
    for(let k=0;k<5;k++){
      const t=k*1.9+reeds,ox=Math.sin(t)*.55,oz=Math.cos(t*1.3)*.55,hh=1.7+(k%3)*.45;
      foliage.add(CONE,k%2?'#8fa25c':'#a3ad68',T(x+ox,y+hh/2-.1,z+oz,0,.13,hh,.13),false);
      if(k%2===0)foliage.add(CYL,'#7a5a3c',T(x+ox,y+hh-.2,z+oz,0,.07,.5,.07),false);
    }
    reeds++;
  };
  for(let i=4;i<ORLEANS_RIVER.length-4;i+=3){
    const p=ORLEANS_RIVER[i],q=ORLEANS_RIVER[i+1],len=Math.hypot(q[0]-p[0],q[1]-p[1])||1,nx=-(q[1]-p[1])/len,nz=(q[0]-p[0])/len;
    for(const side of [-1,1])if((i/3+(side>0?1:0))%2<1){const off=17.5+(i%4)*.6;reed(p[0]+nx*side*off,p[1]+nz*side*off);}
  }
  for(const bar of ORLEANS_SANDBARS)for(const [u,v] of [[-.55,.1],[-.2,-.25],[.25,.2],[.6,-.05]])reed(bar.x+Math.cos(bar.a)*u*bar.rx+Math.sin(bar.a)*v*bar.rz,bar.z-Math.sin(bar.a)*u*bar.rx+Math.cos(bar.a)*v*bar.rz);
  {
    const bar=ORLEANS_SANDBARS[0],y=h(bar.x,bar.z),punt=new Frame(dressing,bar.x+4,y+.12,bar.z,1.2);
    punt.box(0,.18,0,1.5,.12,5.2,C.oak,false);for(const s of [-1,1])punt.box(s*.75,.42,0,.1,.5,5.2,C.wood,false);for(const z of [-2.6,2.6])punt.box(0,.42,z,1.5,.5,.1,C.wood,false);
    punt.beam([.4,.5,-2],[1.6,.2,3.4],.06,C.wood);
    rod(dressing,[bar.x-9,y+.2,bar.z+1],[bar.x-4.5,y+.35,bar.z-.4],.2,'#8b7d68');rod(dressing,[bar.x-6.5,y+.3,bar.z+.3],[bar.x-5.6,y+1.1,bar.z+1.2],.07,'#8b7d68');
  }
  pieces.find(p=>p.batch===lanesBatch)!.userData={outskirts:{lanes,anchors,longBridge:crossing,poplars:count,reedBeds:reeds}};
  return pieces.filter(p=>p.batch.vis.length>0);
}
