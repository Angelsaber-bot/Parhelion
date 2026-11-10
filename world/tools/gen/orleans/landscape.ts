import * as THREE from 'three';
import {fbm,smoothstep,lerp} from '../rng';
import {distToSegment} from '../geo';
import {distanceToLine,type ExpansionPlan,type MapPoint2} from '../../../src/map/worldPlan';

/** A spring in the eastern foothills flows past the city to the northwest estuary. */
const riverCurve=new THREE.CatmullRomCurve3([
  [295,245],[185,253],[30,235],[-95,190],[-175,115],[-205,30],[-213,-85],[-255,-240],[-325,-345],
].map(([x,z])=>new THREE.Vector3(x,0,z)));
export const ORLEANS_RIVER:MapPoint2[]=riverCurve.getPoints(180).map(p=>[p.x,p.z]);
export function riverDistance(x:number,z:number):number {
  let d=Infinity;for(let i=1;i<ORLEANS_RIVER.length;i++)d=Math.min(d,distToSegment(x,z,[...ORLEANS_RIVER[i-1]],[...ORLEANS_RIVER[i]]));return d;
}
export const ORLEANS_WALL:MapPoint2[]=[[-145,-77],[-90,-30],[-36,-22],[22,-26],[80,-30],[137,-72],[154,-150],[112,-245],[22,-273],[-82,-241],[-143,-164],[-145,-77]];
export const ORLEANS_LANES=[
  [[-150,132],[-125,114],[-80,90],[-20,100],[50,80],[105,53],[157,43]],
  [[-137,11],[-105,32],[-76,41],[-55,70]],
  [[-125,-125],[-65,-175],[-10,-130],[35,-130]],
  [[-130,150],[-58,151],[-1,116],[62,82],[142,65]],
  [[-1,116],[30,135],[65,130],[100,110],[125,85],[157,43]],
] as const;
export const ORLEANS_LANE_POINTS=ORLEANS_LANES.map((line,index)=>{
  // The hillside lane shares the graded flank road: smoothing across its bends
  // would cut the inside bank and leave a lip along the road's stone edge.
  if(index===2){
    const points:MapPoint2[]=[];
    for(let i=1;i<line.length;i++){
      const a=line[i-1],b=line[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);
      for(let j=i===1?0:1;j<=n;j++)points.push([lerp(a[0],b[0],j/n),lerp(a[1],b[1],j/n)]);
    }return points;
  }
  return new THREE.CatmullRomCurve3(line.map(([x,z])=>new THREE.Vector3(x,0,z))).getPoints(60).map(p=>[p.x,p.z] as const);
});
export const ORLEANS_BUILDING_FAMILIES=['river-merchant','stone-arcade','harbour-warehouse','narrow-street-house','artisan-workshop','oriel-corner-house'] as const;
export const TOWN_HOUSES=[
  [-112,116,13,12,.25],[-109,64,12,14,-.3],[-66,132,12,13,.2],[-41,112,14,12,.65],[-135,35,11,15,.2],
  [-116,2,13,13,.55],[-68,15,13,12,-.2],[-45,45,11,14,-.45],[-12,69,13,12,.4],[17,98,15,12,.2],
  [25,50,12,14,-.4],[54,21,14,12,-.1],[77,61,13,16,-.6],[94,18,14,12,-.4],[119,54,12,15,-.7],
  [149,25,14,12,-.8],[172,74,14,16,-.5],[125,83,14,12,.2],[60,119,13,15,.3],[96,159,14,13,.6],
  [-18,137,14,12,.15],[-146,-105,12,14,.45],[-110,-116,12,14,.4],[-86,-83,11,15,-.2],[-66,-58,13,13,.2],
  [-72,-166,12,14,.3],[-40,-186,13,15,.2],[-12,-100,11,14,.25],[58,-80,12,12,-.3],[106,-102,13,14,-.4],
  [112,-189,11,14,-.3],[82,-230,12,13,.2],[-22,-234,11,14,.4],[-122,158,12,12,.5],[-177,158,13,14,.7],
] as const;

export function orleansAuthoredHeight(plan:ExpansionPlan,x:number,z:number):number {
  let y=14+fbm((x-720)*.008,(z-720)*.008,4,1489)*6+fbm(x*.035,z*.035,2,1491)*.8;
  // An asymmetric hill rather than a rectangular cathedral plinth.
  const hill=Math.hypot((x-28)/100,(z+177)/106)+fbm(x*.018,z*.018,2,1493)*.12;
  y=lerp(y,32,1-smoothstep(.55,1.72,hill));
  y+=7*Math.exp(-((x-248)**2/6500+(z+185)**2/14000));
  // The town occupies the river terrace, feathered into orchard slopes.
  const terrace=Math.hypot((x+12)/188,(z-65)/139)+.06*Math.sin(x*.03+z*.02);
  y=lerp(y,14,1-smoothstep(.75,1.2,terrace));
  for(const site of plan.sites){
    if(site.id==='ramparts')continue;
    y=lerp(y,site.position[1],1-smoothstep(site.radius*.6,site.radius*.6+22,Math.hypot(x-site.position[0],z-site.position[2])));
  }
  for(const route of plan.routes.filter(r=>r.kind==='main'||r.kind==='flank'||r.id==='wallworks'))for(let i=1;i<route.points.length;i++){
    if(route.id==='wallworks'&&i>=4)continue;
    const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[2]-a[2];
    const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1),0,1);
    y=lerp(y,lerp(a[1],b[1],t),1-smoothstep(5,16,distToSegment(x,z,[a[0],a[2]],[b[0],b[2]])));
  }
  // Water is a real channel at the world's sea level. Bridges stay above the bed.
  const d=riverDistance(x,z),source=1-smoothstep(258,305,x);
  y=lerp(y,lerp(-2.5,y,smoothstep(10,37,d)),source);
  return y;
}
export function orleansTerrainColor(plan:ExpansionPlan,x:number,y:number,z:number):THREE.Color {
  const d=riverDistance(x,z),noise=fbm(x*.035,z*.035,3,1495);
  const c=new THREE.Color(y<.5?'#668f87':d<23?'#b7ad85':noise>.18?'#8d9c65':noise<-.2?'#6b8956':'#7d965d');
  const lane=Math.min(...ORLEANS_LANE_POINTS.map(line=>distanceToLine(x,z,line)),...plan.routes.filter(r=>r.kind!=='high').map(r=>distanceToLine(x,z,r.points.map(p=>[p[0],p[2]] as const))));
  if(d>28)c.lerp(new THREE.Color('#b0a17f'),1-smoothstep(2.5,8,lane));
  if(d>35&&y>24)c.lerp(new THREE.Color('#b9b195'),smoothstep(24,42,y)*.25);
  return c.multiplyScalar(1+noise*.12);
}
