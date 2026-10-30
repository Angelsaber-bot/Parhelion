/** Exact runtime geometry export for offline inspection, not browser rendering. */
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { createTraversalRepairs } from '../../src/traversalRepairs';
const repair = createTraversalRepairs();
const mesh = repair.root.children[0] as THREE.Mesh;
writeFileSync(new URL('./repair-geometry.json',import.meta.url),JSON.stringify({
  position:Array.from(mesh.geometry.attributes.position.array),
  color:Array.from(mesh.geometry.attributes.color.array),
}));
repair.dispose();
