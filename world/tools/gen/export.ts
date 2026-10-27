// Shared GLB/layout writer for every World region generator.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { reorder, quantize, weldPrimitive } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import type { Piece } from './structures.js';
import type { Marker } from './layout.js';
import { kyotoMaterialProfile } from '../../src/kyotoMaterialProfiles.js';
import { winterMaterialProfile } from '../../src/winterMaterialProfiles.js';
import { blackSailMaterialProfile } from '../../src/blackSailMaterialProfiles.js';
import { britainMaterialProfile } from '../../src/britainMaterialProfiles.js';
import { valleyMaterialProfile } from '../../src/valleyMaterialProfiles.js';

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
const outDir = resolve(here, '../../public/assets');

export interface RegionOut {
  file: string; // basename, e.g. world_alpha
  world: { id: string; version: number; seed: number; half: number; waterLevel: number };
  terrain: { vis: THREE.BufferGeometry; col: THREE.BufferGeometry };
  pieces: Piece[];
  markers: Marker[];
  layout: Record<string, unknown>;
  /** water plane size (m); defaults to the map size. A sea region uses a larger one for the horizon. */
  waterSize?: number;
}

/** Portable alpha approximation only; glTF cannot represent the runtime additive beam. */
export function applyBlackSailBeamFallback(material: THREE.Material, regionFile: string) {
  if (regionFile === 'world_blacksail' && material.name === 'M_Beam') {
    Object.assign(material, { side: THREE.DoubleSide, transparent: true, opacity: 0.28, depthWrite: false });
  }
}

export async function writeRegion(r: RegionOut) {
  const { world: W } = r;
  const materials = new Map<string, THREE.Material>();
  const mat = (name: string) => {
    let m = materials.get(name);
    if (!m) {
      const kyotoProfile = kyotoMaterialProfile(name);
      const winterProfile = winterMaterialProfile(name);
      const blackSailProfile = blackSailMaterialProfile(name);
      const britainProfile = britainMaterialProfile(name);
      const valleyProfile = valleyMaterialProfile(name);
      const profile = kyotoProfile ?? winterProfile ?? blackSailProfile ?? britainProfile ?? valleyProfile;
      m = new THREE.MeshStandardMaterial({ name, vertexColors: true, roughness: profile?.roughness ?? 1, metalness: profile?.metalness ?? 0 });
      if (kyotoProfile) m.userData = { kyotoSurface: name, artStyle: 'painted-anime' };
      if (winterProfile) m.userData = { winterSurface: name, artStyle: 'painted-anime' };
      if (blackSailProfile) m.userData = { blackSailSurface: name, artStyle: 'painted-anime' };
      if (britainProfile) m.userData = { britainSurface: name, artStyle: 'painted-anime' };
      if (valleyProfile) m.userData = { valleySurface: name, artStyle: 'painted-anime' };
      if (name === 'M_BlackSailCanvas' || name === 'M_BritainWool' || name === 'M_ValleyCanvas') m.side = THREE.DoubleSide; // thin sails/awnings read from both sides
      applyBlackSailBeamFallback(m, r.file);
      if (name === 'M_Water') Object.assign(m, { transparent: true, opacity: 0.75, vertexColors: false, color: new THREE.Color('#46b8d8') });
      if (name === 'M_Waterfall') Object.assign(m, { transparent: true, opacity: 0.7, vertexColors: false, color: new THREE.Color('#c9f3ff') });
      materials.set(name, m);
    }
    return m;
  };

  const root = new THREE.Group();
  root.name = W.id;
  root.userData = { world: W.id, version: W.version, seed: W.seed, units: 'meters', up: 'Y', north: '-Z' };
  const art = new THREE.Group(); art.name = 'ART';
  const collision = new THREE.Group(); collision.name = 'COLLISION'; collision.userData = { collision: true };
  const markerRoot = new THREE.Group(); markerRoot.name = 'MARKERS';
  root.add(art, collision, markerRoot);

  const terrainMesh = new THREE.Mesh(r.terrain.vis, mat('M_Terrain'));
  terrainMesh.name = 'Terrain';
  art.add(terrainMesh);

  const ws = r.waterSize ?? W.half * 2;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(ws, ws).rotateX(-Math.PI / 2), mat('M_Water'));
  water.geometry.deleteAttribute('uv');
  water.name = 'Water';
  water.geometry.translate(0, W.waterLevel, 0); // baked, not a node transform (see compress())
  water.userData = { water: true, level: W.waterLevel };
  art.add(water);

  const colTerrain = new THREE.Mesh(r.terrain.col, mat('M_Collision'));
  colTerrain.name = 'COL_Terrain';
  collision.add(colTerrain);

  const staticCol: THREE.BufferGeometry[] = [];
  let tris = r.terrain.vis.index!.count / 3;
  for (const p of r.pieces) {
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
    const c = new THREE.Mesh(mergeGeometries(staticCol), mat('M_Collision'));
    c.name = 'COL_Props';
    collision.add(c);
  }

  for (const m of r.markers) {
    const o = new THREE.Object3D();
    o.name = `MK_${m.type}_${m.id}`;
    o.position.set(...m.p);
    o.userData = { ...m };
    markerRoot.add(o);
  }

  const scene = new THREE.Scene();
  scene.add(root);
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: false })) as ArrayBuffer;
  mkdirSync(outDir, { recursive: true });
  const packed = await compress(new Uint8Array(glb), r.file === 'world_kyoto' || r.file === 'world_winter' || r.file === 'world_blacksail' || r.file === 'world_britain' || r.file === 'world_alpha');
  writeFileSync(resolve(outDir, `${r.file}.glb`), packed);
  writeFileSync(resolve(outDir, `${r.file}.layout.json`), JSON.stringify(r.layout, null, 1));
  return { bytes: packed.byteLength, tris };
}

/**
 * Meshopt-compress + quantize (16-bit positions ≈ 1 cm over a 720 m region). Cloudflare Pages caps a
 * file at 25 MiB; the raw export of 幻日谷 is ~32 MiB, compressed ~5 MiB. The runtime decodes with
 * MeshoptDecoder and folds the dequantization back into the geometry (src/glb.ts), so every mesh node
 * must carry an identity transform here.
 */
async function compress(glb: Uint8Array, exactWeld = false) {
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.readBinary(glb);
  doc.setLogger(new (class { debug() {} info() {} warn(m: string) { console.warn(m); } error(m: string) { console.error(m); } })() as never);
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeColor: 8 }));
  // The five crafted regions' dense ART geometry reuses only bitwise-identical full vertices.
  // No simplification, tolerance-based welding, triangle removal or material change.
  if (exactWeld) for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      // Collision contact resolution depends on stable triangle ordering.
      if (primitive.getMaterial()?.getName() !== 'M_Collision') weldPrimitive(primitive, { overwrite: true });
    }
  }
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  return io.writeBinary(doc);
}
