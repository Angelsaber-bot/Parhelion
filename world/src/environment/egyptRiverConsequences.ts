import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { EGYPT_LAKE, EGYPT_RIVER, EGYPT_SACRED_LAKE, egyptDistanceToPolyline, egyptToWorld, worldToEgypt } from '../map/egyptPlan';
import { EGYPT_ROYAL_CAUSEWAY, EGYPT_WEST_DIVERSION, EGYPT_OVERFLOW, EGYPT_STILLING_BASIN, EGYPT_HIGH_CHANNEL, EGYPT_COLUMN_CHANNEL } from '../map/egyptRiverworksPlan';
import { polylineRibbon } from '../map/polylineRibbon';
import { selectedEgyptWaterPlan } from '../story/egyptWaterPlan';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

/** Visible geography follows the saved engineering choice. The old road really
 * loses collision in the west branch; its replacement crosses above the water. */
export function createEgyptRiverConsequences(ground: (x: number, z: number, ceiling: number) => number | null) {
  const root = new THREE.Group(); root.name = 'EgyptRiverConsequences';
  const frame = new THREE.Matrix4().makeRotationY(Math.PI); frame.setPosition(0, 0, -1440);
  const pieces: { art: SiteArt; geo: THREE.BufferGeometry; collider: Collider; branch: 'old' | 'west' | 'east' }[] = [];
  const stone = '#c9ad82', wood = '#7d5d3e', edge = '#ab925f';
  const floor = (x: number, z: number, ceiling = 28) => { const [wx, wz] = egyptToWorld(x, z); return ground(wx, wz, ceiling) ?? 12; };
  const at = (x: number, z: number): Point => [x, floor(x, z) + .18, z];
  function finish(art: SiteArt, name: string, branch: typeof pieces[number]['branch']) {
    art.relocate(frame); art.finish('alpha'); art.root.name = name; root.add(art.root);
    const geo = mergeParts(art.solids); art.solids.forEach(g => g.dispose()); art.solids.length = 0;
    const collider: Collider = { name: 'COL_' + name, bvh: new MeshBVH(geo), enabled: branch === 'old' };
    art.root.visible = branch === 'old'; pieces.push({ art, geo, collider, branch });
  }
  const oldRoad = new SiteArt();
  landscapeWalkway(oldRoad, EGYPT_ROYAL_CAUSEWAY.map(p => [...p]), { width: 8, floor: stone, edge: '#9d8b70' });
  // Retaining piers belong to the dismantled causeway, not the open new river.
  for (let n = 1; n < 7; n++) {
    const t = n / 7, x = -30 + 30 * t, z = 140 - 30 * t, top = 10.15 + 3 * t, bottom = floor(x, z, top - .4);
    if (top > bottom + .3) oldRoad.box([x, (top + bottom) / 2 - .15, z], [1.4, top - bottom, 7.6], '#a9916e', true, 'body', [0, -Math.PI / 4, 0]);
  }
  finish(oldRoad, 'EgyptOldRoyalCauseway', 'old');
  const replacement = new SiteArt();
  landscapeWalkway(replacement, [at(-42, 152), [-30, 16, 140], [0, 16, 110], at(12, 98)],
    { width: 4.1, floor: wood, edge, rails: true, steps: true });
  for (const [x, z] of [[-28, 138], [-2, 112]]) {
    const bottom = floor(x, z, 15);
    for (const s of [-1, 1]) {
      const xx = x + s * 1.25, zz = z + s * 1.25;
      replacement.box([xx, (16 + bottom) / 2 - .12, zz], [.5, 16 - bottom, .5], stone, true);
      replacement.beam([xx, bottom + .4, zz], [x - s * 1.25, 15.7, z - s * 1.25], .2, edge);
    }
  }
  replacement.lantern(-30, 17.8, 140); replacement.lantern(0, 17.8, 110);
  finish(replacement, 'EgyptRoyalRoadReplacementBridge', 'west');
  // East-bank priorities leave part of the old harbor apron to small traders.
  // Stalls stand on the dry warehouse approach, clear of the remaining skiff.
  const market = new SiteArt();
  for (const [x, z, fabric] of [[-133, 202, '#b56f49'], [-133, 213, '#8b9a80'], [-133, 224, '#d5bb82']] as const) {
    const y = floor(x, z) + .15;
    market.box([x, y - .12, z], [5.6, .24, 6], stone, true);
    for (const xx of [x - 2.3, x + 2.3]) for (const zz of [z - 2.5, z + 2.5]) market.box([xx, y + 1.65, zz], [.15, 3.3, .15], wood, true);
    market.box([x, y + 3.25, z], [5.4, .1, 5.8], fabric, true, 'body', [.045, 0, 0]);
    market.box([x - 1.45, y + .9, z], [1.25, .16, 4.5], wood, true);
    for (let n = 0; n < 4; n++) market.cyl([x - 1.5, y + 1.25, z - 1.6 + n], .3, .5, n % 2 ? '#be9564' : '#8e6b49', true);
    landscapeWalkway(market, [[x + 2.8, y, z], at(x + 7.5, z)], { width: 3, floor: stone, edge, steps: true });
    market.lantern(x + 2.1, y + 2.5, z - 2.4);
  }
  finish(market, 'EgyptHarborDryMarket', 'east');
  const vertices = polylineRibbon(EGYPT_WEST_DIVERSION, 9.4);
  const waterGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); waterGeometry.computeVertexNormals();
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#528e98', roughness: .34, metalness: .15, transparent: true, opacity: .83, side: THREE.DoubleSide });
  const water = new THREE.Mesh(waterGeometry, waterMaterial); water.visible = false; water.applyMatrix4(frame); root.add(water);
  let west = false;
  return {
    root, colliders: pieces.map(p => p.collider),
    apply(done: ReadonlySet<string>) {
      const option = selectedEgyptWaterPlan(done); west = !!option?.startsWith('west'); const east = !!option?.startsWith('east');
      for (const part of pieces) part.art.root.visible = part.collider.enabled = part.branch === 'west' ? west : part.branch === 'east' ? east : !west;
      water.visible = west;
    },
    waterSurfaceAt(position: THREE.Vector3): number | null {
      const [x, z] = worldToEgypt(position.x, position.z);
      if (Math.abs(x) > 360 || Math.abs(z) > 360) return null;
      let level: number | null = null;
      const add = (y: number) => { level = level === null ? y : Math.max(level, y); };
      if (Math.hypot((x - EGYPT_LAKE.x) / (EGYPT_LAKE.rx * .93), (z - EGYPT_LAKE.z) / (EGYPT_LAKE.rz * .93)) <= 1) add(EGYPT_LAKE.surface);
      const river = egyptDistanceToPolyline(x, z, EGYPT_RIVER); if (river.d <= 4.2) add(river.y - .35);
      for (const path of [EGYPT_HIGH_CHANNEL, EGYPT_COLUMN_CHANNEL]) {
        const upper = egyptDistanceToPolyline(x, z, path);
        // Elevated channels must not turn the dry room directly beneath them into water.
        if (upper.d <= 2.2 && position.y >= upper.y - .8) add(upper.y);
      }
      const lake = EGYPT_SACRED_LAKE;
      if (x > lake.basin[0] + 1.2 && x < lake.basin[1] - 1.2 && z > lake.basin[2] + 1.2 && z < lake.basin[3] - 1.2) add(lake.surface);
      const overflow = egyptDistanceToPolyline(x, z, EGYPT_OVERFLOW); if (overflow.d < 2.5) add(overflow.y);
      const basin = EGYPT_STILLING_BASIN;
      if (Math.abs(x - basin.x) < basin.width / 2 && Math.abs(z - basin.z) < basin.depth / 2) add(basin.water);
      if (west) { const channel = egyptDistanceToPolyline(x, z, EGYPT_WEST_DIVERSION); if (channel.d <= 4.7) add(channel.y); }
      return level;
    },
    dispose() {
      for (const part of pieces) { part.collider.enabled = false; part.geo.dispose(); for (const layer of part.art.layers.values()) layer.geometry.dispose(); for (const material of Object.values(part.art.materials)) material.dispose(); }
      waterGeometry.dispose(); waterMaterial.dispose(); root.removeFromParent();
    },
  };
}
