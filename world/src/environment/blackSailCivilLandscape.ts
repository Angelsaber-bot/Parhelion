import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { BLACKSAIL_CIVIL_SITES as S, BLACKSAIL_CIVIL_PATHS } from '../map/blackSailCivilPlan';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

/** Public harbor → old customs → two inland approaches. Architecture does not
 * grant a heist outcome or alter the existing ship/relief-boat progress. */
export function createBlackSailCivilLandscape(ground: (x: number, z: number, ceiling: number) => number | null) {
  const art = new SiteArt(), timber = '#79513a', dark = '#47382e', stone = '#c0b59e', plaster = '#e3d4b2', iron = '#4d5458';
  const height = (x: number, z: number) => ground(x + 720, z - 720, 27) ?? 12;
  const route = (points: Point[], width = 3.6, rails = false) => landscapeWalkway(art, points,
    { width, floor: timber, edge: dark, steps: true, rails, supports: height });
  function followGround(points: readonly (readonly [number, number])[], width: number) {
    const sampled: Point[] = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.ceil(length / 2), nx = (b[1] - a[1]) / length * width / 2, nz = -(b[0] - a[0]) / length * width / 2;
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const x = THREE.MathUtils.lerp(a[0], b[0], k / n), z = THREE.MathUtils.lerp(a[1], b[1], k / n);
        // Sample the full tread, so the uphill edge cannot disappear into the hillside.
        sampled.push([x, Math.max(height(x, z), height(x + nx, z + nz), height(x - nx, z - nz)) + .2, z]);
      }
    }
    route(sampled, width);
  }
  function roof(x: number, y: number, z: number, width: number, depth: number, rise: number, color: string) {
    const half = width / 2, angle = Math.atan2(rise, half), span = Math.hypot(half, rise);
    for (const s of [-1, 1]) art.box([x + s * half / 2, y + rise / 2, z], [span + .5, .2, depth + 1.2], color, true, 'body', [0, 0, -s * angle]);
    const shape = new THREE.Shape(); shape.moveTo(-half + .5, 0); shape.lineTo(half - .5, 0); shape.lineTo(0, rise - .12); shape.closePath();
    const gable = new THREE.ExtrudeGeometry(shape, { depth: .3, bevelEnabled: false });
    for (const side of [-1, 1]) {
      const zz = z + side * depth / 2;
      art.add(gable, plaster, [x, y, zz - .15], [1, 1, 1], true);
      art.box([x, y + .08, zz + side * .2], [width - .7, .23, .15], dark);
      for (const dx of [-.55, 0, .55]) art.box([x + dx, y + rise * .4, zz + side * .2], [.32, rise * .28, .04], dark);
    }
    gable.dispose();
    // Roof seams follow the pitch; the closed gables keep the store weather-tight.
    for (let zz = z - depth / 2; zz <= z + depth / 2; zz += 1.1) for (const s of [-1, 1])
      art.beam([x + s * (half + .16), y + .08, zz], [x, y + rise + .12, zz], .055, '#735143');
    art.beam([x, y + rise, z - depth / 2 - .5], [x, y + rise, z + depth / 2 + .5], .28, dark);
    for (const zz of [z - depth / 2, z, z + depth / 2]) for (const s of [-1, 1])
      art.beam([x + s * half, y, zz], [x, y + rise, zz], .25, dark, true);
  }
  function crate(x: number, y: number, z: number, size = 1.4) {
    art.box([x, y + size / 2, z], [size, size, size], timber, true);
    for (const dy of [.18, size - .18]) art.box([x, y + dy, z], [size + .05, .11, size + .05], dark);
    for (const s of [-1, 1]) art.beam([x - size * .4, y + .15, z + s * (size / 2 + .03)], [x + size * .4, y + size - .15, z + s * (size / 2 + .03)], .1, dark);
  }

  const salt = S.salt, y = salt.floor;
  art.box([salt.x, y - .1, salt.z], [salt.width, .2, salt.depth], stone, true);
  // Three large working doorways: north approach, southern side route, east cable yard.
  for (const z of [56, 74]) {
    for (const x of [-86.1, -73.9]) art.box([x, y + 2.4, z], [7.8, 4.8, .6], plaster, true);
    art.box([-80, y + 4.05, z], [4.4, 1.5, .6], plaster, true);
    for (const x of [-82.3, -77.7]) art.box([x, y + 1.7, z], [.25, 3.4, .8], dark, true);
  }
  art.box([-90, y + 2.4, 65], [.6, 4.8, 18], plaster, true);
  for (const z of [59.5, 70.5]) art.box([-70, y + 2.4, z], [.6, 4.8, 7], plaster, true);
  art.box([-70, y + 4.05, 65], [.6, 1.5, 4], plaster, true);
  for (const x of [-89.7, -83, -77, -70.3]) for (const z of [55.65, 74.35]) {
    art.box([x, y + 2.4, z], [.22, 4.8, .16], timber);
    art.box([x, y + .4, z], [.5, .8, .22], stone);
  }
  for (const z of [55.65, 74.35]) art.box([-80, y + 4.65, z], [20, .24, .18], dark);
  roof(-80, y + 4.8, 65, 21, 18, 2.7, '#a05b42');
  for (let z = 57; z < 74; z += 1.1) for (const x of [-90.32, -69.68])
    art.box([x, y + .5, z], [.05, .45, .9], '#b09f85');
  // Salt sacks on ventilated pallets; a central 5 m aisle is kept open.
  for (const z of [59, 63, 68, 71]) {
    art.box([-86.1, y + .15, z], [4.3, .3, 2.8], dark, true);
    for (const x of [-87.3, -85.8, -84.5]) {
      art.cyl([x, y + .78, z], .58, 1.05, '#d7ccb0', true);
      art.cyl([x, y + 1.34, z], .18, .14, '#ad9d7b');
    }
  }
  art.box([-74, y + .9, 59.8], [3.5, .16, 1.5], timber, true);
  for (const x of [-75.4, -72.6]) art.box([x, y + .42, 59.8], [.18, .84, 1.2], dark, true);
  art.paper(-74, y + 1, 59.8, 1.1, .7);
  art.cyl([-73, y + 1.15, 59.9], .15, .3, iron);
  for (const z of [56.4, 73.6]) art.lantern(-77.2, y + 2.8, z, iron);

  const yard = S.customs, cy = yard.floor;
  art.box([yard.x, cy - .1, yard.z], [yard.width, .2, yard.depth], '#b7ab91', true);
  // Formal south inspection lane and independent western service gate.
  for (const x of [-64, -56]) {
    art.box([x, cy + 2.4, 124], [2.1, 4.8, 2.1], stone, true);
    art.box([x, cy + 4.9, 124], [2.5, .3, 2.5], plaster, true);
  }
  art.box([-60, cy + 4.3, 124], [8, .7, 1.9], stone, true);
  for (const [x, w] of [[-70, 8], [-50, 8]]) {
    art.box([x, cy + .6, 124], [w, 1.2, .6], stone, true);
    for (let dx = -w / 2 + .4; dx < w / 2; dx += .8) art.box([x + dx, cy + 1.65, 124], [.08, 1.5, .1], iron, true);
  }
  for (const z of [105, 119]) art.box([-75, cy + 1.1, z], [.6, 2.2, 10], stone, true);
  for (const z of [109.7, 114.3]) art.box([-75, cy + 1.6, z], [.85, 3.2, .85], stone, true);
  // A walk-in customs booth faces the open yard; paperwork and scales sit inside.
  art.box([-49.5, cy + 2, 112], [.5, 4, 12], plaster, true);
  for (const z of [106, 118]) art.box([-53, cy + 2, z], [7.5, 4, .5], plaster, true);
  for (const z of [107.7, 116.3]) art.box([-56.7, cy + 2, z], [.4, 4, 3.4], dark, true);
  art.box([-56.7, cy + 3.55, 112], [.4, .9, 5.2], dark, true);
  roof(-53, cy + 4, 112, 8, 12, 1.7, '#547f7b');
  art.box([-51.2, cy + .85, 111.5], [1.35, .2, 5.1], timber, true);
  for (const z of [109.6, 113.4]) art.box([-51.2, cy + .38, z], [.9, .76, .18], dark, true);
  art.paper(-51.2, cy + .98, 112, .8, .6);
  art.beam([-51.2, cy + 1, 110], [-51.2, cy + 1.8, 110], .07, iron);
  art.beam([-51.2, cy + 1.8, 109.5], [-51.2, cy + 1.8, 110.5], .055, iron);
  for (const z of [109.5, 110.5]) {
    art.beam([-51.2, cy + 1.8, z], [-51.2, cy + 1.35, z], .025, iron);
    art.cyl([-51.2, cy + 1.34, z], .19, .04, '#b49a69');
  }
  crate(-69, cy, 105, 1.8); crate(-71.3, cy, 105, 1.5); crate(-69, cy, 119, 1.6);
  art.box([-63, cy + .06, 116], [7, .12, 2.8], '#d1c3a1');
  for (const x of [-64.8, -61.2]) art.box([x, cy + .07, 116], [.12, .03, 2.6], '#8b6a4d');
  art.lantern(-56, cy + 3.2, 122.8, iron);

  // Abandoned freight ropeway: readable cable, suspended carrier and maintenance route.
  const cable = S.cable, uy = cable.floor;
  art.box([cable.x, uy - .1, cable.z], [cable.width, .2, cable.depth], stone, true);
  for (const [x, yy, z] of [[-44, uy, 68], [-59, cy, 101]] as const) {
    for (const side of [-1, 1]) {
      art.box([x + side * 2.4, yy + 2.7, z], [.35, 5.4, .35], dark, true);
      art.beam([x + side * 2.4, yy + 4.7, z], [x + side * 3.4, yy, z + 2.8], .2, timber, true);
    }
    art.box([x, yy + 5.4, z], [5.7, .35, .35], dark, true);
    art.ring([x, yy + 4.9, z], .65, .08, iron, 'metal', [Math.PI / 2, 0, 0]);
  }
  const start = new THREE.Vector3(-44, uy + 4.8, 68), end = new THREE.Vector3(-59, cy + 4.8, 101);
  const cablePoint = (t: number) => start.clone().lerp(end, t).add(new THREE.Vector3(0, -.8 * Math.sin(t * Math.PI), 0));
  for (let i = 0; i < 18; i++) art.beam(cablePoint(i / 18).toArray(), cablePoint((i + 1) / 18).toArray(), .055, iron);
  const carrier = cablePoint(.43);
  for (const side of [-1, 1]) art.beam([carrier.x + side * .9, carrier.y - 1.65, carrier.z], [carrier.x, carrier.y, carrier.z], .08, iron);
  art.box([carrier.x, carrier.y - 1.75, carrier.z], [2.8, .2, 2], timber);
  for (const side of [-1, 1]) art.box([carrier.x + side * 1.3, carrier.y - 1.3, carrier.z], [.13, .8, 2], dark);
  art.cyl([-44, uy + .7, 63], .7, 1.2, dark, true, 'body', [Math.PI / 2, 0, 0]);
  for (const x of [-45, -43]) art.box([x, uy + .6, 63], [.18, 1.2, 1.5], timber, true);
  art.ring([-44, uy + .7, 62.3], .72, .08, iron);
  // Walkable lookout deck faces the lighthouse and the flagship, reached from both ends.
  route([[-38, uy, 65], [-31, uy + 3, 65], [-31, uy + 3, 73], [-38, uy, 73]], 2.8, true);
  art.box([-31, uy + 2.85, 69], [3, .3, 8], timber, true);
  BLACKSAIL_CIVIL_PATHS.forEach((path, i) => followGround(path, i === 4 ? 5.4 : 3.6));

  art.relocate(new THREE.Matrix4().makeTranslation(720, 0, -720));
  const geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose()); art.solids.length = 0;
  const collider: Collider = { name: 'COL_BlackSailInlandCivilRoute', bvh: new MeshBVH(geometry), enabled: true };
  art.finish('blacksail'); art.root.name = 'BlackSailSaltCustomsAndRopeway';
  const markers: Marker[] = [
    { id: 'disc_harbor_salt_store', label: '草原盐仓', type: 'discovery', p: [640, y, -655], radius: 5, note: '盐仓有通向港口、索道和草原的三个出入口' },
    { id: 'disc_harbor_old_customs', label: '旧海关侧门', type: 'discovery', p: [645, cy, -608], radius: 4, note: '侧门绕回旧盐仓，正面装卸线通往拿骚港' },
    { id: 'disc_harbor_ropeway', label: '废货运索道', type: 'discovery', p: [676, uy, -655], radius: 4, note: '停用的货架悬在两座支架之间，检修路从旁边下坡' },
  ];
  return { root: art.root, collider, markers,
    update(player: THREE.Vector3) { art.root.visible = Math.hypot(player.x - 660, player.z + 630) < 420 && player.y < 130; },
    dispose() {
      collider.enabled = false; geometry.dispose();
      for (const mesh of art.layers.values()) mesh.geometry.dispose();
      for (const material of Object.values(art.materials)) material.dispose(); art.root.removeFromParent();
    },
  };
}
