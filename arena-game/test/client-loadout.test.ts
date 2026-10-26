import { expect, it } from 'vitest';
import { AimState, isScopedWeapon } from '../src/aim.ts';
import { startOffline } from '../src/session.ts';
import { isLoadout, type Loadout } from '../shared/content.ts';
import { BTN } from '../shared/sim.ts';
for (const choice of [['lumen', 'corona', 'blade'], ['halo', 'firefly', 'polearm'], ['longnight', 'lumen', 'hammer']] as Loadout[]) {
  it(`actual offline session preserves selected tuple ${choice.join('/')}, restricts slots and equips bots`, () => {
    const session = startOffline({ layout: '2v2', team: 'A', name: 'Test', char: 0, skins: [], loadout: choice }, 'normal');
    try {
      const match = session.match!, player = match.player('you')!;
      expect(player.loadout).toEqual(choice);
      expect([...match.slots.values()].every((slot) => isLoadout(slot.state.loadout))).toBe(true);
      session.send([{ seq: 1, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: BTN.CROUCH, weapon: 2, view: 0 }]); match.step();
      expect(player.weaponSlot).toBe(2); expect(player.crouched).toBe(true);
      session.send([{ seq: 2, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 99, view: 0 }]); match.step();
      expect(player.weaponSlot).toBe(2);
    } finally { session.close(); }
  });
}
it('SMG has iron/reflex ADS, sniper has stronger magnification, and no melee weapon scopes', () => {
  for (let weapon = 0; weapon < 8; weapon++) {
    const aim = new AimState();
    for (let i = 0; i < 120; i++) aim.update(1/60, true, true, weapon);
    expect(aim.fov(weapon)).toBe([56, 62, 24, 58, 16, 78, 78, 78][weapon]);
    expect(isScopedWeapon(weapon)).toBe(weapon === 2 || weapon === 4);
    if (weapon >= 5) expect(aim.value).toBe(0);
  }
});
