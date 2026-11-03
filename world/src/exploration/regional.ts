/**
 * Region-signature exploration mechanics. Britain keeps the prism light puzzles; every other
 * era gets a mechanic of its own instead of re-skinned copies:
 *   黑帆尽头 — treasure maps: a hand-drawn terrain sketch, find the X, dig, the chest holds the next map
 *   永冬之城 — ember relay: carry fire from a lit brazier and kindle beacons before the ember dies
 *   业火京都 — fox-fire: follow a kitsune-bi through the streets without falling behind
 *   幻日谷 — lost signals: tune a field terminal, then hunt the cache hot/cold with the scanner
 * Pure data + rules (no three.js) so the chains can be unit-tested.
 */
import type { Localized, RegionId } from '../settlements/types';
import type { CampDef, ChestDef, XZ } from './catalog';

export interface TreasureMapDef {
  readonly id: string; readonly region: RegionId; readonly title: Localized;
  /** where the first map is found (a message bottle); later maps come out of the previous chest */
  readonly bottle?: XZ; readonly after?: string;
  readonly dig: XZ; readonly clue: Localized;
}
export interface EmberRouteDef {
  readonly id: string; readonly region: RegionId; readonly title: Localized;
  readonly brazier: XZ; readonly beacons: readonly XZ[];
  /** seconds the ember survives on each leg (brazier → beacon 1, beacon 1 → 2, …) */
  readonly seconds: readonly number[]; readonly hint: Localized;
}
export interface FoxfireDef {
  readonly id: string; readonly region: RegionId; readonly title: Localized;
  readonly shrine: XZ; readonly path: readonly XZ[]; readonly speed: number; readonly hint: Localized;
}

export interface SignalDef {
  readonly id: string; readonly region: RegionId; readonly title: Localized;
  readonly terminal: XZ; readonly cache: XZ; readonly clue: Localized;
}
export const flagSignal = (id: string) => `xp_sig_${id}`;
export const markerTerminal = (id: string) => `xpm_sigterm_${id}`;
export const markerCache = (id: string) => `xpm_sigcache_${id}`;
export const flagMap = (id: string) => `xp_map_${id}`;
export const flagDig = (id: string) => `xp_dig_${id}`;
export const flagEmber = (id: string) => `xp_ember_${id}`;
export const flagFox = (id: string) => `xp_fox_${id}`;
export const markerBottle = (id: string) => `xpm_bottle_${id}`;
export const markerDig = (id: string) => `xpm_dig_${id}`;
export const markerBrazier = (id: string) => `xpm_brazier_${id}`;
export const markerBeacon = (id: string, i: number) => `xpm_beacon_${id}_${i}`;
export const markerFoxShrine = (id: string) => `xpm_foxshrine_${id}`;

/** 黑帆尽头: three maps, each chest holds the next; the last one opens the Sunken Vault. */
export const TREASURE_MAPS: readonly TreasureMapDef[] = [
  { id: 'driftwood', region: 'blacksail', title: ['漂流瓶藏宝图', 'Message-in-a-Bottle Map'], bottle: [565, 69], dig: [630, 18],
    clue: ['“潮水退去的湾口，两块礁石之间。向着日落走五十步。”', '"Where the tide leaves the cove, between two rocks. Fifty paces toward the sunset."'] },
  { id: 'lighthouse', region: 'blacksail', title: ['灯塔守的残图', "Lighthouse Keeper's Scrap"], after: 'driftwood', dig: [924, 4],
    clue: ['“灯光照不到的地方，就在它脚下。”', '"Where the lamp never shines: right beneath it."'] },
  { id: 'blackbeard', region: 'blacksail', title: ['黑胡子的海图', "Blackbeard's Chart"], after: 'lighthouse', dig: [752, -194],
    clue: ['“炮台之下，悬崖之上。金库的钥匙埋在能看见整片海的地方。”', '"Below the battery, above the cliff. The vault key lies where the whole sea can be seen."'] },
];
export const TREASURE_FINAL = 'blackbeard';

/** 永冬之城: the chapel road and the river crossing. */
export const EMBER_ROUTES: readonly EmberRouteDef[] = [
  { id: 'chapel_road', region: 'winter', title: ['礼拜堂烽火', 'Chapel Road Beacons'], brazier: [-172, -612],
    beacons: [[-148, -638], [-136, -688], [-136, -730], [-150, -760]], seconds: [6, 8, 7, 5],
    hint: ['从篝火取得火种，在它熄灭前跑到下一座烽火。烽火会接力保存火焰。', 'Take an ember from the campfire and reach the next beacon before it dies; each lit beacon relays the flame.'] },
  { id: 'river_watch', region: 'winter', title: ['林道哨火', 'Forest Watch Fires'], brazier: [-40, -600],
    beacons: [[-56, -644], [-66, -680], [-70, -712]], seconds: [7, 6, 5],
    hint: ['沿着林间小路把火种接力下去。', 'Relay the ember down the forest track.'] },
];
export const EMBER_FINAL = 'chapel_road';

/** 业火京都: the fox-fire leads to Lotus Hall and to a shrine hidden in the bamboo. */
export const FOXFIRES: readonly FoxfireDef[] = [
  { id: 'lotus_path', region: 'kyoto', title: ['狐火引路 · 莲华', 'Fox-fire · Lotus Path'], shrine: [100, 880], speed: 6.6,
    path: [[100, 880], [86, 880], [74, 886], [64, 894], [54, 902], [46, 910], [38, 918], [30, 926], [22, 934], [14, 942], [4, 948], [-8, 950], [-22, 950], [-32, 956], [-42, 962], [-52, 968], [-58, 970]],
    hint: ['狐火只为跟得上的人引路。冲刺跟紧它，落后太远它就会消散。', 'The fox-fire only guides those who keep up. Sprint after it; fall too far behind and it fades.'] },
  { id: 'bamboo_shrine', region: 'kyoto', title: ['狐火引路 · 竹林', 'Fox-fire · Bamboo Shrine'], shrine: [-186, 930], speed: 6.9,
    path: [[-186, 930], [-194, 920], [-194, 906], [-194, 892], [-202, 882], [-210, 872], [-216, 862], [-224, 854], [-232, 846], [-240, 836], [-248, 828], [-260, 822]],
    hint: ['竹林深处有一座没人记得的小神社。', 'Deep in the bamboo stands a shrine no one remembers.'] },
];
export const FOX_FINAL = 'lotus_path';

/** 幻日谷: three lost relay caches. The scanner only says hotter or colder; the clue gives a direction. */
export const SIGNALS: readonly SignalDef[] = [
  { id: 'echo_forest', region: 'alpha', title: ['林中回声', 'Echo in the Woods'], terminal: [70, 4], cache: [114, 50],
    clue: ['“回声森林里有一台还在发报的旧中继。往东北走，跟着信号格。”', '"An old relay is still transmitting in the Echo Forest. Head north-east and follow the bars."'] },
  { id: 'outpost', region: 'alpha', title: ['前哨站残响', 'Outpost Afterglow'], terminal: [-134, -90], cache: [-222, -120],
    clue: ['“前哨站撤离时把备份匣埋在了西边的低地。”', '"When the outpost was evacuated, the backup case was buried in the lowland to the west."'] },
  { id: 'ridge', region: 'alpha', title: ['山脊上的哨音', 'Whistle on the Ridge'], terminal: [198, -8], cache: [260, -162],
    clue: ['“信号从南面山脚的雾里传上来。站在山脊上看得最清楚。”', '"The signal rises from the mist at the southern foot of the hills. You see it best from the ridge."'] },
];
export const SIGNAL_RANGE = 90;
/** Scanner bars 0–5 by distance: only hotter/colder, never a direction. */
export function signalBars(d: number): number { return d < 4 ? 5 : d < 12 ? 4 : d < 28 ? 3 : d < 50 ? 2 : d < SIGNAL_RANGE ? 1 : 0; }
/** Seconds between scanner pings (faster as it gets hotter). */
export function signalPing(bars: number): number { return [0, 1.6, 1.1, .7, .4, .22][bars] ?? 0; }

// ─────────────────────────── rules ───────────────────────────
/** A map is held once its bottle was opened or the previous dig found it, and until it is dug. */
export function mapHeld(def: TreasureMapDef, done: ReadonlySet<string>): boolean {
  if (done.has(flagDig(def.id))) return false;
  return def.after ? done.has(flagDig(def.after)) : done.has(flagMap(def.id));
}
export function canDig(def: TreasureMapDef, done: ReadonlySet<string>) { return mapHeld(def, done); }

/** Ember relay state machine: carry → kindle beacon i in order → next leg; timeout resets. */
export interface EmberState { route: string | null; leg: number; time: number }
export const emberIdle = (): EmberState => ({ route: null, leg: 0, time: 0 });
export function emberTake(route: EmberRouteDef): EmberState { return { route: route.id, leg: 0, time: route.seconds[0] }; }
export type EmberKindle = { ok: true; state: EmberState; finished: boolean } | { ok: false; reason: 'no-ember' | 'wrong-beacon' | 'other-route' };
export function emberKindle(route: EmberRouteDef, state: EmberState, beacon: number): EmberKindle {
  if (!state.route) return { ok: false, reason: 'no-ember' };
  if (state.route !== route.id) return { ok: false, reason: 'other-route' };
  if (beacon !== state.leg) return { ok: false, reason: 'wrong-beacon' };
  const leg = beacon + 1, finished = leg >= route.beacons.length;
  return { ok: true, finished, state: finished ? emberIdle() : { route: route.id, leg, time: route.seconds[leg] } };
}
export function emberTick(state: EmberState, dt: number): { state: EmberState; expired: boolean } {
  if (!state.route) return { state, expired: false };
  const time = state.time - dt;
  return time <= 0 ? { state: emberIdle(), expired: true } : { state: { ...state, time }, expired: false };
}

/** Fox-fire position along its path after travelling `s` metres; also returns the segment index. */
export function foxAt(def: FoxfireDef, s: number): { x: number; z: number; segment: number; end: boolean } {
  let left = Math.max(0, s);
  for (let i = 1; i < def.path.length; i++) {
    const a = def.path[i - 1], b = def.path[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= d) { const t = d ? left / d : 0; return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, segment: i - 1, end: false }; }
    left -= d;
  }
  const last = def.path[def.path.length - 1];
  return { x: last[0], z: last[1], segment: def.path.length - 2, end: true };
}
export function foxLength(def: FoxfireDef) { let L = 0; for (let i = 1; i < def.path.length; i++) L += Math.hypot(def.path[i][0] - def.path[i - 1][0], def.path[i][1] - def.path[i - 1][1]); return L; }
/** The fox lingers this long at every 4th waypoint and glances back. */
export const FOX_PAUSE = 1.1, FOX_LEASH = 16, FOX_GRACE = 2.5;

/** Reward chests for the signature mechanics. Treasure chests stay buried until dug up. */
export const REGIONAL_CHESTS: readonly ChestDef[] = [
  { id: 'blacksail_dig_driftwood', region: 'blacksail', p: [630, 18], tier: 'exquisite', requires: flagDig('driftwood'), buried: true },
  { id: 'blacksail_dig_lighthouse', region: 'blacksail', p: [924, 4], tier: 'precious', requires: flagDig('lighthouse'), buried: true },
  { id: 'blacksail_dig_blackbeard', region: 'blacksail', p: [752, -194], tier: 'luxurious', requires: flagDig('blackbeard'), buried: true },
  { id: 'winter_ember_chapel_road', region: 'winter', p: [-143, -755], tier: 'exquisite', requires: flagEmber('chapel_road') },
  { id: 'winter_ember_river_watch', region: 'winter', p: [-64, -716], tier: 'precious', requires: flagEmber('river_watch') },
  { id: 'kyoto_fox_lotus_path', region: 'kyoto', p: [-50, 966], tier: 'exquisite', requires: flagFox('lotus_path') },
  { id: 'kyoto_fox_bamboo_shrine', region: 'kyoto', p: [-262, 817], tier: 'luxurious', requires: flagFox('bamboo_shrine') },
  { id: 'alpha_sig_echo_forest', region: 'alpha', p: [114, 50], tier: 'exquisite', requires: flagSignal('echo_forest'), buried: true },
  { id: 'alpha_sig_outpost', region: 'alpha', p: [-222, -120], tier: 'exquisite', requires: flagSignal('outpost'), buried: true },
  { id: 'alpha_sig_ridge', region: 'alpha', p: [260, -162], tier: 'precious', requires: flagSignal('ridge'), buried: true },
];

/** 落日王国: the Round Table echoes. One-on-one duels inside a ring; stepping out forfeits. */
export const DUEL_RING = 10;
const duelChain = (id: string) => `xp_camp_duel_${id}`;
export const DUELS: readonly CampDef[] = [
  { id: 'duel_kay', region: 'britain', title: ['圆桌残影 · 凯', 'Round Table Echo · Sir Kay'], anchor: [-620, -190], style: 'duel',
    waves: [[{ role: 'duelist', offset: [0, -3], title: ['总管凯的残影', 'Echo of Sir Kay'] }]] },
  { id: 'duel_galahad', region: 'britain', title: ['圆桌残影 · 加拉哈德', 'Round Table Echo · Sir Galahad'], anchor: [-704, 4], style: 'duel', requires: duelChain('kay'),
    waves: [[{ role: 'lancer', offset: [0, -3], title: ['纯洁骑士加拉哈德的残影', 'Echo of Sir Galahad the Pure'] }]] },
  { id: 'duel_lancelot', region: 'britain', title: ['圆桌残影 · 兰斯洛特', 'Round Table Echo · Sir Lancelot'], anchor: [-920, -32], style: 'duel', requires: duelChain('galahad'),
    waves: [[{ role: 'breaker', offset: [0, -3], title: ['湖上骑士兰斯洛特的残影', 'Echo of Sir Lancelot du Lac'], pattern: 'echo-warden' }]] },
];
export const DUEL_CHESTS: readonly ChestDef[] = [
  { id: 'britain_duel_kay', region: 'britain', p: [-620, -178.5], tier: 'exquisite', requires: duelChain('kay') },
  { id: 'britain_duel_galahad', region: 'britain', p: [-704, 15.5], tier: 'precious', requires: duelChain('galahad') },
  { id: 'britain_duel_lancelot', region: 'britain', p: [-920, -20.5], tier: 'luxurious', requires: duelChain('lancelot') },
];
