import { CHARACTERS, WEAPONS } from './content.ts';
import { playerHitbox } from './hit.ts';
import type { ArenaMap, Vec3 } from './map.ts';
import { BTN, forward, playerEye, type PlayerState } from './sim.ts';

export const HUMAN_FEATURES = [
  'contact', 'targetYaw', 'targetPitch', 'distance', 'targetCrouched', 'health',
  'forwardSpeed', 'strafeSpeed', 'ammo', 'reload', 'fireCooldown', 'previousTrigger',
  'grounded', 'crouched', 'automatic', 'weaponRange', 'previousYaw', 'previousPitch',
] as const;

export const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const bounded = (x: number, scale: number) => Math.max(-1, Math.min(1, x / scale));

export interface CombatContact { team: PlayerState['team']; crouched: boolean; feet: Vec3 }

/** Only include contacts inside the player's view and unobstructed by the round's visibility rules. */
export function humanObservation(
  map: ArenaMap, me: PlayerState, contacts: readonly CombatContact[], canSee: (from: Vec3, to: Vec3) => boolean,
  priorTurn: readonly [number, number], verticalFov = 78 * Math.PI / 180, aspect = 16 / 9,
): number[] {
  const eye: Vec3 = [me.x, me.y + playerEye(map, me), me.z];
  const hfov = Math.atan(Math.tan(verticalFov / 2) * aspect);
  let found: CombatContact | undefined, yaw = 0, pitch = 0, distance = 0, best = Infinity;
  for (const contact of contacts) {
    if (contact.team === me.team) continue;
    const [x, y, z] = contact.feet;
    const head = y + playerHitbox(contact.crouched).headY;
    const chest = y + (contact.crouched ? .65 : 1.1);
    const dx = x - me.x, dz = z - me.z;
    const horizontal = Math.hypot(dx, dz);
    const dyaw = wrapAngle(Math.atan2(-dx, -dz) - me.yaw);
    const dpitch = Math.atan2((head + chest) / 2 - eye[1], horizontal) - me.pitch;
    if (Math.abs(dyaw) > hfov || Math.abs(dpitch) > verticalFov / 2) continue;
    const score = Math.hypot(dyaw, dpitch) + horizontal * .002;
    if (score >= best || (!canSee(eye, [x, chest, z]) && !canSee(eye, [x, head, z]))) continue;
    best = score;
    found = contact;
    yaw = dyaw;
    pitch = dpitch;
    distance = horizontal;
  }
  const [fx, fz] = forward(me.yaw);
  const weapon = WEAPONS[me.weapon];
  return [
    Number(!!found), yaw, pitch, bounded(distance, 45), Number(found?.crouched ?? false),
    me.hp / CHARACTERS[me.char].hp, bounded(me.vx * fx + me.vz * fz, 8), bounded(-me.vx * fz + me.vz * fx, 8),
    me.ammo[me.weapon] / Math.max(1, weapon.mag), Number(me.reload > 0), bounded(me.fireCd, 100),
    Number(!!(me.prevButtons & BTN.FIRE)), Number(me.grounded), Number(me.crouched), Number(weapon.auto),
    bounded(weapon.falloffStart, 80), bounded(priorTurn[0], .4), bounded(priorTurn[1], .4),
  ];
}

export interface HumanCombatModel {
  version: 1;
  rulesVersion: number;
  features: readonly string[];
  offsets: number[];
  weights: number[][];
  bias: number[];
  output: number[][];
  outputBias: number[];
  centers: [number[], number[]];
}

export interface HumanTurn { yaw: number; pitch: number; fire: boolean }

export function humanCombatPolicy(model: HumanCombatModel, random: () => number) {
  const history: number[][] = [];
  const hidden = model.bias.slice();
  const logits = model.outputBias.slice();
  const depth = Math.max(...model.offsets) + 1;
  const yawBins = model.centers[0].length;
  const pitchBins = model.centers[1].length;

  function sample(start: number, centers: number[]) {
    let high = -Infinity, sum = 0;
    for (let i = 0; i < centers.length; i++) high = Math.max(high, logits[start + i]);
    for (let i = 0; i < centers.length; i++) {
      const probability = Math.exp(logits[start + i] - high);
      logits[start + i] = probability;
      sum += probability;
    }
    let draw = random() * sum;
    for (let i = 0; i < centers.length - 1; i++) {
      draw -= logits[start + i];
      if (draw < 0) return centers[i];
    }
    return centers[centers.length - 1];
  }

  return {
    reset: () => { history.length = 0; },
    think(features: number[]): HumanTurn {
      history.push(features);
      if (history.length > depth) history.shift();
      for (let h = 0; h < hidden.length; h++) {
        let activation = model.bias[h], index = 0;
        for (const lag of model.offsets) {
          const frame = history[Math.max(0, history.length - 1 - lag)];
          for (const value of frame) activation += value * model.weights[h][index++];
        }
        hidden[h] = Math.tanh(activation);
      }
      for (let i = 0; i < logits.length; i++) {
        let value = model.outputBias[i];
        for (let h = 0; h < hidden.length; h++) value += model.output[i][h] * hidden[h];
        logits[i] = value;
      }
      return {
        yaw: sample(0, model.centers[0]), pitch: sample(yawBins, model.centers[1]),
        fire: random() < 1 / (1 + Math.exp(-logits[yawBins + pitchBins])),
      };
    },
  };
}
