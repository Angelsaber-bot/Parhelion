import type { FieldAction, FieldChapterContent } from './fieldChapters';
import { QIN_CAMPAIGN as QC } from './qinCampaign';

/** Q06 逆着葬礼走: from the star-official dome, the crew walks outward against an inward funeral.
 * The ranks change places on their own schedule and cut the road; the player climbs a carrier rack,
 * clears the crossbow line (or crosses high by the maintenance ladder) and rejoins the crew. */
export const QP = {
  dome: 'q06_dome', bridge: 'q06_bridge', cut: 'q06_ranks_cut', rack: 'q06_rack', lane: 'q06_lane', ladder: 'q06_ladder',
  rejoin: 'q06_rejoin', q06: 'q06_complete',
} as const;
const P = QP;
const climaxDone = (d: ReadonlySet<string>) => d.has('realm_qin_phase_1') || d.has('journey_qin_public_order');
export const qinProcessionRequired = (d: ReadonlySet<string>) => d.has(QC.locked) && !climaxDone(d) && (d.has(P.dome) || !d.has(QC.halt));
const open = (d: ReadonlySet<string>) => d.has(QC.locked) && !climaxDone(d);
const a = (x: Omit<FieldAction, 'region' | 'chapter' | 'gate'>): FieldAction => ({ region: 'qin', chapter: 'Q06', gate: open, ...x });
export const QIN_PROCESSION_ACTIONS: readonly FieldAction[] = [
  a({ id: P.dome, near: 'qin_campaign_observe', off: [6, -6], label: ['星官穹顶 · 俯看两条交错军道', 'Star-official dome · Look down on the crossing ranks'],
    line: ['穹顶下，兵甲和器物一列列向中央寝殿汇过去。你的队伍要逆着它们走到外门工道。银色河川只是边界，不用碰。', 'Below the dome, armour and grave goods file inward to the central hall. Your crew must walk against them to the outer works road. The silver rivers are only a boundary.'] }),
  a({ id: P.bridge, near: 'qin_campaign_observe', off: [-6, 4], after: [P.dome, QC.observe],
    label: ['断开的铜桥端头 · 让载梁队驻定、转向', 'Broken bronze bridge · Halt and turn the beam crew'],
    line: ['载梁队在桥端停稳、转向。远处鼓板一响，军阵按葬仪开始换位。', 'The beam crew halts at the bridge end and turns. A clapper sounds far off, and the ranks begin to change places by the funeral order.'] }),
  a({ id: P.cut, near: 'qin_campaign_observe', off: [0, 10], after: [P.bridge],
    label: ['原路 · 看着俑列把它切断', 'The old road · Watch the ranks cut it'],
    line: ['几百尊俑横过来，原路被一整列切断。它们不看你，只是照着葬仪走。旁边有一个高出的载架。', 'Hundreds of figures cross in front, and the road is cut by a whole column. They do not look at you; they just keep the funeral’s order. A raised carrier rack stands to one side.'] }),
  a({ id: P.rack, near: 'qin_campaign_observe', off: [8, 8], after: [P.cut],
    label: ['高出的载架 · 跳上去', 'Raised carrier rack · Jump up'],
    line: ['从载架上能看见另一侧的通道，和一排对着它的弩兵。', 'From the rack you can see the far passage, and a row of crossbows covering it.'] }),
  a({ id: P.lane, near: 'qin_campaign_observe', off: [12, 2], kind: 'fight', alt: 'q06_cross', after: [P.rack],
    foes: [['musketeer', ['陵道弩俑', 'Tomb crossbow figure']], ['jaeger', ['高位弩俑', 'High crossbow figure']]],
    label: ['另一侧通道 · 清理射线', 'Far passage · Clear the firing line'],
    line: ['射线清了，另一侧的通道能走。', 'The firing line is clear and the far passage is usable.'] }),
  a({ id: P.ladder, near: 'qin_campaign_observe', off: [-10, 10], alt: 'q06_cross', after: [P.rack],
    label: ['星官维修梯 · 从高处跨过最后一段军道', 'Star-official ladder · Cross the last rank road from above'],
    line: ['你从维修梯上方跨过去，绕开了那一组弩兵。', 'You cross above on the maintenance ladder and leave that crossbow group behind.'] }),
  a({ id: P.rejoin, near: 'qin_campaign_halt', off: [6, 6], any: [P.lane, P.ladder], adds: [P.q06],
    label: ['安全龛 · 接回自己的队伍', 'Safe alcove · Rejoin your crew'],
    line: ['周弭点了人：“都在。”远处能看见一点地面上的光。接下来在安全落位驻定，把工符暂交蔺禾。', 'Zhou Mi counts heads: “All here.” Far ahead there is a little daylight. Next, halt at the safe berth and lend Lin He the tally.'] }),
];
export const QIN_PROCESSION: FieldChapterContent = {
  set: { region: 'qin', title: ['秦帝陵 · 未葬之人', 'Qin Mausoleum · The Unburied'], actions: QIN_PROCESSION_ACTIONS },
  props: [
    // The inward procession itself is drawn by environment/qinProcessionScene.ts (two marching columns).
    { at: P.rack, off: [0, 1.2, -1.5], size: [2.4, .3, 1.4], color: 0x7a6a4a },
    { at: P.ladder, off: [0, 3, -1], size: [.5, 6, .12], color: 0x6f6b5a },
    { at: P.dome, off: [0, 6, 0], size: [4, .2, 4], color: 0x2a3550 },
  ],
  actors: [
    { id: 'q_crew_lead', role: ['载梁队领头', 'Beam crew lead'], coat: 0x6a6a7a,
      place: d => d.has(P.q06) ? [P.rejoin, 2, 1] : d.has(P.bridge) ? [P.bridge, 2, 2] : null },
  ],
};
