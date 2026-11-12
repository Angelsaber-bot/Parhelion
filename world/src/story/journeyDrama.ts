import type {Localized,RegionId} from '../settlements/types';
import type {NarrativeChoice} from '../ui/narrativePanel';
import { VALLEY_PROLOGUE } from './valleyPrologue';
import { kingdomWorksEnded } from './kingdomWorks';

/** New scenes augment the shipped rescue journey. They never manufacture combat,
 * transport, contract or resident-work completion. Old saves opt in explicitly. */
export const JOURNEY_DRAMA={started:'journey_drama_v1',opening:'journey_opening',confession:'journey_confession',decision:'journey_watch_',brief:(r:RegionId)=>`journey_${r}_brief`,report:(r:RegionId)=>`journey_${r}_report`} as const;
export const JOURNEY_CAST:Readonly<Record<RegionId,{npc:string;name:Localized;chapter:Localized;desire:Localized}>>={
 alpha:{npc:'alpha_signal_keeper',name:['岚','Lan'],chapter:['序章 · 有人在等回答','Prologue · Someone Is Waiting'],desire:['守住一个会有人回答的频道。','Keep a channel with someone listening.']},
 britain:{npc:'britain_oath_witness',name:['艾妲','Ada'],chapter:['第一章 · 迟到的名字','Chapter I · The Names That Arrived Late'],desire:['让回家的人拥有自己的名字。','Let the returners keep their own names.']},
 blacksail:{npc:'blacksail_lamplighter',name:['玛拉','Mara'],chapter:['第二章 · 最后一班归航','Chapter II · The Last Homeward Voyage'],desire:['在港灯熄灭前，等到一艘真正离港的船。','See one ship truly depart before the harbor light goes out.']},
 winter:{npc:'winter_stretcher_bearer',name:['米哈伊','Mikhail'],chapter:['第三章 · 车轮留下的路','Chapter III · A Road Written by Wheels'],desire:['把药交到病人手里，再谈胜利。','Get medicine to the patients before calling it victory.']},
 kyoto:{npc:'kyoto_paper_keeper',name:['澄','Sumi'],chapter:['第四章 · 纸上没有的那个人','Chapter IV · The Person Missing from the Page'],desire:['保住写得不漂亮、却确实发生过的事。','Save the imperfect account of what actually happened.']},
};
export const JOURNEY_REGIONS=['britain','blacksail','winter','kyoto'] as const;
export const dramaActive=(done:ReadonlySet<string>)=>done.has(JOURNEY_DRAMA.started)&&done.has('adventure_v2');
export const dramaReported=(done:ReadonlySet<string>)=>JOURNEY_REGIONS.filter(r=>done.has(JOURNEY_DRAMA.report(r)));
export const dramaDecision=(done:ReadonlySet<string>)=>done.has(JOURNEY_DRAMA.decision+'open')?'open':done.has(JOURNEY_DRAMA.decision+'watch')?'watch':null;
export function dramaChapterReady(region:RegionId,done:ReadonlySet<string>){
 if(region==='alpha')return done.has('compact_relay_complete');
 if(region==='britain')return done.has('sun_core')&&done.has('kingdom_gate_rescued')&&kingdomWorksEnded(done);
 if(region==='blacksail')return done.has('adventure_harbor_departed');
 if(region==='winter')return done.has('adventure_winter_arrived');
 // Musashi's pact is a post-victory fact in legacy saves; evidence is still a
 // new physical action, and the resident report must still happen in person.
 return done.has('adventure_kyoto_evidence')&&(done.has('fire_core')||done.has('musashi_contract'));
}
export type DramaBeat='opening'|'brief'|'report'|'confession'|'decision'|'revisit';
export interface DramaScene{region:RegionId;beat:DramaBeat;speaker:Localized;text:Localized;choices:readonly NarrativeChoice[];}
const accept:readonly NarrativeChoice[]=[{id:'accept',label:['我会亲自去看。','I will see it for myself.']},{id:'later',label:['先留着，等我回来。','Keep it for me. I will return.']}];
const acknowledge:readonly NarrativeChoice[]=[{id:'accept',label:['把这件事记下来。','Put that in the record.']},{id:'later',label:['我还想再看看现场。','I want another look at the site.']}];
const BRIEF:Record<RegionId,Localized>={
 alpha:['岚把耳机递给你。杂音里，一个声音重复报着同一个坐标。\n“终端说撤离已经完成。可完成的事情，不该还在求救。”她指了指你空着的枪套，“先到工坊领装备。那不是让你替我打一场胜仗——我要你去看看，路的另一头到底还有谁。”\n岚把回执翻了过去，拇指停在落款的位置。‘回来以后，先叫我的名字。’','Lan hands you the headphones. A voice in the static keeps repeating the same coordinates.\n“The terminal says the evacuation is complete. Completed evacuations should not still be calling for help.” She glances at your empty holster. “Get your equipment. I am not asking you to win a war. I need you to see who is still at the other end of the road.”\nShe turns the receipt face down, keeping her thumb over the signature. “When you return, say my name first.”'],
 britain:['艾妲的册子里有一页被反复擦过，纸已经薄得透光。\n“城门外的人被叫作逃兵。可他们只是想带着孩子回家。我的丈夫也在那张征召令上——这次，我不想再用一个名字，把另一个人交出去。”\n她把册子合上：“先带他们穿过门。等他们自己说出名字，我再写。”','One page of Ada’s ledger has been erased until the light shines through it.\n“They call the people outside the gate deserters. They just want to take their children home. My husband was on that muster order too. This time, I will not hand someone over by writing a name.”\nShe closes the ledger. “Bring them through the gate first. I will write when they tell me who they are.”'],
 blacksail:['玛拉没有转身看海。她一直在擦同一块已经很干净的灯罩。\n“我女儿在最后一班撤离船上。每次雾散，船都重新停在原位，货舱满着，船员口粮却一份也没有。”\n“黑胡子说要把提督揍一顿。那很好。但你替我记住：赢了以后，船还得真的开出去。我不想再等一次胜利广播。”','Mara keeps polishing an already clean lantern shutter. She does not look at the sea.\n“My daughter took the last evacuation ship. Each time the fog lifts, it is back at the same berth. Full cargo holds. Not a single crew ration.”\n“Blackbeard wants to punch the Admiral. Good. But remember this after you win: the ship must actually leave. I cannot wait through another victory announcement.”'],
 winter:['米哈伊用指背碰了碰药箱，又把手收回衣袖。\n“撤离记录写我们用了十二分钟。我的同伴叫列夫。他在第十三分钟还活着。”\n他没有请求你报仇，只把车辕扶正：“你可以走快些。我得跟这辆车一起走。到了渡口，还要有人亲手接过去。”','Mikhail touches the medicine chest with the back of his hand, then tucks it into his sleeve.\n“The evacuation record says twelve minutes. My partner was called Lev. He was still alive in minute thirteen.”\nHe asks for no revenge. He straightens the cart’s shaft. “You may move faster. I must go with this cart. And someone must take it from us at the crossing.”'],
 kyoto:['澄展开一张晾干的纸。上面只有半个手印，和一行写错了又改过的地址。\n“大家都说，烧掉旧记录，就能重新开始。我以前也信。直到有人问我：那没回来的人，是不是也能一起划掉？”\n她把纸压在石头下面：“去寺里看看原来的命令。别替它补一句好听的结尾。”','Sumi unfolds a dried sheet: half a handprint and an address crossed out and corrected.\n“People say burning old records lets us begin again. I believed it too. Then someone asked whether we could cross out the people who never came back.”\nShe pins the paper beneath a stone. “Read the original orders at the temple. Do not add a comforting ending for them.”'],
};
const REPORT:Record<RegionId,Localized>={
 alpha:['频道接通了。岚听见四个方向传来的呼叫，没有再按下‘全部完成’。\n“你决定先去哪边。我留在这里。你回来的时候，先叫我的名字。”','The channel opens. Lan hears calls from four directions and does not press All Clear again.\n“You choose which way first. I will stay here. When you return, say my name before anything else.”'],
 britain:['艾妲没有先问你王倒下没有。她走到门边，数了数灯下的人。\n“有人改口说自己是木匠，不是骑士。”她笑了一下，“我把那一栏改了。原来册子也能这样写。”\n她撕下封锁令背面的旧回执：‘接收端已确认全员归营。’落款，是谷地观测所。','Ada does not ask first whether the King has fallen. She counts the people under the gate lamp.\n“One of them corrected me. A carpenter, not a knight.” She smiles. “I changed the entry. Apparently a ledger can be used that way.”\nOn the back of the blockade order is an old receipt: All personnel home, confirmed by receiving station. Signed at the Valley Observatory.'],
 blacksail:['玛拉站在没有船的泊位前，很久没有说话。\n“原来真正离开以后，是看不见的。”她把灯罩留在打开的位置，“她会不会回来，我不知道。但至少，现在可以有一个别的答案。”\n你带回的航次里，出港时间一遍遍变过；‘安全抵达’的签字却始终相同。','Mara stands before the empty berth without speaking.\n“So this is what leaving looks like. Nothing there.” She leaves the lantern shutter open. “I do not know whether she will return. At least another answer is possible now.”\nIn the voyage records, departure times keep changing. The signature under Safe Arrival never does.'],
 winter:['渡口的接收人问米哈伊缺了哪一箱。他说：“先数人。”\n他把列夫的名字写在交接单背面，没有把它混进已送达的药品里。“这次车到了。那次他没有。这两件事，都得算数。”\n原始电文附在单据下面：为保持撤离通道，所有未确认人员按‘已接收’处理。','At the crossing, the receiver asks Mikhail which chest is missing. “Count the people first,” he says.\nHe writes Lev’s name on the back of the handover sheet. “The cart arrived this time. He did not, that time. Both things must count.”\nThe original dispatch is attached beneath it: To keep the evacuation channel open, treat all unconfirmed personnel as received.'],
 kyoto:['澄把寺里的命令板和晾干的纸并排放好。两份记录第一次没有被抄成同一句话。\n“这边写‘无人滞留’。这边写‘请在桥下等我’。”她把石头挪开，让你看完整个地址，“错字也留着吧。有人可能只认得他写错的那一行。”\n你已经知道该回哪一个收讯台了。','Sumi lays the temple order beside the dried letter. For once, they have not been copied into the same sentence.\n“This one says Nobody Remains. This one says Wait under the Bridge.” She moves the stone to reveal the whole address. “Keep the mistake. Someone may recognize only the line he misspelled.”\nYou know which receiving station you must return to.'],
};
export function journeyScene(npc:string,done:ReadonlySet<string>):DramaScene|null{
 if(!dramaActive(done))return null;
 const region=(Object.keys(JOURNEY_CAST) as RegionId[]).find(r=>JOURNEY_CAST[r].npc===npc);if(!region)return null;
 const base={region,speaker:JOURNEY_CAST[region].name};
 if(done.has('adventure_tomorrow')&&dramaDecision(done))return {...base,beat:'revisit',text:journeyRevisit(region,done),choices:[{id:'personal',label:['聊聊你自己的事。','Tell me about yourself.']},{id:'later',label:['我再去走走。','I will keep exploring.']}]};
 if(region==='alpha'){
  if(!done.has(JOURNEY_DRAMA.opening))return {...base,beat:'opening',text:done.has(VALLEY_PROLOGUE.record)
    ? ['岚把你带回的两个人名抄在回执背面。“外联还断着。到工坊北面的服务庭院，把线路接通。等那边的人自己回答，我们再写谁已经到家。”', 'Lan copies both names onto the back of the receipt. “The uplink is still down. Reconnect it in the service yard north of the armory. We’ll write down who’s home when they answer for themselves.”']
    : BRIEF.alpha,choices:accept};
  if(dramaReported(done).length>=2&&!done.has(JOURNEY_DRAMA.confession))return {...base,beat:'confession',text:['岚看完两份回执，把自己的签名盖在掌心下面。\n“是我签的。那天频道只肯接受‘已到达’。我怕通道一关，后面的人就出不来了。我以为，先让系统相信他们到了，再慢慢找。”\n“后来，通道开始反复执行最后一条命令。只要记录说所有人安全，任何求救都会被当成杂音。”\n她松开手：“我不是要你替我原谅这件事。塔里的三个转发器还在复制那张回执。先把真的人带回来，再来关掉它们。”','Lan covers her signature with her palm.\n“I signed it. That day the channel would accept only Arrived. I was afraid closing it would trap everyone behind us. I thought we could tell the system they were safe, then find them.”\n“Instead, the channel kept executing the last order. If the record says everyone is safe, every call for help becomes noise.”\nShe lifts her hand. “I am not asking forgiveness. Three tower transmitters still copy that receipt. Bring the real people home, then shut them down.”'],choices:[{id:'accept',label:['把原始记录留下。我们一起处理。','Keep the original record. We will deal with this together.']},{id:'later',label:['我需要再想想。','I need time to think.']}]};
  if(done.has('adventure_escaped')&&dramaReported(done).length===4&&done.has(JOURNEY_DRAMA.confession)&&!dramaDecision(done))return {...base,beat:'decision',text:['塔不再替所有人回答。岚把值守牌和频率表摆在你面前。\n“这一次，我不能再替所有人签字。你想让这个频道变成什么？”\n开放频道，让每个地区留下自己的原始呼叫；或者保留一盏值守灯，让五地轮班的人亲口确认每一次抵达。两条路都不再用沉默证明安全。','The tower no longer answers for everyone. Lan places the watch roster beside the frequency list.\n“This time, I cannot sign for all of them. What should this channel become?”\nOpen it so each region keeps its own calls, or keep a watch light staffed in turns by all five regions. Neither choice treats silence as proof of safety.'],choices:[{id:'open',label:['开放频道，各地保留自己的声音。','Open the channel. Let each region keep its own voice.']},{id:'watch',label:['保留值守，五地轮班确认抵达。','Keep the watch. Take turns confirming each arrival.']}]};
  return {...base,beat:'revisit',text:dramaReported(done).length?['岚把频率表往你这边推了推：“别只带回终端的答案。告诉我，你见到了谁。”','Lan slides the frequency list toward you. “Bring more than the terminal’s answer. Tell me who you met.”']:REPORT.alpha,choices:[{id:'personal',label:['先聊聊收讯台。','Tell me about your receiver.']},{id:'later',label:['我会再来。','I will return.']}]};
 }
 if(!done.has(JOURNEY_DRAMA.brief(region)))return {...base,beat:'brief',text:BRIEF[region],choices:accept};
 if(dramaChapterReady(region,done)&&!done.has(JOURNEY_DRAMA.report(region)))return {...base,beat:'report',text:REPORT[region],choices:acknowledge};
 return null;
}
/** Revalidate the exact scene at confirmation, not just its NPC or flag. */
export function confirmJourneyScene(scene:DramaScene,choice:string,done:Set<string>):boolean{
 const live=journeyScene(JOURNEY_CAST[scene.region].npc,done);
 if(!live||live.beat!==scene.beat||!live.choices.some(c=>c.id===choice)||choice==='later'||choice==='personal')return false;
 if(scene.beat==='opening')done.add(JOURNEY_DRAMA.opening);
 else if(scene.beat==='brief')done.add(JOURNEY_DRAMA.brief(scene.region));
 else if(scene.beat==='report')done.add(JOURNEY_DRAMA.report(scene.region));
 else if(scene.beat==='confession')done.add(JOURNEY_DRAMA.confession);
 else if(scene.beat==='decision'&&!dramaDecision(done))done.add(JOURNEY_DRAMA.decision+choice);
 else return false;
 return true;
}
export function journeyRevisit(region:RegionId,done:ReadonlySet<string>):Localized{
 const open=dramaDecision(done)==='open';
 const lines:Record<RegionId,Localized>={alpha:open?['岚没有摘下耳机：“今天有四个人报了自己的名字。都不是终端替他们说的。”','Lan keeps the headphones on. “Four people gave their names today. None of them through the terminal.”']:['岚把下一班的值守牌交给你：“今天轮到玛拉。她说，到了就敲两下灯罩。”','Lan passes you the next watch card. “Mara’s turn today. She says to tap the lantern twice when you arrive.”'],britain:['艾妲翻到新的一页：“木匠带着孩子回来了。孩子说，等长大了，要给门做一把只从里面上的锁。”','Ada turns a fresh page. “The carpenter came back with his child. The child wants to build a gate that locks only from the inside.”'],blacksail:open?['玛拉的灯罩旁多了一张航路图。她在空白处写下：去哪里都可以，到了请回信。','A route chart hangs beside Mara’s lantern: Go wherever you wish. Write when you arrive.']:['玛拉在灯罩上试着敲了两下：“声音够远。比‘全员安全’短，也比那句话可靠。”','Mara taps the shutter twice. “Carries far enough. Shorter than All Personnel Safe, and more reliable.”'],winter:['米哈伊把空药箱修成了凳子：“有些东西送到了，就该空下来。坐会儿？”','Mikhail has turned an empty medicine chest into a seat. “Some things should be empty once they arrive. Sit a while?”'],kyoto:['澄在新纸上写了个字，又划掉重写。“这张不用救。”她说，“我只是想写得好一点。”','Sumi writes a character, crosses it out, and tries again. “This page does not need rescuing,” she says. “I just want to write it better.”']};
 return lines[region];
}
export function journeyEnding(done:ReadonlySet<string>):Localized{
 const open=dramaDecision(done)==='open';return [
 `岚撤下那张写着‘全部撤离’的回执。下面露出五份没有合成一句话的记录。\n城门内，艾妲等每个人亲口报上名字；港口留下真正空下来的泊位；米哈伊交出了药箱；澄把写错的地址原样晾好。\n${open?'你开放了频道。五个地区从此保留各自的原始呼叫，任何人都能提出另一个答案。':'你留下了值守灯。五个地区轮班守频，每一次抵达都要等到一个人的回答。'}\n明天仍然可能有人迟到。但从今天起，没有人会因为一张漂亮的回执，被提前算作已经回家。`,
 `Lan takes down the all-clear receipt. Underneath are five accounts that have not been flattened into one sentence.\nAda waits for each returner’s name. An empty berth remains at the harbor. Mikhail hands over the medicine. Sumi dries the mistaken address as it was written.\n${open?'You open the channel. Each region keeps its original calls; anyone may offer another answer.':'You keep the watch light. All five regions take turns; every arrival waits for a person to answer.'}\nTomorrow, someone may still be late. But from today, no polished receipt can count them home before they arrive.`];
}
