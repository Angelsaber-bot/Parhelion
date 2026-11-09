/** Second sculpted collection: eight separate silhouettes using the original
 * gameplay sockets and articulated parts. Coordinates are +X forward. */
import * as THREE from 'three';
import type {Sculpture,P} from './signatureModels.ts';
import {grip as baseGrip,bore,scope} from './signatureGunModels.ts';

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
function mixtape(s:Sculpture){
 grip(s);s.box([1.18,.39,.31],[-.03,.31,0],s.coat);
 s.box([.97,.10,.24],[.02,.08,0],s.dark);
 for(const side of[-1,1]){
  s.box([.89,.245,.018],[-.04,.32,side*.163],s.dark);
  for(const x of[-.27,.20]){
   s.ring(.088,.016,[x,.33,side*.185],s.pearl);s.sphere(.021,[x,.33,side*.19],s.metal,[1,1,.4]);
   for(let i=0;i<3;i++){const t=i/3*Math.PI*2;s.rod([x,.33,side*.19],[x+Math.cos(t)*.055,.33+Math.sin(t)*.055,side*.19],.008,s.metal);}
  }
  s.box([.14,.045,.016],[-.03,.22,side*.182],s.glow);
  s.outline([[-.60,.38,side*.11],[-1.18,.43,side*.11],[-1.18,.12,side*.11],[-.60,.16,side*.11]],.027,s.metal,'stock');
  for(let i=0;i<3;i++)s.box([.035,.026,.019],[.30+i*.07,.13,side*.17],i===0?s.glow:s.pearl);
 }
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
function sabre(s:Sculpture){
 s.grip([-.66,0,0],[-.15,0,0],.061);s.sphere(.073,[-.68,0,0],s.metal,[.7,1,1]);
 s.plate([[.01,-.06],[.32,-.08],[.74,-.02],[1.15,.15],[1.52,.40],[1.34,.11],[.97,-.13],[.45,-.23],[.05,-.18]],.036,[0,0,0],s.metal,'body',.005,true);
 for(const side of[-1,1])s.outline([[.08,-.09,side*.025],[.48,-.13,side*.025],[.95,-.04,side*.025],[1.37,.24,side*.025]],.008,s.coat);
 // A knuckle bow connects the guard to the pommel; no broad butterfly wings.
 s.outline([[-.09,.16,0],[-.22,.23,0],[-.54,.22,0],[-.72,.04,0]],.027,s.metal);
 s.plate([[-.15,-.19],[-.06,-.16],[.01,.03],[-.06,.18],[-.16,.20]],.07,[0,0,0]);
 s.sphere(.045,[-.10,.03,0],s.glow,[1,1,1]);
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
function reliquary(s:Sculpture){
 s.rod([-1.38,0,0],[.52,0,0],.052,s.metal);s.grip([-1.22,0,0],[-.51,0,0],.063);
 s.sphere(.086,[-1.34,0,0],s.coat,[.75,1,1]);
 s.mesh(new THREE.CylinderGeometry(.37,.37,.46,8),s.dark,[.48,.04,0],'body',[Math.PI/2,0,0]);
 for(const side of[-1,1]){
  const frame:P[]=Array.from({length:8},(_,i)=>{const t=(i+.5)/8*Math.PI*2;return[.48+Math.cos(t)*.40,.04+Math.sin(t)*.40];});
  s.plate(frame,.035,[0,0,side*.245],s.metal);
  s.plate(frame.map(([x,y])=>[.48+(x-.48)*.83,.04+(y-.04)*.83]as P),.038,[0,0,side*.27],s.coat);
  s.plate([[.33,-.17],[.33,.12],[.48,.30],[.63,.12],[.63,-.17]],.016,[0,0,side*.298],s.metal);
  s.plate([[.37,-.13],[.37,.10],[.48,.24],[.59,.10],[.59,-.13]],.019,[0,0,side*.311],s.glow);
  s.rod([.48,-.13,side*.326],[.48,.23,side*.326],.010,s.metal);
  s.rod([.37,.05,side*.326],[.59,.05,side*.326],.010,s.metal);
 }
 for(let i=0;i<8;i++){const t=(i+.5)/8*Math.PI*2;s.rod([.48+Math.cos(t)*.37,.04+Math.sin(t)*.37,-.25],[.48+Math.cos(t)*.37,.04+Math.sin(t)*.37,.25],.021,s.metal);}
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
