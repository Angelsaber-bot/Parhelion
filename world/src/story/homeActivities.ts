import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {bilingual,onLanguageChange} from '../../../shared-client/i18n';
import {HOME_CIVIC_ACTIONS,HOME_CIVIC,HOME_TARGETS,HOME_REPORT_REQUIRED,homeCivicReady} from '../map/homeActivities';
import {homeWorld} from '../map/homePlan';
import {RelayChannel,type RelayChannelFrame} from './relayChannel';
import type {Marker} from '../core/types';
import type {Collider} from '../player/player';
import type {Localized} from '../settlements/types';
import type {createNarrativePanel} from '../ui/narrativePanel';

export interface HomeActivityFrame {held:boolean;moving:boolean;attacking:boolean;grounded:boolean;damage:number;unsafeMotion?:boolean;}
export interface HomeActivityHost {
 scene:THREE.Scene;done:Set<string>;dialogue:ReturnType<typeof createNarrativePanel>;
 save:()=>unknown;changed:()=>void;canInteract:(id:string)=>boolean;safe:()=>boolean;rest:()=>boolean;
 toast:(line:Localized)=>void;prepareDialogue:()=>void;refill?:()=>number;input?:()=>HomeActivityFrame;interactLabel?:()=>string;
}
/** Town activities have their own transient lifetimes. Only completed physical actions save facts. */
export function createHomeActivities(h:HomeActivityHost){
 const root=new THREE.Group();root.name='HomeActivities';h.scene.add(root);
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 const markerFor=(id:string)=>HOME_CIVIC_ACTIONS.find(a=>a.id===id);
 const markers:Marker[]=HOME_CIVIC_ACTIONS.map(a=>({id:a.id,type:'interact',label:a.label[0],p:homeWorld(a.p),radius:2.6}));
 const mesh=(name:string,geo:THREE.BufferGeometry,color:number,parent:THREE.Object3D=root)=>{const mat=new THREE.MeshStandardMaterial({color,roughness:.8}),m=new THREE.Mesh(geo,mat);m.name=name;m.castShadow=!/Rug|Channel/.test(name);m.receiveShadow=true;parent.add(m);geometries.add(geo);materials.add(mat);return m;};
 const box=(name:string,p:readonly number[],size:readonly number[],color:number,parent:THREE.Object3D=root)=>{const m=mesh(name,new THREE.BoxGeometry(...size as [number,number,number]),color,parent);m.position.fromArray(p);return m;};
 const at=(name:string,p:readonly [number,number,number])=>{const group=new THREE.Group();group.name=name;group.position.fromArray(homeWorld(p));root.add(group);return group;};
 const boat=at('HomeHaulBoat',[300,.9,126]);
 // Tapered hull with gunwales, ribs, seats and a repair cradle.
 const hull=new THREE.CylinderGeometry(1.6,1,5.6,6,1,false,0,Math.PI*2).rotateX(Math.PI/2).scale(1,.58,1);mesh('HomeBoatHull',hull,0x687e80,boat);
 for(const side of[-1,1])box('BoatGunwale',[side*1.38,.55,0],[.16,.22,5.2],0x936d49,boat);
 for(const z of[-1.7,0,1.7])box('BoatSeat',[0,.55,z],[2.6,.15,.45],0xc2a477,boat);
 for(const x of[-.8,.8])box('RepairCradle',[x,-.6,0],[.25,.4,5.7],0x69523b,boat);
 const winch=at('HomeBoatWinch',[253,6.15,127.6]);box('WinchBase',[0,.35,0],[1.8,.7,1.3],0x5c6c72,winch);
 const drum=mesh('WinchDrum',new THREE.CylinderGeometry(.42,.42,1.5,12).rotateZ(Math.PI/2),0x9e8b6b,winch);drum.position.y=.95;
 const crank=box('WinchHandle',[1,.95,.5],[.18,.18,1.1],0x5e6c70,winch);
 const cableGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...homeWorld([253,7.1,127.6])),boat.position.clone()]);geometries.add(cableGeo);const cableMat=new THREE.LineBasicMaterial({color:0x9c8b69});materials.add(cableMat);const cable=new THREE.Line(cableGeo,cableMat);root.add(cable);
 const boatGeo=new THREE.BoxGeometry(3.2,1.8,5.6),boatBase=boatGeo.attributes.position.clone();geometries.add(boatGeo);
 const boatCollider:Collider={name:'HomeHaulBoat',enabled:true,bvh:new MeshBVH(boatGeo)};
 const syncBoat=()=>{const p=boatGeo.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,boatBase.getX(i)+boat.position.x,boatBase.getY(i)+boat.position.y,boatBase.getZ(i)+boat.position.z);p.needsUpdate=true;boatCollider.bvh.refit();cable.geometry.setFromPoints([new THREE.Vector3(...homeWorld([253,7.1,127.6])),boat.position.clone()]);};
 const lamp=at('HomeLighthouseLens',[250,15,86]);const lens=mesh('HomeGuidingLens',new THREE.SphereGeometry(.7,12,8),0xf9d794,lamp);
 const beamMat=new THREE.MeshBasicMaterial({color:0xffe6ad,transparent:true,opacity:.05,depthWrite:false,side:THREE.DoubleSide});materials.add(beamMat);const beamGeo=new THREE.ConeGeometry(6,60,24,1,true).rotateZ(Math.PI/2).translate(30,0,0);geometries.add(beamGeo);const beam=new THREE.Mesh(beamGeo,beamMat);lamp.add(beam);
 const wheel=mesh('LighthouseHandwheel',new THREE.TorusGeometry(.5,.07,8,18),0xb59a62);wheel.position.fromArray(homeWorld([245,7.2,89]));
 const pump=at('HomeGardenPump',[-110,16.1,113.5]);box('PumpStone',[0,.2,0],[1.5,.4,1.4],0xb6b19e,pump);const pipe=mesh('PumpColumn',new THREE.CylinderGeometry(.15,.2,1.3,10),0x586f6e,pump);pipe.position.y=.95;const lever=box('PumpLever',[.4,1.6,0],[1,.12,.12],0x8f7754,pump);
 box('GardenBed',homeWorld([-106.4,16.2,116.8]),[4.6,.18,2.8],0x87684a);
 const flowers=at('HomeWateredFlowers',[-108,16.15,116]);for(let i=0;i<15;i++){const x=(i%5)*.8,z=Math.floor(i/5)*.8;const bloom=mesh('GardenBloom',new THREE.IcosahedronGeometry(.23,1),i%2?0xe9bf87:0xb68cbb,flowers);bloom.position.set(x,.65,z);const stem=mesh('GardenStem',new THREE.CylinderGeometry(.025,.035,.45,6),0x658358,flowers);stem.position.set(x,.35,z);const leaf=mesh('GardenLeaf',new THREE.IcosahedronGeometry(.13,0),0x789564,flowers);leaf.scale.set(1.4,.4,.8);leaf.position.set(x+.1,.38,z);}
 const water=box('GardenWaterChannel',homeWorld([-109,16.24,115]),[.14,.05,3],0x5ea8b2);
 const basket=at('HomeBreadBasket',[-125.2,17.15,71.4]);box('BreadBasket',[0,0,0],[.8,.35,.55],0xa37e51,basket);for(const x of[-.22,0,.22]){const loaf=mesh('FreshBread',new THREE.CapsuleGeometry(.1,.23,4,8),0xd9ad6d,basket);loaf.rotation.z=Math.PI/2;loaf.position.set(x,.22,0);}
 const bobber=mesh('HomeFishingFloat',new THREE.SphereGeometry(.12,10,8),0xd65b46);bobber.position.fromArray(homeWorld([309,.3,121]));
 const rod=at('HomeFishingRod',[301,7.1,114]);const rodMesh=mesh('FishingRod',new THREE.CylinderGeometry(.025,.06,3.6,6),0x7d6545,rod);rodMesh.rotation.z=-.7;
 const rug=box('HomeChosenRug',homeWorld([-168,16.17,133.2]),[7,.02,5],0x829b9e);
 const keepsakes=at('HomeCivicKeepsakes',[-165,17.4,127]);for(let i=0;i<3;i++)box(`HomeKeepsake_${i}`,[i*.5,0,0],[.3,.35,.25],[0xc6a45c,0x4b8c99,0xc9ac89][i],keepsakes);
 const targets=HOME_TARGETS.map((p,i)=>{const m=mesh(`HomePracticeTarget_${i+1}`,new THREE.CylinderGeometry(.85,.85,.15,24).rotateX(Math.PI/2),0x4d9db5);m.position.fromArray(homeWorld(p));m.userData={target:`home_practice_target_${i+1}`,homeTarget:true};return m;});
 const hud=document.createElement('section');hud.id='home-activity-progress';hud.className='hud';hud.hidden=true;hud.setAttribute('aria-live','polite');Object.assign(hud.style,{position:'fixed',left:'50%',bottom:'150px',transform:'translateX(-50%)',padding:'10px 16px',maxWidth:'min(600px,90vw)',background:'#1c3445ed',color:'#f4e6ce',borderRadius:'8px',textAlign:'center',pointerEvents:'none'});document.body.append(hud);
 let active:string|null=null,channel:RelayChannel|null=null,carrying=false,disposed=false,training=false,trainingHits=new Set<number>(),fish:'idle'|'waiting'|'bite'='idle',fishTime=0,lastDamage=0;
 const commit=(flag:string)=>{h.done.add(flag);h.save();h.changed();apply();};
 const choice=(id:string,line:Localized,items:{id:string;label:Localized}[],accept:(value:string)=>void)=>{h.prepareDialogue();h.dialogue.showChoices(line,markerFor(id)?.label??['归乡广场','Homeward Square'],[...items,{id:'later',label:['稍后再来。','Later.']}],value=>{if(disposed||value==='later'||!h.canInteract(id)||!h.safe())return;accept(value);});};
 function interrupt(){active=null;channel=null;fish='idle';fishTime=0;carrying=false;hud.hidden=true;apply();}
 function apply(){
  const complete=h.done.has(HOME_CIVIC.boat);if(!active||active!=='home_winch'){boat.position.fromArray(homeWorld(complete?[265,6.8,143]:[300,.9,126]));syncBoat();}
  lens.visible=beam.visible=h.done.has(HOME_CIVIC.light);flowers.visible=water.visible=h.done.has(HOME_CIVIC.garden)||active==='home_water';
  basket.visible=true;if(!carrying){basket.position.fromArray(homeWorld(h.done.has(HOME_CIVIC.bread)?[-23,17.68,-30]:[-125.2,17.15,71.4]));basket.quaternion.identity();}
  bobber.visible=rod.visible=fish!=='idle';
  const color=h.done.has('home_decor_rose')?0xb28c8f:h.done.has('home_decor_moss')?0x869a70:0x829b9e;(rug.material as THREE.MeshStandardMaterial).color.setHex(color);
  keepsakes.children.forEach((o,i)=>o.visible=h.done.has([HOME_CIVIC.complete,HOME_CIVIC.practice,HOME_CIVIC.fish][i]));
  targets.forEach((t,i)=>t.visible=training&&!trainingHits.has(i));
 }
 function interact(id:string){
  if(!HOME_CIVIC_ACTIONS.some(a=>a.id===id)&&id!=='home_notice')return false;
  if(!h.canInteract(id)||!h.safe())return true;
  const action=markerFor(id);
  if(action?.seconds){
   if(active===id)return true;
   if(action.flag&&h.done.has(action.flag)){h.toast(['这处设施已经恢复，完成记录已保留。','This facility is restored; its completion is kept.']);return true;}
   interrupt();active=id;channel=new RelayChannel(action.seconds);channel.reset(h.input?.().damage??0);h.toast(action.hint);apply();return true;
  }
  if(id==='home_notice'){
   const count=HOME_REPORT_REQUIRED.filter(f=>h.done.has(f)).length;
   choice(id,[`镇上的四件事：送面包、起船、校准灯塔、给花园供水。已完成 ${count}/4。做完后回来亲自报个平安。`,`Four town jobs: deliver bread, haul the boat, align the lighthouse and water the garden. Completed ${count}/4. Return here to report when ready.`],homeCivicReady(h.done)?[{id:'report',label:['向大家报告：事情都办好了。','Report that the town jobs are finished.']}]:[{id:'accept',label:['记下这些事，我来帮忙。','I will help with these jobs.']}],value=>{if(value==='report'&&homeCivicReady(h.done))commit(HOME_CIVIC.complete);else if(value==='accept')commit(HOME_CIVIC.started);});
  }else if(id==='home_bread_pickup'){
   if(h.done.has(HOME_CIVIC.bread)){h.toast(['今天送给公馆的面包已经收到了。','The house has received its bread.']);return true;}
   interrupt();carrying=true;lastDamage=h.input?.().damage??0;h.toast(action!.hint);apply();
  }else if(id==='home_bread_drop'){
   if(carrying){carrying=false;commit(HOME_CIVIC.bread);h.toast(['面包篮已放到公馆厨房，照管人签收了。','The bread basket reaches the pantry; the housekeeper signs for it.']);}
   else h.toast(['先到面包房领取篮子，亲手带过来。','Collect the basket at the bakery and carry it here.']);
  }else if(id==='home_practice_start'){
   if(!h.done.has('armory_rack')){h.toast(['先在幻日谷工坊领取装备，再来练习。','Collect your equipment at the valley armory first.']);return true;}
   training=!training;trainingHits.clear();h.toast(training?action!.hint:['本轮练习已结束，可随时重来。','Practice ended. Restart whenever ready.']);apply();
  }else if(id==='home_fishing'){
   if(fish==='bite'){fish='idle';commit(HOME_CIVIC.fish);h.toast(['钓到一尾银鳍鱼，记下速写后把它放回海里。家中纪念架多了一张记录。','A silverfin! Sketch it, then release it. A new record waits on your keepsake shelf.']);}
   else if(fish==='waiting'){h.toast(['浮漂还没沉，耐心等一会儿。','The float has not dipped yet. Wait a little.']);}
   else {interrupt();fish='waiting';fishTime=4.5;lastDamage=h.input?.().damage??0;h.toast(action!.hint);}apply();
  }else if(id==='home_repair_service')choice(id,['工坊的装备用旧了也能继续用。需要补充弹药吗？','Your existing equipment can keep going. Refill its ammunition?'],[{id:'refill',label:['补充已有装备弹药。','Refill existing equipment.']}],()=>{if(!h.done.has('armory_rack')){h.toast(['先在幻日谷领取装备。','Collect your equipment in the valley first.']);return;}const n=h.refill?.()??0;h.toast([`补充了 ${n} 发弹药。`,`Replenished ${n} rounds.`]);});
  else if(id==='home_clinic_service'||id==='home_bakery_service')choice(id,id==='home_clinic_service'?['先坐稳，我看看你的伤。','Sit still and let me check your wounds.']:['面包刚出炉，也替公馆留了一篮。','Fresh bread is ready; a basket is set aside for the house.'],[{id:'rest',label:id==='home_clinic_service'?['接受治疗。','Receive treatment.']:['吃一点热面包。','Have some fresh bread.']}],()=>{h.toast(h.rest()?['休息后恢复了一些生命。','You recover some health.']:['现在状态很好。','You are already well rested.']);});
  else if(id==='home_tailor_service'||id==='home_grocer_service')choice(id,['选一套家中布艺，地毯与陈设会立即换色，记录随世界保存。','Choose home textiles. Your rug changes immediately and the choice is saved with your world.'],[{id:'sea',label:['海风蓝。','Sea blue.']},{id:'rose',label:['晚霞玫瑰。','Sunset rose.']},{id:'moss',label:['花园苔绿。','Garden moss.']}],value=>{for(const c of['sea','rose','moss'])h.done.delete(`home_decor_${c}`);commit(`home_decor_${value}`);});
  else if(id==='home_collection'){h.prepareDialogue();const names:[[string,string],string][]=[[['归乡镇的回报','Homeward town report'],HOME_CIVIC.complete],[['三靶练习记录','Three-target practice record'],HOME_CIVIC.practice],[['银鳍鱼速写','Silverfin sketch'],HOME_CIVIC.fish]];h.dialogue.show([names.map(([n,f])=>`${h.done.has(f)?'✓':'○'} ${n[0]}`).join('\n'),names.map(([n,f])=>`${h.done.has(f)?'✓':'○'} ${n[1]}`).join('\n')],['家中的纪念架','Home keepsake shelf']);}
  else if(id==='home_cafe_service'){h.prepareDialogue();h.dialogue.show(['今日小报：灯塔'+(h.done.has(HOME_CIVIC.light)?'已重新指向外海':'正在等待校准')+'，花园'+(h.done.has(HOME_CIVIC.garden)?'开花了':'还等着浇水')+'。这里的消息，来自你亲手做过的事。','Town news: '+(h.done.has(HOME_CIVIC.light)?'the lighthouse guides the sea approach':'the lighthouse awaits alignment')+'; '+(h.done.has(HOME_CIVIC.garden)?'the garden is blooming':'the garden needs water')+'. The news follows what you actually did.'],['海风咖啡馆','Sea Breeze Cafe']);}
  return true;
 }
 function hit(id:string){const i=targets.findIndex(t=>t.userData.target===id);if(i<0)return false;if(!training)return true;trainingHits.add(i);if(trainingHits.size===targets.length){training=false;commit(HOME_CIVIC.practice);h.toast(['三面靶全部命中，练习记录已保存。到练习牌可以再来一轮。','All three targets hit. Practice is recorded; restart at the board whenever ready.']);}apply();return true;}
 function update(dt:number,p:THREE.Vector3,playable:boolean){
  if(disposed)return;dt=Number.isFinite(dt)?Math.min(.05,Math.max(0,dt)):0;
  const input=h.input?.()??{held:false,moving:false,attacking:false,grounded:false,damage:0};
  // A small porch/ramp drop may briefly clear onGround during an ordinary walk.
  // Carrying survives those frames; swimming, flight, gliding and actual interruptions do not.
  if((carrying||fish!=='idle'||active)&&(!playable||input.unsafeMotion||!input.grounded&&!carrying||input.attacking||input.damage!==lastDamage&&(carrying||fish!=='idle'))){interrupt();return;}
  if(training&&(!playable||Math.hypot(p.x-790,p.z+110)>28||!input.grounded)){training=false;trainingHits.clear();apply();}
  if(active&&channel){
   const a=markerFor(active)!;const frame:RelayChannelFrame={...input,dt,active:true,playable,inRange:h.canInteract(active),damageRevision:input.damage};
   const result=channel.update(frame);if(result.interrupted||!frame.inRange||input.moving){interrupt();return;}
   if(active==='home_winch'){const progress=channel.progress;boat.position.fromArray(homeWorld(progress<.35?[300,.9+progress/.35*6.7,126]:[300-(progress-.35)/.65*35,7.6-(progress-.35)/.65*.8,126+(progress-.35)/.65*17]));syncBoat();drum.rotation.x=progress*20;crank.rotation.x=progress*20;}
   if(active==='home_lighthouse')wheel.rotation.z=channel.progress*Math.PI*2;
   if(active==='home_water')lever.rotation.z=Math.sin(channel.progress*30)*.4;
   hud.hidden=false;hud.textContent=bilingual(`${a.label[0]} ${Math.round(channel.progress*100)}% · ${channel.requiresRelease?'先松开，再按住':`按住 ${h.interactLabel?.()??'F'}`}`,`${a.label[1]} ${Math.round(channel.progress*100)}% · ${channel.requiresRelease?'Release, then hold':`Hold ${h.interactLabel?.()??'F'}`}`);
   if(result.completedNow){const flag=a.flag!;active=null;channel=null;commit(flag);hud.hidden=true;h.toast(['设施操作完成，记得回广场报告。','Work complete. Return to the square to report.']);}
  }else if(fish!=='idle'){
   if(!h.canInteract('home_fishing')||input.moving){interrupt();return;}
   fishTime-=playable?dt:0;if(fishTime<=0){if(fish==='waiting'){fish='bite';fishTime=3;}else{fish='idle';h.toast(['鱼儿游走了，随时可以再抛一竿。','The fish swims away. Cast again whenever ready.']);apply();}}
   bobber.position.y=fish==='bite'?-.12:.3+Math.sin(fishTime*3)*.05;hud.hidden=fish==='idle';hud.textContent=bilingual(fish==='bite'?`浮漂下沉了！按 ${h.interactLabel?.()??'F'} 提竿。`:'等浮漂下沉…',fish==='bite'?`The float dips! Press ${h.interactLabel?.()??'F'} to reel in.`:'Wait for the float to dip…');
  }else{hud.hidden=!carrying;if(carrying)hud.textContent=bilingual('带着面包篮前往公馆厨房 · 菜单或攻击会将篮子放回。','Carry the bread to the house pantry. Menus or attacks return the basket.');}
 }
 const unsubscribe=onLanguageChange(()=>{if(!hud.hidden)hud.textContent='';});
 apply();
 return{root,markers,targets,colliders:[boatCollider],apply,interact,hit,update,interrupt,
  get carrying(){return carrying;},get carried(){return basket;},get active(){return active;},get progress(){return channel?.progress??0;},get fishing(){return fish;},get training(){return training;},
  reset(){interrupt();training=false;trainingHits.clear();apply();},
  dispose(){if(disposed)return;disposed=true;root.removeFromParent();hud.remove();unsubscribe();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
 };
}
