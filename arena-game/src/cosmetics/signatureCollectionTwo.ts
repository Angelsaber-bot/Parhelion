/** Second sculpted collection: eight separate silhouettes using the original
 * gameplay sockets and articulated parts. Coordinates are +X forward. */
import * as THREE from 'three';
import type {Sculpture,P} from './signatureModels.ts';
import {grip as baseGrip,bore,scope} from './signatureGunModels.ts';
import {glass,dot,tube,cutPlate} from './signatureCollectionThree.ts';

function grip(s:Sculpture){
 baseGrip(s);
 // The shared grip socket is below the receiver. A full tang joins the two.
 const [x,y,z]=s.def.grip;s.box([.15,.24,.14],[x+.03,y+.28,z],s.dark);
}
function rivets(s:Sculpture,points:readonly P[],z:number){
 for(const side of[-1,1])for(const [x,y]of points){s.sphere(.018,[x,y,side*z],s.metal,[1,1,.4]);s.rod([x-.008,y,side*(z+.009)],[x+.008,y,side*(z+.009)],.0025,s.dark);}
}
function magazine(s:Sculpture,x:number,y:number,width:number,height:number){
 s.box([width,height,.18],[x,y,0],s.dark,'magazine');
 for(const side of[-1,1])for(let i=0;i<3;i++)s.box([width*.72,.012,.012],[x,y-height*.27+i*height*.27,side*.097],s.metal,'magazine',.003);
 // Magazine well: the receiver reaches down to meet the magazine instead of leaving a gap.
 const top=y+height/2;if(top<.17)s.box([width*.9,.19-top,.16],[x,(top+.19)/2,0],s.dark,'body',.012);
}
function cloudline(s:Sculpture){
 grip(s);
 s.plate([[-.76,.16],[-.64,.43],[-.17,.52],[.67,.45],[1.15,.31],[.84,.14]],.25,[0,0,0],s.coat,'body',.016,true);
 s.plate([[-1.40,.14],[-1.36,.43],[-1.11,.47],[-.65,.33],[-.65,.20],[-1.14,.25]],.19,[0,0,0],s.coat,'stock',.012,true);
 s.box([.075,.29,.23],[-1.37,.28,0],s.soft,'stock');
 for(const side of[-1,1]){
  for(let i=0;i<3;i++)s.plate([[.15,.39-i*.075],[.91-i*.06,.40-i*.075],[1.16-i*.08,.31-i*.075],[.39,.28-i*.075]],.035,[0,0,side*(.145+i*.018)],i===1?s.metal:s.coat,'body',.007,true);
  s.ring(.115,.016,[-.36,.32,side*.142],s.metal);
  s.plate([[-.45,.32],[-.24,.38],[-.30,.30],[-.39,.27]],.012,[0,0,side*.16],s.glow);
  s.outline([[-1.26,.34,side*.109],[-1.06,.37,side*.109],[-.78,.28,side*.109]],.012,s.metal,'stock');
 }
 s.rod([.80,.29,0],[1.65,.29,0],.052,s.dark);bore(s,1.60,1.887,.29,.082);
 for(const x of[1.12,1.39])s.ring(.083,.014,[x,.29,0],s.metal,'body','x');
 magazine(s,.10,-.25,.23,.53);s.box([.25,.05,.05],[-.45,.47,-.17],s.metal,'bolt');s.gunSight();
 rivets(s,[[-.57,.30],[.54,.43],[.87,.28]],.14);
}
function express(s:Sculpture){
 grip(s);
 s.box([1.10,.37,.30],[-.25,.30,0],s.coat);
 s.plate([[-1.43,.09],[-1.43,.40],[-1.21,.45],[-.73,.32],[-.73,.19],[-1.17,.21]],.22,[0,0,0],s.coat,'stock');
 s.box([.08,.32,.27],[-1.40,.25,0],s.soft,'stock');
 s.rod([.17,.31,0],[1.42,.31,0],.152,s.coat);
 for(const x of[.24,.59,.94,1.29])s.ring(.155,.015,[x,.31,0],s.metal,'body','x');
 bore(s,1.40,1.773,.31,.105);
 s.box([.86,.17,.23],[.78,.085,0],s.dark,'fore_end');
 for(const side of[-1,1]){
  s.rod([.37,.08,side*.139],[1.16,.08,side*.139],.024,s.metal,'fore_end');
  for(const x of[.38,1.14]){s.ring(.053,.012,[x,.08,side*.15],s.metal,'fore_end');s.sphere(.021,[x,.08,side*.16],s.glow,[1,1,.4],'fore_end');}
  s.box([.43,.16,.015],[-.29,.31,side*.16],s.dark);
  for(let i=0;i<5;i++)s.box([.024,.12,.016],[-.45+i*.075,.31,side*.172],s.metal);
 }
 s.box([.22,.05,.05],[-.42,.47,-.17],s.metal,'bolt');s.gunSight();
 rivets(s,[[-.70,.43],[-.70,.16],[.14,.43],[.14,.16]],.155);
}
function horizon(s:Sculpture){
 grip(s);
 s.plate([[-.83,.16],[-.72,.45],[.28,.47],[1.12,.30],[.80,.15]],.25,[0,0,0]);
 s.plate([[-1.49,.11],[-1.44,.44],[-1.12,.47],[-.65,.31],[-.68,.19],[-1.20,.25]],.20,[0,0,0],s.coat,'stock');
 s.box([.07,.31,.25],[-1.46,.27,0],s.soft,'stock');
 for(const side of[-1,1]){
  const arc=Array.from({length:33},(_,i)=>[-.24+Math.cos(i/32*Math.PI)*.31,.43-Math.sin(i/32*Math.PI)*.25,side*.15]as const);
  s.outline(arc,.018,s.metal);
  for(let i=0;i<=12;i++){const t=i/12*Math.PI;s.rod([-.24+Math.cos(t)*.27,.43-Math.sin(t)*.218,side*.17],[-.24+Math.cos(t)*.30,.43-Math.sin(t)*.242,side*.17],.004,s.pearl);}
  s.rod([-.24,.44,side*.174],[-.03,.22,side*.174],.018,s.metal);s.sphere(.035,[-.24,.44,side*.18],s.glow,[1,1,.4]);
  for(let i=0;i<4;i++)s.box([.065,.10,.025],[.40+i*.14,.32,side*.15],s.metal);
 }
 s.rod([.65,.33,0],[1.53,.33,0],.046,s.dark);bore(s,1.49,1.817,.33,.075);
 magazine(s,.20,-.12,.25,.38);scope(s,.085);s.box([.24,.05,.05],[-.43,.45,-.145],s.metal,'bolt');
}
/** 磁带漫游 — a cassette shell with a label, a glass window and two reels that turn. */
function mixtape(s:Sculpture){
 grip(s);s.box([1.18,.39,.31],[-.03,.31,0],s.coat,'body',.05);
 s.box([.97,.10,.24],[.02,.08,0],s.dark);
 const pane=glass(s,0xd8f1ff);
 for(const side of[-1,1]){
  s.box([.98,.30,.012],[-.04,.32,side*.158],s.pearl,'body',.03);
  for(const y of[.445,.205])s.box([.90,.014,.006],[-.04,y,side*.166],s.glow,'body',.003);
  s.box([.64,.17,.014],[-.04,.31,side*.161],s.dark,'body',.04);
  s.box([.62,.15,.004],[-.04,.31,side*.171],pane,'body',.02);
  s.box([.22,.03,.006],[-.04,.31,side*.168],s.coat,'body',.004);
  for(const [x,y]of[[-.50,.44],[.42,.44],[-.50,.20],[.42,.20]]as const){dot(s,.014,[x,y,side*.165],s.metal,[1,1,.4]);s.box([.016,.003,.004],[x,y,side*.17],s.dark,'body',.001);}
  s.outline([[-.60,.38,side*.11],[-1.18,.43,side*.11],[-1.18,.12,side*.11],[-.60,.16,side*.11]],.027,s.metal,'stock');
  for(let i=0;i<3;i++)s.box([.035,.026,.019],[.30+i*.07,.13,side*.17],i===0?s.glow:s.pearl);
 }
 // Twin reels behind the glass; each turns about its own hub and runs faster on fire.
 for(const [role,x]of[['reelL',-.27],['reelR',.19]]as const){
  s.spin(role,[x,.31,0],1.3,6,'z');
  for(const side of[-1,1]){
   s.mesh(new THREE.CylinderGeometry(.062,.062,.006,24),s.dark,[x,.31,side*.164],'body',[Math.PI/2,0,0]); // tape pack: uniform, so it stays put
   s.ring(.05,.007,[x,.31,side*.166],s.pearl,role);dot(s,.018,[x,.31,side*.166],s.pearl,[1,1,.5],role);
   for(let i=0;i<6;i++){const a=i/6*Math.PI*2;s.box([.006,.034,.004],[x+Math.cos(a)*.026,.31+Math.sin(a)*.026,side*.166],s.pearl,role,.001).rotation.z=a-Math.PI/2;}
  }
 }
 // Deck keys along the top and a knurled volume wheel.
 for(let i=0;i<5;i++)s.box([.07,.03,.10],[-.48+i*.085,.51,0],i===1?s.glow:s.pearl,'body',.008);
 s.mesh(new THREE.CylinderGeometry(.05,.05,.024,20),s.metal,[.36,.45,.165],'body',[Math.PI/2,0,0]);
 for(let i=0;i<10;i++){const a=i/10*Math.PI*2;s.box([.008,.008,.026],[.36+Math.cos(a)*.05,.45+Math.sin(a)*.05,.165],s.dark,'body',.002);}
 s.box([.06,.30,.27],[-1.18,.27,0],s.soft,'stock');
 magazine(s,.13,-.23,.21,.50);s.box([.14,.24,.14],[.65,.20,0],s.dark,'fore_end');s.grip([.65,.13,0],[.65,-.20,0],.055,'fore_end');
 bore(s,.53,1.267,.31,.082);s.ring(.091,.015,[.91,.31,0],s.metal,'body','x');
 s.box([.18,.04,.05],[-.32,.50,-.165],s.metal,'bolt');s.gunSight();
 rivets(s,[[-.52,.47],[.48,.47],[-.52,.16],[.48,.16]],.16);
}
function glacier(s:Sculpture){
 grip(s);
 s.plate([[-.85,.15],[-.64,.48],[.13,.48],[1.15,.32],[.84,.12]],.24,[0,0,0]);
 s.plate([[-1.65,.12],[-1.61,.44],[-1.24,.51],[-.68,.32],[-.72,.19],[-1.32,.26],[-1.45,.11]],.19,[0,0,0],s.coat,'stock');
 s.box([.07,.30,.23],[-1.62,.28,0],s.soft,'stock');
 for(const side of[-1,1]){
  for(let i=0;i<6;i++){const x=.08+i*.18;s.plate([[x,.40],[x+.08,.46-i*.02],[x+.20,.21],[x+.08,.17]],.027,[0,0,side*(.14+i*.003)],i%2?s.metal:s.coat);}
  s.outline([[-1.42,.35,side*.11],[-1.20,.40,side*.11],[-.85,.29,side*.11]],.011,s.glow,'stock');
  s.plate([[-.67,.30],[-.49,.43],[-.33,.30],[-.48,.19]],.013,[0,0,side*.14],s.metal);
  s.plate([[-.60,.30],[-.49,.39],[-.39,.30],[-.49,.23]],.017,[0,0,side*.157],s.glow);
 }
 s.rod([.68,.29,0],[2.18,.29,0],.047,s.dark);
 for(let i=0;i<6;i++)s.box([.10,.13,.12],[1.02+i*.18,.29,0],i%2?s.coat:s.metal);
 bore(s,2.13,2.417,.29,.078);scope(s,.106);magazine(s,.07,-.15,.26,.37);
 s.rod([-.61,.44,-.14],[-.70,.27,-.25],.021,s.metal,'bolt');s.sphere(.042,[-.70,.27,-.25],s.dark,[1,1,1],'bolt');
}
/** 月港弯刀 — curved silver steel with a fuller and moonlit edge, an open crescent
 * guard, curled quillons, a knuckle bow, a crescent pommel and a tassel. */
function sabre(s:Sculpture){
 const steel=new THREE.MeshPhysicalMaterial({name:'Sculpt_blade_metal',color:0xdfe6ee,metalness:.92,roughness:.17,clearcoat:.7,clearcoatRoughness:.12,iridescence:.12});steel.userData.finish=s.style.id;
 s.grip([-.64,0,0],[-.16,0,0],.058);
 const c=(t:number)=>new THREE.Vector2(.02+1.44*t,-.05+.43*t*t),n=(t:number)=>new THREE.Vector2(.86*t,-1.44).normalize();
 const taper=(t:number)=>t>.9?(1-t)/.1:1,edge=(t:number)=>(.055*(1-.3*t)+(t>.68&&t<.92?.018*Math.sin((t-.68)/.24*Math.PI):0))*taper(t),spine=(t:number)=>.024*(1-.4*t)*taper(t);
 const N=36,blade:P[]=[];
 for(let i=0;i<=N;i++){const t=i/N,p=c(t).addScaledVector(n(t),edge(t));blade.push([p.x,p.y]);}
 for(let i=N-1;i>=0;i--){const t=i/N,p=c(t).addScaledVector(n(t),-spine(t));blade.push([p.x,p.y]);}
 s.plate(blade,.026,[0,0,0],steel,'body',.006);
 const along=(t0:number,t1:number,off:(t:number)=>number,z:number)=>Array.from({length:18},(_,i)=>{const t=t0+(t1-t0)*i/17,p=c(t).addScaledVector(n(t),off(t));return[p.x,p.y,z]as const;});
 for(const side of[-1,1]){
  s.outline(along(.04,.72,t=>-spine(t)*.2,side*.017),.007,s.dark);
  s.outline(along(.03,.97,t=>edge(t)*.82,side*.014),.0035,s.glow);
  s.outline(along(.0,.86,t=>-spine(t)*.85,side*.016),.004,s.metal);
  for(const t of[.18,.33,.48]){const p=c(t).addScaledVector(n(t),-spine(t)*.25+.012);const moon=[...Array.from({length:9},(_,i)=>{const a=-1.9+i/8*3.8;return[p.x+Math.cos(a)*.022,p.y+Math.sin(a)*.022]as P;}),...Array.from({length:9},(_,i)=>{const a=1.5-i/8*3.0;return[p.x+.009+Math.cos(a)*.017,p.y+Math.sin(a)*.017]as P;})];s.plate(moon,.004,[0,0,side*.017],s.metal,'body',.001);}
 }
 // Ricasso collar and langets.
 s.box([.17,.10,.05],[-.04,-.02,0],s.metal,'body',.012);for(const side of[-1,1])s.plate([[-.04,-.05],[.10,-.04],[.12,0],[-.04,.01]],.008,[0,0,side*.03],s.metal,'body',.002);
 // Open crescent shell guard, perpendicular to the blade.
 const shell=cutPlate(s,Array.from({length:28},(_,i)=>{const a=i/28*Math.PI*2;return[Math.cos(a)*.12,Math.sin(a)*.15]as P;}),[Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;return[.035+Math.cos(a)*.085,.02+Math.sin(a)*.115]as P;})],.024,[-.10,0,0],s.coat,'body',.006);shell.rotation.y=Math.PI/2;
 s.ring(.135,.012,[-.10,0,0],s.metal,'body','x');
 for(const sign of[-1,1])s.outline(Array.from({length:22},(_,i)=>{const t=i/21;if(t<.55)return[-.10,sign*(.04+t/.55*.16),0]as const;const a=(t-.55)/.45*Math.PI*1.6,r=.035*(1-(t-.55));return[-.10+Math.sin(a)*r,sign*(.20+(1-Math.cos(a))*r*.2),Math.cos(a)*r*.2]as const;}),.014,s.metal);
 s.outline([[-.10,.18,0],[-.22,.24,0],[-.46,.25,0],[-.64,.17,0],[-.71,.04,0]],.02,s.metal);
 // Crescent pommel and tassel.
 s.sphere(.062,[-.68,0,0],s.metal,[.75,1,1]);
 const moon:P[]=[...Array.from({length:13},(_,i)=>{const a=Math.PI*.5+i/12*Math.PI;return[Math.cos(a)*.07,Math.sin(a)*.07]as P;}),...Array.from({length:13},(_,i)=>{const a=Math.PI*1.45-i/12*Math.PI*.9;return[.03+Math.cos(a)*.055,Math.sin(a)*.055]as P;})];
 const cap=s.plate(moon,.02,[-.745,0,0],s.coat,'body',.005);cap.rotation.y=Math.PI/2;
 tube(s,[[-.70,-.04,0],[-.72,-.13,.01],[-.70,-.21,0]],.006,s.soft,'body',16);dot(s,.022,[-.70,-.22,0],s.glow);
 s.mesh(new THREE.ConeGeometry(.032,.12,12),s.coat,[-.70,-.29,0]);
}
function trident(s:Sculpture){
 s.rod([-1.73,0,0],[.96,0,0],.045,s.coat);s.grip([-.98,0,0],[-.45,0,0],.048);s.grip([-.12,0,0],[.16,0,0],.048);
 for(const x of[-1.64,-1.22,-.27,.36,.69])s.rod([x-.025,0,0],[x+.025,0,0],.058,s.metal);
 s.plate([[.74,-.055],[1.46,-.07],[1.82,0],[1.46,.07],[.74,.055]],.035,[0,0,0],s.metal);
 for(const sign of[-1,1]){
  s.outline([[.63,0,0],[.85,sign*.14,0],[1.17,sign*.27,0],[1.49,sign*.27,0]],.037,s.coat);
  s.plate([[1.26,sign*.23],[1.49,sign*.34],[1.68,sign*.30],[1.49,sign*.19]],.028,[0,0,0],s.metal);
  s.outline([[.42,0,0],[.57,sign*.12,0],[.64,sign*.20,0]],.019,s.glow);
  s.rod([.56,sign*.10,0],[.46,sign*.18,0],.014,s.glow);
 }
 for(const side of[-1,1]){s.sphere(.06,[.88,0,side*.055],s.pearl,[1,1,.6]);s.outline([[1.02,0,side*.026],[1.68,0,side*.026]],.006,s.glow);}
 s.sphere(.065,[-1.73,0,0],s.metal,[1,1,1]);
}
/** 圣堂回响 — octagonal reliquary head: arched window with a rose above it, stacked
 * tracery, corner pinnacles, ribbed sides, a spire and three hanging chimes. */
function reliquary(s:Sculpture){
 s.rod([-1.38,0,0],[.52,0,0],.052,s.metal);s.grip([-1.22,0,0],[-.51,0,0],.063);
 s.sphere(.086,[-1.34,0,0],s.coat,[.75,1,1]);
 const cx=.48,cy=.04;
 s.mesh(new THREE.CylinderGeometry(.37,.37,.46,8),s.dark,[cx,cy,0],'body',[Math.PI/2,0,0]);
 const corner=(i:number,r:number):P=>{const t=(i+.5)/8*Math.PI*2;return[cx+Math.cos(t)*r,cy+Math.sin(t)*r];};
 for(const side of[-1,1]){
  const frame:P[]=Array.from({length:8},(_,i)=>corner(i,.40));
  s.plate(frame,.035,[0,0,side*.245],s.metal);
  s.plate(frame.map(([x,y])=>[cx+(x-cx)*.83,cy+(y-cy)*.83]as P),.038,[0,0,side*.27],s.coat);
  // Lancet window, mullions and transom.
  s.plate([[.33,-.21],[.33,.06],[.48,.22],[.63,.06],[.63,-.21]],.016,[0,0,side*.298],s.metal);
  s.plate([[.36,-.18],[.36,.05],[.48,.18],[.60,.05],[.60,-.18]],.019,[0,0,side*.311],s.glow);
  for(const x of[.42,.54])s.rod([x,-.18,side*.326],[x,.10,side*.326],.008,s.metal);
  s.rod([.36,-.04,side*.326],[.60,-.04,side*.326],.008,s.metal);
  s.outline([[.36,.05,side*.326],[.48,.18,side*.326],[.60,.05,side*.326]],.007,s.metal);
  // Rose above the lancet.
  s.ring(.055,.009,[cx,cy+.235,side*.305],s.metal);dot(s,.02,[cx,cy+.235,side*.31],s.glow,[1,1,.5]);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;s.rod([cx,cy+.235,side*.31],[cx+Math.cos(a)*.052,cy+.235+Math.sin(a)*.052,side*.31],.004,s.metal);dot(s,.012,[cx+Math.cos(a+.52)*.035,cy+.235+Math.sin(a+.52)*.035,side*.309],s.glow,[1,1,.4]);}
  for(let i=0;i<8;i++){const [x,y]=corner(i,.335);dot(s,.016,[x,y,side*.292],s.metal,[1,1,.5]);}
 }
 // Ribs along every edge of the octagon and a pinnacle on each corner.
 for(let i=0;i<8;i++){
  const [x,y]=corner(i,.37),t=(i+.5)/8*Math.PI*2;
  s.rod([x,y,-.25],[x,y,.25],.021,s.metal);
  if(t>Math.PI*.6&&t<Math.PI*1.4)continue; // the haft enters on this side
  s.rod([x,y,0],[cx+Math.cos(t)*.47,cy+Math.sin(t)*.47,0],.03,s.coat,'body',.004,8);
  dot(s,.02,[cx+Math.cos(t)*.475,cy+Math.sin(t)*.475,0],s.glow);
 }
 for(let i=0;i<8;i++){const t=i/8*Math.PI*2+Math.PI/8,a=t+Math.PI/8,b=t-Math.PI/8;for(const z of[-.12,.12])s.rod([cx+Math.cos(a)*.372,cy+Math.sin(a)*.372,z],[cx+Math.cos(b)*.372,cy+Math.sin(b)*.372,z],.008,s.metal);}
 // Spire and three chimes hanging below the head.
 s.rod([cx,cy+.36,0],[cx,cy+.52,0],.05,s.coat,'body',.004,8);s.ring(.03,.007,[cx,cy+.55,0],s.metal);
 for(const dx of[-.14,0,.14]){
  const top=cy-.36-(dx?0:.04);s.rod([cx+dx,cy-.34,0],[cx+dx,top-.06,0],.004,s.metal);
  const g=new THREE.LatheGeometry([[0,0],[.012,0],[.028,-.03],[.034,-.075],[.03,-.075],[.022,-.03],[0,-.02]].map(([r,y])=>new THREE.Vector2(r,y)),14);s.mesh(g,s.metal,[cx+dx,top-.06,0]);
 }
 s.ring(.083,.018,[-.25,0,0],s.coat,'body','x');
}
export function buildSecondCollection(s:Sculpture,model:string){
 switch(model){
  case'aerostat':cloudline(s);break;case'locomotive':express(s);break;
  case'sextant':horizon(s);break;case'cassette':mixtape(s);break;
  case'glacier':glacier(s);break;case'sabre':sabre(s);break;
  case'trident':trident(s);break;case'reliquary':reliquary(s);break;
  default:throw new Error(`Unknown structural skin model: ${model}`);
 }
 // Raised iron sights need a physical pedestal, below the clear ADS ray.
 if(['aerostat','locomotive','cassette'].includes(model)&&s.def.sight){
  const [x,y,z]=s.def.sight;s.box([.10,y-.55,.11],[x,(.44+y-.11)/2,z],s.dark,'optic');
 }
}
