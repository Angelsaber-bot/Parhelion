/** Original parametric character art. Portraits are merged into the existing
 * six articulated resident meshes; no textures, extra draw calls or downloads. */
import * as THREE from 'three';
import type {RegionId} from './types';
export type PortraitPart={g:THREE.BufferGeometry;c:number;p?:[number,number,number];s?:[number,number,number];r?:[number,number,number]};
export const RESIDENT_PORTRAITS={
 alpha:{name:'Lan',skin:0xe7bba6,hair:0x304b51,light:0x486972,iris:0x58a4a0,width:.94,chin:.88,brow:.10,lip:0x9f6264,age:24},
 britain:{name:'Ada',skin:0xdcb79e,hair:0x8a8982,light:0xb3ada0,iris:0x77745b,width:1,chin:1,brow:-.06,lip:0x996a66,age:54},
 blacksail:{name:'Mara',skin:0xc99476,hair:0x342c2a,light:0x635046,iris:0xa77843,width:1.02,chin:.95,brow:.05,lip:0x8f5650,age:39},
 winter:{name:'Mikhail',skin:0xd8b195,hair:0x51463b,light:0x7d6b54,iris:0x70848c,width:1.08,chin:1.15,brow:-.04,lip:0x8c625b,age:36},
 kyoto:{name:'Sumi',skin:0xe9c3b0,hair:0x292c47,light:0x4e506c,iris:0x8a6f99,width:.93,chin:.83,brow:.08,lip:0xa66872,age:22},
} as const;
const v=(p:[number,number,number])=>new THREE.Vector3(...p);
export type PortraitProfile={readonly skin:number;readonly hair:number;readonly light:number;readonly iris:number;readonly width:number;readonly chin:number;readonly brow:number;readonly lip:number};
/** Ordinary residents share the sculpted face, styled per person instead of per region. */
export type ResidentHairBack='crop'|'bun'|'tail'|'long'|'braid';
export interface ResidentLook{profile:PortraitProfile;fringe:number;fringeDrop:number;part:number;side:number;back:ResidentHairBack}
const HAIR_BY_REGION:Record<RegionId,readonly number[]>={
 alpha:[0x2f2a2c,0x4a3a33,0x2c3f4c,0x6b5242,0x8b8a86],
 britain:[0x6d432c,0x8f6a43,0x4b3426,0xb59a6a,0x7e7a73],
 blacksail:[0x2a2120,0x4a3127,0x6e4a2f,0x232526,0x8c6a4a],
 winter:[0x655440,0x9a8462,0x3d3530,0xc2b49a,0x5a4a3f],
 kyoto:[0x232233,0x2b2525,0x3a2e3d,0x1d2230,0x4a3f45],
};
const SKIN_BY_REGION:Record<RegionId,readonly number[]>={
 alpha:[0xe7b99b,0xd9a98a,0xf0c8ad,0xc28e6e],britain:[0xdbaa86,0xe8bfa2,0xcf9f7f,0xf1cfb6],
 blacksail:[0xc68e66,0xb27a56,0xd9a582,0x9b6a4b],winter:[0xe4bb9e,0xf0cdb5,0xd6a98c,0xe9c2a8],kyoto:[0xe8bda6,0xf2cdb8,0xdcae95,0xe3b39a],
};
const IRIS=[0x4d6d68,0x6a5440,0x58708a,0x7b6a4c,0x5a7a5c,0x6f536e] as const;
const lift=(c:number,k:number)=>{const x=new THREE.Color(c);x.lerp(new THREE.Color(0xffffff),k);return x.getHex();};
/** A stable look per resident id: hair colour and cut, skin, eyes and face shape. */
export function residentLook(seed:number,region:RegionId):ResidentLook{
 const pick=<T,>(list:readonly T[],salt:number)=>list[(((seed>>>salt)^Math.imul(seed,salt+3))>>>0)%list.length];
 const unit=(salt:number)=>(((seed*2654435761+salt*40503)>>>0)%1000)/1000;
 const hair=pick(HAIR_BY_REGION[region],3);
 return {profile:{skin:pick(SKIN_BY_REGION[region],7),hair,light:lift(hair,.09),iris:pick(IRIS,11),width:.93+unit(1)*.13,chin:.84+unit(2)*.26,brow:-.06+unit(3)*.16,lip:lift(0x9a6260,unit(4)*.18)},
  fringe:5+Math.floor(unit(5)*4),fringeDrop:.028+unit(6)*.034,part:unit(7)<.5?0:(unit(8)<.5?-1:1),side:.07+unit(9)*.2,back:(['crop','bun','tail','long','braid'] as const)[Math.floor(unit(10)*5)]};
}
export function createResidentPortrait(region:RegionId,look?:ResidentLook){
 const p:PortraitProfile=look?.profile??RESIDENT_PORTRAITS[region],owned=new Set<THREE.BufferGeometry>(),head:PortraitPart[]=[],eyes:PortraitPart[]=[],coat:PortraitPart[]=[];
 const own=<T extends THREE.BufferGeometry>(g:T)=>{owned.add(g);return g;};
 const sphere=own(new THREE.SphereGeometry(1,16,10)),eyeSphere=own(new THREE.SphereGeometry(1,12,8)),box=own(new THREE.BoxGeometry(1,1,1));
 const add=(list:PortraitPart[],g:THREE.BufferGeometry,c:number,pos:[number,number,number],scale:[number,number,number]=[1,1,1],rot?:[number,number,number])=>list.push({g,c,p:pos,s:scale,...(rot?{r:rot}:{})});
 const ell=(list:PortraitPart[],c:number,pos:[number,number,number],scale:[number,number,number])=>add(list,list===eyes?eyeSphere:sphere,c,pos,scale);
 function line(list:PortraitPart[],points:[number,number,number][],radius:number,color:number){add(list,own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v)),12,radius,5,false)),color,[0,0,0]);}
 function strand(points:[number,number,number][],width:number,depth:number,color:number){
  // Ordinary residents carry more locks than a portrait, so each lock is cut a little coarser.
  const curve=new THREE.CatmullRomCurve3(points.map(v)),verts:number[]=[],index:number[]=[],n=look?9:12,sides=6;
  for(let i=0;i<=n;i++){
   const t=i/n,q=curve.getPoint(t),tangent=curve.getTangent(t),side=new THREE.Vector3(0,0,1).cross(tangent).normalize();if(side.lengthSq()<.1)side.set(1,0,0);const normal=new THREE.Vector3().crossVectors(tangent,side).normalize();
   const taper=Math.max(.025,Math.sin(Math.PI*(.12+.88*t))**.6);
   for(let k=0;k<sides;k++){const a=k/sides*Math.PI*2,r=q.clone().addScaledVector(side,Math.cos(a)*width*taper).addScaledVector(normal,Math.sin(a)*depth*taper);verts.push(r.x,r.y,r.z);}
  }
  for(let i=0;i<n;i++)for(let k=0;k<sides;k++){const a=i*sides+k,b=i*sides+(k+1)%sides,c=a+sides,d=b+sides;index.push(a,b,c,b,d,c);}
  const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(index);g.computeVertexNormals();add(head,g,color,[0,0,0]);
 }
 // Sculpted cheek/chin rings with a continuous nose bridge. Front is local +Z.
 const profile=[[-.179,.023,.040],[-.156,.070,.074],[-.119,.106,.101],[-.065,.136,.124],[.003,.145,.132],[.067,.140,.129],[.128,.113,.109],[.172,.061,.067],[.181,.002,.003]];
 const vertices:number[]=[],indices:number[]=[],segments=32;
 for(let j=0;j<profile.length;j++){const[y,w,d]=profile[j];for(let k=0;k<=segments;k++){
  const a=k/segments*Math.PI*2,x=Math.cos(a)*w*p.width*(y<-.1?p.chin:1),front=Math.max(0,Math.sin(a));
  const nose=.026*Math.exp(-((x/.026)**2)-(((y+.025)/.054)**2))*front**8;
  const cheeks=.009*Math.exp(-(((Math.abs(x)-.083)/.045)**2)-(((y+.054)/.05)**2))*front;
  vertices.push(x,y,Math.sin(a)*d+nose+cheeks);
 }}
 for(let j=0;j<profile.length-1;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;indices.push(a,b,a+1,a+1,b,b+1);}
 const face=own(new THREE.BufferGeometry());face.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));face.setIndex(indices);face.computeVertexNormals();add(head,face,p.skin,[0,0,0]);
 for(const side of[-1,1]){
  ell(head,p.skin,[side*.14*p.width,-.018,0],[.025,.044,.023]);ell(head,0xb47b72,[side*.153*p.width,-.019,.009],[.008,.023,.014]);
  const x=side*.061*p.width;
  ell(eyes,0x573c3c,[x,-.004,.126],[.035,.012,.005]);ell(eyes,0xf2e9dc,[x,-.007,.132],[.029,.009,.004]);
  ell(eyes,p.iris,[x-side*.002,-.007,.137],[.012,.0085,.0025]);ell(eyes,0x273138,[x-side*.002,-.007,.139],[.005,.007,.0015]);ell(eyes,0xfffaf1,[x-side*.006,-.002,.141],[.003,.003,.001]);
  line(head,[[x-side*.028,.006,.142],[x,.012,.148],[x+side*.029,.004,.137]],.0035,p.hair);
  line(head,[[x-side*.026,.039,.128],[x,.044+p.brow*.02,.138],[x+side*.026,.037,.129]],region==='winter'?.0045:.003,p.hair);
  if(region==='britain'){line(head,[[x-side*.025,-.023,.139],[x,-.027,.141],[x+side*.023,-.025,.134]],.0014,0xb28a75);}
 }
 // A small actual mouth cavity, upper bow and lower lip, in front of the face.
 ell(head,0x54363c,[0,-.104,.116],[.022,.005,.007]);
 line(head,[[-.023,-.103,.117],[-.009,-.100,.123],[0,-.102,.125],[.009,-.100,.123],[.023,-.103,.117]],.0017,p.lip);
 line(head,[[-.021,-.106,.117],[0,-.110,.125],[.021,-.106,.117]],.0015,0xc58e83);
 // Nose volume belongs to the continuous face mesh, with no separate ball tip.
 // A fitted scalp and locks with volume instead of five repeated cone fringes.
 add(head,own(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI*.64)),p.hair,[0,.038,-.008],[.151*p.width,.157,.147]);
 if(look){residentHair(look);return {head,eyes,coat,profile:p,dispose(){for(const g of owned)g.dispose();}};}
 const count=region==='britain'?5:8;
 for(let i=0;i<count;i++){
  const x=(i/(count-1)-.5)*.258*p.width,asym=region==='alpha'?(i<4?.015:0):0;
  strand([[x*.65,.17,.041],[x,.122,.125],[x*1.04,.050+asym,.143],[x*.92,(region==='winter'?.035:region==='britain'?.055:.032)+asym,.137]],.025, .007,i===2?p.light:p.hair);
 }
 for(const side of[-1,1]){
  const length=region==='alpha'?.17:region==='blacksail'?.27:region==='kyoto'?.23:region==='britain'?.11:.10;
  for(let i=0;i<3;i++)strand([[side*.12,.14,-.01-i*.035],[side*(.15+i*.006),.036,-.005-i*.038],[side*(.145+i*.007),-.055,-.015-i*.04],[side*.12,-length,-.01-i*.035]],.023,.012,i===1?p.light:p.hair);
 }
 /** Fringe, side locks and one of five back cuts, all from the resident's own look. */
 function residentHair(l:ResidentLook){
  for(let i=0;i<l.fringe;i++){
   // Outer locks hug the temple instead of arching out past it.
   const t=i/(l.fringe-1)-.5,x=t*.236*p.width,wrap=Math.abs(x)*.42,sweep=l.part*.022*(1-Math.abs(t)*2),drop=l.fringeDrop*(1-Math.abs(t)*.6)+(l.part&&Math.sign(t)===l.part?.012:0);
   strand([[x*.55,.165,.035],[x*.9+sweep*.5,.122,.122-wrap],[x*.98+sweep,.052+(.06-drop)*.4,.141-wrap],[x*.88+sweep*1.4,.088-drop*1.6,.135-wrap]],.025,.007,i%3===1?p.light:p.hair);
  }
  for(const side of[-1,1])for(let i=0;i<3;i++){const len=l.side*(1-i*.12);strand([[side*.12,.14,-.01-i*.035],[side*(.15+i*.006),.036,-.005-i*.038],[side*(.145+i*.007),-.04,-.015-i*.04],[side*.12,-len,-.01-i*.035]],.023,.012,i===1?p.light:p.hair);}
  if(l.back==='bun'){ell(head,p.hair,[0,.11,-.16],[.075,.07,.065]);line(head,[[-.06,.12,-.13],[0,.15,-.2],[.06,.12,-.13]],.006,p.light);}
  else if(l.back==='tail'){ell(head,p.hair,[0,.06,-.15],[.05,.045,.04]);for(let i=0;i<3;i++)strand([[(i-1)*.02,.06,-.17],[(i-1)*.03,-.06,-.21],[(i-1)*.03,-.2,-.2],[(i-1)*.015,-.33,-.17]],.024,.014,i===1?p.light:p.hair);}
  else if(l.back==='long'){for(let i=0;i<5;i++)strand([[(i-2)*.05,.11,-.12],[(i-2)*.058,-.03,-.17],[(i-2)*.056,-.2,-.17],[(i-2)*.04,-.34,-.14]],.03,.013,i%2?p.light:p.hair);}
  else if(l.back==='braid'){for(let i=0;i<6;i++)ell(head,i%2?p.light:p.hair,[.012*(i%2?1:-1),-.03-i*.052,-.17+i*.004],[.034-i*.002,.032,.03]);}
  else for(let i=0;i<4;i++)strand([[(i-1.5)*.06,.13,-.1],[(i-1.5)*.07,.03,-.16],[(i-1.5)*.06,-.06,-.14],[(i-1.5)*.04,-.1,-.11]],.03,.012,i%2?p.light:p.hair);
 }
 if(region==='britain'){
  ell(head,p.hair,[0,.055,-.154],[.086,.081,.065]);
  for(let i=0;i<5;i++)line(head,[[-.066+i*.027,.112,-.17],[-.07+i*.028,.06,-.214],[-.044+i*.019,.005,-.185]],.006,i%2?p.light:p.hair);
  // Shoulder cape, clasp and the patched corner of a well-used ledger keeper.
  add(coat,own(new THREE.CylinderGeometry(.205,.265,.20,24,1,true)),0x788197,[0,.17,-.006],[1,1,.70]);
  ell(coat,0xcab17c,[.07,.12,.167],[.018,.022,.008]);
 }else if(region==='kyoto'){
  for(let i=0;i<4;i++)strand([[(i-1.5)*.035,.11,-.11],[(i-1.5)*.04,-.02,-.19],[(i-1.5)*.04,-.25,-.20],[(i-1.5)*.025,-.43,-.16]],.028,.014,i===2?p.light:p.hair);
  line(head,[[.10,.13,-.08],[.21,.16,-.07]],.007,0xc4a970);
  for(const x of[.177,.20])add(head,box,0xdfcda7,[x,.136,-.07],[.024,.055,.009],[0,0,x===.177?-.38:.38]);
  line(coat,[[-.19,-.12,.10],[0,-.14,.17],[.19,-.12,.10]],.009,0xe2c897);
 }else if(region==='alpha'){
  for(const side of[-1,1])ell(head,0x325d68,[side*.163,.004,-.005],[.027,.06,.049]);
  line(head,[[-.16,.02,0],[-.13,.19,-.015],[0,.215,-.03],[.13,.19,-.015],[.16,.02,0]],.012,0xc8b27b);
  line(coat,[[-.13,.23,.12],[-.07,.08,.17],[.10,-.16,.15]],.015,0x395c68);
  for(const y of[.02,-.018,-.056])add(coat,box,0x577d84,[-.13,y,.179],[.065,.008,.007]);
 }else if(region==='blacksail'){
  for(let i=0;i<5;i++)strand([[.125-i*.012,.08,-.12],[.17,-.07,-.13],[.135+(i%2)*.02,-.20,-.11],[.11,-.29,-.07]],.024,.015,i%2?p.light:p.hair);
  add(head,own(new THREE.TorusGeometry(.022,.003,6,14)),0xc7a76a,[-.158,-.066,.015],[1,1,1],[0,.3,0]);
  line(coat,[[-.19,.19,.12],[-.09,.14,.18],[.08,.17,.16]],.015,0x7a644b);
 }else{
  add(head,own(new THREE.CylinderGeometry(.148,.16,.105,24)),0x3b5560,[0,.16,-.01],[1,1,.88]);
  add(head,own(new THREE.CylinderGeometry(.161,.164,.042,24)),0xaea68c,[0,.105,-.01],[1,1,.90]);
  add(coat,own(new THREE.TorusGeometry(.102,.034,7,24)),0xb6b3a0,[0,.26,.013],[1,1,.72],[Math.PI/2,0,0]);
  for(const side of[-1,1])add(coat,box,0x6c8a86,[side*.13,.025,.164],[.036,.32,.018],[0,0,side*.035]);
 }
 return {head,eyes,coat,profile:p,dispose(){for(const g of owned)g.dispose();}};
}

/** Mouth and brow deltas act on the merged head, not by rebuilding the model. */
export function addResidentExpression(mesh:THREE.Mesh){
 const g=mesh.geometry,source=g.getAttribute('position');
 const speech=new Float32Array(source.count*3),resolve=new Float32Array(source.count*3);
 for(let i=0;i<source.count;i++){
  const x=source.getX(i),y=source.getY(i),z=source.getZ(i);speech.set([x,y,z],i*3);resolve.set([x,y,z],i*3);
  if(Math.abs(x)<.028&&y<-.095&&y>-.117&&z>.11){speech[i*3+1]=y+(y<-.104?-.009:.002);speech[i*3+2]=z+.001;resolve[i*3+1]=y+Math.abs(x)*.06;}
 }
 g.morphAttributes.position=[new THREE.Float32BufferAttribute(speech,3),new THREE.Float32BufferAttribute(resolve,3)];g.morphTargetsRelative=false;g.morphAttributes.position[0].name='Speak';g.morphAttributes.position[1].name='Resolve';mesh.updateMorphTargets();
}
