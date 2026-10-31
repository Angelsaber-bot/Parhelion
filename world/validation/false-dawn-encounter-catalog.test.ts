import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFalseDawnEncounterSpec } from '../src/falseDawnEncounterCatalog';
import { FALSE_DAWN_ENCOUNTERS } from '../src/falseDawnCampaign';
import { ENEMY_ROLES } from '../src/enemyRoles';
import { STORY_ENCOUNTER_LIMITS } from '../src/storyEncounters';

test('all six authored requests have bounded role-based encounter specs and only the finale gets Warden behavior', () => {
  for (const id of FALSE_DAWN_ENCOUNTERS) {
    const spec = getFalseDawnEncounterSpec(id)!; assert.equal(spec.id, id);
    assert.ok(Object.values(spec.anchor).every(Number.isFinite));
    assert.ok(spec.actors.length > 0 && spec.actors.length <= STORY_ENCOUNTER_LIMITS.actors);
    for (const actor of spec.actors) {
      assert.ok(Object.hasOwn(ENEMY_ROLES, actor.role)); assert.ok(Math.hypot(...actor.offset) <= STORY_ENCOUNTER_LIMITS.actorOffset);
      assert.ok(actor.title?.every(text => text.length > 0));
      assert.equal(actor.pattern === 'echo-warden', id === 'false_dawn_warden');
      assert.ok(!('hp' in actor) && !('damage' in actor) && !('reward' in actor));
    }
  }
  assert.equal(getFalseDawnEncounterSpec('sun_core'), null); assert.equal(getFalseDawnEncounterSpec('__proto__'), null);
});
test('catalog calls return private specs; director/caller mutations cannot change future retries', () => {
  const first = getFalseDawnEncounterSpec('false_dawn_harbor')!;
  (first.anchor as any).x = NaN; (first.actors[0].offset as any)[0] = 999; (first.actors[0].title as any)[0] = 'changed';
  const next = getFalseDawnEncounterSpec('false_dawn_harbor')!;
  assert.ok(Number.isFinite(next.anchor.x)); assert.ok(Math.abs(next.actors[0].offset[0]) < 10); assert.notEqual(next.actors[0].title![0], 'changed');
});
