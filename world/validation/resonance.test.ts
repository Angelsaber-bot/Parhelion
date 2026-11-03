import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESONANCE, flagResonance, resonanceLevel, resonanceMaxHp, resonanceReady, nextResonanceCost } from '../src/resonance.ts';
import { WorldCombatState, COMBAT } from '../src/combat.ts';
import { CHESTS, CHEST_CRYSTALS } from '../src/exploration/catalog.ts';
import { MINIBOSSES } from '../src/minibosses.ts';

test('resonance thresholds rise, stay reachable, and need most of the world for the last level', () => {
  const total = CHESTS.reduce((sum, c) => sum + CHEST_CRYSTALS[c.tier], 0) + MINIBOSSES.length * 15;
  const t = RESONANCE.thresholds;
  assert.ok(t.every((v, i) => i === 0 || v > t[i - 1]), 'strictly rising');
  assert.ok(t[t.length - 1] <= total * .85, `last level reachable without 100% (${t.at(-1)} of ${total})`);
  assert.ok(t[t.length - 1] >= total * .7, 'last level still asks for most of the world');
  assert.ok(t[0] <= 50, 'first level arrives early in the valley/kingdom');
  assert.equal(resonanceMaxHp(0), COMBAT.playerHp);
  assert.equal(resonanceMaxHp(t.length), COMBAT.playerHp + t.length * RESONANCE.hpPerLevel);
  assert.equal(resonanceMaxHp(99), resonanceMaxHp(t.length)); assert.equal(resonanceMaxHp(NaN), COMBAT.playerHp);
});

test('levels are contiguous flags and readiness follows crystals gathered', () => {
  const done = new Set<string>();
  assert.equal(resonanceLevel(done), 0);
  assert.equal(resonanceReady(0, 39), false); assert.equal(resonanceReady(0, 40), true);
  done.add(flagResonance(2)); assert.equal(resonanceLevel(done), 0, 'a gap does not count');
  done.add(flagResonance(1)); assert.equal(resonanceLevel(done), 2);
  assert.equal(nextResonanceCost(2), RESONANCE.thresholds[2]);
  assert.equal(nextResonanceCost(RESONANCE.thresholds.length), null);
  assert.equal(resonanceReady(RESONANCE.thresholds.length, 10_000), false);
});

test('combat max HP follows resonance; a raise fills the new headroom; all heals respect it', () => {
  const s = new WorldCombatState([], []);
  assert.equal(s.maxHp, 100); assert.equal(s.hp, 100);
  s.hp = 60;
  s.syncWorldFlags(new Set([flagResonance(1), flagResonance(2)]));
  assert.equal(s.maxHp, 120); assert.equal(s.hp, 80, 'the raise adds its 20 HP');
  assert.equal(s.fieldHeal(100), 40); assert.equal(s.hp, 120, 'heals cap at the new maximum');
  s.syncWorldFlags(new Set([flagResonance(1), flagResonance(2)]));
  assert.equal(s.hp, 120, 'syncing the same level again changes nothing');
  s.resetAll(); assert.equal(s.hp, 120, 'a full reset restores to the resonant maximum');
  s.syncWorldFlags(new Set()); assert.equal(s.maxHp, 100); assert.equal(s.hp, 100, 'a new game drops back to the base');
});
