import * as THREE from 'three';
import { mergeParts } from '../settlements/merge';
import { toonMaterial } from '../rendering/look';
import footings from './roof-mounts.json';

type RoofRegion = keyof typeof footings;
type Mount = (typeof footings)[RoofRegion][number];
type Vec3 = [number, number, number];

const cube = new THREE.BoxGeometry();
const round = new THREE.CylinderGeometry(1, 1, 1, 8);
const rainCap = new THREE.ConeGeometry(1, 1, 8);
// Return the clay wall down the inside of the lip so it has a visible open mouth.
const pot = new THREE.LatheGeometry([
  [.26, 0], [.26, .08], [.2, .13], [.16, .57], [.22, .60],
  [.22, .69], [.145, .69], [.135, .62], [.115, .15],
].map(([r, y]) => new THREE.Vector2(r, y)), 10);

function fitMount(region: RoofRegion, mount: Mount, parts: THREE.BufferGeometry[]) {
  const { id, low, high, x, z, yaw } = mount;
  const frame = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, high, z);
  function add(shape: THREE.BufferGeometry, color: string, at: Vec3, size: Vec3, pitch = 0, roll = 0) {
    const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0, roll));
    const pose = new THREE.Matrix4().compose(new THREE.Vector3(...at), turn, new THREE.Vector3(...size));
    const part = shape.clone().applyMatrix4(pose.premultiply(frame));
    const tone = new THREE.Color(color);
    const colors = new Uint8Array(part.attributes.position.count * 3);
    const rgb = tone.toArray().map(c => Math.round(c * 255));
    for (let i = 0; i < colors.length; i += 3) colors.set(rgb, i);
    part.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
    parts.push(part);
  }
  const box = (color: string, at: Vec3, size: Vec3, roll = 0) => add(cube, color, at, size, 0, roll);
  const rise = high - low;
  if (region === 'orleans') {
    // Brickwork stopped below the separate coping. Key the sleeve into both pieces.
    const copingThickness = .25;
    box('#897866', [0, -(rise + copingThickness) / 2, 0], [.77, rise - copingThickness + .018, .77]);
    const count = id % 6 === 4 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const clay = ['#a86650', '#876153', '#b47955'][id % 3];
      add(pot, clay, [(i - (count - 1) / 2) * .53, -.016, 0], [1, .85 + .12 * (id % 4), 1]);
    }
    return;
  }

  // The flashing extends under every measured corner of the pitched roof.
  const stone = region === 'egypt' ? '#b99665' : region === 'winter' ? '#826756' : '#625c55';
  box(stone, [0, (.14 - rise) / 2, 0], [.74, rise + .18, .74]);
  if (region === 'egypt') {
    if (id % 6 !== 5) {
      add(pot, '#ae7851', [0, .14, 0], [1.26, 1.2, 1.26]);
      return;
    }
    // A mudbrick intake with one open throat and a sloped reed cover.
    box('#ac8559', [0, .55, -.28], [.67, .86, .12]);
    for (const side of [-1, 1]) box('#c09b6e', [side * .285, .54, 0], [.12, .82, .65]);
    add(cube, '#876649', [0, 1.02, 0], [.82, .12, .86], -.13);
    return;
  }
  if (region === 'winter') {
    add(pot, '#595257', [0, .14, 0], [1.04, 1.24, 1.04]);
    for (const side of [-1, 1]) box('#62585a', [side * .14, 1.08, 0], [.06, .26, .07]);
    add(rainCap, '#756963', [0, 1.25, 0], [.32, .18, .32]);
    return;
  }
  const qin = region === 'qin';
  const timber = qin ? '#885142' : '#695544';
  const tiled = qin ? '#616d6b' : '#575b67';
  const eave = qin ? 1.02 : .78;
  // Smoke hatches have a through-slot between four uprights and a tiled gable.
  for (const bx of [-.26, .26]) for (const bz of [-.26, .26])
    box(timber, [bx, (eave + .12) / 2, bz], [.105, eave - .12, .105]);
  for (const side of [-1, 1]) {
    box(timber, [side * .26, eave - .04, 0], [.11, .14, .7]);
    box(tiled, [side * .205, eave + .075, 0], [.50, .10, .84], -side * .38);
    if (qin) for (const h of [.39, .60]) add(cube, '#735d4e', [0, h, side * .255], [.50, .08, .08], side * -.48);
  }
  add(round, tiled, [0, eave + .17, 0], [.075, .86, .075], Math.PI / 2);
}

/** Build one mesh per occupied host chunk. A fixture is hidden, warmed and evicted with its roof. */
export function attachRoofFixtures(region: string, host: string, pieces: readonly THREE.Mesh[]): THREE.Mesh[] {
  if (!Object.hasOwn(footings, region)) return [];
  const mounts = footings[region as RoofRegion].filter(row => row.host === host);
  if (!mounts.length || !pieces.length) return [];
  const bins = new Map<THREE.Mesh, THREE.BufferGeometry[]>();
  const point = new THREE.Vector3();
  for (const mount of mounts) {
    point.set(mount.x, mount.high, mount.z);
    let owner: THREE.Mesh | undefined, shortest = Infinity;
    for (const piece of pieces) {
      const bounds = piece.geometry.boundingBox;
      if (!bounds) continue;
      const distance = bounds.distanceToPoint(point);
      if (distance < shortest) { owner = piece; shortest = distance; }
    }
    // A carve may have removed the host entirely. Never mount to the nearest remaining street.
    if (!owner || shortest > .02) continue;
    const parts = bins.get(owner) ?? [];
    fitMount(region as RoofRegion, mount, parts);
    bins.set(owner, parts);
  }
  if (!bins.size) return [];
  const source = new THREE.MeshStandardMaterial({ vertexColors: true });
  source.name = 'M_RoofFixtures';
  const material = toonMaterial(source);
  source.dispose();
  const meshes: THREE.Mesh[] = [];
  for (const [owner, parts] of bins) {
    const geometry = mergeParts(parts);
    for (const part of parts) part.dispose();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'RoofFixtures_' + host;
    mesh.castShadow = mesh.receiveShadow = true;
    owner.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}
