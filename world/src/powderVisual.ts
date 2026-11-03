import * as THREE from 'three';
/** 黑帆尽头 Powder Monkey: a banded powder keg hugged to the chest; the fuse sparks during the windup. */
export function createPowderKit() {
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const keg = g(new THREE.LatheGeometry([[0, -.2], [.15, -.2], [.18, -.1], [.19, 0], [.18, .1], [.15, .2], [0, .2]].map(([x, y]) => new THREE.Vector2(x, y)), 14));
  const band = g(new THREE.TorusGeometry(.183, .012, 4, 16)); band.rotateX(Math.PI / 2);
  const fuse = g(new THREE.CylinderGeometry(.008, .008, .14, 5));
  const spark = g(new THREE.SphereGeometry(.03, 6, 4));
  const mats = {
    wood: new THREE.MeshStandardMaterial({ name: 'PowderKegWood', color: 0x7a4f2c, roughness: .8 }),
    iron: new THREE.MeshStandardMaterial({ name: 'PowderKegIron', color: 0x3a3b3e, metalness: .7, roughness: .4 }),
    fuse: new THREE.MeshStandardMaterial({ name: 'PowderKegFuse', color: 0xd8c79a, roughness: .9 }),
    spark: new THREE.MeshBasicMaterial({ name: 'PowderKegSpark', color: 0xffb347 }),
  };
  return {
    attach(actor: THREE.Object3D) {
      const chest = actor.getObjectByName('chest'); if (!chest) return null;
      const root = new THREE.Group(); root.name = 'PowderKeg'; root.userData.visualOnly = true;
      const k = new THREE.Mesh(keg, mats.wood); root.add(k);
      for (const y of [-.12, .12]) { const b = new THREE.Mesh(band, mats.iron); b.position.y = y; root.add(b); }
      const f = new THREE.Mesh(fuse, mats.fuse); f.position.set(.05, .26, 0); f.rotation.z = -.4; root.add(f);
      const sp = new THREE.Mesh(spark, mats.spark); sp.position.set(.08, .33, 0); sp.visible = false; root.add(sp);
      root.scale.setScalar(.82); root.position.set(0, 1.0, .27);
      actor.add(root); actor.updateWorldMatrix(true, true); chest.attach(root);
      return { remove() { root.removeFromParent(); }, update(e: { mode: string }, t: number) { sp.visible = e.mode === 'windup'; if (sp.visible) sp.scale.setScalar(1 + Math.sin(t * 40) * .4); } };
    },
    dispose() { geos.forEach(x => x.dispose()); Object.values(mats).forEach(m => m.dispose()); },
  };
}
