/** These checks use the files loaded by the running game, not the authoring GLBs.
 * A generator fix is incomplete if its core/visual delivery asset is left stale. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';

const asset = (name: string) => new URL(`../public/assets/${name}`, import.meta.url);
async function load(region: string, kind: 'core' | 'visual') {
  const bytes = readFileSync(asset(`world_${region}.${kind}.glb`));
  const { scene } = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(scene); return scene;
}
function bvh(scene: THREE.Object3D, name: string) {
  const mesh = scene.getObjectByName(name) as THREE.Mesh;
  assert.ok(mesh?.isMesh, `${name} must reach the shipped stream`);
  return new MeshBVH(mesh.geometry);
}
function dispose(scene: THREE.Object3D) {
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { geometry.add(m.geometry); for (const material of Array.isArray(m.material) ? m.material : [m.material]) materials.add(material); } });
  geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}
const down = new THREE.Vector3(0, -1, 0);

test('delivery manifest contains all eight maps and current asset sizes', () => {
  const manifest = JSON.parse(readFileSync(asset('world-stream.manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest).sort(), ['alpha', 'blacksail', 'britain', 'egypt', 'kyoto', 'orleans', 'qin', 'winter']);
  for (const region of Object.keys(manifest)) for (const kind of ['source', 'core', 'visual']) {
    const suffix = kind === 'source' ? '' : `.${kind}`;
    assert.equal(manifest[region][kind], statSync(asset(`world_${region}${suffix}.glb`)).size, `${region} ${kind} was regenerated together`);
  }
});

test('streamed Round Hall paving meets the retained 34m walking floor', async () => {
  const scene = await load('britain', 'visual');
  try {
    const paving = bvh(scene, 'Britain_Physical_Limestone');
    for (const angle of [.25, 1.1, 2.2, 3.2, 4.3, 5.2]) {
      const ray = new THREE.Ray(new THREE.Vector3(-215 + Math.cos(angle) * 9, 35, -165 + Math.sin(angle) * 9), down);
      const hit = paving.raycastFirst(ray, THREE.DoubleSide);
      assert.ok(hit && Math.abs(hit.point.y - 34) < .04, 'delivery must not restore the old 16cm raised surface');
    }
  } finally { dispose(scene); }
});

test('streamed Valley workshop and forest log meet their actual collision surfaces', async () => {
  const core = await load('alpha', 'core'), visual = await load('alpha', 'visual');
  try {
    const campus = bvh(visual, 'Campus'), log = bvh(visual, 'Crossings');
    const ground = bvh(core, 'COL_Terrain'), props = bvh(core, 'COL_Props');
    const compare = (visible: MeshBVH, x: number, z: number, y: number) => {
      const ray = new THREE.Ray(new THREE.Vector3(x, y, z), down);
      const skin = visible.raycastFirst(ray, THREE.DoubleSide);
      const physical = [ground, props].map(s => s.raycastFirst(ray, THREE.DoubleSide)).filter(h => h !== null).sort((a, b) => a.distance - b.distance)[0];
      assert.ok(skin && physical && Math.abs(skin.point.y - physical.point.y) < .03, `delivered surface vs physical floor at ${x},${z}`);
    };
    for (const [x, z] of [[-81, 246], [-81, 254], [-74, 244], [-74, 257], [-68, 246], [-68, 255]]) compare(campus, x, z, 10.5);
    const axis = new THREE.Vector2(-12, -38).normalize();
    for (const along of [-14, -10, -5, 0, 5, 10, 14]) for (const across of [-.5, 0, .5]) {
      compare(log, 81 + axis.x * along - axis.y * across, -36 + axis.y * along + axis.x * across, 5);
    }
  } finally { dispose(core); dispose(visual); }
});

test('streamed Yasaka stone support reaches from the slope to the downhill timber', async () => {
  const scene = await load('kyoto', 'core');
  try {
    const ground = bvh(scene, 'COL_Terrain'), stone = bvh(scene, 'Kyoto_Hillside_Foundations'), solid = bvh(scene, 'COL_Kyoto_Hillside_Foundations');
    for (const x of [209.7, 212, 214.3]) {
      const ray = new THREE.Ray(new THREE.Vector3(x, 12, -14), down);
      const floor = ground.raycastFirst(ray, THREE.DoubleSide)!;
      const visible = stone.raycast(ray, THREE.DoubleSide).sort((a, b) => a.distance - b.distance);
      const physical = solid.raycast(ray, THREE.DoubleSide).sort((a, b) => a.distance - b.distance);
      assert.ok(visible.length >= 2 && physical.length >= 2, 'both stone and matching support are in the core asset');
      assert.ok(visible[0].point.y > 8.02 && visible[0].point.y < 8.13);
      assert.ok(visible.at(-1)!.point.y < floor.point.y - .06, 'stone extends beneath real terrain');
      assert.ok(Math.abs(visible[0].point.y - physical[0].point.y) < .025);
    }
  } finally { dispose(scene); }
});

test('streamed winter ruins retain cover and no longer block their burned-away openings', async () => {
  const scene = await load('winter', 'core'), visual = await load('winter', 'visual');
  try {
    const shell = scene.getObjectByName('COL_Winter_Ruin_Shells');
    assert.ok(shell, 'replacement ruin collision must be shipped');
    const houses = shell.userData.houses as { p: [number, number, number]; size: [number, number, number]; ry: number }[];
    assert.equal(houses.length, 13);
    const surfaces: MeshBVH[] = [];
    scene.getObjectByName('COLLISION')!.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.opensWhen && !m.userData.target) surfaces.push(new MeshBVH(m.geometry)); });
    const art = [scene.getObjectByName('ART')!, visual];
    for (const root of art) root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) for (const material of Array.isArray(m.material) ? m.material : [m.material]) material.side = THREE.DoubleSide; });
    const rubble = bvh(scene, 'COL_Winter_Ruin_Shells');
    for (const house of houses) for (const side of [-1, 1]) {
      const local = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), house.ry).add(new THREE.Vector3(...house.p));
      let clear = 0;
      // Nearby houses and tree trunks are retained obstacles. Check real clear
      // lines through this opening, not an assumed empty corridor beyond it.
      for (const x of [-house.size[0] * .2, 0, house.size[0] * .2]) {
        const from = local(x, 2.1, side * (house.size[2] / 2 + .08)), to = local(x, 2.1, -side * (house.size[2] / 2 + .08));
        const ray = new THREE.Ray(from, to.clone().sub(from).normalize());
        const distance = from.distanceTo(to);
        if (!new THREE.Raycaster(from, ray.direction, 0, distance).intersectObjects(art, true).length) {
          clear++;
          assert.equal(surfaces.some(surface => surface.raycastFirst(ray, THREE.DoubleSide, 0, distance)), false, 'clear visible opening has no leftover box collider');
        }
      }
      assert.ok(clear > 0, 'at least one actual through-opening remains on each end');
      const from = local(0, 1, side * (house.size[2] / 2 + .08)), to = local(0, 1, 0);
      assert.ok(rubble.raycastFirst(new THREE.Ray(from, to.clone().sub(from).normalize()), THREE.DoubleSide, 0, from.distanceTo(to)), 'low rubble remains solid cover');
    }
  } finally { dispose(scene); dispose(visual); }
});
