import type { ExpansionRegionId, WorldRegionId } from '../core/regionIdentity';
import {ORLEANS_UNDERPASS} from './orleansWorks';
import {HOME_SITES, HOME_ROUTES} from './homePlan';

export type MapPoint2 = readonly [number, number];
export type RoutePoint = readonly [number, number, number];
export interface ExpansionSite {
  id: string; name: string; nameEn: string; position: RoutePoint; radius: number;
  purpose: 'hub' | 'landmark' | 'arena' | 'boss';
}
export interface ExpansionPlan {
  id: ExpansionRegionId; name: string; nameEn: string; offset: [number, number];
  /** Half turn in place: the plan's authored (x,z) sits at world offset + (-x,-z). */
  rotated?: boolean;
  /** Local landmark envelope; surrounding terrain continues into every neighbour. */
  outline: MapPoint2[]; color: string; stone: string; accent: string;
  identity: string; servant: string; sites: ExpansionSite[];
  routes: { id: string; name: string; kind: 'main' | 'flank' | 'high' | 'underground'; points: RoutePoint[] }[];
}

/** Authored plan coordinates → world (the plan's own frame may be turned half a circle). */
export function planToWorld(plan:{offset:readonly [number,number];rotated?:boolean},x:number,z:number):[number,number]{
  return plan.rotated?[plan.offset[0]-x,plan.offset[1]-z]:[plan.offset[0]+x,plan.offset[1]+z];
}
export function worldToPlan(plan:{offset:readonly [number,number];rotated?:boolean},x:number,z:number):[number,number]{
  return plan.rotated?[plan.offset[0]-x,plan.offset[1]-z]:[x-plan.offset[0],z-plan.offset[1]];
}

// The journey grows north from 幻日谷 (2026-11-10 layout), in story order:
//   ⑦奥尔良 | ⑥古埃及 | ④京都
//   ⑤秦     | ③永冬   | ②黑帆
//   ①落日王国 | 幻日谷  | 主角城镇
export const WORLD_PLAN = {
  cellSize: 720, columns: 3, rows: 3,
  topology: 'continuous-mainland', interiorBarriers: false,
  bounds: [-1080, 1080, -1800, 360] as const,
  storyOrder: ['britain', 'blacksail', 'winter', 'kyoto', 'qin', 'egypt', 'orleans'] as const,
  /** Deliberately outside the overworld: the Orleans dragon is a regional boss. */
  finale: { id: 'convergence', separateMap: true, requiredRegions: ['britain', 'blacksail', 'winter', 'kyoto', 'orleans', 'egypt', 'qin'] as const, status: 'planned' },
};

export const EXPANSION_PLANS: ExpansionPlan[] = [
  {
    id: 'orleans', name: '奥尔良', nameEn: 'Orleans', offset: [-720, -1440],
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
    id:'egypt', name:'古埃及', nameEn:'Solar Egypt', offset:[0,-1440], rotated:true,
    outline:[[-295,-235],[-150,-310],[-30,-300],[30,-300],[170,-320],[295,-205],[325,-35],[270,95],[315,230],[140,325],[-20,285],[-190,325],[-320,170],[-300,30],[-388,30],[-388,-30],[-300,-30]],
    color:'#c6a168', stone:'#dcc18b', accent:'#49a8ae',
    identity:'绿洲与日河、砂岩台地与裂日峡谷、双巨像、太阳神殿与引光机关、台地下的太阳船墓', servant:'奥兹曼迪亚斯',
    sites:[
      { id:'oasis', name:'商队绿洲', nameEn:'Caravan Oasis', position:[-165,14,110], radius:30, purpose:'hub' },
      { id:'quay', name:'日河码头', nameEn:'Sun River Quay', position:[-30,10,140], radius:10, purpose:'landmark' },
      { id:'canyon', name:'裂日峡谷', nameEn:'Sunrift Canyon', position:[-92,19,-104], radius:10, purpose:'landmark' },
      { id:'tombs', name:'峡谷崖墓', nameEn:'Canyon Rock Tombs', position:[-66,24,-126], radius:8, purpose:'landmark' },
      { id:'colossi', name:'双巨像庭院', nameEn:'Court of Colossi', position:[80,24,20], radius:30, purpose:'landmark' },
      { id:'temple', name:'太阳神殿', nameEn:'Sun Temple', position:[80,30,-112], radius:20, purpose:'boss' },
      { id:'roofshrine', name:'屋顶太阳祭坛', nameEn:'Roof Sun Altar', position:[56,40,-145], radius:6, purpose:'landmark' },
      { id:'barque', name:'太阳船墓室', nameEn:'Tomb of the Solar Barque', position:[72,14,-252], radius:12, purpose:'landmark' },
      { id:'pyramid', name:'日之金字塔', nameEn:'Pyramid of the Sun', position:[156,37,-181], radius:10, purpose:'landmark' },
      { id:'trial', name:'引光试炼台', nameEn:'Solar Trial', position:[160,18,112], radius:26, purpose:'arena' },
      { id:'mortuary', name:'崖壁祭庙', nameEn:'Temple of the Cliff', position:[195,26,-58], radius:18, purpose:'landmark' },
      { id:'sacredlake', name:'神殿圣湖', nameEn:'Sacred Lake', position:[132,30,-116], radius:14, purpose:'landmark' },
      { id:'village', name:'工匠村', nameEn:"Workmen's Village", position:[-84,16,14], radius:16, purpose:'landmark' },
      { id:'quarry', name:'方尖碑采石场', nameEn:'Obelisk Quarry', position:[-174,26.7,-150], radius:14, purpose:'landmark' },
      { id:'treasury', name:'太阳船墓宝库', nameEn:'Treasury of the Barque', position:[116,14,-253], radius:8, purpose:'landmark' },
      { id:'fallen', name:'沙中残像', nameEn:'The Trunkless Legs', position:[208,15.4,62], radius:10, purpose:'landmark' },
    ],
    routes:[
      { id:'main', name:'绿洲—码头—狮身像大道—神殿', kind:'main', points:[[-165,14,110],[-100,12.3,124],[-30,10,140],[0,13,110],[40,19,76],[74,24,48],[80,24,40],[80,24,20],[80,24,-40],[80,30,-78],[80,30,-112],[80,30,-128],[74,30,-140],[74,30,-162],[80,30,-170],[80,30,-182]] },
      { id:'canyon', name:'裂日峡谷侧路', kind:'flank', points:[[-165,14,110],[-150,14,40],[-128,14.2,-38],[-112,16,-70],[-92,19,-104],[-66,24,-126],[-36,29.5,-128],[-6,33,-122],[20,31.5,-114],[34,30,-110],[44,30,-110],[50,30,-100]] },
      { id:'roof', name:'神殿屋顶上层', kind:'high', points:[[80,30,-97],[52,30,-97],[52,30,-99],[52,40,-123],[46,40,-124],[46,40,-146],[52,40,-150]] },
      { id:'causeway', name:'神殿西侧至金字塔堤道', kind:'flank', points:[[80,30,-82],[124,30,-82],[124,30,-150],[140,32.5,-166],[150,36,-176],[156,37,-181]] },
      { id:'trialroad', name:'巨像庭院至试炼台', kind:'flank', points:[[80,24,20],[98,24,44],[106,21.5,62],[136,19,94],[160,18,112]] },
      { id:'tomb', name:'圣所后门下至太阳船墓', kind:'underground', points:[[80,30,-182],[80,30,-192],[80,14,-236],[80,14,-244],[72,14,-252]] },
      { id:'mortuary', name:'巨像庭院至崖壁祭庙', kind:'flank', points:[[80,24,20],[110,24,18],[134,19.5,22],[160,16.2,28],[195,16,34],[195,16,12]] },
      { id:'terraces', name:'祭庙三层台地', kind:'high', points:[[195,16,12],[195,16,-4],[195,21,-24],[195,21,-28],[195,26,-46],[195,26,-66],[195,26,-76]] },
      { id:'village', name:'峡谷路至工匠村', kind:'flank', points:[[-150,14,40],[-118,15,26],[-84,16,14]] },
      { id:'quarry', name:'峡谷至方尖碑采石场', kind:'flank', points:[[-92,19,-104],[-112,26,-116],[-134,33,-128],[-158,34,-143],[-166,30.2,-146.5],[-174,26.7,-150]] },
      { id:'treasury', name:'太阳船墓至宝库', kind:'underground', points:[[80,14,-244],[92,14,-253],[104,14,-253],[116,14,-253]] },
    ],
  },
  {
    id:'qin', name:'秦帝国', nameEn:'Qin Empire', offset:[-720,-720], rotated:true,
    outline:[[-285,-250],[-130,-325],[35,-300],[205,-330],[315,-175],[270,-25],[325,110],[215,290],[30,300],[-30,300],[-180,320],[-310,175],[-300,30],[-300,-30],[-335,-130]],
    color:'#7d926e', stone:'#929b94', accent:'#bd5343',
    identity:'骊山之上的帝国，骊山之下的不死王城：驿道、工匠集镇、夯土宫城与三层地宫', servant:'秦始皇',
    sites:[
      { id:'worktown', name:'骊山工匠集镇', nameEn:'Lishan Artisan Town', position:[-185,22,100], radius:34, purpose:'hub' },
      { id:'pass', name:'骊水关', nameEn:'Li River Pass', position:[-70,27,82], radius:10, purpose:'landmark' },
      { id:'palace', name:'骊山宫城', nameEn:'Mount Li Palace', position:[40,70,0], radius:16, purpose:'landmark' },
      { id:'kilns', name:'龙窑窑场', nameEn:'Dragon Kiln Yard', position:[-208,24,54], radius:10, purpose:'landmark' },
      { id:'archive', name:'简牍库', nameEn:'Bamboo-slip Archive', position:[-212,22,138], radius:8, purpose:'landmark' },
      { id:'quarry', name:'南坡石料场', nameEn:'South Slope Quarry', position:[-128,28,-42], radius:12, purpose:'landmark' },
      { id:'pavilion', name:'宫城观阙', nameEn:'Palace Watch Tower', position:[90,82,-32], radius:6, purpose:'landmark' },
      { id:'workshop', name:'地下铸造层', nameEn:'Buried Foundry', position:[130,46,-96], radius:16, purpose:'landmark' },
      { id:'army', name:'兵马俑军阵层', nameEn:'Terracotta Garrison', position:[-17,28,-130], radius:20, purpose:'arena' },
      { id:'royalcity', name:'地下王城', nameEn:'Buried Royal City', position:[38,10,-190], radius:18, purpose:'boss' },
      { id:'mausoleum', name:'骊山陵园', nameEn:'Lishan Mausoleum Park', position:[12,36,-298.5], radius:30, purpose:'landmark' },
      { id:'chariots', name:'铜车马坑', nameEn:'Bronze Chariot Pit', position:[104,10,-169], radius:10, purpose:'landmark' },
      { id:'armoury', name:'石铠甲坑', nameEn:'Stone Armour Pit', position:[55,10,-134], radius:10, purpose:'landmark' },
      { id:'waterfowl', name:'青铜水禽坑', nameEn:'Bronze Waterfowl Pit', position:[55,10,-217], radius:10, purpose:'landmark' },
    ],
    routes:[
      { id:'main', name:'驿道—集镇—关隘—宫城', kind:'main', points:[[-185,22,100],[-140,23,86],[-100,25,80],[-70,27,82],[-35,31,92],[5,37,108],[45,44,116],[80,50,108],[70,55,98],[42,57.6,98],[40,58,90],[40,58,56],[40,58,44],[40,70,16],[40,70,0]] },
      { id:'aqueduct', name:'沿输水渠潜入宫城', kind:'flank', points:[[-185,22,100],[-150,22.6,96],[-140,25,60],[-122,30,26],[-96,37,0],[-64,46,-16],[-34,56,-26],[-8,66,-31],[2,70,-29],[14,70,-28],[36,70,-30]] },
      { id:'ridge', name:'骊山山脊绕至观阙', kind:'high', points:[[-185,22,100],[-200,23,62],[-212,26,20],[-214,30,-12],[-182,40,-44],[-150,50,-72],[-118,61,-96],[-85,72,-116],[-50,84,-130],[-15,95,-140],[25,104,-131],[60,111,-118],[84,103,-96],[98,93,-72],[100,86,-50],[92,82,-40],[90,82,-28],[80,82,-28],[48,70,-28],[40,70,-30]] },
      { id:'quarry-path', name:'水渠岔道至石料场', kind:'flank', points:[[-122,30,26],[-125,30,-8],[-128,28,-42]] },
      { id:'palace-descent', name:'宫后斜道至铸造层与运俑轨道', kind:'underground', points:[[40,70,-30],[40,70,-44],[40,62,-68],[40,62,-72.5],[44.5,62,-72.5],[100,46,-72.5],[106,46,-72.5],[106,46,-115],[100,46,-115],[30,28,-115],[20,28,-115]] },
      { id:'maintenance', name:'石料场检修道', kind:'underground', points:[[-128,28,-42],[-125,28,-56],[-125,28,-110.5],[-125,28,-115],[-120.5,28,-115],[-60,28,-115],[-50,28,-115]] },
      { id:'royal-descent', name:'斜井下至地下王城', kind:'underground', points:[[-17,28,-130],[-17,28,-160],[-17,19,-185.5],[-17,19,-190],[-12.5,19,-190],[31,10,-190],[38,10,-190]] },
      { id:'chariot-pit', name:'王城东门至铜车马坑', kind:'underground', points:[[38,10,-190],[44,10,-195],[66,10,-195],[74,10,-188],[76,10,-176],[88,10,-176],[90,10,-170],[120,10,-170]] },
      { id:'armour-pit', name:'王城南门至石铠甲坑', kind:'underground', points:[[38,10,-190],[36,10,-178],[40,10,-162],[55,10,-160],[55,10,-154],[55,10,-131]] },
      { id:'waterfowl-pit', name:'王城北门至青铜水禽坑', kind:'underground', points:[[38,10,-190],[44,10,-195],[55,10,-196],[55,10,-202],[55,10,-219]] },
    ],
  },
  {
    // The protagonist's harbour town: lived-in houses, a shared residence and the homeward loop.
    id:'home', name:'主角城镇', nameEn:'Home Town', offset:[720,0],
    outline:[[-300,-260],[-120,-320],[120,-300],[300,-200],[320,40],[250,260],[60,320],[-180,300],[-320,120]],
    color:'#86a85e', stone:'#c9b892', accent:'#d9a441',
    identity:'幻日谷东侧的港湾城镇：主角的家，从者在此落脚，旅程从这里出发、最后回到这里', servant:'',
    sites:HOME_SITES,
    routes:HOME_ROUTES,
  },
];

/** Grass already follows green ground, so desert sand needs no rectangle (a straight
 * clearance edge would show across the Kyoto and Black Sail joins). Only Qin's
 * rammed-earth palace platforms are cleared. X0,Z0,X1,Z1. */
export const EXPANSION_GRASS_CLEARANCE:readonly (readonly [number,number,number,number])[]=[
  [-824,-798,-722,-678],
];
/** World-space centre/radii of Orleans' worn paved courts; rounded ground stays rounded. */
export const ORLEANS_PAVED_COURTS:readonly (readonly [number,number,number,number])[]=[[-685,-1552,20,12],[-800,-1350,23,18]];

export interface ExpansionConnection {
  id:string; from:WorldRegionId; to:ExpansionRegionId; name:string;
  /** World-space road across broad, continuous land; never the only crossing. */
  points: MapPoint2[]; width:number;
}
export const EXPANSION_CONNECTIONS: ExpansionConnection[] = [
  // Over the desert's western flank to the Loire, entering Orleans by its south gate road.
  {id:'egypt-orleans',from:'egypt',to:'orleans',name:'沙海西境古道',points:[[-200,-1520],[-470,-1240],[-720,-1140],[-800,-1350]],width:18},
  // From the snowfield west of the city to Qin's post road (which faces 永冬 after the half turn).
  {id:'winter-qin',from:'winter',to:'qin',name:'西境山河驿道',points:[[-140,-780],[-420,-800],[-535,-820]],width:18},
  // Both ends turned half a circle: the caravan road still runs from Kyoto's west gate to the oasis.
  {id:'kyoto-egypt',from:'kyoto',to:'egypt',name:'沙海商队古道',points:[[600,-1440],[300,-1440],[165,-1550]],width:18},
  // 幻日谷's old east pass now leads home.
  {id:'alpha-home',from:'alpha',to:'home',name:'归乡大道',points:[[300,30],[420,30],[570,40]],width:18},
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
