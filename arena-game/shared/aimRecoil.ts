import type { Input, PlayerState } from './sim.ts';
import { TICK_HZ } from './content.ts';

// The actual input kick and recovery, distinct from the client's camera animation.
const pitchKicks = [.0055, .022, .016, .0035, .028];
const returnFractions = [.7, .85, .9, .65, .9];
export function shotRecoil(weapon: number, random: () => number) {
  const amplitude = pitchKicks[weapon] ?? pitchKicks[0];
  const pitch = amplitude * (.8 + random() * .4);
  return { pitch, yaw: (random() - .5) * amplitude * .5,
    debt: pitch * (returnFractions[weapon] ?? returnFractions[0]) };
}

export function recoverRecoil(debt: number, seconds: number) {
  return debt * (1 - Math.exp(-seconds * 7));
}

/** Repeatable shot recoil for paired matches. */
function recoilRandom(id: string, life: number) {
  let seed = Math.imul(life + 1, 2654435761) ^ 735481;
  for (let i = 0; i < id.length; i++) seed = Math.imul(seed ^ id.charCodeAt(i), 16777619);
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function botGunRecoil() {
  let life = -1, weapon = -1, ammo = 0, debt = 0;
  let random = Math.random;
  return (me: PlayerState, input: Input) => {
    if (life !== me.lifeId) {
      life = me.lifeId; weapon = -1; debt = 0;
      random = recoilRandom(me.id, life);
    }
    // A trigger request can be rejected by the simulation (reload, stun, swap, etc.).
    // Only the ammunition actually consumed by the previous tick produces a kick.
    if (weapon >= 0 && me.ammo[weapon] < ammo) {
      const kick = shotRecoil(weapon, random);
      input.pitch = Math.min(1.45, input.pitch + kick.pitch);
      input.yaw += kick.yaw;
      debt += kick.debt;
    }
    const recovery = recoverRecoil(debt, 1 / TICK_HZ);
    input.pitch = Math.max(-1.45, input.pitch - recovery);
    debt -= recovery;
    weapon = me.weapon;
    ammo = me.ammo[weapon];
  };
}
