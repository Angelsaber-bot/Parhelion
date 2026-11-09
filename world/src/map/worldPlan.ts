import type { ExpansionRegionId, WorldRegionId } from '../core/regionIdentity';

export type MapPoint2 = readonly [number, number];
export type RoutePoint = readonly [number, number, number];
export interface ExpansionSite {
  id: string; name: string; nameEn: string; position: RoutePoint; radius: number;
  purpose: 'hub' | 'landmark' | 'arena' | 'boss';
}
export interface ExpansionPlan {
  id: ExpansionRegionId; name: string; nameEn: string; offset: [number, number];
  /** Local geographical envelope, independent of the 720 m production grid. */
  outline: MapPoint2[]; color: string; stone: string; accent: string;
  identity: string; servant: string; sites: ExpansionSite[];
  routes: { id: string; name: string; kind: 'main' | 'flank' | 'high' | 'underground'; points: RoutePoint[] }[];
}

export const WORLD_PLAN = {
  cellSize: 720, columns: 3, rows: 3,
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
    ],
    routes: [
      { id:'main', name:'城门正面进攻', kind:'main', points:[[0,14,170],[-80,14,90],[0,14,30],[30,14,-55],[35,32,-130],[35,32,-170]] },
      { id:'flank', name:'沿河潜入', kind:'flank', points:[[-80,14,90],[-120,14,70],[-150,8,45],[-155,8,-75],[-125,8,-125],[-65,14,-175],[-10,32,-130],[35,32,-130],[35,32,-170]] },
      { id:'high', name:'城墙钟楼绕行', kind:'high', points:[[-80,14,90],[-90,14,20],[-90,24,-15],[-90,24,-30],[80,24,-30],[80,32,-130],[35,32,-130],[35,32,-170]] },
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
    identity:'骊山行宫、工匠集镇、可调度俑阵与三层地下王城', servant:'秦始皇',
    sites:[
      { id:'worktown', name:'骊山工匠集镇', nameEn:'Lishan Artisan Town', position:[-185,24,100], radius:48, purpose:'hub' },
      { id:'palace', name:'山河行宫', nameEn:'Mountain Palace', position:[0,64,240], radius:48, purpose:'landmark' },
      { id:'workshop', name:'地下铸造层', nameEn:'Buried Foundry', position:[80,46,-45], radius:24, purpose:'landmark' },
      { id:'army', name:'兵马俑军阵层', nameEn:'Terracotta Garrison', position:[-90,28,-60], radius:24, purpose:'arena' },
      { id:'royalcity', name:'地下王城中枢', nameEn:'Buried Royal City', position:[0,10,80], radius:40, purpose:'boss' },
    ],
    routes:[
      { id:'main', name:'驿道至骊山行宫', kind:'main', points:[[-185,24,100],[-185,24,190],[-60,64,200],[-60,64,240],[0,64,240],[80,64,240],[80,64,145]] },
      { id:'flank', name:'山脊工匠侧路', kind:'flank', points:[[-185,24,100],[-180,24,-210],[-40,64,-210],[165,64,-210],[165,64,145],[80,64,145]] },
      { id:'underground', name:'三层王城折返坡道', kind:'underground', points:[[80,64,145],[80,64,135],[80,46,25],[80,46,-100],[45,46,-100],[-75,28,-100],[-90,28,-100],[-90,28,20],[-90,10,140],[0,10,80]] },
    ],
  },
];

/** No grass in desert sand or on the excavated underground floor. X0,Z0,X1,Z1. */
export const EXPANSION_GRASS_CLEARANCE:readonly (readonly [number,number,number,number])[]=[
  [330,330,1055,1055],[608,-872,832,-578],
];

export interface ExpansionConnection {
  id:string; from:WorldRegionId; to:ExpansionRegionId; name:string;
  /** World-space line; the construction pass samples the old terrain without moving it. */
  points: MapPoint2[]; width:number;
}
export const EXPANSION_CONNECTIONS: ExpansionConnection[] = [
  {id:'britain-orleans',from:'britain',to:'orleans',name:'北境围城古道',points:[[-720,-120],[-720,-420],[-800,-630]],width:18},
  // Route along the southern snowfield, clear of the existing Gorge Glide descent.
  {id:'winter-qin',from:'winter',to:'qin',name:'东境山河栈道',points:[[120,-520],[420,-520],[535,-620]],width:18},
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
