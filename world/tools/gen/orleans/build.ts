import {C,CYL,CONE,Frame,gable,hipRoof,workshopRoof,pointedArch,window,banner,strip} from './craft';
import {buildOrleansDetails} from './details';
import {buildOrleansWatercourse} from './watercourse';
import * as THREE from 'three';
import {Batch,T} from '../geo';
import {mulberry32} from '../rng';
import type {Piece} from '../structures';
import {distanceToLine,type ExpansionPlan,type RoutePoint} from '../../../src/map/worldPlan';
import {ORLEANS_RIVER,ORLEANS_WALL,ORLEANS_LANE_POINTS,ORLEANS_BUILDING_FAMILIES,TOWN_HOUSES,riverDistance} from './landscape';

function house(b:Batch,x:number,y:number,z:number,w:number,d:number,a:number,index:number,heightAt:(x:number,z:number)=>number,approach:{distance:number;floor:number}){
  const f=new Frame(b,x,y,z,a),family=index%6,h=[11.5,8,6.8,12.8,5.8,9.8][family],plaster=['#e1d1ac','#cbbc9c','#b8ae91','#e8d9b7','#cfc0a2','#d4c7aa'][family];
  let bottom=y;for(const sx of [-w/2,w/2])for(const sz of [-d/2,d/2]){const p=f.point(sx,0,sz);bottom=Math.min(bottom,heightAt(p.x,p.z));}
  f.box(0,(bottom-y-.9)/2,0,w+.4,y-bottom+.9,d+.4,C.stone);
  f.box(-w/2+.35,h/2,0,.7,h,d,plaster);f.box(w/2-.35,h/2,0,.7,h,d,plaster);f.box(0,h/2,-d/2+.35,w,h,.7,plaster);
  const gap=2.8,side=(w-gap)/2;
  for(const sign of [-1,1])f.box(sign*(gap/2+side/2),h/2,d/2-.35,side,h,.7,plaster);
  f.box(0,(h+3.4)/2,d/2-.35,gap,h-3.4,.7,plaster);
  f.box(0,-.18,0,w,.35,d,C.stone);
  // French river-trade silhouettes: each family changes massing, roof and facade,
  // rather than borrowing the Kingdom's house or tower generators.
  if(family===0||family===3){
    for(const sx of [-w/2+.12,w/2-.12])for(const sz of [-d/2-.04,d/2+.04])f.box(sx,h/2,sz,.28,h,.25,C.wood,false);
    for(const yy of [.5,4.3,8.1,h-.12])if(yy<h)f.box(0,yy,d/2+.08,w,.22,.2,C.wood,false);
    for(const sx of [-1,1])f.beam([sx*(w/2-.4),h*.55,d/2+.12],[sx*1.9,h-.3,d/2+.12],.18,C.wood);
  }else if(family===2){
    for(let yy=.5;yy<h;yy+=.55)f.box(0,yy,d/2+.1,w,.12,.12,C.oak,false);
    for(const xx of [-w*.42,w*.42])f.box(xx,h/2,d/2+.15,.35,h,.3,C.wood,false);
  }else{
    for(const xx of [-w*.45,w*.45])f.box(xx,h/2,d/2+.12,.45,h,.35,C.pale,false);
    for(const yy of [.4,h-.3])f.box(0,yy,d/2+.12,w,.3,.3,C.joint,false);
  }
  for(const sx of [-1,1])window(f,sx*w*.29,h*.72,d/2+.16,1.4,family===4?1.4:1.9);
  pointedArch(f,0,0,d/2+.12,3.05,3.6,.24,family===1||family===5?C.pale:C.oak);
  const rise=family===3?5.4:family===2?3.1:4.6;
  if(family===1||family===5)hipRoof(f,w,d,h,rise,C.slate);
  else if(family===4)workshopRoof(f,w,d,h,'#847969');
  else gable(f,w,d,h,rise,family===2?'#776e61':C.slate);
  const chimneyX=family%2?-w*.28:w*.28;
  f.box(chimneyX,h+rise*.5,-d*.2,family===4?1.5:.85,rise+1.7,family===4?1.3:.85,C.joint);
  f.box(chimneyX,h+rise+1.2,-d*.2,family===4?1.8:1.2,.25,1.2,C.stone);
  if(family===0){
    // Jettied merchant upper storey, broad dormer and a sheltered balcony.
    for(const xx of [-w/2-.35,w/2+.35])f.box(xx,7.5,0,.7,6,d+.4,plaster);
    f.box(0,4.55,d/2+.45,w+1.4,.35,1.1,C.wood);
    f.box(0,4.7,d/2+1,w*.65,.2,1.7,C.oak,false);
    for(let j=0;j<6;j++)f.box(-w*.32+j*w*.128,5.25,d/2+1.7,.1,1,.1,C.wood,false);
    f.box(0,5.75,d/2+1.7,w*.65,.12,.15,C.wood,false);
    const q=f.point(0,0,d*.2),dormer=new Frame(b,q.x,y,q.z,a);dormer.box(0,h+1.4,0,w*.45,2.6,3.2,plaster);gable(dormer,w*.48,3.5,h+2.8,2.2,C.slate);window(dormer,0,h+1.5,1.72,1.7,1.6);
  }else if(family===1){
    // Limestone shop arcade, with two shadowed trade bays and a central passage.
    for(const xx of [-w*.3,w*.3]){f.box(xx,1.8,d/2+.4,2.4,3.4,.18,C.dark,false);pointedArch(f,xx,0,d/2+.55,2.8,3.8,.32,C.pale);}
    for(const xx of [-w*.48,w*.48])f.cyl(xx,1.9,d/2+1.2,.35,3.8,C.pale);
    f.box(0,4,d/2+.9,w+1,.4,2,C.pale,false);
  }else if(family===2){
    // Loading loft and a timber lifting arm identify the river warehouse.
    f.box(0,h*.72,d/2+.22,2.1,2.1,.18,C.oak,false);
    for(const xx of [-.8,.8])f.beam([xx,h*.55,d/2+.36],[-xx,h*.9,d/2+.36],.14,C.wood);
    f.beam([0,h+1.7,d/2-.8],[0,h+1.7,d/2+3.5],.35,C.wood);
    f.beam([0,h-.3,d/2+.4],[0,h+1.7,d/2+2.3],.22,C.oak);
    f.beam([0,h+1.7,d/2+3.1],[0,h-1.1,d/2+3.1],.045,C.wood);
  }else if(family===3){
    // Tall, narrow street houses have three distinct window/storey rhythms.
    for(const yy of [4.8,8.7,11.1])for(const xx of [-w*.28,w*.28]){
      window(f,xx,yy,d/2+.2,1.1,1.5);for(const s of [-1,1])f.box(xx+s*.73,yy,d/2+.25,.3,1.7,.1,'#718382',false);
    }
    for(let j=0;j<4;j++)f.box(0,h+rise*(j+.5)/4,d/2+.73,w*(1-(j+.5)/4),.15,.2,C.pale,false);
  }else if(family===4){
    // Wide workshop window, heavy shutters and an asymmetric forge roof.
    const side=new Frame(b,x,y,z,a+Math.PI/2);window(side,0,3.1,w/2+.1,3.6,2.3);
    f.box(w*.27,1,d/2+1.3,w*.34,1.8,1.1,C.oak,false);f.box(w*.27,2,d/2+1.3,w*.4,.2,1.4,C.wood,false);
  }else{
    // Polygonal oriel hangs over the lane, preserving clear headroom beneath it.
    for(const side of [-1,0,1]){const theta=side*.6,xx=-w*.2+Math.sin(theta)*1.5,zz=d/2+.3+Math.cos(theta)*1.4;
      f.box(xx,6.1,zz,1.1,3.2,.22,C.glass,false,-theta);f.box(xx-.5,6.1,zz,.12,3.5,.15,C.pale,false);}
    f.box(-w*.2,4.35,d/2+1.2,3.5,.3,2.5,C.pale,false);f.box(-w*.2,7.85,d/2+1.2,3.5,.35,2.5,C.pale,false);
  }
  const shelfX=w/2-1.15;
  if(family===2){
    for(const side of [-1,1])for(const zz of [-d*.25,d*.1]){f.box(side*shelfX,.65,zz,1.5,1.3,2.2,C.oak);f.box(side*shelfX,1.4,zz,1.6,.18,2.3,C.wood,false);}
  }else if(family===4){
    f.box(-shelfX,.8,-d*.2,1.7,1.6,d*.5,C.joint);f.box(-shelfX,1.7,-d*.2,1.9,.2,d*.54,C.oak);
    for(let j=0;j<4;j++)f.box(-shelfX,2.1,-d*.35+j*d*.12,.6,.5,.45,j%2?C.dark:C.gold,false);
  }else if(family===1){
    for(const side of [-1,1]){f.box(side*shelfX,1,-d*.1,1.5,2,d*.55,C.wood);for(let j=0;j<3;j++)f.box(side*shelfX,2.2,-d*.3+j*d*.2,.8,.35,.7,C.oak,false);}
  }else{
    f.box(-shelfX,.45,-d*.24,1.5,.9,d*.42,C.oak);f.box(-shelfX,1,-d*.24,1.4,.15,d*.4,family===3?C.blue:C.white,false);
    f.box(shelfX,.7,-d*.25,1.4,1.4,2,C.wood);f.box(shelfX,1.5,-d*.25,1.6,.16,2.1,C.oak,false);
  }
  if(family===2){
    for(const side of [-1,1]){
      const xx=side*(w/2-1.1),zz=-d*.3;
      for(const y0 of [.6,2.8]){f.box(xx,y0,zz,1.65,.18,2.6,C.oak,false);}
      for(const z0 of [zz-1.2,zz+1.2])f.box(xx,1.6,z0,.18,3.2,.18,C.wood,false);
      const barrel=f.point(xx,1.1,d*.22);b.add(CYL,C.oak,T(barrel.x,barrel.y,barrel.z,0,.63,1.8,.63));
      for(const yy of [-.65,.65])b.add(new THREE.TorusGeometry(.64,.065,5,12),C.dark,T(barrel.x,barrel.y+yy,barrel.z,0,1,1,1,Math.PI/2),false);
      const sack=f.point(xx,2.2,-d*.3);b.add(new THREE.IcosahedronGeometry(.6,1),'#b8aa82',T(sack.x,sack.y,sack.z,0,1.1,.8,1),false);
    }
    f.beam([-w/2+.5,h-.3,0],[w/2-.5,h-.3,0],.25,C.wood);
  }
  if(family===0||family===1||family===3||family===5){
    for(const side of [-1,1]){const wall=new Frame(b,x,y,z,a+side*Math.PI/2);for(const xx of [-d*.23,d*.23])window(wall,xx,h*.65,w/2+.1,1.1,1.9);}
    const rear=new Frame(b,x,y,z,a+Math.PI);for(const xx of [-w*.27,w*.27])window(rear,xx,h*.65,d/2+.12,1.3,2);
  }
  const out=f.point(0,0,approach.distance),porch=f.point(0,0,d/2+Math.min(2.5,(approach.distance-d/2)*.4)),door=f.point(0,0,d/2-1);
  // One open-top ribbon reaches a level porch before the foundation face.
  // End caps on tilted boxes catch a walking capsule on steep townhouse approaches.
  strip(b,[[out.x,approach.floor+.08,out.z],[porch.x,y+.03,porch.z],[door.x,y+.03,door.z]],3.2,C.stone);
  if(family===0||family===4){f.box(w*.23,3.1,d/2+1.6,w*.46,.14,2.8,index%4?C.white:C.blue,false);for(const sx of [-1,1])f.box(w*.23+sx*w*.23,1.5,d/2+2.75,.14,3,.14,C.oak,false);}
}
function archBridge(f:Frame,length:number,width:number,deck:number,wood=false){
  f.box(0,deck-.4,0,width,.6,length,wood?C.oak:C.stone);
  for(const side of [-1,1]){
    for(let z=-length/2+3;z<length/2;z+=6){
      if(wood&&z>-22&&z<3)continue; // open landing from the timber crossing onto the river quay
      f.box(side*(width/2-.2),deck+.5,z,.35,1.3,.35,wood?C.wood:C.pale);
      if(wood)f.box(side*(width/2-.2),deck+1,z,.24,.25,5.98,C.wood);
    }
    if(!wood)f.box(side*(width/2-.2),deck+1,0,.24,.25,length,C.pale);
  }
  if(wood){for(let z=-length/2;z<length/2;z+=1.3)f.box(0,deck-.06,z,width,.12,.13,C.wood,false);for(const z of [-20,0,20])for(const x of [-width/2+.6,width/2-.6])f.box(x,deck/2-1,z,.6,deck+2,.6,C.wood);return;}
  for(const center of [-36,-12,12,36]){
    const vertices:number[]=[],indices:number[]=[],steps=14,r=11.5,inner=9.4,spring=1.5;
    for(const side of [-1,1])for(let i=0;i<=steps;i++){const a=i/steps*Math.PI;for(const rr of [r,inner])vertices.push(side*width/2,spring+Math.sin(a)*rr,center+Math.cos(a)*rr);}
    const layer=(steps+1)*2;
    for(let i=0;i<steps;i++){const a=i*2,b=a+2;for(const o of [0,layer])indices.push(o+a,o+b,o+a+1,o+a+1,o+b,o+b+1);indices.push(a,b,a+layer,b,b+layer,a+layer,a+1,a+1+layer,b+1,b+1,a+1+layer,b+1+layer);}
    for(const i of [0,steps*2])indices.push(i,i+layer,i+1,i+1,i+layer,i+layer+1);
    f.mesh(vertices,indices,C.joint);
  }
  for(const z of [-48,-24,0,24,48]){f.box(0,5.4,z,width+1,14,2.2,C.stone);for(const side of [-1,1])f.box(side*(width/2+.7),1.8,z,1.6,6,4,C.joint);}
  // Spandrel over the arches, meeting the continuous collision deck.
  f.box(0,13.4,0,width,.9,length,C.stone);
}

export function buildOrleans(plan:ExpansionPlan,heightAt:(x:number,z:number)=>number,access:RoutePoint[]):Piece[]{
  const pieces:Piece[]=[],make=(name:string,material='M_OrleansCraft',outline=true)=>{const b=new Batch(`orleans_${name}`,material);pieces.push({name:b.name,material,batch:b,outline});return b;};
  const town=make('RiverTown'),walls=make('CurtainWalls'),church=make('Cathedral'),river=make('RiverHarbour'),props=make('MarketAndCraft'),trunks=make('Trees_Trunks'),leaves=make('Trees_Leaves','M_Foliage',false),land=make('OrchardsAndLanes', 'M_OrleansCraft',false);
  const roadLines=[...plan.routes.filter(r=>r.kind!=='underground').map(r=>r.points.map(p=>[p[0],p[2]] as const)),access.map(p=>[p[0],p[2]] as const),...ORLEANS_LANE_POINTS];
  const roadDistance=(x:number,z:number)=>Math.min(...roadLines.map(line=>distanceToLine(x,z,line)));
  const groundPaths=[...plan.routes.filter(r=>r.kind==='main'||r.kind==='flank').map(r=>r.points),access,...ORLEANS_LANE_POINTS.map(line=>line.filter(([x,z])=>riverDistance(x,z)>35).map(([x,z])=>[x,heightAt(x,z),z] as RoutePoint))];
  const nearestStreet=(x:number,z:number)=>{
    let best={distance:Infinity,x:0,z:0,y:0};
    for(const line of groundPaths)for(let i=1;i<line.length;i++){
      const a=line[i-1],b=line[i],dx=b[0]-a[0],dz=b[2]-a[2],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1),0,1),px=a[0]+dx*t,pz=a[2]+dz*t,distance=Math.hypot(px-x,pz-z);
      if(distance<best.distance)best={distance,x:px,z:pz,y:a[1]+(b[1]-a[1])*t+.1};
    }return best;
  };
  const candidates:Array<readonly[number,number,number,number,number]>=[...TOWN_HOUSES];
  for(const line of ORLEANS_LANE_POINTS)for(let i=4;i<line.length-4;i+=4){
    const a=line[i-1],b=line[i+1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    for(const side of [-1,1]){const nx=-dz/len*side,nz=dx/len*side,offset=11+(i%3);candidates.push([line[i][0]+nx*offset,line[i][1]+nz*offset,8.5+(i%3),9+(i%2)*2,Math.atan2(-nx,-nz)]);}
  }
  const builtHouses:{position:[number,number,number];width:number;depth:number;rotation:number;family:string;approach:[number,number,number]}[]=[];
  for(const candidate of candidates){
    const [x,z,w,d]=candidate;
    if(Math.hypot(x+93,z-75)<Math.hypot(w,d)/2+4||Math.hypot(x+12,z+62)<Math.hypot(w,d)/2+22||(x>83&&x<146&&z<-148&&z>-239)||(x>151&&x<205&&z>-100&&z<84)||roadDistance(x,z)<Math.hypot(w,d)/2+3||riverDistance(x,z)<32||distanceToLine(x,z,ORLEANS_WALL)<Math.hypot(w,d)/2+4.5||(x>-8&&x<78&&z<-112&&z>-234))continue;
    if(builtHouses.some(p=>Math.hypot(p.position[0]-x,p.position[2]-z)<Math.hypot(w,d)/2+Math.hypot(p.width,p.depth)/2+2))continue;
    const approach=nearestStreet(x,z);if(approach.distance>26)continue;
    const a=Math.atan2(approach.x-x,approach.z-z),frame=new Frame(town,x,0,z,a);let y=heightAt(x,z);
    for(let ix=0;ix<=4;ix++)for(let iz=0;iz<=4;iz++){const p=frame.point(-w/2+w*ix/4,0,-d/2+d*iz/4);y=Math.max(y,heightAt(p.x,p.z));}
    y+=.12;const rampLength=approach.distance-d/2-Math.min(2.5,(approach.distance-d/2)*.4);if(rampLength<1||Math.abs(y-approach.y)/rampLength>.45)continue;
    // Reject steep, convex lots rather than burying their entry ramp in the hill.
    let clearEntry=true;
    for(let j=0;j<=16;j++){
      const t=j/16,floor=approach.y+(y-approach.y)*t;
      for(const side of [-1.6,0,1.6]){
        const edge=frame.point(side,0,approach.distance-rampLength*t);
        if(heightAt(edge.x,edge.z)>floor+.2)clearEntry=false;
      }
    }
    if(!clearEntry)continue;
    house(town,x,y,z,w,d,a,builtHouses.length,heightAt,{distance:approach.distance,floor:approach.y});builtHouses.push({position:[x,y,z],width:w,depth:d,rotation:a,family:ORLEANS_BUILDING_FAMILIES[builtHouses.length%6],approach:[approach.x,approach.y,approach.z]});
  }
  pieces.find(p=>p.batch===town)!.userData={houses:builtHouses};
  // A close-knit town grows along curving lanes, leaving the river bank and approaches clear.
  for(const line of ORLEANS_LANE_POINTS){
    const points=line.filter(([x,z])=>riverDistance(x,z)>35).map(([x,z])=>[x,heightAt(x,z)+.06,z] as RoutePoint);
    strip(land,points,3.2,'#b0a17f',false);
  }
  pieces.find(p=>p.batch===land)!.userData={streetLanes:ORLEANS_LANE_POINTS.map(line=>line.filter(([x,z])=>riverDistance(x,z)>35).map(([x,z])=>[x,heightAt(x,z),z]))};
  // Hand-laid market square: an uneven oval, not a raised square pad.
  const plaza:RoutePoint[]=[],center:[number,number,number]=[-80,14.055,90];
  for(let i=0;i<=20;i++){const a=i/20*Math.PI*2,r=22+2*Math.sin(a*3);plaza.push([center[0]+Math.cos(a)*r,14.055,center[2]+Math.sin(a)*r*.76]);}
  for(let i=1;i<plaza.length;i++){const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([...center,...plaza[i],...plaza[i-1]],3));land.add(g,'#b9ad91',new THREE.Matrix4(),false);g.dispose();}
  for(let i=0;i<18;i++){
    const a=i/18*Math.PI*2,x=-80+Math.cos(a)*24,z=90+Math.sin(a)*21;if(Math.hypot(x+93,z-75)<7||roadDistance(x,z)<7||builtHouses.some(h=>Math.hypot(h.position[0]-x,h.position[2]-z)<Math.hypot(h.width,h.depth)/2+3.5))continue;
    const f=new Frame(props,x,14,z,-a);f.box(0,1,0,4,2,1.5,C.oak);for(const side of [-1,1])f.box(side*2,1.6,-.6,.18,3.2,.18,C.wood);
    f.box(0,3.4,0,4.8,.15,3.2,i%2?C.white:C.blue,false);for(let n=0;n<5;n++)f.box(-1.8+n*.9,3.5,0,.44,.04,3.2,i%2?C.blue:C.white,false);
    for(const xx of [-1,0,1])f.cyl(xx,2.2,0,.3,.3,i%3?'#b99d64':'#a76d53',false);
  }
  const well=new Frame(props,-93,14,75);well.cyl(0,.65,0,2,1.3,C.stone);well.cyl(0,1.34,0,1.4,.05,C.dark,false);for(const x of [-2.4,2.4])well.box(x,1.8,0,.25,3.6,.25,C.oak);gable(well,5.6,4,3.6,2,C.slate);
  // The front wall follows the town ridge; the remaining circuit follows the hill.
  for(let k=1;k<ORLEANS_WALL.length;k++){
    const a=ORLEANS_WALL[k-1],b=ORLEANS_WALL[k],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/6),yaw=Math.atan2(b[0]-a[0],b[1]-a[1]);
    for(let j=0;j<n;j++){
      const t=(j+.5)/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,base=heightAt(x,z),top=k<=5?24:Math.max(24,base+7.5),f=new Frame(walls,x,0,z,yaw),gateway=(k===4&&x>15&&x<46)||plan.routes.filter(r=>r.kind==='main'||r.kind==='flank').some(r=>distanceToLine(x,z,r.points.map(p=>[p[0],p[2]] as const))<8);
      if(!gateway)f.box(0,(base+top)/2,0,6,Math.max(.2,top-base),len/n+.12,C.stone);
      f.box(0,top-.2,0,9,.4,len/n+.12,C.pale);
      const landing=plan.routes.filter(r=>r.kind==='high').some(r=>r.points.some(p=>Math.hypot(x-p[0],z-p[2])<12));
      if(!landing)for(const side of [-1,1]){f.box(side*4.25,top+.45,0,.7,.9,len/n+.12,C.joint);f.box(side*4.25,top+1.3,0,.95,.9,2.2,C.pale);}
      if(j%3===0&&!gateway)for(const side of [-1,1])f.box(side*3.08,(base+top)/2,0,.18,Math.max(.2,top-base),.18,C.joint,false);
    }
  }
  // Gate's pointed arch stands over the road; the wall walk crosses above it.
  const gate=new Frame(walls,30,14,-27);pointedArch(gate,0,0,0,17,9.5,1,C.pale);for(const x of [-11,11])gate.box(x,5,0,4,10,8,C.stone);banner(gate,-11,10,4.1,4);banner(gate,11,10,4.1,4);
  for(const [i,p] of ORLEANS_WALL.slice(0,-1).entries()){
    if(i===1||i===4)continue;const base=heightAt(...p),top=i<5?24:Math.max(24,base+7.5),f=new Frame(walls,p[0],base,p[1]);
    f.cyl(0,(top-base)/2,0,6.8,top-base,C.stone);f.cyl(0,top-base+.1,0,7.7,.5,C.pale);
    for(let j=0;j<10;j++){const a=j/10*Math.PI*2;f.box(Math.cos(a)*7,top-base+1,Math.sin(a)*7,1.7,1.7,1.5,C.pale,false);}
    if(i%3!==0&&i!==5){const q=f.point(0,top-base+7,0);walls.add(CONE,i%2?C.slate:C.blue,T(q.x,q.y,q.z,0,8,12,8),false);}
  }
  strip(walls,[[-36,24.1,-22],[0,24.1,-45]],6,C.pale);
  walls.box(0,23.6,-45,17,.5,17,C.stone);
  const bell=new Frame(walls,-12,14,-62);bell.box(0,10,0,14,20,13,C.stone);for(const x of [-4.6,4.6])bell.box(x,24,0,2.2,8,11,C.pale);
  for(const z of [-4.5,4.5])bell.box(0,24,z,11,8,2,C.pale);gable(bell,16,15,28,7,C.slate);banner(bell,0,18,6.7,6);
  // The cathedral's nave is a real interior, reached through the open west portal.
  const f=new Frame(church,35,32,-174),w=50,d=82,h=23;
  f.box(0,-.14,0,62,.6,96,C.pale);
  for(const side of [-1,1]){
    f.box(side*w/2,h/2,0,1.8,h,d,C.stone);
    for(const zz of [-30,-10,10,30]){
      f.box(side*(w/2+3.5),h*.4,zz,5.2,h*.8,3,C.pale);
      f.beam([side*(w/2+4),h*.7,zz],[side*(w/2+11),4,zz],1.3,C.pale,true);
      const win=new Frame(church,35+side*(w/2+1),32,-174+zz,side*Math.PI/2);window(win,0,15,0,3.2,9);
    }
    for(const zz of [-25,-3,19]){f.cyl(side*15,10,zz,1.1,20,C.pale);pointedArch(new Frame(church,35,32,-174+zz),0,17,0,30,7,.65,C.pale);}
  }
  f.box(0,h/2,-d/2,w,h,1.8,C.stone);
  const opening=12,side=(w-opening)/2;
  for(const sign of [-1,1])f.box(sign*(opening/2+side/2),h/2,d/2,side,h,1.8,C.stone);
  f.box(0,(h+15)/2,d/2,opening,h-15,1.8,C.stone);pointedArch(f,0,0,d/2+1.05,13,16,.85,C.pale);
  gable(f,w+1,d+2,h,13,C.slate);
  for(const x of [-9,9])f.box(x,14,d/2+1.3,1.1,28,1.1,C.pale);
  const facade=new Frame(church,35,32,-131);gable(facade,19,2,26,11,C.pale);
  for(const sign of [-1,1]){
    const tower=new Frame(church,35+sign*28,32,-143);tower.box(0,14,0,12,28,14,C.stone);
    for(const x of [-4.4,4.4])tower.box(x,32,0,2.7,8,14,C.pale);
    for(const z of [-5.2,5.2])tower.box(0,32,z,9,8,3,C.pale);
    for(const x of [-3,3]){window(tower,x,20,7.2,1.4,5);pointedArch(tower,x,28,7.2,2.5,7,.25,C.joint);}
    tower.box(0,36.1,0,14,.5,16,C.pale);const q=tower.point(0,43,0);church.add(CONE,C.slate,T(q.x,q.y,q.z,Math.PI/4,8.3,14,8.3));
    const top=tower.point(0,51.5,0);church.box(top.x-.14,top.y-1,top.z,.28,3,.28,C.gold,0,false);church.box(top.x-1,top.y+.4,top.z,2,.25,.28,C.gold,0,false);
  }
  // Rose window: carved circular tracery, coloured glass and radial petals.
  const rose=f.point(0,20.3,d/2+1.13);church.add(new THREE.CircleGeometry(4.1,24),C.dark,T(rose.x,rose.y,rose.z),false);
  for(const rr of [4.25,3.1,1.15])church.add(new THREE.TorusGeometry(rr,.17,6,32),C.pale,T(rose.x,rose.y,rose.z+.08),false);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;f.beam([Math.cos(a)*1.2,20.3+Math.sin(a)*1.2,d/2+1.26],[Math.cos(a)*4,20.3+Math.sin(a)*4,d/2+1.26],.16,C.pale);const p=f.point(Math.cos(a)*2.2,20.3+Math.sin(a)*2.2,d/2+1.18);church.add(new THREE.CircleGeometry(.62,8),i%3===0?'#9c725f':i%3===1?'#7197a5':'#b3a16e',T(p.x,p.y,p.z),false);}
  // Stone ribbons and small coping blocks break large empty wall faces.
  for(const yy of [1,7,21.7])for(const side of [-1,1])f.box(side*(w/2+.93),yy,0,.14,.24,d,C.joint,false);
  banner(f,-19,18,d/2+1.2,6);banner(f,19,18,d/2+1.2,6);
  const altar=new Frame(church,35,32,-205);altar.box(0,.75,0,8,1.5,3,C.stone);altar.box(0,3,-1,.25,4,.3,C.gold,false);altar.box(0,3.4,-1,2.4,.25,.3,C.gold,false);
  // A four-arch merchant bridge carries the approach over the actual channel.
  archBridge(new Frame(river,-29.7,0,222,Math.atan2(-80,-210)),110,12,14.2);
  // A quieter timber crossing connects the low river gate to orchard paths.
  const footA=[-155,-75],footB=[-240,-90],footYaw=Math.atan2(footB[0]-footA[0],footB[1]-footA[1]);
  archBridge(new Frame(river,-197.5,0,-82.5,footYaw),86,7,8.1,true);
  // Low quays, mooring posts, two small river boats and reeds follow the west bank.
  for(let i=1;i<ORLEANS_RIVER.length-1;i++){
    const p=ORLEANS_RIVER[i],q=ORLEANS_RIVER[i+1];if(p[1]<-130||p[1]>100)continue;
    const dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),x=(p[0]+q[0])/2-Math.cos(yaw)*23,z=(p[1]+q[1])/2+Math.sin(yaw)*23;
    const quay=new Frame(river,x,0,z,yaw);quay.box(0,3.1,0,3,10.2,length+.25,C.joint);quay.box(0,8.2,0,5,.35,length+.25,C.stone);
    if(i%6===0&&roadDistance(x,z)>3)quay.cyl(0,9,0,.3,1.3,C.oak);
    for(const y of [1,3,5,7])quay.box(1.56,y,0,.07,.07,length+.25,C.stone,false);
  }
  for(const [index,[x,z,a]] of [[-204,-42,.1],[-201,4,-.12]].entries()){
    const boat=new Frame(river,x,.15,z,a),rings=[[-6,.25],[-4.5,1.45],[-1,1.8],[2,1.7],[4.5,1.25],[6,.3]],vertices:number[]=[],indices:number[]=[],scale=index===0?1:.82;
    const section=(w:number)=>[[-w*.65,-.35],[w*.65,-.35],[w,.85],[w-.18,.85],[w*.65-.13,-.18],[-w*.65+.13,-.18],[-w+.18,.85],[-w,.85]];
    for(const [zz,w] of rings)for(const [xx,yy] of section(w))vertices.push(xx,yy,zz*scale);
    for(let i=1;i<rings.length;i++)for(let j=0;j<8;j++){const a=(i-1)*8+j,b=i*8+j,c=(i-1)*8+(j+1)%8,d=i*8+(j+1)%8;indices.push(a,c,b,c,d,b);}
    for(const end of [0,rings.length-1]){const shape=section(rings[end][1]).map(([x,y])=>new THREE.Vector2(x,y));for(const t of THREE.ShapeUtils.triangulateShape(shape,[])){const a=end*8+t[0],b=end*8+t[1],c=end*8+t[2];indices.push(...(end===0?[a,c,b]:[a,b,c]));}}
    boat.mesh(vertices,indices,index?C.oak:C.wood,false);
    for(let i=1;i<rings.length;i++)for(const side of [-1,1])boat.beam([side*rings[i-1][1],.91,rings[i-1][0]*scale],[side*rings[i][1],.91,rings[i][0]*scale],.14,C.oak);
    for(const zz of [-2,1.8])boat.box(0,.42,zz*scale,2.7,.16,.6,C.oak,false);
    if(index===0)for(const side of [-1,1]){boat.beam([side*.9,.8,.2],[side*4.1,.1,1.6],.09,C.oak);boat.box(side*4,.08,1.55,.42,.08,1.2,C.wood,false,-side*.3);}
    else{for(const zz of [-2.5,0,2.2]){boat.box(0,.44,zz,1.6,.8,1.6,C.wood,false);boat.box(0,.88,zz,1.7,.12,1.7,C.oak,false);}}
    boat.beam([1.2,.9,-3],[16,8.2,-3],.035,'#a68d61');
  }
  const random=mulberry32(16118);let trees=0;
  for(let i=0;i<380;i++){
    const x=-310+random()*620,z=-305+random()*610,y=heightAt(x,z),d=riverDistance(x,z);
    if((x>150&&x<216&&z>-105&&z<90)||y<2||y>27||d<29||roadDistance(x,z)<13||Math.hypot(x-35,z+170)<125||Math.hypot((x+10)/185,(z-40)/155)<1.1||builtHouses.some(p=>Math.hypot(p.position[0]-x,p.position[2]-z)<17)||distanceToLine(x,z,ORLEANS_WALL)<16)continue;
    const h=7+random()*5,r=3+random()*2;trunks.add(CYL,C.wood,T(x,y+h/2,z,0,.5,h,.5));
    const willow=d<50;for(let j=0;j<3;j++)leaves.add(new THREE.IcosahedronGeometry(1,1),willow?'#7b985a':j%2?'#789051':'#93a368',T(x+(j-1)*r*.65,y+h+j%2*r*.55,z+(j%2)*r*.4,0,r,willow?r*1.4:r,r),false);
    trees++;if(trees>=90)break;
  }
  // Militia mustering ground remains distinct from the town square.
  for(const x of [112,147]){const tent=new Frame(props,x,14,145,.2);gable(tent,10,13,0,6,x===112?C.blue:C.white);banner(tent,0,7,7,4);}
  for(let i=0;i<4;i++){const x=113+i*10,z=113;if(roadDistance(x,z)<8)continue;props.box(x,14,z,.5,3,.5,C.oak);props.add(new THREE.CylinderGeometry(1.2,1.2,.2,12),'#a98e69',T(x,16.5,z,0,1,1,1,Math.PI/2));}
  pieces.push(...buildOrleansDetails(plan,heightAt,builtHouses));
  pieces.push(...buildOrleansWatercourse());
  return pieces;
}
