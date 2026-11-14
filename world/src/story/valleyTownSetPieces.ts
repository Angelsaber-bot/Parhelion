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
  a('H00', { id: V.hatch, near: '@-275.5,4.6,-22', off: [0, 0],
    label: ['回望桥下 · 检修口', 'Under Lookback Bridge · Service hatch'],
    line: ['检修口通向桥下的旧路。王国那边的后门打开以后，居民也会从这里抄近路。', 'The hatch leads to the old road under the bridge. Once the kingdom back gate opens, residents cut through here too.'] }),
  a('H01', { id: V.ridge, near: '@-302,5.5,-15.5', off: [0, 0],
    label: ['西岭崩口 · 从高处回望镇子', 'West Ridge breach · Look back at the town'],
    line: ['从崩口回头，能看见孟槐的窗口亮着。你在任务单上写下第一个目的地。', 'Turning at the breach you can see Meng Huai’s window lit. You write your first destination on the job sheet.'] }),
  a('H04', { id: V.kitchen, near: '@-179.5,10.9,194.4', off: [0, 0],
    label: ['厨房 · 看物资从后门分到各个岗位', 'Kitchen · Watch supplies go out the back door to the posts'],
    line: ['你没开口，后门的人已经把物资一箱箱分到相邻的岗位。从窗口能看到这些工作在你不在时也在进行。', 'Without a word from you, the people at the back door sort the crates out to the neighbouring posts. From the window you can see the work going on whether or not you are here.'] }),
  a('H02', { id: V.plaza, near: 'home_cafe_service', off: [-6, -6],
    label: ['归灯广场 · 实体时刻表', 'Homeward Square · The posted timetable'],
    line: ['时刻表是居民一起钉上去的：左边写实测，右边写预报。便捷旅行一直能用。', 'The residents nailed the timetable up together: measurements on the left, forecasts on the right. Quick travel still works.'] }),
  a('H07', { id: V.queue, near: 'journey_gate_cutoff', off: [6, 6], gate: h07Live,
    label: ['下堤闸门 · 看车流怎样堵住', 'Lower levee gate · See how the carts back up'],
    line: ['旧方案一关闸，车就在门口排成一串，后面的人看不见前面为什么停。改执行、留预报，才不会把人堵在危险里。', 'When the old plan shuts the gate the carts pile up at it, and no one behind can see why. Change the execution, keep the forecast, and no one is trapped in danger.'] }),
  a('H13', { id: V.footbridge, near: '@-276,4.6,-41', off: [0, 0], gate: d => d.has(J.returnHome),
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
  a('H04', { id: 'h04_room', near: '@-179,10.9,186.6',
    label: ['主角房间 · 只留几样有来历的东西', 'Your room · Only a few things with a story'],
    line: ['床、书桌、一只箱子。架上只放了几样说得出来历的东西，其余都留在路上了。', 'A bed, a desk, a chest. The shelf holds only a few things you can tell the story of; the rest stayed on the road.'] }),
  a('H04', { id: 'h04_yard', near: '@-174,10.9,189.5',
    label: ['小院 · 收下晾干的外套', 'The yard · Take in the dried coat'],
    line: ['外套晾干了。院墙外就是生活馆的后墙。', 'The coat is dry. Past the fence is the back wall of the residence hall.'] }),
  a('H13', { id: V.chair, near: 'journey_return_meal', off: [3, 3], gate: d => d.has(J.epilogue),
    label: ['食堂 · 帮孟槐挪一把椅子', 'Canteen · Help Meng Huai move a chair'],
    line: ['一把普通的椅子。孟槐说：“放窗边。明天还有人来。”', 'An ordinary chair. Meng Huai says: “By the window. Someone else is coming tomorrow.”'] }),
];
export const VALLEY_SET_PIECES: FieldChapterContent = {
  set: { region: 'alpha', title: ['幻日谷 · 归路', 'Parhelion Valley · The Road Home'], actions: VALLEY_SET_ACTIONS },
  props: [
    // H07: the queue at the shut gate, which clears once the route is open.
    ...[0, 1, 2, 3].map(i => ({ at: V.queue, off: [0, .7, -3 - i * 3.4] as const, size: [1.6, 1.2, 2.8] as const, color: 0x7a5c3a,
      show: (d: ReadonlySet<string>) => d.has(J.compare), moved: { when: valleyRouteOpen, off: [8 + i * 3.4, .7, -18] as const } })),
    // T07: the two lines, the load bank's three steps, the lock.
    { at: 't07_parallel', off: [1.2, 1.4, 0], size: [.12, .12, 3], color: 0x7fe0b0 },
    { at: 't07_parallel', off: [1.6, 1.4, 0], size: [.12, .12, 3], color: 0xe08a5a },
    ...[0, 1, 2].map(n => ({ at: 't07_load', off: [1, .6 + n * .5, 0] as const, size: [.6, .35, .3] as const, color: 0x7fe0b0,
      show: (d: ReadonlySet<string>) => d.has('t07_load') || d.has(`t07_load_${n + 1}`) })),
  ],
  actors: [
    { id: 'v_kitchen_hand', role: ['食堂后厨', 'Canteen kitchen hand'], coat: 0xb9a07a, place: () => [V.kitchen, 1.6, 1.4] },
    { id: 'v_carter', role: ['被堵在门口的车夫', 'Carter stuck at the gate'], coat: 0x6a5a48,
      place: d => d.has(J.compare) && !valleyRouteOpen(d) ? [V.queue, 1.6, -4] : null },
    { id: 'v_bridge_builder', role: ['修步桥的居民', 'Footbridge builder'], coat: 0x7a6a50,
      place: d => d.has(J.returnHome) ? [V.footbridge, 1.6, 4] : null },
  ],
};
