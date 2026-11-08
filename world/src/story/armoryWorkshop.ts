import * as THREE from 'three';
import {SiteArt} from './campaignSites';

// The original workshop walls, bench, racks and their ordered collision remain
// authoritative. This fitted interior occupies their existing surfaces.
export const ARMORY_WORKSHOP = Object.freeze({
  center: [-74,10,250] as const,
  clearance: [[-86.5,237.5,-61.5,262.5],[-104,247,-86,253],[-86,263,-64,288]] as const,
});
type V3=[number,number,number];
const C={steel:'#536c75',ink:'#253a44',pale:'#d5ddd5',amber:'#c99756',teal:'#4d8f91',rubber:'#34434c',paper:'#e8dfc2'};
const GLYPHS:Record<string,string[]>={
 A:['01110','10001','10001','11111','10001','10001','10001'],
 R:['11110','10001','10001','11110','10100','10010','10001'],
 M:['10001','11011','10101','10101','10001','10001','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'],
 Y:['10001','10001','01010','00100','00100','00100','00100'],
 S:['01111','10000','10000','01110','00001','00001','11110'],
 G:['01110','10001','10000','10111','10001','10001','01110'],
};
/** Static, three-batch working armory. No progress state, new lights or downloads. */
export function createArmoryWorkshop(){
 const a=new SiteArt(),root=a.root;let disposed=false;
 const box=(p:V3,size:V3,color=C.steel)=>a.box(p,size,color);
 const metal=(p:V3,size:V3,color=C.steel)=>a.box(p,size,color,false,'metal');
 const beam=(p:V3,q:V3,w:number,color=C.steel)=>a.beam(p,q,w,color,false,'metal');
 const barrel=(x:number,y:number,z:number,r:number,length:number,color=C.ink)=>a.cyl([x,y,z],r,length,color,false,'metal',[Math.PI/2,0,0]);
 // Text is shallow physical lettering on the west-facing sign, not fake UI.
 const lettering=(text:string,x:number,y:number,z:number,pixel:number)=>{
  const width=(text.length*6-1)*pixel;
  [...text].forEach((ch,i)=>GLYPHS[ch].forEach((row,r)=>{
   for(const run of row.matchAll(/1+/g))box([x,y+(3-r)*pixel,z-width/2+(i*6+run.index!+(run[0].length-1)/2)*pixel],[.035,pixel*.92,pixel*(run[0].length-.08)],C.paper);
  }));
 };
 // Framed portal, planted column feet, the shutter cassette and a readable sign.
 for(const s of[-1,1]){
  metal([-12.48,2.85,s*7.32],[.20,5.7,.22]);
  metal([-12.49,.28,s*7.32],[.28,.55,.38],C.ink);
  for(const y of[.25,.8,5.1,5.55])barrel(-12.61,y,s*7.32,.045,.08,C.amber);
  // Raised front guards, wall joints and service vents occupy the existing wings.
  box([-12.43,.62,s*9.8],[.10,1.12,3.8],C.steel);
  for(const z of[s*8.3,s*11.3])metal([-12.47,3.55,z],[.08,6.5,.055],C.steel);
  box([-12.47,3.2,s*9.7],[.10,1.85,2.45],C.ink);
  for(let row=0;row<6;row++)metal([-12.55,2.43+row*.28,s*9.7],[.12,.075,2.21],C.steel);
  box([-12.48,4.8,s*9.7],[.13,.52,1.6],C.steel);
  lettering(s<0?'AR':'SG',-12.57,4.8,s*9.7,.05);
  for(const z of[s*8.25,s*11.35])box([-12.5,.65,z],[.08,.85,.07],C.amber);
 }
 box([-12.74,6.32,0],[.18,.94,8.2],C.ink);
 for(const y of[5.86,6.78])metal([-12.86,y,0],[.08,.06,8.28],C.amber);
 lettering('ARMORY',-12.86,6.32,0,.105);
 // Interior lower wall courses and pilasters break up the blank hangar shell.
 for(const s of[-1,1]){
  for(let i=0;i<8;i++){
   const x=-10.5+i*3;
   box([x,1.02,s*11.52],[2.9,1.78,.08],i%2?C.pale:'#c5d0cc');
   metal([x-1.45,3.22,s*11.48],[.07,6.25,.10],C.steel);
  }
  metal([0,2.05,s*11.46],[23,.09,.10],C.ink);
  metal([0,.18,s*11.46],[23,.24,.12],C.ink);
 }
 // I-beams, triangular roof braces, suspended task luminaires and cable trays.
 for(const x of[-8,0,8]){
  for(const y of[6.13,6.68])metal([x,y,0],[.38,.10,23],C.steel);
  metal([x,6.4,0],[.13,.48,23],C.ink);
  for(const s of[-1,1])beam([x,5.25,s*11.4],[x,6.12,s*9.7],.13);
  for(const z of[-5.5,5.5]){
   for(const q of[-1,1])beam([x,6.05,z+q*1.15],[x,5.68,z+q*1.15],.045);
   metal([x,5.61,z],[.58,.16,2.7],C.ink);
   a.box([x,5.52,z],[.43,.035,2.46],'#e4e5ca',false,'glow');
  }
 }
 for(const z of[-9.6,9.6]){
  metal([0,5.86,z],[23,.10,.28],C.ink);
  for(let x=-10;x<=10;x+=2)metal([x,5.92,z],[.07,.05,.45]);
 }
 // Nine recognizable display weapons on the existing three shelf rails.
 const weapon=(x:number,y:number,z:number,kind:number)=>{
  const accent=kind===0?C.teal:kind===1?C.amber:'#8a9caa',compact=kind===2;
  box([x,y,z],[.22,.24,compact?.57:.8],C.ink);
  metal([x-.13,y+.045,z],[.045,.14,compact?.47:.7],accent);
  box([x,y+.06,z-(compact?.55:.85)],[.19,.22,compact?.45:.7],C.rubber);
  metal([x,y+.06,z-(compact?.8:1.22)],[.27,.36,.07],C.ink);
  barrel(x,y+.04,z+(compact?.56:.94),kind===1?.067:.045,compact?.53:1.05);
  barrel(x,y+.04,z+(compact?.85:1.50),.07,.12);
  if(kind===1){
   barrel(x,y-.13,z+.62,.067,.73,accent);
   for(let k=0;k<5;k++)metal([x-.10,y-.13,z+.37+k*.12],[.045,.14,.045],C.ink);
  }else{
   box([x,y-.28,z-.07],[.16,.39,.20],accent);
   for(let k=0;k<4;k++)metal([x-.12,y+.02,z+.35+k*.12],[.035,.09,.045],C.steel);
  }
  a.box([x,y-.23,z-.38],[.15,.32,.14],C.rubber,false,'body',[.22,0,0]);
  metal([x,y+.20,z+.14],[.10,.07,.26],C.steel);
  for(const zz of[-.45,.52])metal([x,y+.26,z+zz],[.065,.10,.055],C.ink);
  // Open trigger guard: three sides instead of a filled rectangular block.
  metal([x,y-.17,z-.24],[.07,.045,.23],C.steel);
  for(const zz of[-.34,-.14])metal([x,y-.11,z+zz],[.07,.12,.035],C.steel);
 };
 for(let kind=0;kind<3;kind++){
  const z=-6+kind*6;
  for(const side of[-1,1])metal([10.27,1.64,z+side*2.1],[.10,3.2,.10]);
  metal([10.28,.16,z],[.14,.15,4.24],C.ink);
  for(let row=0;row<3;row++){
   weapon(9.91,.98+row*.9,z,kind);
   for(const dz of[-.75,.75])metal([10.08,.88+row*.9,z+dz],[.27,.12,.08],C.amber);
  }
  box([10.21,3.48,z],[.12,.42,1.4],C.ink);
  lettering(['AR','SG','SM'][kind],10.13,3.48,z,.045);
 }
 // Retrofit drawers and work surfaces onto the original solid central cabinet.
 for(const s of[-1,1])for(let i=0;i<3;i++){
  const x=-2+i*2;
  box([x,.51,s*1.115],[1.86,.80,.035],C.steel);
  for(const y of[.22,.49,.76]){
   box([x,y,s*1.14],[1.7,.225,.018],C.ink);
   metal([x,y+.03,s*1.16],[.43,.04,.035],C.amber);
  }
 }
 box([-3.025,.51,0],[.04,.82,2.04],C.steel);
 for(const y of[.23,.5,.77]){
  box([-3.05,y,0],[.025,.22,1.84],C.ink);
  metal([-3.085,y+.03,0],[.05,.045,.6],C.amber);
 }
 box([0,1.082,0],[5.52,.035,1.72],C.pale);
 box([-.45,1.118,0],[2.6,.03,1.25],C.rubber);
 a.paper(-1.22,1.15,.04,.75,.6);
 for(let k=0;k<3;k++)barrel(.25,1.185,-.35+k*.3,.035,.55,C.steel);
 metal([1.7,1.205,.18],[.62,.16,.45],C.steel);
 for(const x of[1.48,1.92])metal([x,1.385,.18],[.12,.30,.46],C.ink);
 beam([1.7,1.235,-.32],[1.7,1.235,.73],.055,C.amber);
 barrel(1.7,1.235,.77,.055,.12,C.ink);
 // Side-wall pegboards: real hanging tools, conduit, a dial and service notes.
 for(const s of[-1,1]){
  box([1.5,2.8,s*11.40],[6.2,1.35,.12],C.ink);
  for(let i=0;i<11;i++)for(let r=0;r<3;r++)box([-1.15+i*.52,2.35+r*.42,s*11.32],[.045,.045,.025],C.steel);
  for(let i=0;i<5;i++){
   const x=-.8+i*1.05,z=s*11.23;
   beam([x,2.35,z],[x+.18,3.1,z],.07,i%2?C.amber:C.pale);
   a.ring([x+.18,3.14,z],.12,.028,C.pale,'metal');
  }
  metal([-5,2.6,s*11.36],[.8,1.1,.12],C.steel);
  a.ring([-5,2.8,s*11.25],.24,.045,C.paper,'metal');
  beam([-5,2.8,s*11.19],[-4.86,2.94,s*11.19],.035,C.amber);
 }
 // Flush paint outlines the old bench and keeps the two actual circulation aisles legible.
 for(const z of[-1.55,1.55])box([0,.027,z],[7.1,.008,.055],C.amber);
 for(const x of[-3.55,3.55])box([x,.027,0],[.055,.008,3.15],C.amber);
 for(const z of[-3.7,3.7]){
  box([0,.027,z],[21,.008,.055],C.pale);
  for(let i=0;i<10;i++)box([-10+i*2,.029,z],[.35,.008,.10],C.amber);
 }
 a.finish('alpha');root.name='Armory_Workshop_Fitted_Interior';
 root.position.set(...ARMORY_WORKSHOP.center);
 root.traverse(o=>{if(o instanceof THREE.Mesh){o.name=`ArmoryWorkshop_${o.userData.campaignLayer}`;o.castShadow=false;}});
 return{root,
  dispose(){if(disposed)return;disposed=true;const materials=new Set<THREE.Material>(Object.values(a.materials));root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});materials.forEach(m=>m.dispose());root.removeFromParent();root.clear();},
 };
}
