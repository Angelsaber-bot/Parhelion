import { describe, expect, it } from 'vitest';
import { getMap, MAPS } from '../shared/arenaMap.ts';
import { blockedAt, buildMap, constrainToBounds, groundAt, insideMovementBounds, type ArenaMap } from '../shared/map.ts';
import { Match } from '../shared/match.ts';
import { NavGrid } from '../shared/nav.ts';
import { applyInput, BTN, clonePlayer, newPlayer, type Input, type PlayerState } from '../shared/sim.ts';

const input = (seq: number, yaw: number, buttons = 0): Input =>
  ({ seq, mx: 0, mz: 1, yaw, pitch: 0, buttons, weapon: 0, view: 0 });
const buttons = (mode: number, tick: number) => mode === 1 ? BTN.CROUCH :
  (mode >= 2 && tick % 67 === 1 ? BTN.JUMP : 0) | (mode === 3 && tick % 211 === 1 ? BTN.DASH : 0);
function spawned(m: ArenaMap, x: number, z: number, y = groundAt(m, x, z, m.data.bounds.max[1] + 20)) {
  return Object.assign(newPlayer('edge', 'A', 1), { x, y, z, alive: true });
}
function assertContained(m: ArenaMap, p: PlayerState, context = '') {
  expect(Number.isFinite(p.x + p.y + p.z), context).toBe(true);
  // The solver epsilon is intentionally greater than the 1/4096m position quantization.
  expect(p.x - m.radius, context).toBeGreaterThanOrEqual(m.data.bounds.min[0]);
  expect(p.x + m.radius, context).toBeLessThanOrEqual(m.data.bounds.max[0]);
  expect(p.z - m.radius, context).toBeGreaterThanOrEqual(m.data.bounds.min[2]);
  expect(p.z + m.radius, context).toBeLessThanOrEqual(m.data.bounds.max[2]);
  expect(p.y, context).toBeGreaterThanOrEqual(m.data.bounds.min[1] - .001);
}

for (const info of MAPS) describe(`closed Arena perimeter ${info.id}`, () => {
  const m = getMap(info.id);
  it('keeps every spawn supported, collision-free and inside the playable capsule limits', () => {
    const match = new Match(m, '2v2');
    for (const a of m.data.anchors.filter(a => a.kind === 'spawn')) {
      const [x, y, z] = a.position;
      expect(insideMovementBounds(m, x, z), a.id).toBe(true);
      expect(groundAt(m, x, z, y), a.id).toBeCloseTo(y, 3);
      expect(blockedAt(m, x, z, y), a.id).toBeNull();
    }
    for (let i = 0; i < 4; i++) {
      match.addPlayer(`p${i}`, { name: `p${i}`, team: i % 2 ? 'A' : 'B', char: i % 2, skins: [], bot: false });
      assertContained(m, match.player(`p${i}`)!);
    }
  });
  it('sweeps all four edges and corners using walk, crouch, jump and jump-dash', { timeout: 20000 }, () => {
    const { min, max } = m.data.bounds;
    const starts: [number, number, number][] = [];
    for (let z = min[2] + 1; z <= max[2] - 1; z += 6) {
      starts.push([min[0] + 1, z, Math.PI / 2], [max[0] - 1, z, -Math.PI / 2]);
    }
    for (let x = min[0] + 1; x <= max[0] - 1; x += 6) {
      starts.push([x, min[2] + 1, 0], [x, max[2] - 1, Math.PI]);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      starts.push([sx < 0 ? min[0] + 1 : max[0] - 1, sz < 0 ? min[2] + 1 : max[2] - 1, Math.atan2(-sx, -sz)]);
    }
    for (const [x, z, yaw] of starts) for (let mode = 0; mode < 4; mode++) {
      const p = spawned(m, x, z);
      for (let tick = 1; tick <= 240; tick++) {
        applyInput(m, p, input(tick, yaw, buttons(mode, tick)));
        // Inspect every tick, not just a final respawn or a successful return to bounds.
        if (p.x - m.radius < min[0] || p.x + m.radius > max[0] ||
            p.z - m.radius < min[2] || p.z + m.radius > max[2] || p.y < min[1] - .001) {
          assertContained(m, p, `${x},${z}, mode ${mode}, tick ${tick}`);
        }
      }
      assertContained(m, p);
    }
  });
  it('does not offer bots unreachable nodes outside the capsule-safe perimeter', () => {
    const nav = new NavGrid(m);
    expect(nav.nodes.length).toBeGreaterThan(100);
    for (const n of nav.nodes) expect(insideMovementBounds(m, n.x, n.z)).toBe(true);
  });
});

for (const [id, x, z, yaw] of [['camlann', 28, 0, -Math.PI / 2], ['blackflag', -29, 12, Math.PI]] as const) {
  it(`${id}: real escape route remains supported through a deterministic two-minute replay`, () => {
    const m = getMap(id), p = spawned(m, x, z, groundAt(m, x, z, 3)), replay = clonePlayer(p);
    for (let tick = 1; tick <= 7200; tick++) {
      const i = input(tick, yaw, buttons(tick % 1200 < 300 ? 1 : 3, tick));
      applyInput(m, p, i); applyInput(m, replay, i);
      if (tick % 60 === 0) { assertContained(m, p); expect(replay).toEqual(p); }
    }
    expect(p.alive).toBe(true);
    expect(p.hp).toBe(replay.hp);
  });
  it(`${id}: authoritative queued inputs cannot send positions or dash beyond the edge`, () => {
    const m = getMap(id), match = new Match(m, '1v1');
    match.addPlayer('p', {name: 'p', team: 'A', char: 1, skins: [], bot: false});
    const p = match.player('p')!;
    Object.assign(p, {x, z, y: groundAt(m, x, z, 3)});
    for (let tick = 1; tick <= 900; tick++) {
      match.queueInputs('p', [{...input(tick, yaw, buttons(3, tick)), x: 10000, y: -100, z: 10000} as Input]);
      match.step();
      assertContained(m, p);
    }
    expect(p.lastSeq).toBe(900);
  });
}

it('edge correction preserves vertical tiers, tangential motion, health and ability cooldowns', () => {
  const m = getMap('blackflag');
  const p = spawned(m, m.data.bounds.max[0] + 5, 0, 8);
  Object.assign(p, {vx: 17, vz: 3, vy: 4, hp: 57, dashCd: 100});
  constrainToBounds(m, p);
  expect(p.x).toBe(m.movementBounds.maxX);
  expect(p.vx).toBe(0); expect(p.vz).toBe(3); expect(p.vy).toBe(4);
  expect(p.y).toBe(8); expect(p.hp).toBe(57); expect(p.dashCd).toBe(100);
});

it('outer edge constraint does not invent walls around interior platforms or clamp jump height', () => {
  const original = getMap('blackflag').data;
  const m = buildMap({...original, bounds: {min: [-10, 0, -10], max: [10, 3, 10]}, objects: [
    {id: 'floor', type: 'box', position: [0, -.5, 0], size: [20, 1, 20], collision: true, role: 'floor', material: 'floor'},
    {id: 'deck', type: 'box', position: [0, 1, 0], size: [4, 2, 4], collision: true, role: 'floor', material: 'floor'},
  ]});
  const p = spawned(m, 0, 0, 2);
  applyInput(m, p, input(1, -Math.PI / 2, BTN.JUMP | BTN.DASH));
  for (let tick = 2; tick <= 100; tick++) applyInput(m, p, input(tick, -Math.PI / 2));
  expect(p.x).toBeGreaterThan(4); expect(p.y).toBe(0);
});
