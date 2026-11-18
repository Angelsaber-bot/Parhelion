import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {ArenaCharacter,WORLD_HERO_ASSETS,prepareWorldUVs} from '../src/player/worldHero.ts';
import {PLAYABLE_HERO_INDICES} from '../shared/content.ts';

type Entry={char:number;sources:string[];source_sha256:string;output:string;output_sha256:string;source_triangles:number;output_triangles:number};
const root=new URL('../../assets/characters/',import.meta.url);
const manifest:Record<string,Entry>=JSON.parse(readFileSync(new URL('ARENA_HEROES_MANIFEST.json',root),'utf8'));
const entries=Object.values(manifest);
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const source=(e:Entry)=>{const t=Buffer.concat(e.sources.map(p=>readFileSync(new URL(p,root))));return t[0]===0x1f&&t[1]===0x8b?gunzipSync(t):t;};
async function parse(bytes:Uint8Array):Promise<GLTF>{
 // Geometry, hierarchy, skins and clips are real; image decoding is not part of this test.
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 // Ahead of the built-in WebP plugin, which needs a browser Image to probe support.
 (loader as unknown as {pluginCallbacks:unknown[]}).pluginCallbacks.unshift(()=>({name:'TEST_TEXTURE',loadTexture:async()=>new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1)}));
 const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,'');prepareWorldUVs(gltf.scene);return gltf;
}
const bones=(g:GLTF)=>{const n:string[]=[];g.scene.traverse(o=>{if((o as THREE.Bone).isBone)n.push(o.name);});return n.sort();};
const tris=(g:GLTF)=>{let n=0;g.scene.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh)n+=(m.geometry.index?m.geometry.index.count:m.geometry.getAttribute('position').count)/3;});return n;};

describe('Arena match copies of the World heroes',()=>{
 it('cover every playable World hero and are what Arena loads',()=>{
  expect(entries.map(e=>e.char).sort()).toEqual(PLAYABLE_HERO_INDICES.filter(c=>c>=2).sort());
  for(const e of entries)expect(WORLD_HERO_ASSETS[e.char].urls[0]).toContain(e.output.split('/').pop()!);
 });
 for(const e of entries)it(`${e.output.split('/')[0]}: fresh, lighter, same skeleton and clips, and plays in Arena`,async()=>{
  const master=source(e),copy=new Uint8Array(readFileSync(new URL(e.output,root)));
  expect(sha(master),'master changed: rebuild with world/tools/build-arena-heroes.ts').toBe(e.source_sha256);expect(sha(copy)).toBe(e.output_sha256);
  const [a,b]=await Promise.all([parse(master),parse(copy)]);
  expect(bones(b)).toEqual(bones(a));
  expect(b.animations.map(c=>c.name).sort()).toEqual(a.animations.map(c=>c.name).sort());
  for(const clip of b.animations)expect(clip.duration).toBeCloseTo(a.animations.find(c=>c.name===clip.name)!.duration,4);
  expect(tris(b)).toBe(e.output_triangles);expect(tris(b)).toBeLessThanOrEqual(130_000);expect(tris(b)).toBeLessThanOrEqual(tris(a));
  // Arena never shows Napoleon's horse (worldHero.ts hides it), so the copies leave it out.
  const hidden=/^(Horse_|Rein_)|White_horse|White horse/i,box=(g:GLTF)=>{const out=new THREE.Box3();g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh&&!hidden.test(m.name)&&!hidden.test(m.parent?.name??''))out.expandByObject(m);});return out;},ba=box(a),bb=box(b);expect(bb.min.distanceTo(ba.min)).toBeLessThan(.05);expect(bb.max.distanceTo(ba.max)).toBeLessThan(.05);
  const visual=new ArenaCharacter(e.char,0xffffff,async()=>b);await visual.ready;expect(visual.state).toBe('ready');
  for(let frame=0;frame<60;frame++)visual.update(1/60,frame<30?5.2:0,0);visual.dispose();
 },60000);
});
