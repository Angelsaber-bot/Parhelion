/** Optional False Dawn action fields. Existing chapter geometry/gates are untouched.
 * Small grounded props are installed before static collision; progress changes only
 * lamps/plates, never cover or path availability. Original maps were audited first.
 */
import * as THREE from 'three';
import { SiteArt } from './campaignSites';
import type { Marker } from './types';
import type {FalseDawnStage} from './falseDawnCampaign';
import type { RegionId } from './settlements/types';
import {FALSE_DAWN_CENTERS,FALSE_DAWN_ANCHORS,FALSE_DAWN_FIELD_ACTOR_OFFSETS,type FalseDawnFieldId} from './falseDawnSitesData';
export {FALSE_DAWN_CENTERS,FALSE_DAWN_ANCHORS} from './falseDawnSitesData';
type V3=[number,number,number];
export interface FalseDawnSiteState {readonly anchors:readonly boolean[];readonly stage:FalseDawnStage;readonly ending?:'repurpose'|'seal'|null;readonly route?:'harbor'|'winter'|null;}
export const FALSE_DAWN_SITE_LIMITS=Object.freeze({visible:180,shadowEnter:70,shadowExit:85,shadowCasters:2,trianglesPerField:9000,meshesPerField:8,materialsPerField:3});
const FALLBACK:Record<FalseDawnFieldId,ReadonlyArray<V3>>={
 alpha:[FALSE_DAWN_CENTERS.alpha,...FALSE_DAWN_ANCHORS],
 blacksail:[FALSE_DAWN_CENTERS.blacksail,[787,13.13781148257476,27],[801,13.686946225015276,27],[794,13.330206333573897,39]],
 winter:[FALSE_DAWN_CENTERS.winter,[61,4.094503873914334,-633],[75,3.676637101233837,-633],[68,4.473441560380223,-621]],
};
/** Offline previews can use audited samples; production always supplies the terrain grid. */
function approximateGround(region:FalseDawnFieldId,x:number,z:number){let value=0,weight=0;for(const p of FALLBACK[region]){const d=Math.hypot(x-p[0],z-p[2]);if(d<.01)return p[1];const w=1/(d*d);value+=p[1]*w;weight+=w;}return value/weight;}
export interface FalseDawnSiteOptions {readonly nearStructureShadows?:boolean;}
export function createFalseDawnSites(groundHeight?:(x:number,z:number)=>number|null,options:FalseDawnSiteOptions={}){
 const nearStructureShadows=options.nearStructureShadows===true,groundLayer=nearStructureShadows?'ground':'body';let shadowSite:FalseDawnFieldId|null=null,structureShadowsEnabled=nearStructureShadows;
 const root=new THREE.Group();root.name='False_Dawn_Action_Fields';const markers:Marker[]=[],collisionGeometries:THREE.BufferGeometry[]=[],sites:ReturnType<typeof build>[]=[];let disposed=false;
 function ground(region:FalseDawnFieldId,x:number,z:number){if(!groundHeight)return approximateGround(region,x,z);const h=groundHeight(x,z);if(h===null||!Number.isFinite(h))throw new Error(`False Dawn terrain unavailable at ${region}:${x},${z}`);return h;}
 function build(region:FalseDawnFieldId){
  const art=new SiteArt(),origin=FALSE_DAWN_CENTERS[region],sockets:Marker[]=[],spawnPoints:V3[]=[],foundationSupports:{x:number;z:number;bottom:number;groundMin:number;top:number}[]=[];
  const y=(x:number,z:number)=>ground(region,origin[0]+x,origin[2]+z)-origin[1];
  const marker=(id:string,label:string,x:number,z:number)=>{const m:Marker={id,type:'interact',label,p:[origin[0]+x,ground(region,origin[0]+x,origin[2]+z)+.9,origin[2]+z],radius:2.4};sockets.push(m);return m;};
   // Cut-stone and enamel housings use real chamfers, sharing the existing batches.
   function chamfer(p:V3,size:V3,color:string,solid=false,rotation:V3=[0,0,0]){
    const [w,h,d]=size,b=Math.min(.075,w*.12,h*.12,d*.12),shape=new THREE.Shape();
    shape.moveTo(-w/2+b,-h/2+b);shape.lineTo(w/2-b,-h/2+b);shape.lineTo(w/2-b,h/2-b);shape.lineTo(-w/2+b,h/2-b);shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:d-2*b,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:b,bevelThickness:b,curveSegments:1});g.translate(0,0,-d/2+b);art.add(g,color,p,[1,1,1],solid,'body',rotation);g.dispose();
   }
   function footing(p:V3,size:V3,color:string){
    const bottom=Math.min(...[-1,1].flatMap(sx=>[-1,1].map(sz=>y(p[0]+sx*size[0]/2,p[2]+sz*size[2]/2))))-.10,top=p[1]+size[1]/2;
    chamfer([p[0],(top+bottom)/2,p[2]],[size[0],top-bottom,size[2]],color,true);foundationSupports.push({x:p[0],z:p[2],bottom,groundMin:bottom+.10,top});
   }
  function cover(x:number,z:number,kind:'cargo'|'snow'){
   const h=y(x,z),wood=kind==='cargo'?'#796249':'#87949c',trim=kind==='cargo'?'#455b60':'#d9e2e4';
   footing([x,h+.7,z],[2.6,1.4,1.4],wood);
   for(const dx of[-1.15,1.15])art.box([x+dx,h+.7,z],[.13,1.46,1.5],trim);
   for(const dy of[.15,1.25])art.box([x,h+dy,z+.73],[2.7,.1,.08],trim);
   // Slatted shipment containers, with structural bands and a readable lower plinth.
   for(let i=0;i<6;i++){const yy=h+.19+i*.20;art.box([x,yy,z+.713],[2.45,.018,.027],kind==='cargo'?'#514b3e':'#697b87');for(const side of[-1,1])art.box([x+side*1.312,yy,z],[.025,.018,1.34],kind==='cargo'?'#a48a63':'#a4b5bd');}
   for(const side of[-1,1]){art.box([x+side*.63,h+.72,z+.74],[.075,1.32,.045],trim);art.box([x+side*.63,h+1.415,z],[.075,.045,1.38],trim);for(const yy of[.23,1.17])art.cyl([x+side*.63,h+yy,z+.77],.035,.025,kind==='cargo'?'#c6b180':'#d8e2df',false,'metal',[Math.PI/2,0,0]);}
   if(kind==='cargo'){art.beam([x-1.1,h+.22,z+.78],[x+1.1,h+1.18,z+.78],.09,'#c0a77c');art.paper(x,h+1.425,z,.55,.4);}
   else{art.box([x,h+1.45,z],[2.85,.16,1.65],'#e8edef');for(const dx of[-1.1,1.1])art.box([x+dx,h+.55,z+.83],[.34,1.1,.18],'#b5c5ce');}
  }
  if(region==='alpha'){
   const metal='#566b76',light='#c3d0cf',brass='#c1a06b',ink='#344c59';
   // Buried calibration paving follows the real slope, never a floating combat platform.
   function groundBand(points:[number,number][],width:number,color:string,layer:'ground'|'glow'|'briefed'|'choiceA'|'choiceB'='ground',lift=.025){
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(!length)continue;const sx=-dz/length*width/2,sz=dx/length*width/2,ps=[[a[0]+sx,a[1]+sz],[a[0]-sx,a[1]-sz],[b[0]-sx,b[1]-sz],[b[0]+sx,b[1]+sz]];
     const g=new THREE.BufferGeometry();const top=ps.flatMap(([x,z])=>[x,y(x,z)+lift,z]);const bottom=ps.flatMap(([x,z])=>[x,y(x,z)-.08,z]);g.setAttribute('position',new THREE.Float32BufferAttribute([...top,...bottom],3));g.setIndex([0,2,1,0,3,2,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);g.computeVertexNormals();art.add(g,color,[0,0,0],[1,1,1],false,layer==='ground'?groundLayer:layer);g.dispose();
    }
   }
   function groundDisc(x:number,z:number,radius:number,color:string){const g=new THREE.CircleGeometry(radius,8).rotateX(-Math.PI/2).translate(x,0,z),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,y(p.getX(i),p.getZ(i))+.022);g.computeVertexNormals();art.add(g,color,[0,0,0],[1,1,1],false,groundLayer);g.dispose();}
   // Broken service court: individually settled stone courses, not a hovering slab.
   // Gaps expose the existing grass; all vertices sample the original terrain.
   for(let ring=0;ring<3;ring++)for(let sector=0;sector<16;sector++){
    if((sector+ring*5)%11===0||(ring===2&&sector>9&&sector<13))continue;
    const a=(sector+.035)*Math.PI/8,b=(sector+.965)*Math.PI/8,r0=.5+ring*1.38,r1=r0+1.28;
    const ps:[[number,number],[number,number],[number,number],[number,number]]=[[Math.cos(a)*r0,Math.sin(a)*r0],[Math.cos(b)*r0,Math.sin(b)*r0],[Math.cos(b)*r1,Math.sin(b)*r1],[Math.cos(a)*r1,Math.sin(a)*r1]];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps.flatMap(([x,z])=>[x,y(x,z)+.018,z]),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();art.add(g,['#879b91','#94a49a','#8e9f94','#9ca99b'][(sector+ring*3)%4],[0,0,0],[1,1,1],false,groundLayer);g.dispose();
   }
   for(let i=0;i<32;i++){if(i%8===0)continue;const a=(i+.035)*Math.PI/16,b=(i+.965)*Math.PI/16;groundBand([[Math.cos(a)*5.3,Math.sin(a)*5.3],[Math.cos(b)*5.3,Math.sin(b)*5.3]],1.1,['#a3b0a9','#aab5ad','#98aaa3'][i%3],'ground',.035);groundBand([[Math.cos(a)*4.94,Math.sin(a)*4.94],[Math.cos(b)*4.94,Math.sin(b)*4.94]],.045,brass,'ground',.044);}
   for(const [a,b]of [[[6.9,6],[4.5,3.8]],[[4.5,3.8],[3.7,3]],[[3.3,2.6],[2.1,1.6]]]as[[number,number],[number,number]][])groundBand([a,b],1.45,'#9aaba6');
   // An observatory calibration arch, broken at the crown, frames the field from its road approach.
   const az=-7.9,ax=-5.9,ah=y(ax,az);
   for(const x of[-8.1,-3.7]){const h=y(x,az);
    groundDisc(x,az,.86,'#8d9682');footing([x,h+.14,az],[1.30,.28,1.30],'#9daaa5');chamfer([x,h+.36,az],[1.08,.18,1.08],light,true);chamfer([x,h+.61,az],[.72,.35,.78],metal,true);
    chamfer([x,h+1.9,az],[.56,2.35,.64],ink,true);art.box([x,h+1.9,az+.327],[.26,1.95,.025],'#71848a');art.box([x,h+1.9,az+.348],[.075,1.87,.022],brass);
    for(const dy of[.82,2.85]){chamfer([x,h+dy,az],[.70,.16,.78],light);art.box([x,h+dy,az+.4],[.34,.055,.025],brass);}
    chamfer([x,h+3.12,az],[.85,.24,.9],metal);chamfer([x,h+3.32,az],[1.02,.18,1.03],light);
    for(const sign of[-1,1])art.beam([x+sign*.47,h+.45,az],[x+sign*.25,h+1.12,az],.12,metal);
    for(const dy of[1.12,2.65])for(const dx of[-.18,.18])art.cyl([x+dx,h+dy,az+.35],.035,.025,brass,false,'metal',[Math.PI/2,0,0]);
   }
   const arch=new THREE.TorusGeometry(2.05,.12,6,26,Math.PI*1.63);art.add(arch,brass,[ax,ah+3.15,az],[1,1,1],false,'metal',[0,0,-.23]);arch.dispose();
   art.beam([-8.1,ah+3.3,az],[-7.2,ah+4.65,az],.11,ink);art.beam([-3.7,ah+3.3,az],[-4.45,ah+4.4,az],.11,ink);
   for(const side of[-1,1]){
    const px=ax+side*1.15;art.beam([ax+side*2.2,ah+3.25,az],[px,ah+3.25,az],.13,metal);art.cyl([px,ah+3.05,az],.055,1.52,brass,false,'metal');
    chamfer([px,ah+3.05,az],[.77,1.27,.17],metal,false,[0,0,side*-.24]);chamfer([px,ah+3.05,az+.10],[.61,1.08,.055],light,false,[0,0,side*-.24]);
    for(const offset of[-.32,0,.32]){const angle=side*-.24;art.box([px-Math.sin(angle)*offset,ah+3.05+Math.cos(angle)*offset,az+.139],[.46,.24,.025],'#809b9c',false,'body',[0,0,angle]);art.box([px-Math.sin(angle)*offset,ah+3.05+Math.cos(angle)*offset,az+.156],[.025,.18,.012],brass,false,'metal',[0,0,angle]);}
    art.cyl([px,ah+3.65,az],.12,.12,brass,false,'metal');art.cyl([px,ah+2.42,az],.12,.12,brass,false,'metal');
   }
   for(let i=0;i<14;i++){const a=.25+i*Math.PI/13;art.box([ax+Math.cos(a)*2.06,ah+3.15+Math.sin(a)*2.06,az+.13],[.055,.16,.045],i%3===0?light:ink,false,'metal',[0,0,a-Math.PI/2]);}
   footing([ax,ah+.13,az],[2.12,.26,1.1],'#a7b3ad');chamfer([ax,ah+.65,az],[1.8,.88,.72],metal,true);chamfer([ax,ah+1.16,az],[2,.15,.9],light);
   art.box([ax,ah+.66,az+.373],[1.35,.56,.025],ink);for(let i=0;i<7;i++)art.box([ax-.54+i*.18,ah+.66,az+.4],[.055,.42,.035],'#829699');
   art.ring([ax,ah+1.4,az+.05],.35,.045,brass);art.beam([ax,ah+1.14,az],[ax,ah+1.4,az],.09,metal);
   // One fallen housing provides an asymmetric ruin accent, outside every interaction/spawn lane.
   const fh=y(-7.8,2);art.box([-7.8,fh+.34,2],[1.7,.65,1.3],metal,true,'body',[0,.22,.12]);
   for(let i=0;i<4;i++)art.box([-8.35+i*.35,fh+.72,2],[.08,.09,1.1],light,false,'body',[0,.22,.12]);

   // The recorder has a broken transport handle, reel spools and a grounded cable clamp.
   const rx=7,rz=7,ry=y(rx,rz);
   chamfer([rx,ry+.42,rz],[1.65,.84,.95],metal,true);footing([rx,ry+.08,rz],[1.85,.16,1.12],ink);
   for(const side of[-1,1]){art.box([rx+side*.79,ry+.43,rz+.22],[.07,.42,.15],brass);for(let i=0;i<4;i++)art.box([rx+side*.833,ry+.28+i*.08,rz-.12],[.025,.025,.42],ink);}
   art.box([rx,ry+.86,rz],[1.8,.12,1.1],light);
   for(const x of[rx-.48,rx+.48]){art.cyl([x,ry+.98,rz],.3,.10,brass,false,'metal');art.cyl([x,ry+1.04,rz],.095,.035,ink);}
   art.box([rx,ry+.57,rz+.49],[.65,.25,.025],'#80969c');
   for(let i=0;i<4;i++)art.box([rx-.2+i*.13,ry+.57,rz+.51],[.025,.06+(i%2)*.08,.015],'#d6dfcf');
   art.beam([rx-.85,ry+.75,rz-.35],[rx-.85,ry+1.3,rz-.35],.065,brass);art.beam([rx-.85,ry+1.3,rz-.35],[rx-.15,ry+1.25,rz-.35],.065,brass);
   marker('false_dawn_recorder','调查遗弃的回声记录器',rx,rz-1.2);
   const cx=7,cz=0,cy=y(cx,cz);
   footing([cx,cy+.12,cz],[1.5,.24,1.05],light);chamfer([cx,cy+.7,cz],[1.2,.96,.75],ink,true);
   for(const side of[-1,1]){art.box([cx+side*.52,cy+.69,cz+.39],[.06,.78,.055],brass);for(let i=0;i<5;i++)art.box([cx+side*.607,cy+.45+i*.1,cz],[.025,.035,.42],metal);}art.box([cx,cy+1.24,cz],[1.45,.12,.95],metal,false,'body',[-.12,0,0]);
   art.ring([cx,cy+1.32,cz],.35,.055,brass,'metal',[Math.PI/2,0,0]);
   for(const dx of[-.4,0,.4])art.box([cx+dx,cy+1.35,cz+.2],[.10,.035,.18],light);
   art.box([cx,cy+.65,cz+.39],[.8,.32,.035],'#b8bc9d',false,'glow');
   marker('false_dawn_array_console','启动伪黎明阵列',cx,cz+1.2);
   FALSE_DAWN_ANCHORS.forEach((point,i)=>{
    const x=point[0]-origin[0],z=point[2]-origin[2],h=y(x,z),layer=(['briefed','choiceA','choiceB']as const)[i];
    groundDisc(x,z,1.12,'#a0b0a9');
    const foundationDepth=Math.max(.20,h-Math.min(...Array.from({length:8},(_,j)=>y(x+Math.sin(j*Math.PI/4)*.94,z+Math.cos(j*Math.PI/4)*.94)))+.12);art.cyl([x,h+(.18-foundationDepth)/2,z],.94,.18+foundationDepth,'#9caba7',true,'body');foundationSupports.push({x,z,bottom:h-foundationDepth,groundMin:Math.min(...Array.from({length:8},(_,j)=>y(x+Math.sin(j*Math.PI/4)*.94,z+Math.cos(j*Math.PI/4)*.94))),top:h+.18});art.cyl([x,h+.23,z],.82,.13,light,false,'body');art.cyl([x,h+.34,z],.68,.12,metal,true,'body');
    for(let j=0;j<4;j++){const a=j*Math.PI/2+Math.PI/4;art.cyl([x+Math.sin(a)*.69,h+.31,z+Math.cos(a)*.69],.045,.055,brass,false,'metal');art.beam([x+Math.sin(a)*.58,h+.38,z+Math.cos(a)*.58],[x+Math.sin(a)*.29,h+.79,z+Math.cos(a)*.29],.09,metal);}art.cyl([x,h+.85,z],.30,1.2,ink,true,'metal');
    art.cyl([x,h+1.38,z],.38,.16,metal,false,'metal');art.cyl([x,h+1.48,z],.52,.12,brass,false,'metal');
    for(const side of[-1,1])art.box([x+side*.306,h+.96,z],[.045,.43,.14],light);
    // Receiver I / horizontal relay II / forked transmitter III have distinct silhouettes.
    const ringY=i===1?1.78:i===2?2.22:2.04,radius=i===1?.80:.69,rotation:V3=[i===1?Math.PI/2:0,i===2?Math.PI/2:0,0];
    art.ring([x,h+ringY,z],radius,.075,light,'metal',rotation);
    if(i===0)for(const side of[-1,1])art.beam([x+side*.3,h+1.4,z],[x+side*.62,h+2.1,z],.075,brass);
    if(i===1){art.cyl([x,h+2.07,z],.055,.8,brass,false,'metal');for(const side of[-1,1])art.beam([x+side*.25,h+1.42,z],[x+side*.72,h+1.78,z],.075,metal);}
    if(i===2)for(const side of[-1,1]){art.box([x+side*.44,h+2,z],[.09,2.4,.12],brass);art.box([x+side*.44,h+3.22,z],[.16,.18,.2],light);}
    art.box([x,h+.91,z+.32],[.60,.47,.08],metal);
    for(let j=0;j<=i;j++)art.box([x+(j-i/2)*.14,h+.92,z+.37],[.045,.31,.025],'#d8c58e');
    art.ring([x,h+ringY,z],radius-.12,.07,'#cae3ac',layer,rotation);
    art.box([x,h+.23,z+.77],[.45,.08,.06],'#cae3ac',false,layer);
    // Shallow conduits visibly explain the array without catching the player's feet.
    const conduit:[number,number][]=[];const target:[number,number]=[7,0];for(let k=0;k<=10;k++)conduit.push([x+(target[0]-x)*k/10,z+(target[1]-z)*k/10]);
    groundBand(conduit,.13,ink,'ground',.036);groundBand(conduit,.035,'#c3d9ae',layer,.043);
    marker(`false_dawn_emitter_${i+1}`,['接收锚 · I','中继锚 · II','发信锚 · III'][i],x,z+(z>0?-1.35:1.35));
   });
   art.box([cx,cy+.65,cz+.435],[.65,.12,.025],'#d2e5b6',false,'resolved');
  }else if(region==='blacksail'){
   const x=0,z=-6,h=y(x,z),wood='#78604a',iron='#465f63',brass='#b7a073';
   // A salvage-built relay on a broken ship rib, open on every approach.
   for(const s of[-1,1]){art.beam([x+s*1.5,h,z-.3],[x+s*.9,h+1.2,z-.65],.16,wood,true);art.beam([x+s*.9,h+1.2,z-.65],[x+s*.5,h+2.35,z-.95],.12,wood);}
   art.box([x,h+.86,z],[2.2,.15,1.2],wood,true);
   for(const xx of[-.85,.85])art.box([x+xx,h+.38,z],[.15,.76,.9],iron,true);
   art.box([x,h+1.2,z-.1],[1.2,.55,.5],iron,true);
   art.cyl([x+1.15,h+2,z-.8],.065,4,wood,true);art.beam([x+.55,h+3.5,z-.8],[x+1.75,h+3.5,z-.8],.065,wood);
   art.lantern(x+1.15,h+2.92,z-.8,iron);
   for(const xx of[.78,1.52])art.box([x+xx,h+2.95,z-.83],[.27,.54,.055],'#7f9487');
   art.paper(x-.7,h+.97,z,.65,.75);
   // Salvaged sail shelter keeps the receiver dry; legs stay behind the clear front socket.
   for(const side of[-1,1]){const px=x+side*2.7,pz=z-.9,ph=y(px,pz);art.cyl([px,ph+1.55,pz],.085,3.1,wood,true);for(const yy of[.3,2.5])art.cyl([px,ph+yy,pz],.105,.10,brass,false,'metal');art.beam([px,ph+2.45,pz],[px,h+2.68,pz+.55],.08,wood);}
   art.beam([x-2.8,h+3,z-.9],[x+2.8,h+3,z-.9],.16,wood);for(const side of[-1,1])art.beam([x+side*2.7,h+2.35,z-.9],[x+side*1.95,h+3,z-.9],.10,wood);
   for(let strip=0;strip<5;strip++){
    const xx=x-2.8+strip*1.12;art.box([xx+.56,h+2.77,z+.05],[1.125,.045,2.06],strip%2?'#b7b29a':'#c6c0a7',false,'body',[.21,0,0]);art.beam([xx,h+3,z-.9],[xx,h+2.56,z+1.05],.025,'#7b7968');
   }
   chamfer([x,h+1.2,z-.1],[1.25,.58,.54],iron);art.box([x,h+1.22,z+.19],[.88,.35,.03],'#293e46');art.ring([x-.22,h+1.22,z+.22],.13,.03,brass);
   for(let i=0;i<3;i++)art.box([x+.18+i*.10,h+1.22,z+.23],[.035,.19,.025],'#9cac9e');
   for(const side of[-1,1]){art.box([x+side*.63,h+1.2,z-.1],[.025,.40,.055],brass);art.beam([x+side*1.05,h+.8,z+.45],[x+side*.8,h+.25,z+.45],.08,wood);}
   for(const xx of[-.7,.65]){art.cyl([x+xx,h+.99,z+.35],.15,.07,'#bba677',false,'metal');art.cyl([x+xx,h+1.03,z+.35],.095,.035,wood);}

   art.box([x+.40,h+1.43,z+.25],[.22,.08,.025],'#dae3ad',false,'resolved');
   marker('false_dawn_harbor_console','截断港口回声',x,z+1.2);cover(-6,3,'cargo');cover(6,3,'cargo');
  }else{
   const x=-4,z=-5,h=y(x,z),wood='#7b6d5c',cloth='#cfc8b1',blue='#637e92';
   // Triangular relay wind shelter: no sealed walls or roofed combat box.
   for(const s of[-1,1]){art.beam([x+s*1.8,h,z-1],[x,h+3.3,z-1],.13,wood,true);art.beam([x+s*1.8,h,z+1],[x,h+3.3,z+1],.13,wood,true);}
   art.beam([x,h+3.3,z-1.2],[x,h+3.3,z+1.2],.14,wood,true);
   for(let strip=0;strip<4;strip++){
    const zs=[z-1.24+strip*.62,z-1.24+(strip+1)*.62],positions:number[]=[],indices:number[]=[];
    for(let i=0;i<=4;i++)for(const zz of zs){const u=i/4;positions.push(x-u*1.84,h+3.3*(1-u)-Math.sin(u*Math.PI)*.13,zz);}
    for(let i=0;i<4;i++){const a=i*2;indices.push(a,a+1,a+3,a,a+3,a+2,a,a+3,a+1,a,a+2,a+3);}
    const clothGeo=new THREE.BufferGeometry();clothGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));clothGeo.setIndex(indices);const clothFaces=clothGeo.toNonIndexed();clothFaces.computeVertexNormals();art.add(clothFaces,strip%2?'#c6c0aa':cloth,[0,0,0]);clothFaces.dispose();clothGeo.dispose();
    art.beam([x,h+3.32,zs[0]],[x-1.84,h+.02,zs[0]],.025,'#a19b87');
   }
   for(const zz of[z-1,z+1]){for(const xx of[x-1.8,x+1.8]){const gy=y(xx,zz);art.cyl([xx,gy+.12,zz],.12,.35,'#68767a');}art.beam([x-1.8,h+.15,zz],[x-2.45,y(x-2.45,zz)+.08,zz],.028,'#9b8b6c');}

   for(const yoff of[.35,.75,1.15])art.box([x,h+yoff,z-1.05],[2.9,.26,.12],wood,true);
   art.box([x,h+.65,z],[1.5,1.3,.65],blue,true);art.ring([x,h+1.1,z+.35],.25,.045,'#c5b58b');
   art.box([x,h+.5,z+.34],[.65,.24,.03],'#c7d6d8');
   chamfer([x,h+.1,z],[1.68,.20,.82],'#536c7c');
   art.box([x,h+1.12,z+.375],[.8,.56,.035],'#364d5c');art.ring([x,h+1.1,z+.405],.25,.045,'#c5b58b');
   for(const xx of[-.55,.55]){art.box([x+xx,h+.7,z+.35],[.045,.94,.035],'#a6b5b7');for(let i=0;i<4;i++)art.box([x+xx*1.38,h+.35+i*.15,z],[.025,.04,.45],'#3d5461');}
   for(const dx of[-.23,0,.23])art.cyl([x+dx,h+.5,z+.39],.045,.03,'#b9ae86',false,'metal',[Math.PI/2,0,0]);
   // Supply sled behind the relay: runners and lashed bedroll, not a new loot container.
   const sz=z-2.4,sy=y(x,sz);for(const dx of[-.55,.55]){art.beam([x+dx,sy+.12,sz-.8],[x+dx,sy+.12,sz+.8],.12,wood);art.beam([x+dx,sy+.12,sz+.8],[x+dx,sy+.4,sz+1],.12,wood);}
   for(const zz of[-.65,0,.65])art.box([x,sy+.26,sz+zz],[1.3,.15,.18],'#998675');art.cyl([x,sy+.57,sz],.27,1.13,'#8c9a99',false,'body',[0,0,Math.PI/2]);for(const dx of[-.38,.38])art.box([x+dx,sy+.59,sz],[.07,.55,.56],'#6b665a');

   art.cyl([x+.65,h+1.55,z-.7],.055,3.1,wood,true);art.ring([x+.65,h+2.9,z-.7],.32,.04,blue);
   art.box([x,h+.78,z+.40],[.54,.07,.025],'#d3dfac',false,'resolved');
   marker('false_dawn_winter_console','守住雪原中继',x+.1,z+1.4);cover(-6,3,'snow');cover(6,3,'snow');
   // A genuine tactical rest point uses the existing cold system, not a healing reward.
   const bx=-7.2,bz=-4.6,bh=y(bx,bz);
   art.cyl([bx,bh+.38,bz],.42,.6,'#55636b',true,'metal');art.cyl([bx,bh+.71,bz],.49,.10,'#75858c',false,'metal');
   art.cyl([bx,bh+.76,bz],.37,.08,'#dc9a55',false,'glow');
   for(const dx of[-.2,0,.2]){const flame=new THREE.ConeGeometry(.12,.25+Math.abs(dx),5);art.add(flame,'#efbf72',[bx+dx,bh+.9,bz],[1,1,1],false,'glow');flame.dispose();}
   for(const side of[-1,1])art.beam([bx+side*.3,bh+.2,bz-.2],[bx+side*.45,bh+.02,bz+.25],.065,'#55636b',true,'metal');
   sockets.push({id:'false_dawn_warm_repeater',type:'poi',label:'中继火盆（取暖）',p:[origin[0]+bx,ground(region,origin[0]+bx,origin[2]+bz),origin[2]+bz],radius:4});

  }
  // Central lanes deliberately stay free; these are audited against final combined collision.
  for(const [x,z]of FALSE_DAWN_FIELD_ACTOR_OFFSETS[region])spawnPoints.push([origin[0]+x,ground(region,origin[0]+x,origin[2]+z)+.04,origin[2]+z]);
  art.finish(region as RegionId);
  // Accepted anchors illuminate only their grounded confirmation circuit, never the emitter body.
  // Reuse the existing array glow material; no lamp, resource, timer or extra batch is introduced.
  if(region==='alpha')for(const layer of['briefed','choiceA','choiceB']as const){const cue=art.layers.get(layer);if(cue)cue.material=art.materials.glow;}
  art.root.name=`FalseDawn_${region}`;art.root.position.set(...origin);
  for(const g of art.solids)g.translate(...origin);collisionGeometries.push(...art.solids);markers.push(...sockets);root.add(art.root);
  return{region,root:art.root,origin,markers:sockets,spawnPoints,foundationSupports,art};
 }
 for(const id of['alpha','blacksail','winter']as const)sites.push(build(id));
 let stateKey='';
 function applyState(state:FalseDawnSiteState){if(disposed)return;const key=`${state.stage}:${state.route??''}:${state.ending??''}:${state.anchors.map(Boolean).join(',')}`;if(key===stateKey)return;stateKey=key;
  const alpha=sites[0];for(let i=0;i<3;i++){const mesh=alpha.art.layers.get((['briefed','choiceA','choiceB']as const)[i]);if(mesh)mesh.visible=!!state.anchors[i]&&!(state.stage==='complete'&&state.ending==='seal');}
  const resolved=state.stage==='complete'&&state.ending==='repurpose';
  for(const s of sites){const mesh=s.art.layers.get('resolved');if(mesh)mesh.visible=resolved&&(s.region==='alpha'||s.region===(state.route==='harbor'?'blacksail':state.route));s.art.materials.glow.emissiveIntensity=s.region==='winter'?.8:resolved?.8:state.stage==='complete'?0:['array','warden','ending'].includes(String(state.stage))?.65:.1;s.root.userData.falseDawnStage=state.stage;}
 }
 applyState({anchors:[false,false,false],stage:'locked'});
 return{root,sites,markers,collisionGeometries,centers:FALSE_DAWN_CENTERS,applyState,structureShadowsSupported:nearStructureShadows,
  get structureShadowsEnabled(){return !disposed&&structureShadowsEnabled;},
  /** A non-split low-quality build cannot enable casting without rebuilding thin ground. */
  setStructureShadowsEnabled(enabled:boolean){if(disposed||enabled&&!nearStructureShadows)return false;structureShadowsEnabled=enabled;if(!enabled){shadowSite=null;for(const s of sites)for(const layer of['body','metal']as const){const mesh=s.art.layers.get(layer);if(mesh)mesh.castShadow=false;}}return true;},
  update(player:Pick<THREE.Vector3,'x'|'z'>){if(disposed)return;
   const distance2=(s:typeof sites[number])=>(player.x-s.origin[0])**2+(player.z-s.origin[2])**2;
   if(!structureShadowsEnabled||!Number.isFinite(player.x)||!Number.isFinite(player.z))shadowSite=null;
   else{const retained=sites.find(s=>s.region===shadowSite);if(!retained||distance2(retained)>FALSE_DAWN_SITE_LIMITS.shadowExit**2)shadowSite=null;
    if(!shadowSite){let nearest=FALSE_DAWN_SITE_LIMITS.shadowEnter**2;for(const s of sites){const d=distance2(s);if(d<nearest){nearest=d;shadowSite=s.region;}}}}
   for(const s of sites){s.root.visible=distance2(s)<FALSE_DAWN_SITE_LIMITS.visible**2;for(const layer of['body','metal']as const){const mesh=s.art.layers.get(layer);if(mesh)mesh.castShadow=s.root.visible&&s.region===shadowSite;}}
  },
  dispose(){if(disposed)return;disposed=true;for(const s of sites){s.root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=false;o.geometry.dispose();}});for(const g of s.art.solids)g.dispose();Object.values(s.art.materials).forEach(m=>m.dispose());s.root.clear();}root.removeFromParent();root.clear();},
 };
}
