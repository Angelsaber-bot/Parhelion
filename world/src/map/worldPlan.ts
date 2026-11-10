import type { ExpansionRegionId, WorldRegionId } from '../core/regionIdentity';
import {ORLEANS_UNDERPASS} from './orleansWorks';

export type MapPoint2 = readonly [number, number];
export type RoutePoint = readonly [number, number, number];
export interface ExpansionSite {
  id: string; name: string; nameEn: string; position: RoutePoint; radius: number;
  purpose: 'hub' | 'landmark' | 'arena' | 'boss';
}
export interface ExpansionPlan {
  id: ExpansionRegionId; name: string; nameEn: string; offset: [number, number];
  /** Local landmark envelope; surrounding terrain continues into every neighbour. */
  outline: MapPoint2[]; color: string; stone: string; accent: string;
  identity: string; servant: string; sites: ExpansionSite[];
  routes: { id: string; name: string; kind: 'main' | 'flank' | 'high' | 'underground'; points: RoutePoint[] }[];
}

export const WORLD_PLAN = {
  cellSize: 720, columns: 3, rows: 3,
  topology: 'continuous-mainland', interiorBarriers: false, southwest: 'wooded-foothills',
  bounds: [-1080, 1080, -1080, 1080] as const,
  /** Deliberately outside the overworld: the Orleans dragon is a regional boss. */
  finale: { id: 'convergence', separateMap: true, requiredRegions: ['britain', 'blacksail', 'winter', 'kyoto', 'orleans', 'egypt', 'qin'] as const, status: 'planned' },
};

export const EXPANSION_PLANS: ExpansionPlan[] = [
  {
    id: 'orleans', name: '奥尔良', nameEn: 'Orleans', offset: [-720, -720],
    outline: [[-310,-240],[-205,-330],[-60,-310],[70,-330],[245,-260],[310,-120],[290,-30],[300,30],[325,165],[170,300],[30,300],[30,388],[-30,388],[-30,300],[-190,270],[-315,120],[-280,-30],[-330,-140]],
    color: '#718d60', stone: '#c3b49c', accent: '#7185b8',
    identity: '围城救援、河道侧路、城墙屋顶与教堂高地', servant: '贞德 / 黑贞',
    sites: [
      { id:'market', name:'守城集市', nameEn:'Defenders Market', position:[-80,14,90], radius:48, purpose:'hub' },
      { id:'ramparts', name:'断墙与钟楼', nameEn:'Ramparts and Belfry', position:[0,24,-45], radius:60, purpose:'landmark' },
      { id:'cathedral', name:'龙影教堂', nameEn:'Dragonshadow Cathedral', position:[35,32,-170], radius:54, purpose:'boss' },
      { id:'rivergate', name:'河门与排水侧路', nameEn:'River Gate', position:[-155,8,-75], radius:32, purpose:'landmark' },
      { id:'muster', name:'骑士演武营地', nameEn:'Knight Muster', position:[130,14,125], radius:38, purpose:'arena' },
      { id:'harbour', name:'踏轮吊机与河港', nameEn:'Treadwheel Harbour', position:[-186,8.35,-20], radius:18, purpose:'hub' },
      { id:'cloister', name:'教堂药草回廊', nameEn:'Cathedral Herb Cloister', position:[111,32,-194], radius:25, purpose:'landmark' },
      { id:'repairyard', name:'东墙修缮场', nameEn:'Eastern Wall Works', position:[178,14,50], radius:28, purpose:'landmark' },
    ],
    routes: [
      { id:'main', name:'城门正面进攻', kind:'main', points:[[0,14,170],[-80,14,90],[-55,14,70],[-16,14,43],[15,14,15],[30,14,-10],[30,14,-55],[34,23,-92],[35,32,-130],[35,32,-170]] },
      { id:'flank', name:'沿河潜入', kind:'flank', points:[[-80,14,90],[-120,14,70],[-150,8,45],[-155,8,-75],[-125,8,-125],[-65,14,-175],[-10,32,-130],[35,32,-130],[35,32,-170]] },
      { id:'high', name:'城墙钟楼绕行', kind:'high', points:[[-80,14,90],[-90,14,20],[-90,24,-15],[-90,24,-30],[-36,24,-22],[22,24,-26],[80,24,-30],[95,27,-72],[80,32,-130],[35,32,-130],[35,32,-170]] },
      { id:'riverfront', name:'河港与木桥环线', kind:'flank', points:[[-80,14,90],[-120,14,70],[-150,8,45],[-155,8,-75],[-240,8,-90],[-270,14,-40],[-252,14,75],[-170,14,130],[-80,14,90]] },
      { id:'harbourwalk', name:'河港码头巡行', kind:'flank', points:[[-150,8,45],[-179.5,8.35,39.3],[-183.5,8.35,19.7],[-185.6,8.35,-2.2],[-186,8.35,-20],[-186.6,8.35,-48.4],[-188,8.35,-71.2],[-184,8.15,-76],[-180,8,-79.4],[-155,8,-75]] },
      { id:'dockapproach', name:'河港至街巷坡道', kind:'flank', points:[[-185.6,8.35,-2.2],[-177,8.35,-2],[-160,11.3,-2],[-138,14,-2]] },
      { id:'cloisterwalk', name:'教堂侧院回廊', kind:'flank', points:[[80,32,-130],[100,32,-146],[130,32,-160],[130,32,-194],[111,32,-194],[96,32,-194],[96,32,-218],[130,32,-218],[130,32,-194]] },
      { id:'wallworks', name:'修缮场与东墙木构坡道', kind:'high', points:[[130,14,125],[165,14,95],[178,14,50],[180,14,-70],[160,24,-88],[137,24,-72],[108,24,-50],[80,24,-30]] },
      { id:'belfrywalk', name:'钟楼外梯与三面眺廊', kind:'high', points:[[0,24,-45],[-1,24,-45],[-1,24,-74],[-5,24,-74],[-19,29,-74],[-23,29,-74],[-23,29,-70],[-23,34,-54],[-23,34,-50],[-19,34,-50],[-5,39,-50],[-1,39,-50],[-1,39,-74],[-23,39,-74],[-23,39,-54]] },
      {id:'underpass',name:'河门旧引水道',kind:'underground',points:[...ORLEANS_UNDERPASS]},
    ],
  },
  {
    id:'egypt', name:'古埃及', nameEn:'Solar Egypt', offset:[720,720],
    outline:[[-295,-235],[-150,-310],[-30,-300],[30,-300],[170,-320],[295,-205],[325,-35],[270,95],[315,230],[140,325],[-20,285],[-190,325],[-320,170],[-300,30],[-388,30],[-388,-30],[-300,-30]],
    color:'#c6a168', stone:'#dcc18b', accent:'#49a8ae',
    identity:'绿洲商队、砂岩峡谷、可攀巨像与神殿光路', servant:'奥兹曼迪亚斯',
    sites:[
      { id:'oasis', name:'商队绿洲', nameEn:'Caravan Oasis', position:[-165,14,110], radius:55, purpose:'hub' },
      { id:'canyon', name:'裂日峡谷', nameEn:'Sunrift Canyon', position:[-110,14,-65], radius:46, purpose:'landmark' },
      { id:'colossi', name:'双巨像庭院', nameEn:'Court of Colossi', position:[80,24,20], radius:65, purpose:'landmark' },
      { id:'temple', name:'太阳神殿', nameEn:'Sun Temple', position:[80,30,-140], radius:62, purpose:'boss' },
      { id:'trial', name:'引光试炼台', nameEn:'Solar Trial', position:[165,24,125], radius:34, purpose:'arena' },
    ],
    routes:[
      { id:'main', name:'绿洲与巨像大道', kind:'main', points:[[-165,14,110],[-30,14,75],[80,24,20],[80,30,-90],[80,30,-140]] },
      { id:'flank', name:'峡谷侧径', kind:'flank', points:[[-165,14,110],[-160,14,0],[-110,14,-65],[-65,20,-160],[-35,30,-90],[80,30,-90],[80,30,-140]] },
      { id:'high', name:'巨像肩部与神殿上层', kind:'high', points:[[80,24,20],[130,24,0],[130,44,-80],[130,44,-100],[80,44,-100]] },
    ],
  },
  {
    id:'qin', name:'秦帝国', nameEn:'Qin Empire', offset:[720,-720],
    outline:[[-285,-250],[-130,-325],[35,-300],[205,-330],[315,-175],[270,-25],[325,110],[215,290],[30,300],[-30,300],[-180,320],[-310,175],[-300,30],[-300,-30],[-335,-130]],
    color:'#7d926e', stone:'#929b94', accent:'#bd5343',
    identity:'骊山之上的帝国，骊山之下的不死王城：驿道、工匠集镇、夯土宫城与三层地宫', servant:'秦始皇',
    sites:[
      { id:'worktown', name:'骊山工匠集镇', nameEn:'Lishan Artisan Town', position:[-185,22,100], radius:34, purpose:'hub' },
      { id:'pass', name:'骊水关', nameEn:'Li River Pass', position:[-70,27,82], radius:10, purpose:'landmark' },
      { id:'palace', name:'骊山宫城', nameEn:'Mount Li Palace', position:[40,70,0], radius:16, purpose:'landmark' },
      { id:'kilns', name:'龙窑窑场', nameEn:'Dragon Kiln Yard', position:[-208,24,54], radius:10, purpose:'landmark' },
      { id:'archive', name:'简牍库', nameEn:'Bamboo-slip Archive', position:[-212,22,138], radius:8, purpose:'landmark' },
      { id:'quarry', name:'北坡石料场', nameEn:'North Slope Quarry', position:[-128,28,-42], radius:12, purpose:'landmark' },
      { id:'pavilion', name:'宫城观阙', nameEn:'Palace Watch Tower', position:[90,82,-32], radius:6, purpose:'landmark' },
      { id:'workshop', name:'地下铸造层', nameEn:'Buried Foundry', position:[130,46,-96], radius:16, purpose:'landmark' },
      { id:'army', name:'兵马俑军阵层', nameEn:'Terracotta Garrison', position:[-17,28,-130], radius:20, purpose:'arena' },
      { id:'royalcity', name:'地下王城', nameEn:'Buried Royal City', position:[38,10,-190], radius:18, purpose:'boss' },
    ],
    routes:[
      { id:'main', name:'驿道—集镇—关隘—宫城', kind:'main', points:[[-185,22,100],[-140,23,86],[-100,25,80],[-70,27,82],[-35,31,92],[5,37,108],[45,44,116],[80,50,108],[70,55,98],[42,57.6,98],[40,58,90],[40,58,56],[40,58,44],[40,70,16],[40,70,0]] },
      { id:'aqueduct', name:'沿输水渠潜入宫城', kind:'flank', points:[[-185,22,100],[-150,22.6,96],[-140,25,60],[-122,30,26],[-96,37,0],[-64,46,-16],[-34,56,-26],[-8,66,-31],[2,70,-29],[14,70,-28],[36,70,-30]] },
      { id:'ridge', name:'骊山山脊绕至观阙', kind:'high', points:[[-185,22,100],[-200,23,62],[-212,26,20],[-214,30,-12],[-182,40,-44],[-150,50,-72],[-118,61,-96],[-85,72,-116],[-50,84,-130],[-15,95,-140],[25,104,-131],[60,111,-118],[84,103,-96],[98,93,-72],[100,86,-50],[92,82,-40],[90,82,-28],[80,82,-28],[48,70,-28],[40,70,-30]] },
      { id:'quarry-path', name:'水渠岔道至石料场', kind:'flank', points:[[-122,30,26],[-125,30,-8],[-128,28,-42]] },
      { id:'palace-descent', name:'宫后斜道至铸造层与运俑轨道', kind:'underground', points:[[40,70,-30],[40,70,-44],[40,62,-68],[40,62,-72.5],[44.5,62,-72.5],[100,46,-72.5],[106,46,-72.5],[106,46,-115],[100,46,-115],[30,28,-115],[20,28,-115]] },
      { id:'maintenance', name:'石料场检修道', kind:'underground', points:[[-128,28,-42],[-125,28,-56],[-125,28,-110.5],[-125,28,-115],[-120.5,28,-115],[-60,28,-115],[-50,28,-115]] },
      { id:'royal-descent', name:'斜井下至地下王城', kind:'underground', points:[[-17,28,-130],[-17,28,-160],[-17,19,-185.5],[-17,19,-190],[-12.5,19,-190],[31,10,-190],[38,10,-190]] },
    ],
  },
];

/** No grass in desert sand or through Qin's rammed-earth palace platforms. X0,Z0,X1,Z1. */
export const EXPANSION_GRASS_CLEARANCE:readonly (readonly [number,number,number,number])[]=[
  [330,330,1055,1055],[722,-762,824,-642],
];
/** World-space centre/radii of Orleans' worn paved courts; rounded ground stays rounded. */
export const ORLEANS_PAVED_COURTS:readonly (readonly [number,number,number,number])[]=[[-685,-832,20,12],[-800,-630,23,18]];

export interface ExpansionConnection {
  id:string; from:WorldRegionId; to:ExpansionRegionId; name:string;
  /** World-space road across broad, continuous land; never the only crossing. */
  points: MapPoint2[]; width:number;
}
export const EXPANSION_CONNECTIONS: ExpansionConnection[] = [
  {id:'britain-orleans',from:'britain',to:'orleans',name:'北境围城古道',points:[[-720,-120],[-720,-420],[-800,-630]],width:18},
  // Route along the southern snowfield, clear of the existing Gorge Glide descent.
  {id:'winter-qin',from:'winter',to:'qin',name:'东境山河驿道',points:[[120,-520],[420,-520],[535,-620]],width:18},
  {id:'kyoto-egypt',from:'kyoto',to:'egypt',name:'沙海商队古道',points:[[120,720],[420,720],[555,830]],width:18},
];

export function distanceToLine(x:number,z:number,line:readonly MapPoint2[]):number {
  let d=Infinity;
  for(let i=1;i<line.length;i++) {
    const a=line[i-1],b=line[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    d=Math.min(d,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
  }return d;
}

/** Includes points on the perimeter, so a connector cannot flicker between ownerships. */
export function inPolygon(x:number,z:number,polygon:readonly MapPoint2[]):boolean {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [ax,az]=polygon[j], [bx,bz]=polygon[i], dx=bx-ax,dz=bz-az;
    const cross=(x-ax)*dz-(z-az)*dx;
    if(Math.abs(cross)<1e-6&&x>=Math.min(ax,bx)-1e-6&&x<=Math.max(ax,bx)+1e-6&&z>=Math.min(az,bz)-1e-6&&z<=Math.max(az,bz)+1e-6)return true;
    if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
  }
  return inside;
}

export function polygonDistance(x:number,z:number,polygon:readonly MapPoint2[]):number {
  if(inPolygon(x,z,polygon))return 0;
  let result=Infinity;
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    result=Math.min(result,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }
  return result;
}
