import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOSSES, COMBAT, WorldCombatState, type CombatTerrain, type Point3 } from '../src/combat.ts';
import { WorldProgress, LEGACY_WORLD_PROGRESS_KEYS, WORLD_PROGRESS_KEY } from '../src/progress.ts';
const terrain: CombatTerrain = { walk: (_p, x, z) => ({ x, y: 0, z }), lineOfSight: () => true };
const advance = (s: WorldCombatState, seconds: number, p: Point3 = { x: 0, y: 0, z: 0 }) => {
  for (let i = 0; i < seconds * 20; i++) s.step(.05, p, true, terrain);
};
const create = (done = new Set<string>()) => new WorldCombatState([], BOSSES.map((b, i) => ({
  id: b.id, kind: 'king' as const, p: { x: i * 200, y: 0, z: 0 }, requires: b.requires, cleared: done.has(b.core),
})));
test('all chapter bosses support repeated victories with exactly one first-clear event', () => {
  const s = create(), done = new Set(BOSSES.flatMap(b => [...b.requires]));
  for (const def of BOSSES) for (let run = 0; run < 3; run++) {
    assert.equal(s.beginBoss(done, def.id), true);
    assert.equal(s.beginBoss(done, def.id), false, 'repeated interaction cannot heal/restart an active fight');
    assert.equal(s.boss.hp, COMBAT.bossHp); assert.equal(s.boss.phase, 1);
    assert.equal(s.boss.attackCount, 0); assert.equal(s.boss.hitTime, 0);
    s.hitEnemy(def.id, COMBAT.bossHp);
    assert.deepEqual(s.drainEvents().filter(e => e.type === 'victory'), [{ type: 'victory', id: def.id, firstClear: run === 0 }]);
    assert.equal(s.hitEnemy(def.id, 22), false);
  }
});
test('repeat encounter exit/death/retry resets transient fields but preserves first clear', () => {
  const s = create(new Set([BOSSES[0].core]));
  assert.equal(s.beginBoss(new Set()), true, 'legacy clear sufficient without omitted requirements');
  s.hitEnemy(s.boss.id, 1000); s.boss.attackCount = 8; s.boss.target = { x: 9, y: 1, z: 4 }; s.canShoot();
  advance(s, .1, { x: 100, y: 0, z: 0 });
  assert.equal(s.bossStarted, false); assert.equal(s.bossCleared, true);
  assert.equal(s.beginBoss(new Set()), true);
  assert.equal(s.boss.phase, 1); assert.equal(s.boss.hp, COMBAT.bossHp);
  assert.equal(s.boss.attackCount, 0); assert.deepEqual(s.boss.target, s.boss.home);
  assert.equal(s.shotCooldown, 0); assert.equal(s.hurtCooldown, 0);
  advance(s, 25);
  assert.equal(s.bossStarted, false); assert.equal(s.hp, 100); assert.equal(s.bossCleared, true);
  assert.equal(s.beginBoss(new Set()), true);
  s.hitEnemy(s.boss.id, COMBAT.bossHp);
  assert.equal(s.drainEvents().filter(e => e.type === 'victory' && e.firstClear).length, 0);
});
test('legacy migration and reload keep replay reward idempotent without altering save format', () => {
  const values = new Map<string, string>([[LEGACY_WORLD_PROGRESS_KEYS[0], JSON.stringify({ done: BOSSES[0].requires, found: ['camp'] })]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const progress = new WorldProgress(storage), s = create(progress.done);
  let rewards = 0;
  const collect = (state: WorldCombatState, p: WorldProgress) => {
    for (const event of state.drainEvents()) if (event.type === 'victory' && event.firstClear) {
      const def = BOSSES.find(b => b.id === event.id)!;
      rewards++; p.done.add(def.reward); p.done.add(def.core); p.save();
    }
  };
  s.beginBoss(progress.done); s.hitEnemy(s.boss.id, COMBAT.bossHp); collect(s, progress);
  assert.equal(rewards, 1); assert.ok(values.has(WORLD_PROGRESS_KEY));
  const reloaded = new WorldProgress(storage), replay = create(reloaded.done), snapshot = values.get(WORLD_PROGRESS_KEY);
  replay.beginBoss(reloaded.done); replay.hitEnemy(replay.boss.id, COMBAT.bossHp); collect(replay, reloaded);
  assert.equal(rewards, 1); assert.equal(values.get(WORLD_PROGRESS_KEY), snapshot);
  assert.deepEqual([...reloaded.found], ['camp']);
  replay.resetAll(false); reloaded.reset();
  assert.equal(replay.beginBoss(reloaded.done), false);
});
