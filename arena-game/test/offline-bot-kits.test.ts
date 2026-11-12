import { expect, it } from 'vitest';
import { GUN_IDS, MELEE_IDS, isLoadout, loadoutWeapon, randomBotLoadout, type Loadout } from '../shared/content.ts';
import { RoomCore } from '../shared/room.ts';
import { startOffline } from '../src/network/session.ts';

/** Small deterministic PRNG so the test never depends on Math.random. */
function lcg(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); }
const kit = (l: Loadout) => l.join('/');

it('random bot kits are always legal and reach every gun pair and every melee', () => {
  const rand = lcg(3), seen = new Set<string>(), weapons = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const l = randomBotLoadout(rand);
    expect(isLoadout(l)).toBe(true);
    seen.add(kit(l)); l.forEach((w) => weapons.add(w));
  }
  expect(seen.size).toBe(GUN_IDS.length * (GUN_IDS.length - 1) * MELEE_IDS.length); // 60 ordered kits
  expect(weapons.size).toBe(GUN_IDS.length + MELEE_IDS.length);
  // An edge-case generator returning 1 - ε never indexes past the end.
  expect(isLoadout(randomBotLoadout(() => 0.9999999999))).toBe(true);
});

it('an offline bot gets a new kit on every rematch while the player keeps theirs', () => {
  const session = startOffline({ layout: '1v1', team: 'A', name: 'Local', char: 0, skins: [], loadout: ['halo', 'lumen', 'polearm'] }, 'hard', lcg(11));
  try {
    session.setPaused(true);
    const m = session.match!, bot = [...m.slots.values()].find((s) => s.info.bot)!;
    const kits = new Set<string>([kit(bot.state.loadout)]);
    for (let round = 0; round < 8; round++) {
      m.phase = 'ended'; m.rematch();
      expect(bot.state.loadout).toEqual(bot.info.loadout);
      expect(isLoadout(bot.state.loadout)).toBe(true);
      expect(['frag', 'smoke']).toContain(bot.state.utility);
      kits.add(kit(bot.state.loadout));
      // The respawned bot holds its new kit's first gun.
      expect(bot.state.weapon).toBe(loadoutWeapon(bot.state.loadout, 0));
    }
    expect(kits.size).toBeGreaterThan(4);
    expect(m.player(session.id)!.loadout).toEqual(['halo', 'lumen', 'polearm']);
  } finally { session.close(); }
});

it('online rooms keep their bots seeded as before', () => {
  const core = new RoomCore({ layout: '1v1', bots: true }, 'online');
  expect(core.match.botKit).toBeNull();
});
