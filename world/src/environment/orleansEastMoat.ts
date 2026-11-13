import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { ORLEANS_OFFSET } from '../map/orleansOutskirts';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';
import { JOURNEY } from '../story/worldJourney';

export const ORLEANS_MOAT_BRACE = 'map_orleans_moat_braced';

/** A physical eastern ditch has a direct log crossing and a permanently open
 * earth flank. The gully is cut into the generated terrain, not painted on it. */
export function createOrleansEastMoat(ground: (x: number, z: number, ceiling: number) => number | null) {
  const root = new THREE.Group(); root.name = 'OrleansSaintLoupApproach';
  const arts: SiteArt[] = [], colliders: Collider[] = [];
  const frame = new THREE.Matrix4().makeTranslation(...[ORLEANS_OFFSET[0], 0, ORLEANS_OFFSET[1]] as Point);
  const wood = '#816344', dark = '#4b443a', earth = '#9b8a69', rope = '#b9a37c';
  const h = (x: number, z: number) => ground(x + ORLEANS_OFFSET[0], z + ORLEANS_OFFSET[1], 50) ?? 15;
  const at = (x: number, z: number): Point => [x, h(x, z) + .13, z];
  function finish(a: SiteArt, name: string) {
    a.relocate(frame); a.finish('britain'); a.root.name = name; root.add(a.root); arts.push(a);
    if (!a.solids.length) return null;
    const geo = mergeParts(a.solids); a.solids.forEach(g => g.dispose()); a.solids.length = 0;
    if (!geo.getAttribute('position')?.count) { geo.dispose(); return null; }
    const c: Collider = { name, bvh: new MeshBVH(geo), enabled: true }; colliders.push(c); return c;
  }
  const land = new SiteArt();
  function road(points: Point[], width: number) {
    const sampled: Point[] = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], len = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.ceil(len / 1.7);
      const nx = (b[2] - a[2]) / len, nz = -(b[0] - a[0]) / len;
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const x = a[0] + (b[0] - a[0]) * k / n, z = a[2] + (b[2] - a[2]) * k / n;
        sampled.push([x, Math.max(h(x, z), h(x + nx * width / 2, z + nz * width / 2), h(x - nx * width / 2, z - nz * width / 2)) + .13, z]);
      }
    }
    landscapeWalkway(land, sampled, { width, floor: earth, edge: wood, continuousCorners: true }); return sampled;
  }
  const flank = road([at(292, 76), at(269, 70), at(266, 46), at(269, 26), at(292, 24)], 4);
  const south = at(292, 62), north = at(292, 30);
  const approach = road([at(292, 76), south], 4.2);
  const exit = road([north, at(292, 22), at(292, 18)], 4.2);
  for (const [x, z] of [[283, 64], [302, 64], [281, 30], [302, 30]]) {
    const y = h(x, z);
    land.box([x, y + .57, z], [3.1, 1.14, 1.4], earth, true);
    for (const dx of [-1.25, -.6, 0, .6, 1.25]) land.box([x + dx, y + .65, z + .7], [.14, 1.3, .15], wood, true);
    land.beam([x - 1.5, y + 1, z + .8], [x + 1.5, y + 1, z + .8], .09, rope);
  }
  // Splintered roots, bark and cut branches make the crossing a fallen tree,
  // while a 2.6 m nailed tread gives the capsule a reliable walking surface.
  const tree = new SiteArt();
  const a = new THREE.Vector3(...south), b = new THREE.Vector3(...north), delta = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q), middle = a.clone().lerp(b, .5); middle.y -= .7;
  const trunk = new THREE.CylinderGeometry(.67, .93, delta.length(), 11);
  tree.add(trunk, wood, middle.toArray(), [1, 1, 1], false, 'body', [e.x, e.y, e.z]); trunk.dispose();
  landscapeWalkway(tree, [south, north], { width: 2.6, floor: wood, edge: rope, rails: true });
  for (let k = 0; k < 25; k++) { const p = a.clone().lerp(b, k / 24); tree.box([p.x, p.y + .018, p.z], [2.5, .035, .085], dark); }
  for (const p of [south, north]) for (const side of [-1, 1]) {
    tree.beam([p[0] + side * .6, p[1] - .8, p[2]], [p[0] + side * 2.1, p[1] - 1.2, p[2] + side * 1.7], .22, dark);
    land.box([p[0] + side * 1.65, p[1] + .6, p[2]], [.16, 1.2, .16], wood, true);
  }
  const treeCollider = finish(tree, 'COL_OrleansBracedMoatTree')!;
  const safety = new SiteArt();
  for (const p of [south, north]) safety.box([p[0], p[1] + .65, p[2]], [2.8, 1.3, .16], '#aa8053', true);
  const safetyCollider = finish(safety, 'COL_OrleansMoatSafetyRails')!;
  const stand = at(295.3, 64);
  land.box([stand[0], stand[1] + .5, stand[2] - .9], [.8, 1, .8], wood, true);
  land.ring([stand[0], stand[1] + 1.2, stand[2] - .9], .35, .06, '#8c8d79');
  finish(land, 'COL_OrleansMoatFlanks');
  const stall = new SiteArt();
  const sy = h(273, 67);
  for (const x of [271.5, 274.5]) stall.box([x, sy + 1.5, 67], [.15, 3, .15], wood);
  stall.box([273, sy + 3, 67], [3.6, .12, 2.6], '#8d9c91');
  stall.box([273, sy + .83, 67], [3, .16, 1.3], wood);
  for (let n = 0; n < 5; n++) stall.cyl([272 + n * .45, sy + 1.06, 67], .17, .3, '#bd8d61');
  finish(stall, 'OrleansReturnTrader');
  const markers: Marker[] = [
    { id: ORLEANS_MOAT_BRACE, type: 'interact', label: '城东外壕 · 固定倒树两端的承重索', radius: 2.3, p: new THREE.Vector3(...stand).add(new THREE.Vector3(0, 1, 0)).applyMatrix4(frame).toArray() },
    { id: 'disc_orleans_saint_loup', type: 'discovery', label: '圣卢方向 · 外壕与侧坡', radius: 5, p: new THREE.Vector3(...approach[0]).applyMatrix4(frame).toArray(), note: '正面倒树跨过壕沟，西侧土坡绕至同一营门。' },
  ];
  let progress = 0, seeded = false;
  return { root, colliders, markers, routes: { flank, approach, exit, crossing: [south, north] },
    apply(done: ReadonlySet<string>, dt = 0) {
      const ready = done.has(ORLEANS_MOAT_BRACE);
      if (!seeded || !ready) progress = Number(ready); else progress = Math.min(1, progress + Math.min(dt, .05) / 2);
      seeded = true;
      tree.root.position.y = (1 - progress) * -1.2;
      treeCollider.enabled = ready && progress === 1;
      safety.root.visible = safetyCollider.enabled = !treeCollider.enabled;
      stall.root.visible = done.has(JOURNEY.orleansBattery);
    },
    update(p: THREE.Vector3) { root.visible = Math.hypot(p.x + 428, p.z + 1394) < 320 && p.y < 110; },
    dispose() { colliders.forEach(c => { c.enabled = false; c.bvh.geometry.dispose(); }); for (const a of arts) { a.layers.forEach(m => m.geometry.dispose()); Object.values(a.materials).forEach(m => m.dispose()); } root.removeFromParent(); },
  };
}
