import type { Localized } from '../settlements/types';
import type { WorldRegionId } from '../core/regionIdentity';
import { JOURNEY } from './worldJourney';
import { ADVENTURE } from './openWorldCampaign';
import { VALLEY_PROLOGUE } from './valleyPrologue';
import { HARBOR_WORKBOAT } from './harborRelief';

export const ROYAL_BOAT = {
  shed: 'field_boat_shed', haul: 'field_boat_haul', brace: 'field_boat_brace',
  launch: 'field_boat_launch', watch: 'field_boat_watch',
  board: 'field_boat_board_east', returnFerry: 'field_boat_board_west', crossed: 'field_boat_crossed',
} as const;
export const HARBOR_WAGES = {
  bench: 'field_wages_bench', divert: 'field_wages_divert', chest: 'field_wages_chest', return: 'field_wages_return',
} as const;
export const HARBOR_KEEPSAKES = {
  sight: 'field_wreck_sight', forward: 'field_wreck_forward', aft: 'field_wreck_aft',
  chest: 'field_wreck_chest', choose: 'field_wreck_choose',
  family: 'field_wreck_family', memorial: 'field_wreck_memorial', lookout: 'field_wreck_lookout',
} as const;
export const CAPTAINS_CHAIR = {
  talk: 'field_captain_chair_talk', throw: 'field_captain_chair_throw', win: 'field_captain_chair_win',
  repair: 'field_captain_chair_repair', rematch: 'field_captain_chair_rematch',
} as const;
export const ICE_BELL = {
  hear: 'field_ice_bell_hear', rope: 'field_ice_bell_rope', pin: 'field_ice_bell_pin',
  raise: 'field_ice_bell_raise', choose: 'field_ice_bell_choose', camp: 'field_ice_bell_camp', test: 'field_ice_bell_test',
} as const;
export const WINTER_BREAD = {
  box: 'field_winter_bread_box', house: 'field_winter_bread_house', plan: 'field_winter_bread_plan',
  chimney: 'field_winter_bread_chimney', leave: 'field_winter_bread_leave', report: 'field_winter_bread_report',
} as const;
export const WINTER_SHOES = {
  line: 'field_winter_shoes_line', cellar: 'field_winter_shoes_cellar', choose: 'field_winter_shoes_choose',
  sign: 'field_winter_shoes_sign', crossing: 'field_winter_shoes_crossing',
} as const;
export const WINTER_RANGE = {
  meet: 'field_winter_range_meet', crest: 'field_winter_range_crest', valley: 'field_winter_range_valley',
  bend: 'field_winter_range_bend', choose: 'field_winter_range_choose', smoke: 'field_winter_range_smoke',
  rails: 'field_winter_range_rails', smokeUsed: 'field_winter_range_smoke_used', trigger: 'field_winter_range_signal',
} as const;
export const KYOTO_REFLECTION = {
  shore: 'field_reflection_shore', upper: 'field_reflection_upper', inspect: 'field_reflection_inspect',
} as const;
export const KYOTO_PASS = {
  register: 'field_kyoto_pass_register', choice: 'field_kyoto_pass_choice', sealed: 'field_kyoto_pass_sealed',
  family: 'field_kyoto_pass_family', return: 'field_kyoto_pass_return',
} as const;
export const KYOTO_PAPERLINE = {
  shop: 'field_kyoto_line_shop', rooftop: 'field_kyoto_line_rooftop', counterweight: 'field_kyoto_line_counterweight',
  courier: 'field_kyoto_line_courier',
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
const P = KYOTO_PASS, L = KYOTO_PAPERLINE, H = HARBOR_WORKBOAT;
const D = HARBOR_KEEPSAKES, C = CAPTAINS_CHAIR;
const F = WINTER_BREAD, SH = WINTER_SHOES, WR = WINTER_RANGE;
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
    id: 'nassau-workboat', region: 'blacksail', title: ['一次没有炮声的劫船', 'A Boarding Without Cannon Fire'],
    available: done => done.has('blackbeard_meet') || harborCustomsGone(done),
    steps: [
      { id: H.inspect, label: ['低潮水尺 · 查看埃利的工作船', 'Tide gauge · Survey Eli’s workboat'],
        hint: ['从拿骚内港的潮尺看清扣船人、空船旗和断开的后舷梯。', 'From the inner-harbor tide gauge, look for the conscripts, an empty boat’s flag and the broken rear gangway.'],
        line: ['埃利：“低潮时能摸到船尾。看见那艘空船上的黑旗了吗？你也能放下后舷梯，给船上那两个征来的士兵一条回家的路。”',
          'Eli: “Low tide puts the stern within reach. See the black flag on that empty boat? Or lower the rear gangway and give those two conscripts a way home.”'] },
      { id: H.access, label: ['空船信号桅 · 拉起黑旗', 'Empty skiff signal mast · Raise the black flag'],
        hint: ['可在信号桅引开岗哨、从后舷梯放人离开，或在正面挑战守船兵。', 'Draw the watch to the flag, let the conscripts leave by the rear gangway, or confront them at the front.'],
        line: ['黑旗在空船上升起，征召兵沿岸追过去。等他们走出栈桥，再去松开工作船。', 'The black flag goes up on the empty boat. The conscripts follow it along the shore. Wait for them to clear the pier, then release the workboat.'],
        after: done => !harborCustomsGone(done) },
      { id: H.release, label: ['埃利的船 · 松开扣押缆', 'Eli’s boat · Cast off the seized mooring'],
        hint: ['从栈桥到工作船缆桩，松开缆绳。', 'Reach the workboat’s mooring from the quay and release its line.'],
        line: ['埃利保住了船和工具。空出来的船舱还能载一批备用药箱。港区给返乡的人添了新的接应台。', 'Eli has his boat and tools back. The hold can carry another load of medicine, and the harbor has a new reception table for people returning home.'],
        after: done => harborCustomsGone(done) || done.has(H.access) },
    ],
  },
  {
    id: 'sea-keepsakes', region: 'blacksail', title: ['海里没有金币', 'There Is No Gold in the Sea'],
    available: done => done.has('blackbeard_meet') || harborCustomsGone(done),
    steps: [
      { id: D.sight, label: ['风暴低处 · 看退水刻线的斜光', 'Vortex floor · Trace the low-water reflection'],
        hint: ['到风暴之眼附近的水痕线，跟斜光找浮空旧船。', 'Look by the low-water mark near the eye of the vortex, then follow the glint to the wreck.'],
        line: ['水痕退到第二刻，断桅把一道光折向漂起的客船。借上升气流登上第一段残骸，两块活动甲板还斜挂在那儿。', 'At the lower water mark a broken spar throws a glint toward the floating passenger ship. Ride the updraft to the first wreck. Two tilting deck sections still hang from it.'] },
      { id: D.forward, label: ['前甲板拉杆 · 将刻线对平', 'Forward deck lever · Align the level mark'],
        hint: ['在第一艘浮船上分段扳动拉杆，直到前甲板对平。', 'On the first floating wreck, move the forward lever in steps until its board is level.'],
        line: ['前甲板对平了。下一块还压着另一侧的栏杆。', 'The forward deck is level. The other board still rests against the far rail.'] },
      { id: D.aft, label: ['后甲板拉杆 · 衔接两块甲板', 'Aft deck lever · Join the two decks'],
        hint: ['扳动旁边的第二个拉杆，直到后甲板也对平。', 'Work the second lever until the aft deck is level too.'],
        line: ['两块甲板接上了。沿木梁上客船，看看防水匣里装的是什么。', 'Both decks now meet. Walk the boards to the passenger ship and open the waterproof case.'] },
      { id: D.chest, label: ['旧客船 · 打开防水匣', 'Passenger wreck · Open the waterproof case'],
        hint: ['走过拼好的活动甲板，到旧客船的船灯旁打开匣子。', 'Cross the aligned decks and open the case beside the old ship’s lantern.'],
        line: ['没有金币。匣里是梳子、挂坠和一个孩子的鞋。航标的挡片完好，装回去后出港船也能看见这一段海路。', 'There is no gold. The case holds a comb, a pendant and a child’s shoe. The beacon shutter still works. Put it back so departing ships can read this stretch of sea.'] },
      { id: D.choose, label: ['拿骚家属接应桌 · 安置遗物', 'Nassau reception table · Place the keepsakes'],
        hint: ['把遗物带回拿骚，交还家属或留在公共纪念舱。', 'Take the keepsakes to Nassau. Return them to the family or leave them in the shared memorial.'],
        line: ['家属愿意带走自己的东西，也愿意让它们留在公共纪念舱。航标已经修好，之后可以从旧客船上看海。', 'The family can take the keepsakes home or leave them in the shared memorial. The beacon is repaired, and the old passenger ship is a lookout now.'] },
    ],
  },
  {
    id: 'captains-chair', region: 'blacksail', title: ['船长的座位', 'The Captain’s Seat'],
    available: done => done.has('blackbeard_meet') || harborCustomsGone(done),
    steps: [
      { id: C.talk, label: ['拿骚酒馆外桌 · 听黑胡子夸口', 'Nassau tavern table · Hear Blackbeard’s boast'],
        hint: ['去酒馆后门外的木桌，看看两只投掷盘。', 'Find the two throwing trays on the wooden table behind the tavern.'],
        line: ['黑胡子：“我闭着眼也知道木筹会停哪边。你押一枚，我扔。先看桌脚往哪边歪。”', 'Blackbeard: “I can call where the chip will land with my eyes shut. You stake one, I throw. Take a look at which way the table leans.”'] },
      { id: C.throw, label: ['酒馆桌 · 押一枚木筹', 'Tavern table · Stake one wooden chip'],
        hint: ['在桌边选一只投掷盘，看木筹落在哪边。', 'Choose a tray at the table and watch where the chip lands.'],
        line: ['哪一边会接住木筹？左盘更近，右边的桌腿较短。', 'Which tray will catch the chip? The left is closer. The table’s right leg is shorter.'] },
      { id: C.repair, label: ['船长的凳子 · 固定松腿', 'Captain’s stool · Brace the loose leg'],
        hint: ['米拉把松动的凳子推到桌旁。一起把凳腿敲回去。', 'Mira sets the loose stool beside the table. Help knock the leg back into place.'],
        line: ['黑胡子扶住凳腿，抱怨了三句，还是等木楔完全咬住才松手。下次来的时候，靠门的位置给你留着。', 'Blackbeard holds the leg and grumbles. He keeps his grip until the wedge seats. Next time, he leaves you the place by the door.'] },
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
    id: 'winter-bread', region: 'winter', title: ['没有寄出的面包', 'The Bread That Never Left'],
    available: done => done.has('napoleon_meet') || done.has('winter_core'),
    steps: [
      { id: F.box, label: ['雪中教室 · 看有炉子画的面包箱', 'Schoolroom · Read the bread box'],
        hint: ['在取暖教室里找卢克画了炉子的木箱。', 'Find the box with Luc’s drawing of an oven in the warm schoolroom.'],
        line: ['卢克：“烤盘被邻居借走了。我闻到靠坡那家的焦面包味。去看看他们是不是还在用。”', 'Luc: “The neighbors borrowed the baking tray. I can smell burnt bread from the house by the slope. Find out if they still need it.”'] },
      { id: F.house, label: ['暖窗 · 找仍在使用的烤盘', 'Warm window · Find the tray in use'],
        hint: ['沿亮着的窗户找到坡下住家，查看烟道。', 'Follow the lit windows to the house by the slope and inspect the flue.'],
        line: ['烤盘盖在裂开的炉口上。主人说烟道一直漏风。补好烟道能换回烤盘，也可以让他们留下烤盘和这间暖屋。', 'The tray covers a cracked stove mouth. The flue leaks. Patch it and take the tray back, or leave it with the household so the room stays warm.'] },
      { id: F.plan, label: ['暖房门口 · 决定烤盘的去向', 'Warm house · Decide where the tray goes'],
        hint: ['在暖房选择修烟道换烤盘，或把烤盘留在这里。', 'At the warm house, decide whether to patch the flue or leave the tray.'],
        line: ['修好烟道后能把烤盘交还卢克。也能留下烤盘，让邻居继续照看暖屋和屋顶通道。', 'A repaired flue lets you bring the tray back to Luc. Leaving it here lets the neighbors keep the warm room and rooftop path open.'] },
      { id: F.report, label: ['雪中教室 · 告诉卢克结果', 'Schoolroom · Tell Luc what happened'],
        hint: ['回教室向卢克交代烤盘的去向。', 'Return to the schoolroom and tell Luc where the tray ended up.'],
        line: ['卢克把炉子的画夹进下一趟货单。有人会在谷地收到一封短短的消息。', 'Luc tucks the oven drawing into the next freight slip. Someone in the Valley will get a short note.'] },
    ],
  },
  {
    id: 'winter-shoes', region: 'winter', title: ['不属于任何一边的鞋', 'Shoes for Neither Side'],
    available: done => done.has('napoleon_meet') || done.has('winter_core'),
    steps: [
      { id: SH.line, label: ['废井 · 沿三种鞋的脚印找人', 'Old well · Follow the three kinds of shoes'],
        hint: ['在废井边找两军旧靴和一双儿童鞋，沿它们往储藏间走。', 'Find two soldiers’ boots and a child’s shoe by the well, then follow them to the store.'],
        line: ['有的靴跟磨得外翻，有的鞋底缝过两次。三双鞋都朝同一扇低门。', 'One heel is worn outward. Another sole has been sewn twice. All three pairs point toward a low door.'] },
      { id: SH.cellar, label: ['低门下 · 和老鞋匠交谈', 'Below the low door · Meet the cobbler'],
        hint: ['沿放着鞋楦的低道进储藏间。', 'Follow the low passage past the shoe lasts into the store.'],
        line: ['老人说，有些人还没来取鞋。他可以留下把路标立起来，也可以带工具去渡口，只要下一班的人知道去哪找。', 'The cobbler is still waiting for people to collect their shoes. He can put up a sign and stay, or take his tools to the crossing if the next group knows where to find him.'] },
      { id: SH.choose, label: ['鞋匠的桌 · 安排下一班接应', 'Cobbler’s table · Arrange the next handoff'],
        hint: ['在储藏间选择双面路标或渡口临时摊。', 'Choose a two-sided sign at the store or a temporary stall at the crossing.'],
        line: ['留下能让两条雪路都找到储藏间，去渡口则能当面接到等鞋的人。', 'A sign guides both snow roads to the store. A stall lets the cobbler meet the people waiting at the crossing.'] },
    ],
  },
  {
    id: 'winter-range', region: 'winter', title: ['炮兵的刻度', 'The Gunner’s Scale'],
    available: done => done.has(ADVENTURE.road) || done.has('winter_core'),
    steps: [
      { id: WR.meet, label: ['红堤旧炮台 · 扶正测距尺', 'Redoubt battery · Set up the range staff'],
        hint: ['走到炮台边，把真炮兵留下的测距尺立起来。', 'Reach the battery and set up the range staff the gunner left.'],
        line: ['炮兵：“撤退以后，还能用这尺做什么？来，从脊线看断桥、风口和低弯，打一份实际看得见的测绘。”', 'Gunner: “What good is this staff after a withdrawal? Walk the ridge and sight the broken bridge, wind gap and lower bend.”'] },
      { id: WR.crest, label: ['脊线标架 · 对准断桥', 'Ridge sight · Range the broken bridge'],
        hint: ['沿脊线到第一座标架，对准断桥方向。', 'Follow the ridge to the first frame and take a bearing toward the bridge.'],
        line: ['断桥在炮线外。沿低处看风是怎么拐过来的。', 'The bridge is outside the firing lane. Look down the slope to see where the wind turns.'] },
      { id: WR.valley, label: ['避风点 · 对准低谷的信号旗', 'Sheltered sight · Range the valley flag'],
        hint: ['走到侧坡测风点，记录低谷的视线。', 'Walk to the flank station and record the valley sightline.'],
        line: ['风从这条沟掠过去。到最后一个弯复核路线。', 'The wind crosses this gully. Check the route at the final bend.'] },
      { id: WR.bend, label: ['低弯 · 核对两条运货视线', 'Lower bend · Verify both freight bearings'],
        hint: ['从最后一个标架核对测得的两条路线。', 'Use the final sight to check both of the measured routes.'],
        line: ['线连上了。炮兵能留在后卫放一轮烟，或去磨坊帮桥工安护栏。', 'The bearings meet. The gunner can give the rear guard one smoke volley or help the mill crew set up railings.'] },
      { id: WR.choose, label: ['测距图 · 交给后卫或桥工', 'Survey sheet · Give it to the rear guard or bridge crew'],
        hint: ['把测绘交给后卫排烟幕，或交给桥工提前安护栏。', 'Give the survey to the rear guard for smoke or to the bridge crew for railings.'],
        line: ['烟幕会暂时压住后卫交战中的远射。护栏会提前布在磨坊近岸。炮兵只能先去一处。', 'Smoke will briefly suppress ranged fire in a rear-guard fight. Railings go up early at the mill approach. The gunner can serve one place first.'] },
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
    id: 'unmarked-pass', region: 'kyoto', title: ['没有名字的通行纸', 'The Unmarked Pass'],
    available: done => done.has('musashi_meet') || done.has('fire_core'),
    steps: [
      { id: P.register, label: ['河街民居 · 查看搬运名册', 'River street · Read the porters’ register'],
        hint: ['沿鸭川西岸找工棚旁的临时名册。', 'Look for the temporary register beside the work shelter on the west bank.'],
        line: ['阿纪：“健太怕家人被追责，同班的搬运工又怕没人能查到遇难者。我们可以封存实名，只让执勤的人认工号。你也可以帮健太一家先离开。”',
          'Aki: “Kenta fears reprisals against his family. The other porters need a record of anyone lost. We can seal the names and show only work numbers, or help Kenta’s household leave first.”'] },
      { id: P.choice, label: ['河街工棚 · 决定怎样交接', 'Work shelter · Decide how to proceed'],
        hint: ['和阿纪确认通行牌或安全离开的安排。', 'Confirm a sealed pass or safe departure with Aki.'],
        line: ['封存实名后，河街工棚能作受保护的交接点。若让一家人先走，名册不挂出去，工棚仍不放行。', 'A sealed register lets the work shelter serve as a protected handoff. If the family leaves first, the register stays private and the shelter stays closed.'] },
    ],
  },
  {
    id: 'kamo-paperline', region: 'kyoto', title: ['鸭川上方的晾纸绳', 'The Paper Line Above the Kamo'],
    available: done => done.has('musashi_meet') || done.has('fire_core'),
    steps: [
      { id: L.shop, label: ['河边纸铺 · 检查旧滑轮', 'Riverside paper shop · Inspect the pulley'],
        hint: ['沿河找挂着湿纸的屋棚，查看旧纸架。', 'Look for the canopy of damp sheets beside the river.'],
        line: ['纸架已升起来，跨巷线却拉不动。沿屋边斜道上檐，走窄梁到对面，配重卡在吊架里。', 'The rack is up, but the line across the alley won’t move. Take the ramp up to the eaves and cross the beam to the jammed weight.'] },
      { id: L.rooftop, label: ['屋檐 · 找配重的位置', 'Eaves · Locate the counterweight'],
        hint: ['从纸铺斜道上屋顶，沿木梁到对面的滑轮。', 'Take the shop ramp onto the roof and follow the beam to the opposite pulley.'],
        line: ['卡块压住了半截配重。拉开配重上的插销就能送纸。', 'A block has jammed against the weight. Pull the pin to run the paper carrier.'] },
      { id: L.counterweight, label: ['配重架 · 拔掉卡住的销', 'Counterweight frame · Pull the jammed pin'],
        hint: ['绕到滑轮外侧拔销，然后沿另一侧短路落地。', 'Go around the outside of the pulley, pull the pin, and take the far-side shortcut down.'],
        line: ['配重落下来，纸样跨过小巷。对岸的纸工放下了短梯，以后可以从两边上来。', 'The weight drops and a test sheet crosses the alley. The paper workers lower the far-side access so the roofs can be reached from either end.'] },
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
  if (id === WR.trigger) return done.has(WR.smoke) && !done.has(WR.smokeUsed);
  if (id === D.lookout) return done.has(D.choose);
  if (id === C.rematch) return done.has(C.repair);
  if (id === H.gangway || id === H.fight) return fieldSideReady(H.access, done);
  if (id === B.board || id === B.returnFerry) return done.has(B.launch);
  if (id === P.return) return done.has(P.choice);
  if (id === L.courier) return done.has(L.counterweight);
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
  [WR.trigger, ['后卫烟幕信号 · 一次', 'Rear-guard smoke signal · One volley']],
  [D.lookout, ['旧客船 · 登上安全观景甲板', 'Old passenger ship · Look out from the safe deck']],
  [C.rematch, ['酒馆外桌 · 再投一轮', 'Tavern table · Throw another round']],
  [H.gangway, ['后舷梯 · 让征召兵离开', 'Rear gangway · Let the conscripts leave']],
  [H.fight, ['正面扣押岗 · 挑战守船兵', 'Seizure post · Confront the boat guards']],
  [B.board, ['剑湖东岸 · 搭乘木舟', 'Sword Lake east landing · Ride the ferry']],
  [B.returnFerry, ['剑湖西岸 · 搭乘木舟', 'Sword Lake west landing · Ride the ferry']],
  [P.return, ['河街 · 看交接安排', 'River street · Check the handoff']],
  [L.courier, ['纸架 · 再送一份样张', 'Paper rack · Send another test sheet']],
  [B.watch, ['剑湖观景栈台 · 看木舟试航', 'Sword Lake viewing deck · Watch the trial launch']],
  [V.listen, ['生活馆电台 · 听居民播报', 'Residence radio · Listen to the residents']],
  [I.test, ['渡口铃 · 试响', 'Ferry bell · Ring it']],
  [O.bowl, ['邻里饭桌 · 喝一碗热汤', 'Shared table · Eat a bowl of soup']],
  [Q.supplies, ['小室补给柜 · 取备用弹药', 'Quiet room cache · Take the spare ammunition']],
  [S.medicine, ['晴空庭医疗柜 · 使用备用补给', 'Clear Sky Court cabinet · Use the reserve']],
]);
