import * as THREE from 'three';
/**
 * Gear kits that tell the remaining wilderness roles apart at a glance, layered over the shared
 * enemy kits the same way the shield, shinobi, powder and jaeger kits are:
 *   bombardier — a grenado bandolier with fused shells and a smouldering slow-match coil
 *   breaker    — heavy pauldrons, a reinforced gorget and a brow visor
 * Visual only; the simulation decides every behaviour. One shared kit per EnemyVisuals.
 */
type Rot = [number, number, number];
const place = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number, rot: Rot = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(...rot); m.castShadow = true; parent.add(m); return m;
};

export function createBombardierKit() {
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const belt = g(new THREE.BoxGeometry(.07, .6, .022));
  const beltEdge = g(new THREE.BoxGeometry(.082, .6, .01));
  const shell = g(new THREE.SphereGeometry(.047, 12, 9));
  const collar = g(new THREE.CylinderGeometry(.016, .02, .022, 8));
  const fuse = g(new THREE.CylinderGeometry(.005, .005, .045, 5));
  const coil = g(new THREE.TorusGeometry(.045, .008, 6, 16));
  const ember = g(new THREE.SphereGeometry(.014, 8, 6));
  const mats = {
    leather: new THREE.MeshStandardMaterial({ name: 'BombardierBelt', color: 0x4a3222, roughness: .9 }),
    stitch: new THREE.MeshStandardMaterial({ name: 'BombardierBeltEdge', color: 0x6b5138, roughness: .92 }),
    iron: new THREE.MeshStandardMaterial({ name: 'BombardierShell', color: 0x2f3338, metalness: .62, roughness: .5 }),
    brass: new THREE.MeshStandardMaterial({ name: 'BombardierShellCollar', color: 0xa98a3f, metalness: .75, roughness: .36 }),
    cord: new THREE.MeshStandardMaterial({ name: 'BombardierMatch', color: 0xcdbb92, roughness: .95 }),
    ember: new THREE.MeshBasicMaterial({ name: 'BombardierEmber', color: 0xff7a3c }),
  };
  return {
    attach(actor: THREE.Object3D) {
      const chest = actor.getObjectByName('chest'); if (!chest) return null;
      const root = new THREE.Group(); root.name = 'BombardierGrenadoBelt'; root.userData.visualOnly = true;
      place(beltEdge, mats.stitch, root, 0, 1.21, .128, [-.06, 0, -.66]);
      place(belt, mats.leather, root, 0, 1.21, .136, [-.06, 0, -.66]);
      for (let i = 0; i < 3; i++) {
        const x = .13 - i * .075, y = 1.33 - i * .07;
        place(shell, mats.iron, root, x, y, .165);
        place(collar, mats.brass, root, x + .022, y + .042, .165, [0, 0, -.5]);
        place(fuse, mats.cord, root, x + .034, y + .07, .165, [0, 0, -.7]);
      }
      const glow = place(ember, mats.ember, root, -.172, 1.1, .12); glow.userData.dynamic = true;
      place(coil, mats.cord, root, -.15, 1.11, .115, [Math.PI / 2, .3, 0]);
      actor.add(root); actor.updateWorldMatrix(true, true); chest.attach(root);
      return {
        remove() { root.removeFromParent(); },
        update(_e: { mode: string }, t: number) { glow.scale.setScalar(.85 + Math.sin(t * 6) * .25); },
      };
    },
    dispose() { geos.forEach(x => x.dispose()); Object.values(mats).forEach(m => m.dispose()); },
  };
}

export function createBreakerKit() {
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const pauldron = g(new THREE.SphereGeometry(.115, 14, 10, 0, Math.PI * 2, 0, Math.PI * .56));
  const lame = g(new THREE.TorusGeometry(.1, .018, 6, 16, Math.PI));
  const spike = g(new THREE.ConeGeometry(.022, .07, 6));
  const gorget = g(new THREE.TorusGeometry(.112, .028, 8, 20)); gorget.rotateX(Math.PI / 2);
  const visor = g(new THREE.BoxGeometry(.175, .026, .034));
  const nasal = g(new THREE.BoxGeometry(.028, .085, .03));
  const bolt = g(new THREE.SphereGeometry(.011, 6, 5));
  const mats = {
    plate: new THREE.MeshStandardMaterial({ name: 'BreakerPlate', color: 0x5a5f68, metalness: .78, roughness: .38 }),
    plateDark: new THREE.MeshStandardMaterial({ name: 'BreakerPlateShade', color: 0x3c414a, metalness: .7, roughness: .5 }),
    trim: new THREE.MeshStandardMaterial({ name: 'BreakerTrim', color: 0xa8873f, metalness: .78, roughness: .34 }),
  };
  return {
    attach(actor: THREE.Object3D) {
      const chest = actor.getObjectByName('chest'), head = actor.getObjectByName('head'); if (!chest) return null;
      const body = new THREE.Group(), face = new THREE.Group();
      body.name = 'BreakerPauldrons'; face.name = 'BreakerVisor';
      body.userData.visualOnly = face.userData.visualOnly = true;
      for (const sign of [-1, 1]) {
        place(pauldron, mats.plate, body, sign * .205, 1.42, 0);
        place(lame, mats.plateDark, body, sign * .205, 1.372, 0, [Math.PI / 2, 0, 0]);
        place(lame, mats.plateDark, body, sign * .205, 1.33, 0, [Math.PI / 2, 0, 0]).scale.setScalar(.9);
        place(spike, mats.trim, body, sign * .238, 1.5, 0, [0, 0, sign * .5]);
        for (let i = 0; i < 3; i++) place(bolt, mats.trim, body, sign * .205 + (i - 1) * .055, 1.468, .055);
      }
      place(gorget, mats.plate, body, 0, 1.46, 0);
      place(gorget, mats.trim, body, 0, 1.432, 0).scale.setScalar(.93);
      // A brow bar with a nasal, set on the helmet rather than across the mouth.
      if (head) { place(visor, mats.plateDark, face, 0, 1.676, .092); place(visor, mats.trim, face, 0, 1.693, .088).scale.set(.9, .35, .85); place(nasal, mats.plateDark, face, 0, 1.638, .1); }
      actor.add(body); actor.updateWorldMatrix(true, true); chest.attach(body);
      if (head) { actor.add(face); actor.updateWorldMatrix(true, true); head.attach(face); }
      return { remove() { body.removeFromParent(); face.removeFromParent(); } };
    },
    dispose() { geos.forEach(x => x.dispose()); Object.values(mats).forEach(m => m.dispose()); },
  };
}
