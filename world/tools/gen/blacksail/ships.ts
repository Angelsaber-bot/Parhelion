/** Original handcrafted 1718 maritime art; all geometry is visual-only.
 * build.ts retains the untouched legacy ordered collision stream. */
import * as THREE from 'three';
import { Batch, BOX, T } from '../geo.js';
import type { Piece } from '../structures.js';
export interface MaritimeShipStyle { hull: string; hullDark: string; deck: string; sail: string; castle?: boolean; masts?: number; keel?: number }
const CYL = new THREE.CylinderGeometry(1,1,1,6);
const TAPER = new THREE.CylinderGeometry(.62,1,1,8);
type P=[number,number,number];
export function buildMaritimeShip(name:string,cx:number,cz:number,ry:number,len:number,deck:number,st:MaritimeShipStyle,waterLevel:number):Piece[]{
 const wreck=/Wreck/i.test(name),ghost=/Ghost/i.test(name),flagship=len>40;
 const kind=flagship?3:wreck?4:ghost?2:Math.abs(Math.round(cx))%3;
 const timber=new Batch(`${name}_Timber`,'M_BlackSailTimber'),canvas=new Batch(`${name}_Canvas`,ghost?'M_Beam':'M_BlackSailCanvas'),iron=new Batch(`${name}_Iron`,'M_BlackSailIron'),brass=new Batch(`${name}_Brass`,'M_BlackSailBrass'),rope=new Batch(`${name}_Rigging`,'M_BlackSailRope');
 const W=Math.max(6,len*.27),keel=st.keel??waterLevel-2.5,H=deck-keel,cos=Math.cos(ry),sin=Math.sin(ry);
 const p=([x,y,z]:P)=>new THREE.Vector3(cx+cos*x+sin*z,y,cz-sin*x+cos*z);
 const box=(b:Batch,x:number,y:number,z:number,w:number,h:number,d:number,c:string,yaw=0,rx=0)=>b.add(BOX,c,T(cx+cos*x+sin*z,y,cz-sin*x+cos*z,ry+yaw,w,h,d,rx),false);
 const rod=(b:Batch,a:P,c:P,r:number,color:string,taper=false)=>{const A=p(a),B=p(c),dir=B.clone().sub(A);b.add(taper?TAPER:CYL,color,new THREE.Matrix4().compose(A.add(B).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize()),new THREE.Vector3(r,dir.length(),r)),false);};
 const quad=(b:Batch,a:P,c:P,d:P,e:P,color:string)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([a,c,d,a,d,e].flatMap(q=>p(q).toArray()),3));b.add(g,color,new THREE.Matrix4(),false);};
 const woods=ghost?[st.hull,'#54888b','#6d9994',st.hullDark,'#73958a',st.hull]:[st.hull,'#795038',st.hull,'#916644',st.hullDark,'#6c4932'];
 // Top rim matches original rectangular deck + diamond bow; bilges curve below it.
 const us=[-len*.33-W*.50,-len*.33-W*.25,-len*.33,-len*.22,0,len*.23,len*.45],widths=[.035,.50,1,1,1,1,1];
 const section=(i:number,t:number,s:number):P=>{const v=widths[i];return [s*W*.5*v*(.16+.84*Math.pow(Math.sin(t*Math.PI/2),kind===0?.72:kind===1?1.16:.9)),keel+H*t+(1-v)**2*H*.65*(1-t),us[i]+(t-1)*(i===6?-len*.055:0)];};
 for(const s of [-1,1])for(let j=0;j<7;j++)for(let i=0;i<6;i++){
  // Geometric gaps expose ribs: wrecks are not solid intact ships or dark hole decals.
  if(wreck&&((i===2&&j<5&&s===1)||(i===4&&j>1&&j<5&&s===-1)||(i===0&&j<4)))continue;
  const a=j/7+.006,b=(j+1)/7-.006;const points=[section(i,a,s),section(i+1,a,s),section(i+1,b,s),section(i,b,s)];if(s>0)points.reverse();quad(timber,points[0],points[1],points[2],points[3],woods[(j+i)%woods.length]);timber.vis[timber.vis.length-1].userData.maritimeRole='hull-strake';
 }
 // Intact hulls have a continuous inset oak lining behind the caulked outer strakes.
 // It closes plank seams without filling the genuine breach openings on wrecks.
 if(!wreck)for(const side of [-1,1])for(let i=0;i<6;i++)for(let j=0;j<7;j++){
  const inner=(k:number,t:number):P=>{const q=section(k,t,side);q[0]*=.985;return q;};
  const a=[inner(i,j/7),inner(i+1,j/7),inner(i+1,(j+1)/7),inner(i,(j+1)/7)];if(side>0)a.reverse();quad(timber,a[0],a[1],a[2],a[3],st.hullDark);
 }
 for(let j=0;j<7;j++)quad(timber,section(6,j/7,-1),section(6,j/7,1),section(6,(j+1)/7,1),section(6,(j+1)/7,-1),woods[j%woods.length]);
 rod(timber,[0,keel,-len*.33-W*.45],[0,keel,len*.40],.2,st.hullDark);
 for(const s of [-1,1])for(const t of [.32,.72,.96])for(let i=0;i<6;i++){if(wreck&&i===2&&s===1&&t<.9)continue;rod(timber,section(i,t,s),section(i+1,t,s),t===.72?.12:.085,st.hullDark);}
 // These exact deck surfaces correspond to the unchanged legacy collision boxes.
 // Single top skin of the exact rectangle/diamond union: no coplanar overlapping bow.
 const half=(W-.3)/2,diamond=(W*.72-.3)/Math.sqrt(2),z0=-len*.33,z1=len*.45;
 const rim:P[]=[[0,deck,z0-diamond],[diamond,deck,z0],[half,deck,z0+Math.max(0,diamond-half)],[half,deck,z1],[-half,deck,z1],[-half,deck,z0+Math.max(0,diamond-half)],[-diamond,deck,z0]];
 const vertices:number[]=[];
 for(let i=0;i<rim.length;i++){const a=rim[i],c=rim[(i+1)%rim.length];vertices.push(...p([0,deck,len*.06]).toArray(),...p(c).toArray(),...p(a).toArray());quad(timber,a,c,[c[0],deck-.3,c[2]],[a[0],deck-.3,a[2]],st.deck);}
 const skin=new THREE.BufferGeometry();skin.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));timber.add(skin,st.deck,new THREE.Matrix4(),false);
 // Long laid planks with staggered butt joints, not a regular checkerboard.
 for(let x=-W/2+.65,index=0;x<W/2-.3;x+=.72,index++)for(let z=-len*.30+(index%4)*1.13;z<len*.43;z+=4.52)box(timber,x+.34,deck+.008,z,Math.min(.68,W/2-.2-x),.015,.026,ghost?'#537d79':'#6e5037');
 for(let x=-W/2+.65;x<W/2-.3;x+=.72)box(timber,x,deck+.012,len*.06,.026,.018,len*.76,st.hullDark);
 for(const s of [-1,1]){const x=s*(W/2-.15);box(timber,x,deck+.92,len*.06,.30,.15,len*.62,st.hullDark);box(timber,x,deck+.20,len*.06,.22,.30,len*.62,st.hull);for(let z=-len*.24;z<len*.37;z+=1.6)rod(timber,[x,deck+.3,z],[x,deck+.91,z],.085,st.hullDark);}
 if(st.castle){
  const u0=len*.3,u1=len*.45,h=2.4,z=(u0+u1)/2;box(timber,0,deck+h/2,z,W,h,u1-u0,st.hull);box(timber,0,deck+h+.1,z,W-.2,.2,u1-u0,st.deck);
  const q=p([W/2-1.4,0,u0-3.2]),n=timber.col.length;timber.ramp(q.x,q.z,deck,deck+h+.2,6.4,2.2,st.deck,ry+Math.PI);timber.col.length=n;
  for(let zz=u0+.25;zz<u1;zz+=.65)box(timber,0,deck+h+.208,zz,W-.25,.016,.026,st.hullDark);
  for(let xx=-W/2+.5;xx<W/2;xx+=.7)box(timber,xx,deck+h+.21,z,.026,.018,u1-u0,st.hullDark);
  for(const side of [-1,1]){box(timber,side*(W/2-.15),deck+h+.99,z,.24,.12,u1-u0,st.hullDark);for(let zz=u0+.2;zz<u1;zz+=.75)rod(timber,[side*(W/2-.15),deck+h+.2,zz],[side*(W/2-.15),deck+h+.98,zz],.075,st.hullDark);}
  box(timber,0,deck+h+.99,u1+.1,W,.12,.24,st.hullDark);
  for(let xx=-W/2+.2;xx<W/2;xx+=.75)rod(timber,[xx,deck+h+.2,u1+.1],[xx,deck+h+.98,u1+.1],.075,st.hullDark);
  // Broad transom gallery with small leaded windows, mouldings and brass cornerwork.
  for(let x=-W*.34;x<=W*.35;x+=W*.17){box(iron,x,deck+1.15,u1+.025,W*.105,1.05,.08,ghost?'#2f646a':'#233e42');for(const dx of [-W*.056,W*.056])box(brass,x+dx,deck+1.15,u1+.08,.055,1.18,.06,'#b89a62');box(brass,x,deck+1.15,u1+.08,W*.11,.055,.06,'#b89a62');}
  for(const h0 of [.5,1.85,2.25])box(timber,0,deck+h0,u1+.1,W+.15,.10,.12,ghost?'#89aaa0':'#c49b65');
 }
 if(wreck)for(let i=1;i<6;i++)for(const s of [-1,1]){for(let j=0;j<5;j++)rod(timber,section(i,j/5,s),section(i,(j+1)/5,s),.15,'#a47c53');if(i%2===0)rod(timber,[s*W*.42,deck-1.1,us[i]],[s*W*.58,deck-.2,us[i]+.6],.12,'#b28c60');}
 // Rising sheer at the foredeck; the nose remains open for the legacy gangway.
 for(const side of [-1,1])for(let i=1;i<3;i++){
  const a=section(i,1,side),b=section(i+1,1,side);a[1]=deck+.85+(3-i)*.16;b[1]=deck+.85+(2-i)*.16;
  rod(timber,a,b,.10,st.hullDark);rod(timber,[a[0],deck,a[2]],a,.07,st.hullDark);
 }
 const bow=us[0];rod(timber,[0,deck+2.6,-len*.22],[0,deck+3.6,bow-3.2],.18,st.hullDark,true);rod(rope,[0,deck+3.6,bow-3.2],[0,keel+H*.55,bow+.25],.035,'#a99a73');
 // Short iron guns on timber four-wheel trucks; waist and bridge entrances remain clear.
 if(!wreck)for(const s of [-1,1])for(let i=0;i<(flagship?7:kind===0?3:4);i++){
  const count=flagship?7:kind===0?3:4,z=-len*.20+i*len*.43/(count-1),x=s*(W/2+.02);
  box(iron,x,deck-.85,z,.08,.73,.85,'#252e30');box(timber,x+s*.07,deck-.39,z,.11,.12,1.02,st.hullDark);rod(iron,[x-s*.4,deck-.82,z],[x+s*.65,deck-.82,z],.17,'#454b4c',true);
  if((i===0||i===count-1)&&len>26){const gx=s*(W/2-.9);box(timber,gx,deck+.20,z,.9,.28,.65,'#784d32');rod(iron,[gx-s*.45,deck+.6,z],[gx+s*.8,deck+.6,z],.18,'#3f4948',true);for(const dz of [-.32,.32])for(const dx of [-.30,.30])rod(timber,[gx+dx-.07,deck+.17,z+dz],[gx+dx+.07,deck+.17,z+dz],.17,st.hullDark);}
 }
 for(const z of [-len*.07,len*.20]){box(timber,0,deck+.025,z,W*.25,.045,1.45,st.hullDark);for(let x=-W*.115;x<W*.12;x+=.26)box(timber,x,deck+.055,z,.09,.045,1.35,st.deck);}
 const masts=st.masts??(len>30?3:2);
 for(let k=0;k<masts;k++){
  const u=-len*.22+k*len*.48/Math.max(1,masts-1),mh=len*.75*(k===1&&masts===3?1.12:1),top=deck+mh*(wreck?(k===0?.70:.58):1);
  rod(timber,[0,deck,u],[0,top,u],.28,st.hullDark,true);
  // Legacy gliding collision contains the full-height primary spar: keep it visible.
  // Damage is in stripped upper timber, missing yards, torn canvas and breached hull.
  if(wreck)rod(timber,[0,top,u],[0,deck+mh,u],.28,'#997750',true);
  for(const h of [.12,.35,.60])if(deck+mh*h<top)rod(rope,[-.29,deck+mh*h,u],[.29,deck+mh*h,u],.055,'#b2a27b');
  const levels=wreck?[.40]:kind===1&&k===masts-1?[.54]:[.45,.78];
  for(const yy of levels){
   const span=W*1.22*(yy>.6?.75:1),y=deck+mh*yy+2.4;if(y>top+.3)continue;
   const lateen=kind===1&&k===masts-1;rod(timber,[-span*.54,y+(lateen?-1.5:0),u],[span*.54,y+(lateen?1.5:0),u],.115,st.hullDark,true);
   const rows=4,cols=6,drop=mh*(yy>.6?.21:.29);
   const sailPoint=(i:number,j:number):P=>{const t=i/cols,v=j/rows,sag=Math.sin(Math.PI*t);return [lateen?-span*.5+t*span*(1-v):(t-.5)*span*(1-.15*v),lateen?(1-v)*(y+(t-.5)*3)+v*(y-drop):y-drop*v-.18*sag,u+.16+Math.sin(Math.PI*v)*sag*(wreck?.45:.85)];};
   for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){if((wreck||ghost)&&j===rows-1&&(i+k)%3===0)continue;if(wreck&&i===0&&j>1)continue;quad(canvas,sailPoint(i,j),sailPoint(i+1,j),sailPoint(i+1,j+1),sailPoint(i,j+1),(i+j+k)%5===0?(ghost?'#a0cec8':'#d3c3a0'):st.sail);}
   for(const i of [0,2,4,6])for(let j=0;j<rows;j++){if(wreck&&i===0&&j>1)continue;if((wreck||ghost)&&j===rows-1&&(Math.min(i,5)+k)%3===0)continue;rod(rope,sailPoint(i,j),sailPoint(i,j+1),.014,ghost?'#78aca5':'#b9a783');}
   for(const s of [-1,1])rod(rope,sailPoint(s===1?cols:wreck?1:0,(wreck||ghost)?rows-1:rows),[s*(W/2-.15),deck+1,u+2],.025,'#92896e');
  }
  // Sparse shrouds and ratlines remain outboard of walkable route and boss sightlines.
  if(!wreck)for(const s of [-1,1]){const x=s*(W/2-.2),h=deck+mh*.65;
  // Pitch-dark ash deadeyes and iron chainplates at the lower shrouds (QAR evidence).
  for(const dz of [-1.6,1.6]){
   rod(iron,[x,deck+.65,u+dz],[x,deck-.55,u+dz+.08],.045,'#414745');
   for(const dy of [.48,.85]){rod(timber,[x-.07,deck+dy,u+dz],[x+.07,deck+dy,u+dz],.16,'#574a35');
    for(const [oy,oz] of [[.06,0],[-.04,-.06],[-.04,.06]])rod(iron,[x-.075,deck+dy+oy,u+dz+oz],[x+.075,deck+dy+oy,u+dz+oz],.022,'#282e2a');
   }
  }
  for(const dz of [-1.6,1.6])rod(rope,[x,deck+1,u+dz],[0,h,u],.032,'#948973');for(let n=1;n<=4;n++){const t=n/6;rod(rope,[x*(1-t),deck+1+(h-deck-1)*t,u-1.6*(1-t)],[x*(1-t),deck+1+(h-deck-1)*t,u+1.6*(1-t)],.018,'#a99b7b');}}
 }
 if(flagship)for(const s of [-1,1])for(let j=0;j<3;j++)rod(brass,[s*W*.42,deck+.1+j*.5,len*.44],[s*W*.51,deck+.45+j*.5,len*.48],.09,'#bdac6a');
 return [timber,canvas,iron,brass,rope].filter(b=>b.vis.length).map(batch=>({name:batch.name,material:batch.material,batch,outline:batch===timber}));
}

/** Small open yawl replacing a block boat; fits the supplied original collider footprint.
 * deck is the old collision-box top, so thwarts never advertise new walkable floor area. */
export function buildSmallCraft(name:string,cx:number,cz:number,ry:number,len:number,width:number,deck:number,kind:'fishing'|'smuggler'='fishing'):Piece[]{
 const timber=new Batch(`${name}_Timber`,'M_BlackSailTimber'),rope=new Batch(`${name}_Rope`,'M_BlackSailRope'),cloth=new Batch(`${name}_Canvas`,'M_BlackSailCanvas');
 const transform=T(cx,0,cz,ry),at=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z).applyMatrix4(transform);
 const rod=(b:Batch,a:P,c:P,r:number,col:string)=>{const A=at(...a),B=at(...c),v=B.clone().sub(A);b.add(CYL,col,new THREE.Matrix4().compose(A.add(B).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()),new THREE.Vector3(r,v.length(),r)),false);};
 const box=(b:Batch,x:number,y:number,z:number,w:number,h:number,d:number,col:string)=>{const q=at(x,y,z);b.add(BOX,col,T(q.x,q.y,q.z,ry,w,h,d),false);};
 const us=[-.5,-.34,0,.35,.5],ws=[.08,.8,1,.8,.16];
 for(const side of [-1,1])for(let i=0;i<4;i++)for(let j=0;j<4;j++){
  const pt=(k:number,t:number):P=>[side*width*.5*ws[k]*(.4+.6*t),deck-.75+t*.8,us[k]*len];
  let a=[pt(i,j/4),pt(i+1,j/4),pt(i+1,(j+1)/4),pt(i,(j+1)/4)];if(side>0)a=a.reverse();
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([a[0],a[1],a[2],a[0],a[2],a[3]].flatMap(v=>at(...v).toArray()),3));timber.add(g,j%2?'#836344':'#a27b50',new THREE.Matrix4(),false);
 }
 for(const side of [-1,1])for(let i=0;i<4;i++)rod(timber,[side*width*.5*ws[i],deck+.05,us[i]*len],[side*width*.5*ws[i+1],deck+.05,us[i+1]*len],.06,'#493a2b');
 // Continuous sole at original top; narrow thwarts and ribs carry the open-boat silhouette.
 box(timber,0,deck-.025,0,width*.68,.05,len*.65,'#a48055');
 for(const z of [-.27,0,.27]){box(timber,0,deck+.025,z*len,width*.76,.05,.22,'#ba9562');for(const side of [-1,1])rod(timber,[side*width*.30,deck-.55,z*len],[side*width*.45,deck,z*len],.045,'#513d29');}
 if(kind==='fishing'){
  // Oars stowed lengthwise, not projecting into a gangway or player route.
  for(const s of [-1,1]){rod(timber,[s*width*.25,deck+.12,-len*.39],[s*width*.25,deck+.12,len*.35],.035,'#c1a373');box(timber,s*width*.25,deck+.12,len*.32,.16,.055,len*.18,'#c1a373');}
  for(let i=0;i<5;i++)rod(rope,[-width*.25+i*.1,deck+.09,-len*.18],[-width*.25+i*.1,deck+.09,len*.18],.018,'#8d9675');
 }else{
  box(cloth,0,deck+.14,-len*.15,width*.55,.24,len*.3,'#6d7d73');
  for(const z of [-.27,-.06])rod(rope,[-width*.3,deck+.29,len*z],[width*.3,deck+.29,len*z],.025,'#b6a47c');
 }
 return [timber,rope,cloth].filter(b=>b.vis.length).map(batch=>({name:batch.name,material:batch.material,batch,outline:batch===timber}));
}

/** Broken merchantman shell under the unchanged half-wreck tilted collision deck.
 * Replaces only the first block-hull visual; caller keeps original deck and mast art. */
export function buildHalfWreckHull(cx:number,cz:number,waterLevel:number):Piece[]{
 const b=new Batch('Half_Wreck_RibbedHull','M_BlackSailTimber');
 const m=T(cx,waterLevel+.4,cz,.7,1,1,1,.18),p=(a:P)=>new THREE.Vector3(...a).applyMatrix4(m);
 const rod=(a:P,c:P,r:number,color:string)=>{const A=p(a),B=p(c),v=B.clone().sub(A);b.add(CYL,color,new THREE.Matrix4().compose(A.add(B).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()),new THREE.Vector3(r,v.length(),r)),false);};
 const us=[-8,-6,-3,1,4,8],ws=[.15,.72,1,1,1,.82];
 const q=(i:number,t:number,s:number):P=>[s*3*ws[i]*(.22+.78*Math.sin(t*Math.PI/2)),-2.5+5*t,us[i]];
 for(const s of [-1,1])for(let i=0;i<5;i++)for(let j=0;j<7;j++){
  if((i<2&&j>3)||(s===1&&i===2&&j>2&&j<6)||(s===-1&&i===3&&j>1&&j<5))continue;
  let a=[q(i,j/7+.005,s),q(i+1,j/7+.005,s),q(i+1,(j+1)/7-.005,s),q(i,(j+1)/7-.005,s)];if(s>0)a=a.reverse();
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([a[0],a[1],a[2],a[0],a[2],a[3]].flatMap(v=>p(v).toArray()),3));b.add(g,j%2?'#715138':'#96704a',new THREE.Matrix4(),false);
 }
 for(let i=1;i<6;i++)for(const s of [-1,1])for(let j=0;j<5;j++)rod(q(i,j/5,s),q(i,(j+1)/5,s),.16,'#b08c59');
 for(const s of [-1,1])for(let i=2;i<5;i++)rod(q(i,.98,s),q(i+1,.98,s),.13,'#493d2c');
 for(const s of [-1,1])for(const z of [-4,2])rod([s*2.1,.6,z],[s*2.7,2.9,z+.8],.13,'#b99363');
 return [{name:b.name,material:b.material,batch:b,outline:true}];
}

/** Working shipwright's frame: real transverse bent ribs along the original Z keel.
 * Deliberately no floor: the only walkable mass remains the caller's legacy keel. */
export function buildShipyardFrame(cx:number,ground:number,cz:number):Piece[]{
 const b=new Batch('Nassau_Shipwright_Frame','M_BlackSailTimber'),iron=new Batch('Nassau_Shipwright_Fasteners','M_BlackSailIron');
 const rod=(batch:Batch,a:P,c:P,r:number,color:string)=>{const A=new THREE.Vector3(cx+a[0],ground+a[1],cz+a[2]),B=new THREE.Vector3(cx+c[0],ground+c[1],cz+c[2]),v=B.clone().sub(A);batch.add(CYL,color,new THREE.Matrix4().compose(A.add(B).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()),new THREE.Vector3(r,v.length(),r)),false);};
 const rib=(z:number,side:number,t:number):P=>{const f=.35+.65*Math.sin((z+10)/20*Math.PI);return [side*f*3.8*Math.sin(t*Math.PI*.47),1.15+3.5*(1-Math.cos(t*Math.PI*.5)),z];};
 for(let z=-8;z<=8;z+=2)for(const side of [-1,1]){
  for(let j=0;j<5;j++)rod(b,rib(z,side,j/5),rib(z,side,(j+1)/5),.14,'#a77d4e');
  const q=rib(z,side,.72);rod(b,[side*4.2,.15,z],q,.11,'#73573b');
  rod(iron,[side*.45,1.0,z-.1],[side*.45,1.30,z+.1],.05,'#51514a');
 }
 for(const side of [-1,1])for(const t of [.4,.75,1])for(let z=-8;z<8;z+=2)rod(b,rib(z,side,t),rib(z+2,side,t),t===1?.11:.065,t===1?'#6f5133':'#b7955e');
 // A few already-fitted lower planks; open frames stay visibly unfinished.
 for(const side of [-1,1])for(let j=1;j<3;j++)for(let z=-6;z<4;z+=2){const a=rib(z,side,j/5),c=rib(z+2,side,j/5);rod(b,a,c,.13,j===1?'#8e6740':'#9f764a');}
 return [b,iron].map(batch=>({name:batch.name,material:batch.material,batch,outline:batch===b}));
}
