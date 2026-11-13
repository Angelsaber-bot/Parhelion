import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { VALLEY_FOUNDATION_ROUTE, VALLEY_FOUNDATION_RETURN, type FoundationPoint as Point } from '../map/valleyFoundationPlan';
import { landscapeWalkway } from './landscapeWalkway';

type Ground = (x: number, z: number, ceiling: number) => number | null;
const stone = '#8b9186', pale = '#b7b69e', dark = '#485962', bronze = '#ac9267', timber = '#816c50';

/** Cut-stone quarry, a dry cable gallery below Mirror Lake, and a separate
 * tower-side exit. All three are connected by ordinary collision-backed floors. */
export function createValleyFoundationLandscape(ground: Ground) {
  const art = new SiteArt();
  const floor = (x: number, z: number) => ground(x, z, 35) ?? 8;
  const slab = (x: number, y: number, z: number, w: number, d: number, color = stone) => {
    art.box([x, y - .2, z], [w, .4, d], color, true);
  };
  function wall(a: Point, b: Point, height: number, thickness: number, color: string) {
    const run = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const nx = (b[2] - a[2]) / run * thickness / 2, nz = -(b[0] - a[0]) / run * thickness / 2;
    const corners = [[a[0] - nx, a[1], a[2] - nz], [a[0] + nx, a[1], a[2] + nz],
      [b[0] + nx, b[1], b[2] + nz], [b[0] - nx, b[1], b[2] - nz]];
    const vertices = [...corners, ...corners.map(p => [p[0], p[1] + height, p[2]])];
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
    g.setIndex([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
      1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
    g.computeVertexNormals(); art.add(g, color, [0, 0, 0], [1, 1, 1], true); g.dispose();
  }
  function gallery(route: readonly Point[]) {
    const offset = route.map((p, i): Point => {
      const before = route[Math.max(0, i - 1)], after = route[Math.min(route.length - 1, i + 1)];
      const a = new THREE.Vector2(i === 0 ? after[0] - p[0] : p[0] - before[0], i === 0 ? after[2] - p[2] : p[2] - before[2]).normalize();
      const b = new THREE.Vector2(i === route.length - 1 ? a.x : after[0] - p[0], i === route.length - 1 ? a.y : after[2] - p[2]).normalize();
      const normal = new THREE.Vector2(a.y + b.y, -a.x - b.x).normalize();
      const scale = 3.08 / Math.max(.3, normal.dot(new THREE.Vector2(a.y, -a.x)));
      return [normal.x * scale, 0, normal.y * scale];
    });
    landscapeWalkway(art, route, { width: 6.2, floor: stone, edge: bronze, steps: true });
    for (let i = 1; i < route.length - 1; i++) {
      slab(route[i][0], route[i][1], route[i][2], 6.3, 6.3);
      slab(route[i][0], route[i][1] + 4, route[i][2], 6.8, 6.8, dark);
    }
    for (const side of [-1, 1]) for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i];
      wall([a[0] + offset[i - 1][0] * side, a[1] - .2, a[2] + offset[i - 1][2] * side],
        [b[0] + offset[i][0] * side, b[1] - .2, b[2] + offset[i][2] * side], 4.1, .35, stone);
    }
    landscapeWalkway(art, route.map(p => [p[0], p[1] + 4, p[2]] as Point), { width: 6.8, floor: dark, edge: dark });
    for (let i = 1; i < route.length; i++) {
      const a = new THREE.Vector3(...route[i - 1]), b = new THREE.Vector3(...route[i]);
      const d = b.clone().sub(a), run = Math.hypot(d.x, d.z), nx = d.z / run, nz = -d.x / run;
      for (let distance = 5; distance < run - 2; distance += 8) {
        const p = a.clone().lerp(b, distance / run);
        for (const side of [-1, 1]) {
          art.box([p.x + nx * side * 2.85, p.y + 1.85, p.z + nz * side * 2.85], [.22, 3.7, .22], dark, true);
          art.lantern(p.x + nx * side * 2.7, p.y + 2.4, p.z + nz * side * 2.7);
        }
        art.beam([p.x - nx * 3, p.y + 3.6, p.z - nz * 3], [p.x + nx * 3, p.y + 3.6, p.z + nz * 3], .2, bronze);
      }
      for (const height of [.65, 1, 2.9]) art.beam([a.x + nx * 2.72, a.y + height, a.z + nz * 2.72],
        [b.x + nx * 2.72, b.y + height, b.z + nz * 2.72], .095, height === 2.9 ? bronze : dark);
    }
  }
  // The floor sits above the regional water level, with real cut retaining walls.
  slab(-180, 2.4, 30, 40, 36);
  for (const [a, b] of [[[-200, 2.4, 12], [-200, 2.4, 48]], [[-200, 2.4, 12], [-160, 2.4, 12]],
    [[-160, 2.4, 12], [-160, 2.4, 26.7]], [[-160, 2.4, 33.3], [-160, 2.4, 48]]] as [Point, Point][]) wall(a, b, 7.1, .6, stone);
  for (const [x, w] of [[-192, 16], [-167, 14]]) art.box([x, 5.95, 48], [w, 7.1, .6], stone, true);
  // Exposed quarry benches follow the retaining faces. Unequal cuts, drill
  // seams and weathered coping distinguish the excavation from a walled yard.
  for (let i = 0; i < 8; i++) {
    const z = 14.5 + i * 4.2, height = 2.6 + (i % 3) * .9;
    art.box([-198.5, 2.4 + height / 2, z], [2.5 + (i % 2), height, 3.9], i % 2 ? pale : stone, true);
    for (let n = 0; n < 4; n++) art.box([-196.7, 3 + n * .68, z], [.04, .04, 3.65], dark);
    art.box([-200, 9.56, z], [1.15, .22, 4.1], pale);
  }
  for (let i = 0; i < 7; i++) {
    const x = -195 + i * 5.1, h = 1.8 + (i % 3) * .8;
    art.box([x, 2.4 + h / 2, 13.3], [4.8, h, 2.4], i % 2 ? stone : pale, true);
    art.box([x, 9.57, 12], [4.9, .24, 1], pale);
  }
  const entry: Point = [-180, floor(-180, 54) + .12, 54];
  landscapeWalkway(art, [entry, [-180, 7.6, 47.7], [-180, 2.4, 24], [-170, 2.4, 24], [-163, 2.4, 30]],
    { width: 4.4, floor: stone, edge: bronze, rails: true, steps: true });
  // Quarry cuts, split blocks, plug-and-feather holes and the old lifting gantry.
  for (let row = 0; row < 1; row++) for (let col = 0; col < 4; col++) {
    const x = -195 + col * 3, z = 16;
    art.box([x, 3 + .25 * (row % 2), z], [2.2, 1.2 + .5 * (row % 2), 3.8], row % 2 ? pale : stone, true);
    for (let n = 0; n < 5; n++) art.box([x - .7 + n * .35, 3.64 + .5 * (row % 2), z], [.07, .04, .23], dark);
  }
  for (const z of [20, 40]) {
    for (const x of [-171, -163]) art.box([x, 6.7, z], [.38, 8.6, .38], timber, true);
    art.beam([-172, 11, z], [-162, 11, z], .45, dark);
  }
  art.beam([-167, 11.1, 19], [-167, 11.1, 41], .3, bronze);
  art.beam([-167, 11, 37], [-167, 4.8, 37], .055, dark);
  art.box([-167, 3.55, 37], [2.4, 2.3, 2.1], pale, true);
  art.box([-166.5, 3.2, 19], [3.5, .18, 1.3], timber, true);
  art.paper(-166.5, 3.31, 19, 1.6, .8);
  for (let i = 0; i < 4; i++) {
    const x = -174 + i * 1.3;
    art.beam([x, 2.5, 42], [x + .6, 3.7, 42.2], .08, dark);
    art.box([x + .6, 3.7, 42.2], [.6, .16, .18], bronze);
  }
  // A broad portal frames the cable gallery, visible from the entry stair.
  for (const z of [26.45, 33.55]) art.box([-160.15, 4.55, z], [1.2, 4.3, .6], pale, true);
  art.box([-160.15, 6.8, 30], [1.3, .5, 7.7], pale, true);
  for (const z of [26.2, 33.8]) art.lantern(-161, 5.4, z);
  gallery(VALLEY_FOUNDATION_ROUTE);
  gallery(VALLEY_FOUNDATION_RETURN.slice(0, -1));
  landscapeWalkway(art, [[44, 4.6, -111.7], [44, floor(44, -120) + .12, -120]],
    { width: 5.8, floor: stone, edge: bronze, steps: true });
  // Tower-side headhouse with a clear 5.8 m doorway and an exposed lintel.
  // Keep the instruments west of this entrance entirely outside its footprint.
  for (const x of [40.65, 47.35]) {
    art.box([x, 6.55, -112], [.7, 4.3, 1.2], pale, true);
    art.lantern(x, 7.3, -112.8);
    art.beam([x, 5.2, -117], [x, 5.65, -113], .13, bronze, true);
    for (const z of [-117, -115, -113]) {
      const bottom = floor(x, z), top = 5.2 + (z + 117) / 4 * .45;
      if (top > bottom) art.box([x, (bottom + top) / 2, z], [.13, top - bottom, .13], bronze, true);
    }
  }
  art.box([44, 8.9, -112], [7.5, .6, 1.6], pale, true);
  art.box([44, 8.94, -112.83], [4.8, .31, .045], dark);
  for (let i = 0; i < 5; i++) art.box([42.4 + i * .8, 8.95, -112.86], [.48, .12, .035], bronze);
  // The old foundations occupy a proper room under the lake, with both exits
  // visible from the central aisle and enough width to circle each instrument base.
  slab(-4, -9, -7, 40, 38);
  slab(-4, -4.5, -7, 41, 39, dark);
  wall([-24, -9, -26], [-24, -9, -9.3], 4.7, .6, stone);
  wall([-24, -9, -2.7], [-24, -9, 12], 4.7, .6, stone);
  wall([16, -9, -26], [16, -9, 12], 4.7, .6, stone);
  wall([-24, -9, 12], [16, -9, 12], 4.7, .6, stone);
  wall([-24, -9, -26], [-3.3, -9, -26], 4.7, .6, stone);
  wall([3.3, -9, -26], [16, -9, -26], 4.7, .6, stone);
  for (const x of [-16, 8]) for (const z of [-18, 3]) {
    art.box([x, -8.65, z], [4.4, .7, 5], pale, true);
    art.cyl([x, -7.75, z], 1.35, 1.1, dark, true);
    art.ring([x, -7.18, z], 1.22, .11, bronze, 'metal', [Math.PI / 2, 0, 0]);
    for (const side of [-1, 1]) art.box([x + side * 1.55, -7.95, z], [.32, 2.1, .6], stone, true);
    for (let n = 0; n < 8; n++) {
      const angle = n * Math.PI / 4;
      art.cyl([x + Math.cos(angle) * 1.08, -7.08, z + Math.sin(angle) * 1.08], .075, .18, pale);
    }
    art.cyl([x, -6.8, z], .5, .7, '#68847d', true);
    art.ring([x, -6.42, z], .56, .06, bronze, 'metal', [Math.PI / 2, 0, 0]);
    art.beam([x, -8.58, z + 2.2], [x < 0 ? -7 : -3, -8.58, z + 2.2], .12, bronze);
  }
  for (const x of [-20, 12]) for (const z of [-22, -8, 8]) {
    art.box([x, -6.8, z], [.55, 4.4, .55], dark, true);
    art.lantern(x, -6.6, z + .4);
  }
  for (const z of [-22, -8, 8]) art.beam([-23, -4.9, z], [15, -4.9, z], .4, bronze);
  for (const x of [-7, -5, -3]) art.beam([x, -8.92, 11], [x, -8.92, -25], .11, '#6a8583');
  art.box([6.5, -8.1, -23.7], [4.6, 1.8, 1.25], dark, true);
  for (let i = 0; i < 7; i++) art.box([4.7 + i * .6, -7.55, -23.03], [.41, .48, .05], i % 2 ? bronze : pale);
  art.box([-10, -8.15, 9.3], [3.8, .18, 1.2], timber, true);
  art.paper(-10, -8.04, 9.3, 1.8, .8);
  const geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose());
  const collider: Collider = { name: 'COL_ValleyQuarryAndLakeFoundation', bvh: new MeshBVH(geometry), enabled: true };
  art.finish('alpha'); art.root.name = 'ValleyQuarryAndLakeFoundation';
  return { root: art.root, collider,
    update(player: THREE.Vector3) { art.root.visible = player.y < 125 && Math.hypot(player.x + 70, player.z) < 430; },
    dispose() {
      collider.enabled = false; geometry.dispose(); for (const mesh of art.layers.values()) mesh.geometry.dispose();
      for (const material of Object.values(art.materials)) material.dispose(); art.root.removeFromParent();
    },
  };
}
