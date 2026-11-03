import * as THREE from 'three';
/**
 * 落日王国 Shieldbearer: a heater-shaped tower shield carried on the left forearm.
 * Built in readable layers so it holds up close: a bowed oak board, a quartered enamel field,
 * a gilt border with its own inner fillet, silver cross bands with domed rivets, a sun boss with
 * long and short rays, a scalloped base trim, a hanging pennant, and leather straps with buckles.
 * Visual only — the block itself is decided by the simulation (role + mode).
 * One shared kit per EnemyVisuals; every geometry and material is disposed with the kit.
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
/** Bow the panel around its vertical axis so it reads as a shield, not a signboard. */
function bow<T extends THREE.BufferGeometry>(geo: T, amount: number): T {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) - pos.getX(i) ** 2 * amount);
  pos.needsUpdate = true; geo.computeVertexNormals(); return geo;
}
export function createShieldKit() {
  const W = .58, H = .9;
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const extrude = (w: number, h: number, depth: number, bevel: number) => new THREE.ExtrudeGeometry(heater(w, h),
    bevel > 0 ? { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel * .8, bevelSegments: 2, curveSegments: 14 } : { depth, bevelEnabled: false, curveSegments: 14 });
  const board = g(bow(extrude(W + .035, H + .035, .055, 0), .26));     // oak backing, proud of the rim
  const rim = g(bow(extrude(W, H, .05, .018), .26));                   // gilt border
  const fillet = g(bow(extrude(W - .045, H - .045, .025, .008), .26)); // inner fillet, separates border from field
  const field = g(bow(extrude(W - .075, H - .075, .022, 0), .26));     // enamel field
  const quarter = g(bow(extrude((W - .075) * .995, (H - .075) * .5, .02, 0), .26)); // upper quartering, lighter enamel
  const band = g(bow(new THREE.BoxGeometry(.055, H * .80, .015), .26));
  const bar = g(bow(new THREE.BoxGeometry(W * .82, .05, .015), .26));
  const bandEdge = g(bow(new THREE.BoxGeometry(.068, H * .80, .008), .26));
  const boss = g(new THREE.SphereGeometry(.082, 20, 12, 0, Math.PI * 2, 0, Math.PI * .52)); boss.rotateX(Math.PI / 2);
  const bossRing = g(new THREE.TorusGeometry(.082, .013, 8, 24));
  const rayLong = g(new THREE.ConeGeometry(.019, .135, 4)); rayLong.rotateX(Math.PI / 2);
  const rayShort = g(new THREE.ConeGeometry(.013, .075, 4)); rayShort.rotateX(Math.PI / 2);
  const rivet = g(new THREE.SphereGeometry(.013, 8, 6, 0, Math.PI * 2, 0, Math.PI * .6)); rivet.rotateX(-Math.PI / 2);
  const scallop = g(new THREE.CylinderGeometry(.026, .026, .012, 10)); scallop.rotateX(Math.PI / 2);
  const strap = g(new THREE.BoxGeometry(.055, .028, .09));
  const grip = g(new THREE.CylinderGeometry(.021, .021, .17, 10)); grip.rotateZ(Math.PI / 2);
  const buckle = g(new THREE.TorusGeometry(.018, .005, 5, 10));
  const pennant = g(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
    [-.11, 0, 0, .11, 0, 0, -.11, -.2, .01, .11, 0, 0, .11, -.2, .01, -.11, -.2, .01,
      -.11, -.2, .01, .11, -.2, .01, 0, -.3, .015], 3)));
  pennant.computeVertexNormals();
  const mats = {
    oak: new THREE.MeshStandardMaterial({ name: 'ShieldBoardOak', color: 0x6a4a30, roughness: .92, side: THREE.DoubleSide }),
    rim: new THREE.MeshStandardMaterial({ name: 'ShieldRimGilt', color: 0xc9a24a, metalness: .8, roughness: .3 }),
    fillet: new THREE.MeshStandardMaterial({ name: 'ShieldFillet', color: 0x8a6d2f, metalness: .7, roughness: .45 }),
    field: new THREE.MeshStandardMaterial({ name: 'ShieldFieldEnamel', color: 0x23386d, metalness: .18, roughness: .46 }),
    quarter: new THREE.MeshStandardMaterial({ name: 'ShieldFieldQuarter', color: 0x2f4b8e, metalness: .18, roughness: .5 }),
    band: new THREE.MeshStandardMaterial({ name: 'ShieldBandSilver', color: 0xc2cad4, metalness: .85, roughness: .24 }),
    bandEdge: new THREE.MeshStandardMaterial({ name: 'ShieldBandEdge', color: 0x7f8894, metalness: .7, roughness: .5 }),
    sun: new THREE.MeshStandardMaterial({ name: 'ShieldSunBoss', color: 0xf4cd73, emissive: 0x6b4710, emissiveIntensity: .22, metalness: .75, roughness: .26 }),
    leather: new THREE.MeshStandardMaterial({ name: 'ShieldStrapLeather', color: 0x4a3324, roughness: .88 }),
    cloth: new THREE.MeshStandardMaterial({ name: 'ShieldPennant', color: 0x8d2b33, roughness: .9, side: THREE.DoubleSide }),
  };
  function build() {
    const root = new THREE.Group(); root.name = 'ShieldbearerTowerShield'; root.userData.visualOnly = true;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(...rot); m.castShadow = true; root.add(m); return m;
    };
    add(board, mats.oak, 0, 0, -.055);
    add(rim, mats.rim, 0, 0, -.018);
    add(fillet, mats.fillet, 0, 0, .026);
    add(field, mats.field, 0, 0, .034);
    add(quarter, mats.quarter, 0, (H - .075) * .25, .048);
    // cross bands: a silver core with a darker edge strip behind it, so the metal reads as layered plate
    add(bandEdge, mats.bandEdge, 0, -.02, .058); add(band, mats.band, 0, -.02, .062);
    add(bar, mats.band, 0, H * .2, .062);
    // sun boss: domed centre, raised ring, eight long rays with short rays between them
    add(boss, mats.sun, 0, H * .2, .07);
    add(bossRing, mats.rim, 0, H * .2, .072);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const place = (geo: THREE.BufferGeometry, r: number, turn: number) => {
        const m = add(geo, mats.sun, Math.cos(a + turn) * r, H * .2 + Math.sin(a + turn) * r, .062);
        m.lookAt(new THREE.Vector3(Math.cos(a + turn) * 2, H * .2 + Math.sin(a + turn) * 2, .062)); return m;
      };
      place(rayLong, .155, 0); place(rayShort, .128, Math.PI / 8);
    }
    for (const [x, y] of [[-W * .40, H * .2], [W * .40, H * .2], [0, H * .43], [0, -H * .37],
      [-W * .21, H * .43], [W * .21, H * .43], [-W * .33, -H * .12], [W * .33, -H * .12]] as const) add(rivet, mats.band, x, y, .07);
    // scalloped base trim, reading as the reinforced point of the shield
    for (let i = -2; i <= 2; i++) add(scallop, mats.rim, i * .075, -H * .45 + Math.abs(i) * .052, .052);
    // back: two forearm straps, a wrapped grip and buckles
    for (const y of [.11, -.06]) { add(strap, mats.leather, 0, y, -.1); add(buckle, mats.rim, .07, y, -.1, [0, Math.PI / 2, 0]); }
    add(grip, mats.leather, 0, .025, -.13);
    add(pennant, mats.cloth, 0, -H * .5 + .02, .02);
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
