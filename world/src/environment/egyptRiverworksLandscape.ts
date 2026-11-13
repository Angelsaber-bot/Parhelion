import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { EGYPT_OFFSET, egyptToWorld } from '../map/egyptPlan';
import { EGYPT_FIELD_TERRACES } from '../map/egyptRiverworksPlan';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

type Ground = (x: number, z: number, ceiling: number) => number | null;

/** Civil river infrastructure, outside the temple axis and the boss basin.
 * The port and irrigated terraces have different silhouettes and open loops.
 * Their construction does not silently select a river-engineering story branch. */
export function createEgyptRiverworksLandscape(ground: Ground) {
  const art = new SiteArt(), stone = '#bd9b68', pale = '#d5bd88', dark = '#786347';
  const timber = '#73543b', linen = '#d9ceb0', bronze = '#9a8955', reed = '#829054';
  const floor = (x: number, z: number) => {
    const [wx, wz] = egyptToWorld(x, z);
    return ground(wx, wz, 24) ?? 13;
  };
  const at = (x: number, z: number, lift = .12): Point => [x, floor(x, z) + lift, z];
  function path(points: [number, number][], width = 3.6) {
    const sampled: Point[] = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3);
      for (let j = i === 1 ? 0 : 1; j <= n; j++) {
        const t = j / n; sampled.push(at(THREE.MathUtils.lerp(a[0], b[0], t), THREE.MathUtils.lerp(a[1], b[1], t)));
      }
    }
    landscapeWalkway(art, sampled, { width, floor: stone, edge: pale });
  }
  function pad(x: number, z: number, w: number, d: number) {
    const samples = [-1, 0, 1].flatMap(a => [-1, 0, 1].map(b => floor(x + a * w / 2, z + b * d / 2)));
    const y = Math.max(...samples) + .14, base = Math.min(...samples) - .3;
    art.box([x, (y + base) / 2, z], [w, y - base, d], stone);
    const surface = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, y, z);
    art.solids.push(surface.toNonIndexed()); surface.dispose();
    return y;
  }
  function ramp(x: number, z: number, y: number, toX: number, toZ: number, width: number) {
    landscapeWalkway(art, [[x, y, z], at(toX, toZ)], { width, floor: stone, edge: pale, steps: true });
  }
  function warehouse(x: number, z: number, w: number, d: number) {
    const y = pad(x, z, w + 3, d + 3);
    // Two opposing doors keep this a traversable courtyard building.
    for (const side of [-1, 1]) {
      art.box([x + side * w / 2, y + 2.5, z], [.7, 5, d], stone, true);
      for (const wing of [-1, 1]) art.box([x + wing * (w + 3.2) / 4, y + 2.5, z + side * d / 2],
        [(w - 3.2) / 2, 5, .65], stone, true);
      art.box([x, y + 4.3, z + side * d / 2], [3.3, 1.4, .78], pale, true);
      ramp(x, z + side * (d / 2 + 1.5), y, x, z + side * (d / 2 + 12), 3.6);
      for (const dx of [-w / 2 + 1, w / 2 - 1]) art.box([x + dx, y + 5.35, z + side * (d / 2 - 1)], [1.6, .7, 1.6], pale);
    }
    art.box([x, y + 5.15, z], [w + 1, .45, d + 1], pale, true);
    for (let i = 0; i < 5; i++) {
      const sx = x - w / 2 + 1.7, sz = z - d / 2 + 1.6 + i * 1.7;
      art.cyl([sx, y + .63, sz], .48, 1.26, i % 2 ? '#b98758' : '#a68b63', true);
      art.cyl([sx, y + 1.27, sz], .29, .08, dark);
      art.box([x + w / 2 - 1.7, y + .55, sz], [1.45, 1.1, 1.3], timber, true);
      for (const dz of [-.45, .45]) art.box([x + w / 2 - 1.7, y + .56, sz + dz], [1.49, 1.15, .06], bronze);
    }
    art.lantern(x + 2.5, y + 2, z + d / 2 + .7);
    return y;
  }
  warehouse(-119, 213, 13, 15);
  warehouse(-87, 214, 11, 12);
  // The port road circles the back of both storehouses and returns to the quay.
  path([[-151, 145], [-149, 165], [-157, 194], [-141, 230], [-107, 237], [-72, 228], [-64, 196], [-84, 186]], 4.2);
  path([[-137, 198], [-117, 193], [-92, 190], [-65, 181], [-38, 177], [-17, 166]], 4.6);
  path([[-119, 193], [-119, 191]], 3.8);
  path([[-119, 236], [-107, 237], [-87, 232]], 3.8);
  // Heavy stone quay and a lower timber slipway: the working side of the port.
  const qy = pad(-108, 187, 23, 6);
  ramp(-119.5, 187, qy, -135, 194, 4.2);
  ramp(-96.5, 187, qy, -84, 191, 4.2);
  landscapeWalkway(art, [[-108, qy, 184], [-108, 10.85, 179], [-108, 10.85, 170]],
    { width: 3.5, floor: timber, edge: dark, supports: floor });
  for (const x of [-117, -111, -103, -97]) {
    art.cyl([x, qy + .5, 184.9], .22, 1, bronze, true);
    art.ring([x, qy + .4, 184.9], .37, .07, timber);
  }
  // Two capstan cranes, lifting tackle and stacked reusable hull ribs.
  for (const x of [-117, -98]) {
    art.cyl([x, qy + 1.6, 189], .23, 3.2, timber, true);
    art.beam([x, qy + 3.2, 189], [x + 2.2, qy + 4.4, 183], .23, timber);
    art.beam([x, qy + 1.3, 189], [x + 2.2, qy + 4.4, 183], .12, bronze);
    art.beam([x + 2.2, qy + 4.4, 183], [x + 2.2, qy + .6, 183], .035, dark);
    art.ring([x, qy + 1.2, 188.8], .63, .08, bronze, 'metal');
  }
  for (let i = 0; i < 7; i++) {
    const z = 204 + i * 1.3, x = -105, y = floor(x, z) + .35;
    art.beam([x - 2.4, y + 1.4, z], [x, y, z], .2, timber);
    art.beam([x, y, z], [x + 2.4, y + 1.4, z], .2, timber);
  }
  path([[-17, 166], [3, 177], [12, 193], [16, 211], [16, 238], [38, 243], [44, 223], [43, 202], [33, 186], [13, 163]], 3.4);
  // New-field terraces follow the descending eastern bank. Low bunds leave
  // broad views; long cloth shades distinguish this area from the high port walls.
  for (const { x, z, width: w, depth: d } of EGYPT_FIELD_TERRACES) {
    const y = pad(x, z, w, d);
    art.box([x, y + .025, z], [w - .7, .05, d - .7], '#8c8554');
    for (const side of [-1, 1]) {
      if (side > 0) art.box([x + side * (w / 2 - .23), y + .22, z], [.46, .44, d], '#ac9566', true);
      else for (const end of [-1, 1]) art.box([x - w / 2 + .23, y + .22, z + end * (d + 2.8) / 4], [.46, .44, (d - 2.8) / 2], '#ac9566', true);
      art.box([x, y + .22, z + side * (d / 2 - .23)], [w, .44, .46], '#ac9566', true);
    }
    for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) {
      const px = x - w / 2 + 1.4 + col * (w - 2.8) / 6, pz = z - d / 2 + 1.4 + row * (d - 2.8) / 3;
      art.beam([px, y + .05, pz], [px + .08, y + .55 + .12 * (col % 3), pz], .035, reed);
      art.beam([px, y + .28, pz], [px - .27, y + .5, pz + .17], .045, '#a2a75e');
    }
    // A dry maintenance lane runs alongside the irrigation trough.
    const cy = y + .25, cx = x + w / 2 + 1;
    art.box([cx, cy - .12, z], [1.1, .3, d + 2], stone);
    art.box([cx, cy + .045, z], [.72, .025, d + 2], '#69978d');
    for (const side of [-1, 1]) art.box([cx + side * .5, cy + .12, z], [.14, .42, d + 2], pale);
    for (const end of [-1, 1]) art.box([cx, cy + .2, z + end * (d / 2 + .6)], [1.4, .16, 1.7], timber, true);
    ramp(x - w / 2, z, y, x - w / 2 - 8, z, 2.4);

  }
  // Shaduf pump on the river edge and a linen-roofed repair shelter.
  const py = floor(42, 210);
  for (const dx of [-.8, .8]) art.cyl([42 + dx, py + 1.4, 210], .13, 2.8, timber, true);
  art.beam([39, py + 1.8, 210], [46, py + 4, 210], .15, timber);
  art.box([39.4, py + 1.65, 210], [.9, .7, .7], stone);
  art.beam([46, py + 4, 210], [46, py + .3, 210], .035, dark);
  art.cyl([46, py + .23, 210], .38, .46, timber);
  const sy = pad(18, 249, 10, 8);
  for (const dx of [-4.5, 4.5]) for (const dz of [-3.5, 3.5]) art.cyl([18 + dx, sy + 1.8, 249 + dz], .12, 3.6, timber, true);
  art.box([18, sy + 3.5, 249], [10.5, .1, 8.5], linen, false, 'body', [0, 0, .045]);
  art.box([16, sy + .9, 251], [3.4, .16, 1.3], timber, true);
  art.paper(16, sy + 1, 251, 1.1, .7);
  for (const dx of [-3, 0, 3]) art.box([18 + dx, sy + .3, 247], [2, .6, .75], dark, true);
  ramp(18, 245, sy, 18, 237, 3.3);
  ramp(23, 249, sy, 38, 243, 3.3);
  const frame = new THREE.Matrix4().makeRotationY(Math.PI); frame.setPosition(EGYPT_OFFSET[0], 0, EGYPT_OFFSET[1]);
  art.relocate(frame);
  const geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose());
  const collider: Collider = { name: 'COL_EgyptRiverworksLandscape', bvh: new MeshBVH(geometry), enabled: true };
  art.finish('alpha'); art.root.name = 'EgyptOldHarborAndNewFields';
  const center = new THREE.Vector3(-51, 13, 202).applyMatrix4(frame);
  return { root: art.root, collider,
    update(player: THREE.Vector3) { art.root.visible = player.distanceToSquared(center) < 370 ** 2; },
    dispose() {
      collider.enabled = false; geometry.dispose(); for (const mesh of art.layers.values()) mesh.geometry.dispose();
      for (const material of Object.values(art.materials)) material.dispose(); art.root.removeFromParent();
    },
  };
}
