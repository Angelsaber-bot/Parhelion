/** Four original gun identities. Large forms first, mechanical joints second,
 * fine relief last. Shared helpers only cover functional grip and bore details. */
import * as THREE from 'three';
import type {Sculpture,P} from './signatureModels.ts';
import {finishClock} from './weaponFinishes.ts';

export function grip(s:Sculpture){
 const [x,y,z]=s.def.grip;
 s.grip([x+.055,y+.24,z],[x-.045,y-.23,z],.075);
 s.outline([[x+.07,y+.17,-.025],[x+.34,y+.17,-.025],[x+.34,y-.08,-.025],[x+.06,y-.11,-.025]],.019,s.metal);
 s.rod([x+.18,y+.14,0],[x+.16,y-.005,0],.014,s.metal);
}
/** Open lathed bore: a real dark recess, never a bright cap over the muzzle. */
export function bore(s:Sculpture,start:number,end:number,y:number,r:number,m:THREE.Material=s.metal){
 const profile=[[r,start],[r,end-.018],[r*.88,end],[r*.64,end],[r*.64,end-.11]];
 const g=new THREE.LatheGeometry(profile.map(([radius,x])=>new THREE.Vector2(radius,x)),24);g.rotateZ(-Math.PI/2);
 s.mesh(g,m,[0,y,0]);s.ring(r*.83,.012,[end-.009,y,0],s.dark,'body','x');
}
export function scope(s:Sculpture,r=.10){
 const [x,y,z]=s.def.sight!;
 s.box([.22,.14,.20],[x+.12,y-.21,z],s.dark,'optic');
 for(const at of[x+.04,x+.21])s.rod([at,y-.35,z],[at,y-.09,z],.027,s.metal,'optic');
 const a=x-.12,b=x+.68;
 const profile=[[r*1.22,a],[r*1.3,a+.035],[r,a+.10],[r,b-.10],[r*1.25,b-.035],[r*1.25,b],[r*.77,b],[r*.77,a]];
 const g=new THREE.LatheGeometry(profile.map(([radius,x])=>new THREE.Vector2(radius,x)),28);g.rotateZ(-Math.PI/2);
 s.mesh(g,s.dark,[0,y,z],'optic');
 for(const at of[a+.035,a+.16,b-.12,b-.025])s.ring(r*1.13,.012,[at,y,z],s.metal,'optic','x');
 for(let i=0;i<16;i++){const t=i/16*Math.PI*2,cy=y+Math.cos(t)*r*1.32,cz=z+Math.sin(t)*r*1.32;s.rod([a+.017,cy,cz],[a+.052,cy,cz],.0035,s.metal,'optic',.0035,6);}
 s.box([.12,.045,.12],[x+.30,y+r+.015,z],s.metal,'optic');
}
function gear(s:Sculpture,x:number,y:number,z:number,r:number,teeth:number,m:THREE.Material=s.metal,depth=.018){
 const points:P[]=[];
 for(let i=0;i<teeth*4;i++){const t=(i/(teeth*4))*Math.PI*2,rad=i%4===1||i%4===2?r:r*.86;points.push([Math.cos(t)*rad,Math.sin(t)*rad]);}
 s.plate(points,depth,[x,y,z],m,'body',.002);
}
function screws(s:Sculpture,points:readonly P[],z=.18){
 for(const side of[-1,1])for(const [x,y]of points){s.sphere(.019,[x,y,side*z],s.metal,[1,1,.3]);s.rod([x-.008,y,side*(z+.007)],[x+.008,y,side*(z+.007)],.003,s.dark);}
}
function energyCore(s:Sculpture){
 const m=s.glow.clone();m.name='Sculpt_core';m.color.setHex(0x7361c2);m.emissive.setHex(0x7f66ca);m.emissiveIntensity=.4;m.iridescence=.7;m.roughness=.19;
 m.customProgramCacheKey=()=> 'graviton-depth-core-v1';
 m.onBeforeCompile=shader=>{
  shader.uniforms.phCoreTime=finishClock;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 phCorePosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nphCorePosition=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 phCorePosition;uniform float phCoreTime;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 coreP=phCorePosition-vec3(.015,.31,0.0);
   float spiral=sin(atan(coreP.y,coreP.x)*3.0+length(coreP.xy)*20.0-phCoreTime*.38);
   float strata=.5+.5*sin(coreP.y*45.0+coreP.z*16.0+spiral*.7);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.67,.78,1.0),pow(strata,5.0)*.42);`);
 };
 return m;
}

export function gravitonRifle(s:Sculpture){
 s.coat.color.setHex(0xabb5cc);s.coat.roughness=.30;
 grip(s);
 // Open receiver with a nested three-axis reactor; armor never covers its core.
 s.box([1.48,.075,.27],[.08,.57,0],s.dark);
 for(const side of[-1,1])s.outline([[-.58,.612,side*.095],[-.21,.612,side*.095],[.55,.612,side*.095]],.0065,s.metal);
 for(let i=0;i<6;i++)s.box([.032,.010,.13],[-.48+i*.18,.613,0],i%3===0?s.glow:s.dark,'body',.002);
 s.plate([[-.76,.09],[-.53,.22],[-.20,.13],[.44,.13],[.74,.25],[1.02,.16],[.88,.015],[-.47,-.015]],.24,[0,0,0]);
 s.box([1.37,.075,.22],[.13,.055,0],s.metal);
 for(const side of[-1,1]){
  s.plate([[-.69,.48],[-.34,.56],[-.17,.51],[-.29,.40],[-.61,.35]],.065,[0,0,side*.13]);
  s.plate([[.31,.52],[.89,.53],[1.18,.41],[1.28,.27],[.88,.31],[.57,.41]],.065,[0,0,side*.13]);
  s.outline([[.38,.46,side*.17],[.86,.46,side*.17],[1.11,.35,side*.17]],.010,s.glow);
  s.outline([[-.61,.36,side*.18],[-.44,.41,side*.18],[-.30,.40,side*.18]],.008,s.metal);
  s.plate([[.58,.49],[.91,.46],[1.08,.37],[.74,.41]],.009,[0,0,side*.17],s.dark,'body',.003);
  for(let i=0;i<4;i++)s.rod([.69+i*.08,.446-i*.016,side*.18],[.73+i*.08,.422-i*.016,side*.18],.004,s.metal);
  s.plate([[-1.31,.26],[-1.28,.43],[-1.11,.42],[-.91,.35]],.009,[0,0,side*.106],s.dark,'stock',.003);
 }
 s.sphere(.165,[.015,.31,0],energyCore(s));
 const gyros=[s.ring(.214,.015,[.015,.31,0],s.metal),s.ring(.248,.012,[.015,.31,0],s.coat),s.ring(.204,.012,[.015,.31,0],s.metal)];
 gyros[0].rotation.x=.38;gyros[1].rotation.y=.63;gyros[2].rotation.set(.76,-.58,.22);
 for(const side of[-1,1]){s.sphere(.034,[.015,.31,side*.235],s.metal);s.sphere(.017,[.015,.31,side*.261],s.glow);}
 s.plate([[-1.40,.14],[-1.38,.48],[-1.18,.51],[-.66,.38],[-.66,.24],[-1.05,.30],[-1.23,.14]],.19,[0,0,0],s.coat,'stock');
 s.outline([[-1.29,.17,0],[-1.06,.08,0],[-.71,.13,0]],.036,s.metal,'stock');
 s.box([.075,.31,.23],[-1.38,.29,0],s.soft,'stock');
 s.plate([[.10,.06],[.39,.06],[.45,-.46],[.27,-.61],[.10,-.53]],.19,[0,0,0],s.dark,'magazine');
 for(const side of[-1,1])for(let i=0;i<4;i++)s.box([.041,.32-i*.018,.016],[.15+i*.067,-.27,side*.107],i%2?s.metal:s.glow,'magazine',.008);
 s.rod([.43,.29,0],[1.56,.29,0],.056,s.dark);
 for(const x of[.82,1.10,1.37]){s.ring(.096,.018,[x,.29,0],s.coat,'body','x');for(const z of[-.075,.075])s.box([.32,.028,.025],[x-.08,.29,z],s.metal);}
 bore(s,1.52,1.887,.29,.092);
 for(let i=0;i<8;i++){const t=i/8*Math.PI*2;s.rod([1.57,.29+Math.cos(t)*.094,Math.sin(t)*.094],[1.75,.29+Math.cos(t)*.094,Math.sin(t)*.094],.007,s.dark);}
 s.box([.23,.06,.055],[-.48,.51,-.19],s.metal,'bolt');s.gunSight();
 screws(s,[[-.53,.44],[.57,.45],[.97,.38]]);
}

export function koiSmg(s:Sculpture){
 grip(s);
 s.sphere(.32,[-.02,.31,0],s.coat,[2,.76,.66]);
 s.plate([[-.64,.24],[-.48,.47],[.12,.53],[.62,.45],[.85,.32],[.69,.17],[.06,.10],[-.41,.13]],.29,[0,0,0],s.coat,'body',.013,true);
 // Broad porcelain patches and raised overlapping scales belong to the shell.
 for(const side of[-1,1]){
  s.plate([[-.48,.28],[-.32,.46],[-.08,.45],[.04,.32],[-.17,.26]],.013,[0,0,side*.168],s.glow,'body',.008,true);
  s.plate([[.31,.41],[.59,.43],[.77,.32],[.63,.24],[.43,.27]],.018,[0,0,side*.16],s.glow,'body',.008,true);
  for(let row=0;row<2;row++)for(let i=0;i<4;i++){const x=-.06+i*.105+row*.04,y=.27+row*.072;s.outline([[x,y,side*.177],[x+.045,y-.035,side*.19],[x+.09,y,side*.177]],.0055,s.metal);}
  for(let row=0;row<2;row++)for(let i=0;i<4;i++){
   const x=-.09+i*.105+row*.045,y=.29+row*.077;
   const z=Math.max(.15,.211*Math.sqrt(Math.max(0,1-((x+.02)/.64)**2-((y-.31)/.243)**2)))+.012;
   s.plate([[-.041,.025],[0,.041],[.041,.025],[.036,-.012],[0,-.038],[-.036,-.012]],.011,[x,y,side*z],(i+row)%3===0?s.glow:s.pearl,'body',.003);
  }
  s.sphere(.030,[.64,.385,side*.168],s.dark,[1,1,.35]);s.sphere(.008,[.63,.396,side*.18],s.pearl,[1,1,.5]);
  s.outline([[-.52,.16,side*.17],[-.04,.15,side*.19],[.45,.20,side*.17]],.008,s.metal);
  s.plate([[.05,.13],[.27,.13],[.39,-.015],[.22,.045]],.012,[0,0,side*.08],s.glow,'body',.004,true);
 }
 s.plate([[-.67,.32],[-1.20,.55],[-1.12,.28],[-1.20,.03],[-.65,.20]],.15,[0,0,0],s.coat,'stock',.009,true);
 for(const side of[-1,1])for(let i=0;i<3;i++)s.outline([[-.72,.28,side*.08],[-1.09,.11+i*.16,side*.09]],.012,i===1?s.metal:s.glow,'stock');
 s.plate([[-.23,.49],[-.04,.67],[.21,.62],[.39,.49]],.055,[0,0,0],s.glow,'body',.006,true);
 for(const side of[-1,1])for(let i=0;i<4;i++)s.rod([-.12+i*.1,.515,side*.035],[-.06+i*.09,.59,side*.035],.006,s.metal);
 s.plate([[.06,.12],[.31,.10],[.41,-.40],[.28,-.48],[.07,-.42]],.18,[0,0,0],s.dark,'magazine',.009);
 for(const side of[-1,1])s.plate([[.12,.01],[.25,-.01],[.31,-.36],[.16,-.36]],.012,[0,0,side*.103],s.glow,'magazine',.006,true);
 s.grip([.70,.05,0],[.70,-.25,0],.058,'fore_end');s.box([.12,.10,.11],[.70,.07,0],s.dark,'fore_end',.02);
 s.rod([.64,.31,0],[.97,.31,0],.060,s.dark);bore(s,.94,1.267,.31,.094);
 s.ring(.10,.016,[1.00,.31,0],s.coat,'body','x');s.box([.18,.05,.05],[-.32,.49,-.19],s.metal,'bolt');s.gunSight();
}

export function owlMarksman(s:Sculpture){
 grip(s);
 s.plate([[-.84,.20],[-.61,.47],[.13,.50],[.74,.40],[1.13,.30],[.72,.15],[-.39,.12]],.28,[0,0,0],s.dark,'body',.012);
 s.plate([[-1.49,.16],[-1.43,.45],[-1.08,.48],[-.57,.34],[-.56,.20],[-1.13,.29],[-1.26,.10]],.21,[0,0,0],s.coat,'stock',.011,true);
 s.box([.08,.31,.25],[-1.45,.28,0],s.soft,'stock');
 for(const side of[-1,1]){
  // Layered blade-feathers are actual stepped plates with silver beveled edges.
  for(let i=0;i<5;i++){const x=.03+i*.17,y=.45-i*.025;
   const feather:P[]=[[x-.20,y],[x+.25,y-.035],[x+.34,y-.20],[x+.09,y-.15]];
   s.plate(feather,.027,[0,0,side*(.157+i*.002)],s.metal,'body',.006);
   s.plate(feather.map(([a,b])=>[a+.018,b-.010]as P),.017,[0,0,side*(.179+i*.002)],s.coat,'body',.003);
   s.outline([[x-.08,y-.035,side*.20],[x+.16,y-.07,side*.20],[x+.27,y-.16,side*.20]],.006,s.metal);
  }
  s.plate([[-.76,.36],[-.56,.49],[-.37,.43],[-.21,.49],[-.10,.34],[-.43,.20]],.026,[0,0,side*.168],s.metal,'body',.006,true);
  for(const x of[-.56,-.27]){s.sphere(.067,[x,.36,side*.19],s.dark,[1.1,.9,.25]);const gem=s.mesh(new THREE.OctahedronGeometry(.043),s.glow,[x,.36,side*.209]);gem.scale.set(1,.85,.35);s.sphere(.012,[x,.36,side*.227],s.dark,[.4,1,.3]);}
  s.plate([[-.76,.42],[-.73,.55],[-.49,.43],[-.40,.40],[-.29,.45],[-.12,.53],[-.11,.40],[-.39,.34]],.018,[0,0,side*.22],s.coat,'body',.004);
  s.plate([[-.43,.32],[-.37,.30],[-.42,.21],[-.47,.30]],.016,[0,0,side*.207],s.metal);
  s.outline([[-1.32,.35,side*.12],[-1.05,.39,side*.12],[-.81,.30,side*.12]],.009,s.metal,'stock');
 }
 s.plate([[.12,.12],[.36,.11],[.36,-.28],[.17,-.34],[.09,-.20]],.18,[0,0,0],s.coat,'magazine');
 for(const side of[-1,1])s.outline([[.17,.04,side*.10],[.24,-.23,side*.11],[.31,.01,side*.10]],.008,s.metal,'magazine');
 s.rod([.62,.33,0],[1.50,.33,0],.048,s.dark);bore(s,1.47,1.817,.33,.073);
 for(const x of[.86,1.14,1.43])s.ring(.073,.013,[x,.33,0],s.metal,'body','x');
 for(let i=0;i<4;i++)s.plate([[-.06,0],[.065,.018],[.12,-.012],[-.01,-.024]],.16,[-.63+i*.19,.53,0],s.metal,'body',.004);
 s.box([.28,.055,.055],[-.43,.51,-.20],s.metal,'bolt');scope(s,.087);
}

export function clockSniper(s:Sculpture){
 grip(s);
 const contour:P[]=[[-.86,.12],[-.72,.46],[.40,.48],[1.08,.35],[1.27,.23],[.81,.10],[-.37,.05]],shape=new THREE.Shape();
 shape.moveTo(...contour[0]);for(const p of contour.slice(1))shape.lineTo(...p);shape.closePath();
 const window=new THREE.Path();window.absellipse(.43,.285,.405,.155,0,Math.PI*2,false);shape.holes.push(window);
 const receiver=new THREE.ExtrudeGeometry(shape,{depth:.25,steps:1,bevelEnabled:true,bevelThickness:.009,bevelSize:.009,bevelSegments:2});receiver.translate(0,0,-.125);s.mesh(receiver,s.coat);
 s.rod([.05,.18,0],[.80,.18,0],.021,s.dark);s.rod([.10,.40,0],[.74,.40,0],.018,s.metal);
 s.plate([[-1.65,.13],[-1.59,.47],[-1.23,.52],[-.73,.33],[-.73,.16],[-1.28,.26],[-1.48,.10]],.20,[0,0,0],s.coat,'stock',.012,true);
 s.box([.075,.31,.24],[-1.61,.28,0],s.soft,'stock');
 for(const side of[-1,1]){
  // Open escapement and an enamel dial, rather than a printed clock decal.
  gear(s,-.22,.30,side*.154,.265,24,s.metal,.021);
  s.mesh(new THREE.CylinderGeometry(.214,.214,.016,36),s.pearl,[-.22,.30,side*.180],'body',[Math.PI/2,0,0]);
  s.ring(.224,.014,[-.22,.30,side*.191],s.metal);
  for(let i=0;i<12;i++){const t=i/12*Math.PI*2;s.rod([-.22+Math.sin(t)*.172,.30+Math.cos(t)*.172,side*.196],[-.22+Math.sin(t)*.198,.30+Math.cos(t)*.198,side*.196],i%3===0?.008:.004,s.dark);}
  s.rod([-.22,.30,side*.201],[-.16,.425,side*.201],.009,s.dark);s.rod([-.22,.30,side*.205],[-.35,.345,side*.205],.007,s.metal);s.sphere(.020,[-.22,.30,side*.211],s.glow,[1,1,.38]);
  for(const [x,y,r]of [[.20,.26,.095],[.40,.35,.13],[.66,.25,.095]]){gear(s,x,y,side*.153,r,12,s.metal,.017);s.ring(r*.48,.009,[x,y,side*.169],s.dark);s.sphere(.018,[x,y,side*.18],s.glow,[1,1,.4]);s.rod([x,y,0],[x,y,side*.17],.022,s.dark);}
  s.outline([[-1.46,.35,side*.116],[-1.22,.40,side*.116],[-.92,.29,side*.116]],.010,s.metal,'stock');
  s.outline([[.74,.15,side*.16],[1.03,.22,side*.16],[1.19,.28,side*.12]],.009,s.metal);
 }
 s.plate([[-.03,.04],[.24,.04],[.26,-.27],[.06,-.34],[-.05,-.22]],.19,[0,0,0],s.dark,'magazine');
 for(const side of[-1,1])s.box([.17,.19,.016],[.105,-.13,side*.105],s.metal,'magazine',.008);
 s.rod([.70,.29,0],[2.15,.29,0],.049,s.dark);
 for(const z of[-.055,.055])s.outline([[.86,.29,z],[1.48,.34,z],[2.12,.29,z]],.012,s.metal);
 for(const x of[1.15,1.55,1.94])s.ring(.076,.012,[x,.29,0],s.metal,'body','x');
 bore(s,2.12,2.417,.29,.082);
 s.rod([-.63,.44,-.14],[-.69,.25,-.25],.023,s.metal,'bolt');s.sphere(.045,[-.69,.25,-.25],s.dark,[1,1,1],'bolt');
 scope(s,.108);
 for(const side of[-1,1])s.outline([[-.77,.61,side*.12],[-.48,.53,side*.16],[-.17,.61,side*.12]],.012,s.metal,'optic');
 screws(s,[[.81,.27]],.14);screws(s,[[-1.32,.32]],.115);
}
