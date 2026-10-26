// Generates the World first area (幻日谷) blockout as GLB + layout JSON.
//   npm run build:world
// Output (deterministic for a given WORLD.seed):
//   public/assets/world_alpha.glb          visual meshes (ART), collision proxies (COLLISION), markers (MARKERS)
//   public/assets/world_alpha.layout.json  areas, river, paths, markers — for the viewer/minimap/server/AI
// The GLB opens directly in Blender (File > Import > glTF) for art passes; keep the node names.

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTerrain } from './gen/terrain.js';
import { buildStructures, type Piece } from './gen/structures.js';
import { buildVegetation } from './gen/vegetation.js';
import { WORLD, AREAS, RIVER, RIVER_OUT, PATHS, LAKE, POND } from './gen/layout.js';

// GLTFExporter uses FileReader to pack the binary buffer; Node only has Blob.
(globalThis as any).FileReader ??= class {
  result: ArrayBuffer | string | null = null;
  onload: ((e: unknown) => void) | null = null;
  onloadend: ((e: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((buf) => { this.result = buf; this.onload?.({ target: this }); this.onloadend?.({ target: this }); });
  }
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`;
      this.onload?.({ target: this }); this.onloadend?.({ target: this });
    });
  }
};

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../public/assets');

const t0 = performance.now();
const terrain = buildTerrain();
const { pieces, markers } = buildStructures(terrain.heightAt);
pieces.push(...buildVegetation(terrain.heightAt));

const materials = new Map<string, THREE.Material>();
const mat = (name: string) => {
  let m = materials.get(name);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ name, vertexColors: true, roughness: 1, metalness: 0 });
    if (name === 'M_Water') Object.assign(m, { transparent: true, opacity: 0.75, vertexColors: false, color: new THREE.Color('#46b8d8') });
    if (name === 'M_Waterfall') Object.assign(m, { transparent: true, opacity: 0.7, vertexColors: false, color: new THREE.Color('#c9f3ff') });
    materials.set(name, m);
  }
  return m;
};

const root = new THREE.Group();
root.name = WORLD.id;
root.userData = { world: WORLD.id, version: WORLD.version, seed: WORLD.seed, units: 'meters', up: 'Y', north: '-Z' };
const art = new THREE.Group(); art.name = 'ART';
const collision = new THREE.Group(); collision.name = 'COLLISION'; collision.userData = { collision: true };
const markerRoot = new THREE.Group(); markerRoot.name = 'MARKERS';
root.add(art, collision, markerRoot);

const terrainMesh = new THREE.Mesh(terrain.vis, mat('M_Terrain'));
terrainMesh.name = 'Terrain';
art.add(terrainMesh);

const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.half * 2, WORLD.half * 2).rotateX(-Math.PI / 2), mat('M_Water'));
water.geometry.deleteAttribute('uv');
water.name = 'Water';
water.position.y = WORLD.waterLevel;
water.userData = { water: true, level: WORLD.waterLevel };
art.add(water);

const colTerrain = new THREE.Mesh(terrain.col, mat('M_Collision'));
colTerrain.name = 'COL_Terrain';
collision.add(colTerrain);

const staticCol: THREE.BufferGeometry[] = [];
let tris = terrain.vis.index!.count / 3;
for (const p of pieces as Piece[]) {
  const { vis, col } = p.batch.build();
  if (vis) {
    const m = new THREE.Mesh(vis, mat(p.material));
    m.name = p.name;
    m.userData = { ...(p.userData ?? {}), outline: !!p.outline, dynamic: !!p.dynamic };
    art.add(m);
    tris += vis.attributes.position.count / 3;
  }
  if (col) {
    if (p.dynamic) {
      const c = new THREE.Mesh(col, mat('M_Collision'));
      c.name = `COL_${p.name}`;
      c.userData = { dynamic: true, art: p.name, ...(p.userData ?? {}) };
      collision.add(c);
    } else staticCol.push(col);
  }
}
{
  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const c = new THREE.Mesh(mergeGeometries(staticCol), mat('M_Collision'));
  c.name = 'COL_Props';
  collision.add(c);
}

for (const m of markers) {
  const o = new THREE.Object3D();
  o.name = `MK_${m.type}_${m.id}`;
  o.position.set(...m.p);
  o.userData = { ...m };
  markerRoot.add(o);
}

const scene = new THREE.Scene();
scene.add(root);
const exporter = new GLTFExporter();
const glb = (await exporter.parseAsync(scene, { binary: true, onlyVisible: false })) as ArrayBuffer;

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'world_alpha.glb'), Buffer.from(glb));

const layout = {
  world: WORLD,
  areas: AREAS,
  water: { lake: LAKE, pond: POND, river: [...RIVER, ...RIVER_OUT] },
  paths: PATHS,
  markers,
  objective: {
    id: 'restart_parhelion_tower',
    name: '重启幻日塔',
    steps: [
      { id: 'ruin_targets', text: '在回声森林遗迹击中 3 个机关靶，打开神龛', done: ['ruin_target_1', 'ruin_target_2', 'ruin_target_3'] },
      { id: 'relay_a', text: '启动中继器 A（森林遗迹）', done: ['relay_a'] },
      { id: 'relay_b', text: '清除旧观测站并启动中继器 B', done: ['relay_b'] },
      { id: 'tower', text: '前往幻日塔，启动控制台', done: ['tower_console'] },
    ],
  },
};
writeFileSync(resolve(outDir, 'world_alpha.layout.json'), JSON.stringify(layout, null, 1));

console.log(
  `world_alpha.glb ${(glb.byteLength / 1024 / 1024).toFixed(2)} MB, ~${Math.round(tris / 1000)}k tris, ` +
    `${markers.length} markers, ${pieces.length} pieces, ${((performance.now() - t0) / 1000).toFixed(1)}s`,
);
