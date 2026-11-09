import { describe, expect, it } from 'vitest';
import { FRAG, FRAG_KILL, GRENADE, SMOKE, SPAWN_PROTECTION_TICKS, TICK_HZ, validateUtility } from '../shared/content.ts';
import { fragDamage, launchGrenade, smokeBlocks, stepGrenade, type Grenade } from '../shared/grenade.ts';
import { buildMap, type MapData } from '../shared/map.ts';
import { Match, type NetEvent } from '../shared/match.ts';
import { RoomCore } from '../shared/room.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { Bot, BOT_SKILL, throwPitch } from '../shared/bot.ts';
import { applyInput, BTN, clonePlayer, newPlayer, type Input } from '../shared/sim.ts';
import { LoadoutStore } from '../src/ui/loadout.ts';

const box = (id: string, position: [number, number, number], size: [number, number, number]) => ({ id, type: 'box', position, size, material: '', collision: true, role: 'wall' });
const data = (walls = true): MapData => ({
  mapId: 'grenade-fixture', version: '1', bounds: { min: [-30, -1, -30], max: [30, 12, 30] },
  player: { radius: .32, height: 1.8, eyeHeight: 1.65, walkSpeed: 5.2, stepHeight: .28 },
  objects: [box('floor', [0, -.1, 0], [60, .2, 60]), ...(walls ? [box('wall', [0, 1.5, -6], [8, 3, .4])] : [])] as MapData['objects'],
  anchors: [{ id: 'a', kind: 'spawn', team: 'west', position: [0, 0, 0] }, { id: 'b', kind: 'spawn', team: 'east', position: [0, 0, -2] },
    { id: 'c1', kind: 'cover', position: [10, 0, 10] }, { id: 'c2', kind: 'cover', position: [-10, 0, -10] }] as MapData['anchors'], routes: [],
});
const map = buildMap(data()), open = buildMap(data(false));
const input = (seq: number, o: Partial<Input> = {}): Input => ({ seq, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 0, view: 0, ...o });
const nade = (o: Partial<Grenade> = {}): Grenade => ({ id: 1, owner: 'a', team: 'A', kind: 'frag', x: 0, y: 1.5, z: 0, vx: 0, vy: 0, vz: 0, fuse: FRAG.fuse, rest: false, ...o });

describe('throwing spends one recharging charge per life', () => {
  it('two charges per life: a short gap between throws, then one charge back per cooldown; prediction replays it', () => {
    const p = newPlayer('a', 'A', 0); p.alive = true;
    const shadow = clonePlayer(p);
    const first = applyInput(map, p, input(1, { buttons: BTN.THROW, pitch: .3 }));
    applyInput(map, shadow, input(1, { buttons: BTN.THROW, pitch: .3 }));
    expect(first.filter((e) => e.type === 'throw')).toHaveLength(1);
    expect(p.utilityCharges).toBe(GRENADE.charges - 1); expect(p.utilityCd).toBe(GRENADE.cooldown);
    expect(p.fireCd).toBeGreaterThanOrEqual(GRENADE.throwLock - 1);
    expect(JSON.stringify(p)).toBe(JSON.stringify(shadow));
    const throwsBy = (from: number, to: number) => { let n = 0; for (let seq = from; seq < to; seq++) n += applyInput(map, p, input(seq, { buttons: seq % 2 ? BTN.THROW : 0 })).filter((e) => e.type === 'throw').length; return n; };
    expect(throwsBy(2, GRENADE.throwGap - 1)).toBe(0);          // too soon
    expect(throwsBy(GRENADE.throwGap - 1, GRENADE.throwGap + 6)).toBe(1); // the second charge
    expect(p.utilityCharges).toBe(0);
    expect(throwsBy(GRENADE.throwGap + 6, GRENADE.cooldown - 4)).toBe(0); // empty until a charge returns
    let back = 0; for (let seq = GRENADE.cooldown; seq < GRENADE.cooldown + 40; seq++) { applyInput(map, p, input(seq)); if (p.utilityCharges === 1) { back = seq; break; } }
    expect(back).toBeGreaterThan(0); expect(p.utilityCd).toBe(GRENADE.cooldown); // the other charge starts recharging
  });
  it('dead players cannot throw and a respawn restores the charge', () => {
    const m = new Match(open, '1v1'); m.addPlayer('a', { name: 'a', team: 'A', char: 0, skins: [], bot: false });
    const a = m.player('a')!; a.utilityCd = 500; a.utilityCharges = 0; a.alive = false;
    expect(applyInput(open, a, input(1, { buttons: BTN.THROW })).some((e) => e.type === 'throw')).toBe(false);
    (m as unknown as { spawn(slot: unknown): void }).spawn(m.slots.get('a'));
    expect(m.player('a')!.utilityCd).toBe(0); expect(m.player('a')!.utilityCharges).toBe(GRENADE.charges);
  });
  it('utility choices are validated like loadouts and saved locally', () => {
    expect(validateUtility(undefined)).toBe('frag'); expect(validateUtility('smoke')).toBe('smoke');
    expect(() => validateUtility('nuke')).toThrow(/道具/);
    const core = new RoomCore({});
    expect(() => core.join('x', { rulesVersion: RULES_VERSION, utility: 'nuke' as never })).toThrow(/道具/);
    core.join('y', { rulesVersion: RULES_VERSION, utility: 'smoke' });
    expect(core.match.player('y')!.utility).toBe('smoke');
    const values = new Map<string, string>(), storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
    const store = new LoadoutStore(storage); expect(store.utility).toBe('frag');
    expect(store.selectUtility('smoke')).toBe(true); expect(store.selectUtility('nuke')).toBe(false);
    expect(new LoadoutStore(storage).utility).toBe('smoke'); expect(new LoadoutStore(storage).value).toEqual(store.value);
  });
});

describe('flight is deterministic, bounces off walls and settles', () => {
  it('a lob lands, slides, comes to rest on the floor and never leaves the arena', () => {
    const run = () => { const g = launchGrenade(open, 1, 'a', 'A', 'frag', [0, 1.5, 0], [0, .3, -.95], [0, 0]); const path: number[] = []; for (let i = 0; i < 400; i++) { stepGrenade(open, g); path.push(g.x, g.y, g.z); } return { g, path }; };
    const a = run(), b = run();
    expect(a.path).toEqual(b.path);
    expect(a.g.rest).toBe(true); expect(a.g.y).toBeCloseTo(GRENADE.radius, 1); expect(a.g.z).toBeLessThan(-6);
    for (let i = 0; i < a.path.length; i += 3) { expect(Math.abs(a.path[i])).toBeLessThan(30); expect(a.path[i + 1]).toBeGreaterThan(0); }
  });
  it('a throw into a wall rebounds instead of passing through', () => {
    const g = nade({ z: -3, y: 1.5, vz: -14 }); let minZ = 0;
    for (let i = 0; i < 120; i++) { stepGrenade(map, g); minZ = Math.min(minZ, g.z); }
    expect(minZ).toBeGreaterThan(-5.8 - GRENADE.radius); expect(g.z).toBeGreaterThan(-5.8);
  });
  it('the bot launch solver reaches the requested distance on flat ground', () => {
    for (const d of [5, 9, 14]) {
      const g = launchGrenade(open, 1, 'a', 'A', 'frag', [0, 1.53, 0], [-Math.sin(0) * Math.cos(throwPitch(d, 1.53)), Math.sin(throwPitch(d, 1.53)), -Math.cos(throwPitch(d, 1.53))], [0, 0]);
      let firstTouch = 0; for (let i = 0; i < 300 && !firstTouch; i++) { stepGrenade(open, g); if (g.y <= GRENADE.radius + .02) firstTouch = -g.z; }
      expect(Math.abs(firstTouch - d)).toBeLessThan(1.2);
    }
  });
});

function duel(walls = false) {
  const m = new Match(walls ? map : open, '2v2');
  m.addPlayer('a', { name: 'a', team: 'A', char: 0, skins: [], bot: false });
  m.addPlayer('b', { name: 'b', team: 'B', char: 0, skins: [], bot: false });
  m.addPlayer('c', { name: 'c', team: 'A', char: 0, skins: [], bot: false });
  m.phase = 'live';
  for (const s of m.slots.values()) s.spawnProtectedUntilTick = 0;
  return m;
}
function detonate(m: Match, at: [number, number, number], owner = 'a') {
  m.grenades.push(nade({ x: at[0], y: at[1], z: at[2], owner, team: m.player(owner)!.team, fuse: 1, rest: true }));
  (m as unknown as { stepGrenades(): void }).stepGrenades();
  return m.snapshot().events;
}

describe('frag blasts', () => {
  it('damage falls off with distance and reaches nothing beyond the radius', () => {
    expect(fragDamage(0)).toBe(FRAG.damage); expect(fragDamage(FRAG.core)).toBe(FRAG.damage); expect(fragDamage(FRAG.radius)).toBe(FRAG.minDamage);
    expect(FRAG.damage).toBeGreaterThanOrEqual(150); // lethal for every character inside the core
    expect(fragDamage(FRAG.radius + .01)).toBe(0); expect(fragDamage(2)).toBeGreaterThan(fragDamage(4));
  });
  it('hurts an enemy in the open, spares a teammate, and hurts the thrower only a little and never fatally', () => {
    const m = duel(); Object.assign(m.player('a')!, { x: 0, z: 2, hp: 10 }); Object.assign(m.player('b')!, { x: 0, z: -1.5 }); Object.assign(m.player('c')!, { x: 1, z: 0 });
    const hpB = m.player('b')!.hp, hpC = m.player('c')!.hp;
    const events = detonate(m, [0, GRENADE.radius, 0]);
    expect(m.player('b')!.hp).toBeLessThan(hpB); expect(m.player('c')!.hp).toBe(hpC);
    expect(m.player('a')!.hp).toBeGreaterThanOrEqual(1); expect(m.player('a')!.alive).toBe(true);
    expect(events.some((e) => e.t === 'blast')).toBe(true);
  });
  it('a wall between the blast and the enemy blocks it completely', () => {
    const m = duel(true); Object.assign(m.player('a')!, { x: 10, z: 10 }); Object.assign(m.player('b')!, { x: 0, z: -8 }); Object.assign(m.player('c')!, { x: 12, z: 10 });
    const hp = m.player('b')!.hp; detonate(m, [0, GRENADE.radius, -4]);
    expect(m.player('b')!.hp).toBe(hp);
  });
  it('a hostile shield in the way absorbs the blast for the player behind it', () => {
    const m = duel(); Object.assign(m.player('a')!, { x: 10, z: 10 }); Object.assign(m.player('b')!, { x: 0, z: -3 }); Object.assign(m.player('c')!, { x: 12, z: 10 });
    m.shields.push({ id: 9, team: 'B', owner: 'b', x: 0, y: 0, z: -1.5, yaw: 0, hp: 300, life: 600 });
    const hp = m.player('b')!.hp; detonate(m, [0, GRENADE.radius, 0]);
    expect(m.player('b')!.hp).toBe(hp); expect(m.shields[0].hp).toBeLessThan(300);
  });
  it('the blast throws enemies away from it and off their feet', () => {
    const m = duel(); Object.assign(m.player('a')!, { x: 10, z: 10 }); Object.assign(m.player('b')!, { x: 0, z: -2.5, vx: 0, vz: 0, hp: 150 }); Object.assign(m.player('c')!, { x: 12, z: 10 });
    detonate(m, [0, GRENADE.radius, 0]);
    const b = m.player('b')!; expect(b.vz).toBeLessThan(-2); expect(b.vy).toBeGreaterThan(1); expect(b.grounded).toBe(false);
  });
  it('a full-health enemy at the centre of a frag dies', () => {
    const m = duel(); Object.assign(m.player('a')!, { x: 10, z: 10 }); Object.assign(m.player('b')!, { x: 0, z: -.4, hp: 150 }); Object.assign(m.player('c')!, { x: 12, z: 10 });
    detonate(m, [0, GRENADE.radius, 0]); expect(m.player('b')!.alive).toBe(false);
  });
  it('a lethal blast credits the thrower with a grenade kill', () => {
    const m = duel(); Object.assign(m.player('a')!, { x: 10, z: 10 }); Object.assign(m.player('b')!, { x: 0, z: -.5, hp: 20 }); Object.assign(m.player('c')!, { x: 12, z: 10 });
    const events = detonate(m, [0, GRENADE.radius, 0]);
    const kill = events.find((e): e is Extract<NetEvent, { t: 'kill' }> => e.t === 'kill');
    expect(kill).toMatchObject({ killer: 'a', victim: 'b', w: FRAG_KILL }); expect(m.score.A).toBe(1);
  });
  it('spawn protection and the warm-up phase still apply', () => {
    const m = duel(); Object.assign(m.player('b')!, { x: 0, z: -1 }); m.slots.get('b')!.spawnProtectedUntilTick = m.tick + SPAWN_PROTECTION_TICKS;
    const hp = m.player('b')!.hp; detonate(m, [0, GRENADE.radius, 0]); expect(m.player('b')!.hp).toBe(hp);
    m.phase = 'countdown'; m.slots.get('b')!.spawnProtectedUntilTick = 0; detonate(m, [0, GRENADE.radius, 0]); expect(m.player('b')!.hp).toBe(hp);
  });
  it('a real thrown frag flies, explodes on its fuse and is reported in snapshots meanwhile', () => {
    const m = duel(); Object.assign(m.player('a')!, { x: 0, z: 0, yaw: 0 }); Object.assign(m.player('b')!, { x: 0, z: -9 }); Object.assign(m.player('c')!, { x: 6, z: 6 });
    m.queueInputs('a', [{ seq: 1, mx: 0, mz: 0, yaw: 0, pitch: .15, buttons: BTN.THROW, weapon: 0, view: 0 }]);
    m.step(); const flying = m.snapshot();
    expect(flying.grenades).toHaveLength(1); expect(flying.events.some((e) => e.t === 'throw')).toBe(true);
    let blasted = false; for (let i = 0; i < FRAG.fuse + 5; i++) { m.step(); if (m.snapshot().events.some((e) => e.t === 'blast')) blasted = true; }
    expect(blasted).toBe(true); expect(m.grenades).toHaveLength(0);
  });
});

describe('smoke', () => {
  it('is cover: shots from outside into the cloud deal less, shots from inside do not', () => {
    const shoot = (smokeAt: number) => {
      const m = duel(); Object.assign(m.player('a')!, { x: 0, z: 8, yaw: 0 }); Object.assign(m.player('b')!, { x: 0, z: 0, hp: 150 }); Object.assign(m.player('c')!, { x: 10, z: 10 });
      m.smokes = [{ id: 1, owner: 'b', x: 0, y: 0, z: smokeAt, life: 600 }];
      m.queueInputs('a', [{ seq: 1, mx: 0, mz: 0, yaw: 0, pitch: -.04, buttons: BTN.FIRE, weapon: 0, view: 0 }]);
      for (let i = 0; i < 20; i++) m.step();
      return 150 - m.player('b')!.hp;
    };
    const open = shoot(60), covered = shoot(0), shooterInside = shoot(6);
    expect(open).toBeGreaterThan(0); expect(covered).toBeLessThan(open); expect(covered).toBeCloseTo(open * SMOKE.cover, 0);
    expect(shooterInside).toBe(open);
  });
  it('deploys on landing, blocks sight lines through it for its lifetime, then clears', () => {
    const m = duel(); m.grenades.push(nade({ kind: 'smoke', fuse: SMOKE.fuse, y: GRENADE.radius, rest: true }));
    m.step(); expect(m.smokes).toHaveLength(1);
    expect(smokeBlocks(m.smokes, [-6, 1.5, 0], [6, 1.5, 0])).toBe(true);
    expect(smokeBlocks(m.smokes, [-6, 1.5, 8], [6, 1.5, 8])).toBe(false);
    for (let i = 0; i < SMOKE.life; i++) m.step();
    expect(m.smokes).toHaveLength(0);
  });
  it('a bot cannot see an enemy standing behind a smoke cloud', () => {
    const m = new Match(open, '1v1');
    m.addPlayer('bot', { name: 'bot', team: 'A', char: 0, skins: [], bot: true }, new Bot(3, BOT_SKILL.hard));
    m.addPlayer('b', { name: 'b', team: 'B', char: 0, skins: [], bot: false });
    m.phase = 'live';
    const look = (smoke: boolean) => {
      Object.assign(m.player('bot')!, { x: 0, z: 0, yaw: 0, hp: 150 }); Object.assign(m.player('b')!, { x: 0, z: -12 });
      m.smokes = smoke ? [{ id: 1, owner: 'b', x: 0, y: 0, z: -6, life: 400 }] : [];
      const bot = new Bot(3, BOT_SKILL.hard); let fired = false;
      for (let i = 0; i < 90; i++) { const inp = bot.think(m, 'bot'); if (inp.buttons & BTN.FIRE) fired = true; }
      return fired;
    };
    expect(look(false)).toBe(true); expect(look(true)).toBe(false);
  });
});

it('bots run out of the radius of a frag about to explode', () => {
  const m = new Match(open, '1v1');
  m.addPlayer('bot', { name: 'bot', team: 'A', char: 0, skins: [], bot: true }, new Bot(5, BOT_SKILL.normal));
  m.addPlayer('b', { name: 'b', team: 'B', char: 0, skins: [], bot: false });
  Object.assign(m.player('bot')!, { x: 0, z: 0, yaw: 0 }); Object.assign(m.player('b')!, { x: 25, z: 25 });
  m.grenades.push(nade({ x: 1.5, y: GRENADE.radius, z: 0, owner: 'b', team: 'B', fuse: Math.round(.8 * TICK_HZ), rest: true }));
  const bot = new Bot(5, BOT_SKILL.normal), start = { x: 0, z: 0 };
  const p = m.player('bot')!;
  for (let i = 0; i < 30; i++) applyInput(open, p, bot.think(m, 'bot'));
  expect(Math.hypot(p.x - 1.5, p.z) - Math.hypot(start.x - 1.5, start.z)).toBeGreaterThan(1);
});

it('the client view follows snapshots: models appear and disappear, clouds fade in, blasts clean up', async () => {
  const THREE = await import('three');
  const { GrenadeView } = await import('../src/rendering/grenades.ts');
  const scene = new THREE.Scene(), view = new GrenadeView(scene);
  view.sync([nade({ fuse: 30, rest: true })], [{ id: 2, owner: 'a', x: 3, y: 0, z: 0, life: SMOKE.life }], 0);
  expect(view.counts).toMatchObject({ grenades: 1, clouds: 1 });
  expect(scene.getObjectByName('Frag warning ring')!.visible).toBe(true);
  view.blast([0, 0, 0]); view.update(.5); expect(view.counts.blasts).toBe(1);
  view.update(1); expect(view.counts.blasts).toBe(0);
  view.sync([], [], 0); expect(view.counts).toMatchObject({ grenades: 0, clouds: 0 });
  expect(scene.children).toHaveLength(0); view.dispose();
});
