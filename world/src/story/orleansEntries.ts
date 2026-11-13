import type { FieldAction, FieldChapterContent } from './fieldChapters';
import { ORLEANS_CAMPAIGN as OC } from './orleansCampaign';

/** O02 Alix's own relay beat, and O07's two real battle entries into the bridgehead climax:
 * the bridge cover pushed forward under crossfire, or the river platform reaching the winch from below. */
export const OE = {
  alix: 'o02_alix_watch', push: 'o07_bridge_push', flank: 'o07_bridge_flank',
  float: 'o07_ferry_float', bell: 'o07_ferry_bell', climb: 'o07_ferry_climb', entered: 'o07_entered',
  standard: 'o07_alix_standard', o07: 'o07_complete',
} as const;
const E = OE;
const crossingDone = (d: ReadonlySet<string>) => d.has('journey_orleans_crossing_open') || d.has('realm_orleans_phase_1');
const assault = (d: ReadonlySet<string>) => d.has(OC.complete) && !crossingDone(d);
const a = (chapter: string, x: Omit<FieldAction, 'region' | 'chapter'>): FieldAction => ({ region: 'orleans', chapter, gate: assault, ...x });
export const ORLEANS_ENTRY_ACTIONS: readonly FieldAction[] = [
  { region: 'orleans', chapter: 'O02', id: E.alix, near: 'orleans_campaign_relay', off: [-5, 4], after: [OC.relay],
    gate: d => d.has('journey_orleans_muster') && !d.has(OC.complete),
    label: ['低堤 · 回头看阿莉克斯独自转令', 'Low bank · Look back at Alix relaying alone'],
    line: ['你已经走远了。窗口里的短旗还在一下一下地举：阿莉克斯没有等你回去，自己把同一条掩护口令传给了下一班弩手。', 'You are far down the bank. The pennant in the window keeps rising and falling: Alix has not waited for you, and passes the same covering order to the next crossbow shift herself.'] },
  // Bridge plan: continuous cover, but the enemy concentrates crossfire, so the flank must be cut.
  a('O07', { id: E.push, near: 'orleans_campaign_trial', off: [0, -6], kind: 'work', seconds: 10, alt: 'o07_bridge', after: [OC.bridge],
    label: ['正桥 · 推着护墙向前', 'The bridge · Push the shield wall forward'],
    line: ['长梁护墙一截一截推上桥面，工兵贴着它前进。两侧的交叉火力开始集中过来。', 'The beam wall rolls forward length by length and the engineers move behind it. Crossfire starts to gather from both sides.'] }),
  a('O07', { id: E.flank, near: 'realm_orleans_start', off: [6, -8], kind: 'fight', after: [E.push], adds: [E.entered],
    foes: [['musketeer', ['侧翼弩手', 'Flank crossbowman']], ['jaeger', ['外堡射手', 'Outwork marksman']]],
    label: ['桥侧 · 切掉侧翼弩手', 'Bridge flank · Cut out the flanking crossbows'],
    line: ['侧翼哑了。护墙停在桥头，正门入口打开。', 'The flank falls silent. The wall halts at the bridgehead; the front entry is open.'] }),
  // River plan: a blind approach to the winch from beneath, with a harder rendezvous.
  a('O07', { id: E.float, near: 'realm_orleans_west', off: [-6, 4], alt: 'o07_ferry', after: [OC.ferry],
    label: ['河侧 · 让玛戈的浮台靠上桥墩', 'River side · Bring Margot’s platform to the pier'],
    line: ['浮台贴上桥墩下方，正桥上的弩手看不到这里。', 'The platform settles under the pier where the bridge crossbows cannot see.'] }),
  a('O07', { id: E.bell, near: 'realm_orleans_west', off: [-4, -6], kind: 'shot', after: [E.float],
    label: ['绞盘警铃索 · 射断', 'Winch alarm cord · Shoot it'],
    line: ['警铃没响。绞盘平台上的人还背对着河。', 'The alarm stays silent. The men on the winch platform still have their backs to the river.'] }),
  a('O07', { id: E.climb, near: 'realm_orleans_east', off: [4, 6], after: [E.bell], adds: [E.entered],
    label: ['侧吊桥 · 从下面爬上绞盘平台', 'Side drawbridge · Climb to the winch from below'],
    line: ['你从侧吊桥翻上来，已经在绞盘旁边。前锋要绕一段路才能会合。', 'You come over the side drawbridge right beside the winch. The vanguard has a longer way round to join you.'] }),
  a('O07', { id: E.standard, near: 'realm_orleans_start', off: [-3, 3], after: [E.entered], adds: [E.o07],
    label: ['桥头 · 阿莉克斯随前锋持旗', 'Bridgehead · Alix carries the forward standard'],
    line: ['贞德守在施工队和伤员旁。阿莉克斯举旗站到前锋里，三支队伍按约定的条件各自动起来。', 'Jeanne stays with the work crews and the wounded. Alix takes the standard into the vanguard, and the three teams move on their agreed conditions.'] }),
];
export const orleansEntryRequired = (d: ReadonlySet<string>) => assault(d);
export const ORLEANS_ENTRIES: FieldChapterContent = {
  set: { region: 'orleans', title: ['奥尔良 · 当旗帜离开她的手', 'Orleans · When She Lets Go of the Flag'], actions: ORLEANS_ENTRY_ACTIONS },
  props: [
    { at: E.alix, off: [-3, 3.2, 6], size: [.05, 1.4, .05], color: 0x6a5232 },
    { at: E.alix, off: [-2.6, 3.6, 6], size: [.7, .45, .03], color: 0xe9e0c8 },
    { at: E.push, off: [0, 1.2, 3], size: [3.4, 2.2, .35], color: 0x7b5c3a, moved: { when: E.push, off: [0, 1.2, -6] } },
    { at: E.float, off: [-2, -.3, 2], size: [3.5, .4, 5], color: 0x6e5238, show: d => d.has(OC.ferry) },
    { at: E.bell, off: [0, 4, -2], size: [.08, 2.2, .08], color: 0xb7a578, target: E.bell },
    { at: E.standard, off: [1.2, 1.8, 0], size: [.07, 3.6, .07], color: 0x5b4632, show: d => d.has(E.entered) },
    { at: E.standard, off: [1.8, 3.2, 0], size: [1.2, .8, .03], color: 0xeae3cf, show: d => d.has(E.entered) },
  ],
  actors: [
    { id: 'o_engineer', role: ['马丁的工兵', 'Martin’s engineer'], coat: 0x7a6a4a,
      place: d => d.has(E.entered) ? [E.standard, 3, -2] : d.has(OC.bridge) ? [E.push, 1, 2] : d.has(OC.ferry) ? [E.float, 1, 1] : null },
    { id: 'o_boatman', role: ['玛戈的舟手', 'Margot’s boatman'], coat: 0x4f6a7a,
      place: d => d.has(OC.ferry) && !d.has(E.entered) ? [E.float, -1, 2] : null },
  ],
};
