import { describe, expect, it } from 'vitest';
import { MAPS, getMap } from '../shared/arenaMap.ts';
import { CHARACTERS, DT } from '../shared/content.ts';
import { buildMap, type MapAnchor } from '../shared/map.ts';
import { Match, spawnYaw, type NetEvent, type Snapshot } from '../shared/match.ts';
import { applyInput, forward, type Input } from '../shared/sim.ts';
import { Game } from '../src/game.ts';

const revised = ['homeward', 'aster', 'frostcourt'];
const info = (team: 'A' | 'B') => ({ name: 'Player', team, char: 2, skins: [], bot: false });
function atAnchor(mapId: string, anchor: MapAnchor): Match {
  const data = structuredClone(getMap(mapId).data);
  // Isolate each real authored spawn so every pocket, including fallback pockets, is tested.
  data.anchors = [structuredClone(anchor)];
  const match = new Match(buildMap(data), '1v1');
  match.addPlayer('player', info(anchor.team === 'west' ? 'A' : 'B'));
  return match;
}
function input(seq: number, yaw: number, mz = 0): Input {
  return { seq, mx: 0, mz, yaw, pitch: 0, buttons: 0, weapon: 0, view: 0 };
}
function client(snap: Snapshot) {
  const controls = { yaw: .9, pitch: .7 };
  const game = Object.assign(Object.create(Game.prototype), {
    session: { id: 'player' }, latest: snap, controls, names: new Map(), smooth: [1, 2, 3],
  }) as { onEvent(event: NetEvent): void; smooth: number[] };
  return { game, controls };
}

describe('authored spawn exits', () => {
  for (const mapId of revised) it(`${mapId}: every spawn and respawn faces a clear first metre`, () => {
    const anchors = getMap(mapId).data.anchors.filter(a => a.kind === 'spawn');
    expect(anchors.length).toBeGreaterThanOrEqual(4);
    for (const anchor of anchors) {
      expect(Number.isFinite(anchor.facingYaw), anchor.id).toBe(true);
      const match = atAnchor(mapId, anchor), p = match.player('player')!;
      for (let life = 0; life < 2; life++) {
        if (life) match.respawnNow(p.id);
        expect(p.yaw, `${anchor.id} life ${life}`).toBe(anchor.facingYaw);
        const [fx, fz] = forward(p.yaw), [x, y, z] = anchor.position;
        const expected = CHARACTERS[p.char].speed * DT * 12;
        for (let tick = 0; tick < 12; tick++) applyInput(match.map, p, input(p.lastSeq + 1, p.yaw, 1));
        // Actual capsule motion, not just a ray: holding W moves a full metre without sliding,
        // hitting the shelter wall, jumping, or falling off the spawn floor.
        expect(expected).toBeGreaterThan(1);
        expect(p.x - x, anchor.id).toBeCloseTo(fx * expected, 2);
        expect(p.z - z, anchor.id).toBeCloseTo(fz * expected, 2);
        expect(p.y, anchor.id).toBeCloseTo(y, 3);
        expect(p.grounded).toBe(true);
      }
    }
  });

  it('the other six maps retain their existing centre-facing behavior despite legacy yaw metadata', () => {
    const unchanged = MAPS.filter(m => !revised.includes(m.id));
    expect(unchanged).toHaveLength(6);
    for (const map of unchanged) for (const anchor of map.data.anchors.filter(a => a.kind === 'spawn')) {
      expect(anchor.facingYaw).toBeUndefined();
      const p = atAnchor(map.id, anchor).player('player')!;
      expect(p.yaw, `${map.id}/${anchor.id}`).toBe(spawnYaw(p.x, p.z));
    }
  });

  it('non-finite authored headings fall back without poisoning player state', () => {
    const anchor = getMap('homeward').data.anchors.find(a => a.kind === 'spawn')!;
    for (const facingYaw of [NaN, Infinity, -Infinity]) {
      const p = atAnchor('homeward', { ...anchor, facingYaw }).player('player')!;
      expect(p.yaw).toBe(spawnYaw(p.x, p.z));
    }
  });
});

describe('spawn camera synchronization', () => {
  it('preserves the birth heading across later inputs, JSON transport, and the actual client spawn handler', () => {
    const anchor = getMap('homeward').data.anchors.find(a => a.kind === 'spawn')!;
    const match = atAnchor('homeward', anchor);
    match.queueInputs('player', [input(1, 1.2)]);
    match.step();
    const snap: Snapshot = JSON.parse(JSON.stringify(match.snapshot()));
    expect(snap.players[0].yaw).toBeCloseTo(1.2, 3);
    const spawn = snap.events.find(e => e.t === 'spawn')!;
    expect(spawn.t === 'spawn' && spawn.yaw).toBe(anchor.facingYaw);
    const { game, controls } = client(snap);
    game.onEvent(spawn);
    expect(controls.yaw).toBe(anchor.facingYaw);
    expect(controls.pitch).toBe(0);
    expect(game.smooth).toEqual([0, 0, 0]);
  });

  it('older spawn events use authoritative snapshot yaw instead of recalculating toward the centre', () => {
    const anchor = getMap('homeward').data.anchors.find(a => a.kind === 'spawn')!;
    const snap = atAnchor('homeward', anchor).snapshot();
    const { game, controls } = client(snap);
    game.onEvent({ t: 'spawn', id: 'player' });
    expect(controls.yaw).toBe(snap.players[0].yaw);
    expect(controls.yaw).not.toBe(spawnYaw(snap.players[0].x, snap.players[0].z));
  });

  it('practice posts preserve their own position and heading through the server and camera', () => {
    const map = getMap('homeward'), match = new Match(map, '1v1');
    const home = { x: -9, y: 0, z: -6, yaw: .37 };
    match.practice = { homes: new Map([['player', home]]), respawnTicks: 60 };
    match.addPlayer('player', info('A'));
    for (let life = 0; life < 2; life++) {
      if (life) match.respawnNow('player');
      const snap = match.snapshot(), p = snap.players[0], { game, controls } = client(snap);
      expect([p.x, p.y, p.z, p.yaw]).toEqual([home.x, home.y, home.z, home.yaw]);
      game.onEvent(snap.events.find(e => e.t === 'spawn')!);
      expect(controls.yaw).toBe(home.yaw);
    }
  });
});
