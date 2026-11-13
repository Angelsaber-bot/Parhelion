import { selectedEgyptWaterPlan } from './egyptWaterPlan';
import type { Localized } from '../settlements/types';

export const EGYPT_CAMPAIGN={
 started:'egypt_campaign_started',limb:'egypt_campaign_limb',temple:'egypt_campaign_temple',bed:'egypt_campaign_bed',
 relocated:'egypt_campaign_relocated',trial:'egypt_campaign_trial',side:'egypt_campaign_side',armor:'egypt_campaign_armor',
 steady:'egypt_campaign_steady',forebay:'egypt_campaign_forebay',bypass:'egypt_campaign_bypass',brake:'egypt_campaign_brake',
 bell:'egypt_campaign_bell',ready:'egypt_campaign_ready',drained:'egypt_campaign_drained',moored:'egypt_campaign_moored',
 irrigation:'egypt_campaign_irrigation',meal:'egypt_campaign_meal',complete:'egypt_campaign_complete',
} as const;
const E=EGYPT_CAMPAIGN;
export type EgyptChapterAction={id:string;chapter:string;label:Localized;line:Localized;local:[number,number,number];after:readonly string[];kind?:'fight'|'shot'};
const a=(id:string,chapter:string,local:[number,number,number],label:Localized,line:Localized,after:readonly string[]=[],kind?:EgyptChapterAction['kind']):EgyptChapterAction=>({id,chapter,local,label,line,after,kind});
export const EGYPT_CHAPTER_ACTIONS:readonly EgyptChapterAction[]=[
 a(E.started,'E03',[-55,16,27],['检修道 · 追查倒流','Maintenance path · Trace the reversed flow'],['梅芮指出低处水痕：“从下面看，才知道水从哪里来。”','Meri points down: “Read the low watermarks to find its source.”']),
 a(E.limb,'E03',[-29,10,47],['干床 · 击退吞潮肢体','Dry bed · Drive back the Tide-Eater limb'],['离开异常水源的甲壳不能重生。定流节点和普通侧闸都能创造这个窗口。','Armor cannot regrow away from the anomalous water. Both flow control and side gates create that opening.'],[E.started],'fight'),
 a(E.temple,'E04',[20,24,-158],['神庙背面 · 清除石甲群','Temple rear · Clear the armored creatures'],['石甲退去，柱廊背后的古河床显露。','The creatures withdraw, exposing the ancient riverbed behind the colonnade.'],[E.limb],'fight'),
 a(E.bed,'E04',[20,24,-171],['检修门 · 查看古河床与巨像切缝','Service door · Inspect the old bed and statue seams'],['奥斯曼迪斯：“先证明新河床承得住水，再谈这座像。”','Ozymandias: “Prove the new bed can carry the water before discussing the statue.”'],[E.temple]),
 a(E.relocated,'E05',[-151,14,145],['工程台 · 安排船匠与居民迁移','Engineering table · Relocate work and residents'],['船匠带走工具，居民转到高岸。改变工程方案会调整工作地点，不重做通用准备。','The boatwright takes his tools; residents move to high ground. Changing plans relocates their work without repeating preparation.'],[E.bed]),
 a(E.trial,'E06',[-23,16.2,139],['试洪柄 · 放入小股试流水','Trial gate · Admit a small test flow'],['吞潮堵住出口。改侧闸、击破干床裂甲或定住回流，任一解法均可继续。','The Tide-Eater blocks the outlet. Divert a side gate, break its dry armor, or arrest the backflow. Any solution works.'],[E.relocated]),
 a(E.side,'E06',[-23,16.2,152],['侧闸 · 引导吞潮转向','Side gate · Turn the Tide-Eater'],['侧流改变方向，出口重新出水。','The side current turns the creature; the outlet flows again.'],[E.trial]),
 a(E.armor,'E06',[23,16.2,150],['干床裂甲 · 击断堵口甲片','Dry armor · Break the blocking plate'],['裂甲失去支撑，试流水穿过出口。','The cracked plate gives way and the test flow passes through.'],[E.trial],'shot'),
 a(E.steady,'E06',[23,16.2,174],['定流节点 · 阻止回流结壳','Flow node · Prevent renewed armor'],['回流停住，出口不再被新甲封住。','The reverse flow stops; no fresh armor seals the outlet.'],[E.trial]),
 a(E.forebay,'E06',[-23,16.2,164],['前池隔离栅 · 小水量联锁试验','Forebay grille · Test the interlock'],['隔离栅与分水柄联锁正常；中央门仍关闭。','The grille and diversion handle interlock correctly. The central gate remains closed.'],[E.trial]),
 a(E.bypass,'E06',[51,12.5,192],['高岸旁路 · 验证无人消能池','High-bank bypass · Test the empty stilling basin'],['少量水进入无人池，随后汇入下游。天空存水仍由王承住。','A small flow enters the empty basin and joins downstream. The king still holds the sky water.'],[E.forebay]),
 a(E.brake,'E06',[-23,16.2,169],['巨像牵索 · 解除制动扣','Statue cable · Release the brake'],['制动解除。两块石翼只在最终安全条件满足后落槽，中央门保持独立。','The brake is released. The wings will settle only under safe final conditions; the center gate remains independent.'],[E.bypass],'shot'),
 a(E.bell,'E06',[-10,16.2,184],['撤离警铃 · 确认高岸人员','Evacuation bell · Confirm the high-bank muster'],['高岸已点齐人员。回工程台确认最终方案，再前往汇水台。','Everyone is on the high bank. Confirm the final plan at the works before approaching the confluence.'],[E.brake]),
 a(E.drained,'E08',[51,12.5,192],['安全旁路 · 分批排放天空存水','Safety bypass · Drain the sky in stages'],['旁路进入自动安全档。可以沿新河回城，不必守着水尺等待。','The bypass enters automatic safe operation. Return along the new river without waiting at the gauge.'],['realm_egypt_phase_3',E.bypass]),
 a(E.moored,'E08',[-158,14,158],['第一场夜潮 · 系稳第一艘船','First night tide · Moor the first boat'],['哈鲁在新的工位接住缆绳，梅芮在水尺上刻下新日期。','Haru catches the line at his new work station; Meri marks a new date on the gauge.'],[E.drained]),
 a(E.irrigation,'E08',[16,8,238],['第一场夜潮 · 打开第一道支渠','First night tide · Open the first field channel'],['新水进入田垄。船匠已经把工作台搬到岸边。','Fresh water reaches the field. The boatwright has moved his bench to the bank.'],[E.drained]),
 a(E.meal,'E08',[-151,14,145],['高岸晚饭 · 让搬迁的人坐下','High-bank supper · Sit with the relocated residents'],['娜赫摆好饭。王看着石凳：“坐稳些，此石本就该承得起余之臣民。”','Nakht serves supper. The king eyes the stone seat: “Sit well. This stone should bear my people.”'],[E.drained]),
];
export const egyptChapterById=new Map(EGYPT_CHAPTER_ACTIONS.map(a=>[a.id,a]));
export const egyptTrialSolved=(d:ReadonlySet<string>)=>[E.side,E.armor,E.steady].some(f=>d.has(f));
export function egyptChapterReady(id:string,d:ReadonlySet<string>){
 const a=egyptChapterById.get(id);if(!a||d.has(id)||!a.after.every(f=>d.has(f)))return false;
 if(id===E.started)return d.has('journey_egypt_weir')&&!d.has('journey_egypt_water_returned');
 if(id===E.relocated)return !!selectedEgyptWaterPlan(d);
 if([E.side,E.armor,E.steady].includes(id as typeof E.side))return !egyptTrialSolved(d);
 if(id===E.forebay)return egyptTrialSolved(d);
 if(id===E.meal)return d.has(E.moored)||d.has(E.irrigation);
 if(id===E.moored)return !selectedEgyptWaterPlan(d)?.startsWith('east');
 if(id===E.irrigation)return !!selectedEgyptWaterPlan(d)?.startsWith('east');
 return true;
}
export const egyptChapterGuide=(d:ReadonlySet<string>)=>d.has(E.complete)||d.has('journey_egypt_water_returned')?null:EGYPT_CHAPTER_ACTIONS.find(a=>egyptChapterReady(a.id,d))??null;
export function commitEgyptChapter(id:string,d:Set<string>){
 if(!egyptChapterReady(id,d))return false;d.add(id);
 if(id===E.bell)d.add(E.ready);
 if(id===E.meal)d.add(E.complete);
 return true;
}
