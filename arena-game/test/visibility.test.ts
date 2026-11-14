import { describe, expect, it } from 'vitest';
import { ARENA_MAP } from '../shared/arenaMap.ts';
import { buildMap } from '../shared/map.ts';
import { Match, type Snapshot } from '../shared/match.ts';
import { snapshotForViewer } from '../shared/visibility.ts';
const fixture = (wall = true) => {
  const map = buildMap({ ...ARENA_MAP.data, objects: wall ? [{ id: 'wall', type: 'box', position: [0, 4, 0], size: [1, 8, 30], material: 'stone', collision: true, role: 'cover' }] : [] });
  const match = new Match(map, '2v2');
  for (const [id, team, x] of [['a', 'A', -10], ['b', 'B', 10], ['ally', 'A', 12]] as const) {
    match.addPlayer(id, { name: id, team, char: 0, skins: [], bot: false });
    Object.assign(match.player(id)!, { x, y: 0, z: 0 });
  }
  return { map, match };
};
describe('per-viewer anti-wallhack disclosure', () => {
  it('hides opposing poses through solid cover but preserves self, allies and a non-spatial roster', () => {
    const { map, match } = fixture(); const raw = match.snapshot();
    const a = snapshotForViewer(map, raw, 'a'), b = snapshotForViewer(map, raw, 'b');
    expect(a.players.map(p => p.id)).toEqual(['a', 'ally']);
    expect(b.players.map(p => p.id)).toEqual(['b', 'ally']);
    expect(raw.players).toHaveLength(3);
    expect(a.roster).toHaveLength(3);
    expect(Object.keys(a.roster![1]).sort()).toEqual(['bot', 'char', 'deaths', 'id', 'kills', 'name', 'team']);
  });
  it('reveals an enemy upon entering line of sight, then removes it immediately behind cover', () => {
    const { map, match } = fixture();
    const read = () => snapshotForViewer(map, match.snapshot(), 'a').players.some(p => p.id === 'b');
    expect(read()).toBe(false);
    Object.assign(match.player('b')!, { x: -5 }); expect(read()).toBe(true);
    Object.assign(match.player('b')!, { x: 10 }); expect(read()).toBe(false);
  });
  it('keeps a partially exposed silhouette visible and does not trust a forged view angle', () => {
    const { map, match } = fixture();
    Object.assign(match.player('a')!, { z: 15.1, yaw: Math.PI });
    Object.assign(match.player('b')!, { z: 15.1 });
    expect(snapshotForViewer(map, match.snapshot(), 'a').players.some(p => p.id === 'b')).toBe(true);
  });
  it('conceals enemies through smoke and for dead observers', () => {
    const { map, match } = fixture(false);
    match.smokes.push({ id: 1, owner: 'b', x: 0, y: 0, z: 0, life: 120 });
    expect(snapshotForViewer(map, match.snapshot(), 'a').players.map(p => p.id)).not.toContain('b');
    match.smokes.length = 0;
    expect(snapshotForViewer(map, match.snapshot(), 'a').players.map(p => p.id)).toContain('b');
    match.player('a')!.alive = false;
    expect(snapshotForViewer(map, match.snapshot(), 'a').players.map(p => p.id)).not.toContain('b');
  });
  it('redacts hidden impact endpoints even when the shooter itself is visible', () => {
    const { map, match } = fixture();
    Object.assign(match.player('b')!, { x: -5 });
    const raw = match.snapshot();
    raw.events = [{ t: 'shot', id: 'b', w: 0, from: [-5, 1.6, 0], to: [[10, 1.6, 0]] }];
    expect(snapshotForViewer(map, raw, 'a').events).toEqual([{ ...raw.events[0], to: [] }]);
  });
  it('does not leak concealed poses through muzzle events, FX, shields or projectiles', () => {
    const { map, match } = fixture(); const raw: Snapshot = match.snapshot();
    raw.events = [
      { t: 'shot', id: 'b', w: 0, from: [10, 1, 0], to: [[12, 1, 0]] },
      { t: 'meleeStrike', id: 'b', w: 5, from: [10, 1, 0], to: [11, 1, 0] },
      { t: 'fx', id: 'b', kind: 'dash' }, { t: 'spawn', id: 'b' },
      { t: 'hit', shooter: 'b', victim: 'a', dmg: 5, head: false },
      { t: 'kill', killer: 'b', victim: 'a', w: 0, head: false },
      { t: 'blast', owner: 'b', gid: 1, at: [10, 0, 0] },
    ];
    raw.shields = [{ id: 1, owner: 'b', team: 'B', x: 10, y: 0, z: 0, yaw: 0, hp: 100, life: 60 }];
    raw.grenades = [{ id: 1, owner: 'b', team: 'B', kind: 'frag', x: 10, y: 1, z: 0, vx: 0, vy: 0, vz: 0, fuse: 50, rest: false }];
    const filtered = snapshotForViewer(map, raw, 'a');
    expect(filtered.events.map(e => e.t)).toEqual(['hit', 'kill']);
    expect(filtered.shields).toEqual([]); expect(filtered.grenades).toEqual([]);
    expect(raw.events).toHaveLength(7);
  });
});
