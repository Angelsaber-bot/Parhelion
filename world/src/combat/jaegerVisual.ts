import * as THREE from 'three';
/**
 * 永冬之城 Jäger Marksman gear over the musketeer kit, so the long-rifle sniper reads differently
 * from a line musketeer at a glance: a snow cape over the shoulders with a fur collar and a frost
 * dusting, a hood folded back behind the collar, a cartridge pouch with visible paper rounds and a powder horn.
 * Visual only; one shared kit per EnemyVisuals.
 */
export function createJaegerKit() {
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const cape = g(new THREE.CylinderGeometry(.145, .225, .3, 18, 1, true));
  const capeHem = g(new THREE.CylinderGeometry(.225, .236, .038, 18, 1, true));
  const collar = g(new THREE.TorusGeometry(.098, .034, 8, 20)); collar.rotateX(Math.PI / 2);
  const tuft = g(new THREE.SphereGeometry(.024, 8, 6));
  const hood = g(new THREE.SphereGeometry(.105, 14, 9, 0, Math.PI * 2, 0, Math.PI * .5));
  const hoodBack = g(new THREE.SphereGeometry(.112, 12, 9, 0, Math.PI, 0, Math.PI * .8));
  const pouch = g(new THREE.BoxGeometry(.13, .1, .07));
  const flap = g(new THREE.BoxGeometry(.136, .05, .076));
  const cartridge = g(new THREE.CylinderGeometry(.011, .011, .05, 6));
  const horn = g(new THREE.CylinderGeometry(.018, .042, .17, 10));
  const cap = g(new THREE.CylinderGeometry(.021, .021, .022, 8));
  const cord = g(new THREE.TorusGeometry(.112, .006, 5, 18));
  const mats = {
    snow: new THREE.MeshStandardMaterial({ name: 'JaegerSnowCape', color: 0xd8dde4, roughness: .88, side: THREE.DoubleSide }),
    snowShade: new THREE.MeshStandardMaterial({ name: 'JaegerCapeHem', color: 0xa8b2bd, roughness: .9, side: THREE.DoubleSide }),
    fur: new THREE.MeshStandardMaterial({ name: 'JaegerFurCollar', color: 0x6d6054, roughness: .96 }),
    furLight: new THREE.MeshStandardMaterial({ name: 'JaegerFurTuft', color: 0x8d8071, roughness: .98 }),
    leather: new THREE.MeshStandardMaterial({ name: 'JaegerPouch', color: 0x4b3627, roughness: .9 }),
    paper: new THREE.MeshStandardMaterial({ name: 'JaegerCartridge', color: 0xd9cdad, roughness: .92 }),
    brass: new THREE.MeshStandardMaterial({ name: 'JaegerHornCap', color: 0xb08b3e, metalness: .75, roughness: .35 }),
    hornBody: new THREE.MeshStandardMaterial({ name: 'JaegerPowderHorn', color: 0xcbb98f, roughness: .6 }),
  };
  return {
    attach(actor: THREE.Object3D) {
      const chest = actor.getObjectByName('chest'), head = actor.getObjectByName('head'); if (!chest) return null;
      const body = new THREE.Group(), hoodGroup = new THREE.Group();
      body.name = 'JaegerCape'; hoodGroup.name = 'JaegerHood';
      body.userData.visualOnly = hoodGroup.userData.visualOnly = true;
      const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0]) => {
        const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(...rot); m.castShadow = true; parent.add(m); return m;
      };
      // Bind-pose root-space metres (model faces +Z).
      add(cape, mats.snow, body, 0, 1.30, -.01);
      add(capeHem, mats.snowShade, body, 0, 1.152, -.01);
      add(cord, mats.leather, body, 0, 1.432, -.01, [Math.PI / 2, 0, 0]);
      add(collar, mats.fur, body, 0, 1.462, -.005);
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(tuft, mats.furLight, body, Math.cos(a) * .098, 1.472 + Math.sin(i) * .01, Math.sin(a) * .098); }
      // right hip: cartridge pouch with paper rounds standing in it, and a powder horn alongside
      add(pouch, mats.leather, body, -.17, 1.09, .085, [0, 0, .12]);
      add(flap, mats.leather, body, -.17, 1.14, .087, [0, 0, .12]);
      for (let i = 0; i < 4; i++) add(cartridge, mats.paper, body, -.215 + i * .03, 1.165, .085);
      add(horn, mats.hornBody, body, .175, 1.10, .055, [.2, 0, -.5]);
      add(cap, mats.brass, body, .209, 1.175, .055, [.2, 0, -.5]);
      // The hood is pushed back off the head: a folded cowl hanging behind the collar.
      add(hoodBack, mats.snow, body, 0, 1.44, -.105, [.55, 0, 0]);
      add(hood, mats.snowShade, body, 0, 1.38, -.118, [1.15, 0, 0]);
      actor.add(body); actor.updateWorldMatrix(true, true); chest.attach(body);
      void head; void hoodGroup;
      return { remove() { body.removeFromParent(); hoodGroup.removeFromParent(); } };
    },
    dispose() { geos.forEach(x => x.dispose()); Object.values(mats).forEach(m => m.dispose()); },
  };
}
