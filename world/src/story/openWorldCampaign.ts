import {gateGuide} from './kingdomGate';
import {kingdomWorksEnded,kingdomWorksNext} from './kingdomWorks';
import {HARBOR_RELIEF as R,harborReliefReady} from './harborRelief';
import {WINTER_WITHDRAWAL as W,winterWithdrawalReady,winterWithdrawalSelected} from './winterWithdrawal';
import {KYOTO_WITNESS as Y,KYOTO_WITNESS_LABELS,kyotoWitnessReady,kyotoWitnessGateReady,kyotoRollStopped,kyotoHoistLowered} from './kyotoWitness';
import {JOURNEY_DRAMA,JOURNEY_CAST,JOURNEY_REGIONS,dramaActive,dramaReported,dramaDecision,dramaChapterReady} from './journeyDrama';
import type { Localized, RegionId } from '../settlements/types';
export type AdventurePoint=[number,number,number];
export const ADVENTURE={
 started:'adventure_v2', online:'compact_relay_complete', harborSide:'adventure_harbor_side', records:'adventure_harbor_records',
 exited:'adventure_harbor_exited', sailing:'adventure_harbor_sailing', departed:'adventure_harbor_departed', road:'adventure_winter_road',
 brace1:'adventure_winter_brace_1',brace2:'adventure_winter_brace_2',convoy:'adventure_winter_convoy',arrived:'adventure_winter_arrived',
 water:'adventure_kyoto_water',evidence:'adventure_kyoto_evidence',
 emitters:['adventure_emitter_1','adventure_emitter_2','adventure_emitter_3'],guardian:'adventure_guardian_cleared',
 takeover:'adventure_tower_takeover',escaped:'adventure_escaped',ending:'adventure_tomorrow',
} as const;
export const adventureActive=(done:ReadonlySet<string>)=>done.has(ADVENTURE.started);
export const adventureTravelOpen=(done:ReadonlySet<string>)=>done.has('summon_circle')||(adventureActive(done)&&done.has(ADVENTURE.online));
export const adventureLegacy=(region:RegionId,done:ReadonlySet<string>)=>!adventureActive(done)&&(done.has({alpha:'tower_console',britain:'sun_core',blacksail:'sea_core',winter:'winter_core',kyoto:'fire_core'}[region])||(region!=='britain'&&region!=='alpha'&&done.has({blacksail:'blackbeard_contract',winter:'napoleon_contract',kyoto:'musashi_contract'}[region])));
export interface AdventureGuide {title:Localized;text:Localized;targetId:string;region:RegionId;targetKind:'marker'|'npc';}
const at=(region:RegionId,title:Localized,text:Localized,targetId:string):AdventureGuide=>({region,title,text,targetId,targetKind:'marker'});
export function harborBridgeReady(done:ReadonlySet<string>){return done.has(ADVENTURE.harborSide)||['blackbeard_meet','fort_cannon','ghost_boat_1','ghost_boat_2','ghost_boat_3'].every(id=>done.has(id))||done.has('sea_core')||done.has('blackbeard_contract');}
/** A restored Winter or its post-victory legacy pact already proves safe passage.
 * Do not require old preparation again or manufacture the missing beacon flags. */
export function winterRouteReady(done:ReadonlySet<string>){return done.has('winter_core')||done.has('napoleon_contract')||done.has('shard_bell')||['beacon_1','beacon_2','beacon_3'].every(id=>done.has(id));}
export function adventureChapterComplete(region:RegionId,done:ReadonlySet<string>){
 if(adventureLegacy(region,done))return true;
 if(region==='britain')return done.has('sun_core')&&kingdomWorksEnded(done)&&(!dramaActive(done)||done.has('kingdom_gate_rescued'));
 if(region==='blacksail')return done.has(ADVENTURE.departed)&&done.has('blackbeard_contract');
 if(region==='winter')return done.has(ADVENTURE.arrived)&&done.has('napoleon_contract');
 if(region==='kyoto')return done.has(ADVENTURE.evidence)&&done.has('musashi_contract');
 return done.has(ADVENTURE.ending);
}
/** Read-only projection. Local progress always wins over the recommended order. */
export function getAdventureGuide(region:RegionId,done:ReadonlySet<string>):AdventureGuide|null {
 if(!adventureActive(done))return null;
 if(dramaActive(done)){
  const person=(r:RegionId,text:Localized):AdventureGuide=>({region:r,title:JOURNEY_CAST[r].chapter,text,targetId:JOURNEY_CAST[r].npc,targetKind:'npc'});
  if(!done.has(JOURNEY_DRAMA.opening))return person('alpha',['到归航讯号亭与岚交谈，听一听仍在求救的声音。','Speak with Lan at the signal kiosk. Someone is still calling for help.']);
  if(region!=='alpha'&&!done.has(JOURNEY_DRAMA.brief(region)))return person(region,['先与当地的守望者交谈，了解这段归路上还在等谁。','Speak with the local keeper and learn who is still waiting on this road.']);
  if(region!=='alpha'&&dramaChapterReady(region,done)&&!done.has(JOURNEY_DRAMA.report(region)))return person(region,['回到守望者身边，亲口告诉他现场发生了什么。','Return to the keeper and tell them what actually happened.']);
  if(region==='britain'&&done.has('sun_core')&&!done.has('kingdom_gate_rescued')){const gate=gateGuide(done);if(gate)return at(region,JOURNEY_CAST.britain.chapter,gate.text,gate.targetId);}
  if(region==='alpha'&&dramaReported(done).length>=2&&!done.has(JOURNEY_DRAMA.confession))return person('alpha',['带着两地的回执回见岚，问清签名的来历。','Bring the receipts to Lan and ask about the signature.']);
  if(region==='alpha'&&done.has('adventure_escaped')&&dramaReported(done).length===4&&!dramaDecision(done))return person('alpha',['与岚决定频道今后的值守方式，再到观测所写下结尾。','Decide the channel’s future with Lan, then record the ending at the Observatory.']);
  if(region==='alpha'&&JOURNEY_REGIONS.every(r=>adventureChapterComplete(r,done))){const missing=JOURNEY_REGIONS.find(r=>!done.has(JOURNEY_DRAMA.report(r)));if(missing)return getAdventureGuide(missing,done);}
 }
 if(region==='alpha'){
  if(done.has(ADVENTURE.ending))return null;
  const title:Localized=['让明天继续','Let Tomorrow Continue'];
  if(!done.has('armory_rack'))return at(region,title,['到工坊领取步枪；求援讯号似乎先于现场发出。','Collect your rifle at the workshop; the distress call seems to precede the event.'],'armory_rack');
  if(!adventureTravelOpen(done))return at(region,title,['在服务庭院完成一次突破并接通外联。正街或维修侧路都能到达控制柜。','Breach the service yard and restore the uplink. Use front cover or the maintenance flank.'],'compact_relay_entry');
  if(!done.has('saber_contract'))return at('britain',title,['最低外联已恢复，四条道路开放。推荐西行，到圣剑湖与 Saber 正式契约；也可先探索其他地区。','The uplink is restored and all four roads are open. Head west to make your pact with Saber, or explore another region first.'],'saber_contract');
  const next=(['britain','blacksail','winter','kyoto'] as const).find(r=>!adventureChapterComplete(r,done));
  if(next){
   return getAdventureGuide(next,done);
  }
  const missing=ADVENTURE.emitters.find(id=>!done.has(id));
  if(missing)return at(region,title,['四区证据揭示了同一套预写命令。回幻日塔外围，逐个切断复制发射器；操作会终止对应的增援。','The four regions reveal the same prewritten orders. Disable each copying emitter around the tower; each shutdown ends its reinforcements.'],missing);
  if(!done.has(ADVENTURE.guardian))return at(region,title,['发射器已停机。在塔前讯号源引出守门者；识别直线突刺与重击，等收势后反击。','Emitters are down. Expose the Warden at the tower signal source; distinguish thrust from heavy sweep and punish recovery.'],'adventure_guardian');
  if(!done.has(ADVENTURE.takeover))return at(region,title,['沿原有登塔路线到顶端，手动接管观测终端；恢复出口照明。','Climb the tower’s existing route and take manual control to restore the exit lights.'],'adventure_tower');
  if(!done.has(ADVENTURE.escaped))return at(region,title,['出口灯已经亮起。沿塔梯返回南侧安全集合点，确认撤离。','Exit lights are on. Descend the tower stairs to the southern assembly point and confirm evacuation.'],'adventure_exit');
  if(!done.has(ADVENTURE.ending))return at(region,title,['回到观测所留下今天的记录。未来第一次没有被预先写好。','Return to the Observatory and record today. For the first time, tomorrow is unwritten.'],'adventure_tomorrow');
  return null;
 }
 if(region==='britain'){
  const title:Localized=['落日王国 · 打开归路','Sunset Kingdom · Open the Way Home'];
  const works=kingdomWorksNext(done);if(works)return at(region,title,works.text,works.id);
  if(done.has('sun_core'))return null;
  if(!done.has('saber_contract'))return at(region,title,['在圣剑湖与 Saber 正式契约。','Make your pact with Saber at Sword Lake.'],'saber_contract');
  const gate=gateGuide(done);if(gate)return at(region,title,gate.text,gate.targetId);
  if(!done.has('hall_brazier_1')){return at(region,title,['归人已经到家。到圆桌大厅点燃第一盏誓火，确认封锁命令的源头。','The residents are home. Light the first Round Table hearth and trace the blockade orders.'],'hall_brazier_1');}
  return at(region,title,['到卡姆兰挑战空位之王，终止仍在征召的命令。','Challenge the Vacant King at Camlann and end the repeated summons.'],'sun_core');
 }
 if(region==='blacksail'){
  const title:Localized=['黑帆尽头 · 最后一次空航','Black Sail · The Last Empty Voyage'];
  if(!done.has('blackbeard_meet')&&!done.has('sea_core')&&!done.has('blackbeard_contract'))return at(region,title,['到酒馆问清无法出港的原因。可以一直带着当前从者。','Ask at the tavern why the ship cannot depart. Keep your chosen companion.'],'blackbeard_meet');
  if(!harborBridgeReady(done)&&done.has('fort_cannon')){const boat=[1,2,3].find(i=>!done.has(`ghost_boat_${i}`));if(boat)return at(region,title,['留在要塞炮位，击沉剩余的幽灵艇以开放登舰通路；不要游向目标。','Stay at the fort cannon and sink the remaining ghost boats to open boarding access; do not swim to the target.'],`ghost_boat_${boat}`);}
  if(!harborBridgeReady(done))return at(region,title,['选择准备：夺取要塞炮位并击沉三艘幽灵艇，或到灯塔石码头松开侧舷索具。两种行动都开放登舰通路。','Prepare either by destroying the three ghost boats from the fort, or releasing the side rigging at the lighthouse jetty. Either opens boarding access.'],'adventure_harbor_rigging');
  if (!harborReliefReady(done)) {
   if (!done.has(R.reserve)) return at(region,title,['到拿骚码头查验第一批急救药，把它们留给轻装救援艇。','Check the emergency medicine at Nassau and reserve it for the relief skiff.'],R.reserve);
   if (!done.has(R.lookout)) return at(region,title,['在港灯前调开海务哨点，替药船找一条离岸通路。','Divert the customs lookout at the harbor light and clear the skiff’s departure.'],R.lookout);
   if (!done.has(R.crossing)) return at(region,title,['抬起支栈缆索，让轻舟可以从两排码头之间穿出去。','Raise the side-pier cable so the skiff can slip between the piers.'],R.crossing);
   return at(region,title,done.has(R.launch) ? ['药船已出发。等幻日谷回执，或沿码头看它过港。','The medicine skiff is underway. Wait for the Valley’s receipt or watch from the pier.'] : ['在外码头放行药船。确认这批药送达后再登旗舰。','Launch the skiff from the outer pier. Confirm delivery before boarding the flagship.'],R.launch);
  }
  if(!done.has(ADVENTURE.records))return at(region,title,['登上旗舰，从两处甲板舱口进入船腹记录室，取回真实航次。开门和撤离仍需你亲自完成。','Board the flagship and recover the true voyage record in the below-deck records room, reached through either hatch. You must still leave the ship yourself.'],'adventure_harbor_records');
  if(!done.has('sea_core')&&!done.has('blackbeard_contract')&&!done.has('adventure_harbor_alarm_disabled')&&!done.has('adventure_harbor_alarm_cleared'))return at(region,title,['取证触发了警报。可在船腹切断警报解除追击，或应对舱口守卫后上甲板挑战提督。','The record triggers an alarm. Disable its breaker in the hold to end pursuit, or defeat the hatch guards before challenging the Admiral.'],'adventure_harbor_alarm');
  if(!done.has('sea_core')&&!done.has('blackbeard_contract'))return at(region,title,['记录与广播不符。到甲板海之核挑战亡航提督，解除强制返航。','The record contradicts the broadcast. Challenge the Admiral at the Sea Core and end the forced return.'],'sea_core');
  if(!done.has(ADVENTURE.exited))return at(region,title,['带着记录离舰，沿栈桥回灯塔石码头；提前开的索具仍可使用。','Leave the flagship with the record and return along the bridges to the lighthouse jetty.'],'adventure_harbor_exit');
  if(done.has(ADVENTURE.sailing)&&!done.has(ADVENTURE.departed))return at(region,title,['商船正在驶离港口。你可以在信号台看它离开，或继续在当地探索；完成出港后才收束航次。','The merchant ship is leaving. Watch from the signal or keep exploring; the voyage resolves after it clears port.'],'adventure_harbor_depart');
  if(!done.has(ADVENTURE.departed))return at(region,title,['到拿骚港的暖灯信号台确认放行，亲眼看商船出港。','Authorize departure at Nassau’s warm-light signal and watch the merchant ship leave.'],'adventure_harbor_depart');
  if(!done.has('blackbeard_contract'))return at(region,title,['商船终于驶离重复的航次。回酒馆与黑胡子正式契约。','The ship finally leaves its repeated voyage. Return to the tavern to make your pact with Blackbeard.'],'blackbeard_contract');
 }
 if(region==='winter'){
  const title:Localized=['永冬之城 · 让药车通过','Winter City · Make Way for the Medicine'];
  if(!done.has('napoleon_meet')&&!done.has('winter_core')&&!done.has('napoleon_contract'))return at(region,title,['在皇帝帐篷确认药车的撤离方向。','Confirm the medicine convoy’s route at the emperor’s tent.'],'napoleon_meet');
  if(!winterRouteReady(done))return at(region,title,['选择准备：点亮三座烽火建立暖路，或登钟楼取得观察记录（钟声碎片）。两条准备路线任选其一。','Prepare either by lighting all three beacons, or climbing the bell tower for its observation record (Bell fragment).'],`beacon_${[1,2,3].find(i=>!done.has(`beacon_${i}`))??1}`);
  if(!done.has(ADVENTURE.road))return at(region,title,['清开大道拒马：射断两处金色支架，或沿侧翼靠近拆闩。完整道路开放后才能放行。','Clear the roadblock: shoot both gold braces, or approach from the flank and release the latch. Open the whole corridor before signaling.'],'adventure_winter_latch');
  if (!winterWithdrawalReady(done)) {
   if (!winterWithdrawalSelected(done)) return at(region,title,['走到岔路，选择保留红堤道路，或把弃置的炮架用于修好磨坊跨峡桥。两条路都通向同一渡口。','At the fork, keep the redoubt road or use the abandoned gun carriage to brace the mill bridge. Both lead to the same crossing.'],W.mill);
   return at(region,title,['在撤离信号站确认所有人退出炮线，再把高地让给空阵。','At the withdrawal signal, confirm everyone is out of the firing lane before abandoning the high ground.'],W.retreat);
  }
  if(!done.has('winter_core')&&!done.has('napoleon_contract'))return at(region,title,['沿清出的道路到红场，解除执冬者的命令。','Follow the cleared road to Red Square and end the Winter Warden’s orders.'],'winter_core');
  if(!done.has(ADVENTURE.convoy))return at(region,title,['回救护棚信号台放行药车。出发、途中与抵达都会留在现场。','Release the medicine cart at the aid-post signal. Departure, transit and arrival remain visible.'],'adventure_winter_convoy');
  if(!done.has(ADVENTURE.arrived))return at(region,title,['药车已经启程。到渡口验收同一辆车抵达；不会因你离开而丢失。','The cart has departed. Confirm its arrival at the crossing; leaving the area does not erase the journey.'],'adventure_winter_arrival');
  if(!done.has('napoleon_contract'))return at(region,title,['药车已到渡口。回皇帝帐篷与拿破仑正式契约。','The cart is at the crossing. Return to the tent to make your pact with Napoleon.'],'napoleon_contract');
 }
 if(region==='kyoto'){
  const title:Localized=['业火京都 · 真假号令','Kyoto · Orders in the Fire'];
  if(!done.has('musashi_meet')&&!done.has('fire_core')&&!done.has('musashi_contract'))return at(region,title,['在三条桥与武藏会面。观察火光与人群逃离方向的矛盾。','Meet Musashi at Sanjō Bridge. Compare the flames with the direction people flee.'],'musashi_meet');
  const banner=[1,2,3].find(i=>!done.has(`kikyo_banner_${i}`));
  if(banner&&!done.has('fire_core')&&!done.has('musashi_contract'))return at(region,title,[`处理第 ${banner} 面桔梗旗。正面可远射；旅籠高地提供侧向观察，水门开启后增加内巷进路。`,`Break banner ${banner}. Fire from range, observe from the inn ledge, or open the water gate for another approach.`],`kikyo_banner_${banner}`);
  if (!kyotoWitnessReady(done)) {
   const next = !done.has(Y.reel) ? Y.reel : !kyotoRollStopped(done) ? Y.stop : !kyotoHoistLowered(done) ? Y.winch : !done.has(Y.testimony) ? Y.testimony : Y.public;
   return at(region,title,KYOTO_WITNESS_LABELS[next],next);
  }
  if(!done.has('fire_core')&&!done.has('musashi_contract'))return at(region,title,['三旗号令已断。可走正门，或打开东侧水门进寺，挑战业火之主。','Banner orders are broken. Take the main entrance or open the eastern water gate, then challenge the Hellfire Lord.'],'fire_core');
  if (!kyotoWitnessGateReady(done)) return at(region,title,KYOTO_WITNESS_LABELS[Y.gate],Y.gate);
  if(!done.has(ADVENTURE.evidence))return at(region,title,['在本能寺核对焦黑的命令板。相同命令覆盖了不同的结果，这份证据指向谷地观测所。','Read the charred orders at Honnō-ji. Identical commands overwrite different outcomes; this evidence points to the Valley Observatory.'],'adventure_kyoto_evidence');
  if(!done.has('musashi_contract'))return at(region,title,['回三条桥与武藏正式契约。你可以继续带着原来的从者。','Return to the bridge and make your pact with Musashi. You may keep your original companion.'],'musashi_contract');
 }
 return null;
}

export function getAdventureEndingText():Localized{return ['你把最后一条覆盖命令从终端里撤下。屏幕没有再抢先写出答案。\n王城的封锁命令已经停止，商船驶离港口，药车停在渡口，京都保住了没有被火改写的记录。岚把电台留在有人值守的频道上。\n这次，观测所只写下今天。明天的那一页，留给真正走到那里的人。你仍然可以回访这些地方，与喜欢的从者继续同行。','You remove the last overriding command. This time, the screen does not answer before the question.\nThe kingdom’s blockade orders have ended, the merchant ship has left port, the medicine cart waits at the crossing, and Kyoto’s unaltered record survives. Lan keeps the radio on a channel with a person listening.\nThe Observatory records only today. Tomorrow’s page belongs to those who reach it. You may revisit these places and keep traveling with the companion you chose.'];}

/** Single default selection for HUD and waypoint; an earned chapter never falls back to obsolete Valley chores. */
export function getCurrentAdventureGuide(region:RegionId,done:ReadonlySet<string>){const guide=getAdventureGuide(region,done)??getAdventureGuide('alpha',done);return guide&&dramaActive(done)?{...guide,title:guide.region==='alpha'&&done.has(JOURNEY_DRAMA.opening)?(dramaReported(done).length===4?['终章 · 让明天继续','Finale · Let Tomorrow Continue'] as Localized:['幻日谷 · 回执上的签名','Valley · The Signature on the Receipt'] as Localized):JOURNEY_CAST[guide.region].chapter}:guide;}
