import * as THREE from 'three';

/**
 * Egypt's anomalous-water creatures (E03 dry bed, E04 temple rear), built from shared low-poly parts
 * so they need no downloads. Both follow the creature contract of valleySentinel:
 * `update(time, moving, attacking)`, plus `breakShell()` for the limb's one-time shell loss.
 */
type Part = (parent: THREE.Object3D, name: string, geo: THREE.BufferGeometry, mat: THREE.Material, p: readonly number[], s: readonly number[], r?: readonly number[]) => THREE.Mesh;
function kit(geometries: THREE.BufferGeometry[], materials: THREE.Material[]) {
  const part: Part = (parent, name, geo, mat, p, s, r = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat); m.name = name; m.position.set(p[0], p[1], p[2]); m.scale.set(s[0], s[1], s[2]); m.rotation.set(r[0], r[1], r[2]);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const mat = (o: THREE.MeshStandardMaterialParameters) => { const m = new THREE.MeshStandardMaterial(o); materials.push(m); return m; };
  const geo = <G extends THREE.BufferGeometry>(g: G) => { geometries.push(g); return g; };
  return { part, mat, geo };
}

/** E03 吞潮肢体: a segmented limb rooted in a pool of anomalous water, hooked toward its prey and crusted
 * with river-shell scutes along its back. Windup rears it back; the swing slams it forward. */
export function makeTideLimb(geometries: THREE.BufferGeometry[], materials: THREE.Material[]) {
  const { part, mat, geo } = kit(geometries, materials);
  const root = new THREE.Group(); root.name = 'Egypt_Tide_Eater_Limb';
  const flesh = mat({ color: '#2f5b5e', roughness: .5, metalness: .1, emissive: '#0c3a3a', emissiveIntensity: .35 });
  const belly = mat({ color: '#7fb3a6', roughness: .6, emissive: '#1d4f4a', emissiveIntensity: .25 });
  const shellMat = mat({ color: '#b49a6a', roughness: .85, metalness: .05 });
  const barnacle = mat({ color: '#d8cfb3', roughness: .9 });
  const water = mat({ color: '#1d6f73', roughness: .15, metalness: .3, emissive: '#2fd6c6', emissiveIntensity: .55, transparent: true, opacity: .8 });
  const claw = mat({ color: '#e7dcc0', roughness: .4, metalness: .2 });
  const seg = geo(new THREE.CylinderGeometry(.82, 1, 1, 10)), cap = geo(new THREE.SphereGeometry(1, 12, 8));
  const scute = geo(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2));
  const ring = geo(new THREE.TorusGeometry(1, .06, 6, 28)), disk = geo(new THREE.CircleGeometry(1, 28)), hook = geo(new THREE.ConeGeometry(1, 1, 7));
  const pool = part(root, 'Anomalous_Pool', disk, water, [0, .04, 0], [2.1, 2.1, 1], [-Math.PI / 2, 0, 0]); pool.castShadow = false;
  part(root, 'Pool_Rim', ring, water, [0, .06, 0], [2.15, 2.15, 1], [-Math.PI / 2, 0, 0]).castShadow = false;
  // Three short tendrils break the surface around the base.
  const tendrils: THREE.Mesh[] = [];
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + .5; tendrils.push(part(root, `Pool_Tendril_${k}`, seg, flesh, [Math.cos(a) * 1.2, .35, Math.sin(a) * 1.2], [.16, .8, .16], [Math.sin(a) * .5, 0, -Math.cos(a) * .5])); }
  // Seven segments, each the child of the last, so one curl value hooks the whole limb toward +Z.
  const joints: THREE.Group[] = [], shells: THREE.Mesh[] = [];
  let parent: THREE.Object3D = root;
  const lengths = [1.0, .95, .9, .82, .74, .64, .55], radii = [.66, .58, .51, .44, .37, .3, .24];
  lengths.forEach((len, i) => {
    const joint = new THREE.Group(); joint.name = `Limb_Joint_${i}`; joint.position.y = i ? lengths[i - 1] : .05; parent.add(joint); joints.push(joint);
    part(joint, `Limb_Segment_${i}`, seg, flesh, [0, len / 2, 0], [radii[i], len, radii[i] * .9]);
    part(joint, `Limb_Underside_${i}`, cap, belly, [0, len * .5, radii[i] * .55], [radii[i] * .7, len * .45, radii[i] * .4]);
    part(joint, `Limb_Knuckle_${i}`, cap, flesh, [0, 0, 0], [radii[i] * 1.08, radii[i] * .55, radii[i] * 1.08]);
    // An overlapping shell scute along the back (outer curve) and one each side.
    shells.push(part(joint, `Limb_Shell_${i}_back`, scute, shellMat, [0, len * .55, -radii[i] * .62], [radii[i] * .95, radii[i] * .45, len * .62], [-Math.PI / 2, 0, 0]));
    for (const side of [-1, 1]) shells.push(part(joint, `Limb_Shell_${i}_${side}`, scute, shellMat, [side * radii[i] * .7, len * .5, -radii[i] * .2], [len * .4, radii[i] * .35, radii[i] * .55], [0, 0, side * -Math.PI / 2]));
    if (i % 2 === 0) shells.push(part(joint, `Limb_Barnacle_${i}`, cap, barnacle, [radii[i] * .55, len * .3, -radii[i] * .55], [.13, .1, .13]));
    parent = joint;
  });
  // The tip: a pale palm with four splayed, hooked claws.
  const tip = new THREE.Group(); tip.name = 'Limb_Claw'; tip.position.y = lengths[lengths.length - 1]; parent.add(tip);
  part(tip, 'Claw_Palm', cap, claw, [0, .12, 0], [.34, .24, .34]);
  const hooks: THREE.Group[] = [];
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * Math.PI * 2 + Math.PI / 4, h = new THREE.Group(); h.position.set(Math.cos(a) * .22, .22, Math.sin(a) * .22); h.rotation.y = -a; tip.add(h); hooks.push(h);
    part(h, `Claw_Base_${k}`, hook, claw, [.12, .22, 0], [.09, .5, .09], [0, 0, -.6]);
    part(h, `Claw_Hook_${k}`, hook, claw, [.32, .5, 0], [.06, .32, .06], [0, 0, -1.4]);
  }
  let broken = false, curl = .14, spread = .3;
  return {
    root,
    breakShell() { broken = true; for (const s of shells) s.visible = false; flesh.emissiveIntensity = .75; belly.emissiveIntensity = .5; },
    restoreShell() { broken = false; for (const s of shells) s.visible = true; flesh.emissiveIntensity = .35; belly.emissiveIntensity = .25; },
    get shellBroken() { return broken; },
    update(time: number, _moving: boolean, attacking: boolean, mode?: string) {
      // Rest: hooked toward the player. Windup: rears back with the claw open. Recover (the swing): slams forward.
      const target = attacking ? -.1 : mode === 'recover' ? .32 : mode === 'stagger' ? .02 : .14 + Math.sin(time * 1.1) * .025;
      curl += (target - curl) * (mode === 'recover' ? .35 : .1);
      spread += ((attacking ? .9 : mode === 'recover' ? .1 : .35) - spread) * .15;
      const sway = Math.sin(time * .8) * .04;
      joints.forEach((j, i) => { j.rotation.x = curl * (.4 + i * .22); j.rotation.z = sway * (i % 2 ? 1 : -1) * (1 + i * .1); });
      hooks.forEach(h => { h.rotation.z = -spread * .6; });
      tendrils.forEach((t, k) => { t.scale.y = .8 + Math.sin(time * 1.7 + k * 2) * .15; });
      water.emissiveIntensity = .45 + Math.sin(time * 2.1) * .12 + (attacking ? .35 : 0);
    },
  };
}

/** E04 石甲: a low six-legged creature under a domed, segmented stone carapace. The glowing seams
 * between segments are its weak spots, plainest from above. Windup lifts the front and opens them. */
export function makeStoneArmour(geometries: THREE.BufferGeometry[], materials: THREE.Material[], lead = false) {
  const { part, mat, geo } = kit(geometries, materials);
  const root = new THREE.Group(); root.name = lead ? 'Egypt_Stone_Armour_Lead' : 'Egypt_Stone_Armour';
  const stone = mat({ color: lead ? '#b29a6c' : '#a39374', roughness: .95, metalness: 0, flatShading: true });
  const dark = mat({ color: '#4a4336', roughness: .85 });
  const seam = mat({ color: '#7fe9dc', emissive: '#2fd6c6', emissiveIntensity: .9, roughness: .3 });
  const eye = mat({ color: '#ffe08a', emissive: '#ffb84a', emissiveIntensity: 1.3 });
  const dome = geo(new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2)), band = geo(new THREE.TorusGeometry(1, .05, 6, 20, Math.PI));
  const bead = geo(new THREE.SphereGeometry(1, 10, 7)), limb = geo(new THREE.CylinderGeometry(1, .75, 1, 6)), horn = geo(new THREE.ConeGeometry(1, 1, 6));
  const body = new THREE.Group(); body.name = 'Stone_Body'; body.position.y = .55; root.add(body);
  part(body, 'Stone_Belly', bead, dark, [0, -.02, 0], [.62, .22, .95]);
  // Four carapace segments, the middle ones highest, overlapping front to back; glowing bands between.
  const segs: THREE.Mesh[] = [], zs = [-.62, -.22, .18, .55], hs = [.42, .55, .55, .44];
  zs.forEach((z, i) => {
    segs.push(part(body, `Stone_Plate_${i}`, dome, stone, [0, .02, z], [.72 - Math.abs(i - 1.5) * .06, hs[i], .3], [-.06 + i * .04, 0, 0]));
    if (i < 3) part(body, `Stone_Seam_${i}`, band, seam, [0, .02, (z + zs[i + 1]) / 2], [.7 - Math.abs(i - 1) * .04, hs[i] * .98, 1], [0, Math.PI / 2, 0]);
  });
  part(body, 'Stone_Spine_Seam', bead, seam, [0, .58, -.02], [.05, .04, .8]);
  if (lead) for (let i = 0; i < 4; i++) part(body, `Stone_Ridge_${i}`, horn, stone, [0, hs[i] + .08, zs[i]], [.1, .22, .1]);
  // Head: a low wedge with amber eyes, mandibles and a short horn.
  const head = new THREE.Group(); head.name = 'Stone_Head'; head.position.set(0, .02, .85); body.add(head);
  part(head, 'Stone_Brow', dome, stone, [0, 0, 0], [.36, .26, .3], [.3, 0, 0]);
  part(head, 'Stone_Horn', horn, stone, [0, .26, .12], [.08, .3, .08], [.6, 0, 0]);
  for (const side of [-1, 1]) {
    part(head, `Stone_Eye_${side}`, bead, eye, [side * .15, .08, .24], [.055, .055, .04]);
    part(head, `Stone_Mandible_${side}`, horn, dark, [side * .16, -.08, .3], [.05, .3, .05], [Math.PI / 2, side * .3, 0]);
  }
  // Six two-part legs: thigh out and up to the knee, shin down to the ground.
  const legs: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(side * .5, 0, -.45 + i * .45); body.add(hip); legs.push(hip);
    part(hip, `Stone_Thigh_${i}_${side}`, limb, dark, [side * .2, .1, 0], [.07, .45, .07], [0, 0, side * -1.1]);
    part(hip, `Stone_Knee_${i}_${side}`, bead, stone, [side * .4, .2, 0], [.08, .08, .08]);
    part(hip, `Stone_Shin_${i}_${side}`, limb, dark, [side * .48, -.17, 0], [.06, .72, .06], [0, 0, side * .25]);
  }
  root.scale.setScalar(lead ? 1.5 : 1.25);
  return {
    root,
    update(time: number, moving: boolean, attacking: boolean, mode?: string) {
      legs.forEach((hip, i) => { hip.rotation.x = moving ? Math.sin(time * 11 + (i % 2 ? Math.PI : 0) + Math.floor(i / 2)) * .4 : 0; });
      // Windup lifts the front and spreads the segments, so the seams open; the strike lunges down.
      const pitch = attacking ? -.3 : mode === 'recover' ? .12 : 0;
      body.rotation.x += (pitch - body.rotation.x) * .15;
      segs.forEach((p, i) => { p.position.z = zs[i] + (attacking ? (i - 1.5) * .05 : 0); });
      seam.emissiveIntensity = (attacking ? 1.7 : .85) + Math.sin(time * 3) * .15;
      body.position.y = .55 + (moving ? Math.abs(Math.sin(time * 11)) * .03 : 0);
    },
  };
}
