import { describe, expect, it } from 'vitest';
import { CROUCH, MELEE_MOVE, WEAPONS, loadoutWeapon } from '../shared/content.ts';
import { buildMap, blockedAt, type MapData } from '../shared/map.ts';
import { applyInput, BTN, clonePlayer, newPlayer, playerEye, playerHeight, type Input } from '../shared/sim.ts';
import { rayPlayer } from '../shared/hit.ts';
import { Match, sanitize } from '../shared/match.ts';
import { RoomCore } from '../shared/room.ts';
import { RULES_VERSION, assertRulesVersion } from '../shared/protocol.ts';
const data: MapData = {
  mapId: 'crouch-fixture', version: '1', bounds: { min: [-20, -1, -20], max: [20, 10, 20] },
  player: { radius: .32, height: 1.8, eyeHeight: 1.65, walkSpeed: 5.2, stepHeight: .28 },
  objects: [
    { id: 'floor', type: 'box', position: [0, -.1, 0], size: [40, .2, 40], material: '', collision: true, role: 'floor' },
    { id: 'low-roof', type: 'box', position: [0, 1.45, 0], size: [4, .3, 4], material: '', collision: true, role: 'ceiling' },
  ],
  anchors: [{ id: 'a', kind: 'spawn', team: 'west', position: [0, 0, 10] }, { id: 'b', kind: 'spawn', team: 'east', position: [0, 0, -10] }], routes: [],
};
const map = buildMap(data), flat = buildMap({ ...data, objects: data.objects.slice(0, 1) });
const input = (seq: number, o: Partial<Input> = {}): Input => ({ seq, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 0, view: 0, ...o });
function player(x = 0, z = 0) { const p = newPlayer('a', 'A', 0); Object.assign(p, { x, y: 0, z, alive: true }); return p; }

describe('authoritative crouch', () => {
  it('shortens collision and shot eye; walking speed is 55% without changing gun stats', () => {
    const standing = player(), crouched = player();
    for (let seq = 1; seq <= 60; seq++) { applyInput(flat, standing, input(seq, { mz: 1 })); applyInput(flat, crouched, input(seq, { mz: 1, buttons: BTN.CROUCH })); }
    expect(crouched.crouched).toBe(true); expect(crouched.z / standing.z).toBeCloseTo(CROUCH.speedMultiplier, 2);
    expect(playerHeight(flat, crouched)).toBe(1.2); expect(playerEye(flat, crouched)).toBe(1.05);
    const shot = applyInput(flat, crouched, input(61, { buttons: BTN.CROUCH | BTN.FIRE })).find((e) => e.type === 'fire');
    expect(shot?.type === 'fire' && shot.origin[1]).toBe(1.05);
    expect(crouched.ammo[0]).toBe(WEAPONS[0].mag - 1);
  });
  it('holding a melee weapon moves faster than a gun, standing and crouched', () => {
    const gun = player(), melee = player(), meleeCrouch = player(), gunCrouch = player();
    for (const p of [melee, meleeCrouch]) { p.weapon = loadoutWeapon(p.loadout, 2); p.weaponSlot = 2; }
    expect(WEAPONS[melee.weapon].kind).toBe('melee');
    for (let seq = 1; seq <= 60; seq++) {
      applyInput(flat, gun, input(seq, { mz: 1 })); applyInput(flat, melee, input(seq, { mz: 1, weapon: 2 }));
      applyInput(flat, gunCrouch, input(seq, { mz: 1, buttons: BTN.CROUCH })); applyInput(flat, meleeCrouch, input(seq, { mz: 1, weapon: 2, buttons: BTN.CROUCH }));
    }
    expect(melee.weapon).toBe(loadoutWeapon(melee.loadout, 2));
    expect(melee.z / gun.z).toBeCloseTo(MELEE_MOVE.speedMultiplier, 2);
    expect(meleeCrouch.z / gunCrouch.z).toBeCloseTo(MELEE_MOVE.speedMultiplier, 2);
  });

  it('fits under low roofs, cannot stand into them, and stands when the full footprint clears', () => {
    const p = player(0, 3.5);
    for (let i = 1; i <= 120; i++) applyInput(map, p, input(i, { mz: 1 }));
    expect(p.z).toBeGreaterThan(2.3);
    for (let i = 121; i <= 180; i++) applyInput(map, p, input(i, { mz: 1, buttons: BTN.CROUCH }));
    expect(Math.abs(p.z)).toBeLessThan(2);
    const under = p.z;
    applyInput(map, p, input(181)); expect(p.crouched).toBe(true); expect(p.z).toBe(under);
    expect(blockedAt(map, p.x, p.z, p.y, playerHeight(map, p))).toBeNull();
    for (let i = 182; i <= 300; i++) applyInput(map, p, input(i, { mz: 1 }));
    expect(p.z).toBeLessThan(-2.4); expect(p.crouched).toBe(false);
  });
  it('a low step cannot lift a crouched capsule through the roof', () => {
    const stepped = buildMap({ ...data, objects: [...data.objects, { id: 'step', type: 'box', position: [0, .1, 0], size: [2, .2, 1], material: '', collision: true, role: 'step' }] });
    const p = player(0, 1.5);
    for (let seq = 1; seq <= 90; seq++) {
      applyInput(stepped, p, input(seq, { buttons: BTN.CROUCH, mz: 1 }));
      expect(p.y + playerHeight(stepped, p)).toBeLessThanOrEqual(1.301);
    }
    expect(p.z).toBeGreaterThan(.49);
  });
  it('crouched jumps use the short capsule ceiling and release cannot push the player sideways', () => {
    const p = player();
    applyInput(map, p, input(1, { buttons: BTN.CROUCH | BTN.JUMP }));
    for (let i = 2; i <= 60; i++) { applyInput(map, p, input(i)); expect(p.y + playerHeight(map, p)).toBeLessThanOrEqual(1.301); }
    expect(p.x).toBe(0); expect(p.z).toBe(0); expect(p.crouched).toBe(true); expect(p.y).toBe(0);
  });
  it('crouch cannot preserve dash speed on ground or in the air', () => {
    for (const grounded of [true, false]) {
      const p = player(); p.grounded = grounded; p.y = grounded ? 0 : 2;
      applyInput(flat, p, input(1, { buttons: BTN.DASH, mz: 1 }));
      expect(p.dashT).toBeGreaterThan(0);
      applyInput(flat, p, input(2, { buttons: BTN.CROUCH | BTN.DASH, mz: 1 }));
      expect(p.dashT).toBe(0); expect(Math.hypot(p.vx, p.vz)).toBeLessThan(2.87);
    }
  });
  it('replaying crouch/stand/jump input remains deterministic through JSON snapshots', () => {
    const a = player(0, 3.5), b = clonePlayer(a);
    for (let seq = 1; seq < 300; seq++) {
      const inp = input(seq, { mz: 1, buttons: (seq % 100 < 70 ? BTN.CROUCH : 0) | (seq % 27 === 0 ? BTN.JUMP : 0) });
      applyInput(map, a, inp); applyInput(map, b, inp);
      expect(JSON.parse(JSON.stringify(b))).toEqual(a);
    }
  });
  it('head/body targets shrink with stance instead of retaining an invisible standing target', () => {
    expect(rayPlayer([0, 1.6, 10], [0, 0, -1], 0, 0, 0, false)?.head).toBe(true);
    expect(rayPlayer([0, 1.6, 10], [0, 0, -1], 0, 0, 0, true)).toBeNull();
    expect(rayPlayer([0, 1, 10], [0, 0, -1], 0, 0, 0, true)?.head).toBe(true);
    expect(rayPlayer([0, .5, 10], [0, 0, -1], 0, 0, 0, true)?.head).toBe(false);
  });
  it('lag compensation rewinds stance as well as position, and respawn clears crouch', () => {
    const match = new Match(flat, '1v1');
    match.addPlayer('a', { name: 'a', team: 'A', char: 0, skins: [], bot: false });
    match.addPlayer('b', { name: 'b', team: 'B', char: 0, skins: [], bot: false });
    const a = match.player('a')!, b = match.player('b')!;
    Object.assign(a, { x: 0, y: 0, z: 10, weapon: 2, loadout: ['halo', 'lumen', 'blade'] }); Object.assign(b, { x: 0, y: 0, z: 0 });
    match.phase = 'live'; match.phaseT = 10000;
    // Stance rewind is tested after spawn immunity, with relative history ticks.
    for (let i = 0; i < 150; i++) match.step();
    const base = match.tick; match.step();
    b.crouched = true; match.step(); // tick 2: below standing head ray
    b.crouched = false; match.step();
    match.queueInputs('a', [input(1, { buttons: BTN.FIRE, weapon: 0, view: base + 2 })]); match.step();
    expect(b.hp).toBe(150);
    b.crouched = true; match.step();
    a.fireCd = 0; a.prevButtons = 0;
    match.queueInputs('a', [input(2, { buttons: BTN.FIRE, weapon: 0, view: base + 3 })]); match.step();
    expect(b.hp).toBeLessThan(150); // tick 3 was standing, despite current crouch
    b.alive = false; match.slots.get('b')!.respawn = 1; match.step();
    expect(b.alive).toBe(true); expect(b.crouched).toBe(false); expect(b.prevButtons).toBe(0);
  });
  it('sanitizer preserves only supported seven bits, including crouch and the test key', () => {
    expect(sanitize(input(1, { buttons: BTN.CROUCH }))?.buttons).toBe(32);
    expect(sanitize(input(1, { buttons: 255 }))?.buttons).toBe(127);
    expect(sanitize({ ...input(1), buttons: NaN })?.buttons).toBe(0);
  });
});

describe('transport parity and version guard', () => {
  it('Worker RoomCore accepts the same held bit and sends authoritative stance in JSON', () => {
    const core = new RoomCore({ layout: '1v1' });
    const welcome = core.join('a', { rulesVersion: RULES_VERSION, team: 'A' });
    expect(welcome.rulesVersion).toBe(RULES_VERSION);
    core.input('a', [input(1, { buttons: BTN.CROUCH })]); core.step(); core.step();
    const snap = JSON.parse(JSON.stringify(core.step()));
    expect(snap.rulesVersion).toBe(RULES_VERSION); expect(snap.players[0].crouched).toBe(true);
    core.input('a', [input(2)]); core.step(); expect(core.match.player('a')!.crouched).toBe(false);
  });
  it('missing/old rules versions are rejected instead of creating client/server divergence', () => {
    const core = new RoomCore({});
    expect(() => core.join('old', {})).toThrow(/版本/);
    expect(() => core.join('old', { rulesVersion: 1 })).toThrow(/版本/);
    expect(() => assertRulesVersion(undefined)).toThrow(/版本/);
    expect(core.match.slots.size).toBe(0);
  });
});
