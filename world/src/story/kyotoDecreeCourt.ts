import type { FieldAction, FieldChapterContent } from './fieldChapters';
import { adventureActive } from './openWorldCampaign';
import { KYOTO_WITNESS, kyotoWitnessActive } from './kyotoWitness';
import { KYOTO_STREET } from './kyotoStreetWorks';

/** J08 无人签过的战报 and J09 开门见人: the decree court outside Honnō-ji. The old Hellfire Lord
 * becomes 鸦印 (Crow Seal), a curtain duelist; the open-the-gate sequence follows his custody. */
export const JC = {
  offer: 'j08_offer', publicEntry: 'j08_public_entry', sideEntry: 'j08_side_entry', entered: 'j08_entered',
  device: 'j08_device', custody: 'j08_custody', j08: 'j08_complete',
  latch: 'j09_latch', nobunaga: 'j09_nobunaga', walk: 'j09_walk', receiver: 'j09_receiver', j09: 'j09_complete',
} as const;
/** J03 两位发令的人 and J07 你走过的街开始燃烧. */
export const JK = {
  oda: 'j03_oda', akechi: 'j03_akechi', verify: 'j03_verify', terms: 'j03_terms', door: 'j03_oda_door', archers: 'j03_akechi_archers', j03: 'j03_complete',
  low: 'j07_low', roof: 'j07_roof', rack: 'j07_rack', musashi: 'j07_musashi', bridge: 'j07_bridge', neighbour: 'j07_neighbour', arrive: 'j07_arrive', j07: 'j07_complete',
} as const;
const J = JC, Y = KYOTO_WITNESS, K = JK, S = KYOTO_STREET;
const delivered = (d: ReadonlySet<string>) => d.has(Y.public) || d.has(Y.private);
const kyotoOpen = (d: ReadonlySet<string>) => adventureActive(d) && !d.has('fire_core') && !d.has('musashi_contract');
/** Saves already through the fire night (the J08 offer) before these chapters existed keep their route. */
export const kyotoFireNightRequired = (d: ReadonlySet<string>) => kyotoOpen(d) && delivered(d) && (d.has(K.low) || d.has(K.roof) || !d.has(J.offer));
export const kyotoLordsRequired = (d: ReadonlySet<string>) => kyotoOpen(d) && (d.has(K.oda) || d.has(K.akechi) || !d.has(Y.reel));
const before = (d: ReadonlySet<string>) => kyotoOpen(d) && delivered(d) && (d.has(K.j07) || !kyotoFireNightRequired(d));
const after = (d: ReadonlySet<string>) => adventureActive(d) && d.has('fire_core');
const a = (chapter: string, x: Omit<FieldAction, 'region' | 'chapter'>): FieldAction => ({ region: 'kyoto', chapter, gate: before, ...x });
const lords = (d: ReadonlySet<string>) => kyotoOpen(d);
const fire = (d: ReadonlySet<string>) => kyotoOpen(d) && delivered(d);
export const KYOTO_LORDS_FIRE_ACTIONS: readonly FieldAction[] = [
  a('J03', { id: K.oda, near: 'adventure_kyoto_street_temple_record', off: [4, 4], after: [S.templeRecord], gate: lords,
    label: ['本能寺侧院 · 信长承认征粮', 'Honnō-ji side yard · Nobunaga admits the levy'],
    line: ['信长承认征粮是他下的令，只否认被扩写的那部分。没有人给你“一切都是伪造”的清白证书。', 'Nobunaga admits the grain levy was his order and denies only the expanded part. Nobody hands you a certificate that it was all forged.'] }),
  a('J03', { id: K.akechi, near: 'adventure_kyoto_street_camp_record', off: [-4, 4], after: [S.campRecord], gate: lords,
    label: ['明智军阵外缘 · 光秀承认袭击', 'Akechi camp edge · Mitsuhide admits the attack'],
    line: ['光秀承认袭击是他的决定。扩写的命令不是。先到哪一方，就先拿到哪一方这次通行的口令。', 'Mitsuhide admits the attack was his decision. The expanded orders were not. Whichever side you reach first gives you its pass for this crossing first.'] }),
  a('J03', { id: K.verify, near: 'adventure_kyoto_street_temple_permit', off: [-6, 4], optional: true, gate: d => lords(d) && (d.has(S.templeAlert) || d.has(S.campAlert)),
    label: ['外院副官 · 隔着掩体核验封套', 'Outer-yard lieutenant · Verifies the envelope behind cover'],
    line: ['“你在门外开过枪。封套放在台上，人退后。”核验之后只给隔屏接触，内院不对你开放，检查站会多搜一次。', '“You fired outside this gate. Put the envelope on the stand and step back.” After checking it he allows contact through a screen only; the inner yard stays closed and checkpoints search you once more.'] }),
  a('J03', { id: K.terms, near: 'adventure_kyoto_witness_testimony', off: [4, 4], after: [K.oda, K.akechi], gate: lords,
    label: ['阿纪的条件 · 把居民的粮和出口从争夺里拿出来', 'Aki’s terms · Take the residents’ food and exits out of the fight'],
    line: ['信长同意撤令送达、外院威胁解除后交出粮仓、撤内院反击枪位、转入共同见证的偏营；光秀只撤居民通路的火线，派副官见证。', 'Nobunaga agrees that once the true withdrawal arrives and the outer-yard threat is gone he will hand over the granary, pull the inner guns and go to the shared witness camp. Mitsuhide pulls only the fire on the residents’ path and sends a lieutenant to witness.'] }),
  a('J03', { id: K.door, near: 'adventure_kyoto_street_temple_record', off: [-4, 6], after: [K.terms], gate: lords,
    label: ['侧院 · 信长先开一扇封着伤者的门', 'Side yard · Nobunaga first opens a door sealed on the wounded'],
    line: ['门开了，伤者被抬出来。约定不是空话。', 'The door opens and the wounded are carried out. The agreement is not empty.'] }),
  a('J03', { id: K.archers, near: 'adventure_kyoto_street_camp_record', off: [4, 6], after: [K.terms], gate: lords, adds: [K.j03],
    label: ['河岸 · 光秀叫回拦截民船的弓手', 'Riverbank · Mitsuhide recalls the archers blocking the boats'],
    line: ['弓手撤下，民船能走了。粮仓交接和撤枪还要等后面兑现。', 'The archers withdraw and the boats can move. The granary and the guns still have to come later.'] }),
  a('J07', { id: K.low, near: 'disc_tobiishi', off: [4, 2], kind: 'fight', alt: 'j07_route', gate: fire,
    foes: [['musketeer', ['对岸鸦印佣兵', 'Crow Seal mercenary across the river']], ['jaeger', ['对岸枪手', 'Far-bank marksman']]],
    label: ['沿河石道 · 顶着对岸交叉枪线走', 'Riverside stones · Push through the crossfire from the far bank'],
    line: ['石道低掩体多，对岸的佣兵被压下去了。', 'The stone path has plenty of low cover, and the mercenaries across the river are pinned.'] }),
  a('J07', { id: K.roof, near: 'field_kyoto_line_rooftop', off: [4, 2], kind: 'fight', alt: 'j07_route', gate: fire,
    foes: [['shinobi', ['屋顶伏兵', 'Rooftop ambusher']], ['stalker', ['拒绝撤令的印兵', 'Print-soldier refusing the order']]],
    label: ['屋顶路 · 视野好，伏兵也多', 'Rooftops · Better view, more ambushers'],
    line: ['屋顶伏兵清了。你看得见整条着火的街。', 'The rooftop ambush is cleared. You can see the whole burning street.'] }),
  a('J07', { id: K.bridge, near: 'disc_tobiishi', off: [8, 6], any: [K.low, K.roof], gate: fire,
    label: ['木桥 · 听见裂响就改走石道', 'Timber bridge · Hear it crack and take the stones'],
    line: ['裂响、落灰，木桥在你前面塌了。落点没压到人。慢一步就只能走石道。', 'A crack, falling ash, and the bridge collapses ahead of you. Nobody was under it. One step slower and it is the stone path only.'] }),
  a('J07', { id: K.neighbour, near: 'disc_kamo_paperhouse', off: [4, -4], optional: true, gate: fire,
    label: ['纸铺邻居 · 帮忙把人和店里的东西拖出来', 'The paper shop’s neighbour · Help drag people and stock out'],
    line: ['邻居的店保住了一半。他的住处还在。', 'Half of the neighbour’s shop is saved. His home still stands.'] }),
  a('J07', { id: K.rack, near: 'adventure_kyoto_street_temple_permit', off: [-12, 2], after: [K.bridge], gate: fire,
    label: ['交接架 · 插上撤令，让守兵自己决定', 'Handover rack · Post the order and let the guards decide'],
    line: ['两个守兵看完撤令，互相看了一眼，让开了。没有演讲。', 'The two guards read the order, glance at each other and step aside. No speech.'] }),
  a('J07', { id: K.musashi, near: 'disc_honnoji', off: [-12, 6], after: [K.rack], gate: fire,
    label: ['狭口 · 武藏挡住追兵', 'The narrows · Musashi holds the pursuit'],
    line: ['武藏：“这里没有值得留名的对手。够我守了。”', 'Musashi: “There is no one here worth a name. Enough for me to hold.”'] }),
  a('J07', { id: K.arrive, near: 'adventure_kyoto_street_temple_permit', off: [-4, 4], after: [K.musashi], gate: fire, adds: [K.j07],
    label: ['本能寺外院 · 把最后的撤令送到', 'Honnō-ji outer yard · Deliver the last withdrawal order'],
    line: ['撤令送到了外院。誊令庭的门就在前面。', 'The order reaches the outer yard. The decree court gate is just ahead.'] }),
];
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
export const kyotoExtraBossFlags = (d: ReadonlySet<string>) => [...(kyotoLordsRequired(d) ? [K.j03] : []), ...(kyotoFireNightRequired(d) ? [K.j07] : [])];
export const KYOTO_COURT: FieldChapterContent = {
  set: { region: 'kyoto', title: ['业火京都 · 无人签过的战报', 'Kyoto · The Report Nobody Signed'], actions: [...KYOTO_LORDS_FIRE_ACTIONS, ...KYOTO_COURT_ACTIONS] },
  props: [
    // J07: the fire night along the river street, then charred frames once the night is over.
    ...[[0, -6], [6, -4], [-6, -8], [10, 6]].map(([x, z]) => ({ at: K.bridge, off: [x, 2, z] as const, size: [3, 4, 3] as const, color: 0xff6a2a,
      show: (d: ReadonlySet<string>) => fire(d) && !d.has(K.j07) })),
    ...[[0, -6], [6, -4], [-6, -8], [10, 6]].map(([x, z]) => ({ at: K.bridge, off: [x, 1.5, z] as const, size: [2.6, 3, 2.6] as const, color: 0x2a2420,
      show: (d: ReadonlySet<string>) => d.has(K.j07) || d.has('fire_core') })),
    { at: K.bridge, off: [0, 1.2, 4], size: [2.4, .3, 8], color: 0x6e5238, moved: { when: K.bridge, off: [0, -.6, 4], rot: [.5, 0, .3] } },
    { at: K.rack, off: [1, 1, 0], size: [.9, 1.6, .2], color: 0x7a5a38 },
    { at: K.rack, off: [1, 1.3, .12], size: [.6, .8, .02], color: 0xeae0c8, show: d => d.has(K.rack) },
    { at: K.door, off: [0, 1.3, -2], size: [2, 2.6, .2], color: 0x5a3a2a, moved: { when: K.door, off: [-1.2, 1.3, -1], rot: [0, 1.3, 0] } },
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
