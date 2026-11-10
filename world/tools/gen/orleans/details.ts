import * as THREE from 'three';
import {Batch,T} from '../geo';
import type {Piece} from '../structures';
import {distanceToLine,type ExpansionPlan,type RoutePoint} from '../../../src/map/worldPlan';
import {ORLEANS_LANE_POINTS,riverDistance} from './landscape';
import {C,Frame,gable,pointedArch,strip,banner} from './craft';

interface House {position:[number,number,number];width:number;depth:number;rotation:number;family:string}
export function buildOrleansDetails(plan:ExpansionPlan,heightAt:(x:number,z:number)=>number,houses:House[]):Piece[]{
  const pieces:Piece[]=[],make=(name:string)=>{const b=new Batch(`orleans_${name}`);pieces.push({name:b.name,batch:b,material:'M_OrleansCraft',outline:true});return b;};
  const dock=make('WorkingHarbour'),cloister=make('HerbCloister'),works=make('SiegeWallWorks'),street=make('StreetLife');
  // The treadwheel crane is a separate river-trade landmark, with an open walkway beneath its arm.
  const crane=new Frame(dock,-175,8.35,-8,-Math.PI/2);
  for(const side of [-1,1]){crane.box(side*2,5,0,.55,10,.55,C.wood);crane.beam([side*2,0,-3],[side*2,8,0],.4,C.oak,true);}
  crane.box(0,9.9,0,5,.6,1,C.wood);crane.beam([0,10,-2],[0,10,23],.55,C.wood,true);crane.beam([0,3.5,0],[0,10,8],.4,C.oak,true);
  // Treadwheels, hauling rope and grain pallet are owned by the playable works
  // scene, keeping the static support frame clear of duplicate moving geometry.
  gable(crane,6,6,10.5,3,C.slate);
  strip(dock,[[-180,8.08,-79.4],[-184,8.25,-76],[-188,8.45,-71.2]],7,C.stone);
  // Landings connect the low river walk to a cargo apron seated in the bank.
  // The dockapproach route supplies a continuous ramp all the way to the town terrace.
  for(const [x,z] of [[-172,10],[-171,-31],[-164,-18]]){
    const y=heightAt(x,z)+.08,f=new Frame(dock,x,y,z,.15);f.box(0,.8,0,2.4,1.6,2.2,C.oak);f.box(0,1.8,0,2.2,.3,2.1,C.wood,false);
    for(const xx of [-.9,.9])f.box(xx,.8,1.15,.14,1.7,.12,C.wood,false);
  }
  for(const [x,z] of [[-191,14],[-191,29],[-194,-55]]){
    const net=new Frame(dock,x,8.4,z,.1);for(const xx of [-1.7,1.7])net.box(xx,1.5,0,.14,3,.14,C.oak,false);
    for(let i=0;i<8;i++){net.beam([-1.7,1.4+i*.2,0],[1.7,1.4+i*.2,0],.025,C.white);net.beam([-1.7+i*.48,1.4,0],[-1.7+i*.48,2.8,0],.025,C.white);}
  }
  // The monastery is an L-shaped arcade and planted court rather than another house block.
  const corridors:[number,number,number,number,number][]=[[130,-191,15,72,0],[116,-218,15,44,Math.PI/2]];
  for(const [x,z,w,d,a] of corridors){
    const f=new Frame(cloister,x,32,z,a);gable(f,w,d,6,2.8,C.slate);
    f.box(0,-.2,0,w,.7,d,C.pale);
    const bays=Math.floor(d/12);
    for(let i=0;i<=bays;i++)for(const side of [-1,1]){
      const zz=-d/2+i*d/bays,point=f.point(side*6.1,0,zz),bottom=Math.min(32,heightAt(point.x,point.z))-.8;
      f.box(side*6.1,(bottom-32)/2,zz,1.1,32-bottom,1.1,C.joint);f.box(side*6.1,3,zz,.8,6,.8,C.pale);
      f.box(side*6.1,5.8,zz,1.3,.3,1.3,C.stone);
      if(i<bays){const p=f.point(side*6.1,0,zz+d/bays/2),arch=new Frame(cloister,p.x,32,p.z,a+Math.PI/2);pointedArch(arch,0,1,0,d/bays-1.3,4.8,.3,C.pale);}
    }
  }
  // Soft garden paths join the covered walk to the existing cathedral approach.
  const gardenPath:RoutePoint[]=[[80,32.13,-130],[100,32.13,-146],[130,32.13,-160]];strip(cloister,gardenPath,5,C.stone);
  for(const [x,z] of [[108,-208],[117,-208],[108,-180],[117,-180]]){
    const f=new Frame(cloister,x,32,z);f.box(0,.18,0,5,.36,6.6,C.joint);f.box(0,.4,0,4.4,.12,6,C.ash,false);
    for(let row=0;row<4;row++)for(let col=0;col<3;col++){
      const p=f.point(-1.4+col*1.4,.8,-2.2+row*1.4);cloister.add(new THREE.IcosahedronGeometry(.4,0),col%2?'#94a45f':'#769577',T(p.x,p.y,p.z),false);
      if(row%2===0)cloister.add(new THREE.SphereGeometry(.12,4,3),'#a38eae',T(p.x,p.y+.25,p.z),false);
    }
  }
  for(const z of [-174,-205]){const f=new Frame(cloister,88,32,z,Math.PI/2);f.box(0,.65,0,5,.3,1.4,C.oak);for(const x of [-1.8,1.8])f.box(x,.3,0,.45,.6,1.1,C.stone);}
  const basin=new Frame(cloister,112,32,-159);basin.cyl(0,.4,0,2.4,.8,C.stone);basin.cyl(0,.83,0,1.9,.05,'#7b9b9b',false);basin.cyl(0,1.4,0,.3,1.2,C.pale,false);
  // Scarred stone, stacked replacement blocks and a real timber approach distinguish the wall works.
  for(const [x,z] of [[196,30],[197,46],[191,65]]){
    const y=heightAt(x,z),f=new Frame(works,x,y,z,.13);
    for(let row=0;row<3;row++)for(let col=0;col<3-row;col++)f.box(-2.7+col*2.1+row*.65,row*.8+.4,0,1.9,.75,2.3,row%2?C.stone:C.joint);
  }
  const bench=new Frame(works,192,14,8,.2);bench.box(0,1,0,6,.3,2.4,C.oak);for(const x of [-2.4,2.4])bench.box(x,.45,0,.3,.9,2,C.wood);
  for(let i=0;i<4;i++)bench.box(-1.7+i*1.1,1.4,0,.65,.5,.6,i%2?C.stone:C.dark,false);
  for(const z of [-12,-27,-42]){
    const f=new Frame(works,195,heightAt(195,z),z,.07);for(let j=0;j<4;j++)f.box(-2+j*.8,.4+j%2*.7,0,.65,.65,10,C.oak);
  }
  for(const routeId of ['wallworks','belfrywalk']){
  const ramp=plan.routes.find(r=>r.id===routeId)!.points;
  for(let i=routeId==='wallworks'?4:1;i<ramp.length;i++){
    const a=ramp[i-1],b=ramp[i],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(len/8)),yaw=Math.atan2(dx,dz);
    for(let j=0;j<=n;j++){
      const t=j/n,x=a[0]+dx*t,z=a[2]+dz*t,top=a[1]+(b[1]-a[1])*t,base=heightAt(x,z),f=new Frame(works,x,0,z,yaw);
      for(const side of [-1,1]){if(j>0&&j<n)f.box(side*3.1,(top+base)/2,0,.3,Math.max(.3,top-base),.3,C.wood);f.box(side*3.1,top+.65,0,.18,1.3,.18,C.oak,false);}
      f.box(0,top-.3,0,6.8,.3,.3,C.wood);
      if(j<n){const qx=x+dx/n,qz=z+dz/n,qt=a[1]+(b[1]-a[1])*(j+1)/n;
        for(const side of [-1,1]){const sideX=Math.cos(yaw)*side*3.1,sideZ=-Math.sin(yaw)*side*3.1;works.add(new THREE.CylinderGeometry(.075,.075,Math.hypot(dx/n,dz/n,qt-top),6),C.oak,new THREE.Matrix4().compose(new THREE.Vector3((x+qx)/2+sideX,(top+qt)/2+.9,(z+qz)/2+sideZ),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(qx-x,qt-top,qz-z).normalize()),new THREE.Vector3(1,1,1)),false);}
      }
    }
    const deck:RoutePoint[]=[...Array.from({length:n+1},(_,j)=>[a[0]+dx*j/n,a[1]+(b[1]-a[1])*j/n+.18,a[2]+dz*j/n] as RoutePoint)];strip(works,deck,5.8,C.oak);
  }
  }
  works.box(-23,38.85,-52.5,6.8,.3,3,C.oak);
  works.box(-23,39,-51.2,6.8,1.1,.16,C.wood);
  // Repair canopy, different from both militia tents and the town's slate roofs.
  const canopy=new Frame(works,192,14,70,.15);for(const x of [-3.5,3.5])for(const z of [-4,4])canopy.box(x,2.6,z,.25,5.2,.25,C.oak);
  canopy.box(0,5.25,0,8,.14,9,C.white,false);banner(canopy,0,5.7,4.6,3);
  // Battle evidence stays to the side of the routes: broken cart, splintered shields and arrow bundles.
  const cart=new Frame(works,205,heightAt(205,-62),-62,.45);cart.box(0,1,0,3.5,.35,6,C.wood);for(const side of [-1,1]){cart.box(side*1.7,1.6,0,.2,1.2,5,C.oak);const p=cart.point(side*2.1,.9,0);works.add(new THREE.TorusGeometry(.95,.15,5,12),C.wood,T(p.x,p.y,p.z,Math.PI/2),false);}
  // Fitted street furniture uses each room's function and keeps doors/route axes clear.
  for(const [i,h] of houses.entries()){
    const [x,y,z]=h.position,f=new Frame(street,x,y,z,h.rotation);
    if(i%3===0){f.beam([h.width*.38,3.2,h.depth/2+.2],[h.width*.38,3.2,h.depth/2+1.9],.12,C.wood);f.box(h.width*.38,2.7,h.depth/2+1.85,1,.8,.12,h.family==='harbour-warehouse'?C.oak:C.blue,false);}
    if(h.family==='artisan-workshop')for(const side of [-1,1]){const p=f.point(side*h.width*.32,4,h.depth/2+.13);street.add(new THREE.TorusGeometry(.4,.075,5,10),C.gold,T(p.x,p.y,p.z),false);}
  }
  for(const [x,z,a] of [[-129,78,.7],[55,15,-.5],[145,108,.2]]){
    const y=heightAt(x,z),f=new Frame(street,x,y,z,a);f.box(0,2,0,.25,4,.25,C.oak);
    f.mesh([-1.8,2.8,0,1,2.8,0,1.8,3.2,0,1,3.6,0,-1.8,3.6,0],[0,1,2,0,2,3,0,3,4],C.blue,false);
    f.mesh([-1.8,2.8,-.08,1,2.8,-.08,1.8,3.2,-.08,1,3.6,-.08,-1.8,3.6,-.08],[0,2,1,0,3,2,0,4,3],C.blue,false);
  }
  // A worn oval forecourt follows the hill, instead of flattening it into a pad.
  const gardens=make('ChurchyardAndCourtyards'),foliage=new Batch('orleans_PearTrees','M_Foliage');
  pieces.push({name:foliage.name,batch:foliage,material:'M_Foliage',outline:false});
  for(let row=-7;row<=7;row++)for(let col=-12;col<=12;col++){
    const x=35+col*1.5+(row%2)*.65,z=-112+row*1.4;
    if((x-35)**2/19**2+(z+112)**2/11**2>1||((row*17+col*13)%11===0))continue;
    const f=new Frame(gardens,x,heightAt(x,z)+.05,z,Math.sin(row*7+col)*.025);
    f.box(0,0,0,1.35,.08,1.24,(row+col)%3?C.stone:C.joint,false);
  }
  const walkingLines=[...plan.routes.map(r=>r.points.map(p=>[p[0],p[2]] as const)),...ORLEANS_LANE_POINTS];
  const clear=(x:number,z:number,r:number)=>riverDistance(x,z)>36&&walkingLines.every(line=>distanceToLine(x,z,line)>r+3.5)&&houses.every(h=>{
    const dx=x-h.position[0],dz=z-h.position[2],lx=Math.cos(h.rotation)*dx-Math.sin(h.rotation)*dz,lz=Math.sin(h.rotation)*dx+Math.cos(h.rotation)*dz;
    return Math.hypot(Math.max(0,Math.abs(lx)-h.width/2),Math.max(0,Math.abs(lz)-h.depth/2))>r+2;
  });
  // Individual memorial stones sit on the irregular west hillside, below pear trees.
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
    const x=-91+col*8+Math.sin(row)*2,z=-219+row*8;
    if(!clear(x,z,2))continue;
    const f=new Frame(gardens,x,heightAt(x,z),z,-.12+col*.06);
    f.box(0,.12,-1.1,2.3,.24,3.5,C.joint);f.box(0,.9,-2.6,1.5,1.8,.35,C.pale);
    f.box(0,1,-2.38,.1,.7,.06,C.joint,false);f.box(0,1.13,-2.38,.5,.1,.06,C.joint,false);
    for(const side of [-1,1]){const p=f.point(side*.65,.42,-.6);gardens.add(new THREE.IcosahedronGeometry(.34,0),'#85946c',T(p.x,p.y,p.z,0,1,.7,1),false);}
  }
  const treeSites:[number,number][]=[[-104,-219],[-89,-234],[-63,-230],[-48,-205],[-110,-200],[-42,-238]];
  for(const h of houses){
    const f=new Frame(gardens,...h.position,h.rotation),p=f.point(0,0,-h.depth/2-6.5);
    if(treeSites.length<17&&clear(p.x,p.z,3))treeSites.push([p.x,p.z]);
  }
  for(const [i,[x,z]] of treeSites.entries()){
    if(!clear(x,z,2.5))continue;
    const y=heightAt(x,z),h=5.5+i%3,f=new Frame(gardens,x,y,z);
    f.cyl(0,h*.45,0,.25,h*.9,C.wood);f.beam([0,h*.55,0],[-1.7,h*.9,0],.16,C.oak);f.beam([0,h*.55,0],[1.4,h,-.6],.16,C.oak);
    for(const side of [-1,0,1]){
      const p=f.point(side*1.2,h+Math.abs(side)*.4,side*.3);
      foliage.add(new THREE.IcosahedronGeometry(2,1),i%2?'#859b61':'#9ba56a',T(p.x,p.y,p.z,0,1,1.15,1),false);
      for(let j=0;j<3;j++){const q=f.point(side*1.2+Math.sin(j*2.1)*1.3,h-1+j*.35,Math.cos(j*2.1)*1.5);gardens.add(new THREE.IcosahedronGeometry(.15,0),'#b6a35b',T(q.x,q.y,q.z),false);}
    }
  }
  // Laundry frames and kitchen plots give the quieter back lanes a domestic use.
  for(const [i,h] of houses.entries()){
    if(i%5!==0)continue;
    const f=new Frame(gardens,...h.position,h.rotation),p=f.point(0,0,-h.depth/2-4.7);
    if(!clear(p.x,p.z,1.3))continue;
    const yard=new Frame(gardens,p.x,heightAt(p.x,p.z),p.z,h.rotation);
    if(i%2===0){
      for(const x of [-2,2])yard.box(x,1.6,0,.14,3.2,.14,C.oak);
      yard.beam([-2,3.05,0],[2,3.05,0],.035,C.white);
      for(const x of [-1.2,.2,1.35])yard.box(x,2.35,0,.85,1.35,.05,x<0?C.white:'#9aabb6',false);
    }else{
      yard.box(0,.16,0,3.2,.32,2.4,C.joint);yard.box(0,.35,0,2.9,.06,2.1,C.ash,false);
      for(let j=0;j<6;j++){const q=yard.point(-1+j%3,.6,-.6+Math.floor(j/3)*1.2);gardens.add(new THREE.IcosahedronGeometry(.32,0),'#79915c',T(q.x,q.y,q.z,0,1,.7,1),false);}
    }
  }
  const lanterns=make('StreetLanterns'),glass=new Batch('orleans_Lantern_Glass','M_Emissive');
  pieces.push({name:glass.name,batch:glass,material:'M_Emissive'});
  for(const site of plan.sites){
    const [x,y,z]=site.position,f=new Frame(lanterns,x+2.5,y,z+2.4),g=new Frame(glass,x+2.5,y,z+2.4);
    f.cyl(0,2.2,0,.075,4.4,C.dark);f.box(0,4.25,0,.55,.1,.55,C.dark,false);f.box(0,4.95,0,.55,.14,.55,C.dark,false);
    for(const sx of [-.22,.22])for(const sz of [-.22,.22])f.box(sx,4.6,sz,.045,.7,.045,C.dark,false);
    g.box(0,4.58,0,.36,.55,.36,'#d6ad6e',false);
  }
  // Bank reeds and riverside vegetation are handled by the existing landscape pass.
  return pieces;
}
