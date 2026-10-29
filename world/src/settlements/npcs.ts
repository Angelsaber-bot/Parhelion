/** Lightweight, authored residents: articulated joint batches, no pathfinding or save mutations. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
const cap=new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI*.58);
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
function taper(top:number,bottom:number,height:number){return new THREE.CylinderGeometry(top,bottom,height,10);}
function batch(parent:THREE.Group,name:string,parts:Part[],material:THREE.Material){
 const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
 const geometries=parts.map(part=>{const g=part.g.clone();q.setFromEuler(new THREE.Euler(...(part.r??[0,0,0])));matrix.compose(new THREE.Vector3(...(part.p??[0,0,0])),q,new THREE.Vector3(...(part.s??[1,1,1])));g.applyMatrix4(matrix);const color=new THREE.Color(part.c),colors=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));return g;});
 const geometry=mergeGeometries(geometries,false);for(const g of geometries)g.dispose();if(!geometry)throw new Error(`Cannot assemble resident ${name}`);const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function resident(socket:PlacedNpcSocket,material:THREE.Material){
 const root=new THREE.Group();root.name=`Resident_${socket.id}`;root.position.set(...socket.position);root.rotation.y=socket.yaw??0;root.userData.settlementNpc=true;root.userData.region=socket.region;
 const seed=hash(socket.id),phase=(seed%997)*.017,p={...PALETTES[socket.region]},role=`${socket.id} ${socket.role.join(' ')}`.toLowerCase();
 const craft=/smith|forge|铁匠|刀匠|锻|工匠/.test(role),medical=/medic|healer|医|救护/.test(role),clerk=/clerk|harbor|customs|港务|海关|账|书记|管家|steward/.test(role),keeper=/inn|旅|客栈|resident|住民/.test(role);
 if(medical){p.coat=0x344e61;p.trim=0xd0c3a3;}if(craft){p.coat=socket.region==='kyoto'?0x414d71:0x6d7162;p.trim=0x725039;}if(keeper){p.coat=socket.region==='kyoto'?0x8b5269:0x78839a;p.trim=0xd5c5a6;}
 const torso=new THREE.Group();torso.name='ResidentTorso';torso.position.y=1.04;root.add(torso);const head=new THREE.Group();head.name='ResidentHead';head.position.y=.48;torso.add(head);const eyes=new THREE.Group();eyes.name='ResidentEyes';head.add(eyes);
 const leftArm=new THREE.Group(),rightArm=new THREE.Group();leftArm.name='ResidentArmLeft';rightArm.name='ResidentArmRight';leftArm.position.set(-.185,.23,0);rightArm.position.set(.185,.23,0);torso.add(leftArm,rightArm);
 const body:Part[]=[{g:taper(.19,.21,.46),c:p.coat,p:[0,.02,0],s:[1,1,.65]},{g:sphere,c:p.coat,p:[0,.19,0],s:[.215,.105,.135]},{g:cylinder,c:p.skin,p:[0,.33,0],s:[.065,.16,.065]},{g:taper(.08,.1,.06),c:p.trim,p:[0,.285,0],s:[1,1,.85]},{g:box,c:p.trim,p:[0,-.14,.005],s:[.405,.055,.279]},{g:box,c:p.accent,p:[0,-.14,.153],s:[.055,.04,.012]}];
 if(socket.region==='kyoto')body.push({g:box,c:p.trim,p:[-.035,.14,.139],s:[.035,.24,.014],r:[0,0,.40]},{g:box,c:p.trim,p:[.035,.14,.145],s:[.035,.24,.014],r:[0,0,-.40]},{g:box,c:p.accent,p:[0,-.105,.01],s:[.422,.145,.284]},{g:box,c:p.trim,p:[0,-.105,.159],s:[.42,.018,.012]});
 else{body.push({g:box,c:p.trim,p:[0,.065,.142],s:[.024,.31,.012]},{g:box,c:p.trim,p:[.115,.065,.147],s:[.07,.012,.01]});for(let i=0;i<3;i++)body.push({g:sphere,c:p.accent,p:[0,.19-i*.085,.155],s:[.011,.011,.006]});}
 if(craft||(keeper&&socket.region!=='kyoto'))body.push({g:box,c:p.trim,p:[0,-.025,.154],s:[.24,.38,.019]},{g:box,c:p.accent,p:[0,-.05,.169],s:[.14,.09,.01]});
 if(socket.region==='winter')body.push({g:sphere,c:p.trim,p:[-.11,.25,0],s:[.11,.06,.14]},{g:sphere,c:p.trim,p:[.11,.25,0],s:[.11,.06,.14]});
 if(keeper||socket.region==='winter'||socket.region==='kyoto')body.push({g:taper(.20,.265,.42),c:p.coat,p:[0,-.37,-.015],s:[1,1,.72]},{g:taper(.26,.267,.035),c:p.trim,p:[0,-.565,-.015],s:[1,1,.72]});
 batch(torso,'ResidentClothing',body,material);
 const legs:Part[]=[];for(const sign of[-1,1])legs.push({g:cylinder,c:0x343b44,p:[sign*.11,.58,0],s:[.079,.50,.085]},{g:taper(.07,.065,.30),c:0x3e302b,p:[sign*.11,.22,.006]},{g:sphere,c:0x332a28,p:[sign*.11,.08,.065],s:[.085,.075,.15]},{g:box,c:0x262528,p:[sign*.11,.028,.065],s:[.16,.025,.24]});batch(root,'ResidentBootsAndLegs',legs,material);
 const features:Part[]=[{g:face,c:p.skin,s:[1,1,.86]},{g:sphere,c:p.skin,p:[-.14,-.018,0],s:[.03,.046,.025]},{g:sphere,c:p.skin,p:[.14,-.018,0],s:[.03,.046,.025]},{g:sphere,c:p.skin,p:[0,-.042,.128],s:[.021,.035,.022]},{g:box,c:0x9b605b,p:[0,-.101,.092],s:[.041,.006,.007]},{g:cap,c:p.hair,p:[0,.036,-.014],s:[.149,.16,.135]}];
 for(const sign of[-1,1])features.push({g:sphere,c:p.hair,p:[sign*.13,.004,-.004],s:[.032,.10,.098]},{g:box,c:p.hair,p:[sign*.059,.037,.123],s:[.065,.014,.01],r:[0,0,sign*-.07]});
 for(let i=0;i<5;i++)features.push({g:cone,c:p.hair,p:[(i-2)*.048,.062-(i%2)*.015,.116],s:[.039,.115,.027],r:[0,0,Math.PI+(i-2)*.12]});
 if(socket.region==='winter')features.push({g:cylinder,c:p.coat,p:[0,.18,-.006],s:[.145,.090,.13]},{g:cylinder,c:p.trim,p:[0,.125,-.006],s:[.15,.032,.136]});
 else if(clerk&&socket.region==='blacksail')features.push({g:new THREE.CylinderGeometry(.21,.22,.035,3),c:0x3d3933,p:[0,.15,-.005],r:[0,Math.PI,0]},{g:cylinder,c:0x3d3933,p:[0,.195,-.008],s:[.125,.065,.105]});else if(clerk)features.push({g:cylinder,c:p.coat,p:[0,.19,-.008],s:[.143,.055,.125]},{g:sphere,c:p.trim,p:[0,.14,.095],s:[.14,.016,.11]});else if(craft)features.push({g:cylinder,c:0xc2b59a,p:[0,.083,-.004],s:[.147,.032,.132]});else if(keeper)features.push({g:sphere,c:p.hair,p:[0,.12,-.14],s:[.09,.08,.075]});
 batch(head,'ResidentFaceAndHair',features,material);
 const ep:Part[]=[];for(const sign of[-1,1])ep.push({g:sphere,c:0x403334,p:[sign*.059,-.008,.113],s:[.036,.020,.007]},{g:sphere,c:0xf5eee6,p:[sign*.059,-.011,.117],s:[.030,.016,.006]},{g:sphere,c:socket.region==='kyoto'?0x6f536e:0x4d6d68,p:[sign*.059,-.01,.122],s:[.013,.015,.003]},{g:sphere,c:0x222b31,p:[sign*.059,-.01,.124],s:[.007,.012,.002]},{g:sphere,c:0xffffff,p:[sign*.055,-.002,.127],s:[.004,.004,.001]});batch(eyes,'ResidentEyes',ep,material);
 for(const[arm,sign]of[[leftArm,-1],[rightArm,1]]as const){const a:Part[]=[{g:sphere,c:p.coat,p:[sign*.02,-.045,0],s:[.082,.073,.077]},{g:taper(.078,.062,.25),c:p.coat,p:[sign*.03,-.155,0]},{g:taper(.065,.047,.23),c:p.coat,p:[sign*.04,-.37,.024],r:[-.16,0,0]},{g:cylinder,c:p.trim,p:[sign*.04,-.46,.04],s:[.052,.035,.055]},{g:sphere,c:p.skin,p:[sign*.04,-.53,.055],s:[.044,.069,.026]},{g:sphere,c:p.skin,p:[sign*.005,-.51,.07],s:[.016,.03,.016]}];
 if(sign===1&&craft)a.push({g:cylinder,c:0x795236,p:[.04,-.52,.13],s:[.014,.23,.014],r:[Math.PI/2,0,0]},{g:box,c:0x4a5057,p:[.04,-.52,.235],s:[.14,.06,.055]});if(sign===-1&&(clerk||medical))a.push({g:box,c:medical?0xe6dbc7:0x795541,p:[-.04,-.45,.09],s:[.14,.19,.055]},{g:box,c:0xd5c5a3,p:[-.04,-.45,.123],s:[.11,.16,.008]});batch(arm,`ResidentSleeve_${sign}`,a,material);}
 root.scale.setScalar(.97+(seed%7)*.012);root.userData.triangles=0;root.traverse(o=>{if(o instanceof THREE.Mesh)root.userData.triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});
 return{socket,root,torso,head,eyes,leftArm,rightArm,phase,craft,headYaw:0};
}
export function createSettlementNpcs(sockets:PlacedNpcSocket[]){
 const ids=new Set<string>();for(const s of sockets){if(ids.has(s.id))throw new Error(`Duplicate settlement resident: ${s.id}`);if(!s.position.every(Number.isFinite))throw new Error(`Invalid resident position: ${s.id}`);ids.add(s.id);}
 const group=new THREE.Group();group.name='SettlementResidents';const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:.02});const people=sockets.map(s=>resident(s,material));group.add(...people.map(p=>p.root));
 const lineIndices=new Map<string,number>(),byId=new Map(sockets.map(s=>[s.id,s]));let elapsed=0,disposed=false;
 return{group,
 update(dt:number,player:THREE.Vector3){if(disposed)return;dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;elapsed+=dt;for(const person of people){const dx=player.x-person.root.position.x,dz=player.z-person.root.position.z,dy=player.y-person.root.position.y,d2=dx*dx+dz*dz;person.root.visible=d2<SETTLEMENT_NPC_LIMITS.visible**2&&Math.abs(dy)<35;if(!person.root.visible||d2>SETTLEMENT_NPC_LIMITS.animate**2)continue;const t=elapsed+person.phase;person.torso.rotation.z=Math.sin(t*.7)*.012;person.torso.scale.y=1+Math.sin(t*1.7)*.006;person.leftArm.rotation.x=-.08+Math.sin(t*1.1)*.025;person.rightArm.rotation.x=-.05+Math.sin(t*(person.craft?1.9:.9))*(person.craft ? .12 : .03);person.leftArm.rotation.z=-.07;person.rightArm.rotation.z=.07;const looking=d2<4.5**2&&Math.abs(dy)<2.4;const raw=Math.atan2(dx,dz)-person.root.rotation.y;const target=looking?THREE.MathUtils.clamp(Math.atan2(Math.sin(raw),Math.cos(raw)),-.45,.45):Math.sin(t*.35)*.04;person.headYaw+=(target-person.headYaw)*(1-Math.exp(-dt*5));person.head.rotation.y=person.headYaw;person.head.rotation.z=Math.sin(t*.5)*.016;person.eyes.scale.y=t % 4.7 < .10 ? .09 : 1;}},
 nearest(player:THREE.Vector3):PlacedNpcSocket|null{if(disposed)return null;let nearest:PlacedNpcSocket|null=null,distance=SETTLEMENT_NPC_LIMITS.interaction**2;for(const s of sockets){if(Math.abs(player.y-s.position[1])>SETTLEMENT_NPC_LIMITS.vertical)continue;const dx=player.x-s.position[0],dz=player.z-s.position[2],d2=dx*dx+dz*dz;if(d2<=distance){nearest=s;distance=d2;}}return nearest;},
 interact(id:string):Localized|null{if(disposed)return null;const s=byId.get(id);if(!s||!s.lines.length)return null;const i=lineIndices.get(id)??0;lineIndices.set(id,(i+1)%s.lines.length);return s.lines[i];},
 dispose(){if(disposed)return;disposed=true;group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});material.dispose();group.clear();lineIndices.clear();},
 };
}
