/** Lightweight, authored residents: articulated joint batches, no pathfinding or save mutations. */
import * as THREE from 'three';
import { mergeParts } from './merge';
import {createResidentPortrait,addResidentExpression,residentLook} from './residentPortrait';
import type { Localized, PlacedNpcSocket, RegionId } from './types';
export const SETTLEMENT_NPC_LIMITS = Object.freeze({ interaction: 2.8, vertical: 2.4, animate: 24, visible: 90 });
type Part = { g: THREE.BufferGeometry; c: number; p?: [number,number,number]; s?: [number,number,number]; r?: [number,number,number] };
type Palette = { coat:number; trim:number; hair:number; skin:number; accent:number };
const PALETTES: Record<RegionId,Palette> = {
 alpha:{coat:0xdce5e9,trim:0x295b75,hair:0x41352f,skin:0xe7b99b,accent:0xe3bd66},
 britain:{coat:0x66734d,trim:0x9a653d,hair:0x6d432c,skin:0xdbaa86,accent:0xcda962},
 blacksail:{coat:0x385b66,trim:0xa96c40,hair:0x392824,skin:0xc68e66,accent:0xe4c993},
 winter:{coat:0x3f5d63,trim:0xe5ddc8,hair:0x655440,skin:0xe4bb9e,accent:0xb59c61},
 kyoto:{coat:0x555e8c,trim:0xd1b4a0,hair:0x292735,skin:0xe8bda6,accent:0xa64745},
};
const sphere=new THREE.SphereGeometry(1,12,8), cylinder=new THREE.CylinderGeometry(1,1,1,10), box=new THREE.BoxGeometry(1,1,1), cone=new THREE.ConeGeometry(1,1,9);
const face=new THREE.LatheGeometry([new THREE.Vector2(.022,-.185),new THREE.Vector2(.070,-.153),new THREE.Vector2(.125,-.09),new THREE.Vector2(.142,.005),new THREE.Vector2(.137,.09),new THREE.Vector2(.11,.145),new THREE.Vector2(.045,.178),new THREE.Vector2(.001,.182)],16);
const cap=new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI*.49);
const ring=new THREE.TorusGeometry(1,.32,6,18),shawl=new THREE.CylinderGeometry(1,1.16,1,20,1,true);
/** Everyday dress varies by person: a coat colour from the region's cloth, and one worn layer on top. */
const COATS:Record<RegionId,readonly [number,number][]>={
 alpha:[[0xdce5e9,0x295b75],[0x9fb3bd,0x2f4652],[0xe8e0d0,0x7a5a3a],[0x45576a,0xc9b27a]],
 britain:[[0x66734d,0x9a653d],[0x7b5a44,0xc2a46a],[0x5a6478,0xb49a6a],[0x8a7a5a,0x5a3d2a]],
 blacksail:[[0x385b66,0xa96c40],[0x6a3f35,0xd0b080],[0x2f3f52,0xc8a050],[0x7a6a4a,0x2f4f5a]],
 winter:[[0x3f5d63,0xe5ddc8],[0x5a3f3f,0xd8cdb5],[0x4a4f5e,0xc9b98f],[0x6b6052,0xe0d6c0]],
 kyoto:[[0x555e8c,0xd1b4a0],[0x6f4a5e,0xe0c8a8],[0x3f5a52,0xd8c090],[0x7a5a3a,0x2f3550]],
};
export type ResidentLayer='none'|'scarf'|'shawl'|'satchel'|'sash';
export const RESIDENT_LAYERS:readonly ResidentLayer[]=['none','scarf','shawl','satchel','sash'];
export const residentLayer=(seed:number,region:RegionId):ResidentLayer=>{const pool=region==='winter'?RESIDENT_LAYERS.filter(l=>l!=='scarf'):RESIDENT_LAYERS;return pool[((seed>>>9)^(seed>>>21))%pool.length];};
function layerParts(layer:ResidentLayer,p:Palette,seed:number):Part[]{
 const cloth=[p.accent,p.trim,0x8a3f3a,0x3f5a7a,0xc8b48a][(seed>>>13)%5],side=(seed>>>17)%2?1:-1;
 switch(layer){
  case 'scarf':return[{g:ring,c:cloth,p:[0,.275,.005],s:[.105,.105,.085],r:[Math.PI/2,0,0]},{g:ring,c:cloth,p:[0,.255,.01],s:[.118,.118,.09],r:[Math.PI/2+.12,0,0]},{g:box,c:cloth,p:[side*.07,.12,.15],s:[.058,.24,.016],r:[.08,0,side*.1]},{g:box,c:cloth,p:[side*.05,.17,.156],s:[.05,.13,.014],r:[.1,0,-side*.25]},{g:box,c:p.trim,p:[side*.075,-.002,.152],s:[.06,.012,.017],r:[0,0,side*.1]}];
  case 'shawl':return[{g:shawl,c:cloth,p:[0,.175,-.004],s:[.205,.19,.148]},{g:taper(.236,.24,.018),c:p.trim,p:[0,.08,-.004],s:[1,1,.72]},{g:sphere,c:p.accent,p:[0,.25,.13],s:[.02,.02,.01]}];
  case 'satchel':return[{g:box,c:0x5a4030,p:[0,.06,.146],s:[.03,.62,.012],r:[0,0,side*.62]},{g:box,c:0x5a4030,p:[0,.06,-.13],s:[.03,.62,.012],r:[0,0,-side*.62]},{g:box,c:0x7a5a3e,p:[-side*.215,-.16,.02],s:[.07,.15,.19]},{g:box,c:0x5f4431,p:[-side*.25,-.12,.02],s:[.012,.1,.19]},{g:box,c:p.accent,p:[-side*.255,-.14,.02],s:[.008,.025,.04]}];
  case 'sash':return[{g:box,c:cloth,p:[0,.03,.15],s:[.075,.56,.012],r:[0,0,-side*.58]},{g:box,c:cloth,p:[0,.03,-.135],s:[.075,.56,.012],r:[0,0,side*.58]},{g:sphere,c:cloth,p:[side*.15,-.13,.12],s:[.035,.03,.02]},{g:box,c:cloth,p:[side*.165,-.21,.12],s:[.035,.12,.01],r:[0,0,side*.15]}];
  default:return[];
 }
}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
function taper(top:number,bottom:number,height:number){return new THREE.CylinderGeometry(top,bottom,height,10);}
function batch(parent:THREE.Group,name:string,parts:Part[],material:THREE.Material){
 const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
 const geometries=parts.map(part=>{const g=part.g.clone();q.setFromEuler(new THREE.Euler(...(part.r??[0,0,0])));matrix.compose(new THREE.Vector3(...(part.p??[0,0,0])),q,new THREE.Vector3(...(part.s??[1,1,1])));g.applyMatrix4(matrix);const color=new THREE.Color(part.c),colors=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));return g;});
 const geometry=mergeParts(geometries,false);for(const g of geometries)g.dispose();const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function resident(socket:PlacedNpcSocket,material:THREE.Material){
 const root=new THREE.Group();root.name=`Resident_${socket.id}`;root.position.set(...socket.position);root.rotation.y=socket.yaw??0;root.userData.settlementNpc=true;root.userData.region=socket.region;
 const seed=hash(socket.id),phase=(seed%997)*.017,p={...PALETTES[socket.region]},role=`${socket.id} ${socket.role.join(' ')}`.toLowerCase();
 const signal=socket.id==='alpha_signal_keeper',witness=socket.id==='britain_oath_witness',lamplighter=socket.id==='blacksail_lamplighter',bearer=socket.id==='winter_stretcher_bearer',paperKeeper=socket.id==='kyoto_paper_keeper';
 const craft=/smith|forge|铁匠|刀匠|锻|工匠/.test(role),medical=bearer||/medic|healer|医|救护/.test(role),clerk=/clerk|harbor|customs|港务|海关|账|书记|管家|steward/.test(role),keeper=paperKeeper||/inn|旅|客栈|resident|住民/.test(role);
 if(medical){p.coat=0x344e61;p.trim=0xd0c3a3;}if(craft){p.coat=socket.region==='kyoto'?0x414d71:0x6d7162;p.trim=0x725039;}if(keeper){p.coat=socket.region==='kyoto'?0x8b5269:0x78839a;p.trim=0xd5c5a6;}
 if(signal){p.coat=0xc4d8d9;p.trim=0x376879;p.accent=0xc6a967;}if(witness){p.coat=0x586b87;p.trim=0xc4ad81;p.hair=0x83776b;}if(lamplighter){p.coat=0x9b794d;p.trim=0x385c61;p.accent=0xd2b97c;}if(paperKeeper){p.coat=0x62618b;p.trim=0xcbb58e;p.accent=0x9a574e;}
 const campaign=signal||witness||lamplighter||bearer||paperKeeper;
 if(!campaign&&!medical&&!craft&&!keeper){const[coat,trim]=COATS[socket.region][(seed>>>5)%COATS[socket.region].length];p.coat=coat;p.trim=trim;}
 const layer:ResidentLayer=campaign?'none':residentLayer(seed,socket.region);
 // Campaign residents keep their authored portrait; everyone else gets the same sculpted face with a cut of their own.
 const portrait=createResidentPortrait(socket.region,campaign?undefined:residentLook(seed,socket.region));p.skin=portrait.profile.skin;p.hair=portrait.profile.hair;
 const torso=new THREE.Group();torso.name='ResidentTorso';torso.position.y=1.04;root.add(torso);const head=new THREE.Group();head.name='ResidentHead';head.position.y=.48;torso.add(head);const eyes=new THREE.Group();eyes.name='ResidentEyes';head.add(eyes);
 const leftArm=new THREE.Group(),rightArm=new THREE.Group();leftArm.name='ResidentArmLeft';rightArm.name='ResidentArmRight';leftArm.position.set(-.185,.23,0);rightArm.position.set(.185,.23,0);torso.add(leftArm,rightArm);
 const body:Part[]=[{g:taper(.19,.21,.46),c:p.coat,p:[0,.02,0],s:[1,1,.65]},{g:sphere,c:p.coat,p:[0,.19,0],s:[.215,.105,.135]},{g:cylinder,c:p.skin,p:[0,.33,0],s:[.059,.12,.059]},{g:taper(.08,.1,.06),c:p.trim,p:[0,.285,0],s:[1,1,.85]},{g:taper(.207,.212,.055),c:p.trim,p:[0,-.14,.005],s:[1,1,.68]},{g:box,c:p.accent,p:[0,-.14,.153],s:[.055,.04,.012]}];
 if(socket.region==='kyoto')body.push({g:box,c:p.trim,p:[-.035,.14,.139],s:[.035,.24,.014],r:[0,0,.40]},{g:box,c:p.trim,p:[.035,.14,.145],s:[.035,.24,.014],r:[0,0,-.40]},{g:taper(.208,.214,.145),c:p.accent,p:[0,-.105,.01],s:[1,1,.68]},{g:box,c:p.trim,p:[0,-.105,.159],s:[.42,.018,.012]});
 else{body.push({g:box,c:p.trim,p:[0,.065,.142],s:[.024,.31,.012]},{g:box,c:p.trim,p:[.115,.065,.147],s:[.07,.012,.01]});for(let i=0;i<3;i++)body.push({g:sphere,c:p.accent,p:[0,.19-i*.085,.155],s:[.011,.011,.006]});}
 // Layered tailoring: a standing collar, shoulder seams, a hem band and soft side folds give the
 // silhouette depth up close without leaving the six-batch actor budget.
 body.push({g:taper(.095,.115,.075),c:p.trim,p:[0,.275,0],s:[1,1,.9]},{g:taper(.088,.097,.03),c:p.coat,p:[0,.315,0],s:[1,1,.9]});
 for(const sign of[-1,1])body.push({g:sphere,c:p.trim,p:[sign*.175,.215,0],s:[.072,.034,.08]},{g:box,c:p.accent,p:[sign*.175,.238,0],s:[.07,.012,.055]});
 body.push({g:taper(.212,.206,.045),c:p.trim,p:[0,-.165,.004],s:[1,1,.69]});
 for(const[x,rz]of[[-.15,.07],[.15,-.07]]as const)body.push({g:taper(.03,.021,.26),c:p.coat,p:[x,-.075,.082],s:[1,1,.55],r:[0,0,rz]});
 body.push({g:box,c:p.coat,p:[0,-.02,-.138],s:[.05,.40,.022]},{g:box,c:p.trim,p:[0,.11,-.142],s:[.17,.014,.016]});
 if(craft||(keeper&&socket.region!=='kyoto'))body.push({g:box,c:p.trim,p:[0,-.025,.154],s:[.24,.38,.019]},{g:box,c:p.accent,p:[0,-.05,.169],s:[.14,.09,.01]});
 if(socket.region==='winter')body.push({g:sphere,c:p.trim,p:[-.11,.25,0],s:[.11,.06,.14]},{g:sphere,c:p.trim,p:[.11,.25,0],s:[.11,.06,.14]});
 if(keeper||socket.region==='winter'||socket.region==='kyoto')body.push({g:taper(.20,.265,.42),c:p.coat,p:[0,-.37,-.015],s:[1,1,.72]},{g:taper(.26,.267,.035),c:p.trim,p:[0,-.565,-.015],s:[1,1,.72]});
 // Chapter residents remain six articulated batches, but their work is readable in silhouette.
 if(signal){body.push({g:box,c:p.trim,p:[-.13,.015,.159],s:[.10,.13,.027]},{g:box,c:p.accent,p:[-.13,.015,.179],s:[.06,.035,.012]},{g:box,c:p.trim,p:[.15,-.13,.05],s:[.09,.21,.15]});}
 if(witness){body.push({g:taper(.23,.29,.6),c:p.coat,p:[0,-.34,0],s:[1,1,.75]},{g:taper(.11,.235,.15),c:p.trim,p:[0,.235,-.025],s:[1,1,.72]},{g:cylinder,c:p.accent,p:[.115,.18,.151],s:[.025,.016,.025],r:[Math.PI/2,0,0]});}
 if(lamplighter){body.push({g:taper(.235,.29,.28),c:p.trim,p:[0,.105,-.025],s:[1,1,.7]},{g:box,c:p.coat,p:[0,-.20,.15],s:[.27,.22,.035]});for(const x of[-.13,.13])body.push({g:box,c:p.accent,p:[x,-.13,.16],s:[.035,.055,.018]});}
 if(bearer){body.push({g:box,c:0xbcb399,p:[0,.02,-.2],s:[.28,.35,.15]},{g:cylinder,c:0x74818a,p:[0,.24,-.22],s:[.10,.36,.10],r:[0,0,Math.PI/2]});for(const x of[-.13,.13])body.push({g:box,c:0xa18b68,p:[x,.05,.143],s:[.035,.43,.023]},{g:box,c:p.accent,p:[x,-.10,.161],s:[.05,.04,.015]});}
 if(paperKeeper){body.push({g:box,c:0x765944,p:[-.15,-.23,.06],s:[.13,.24,.23]},{g:box,c:p.trim,p:[-.08,.06,.157],s:[.035,.44,.016],r:[0,0,-.35]});for(const x of[-.11,0,.11])body.push({g:cylinder,c:0xdfcda8,p:[x,.05,-.19],s:[.043,.45,.043]},{g:cylinder,c:0x765944,p:[x,.29,-.19],s:[.05,.035,.05]});}
 if(portrait)body.push(...portrait.coat);body.push(...layerParts(layer,p,seed));batch(torso,'ResidentClothing',body,material);
 const legs:Part[]=[];for(const sign of[-1,1])legs.push({g:box,c:0x1b1a1d,p:[sign*.11,.012,.062],s:[.165,.022,.25]},{g:box,c:0x3b2f2b,p:[sign*.11,.038,-.03],s:[.12,.035,.085]},{g:taper(.088,.082,.055),c:0x4a3a31,p:[sign*.11,.225,.006]},{g:cylinder,c:0x2b3038,p:[sign*.11,.40,.004],s:[.082,.03,.088]},{g:cylinder,c:0x343b44,p:[sign*.11,.58,0],s:[.079,.50,.085]},{g:taper(.07,.065,.30),c:0x3e302b,p:[sign*.11,.22,.006]},{g:sphere,c:0x332a28,p:[sign*.11,.08,.065],s:[.085,.075,.15]},{g:box,c:0x262528,p:[sign*.11,.028,.065],s:[.16,.025,.24]});batch(root,'ResidentBootsAndLegs',legs,material);
 let features:Part[]=[{g:face,c:p.skin,s:[witness? .96:bearer?1.06:paperKeeper?.94:1,witness?1.04:lamplighter?.96:1,.86]},{g:sphere,c:p.skin,p:[-.14,-.018,0],s:[.03,.046,.025]},{g:sphere,c:p.skin,p:[.14,-.018,0],s:[.03,.046,.025]},{g:sphere,c:p.skin,p:[0,-.044,.126],s:[.019,.030,.020]},{g:box,c:0x9b605b,p:[0,-.101,.113],s:[.041,.006,.007]},{g:cap,c:p.hair,p:[0,.036,-.002],s:[.151,.165,.153]}];
 for(const sign of[-1,1])features.push({g:sphere,c:p.hair,p:[sign*.13,.004,-.004],s:[.032,.10,.098]},{g:box,c:p.hair,p:[sign*.059,.037,.123],s:[.065,witness?.012:.010,.01],r:[0,0,sign*(lamplighter?-.12:.035)]});
 for(let i=0;i<(witness?0:5);i++)features.push({g:campaign?sphere:cone,c:p.hair,p:[(i-(witness?1:2))*.048,.079-(i%2)*.015,.126],s:[.035,campaign?(witness?.030:.046):.10,.025],r:[0,0,Math.PI+(i-2)*.12]});
 features.push({g:sphere,c:p.hair,p:[0,.005,-.085],s:[.145,.145,.105]},{g:sphere,c:p.hair,p:[0,-.09,-.095],s:[.095,.075,.07]});
 for(const sign of[-1,1])features.push({g:taper(.028,.016,.17),c:p.hair,p:[sign*.125,-.025,.045],s:[1,1,.7],r:[0,0,sign*.12]},{g:box,c:p.hair,p:[sign*.105,.075,.075],s:[.075,.05,.075],r:[0,0,sign*.3]});
 // A brow line and a hint of a lower lip: readable at conversation distance, never a mask.
 for(const sign of[-1,1])features.push({g:box,c:p.hair,p:[sign*.057,.030,.126],s:[.056,.010,.008],r:[0,0,sign*.15]});
 features.push({g:sphere,c:0xb87a72,p:[0,-.112,.110],s:[.019,.006,.006]});
 const hatStart=features.length;
 if(socket.region==='winter')features.push({g:cylinder,c:p.coat,p:[0,.18,-.006],s:[.145,.090,.13]},{g:cylinder,c:p.trim,p:[0,.125,-.006],s:[.15,.032,.136]});
 else if(clerk&&socket.region==='blacksail')features.push({g:new THREE.CylinderGeometry(.21,.22,.035,3),c:0x3d3933,p:[0,.15,-.005],r:[0,Math.PI,0]},{g:cylinder,c:0x3d3933,p:[0,.195,-.008],s:[.125,.065,.105]});else if(clerk)features.push({g:cylinder,c:p.coat,p:[0,.19,-.008],s:[.143,.055,.125]},{g:sphere,c:p.trim,p:[0,.14,.095],s:[.14,.016,.11]});else if(craft)features.push({g:cylinder,c:0xc2b59a,p:[0,.083,-.004],s:[.147,.032,.132]});
 if(signal){features.push({g:new THREE.TorusGeometry(.161,.022,5,12,Math.PI),c:p.trim,p:[0,.02,-.012]},{g:sphere,c:p.trim,p:[-.158,.005,-.005],s:[.035,.067,.055]},{g:sphere,c:p.trim,p:[.158,.005,-.005],s:[.035,.067,.055]},{g:cylinder,c:p.accent,p:[-.182,.005,-.005],s:[.03,.012,.03],r:[0,0,Math.PI/2]},{g:cylinder,c:p.accent,p:[.182,.005,-.005],s:[.03,.012,.03],r:[0,0,Math.PI/2]});}
 if(witness){features.push({g:sphere,c:p.hair,p:[0,.045,-.14],s:[.09,.075,.075]},{g:box,c:0xb8a994,p:[-.06,.04,.126],s:[.07,.016,.012]},{g:box,c:0xb8a994,p:[.06,.04,.126],s:[.07,.016,.012]});}
 features=campaign?portrait.head:[...portrait.head,...features.slice(hatStart)];const faceMesh=batch(head,'ResidentFaceAndHair',features,material);addResidentExpression(faceMesh);
 const ep:Part[]=[];for(const sign of[-1,1])ep.push({g:sphere,c:0x403334,p:[sign*.059,-.008,.113],s:[.035,witness?.010:campaign?.012:.014,.007]},{g:sphere,c:0xf5eee6,p:[sign*.059,-.011,.117],s:[.029,witness?.007:campaign?.0085:.010,.006]},{g:sphere,c:socket.region==='kyoto'?0x6f536e:0x4d6d68,p:[sign*.059,-.01,.122],s:[.012,witness?.007:campaign?.0085:.010,.003]},{g:sphere,c:0x222b31,p:[sign*.059,-.01,.124],s:[.006,campaign?.006:.008,.002]},{g:sphere,c:0xffffff,p:[sign*.055,-.007,.127],s:[.0025,.0025,.001]});if(portrait)ep.splice(0,ep.length,...portrait.eyes);batch(eyes,'ResidentEyes',ep,material);portrait?.dispose();
 for(const[arm,sign]of[[leftArm,-1],[rightArm,1]]as const){const a:Part[]=[{g:sphere,c:p.coat,p:[sign*.02,-.045,0],s:[.082,.073,.077]},{g:taper(.078,.062,.25),c:p.coat,p:[sign*.03,-.155,0]},{g:taper(.065,.047,.23),c:p.coat,p:[sign*.04,-.37,.024],r:[-.16,0,0]},{g:cylinder,c:p.trim,p:[sign*.04,-.46,.04],s:[.052,.035,.055]},{g:sphere,c:p.skin,p:[sign*.04,-.53,.055],s:[.044,.069,.026]},{g:sphere,c:p.skin,p:[sign*.005,-.51,.07],s:[.016,.03,.016]}];
 // A readable hand: four fingers and a thumb instead of one mitten volume.
 for(let f=0;f<4;f++)a.push({g:box,c:p.skin,p:[sign*.04+(f-1.5)*.021,-.585,.062],s:[.016,.055,.022],r:[.12,0,0]});
 a.push({g:box,c:p.skin,p:[sign*.012,-.552,.078],s:[.017,.047,.022],r:[.1,0,sign*.5]},{g:cylinder,c:p.coat,p:[sign*.035,-.275,.012],s:[.064,.035,.066]},{g:sphere,c:p.coat,p:[sign*.015,-.02,0],s:[.088,.055,.082]});
 if(sign===1&&craft)a.push({g:cylinder,c:0x795236,p:[.04,-.52,.13],s:[.014,.23,.014],r:[Math.PI/2,0,0]},{g:box,c:0x4a5057,p:[.04,-.52,.235],s:[.14,.06,.055]});if(sign===-1&&(clerk||medical))a.push({g:box,c:medical?0xe6dbc7:0x795541,p:[-.04,-.45,.09],s:[.14,.19,.055]},{g:box,c:0xd5c5a3,p:[-.04,-.45,.123],s:[.11,.16,.008]});if(sign===-1&&(witness||paperKeeper))a.push({g:box,c:paperKeeper?0x84633e:0x5a4e43,p:[-.04,-.45,.09],s:[.16,.22,.065]},{g:box,c:0xe0d0ad,p:[-.04,-.45,.127],s:[.13,.19,.012]});
 if(sign===-1&&(witness||paperKeeper)){for(let line=0;line<4;line++)a.push({g:box,c:0xa49173,p:[-.045,-.39-line*.03,.136],s:[line===3?.065:.092,.004,.003]});a.push({g:cylinder,c:paperKeeper?0xa2534b:0x98644d,p:[-.005,-.51,.14],s:[.015,.005,.015],r:[Math.PI/2,0,0]});}
 if(sign===1&&lamplighter){a.push({g:new THREE.TorusGeometry(.055,.009,4,10),c:0x45565b,p:[.04,-.57,.08]},{g:box,c:0x45565b,p:[.04,-.68,.08],s:[.14,.055,.13]},{g:box,c:0xe7c886,p:[.04,-.79,.08],s:[.11,.16,.10]},{g:box,c:0x45565b,p:[.04,-.9,.08],s:[.15,.04,.14]});for(const x of[-.023,.103])a.push({g:box,c:0x45565b,p:[x,-.79,.08],s:[.016,.2,.12]});}
 batch(arm,`ResidentSleeve_${sign}`,a,material);}
 root.scale.setScalar(.97+(seed%7)*.012);root.userData.triangles=0;root.traverse(o=>{if(o instanceof THREE.Mesh)root.userData.triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});
 root.userData.layer=layer;
 return{socket,root,torso,head,eyes,leftArm,rightArm,faceMesh,phase,craft,signal,witness,lamplighter,bearer,paperKeeper,campaign,headYaw:0,workBlend:0,speechBlend:0};
}
export function createSettlementNpcs(sockets:PlacedNpcSocket[]){
 sockets=sockets.map(s=>({...s,position:[...s.position] as [number,number,number],lines:s.lines.map(l=>[...l] as Localized)}));
 const ids=new Set<string>();for(const s of sockets){if(ids.has(s.id))throw new Error(`Duplicate settlement resident: ${s.id}`);if(!s.position.every(Number.isFinite))throw new Error(`Invalid resident position: ${s.id}`);ids.add(s.id);}
 const group=new THREE.Group();group.name='SettlementResidents';const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:.02});const people=sockets.map(s=>resident(s,material));group.add(...people.map(p=>p.root));
 const lineIndices=new Map<string,number>(),byId=new Map(sockets.map(s=>[s.id,s]));let elapsed=0,disposed=false,speaking:string|null=null;
 const original=new Map(sockets.map(s=>[s.id,{position:[...s.position] as [number,number,number],lines:s.lines.map(l=>[...l] as Localized),yaw:s.yaw??0}]));
 const pending=new Map<string,{position:[number,number,number];yaw:number}>(),gestures=new Map<string,number>();
 return{group,
 setSpeaking(id:string|null){if(!disposed)speaking=id&&byId.has(id)?id:null;},
 getPosition(id:string):[number,number,number]|null{const s=byId.get(id);return !disposed&&s?[...s.position]:null;},
 /** Dialogue changes preserve authored defaults and never mutate caller-owned sockets. */
 setDialogue(id:string,lines:Localized[]|null){const s=byId.get(id);if(disposed||!s)return false;s.lines=(lines??original.get(id)!.lines).map(l=>[...l] as Localized);lineIndices.delete(id);return true;},
 /** Defer relocation until both old and new places are outside visibility distance. */
 requestRelocation(id:string,position:[number,number,number]|null,yaw=0){if(disposed||!byId.has(id))return false;const target=position??original.get(id)!.position;if(!target.every(Number.isFinite)||!Number.isFinite(yaw))return false;pending.set(id,{position:[...target],yaw:position?yaw:original.get(id)!.yaw});return true;},
 gesture(id:string){if(disposed||!byId.has(id))return false;gestures.set(id,1.2);return true;},
 update(dt:number,player:THREE.Vector3){if(disposed)return;dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;elapsed+=dt;for(const person of people){const move=pending.get(person.socket.id);if(move&&player.distanceToSquared(person.root.position)>SETTLEMENT_NPC_LIMITS.visible**2&&((player.x-move.position[0])**2+(player.y-move.position[1])**2+(player.z-move.position[2])**2)>SETTLEMENT_NPC_LIMITS.visible**2){person.root.position.set(...move.position);person.socket.position=[...move.position];person.root.rotation.y=move.yaw;pending.delete(person.socket.id);}const gesture=Math.max(0,(gestures.get(person.socket.id)??0)-dt);if(gesture>0)gestures.set(person.socket.id,gesture);else gestures.delete(person.socket.id);const dx=player.x-person.root.position.x,dz=player.z-person.root.position.z,dy=player.y-person.root.position.y,d2=dx*dx+dz*dz;person.root.visible=d2<SETTLEMENT_NPC_LIMITS.visible**2&&Math.abs(dy)<35;if(!person.root.visible||d2>SETTLEMENT_NPC_LIMITS.animate**2)continue;const t=elapsed+person.phase;person.speechBlend+=((speaking===person.socket.id?1:0)-person.speechBlend)*(1-Math.exp(-dt*12));if(person.faceMesh.morphTargetInfluences){person.faceMesh.morphTargetInfluences[0]=person.speechBlend*(.25+.65*Math.sin(t*13)**2);person.faceMesh.morphTargetInfluences[1]=person.speechBlend*.35;}const idleCycle=(t%13)/13;const working=Math.sin(Math.PI*THREE.MathUtils.clamp((idleCycle-.18)/.24,0,1))**2;const attentive=d2<4.5**2&&Math.abs(dy)<2.4;person.workBlend+=((attentive?0:working)-person.workBlend)*(1-Math.exp(-dt*4));const work=person.workBlend;person.torso.rotation.z=Math.sin(t*.7)*.012;person.torso.scale.y=1+Math.sin(t*1.7)*.006;person.leftArm.rotation.x=-.08+Math.sin(t*1.1)*.025;person.rightArm.rotation.x=-.05+Math.sin(t*(person.craft?1.9:.9))*(person.craft ? .12 : .03);if(person.signal){person.leftArm.rotation.x=-.2;person.rightArm.rotation.x=-.24+Math.sin(t*.55)*.035;}if(person.witness||person.paperKeeper)person.leftArm.rotation.x=-.58-work*.15;if(person.lamplighter)person.rightArm.rotation.x=.05+Math.sin(t*.7)*.025;if(person.bearer)person.leftArm.rotation.x=-.34-work*.06;if(gesture>0)person.rightArm.rotation.x-=Math.sin(Math.PI*(1-gesture/1.2))*(person.campaign?.17:.30);person.leftArm.rotation.z=person.signal?-.18:-.07;person.rightArm.rotation.z=.07;const looking=attentive;person.head.rotation.x=(person.witness||person.paperKeeper?work*.13:person.bearer?work*.07:0);const raw=Math.atan2(dx,dz)-person.root.rotation.y;const target=looking?THREE.MathUtils.clamp(Math.atan2(Math.sin(raw),Math.cos(raw)),-.45,.45):Math.sin(t*.35)*(person.signal||person.lamplighter?.10:.055);person.headYaw+=(target-person.headYaw)*(1-Math.exp(-dt*5));person.head.rotation.y=person.headYaw;person.head.rotation.z=Math.sin(t*.5)*.016;person.eyes.scale.y=t % 4.7 < .10 ? .09 : 1;}},
 nearest(player:THREE.Vector3):PlacedNpcSocket|null{if(disposed)return null;let nearest:PlacedNpcSocket|null=null,distance=SETTLEMENT_NPC_LIMITS.interaction**2;for(const s of sockets){if(Math.abs(player.y-s.position[1])>SETTLEMENT_NPC_LIMITS.vertical)continue;const dx=player.x-s.position[0],dz=player.z-s.position[2],d2=dx*dx+dz*dz;if(d2<=distance){nearest=s;distance=d2;}}return nearest;},
 interact(id:string):Localized|null{if(disposed)return null;const s=byId.get(id);if(!s||!s.lines.length)return null;const i=lineIndices.get(id)??0;lineIndices.set(id,(i+1)%s.lines.length);return s.lines[i];},
 dispose(){if(disposed)return;disposed=true;group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});material.dispose();group.clear();lineIndices.clear();pending.clear();gestures.clear();},
 };
}
