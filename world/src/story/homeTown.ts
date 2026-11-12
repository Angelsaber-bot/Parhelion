import * as THREE from 'three';
import {HOME_ACTIONS,HOME_BUILDINGS,SABER_HOME_WALK,homeWorld} from '../map/homePlan';
import type {Marker} from '../core/types';
import type {FirstContract} from '../companions/contracts';
import type {ContractServant} from '../companions/servant';
import type {createNarrativePanel} from '../ui/narrativePanel';
import type {Localized,PlacedNpcSocket} from '../settlements/types';
import {createHomeActivities,type HomeActivityHost} from './homeActivities';
import {HOME_CIVIC,HOME_REPORT_REQUIRED} from '../map/homeActivities';

export const HOME_FLAGS={invited:'home_saber_invited',welcome:'home_saber_welcome',meal:'home_saber_first_meal',garden:'home_saber_garden_talk'} as const;
export const homeSaberReady=(done:ReadonlySet<string>)=>done.has('saber_contract')&&done.has(HOME_FLAGS.invited);
export function inviteSaberHome(done:Set<string>):boolean {
 if(!done.has('saber_contract')||done.has(HOME_FLAGS.invited))return false;
 done.add(HOME_FLAGS.invited);return true;
}
export function homeChapterMemories(done:ReadonlySet<string>):Localized{
 const chapters=[['sun_core','圣剑湖与落日王国','Sword Lake and the Sunset Kingdom'],['adventure_harbor_departed','真正离港的船','The ship that truly departed'],['adventure_winter_arrived','抵达的药车','The medicine cart that arrived'],['adventure_kyoto_evidence','京都留下的原始记录','Kyoto’s original record']] as const;
 const present=chapters.filter(([flag])=>done.has(flag));
 return present.length?[`书桌上留下了：${present.map(c=>c[1]).join('、')}。这些经历没有被改写成同一段结局。`, `On your desk: ${present.map(c=>c[2]).join('; ')}. Each journey keeps its own account.`]:['书桌上还是一页空白。等你亲自走过那些地方，再把见闻带回来。','An empty page waits on the desk. Bring back the places you have actually visited.'];
}
const HOME_RESIDENTS:readonly {id:string;role:Localized;p:[number,number,number];line:Localized}[]=[
 {id:'home_steward',role:['公馆照管人 · 林姨','Housekeeper Lin'],p:[-44,16.12,-20],line:['公馆留了八间客房。与你缔约的 Saber 可以在门边入住簿登记；出门同行的人，房间仍替她留着。','Eight guest rooms are ready. Invite your contracted Saber at the guest book. Her room stays hers while she travels with you.']},
 {id:'home_baker',role:['面包师 · 安禾','Baker Anhe'],p:[-125,16.12,70],line:['面包刚出炉。回家沿广场南边走，公馆的公共厨房在北面。','Fresh bread is out. Your home is south of the square; the house kitchen is north.']},
 {id:'home_grocer',role:['杂货店主 · 阿青','Grocer Qing'],p:[-90,16.12,80],line:['门口的风铃一响，就知道有人回来了。下坡的主街通港口。','The windchime tells me someone is home. Follow the main street downhill to the harbour.']},
 {id:'home_barista',role:['咖啡师 · 夏','Barista Xia'],p:[-55,16.12,91],line:['赶路之前，先坐一会儿。南面的步道绕过住宅，还能从海边回到这里。','Sit a while before setting off. The southern path loops past the houses and returns along the coast.']},
 {id:'home_tailor',role:['裁缝 · 苏','Tailor Su'],p:[-6,16.12,44],line:['蓝线缝在里面，衣服翻过去才看得到。旅途涂装仍在操作设置里选择。','The blue stitching is on the inside. Select your unlocked journey finishes in Settings as before.']},
 {id:'home_medic',role:['诊所医生 · 许','Doctor Xu'],p:[-120,16.12,-17],line:['屋里留着床位。脱离危险以后，回自己家的客厅休息，也能慢慢恢复。','There are beds inside. Once you are safe, rest in your living room to recover.']},
 {id:'home_dock_keeper',role:['港口管理员 · 江','Harbour keeper Jiang'],p:[234,6.12,125],line:['栈桥伸向东边的海湾。北面的旧路通黑帆南岸，夜里认小灯塔就能找回家。','The pier reaches east into the bay. The northern road leads toward Black Sail; our little lighthouse marks the way home.']},
 {id:'home_gardener',role:['园丁 · 叶','Gardener Ye'],p:[-104,16.12,110],line:['树要慢慢长，人也一样。你回来几次，院子就多几段故事。','Trees take time. So do people. Each homecoming gives the garden another story.']},
];
export function homeResidentSockets():PlacedNpcSocket[]{return HOME_RESIDENTS.map(s=>({id:s.id,role:[...s.role],position:homeWorld(s.p),yaw:0,region:'alpha',worldRegion:'home',lines:[[...s.line]]}));}

type Host=HomeActivityHost & {scene:THREE.Scene;done:Set<string>;contract:FirstContract;servant:ContractServant;dialogue:ReturnType<typeof createNarrativePanel>;
 save:()=>unknown;changed:()=>void;canInteract:(id:string)=>boolean;safe:()=>boolean;rest:()=>boolean;toast:(line:Localized)=>void;prepareDialogue:()=>void;};
/** Only the residence and optional home scenes write home_* facts; never chapter/contract flags. */
export function createHomeTown(host:Host){
 const root=new THREE.Group();root.name='HomeTownLife';host.scene.add(root);
 const activities=createHomeActivities(host);
 const markers:Marker[]=[...HOME_ACTIONS.map(a=>({id:a.id,type:'interact' as const,label:a.label[0],p:homeWorld(a.p),radius:2.6})),...activities.markers];
 const talk=markers.find(m=>m.id==='home_saber_talk')!;
 let index=0,dwell=22,disposed=false,wasHome=false;
 const start=new THREE.Vector3(...homeWorld(SABER_HOME_WALK[0]));
 const goal=new THREE.Vector3();
 const materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[],textures:THREE.Texture[]=[];
 const box=(name:string,p:number[],size:number[],color:number)=>{const g=new THREE.BoxGeometry(...size as [number,number,number]),m=new THREE.MeshStandardMaterial({color,roughness:.85}),mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.position.set(...p as [number,number,number]);root.add(mesh);geometries.push(g);materials.push(m);return mesh;};
 const luggage=box('SaberHomeLuggage',homeWorld([-50,16.55,-34]),[1.2,.8,.7],0x496f87);
 const blanket=box('SaberHomeBlueThrow',homeWorld([-50,17.13,-35.4]),[1.9,.08,1.5],0x819cae);
 const meal=box('HomeSharedMeal',homeWorld([-24,17.11,-21]),[1.4,.12,.8],0xd4b685);
 const memories=box('HomeTravelKeepsakes',homeWorld([-166,18.05,127]),[.7,.35,.4],0xc9aa71);
 // Legible signs remain independent of loaded map art, and dispose with the session.
 for(const h of HOME_BUILDINGS.filter(h=>h.kind!=='house')){
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)continue;
   ctx.fillStyle='#355463';ctx.fillRect(0,0,512,128);ctx.fillStyle='#f3e5c8';ctx.textAlign='center';ctx.font='34px sans-serif';ctx.fillText(h.name,256,52);ctx.font='23px sans-serif';ctx.fillText(h.nameEn,256,94);
   const texture=new THREE.CanvasTexture(canvas),geometry=new THREE.PlaneGeometry(Math.min(h.w-2,6),1.5),material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});
   const sign=new THREE.Mesh(geometry,material);sign.position.set(h.p[0]+720+Math.sin(h.yaw)*(h.d/2+.48),h.p[1]+3.9,h.p[2]+Math.cos(h.yaw)*(h.d/2+.48));sign.rotation.y=h.yaw;sign.name=`HomeSign_${h.id}`;root.add(sign);textures.push(texture);geometries.push(geometry);materials.push(material);
 }
 const commit=(flag:string)=>{host.done.add(flag);host.save();host.changed();apply();};
 function apply(){activities.apply();const invited=homeSaberReady(host.done);luggage.visible=blanket.visible=invited;meal.visible=invited&&host.done.has(HOME_FLAGS.meal);memories.visible=['sun_core','sea_core','winter_core','fire_core'].some(f=>host.done.has(f));if(!invited){index=0;dwell=22;wasHome=false;host.servant.setResidence(null);talk.p=[0,-10000,0];}}
 function show(line:Localized,name:Localized,choices:readonly {id:string;label:Localized}[],marker:string,choose:(id:string)=>void){
   host.prepareDialogue();host.dialogue.showChoices(line,name,choices,id=>{if(disposed||!host.canInteract(marker)||!host.safe())return;if(id!=='later')choose(id);});
 }
 const later={id:'later',label:['先去走走。','Maybe later.'] as Localized};
 function interact(id:string):boolean{
   if(!markers.some(m=>m.id===id))return false;
   if(!host.canInteract(id))return true;
   if(!host.safe()){host.toast(['先脱离危险，在稳固地面站好再休息或交谈。','Leave danger and stand on safe ground before resting or talking.']);return true;}
   if(activities.interact(id))return true;
   if(id==='home_register'){
     if(!host.done.has('saber_contract')){host.prepareDialogue();host.dialogue.show(['公馆的八间客房已经打扫好。等你与圣剑湖的 Saber 建立契约，可以在这里邀请她入住。','Eight guest rooms are ready. Once you have contracted Saber at Sword Lake, invite her here.'],['入住簿','Guest book']);}
     else if(!homeSaberReady(host.done))show(['这间朝庭院的客房还没有名字。要邀请 Saber 把这里当作旅途中的家吗？','The garden room has no name yet. Invite Saber to make it her home between journeys?'],['入住簿','Guest book'],[{id:'invite',label:['邀请 Saber 入住。','Invite Saber to move in.']},later],id,()=>{if(inviteSaberHome(host.done)){host.save();host.changed();apply();host.prepareDialogue();host.dialogue.show(['你把她的名字写在入住簿上。房里已经放好行李；在公馆收回同行召唤，就能见到她。','You write her name in the guest book. Her luggage is ready; recall her as a companion to meet her at the house.'],['归乡公馆','Homeward House']);}});
     else show(['Saber 的房间在走廊西侧。同行时她会与你出门，收回召唤后会回到公馆休息。','Saber’s room is west of the corridor. She leaves with you while summoned and returns to the house when recalled.'],['入住簿','Guest book'],[{id:host.contract.summoned?'recall':'follow',label:host.contract.summoned?['请 Saber 留在家中休息。','Let Saber rest at home.']:['邀请 Saber 一起出发。','Ask Saber to travel with you.']},later],id,choice=>{if(!homeSaberReady(host.done))return;if(choice==='recall'&&host.contract.summoned)host.contract.toggle();else if(choice==='follow')host.contract.select('saber');apply();host.toast(['同行状态已更新。房间和入住记录会保留。','Companion updated. Her room and residence record are kept.']);});
   }else if(id==='home_saber_talk'){
     if(!homeSaberReady(host.done)||!host.servant.root.visible||host.contract.summoned)return true;
     const first=!host.done.has(HOME_FLAGS.welcome),garden=index>=6&&index<=8;
     const line:Localized=first?['“我原以为，旅途中只需要一个能守住的营地。”她看了看桌上的空杯，“原来这里还为我留了明天的位置。”','“I thought a journey needed only a camp we could defend.” She looks at the empty cup. “You have left a place for tomorrow, too.”']:garden?['“在这里练剑，不必等下一场战斗。”她收住脚步，“你也可以只在这里走一走。”','“Here, practice need not be preparation for the next battle.” She stops. “You may simply take a walk.”']:['“屋里很安静。我会把门前的灯留着。”她把目光转向你，“下一段路，你想好了吗？”','“It is quiet here. I will leave the porch light on.” She turns to you. “Have you chosen the next road?”'];
     show(line,['Saber','Saber'],[{id:'talk',label:first?['欢迎回家。','Welcome home.']:['在这里陪她聊一会儿。','Stay and talk a little.']},{id:'follow',label:['一起出发吧。','Let us set out together.']},later],id,choice=>{if(!homeSaberReady(host.done)||host.contract.summoned)return;if(choice==='talk')commit(first?HOME_FLAGS.welcome:garden?HOME_FLAGS.garden:HOME_FLAGS.welcome);else if(choice==='follow')host.contract.select('saber');});
   }else if(id==='home_meal'){
     if(!homeSaberReady(host.done)||host.contract.companionSummoned){host.toast(['先在入住簿邀请 Saber，再收回当前从者。','Invite Saber at the guest book, then recall your current companion.']);return true;}
     show(['锅里还有热汤。要摆好两个人的碗筷，邀请 Saber 来吃饭吗？','There is still warm soup. Set two places and invite Saber to a meal?'],['公馆厨房','House kitchen'],[{id:'meal',label:['摆好碗筷，一起吃饭。','Set the table and share a meal.']},later],id,()=>{if(!homeSaberReady(host.done)||host.contract.summoned)return;commit(HOME_FLAGS.meal);dwell=0;host.prepareDialogue();host.dialogue.show(['“那我就不客气了。”她接过碗，停了一下，“下次出发前，也留一点时间做这个吧。”','“Then I shall gladly accept.” She takes a bowl. “Before our next journey, let us leave time for this again.”'],['Saber','Saber']);});
   }else if(id==='home_rest')show(['客厅里听得到远处的海风。坐下来休息，等呼吸平稳再出发。','The sea breeze reaches the living room. Sit down and catch your breath before setting out.'],['主角的家','Your home'],[{id:'rest',label:['休息一会儿。','Rest a while.']},later],id,()=>{host.toast(host.rest()?['在家休息，恢复一些生命。可以继续休息；旅途进度保持。','You rest at home and recover some health. Rest again if needed; journey progress is kept.']:['已经休息好了。准备好就再出发吧。','You are rested. Set out whenever you are ready.']);});
   else if(id==='home_letters'){host.prepareDialogue();host.dialogue.show(homeChapterMemories(host.done),['家中的书桌','Your writing desk']);}
   else {host.prepareDialogue();host.dialogue.show(['西边的归乡大道通幻日谷。南面是你的家，北面是归乡公馆；公馆入住簿可邀请已缔约的 Saber。沿主街下坡可到港口，南岸步道绕回花园。','The western road leads to the valley. Your home is south; Homeward House is north. Invite your contracted Saber at its guest book. The main street descends to the harbour; the coast path loops back through the garden.'],['归乡广场','Homeward Square']);}
   return true;
 }
 function update(dt:number,player:THREE.Vector3,active:boolean,ready:boolean){
   if(disposed)return;
   activities.update(dt,player,active&&ready);
   const atHome=homeSaberReady(host.done)&&!host.contract.companionSummoned&&ready&&Math.hypot(player.x-685,player.z+35)<240;
   root.visible=Math.hypot(player.x-720,player.z)<600;
   if(!atHome){host.servant.setResidence(null);talk.p=[0,-10000,0];wasHome=false;return;}
   if(!wasHome){index=0;dwell=22;host.servant.setResidence(start,start);wasHome=true;}
   const current=host.servant.root.position,near=player.distanceTo(current)<3;
   if(active&&!host.dialogue.open&&!near){
     const target=new THREE.Vector3(...homeWorld(SABER_HOME_WALK[index]));
     if(current.distanceTo(target)<.35){dwell-=Math.min(.1,Math.max(0,dt));if(dwell<=0){index=(index+1)%SABER_HOME_WALK.length;dwell=[0,7,11].includes(index)?28:0;}}
   }
   goal.fromArray(homeWorld(SABER_HOME_WALK[index]));host.servant.setResidence(goal,undefined,near||host.dialogue.open||!active);
   talk.p=[current.x,current.y+1,current.z];
 }
 apply();
 const residentLine=(id:string):Localized|null=>{
  if(id==='home_dock_keeper')return host.done.has(HOME_CIVIC.boat)?['船已经在滑台上了。灯塔的手轮就在塔脚西侧，校准以后，外海也认得回家的方向。','The boat is on its slip. The lighthouse wheel is west of the tower; align it so the sea approach leads home.']:['先到石岸东侧的绞盘起船：松开，再按住交互。栈桥尽头可以垂钓，等浮漂沉下再提竿。','Haul the boat with the quay winch: release, then hold Interact. Fish at the pier end; reel in when the float dips.'];
  if(id==='home_gardener')return host.done.has(HOME_CIVIC.garden)?['水从沟槽进了花圃。你看，花已经开了。四件镇务做完，回广场亲自报个平安吧。','Water reached the beds; the flowers are open. When all four jobs are finished, report back at the square.']:['我在园里转转，你来压水泵好吗？水沿沟槽走到花圃，就不用把整条步道浇湿。','I will tend the garden. Could you work the hand pump? The channels take water to the flowers and keep the walk dry.'];
  if(id==='home_steward')return host.done.has(HOME_CIVIC.bread)?['面包已经放进厨房，谢谢你亲手送来。入住簿替 Saber 留着房间；厨房还有热饭。','The bread is in the pantry; thank you for bringing it. The guest book keeps Saber’s room ready, and the kitchen has warm food.']:['面包房替公馆留了一篮面包。请从店里柜台边拿来，厨房收货台在餐厅后侧。','The bakery has a basket for the house. Pick it up beside the counter and bring it to the pantry behind the dining room.'];
  return null;
 };
 return{root,markers,activities,residentLine,apply,interact,update,get civicCount(){return HOME_REPORT_REQUIRED.filter(f=>host.done.has(f)).length;},get routeIndex(){return index;},dispose(){if(disposed)return;disposed=true;activities.dispose();host.servant.setResidence(null);root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
