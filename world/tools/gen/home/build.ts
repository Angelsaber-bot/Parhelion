import * as THREE from 'three';
import {Batch,T} from '../geo';
import {Frame,gable,strip} from '../orleans/craft';
import type {Piece} from '../structures';
import {HOME_BUILDINGS,HOME_SITES,HOME_LIGHTS,type HomeBuilding} from '../../../src/map/homePlan';
import type {RoutePoint} from '../../../src/map/worldPlan';

const C={wall:'#e6ddc9',stone:'#b9b5a7',roof:'#9b5e4b',blue:'#4d7180',wood:'#92714e',dark:'#3d4b50',glass:'#83b3c2',cream:'#f4e8cd',green:'#6f8966',metal:'#596b70'};
const cyl=new THREE.CylinderGeometry(1,1,1,12),sphere=new THREE.IcosahedronGeometry(1,1);
const glazing=new WeakMap<Batch,Batch>();
function table(f:Frame,x:number,z:number,w=3,d=1.6,y=0){
 f.box(x,y+.88,z,w,.18,d,C.wood);for(const sx of[-1,1])for(const sz of[-1,1])f.box(x+sx*(w/2-.18),y+.42,z+sz*(d/2-.18),.13,.84,.13,C.dark);
}
function chair(f:Frame,x:number,z:number,y=0){f.box(x,y+.45,z,.65,.13,.65,C.wood);f.box(x,y+.92,z-.27,.65,.9,.12,C.blue);for(const dx of[-.24,.24])for(const dz of[-.24,.24])f.box(x+dx,y+.22,z+dz,.09,.44,.09,C.dark);}
function bed(f:Frame,x:number,z:number,y=0){f.box(x,y+.30,z,2.15,.6,3.5,C.wood);f.box(x,y+.7,z,2.05,.35,3.4,C.cream);f.box(x,y+.91,z+.6,2.06,.12,2,C.blue,false);f.box(x,y+.98,z-1.05,1.5,.22,.7,C.cream,false);f.box(x,y+.8,z-1.8,2.3,1.6,.16,C.wood);}
function shelves(f:Frame,x:number,z:number,y=0){
 for(const xx of[-1.5,1.5])f.box(x+xx,y+1.4,z,.12,2.8,.8,C.wood);
 for(const yy of[.3,1.2,2.1,2.8]){f.box(x,y+yy,z,3.2,.12,.85,C.wood);if(yy<2.8)for(let i=0;i<6;i++)f.box(x-1.2+i*.43,y+yy+.36,z,.25,.6,.5,[C.blue,C.green,C.roof][i%3],false);}
}
function window(f:Frame,x:number,y:number,z:number,w=2,h=1.8,a=0,clear=false){
 const q=f.point(x,0,z),wall=new Frame(f.b,q.x,f.y,q.z,f.a+a);
 const glass=clear&&glazing.get(f.b);if(glass)new Frame(glass,q.x,f.y,q.z,f.a+a).box(0,y,0,w,h,.08,C.glass);else wall.box(0,y,0,w,h,.08,C.glass,false);
 for(const xx of[-w/2,w/2])wall.box(xx,y,.08,.12,h+.25,.12,C.cream,false);
 for(const yy of[-h/2,h/2])wall.box(0,y+yy,.08,w+.3,.12,.15,C.cream,false);
 wall.box(0,y,.1,.09,h,.12,C.cream,false);wall.box(0,y,.1,w,.08,.12,C.cream,false);
 wall.box(0,y-h/2-.12,.18,w+.5,.15,.5,C.stone,false);
 for(const side of[-1,1]){wall.box(side*(w/2+.3),y,0,.35,h+.1,.16,C.blue,false);for(let i=0;i<5;i++)wall.box(side*(w/2+.3),y-h*.35+i*h*.17,.12,.36,.04,.05,C.cream,false);}
}
/** Real window openings, divided into capped wall strips around the glass panes. */
function windowWall(f:Frame,axis:'x'|'z',at:number,length:number,height:number,centers:number[],levels:number[]){
 const xs=[-length/2,...centers.flatMap(c=>[c-1,c+1]),length/2].sort((a,b)=>a-b),ys=[0,...levels.flatMap(y=>[y-.9,y+.9]),height].sort((a,b)=>a-b);
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
  const x=(xs[i]+xs[i-1])/2,y=(ys[j]+ys[j-1])/2;
  if(centers.some(c=>Math.abs(x-c)<1)&&levels.some(c=>Math.abs(y-c)<.9))continue;
  if(axis==='x')f.box(at,y,x,.4,ys[j]-ys[j-1],xs[i]-xs[i-1],C.wall);else f.box(x,y,at,xs[i]-xs[i-1],ys[j]-ys[j-1],.4,C.wall);
 }
}
/** The wall has a real 3.2 m opening with lintel, never a transparent collider. */
function doorWall(f:Frame,axis:'x'|'z',at:number,span:number,height:number,center=0,bottom=0){
 const side=(span-3.2)/2;
 for(const s of[-1,1]){const c=s*(1.6+side/2);if(axis==='z')f.box(c,bottom+height/2,at,side,height,.35,C.wall);else f.box(at,bottom+height/2,c,.35,height,side,C.wall);}
 if(axis==='z')f.box(center,bottom+(height+3.3)/2,at,3.2,height-3.3,.35,C.wall);else f.box(at,bottom+(height+3.3)/2,center,.35,height-3.3,3.2,C.wall);
}
function shell(b:Batch,h:HomeBuilding,height=4.2){
 const [x,y,z]=h.p,f=new Frame(b,x,y,z,h.yaw),w=h.w,d=h.d;
 f.box(0,-.9,0,w+.6,2,d+.6,C.stone); // top at +0.1, terrain cleared underneath
 f.box(0,.02,0,w,.2,d,C.wood);
 const levels=height>8?[2.4,6.3]:[2.4];
 for(const side of[-1,1])windowWall(f,'x',side*w/2,d,height,[-d*.25,d*.25],levels);
 windowWall(f,'z',-d/2,w,height,[-w*.3,w*.3],levels);
 doorWall(f,'z',d/2,w,height);
 for(const xx of[-w*.30,w*.30])window(f,xx,2.4,d/2+.23,Math.min(2.8,w*.2),1.8);
 for(const level of levels){for(const s of[-1,1])for(const zz of[-d*.25,d*.25])window(f,s*(w/2+.23),level,zz,2,1.8,s*Math.PI/2,true);
 for(const xx of[-w*.3,w*.3])window(f,xx,level,-d/2-.23,2,1.8,Math.PI,true);}
 f.box(0,.3,d/2+.2,w+.4,.4,.25,C.stone,false);
 // Threshold ramp meets the actual street. One uninterrupted top avoids capsule snags.
 const door=f.point(0,.12,d/2-1),porch=f.point(0,.12,d/2+2.5);
 strip(b,[h.approach,[porch.x,porch.y,porch.z],[door.x,door.y,door.z]],3.5,C.stone);
 for(const s of[-1,1])f.box(s*1.8,1.65,d/2+.25,.15,3.3,.2,C.blue,false);
 f.box(0,3.35,d/2+.25,3.75,.18,.22,C.blue,false);
 return f;
}
function roof(f:Frame,w:number,d:number,height:number,index=0){
 gable(f,w,d,height,2.5+(index%3)*.5,index%3===1?'#637d83':C.roof);
 for(const s of[-1,1]){f.box(s*(w/2+.65),height-.08,0,.15,.15,d+1.4,C.metal,false);f.box(s*(w/2+.3),height/2,-d/2-.4,.12,height,.12,C.metal,false);}
 f.box(w*.25,height+1.5,-d*.2,.9,3,1,C.stone);f.box(w*.25,height+3,-d*.2,1.2,.2,1.3,C.cream,false);
}
function ordinary(b:Batch,h:HomeBuilding,index:number){
 const f=shell(b,h),w=h.w,d=h.d;roof(f,w,d,4.2,index);
 f.box(0,4.1,0,w,.16,d,C.cream); // a finished ceiling below the roof attic
 if(h.kind==='house'){
   bed(f,-w*.28,-d*.22);table(f,w*.27,-d*.25,2,1.3);chair(f,w*.27,-d*.25+1.2);shelves(f,w*.25,d*.22);
 }else{
   // An open central aisle; furniture belongs against the side and rear walls.
   shelves(f,-w/2+2,-d*.18);table(f,w/2-2,-d*.1,2.8,2);
   if(h.kind==='clinic'){bed(f,-w/2+2,d*.18);f.box(w*.25,2,-d*.1,1,.7,.8,C.cream,false);}
   else if(h.kind==='cafe'){for(const xx of[-w*.27,w*.27]){table(f,xx,d*.15,2,1.5);chair(f,xx,d*.15-1.2);chair(f,xx,d*.15+1.2);}}
   else if(h.kind==='bakery'){f.box(w*.28,1,-d*.28,2.8,2,2.5,C.stone);f.box(w*.28,1.2,-d*.28+1.3,1.6,.9,.08,C.dark,false);for(let i=0;i<4;i++)f.cyl(-w*.28+i*.6,.95,-d*.2,.22,.15,'#d2a86c',false);}
   else if(h.kind==='tailor'){f.box(w*.28,1.3,-d*.2,.6,1.1,.4,C.blue,false);f.box(w*.28,1.95,-d*.2,1,.5,.5,C.cream,false);}
   else if(h.kind==='repair'){for(let i=0;i<5;i++)f.box(w*.28,1.3+i*.17,-d*.1,1.9,.04,.10,C.metal,false);}
   else if(h.kind==='warehouse'){for(const s of[-1,1])for(let k=0;k<3;k++){f.box(s*(w/2-2),.6,-d/2+2+k*2.3,2,1.2,1.8,C.wood);f.box(s*(w/2-2),1.2,-d/2+2+k*2.3,2.1,.08,1.9,C.metal,false);}}
   const canopy=h.kind==='cafe'||h.kind==='bakery'||h.kind==='grocer';
   if(canopy){f.box(0,3.35,d/2+1.8,w*.8,.16,3.6,h.kind==='bakery'?C.cream:C.blue,false);for(const xx of[-w*.4,w*.4])f.box(xx,1.65,d/2+3.3,.12,3.3,.12,C.metal,false);}
 }
}
function playerHouse(b:Batch,h:HomeBuilding){
 const f=shell(b,h,8.6),w=h.w,d=h.d;
 // First-floor partitions have openings onto the central hall.
 // Open-plan kitchen/living room leaves the stair approach unobstructed.
 // Floor leaves a real stairwell along the east interior wall, with a rear landing.
 f.box(-3,4.23,0,20,.22,d,C.wood);f.box(9,4.23,-9.7,6,.22,2.6,C.wood);f.box(9,4.23,9.7,6,.22,2.6,C.wood);
 f.box(-3,4.10,0,20,.025,d,C.cream,false);f.box(0,8.5,0,w,.16,d,C.cream);
 const ramp:RoutePoint[]=[];for(const [zz,yy]of[[8, .12],[-8,4.34],[-10,4.34]]as const){const p=f.point(9,yy,zz);ramp.push([p.x,p.y,p.z]);}strip(b,ramp,3.8,C.wood);
 for(let i=0;i<20;i++)f.box(9,.12+i*4.22/20,7.6-i*.8,3.8,.12,.75,C.wood,false);
 f.beam([6.9,.95,8],[6.9,5.17,-8],.12,C.blue);for(let i=0;i<9;i++)f.box(6.9,1+i*.53,7-i*2,.1,1,.1,C.blue,false);
 for(const xx of[-w*.3,w*.3])window(f,xx,6.3,d/2+.23,2.5,2.1);
 roof(f,w,d,8.6,1);
 // Living room, real kitchen, upstairs bedroom and writing corner.
 f.box(-7,.48,4,4.5,.9,1.6,C.blue);f.box(-7,1.1,4.7,4.5,.7,.2,C.blue);table(f,-7,1.5,2.8,1.4);
 f.box(-9,.65,-7,5,1.3,1.4,C.cream);f.box(-9,1.38,-7,5,.15,1.5,C.stone);
 for(const xx of[-10,-8])f.cyl(xx,1.5,-7,.35,.04,C.dark,false);
 table(f,-1,-7,3,1.6);chair(f,-1,-5.5);shelves(f,-10,8);
 bed(f,-7,-6,4.34);table(f,4,5,2.5,1.5,4.34);chair(f,4,7,4.34);shelves(f,-9,6,4.34);
 f.box(-7,5.2,4.5,3,.1,2,C.cream,false);
 f.box(-7,.14,1.8,7,.018,5,'#8c9c99',false); // rug stays above the real floor
 for(const x of[-10,-6,-2]){
   f.box(x,2.5,-d/2+.23,2.7,1.65,.15,C.wood,false);
   f.box(x,2.5,-d/2+.33,2.45,1.4,.06,C.blue,false);
   f.box(x,2.3,-d/2+.38,2.45,.25,.02,'#a2b693',false);
 }
 // Covered front veranda with a clear middle doorway.
 f.box(0,-.1,d/2+2,w+.8,.4,4,C.stone);f.box(0,4,d/2+2,w+1,.22,4.5,C.blue);
 for(const xx of[-w/2+1,w/2-1])f.box(xx,1.9,d/2+3.5,.22,3.8,.22,C.cream);
}
function lodge(b:Batch,h:HomeBuilding){
 const f=shell(b,h,5),w=h.w,d=h.d;
 // The intersecting roof wings sit above one continuous interior ceiling.
 f.box(0,4.92,0,w,.16,d,C.cream);
 // Two wings, eight actual rooms. Every room has a 2.8 m door onto the centre corridor.
 for(const side of[-1,1])for(let i=0;i<4;i++){
   const z=-20+i*8,room=new Frame(b,f.point(side*12,0,z).x,f.y,f.point(side*12,0,z).z,f.a);
   const gap=2.8,wall=5,seg=(8-gap)/2;
   for(const s of[-1,1])f.box(side*wall,2.5,z+s*(gap/2+seg/2),.24,5,seg,C.wall);
   f.box(side*wall,4.15,z,.24,1.7,gap,C.wall);
   if(i<3)f.box(side*12,2.5,z+4,14,5,.24,C.wall);
   bed(room,side*3,-.4);table(room,-side*2,-1.5,2,1.3);chair(room,-side*2,-3);shelves(room,0,2.8);
   f.box(side*5.17,2,z+2,.08,.35,1,C.blue,false);
 }
 // Shared dining room and kitchen in the broad southern end.
 for(const x of[-12,11]){table(f,x,19,4,2.3);for(const dx of[-1.2,1.2]){chair(f,x+dx,17);chair(f,x+dx,21);}}
 f.box(12,.7,10,8,1.4,1.5,C.cream);f.box(12,1.46,10,8,.12,1.6,C.stone);for(const x of[10,12])f.cyl(x,1.55,10,.32,.03,C.dark,false);
 shelves(f,-14,11);f.box(-11,.6,13,4.5,1,1.7,C.blue);
 // Independent roof wings and the raised central lantern give the house its own silhouette.
 for(const side of[-1,1]){const p=f.point(side*12,0,-5);roof(new Frame(b,p.x,f.y,p.z),14,40,5,1);}
 roof(new Frame(b,f.x,f.y,f.z+17),w,16,5,0);gable(f,10,d,5.9,2.6,C.blue);
 for(const z of[-16,0,16]){const q=new Frame(b,f.x,f.y,f.z+z);window(q,0,6.3,3,3,1.4);}
}
export function buildHome(heightAt:(x:number,z:number)=>number):Piece[]{
 const pieces:Piece[]=[],make=(name:string,material='M_Toon',outline=true)=>{const batch=new Batch(`home_${name}`,material);pieces.push({name:batch.name,material,batch,outline});return batch;};
 const buildings=make('Buildings'),glass=make('Glazing','M_HomeGlass',false),publicArt=make('PublicSpaces'),harbour=make('Harbour'),trunks=make('Trees_Trunks'),leaves=make('Trees_Leaves','M_Foliage',false);glazing.set(buildings,glass);
 for(const [i,h]of HOME_BUILDINGS.entries()){
   if(h.kind==='home')playerHouse(buildings,h);else if(h.kind==='lodge')lodge(buildings,h);else ordinary(buildings,h,i);
   // The continent's final coast can lower a seaward corner after local grading.
   // Extend the stone footing to that actual ground, including beneath the boat shed.
   const f=new Frame(buildings,...h.p,h.yaw);let bottom=h.p[1]-1.9;
   for(const x of[-h.w/2-.3,0,h.w/2+.3])for(const z of[-h.d/2-.3,0,h.d/2+.3]){const p=f.point(x,0,z);bottom=Math.min(bottom,heightAt(p.x,p.z)-.4);}
   if(bottom<h.p[1]-1.91){const relative=bottom-h.p[1];f.box(0,(relative-1.9)/2,0,h.w+.6,-1.9-relative,h.d+.6,C.stone);}
 }
 pieces.find(p=>p.name==='home_Buildings')!.userData={buildings:HOME_BUILDINGS};
 // Individual front gardens and household objects keep repeated shells from feeling vacant.
 for(const [i,h]of HOME_BUILDINGS.entries()){
  const f=new Frame(publicArt,...h.p,h.yaw),side=h.w*.36;
  f.box(-side,.34,h.d/2+1.2,1.9,.65,1,C.stone);for(const dx of[-.6,0,.6]){const p=f.point(-side+dx,.9,h.d/2+1.2);leaves.add(sphere,i%2?'#9ea96e':'#7e9b79',T(p.x,p.y,p.z,0,.42,.5,.4),false);}
  if(h.kind==='house'||h.kind==='home'){
   f.box(side,1,h.d/2+.5,.8,.6,.4,C.blue,false);f.box(side,.45,h.d/2+.5,.1,.9,.1,C.wood,false);
   f.box(-h.w/2-1, .4,-h.d*.15,1.1,.8,1.1,C.wood);f.box(-h.w/2-1, .88,-h.d*.15,1.2,.12,1.2,C.metal,false);
   for(const z of[-h.d*.25,h.d*.1]){f.box(h.w/2+2,.65,z,.16,1.3,.16,C.cream);f.box(h.w/2+2,1.1,z,.12,.15,h.d*.35,C.cream,false);}
  }
 }
 for(const light of HOME_LIGHTS){const [x,y,z]=light.p,f=new Frame(publicArt,x,y,z);f.cyl(0,0,0,.5,.12,C.cream,false);f.cyl(0,.14,0,.18,.22,C.metal,false);f.cyl(0,.62,0,.025,.85,C.metal,false);}
 // Broad, irregular paved courts have walkable, slope-feathered shoulders.
 for(const site of HOME_SITES.filter(s=>['square','garden','practice','park'].includes(s.id))){
   const [x,y,z]=site.position,r=site.id==='square'?25:site.id==='practice'?20:14;
   const fan:number[]=[];for(let i=0;i<48;i++){const a=i/48*Math.PI*2,q=(i+1)/48*Math.PI*2;fan.push(x,y+.1,z,x+Math.cos(q)*r,y+.1,z+Math.sin(q)*r,x+Math.cos(a)*r,y+.1,z+Math.sin(a)*r);}
   const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(fan,3));publicArt.add(g,site.id==='practice'?'#af9270':'#c8c0ad',new THREE.Matrix4());g.dispose();
 }
 // Fountain is off the arrival/road centre, leaving all through-routes open.
 const sq=new Frame(publicArt,-155,16,53);sq.cyl(0,.35,0,3.4,.7,C.stone);sq.cyl(0,.75,0,2.8,.08,'#629ba3',false);sq.cyl(0,1.2,0,.35,1.4,C.stone);sq.cyl(0,1.9,0,1.1,.2,C.cream);
 for(const [x,z]of[[-168,52],[-140,24],[12,-40],[30,-32],[-115,105]]){const f=new Frame(publicArt,x,heightAt(x,z)+.1,z);f.box(0,.5,0,3,.16,.8,C.wood);f.box(0,.96,-.35,3,.8,.12,C.blue);for(const xx of[-1.1,1.1])f.box(xx,.25,0,.12,.5,.6,C.metal);}
 for(const [x,z]of[[-169,35],[-190,117],[-30,-22]]){const f=new Frame(publicArt,x,16,z);for(const dx of[-1.2,1.2])f.box(dx,1,0,.13,2,.13,C.wood);f.box(0,1.8,0,2.8,1.4,.14,C.blue);}
 // Practice equipment stays outside the traversed centreline.
 for(const x of[57,83]){const f=new Frame(publicArt,x,16,-116);f.box(0,1.1,0,.3,2.2,.3,C.wood);f.box(0,1.8,0,1.6,.2,.25,C.wood);f.cyl(0,2.5,0,.3,.5,C.cream);}
 // Harbour masonry, piles and a deck leading out over the tidal inlet.
 const quay=new Frame(harbour,250,6,112);quay.box(0,-4,0,22,8,50,C.stone);quay.box(30,-.1,0,62,.4,6,C.wood);
 for(const x of[0,12,24,36,48,60])for(const side of[-1,1])quay.box(x-1,-4,side*2.4,.5,8,.5,C.wood);
 for(let x=2;x<60;x+=1.3)quay.box(x,.15,0,.08,.06,5.9,C.dark,false);
 const slip=new Frame(harbour,264,6,144);slip.box(0,-.25,0,12,.5,20,C.stone);
 for(const x of[-5,5])for(const z of[-8,0,8])slip.box(x,-3.5,z,.5,7,.5,C.wood);
 for(const x of[-.5,2.5])slip.box(x,.08,0,.13,.15,16,C.metal,false);
 // A small lighthouse sits north of the pier, not across its approach.
 const light=new Frame(harbour,250,6,86);light.cyl(0,4,0,2.6,8,C.cream);light.cyl(0,8.15,0,2.2,.3,C.blue);
 for(let i=0;i<4;i++){const a=i*Math.PI/2;light.box(Math.cos(a)*1.8,9.1,Math.sin(a)*1.8,.14,2.1,.14,C.blue);}
 new Frame(glass,250,6,86).cyl(0,9.1,0,1.8,1.7,C.glass,false);light.cyl(0,10.2,0,2.4,.4,C.roof);
 // Street lights, planted trees and utility details make this a present-day town.
 for(const [x,z]of[[-194,39],[-128,24],[-100,54],[-20,69],[80,99],[177,119],[-43,-8],[45,-68],[-150,108],[82,162]]){
   const y=heightAt(x,z),f=new Frame(publicArt,x,y,z);f.box(0,2.1,0,.14,4.2,.14,C.metal);f.box(.45,4.15,0,1,.12,.3,C.metal,false);f.box(.8,4.05,0,.35,.12,.32,'#f7dca0',false);
 }
 for(const [i,[x,z]]of[[-215,80],[-203,155],[-151,173],[-96,108],[-72,112],[6,-60],[44,-15],[94,-84],[-175,-63],[-225,-135],[130,148],[139,223],[5,238],[-90,220]].entries()){
   const y=heightAt(x,z);trunks.add(cyl,C.wood,T(x,y+2.8,z,0,.35,5.6,.35));for(const [dx,dy,dz,s]of[[0,6,0,3.6],[-2,5,0,2.6],[1,5.7,1.9,2.9]])leaves.add(sphere,i%3===0?'#93a86c':'#69895f',T(x+dx,y+dy,z+dz,0,s,s*.8,s),false);
 }
 // Gardens and water barrels occupy real ground; footpaths remain clear.
 for(const x of[-145,-130,-115])for(const z of[220,225,230]){const y=heightAt(x,z);publicArt.box(x,y,z,9,.25,1.2,'#806849',0,false);for(let i=0;i<5;i++)publicArt.add(sphere,'#779458',T(x-3.5+i*1.7,y+.5,z,0,.3,.45,.3),false);}
 return pieces;
}
