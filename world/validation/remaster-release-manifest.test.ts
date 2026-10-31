import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {CHARACTER_KITS} from '../src/characters/catalog';
const repo=new URL('../../',import.meta.url);
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
test('current remaster release metadata matches catalog, native counts and preserved published f6 bytes',async()=>{
 const manifest=JSON.parse(await readFile(new URL('assets/characters/CHARACTER_KIT_MANIFEST.json',repo),'utf8'));
 for(const entry of manifest.characters){
  const current=entry.runtime,old=entry.published_f6_runtime;
  assert.equal(fileURLToPath(new URL(CHARACTER_KITS[entry.id as keyof typeof CHARACTER_KITS].assetUrl)),fileURLToPath(new URL(current.gzip_path,repo)));
  for(const info of [current,old]){
   const [raw,gz]=await Promise.all([readFile(new URL(info.raw_path,repo)),readFile(new URL(info.gzip_path,repo))]);
   assert.equal(raw.length,info.raw_bytes);assert.equal(gz.length,info.gzip_bytes);assert.equal(sha(raw),info.raw_sha256);assert.equal(sha(gz),info.gzip_sha256);assert.deepEqual(gunzipSync(gz),raw);
  }
  const raw=await readFile(new URL(current.raw_path,repo));const glb=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)).toString());
  let triangles=0,primitives=0;
  for(const mesh of glb.meshes)for(const primitive of mesh.primitives){assert.equal(primitive.mode??4,4);triangles+=glb.accessors[primitive.indices??primitive.attributes.POSITION].count/3;primitives++;}
  assert.equal(current.triangles,triangles);assert.equal(current.draw_primitives,primitives);assert.equal(current.materials,glb.materials.length);assert.equal(current.embedded_images,glb.images.length);
  assert.equal(current.bones,new Set(glb.skins.flatMap((skin:{joints:number[]})=>skin.joints)).size);
  for(const p of [entry.remaster_manifest,entry.remaster_provenance,...entry.provenance])assert((await readFile(new URL('assets/characters/'+p,repo))).length>0);
  const specific=JSON.parse(await readFile(new URL('assets/characters/'+entry.remaster_manifest,repo),'utf8'));
  assert.equal(current.gzip_sha256,entry.id==='musashi'?specific.files['Musashi_Runtime.glb.gz'].sha256:specific.gzipSha256);
 }
});
