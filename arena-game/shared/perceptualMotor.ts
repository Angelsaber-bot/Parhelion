import { TICK_HZ, WEAPONS, falloff, loadoutWeapon } from './content.ts';
import { navFor, safeDirection } from './botLocomotion.ts';
import type { Smoke } from './grenade.ts';
import { smokeEdgeSearch } from './searchOcclusion.ts';
import { wrapAngle } from './humanCombat.ts';
import { insideMovementBounds, lineOfSight, type Vec3, type ArenaMap } from './map.ts';
import type { Shield } from './match.ts';
import type { NavNode } from './nav.ts';
import { BTN, canSlideTo, forward, playerEye, type Input, type PlayerState } from './sim.ts';

const limit = (n: number, bound: number) => Math.max(-bound, Math.min(bound, n));

/** A route is selected from public map geometry and the actor's desired travel direction.
 * Reaching a destination makes other lanes preferable on the next search. */
function patrol(random: () => number) {
  let path: NavNode[] = [];
  let nextPlan = 0;
  const visited = new Map<string, number>();
  return (map: ArenaMap, me: PlayerState, tick: number, dx: number, dz: number) => {
    while (path.length && Math.hypot(path[0].x - me.x, path[0].z - me.z) < .3 && Math.abs(path[0].y - me.y) < .7) path.shift();
    if (tick >= nextPlan && !path.length) {
      nextPlan = tick + TICK_HZ;
      const nav = navFor({ map }), start = nav.nearest(me.x, me.y, me.z);
      if (start) {
        const choices = map.data.anchors.filter(a => a.kind === 'cover' || a.kind === 'objective').map(anchor => {
          const [x, , z] = anchor.position;
          const distance = Math.hypot(x - me.x, z - me.z);
          const alignment = ((x - me.x) * dx + (z - me.z) * dz) / Math.max(1, distance);
          const recent = Math.max(0, 1 - (tick - (visited.get(anchor.id) ?? -Infinity)) / (20 * TICK_HZ));
          const score = 5 * alignment + 4 * random() + (anchor.kind === 'objective' ? 5 : 0) - .18 * Math.abs(distance - 13) - recent * 13;
          return { anchor, distance, score };
        }).filter(choice => choice.distance > 3).sort((a, b) => b.score - a.score);
        for (const { anchor } of choices.slice(0, 3)) {
          const end = nav.nearest(...anchor.position);
          const route = end && nav.path(start, end);
          if (route?.length) { path = route; visited.set(anchor.id, tick); break; }
        }
      }
    }
    const waypoint = path[0];
    if (waypoint && Math.hypot(waypoint.x - me.x, waypoint.z - me.z) > 2) {
      // A dash or a contact can carry the bot away from its search route.
      path = [];
      return;
    }
    if (waypoint) return Math.atan2(me.x - waypoint.x, me.z - waypoint.z);
  };
}

/** Closed-loop motor options for a five-Hz actor. Reads only its egocentric visible contact,
 * own state and the arena's fixed geometry. Each instance belongs to a single life. */
export function perceptualMotor(occlusionAware = false, random: () => number = () => .5) {
  const smokeSearch = occlusionAware ? smokeEdgeSearch() : undefined;
  const route = patrol(random);
  let observed: Vec3 | undefined, velocityX = 0, velocityZ = 0;
  let lastClear = -Infinity;
  let visibleTicks = 0, lastSeen = -Infinity, lastBearing = 0;
  let lastElevation = 0, yawSpeed = 0, pitchSpeed = 0;
  let clearToScan = false;
  let searching = false, sweep = 0, sweepSign = 1, travelUntil = 0;
  return (map: ArenaMap, me: PlayerState, tick: number, observation: number[], input: Input, request: number, smokes: readonly Smoke[] = [], shields: readonly Shield[] = []) => {
    const [confidence, contactYaw, contactPitch, normalizedRange] = observation;
    const yawProposal = wrapAngle(input.yaw - me.yaw);
    const pitchProposal = input.pitch - me.pitch;
    const range = normalizedRange * 45;
    const [fx, fz] = forward(input.yaw);
    let dx = fx * input.mz - fz * input.mx, dz = fz * input.mz + fx * input.mx;
    let magnitude = Math.min(1, Math.hypot(dx, dz));
    visibleTicks = confidence === 1 ? visibleTicks + 1 : 0;
    input.buttons &= ~BTN.FIRE;

    if (confidence > 0) {
      searching = false;
      const bearing = me.yaw + contactYaw, elevation = me.pitch + contactPitch;
      // Estimate angular motion solely from consecutive, fully visible positions.
      const yawChange = wrapAngle(bearing - lastBearing), pitchChange = elevation - lastElevation;
      if (visibleTicks > 1 && Math.abs(yawChange) < .14 && Math.abs(pitchChange) < .12) {
        yawSpeed += .4 * (yawChange - yawSpeed); pitchSpeed += .4 * (pitchChange - pitchSpeed);
      } else yawSpeed = pitchSpeed = 0;
      if (occlusionAware) {
        const [x, z] = forward(bearing);
        const point: Vec3 = [me.x + range * x, me.y + playerEye(map, me) + range * Math.tan(elevation), me.z + range * z];
        // Range is clipped at 45 m. Glimpses have coarse range and cannot establish velocity.
        const consecutive = confidence === 1 && lastClear === tick - 1 && normalizedRange < 1 && observed;
        const vx = consecutive ? point[0] - consecutive[0] : 0, vz = consecutive ? point[2] - consecutive[2] : 0;
        if (consecutive && Math.hypot(vx, vz) < .22) {
          velocityX += .3 * (vx - velocityX); velocityZ += .3 * (vz - velocityZ);
        } else { velocityX = 0; velocityZ = 0; }
        observed = point;
        if (confidence === 1) lastClear = tick;
      }
      lastSeen = tick; lastBearing = bearing; lastElevation = elevation;
      if (confidence === 1) {
        const melee = WEAPONS[loadoutWeapon(me.loadout, 2)];
        if (range < .9 * melee.range) input.weapon = 2;
        else {
          const preference = input.weapon;
          let best = -Infinity;
          for (const slot of [0, 1]) {
            const index = loadoutWeapon(me.loadout, slot), gun = WEAPONS[index];
            const dispersion = Math.min(1, .34 / Math.max(.01, gun.spread * range));
            const score = gun.damage * gun.pellets / gun.interval * falloff(gun, range) * dispersion *
              (me.ammo[index] ? 1 : .12) * (slot === preference ? 1.3 : 1) * (slot === me.weaponSlot ? 1.18 : 1);
            if (score > best) { best = score; input.weapon = slot; }
          }
        }
      }
      const selected = WEAPONS[loadoutWeapon(me.loadout, input.weapon)];
      // The learned observation aims halfway between chest and head, at the narrow tip of the
      // torso capsule. Aim into the visible body's interior, or use a deliberate precision shot.
      const crouched = observation[4] === 1;
      const precision = confidence === 1 && selected.id === 'longnight' && visibleTicks > 13 && Math.abs(yawSpeed) < .02;
      const heightOffset = precision ? (crouched ? .175 : .25) : (crouched ? -.29 : -.47);
      const targetPitch = confidence === 1
        ? Math.atan2(Math.tan(elevation) * Math.max(.3, range) + heightOffset, Math.max(.3, range)) - me.pitch
        : contactPitch;
      const tracking = confidence < 1 ? .07 : Math.min(.16, .035 + visibleTicks * .009);
      input.yaw = wrapAngle(me.yaw + limit(tracking * contactYaw + yawSpeed + .15 * yawProposal, .066));
      input.pitch = limit(me.pitch + limit(tracking * targetPitch + pitchSpeed + .14 * pitchProposal, .045), 1.45);
      const delay = request & BTN.FIRE ? 12 : 21;
      const inCone = Math.hypot(contactYaw, targetPitch) <= .035 + .32 / Math.max(1, range);
      if (visibleTicks >= delay && inCone && (selected.kind !== 'melee' || range <= selected.range + .4)) {
        const ready = selected.auto && selected.kind === 'gun' || !(me.prevButtons & BTN.FIRE);
        if (ready && !me.reload && me.fireCd <= 1) input.buttons |= BTN.FIRE;
      }
      if (confidence < 1) {
        const peek = smokeSearch?.(map, me, tick, smokes, input.mx, bearing, shields, true);
        if (peek?.moving) {
          dx = peek.dx + .3 * dx; dz = peek.dz + .3 * dz;
          magnitude = Math.max(magnitude, .78);
        }
      }
      if (me.ammo[me.weapon] > 0) input.buttons &= ~BTN.RELOAD;
    } else {
      if (!searching) {
        searching = true; sweep = 0; travelUntil = 0;
        sweepSign = yawProposal < 0 ? -1 : 1;
      }
      const age = tick - lastSeen;
      let remembered: number | undefined;
      if (observed && age <= 2 * TICK_HZ) {
        const lead = Math.min(age, .35 * TICK_HZ);
        const guess: Vec3 = [observed[0] + velocityX * lead, observed[1], observed[2] + velocityZ * lead];
        const at = lineOfSight(map, observed, guess) ? guess : observed;
        if (Math.hypot(me.x - at[0], me.z - at[2]) > .8) remembered = Math.atan2(me.x - at[0], me.z - at[2]);
      }
      const heading = remembered === undefined ? route(map, me, tick, dx, dz) : undefined;
      if (heading !== undefined) {
        const [nx, nz] = forward(heading);
        const influence = occlusionAware ? .65 : .23;
        dx = nx + influence * dx; dz = nz + influence * dz;
        magnitude = Math.max(.65, magnitude);
      }
      const peek = smokeSearch?.(map, me, tick, smokes, input.mx, remembered, shields);
      if (peek) {
        dx = peek.dx; dz = peek.dz; magnitude = peek.moving ? .92 : .2;
        input.yaw = wrapAngle(me.yaw + limit((remembered === undefined ? peek.yaw : wrapAngle(remembered - me.yaw)) * .15 + .12 * yawProposal, .066));
      } else if (remembered !== undefined) {
        // Keep the remembered lane in view while the policy chooses whether to approach or strafe.
        const error = wrapAngle(remembered - me.yaw);
        input.yaw = wrapAngle(me.yaw + limit(.14 * error + .15 * yawProposal, .055));
      } else if (!occlusionAware && age <= .45 * TICK_HZ) {
        input.yaw = wrapAngle(me.yaw + limit(.09 * wrapAngle(lastBearing - me.yaw) + .22 * yawProposal, .055));
      } else if (tick < travelUntil && heading !== undefined) {
        input.yaw = wrapAngle(me.yaw + limit(.08 * wrapAngle(heading - me.yaw) + .35 * yawProposal, .045));
      } else {
        // Commit to a scan long enough to see fresh sectors. Between scans, look along the route.
        if (occlusionAware && sweep === 0) {
          // Keep moving at full speed when the search starts facing a close obstruction.
          const [x, z] = forward(me.yaw);
          clearToScan = [.3, .65, 1].every(d => {
            const px = me.x + d * x, pz = me.z + d * z;
            return insideMovementBounds(map, px, pz) && canSlideTo(map, me, px, pz);
          });
        }
        const turn = sweepSign * Math.min(clearToScan ? .075 : .066, (clearToScan ? .064 : .037) + .45 * Math.abs(yawProposal));
        if (clearToScan && sweep < Math.PI) magnitude *= .36;
        input.yaw = wrapAngle(me.yaw + turn);
        sweep += Math.abs(turn);
        if (sweep >= (occlusionAware ? Math.PI : 2 * Math.PI)) {
          sweep = 0; travelUntil = tick + 2 * TICK_HZ; sweepSign = yawProposal < 0 ? -1 : 1;
        }
      }
      input.pitch = limit(me.pitch + limit(.4 * pitchProposal - .06 * me.pitch, .038), 1.45);
    }
    const [x, z] = safeDirection({ map }, me, dx, dz, sweepSign);
    const [ax, az] = forward(input.yaw);
    input.mx = (-az * x + ax * z) * magnitude;
    input.mz = (ax * x + az * z) * magnitude;
    return input;
  };
}
