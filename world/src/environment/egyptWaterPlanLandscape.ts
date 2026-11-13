import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { EGYPT_OFFSET, egyptToWorld } from '../map/egyptPlan';
import { EGYPT_FIELD_TERRACES } from '../map/egyptRiverworksPlan';
import { EGYPT_WATER_PLAN, selectedEgyptWaterPlan, type EgyptWaterOption } from '../story/egyptWaterPlan';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

/** Finite, reversible engineering configurations. The table preview changes
 * only its miniature; full-size structures and collision follow saved choices. */
export function createEgyptWaterPlanLandscape(ground: (x: number, z: number, ceiling: number) => number | null) {
  const root = new THREE.Group(); root.name = 'EgyptWaterEngineeringConfigurations';
  const frame = new THREE.Matrix4().makeRotationY(Math.PI); frame.setPosition(EGYPT_OFFSET[0], 0, EGYPT_OFFSET[1]);
  const stone = '#bd9d6f', pale = '#e1c99a', timber = '#74543b', bronze = '#b29559';
  const floor = (x: number, z: number) => { const [wx, wz] = egyptToWorld(x, z); return ground(wx, wz, 25) ?? 12; };
  const at = (x: number, z: number): Point => [x, floor(x, z) + .16, z];
  const pieces: { art: SiteArt; geometry?: THREE.BufferGeometry; collider?: Collider; option?: EgyptWaterOption | 'west' | 'east' | 'smallBoat' }[] = [];
  function finish(art: SiteArt, name: string, option?: typeof pieces[number]['option']) {
    art.relocate(frame);
    let geometry: THREE.BufferGeometry | undefined, collider: Collider | undefined;
    if (art.solids.length) {
      geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose());
      collider = { name: `COL_${name}`, bvh: new MeshBVH(geometry), enabled: !option };
    }
    art.finish('alpha'); art.root.name = name; root.add(art.root);
    art.root.visible = !option; pieces.push({ art, geometry, collider, option });
    return art;
  }
  const fixed = new SiteArt(), tableX = -145, tableZ = 120, tableY = floor(tableX, tableZ) + .08;
  // A real waist-high model at the oasis, with room to approach from all sides.
  for (const dx of [-1.5, 1.5]) for (const dz of [-1.1, 1.1]) fixed.box([tableX + dx, tableY + .48, tableZ + dz], [.24, .96, .24], timber, true);
  fixed.box([tableX, tableY + .99, tableZ], [3.8, .18, 2.9], pale, true);
  for (const dx of [-1.88, 1.88]) fixed.box([tableX + dx, tableY + 1.12, tableZ], [.1, .15, 2.95], bronze);
  for (const dz of [-1.43, 1.43]) fixed.box([tableX, tableY + 1.12, tableZ + dz], [3.85, .15, .1], bronze);
  for (const dx of [-1.15, 1.15]) {
    fixed.box([tableX + dx, tableY + 1.15, tableZ], [.88, .17, 1.7], stone);
    fixed.box([tableX + dx, tableY + 1.32, tableZ - .66], [.44, .34, .32], pale);
  }
  fixed.box([tableX, tableY + 1.11, tableZ], [.25, .03, 2.7], '#648c97');
  fixed.box([tableX, tableY + 1.26, tableZ - .38], [.7, .3, .2], bronze);
  fixed.lantern(tableX - 2.5, tableY + 2.2, tableZ + 1.4);
  finish(fixed, 'EgyptWaterPlanningTable');
  const modelMaterial = new THREE.MeshStandardMaterial({ color: '#5fbbc4', roughness: .3, emissive: '#183235', emissiveIntensity: .45 });
  const modelGeometry = new THREE.BoxGeometry(1.55, .035, .17);
  const modelFlow = [-1, 1].map(side => {
    const mesh = new THREE.Mesh(modelGeometry, modelMaterial);
    mesh.position.set(tableX + side * .84, tableY + 1.25, tableZ + .3);
    fixed.root.add(mesh); return mesh;
  });
  function preview(option: EgyptWaterOption | null) {
    const west = option?.startsWith('west'), east = option?.startsWith('east');
    modelFlow[0].scale.z = west ? 2.3 : east ? .55 : 1;
    modelFlow[1].scale.z = east ? 2.3 : west ? .55 : 1;
  }
  // The deep-port choice pays for one of two distinct shortcuts.
  const bridge = new SiteArt();
  landscapeWalkway(bridge, [at(-70, 194), [-70, 15, 184], [-70, 15, 162], [-70, 15, 136], at(-70, 130)],
    { width: 4.5, floor: pale, edge: bronze, rails: true, steps: true });
  for (const z of [136, 162, 184]) for (const x of [-72.5, -67.5]) {
    const bottom = floor(x, z) - .2;
    bridge.box([x, (bottom + 14.8) / 2, z], [1.4, 14.8 - bottom, 2.8], stone, true);
    bridge.box([x, 14.6, z], [2.1, .8, 3.3], pale);
  }
  // Side trusses carry the long span without a forest of props in the river.
  for (const x of [-72.15, -67.85]) {
    bridge.beam([x, 13.4, 136], [x, 13.4, 184], .25, bronze);
    for (let z = 136; z < 180; z += 4.4) {
      bridge.beam([x, 13.4, z], [x, 14.7, z + 2.2], .19, bronze);
      bridge.beam([x, 14.7, z + 2.2], [x, 13.4, z + 4.4], .19, bronze);
    }
  }
  finish(bridge, 'EgyptWestHarborHighBridge', 'westBridge');
  const passage = new SiteArt(), galleryY = Math.max(floor(-70, 205), floor(-70, 215), floor(-70, 222)) + .2;
  landscapeWalkway(passage, [at(-64, 196), [-70, galleryY, 205], [-70, galleryY, 222], at(-72, 228)],
    { width: 4.6, floor: pale, edge: bronze, steps: true });
  for (const x of [-73, -67]) {
    passage.box([x, galleryY + 2, 213.5], [.8, 4, 18], stone, true);
    for (const z of [206, 211, 216, 221]) {
      passage.box([x, galleryY + 1.8, z], [1.2, 3.6, .8], pale, true);
      passage.box([x, galleryY + 4.6, z], [1.4, 1.2, 1.1], stone);
    }
  }
  passage.box([-70, galleryY + 4.1, 213.5], [7, .4, 19], pale, true);
  for (const z of [207, 214, 220]) passage.lantern(-72.3, galleryY + 2.8, z);
  finish(passage, 'EgyptWestWarehousePassage', 'westStore');
  const fields = new SiteArt();
  landscapeWalkway(fields, [at(16, 202), [16, 10.3, 207], [44, 10.3, 207], at(44, 221)],
    { width: 3.6, floor: timber, edge: bronze, rails: true, steps: true });
  for (const x of [17, 26, 35, 43]) for (const z of [205.8, 208.2]) {
    const bottom = floor(x, z) - .2;
    fields.box([x, (bottom + 10.1) / 2, z], [.48, 10.1 - bottom, .48], timber, true);
    fields.beam([x, bottom + .3, z], [x, 10, z === 205.8 ? 208.2 : 205.8], .17, bronze);
  }
  finish(fields, 'EgyptEastFieldCrossing', 'eastBridge');
  const baffle = new SiteArt(), bx = 12, bz = 143, by = floor(bx, bz);
  baffle.box([bx, by + 1.5, bz], [5, 3, .4], timber, true);
  for (const x of [bx - 2.6, bx + 2.6]) {
    baffle.box([x, by + 1.6, bz], [.3, 3.2, .65], bronze, true);
    baffle.beam([x, by + 2.9, bz], [x, by + .1, bz + 2], .22, bronze, true);
  }
  for (let y = .45; y < 3; y += .6) baffle.box([bx, by + y, bz - .23], [5.1, .12, .08], bronze);
  finish(baffle, 'EgyptEastSurgeBaffle', 'eastBaffle');
  const irrigation = new SiteArt();
  // Water lies in the existing bounded terrace, below the crops' upper leaves.
  for (const { x, z, width, depth } of EGYPT_FIELD_TERRACES) {
    const y = Math.max(...[-1, 0, 1].flatMap(a => [-1, 0, 1].map(b => floor(x + a * width / 2, z + b * depth / 2)))) + .205;
    for (let n = -2; n <= 2; n++) irrigation.box([x + n * 1.8, y, z], [.32, .035, depth - 1.2], '#599ba0');
  }
  finish(irrigation, 'EgyptExpandedFieldIrrigation', 'east');
  function boat(big: boolean) {
    const ship = new SiteArt(), x = -109, z = 177, y = 9.28, length = big ? 11 : 5, width = big ? 3.5 : 1.9;
    const hull = new THREE.Shape();
    hull.moveTo(0, -length / 2); hull.lineTo(width / 2, -length / 2 + 1.4); hull.lineTo(width / 2, length / 2 - 1.4);
    hull.quadraticCurveTo(0, length / 2 + .2, -width / 2, length / 2 - 1.4);
    hull.lineTo(-width / 2, -length / 2 + 1.4); hull.closePath();
    const hullGeometry = new THREE.ExtrudeGeometry(hull, { depth: .7, bevelEnabled: false }).rotateX(-Math.PI / 2);
    ship.add(hullGeometry, timber, [x, y, z]); hullGeometry.dispose();
    for (const side of [-1, 1]) ship.box([x + side * width * .43, y + .87, z], [.12, .34, length - 2.4], bronze);
    if (big) {
      ship.cyl([x, y + 3.3, z], .12, 5.7, timber);
      ship.box([x, y + 4.3, z], [3.8, 2.8, .08], '#d9cba6');
      for (const dz of [-3, 2.8]) for (const dx of [-.8, .8]) ship.box([x + dx, y + 1.2, z + dz], [.9, .8, 1.1], '#aa8354');
    } else ship.beam([x - 1.3, y + .9, z - 1], [x + 1.3, y + .9, z + 1], .09, timber);
    finish(ship, big ? 'EgyptDeepDraftFreighter' : 'EgyptBasicHarborSkiff', big ? 'west' : 'smallBoat');
  }
  boat(true); boat(false);
  const markerP = new THREE.Vector3(tableX, tableY + .92, tableZ + 2).applyMatrix4(frame).toArray();
  const markers: Marker[] = [{ id: EGYPT_WATER_PLAN.marker, type: 'interact', label: '绿洲 · 分水工程台', p: markerP, radius: 2.8 }];
  let selected: EgyptWaterOption | null = null;
  function apply(done: ReadonlySet<string>) {
    selected = selectedEgyptWaterPlan(done); preview(selected);
    for (const part of pieces) {
      const on = !part.option || part.option === selected
        || (part.option === 'west' && !!selected?.startsWith('west'))
        || (part.option === 'east' && !!selected?.startsWith('east'))
        || (part.option === 'smallBoat' && !selected?.startsWith('west'));
      part.art.root.visible = on; if (part.collider) part.collider.enabled = on;
    }
  }
  return { root, markers, colliders: pieces.flatMap(p => p.collider ? [p.collider] : []), preview, apply,
    update(player: THREE.Vector3) { root.visible = Math.hypot(player.x, player.z + 1610) < 400; },
    blocksSurge(source: { x: number; y: number; z: number }, player: THREE.Vector3) {
      if (selected !== 'eastBaffle') return false;
      const sx = -source.x, sz = EGYPT_OFFSET[1] - source.z;
      const px = -player.x, pz = EGYPT_OFFSET[1] - player.z;
      const t = (bz - sz) / (pz - sz);
      return t > 0 && t < 1 && Math.abs(sx + (px - sx) * t - bx) < 2.5
        && Math.abs(pz - bz) < 12 && player.y >= by - .5 && player.y < by + 3;
    },
    dispose() {
      for (const part of pieces) {
        if (part.collider) part.collider.enabled = false; part.geometry?.dispose();
        for (const mesh of part.art.layers.values()) mesh.geometry.dispose();
        for (const material of Object.values(part.art.materials)) material.dispose();
      }
      modelGeometry.dispose(); modelMaterial.dispose(); root.removeFromParent();
    },
  };
}
