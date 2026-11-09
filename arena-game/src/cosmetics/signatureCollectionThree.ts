/** Third sculpted collection: six gun silhouettes built around one moving
 * mechanism each (coil, drum, pistons, rotor, accelerator rings). Spinning
 * parts are rigid groups on the barrel axis; `signatureMotion.ts` turns them.
 * Coordinates are +X forward, +Y up, raw registry sockets. */
import * as THREE from 'three';
import type {Sculpture,P,V} from './signatureModels.ts';
import {grip as baseGrip,bore,scope} from './signatureGunModels.ts';

export const THIRD_COLLECTION_MODELS=['tesla','lantern','bastion','scabbard','rotor','railgun'] as const;
export type ThirdCollectionModel=typeof THIRD_COLLECTION_MODELS[number];

export function grip(s:Sculpture){
 baseGrip(s);
 const [x,y,z]=s.def.grip;s.box([.15,.24,.14],[x+.03,y+.28,z],s.dark);
}
export function tube(s:Sculpture,points:readonly V[],r:number,m:THREE.Material,role='body',segments=96,closed=false){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed);
 return s.mesh(new THREE.TubeGeometry(curve,segments,r,7,closed),m,[0,0,0],role);
}
/** Turned part along +X: profile is [radius, x] pairs. */
export function lathe(s:Sculpture,profile:readonly P[],y:number,m:THREE.Material,role='body',segments=28,z=0){
 const g=new THREE.LatheGeometry(profile.map(([r,x])=>new THREE.Vector2(r,x)),segments);g.rotateZ(-Math.PI/2);
 return s.mesh(g,m,[0,y,z],role);
}
/** Flat extrusion with real openings, for skeleton stocks, vents and the tsuba. */
export function cutPlate(s:Sculpture,contour:readonly P[],holes:readonly(readonly P[])[],depth:number,p:V,m:THREE.Material,role='body',bevel=.006){
 const shape=new THREE.Shape(contour.map(([x,y])=>new THREE.Vector2(x,y)));
 for(const hole of holes)shape.holes.push(new THREE.Path(hole.map(([x,y])=>new THREE.Vector2(x,y))));
 const g=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:16});g.translate(0,0,-depth/2);
 return s.mesh(g,m,p,role);
}
export function glass(s:Sculpture,tint:number){
 const m=new THREE.MeshPhysicalMaterial({name:'Sculpt_glass',color:tint,metalness:0,roughness:.06,clearcoat:1,clearcoatRoughness:.05,transparent:true,opacity:.32,depthWrite:false});
 m.userData.finish=s.style.id;return m;
}
export function rect(x:number,y:number,w:number,h:number):P[]{return[[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]];}
/** Small details do not need the 24×16 sculpture sphere or 8×40 torus. */
export function dot(s:Sculpture,r:number,p:V,m:THREE.Material,scale:V=[1,1,1],role='body'){const mesh=s.mesh(new THREE.SphereGeometry(r,10,8),m,p,role);mesh.scale.fromArray(scale);return mesh;}
export function band(s:Sculpture,r:number,t:number,p:V,m:THREE.Material,role='body'){return s.mesh(new THREE.TorusGeometry(r,t,5,20),m,p,role,[0,Math.PI/2,0]);}
export function rivets(s:Sculpture,points:readonly P[],z:number,role='body'){
 for(const side of[-1,1])for(const [x,y]of points)dot(s,.017,[x,y,side*z],s.metal,[1,1,.4],role);
}

/** 雷鸣回路 — the copper coil turns around a glowing core; the crown of
 * electrodes surrounds an open bore. */
function stormcoil(s:Sculpture){
 grip(s);
 const glassTube=glass(s,0xcff6ff);
 s.plate([[-.80,.12],[-.72,.50],[-.34,.56],[.50,.52],[.66,.40],[.62,.15],[.30,.06],[-.42,.04]],.26,[0,0,0],s.coat,'body',.012);
 s.box([1.02,.06,.16],[-.16,.575,0],s.dark);
 for(let i=0;i<8;i++)s.box([.03,.014,.172],[-.60+i*.125,.606,0],s.metal,'body',.002);
 for(const side of[-1,1]){
  // Circuit traces with solder nodes; straight segments keep the corners crisp.
  const traces:P[][]=[[[-.66,.21],[-.40,.21],[-.32,.29],[.04,.29],[.12,.21],[.46,.21]],[[-.58,.13],[-.16,.13],[-.08,.19]],[[.20,.40],[.30,.32],[.52,.32]]];
  for(const line of traces){for(let i=1;i<line.length;i++)s.rod([line[i-1][0],line[i-1][1],side*.146],[line[i][0],line[i][1],side*.146],.0055,s.glow);for(const [x,y]of[line[0],line[line.length-1]])dot(s,.015,[x,y,side*.147],s.metal,[1,1,.35]);}
  // Capacitor tubes: glass envelope, lit filament and copper end caps.
  s.rod([-.56,.43,side*.17],[.30,.43,side*.17],.042,glassTube);
  s.rod([-.52,.43,side*.17],[.26,.43,side*.17],.011,s.glow);
  for(let i=0;i<7;i++){const x=-.48+i*.12;band(s,.016,.004,[x,.43,side*.17],s.metal);}
  for(const x of[-.58,.32])s.rod([x-.03,.43,side*.17],[x+.03,.43,side*.17],.05,s.metal);
  for(const x of[-.40,.14])s.box([.03,.07,.05],[x,.40,side*.15],s.dark,'body',.006);
  s.plate([[.36,.46],[.58,.46],[.62,.40],[.40,.40]],.012,[0,0,side*.142],s.metal,'body',.004);
 }
 // Barrel core, guard cage and the rotating coil.
 s.rod([.55,.29,0],[1.56,.29,0],.048,s.dark);
 s.rod([.64,.29,0],[1.30,.29,0],.060,s.glow);
 for(const x of[.60,1.34]){s.ring(.112,.024,[x,.29,0],s.metal,'body','x');s.rod([x-.025,.29,0],[x+.025,.29,0],.10,s.dark);}
 for(let i=0;i<4;i++){const t=(i+.5)/4*Math.PI*2;s.rod([.60,.29+Math.cos(t)*.128,Math.sin(t)*.128],[1.34,.29+Math.cos(t)*.128,Math.sin(t)*.128],.009,s.dark);}
 s.spin('coil',[.97,.29,0],2.4,5);
 const turns=11,coil:V[]=Array.from({length:turns*16+1},(_,i)=>{const t=i/(turns*16),a=t*Math.PI*2*turns;return[.64+t*.66,.29+Math.cos(a)*.088,Math.sin(a)*.088];});
 tube(s,coil,.0125,s.metal,'coil',turns*18);
 for(const x of[.66,1.28])s.ring(.088,.016,[x,.29,0],s.metal,'coil','x');
 // Handguard and support grip below the coil.
 s.box([.74,.07,.15],[.97,.145,0],s.dark);
 s.grip([.86,.11,0],[.86,-.12,0],.048);
 // Muzzle collar, open bore and a crown of four electrodes.
 s.rod([1.34,.29,0],[1.56,.29,0],.078,s.coat);
 bore(s,1.50,1.887,.29,.068);
 for(const [dy,dz,len]of[[1,0,1],[-1,0,1],[0,1,.78],[0,-1,.78]]as const){
  const at=(r:number):V=>[0,.29+dy*r,dz*r];
  const p0=at(.07),p1=at(.15),p2=at(.165),p3=at(.10);
  const tip:V=[1.58+.36*len,p3[1],p3[2]];
  tube(s,[[1.42,p0[1],p0[2]],[1.58,p1[1],p1[2]],[1.58+.2*len,p2[1],p2[2]],tip],.02,s.metal,'body',24);
  dot(s,.03,tip,s.glow);
 }
 // Skeletal stock with a third capacitor and a cheek rest.
 for(const side of[-1,1])tube(s,[[-.78,.44,side*.06],[-1.06,.48,side*.06],[-1.36,.46,side*.06],[-1.40,.22,side*.06],[-1.30,.14,side*.06],[-1.02,.21,side*.06],[-.78,.18,side*.06]],.019,s.metal,'stock',48);
 s.box([.07,.34,.20],[-1.40,.30,0],s.soft,'stock');
 s.rod([-1.30,.32,0],[-.84,.32,0],.048,glassTube,'stock');s.rod([-1.26,.32,0],[-.88,.32,0],.012,s.glow,'stock');
 for(const x of[-1.32,-.82])s.rod([x-.03,.32,0],[x+.03,.32,0],.056,s.metal,'stock');
 s.plate([[-1.30,.43],[-.88,.48],[-.82,.43],[-1.26,.40]],.11,[0,0,0],s.coat,'stock',.008);
 // Battery magazine with lit cell windows.
 s.plate([[.08,.06],[.34,.06],[.40,-.40],[.18,-.44],[.05,-.04]],.17,[0,0,0],s.dark,'magazine',.01);
 for(const side of[-1,1]){for(let i=0;i<3;i++)s.box([.05,.07,.012],[.17+i*.065,-.08-i*.09,side*.092],s.glow,'magazine',.004);s.box([.24,.016,.012],[.24,-.30,side*.093],s.metal,'magazine',.003);}
 s.box([.22,.05,.05],[-.46,.48,-.17],s.metal,'bolt');s.gunSight();
 rivets(s,[[-.62,.44],[.44,.16]],.143);
}

/** 守灯人 — six lit shells in an open revolving drum, a brass bell mouth. */
function lanternWarden(s:Sculpture){
 grip(s);
 // Rear block, front block and straps frame the drum; its top chamber lines up with the bore.
 s.plate([[-.80,.10],[-.74,.46],[-.56,.60],[-.20,.60],[-.20,.00],[-.46,.00]],.27,[0,0,0],s.coat,'body',.012);
 s.plate([[.22,.00],[.22,.46],[.40,.46],[.48,.38],[.48,.10],[.40,.00]],.26,[0,0,0],s.coat,'body',.012);
 s.box([.48,.05,.16],[.01,.425,0],s.dark);s.box([.48,.05,.16],[.01,-.035,0],s.dark);
 s.box([.13,.04,.11],[-.306,.62,0],s.dark);
 for(const side of[-1,1]){
  // Brass scrollwork: two opposed volutes per block.
  for(const [cx,cy,r,turn]of[[-.62,.30,.10,1],[-.40,.20,.07,-1],[.35,.24,.07,1]]as const){
   const curl:V[]=Array.from({length:40},(_,i)=>{const t=i/39,a=turn*(t*Math.PI*3.2),rr=r*(1-t*.82);return[cx+Math.cos(a)*rr,cy+Math.sin(a)*rr,side*.147];});
   tube(s,curl,.0085,s.metal,'body',60);
  }
  tube(s,[[-.74,.45,side*.147],[-.55,.53,side*.147],[-.30,.55,side*.147]],.008,s.metal,'body',24);
  s.sphere(.03,[-.28,.30,side*.15],s.metal,[1,1,.4]);
 }
 // The drum: brass end plates, iron bars and six glowing shells around an axle.
 const axis=.19;s.spin('drum',[.02,axis,0],.35,14);
 for(const x of[-.17,.19]){s.mesh(new THREE.CylinderGeometry(.19,.19,.03,32),s.metal,[x,axis,0],'drum',[0,0,Math.PI/2]);s.ring(.165,.009,[x+(x<0?-.016:.016),axis,0],s.dark,'drum','x');}
 s.rod([-.21,axis,0],[.23,axis,0],.045,s.dark,'drum');
 for(let i=0;i<6;i++){
  const a=i/6*Math.PI*2,b=a+Math.PI/6,cy=axis+Math.cos(a)*.12,cz=Math.sin(a)*.12;
  s.rod([-.14,cy,cz],[.16,cy,cz],.046,s.glow,'drum');
  s.rod([-.165,cy,cz],[-.12,cy,cz],.052,s.metal,'drum');
  s.rod([-.16,axis+Math.cos(b)*.172,Math.sin(b)*.172],[.18,axis+Math.cos(b)*.172,Math.sin(b)*.172],.016,s.coat,'drum');
 }
 // Barrel with brass bands and a flared bell mouth that keeps an open bore.
 s.rod([.40,.31,0],[1.46,.31,0],.07,s.dark);
 for(const x of[.62,.98,1.30])s.ring(.078,.016,[x,.31,0],s.metal,'body','x');
 lathe(s,[[.078,1.40],[.086,1.55],[.11,1.68],[.158,1.758],[.164,1.773],[.128,1.773],[.10,1.71],[.074,1.62],[.062,1.50]],.31,s.metal,'body',32);
 lathe(s,[[.062,1.40],[.060,1.70]],.31,s.dark,'body',20);
 // Pump fore-end over the tube magazine.
 s.rod([.40,.17,0],[1.30,.17,0],.045,s.dark);
 s.rod([.62,.17,0],[1.04,.17,0],.086,s.coat,'fore_end');
 for(let i=0;i<6;i++)band(s,.087,.008,[.68+i*.065,.17,0],s.metal,'fore_end');
 for(const x of[.60,1.06])s.ring(.088,.016,[x,.17,0],s.metal,'fore_end','x');
 // Carved stock with a brass butt plate and a matching scroll.
 s.plate([[-1.45,.06],[-1.45,.42],[-1.20,.47],[-.78,.38],[-.78,.16],[-1.15,.18]],.22,[0,0,0],s.coat,'stock',.012);
 s.box([.04,.39,.235],[-1.465,.24,0],s.metal,'stock',.012);
 for(const side of[-1,1]){
  const curl:V[]=Array.from({length:40},(_,i)=>{const t=i/39,a=t*Math.PI*3,rr=.09*(1-t*.8);return[-1.12+Math.cos(a)*rr,.30+Math.sin(a)*rr,side*.123];});
  tube(s,curl,.008,s.metal,'stock',60);
  tube(s,[[-1.40,.40,side*.123],[-1.10,.41,side*.123],[-.84,.33,side*.123]],.007,s.metal,'stock',24);
 }
 s.box([.22,.05,.05],[-.44,.48,-.16],s.metal,'bolt');s.gunSight();
}

/** 铁壁重铳 — armored over-under barrels; pistons on the pump slide into
 * receiver cylinders when the fore-end cycles. */
function bastion(s:Sculpture){
 grip(s);
 s.plate([[-.82,.10],[-.78,.50],[-.55,.60],[.32,.60],[.48,.48],[.48,.08],[-.30,.02]],.30,[0,0,0],s.coat,'body',.014);
 s.box([.14,.05,.12],[-.306,.62,0],s.dark);
 for(const side of[-1,1]){
  s.plate([[-.62,.18],[-.57,.47],[.20,.47],[.30,.32],[.20,.18]],.014,[0,0,side*.162],s.dark,'body',.004);
  s.plate([[-.50,.24],[-.46,.41],[.08,.41],[.16,.32],[.08,.24]],.012,[0,0,side*.174],s.coat,'body',.004);
  s.rod([-.44,.325,side*.183],[.06,.325,side*.183],.006,s.glow);
  // Warning chevrons along the lower armor edge.
  for(let i=0;i<7;i++){const x=-.62+i*.12;s.plate([[x,.07],[x+.05,.07],[x+.10,.15],[x+.05,.15]],.01,[0,0,side*.161],s.dark,'body',.002);}
  for(let i=0;i<3;i++)s.box([.035,.035,.012],[.26,.40-i*.06,side*.176],s.glow,'body',.006);
  // Side-saddle shells.
  if(side<0)for(let i=0;i<4;i++){const x=-.52+i*.11;s.rod([x,.25,side*.19],[x,.40,side*.19],.032,s.glow);s.rod([x,.235,side*.19],[x,.26,side*.19],.035,s.metal);}
  // Hydraulic cylinders on the body; rods ride the pump.
  s.rod([.20,.13,side*.17],[.62,.13,side*.17],.036,s.dark);
  for(const x of[.22,.60])s.ring(.04,.009,[x,.13,side*.17],s.metal,'body','x');
  s.rod([.50,.13,side*.17],[1.02,.13,side*.17],.018,s.metal,'fore_end');
 }
 // Heat-sink spine below the optic line.
 for(let i=0;i<5;i++)s.box([.035,.06,.20],[-.08+i*.10,.63,0],s.dark,'body',.004);
 // Over-under barrels in a vented shroud.
 for(const y of[.385,.235])s.rod([.46,y,0],[1.58,y,0],.062,s.dark);
 for(const side of[-1,1]){
  cutPlate(s,[[.46,.16],[.46,.47],[1.30,.45],[1.42,.40],[1.42,.18],[1.30,.15]],[0,1,2,3,4].map(i=>rect(.62+i*.155,.31,.085,.17)),.022,[0,0,side*.098],s.coat,'body',.004);
  cutPlate(s,[[1.52,.15],[1.52,.47],[1.773,.45],[1.773,.17]],[0,1,2].map(i=>rect(1.57+i*.065,.31,.032,.20)),.03,[0,0,side*.085],s.dark,'body',.004);
 }
 s.box([.96,.03,.17],[.94,.475,0],s.metal,'body',.008);
 for(const y of[.385,.235]){bore(s,1.56,1.773,y,.07);s.ring(.074,.012,[1.48,y,0],s.metal,'body','x');}
 // Pump with a cross yoke for the piston rods.
 s.box([.52,.13,.20],[.84,.12,0],s.coat,'fore_end',.03);
 for(let i=0;i<5;i++)s.box([.035,.135,.205],[.66+i*.09,.12,0],s.dark,'fore_end',.006);
 s.box([.05,.06,.38],[1.04,.13,0],s.metal,'fore_end',.01);
 // Skeleton stock.
 cutPlate(s,[[-1.42,.08],[-1.42,.46],[-1.25,.50],[-.80,.42],[-.80,.20],[-1.10,.20],[-1.20,.08]],[[[-1.30,.20],[-1.30,.38],[-1.00,.36],[-.98,.28],[-1.14,.26]]],.24,[0,0,0],s.coat,'stock',.012);
 s.box([.07,.40,.25],[-1.44,.27,0],s.soft,'stock');
 for(const side of[-1,1])s.box([.30,.025,.012],[-1.08,.44,side*.126],s.glow,'stock',.006);
 s.box([.22,.05,.05],[-.42,.49,-.17],s.metal,'bolt');s.gunSight();
 rivets(s,[[-.70,.44],[-.70,.16],[.38,.44],[.38,.14]],.17);
}

/** 残樱刃鞘 — scabbard receiver, a cut tsuba and a blade-shaped barrel shroud. */
function sakuraPetal(x:number,y:number,a:number,size:number):P[]{
 const c=Math.cos(a),sn=Math.sin(a),pts:P[]=[[0,0],[.45,.28],[.9,.22],[1,0],[.9,-.22],[.45,-.28]];
 return pts.map(([u,v])=>[x+(u*c-v*sn)*size,y+(u*sn+v*c)*size]);
}
function blossom(s:Sculpture,x:number,y:number,z:number,size:number,role='body'){
 for(let i=0;i<5;i++)s.plate(sakuraPetal(x,y,i/5*Math.PI*2+Math.PI/2,size),.008,[0,0,z],s.glow,role,.003,true);
 dot(s,size*.22,[x,y,z+Math.sign(z)*.006],s.metal,[1,1,.4],role);
}
function scabbard(s:Sculpture){
 s.soft.color.setHex(0x2b1a22);
 grip(s);
 s.plate([[-.95,.22],[-.90,.42],[-.60,.51],[.20,.53],[.66,.48],[.80,.42],[.80,.22],[.30,.14],[-.60,.14]],.22,[0,0,0],s.coat,'body',.012,true);
 s.box([.07,.36,.255],[.80,.33,0],s.metal,'body',.025);
 s.box([.05,.30,.25],[-.93,.32,0],s.metal,'body',.02);
 for(const side of[-1,1]){
  // Maki-e branch in gold leading to two blossoms and drifting petals.
  tube(s,[[-.86,.24,side*.124],[-.62,.30,side*.125],[-.36,.36,side*.124],[-.08,.40,side*.122],[.20,.43,side*.12]],.006,s.metal,'body',40);
  tube(s,[[-.50,.33,side*.125],[-.40,.24,side*.125],[-.26,.21,side*.124]],.005,s.metal,'body',20);
  blossom(s,-.38,.37,side*.128,.05);blossom(s,.10,.40,side*.125,.036);blossom(s,-.24,.22,side*.127,.03);
  for(const [x,y,a]of[[.34,.30,.6],[.50,.38,2.1],[.62,.26,4.0],[-.70,.40,1.2]]as const)s.plate(sakuraPetal(x,y,a,.03),.006,[0,0,side*.124],s.glow,'body',.002,true);
  // Sageo cord looping from the collar.
  tube(s,[[.74,.44,side*.13],[.62,.30,side*.135],[.46,.20,side*.13],[.30,.21,side*.128],[.40,.28,side*.13],[.56,.24,side*.134]],.011,s.glow,'body',48);
 }
 // Habaki, tsuba with sakura openings, and the blade shroud with a hamon.
 s.rod([.80,.33,0],[1.68,.33,0],.045,s.dark);
 s.box([.06,.14,.12],[.88,.33,0],s.metal,'body',.015);
 const holes:P[][]=Array.from({length:5},(_,i)=>{const a=i/5*Math.PI*2+Math.PI/2,cx=Math.cos(a)*.115,cy=Math.sin(a)*.115;return Array.from({length:14},(_,k)=>{const t=k/14*Math.PI*2,u=Math.cos(t)*.042,v=Math.sin(t)*.022;return[cx+u*Math.cos(a)-v*Math.sin(a),cy+u*Math.sin(a)+v*Math.cos(a)]as P;});});
 const rim:P[]=Array.from({length:40},(_,i)=>{const t=i/40*Math.PI*2,r=.19+.008*Math.cos(t*5);return[Math.cos(t)*r,Math.sin(t)*r];});
 const tsuba=cutPlate(s,rim,holes,.034,[0,0,0],s.metal,'body',.006);tsuba.geometry.rotateY(Math.PI/2);tsuba.position.set(.93,.33,0);
 s.ring(.196,.011,[.93,.33,0],s.dark,'body','x');
 for(const side of[-1,1])s.mesh(new THREE.CylinderGeometry(.075,.075,.012,24),s.dark,[.93+side*.024,.33,0],'body',[0,0,Math.PI/2]);
 const steel=new THREE.MeshPhysicalMaterial({name:'Sculpt_blade_metal',color:0xd9e1ea,metalness:.92,roughness:.2,clearcoat:.6});steel.userData.finish=s.style.id;
 s.plate([[.96,.37],[1.40,.38],[1.66,.37],[1.80,.30],[1.70,.24],[1.40,.20],[.96,.19]],.03,[0,0,0],steel,'body',.004,true);
 for(const side of[-1,1])tube(s,[[.97,.365,side*.017],[1.40,.373,side*.017],[1.66,.362,side*.017]],.005,s.metal,'body',24);
 for(const side of[-1,1]){
  const hamon:V[]=Array.from({length:30},(_,i)=>{const t=i/29,x=1.0+t*.70;return[x,.245+Math.sin(t*Math.PI*9)*.012+t*.01,side*.0175];});
  tube(s,hamon,.0045,s.glow,'body',60);
 }
 bore(s,1.66,1.817,.33,.058);
 // Tsuka stock: silk wrap over a dark core, diamond windows and a gold kashira.
 s.plate([[-1.52,.18],[-1.50,.44],[-1.25,.47],[-.92,.44],[-.92,.22],[-1.25,.20]],.18,[0,0,0],s.soft,'stock',.014,true);
 s.box([.05,.28,.20],[-1.52,.31,0],s.metal,'stock',.02);
 for(const side of[-1,1]){
  for(let i=0;i<4;i++){const x=-1.44+i*.13;s.rod([x,.22,side*.096],[x+.13,.43,side*.096],.009,s.glow,'stock');s.rod([x+.13,.22,side*.096],[x,.43,side*.096],.009,s.glow,'stock');s.plate([[x+.065,.29],[x+.095,.325],[x+.065,.36],[x+.035,.325]],.006,[0,0,side*.094],s.pearl,'stock',.002);}
  blossom(s,-1.06,.43,side*.1,.028,'stock');
 }
 s.plate([[.10,.14],[.36,.14],[.36,-.26],[.18,-.32],[.08,-.18]],.17,[0,0,0],s.coat,'magazine',.01);
 for(const side of[-1,1])s.box([.24,.02,.012],[.23,-.06,side*.092],s.metal,'magazine',.004);
 s.box([.26,.05,.05],[-.50,.44,-.13],s.metal,'bolt');scope(s,.087);
}

/** 蜂鸟旋翼 — an iridescent body, folded wings, a ducted rotor around the beak. */
function rotor(s:Sculpture){
 grip(s);
 const cx=-.05,cy=.33,rx=.57,ry=.225,rz=.186;
 s.sphere(.30,[cx,cy,0],s.coat,[rx/.30,ry/.30,rz/.30]);
 const surface=(x:number,y:number)=>rz*Math.sqrt(Math.max(0,1-((x-cx)/rx)**2-((y-cy)/ry)**2));
 s.box([.16,.12,.12],[.12,.60,0],s.dark,'body',.02);
 for(const side of[-1,1]){
  // Gorget and breast feathers follow the ellipsoid surface.
  for(let row=0;row<3;row++)for(let i=0;i<5-row;i++){
   const x=.04+i*.075+row*.04,y=.17+row*.055,z=surface(x,y)+.008;if(z<.03)continue;
   s.plate([[-.026,.014],[0,.026],[.026,.014],[.023,-.01],[0,-.025],[-.023,-.01]],.008,[x,y,side*z],row===0?s.glow:s.coat,'body',.003);
  }
  for(let row=0;row<2;row++)for(let i=0;i<4;i++){
   const x=-.42+i*.11+row*.05,y=.30+row*.075,z=surface(x,y)+.008;
   s.plate([[-.04,.018],[0,.034],[.04,.018],[.035,-.012],[0,-.034],[-.035,-.012]],.009,[x,y,side*z],(i+row)%3===0?s.metal:s.coat,'body',.003);
  }
  // Eye: glossy dark lens with a pearl highlight.
  s.sphere(.034,[.32,.40,side*(surface(.32,.40)-.004)],s.dark,[1,1,.5]);s.sphere(.01,[.33,.412,side*(surface(.32,.40)+.01)],s.pearl);
  // Folded wings, layered and splayed slightly outward.
  const layers:[number,THREE.Material,number][]= [[0,s.metal,1],[1,s.coat,.86],[2,s.dark,.7]];
  for(const [k,m,l]of layers){
   const wing=s.plate([[.22,.46],[.02,.56],[-.40,.60],[-.40-.50*l,.59-.03*k],[-.50-.40*l,.53],[-.50,.49],[-.06,.45]],.016,[0,0,side*(.16+k*.012)],m,'body',.004,true);wing.rotation.x=side*.12;
  }
  for(let i=0;i<4;i++){const x=-.20-i*.17;s.rod([x,.52,side*.196],[x-.10,.58,side*.2],.004,s.pearl);}
 }
 // Tail feathers form the stock.
 for(const [ty,len,m]of[[.48,.58,s.coat],[.30,.66,s.metal],[.12,.56,s.coat]]as const){
  const x0=-.58,x1=x0-len;
  s.plate([[x0,.30+(ty-.30)*.2+.04],[x1+.08,ty+.035],[x1,ty],[x1+.08,ty-.035],[x0,.30+(ty-.30)*.2-.04]],.05,[0,0,0],m,'stock',.008,true);
  s.rod([x0,.30+(ty-.30)*.2,0],[x1+.03,ty,0],.007,s.pearl,'stock');
  s.sphere(.03,[x1+.01,ty,0],s.glow,[1.5,.8,.8],'stock');
 }
 s.box([.05,.34,.10],[-1.20,.30,0],s.soft,'stock',.02);
 // Beak and duct.
 s.rod([.40,.31,0],[.70,.31,0],.11,s.coat,'body',.058);
 s.rod([.66,.31,0],[1.10,.31,0],.04,s.dark);
 bore(s,1.06,1.267,.31,.055);
 lathe(s,[[.165,.78],[.19,.79],[.212,.85],[.21,.93],[.19,.99],[.166,1.0],[.17,.89],[.165,.78]],.31,s.metal,'body',40);
 s.ring(.188,.007,[.78,.31,0],s.glow,'body','x');s.ring(.188,.007,[1.0,.31,0],s.glow,'body','x');
 for(let i=0;i<3;i++){const a=i/3*Math.PI*2+Math.PI/2;s.rod([.97,.31+Math.cos(a)*.04,Math.sin(a)*.04],[.97,.31+Math.cos(a)*.168,Math.sin(a)*.168],.011,s.dark);}
 s.spin('fan',[.88,.31,0],6,3);
 s.sphere(.055,[.88,.31,0],s.dark,[1.3,1,1],'fan');
 for(let i=0;i<7;i++){
  const a=i/7*Math.PI*2,blade=s.mesh(new THREE.BoxGeometry(.012,.11,.05),s.glow,[.88,.31+Math.cos(a)*.105,Math.sin(a)*.105],'fan');
  blade.rotation.set(a,0,0);blade.rotateY(.55);
 }
 s.grip([.70,.20,0],[.70,-.18,0],.05);
 s.plate([[.04,.14],[.30,.12],[.38,-.40],[.24,-.46],[.06,-.40]],.17,[0,0,0],s.dark,'magazine',.009);
 for(const side of[-1,1]){s.box([.035,.30,.012],[.20,-.16,side*.092],s.glow,'magazine',.005);s.box([.20,.02,.012],[.20,-.36,side*.093],s.metal,'magazine',.004);}
 s.box([.16,.04,.05],[-.30,.48,-.12],s.metal,'bolt');s.gunSight();
}

/** 星渊轨炮 — split accelerator rails, a plasma channel and turning magnetic rings. */
function railgun(s:Sculpture){
 grip(s);
 s.plate([[-.90,.10],[-.82,.46],[-.40,.52],[.40,.50],[.74,.42],[.74,.14],[.30,.05],[-.50,.04]],.26,[0,0,0],s.coat,'body',.012);
 for(const side of[-1,1]){
  s.plate([[-.72,.18],[-.64,.42],[-.12,.44],[.02,.30],[-.08,.16]],.012,[0,0,side*.143],s.metal,'body',.004);
  s.plate([[.10,.44],[.56,.42],[.68,.30],[.52,.16],[.18,.20]],.012,[0,0,side*.143],s.dark,'body',.004);
  for(let i=0;i<3;i++){const x=.24+i*.11;s.box([.05,.15,.012],[x,.30,side*.152],s.glow,'body',.005);s.box([.07,.17,.008],[x,.30,side*.149],s.metal,'body',.004);}
  for(let i=0;i<4;i++)s.rod([-.58+i*.1,.24,side*.152],[-.52+i*.1,.36,side*.152],.006,s.glow);
  s.outline([[-1.50,.40,side*.122],[-1.20,.44,side*.122],[-.94,.36,side*.122]],.008,s.glow,'stock');
 }
 // Rails, conductor strips, side ribs and the plasma channel between them.
 s.plate([[.72,.36],[.72,.44],[2.06,.43],[2.30,.38],[2.30,.36]],.13,[0,0,0],s.coat,'body',.008);
 s.plate([[.72,.22],[.72,.14],[2.06,.15],[2.30,.20],[2.30,.22]],.13,[0,0,0],s.coat,'body',.008);
 for(const y of[.352,.228])s.box([1.54,.014,.10],[1.50,y,0],s.metal,'body',.004);
 s.rod([.74,.29,0],[2.26,.29,0],.016,s.glow);
 for(const side of[-1,1])for(const y of[.40,.18])s.box([1.30,.012,.006],[1.40,y,side*.069],s.glow,'body',.002);
 for(const x of[.92,1.75])for(const side of[-1,1])s.box([.08,.30,.02],[x,.29,side*.068],s.dark,'body',.008);
 for(let i=0;i<9;i++)s.box([.035,.03,.10],[.90+i*.13,.455,0],s.dark,'body',.004);
 // Converging muzzle collar with an open bore.
 s.rod([2.24,.29,0],[2.32,.29,0],.10,s.dark);
 bore(s,2.28,2.417,.29,.078);
 for(const side of[-1,1])s.box([.05,.03,.012],[2.33,.29+side*.06,0],s.glow,'body',.004);
 // Folded bipod below the bottom rail and a hand stop at the support.
 for(const side of[-1,1]){s.rod([1.02,.12,side*.045],[1.72,.11,side*.045],.015,s.metal);s.sphere(.022,[1.73,.11,side*.045],s.dark);}
 s.box([.10,.08,.12],[.93,.10,0],s.dark,'body',.02);
 // Three accelerator rings turning together around the bore axis.
 s.spin('rings',[1.55,.29,0],1.1,6);
 for(const x of[1.15,1.55,1.95]){
  s.ring(.20,.028,[x,.29,0],s.metal,'rings','x');s.ring(.20,.008,[x+.03,.29,0],s.glow,'rings','x');
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;s.box([.045,.04,.03],[x,.29+Math.cos(a)*.20,Math.sin(a)*.20],s.dark,'rings',.006);}
  for(let i=0;i<3;i++){const a=(i+.5)/3*Math.PI*2;dot(s,.024,[x-.03,.29+Math.cos(a)*.20,Math.sin(a)*.20],s.glow,[1,1,1],'rings');}
 }
 // Skeletal stock with an adjustable cheek riser.
 cutPlate(s,[[-1.70,.08],[-1.68,.48],[-1.30,.52],[-.88,.40],[-.88,.18],[-1.30,.14],[-1.50,.06]],[[[-1.54,.18],[-1.54,.38],[-1.08,.35],[-1.04,.24]]],.2,[0,0,0],s.coat,'stock',.012);
 s.box([.07,.40,.22],[-1.70,.28,0],s.soft,'stock');
 s.plate([[-1.40,.50],[-1.36,.56],[-1.02,.52],[-1.02,.46]],.10,[0,0,0],s.metal,'stock',.008);
 s.plate([[-.03,.04],[.24,.04],[.26,-.27],[.06,-.34],[-.05,-.22]],.19,[0,0,0],s.dark,'magazine',.01);
 for(const side of[-1,1])s.box([.03,.24,.012],[.11,-.13,side*.102],s.glow,'magazine',.004);
 s.rod([-.63,.44,-.14],[-.69,.25,-.25],.023,s.metal,'bolt');s.sphere(.045,[-.69,.25,-.25],s.dark,[1,1,1],'bolt');
 scope(s,.108);
}

export function buildThirdCollection(s:Sculpture,model:string){
 switch(model as ThirdCollectionModel){
  case'tesla':stormcoil(s);break;case'lantern':lanternWarden(s);break;
  case'bastion':bastion(s);break;case'scabbard':scabbard(s);break;
  case'rotor':rotor(s);break;case'railgun':railgun(s);break;
  default:throw new Error(`Unknown structural skin model: ${model}`);
 }
}
