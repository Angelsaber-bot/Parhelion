/** Independent resource-budget checks; no WebGL/GPU/FPS assertions. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SkillPresentation } from '../src/skillPresentation';
import type { SkillEvent } from '../src/contractSkills';
import { createEraStoryScene } from '../src/eraStoryScenes';
import type { EraId } from '../src/eraStories';

function inventory(root: THREE.Object3D, allowStationCraft = false) {
  const objects = new Set<THREE.Object3D>(), geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), buffers = new Set<ArrayBufferLike>();
  const textures = new Set<THREE.DataTexture>();
  let lights = 0, visibleMeshes = 0;
  root.traverse(o => {
    objects.add(o); if ((o as THREE.Light).isLight) lights++;
    if (!(o as THREE.Mesh).isMesh) return;
    const mesh = o as THREE.Mesh;
    assert.equal(mesh.castShadow, false);
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material); const map=(material as THREE.MeshBasicMaterial).map;
      if (!allowStationCraft || !map) { assert.equal(map,null); continue; }
      // This is a narrowly permitted authored surface set, not an open texture budget.
      assert.ok(map instanceof THREE.DataTexture);
      assert.match(map.name,/^EraCraft_(stone|wood|metal|paper|cloth)$/);
      assert.equal(map.image.width,64);assert.equal(map.image.height,64);
      assert.equal(map.image.data.byteLength,64*64*4);
      assert.equal(map.generateMipmaps,true);assert.equal(map.minFilter,THREE.LinearMipmapLinearFilter);
      assert.equal(map.colorSpace,THREE.SRGBColorSpace);textures.add(map);
    }
    let visible = true; for (let ancestor: THREE.Object3D | null = mesh; ancestor; ancestor = ancestor.parent) visible &&= ancestor.visible;
    if (visible) visibleMeshes++;
  });
  for (const g of geometries) {
    for (const a of Object.values(g.attributes)) buffers.add(((a as THREE.BufferAttribute).array ?? (a as THREE.InterleavedBufferAttribute).data.array).buffer);
    if (g.index) buffers.add(g.index.array.buffer);
  }
  return { objects, geometries, materials, textures, lights, visibleMeshes, bytes: [...buffers].reduce((sum,b) => sum+b.byteLength,0) };
}
test('skill effects retain fixed scene and GPU-resource identities after 1000 repeated activations', () => {
  const scene = new THREE.Scene(), effects = new SkillPresentation(scene), baseline = inventory(effects.root);
  assert.equal(baseline.geometries.size, 2); assert.equal(baseline.materials.size, 18);
  assert.equal(baseline.lights, 0); assert.ok(baseline.bytes <= 8192, `${baseline.bytes} geometry bytes`);
  const identities = ['saber','blackbeard','napoleon','musashi',null] as const;
  for (let i=0; i<1000; i++) {
    const event: SkillEvent = { type:'strike', identity: identities[i%identities.length], slot:'skill', origin:{x:0,y:1,z:0}, direction:{x:0,y:0,z:1}, at:.2, range:12, halfWidth:2, damage:30, maxTargets:3, pulse:0 };
    effects.show(i%2 ? event : { ...event, type:'cast', duration:.7 }, i%3===0);
    effects.update(1/120);
    if (i%100===0) {
      const current=inventory(effects.root);
      assert.deepEqual(current.objects,baseline.objects); assert.deepEqual(current.geometries,baseline.geometries); assert.deepEqual(current.materials,baseline.materials);
      assert.ok(current.visibleMeshes<=18); assert.equal(current.lights,0);
    }
  }
  effects.update(0,false); assert.equal(inventory(effects.root).visibleMeshes,0);
  const disposed=new Map<THREE.EventDispatcher,number>();
  for(const resource of [...baseline.geometries,...baseline.materials]) { disposed.set(resource,0); resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)!+1)); }
  effects.dispose(); effects.dispose();
  assert.equal(scene.children.length,0);
  assert.ok([...disposed.values()].every(n=>n===1));
});

for (const id of ['britain','blacksail','winter','kyoto'] as EraId[]) test(`${id} station keeps a local static resource budget through repeated state changes`, () => {
  const station=createEraStoryScene({id,name:['测试','Test'],position:[120,10,-240],entry:[120,10,-225],footprint:[34,30],groundRange:0});
  const scene=new THREE.Scene();scene.add(station.group);
  const baseline=inventory(station.group,true), collision=station.colliders[0].bvh;
  assert.equal(baseline.textures.size,5);
  assert.deepEqual(new Set([...baseline.textures].map(t=>t.name)),new Set(['stone','wood','metal','paper','cloth'].map(k=>`EraCraft_${k}`)));
  assert.equal([...baseline.textures].reduce((n,t)=>n+t.image.data.byteLength,0),80*1024);
  // Exact RGBA8 full mip chain: (4096+1024+256+64+16+4+1)*4*5.
  const mipBytes=[...baseline.textures].reduce((n,t)=>{for(let size=t.image.width;size>=1;size/=2)n+=size*size*4;return n;},0);
  assert.equal(mipBytes,109220); // 106.66 KiB per station / 426.64 KiB across all four.
  const pixels=[...baseline.textures].map(t=>Array.from(t.image.data));
  let triangles=0;station.group.traverse(o=>{if((o as THREE.Mesh).isMesh){const g=(o as THREE.Mesh).geometry;triangles+=(g.index?.count??g.attributes.position.count)/3;}});
  assert.ok(baseline.visibleMeshes<=12);assert.ok(triangles<=5000);assert.ok(baseline.materials.size<=7);
  assert.ok(baseline.bytes<=256*1024);assert.equal(baseline.lights,0);assert.equal(station.colliders.length,1);assert.equal(station.markers.length,1);
  for(let i=0;i<1000;i++)station.applyState({routeReady:i%2===0,complete:i%3===0,discovered:i%5===0});
  const after=inventory(station.group,true);assert.deepEqual(after.objects,baseline.objects);assert.deepEqual(after.geometries,baseline.geometries);assert.deepEqual(after.materials,baseline.materials);
  assert.deepEqual(after.textures,baseline.textures);assert.deepEqual([...after.textures].map(t=>Array.from(t.image.data)),pixels);
  assert.equal(station.colliders[0].bvh,collision);assert.equal(station.colliders[0].enabled,true);
  station.updateVisibility({x:10000,z:10000});assert.equal(station.group.visible,false);
  const origin=station.group.position;station.updateVisibility({x:origin.x,z:origin.z});assert.equal(station.group.visible,true);
  const resources=[...baseline.geometries,...baseline.materials,...baseline.textures,collision.geometry],counts=new Map(resources.map(r=>[r,0]));
  for(const resource of resources)resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)!+1));
  station.dispose();station.dispose();assert.equal(scene.children.length,0);assert.equal(station.colliders[0].enabled,false);
  assert.ok([...counts.values()].every(n=>n===1));
});
