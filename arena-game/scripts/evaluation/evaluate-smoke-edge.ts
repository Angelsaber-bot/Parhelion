// Isolate the reported case: a stationary player initially visible only as a smoke-edge silhouette.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { getMap } from '../../shared/arenaMap.ts';
import { navFor } from '../../shared/botLocomotion.ts';
import { SMOKE, TICK_HZ } from '../../shared/content.ts';
import { settleSmoke } from '../../shared/grenade.ts';
import { humanObservation } from '../../shared/humanCombat.ts';
import { bundledOpponent, directPolicy, learnedOpponent } from '../../shared/learnedOpponent.ts';
import { Match } from '../../shared/match.ts';
import { parseNeuralPolicy } from '../../shared/neuralPolicy.ts';

const { values } = parseArgs({ options: { model: { type: 'string' }, seed: { type: 'string', default: '82319137' } } });
let state = Number(values.seed);
if (!Number.isSafeInteger(state) || state < 0 || state > 0xffffffff) throw Error('Invalid trial seed');
const draw = () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) + .5) / 2**32;
const policy = values.model ? parseNeuralPolicy(JSON.parse(readFileSync(values.model, 'utf8'))) : bundledOpponent;
if (!directPolicy(policy)) throw Error('Expected learned Arena weights');

const records = [];
for (const id of ['sakura', 'orleans', 'aster', 'camlann']) {
  const map = getMap(id), nav = navFor({ map });
  for (let trial = 0; trial < 6; trial++) {
    const match = new Match(map, '1v1');
    match.addPlayer('pilot', { char: 2, team: 'A', skins: [], name: 'Pilot', bot: true }, learnedOpponent(policy));
    match.addPlayer('player', { char: 2, team: 'B', skins: [], name: 'Player', bot: false });
    const pilot = match.player('pilot')!, target = match.player('player')!;
    const contact = () => humanObservation(map, pilot,
      [{ team: 'B', crouched: false, feet: [target.x, target.y, target.z] }],
      (a, b) => match.heroes.visible(a, b), [0, 0], undefined, undefined,
      (a, b) => match.heroes.visible(a, b, true))[0];
    let placed = false;
    for (let attempt = 0; attempt < 3000 && !placed; attempt++) {
      match.smokes = [];
      const start = nav.nodes[Math.floor(draw() * nav.nodes.length)], bearing = draw() * Math.PI * 2;
      const end = nav.nearest(start.x + Math.sin(bearing) * 6, start.y, start.z + Math.cos(bearing) * 6);
      if (!end || Math.abs(start.y - end.y) > .5 || Math.hypot(end.x - start.x, end.z - start.z) < 4.2) continue;
      const facing = Math.atan2(start.x - end.x, start.z - end.z) + (draw() - .5) * .45;
      Object.assign(pilot, { x: start.x, y: start.y, z: start.z, yaw: facing, pitch: 0 });
      Object.assign(target, { x: end.x, y: end.y, z: end.z });
      if (contact() !== 1) continue;
      const angle = draw() * 2 * Math.PI, radius = SMOKE.radius * (.8 + .4 * draw());
      match.smokes.push(settleSmoke(map, { id: 1, owner: 'player', life: SMOKE.life - 90,
        x: end.x + Math.sin(angle) * radius, y: end.y, z: end.z + Math.cos(angle) * radius }));
      placed = contact() === .5;
    }
    if (!placed) throw Error('Unable to place a stationary silhouette on ' + id);
    match.phase = 'live';
    match.phaseT = 10 * TICK_HZ;
    for (const slot of match.slots.values()) slot.spawnProtectedUntilTick = 0;
    let clear: number | null = null, hit: number | null = null;
    for (let tick = 0; tick < 6 * TICK_HZ && target.alive; tick++) {
      if (clear === null && contact() === 1) clear = tick;
      match.step();
      const events = match.snapshot().events;
      if (hit === null && events.some(e => e.t === 'hit' && e.shooter === 'pilot' && e.victim === 'player')) hit = tick;
    }
    records.push({ map: id, clear, hit });
  }
}
console.log(JSON.stringify({ trials: records.length, clear: records.filter(r => r.clear !== null).length,
  hit: records.filter(r => r.hit !== null).length, hitUnder2s: records.filter(r => r.hit !== null && r.hit < 2 * TICK_HZ).length,
  seed: Number(values.seed), records }));
