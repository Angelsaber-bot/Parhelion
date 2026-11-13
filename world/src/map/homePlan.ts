import type {ExpansionPlan, ExpansionSite, RoutePoint} from './worldPlan';

/** Local metres, north is −Z. The valley remains west; no enclosing town wall. */
export const HOME_OFFSET = [720, 0] as const;
export const homeWorld = (p: RoutePoint): [number,number,number] => [p[0]+720,p[1],p[2]];
export interface HomeBuilding {id:string;name:string;nameEn:string;p:RoutePoint;w:number;d:number;yaw:number;kind:'house'|'home'|'lodge'|'bakery'|'grocer'|'cafe'|'tailor'|'repair'|'clinic'|'warehouse';approach:RoutePoint;}
const building=(id:string,name:string,nameEn:string,p:RoutePoint,w:number,d:number,yaw:number,kind:HomeBuilding['kind'],approach:RoutePoint):HomeBuilding=>({id,name,nameEn,p,w,d,yaw,kind,approach});
export const HOME_BUILDINGS:HomeBuilding[]=[
 building('player','主角的家','Your home',[-175,16,135],26,22,Math.PI,'home',[-175,16,110]),
 building('lodge','归乡公馆','Homeward House',[-35,16,-40],38,50,0,'lodge',[-35,16,10]),
 building('bakery','麦香面包房','Morning Loaf',[-120,16,70],16,14,Math.PI,'bakery',[-120,16,50]),
 building('grocer','风铃杂货','Windchime Grocer',[-85,16,80],14,14,Math.PI,'grocer',[-85,16,57]),
 building('cafe','海风咖啡馆','Sea Breeze Cafe',[-50,16,91],18,16,Math.PI,'cafe',[-50,16,61]),
 building('tailor','蓝线裁缝铺','Blue Thread',[-2,16,44],14,14,0,'tailor',[-2,15.4,69.5]),
 building('repair','岸边修理铺','Shore Repairs',[48,14.8,61],16,14,0,'repair',[48,14.5,82]),
 building('clinic','榆树诊所','Elm Clinic',[-115,16,-17],16,14,0,'clinic',[-115,16,10]),
 building('warehouse','港湾仓库','Harbour Store',[213,6,83],24,18,0,'warehouse',[213,6.9,116.6]),
 building('boathouse','修船棚','Boat Shed',[259,6,160],20,16,Math.PI,'repair',[259,6,139]),
 ...[-120,-80,-40,0].map((x,i)=>building(`south_${i}`,`花园街 ${i+1} 号`,`Garden Lane ${i+1}`,[x,16,163],14+(i%2)*2,14,Math.PI,'house',[x,16,130])),
 ...[30,70,110].map((x,i)=>building(`coast_${i}`,`海岸街 ${i+1} 号`,`Coast Lane ${i+1}`,[x,14-i*2,210],14,16,Math.PI,'house',[x,14-i*2,185])),
 ...[-208,-165,-122].map((x,i)=>building(`north_${i}`,`北街 ${i+1} 号`,`North Lane ${i+1}`,[x,16,-115],14,14,0,'house',[x,16,-90])),
];
export const HOME_SITES:ExpansionSite[]=[
 {id:'square',name:'归乡广场',nameEn:'Homeward Square',position:[-150,16,40],radius:28,purpose:'hub'},
 {id:'house',name:'主角的家',nameEn:'Your Home',position:[-175,16,135],radius:16,purpose:'hub'},
 {id:'lodge',name:'归乡公馆',nameEn:'Homeward House',position:[-35,16,-25],radius:19,purpose:'hub'},
 {id:'garden',name:'公馆庭院',nameEn:'House Garden',position:[20,16,-25],radius:16,purpose:'landmark'},
 {id:'practice',name:'北坡练习庭',nameEn:'North Practice Court',position:[70,16,-110],radius:22,purpose:'landmark'},
 {id:'harbour',name:'东岸港湾',nameEn:'East Harbour',position:[230,6,120],radius:24,purpose:'landmark'},
 {id:'northroad',name:'北门驿道',nameEn:'North Road',position:[40,16,-250],radius:20,purpose:'landmark'},
 {id:'park',name:'南岸花园',nameEn:'South Garden',position:[-105,16,115],radius:18,purpose:'landmark'},
];
export const HOME_ROUTES:ExpansionPlan['routes']=[
 {id:'main',name:'归乡主街与下港路',kind:'main',points:[[-150,16,40],[-40,16,60],[80,14,90],[230,6,120]]},
 {id:'north',name:'广场至北门驿道',kind:'flank',points:[[-150,16,40],[-134,16,-45],[-90,16,-80],[0,16,-180],[40,16,-250]]},
 {id:'housewalk',name:'广场回家',kind:'flank',points:[[-150,16,40],[-175,16,92],[-175,16,110],[-175,16,126]]},
 {id:'lodgewalk',name:'公馆与庭院',kind:'flank',points:[[-150,16,40],[-115,16,10],[-35,16,10],[-35,16,-25]]},
 {id:'practicewalk',name:'庭院至北坡练习庭',kind:'flank',points:[[-35,16,10],[0,16,10],[20,16,-25],[70,16,-60],[70,16,-110],[0,16,-180]]},
 {id:'southloop',name:'花园生活环线',kind:'flank',points:[[-175,16,110],[-120,16,130],[-40,16,130],[0,16,130],[70,14,150],[160,9,170],[230,6,120]]},
 {id:'coastwalk',name:'南岸散步道',kind:'flank',points:[[0,16,130],[30,14,185],[70,12,185],[110,10,185],[160,9,170]]},
 {id:'northlane',name:'北街',kind:'flank',points:[[-208,16,-90],[-165,16,-90],[-122,16,-90],[-90,16,-80]]},
];
/** Match the generated 7m/5m streets and each 3.5m threshold ramp. */
export const HOME_GRASS_PATHS = [
 ...HOME_ROUTES.map(r=>({width:r.kind==='main'?7:5,points:r.points.map(homeWorld)})),
 ...HOME_BUILDINGS.map(h=>{
  const point=(z:number):[number,number,number]=>[h.p[0]+Math.sin(h.yaw)*z+720,h.p[1]+.12,h.p[2]+Math.cos(h.yaw)*z];
  return {width:3.5,points:[homeWorld(h.approach),point(h.d/2+2.5),point(h.d/2-1)]};
 }),
];
/** Actual room/corridor/doorway waypoints: do not interpolate through bedroom walls. */
export const SABER_HOME_WALK:RoutePoint[]=[[-47,16.12,-36],[-39,16.12,-36],[-35,16.12,-36],[-35,16.12,-18],[-35,16.12,-10],[-35,16.12,10],[0,16.12,10],[20,16.12,-25],[0,16.12,10],[-35,16.12,10],[-35,16.12,-18],[-24,16.12,-18],[-35,16.12,-18],[-35,16.12,-36],[-47,16.12,-36]];
export const HOME_ACTIONS=[
 {id:'home_register',label:['公馆入住簿','House guest book'],p:[-31,17,-21]},
 {id:'home_rest',label:['在家休息','Rest at home'],p:[-170,17,134]},
 {id:'home_letters',label:['查看家信与旅途记录','Letters and journey journal'],p:[-177,21.3,128]},
 {id:'home_meal',label:['准备一份热饭','Prepare a warm meal'],p:[-24,17,-18]},
 {id:'home_notice',label:['归乡广场公告栏','Homeward noticeboard'],p:[-167,17,35]},
 {id:'home_saber_talk',label:['与 Saber 交谈','Talk to Saber'],p:[-47,17,-36]},
] as const;
/** Authored lamps share the existing fixed light pool; no extra unbounded lights. */
export const HOME_LIGHTS=[
 [-168,19.2,132],[-175,23.1,135],[-24,19.8,-21],[-46,19.8,-21],[-35,19.8,-48],
 ...[-1,1].flatMap(side=>Array.from({length:4},(_,i)=>[-35+side*12,19.8,-60+i*8])),
 ...HOME_BUILDINGS.filter(h=>!['home','lodge'].includes(h.kind)).map(h=>[h.p[0],h.p[1]+3.7,h.p[2]]),
].map(p=>({p:p as [number,number,number],color:'#ffe0ad',intensity:28,distance:18}));
