import type { FieldAction, FieldChapterContent } from './fieldChapters';
import { adventureActive } from './openWorldCampaign';
import { KYOTO_WITNESS, kyotoWitnessActive } from './kyotoWitness';

/** J08 无人签过的战报 and J09 开门见人: the decree court outside Honnō-ji. The old Hellfire Lord
 * becomes 鸦印 (Crow Seal), a curtain duelist; the open-the-gate sequence follows his custody. */
export const JC = {
  offer: 'j08_offer', publicEntry: 'j08_public_entry', sideEntry: 'j08_side_entry', entered: 'j08_entered',
  device: 'j08_device', custody: 'j08_custody', j08: 'j08_complete',
  latch: 'j09_latch', nobunaga: 'j09_nobunaga', walk: 'j09_walk', receiver: 'j09_receiver', j09: 'j09_complete',
} as const;
const J = JC, Y = KYOTO_WITNESS;
const before = (d: ReadonlySet<string>) => adventureActive(d) && !d.has('fire_core') && !d.has('musashi_contract') && (d.has(Y.public) || d.has(Y.private));
const after = (d: ReadonlySet<string>) => adventureActive(d) && d.has('fire_core');
const a = (chapter: string, x: Omit<FieldAction, 'region' | 'chapter'>): FieldAction => ({ region: 'kyoto', chapter, gate: before, ...x });
export const KYOTO_COURT_ACTIONS: readonly FieldAction[] = [
  a('J08', { id: J.offer, near: 'disc_honnoji', off: [6, 6], label: ['誊令庭门口 · 听鸦印开条件', 'Decree court gate · Hear the Crow Seal’s offer'],
    line: ['鸦印：“交出阿纪的原始账册，战报里你就是救城的人。”你没有接。他笑了一下，退进帘后。', 'The Crow Seal: “Hand over Aki’s original ledger and the report will name you the city’s saviour.” You do not take it. He smiles and steps back behind the curtains.'] }),
  a('J08', { id: J.publicEntry, near: 'adventure_kyoto_street_temple_permit', off: [4, -4], alt: 'j08_entry', after: [J.offer, Y.public], adds: [J.entered],
    label: ['正门 · 士兵拒绝齐射', 'Front gate · The soldiers refuse the volley'],
    line: ['鸦印下令齐射。门口的士兵都读过公开的更正，枪口一支接一支放低。', 'The Crow Seal orders a volley. The soldiers at the gate have read the public correction; one by one the muzzles drop.'] }),
  a('J08', { id: J.sideEntry, near: 'disc_honnoji_service', off: [-4, 4], alt: 'j08_entry', after: [J.offer, Y.private], adds: [J.entered],
    label: ['南侧便门 · 副官打开侧廊', 'South service gate · The lieutenant opens the side gallery'],
    line: ['收到撤令的副官替你拉开侧廊的门。齐射对准的是空院子。', 'The lieutenant who received the withdrawal opens the side gallery for you. The volley is aimed at an empty yard.'] }),
  a('J08', { id: J.device, near: 'boss_hellfire_lord', off: [7, -5], kind: 'shot', optional: true, after: [J.offer],
    label: ['便携誊令装置 · 提前打坏', 'Portable decree press · Break it early'],
    line: ['誊令装置裂开，印兵不会再被印出来。鸦印没了替身，会更早贴身出刀。原始封套仍在他身上。', 'The press cracks; no more print-soldiers. Without his stand-ins the Crow Seal will close in sooner. The original envelope is still on him.'] }),
  a('J08', { id: J.custody, near: 'boss_hellfire_lord', off: [-3, 4], gate: after, adds: [J.j08],
    label: ['拘押鸦印 · 取回原始传输封套', 'Detain the Crow Seal · Recover the original envelope'],
    line: ['护甲和短铳都碎了，鸦印被押住。耐火封套里是原始传输；外院佣兵的枪线撤了，正规军仍未停火。', 'His armour and pistol broken, the Crow Seal is held. The fireproof envelope carries the original transmission. The courtyard mercenaries lower their guns; the regular armies have not ceased fire.'] }),
  a('J09', { id: J.latch, near: 'adventure_kyoto_witness_gate', off: [3, 3], kind: 'work', seconds: 6, gate: after, after: [J.j08, Y.gate],
    label: ['同一操作位 · 抬开烧损的门闩', 'Same station · Lift the burned bolt'],
    line: ['防火屏和门闩都开了。院外的明智兵和院内的织田守兵第一次看见彼此的手。', 'The fire screen and the bolt are open. The Akechi soldiers outside and the Oda guards inside see each other’s hands for the first time.'] }),
  a('J09', { id: J.nobunaga, near: 'disc_honnoji', off: [-5, -3], gate: after, after: [J.latch],
    label: ['门内 · 信长下令先撤枪', 'Inside the gate · Nobunaga orders his guns down first'],
    line: ['信长走到门内能看见的位置，放弃征发粮仓与内院反击权，命令自己一侧先撤下对准居民通路的枪。副官看见了，撤下本段的火线。', 'Nobunaga steps where he can be seen, gives up the granary levy and the counterattack, and orders his own side to lower the guns on the residents’ path first. The lieutenant sees it and pulls this stretch of his line.'] }),
  a('J09', { id: J.walk, near: 'adventure_kyoto_evidence', off: [4, 4], gate: after, after: [J.nobunaga],
    label: ['院门 · 看阿纪和见证人走出去', 'The gate · Watch Aki and the witnesses walk out'],
    line: ['阿纪和见证人穿门而出。信长转去共同见证的偏营，不是带着随员自由出城。', 'Aki and the witnesses walk through. Nobunaga goes to the shared witness camp, not out of the city with his retinue.'] }),
  a('J09', { id: J.receiver, near: 'adventure_kyoto_evidence', off: [-4, 4], gate: after, after: [J.walk], adds: [J.j09],
    label: ['接收器 · 记下仍在说谎的战报', 'Receiver · Log the report that still lies'],
    line: ['接收器又收到一条：“本能寺已毁，信长已死，外来者已完成交付。”活着的人就在眼前。时间、来源和画面一起存进证据。', 'The receiver takes another line: “Honnō-ji destroyed, Nobunaga dead, delivery complete.” The living man stands in front of you. Time, source and scene go into the evidence together.'] }),
];
export const kyotoCourtRequired = (d: ReadonlySet<string>) => adventureActive(d) && !d.has('fire_core') && !d.has('musashi_contract') && kyotoWitnessActive(d);
export const KYOTO_COURT: FieldChapterContent = {
  set: { region: 'kyoto', title: ['业火京都 · 无人签过的战报', 'Kyoto · The Report Nobody Signed'], actions: KYOTO_COURT_ACTIONS },
  props: [
    // The decree court: folding screens and translucent curtains block sight only; stone blocks stay.
    { at: J.device, off: [0, .7, 0], size: [1.1, .9, .8], color: 0x4a3a2c, target: J.device },
    { at: J.device, off: [0, 1.25, 0], size: [.9, .2, .6], color: 0xd9c9a0, show: d => !d.has(J.device) },
    { at: J.offer, off: [3, 1.4, -6], size: [3.2, 2.8, .08], color: 0xe8dcc0, show: d => !d.has('fire_core') },
    { at: J.offer, off: [-3, 1.4, -8], size: [3.2, 2.8, .08], color: 0xe8dcc0, show: d => !d.has('fire_core') },
    { at: J.offer, off: [0, 1.3, -11], size: [4, 2.6, .25], color: 0x6a3a2a, rot: [0, .6, 0] },
    { at: J.custody, off: [2, .6, -2], size: [1.2, 1.2, 1.2], color: 0x8a8a84 },
    { at: J.custody, off: [-6, .6, -3], size: [1.2, 1.2, 1.2], color: 0x8a8a84 },
    { at: J.latch, off: [0, 1.6, -1.5], size: [3.4, .25, .25], color: 0x2f2620, moved: { when: J.latch, off: [-1.8, 2.6, -1.5], rot: [0, 0, 1.2] } },
    { at: J.receiver, off: [1, .9, 0], size: [.5, .35, .3], color: 0x3a3f46 },
    { at: J.receiver, off: [1, 1.12, 0], size: [.4, .05, .25], color: 0x9fe0c8, show: d => d.has(J.receiver) },
  ],
  actors: [
    { id: 'j_crow_seal', role: ['鸦印 · 已被拘押', 'The Crow Seal · Detained'], coat: 0x1d1f26,
      place: d => d.has(J.j08) ? [J.custody, 2, 2] : null },
    { id: 'j_lieutenant', role: ['明智方副官', 'Akechi lieutenant'], coat: 0x5a4a6a,
      place: d => d.has(J.nobunaga) ? [J.nobunaga, 3, 3] : d.has(J.sideEntry) ? [J.sideEntry, 2, 1] : d.has(Y.private) ? [J.sideEntry, 1, -2] : null },
    { id: 'j_oda_guard', role: ['织田守兵 · 卸了弹', 'Oda guard · Unloaded'], coat: 0x6a2a2a,
      place: d => d.has(J.nobunaga) ? [J.nobunaga, -2, 2] : d.has(J.latch) ? [J.latch, -2, -3] : null },
  ],
};
