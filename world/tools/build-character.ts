// Exports the procedural explorer as public/assets/character_explorer.glb (joint hierarchy kept),
// so it can be opened in Blender as the base for a hand-made model.
//   npm run build:character
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCharacter } from '../src/character.js';

(globalThis as any).FileReader ??= class {
  result: ArrayBuffer | null = null;
  onload: ((e: unknown) => void) | null = null;
  onloadend: ((e: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((buf) => { this.result = buf; this.onload?.({ target: this }); this.onloadend?.({ target: this }); });
  }
};

const mat = new THREE.MeshStandardMaterial({ name: 'M_Toon', vertexColors: true, roughness: 1 });
const { root } = buildCharacter(mat);
const scene = new THREE.Scene();
scene.add(root);
const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/assets/character_explorer.glb');
writeFileSync(out, Buffer.from(glb));
console.log(`character_explorer.glb ${(glb.byteLength / 1024).toFixed(0)} KB`);
