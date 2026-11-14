import type { FieldAction, FieldChapterContent } from './fieldChapters';

/** Optional, repeatable-feeling interactions in the new 归灯镇 districts (homeTownDistricts.ts). */
const a = (chapter: string, x: Omit<FieldAction, 'region' | 'chapter' | 'optional'>): FieldAction => ({ region: 'home', chapter, optional: true, ...x });
export const HOME_DISTRICT_ACTIONS: readonly FieldAction[] = [
  a('T03', { id: 'h03_bench', near: '@824,17.5,-99', label: ['工坊武器台 · 看大家借用同一张台', 'Workshop bench · Everyone borrows the same bench'],
    line: ['台上同时放着三个人的活：一把待校的枪、一只坏掉的绞盘扣、一张孩子画的弓。', 'Three people’s work shares the bench: a rifle waiting for zeroing, a broken winch catch, a child’s drawing of a bow.'] }),
  a('T03', { id: 'h03_range', near: '@834,17.5,-90', label: ['试射院 · 两套短靶场', 'Test range · Two short lanes'],
    line: ['靶纸上的弹孔按外域的战法分了组。这里打枪不算在街上开火。', 'The holes in the targets are grouped by the tactics learned abroad. Firing here does not count as firing in the street.'] }),
  a('T04', { id: 'h04_records', near: '@522,17.2,15', label: ['广播室 · 记录墙', 'Broadcast room · The record wall'],
    line: ['墙上两份记录并排钉着，谁也没撕掉谁。纸图桌上压着一把校准尺。', 'Two records are pinned side by side; neither tore the other down. A calibration rule weighs down the paper map.'] }),
  a('T05', { id: 'h05_wheel', near: '@948,6.9,136', label: ['下堤货栈 · 水轮和公共货棚', 'Lower-levee store · Water wheel and public shed'],
    line: ['水轮带着绞盘慢慢转，货棚里的箱子贴着不同人的名字。', 'The water wheel turns the winch slowly; the crates in the shed carry different people’s names.'] }),
  a('T07', { id: 'h07_stars', near: '@645,20.1,176', label: ['屋顶步道 · 观星位', 'Rooftop walk · Stargazing post'],
    line: ['从屋顶能看见港口的灯，也能看见天穹那一圈暗下去的冠。', 'From the roofs you can see the harbour lights, and the dimmed ring of the Sky Crown.'] }),
  a('T08', { id: 'h08_station', near: '@776,17.2,-232', label: ['外站 · 新班次时刻表', 'Outstation · The new timetable'],
    line: ['旧协议箱封着，新时刻表钉在旁边：普通班次，按时出发。', 'The old protocol box stays sealed; the new timetable is pinned beside it. Ordinary service, leaving on time.'] }),
  a('T08', { id: 'h08_slope', near: '@657,16,196', label: ['南坡 · 坐下看港', 'South slope · Sit and watch the harbour'],
    line: ['台阶上坐着几个人，没有人在等任务。', 'A few people sit on the steps. Nobody is waiting for a job.'] }),
];
export const HOME_DISTRICTS: FieldChapterContent = { set: { region: 'home', title: ['归灯镇', 'Homeward Town'], actions: HOME_DISTRICT_ACTIONS }, props: [], actors: [
  { id: 'h_workshop_hand', role: ['工坊的人', 'Workshop hand'], coat: 0x7a6a50, place: () => ['h03_bench', 1.5, 1] },
  { id: 'h_archivist', role: ['广播室值班', 'Broadcast duty'], coat: 0x56708a, place: () => ['h04_records', 2, 0] },
  { id: 'h_stevedore', role: ['货栈搬运工', 'Levee porter'], coat: 0x8a6a42, place: () => ['h05_wheel', -3, 2] },
] };
