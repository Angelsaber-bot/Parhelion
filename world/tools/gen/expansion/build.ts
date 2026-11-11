import { orleansAuthoredHeight, orleansTerrainColor, riverDistance,orleansTerrainOpening } from '../orleans/landscape';
import { buildOrleans } from '../orleans/build';
import { qinAuthoredHeight, qinTerrainColor, qinTunnelCut, qinTunnelRoof } from '../qin/landscape';
import { buildQin } from '../qin/build';
import { egyptAuthoredHeight, egyptTerrainColor, egyptTunnelCut } from '../egypt/landscape';
import { buildEgypt } from '../egypt/build';
import { continentalHeight, CONTINENT_OFFSETS, toTile } from '../continent';
import { homeAuthoredHeight } from '../home/landscape';
import { buildHome } from '../home/build';
import {HOME_LIGHTS} from '../../../src/map/homePlan';
import { heightFn as alphaHeight } from '../terrain';
import * as THREE from 'three';
import type { Layout, Marker } from '../../../src/core/types';
import { EXPANSION_CONNECTIONS, EXPANSION_PLANS, ORLEANS_LIT_SITES, distanceToLine, worldToPlan, type ExpansionPlan, type RoutePoint } from '../../../src/map/worldPlan';
import { paintedGround } from '../../../src/map/orleansOutskirts';
import { Batch, T } from '../geo';
import type { Piece } from '../structures';
import { heightFn as britainHeight } from '../britain/terrain';
import { heightFn as winterHeight } from '../winter/terrain';
import { heightFn as kyotoHeight } from '../kyoto/terrain';

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
/** Ground of any tile at a world point (each tile's own generator, in its authoring frame). */
function tileHeight(id:string,wx:number,wz:number):number{
  const [ox,oz]=CONTINENT_OFFSETS[id],[x,z]=toTile(id,wx-ox,wz-oz);
  if(id==='britain')return britainHeight(x,z);
  if(id==='winter')return winterHeight(x,z);
  if(id==='kyoto')return kyotoHeight(x,z);
  if(id==='alpha')return alphaHeight(x,z);
  return expansionHeight(EXPANSION_PLANS.find(p=>p.id===id)!,x,z);
}

export function expansionHeight(plan:ExpansionPlan,x:number,z:number):number {
  if(plan.id==='orleans')return continentalHeight(plan.id,x,z,orleansAuthoredHeight(plan,x,z));
  if(plan.id==='qin')return continentalHeight(plan.id,x,z,qinAuthoredHeight(plan,x,z));
  if(plan.id==='egypt')return continentalHeight(plan.id,x,z,egyptAuthoredHeight(plan,x,z));
  if(plan.id==='home')return continentalHeight(plan.id,x,z,homeAuthoredHeight(plan,x,z));
  throw new Error(`No authored height for ${plan.id}`);
}

/** Roads follow the continuous continental terrain between authored settlements. */
export function connectionRoute(plan:ExpansionPlan):RoutePoint[] {
  const link=EXPANSION_CONNECTIONS.find(c=>c.to===plan.id)!;
  const samples:[number,number][]=[];
  for(let s=1;s<link.points.length;s++) {
    const a=link.points[s-1],b=link.points[s],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);
    for(let i=s===1?0:1;i<=n;i++)samples.push([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]);
  }
  const [fx,fz]=CONTINENT_OFFSETS[link.from];
  const heights=samples.map(([x,z])=>{
    const source=Math.abs(x-fx)<=360&&Math.abs(z-fz)<=360;
    const [lx,lz]=worldToPlan(plan,x,z);
    const y=source?tileHeight(link.from,x,z)+.2:expansionHeight(plan,lx,lz)+.1;
    // The raised bridge approach belongs to the Loire; on the neighbour's ground the road follows its terrain.
    return plan.id==='orleans'&&!source&&riverDistance(lx,lz)<65?Math.max(14.2,y):y;
  });
  // Minimal 0.5-grade envelope above the existing terrain, in two linear passes.
  // This clears mountain ridges without stair-like jumps or a steep final descent.
  const distance=(i:number,j:number)=>Math.hypot(samples[i][0]-samples[j][0],samples[i][1]-samples[j][1]);
  for(let i=1;i<heights.length;i++)heights[i]=Math.max(heights[i],heights[i-1]-.5*distance(i,i-1));
  for(let i=heights.length-2;i>=0;i--)heights[i]=Math.max(heights[i],heights[i+1]-.5*distance(i,i+1));
  // The deck starts flush with the neighbour's ground and rises to its 20 cm margin over 16 m,
  // so nobody walks into a raised edge where the road begins.
  let along=0;
  for(let i=0;i<heights.length;i++){
    if(i)along+=distance(i,i-1);
    if(along>=16)break;
    const [x,z]=samples[i];
    heights[i]=Math.min(heights[i],tileHeight(link.from,x,z)-.08+.2*smooth(along/16));
  }
  return samples.map(([x,z],i)=>{const [lx,lz]=worldToPlan(plan,x,z);return [lx,heights[i],lz];});
}

/** Lamps and furnace glow inside the mountain; the surface keeps daylight. */
const QIN_LIGHTS:{p:[number,number,number];color:string;intensity:number;distance:number}[]=[
  {p:[-128,26,124],color:'#ffb066',intensity:26,distance:22},
  {p:[40,66,-58],color:'#f1c98e',intensity:18,distance:26},
  {p:[134,53,-96],color:'#ff9a48',intensity:44,distance:48},
  {p:[-17,35,-130],color:'#f3e7c4',intensity:34,distance:56},
  // The royal city's light also reaches the three burial pits around it (point lights are not occluded);
  // Qin keeps five sources so the eight-lamp pool always holds every nearby one.
  {p:[60,20,-178],color:'#c8d2ff',intensity:95,distance:72},
];
const EGYPT_LIGHTS:{p:[number,number,number];color:string;intensity:number;distance:number}[]=[
  {p:[-165,18,110],color:'#ffc27a',intensity:24,distance:26},
  {p:[80,36,-145],color:'#ffd99a',intensity:30,distance:40},
  {p:[80,35,-180],color:'#ffcc66',intensity:26,distance:22},
  {p:[94,19.5,-253],color:'#ffbe6a',intensity:40,distance:42},
  {p:[195,29.2,-76],color:'#ffc890',intensity:14,distance:20},
];
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
  const qinRoadLines=plan.id==='qin'||plan.id==='egypt'?[...plan.routes.filter(r=>r.kind!=='underground').map(r=>r.points.map(p=>[p[0],p[2]] as const)),access.map(p=>[p[0],p[2]] as const)]:[];
  const vertex=(i:number,j:number)=>{
    const k=j*nx+i,existing=vertices.get(k);if(existing!==undefined)return existing;
    const x=x0+i*cell,z=z0+j*cell,y=accessHeight(x,z),v=pos.length/3;vertices.set(k,v);pos.push(x,y,z);
    c.copy(base).lerp(rock,smooth((y-(plan.id==='qin'?40:28))/35)*.65).multiplyScalar(1+.035*Math.sin(x*.2)*Math.cos(z*.17));
    if(plan.id==='orleans')c.copy(orleansTerrainColor(plan,x,y,z));
    if(plan.id==='egypt')c.copy(egyptTerrainColor(x,y,z,Math.min(...qinRoadLines.map(line=>distanceToLine(x,z,line)))));
    if(plan.id==='qin')c.copy(qinTerrainColor(x,y,z,Math.min(...qinRoadLines.map(line=>distanceToLine(x,z,line)))));
    colors.push(c.r,c.g,c.b);return v;
  };
  for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++) {
    const x=x0+i*cell,z=z0+j*cell;
    if(![[x,z],[x+cell,z],[x,z+cell],[x+cell,z+cell]].every(([px,pz])=>mask(px,pz)))continue;
    if(plan.id==='orleans'&&orleansTerrainOpening(x+cell/2,z+cell/2))continue;
    if(plan.id==='egypt'){
      const cut=egyptTunnelCut(x+cell/2,z+cell/2);
      if(cut&&[[x,z],[x+cell,z],[x,z+cell],[x+cell,z+cell]].some(([px,pz])=>accessHeight(px,pz)<cut.roof)){
        const v=pos.length/3,dark=new THREE.Color(plan.stone).multiplyScalar(.6);
        for(const [px,pz] of [[x,z],[x+cell,z],[x,z+cell],[x+cell,z+cell]]){pos.push(px,cut.cut,pz);colors.push(dark.r,dark.g,dark.b);}
        idx.push(v,v+2,v+1,v+1,v+2,v+3);continue;
      }
    }
    if(plan.id==='qin') {
      // Hillside over a tunnel mouth: drop the cell below the tunnel floor on its own
      // vertices so the slope opens only into the stone-lined passage, never into a void.
      const cut=qinTunnelCut(x+cell/2,z+cell/2),roof=qinTunnelRoof(x+cell/2,z+cell/2);
      if(cut!==null&&roof!==null&&[[x,z],[x+cell,z],[x,z+cell],[x+cell,z+cell]].some(([px,pz])=>accessHeight(px,pz)<roof)) {
        const v=pos.length/3,dark=new THREE.Color(plan.stone).multiplyScalar(.6);
        for(const [px,pz] of [[x,z],[x+cell,z],[x,z+cell],[x+cell,z+cell]]){pos.push(px,cut,pz);colors.push(dark.r,dark.g,dark.b);}
        idx.push(v,v+2,v+1,v+1,v+2,v+3);continue;
      }
    }
    const a=vertex(i,j),b=vertex(i+1,j),cc=vertex(i,j+1),d=vertex(i+1,j+1);idx.push(a,cc,b,b,cc,d);
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
  for(const route of plan.routes.filter(r=>plan.id==='orleans'||r.kind!=='underground'))ribbon(route.points,plan.id==='orleans'&&route.kind==='underground'?4.8:route.kind==='main'||route.kind==='underground'?7:5,route.kind==='high'?(plan.id==='orleans'?'#c7b99b':plan.id==='qin'?'#a8a08a':plan.id==='egypt'?'#e1d2ae':plan.accent):roads.color);
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
  for(const site of plan.sites.filter(()=>false)) {
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
    pieces.push(...buildEgypt(plan,(x,z)=>expansionHeight(plan,x,z),access));
  } else if(plan.id==='home') {
    pieces.push(...buildHome((x,z)=>expansionHeight(plan,x,z)));
  } else {
    pieces.push(...buildQin(plan,(x,z)=>expansionHeight(plan,x,z),access));
  }
  const orleansNotes:Record<string,string>={market:'蓝白布棚围着旧井，沿街巷可走向城门或河港。',ramparts:'城墙转折处的钟楼，可以沿外梯登上眺望回廊。',cathedral:'双塔俯瞰河谷，开放的中殿通向高地侧院。',rivergate:'低位河门连接木桥、码头和城内侧路。',muster:'守城队伍在此整备，演武场与主战线分开。',harbour:'踏轮吊机旁留出运粮的通道，河港步道通向河门。',cloister:'回廊遮雨、庭院留光，药草畦之间留有通路。',repairyard:'新石、木料与修缮坡道排列在东墙外。',tourelles:'石桥南端的双塔门楼。西塔的塔顶在围城时被打掉，门洞下的大路照常通行。',bridgemill:'河心石墩上的磨坊，水轮悬在墩侧的水流里；环线木栈桥在这里转向。',vineyard:'南岸缓坡上的两片葡萄田，中间是敞开的榨酒棚：螺旋榨机、木桶和刚摘的葡萄。',grange:'鸽舍和农舍还在，谷仓只剩烧黑的梁柱。三道焦痕从院子一直拖向东边的田地。',windmill:'东岗上的石砌风车，帆叶迎着河谷的风转；从这里能望见整座城和教堂双塔。',bastille:'围城军留下的土垒：木栅、火炮和抛石机还在，营垒上已经换回了奥尔良的旗。'};
  const qinNotes:Record<string,string>={worktown:'驿道进镇，主街两侧是陶铺、铜匠与粮囷；往西过关，往南上山脊，沿水渠可绕上宫城。',pass:'骊水在双阙之下穿墙而过，驿道从厚重的关门进入宫城山道。',palace:'夯土高台上的前殿；殿后山屏开着通往地宫的斜道。',kilns:'两条龙窑顺坡而卧，晾瓦架上排着新烧的黑瓦。',archive:'简牍成捆上架，记着工匠、窑次和运俑的账目。',quarry:'南坡采石的台阶之间，检修道直通山腹。',pavilion:'从山脊下来的路落在观阙，俯瞰前殿、广场与驿道。',workshop:'炉火未熄，铜汁沿槽流向模具，运俑轨道把陶俑送往下层。',army:'成片的兵俑列阵待命。转动军令台，阵列会改变朝向与通路。',royalcity:'星图穹顶下，水银江河环绕封土；这里是骊山之下的不死王城。',mausoleum:'骊山脚下的陵园：三级覆斗封土立在内外两重城垣中，寝殿面朝封土，神道从东门伸出；封土之下就是地下王城。',chariots:'两乘彩绘铜车一前一后，立车撑着伞盖，安车罩着龟背顶，各驾四匹铜马。',armoury:'成排的石甲用石片和铜丝编成，旁边的长架上摆着石胄。',waterfowl:'水渠两岸立着铜雁、天鹅和鹤，跽坐的乐俑面朝水禽奏乐；有一只鹤正低头衔虫。'};
  const egyptNotes:Record<string,string>={oasis:'泉湖边的泥砖商队镇，风塔和鸽楼之间是集市；往西沿河岸到码头，往南进峡谷。',quay:'日河码头，帆船靠岸，量水尺的刻度记着每年的洪水。',canyon:'裂日峡谷切开台地，沙底平缓，一路通到神殿东门。',tombs:'峡谷南壁凿出的崖墓，门楣上还留着彩绘。',colossi:'两尊坐像守着通往神殿的坡道，方尖碑立在台前。',temple:'塔门之后是列柱中庭；中庭西侧的金盘射出日光，转动铜镜把光引进圣所。',roofshrine:'从中庭东侧的阶梯登上柱廊屋顶，屋顶祭坛俯瞰整座神殿。',barque:'圣所日轮照亮后，后壁石门沉下，斜道通往台地下的太阳船墓。',pyramid:'神殿西侧的堤道通往金字塔和它的河谷神殿。',trial:'沙丘上的圆形日晷台，方尖碑围成试炼场。',mortuary:'巨像庭院往西，三层台地嵌进日峰下的崖湾：坡道居中，柱廊里画着远航香料之国的船队，最上层的奥西里斯柱像后面是凿进山里的圣所。',sacredlake:'神殿台基西侧的石砌圣湖，四面台阶下到湖底；角上的花岗岩圣甲虫是绕湖祈愿的起点。',village:'修墓工匠的围墙村落，一条街两排屋，街尾是村里的小神龛；村外坡上是他们自己的小金字塔墓。',quarry:'从裂日峡谷东侧的石道上台地，采石坑里躺着一根没凿完的方尖碑——它在凿出之前就裂了。',treasury:'太阳船墓西壁的小门后面是宝库：鎏金内龛、守门的黑色王像、伏在宝箱上的阿努比斯。',fallen:'沙海里只剩一双巨腿立在石座上，碎裂的面孔半埋在旁边的沙里；石座上的铭文还能认出“王中之王”。'};
  const homeNotes:Record<string,string>={square:'归乡大道从西侧接入广场，面包房和生活街通向东岸港湾。',house:'推门就是客厅与厨房，内侧楼梯通往卧室和书桌。',lodge:'有公共餐厅和八间客房的归乡公馆。在入住簿邀请已缔约的 Saber。',garden:'公馆的开放庭院；休息的同伴会来这里走走。',practice:'北坡的小练习庭，沿步道可回广场或前往北门驿道。',park:'花园步道连接家、住宅街与海岸。',harbour:'仓库、修船棚、小灯塔与伸入海湾的木栈桥。',northroad:'北门驿道，翻过缓坡就是黑帆尽头的南岸。'};
  const spawn=plan.sites[0].position;
  const markers:Marker[]=[{id:'spawn_p1',type:'spawn',label:`${plan.name}入口`,p:[spawn[0],spawn[1]+.5,spawn[2]]},
    ...plan.sites.map(site=>({id:`${plan.id}_${site.id}`,type:'discovery' as 'discovery'|'poi',label:site.name,p:[...site.position] as [number,number,number],radius:6,note:plan.id==='orleans'?orleansNotes[site.id]:plan.id==='qin'?qinNotes[site.id]:plan.id==='egypt'?egyptNotes[site.id]:plan.id==='home'?homeNotes[site.id]:`地图框架；${site.purpose}内容待制作，不授予章节通关。`}))];
  if(plan.id==='orleans')markers.push({id:'orleans_belfry_view',type:'discovery',label:'钟楼三面眺廊',p:[-23,39,-62],radius:5,note:'从外梯登高，可以俯瞰河港、街巷与教堂高地。'});
  const world={id:`world_${plan.id}`,name:plan.name,nameEn:plan.nameEn,half:360,playHalf:334,waterLevel:0,seed:20261109,version:1};
  const layout:Layout={world,areas:plan.sites.map(site=>({id:`${plan.id}_${site.id}`,name:site.name,nameEn:site.nameEn,c:[site.position[0],site.position[2]],r:site.radius,color:plan.color,tp:[site.position[0],site.position[2]]})),
    paths:[...plan.routes.map(route=>route.points.map(p=>[p[0],p[2]] as [number,number])),access.map(p=>[p[0],p[2]] as [number,number])],markers,
    objective:{id:plan.id==='orleans'?'orleans_explore':`${plan.id}_explore`,name:plan.id==='orleans'?'奥尔良 · 河港与钟楼':plan.id==='qin'?'秦帝国 · 骊山上下':plan.id==='home'?'主角城镇 · 归处':'古埃及 · 日河与太阳神殿',steps:[]},
    lights:plan.id==='qin'?QIN_LIGHTS:plan.id==='egypt'?EGYPT_LIGHTS:plan.id==='home'?HOME_LIGHTS:plan.sites.slice(0,plan.id==='orleans'?ORLEANS_LIT_SITES:undefined).map(site=>({p:[site.position[0]+(plan.id==='orleans'?2.5:0),site.position[1]+(plan.id==='orleans'?4.6:5),site.position[2]+(plan.id==='orleans'?2.4:0)],color:plan.id==='orleans'?'#f1ca8c':plan.accent,intensity:plan.id==='orleans'?22:35,distance:plan.id==='orleans'?28:36}))};
  return {terrain:{vis,col},pieces,markers,layout,world,access,...(plan.id==='orleans'?{groundPaint:paintedGround}:{})};
}
