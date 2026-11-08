/** Field herbs: an era-specific healing plant near every fight, a mid-fight resource that regrows. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { FIELD_HERB, HERB_KINDS, createFieldHerbs, herbCandidates, herbModel, placeHerbs } from '../src/environment/fieldHerbs.ts';
import { WorldCombatState, COMBAT } from '../src/combat/combat.ts';

const flat = () => 2;
test('every era grows its own herb near its fights, on dry level ground', () => {
  const spots = placeHerbs(flat, 0);
  for (const region of ['alpha', 'britain', 'blacksail', 'winter', 'kyoto'] as const) {
    const n = spots.filter(s => s.region === region).length;
    assert.ok(n >= 4 && n <= FIELD_HERB.maxPerRegion, `${region}: ${n}`);
  }
  assert.equal(new Set(Object.values(HERB_KINDS).map(k => k.name[0])).size, 5);
  assert.deepEqual(placeHerbs(flat, 0), spots, 'deterministic');
  assert.equal(new Set(spots.map(s => s.id)).size, spots.length);
  // Water, slopes and buildings are refused.
  assert.equal(placeHerbs(() => -1, 0).length, 0);
  assert.equal(placeHerbs((x) => x * 2, 0).length, 0);
  assert.equal(placeHerbs(flat, 0, () => true).length, 0);
  for (const c of herbCandidates()) assert.ok([c.x, c.z].every(Number.isFinite));
  for (const region of Object.keys(HERB_KINDS) as (keyof typeof HERB_KINDS)[]) {
    const m = herbModel(region), box = new THREE.Box3().setFromBufferAttribute(m.body.getAttribute('position') as THREE.BufferAttribute);
    box.union(new THREE.Box3().setFromBufferAttribute(m.glow.getAttribute('position') as THREE.BufferAttribute));
    assert.ok(box.max.y < .9 && box.min.y > -.05 && box.max.x - box.min.x < .5, `${region} is a small plant`);
    assert.ok(m.glow.getAttribute('position').count > 0, `${region} has a glowing part`);
    m.body.dispose(); m.glow.dispose();
  }
});

test('walking through a herb heals mid-fight, hides it and regrows it after 90 s', () => {
  const state = new WorldCombatState([], []); state.hp = 40;
  const eaten: number[] = [];
  const herbs = createFieldHerbs({ terrain: flat, waterLevel: 0, heal: a => state.fieldHeal(a), eaten: (_n, g) => eaten.push(g) });
  const spot = herbs.spots.find(s => s.region === 'britain')!;
  const away = new THREE.Vector3(spot.x + 20, 2, spot.z), on = new THREE.Vector3(spot.x, 2, spot.z);
  herbs.update(.05, away, 'britain', true); assert.equal(state.hp, 40);
  herbs.update(.05, on, 'kyoto', true); assert.equal(state.hp, 40, 'only the current era is live');
  herbs.update(.05, on, 'britain', false); assert.equal(state.hp, 40, 'paused or defeated: nothing happens');
  herbs.update(.05, on, 'britain', true);
  assert.equal(state.hp, 40 + FIELD_HERB.heal); assert.deepEqual(eaten, [FIELD_HERB.heal]);
  const index = herbs.spots.filter(s => s.region === 'britain').indexOf(spot);
  assert.equal(herbs.regrowing('britain')[index], FIELD_HERB.regrow);
  herbs.update(.05, on, 'britain', true); assert.equal(state.hp, 40 + FIELD_HERB.heal, 'one bite per herb');
  for (let t = 0; t < FIELD_HERB.regrow + 1; t += .1) herbs.update(.1, away, 'britain', true);
  assert.equal(herbs.regrowing('britain')[index], 0, 'grown back');
  // At full health the herb is left for later.
  state.hp = COMBAT.playerHp; herbs.update(.05, on, 'britain', true);
  assert.equal(herbs.regrowing('britain')[index], 0);
  herbs.dispose(); herbs.dispose();
});

test('fieldHeal is capped, reports what it restored and does nothing for a defeated player', () => {
  const s = new WorldCombatState([], []);
  s.hp = 90; assert.equal(s.fieldHeal(25), 10); assert.equal(s.hp, COMBAT.playerHp);
  assert.equal(s.fieldHeal(25), 0);
  s.hp = 50; assert.equal(s.fieldHeal(NaN), 0); assert.equal(s.fieldHeal(-5), 0); assert.equal(s.hp, 50);
});
