/**
 * 幻日探索层 (Sunward Exploration) — authored data + pure rules.
 *
 * Everything here is world-space and free of three.js so it can be unit-tested.
 * Progress uses ordinary WorldProgress flags with the `xp_` prefix.
 */
import type { Localized, RegionId } from '../settlements/types';
import type { EnemyRole } from '../enemyRoles';
import { ALPHA_STATUES, ALPHA_PUZZLES, ALPHA_TRIALS, ALPHA_CAMPS, ALPHA_DOMAINS, ALPHA_CHESTS, ALPHA_FEATHERS } from './content/alpha';
import { BLACKSAIL_STATUES, BLACKSAIL_PUZZLES, BLACKSAIL_TRIALS, BLACKSAIL_CAMPS, BLACKSAIL_DOMAINS, BLACKSAIL_CHESTS, BLACKSAIL_FEATHERS } from './content/blacksail';
import { WINTER_STATUES, WINTER_PUZZLES, WINTER_TRIALS, WINTER_CAMPS, WINTER_DOMAINS, WINTER_CHESTS, WINTER_FEATHERS } from './content/winter';
import { DUELS, DUEL_CHESTS, EMBER_ROUTES, FOXFIRES, REGIONAL_CHESTS, SIGNALS, TREASURE_MAPS, flagDig, flagEmber, flagFox, flagSignal } from './regional';
import { MINIBOSSES } from '../minibosses';
import { KYOTO_STATUES, KYOTO_PUZZLES, KYOTO_TRIALS, KYOTO_CAMPS, KYOTO_DOMAINS, KYOTO_CHESTS, KYOTO_FEATHERS } from './content/kyoto';

export type XZ = readonly [number, number];
export type ChestTier = 'common' | 'exquisite' | 'precious' | 'luxurious';

export interface ChestDef { readonly id: string; readonly region: RegionId; readonly p: XZ; readonly tier: ChestTier; readonly yaw?: number; readonly requires?: string; /** hidden underground until `requires` is met (treasure maps) */ readonly buried?: boolean }
export interface FeatherDef { readonly id: string; readonly region: RegionId; readonly p: XZ; /** absolute height when floating in the air */ readonly y?: number; readonly lift?: number }
export interface StatueDef { readonly id: string; readonly region: RegionId; readonly p: XZ; readonly yaw: number; readonly title: Localized }
export interface PrismDef { readonly p: XZ; readonly start: number; /** builds a ruined tower of this height under the prism */ readonly raise?: number }
export interface PrismPuzzleDef {
  readonly id: string; readonly region: RegionId; readonly title: Localized; readonly range: number;
  readonly source: { readonly p: XZ; readonly dir: number };
  readonly prisms: readonly PrismDef[];
  readonly receiver: XZ;
  readonly blockers: readonly { readonly p: XZ; readonly r: number; readonly h: number }[];
  readonly hint: Localized;
}
export interface TrialOrb { readonly p: XZ; /** absolute height; omitted = ground + 1.3 */ readonly y?: number }
export interface TrialDef { readonly id: string; readonly region: RegionId; readonly title: Localized; readonly stele: XZ; readonly seconds: number; readonly orbs: readonly TrialOrb[]; readonly hint: Localized }
/** `echo-warden` turns a domain's last actor into a two-phase boss (264 HP, thrust → sweep → burst). */
export interface CampActor { readonly role: EnemyRole; readonly offset: readonly [number, number]; readonly title?: Localized; readonly pattern?: 'echo-warden' }
export interface CampDef { readonly id: string; readonly region: RegionId; readonly title: Localized; readonly anchor: XZ; readonly waves: readonly (readonly CampActor[])[]; readonly requires?: string; readonly style?: 'camp' | 'domain' | 'duel' }
/** 秘境：a walled ruin that chains a prism seal, a gated multi-wave fight and a luxurious chest. */
export interface DomainDef { readonly id: string; readonly region: RegionId; readonly title: Localized; readonly center: XZ; readonly radius: number; readonly story: Localized }

export const XP_PREFIX = 'xp_';
export const flagChest = (id: string) => `xp_chest_${id}`;
export const flagFeather = (id: string) => `xp_feather_${id}`;
export const flagPuzzle = (id: string) => `xp_puzzle_${id}`;
export const flagTrial = (id: string) => `xp_trial_${id}`;
export const flagCamp = (id: string) => `xp_camp_${id}`;
export const flagGlide = (level: number) => `xp_glide_${level}`;
/** First defeat of a roaming elite: a one-time bounty, counted toward the region's exploration. */
export const flagElite = (id: string) => `xp_elite_${id}`;
export const ELITE_BOUNTY = Object.freeze({ crystals: 15, rounds: 30 });
export const eliteInRegion = (region: RegionId) => MINIBOSSES.filter(m => m.region === region);
export const markerChest = (id: string) => `xpm_chest_${id}`;
export const markerPrism = (puzzle: string, index: number) => `xpm_prism_${puzzle}_${index}`;
export const markerStele = (id: string) => `xpm_stele_${id}`;
export const markerStatue = (id: string) => `xpm_statue_${id}`;
/** Story-encounter ids accepted by StoryEncounterDirector: sunward_<camp>_<wave>. */
export const campEncounterId = (camp: string, wave: number) => `sunward_${camp}_${wave}`;
export function parseCampEncounter(id: string): { camp: string; wave: number } | null {
  const m = /^sunward_([a-z0-9_]+)_(\d)$/.exec(id); return m ? { camp: m[1], wave: Number(m[2]) } : null;
}

export const CHEST_CRYSTALS: Record<ChestTier, number> = { common: 2, exquisite: 5, precious: 10, luxurious: 20 };
export const CHEST_NAMES: Record<ChestTier, Localized> = {
  common: ['普通的宝箱', 'Common Chest'], exquisite: ['精致的宝箱', 'Exquisite Chest'],
  precious: ['珍贵的宝箱', 'Precious Chest'], luxurious: ['华丽的宝箱', 'Luxurious Chest'],
};
export const GLIDE = { feathersPerLevel: 3, maxLevel: 10, speedPerLevel: .05, sinkPerLevel: .055 } as const;
export const REGION_NAMES: Partial<Record<RegionId, Localized>> = {
  alpha: ['幻日谷', 'Parhelion Valley'], britain: ['落日王国', 'Sunset Kingdom'], blacksail: ['黑帆尽头', "Black Sail's End"],
  winter: ['永冬之城', 'City of Eternal Winter'], kyoto: ['业火京都', 'Hellfire Kyoto'],
};

// ─────────────────────────── 落日王国 (Britain, world offset −720, 0) ───────────────────────────
const BRITAIN_STATUES: readonly StatueDef[] = [
  { id: 'britain', region: 'britain', p: [-414, -8], yaw: Math.PI, title: ['日晕石像 · 落日王国', 'Halo Statue · Sunset Kingdom'] },
];

const BRITAIN_PUZZLES: readonly PrismPuzzleDef[] = [
  {
    id: 'mistwood', region: 'britain', title: ['骑道折光', "Light on the Knights' Road"], range: 30,
    source: { p: [-562, -154], dir: 0 },
    prisms: [{ p: [-542, -154], start: 6 }, { p: [-542, -130], start: 0 }],
    receiver: [-562, -130], blockers: [],
    hint: ['转动棱镜柱，让日光一路折到接收晶上。', 'Turn the prism pylons until sunlight reaches the receiver.'],
  },
  {
    id: 'swordlake', region: 'britain', title: ['湖畔折光', 'Lakeside Refraction'], range: 30,
    source: { p: [-597, 68], dir: 4 },
    prisms: [{ p: [-617, 68], start: 6 }, { p: [-637, 88], start: 5 }, { p: [-617, 108], start: 4 }],
    receiver: [-597, 108], blockers: [],
    hint: ['湖心石台上还有一座棱镜柱：踩着踏石过去。', 'One pylon stands on the lake platform: cross on the stepping stones.'],
  },
  {
    id: 'camelot', region: 'britain', title: ['王城折光', 'Refraction Below Camelot'], range: 45,
    source: { p: [-756, -276], dir: 4 },
    prisms: [{ p: [-786, -276], start: 0 }, { p: [-786, -236], start: 4, raise: 10 }, { p: [-766, -216], start: 6 }, { p: [-766, -196], start: 3 }],
    receiver: [-746, -216], blockers: [{ p: [-756, -216], r: 1.3, h: 6 }],
    hint: ['断塔上的棱镜只能从王城高台滑翔过去；石柱会挡住光线。', 'Glide from the Camelot plateau to the ruined tower; the stone pillar blocks light.'],
  },
  {
    id: 'oath_cloister', region: 'britain', title: ['誓约回廊 · 折光封印', 'Oath Cloister · Light Seal'], range: 20,
    source: { p: [-864, 34], dir: 2 },
    prisms: [{ p: [-864, 48], start: 6 }, { p: [-850, 20], start: 0 }, { p: [-850, 48], start: 2 }, { p: [-836, 34], start: 1 }],
    receiver: [-864, 20], blockers: [{ p: [-850, 34], r: 2.6, h: 6 }],
    hint: ['光要绕过中央的剑碑，沿回廊走一整圈。', 'The light must circle the sword monument along the whole cloister.'],
  },
];

const BRITAIN_TRIALS: readonly TrialDef[] = [

  {
    id: 'camelot_glide', region: 'britain', title: ['王城滑翔', 'Camelot Glide'], stele: [-880, -128], seconds: 24,
    orbs: [{ p: [-872, -114], y: 31.5 }, { p: [-863, -98], y: 27 }, { p: [-853, -82], y: 22.5 }, { p: [-843, -66], y: 18 }, { p: [-833, -50], y: 13 }, { p: [-823, -34], y: 8.2 }, { p: [-813, -18] }],
    hint: ['从高台边缘跳下，空中按跳跃展开滑翔翼，穿过光圈。', 'Leap off the plateau edge, open the glider in mid-air and fly through the rings.'],
  },
];

const shade: Localized = ['雾中幽影', 'Mist Shade'], knight: Localized = ['叛誓骑士', 'Oathbreaker Knight'], wraith: Localized = ['卡姆兰亡骑', 'Camlann Wraith'];
const BRITAIN_CAMPS: readonly CampDef[] = [
  { id: 'mistcamp', region: 'britain', title: ['幽影营地', 'Shade Encampment'], anchor: [-550, -88], waves: [
    [{ role: 'stalker', offset: [5, 4], title: shade }, { role: 'stalker', offset: [-5, 4], title: shade }, { role: 'bombardier', offset: [0, -7], title: ['幽影投射者', 'Shade Caster'] }],
    [{ role: 'duelist', offset: [6, -3], title: ['幽影剑士', 'Shade Duelist'] }, { role: 'breaker', offset: [-6, -3], title: ['幽影重卫', 'Shade Bulwark'] }],
  ] },
  { id: 'hillfort', region: 'britain', title: ['叛骑哨站', 'Oathbreaker Outpost'], anchor: [-666, -291], waves: [
    [{ role: 'lancer', offset: [6, 3], title: knight }, { role: 'duelist', offset: [-6, 3], title: knight }, { role: 'bombardier', offset: [0, -7], title: ['叛誓弩手', 'Oathbreaker Crossbow'] }],
    [{ role: 'breaker', offset: [0, 6], title: ['叛誓队长', 'Oathbreaker Captain'] }, { role: 'lancer', offset: [6, -4], title: knight }, { role: 'duelist', offset: [-6, -4], title: knight }],
  ] },
  { id: 'camlann', region: 'britain', title: ['断矛阵', 'Broken Spear Line'], anchor: [-800, 234], waves: [
    [{ role: 'stalker', offset: [6, 2], title: wraith }, { role: 'lancer', offset: [-6, 2], title: wraith }, { role: 'bombardier', offset: [0, -7], title: ['亡骑号手', 'Wraith Herald'] }],
    [{ role: 'breaker', offset: [5, 5], title: ['亡骑重甲', 'Wraith Juggernaut'] }, { role: 'duelist', offset: [-5, 5], title: wraith }, { role: 'breaker', offset: [0, -7], title: ['亡骑重甲', 'Wraith Juggernaut'] }],
  ] },
  { id: 'oath_cloister', region: 'britain', title: ['誓约回廊', 'Oath Cloister'], anchor: [-850, 34], requires: flagPuzzle('oath_cloister'), style: 'domain', waves: [
    [{ role: 'stalker', offset: [6, -4], title: ['誓约残影', 'Oath Echo'] }, { role: 'lancer', offset: [-6, -4], title: ['誓约残影', 'Oath Echo'] }, { role: 'bombardier', offset: [0, -7], title: ['残影术士', 'Echo Caster'] }],
    [{ role: 'duelist', offset: [7, 3], title: ['回廊剑卫', 'Cloister Blade'] }, { role: 'breaker', offset: [-7, 3], title: ['回廊重卫', 'Cloister Bulwark'] }, { role: 'lancer', offset: [0, -7], title: ['回廊枪卫', 'Cloister Lance'] }],
    [{ role: 'breaker', offset: [0, -6.5], title: ['湖之守誓者', 'Oathkeeper of the Lake'], pattern: 'echo-warden' }, { role: 'duelist', offset: [6.5, 2], title: ['守誓近卫', 'Oath Guard'] }, { role: 'duelist', offset: [-6.5, 2], title: ['守誓近卫', 'Oath Guard'] }],
  ] },
];

const b = (id: string, p: XZ, tier: ChestTier, extra: Partial<ChestDef> = {}): ChestDef => ({ id: `britain_${id}`, region: 'britain', p, tier, ...extra });
const BRITAIN_DOMAINS: readonly DomainDef[] = [
  { id: 'oath_cloister', region: 'britain', title: ['秘境 · 誓约回廊', 'Domain · Oath Cloister'], center: [-850, 34], radius: 19,
    story: ['圆桌骑士在这里立下最初的誓言。被折射的落日让誓言化作了守卫——把光送回原处，再击败守誓者。', 'The Round Table swore its first oath here. The refracted sunset turned that oath into guardians: return the light, then defeat the Oathkeeper.'] },
];

const BRITAIN_CHESTS: readonly ChestDef[] = [
  // reward chests for authored challenges
  b('puzzle_mistwood', [-568, -124], 'precious', { requires: flagPuzzle('mistwood'), yaw: Math.PI }),
  b('puzzle_swordlake', [-603, 118], 'precious', { requires: flagPuzzle('swordlake'), yaw: -Math.PI / 2 }),
  b('puzzle_camelot', [-740, -206], 'luxurious', { requires: flagPuzzle('camelot'), yaw: -Math.PI / 2 }),
  b('trial_camelot_glide', [-808, -12], 'exquisite', { requires: flagTrial('camelot_glide') }),
  b('camp_mistcamp', [-550, -88], 'precious', { requires: flagCamp('mistcamp') }),
  b('camp_hillfort', [-666, -291], 'precious', { requires: flagCamp('hillfort') }),
  b('camp_camlann', [-800, 234], 'precious', { requires: flagCamp('camlann') }),
  b('domain_oath_cloister', [-850, 43], 'luxurious', { requires: flagCamp('oath_cloister') }),
  // free-standing exploration chests
  b('shrine', [-470, -20], 'common'), b('mist_glade', [-560, 10], 'common'), b('mist_rock', [-520, -120], 'exquisite'),
  b('north_shore', [-670, 7], 'common'), b('west_shore', [-768, 90], 'exquisite'), b('lake_platform', [-636, 89.5], 'common', { yaw: Math.PI }),
  b('ridge', [-760, -56], 'common'), b('knights_path', [-656, -158], 'common'), b('north_hill', [-718, -277], 'exquisite'),
  b('west_field', [-972, 48], 'common'), b('west_ruin', [-1000, -60], 'exquisite'), b('camlann_road', [-864, 104], 'common'),
  b('camlann_hollow', [-931, 266], 'common'), b('south_fen', [-470, 226], 'common'), b('southeast', [-514, 206], 'exquisite'),
  b('tower_top', [-787.6, -237.6], 'exquisite', { yaw: Math.PI / 4 }),
];

const f = (id: string, p: XZ, extra: Partial<FeatherDef> = {}): FeatherDef => ({ id: `britain_${id}`, region: 'britain', p, ...extra });
const BRITAIN_FEATHERS: readonly FeatherDef[] = [
  f('statue', [-423, -2]), f('lake_platform', [-638, 86.5], { lift: 2.4 }), f('ruin_tower', [-784.5, -234.5], { lift: 2.2 }),
  f('keep_top', [-872, -210], { y: 63.4 }), f('glide_path', [-846, -60], { y: 21 }), f('hillfort', [-640, -258]),
  f('southeast_peak', [-400, 274]), f('camlann_hill', [-896, 242]), f('knights', [-560, -205]), f('west_field', [-984, 30]),
];

// every region's authored content, Britain first
export const STATUES: readonly StatueDef[] = [...BRITAIN_STATUES, ...ALPHA_STATUES, ...BLACKSAIL_STATUES, ...WINTER_STATUES, ...KYOTO_STATUES];
export const PUZZLES: readonly PrismPuzzleDef[] = [...BRITAIN_PUZZLES, ...ALPHA_PUZZLES, ...BLACKSAIL_PUZZLES, ...WINTER_PUZZLES, ...KYOTO_PUZZLES];
export const TRIALS: readonly TrialDef[] = [...BRITAIN_TRIALS, ...ALPHA_TRIALS, ...BLACKSAIL_TRIALS, ...WINTER_TRIALS, ...KYOTO_TRIALS];
export const CAMPS: readonly CampDef[] = [...BRITAIN_CAMPS, ...ALPHA_CAMPS, ...BLACKSAIL_CAMPS, ...WINTER_CAMPS, ...KYOTO_CAMPS, ...DUELS];
export const DOMAINS: readonly DomainDef[] = [...BRITAIN_DOMAINS, ...ALPHA_DOMAINS, ...BLACKSAIL_DOMAINS, ...WINTER_DOMAINS, ...KYOTO_DOMAINS];
export const CHESTS: readonly ChestDef[] = [...BRITAIN_CHESTS, ...ALPHA_CHESTS, ...BLACKSAIL_CHESTS, ...WINTER_CHESTS, ...KYOTO_CHESTS, ...REGIONAL_CHESTS, ...DUEL_CHESTS];
export const FEATHERS: readonly FeatherDef[] = [...BRITAIN_FEATHERS, ...ALPHA_FEATHERS, ...BLACKSAIL_FEATHERS, ...WINTER_FEATHERS, ...KYOTO_FEATHERS];

// ─────────────────────────────────────── pure rules ───────────────────────────────────────
export const dirVec = (k: number): [number, number] => { const a = ((k % 8) + 8) % 8 * Math.PI / 4; return [Math.round(Math.cos(a) * 1e6) / 1e6, Math.round(Math.sin(a) * 1e6) / 1e6]; };
export const PRISM_HIT = 1.05, RECEIVER_HIT = 1.1;
export type BeamNode = { kind: 'source' | 'prism' | 'receiver' | 'blocker' | 'open'; index: number; p: XZ };
export interface BeamTrace { nodes: BeamNode[]; solved: boolean; lit: Set<number> }
/** 2D bearing trace. A prism re-emits the beam along its own facing (8 directions, 45° steps). */
export function traceBeam(def: PrismPuzzleDef, orient: readonly number[]): BeamTrace {
  const nodes: BeamNode[] = [{ kind: 'source', index: -1, p: def.source.p }], lit = new Set<number>();
  let at: XZ = def.source.p, dir = def.source.dir, from = -1;
  for (let step = 0; step < 12; step++) {
    const [dx, dz] = dirVec(dir);
    let best: BeamNode | null = null, bestAlong = def.range;
    const consider = (kind: BeamNode['kind'], index: number, p: XZ, radius: number) => {
      const rx = p[0] - at[0], rz = p[1] - at[1], along = rx * dx + rz * dz;
      if (along <= .5 || along > bestAlong) return;
      if (Math.abs(rx * dz - rz * dx) > radius) return;
      bestAlong = along; best = { kind, index, p: kind === 'blocker' ? [at[0] + dx * along, at[1] + dz * along] : p };
    };
    def.prisms.forEach((prism, i) => { if (i !== from) consider('prism', i, prism.p, PRISM_HIT); });
    consider('receiver', -1, def.receiver, RECEIVER_HIT);
    def.blockers.forEach((blocker, i) => consider('blocker', i, blocker.p, blocker.r));
    const hit = best as BeamNode | null;
    if (!hit) { nodes.push({ kind: 'open', index: -1, p: [at[0] + dx * def.range, at[1] + dz * def.range] }); break; }
    nodes.push(hit);
    if (hit.kind === 'receiver') return { nodes, solved: true, lit };
    if (hit.kind !== 'prism' || lit.has(hit.index)) break;
    lit.add(hit.index); at = def.prisms[hit.index].p; dir = orient[hit.index]; from = hit.index;
  }
  return { nodes, solved: false, lit };
}
/** Every orientation combination that solves the puzzle (≤ 8^4 checks). */
export function solvePuzzle(def: PrismPuzzleDef): number[][] {
  const n = def.prisms.length, out: number[][] = [], o = new Array(n).fill(0);
  const total = 8 ** n;
  for (let c = 0; c < total; c++) {
    let v = c; for (let i = 0; i < n; i++) { o[i] = v % 8; v = Math.floor(v / 8); }
    if (traceBeam(def, o).solved) out.push([...o]);
  }
  return out;
}

export interface RegionExploration { region: RegionId; total: number; done: number; percent: number; crystals: number }
export function regionItems(region: RegionId): string[] {
  return [
    ...CHESTS.filter(c => c.region === region).map(c => flagChest(c.id)),
    ...FEATHERS.filter(x => x.region === region).map(x => flagFeather(x.id)),
    ...PUZZLES.filter(x => x.region === region).map(x => flagPuzzle(x.id)),
    ...TRIALS.filter(x => x.region === region).map(x => flagTrial(x.id)),
    ...CAMPS.filter(x => x.region === region).map(x => flagCamp(x.id)),
    ...TREASURE_MAPS.filter(x => x.region === region).map(x => flagDig(x.id)),
    ...EMBER_ROUTES.filter(x => x.region === region).map(x => flagEmber(x.id)),
    ...FOXFIRES.filter(x => x.region === region).map(x => flagFox(x.id)),
    ...SIGNALS.filter(x => x.region === region).map(x => flagSignal(x.id)),
    ...eliteInRegion(region).map(m => flagElite(m.id)),
  ];
}
export function regionExploration(region: RegionId, done: ReadonlySet<string>): RegionExploration {
  const items = regionItems(region), finished = items.filter(id => done.has(id)).length;
  const crystals = CHESTS.filter(c => c.region === region && done.has(flagChest(c.id))).reduce((sum, c) => sum + CHEST_CRYSTALS[c.tier], 0)
    + eliteInRegion(region).filter(m => done.has(flagElite(m.id))).length * ELITE_BOUNTY.crystals;
  return { region, total: items.length, done: finished, percent: items.length ? Math.floor(finished / items.length * 100) : 0, crystals };
}
export function totalCrystals(done: ReadonlySet<string>) {
  return CHESTS.filter(c => done.has(flagChest(c.id))).reduce((sum, c) => sum + CHEST_CRYSTALS[c.tier], 0)
    + MINIBOSSES.filter(m => done.has(flagElite(m.id))).length * ELITE_BOUNTY.crystals;
}
export function feathersHeld(done: ReadonlySet<string>) { return FEATHERS.filter(x => done.has(flagFeather(x.id))).length; }
export function glideLevel(done: ReadonlySet<string>) { let level = 0; while (level < GLIDE.maxLevel && done.has(flagGlide(level + 1))) level++; return level; }
/** Feathers not yet offered. */
export function feathersSpare(done: ReadonlySet<string>) { return feathersHeld(done) - glideLevel(done) * GLIDE.feathersPerLevel; }
export function glideScale(level: number) { return { speed: 1 + GLIDE.speedPerLevel * level, sink: Math.max(.4, 1 - GLIDE.sinkPerLevel * level) }; }
