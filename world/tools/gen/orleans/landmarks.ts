import * as THREE from 'three';
import {Batch,BOX,T} from '../geo';
import {ORLEANS_BASTILLE as BA,ORLEANS_BRIDGE_MILL as BM,ORLEANS_FIELDS,ORLEANS_GRANGE as GR,ORLEANS_SCORCH,ORLEANS_TOURELLES as TR,ORLEANS_VINEYARD as VY,ORLEANS_WINDMILL as WM,laneDistance} from '../../../src/map/orleansOutskirts';
import {C,CYL,CONE,Frame,banner,gable,pointedArch,window} from './craft';
import {ICO0,ICO1,Solid,blob,plate,prismRoof,rod} from './kit';

type Height=(x:number,z:number)=>number;
export type Anchors=Record<string,[number,number,number]>;
const EMBER='#ff8a3a',LAMP='#d6ad6e',ROPE='#a68d61';

/** 桥头堡: twin drum towers and a gatehouse astride the road at the south end of the merchant bridge. */
export function buildTourelles(b:Batch,glow:Batch,h:Height,anchors:Anchors){
  const f=new Frame(b,TR.x,0,TR.z,TR.yaw),y0=TR.deck,top=y0+13;
  const g=(lx:number,lz:number)=>{const p=f.point(lx,0,lz);return h(p.x,p.z);};
  for(const s of [-1,1]){
    const base=Math.min(g(s*6.6,-5),g(s*6.6,5))-1.2;
    f.box(s*6.6,(base+top)/2,0,3.2,top-base,11,C.stone);
    for(const yy of [y0+2.6,y0+5.6])f.box(s*5.02,yy,0,.1,.22,10.6,C.joint,false);
  }
  // The passage keeps the full road width and more than eight metres of headroom.
  f.box(0,y0+10.8,0,10,4.4,11,C.stone);
  for(const z of [-5.6,5.6])pointedArch(f,0,y0,z,10,8.9,.9,C.pale);
  for(let x=-4;x<=4;x+=1)f.box(x,y0+7.7,-5.25,.14,2.3,.14,C.iron,false);
  for(const yy of [6.9,7.7,8.5])f.box(0,y0+yy,-5.25,8.4,.12,.12,C.iron,false);
  f.box(0,top+.3,0,17,.6,12.4,C.pale);
  for(const z of [-5.9,5.9])for(let x=-7.5;x<=7.5;x+=2.5)f.box(x,top+1.2,z,1.5,1.2,.6,C.pale,false);
  gable(f,13,8,top+.6,4.2,C.slate);
  for(const z of [-5.75,5.75])banner(f,0,y0+12.6,z,3.4);
  for(const s of [-1,1]){
    const x=s*12.6,base=Math.min(g(x-5,0),g(x+5,0),g(x,5),g(x,-5))-1.2,broken=s<0,tt=broken?y0+10.5:y0+15.5;
    f.cyl(x,(base+tt)/2,0,5.6,tt-base,C.stone);
    f.cyl(x,y0+6.2,0,5.74,.36,C.joint,false);f.cyl(x,y0+.7,0,5.9,1.4,C.joint);
    for(const [yy,n,o] of [[y0+3.6,4,.4],[y0+8.7,4,1.2]] as const)for(let k=0;k<n;k++){
      const t=k/n*Math.PI*2+o;f.box(x+Math.sin(t)*5.6,yy,Math.cos(t)*5.6,.34,1.7,.16,C.dark,false,t);
    }
    if(!broken){
      f.cyl(x,tt+.3,0,6.3,.6,C.pale);
      for(let k=0;k<10;k++){const t=k/10*Math.PI*2;f.box(x+Math.sin(t)*5.9,tt+1.2,Math.cos(t)*5.9,1.6,1.2,.7,C.pale,false,t);}
      const q=f.point(x,tt+5.2,0);b.add(CONE,C.slate,T(q.x,q.y,q.z,0,6.5,9.2,6.5),false);
      f.box(x,tt+11,0,.14,2.6,.14,C.gold,false);f.box(x+.95,tt+11.8,0,1.8,.7,.05,C.blue,false);
    }else{
      // The western tower lost its cap in the siege: a jagged crown and burnt floor timbers.
      const crown=[3.4,1.2,2.6,.6,0,1.8,3,.9,2.2];
      for(const [k,hh] of crown.entries()){
        if(!hh)continue;const t=k/crown.length*Math.PI*2;
        f.box(x+Math.sin(t)*5.05,tt+hh/2,Math.cos(t)*5.05,2.7,hh,1.1,k%2?C.stone:C.joint,true,t);
      }
      f.beam([x-3,tt+.3,-2],[x+3.5,tt+2.8,1],.3,C.char);f.beam([x+2,tt+.2,-3],[x-1.5,tt+3.6,2.4],.26,C.char);
      for(const [t,yy] of [[2.3,y0+7.4],[2.9,y0+4.2],[1.8,y0+9.2]])f.box(x+Math.sin(t)*5.63,yy,Math.cos(t)*5.63,1.5,1.1,.1,C.char,false,t);
      for(let k=0;k<8;k++){
        const lx=x-4+(k%4)*2.1+(k>3?.9:0),lz=6.6+Math.floor(k/4)*1.7,p=f.point(lx,0,lz);
        blob(b,p.x,h(p.x,p.z)+.35,p.z,.95-(k%3)*.18,.55,.75,k%2?C.stone:C.joint,ICO0,k);
      }
    }
  }
  // Outworks on the field side: earth-filled gabions and spiked barriers flank the road.
  for(const s of [-1,1]){
    // Kept close under the gate: the lane west and the old road east both turn off just beyond.
    for(let k=0;k<4;k++){
      const lx=s*(6.3+k*1.5),lz=8.4+(k%2)*.5,gy=g(lx,lz);
      f.cyl(lx,gy+.75,lz,.72,1.5,C.wicker);f.cyl(lx,gy+1.52,lz,.6,.06,C.earth,false);
    }
    // Bridge side: a lantern post each side of the roadway.
    const px=s*5.7,pz=-8.4,py=Math.max(g(px,pz),y0-.4),e=new Frame(glow,TR.x,0,TR.z,TR.yaw);
    f.box(px,py+1.7,pz,.2,3.4,.2,C.dark);f.box(px,py+3.5,pz,.5,.1,.5,C.dark,false);f.box(px,py+4.15,pz,.5,.12,.5,C.dark,false);
    e.box(px,py+3.82,pz,.34,.5,.34,LAMP,false);
  }
  // Spiked barriers dragged clear of the crossroads once the siege lifted.
  for(const [x,z,a] of [[-3,311,.5],[9,308.5,-.3]]){
    const cf=new Frame(b,x,h(x,z),z,a);cf.beam([-2.2,.9,0],[2.2,.9,0],.24,C.wood,true);
    for(let k=0;k<5;k++){const xx=-1.7+k*.85;cf.beam([xx,.05,-.95],[xx,1.75,.95],.1,C.oak);cf.beam([xx+.25,.05,.95],[xx+.25,1.75,-.95],.1,C.oak);}
  }
  const post=f.point(3.3,y0+.1,1.5);anchors.bridgeWarden=[post.x,post.y,post.z];
}

/** 桥上磨坊: a stone pier in mid-river carries the loop's corner, a mill house and the hanging wheel frame. */
export function buildBridgeMill(b:Batch,glow:Batch,anchors:Anchors){
  const f=new Frame(b,BM.x,0,BM.z,BM.yaw),top=BM.deck-.1,bed=-3.8;
  f.box(0,(top+bed)/2,4,13,top-bed,22,C.stone);
  f.box(0,12.9,4,13.3,.36,22.3,C.pale,false);f.box(0,7.6,4,13.2,.3,22.2,C.joint,false);
  // Tide-marked base course, mooring rings and narrow store-room lights in the pier's flanks.
  f.box(0,.5,4,13.5,2.4,22.5,'#8c8f76',false);
  for(const s of [-1,1]){
    for(const z of [-2,4,10])f.box(s*6.53,10.4,z,.1,1.5,.5,C.dark,false);
    for(const z of [1,8]){const q=f.point(s*6.62,2.6,z);b.add(new THREE.TorusGeometry(.34,.07,5,10),C.iron,T(q.x,q.y,q.z,BM.yaw),false);}
    for(let k=0;k<4;k++)f.box(s*6.52,3.6+k*2.3,4+((k%2)?5.5:-5.5),.08,.16,7,C.joint,false);
  }
  for(const [zb,za,hi] of [[15,22.5,top],[-7,-11.5,6]] as const){
    const s=new Solid(),P=[[-6.5,zb],[6.5,zb],[0,za]],lo=P.map(([x,z])=>s.p(x,bed,z)),up=P.map(([x,z])=>s.p(x,hi,z)),d=Math.sign(za-zb);
    s.tri(up[0],up[1],up[2],[0,1,0]);s.quad(lo[1],lo[2],up[2],up[1],[1,0,d]);s.quad(lo[2],lo[0],up[0],up[2],[-1,0,d]);s.emit(f,C.stone);
  }
  // Corbelled landings receive the two trestles, so the planks meet stone and never bare air.
  f.box(-3.4,top-.35,-9,8,.7,4.4,C.stone);f.box(8.7,top-.35,.7,4.6,.7,8,C.stone);
  for(const x of [-6.6,-3.4,-.2])f.beam([x,top-.7,-10.8],[x,top-3.6,-7.1],.5,C.joint);
  for(const z of [-2.4,.7,3.8])f.beam([10.6,top-.7,z],[6.6,top-3.6,z],.5,C.joint);
  // Parapets leave both landings of the loop and the mill door clear.
  f.box(6.25,top+.52,-5.1,.5,1.05,3.8,C.pale);f.box(6.25,top+.52,9.8,.5,1.05,10.4,C.pale);
  f.box(3.45,top+.52,-6.75,6.1,1.05,.5,C.pale);f.box(-6.25,top+.52,-.2,.5,1.05,9.6,C.pale);
  for(const s of [-1,1])for(const yy of [.27,.79])f.beam([s*6.3,top+yy,15.2],[s*.2,top+yy,22.2],.52,C.pale,true);
  // Mill house: its door faces the yard and the road; the rear stands on the upstream nose.
  const P=f.point(-1,0,10),hf=new Frame(b,P.x,top,P.z,BM.yaw+Math.PI),w=9,d=9,hh=5.2,plaster='#e1d1ac';
  hf.box(-w/2+.25,hh/2,0,.5,hh,d,plaster);hf.box(w/2-.25,hh/2,0,.5,hh,d,plaster);hf.box(0,hh/2,-d/2+.25,w,hh,.5,plaster);
  for(const s of [-1,1])hf.box(s*(1.3+(w-2.6)/4),hh/2,d/2-.25,(w-2.6)/2,hh,.5,plaster);
  hf.box(0,(hh+3.2)/2,d/2-.25,2.6,hh-3.2,.5,plaster);
  for(const sx of [-w/2,w/2])for(const sz of [-d/2,d/2])hf.box(sx,hh/2,sz,.34,hh,.34,C.wood,false);
  for(const yy of [.2,2.7,hh-.15])hf.box(0,yy,d/2+.03,w,.24,.14,C.wood,false);
  for(const s of [-1,1]){hf.beam([s*4.3,.3,d/2+.06],[s*1.6,2.6,d/2+.06],.18,C.wood);window(hf,s*2.9,3.9,d/2+.03,1.1,1.5);hf.box(s*(w/2+.02),3,0,.08,1.5,1.2,C.dark,false);}
  gable(hf,w,d,hh,3.8,C.slate);
  hf.beam([0,hh+2.6,d/2],[0,hh+2.6,d/2+2.5],.3,C.wood);hf.beam([0,hh+2.6,d/2+2.1],[0,3.3,d/2+2.1],.04,ROPE);
  {const q=hf.point(0,2.9,d/2+2.1);blob(b,q.x,q.y,q.z,.5,.62,.45,'#b8aa82',ICO1);}
  // Inside: bedstone and runner under the hopper; the middle of the floor stays open.
  hf.cyl(0,.3,-1.9,1.35,.6,C.joint);hf.cyl(0,.85,-1.9,1.25,.45,C.stone);
  for(const sx of [-1,1])for(const sz of [-1,1])hf.box(sx*.75,1.6,-1.9+sz*.75,.14,1.4,.14,C.wood,false);
  hf.box(0,2.6,-1.9,1.7,.9,1.7,C.oak,false);
  for(const [k,[sx,sz]] of [[-3.2,-3.2],[-2.3,-3.3],[-3.2,-2.3],[3.2,-3.2]].entries()){const q=hf.point(sx,.45,sz);blob(b,q.x,q.y,q.z,.55,.45,.5,k%2?'#b8aa82':'#c7b98f',ICO1);}
  // Hanging wheel frame (moulin pendant): the boarded gear loft overhangs the channel
  // and two posts drop to the outer bearing. The wheel itself turns in the runtime scene.
  const W=BM.wheel;
  f.box(-8.05,11.65,W.z,3.1,4.5,6,C.oak);f.box(-7.55,15.6,W.z,4.1,3.4,6,C.oak);
  for(const z of [W.z-3,W.z,W.z+3])f.box(-9.63,13.4,z,.12,7.6,.3,C.wood,false);
  plate(b,...f.point(-7.6,17.55,W.z).toArray() as [number,number,number],BM.yaw+Math.PI/2,.16,6.8,.24,4.9,C.slate);
  for(const z of [W.z-1.6,W.z+1.6]){f.box(-9.75,5.9,z,.32,7,.32,C.wood);f.beam([-6.5,6.6,z],[-9.5,9.4,z],.26,C.wood);}
  f.box(-9.75,W.y,W.z,.42,.42,3.6,C.wood);f.box(-6.76,W.y,W.z,.5,.9,1.3,C.wood,false);
  // Working yard: spare stones against the parapet, flour sacks and a lamp by the door.
  for(const [k,z] of [10.5,12.2].entries()){const q=f.point(5.55-k*.25,top+1.15,z);b.add(CYL,k?C.stone:C.joint,T(q.x,q.y,q.z,BM.yaw+Math.PI/2,1.15,.3,1.15,Math.PI/2-.22),false);}
  for(const [k,[x,z]] of [[2.2,4.2],[3.1,4.4],[2.6,4.3]].entries()){const q=f.point(x,top+.4+(k===2?.62:0),z);blob(b,q.x,q.y,q.z,.55,.42,.5,'#c7b98f',ICO1);}
  const e=new Frame(glow,BM.x,0,BM.z,BM.yaw);
  f.box(5.6,top+1.9,-2.9,.18,3.8,.18,C.dark);f.box(5.6,top+3.7,-2.9,.5,.1,.5,C.dark,false);e.box(5.6,top+4,-2.9,.34,.5,.34,LAMP,false);f.box(5.6,top+4.32,-2.9,.5,.12,.5,C.dark,false);
  const q=f.point(3,top,-3.4);anchors.miller=[q.x,q.y,q.z];
}

/** 河岸葡萄园: an open press barn between two walled blocks of vines above the south bank. */
export function buildVineyard(b:Batch,foliage:Batch,h:Height,anchors:Anchors){
  const gy=h(VY.x,VY.z),f=new Frame(b,VY.x,gy,VY.z,Math.PI/2); // local z runs east, local x runs north
  f.box(0,.08,0,9.6,.16,14.6,C.joint);
  for(const x of [-4.5,4.5])for(const z of [-7,0,7]){
    if(x>0&&z===0)continue; // the lane-side middle bay is the cart entrance
    f.box(x,2.25,z,.4,4.5,.4,C.wood);f.beam([x,3.1,z],[x*.7,4.45,z],.2,C.oak);
  }
  for(const z of [-7,0,7])f.box(0,4.35,z,9.4,.3,.35,C.wood,false);
  for(const x of [-4.5,4.5])f.box(x,4.5,0,.35,.3,14.4,C.wood,false);
  prismRoof(f,9,14,4.6,3.6,C.thatch,'#a38d58');
  f.box(-4.5,1.2,0,.3,2.4,14,C.wicker);
  // Screw press: stone bed, staved tub, twin cheeks, head beam, screw and capstan bar.
  const pz=-3.6;
  f.cyl(0,.46,pz,2.1,.6,C.stone);f.cyl(0,1.36,pz,1.7,1.2,C.oak);f.cyl(0,2.05,pz,1.5,.2,C.wood,false);
  for(const yy of [.95,1.75]){const q=f.point(0,yy,pz);b.add(new THREE.TorusGeometry(1.72,.07,5,18),C.iron,T(q.x,gy+yy,q.z,0,1,1,1,Math.PI/2),false);}
  for(const x of [-2.3,2.3])f.box(x,2.5,pz,.42,4.7,.42,C.wood);
  f.box(0,4.55,pz,5.4,.5,.6,C.wood,false);f.cyl(0,3.3,pz,.2,2.5,C.oak,false);f.beam([-2.4,2.9,pz+.5],[2.6,3.3,pz-.6],.14,C.oak);
  f.cyl(1.4,1.06,3.6,1.25,1.8,C.oak);f.cyl(1.4,1.98,3.6,1.1,.06,C.grape,false);f.cyl(-1.7,.9,5,1,1.5,C.oak);f.cyl(-1.7,1.67,5,.86,.06,C.grape,false);
  for(let k=0;k<4;k++){
    const q=f.point(-3.5,.72,-5.6+k*1.7);rod(b,[q.x,q.y,q.z-.62],[q.x,q.y,q.z+.62],.56,C.oak,true);
    for(const o of [-.38,.38])rod(b,[q.x,q.y,q.z+o-.04],[q.x,q.y,q.z+o+.04],.6,C.iron);
  }
  for(const [k,[x,z]] of [[3,2.4],[2.2,-.6],[3.4,-1]].entries()){
    f.cyl(x,.42,z,.48,.52,C.wicker,false);const q=f.point(x,.74,z);blob(b,q.x,q.y,q.z,.42,.2,.42,k%2?C.grape:'#7c5c8c',ICO1);
  }
  // Rows of staked vines follow the painted soil; the lane and the press yard stay clear.
  let n=0;
  for(const fd of ORLEANS_FIELDS.filter(v=>v.crop==='vine'))for(let v=-fd.d/2+1.6;v<fd.d/2;v+=3.2)for(let u=-fd.w/2+1.2;u<fd.w/2;u+=2.4){
    const x=fd.x+Math.cos(fd.a)*u+Math.sin(fd.a)*v,z=fd.z-Math.sin(fd.a)*u+Math.cos(fd.a)*v;
    if(laneDistance(x,z)<3.5||Math.hypot(x-VY.x,z-VY.z)<13)continue;
    const y=h(x,z);b.box(x,y,z,.1,1.5,.1,C.wood,0,false);
    blob(foliage,x,y+1.12,z,1.15,.72+(n%3)*.08,.6,n%2?C.vine:'#7f9a52',ICO0,fd.a);
    if(n%3===0)blob(b,x+.32,y+.78,z+.1,.2,.27,.2,C.grape);
    n++;
  }
  // Dry-stone wall along the lane, with a gate in front of the barn.
  for(let x=-206,k=0;x<=-58;x+=3,k++){
    if(x>-140.5&&x<-119.5)continue;
    b.box(x,h(x,304.2)-.3,304.2,3.05,1.35+(k%3)*.08,.7,k%2?C.stone:C.joint);
  }
  for(const x of [-140.4,-119.6]){const y=h(x,304.2);b.box(x,y-.3,304.2,1,2.5,1,C.pale);blob(b,x,y+2.5,304.2,.45,.45,.45,C.joint,ICO1);}
  // Harvest cart beside the gate.
  const cart=new Frame(b,-117,h(-117,308.5),308.5,.5);
  cart.box(0,.95,0,1.8,.2,3.4,C.oak);for(const s of [-1,1]){cart.box(s*.9,1.3,0,.1,.6,3.4,C.wood,false);const q=cart.point(s*1.05,.7,.2);b.add(new THREE.TorusGeometry(.7,.09,5,12),C.wood,T(q.x,q.y,q.z,.5+Math.PI/2),false);}
  cart.beam([0,.95,1.7],[0,.5,3.6],.1,C.wood);{const q=cart.point(0,1.3,-.3);blob(b,q.x,q.y,q.z,.75,.3,1.3,C.grape,ICO1);}
  const q=f.point(-1.5,.16,1.2);anchors.vintner=[q.x,q.y,q.z];
}

/** 焦痕农庄: a farm the shadow passed over. The dovecote and house stand; the barn is a burnt shell. */
export function buildGrange(b:Batch,foliage:Batch,glow:Batch,h:Height,anchors:Anchors){
  // Long thatched farmhouse north of the yard.
  const hx=GR.x-20,hz=GR.z-15,hy=h(hx,hz),hf=new Frame(b,hx,hy,hz,0);
  hf.box(0,.25,0,15.4,.7,7.4,C.stone);hf.box(0,2.3,0,15,3.8,7,C.white);
  prismRoof(new Frame(b,hx,hy,hz,Math.PI/2),7,15,4.2,3.5,C.thatch,'#a38d58');
  for(const x of [-7.5,-2.5,2.5,7.5])hf.box(x,2.3,3.53,.26,3.8,.1,C.wood,false);
  for(const yy of [.75,4.1])hf.box(0,yy,3.53,15,.24,.1,C.wood,false);
  hf.box(-.1,1.75,3.55,1.3,2.4,.12,C.oak,false);for(const x of [-5,5])window(hf,x,2.6,3.5,1.2,1.4);
  hf.box(5.6,5.6,-.4,1.1,4.6,1.1,C.joint);hf.box(5.6,8,-.4,1.4,.25,1.4,C.stone,false);
  // Round dovecote with a lantern, nest holes and a landing ledge.
  const dx=GR.x-19,dz=GR.z+13,dy=h(dx,dz),df=new Frame(b,dx,dy,dz);
  df.cyl(0,4.6,0,3.7,9.2,C.pale);df.cyl(0,.35,0,4,.7,C.stone);df.cyl(0,6.95,0,3.95,.12,C.stone,false);df.cyl(0,9.35,0,4.1,.3,C.stone,false);
  b.add(CONE,C.slate,T(dx,dy+12.1,dz,0,4.4,5.2,4.4),false);df.cyl(0,15,0,.75,1.3,C.pale,false);b.add(CONE,C.slate,T(dx,dy+16.4,dz,0,1.1,1.5,1.1),false);
  for(const yy of [7.4,8.3])for(let k=0;k<10;k++){const t=(k+(yy>8?.5:0))/10*Math.PI*2;df.box(Math.sin(t)*3.72,yy,Math.cos(t)*3.72,.36,.42,.1,C.dark,false,t);}
  const door=Math.atan2(GR.x-dx,GR.z-dz);df.box(Math.sin(door)*3.68,1.5,Math.cos(door)*3.68,1.2,2.3,.14,C.oak,false,door);
  for(const [t,yy] of [[.3,7.12],[1.9,7.12],[3.4,7.12],[4.4,7.12],[5.5,9.62]])blob(b,dx+Math.sin(t)*3.85,dy+yy,dz+Math.cos(t)*3.85,.2,.15,.28,'#f1ece0',ICO1,t);
  // Burnt barn along the swath: one gable still stands, the rest is stubs and charred timber.
  const dir=[Math.cos(ORLEANS_SCORCH.a),-Math.sin(ORLEANS_SCORCH.a)],bx=GR.x+22,bz=GR.z-9,by=h(bx,bz),bf=new Frame(b,bx,by,bz,Math.atan2(dir[0],dir[1]));
  bf.box(0,2,8,10,4,.7,C.joint);
  {const s=new Solid(),P=[[-5,4],[5,4],[0,7.6]],a=P.map(([x,y])=>s.p(x,y,7.65)),c=P.map(([x,y])=>s.p(x,y,8.35));
   s.tri(a[0],a[1],a[2],[0,0,-1]);s.tri(c[0],c[1],c[2],[0,0,1]);s.quad(a[0],a[2],c[2],c[0],[-1,1,0]);s.quad(a[1],a[2],c[2],c[1],[1,1,0]);s.emit(bf,C.joint);}
  for(const [x,w,hh] of [[-3.6,2.8,2.3],[-.6,2.6,3.5],[3.4,3.2,1.3]])bf.box(x,hh/2,-8,w,hh,.7,C.joint);
  for(const s of [-1,1])for(let z=-6.5,k=0;z<=6.6;z+=2.6,k++){
    if(s<0&&Math.abs(z)<2)continue;const hh=[1.7,.6,1.1,.5,1.5,.9][(k+(s>0?2:0))%6];
    bf.box(s*4.85,hh/2,z,.6,hh,2.5,k%2?C.stone:C.joint);
  }
  for(const [k,[x,z]] of [[-3.2,-5],[3.2,-5],[-3.2,0],[3.2,.4],[-3.2,5],[3.2,5]].entries())bf.box(x,[1.9,1.2,2.2,.9,1.6,2][k],z,.36,[3.8,2.4,4.4,1.8,3.2,4][k],.36,C.char);
  for(const [a,c] of [[[-3.2,4.3,0],[2.6,.3,2.2]],[[3.2,3.9,5],[-2,.3,3.4]],[[-3.2,3.6,-5],[1.4,.25,-6.4]],[[-1,.3,-2.6],[3,.5,-3.4]],[[-2.4,.3,6.2],[2.2,1.6,6.6]]])bf.beam(a,c,.28,C.char);
  const eb=new Frame(glow,bx,by,bz,bf.a);
  for(const [x,z] of [[-1.2,-1.4],[.8,2.2],[2.1,-3.2],[-2.2,4.4],[.2,-4.6],[1.6,5.4],[-.6,.8]])eb.box(x,.12,z,.2,.12,.2,EMBER,false);
  for(const [x,z] of [[0,1.4],[-1.6,-3.2]]){const q=bf.point(x,.45,z);blob(b,q.x,q.y,q.z,1.5,.5,1.2,C.char,ICO1);}
  // Charred trees stand where the fire ran; scorched stone lies in the gouges.
  for(const [k,claw] of ORLEANS_SCORCH.claws.entries())for(const t of [.3,.62,.9]){
    const x=claw[0][0]+(claw[1][0]-claw[0][0])*t+(k-1)*2.4,z=claw[0][1]+(claw[1][1]-claw[0][1])*t+(k%2?4.6:-4.2);
    if(Math.hypot(x-bx,z-bz)<13)continue;
    const y=h(x,z),hh=3.6+((k*3+Math.round(t*10))%4)*.7,lean=.5-((k+Math.round(t*10))%3)*.5;
    rod(b,[x,y-.3,z],[x+lean,y+hh,z+.3],.26,C.char,true);rod(b,[x+lean*.6,y+hh*.6,z+.2],[x+lean+1.3,y+hh*.95,z-.5],.1,C.char);rod(b,[x+lean*.75,y+hh*.75,z+.2],[x+lean-1.1,y+hh*1.05,z+.8],.09,C.char);
  }
  for(const claw of ORLEANS_SCORCH.claws)for(const t of [.2,.55,.8]){
    const x=claw[0][0]+(claw[1][0]-claw[0][0])*t,z=claw[0][1]+(claw[1][1]-claw[0][1])*t+1.6;
    if(Math.hypot(x-bx,z-bz)<12||Math.hypot(x-GR.x,z-GR.z)<6)continue;
    blob(b,x,h(x,z)+.2,z,.7,.38,.55,'#2f2c2a',ICO0,t*9,true);
  }
  // Yard: well, paddock rails (broken on the burnt side), cart and haystacks by the wheat.
  const wx=GR.x-6,wz=GR.z-8,wy=h(wx,wz),well=new Frame(b,wx,wy,wz);
  well.cyl(0,.45,0,1.3,.9,C.stone);well.cyl(0,.92,0,1,.04,'#5f8088',false);for(const x of [-1.5,1.5])well.box(x,1.5,0,.2,3,.2,C.oak);
  well.beam([-1.5,2.6,0],[1.5,2.6,0],.18,C.wood);prismRoof(well,3.6,2.2,3,1.1,C.thatch);
  const rails:[number,number][]=[[GR.x-10,GR.z+8],[GR.x-10,GR.z+24],[GR.x+12,GR.z+24],[GR.x+12,GR.z+12]];
  for(let i=1;i<rails.length;i++){
    const a=rails[i-1],c=rails[i],len=Math.hypot(c[0]-a[0],c[1]-a[1]),m=Math.round(len/3);
    for(let j=0;j<=m;j++){
      const x=a[0]+(c[0]-a[0])*j/m,z=a[1]+(c[1]-a[1])*j/m,y=h(x,z);b.box(x,y,z,.16,1.3,.16,C.oak,0,false);
      if(j<m){const x2=a[0]+(c[0]-a[0])*(j+1)/m,z2=a[1]+(c[1]-a[1])*(j+1)/m,y2=h(x2,z2);for(const yy of [.55,1.05])rod(b,[x,y+yy,z],[x2,y2+yy,z2],.05,C.wood);}
    }
  }
  const cart=new Frame(b,GR.x+7,h(GR.x+7,GR.z+5),GR.z+5,-.7);
  cart.box(0,.95,0,1.8,.2,3.4,C.oak);for(const s of [-1,1]){cart.box(s*.9,1.3,0,.1,.6,3.4,C.wood,false);const q=cart.point(s*1.05,.7,.2);b.add(new THREE.TorusGeometry(.7,.09,5,12),C.wood,T(q.x,q.y,q.z,-.7+Math.PI/2),false);}
  cart.beam([0,.95,1.7],[0,.4,3.6],.1,C.wood);
  for(const [x,z,r] of [[78,322,2.3],[96,334,2],[108,324,2.5],[GR.x-2,GR.z+19,1.8]]){
    const y=h(x,z);b.add(CYL,C.hay,T(x,y+r*.45,z,0,r,r*.9,r));b.add(CONE,'#bfa55c',T(x,y+r*.9+r*.55,z,0,r*1.08,r*1.1,r*1.08),false);
  }
  blob(foliage,GR.x-27,h(GR.x-27,GR.z-4)+4.6,GR.z-4,3.2,3.4,3,'#859b61',ICO1);b.add(CYL,C.wood,T(GR.x-27,h(GR.x-27,GR.z-4)+1.5,GR.z-4,0,.32,3,.32));
  anchors.dovekeeper=[GR.x-6,h(GR.x-6,GR.z+3),GR.z+3];
}

/** 东岗风车: a limestone tower mill on the east ridge. Hub, stocks and cloth sails turn at runtime. */
export function buildWindmill(b:Batch,h:Height){
  const gy=h(WM.x,WM.z),f=new Frame(b,WM.x,gy,WM.z),r=(y:number)=>4.5-1.3*y/12;
  b.add(new THREE.CylinderGeometry(3.2,4.5,12,16),C.pale,T(WM.x,gy+6,WM.z));
  f.cyl(0,.2,0,5.1,1.2,C.stone);
  for(const y of [4.2,8.4])b.add(new THREE.CylinderGeometry(r(y)+.06,r(y)+.1,.3,16),C.joint,T(WM.x,gy+y,WM.z),false);
  f.box(0,1.35,r(1.3)-.05,1.4,2.5,.3,C.oak,false);pointedArch(f,0,.1,r(1.3)+.1,1.9,3,.22,C.joint);
  for(const [y,ts] of [[5.2,[0,2.1,-2.1]],[8.8,[1,-1,3.14]]] as const)for(const t of ts)f.box(Math.sin(t)*r(y),y,Math.cos(t)*r(y),.7,1.2,.24,C.dark,false,t);
  f.cyl(0,12.25,0,3.5,.5,C.wood);b.add(new THREE.ConeGeometry(3.7,3.6,10),'#5f5347',T(WM.x,gy+14.3,WM.z),false);
  const sx=Math.sin(WM.yaw),sz=Math.cos(WM.yaw);
  f.beam([0,WM.hub,0],[sx*WM.reach,WM.hub,sz*WM.reach],.46,C.wood);
  // Tail pole and winch: the miller turns the cap into the wind from the ground.
  f.beam([-sx*2.6,12.5,-sz*2.6],[-sx*9.5,.7,-sz*9.5],.22,C.wood);
  {const p=f.point(-sx*9.5,0,-sz*9.5),y=h(p.x,p.z);b.box(p.x,y,p.z,.4,1.1,.4,C.oak);b.add(new THREE.TorusGeometry(.5,.07,5,12),C.wood,T(p.x,y+.8,p.z,WM.yaw),false);}
  for(const [k,[x,z]] of [[2.6,5.2],[3.5,5],[3,5.6],[-3.4,5.4]].entries()){const y=h(WM.x+x,WM.z+z);blob(b,WM.x+x,y+.42+(k===2?.6:0),WM.z+z,.55,.42,.5,k%2?'#b8aa82':'#c7b98f',ICO1,k,k!==2);}
  {const q=f.point(-4.2,1.1,2.4);b.add(CYL,C.joint,T(q.x,q.y,q.z,1.05,1.1,.28,1.1,Math.PI/2-.3),false);}
  for(let k=0;k<9;k++){
    const t=.9+k*.42,x=WM.x+Math.sin(t)*10.5,z=WM.z+Math.cos(t)*10.5,y=h(x,z);if(Math.abs(t-Math.PI)<.5)continue;
    b.box(x,y,z,.16,1.2,.16,C.oak,0,false);
    const t2=t+.42,x2=WM.x+Math.sin(t2)*10.5,z2=WM.z+Math.cos(t2)*10.5;if(k<8&&Math.abs(t2-Math.PI)>=.5)for(const yy of [.5,1])rod(b,[x,y+yy,z],[x2,h(x2,z2)+yy,z2],.05,C.wood);
  }
}

/** 东郊围城营垒: an abandoned siege fort retaken by the town: rampart, palisade, bombards and a trebuchet. */
export function buildBastille(b:Batch,cloth:Batch,glow:Batch,h:Height,anchors:Anchors){
  const cx=BA.x,cz=BA.z,H=BA.half;
  type Side={a:[number,number];e:[number,number];n:[number,number];low:[number,number][];open:[number,number][];ports:number[]};
  const sides:Side[]=[
    {a:[cx-H,cz+H],e:[cx+H,cz+H],n:[0,1],low:[],open:[[H-3.6,H+3.6]],ports:[]},
    {a:[cx+H,cz+H],e:[cx+H,cz-H],n:[1,0],low:[],open:[],ports:[]},
    {a:[cx+H,cz-H],e:[cx-H,cz-H],n:[0,-1],low:[],open:[],ports:[]},
    // The west face looks at the town: two gun ports and the breach the defenders stormed.
    {a:[cx-H,cz-H],e:[cx-H,cz+H],n:[-1,0],low:[[H-8,H+3]],open:[],ports:[H-14,H+10]},
  ];
  const inAny=(t:number,list:[number,number][])=>list.some(([a,c])=>t>=a&&t<=c);
  for(const [si,s] of sides.entries()){
    const len=2*H,tx=(s.e[0]-s.a[0])/len,tz=(s.e[1]-s.a[1])/len,step=2,m=Math.round(len/step);
    let run:Solid|null=null,prev:number[]|null=null;
    const flush=()=>{if(run)run.emit(new Frame(b,0,0,0),C.turf);run=null;prev=null;};
    for(let j=0;j<=m;j++){
      const t=j*step,x=s.a[0]+tx*t,z=s.a[1]+tz*t;
      if(inAny(t,s.open)){flush();continue;}
      const low=inAny(t,s.low),crest=h(x,z)+(low?.7:2.6),pt=(o:number,y:number)=>run!.p(x+s.n[0]*o,y,z+s.n[1]*o);
      if(!run)run=new Solid();
      const row=[pt(3.6,h(x+s.n[0]*3.6,z+s.n[1]*3.6)-.3),pt(.9,crest),pt(-.9,crest),pt(-3.4,h(x-s.n[0]*3.4,z-s.n[1]*3.4)-.3)];
      if(prev){
        run.quad(prev[0],row[0],row[1],prev[1],[s.n[0]*.6,.8,s.n[1]*.6]);run.quad(prev[1],row[1],row[2],prev[2],[0,1,0]);
        run.quad(prev[2],row[2],row[3],prev[3],[-s.n[0]*.6,.8,-s.n[1]*.6]);
      }else run.quad(row[0],row[1],row[2],row[3],[-tx,0,-tz]);
      const next=(j+1)*step;
      if(j===m||inAny(next,s.open)){run.quad(row[0],row[1],row[2],row[3],[tx,0,tz]);flush();continue;}
      prev=row;
      // Palisade on the outer crest: sharpened stakes, with one slim collision wall per bay.
      const port=s.ports.some(p=>Math.abs(t+step/2-p)<1.7);
      if(!low&&!port){
        for(const o of [.2,.2+step/2]){
          const px=x+tx*o+s.n[0]*.9,pz=z+tz*o+s.n[1]*.9,hh=2.2+((j*7+si*3+(o>1?1:0))%5)*.13;
          b.box(px,crest-.2,pz,.3,hh,.3,(j+si)%3?C.wood:C.oak,0,false);b.add(CONE,C.oak,T(px,crest-.2+hh+.2,pz,0,.2,.45,.2),false);
        }
        b.addCol(BOX,T(x+tx*step/2+s.n[0]*.9,crest+1.1,z+tz*step/2+s.n[1]*.9,Math.atan2(tx,tz),.3,2.4,step+.05));
      }else if(low&&j%2===0){
        const px=x+s.n[0]*(1.6-(j%3)),pz=z+s.n[1]*(1.6-(j%3));rod(b,[px,crest-.3,pz],[px+1.6,crest+.5,pz+tz*1.2],.14,C.wood);
      }
    }
    flush();
  }
  // Corner gabions, stacked inside each angle.
  for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])for(let k=0;k<4;k++){
    const x=cx+sx*(H-5.2-(k%2)*1.5),z=cz+sz*(H-5.2-Math.floor(k/2)*1.5),y=h(x,z);
    b.add(CYL,C.wicker,T(x,y+.75,z,0,.72,1.5,.72));b.add(CYL,C.earth,T(x,y+1.52,z,0,.6,.06,.6),false);
  }
  // Two bombards on earth platforms fire over the west crest.
  for(const gz of [cz-14,cz+10]){
    const gxp=cx-H+5.4,py=h(gxp,gz);b.box(gxp,py-.3,gz,4.4,1.9,4.2,C.earth);
    const gf=new Frame(b,gxp,py+1.6,gz,-Math.PI/2);
    gf.box(0,.3,0,1.4,.5,3.6,C.oak);for(const s of [-1,1])gf.box(s*.62,.75,.2,.16,.5,3,C.wood,false);
    const a=gf.point(0,1.05,-1.2),c=gf.point(0,1.32,2.1),br=gf.point(0,.98,-2.1);
    rod(b,a.toArray(),c.toArray(),.47,C.iron,true);rod(b,br.toArray(),a.toArray(),.34,C.iron);
    for(const t of [.05,.3,.55,.8,.97]){const p=a.clone().lerp(c,t),d=c.clone().sub(a).normalize().multiplyScalar(.09);rod(b,p.clone().sub(d).toArray(),p.clone().add(d).toArray(),.55,C.dark);}
    for(const [k,[x,z]] of [[1.5,-.6],[2.05,-.6],[1.78,-.1],[1.78,-.42]].entries()){const q=gf.point(x,k===3?.92:.36,z);blob(b,q.x,q.y,q.z,.36,.36,.36,C.stone,ICO1);}
    const keg=gf.point(-1.5,.5,-1);b.add(CYL,C.oak,T(keg.x,keg.y,keg.z,0,.4,.9,.4));
  }
  // Counterweight trebuchet, its arm at rest above the frame.
  const tf=new Frame(b,cx+8,h(cx+8,cz-7),cz-7,-Math.PI/2);
  for(const s of [-1,1]){
    tf.box(s*1.6,.2,0,.36,.4,7,C.wood);tf.beam([s*1.6,.3,-2.3],[s*1.2,5.4,0],.3,C.wood,true);tf.beam([s*1.6,.3,2.3],[s*1.2,5.4,0],.3,C.wood,true);
    tf.beam([s*1.45,2.4,-1.3],[s*1.45,2.4,1.3],.2,C.oak);
  }
  for(const z of [-3,3])tf.box(0,.2,z,3.6,.35,.35,C.wood,false);
  tf.beam([-1.5,5.4,0],[1.5,5.4,0],.28,C.iron);tf.beam([0,3.95,1.25],[0,12.2,-2.2],.34,C.oak);
  tf.box(0,2.6,1.55,1.8,1.9,1.6,C.wood);for(const yy of [2,3.2])tf.box(0,yy,1.55,1.9,.14,1.7,C.iron,false);
  tf.beam([0,12.2,-2.2],[0,7.6,-2.9],.05,ROPE);{const q=tf.point(0,7.4,-2.9);blob(b,q.x,q.y,q.z,.4,.3,.4,C.oak,ICO1);}
  // Tents: two still pitched, one trampled flat. A cold fire with the last embers.
  for(const [x,z,a,color] of [[cx+10,cz+10,.3,C.white],[cx-2,cz+13,-.2,'#d8ceb2']] as const){const y=h(x,z);prismRoof(new Frame(cloth,x,y,z,a),4.6,5.6,0,3.1,color,C.blue);}
  {const x=cx+12,z=cz-14,y=h(x,z);plate(cloth,x,y+.45,z,.5,1.32,5,.07,5.2,'#d8ceb2');rod(b,[x-1.5,y+.1,z-1],[x+1.4,y+1.3,z+.6],.07,C.oak);}
  const fx=cx-6,fz=cz+6,fy=h(fx,fz);
  for(let k=0;k<8;k++){const t=k/8*Math.PI*2;blob(b,fx+Math.sin(t)*1.1,fy+.15,fz+Math.cos(t)*1.1,.32,.22,.3,k%2?C.stone:C.joint,ICO0,k);}
  rod(b,[fx-.7,fy+.12,fz-.3],[fx+.7,fy+.2,fz+.3],.11,C.char);rod(b,[fx-.3,fy+.12,fz+.7],[fx+.4,fy+.22,fz-.6],.1,C.char);
  for(const [x,z] of [[-.2,.1],[.3,-.2],[.05,.4]])glow.box(fx+x,fy+.2,fz+z,.16,.1,.16,EMBER,0,false);
  for(const t of [0,2.1,4.2])rod(b,[fx+Math.sin(t)*1,fy,fz+Math.cos(t)*1],[fx,fy+2.3,fz],.045,C.iron);
  blob(b,fx,fy+1.15,fz,.36,.32,.36,C.iron,ICO1);rod(b,[fx,fy+2.3,fz],[fx,fy+1.45,fz],.02,C.iron);
  // Siege shields left outside the breach, a weapon rack, crates and the town's banner over the gate.
  for(const [x,z,a] of [[cx-H-5,cz+6,Math.PI/2+.2],[cx-H-9,cz+11,Math.PI/2-.3]]){
    const y=h(x,z);plate(b,x,y+1.15,z,a,-.28,2.6,2.3,.14,C.oak,true);rod(b,[x+.3,y+1.9,z],[x+1.5,y+.05,z+.2],.07,C.wood);
    for(const yy of [.5,1.6])plate(b,x-.07,y+yy+.1,z,a,-.28,2.7,.16,.06,C.wood);
  }
  {const x=cx+13,z=cz+2,y=h(x,z);for(const o of [-1.2,1.2])b.box(x,y,z+o,.14,1.7,.14,C.wood);rod(b,[x,y+1.5,z-1.2],[x,y+1.5,z+1.2],.05,C.wood);
   for(let k=0;k<4;k++)rod(b,[x+.5,y+.05,z-.9+k*.6],[x-.1,y+2.3,z-.9+k*.6],.035,k%2?C.iron:C.oak);}
  for(const [k,[x,z,s]] of [[cx+3,cz-14,1.2],[cx+4.5,cz-14.4,.9],[cx+3.6,cz-12.8,.8]].entries()){const y=h(x,z);b.box(x,y,z,s,s*.8,s,k%2?C.wood:C.oak,.3*k);}
  {const x=cx+5.2,z=cz+H+.4,y=h(x,z);rod(b,[x,y-.3,z],[x,y+9.4,z],.11,C.oak,true);banner(new Frame(cloth,x,y,z,0),1.5,9,0,3.6);}
  anchors.gunner=[cx-10,h(cx-10,cz+13),cz+13];
}
