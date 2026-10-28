// Independent QA: transport-free checks do not claim actual sockets or Cloudflare-host validation.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAP, MAPS, getMap, mapIdOf } from '../shared/arenaMap.ts';
import { RoomCore } from '../shared/room.ts';
import { Match } from '../shared/match.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { BTN, type Input } from '../shared/sim.ts';
import { startOffline } from '../src/session.ts';
import { localizeText, setLanguage } from '../../shared-client/i18n.ts';

afterEach(() => { setLanguage('zh'); vi.useRealTimers(); });

it('the active chapter selector has exactly five unique maps and the three new battlefields', () => {
  const ids = MAPS.map(m => m.id);
  expect(ids).toHaveLength(5);
  expect(new Set(ids).size).toBe(5);
  expect(ids).toEqual(['aster', 'camlann', 'blackflag', 'frostcourt', 'sakura']);
});

it('active menu names and blurbs have complete English translations without changing stable IDs', () => {
  const ids = MAPS.map(m => m.id);
  setLanguage('en');
  for (const map of MAPS) {
    for (const source of [map.name, map.blurb]) {
      const en = localizeText(source);
      expect(en, `${map.id}: ${source}`).not.toMatch(/[\u3400-\u9fff]/);
      expect(en.length).toBeGreaterThan(3);
    }
  }
  setLanguage('zh');
  expect(MAPS.map(m => m.id)).toEqual(ids);
  for (const map of MAPS) expect(localizeText(map.name)).toBe(map.name);
});

it('unknown selectors resolve consistently in prediction and multiplayer RoomCore', () => {
  for (const raw of ['missing-map', '../../neon', '', undefined]) {
    const core = new RoomCore({ map: raw, layout: '1v1' });
    expect(core.mapId).toBe(mapIdOf(raw));
    expect(core.mapId).toBe(DEFAULT_MAP);
    expect(core.match.map).toBe(getMap(raw));
  }
});

for (const info of MAPS) describe(`independent chapter QA ${info.id}`, () => {
  it('the actual offline session selects this map, fills both teams and preserves selection across rematch', () => {
    vi.useFakeTimers();
    const session = startOffline({ map: info.id, layout: '2v2', team: 'A', name: 'QA', char: 0, skins: [] }, 'normal');
    try {
      expect(session.online).toBe(false);
      expect(session.map).toBe(getMap(info.id));
      expect(session.match!.snapshot().players).toHaveLength(4);
      session.match!.phase = 'ended';
      session.rematch();
      expect(session.map).toBe(getMap(info.id));
      expect(session.match!.phase).toBe('countdown');
      session.setPaused(true);
    } finally { session.close(); }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('offline Match and multiplayer RoomCore produce identical authoritative snapshots for the same inputs', () => {
    const options = { map: info.id, layout: '1v1' as const, rulesVersion: RULES_VERSION };
    const core = new RoomCore(options), direct = new Match(getMap(info.id), '1v1');
    for (const [id, team, char] of [['a', 'A', 0], ['b', 'B', 1]] as const) {
      const welcome = core.join(id, { ...options, team, char, name: id, skins: [] });
      expect(welcome.map).toBe(info.id);
      expect(welcome.rulesVersion).toBe(RULES_VERSION);
      direct.addPlayer(id, { name: id, team, char, skins: [], bot: false });
    }
    for (let tick = 1; tick <= 600; tick++) {
      for (const [id, phase] of [['a', 0], ['b', Math.PI]] as const) {
        const input: Input = { seq: tick, mx: tick % 140 < 70 ? 1 : -1, mz: 1,
          yaw: phase + Math.sin(tick / 90) * .4, pitch: 0, weapon: tick % 240 < 120 ? 0 : 1, view: tick,
          buttons: tick % 60 === 0 ? BTN.JUMP : tick % 45 === 0 ? BTN.FIRE : tick % 100 > 90 ? BTN.CROUCH : 0 };
        core.input(id, [input]); direct.queueInputs(id, [input]);
      }
      const actual = core.step(); direct.step();
      if (actual) expect(actual).toEqual(direct.snapshot());
    }
    expect(core.match.tick).toBe(600);
    expect(core.match.phase).toBe('live');
    core.leave('a'); core.leave('b');
    expect(core.match.snapshot().players).toHaveLength(0);
  });
});
