import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {ArenaCharacter,decodeWorldHero,WORLD_HERO_ASSETS,prepareWorldUVs} from '../src/player/worldHero.ts';
import {PLAYABLE_HERO_INDICES} from '../shared/content.ts';
const assets:Record<number,string[]>={
  2:['artoria_refined/runtime_revision2/armor/artoria_armor.glb.gz'],3:['blackbeard/remaster_v2/Blackbeard_Captain_Remaster.glb.gz'],4:['musashi/remaster_v2/Musashi_Runtime.glb.gz'],5:['napoleon/remaster_v2/Napoleon_WhiteHorse_Remaster.glb.gz'],6:['jeanne/final_20261110/runtime.part1.bin','jeanne/final_20261110/runtime.part2.bin'],7:['ozymandias/final_20261110/runtime.glb.gz'],8:['qin-shi-huang/final_20261110/runtime.glb.gz']};
async function read(char:number):Promise<GLTF>{
 const data=await decodeWorldHero(assets[char].map(path=>new Uint8Array(readFileSync(new URL('../../assets/characters/'+path,import.meta.url)))));
 // Geometry, hierarchy and animation are real; image decoding is deliberately not a GPU test.
 const loader=new GLTFLoader();loader.register(()=>({name:'TEST_TEXTURE',loadTexture:async()=>new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1)}));
 const gltf=await loader.parseAsync(data,'');prepareWorldUVs(gltf.scene);if(char===5)gltf.animations=(await read(3)).animations;return gltf;
}
describe('original World characters in Arena',()=>{
 for(const char of PLAYABLE_HERO_INDICES)it(`loads and independently animates real World character ${char}`,async()=>{
  const source=await read(char),visual=new ArenaCharacter(char,0xffffff,async()=>source),other=new ArenaCharacter(char,0xffffff,async()=>source);
  visual.root.position.set(10,2.6,-4);await Promise.all([visual.ready,other.ready]);
  expect(visual.state).toBe('ready');expect(visual.root.userData.source).toBe('World');
  const bones:THREE.Bone[]=[];visual.root.traverse(o=>{if(o instanceof THREE.Bone)bones.push(o);});expect(bones.length).toBeGreaterThan(12);
  for(let frame=0;frame<120;frame++){visual.update(1/60,frame<60?5.2:0,0,frame>90);visual.root.updateMatrixWorld(true);for(const bone of bones)expect(bone.matrixWorld.elements.every(Number.isFinite)).toBe(true);}
  visual.update(0,0,0);const head=bones.find(b=>/^(mixamorig)?head$/i.test(b.name));expect(head,`head: ${bones.map(b=>b.name)}`).toBeTruthy();
  const height=visual.root.worldToLocal(head!.getWorldPosition(new THREE.Vector3())).y;expect(height).toBeGreaterThan(1);expect(height).toBeLessThan(1.85);
  const mesh=(root:THREE.Object3D)=>{let found:THREE.SkinnedMesh|undefined;root.traverse(o=>{if(o instanceof THREE.SkinnedMesh&&!found)found=o;});return found!;};
  expect(mesh(visual.root).geometry).toBe(mesh(other.root).geometry);expect(mesh(visual.root).skeleton).not.toBe(mesh(other.root).skeleton);
  expect(source.animations.some(a=>a.name===WORLD_HERO_ASSETS[char].run)).toBe(true);
  visual.dispose();other.update(1/60,5.2,0);expect(other.state).toBe('ready');other.dispose();
 },30000);
 it('the edict reveal overlays share geometry and skeleton, draw over walls and clean up',async()=>{
  const source=await read(8),visual=new ArenaCharacter(8,0xffffff,async()=>source);await visual.ready;
  expect(visual.revealMeshes).toHaveLength(0);visual.reveal(0);expect(visual.revealMeshes).toHaveLength(0);
  visual.reveal(1);const overlays=[...visual.revealMeshes];expect(overlays.length).toBeGreaterThan(0);
  for(const overlay of overlays){const mesh=overlay.userData.xraySource as THREE.Mesh,material=overlay.material as THREE.MeshBasicMaterial;
   expect(overlay.geometry).toBe(mesh.geometry);expect(overlay.parent).toBe(mesh.parent);expect(material.depthTest).toBe(false);expect(material.depthWrite).toBe(false);
   if((mesh as THREE.SkinnedMesh).isSkinnedMesh)expect((overlay as THREE.SkinnedMesh).skeleton).toBe((mesh as THREE.SkinnedMesh).skeleton);expect(overlay.visible).toBe(mesh.visible);}
  visual.reveal(1);expect(visual.revealMeshes).toHaveLength(overlays.length);
  visual.reveal(0);expect(overlays.every(o=>!o.visible)).toBe(true);
  visual.dispose();expect(overlays.every(o=>!o.parent)).toBe(true);
  const legacy=new ArenaCharacter(0,0xffffff);legacy.reveal(.5);expect(legacy.revealMeshes.length).toBeGreaterThan(0);legacy.dispose();
 },30000);
 it('declares and binds the fifth UV set used by Jeanne metal maps',async()=>{
  const source=await read(6);let checked=0;
  source.scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){const material=mat as THREE.MeshStandardMaterial;if(material.normalMap?.channel!==4)continue;checked++;expect(mesh.geometry.getAttribute('uv4')).toBe(mesh.geometry.getAttribute('texcoord_4'));const shader={vertexShader:'void main(){}'} as Parameters<THREE.Material['onBeforeCompile']>[0];material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);expect(shader.vertexShader).toContain('attribute vec2 uv4;');}});expect(checked).toBeGreaterThan(0);
 });
 it('does not install a disposed asynchronous preview',async()=>{let resolve!:(g:GLTF)=>void;const visual=new ArenaCharacter(2,0,()=>new Promise(r=>resolve=r));visual.dispose();resolve({scene:new THREE.Group(),animations:[]} as unknown as GLTF);await visual.ready;expect(visual.root.userData.source).toBeUndefined();});
});
