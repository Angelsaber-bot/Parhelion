// Server-side disclosure policy. Never send a concealed opponent's current pose.
import { lineOfSight, type ArenaMap, type Vec3 } from './map.ts';
import { smokeBlocks } from './grenade.ts';
import { playerHitbox } from './hit.ts';
import { playerEye } from './sim.ts';
import type { PlayerSnap, Snapshot } from './match.ts';

export function canSeePlayer(map: ArenaMap, viewer: PlayerSnap, target: PlayerSnap, snapshot: Snapshot): boolean {
  if (!viewer.alive) return false;
  const eye: Vec3 = [viewer.x, viewer.y + playerEye(map, viewer), viewer.z];
  const hitbox = playerHitbox(target.crouched);
  const height = hitbox.headY + hitbox.headRadius * .9;
  // Head, torso, feet and the four silhouette edges: partial cover must not hide a visible player.
  const samples: Vec3[] = [[target.x, target.y + height, target.z], [target.x, target.y + height * .55, target.z], [target.x, target.y + .2, target.z]];
  for (const [dx, dz] of [[map.radius, 0], [-map.radius, 0], [0, map.radius], [0, -map.radius]]) {
    for (const h of [height, height * .55]) samples.push([target.x + dx, target.y + h, target.z + dz]);
  }
  return samples.some(at => lineOfSight(map, eye, at) && !smokeBlocks(snapshot.smokes ?? [], eye, at));
}

export function snapshotForViewer(map: ArenaMap, snapshot: Snapshot, id: string): Snapshot {
  const viewer = snapshot.players.find(p => p.id === id);
  const players = viewer ? snapshot.players.filter(p => p.id === id || p.team === viewer.team || canSeePlayer(map, viewer, p, snapshot)) : [];
  const known = new Set(players.map(p => p.id));
  // A separate allowlisted roster preserves scores without leaking positions, aim, HP or ammo.
  const roster = snapshot.players.map(({ id, name, team, char, bot, kills, deaths }) => ({ id, name, team, char, bot, kills, deaths }));
  const eye: Vec3 | null = viewer?.alive ? [viewer.x, viewer.y + playerEye(map, viewer), viewer.z] : null;
  const visiblePoint = (at: Vec3) => !!eye && lineOfSight(map, eye, at) && !smokeBlocks(snapshot.smokes ?? [], eye, at);
  return { ...snapshot, roster, players, events: snapshot.events.filter(e => {
    switch (e.t) {
      // Public score/death notices contain no spatial data.
      case 'phase': case 'kill': return true;
      case 'hit': return e.shooter === id || e.victim === id || (known.has(e.shooter) && known.has(e.victim));
      // Muzzle/impact endpoints and animation events can disclose hidden opponents too.
      case 'shot': return known.has(e.id) && (e.id === id || visiblePoint(e.from));
      case 'meleeStrike': return known.has(e.id) && (e.id === id || (visiblePoint(e.from) && visiblePoint(e.to)));
      case 'meleeStart': case 'spawn': case 'fx': case 'throw': return known.has(e.id);
      case 'shieldUp': return known.has(e.owner);
      case 'shieldBreak': return snapshot.shields.some(s => s.id === e.sid && visiblePoint([s.x, s.y + 1, s.z]));
      case 'smoke': return true; // same public volume as smokes[]
      case 'blast': return e.owner === id || visiblePoint(e.at);
      case 'bounce': return visiblePoint(e.at);
    }
  }).map(e => e.t === 'shot' && e.id !== id ? { ...e, to: e.to.filter(visiblePoint) } : e),
  shields: snapshot.shields.filter(s => s.team === viewer?.team || visiblePoint([s.x, s.y + 1, s.z])),
  grenades: snapshot.grenades?.filter(g => g.owner === id || visiblePoint([g.x, g.y, g.z])),
  // Smoke is a public occluder; its volume must render even while the viewer is inside it.
  smokes: snapshot.smokes?.map(s => ({ ...s })),
  };
}
