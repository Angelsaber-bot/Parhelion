/** Actual runtime GPU-skin poses evaluated on CPU for offline review; not a browser/FPS test. */
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { playerFixture } from '../player-fixture.ts';
import { SkinnedCharacterAnimator, type PlayerAnimationState } from '../../src/skinnedCharacter.ts';

const out = process.argv[2]; if (!out) throw new Error('Provide local output directory');
const label = process.argv[3] ?? 'after'; await mkdir(out, { recursive: true });
const base: PlayerAnimationState = { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: 0 };
const glide = { ...base, onGround: false, gliding: true, speed: 8, vy: -2 };
async function dump(root: THREE.Object3D, id: string) {
  root.updateWorldMatrix(true, true); const meshes: any[] = [];
  root.traverseVisible(object => {
    const mesh = object as THREE.Mesh; if (!mesh.isMesh || mesh.userData.playerOutline) return;
    const count = mesh.geometry.attributes.position.count, positions = new Float32Array(count * 3), uv = new Float32Array(count * 4);
    const point = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).toArray(positions, i * 3);
      for (const [channel, name] of ['uv', 'uv1'].entries()) {
        const attr = mesh.geometry.attributes[name]; if (attr) { uv[i * 4 + channel * 2] = attr.getX(i); uv[i * 4 + channel * 2 + 1] = attr.getY(i); }
      }
    }
    const index = mesh.geometry.index, indices = new Uint32Array(index ? index.array : Array.from({ length: count }, (_, i) => i));
    meshes.push({ name: mesh.name, file: `${id}-${meshes.length}.bin`, count, indices: indices.length, groups: mesh.geometry.groups,
      materials: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(material => {
        const m = material as THREE.MeshStandardMaterial;
        return { name: m.name, color: m.color.toArray(), roughness: m.roughness, metalness: m.metalness };
      }), data: Buffer.concat([Buffer.from(positions.buffer), Buffer.from(uv.buffer), Buffer.from(indices.buffer)]) });
  });
  for (const mesh of meshes) { await writeFile(`${out}/${mesh.file}`, mesh.data); delete mesh.data; }
  await writeFile(`${out}/${id}.json`, JSON.stringify({ id, label, assets: [
    fileURLToPath(new URL('../../../assets/characters/player_v2/player_v2.glb', import.meta.url)),
    fileURLToPath(new URL('../../../assets/weapons/glb/01_Dawn_AR.glb', import.meta.url)),
  ], meshes }));
}
for (const [id, state] of [
  ['walk', { ...base, speed: 5.5 }], ['run', { ...base, speed: 9 }],
  ['move-aim', { ...base, speed: 5.5, aim: 1, pitch: .3 }], ['glide', glide],
  ...label === 'after' ? [['unarmed-walk', { ...base, speed: 5.5, armed: false }], ['unarmed-idle', { ...base, armed: false }]] as const : [],
] as const) {
  const f = await playerFixture(), animator = new SkinnedCharacterAnimator(f.rig);
  for (let i = 0; i < 138; i++) animator.update(1 / 60, state);
  await dump(f.rig.root, `${label}-${id}`);
  if (id === 'glide' && label === 'after') {
    for (let i = 0; i < 10; i++) animator.update(1 / 60, base);
    await dump(f.rig.root, 'after-stow-167ms');
    for (let i = 0; i < 11; i++) animator.update(1 / 60, base);
    await dump(f.rig.root, 'after-stow-350ms');
  }
  f.dispose();
}
console.log(`CPU-skinned actual player/Dawn snapshots: ${out} (${label})`);
