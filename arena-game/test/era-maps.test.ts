// Acceptance checks for the 2026-11 revision of the three era arenas (LISHAN, SUNTEMPLE,
// ORLEANS), taken from the arena map design report: spawn pockets and sightlines (G01, S01),
// the SUNTEMPLE roof terraces and public stair (S02-S04), the ORLEANS storeys, rampart and quay
// (O01-O05) and the LISHAN return ramps and corridor cutters (L01-L03, L05).
// Generic playability (routes, nav, bots, traps) is covered by maps/stuck/boundary tests.
import { describe, expect, it } from 'vitest';
import { getMap } from '../shared/arenaMap.ts';
import { TICK_HZ } from '../shared/content.ts';
import { blockedAt, groundAt, lineOfSight, type ArenaMap, type Vec3 } from '../shared/map.ts';
import { NavGrid, type NavNode } from '../shared/nav.ts';
import { Bot, BOT_SKILL } from '../shared/bot.ts';
import { Match } from '../shared/match.ts';
import { applyInput, BTN, newPlayer, playerEye, type PlayerState } from '../shared/sim.ts';

const JUMP = 1.07; // apex of a standing jump (6.2 m/s, 18 m/s²)

/** Nav nodes a player can walk to from the first spawn. */
function reachable(m: ArenaMap): NavNode[] {
  const nav = new NavGrid(m), s = m.data.anchors.find((a) => a.kind === 'spawn')!;
  const start = nav.nearest(s.position[0], s.position[1], s.position[2])!;
  const seen = new Set([start.id]), queue = [start.id];
  while (queue.length) for (const nb of nav.nodes[queue.pop()!].links) if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
  return [...seen].map((i) => nav.nodes[i]);
}

const spawns = (m: ArenaMap) => m.data.anchors.filter((a) => a.kind === 'spawn');
const obj = (m: ArenaMap, id: string) => {
  const o = m.data.objects.find((x) => x.id === id);
  if (!o) throw new Error(`missing ${id}`);
  return o;
};

/** Eye (standing and at the top of a jump) of a node to the eye and chest of a target point. */
function seesPoint(m: ArenaMap, n: { x: number; y: number; z: number }, t: Vec3, chest = 1.0): boolean {
  for (const lift of [m.eye, m.eye + JUMP]) {
    const from: Vec3 = [n.x, n.y + lift, n.z];
    if (lineOfSight(m, from, [t[0], t[1] + m.eye, t[2]]) || lineOfSight(m, from, [t[0], t[1] + chest, t[2]])) return true;
  }
  return false;
}

/** Walk toward a point (optionally jumping) for a few seconds; returns the final state. */
function walkToward(m: ArenaMap, start: Vec3, to: [number, number], seconds: number, jump = false): PlayerState {
  const p = newPlayer('w', 'A', 0);
  Object.assign(p, { x: start[0], y: start[1], z: start[2], alive: true });
  for (let seq = 1; seq <= seconds * TICK_HZ; seq++) {
    const dx = to[0] - p.x, dz = to[1] - p.z;
    applyInput(m, p, { seq, mx: 0, mz: Math.hypot(dx, dz) > .05 ? 1 : 0, yaw: Math.atan2(-dx, -dz), pitch: 0, buttons: jump && seq % 30 === 1 ? BTN.JUMP : 0, weapon: 0, view: 0 });
  }
  return p;
}

describe('G01 spawn pockets on the era maps', () => {
  for (const id of ['lishan', 'suntemple', 'orleans']) {
    const m = getMap(id);
    it(`${id}: each team spawns from at least three pockets 4 m+ apart`, () => {
      for (const team of ['west', 'east']) {
        const pts = spawns(m).filter((s) => s.team === team).map((s) => s.position);
        const pockets: Vec3[] = [];
        for (const p of pts) if (!pockets.some((q) => Math.hypot(q[0] - p[0], q[2] - p[2]) < 4)) pockets.push(p);
        expect(pockets.length, team).toBeGreaterThanOrEqual(3);
      }
    });
  }
  for (const [id, floor] of [['suntemple', 2.5], ['orleans', 2.5]] as const) {
    it(`${id}: no raised spot a player can reach sees into a spawn pocket (standing or jumping)`, () => {
      const m = getMap(id);
      const high = reachable(m).filter((n) => n.y >= floor);
      expect(high.length).toBeGreaterThan(50);
      const bad: string[] = [];
      for (const n of high) for (const s of spawns(m)) if (seesPoint(m, n, s.position as Vec3)) bad.push(`${n.x},${n.y.toFixed(2)},${n.z} -> ${s.id}`);
      expect(bad.slice(0, 8)).toEqual([]);
    });
  }
});

describe('G01 spawn choice', () => {
  for (const id of ['lishan', 'suntemple', 'orleans']) {
    it(`${id}: bot 2v2 respawns never appear in a live enemy's sight while a hidden pocket exists`, { timeout: 60000 }, () => {
      const m = getMap(id), match = new Match(m, '2v2');
      for (let i = 0; i < 4; i++) match.addPlayer(`b${i}`, { name: `B${i}`, team: i % 2 ? 'B' : 'A', char: i % 2, skins: [0, 0, 0], bot: true }, new Bot(i + 7, BOT_SKILL.hard));
      let spawns = 0;
      const seen: string[] = [];
      for (let t = 0; t < 90 * TICK_HZ; t++) {
        match.step();
        for (const ev of match.snapshot().events) {
          if (ev.t !== 'spawn' || match.phase !== 'live') continue;
          const me = match.slots.get(ev.id)!.state;
          const enemies = [...match.slots.values()].map((s) => s.state).filter((e) => e.team !== me.team && e.alive);
          const eye = (p: PlayerState): Vec3 => [p.x, p.y + playerEye(m, p), p.z];
          const exposed = (x: number, y: number, z: number) => enemies.some((e) => lineOfSight(m, eye(e), [x, y + m.eye, z]));
          spawns++;
          if (!exposed(me.x, me.y, me.z)) continue;
          const anchors = m.data.anchors.filter((a) => a.kind === 'spawn' && a.team === (me.team === 'A' ? 'west' : 'east'));
          if (anchors.some((a) => !exposed(a.position[0], a.position[1], a.position[2]))) seen.push(`${ev.id}@${match.tick}`);
        }
      }
      expect(spawns).toBeGreaterThan(4);
      expect(seen).toEqual([]);
    });
  }
});

describe('SUNTEMPLE revisions', () => {
  const m = getMap('suntemple');
  const ROOF = 5.6;
  const nodes = reachable(m);
  const roof = nodes.filter((n) => Math.abs(n.y - ROOF) < .05);

  it('S01: the old exposure line from the roof to the west spawn is cut', () => {
    for (const z of [-2, 2]) expect(lineOfSight(m, [-10, 7.25, 0], [-27, 1.65, z])).toBe(false);
  });

  it('S02: the walkable roof is two terraces and a bridge; the rest is built up out of jump reach', () => {
    for (const n of roof) {
      const terrace = Math.abs(n.x) >= 4.2 && n.z >= -11.2;
      const bridge = Math.abs(n.x) < 4.2 && n.z >= .8;
      const passage = Math.abs(n.x) < 1.2 && n.z < .8; // the public stair's walled passage
      expect(terrace || bridge || passage, `${n.x},${n.z}`).toBe(true);
    }
    expect(roof.some((n) => n.x < -4.2) && roof.some((n) => n.x > 4.2) && roof.some((n) => Math.abs(n.x) < 1 && n.z > 1)).toBe(true);
    for (const o of m.data.objects.filter((o) => /^roof_(sanctuary|chapel|kiosk)/.test(o.id))) {
      expect(o.position[1] + o.size[1] / 2 - ROOF, o.id).toBeGreaterThan(JUMP + m.step + .3);
    }
  });

  it('S02: each terrace has its own outer stair and the public stair, arriving far apart and out of each other\'s sight', () => {
    const outerTop: Vec3 = [-10.3, ROOF, -10.2], publicExit: Vec3 = [0, ROOF, 1.0];
    expect(Math.hypot(outerTop[0] - publicExit[0], outerTop[2] - publicExit[2])).toBeGreaterThan(10);
    expect(lineOfSight(m, [outerTop[0], ROOF + m.eye, outerTop[2]], [publicExit[0], ROOF + m.eye, publicExit[2]])).toBe(false);
  });

  it('S02: no terrace sees anyone on the public stair before its exit', () => {
    const terrace = roof.filter((n) => Math.abs(n.x) >= 4.2);
    const stair: Vec3[] = [];
    for (let z = -12; z <= -1; z += .5) stair.push([0, groundAt(m, 0, z, 6), z]); // the last metre is the exit itself
    const bad = [];
    for (const s of stair) for (const n of terrace) if (seesPoint(m, n, s)) bad.push(`${n.x},${n.z} -> stair z ${s[2]}`);
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('S03: the fallen column row is a lateral aisle across the hall, closed to both spawn courts', () => {
    expect(lineOfSight(m, [-9.6, m.eye, -4.8], [9.6, m.eye, -4.8])).toBe(true);
    for (let x = -9.6; x <= 9.6; x += .4) expect(blockedAt(m, x, -4.8, 0), `x ${x}`).toBeNull();
    for (const s of spawns(m)) expect(lineOfSight(m, [-9.6, m.eye, -4.8], [s.position[0], m.eye, s.position[2]])).toBe(false);
  });

  it('S04: the lotus basin has four flights of steps (two ends, two to the south lane)', () => {
    const steps = m.data.objects.filter((o) => o.type === 'ramp' && Math.abs(o.position[1] + 1.2) < .01);
    expect(steps.length).toBeGreaterThanOrEqual(4);
  });
});

describe('ORLEANS revisions', () => {
  const m = getMap('orleans');
  const UP = 3.25, WALK = 4;
  const nodes = reachable(m);

  it('O01: only the two river houses (and their balconies) have a reachable upper storey', () => {
    const upper = nodes.filter((n) => Math.abs(n.y - UP) < .05 && n.z > -16.5); // (the rampart stairs pass this height)
    expect(upper.length).toBeGreaterThan(50);
    for (const n of upper) expect(n.z > 3 && n.z < 12 && Math.abs(n.x) > 11.9 && Math.abs(n.x) < 20, `${n.x},${n.z}`).toBe(true);
  });

  it('O03: the hoist door drops you to the street and cannot be climbed back', () => {
    for (const sx of [-1, 1]) {
      const out = walkToward(m, [sx * 13.3, UP, 6.8], [sx * 9.5, 6.8], 3);
      expect(out.y, `side ${sx}`).toBeLessThan(.05);
      const back = walkToward(m, [sx * 11.4, 0, 6.8], [sx * 14, 6.8], 4, true);
      expect(back.y, `side ${sx}`).toBeLessThan(1.5);
    }
  });

  it('O04: the wall walk is two short sections; the gatehouse and turrets close it', () => {
    expect(lineOfSight(m, [-10, WALK + m.eye, -20.3], [10, WALK + m.eye, -20.3])).toBe(false);
    const walk = nodes.filter((n) => Math.abs(n.y - WALK) < .05);
    expect(walk.length).toBeGreaterThan(20);
    for (const n of walk) expect(Math.abs(n.x) < 14.6 && Math.abs(n.x) > 2.2, `${n.x},${n.z}`).toBe(true);
  });

  it('O05: three stairs per side join the quay to the town, two of them beside the crane', () => {
    const stairs = m.data.objects.filter((o) => o.type === 'ramp' && Math.abs(o.position[1] + 1.6) < .01);
    expect(stairs.length).toBe(6);
    expect(stairs.filter((o) => Math.abs(o.position[0]) < 4).length).toBe(2);
  });
});

describe('LISHAN revisions', () => {
  const m = getMap('lishan');
  const PIT = -2.2;
  const nodes = reachable(m);

  it('L01: the return ramps leave the plank underpasses clear between the corridors', () => {
    for (const x of [-8, 8]) for (let z = -9; z <= 9; z += .5) {
      expect(Math.abs(groundAt(m, x, z, PIT + .1) - PIT), `${x},${z}`).toBeLessThan(.01);
      expect(blockedAt(m, x, z, PIT), `${x},${z}`).toBeNull();
    }
  });

  it('L01/L03: from no baulk-top spot can both return landings be watched', () => {
    const landings: Vec3[] = [[-10.45, 0, 3.6], [10.45, 0, -3.6]];
    const baulk = nodes.filter((n) => Math.abs(n.y) < .05 && Math.abs(n.z) > 4.4 && Math.abs(n.z) < 6.6);
    expect(baulk.length).toBeGreaterThan(50);
    const both = baulk.filter((n) => landings.every((l) => seesPoint(m, n, l)));
    expect(both.map((n) => `${n.x},${n.z}`).slice(0, 5)).toEqual([]);
  });

  it('L02: the outer corridors have no straight line through their whole length', () => {
    for (const z of [-14, -12, -11, -10, -8, 8, 10, 11, 12, 14]) {
      expect(lineOfSight(m, [-15, PIT + m.eye, z], [15, PIT + m.eye, z]), `z ${z}`).toBe(false);
    }
  });

  it('L05: each corridor has its landmark (war drums, chariot, vermilion gates)', () => {
    for (const id of ['war_drum_w', 'war_drum_e', 'chariot', 'vermilion_gate_w', 'vermilion_gate_e']) expect(obj(m, id).collision, id).toBe(true);
  });
});
