// The same visible encounter is replayed with both actors, target motions and seats.
// Only the test target is scripted. The pilot keeps its normal sensors and controls.
import { getMap } from '../../shared/arenaMap.ts';
import { navFor } from '../../shared/botLocomotion.ts';
import { TICK_HZ, type Loadout } from '../../shared/content.ts';
import { humanObservation } from '../../shared/humanCombat.ts';
import { learnedOpponent } from '../../shared/learnedOpponent.ts';
import { Match, type Controller } from '../../shared/match.ts';
import type { NavNode } from '../../shared/nav.ts';
import type { NeuralPolicyModel } from '../../shared/neuralPolicy.ts';
import { rng } from './evaluate-spawn-search.ts';
import { trialSeed } from '../self-play-seeds.ts';

type Start = Pick<NavNode, 'x' | 'y' | 'z'>;
// Completed public rules-43 1v1 rounds. These are equipment/score fixtures
// from aggregate match telemetry, separate from the consented training corpus.
interface MatchReference { map: string; at: number; bot: number; human: number; kit: Loadout; humanScore: number; botScore: number }
const references: MatchReference[] = [
  { map: 'frostcourt', at: 1795396594422, bot: 3, human: 5, kit: ['firefly', 'halo', 'hammer'], humanScore: 7, botScore: 0 },
  { map: 'homeward', at: 1795382557118, bot: 3, human: 7, kit: ['corona', 'longnight', 'polearm'], humanScore: 7, botScore: 2 },
  { map: 'blackflag', at: 1795381709043, bot: 6, human: 7, kit: ['corona', 'firefly', 'hammer'], humanScore: 7, botScore: 1 },
];
interface Fixture {
  reference: MatchReference; a: Start; b: Start; angle: number; direction: number;
}

function encounter(f: Fixture, reverse: boolean, moving: boolean, model?: NeuralPolicyModel) {
  const side = reverse ? 'B' : 'A', other = reverse ? 'A' : 'B';
  const game = new Match(getMap(f.reference.map), '1v1');
  const info = { name: 'probe', skins: [], bot: true };
  const targetDriver: Controller = { think(match, id) {
    const me = match.player(id)!;
    return { seq: match.tick, view: match.tick, yaw: me.yaw, pitch: 0, mx: moving ? f.direction : 0,
      mz: 0, buttons: 0, weapon: me.weaponSlot };
  } };
  game.addPlayer('pilot', { ...info, team: side, char: f.reference.bot, loadout: f.reference.kit }, model && learnedOpponent(model));
  game.addPlayer('target', { ...info, team: other, char: f.reference.human, loadout: ['longnight', 'corona', 'polearm'], utility: 'smoke' }, targetDriver);
  const a = reverse ? f.b : f.a, b = reverse ? f.a : f.b;
  const yaw = Math.atan2(a.x - b.x, a.z - b.z);
  const pilot = game.player('pilot')!, target = game.player('target')!;
  Object.assign(pilot, { x: a.x, y: a.y, z: a.z, yaw: yaw + f.angle,
    pitch: Math.atan2(b.y - a.y, Math.hypot(a.x - b.x, a.z - b.z)), grounded: true });
  Object.assign(target, { x: b.x, y: b.y, z: b.z, yaw: yaw + Math.PI, grounded: true });
  game.phase = 'live'; game.phaseT = 3 * TICK_HZ;
  for (const seat of game.slots.values()) seat.spawnProtectedUntilTick = 0;
  return { game, pilot, target };
}

function clearStart(f: Fixture, reverse: boolean) {
  const { game, pilot, target } = encounter(f, reverse, true);
  const seen = humanObservation(game.map, pilot, [{ team: target.team, crouched: false, feet: [target.x, target.y, target.z] }],
    (a, b) => game.heroes.visible(a, b), [0, 0]);
  if (seen[0] !== 1) return false;
  const x = target.x, z = target.z;
  for (let tick = 0; tick < TICK_HZ / 2; tick++) game.step();
  return Math.hypot(target.x - x, target.z - z) >= 1;
}

export function closeContact(candidate: NeuralPolicyModel, incumbent: NeuralPolicyModel, seed: number, pairs = 8) {
  return references.flatMap(reference => {
    const { map } = reference;
    const draw = rng(trialSeed(seed, 'close-contact', map));
    const nodes = navFor({ map: getMap(map) }).nodes;
    const starts: Fixture[] = [];
    for (let i = 0; i < 12000 && starts.length < pairs; i++) {
      const a = nodes[Math.floor(draw() * nodes.length)], b = nodes[Math.floor(draw() * nodes.length)];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < 3 || d > 12) continue;
      const f = { reference, a, b, angle: (draw() - .5) * .7, direction: draw() < .5 ? -1 : 1 };
      if (clearStart(f, false) && clearStart(f, true)) starts.push(f);
    }
    if (starts.length !== pairs) throw Error('Insufficient paired close-contact starts on ' + map);
    return [false, true].map(moving => {
      const score = (model: NeuralPolicyModel) => {
        let byHalfSecond = 0, byTwoSeconds = 0;
        const hitsByStart = starts.map(() => 0);
        for (const [i, f] of starts.entries()) for (const reverse of [false, true]) {
          const { game, pilot, target } = encounter(f, reverse, moving, model);
          for (let tick = 1; tick <= 2 * TICK_HZ && pilot.alive && target.alive; tick++) {
            game.step();
            if (game.snapshot().events.some(e => e.t === 'hit' && e.shooter === 'pilot' && e.victim === 'target' && e.dmg > 0)) {
              byTwoSeconds++; hitsByStart[i]++;
              if (tick <= TICK_HZ / 2) byHalfSecond++;
              break;
            }
          }
        }
        return { totals: { byHalfSecond, byTwoSeconds }, hitsByStart };
      };
      const pilot = score(candidate), rival = score(incumbent);
      return { map, reference, moving, trials: starts.length * 2, candidate: pilot.totals, incumbent: rival.totals,
        incumbentMargins: rival.hitsByStart.map((hits, i) => hits - pilot.hitsByStart[i]) };
    });
  });
}
