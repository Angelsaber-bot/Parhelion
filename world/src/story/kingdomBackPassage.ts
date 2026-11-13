import type { FieldAction, FieldChapterContent } from './fieldChapters';
import { adventureActive } from './openWorldCampaign';
import { KINGDOM_GATE } from './kingdomGate';

/** K04 打开自己关上的门: open the back passage from inside so the divided districts reconnect.
 * Two real entrances (main street under a crossbow, or the narrow abbey path); Artoria takes the other. */
export const K04 = {
  overlook: 'k04_overlook', street: 'k04_street_fight', winch: 'k04_street_winch',
  ladder: 'k04_abbey_ladder', shelf: 'k04_abbey_shelf', abbey: 'k04_abbey_fight',
  open: 'k04_open', residents: 'k04_residents', ada: 'k04_ada', complete: 'k04_complete',
} as const;
const K = K04;
/** K01–K03: the gate's crossfire, the lake outpost with Artoria, and a street still cooking dinner. */
export const K01 = {
  crossbows: 'k01_crossbows', tunnel: 'k01_tunnel', portcullis: 'k01_portcullis', ada: 'k01_ada', k01: 'k01_complete',
  outpost: 'k02_outpost', crossbow: 'k02_crossbow', latch: 'k02_latch', rest: 'k02_rest', k02: 'k02_complete',
  bread: 'k03_bread', practice: 'k03_practice', wheel: 'k03_wheel', bell: 'k03_bell', k03: 'k03_complete',
} as const;
const O = K01;
const kingdomOpen = (d: ReadonlySet<string>) => adventureActive(d) && !d.has('sun_core');
/** A save already past the Round Table hearth before these chapters existed keeps its old route. */
export const kingdomOpeningRequired = (d: ReadonlySet<string>) => kingdomOpen(d) && (d.has(O.crossbows) || d.has(O.tunnel) || !d.has('hall_brazier_1'));
const open = (d: ReadonlySet<string>) => adventureActive(d) && d.has(KINGDOM_GATE.rescued) && !d.has('sun_core') && (d.has(O.k03) || !kingdomOpeningRequired(d));
const o = (chapter: string, x: Omit<FieldAction, 'region' | 'chapter' | 'gate'>): FieldAction => ({ region: 'britain', chapter, gate: kingdomOpen, ...x });
export const KINGDOM_OPENING_ACTIONS: readonly FieldAction[] = [
  o('K01', { id: O.crossbows, near: '@-856,31.9,-132', off: [0, 0], kind: 'fight', alt: 'k01_way',
    foes: [['musketeer', ['暮影弩手', 'Dusk crossbowman']], ['lancer', ['暮影攻城兵', 'Dusk besieger']]],
    label: ['门外 · 清掉暮影弩手', 'Outside the gate · Clear the dusk crossbows'],
    line: ['重演旧攻势的暮影弩手倒下了。门两边的人还在交叉火力里，外闸还开着。', 'The dusk crossbows replaying the old siege fall. People on both sides are still in the crossfire, and the outer portcullis is still up.'] }),
  o('K01', { id: O.tunnel, near: 'kingdom_gate_notice', off: [-6, 14], alt: 'k01_way',
    label: ['城墙后方 · 走维修洞绕过战线', 'Behind the wall · Take the maintenance tunnel'],
    line: ['维修洞从城墙下穿过去，你不用在同一条战线上走两遍。弩手看不见你。', 'The maintenance tunnel runs under the wall; you need not cross the same line twice. The crossbows never see you.'] }),
  o('K01', { id: O.portcullis, near: 'kingdom_gate_notice', off: [4, -6], any: [O.crossbows, O.tunnel],
    label: ['外闸 · 落下', 'Outer portcullis · Drop it'],
    line: ['外闸落下，暮影的攻势被隔在外面。罗恩的活卫队在门内收拢——他们是来保护人的，不是你的敌人。', 'The portcullis drops and the dusk assault is shut outside. Rowan’s living guard gathers inside; they are protectors, not your enemy.'] }),
  o('K01', { id: O.ada, near: 'kingdom_gate_notice', off: [12, 3], after: [O.portcullis], adds: [O.k01],
    label: ['侧梯外侧 · 和艾妲会合', 'Down the side stair · Meet Ada outside'],
    line: ['艾妲没事。她把名册抱在怀里：“还有一条路——湖边。”防守有用，但还不够。', 'Ada is unhurt, holding her register. “There is another way back — by the lake.” The defence helped, but it is not enough.'] }),
  o('K02', { id: O.outpost, near: '@-617,7.9,74', off: [0, 0], kind: 'fight', after: [O.k01],
    foes: [['shieldbearer', ['空甲哨卡', 'Empty-armour sentry']], ['lancer', ['空甲枪兵', 'Empty-armour lancer']]],
    label: ['林间出口 · 和阿尔托莉雅击退哨卡', 'Forest exit · Break the sentry post with Artoria'],
    line: ['阿尔托莉雅先迎上近敌，替你挡下冲来的一枪。她指向远处：“弩架交给你。”', 'Artoria meets the close enemies first and turns aside a lance aimed at you. She points ahead: “The crossbow rack is yours.”'] }),
  o('K02', { id: O.crossbow, near: '@-630,4.9,84', off: [0, 0], kind: 'shot', after: [O.outpost],
    label: ['远处弩架 · 射断', 'Distant crossbow rack · Shoot it'],
    line: ['弩架断了，她借这个空当冲过去。', 'The rack breaks and she uses the opening to charge through.'] }),
  o('K02', { id: O.latch, near: '@-620,6.9,96', off: [0, 0], after: [O.crossbow], adds: [O.k02],
    label: ['哨卡门闩 · 近身拉开', 'Sentry bolt · Draw it up close'],
    line: ['林间出口通了。她回头听了一会儿：“城里的钟，好久没响完了。”', 'The forest exit is open. She listens for a moment: “The city bell has not finished ringing in a long time.”'] }),
  o('K02', { id: O.rest, near: '@-612,7.9,80', off: [0, 0], optional: true, after: [O.outpost],
    label: ['湖边 · 安全休整点', 'Lakeside · Safe rest point'],
    line: ['湖边多了一处能歇脚的地方，从这里也能回林间支路。', 'There is now a place to rest by the lake, with a way back to the forest path.'] }),
  o('K03', { id: O.bread, near: 'kingdom_works_bread_window', off: [-3, 3], optional: true, after: [O.k02],
    label: ['面包铺 · 帮忙抬起挡窗木板', 'Bakery · Help lift the board off the window'],
    line: ['窗口亮了。面包比昨天小一圈。阿尔托莉雅接过递来的一块。', 'The window lights up. The loaves are a little smaller than yesterday. Artoria takes the piece she is handed.'] }),
  o('K03', { id: O.practice, near: 'kingdom_works_lamp_market', off: [4, -3], kind: 'shot', optional: true, after: [O.k02],
    label: ['木剑练习 · 朝转错方向的靶子开一枪', 'Wooden-sword practice · Shoot the target facing the wrong way'],
    line: ['靶子转了回来。几个孩子盯着你的枪看了好久。', 'The target swings back round. A few children stare at your gun for a long time.'] }),
  o('K03', { id: O.wheel, near: 'kingdom_works_waterwheel', off: [-3, 3], optional: true, after: [O.k02],
    label: ['水车 · 转到下一挡', 'Waterwheel · Turn it to the next notch'],
    line: ['水车咔一声进了下一挡，磨坊又转起来。', 'The wheel clicks into the next notch and the mill turns again.'] }),
  o('K03', { id: O.bell, near: 'kingdom_works_evening_bell', off: [-3, 3], after: [O.k02], adds: [O.k03],
    label: ['钟楼维修入口 · 看艾妲试钟', 'Bell tower service door · Watch Ada test the bell'],
    line: ['齿轮完好。每当钟锤快碰到钟身，就被什么扯回原位。不是坏了——是有东西不让它响完。', 'The gears are whole. Each time the hammer nears the bell, something pulls it back. It is not broken; something will not let it finish ringing.'] }),
];
const a = (x: Omit<FieldAction, 'region' | 'chapter' | 'gate'>): FieldAction => ({ region: 'britain', chapter: 'K04', gate: open, ...x });
export const K04_ACTIONS: readonly FieldAction[] = [
  a({ id: K.overlook, near: 'kingdom_gate_notice', off: [-2, 7], label: ['城垛 · 看清两个入口', 'Battlement · Read both entrances'],
    line: ['主街宽，高处有弩机和盾兵；修院侧路避开弩机，但入口窄、要上下一层。阿尔托莉雅：“你选一边，另一边交给我。”', 'The main street is wide, under a crossbow nest and shield guards. The abbey path avoids the crossbow but is narrow, with a drop. Artoria: “Choose a side. I will take the other.”'] }),
  a({ id: K.street, near: 'kingdom_works_patrol', off: [3, 4], kind: 'fight', alt: 'k04_route', after: [K.overlook],
    foes: [['musketeer', ['高处弩手', 'Crossbow nest']], ['shieldbearer', ['正面盾兵', 'Street shield guard']]],
    label: ['主街 · 压制弩机与盾兵', 'Main street · Suppress the crossbow and shields'],
    line: ['弩手撤下高处。阿尔托莉雅已从修院那边压住了侧翼。绞盘就在街口。', 'The crossbow nest is down. Artoria holds the abbey flank. The winch is at the street mouth.'] }),
  a({ id: K.winch, near: 'kingdom_works_waterwheel', off: [3, -3], kind: 'work', seconds: 6, after: [K.street],
    label: ['街口绞盘 · 收起封街木栅', 'Street winch · Raise the barricade'],
    line: ['木栅收起，主街到备用通路的掩体连成一线。', 'The barricade lifts; cover now runs from the main street to the back passage.'] }),
  a({ id: K.ladder, near: 'adventure_kingdom_abbey', off: [4, 2], alt: 'k04_route', after: [K.overlook],
    label: ['修院后墙 · 放下检修梯', 'Abbey rear wall · Lower the service ladder'],
    line: ['检修梯落下，上下一层的通路成立。阿尔托莉雅去主街吸引弩机。', 'The ladder drops, linking the two levels. Artoria goes to draw the crossbow on the main street.'] }),
  a({ id: K.shelf, near: 'adventure_kingdom_abbey', off: [-4, 3], after: [K.ladder],
    label: ['修院储藏间 · 把货架推成掩体', 'Abbey storeroom · Push the shelf into cover'],
    line: ['货架横在窄口，近身来的人只能从一侧进来。', 'The shelf blocks the narrow entrance; close attackers can only come from one side.'] }),
  a({ id: K.abbey, near: 'disc_kingdom_abbey_bridge', off: [4, 0], kind: 'fight', after: [K.shelf],
    foes: [['breaker', ['窄口重卫', 'Narrow-gate breaker']], ['lancer', ['修院长枪兵', 'Abbey lancer']]],
    label: ['修院侧路 · 守住窄口', 'Abbey path · Hold the narrow entrance'],
    line: ['窄口守住了。侧路从内侧接上了备用通路。', 'The narrow entrance holds. The side path now reaches the back passage from inside.'] }),
  a({ id: K.open, near: 'kingdom_gate_latch', off: [-3, 8], any: [K.winch, K.abbey],
    label: ['备用通路 · 从内侧拉开门闩', 'Back passage · Draw the bolt from inside'],
    line: ['门从内侧打开。错关了也能再开，这道门现在由城里的人自己管。', 'The door opens from inside. If it is shut by mistake it can be opened again; the townspeople keep this door now.'] }),
  a({ id: K.residents, near: 'kingdom_gate_latch', off: [1, 11], kind: 'work', seconds: 9, after: [K.open],
    label: ['安全锚点 · 让居民分段过街', 'Safe anchors · Move residents in stages'],
    line: ['居民一段一段走到有掩体的锚点，危险时就停在檐下。没有人需要跟着一辆慢车走完整张地图。', 'Residents move from one covered anchor to the next and wait under eaves when it is dangerous. Nobody has to follow a slow cart across the map.'] }),
  a({ id: K.ada, near: 'kingdom_works_evening_bell', off: [3, -3], after: [K.residents], adds: [K.complete],
    label: ['钟楼脚下 · 看艾妲开工', 'Bell tower foot · Watch Ada start work'],
    line: ['艾妲没有等谁来交任务，已经开始把钟楼的工具搬下来。街区重新连上了。', 'Ada does not wait to be handed a task; she is already carrying the bell tower tools down. The districts are connected again.'] }),
];
export const kingdomBackPassageRequired = (d: ReadonlySet<string>) => adventureActive(d) && d.has(KINGDOM_GATE.rescued) && !d.has('sun_core') && (d.has(K.overlook) || !d.has('hall_brazier_1'));
export const KINGDOM_K04: FieldChapterContent = {
  set: { region: 'britain', title: ['落日王国 · 守住旧誓之前', 'Sunset Kingdom · Before the Old Oath'], actions: [...KINGDOM_OPENING_ACTIONS, ...K04_ACTIONS] },
  props: [
    { at: O.portcullis, off: [0, 4.2, -3], size: [4, 3.4, .3], color: 0x3a342c, moved: { when: O.portcullis, off: [0, 1.7, -3] } },
    { at: O.crossbow, off: [0, 1.2, -2], size: [1.6, .3, .5], color: 0x5d4a35, target: O.crossbow },
    { at: O.latch, off: [0, 1.1, -1.2], size: [2.6, .25, .25], color: 0x4a3a2a, moved: { when: O.latch, off: [-1.3, 1.8, -1.2], rot: [0, 0, 1.3] } },
    { at: O.practice, off: [0, 1, -4], size: [.7, 1.2, .12], color: 0xb08a5a, rot: [0, Math.PI, 0], target: O.practice },
    { at: O.practice, off: [0, 1, -4], size: [.7, 1.2, .12], color: 0xb08a5a, show: d => d.has(O.practice) },
    { at: O.bread, off: [0, 1.4, -1.2], size: [1.6, 1, .08], color: 0x6e5135, moved: { when: O.bread, off: [0, 2.4, -1.2], rot: [-1.2, 0, 0] } },
    { at: K.street, off: [0, 3.2, 5], size: [1.8, .45, .7], color: 0x5d4a35, moved: { when: K.street, off: [0, .25, 5], rot: [0, 0, 1.2] } },
    { at: K.street, off: [-2.5, .9, 4], size: [.9, 1.8, .2], color: 0x8a8f96 },
    { at: K.winch, off: [1.2, .7, 0], size: [.8, .8, 1.2], color: 0x6f5636 },
    { at: K.winch, off: [0, 1.1, -3], size: [4, 2.2, .25], color: 0x4c3b2a, moved: { when: K.winch, off: [0, 3.6, -3] } },
    { at: K.ladder, off: [1, 3.6, 0], size: [.5, 4, .12], color: 0x7b5c3a, moved: { when: K.ladder, off: [1, 1.6, .7], rot: [-.35, 0, 0] } },
    { at: K.shelf, off: [1.6, .8, 0], size: [2, 1.6, .55], color: 0x6e5135, moved: { when: K.shelf, off: [0, .8, 2.2], rot: [0, Math.PI / 2, 0] } },
    { at: K.open, off: [0, 1.5, -2.2], size: [3.2, 3, .3], color: 0x3f3328, moved: { when: K.open, off: [0, 4.4, -2.2] } },
    { at: K.ada, off: [1.4, .35, .6], size: [1.1, .7, .7], color: 0x8b6b44, show: d => d.has(K.complete) },
  ],
  actors: [
    { id: 'k01_living_guard', role: ['罗恩的活卫队', 'Rowan’s living guard'], coat: 0x7a5a3a,
      place: d => d.has(O.portcullis) ? [O.portcullis, -2, -2] : d.has(O.crossbows) || d.has(O.tunnel) ? [O.portcullis, 2, -4] : null },
    { id: 'k03_baker', role: ['面包师', 'Baker'], coat: 0xb48a5a, place: d => d.has(O.k02) ? [O.bread, 1.5, -.5] : null },
    { id: 'k03_child', role: ['好奇的孩子', 'Curious child'], coat: 0x6a8ab0, place: d => d.has(O.k02) ? [O.practice, -1.5, 1] : null },
    { id: 'k04_resident_a', role: ['下城居民 · 面包师', 'Lower-town baker'], coat: 0xa47d52,
      place: d => d.has(K.complete) ? [K.ada, -2, 2] : d.has(K.residents) ? [K.residents, 2, 1] : d.has(K.open) ? [K.residents, -1, -2] : [K.open, 2, 3] },
    { id: 'k04_resident_b', role: ['下城居民 · 送信人', 'Lower-town messenger'], coat: 0x56708a,
      place: d => d.has(K.residents) ? [K.residents, -2, 2] : d.has(K.open) ? [K.residents, 1, -3] : [K.open, -2, 3] },
    { id: 'k04_guard', role: ['城门卫兵 · 随阿尔托莉雅', 'Gate guard · With Artoria'], coat: 0x6d7a8c,
      place: d => d.has(K.ladder) ? [K.street, 2, 0] : d.has(K.street) ? [K.abbey, 2, 0] : [K.overlook, 2, 1] },
  ],
};
