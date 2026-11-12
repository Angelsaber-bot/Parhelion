import { SKY_PHASES, type JourneyPoint } from './worldJourney';
import { SKY_SHUTTER_FLAGS, SKY_SUPPORT, SKY_SUPPORT_RADIUS, skySupportFlag, type SkySupporter } from './skySupport';

export const SKY_ORIGIN: JourneyPoint = [250, 212, 160];
export const SKY_BOSS: JourneyPoint = [SKY_ORIGIN[0], SKY_ORIGIN[1] + 2.3, SKY_ORIGIN[2] - 28];
export const SKY_SHUTTERS: JourneyPoint[] = [[SKY_ORIGIN[0] - 10, SKY_ORIGIN[1], SKY_ORIGIN[2] - 15], [SKY_ORIGIN[0] + 10, SKY_ORIGIN[1], SKY_ORIGIN[2] - 15]];
export const SHUTTER_SPAN = 8;
const PHASE_HP = [135, 170, 185];
const TOTAL_HP = PHASE_HP.reduce((sum, value) => sum + value, 0);
type Position = Pick<{ x: number; y: number; z: number }, 'x' | 'z'>;
type Beat = 'waiting' | 'tracking' | 'locked' | 'recovering';
type Shape = 'beam' | 'pulse' | 'write';
export interface HelionTell { shape: Shape; from: JourneyPoint; x: number; z: number; width: number; }
export interface HelionHooks {
  done: ReadonlySet<string>;
  phaseCleared(id: string, supporters: readonly SkySupporter[], shutters: readonly boolean[]): void;
  hurt(damage: number): void;
  cue(beat: Beat, shape?: Shape): void;
}

const BEAM_LENGTH = 96;
const distance2D = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.z - b.z);
function direction(tell: HelionTell) {
  const x = tell.x - tell.from[0], z = tell.z - tell.from[2];
  const length = Math.hypot(x, z);
  return length > .1 ? { x: x / length, z: z / length } : { x: 0, z: 1 };
}
export function helionAttackHits(tell: HelionTell, p: Position, max = BEAM_LENGTH) {
  if (tell.shape === 'pulse') return distance2D(p, tell) < tell.width;
  const d = direction(tell), x = p.x - tell.from[0], z = p.z - tell.from[2];
  const along = x * d.x + z * d.z;
  return along >= 0 && along <= max && Math.abs(x * d.z - z * d.x) < tell.width;
}
export function helionBeamDirection(tell: HelionTell) { return direction(tell); }

export function shutterIntersection(tell: HelionTell, p: JourneyPoint, alternate: boolean) {
  if (tell.shape === 'pulse') return Infinity;
  const d = direction(tell);
  const normal = alternate ? d.x : d.z;
  if (Math.abs(normal) < .02) return Infinity;
  const t = alternate ? (p[0] - tell.from[0]) / normal : (p[2] - tell.from[2]) / normal;
  const across = alternate ? tell.from[2] + d.z * t - p[2] : tell.from[0] + d.x * t - p[0];
  return t > 0 && t < BEAM_LENGTH && Math.abs(across) <= SHUTTER_SPAN / 2 ? t : Infinity;
}

export function createHelionFight(h: HelionHooks) {
  let phase = -1, hp = 0, beat: Beat = 'waiting', clock = 0, cycle = 0;
  let tell: HelionTell | null = null, flash: HelionTell | null = null, flashLength = 0, flashFor = 0;
  let lastWrite = false, spentWriter = false;
  const supporters = new Set<SkySupporter>();
  let guard: { id: SkySupporter; position: Position; remaining: number } | null = null;
  const shutters = [false, false], changedAfterLock = [false, false];
  const emitters = [PHASE_HP[1] / 2, PHASE_HP[1] / 2];
  let attackingEmitter = 0;

  function setBeat(next: Beat, seconds: number) {
    beat = next; clock = seconds;
    h.cue(next, tell?.shape);
  }
  function reset() {
    phase = -1; hp = 0; beat = 'waiting'; clock = 0; cycle = 0; tell = null; flash = null; flashFor = 0;
    lastWrite = false; spentWriter = false; shutters.fill(false); changedAfterLock.fill(false);
    supporters.clear(); guard = null;
    emitters.fill(PHASE_HP[1] / 2); attackingEmitter = 0;
  }
  function start() {
    if (phase >= 0) return false;
    const next = SKY_PHASES.findIndex(id => !h.done.has(id));
    if (next < 0) return false;
    phase = next; hp = PHASE_HP[next];
    SKY_SHUTTER_FLAGS.forEach((id, index) => { shutters[index] = h.done.has(id); });
    setBeat('waiting', 1.25);
    return true;
  }
  function track(p: Position) {
    const preferred = cycle % 2;
    if (phase === 1) attackingEmitter = emitters[preferred] > 0 ? preferred : 1 - preferred;
    const pressurePulse = phase === 2 || (phase === 1 && emitters.every(value => value > 0));
    const shape: Shape = lastWrite ? 'write' : pressurePulse && cycle % 3 === 2 ? 'pulse' : 'beam';
    const offset = phase === 1 ? (attackingEmitter ? 12 : -12) : 0;
    const from: JourneyPoint = [SKY_BOSS[0] + offset, SKY_BOSS[1], SKY_BOSS[2]];
    tell = { shape, from, x: p.x, z: p.z, width: shape === 'pulse' ? (phase === 2 ? 6.2 : 5) : shape === 'write' ? 3.6 : 1.65 };
    changedAfterLock.fill(false);
    setBeat('tracking', lastWrite ? 1.45 : 1.15);
  }
  function fire(p: Position) {
    if (!tell) return;
    let stop = BEAM_LENGTH, reflecting = false;
    SKY_SHUTTERS.forEach((position, index) => {
      const distance = shutterIntersection(tell!, position, shutters[index]);
      if (distance < stop) { stop = distance; reflecting = changedAfterLock[index]; }
    });
    const incoming = tell;
    flash = incoming; flashFor = .22; flashLength = stop;
    const damage = lastWrite ? 42 : phase === 0 ? 26 : phase === 1 ? 31 : 34;
    if (helionAttackHits(incoming, p, stop)) {
      const effect = guard ? SKY_SUPPORT[guard.id].effect : null;
      const covered = guard && distance2D(guard.position, p) <= SKY_SUPPORT_RADIUS &&
        (effect === 'cover' || (effect === 'beam' && incoming.shape !== 'pulse') || (effect === 'pulse' && incoming.shape === 'pulse'));
      if (covered) guard = null;
      else h.hurt(damage);
    }
    const finalAttack = lastWrite;
    if (lastWrite) { lastWrite = false; spentWriter = true; }
    tell = null; cycle++;
    setBeat('recovering', finalAttack ? 5 : reflecting ? 5 : 3.1);
    if (reflecting && !finalAttack) hit(48);
  }
  function hit(damage: number, weakPoint?: number) {
    if (phase < 0 || beat !== 'recovering' || !Number.isFinite(damage) || damage <= 0) return false;
    if (phase === 1) {
      const index = weakPoint ?? attackingEmitter;
      if (index !== attackingEmitter || emitters[index] <= 0) return false;
      emitters[index] = Math.max(0, emitters[index] - damage);
      hp = emitters[0] + emitters[1];
      if (hp > 0 && emitters[index] === 0) setBeat('waiting', .55);
    } else hp = Math.max(0, hp - damage);
    if (hp > 0) {
      if (phase === 2 && hp <= PHASE_HP[2] * .38 && !spentWriter) {
        lastWrite = true; setBeat('waiting', .45);
      }
      return true;
    }
    const cleared = SKY_PHASES[phase];
    const used = [...supporters], poses = [...shutters];
    reset(); h.phaseCleared(cleared, used, poses);
    return true;
  }
  function canSupport(id: SkySupporter) {
    if (phase < 0 || supporters.has(id) || h.done.has(skySupportFlag(id)) || !h.done.has(SKY_SUPPORT[id].unlock)) return false;
    const effect = SKY_SUPPORT[id].effect;
    if (effect === 'opening') return beat === 'recovering';
    if (effect === 'delay') return beat !== 'recovering';
    return !guard;
  }
  return {
    get active() { return phase >= 0; }, get phase() { return phase; }, get hp() { return hp; },
    get maxHp() { return PHASE_HP[phase] ?? 1; }, get beat() { return beat; }, get exposedEmitter() { return attackingEmitter; },
    get totalHp() { return phase >= 0 ? hp + PHASE_HP.slice(phase + 1).reduce((sum, value) => sum + value, 0) : 0; },
    get maxTotalHp() { return TOTAL_HP; },
    get guard() { return guard; },
    emitterOnline(index: number) { return phase === 1 && emitters[index] > 0; },
    get tell() { return tell; }, get flash() { return flashFor > 0 ? flash : null; }, get flashLength() { return flashLength; },
    get shutters() { return shutters as readonly boolean[]; },
    get vulnerable() { return beat === 'recovering'; },
    start, hit, reset,
    recoverFall() {
      if (phase < 0) return;
      tell = flash = null; flashFor = 0; changedAfterLock.fill(false);
      setBeat('waiting', 1.45);
    },
    canSupport,
    support(id: SkySupporter, position: Position) {
      if (!canSupport(id) || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
      const aid = SKY_SUPPORT[id]; supporters.add(id);
      if (aid.effect === 'delay' || aid.effect === 'opening') {
        clock += aid.seconds;
        if (aid.effect === 'opening' && phase !== 2) {
          const reserve = phase === 1 ? emitters[attackingEmitter] : hp;
          if (reserve > 1) hit(Math.min(22, reserve - 1));
        }
      } else guard = { id, position: { x: position.x, z: position.z }, remaining: aid.seconds };
      return true;
    },
    turn(index: number) {
      if (index !== 0 && index !== 1) return false;
      shutters[index] = !shutters[index];
      if (beat === 'locked') changedAfterLock[index] = true;
      return true;
    },
    update(dt: number, p: Position) {
      if (phase < 0 || !Number.isFinite(dt) || dt <= 0) return;
      const elapsed = Math.min(.08, dt);
      if (guard) { guard.remaining -= elapsed; if (guard.remaining <= 0) guard = null; }
      flashFor = Math.max(0, flashFor - elapsed);
      clock -= elapsed;
      if (beat === 'tracking' && tell) { tell.x = p.x; tell.z = p.z; }
      if (clock > 0) return;
      if (beat === 'waiting' || beat === 'recovering') track(p);
      else if (beat === 'tracking') setBeat('locked', tell?.shape === 'write' ? 1.2 : .8);
      else fire(p);
    },
  };
}
