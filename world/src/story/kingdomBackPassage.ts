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
const open = (d: ReadonlySet<string>) => adventureActive(d) && d.has(KINGDOM_GATE.rescued) && !d.has('sun_core');
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
export const kingdomBackPassageRequired = (d: ReadonlySet<string>) => open(d) && (d.has(K.overlook) || !d.has('hall_brazier_1'));
export const KINGDOM_K04: FieldChapterContent = {
  set: { region: 'britain', title: ['落日王国 · 打开自己关上的门', 'Sunset Kingdom · Open the Door You Closed'], actions: K04_ACTIONS },
  props: [
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
    { id: 'k04_resident_a', role: ['下城居民 · 面包师', 'Lower-town baker'], coat: 0xa47d52,
      place: d => d.has(K.complete) ? [K.ada, -2, 2] : d.has(K.residents) ? [K.residents, 2, 1] : d.has(K.open) ? [K.residents, -1, -2] : [K.open, 2, 3] },
    { id: 'k04_resident_b', role: ['下城居民 · 送信人', 'Lower-town messenger'], coat: 0x56708a,
      place: d => d.has(K.residents) ? [K.residents, -2, 2] : d.has(K.open) ? [K.residents, 1, -3] : [K.open, -2, 3] },
    { id: 'k04_guard', role: ['城门卫兵 · 随阿尔托莉雅', 'Gate guard · With Artoria'], coat: 0x6d7a8c,
      place: d => d.has(K.ladder) ? [K.street, 2, 0] : d.has(K.street) ? [K.abbey, 2, 0] : [K.overlook, 2, 1] },
  ],
};
