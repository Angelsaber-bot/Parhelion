import type { FieldAction, FieldChapterContent } from './fieldChapters';
import { ORLEANS_WORKS } from '../map/orleansWorks';
import { ORLEANS_CAMPAIGN as OC } from './orleansCampaign';

/** O06 the three teams acting on their own conditions (planks → boat → cover, shown on site),
 * O08 after the bridgehead: the run across, then terms for Ware's garrison, and O09's quiet morning. */
export const OF = {
  post: 'o06_post', mural: 'o06_mural', o06: 'o06_complete',
  run: 'o08_run', lower: 'o08_lower_drawbridge', disarm: 'o08_disarm', terms: 'o08_terms', o08: 'o08_complete',
  quayBell: 'o09_quay_handbell', bridgeBell: 'o09_bridge_handbell', watch: 'o09_watch', road: 'o09_road', gate: 'o09_gate', margot: 'o09_margot', martin: 'o09_martin', alix: 'o09_alix', bread: 'o09_bread', bell: 'o09_bell', o09: 'o09_complete',
} as const;
const F = OF;
const won = (d: ReadonlySet<string>) => d.has('journey_orleans_crossing_open');
const a = (chapter: string, x: Omit<FieldAction, 'region' | 'chapter'>): FieldAction => ({ region: 'orleans', chapter, ...x });
export const ORLEANS_FINALE_ACTIONS: readonly FieldAction[] = [
  a('O06', { id: F.post, near: 'orleans_campaign_agree', off: [6, 6], after: [OC.shifted], gate: d => !won(d),
    label: ['南岸观察点 · 交给城里的人驻守', 'South-bank lookout · Hand it to the townspeople'],
    line: ['铺板、靠船、换位，三队都是看着现场的条件自己动的，你一条也没补发。观察点交给居民驻守。', 'Planks, mooring, cover: each team moved on what it could see, and you never repeated an order. The lookout goes to the townspeople.'], adds: [F.o06] }),
  a('O06', { id: F.mural, near: 'orleans_campaign_agree', off: [-6, 4], optional: true, after: [F.o06],
    label: ['异常墙画 · 多了一个持旗人', 'The odd mural · A second standard-bearer'],
    line: ['墙画里第一次多出一个不同的持旗人。没人解释。', 'For the first time the mural shows a different standard-bearer. Nobody explains it.'] }),
  a('O08', { id: F.run, near: 'orleans_campaign_trial', off: [0, 6], kind: 'work', seconds: 8, gate: won,
    label: ['桥上 · 跑过从前只能远看的桥段', 'On the bridge · Run the stretch you could only watch before'],
    line: ['工兵推到刻线、船工靠岸、弩手换位，同时发生。你只是跑过去。', 'Engineers reach the mark, boatmen come in, crossbows shift — all at once. You simply run through.'] }),
  a('O08', { id: F.lower, near: 'realm_orleans_east', off: [6, 2], alt: 'o08_way', after: [F.run], gate: won, adds: [F.terms],
    label: ['侧吊桥机 · 放下侧桥，让驻军撤往南岸西营', 'Side drawbridge · Lower it and let the garrison withdraw west'],
    line: ['侧吊桥放下，北岸城门仍由己方封守。驻军抬着伤员往西营撤。', 'The side bridge comes down while the north gate stays held. The garrison carries its wounded toward the western camp.'] }),
  a('O08', { id: F.disarm, near: 'realm_orleans_west', off: [-6, 2], alt: 'o08_way', after: [F.run], gate: won, adds: [F.terms],
    label: ['外堡 · 保持侧桥抬起，先解除重武器', 'Outwork · Keep the bridge up and disarm first'],
    line: ['重武器卸下，缴械后的人分批放行。白旗挂上，双方都看得见。', 'The heavy weapons come off, and the disarmed leave in groups. The white flag goes up where both sides can see it.'] }),
  a('O08', { id: F.o08, near: 'realm_orleans_start', off: [0, -6], after: [F.terms], gate: won,
    label: ['桥堡 · 确认停战依据', 'Bridge fort · Confirm the grounds for the ceasefire'],
    line: ['白旗、停射的喊令、放低的武器和打开的退路。桥堡归了城市。', 'White flag, the call to cease fire, lowered weapons, an open way out. The bridge fort belongs to the city.'] }),
  a('O09', { id: F.watch, near: 'realm_orleans_start', off: [8, 8], after: [F.o08],
    label: ['清晨 · 和贞德看侧吊桥和南岸营地', 'Morning · Look at the side bridge and the south camp with Jeanne'],
    line: ['对岸有人抬着伤员。贞德把追击令压在桌上：“够了。”她把一只手铃交给你。渡口的玛戈等着接客，桥头的马丁等着放车。办完撤军交接，你可以选一处挂铃。', 'Across the river soldiers carry their wounded. Jeanne puts a hand over the pursuit order. “Enough.” She gives you a handbell. Margot needs it to call the ferry; Martin needs it to let carts through. When the withdrawal is settled, you can hang it at either crossing.'] }),
  a('O09', { id: F.road, near: 'realm_orleans_east', off: [10, 6], alt: 'o09_terms', after: [F.watch, F.lower],
    label: ['城外路障 · 放下，让撤军继续往南', 'Outer barricade · Lower it so the withdrawal continues south'],
    line: ['路障放下，撤军沿约定的路往南，不穿过北岸街区。', 'The barricade drops and the column goes south on the agreed road, never through the north-bank streets.'] }),
  a('O09', { id: F.gate, near: 'realm_orleans_west', off: [-10, 6], alt: 'o09_terms', after: [F.watch, F.disarm],
    label: ['外堡离营栅门 · 打开，分批送到南岸交接处', 'Outwork camp gate · Open it and walk them to the handover'],
    line: ['栅门打开，缴了械的人一批批送到南岸交接处。', 'The gate opens, and the disarmed go to the south-bank handover in batches.'] }),
  a('O09', { id: F.margot, near: 'orleans_campaign_trial', off: [-6, 6], optional: true, after: [F.watch],
    label: ['渡口 · 玛戈第一次不为军令摆渡', 'Ferry · Margot rows for no order at all'], line: ['玛戈载了一船菜去对岸。', 'Margot takes a boatload of vegetables across.'] }),
  a('O09', { id: F.martin, near: 'orleans_campaign_trial', off: [6, 6], optional: true, after: [F.watch],
    label: ['新桥板 · 马丁让孩子跺脚试牢', 'New planks · Martin lets a child stamp-test them'], line: ['孩子跺了三下，桥板没动。马丁笑了。', 'The child stamps three times; the planks hold. Martin laughs.'] }),
  a('O09', { id: F.alix, near: 'orleans_campaign_started', off: [5, 5], optional: true, after: [F.watch],
    label: ['阿莉克斯 · 挂好旗，去缝一件普通衣服', 'Alix · Hangs the standard, then sews an ordinary shirt'], line: ['她把旗挂好，转身给邻居缝衣服。', 'She hangs the standard and turns to sewing a shirt for her neighbour.'] }),
  a('O09', { id: F.bread, near: 'orleans_campaign_started', off: [-5, 5], optional: true, after: [F.watch],
    label: ['面包铺 · 和排队的贞德坐一会儿', 'Bakery · Sit a while with Jeanne in the queue'], line: ['她也得等前面的人。你们坐了一会儿。', 'She has to wait behind the others too. You sit together a while.'] }),
  a('O09', { id: F.quayBell, near: ORLEANS_WORKS.crane, off: [-2, 1], optional: true, alt: 'o09_handbell',
    any: [F.road, F.gate], after: [F.watch], kind: 'work', seconds: 2,
    label: ['交给玛戈 · 把唯一的手铃系到渡口', 'Give Margot the handbell · Hang it at the quay'],
    line: ['玛戈把手铃挂得很低。一个提着空篮子的孩子摇了两下，她解开缆绳，把第一班渡船划过去。', 'Margot hangs the bell low. A child with an empty basket rings twice. She slips the mooring and rows the first ferry across.'] }),
  a('O09', { id: F.bridgeBell, near: OC.trial, off: [-3, -3], optional: true, alt: 'o09_handbell',
    any: [F.road, F.gate], after: [F.watch], kind: 'work', seconds: 2,
    label: ['交给马丁 · 把唯一的手铃系到桥头', 'Give Martin the handbell · Hang it at the bridge'],
    line: ['马丁让送面包的人试铃。响一下，桥那头便掀起横杆。第一辆车过桥时，贞德还在排队。', 'Martin asks the baker to try the bell. At one ring a girl across the bridge lifts the bar. The first cart crosses while Jeanne is still in line.'] }),
  a('O09', { id: F.bell, near: 'orleans_campaign_started', off: [0, 8], any: [F.road, F.gate], adds: [F.o09],
    label: ['北岸城里 · 听开市的钟', 'Back in the north town · The market bell'],
    line: ['钟一响，贞德下意识起身。阿莉克斯：“开市，不是警报。”她坐了回去。', 'At the bell Jeanne half rises. Alix: “Market, not alarm.” She sits back down.'] }),
];
export const ORLEANS_FINALE: FieldChapterContent = {
  set: { region: 'orleans', title: ['奥尔良 · 当旗帜离开她的手', 'Orleans · When She Lets Go of the Flag'], actions: ORLEANS_FINALE_ACTIONS },
  props: [
    // Only one handbell was salvaged. The timber stand at the other crossing stays empty.
    ...[F.quayBell, F.bridgeBell].flatMap(id => [
      { at: id, off: [1.4, .75, .6] as const, size: [.14, 1.5, .14] as const, color: 0x775e40, show: (d: ReadonlySet<string>) => d.has(F.watch) },
      { at: id, off: [1.62, 1.47, .6] as const, size: [.58, .10, .12] as const, color: 0x775e40, show: (d: ReadonlySet<string>) => d.has(F.watch) },
      { at: id, off: [1.82, 1.27, .6] as const, size: [.25, .29, .25] as const, color: 0xcaa66a, show: (d: ReadonlySet<string>) => d.has(id) },
      { at: id, off: [1.82, 1.11, .6] as const, size: [.36, .07, .36] as const, color: 0xd4b475, show: (d: ReadonlySet<string>) => d.has(id) },
    ]),
    // O06 on site: planks grow segment by segment, the boat comes in after, cover shifts last.
    ...[1, 2, 3, 4].map(n => ({ at: F.post, off: [-6 + n * 1.6, .2, -6] as const, size: [1.5, .15, 3] as const, color: 0x8d7150,
      show: (d: ReadonlySet<string>) => d.has(OC.planks) || d.has(`${OC.planks}_${n}`) })),
    { at: F.post, off: [4, -.3, -10], size: [1.6, .7, 5], color: 0x6e5238, show: d => d.has(OC.planks), moved: { when: OC.moored, off: [1, -.3, -7] } },
    { at: F.post, off: [-3, 1.2, -2], size: [1.2, 2.2, .2], color: 0x7b5c3a, show: d => d.has(OC.agree), moved: { when: OC.shifted, off: [3, 1.2, -2] } },
    { at: F.lower, off: [0, 3.5, -4], size: [3, .3, 6], color: 0x6e5238, rot: [-1.1, 0, 0], moved: { when: F.lower, off: [0, .3, -6], rot: [0, 0, 0] } },
    { at: F.o08, off: [1, 2.6, 0], size: [.07, 3.6, .07], color: 0x5b4632 },
    { at: F.o08, off: [1.6, 3.9, 0], size: [1.1, .7, .03], color: 0xf2f2ec, show: d => d.has(F.terms) },
    { at: F.road, off: [0, .6, -3], size: [4, 1.2, .4], color: 0x5d4a35, moved: { when: F.road, off: [0, .15, -3], rot: [-1.4, 0, 0] } },
  ],
  actors: [
    { id: 'o_team_engineer', role: ['工兵 · 看射口', 'Engineer · Watching the slit'], coat: 0x7a6a4a,
      place: d => d.has(OC.agree) && !d.has(F.o06) ? [F.post, -4, -5] : null },
    { id: 'o_team_boat', role: ['舟手 · 看刻线', 'Boatman · Watching the mark'], coat: 0x4f6a7a,
      place: d => d.has(OC.agree) && !d.has(F.o06) ? (d.has(OC.moored) ? [F.post, 1, -5] : [F.post, 4, -9]) : null },
    { id: 'o_team_archer', role: ['弩手 · 看船', 'Crossbowman · Watching the boat'], coat: 0x6a5a3a,
      place: d => d.has(OC.agree) && !d.has(F.o06) ? (d.has(OC.shifted) ? [F.post, 3, -1] : [F.post, -3, -1]) : null },
    { id: 'o_garrison', role: ['韦尔的驻军 · 抬伤员', 'Ware’s garrison · Carrying wounded'], coat: 0x8a2a2a,
      place: d => d.has(F.terms) && !d.has(F.o09) ? (d.has(F.lower) ? [F.lower, 2, -8] : [F.disarm, -2, -6]) : null },
  ],
};
