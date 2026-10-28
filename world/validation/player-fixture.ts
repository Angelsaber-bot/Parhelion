import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildSkinnedCharacter } from '../src/skinnedCharacter.ts';
import { attachExplorerRifle } from '../src/weaponArt.ts';

/** Node metadata/geometry fixture only. This is not an image renderer or a browser visual pass. */
export function nodeImageMetadata() {
  (globalThis as any).self ??= globalThis;
  (globalThis as any).createImageBitmap ??= async (blob: Blob) => {
    const data = new DataView(await blob.arrayBuffer());
    const png = data.byteLength >= 24 && data.getUint32(0) === 0x89504e47;
    return { width: png ? data.getUint32(16) : 1, height: png ? data.getUint32(20) : 1, close() {} };
  };
}
export async function parseLocalGlb(path: URL) {
  nodeImageMetadata();
  const data = await readFile(path);
  return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
}
export async function playerFixture(outlines = false) {
  const gltf = await parseLocalGlb(new URL('../../assets/characters/player_v2/player_v2.glb', import.meta.url));
  const rig = buildSkinnedCharacter(gltf.scene, { outlines });
  const rifle = attachExplorerRifle(rig, undefined, () => parseLocalGlb(new URL('../../assets/weapons/glb/01_Dawn_AR.glb', import.meta.url)));
  await rifle.ready;
  return { rig, rifle, dispose() { rifle.dispose(); rig.dispose(); } };
}
