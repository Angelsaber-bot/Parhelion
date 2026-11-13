import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { EGYPT_OFFSET, egyptToWorld } from '../map/egyptPlan';
import { EGYPT_OVERFLOW, EGYPT_STILLING_BASIN } from '../map/egyptRiverworksPlan';
import { JOURNEY } from '../story/worldJourney';
import { climaxCheckpoint, climaxCleared } from '../story/realmClimaxes';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

/** The confluence has a high-bank escape loop, a lower inspection route and
 * an independently sinking central gate. It dresses the existing encounter;
 * neither the live control sockets nor its fighting floor are moved. */
export function createEgyptConfluenceLandscape(ground: (x: number, z: number, ceiling: number) => number | null) {
  const art = new SiteArt(), stone = '#b99c70', pale = '#dfc797', dark = '#816b4d', bronze = '#aa884e', blue = '#477b7b';
  const frame = new THREE.Matrix4().makeRotationY(Math.PI); frame.setPosition(EGYPT_OFFSET[0], 0, EGYPT_OFFSET[1]);
  const floor = (x: number, z: number) => { const [wx, wz] = egyptToWorld(x, z); return ground(wx, wz, 26) ?? 10; };
  const at = (x: number, z: number): Point => [x, floor(x, z) + .15, z];
  const high = 16.2;
  const bank: Point[] = [at(-32, 118), [-23, high, 128], [-23, high, 152], [-23, high, 177],
    [-10, high, 184], [14, high, 184], [23, high, 174], [23, high, 150], [23, high, 133], at(36, 115)];
  const openings = [{ p: [-23, high, 139] as Point, radius: 4 }, { p: [-23, high, 164] as Point, radius: 4.5 },
    { p: [23, high, 174] as Point, radius: 4.5 }, { p: [23, high, 150] as Point, radius: 3.6 },
    { p: [-23, high, 169] as Point, radius: 3.3 }, { p: [23, high, 169] as Point, radius: 3.3 }];
  landscapeWalkway(art, bank, { width: 4.5, floor: pale, edge: bronze, rails: true, steps: true, supports: floor, railOpenings: openings });
  landscapeWalkway(art, [[-23, high, 164], [-42, high, 164], at(-60, 185), at(-65, 181)],
    { width: 4.5, floor: stone, edge: bronze, rails: true, steps: true, supports: floor });
  landscapeWalkway(art, [[23, high, 174], [46, high, 177], [51, 12.5, 192], [51, 7.4, 205], at(43, 218), at(43, 202)],
    { width: 3.4, floor: stone, edge: bronze, rails: true, steps: true, supports: floor,
      railOpenings: [{ p: [51, 12.5, 192], radius: 3.7 }] });
  landscapeWalkway(art, [[-23, high, 139], [-14, 12, 120], [-8, 12, 120], at(0, 132)],
    { width: 3.2, floor: stone, edge: bronze, rails: true, steps: true, supports: floor });
  // Retaining buttresses frame the central natural riverbed, leaving the
  // approach and all existing lateral controls open between them.
  for (const x of [-23, 23]) for (const z of [129, 151, 176]) {
    const bottom = floor(x, z) - .2;
    art.box([x, (bottom + high) / 2, z], [2.5, high - bottom, 3.2], stone, true);
    art.box([x, high - .6, z], [5, 1.2, 3.7], pale);
    art.lantern(x, high + 2.3, z);
  }
  // Stone guide slots and a separate central leaf make the engineering visible:
  // the side structures never have to smash the gate to open the river.
  const gateY = floor(0, 169) + .18;
  for (const x of [-7.7, 7.7]) {
    const bottom = floor(x, 169) - .2;
    art.box([x, (bottom + gateY + 8) / 2, 169], [2.7, gateY + 8 - bottom, 5.8], stone, true);
    for (const dx of [-.6, .6]) art.box([x + dx, gateY + 3.4, 165.95], [.22, 6.8, .19], bronze);
    art.box([x, gateY + 8.15, 169], [3.5, .3, 6.3], pale, true);
  }
  art.box([0, gateY + 8, 169], [18.4, 1.5, 5.8], pale, true);
  art.box([0, gateY - .15, 169], [13.5, .3, 3.5], dark);
  for (const x of [-6.6, 6.6]) art.box([x, gateY + 2.7, 169], [.18, 5.4, 2], dark);
  // The old royal monument rises above the aperture. It is architecture,
  // separate from the living Ozymandias and from the Tide-Eater's hit targets.
  art.box([0, gateY + 12.5, 173], [8, 7.5, 5.8], stone, true);
  art.box([0, gateY + 17.4, 173], [3.7, 3.7, 3.5], pale);
  for (const side of [-1, 1]) {
    art.box([side * 2.15, gateY + 17.2, 173], [1.1, 5, 4.1], blue);
    for (let i = 0; i < 8; i++) art.box([side * 2.15, gateY + 15.3 + i * .48, 170.93], [1.12, .14, .1], bronze);
    art.box([side * .8, gateY + 17.65, 171.22], [.55, .16, .09], dark);
    art.beam([side * 3.5, gateY + 14.5, 172], [side * 6.3, gateY + 10.3, 168], 1.5, stone);
    art.box([side * 5.4, gateY + 9.2, 168], [2.7, 1.2, 4.1], pale);
  }
  art.box([0, gateY + 16.5, 171.05], [.4, 1.8, .55], bronze);
  art.ring([0, gateY + 21, 173], 3.5, .22, bronze);
  for (let i = 0; i < 11; i++) {
    const angle = i / 10 * Math.PI;
    art.beam([Math.cos(angle) * 3.5, gateY + 21 + Math.sin(angle) * 3.5, 173],
      [Math.cos(angle) * 4.3, gateY + 21 + Math.sin(angle) * 4.3, 173], .13, bronze);
  }
  // Maintenance gallery behind the gate has open stone bays. It rejoins both
  // banks, so a closed gate or an encounter retry cannot trap the player.
  for (const x of [-15, -6, 6, 18]) {
    art.box([x, high + 2.6, 187], [.7, 5.2, .7], stone, true);
    art.box([x, high + 5.35, 187], [1.2, .3, 1.2], pale);
  }
  art.box([1.5, high + 5.7, 185.7], [38, .6, 5], pale, true);
  // The overflow is a real cut in the terrain, with a continuously descending
  // bed. Its intake is upstream of the central leaf; its outlet rejoins the
  // river below the stilling pool. Both pedestrian crossings stay above it.
  const waterVertices: number[] = [];
  for (let i = 1; i < EGYPT_OVERFLOW.length; i++) {
    const a = new THREE.Vector3(...EGYPT_OVERFLOW[i - 1]), b = new THREE.Vector3(...EGYPT_OVERFLOW[i]);
    // The broad pool owns the water surface between its two mouths.
    if (i === 5) continue;
    const direction = b.clone().sub(a), run = Math.hypot(direction.x, direction.z), side = new THREE.Vector3(direction.z / run, 0, -direction.x / run);
    const corners = [a.clone().addScaledVector(side, -2), a.clone().addScaledVector(side, 2), b.clone().addScaledVector(side, 2), b.clone().addScaledVector(side, -2)];
    for (const vertex of [0, 2, 1, 0, 3, 2]) waterVertices.push(...corners[vertex].toArray());
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.atan2(direction.y, run), Math.atan2(direction.x, direction.z), 0, 'YXZ'));
    const e = new THREE.Euler().setFromQuaternion(q), rotation: Point = [e.x, e.y, e.z];
    const mid = a.clone().lerp(b, .5);
    art.box([mid.x, mid.y - .85, mid.z], [4.8, .25, direction.length() + .12], dark, false, 'body', rotation);
    for (const s of [-1, 1]) {
      const p = mid.clone().addScaledVector(side, s * 2.35);
      art.box([p.x, p.y - .1, p.z], [.55, 1.55, direction.length() + .16], stone, true, 'body', rotation);
      art.box([p.x, p.y + .72, p.z], [.72, .16, direction.length() + .18], pale, false, 'body', rotation);
    }
  }
  const basin = EGYPT_STILLING_BASIN, basinY = basin.floor;
  art.box([basin.x, basinY - .15, basin.z], [basin.width, .3, basin.depth], stone, true);
  for (const x of [basin.x - 7, basin.x + 7]) art.box([x, basinY + .95, basin.z], [.7, 1.9, basin.depth], pale, true);
  // Open intake/outlet slots, rather than a wall across either channel.
  for (const z of [191, 205]) for (const x of [61.95, 72.05]) art.box([x, basinY + .95, z], [4.6, 1.9, .7], pale, true);
  for (const z of [195, 199]) for (const x of [63, 67, 71]) art.box([x, basinY + .55, z], [1.15, 1.1, 1.55], dark, true);
  for (const [x, z] of [[60.2, 191.8], [73.8, 204.2]]) {
    art.box([x, basinY + 1.2, z], [.16, 2.4, .28], bronze);
    for (let n = 0; n < 6; n++) art.box([x - .12, basinY + .25 + n * .35, z], [.35, .06, .31], pale);
  }
  landscapeWalkway(art, [[51, 12.5, 192], [56, 9, 204], [56, 6.7, 216], [67, 6.7, 216]],
    { width: 3.2, floor: stone, edge: bronze, steps: true, rails: true, supports: floor });
  // A work platform at the bypass inlet keeps the handwheel visibly separate
  // from the central gate machinery and clear of the combat control sockets.
  landscapeWalkway(art, [[23, high, 150], [35, 17.3, 150], [40, 13, 163]],
    { width: 2.8, floor: stone, edge: bronze, steps: true, rails: true, supports: floor });
  art.box([40, 12.85, 163], [4.2, .3, 3.6], pale, true);
  art.cyl([41.1, 13.6, 163.4], .18, 1.3, bronze, true);
  art.ring([41.1, 14.35, 163.4], .65, .09, bronze, 'metal', [Math.PI / 2, 0, 0]);
  // Each wing has its own dry receiving slot. A short cross-route on the
  // fallen stone rejoins the high bank, clear of the central flow aperture.
  const wingHingeY = high - 1.05, wingLength = 14;
  for (const side of [-1, 1]) {
    const cx = side * 16.5, bottom = Math.min(floor(cx, 169), floor(side * 22, 169)) - .2;
    art.box([cx, (bottom + wingHingeY - 1.1) / 2, 169], [14.7, wingHingeY - 1.1 - bottom, 4.7], stone, true);
    for (const z of [166.85, 171.15]) art.box([cx, wingHingeY - .8, z], [14.7, .65, .32], bronze);
    for (const z of [166.6, 171.4]) {
      for (const y of [high + .5, high + 1.05]) art.box([cx, y, z], [14.7, .12, .12], bronze, true);
      for (let i = 0; i < 5; i++) art.box([side * (10.5 + i * 3), high + .52, z], [.14, 1.05, .14], bronze, true);
    }
    for (const y of [high + .5, high + 1.05]) art.box([side * 9.25, y, 169], [.12, .12, 4.8], bronze, true);
    for (let i = 0; i < 5; i++) art.box([side * (10.8 + i * 2.6), wingHingeY - .6, 166.6], [.1, 1, .08], dark);
    art.cyl([side * 9.5, wingHingeY, 169], .62, 4.7, bronze, false, 'metal', [Math.PI / 2, 0, 0]);
  }
  art.relocate(frame);
  const fixed = mergeParts(art.solids); art.solids.forEach(g => g.dispose());
  const collision: Collider = { name: 'COL_EgyptConfluenceHighBanks', bvh: new MeshBVH(fixed), enabled: true };
  art.finish('alpha'); art.root.name = 'EgyptConfluenceHighBanks';
  const wingGeometries: THREE.BufferGeometry[] = [];
  const wings = [-1, 1].map(side => {
    const wingArt = new SiteArt();
    wingArt.box([0, wingLength / 2, 0], [2.1, wingLength, 4], pale);
    for (const z of [-2.05, 2.05]) {
      wingArt.box([0, wingLength / 2, z], [1.4, wingLength - .8, .14], blue);
      for (let i = 0; i < 10; i++) wingArt.box([0, 1.1 + i * 1.18, z + Math.sign(z) * .09], [1.65, .16, .12], bronze);
      wingArt.ring([0, 11.6, z + Math.sign(z) * .18], .62, .09, bronze);
    }
    wingArt.finish('alpha'); wingArt.root.name = side < 0 ? 'EgyptWestFallingWing' : 'EgyptEastFallingWing';
    wingArt.root.position.set(side * 9.5, wingHingeY, 169); art.root.add(wingArt.root);
    const standingGeometry = new THREE.BoxGeometry(2.1, wingLength, 4).translate(side * 9.5, wingHingeY + wingLength / 2, 169).applyMatrix4(frame);
    const landedGeometry = new THREE.BoxGeometry(wingLength, 2.1, 4).translate(side * 16.5, wingHingeY, 169).applyMatrix4(frame);
    const safetyGeometry = new THREE.BoxGeometry(.16, 1.15, 4.25).translate(side * 20.86, high + .575, 169).applyMatrix4(frame);
    wingGeometries.push(standingGeometry, landedGeometry, safetyGeometry);
    const standing: Collider = { name: `COL_EgyptWingStanding_${side}`, bvh: new MeshBVH(standingGeometry), enabled: true };
    const landed: Collider = { name: `COL_EgyptWingLanded_${side}`, bvh: new MeshBVH(landedGeometry), enabled: false };
    const safety: Collider = { name: `COL_EgyptWingSafety_${side}`, bvh: new MeshBVH(safetyGeometry), enabled: true };
    const safetyArt = new SiteArt();
    for (const z of [167, 171]) safetyArt.box([side * 20.86, high + .57, z], [.18, 1.15, .18], bronze);
    for (const y of [high + .5, high + 1.1]) safetyArt.box([side * 20.86, y, 169], [.14, .14, 4.2], bronze);
    safetyArt.finish('alpha'); safetyArt.root.name = 'EgyptWingReceivingSlotBarrier'; art.root.add(safetyArt.root);
    return { side, art: wingArt, safetyArt, standing, landed, safety, fall: 0 };
  });
  const overflowGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(waterVertices, 3));
  overflowGeometry.computeVertexNormals();
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#66b0bb', roughness: .3, metalness: .2, transparent: true, opacity: .84, side: THREE.DoubleSide });
  const overflowWater = new THREE.Mesh(overflowGeometry, waterMaterial); overflowWater.name = 'EgyptIndependentOverflowWater';
  const poolGeometry = new THREE.PlaneGeometry(13.3, 13.3).rotateX(-Math.PI / 2);
  const poolWater = new THREE.Mesh(poolGeometry, waterMaterial); poolWater.position.set(basin.x, basin.water, basin.z);
  art.root.add(overflowWater, poolWater);
  const material = new THREE.MeshStandardMaterial({ color: '#a18c66', roughness: .78, metalness: .12 });
  const gateGeometry = new THREE.BoxGeometry(12.9, 6, 1.2);
  const gate = new THREE.Mesh(gateGeometry, material); gate.name = 'EgyptCentralSinkingGate'; art.root.add(gate);
  gate.position.set(0, gateY + 3, 169); gate.castShadow = gate.receiveShadow = true;
  const blockerGeometry = gateGeometry.clone().translate(0, gateY + 3, 169).applyMatrix4(frame);
  const blocker: Collider = { name: 'COL_EgyptCentralSinkingGate', bvh: new MeshBVH(blockerGeometry), enabled: true };
  let open = false, wingsReleased = false, drop = 0, initialized = false;
  function poseWings() {
    for (const wing of wings) {
      wing.art.root.rotation.z = -wing.side * Math.PI / 2 * THREE.MathUtils.smoothstep(wing.fall, 0, 1);
      const settled = wing.fall >= .999;
      wing.standing.enabled = !settled; wing.landed.enabled = settled;
      wing.safety.enabled = wing.safetyArt.root.visible = !settled;
    }
  }
  const markerPosition = new THREE.Vector3(-23, high, 164).applyMatrix4(frame).toArray();
  const markers: Marker[] = [{ id: 'egypt_confluence_high_bank', type: 'poi', label: '汇水台 · 高岸检修环道', p: markerPosition }];
  return { root: art.root, colliders: [collision, blocker, ...wings.flatMap(w => [w.standing, w.landed, w.safety])], markers,
    apply(done: ReadonlySet<string>) {
      overflowWater.visible = poolWater.visible = done.has(JOURNEY.egyptWeir);
      open = done.has(climaxCleared('egypt'));
      wingsReleased = done.has(climaxCheckpoint('egypt', 0)) || open;
      if (!initialized) {
        drop = Number(open); for (const wing of wings) wing.fall = Number(wingsReleased); poseWings();
        initialized = true; gate.position.y = gateY + 3 - drop * 6.3; blocker.enabled = !open;
      }
    },
    update(dt: number, player: THREE.Vector3) {
      art.root.visible = Math.hypot(player.x, player.z + 1580) < 390;
      drop = THREE.MathUtils.damp(drop, Number(open), 3.4, Math.max(0, Math.min(.1, dt)));
      gate.position.y = gateY + 3 - drop * 6.3; blocker.enabled = drop < .985;
      if (wingsReleased) for (const wing of wings) wing.fall = Math.min(1, wing.fall + Math.max(0, Math.min(.1, dt)) / (wing.side < 0 ? 1.8 : 2.4));
      else for (const wing of wings) wing.fall = 0;
      poseWings();
    },
    dispose() {
      collision.enabled = blocker.enabled = false; fixed.dispose(); blockerGeometry.dispose(); gateGeometry.dispose(); material.dispose();
      overflowGeometry.dispose(); poolGeometry.dispose(); waterMaterial.dispose();
      wingGeometries.forEach(g => g.dispose());
      for (const wing of wings) {
        wing.standing.enabled = wing.landed.enabled = wing.safety.enabled = false;
        for (const part of [wing.art, wing.safetyArt]) { for (const mesh of part.layers.values()) mesh.geometry.dispose(); for (const m of Object.values(part.materials)) m.dispose(); }
      }
      for (const mesh of art.layers.values()) mesh.geometry.dispose(); for (const m of Object.values(art.materials)) m.dispose(); art.root.removeFromParent();
    },
  };
}
