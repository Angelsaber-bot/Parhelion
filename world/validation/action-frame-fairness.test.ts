import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AUDIT_FPS, auditEvadeFrame, auditHeatFrame } from './action-frame-audit';
import { WorldActions, type ActionPoseCommand, type WorldActionContext } from '../src/worldActions';
import { WorldCombatState } from '../src/combat';

for (const fps of AUDIT_FPS) test(`actual main frame at ${fps}FPS preserves exact evade distance and fixed-step immunity`, () => {
  const result = auditEvadeFrame(fps);
  assert.ok(Math.abs(result.horizontalDistance - 13 * .24) < 1e-8, JSON.stringify(result));
  assert.ok(Math.abs(result.evadeSeconds - .24) < 1e-8, JSON.stringify(result));
  assert.ok(Math.abs(result.iframeSeconds - 17 / 120) < 1e-8, JSON.stringify(result));
  assert.equal(result.combatProtectedTicks, 2, 'same20Hz impact samples at all display rates');
});

test('held fire preserves long-run cadence and8-round vent across27/30/60/120FPS', () => {
  const runs = AUDIT_FPS.map(fps => auditHeatFrame(fps, 60));
  assert.equal(new Set(runs.map(r => r.shots)).size, 1, JSON.stringify(runs));
  assert.ok(runs[0].shots >= 230 && runs[0].shots <= 234, 'roughly3.85 sustained rounds/s, not unlimited auto fire');
  for (const run of runs) assert.ok(Math.abs(run.ventSeconds - 1.1) <= 1 / run.fps + 1e-9, JSON.stringify(run));
  const state = new WorldCombatState([], []);
  for (let i = 0; i < 100; i++) state.step(.05, { x: 0, y: 0, z: 0 }, true, { walk: () => null, lineOfSight: () => true });
  assert.equal(state.canShoot(), true); assert.equal(state.canShoot(), false, 'long idle never banks an immediate second shot');
});

for (const fps of AUDIT_FPS) test(`${fps}FPS pause cancels cast contacts, clears guard and preserves paid cooldown`, () => {
  const context: WorldActionContext = { enabled: true, grounded: true, armed: true, bladeReady: true, position: { x: 0, y: 0, z: 0 }, yaw: 0, moveX: 0, moveZ: 0, identity: 'saber' };
  let command: ActionPoseCommand | undefined, strikes = 0, defense = { guard: 1, invulnerable: false };
  const actions = new WorldActions({ scene: new THREE.Scene(), context: () => context,
    strike: () => { strikes++; return { damage: 0, hits: [], kills: [] }; }, defense: value => { defense = value; },
    startPose: (_id, value) => { command = value; return true; }, cancelPoses() {}, toast() {}, reducedEffects: () => true,
  });
  actions.press('skill'); for (let i = 0; i < 12; i++) actions.update(1 / 120);
  const paidCooldown = actions.skills.cooldown('skill'); assert.ok(paidCooldown > 0);
  context.enabled = false;
  for (let i = 0; i < fps * 2; i++) actions.update(1 / fps);
  assert.equal(actions.skills.cooldown('skill'), paidCooldown); assert.deepEqual(defense, { guard: 1, invulnerable: false });
  command!.onContact(context.position, { x: 0, y: 0, z: -1 }); actions.flush();
  context.enabled = true; for (let i = 0; i < 120; i++) actions.update(1 / 120);
  assert.equal(strikes, 0, 'paused animation contact cannot become delayed damage');
  assert.ok(Math.abs(actions.skills.cooldown('skill') - (paidCooldown - 1)) < 1e-8);
  actions.dispose();
});

for (const fps of AUDIT_FPS) test(`${fps}FPS boss aim stays locked while the player exits the tell`, () => {
  const state = new WorldCombatState([], { id: 'boss_vacant_king', kind: 'king', p: { x: 0, y: 0, z: 0 }, requires: [] });
  state.beginBoss(new Set());
  const player = { x: 12, y: 0, z: 0 }, original = { ...player };
  let acc = 0, locked = false;
  for (let frame = 0; frame < Math.ceil(fps * 3.5); frame++) {
    acc += 1 / fps;
    while (acc + 1e-9 >= .05) {
      state.step(.05, player, true, { walk: (_p, x, z) => ({ x, y: 0, z }), lineOfSight: () => true });
      if (!locked && state.boss.mode === 'windup') { locked = true; assert.deepEqual(state.boss.target, original); player.z = 12; }
      acc = Math.max(0, acc - .05);
    }
  }
  assert.equal(locked, true); assert.deepEqual(state.boss.target, original); assert.equal(state.hp, 100);
});
