/** Fourth sculpted collection. Every former paint-only finish becomes its own
 * silhouette, and the three melee weapons gain the rest of their five models.
 * Coordinates are +X forward, +Y up, raw registry sockets (see signatureModels). */
import * as THREE from 'three';
import type {Sculpture,P,V} from './signatureModels.ts';
import {bore,scope} from './signatureGunModels.ts';
import {grip,tube,lathe,cutPlate,glass,rect,dot,band,rivets} from './signatureCollectionThree.ts';

export const FOURTH_COLLECTION_MODELS=['turbine','hive','courier','porcelain','lacquer','arcade','parade','whalefall','rose','phoenix','bell','cogsaw','kris','frostfang','glaive','halberd','rocket','geode'] as const;
export type FourthCollectionModel=typeof FOURTH_COLLECTION_MODELS[number];

const TAU=Math.PI*2;
function material(s:Sculpture,name:string,params:THREE.MeshPhysicalMaterialParameters){
 const m=new THREE.MeshPhysicalMaterial({name,...params});m.userData.finish=s.style.id;return m;
}
function circle(cx:number,cy:number,r:number,n=24,phase=0):P[]{return Array.from({length:n},(_,i)=>{const t=phase+i/n*TAU;return[cx+Math.cos(t)*r,cy+Math.sin(t)*r]as P;});}
function hex(cx:number,cy:number,r:number):P[]{return circle(cx,cy,r,6,Math.PI/6);}
function inside(points:readonly P[],x:number,y:number){
 let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}return hit;
}
/** Cells whose padded outline sits wholly inside `contour`. */
function honeycomb(contour:readonly P[],x0:number,x1:number,y0:number,y1:number,r:number,pitch:number){
 const cells:P[][]=[];
 for(let row=0;y0+row*pitch*.86<=y1;row++)for(let x=x0+(row%2)*pitch/2;x<=x1;x+=pitch){
  const y=y0+row*pitch*.86;if(hex(x,y,r*1.7).every(([px,py])=>inside(contour,px,py)))cells.push(hex(x,y,r));
 }
 return cells;
}
/** Leaf/feather outline from base to tip, widest at `bulge` of the way along. */
function leaf(x0:number,y0:number,x1:number,y1:number,w:number,bulge=.4,steps=6):P[]{
 const dx=x1-x0,dy=y1-y0,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len,left:P[]=[],right:P[]=[];
 for(let i=0;i<=steps;i++){const t=i/steps,width=w*Math.sin(Math.PI*Math.min(1,t<bulge?t/bulge*.5:.5+(t-bulge)/(1-bulge)*.5));const x=x0+dx*t,y=y0+dy*t;left.push([x+nx*width,y+ny*width]);right.push([x-nx*width,y-ny*width]);}
 return[...left,...right.reverse().slice(1,-1)];
}
/** Raised sights need a physical post from the receiver top up to the ring housing. */
function sightPost(s:Sculpture,top:number){
 const p=s.def.sight;if(!p)return;const bottom=p[1]-.185;if(bottom>top+.005)s.box([.09,bottom-top+.02,.10],[p[0],(top+bottom)/2,p[2]],s.dark,'optic',.01);
 s.gunSight();
}
/** A disc lying in the YZ plane (for wax seals, portholes, gauges). */
function disc(s:Sculpture,r:number,depth:number,p:V,m:THREE.Material,role='body',segments=20){return s.mesh(new THREE.CylinderGeometry(r,r,depth,segments),m,p,role,[Math.PI/2,0,0]);}

// ---------------------------------------------------------------- firearms

/** 潮汐引擎 — a submarine hull with portholes and a ducted, spinning impeller. */
function tidalEngine(s:Sculpture){
 grip(s);
 s.plate([[-.82,.12],[-.74,.47],[-.30,.56],[.40,.53],[.78,.42],[.80,.17],[.40,.07],[-.40,.05]],.27,[0,0,0],s.coat,'body',.014,true);
 s.plate([[-.40,.09],[.50,.09],[.74,.16],[.30,.01],[-.30,.02]],.12,[0,0,0],s.dark,'body',.008);
 // Dorsal fin doubles as the sight foot.
 s.plate([[-.40,.53],[-.20,.66],[.08,.65],[.34,.52]],.035,[0,0,0],s.metal,'body',.006,true);
 for(const side of[-1,1]){
  for(const x of[-.50,-.28,-.06]){s.ring(.054,.013,[x,.33,side*.152],s.metal);dot(s,.044,[x,.33,side*.143],s.glow,[1,1,.3]);}
  s.outline(Array.from({length:13},(_,i)=>[-.72+i*.115,.20+Math.sin(i*.95)*.022,side*.152]as const),.007,s.glow);
  for(let i=0;i<3;i++)s.plate([[.16+i*.17,.44],[.28+i*.17,.50],[.34+i*.17,.42]],.01,[0,0,side*.152],s.metal,'body',.003);
  s.outline([[-1.36,.36,side*.098],[-1.10,.41,side*.098],[-.82,.33,side*.098]],.009,s.glow,'stock');
 }
 s.rod([.78,.29,0],[1.62,.29,0],.05,s.dark);bore(s,1.58,1.887,.29,.075);
 // Duct with stator struts; the impeller turns inside it.
 lathe(s,[[.17,1.14],[.20,1.16],[.218,1.24],[.214,1.44],[.19,1.52],[.165,1.53],[.172,1.33],[.17,1.14]],.29,s.coat,'body',40);
 s.ring(.206,.009,[1.16,.29,0],s.metal,'body','x');s.ring(.196,.009,[1.52,.29,0],s.glow,'body','x');
 for(let i=0;i<4;i++){const a=i/4*TAU+Math.PI/4;s.rod([1.48,.29+Math.cos(a)*.05,Math.sin(a)*.05],[1.48,.29+Math.cos(a)*.172,Math.sin(a)*.172],.009,s.dark);}
 s.spin('impeller',[1.31,.29,0],3.2,4);
 s.sphere(.058,[1.31,.29,0],s.metal,[1.5,1,1],'impeller');
 for(let i=0;i<6;i++){const a=i/6*TAU,blade=s.mesh(new THREE.BoxGeometry(.016,.11,.075),s.glow,[1.31,.29+Math.cos(a)*.105,Math.sin(a)*.105],'impeller');blade.rotation.set(a,0,0);blade.rotateY(.6);}
 s.grip([.88,.17,0],[.88,-.14,0],.048);s.box([.16,.08,.11],[.88,.20,0],s.dark);
 s.plate([[.00,.10],[.24,.10],[.30,-.36],[.10,-.42],[-.02,-.30]],.17,[0,0,0],s.dark,'magazine',.01);
 for(const side of[-1,1])s.box([.03,.26,.012],[.15,-.14,side*.092],s.glow,'magazine',.004);
 cutPlate(s,[[-1.46,.08],[-1.42,.50],[-1.16,.52],[-.80,.38],[-.80,.18],[-1.14,.15]],[[[-1.34,.21],[-1.32,.40],[-1.06,.40],[-.98,.27],[-1.12,.21]]],.18,[0,0,0],s.coat,'stock',.012);
 s.box([.07,.40,.22],[-1.44,.29,0],s.soft,'stock');
 s.box([.22,.05,.05],[-.44,.48,-.17],s.metal,'bolt');s.gunSight();
 rivets(s,[[-.68,.42],[.62,.44],[-.68,.17]],.152);
}

/** 琥珀蜂巢 — honey light behind a honeycomb receiver, skep magazine, bee wings. */
function amberApiary(s:Sculpture){
 grip(s);
 const contour:P[]=[[-.80,.12],[-.72,.50],[-.28,.56],[.46,.52],[.74,.40],[.72,.14],[.30,.06],[-.40,.05]];
 s.plate(contour,.22,[0,0,0],s.glow,'body',.008);
 const cells=honeycomb(contour,-.66,.64,.15,.50,.034,.095);
 for(const side of[-1,1])cutPlate(s,contour,cells,.03,[0,0,side*.13],s.coat,'body',.005);
 s.box([1.18,.035,.30],[-.05,.545,0],s.metal,'body',.012);
 for(const x of[-.34,-.05,.26,.50])s.sphere(.022,[x,.05,0],s.glow,[1,1.7,1]);
 // Bee-striped sheath and a tapered stinger collar around the open bore.
 s.rod([.72,.29,0],[1.46,.29,0],.074,s.coat);
 for(let i=0;i<5;i++)s.rod([.80+i*.13,.29,0],[.86+i*.13,.29,0],.078,s.dark);
 lathe(s,[[.078,1.42],[.10,1.46],[.10,1.52],[.082,1.57]],.29,s.metal,'body',24);bore(s,1.52,1.887,.29,.068);
 // A small bee resting on top of the sheath.
 const wing=glass(s,0xfff4d2);
 dot(s,.03,[1.10,.392,0],s.coat,[1.7,1,1]);for(const x of[1.08,1.13])band(s,.031,.007,[x,.392,0],s.dark);dot(s,.02,[1.16,.395,0],s.dark);
 for(const side of[-1,1])s.plate(leaf(1.10,.40,1.05,.44,.025),.004,[0,0,side*.03],wing,'body',0);
 // Skep magazine: stacked straw coils around a dark core.
 s.rod([.13,.10,0],[.13,-.42,0],.07,s.dark,'magazine');
 for(let i=0;i<7;i++){const r=.085+.045*Math.sin((i+.5)/7*Math.PI);s.mesh(new THREE.TorusGeometry(r,.03,6,22),s.coat,[.13,.04-i*.066,0],'magazine',[Math.PI/2,0,0]);}
 for(const side of[-1,1])dot(s,.03,[.13,-.24,side*.128],s.dark,[1,.6,.4],'magazine');
 // Bee-wing stock: glass vanes with metal veins on a solid spine.
 s.rod([-.78,.31,0],[-1.42,.31,0],.05,s.coat,'stock');s.box([.07,.36,.18],[-1.44,.29,0],s.soft,'stock');
 for(const side of[-1,1]){
  const upper:P[]=[[-.80,.34],[-1.04,.56],[-1.36,.58],[-1.42,.48],[-1.05,.36]],lower:P[]=[[-.80,.27],[-1.0,.10],[-1.24,.08],[-1.22,.18],[-.98,.27]];
  s.plate(upper,.01,[0,0,side*.06],wing,'stock',0);s.plate(lower,.01,[0,0,side*.075],wing,'stock',0);
  s.outline([...upper.map(([x,y])=>[x,y,side*.066]as const),[-.80,.34,side*.066]],.006,s.metal,'stock');
  s.outline([[-.84,.34,side*.068],[-1.10,.47,side*.068],[-1.36,.53,side*.068]],.004,s.metal,'stock');
  s.outline([...lower.map(([x,y])=>[x,y,side*.081]as const),[-.80,.27,side*.081]],.005,s.metal,'stock');
 }
 s.box([.22,.05,.05],[-.44,.52,-.17],s.metal,'bolt');sightPost(s,.56);
}

/** 航契封蜡 — strapped document case, scroll barrel, wax seals, letter stock. */
function sealedPassage(s:Sculpture){
 grip(s);
 s.box([1.06,.36,.30],[-.24,.31,0],s.coat,'body',.04);s.box([1.08,.016,.31],[-.24,.43,0],s.dark,'body',.005);
 for(const x of[-.58,.08]){
  s.box([.07,.385,.32],[x,.31,0],s.soft,'body',.012);
  for(const side of[-1,1])cutPlate(s,rect(x,.40,.075,.07),[rect(x,.40,.04,.036)],.012,[0,0,side*.163],s.metal,'body',.003);
 }
 // Rolled scroll barrel: parchment tube, metal caps and a visible spiral end.
 s.rod([.28,.31,0],[1.40,.31,0],.115,s.coat);
 for(const x of[.40,1.32])s.ring(.118,.014,[x,.31,0],s.metal,'body','x');
 s.outline(Array.from({length:40},(_,i)=>{const t=i/39*TAU*2.4,r=.07+.046*i/39;return[1.405,.31+Math.cos(t)*r,Math.sin(t)*r]as const;}),.005,s.dark);
 bore(s,1.38,1.773,.31,.062);
 s.ring(.121,.012,[.86,.31,0],s.glow,'body','x');
 for(const side of[-1,1]){
  disc(s,.062,.022,[.86,.31,side*.126],s.glow);s.ring(.04,.006,[.86,.31,side*.139],s.dark);
  s.plate([[.84,.27],[.80,.12],[.84,.15],[.87,.10],[.88,.27]],.006,[0,0,side*.122],s.glow,'body',.002);
  disc(s,.078,.024,[-.25,.31,side*.158],s.glow);s.ring(.05,.007,[-.25,.31,side*.172],s.dark);
  for(let i=0;i<4;i++){const a=i/4*Math.PI;s.rod([-.25+Math.cos(a)*.03,.31+Math.sin(a)*.03,side*.172],[-.25-Math.cos(a)*.03,.31-Math.sin(a)*.03,side*.172],.004,s.dark);}
  s.plate([[-.27,.26],[-.31,.11],[-.27,.14],[-.24,.09],[-.22,.26]],.006,[0,0,side*.152],s.glow,'body',.002);
 }
 // Quill tucked under the left strap.
 s.plate([[-.92,.47],[-.62,.53],[-.20,.52],[.12,.47],[.20,.45],[-.18,.46],[-.62,.45]],.008,[0,0,.168],s.pearl,'body',.003,true);
 s.rod([-.95,.465,.173],[.22,.455,.173],.006,s.metal);s.mesh(new THREE.ConeGeometry(.012,.07,6),s.metal,[.26,.452,.173],'body',[0,0,-Math.PI/2]);
 // Envelope pump.
 s.box([.62,.15,.25],[.86,.12,0],s.coat,'fore_end',.02);
 for(const side of[-1,1]){s.outline([[.56,.19,side*.128],[.86,.09,side*.128],[1.16,.19,side*.128]],.006,s.dark,'fore_end');disc(s,.022,.01,[.86,.10,side*.13],s.glow,'fore_end');}
 // Bundle of letters tied with cord.
 for(let i=0;i<4;i++){const letter=s.box([.62,.075,.24-i*.01],[-1.06-i*.012,.17+i*.08,0],i%2?s.coat:s.pearl,'stock',.012);letter.rotation.z=.03*(i-1.5);}
 s.box([.022,.35,.25],[-1.02,.29,0],s.dark,'stock',.006);s.box([.62,.022,.25],[-1.06,.29,0],s.dark,'stock',.006);
 s.box([.07,.36,.27],[-1.40,.28,0],s.soft,'stock');
 s.box([.22,.05,.05],[-.42,.47,-.17],s.metal,'bolt');sightPost(s,.49);
 rivets(s,[[-.72,.45],[-.72,.17],[.22,.45],[.22,.17]],.152);
}

/** 青瓷山海 — a lathed meiping vase with jade ridgelines and a gilt sea. */
function celadonAtlas(s:Sculpture){
 grip(s);
 const cy=.33,profile:P[]=[[0,-.94],[.11,-.94],[.12,-.90],[.105,-.86],[.13,-.70],[.165,-.45],[.20,-.15],[.215,.05],[.20,.20],[.15,.32],[.085,.40],[.07,.44],[.085,.47],[.085,.52],[0,.52]];
 lathe(s,profile,cy,s.coat,'body',40);
 const radius=(x:number)=>{for(let i=1;i<profile.length;i++){const [r0,x0]=profile[i-1],[r1,x1]=profile[i];if(x>=x0&&x<=x1&&x1>x0)return r0+(r1-r0)*(x-x0)/(x1-x0);}return 0;};
 const onSurface=(x:number,y:number,side:number,lift=.004)=>[x,y,side*(Math.sqrt(Math.max(0,radius(x)**2-(y-cy)**2))+lift)]as const;
 for(const side of[-1,1]){
  const ridge=(peaks:readonly P[],m:THREE.Material,r:number)=>s.outline(peaks.map(([x,y])=>onSurface(x,y,side)),r,m);
  ridge([[-.66,.30],[-.52,.40],[-.42,.34],[-.28,.45],[-.14,.36],[.0,.42],[.12,.33]],s.glow,.009);
  ridge([[-.60,.29],[-.44,.36],[-.30,.31],[-.18,.39],[-.04,.32],[.08,.30]],s.metal,.006);
  ridge(Array.from({length:14},(_,i)=>[-.70+i*.065,.22+Math.sin(i*1.3)*.018]as P),s.metal,.007);
  for(const [x,y]of[[-.36,.44],[.04,.47]]as const)dot(s,.012,onSurface(x,y,side,.006),s.pearl);
 }
 for(const x of[-.92,.44,.51])s.ring(radius(x)+.004,.011,[x,cy,0],s.metal,'body','x');
 s.rod([.50,cy,0],[1.54,cy,0],.05,s.dark);bore(s,1.50,1.817,cy,.075);
 for(const x of[.80,1.18])s.ring(.054,.01,[x,cy,0],s.metal,'body','x');
 cutPlate(s,[[-1.50,.14],[-1.46,.48],[-1.16,.52],[-.92,.42],[-.92,.24],[-1.18,.25]],[circle(-1.24,.37,.07,20)],.18,[0,0,0],s.coat,'stock',.012);
 for(const side of[-1,1])s.outline([[-1.44,.20,side*.104],[-1.20,.29,side*.104],[-.95,.27,side*.104]],.007,s.metal,'stock');
 s.box([.07,.34,.22],[-1.48,.31,0],s.soft,'stock');
 s.box([.22,.30,.15],[.20,-.03,0],s.dark,'magazine');s.box([.235,.025,.16],[.20,-.17,0],s.metal,'magazine',.004);
 s.box([.2,.05,.05],[-.40,.52,-.18],s.metal,'bolt');scope(s,.09);
}

/** 螺钿夜雨 — black-lacquer case, nacre shards, silver rain, jewel-box stock. */
function nightNacre(s:Sculpture){
 grip(s);
 const nacre=material(s,'Sculpt_nacre_pearl',{color:0xdfe9f0,metalness:.1,roughness:.16,clearcoat:1,iridescence:1,iridescenceIOR:1.6,iridescenceThicknessRange:[220,780]});
 s.box([1.30,.34,.27],[-.18,.33,0],s.coat,'body',.03);s.box([1.32,.016,.28],[-.18,.44,0],s.metal,'body',.004);
 for(const [x,y]of[[-.82,.17],[-.82,.49],[.46,.17],[.46,.49]]as const)s.box([.05,.05,.29],[x,y,0],s.metal,'body',.01);
 for(const side of[-1,1])for(let i=0;i<14;i++){
  const x=-.74+i*.087,y=.22+((i*37+(side>0?0:2))%5)*.042,a=(i*1.7)%TAU,r=.024+(i%3)*.007;
  s.plate([0,1,2,3].map(k=>{const t=a+k*TAU/4+(k%2)*.4;return[x+Math.cos(t)*r,y+Math.sin(t)*r*.8]as P;}),.005,[0,0,side*.139],nacre,'body',.002);
 }
 for(const side of[-1,1])for(let i=0;i<11;i++){const x=-.74+i*.12;s.rod([x,.49,side*.142],[x-.05,.24-(i%3)*.03,side*.142],.0032,s.metal);}
 s.mesh(new THREE.CylinderGeometry(.075,.075,.94,6),s.coat,[.94,.33,0],'body',[0,0,Math.PI/2]);
 for(const x of[.60,.94,1.28])s.mesh(new THREE.CylinderGeometry(.079,.079,.026,6),nacre,[x,.33,0],'body',[0,0,Math.PI/2]);
 s.rod([.47,.33,0],[1.44,.33,0],.05,s.dark);bore(s,1.40,1.817,.33,.068);
 // Jewel-box stock with drawer pulls and a hanging tassel.
 s.box([.58,.30,.22],[-1.13,.29,0],s.coat,'stock',.03);s.box([.60,.014,.23],[-1.13,.36,0],s.metal,'stock',.004);
 for(const side of[-1,1]){s.ring(.032,.007,[-1.13,.24,side*.115],s.metal,'stock');for(const x of[-1.32,-.95])s.plate(hex(x,.30,.03),.005,[0,0,side*.113],nacre,'stock',.002);}
 s.rod([-1.0,.14,0],[-1.0,.02,0],.006,s.soft,'stock');dot(s,.022,[-1.0,.01,0],nacre,[1,1,1],'stock');
 s.mesh(new THREE.ConeGeometry(.03,.11,10),s.glow,[-1.0,-.06,0],'stock');
 s.box([.07,.34,.24],[-1.45,.29,0],s.soft,'stock');
 s.box([.22,.30,.15],[.18,-.02,0],s.coat,'magazine',.02);s.box([.23,.012,.16],[.18,.04,0],nacre,'magazine',.003);
 s.box([.2,.05,.05],[-.40,.52,-.17],s.metal,'bolt');scope(s,.088);
}

/** 薄荷街机 — an arcade cabinet SMG; the joystick is the reciprocating bolt. */
function mintArcade(s:Sculpture){
 grip(s);
 const cabinet:P[]=[[-.72,.06],[-.72,.50],[-.60,.64],[-.12,.64],[-.02,.55],[.30,.49],[.52,.38],[.52,.06]];
 s.plate(cabinet,.26,[0,0,0],s.coat,'body',.012);
 s.plate([[-.715,.50],[-.60,.635],[-.55,.62],[-.665,.49]],.272,[0,0,0],s.glow,'body',.004);
 for(const side of[-1,1]){
  s.outline([...cabinet.map(([x,y])=>[x,y,side*.143]as const),[-.72,.06,side*.143]],.008,s.metal);
  s.box([.40,.25,.012],[-.36,.37,side*.143],s.dark,'body',.01);
  const heart=['.XX.XX.','XXXXXXX','XXXXXXX','.XXXXX.','..XXX..','...X...'];
  heart.forEach((row,r)=>[...row].forEach((c,k)=>{if(c==='X')s.mesh(new THREE.BoxGeometry(.026,.026,.008),s.glow,[-.44+k*.028,.45-r*.028,side*.151]);}));
  for(let i=0;i<4;i++)dot(s,.009,[.14+i*.07,.15,side*.141],s.dark,[1,1,.4]);
 }
 // Control deck: joystick (bolt) and two buttons.
 dot(s,.03,[.30,.50,.04],s.dark,[1,.4,1],'bolt');s.rod([.30,.50,.04],[.30,.58,.04],.011,s.metal,'bolt');s.sphere(.034,[.30,.605,.04],s.glow,[1,1,1],'bolt');
 for(const [x,m]of[[.40,s.glow],[.46,s.pearl]]as const)s.mesh(new THREE.CylinderGeometry(.022,.022,.03,14),m,[x,.445,-.04],'body',[0,0,-.45]);
 // Coin-door magazine.
 s.box([.20,.39,.16],[.12,-.125,0],s.dark,'magazine',.012);
 for(const side of[-1,1]){s.box([.13,.18,.008],[.12,-.10,side*.083],s.metal,'magazine',.004);for(const x of[.085,.155])s.box([.012,.06,.006],[x,-.08,side*.088],s.glow,'magazine',.002);}
 s.rod([.52,.31,0],[1.10,.31,0],.05,s.dark);bore(s,1.05,1.267,.31,.068);s.ring(.056,.012,[.70,.31,0],s.metal,'body','x');
 s.grip([.70,.16,0],[.70,-.20,0],.05);s.box([.12,.11,.10],[.70,.215,0],s.dark,'body',.015);
 // Stepped pixel stock.
 const rows:[number,number,number][]=[[.44,-.72,-1.04],[.36,-.72,-1.20],[.28,-.72,-1.28],[.20,-.72,-1.20],[.12,-.72,-.96]];
 for(const [y,a,b]of rows)for(let x=a,k=0;x>=b-.001;x-=.08,k++)s.box([.078,.078,.20],[x-.04,y,0],(k+Math.round(y*12.5))%2?s.coat:s.metal,'stock',.008);
 s.box([.06,.36,.22],[-1.34,.28,0],s.soft,'stock');
 sightPost(s,.52);
}

/** 近卫绶带 — ceremonial guard SMG: crossing sash, braided cord, rosette, bayonet. */
function guardSash(s:Sculpture){
 grip(s);
 const sash=material(s,'Sculpt_sash',{color:s.style.inlay??0xe4ddc9,roughness:.62,metalness:0,sheen:1,sheenColor:0xffffff,sheenRoughness:.5});
 s.plate([[-.70,.10],[-.66,.48],[-.30,.55],[.42,.52],[.56,.40],[.56,.12],[.20,.06],[-.40,.06]],.26,[0,0,0],s.coat,'body',.012,true);
 s.box([.90,.04,.12],[-.10,.565,0],s.metal,'body',.01);
 for(const side of[-1,1]){
  s.plate([[-.52,.08],[-.38,.08],[.14,.55],[0,.55]],.008,[0,0,side*.146],sash,'body',.002);
  for(const off of[-.006,.146])s.outline([[-.52+off,.085,side*.152],[0+off,.545,side*.152]],.0045,s.glow);
  cutPlate(s,rect(-.19,.31,.11,.09),[rect(-.19,.31,.06,.045)],.012,[0,0,side*.156],s.metal,'body',.003);
 }
 s.box([.15,.012,.31],[.07,.555,0],sash,'body',.004);s.box([.15,.012,.31],[-.45,.075,0],sash,'body',.004);
 // Braided cord on the left: two strands twisting along one swag.
 const swag=new THREE.CatmullRomCurve3([[-.62,.44,.16],[-.72,.20,.19],[-.42,-.02,.18],[.05,.02,.17],[.34,.15,.155]].map(p=>new THREE.Vector3(...p)));
 for(const [phase,m,r]of[[0,s.glow,.011],[Math.PI,s.metal,.009]]as const){
  const points=swag.getPoints(60).map((p,i)=>[p.x,p.y+Math.sin(i*.9+phase)*.011,p.z+Math.cos(i*.9+phase)*.008]as const);s.outline(points,r,m);
 }
 s.mesh(new THREE.ConeGeometry(.014,.05,8),s.metal,[.36,.13,.155],'body',[0,0,Math.PI*.7]);
 // Rosette on the right shoulder.
 for(let i=0;i<12;i++){const a=i/12*TAU;s.plate([[0,0],[Math.cos(a-.22)*.06,Math.sin(a-.22)*.06],[Math.cos(a+.22)*.06,Math.sin(a+.22)*.06]].map(([x,y])=>[-.52+x,.36+y]as P),.006,[0,0,-.152],i%2?s.glow:sash,'body',.002);}
 dot(s,.022,[-.52,.36,-.158],s.metal,[1,1,.5]);
 // Fluted barrel and an underslung bayonet.
 s.rod([.56,.31,0],[1.12,.31,0],.06,s.coat);for(let i=0;i<6;i++){const a=i/6*TAU;s.rod([.60,.31+Math.cos(a)*.061,Math.sin(a)*.061],[1.08,.31+Math.cos(a)*.061,Math.sin(a)*.061],.006,s.metal);}
 for(const x of[.60,1.08])s.ring(.064,.012,[x,.31,0],s.metal,'body','x');bore(s,1.08,1.267,.31,.068);
 s.box([.10,.05,.06],[1.12,.215,0],s.metal,'body',.01);
 s.plate([[1.10,.188],[1.60,.205],[1.70,.198],[1.60,.188],[1.10,.176]],.012,[0,0,0],s.metal,'body',.003);
 for(const side of[-1,1])s.outline([[1.16,.19,side*.009],[1.56,.198,side*.009]],.003,s.glow);
 s.grip([.70,.16,0],[.70,-.20,0],.05);s.box([.10,.11,.10],[.70,.215,0],s.metal,'body',.015);
 s.plate([[.00,.08],[.22,.08],[.30,-.40],[.08,-.44]],.15,[0,0,0],s.dark,'magazine',.01);
 for(let i=0;i<3;i++)s.box([.24-i*.01,.018,.165],[.14+i*.035,-.06-i*.12,0],s.metal,'magazine',.004);
 // Epaulette stock with a fringe.
 s.plate([[-1.22,.14],[-1.20,.46],[-.98,.48],[-.70,.40],[-.70,.20],[-.98,.20]],.20,[0,0,0],s.coat,'stock',.012);
 s.sphere(.15,[-1.25,.31,0],s.metal,[.32,1.15,1],'stock');s.ring(.13,.01,[-1.27,.31,0],s.glow,'stock','x');
 for(let i=0;i<14;i++){const a=Math.PI*(.15+.7*i/13),z=Math.cos(a)*.14,y=.31-Math.sin(a)*.155;s.rod([-1.29,y,z],[-1.31,y-.09,z*1.08],.0055,s.metal,'stock');}
 s.box([.22,.05,.05],[-.44,.50,-.16],s.metal,'bolt');sightPost(s,.585);
}

/** 鲸落深蓝 — whale ribs around the barrel, vertebrae spine, fluke stock. */
function abyssalRequiem(s:Sculpture){
 grip(s);
 s.plate([[-.92,.12],[-.84,.44],[-.40,.52],[.30,.50],[.72,.40],[.76,.18],[.30,.08],[-.50,.06]],.25,[0,0,0],s.coat,'body',.014,true);
 for(const side of[-1,1]){
  for(let i=0;i<8;i++)dot(s,.012,[-.70+i*.17,.20+Math.sin(i)*.02,side*.146],s.glow,[1,1,.4]);
  s.ring(.034,.009,[.46,.36,side*.144],s.metal);dot(s,.022,[.46,.36,side*.14],s.glow,[1,1,.4]);
  s.outline([[-1.45,.30,side*.083],[-1.20,.33,side*.083],[-.94,.30,side*.083]],.006,s.glow,'stock');
 }
 for(let i=0;i<19;i++){const x=-.72+i*.155,y=x<.74?.535:.51;s.box([.085,.05,.085],[x,y,0],s.pearl,'body',.018);s.plate([[x-.03,y+.02],[x+.01,y+.06],[x+.03,y+.02]],.02,[0,0,0],s.pearl,'body',.004);}
 s.rod([.76,.29,0],[2.20,.29,0],.045,s.dark);bore(s,2.14,2.417,.29,.075);s.ring(.082,.014,[2.16,.29,0],s.metal,'body','x');
 for(let i=0;i<9;i++){const x=.86+i*.15;for(const side of[-1,1]){
  s.outline([[x,.50,0],[x-.02,.47,side*.12],[x-.05,.33,side*.195],[x-.08,.18,side*.15],[x-.10,.11,side*.05]],.013,s.pearl);
  if(i%2===0)dot(s,.016,[x-.05,.33,side*.205],s.glow);
 }}
 s.rod([.74,.105,0],[2.0,.105,0],.02,s.pearl);
 s.box([.10,.08,.12],[.93,.12,0],s.dark,'body',.02);
 // Stalk and horizontal fluke.
 s.plate([[-.92,.40],[-1.42,.34],[-1.42,.24],[-.92,.16]],.16,[0,0,0],s.coat,'stock',.012,true);
 const fluke=s.plate([[-1.38,0],[-1.50,.10],[-1.66,.24],[-1.61,.07],[-1.64,0],[-1.61,-.07],[-1.66,-.24],[-1.50,-.10]],.05,[0,.29,0],s.coat,'stock',.01,true);fluke.rotation.x=Math.PI/2;
 s.outline([[-1.40,.32,0],[-1.52,.32,.10],[-1.64,.32,.22]],.005,s.pearl,'stock');s.outline([[-1.40,.32,0],[-1.52,.32,-.10],[-1.64,.32,-.22]],.005,s.pearl,'stock');
 s.plate([[-.03,.06],[.24,.06],[.26,-.25],[.06,-.32],[-.05,-.20]],.17,[0,0,0],s.pearl,'magazine',.01);
 for(const side of[-1,1])s.box([.03,.20,.012],[.11,-.12,side*.093],s.glow,'magazine',.004);
 s.rod([-.63,.44,-.14],[-.69,.25,-.25],.023,s.metal,'bolt');s.sphere(.045,[-.69,.25,-.25],s.dark,[1,1,1],'bolt');
 scope(s,.104);
}

/** 绯夜蔷薇 — a thorned vine spirals the barrel to a rose bloom at the muzzle. */
function velvetThorn(s:Sculpture){
 grip(s);
 const leafMat=material(s,'Sculpt_leaf',{color:0x2f5a3a,roughness:.45,metalness:.05,clearcoat:.4,sheen:.6,sheenColor:0x8fd19e});
 const petal=material(s,'Sculpt_petal',{color:s.style.accent,roughness:.38,metalness:0,sheen:1,sheenColor:0xffd1df,side:THREE.DoubleSide});
 const velvet=material(s,'Sculpt_petal_velvet',{color:s.style.body,roughness:.42,metalness:0,sheen:1,sheenColor:0xff9ab7,side:THREE.DoubleSide});
 s.plate([[-.92,.12],[-.82,.46],[-.30,.52],[.40,.50],[.74,.40],[.74,.16],[.30,.06],[-.50,.06]],.25,[0,0,0],s.coat,'body',.014,true);
 for(const side of[-1,1]){
  for(const [cx,cy]of[[-.50,.30],[.18,.30]]as const)s.outline(Array.from({length:30},(_,i)=>{const t=i/29*TAU*1.6,r=.012+.07*i/29;return[cx+Math.cos(t)*r,cy+Math.sin(t)*r*.8,side*.146]as const;}),.005,s.metal);
  s.outline([[-.80,.20,side*.146],[-.50,.16,side*.146],[-.15,.22,side*.146],[.20,.16,side*.146],[.62,.22,side*.146]],.006,s.metal);
 }
 s.rod([.74,.29,0],[2.24,.29,0],.05,s.dark);s.rod([.74,.29,0],[1.42,.29,0],.07,s.coat);
 // Vine with thorns and leaves.
 const turns=4.5,from=.80,to=2.06,R=.098,vine:V[]=[];
 for(let i=0;i<=90;i++){const t=i/90,a=t*turns*TAU;vine.push([from+(to-from)*t,.29+Math.cos(a)*R,Math.sin(a)*R]);}
 tube(s,vine,.012,leafMat,'body',140);
 for(let i=4;i<=88;i+=6){const [x,y,z]=vine[i],ny=(y-.29)/R,nz=z/R;s.rod([x,y,z],[x+.02,y+ny*.05,z+nz*.05],.011,s.metal,'body',0,6);}
 for(let i=10;i<=84;i+=20){const [x,y,z]=vine[i],side=z>=0?1:-1;s.plate(leaf(x,y,x+.12,y+.05,.03),.005,[0,0,z+side*.01],leafMat,'body',.002);}
 // Bloom: three layered petal cups opening toward the muzzle.
 bore(s,2.12,2.417,.29,.075);
 for(const [layer,r,count,t0,t1,m]of[[0,.12,5,1.30,2.25,petal],[1,.175,6,1.40,2.40,petal],[2,.235,7,1.55,2.55,velvet]]as const){
  for(let i=0;i<count;i++){const a=(i+layer*.5)/count*TAU,g=new THREE.SphereGeometry(r,8,6,a,TAU/count*1.15,t0,t1-t0);g.rotateZ(-Math.PI/2);s.mesh(g,m,[2.22+layer*.02,.29,0]);}
 }
 for(let i=0;i<5;i++){const a=i/5*TAU+.4;s.rod([2.10,.29+Math.cos(a)*.085,Math.sin(a)*.085],[1.97,.29+Math.cos(a)*.16,Math.sin(a)*.16],.022,leafMat,'body',0,5);}
 cutPlate(s,[[-1.62,.12],[-1.58,.46],[-1.22,.50],[-.90,.40],[-.90,.20],[-1.25,.22]],[circle(-1.30,.35,.075,5,Math.PI/2)],.18,[0,0,0],s.coat,'stock',.012);
 for(const side of[-1,1]){s.outline([[-1.55,.18,side*.104],[-1.25,.27,side*.104],[-.93,.24,side*.104]],.007,leafMat,'stock');for(const x of[-1.45,-1.20,-1.0])s.rod([x,.235,side*.104],[x+.02,.27,side*.12],.008,s.metal,'stock',0,6);}
 s.box([.07,.36,.22],[-1.60,.29,0],s.soft,'stock');
 s.plate([[-.03,.06],[.24,.06],[.26,-.25],[.06,-.32],[-.05,-.20]],.17,[0,0,0],s.dark,'magazine',.01);s.box([.30,.02,.18],[.11,-.30,0],s.metal,'magazine',.004);
 s.rod([-.63,.44,-.14],[-.69,.25,-.25],.023,s.metal,'bolt');s.sphere(.045,[-.69,.25,-.25],s.dark,[1,1,1],'bolt');
 scope(s,.1);
}

// ---------------------------------------------------------------- polearms

function poleShaft(s:Sculpture,end=.80){
 s.rod([-1.72,0,0],[end,0,0],.045,s.coat);
 for(const x of[-1.60,-1.10,-.30,.30])s.rod([x-.02,0,0],[x+.02,0,0],.055,s.metal);
 s.grip([-.96,0,0],[-.43,0,0],.047);s.grip([-.09,0,0],[.18,0,0],.047);
}

/** 朱雀翎 — phoenix head with the beak as the point, gilt wing guard, tail plume. */
function vermilionPlume(s:Sculpture){
 poleShaft(s);
 lathe(s,[[.045,.70],[.07,.76],[.058,.86],[.075,.95],[.05,.99]],0,s.metal,'body',24);
 const head:P[]=[[.92,-.05],[1.02,.10],[1.20,.16],[1.36,.12],[1.48,.06],[1.86,0],[1.48,-.03],[1.30,-.08],[1.08,-.10]];
 s.plate(head,.05,[0,0,0],s.metal,'body',.006);
 s.plate(head.map(([x,y])=>[1.25+(x-1.25)*.8,y*.75]as P),.062,[0,0,0],s.coat,'body',.005);
 for(const side of[-1,1]){dot(s,.018,[1.33,.065,side*.034],s.glow,[1,1,.4]);s.outline([[1.38,.04,side*.034],[1.62,.012,side*.03],[1.80,.002,side*.028]],.005,s.glow);}
 // Swept crest.
 for(const [k,m]of[[0,s.glow],[1,s.metal],[2,s.coat]]as const)s.plate(leaf(1.20-k*.05,.14-k*.01,.86-k*.08,.36-k*.05,.035-k*.004),.016,[0,0,0],m,'body',.004);
 // Fanned wing guard on both sides of the socket.
 for(const sign of[-1,1])for(let i=0;i<4;i++){
  const tipX=.50+i*.07,tipY=sign*(.34-i*.05);s.plate(leaf(.92,sign*.04,tipX,tipY,.04-i*.004),.014,[0,0,(i%2?.012:-.012)],i===0?s.glow:i%2?s.metal:s.coat,'body',.004);
  s.outline([[.92,sign*.04,.02],[tipX,tipY,.02]],.004,s.metal);
 }
 tube(s,[[.80,-.05,0],[.74,-.20,.03],[.80,-.36,-.02],[.70,-.48,.02]],.012,s.glow,'body',32);
 // Short tail plume at the butt.
 s.rod([-1.80,0,0],[-1.68,0,0],.06,s.metal,'body',.045);
 for(const sign of[-1,0,1])s.plate(leaf(-1.70,0,-1.86,sign*.12,.03),.012,[0,0,0],sign?s.coat:s.glow,'body',.003);
}

/** 潮月偃刀 — crescent glaive pierced by a moon; a star ring orbits the socket. */
function tideMoon(s:Sculpture){
 poleShaft(s,.84);
 lathe(s,[[.045,.76],[.07,.80],[.06,.88],[.072,.94],[.05,.97]],0,s.metal,'body',24);
 const blade:P[]=[[.92,-.06],[1.20,-.12],[1.50,-.10],[1.74,0],[1.90,.16],[1.96,.36],[1.80,.22],[1.60,.13],[1.38,.10],[1.18,.12],[1.02,.16],[.93,.10]];
 cutPlate(s,blade,[circle(1.16,.01,.062,28)],.035,[0,0,0],s.metal,'body',.006);
 const inner:P[]=[[1.26,-.06],[1.52,-.05],[1.72,.03],[1.84,.17],[1.70,.15],[1.50,.07],[1.30,.05]];
 for(const side of[-1,1]){
  s.plate(inner,.006,[0,0,side*.022],s.coat,'body',.002);
  s.outline([[1.0,-.085,side*.02],[1.20,-.115,side*.02],[1.50,-.095,side*.02],[1.74,.005,side*.02],[1.90,.165,side*.02],[1.95,.33,side*.02]],.005,s.glow);
  s.ring(.062,.008,[1.16,.01,side*.02],s.glow);
 }
 // Wave curl on the concave spine.
 s.plate([[.93,.10],[1.02,.16],[1.0,.22],[.94,.19]],.03,[0,0,0],s.metal,'body',.004);
 s.outline(Array.from({length:30},(_,i)=>{const t=i/29*TAU*1.25,r=.07-.05*i/29;return[.99+Math.cos(t)*r,.28+Math.sin(t)*r,0]as const;}),.012,s.metal);
 // Star ring around the shaft.
 s.spin('halo',[.64,0,0],1.4,6);
 s.ring(.15,.012,[.64,0,0],s.metal,'halo','x');s.ring(.15,.005,[.66,0,0],s.glow,'halo','x');
 for(let i=0;i<3;i++){const a=i/3*TAU;s.rod([.64,Math.cos(a)*.048,Math.sin(a)*.048],[.64,Math.cos(a)*.146,Math.sin(a)*.146],.006,s.metal,'halo');}
 for(let i=0;i<4;i++){const a=i/4*TAU+Math.PI/4,y=Math.cos(a)*.15,z=Math.sin(a)*.15,star=s.plate(circle(0,0,.032,8).map(([x,v],k)=>k%2?[x*.4,v*.4]as P:[x,v]as P),.008,[.64,y,z],s.glow,'halo',.002);star.rotation.set(a-Math.PI/2,0,0);}
 tube(s,[[.84,-.05,0],[.78,-.22,.03],[.86,-.38,-.02]],.01,s.glow,'body',24);
 s.rod([-1.86,0,0],[-1.72,0,0],.05,s.metal,'body',0,10);
}

/** 雷霆斧戟 — lightning-cut axe, back hook, spear tip and a copper coil. */
function stormHalberd(s:Sculpture){
 poleShaft(s,.92);
 const copper=material(s,'Sculpt_copper_metal',{color:0xc77a45,metalness:.9,roughness:.3,clearcoat:.4});
 const coil:V[]=Array.from({length:121},(_,i)=>{const t=i/120,a=t*TAU*9;return[.30+.42*t,Math.cos(a)*.056,Math.sin(a)*.056];});tube(s,coil,.008,copper,'body',220);
 for(const x of[.29,.73])s.ring(.06,.01,[x,0,0],s.glow,'body','x');
 lathe(s,[[.045,.80],[.075,.84],[.065,.96],[.08,1.20],[.05,1.24]],0,s.metal,'body',24);
 s.plate([[1.20,-.035],[1.55,-.05],[1.88,0],[1.55,.05],[1.20,.035]],.03,[0,0,0],s.metal,'body',.005);
 for(const side of[-1,1])s.outline([[1.24,0,side*.018],[1.80,0,side*.014]],.004,s.glow);
 const axe:P[]=[[.92,.06],[.96,.40],[1.10,.52],[1.30,.50],[1.40,.38],[1.34,.22],[1.24,.10],[1.18,.06]];
 const bolt:P[]=[[1.08,.45],[1.17,.45],[1.12,.33],[1.19,.33],[1.06,.14],[1.10,.28],[1.03,.28]];
 cutPlate(s,axe,[bolt],.032,[0,0,0],s.metal,'body',.006);s.plate(bolt,.008,[0,0,0],s.glow,'body',.002);
 for(const side of[-1,1]){
  s.outline([[.96,.40,side*.019],[1.10,.52,side*.019],[1.30,.50,side*.019],[1.40,.38,side*.019]],.005,s.glow);
  for(const [x,y]of[[1.0,.10],[1.27,.14]]as const)dot(s,.012,[x,y,side*.021],s.dark,[1,1,.4]);
 }
 s.plate([[.96,-.05],[1.10,-.08],[1.20,-.22],[1.14,-.34],[1.10,-.22],[1.0,-.14],[.94,-.10]],.03,[0,0,0],s.metal,'body',.005);
 s.rod([-1.88,0,0],[-1.72,0,0],.05,s.metal,'body',0,8);
}

// ---------------------------------------------------------------- blades

/** 齿轮裁决 — a cleaver with an open gear housing and a saw cog that spins. */
function clockworkCleaver(s:Sculpture){
 s.grip([-.66,0,0],[-.15,0,0],.062);
 s.mesh(new THREE.CylinderGeometry(.078,.078,.06,6),s.metal,[-.69,0,0],'body',[0,0,Math.PI/2]);dot(s,.03,[-.725,0,0],s.glow,[.5,1,1]);
 s.box([.10,.32,.13],[-.10,-.03,0],s.metal,'body',.02);
 for(const side of[-1,1]){s.ring(.04,.01,[-.10,.06,side*.07],s.dark);dot(s,.016,[-.10,.06,side*.072],s.glow,[1,1,.4]);}
 const hole=circle(.62,-.05,.15,32);
 cutPlate(s,[[-.05,-.30],[-.05,.15],[1.08,.15],[1.20,.10],[1.24,-.06],[1.12,-.27],[0,-.29]],[hole],.036,[0,0,0],s.coat,'body',.005);
 s.plate([[0,-.272],[1.10,-.252],[1.22,-.07],[1.27,-.05],[1.15,-.31],[0,-.325]],.018,[0,0,0],s.metal,'body',.003);
 for(const side of[-1,1]){
  s.outline([[.02,-.30,side*.012],[1.12,-.285,side*.012],[1.25,-.06,side*.012]],.004,s.glow);
  s.ring(.155,.012,[.62,-.05,side*.022],s.metal);
  for(let i=0;i<6;i++){const a=i/6*TAU;dot(s,.011,[.62+Math.cos(a)*.18,-.05+Math.sin(a)*.18,side*.022],s.metal,[1,1,.5]);}
  s.outline([[.10,.10,side*.021],[.40,.10,side*.021]],.005,s.metal);s.outline([[.84,.10,side*.021],[1.08,.10,side*.021]],.005,s.metal);
  // Escapement fork and balance wheel near the heel.
  s.ring(.045,.007,[.20,-.14,side*.022],s.metal);s.rod([.20,-.14,side*.024],[.36,-.04,side*.024],.006,s.metal);
 }
 s.box([1.14,.035,.05],[.53,.165,0],s.metal,'body',.01);
 s.spin('saw',[.62,-.05,0],2.2,8,'z');
 const teeth=18,gear:P[]=[];for(let i=0;i<teeth;i++){const a=i/teeth*TAU,w=TAU/teeth;gear.push([Math.cos(a)*.105,Math.sin(a)*.105],[Math.cos(a+w*.25)*.135,Math.sin(a+w*.25)*.135],[Math.cos(a+w*.55)*.135,Math.sin(a+w*.55)*.135],[Math.cos(a+w*.8)*.105,Math.sin(a+w*.8)*.105]);}
 cutPlate(s,gear,Array.from({length:5},(_,i)=>circle(Math.cos(i/5*TAU)*.062,Math.sin(i/5*TAU)*.062,.022,12)),.028,[.62,-.05,0],s.metal,'saw',.004);
 disc(s,.03,.05,[.62,-.05,0],s.glow,'saw',16);
}

/** 蛇影波刃 — a seven-wave kris; a serpent coils up the forte into the guard. */
function serpentKris(s:Sculpture){
 s.grip([-.62,0,0],[-.16,0,0],.058);
 const tail:V[]=Array.from({length:40},(_,i)=>{const t=i/39,a=t*TAU*1.6,r=.07-.05*t;return[-.64-.12*t,Math.cos(a)*r,Math.sin(a)*r];});tube(s,tail,.022,s.coat,'body',60);
 s.rod(tail[39],[-.80,0,.0],.012,s.metal,'body',0,6);
 const top:P[]=[],bottom:P[]=[];
 for(let i=0;i<=42;i++){const x=.05+1.45*i/42,t=(x-.05)/1.45,w=.08*(1-t*.82),y=.035*Math.sin(t*7*Math.PI);top.push([x,y+w]);bottom.push([x,y-w]);}
 const outline:P[]=[...top,[1.56,0],...bottom.reverse()];
 const steel=material(s,'Sculpt_blade_metal',{color:0x9aa1b8,metalness:.88,roughness:.24,clearcoat:.5,iridescence:.35,iridescenceThicknessRange:[260,520]});
 s.plate(outline,.03,[0,0,0],steel,'body',.004);
 for(const side of[-1,1]){
  s.outline(top.map(([x,y])=>[x,y-.006,side*.018]as const),.004,s.metal);s.outline(bottom.map(([x,y])=>[x,y+.006,side*.018]as const),.004,s.metal);
  s.outline(top.slice(0,40).map(([x,y],i)=>[x,y-.08*(1-i/42*.82),side*.02]as const),.005,s.glow);
 }
 // Serpent: body coiling up the forte, hood and head forming the guard.
 tube(s,[[-.14,-.06,0],[-.04,-.12,.05],[.08,-.07,.06],[.11,.03,.05],[.07,.12,.03],[.11,.19,0]],.03,s.coat,'body',48);
 for(let i=0;i<5;i++)band(s,.032,.005,[-.10+i*.05,-.09+i*.035,.04],s.metal);
 s.plate([[.02,.10],[-.04,.22],[.04,.30],[.16,.30],[.22,.22],[.18,.12]],.03,[0,0,0],s.coat,'body',.006,true);
 s.plate([[.12,.18],[.20,.26],[.32,.25],[.36,.21],[.30,.16],[.18,.15]],.05,[0,0,0],s.coat,'body',.008,true);
 for(const side of[-1,1]){
  dot(s,.014,[.27,.23,side*.027],s.glow,[1,1,.5]);
  for(let r=0;r<3;r++)for(let k=0;k<3-r;k++)dot(s,.01,[.06+k*.04+r*.02,.17+r*.04,side*.017],s.metal,[1,1,.4]);
 }
 for(const z of[-.012,.012])s.rod([.33,.17,z],[.34,.12,z],.007,s.pearl,'body',0,6);
 s.outline([[.36,.21,0],[.43,.21,0],[.46,.23,.01]],.003,s.glow);s.outline([[.43,.21,0],[.46,.19,-.01]],.003,s.glow);
 s.box([.06,.18,.09],[-.13,0,0],s.metal,'body',.02);
}

/** 霜牙 — translucent ice around a glowing core; spurs, frost crown, icicle pommel. */
function frostFang(s:Sculpture){
 s.grip([-.64,0,0],[-.16,0,0],.06);
 const ice=material(s,'Sculpt_crystal_ice',{color:s.style.body,metalness:0,roughness:.05,clearcoat:1,iridescence:s.style.iris,transparent:true,opacity:.62,depthWrite:false});
 const blade:P[]=[[.03,0],[.20,.12],[.62,.11],[1.05,.085],[1.40,.04],[1.58,0],[1.30,-.06],[.85,-.09],[.40,-.10],[.18,-.09]];
 s.plate(blade.map(([x,y])=>[x,y]as P),.02,[0,0,0],ice,'body',.028);
 s.plate(blade.map(([x,y])=>[.10+(x-.10)*.86,y*.42]as P),.012,[0,0,0],s.glow,'body',.003);
 for(const [x,h]of[[.30,.10],[.55,.13],[.82,.09],[1.05,.07]]as const)s.rod([x,.10,0],[x+.06,.10+h,0],.024,ice,'body',0,6);
 for(let i=0;i<8;i++){const a=i/8*TAU,l=i%2?.10:.17;s.rod([-.12,Math.cos(a)*.05,Math.sin(a)*.05],[-.10,Math.cos(a)*(.05+l),Math.sin(a)*(.05+l)],.026,ice,'body',0,6);}
 s.box([.17,.12,.12],[-.075,0,0],s.metal,'body',.03);dot(s,.04,[-.12,0,0],s.glow);
 s.rod([-.66,0,0],[-.84,0,0],.042,ice,'body',0,6);
 for(const [y,z]of[[.035,.02],[-.03,-.025]]as const)s.rod([-.66,y,z],[-.76,y*2.4,z*2.4],.022,ice,'body',0,6);
 s.ring(.064,.01,[-.65,0,0],s.metal,'body','x');
}

// ---------------------------------------------------------------- hammers

function hammerHaft(s:Sculpture,end=.30){
 s.rod([-1.38,0,0],[end,0,0],.052,s.metal);s.grip([-1.22,0,0],[-.51,0,0],.063);
 s.sphere(.082,[-1.34,0,0],s.coat,[.75,1,1]);s.ring(.068,.013,[-1.30,0,0],s.metal,'body','x');
}

/** 熔城钟鸣 — an upright cast bell head (mouth down) with furnace light and a whirling gear ring. */
function foundryBell(s:Sculpture){
 hammerHaft(s,.22);
 const cx=.48,cy=.04,outer:P[]=[[0,-.29],[.14,-.29],[.20,-.26],[.24,-.18],[.255,-.05],[.28,.08],[.33,.18],[.39,.24],[.40,.27]];
 const inner:P[]=[[.36,.27],[.30,.20],[.24,.10],[.21,-.02],[.19,-.15],[.12,-.22],[0,-.22]];
 // Profile y runs crown→mouth; flipping it puts the crown on top and the mouth facing the strike.
 const g=new THREE.LatheGeometry([...outer,...inner].map(([r,y])=>new THREE.Vector2(r,y)),36);g.rotateX(Math.PI);s.mesh(g,s.dark,[cx,cy,0]);
 const rAt=(depth:number)=>{for(let i=1;i<outer.length;i++){const [r0,z0]=outer[i-1],[r1,z1]=outer[i];if(depth>=z0&&depth<=z1&&z1>z0)return r0+(r1-r0)*(depth-z0)/(z1-z0);}return .25;};
 const flat:V=[Math.PI/2,0,0];
 s.mesh(new THREE.TorusGeometry(.395,.02,8,40),s.metal,[cx,cy-.268,0],'body',flat);s.mesh(new THREE.TorusGeometry(.258,.012,8,40),s.metal,[cx,cy+.16,0],'body',flat);
 s.mesh(new THREE.CylinderGeometry(.22,.22,.012,28),s.glow,[cx,cy-.11,0]);
 s.rod([cx,cy+.22,0],[cx,cy-.16,0],.016,s.metal);s.sphere(.06,[cx,cy-.19,0],s.dark);
 s.ring(.05,.012,[cx,cy+.32,0],s.metal);
 // Furnace cracks on the shoulder, drawn on the actual surface.
 for(let k=0;k<6;k++){const a0=k/6*TAU+.3;s.outline([.20,.12,.04,-.06].map((d,i)=>{const a=a0+(i%2?.12:-.05),r=rAt(d)+.004;return[cx+Math.cos(a)*r,cy-d,Math.sin(a)*r]as const;}),.006,s.glow);}
 s.rod([.20,0,0],[.25,0,0],.078,s.metal);
 s.spin('gear',[cx,cy+.02,0],.5,10,'y');
 s.mesh(new THREE.TorusGeometry(.272,.02,8,40),s.metal,[cx,cy+.02,0],'gear',flat);
 for(let i=0;i<18;i++){const a=i/18*TAU,t=s.box([.05,.045,.045],[cx+Math.cos(a)*.30,cy+.02,Math.sin(a)*.30],s.metal,'gear',.008);t.rotation.y=-a;}
 for(let i=0;i<3;i++){const a=i/3*TAU+.5;dot(s,.02,[cx+Math.cos(a)*.272,cy+.045,Math.sin(a)*.272],s.glow,[1,1,1],'gear');}
}

/** 彗星推进锤 — honeycomb impact face below, rocket nozzle with a spinning turbine on top. */
function cometThruster(s:Sculpture){
 hammerHaft(s,.24);
 const cx=.48,cy=.04,flat:V=[Math.PI/2,0,0];
 s.mesh(new THREE.CylinderGeometry(.27,.27,.40,32),s.coat,[cx,cy,0]);
 for(const y of[-.10,.10])s.mesh(new THREE.TorusGeometry(.272,.012,8,40),s.glow,[cx,cy+y,0],'body',flat);
 s.mesh(new THREE.CylinderGeometry(.29,.29,.05,32),s.dark,[cx,cy-.225,0]);
 const face=cutPlate(s,circle(0,0,.27,32),honeycomb(circle(0,0,.27,32),-.24,.24,-.22,.24,.032,.085),.02,[cx,cy-.26,0],s.metal,'body',.004);face.rotation.x=Math.PI/2;
 const nozzle:P[]=[[.14,0],[.10,.04],[.12,.10],[.18,.18],[.235,.24],[.215,.245],[.165,.19],[.11,.12],[.09,.05],[.12,0]];
 s.mesh(new THREE.LatheGeometry(nozzle.map(([r,y])=>new THREE.Vector2(r,y)),32),s.metal,[cx,cy+.20,0]);
 s.mesh(new THREE.CylinderGeometry(.10,.10,.012,24),s.glow,[cx,cy+.215,0]);
 s.mesh(new THREE.TorusGeometry(.235,.01,8,40),s.glow,[cx,cy+.44,0],'body',flat);
 s.spin('fan',[cx,cy+.30,0],5,4,'y');
 dot(s,.035,[cx,cy+.30,0],s.dark,[1,1.4,1],'fan');
 for(let i=0;i<8;i++){const a=i/8*TAU,b=s.mesh(new THREE.BoxGeometry(.09,.012,.03),s.glow,[cx+Math.cos(a)*.06,cy+.30,Math.sin(a)*.06],'fan');b.rotation.y=-a;b.rotateX(.6);}
 // Three fins along the nozzle end: two on the faces, one forward.
 for(const sign of[-1,1]){const fin=s.plate([[.25,0],[.25,.20],[.42,.32],[.44,.06]].map(([z,y])=>[z*sign,y]as P),.02,[cx,cy,0],s.dark,'body',.004);fin.rotation.y=-Math.PI/2;}
 s.plate([[cx+.25,cy],[cx+.25,cy+.20],[cx+.42,cy+.32],[cx+.44,cy+.06]],.02,[0,0,0],s.dark,'body',.004);
 for(const side of[-1,1])dot(s,.035,[cx,cy-.06,side*.27],s.pearl,[1,1,.4]);
 s.rod([.18,0,0],[.22,0,0],.07,s.metal);
}

/** 紫晶洞 — a rock shell split on both faces, amethyst clusters inside. */
function amethystGeode(s:Sculpture){
 hammerHaft(s,.20);
 const crystal=material(s,'Sculpt_crystal',{color:s.style.accent,emissive:s.style.accent,emissiveIntensity:.22,metalness:.05,roughness:.08,clearcoat:1,iridescence:s.style.iris});
 const cx=.48,cy=.04,rock=new THREE.DodecahedronGeometry(.36,1);
 const p=rock.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+.09*Math.sin(x*23+y*17)*Math.cos(z*19);p.setXYZ(i,x*n*1.04,y*n*.96,z*n*.7);}
 rock.computeVertexNormals();s.mesh(rock,s.dark,[cx,cy,0]);
 for(const side of[-1,1]){
  s.sphere(.24,[cx,cy,side*.205],s.coat,[1,1,.2]);
  for(let i=0;i<13;i++){
   const a=i*2.399,r=.035+.17*Math.sqrt(i/13),bx=cx+Math.cos(a)*r,by=cy+Math.sin(a)*r,len=.07+.05*((i*7)%4)/3,w=.022+.008*(i%3);
   const dx=Math.cos(a)*r*.6,dy=Math.sin(a)*r*.6,base:V=[bx,by,side*.19],mid:V=[bx+dx*.5,by+dy*.5,side*(.19+len)],tip:V=[bx+dx*.7,by+dy*.7,side*(.21+len+w*1.6)];
   s.rod(base,mid,w,crystal,'body',w,6);s.rod(mid,tip,w,crystal,'body',0,6);
  }
 }
 s.ring(.37,.018,[cx,cy,0],s.metal);for(let i=0;i<8;i++){const a=i/8*TAU;dot(s,.02,[cx+Math.cos(a)*.375,cy+Math.sin(a)*.375,0],s.metal,[1,1,1.5]);}
 s.rod([.16,0,0],[.20,0,0],.075,s.metal);
}

export function buildFourthCollection(s:Sculpture,model:string){
 switch(model as FourthCollectionModel){
  case'turbine':tidalEngine(s);break;case'hive':amberApiary(s);break;case'courier':sealedPassage(s);break;
  case'porcelain':celadonAtlas(s);break;case'lacquer':nightNacre(s);break;case'arcade':mintArcade(s);break;
  case'parade':guardSash(s);break;case'whalefall':abyssalRequiem(s);break;case'rose':velvetThorn(s);break;
  case'phoenix':vermilionPlume(s);break;case'bell':foundryBell(s);break;
  case'cogsaw':clockworkCleaver(s);break;case'kris':serpentKris(s);break;case'frostfang':frostFang(s);break;
  case'glaive':tideMoon(s);break;case'halberd':stormHalberd(s);break;
  case'rocket':cometThruster(s);break;case'geode':amethystGeode(s);break;
  default:throw new Error(`Unknown structural skin model: ${model}`);
 }
}
