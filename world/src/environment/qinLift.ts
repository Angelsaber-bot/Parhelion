import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { QIN_LIFT, QIN_OFFSET } from '../map/qinPlan';

export const QIN_LIFT_LABEL: readonly [string, string] = ['升降机关 · 起落竖井', 'Lift · raise or lower the shaft cage'];
export const QIN_LIFT_MARKERS = [QIN_LIFT.markers.top, QIN_LIFT.markers.bottom];

/**
 * 升降机关: a timber cage on bronze chains running between the ridge headframe and the
 * garrison avenue. Its floor is a moving collider (geometry shifted, BVH refitted), so a
 * player standing on it is carried. A bar closes the shaft mouth whenever the cage is away.
 */
export function createQinLift(convert: (m: THREE.Material) => THREE.Material = m => m) {
  const [ox, oz] = QIN_OFFSET, X = QIN_LIFT.x + ox, Z = QIN_LIFT.z + oz, H = QIN_LIFT.half - .15;
  const root = new THREE.Group(); root.name = 'QinLift';
  const material = convert(new THREE.MeshStandardMaterial({ name: 'M_QinCraft', vertexColors: true, roughness: .8 }));
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, color: string, m: THREE.Matrix4) => {
    const p = g.toNonIndexed().applyMatrix4(m); p.deleteAttribute('uv'); const c = new THREE.Color(color), a = new Float32Array(p.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } p.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(p);
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string) => add(new THREE.BoxGeometry(w, h, d), color, new THREE.Matrix4().makeTranslation(x, y, z));
  // cage built about its floor at local y=0
  box(0, -.2, 0, H * 2, .4, H * 2, '#8c6c4b');
  for (let k = -3; k <= 3; k++) box(k * H / 3.5, .02, 0, .08, .04, H * 2, '#5c4532');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (H - .1), 1.3, sz * (H - .1), .2, 2.6, .2, '#5f7c66');
  for (const s of [-1, 1]) { box(s * (H - .1), 1.05, 0, .1, .1, H * 2, '#a63a2c'); box(0, 1.05, s * (H - .1), H * 2, .1, .1, '#a63a2c'); }
  box(0, 2.65, 0, H * 2, .2, H * 2, '#5c4532');
  const cageGeo = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); cageGeo.computeVertexNormals();
  const cage = new THREE.Mesh(cageGeo, material); cage.name = 'QinLiftCage'; cage.castShadow = cage.receiveShadow = true; cage.frustumCulled = false; root.add(cage);
  // four bronze chains from the cage roof to the sheave, stretched to the cage's height each frame
  parts.length = 0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(.04, .04, 1, 5), '#a8854a', new THREE.Matrix4().makeTranslation(sx * .5, .5, sz * .5));
  const chainGeo = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); parts.length = 0; chainGeo.computeVertexNormals();
  const chains = new THREE.Mesh(chainGeo, material); chains.name = 'QinLiftChains'; chains.frustumCulled = false; root.add(chains);
  // sheave wheel on the headframe, turned by travel
  const wheelParts: THREE.BufferGeometry[] = [];
  add(new THREE.TorusGeometry(1.4, .12, 6, 24), '#5c4532', new THREE.Matrix4().makeRotationY(Math.PI / 2));
  for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(.08, 2.8, .08), '#8c6c4b', new THREE.Matrix4().makeRotationX(k * Math.PI / 6));
  add(new THREE.CylinderGeometry(.18, .18, 1.2, 8), '#5f7c66', new THREE.Matrix4().makeRotationZ(Math.PI / 2));
  wheelParts.push(...parts); const wheelGeo = mergeGeometries(wheelParts)!; wheelParts.forEach(p => p.dispose()); wheelGeo.computeVertexNormals();
  const wheel = new THREE.Mesh(wheelGeo, material); wheel.name = 'QinLiftSheave'; wheel.position.set(X, QIN_LIFT.top + 9.9, Z); root.add(wheel);
  // the shaft-mouth bar on the boarding (north) side
  const barGeo = new THREE.BoxGeometry(QIN_LIFT.half * 2 + .4, 1.1, .2); barGeo.translate(X, QIN_LIFT.top + .55, Z - QIN_LIFT.half - .15);
  const bar = new THREE.Mesh(barGeo, material); bar.name = 'QinLiftBar';
  { const c = new Float32Array(barGeo.attributes.position.count * 3).fill(.55); barGeo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  root.add(bar);
  // collision: the cage floor (moving) and the mouth bar (switched)
  const floorBase = new THREE.BoxGeometry(H * 2, .4, H * 2); floorBase.translate(X, -.2, Z);
  const floorGeo = floorBase.clone(), basePositions = (floorBase.attributes.position.array as Float32Array).slice();
  const floorBvh = new MeshBVH(floorGeo);
  const floorCollider: Collider = { name: 'COL_QinLiftCage', bvh: floorBvh, enabled: true };
  const barCollider: Collider = { name: 'COL_QinLiftBar', bvh: new MeshBVH(barGeo.clone()), enabled: false };
  const markers: Marker[] = [
    { id: QIN_LIFT.markers.top, type: 'interact', label: QIN_LIFT_LABEL[0], p: [X, QIN_LIFT.top + 1.2, Z - QIN_LIFT.half - .6], radius: 3.4 },
    { id: QIN_LIFT.markers.bottom, type: 'interact', label: QIN_LIFT_LABEL[0], p: [X, QIN_LIFT.bottom + 1.2, Z + QIN_LIFT.half + .4], radius: 3.4 },
  ];
  let y: number = QIN_LIFT.top, target: number = QIN_LIFT.top, disposed = false;
  const setY = (value: number) => {
    y = value; cage.position.set(X, y, Z); chains.position.set(X, y + 2.75, Z); chains.scale.y = Math.max(.1, QIN_LIFT.top + 9.6 - (y + 2.75));
    const pos = floorGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) { pos[i] = basePositions[i]; pos[i + 1] = basePositions[i + 1] + y; pos[i + 2] = basePositions[i + 2]; }
    floorGeo.attributes.position.needsUpdate = true; floorBvh.refit();
    barCollider.enabled = Math.abs(y - QIN_LIFT.top) > .05; bar.visible = barCollider.enabled;
  };
  setY(QIN_LIFT.top);
  const inShaft = (p: { x: number; z: number }) => Math.abs(p.x - X) < QIN_LIFT.half + .2 && Math.abs(p.z - Z) < QIN_LIFT.half + .2;
  return {
    root, markers, colliders: [floorCollider, barCollider],
    get y() { return y; }, get moving() { return Math.abs(target - y) > 1e-3; },
    get atTop() { return Math.abs(y - QIN_LIFT.top) < 1e-3 && !this.moving; },
    /** Send the cage to the other end (or call it). Returns the destination, or null when refused. */
    operate(): 'top' | 'bottom' | null {
      if (disposed || Math.abs(target - y) > 1e-3) return null;
      target = Math.abs(y - QIN_LIFT.top) < 1e-3 ? QIN_LIFT.bottom : QIN_LIFT.top; return target === QIN_LIFT.top ? 'top' : 'bottom';
    },
    /** Moves the cage; a body standing in the shaft below a descending cage halts it. */
    update(dt: number, player?: { x: number; y: number; z: number }) {
      if (disposed) return;
      if (Math.abs(target - y) > 1e-3) {
        const dir = Math.sign(target - y), dist = Math.abs(target - y), ease = Math.min(1, .25 + dist / 3), step = Math.min(dist, QIN_LIFT.speed * ease * Math.min(dt, .05));
        if (dir < 0 && player && inShaft(player) && player.y < y - .5 && player.y > y - 3.2) return;
        setY(y + dir * step);
      }
      wheel.rotation.x = -y * .7;
    },
    inShaft,
    dispose() { if (disposed) return; disposed = true; floorCollider.enabled = false; barCollider.enabled = false; root.removeFromParent(); [cageGeo, chainGeo, wheelGeo, barGeo, floorBase, floorGeo].forEach(g => g.dispose()); material.dispose(); },
  };
}
