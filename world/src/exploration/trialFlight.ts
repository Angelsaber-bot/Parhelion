import { PLAYER } from '../player/player';
import { glideScale, type TrialDef } from './catalog';

/** Keep a glide course on the same descent envelope after upgrading the glider. */
export function trialFlightHeights(def: TrialDef, level: number, terrain: (x: number, z: number) => number) {
  const scale = glideScale(level);
  const extraHeightPerMetre = def.glide
    ? PLAYER.glideSink / PLAYER.glide - PLAYER.glideSink * scale.sink / (PLAYER.glide * scale.speed)
    : 0;
  let distance = 0, previous = def.stele;
  const launchHeight = terrain(...def.stele) + 1.3;
  return def.orbs.map(orb => {
    distance += Math.hypot(orb.p[0] - previous[0], orb.p[1] - previous[1]); previous = orb.p;
    const landingHeight = terrain(...orb.p) + 1.3;
    if (!def.glide) return orb.y ?? landingHeight;
    // A low-level glider must reach every ring before running out of altitude.
    // Apply upgrade compensation before clamping landing rings to the ground:
    // a better glider can remain airborne where the basic one has to land.
    const basicHeight = Math.min(orb.y ?? landingHeight, launchHeight - distance * PLAYER.glideSink / PLAYER.glide);
    return Math.max(landingHeight, basicHeight + distance * extraHeightPerMetre);
  });
}
