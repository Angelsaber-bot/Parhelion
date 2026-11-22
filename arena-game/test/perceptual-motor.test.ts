import { expect, it } from 'vitest';
import { getMap } from '../shared/arenaMap.ts';
import { buildMap } from '../shared/map.ts';
import { smokeEdgeSearch } from '../shared/searchOcclusion.ts';
import { humanObservation } from '../shared/humanCombat.ts';
import { Match } from '../shared/match.ts';
import { perceptualMotor } from '../shared/perceptualMotor.ts';
import { BTN, forward, type Input } from '../shared/sim.ts';

const map = getMap('aster');

function pilot() {
  const match = new Match(map, '1v1');
  match.addPlayer('pilot', { name: 'pilot', team: 'A', char: 0, skins: [], bot: true });
  return match.player('pilot')!;
}

it('uses the learned trigger preference and cancels it immediately on loss of sight', () => {
  const me = pilot();
  me.yaw = me.pitch = 0; me.reload = me.fireCd = 0;
  const propose = (tick: number): Input => ({ seq: tick, view: tick, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: BTN.FIRE, weapon: 0 });
  const contact = [1, 0, 0, .25];
  const eager = perceptualMotor(), wait = perceptualMotor();
  for (let tick = 1; tick <= 12; tick++) {
    const fast = eager(map, me, tick, contact, propose(tick), BTN.FIRE);
    const deliberate = wait(map, me, tick, contact, propose(tick), 0);
    expect(Boolean(fast.buttons & BTN.FIRE)).toBe(tick === 12);
    expect(deliberate.buttons & BTN.FIRE).toBe(0);
  }
  for (const confidence of [0, .5]) {
    const lost = eager(map, me, 13, [confidence, 0, 0, 0], propose(13), BTN.FIRE);
    expect(lost.buttons & BTN.FIRE).toBe(0);
  }
});

it('keeps model-dependent steering and keeps search within the player turn limits', () => {
  const me = pilot();
  me.yaw = me.pitch = 0;
  const visible = [1, .15, -.03, .3];
  const propose = (yaw: number): Input => ({ seq: 1, view: 1, mx: .2, mz: .4, yaw, pitch: .01, buttons: 0, weapon: 1 });
  const left = perceptualMotor()(map, me, 1, visible, propose(-.05), 0);
  const right = perceptualMotor()(map, me, 1, visible, propose(.05), 0);
  expect(left.yaw).toBeLessThan(right.yaw);
  // At this distance the primary rifle is a better fit than the requested shotgun.
  expect(right.weapon).toBe(0);
  const scan = perceptualMotor()(map, me, 1, [0, 0, 0, 0], propose(-.06), 0);
  expect(scan.yaw).toBeLessThan(0);
  expect(Math.abs(scan.yaw)).toBeLessThanOrEqual(.066);
  expect(Math.hypot(scan.mx, scan.mz)).toBeLessThanOrEqual(1.000001);
});

it('approaches a visible smoke edge without reacting to smoke behind cover or outside the camera', () => {
  const empty = buildMap({ ...map.data, objects: [] });
  const wall = buildMap({ ...map.data, objects: [{
    id: 'screen', type: 'box', position: [0, 2, -1.5], size: [12, 4, .25],
    material: 'stone', role: 'wall', collision: true,
  }] });
  const me = pilot();
  Object.assign(me, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  const smoke = { id: 1, owner: 'unknown', x: 0, y: 0, z: -6, life: 155, box: { yaw: 0, width: 3, height: 3, depth: 2 } };
  const shield = { id: 1, owner: 'unknown', team: 'A' as const, x: 0, y: 0, z: -1, yaw: 0, life: 100, hp: 100 };
  const visible = smokeEdgeSearch()(empty, me, 1, [smoke], .4);
  expect(visible?.moving).toBe(true);
  expect(smokeEdgeSearch()(empty, me, 1, [{ ...smoke, owner: me.id }], .4)).toEqual(visible);
  expect(smokeEdgeSearch()(empty, me, 1, [], .4)).toBeUndefined();
  expect(smokeEdgeSearch()(wall, me, 1, [smoke], .4)).toBeUndefined();
  expect(smokeEdgeSearch()(empty, me, 1, [smoke], .4, undefined, [shield])).toBeUndefined();
  expect(smokeEdgeSearch()(empty, { ...me, yaw: Math.PI }, 1, [smoke], .4)).toBeUndefined();
  expect(smokeEdgeSearch()(empty, { ...me, pitch: 1.4 }, 1, [smoke], .4)).toBeUndefined();
});

it('moves at full search speed when a close wall obstructs the initial scan', () => {
  const obstruction = buildMap({ ...map.data, anchors: [], objects: [{
    id: 'wall', type: 'box', position: [0, 2, -.8], size: [12, 4, .35],
    material: 'stone', role: 'wall', collision: true,
  }] });
  const open = buildMap({ ...map.data, anchors: [], objects: [] });
  const me = pilot();
  Object.assign(me, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  const requested = { seq: 1, view: 1, mx: 1, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 0 };
  const scan = (arena: typeof map, latest: boolean) =>
    perceptualMotor(latest)(arena, me, 1, [0, 0, 0, 0], { ...requested }, 0);

  expect(scan(obstruction, true)).toEqual(scan(obstruction, false));
  const before = scan(open, false), after = scan(open, true);
  expect(after.yaw).toBeGreaterThan(before.yaw);
  expect(Math.hypot(after.mx, after.mz)).toBeLessThan(Math.hypot(before.mx, before.mz));
});

it('keeps the last visible lane in world space while the bot moves after losing sight', () => {
  const open = buildMap({ ...map.data, anchors: [], objects: [] });
  const me = pilot(), motor = perceptualMotor(true);
  Object.assign(me, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  const propose = (tick: number): Input => ({ seq: tick, view: tick, mx: 0, mz: 0, yaw: me.yaw - .015, pitch: 0, buttons: BTN.FIRE, weapon: 0 });
  motor(open, me, 1, [1, 0, 0, 6 / 45], propose(1), 0);
  for (let tick = 2; tick <= 80; tick++) {
    me.x = Math.min(3, tick * .05);
    const next = motor(open, me, tick, [0, 0, 0, 0], propose(tick), BTN.FIRE);
    expect(next.buttons & BTN.FIRE).toBe(0);
    me.yaw = next.yaw;
  }
  expect(me.yaw).toBeCloseTo(Math.atan2(3, 6), 1);
});

it('steps out to reacquire a stationary silhouette using the ordinary smoke visibility rules', () => {
  const open = buildMap({ ...map.data, anchors: [], objects: [] });
  const match = new Match(open, '1v1'), me = pilot(), motor = perceptualMotor(true);
  Object.assign(me, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fireCd: 0, reload: 0 });
  match.smokes.push({ id: 1, owner: 'rival', x: -1.45, y: 0, z: -3, life: 150,
    box: { yaw: 0, width: 3, depth: .45, height: 3 } });
  const rival = { team: 'B' as const, crouched: false, feet: [0, 0, -6] as [number, number, number] };
  let firstClear = 0, firstShot = 0;
  for (let tick = 1; tick <= 100; tick++) {
    const obs = humanObservation(open, me, [rival], (a,b) => match.heroes.visible(a,b), [0,0],
      undefined, undefined, (a,b) => match.heroes.visible(a,b,true));
    if (tick === 1) expect(obs[0]).toBe(.5);
    const input = motor(open, me, tick, obs, { seq: tick, view: tick, mx: 0, mz: 0, yaw: me.yaw, pitch: me.pitch, buttons: BTN.FIRE, weapon: 0 },
      BTN.FIRE, match.smokes);
    if (obs[0] === 1 && !firstClear) firstClear = tick;
    if (input.buttons & BTN.FIRE) { expect(obs[0]).toBe(1); firstShot = tick; break; }
    const [x,z] = forward(input.yaw);
    me.x += (x * input.mz - z * input.mx) * .08;
    me.z += (z * input.mz + x * input.mx) * .08;
    me.yaw = input.yaw; me.pitch = input.pitch;
  }
  expect(firstClear).toBeGreaterThan(1);
  expect(firstShot).toBeGreaterThan(firstClear);
});
