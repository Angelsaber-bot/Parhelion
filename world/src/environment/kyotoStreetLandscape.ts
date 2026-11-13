import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { KYOTO_STREET as K, kyotoCargoDown, kyotoStreetPoint as P, kyotoStreetActive } from '../story/kyotoStreetWorks';
import { KYOTO_WITNESS as Y } from '../story/kyotoWitness';

export const KYOTO_MAP_WORK = { roof: 'map_kyoto_paper_roof_repaired', grain: 'map_kyoto_granary_handed_over' } as const;
export function kyotoStreetPhase(done: ReadonlySet<string>): 'peace' | 'sealed' | 'fire' | 'repair' {
  return done.has('fire_core') || done.has('musashi_contract') ? 'repair' : done.has(Y.reel) ? 'fire'
    : done.has(K.letter) ? 'sealed' : 'peace';
}

/** Bridge cargo, indestructible document case and two independently cleared
 * public entrances. All authored positions use the generated Kyoto frame. */
export function createKyotoStreetLandscape(ground: (x: number, z: number, ceiling: number) => number | null) {
  const root = new THREE.Group(); root.name = 'KyotoStreetAndCheckpoints';
  const art = new SiteArt(), wood = '#826249', dark = '#493c34', rope = '#b6a17c';
  const floor = (x: number, z: number, ceiling: number) => { const p = P(x, 0, z); return ground(p[0], p[2], ceiling) ?? ceiling - 2; };
  const resources: THREE.BufferGeometry[] = [], arts: SiteArt[] = [art], colliders: Collider[] = [];
  const markers: Marker[] = [
    { id: KYOTO_MAP_WORK.roof, type: 'interact', label: '纸铺外廊 · 补回烧毁的屋瓦', p: P(177, 7.25, 58.2), radius: 2.3 },
    { id: KYOTO_MAP_WORK.grain, type: 'interact', label: '粮仓交接台 · 封存钥匙并开放民粮', p: P(-93, 5.6, 81), radius: 2.3 },
  ];
  function solid(a: SiteArt, name: string) {
    a.finish('kyoto'); root.add(a.root);
    const geo = mergeParts(a.solids); a.solids.forEach(g => g.dispose()); a.solids.length = 0; resources.push(geo);
    const collider: Collider = { name, bvh: new MeshBVH(geo), enabled: true }; colliders.push(collider); return { collider, geo };
  }
  // The east case is independent of the suspended crates and never a weapon target.
  art.box(P(174, 5.64, -77), [1.6, .88, .85], wood, true);
  art.box(P(174, 6.11, -77), [1.7, .08, .95], '#d8c49a');
  art.paper(...P(174, 6.17, -77), .94, .55);
  for (const x of [173.4, 174.6]) art.box(P(x, 5.65, -77), [.07, .9, .9], '#667474');
  art.box(P(134, 5.75, -77), [1.4, 1.1, .8], dark, true);
  art.ring(P(134, 6.45, -76.5), .4, .07, '#bb995b');
  // Low-profile receipt stand in the temple's outer court, away from the main hall.
  art.box(P(-93, 5.03, 79.8), [2.4, .86, 1.25], dark, true);
  art.paper(...P(-93, 5.48, 79.8), 1.3, .85);
  art.paper(...P(-235.6, 14.96, 168), 1.1, .75);
  const cargo = [[142, -76.45], [164, -73.55]].map(([x, z], index) => {
    const a = new SiteArt(); arts.push(a);
    a.box(P(x, 5.96, z), [2.6, 1.52, 1.5], wood, true);
    for (const dy of [-.53, .53]) a.box(P(x, 5.96 + dy, z), [2.67, .12, 1.57], dark);
    for (const dx of [-.85, .85]) a.box(P(x + dx, 5.96, z), [.09, 1.58, 1.58], rope);
    for (const dx of [-1.9, 1.9]) {
      const postZ = z < -75 ? -77.65 : -72.35;
      art.box(P(x + dx, 8.1, postZ), [.2, 5.8, .2], dark, true);
      art.beam(P(x + dx, 10.9, postZ), P(x + dx, 10.9, z), .24, dark);
      art.beam(P(x + dx, 9.95, postZ), P(x + dx, 10.85, z), .13, wood);
    }
    art.beam(P(x - 2, 10.9, z), P(x + 2, 10.9, z), .28, dark);
    const { collider, geo } = solid(a, `COL_KyotoHangingCargo_${index}`);
    const positions = geo.getAttribute('position') as THREE.BufferAttribute;
    const base = Float32Array.from(positions.array);
    return { x, z, art: a, collider, geo, positions, base };
  });
  const gates = [
    { x: -55, z: 45, y: 4.6, width: 6.3, permit: K.templePermit, alert: K.templeAlert },
    { x: -217, z: 168, y: floor(-217, 168, 16), width: 7.5, permit: K.campPermit, alert: K.campAlert },
  ].map(spec => {
    const a = new SiteArt(); arts.push(a);
    for (const h of [.55, 1.15]) a.box(P(spec.x, spec.y + h, spec.z), [.2, .16, spec.width], wood, true);
    for (const sign of [-1, 1]) art.box(P(spec.x, spec.y + .75, spec.z + sign * spec.width / 2), [.24, 1.5, .24], dark, true);
    const { collider } = solid(a, `COL_KyotoCheckpoint_${spec.permit}`);
    const signal = new THREE.Mesh(new THREE.BoxGeometry(.7, .7, .14), new THREE.MeshStandardMaterial({ color: '#c4baa0' }));
    signal.position.fromArray(P(spec.x + .3, spec.y + 1.95, spec.z + spec.width / 2)); signal.rotation.y = Math.PI / 2; root.add(signal);
    return { ...spec, art: a, collider, signal };
  });
  solid(art, 'COL_KyotoStreetFixtures');
  const pinMaterial = new THREE.MeshStandardMaterial({ color: '#e2bd68', metalness: .5, roughness: .4 });
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .7, 10), pinMaterial);
  pin.position.fromArray(P(134, 6.6, -76.4)); pin.rotation.z = Math.PI / 2; pin.userData.target = K.pin; root.add(pin);
  const sheets = new THREE.Group(); root.add(sheets);
  const sheetMaterial = new THREE.MeshStandardMaterial({ color: '#a6a8a0', side: THREE.DoubleSide });
  for (let n = 0; n < 4; n++) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(.55, 1.25), sheetMaterial); sheet.position.fromArray(P(173.8 + n * .75, 7.58, 55.02)); sheets.add(sheet);
  }
  const cableMaterial = new THREE.MeshStandardMaterial({ color: rope });
  const cables = cargo.map(({ x, z }) => {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1, 6), cableMaterial); cable.position.fromArray(P(x, 9, z)); root.add(cable); return cable;
  });
  const repair = new SiteArt(); arts.push(repair);
  // Repair stock remains at the outside edge of the drying gallery. Neither
  // through doorway is filled with rubble or a newly spawned crate.
  for (let i = 0; i < 7; i++) repair.box(P(173, 6.3 + i * .1, 59.6), [1.3, .08, .8], '#758080');
  for (const x of [180, 188]) {
    repair.box(P(x, 9.35, 49.75), [.07, .8, .8], '#d3c7a5');
    repair.box(P(x, 9.4, 49.7), [.09, .36, .62], '#747e88');
  }
  repair.finish('kyoto'); root.add(repair.root);
  const ordinary = new SiteArt(); arts.push(ordinary);
  for (const x of [180, 188]) {
    ordinary.box(P(x, 9.1, 49.75), [3.5, .5, .055], '#7d9390');
    for (let n = 0; n < 6; n++) ordinary.box(P(x - 1.45 + n * .58, 8.98, 49.7), [.018, .62, .025], '#e3d7b5');
  }
  ordinary.finish('kyoto'); root.add(ordinary.root);
  const sealedSigns = new SiteArt(); arts.push(sealedSigns);
  for (const x of [180, 188]) {
    sealedSigns.box(P(x, 8.4, 49.7), [.7, 1.2, .06], '#dfceb1');
    for (let n = 0; n < 5; n++) sealedSigns.box(P(x, 8.82 - n * .2, 49.66), [.35, .04, .025], '#594c40');
    sealedSigns.box(P(x, 7.98, 49.65), [.22, .18, .03], '#9b5147');
  }
  sealedSigns.finish('kyoto'); root.add(sealedSigns.root);
  const handover = new SiteArt(); arts.push(handover);
  handover.box(P(-93.4, 5.55, 79.8), [.7, .14, .45], '#695540');
  for (const x of [-93.6, -93.2]) handover.ring(P(x, 5.65, 79.8), .09, .025, '#b6a16b', 'metal', [Math.PI / 2, 0, 0]);
  for (const [x, color] of [[-94.5, '#647c91'], [-91.6, '#ac8553']] as const) {
    handover.box(P(x, 5.04, 79.75), [.7, .8, .65], color);
    handover.paper(...P(x, 5.49, 79.75), .6, .5);
  }
  handover.finish('kyoto'); root.add(handover.root);
  const pantry = new SiteArt(); arts.push(pantry);
  for (const x of [-91, -89.8]) for (const z of [77.8, 78.8]) {
    pantry.cyl(P(x, 5.04, z), .42, .88, '#b5a17e');
    pantry.ring(P(x, 5.38, z), .39, .04, '#78644e', 'body', [Math.PI / 2, 0, 0]);
  }
  pantry.finish('kyoto'); root.add(pantry.root);
  let progress = 0, initialized = false, lastOffset = NaN, previous: THREE.Vector3 | null = null;
  const inside = (p: THREE.Vector3, bounds: readonly number[]) => {
    const x = 720 - p.x, z = -1440 - p.z;
    return x > bounds[0] && x < bounds[1] && z > bounds[2] && z < bounds[3] && p.y > bounds[4] - 1 && p.y < bounds[4] + 4;
  };
  return {
    root, colliders, targets: [pin], markers,
    enteredWithoutPermit(player: THREE.Vector3, playable: boolean, done: ReadonlySet<string>): string | null {
      const before = previous; previous = player.clone();
      if (!playable || !before || before.distanceTo(player) > 8 || !kyotoStreetActive(done) || done.has('fire_core') || done.has('musashi_contract')) return null;
      for (const [bounds, permit, alert] of [
        [[-145, -55, 0, 90, 4.6], K.templePermit, K.templeAlert],
        [[-247, -217, 157, 179, 14], K.campPermit, K.campAlert],
      ] as const) if (!done.has(permit) && !done.has(alert) && !inside(before, bounds) && inside(player, bounds)) return alert;
      return null;
    },
    apply(done: ReadonlySet<string>, dt: number, player?: THREE.Vector3) {
      const phase = kyotoStreetPhase(done);
      ordinary.root.visible = phase === 'peace' || phase === 'repair';
      sealedSigns.root.visible = phase === 'sealed';
      repair.root.visible = phase === 'repair' && done.has(Y.reel);
      handover.root.visible = done.has(Y.public) || done.has(Y.private);
      pantry.root.visible = done.has(KYOTO_MAP_WORK.grain);
      const lowered = kyotoCargoDown(done);
      if (!initialized || !lowered) progress = Number(lowered);
      // Stop above an occupied landing zone. Cargo cannot materialize through a player.
      const occupied = player && cargo.some(c => { const p = P(c.x, 5.2, c.z); return Math.abs(player.x - p[0]) < 1.75 && Math.abs(player.z - p[2]) < 1.2 && player.y < 5.2 + 1.52 + (1 - progress) * 3.2 && player.y > 3; });
      if (initialized && lowered && !occupied && dt > 0) progress = Math.min(1, progress + Math.min(dt, .05) / 3);
      initialized = true;
      const offset = (1 - progress) * 3.2;
      if (offset !== lastOffset) {
        for (const c of cargo) {
          c.art.root.position.y = offset;
          for (let n = 0; n < c.positions.count; n++) c.positions.setY(n, c.base[n * 3 + 1] + offset);
          c.positions.needsUpdate = true; c.geo.computeBoundingBox(); c.geo.computeBoundingSphere(); c.collider.bvh.refit();
        }
        lastOffset = offset;
      }
      for (const cable of cables) { const bottom = 6.72 + offset; cable.position.y = (10.85 + bottom) / 2; cable.scale.y = Math.max(.1, 10.85 - bottom); }
      pin.visible = !lowered;
      sheetMaterial.color.set(done.has(K.dry) ? '#eee5cb' : '#a6a8a0');
      const legacy = !kyotoStreetActive(done) || done.has('fire_core') || done.has('musashi_contract');
      for (const gate of gates) {
        gate.art.root.visible = gate.collider.enabled = !legacy && !done.has(gate.permit);
        gate.signal.material.color.set(done.has(gate.alert) ? '#a94c3b' : done.has(gate.permit) ? '#82a892' : '#c4baa0');
      }
      root.updateMatrixWorld(true);
    },
    dispose() {
      colliders.forEach(c => { c.enabled = false; }); resources.forEach(g => g.dispose());
      for (const a of arts) { for (const layer of a.layers.values()) layer.geometry.dispose(); for (const material of Object.values(a.materials)) material.dispose(); }
      for (const gate of gates) { gate.signal.geometry.dispose(); gate.signal.material.dispose(); }
      sheets.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      cables.forEach(c => c.geometry.dispose()); pin.geometry.dispose(); pinMaterial.dispose(); sheetMaterial.dispose(); cableMaterial.dispose(); root.removeFromParent();
    },
  };
}
