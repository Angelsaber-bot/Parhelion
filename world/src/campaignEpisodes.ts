import type { Localized, RegionId } from './settlements/types';
import { CAMPAIGN_WORK_TASKS } from './campaignWorkTasks';
import { isEraCoreCleared } from './eraStories';

/** Original resident stories for this fan-game; not claims about source canon.
 * The existing main campaign owns every core, contract and world gate. These
 * episodes observe its flags, never create them or make them new prerequisites.
 */
export const CAMPAIGN_REGIONS: readonly RegionId[] = ['alpha', 'britain', 'blacksail', 'winter', 'kyoto'];
export interface CampaignChoice { id: string; label: Localized; }
export interface CampaignEpisodeDefinition {
  region: RegionId; title: Localized; npc: string; speaker: Localized;
  work: string; workLabel: Localized; decision: string; decisionLabel: Localized;
  brief: Localized; working: Localized; worked: Localized; question: Localized;
  choices: readonly (CampaignChoice & { response: Localized; ending: Localized })[];
  /** Existing main-story evidence; an old cleared core also satisfies it. */
  evidence: readonly string[]; core?: string;
  evidenceText: Localized; evidenceTarget: string;
  report: Localized; complete: Localized;
}
const define = (region: RegionId, data: Omit<CampaignEpisodeDefinition, 'region' | 'work' | 'decision'>): CampaignEpisodeDefinition => ({
  region, work: `campaign_${region}_work`, decision: `campaign_${region}_decision`, ...data,
});
export const CAMPAIGN_EPISODES: Readonly<Record<RegionId, CampaignEpisodeDefinition>> = {
  alpha: define('alpha', {
    title: ['主线纪事 · 回声里的人', 'Campaign Chronicle · People in the Static'],
    npc: 'alpha_signal_keeper', speaker: ['守频员 · 岚', 'Lan · Signal Keeper'],
    workLabel: ['校准回声接收机', 'Calibrate the echo receiver'], decisionLabel: ['设定守频方式', 'Set the watch channel'],
    brief: ['别急着把杂音关掉。我在里面听见过一句“有人在吗”。\n观测所的终端能供电，但光有电还不够。帮我把旁边接收机的接地线接好；我们得先学会听，才知道该往哪里走。', 'Do not switch off the static yet. Once, I heard someone ask, “Is anybody there?”\nThe Observatory terminal supplies power, but power is not enough. Ground the receiver beside me. Before choosing a road, we should learn to listen.'],
    working: ['接收机在我旁边。接好地线，再把旋钮转到那条平稳的刻线；别去追最响的杂音。', 'The receiver is beside me. Ground it, then tune to the steady mark. Do not chase the loudest burst of static.'],
    worked: ['你接好地线，把尖锐杂音压低。断断续续的呼吸声留在了耳机里。\n岚把两张值守牌放在发信板上：“现在选吧。让他们先听见我们，还是先替他们守住一个安静的频道？”\n忽然，耳机抢先说出你还没问的话。岚盯住谷地的旧收讯阵：“伪晓回声……那里的记录器还在转。想追这条线索，先把武器带上。”', 'You ground the receiver and quiet the shrill static. A broken breathing sound remains in the headphones.\nLan places two watch cards on the dispatch board. “Choose: let them hear us first, or keep a quiet channel where we can hear them?”\nSuddenly the headphones speak before you ask. Lan watches the Valley’s abandoned array. “False Dawn… its recorder is still turning. Bring your equipment if you follow that lead.”'],
    question: ['两种守频方式都能接通道路，不会关闭任何时层。你希望岚怎样值守？', 'Both watch plans keep the roads connected; neither closes an era. How should Lan keep watch?'],
    choices: [
      { id: 'broadcast', label: ['播送归路：反复报出观测所位置', 'Broadcast a way home: repeat the Observatory location'], response: ['岚抄好坐标：“每一遍都慢一点。走夜路的人，不一定能听清第一遍。”\n发信板开始循环归路讯息。接通两座中继站后，声音才能传得更远。', 'Lan copies the coordinates. “Slowly, every time. Someone walking at night may miss the first transmission.”\nThe board repeats directions home. Both relays must be connected before the voice can travel farther.'], ending: ['录音里多了一声回答：“坐标收到了。”岚没有关麦，只把语速放慢了一点。', 'A reply joins the recording: “Coordinates received.” Lan leaves the microphone on and speaks a little more slowly.'] },
      { id: 'listen', label: ['守住静频：优先记录求援的声音', 'Keep a quiet channel: listen for calls for help'], response: ['岚摘下一侧耳机：“那就少说一点，给他们留空。”\n值守记录摊在接收机旁。接通两座中继站后，微弱的来声才不容易被淹没。', 'Lan lifts one earpiece. “Then we speak less and leave room for them.”\nThe watch log lies beside the receiver. Connect both relays so faint incoming voices are not lost.'], ending: ['岚在新一页写下：“来声清楚，无需重复。”纸上终于不全是失联时间。', 'Lan writes on a fresh page: “Signal clear. No need to repeat.” For once, the log is not only a list of lost connections.'] },
    ], evidence: ['relay_a', 'relay_b'], evidenceText: ['接通原主线的两座中继站，让守频计划真正运作。', 'Connect both main-route relays so the watch plan can work.'], evidenceTarget: 'relay_a',
    report: ['中继信号已经稳定。回到岚身边，听听频道另一端有没有回答。', 'The relay signal is stable. Return to Lan and listen for an answer.'],
    complete: ['耳机还挂在原处。需要安静时就坐一会儿；这次，静默不再意味着没人值守。', 'The headphones hang in their usual place. Sit a while if you need quiet. This time, silence does not mean the watch is empty.'],
  }),
  britain: define('britain', {
    title: ['主线纪事 · 空席不是空名', 'Campaign Chronicle · An Empty Seat Has a Name'],
    npc: 'britain_oath_witness', speaker: ['见誓人 · 艾妲', 'Ada · Oath Witness'],
    workLabel: ['辨认旧誓名册', 'Read the worn oath roll'], decisionLabel: ['安排誓火旁的空席', 'Arrange the seats by the oath fire'],
    brief: ['人们总问，王座空着，誓言还算不算数。我只管记下谁曾坐在这里。\n桌上那册名字被烟熏黑了。把遮住字的灰扫开，不必替任何人许下新的誓言。', 'People ask whether an oath still counts when the throne is empty. I only keep track of who sat here.\nSoot has darkened the roll on this desk. Brush it from the names. You need not swear a new oath for anyone.'],
    working: ['名册在桌上。只清掉浮灰，别刮坏纸；有些字，是剩下的最后一点东西。', 'The roll is on the desk. Brush away the loose soot; do not scrape the paper. For some, those letters are all that remain.'],
    worked: ['灰下没有新的命令，只有一列列名字和空着的签押处。\n艾妲说：“誓火会照着这些空席。是把名字摆出来，还是先给活着回来的人腾地方？”', 'Beneath the soot are no new orders—only names and empty places for signatures.\nAda says, “The oath fire will light these empty seats. Shall we display the names, or make room first for those who return alive?”'],
    question: ['这不是决定谁值得被记住。你只是在安排这处小小的见誓棚；圣剑湖和圆桌的约定不变。', 'This does not decide who deserves remembrance. You are arranging this small witness shelter; the lake pact and Round Table oath remain unchanged.'],
    choices: [
      { id: 'names', label: ['立起名牌：让归来的人找到旧友', 'Display the names: help returners find old friends'], response: ['艾妲把擦净的名牌竖起：“不许人们只记得一位王。”\n去回应圆桌的誓火，再到卡姆兰结束那场空等吧。', 'Ada sets the cleaned nameboard upright. “Let them remember more than one king.”\nAnswer the oath fire at the Round Table, then end the waiting at Camlann.'], ending: ['艾妲在名牌前留下一段空白：“不急着刻你的名字。你还会回来，自己写。”', 'Ada leaves a blank space before the nameboard. “No hurry to carve your name. You will return and write it yourself.”'] },
      { id: 'seats', label: ['摆开长凳：先给归来的人落脚处', 'Set out benches: make room for those returning'], response: ['艾妲把空凳转向火光：“誓言若还有用，就该让人坐得下来。”\n去回应圆桌的誓火，再到卡姆兰结束那场空等吧。', 'Ada turns the benches toward the light. “If an oath still matters, it should let someone sit down.”\nAnswer the oath fire at the Round Table, then end the waiting at Camlann.'], ending: ['艾妲拍了拍给你留的那张凳子：“今天不用立誓。坐下，就算赴约了。”', 'Ada pats the bench she kept for you. “No oath today. Sit down. That will count as keeping your word.”'] },
    ], evidence: ['sun_core'], core: 'sun_core', evidenceText: ['沿原主线回应圆桌誓火，在卡姆兰击败空位之王。', 'Follow the main story: answer the oath fire and defeat the Vacant King at Camlann.'], evidenceTarget: 'sun_core',
    report: ['卡姆兰已经安静。回到艾妲的见誓棚，看一看留下来的空席。', 'Camlann is quiet. Return to Ada’s shelter and see what became of the empty seats.'],
    complete: ['见誓棚没有新命令。名册和座位都还留着；你可以继续走，也可以歇一会儿。', 'There are no new orders at the witness shelter. The roll and seats remain. You may continue, or rest a while.'],
  }),
  blacksail: define('blacksail', {
    title: ['主线纪事 · 灯不能认错', 'Campaign Chronicle · Read the Right Light'],
    npc: 'blacksail_lamplighter', speaker: ['守潮人 · 玛拉', 'Mara · Tide Watcher'],
    workLabel: ['核对无船员货单', 'Compare the crewless cargo manifest'], decisionLabel: ['设置暖灯通航信号', 'Set the warm-light passage signal'],
    brief: ['海上最坏的事，不是没有灯，是把错的灯当成家。\n我不碰那盏冷灯。替我核对桌上的货单：看物资栏，也看船员口粮栏。黑胡子说的空船，得有个凭据。', 'The worst thing at sea is not darkness. It is mistaking the wrong light for home.\nI will not touch that cold lamp. Compare the cargo column with the crew-ration column on my desk. We need evidence for Blackbeard’s crewless boats.'],
    working: ['把货物与口粮两栏对着看。活人运货，总得吃饭。', 'Compare cargo with crew rations. Living sailors need to eat.'],
    worked: ['三个航次都装满了货，口粮栏却一笔也没有。你把矛盾的两栏用线连起。\n玛拉收起货单：“空船归要塞炮管。我们的暖灯，该留给活人。”', 'Three voyages carry full cargoes, yet the ration column is empty. You draw a line between the contradicting entries.\nMara folds the manifest. “Leave the empty boats to the fort cannon. Our warm light is for the living.”'],
    question: ['航道恢复后，先给哪一种返航队列发信号？只是先后，不会永久拒绝另一方。', 'When passage is restored, which returning group should receive the first signal? This sets an order, not a permanent exclusion.'],
    choices: [
      { id: 'families', label: ['先引旅客归港：让等候的人见面', 'Guide passengers first: reunite those waiting'], response: ['玛拉挂起短帆信号：“码头等人的，不该只听见货箱落地。”\n先在要塞炮位切断幽灵艇补给，再让旗舰的冷灯熄灭。暖灯不会替你开炮。', 'Mara raises the short-sail signal. “Those waiting on the quay deserve more than the sound of crates landing.”\nCut the ghost-boat supply from the fort cannon, then extinguish the flagship’s cold lamp. Our warm light cannot fire for you.'], ending: ['玛拉把第一班归港的位置留在客船栏：“后面的货也会进来。只是今天，先报人名。”', 'Mara gives the first return slot to a passenger boat. “The cargo will follow. Today, we call the names first.”'] },
      { id: 'supplies', label: ['先引补给靠岸：备好食水再迎人', 'Guide supplies first: prepare food and water'], response: ['玛拉挂起双结信号：“人回来了，总要有干净的水。”\n先在要塞炮位切断幽灵艇补给，再让旗舰的冷灯熄灭。暖灯不会替你开炮。', 'Mara raises the double-knot signal. “People will need clean water when they return.”\nCut the ghost-boat supply from the fort cannon, then extinguish the flagship’s cold lamp. Our warm light cannot fire for you.'], ending: ['玛拉把第一班归港的位置留给食水船：“等客船靠岸，杯子就不必空着了。”', 'Mara gives the first return slot to a provision boat. “When the passengers land, their cups need not be empty.”'] },
    ], evidence: ['sea_core'], core: 'sea_core', evidenceText: ['操作原主线的要塞炮，切断幽灵补给并击败亡航提督。', 'Use the main-story fort cannon, cut the ghost supply, and defeat the Drowned Admiral.'], evidenceTarget: 'sea_core',
    report: ['冷灯已灭。返回玛拉的暖灯旁，确认第一班归港信号。', 'The cold lamp is out. Return to Mara’s warm light to confirm the first harbor signal.'],
    complete: ['暖灯照的是归港水道，不是宝藏。玛拉记得你选的顺序，也给后来的船留着位置。', 'The warm light marks passage home, not treasure. Mara remembers your order and keeps space for the boats that follow.'],
  }),
  winter: define('winter', {
    title: ['主线纪事 · 最后一副担架', 'Campaign Chronicle · The Last Stretcher'],
    npc: 'winter_stretcher_bearer', speaker: ['担架员 · 米哈伊', 'Mikhail · Stretcher Bearer'],
    workLabel: ['固定担架上的保温层', 'Secure the stretcher insulation'], decisionLabel: ['安排救护队下一站', 'Plan the aid party’s next stop'],
    brief: ['别问我还能走多远。问担架上的人还能冷多久。\n这里有干布和绑带，不用去雪里找。帮我把担架底部漏风的地方裹好，再谈下一段路。', 'Do not ask how far I can walk. Ask how long the person on the stretcher can stay cold.\nThere are dry cloths and straps here; no need to search the snow. Help me insulate the underside before we discuss another march.'],
    working: ['先把布垫在担架底下，再系牢两边。绑带别压住伤口；我们是要抬人，不是捆行李。', 'Put the cloth beneath the stretcher and secure both sides. Keep the strap off the wound. We are carrying a person, not tying down luggage.'],
    worked: ['你把干布垫入担架，扎紧松脱的两端。米哈伊试了试抬杆，没有再漏进一阵冷风。\n“现在能挪动了。烽火一连起来，是先在救护棚安顿，还是接上同行的队伍？”', 'You pad the stretcher and secure its loose ends. Mikhail tests the handles; the cold draft no longer cuts through.\n“We can move now. Once the beacons connect, do we settle at the aid shelter first, or rejoin the traveling party?”'],
    question: ['两条救护安排都等待三座烽火接通。不会消耗你的体温，也不会让另一队伤员失去救助。', 'Both aid plans wait for all three beacons. Neither consumes your warmth or denies help to another patient.'],
    choices: [
      { id: 'shelter', label: ['先在棚内休整：把下一夜守稳', 'Rest at the shelter first: secure the coming night'], response: ['米哈伊把备用毯留在床边：“先把这一夜过好。”\n去接通拿破仑指引的三座烽火；我们不赌一条没有火光的路。', 'Mikhail leaves the spare blanket by the cot. “First, get through this night.”\nConnect the three beacons on Napoleon’s route. We will not gamble on an unlit road.'], ending: ['棚里的铺位已经整理好。米哈伊终于放开抬杆：“今夜，轮到我坐着守了。”', 'The shelter cot is ready. Mikhail finally releases the handles. “Tonight, I can keep watch sitting down.”'] },
      { id: 'convoy', label: ['接上救护队：不让担架单独走', 'Rejoin the aid party: keep the stretcher with others'], response: ['米哈伊在路线牌上画了一个会合点：“一副担架，至少得有两双手。”\n去接通拿破仑指引的三座烽火；我们不赌一条没有火光的路。', 'Mikhail marks a meeting point. “One stretcher needs at least two pairs of hands.”\nConnect the three beacons on Napoleon’s route. We will not gamble on an unlit road.'], ending: ['担架的绑带重新卷好，放在会合标记下。米哈伊说：“下一程，会有人替另一头。”', 'The stretcher straps are rolled beneath the meeting marker. Mikhail says, “On the next stretch, someone will take the other end.”'] },
    ], evidence: ['beacon_1', 'beacon_2', 'beacon_3'], core: 'winter_core', evidenceText: ['沿原主线点燃三座烽火，为救护安排接通暖路。', 'Light all three main-story beacons to connect the aid route.'], evidenceTarget: 'beacon_1',
    report: ['三处烽火已相连。回到米哈伊身边，落实救护安排；红场的主线仍可继续。', 'The three beacons connect. Return to Mikhail to put the aid plan in place; the main story at Red Square remains open.'],
    complete: ['担架仍然能用，绑带也留着。米哈伊提醒你：“别把路通了，当成雪停了。”', 'The stretcher and its straps remain ready. Mikhail reminds you: “An open road does not mean the snow has stopped.”'],
  }),
  kyoto: define('kyoto', {
    title: ['主线纪事 · 火后留一页', 'Campaign Chronicle · A Page Beyond the Fire'],
    npc: 'kyoto_paper_keeper', speaker: ['抄录人 · 澄', 'Sumi · Copyist'],
    workLabel: ['分开浸湿的名册', 'Separate the soaked register pages'], decisionLabel: ['安排避火棚内空间', 'Arrange the fire refuge'],
    brief: ['我抄过地名，也抄过人名。火烧过来时，忽然不知道该先抱哪一本。\n这册旅人名簿已经浸湿了。帮我一页页分开，别去撕那些黏住的角。还来得及留一点东西。', 'I have copied place names and people’s names. When the fire came, I could not decide which book to carry first.\nThis travelers’ register is soaked. Help separate its pages. Do not tear the corners that stick. There is still time to preserve something.'],
    working: ['名簿摊在棚下。沿着未黏住的边慢慢分开，湿纸不能急。', 'The register lies under the shelter. Work slowly from the loose edges. Wet paper cannot be hurried.'],
    worked: ['你把湿页分开，压上平整木片。几行旅人的名字重新能读了。\n澄望了望棚内空地：“再往里腾一点，可以摊开纸；也可以铺下让人歇脚的席子。”', 'You separate the wet pages and hold them flat with wooden strips. Several travelers’ names become readable again.\nSumi looks at the remaining space. “Move things inward and we can spread more paper—or lay mats for people to rest.”'],
    question: ['救下的名册会留下。你只是决定这处避火棚先怎样使用，不会改变武藏的约定或封闭道路。', 'The rescued register will remain. You are deciding how this small refuge is used first; Musashi’s promise and the roads are unchanged.'],
    choices: [
      { id: 'records', label: ['留出晾纸架：让失散的人能查到名字', 'Set up drying racks: preserve names for those searching'], response: ['澄把木架移到透风处：“有人回来问，我总该有一句准话。”\n先射落军阵的桔梗旗，打断包围的号令。纸晾在这里，等一条能回来的路。', 'Sumi moves the racks into the draft. “When someone comes asking, I should have a reliable answer.”\nShoot down the encampment’s bellflower banners and break the encirclement orders. The pages will dry here while we wait for a way back.'], ending: ['晾架上的纸不再滴水。澄在最后一页写下：“来此寻人者，可在棚下等候。”', 'The pages on the racks no longer drip. Sumi adds a final line: “Those seeking someone may wait beneath this shelter.”'] },
      { id: 'refuge', label: ['铺开休息席：让走散的人有地方等', 'Lay out resting mats: give separated travelers a place to wait'], response: ['澄收拢木架，留出两张席的位置：“人坐下来，才说得清自己在找谁。”\n先射落军阵的桔梗旗，打断包围的号令。席子留在这里，等一条能回来的路。', 'Sumi folds the rack to make room for two mats. “People can tell us whom they seek once they sit down.”\nShoot down the encampment’s bellflower banners and break the encirclement orders. The mats will wait here for a way back.'], ending: ['席子旁放好了茶碗，名册仍在伸手可及的地方。澄说：“记住名字，也记得让人坐下。”', 'Teacups stand beside the mats, with the register still within reach. Sumi says, “Remember the names—and remember to offer a seat.”'] },
    ], evidence: ['kikyo_banner_1', 'kikyo_banner_2', 'kikyo_banner_3'], core: 'fire_core', evidenceText: ['沿原主线射落三面桔梗旗，让避火棚不再等在包围号令之下。', 'Shoot down all three main-story bellflower banners so the refuge no longer waits under encirclement orders.'], evidenceTarget: 'kikyo_banner_1',
    report: ['军阵的旗号已断。回到澄的避火棚，看纸页和席子安顿得怎样。', 'The army’s banner signals are broken. Return to Sumi’s refuge to see the pages and resting places.'],
    complete: ['棚下仍能听见翻页的声音。澄不再催你：“去赴桥上的约吧。这里还留着位置。”', 'Pages still turn beneath the shelter. Sumi no longer hurries you. “Keep your promise at the bridge. There is still room here.”'],
  }),
};

export type CampaignEpisodeStage = 'briefing' | 'work' | 'decision' | 'follow-through' | 'report' | 'complete';
export interface CampaignEpisodeState {
  region: RegionId; stage: CampaignEpisodeStage; choice: string | null;
  evidenceReady: boolean; completed: boolean; workDone: boolean; workProgress: 0 | 1 | 2;
  /** Cheap presentation state for the authored workstations. */
  visualStage: 0 | 1 | 2 | 3;
}
export const campaignEpisodeFlags = (region: RegionId) => ({
  met: `campaign_${region}_met`, workFirst: `campaign_${region}_work_step_1`, work: `campaign_${region}_worked`, complete: `campaign_${region}_complete`,
  choice: (id: string) => `campaign_${region}_choice_${id}`,
});
function definition(region: string): CampaignEpisodeDefinition | undefined {
  return CAMPAIGN_REGIONS.includes(region as RegionId) ? CAMPAIGN_EPISODES[region as RegionId] : undefined;
}
function hasEvidence(def: CampaignEpisodeDefinition, done: ReadonlySet<string>): boolean {
  return def.evidence.every(id => done.has(id)) || !!(def.core && isEraCoreCleared(def.core, done));
}
export function getCampaignEpisodeState(region: RegionId, done: ReadonlySet<string>): CampaignEpisodeState {
  const def = CAMPAIGN_EPISODES[region], flags = campaignEpisodeFlags(region);
  // Finite authored choices only. Corrupt/unknown choice flags grant nothing.
  const choice = def.choices.find(item => done.has(flags.choice(item.id)))?.id ?? null;
  const evidenceReady = hasEvidence(def, done), completed = done.has(flags.complete), workDone = done.has(flags.work);
  const stage: CampaignEpisodeStage = completed ? 'complete' : choice ? evidenceReady ? 'report' : 'follow-through'
    : workDone ? 'decision' : done.has(flags.met) ? 'work' : 'briefing';
  return { region, stage, choice, evidenceReady, completed, workDone, workProgress: workDone ? 2 : done.has(flags.workFirst) ? 1 : 0, visualStage: completed ? 3 : choice ? 2 : stage === 'briefing' ? 0 : 1 };
}
export interface CampaignEpisodeGuide { title: Localized; text: Localized; targetId: string; targetKind: 'npc' | 'marker'; }
/** Opt-in pin/journal only. Never silently replaces the actual main-story guide. */
export function getCampaignEpisodeGuide(region: RegionId, done: ReadonlySet<string>): CampaignEpisodeGuide | null {
  const def = CAMPAIGN_EPISODES[region], state = getCampaignEpisodeState(region, done);
  switch (state.stage) {
    case 'briefing': return { title: def.title, text: def.brief, targetId: def.npc, targetKind: 'npc' };
    case 'work': return { title: def.title, text: def.working, targetId: def.work, targetKind: 'marker' };
    case 'decision': return { title: def.title, text: def.question, targetId: def.decision, targetKind: 'marker' };
    case 'follow-through': return { title: def.title, text: def.evidenceText, targetId: def.evidence.find(id => !done.has(id)) ?? def.evidenceTarget, targetKind: 'marker' };
    case 'report': return { title: def.title, text: def.report, targetId: def.npc, targetKind: 'npc' };
    case 'complete': return region === 'alpha' ? getCampaignDispatchGuide(done) : null;
  }
}
export interface CampaignEpisodeInteraction {
  handled: boolean; changed: boolean; dialogue: Localized | null; speaker: Localized | null;
  choices: readonly CampaignChoice[] | null; state: CampaignEpisodeState | null;
}
const unhandled = (): CampaignEpisodeInteraction => ({ handled: false, changed: false, dialogue: null, speaker: null, choices: null, state: null });
function result(def: CampaignEpisodeDefinition, done: ReadonlySet<string>, dialogue: Localized, changed = false, choices: readonly CampaignChoice[] | null = null): CampaignEpisodeInteraction {
  return { handled: true, changed, dialogue, speaker: def.speaker, choices, state: getCampaignEpisodeState(def.region, done) };
}
function combine(a: Localized, b: Localized): Localized { return [`${a[0]}\n${b[0]}`, `${a[1]}\n${b[1]}`]; }
/** Caller checks physical range/LOS BEFORE this function, and saves changed results.
 * Reading an intro or inspecting work is intentional progress. Merely opening,
 * paging or dismissing the choice never writes a decision or a completion.
 */
export function interactCampaignEpisode(id: string, done: Set<string>): CampaignEpisodeInteraction {
  const def = CAMPAIGN_REGIONS.map(region => CAMPAIGN_EPISODES[region]).find(item => item.npc === id || item.work === id || item.decision === id);
  if (!def) return unhandled();
  const flags = campaignEpisodeFlags(def.region), state = getCampaignEpisodeState(def.region, done);
  if (state.completed && def.region === 'alpha') {
    const dispatch = getCampaignDispatchState(done);
    if (dispatch === 'ready') {
      if (id === def.decision) return result(def, done, DISPATCH_QUESTION, false, DISPATCH_CHOICES);
      if (id === def.npc) return result(def, done, DISPATCH_INVITATION);
    }
    if (dispatch === 'recorded' && id === def.decision) return result(def, done, getCampaignDispatchText(done));
  }
  if (state.completed) {
    const choice = def.choices.find(item => item.id === state.choice);
    return result(def, done, choice ? combine(choice.ending, def.complete) : def.complete);
  }
  if (id === def.npc) {
    if (state.stage === 'briefing') { done.add(flags.met); return result(def, done, def.brief, true); }
    if (state.stage === 'report') {
      done.add(flags.complete);
      const choice = def.choices.find(item => item.id === state.choice)!;
      return result(def, done, combine(choice.ending, def.complete), true);
    }
    return result(def, done, getCampaignEpisodeGuide(def.region, done)!.text);
  }
  if (state.stage === 'briefing') return result(def, done, [
    `先与${def.speaker[0]}交谈，弄清这份工作的缘由。`, `Speak with ${def.speaker[1]} first to understand the work.`,
  ]);
  if (id === def.work) {
    if (!state.workDone && !state.choice) {
      const step = CAMPAIGN_WORK_TASKS[def.region][state.workProgress as 0 | 1];
      return result(def, done, step.prompt, false, step.options.map(({ id, label }) => ({ id, label: [...label] })));
    }
    return result(def, done, state.stage === 'decision' ? combine(def.worked, def.question) : getCampaignEpisodeGuide(def.region, done)!.text);
  }
  if (!state.workDone) return result(def, done, def.working);
  if (!state.choice) return result(def, done, def.question, false, def.choices.map(({ id, label }) => ({ id, label: [...label] })));
  const choice = def.choices.find(item => item.id === state.choice)!;
  return result(def, done, combine(choice.response, getCampaignEpisodeGuide(def.region, done)!.text));
}
/** Validate again when a deliberate choice is confirmed. Stale dialogs, reset,
 * replay, unknown region/choice, and a second click cannot write a second branch.
 * Caller also rechecks range/LOS/alive state at confirmation time.
 */
export function chooseCampaignEpisode(region: string, choiceId: string, done: Set<string>): CampaignEpisodeInteraction {
  const def = definition(region);
  if (!def) return unhandled();
  const state = getCampaignEpisodeState(def.region, done);
  if (choiceId.startsWith('dispatch_')) {
    if (def.region !== 'alpha' || getCampaignDispatchState(done) !== 'ready' || !DISPATCH_CHOICES.some(choice => choice.id === choiceId)) {
      return result(def, done, ['这份归路记录尚未待发，或已经归档。', 'The return record is not ready for dispatch, or has already been filed.']);
    }
    done.add(CAMPAIGN_DISPATCH_RECORDED); done.add(choiceId === 'dispatch_share' ? 'campaign_dispatch_shared' : 'campaign_dispatch_private');
    return result(def, done, getCampaignDispatchText(done), true);
  }
  if (choiceId.startsWith('work_')) {
    if (state.stage !== 'work') return result(def, done, ['这项操作当前不可进行。请重新查看工作台。', 'That operation is not available now. Check the workstation again.']);
    const step = CAMPAIGN_WORK_TASKS[def.region][state.workProgress as 0 | 1];
    const action = step.options.find(option => option.id === choiceId);
    if (!action) return result(def, done, ['操作步骤已经改变。请重新查看工作台。', 'The work step has changed. Check the workstation again.']);
    if (!action.correct) return result(def, done, combine(action.feedback, step.prompt), false, step.options.map(({ id, label }) => ({ id, label: [...label] })));
    const flags = campaignEpisodeFlags(def.region);
    done.add(state.workProgress === 0 ? flags.workFirst : flags.work);
    return result(def, done, state.workProgress === 0 ? step.success : combine(step.success, def.worked), true);
  }
  const choice = def.choices.find(item => item.id === choiceId);
  if (!choice || state.stage !== 'decision') return result(def, done, [
    '这次安排已不再等待选择。请重新查看现场。', 'This plan is no longer waiting for a choice. Check the site again.',
  ]);
  done.add(campaignEpisodeFlags(def.region).choice(choice.id));
  return result(def, done, state.evidenceReady ? combine(choice.response, def.report) : choice.response, true);
}
/** Journal entries are derived, never mark a quest read or completed. */
export function getCampaignEpisodeJournal(done: ReadonlySet<string>) {
  return CAMPAIGN_REGIONS.map(region => ({ definition: CAMPAIGN_EPISODES[region], state: getCampaignEpisodeState(region, done), guide: getCampaignEpisodeGuide(region, done) }));
}


export const CAMPAIGN_DISPATCH_RECORDED = 'campaign_dispatch_recorded';
const DISPATCH_INVITATION: Localized = [
  '岚把五张值守记录排在发信板上：“每条路都有人留下了。不是王座、宝箱或战报，是他们想留给后来人的东西。”\n去发信板决定怎样保存这份归路记录吧。不必再打一场仗，也不必重走任何时层。',
  'Lan lays five watch records on the dispatch board. “Someone stayed on every road. Not for a throne, a chest, or a battle report—but for something they wanted to leave for those coming after.”\nDecide how to keep the return record at the dispatch board. No new battle or repeated era journey is required.',
];
const DISPATCH_QUESTION: Localized = [
  '五处现场的安排都已落实。岚问：“把归路经验播给后来的旅人，还是把细节留在生活馆，让想知道的人坐下来慢慢听？”\n两种选择都会保存记录，不会关闭频道或改变任何人的契约。',
  'The plans at all five sites are in place. Lan asks, “Broadcast the way home for later travelers, or keep the details in the residence so those who want to know can sit and listen?”\nEither choice preserves the record. Neither closes the channel or changes a companion’s pact.',
];
const DISPATCH_CHOICES: readonly CampaignChoice[] = [
  { id: 'dispatch_share', label: ['播送归路经验，不播私人名字', 'Broadcast the route lessons, not private names'] },
  { id: 'dispatch_private', label: ['保留在生活馆，留待当面讲述', 'Keep the account in the residence for conversations in person'] },
];
export function getCampaignDispatchState(done: ReadonlySet<string>): 'waiting' | 'ready' | 'recorded' {
  return done.has(CAMPAIGN_DISPATCH_RECORDED) ? 'recorded'
    : CAMPAIGN_REGIONS.every(region => done.has(campaignEpisodeFlags(region).complete)) ? 'ready' : 'waiting';
}
export function getCampaignDispatchGuide(done: ReadonlySet<string>): CampaignEpisodeGuide | null {
  return getCampaignDispatchState(done) === 'ready' ? {
    title: ['归路纪事 · 五盏灯，一条回声', 'Chronicles · Five Lights, One Answer'],
    text: ['五处安排已经落实。回到幻日谷的守频发信板，决定怎样留下归路记录。', 'All five plans are in place. Return to the Valley watch board and decide how to preserve the record of the way home.'],
    targetId: CAMPAIGN_EPISODES.alpha.decision, targetKind: 'marker',
  } : null;
}
/** This closing scene quotes only actual saved choices. It does not claim
 * rescue counts, simulated arrivals or restored cores the player never earned.
 */
export function getCampaignDispatchText(done: ReadonlySet<string>): Localized {
  const lines: Localized[] = [[
    '岚依次读过五张记录。每一张都没有替所有人作答，只写下你与守候者共同做过的安排。',
    'Lan reads the five records in turn. None pretends to answer for everyone. Each records the plan you made with the person keeping watch.',
  ]];
  for (const region of CAMPAIGN_REGIONS) {
    const def = CAMPAIGN_EPISODES[region], state = getCampaignEpisodeState(region, done);
    const choice = def.choices.find(choice => choice.id === state.choice);
    if (state.completed && choice) lines.push([`${def.speaker[0]}：${choice.ending[0]}`, `${def.speaker[1]}: ${choice.ending[1]}`]);
  }
  lines.push(done.has('campaign_dispatch_shared') ? [
    '发信灯亮起。播出去的是路标、保暖与留座的办法，没有私人名字。岚给最后一句留了空隙：“若你听见，路上仍有人等你。”',
    'The transmitting light comes on. The broadcast carries lessons about wayfinding, warmth, and leaving room—not private names. Lan leaves a pause before the final line: “If you can hear this, someone along the road is still waiting for you.”',
  ] : [
    '岚把细节留在生活馆的记录夹里，频道仍然有人值守。“不是每件事都得广播，”岚说，“有些话，值得等人回来再讲。”',
    'Lan keeps the details in the residence record folder; the channel remains staffed. “Not everything needs a broadcast,” Lan says. “Some stories are worth telling when someone comes home.”',
  ]);
  return [lines.map(line => line[0]).join('\n'), lines.map(line => line[1]).join('\n')];
}
