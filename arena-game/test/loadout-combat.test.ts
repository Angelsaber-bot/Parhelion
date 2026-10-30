import { describe, expect, it } from 'vitest';
import { ARENA_MAP } from '../shared/arenaMap.ts';
import { BOT_SKILL, Bot } from '../shared/bot.ts';
import { DEFAULT_LOADOUT, MELEE_MOVE, SPAWN_PROTECTION_TICKS, GUN_IDS, MELEE_IDS, WEAPONS, botLoadout, isLoadout, loadoutWeapon, validateLoadout, weaponIndex, type Loadout, type MeleeId } from '../shared/content.ts';
import { buildMap, type MapData } from '../shared/map.ts';
import { Match, sanitize, type PlayerInfo } from '../shared/match.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { RoomCore } from '../shared/room.ts';
import { applyInput, BTN, clonePlayer, newPlayer, type Input } from '../shared/sim.ts';

const data: MapData = {
  mapId: 'combat-fixture', version: '1', bounds: { min: [-30, -1, -30], max: [30, 12, 30] },
  player: { radius: .32, height: 1.8, eyeHeight: 1.65, walkSpeed: 5.2, stepHeight: .28 },
  objects: [{ id: 'floor', type: 'box', position: [0, -.1, 0], size: [60, .2, 60], material: '', collision: true, role: 'floor' }],
  anchors: [{ id: 'a', kind: 'spawn', team: 'west', position: [0, 0, 0] }, { id: 'b', kind: 'spawn', team: 'east', position: [0, 0, -2] }], routes: [],
};
const flat = buildMap(data);
const input = (seq: number, o: Partial<Input> = {}): Input => ({ seq, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 0, view: 0, ...o });
const info = (team: 'A' | 'B', loadout?: Loadout): PlayerInfo => ({ name: team, team, char: 0, skins: [], bot: false, loadout });
function arena(melee: MeleeId = 'blade', map = flat) {
  const m = new Match(map, '1v2');
  m.addPlayer('a', info('A', ['lumen', 'corona', melee])); m.addPlayer('b', info('B'));
  m.phase = 'live'; m.phaseT = 100000;
  // These weapon/contact tests begin after the new spawn-protection window.
  for (let i = 0; i < SPAWN_PROTECTION_TICKS; i++) m.step();
  const p = m.player('a')!; p.weaponSlot = 2; p.weapon = weaponIndex(melee);
  Object.assign(p, { x: 0, y: 0, z: 0 }); Object.assign(m.player('b')!, { x: 0, y: 0, z: -2 });
  m.snapshot(); return m;
}
function command(m: Match, buttons = 0, extra: Partial<Input> = {}) {
  const p = m.player('a')!;
  m.queueInputs('a', [input(p.lastSeq + 1, { weapon: 2, buttons, view: m.tick, ...extra })]); m.step();
}
function attack(m: Match) {
  command(m, BTN.FIRE);
  const w = WEAPONS[m.player('a')!.weapon];
  for (let i = 0; i < w.windup!; i++) command(m);
}

describe('validated two-gun one-melee loadouts', () => {
  it('all sixty ordered selections are legal, fresh copies, and fixed slot types', () => {
    let count = 0;
    for (const a of GUN_IDS) for (const b of GUN_IDS) for (const melee of MELEE_IDS) {
      if (a === b) continue;
      const choice: Loadout = [a, b, melee];
      expect(isLoadout(choice)).toBe(true); expect(validateLoadout(choice)).not.toBe(choice);
      expect(WEAPONS[loadoutWeapon(choice, 0)].id).toBe(a);
      expect(WEAPONS[loadoutWeapon(choice, 1)].id).toBe(b);
      expect(WEAPONS[loadoutWeapon(choice, 2)].kind).toBe('melee'); count++;
    }
    expect(count).toBe(60); expect(validateLoadout(undefined)).toEqual(DEFAULT_LOADOUT);
  });
  it.each([null, {}, [], ['lumen'], ['lumen', 'lumen', 'blade'], ['lumen', 'corona', 'halo'],
    ['blade', 'corona', 'blade'], ['admin-gun', 'corona', 'blade'], [0, 1, 5], ['lumen', 'corona', '__proto__'],
    ['lumen', 'corona', 'blade', 'hammer']])('rejects malformed, duplicate, wrong-class and forged IDs: %j', (raw) => {
    expect(isLoadout(raw)).toBe(false); expect(() => validateLoadout(raw)).toThrow(/装备/);
    const core = new RoomCore({ layout: '2v2', bots: true });
    const before = [...core.match.slots.keys()];
    expect(() => core.join('attacker', { rulesVersion: RULES_VERSION, team: 'A', loadout: raw as Loadout })).toThrow(/装备/);
    expect([...core.match.slots.keys()]).toEqual(before); // invalid joins cannot evict a bot
  });
  it('only slot 0/1/2 equips catalog IDs, and arbitrary input fields cannot change the validated list', () => {
    const m = new Match(flat, '1v1'); m.addPlayer('a', info('A', ['longnight', 'firefly', 'hammer']));
    const p = m.player('a')!;
    for (const slot of [0, 1, 2, 0]) {
      m.queueInputs('a', [input(p.lastSeq + 1, { weapon: slot })]); m.step();
      expect(p.weapon).toBe(loadoutWeapon(p.loadout, slot)); expect(p.weaponSlot).toBe(slot);
    }
    for (const invalid of [-1, 3, 7, 999, .5, NaN, Infinity]) {
      const forged = { ...input(p.lastSeq + 1, { weapon: invalid }), loadout: ['lumen', 'halo', 'blade'], unlockAll: true };
      expect(sanitize(forged)?.weapon).toBe(-1); m.queueInputs('a', [forged]); m.step();
      expect(p.weapon).toBe(4); expect(p.loadout).toEqual(['longnight', 'firefly', 'hammer']);
    }
  });
  it('the original three firearm numbers are unchanged; every new weapon has a unique role', () => {
    expect(WEAPONS.slice(0, 3).map((w) => [w.damage, w.interval, w.mag, w.reload])).toEqual([[20, 6, 30, 114], [12, 48, 6, 138], [52, 22, 8, 126]]);
    expect(WEAPONS.map((w) => w.id)).toEqual([...GUN_IDS, ...MELEE_IDS]);
    expect(WEAPONS.filter((w) => w.kind === 'gun')).toHaveLength(5);
    for (const w of WEAPONS.slice(5)) { expect(w.windup).toBeGreaterThanOrEqual(12); expect(w.interval).toBeGreaterThan(w.windup!); expect(w.headMul).toBe(1); }
  });
  it('version 6 refuses a version 5 client before adding any player', () => {
    const core = new RoomCore({}); expect(RULES_VERSION).toBe(6);
    expect(() => core.join('old', { rulesVersion: 5 })).toThrow(/版本/); expect(core.match.slots.size).toBe(0);
  });
});

describe('all five firearms use shared real ammunition, shots, hits and reload', () => {
  it.each(GUN_IDS)('%s fires from its selected slot and damages a real opponent', (id) => {
    const m = new Match(flat, '1v1'); const other = id === 'lumen' ? 'corona' : 'lumen';
    m.addPlayer('a', info('A', [id, other, 'blade'])); m.addPlayer('b', info('B'));
    m.phase = 'live'; m.phaseT = 10000;
    for (let i = 0; i < SPAWN_PROTECTION_TICKS; i++) m.step();
    const a = m.player('a')!, b = m.player('b')!, wi = weaponIndex(id), w = WEAPONS[wi];
    Object.assign(b, { z: -5 }); m.queueInputs('a', [input(1, { buttons: BTN.FIRE })]); m.step();
    expect(a.ammo[wi]).toBe(w.mag - 1); expect(b.hp).toBeLessThan(150);
    expect(m.snapshot().events.some((e) => e.t === 'shot' && e.w === wi)).toBe(true);
    a.ammo[wi] = 0;
    m.queueInputs('a', [input(2)]); m.step(); expect(a.reload).toBe(w.reload);
    for (let seq = 3; seq <= w.reload + 2; seq++) { m.queueInputs('a', [input(seq)]); m.step(); }
    expect(a.ammo[wi]).toBe(w.mag); expect(a.reload).toBe(0);
  });
});

describe('fair authoritative melee', () => {
  it.each(MELEE_IDS)('%s has a visible windup, one impact, no ammunition/reload or headshot bonus', (id) => {
    const m = arena(id), p = m.player('a')!, target = m.player('b')!, w = WEAPONS[p.weapon];
    command(m, BTN.FIRE);
    expect(target.hp).toBe(150); expect(p.meleeWindup).toBe(w.windup);
    expect(m.snapshot().events).toContainEqual({ t: 'meleeStart', id: 'a', w: p.weapon, windup: w.windup, yaw: 0, pitch: 0 });
    for (let i = 1; i < w.windup!; i++) { command(m, BTN.FIRE); expect(target.hp).toBe(150); }
    command(m, BTN.FIRE); expect(target.hp).toBe(150 - w.damage);
    const events = m.snapshot().events;
    expect(events.filter((e) => e.t === 'meleeStrike')).toHaveLength(1);
    expect(events.find((e) => e.t === 'hit')).toMatchObject({ dmg: w.damage, head: false });
    for (let i = 0; i < w.interval * 2; i++) command(m, BTN.FIRE | BTN.RELOAD);
    expect(target.hp).toBe(150 - w.damage); expect(p.ammo[p.weapon]).toBe(0); expect(p.reload).toBe(0);
  });
  it('a queued catch-up burst cannot compress windup or cooldown, and server ticks finish it without more packets', () => {
    const m = arena('hammer'), p = m.player('a')!, b = m.player('b')!, w = WEAPONS[p.weapon];
    for (let i = 0; i < 20; i++) m.step(); // maximum eight catch-up credits
    m.queueInputs('a', Array.from({ length: 8 }, (_, i) => input(i + 1, { weapon: 2, buttons: i % 2 ? 0 : BTN.FIRE })));
    m.step(); const start = m.tick; expect(p.meleeWindup).toBe(w.windup);
    while (m.tick < start + w.windup! - 1) { m.step(); expect(b.hp).toBe(150); }
    m.step(); expect(b.hp).toBe(150 - w.damage);
    m.queueInputs('a', Array.from({ length: 16 }, (_, i) => input(i + 9, { weapon: 2, buttons: i % 2 ? 0 : BTN.FIRE })));
    m.step(); expect(m.snapshot().events.filter((e) => e.t === 'meleeStart')).toHaveLength(1);
    expect(p.fireCd).toBeGreaterThanOrEqual(start + w.interval - m.tick);
  });
  it('turning during the swing steers the lunge and the hit; turning away carries it away', () => {
    const behind = arena(); Object.assign(behind.player('b')!, { z: 2 }); command(behind, BTN.FIRE);
    for (let i = 0; i < 12; i++) command(behind, 0, { yaw: Math.PI });
    expect(behind.player('b')!.hp).toBe(150 - WEAPONS[weaponIndex('blade')].damage);
    const away = arena(); Object.assign(away.player('b')!, { z: -2.5 }); command(away, BTN.FIRE);
    for (let i = 0; i < 12; i++) command(away, 0, { yaw: Math.PI });
    expect(away.player('b')!.hp).toBe(150);
  });
  it('a target the attacker turns onto inside the short active window is still hit, once', () => {
    const m = arena(); Object.assign(m.player('b')!, { x: 2.2, z: 0 }); attack(m);
    expect(m.player('b')!.hp).toBe(150);
    command(m, 0, { yaw: -Math.PI / 2 }); command(m, 0, { yaw: -Math.PI / 2 });
    expect(m.player('b')!.hp).toBe(150 - WEAPONS[weaponIndex('blade')].damage);
    for (let i = 0; i < 10; i++) command(m, 0, { yaw: -Math.PI / 2 });
    expect(m.player('b')!.hp).toBe(150 - WEAPONS[weaponIndex('blade')].damage);
  });
  it('lunge closes distance, stops at the target instead of passing through, and guns do less to melee holders', () => {
    const m = arena(); Object.assign(m.player('b')!, { z: -4.5 }); attack(m);
    const a = m.player('a')!;
    expect(a.z).toBeLessThan(-1.5); expect(a.z).toBeGreaterThan(-4.5 + .2);
    expect(m.player('b')!.hp).toBe(150 - WEAPONS[weaponIndex('blade')].damage);
    const shot = (melee: boolean) => {
      const g = arena(); const gunner = g.player('b')!, target = g.player('a')!;
      if (!melee) { target.weaponSlot = 0; target.weapon = loadoutWeapon(target.loadout, 0); }
      Object.assign(gunner, { x: 0, z: -5, yaw: Math.PI }); const before = target.hp;
      g.queueInputs('b', [input(gunner.lastSeq + 1, { yaw: Math.PI, buttons: BTN.FIRE, weapon: 0, view: g.tick })]); g.step();
      return before - target.hp;
    };
    expect(shot(false)).toBeGreaterThan(0);
    expect(shot(true)).toBe(Math.round(shot(false) * MELEE_MOVE.gunDamageTaken));
  });
  it('range, horizontal/vertical arcs and current-time position all reject invalid targets', () => {
    for (const pos of [{ x: 0, y: 0, z: -6 }, { x: 3.5, y: 0, z: 0 }, { x: 0, y: 3, z: -1 }]) {
      const m = arena(); Object.assign(m.player('b')!, pos); attack(m); expect(m.player('b')!.hp).toBe(150);
    }
    const m = arena(); command(m, BTN.FIRE, { view: 0 }); Object.assign(m.player('b')!, { z: -10 });
    for (let i = 0; i < 12; i++) command(m, 0, { view: 0 }); expect(m.player('b')!.hp).toBe(150);
  });
  it('a level swing reaches close targets below the eye line, and the spear reaches 4 m', () => {
    for (const [id, pos] of [['blade', { x: 0, y: 0, z: -1 }], ['hammer', { x: .5, y: 0, z: -1.2 }], ['polearm', { x: 0, y: 0, z: -1.2 }], ['polearm', { x: .6, y: 0, z: -3.9 }]] as const) {
      const m = arena(id); Object.assign(m.player('b')!, pos); attack(m);
      expect(m.player('b')!.hp, `${id} at ${JSON.stringify(pos)}`).toBe(150 - WEAPONS[weaponIndex(id)].damage);
    }
    const crouched = arena('blade'); Object.assign(crouched.player('b')!, { z: -1.2, crouched: true }); attack(crouched);
    expect(crouched.player('b')!.hp).toBe(150 - WEAPONS[weaponIndex('blade')].damage);
    const far = arena('polearm'); Object.assign(far.player('b')!, { z: -7.5 }); attack(far); expect(far.player('b')!.hp).toBe(150);
  });
  it('map walls block all melee, including a target inside the broad hammer arc', () => {
    const wall = buildMap({ ...data, objects: [...data.objects, { id: 'wall', type: 'box', position: [0, 1.5, -1], size: [5, 3, .15], material: '', collision: true, role: 'wall' }] });
    for (const id of MELEE_IDS) { const m = arena(id, wall); attack(m); expect(m.player('b')!.hp).toBe(150); }
  });
  it('hostile shields take one impact and block players; no through-shield cleave', () => {
    const m = arena('hammer'); m.shields.push({ id: 1, owner: 'b', team: 'B', x: 0, y: 0, z: -1, yaw: 0, hp: 300, life: 600 });
    attack(m); expect(m.player('b')!.hp).toBe(150); expect(m.shields[0].hp).toBe(300 - WEAPONS[weaponIndex('hammer')].damage);
  });
  it('a swing contacts at most one enemy, never a teammate', () => {
    const m = arena('hammer'); m.addPlayer('c', info('B')); for (let i = 0; i < SPAWN_PROTECTION_TICKS; i++) m.step(); Object.assign(m.player('c')!, { x: .4, y: 0, z: -2.1 });
    attack(m); expect([m.player('b')!.hp, m.player('c')!.hp].filter((hp) => hp < 150)).toHaveLength(1);
  });
  it('switching out and back cancels the hit and never resets attack cooldown', () => {
    const m = arena('blade'); command(m, BTN.FIRE); const cd = m.player('a')!.fireCd;
    command(m, 0, { weapon: 0 }); command(m, 0, { weapon: 2 });
    for (let i = 0; i < 12; i++) command(m);
    expect(m.player('b')!.hp).toBe(150); expect(m.player('a')!.fireCd).toBeGreaterThan(0);
    expect(m.player('a')!.fireCd).toBeLessThan(cd);
    expect(m.snapshot().events.some((e) => e.t === 'meleeStrike')).toBe(false);
  });
  it('death and respawn cancel pending impact and reset selected slot, stance and weapon state', () => {
    const m = arena(); command(m, BTN.FIRE); const p = m.player('a')!;
    p.alive = false; p.crouched = true; m.slots.get('a')!.respawn = 2;
    for (let i = 0; i < 20; i++) m.step();
    expect(m.player('b')!.hp).toBe(150); expect(p.alive).toBe(true); expect(p.crouched).toBe(false);
    expect(p.weaponSlot).toBe(0); expect(p.weapon).toBe(0); expect(p.meleeWindup).toBe(0);
  });
  it('prediction replay is deterministic across all eight catalogs and JSON-cloned states', () => {
    for (const id of MELEE_IDS) {
      const a = newPlayer('a', 'A', 0, ['firefly', 'longnight', id]); a.alive = true;
      const b = clonePlayer(a); expect(a.loadout).not.toBe(b.loadout);
      for (let seq = 1; seq < 400; seq++) {
        const inp = input(seq, { weapon: Math.floor(seq / 90) % 3, buttons: seq % 9 < 4 ? BTN.FIRE : 0, yaw: seq * .01 });
        applyInput(flat, a, inp); applyInput(flat, b, inp);
      }
      expect(JSON.parse(JSON.stringify(a))).toEqual(b);
    }
  });
});

describe('shared host, bot and transport contract', () => {
  it('RoomCore and direct offline Match produce byte-equivalent gameplay snapshots', () => {
    const core = new RoomCore({ layout: '1v1' }); const offline = new Match(ARENA_MAP, '1v1');
    const choices: Loadout[] = [['firefly', 'longnight', 'polearm'], ['halo', 'corona', 'hammer']];
    for (const [i, id] of ['a', 'b'].entries()) {
      const team = i ? 'B' : 'A'; core.join(id, { rulesVersion: RULES_VERSION, team, name: team, char: 0, skins: [], loadout: choices[i] });
      offline.addPlayer(id, info(team, choices[i]));
    }
    for (let seq = 1; seq <= 300; seq++) {
      for (const id of ['a', 'b']) {
        const inp = input(seq, { weapon: Math.floor(seq / 60) % 3, buttons: seq % 20 < 3 ? BTN.FIRE : 0, yaw: id === 'a' ? -Math.PI / 2 : Math.PI / 2 });
        core.input(id, [inp]); offline.queueInputs(id, [inp]);
      }
      core.match.step(); offline.step();
      expect(JSON.stringify(core.match.snapshot())).toBe(JSON.stringify(offline.snapshot()));
    }
  });
  it.each(MELEE_IDS)('a close-range bot equips and lands the same authoritative %s attack', (id) => {
    const m = new Match(ARENA_MAP, '1v1');
    m.addPlayer('a', { ...info('A', ['firefly', 'longnight', id]), bot: true }); m.addPlayer('b', info('B'));
    Object.assign(m.player('a')!, { x: 0, y: 0, z: 20, yaw: 0 });
    m.phase = 'live'; m.phaseT = 10000;
    for (let i = 0; i < SPAWN_PROTECTION_TICKS; i++) m.step();
    const bot = new Bot(2, BOT_SKILL.hard); let struck = false;
    for (let i = 0; i < 180 && !struck; i++) {
      const a = m.player('a')!, b = m.player('b')!;
      // Keep a stationary-relative sparring target in range while the bot turns/strafes.
      Object.assign(b, { x: a.x - Math.sin(a.yaw) * 1.5, y: a.y, z: a.z - Math.cos(a.yaw) * 1.5 });
      const inp = bot.think(m, 'a'); m.queueInputs('a', [inp]); m.step();
      struck = m.snapshot().events.some((e) => e.t === 'hit' && e.shooter === 'a' && a.weapon === weaponIndex(id));
    }
    expect(struck).toBe(true);
  });
  it('bot generated loadouts cover all eight IDs and bot inputs never request outside equipped slots', () => {
    const ids = new Set(Array.from({ length: 15 }, (_, i) => botLoadout(i)).flat()); expect(ids.size).toBe(8);
    for (let seed = 1; seed <= 8; seed++) {
      const m = new Match(ARENA_MAP, '1v1'); const bot = new Bot(seed, BOT_SKILL.hard), loadout = botLoadout(seed);
      m.addPlayer('a', { ...info('A', loadout), bot: true }); m.addPlayer('b', info('B'));
      for (let i = 0; i < 120; i++) {
        const inp = bot.think(m, 'a'); expect([0, 1, 2]).toContain(inp.weapon);
        m.queueInputs('a', [inp]); m.step(); expect(loadout).toContain(WEAPONS[m.player('a')!.weapon].id);
      }
    }
  });
});
