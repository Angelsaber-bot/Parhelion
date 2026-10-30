import type { Localized, RegionId } from './settlements/types';
import type { Layout, Marker } from './types';

/** Additive chapter logic: only existing done/found sets are persisted, never a second save schema. */
export type EraId = Exclude<RegionId, 'alpha'>;
export const ERA_IDS: readonly EraId[] = ['britain', 'blacksail', 'winter', 'kyoto'];
export interface EraStoryGuide {
  title: Localized;
  text: Localized;
  targetId: string;
  targetKind: 'npc' | 'marker';
}
export interface EraStoryState {
  region: EraId;
  stage: 'prepare' | 'challenge' | 'return' | 'complete';
  routeReady: boolean;
  /** Boss/world resolution; contract epilogues can still be the current stage. */
  complete: boolean;
  discovered: boolean;
  knightDefeated: boolean;
  /** A finished legacy core is authoritative; introductions and preparation are never replay gates. */
  legacyComplete: boolean;
}
/** The four discoveries change different systems, never a repeated generic heal. */
export type EraStoryReward =
  | { kind: 'trial'; region: 'britain'; enemyId: 'elite_oath_knight'; label: Localized }
  | { kind: 'clue'; region: 'blacksail'; targetId: string; label: Localized }
  | { kind: 'warmth'; region: 'winter'; seconds: 30 }
  | { kind: 'quiet-route'; region: 'kyoto'; position: [number, number, number]; label: Localized }
;
export const ERA_KNIGHT_DEFEATED = 'era_britain_knight_defeated';
export const KYOTO_QUIET_LEDGE: readonly [number, number, number] = [-224, 11.56, 840];
export interface EraStoryInteraction {
  handled: boolean;
  changed: boolean;
  dialogue: Localized | null;
  reward: EraStoryReward | null;
  state: EraStoryState | null;
}
interface OptionalStory {
  id: string;
  label: Localized;
  first: Localized;
  repeat: Localized;
}
export const ERA_OPTIONALS: Record<EraId, OptionalStory> = {
  britain: {
    id: 'britain_memorial', label: ['擦亮旧誓铭牌', 'Restore the oath memorial'],
    first: ['灰尘落下，旧名字重新露出来。你点亮纪念灯；碑旁刻着一句试炼箴言：避开横扫，待他收剑。', 'You brush dust from the names and relight the memorial. Beside them, a trial inscription reads: evade the sweep; strike as the sword returns.'],
    repeat: ['纪念灯照着擦亮的名字。有人还记得他们。', 'The memorial lamp falls across the cleared names. Someone still remembers them.'],
  },
  blacksail: {
    id: 'blacksail_harbor_signal', label: ['修复港口归航灯', 'Restore the harbor return signal'],
    first: ['归航灯亮起。信使铺开海图：“潮水又冲出了些旧东西。想找宝藏，就从我标的地方看起。”', 'The return signal catches. The runner unfolds a chart. “The tide has uncovered something. If it is treasure you want, start at my mark.”'],
    repeat: ['信使把海图翻到干燥的一面：“找回的地方，我都替你划掉了。”', 'The runner turns the chart to its dry side. “I have crossed off the places you already searched.”'],
  },
  winter: {
    id: 'winter_shelter_stove', label: ['点燃救护驿站炉火', 'Light the aid-post stove'],
    first: ['炉火燃起，医师递来热饮：“暖透了再走。余温能撑三十秒，趁这会儿赶到下一堆火。”', 'The stove catches. The surgeon offers a hot drink. “Warm up first. It will keep the cold off for thirty seconds; use them to reach the next fire.”'],
    repeat: ['医师往炉里添了柴：“再暖一暖。离开炉边后，仍能撑三十秒。”', 'The surgeon adds another log. “Warm up again. You will have another thirty seconds once you leave the stove.”'],
  },
  kyoto: {
    id: 'kyoto_lantern_route', label: ['点亮旅籠避火路灯', 'Light the inn escape-route lanterns'],
    first: ['你点亮遮火灯笼。老板指路：从旅籠南门出来，沿矮坡向西；不必闯进军阵，也能看见三面旗。', 'You light the hooded lanterns. The innkeeper points the way: leave by the inn’s south gate and follow the low slope west. All three banners are visible without entering the army camp.'],
    repeat: ['老板拨正灯笼：“认准南门，沿矮坡向西。那条路还安静。”', 'The innkeeper straightens a lantern. “South gate, then west along the low slope. That way is still quiet.”'],
  },
};

/** A story identifier is finite and explicit. Unknown region strings cannot select a chapter. */
export function isEraId(id: string): id is EraId { return ERA_IDS.includes(id as EraId); }

export const ERA_RESIDENTS: Record<EraId, readonly string[]> = {
  britain: ['britain_smith', 'britain_stable_keeper', 'britain_abbey_keeper'],
  blacksail: ['customs_clerk', 'customs_inspector', 'customs_runner'],
  winter: ['winter_surgeon', 'winter_quartermaster'],
  kyoto: ['kyoto_swordsmith', 'kyoto_innkeeper'],
};
const residentIntroductions: Record<EraId, Localized> = {
  britain: ['铁匠还留着出征者的旧剑，修院还守着誓火。先去圣剑湖；湖上的约定，要由圆桌的火来回应。', 'The smith keeps the departed soldiers’ swords; the abbey keeps their flame. Go to Sword Lake first. A pact made there must be answered at the Round Table hearth.'],
  blacksail: ['补给账上只剩三艘没有船员的艇。黑胡子认得它们的航路；要断冷灯的粮，就得动用要塞大炮。', 'The ledger lists three boats without crews. Blackbeard knows their course. To starve the cold lamp, you will need the fort cannon.'],
  winter: ['担架队还困在雪里。拿破仑知道烽火的位置；把三处火连起来，他们才敢继续走。', 'The stretcher party is still out in the snow. Napoleon knows the beacon sites. Light all three, and they can risk the road again.'],
  kyoto: ['旅籠收留走散的人，刀匠不愿再添一场火。先在桥上找到武藏，再破坏军阵的桔梗旗；避火路灯能帮助晚来的旅人。', 'The inn shelters those separated by the fire; the smith wants no more burning. Meet Musashi on the bridge, then break the army’s bellflower banners. Escape lanterns help late arrivals.'],
};

const residentRoles: Readonly<Record<string, Localized>> = {
  britain_smith: ['这些旧剑，一直没人来取。若经过铭牌，替我擦一擦那些名字吧。碑上也刻着失誓骑士的试炼。', 'No one has come to claim these swords. If you pass the memorial, clear the names for me. The Oathless Knight’s trial is carved there too.'],
  britain_stable_keeper: ['那一剑横扫过来，马也知道退。等他收剑，再近身——别拿骨头试刀口。', 'Even a horse knows to back away from that sweep. Close in as the sword returns. Do not test its edge with your bones.'],
  britain_abbey_keeper: ['圆桌大厅第一盏是誓火，点亮它便足够回应湖畔的约定。其余两盏只是替归来的人多留些光。', 'The first hearth in the Round Table Hall is the oath flame; that alone answers the lake pact. The other two simply leave more light for those returning.'],
  customs_clerk: ['账上有三艘艇，却连一份水手口粮都没记。它们在给冷灯运补给。找黑胡子问清航路，再去要塞炮位。', 'Three boats in the ledger, not one sailor’s ration. They are supplying the cold lamp. Ask Blackbeard about their route, then take the fort cannon.'],
  customs_inspector: ['别把子弹丢进海里。那些幽灵艇要靠重炮对付。装填要塞大炮，站稳炮位，再瞄准。', 'Save your bullets; those ghost boats need a cannon. Load the fort gun, take your place at the firing station, then aim.'],
  customs_runner: ['归航灯修好了，我才看得清浅滩。你替我点灯，我替你在海图上标出宝藏的线索，如何？', 'With the return signal lit, I can read the shoals again. You tend the light; I mark a treasure lead on your chart. Fair exchange?'],
  winter_surgeon: ['别等指头冻白了才来找我。先点驿站的炉子，暖透再走。离炉后三十秒内，尽量赶到下一堆火。', 'Do not wait until your fingers turn white. Light the post stove and warm up; you have thirty seconds of warmth to reach the next fire.'],
  winter_quartermaster: ['三座烽火，一座也不能认错。先去拿破仑的营帐问路，再沿雪原点火。担架队会循着火光走。', 'Three beacons. Make certain you have the right ones. Ask Napoleon at his tent, then light the snowfield route. The stretcher party will follow the flames.'],
  kyoto_swordsmith: ['桔梗旗一摆，军阵就往前压。把三面旗射倒，让传令的人乱一阵。能少拔一把刀，就少拔一把。', 'When the bellflower banners move, the ranks advance. Shoot down all three and break their signals. One less drawn blade is enough for me.'],
  kyoto_innkeeper: ['旅籠的路灯亮起来，我就指给你一处安静高地。从南门出来沿矮坡向西，不闯军阵也能看见三面旗。', 'Light the inn lanterns and I will show you a quiet ledge. Leave the south gate and follow the low slope west; you can see all three banners without entering the camp.'],
};

interface EraBeat { id: string; flags: readonly string[]; text: Localized; }
interface EraChapter {
  title: Localized; core: string; contract: string; npc: string;
  beats: readonly EraBeat[]; challenge: Localized; returnText: Localized;
  completeText: Localized; legacyRequires: readonly string[];
}
export const ERA_STORIES: Record<EraId, EraChapter> = {
  britain: {
    title: ['落日王国 · 守住旧誓', 'Sunset Kingdom · Keep the Oath'], core: 'sun_core', contract: 'saber_contract', npc: 'britain_smith',
    beats: [
      { id: 'oath', flags: ['saber_contract'], text: ['在圣剑湖与湖中之剑立约。', 'Make your pact with the lake sword.'] },
      { id: 'hearth', flags: ['hall_brazier_1'], text: ['点燃圆桌大厅的第一盏誓火，回应圣剑湖的约定。', 'Light the first oath hearth in the Round Table Hall to answer the Sword Lake pact.'] },
    ],
    challenge: ['到卡姆兰战场挑战空位之王，点亮落日之核。', 'Challenge the Vacant King at Camlann and relight the Sun Core.'],
    returnText: ['湖畔的契约仍在等你。', 'Your pact waits at the lake.'],
    completeText: ['卡姆兰终于安静了。若再经过王城，来看看那些旧名字；这回，你可以慢慢读。', 'Camlann is quiet at last. If you pass the kingdom again, visit the old names. This time, you can take a while to read them.'],
    legacyRequires: ['saber_contract', 'shard_camp', 'shard_tower', 'shard_table'],
  },
  blacksail: {
    title: ['黑帆尽头 · 熄灭冷灯', 'Black Sail’s End · Extinguish the Cold Lamp'], core: 'sea_core', contract: 'blackbeard_contract', npc: 'customs_clerk',
    beats: [
      { id: 'captain', flags: ['blackbeard_meet'], text: ['到拿骚酒馆找到黑胡子，确认冷灯的补给线。', 'Meet Blackbeard at Nassau tavern to identify the cold lamp’s supply line.'] },
      { id: 'cannon', flags: ['fort_cannon'], text: ['启动黑胡子要塞的炮台，站在炮位上瞄准幽灵小艇。', 'Ready the fort cannon and aim at the ghost boats from its firing station.'] },
      { id: 'boats', flags: ['ghost_boat_1', 'ghost_boat_2', 'ghost_boat_3'], text: ['在炮位击沉三艘幽灵小艇，切断冷灯补给并显露旗舰栈桥。', 'Sink all three ghost boats from the cannon station to cut the supply line and reveal the flagship bridge.'] },
    ],
    challenge: ['沿幽灵栈桥登上旗舰，击败亡航提督。', 'Cross the ghost bridge to the flagship and defeat the Drowned Admiral.'],
    returnText: ['回到拿骚酒馆，与黑胡子缔结契约。', 'Return to Nassau tavern to seal your pact with Blackbeard.'],
    completeText: ['冷灯灭了。等潮水转向，船就能回港。黑胡子若还在酒馆，你最好趁他清醒时去。', 'The cold lamp is out. Ships can return with the tide. If Blackbeard is still at the tavern, catch him while he is sober.'],
    legacyRequires: ['shard_powder', 'shard_compass', 'shard_treasure'],
  },
  winter: {
    title: ['永冬之城 · 雪中烽火', 'Winter City · Beacons in the Snow'], core: 'winter_core', contract: 'napoleon_contract', npc: 'winter_surgeon',
    beats: [
      { id: 'commander', flags: ['napoleon_meet'], text: ['在大军营地找到拿破仑，确认雪路方向。', 'Meet Napoleon in the army camp and learn the snow-road route.'] },
      { id: 'warm-road', flags: ['beacon_1', 'beacon_2', 'beacon_3'], text: ['沿雪原点燃三座烽火，在已点燃的火旁取暖，接通救护暖路。', 'Light the three snowfield beacons, warming yourself beside lit fires to connect the aid route.'] },
    ],
    challenge: ['循烽火前往红场，挑战执冬者。', 'Follow the beacons to Red Square and challenge the Winter Warden.'],
    returnText: ['回到皇帝帐篷，与拿破仑缔结契约。', 'Return to the emperor’s tent and seal your pact with Napoleon.'],
    completeText: ['红场安静下来了。把手套戴好，雪还没停；回程若看见落单的人，就陪他走到火边。', 'Red Square has fallen quiet. Keep your gloves on; it is still snowing. If you find someone alone on the road, walk with them as far as a fire.'],
    legacyRequires: ['shard_eagle', 'shard_bell', 'shard_frost'],
  },
  kyoto: {
    title: ['业火京都 · 断旗留路', 'Kyoto Ablaze · Break the Banners'], core: 'fire_core', contract: 'musashi_contract', npc: 'kyoto_innkeeper',
    beats: [
      { id: 'swordsman', flags: ['musashi_meet'], text: ['在三条大桥找到宫本武藏，确认明智军阵的位置。', 'Meet Musashi at Sanjō Bridge and locate the Akechi encampment.'] },
      { id: 'banners', flags: ['kikyo_banner_1', 'kikyo_banner_2', 'kikyo_banner_3'], text: ['射落军阵的三面桔梗旗，打断包围本能寺的号令。', 'Shoot down the three bellflower banners to break the orders encircling Honnō-ji.'] },
    ],
    challenge: ['穿过失去旗号的军阵，到本能寺挑战业火之主。', 'Pass the army’s broken signal line and challenge the Lord of Hellfire at Honnō-ji.'],
    returnText: ['回到三条大桥，与宫本武藏缔结契约。', 'Return to Sanjō Bridge and seal your pact with Musashi.'],
    completeText: ['本能寺那边总算静了。旅籠还有热茶，刀先收起来吧。桥上的约定，也记得去赴。', 'It is finally quiet toward Honnō-ji. There is tea at the inn; put your blade away for a while. Remember your promise at the bridge, too.'],
    legacyRequires: ['shard_kinkaku', 'shard_kiyomizu', 'shard_kikyo'],
  },
};

/** Shared by core markers, combat admission, and physical passage visibility/collision. */
export const ERA_BOSS_REQUIREMENTS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  ERA_IDS.map(region => [ERA_STORIES[region].core, ERA_STORIES[region].beats.flatMap(beat => [...beat.flags])]),
);
const chapterForCore = (core: string) => ERA_IDS.find(region => ERA_STORIES[region].core === core);
const all = (done: ReadonlySet<string>, flags: readonly string[]) => flags.every(flag => done.has(flag));
const coreCleared = (region: EraId, done: ReadonlySet<string>) => {
  const def = ERA_STORIES[region];
  // Britain's contract precedes its core; it must NEVER be treated as proof of victory.
  return done.has(def.core) || (region !== 'britain' && done.has(def.contract));
};
/** Post-core contracts imply cleared worlds in legacy snapshots; Britain's opening contract does not. */
export function isEraCoreCleared(core: string, done: ReadonlySet<string>): boolean | undefined {
  const region = chapterForCore(core);
  return region ? coreCleared(region, done) : undefined;
}
/** [] grandfathers old ready/finished saves without writing progress; undefined preserves unknown cores. */
export function getEraBossRequirements(core: string, done: ReadonlySet<string>): readonly string[] | undefined {
  const region = chapterForCore(core);
  if (!region) return undefined;
  const def = ERA_STORIES[region];
  return coreCleared(region, done) || all(done, def.legacyRequires) ? [] : ERA_BOSS_REQUIREMENTS[core];
}
export function getEraStoryState(region: EraId, done: ReadonlySet<string>): EraStoryState {
  const def = ERA_STORIES[region], cleared = coreCleared(region, done);
  const routeReady = all(done, getEraBossRequirements(def.core, done)!);
  const complete = cleared && (region === 'britain' || done.has(def.contract));
  return {
    region, stage: complete ? 'complete' : cleared ? 'return' : routeReady ? 'challenge' : 'prepare',
    routeReady, complete: cleared, discovered: done.has(ERA_OPTIONALS[region].id),
    knightDefeated: region === 'britain' && done.has(ERA_KNIGHT_DEFEATED),
    legacyComplete: cleared && !done.has(`era_${region}_met`),
  };
}
export function getEraStoryGuide(region: EraId, done: ReadonlySet<string>): EraStoryGuide | null {
  const def = ERA_STORIES[region], state = getEraStoryState(region, done);
  if (state.stage === 'complete') return null;
  if (state.stage === 'return') return { title: def.title, text: def.returnText, targetId: def.contract, targetKind: 'marker' };
  if (state.routeReady) return { title: def.title, text: def.challenge, targetId: def.core, targetKind: 'marker' };
  const beat = def.beats.find(b => !all(done, b.flags))!;
  return { title: def.title, text: beat.text, targetId: beat.flags.find(flag => !done.has(flag))!, targetKind: 'marker' };
}
/** Optional content is absent from required rows. Language is 0=Chinese, 1=English. */
export function getEraObjective(region: EraId, done: ReadonlySet<string>, language: 0 | 1 = 0): Layout['objective'] {
  const def = ERA_STORIES[region], state = getEraStoryState(region, done);
  const preparation = state.routeReady ? [] : def.beats.map(b => ({ id: b.id, text: b.text[language], done: [...b.flags] }));
  return { id: `era_${region}`, name: def.title[language], steps: [
    ...preparation,
    { id: 'core', text: def.challenge[language], done: coreCleared(region, done) ? [] : [def.core] },
    ...(region === 'britain' ? [] : [{ id: 'contract', text: def.returnText[language], done: [def.contract] }]),
  ] };
}
/** Apply again after progress/reset, since old-save compatibility can change requirements. */
export function applyEraMarkerRequirements(markers: Marker[], done: ReadonlySet<string>): void {
  for (const marker of markers) {
    const requires = getEraBossRequirements(marker.id, done);
    if (requires) marker.requires = [...requires];
  }
}
/** Use for BOTH Ghost_Bridge showWhen and solidWhen; unrelated doors stay untouched. */
export function getEraPieceRequirements(name: string, done: ReadonlySet<string>): readonly string[] | undefined {
  return name === 'Ghost_Bridge' || name === 'COL_Ghost_Bridge' ? getEraBossRequirements('sea_core', done) : undefined;
}
export function getEraResidentDialogue(id: string, done: ReadonlySet<string>): Localized | null {
  const region = ERA_IDS.find(r => ERA_RESIDENTS[r].includes(id));
  if (!region) return null;
  const state = getEraStoryState(region, done), def = ERA_STORIES[region];
  if (state.stage === 'complete') return def.completeText;
  if (state.stage === 'return') return def.returnText;
  if (state.routeReady) return def.challenge;
  const guide = getEraStoryGuide(region, done)!, intro = residentRoles[id] ?? residentIntroductions[region];
  return [intro[0] + '\n' + guide.text[0], intro[1] + '\n' + guide.text[1]];
}
/** Caller owns range/LOS, applying aid, save, and world refresh. */
export function interactEraStory(id: string, done: Set<string>, found?: Set<string>): EraStoryInteraction {
  const optionalRegion = ERA_IDS.find(region => ERA_OPTIONALS[region].id === id);
  const region = optionalRegion ?? ERA_IDS.find(r => ERA_RESIDENTS[r].includes(id));
  if (!region) return { handled: false, changed: false, dialogue: null, reward: null, state: null };
  let changed = false;
  let reward: EraStoryReward | null = null;
  let dialogue: Localized;
  if (optionalRegion) {
    const def = ERA_OPTIONALS[region], already = done.has(id);
    dialogue = already ? def.repeat : def.first;
    if (!already) { done.add(id); changed = true; }
    reward = getEraOptionalReward(region, done);
    if (region === 'britain' && done.has(ERA_KNIGHT_DEFEATED)) dialogue = [
      '失誓骑士的试炼已经通过，碑旁升起了护路标记。还想再试剑，就向碑前致意。',
      'The Oathless Knight’s trial is won; the road-keeper mark stands beside the stone. Salute the memorial if you wish to cross blades again.',
    ];
    if (found && !found.has(id)) { found.add(id); changed = true; }
  } else {
    const met = `era_${region}_met`;
    if (!done.has(met)) { done.add(met); changed = true; }
    dialogue = getEraResidentDialogue(id, done)!;
  }
  return { handled: true, changed, dialogue, reward, state: getEraStoryState(region, done) };
}
export function getEraOptionalReward(region: EraId, done: ReadonlySet<string>): EraStoryReward | null {
  if (!done.has(ERA_OPTIONALS[region].id)) return null;
  switch (region) {
    case 'britain': return { kind: 'trial', region, enemyId: 'elite_oath_knight', label: ['失誓骑士 · 看破横扫后反击', 'Oathless Knight · Dodge the sweep, punish recovery'] };
    case 'blacksail': {
      const targetId = ['map_piece_1', 'map_piece_2', 'map_piece_3', 'shard_treasure'].find(id => !done.has(id));
      return targetId ? { kind: 'clue', region, targetId, label: ['可选 · 信使的藏宝线索', 'Optional · The runner’s treasure clue'] } : null;
    }
    case 'winter': return { kind: 'warmth', region, seconds: 30 };
    case 'kyoto': return { kind: 'quiet-route', region, position: [...KYOTO_QUIET_LEDGE], label: ['可选 · 桔梗旗安静射击高地', 'Optional · Quiet bellflower firing ledge'] };
  }
}

/** Localized reactions after ORIGINAL marker/shot code records a flag; never records progress itself. */
export function getEraProgressReaction(id: string, done: ReadonlySet<string>): Localized | null {
  const next = (region: EraId, lead: Localized): Localized => {
    const goal = getEraStoryGuide(region, done);
    return goal ? [lead[0] + ' ' + goal.text[0], lead[1] + ' ' + goal.text[1]] : lead;
  };
  const count = (prefix: string) => [1, 2, 3].filter(i => done.has(`${prefix}_${i}`)).length;
  if (id === 'hall_brazier_1') return next('britain', ['誓火已亮；另外两盏火盆与圆桌碎片为可选。', 'The oath hearth is lit; the other hearths and Round Table shard are optional.']);
  if (id === 'hall_brazier_2' || id === 'hall_brazier_3') return [
    `圆桌修复 ${count('hall_brazier')}/3 · 可选探索。`,
    `Round Table restoration ${count('hall_brazier')}/3 · optional exploration.`,
  ];
  if (/^ghost_boat_[123]$/.test(id)) {
    const n = count('ghost_boat');
    return n === 3 ? next('blacksail', ['三艘幽灵艇已沉没，冷灯的补给被切断。', 'All three ghost boats are sunk; the cold lamp’s supply is cut.'])
      : [`幽灵小艇击沉 ${n}/3 · 留在炮位继续瞄准。`, `Ghost boats sunk ${n}/3 · Stay at the cannon station and keep aiming.`];
  }
  if (/^beacon_[123]$/.test(id)) {
    const n = count('beacon');
    return n === 3 ? next('winter', ['三座烽火相连，救护暖路已接通。', 'The three beacons connect the warm aid route.'])
      : [`暖路烽火 ${n}/3 · 在已点燃的火旁取暖，再出发。`, `Warm-route beacons ${n}/3 · Warm up beside a lit fire before setting out.`];
  }
  if (/^kikyo_banner_[123]$/.test(id)) {
    const n = count('kikyo_banner');
    return n === 3 ? next('kyoto', ['三面桔梗旗已倒下，军阵号令中断。', 'All three bellflower banners are down; the army’s signals are broken.'])
      : [`桔梗旗破坏 ${n}/3 · 继续打断军阵信号。`, `Bellflower banners destroyed ${n}/3 · Keep breaking the army’s signals.`];
  }
  const region = ERA_IDS.find(r => ERA_STORIES[r].beats.some(b => b.flags.includes(id)));
  if (region) return next(region, ['下一段路已经清楚了。', 'You know where to go next.']);
  if (ERA_IDS.some(r => ERA_STORIES[r].legacyRequires.includes(id)) && id.startsWith('shard_')) {
    return ['时层碎片已收存 · 可选探索。', 'Era shard collected · optional exploration.'];
  }
  return null;
}
