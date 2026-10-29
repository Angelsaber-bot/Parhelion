import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SettlementKit } from './types';

/** A walk-through customs house, rather than a second tavern or shipyard.
 * All dimensions are local metres. Entry, public hall, bond room and rear lane
 * remain connected; decorative furnishings are kept outside the walking spine.
 */
export function buildBlackSailSettlement(): SettlementKit {
  const group = new THREE.Group();
  group.name = 'BlackSail_CustomsHouse';
  const mats = {
    plaster: new THREE.MeshStandardMaterial({ color: '#dfd6ba', roughness: .94 }),
    worn: new THREE.MeshStandardMaterial({ color: '#b7b09b', roughness: .98 }),
    stone: new THREE.MeshStandardMaterial({ color: '#758286', roughness: .94 }),
    paleStone: new THREE.MeshStandardMaterial({ color: '#a5ac9e', roughness: .93 }),
    oak: new THREE.MeshStandardMaterial({ color: '#514037', roughness: .85 }),
    lightWood: new THREE.MeshStandardMaterial({ color: '#a07950', roughness: .88 }),
    teal: new THREE.MeshStandardMaterial({ color: '#286d72', roughness: .72 }),
    roof: new THREE.MeshStandardMaterial({ color: '#536a70', roughness: .86 }),
    roofEdge: new THREE.MeshStandardMaterial({ color: '#789191', roughness: .83 }),
    brass: new THREE.MeshStandardMaterial({ color: '#aa8952', metalness: .58, roughness: .48 }),
    iron: new THREE.MeshStandardMaterial({ color: '#364147', metalness: .55, roughness: .64 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#e1cba3', roughness: 1, side: THREE.DoubleSide }),
    paper: new THREE.MeshStandardMaterial({ color: '#e8d5ac', roughness: 1 }),
    ink: new THREE.MeshStandardMaterial({ color: '#476978', roughness: 1 }),
    seal: new THREE.MeshStandardMaterial({ color: '#9e4540', roughness: .8 }),
    glass: new THREE.MeshStandardMaterial({ color: '#bfcaad', roughness: .4, metalness: .12 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: '#ffbc60', emissiveIntensity: .6, roughness: .7 }),
  };
  type Mat = keyof typeof mats;
  // Bake static details into a small set of material/solidity batches. Windows,
  // trim and ropes cannot accidentally become invisible passage-blocking boxes.
  const batches = new Map<string, THREE.BufferGeometry[]>();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  function add(geo: THREE.BufferGeometry, mat: Mat, x: number, y: number, z: number,
    sx = 1, sy = 1, sz = 1, solid = false, rx = 0, ry = 0, rz = 0) {
    q.setFromEuler(new THREE.Euler(rx, ry, rz));
    const g = geo.clone().applyMatrix4(new THREE.Matrix4().compose(v.set(x, y, z), q, s.set(sx, sy, sz)));
    const key = `${mat}:${solid ? 'solid' : 'art'}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key)!.push(g);
  }
  const box = (mat: Mat, x: number, y: number, z: number, w: number, h: number, d: number, solid = false,
    rx = 0, ry = 0, rz = 0) => add(cube, mat, x, y, z, w, h, d, solid, rx, ry, rz);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const sphere = new THREE.SphereGeometry(1, 10, 6);
  function beam(mat: Mat, a: number[], b: number[], width: number, depth = width, solid = false) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
    const delta = bv.clone().sub(av);
    const mid = av.add(bv).multiplyScalar(.5);
    const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    const g = cube.clone().applyMatrix4(new THREE.Matrix4().compose(mid, rot, new THREE.Vector3(width, delta.length(), depth)));
    const key = `${mat}:${solid ? 'solid' : 'art'}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key)!.push(g);
  }
  function post(x: number, z: number, h: number) {
    box('oak', x, h / 2, z, .26, h, .26, true);
    box('brass', x, .35, z, .3, .09, .3);
    box('brass', x, h - .28, z, .3, .09, .3);
  }
  function barrel(x: number, z: number, size = 1) {
    add(cylinder, 'lightWood', x, .65 * size, z, .49 * size, 1.3 * size, .49 * size, true);
    for (const y of [.18, .64, 1.12]) add(cylinder, 'iron', x, y * size, z, .505 * size, .055 * size, .505 * size);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      box('oak', x + Math.sin(a) * .488 * size, .65 * size, z + Math.cos(a) * .488 * size,
        .018 * size, 1.18 * size, .018 * size);
    }
    add(cylinder, 'oak', x, 1.31 * size, z, .43 * size, .035 * size, .43 * size);
  }
  function crate(x: number, y: number, z: number, w = 1.2, h = 1.05, d = 1.1, sealed = false) {
    box('lightWood', x, y + h / 2, z, w, h, d, true);
    for (const dz of [-d / 2 - .025, d / 2 + .025]) {
      box('oak', x, y + .09, z + dz, w + .07, .13, .06);
      box('oak', x, y + h - .09, z + dz, w + .07, .13, .06);
      beam('oak', [x - w / 2 + .1, y + .15, z + dz], [x + w / 2 - .1, y + h - .15, z + dz], .08, .06);
    }
    if (sealed) {
      box('cloth', x, y + h + .014, z, .18, .025, d + .02);
      box('paper', x + .16, y + h / 2, z + d / 2 + .04, .32, .24, .02);
      add(sphere, 'seal', x + .16, y + h / 2, z + d / 2 + .06, .08, .08, .025);
    }
  }
  function lantern(x: number, y: number, z: number) {
    box('iron', x, y + .34, z, .46, .12, .4);
    box('lamp', x, y, z, .3, .53, .26);
    box('iron', x, y - .32, z, .39, .1, .34);
    for (const dx of [-.18, .18]) box('iron', x + dx, y, z, .045, .58, .32);
    beam('iron', [x, y + .42, z], [x, y + .67, z], .045);
  }

  // A pale stone apron and flush interior deck, no stairs over the entry threshold.
  box('stone', 0, -.2, -2, 24, .4, 14, true);
  box('paleStone', 0, -.12, 9.5, 24, .24, 9, true);
  box('stone', 7.6, -.13, -13, 6.6, .26, 8, true);
  for (let x = -10.5; x <= 10.5; x += 1.5) {
    box('lightWood', x, .025, -2, 1.47, .045, 13.8);
    for (const z of [-7.8, -4.5, -1.1, 2.3]) box('oak', x, .052, z, 1.44, .008, .018);
  }
  for (let row = 0; row < 4; row++) for (let col = 0; col < 11; col++) {
    box(row % 2 ? 'stone' : 'paleStone', -10 + col * 2 + (row % 2) * .55, .014, 6.6 + row * 1.8, 1.93, .025, 1.72);
  }
  // Front wall: 3.6m entry, 2 large cut-out windows. Window recesses are open
  // instead of opaque painted squares; shutters stand proud of the plaster.
  const h = 5;
  box('plaster', -10, h / 2, 5, 2, h, .45, true);
  box('plaster', 10, h / 2, 5, 2, h, .45, true);
  for (const side of [-1, 1]) {
    box('plaster', side * 3.35, h / 2, 5, 3.1, h, .45, true);
    box('plaster', side * 7, .75, 5, 4, 1.5, .45, true);
    box('plaster', side * 7, 4.3, 5, 4, 1.4, .45, true);
    box('oak', side * 7, 1.5, 5.04, 4.2, .2, .65);
    box('oak', side * 7, 3.64, 5.04, 4.2, .17, .58);
    for (const x of [side * 7 - 2, side * 7, side * 7 + 2]) box('oak', x, 2.55, 5, .15, 2.2, .28);
    box('glass', side * 7, 2.55, 4.96, 3.84, 1.9, .035);
    for (const edge of [-1, 1]) {
      const x = side * 7 + edge * 2.52;
      box('teal', x, 2.57, 5.26, .88, 2.25, .15, false, 0, edge * .16);
      for (let j = 0; j < 7; j++) box('roofEdge', x, 1.7 + j * .27, 5.36, .82, .045, .045);
    }
  }
  box('plaster', 0, 4.35, 5, 3.6, 1.3, .45, true);
  for (const x of [-1.8, 1.8]) box('oak', x, 1.9, 5.1, .22, 3.8, .65, true);
  box('oak', 0, 3.85, 5.1, 3.9, .23, .65);
  // Open teal double door leaves lie beside, not across, the opening.
  for (const x of [-2.5, 2.5]) {
    box('teal', x, 1.7, 5.35, 1.12, 3.4, .17);
    box('brass', x, 1.65, 5.47, .13, .13, .05);
  }
  for (const side of [-1, 1]) {
    const x = side * 11;
    box('plaster', x, .7, -2, .45, 1.4, 14, true);
    box('plaster', x, 4.4, -2, .45, 1.2, 14, true);
    for (const [z, d] of [[-8.5, 1], [-2.5, 5], [4, 2]]) box('plaster', x, 2.6, z, .45, 2.4, d, true);
    for (const z of [-6.5, 1.5]) {
      for (const dz of [-1.5, 1.5]) box('oak', x + side * .25, 2.6, z + dz, .2, 2.6, .15);
      for (const y of [1.4, 3.8]) box('oak', x + side * .25, y, z, .23, .16, 3.2);
      box('oak', x + side * .25, 2.6, z, .2, 2.4, .13);
      // Open windows admit light; the exterior shutters sit flat against wall.
      box('teal', x + side * .29, 2.6, z - 2, .13, 2.5, .75);
      for (let i = 0; i < 6; i++) box('roofEdge', x + side * .37, 1.65 + i * .36, z - 2, .05, .045, .67);
    }
  }
  // Rear exit of bond room is 3m wide and connects to the enclosed back lane.
  box('plaster', -2.7, 2.5, -9, 16.6, 5, .45, true);
  box('plaster', 10.2, 2.5, -9, 1.6, 5, .45, true);
  box('plaster', 7.5, 4.3, -9, 3.4, 1.4, .45, true);
  // Room divider with generous 3.2m passage between ledger office and bond room.
  box('oak', 2, 2.1, -6.4, .2, 4.2, 5.2, true);
  box('oak', 2, 2.1, 3.2, .2, 4.2, 3.6, true);
  box('oak', 2, 3.85, -1.2, .2, .7, 5.2);
  for (const x of [-10.8, -5.3, 0, 5.3, 10.8]) {
    if (x !== 0) box('oak', x, 2.5, 5.24, .22, 5.05, .18);
    box('oak', x, 2.5, -9.24, .22, 5.05, .18);
  }
  for (const z of [-9, -4.4, .3, 5]) {
    box('oak', -11.25, 2.5, z, .15, 5, .2);
    box('oak', 11.25, 2.5, z, .15, 5, .2);
  }
  for (const y of [.3, 4.8]) {
    if (y > 1) box('oak', 0, y, 5.26, 22.3, .22, .18);
    else for (const side of [-1, 1]) box('oak', side * 6.5, y, 5.26, 9.2, .22, .18);
    if (y > 1) box('oak', 0, y, -9.26, 22.3, .22, .18);
    else {
      box('oak', -2.775, y, -9.26, 16.75, .22, .18);
      box('oak', 10.275, y, -9.26, 1.75, .22, .18);
    }
  }
  // Uneven lower plaster repairs and salt-stained masonry bands.
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
    box(i % 2 ? 'worn' : 'paleStone', side * 11.24, .2 + (i % 3) * .08, -8 + i * 2,
      .025, .34 + (i % 3) * .12, 1.35);
  }
  // Closed triangular end gables keep the office weather-tight while exposing
  // the timber truss silhouette beneath the overhanging roof.
  const gable = new THREE.BufferGeometry();
  gable.setAttribute('position', new THREE.Float32BufferAttribute([
    -.225, 0, -7, -.225, 0, 7, -.225, 2.65, 0,
     .225, 0, -7,  .225, 0, 7,  .225, 2.65, 0,
  ], 3));
  gable.setIndex([0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5]);
  gable.computeVertexNormals();
  gable.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(12), 2));
  for (const x of [-11, 11]) {
    add(gable, 'plaster', x, 5, -2, 1, 1, 1, true);
    beam('oak', [x, 5, -9], [x, 7.65, -2], .18);
    beam('oak', [x, 7.65, -2], [x, 5, 5], .18);
    box('oak', x, 6.25, -2, .28, 2.65, .22);
  }
  gable.dispose();
  // Layered hipped impression, continuous long ridge and visible timber eaves.
  const slope = Math.atan2(2.9, 7.9), slopeLength = Math.hypot(2.9, 7.9);
  for (const side of [-1, 1]) {
    box('roof', 0, 6.42, -2 + side * 3.95, 24.5, .22, slopeLength, true, side * slope);
    for (let row = 0; row < 8; row++) {
      const t = (row + .4) / 8, z = -2 + side * (t * 7.9), y = 7.86 - t * 2.9;
      box(row % 2 ? 'roofEdge' : 'roof', 0, y + .12, z, 24.65, .065, .12, false, side * slope);
    }
    box('oak', 0, 4.95, -2 + side * 7.95, 24.8, .3, .26);
  }
  add(cylinder, 'roofEdge', 0, 7.96, -2, .21, 25, .21, false, 0, 0, Math.PI / 2);
  for (const x of [-11.8, -6, 0, 6, 11.8]) {
    beam('oak', [x, 4.85, -9.9], [x, 7.74, -2], .15);
    beam('oak', [x, 7.74, -2], [x, 4.85, 5.9], .15);
  }
  // Octagonal harbor clock/duty bell above the entry, simple clean silhouette.
  box('teal', 0, 5.85, 6.0, 2.5, 1.6, .26);
  add(cylinder, 'brass', 0, 5.9, 6.2, .57, .12, .57, false, Math.PI / 2);
  add(cylinder, 'paper', 0, 5.9, 6.28, .48, .025, .48, false, Math.PI / 2);
  beam('ink', [0, 5.9, 6.3], [.0, 6.25, 6.3], .035);
  beam('ink', [0, 5.9, 6.31], [.26, 5.8, 6.31], .045);

  // Open covered veranda; no front rail to impede the walking route.
  for (const x of [-10.6, -5.4, 5.4, 10.6]) post(x, 8.25, 3.8);
  box('oak', 0, 3.8, 8.25, 22, .2, .22);
  box('cloth', 0, 4.1, 6.8, 22.3, .055, 3.5, false, .18);
  for (const x of [-9.8, -7, -4.2, 4.2, 7, 9.8]) box('teal', x, 3.83, 8.5, .55, .55, .05);
  lantern(-2.3, 2.9, 5.7); lantern(2.3, 2.9, 5.7);
  lantern(-7.8, 3.5, -6.8); lantern(8.5, 3.3, -6.7);

  // Ledger office: freestanding counter, maps, bookcase, drawers and scale.
  box('oak', -6.3, .65, -.8, 5.9, 1.3, 1.45, true);
  box('lightWood', -6.3, 1.36, -.8, 6.15, .14, 1.65);
  for (const x of [-8.5, -7.35, -6.2, -5.05, -3.9]) {
    box('teal', x, .68, .0, .95, .85, .025);
    box('brass', x, .88, .04, .17, .06, .04);
  }
  box('paper', -6.0, 1.45, -.6, 2.1, .02, 1.1);
  for (let i = 0; i < 6; i++) box('ink', -6.7 + i * .28, 1.465, -.62, .012, .008, .7 - (i % 3) * .14, false, 0, -.3);
  box('seal', -4.3, 1.52, -.6, .56, .16, .68);
  box('paper', -4.3, 1.55, -.6, .5, .13, .63);
  add(cylinder, 'brass', -8.3, 1.8, -.8, .045, .75, .045);
  box('brass', -8.3, 2.15, -.8, 1, .05, .05);
  for (const x of [-8.7, -7.9]) {
    beam('brass', [x, 2.15, -.8], [x, 1.84, -.8], .018);
    add(cylinder, 'brass', x, 1.81, -.8, .21, .05, .21);
  }
  box('oak', -9.8, 1.55, -6, 1.1, 3.1, 4.3, true);
  for (const y of [.55, 1.35, 2.15, 2.95]) {
    box('lightWood', -9.16, y, -6, .12, .12, 4.2);
    for (let i = 0; i < 7; i++) box(i % 2 ? 'teal' : 'seal', -9.08, y + .32, -7.65 + i * .53, .15, .48, .39);
  }
  box('oak', -5, 2.5, -8.68, 4.6, 2.6, .18);
  box('paper', -5, 2.5, -8.55, 4.25, 2.26, .045);
  // A chart rather than a modern graph: broken coast, islands, compass rose,
  // light rhumb lines and a dotted shipping route.
  for (let i = 0; i < 5; i++) {
    beam('lightWood', [-6.9, 1.55 + i * .45, -8.52], [-3.1, 1.55 + i * .45, -8.52], .009);
    beam('lightWood', [-6.8 + i * .82, 1.5, -8.52], [-6.8 + i * .82, 3.5, -8.52], .009);
  }
  const coast = [[-6.9, 1.6], [-6.6, 1.72], [-6.5, 2.05], [-6.15, 2.1], [-6.35, 2.43], [-5.98, 2.64], [-6.25, 2.94], [-6.0, 3.45]];
  for (let i = 1; i < coast.length; i++) beam('ink', [...coast[i - 1], -8.5], [...coast[i], -8.5], .045);
  for (const [cx, cy, r] of [[-4.5, 2.3, .3], [-3.55, 3.05, .2]]) {
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7, b = (i + 1) * Math.PI * 2 / 7;
      beam('ink', [cx + Math.cos(a) * r, cy + Math.sin(a) * r * .65, -8.5],
        [cx + Math.cos(b) * r, cy + Math.sin(b) * r * .65, -8.5], .025);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, r = i % 2 ? .18 : .29;
    beam('ink', [-3.6, 1.85, -8.5], [-3.6 + Math.sin(a) * r, 1.85 + Math.cos(a) * r, -8.5], .025);
  }
  for (let i = 0; i < 10; i++) {
    const t = i / 9; add(sphere, 'seal', -6.15 + t * 2.6, 2.12 + Math.sin(t * 2.4) * .65, -8.48, .028, .028, .015);
  }
  // The bonded cargo room leaves its centre open to the rear exit.
  crate(4.1, 0, -6.9, 1.7, 1.35, 1.4, true);
  crate(4.1, 1.35, -6.9, 1.5, 1.1, 1.25, true);
  crate(9.3, 0, -5.8, 1.7, 1.3, 1.4, true);
  crate(9.3, 0, -3.9, 1.5, 1.0, 1.3, true);
  barrel(4.0, 2.8, 1.05); barrel(5.2, 3.2, .84);
  box('teal', 9.5, 1.0, 2.4, 1.9, 2, 2.0, true);
  for (const y of [.25, 1.75]) box('iron', 9.5, y, 3.44, 2.03, .11, .06);
  box('brass', 9.5, 1.05, 3.46, .2, .28, .06);
  // Rear inspection alley, then an unbarred turn-out for the smuggler contact.
  box('worn', 4.5, 1.35, -12.3, .3, 2.7, 6.8, true);
  box('worn', 10.9, 1.35, -12.3, .3, 2.7, 6.8, true);
  box('paleStone', 4.5, 2.75, -12.3, .5, .15, 6.95);
  box('paleStone', 10.9, 2.75, -12.3, .5, .15, 6.95);
  box('cloth', 7.7, 3.3, -11.1, 6.4, .035, 3.3, false, -.08);
  crate(5.8, 0, -13.6, 1.3, .9, 1.0); barrel(9.65, -13.5, .9);
  lantern(10.45, 2.1, -10.8);
  // Courtyard: asymmetric unloading goods, bollards and rope loops.
  crate(-8.7, 0, 11.2, 1.8, 1.2, 1.35, true);
  crate(-8.6, 1.2, 11.2, 1.5, .9, 1.2, true);
  barrel(-6.2, 11.3); barrel(-7.3, 12.1, .76);
  box('oak', 8.1, .6, 11.8, 4.2, .22, 1.55, true);
  for (const x of [6.7, 9.5]) for (const z of [11.2, 12.4]) box('oak', x, .25, z, .14, .5, .14);
  box('cloth', 8.1, .79, 11.8, 2.6, .14, 1.1);
  for (const x of [-11.3, 11.3]) {
    add(cylinder, 'iron', x, .48, 12.5, .24, .96, .24, true);
    box('iron', x, .81, 12.5, .75, .16, .2);
    const ring = new THREE.TorusGeometry(.37, .04, 5, 14);
    add(ring, 'cloth', x, .12, 12.6, 1, 1, 1, false, Math.PI / 2);
    ring.dispose();
  }
  // Finish in <40 draw calls, with collision kept separate from visual-only trim.
  for (const [key, geos] of batches) {
    const [mat, solidity] = key.split(':') as [Mat, string];
    const geo = mergeGeometries(geos, false)!;
    const mesh = new THREE.Mesh(geo, mats[mat]);
    mesh.name = `Customs_${mat}_${solidity}`;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.solid = solidity === 'solid';
    group.add(mesh);
    geos.forEach(g => g.dispose());
  }
  // Two local unshadowed warm lights keep the functional rooms readable at dusk.
  // No per-prop point lights, no extra shadow maps.
  for (const [x, z, intensity] of [[-6, -4, 65], [7, -3, 55]]) {
    const light = new THREE.PointLight('#ffd59b', intensity, 11, 2);
    light.position.set(x, 3.5, z); light.castShadow = false;
    group.add(light);
  }
  cube.dispose(); cylinder.dispose(); sphere.dispose();
  return {
    id: 'blacksail', name: ['潮印海关所', 'Tidemark Customs House'], group,
    footprint: [26, 36], entry: [0, 13],
    npcs: [
      { id: 'customs_clerk', role: ['港务书记官', 'Harbor Clerk'], position: [-6.1, 0, -3.1], yaw: 0,
        lines: [['这里登记每一批进港货物。账本上的空白，有时比墨迹更重要。', 'Every inbound cargo is recorded here. A blank ledger line can matter more than the ink.'],
          ['正门通向查验厅，东侧是封存库房。后巷还连着一条货运通道。', 'The front opens into the inspection hall. The bonded room is east, with a cargo passage behind it.']] },
      { id: 'customs_inspector', role: ['验货员', 'Cargo Inspector'], position: [6.8, 0, 1.9], yaw: -.45,
        lines: [['红蜡封条还在，箱子就没有被开过。至少规矩上是这么说的。', 'An intact red seal means a crate has not been opened. That is the rule, anyway.'],
          ['走中间这条通道，别踩到秤盘和货绳。', 'Keep to the middle passage and mind the scales and cargo ropes.']] },
      { id: 'customs_runner', role: ['港口信使', 'Dock Runner'], position: [7.7, 0, -14.4], yaw: Math.PI,
        lines: [['前门查账，后巷传话。海上的消息总比船先到。', 'Accounts go through the front, messages through the lane. News from the sea arrives before the ships.']] },
    ],
  };
}
