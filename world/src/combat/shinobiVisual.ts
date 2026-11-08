import * as THREE from 'three';
/**
 * 业火京都 Shinobi gear worn over the samurai kit, built in layers that read close up:
 * a soot face wrap with a folded over-layer and a knotted tail, a crimson scarf with a knot and
 * two trailing tails of different lengths, a leather bandolier with stitched edging holding four
 * kunai in sheaths, and wrapped forearms. Visual only; one shared kit per EnemyVisuals.
 */
export function createShinobiKit() {
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const arc = (r0: number, r1: number, h: number, span: number, start: number) => new THREE.CylinderGeometry(r0, r1, h, 20, 1, true, start, span);
  const wrap = g(arc(.118, .125, .105, Math.PI * 1.24, -Math.PI * .62));        // main face wrap
  const wrapFold = g(arc(.124, .128, .035, Math.PI * 1.2, -Math.PI * .6));      // folded top edge, slightly proud
  const wrapLow = g(arc(.113, .119, .05, Math.PI * 1.1, -Math.PI * .55));       // lower layer under the chin
  const knot = g(new THREE.SphereGeometry(.036, 10, 8));
  const knotTail = g(new THREE.BoxGeometry(.03, .19, .01)); knotTail.translate(0, -.095, 0);
  const scarf = g(new THREE.TorusGeometry(.107, .034, 8, 22));
  const scarfKnot = g(new THREE.SphereGeometry(.045, 10, 8));
  const tail = g(new THREE.BoxGeometry(.075, .5, .012)); tail.translate(0, -.25, 0);
  const tailShort = g(new THREE.BoxGeometry(.062, .33, .011)); tailShort.translate(0, -.165, 0);
  const strap = g(new THREE.BoxGeometry(.062, .62, .018));
  const strapEdge = g(new THREE.BoxGeometry(.074, .62, .008));
  const sheath = g(new THREE.BoxGeometry(.042, .1, .03));
  const kunai = g(new THREE.ConeGeometry(.016, .13, 4)); kunai.rotateX(Math.PI);
  const grip = g(new THREE.CylinderGeometry(.009, .009, .05, 6));
  const ring = g(new THREE.TorusGeometry(.016, .005, 5, 10));
  const armWrap = g(new THREE.CylinderGeometry(.062, .058, .028, 12));
  const mats = {
    cloth: new THREE.MeshStandardMaterial({ name: 'ShinobiWrapSoot', color: 0x1b1c24, roughness: .92, side: THREE.DoubleSide }),
    clothFold: new THREE.MeshStandardMaterial({ name: 'ShinobiWrapFold', color: 0x2a2c36, roughness: .88, side: THREE.DoubleSide }),
    scarf: new THREE.MeshStandardMaterial({ name: 'ShinobiScarfCrimson', color: 0x9c1f2a, roughness: .72, side: THREE.DoubleSide }),
    scarfShade: new THREE.MeshStandardMaterial({ name: 'ShinobiScarfShade', color: 0x71161f, roughness: .8, side: THREE.DoubleSide }),
    leather: new THREE.MeshStandardMaterial({ name: 'ShinobiStrap', color: 0x3a2a22, roughness: .88 }),
    stitch: new THREE.MeshStandardMaterial({ name: 'ShinobiStrapEdge', color: 0x5c4634, roughness: .9 }),
    steel: new THREE.MeshStandardMaterial({ name: 'ShinobiKunai', color: 0x9aa4ae, metalness: .85, roughness: .28 }),
  };
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(...rot); parent.add(m); return m;
  };
  return {
    attach(actor: THREE.Object3D) {
      const head = actor.getObjectByName('head'), chest = actor.getObjectByName('chest');
      const foreL = actor.getObjectByName('forearmL'), foreR = actor.getObjectByName('forearmR');
      if (!head || !chest) return null;
      const face = new THREE.Group(), body = new THREE.Group(); face.name = 'ShinobiFaceWrap'; body.name = 'ShinobiScarfAndBandolier';
      face.userData.visualOnly = body.userData.visualOnly = true;
      // Bind-pose root-space metres (model faces +Z).
      mesh(wrapLow, mats.cloth, face, 0, 1.552, .012);
      mesh(wrap, mats.cloth, face, 0, 1.585, .012);
      mesh(wrapFold, mats.clothFold, face, 0, 1.628, .012);
      mesh(knot, mats.cloth, face, 0, 1.6, -.118);
      mesh(knotTail, mats.clothFold, face, -.01, 1.59, -.13, [.25, 0, .22]);
      // scarf: a ring, a knot off to one side, and two tails of different lengths
      mesh(scarf, mats.scarf, body, 0, 1.487, .004, [Math.PI / 2 + .12, 0, 0]).scale.set(1.14, 1.04, .62);
      mesh(scarfKnot, mats.scarfShade, body, .055, 1.472, -.075);
      mesh(tail, mats.scarf, body, -.045, 1.482, -.12, [.35, 0, .12]);
      mesh(tailShort, mats.scarfShade, body, .052, 1.47, -.125, [.5, 0, -.1]);
      // bandolier: a darker edging strip behind the strap, four sheathed kunai
      mesh(strapEdge, mats.stitch, body, 0, 1.2, .134, [-.08, 0, .72]);
      mesh(strap, mats.leather, body, 0, 1.2, .142, [-.08, 0, .72]);
      for (let i = 0; i < 4; i++) {
        const x = -.13 + i * .07, y = 1.34 - i * .065;
        mesh(sheath, mats.leather, body, x, y, .158, [0, 0, .72]);
        mesh(kunai, mats.steel, body, x, y, .181, [0, 0, .72]);
        mesh(grip, mats.stitch, body, x + .032, y + .032, .181, [0, 0, .72]);
        mesh(ring, mats.steel, body, x + .05, y + .05, .181);
      }
      for (const arm of [foreL, foreR]) if (arm) for (let i = 0; i < 3; i++) {
        const w = new THREE.Mesh(armWrap, mats.cloth); body.add(w);
        actor.updateWorldMatrix(true, true);
        w.position.copy(arm.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, -.03 - i * .035, .01));
        w.scale.setScalar(1 - i * .06);
      }
      actor.add(face, body); actor.updateWorldMatrix(true, true); head.attach(face); chest.attach(body);
      return { remove() { face.removeFromParent(); body.removeFromParent(); } };
    },
    dispose() { geos.forEach(x => x.dispose()); Object.values(mats).forEach(m => m.dispose()); },
  };
}
