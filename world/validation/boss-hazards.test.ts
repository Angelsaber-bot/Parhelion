import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOSSES, WorldCombatState, type CombatEvent } from '../src/combat.ts';
import { BOSS_HAZARDS, hazardContains, planBossHazards, type HazardPlan } from '../src/bossHazards.ts';

const O = { x: 0, y: 0, z: 0 };
const flat = { walk: (_from: unknown, x: number, z: number) => ({ x, y: 0, z }), lineOfSight: () => true };
const hits = (plans: HazardPlan[], p: { x: number; y: number; z: number }) => plans.filter(h => hazardContains(h, p));
const ring = (r: number) => Array.from({ length: 32 }, (_, i) => ({ x: Math.cos(i / 16 * Math.PI) * r, y: 0, z: Math.sin(i / 16 * Math.PI) * r }));

test('every era boss has its own arena mechanic', () => {
  assert.deepEqual(Object.keys(BOSS_HAZARDS).sort(), BOSSES.map(b => b.id).sort());
  const shapes = new Set(BOSSES.map(b => planBossHazards(b.id, { x: 0, y: 0, z: -12 }, O, { x: 0, z: 0 }, 0).map(h => h.shape).join()));
  assert.equal(shapes.size, 4, 'four different reads, not one hazard recoloured');
});

test('standing still is punished; the right answer is always within reach', () => {
  const boss = { x: 0, y: 0, z: -12 };
  for (const b of BOSSES) {
    for (const v of [{ x: 0, z: 0 }, { x: 5, z: 0 }]) for (let volley = 0; volley < 2; volley++) {
      const plans = planBossHazards(b.id, boss, O, v, volley);
      if (b.id === 'boss_winter_warden') {
        // hold the centre through the ring, then leave before the centre freezes
        const [bloom, core] = plans;
        assert.ok(!hazardContains(bloom, O) && hazardContains(core, O));
        assert.ok(core.delay - bloom.delay >= 1, 'a full second to step out of the centre');
        assert.ok(ring(3).every(p => !hazardContains(core, p)), 'three metres out is clear once the ring has burst');
        continue;
      }
      assert.ok(hits(plans, O).length > 0, `${b.id} lands on a player who never moves`);
      const first = Math.min(...plans.map(h => h.delay));
      // a safe spot a running player (6 m/s) reaches before the first burst
      const reach = 6 * first;
      const safe = [2, 3, 4, 5, 6].filter(r => r <= reach).some(r => ring(r).some(p => hits(plans, p).length === 0));
      assert.ok(safe, `${b.id} volley ${volley} leaves an escape within ${reach.toFixed(1)} m`);
    }
  }
});

test('hellfire pillars follow the running line; doubling back escapes them', () => {
  const plans = planBossHazards('boss_hellfire_lord', { x: 0, y: 0, z: -12 }, O, { x: 6, z: 0 }, 0);
  assert.ok(hits(plans, { x: 8, y: 0, z: 0 }).length > 0, 'keeping the same line runs into them');
  assert.equal(hits(plans, { x: -3, y: 0, z: 0 }).length, 0, 'doubling back is clear');
});

const fight = (id: string) => {
  const state = new WorldCombatState([], BOSSES.map((b, i) => ({ id: b.id, kind: 'king' as const, p: { x: i * 400, y: 0, z: -8 } })));
  assert.ok(state.beginBoss(new Set(BOSSES.flatMap(b => b.requires)), id));
  const p = { ...state.boss.p, z: 0 };
  return { state, p };
};
const run = (state: WorldCombatState, p: { x: number; y: number; z: number }, seconds: number, each?: () => void) => {
  const events: CombatEvent[] = [];
  for (let t = 0; t < seconds; t += .05) { each?.(); state.step(.05, p, true, flat); events.push(...state.drainEvents()); }
  return events;
};

test('phase 1 never lays hazards; phase 2 names the mechanic, telegraphs it and makes it land', () => {
  for (const b of BOSSES) {
    const { state, p } = fight(b.id);
    state.boss.timer = 99; // keep the boss's own swings out of the measurement
    assert.ok(!run(state, p, 12).some(e => e.type === 'hazard'), `${b.id} phase 1`);
    state.boss.phase = 2;
    const events = run(state, p, BOSS_HAZARDS[b.id].first + 3, () => { state.boss.mode = 'chase'; state.boss.timer = 99; });
    const sig = events.find(e => e.type === 'signature');
    assert.ok(sig && sig.type === 'signature' && sig.name[0] === BOSS_HAZARDS[b.id].name[0]);
    assert.ok(events.some(e => e.type === 'hazard'));
    assert.ok(events.some(e => e.type === 'hazardBurst' && e.hit), `${b.id} lands on a still player`);
    assert.ok(events.some(e => e.type === 'hurt'));
  }
});

test('evading through a burst is a perfect evade; a reset clears every telegraph', () => {
  const { state, p } = fight('boss_vacant_king');
  state.boss.phase = 2;
  const events = run(state, p, BOSS_HAZARDS.boss_vacant_king.first + 2, () => { state.boss.timer = 99; state.setDefense({ guard: 1, invulnerable: true }); });
  assert.ok(events.some(e => e.type === 'perfectEvade'));
  assert.ok(!events.some(e => e.type === 'hurt'));
  for (let t = 0; t < 10 && !state.hazards.length; t += .05) { state.boss.timer = 99; state.step(.05, p, true, flat); }
  assert.ok(state.hazards.length > 0, 'the next volley is pending');
  state.resetBoss();
  const after = run(state, p, .1);
  assert.ok(after.some(e => e.type === 'hazardClear'));
  assert.equal(state.hazards.length, 0);
});
