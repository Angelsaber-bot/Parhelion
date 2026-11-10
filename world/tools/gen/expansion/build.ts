import { orleansAuthoredHeight, orleansTerrainColor, riverDistance,orleansTerrainOpening } from '../orleans/landscape';
import { buildOrleans } from '../orleans/build';
import { continentalHeight } from '../continent';
import * as THREE from 'three';
import type { Layout, Marker } from '../../../src/core/types';
import { EXPANSION_CONNECTIONS, distanceToLine, type ExpansionPlan, type RoutePoint } from '../../../src/map/worldPlan';
import { Batch, T, distToSegment } from '../geo';
import type { Piece } from '../structures';
import { heightFn as britainHeight } from '../britain/terrain';
import { heightFn as winterHeight } from '../winter/terrain';
import { heightFn as kyotoHeight } from '../kyoto/terrain';

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
export const QIN_EXCAVATION = {x0:-110,x1:110,z0:-150,z1:140};
const inExcavation=(x:number,z:number)=>x>QIN_EXCAVATION.x0&&x<QIN_EXCAVATION.x1&&z>QIN_EXCAVATION.z0&&z<QIN_EXCAVATION.z1;
const oldHeight=(id:string,x:number,z:number)=>id==='britain'?britainHeight(x+720,z):id==='winter'?winterHeight(x,z+720):kyotoHeight(x,z-720);

export function expansionHeight(plan:ExpansionPlan,x:number,z:number):number {
  if(plan.id==='orleans')return continentalHeight(plan.id,x,z,orleansAuthoredHeight(plan,x,z));
  let y=plan.id==='qin'?24:14;
  const wave=Math.sin(x*.018+1)*Math.cos(z*.023)*3+Math.sin((x+z)*.034)*1.2;
  y+=wave;
  if(plan.id==='egypt') {
    y+=26*Math.exp(-Math.pow((x+185)/35,2))*Math.exp(-Math.pow((z+70)/145,2));
    y+=(30-14)*(1-smooth((Math.hypot(x-80,z+140)-65)/70));
    y+=(24-14)*(1-smooth((Math.hypot(x-80,z-20)-50)/65));
    y=y*(smooth((Math.hypot(x+225,z-110)-13)/16))-2*(1-smooth((Math.hypot(x+225,z-110)-13)/16));
  } else {
    y+=40*(1-smooth((Math.max(Math.abs(x),Math.abs(z+10))-170)/100));
  }
  // Broad, gently graded approaches to every hub and landmark, except the elevated
  // ramparts and the underground chambers, whose supports belong to architecture.
  for(const site of plan.sites) {
    if((plan.id==='qin'&&['workshop','army','royalcity'].includes(site.id))||site.id==='ramparts')continue;
    const d=Math.hypot(x-site.position[0],z-site.position[2]);
    y=THREE.MathUtils.lerp(y,site.position[1],1-smooth((d-site.radius*.6)/22));
  }
  for(const route of plan.routes.filter(r=>r.kind==='main'||r.kind==='flank'))for(let i=1;i<route.points.length;i++) {
    const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[2]-a[2];
    const t=clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1));
    const d=distToSegment(x,z,[a[0],a[2]],[b[0],b[2]]);
    y=THREE.MathUtils.lerp(y,THREE.MathUtils.lerp(a[1],b[1],t),1-smooth((d-5)/10));
  }
  return continentalHeight(plan.id,x,z,y);
}

/** Roads follow the continuous continental terrain between authored settlements. */
export function connectionRoute(plan:ExpansionPlan):RoutePoint[] {
  const link=EXPANSION_CONNECTIONS.find(c=>c.to===plan.id)!;
  const samples:[number,number][]=[];
  for(let s=1;s<link.points.length;s++) {
    const a=link.points[s-1],b=link.points[s],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);
    for(let i=s===1?0:1;i<=n;i++)samples.push([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]);
  }
  const heights=samples.map(([x,z])=>{
    const source=link.from==='britain'?Math.abs(x+720)<=360&&Math.abs(z)<=360:link.from==='winter'?Math.abs(x)<=360&&Math.abs(z+720)<=360:Math.abs(x)<=360&&Math.abs(z-720)<=360;
    const y=source?oldHeight(link.from,x,z)+.2:expansionHeight(plan,x-plan.offset[0],z-plan.offset[1])+.1;
    return plan.id==='orleans'&&riverDistance(x-plan.offset[0],z-plan.offset[1])<65?Math.max(14.2,y):y;
  });
  // Minimal 0.5-grade envelope above the existing terrain, in two linear passes.
  // This clears mountain ridges without stair-like jumps or a steep final descent.
  const distance=(i:number,j:number)=>Math.hypot(samples[i][0]-samples[j][0],samples[i][1]-samples[j][1]);
  for(let i=1;i<heights.length;i++)heights[i]=Math.max(heights[i],heights[i-1]-.5*distance(i,i-1));
  for(let i=heights.length-2;i>=0;i--)heights[i]=Math.max(heights[i],heights[i+1]-.5*distance(i,i+1));
  return samples.map(([x,z],i)=>[x-plan.offset[0],heights[i],z-plan.offset[1]]);
}

export function buildExpansion(plan:ExpansionPlan) {
  const access=connectionRoute(plan);
  const link=EXPANSION_CONNECTIONS.find(c=>c.to===plan.id)!;
  // Production tiles meet at exactly ±360. Outlines describe regional character,
  // never a hole in the shared ground or an interior coastline.
  const mask=(x:number,z:number)=>x>=-360&&x<=360&&z>=-360&&z<=360;
  const accessHeight=(x:number,z:number)=>expansionHeight(plan,x,z);
  const cell=2,x0=-360,z0=-360,x1=360,z1=360;
  const nx=(x1-x0)/cell+1,nz=(z1-z0)/cell+1,pos:number[]=[],colors:number[]=[],idx:number[]=[],vertices=new Map<number,number>();
  const base=new THREE.Color(plan.color),rock=new THREE.Color(plan.stone),c=new THREE.Color();
  const vertex=(i:number,j:number)=>{
    const k=j*nx+i,existing=vertices.get(k);if(existing!==undefined)return existing;
    const x=x0+i*cell,z=z0+j*cell,y=accessHeight(x,z),v=pos.length/3;vertices.set(k,v);pos.push(x,y,z);
    c.copy(base).lerp(rock,smooth((y-(plan.id==='qin'?40:28))/35)*.65).multiplyScalar(1+.035*Math.sin(x*.2)*Math.cos(z*.17));
    if(plan.id==='orleans')c.copy(orleansTerrainColor(plan,x,y,z));
    colors.push(c.r,c.g,c.b);return v;
  };
  for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++) {
    const x=x0+i*cell,z=z0+j*cell;
    if(![[x,z],[x+cell,z],[x,z+cell],[x+cell,z+cell]].every(([px,pz])=>mask(px,pz)))continue;
    if(plan.id==='orleans'&&orleansTerrainOpening(x+cell/2,z+cell/2))continue;
    if(plan.id==='qin'&&inExcavation(x+cell/2,z+cell/2))continue;
    const a=vertex(i,j),b=vertex(i+1,j),cc=vertex(i,j+1),d=vertex(i+1,j+1);idx.push(a,cc,b,b,cc,d);
  }
  if(plan.id==='qin') {
    // Keep the shaft open, but give the terrain/map sampler its actual dry floor.
    // Separate vertices prevent triangles joining the bottom directly to the surface rim.
    const floorVertices=new Map<string,number>(),floorColor=new THREE.Color(plan.stone);
    const floorVertex=(x:number,z:number)=>{const key=`${x},${z}`,old=floorVertices.get(key);if(old!==undefined)return old;const v=pos.length/3;floorVertices.set(key,v);pos.push(x,10,z);colors.push(floorColor.r,floorColor.g,floorColor.b);return v;};
    for(let z=-148;z<138;z+=cell)for(let x=-108;x<108;x+=cell) {
      const a=floorVertex(x,z),b=floorVertex(x+cell,z),c=floorVertex(x,z+cell),d=floorVertex(x+cell,z+cell);idx.push(a,c,b,b,c,d);
    }
  }
  const vis=new THREE.BufferGeometry();vis.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));vis.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));vis.setIndex(idx);vis.computeVertexNormals();
  const col=new THREE.BufferGeometry();col.setAttribute('position',vis.attributes.position.clone());col.setIndex(idx);
  const pieces:Piece[]=[];
  const batch=(name:string,color:string=plan.stone)=>{const b=new Batch(`${plan.id}_${name}`);pieces.push({name:b.name,material:'M_Toon',batch:b,outline:true});return {b,color};};
  const roads=batch('Routes',plan.id==='egypt'?'#e6cf9d':plan.id==='orleans'?'#b0a17f':'#b9af94');
  const ribbon=(points:readonly RoutePoint[],width:number,color:string)=>{
    const edges=points.map((p,i)=>{
      const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz)||1;
      return {l:[p[0]-dz/length*width/2,p[1]+.1,p[2]+dx/length*width/2],r:[p[0]+dz/length*width/2,p[1]+.1,p[2]-dx/length*width/2]};
    });
    const vertices:number[]=[];
    const triangle=(a:number[],b:number[],c:number[])=>vertices.push(...a,...b,...c);
    for(let i=1;i<edges.length;i++) {
      const a=edges[i-1],b=edges[i];
      triangle(a.l,b.l,a.r);triangle(a.r,b.l,b.r);
      // One uninterrupted top; end faces between adjacent ramp pieces snag a capsule.
      const lower=(v:number[])=>[v[0],v[1]-.4,v[2]];
      triangle(a.l,lower(a.l),b.l);triangle(b.l,lower(a.l),lower(b.l));
      triangle(a.r,b.r,lower(a.r));triangle(b.r,lower(b.r),lower(a.r));
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));roads.b.add(g,color,new THREE.Matrix4());g.dispose();
  };
  for(const route of plan.routes)ribbon(route.points,plan.id==='orleans'&&route.kind==='underground'?4.8:route.kind==='main'||route.kind==='underground'?7:5,route.kind==='high'?(plan.id==='orleans'?'#c7b99b':plan.accent):roads.color);
  ribbon(access,plan.id==='orleans'?9:link.width-2,roads.color);
  if(plan.id==='orleans'){
    // Feather the raised bridge approach into the town's ground-level lanes.
    // A vertical ribbon edge, even a small one, snags a capsule crossing obliquely.
    for(let i=1;i<access.length;i++){
      const a=access[i-1],b=access[i],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1;
      if(riverDistance(a[0],a[2])<38||riverDistance(b[0],b[2])<38)continue;
      for(const side of [-1,1]){
        const edge=(p:RoutePoint,d:number)=>[p[0]-dz/len*d*side,p[2]+dx/len*d*side];
        const ai=edge(a,4.5),ao=edge(a,8),bi=edge(b,4.5),bo=edge(b,8);
        const v=[ai[0],a[1]+.1,ai[1],ao[0],accessHeight(ao[0],ao[1])+.06,ao[1],bi[0],b[1]+.1,bi[1],bo[0],accessHeight(bo[0],bo[1])+.06,bo[1]];
        const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(v,3));
        g.setIndex(side===1?[0,1,2,1,3,2]:[0,2,1,1,2,3]);roads.b.add(g,roads.color,new THREE.Matrix4());g.dispose();
      }
    }
  }
  const architecture=batch('Architecture');
  const b=architecture.b;
  const cylinder=new THREE.CylinderGeometry(1,1,1,12);
  const column=(x:number,y:number,z:number,r:number,h:number,color:string)=>b.add(cylinder,color,T(x,y+h/2,z,0,r,h,r));
  const slab=(x:number,y:number,z:number,w:number,d:number,color=plan.stone)=>b.box(x,y-.5,z,w,.6,d,color);
  const house=(x:number,y:number,z:number,w=12,d=12)=>{
    slab(x,y,z,w,d);b.box(x-w/2+.4,y,z,.8,7,d,plan.stone);b.box(x+w/2-.4,y,z,.8,7,d,plan.stone);b.box(x,y,z-d/2+.4,w,7,.8,plan.stone);
    slab(x,y+7.5,z,w+1,d+1,plan.accent);
  };
  for(const site of plan.sites.filter(s=>plan.id!=='orleans'&&(s.purpose==='hub'||s.purpose==='arena'))) {
    const [x,y,z]=site.position;slab(x,y,z,site.radius*1.1,site.radius*.8);
    if(site.purpose==='hub') {
      const lines=[...plan.routes.map(r=>r.points),access];let placed=0;
      for(const [dx,dz] of [[-34,0],[34,0],[0,34],[0,-34],[-34,-34],[-34,34],[34,-34],[34,34]]) {
        if(lines.some(line=>distanceToLine(x+dx,z+dz,line.map(p=>[p[0],p[2]] as const))<18))continue;
        house(x+dx,y,z+dz,14,12);if(++placed>=3)break;
      }
    }
    else if(plan.id!=='qin')for(const dx of [-13,0,13])column(x+dx,y,z+10,.6,3,plan.accent);
  }
  if(plan.id==='orleans') {
    pieces.push(...buildOrleans(plan,(x,z)=>expansionHeight(plan,x,z),access));
  } else if(plan.id==='egypt') {
    // Two sculptural colossi, with the east one's shoulder aligned to the high route.
    for(const x of [30,130]) {
      slab(x,24,-22,22,24);b.box(x-5,24,-18,5,15,7,plan.stone);b.box(x+5,24,-18,5,15,7,plan.stone);
      b.box(x,36,-25,17,13,10,plan.stone);b.box(x,49,-25,9,10,9,plan.stone);slab(x,44,-18,23,16);
      b.add(new THREE.ConeGeometry(6,9,4),plan.accent,T(x,62,-25,Math.PI/4));
    }
    slab(80,30,-140,100,82);slab(80,44,-100,105,18);
    for(const x of [38,58,102,122])for(const z of [-115,-160])column(x,30,z,2.4,18,plan.stone);
    b.box(28,30,-145,3,14,76,plan.stone);b.box(132,30,-145,3,14,76,plan.stone);b.box(80,30,-181,105,20,3,plan.stone);
    const lens=batch('SunMirrors',plan.accent);
    for(const [x,y,z] of [[-20,14,75],[92,24,20],[92,44,-106]]){column(x,y,z,1,4,plan.stone);lens.b.add(new THREE.CylinderGeometry(3,3,.5,16),plan.accent,T(x,y+5,z,0,1,1,1,Math.PI/3),false);}
    const palms=batch('OasisPalms','#597e51');
    for(let i=0;i<9;i++){const a=i*Math.PI*2/9,x=-225+Math.cos(a)*35,z=110+Math.sin(a)*35,y=expansionHeight(plan,x,z);palms.b.add(cylinder,'#8c7050',T(x,y+5,z,0,.6,10,.6));for(let j=0;j<5;j++)palms.b.add(new THREE.ConeGeometry(2,9,3),palms.color,T(x,y+10,z,j*1.256,1,1,1,1.15),false);}
  } else {
    slab(0,64,200,100,66);house(0,64,208,54,32);
    // An actual terrain opening, three staggered landings and a continuous descent.
    slab(0,10,-5,220,290);slab(75,46,-58,60,166);slab(-90,28,-60,30,160);
    for(const x of [-111,111])b.box(x,8,-5,2,56,292,plan.stone);
    b.box(0,8,-151,224,56,2,plan.stone);b.box(0,8,141,150,56,2,plan.stone);
    // The south wall stops short of the descent ramp and does not seal its mouth.
    const army=batch('Terracotta', '#98795e');
    for(let row=0;row<6;row++)for(let col=0;col<2;col++) {
      const x=-101+col*22,z=-125+row*16;army.b.box(x,28,z,1.2,1.8,1,army.color);
      army.b.add(new THREE.SphereGeometry(.48,6,4),army.color,T(x,30.2,z));
    }
    for(const x of [-35,35])for(const z of [-10,80])column(x,10,z,2,17,plan.accent);
    slab(0,10,80,64,45);b.box(0,10,62,12,5,4,plan.accent);
  }
  const orleansNotes:Record<string,string>={market:'蓝白布棚围着旧井，沿街巷可走向城门或河港。',ramparts:'城墙转折处的钟楼，可以沿外梯登上眺望回廊。',cathedral:'双塔俯瞰河谷，开放的中殿通向高地侧院。',rivergate:'低位河门连接木桥、码头和城内侧路。',muster:'守城队伍在此整备，演武场与主战线分开。',harbour:'踏轮吊机旁留出运粮的通道，河港步道通向河门。',cloister:'回廊遮雨、庭院留光，药草畦之间留有通路。',repairyard:'新石、木料与修缮坡道排列在东墙外。'};
  const spawn=plan.sites[0].position;
  const markers:Marker[]=[{id:'spawn_p1',type:'spawn',label:`${plan.name}入口`,p:[spawn[0],spawn[1]+.5,spawn[2]]},
    ...plan.sites.map(site=>({id:`${plan.id}_${site.id}`,type:(plan.id==='orleans'?'discovery':'poi') as 'discovery'|'poi',label:site.name,p:[...site.position] as [number,number,number],radius:plan.id==='orleans'?6:site.radius,note:plan.id==='orleans'?orleansNotes[site.id]:`地图框架；${site.purpose}内容待制作，不授予章节通关。`}))];
  if(plan.id==='orleans')markers.push({id:'orleans_belfry_view',type:'discovery',label:'钟楼三面眺廊',p:[-23,39,-62],radius:5,note:'从外梯登高，可以俯瞰河港、街巷与教堂高地。'});
  const world={id:`world_${plan.id}`,name:plan.name,nameEn:plan.nameEn,half:360,playHalf:334,waterLevel:0,seed:20261109,version:1};
  const layout:Layout={world,areas:plan.sites.map(site=>({id:`${plan.id}_${site.id}`,name:site.name,nameEn:site.nameEn,c:[site.position[0],site.position[2]],r:site.radius,color:plan.color,tp:[site.position[0],site.position[2]]})),
    paths:[...plan.routes.map(route=>route.points.map(p=>[p[0],p[2]] as [number,number])),access.map(p=>[p[0],p[2]] as [number,number])],markers,
    objective:{id:plan.id==='orleans'?'orleans_explore':`${plan.id}_blockout`,name:plan.id==='orleans'?'奥尔良 · 河港与钟楼':`${plan.name} · 地图框架制作中`,steps:[]},
    lights:plan.sites.map(site=>({p:[site.position[0]+(plan.id==='orleans'?2.5:0),site.position[1]+(plan.id==='orleans'?4.6:5),site.position[2]+(plan.id==='orleans'?2.4:0)],color:plan.id==='orleans'?'#f1ca8c':plan.accent,intensity:plan.id==='orleans'?22:35,distance:plan.id==='orleans'?28:36}))};
  return {terrain:{vis,col},pieces,markers,layout,world,access};
}
