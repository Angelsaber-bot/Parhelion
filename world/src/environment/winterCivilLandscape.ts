import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { WINTER_SCHOOL as S, WINTER_CUSTOMS as C } from '../map/winterCivilPlan';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

/** The school is a quiet, open interior; the tax square has a broad entry,
 * two side loops and two distinct crossing exits. No quest completion is
 * inferred from arriving at these architectural spaces. */
export function createWinterCivilLandscape(ground: (x: number, z: number, ceiling: number) => number | null) {
  const art = new SiteArt(), wood = '#72685e', char = '#484547', plaster = '#c4beb0', snow = '#e1e8ea', iron = '#535b61';
  const floor = (x: number, z: number) => ground(x, z - 720, 20) ?? 8;
  const at = (x: number, z: number): Point => [x, floor(x, z) + .14, z];
  const route = (points: Point[], width = 3.8, rails = false) => landscapeWalkway(art, points,
    { width, floor: wood, edge: iron, steps: true, rails });
  function groundRoute(points: Point[], width: number) {
    const sampled: Point[] = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 2));
      for (let j = i === 1 ? 0 : 1; j <= n; j++) {
        const t = j / n, x = THREE.MathUtils.lerp(a[0], b[0], t), z = THREE.MathUtils.lerp(a[2], b[2], t);
        sampled.push([x, Math.max(THREE.MathUtils.lerp(a[1], b[1], t), floor(x, z) + .14), z]);
      }
    }
    route(sampled, width);
  }
  const y = S.floor;
  // Full ground-level classroom and a burnt adjoining bay share a courtyard.
  art.box([S.x, y - .1, S.z], [S.width, .2, S.depth], '#948c80', true);
  for (let x = 8; x <= 28; x += 1) art.box([x, y + .014, -92], [.96, .028, 12], wood);
  // North/south walls have separate doors; windows use real gaps with lintels.
  for (const z of [-99, -85]) {
    for (const [x, w] of [[10.25, 6.5], [24.25, 9.5]]) art.box([x, y + 2.35, z], [w, 4.7, .6], plaster, true);
    art.box([16.5, y + 3.85, z], [6, 1.7, .6], plaster, true);
    for (const x of [13.2, 19.8]) art.box([x, y + 1.5, z], [.25, 3, .8], char, true);
    art.box([16.5, y + 3.02, z], [6.8, .2, .8], char, true);
  }
  for (const x of [7, 29]) {
    art.box([x, y + .7, -92], [.6, 1.4, 14], plaster, true);
    art.box([x, y + 3.9, -92], [.6, 1.6, 14], plaster, true);
    for (const z of [-98, -94, -90, -86]) art.box([x, y + 2.15, z], [.65, 1.5, 1], char, true);
    // Window sills and broken shutters keep the damaged shell readable.
    for (const z of [-96, -92, -88]) {
      art.box([x, y + 1.45, z], [.9, .16, 3], wood, true);
      art.box([x, y + 2.2, z - 1.25], [.16, 1.4, .5], wood, false, 'body', [0, 0, .16]);
    }
  }
  // The intact west roof shelters the warm corner; the east bay is open sky.
  for (const z of [-98, -94, -90, -86]) {
    art.beam([7, y + 4.6, z], [17.5, y + 6.7, z], .27, char, true);
    art.beam([17.5, y + 6.7, z], [29, y + 4.6, z], .27, char, true);
  }
  art.box([12.2, y + 5.72, -92], [10.8, .26, 15], wood, true, 'body', [0, 0, .197]);
  art.box([12.2, y + 5.92, -92], [10.9, .12, 15.1], snow, false, 'body', [0, 0, .197]);
  for (let z = -99; z < -84; z += .65) art.box([12.2, y + 5.94, z], [10.9, .025, .045], '#a4a7a5', false, 'body', [0, 0, .197]);
  for (const z of [-98.7, -85.3]) art.beam([17.5, y + 6.7, z], [23.4, y + 5.7, z], .38, char, true);
  for (const z of [-99.34, -84.66]) for (const x of [8, 10, 22, 24, 27]) {
    art.box([x, y + .35, z], [1.8, .7, .06], '#8c8277');
    const h = 1.1 + (x % 3) * .55;
    art.box([x + .22, y + 4.7 - h / 2, z], [.23 + (x % 2) * .14, h, .07], '#645c56', false, 'body', [0, 0, .04]);
  }
  // Chalkboard, uneven writing, desks and a stove create an inhabited school.
  art.box([10.7, y + 2.3, -98.63], [4.8, 2.2, .12], wood);
  art.box([10.7, y + 2.3, -98.54], [4.45, 1.9, .05], '#43534e');
  for (let i = 0; i < 5; i++) {
    const x = 9.1 + i * .7;
    art.beam([x, y + 1.95, -98.5], [x + .24, y + 2.65, -98.5], .025, snow);
    art.beam([x + .24, y + 2.65, -98.5], [x + .48, y + 1.95, -98.5], .025, snow);
    art.beam([x + .1, y + 2.2, -98.5], [x + .38, y + 2.2, -98.5], .025, snow);
  }
  for (const z of [-95, -91]) for (const x of [11, 23.7]) {
    art.box([x, y + .83, z], [3.1, .13, 1.2], wood, true);
    for (const dx of [-1.2, 1.2]) art.box([x + dx, y + .4, z], [.14, .8, .8], char, true);
    art.box([x, y + .42, z + 1.3], [3, .16, .5], wood, true);
    art.paper(x, y + .92, z, .7, .45);
  }
  art.box([9, y + .95, -87.3], [1.4, 1.9, 1.3], '#817467', true);
  art.box([9, y + 1.02, -86.62], [.66, .5, .05], '#d39e61', false, 'glow');
  art.cyl([9, y + 3.15, -87.3], .17, 2.5, iron, true);
  art.cyl([9, y + 2.08, -87.3], .4, .36, iron);
  art.ring([9, y + 2.28, -87.3], .36, .045, iron, 'metal', [Math.PI / 2, 0, 0]);
  for (const z of [-83, -80]) {
    art.box([25.3, y + .32, z], [4.6, .5, 1.6], '#aaa58e', true);
    art.box([27, y + .61, z], [.65, .15, 1.2], snow);
  }
  for (const x of [7, 29]) for (const z of [-82, -78]) art.box([x, y + 1.5, z], [.3, 3, .3], char, true);
  art.box([25.2, y + 3.3, -81.5], [7.9, .15, 6.3], '#b3afa0', true, 'body', [0, 0, -.06]);
  art.box([9.5, y + .8, -80], [3.5, .18, 1.2], wood, true);
  for (const x of [8.4, 10.7]) art.box([x, y + .38, -80], [.16, .76, .9], char, true);
  art.lantern(9, y + 2.2, -85.8); art.lantern(25, y + 2.2, -84.6);
  groundRoute([[18, y, -77], [18, y, -73], at(40, -68)], 5);
  groundRoute([[29, y, -81], [34, y, -81], at(40, -88)], 3.6);
  groundRoute([[16.5, y, -99], at(16.5, -109)], 3.7);

  const cy = C.floor, upper = cy + 4.4;
  art.box([C.x, cy - .11, C.z], [C.width, .22, C.depth], '#b8b7b4', true);
  // Two broad lanes remain legible across the square; cover is peripheral.
  for (const z of [231, 259]) art.box([-73, cy + .015, z], [44, .03, 4.4], '#cdd7de');
  for (const x of [-89, -59]) for (const z of [234, 256]) {
    art.box([x, cy + .6, z], [4.8, 1.2, 1.35], '#847e76', true);
    art.box([x, cy + 1.23, z], [4.9, .1, 1.5], snow);
  }
  // Low warehouse forms the west flank: front and rear entrances, plus a
  // second-height gallery with two stairs. The rear lane circles the building.
  art.box([-98, cy - .13, 245], [12, .26, 26], '#8e8982', true);
  for (const x of [-103.7, -92.3]) art.box([x, cy + 2, 245], [.6, 4, 26], '#89867f', true);
  for (const z of [232, 258]) {
    for (const x of [-102, -94]) art.box([x, cy + 2, z], [3.5, 4, .65], wood, true);
    art.box([-98, cy + 3.7, z], [4.6, .6, .65], wood, true);
  }
  art.box([-98, upper - .2, 245], [12.8, .4, 27], wood, true);
  for (const x of [-104.05, -91.95]) {
    for (let z = 233; z < 258; z += .85) art.box([x, cy + 1.9, z], [.07, 3.8, .035], '#595b5a');
    art.box([x, cy + .42, 245], [.08, .5, 26], '#625e58');
    art.box([x, cy + 3.8, 245], [.12, .25, 26], '#aaa394');
  }
  route([[-98, upper, 232], [-98, upper, 258]], 11.6, true);
  route([[-98, upper, 232], [-98, upper, 228], [-82, cy, 228]], 3.2, true);
  route([[-98, upper, 258], [-98, upper, 262], [-82, cy, 262]], 3.2, true);
  for (const x of [-101.5, -94.5]) for (const z of [237, 242, 247, 252]) {
    art.box([x, cy + .7, z], [2.2, 1.4, 2.2], wood, true);
    for (const dz of [-.8, .8]) art.box([x, cy + .71, z + dz], [2.3, 1.46, .07], iron);
  }
  // The opposite ruin has two independent exits to the pontoon crossings.
  for (const z of [226, 239, 251, 264]) {
    art.box([-50, cy + 1.5, z], [2, 3, 3], '#a09b92', true);
    art.box([-50, cy + 3.08, z], [2.3, .16, 3.3], snow);
  }
  for (const z of [228, 262]) {
    groundRoute([[-58, cy, z], [-50, cy, z], at(-45, z)], 5.2);
    for (const x of [-53, -47]) art.box([x, cy + 3.7, z + 3.6], [.55, 7.4, .55], char, true);
    art.beam([-53, cy + 4.5, z + 3.6], [-47, cy + 4.5, z + 3.6], .4, char);
    art.box([-50, cy + 4.12, z + 3.6], [4.5, .62, .12], '#a29a83');
    for (const dx of [-1.6, -1.2, -.8, .5, .9, 1.3]) art.box([-50 + dx, cy + 4.12, z + 3.68], [.11, .33, .04], '#5d615d');
  }
  groundRoute([[-73, cy, 226], at(-73, 215), at(-40, 214)], 7);
  groundRoute([[-96, cy, 226], at(-112, 225), at(-112, 265), [-96, cy, 264]], 4.5);
  // A damaged customs booth leaves the two side exits independently usable.
  art.box([-49, cy + 1.1, 245], [.65, 2.2, 6.5], '#a09b92', true);
  art.box([-51.5, cy + 1.9, 242], [5.4, 3.8, .7], '#a09b92', true);
  art.box([-53.8, cy + 1.2, 246.8], [.6, 2.4, 3], '#a09b92', true);
  art.beam([-54, cy + 3.9, 242], [-48.7, cy + 3.9, 246], .3, char, true);
  art.box([-51.4, cy + .85, 243.2], [3.7, .16, 1.2], wood, true);
  art.paper(-51.4, cy + .96, 243.2, .8, .5);
  // Pedestrians can use the repaired inner strip of the damaged north bridge;
  // its wrecked outer timbers still show why the freight crossing is separate.
  route([[-12, 2.44, 228], [4, 2.44, 228]], 3.1, true);
  // A short service bridge crosses a sheltered carpenter's working lane.
  // Both its deck and its lower floor have full standing clearance.
  route([[-91, cy, 245], [-83, upper, 245], [-65, upper, 245], [-55, cy, 245]], 3.5, true);
  for (const x of [-83, -65]) for (const z of [243.2, 246.8]) {
    art.box([x, cy + 2.1, z], [.35, 4.2, .35], wood, true);
    art.beam([x, cy + 3.1, z], [x + (x === -83 ? 1.4 : -1.4), upper - .3, z], .2, iron);
  }
  art.box([-75, cy + .88, 245], [4.4, .16, 1.25], wood, true);
  for (const x of [-76.7, -73.3]) art.box([x, cy + .42, 245], [.17, .84, .9], char, true);
  for (let i = 0; i < 6; i++) art.box([-70.3, cy + .16 + i * .15, 245], [2.9, .14, .42], wood, true);
  art.ring([-75, cy + .99, 245], .24, .035, iron, 'metal', [Math.PI / 2, 0, 0]);
  art.lantern(-82.7, cy + 2.6, 244.9); art.lantern(-65.3, cy + 2.6, 244.9);
  art.cyl([-80, cy + .45, 245], .48, .9, iron, true);
  art.cyl([-80, cy + .93, 245], .37, .08, '#cf9957', false, 'glow');
  const frame = new THREE.Matrix4().makeTranslation(0, 0, -720); art.relocate(frame);
  const geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose());
  const collider: Collider = { name: 'COL_WinterSchoolAndCustoms', bvh: new MeshBVH(geometry), enabled: true };
  art.finish('winter'); art.root.name = 'WinterSchoolAndCustoms';
  const markers: Marker[] = [
    { id: 'warm_winter_school', type: 'poi', label: '烧毁学校 · 暖房与小教室', p: [11, y + .9, -810], radius: 9 },
    { id: 'winter_customs_square', type: 'poi', label: '旧税关 · 双渡口广场', p: [-73, cy + .9, -490] },
    { id: 'winter_underbridge_workbench', type: 'poi', label: '桥下木工台', p: [-75, cy + .9, -472.5] },
    { id: 'warm_winter_workbench', type: 'poi', label: '木工台火盆', p: [-80, cy + .9, -475], radius: 6 },
  ];
  return { root: art.root, collider, markers,
    update(player: THREE.Vector3) { art.root.visible = Math.hypot(player.x, player.z + 640) < 500; },
    dispose() {
      collider.enabled = false; geometry.dispose(); for (const mesh of art.layers.values()) mesh.geometry.dispose();
      for (const material of Object.values(art.materials)) material.dispose(); art.root.removeFromParent();
    },
  };
}
