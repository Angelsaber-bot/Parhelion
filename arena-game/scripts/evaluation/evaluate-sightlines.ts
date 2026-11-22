// Paired sightlines in the actual match simulation. A shot only counts when its target is still visible and in band.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { getMap } from '../../shared/arenaMap.ts';
import { navFor } from '../../shared/botLocomotion.ts';
import { TICK_HZ } from '../../shared/content.ts';
import { humanObservation } from '../../shared/humanCombat.ts';
import { directPolicy, learnedOpponent } from '../../shared/learnedOpponent.ts';
import { Match } from '../../shared/match.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from '../../shared/neuralPolicy.ts';

export function sightlines(model: NeuralPolicyModel, seed: number, maps: string[], repeats: number) {
  const rows = [];
  let state = Number(seed);
  const draw = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) + .5) / 2 ** 32;
  for (const [low, high] of [[8, 15], [30, 45], [45, 85]]) {
    let trials = 0, fired = 0, hit = 0, blindShots = 0, missedShots = 0;
    for (const id of maps) {
      const map = getMap(id), mesh = navFor({ map });
      for (let repeat = 0; repeat < repeats; repeat++) {
        const game = new Match(map, '1v1');
        game.addPlayer('pilot', { name: 'Pilot', team: 'A', char: 2, bot: true, skins: [] }, learnedOpponent(model));
        game.addPlayer('target', { name: 'Target', team: 'B', char: 2, bot: false, skins: [] });
        const pilot = game.player('pilot')!, target = game.player('target')!;
        const seen = () => humanObservation(map, pilot, [{ team: 'B', crouched: target.crouched, feet: [target.x, target.y, target.z] }],
          (a, b) => game.heroes.visible(a, b), [0, 0])[0] === 1;
        const distance = () => Math.hypot(pilot.x - target.x, pilot.z - target.z);
        let placed = false;
        for (let attempt = 0; attempt < 1200 && !placed; attempt++) {
          const a = mesh.nodes[Math.floor(draw() * mesh.nodes.length)], b = mesh.nodes[Math.floor(draw() * mesh.nodes.length)];
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          if (d < low || d >= high) continue;
          Object.assign(pilot, { x: a.x, y: a.y, z: a.z, yaw: Math.atan2(a.x - b.x, a.z - b.z) + (draw() - .5) * .16, pitch: Math.atan2(b.y - a.y, d), grounded: true });
          Object.assign(target, { x: b.x, y: b.y, z: b.z, grounded: true });
          placed = seen();
        }
        if (!placed) continue;
        trials++;
        game.phase = 'live'; game.phaseT = 5 * TICK_HZ;
        for (const s of game.slots.values()) s.spawnProtectedUntilTick = 0;
        let shot = false, landed = false;
        for (let t = 0; t < 3 * TICK_HZ && target.alive; t++) {
          const visible = seen();
          const valid = visible && distance() >= low && distance() < high;
          game.step();
          const events = game.snapshot().events;
          if (events.some(e => e.t === 'shot' && e.id === 'pilot')) {
            const damage = events.some(e => e.t === 'hit' && e.shooter === 'pilot' && e.victim === 'target');
            if (!visible) blindShots++;
            if (!damage) missedShots++;
            if (!valid) continue;
            shot = true;
            landed ||= damage;
          }
        }
        fired += Number(shot); hit += Number(landed);
      }
    }
    rows.push({ low, high, trials, fired, hit, blindShots, missedShots });
  }
  return rows;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [path, seed = '859243'] = process.argv.slice(2);
  const model = parseNeuralPolicy(JSON.parse(readFileSync(path, 'utf8')));
  if (!directPolicy(model)) throw Error('Expected a direct Arena policy');
  for (const row of sightlines(model, Number(seed), ['frostcourt', 'camlann', 'orleans', 'suntemple', 'lishan', 'aster'], 5)) console.log(JSON.stringify(row));
}
