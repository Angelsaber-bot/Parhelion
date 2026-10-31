/** Optional False Dawn action fields. Existing chapter geometry/gates are untouched.
 * Small grounded props are installed before static collision; progress changes only
 * lamps/plates, never cover or path availability. Original maps were audited first.
 */
import * as THREE from 'three';
import { SiteArt } from './campaignSites';
import type { Marker } from './types';
import type { RegionId } from './settlements/types';
import {FALSE_DAWN_CENTERS,FALSE_DAWN_ANCHORS,FALSE_DAWN_ACTOR_OFFSETS,type FalseDawnFieldId} from './falseDawnSitesData';
export {FALSE_DAWN_CENTERS,FALSE_DAWN_ANCHORS} from './falseDawnSitesData';
type V3=[number,number,number];
export interface FalseDawnSiteState {readonly anchors:readonly boolean[];readonly stage:string|number;readonly ending?:string|null;}
export const FALSE_DAWN_SITE_LIMITS=Object.freeze({visible:180,trianglesPerField:6000,meshesPerField:8,materialsPerField:3});
const FALLBACK:Record<FalseDawnFieldId,ReadonlyArray<V3>>={
 alpha:[FALSE_DAWN_CENTERS.alpha,...FALSE_DAWN_ANCHORS],
 blacksail:[FALSE_DAWN_CENTERS.blacksail,[787,13.13781148257476,27],[801,13.686946225015276,27],[794,13.330206333573897,39]],
 winter:[FALSE_DAWN_CENTERS.winter,[61,4.094503873914334,-633],[75,3.676637101233837,-633],[68,4.473441560380223,-621]],
};
/** Offline previews can use audited samples; production always supplies the terrain grid. */
function approximateGround(region:FalseDawnFieldId,x:number,z:number){let value=0,weight=0;for(const p of FALLBACK[region]){const d=Math.hypot(x-p[0],z-p[2]);if(d<.01)return p[1];const w=1/(d*d);value+=p[1]*w;weight+=w;}return value/weight;}
export function createFalseDawnSites(groundHeight?:(x:number,z:number)=>number|null){
 const root=new THREE.Group();root.name='False_Dawn_Action_Fields';const markers:Marker[]=[],collisionGeometries:THREE.BufferGeometry[]=[],sites:ReturnType<typeof build>[]=[];let disposed=false;
 function ground(region:FalseDawnFieldId,x:number,z:number){if(!groundHeight)return approximateGround(region,x,z);const h=groundHeight(x,z);if(h===null||!Number.isFinite(h))throw new Error(`False Dawn terrain unavailable at ${region}:${x},${z}`);return h;}
 function build(region:FalseDawnFieldId){
  const art=new SiteArt(),origin=FALSE_DAWN_CENTERS[region],sockets:Marker[]=[],spawnPoints:V3[]=[];
  const y=(x:number,z:number)=>ground(region,origin[0]+x,origin[2]+z)-origin[1];
  const marker=(id:string,label:string,x:number,z:number)=>{const m:Marker={id,type:'interact',label,p:[origin[0]+x,ground(region,origin[0]+x,origin[2]+z)+.9,origin[2]+z],radius:2.4};sockets.push(m);return m;};
  function cover(x:number,z:number,kind:'cargo'|'snow'){
   const h=y(x,z),wood=kind==='cargo'?'#796249':'#87949c',trim=kind==='cargo'?'#455b60':'#d9e2e4';
   art.box([x,h+.7,z],[2.6,1.4,1.4],wood,true);
   for(const dx of[-1.15,1.15])art.box([x+dx,h+.7,z],[.13,1.46,1.5],trim);
   for(const dy of[.15,1.25])art.box([x,h+dy,z+.73],[2.7,.1,.08],trim);
   if(kind==='cargo'){art.beam([x-1.1,h+.22,z+.78],[x+1.1,h+1.18,z+.78],.09,'#c0a77c');art.paper(x,h+1.425,z,.55,.4);}
   else{art.box([x,h+1.45,z],[2.85,.16,1.65],'#e8edef');for(const dx of[-1.1,1.1])art.box([x+dx,h+.55,z+.83],[.34,1.1,.18],'#b5c5ce');}
  }
  if(region==='alpha'){
   const metal='#566b76',light='#c3d0cf',brass='#c1a06b',ink='#344c59';
   // The recorder has a broken transport handle, reel spools and a grounded cable clamp.
   const rx=7,rz=7,ry=y(rx,rz);
   art.box([rx,ry+.42,rz],[1.65,.84,.95],metal,true);
   art.box([rx,ry+.86,rz],[1.8,.12,1.1],light);
   for(const x of[rx-.48,rx+.48]){art.cyl([x,ry+.98,rz],.3,.10,brass,false,'metal');art.cyl([x,ry+1.04,rz],.095,.035,ink);}
   art.box([rx,ry+.57,rz+.49],[.65,.25,.025],'#80969c');
   for(let i=0;i<4;i++)art.box([rx-.2+i*.13,ry+.57,rz+.51],[.025,.06+(i%2)*.08,.015],'#d6dfcf');
   art.beam([rx-.85,ry+.75,rz-.35],[rx-.85,ry+1.3,rz-.35],.065,brass);art.beam([rx-.85,ry+1.3,rz-.35],[rx-.15,ry+1.25,rz-.35],.065,brass);
   marker('false_dawn_recorder','调查遗弃的回声记录器',rx,rz-1.2);
   const cx=7,cz=0,cy=y(cx,cz);
   art.box([cx,cy+.6,cz],[1.2,1.2,.75],ink,true);art.box([cx,cy+1.24,cz],[1.45,.12,.95],metal,false,'body',[-.12,0,0]);
   art.ring([cx,cy+1.32,cz],.35,.055,brass,'metal',[Math.PI/2,0,0]);
   for(const dx of[-.4,0,.4])art.box([cx+dx,cy+1.35,cz+.2],[.10,.035,.18],light);
   art.box([cx,cy+.65,cz+.39],[.8,.32,.035],'#b8bc9d',false,'glow');
   marker('false_dawn_array_console','启动伪黎明阵列',cx,cz+1.2);
   FALSE_DAWN_ANCHORS.forEach((point,i)=>{
    const x=point[0]-origin[0],z=point[2]-origin[2],h=y(x,z),layer=(['briefed','choiceA','choiceB']as const)[i];
    art.cyl([x,h+.16,z],.8,.32,metal,true,'body');art.cyl([x,h+.63,z],.30,.78,ink,true,'metal');
    art.cyl([x,h+1.08,z],.52,.12,brass,false,'metal');
    // Distinct orientation and Roman plates survive color-vision differences.
    art.ring([x,h+1.52,z],.52,.065,light,'metal',[i===1?Math.PI/2:0,i===2?Math.PI/2:0,0]);
    art.box([x,h+.69,z+.32],[.54,.34,.08],metal);
    for(let j=0;j<=i;j++)art.box([x+(j-i/2)*.13,h+.7,z+.37],[.04,.23,.025],'#d8c58e');
    art.ring([x,h+1.52,z],.43,.07,'#cae3ac',layer,[i===1?Math.PI/2:0,i===2?Math.PI/2:0,0]);
    art.box([x,h+.23,z+.77],[.45,.08,.06],'#cae3ac',false,layer);
    marker(`false_dawn_emitter_${i+1}`,['接收锚 · I','中继锚 · II','发信锚 · III'][i],x,z+(z>0?-1.35:1.35));
   });
   art.box([cx,cy+.65,cz+.435],[.65,.12,.025],'#d2e5b6',false,'resolved');
  }else if(region==='blacksail'){
   const x=0,z=-6,h=y(x,z),wood='#78604a',iron='#465f63',brass='#b7a073';
   // A salvage-built relay on a broken ship rib, open on every approach.
   for(const s of[-1,1]){art.beam([x+s*1.5,h,z-.3],[x+s*.9,h+1.2,z-.65],.16,wood,true);art.beam([x+s*.9,h+1.2,z-.65],[x+s*.5,h+2.35,z-.95],.12,wood);}
   art.box([x,h+.86,z],[2.2,.15,1.2],wood,true);
   for(const xx of[-.85,.85])art.box([x+xx,h+.38,z],[.15,.76,.9],iron,true);
   art.box([x,h+1.2,z-.1],[1.2,.55,.5],iron,true);art.ring([x,h+1.22,z+.17],.19,.035,brass);
   art.cyl([x+1.15,h+2,z-.8],.065,4,wood,true);art.beam([x+.55,h+3.5,z-.8],[x+1.75,h+3.5,z-.8],.065,wood);
   art.lantern(x+1.15,h+2.92,z-.8,iron);
   for(const xx of[.78,1.52])art.box([x+xx,h+2.95,z-.83],[.27,.54,.055],'#7f9487');
   art.paper(x-.7,h+.97,z,.65,.75);
   art.box([x,h+1.23,z+.17],[.22,.12,.035],'#dae3ad',false,'resolved');
   marker('false_dawn_harbor_console','截断港口回声',x,z+1.2);cover(-6,3,'cargo');cover(6,3,'cargo');
  }else{
   const x=-4,z=-5,h=y(x,z),wood='#7b6d5c',cloth='#cfc8b1',blue='#637e92';
   // Triangular relay wind shelter: no sealed walls or roofed combat box.
   for(const s of[-1,1]){art.beam([x+s*1.8,h,z-1],[x,h+3.3,z-1],.13,wood,true);art.beam([x+s*1.8,h,z+1],[x,h+3.3,z+1],.13,wood,true);}
   art.beam([x,h+3.3,z-1.2],[x,h+3.3,z+1.2],.14,wood,true);
   art.box([x-1,h+1.7,z],[3.8,.06,2.5],cloth,false,'body',[0,0,-1.04]);
   for(const yoff of[.35,.75,1.15])art.box([x,h+yoff,z-1.05],[2.9,.26,.12],wood,true);
   art.box([x,h+.65,z],[1.5,1.3,.65],blue,true);art.ring([x,h+1.1,z+.35],.25,.045,'#c5b58b');
   art.box([x,h+.5,z+.34],[.65,.24,.03],'#c7d6d8');
   art.cyl([x+.65,h+1.55,z-.7],.055,3.1,wood,true);art.ring([x+.65,h+2.9,z-.7],.32,.04,blue);
   art.box([x,h+.5,z+.38],[.54,.07,.025],'#d3dfac',false,'resolved');
   marker('false_dawn_winter_console','守住雪原中继',x+.1,z+1.4);cover(-6,3,'snow');cover(6,3,'snow');
  }
  // Central lanes deliberately stay free; these are audited against final combined collision.
  for(const [x,z]of FALSE_DAWN_ACTOR_OFFSETS)spawnPoints.push([origin[0]+x,ground(region,origin[0]+x,origin[2]+z)+.04,origin[2]+z]);
  art.finish(region as RegionId);art.root.name=`FalseDawn_${region}`;art.root.position.set(...origin);
  for(const g of art.solids)g.translate(...origin);collisionGeometries.push(...art.solids);markers.push(...sockets);root.add(art.root);
  return{region,root:art.root,origin,markers:sockets,spawnPoints,art};
 }
 for(const id of['alpha','blacksail','winter']as const)sites.push(build(id));
 let stateKey='';
 function applyState(state:FalseDawnSiteState){if(disposed)return;const key=`${state.stage}:${state.ending??''}:${state.anchors.map(Boolean).join(',')}`;if(key===stateKey)return;stateKey=key;
  const alpha=sites[0];for(let i=0;i<3;i++){const mesh=alpha.art.layers.get((['briefed','choiceA','choiceB']as const)[i]);if(mesh)mesh.visible=!!state.anchors[i]&&!(state.stage==='complete'&&state.ending==='seal');}
  const resolved=state.stage==='complete'&&state.ending==='repurpose';
  for(const s of sites){const mesh=s.art.layers.get('resolved');if(mesh)mesh.visible=resolved;s.art.materials.glow.emissiveIntensity=resolved?.8:state.stage==='complete'?0:['array','warden','ending'].includes(String(state.stage))?.65:.1;s.root.userData.falseDawnStage=state.stage;}
 }
 applyState({anchors:[false,false,false],stage:'dormant'});
 return{root,sites,markers,collisionGeometries,centers:FALSE_DAWN_CENTERS,applyState,
  update(player:Pick<THREE.Vector3,'x'|'z'>){if(disposed)return;for(const s of sites){const dx=player.x-s.origin[0],dz=player.z-s.origin[2];s.root.visible=dx*dx+dz*dz<FALSE_DAWN_SITE_LIMITS.visible**2;}},
  dispose(){if(disposed)return;disposed=true;for(const s of sites){s.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});for(const g of s.art.solids)g.dispose();Object.values(s.art.materials).forEach(m=>m.dispose());s.root.clear();}root.removeFromParent();root.clear();},
 };
}
