import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAMPS, CHESTS, FEATHERS, GLIDE, PUZZLES, STATUES, TRIALS, campEncounterId, feathersSpare, flagCamp, flagChest, flagFeather, flagGlide,
  flagPuzzle, flagTrial, glideLevel, glideScale, parseCampEncounter, regionExploration, regionItems, solvePuzzle, traceBeam,
} from '../src/exploration/catalog.ts';
import { EMBER_ROUTES, FOXFIRES, TREASURE_MAPS, canDig, emberIdle, emberKindle, emberTake, emberTick, flagDig, flagEmber, flagFox, flagMap, foxAt, foxLength, mapHeld } from '../src/exploration/regional.ts';
import { STORY_ENCOUNTER_LIMITS } from '../src/storyEncounters.ts';
import { ENEMY_ROLES } from '../src/enemyRoles.ts';
import { REGIONS } from '../src/regions.ts';

test('every prism puzzle starts unsolved and has exactly one solution', () => {
  for (const p of PUZZLES) {
    assert.equal(traceBeam(p, p.prisms.map(x => x.start)).solved, false, p.id);
    const solutions = solvePuzzle(p);
    assert.equal(solutions.length, 1, `${p.id}: ${JSON.stringify(solutions)}`);
    // the solution actually lights every prism on the way
    assert.equal(traceBeam(p, solutions[0]).lit.size, p.prisms.length, p.id);
  }
});

test('a blocker stops the beam', () => {
  const camelot = PUZZLES.find(p => p.id === 'camelot')!;
  const solved = solvePuzzle(camelot)[0];
  const blocked = [...solved]; blocked[2] = 0; // aim C straight at the receiver through the pillar
  const trace = traceBeam(camelot, blocked);
  assert.equal(trace.solved, false);
  assert.equal(trace.nodes.at(-1)!.kind, 'blocker');
});

test('ids are unique and reward chests point at real challenges', () => {
  const ids = [...CHESTS.map(c => c.id), ...FEATHERS.map(f => f.id)];
  assert.equal(new Set(CHESTS.map(c => c.id)).size, CHESTS.length);
  assert.equal(new Set(FEATHERS.map(f => f.id)).size, FEATHERS.length);
  assert.ok(ids.every(id => /^[a-z0-9_]+$/.test(id)));
  const challenges = new Set([...PUZZLES.map(p => flagPuzzle(p.id)), ...TRIALS.map(t => flagTrial(t.id)), ...CAMPS.map(c => flagCamp(c.id)),
    ...TREASURE_MAPS.map(m => flagDig(m.id)), ...EMBER_ROUTES.map(e => flagEmber(e.id)), ...FOXFIRES.map(f => flagFox(f.id))]);
  for (const c of CHESTS) if (c.requires) assert.ok(challenges.has(c.requires), c.id);
  for (const flag of challenges) assert.ok(CHESTS.some(c => c.requires === flag) || CAMPS.some(c => c.requires === flag), `nothing unlocks from ${flag}`);
  for (const camp of CAMPS) if (camp.requires) assert.ok(challenges.has(camp.requires), camp.id);
});

test('content stays inside its region play area', () => {
  const inside = (region: string, x: number, z: number) => {
    const r = REGIONS.find(r => r.id === region)!; const lx = x - r.offset[0], lz = z - r.offset[1];
    return lx > r.play[0] && lx < r.play[1] && lz > r.play[2] && lz < r.play[3];
  };
  for (const c of CHESTS) assert.ok(inside(c.region, ...c.p), c.id);
  for (const f of FEATHERS) assert.ok(inside(f.region, ...f.p), f.id);
  for (const s of STATUES) assert.ok(inside(s.region, ...s.p), s.id);
  for (const t of TRIALS) for (const o of t.orbs) assert.ok(inside(t.region, ...o.p), t.id);
  for (const p of PUZZLES) for (const x of [p.source.p, p.receiver, ...p.prisms.map(q => q.p)]) assert.ok(inside(p.region, ...x), p.id);
});

test('camp waves fit the story encounter director limits', () => {
  for (const camp of CAMPS) {
    assert.ok(camp.waves.length >= 2, camp.id);
    camp.waves.forEach((wave, i) => {
      assert.ok(wave.length > 0 && wave.length <= STORY_ENCOUNTER_LIMITS.actors, camp.id);
      for (const actor of wave) {
        assert.ok(Object.hasOwn(ENEMY_ROLES, actor.role));
        assert.ok(Math.hypot(...actor.offset) <= STORY_ENCOUNTER_LIMITS.actorOffset);
      }
      assert.deepEqual(parseCampEncounter(campEncounterId(camp.id, i)), { camp: camp.id, wave: i });
    });
  }
  assert.equal(parseCampEncounter('adventure_guard_1'), null);
});

test('exploration percent, crystals and glider levels follow saved flags', () => {
  const done = new Set<string>();
  const items = regionItems('britain');
  assert.ok(items.length >= 30);
  assert.equal(regionExploration('britain', done).percent, 0);
  done.add(flagChest(CHESTS[0].id)); done.add(flagPuzzle(PUZZLES[0].id));
  const ex = regionExploration('britain', done);
  assert.equal(ex.done, 2); assert.ok(ex.crystals > 0);
  for (const f of FEATHERS.slice(0, 4)) done.add(flagFeather(f.id));
  assert.equal(glideLevel(done), 0); assert.equal(feathersSpare(done), 4);
  done.add(flagGlide(1));
  assert.equal(glideLevel(done), 1); assert.equal(feathersSpare(done), 4 - GLIDE.feathersPerLevel);
  const g = glideScale(1); assert.ok(g.speed > 1 && g.sink < 1);
  assert.ok(regionExploration('kyoto', done).total >= 30);
  assert.equal(regionExploration('kyoto', done).done, 0);
});

test('every region has its own exploration layer with unique challenge ids', () => {
  for (const region of ['alpha', 'britain', 'blacksail', 'winter', 'kyoto'] as const) {
    assert.ok(regionItems(region).length >= 15, region);
    assert.ok(STATUES.some(s => s.region === region), region);
  }
  for (const list of [PUZZLES, TRIALS, CAMPS]) assert.equal(new Set(list.map(x => x.id)).size, list.length);
});

test('full-map exploration icons hide chests/feathers and grey out cleared sites', async () => {
  const { explorationMapIcons } = await import('../src/exploration/mapIcons.ts');
  const done = new Set<string>();
  const icons = explorationMapIcons(done);
  assert.equal(icons.filter(i => i.kind === 'statue').length, STATUES.length);
  assert.ok(icons.every(i => !i.cleared));
  assert.equal(new Set(icons.map(i => i.id)).size, icons.length);
  const camp = CAMPS.find(c => !c.style)!; done.add(flagCamp(camp.id));
  assert.ok(explorationMapIcons(done).find(i => i.id === `camp:${camp.id}`)!.cleared);
});

test('each era owns a signature mechanic; copied prism puzzles are gone outside Britain and the valley', () => {
  for (const region of ['blacksail', 'winter', 'kyoto'] as const) {
    assert.equal(PUZZLES.filter(p => p.region === region).length, 0, region);
    assert.ok(!TRIALS.some(t => t.region === region && /_run$/.test(t.id)), region);
  }
  assert.ok(TREASURE_MAPS.every(m => m.region === 'blacksail'));
  assert.ok(EMBER_ROUTES.every(e => e.region === 'winter'));
  assert.ok(FOXFIRES.every(f => f.region === 'kyoto'));
  // each domain outside Britain is opened by its era mechanic
  assert.equal(CAMPS.find(c => c.id === 'sunken_vault')!.requires, flagDig('blackbeard'));
  assert.equal(CAMPS.find(c => c.id === 'frozen_chapel')!.requires, flagEmber('chapel_road'));
  assert.equal(CAMPS.find(c => c.id === 'lotus_hall')!.requires, flagFox('lotus_path'));
});

test('treasure maps chain bottle → dig → next map, and nobody digs blind', () => {
  const done = new Set<string>();
  const [a, b, c] = TREASURE_MAPS;
  assert.equal(canDig(a, done), false);
  done.add(flagMap(a.id)); assert.ok(mapHeld(a, done) && !mapHeld(b, done));
  done.add(flagDig(a.id)); assert.ok(!mapHeld(a, done) && mapHeld(b, done));
  done.add(flagDig(b.id)); assert.ok(mapHeld(c, done));
  done.add(flagDig(c.id)); assert.ok(TREASURE_MAPS.every(m => !mapHeld(m, done)));
  for (const m of TREASURE_MAPS) assert.ok(CHESTS.some(ch => ch.buried && ch.requires === flagDig(m.id) && Math.hypot(ch.p[0] - m.dig[0], ch.p[1] - m.dig[1]) < 1), m.id);
});

test('ember relay: in-order kindling, per-leg timers, expiry resets', () => {
  for (const route of EMBER_ROUTES) {
    assert.equal(route.seconds.length, route.beacons.length);
    let prev = route.brazier;
    route.beacons.forEach((p, i) => { const d = Math.hypot(p[0] - prev[0], p[1] - prev[1]); assert.ok(d / 9 + 1 < route.seconds[i] && route.seconds[i] < d / 5.5, `${route.id} leg ${i} must need a sprint`); prev = p; });
    let st = emberTake(route);
    assert.deepEqual(emberKindle(route, st, 1), { ok: false, reason: 'wrong-beacon' });
    for (let i = 0; i < route.beacons.length; i++) { const r = emberKindle(route, st, i); assert.ok(r.ok); if (r.ok) { st = r.state; assert.equal(r.finished, i === route.beacons.length - 1); } }
    assert.equal(st.route, null);
  }
  const route = EMBER_ROUTES[0]; const t = emberTick(emberTake(route), route.seconds[0] + .1);
  assert.ok(t.expired); assert.deepEqual(t.state, emberIdle());
  assert.deepEqual(emberKindle(route, emberIdle(), 0), { ok: false, reason: 'no-ember' });
});

test('fox-fire paths are continuous, sprintable and end where they promise', () => {
  for (const f of FOXFIRES) {
    assert.deepEqual(f.path[0], f.shrine);
    for (let i = 1; i < f.path.length; i++) assert.ok(Math.hypot(f.path[i][0] - f.path[i - 1][0], f.path[i][1] - f.path[i - 1][1]) <= 15, f.id);
    assert.ok(f.speed < 9 && f.speed > 5.5, 'walking loses the fox, sprinting keeps up');
    const end = foxAt(f, foxLength(f) + 5); assert.ok(end.end);
    assert.ok(CHESTS.some(c => c.requires === flagFox(f.id)));
  }
});
