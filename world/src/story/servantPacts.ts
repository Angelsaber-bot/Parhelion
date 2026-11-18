import type { Localized } from '../settlements/types';

/**
 * Three servants who used to be "claimed" by walking up to a point now each have a contract arc of their own, shaped
 * unlike every other chapter in the game. Each opens once its region's main story is done; the contract flag keeps the
 * old claim id, so a save that already claimed one of them keeps that servant.
 *
 *  - Jeanne · Testimony under the Banner: a tribunal. Question the people of Orleans in any order, then counter each
 *    accusation at a hearing by presenting the right testimony. No fighting; a wrong card costs nothing but is noticed.
 *  - Ozymandias · Where the Sun Writes His Name: a riddle hunt with no waypoint. Three cartouche fragments lie where the
 *    riddles say; only a sense of sunlight (warmer as you near one) helps. Carve them on the oasis stele, then answer him.
 *  - Qin Shi Huang · The Edict on the Imperial Road: a timed relay. Carry the edict through five posts on the Lishan roads
 *    before the sundial shadow moves; arrive late and the edict is void, so you begin again from the post master.
 */
export type PactId = 'jeanne' | 'ozymandias' | 'qin';
export const PACT_CLAIM: Record<PactId, string> = { jeanne: 'servant_claim_jeanne', ozymandias: 'servant_claim_ozymandias', qin: 'servant_claim_qin' };
export const PACT_REGION: Record<PactId, 'orleans' | 'egypt' | 'qin'> = { jeanne: 'orleans', ozymandias: 'egypt', qin: 'qin' };
export const PACT_TITLE: Record<PactId, Localized> = {
  jeanne: ['契约 · 圣旗下的证言', 'Pact · Testimony under the Banner'],
  ozymandias: ['契约 · 太阳写下的王名', 'Pact · Where the Sun Writes His Name'],
  qin: ['契约 · 驰道传诏', 'Pact · The Edict on the Imperial Road'],
};
export const PACT_SPEAKER: Record<PactId, Localized> = { jeanne: ['贞德', 'Jeanne'], ozymandias: ['奥斯曼迪斯', 'Ozymandias'], qin: ['秦始皇', 'Qin Shi Huang'] };
/** The arc opens once its region's main story is complete (either the campaign or the journey route). */
export function pactAvailable(id: PactId, d: ReadonlySet<string>): boolean {
  if (id === 'jeanne') return d.has('orleans_campaign_complete') || d.has('journey_orleans_crossing_open');
  if (id === 'ozymandias') return d.has('egypt_campaign_complete') || d.has('journey_egypt_water_returned');
  return d.has('qin_campaign_complete') || d.has('journey_qin_public_order');
}
export const pactSealed = (id: PactId, d: ReadonlySet<string>) => d.has(PACT_CLAIM[id]);
export const pactOfClaim = (marker: string): PactId | null => (Object.keys(PACT_CLAIM) as PactId[]).find(id => PACT_CLAIM[id] === marker) ?? null;

// ───────────────────────────── Jeanne · the tribunal ─────────────────────────────
export const JEANNE = { open: 'pact_jeanne_open', miss: 'pact_jeanne_misjudged', sealed: 'pact_jeanne_sealed' } as const;
export interface Witness { id: string; npc: string; card: Localized; ask: Localized; testimony: Localized }
/** Five townspeople. Each gives one testimony card; one of them is honest but beside the point. */
export const JEANNE_WITNESSES: readonly Witness[] = [
  { id: 'warden', npc: 'orleans_bridge_warden', card: ['吉尔：梯子上的第一个人', 'Gilles: first on the ladder'],
    ask: ['问他：攻打图雷尔堡那天，旗在哪里？', 'Ask him: where was the banner the day the Tourelles fell?'],
    testimony: ['“旗在最前面。她第一个踩上梯子，一支箭从肩上穿过去，她自己拔出来，又爬上去。我就在她下面三级。”', '“At the front. She was first up the ladder; an arrow went through her shoulder, she pulled it out herself and climbed again. I was three rungs below her.”'] },
  { id: 'bell', npc: 'orleans_bell_keeper', card: ['雷米：钟在天亮时敲响', 'Remy: the bells rang at daybreak'],
    ask: ['问他：总攻是在夜里吗？', 'Ask him: was the assault at night?'],
    testimony: ['“是我敲的钟。天刚亮，全城都看得见旗子过河，谁也没藏着。夜里那团影子不是她，是从教堂那边过来的别的东西。”', '“I rang the bells myself. It was just after dawn and the whole town watched the banner cross. Nobody was hiding. Whatever came over from the cathedral at night was something else.”'] },
  { id: 'clerk', npc: 'orleans_dock_clerk', card: ['奥黛特：开战前的劝退信', 'Odette: the letter before the fighting'],
    ask: ['问她：贞德为自己要过什么吗？', 'Ask her: did Jeanne ever ask anything for herself?'],
    testimony: ['“港务簿里抄着她的信：开战前三次请对岸的人回家，信上只签她自己的名字。她要的不是城，是让人活着离开。”', '“The harbour ledger copies her letters: three times before the fighting she asked the other bank to go home, signed with nothing but her own name. She wanted people to leave alive, not the town.”'] },
  { id: 'cloth', npc: 'orleans_market_vendor', card: ['露西：旗布是城里人缝的', 'Lucie: the townswomen sewed the banner'],
    ask: ['问她：那面旗是谁给的？', 'Ask her: who gave her that banner?'],
    testimony: ['“布是我卖的，针线是城里的女人们一起动的。没有哪位大人送旗，钱是她自己数给我的。”', '“I sold the cloth, and the women of the town sewed it together. No lord sent a banner; she counted the coins out to me herself.”'] },
  { id: 'grange', npc: 'orleans_dovekeeper', card: ['马蒂厄：夜里的影子烧了谷仓', 'Mathieu: a shadow burned the barn at night'],
    ask: ['问他：那一夜你看见了什么？', 'Ask him: what did you see that night?'],
    testimony: ['“没有雷声。一片影子从教堂那边过来，谷仓就着了。我不知道那是什么，可我知道那不是一个拿旗的姑娘。”', '“No thunder. A shadow came over from the cathedral and the barn caught fire. I do not know what it was, but I know it was not a girl with a banner.”'] },
];
export const JEANNE_HEARD = (w: Witness) => `pact_jeanne_heard_${w.id}`;
export interface Accusation { round: string; claim: Localized; answer: string; rebuttal: Localized }
/** The three accusations of the record-keepers, each answered by exactly one testimony. */
export const JEANNE_ACCUSATIONS: readonly Accusation[] = [
  { round: 'pact_jeanne_round_1', answer: 'warden',
    claim: ['记录官：“所谓持旗人只在后方祈祷，仗是别人打的。”', 'Record-keeper: “This so-called standard-bearer prayed at the rear while others fought.”'],
    rebuttal: ['你出示吉尔的证言。记录官翻了两页，划掉了“后方”两个字。', 'You present Gilles’s testimony. The record-keeper turns two pages and strikes out “at the rear”.'] },
  { round: 'pact_jeanne_round_2', answer: 'bell',
    claim: ['记录官：“城是在夜里靠不明的影子攻下的，此乃妖术。”', 'Record-keeper: “The town fell at night to a nameless shadow. That is witchcraft.”'],
    rebuttal: ['你出示雷米的证言：钟在天亮时响，全城都看着旗过河。夜里的影子另有来处。', 'You present Remy’s testimony: the bells rang at daybreak and the whole town saw the banner cross. The night shadow came from elsewhere.'] },
  { round: 'pact_jeanne_round_3', answer: 'clerk',
    claim: ['记录官：“她借神之名，为自己夺取权柄。”', 'Record-keeper: “She took power for herself in a borrowed holy name.”'],
    rebuttal: ['你出示奥黛特抄下的信：三次劝对岸回家，只署自己的名字。记录官合上了簿子。', 'You present the letters Odette copied: three times she asked them to go home, signed only with her own name. The record-keeper closes the book.'] },
];
export const jeanneHeard = (d: ReadonlySet<string>) => JEANNE_WITNESSES.filter(w => d.has(JEANNE_HEARD(w)));
/** The hearing convenes once four of the five have been heard (any four). */
export const jeanneHearingReady = (d: ReadonlySet<string>) => d.has(JEANNE.open) && jeanneHeard(d).length >= 4;
export const jeanneNextRound = (d: ReadonlySet<string>) => JEANNE_ACCUSATIONS.find(a => !d.has(a.round)) ?? null;
/** Presenting a card: true when it answers the current accusation (the round is won); a wrong card is only noted. */
export function jeannePresent(card: string, d: Set<string>): 'won' | 'wrong' | 'unheard' | 'closed' {
  const round = jeanneNextRound(d);
  if (!round || !jeanneHearingReady(d)) return 'closed';
  const witness = JEANNE_WITNESSES.find(w => w.id === card);
  if (!witness || !d.has(JEANNE_HEARD(witness))) return 'unheard';
  if (card !== round.answer) { d.add(JEANNE.miss); return 'wrong'; }
  d.add(round.round); return 'won';
}

// ───────────────────────────── Ozymandias · the riddle hunt ─────────────────────────────
export const OZY = { open: 'pact_ozy_open', carved: 'pact_ozy_carved', knelt: 'pact_ozy_knelt', stood: 'pact_ozy_stood', sealed: 'pact_ozy_sealed' } as const;
export interface Fragment { id: string; flag: string; near: string; off: readonly [number, number]; riddle: Localized; found: Localized }
/** Placed beside a resident who already stands on the spot the riddle describes, so the ground is known good. */
export const OZY_FRAGMENTS: readonly Fragment[] = [
  { id: 'colossi', flag: 'pact_ozy_frag_colossi', near: 'egypt_scribe', off: [2.6, 1.4],
    riddle: ['“石头的巨人守着庭院，书吏在他们脚下记账。”', '“Giants of stone keep the court, and a scribe keeps accounts at their feet.”'],
    found: ['巨像脚边的石缝里嵌着一块刻着鹰与太阳的残片。', 'In a crack at the colossus’s foot sits a fragment carved with a falcon and a sun.'] },
  { id: 'tombs', flag: 'pact_ozy_frag_tombs', near: 'egypt_tomb_mason', off: [-2.4, 1.8],
    riddle: ['“死者住在崖壁里，活着的石匠还在给他们开门。”', '“The dead live in the cliff, and a living mason still cuts their doors.”'],
    found: ['崖墓门槛下压着第二块残片，上面是“玛阿特”的羽毛。', 'Under a tomb threshold lies the second fragment, bearing Maat’s feather.'] },
  { id: 'lake', flag: 'pact_ozy_frag_lake', near: 'egypt_lake_priest', off: [2.2, -2.2],
    riddle: ['“水在那里把天空再写一遍，祭司在水边净手。”', '“There the water writes the sky a second time, and a priest washes his hands at its edge.”'],
    found: ['圣湖的石阶上，第三块残片被水磨得发亮：拉神的日盘。', 'On the sacred lake’s steps the third fragment shines, worn by water: the sun disc of Ra.'] },
];
export const ozyFound = (d: ReadonlySet<string>) => OZY_FRAGMENTS.filter(f => d.has(f.flag));
/** Warmth of the solar sense, 0 (cold) to 1 (on the spot): starts at 160 m, sharpens close in. */
export function ozyWarmth(distance: number): number {
  if (!Number.isFinite(distance) || distance >= 160) return 0;
  return Math.min(1, Math.pow(1 - distance / 160, 1.6));
}
export const OZY_CARVE_SECONDS = 6;

// ───────────────────────────── Qin · the timed relay ─────────────────────────────
export const QIN_PACT = { open: 'pact_qin_open', delivered: 'pact_qin_delivered', sealed: 'pact_qin_sealed' } as const;
/** Start at the Lishan post master, pass five posts in order, hand the edict back to Qin at the relay. */
export const QIN_RELAY_START = 'qin_post_master';
export const QIN_RELAY_POSTS: readonly { npc: string; name: Localized }[] = [
  { npc: 'qin_bronzesmith', name: ['铸造棚', 'Foundry shed'] },
  { npc: 'qin_pass_officer', name: ['骊水关', 'Li River pass'] },
  { npc: 'qin_water_keeper', name: ['输水渠', 'Aqueduct'] },
  { npc: 'qin_quarryman', name: ['南坡石料场', 'South-slope quarry'] },
  { npc: 'qin_potter', name: ['龙窑', 'Dragon kilns'] },
];
export const QIN_RELAY_SECONDS = 100;
export const QIN_POST_RADIUS = 4.5;
export interface RelayRun { started: number; next: number; finished: boolean; failed: boolean }
/** Pure relay step: pass the next post when within its radius; time runs out at QIN_RELAY_SECONDS. */
export function stepRelay(run: RelayRun, now: number, distanceToNext: number, distanceToEnd: number): RelayRun {
  if (run.finished || run.failed) return run;
  if (now - run.started > QIN_RELAY_SECONDS) return { ...run, failed: true };
  if (run.next < QIN_RELAY_POSTS.length) return distanceToNext <= QIN_POST_RADIUS ? { ...run, next: run.next + 1 } : run;
  return distanceToEnd <= QIN_POST_RADIUS ? { ...run, finished: true } : run;
}

// ───────────────────────────── shared guide text ─────────────────────────────
export interface PactStep { text: Localized; target: string | null }
/** What the journal shows next for an arc, and which marker or resident it points at (null: find it yourself). */
export function pactStep(id: PactId, d: ReadonlySet<string>): PactStep | null {
  if (pactSealed(id, d)) return null;
  const claim = PACT_CLAIM[id];
  if (!pactAvailable(id, d)) return { text: id === 'jeanne' ? ['先完成奥尔良的主线，贞德才会在守城集市等你。', 'Finish the Orleans main story first; then Jeanne waits at the Defenders Market.'] : id === 'ozymandias' ? ['先让古埃及的河水重新流动，奥斯曼迪斯才会在商队绿洲召见你。', 'Restore the waters of Solar Egypt first; then Ozymandias summons you at the Caravan Oasis.'] : ['先完成秦地的主线，始皇帝才会在骊山驿等你。', 'Finish the Qin main story first; then the First Emperor waits at the Lishan relay.'], target: null };
  if (id === 'jeanne') {
    if (!d.has(JEANNE.open)) return { text: ['到守城集市见贞德。', 'Meet Jeanne at the Defenders Market.'], target: claim };
    if (!jeanneHearingReady(d)) { const next = JEANNE_WITNESSES.find(w => !d.has(JEANNE_HEARD(w)))!; return { text: [`询问城里的证人（${jeanneHeard(d).length}/5，听够 4 位即可开庭）。顺序随你。`, `Question the witnesses of Orleans (${jeanneHeard(d).length}/5; four are enough to open the hearing). In any order.`], target: next.npc }; }
    return { text: ['回到守城集市开庭：针对每条指控，出示能驳倒它的证言。', 'Return to the Defenders Market for the hearing: answer each accusation with the testimony that refutes it.'], target: claim };
  }
  if (id === 'ozymandias') {
    if (!d.has(OZY.open)) return { text: ['到商队绿洲觐见奥斯曼迪斯。', 'Attend Ozymandias at the Caravan Oasis.'], target: claim };
    const missing = OZY_FRAGMENTS.filter(f => !d.has(f.flag));
    if (missing.length) return { text: [`寻找王名残片（${3 - missing.length}/3）。没有标记，只有谜语和日轮感应：${missing.map(f => f.riddle[0]).join(' ')}`, `Find the cartouche fragments (${3 - missing.length}/3). No markers, only riddles and the sense of sunlight: ${missing.map(f => f.riddle[1]).join(' ')}`], target: null };
    return { text: ['回到绿洲的石碑，把三块残片刻成完整的王名。', 'Return to the oasis stele and carve the three fragments into one name.'], target: claim };
  }
  if (!d.has(QIN_PACT.open)) return { text: ['到骊山驿见始皇帝。', 'Meet the First Emperor at the Lishan relay.'], target: claim };
  if (!d.has(QIN_PACT.delivered)) return { text: [`在骊山驿丞处接诏，${QIN_RELAY_SECONDS} 秒内依次经过五座驿站，再回到始皇帝面前。`, `Take the edict from the Lishan post master, pass the five posts in order within ${QIN_RELAY_SECONDS} seconds, and return to the First Emperor.`], target: QIN_RELAY_START };
  return { text: ['把盖满驿印的诏书呈给始皇帝。', 'Present the fully stamped edict to the First Emperor.'], target: claim };
}
