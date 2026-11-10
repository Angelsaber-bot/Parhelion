import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { QIN_ARMY, QIN_FRAME, QIN_LEVELS, worldToQin, qinToWorld } from '../map/qinPlan';
import { planMatrix } from '../map/planFrame';
import { warriorPrims, placeFigure, type WarriorKind } from '../map/qinFigures';

export type QinOrderPhase = 'a' | 'b';
export const QIN_ORDER_LABEL: readonly [string, string] = ['军令台 · 转动兵俑阵列', 'Command post · Turn the terracotta ranks'];
export const QIN_ORDER_MARKERS = QIN_ARMY.levers.map(l => l.id);
/** Every rank turns about its own centre; nothing may stand inside that circle while it turns. */
export const QIN_RANK_SWEEP = Math.hypot(QIN_ARMY.rankLength / 2, QIN_ARMY.rankWidth / 2) + .45;

export function qinOrderPhase(done: ReadonlySet<string>): QinOrderPhase { return done.has(QIN_ARMY.flag) ? 'b' : 'a'; }
export function qinRowOpen(row: { openIn: QinOrderPhase }, phase: QinOrderPhase) { return row.openIn === phase; }
export function qinShaftOpen(phase: QinOrderPhase) { return QIN_ARMY.shaftGate.openIn === phase; }
export function toggleQinOrder(done: Set<string>): QinOrderPhase {
  if (done.has(QIN_ARMY.flag)) done.delete(QIN_ARMY.flag); else done.add(QIN_ARMY.flag);
  return qinOrderPhase(done);
}
/** World-space position (feet) blocks a turn when it stands in any rank's sweep or under the shaft gate. */
export function qinTurnBlocked(p: { x: number; y: number; z: number }): boolean {
  const floor = QIN_LEVELS.army, [x, z] = worldToQin(p.x, p.z);
  if (p.y < floor - 1 || p.y > floor + 9) return false;
  for (const row of QIN_ARMY.rows) for (const zc of QIN_ARMY.rankCenters) if (Math.hypot(x - row.x, z - zc) < QIN_RANK_SWEEP + .35) return true;
  const g = QIN_ARMY.shaftGate;
  return Math.abs(x - g.x) < g.width / 2 + .4 && Math.abs(z - g.z) < 1.2;
}

type Part = { geo: THREE.BufferGeometry; color: string };
function piece(parts: Part[], size: [number, number, number], at: [number, number, number], color: string, yaw = 0, geo?: THREE.BufferGeometry) {
  const source = geo ?? new THREE.BoxGeometry(...size), g = source.toNonIndexed(); source.dispose();
  if (geo) g.scale(...size);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
  parts.push({ geo: g, color });
}
function bake(parts: Part[]) {
  const c = new THREE.Color(), geos = parts.map(({ geo, color }) => {
    c.set(color); const n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.deleteAttribute('uv'); geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
  });
  const merged = mergeGeometries(geos)!; geos.forEach(g => g.dispose()); merged.computeVertexNormals(); return merged;
}
/** One rank on its turntable, built along local Z (the closed orientation): a rammed plinth
 * with a bronze kerb, two files of seven figures facing out, kneeling archers at the head. */
function rankGeometry(seed: number) {
  const parts: Part[] = [], L = QIN_ARMY.rankLength, W = QIN_ARMY.rankWidth;
  piece(parts, [W, .42, L], [0, .21, 0], '#8c7356');
  for (const s of [-1, 1]) { piece(parts, [.14, .46, L], [s * (W / 2 - .07), .23, 0], '#5f7c66'); piece(parts, [W, .46, .14], [0, .23, s * (L / 2 - .07)], '#5f7c66'); }
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) {
    const z = -L / 2 + 1.25 + i * (L - 2.5) / 6, x = s * 1.25, head = i === 6;
    const kind = (head ? 4 : (i + seed + (s > 0 ? 1 : 0)) % 3 === 0 ? 0 : (i + seed) % 3 === 1 ? 2 : 1) as WarriorKind;
    placeFigure(warriorPrims(kind, i * 2 + (s > 0 ? 1 : 0) + seed), x, .42, z, s * Math.PI / 2, (geo, color, m) => { const g = geo.toNonIndexed().applyMatrix4(m); parts.push({ geo: g, color }); });
  }
  // standard-bearer's pole at the rank's head with a black, cinnabar-edged banner
  piece(parts, [.12, 4.6, .12], [0, 2.7, L / 2 - .5], '#5c4532');
  piece(parts, [.08, 1.5, 1.9], [0, 4.2, L / 2 - 1.45], '#201e1d');
  piece(parts, [.1, .12, 1.9], [0, 4.98, L / 2 - 1.45], '#c0452f');
  return bake(parts);
}

/** `convert` lets the game swap in its toon/Qin surface shading; tests keep the plain material. */
export function createQinArmyOrder(convert: (m: THREE.Material) => THREE.Material = m => m) {
  // Built in Qin's authored frame; the root and the colliders are then placed in the world.
  const ox = 0, oz = 0, frame = planMatrix(QIN_FRAME), floor = QIN_LEVELS.army, root = new THREE.Group(); root.name = 'QinArmyOrder';
  root.applyMatrix4(frame);
  const material = convert(new THREE.MeshStandardMaterial({ name: 'M_QinCraft', vertexColors: true, roughness: .92 }));
  const bronze = convert(new THREE.MeshStandardMaterial({ name: 'M_QinCraft', vertexColors: true, roughness: .45, metalness: .55 }));
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const ranks: { mesh: THREE.Mesh; row: (typeof QIN_ARMY.rows)[number]; angle: number }[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  for (const row of QIN_ARMY.rows) for (const [i, zc] of QIN_ARMY.rankCenters.entries()) {
    const geo = rankGeometry(i + (row.id === 'g1' ? 0 : 2)); geometries.push(geo);
    const mesh = new THREE.Mesh(geo, material); mesh.name = `QinRank_${row.id}_${i}`;
    mesh.position.set(row.x + ox, floor, zc + oz); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    ranks.push({ mesh, row, angle: 0 });
  }
  // Per-row collision in both orientations; the active one follows the order.
  const rowColliders = new Map<string, { closed: Collider; open: Collider }>();
  const solidBox = (cx: number, cz: number, w: number, d: number, h: number) => new THREE.BoxGeometry(w, h, d).translate(cx, floor + h / 2, cz);
  for (const row of QIN_ARMY.rows) {
    const make = (open: boolean) => {
      const g = mergeGeometries(QIN_ARMY.rankCenters.map(zc => open
        ? solidBox(row.x + ox, zc + oz, QIN_ARMY.rankLength, QIN_ARMY.rankWidth, 3.2)
        : solidBox(row.x + ox, zc + oz, QIN_ARMY.rankWidth, QIN_ARMY.rankLength, 3.2)))!;
      g.applyMatrix4(frame); geometries.push(g); return { name: `COL_QinRank_${row.id}_${open ? 'open' : 'closed'}`, bvh: new MeshBVH(g), enabled: false } as Collider;
    };
    rowColliders.set(row.id, { closed: make(false), open: make(true) });
  }
  // Bronze portcullis sealing the deep shaft; it rises into the lintel when the order opens.
  const G = QIN_ARMY.shaftGate, gateParts: Part[] = [];
  for (let i = 0; i <= 8; i++) piece(gateParts, [.22, G.height, .22], [-G.width / 2 + i * G.width / 8, G.height / 2, 0], '#5f7c66');
  for (const y of [1.2, 3, 4.8]) piece(gateParts, [G.width, .25, .26], [0, y, 0], '#a8854a');
  const gateGeo = bake(gateParts); geometries.push(gateGeo);
  const gate = new THREE.Mesh(gateGeo, bronze); gate.name = 'QinShaftGate'; gate.position.set(G.x + ox, floor, G.z + oz); root.add(gate);
  const gateCollisionGeo = new THREE.BoxGeometry(G.width + .6, G.height, .8).translate(G.x + ox, floor + G.height / 2, G.z + oz).applyMatrix4(frame); geometries.push(gateCollisionGeo);
  const gateCollider: Collider = { name: 'COL_QinShaftGate', bvh: new MeshBVH(gateCollisionGeo), enabled: true };
  // Command posts: a bronze drum on a rammed step, its wheel and pennant showing the order.
  const levers: { wheel: THREE.Mesh; pennant: THREE.Mesh }[] = [];
  const pennantA = new THREE.MeshBasicMaterial({ color: '#a63a2c' }), pennantB = new THREE.MeshBasicMaterial({ color: '#1f1d1c' });
  for (const lever of QIN_ARMY.levers) {
    const parts: Part[] = [], at = new THREE.Vector3(lever.p[0] + ox, floor, lever.p[2] + oz);
    piece(parts, [2.2, .4, 2.2], [0, .2, 0], '#9c845f');
    piece(parts, [1, 1, 1], [0, 1, 0], '#5f7c66', 0, new THREE.CylinderGeometry(.55, .65, 1.2, 12));
    piece(parts, [.12, 3.6, .12], [.9, 1.8, -.6], '#5c4532');
    for (let k = 0; k < 6; k++) piece(parts, [.12, .12, .12], [Math.cos(k) * .6, 1.55, Math.sin(k) * .6], '#a8854a');
    const baseGeo = bake(parts); geometries.push(baseGeo);
    const base = new THREE.Mesh(baseGeo, bronze); base.position.copy(at); root.add(base);
    const wheelParts: Part[] = [];
    piece(wheelParts, [1, 1, 1], [0, 0, 0], '#a8854a', 0, new THREE.TorusGeometry(.7, .07, 6, 18).rotateX(Math.PI / 2));
    for (let k = 0; k < 4; k++) piece(wheelParts, [1.4, .08, .08], [0, 0, 0], '#a8854a', k * Math.PI / 4);
    piece(wheelParts, [.14, .14, 1.6], [0, 0, .9], '#a63a2c');
    const wheelGeo = bake(wheelParts); geometries.push(wheelGeo);
    const wheel = new THREE.Mesh(wheelGeo, bronze); wheel.position.copy(at).add(new THREE.Vector3(0, 1.72, 0)); root.add(wheel);
    const pennantGeo = new THREE.PlaneGeometry(1.1, .7); geometries.push(pennantGeo);
    const pennant = new THREE.Mesh(pennantGeo, pennantA); pennant.position.copy(at).add(new THREE.Vector3(.9 , 3.2, -.05)); pennant.rotation.y = Math.PI / 2; root.add(pennant);
    (pennant.material as THREE.Material).side = THREE.DoubleSide;
    levers.push({ wheel, pennant });
  }
  pennantB.side = THREE.DoubleSide;
  void glow;
  const markers: Marker[] = QIN_ARMY.levers.map(l => { const [x, z] = qinToWorld(l.p[0], l.p[2]); return { id: l.id, type: 'interact', label: QIN_ORDER_LABEL[0], p: [x, floor + 1.2, z], radius: 2.6 }; });
  let phase: QinOrderPhase | null = null, gateLift = 0, disposed = false;
  const targetAngle = (row: { openIn: QinOrderPhase }, p: QinOrderPhase) => qinRowOpen(row, p) ? Math.PI / 2 : 0;
  function apply(done: ReadonlySet<string>, instant = false) {
    if (disposed) return;
    const next = qinOrderPhase(done), first = phase === null; phase = next;
    for (const row of QIN_ARMY.rows) { const c = rowColliders.get(row.id)!, open = qinRowOpen(row, next); c.open.enabled = open; c.closed.enabled = !open; }
    gateCollider.enabled = !qinShaftOpen(next);
    for (const l of levers) l.pennant.material = next === 'a' ? pennantA : pennantB;
    if (first || instant) { for (const r of ranks) { r.angle = targetAngle(r.row, next); r.mesh.rotation.y = r.angle; } gateLift = qinShaftOpen(next) ? 1 : 0; update(0); }
  }
  function update(dt: number) {
    if (disposed || phase === null) return;
    const step = Math.min(dt, .05) * 1.25;
    for (const r of ranks) {
      const goal = targetAngle(r.row, phase), d = goal - r.angle;
      r.angle += Math.abs(d) <= step ? d : Math.sign(d) * step; r.mesh.rotation.y = r.angle;
    }
    const lift = qinShaftOpen(phase) ? 1 : 0; gateLift += Math.max(-step, Math.min(step, lift - gateLift));
    gate.position.y = floor + gateLift * (G.height - .4);
    for (const l of levers) l.wheel.rotation.y = phase === 'b' ? Math.PI / 2 : 0;
  }
  return {
    root, markers, colliders: [...[...rowColliders.values()].flatMap(c => [c.closed, c.open]), gateCollider],
    apply, update,
    get phase() { return phase; },
    get turning() { return ranks.some(r => Math.abs(r.angle - targetAngle(r.row, phase ?? 'a')) > 1e-3); },
    dispose() {
      if (disposed) return; disposed = true;
      for (const c of [...rowColliders.values()].flatMap(c => [c.closed, c.open])) c.enabled = false; gateCollider.enabled = false;
      root.removeFromParent(); geometries.forEach(g => g.dispose()); [material, bronze, glow, pennantA, pennantB].forEach(m => m.dispose());
    },
  };
}
