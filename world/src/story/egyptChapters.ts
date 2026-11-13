import type { FieldAction, FieldChapterContent } from './fieldChapters';
import { EGYPT_CAMPAIGN as EC } from './egyptCampaign';

/** Egypt E01/E02 before the existing E03 chain, the E05 relocation in stages and the E06 water show. */
export const EX = {
  look: 'e01_look', cloth: 'e01_cloth', door: 'e01_door', well: 'e01_well', mud: 'e01_mud', column: 'e01_column', e01: 'e01_complete',
  argue: 'e02_argue', reed: 'e02_reed', gauge: 'e02_gauge', haru: 'e02_haru', boat: 'e02_boat', sketch: 'e02_sketch', e02: 'e02_complete',
  table: 'e05_table', move: 'e05_move', model: 'e06_model', statue: 'e06_statue',
} as const;
const X = EX;
const climaxDone = (d: ReadonlySet<string>) => d.has('realm_egypt_phase_1') || d.has('journey_egypt_water_returned');
const open = (d: ReadonlySet<string>) => d.has('journey_egypt_weir') && !climaxDone(d);
/** Saves already into E03 before these chapters existed keep their route. */
export const egyptOpeningRequired = (d: ReadonlySet<string>) => open(d) && (d.has(X.look) || !d.has(EC.started) && !d.has(EC.ready));
const a = (chapter: string, x: Omit<FieldAction, 'region' | 'chapter'>): FieldAction => ({ region: 'egypt', chapter, gate: open, ...x });
export const EGYPT_CHAPTER_EXTRA: readonly FieldAction[] = [
  a('E01', { id: X.look, near: 'egypt_stranded_landing', off: [6, 6], label: ['沙坡 · 去渡口看看', 'Sand slope · Go and look at the landing'],
    line: ['满载的渡船搁在沙上，船腹上方却有鱼落下来。一次倒流把港边的吊货架拉斜了，工人被困在架后。', 'A laden ferry sits on the sand, and fish fall from above its hull. A reverse surge has dragged the dock crane askew and trapped workers behind it.'] }),
  a('E01', { id: X.cloth, near: 'egypt_stranded_landing', off: [-6, 8], kind: 'shot', alt: 'e01_way', after: [X.look],
    label: ['遮阳布绳扣 · 射断，让布落成软桥', 'Awning knot · Shoot it so the cloth drops into a soft bridge'],
    line: ['遮阳布落下，搭出一道软桥。', 'The awning drops into a soft bridge.'] }),
  a('E01', { id: X.door, near: 'egypt_stranded_landing', off: [8, -4], alt: 'e01_way', after: [X.look],
    label: ['低货台 · 拉开旁门', 'Low cargo deck · Pull open the side door'],
    line: ['旁门开了，从低处也能过去。', 'The side door opens; the low way through is clear.'] }),
  a('E01', { id: X.well, near: 'egypt_stranded_landing', off: [-2, -8], any: [X.cloth, X.door],
    label: ['水尺井拨杆 · 让浮箱托起工人', 'Gauge-well lever · Let the floats lift the workers'],
    line: ['一小池水升起来，浮箱把工人托到能爬出去的高度。第一次，你改变了环境救了人。', 'A small pool rises and the floats lift the workers high enough to climb out. For the first time you saved someone by changing the place.'] }),
  a('E01', { id: X.mud, near: 'egypt_stranded_landing', off: [10, 8], kind: 'fight', after: [X.well],
    foes: [['shieldbearer', ['淤泥甲', 'Mud shell']], ['breaker', ['淤泥甲', 'Mud shell']]],
    label: ['高低货台 · 打退沿新水流冲来的淤泥甲', 'Upper and lower decks · Beat back the mud shells'],
    line: ['最后一只往逆流水柱里钻，想重新结壳。', 'The last one dives for the reversed water column to grow a new shell.'] }),
  a('E01', { id: X.column, near: 'egypt_stranded_landing', off: [0, 12], kind: 'shot', after: [X.mud], adds: [X.e01],
    label: ['逆流水柱 · 王压住时射入裂缝', 'Reversed column · Shoot the crack while the king holds it'],
    line: ['奥斯曼迪斯用太阳纹压住水柱，你射进裂缝。远处天穹封口同时一亮——他一直在承住那里。渡口成了第一个补给点。', 'Ozymandias pins the column under his sun sigil and you shoot into the crack. Far off the sky seal brightens at the same moment: he has been holding it all along. The landing becomes your first supply point.'] }),
  a('E02', { id: X.argue, near: 'egypt_reed_market', off: [-6, 6], after: [X.e01],
    label: ['芦苇市集 · 听梅芮和守井人争', 'Reed market · Hear Meri and the well-keeper argue'],
    line: ['梅芮：“再往下挖，水只会更快往天上走。”守井人不信。', 'Meri: “Dig deeper and the water only climbs to the sky faster.” The well-keeper does not believe her.'] }),
  a('E02', { id: X.reed, near: 'egypt_reed_market', off: [-9, 2], after: [X.argue],
    label: ['井口 · 投下一片带色的芦苇', 'The well · Drop in a dyed reed'],
    line: ['过了一会儿，同一片芦苇出现在倒转的水车上。', 'A little later the same reed turns up on the reversed waterwheel.'] }),
  a('E02', { id: X.gauge, near: 'egypt_gauge_align', off: [3, 3], after: [X.reed],
    label: ['旧水尺 · 转到新刻度', 'Old gauge · Turn it to the new mark'],
    line: ['连通图上短暂亮出一条线：井口→水车→空中。', 'For a moment the map lights a line: well → wheel → sky.'] }),
  a('E02', { id: X.haru, near: 'egypt_reed_market', off: [4, 8], kind: 'shot', optional: true, after: [X.argue],
    label: ['哈鲁的吊架 · 射绳把货落到舟旁', 'Haru’s hoist · Shoot the line to drop the cargo by the boat'],
    line: ['货落到舟旁。哈鲁给太阳舟加了块能收放的侧遮板。王：“很好。把余的船，造得比你的嘴更结实。”', 'The cargo lands by the boat. Haru fits the sun-boat with a folding side screen. The king: “Good. Build my boats sturdier than your mouth.”'] }),
  a('E02', { id: X.boat, near: 'egypt_reed_market', off: [6, -4], after: [X.gauge],
    label: ['哈鲁 · 接过改好的运输舟', 'Haru · Take the converted transport boat'],
    line: ['薄底祭舟改成了运输舟。哈鲁要王认一句：“太阳再高，吃水也有上限。”', 'The thin ritual boat is now a transport. Haru makes the king admit: “However high the sun, a hull only draws so much.”'] }),
  a('E02', { id: X.sketch, near: 'egypt_gauge_report', off: [-3, 4], after: [X.boat], adds: [X.e02],
    label: ['梅芮的草图 · 旧泄洪维修道', 'Meri’s sketch · The old spillway service path'],
    line: ['跟着现在的水流只会回到同一个井口。草图上画着唯一能到真正上游的入口。', 'Following the current only leads back to the same well. The sketch shows the one entrance that reaches the true source.'] }),
  a('E05', { id: X.table, near: 'egypt_water_plan_table', off: [4, 4], after: [EC.bed], gate: d => open(d) && !d.has(EC.relocated),
    label: ['立体地形桌 · 转分水板看两边水尺', 'Relief table · Turn the divider and read both gauges'],
    line: ['西线：港口水尺越过船坞门槛。东线：水线到达最外的田块。平均分：两边都停在功能标记前，生活井一直有水。', 'West: the harbour gauge clears the dock sill. East: the waterline reaches the outermost field. An even split leaves both short of their marks; the village wells always have water.'] }),
  a('E05', { id: X.move, near: 'egypt_reed_market', off: [8, 2], kind: 'work', seconds: 12, after: [EC.relocated],
    label: ['市集 · 看村民按方案一段段搬迁', 'Market · Watch the villagers move in stages'],
    line: ['房屋和摊位一段一段搬到高岸，没有人等你下命令。你能沿自己搭起的路走过从前过不去的地方。', 'Houses and stalls move up to the high bank stage by stage; nobody waits for your order. You can walk your own new road where you could not before.'] }),
  a('E06', { id: X.model, near: 'egypt_confluence_high_bank', off: [4, -4], after: [EC.relocated], gate: d => open(d) && !d.has(EC.trial),
    label: ['高岸 · 先看水沿模型推进', 'High bank · Watch the water follow the model'],
    line: ['小股试流水一格一格往前，和模型完全一样——直到出口那里的水开始倒升。', 'The test flow advances notch by notch exactly as modelled, until the water at the outlet starts to rise backwards.'] }),
  a('E06', { id: X.statue, near: 'egypt_confluence_high_bank', off: [-5, 4], after: [EC.bell],
    label: ['巨像下 · 看王触摸导向切缝', 'Under the colossus · Watch the king touch the guide seam'],
    line: ['王把手放在自己像的切缝上：“站了如此久，也该替余之臣民承一回水了。”', 'The king lays his hand on the seam of his own statue: “It has stood long enough. Let it bear the water for my people once.”'] }),
];
const water = 0x4f97a8;
export const EGYPT_CHAPTERS: FieldChapterContent = {
  set: { region: 'egypt', title: ['埃及 · 尼罗河的第二次黎明', 'Egypt · The Nile’s Second Dawn'], actions: EGYPT_CHAPTER_EXTRA },
  props: [
    { at: X.look, off: [3, 4, -4], size: [3, .5, .5], color: 0x6e5238, rot: [0, 0, .35], moved: { when: X.e01, off: [3, 3.2, -4] } },
    { at: X.cloth, off: [0, 3.2, 0], size: [.12, .5, .12], color: 0xb7a578, target: X.cloth },
    { at: X.cloth, off: [0, .4, 2], size: [3, .08, 4], color: 0xe2d4b0, show: d => d.has(X.cloth) },
    { at: X.well, off: [1.5, -.2, 0], size: [2.4, .2, 2.4], color: water, moved: { when: X.well, off: [1.5, .5, 0] } },
    { at: X.column, off: [0, 2.5, -2], size: [.9, 5, .9], color: 0x30484e, target: X.column },
    { at: X.reed, off: [1, .2, 0], size: [1.2, .4, 1.2], color: 0x8a8578 },
    { at: X.gauge, off: [1, 1.2, 0], size: [.15, 2.4, .15], color: 0xc2a462, rot: [0, 0, .2], moved: { when: X.gauge, off: [1, 1.2, 0] } },
    { at: X.haru, off: [0, 4, 0], size: [.1, 1.6, .1], color: 0xb7a578, target: X.haru },
    { at: X.boat, off: [2, -.2, 0], size: [1.4, .6, 5], color: 0x9b7b4b },
    { at: X.sketch, off: [1, .9, 0], size: [1, .04, .7], color: 0xe8dcc0 },
    // E05: stalls that move to the high bank in visible stages (work segments _1.._3, then done).
    ...[0, 1, 2, 3].map(i => ({ at: X.move, off: [i * 2.2 - 3, .6, -4] as const, size: [1.6, 1.2, 1.4] as const, color: 0xb59a6a,
      show: (d: ReadonlySet<string>) => d.has(EC.relocated), moved: { when: (d: ReadonlySet<string>) => d.has(X.move) || d.has(`${X.move}_${Math.min(3, i + 1)}`), off: [i * 2.2 - 3, .6, -16] as const } })),
    // E06: the test flow, the backed-up outlet, and the cleared outlet once any solution works.
    { at: X.model, off: [0, -1.6, -6], size: [3, .1, 10], color: water, show: d => d.has(EC.trial) || d.has(X.model) },
    { at: X.model, off: [0, -1.1, -12], size: [4, 1, 3], color: 0x2f4a50, show: d => d.has(EC.trial) && ![EC.side, EC.armor, EC.steady].some(f => d.has(f)) },
    { at: X.model, off: [0, -1.5, -14], size: [3, .1, 6], color: water, show: d => [EC.side, EC.armor, EC.steady].some(f => d.has(f)) },
  ],
  actors: [
    { id: 'e_trapped_worker', role: ['被困的河工', 'Trapped river worker'], coat: 0xc9b48a,
      place: d => d.has(X.well) ? [X.well, 3, 2] : d.has(X.look) ? [X.well, 1, -2] : null },
    { id: 'e_well_keeper', role: ['守井人', 'Well-keeper'], coat: 0x8a7a5a, place: d => d.has(X.e01) ? [X.reed, 2, 1] : null },
    ...[0, 1].map(i => ({ id: `e_mover_${i}`, role: ['搬迁的村民', 'Villager relocating'] as [string, string], coat: 0xa88a62,
      place: (d: ReadonlySet<string>) => !d.has(EC.relocated) ? null : d.has(X.move) || d.has(`${X.move}_2`) ? [X.move, i * 2, -14] as const : [X.move, i * 2, -2] as const })),
  ],
};
