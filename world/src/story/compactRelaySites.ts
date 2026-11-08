/** A single authored tactical pocket beside the existing armory. Never moves collision for progress. */
import * as THREE from 'three';
import { SiteArt } from './campaignSites';
import type { Marker } from '../core/types';
import {COMPACT_RELAY,COMPACT_RELAY_SITE,COMPACT_RELAY_COVER,COMPACT_RELAY_PLATFORM} from './compactRelaySitesData';
export interface CompactRelayVisualState {readonly active:boolean;readonly complete:boolean;readonly progress:number;}
export const COMPACT_RELAY_ART_LIMITS=Object.freeze({meshes:6,triangles:2500,materials:3,lights:0,visible:180});
type V3=[number,number,number];
export function createCompactRelaySites(groundHeight:(x:number,z:number)=>number|null){
 const art=new SiteArt(),root=art.root;let disposed=false;
 const ground=(x:number,z:number)=>{const y=groundHeight(x,z);if(y===null||!Number.isFinite(y))throw Error(`Compact relay terrain unavailable at ${x},${z}`);return y;};
 const sampled=(p:readonly[number,number,number]):V3=>[p[0],ground(p[0],p[2]),p[2]];
 const anchor=sampled(COMPACT_RELAY_SITE.anchor),entry=sampled(COMPACT_RELAY_SITE.entry),channelStand=sampled(COMPACT_RELAY_SITE.channelStand),deployment=sampled(COMPACT_RELAY_SITE.deployment),arrival=sampled(COMPACT_RELAY_SITE.arrival),enemySockets=COMPACT_RELAY_SITE.enemySockets.map(sampled);
 const grey='#7c8585',blue='#3d5967',trim='#b7b7a3',orange='#b77c48',ink='#34434a';
 for(const c of COMPACT_RELAY_COVER){const base=ground(c.x,c.z),bottom=Math.min(...[-1,1].flatMap(sx=>[-1,1].map(sz=>ground(c.x+sx*c.width/2,c.z+sz*c.depth/2))))-.08,top=base+c.height;
  art.box([c.x,(top+bottom)/2,c.z],[c.width,top-bottom,c.depth],c.id==='service_baffle'?blue:grey,true);
  // Layered cast-concrete cap or service equipment joints, not identical repeated crates.
  if(c.id==='service_baffle'){
   for(const z of[-1.9,-.65,.65,1.9])art.box([c.x-.415,base+1.1,c.z+z],[.045,1.9,.045],trim);
   for(const side of[-1,1])art.box([c.x+side*.42,base+1.95,c.z],[.035,.13,4.8],orange);
  }else{
   art.box([c.x,top+.035,c.z],[c.width+.12,.07,c.depth+.08],trim);
   for(const x of[-.35,.35])art.box([c.x+x*c.width,base+c.height*.5,c.z+c.depth/2+.018],[.1,c.height*.8,.035],orange);
   if(c.id==='flank_cable_spool')for(const x of[-.7,.7])art.cyl([c.x+x,top+.07,c.z],.3,.08,ink,false,'metal');
  }
 }
 const p=COMPACT_RELAY_PLATFORM,x0=p.x-p.width/2,x1=p.x+p.width/2,base=ground(p.x,p.deckStart),top=base+p.rise;
 function wedge(z0:number,z1:number,y0:number,y1:number){
  const bottom=Math.min(ground(x0,z0),ground(x1,z0),ground(x0,z1),ground(x1,z1))-.08;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([x0,y0,z0,x1,y0,z0,x1,y1,z1,x0,y1,z1,x0,bottom,z0,x1,bottom,z0,x1,bottom,z1,x0,bottom,z1],3));
  g.setIndex([0,2,1,0,3,2,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,4,5,6,4,6,7]);g.computeVertexNormals();art.add(g,grey,[0,0,0],[1,1,1],true);g.dispose();
 }
 wedge(p.north,p.deckStart,ground(p.x,p.north)+.008,top);wedge(p.deckStart,p.deckEnd,top,top);wedge(p.deckEnd,p.south,top,ground(p.x,p.south)+.008);
 // Flush edge paint follows the actual slab inclines and never changes the walkable surface.
 for(const side of[-1,1])for(const [z0,z1,y0,y1]of[[p.north,p.deckStart,ground(p.x,p.north)+.018,top+.01],[p.deckStart,p.deckEnd,top+.01,top+.01],[p.deckEnd,p.south,top+.01,ground(p.x,p.south)+.018]])art.beam([p.x+side*(p.width/2-.18),y0,z0],[p.x+side*(p.width/2-.18),y1,z1],.025,orange);
 // Raised deck has open firing edges. Low diagonal braces sit below, never a phantom guard rail.
 for(const z of[215,219])art.box([p.x+p.width/2+.018,base+.55,z],[.025,.75,.09],ink);
 function board(point:V3,color:string){const[x,y,z]=point;for(const dx of[-.38,.38])art.box([x+dx,y+.55,z-.9],[.06,1.1,.07],blue);art.box([x,y+1,z-.9],[1,.65,.07],color);for(let i=0;i<3;i++)art.box([x-.08,y+1.17-i*.13,z-.852],[.6-i*.07,.025,.015],ink);}
 board(entry,trim);board(deployment,trim);
 // Distinct single control cabinet faces its standing socket; no collision appears during channeling.
 art.box([anchor[0],anchor[1]+.65,anchor[2]-1.2],[1.25,1.3,.55],blue);
 art.box([anchor[0],anchor[1]+1.1,anchor[2]-.91],[1,.32,.025],ink);
 art.ring([anchor[0]-.28,anchor[1]+1.1,anchor[2]-.885],.1,.018,trim);
 for(let i=0;i<3;i++)art.box([anchor[0]+.02+i*.2,anchor[1]+1.1,anchor[2]-.88],[.12,.2,.018],orange,false,(['briefed','choiceA','choiceB']as const)[i]);
 art.box([deployment[0]+.33,deployment[1]+1.18,deployment[2]-.85],[.13,.13,.022],'#789b79',false,'resolved');
 art.finish('alpha');root.name='CompactRelay_ArmoryServiceYard';root.userData.scope='three covers and two-ramp maintenance deck; original helipad and buildings preserved';
 const markers:Marker[]=[{id:COMPACT_RELAY.entry,type:'interact',label:'军械庭院 · 巡卫实战演练',p:[entry[0],entry[1]+.9,entry[2]],radius:1.5},{id:COMPACT_RELAY.controller,type:'interact',label:'训练控制柜 · 持续接通',p:[anchor[0],anchor[1]+.9,anchor[2]],radius:1.65},{id:COMPACT_RELAY.deployment,type:'interact',label:'前沿部署板 · 废弃前哨站南门外',p:[deployment[0],deployment[1]+.9,deployment[2]],radius:1.65}];
 function applyState(state:CompactRelayVisualState){if(disposed)return;const progress=state.active?(Number.isFinite(state.progress)?THREE.MathUtils.clamp(state.progress,0,1):0):state.complete?1:0;(['briefed','choiceA','choiceB']as const).forEach((key,i)=>{art.layers.get(key)!.visible=progress>i/3;});art.layers.get('resolved')!.visible=state.complete;}
 applyState({active:false,complete:false,progress:0});
 return{root,markers,collisionGeometries:art.solids,anchor,entry,arrival,channelStand,deployment,enemySockets,applyState,
 update(player:Pick<THREE.Vector3,'x'|'z'>){if(!disposed)root.visible=Math.hypot(player.x-anchor[0],player.z-anchor[2])<COMPACT_RELAY_ART_LIMITS.visible;},
 dispose(){if(disposed)return;disposed=true;root.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh)m.geometry.dispose();});for(const g of art.solids)g.dispose();Object.values(art.materials).forEach(m=>m.dispose());root.removeFromParent();root.clear();},
 };
}
