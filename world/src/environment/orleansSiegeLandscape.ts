import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { ORLEANS_OFFSET, ORLEANS_TOURELLES as FORT } from '../map/orleansOutskirts';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { climaxCleared, climaxCheckpoint } from '../story/realmClimaxes';

type Point = [number, number, number];
type Ground = (x: number, z: number, ceiling: number) => number | null;
const stone = '#a89a7e', oak = '#83664a', dark = '#4c443c', linen = '#d4c5a1', iron = '#5b6468';

/** Separate south-bank retreat and allied staging spaces. The side drawbridge
 * never operates the north city gate. Positions are in the existing fort frame. */
export function createOrleansSiegeLandscape(ground: Ground) {
  const art = new SiteArt();
  const matrix = new THREE.Matrix4().makeRotationY(FORT.yaw);
  matrix.setPosition(ORLEANS_OFFSET[0] + FORT.x, 0, ORLEANS_OFFSET[1] + FORT.z);
  const world = (p: Point) => new THREE.Vector3(...p).applyMatrix4(matrix);
  const floor = (x: number, z: number) => {
    const p = world([x, 0, z]); return ground(p.x, p.z, 28) ?? FORT.deck;
  };
  const point = (x: number, z: number): Point => [x, floor(x, z), z];
  function ramp(from: Point, to: Point, width: number, rails = true) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a);
    const n = Math.hypot(d.x, d.z), yaw = Math.atan2(d.x, d.z);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.atan2(d.y, n), yaw, 0, 'YXZ'));
    const r = new THREE.Euler().setFromQuaternion(q), mid = a.clone().lerp(b, .5);
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    art.box(mid.clone().addScaledVector(normal, -.16).toArray(), [width, .32, d.length() + .4], oak, true, 'body', [r.x, r.y, r.z]);
    if (!rails) return;
    for (const sign of [-1, 1]) {
      const offset = new THREE.Vector3(d.z / n, 0, -d.x / n).multiplyScalar(sign * (width / 2 - .12));
      const start = a.clone().add(offset), end = b.clone().add(offset);
      art.beam(start.clone().add(new THREE.Vector3(0, 1.02, 0)).toArray(), end.clone().add(new THREE.Vector3(0, 1.02, 0)).toArray(), .13, dark, true);
      for (let t = 0; t <= n; t += 3.4) {
        const p = start.clone().lerp(end, t / n);
        art.box([p.x, p.y + .5, p.z], [.14, 1, .14], oak, true);
      }
    }
    for (let t = .5; t < n; t += .8) {
      const p = a.clone().lerp(b, t / n).addScaledVector(normal, .012);
      art.box(p.toArray(), [width - .1, .02, .05], dark, false, 'body', [r.x, r.y, r.z]);
    }
  }
  function tent(p: Point, w: number, depth: number, color: string) {
    const [x, y, z] = p, h = 3.2;
    for (const side of [-1, 1]) {
      art.box([x + side * w / 4, y + h / 2 + .45, z], [Math.hypot(w / 2, h - .9), .075, depth], color, false, 'body', [0, 0, -side * Math.atan2(h - .9, w / 2)]);
      for (const end of [-1, 1]) {
        art.beam([x, y + h, z + end * depth / 2], [x + side * (w / 2 + 1), y, z + end * (depth / 2 + .7)], .035, linen);
        art.box([x + side * (w / 2 + 1), y + .18, z + end * (depth / 2 + .7)], [.07, .5, .07], dark);
      }
    }
    for (const end of [-1, 1]) art.beam([x, y, z + end * depth / 2], [x, y + h + .15, z + end * depth / 2], .12, oak, true);
    art.beam([x, y + h, z - depth / 2], [x, y + h, z + depth / 2], .14, oak);
    for (const side of [-1, 1]) art.box([x + side * w * .23, y + .25, z], [w * .3, .16, depth * .65], '#8b7f68', true);
  }
  function basket(p: Point) {
    const [x, y, z] = p;
    art.cyl([x, y + .72, z], .67, 1.44, oak, true);
    art.cyl([x, y + 1.43, z], .61, .04, '#716849');
    for (const height of [.2, .5, .8, 1.1, 1.36]) art.ring([x, y + height, z], .68, .045, linen, 'body', [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 10; k++) {
      const t = k * Math.PI / 5;
      art.box([x + Math.cos(t) * .65, y + .72, z + Math.sin(t) * .65], [.045, 1.42, .045], dark);
    }
  }
  function banner(x: number, z: number, color: string, sign: number) {
    const y = floor(x, z);
    art.beam([x, y, z], [x, y + 5.2, z], .14, oak, true);
    art.box([x + .8, y + 4.45, z], [1.6, 1.05, .045], color);
    // Distinct devices keep retreat and friendly aid readable without text overlays.
    art.box([x + .8, y + 4.45, z + .03], [sign < 0 ? 1.15 : .15, sign < 0 ? .15 : .75, .02], linen);
    if (sign > 0) art.box([x + .8, y + 4.45, z + .03], [.65, .14, .025], linen);
  }

  const bridgeY = Math.max(FORT.deck + 4.5, floor(-24, 14) + 2.8, floor(-42, 14) + 2.8);
  const fortStart = point(0, 15), landing: Point = [-24, bridgeY, 14], far: Point = [-42, bridgeY, 14];
  ramp(fortStart, [-20, bridgeY, 14], 4.8);
  ramp([-20, bridgeY, 14], landing, 4.8);
  ramp(far, point(-63, 18), 4.8);
  // The hinge piers and overhead balance frame stand on the two banks.
  for (const x of [-24, -42]) for (const side of [-1, 1]) {
    const y = floor(x, 14 + side * 2.8);
    art.box([x, (y + bridgeY) / 2 - .2, 14 + side * 2.8], [1.4, bridgeY - y + .4, 1.4], stone, true);
    art.box([x, bridgeY + .5, 14 + side * 2.8], [1.5, 1, 1.5], stone, true);
  }
  for (const z of [11.2, 16.8]) {
    art.beam([-23.7, bridgeY, z], [-23.7, bridgeY + 7.4, z], .42, dark, true);
    art.beam([-23.7, bridgeY + 7.4, z], [-19, bridgeY + 7.4, z], .32, oak);
    art.beam([-23.7, bridgeY + 4, z], [-19, bridgeY + 7.4, z], .22, dark);
    art.box([-19, bridgeY + 5.7, z], [1.1, 2.2, 1.1], stone);
  }
  art.beam([-23.7, bridgeY + 7.4, 11.2], [-23.7, bridgeY + 7.4, 16.8], .36, dark);
  art.cyl([-21.2, bridgeY + 1.1, 17.3], .6, 1.3, oak, true, 'body', [Math.PI / 2, 0, 0]);
  art.ring([-21.2, bridgeY + 1.1, 18], .83, .085, iron);
  for (let k = 0; k < 6; k++) {
    const t = k * Math.PI / 3;
    art.beam([-21.2, bridgeY + 1.1, 18], [-21.2 + Math.cos(t) * .8, bridgeY + 1.1 + Math.sin(t) * .8, 18], .07, oak);
  }

  // West: enemy casualty assembly, facing AWAY from the city, with a landward exit.
  const enemy = point(-77, 31);
  tent([enemy[0] - 5, enemy[1], enemy[2]], 6, 9, '#8d6653');
  tent(point(-83, 47), 6, 7, '#8b8067');
  banner(-69, 29, '#853f39', -1);
  ramp(point(-63, 18), point(-67, 31), 4.8, false);
  ramp(point(-67, 31), point(-70, 54), 4.8, false);
  for (const x of [-89, -87, -85]) basket(point(x, 25));
  // Actual stretchers, water buckets and stacked surrendered polearms.
  for (let i = 0; i < 3; i++) {
    const [x, y, z] = point(-75 + i * 2.2, 41);
    art.box([x, y + .42, z], [1.1, .13, 2.5], linen, true);
    for (const side of [-1, 1]) art.beam([x + side * .6, y + .45, z - 1.65], [x + side * .6, y + .45, z + 1.65], .07, oak);
  }
  // East: separate allied engineer/boat staging, never reused as the enemy safe area.
  tent(point(37, 31), 7, 9, '#727e96');
  banner(29, 26, '#536e99', 1);
  for (let i = 0; i < 5; i++) {
    const [x, y, z] = point(39, 19 + i * .45);
    art.box([x, y + .4 + (i % 2) * .2, z], [9.2, .25, .32], oak, true);
  }
  for (const x of [27, 29, 31]) basket(point(x, 39));
  const table = point(32, 32);
  art.box([table[0], table[1] + .9, table[2]], [3.2, .16, 1.6], oak, true);
  art.paper(table[0], table[1] + 1, table[2], 1.7, .95);
  for (const side of [-1, 1]) art.box([table[0] + side * 1.2, table[1] + .45, table[2]], [.18, .9, 1.3], dark, true);

  // Moving leaf uses the same transform as its collision mesh and saved state.
  const leaf = new SiteArt();
  leaf.box([-9, -.16, 0], [18.4, .32, 4.6], oak, true);
  for (let x = -17.5; x < 0; x += .7) leaf.box([x, .012, 0], [.055, .023, 4.4], dark);
  for (const side of [-1, 1]) {
    leaf.beam([-.2, 1, side * 2.2], [-17.8, 1, side * 2.2], .13, dark, true);
    for (let x = -17; x < 0; x += 3) leaf.box([x, .5, side * 2.2], [.14, 1, .14], oak, true);
  }
  const leafGeometry = mergeParts(leaf.solids); leaf.solids.forEach(g => g.dispose());
  leaf.finish('alpha'); leaf.root.name = 'OrleansIndependentSideDrawbridge'; leaf.root.position.fromArray(landing);
  art.root.add(leaf.root);
  const leafWorld = leafGeometry.clone().translate(...landing).applyMatrix4(matrix); leafGeometry.dispose();
  const leafCollider: Collider = { name: 'COL_OrleansIndependentSideDrawbridge', bvh: new MeshBVH(leafWorld), enabled: false };
  const blockerGeo = new THREE.BoxGeometry(.35, 2.2, 4.7).translate(landing[0] + .3, bridgeY + 1.1, 14).applyMatrix4(matrix);
  const blocker: Collider = { name: 'COL_OrleansSideBridgeThreshold', bvh: new MeshBVH(blockerGeo), enabled: true };
  art.relocate(matrix);
  const geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose());
  const fixed: Collider = { name: 'COL_OrleansSouthBankSiege', bvh: new MeshBVH(geometry), enabled: true };
  art.finish('alpha'); art.root.name = 'OrleansSouthBankSiege';
  let opened = false, angle = -1.28, initial = true;
  return {
    root: art.root, colliders: [fixed, leafCollider, blocker],
    apply(done: ReadonlySet<string>) {
      opened = done.has(climaxCheckpoint('orleans', 1)) || done.has(climaxCleared('orleans'));
      if (initial) { angle = opened ? 0 : -1.28; initial = false; }
      leaf.root.rotation.z = angle;
      leafCollider.enabled = opened && Math.abs(angle) < .015; blocker.enabled = !leafCollider.enabled;
    },
    update(dt: number, player: THREE.Vector3) {
      const center = world([0, FORT.deck, 0]);
      art.root.visible = player.distanceToSquared(center) < 500 ** 2;
      angle = THREE.MathUtils.damp(angle, opened ? 0 : -1.28, 2.8, Math.max(0, Math.min(.1, dt)));
      leaf.root.rotation.z = angle;
      leafCollider.enabled = opened && Math.abs(angle) < .015; blocker.enabled = !leafCollider.enabled;
    },
    dispose() {
      for (const collider of [fixed, leafCollider, blocker]) { collider.enabled = false; collider.bvh.geometry.dispose(); }
      for (const kit of [art, leaf]) { for (const mesh of kit.layers.values()) mesh.geometry.dispose(); for (const material of Object.values(kit.materials)) material.dispose(); }
      art.root.removeFromParent();
    },
  };
}
