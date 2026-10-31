import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import{toonMaterial}from'../src/look';
import{buildAlphaSettlement}from'../src/settlements/alpha';import{buildBritainSettlement}from'../src/settlements/britain';import{buildBlackSailSettlement}from'../src/settlements/blacksail';import{buildWinterSettlement}from'../src/settlements/winter';import{buildKyotoSettlement}from'../src/settlements/kyoto';

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
test('all five authored hubs retain every practical glow and double-sided panel, without making opaque material transparent',()=>{
 let glowing=0,twoSided=0;for(const build of[buildAlphaSettlement,buildBritainSettlement,buildBlackSailSettlement,buildWinterSettlement,buildKyotoSettlement]){const kit=build(),materials=new Set<THREE.Material>();kit.group.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const source of materials){const s=source as THREE.MeshStandardMaterial,m=toonMaterial(s)as THREE.MeshToonMaterial;assert.equal(m.transparent,s.transparent);assert.equal(m.opacity,s.opacity);assert.equal(m.side,s.side);assert.equal(m.map,s.map);if(s.emissive.getHex()&&s.emissiveIntensity>0){glowing++;assert.equal(m.emissive.getHex(),s.emissive.getHex());assert.equal(m.emissiveIntensity,s.emissiveIntensity);}if(s.side===THREE.DoubleSide)twoSided++;m.dispose();s.dispose();}kit.group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}
 assert.equal(glowing,13);assert.equal(twoSided,3);
});
test('named beam and water shader art direction still bypasses generic property preservation',()=>{
 const beam=new THREE.MeshStandardMaterial({name:'M_Beam',opacity:.1,transparent:false,side:THREE.FrontSide}),water=new THREE.MeshStandardMaterial({name:'M_Water',opacity:.1,transparent:false});const b=toonMaterial(beam),w=toonMaterial(water);assert.equal(b.opacity,.28);assert.equal(b.transparent,true);assert.equal(b.side,THREE.DoubleSide);assert.equal(b.depthWrite,false);assert.equal(b.blending,THREE.AdditiveBlending);assert.equal(w.opacity,.84);assert.equal(w.transparent,true);b.dispose();w.dispose();beam.dispose();water.dispose();
});
