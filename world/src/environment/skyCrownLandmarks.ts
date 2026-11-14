import * as THREE from 'three';
import { SiteArt } from '../story/campaignSites';
import { SKY_APPROACH_DECKS } from './skyCrownApproach';

/** The Sky Crown's far-view identity from the finale design: a dark sun with a narrow bright rim at the
 * instrument's centre, a thick observation ring with one obvious gap, numbering running along the
 * structure, and warm low lights in the backlit maintenance layer. All visual; nothing here collides.
 * After the handover the sun's core warms and its rim widens. */
export function createSkyCrownLandmarks(instrument: [number, number, number] = [220, 264, 158]) {
  const root = new THREE.Group(); root.name = 'SkyCrownLandmarks';
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => { geometries.push(g); materials.push(m); const x = new THREE.Mesh(g, m); x.raycast = () => {}; root.add(x); return x; };
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x15161c, roughness: .9, emissive: 0x000000 });
  const core = mesh(new THREE.SphereGeometry(16, 40, 24), coreMat); core.position.set(...instrument); core.name = 'DarkSunCore';
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: .55, side: THREE.BackSide, depthWrite: false, fog: false });
  const rim = mesh(new THREE.SphereGeometry(17.1, 40, 24), rimMat); rim.position.set(...instrument); rim.name = 'DarkSunRim';
  // The observation ring: thick, nearly level (above every deck), open by ~50° toward the approach.
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xc9ccc8, roughness: .55, metalness: .35 });
  const ring = mesh(new THREE.TorusGeometry(74, 3.2, 14, 120, Math.PI * 2 - .9), ringMat); ring.name = 'ObservationRing';
  ring.position.set(...instrument); ring.rotation.set(Math.PI / 2 - .18, 0, 2.2);
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x6f7c80, roughness: .6, metalness: .5 });
  // Collars around the tube every 15°, each turned to the ring's tangent so they read as joints.
  const seamGeometry = new THREE.TorusGeometry(3.35, .35, 6, 18); geometries.push(seamGeometry);
  const Z = new THREE.Vector3(0, 0, 1), tangent = new THREE.Vector3();
  for (let i = 0; i < 24; i++) {
    const t = .1 + i / 23 * (Math.PI * 2 - 1.1), seam = new THREE.Mesh(seamGeometry, seamMat); seam.raycast = () => {};
    seam.position.set(Math.cos(t) * 74, Math.sin(t) * 74, 0); seam.quaternion.setFromUnitVectors(Z, tangent.set(-Math.sin(t), Math.cos(t), 0)); ring.add(seam);
  }
  materials.push(seamMat);
  // Numbering and warm duty lights on the decks themselves.
  const art = new SiteArt(), lamp = '#ffc983', plate = '#d8d2c2', ink = '#2f3438';
  const decks = Object.values(SKY_APPROACH_DECKS);
  decks.forEach((d, n) => {
    for (const side of [-1, 1]) {
      const px = d.p[0] + side * (d.w / 2 - .6), pz = d.p[2] - d.d / 2 + .5;
      art.box([px, d.p[1] + 1.6, pz], [1.6, .9, .06], plate);
      for (let k = 0; k <= n; k++) art.box([px - .6 + (k % 6) * .24, d.p[1] + 1.82 - Math.floor(k / 6) * .3, pz + .04], [.12, .22, .02], ink);
    }
  });
  for (const key of ['service', 'archive'] as const) {
    const d = SKY_APPROACH_DECKS[key];
    for (let x = -d.w / 2 + 3; x <= d.w / 2 - 3; x += 6) for (const side of [-1, 1]) {
      art.box([d.p[0] + x, d.p[1] + .9, d.p[2] + side * (d.d / 2 - .4)], [.18, 1.8, .18], '#4b4f52');
      art.box([d.p[0] + x, d.p[1] + 1.85, d.p[2] + side * (d.d / 2 - .4)], [.34, .24, .34], lamp, false, 'glow');
    }
  }
  art.finish('alpha'); art.root.name = 'SkyCrownNumberingAndDutyLights'; root.add(art.root);
  let lastState = -1;
  return {
    root,
    apply(handedOver: boolean) {
      const state = handedOver ? 1 : 0; if (state === lastState) return; lastState = state;
      coreMat.color.setHex(handedOver ? 0x7a5a2a : 0x15161c); coreMat.emissive.setHex(handedOver ? 0x5a3a10 : 0x000000);
      rim.scale.setScalar(handedOver ? 1.06 : 1); rimMat.opacity = handedOver ? .7 : .55;
    },
    dispose() { root.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
  };
}
