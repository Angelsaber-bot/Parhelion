import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import{toonMaterial}from'../src/rendering/look';
import{buildAlphaSettlement}from'../src/settlements/alpha';import{buildBritainSettlement}from'../src/settlements/britain';import{buildBlackSailSettlement}from'../src/settlements/blacksail';import{buildWinterSettlement}from'../src/settlements/winter';import{buildKyotoSettlement}from'../src/settlements/kyoto';
import type { SettlementKit } from '../src/settlements/types';
import { batchSettlementVisuals } from '../src/settlements/core';

test('generic toon conversion preserves authored emission, side, opacity and depth without mutating its source',()=>{
 const source=new THREE.MeshStandardMaterial({color:0xddeeff,emissive:0xffaa66,emissiveIntensity:.5,side:THREE.DoubleSide,transparent:true,opacity:.6,alphaTest:.25,depthWrite:false,depthTest:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,vertexColors:true}),before=source.toJSON(),converted=toonMaterial(source)as THREE.MeshToonMaterial;
 for(const key of['side','transparent','opacity','alphaTest','depthWrite','depthTest','polygonOffset','polygonOffsetFactor','polygonOffsetUnits','vertexColors','emissiveIntensity']as const)assert.equal(converted[key],source[key],key);
 assert.deepEqual(converted.color.toArray(),source.color.toArray());assert.deepEqual(converted.emissive.toArray(),source.emissive.toArray());assert.notEqual(converted.color,source.color);assert.notEqual(converted.emissive,source.emissive);assert.deepEqual(source.toJSON(),before);source.dispose();converted.dispose();
});
test('authored maps remain shared and externally owned, not cloned or disposed by the material',()=>{
 const map=new THREE.DataTexture(new Uint8Array([220,180,90,255]),1,1),alpha=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1),emission=new THREE.DataTexture(new Uint8Array([180,120,50,255]),1,1);let disposals=0;for(const t of[map,alpha,emission])t.addEventListener('dispose',()=>disposals++);
 const source=new THREE.MeshStandardMaterial({map,alphaMap:alpha,emissiveMap:emission,transparent:false,opacity:1}),a=toonMaterial(source)as THREE.MeshToonMaterial,b=toonMaterial(source)as THREE.MeshToonMaterial;
 for(const m of[a,b]){assert.equal(m.map,map);assert.equal(m.alphaMap,alpha);assert.equal(m.emissiveMap,emission);assert.equal(m.transparent,false);assert.equal(m.opacity,1);}a.dispose();b.dispose();source.dispose();assert.equal(disposals,0);for(const t of[map,alpha,emission])t.dispose();assert.equal(disposals,3);
});
// Batching merges props with the same material. Sample their visible surfaces
// in settlement-local coordinates so changing a lantern's palette is harmless.
const outward = {
  front: new THREE.Vector3(0, 0, 1), back: new THREE.Vector3(0, 0, -1),
  top: new THREE.Vector3(0, 1, 0), underside: new THREE.Vector3(0, -1, 0),
};
type Probe = [role: string, x: number, y: number, z: number, view?: keyof typeof outward];

function materialAt(group: THREE.Group, [role, x, y, z, view = 'front']: Probe) {
  const axis = outward[view];
  const from = new THREE.Vector3(x, y, z).addScaledVector(axis, .5);
  const ray = new THREE.Raycaster(from, axis.clone().negate(), 0, .55);
  const hit = ray.intersectObjects(group.children, true)[0];
  assert.ok(hit?.object instanceof THREE.Mesh && hit.face, `${role} has a visible ${view} surface`);
  const materials = hit.object.material;
  const material = Array.isArray(materials) ? materials[hit.face.materialIndex] : materials;
  assert.ok(material instanceof THREE.MeshStandardMaterial, role);
  return material;
}

const hubs: { build: () => SettlementKit, glows: Probe[] }[] = [
  { build: buildAlphaSettlement, glows: [
    ['garden gate inlay', 3.5, .9, 13.9], ['entrance crown inlay', 0, 4.05, -.5],
    ['front window', 11.5, 2.85, -.76], ['rear window', 11, 2.9, -13.2, 'back'],
    ['bedside shade', 12.5, 1.29, -9.55], ['entrance lantern', 2.6, 2.95, -.15],
    ['dining lantern', 0, 3.44, -8.3, 'underside'],
  ] },
  { build: buildBritainSettlement, glows: [
    ['forge coal bed', -13.5, .96, -4.68, 'top'], ['lit piece of coal', -14.1, 1.08, -5.95, 'top'],
    ['court lantern', 3.4, 3.13, 13],
  ] },
  { build: buildBlackSailSettlement, glows: [['veranda lantern', 2.3, 2.9, 5.7]] },
  { build: buildWinterSettlement, glows: [
    ['stove fire between the grate bars', -7.83, .85, -9.78], ['aid station lantern', 3.5, 2.6, 13.7],
  ] },
  { build: buildKyotoSettlement, glows: [
    ['swordsmith hearth', -13.55, 1.35, -6.15, 'top'], ['lane lantern', 3, 2.5, 11],
  ] },
];

for (const { build, glows } of hubs) {
  test(`${build.name} preserves its practical lights, opaque surfaces and glazing in toon shading`, () => {
    const { id, group } = build();
    group.updateWorldMatrix(true, true);
    const sources = new Set<THREE.MeshStandardMaterial>();
    group.traverse(object => {
      if (object instanceof THREE.Mesh) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          assert.ok(material instanceof THREE.MeshStandardMaterial);
          sources.add(material);
        }
      }
    });
    try {
      const emissive = new Set(glows.map(probe => {
        const source = materialAt(group, probe);
        assert.ok(source.emissive.getHex() && source.emissiveIntensity > 0, `${probe[0]} emits light`);
        return source;
      }));
      let glazing: THREE.MeshStandardMaterial | undefined;
      if (id === 'blacksail') {
        glazing = materialAt(group, ['service hatch transom', 7.8, 3.18, 4.96]);
        assert.equal(materialAt(group, ['service hatch transom', 7.8, 3.18, 4.96, 'back']), glazing);
        assert.ok(glazing.opacity > 0 && glazing.opacity < 1);
        assert.equal(glazing.depthWrite, false);
        const awning = materialAt(group, ['awning canvas', -4, 4.1, 6.8, 'top']);
        assert.equal(materialAt(group, ['awning canvas', -4, 4.1, 6.8, 'underside']), awning);
        assert.notEqual(awning, glazing);
      }
      if (id === 'winter') {
        for (const x of [-12, -4]) for (const dx of [-.45, .45]) for (const y of [1.65, 2.5]) {
          const outside = materialAt(group, ['aid house sash', x+dx, y, 4]);
          assert.equal(materialAt(group, ['aid house sash', x+dx, y, 4, 'back']), outside);
          if (glazing) assert.equal(outside, glazing);
          glazing = outside;
          assert.ok(outside.opacity > 0 && outside.opacity < 1);
          assert.equal(outside.depthWrite, false);
          const batch = group.children.find(child => child instanceof THREE.Mesh && child.material === outside);
          assert.ok(batch?.userData.solid, 'snow and players cannot pass the closed sash');
          assert.equal(batch.castShadow, false);
        }
      }
      for (const source of sources) {
        const label = `${id} #${source.color.getHexString()}`;
        assert.equal(Boolean(source.emissive.getHex() && source.emissiveIntensity > 0), emissive.has(source), label);
        assert.equal(source.side, id === 'blacksail' && source === glazing ? THREE.DoubleSide : THREE.FrontSide, label);
        assert.equal(source.transparent, source === glazing, label);
        const converted = toonMaterial(source);
        assert.ok(converted instanceof THREE.MeshToonMaterial, label);
        try {
          for (const key of ['side','transparent','opacity','depthWrite','map','emissiveMap','emissiveIntensity'] as const) {
            assert.equal(converted[key], source[key], `${label} ${key}`);
          }
          assert.deepEqual(converted.emissive.toArray(), source.emissive.toArray(), label);
        } finally { converted.dispose(); }
      }
      if (glazing) {
        batchSettlementVisuals(group);
        const window = group.children.find(child => child instanceof THREE.Mesh && child.material === glazing);
        assert.ok(window instanceof THREE.Mesh && !window.castShadow, 'installed glazing admits daylight');
        assert.ok(group.children.some(child => child instanceof THREE.Mesh && child.castShadow), 'opaque architecture casts shade');
      }
    } finally {
      group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      for (const source of sources) source.dispose();
    }
  });
}
test('named beam and water shader art direction still bypasses generic property preservation',()=>{
 const beam=new THREE.MeshStandardMaterial({name:'M_Beam',opacity:.1,transparent:false,side:THREE.FrontSide}),water=new THREE.MeshStandardMaterial({name:'M_Water',opacity:.1,transparent:false});const b=toonMaterial(beam),w=toonMaterial(water);assert.equal(b.opacity,.28);assert.equal(b.transparent,true);assert.equal(b.side,THREE.DoubleSide);assert.equal(b.depthWrite,false);assert.equal(b.blending,THREE.AdditiveBlending);assert.equal(w.opacity,.84);assert.equal(w.transparent,true);b.dispose();w.dispose();beam.dispose();water.dispose();
});
