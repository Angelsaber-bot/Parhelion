import * as THREE from 'three';
/**
 * 黑帆尽头 Powder Monkey: a coopered powder keg hugged to the chest. Built from overlapping staves
 * over a solid core, two proud riveted iron hoops, a tarred lid with a bung, a rope sling over the
 * shoulder and a coiled fuse that sparks while the carrier is winding up. Visual only; one shared kit.
 */
export function createPowderKit() {
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const STAVES = 12;
  const stave = g(new THREE.BoxGeometry(.088, .40, .034));
  const core = g(new THREE.CylinderGeometry(.142, .142, .40, 20));
  const lid = g(new THREE.CylinderGeometry(.158, .158, .024, 22));
  const bung = g(new THREE.CylinderGeometry(.03, .034, .028, 10));
  const hoop = g(new THREE.TorusGeometry(.198, .013, 8, 28)); hoop.rotateX(Math.PI / 2);
  const rivet = g(new THREE.SphereGeometry(.009, 6, 5));
  const rope = g(new THREE.TorusGeometry(.2, .014, 6, 22));
  const fuse = g(new THREE.TorusGeometry(.03, .006, 5, 14));
  const fuseEnd = g(new THREE.CylinderGeometry(.006, .006, .11, 5));
  const spark = g(new THREE.SphereGeometry(.026, 8, 6));
  const mats = {
    wood: new THREE.MeshStandardMaterial({ name: 'PowderKegWood', color: 0x7a4f2c, roughness: .82 }),
    woodDark: new THREE.MeshStandardMaterial({ name: 'PowderKegWoodDark', color: 0x5d3a20, roughness: .88 }),
    tar: new THREE.MeshStandardMaterial({ name: 'PowderKegLidTar', color: 0x3b2c20, roughness: .95 }),
    iron: new THREE.MeshStandardMaterial({ name: 'PowderKegIron', color: 0x3a3b3e, metalness: .72, roughness: .42 }),
    ironBright: new THREE.MeshStandardMaterial({ name: 'PowderKegRivet', color: 0x8b9099, metalness: .8, roughness: .35 }),
    rope: new THREE.MeshStandardMaterial({ name: 'PowderKegRope', color: 0xa38a5c, roughness: .95 }),
    fuse: new THREE.MeshStandardMaterial({ name: 'PowderKegFuse', color: 0xd8c79a, roughness: .9 }),
    spark: new THREE.MeshBasicMaterial({ name: 'PowderKegSpark', color: 0xffb347 }),
  };
  return {
    attach(actor: THREE.Object3D) {
      const chest = actor.getObjectByName('chest'); if (!chest) return null;
      const root = new THREE.Group(); root.name = 'PowderKeg'; root.userData.visualOnly = true;
      const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0]) => {
        const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(...rot); m.castShadow = true; root.add(m); return m;
      };
      // Coopered barrel: a solid core so no light leaks, faced with alternating light and dark staves.
      add(core, mats.woodDark, 0, 0, 0);
      for (let i = 0; i < STAVES; i++) {
        const a = i / STAVES * Math.PI * 2, r = .153;
        const m = add(stave, i % 3 === 0 ? mats.woodDark : mats.wood, Math.cos(a) * r, 0, Math.sin(a) * r, [0, -a, 0]);
        m.scale.set(1, 1, 1 + (i % 2) * .22);
      }
      add(lid, mats.tar, 0, .2, 0); add(lid, mats.tar, 0, -.2, 0);
      add(bung, mats.woodDark, .06, .212, .04);
      for (const y of [.115, -.115]) {
        add(hoop, mats.iron, 0, y, 0);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(rivet, mats.ironBright, Math.cos(a) * .203, y, Math.sin(a) * .203); }
      }
      add(rope, mats.rope, 0, .03, -.01, [.1, 0, .62]);
      const f = add(fuse, mats.fuse, .05, .225, .02, [.4, 0, 0]);
      const fe = add(fuseEnd, mats.fuse, .085, .27, .02, [0, 0, -.5]);
      const sp = add(spark, mats.spark, .115, .315, .02); sp.visible = false; sp.userData.dynamic = true;
      void f; void fe;
      root.scale.setScalar(.82); root.position.set(0, 1.0, .27);
      actor.add(root); actor.updateWorldMatrix(true, true); chest.attach(root);
      return {
        remove() { root.removeFromParent(); },
        update(e: { mode: string }, t: number) { sp.visible = e.mode === 'windup'; if (sp.visible) sp.scale.setScalar(1 + Math.sin(t * 40) * .4); },
      };
    },
    dispose() { geos.forEach(x => x.dispose()); Object.values(mats).forEach(m => m.dispose()); },
  };
}
