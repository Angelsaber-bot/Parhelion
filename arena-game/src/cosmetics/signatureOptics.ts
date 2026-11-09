/** Themed optics for the scoped rifles, so no two DMR/sniper finishes share a
 * scope silhouette. Every optic is a hollow body of revolution (or open frame)
 * around the authored sight axis: the ADS ray from behind the eyepiece passes
 * through without touching geometry. Coordinates: +X forward, raw sockets. */
import * as THREE from 'three';
import type {Sculpture,P,V} from './signatureModels.ts';

type Ctx={s:Sculpture;x:number;y:number;z:number;r:number;a:number;b:number};
/** Thick-walled turned tube: `outer` is [radius, x] from rear to front, inner bore constant. */
function shell(c:Ctx,outer:readonly P[],m:THREE.Material,segments=28,inner=c.r*.78){
 const profile=[...outer,[inner,outer[outer.length-1][1]]as P,[inner,outer[0][1]]as P,outer[0]];
 const g=new THREE.LatheGeometry(profile.map(([r,x])=>new THREE.Vector2(r,x)),segments);g.rotateZ(-Math.PI/2);
 return c.s.mesh(g,m,[0,c.y,c.z],'optic');
}
function band(c:Ctx,x:number,r:number,t:number,m:THREE.Material,segments=28){
 return shell(c,[[r,x-t],[r+.006,x],[r,x+t]],m,segments,r-.012);
}
function posts(c:Ctx,xs:readonly number[],m:THREE.Material=c.s.metal,base=true){
 const {s,y,z}=c;if(base)s.box([Math.abs(xs[xs.length-1]-xs[0])+.12,.12,.19],[(xs[0]+xs[xs.length-1])/2,y-.22,z],s.dark,'optic',.02);
 for(const at of xs)s.rod([at,y-.34,z],[at,y-c.r*.92,z],.026,m,'optic');
}
function objectiveGlass(c:Ctx,x:number,r:number,m:THREE.Material){c.s.ring(r,.008,[x,c.y,c.z],m,'optic','x');}

const OPTICS:Record<string,(c:Ctx)=>void>={
 /** Brass draw-tube telescope on a sextant-arc bracket. */
 'brass-horizon'(c){
  const {s,a,b,r,y,z}=c;
  shell(c,[[r,a-.06],[r*1.02,a+.16],[r*1.2,a+.17],[r*1.2,a+.42],[r*1.4,a+.43],[r*1.4,b+.06],[r*1.55,b+.08],[r*1.55,b+.14]],s.metal);
  for(const x of[a+.165,a+.425])band(c,x,r*1.3+(x>a+.3?.03:0),.012,s.coat);
  objectiveGlass(c,b+.13,r*1.3,s.glow);
  for(const side of[-1,1])s.outline(Array.from({length:12},(_,i)=>{const t=i/11*Math.PI;return[a+.30+Math.cos(t)*.24,y-.10-Math.sin(t)*.20,z+side*.06]as const;}),.014,s.metal,'optic');
  s.box([.56,.06,.16],[a+.30,y-.34,z],s.dark,'optic',.015);for(const x of[a+.10,a+.50])s.rod([x,y-.34,z],[x,y-r*.95,z],.022,s.metal,'optic');
  s.mesh(new THREE.CylinderGeometry(.034,.034,.05,16),s.coat,[a+.30,y,z+r*1.25],'optic',[Math.PI/2,0,0]);
 },
 /** A celadon gourd scope with gilt waist and lip and a jade bead. */
 'celadon-atlas'(c){
  const {s,a,b,r,y,z}=c;
  shell(c,[[r*1.15,a-.02],[r*1.48,a+.09],[r*1.38,a+.2],[r*.98,a+.32],[r*.98,b-.3],[r*1.5,b-.14],[r*1.58,b-.04],[r*1.3,b+.04]],s.coat,32);
  for(const x of[a+.31,b-.31,b+.03])band(c,x,x>b?r*1.32:r*1.0,.012,s.metal,32);
  s.sphere(.026,[a+.09,y+r*1.5,z],s.glow);posts(c,[a+.36,b-.36]);
 },
 /** Hexagonal lacquer barrel with pearl bands and silver rain strokes. */
 'night-nacre'(c){
  const {s,a,b,r,y,z}=c;
  shell(c,[[r*1.32,a],[r*1.32,a+.05],[r*1.1,a+.07],[r*1.1,b-.07],[r*1.32,b-.05],[r*1.32,b]],s.coat,6,r*.86);
  for(const x of[a+.24,b-.24])shell(c,[[r*1.16,x-.016],[r*1.16,x+.016]],s.pearl,6,r*1.08);
  for(const side of[-1,1])for(let i=0;i<5;i++){const x=a+.12+i*.12;s.rod([x,y+r*.6,z+side*r*1.0],[x-.04,y-r*.4,z+side*r*1.0],.003,s.metal,'optic');}
  posts(c,[a+.2,b-.2]);
 },
 /** Short, wide owl-eye scope: amber iris ring, ear tufts and a feather brow. */
 'owl-canticle'(c){
  const {s,a,b,r,y,z}=c;
  shell(c,[[r,a+.06],[r,b-.36],[r*1.6,b-.22],[r*1.78,b-.12],[r*1.78,b-.06]],s.coat,32);
  shell(c,[[r*1.62,b-.1],[r*1.62,b-.06]],s.glow,32,r*1.2);
  for(const side of[-1,1]){
   s.plate([[a+.10,y+r*.8],[a-.02,y+r*2.4],[a+.08,y+r*2.2],[a+.20,y+r*1.0]],.016,[0,0,z+side*.045],s.metal,'optic',.004);
   s.plate([[b-.32,y+r*1.1],[b-.12,y+r*1.95],[b-.04,y+r*1.75],[b-.20,y+r*1.05]],.014,[0,0,z+side*.07],s.coat,'optic',.004);
  }
  posts(c,[a+.18,b-.42]);
 },
 /** Long, slim katana scope with two sakura tsuba and a cord-wrapped eyepiece. */
 'petal-scabbard'(c){
  const {s,a,b,r,y,z}=c,ri=r*.72;
  shell(c,[[r*.9,a-.14],[r*.9,b+.2]],s.coat,24,ri);
  for(const at of[a+.2,b-.06]){
   const outer=Array.from({length:30},(_,i)=>{const t=i/30*Math.PI*2,k=1+.12*Math.cos(t*5);return[Math.cos(t)*r*1.75*k,Math.sin(t)*r*1.75*k]as P;});
   const shape=new THREE.Shape(outer.map(([u,v])=>new THREE.Vector2(u,v)));const hole=new THREE.Path();hole.absarc(0,0,r*.9,0,Math.PI*2,true);shape.holes.push(hole);
   for(let k=0;k<5;k++){const t=k/5*Math.PI*2+.3,p=new THREE.Path();p.absellipse(Math.cos(t)*r*1.32,Math.sin(t)*r*1.32,r*.16,r*.1,0,Math.PI*2,true,t);shape.holes.push(p);}
   const g=new THREE.ExtrudeGeometry(shape,{depth:.016,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:1,curveSegments:10});g.translate(0,0,-.008);g.rotateY(Math.PI/2);s.mesh(g,s.metal,[at,y,z],'optic');
  }
  const wrap:V[]=Array.from({length:61},(_,i)=>{const t=i/60,ang=t*Math.PI*16;return[a-.12+.28*t,y+Math.cos(ang)*r*.93,z+Math.sin(ang)*r*.93];});s.outline(wrap,.006,s.soft,'optic');
  posts(c,[a+.3,b-.2]);
 },
 /** Square survey housing with a level vial, side knobs and a round objective. */
 'glacier-survey'(c){
  const {s,a,b,r,y,z}=c,h=r*1.28,ih=r*.86;
  const shape=new THREE.Shape([[-h,-h],[h,-h],[h,h],[-h,h]].map(([u,v])=>new THREE.Vector2(u,v)));const hole=new THREE.Path([[-ih,-ih],[-ih,ih],[ih,ih],[ih,-ih]].map(([u,v])=>new THREE.Vector2(u,v)));shape.holes.push(hole);
  const len=b-.2-a,g=new THREE.ExtrudeGeometry(shape,{depth:len,bevelEnabled:true,bevelSize:.01,bevelThickness:.01,bevelSegments:2});g.translate(0,0,-len/2);g.rotateY(Math.PI/2);s.mesh(g,s.coat,[a+len/2,y,z],'optic');
  shell(c,[[r*1.05,b-.22],[r*1.25,b-.1],[r*1.3,b+.02]],s.metal,28,r*.86);
  s.rod([a+.18,y+h+.025,z],[a+.42,y+h+.025,z],.022,s.glow,'optic');for(const x of[a+.17,a+.43])s.rod([x-.012,y+h+.025,z],[x+.012,y+h+.025,z],.028,s.metal,'optic');
  for(const side of[-1,1])s.mesh(new THREE.CylinderGeometry(.038,.038,.04,14),s.metal,[a+.3,y,z+side*(h+.03)],'optic',[Math.PI/2,0,0]);
  s.box([len*.6,.12,.2],[a+len/2,y-h-.06,z],s.dark,'optic',.02);for(const x of[a+.15,b-.35])s.rod([x,y-.34,z],[x,y-h-.1,z],.026,s.metal,'optic');
 },
 /** Brass clockwork telescope: enamel dial on one flank, gears on the other. */
 'meridian-key'(c){
  const {s,a,b,r,y,z}=c;
  shell(c,[[r*1.25,a-.02],[r*1.25,a+.06],[r*1.02,a+.08],[r*1.02,b-.16],[r*1.35,b-.12],[r*1.35,b+.04]],s.metal,32);
  for(let i=0;i<20;i++){const t=i/20*Math.PI*2;s.box([.02,.018,.018],[b+.02,y+Math.cos(t)*r*1.42,z+Math.sin(t)*r*1.42],s.metal,'optic',.003);}
  const cx=a+.34;s.mesh(new THREE.CylinderGeometry(r*.95,r*.95,.014,28),s.pearl,[cx,y,z+r*1.08],'optic',[Math.PI/2,0,0]);s.ring(r*.95,.008,[cx,y,z+r*1.09],s.metal,'optic');
  s.rod([cx,y,z+r*1.1],[cx+.04,y+.05,z+r*1.1],.005,s.dark,'optic');s.rod([cx,y,z+r*1.1],[cx-.05,y+.02,z+r*1.1],.004,s.dark,'optic');
  for(const [dx,rr]of[[-.06,.05],[.07,.04]]as const){s.mesh(new THREE.CylinderGeometry(rr,rr,.012,14),s.coat,[cx+dx,y,z-r*1.06],'optic',[Math.PI/2,0,0]);for(let i=0;i<10;i++){const t=i/10*Math.PI*2;s.box([.012,.012,.012],[cx+dx+Math.cos(t)*rr,y+Math.sin(t)*rr,z-r*1.06],s.metal,'optic',.002);}}
  posts(c,[a+.18,b-.24]);
 },
 /** Rose-gold scope wrapped in a thorned vine, with a bud at the objective. */
 'velvet-thorn'(c){
  const {s,a,b,r,y,z}=c;
  shell(c,[[r*1.22,a-.02],[r*1.28,a+.06],[r,a+.1],[r,b-.12],[r*1.3,b-.04],[r*1.3,b+.02]],s.coat,28);
  const R=r*1.1,vine:V[]=Array.from({length:81},(_,i)=>{const t=i/80,ang=t*Math.PI*7;return[a+.1+(b-a-.22)*t,y+Math.cos(ang)*R,z+Math.sin(ang)*R];});s.outline(vine,.008,s.dark,'optic');
  for(let i=5;i<80;i+=8){const [px,py,pz]=vine[i],ny=(py-y)/R,nz=(pz-z)/R;s.rod([px,py,pz],[px+.012,py+ny*.04,pz+nz*.04],.008,s.metal,'optic',0,6);}
  for(let i=0;i<5;i++){const t=i/5*Math.PI*2;s.sphere(.022,[b-.02,y+r*1.42+Math.cos(t)*.012,z+Math.sin(t)*.018],s.glow,[1.3,1,1]);}s.rod([b-.06,y+r*1.18,z],[b-.03,y+r*1.42,z],.006,s.dark,'optic');
  band(c,b+.0,r*1.3,.01,s.metal);posts(c,[a+.2,b-.25]);
 },
 /** A bone spyglass: vertebral ridges and a jaw-like sunshade. */
 'abyssal-requiem'(c){
  const {s,a,b,r,y,z}=c,outer:P[]=[];
  for(let i=0;i<=30;i++){const t=i/30,x=a+(b-a)*t;outer.push([r*(1.04+.14*Math.abs(Math.sin(t*Math.PI*5))),x]);}
  shell(c,outer,s.pearl,24);
  for(const side of[-1,1])s.outline([[b-.08,y+side*r*1.05,z],[b+.06,y+side*r*1.25,z],[b+.16,y+side*r*1.0,z+.02]],.014,s.pearl,'optic');
  for(let i=0;i<5;i++)s.sphere(.011,[a+.1+i*.14,y-r*.2,z+r*1.15],s.glow);
  posts(c,[a+.22,b-.26],s.pearl);
 },
 /** Angular octagonal optic with a lit side display and prism fins. */
 'void-lance'(c){
  const {s,a,b,r,y,z}=c;
  shell(c,[[r*1.32,a],[r*1.1,a+.06],[r*1.1,b-.22],[r*1.5,b-.08],[r*1.5,b]],s.coat,8,r*.85);
  shell(c,[[r*1.4,b-.05],[r*1.4,b-.03]],s.glow,8,r*1.12);
  s.box([.24,r*1.0,.012],[a+.32,y,z+r*1.12],s.glow,'optic',.004);s.box([.28,r*1.15,.01],[a+.32,y,z+r*1.105],s.dark,'optic',.004);
  for(const dx of[0,.12,.24])s.plate([[a+.15+dx,y+r*1.05],[a+.22+dx,y+r*1.75],[a+.27+dx,y+r*1.05]],.012,[0,0,z],s.metal,'optic',.003);
  posts(c,[a+.2,b-.3],s.dark);
 },
};

/** Build the finish's own optic. Returns false for finishes that keep the classic scope. */
export function themedScope(s:Sculpture,r:number){
 const build=OPTICS[s.style.id];if(!build||!s.def.sight)return false;
 const [x,y,z]=s.def.sight;build({s,x,y,z,r,a:x-.12,b:x+.68});return true;
}

/** Themed muzzles and barrel profiles. All decoration stays off the bore axis,
 * so the open bore and the muzzle socket are unchanged. */
const MUZZLES:Record<string,(s:Sculpture,x:number,y:number)=>void>={
 'brass-horizon'(s,x,y){
  s.mesh(new THREE.CylinderGeometry(.062,.062,.84,8),s.coat,[1.07,y,0],'body',[0,0,Math.PI/2]);
  for(const at of[.72,1.0,1.28])s.mesh(new THREE.CylinderGeometry(.068,.068,.03,8),s.metal,[at,y,0],'body',[0,0,Math.PI/2]);
  s.ring(.085,.014,[x-.16,y,0],s.coat,'body','x');
  for(let i=0;i<8;i++){const t=i/8*Math.PI*2,l=i%2?.12:.17;s.rod([x-.16,y+Math.cos(t)*.08,Math.sin(t)*.08],[x-.13,y+Math.cos(t)*l,Math.sin(t)*l],.016,s.metal,'body',0,4);}
 },
 'celadon-atlas'(s,x,y){
  const petal=s.pearl.clone();petal.name='Sculpt_petal_pearl';petal.side=THREE.DoubleSide;
  for(let i=0;i<8;i++){const g=new THREE.SphereGeometry(.13,6,5,i/8*Math.PI*2,Math.PI*2/8*1.05,1.0,.95);g.rotateZ(-Math.PI/2);s.mesh(g,i%2?petal:s.coat,[x-.10,y,0]);}
  s.ring(.08,.012,[x-.14,y,0],s.metal,'body','x');
  for(const at of[.66,.92,1.42])s.mesh(new THREE.TorusGeometry(.056,.014,8,24),s.coat,[at,y,0],'body',[0,Math.PI/2,0]);
 },
 'night-nacre'(s,x,y){
  const c=x-.12,len=.16;
  for(const sy of[-1,1])s.box([len,.022,.2],[c,y+sy*.09,0],s.coat,'body',.006);
  for(const sz of[-1,1]){s.box([len,.2,.022],[c,y,sz*.09],s.coat,'body',.006);for(let i=0;i<3;i++)s.box([.018,.12,.006],[c-.05+i*.05,y,sz*.102],s.dark,'body',.002);}
  for(const at of[c-len/2,c+len/2])s.box([.014,.21,.21],[at,y+.0,0],s.metal,'body',.004).scale.set(1,1,1);
 },
 'owl-canticle'(s,x,y){
  s.plate([[x-.22,y+.08],[x-.02,y+.095],[x+.07,y+.075],[x+.06,y+.035],[x+.0,y+.07],[x-.2,y+.07]],.05,[0,0,0],s.metal,'body',.008,true);
  for(const side of[-1,1])for(let i=0;i<3;i++){const at=x-.62+i*.15;s.plate([[at,y+.02],[at+.14,y+.05],[at+.18,y-.03],[at+.04,y-.04]],.012,[0,0,side*.058],i%2?s.metal:s.coat,'body',.003);}
 },
 'glacier-survey'(s,x,y){
  for(let i=0;i<6;i++){const t=i/6*Math.PI*2+.3;s.rod([x-.14,y+Math.cos(t)*.07,Math.sin(t)*.07],[x-.02,y+Math.cos(t)*.17,Math.sin(t)*.17],.024,i%2?s.pearl:s.coat,'body',0,6);}
  s.ring(.085,.012,[x-.15,y,0],s.metal,'body','x');
 },
 'meridian-key'(s,x,y){
  s.plate([[x-.28,y-.085],[x,y-.085],[x,y-.19],[x-.06,y-.19],[x-.06,y-.14],[x-.12,y-.14],[x-.12,y-.21],[x-.18,y-.21],[x-.18,y-.14],[x-.24,y-.14],[x-.24,y-.085]],.03,[0,0,0],s.metal,'body',.005);
  s.ring(.03,.008,[x-.03,y-.155,0],s.dark,'body');
 },
};
export function themedMuzzle(s:Sculpture){
 const build=MUZZLES[s.style.id],m=s.def.muzzle;if(!build||!m)return;build(s,m[0],m[1]);
}
