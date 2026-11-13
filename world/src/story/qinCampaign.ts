import type { Localized } from '../settlements/types';
export const QIN_CAMPAIGN={restore:'qin_campaign_restore',started:'qin_campaign_started',guard:'qin_campaign_guard',take:'qin_campaign_take',locked:'qin_campaign_locked',observe:'qin_campaign_observe',halt:'qin_campaign_halt',loan:'qin_campaign_loan',road:'qin_campaign_road',arrived:'qin_campaign_arrived',returned:'qin_campaign_returned',complete:'qin_campaign_complete',backup:'parhelion.world.qin.predeparture.v1'} as const;
const Q=QIN_CAMPAIGN;
export const qinTallyBorrowed=(d:ReadonlySet<string>)=>d.has(Q.loan)&&!d.has(Q.returned);
export type QinChapterAction={id:string;chapter:string;local:[number,number,number];label:Localized;line:Localized;after:readonly string[];kind?:'shot';choice?:boolean};
const a=(id:string,chapter:string,local:[number,number,number],label:Localized,line:Localized,after:readonly string[]=[],choice=false):QinChapterAction=>({id,chapter,local,label,line,after,choice});
export const QIN_CHAPTER_ACTIONS:readonly QinChapterAction[]=[
 a(Q.restore,'Q06',[118,46,-108],['恢复出发前存档','Restore preparation save'],['将撤销出发后的世界进度并重新载入。','This replaces world progress since departure and reloads the game.'],[Q.locked]),
 a(Q.started,'Q05',[118,46,-108],['工坊出口 · 查看两队用途','Foundry exit · Inspect the two crews'],['载梁队负责运输。唯一的载盾队可以留守工坊，也可以随行；两种都能让人离开。','The beam crew transports. The sole shield crew can guard the foundry or accompany you. Both plans get everyone out.']),
 a(Q.guard,'Q05',[118,46,-108],['留盾 · 保留工坊与炉火','Leave shields · Keep the workshop working'],['盾队留在工坊入口，工匠继续修理。前路没有移动盾墙，但有工坊补给。','The shield crew guards the entrance. Artisans keep working. No traveling shield wall, but workshop supplies remain.'],[Q.started],true),
 a(Q.take,'Q05',[118,46,-108],['带盾 · 工匠撤到安全廊','Take shields · Evacuate to the safe gallery'],['盾队随载梁队走。工匠提前离开，窑火熄灭，半成品留在原处。','Shields travel with the beam crew. Workers evacuate first; the kiln cools and unfinished pieces remain.'],[Q.started],true),
 a(Q.locked,'Q06',[118,46,-108],['按此编组出发 · 保存出发前进度','Depart with this formation · Save preparation'],['编组固定，普通死亡与读档保留此选择。要改方案，可恢复明确的出发前存档。','Formation locked. Death and reload retain it. Restore the explicit predeparture save to change the plan.'],[Q.started]),
 a(Q.observe,'Q06',[-37,28,-115],['军道侧槽 · 观察交错队列','Garrison side aisle · Observe crossing ranks'],['葬仪向内，你们向外。先让载梁队驻在安全点，再越过下一道军路。','The procession moves inward; your crew moves outward. Halt the beam crew safely before crossing the next road.'],[Q.locked]),
 a(Q.halt,'Q06',[-17,28,-156],['安全落位 · 驻定载梁队','Safe berth · Halt the beam crew'],['载梁队驻定。蔺禾在发令范围内，接下来的前路由你去开。','The beam crew is halted. Lin He stays within command range while you open the way ahead.'],[Q.observe]),
 a(Q.loan,'Q06',[-17,28,-156],['暂交工符 · 蔺禾持符','Lend the tally · Lin He holds authority'],['蔺禾接过同一枚工符。她按约定运梁，你暂时不能命令这支编组。','Lin He takes the same tally. She moves the beam as agreed; you cannot order this crew while she holds it.'],[Q.halt]),
 {...a(Q.road,'Q06',[32,10,-190],['前路止回扣 · 打开接应通道','Forward latch · Open the receiving passage'],['前路已通，蔺禾继续把队伍送向安全点。','The receiving route is open. Lin He continues moving the crew to safety.'],[Q.loan]),kind:'shot'},
 a(Q.returned,'Q06',[32,10,-190],['当面接回工符','Receive the tally in person'],['蔺禾先让队伍驻定，再把工符交回。临时借符结束，独立授权仍要在校令台登记。','Lin He halts the crew, then returns the tally. Temporary delegation ends; independent authority still requires registration at the command court.'],[Q.road,Q.arrived]),
];
export const qinChapterById=new Map(QIN_CHAPTER_ACTIONS.map(a=>[a.id,a]));
export function qinChapterReady(id:string,d:ReadonlySet<string>){const a=qinChapterById.get(id);if(!a||!a.choice&&d.has(id)||!a.after.every(f=>d.has(f)))return false;
 if(id===Q.started)return d.has('journey_qin_workers')&&!d.has('journey_qin_public_order');
 if(a.choice)return !d.has(Q.locked);
 if(id===Q.locked)return d.has(Q.guard)||d.has(Q.take);
 return true;
}
export function commitQinChapter(id:string,d:Set<string>){if(!qinChapterReady(id,d))return false;if(id===Q.guard)d.delete(Q.take);if(id===Q.take)d.delete(Q.guard);d.add(id);if(id===Q.returned)d.add(Q.complete);return true;}
export const qinChapterGuide=(d:ReadonlySet<string>)=>d.has(Q.complete)||d.has('journey_qin_public_order')?null:QIN_CHAPTER_ACTIONS.find(a=>a.id!==Q.restore&&(!a.choice||!d.has(Q.guard)&&!d.has(Q.take))&&!d.has(a.id)&&qinChapterReady(a.id,d))??(qinTallyBorrowed(d)?QIN_CHAPTER_ACTIONS.at(-1)!:null);
/** Five durable segments, 45 seconds total. Pause and leaving the local domain stop movement. */
export function createQinCrewTransit(done:Set<string>,save:()=>boolean,changed:()=>void){let seconds=0;return{
 update(dt:number,active:boolean){if(!active||!qinTallyBorrowed(done)||!done.has(Q.road)||done.has(Q.arrived)||!Number.isFinite(dt)||dt<=0)return;seconds+=Math.min(dt,.1);if(seconds<9)return;seconds=0;let n=0;while(done.has(`${Q.arrived}_${n+1}`))n++;const flag=`${Q.arrived}_${n+1}`;done.add(flag);if(n===4)done.add(Q.arrived);if(!save()){done.delete(flag);if(n===4)done.delete(Q.arrived);}changed();},
 progress(){if(done.has(Q.arrived))return 1;let n=0;while(done.has(`${Q.arrived}_${n+1}`))n++;return Math.min(1,(n+seconds/9)/5);},
 reset(){seconds=0;},
};}
