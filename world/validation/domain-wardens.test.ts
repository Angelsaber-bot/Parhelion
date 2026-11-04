import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMPS } from '../src/exploration/catalog.ts';
import { WorldCombatState, type CombatEvent } from '../src/combat.ts';
import { WARDEN_SIGNATURE, chooseEchoWardenAttack, echoWardenRadius } from '../src/echoWarden.ts';

const SIGNATURE = { britain: 'shieldbearer', blacksail: 'powder', winter: 'jaeger', kyoto: 'shinobi' } as const;
const flat = { walk: (_from: unknown, x: number, z: number) => ({ x, y: 0, z }), lineOfSight: () => true };

test('each era domain is its own fight: regional roster and a regional warden', () => {
  const domains = CAMPS.filter(c => c.style === 'domain' && c.region in SIGNATURE);
  assert.equal(domains.length, 4);
  const rosters = new Set<string>();
  for (const d of domains) {
    const signature = SIGNATURE[d.region as keyof typeof SIGNATURE];
    const actors = d.waves.flat();
    const warden = actors.filter(a => a.pattern === 'echo-warden');
    assert.equal(warden.length, 1, d.id);
    assert.equal(warden[0].role, signature, `${d.id} warden carries the ${d.region} signature`);
    assert.ok(actors.filter(a => a.role === signature).length >= 3, `${d.id} fights through its region's signature role`);
    rosters.add(actors.map(a => a.role).join());
  }
  assert.equal(rosters.size, 4, 'no two domains share a roster');
});

const warden = (role: 'shieldbearer' | 'powder' | 'jaeger' | 'shinobi', x = 4) => {
  const state = new WorldCombatState([{ id: 'story_w', kind: 'shade', p: { x, y: 0, z: 0 }, role, storyEncounter: 'sunward_test_2', storyPattern: 'echo-warden' }], []);
  const e = state.enemies[0]; e.active = true; e.mode = 'chase';
  return { state, e };
};

test('phase 2 turns on the regional signature, phase 1 never does', () => {
  // Shieldbearer: rifle rounds from the front are blocked only after the stance break.
  const s1 = warden('shieldbearer');
  s1.state.hitEnemy('story_w', 20, { source: 'ranged', origin: { x: 0, y: 0, z: 0 } });
  const p1 = s1.e.maxHp - s1.e.hp;
  s1.e.phase = 2; s1.e.mode = 'chase'; const before = s1.e.hp;
  s1.state.hitEnemy('story_w', 20, { source: 'ranged', origin: { x: 0, y: 0, z: 0 } });
  assert.ok(before - s1.e.hp < p1 * .5, 'phase 2 shield eats most of a frontal round');

  // Jäger: an aimed long shot at range, only in phase 2.
  assert.equal(chooseEchoWardenAttack({ attackCount: 2, phase: 1, role: 'jaeger' }, 14), 'burst');
  assert.equal(chooseEchoWardenAttack({ attackCount: 2, phase: 2, role: 'jaeger' }, 14), 'shot');
  assert.equal(chooseEchoWardenAttack({ attackCount: 2, phase: 2, role: 'jaeger' }, 5), 'burst', 'close in and the shot never comes');
  assert.ok(echoWardenRadius({ attack: 'shot' }) < 1.5, 'the shot is precise: a sidestep beats it');

  // Powder: a wider barrage ring that bursts where it lands.
  assert.equal(echoWardenRadius({ attack: 'burst', phase: 2, role: 'powder' }), WARDEN_SIGNATURE.kegRadius);
  assert.ok(echoWardenRadius({ attack: 'burst', phase: 1, role: 'powder' }) < WARDEN_SIGNATURE.kegRadius);
  const pw = warden('powder', 12); pw.e.phase = 2;
  const events: CombatEvent[] = [];
  for (let i = 0; i < 300 && !events.some(e => e.type === 'explode'); i++) { pw.state.step(.05, { x: 0, y: 0, z: 0 }, true, flat); events.push(...pw.state.drainEvents()); }
  assert.ok(events.some(e => e.type === 'explode'), 'the barrage blast is shown');

  // Shinobi: blinks behind the player in phase 2 only.
  const blinks = (phase: 1 | 2) => {
    const sh = warden('shinobi', 10); sh.e.phase = phase; sh.e.timer = 0;
    const seen: CombatEvent[] = [];
    for (let i = 0; i < 60; i++) { sh.state.step(.05, { x: 0, y: 0, z: 0 }, true, flat); seen.push(...sh.state.drainEvents()); }
    return seen.some(e => e.type === 'blink');
  };
  assert.equal(blinks(1), false);
  assert.equal(blinks(2), true);
});
