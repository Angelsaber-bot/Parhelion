/** Hand-built, period-inspired Moscow silhouettes. Visual-only: navigation proxies remain in build.ts. */
import * as THREE from 'three';
import { Batch, BOX, T } from '../geo.js';
import type { Piece } from '../structures.js';
const art = new Map<string,Batch>();
export const architectureManifest: { id:number; family:string; burnt:boolean; p:number[]; size:number[] }[]=[];
export function resetArchitecture(){art.clear();architectureManifest.length=0;}
export function architecturePieces():Piece[]{return [...art.values()].map(batch=>({name:batch.name,material:batch.material,batch,outline:true,userData:{winterArchitecture:true,...(batch.name==='Moscow_WinterTimber'?{architectureManifest}: {})}}));}
function visualBatch(source:Batch,color:string){
 let mat='M_WinterPlaster';
 if(color==='#e8eff4'||color==='#c5d6dd')mat='M_WinterSnow';
 else if(color==='#d9ad56')mat='M_WinterGold';
 else if(color==='#496f63'||color==='#657c71'||color==='#71816d')mat='M_WinterCopper';
 else if(['#a95343','#ac5849','#ad584a','#b05b47','#ba674f','#c98161','#955c4c'].includes(color))mat='M_WinterBrick';
 else if(['#e8ddc5','#f5eada','#c5b9a4','#c8bba5','#d2c3a8'].includes(color))mat='M_WinterStone';
 else if(['#c3ae8d','#d5bfa0','#c7d1ca','#bc9b87','#ded0b8','#998675'].includes(color))mat='M_WinterPlaster';
 else if(source.name==='Moscow')mat=['#383239','#322e31','#353038','#544641','#65504a','#463c3b'].includes(color)?'M_WinterCharredWood':'M_WinterTimber';
 const key=source.name+'_'+mat.slice(2);let b=art.get(key);if(!b){b=new Batch(key,mat);art.set(key,b);}return b;
}
const C={stone:'#e8ddc5',trim:'#f5eada',red:'#a95343',dark:'#383239',wood:'#80604b',snow:'#e8eff4',green:'#496f63',gold:'#d9ad56'};
const cyl = new THREE.CylinderGeometry(1,1,1,12);
const oct = new THREE.CylinderGeometry(1,1,1,8).rotateY(Math.PI/8);
const cone = new THREE.ConeGeometry(1,1,8);
function local(b:Batch,x:number,y:number,z:number,ry=0){
 const root=T(x,y,z,ry);
 return (g:THREE.BufferGeometry,c:string,px:number,py:number,pz:number,sx=1,sy=1,sz=1,a=0,rx=0,rz=0)=>visualBatch(b,c).add(g,c,root.clone().multiply(T(px,py,pz,a,sx,sy,sz,rx,rz)),false);
}
/** Solid arch voussoirs around a genuine empty opening; no dark painted substitute. */
function archGeo(r=1,t=.2,depth=.3){
 const s=new THREE.Shape(); s.absarc(0,0,r+t,0,Math.PI,false); s.lineTo(-r,0); s.absarc(0,0,r,Math.PI,0,true); s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:12});g.translate(0,0,-depth/2);return g;
}
const arch=archGeo();
function gableGeo(){const s=new THREE.Shape();s.moveTo(-1,0);s.lineTo(1,0);s.lineTo(0,1);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:.06,bevelEnabled:false});g.translate(0,0,-.03);return g;}
const gable=gableGeo();
function roof(add:ReturnType<typeof local>,w:number,d:number,h:number,rise:number,col:string,hip=false){
 const a=Math.atan2(rise,w/2),sl=Math.hypot(w/2+.35,rise);
 if(hip){add(new THREE.CylinderGeometry(0,1,1,4,1,false,Math.PI/4),col,0,h+rise/2,0,(w+.7)/Math.SQRT2,rise,(d+.7)/Math.SQRT2);add(new THREE.CylinderGeometry(0,1,1,4,1,true,Math.PI/4),C.snow,0,h+rise*.53+.07,0,(w+.5)/Math.SQRT2,rise*.94,(d+.5)/Math.SQRT2);}
 else{
 for(const s of [-1,1]){add(BOX,col,s*w/4,h+rise/2,0,sl,.19,d+.7,0,0,-s*a);add(BOX,C.snow,s*w/4,h+rise/2+.13,0,sl*.94,.09,(d+.7)*.95,0,0,-s*a);}
 for(const s of [-1,1])add(gable,col,0,h,s*d/2,w/2,rise,1);
 }
 if(!hip)add(BOX,'#c5d6dd',0,h+rise+.14,0,.17,.13,d+.75);
}
function window(add:ReturnType<typeof local>,x:number,y:number,z:number,w=.85,h=1.25,wood=false){
 add(BOX,'#343e48',x,y,z,w,h,.10);add(BOX,wood?'#bad1ce':C.trim,x-w/2-.075,y,z+.04,.12,h+.24,.13);add(BOX,wood?'#bad1ce':C.trim,x+w/2+.075,y,z+.04,.12,h+.24,.13);
 for(const s of [-1,1])add(BOX,C.trim,x,y+s*(h/2+.065),z+.06,w+.29,.12,.18);
 add(BOX,C.trim,x,y,z+.09,.065,h,.08);add(BOX,C.trim,x,y+.12,z+.09,w,.065,.08);
 add(BOX,'#899b9f',x-w*.2,y+h*.22,z+.065,w*.31,h*.3,.03);
}
export function winterHouse(b:Batch,x:number,y:number,z:number,ry:number,w:number,d:number,h:number,burnt:boolean,id:number){
 const a=local(b,x,y,z,ry),family=id%5;
 architectureManifest.push({id,family:['timber_izba','merchant_classical','service_courtyard','shop_front','warehouse'][family],burnt,p:[x,y,z],size:[w,h,d]});
 const masonry=['#c3ae8d','#d5bfa0','#c7d1ca','#bc9b87'][id%4];
 a(BOX,'#786d65',0,.25,0,w+.25,.5,d+.25);
 if(burnt && (family===0||family===4)){
  // Uneven surviving wall panels, exposed vertical posts and pairs of pitched rafters.
  a(BOX,'#544641',0,.9,0,w,1.3,d);
  for(const s of [-1,1]){a(BOX,'#65504a',s*(w/2-.16),h*.55,0,.32,h*.9,d);for(const t of [-1,1])a(BOX,'#322e31',s*(w/2-.13),h/2,t*(d/2-.14),.24,h,.24);}
  for(let k=0;k<3;k++){let zz=-d*.38+k*d*.38;for(const s of [-1,1])a(BOX,C.dark,s*w/4,h+.65,zz,Math.hypot(w/2,1.3),.17,.16,0,0,-s*Math.atan2(1.3,w/2));}
  a(BOX,'#955c4c',w*.27,h*.65,-d*.25,.72,h*1.3,.8);a(BOX,'#353038',w*.27,h*1.3+.06,-d*.25,.87,.18,.91);
  for(let k=0;k<6;k++)a(BOX,k%2?'#463c3b':'#77645a',-w*.35+k*w*.13,.18,Math.sin(k*2)*d*.3,1.4,.2,.3,k*.7);
  a(BOX,C.snow,0,1.57,d*.35,w*.6,.08,d*.2);
  return;
 }
 if(family===2){
  // Enclosed service court: two narrow wings and a rear store, not a recoloured house.
  // Closed timber gate keeps the legacy solid navigation footprint honest.
  for(const side of [-1,1]){
   const xx=side*w*.39;a(BOX,masonry,xx,h*.44,0,w*.22,h*.88,d);
   a(BOX,C.trim,xx,h*.86,0,w*.25,.17,d+.15);
   const wing=local(b,x+Math.cos(ry)*xx,y,z-Math.sin(ry)*xx,ry);
   roof(wing,w*.22,d,h*.88,.65,C.green);
  }
  a(BOX,masonry,0,h*.45,-d*.36,w*.58,h*.9,d*.28);
  a(BOX,C.green,0,h*.92,-d*.36,w*.62,.18,d*.32);
  a(BOX,C.snow,0,h*.92+.12,-d*.36,w*.59,.07,d*.29);
  for(let k=0;k<9;k++)a(BOX,k%2?'#80604b':'#927257',-w*.46+k*w*.115,1.05,d/2+.01,w*.108,2.1,.13);
  for(const yy of [.45,1.6])a(BOX,'#514b42',0,yy,d/2+.1,w*.97,.1,.11);
  a(BOX,'#514b42',0,1.1,d/2+.13,.12,2.2,.13);
  a(BOX,C.trim,0,2.22,d/2+.04,w+.2,.18,.28);
  for(const xx of [-w*.36,w*.36])a(BOX,'#b9b0a0',xx,h*.45,d/2+.08,.24,h*.9,.2);
  a(cyl,'#80604b',0,.5,0,.45,1,.45);a(BOX,'#ad9371',w*.16,.3,-d*.2,.85,.6,.8);
  const side=local(b,x,y,z,ry+Math.PI/2);window(side,0,h*.5,w/2+.06,.72,1.1);
  return;
 }
 if(family===4){
  a(BOX,'#a88b6b',0,h/2,0,w,h,d);
  for(let k=0;k<12;k++)a(BOX,k%3?'#94775d':'#b09570',-w*.46+k*w*.084,h/2,d/2+.03,.075,h,.06);
  a(BOX,'#665440',0,h*.38,d/2+.08,w*.6,h*.74,.13);
  for(const xx of [-w*.3,0,w*.3])a(BOX,'#403d3a',xx,h*.38,d/2+.16,.11,h*.76,.08);
  for(const yy of [.55,h*.62])a(BOX,'#403d3a',0,yy,d/2+.16,w*.6,.09,.09);
  roof(a,w,d,h,2.2,'#605f5b');a(BOX,C.trim,0,h-.1,d/2+.1,w+.15,.2,.2);
  a(BOX,'#413f3e',0,h+.65,d/2+.04,.85,.8,.08);a(BOX,'#a99676',0,h+.21,d/2+.16,1,.14,.24);
  for(const side of [-1,1])a(BOX,'#c7b798',side*w*.45,h/2,d/2+.07,.18,h,.18);
  return;
 }
 const timber=family===0,service=false,shop=family===3;
 a(BOX,timber?'#8a6650':masonry,0,h/2,0,w,h,d);
 if(timber){for(let k=0;k<Math.ceil(h/.32);k++)for(const s of [-1,1]){a(BOX,k%3===0?'#6c4e3e':'#a17a5a',0,.25+k*.32,s*d/2,w+.25,.22,.14);a(BOX,'#634e42',s*w/2,.25+k*.32,0,.16,.22,d+.25);}}
 else{for(const s of [-1,1]){a(BOX,C.trim,s*(w/2-.2),h/2,d/2+.05,.28,h,.14);for(let j=0;j<h/.55;j++)a(BOX,'#ded0b8',s*(w/2-.21),j*.55+.25,d/2+.14,.47,.24,.11);}a(BOX,C.trim,0,h-.14,0,w+.35,.23,d+.33);a(BOX,'#998675',0,.57,0,w+.12,.17,d+.12);}
 const front=d/2+.08;
 if(shop){
  a(BOX,'#46423d',0,1.35,front,w*.76,1.9,.1);
  for(let k=-1;k<=1;k++)a(BOX,'#97754e',k*w*.28,1.35,front+.12,.13,2.1,.17);
  a(BOX,'#88624a',0,2.65,front+.15,w*.85,.36,.18);
  for(let k=0;k<6;k++)a(BOX,k%2?'#c5bb9e':'#637d77',-w*.37+k*w*.148,2.3,front+.55,w*.148,.09,1.1,0,.13);
  a(BOX,'#715744',0,.7,front+.6,w*.75,.65,.7);
 }else{
  for(const s of [-1,1])window(a,s*w*.27,h*.58,front,.8,h*.36,timber);
  a(BOX,'#544a42',0,1.05,front,.97,2,.12);a(BOX,C.trim,0,2.12,front+.06,1.19,.15,.2);a(BOX,'#b29c6c',.32,1.12,front+.11,.08,.08,.05);
 }
 // Side elevations, not blank boxes.
 const side=local(b,x,y,z,ry+Math.PI/2);window(side,0,h*.58,w/2+.08,.9,h*.34,timber);
 roof(a,w,d,h,service?1.1:1.8,burnt?'#585052':(timber?'#605f5b':C.green),family===1);
 if(family===1){a(gable,C.trim,0,h+.12,front+.1,w*.28,1.1,1);a(BOX,C.trim,0,h+.08,front+.12,w*.62,.2,.3);}
 if(service){a(BOX,'#766452',w*.27,h+.58,-d*.28,.8,1.7,.8);a(BOX,C.trim,w*.27,h+1.42,-d*.28,1,.18,1);}
 else{a(BOX,'#9c7763',-w*.28,h+1.1,-d*.2,.65,1.6,.7);a(BOX,'#c5bba6',-w*.28,h+1.9,-d*.2,.83,.16,.88);}
 if(burnt){for(let k=0;k<4;k++)a(BOX,'#71645e',-w*.35+k*w*.21,h*.72,front+.09,.19,h*.46,.025);}
}

/** Ribbed/twisted onion surfaces, generated as coloured panels rather than stacked spheres. */
function onionSurface(variant:number){
 const g=new THREE.BufferGeometry(),p:number[]=[],cols:number[]=[];
 const palette=[['#b44a3f','#e3b36c'],['#4c8468','#d5bd73'],['#4d7695','#d8e2d9'],['#d4a447','#e6c77c'],['#b85f43','#f0d39e'],['#7d677c','#cba991'],['#458880','#b6c6a6'],['#ab6566','#ead5b6']][variant%8];
 const n=32,levels=18; const point=(j:number,k:number)=>{const t=j/levels,ang=k/n*Math.PI*2;const shoulder=.29+(variant%3)*.045;const base=t<shoulder?.62+.47*Math.sin(t/shoulder*Math.PI/2):1.09*Math.pow(Math.cos((t-shoulder)/(1-shoulder)*Math.PI/2),1.1+(variant%4)*.17);const rib=1+(.035+(variant%3)*.018)*Math.cos(ang*(variant%2?8:12)+t*(variant%3===0?9:0));return [Math.cos(ang)*base*rib,t*(1.95+(variant%3)*.15),Math.sin(ang)*base*rib];};
 for(let j=0;j<levels;j++)for(let k=0;k<n;k++){
 const vs=[point(j,k),point(j+1,k),point(j+1,k+1),point(j,k),point(j+1,k+1),point(j,k+1)];
 const stripe=(Math.floor(k/2+(variant%3===0?j*.32:0))%2),cc=new THREE.Color(palette[stripe]);for(const v of vs){p.push(...v);cols.push(cc.r,cc.g,cc.b);}
 }g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.computeVertexNormals();return g;
}
const onions=Array.from({length:8},(_,i)=>onionSurface(i));
// Batch.add applies a uniform color; preserve hand-painted alternating dome panels here.
function patterned(b:Batch,g:THREE.BufferGeometry,m:THREE.Matrix4){const copy=g.clone();copy.applyMatrix4(m);visualBatch(b,'#496f63').vis.push(copy);}
export function detailedDome(b:Batch,x:number,y:number,z:number,r:number,drumH:number,variant:number,gold=false){
 const a=local(b,x,y,z),dr=.72*r;
 a(cyl,C.stone,0,drumH/2,0,dr,drumH,dr);
 for(let k=0;k<8;k++){let ang=k*Math.PI/4; const face=local(b,x+Math.sin(ang)*dr,y,z+Math.cos(ang)*dr,ang);face(BOX,'#485054',0,drumH*.55,0,r*.26,drumH*.48,.06);face(arch,C.trim,0,drumH*.79,.025,r*.14,r*.14,1);}
 for(const yy of [.13,drumH-.1])a(cyl,C.trim,0,yy,0,dr+.15,.2,dr+.15);
 if(gold){const g=onions[3].clone();g.deleteAttribute('color');a(g,C.gold,0,drumH,0,r,r,r);}else patterned(b,onions[variant%8],T(x,y+drumH,z,0,r,r,r));
 a(cyl,C.gold,0,drumH+r*2.42,0,.045,r*.66,.045);a(BOX,C.gold,0,drumH+r*2.51,0,r*.43,.07,.07);a(BOX,C.gold,0,drumH+r*2.37,0,r*.3,.06,.06,0,0,-.25);
}
export function basilCathedral(b:Batch,x:number,y:number,z:number){
 const a=local(b,x,y,z);
 a(BOX,'#ac5849',0,1.2,-2,26,2.4,22);a(BOX,C.trim,0,2.42,-2,26.4,.2,22.4);
 // Low connecting gallery has masonry piers, arches and inset tympana.
 for(const s of [-1,1])for(let k=-4;k<=4;k++){
  const xx=k*2.7;a(BOX,'#ad584a',xx,3.65,s*9,.42,2.5,.55);a(arch,C.trim,xx+1.35,4.1,s*9,1.08,.85,1.8);
 }
 a(oct,'#b05b47',0,10.5,0,4.7,16.2,4.7);
 for(let k=0;k<8;k++){const ang=k*Math.PI/4,fa=local(b,x+Math.sin(ang)*4.45,y,z+Math.cos(ang)*4.45,ang);fa(BOX,C.trim,0,11.2,0,.27,13,.19);fa(arch,C.trim,0,17,.1,1.65,1.8,1);}
 a(oct,C.trim,0,18.5,0,4.9,.5,4.9);
 a(cone,'#71816d',0,23.2,0,3.8,9.2,3.8);
 for(let k=0;k<8;k++){let ang=k*Math.PI/4;const f=local(b,x,y,z,ang);f(BOX,C.trim,0,23.1,1.9,.16,9.8,.16,0,-.39);}
 detailedDome(b,x,y+27.5,z,1.1,1,3,true);
 for(let k=0;k<8;k++){
  let ang=k*Math.PI/4,r=k%2?9:10.5,xx=x+Math.cos(ang)*r,zz=z+Math.sin(ang)*r,h=k%2?10:13;
  const t=local(b,xx,y,zz);t(oct,k%2?'#ba674f':'#c98161',0,(h+2.4)/2,0,2.6,h-2.4,2.6);
  for(let j=0;j<8;j++){let aa=j*Math.PI/4;const f=local(b,xx+Math.sin(aa)*2.47,y,zz+Math.cos(aa)*2.47,aa);f(BOX,C.trim,0,h*.6,0,.17,h*.65,.14);f(arch,C.trim,0,h-.85,.05,.79,.9,1);}
  for(let yy=h-1.6;yy<h+.1;yy+=.7)t(oct,yy<h-1?'#e4d3b0':C.trim,0,yy,0,2.77,.2,2.77);
  detailedDome(b,xx,y+h,zz,k%2?2:2.5,1.2,k);
 }
 // Stairs and open entrance porch face the existing square without obstructing the core.
 for(let k=0;k<5;k++)a(BOX,'#c5b9a4',0,.16+k*.27,11.5-k*.45,5,.32,3.1-k*.35);
 for(const s of [-1,1])a(BOX,C.trim,s*2,3.4,10.7,.43,2.1,.43);
 a(arch,C.trim,0,4.1,10.7,1.8,1.35,1.4);
}

export function cathedral(b:Batch,x:number,y:number,z:number,w:number,d:number,gold:boolean){
 const a=local(b,x,y,z);a(BOX,C.stone,0,5.5,0,w,11,d);a(BOX,'#c8bba5',0,.5,0,w+.4,1,d+.4);
 for(const side of [-1,1])for(let k=-2;k<=2;k++){
  const xx=k*w*.19;a(BOX,C.trim,xx,5.6,side*(d/2+.08),.28,10.4,.2);a(arch,C.trim,xx,10.1,side*(d/2+.12),w*.09,1.1,1.4);
  if(k!==0){a(BOX,'#505457',xx,6.4,side*(d/2+.025),.65,2.5,.07);a(arch,'#b4a68f',xx,7.65,side*(d/2+.09),.34,.45,1);}
 }
 // Side nave arcading and narrow slit windows keep every approach articulated.
 for(const side of [-1,1]){
  const f=local(b,x,y,z,side*Math.PI/2);
  for(let k=-2;k<=2;k++){
   const u=k*d*.18;f(BOX,C.trim,u,5.6,w/2+.08,.25,10.5,.2);
   f(arch,C.trim,u,10.1,w/2+.12,d*.085,1.1,1.4);
   if(k!==0){f(BOX,'#505457',u,6.4,w/2+.03,.6,2.3,.08);f(arch,'#b4a68f',u,7.55,w/2+.1,.32,.45,1);}
  }
 }
 a(BOX,'#657c71',0,11.15,0,w+.15,.3,d+.2);
 for(const side of [-1,1])for(let k=-2;k<=2;k++)a(arch,C.stone,k*w*.19,10.2,side*d/2,w*.09,1.4,1.6);
 detailedDome(b,x,y+11.8,z,2.6,4,3,gold);
 for(const sx of [-1,1])for(const sz of [-1,1])detailedDome(b,x+sx*(w/2-3),y+11.8,z+sz*(d/2-3),1.6,2.6,gold?3:2,gold);
 a(BOX,'#514a40',0,1.9,d/2+.05,1.8,3.8,.1);a(arch,C.trim,0,3.8,d/2+.14,1,1,2);
}

export function ivanTower(b:Batch,x:number,y:number,z:number){
 const a=local(b,x,y,z);
 // Lower enclosed masonry tiers retain the silhouette; upper belfries are physically open arcades.
 const tiers:[[number,number],[number,number],[number,number],[number,number]]=[[6.5,12],[5.5,10],[4.5,8],[3.6,7]];
 let base=0;
 for(let i=0;i<tiers.length;i++){
  const [r,h]=tiers[i];
  if(i<2)a(oct,C.stone,0,base+h/2,0,r,h,r);
  else{
   a(oct,C.stone,0,base+.4,0,r,.8,r);a(oct,C.stone,0,base+h-.65,0,r,1.3,r);
   for(let k=0;k<8;k++){
    const ang=k*Math.PI/4,face=local(b,x+Math.sin(ang)*r*.91,y+base,z+Math.cos(ang)*r*.91,ang);
    for(const s of [-1,1])face(BOX,C.trim,s*r*.31,(h-1.65)/2,0,r*.18,h-2.75,.6);
    face(arch,C.trim,0,h-2.2,0,r*.26,r*.34,2);
   }
  }
  for(let k=0;k<8;k++){
   const ang=k*Math.PI/4,face=local(b,x+Math.sin(ang)*r*.93,y+base,z+Math.cos(ang)*r*.93,ang);
   if(i<2){face(BOX,'#454e52',0,h*.59,.04,1.15,h*.31,.08);face(arch,C.trim,0,h*.745,.1,.62,.84,1);for(const s of [-1,1])face(BOX,C.trim,s*.81,h*.59,.1,.17,h*.36,.18);}
   face(BOX,'#d2c3a8',0,h-.8,.02,r*.65,.25,.18);
  }
  for(const [yy,rad,hh] of [[base+h-.2,r+.3,.45],[base+h+.16,r+.15,.16]] as number[][])a(oct,C.trim,0,yy,0,rad,hh,rad);
  base+=h;
 }
 detailedDome(b,x,y+base,z,3,2.5,3,true);
 // Legible bronze hanging bell in the third-tier opening, not a painted window.
 a(new THREE.CylinderGeometry(.75,1.45,1.9,16,1,true),'#92734c',0,33.2,1.8);a(cyl,'#b79761',0,32.25,1.8,1.5,.15,1.5);a(cyl,'#615748',0,31.9,1.8,.11,1.1,.11);
}

const merlon=(()=>{const s=new THREE.Shape();s.moveTo(-.65,0);s.lineTo(.65,0);s.lineTo(.65,1.25);s.lineTo(.27,1.25);s.lineTo(0,.8);s.lineTo(-.27,1.25);s.lineTo(-.65,1.25);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:1.65,bevelEnabled:false});g.translate(0,0,-.825);return g;})();
export function kremlinFortifications(b:Batch,kx:number,y:number,kz:number,R:number,heightAt:(x:number,z:number)=>number){
 const gates=[Math.PI/2,0],near=(a:number,g:number,w:number)=>Math.abs(Math.atan2(Math.sin(a-g),Math.cos(a-g)))<w;
 for(let k=0;k<16;k++){
  const a0=k/16*Math.PI*2,a1=(k+1)/16*Math.PI*2,p0=[kx+Math.cos(a0)*R,kz+Math.sin(a0)*R],p1=[kx+Math.cos(a1)*R,kz+Math.sin(a1)*R];
  const len=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]),ry=Math.atan2(p1[0]-p0[0],p1[1]-p0[1]),n=Math.ceil(len/4);
  for(let i=0;i<n;i++){
   const t=(i+.5)/n,x=p0[0]+(p1[0]-p0[0])*t,z=p0[1]+(p1[1]-p0[1])*t,ang=Math.atan2(z-kz,x-kx);if(gates.some(g=>near(ang,g,.075)))continue;
   const a=local(b,x,y,z,ry+Math.PI/2),ground=Math.min(y,heightAt(x,z))-y-2;
   a(BOX,'#c7b7a0',0,(ground+8)/2,0,len/n+.3,8-ground,2.4);
   a(BOX,'#a57561',0,.18,1.22,len/n*.7,.32,.06);
   a(BOX,'#ce9a7f',0,.8,0,len/n+.4,.22,2.6);a(BOX,'#ce9a7f',0,7.5,0,len/n+.45,.22,2.65);
   for(const s of [-1,1]){
    for(let yy=1.6;yy<7;yy+=.68)a(BOX,'#b66b55',0,yy,s*1.211,len/n,.035,.025);
    a(arch,'#c17c65',0,5.2,s*1.22,1.35,1.5,1.3);
    for(const u of [-1,1])a(BOX,'#b56a53',u*1.48,2.55,s*1.3,.38,5.1,.28);
   }
   for(const xx of [-1,1]){a(merlon,'#c7b7a0',xx,8,0,1,1,1);a(BOX,C.snow,xx,9.28,-.28,1.2,.07,.9);}
  }
  if(k%2===0&&!gates.some(g=>near(a0,g,.2))){
   const a=local(b,p0[0],y,p0[1],a0);a(BOX,'#c7b7a0',0,6,0,6,16,6);
   for(const yy of [1,9,12])a(BOX,'#d6b49a',0,yy,0,6.4,.3,6.4);
   for(let side=0;side<4;side++){
    const f=local(b,p0[0],y,p0[1],a0+side*Math.PI/2);f(BOX,'#484244',0,10.5,3.04,.8,2.3,.06);f(arch,C.trim,0,11.65,3.08,.45,.6,1);for(const u of [-1,1])f(BOX,C.trim,u*2.4,12.2,3.1,.25,2.5,.2);
   }
   a(oct,C.stone,0,14.6,0,2.4,2.2,2.4);a(cone,C.green,0,19.4,0,4.3,7,4.3);a(cyl,C.gold,0,24,0,.07,2,.07);
  }
 }
 for(const g of gates){
  const x=kx+Math.cos(g)*R,z=kz+Math.sin(g)*R,spass=g===0,H=spass?26:18,a=local(b,x,y,z,Math.PI/2-g);
  // Door opening follows the original broad arch clearance and gateway footprint.
  for(const s of [-1,1])a(BOX,'#c7b7a0',s*4.2,(H-8)/2,0,3.6,H-4,6);
  a(BOX,'#c7b7a0',0,H-3,0,12,6,6);
  for(const side of [-1,1]){
   a(arch,C.trim,0,H-6,side*3.07,2.35,2.2,2);
   for(const s of [-1,1])a(BOX,C.trim,s*2.55,(H-6)/2,side*3.11,.3,H-6,.3);
   for(const yy of [H-6,H-.1])a(BOX,C.trim,0,yy,side*3.08,12.4,.26,.28);
   for(let k=-3;k<=3;k++){a(arch,C.trim,k*1.65,H-1.5,side*3.13,.56,.8,.8);a(BOX,C.trim,k*1.65,H-2.25,side*3.14,.12,1.5,.2);}
  }
  a(oct,'#c7b7a0',0,H+1.35,0,3.8,2.7,3.8);a(oct,C.trim,0,H+2.75,0,4.0,.25,4);
  a(cone,C.green,0,H+6.6,0,4.8,8,4.8);
  if(spass){
   for(const side of [-1,1]){
    const f=local(b,x,y,z,Math.PI/2-g+(side===-1?Math.PI:0));
    f(cyl,C.gold,0,H-3,3.13,1.62,.13,1.62,0,Math.PI/2);f(cyl,'#35444c',0,H-3,3.22,1.42,.08,1.42,0,Math.PI/2);
    for(let k=0;k<12;k++){let aa=k*Math.PI/6;f(BOX,C.gold,Math.sin(aa)*1.18,H-3+Math.cos(aa)*1.18,3.28,.065,.19,.04,0,0,-aa);}
    f(BOX,C.gold,0,H-2.65,3.3,.08,.8,.04,0,0,-.25);f(BOX,C.gold,.3,H-3,3.31,.7,.07,.04,0,0,.1);
   }
   a(oct,C.trim,0,H+10.3,0,1.4,2.7,1.4);a(cone,C.green,0,H+13,0,2,4.5,2);
   // Imperial double-headed eagle silhouette, never a Soviet star.
   a(cyl,C.gold,0,H+16,0,.06,1.6,.06);a(BOX,C.gold,0,H+16.8,0,.3,.5,.12);
   for(const s of [-1,1]){a(BOX,C.gold,s*.39,H+16.9,0,.65,.18,.12,0,0,s*.32);a(oct,C.gold,s*.17,H+17.15,0,.13,.2,.12);}
  }else a(cyl,C.gold,0,H+11.5,0,.06,2,.06);
 }
}
export function oldPalace(b:Batch,x:number,y:number,z:number){
 const a=local(b,x,y,z);a(BOX,'#d0bea0',0,6,0,14,12,22);a(BOX,C.trim,0,.5,0,14.3,1,22.3);
 for(let k=-2;k<=2;k++)for(const yy of [3.1,7.4])window(a,k*2.35,yy,11.08,1.1,2);
 for(const s of [-1,1])for(let k=-3;k<=3;k++){let f=local(b,x,y,z,s*Math.PI/2);window(f,k*2.6,7.4,7.08,1.1,2);}
 a(BOX,C.trim,0,10.9,0,14.4,.45,22.4);roof(a,14,22,12,2.6,C.green);a(gable,C.trim,0,12.15,11.2,3.6,2,1);
}

export function bellScaffoldDetail(b:Batch,x:number,y:number,z:number){
 const a=local(b,x,y,z);
 for(let k=0;k<10;k++){
  const dir=k%2===0?1:-1,zz=8+(k%2)*2.6;
  for(let j=0;j<17;j++){
   const xx=-5+(j+.5)*10/17,yy=k*3+1.5+xx*.3*dir;
   a(BOX,j%3?'#907453':'#ac8b61',xx,yy+.17,zz,10/17-.025,.08,2.16);
  }
 }
 for(let k=1;k<=10;k++){
  const xx=(k%2===1?1:-1)*6.2;
  for(let j=0;j<8;j++)a(BOX,j%3?'#907453':'#ac8b61',xx,k*3-.15,6.8+(j+.5)*5/8,2.4,.3,5/8-.025);
 }
 for(let j=0;j<20;j++)a(BOX,j%3?'#907453':'#ac8b61',-5+(j+.5)*.5,29.85,8,.475,.3,2.4);
 for(const side of [-1,1])for(let k=0;k<5;k++){
  const xx=side*7.4,yy=k*6+3;
  a(BOX,'#725940',xx,yy,9.3,.12,Math.hypot(6,5),.12,0,Math.atan2(5,6));
  a(BOX,'#725940',xx,yy,9.3,.12,Math.hypot(6,5),.12,0,-Math.atan2(5,6));
 }
}

/** Low-relief laid paving and wind-packed gaps give the square an urban material scale. */
export function squarePaving(b:Batch,x:number,y:number,z:number,w:number,d:number){
 const a=local(b,x,y,z);
 for(let row=0;row<Math.floor(d/.9);row++)for(let col=0;col<Math.floor(w/1.3);col++){
  const hash=(row*37+col*19+row*col*3)%23;
  if(hash<4)continue;
  const xx=-w/2+.65+col*1.3+(row%2)*.32,zz=-d/2+.45+row*.9;
  if(xx>w/2-.5)continue;
  a(BOX,['#9b9b94','#a6a59c','#b4b3a7','#a19e95'][hash%4],xx,.025,zz,1.25,.045,.85);
  if(hash===5||hash===8)a(BOX,'#c5d6dd',xx,.053,zz,1.08,.012,.71);
 }
}
