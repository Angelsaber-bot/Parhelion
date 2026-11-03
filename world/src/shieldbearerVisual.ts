import * as THREE from 'three';
/**
 * 落日王国 Shieldbearer: a heater-shaped tower shield (layered field, gilt rim, sun boss with rays,
 * riveted cross bands) carried on the left of the torso. It is visual only — the block itself is
 * decided by the simulation (role + mode). It rides the left forearm over the guard's native buckler,
 * so every authored swing and windup carries it. One shared kit per EnemyVisuals.
 */
function heater(w: number, h: number) {
  const s = new THREE.Shape(), top = h * .5, shoulder = h * .18;
  s.moveTo(-w / 2, top);
  s.lineTo(w / 2, top);
  s.lineTo(w / 2, shoulder);
  s.quadraticCurveTo(w / 2, -h * .22, 0, -h / 2);
  s.quadraticCurveTo(-w / 2, -h * .22, -w / 2, shoulder);
  s.closePath();
  return s;
}
export function createShieldKit() {
  const W = .58, H = .9;
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const rim = g(new THREE.ExtrudeGeometry(heater(W, H), { depth: .05, bevelEnabled: true, bevelSize: .018, bevelThickness: .014, bevelSegments: 2, curveSegments: 10 }));
  const field = g(new THREE.ExtrudeGeometry(heater(W - .07, H - .07), { depth: .03, bevelEnabled: false, curveSegments: 10 }));
  const band = g(new THREE.BoxGeometry(.06, H * .82, .016));
  const bar = g(new THREE.BoxGeometry(W * .86, .055, .016));
  const boss = g(new THREE.CylinderGeometry(.085, .1, .05, 18)); boss.rotateX(Math.PI / 2);
  const ray = g(new THREE.ConeGeometry(.022, .1, 4)); ray.rotateX(Math.PI / 2);
  const rivet = g(new THREE.SphereGeometry(.014, 6, 4));
  const strap = g(new THREE.BoxGeometry(.05, .3, .03));
  const mats = {
    rim: new THREE.MeshStandardMaterial({ name: 'ShieldRimGilt', color: 0xc9a24a, metalness: .75, roughness: .32 }),
    field: new THREE.MeshStandardMaterial({ name: 'ShieldFieldLacquer', color: 0x29407a, metalness: .15, roughness: .55 }),
    band: new THREE.MeshStandardMaterial({ name: 'ShieldBandSilver', color: 0xb9c2cc, metalness: .8, roughness: .28 }),
    sun: new THREE.MeshStandardMaterial({ name: 'ShieldSunBoss', color: 0xf2c766, emissive: 0x6b4710, emissiveIntensity: .25, metalness: .7, roughness: .3 }),
    leather: new THREE.MeshStandardMaterial({ name: 'ShieldStrapLeather', color: 0x4a3324, roughness: .85 }),
  };
  function build() {
    const root = new THREE.Group(); root.name = 'ShieldbearerTowerShield'; root.userData.visualOnly = true;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true; root.add(m); return m; };
    add(rim, mats.rim, 0, 0, -.025);
    add(field, mats.field, 0, 0, .035);
    add(band, mats.band, 0, -.03, .072);
    add(bar, mats.band, 0, H * .2, .072);
    add(boss, mats.sun, 0, H * .2, .095);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = .145; const m = add(ray, mats.sun, Math.cos(a) * r, H * .2 + Math.sin(a) * r, .085); m.rotation.set(0, 0, 0); m.lookAt(Math.cos(a) * 2, H * .2 + Math.sin(a) * 2, .085); }
    for (const [x, y] of [[-W * .4, H * .2], [W * .4, H * .2], [0, H * .43], [0, -H * .36], [-W * .2, H * .43], [W * .2, H * .43]] as const) add(rivet, mats.band, x, y, .08);
    add(strap, mats.leather, -.1, .05, -.07); add(strap, mats.leather, .1, .05, -.07);
    return root;
  }
  return {
    attach(actor: THREE.Object3D) {
      // three.js strips the dot from Blender's `forearm.L`
      const arm = actor.getObjectByName('forearmL') ?? actor.getObjectByName('chest'); if (!arm) return null;
      const shield = build();
      // Bind-pose root-space metres: outside the left forearm (model faces +Z, its left is +X), covering the buckler.
      shield.position.set(.48, .98, .2); shield.rotation.set(-.05, .42, .04);
      actor.add(shield); actor.updateWorldMatrix(true, true); arm.attach(shield);
      return shield;
    },
    dispose() { geos.forEach(x => x.dispose()); Object.values(mats).forEach(m => m.dispose()); },
  };
}
