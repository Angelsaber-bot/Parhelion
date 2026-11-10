import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { EGYPT_MIRRORS, EGYPT_OFFSET, EGYPT_TEMPLE } from '../map/egyptPlan';

/**
 * 引光: sunlight leaves the gilded disc in the court's east colonnade and travels in
 * straight lines; each bronze mirror turns a quarter at a time and reflects from its
 * polished face only. Lead the light down the hall to the sanctuary's sun disc and the
 * stone door beneath it sinks, opening the incline to the solar-barque tomb.
 */
export const EGYPT_MIRROR_LABEL: readonly [string, string] = ['青铜日镜 · 转动一格', 'Bronze sun mirror · turn a quarter'];
export const EGYPT_MIRROR_MARKERS = EGYPT_MIRRORS.mirrors.map(m => m.id);
type Dir = readonly [number, number];

/** Setting k: the mirror's face normal points along the diagonal (cos, sin) of 45°+90k in XZ. */
export function egyptMirrorSetting(done: ReadonlySet<string>, id: string): number {
  for (let k = 0; k < 4; k++) if (done.has(`${id}_${k}`)) return k;
  return 0;
}
export function turnEgyptMirror(done: Set<string>, id: string): number {
  const next = (egyptMirrorSetting(done, id) + 1) % 4;
  for (let k = 0; k < 4; k++) done.delete(`${id}_${k}`); done.add(`${id}_${next}`); return next;
}
function normalOf(k: number): Dir { const a = Math.PI / 4 + k * Math.PI / 2; return [Math.sign(Math.round(Math.cos(a) * 1e6)) * Math.SQRT1_2, Math.sign(Math.round(Math.sin(a) * 1e6)) * Math.SQRT1_2]; }
/** Reflection from the polished face; a beam striking the back is stopped. */
export function reflect(dir: Dir, k: number): Dir | null {
  const [nx, nz] = normalOf(k), dot = dir[0] * nx + dir[1] * nz;
  if (dot >= 0) return null; // hits the back of the mirror
  const rx = dir[0] - 2 * dot * nx, rz = dir[1] - 2 * dot * nz;
  return [Math.round(rx) + 0, Math.round(rz) + 0];
}
const HIT = .6;
/** Trace the light in region-local XZ. Returns its polyline and whether it reached the disc. */
export function traceSunlight(done: ReadonlySet<string>): { points: [number, number][]; lit: boolean } {
  const bounds = { x0: EGYPT_TEMPLE.court[0] + 1, x1: EGYPT_TEMPLE.court[1] - 1, z0: EGYPT_TEMPLE.sanctuary[2] + 1, z1: EGYPT_TEMPLE.court[3] - 1 };
  let p: [number, number] = [...EGYPT_MIRRORS.emitter.p], dir: Dir = EGYPT_MIRRORS.emitter.dir; const points: [number, number][] = [[...p]];
  for (let bounce = 0; bounce < 8; bounce++) {
    let best: { t: number; id?: string } | null = null;
    for (const m of EGYPT_MIRRORS.mirrors) { const t = (m.p[0] - p[0]) * dir[0] + (m.p[1] - p[1]) * dir[1], off = Math.abs((m.p[0] - p[0]) * dir[1] - (m.p[1] - p[1]) * dir[0]); if (t > HIT && off < HIT && (!best || t < best.t)) best = { t, id: m.id }; }
    { const tg = EGYPT_MIRRORS.target, t = (tg[0] - p[0]) * dir[0] + (tg[1] - p[1]) * dir[1], off = Math.abs((tg[0] - p[0]) * dir[1] - (tg[1] - p[1]) * dir[0]); if (t > HIT && off < HIT && (!best || t < best.t)) best = { t }; }
    const wall = Math.min(dir[0] > 0 ? (bounds.x1 - p[0]) : dir[0] < 0 ? (p[0] - bounds.x0) : Infinity, dir[1] > 0 ? (bounds.z1 - p[1]) : dir[1] < 0 ? (p[1] - bounds.z0) : Infinity);
    if (!best || best.t > wall) { points.push([p[0] + dir[0] * wall, p[1] + dir[1] * wall]); return { points, lit: false }; }
    p = [p[0] + dir[0] * best.t, p[1] + dir[1] * best.t]; points.push([...p]);
    if (!best.id) return { points, lit: true };
    const next = reflect(dir, egyptMirrorSetting(done, best.id)); if (!next) return { points, lit: false };
    dir = next;
  }
  return { points, lit: false };
}

export function createEgyptSunMirrors(convert: (m: THREE.Material) => THREE.Material = m => m) {
  const [ox, oz] = EGYPT_OFFSET, y = EGYPT_MIRRORS.y, top = EGYPT_TEMPLE.terrace[4];
  const root = new THREE.Group(); root.name = 'EgyptSunMirrors';
  const bronze = convert(new THREE.MeshStandardMaterial({ name: 'M_EgyptCraft', vertexColors: true, roughness: .35, metalness: .7 }));
  const stone = convert(new THREE.MeshStandardMaterial({ name: 'M_EgyptCraft', vertexColors: true, roughness: .9 }));
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff0b8', transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
  const tint = (g: THREE.BufferGeometry, color: string) => { const p = g.index ? g.toNonIndexed() : g; p.deleteAttribute('uv'); const c = new THREE.Color(color), a = new Float32Array(p.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } p.setAttribute('color', new THREE.BufferAttribute(a, 3)); return p; };
  // mirror: a polished disc on a fork, its back plain and dark; local +X is the face normal
  const mirrorGeo = mergeGeometries([
    tint(new THREE.CylinderGeometry(.9, .9, .12, 24).rotateZ(Math.PI / 2).translate(.06, y - top - .9, 0), '#f3d47a'),
    tint(new THREE.CylinderGeometry(.95, .95, .1, 24).rotateZ(Math.PI / 2).translate(-.06, y - top - .9, 0), '#3b4a3c'),
    tint(new THREE.BoxGeometry(.18, 1.6, .18).translate(-.25, .7, 0), '#7c6a3a'),
    tint(new THREE.TorusGeometry(.95, .07, 6, 24).rotateY(Math.PI / 2).translate(0, y - top - .9, 0), '#a8854a'),
  ])!; mirrorGeo.computeVertexNormals();
  const mirrors = EGYPT_MIRRORS.mirrors.map(m => { const mesh = new THREE.Mesh(mirrorGeo, bronze); mesh.name = `EgyptMirror_${m.id}`; mesh.position.set(m.p[0] + ox, top + .9, m.p[1] + oz); root.add(mesh); return { ...m, mesh, angle: 0 }; });
  const door = EGYPT_MIRRORS.door;
  const doorGeo = tint(new THREE.BoxGeometry(door.width, door.height, 1.1), '#cdbb94'); doorGeo.computeVertexNormals();
  const doorMesh = new THREE.Mesh(doorGeo, stone); doorMesh.name = 'EgyptSunDoor'; root.add(doorMesh);
  const discGeo = tint(new THREE.CylinderGeometry(1.1, 1.1, .2, 28).rotateX(Math.PI / 2), '#dba93a');
  const disc = new THREE.Mesh(discGeo, bronze); disc.name = 'EgyptSunDisc'; root.add(disc);
  const haloMat = new THREE.MeshBasicMaterial({ color: '#ffe7a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), haloMat); halo.name = 'EgyptSunHalo'; root.add(halo);
  const doorCollisionGeo = new THREE.BoxGeometry(door.width + .4, door.height, 1.2).translate(door.x + ox, top + door.height / 2, door.z + oz);
  const doorCollider: Collider = { name: 'COL_EgyptSunDoor', bvh: new MeshBVH(doorCollisionGeo), enabled: true };
  const beam = new THREE.Group(); beam.name = 'EgyptSunBeam'; root.add(beam);
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  // a fixed pool of beam segments (core + sheath), repositioned rather than recreated
  const segments = Array.from({ length: 8 }, (_, i) => ([[.09, coreMat], [.32, beamMat]] as const).map(([r, mat], j) => { const m = new THREE.Mesh(unitCyl, mat); m.name = `EgyptSunBeam_${i}_${j ? 'sheath' : 'core'}`; m.userData.radius = r; m.renderOrder = 4; m.visible = false; m.userData.dynamic = true; beam.add(m); return m; }));
  const markers: Marker[] = EGYPT_MIRRORS.mirrors.map(m => ({ id: m.id, type: 'interact', label: EGYPT_MIRROR_LABEL[0], p: [m.p[0] + ox, top + 1.4, m.p[1] + oz], radius: 2.8 }));
  let sinking = 0, lit = false, disposed = false, time = 0;
  const placeDoor = () => { const dy = -sinking * (door.height + .1); doorMesh.position.set(door.x + ox, top + door.height / 2 + dy, door.z + oz + .3); disc.position.set(door.x + ox, y + dy, door.z + oz + .95); halo.position.set(door.x + ox, y + dy, door.z + oz + 1.1); };
  placeDoor();
  function apply(done: ReadonlySet<string>) {
    if (disposed) return;
    // three.js turns local +X to (cos θ, -sin θ) in XZ, so the face-normal angle is negated
    for (const m of mirrors) m.angle = -(Math.PI / 4 + egyptMirrorSetting(done, m.id) * Math.PI / 2);
    const trace = traceSunlight(done); lit = trace.lit;
    for (const [i, pair] of segments.entries()) {
      const on = i + 1 < trace.points.length;
      for (const m of pair) m.visible = on;
      if (!on) continue;
      const a = new THREE.Vector3(trace.points[i][0] + ox, y, trace.points[i][1] + oz), b = new THREE.Vector3(trace.points[i + 1][0] + ox, y, trace.points[i + 1][1] + oz), len = Math.max(.01, a.distanceTo(b));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      for (const m of pair) { m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.copy(q); m.scale.set(m.userData.radius, len, m.userData.radius); }
    }
    if (done.has(EGYPT_MIRRORS.solved) && !lit) { sinking = 1; placeDoor(); }
    doorCollider.enabled = !done.has(EGYPT_MIRRORS.solved);
  }
  return {
    root, markers, colliders: [doorCollider],
    get lit() { return lit; }, get open() { return !doorCollider.enabled; },
    apply,
    /** Returns true while the disc is lit but the door is not yet recorded open. */
    update(dt: number, done: ReadonlySet<string>): boolean {
      if (disposed) return false; time += dt;
      for (const m of mirrors) { const d = m.angle - m.mesh.rotation.y; m.mesh.rotation.y += Math.abs(d) < .01 ? d : d * Math.min(1, dt * 6); }
      haloMat.opacity = lit ? .35 + .15 * Math.sin(time * 3) : 0;
      for (const pair of segments) if (pair[1].visible) pair[1].scale.x = pair[1].scale.z = .3 + .04 * Math.sin(time * 5 + pair[1].position.x);
      const solved = done.has(EGYPT_MIRRORS.solved);
      if (solved && sinking < 1) { sinking = Math.min(1, sinking + dt * .35); placeDoor(); }
      return lit && !solved;
    },
    dispose() { if (disposed) return; disposed = true; doorCollider.enabled = false; root.removeFromParent(); [mirrorGeo, doorGeo, discGeo, doorCollisionGeo, unitCyl, halo.geometry].forEach(g => g.dispose()); [bronze, stone, beamMat, coreMat, haloMat].forEach(m => m.dispose()); },
  };
}
