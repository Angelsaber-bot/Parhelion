import {createJourneyPassageArt} from '../environment/journeyPassageArt';
import {createAdventureFacilityArt} from '../environment/adventureFacilityArt';
import {flagshipPoint} from '../map/shipInteriorCut';
import {CONVOY_ROUTE} from './convoyRoute';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {SiteArt} from './campaignSites';
import type {Marker} from '../core/types';
import type {Collider} from '../player/player';
import type {Localized,RegionId} from '../settlements/types';
import {ADVENTURE as A,adventureChapterComplete,type AdventurePoint} from './openWorldCampaign';
import {gatePoint} from './kingdomGate';
import { HARBOR_RELIEF as R, HARBOR_MEDICINE_LANE, HARBOR_MERCHANT_LANE } from './harborRelief';
export interface AdventureAction {id:string;region:RegionId;label:Localized;p:AdventurePoint;seconds?:number;flag?:string;hint?:Localized;}
export const ADVENTURE_ACTIONS:readonly AdventureAction[]=[
 ...(['britain','blacksail','winter','kyoto'] as const).map((region,i):AdventureAction=>({id:`adventure_home_${region}`,region:'alpha',label:[['归人工匠补给台','海港运补台','暖路药箱','京都归人茶席'][i],['Returner workshop','Harbor supply desk','Warmroad medicine chest','Kyoto travelers’ tea'][i]],p:[-94+i*3,10,237]})),
 {id:'adventure_harbor_rigging',region:'blacksail',label:['侧舷索具绞盘','Side rigging winch'],p:[1009,10.5,-724],seconds:3,flag:A.harborSide},
 {id:R.reserve,region:'blacksail',label:['码头药箱 · 查验封条','Quay medicine crate · Check the seals'],p:[598,3.4,-578],flag:R.reserve},
 {id:R.lookout,region:'blacksail',label:['港灯信号 · 调开海务哨点','Harbor lamp · Divert the customs lookout'],p:[586,3.4,-573],flag:R.lookout},
 {id:R.crossing,region:'blacksail',label:['支栈缆索 · 升起通航','Side-pier cable · Raise for passage'],p:[600,3.4,-498],seconds:2,flag:R.crossing},
 {id:R.launch,region:'blacksail',label:['外码头 · 放行急救艇','Outer pier · Launch the relief skiff'],p:[600,3.4,-479],flag:R.launch},
 {id:'adventure_harbor_records',region:'blacksail',label:['真实航路记录','True voyage record'],p:flagshipPoint(10,.7,3.4),seconds:2,flag:A.records},
 {id:'adventure_harbor_exit',region:'blacksail',label:['灯塔离舰检查点','Lighthouse disembarkation'],p:[1005,10.5,-724],flag:A.exited},
 {id:'adventure_harbor_depart',region:'blacksail',label:['暖灯出港信号','Warm-light departure signal'],p:[599,3.4,-583],flag:A.sailing},
 {id:'adventure_winter_latch',region:'winter',label:['拒马侧闩 · 或射断两支架','Roadblock latch · or shoot both braces'],p:[34,5,-680],seconds:3,flag:A.road},
 {id:'adventure_winter_support',region:'winter',label:['宽街突破信号 · 当地骑兵支援','Wide-road breach signal · Local cavalry'],p:[40,5,-687]},
 {id:'adventure_winter_convoy',region:'winter',label:['药车启程信号','Medicine convoy departure'],p:[40,5,-650],flag:A.convoy},
 {id:'adventure_winter_arrival',region:'winter',label:['渡口药车验收','Receive the medicine cart'],p:[36,5,-458],flag:A.arrived},
 {id:'adventure_kyoto_water',region:'kyoto',label:['水门检修栈道锁','Water-gate maintenance walkway latch'],p:[763,4,-1460],seconds:2,flag:A.water},
 {id:'adventure_kyoto_evidence',region:'kyoto',label:['焦黑的命令板','Charred command record'],p:[800,4.6,-1494],seconds:2,flag:A.evidence},
 ...([-1,1,0] as const).map((side,i):AdventureAction=>({id:A.emitters[i],region:'alpha',label:[`复制发射器 ${i+1}`,`Copying emitter ${i+1}`],p:[side*25,5,i===2?-110:-140],seconds:3,flag:A.emitters[i]})),
 {id:'adventure_guardian',region:'alpha',label:['塔前讯号源 · 守门者','Tower signal source · Warden'],p:[0,5,-105]},
 {id:'adventure_tower',region:'alpha',label:['塔顶手动接管台','Tower manual override'],p:[2,30.5,-150.5],seconds:3,flag:A.takeover},
 {id:'adventure_exit',region:'alpha',label:['南侧撤离集合点','Southern evacuation point'],p:[0,5,-95],flag:A.escaped},
 {id:'adventure_tomorrow',region:'alpha',label:['观测所 · 未写下的明天','Observatory · An Unwritten Tomorrow'],p:[-114,10,229.6],flag:A.ending},
 {id:'adventure_kingdom_abbey',region:'britain',label:['修院外墙维修架','Abbey wall maintenance scaffold'],p:gatePoint(-24,26),seconds:2,flag:'adventure_kingdom_abbey'},
];
export const ADVENTURE_LEISURE:readonly {region:RegionId;p:AdventurePoint;line:Localized}[]=[
 {region:'alpha',p:[-72,10,240],line:['修理工：“三声都响了。这次就算一次合格的噪声测试。”','Mechanic: “Three good rings. That counts as a successful noise test.”']},
 {region:'britain',p:[-544,5,-188],line:['营地骑士：“枪比礼节快。可别忘了等同伴准备好。”','Camp knight: “The gun is quicker than ceremony. Remember to wait for your companion.”']},
 {region:'blacksail',p:[586,3.4,-582],line:['酒馆老板：“三瓶全中。账记在木板上，酒可没打算送你。”','Innkeeper: “Three bottles. The score is on the board; the drinks still cost money.”']},
 {region:'winter',p:[-157,6,-582],line:['军需官：“比起向雪开枪，这至少能知道器材有没有冻住。”','Quartermaster: “Better than shooting snow. At least we know the equipment has not frozen.”']},
 {region:'kyoto',p:[556,5.2,-1363],line:['武藏：“三发都中。下回试试先让风走过去。”','Musashi: “Three hits. Next time, let the wind pass first.”']},
];
export function createAdventureSites(floor:(x:number,z:number,ceiling?:number)=>number|null){
 const root=new THREE.Group(),art=new SiteArt(),markers:Marker[]=[],actions=new Map<string,AdventureAction>(),targets:THREE.Mesh[]=[],colliders:Collider[]=[];
 const privateGeos:THREE.BufferGeometry[]=[],materials=new Set<THREE.Material>();
 const at=(p:AdventurePoint):AdventurePoint=>[p[0],floor(p[0],p[2],p[1]+2)??floor(p[0],p[2])??p[1],p[2]];
 for(const action of ADVENTURE_ACTIONS){
  const p=at(action.p),entry={...action,p};actions.set(action.id,entry);
  markers.push({id:action.id,type:'interact',label:action.label[0],p:[p[0],p[1]+.9,p[2]],radius:2.3});

 }
 function target(id:string,p:AdventurePoint,size:AdventurePoint){const material=new THREE.MeshStandardMaterial({color:'#e5b659',emissive:'#503a14'});materials.add(material);const g=id.includes('fun_blacksail')?new THREE.CylinderGeometry(.065,.14,.7,12):id.includes('fun_alpha')?new THREE.CylinderGeometry(.25,.2,.55,12):id.includes('fun_britain')?new THREE.CylinderGeometry(.3,.3,.16,10).rotateX(Math.PI/2):new THREE.BoxGeometry(...size);const m=new THREE.Mesh(g,material);m.position.fromArray(p);m.userData.target=id;root.add(m);targets.push(m);return m;}
 const brace1=at([37,5,-680]),brace2=at([43,5,-680]);
 for(const [i,p]of[brace1,brace2].entries())target(i===0?A.brace1:A.brace2,[p[0],p[1]+1.3,p[2]],[.45,1.7,.4]);
 const obstacle=new THREE.Mesh(new THREE.BoxGeometry(8,1.4,1),new THREE.MeshStandardMaterial({color:'#686354'}));obstacle.position.set(40,((brace1[1]+brace2[1])/2)+.7,-680);root.add(obstacle);obstacle.updateMatrixWorld(true);
 const roadArt=new SiteArt(),debrisArt=new SiteArt(),roadY=(brace1[1]+brace2[1])/2;
 for(const x of[36.8,38.4,40,41.6,43.2]){
  for(const side of[-1,1])roadArt.beam([x-.45,roadY+.06,-680+side*.72],[x+.45,roadY+1.48,-680-side*.72],.18,'#74664f');
  roadArt.beam([x-.6,roadY+.8,-680],[x+.6,roadY+.8,-680],.16,'#4b4e48');
  debrisArt.beam([x-.5,roadY+.1,-681.8],[x+.5,roadY+.18,-682.6],.17,'#74664f');
 }
 roadArt.beam([36,roadY+.8,-680],[44,roadY+.8,-680],.18,'#62523e');
 for(const x of[37,43]){roadArt.ring([x,roadY+1.2,-679.75],.19,.025,'#b29b65');debrisArt.ring([x,roadY+.13,-682],.19,.025,'#b29b65','metal',[Math.PI/2,0,0]);}
 roadArt.finish('winter');debrisArt.finish('winter');root.add(roadArt.root,debrisArt.root);obstacle.removeFromParent();privateGeos.push(obstacle.geometry);
 const obstacleGeometry=obstacle.geometry.clone().applyMatrix4(obstacle.matrixWorld);privateGeos.push(obstacleGeometry);
 const roadCollider:Collider={name:'COL_AdventureWinterRoad',bvh:new MeshBVH(obstacleGeometry),enabled:true};colliders.push(roadCollider);
 // Actual sloped collision creates a second entrance over the existing temple wall.
 function ramp(name:string,route:AdventurePoint[],width:number){
  const a=new SiteArt();for(let i=1;i<route.length;i++){
   const p=route[i-1],q=route[i],dx=q[0]-p[0],dz=q[2]-p[2],length=Math.hypot(dx,dz),sx=dz/length*width/2,sz=-dx/length*width/2,bottom=Math.min(p[1],q[1])-2,pb=name==='kyoto-roofs'?p[1]-.18:bottom,qb=name==='kyoto-roofs'?q[1]-.18:bottom;
   const vertices=[p[0]-sx,p[1],p[2]-sz,p[0]+sx,p[1],p[2]+sz,q[0]+sx,q[1],q[2]+sz,q[0]-sx,q[1],q[2]-sz,p[0]-sx,pb,p[2]-sz,p[0]+sx,pb,p[2]+sz,q[0]+sx,qb,q[2]+sz,q[0]-sx,qb,q[2]-sz];
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex([0,2,1,0,3,2,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,4,5,6,4,6,7]);geo.computeVertexNormals();
   a.add(geo,'#897052',[0,0,0],[1,1,1],true);geo.dispose();
   for(let d=0;d<=length;d+=.55){const t=d/length,h=p[1]+(q[1]-p[1])*t;const center=new THREE.Vector3(p[0]+dx*t,h+.025,p[2]+dz*t);const across=new THREE.Vector3(sx*.97,.0,sz*.97);a.beam(center.clone().sub(across).toArray() as AdventurePoint,center.clone().add(across).toArray() as AdventurePoint,.08,'#b49a70');}
   for(const side of[-1,1]){const offx=sx*side,offz=sz*side;a.beam([p[0]+offx,p[1]-.16,p[2]+offz],[q[0]+offx,q[1]-.16,q[2]+offz],.16,'#5f4b34');
    for(let d=1;d<length;d+=3){const t=d/length,h=p[1]+(q[1]-p[1])*t,x=p[0]+dx*t+offx,z=p[2]+dz*t+offz;a.beam([x,bottom,z],[x,h+.85,z],.09,'#786247');}
    a.beam([p[0]+offx,p[1]+.85,p[2]+offz],[q[0]+offx,q[1]+.85,q[2]+offz],.065,'#bba37a');}

  }a.finish(name==='kyoto'?'kyoto':'britain');root.add(a.root);
  const bvs=a.solids.map((g,i)=>({name:`COL_AdventureRamp_${name}_${i}`,bvh:new MeshBVH(g),enabled:false}));colliders.push(...bvs);return{art:a,colliders:bvs};
 }
 const kyotoRamp=ramp('kyoto',[[763,4.45,-1460],[773,8.8,-1460],[779,8.8,-1460],[797,4.7,-1460]],3);
 const abbeyStart=gatePoint(-24,26),abbeyEnd=gatePoint(-24,-34);abbeyStart[1]=(floor(abbeyStart[0],abbeyStart[2])??34)+.05;abbeyEnd[1]=(floor(abbeyEnd[0],abbeyEnd[2])??34)+.05;
 const abbeyRoute=[abbeyStart,gatePoint(-24,0,8.8),gatePoint(-24,-12,8.8),abbeyEnd];
 const abbeyRamp=ramp('abbey',abbeyRoute,3.5);
 const passages=createJourneyPassageArt();root.add(passages.abbey.root,passages.houses.root);
 const passageColliders=[...passages.abbey.solids,...passages.houses.solids].map((g,i)=>({name:`COL_JourneyInterior_${i}`,bvh:new MeshBVH(g),enabled:true}));colliders.push(...passageColliders);
 const roofRamp=ramp('kyoto-roofs',passages.roofRoute,2.6);

 // Same medicine cart at departure, transit checkpoints and the crossing.
 const cart=new THREE.Group();root.add(cart);
 const cartBody=new THREE.Mesh(new THREE.BoxGeometry(1.6,.6,2.4),new THREE.MeshStandardMaterial({color:'#695548'}));cartBody.position.y=.9;cart.add(cartBody);
 const wheels:THREE.Object3D[]=[];
 for(const x of[-.95,.95])for(const z of[-.8,.8]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.14,10),new THREE.MeshStandardMaterial({color:'#423b34'}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.45,z);cart.add(wheel);wheels.push(wheel);for(let spoke=0;spoke<8;spoke++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.055,.74,.055),wheel.material);bar.rotation.x=spoke*Math.PI/4;wheel.add(bar);}}
 for(const side of[-1,1]){const shaft=new THREE.Mesh(new THREE.BoxGeometry(.09,.12,3.4),new THREE.MeshStandardMaterial({color:'#5d4934'}));shaft.position.set(side*.65,.6,1.35);cart.add(shaft);const axle=new THREE.Mesh(new THREE.BoxGeometry(1.9,.1,.1),shaft.material);axle.position.set(0,.45,side*.8);cart.add(axle);}
 for(let plank=-2;plank<=2;plank++){const slat=new THREE.Mesh(new THREE.BoxGeometry(.27,.04,2.3),new THREE.MeshStandardMaterial({color:'#9c815a'}));slat.position.set(plank*.3,1.23,0);cart.add(slat);}
 const aid=new THREE.Mesh(new THREE.BoxGeometry(.65,.15,1),new THREE.MeshStandardMaterial({color:'#ece2d0'}));aid.position.y=1.3;cart.add(aid);
 const convoyPath=CONVOY_ROUTE.map(p=>[...p] as AdventurePoint);
 const ship=new THREE.Group();root.add(ship);ship.name='NassauMerchantDeparture';
 const hullOutline=new THREE.Shape();hullOutline.moveTo(-2.3,-5.8);for(const[x,z]of[[2.3,-5.8],[2.6,2.5],[1.4,5.8],[0,7],[-1.4,5.8],[-2.6,2.5]])hullOutline.lineTo(x,z);hullOutline.closePath();
 const hullGeo=new THREE.ExtrudeGeometry(hullOutline,{depth:1.5,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.15,bevelThickness:.15});hullGeo.rotateX(Math.PI/2);
 const hull=new THREE.Mesh(hullGeo,new THREE.MeshStandardMaterial({color:'#69513d'}));hull.position.y=.5;ship.add(hull);
 const deckGeo=new THREE.ShapeGeometry(hullOutline);deckGeo.rotateX(Math.PI/2);const deck=new THREE.Mesh(deckGeo,new THREE.MeshStandardMaterial({color:'#a78c61',side:THREE.DoubleSide}));deck.position.y=.54;ship.add(deck);
 for(const x of[-2.25,2.25]){const rail=new THREE.Mesh(new THREE.BoxGeometry(.12,.3,8),new THREE.MeshStandardMaterial({color:'#3c3028'}));rail.position.set(x,.8,-1);ship.add(rail);}

 const mast=new THREE.Mesh(new THREE.CylinderGeometry(.13,.18,10,8),new THREE.MeshStandardMaterial({color:'#5b4937'}));mast.position.y=5;ship.add(mast);
 const sail=new THREE.Mesh(new THREE.PlaneGeometry(6,7),new THREE.MeshStandardMaterial({color:'#d8c9aa',side:THREE.DoubleSide}));sail.position.set(0,6,.2);ship.add(sail);
 const relief=ship.clone();relief.name='NassauReliefSkiff';relief.scale.set(.57,.54,.58);root.add(relief);
 const medicineMaterial=new THREE.MeshStandardMaterial({color:'#e4e2cc'});
 const medicineSeal=new THREE.MeshStandardMaterial({color:'#8a5041'});
 function supply(parent:THREE.Group,x:number,y:number,z:number){
  const crate=new THREE.Mesh(new THREE.BoxGeometry(1,.62,.87),medicineMaterial);crate.position.set(x,y,z);parent.add(crate);
  for(const [w,d] of [[.52,.11],[.11,.47]]){const mark=new THREE.Mesh(new THREE.BoxGeometry(w,.018,d),medicineSeal);mark.position.set(x,y+.318,z);parent.add(mark);}
 }
 supply(relief,0,.88,1.2);
 const cable = new THREE.Group(); cable.name = 'NassauReliefPierCable'; root.add(cable);
 const cableMaterial = new THREE.MeshStandardMaterial({color:'#786246'});
 for (const x of [HARBOR_MEDICINE_LANE.x-7,HARBOR_MEDICINE_LANE.x+7]) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,8,10),cableMaterial);post.position.set(x,2,-491);cable.add(post);
 }
 const span = new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,14,8),cableMaterial);
 span.position.set(HARBOR_MEDICINE_LANE.x,2,-491);span.rotation.z=Math.PI/2;cable.add(span);
 const received=new THREE.Group();received.name='ValleyDeliveredMedicine';root.add(received);
 const chestBase=actions.get('adventure_home_blacksail')!.p;
 received.position.set(chestBase[0]+.65,chestBase[1],chestBase[2]+2.8);
 supply(received,.4,.35,0);supply(received,1.55,.35,0);
 const fun=new Map<string,{region:RegionId;line:Localized;ids:string[]}>();
 for(const item of ADVENTURE_LEISURE.filter(item=>item.region!=='winter'&&item.region!=='kyoto')){const base=at(item.p),ids:string[]=[];for(let i=0;i<3;i++){const id=`adventure_fun_${item.region}_${i+1}`;ids.push(id);target(id,[base[0]+(i-1)*1.1,base[1]+1.2,base[2]],[.3,.7,.3]);}fun.set(item.region,{...item,ids});}
 art.finish('alpha');root.add(art.root);const facilities=createAdventureFacilityArt(actions);root.add(facilities.root);colliders.push(...facilities.colliders);root.name='OpenWorldAdventure';
 const homeLights:THREE.Mesh[]=[];for(let i=0;i<4;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),new THREE.MeshBasicMaterial({color:'#b4e2b7'}));m.position.set(-93+i*3,11.6,237);root.add(m);homeLights.push(m);}

 const priorCart=new THREE.Vector3();let cartInitialized=false;
 function apply(done:ReadonlySet<string>,dt=0,cartPosition?:AdventurePoint,departureProgress=done.has(A.departed)?1:0,reliefProgress=done.has(R.delivered)?1:done.has(R.underway)?0.5:0){
  facilities.apply(done,dt);
  homeLights.forEach((m,i)=>{m.visible=adventureChapterComplete((['britain','blacksail','winter','kyoto'] as const)[i],done)||(i===1&&done.has(R.delivered));});
  const open=!done.has(A.started)||done.has(A.road)||done.has('winter_core');obstacle.visible=false;roadArt.root.visible=!open;debrisArt.root.visible=open&&done.has(A.road);roadCollider.enabled=!open;
  for(const t of targets)t.visible=!done.has(t.userData.target as string)&&(!(t.userData.target===A.brace1||t.userData.target===A.brace2)||!open);
  kyotoRamp.art.root.visible=done.has(A.water);roofRamp.art.root.visible=done.has(A.water);for(const c of roofRamp.colliders)c.enabled=done.has(A.water);for(const c of kyotoRamp.colliders)c.enabled=done.has(A.water);
  abbeyRamp.art.root.visible=done.has('adventure_kingdom_abbey');for(const c of abbeyRamp.colliders)c.enabled=done.has('adventure_kingdom_abbey');
  const leg=done.has(A.arrived)?convoyPath.length-1:Math.min(convoyPath.length-1,[...done].filter(id=>/^adventure_cart_leg_\d+$/.test(id)).length);
  priorCart.copy(cart.position);cart.visible=done.has(A.convoy)||done.has(A.arrived);cart.position.fromArray(done.has(A.arrived)?convoyPath.at(-1)!:cartPosition??convoyPath[leg]);
  if(cartInitialized&&dt>0){const d=cart.position.clone().sub(priorCart),distance=d.length();if(distance>1e-5&&distance<1){const wanted=Math.atan2(d.x,d.z),delta=Math.atan2(Math.sin(wanted-cart.rotation.y),Math.cos(wanted-cart.rotation.y));cart.rotation.y+=THREE.MathUtils.clamp(delta,-dt*4,dt*4);for(const wheel of wheels)wheel.rotation.x+=distance/.45;}}cartInitialized=true;
  const merchant=HARBOR_MERCHANT_LANE, medicine=HARBOR_MEDICINE_LANE;
  ship.position.set(merchant.x,1.5,THREE.MathUtils.lerp(merchant.startZ,merchant.endZ,THREE.MathUtils.clamp(departureProgress,0,1)));
  ship.visible=!done.has(A.departed);
  relief.position.set(medicine.x,1.38,THREE.MathUtils.lerp(medicine.startZ,medicine.endZ,THREE.MathUtils.clamp(reliefProgress,0,1)));
  relief.visible=done.has(R.reserve)&&!done.has(R.delivered);received.visible=done.has(R.delivered);
  cable.visible=done.has(R.reserve);span.position.y=done.has(R.crossing)?5.8:2;
 }
 return {root,markers,actions,targets,colliders,fun,convoyPath,abbeyRoute,roofRoute:passages.roofRoute,ship,cart,apply,
  dispose(){facilities.dispose();for(const a of [passages.abbey,passages.houses,roofRamp.art]){Object.values(a.materials).forEach(m=>m.dispose());a.solids.forEach(g=>g.dispose());}Object.values(roadArt.materials).forEach(m=>m.dispose());Object.values(debrisArt.materials).forEach(m=>m.dispose());root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const m of materials)m.dispose();for(const g of[...art.solids,...privateGeos,...kyotoRamp.art.solids,...abbeyRamp.art.solids])g.dispose();Object.values(art.materials).forEach(m=>m.dispose());root.removeFromParent();},
 };
}
