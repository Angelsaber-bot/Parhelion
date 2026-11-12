import type { Localized } from '../settlements/types';
import type { WorldRegionId } from '../core/regionIdentity';
import { JOURNEY } from './worldJourney';
import { ADVENTURE } from './openWorldCampaign';
import { VALLEY_PROLOGUE } from './valleyPrologue';

export const ROYAL_BOAT = {
  shed: 'field_boat_shed', haul: 'field_boat_haul', brace: 'field_boat_brace',
  launch: 'field_boat_launch', watch: 'field_boat_watch',
} as const;
export const HARBOR_WAGES = {
  bench: 'field_wages_bench', divert: 'field_wages_divert', chest: 'field_wages_chest', return: 'field_wages_return',
} as const;
export const ICE_BELL = {
  hear: 'field_ice_bell_hear', rope: 'field_ice_bell_rope', pin: 'field_ice_bell_pin',
  raise: 'field_ice_bell_raise', choose: 'field_ice_bell_choose', camp: 'field_ice_bell_camp', test: 'field_ice_bell_test',
} as const;
export const KYOTO_REFLECTION = {
  shore: 'field_reflection_shore', upper: 'field_reflection_upper', inspect: 'field_reflection_inspect',
} as const;
export const VALLEY_RADIO = {
  desk: 'field_radio_desk', repeater: 'field_radio_repeater', return: 'field_radio_return', listen: 'field_radio_listen',
} as const;
export const EGYPT_SEEDS = {
  yard: 'field_egypt_seed_yard', cart: 'field_egypt_seed_cart', rack: 'field_egypt_seed_rack',
} as const;
export const ORLEANS_SOUP = {
  pot: 'field_orleans_soup_pot', gate: 'field_orleans_soup_gate', share: 'field_orleans_soup_share', bowl: 'field_orleans_soup_bowl',
} as const;
export const QIN_QUIET_ROOM = {
  alcove: 'field_qin_quiet_alcove', door: 'field_qin_quiet_door', sketch: 'field_qin_quiet_sketch', supplies: 'field_qin_quiet_supplies',
} as const;
export const SKY_MAINTENANCE = {
  log: 'field_sky_log', playback: 'field_sky_playback', conduit: 'field_sky_conduit',
  repair: 'field_sky_repair', medicine: 'field_sky_medicine', lookout: 'field_sky_lookout',
} as const;

type Flags = ReadonlySet<string>;
type Step = { id: string; label: Localized; hint: Localized; line: Localized; after?: (done: Flags) => boolean };
type SideStory = { id: string; region: WorldRegionId; title: Localized; steps: readonly Step[]; available: (done: Flags) => boolean };
const B = ROYAL_BOAT, W = HARBOR_WAGES, I = ICE_BELL, K = KYOTO_REFLECTION, V = VALLEY_RADIO, S = SKY_MAINTENANCE;
const E = EGYPT_SEEDS, O = ORLEANS_SOUP, Q = QIN_QUIET_ROOM;
const ropeLoose = (done: Flags) => done.has(I.rope) || done.has(I.pin);
export const harborCustomsGone = (done: Flags) => done.has('sea_core') || done.has(ADVENTURE.departed);

export const FIELD_SIDE_STORIES: readonly SideStory[] = [
  {
    id: 'the-royal-boat', region: 'britain', title: ['王室旧木舟', 'The Old Royal Boat'],
    available: done => done.has('saber_meet') || done.has('saber_contract') || done.has('sun_core'),
    steps: [
      { id: B.shed, label: ['旧渡棚 · 看看不能下水的木舟', 'Old ferry shelter · Inspect the boat'],
        hint: ['沿剑湖东岸找到歪斜的渡棚，看看父女俩怎样修船。', 'Follow the east bank of Sword Lake to the old shelter and watch the two boatbuilders.'],
        line: ['奥伦把一块补板钉上去。伊芙说：“别松手。”船底的烙印一亮，补板又退出来，钉子完完整整落在地上。',
          'Oren nails a patch over the split. “Don’t let go,” says Eve. The mark in the hull lights up, the patch springs out, and the nails land whole on the floor.'] },
      { id: B.haul, label: ['滑轨手轮 · 把木舟拖出誓印范围', 'Slipway crank · Haul the boat beyond the oath'],
        hint: ['把船沿滑轨拖到船棚外的白线。', 'Crank the boat along the slipway past the chalk line.'],
        line: ['船越过白线。烙印暗下来，伊芙把刚才落地的钉子一颗颗捡回去。', 'The boat crosses the chalk line. The mark goes dark. Eve picks up the fallen nails one by one.'],
        after: done => !done.has('sun_core') },
      { id: B.brace, label: ['船底裂缝 · 固定补板', 'Split in the hull · Fasten the patch'],
        hint: ['在船边固定补板，钉紧两端。', 'Hold the patch against the hull and fasten both ends.'],
        line: ['这次补板留住了。父女俩拿好两支桨，只等你松开岸上的系缆。', 'The patch holds this time. Both boatbuilders take an oar and wait for you to cast off.'],
        after: done => done.has(B.haul) || done.has('sun_core') },
      { id: B.launch, label: ['湖岸系缆 · 放船试航', 'Lake mooring · Cast off for the trial'],
        hint: ['去木桩边解开系缆，等父女俩在近岸试一圈。', 'Untie the mooring and let the two boatbuilders take a short trial along the bank.'],
        line: ['伊芙让父亲掌桨，自己数经过的木桩。岸边的观景栈台已经搭好，往那边走可以看见试航的路线。',
          'Eve lets her father row while she counts the posts. The shore viewing deck is open, with a clear view of their trial run.'],
        after: done => done.has(B.brace) },
    ],
  },
  {
    id: 'dock-wages', region: 'blacksail', title: ['无人替你收的工钱', 'The Wages They Kept'],
    available: done => done.has('blackbeard_meet') || harborCustomsGone(done),
    steps: [
      { id: W.bench, label: ['造船棚 · 查看扣押工具', 'Shipyard · Inspect the seized tools'],
        hint: ['到半成品船旁，看看工作台上刻着海务编号的工具。', 'Check the tools with customs numbers beside the unfinished hull.'],
        line: ['米拉：六把锤子有六个主人，海务却给它们刻了同一个号。你可以沿废索道拉响卸货铃，引开岗哨。等军官退走，再直接进库也行。',
          'Mira: Six hammers, six owners, one customs number. Take the old rigging path and ring the unloading bell to draw off the guard. Or wait until the officers leave.'] },
      { id: W.divert, label: ['废索道 · 拉卸货铃', 'Old rigging · Ring the unloading bell'],
        hint: ['顺着断缆走到索道边，拉响卸货铃。', 'Follow the loose hawser and ring the old unloading bell.'],
        line: ['铃响后岗哨转向空栈桥。趁这条路空出来，打开欠薪库。', 'The guard turns toward the empty pier. The approach to the wage store is clear.'],
        after: done => !harborCustomsGone(done) && !done.has(W.chest) },
      { id: W.chest, label: ['欠薪库 · 取回薪箱和工具', 'Wage store · Recover the pay chest and tools'],
        hint: ['打开欠薪库，把账本、薪箱和工具一起取走。', 'Open the wage store and recover the ledger, chest, and tools.'],
        line: ['账本里有黑胡子签的旧欠条。把箱子送回船棚，让工人自己按名字分钱。', 'The ledger holds an old note signed by Blackbeard. Bring the chest back so the workers can pay out each share by name.'],
        after: done => harborCustomsGone(done) || done.has(W.divert) },
      { id: W.return, label: ['修船棚 · 和米拉结清工钱', 'Shipyard · Settle the wages with Mira'],
        hint: ['带账本回修船棚。', 'Take the ledger back to the shipyard.'],
        line: ['黑胡子先把自己的欠款投进钱箱。米拉把工具交给学徒，吩咐两个人去放下废索道旁的折梯。',
          'Blackbeard drops his own debt into the chest first. Mira hands the tools to the apprentice and sends two workers to lower the folding stairs.'],
        after: done => done.has(W.chest) },
    ],
  },
  {
    id: 'ice-bell', region: 'winter', title: ['冰下的铃', 'The Bell Beneath the Ice'],
    available: done => done.has('napoleon_meet') || done.has('winter_core'),
    steps: [
      { id: I.hear, label: ['峡口 · 定位冰下铃声', 'Gorge mouth · Locate the bell under the ice'],
        hint: ['在别列津纳河进入峡谷处找一段被冻住的缆绳。', 'Look for the frozen hawser where the Berezina enters the gorge.'],
        line: ['缆绳从高处勒住一条翻覆的小渡船。先在坡肩割开旧索，再去浅水旁操作吊索。', 'A hawser above holds an overturned ferry fast. Cut it on the bank, then work the hoist by the shallows.'] },
      { id: I.rope, label: ['上岸缆桩 · 解开旧索', 'Upper bank bollard · Release the old line'],
        hint: ['到上岸缆桩解索。也可从近处射断缆桩上的扣销。', 'Release the bollard by hand, or shoot its clevis from nearby.'],
        line: ['旧索松开了。渡船稳在浅水边，下面的吊索可以用了。', 'The old line comes loose. The ferry settles beside the shallows, within reach of the hoist.'],
        after: done => !ropeLoose(done) },
      { id: I.raise, label: ['浅滩吊索 · 拉起渡口铃', 'Shallows hoist · Raise the ferry bell'],
        hint: ['沿缆绳下坡，从岸上拉起铜铃。', 'Follow the line downhill and raise the bronze bell from the bank.'],
        line: ['铃口刻着第一次撤离时的渡口标志。玛拉认出了它，问你要把它挂回这里，还是带去新营地。', 'The bell bears the mark of the first evacuation landing. Mara recognizes it and asks whether it should ring here or at the new camp.'],
        after: ropeLoose },
      { id: I.choose, label: ['渡口铃 · 选择悬挂地点', 'Ferry bell · Choose where it hangs'],
        hint: ['在吊索旁决定铃的去向。', 'Decide where to mount the bell at the hoist.'],
        line: ['把铃留给走雪路的人，或带去渡口，让两边的人都知道何时集合？', 'Keep the bell for travelers on the snow road, or take it to the landing so both sides can hear the muster?'],
        after: done => done.has(I.raise) },
    ],
  },
  {
    id: 'false-reflection', region: 'kyoto', title: ['金阁的错误倒影', 'Kinkaku’s False Reflection'],
    available: done => done.has('musashi_meet') || done.has('fire_core'),
    steps: [
      { id: K.shore, label: ['镜池岸 · 对照传令旗', 'Mirror Pond · Compare the dispatch flag'],
        hint: ['在金阁池南岸观察水边那面深蓝旗。', 'Read the indigo flag from the south side of Kinkaku’s pond.'],
        line: ['从水边只能看见蓝色旗面，倒映的一角却是红的。绕上对面坡台，看同一根旗竿。', 'The bank shows an indigo face, but one corner in the water is red. Go up to the opposite platform and look at the same pole.'] },
      { id: K.upper, label: ['高处观察台 · 看见旗背', 'High platform · Observe the reverse flag'],
        hint: ['沿石灯与踏板登上观察台，回望传令旗。', 'Follow the stone lanterns and steps to view the pole from above.'],
        line: ['另一面是绯红。它和蓝面被缝在同一架上，给不同来路的人看不同的军令。旗座后面有维修栈道的闩。',
          'The other face is crimson. The two colors are sewn to the same frame to show different orders to different approaches. The maintenance walkway latch is behind the pole.'] },
      { id: K.inspect, label: ['双面旗架 · 打开维修栈道', 'Two-faced standard · Open the maintenance walk'],
        hint: ['从坡台靠近双面旗架，放下旁边的跨沟踏板。', 'Approach the flag frame from the high side and lower the maintenance deck.'],
        line: ['踏板落下，能直接回到池边。武藏：换个角度，旗还在原处，看到的可就不一样了。', 'The deck drops, opening a direct route to the bank. Musashi: Change your angle. The flag stays put, but what you see changes.'],
        after: done => done.has(K.upper) },
    ],
  },
  {
    id: 'tomorrow-broadcast', region: 'alpha', title: ['明天的节目', 'Tomorrow’s Broadcast'],
    available: done => done.has(VALLEY_PROLOGUE.record) || done.has(JOURNEY.compare),
    steps: [
      { id: V.desk, label: ['生活馆 · 接阿舟的试播单', 'Residence · Take Azhou’s test sheet'],
        hint: ['到生活馆侧窗找阿舟的短程电台。', 'Find Azhou’s short-range radio at the side window of the residence.'],
        line: ['阿舟：不借塔上的转发器。你拿试播单去坡顶天线，转到两个指针同时稳定的方向。', 'Azhou: Leave the tower repeater out of it. Take this sheet to the hill aerial and turn it until both needles settle.'] },
      { id: V.repeater, label: ['坡顶天线 · 核对回传波形', 'Hill aerial · Match the return signal'],
        hint: ['按蓝色线槽走到坡顶，核对三条不同的信号。', 'Follow the blue conduit to the hill and compare the three signals.'],
        line: ['台里写着：校准时要让发出与返回的短脉冲重合。你要把天线停在哪一格？', 'The test sheet says the outgoing and returning short pulses should line up. Which bearing will you leave the aerial on?'] },
      { id: V.return, label: ['生活馆 · 听第一段试播', 'Residence · Hear the first broadcast'],
        hint: ['回阿舟的电台听完整一段播报。', 'Return to Azhou’s radio and listen to the first complete broadcast.'],
        line: ['阿舟：今天先播回望桥换班时间。明早说天气，再请面包师讲炉子烧多热。收音机开着，你路过还能听。',
          'Azhou: Today we’ll give the bridge shift times. Tomorrow we’ll do the weather and let the baker tell people how hot the oven should be. Stop by anytime and listen.'] },
    ],
  },
  {
    id: 'seed-jars', region: 'egypt', title: ['巷尾的种子罐', 'Seed Jars at the End of the Lane'],
    available: done => done.has(JOURNEY.egyptRead),
    steps: [
      { id: E.yard, label: ['巷尾 · 帮娜赫护住种罐', 'End of the lane · Help Nah protect the seed jars'],
        hint: ['沿绿洲窄巷找到系着蓝麻绳的密封种罐。', 'Look down the oasis lane for sealed jars tied with blue cord.'],
        line: ['娜赫：“这些是退水以后才能种的种子。先把车上的销拔掉，旧绞盘能把它们送上高架。”',
          'Nah: “These seeds go in after the flood recedes. Pull the cart pin. The old winch can take them to the high rack.”'] },
      { id: E.cart, label: ['拉索绞盘 · 送种罐上高架', 'Cable winch · Haul the seed jars to the rack'],
        hint: ['操作旁边的绞盘，让种罐沿短轨升到高处。', 'Use the winch to move the jars along the short rail to high ground.'],
        line: ['绞盘已经咬紧，种罐正沿短轨向上。到高架边收货，别让车倒退。', 'The winch catches. The jars are moving uphill. Meet the cart at the rack and secure it.'] },
      { id: E.rack, label: ['高架 · 扣好止轮木楔', 'High rack · Chock the cart'],
        hint: ['等车停稳，再在高架旁放下木楔。', 'Wait for the cart to settle, then chock its wheels at the rack.'],
        line: ['娜赫把第一只罐挪到干燥处。“等水落下去，我们先试种一床。坏一床还有下一罐。”',
          'Nah moves the first jar to a dry spot. “When the water drops, we’ll plant one test bed. If it fails, we have another jar.”'] },
    ],
  },
  {
    id: 'unsent-fish-soup', region: 'orleans', title: ['没送出的鱼汤', 'The Soup That Never Made It'],
    available: done => done.has(JOURNEY.orleansRead),
    steps: [
      { id: O.pot, label: ['作坊门口 · 看还热着的鱼汤', 'Workshop door · Check the still-warm soup'],
        hint: ['到集市东北的作坊边，找放在窗下的汤锅。', 'Look for the pot under a window at the northeast edge of the market.'],
        line: ['露西说隔壁给了她木炭，汤本该一人一半。封路后，两家隔着路障只能喊话。门闩在这边。', 'Lucie says the neighbors shared their charcoal. The soup was meant for both houses. They can only call across the barricade now. The latch is on this side.'] },
      { id: O.gate, label: ['作坊侧门 · 抬起门闩', 'Workshop side gate · Lift the latch'],
        hint: ['去木栅边抬起门闩，打通短巷。', 'Lift the latch at the timber gate to open the lane.'],
        line: ['门开了，蒸气从窗下飘进短巷。对面的人把两只碗搁上桌。', 'The gate opens and steam drifts into the lane. A neighbor sets two bowls on the table.'] },
      { id: O.share, label: ['邻里饭桌 · 一起分汤', 'Shared table · Serve the soup'],
        hint: ['走过侧门，去邻居的长凳边。', 'Go through the side gate to the neighbors’ bench.'],
        line: ['他们给你留了一碗。约好每天换一个人添炭，让作坊两扇门都能开着。', 'They save you a bowl. The two houses agree to take turns tending the fire so both workshop doors can stay open.'] },
    ],
  },
  {
    id: 'room-without-an-echo', region: 'qin', title: ['无回声的小室', 'The Room Without an Echo'],
    available: done => done.has(JOURNEY.qinRead),
    steps: [
      { id: Q.alcove, label: ['铸造层 · 查安静的凹室', 'Foundry level · Inspect the quiet recess'],
        hint: ['到地宫铸造层的东墙边，留意军阵回响突然消失的位置。', 'Along the foundry’s eastern wall, look for the recess where the ranks fall silent.'],
        line: ['隔音毡还挂在石缝上，边缘有常年被手推开的磨痕。往旁边摸到一枚铜闩。', 'Felt still covers the joints. Its worn edge shows where hands pushed it aside for years. A bronze latch lies just beside it.'] },
      { id: Q.door, label: ['铜闩 · 打开工匠的门', 'Bronze latch · Open the workers’ door'],
        hint: ['在凹室侧墙扳开铜闩，沿短道走进去。', 'Lift the latch in the recess and follow the short passage inside.'],
        line: ['门后的灯还亮着，照在墙上一座用炭笔画的小房子上。', 'A lamp still burns beyond the door. It lights a small house drawn in charcoal on the wall.'] },
      { id: Q.sketch, label: ['炭画 · 辨认门楣上的记号', 'Charcoal drawing · Read the marks over the door'],
        hint: ['沿短道查看室内的炭画和工匠留下的补给。', 'Follow the short passage to the drawing and the workers’ cache.'],
        line: ['门楣上画着几段不同的身高线。有人刻下“明年再量”。旁边的补给也留给了之后会回来的人。', 'Several height marks run up the drawn doorway. Someone wrote, “Measure again next year.” The supplies beside it were also left for someone coming back.'] },
    ],
  },
  {
    id: 'sky-duty-record', region: 'alpha', title: ['观测冠 · 交不出的班', 'Sky Crown · The Shift Never Handed Over'],
    available: done => done.has(JOURNEY.skyReview),
    steps: [
      { id: S.log, label: ['观测厅侧间 · 核对旧值班表', 'Hall alcove · Read the old duty roster'],
        hint: ['到观测厅边上仍亮着暖灯的小间，找没有签完的值班表。', 'Look for the unfinished roster in the warm-lit alcove off the observation hall.'],
        line: ['最后一列没人签收。带着表上的录音编号去背侧维护架，接通没有经过中央改写的本地回放。', 'Nobody signed the last column. Take the recording number to the rear service rack and switch on its local playback.'] },
      { id: S.playback, label: ['背侧维护架 · 回放最初救援', 'Rear service rack · Play the original rescue'],
        hint: ['在值班室背侧接通本地回放。', 'Connect the local playback behind the duty room.'],
        line: ['录音里，赫利昂让工作人员先报还没接到的人。他听着最后一个名字，回答：“我这一班先不走。”',
          'On the recording, Helion asks the crew to name the people still waiting. He listens to the last name and answers, “I’m staying on duty.”'] },
    ],
  },
  {
    id: 'sky-life-line', region: 'alpha', title: ['观测冠 · 生活管线', 'Sky Crown · The Life Line'],
    available: done => done.has(JOURNEY.skyReview),
    steps: [
      { id: S.conduit, label: ['维护层 · 追踪双环导线', 'Service level · Trace the double-ring conduit'],
        hint: ['在背光维护层找两枚亮度较低的指示环。', 'Look for two dim rings on the shaded maintenance level.'],
        line: ['两端都有电，只有中间一段接触松了。沿标记绕到断点，把生活管线接牢。', 'Both ends have power. One connection in the middle is loose. Follow the markings and reconnect the life line.'] },
      { id: S.repair, label: ['维护管线 · 锁紧断点', 'Life line · Secure the loose contact'],
        hint: ['沿双环导线找到松脱的触点。', 'Follow the double rings to the loose contact.'],
        line: ['维护灯稳了。晴空庭的医疗柜重新通电，备有一次补给。', 'The maintenance lights stabilize. The Clear Sky Court medical cabinet is back online with one reserve treatment.'] },
    ],
  },
  {
    id: 'sky-lookout', region: 'alpha', title: ['观测冠 · 回一盏灯', 'Sky Crown · A Light in Reply'],
    available: done => done.has(JOURNEY.skyReturnSight),
    steps: [
      { id: S.lookout, label: ['下望平台 · 向旧工坊回灯', 'Lookout · Signal the old workshop'],
        hint: ['从日背回廊走到面向幻日谷的护栏边。', 'Walk from the rear gallery to the railing facing Parhelion Valley.'],
        line: ['你闪了两下，谷地工坊的灯闪回来两下。许青：“收到。地上的人看见你了。”', 'You flash twice. The Valley workshop answers with two flashes. Xu Qing: “Received. We can see you from down here.”'] },
    ],
  },
];
export const FIELD_SIDE_STEPS = new Map(FIELD_SIDE_STORIES.flatMap(story => story.steps.map(step => [step.id, step] as const)));
export function fieldSideNext(story: SideStory, done: Flags) {
  if (!story.available(done) || done.has(story.steps.at(-1)!.id)) return null;
  return story.steps.find(step => !done.has(step.id) && (step.after?.(done) ?? true)) ?? null;
}
export function fieldSideReady(id: string, done: Flags) {
  if (id === B.watch) return done.has(B.launch);
  if (id === V.listen) return done.has(V.return);
  if (id === I.test) return done.has(I.choose);
  if (id === O.bowl) return done.has(O.share) && !done.has(O.bowl);
  if (id === Q.supplies) return done.has(Q.sketch) && !done.has(Q.supplies);
  if (id === S.medicine) return done.has(S.repair) && !done.has(S.medicine);
  if (id === I.pin) return fieldSideReady(I.rope, done);
  return FIELD_SIDE_STORIES.some(story => fieldSideNext(story, done)?.id === id);
}
export const FIELD_SERVICE_LABELS = new Map<string, Localized>([
  [B.watch, ['剑湖观景栈台 · 看木舟试航', 'Sword Lake viewing deck · Watch the trial launch']],
  [V.listen, ['生活馆电台 · 听居民播报', 'Residence radio · Listen to the residents']],
  [I.test, ['渡口铃 · 试响', 'Ferry bell · Ring it']],
  [O.bowl, ['邻里饭桌 · 喝一碗热汤', 'Shared table · Eat a bowl of soup']],
  [Q.supplies, ['小室补给柜 · 取备用弹药', 'Quiet room cache · Take the spare ammunition']],
  [S.medicine, ['晴空庭医疗柜 · 使用备用补给', 'Clear Sky Court cabinet · Use the reserve']],
]);
