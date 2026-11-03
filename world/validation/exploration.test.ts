import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAMPS, CHESTS, FEATHERS, GLIDE, PUZZLES, STATUES, TRIALS, campEncounterId, feathersSpare, flagCamp, flagChest, flagFeather, flagGlide,
  flagPuzzle, flagTrial, glideLevel, glideScale, parseCampEncounter, regionExploration, regionItems, solvePuzzle, traceBeam,
} from '../src/exploration/catalog.ts';
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
  const challenges = new Set([...PUZZLES.map(p => flagPuzzle(p.id)), ...TRIALS.map(t => flagTrial(t.id)), ...CAMPS.map(c => flagCamp(c.id))]);
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
