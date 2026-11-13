import type { Localized } from '../settlements/types';
import type { StoryEncounterSpec } from './storyEncounters';

export const ORLEANS_CAMPAIGN = {
  started:'orleans_campaign_started', relay:'orleans_campaign_relay', scout:'orleans_campaign_scout',
  ramp:'orleans_campaign_ramp', lookout:'orleans_campaign_lookout', cannon:'orleans_campaign_cannon',
  engineers:'orleans_campaign_engineers', stitch:'orleans_campaign_stitch', swallow:'orleans_campaign_swallow',
  bars:'orleans_campaign_bars', boat:'orleans_campaign_boat', builder:'orleans_campaign_builder',
  archer:'orleans_campaign_archer', test:'orleans_campaign_identity_test', inspect:'orleans_campaign_ambush_inspect',
  flank:'orleans_campaign_flank', retreat:'orleans_campaign_boat_retreat', cover:'orleans_campaign_archer_cover',
  camp:'orleans_campaign_camp', agree:'orleans_campaign_agree', gun:'orleans_campaign_gun',
  screen:'orleans_campaign_screen', planks:'orleans_campaign_planks', moored:'orleans_campaign_moored',
  shifted:'orleans_campaign_shifted', model:'orleans_campaign_model', bridge:'orleans_campaign_bridge',
  ferry:'orleans_campaign_ferry', locked:'orleans_campaign_locked', assembled:'orleans_campaign_assembled',
  trial:'orleans_campaign_trial', complete:'orleans_campaign_complete',
} as const;
const C=ORLEANS_CAMPAIGN;
export type OrleansCampaignAction={id:string;chapter:string;label:Localized;line:Localized;at:[number,number,number];kind?:'fight'|'shot'|'choice';after:readonly string[]};
const a=(id:string,chapter:string,at:[number,number,number],label:Localized,line:Localized,after:readonly string[]=[],kind?:OrleansCampaignAction['kind']):OrleansCampaignAction=>({id,chapter,at,label,line,after,kind});
/** Positions are authored in the unrotated Orleans frame. Scene placement checks ground and capsule clearance. */
export const ORLEANS_CAMPAIGN_ACTIONS:readonly OrleansCampaignAction[]=[
 a(C.started,'O02',[-8,24,-40],['阿莉克斯 · 接过短旗','Alix · Take the pennant'],['阿莉克斯：“你去前面。我把同一条掩护口令接着传。”','Alix: “Go ahead. I will keep passing on the same covering order.”']),
 a(C.relay,'O02',[182,22,-62],['守望窗口 · 指定掩护范围','Watch post · Assign covering sector'],['短旗持续传令。离开窗口也不会取消掩护。','The pennant keeps relaying the order after you leave.'],[C.started]),
 a(C.scout,'O02',[214,24,-122],['外堤观察台 · 击退侦察队','Outer lookout · Repel the scouts'],['射界已清。工兵开始修坡，已完成部分会保留。','The firing lane is clear. Engineers begin the ramp; completed work persists.'],[C.relay],'fight'),
 a(C.lookout,'O02',[226,26,-152],['登观察台 · 确认圣卢方向','Climb the lookout · Survey Saint-Loup'],['观察台已由守望者接班，回城后这里仍会转令。','The watch takes over the lookout and will keep relaying signals.'],[C.ramp]),
 a(C.cannon,'O03',[292,20,64],['撤炮队 · 截住炮车','Gun team · Intercept the cannon'],['撤炮车已停，南岸不会再出现这一门炮。工兵的结果单独保留。','The cannon is stopped. This gun will not appear on the south bank. Engineer safety is recorded separately.'],[C.lookout],'fight'),
 a(C.engineers,'O03',[264,20,-8],['侧翼路口 · 保全工兵','Flank junction · Protect the engineers'],['反击路已清，工兵带着完整工具进入南岸。','The counterattack route is clear; engineers retain their tools.'],[C.lookout],'fight'),
 a(C.stitch,'O04',[178,14,50],['作坊 · 固定旗面补丁','Workshop · Sew the patch'],['阿莉克斯压住布角。贞德拆掉歪针脚：“这一次你来。”','Alix holds the cloth. Jeanne unpicks a crooked stitch: “Your turn.”'],[C.lookout]),
 a(C.swallow,'O04',[178,14,50],['选择燕尾边饰','Choose swallowtail edging'],['燕尾边饰已挂到样架。三队仍分别用剪口、横条与圆孔辨认。','Swallowtail edging is on the rack. Notches, bars and holes still distinguish the three teams.'],[C.stitch],'choice'),
 a(C.bars,'O04',[178,14,50],['选择双条边饰','Choose double-bar edging'],['双条边饰已挂到样架。辨队不依靠颜色。','Double-bar edging is on the rack. Team identity does not rely on color.'],[C.stitch],'choice'),
 a(C.boat,'O04',[174,14,46],['挂燕口旗 · 舟手','Hang notched flag · Boat crew'],['玛戈认出燕口，舟手收到靠岸口令。','Margot recognizes the notch; only the boat crew receives the docking order.'],[C.stitch]),
 a(C.builder,'O04',[178,14,46],['挂横条旗 · 工兵','Hang barred flag · Engineers'],['马丁指向横条：“这是给铺板的人。”','Martin points at the bars: “For the people laying the boards.”'],[C.stitch]),
 a(C.archer,'O04',[182,14,46],['挂圆孔旗 · 弩手','Hang ring flag · Archers'],['弩手留在自己的射位，没有跟着舟手移动。','Archers stay at their firing positions instead of following the boat crew.'],[C.stitch]),
 a(C.test,'O04',[178,14,50],['窗口试令 · 只让舟手移位','Window test · Move only the boat crew'],['舟手换位，工兵与弩手留岗。三种轮廓将在终战继续使用。','The boat crew moves; engineers and archers remain. These shapes carry into the final assault.'],[C.boat,C.builder,C.archer]),
 a(C.inspect,'O05',[62,18,292],['南岸墙院 · 查看反向轮辙','South courtyard · Inspect the wheel tracks'],['轮辙朝院内，屋顶新开了射口。敌人没有走远。','Tracks lead into the courtyard. Fresh firing slits overlook it. The enemy has not gone far.'],[C.test]),
 a(C.flank,'O05',[88,18,301],['外廊 · 切断伏击侧翼','Outer gallery · Break the ambush flank'],['侧翼射口已清。给舟手撤工具的信号，让弩手继续守住另一侧。','The flank is clear. Recall the boat crew with their tools while archers hold the other side.'],[C.inspect],'fight'),
 a(C.retreat,'O05',[62,18,292],['燕口旗 · 舟手撤工具','Notched flag · Recall tools with boat crew'],['舟手转移工具；这不是全军撤退。','Boat crews move their tools. This is not an order for everyone to retreat.'],[C.inspect]),
 a(C.cover,'O05',[62,18,292],['圆孔旗 · 弩手保持掩护','Ring flag · Archers maintain cover'],['弩手守住侧窗，工兵与舟手通过。','Archers hold the side window as engineers and boat crews pass.'],[C.inspect]),
 a(C.camp,'O05',[118,18,305],['前进营地 · 确认人员与工具','Forward camp · Check people and tools'],['贞德：“下一次，先说清楚他们看见什么就动。”','Jeanne: “Next time, agree what each team must see before acting.”'],[C.flank,C.retreat,C.cover]),
 a(C.agree,'O06',[-150,16,299],['共同约定 · 射口、刻线与靠船','Agree · Firing slit, mark and mooring'],['射口封住就铺板；板到刻线就靠船；船停稳就换侧翼。无需再逐队下令。','Lay boards when the slit is blocked; dock at the board mark; shift cover once moored. No further individual orders.'],[C.camp]),
 a(C.gun,'O06',[-185,15,293],['高路 · 解除射口','High route · Clear the firing slit'],['射口解除，工兵按约定开工。','The slit is clear. Engineers start their agreed work.'],[C.agree],'fight'),
 a(C.screen,'O06',[-218,14,279],['低路 · 放下遮射挡板','Low route · Lower the firing screen'],['挡板遮住射线，工兵按约定开工。','The screen blocks the firing lane. Engineers start their agreed work.'],[C.agree],'shot'),
 a(C.model,'O07',[-185,15,293],['工程模型 · 查看最后一套长梁','Engineering model · Inspect the last long beam'],['正桥护墙先恢复车运；河侧浮台先恢复舟运。只有一套长梁，装配前可改选。','Bridge cover restores road traffic first; a river platform restores ferry service first. One beam set; change your choice before assembly.'],[C.shifted]),
 a(C.bridge,'O07',[-185,15,293],['主攻方案 · 正桥推移掩体','Assault plan · Bridge cover'],['长梁预留给正桥护墙；仍可改选，装配后固定。','The beam is reserved for bridge cover. Change plans before assembly.'],[C.model],'choice'),
 a(C.ferry,'O07',[-185,15,293],['主攻方案 · 河侧浮台','Assault plan · River platform'],['长梁预留给河侧浮台；仍可改选，装配后固定。','The beam is reserved for the river platform. Change plans before assembly.'],[C.model],'choice'),
 a(C.locked,'O07',[-185,15,293],['吊架 · 确认并固定长梁','Hoist · Confirm and secure the beam'],['方案已固定。工班开始装配，可以在旁观看。','Plan locked. The crew begins assembly; you can watch from the side.'],[C.model]),
 a(C.trial,'O07',[-5.5,14.2,289],['试行 · 走到工程另一端','Trial · Reach the other end of the works'],['负重试行完成。阿莉克斯随前锋持旗，三队按约定行动。','The loaded crossing is tested. Alix carries the forward flag; all three teams follow the agreement.'],[C.assembled]),
];
export const orleansActionById=new Map(ORLEANS_CAMPAIGN_ACTIONS.map(a=>[a.id,a]));
export function orleansCampaignReady(id:string,d:ReadonlySet<string>){
 const a=orleansActionById.get(id);if(!a||d.has(C.complete)&&id!==C.cannon&&id!==C.engineers)return false;
 if(a.kind!=='choice'&&d.has(id))return false;
 if(!a.after.every(f=>d.has(f)))return false;
 if(id===C.started)return d.has('journey_orleans_muster');
 if([C.swallow,C.bars].includes(id as typeof C.swallow)&&d.has(C.test))return false;
 if([C.bridge,C.ferry].includes(id as typeof C.bridge)&&d.has(C.locked))return false;
 if(id===C.locked&&!d.has(C.bridge)&&!d.has(C.ferry))return false;
 if(id===C.test&&!d.has(C.swallow)&&!d.has(C.bars))return false;
 if(id===C.gun||id===C.screen)return !d.has(C.gun)&&!d.has(C.screen);
 return true;
}
export function orleansCampaignGuide(d:ReadonlySet<string>){
 if(!d.has('journey_orleans_muster')||d.has(C.complete)||d.has('journey_orleans_crossing_open'))return null;
 // Optional, independently obtainable O03 rewards must not force two fights.
 const action=ORLEANS_CAMPAIGN_ACTIONS.find(a=>a.id!==C.cannon&&a.id!==C.engineers
  &&(![C.swallow,C.bars].includes(a.id as typeof C.swallow)||!d.has(C.swallow)&&!d.has(C.bars))
  &&(![C.bridge,C.ferry].includes(a.id as typeof C.bridge)||!d.has(C.bridge)&&!d.has(C.ferry))
  &&orleansCampaignReady(a.id,d)&&!d.has(a.id));
 return action??ORLEANS_CAMPAIGN_ACTIONS.find(a=>a.id===(d.has(C.locked)?C.trial:d.has(C.agree)?C.model:C.lookout))!;
}
export interface OrleansCampaignHooks{
 done:Set<string>;save():boolean;changed():void;toast(line:Localized):void;
 reachable(id:string):boolean;encounter():string|null;start(spec:StoryEncounterSpec):boolean;
 position(id:string):[number,number,number]|undefined;
}
/** No background campaign clock: only local, unpaused simulation can do work.
 * Work has small persistent checkpoints; failure to save rolls back the transaction. */
export function createOrleansCampaign(h:OrleansCampaignHooks){
 let work=0,lastWork='',pending:string|null=null;
 function commit(add:readonly string[],remove:readonly string[]=[]){
  const before=new Set(h.done);remove.forEach(f=>h.done.delete(f));add.forEach(f=>h.done.add(f));
  if(!h.save()){h.done.clear();before.forEach(f=>h.done.add(f));h.toast(['保存失败，操作未提交。','Save failed; the operation was not committed.']);return false;}
  h.changed();return true;
 }
 function finish(id:string){const a=orleansActionById.get(id);if(!a)return false;
  const remove=id===C.swallow?[C.bars]:id===C.bars?[C.swallow]:id===C.bridge?[C.ferry]:id===C.ferry?[C.bridge]:[];
  if(commit(id===C.trial?[id,C.complete]:[id],remove))h.toast(a.line);return true;
 }
 return{
  interact(id:string){
   const a=orleansActionById.get(id);if(!a||!h.reachable(id))return false;
   if(!orleansCampaignReady(id,h.done)){h.toast(['先完成当前章节的现场目标。已做的工作会保留。','Complete the current field objective first. Finished work remains.']);return true;}
   if(a.kind==='fight'){
    const p=h.position(id);if(!p)return true;
    const spec:StoryEncounterSpec={id:`orleans_main_${id.slice(17)}`,anchor:{x:p[0],y:p[1]-.9,z:p[2]},actors:[{role:'musketeer',offset:[-4,6],title:['侧翼弩手','Flank crossbowman']},{role:'lancer',offset:[4,6],title:['前哨卫兵','Outpost guard']}]};
    if(h.start(spec))pending=spec.id;else h.toast(['射位暂时受阻或仍在战斗；换到开阔处后重试。','The firing position is blocked or another fight is active; try again from open ground.']);return true;
   }
   return finish(id);
  },
  hit(id:string){if(id!==C.screen)return false;if(orleansCampaignReady(id,h.done))finish(id);return true;},
  victory(id:string){if(!id.startsWith('orleans_main_'))return false;if(pending!==id)return true;pending=null;const action='orleans_campaign_'+id.slice(13);return finish(action);},
  update(dt:number,playable:boolean,near:boolean){
   if(!playable||!near||!Number.isFinite(dt)||dt<=0)return;
   const d=h.done;
   const job=d.has(C.scout)&&!d.has(C.ramp)?[C.ramp,12]:d.has(C.agree)&&(d.has(C.gun)||d.has(C.screen))&&!d.has(C.planks)?[C.planks,12]:d.has(C.planks)&&!d.has(C.moored)?[C.moored,8]:d.has(C.moored)&&!d.has(C.shifted)?[C.shifted,6]:d.has(C.locked)&&!d.has(C.assembled)?[C.assembled,d.has(C.engineers)?8:12]:null;
   if(!job){work=0;lastWork='';return;}
   const [flag,seconds]=job as [string,number];if(lastWork!==flag){lastWork=flag;work=0;}
   work+=Math.min(dt,.1);if(work<seconds/4)return;work=0;
   let stage=0;while(d.has(`${flag}_${stage+1}`))stage++;
   commit(stage===3?[`${flag}_4`,flag]:[`${flag}_${stage+1}`]);
  },
  progress(flag:string){if(h.done.has(flag))return 1;let n=0;while(h.done.has(`${flag}_${n+1}`))n++;const seconds=flag===C.moored?8:flag===C.shifted?6:flag===C.assembled&&h.done.has(C.engineers)?8:12;return Math.min(1,(n+(lastWork===flag?work/(seconds/4):0))/4);},
  reset(){work=0;lastWork='';pending=null;},
 };
}
