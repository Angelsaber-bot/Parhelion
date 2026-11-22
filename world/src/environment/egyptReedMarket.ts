import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import { EGYPT_OFFSET, egyptToWorld } from '../map/egyptPlan';
import { EGYPT_MARKET_PATHS, EGYPT_MARKET_SITES } from '../map/egyptRiverworksPlan';
import type { Collider } from '../player/player';
import { mergeParts } from '../settlements/merge';
import { SiteArt } from '../story/campaignSites';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

type Ground = (x: number, z: number, ceiling: number) => number | null;

/** Two working yards on the same shore, joined by the upper cart path and lower freight walk. */
export function createEgyptReedMarket(ground: Ground) {
  const art = new SiteArt();
  const mudbrick = '#aa845a', limestone = '#d5b883', bronze = '#ac8e52';
  const wood = '#765440', reed = '#9c9857', linen = '#dfcda2', blue = '#427d81';
  const { landing, market, hull } = EGYPT_MARKET_SITES;
  function floor(x: number, z: number, ceiling = 17) {
    const [wx, wz] = egyptToWorld(x, z);
    return ground(wx, wz, ceiling) ?? 13;
  }
  function road(points: readonly (readonly [number, number])[], width: number, surface: string) {
    const sampled: Point[] = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
      for (let j = i === 1 ? 0 : 1; j <= count; j++) {
        const x = THREE.MathUtils.lerp(a[0], b[0], j / count), z = THREE.MathUtils.lerp(a[1], b[1], j / count);
        sampled.push([x, floor(x, z) + .05, z]);
      }
    }
    landscapeWalkway(art, sampled, { width, floor: surface, edge: bronze });
  }
  function yard(x: number, z: number, width: number, depth: number) {
    const corners = [-1, 0, 1].flatMap(sx => [-1, 0, 1].map(sz => floor(x + sx * width / 2, z + sz * depth / 2)));
    const y = Math.max(...corners) + .13, base = Math.min(...corners) - .24;
    art.box([x, (y + base) / 2, z], [width, y - base, depth], mudbrick);
    const surface = new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2).translate(x, y, z);
    art.solids.push(surface.toNonIndexed()); surface.dispose();
    return y;
  }
  function walkway(from: Point, to: Point, width: number, floor: string, rails = false) {
    landscapeWalkway(art, [from, to], { width, floor, edge: bronze, rails, steps: true });
  }
  function basket(x: number, y: number, z: number, color: string) {
    art.cyl([x, y + .24, z], .31, .48, reed, true);
    art.cyl([x, y + .46, z], .27, .08, color);
    for (const height of [.15, .33]) art.cyl([x, y + height, z], .32, .024, linen);
  }
  function shelter(x: number, y: number, z: number, w: number, d: number, stripe: string) {
    const eave = y + 3.06, peak = eave + .67, halfSpan = d / 2 + .23;
    for (const sx of [-1, 1]) {
      const px = x + sx * (w / 2 - .25);
      for (const sz of [-1, 1]) {
        const pz = z + sz * (d / 2 - .3);
        art.box([px, y + 1.53, pz], [.16, 3.06, .16], wood, true);
        art.box([px, y + .17, pz], [.36, .34, .36], limestone);
        art.beam([px, eave - .55, pz], [px - sx * .7, eave, pz], .13, wood);
        art.beam([px, eave, z + sz * halfSpan], [px, peak, z], .13, wood);
      }
    }
    art.beam([x - w / 2, peak, z], [x + w / 2, peak, z], .12, wood);
    for (const sz of [-1, 1])
      art.beam([x - w / 2, eave + .07, z + sz * (d / 2 - .3)], [x + w / 2, eave + .07, z + sz * (d / 2 - .3)], .13, wood);

    // Sewn linen spans the ridge pole. Each strip has a shallow belly between
    // the ridge and the eave, then hangs free beyond the last timber.
    const profile = [[-halfSpan, eave - .22], [-halfSpan, eave + .085], [-halfSpan / 2, (peak + eave) / 2 + .093],
      [0, peak + .086], [halfSpan / 2, (peak + eave) / 2 + .093], [halfSpan, eave + .085], [halfSpan, eave - .22]];
    function clothPoint(px: number, height: number, dz: number) {
      const belly = Math.abs(dz) === halfSpan / 2 ? .065 * Math.max(0, 1 - ((px - x) / (w / 2 - .25)) ** 2) : 0;
      return [px, height - belly, z + dz];
    }
    for (let i = 0; i < 10; i++) {
      const left = x - w / 2 + i * w / 10, right = left + w / 10, positions: number[] = [];
      for (let j = 1; j < profile.length; j++) {
        const [za, ya] = profile[j - 1], [zb, yb] = profile[j];
        const a = clothPoint(left, ya, za), b = clothPoint(left, yb, zb);
        const c = clothPoint(right, yb, zb), e = clothPoint(right, ya, za);
        positions.push(...a, ...b, ...c, ...a, ...c, ...e, ...c, ...b, ...a, ...e, ...c, ...a);
      }
      const cloth = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      cloth.computeVertexNormals();
      art.add(cloth, i % 3 ? linen : stripe, [0, 0, 0]);
      cloth.dispose();
    }
    art.lantern(x - w / 2 + .31, y + 2.63, z + d / 2 - .3);
  }

  const marketY = yard(market.x, market.z, market.width, market.depth);
  for (const [x, z] of [[-173, 137.1], [-169, 143], [-181, 145.7], [-174, 150.8]]) {
    const edgeX = THREE.MathUtils.clamp(x, market.x - market.width / 2 + .2, market.x + market.width / 2 - .2);
    const edgeZ = THREE.MathUtils.clamp(z, market.z - market.depth / 2 + .2, market.z + market.depth / 2 - .2);
    if (Math.hypot(x - edgeX, z - edgeZ) > .4) walkway([edgeX, marketY, edgeZ], [x, floor(x, z), z], 2.65, limestone);
  }
  shelter(-179.7, marketY, 142.3, 4.7, 4.8, blue);
  shelter(-173.7, marketY, 142.3, 4.8, 4.8, '#a6523c');
  // Scale and grain bins face the through aisle. The back of the shed stays open to the workyard.
  for (const x of [-180.75, -179.6, -178.45]) basket(x, marketY, 141.2, '#bb9451');
  art.box([-179.65, marketY + .87, 143.3], [2.6, .17, .87], wood, true);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    art.box([-179.65 + sx * 1.04, marketY + .4, 143.3 + sz * .29], [.14, .8, .14], wood, true);
  }
  for (const sz of [-1, 1]) {
    const z = 143.3 + sz * .29;
    art.beam([-180.69, marketY + .27, z], [-178.61, marketY + .27, z], .1, wood);
  }
  const pivotX = -179.65, scaleZ = 143.3;
  for (const sz of [-1, 1]) {
    art.beam([pivotX, marketY + .95, scaleZ + sz * .28], [pivotX, marketY + 1.83, scaleZ], .085, wood);
  }
  art.beam([pivotX - .72, marketY + 1.82, scaleZ], [pivotX + .72, marketY + 1.82, scaleZ], .06, bronze);
  const pan = new THREE.LatheGeometry([new THREE.Vector2(.02, 0), new THREE.Vector2(.21, .045),
    new THREE.Vector2(.26, .11), new THREE.Vector2(.23, .10), new THREE.Vector2(.19, .061), new THREE.Vector2(0, .024)], 10);
  for (const sx of [-1, 1]) {
    const px = pivotX + sx * .66;
    art.add(pan, bronze, [px, marketY + 1.11, scaleZ], [1, 1, 1], false, 'metal');
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      art.beam([px, marketY + 1.82, scaleZ], [px + .245 * Math.cos(angle), marketY + 1.21, scaleZ + .245 * Math.sin(angle)], .022, reed);
    }
  }
  pan.dispose();
  art.box([pivotX + .66, marketY + 1.2, scaleZ], [.18, .13, .16], limestone);
  // Hull ribs and sloped cradles give the shipwright stall a different silhouette from the grain stall.
  for (const z of [141.5, 142.45, 143.4]) for (const s of [-1, 1]) {
    art.beam([-173.7 + s * 1.6, marketY + .24, z], [-173.7, marketY + 1.27, z], .14, wood, true);
  }
  art.beam([-173.7, marketY + 1.25, 140.8], [-173.7, marketY + 1.25, 144], .11, bronze);
  road(EGYPT_MARKET_PATHS[0], 3.7, limestone);
  road(EGYPT_MARKET_PATHS[1], 2.7, mudbrick);

  const landingY = yard(landing.x, landing.z, landing.width, landing.depth);
  walkway([-159, landingY, 154.4], [-160, floor(-160, 151), 151], 3.8, limestone);
  walkway([-163.6, landingY, 159.7], [-169, floor(-169, 162), 162], 3.4, wood);
  const slipY = floor(-160, 165.9) + .14;
  walkway([-159.9, landingY, 161], [-160, slipY, 165.9], 3.4, wood, true);
  walkway([-160, slipY, 165.9], [-161.8, floor(-161.8, 168.4), 168.4], 2.8, wood);
  // Loading frame, slung basket and slack rope make it clear why this quay is out of service.
  for (const x of [-161.6, -155.4]) {
    art.box([x, landingY + 2.4, 156], [.32, 4.8, .35], wood, true);
    art.beam([x, landingY + .2, 157.7], [x, landingY + 3.9, 156], .23, wood, true);
  }
  art.beam([-162, landingY + 4.75, 156], [-154.7, landingY + 4.35, 156.5], .3, wood, true);
  art.ring([-156.2, landingY + 4.26, 156.45], .23, .06, bronze);
  art.beam([-156.2, landingY + 4.05, 156.45], [-155.7, landingY + 1.08, 156.8], .05, reed);
  basket(-155.7, landingY + .48, 156.8, linen);
  art.lantern(-161.5, landingY + 2.8, 156.34);
  for (const x of [-161.8, -155.6]) art.cyl([x, landingY + .45, 161.3], .22, .9, bronze, true);

  // A timber hull sits visibly canted on sleepers rather than floating on the dry bank.
  const shipY = floor(hull.x, hull.z) + .76;
  const frame = new THREE.Matrix4().compose(new THREE.Vector3(hull.x, shipY, hull.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(.035, -.26, .15, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const boat = new SiteArt();
  const rim: Point[] = [[0, 1.1, -6.3], [1.45, .55, -4.4], [1.86, .25, -1.9], [1.86, .25, 2.6],
    [1.2, .48, 4.45], [0, .92, 5.75], [-1.2, .48, 4.45], [-1.86, .25, 2.6], [-1.86, .25, -1.9], [-1.45, .55, -4.4]];
  const planks: number[] = [];
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i], b = rim[(i + 1) % rim.length];
    const lowA: Point = [a[0] * .48, -.48, a[2] * .78], lowB: Point = [b[0] * .48, -.48, b[2] * .78];
    planks.push(...a, ...b, ...lowA, ...b, ...lowB, ...lowA);
    boat.beam(a, b, .13, bronze);
  }
  const planking = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(planks, 3));
  planking.computeVertexNormals(); boat.add(planking, blue, [0, 0, 0], [1, 1, 1], true); planking.dispose();
  boat.box([0, .04, -.4], [2.85, .18, 7.6], wood, true);
  for (const z of [-2.9, 2.1]) {
    boat.box([0, .31, z], [3.29, .17, .49], limestone, true);
    boat.box([0, -.51, z], [4.27, .23, .44], wood, true);
  }
  boat.box([.4, .38, .55], [.9, .52, .88], mudbrick, true);
  boat.box([-.63, .25, -1.24], [.62, .34, .65], reed, true);
  boat.relocate(frame); boat.finish('alpha'); boat.root.name = 'EgyptStrandedFerryHull'; art.root.add(boat.root);
  art.solids.push(...boat.solids); boat.solids.length = 0;
  const region = new THREE.Matrix4().makeRotationY(Math.PI); region.setPosition(EGYPT_OFFSET[0], 0, EGYPT_OFFSET[1]);
  art.relocate(region);
  const geometry = mergeParts(art.solids); art.solids.forEach(solid => solid.dispose()); art.solids.length = 0;
  const collider: Collider = { name: 'COL_EgyptReedMarketAndLanding', enabled: true, bvh: new MeshBVH(geometry) };
  art.finish('alpha'); art.root.name = 'EgyptReedMarketAndStrandedLanding';
  const markers: Marker[] = [
    { id: 'egypt_stranded_landing', type: 'poi', p: new THREE.Vector3(landing.x, landingY, landing.z).applyMatrix4(region).toArray(), label: '搁浅渡口' },
    { id: 'egypt_reed_market', type: 'poi', p: new THREE.Vector3(market.x, marketY, market.z).applyMatrix4(region).toArray(), label: '芦苇市集 · 河工货场' },
  ];
  return { root: art.root, collider, markers,
    update(player: THREE.Vector3) { art.root.visible = Math.hypot(player.x - markers[0].p[0], player.z - markers[0].p[2]) < 295; },
    dispose() {
      collider.enabled = false; geometry.dispose();
      for (const site of [art, boat]) { for (const mesh of site.layers.values()) mesh.geometry.dispose(); Object.values(site.materials).forEach(material => material.dispose()); }
      art.root.removeFromParent();
    },
  };
}
