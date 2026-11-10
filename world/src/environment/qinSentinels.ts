import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { QIN_ARMY, QIN_OFFSET, QIN_LEVELS } from '../map/qinPlan';
import { warriorPrims, placeFigure } from '../map/qinFigures';
import { QIN_RANK_SWEEP, qinOrderPhase, qinRowOpen } from './qinArmyOrder';

/**
 * 守陵俑: tomb guardians that patrol the garrison. They see in a cone, give chase, and
 * send a caught intruder back to the zone's entrance. Lured onto a turntable and caught
 * by a change of order, a guardian is ground down by the turning rank for good.
 */
type V2 = [number, number];
export const QIN_SENTINELS: readonly { id: string; path: V2[]; home: V2; safe: [number, number, number] }[] = [
  { id: 'east', path: [[26.5, -105], [26.5, -156], [10, -156], [26.5, -156]], home: [26.5, -105], safe: [27, 28, -118] },
  { id: 'middle', path: [[-11, -108], [-11, -152], [-24, -152], [-11, -152]], home: [-11, -108], safe: [-17, 28, -105] },
  { id: 'west', path: [[-54, -106], [-54, -156], [-45, -156], [-54, -156]], home: [-54, -106], safe: [-57, 28, -118] },
];
export const qinSentinelFlag = (id: string) => `qin_sentinel_${id}_broken`;
const FLOOR = QIN_LEVELS.army, [OX, OZ] = QIN_OFFSET;
const SIGHT = 9, CONE = Math.cos(THREE.MathUtils.degToRad(65)), CATCH = 1.1, PATROL = 1.3, CHASE = 3.1;
const HALL = { x0: -59, x1: 29, z0: -159, z1: -101 };

/** Which zone (between the two rows of ranks) a local x lies in. */
function zoneOf(x: number) { return x > QIN_ARMY.rows[0].x ? 0 : x > QIN_ARMY.rows[1].x ? 1 : 2; }

export function createQinSentinels(convert: (m: THREE.Material) => THREE.Material = m => m) {
  const root = new THREE.Group(); root.name = 'QinSentinels';
  const material = convert(new THREE.MeshStandardMaterial({ name: 'M_QinCraft', vertexColors: true, roughness: .9 }));
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#7fe3ff' }), shardMaterial = material;
  const parts: THREE.BufferGeometry[] = [];
  placeFigure(warriorPrims(1, 4).map(p => ({ ...p, color: p.color === '#5f5047' ? '#3c3a40' : p.color === '#b59a80' ? '#9a8f88' : '#7e746c' })), 0, 0, 0, 0, (g, color, m) => {
    const p = g.toNonIndexed().applyMatrix4(m); p.deleteAttribute('uv'); const c = new THREE.Color(color), a = new Float32Array(p.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } p.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(p);
  }, 1.18);
  const bodyGeo = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); bodyGeo.computeVertexNormals();
  const eyeGeo = new THREE.BoxGeometry(.05, .03, .02), shardGeo = new THREE.DodecahedronGeometry(.32, 0);
  const guards = QIN_SENTINELS.map(def => {
    const group = new THREE.Group(); group.name = `QinSentinel_${def.id}`;
    const body = new THREE.Mesh(bodyGeo, material); body.castShadow = true; group.add(body);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(eyeGeo, eyeMaterial); eye.position.set(s * .05, 2.13, .17); group.add(eye); }
    const rubble = new THREE.Group(); rubble.visible = false;
    for (let k = 0; k < 7; k++) { const m = new THREE.Mesh(shardGeo, shardMaterial); m.position.set(Math.cos(k * 2.3) * (.3 + k * .08), .15, Math.sin(k * 2.3) * (.3 + k * .08)); m.rotation.set(k, k * 2, 0); m.scale.setScalar(.6 + (k % 3) * .25); rubble.add(m); }
    root.add(group); root.add(rubble);
    return { def, group, body, rubble, x: def.home[0], z: def.home[1], yaw: 0, leg: 1, mode: 'patrol' as 'patrol' | 'chase' | 'broken', step: 0 };
  });
  const place = (g: typeof guards[number]) => { g.group.position.set(g.x + OX, FLOOR, g.z + OZ); g.group.rotation.y = g.yaw; g.body.position.y = Math.abs(Math.sin(g.step * 2)) * .06; g.rubble.position.set(g.x + OX, FLOOR, g.z + OZ); };
  guards.forEach(place);
  /** A closed file is a wall three metres either side of its line; guardians press against it. */
  const crosses = (x0: number, x1: number, done: ReadonlySet<string>) => {
    const phase = qinOrderPhase(done);
    for (const row of QIN_ARMY.rows) if (!qinRowOpen(row, phase)) { const a = row.x - 3, b = row.x + 3; if (x1 > a && x1 < b && x1 !== x0) return true; if ((x0 - row.x) * (x1 - row.x) < 0) return true; }
    return false;
  };
  let disposed = false;
  return {
    root, guards,
    apply(done: ReadonlySet<string>) { for (const g of guards) { const broken = done.has(qinSentinelFlag(g.def.id)); g.mode = broken ? 'broken' : g.mode === 'broken' ? 'patrol' : g.mode; g.group.visible = !broken; g.rubble.visible = broken; } },
    /** Advance patrols and chases. Returns the safe point when the player is caught. */
    update(dt: number, player: { x: number; y: number; z: number }, done: ReadonlySet<string>): [number, number, number] | null {
      if (disposed) return null;
      dt = Math.min(Math.max(dt, 0), .05);
      const px = player.x - OX, pz = player.z - OZ, onFloor = Math.abs(player.y - FLOOR) < 2.5 && px > HALL.x0 - 2 && px < HALL.x1 + 2 && pz > HALL.z0 - 2 && pz < HALL.z1 + 2;
      let caught: [number, number, number] | null = null;
      for (const g of guards) {
        if (g.mode === 'broken') continue;
        const dx = px - g.x, dz = pz - g.z, dist = Math.hypot(dx, dz), facing = dist > 1e-3 ? (Math.sin(g.yaw) * dx + Math.cos(g.yaw) * dz) / dist : 1;
        // Ranks are files of figures: guardians see between them even where they cannot pass.
        const sees = onFloor && dist < SIGHT && facing > CONE;
        if (sees) g.mode = 'chase'; else if (g.mode === 'chase' && (!onFloor || dist > SIGHT * 1.6)) g.mode = 'patrol';
        let tx: number, tz: number, speed: number;
        if (g.mode === 'chase') { tx = px; tz = pz; speed = CHASE; }
        else { const goal = g.def.path[g.leg]; tx = goal[0]; tz = goal[1]; speed = PATROL; if (Math.hypot(tx - g.x, tz - g.z) < .2) { g.leg = (g.leg + 1) % g.def.path.length; continue; } }
        const ddx = tx - g.x, ddz = tz - g.z, d = Math.hypot(ddx, ddz);
        if (d > 1e-3) {
          const move = Math.min(d, speed * dt), nx = THREE.MathUtils.clamp(g.x + ddx / d * move, HALL.x0, HALL.x1), nz = THREE.MathUtils.clamp(g.z + ddz / d * move, HALL.z0, HALL.z1);
          if (!crosses(g.x, nx, done)) { g.x = nx; g.z = nz; g.step += move; }
          g.yaw = Math.atan2(ddx, ddz);
        }
        if (g.mode === 'chase' && onFloor && Math.hypot(px - g.x, pz - g.z) < CATCH) {
          caught = [g.def.safe[0] + OX, g.def.safe[1], g.def.safe[2] + OZ]; g.mode = 'patrol'; g.x = g.def.home[0]; g.z = g.def.home[1];
        }
        place(g);
      }
      return caught;
    },
    /** After a change of order: every guardian standing in a rank's sweep is ground down. */
    orderTurned(done: Set<string>): string[] {
      const broken: string[] = [];
      for (const g of guards) {
        if (g.mode === 'broken') continue;
        for (const row of QIN_ARMY.rows) for (const zc of QIN_ARMY.rankCenters) if (Math.hypot(g.x - row.x, g.z - zc) < QIN_RANK_SWEEP) { done.add(qinSentinelFlag(g.def.id)); broken.push(g.def.id); }
      }
      this.apply(done); return [...new Set(broken)];
    },
    zoneOf,
    dispose() { if (disposed) return; disposed = true; root.removeFromParent(); bodyGeo.dispose(); eyeGeo.dispose(); shardGeo.dispose(); material.dispose(); eyeMaterial.dispose(); },
  };
}
