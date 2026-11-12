import { EGYPT_GAUGE } from './egyptGauge';
import type { Localized } from '../settlements/types';

export const REALM_CLIMAX_IDS = ['egypt', 'orleans', 'qin'] as const;
export type RealmClimaxId = typeof REALM_CLIMAX_IDS[number];
export type ClimaxPoint = { x: number; y: number; z: number };
export type ClimaxStation = 'west' | 'east';
type AttackShape = 'line' | 'circle' | 'cross';
type StationWork = { label: Localized; after?: 'west' | 'haltOrTarget' };
type Phase = {
  title: Localized;
  attack?: AttackShape;
  damage?: number;
  target?: { hp: number; requires: 'west' | 'both' | 'none' | 'guard' };
  west?: StationWork;
  east?: StationWork;
};
type Climax = { title: Localized; start: Localized; phases: readonly Phase[] };

export const REALM_CLIMAXES: Record<RealmClimaxId, Climax> = {
  egypt: {
    title: ['吞潮', 'Tide-Eater'],
    start: ['在高岸试洪，迎战吞潮', 'Start the flood trial from the high bank'],
    phases: [
      { title: ['引离逆流', 'Divert the backflow'], attack: 'line', damage: 21, target: { hp: 86, requires: 'west' },
        west: { label: ['扳开分流闸，剥掉吞潮的水膜', 'Open the diversion gate to strip the water armor'] } },
      { title: ['稳住上游', 'Stabilize the upstream feed'], attack: 'circle', damage: 25, target: { hp: 112, requires: 'both' },
        west: { label: ['隔断异常支路', 'Isolate the anomalous branch'] },
        east: { label: ['接通稳定上游', 'Connect the stable upstream feed'], after: 'west' } },
      { title: ['清水冲洗前池', 'Flush the forebay'],
        east: { label: ['释放中央基座门', 'Release the central floodgate'] } },
    ],
  },
  orleans: {
    title: ['桥堡副将 马修·韦尔', 'Matthew Vale, Bridgefort Lieutenant'],
    start: ['在桥头举旗，向韦尔的防线推进', 'Raise the bridgehead flag and advance on Vale’s line'],
    phases: [
      { title: ['把旗传过去', 'Pass the flag'], attack: 'line', damage: 18, target: { hp: 62, requires: 'none' },
        west: { label: ['把旗交给侧翼接应队', 'Pass the flag to the relief crew on the flank'] } },
      { title: ['拆开交叉火线', 'Break the crossfire'], attack: 'cross', damage: 23, target: { hp: 83, requires: 'none' },
        east: { label: ['打开侧桥机，为工兵留出掩护', 'Open the side bridge mechanism to shelter the engineers'] } },
      { title: ['给撤离的人留路', 'Leave a road for the withdrawing garrison'],
        west: { label: ['发出停火与放行信号', 'Signal the ceasefire and open passage'] } },
    ],
  },
  qin: {
    title: ['封陵将', 'The Sealing General'],
    start: ['持工符进入校令台', 'Enter the command court with the workers’ tally'],
    phases: [
      { title: ['让军道驻阵', 'Halt the ranks'], attack: 'cross', damage: 20, target: { hp: 145, requires: 'guard' },
        west: { label: ['向前列发驻令', 'Order the front rank to halt'] },
        east: { label: ['让载梁工队通过军道', 'Send the beam crew across the ranks'], after: 'haltOrTarget' } },
      { title: ['让校令台认印', 'Register the new authority'], attack: 'line', damage: 24,
        west: { label: ['将横梁固定在校令台前', 'Set the crossbeam at the command court'] },
        east: { label: ['登记中军符，撤回封陵令', 'Register the central tally and revoke the burial order'], after: 'west' } },
      { title: ['交给维护道路的人', 'Transfer authority to the people who keep the road'],
        west: { label: ['把独立工符交给工匠', 'Transfer the independent tally to the workers'] } },
    ],
  },
};

export const climaxMarker = (id: RealmClimaxId, station: ClimaxStation | 'start') => `realm_${id}_${station}`;
export const climaxTarget = (id: RealmClimaxId, index: number) => `realm_${id}_target_${index}`;
export const climaxCheckpoint = (id: RealmClimaxId, phase: number) => `realm_${id}_phase_${phase + 1}`;
export const climaxCleared = (id: RealmClimaxId) => climaxCheckpoint(id, 2);
export const QIN_GENERAL_DOWN = 'qin_general_defeated';

export interface ClimaxTell { shape: AttackShape; from: ClimaxPoint; x: number; z: number; width: number; length: number }
const distance = (a: {x: number; z: number}, b: {x: number; z: number}) => Math.hypot(a.x - b.x, a.z - b.z);
export function climaxTellHits(tell: ClimaxTell, player: ClimaxPoint) {
  if (tell.shape === 'circle') return distance(player, tell) < tell.width;
  const dx = tell.x - tell.from.x, dz = tell.z - tell.from.z, n = Math.hypot(dx, dz) || 1;
  const x = player.x - tell.from.x, z = player.z - tell.from.z;
  const along = (x * dx + z * dz) / n, across = (x * dz - z * dx) / n;
  return (along >= 0 && along <= tell.length && Math.abs(across) < tell.width)
    || (tell.shape === 'cross' && Math.abs(across) < tell.length * .45 && Math.abs(along - n * .65) < tell.width);
}

export function createRealmClimax(id: RealmClimaxId, origin: ClimaxPoint, hooks: {
  done: ReadonlySet<string>;
  save(flag: string): void;
  hurt(damage: number): void;
  warn(): void;
}) {
  const definition = REALM_CLIMAXES[id];
  let phase = -1, hp = 0, west = false, east = false;
  let time = 0, mode: 'waiting' | 'locked' | 'recovering' = 'waiting', tell: ClimaxTell | null = null;
  let quenched = false;
  const data = () => definition.phases[phase];
  const reset = () => { phase = -1; tell = null; };
  function prepare(index: number) {
    phase = index; west = east = quenched = false; tell = null; time = 1.55; mode = 'waiting';
    const defeatedGeneral = id === 'qin' && index === 0 && hooks.done.has(QIN_GENERAL_DOWN);
    west = defeatedGeneral;
    hp = defeatedGeneral ? 0 : data().target?.hp ?? 0;
  }
  function completeIfReady() {
    const p = data();
    if (p.west && !west || p.east && !east || (p.target && hp > 0 && id !== 'qin')) return;
    const cleared = phase;
    if (cleared + 1 < definition.phases.length) prepare(cleared + 1);
    else reset();
    hooks.save(climaxCheckpoint(id, cleared));
  }
  function stationReady(which: ClimaxStation) {
    if (phase < 0 || (which === 'west' ? west : east)) return false;
    const action = data()[which];
    if (!action) return false;
    if (action.after === 'west') return west;
    if (action.after === 'haltOrTarget') return west || hp === 0;
    return true;
  }
  return {
    id, definition,
    get phase() { return phase; },
    get hp() { return hp; },
    get tell() { return tell; },
    get maxHp() { return data()?.target?.hp ?? 0; },
    get exposed() {
      const rule = data()?.target?.requires;
      return hp > 0 && (rule === 'none' || rule === 'guard'
        || (rule === 'west' && west && mode === 'recovering')
        || (rule === 'both' && west && east && mode === 'recovering'));
    },
    start() {
      if (phase >= 0) return false;
      const next = definition.phases.findIndex((_, index) => !hooks.done.has(climaxCheckpoint(id, index)));
      if (next < 0) return false;
      prepare(next); return true;
    },
    reset,
    stationReady,
    stationWorked(which: ClimaxStation) { return which === 'west' ? west : east; },
    stationText(which: ClimaxStation) { return data()?.[which]?.label; },
    work(which: ClimaxStation) {
      if (!stationReady(which)) return false;
      if (which === 'west') west = true;
      else east = true;
      if (id === 'qin' && phase === 0 || id === 'orleans') quenched = true;
      completeIfReady(); return true;
    },
    hit(index: number, damage: number) {
      if (index !== phase || !this.exposed || !Number.isFinite(damage) || damage <= 0) return false;
      hp = Math.max(0, hp - damage * (data().target?.requires === 'guard' && !west ? .38 : 1));
      if (hp === 0 && id === 'qin') {
        // When the player defeats the General early, later orders are executed by the ranks.
        west = true;
        hooks.save(QIN_GENERAL_DOWN);
      }
      completeIfReady();
      return true;
    },
    update(dt: number, player: ClimaxPoint) {
      if (phase < 0 || !data().attack || !Number.isFinite(dt) || dt <= 0) return;
      time -= Math.min(.08, dt);
      if (time > 0) return;
      if (mode === 'locked') {
        if (!quenched && tell && Math.abs(player.y - origin.y) < 5 && climaxTellHits(tell, player)) hooks.hurt(data().damage ?? 20);
        quenched = false; tell = null; mode = 'recovering'; time = 4.25;
      } else {
        const shape = data().attack!;
        const x = player.x === origin.x && player.z === origin.z ? player.x + 1 : player.x;
        tell = { shape, from: origin, x, z: player.z, width: shape === 'circle' ? 4.3 : 1.55, length: 28 };
        mode = 'locked'; time = id === 'egypt' && hooks.done.has(EGYPT_GAUGE.report) ? 2.15 : 1.35; hooks.warn();
      }
    },
  };
}
