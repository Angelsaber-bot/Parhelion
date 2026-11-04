import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldRelayCore } from '../../arena-game/worker/worldRelay.ts';
import { WorldCombatState, type CombatEvent } from '../src/combat.ts';
import { CoopSession, type CoopSocket } from '../src/coop/coopSession.ts';
import { decodeEnemies, decodeHit, decodeState, encodeEnemy, encodeState, newRoomCode, normalizeRoomCode, type PlayerWireState } from '../src/coop/coopProtocol.ts';
import { PartnerTrack, PARTNER_DELAY_MS } from '../src/coop/partnerAvatar.ts';
import { enemySnapshot } from '../src/coop/worldCoop.ts';

const pose = (x: number, extra: Partial<PlayerWireState> = {}): PlayerWireState => ({ p: [x, 0, 0], f: 0, v: 0, g: 1, sw: 0, gl: 0, a: 0, pi: 0, fi: 0, ar: 1, gun: 'lumen', mel: 'blade', hp: 100, max: 100, ...extra });
const flat = { walk: (_from: unknown, x: number, z: number) => ({ x, y: 0, z }), lineOfSight: () => true };

test('room codes are short, unambiguous and forgiving to type', () => {
  for (let i = 0; i < 50; i++) assert.match(newRoomCode(), /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(normalizeRoomCode(' ab-cd2 '), 'ABCD2');
  assert.equal(normalizeRoomCode('ab0d1'), null, 'O/0/I/1 never appear in a code');
  assert.equal(normalizeRoomCode('abc'), null);
});

test('untrusted partner messages are clamped or rejected, never half-applied', () => {
  const ok = decodeState(encodeState(pose(3.14159, { m: [.512, 1, 'hammer'], name: 'x'.repeat(40) })));
  assert.ok(ok); assert.deepEqual(ok.p, [3.14, 0, 0]); assert.equal(ok.m?.[2], 'hammer'); assert.equal(ok.name?.length, 24);
  assert.equal(decodeState({ ...pose(0), p: [0, NaN, 0] }), null);
  assert.equal(decodeState({ ...pose(0), p: [9e9, 0, 0] }), null);
  const clamped = decodeState({ ...pose(0), v: 999, a: 4, pi: -9, mel: 'chainsaw', m: [7, 9, 'blade'] })!;
  assert.equal(clamped.v, 40); assert.equal(clamped.a, 1); assert.equal(clamped.pi, -1.5); assert.equal(clamped.mel, 'blade'); assert.deepEqual(clamped.m, [1, 2, 'blade']);
  assert.equal(decodeHit({ id: 'wild_1', damage: 0, source: 'melee' }), null);
  assert.equal(decodeHit({ id: 'wild_1', damage: 9999, source: 'melee' }), null);
  assert.equal(decodeHit({ id: 'wild_1', damage: 12, source: 'laser' }), null);
  assert.equal(decodeEnemies(Array.from({ length: 81 }, () => ({ id: 'a', p: [0, 0, 0], hp: 1, mode: 'idle' }))), null);
  assert.equal(decodeEnemies([{ id: 'a', p: [0, 0], hp: 1, mode: 'idle' }]), null);
});

/** Two sessions joined through the real relay core, with in-memory sockets. */
function pair() {
  const relay = new WorldRelayCore();
  let next = 0;
  const log: Record<string, unknown[]> = { a: [], b: [] };
  const make = (name: 'a' | 'b') => {
    const id = `p${next++}`;
    let socket!: CoopSocket & { readyState: number };
    const session = new CoopSession({
      partnerState: s => log[name].push(['state', s]), enemies: e => log[name].push(['enemies', e]), hit: h => log[name].push(['hit', h]),
      event: e => log[name].push(['event', e]), role: host => log[name].push(['role', host]),
    }, () => {
      socket = { readyState: 1, onopen: null, onmessage: null, onclose: null, onerror: null,
        send: data => relay.message(id, data), close: () => { relay.leave(id); } };
      queueMicrotask(() => relay.join(id, data => socket.onmessage?.({ data })));
      return socket;
    }, 'ws://test/world');
    return { session, id, close: () => socket.onclose?.({ code: 1006 }) };
  };
  return { relay, log, make };
}

test('two players pair through the relay; only the host publishes enemies and only the host takes hits', async () => {
  const { relay, log, make } = pair();
  const a = make('a'); a.session.connect('ABCDE'); await Promise.resolve();
  assert.equal(a.session.status, 'waiting'); assert.equal(a.session.host, true);
  const b = make('b'); b.session.connect('ABCDE'); await Promise.resolve();
  assert.equal(a.session.status, 'paired'); assert.equal(b.session.status, 'paired'); assert.equal(b.session.host, false);

  assert.ok(a.session.send('state', encodeState(pose(5))));
  assert.ok(b.session.send('hit', { id: 'wild_1', damage: 18, source: 'melee' }));
  assert.ok(a.session.send('enemies', [encodeEnemy({ id: 'wild_1', p: { x: 1, y: 0, z: 2 }, hp: 40, mode: 'windup', timer: .5, target: { x: 3, y: 0, z: 4 }, attack: 'sweep', phase: 1 })]));
  // A guest cannot forge enemy state (the relay drops it), and a host ignores relayed enemies anyway.
  assert.equal(b.session.send('enemies', []), true); assert.equal(relay.message(b.id, JSON.stringify({ t: 'enemies', d: [] })), false);
  const bStates = log.b.filter(e => (e as unknown[])[0] === 'state'), bEnemies = log.b.filter(e => (e as unknown[])[0] === 'enemies');
  assert.equal(bStates.length, 1); assert.equal(bEnemies.length, 1);
  assert.deepEqual(((bEnemies[0] as unknown[])[1] as { t: number[] }[])[0].t, [3, 0, 4]);
  assert.deepEqual(log.a.filter(e => (e as unknown[])[0] === 'hit').map(e => (e as unknown[])[1]), [{ id: 'wild_1', damage: 18, source: 'melee' }]);
  assert.equal(log.a.filter(e => (e as unknown[])[0] === 'enemies').length, 0);

  // The host leaves: the guest's game takes over the world.
  a.session.leave();
  assert.equal(b.session.status, 'waiting'); assert.equal(b.session.host, true); assert.equal(relay.host, b.id);
});

test('the partner is drawn slightly in the past, interpolated, and snaps across long jumps', () => {
  const track = new PartnerTrack();
  track.push(pose(0), 1000); track.push(pose(1), 1066);
  const mid = track.sample(1033 + PARTNER_DELAY_MS)!;
  assert.ok(Math.abs(mid.p[0] - .5) < .02);
  assert.equal(track.sample(5000)!.p[0], 1, 'starved: hold, never extrapolate');
  track.push(pose(400), 1132);
  assert.equal(track.sample(1140)!.p[0], 400, 'travel snaps instead of sliding');
});

test('host enemies fight the nearer player; a hit on the partner is sent, not taken', () => {
  const state = new WorldCombatState([{ id: 'wild_t', kind: 'shade', p: { x: 40, y: 0, z: 0 } }], []);
  const local = { x: 0, y: 0, z: 0 };
  state.partner = { x: 42, y: 0, z: 0 };
  const events: CombatEvent[] = [];
  for (let i = 0; i < 400 && !events.some(e => e.type === 'partnerHurt'); i++) { state.step(.05, local, true, flat); events.push(...state.drainEvents()); }
  assert.ok(events.some(e => e.type === 'partnerHurt'), 'the enemy beside the partner attacks the partner');
  assert.equal(state.hp, state.maxHp, 'the host never takes the partner\'s hit');
  assert.ok(!events.some(e => e.type === 'hurt'));
});

test('guest mirrors host enemies, reports its hits, and the host applies them without double bonuses', () => {
  const guest = new WorldCombatState([{ id: 'wild_t', kind: 'shade', p: { x: 5, y: 0, z: 0 } }], []);
  guest.remoteEnemies = true;
  const e = guest.enemies[0];
  const before = { ...e.p };
  guest.step(1, { x: 0, y: 0, z: 0 }, true, flat);
  assert.deepEqual(e.p, before, 'no local AI on the guest');
  guest.applyRemoteEnemies([{ id: 'wild_t', p: [6, 0, 1], hp: e.maxHp, mode: 'windup', tm: .4, t: [0, 0, 0], k: 'sweep' }]);
  assert.equal(e.mode, 'windup'); assert.ok(e.active); assert.deepEqual(e.target, { x: 0, y: 0, z: 0 });
  const sent: unknown[] = [];
  guest.onLocalHit = (id, damage, source) => sent.push({ id, damage, source });
  guest.hitEnemy('wild_t', 10, { source: 'melee' });
  assert.equal(sent.length, 1);

  const host = new WorldCombatState([{ id: 'wild_t', kind: 'shade', p: { x: 5, y: 0, z: 0 } }], []);
  const h = host.enemies[0]; h.active = true; h.mode = 'recover'; host.counterFor = 1; host.ammo = 0;
  let reported = 0; host.onLocalHit = () => reported++;
  assert.ok(host.remoteHit('wild_t', 12, 'ranged'));
  assert.equal(h.maxHp - h.hp, 12, 'no counter or recovery bonus applied a second time');
  assert.equal(reported, 0, 'a relayed hit is not echoed back');
  assert.ok(host.drainEvents().some(ev => ev.type === 'hit' && ev.remote));
  assert.equal(host.remoteHit('wild_t', 9999, 'melee'), false);

  guest.applyRemoteEnemies([{ id: 'wild_t', p: [6, 0, 1], hp: 0, mode: 'dead' }]);
  assert.ok(guest.drainEvents().some(ev => ev.type === 'kill'));
  guest.remoteHurt(15); assert.equal(guest.maxHp - guest.hp, 15);
});

test('enemy snapshots cover both players, nearest first, and skip host-only story actors', () => {
  const state = new WorldCombatState([
    { id: 'near_host', kind: 'shade', p: { x: 10, y: 0, z: 0 } },
    { id: 'near_partner', kind: 'shade', p: { x: 300, y: 0, z: 0 } },
    { id: 'far', kind: 'shade', p: { x: 900, y: 0, z: 0 } },
  ], []);
  const list = enemySnapshot(state.enemies, { x: 0, y: 0, z: 0 }, { x: 305, y: 0, z: 0 });
  assert.deepEqual(list.map(e => e.id), ['near_partner', 'near_host']);
  assert.ok(JSON.stringify(list).length < 400);
  assert.deepEqual(enemySnapshot(state.enemies, { x: 0, y: 0, z: 0 }, null).map(e => e.id), ['near_host']);
});

test('off-screen pings pin to the screen edge; behind the camera flips to the near edge', async () => {
  const { edgeClamp } = await import('../src/coop/pingMarkers.ts');
  assert.deepEqual(edgeClamp(.2, -.3, false), { x: .2, y: -.3, edge: false });
  const right = edgeClamp(3, 0, false); assert.equal(right.edge, true); assert.ok(Math.abs(right.x - .9) < 1e-9);
  const behind = edgeClamp(.5, 0, true); assert.equal(behind.edge, true); assert.ok(behind.x < 0, 'a ping behind and to the right shows on the left edge');
});

test('a partner skill visual round-trips and junk is refused', async () => {
  const { encodeSkillFx, decodeSkillFx } = await import('../src/coop/coopProtocol.ts');
  const ids = ['saber', 'musashi'];
  const strike = encodeSkillFx({ type: 'strike', identity: 'saber', slot: 'ultimate', origin: { x: 1, y: 2, z: 3 }, direction: { x: 0, y: 0, z: 1 }, pulse: 2, range: 18, halfWidth: 2.4, casterFeetY: 2 })!;
  assert.deepEqual(decodeSkillFx(JSON.parse(JSON.stringify(strike)), ids), strike);
  assert.equal(encodeSkillFx({ type: 'guard', identity: null, slot: 'skill', origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } }), null);
  assert.equal(decodeSkillFx({ ...strike, identity: 'godzilla' }, ids), null);
  assert.equal(decodeSkillFx({ ...strike, range: 500 }, ids), null);
  assert.equal(decodeSkillFx({ ...strike, o: [0, NaN, 0] }, ids), null);
  assert.ok(decodeSkillFx({ type: 'cast', identity: null, slot: 'skill', o: [0, 0, 0], d: [0, 0, 1], dur: .6 }, ids));
});

test('a host in a menu leaves the world fighting the partner, never the absent host', () => {
  const state = new WorldCombatState([{ id: 'wild_t', kind: 'shade', p: { x: 3, y: 0, z: 0 } }], []);
  const local = { x: 0, y: 0, z: 0 };
  state.partner = { x: 12, y: 0, z: 0 };
  state.localAbsent = true;
  const events: CombatEvent[] = [];
  for (let i = 0; i < 600 && !events.some(e => e.type === 'partnerHurt'); i++) { state.step(.05, local, false, flat); events.push(...state.drainEvents()); }
  assert.ok(events.some(e => e.type === 'partnerHurt'), 'the enemy beside the absent host walks to the partner');
  assert.equal(state.hp, state.maxHp);
  const solo = new WorldCombatState([{ id: 'wild_t', kind: 'shade', p: { x: 3, y: 0, z: 0 } }], []);
  solo.localAbsent = true; const before = { ...solo.enemies[0].p };
  for (let i = 0; i < 100; i++) solo.step(.05, local, false, flat);
  assert.deepEqual(solo.enemies[0].p, before, 'without a partner a paused world stays frozen');
});

test('a guest joins the host boss fight, and the host win is the guest win', () => {
  const boss = { id: 'boss_vacant_king', kind: 'king' as const, p: { x: 0, y: 0, z: 0 }, requires: ['never_done'] };
  const guest = new WorldCombatState([], boss);
  assert.equal(guest.beginBoss(new Set(['never_done'])), true, 'solo: requirements met, the fight starts');
  guest.resetAll(false);
  guest.remoteEnemies = true;
  assert.equal(guest.beginBoss(new Set(['never_done'])), false, 'a guest cannot start a boss of its own');
  assert.equal(guest.joinRemoteBoss('boss_vacant_king'), true, 'but joins the host fight without the requirements');
  assert.ok(guest.drainEvents().some(e => e.type === 'bossStart'));
  const b = guest.bosses[0];
  guest.applyRemoteEnemies([{ id: b.id, p: [1, 0, 1], hp: b.maxHp / 2, mode: 'chase' }]);
  guest.applyRemoteEnemies([{ id: b.id, p: [1, 0, 1], hp: 0, mode: 'dead' }]);
  const events = guest.drainEvents();
  assert.ok(events.some(e => e.type === 'victory' && e.firstClear), 'the guest earns its own first clear');
  assert.equal(guest.bossStarted, false); assert.ok(guest.isCleared(b.id));

  // A host-side corpse the guest never fought syncs quietly: no kill burst.
  const late = new WorldCombatState([{ id: 'wild_q', kind: 'shade', p: { x: 0, y: 0, z: 0 } }], []);
  late.remoteEnemies = true;
  late.applyRemoteEnemies([{ id: 'wild_q', p: [0, 0, 0], hp: 0, mode: 'dead' }]);
  assert.ok(!late.drainEvents().some(e => e.type === 'kill'));
});
