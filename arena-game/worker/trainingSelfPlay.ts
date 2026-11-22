import { getMap } from '../shared/arenaMap.ts';
import { learnedOpponent } from '../shared/learnedOpponent.ts';
import { navFor } from '../shared/botLocomotion.ts';
import type { NeuralPolicyModel } from '../shared/neuralPolicy.ts';
import { humanObservation, wrapAngle } from '../shared/humanCombat.ts';
import { lineOfSight } from '../shared/map.ts';
import { Match, type Controller } from '../shared/match.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { TRAINING_BATCH_TICKS, type TrainingBatch } from '../shared/trainingData.ts';

/** Learned self-play produces practice inputs from real collision and combat simulation. */
export function makeSelfPlayBatch(interval: number, model?: NeuralPolicyModel | null): TrainingBatch {
  const maps = ['aster', 'blackflag', 'sakura'];
  const map = maps[interval % maps.length];
  const game = new Match(getMap(map), '1v1');
  const rows: number[][] = [];
  const bot = learnedOpponent(model);
  let previous: [number, number] = [0, 0];
  const pilot: Controller = { think(match, id) {
    const me = match.player(id)!;
    const foe = match.player('b')!;
    const action = bot.think(match, id);
    if (!me.alive || !foe.alive) return action;
    const state = humanObservation(match.map, me, [{ team: foe.team, crouched: foe.crouched, feet: [foe.x, foe.y, foe.z] }],
      (a, b) => match.heroes.visible(a, b), previous);
    previous = [wrapAngle(action.yaw - me.yaw), action.pitch - me.pitch];
    rows.push([me.lifeId, ...state, ...previous, action.mx, action.mz, action.buttons, action.weapon ?? me.weaponSlot]);
    return action;
  } };
  game.addPlayer('a', { name: 'A', team: 'A', char: 0, skins: [], bot: true }, pilot);
  game.addPlayer('b', { name: 'B', team: 'B', char: 0, skins: [], bot: true }, learnedOpponent(model));
  const nodes = navFor(game).nodes;
  const index = (n: number) => (Math.imul(n, 2654435761) >>> 0) % nodes.length;
  const a = game.player('a')!, b = game.player('b')!;
  for (let trial = 0; trial < 160; trial++) {
    const u = nodes[index(interval + trial * 2)], v = nodes[index(interval + trial * 3 + 379)];
    const distance = Math.hypot(u.x - v.x, u.z - v.z);
    if (!u.links.length || !v.links.length || distance < 5 || distance > 18 || Math.abs(u.y - v.y) > 2 ||
        !lineOfSight(game.map, [u.x, u.y + 1.25, u.z], [v.x, v.y + 1.25, v.z])) continue;
    Object.assign(a, { x: u.x, y: u.y, z: u.z, yaw: Math.atan2(u.x - v.x, u.z - v.z) });
    Object.assign(b, { x: v.x, y: v.y, z: v.z, yaw: Math.atan2(v.x - u.x, v.z - u.z) });
    break;
  }
  for (const slot of game.slots.values()) slot.spawnProtectedUntilTick = 0;
  game.phase = 'live';
  game.phaseT = TRAINING_BATCH_TICKS + 1;
  for (let i = 0; i < TRAINING_BATCH_TICKS && a.alive && b.alive; i++) game.step();
  return { version: 1, rulesVersion: RULES_VERSION, capture: `${interval.toString(16).padStart(28, '0')}0001`,
    sequence: 0, start: 0, map, rows, views: [] };
}
