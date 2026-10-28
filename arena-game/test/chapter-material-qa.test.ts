// Offline shader/material contract checks. These do not create a WebGL context or claim GPU compilation/FPS.
import { expect,it,vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { toCel } from '../src/cel.ts';
import { CRAFTED_CHAPTERS, toChapterMaterial } from '../src/chapterMaterial.ts';
const baseline=JSON.parse(readFileSync(new URL('../../docs/chapter-qa/legacy-shader-baseline.json',import.meta.url),'utf8'));
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function expand(source:string,depth=0):string{
  if(depth>64)throw Error('Cyclic shader includes');
  return source.replace(/#include <([\w_]+)>/g,(_all,name:string)=>{
    const chunk=(THREE.ShaderChunk as Record<string,string>)[name];
    if(typeof chunk!=='string')throw Error(`Missing actual Three shader chunk ${name}`);
    return expand(chunk,depth+1);
  });
}
function hooked(material:THREE.Material,kind:'toon'|'standard'='toon'){
  const shader={vertexShader:THREE.ShaderLib[kind].vertexShader,fragmentShader:THREE.ShaderLib[kind].fragmentShader,uniforms:{}};
  material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms,null as never);
  return shader;
}
it('legacy toCel shader output stays byte-identical to the committed ASTER/Sakura render baseline',()=>{
  const material=toCel(new THREE.MeshStandardMaterial()),shader=hooked(material);
  expect(THREE.REVISION).toBe(baseline.threeRevision);
  expect(hash(shader.vertexShader)).toBe(baseline.vertexSha256);expect(hash(shader.fragmentShader)).toBe(baseline.fragmentSha256);
  expect(hash(expand(shader.vertexShader))).toBe(baseline.expandedVertexSha256);expect(hash(expand(shader.fragmentShader))).toBe(baseline.expandedFragmentSha256);
  expect(material.customProgramCacheKey()).toBe(baseline.cacheKey);material.dispose();
});
it('the real ShaderLib toon hook applies once at the supported output chunk and all includes expand',()=>{
  const material=toCel(new THREE.MeshStandardMaterial()),shader=hooked(material);
  expect(shader.vertexShader).toBe(THREE.ShaderLib.toon.vertexShader);
  expect(shader.fragmentShader.match(/float fres =/g)).toHaveLength(1);
  expect(shader.fragmentShader.match(/#include <opaque_fragment>/g)).toHaveLength(1);
  expect(expand(shader.vertexShader)).not.toMatch(/#include\s*</);expect(expand(shader.fragmentShader)).not.toMatch(/#include\s*</);
  expect(expand(shader.fragmentShader)).toContain('gl_FragColor');material.dispose();
});
it('legacy material conversion retains authored color/texture/alpha/emissive contracts without disposing texture ownership',()=>{
  const map=new THREE.Texture(),emissiveMap=new THREE.Texture();let textureDisposals=0,sourceDisposals=0;
  map.addEventListener('dispose',()=>textureDisposals++);emissiveMap.addEventListener('dispose',()=>textureDisposals++);
  const source=new THREE.MeshStandardMaterial({color:0x557788,map,emissive:0x112233,emissiveMap,emissiveIntensity:.42,transparent:true,opacity:.65,alphaTest:.2,side:THREE.DoubleSide,depthWrite:false,vertexColors:true,name:'QA painted canvas'});
  source.addEventListener('dispose',()=>sourceDisposals++);
  const result=toCel(source)as THREE.MeshToonMaterial;
  expect(result.map).toBe(map);expect(result.emissiveMap).toBe(emissiveMap);expect(result.color.getHex()).toBe(0x557788);expect(result.emissive.getHex()).toBe(0x112233);
  expect(result.emissiveIntensity).toBe(.42);expect(result.transparent).toBe(true);expect(result.opacity).toBe(.65);expect(result.alphaTest).toBe(.2);expect(result.side).toBe(THREE.DoubleSide);expect(result.depthWrite).toBe(false);expect(result.vertexColors).toBe(true);expect(result.name).toBe('QA painted canvas');
  expect(sourceDisposals).toBe(1);expect(textureDisposals).toBe(0);result.dispose();map.dispose();emissiveMap.dispose();
});
it('non-PBR materials retain their original authored shader rather than being replaced',()=>{
  const material=new THREE.MeshBasicMaterial({color:0xfedcba});expect(toCel(material)).toBe(material);material.dispose();
});

it('crafted chapter rendering is explicitly scoped and excludes every protected/legacy map',()=>{
  expect([...CRAFTED_CHAPTERS].sort()).toEqual(['blackflag','camlann','frostcourt']);
  for(const id of ['aster','sakura','zenith','neon'])expect(CRAFTED_CHAPTERS.has(id)).toBe(false);
  const scene=readFileSync(new URL('../src/scene.ts',import.meta.url),'utf8');
  expect(scene).toMatch(/CRAFTED_CHAPTERS\.has\(id\)\s*\?\s*toChapterMaterial\s*:\s*toCel/);
});
it('crafted PBR conversion retains all sampled glTF material/UV channels rather than discarding authored surfaces',()=>{
  const textureFields=['map','normalMap','aoMap','roughnessMap','metalnessMap','bumpMap','emissiveMap','alphaMap','displacementMap']as const;
  const source=new THREE.MeshStandardMaterial({color:0x56789a,roughness:.73,metalness:.28,normalScale:new THREE.Vector2(.4,.7),aoMapIntensity:.65,bumpScale:.22,emissive:0x123456,emissiveIntensity:.35,alphaTest:.18,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false,vertexColors:true,displacementScale:.03,displacementBias:-.01,name:'QA crafted stone'});
  let sourceDisposals=0,textureDisposals=0;source.addEventListener('dispose',()=>sourceDisposals++);
  for(const [i,field]of textureFields.entries()){
    const texture=new THREE.Texture();texture.name=field;texture.channel=i%2;texture.repeat.set(3,2);texture.offset.set(.1,.2);texture.rotation=.3;texture.colorSpace=field==='map'||field==='emissiveMap'?THREE.SRGBColorSpace:THREE.NoColorSpace;
    texture.addEventListener('dispose',()=>textureDisposals++);source[field]=texture;
  }
  const result=toChapterMaterial(source)as THREE.MeshStandardMaterial;
  expect(result).not.toBe(source);expect(result.isMeshStandardMaterial).toBe(true);
  for(const field of textureFields){expect(result[field],field).toBe(source[field]);expect(result[field]!.repeat.toArray()).toEqual([3,2]);expect(result[field]!.offset.toArray()).toEqual([.1,.2]);expect(result[field]!.rotation).toBe(.3);expect(result[field]!.colorSpace).toBe(source[field]!.colorSpace);expect(result[field]!.channel).toBe(source[field]!.channel);}
  for(const field of ['roughness','metalness','aoMapIntensity','bumpScale','emissiveIntensity','alphaTest','transparent','opacity','side','depthWrite','vertexColors','displacementScale','displacementBias','name']as const)expect(result[field],field).toBe(source[field]);
  expect(result.color.equals(source.color)).toBe(true);expect(result.emissive.equals(source.emissive)).toBe(true);expect(result.normalScale.toArray()).toEqual([.4,.7]);expect(result.envMapIntensity).toBe(.42);
  expect(sourceDisposals).toBe(1);expect(textureDisposals).toBe(0);result.dispose();for(const field of textureFields)source[field]!.dispose();
});
it('crafted hook applies exactly once to the actual PBR ShaderLib and expands all installed Three chunks',()=>{
  const material=toChapterMaterial(new THREE.MeshStandardMaterial()),shader=hooked(material,'standard');
  expect(shader.vertexShader).toBe(THREE.ShaderLib.standard.vertexShader);
  expect(shader.fragmentShader.match(/float chapterLight =/g)).toHaveLength(1);
  expect(shader.fragmentShader.match(/float chapterRim =/g)).toHaveLength(1);
  expect(shader.fragmentShader.match(/#include <opaque_fragment>/g)).toHaveLength(1);
  const vertex=expand(shader.vertexShader),fragment=expand(shader.fragmentShader);
  expect(vertex).not.toMatch(/#include\s*</);expect(fragment).not.toMatch(/#include\s*</);
  for(const channel of ['map_fragment','normal_fragment_maps','roughnessmap_fragment','metalnessmap_fragment','aomap_fragment'])expect(shader.fragmentShader).toContain(`#include <${channel}>`);
  expect(material.customProgramCacheKey()).toBe('parhelion-crafted-chapter-pbr-v1');expect(material.customProgramCacheKey()).not.toBe(baseline.cacheKey);material.dispose();
});

for(const id of ['blackflag','frostcourt','camlann'])it(`${id} actual GLTFLoader material/UV parsing survives crafted conversion`,async()=>{
  // Only browser image decoding is replaced with a header-sized bitmap; PNG pixels
  // are decoded independently by verify_glb_materials.py. No WebGL context is used.
  vi.stubGlobal('self',globalThis);
  vi.stubGlobal('createImageBitmap',async(blob:Blob)=>{
    const bytes=await blob.arrayBuffer(),data=new DataView(bytes);
    expect(data.getUint32(0)).toBe(0x89504e47);
    return {width:data.getUint32(16),height:data.getUint32(20),close(){}};
  });
  try{
    const bytes=readFileSync(new URL(`../../arena-maps/${id}/assets/${id}_visual.glb`,import.meta.url));
    const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    let textured=0,normal=0;
    const textures=new Set<THREE.Texture>();
    asset.scene.traverse(object=>{
      const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
      const sources=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      for(const original of sources){
        const source=original as THREE.MeshStandardMaterial;
        expect(source.isMeshStandardMaterial).toBe(true);
        const result=toChapterMaterial(source)as THREE.MeshStandardMaterial;
        for(const name of ['map','normalMap','aoMap','metalnessMap','roughnessMap']as const){
          expect(result[name],`${id}:${source.name}:${name}`).toBe(source[name]);
          const tex=result[name];if(!tex)continue;
          const bitmap=tex.image as {width:number;height:number};
          textures.add(tex);expect(bitmap.width).toBeGreaterThan(0);expect(bitmap.height).toBeGreaterThan(0);
          expect(tex.colorSpace).toBe(name==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace);
          expect(mesh.geometry.getAttribute(tex.channel===0?'uv':`uv${tex.channel}`)).toBeDefined();
        }
        if(source.map)textured++;if(source.normalMap)normal++;
        expect(result.roughness).toBe(source.roughness);expect(result.metalness).toBe(source.metalness);
        expect(result.normalScale.toArray()).toEqual(source.normalScale.toArray());
        result.dispose();
      }
      mesh.geometry.dispose();
    });
    expect(textured).toBeGreaterThan(0);if(id!=='blackflag')expect(normal).toBeGreaterThan(0);
    textures.forEach(texture=>texture.dispose());
  }finally{vi.unstubAllGlobals();}
});
