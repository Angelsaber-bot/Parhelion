/** Sunset Kingdom authored visual craft. No function in this file emits collision. */
import * as THREE from 'three';
import { Batch, BOX, T } from '../geo.js';
import type { Piece } from '../structures.js';

type Surface = 'Limestone'|'Sandstone'|'Oak'|'Slate'|'Thatch'|'Plaster'|'Wool'|'Iron'|'Bronze'|'CharredWood';
const CYL = new THREE.CylinderGeometry(1,1,1,12);
const C = { stone:'#d9cdb4', joint:'#9d947e', pale:'#eee3c9', sand:'#c1a27a', oak:'#67503c', end:'#997958', slate:'#52677c', straw:'#bca171', plaster:'#e7ddc6', blue:'#3b5d94', wine:'#8a4b48', iron:'#424e59', bronze:'#b99a5c', ash:'#51463e', dark:'#32414b' };

/** Each landmark has its own material batches; original collider owner remains untouched. */
export class KingdomCraft {
  private batches = new Map<string,Batch>();
  add(name:string,s:Surface,g:THREE.BufferGeometry,c:string,m:THREE.Matrix4) {
    const key=`${name}_${s}`;
    if(!this.batches.has(key)) this.batches.set(key,new Batch(`Britain_Craft_${key}`,`M_Britain${s}`));
    this.batches.get(key)!.add(g,c,m,false);
  }
  frame(name:string,x:number,y:number,z:number,a=0) { return new Frame(this,name,x,y,z,a); }
  pieces():Piece[] { return [...this.batches.values()].map(batch=>({name:batch.name,material:batch.material,batch,outline:true})); }
}
export class Frame {
  constructor(public craft:KingdomCraft,public name:string,public x:number,public y:number,public z:number,public a=0){}
  point(x:number,y:number,z:number) {return new THREE.Vector3(this.x+Math.cos(this.a)*x+Math.sin(this.a)*z,this.y+y,this.z-Math.sin(this.a)*x+Math.cos(this.a)*z);}
  box(x:number,y:number,z:number,w:number,h:number,d:number,s:Surface,c:string,rx=0,rz=0,a=0) {const p=this.point(x,y,z);this.craft.add(this.name,s,BOX,c,T(p.x,p.y,p.z,this.a+a,w,h,d,rx,rz));}
  cyl(x:number,y:number,z:number,r:number,h:number,s:Surface,c:string,segments=12) {const p=this.point(x,y,z);this.craft.add(this.name,s,segments===12?CYL:new THREE.CylinderGeometry(1,1,1,segments),c,T(p.x,p.y,p.z,this.a,r,h,r));}
  beam(p:number[],q:number[],w:number,s:Surface,c:string,d=w) {
    const a=this.point(p[0],p[1],p[2]),b=this.point(q[0],q[1],q[2]);
    const m=new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()),new THREE.Vector3(w,a.distanceTo(b),d));
    this.craft.add(this.name,s,BOX,c,m);
  }
  ring(x:number,y:number,z:number,r:number,t:number,s:Surface,c:string,vertical=false,segments=32) {const p=this.point(x,y,z);this.craft.add(this.name,s,new THREE.TorusGeometry(r,t,4,segments),c,T(p.x,p.y,p.z,this.a,1,1,1,vertical?0:Math.PI/2));}
  mesh(v:number[],idx:number[],s:Surface,c:string) {const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);this.craft.add(this.name,s,g,c,T(this.x,this.y,this.z,this.a));g.dispose();}
}

function lancet(f:Frame,x:number,y:number,z:number,w:number,h:number,s:Surface='Limestone') {
  const peak=h*.24, bottom=y-h/2, shoulder=y+h/2-peak;
  f.mesh([x-w/2,bottom,z,x+w/2,bottom,z,x+w/2,shoulder,z,x,y+h/2,z,x-w/2,shoulder,z],[0,1,2,0,2,3,0,3,4],'Iron',C.dark);
  const v=[[x-w/2,bottom,z+.03],[x-w/2,shoulder,z+.03],[x,y+h/2,z+.03],[x+w/2,shoulder,z+.03],[x+w/2,bottom,z+.03]];
  for(let i=0;i<4;i++) f.beam(v[i],v[i+1],.12,s,C.pale);
  f.box(x,bottom,z+.035,w+.23,.13,.15,s,C.sand);
  f.beam([x,bottom,z+.055],[x,y+h/2-.08,z+.055],.055,'Iron',C.iron);
}
function door(f:Frame,x:number,z:number,h=2.1,w=1.1) {
  f.box(x,h/2,z,w,h,.075,'Oak',C.oak);
  for(let i=1;i<5;i++)f.box(x-w/2+w*i/5,h/2,z+.043,.018,h-.06,.025,'Oak',C.end);
  for(const y of [.35,h-.4])f.box(x,y,z+.07,w*.85,.065,.055,'Iron',C.iron);
  f.ring(x+w*.27,h*.47,z+.12,.075,.018,'Bronze',C.bronze,true,10);
}
function gableRoof(f:Frame,w:number,d:number,e:number,rise:number,s:Surface,color:string,kind=0) {
  // Ridge runs in local Z, unlike Nassau's broad horizontal Caribbean roofs.
  const W=w/2+.38,D=d/2+.4,roofRise=rise;
  for(const side of [-1,1]) {
    const slope=Math.atan2(roofRise,W),L=Math.hypot(W,roofRise);
    f.box(side*W/2,e+roofRise/2,0,L,.16,d+.8,s,color,0,-side*slope);
    for(let j=1;j<=5;j++) {
      const t=j/6,xx=side*W*(1-t),yy=e+roofRise*t+.09;
      f.box(xx,yy,0,.09,.055,d+.83,s,j%2?color:C.slate,0,-side*slope);
    }
  }
  for(const sign of [-1,1]) {
    f.mesh([-w/2,e,sign*d/2,w/2,e,sign*d/2,0,e+roofRise,sign*d/2],sign>0?[0,1,2]:[0,2,1],'Plaster',C.plaster);
    f.beam([-W,e,sign*D],[0,e+roofRise,sign*D],.2,'Oak',C.oak);
    f.beam([0,e+roofRise,sign*D],[W,e,sign*D],.2,'Oak',C.oak);
    f.box(0,e+roofRise/2,sign*(d/2+.04),.12,roofRise,.12,'Oak',C.oak);
  }
  f.box(0,e+roofRise+.09,0,.22,.2,d+.95,s,color);
  for(const side of [-1,1])f.box(side*W,e-.02,0,.16,.23,d+.95,'Oak',C.oak);
  if(kind===3||kind===6) { // finite, capped stone chimney, not borrowed modern stack silhouette
    const xx=w*.27,zz=-d*.2,top=e+rise+.8;
    f.box(xx,(e+top)/2,zz,.65,top-e,.62,'Sandstone',C.sand);
    f.box(xx,top,zz,.85,.22,.82,'Sandstone',C.pale);
    f.box(xx,top+.13,zz,.4,.035,.38,'Iron',C.dark);
  }
}

/** Eight deliberately different street-front families; deterministic, no gameplay RNG consumed. */
export function townHouse(c:KingdomCraft,x:number,y:number,z:number,a:number,w:number,d:number,h:number,i:number) {
  const family=i%8, f=c.frame(`Town_F${family}`,x,y,z,a);
  const plaster=[C.plaster,'#dfd3bc','#cbbd9c','#e5d6b6','#d9d8c2','#c6c9b3','#d8c5ac','#e7d7ba'][family];
  f.box(0,h/2,0,w,h,d,'Plaster',plaster);
  f.box(0,.18,0,w+.09,.36,d+.1,'Limestone',C.stone);
  const rise=family===2?1.25:family===5?2.3:1.75;
  gableRoof(f,w,d,h,rise,family===2?'Thatch':'Slate',family===2?C.straw:family===4?'#687b82':C.slate,family);
  for(const side of [-1,1])for(const depth of [-1,1]) f.box(side*(w/2-.08),h/2,depth*(d/2+.035),.19,h,.16,'Oak',C.oak);
  for(const level of [.45,h-.08])f.box(0,level,d/2+.07,w,.17,.15,'Oak',C.oak);
  if(h>4)f.box(0,h*.53,d/2+.1,w+.12,.2,.22,'Oak',C.oak);
  if(family===0||family===4||family===7) for(const s of [-1,1])f.beam([s*(w/2-.25),.6,d/2+.1],[s*.65,h-.3,d/2+.1],.13,'Oak',C.oak);
  else for(const s of [-1,1]) f.box(s*w*.28,h/2,d/2+.08,.14,h,.16,'Oak',C.oak);
  door(f,family===1?-w*.24:0,d/2+.11);
  for(const side of [-1,1]) {
    const wx=side*w*.31, wy=h>4?h*.72:2.1;
    if(family===1&&side===-1)continue;
    lancet(f,wx,wy,d/2+.085,.85,1.2,'Sandstone');
    if(family===3||family===5)for(const sx of [-1,1])f.box(wx+sx*.57,wy,d/2+.14,.25,1.12,.07,'Oak',C.end);
  }
  // Readable profession-specific silhouette and crafted fittings.
  if(family===0||family===1) {
    const aw=family===1?w*.6:w*.8,xx=family===1?w*.16:0;
    f.box(xx,2.35,d/2+.5,aw,.09,.9,'Wool',family===0?C.blue:C.wine,.18);
    for(const s of [-1,1]) f.beam([xx+s*aw/2,1.8,d/2+.05],[xx+s*aw/2,2.3,d/2+.95],.07,'Iron',C.iron);
    f.box(xx,2.23,d/2+.94,aw,.18,.06,'Wool',family===0?C.blue:C.wine);
  }
  if(family===2) { // woven hurdle grain-store frontage
    for(let j=0;j<7;j++) f.box(-w*.36+j*w*.12,.75,d/2+.14,.055,1.2,.08,'Oak',C.end);
    for(let j=0;j<4;j++) f.box(0,.3+j*.3,d/2+.18,w*.8,.045,.055,'Thatch',C.straw);
  }
  if(family===3) { // smith's small iron bracket and anvil relief
    f.beam([w*.3,2.7,d/2+.1],[w*.3,2.7,d/2+.8],.08,'Iron',C.iron);
    f.box(w*.3,2.35,d/2+.78,.65,.46,.08,'Oak',C.oak);
    f.box(w*.3,2.37,d/2+.83,.42,.1,.05,'Iron','#a2a9ac');
  }
  if(family===4) { // stone-end house, buttressed only inside old footprint
    for(const s of [-1,1])f.box(s*(w/2-.13),.8,d/2+.09,.36,1.6,.3,'Sandstone',C.sand);
  }
  if(family===5) { // projecting oriel supported by two elbows, not full walkable balcony
    f.box(0,h*.69,d/2+.3,1.45,1.25,.48,'Oak',C.oak);
    for(const q of [-.45,0,.45])lancet(f,q,h*.7,d/2+.55,.34,.88);
    for(const q of [-.5,.5])f.beam([q,h*.5,d/2+.04],[q,h*.58,d/2+.5],.13,'Oak',C.oak);
  }
  if(family===6) { // limewashed ecclesiastical doorway
    for(const s of [-1,1])f.box(s*.7,1.2,d/2+.16,.24,2.4,.26,'Limestone',C.pale);
    f.beam([-.7,2.4,d/2+.17],[0,2.9,d/2+.17],.24,'Limestone',C.pale);
    f.beam([0,2.9,d/2+.17],[.7,2.4,d/2+.17],.24,'Limestone',C.pale);
  }
  if(family===7)for(const s of [-1,1]) {
    f.box(s*w*.3,h*.7+.7,d/2+.18,1.3,.13,.35,'Slate',C.slate);
    f.box(s*w*.3,h*.7-.75,d/2+.17,1.3,.17,.3,'Sandstone',C.sand);
  }
  // Side-wall structure prevents finished fronts with blank cube flanks.
  for(const s of [-1,1])for(let j=0;j<3;j++){
    f.box(s*(w/2+.04),h*.52,-d*.33+j*d*.33,.12,.12,d*.24,'Oak',C.end);
    f.box(s*(w/2+.045),h*.5,-d*.38+j*d*.38,.12,h-.35,.13,'Oak',C.oak);
  }
  // Service elevations are authored as well: rear lofts, storage hatches and
  // brace patterns differ by household, instead of a repeated blank rear cube.
  const rear=c.frame(`Town_F${family}`,x,y,z,a+Math.PI), rz=d/2+.075;
  rear.box(0,h-.08,rz,w,.18,.14,'Oak',C.oak);
  rear.box(0,.45,rz,w,.14,.13,'Oak',C.end);
  if(family%3===0) {
    for(const s of [-1,1])rear.beam([s*(w/2-.24),.5,rz+.04],[s*.45,h-.23,rz+.04],.13,'Oak',C.oak);
    lancet(rear,0,h*.62,rz+.025,.8,1.15,'Sandstone');
  } else if(family%3===1) {
    door(rear,-w*.25,rz+.035,1.8,.9);
    rear.box(w*.22,h*.62,rz+.07,1.1,.9,.09,'Oak',C.end);
    for(let j=0;j<4;j++)rear.box(w*.22-.43+j*.28,h*.62,rz+.13,.035,.86,.025,'Oak',C.oak);
    rear.box(w*.22,h*.62,rz+.16,1.12,.08,.045,'Iron',C.iron);
  } else {
    for(const s of [-1,1]){
      rear.box(s*w*.29,h*.5,rz,.13,h-.15,.14,'Oak',C.oak);
      lancet(rear,s*w*.29,h*.65,rz+.04,.55,.85,'Sandstone');
    }
    rear.beam([-w*.28,.55,rz+.03],[w*.28,h*.48,rz+.03],.12,'Oak',C.oak);
  }
  if(h>4)rear.box(0,h*.53,rz,w+.1,.17,.2,'Oak',C.end);
}

export function wallCraft(c:KingdomCraft,x:number,y:number,z:number,a:number,h:number,len:number,i:number,radius=60) {
  const f=c.frame('Curtain',x,y,z,a);
  // Long mortar courses and staggered vertical joints, slightly proud of the wall.
  for(const side of [-1,1]) {
    for(let row=0;row<Math.floor(h/.8);row++) {
      f.box(side*1.215,row*.8+.4,0,.025,.035,len-.08,'Limestone',C.joint);
      for(let j=0;j<3;j++)f.box(side*1.23,row*.8+.75,-len*.4+(j+(row%2)*.5)*len/3,.025,.62,.035,'Limestone',C.joint);
    }
    if(i%4===0)f.box(side*1.24,h*.45,0,.12,h*.85,.38,'Sandstone',C.sand);
  }
  const da=Math.PI/64, outer=radius+1.28, inner=radius-1.28;
  const xo=outer*Math.cos(da)-radius,xi=inner*Math.cos(da)-radius,zo=outer*Math.sin(da),zi=inner*Math.sin(da);
  f.mesh([xo,h+.035,-zo,xo,h+.035,zo,xi,h+.035,zi,xi,h+.035,-zi],[0,2,1,0,3,2],'Limestone',C.pale);
}

export function roundTower(c:KingdomCraft,name:string,x:number,base:number,z:number,r:number,h:number,kind=0) {
  const f=c.frame(name,x,base,z);
  for(let row=1;row<h/1.3;row++)f.ring(0,row*1.3,0,r+.025,.032,'Limestone',row%3?C.joint:C.sand,false,40);
  for(const level of [1.1,h-1.2])f.ring(0,level,0,r+.12,.15,'Sandstone',C.pale,false,40);
  for(let k=0;k<8;k++) {
    const a=k*Math.PI/4;
    const q=c.frame(name,x+Math.sin(a)*(r+.035),base,z+Math.cos(a)*(r+.035),a);
    if(h>10)lancet(q,0,h*.62,.03,.55,1.8);
    if(kind===1)for(const y of [h*.35,h*.8])lancet(q,0,y,.04,.7,2.2);
    q.box(0,h-.65,.12,.28,.5,.3,'Sandstone',C.sand);
  }
}

export function pavilion(c:KingdomCraft,x:number,y:number,z:number,r:number,i:number) {
  const f=c.frame(`Pavilion_${i}`,x,y,z),h=2.2, rise=r*.9, col=i%2?C.blue:C.wine;
  // Twelve canvas gores follow the retained conical silhouette with alternating muted dyes.
  for(let j=0;j<12;j++) {
    const a=j*Math.PI/6,b=(j+1)*Math.PI/6,R=r*1.083;
    f.mesh([Math.cos(a)*R,h,Math.sin(a)*R,0,h+rise+.015,0,Math.cos(b)*R,h,Math.sin(b)*R],[0,1,2],'Wool',j%3===0?'#d3c7ad':col);
    f.beam([Math.cos(a)*R,h,Math.sin(a)*R],[0,h+rise+.02,0],.035,'Wool','#b6a684');
    if(i!==1) {
      f.box(Math.sin(a)*(r+.025),h/2,Math.cos(a)*(r+.025),.12,h,.075,'Wool','#d5c7a9',0,0,a);
    }
  }
  f.ring(0,h,0,r*1.085,.06,'Wool','#b99f70',false,36);
  if(i!==1) { // a painted rolled flap rather than a nonexistent traversable doorway
    f.box(0,1.05,r+.04,.85,1.85,.08,'Wool','#68768d');
    f.box(0,2.02,r+.08,1.02,.13,.16,'Wool','#d8c8a9');
  }
  for(let j=0;j<4;j++) {
    const a=j*Math.PI/2+.3;
    f.beam([Math.cos(a)*r,h*.85,Math.sin(a)*r],[Math.cos(a)*(r+.65),.1,Math.sin(a)*(r+.65)],.035,'Wool',C.straw);
    f.cyl(Math.cos(a)*(r+.65),.12,Math.sin(a)*(r+.65),.065,.3,'Oak',C.oak);
  }
}

export function roundHall(c:KingdomCraft,x:number,y:number,z:number,r:number,doorA:number) {
  const f=c.frame('Round_Hall',x,y,z);
  for(const yy of [.3,2.3,6.7])for(let i=0;i<40;i++) {
    const a=i*Math.PI*2/40,b=(i+1)*Math.PI*2/40,mid=(a+b)/2;
    if(Math.abs(Math.atan2(Math.sin(mid-doorA),Math.cos(mid-doorA)))<.23)continue;
    const rr=r+.58;
    f.beam([Math.cos(a)*rr,yy,Math.sin(a)*rr],[Math.cos(b)*rr,yy,Math.sin(b)*rr],.10,'Limestone',yy===2.3?C.joint:C.pale);
  }
  for(let i=0;i<16;i++) {
    const a=i*Math.PI/8,dd=Math.abs(Math.atan2(Math.sin(a-doorA),Math.cos(a-doorA)));
    if(dd<.3)continue;
    const p=c.frame('Round_Hall',x+Math.cos(a)*(r+.54),y,z+Math.sin(a)*(r+.54),Math.PI/2-a);
    p.box(0,3.4,.03,.38,6.6,.25,'Sandstone',C.sand);
    p.box(0,.32,.08,.66,.64,.4,'Limestone',C.pale);
    p.box(0,6.65,.10,.62,.25,.38,'Limestone',C.pale);
    if(i%2===1)lancet(p,.8,4.4,.08,.9,2.2);
    // Radial roof ribs turn the plain cone into a royal timber-and-metal crown.
    f.beam([Math.cos(a)*(r+1.8),7,Math.sin(a)*(r+1.8)],[0,15.02,0],.12,'Bronze',C.bronze);
  }
  // Surface placement includes the original wall's half-metre thickness: the
  // earlier centreline-only detailing was buried inside the wall and invisible.
  for(let i=0;i<40;i++) {
    const a=(i+.5)*Math.PI*2/40,dd=Math.abs(Math.atan2(Math.sin(a-doorA),Math.cos(a-doorA)));
    if(dd<.19)continue;
    const q=c.frame('Round_Hall',x+Math.cos(a)*(r+.515),y,z+Math.sin(a)*(r+.515),Math.PI/2-a);
    for(let j=1;j<=8;j++) {
      q.box(0,j*.78,.012,1.98,.026,.026,'Limestone',C.joint);
      q.box(j%2?.47:-.47,j*.78-.38,.02,.028,.69,.026,'Limestone',C.joint);
    }
  }
  const entrance=c.frame('Round_Hall_Portal',x+Math.cos(doorA)*(r+.54),y,z+Math.sin(doorA)*(r+.54),Math.PI/2-doorA);
  for(const s of [-1,1]) {
    entrance.box(s*2.25,2.5,.03,.25,5,.3,'Sandstone',C.sand);
    entrance.box(s*2.25,.2,.1,.5,.4,.5,'Limestone',C.pale);
    entrance.box(s*2.25,4.92,.08,.5,.2,.4,'Limestone',C.pale);
  }
  entrance.beam([-2.25,5.08,.09],[0,6.25,.09],.24,'Limestone',C.pale);
  entrance.beam([0,6.25,.09],[2.25,5.08,.09],.24,'Limestone',C.pale);
  entrance.ring(0,5.65,.18,.29,.05,'Bronze',C.bronze,true,16);
  for(let j=0;j<7;j++) {
    const yy=7.12+j*1.08,rr=(r+1.8)*(15-yy)/8+.025;
    f.ring(0,yy,0,rr,j===0?.075:.045,j===0||j===6?'Bronze':'Slate',j===0||j===6?C.bronze:'#687f8f',false,16);
  }
  // Individually legible thirteen seats and carved table-ring inlay.
  for(const rr of [4.5,5.5])f.ring(0,1.37,0,rr,.035,'Bronze',C.bronze,false,52);
  for(let i=0;i<13;i++) {
    const a=i*Math.PI*2/13,xx=Math.cos(a)*6.7,zz=Math.sin(a)*6.7;
    const p=c.frame('Round_Hall_Seats',x+xx,y,z+zz,Math.PI/2-a);
    p.box(0,.54,0,.84,.08,.84,'Wool',i===0?C.wine:C.blue);
    for(const s of [-1,1])p.box(s*.36,1.18,.42,.1,1.3,.13,'Oak',C.oak);
    p.box(0,1.79,.42,.8,.16,.16,'Oak',C.end);
    p.ring(0,1.35,.51,.17,.035,'Bronze',C.bronze,true,12);
  }
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6, rr=r-.8;
    f.beam([Math.cos(a)*rr,6.2,Math.sin(a)*rr],[0,13.8,0],.18,'Oak',C.oak);
  }
}

export function bridgeCraft(c:KingdomCraft,x:number,deck:number,z0:number,z1:number) {
  const f=c.frame('Sword_Causeway',x,deck,0);
  for(let z=z0+.8;z<z1;z+=3.5) {
    for(const side of [-1,1]) {
      f.box(side*1.39,-.5,z,.27,.12,.27,'Iron',C.iron);
      f.beam([side*1.4,-1.4,z],[side*1.4,-.3,z+1],.12,'Oak',C.oak);
      f.box(side*1.54,.4,z,.16,.9,.16,'Oak',C.end);
    }
  }
  for(let z=z0+.5;z<z1;z+=1.1)for(const side of [-1,1])f.cyl(side*1.17,.015,z,.035,.025,'Iron',C.iron,8);
}

/** Voussoir arch and hanging heraldic cloth sit on the existing gate lintel face. */
export function gateCraft(c:KingdomCraft,x:number,y:number,z:number,a:number) {
  const f=c.frame('Royal_Gate',x,y,z,a), R=6.15, spring=.2, depth=1.34;
  for(let i=0;i<19;i++) {
    const t0=i*Math.PI/19,t1=(i+1)*Math.PI/19,aa=(t0+t1)/2;
    const x0=Math.cos(t0)*R,y0=spring+Math.sin(t0)*R,x1=Math.cos(t1)*R,y1=spring+Math.sin(t1)*R;
    f.beam([x0,y0,depth],[x1,y1,depth],.48,'Limestone',i%3?C.pale:C.sand,.2);
    // Stone spandrels above the curve meet the unchanged high lintel; no false
    // arch drawn across a square void and no low decorative collision obstacle.
    f.mesh([x0,y0,depth-.04,x1,y1,depth-.04,x1,6.7,depth-.04,x0,6.7,depth-.04],[0,1,2,0,2,3],'Limestone',C.stone);
    // Radial voussoir boundary set forward, avoiding coplanar painted triangles.
    f.beam([Math.cos(aa)*(R-.25),spring+Math.sin(aa)*(R-.25),depth+.12],[Math.cos(aa)*(R+.25),spring+Math.sin(aa)*(R+.25),depth+.12],.025,'Sandstone',C.joint);
  }
  for(const s of [-1,1]) {
    f.box(s*R,spring/2,depth,.5,spring,.3,'Limestone',C.pale);
    const bx=s*7.4;
    f.beam([bx,8.8,depth],[bx,8.8,depth+.6],.09,'Iron',C.iron);
    f.mesh([bx-.55,8.7,depth+.64,bx+.55,8.7,depth+.64,bx+.55,5.2,depth+.64,bx,4.7,depth+.64,bx-.55,5.2,depth+.64],[0,1,2,0,2,3,0,3,4],'Wool',s<0?C.blue:C.wine);
    f.ring(bx,7.1,depth+.68,.28,.055,'Bronze',C.bronze,true,16);
    f.beam([bx-.25,6.4,depth+.69],[bx+.25,6.4,depth+.69],.045,'Bronze',C.bronze);
  }
}

export function keepBracket(c:KingdomCraft,x:number,y:number,z:number,a:number,r:number) {
  const f=c.frame('Keep_Brackets',x,y,z,-a);
  // Paired stone vault corbels, anchored into the tower below each stair flight.
  // The hollow curve is below the tread, not in the playable walking clearance.
  for(const q of [-.35,.35]) {
    const shape=new THREE.Shape();shape.moveTo(r-.12,-.30);shape.lineTo(r+2.65,-.30);shape.lineTo(r+2.65,-.62);
    shape.quadraticCurveTo(r+1.3,-.7,r-.12,-2.0);shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:false,curveSegments:5,steps:1});g.translate(0,0,q-.14);
    c.add('Keep_Brackets','Sandstone',g,C.sand,T(x,y,z,-a));g.dispose();
    f.box(r+.02,-1.18,q,.2,1.9,.43,'Limestone',C.pale);
  }
}

/** Crown pavilion on the four original tower-top column positions. */
export function keepCrown(c:KingdomCraft,x:number,y:number,z:number,r:number,h:number) {
  const f=c.frame('Royal_Keep_Crown',x,y,z);
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/2,xx=Math.cos(a)*2.6,zz=Math.sin(a)*2.6;
    f.box(xx,2,zz,.38,4,.38,'Sandstone',C.sand);
    f.box(xx,.16,zz,.65,.32,.65,'Limestone',C.pale);
    f.box(xx,3.82,zz,.68,.32,.68,'Limestone',C.pale);
    const b=(i+1)*Math.PI/2;
    f.beam([xx,4.04,zz],[Math.cos(b)*2.6,4.04,Math.sin(b)*2.6],.35,'Oak',C.oak);
  }
  f.cyl(0,4.22,0,3.18,.35,'Limestone',C.stone,16);
  f.ring(0,4.4,0,3.16,.12,'Bronze',C.bronze,false,32);
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6;
    f.box(Math.cos(a)*2.97,4.79,Math.sin(a)*2.97,.42,.82,.5,'Limestone',i%3===0?C.pale:C.stone,0,0,Math.PI/2-a);
  }
  f.cyl(0,4.85,0,.26,1,'Bronze',C.bronze);
  // Tall raised royal standard is socketed in the crown slab; its original pole
  // extends downward as a continuous visible mast rather than floating in air.
  f.cyl(0,7.1,0,.065,5.8,'Oak',C.oak);
  for(let k=0;k<8;k++) {
    const a=k*Math.PI/4,rr=r+.045;
    const b=c.frame('Royal_Keep_Buttresses',x+Math.cos(a)*rr,y-h-.8,z+Math.sin(a)*rr,Math.PI/2-a);
    b.box(0,h/2,.025,.33,h,.15,'Sandstone',C.sand);
    for(let j=1;j<4;j++)b.box(0,j*h/4,.075,.55,.22,.2,'Limestone',C.pale);
    if(k%2===0) {
      // Small shield and pennant fit in the wall gap between helical flights.
      const yy=h*.58;
      b.mesh([-.42,yy+.65,.17,.42,yy+.65,.17,.42,yy-.1,.17,0,yy-.48,.17,-.42,yy-.1,.17],[0,1,2,0,2,3,0,3,4],'Wool',k%4?C.wine:C.blue);
      b.ring(0,yy+.22,.19,.2,.035,'Bronze',C.bronze,true,16);
    }
  }
}

export function deckSector(c:KingdomCraft,x:number,y:number,z:number,inner:number,outer:number,s:number,count=24) {
  const f=c.frame('Keep_Deck',x,y,z),a=s*Math.PI*2/count,b=(s+1)*Math.PI*2/count;
  if(inner===0)f.mesh([0,0,0,outer*Math.cos(a),0,outer*Math.sin(a),outer*Math.cos(b),0,outer*Math.sin(b)],[0,2,1],'Limestone',C.stone);
  else f.mesh([outer*Math.cos(a),0,outer*Math.sin(a),outer*Math.cos(b),0,outer*Math.sin(b),inner*Math.cos(b),0,inner*Math.sin(b),inner*Math.cos(a),0,inner*Math.sin(a)],[0,2,1,0,3,2],'Limestone',C.pale);
}

export function farFoundation(c:KingdomCraft,x:number,y:number,z:number,heightAt:(x:number,z:number)=>number) {
  const f=c.frame('Distant_Foundation',x,y,z,.6);
  for(const side of [-1,1]) {
    for(const yy of [1.2,4,8,12.8])f.box(0,yy,side*17.08,61.8,.12,.16,'Limestone',yy===12.8?C.pale:C.joint);
    for(const xx of [-27,-14,0,14,27]) {
      const p=f.point(xx,0,side*17.3),bottom=Math.min(-1,heightAt(p.x,p.z)-y-.4);
      const top=11.5,mid=(bottom+top)/2;
      f.box(xx,mid,side*17.3,1.15,top-bottom,.9,'Sandstone',C.sand);
      f.box(xx,bottom+.3,side*17.3,1.7,.6,1.4,'Limestone',C.stone);
      f.box(xx,top+.05,side*17.3,1.4,.3,1.15,'Limestone',C.pale);
    }
    for(const xx of [-21,-7,7,21]) {
      const p=f.point(xx,0,side*17.12),a=side>0?.6:.6+Math.PI;
      const q=c.frame('Distant_Foundation',p.x,y,p.z,a);
      lancet(q,0,7,.05,1.4,3.6);
    }
  }
}

export function standingStone(c:KingdomCraft,x:number,y:number,z:number,a:number,h:number,i:number) {
  const f=c.frame('Oath_Stones',x,y,z,a);
  for(const side of [-1,1]) {
    // Incised-looking narrow pigment bands and restrained knotwork, not alien neon glyphs.
    f.box(side*.49,h*.55,.47,.035,h*.62,.018,'Sandstone',C.sand);
  }
  f.ring(0,h*.68,.473,.23,.027,'Bronze',C.bronze,true,16);
  f.beam([-.27,h*.4,.48],[.27,h*.55,.48],.035,'Sandstone',C.pale);
  f.beam([.27,h*.4,.48],[-.27,h*.55,.48],.035,'Sandstone',C.pale);
}

export function swordDais(c:KingdomCraft,x:number,y:number,z:number) {
  const f=c.frame('Sword_Dais',x,y,z);
  for(const rr of [2.9,3.75])f.ring(0,.115,0,rr,.035,'Bronze',C.bronze,false,48);
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6;
    f.beam([Math.cos(a)*3.0,.12,Math.sin(a)*3.0],[Math.cos(a)*3.7,.12,Math.sin(a)*3.7],.035,'Limestone',C.joint);
  }
  f.beam([-.44,3.09,.6],[-.23,3.25,.6],.07,'Bronze',C.bronze);
  f.beam([.44,3.09,.6],[.23,3.25,.6],.07,'Bronze',C.bronze);
  for(let i=0;i<6;i++)f.ring(0,3.22+i*.1,.6,.065,.015,'Bronze',C.bronze,false,10);
}

export function shrineCraft(c:KingdomCraft,x:number,y:number,z:number) {
  const f=c.frame('Hermit_Oratory',x,y,z);
  f.ring(0,.52,0,3.15,.06,'Limestone',C.pale,false,32);
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/2+Math.PI/4,xx=Math.cos(a)*2.6,zz=Math.sin(a)*2.6;
    f.box(xx,.5,zz,.73,.26,.73,'Sandstone',C.sand);
    f.box(xx,3.16,zz,.68,.24,.68,'Sandstone',C.pale);
  }
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4+Math.PI/8;
    f.beam([Math.cos(a)*3.8,3.3,Math.sin(a)*3.8],[0,5.1,0],.13,'Slate',C.slate);
  }
  // The tiny abandoned oratory retains open sightlines to the discovery crystal.
  for(const s of [-1,1])f.beam([s*1.85,3.1,-1.85],[s*1.85,3.1,1.85],.16,'Oak',C.oak);
}

export function battlefieldCraft(c:KingdomCraft,x:number,y:number,z:number,a:number,kind:number) {
  const f=c.frame('Camlann_Remains',x,y,z,a);
  if(kind===0) {
    f.ring(0,.18,0,.45,.06,'Iron',C.iron,false,16);
    f.cyl(0,.18,0,.41,.055,'CharredWood',C.ash);
    f.cyl(0,.23,0,.1,.08,'Iron',C.iron);
  } else {
    for(const side of [-1,1]) {
      const p=f.point(side*1.0,.55,0);
      c.add('Camlann_Remains','CharredWood',new THREE.TorusGeometry(.6,.07,6,16),C.ash,T(p.x,p.y,p.z,a+Math.PI/2));
      for(let k=0;k<6;k++){const q=k*Math.PI/3;f.beam([side*1,.55,0],[side*1,.55+Math.sin(q)*.55,Math.cos(q)*.55],.055,'CharredWood',C.ash);}
    }
    for(let k=0;k<5;k++)f.box(-.7+k*.35,1.22,0,.29,.06,3.1,'CharredWood',k%2?C.ash:'#6a5946');
  }
}

/** Route existing static art by its authored color without touching collider arrays/order. */
export function surfaceOriginals(pieces:Piece[]) {
  const palette: [Surface,string[]][] = [
    ['Limestone',['#d9cdb4','#b3a68c','#c7c2b4']],['Sandstone',['#8f95ae','#626886']],
    ['Oak',['#6b4a32','#a8754a','#7a5233']],['Slate',['#5d6b8a','#b9554a']],
    ['Plaster',['#f1e6cf']],['Wool',['#3f62b8','#2d4688','#c8443c','#e8d9a8','#f2e6c9']],
    ['Iron',['#5a5f6e','#dfe8f4']],['Bronze',['#f4c95d','#e7b44c']],
    ['CharredWood',['#4a3d3a','#3d302b','#2b2220','#3a2f2a']],
  ];
  const colors=palette.flatMap(([surface,cs])=>cs.map(c=>({surface,c:new THREE.Color(c)})));
  const extra:Piece[]=[];
  for(const p of pieces) {
    if(p.material!=='M_Toon'||p.dynamic)continue;
    const groups=new Map<Surface,Batch>(), rest:THREE.BufferGeometry[]=[];
    for(const g of p.batch.vis) {
      const a=g.attributes.color;
      const item=a&&colors.find(v=>Math.abs(v.c.r-a.getX(0))<1e-6&&Math.abs(v.c.g-a.getY(0))<1e-6&&Math.abs(v.c.b-a.getZ(0))<1e-6);
      if(!item){rest.push(g);continue;}
      if(!groups.has(item.surface))groups.set(item.surface,new Batch(`${p.name}_${item.surface}`,`M_Britain${item.surface}`));
      groups.get(item.surface)!.vis.push(g);
    }
    p.batch.vis=rest;
    for(const batch of groups.values())extra.push({...p,name:batch.name,material:batch.material,batch});
  }
  pieces.push(...extra);
}

/** Consolidate only collision-free, unconditional physical ART. Runtime spatial
 * chunking can split these by location; house design diversity is not a draw-call tax. */
export function mergeKingdomVisuals(pieces:Piece[]) {
  const groups=new Map<string,Piece>(), retained:Piece[]=[];
  for(const p of pieces) {
    if(!p.material.startsWith('M_Britain')||p.dynamic||p.userData||p.batch.col.length) {retained.push(p);continue;}
    if(!groups.has(p.material)) {
      const name=`Britain_Physical_${p.material.slice('M_Britain'.length)}`;
      groups.set(p.material,{name,material:p.material,batch:new Batch(name,p.material),outline:true});
    }
    groups.get(p.material)!.batch.vis.push(...p.batch.vis);
  }
  pieces.splice(0,pieces.length,...retained,...groups.values());
}

/** Drop only visual upward faces from a non-indexed batch box, leaving source collision untouched. */
export function removeUpFaces(g:THREE.BufferGeometry) {
  const normal=g.attributes.normal; const keep:number[]=[];
  for(let i=0;i<normal.count;i+=3)if(normal.getY(i)<.99)keep.push(i,i+1,i+2);
  const out=new THREE.BufferGeometry();
  for(const [name,a] of Object.entries(g.attributes)) {
    const values:number[]=[];for(const i of keep)for(let k=0;k<a.itemSize;k++)values.push(a.array[i*a.itemSize+k]);
    out.setAttribute(name,new THREE.Float32BufferAttribute(values,a.itemSize));
  }
  return out;
}
