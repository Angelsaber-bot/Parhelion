import * as THREE from 'three';
/**
 * 业火京都 Shinobi gear over the samurai kit: a soot-black face wrap, a crimson neck scarf whose
 * two tails trail behind, and a kunai bandolier across the chest. Visual only; one shared kit.
 */
export function createShinobiKit() {
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const wrap = g(new THREE.CylinderGeometry(.118, .125, .11, 20, 1, true, -Math.PI * .62, Math.PI * 1.24));
  const knot = g(new THREE.SphereGeometry(.04, 8, 6));
  const scarf = g(new THREE.TorusGeometry(.105, .032, 6, 18));
  const tail = g(new THREE.BoxGeometry(.075, .5, .012)); tail.translate(0, -.25, 0);
  const strap = g(new THREE.BoxGeometry(.06, .62, .02));
  const kunai = g(new THREE.ConeGeometry(.016, .13, 4)); kunai.rotateX(Math.PI);
  const ring = g(new THREE.TorusGeometry(.016, .005, 4, 8));
  const mats = {
    cloth: new THREE.MeshStandardMaterial({ name: 'ShinobiWrapSoot', color: 0x1b1c24, roughness: .9, side: THREE.DoubleSide }),
    scarf: new THREE.MeshStandardMaterial({ name: 'ShinobiScarfCrimson', color: 0x9c1f2a, roughness: .7, side: THREE.DoubleSide }),
    leather: new THREE.MeshStandardMaterial({ name: 'ShinobiStrap', color: 0x3a2a22, roughness: .85 }),
    steel: new THREE.MeshStandardMaterial({ name: 'ShinobiKunai', color: 0x9aa4ae, metalness: .85, roughness: .3 }),
  };
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  return {
    attach(actor: THREE.Object3D) {
      const head = actor.getObjectByName('head'), chest = actor.getObjectByName('chest'); if (!head || !chest) return null;
      const face = new THREE.Group(), body = new THREE.Group(); face.name = 'ShinobiFaceWrap'; body.name = 'ShinobiScarfAndBandolier';
      face.userData.visualOnly = body.userData.visualOnly = true;
      // Bind-pose root-space metres (model faces +Z).
      mesh(wrap, mats.cloth, face, 0, 1.585, .012);
      mesh(knot, mats.cloth, face, 0, 1.6, -.118);
      const s = mesh(scarf, mats.scarf, body, 0, 1.49, 0); s.rotation.x = Math.PI / 2; s.scale.set(1.15, 1.05, 1);
      for (const [x, rz, rx] of [[-.045, .12, .35], [.05, -.1, .5]] as const) { const t = mesh(tail, mats.scarf, body, x, 1.49, -.12); t.rotation.set(rx, 0, rz); }
      const band = mesh(strap, mats.leather, body, 0, 1.2, .14); band.rotation.set(-.08, 0, .72);
      for (let i = 0; i < 4; i++) { const k = mesh(kunai, mats.steel, body, -.13 + i * .07, 1.34 - i * .065, .16); k.rotation.z = .72; mesh(ring, mats.steel, body, -.13 + i * .07 + .045, 1.34 - i * .065 + .045, .16); }
      actor.add(face, body); actor.updateWorldMatrix(true, true); head.attach(face); chest.attach(body);
      return { remove() { face.removeFromParent(); body.removeFromParent(); } };
    },
    dispose() { geos.forEach(x => x.dispose()); Object.values(mats).forEach(m => m.dispose()); },
  };
}
