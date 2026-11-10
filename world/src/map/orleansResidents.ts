import * as THREE from 'three';
import type {PlacedNpcSocket} from '../settlements/types';
import {residentWalkRig} from '../settlements/residentWalk';

const ORIGIN=[-720,-720] as const;
const world=(p:readonly[number,number,number]):[number,number,number]=>[p[0]+ORIGIN[0],p[1],p[2]+ORIGIN[1]];
const RESIDENTS=[
  {id:'orleans_dock_clerk',role:['奥黛特 · 港务书记','Odette · harbour clerk'],p:[-185,8.45,-30],yaw:Math.PI*.6,coat:0x536d89,
    lines:[['石桥通向集市，木桥通向城外果园。贴着石岸往北走，就能到河门。','The stone bridge leads to the market; the timber bridge to the orchards. Follow the quay north to the river gate.'],['旁边石堤上有吊机把手。站稳后按住交互，把船上的粮袋吊上来；守城的人还等着这批粮。','The crane handle is on the stone quay beside us. Stand still and hold Interact to unload the grain; the defenders are waiting for it.']]},
  {id:'orleans_market_vendor',role:['露西 · 布商','Lucie · cloth merchant'],p:[-63,14.15,75],yaw:-.6,coat:0x946c63,
    lines:[['蓝布是守城旗，白布留给侧院的药草师。别把两卷都搬去城墙。','Blue cloth is for the defenders; white cloth for the herbalist. Please do not carry both rolls to the wall.'],['想去教堂就穿过拱门；想看河港，就沿着集市西边的小路下坡。','For the cathedral, pass through the arch. For the harbour, take the lane down the west side of the market.']]},
  {id:'orleans_cloister_healer',role:['艾莉丝 · 药草师','Elise · herbalist healer'],p:[104,32.18,-194],yaw:Math.PI/2,coat:0xd8d0b6,
    lines:[['回廊挡雨，庭院留光。靠墙的药草比石阶更怕踩踏。','The cloister keeps the rain out and the court lets the light in. These herbs bruise more easily than the steps.'],['东墙有木构坡道，钟楼也能登高。走的时候慢一点，修缮场的人还在搬木料。','There is a timber approach at the east wall and a lookout on the belfry. Take care around the builders and their timber.']]},
  {id:'orleans_wall_mason',role:['马塞尔 · 石匠','Marcel · stonemason'],p:[188,14.1,20],yaw:-1.1,coat:0x7d8274,
    lines:[['新石要和旧墙咬合，不能只把缺口堵上。你看得到坡道，上面的通路已经接通了。','New stone must bind into the old wall. The timber approach above us is already open.'],['城墙跟着山走，河岸跟着水走。若把城造得笔直，这两样都得吃亏。','The wall follows the hill and the quay follows the river. A ruler-straight town would serve neither.']]},
  {id:'orleans_bell_keeper',role:['雷米 · 守钟人','Remy · bell keeper'],p:[0,24.15,-45],yaw:.7,coat:0x6f7490,
    lines:[['沿钟楼外侧的木梯上去，能同时看见河港和东墙。钟声传不过去的地方，旗手还要再跑一趟。','The timber stair outside the belfry overlooks both the quay and east wall. Flag bearers still carry news beyond the reach of the bell.'],['报时绳在三面眺廊的西侧。站稳后拉住它，城墙和河港就能听见钟声。','The bell rope is on the west side of the viewing gallery. Stand still and pull it to send the toll across the walls and quay.']]},
  {id:'orleans_river_fisher',role:['阿兰 · 渔人','Alain · river fisher'],p:[-184.5,8.45,23],yaw:-1.4,coat:0x73877c,
    lines:[['水浅不等于能走。货物走石桥，人走木桥，船才走河里。','Shallow water is not a footpath. Freight takes the stone bridge, people the timber bridge, and boats the river.']]},
  {id:'orleans_wall_patrol',role:['西墙巡守','West wall patrol'],p:[-80,24.15,-29],yaw:Math.PI/2,coat:0x536783,
    lines:[['沿墙走到东边，可以从修缮场下去。河门在另一侧，别绕回城门。','Follow the wall east to the builders’ descent. The river gate is on the other side; you need not return through the main arch.']]},
  {id:'orleans_quay_porter',role:['河港搬运工','Quay porter'],p:[-185.6,8.45,-2.2],yaw:Math.PI,coat:0x94836c,
    lines:[['这边留一条路，粮车要转弯。仓库的货都码在两侧，中间能一直走过去。','Leave the turning space clear. The warehouses stack goods along the sides so the middle aisle stays open.']]},
] as const;
/** The common human rig is an appearance template; chapter facts stay entirely independent. */
export function orleansResidentSockets():PlacedNpcSocket[]{
  return RESIDENTS.map(s=>({id:s.id,role:[...s.role],position:world(s.p),yaw:s.yaw,region:'britain',worldRegion:'orleans',appearance:{coat:s.coat,trim:0xd7c8aa,accent:0xbba05e,...(s.id==='orleans_quay_porter'?{carry:'sack' as const}:s.id==='orleans_river_fisher'?{carry:'net' as const}:s.id==='orleans_bell_keeper'?{carry:'bellrope' as const}:{})},lines:s.lines.map(l=>[...l])}));
}
type ResidentHost={group:THREE.Group;getPosition(id:string):[number,number,number]|null;pose(id:string,p:[number,number,number],yaw:number):boolean};
export function createOrleansResidentLife(host:ResidentHost,ground:(x:number,z:number,ceiling:number)=>number|null){
  const patrols=[
    {id:'orleans_wall_patrol',speed:1.05,path:[[-80,24.15,-29],[-36,24.15,-22],[22,24.15,-26],[78,24.15,-30]]},
    {id:'orleans_quay_porter',speed:.8,path:[[-185.6,8.45,-2.2],[-186,8.45,-20],[-186.6,8.45,-48.4]]},
  ];
  const walkers=patrols.map(p=>{const root=host.group.getObjectByName(`Resident_${p.id}`)!;return{...p,root,rig:residentWalkRig(root),index:0,direction:1,phase:0,startY:root.position.y};});
  for(const s of RESIDENTS){const p=host.getPosition(s.id)!;const y=ground(p[0],p[2],p[1]+2);if(y!==null&&Math.abs(y-p[1])<1.2)host.pose(s.id,[p[0],y+.02,p[2]],s.yaw);const root=host.group.getObjectByName(`Resident_${s.id}`);if(root)root.userData.region='orleans';}
  let disposed=false;
  return{update(dt:number,player:THREE.Vector3,speaking:string|null,ready:boolean){
    if(disposed||!ready||Math.hypot(player.x+720,player.z+720)>500)return;
    dt=Number.isFinite(dt)?Math.min(.05,Math.max(0,dt)):0;
    for(const p of walkers){
      const at=host.getPosition(p.id)!;if(Math.hypot(at[0]-player.x,at[2]-player.z)>95)continue;
      const paused=speaking===p.id||Math.hypot(at[0]-player.x,at[2]-player.z)<3;
      let yaw=p.root.rotation.y;
      if(dt>0&&!paused){
        let next=p.index+p.direction;if(next>=p.path.length||next<0){p.direction*=-1;next=p.index+p.direction;}
        const goal=world(p.path[next] as [number,number,number]),dx=goal[0]-at[0],dz=goal[2]-at[2],distance=Math.hypot(dx,dz),move=Math.min(distance,dt*p.speed);
        if(distance<.08){p.index=next;continue;}
        const x=at[0]+dx/distance*move,z=at[2]+dz/distance*move,y=ground(x,z,at[1]+1.5);
        if(y!==null&&Math.abs(y-at[1])<.55){yaw=Math.atan2(dx,dz);host.pose(p.id,[x,y+.02,z],yaw);p.phase+=move*5;}
      }
      const position=host.getPosition(p.id)!;p.root.rotation.y=yaw;p.rig.update(p.phase,!paused&&dt>0,position[1]-p.startY);
    }
  },dispose(){disposed=true;}};
}
