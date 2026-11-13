import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { VALLEY_TRANSPORT_ROUTES } from '../map/valleyTransportPlan';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

/** Freight wharf, low towpath and the old civil road network. These remain
 * useful walking routes when the observation system and its signs go offline. */
export function createValleyTransportLandscape(terrain: (x: number, z: number) => number | null) {
  const art = new SiteArt(), wood = '#806d53', stone = '#9a9986', metal = '#53616a', brass = '#b89b67';
  const floor = (x: number, z: number) => terrain(x, z) ?? 5;
  const at = (x: number, z: number, lift = .12): Point => [x, floor(x, z) + lift, z];
  const routes = VALLEY_TRANSPORT_ROUTES.map(route => {
    const points: Point[] = [];
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i], steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
      for (let n = i === 1 ? 0 : 1; n <= steps; n++) {
        points.push(at(THREE.MathUtils.lerp(a[0], b[0], n / steps), THREE.MathUtils.lerp(a[1], b[1], n / steps)));
      }
    }
    // The road follows the hillside rather than putting a high uniform slab
    // through it. The existing terrain owns walking collision on these trails.
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[2] - a[2], run = Math.hypot(dx, dz);
      const corners = [[a[0] - dz / run * 1.8, a[2] + dx / run * 1.8], [a[0] + dz / run * 1.8, a[2] - dx / run * 1.8],
        [b[0] + dz / run * 1.8, b[2] - dx / run * 1.8], [b[0] - dz / run * 1.8, b[2] + dx / run * 1.8]];
      const vertices = [0, 2, 1, 0, 3, 2].flatMap(n => [corners[n][0], floor(...corners[n] as [number, number]) + .045, corners[n][1]]);
      const surface = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      art.add(surface, '#a3a18a', [0, 0, 0], [1, 1, 1], false, 'ground'); surface.dispose();
      if (i % 8 === 0) for (const side of [-1, 1]) {
        const x = b[0] + side * dz / run * 2.1, z = b[2] - side * dx / run * 2.1;
        art.box([x, floor(x, z) + .13, z], [.45, .26, .7], stone, false, 'body', [0, Math.atan2(dx, dz), 0]);
      }
    }
    return { region: 'alpha' as const, points, length: points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[2] - points[i][2]), 0) };
  });
  // Small freight store with two 4 m opposing doors; cargo stays to the sides.
  const y = Math.max(...[141, 158].flatMap(x => [-25, -12].map(z => floor(x, z)))) + .16;
  const base = Math.min(...[141, 158].flatMap(x => [-25, -12].map(z => floor(x, z)))) - .25;
  art.box([150, (y + base) / 2, -19], [18, y - base, 14], stone, true);
  for (const z of [-25, -13]) {
    art.box([150, y + 1.9, z], [16, 3.8, .25], wood, true);
    for (const x of [143, 150, 157]) art.box([x, y + 2.3, z], [.21, 4.6, .32], metal, true);
  }
  for (const x of [142, 158]) {
    for (const z of [-23.1, -14.9]) art.box([x, y + 1.9, z], [.3, 3.8, 4.2], wood, true);
    art.box([x, y + 4, -19], [.35, .5, 12.3], metal, true);
  }
  for (const side of [-1, 1]) art.box([150, y + 4.95, -19 + side * 3.1], [18, .23, 6.65], '#677779', true, 'body', [side * -.15, 0, 0]);
  for (const x of [144, 147, 153, 156]) {
    art.box([x, y + .6, -23.4], [2.1, 1.2, 1.6], wood, true);
    for (const dx of [-.7, .7]) art.box([x + dx, y + .62, -23.4], [.08, 1.26, 1.66], brass);
  }
  art.box([154, y + .85, -14.5], [4.4, .18, 1], wood, true);
  art.paper(154, y + .96, -14.5, 1.7, .75);
  for (const x of [142.5, 157.5]) art.lantern(x, y + 2.7, -16.4);
  landscapeWalkway(art, [[141, y, -19], at(133, -17)], { width: 4, floor: stone, edge: metal, steps: true });
  landscapeWalkway(art, [[159, y, -19], [162, y, -19], at(162, -7), at(156, -4)], { width: 4, floor: stone, edge: metal, steps: true });
  // Low quay sits over the river, below the bank. Two long approaches
  // climb the actual 5–9 m bank; no slab is buried inside that bank.
  const dockY = 2.25;
  const dock = (x: number, y: number, z: number): Point => [128 + x, dockY + y, -48 + z];
  art.box(dock(0, -.18, 0), [16, .36, 7], wood, true);
  landscapeWalkway(art, [at(101, -23), [114, dockY, -43], [128, dockY, -44], [128, dockY, -51]],
    { width: 3.8, floor: wood, edge: metal, rails: true, steps: true, supports: (x, z) => floor(x, z),
      railOpenings: [{ p: [128, dockY, -46], radius: 4.2 }] });
  landscapeWalkway(art, [[120, dockY, -48], [105, dockY, -44], at(94, -20), at(101, -23)],
    { width: 3, floor: wood, edge: metal, rails: true, steps: true, supports: (x, z) => floor(x, z) });
  for (const x of [-7, 7]) {
    art.box(dock(x, 2, 0), [.3, 4, .3], metal, true);
    art.beam(dock(x, 3.9, 0), dock(x, 4.8, -5), .26, metal);
    art.beam(dock(x, 1, 0), dock(x, 4.8, -5), .15, brass);
    art.beam(dock(x, 4.8, -5), dock(x, .6, -5), .04, metal);
    art.ring(dock(x, .85, -.25), .48, .06, brass);
  }
  // The short narrow-gauge track ends at a buffered transfer cart, not in water.
  for (const x of [-1.6, -.4]) art.beam(dock(x, .08, -2), dock(x, .08, 3), .08, metal);
  for (let z = -1.6; z < 3; z += .65) art.box(dock(-1, .02, z), [2, .11, .15], wood);
  art.box(dock(-1, .38, 1.4), [1.7, .18, 2.3], wood, true);
  for (const x of [-1.64, -.36]) for (const z of [.6, 2.2]) art.cyl(dock(x, .24, z), .22, .14, metal, false, 'metal', [0, 0, Math.PI / 2]);
  art.box(dock(-1, .84, 1.4), [1.2, .75, 1.5], '#a4936b', true);
  for (const x of [-6, 6]) for (const z of [-2.5, 2.5]) {
    art.cyl(dock(x, .35, z), .18, .7, brass, true);
    art.ring(dock(x, .3, z), .3, .045, wood);
  }
  // Roadside evidence is visible in the landscape: a metal authority arrow
  // covered by a hand-painted timber arrow, plus lamps facing the old road.
  for (const [x, z, yaw] of [[145, 67, .3], [88, 176, -.2], [75, 260, -.4], [-210, 56, 1.1], [-118, -231, -.6]]) {
    const fy = floor(x, z);
    art.box([x, fy + 1.5, z], [.18, 3, .18], metal, true);
    art.box([x, fy + 2.4, z], [2.8, .6, .12], '#a1b3ad', true, 'body', [0, yaw, 0]);
    art.box([x, fy + 2.28, z + .11], [2.3, .36, .1], wood, false, 'body', [0, yaw, -.07]);
    art.beam([x + .55, fy + 2.28, z + .2], [x + .2, fy + 2.39, z + .2], .035, '#ead9b4');
    art.beam([x + .55, fy + 2.28, z + .2], [x + .2, fy + 2.17, z + .2], .035, '#ead9b4');
    art.lantern(x, fy + 3.2, z);
  }
  // Low forest-wall fragments leave gaps wider than a person at each interval.
  for (const [x, z] of [[143, 83], [138, 97], [120, 125], [95, 159]]) {
    const fy = floor(x, z);
    art.box([x, fy + .38, z], [.7, .76, 5.4], stone, true, 'body', [0, .45, 0]);
    art.box([x, fy + .81, z], [.84, .12, 5.5], '#b3b09b', false, 'body', [0, .45, 0]);
  }
  const markers: Marker[] = [
    { id: 'valley_east_freight_wharf', type: 'poi', label: '东渡口 · 装卸场', p: [128, dockY, -48] },
    { id: 'valley_old_south_road', type: 'poi', label: '南旧道 · 手绘方向牌', p: at(75, 260) },
  ];
  const geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose());
  const collider: Collider = { name: 'COL_ValleyFreightWharfAndOldRoad', bvh: new MeshBVH(geometry), enabled: true };
  art.finish('alpha'); art.root.name = 'ValleyFreightWharfAndOldRoad';
  return { root: art.root, collider, markers, routes,
    update(player: THREE.Vector3) { art.root.visible = Math.abs(player.x) < 520 && Math.abs(player.z) < 520 && player.y < 125; },
    dispose() {
      collider.enabled = false; geometry.dispose(); for (const mesh of art.layers.values()) mesh.geometry.dispose();
      for (const material of Object.values(art.materials)) material.dispose(); art.root.removeFromParent();
    },
  };
}
