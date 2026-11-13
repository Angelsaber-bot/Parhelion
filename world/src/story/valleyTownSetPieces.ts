import type { FieldAction, FieldChapterContent } from './fieldChapters';
import { JOURNEY as J, valleyRouteOpen } from './worldJourney';

/** Valley and Homeward Town set pieces placed at load time on the reviewed maps (no region rebuild):
 * V01 Lookback Bridge gate and service hatch, V06 West Ridge breach and lookout, T02 canteen kitchen,
 * T01 Homeward Square timetable, H07's visible cart queue at the levee gate, H13's resident-built footbridge. */
export const VT = {
  hatch: 'h00_bridge_hatch', ridge: 'h01_ridge_lookout', kitchen: 'h04_kitchen_door', plaza: 'h02_square_timetable',
  queue: 'h07_gate_queue', footbridge: 'h13_footbridge', chair: 'h13_chair',
} as const;
const V = VT;
const a = (chapter: string, x: Omit<FieldAction, 'region' | 'chapter'>): FieldAction => ({ region: 'alpha', chapter, optional: true, ...x });
const h07Live = (d: ReadonlySet<string>) => d.has(J.compare) && !valleyRouteOpen(d);
export const VALLEY_SET_ACTIONS: readonly FieldAction[] = [
  a('H00', { id: V.hatch, near: 'journey_lookback_bridge_rear', off: [-3, 4],
    label: ['回望桥下 · 检修口', 'Under Lookback Bridge · Service hatch'],
    line: ['检修口通向桥下的旧路。王国那边的后门打开以后，居民也会从这里抄近路。', 'The hatch leads to the old road under the bridge. Once the kingdom back gate opens, residents cut through here too.'] }),
  a('H01', { id: V.ridge, near: 'journey_west_ridge', off: [4, 4],
    label: ['西岭崩口 · 从高处回望镇子', 'West Ridge breach · Look back at the town'],
    line: ['从崩口回头，能看见孟槐的窗口亮着。你在任务单上写下第一个目的地。', 'Turning at the breach you can see Meng Huai’s window lit. You write your first destination on the job sheet.'] }),
  a('H04', { id: V.kitchen, near: 'journey_meal_route_sketch', off: [4, -3],
    label: ['食堂后门 · 看物资分到各个岗位', 'Canteen back door · Watch supplies go out to the posts'],
    line: ['你没开口，后门的人已经把物资一箱箱分到相邻的岗位。从窗口能看到这些工作在你不在时也在进行。', 'Without a word from you, the people at the back door sort the crates out to the neighbouring posts. From the window you can see the work going on whether or not you are here.'] }),
  a('H02', { id: V.plaza, near: 'home_cafe_service', off: [-6, -6],
    label: ['归灯广场 · 实体时刻表', 'Homeward Square · The posted timetable'],
    line: ['时刻表是居民一起钉上去的：左边写实测，右边写预报。便捷旅行一直能用。', 'The residents nailed the timetable up together: measurements on the left, forecasts on the right. Quick travel still works.'] }),
  a('H07', { id: V.queue, near: 'journey_gate_cutoff', off: [6, 6], gate: h07Live,
    label: ['下堤闸门 · 看车流怎样堵住', 'Lower levee gate · See how the carts back up'],
    line: ['旧方案一关闸，车就在门口排成一串，后面的人看不见前面为什么停。改执行、留预报，才不会把人堵在危险里。', 'When the old plan shuts the gate the carts pile up at it, and no one behind can see why. Change the execution, keep the forecast, and no one is trapped in danger.'] }),
  a('H13', { id: V.footbridge, near: 'journey_tomorrow_bridge', off: [-5, -6], gate: d => d.has(J.returnHome),
    label: ['新步桥 · 亲手走过去', 'The new footbridge · Walk across it yourself'],
    line: ['你不在的时候，居民把这座步桥修好了。站在桥上，能从没见过的角度看见自己的窗户。没有人宣布什么。', 'While you were away the residents finished this footbridge. From the middle you can see your own window from an angle you never had. Nobody announces anything.'] }),
  // T07 生维分离: parallel lines, a load transfer you stay for, the mechanical lock, one shading.
  { region: 'alpha', chapter: 'T07', id: 't07_parallel', near: 'journey_sky_feed', off: [3, 3], after: [J.feed], gate: d => !d.has(J.isolate),
    label: ['配光喉 · 看生活线与执行线分成两束', 'Light throat · See life support and enforcement split into two lines'],
    line: ['两束线路第一次分开走。生活线还连着执行端的负荷，要先把负荷转过去。', 'For the first time the two lines run apart. Life support still carries the enforcement load; transfer it first.'] },
  { region: 'alpha', chapter: 'T07', id: 't07_load', near: 'journey_sky_load_test', off: [3, -3], kind: 'work', seconds: 9, after: ['t07_parallel'], gate: d => !d.has(J.test),
    label: ['负荷台 · 让负荷一格一格转到生活线', 'Load bank · Shift the load to life support step by step'],
    line: ['三格负荷依次转过来，谷地的生活灯一直没暗。现在可以验证切换。', 'The three load steps shift across one by one and the valley lights never dim. Now verify the transfer.'] },
  { region: 'alpha', chapter: 'T07', id: 't07_shade', near: 'journey_sky_isolation', off: [-3, 3], after: [J.isolate], gate: d => !d.has(J.phase1),
    label: ['隔离锁旁 · 看透镜遮一次光', 'By the isolation lock · Watch the lens shade once'],
    line: ['赫利昂的透镜扫过来，遮了一次光。生活灯没有灭——打 Boss 不会关掉地上的供给。', 'Helion’s lens sweeps across and shades the light once. The life-support lamps stay lit: fighting the boss will not shut off the ground’s supply.'], adds: ['t07_complete'] },
  a('H13', { id: V.chair, near: 'journey_return_meal', off: [3, 3], gate: d => d.has(J.epilogue),
    label: ['食堂 · 帮孟槐挪一把椅子', 'Canteen · Help Meng Huai move a chair'],
    line: ['一把普通的椅子。孟槐说：“放窗边。明天还有人来。”', 'An ordinary chair. Meng Huai says: “By the window. Someone else is coming tomorrow.”'] }),
];
export const VALLEY_SET_PIECES: FieldChapterContent = {
  set: { region: 'alpha', title: ['幻日谷 · 归路', 'Parhelion Valley · The Road Home'], actions: VALLEY_SET_ACTIONS },
  props: [
    // V01: north town gate on the bridge approach, and the hatch to the old road below.
    { at: V.hatch, off: [-2.2, 2, -4], size: [.6, 4, .6], color: 0x8a8578 },
    { at: V.hatch, off: [2.2, 2, -4], size: [.6, 4, .6], color: 0x8a8578 },
    { at: V.hatch, off: [0, 4.2, -4], size: [5.2, .6, .7], color: 0x6f6a5f },
    { at: V.hatch, off: [1.2, .08, 0], size: [1.2, .12, 1.2], color: 0x4f4a42 },
    // V01: walkway rails and lamps along both sides of the approach.
    ...[-3, 3].flatMap(x => [{ at: V.hatch, off: [x, .55, -9] as const, size: [.1, .9, 9] as const, color: 0x6b5238 },
      { at: V.hatch, off: [x, 1.6, -13] as const, size: [.14, 3.2, .14] as const, color: 0x3e4044 },
      { at: V.hatch, off: [x, 3.3, -13] as const, size: [.4, .35, .4] as const, color: 0xffd98a }]),
    // V06: slopes either side of the breach, and the fixed kingdom seam stones.
    { at: V.ridge, off: [-6, 1.2, -4], size: [3, 2.4, 6], color: 0x77705f, rot: [0, 0, .5] },
    { at: V.ridge, off: [6, 1.2, -4], size: [3, 2.4, 6], color: 0x77705f, rot: [0, 0, -.5] },
    ...[-1.5, 0, 1.5].map(x => ({ at: V.ridge, off: [x, .9, -9] as const, size: [.5, 1.8, .5] as const, color: 0xc8a86a })),
    // V06: breach cairns and the local camp.
    { at: V.ridge, off: [-3, .7, 0], size: [1.2, 1.4, 1.2], color: 0x7e7a70 },
    { at: V.ridge, off: [3, .9, 0], size: [1.2, 1.8, 1.2], color: 0x7e7a70 },
    { at: V.ridge, off: [0, .6, 4], size: [2.4, 1.2, 1.8], color: 0x8a6e4a, rot: [0, .3, 0] },
    { at: V.ridge, off: [-1.5, .15, 2.5], size: [.6, .3, .6], color: 0xd88a3a },
    // T02: kitchen back door and crates being sorted.
    { at: V.kitchen, off: [0, 1.1, -1.2], size: [1.2, 2.2, .12], color: 0x6e5135 },
    { at: V.kitchen, off: [1.5, .3, .4], size: [.7, .5, .5], color: 0x8a6a42 },
    { at: V.kitchen, off: [2.3, .3, .9], size: [.7, .5, .5], color: 0x8a6a42 },
    // T02 interior: two long tables with benches, the kitchen counter, the protagonist's room and yard.
    ...[-2.4, 2.4].flatMap(x => [{ at: V.chair, off: [x, .75, -2] as const, size: [1, .08, 3.4] as const, color: 0x8d7150 },
      { at: V.chair, off: [x - .75, .42, -2] as const, size: [.32, .08, 3.4] as const, color: 0x6e5135 },
      { at: V.chair, off: [x + .75, .42, -2] as const, size: [.32, .08, 3.4] as const, color: 0x6e5135 }]),
    { at: V.kitchen, off: [-2, .5, -2.4], size: [2.6, 1, .7], color: 0x9a8a6a },
    { at: V.kitchen, off: [-2, 1.05, -2.4], size: [.5, .1, .4], color: 0x404040 },
    { at: V.chair, off: [5, .3, 3], size: [1, .4, 2], color: 0xb9a07a },
    { at: V.chair, off: [5.6, .9, 3.8], size: [.4, .5, .1], color: 0x7a5a38 },
    { at: V.chair, off: [7, .05, 6], size: [3, .1, 3], color: 0x5a7a3a },
    { at: V.chair, off: [-.4, .45, 3.2], size: [.45, .9, .45], color: 0x7a5a38, show: d => d.has(V.chair) },
    // T01: return lamp, posted timetable, a public bench and the departure platform.
    { at: V.plaza, off: [0, 2.6, -1.4], size: [.18, 5.2, .18], color: 0x3e4044 },
    { at: V.plaza, off: [0, 5.3, -1.4], size: [.6, .5, .6], color: 0xffd98a },
    { at: V.plaza, off: [2, 1.2, -.6], size: [2.2, 1.4, .1], color: 0x7a5a38 },
    { at: V.plaza, off: [2, 1.3, -.54], size: [2, 1.1, .02], color: 0xe8dfc8 },
    { at: V.plaza, off: [-2.5, .45, .6], size: [2, .12, .5], color: 0x6e5135 },
    { at: V.plaza, off: [0, .12, 4], size: [4, .24, 2.5], color: 0x9a9488 },
    // H07: the queue at the shut gate, which clears once the route is open.
    ...[0, 1, 2, 3].map(i => ({ at: V.queue, off: [0, .7, -3 - i * 3.4] as const, size: [1.6, 1.2, 2.8] as const, color: 0x7a5c3a,
      show: (d: ReadonlySet<string>) => d.has(J.compare), moved: { when: valleyRouteOpen, off: [8 + i * 3.4, .7, -18] as const } })),
    // H13: the residents' footbridge, a low deck with rails, seen only after the return.
    { at: V.footbridge, off: [0, .2, 0], size: [1.6, .2, 9], color: 0x8d7150, show: d => d.has(J.returnHome) },
    { at: V.footbridge, off: [-.8, .7, 0], size: [.08, .8, 9], color: 0x6b5238, show: d => d.has(J.returnHome) },
    { at: V.footbridge, off: [.8, .7, 0], size: [.08, .8, 9], color: 0x6b5238, show: d => d.has(J.returnHome) },
    // T07: the two lines, the load bank's three steps, the lock.
    { at: 't07_parallel', off: [1.2, 1.4, 0], size: [.12, .12, 3], color: 0x7fe0b0 },
    { at: 't07_parallel', off: [1.6, 1.4, 0], size: [.12, .12, 3], color: 0xe08a5a },
    ...[0, 1, 2].map(n => ({ at: 't07_load', off: [1, .6 + n * .5, 0] as const, size: [.6, .35, .3] as const, color: 0x7fe0b0,
      show: (d: ReadonlySet<string>) => d.has('t07_load') || d.has(`t07_load_${n + 1}`) })),
    { at: V.footbridge, off: [.3, .32, 2], size: [1.2, .04, .5], color: 0xa58a62, show: d => d.has(J.returnHome) },
  ],
  actors: [
    { id: 'v_kitchen_hand', role: ['食堂后厨', 'Canteen kitchen hand'], coat: 0xb9a07a, place: () => [V.kitchen, 1.6, 1.4] },
    { id: 'v_carter', role: ['被堵在门口的车夫', 'Carter stuck at the gate'], coat: 0x6a5a48,
      place: d => d.has(J.compare) && !valleyRouteOpen(d) ? [V.queue, 1.6, -4] : null },
    { id: 'v_bridge_builder', role: ['修步桥的居民', 'Footbridge builder'], coat: 0x7a6a50,
      place: d => d.has(J.returnHome) ? [V.footbridge, 1.6, 4] : null },
  ],
};
