import type {Localized} from '../settlements/types';
import type {RoutePoint} from './worldPlan';

export const ORLEANS_WORKS={
 crane:'orleans_crane_handle',craneDone:'orleans_crane_delivered',
 sluice:'orleans_sluice_winch',sluiceDone:'orleans_sluice_open',
 bell:'orleans_belfry_rope',bellDone:'orleans_belfry_rung',
} as const;
export const ORLEANS_UNDERPASS:readonly RoutePoint[]=[
 [-185.6,8.45,-48.4],[-181.5,8.45,-48.4],[-177,8.45,-48.4],
 [-163,2.4,-58],[-146,2.4,-70],[-123,2.4,-88],
 [-116,10,-118],[-125,8,-125],
];
export const ORLEANS_UNDERPASS_CUTS:readonly (readonly RoutePoint[])[]=[
 [ORLEANS_UNDERPASS[2],ORLEANS_UNDERPASS[3]],
 [ORLEANS_UNDERPASS[5],ORLEANS_UNDERPASS[6],ORLEANS_UNDERPASS[7]],
];
export const ORLEANS_SLUICE_GATE={position:[-153,2.5,-65.0588235294] as RoutePoint,yaw:Math.atan2(17,-12),width:4.8,height:4.5};
export const ORLEANS_WORK_ACTIONS:readonly {id:string;flag:string;label:Localized;position:RoutePoint;seconds:number;hint:Localized}[]=[
 {id:ORLEANS_WORKS.crane,flag:ORLEANS_WORKS.craneDone,label:['河港踏轮吊机','Harbour treadwheel crane'],position:[-185.6,8.45,-12],seconds:5,
  hint:['站稳并按住交互，将粮袋从河船吊到堤岸。','Stand still and hold Interact to lift the grain from the boat onto the quay.']},
 {id:ORLEANS_WORKS.sluice,flag:ORLEANS_WORKS.sluiceDone,label:['旧引水道检修绞盘','Old watercourse service winch'],position:[-181.5,8.56,-50],seconds:3,
  hint:['转动岸上的检修绞盘，升起城墙下的铁栅。','Turn the quay-side service winch to raise the grille beneath the wall.']},
 {id:ORLEANS_WORKS.bell,flag:ORLEANS_WORKS.bellDone,label:['钟楼报时绳','Belfry bell rope'],position:[-23,39.18,-62],seconds:1.5,
  hint:['登上钟楼三面眺廊，拉响报时钟。','Climb to the belfry gallery and pull the bell rope.']},
];
