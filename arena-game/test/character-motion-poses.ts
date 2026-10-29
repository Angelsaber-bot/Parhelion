// Reproducible actual-rig mesh export for offline pose evidence (not a GPU/FPS benchmark).
// npx tsx test/character-motion-poses.ts /path/to/output.json [/absolute/baseline/src/fighter.ts]
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import * as current from '../src/fighter.ts';

const baseline = process.argv[3] ? await import(pathToFileURL(process.argv[3]).href) as typeof current : null;
const captures: unknown[] = [];
for (const [version, source] of [['before', baseline], ['after', current]] as const) {
  if (!source) continue;
  for (const name of ['forward', 'backward', 'strafe', 'apex', 'reset'] as const) {
    const rig = source.buildFighter(1, 0x4fd6e0), anim = new source.FighterAnimator(rig);
    if (name === 'reset') {
      for (let i = 0; i < 60; i++) anim.update(1 / 60, 5, -4, true, false, 3, 4);
      // Before: Avatar.resetMotion only cleared sampled velocity, not FighterAnimator's pose.
      anim.reset?.(); anim.update(1 / 60, 0, 0, false, true, 0, 0);
    } else {
      for (let i = 0; i < 13; i++) anim.update(1 / 60, 5, name === 'apex' ? 5 : 0, false, name !== 'apex', name === 'backward' ? -5 : name === 'strafe' ? 0 : 5, name === 'strafe' ? 5 : 0);
      if (name === 'apex') for (let i = 0; i < 20; i++) anim.update(1 / 60, 5, 0, false, false, 5, 0);
    }
    rig.root.updateMatrixWorld(true);
    const meshes: { positions: number[]; colors: number[]; indices: number[] }[] = [];
    const point = new THREE.Vector3();
    rig.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const geo = mesh.geometry, position = geo.getAttribute('position'), color = geo.getAttribute('color');
      const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshToonMaterial;
      const positions: number[] = [], colors: number[] = [];
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld); positions.push(...point.toArray());
        colors.push(color ? color.getX(i) : material.color.r, color ? color.getY(i) : material.color.g, color ? color.getZ(i) : material.color.b);
      }
      meshes.push({ positions, colors, indices: geo.index ? Array.from(geo.index.array) : Array.from({ length: position.count }, (_, i) => i) });
    });
    captures.push({ version, name, meshes, joints: Object.fromEntries(Object.entries(rig.joints).map(([key, joint]) => [key, { position: joint.position.toArray(), rotation: joint.rotation.toArray().slice(0, 3) }])) });
  }
}
await writeFile(process.argv[2] || '/tmp/arena-character-motion-poses.json', JSON.stringify({ note: 'Actual procedural Vega meshes, fixed simulation inputs, before/after; no map or lighting comparison.', captures }));
