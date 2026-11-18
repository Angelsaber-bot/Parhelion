/**
 * Arena match copies of the curated World hero GLBs.
 *
 * Arena draws up to eight heroes plus their shadows at combat distance; the World masters carry
 * 120k–917k triangles and 2048² textures for close third-person and cinematic shots. Each Arena copy
 * keeps the same node hierarchy, skins, bones, inverse bind matrices, morph targets, materials and
 * animation clips, and only:
 *  - simplifies every primitive with meshoptimizer toward ARENA_TRIANGLES for the whole hero, bounded
 *    by a geometric error of ARENA_ERROR (a fraction of each primitive's radius); seams stay intact;
 *  - removes the meshes Arena never shows (Napoleon's horse and reins, hidden by worldHero.ts);
 *  - resizes textures to at most ARENA_TEXTURE px and stores them as WebP (EXT_texture_webp);
 *  - quantizes and meshopt-compresses the result (EXT_meshopt_compression, KHR_mesh_quantization).
 * The curated sources stay untouched and hash-pinned by their own manifests.
 *
 *   node --import tsx tools/build-arena-heroes.ts            # rebuild every hero
 *   node --import tsx tools/build-arena-heroes.ts --check    # exit 1 when a source changed since the build
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { getPrimitiveVertexCount, prune, quantize, reorder, simplifyPrimitive, textureCompress, VertexCountMethod, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

export const ARENA_TRIANGLES = 120_000;
export const ARENA_ERROR = .002;
export const ARENA_TEXTURE = 1024;
/** Arena hides these nodes' meshes (worldHero.ts); the copies leave them out. */
export const ARENA_HIDDEN = /^(Horse_|Rein_)|White_horse|White horse/i;

export interface ArenaHeroEntry { char: number; id: string; sources: string[]; output: string }
/** Paths relative to assets/characters/. Multi-part sources are concatenated before gunzip. */
export const ARENA_HEROES: ArenaHeroEntry[] = [
  { char: 2, id: 'artoria', sources: ['artoria_refined/runtime_revision2/armor/artoria_armor.glb.gz'], output: 'artoria_refined/runtime_revision2/armor/artoria_armor.arena.glb' },
  { char: 3, id: 'blackbeard', sources: ['blackbeard/remaster_v2/Blackbeard_Captain_Remaster.glb.gz'], output: 'blackbeard/remaster_v2/Blackbeard_Captain_Remaster.arena.glb' },
  { char: 4, id: 'musashi', sources: ['musashi/remaster_v2/Musashi_Runtime.glb.gz'], output: 'musashi/remaster_v2/Musashi_Runtime.arena.glb' },
  { char: 5, id: 'napoleon', sources: ['napoleon/remaster_v2/Napoleon_WhiteHorse_Remaster.glb.gz'], output: 'napoleon/remaster_v2/Napoleon_WhiteHorse_Remaster.arena.glb' },
  { char: 6, id: 'jeanne', sources: ['jeanne/final_20261110/runtime.part1.bin', 'jeanne/final_20261110/runtime.part2.bin'], output: 'jeanne/final_20261110/runtime.arena.glb' },
  { char: 7, id: 'ozymandias', sources: ['ozymandias/final_20261110/runtime.glb.gz'], output: 'ozymandias/final_20261110/runtime.arena.glb' },
  { char: 8, id: 'qin', sources: ['qin-shi-huang/final_20261110/runtime.glb.gz'], output: 'qin-shi-huang/final_20261110/runtime.arena.glb' },
];
export const ARENA_HEROES_MANIFEST = 'ARENA_HEROES_MANIFEST.json';
const root = new URL('../../assets/characters/', import.meta.url);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export function readHeroSource(entry: ArenaHeroEntry): Uint8Array {
  const transport = Buffer.concat(entry.sources.map(path => readFileSync(new URL(path, root))));
  const glb = transport[0] === 0x1f && transport[1] === 0x8b ? gunzipSync(transport) : transport;
  if (glb.readUInt32LE(0) !== 0x46546c67 || glb.readUInt32LE(8) !== glb.length) throw new Error(`${entry.id}: invalid GLB source`);
  return new Uint8Array(glb.buffer, glb.byteOffset, glb.byteLength);
}
export function triangles(doc: Document) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) n += Math.floor(getPrimitiveVertexCount(prim, VertexCountMethod.RENDER) / 3);
  return n;
}

export async function buildArenaHero(source: Uint8Array) {
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.readBinary(source);
  doc.setLogger(new (class { debug() {} info() {} warn(m: string) { if (!/out of \[0,1\] range|sparse accessors/.test(m)) console.warn(m); } error(m: string) { console.error(m); } })() as never);
  for (const node of doc.getRoot().listNodes()) if (node.getMesh() && ARENA_HIDDEN.test(node.getName())) node.setMesh(null);
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true }), weld());
  const before = triangles(doc), ratio = Math.min(1, ARENA_TRIANGLES / before);
  if (ratio < 1) for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives())
    simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error: ARENA_ERROR, lockBorder: false });
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 90, resize: [ARENA_TEXTURE, ARENA_TEXTURE] }),
    reorder({ encoder: MeshoptEncoder }),
    quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeColor: 8, cleanup: false }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  return { glb: await io.writeBinary(doc), before, after: triangles(doc) };
}

async function main() {
  const check = process.argv.includes('--check');
  const manifestUrl = new URL(ARENA_HEROES_MANIFEST, root);
  const manifest: Record<string, Record<string, unknown>> = existsSync(manifestUrl) ? JSON.parse(readFileSync(manifestUrl, 'utf8')) : {};
  let stale = 0;
  for (const entry of ARENA_HEROES) {
    const source = readHeroSource(entry), sourceSha = sha(source);
    if (check) {
      const recorded = manifest[entry.id], out = new URL(entry.output, root);
      const ok = recorded?.source_sha256 === sourceSha && existsSync(out) && sha(readFileSync(out)) === recorded.output_sha256;
      console.log(`${ok ? 'ok   ' : 'STALE'} ${entry.id}`); if (!ok) stale++; continue;
    }
    const t0 = performance.now(), { glb, before, after } = await buildArenaHero(source);
    writeFileSync(new URL(entry.output, root), glb);
    manifest[entry.id] = { char: entry.char, sources: entry.sources, source_sha256: sourceSha, source_bytes: source.byteLength, source_triangles: before,
      output: entry.output, output_sha256: sha(glb), output_bytes: glb.byteLength, output_triangles: after,
      settings: { triangles: ARENA_TRIANGLES, error: ARENA_ERROR, texture: ARENA_TEXTURE } };
    console.log(`${entry.id}: ${before} → ${after} triangles, ${(source.byteLength / 1e6).toFixed(1)} → ${(glb.byteLength / 1e6).toFixed(1)} MB in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
  if (check) { if (stale) { console.error(`${stale} stale Arena hero copies: node --import tsx tools/build-arena-heroes.ts`); process.exit(1); } return; }
  writeFileSync(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
