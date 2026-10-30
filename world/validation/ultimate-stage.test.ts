import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { UltimateStage } from '../src/ultimateStage.ts';
function fixture() {
  const source = new THREE.Group(), bone = new THREE.Bone(); bone.name = 'Hand'; source.add(bone);
  const geometry = new THREE.BoxGeometry(1, 2, 1), material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material); mesh.position.y = 1; source.add(mesh); source.position.set(90, 5, 22);
  return { source, bone, mesh, geometry, material };
}
test('all four identities create independent bounded actual Three stages and preserve source assets', () => {
  const f = fixture(), stage = new UltimateStage(); let disposed = 0;
  f.geometry.addEventListener('dispose', () => disposed++); f.material.addEventListener('dispose', () => disposed++);
  for (const identity of ['saber', 'blackbeard', 'napoleon', 'musashi']) {
    stage.begin({ identity, sourceRoot: f.source }); assert.equal(stage.isActive, true);
    assert.equal(stage.resourceCounts.actors, 1); assert.ok(stage.resourceCounts.geometries < 80);
    stage.update({ elapsed: 3, phase: 'release', progress: .5, pulse: 1 }); stage.scene.updateMatrixWorld(true);
    let meshes = 0; stage.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes++; assert.ok(o.matrixWorld.elements.every(Number.isFinite)); });
    assert.ok(meshes > 30); assert.deepEqual(f.source.position.toArray(), [90, 5, 22]);
    assert.equal(!!stage.scene.getObjectByName('Original broadside silhouette'), identity === 'blackbeard');
    stage.end(); assert.equal(stage.scene.children.length, 0); assert.deepEqual(stage.resourceCounts, { geometries: 0, materials: 0, actors: 0 });
  }
  stage.dispose(); assert.equal(disposed, 0);
});
test('release mirrors source local pose without changing its root or shared materials', () => {
  const f = fixture(), stage = new UltimateStage(); stage.begin({ identity: 'musashi', sourceRoot: f.source });
  const copy = stage.scene.getObjectByName('Hand')!; assert.notEqual(copy, f.bone);
  f.bone.rotation.z = .7; f.bone.position.y = 1.4;
  stage.update({ elapsed: 2, phase: 'release', progress: .4, pulse: 0 });
  assert.equal(copy.rotation.z, f.bone.rotation.z); assert.equal(copy.position.y, 1.4);
  assert.equal(f.mesh.material, f.material); assert.equal(f.material.opacity, 1); stage.end();
});
test('skinned actor has a private skeleton and disposal never frees source skeleton', () => {
  const source = new THREE.Group(), bone = new THREE.Bone(), geometry = new THREE.BoxGeometry();
  const count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4); for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial()); mesh.name = 'Actor'; mesh.add(bone); mesh.bind(new THREE.Skeleton([bone])); source.add(mesh);
  mesh.skeleton.computeBoneTexture(); const texture = mesh.skeleton.boneTexture!; let disposed = 0; texture.addEventListener('dispose', () => disposed++);
  const stage = new UltimateStage(); stage.begin({ identity: 'saber', sourceRoot: source });
  const copy = stage.scene.getObjectByName('Actor') as THREE.SkinnedMesh;
  assert.notEqual(copy.skeleton, mesh.skeleton); assert.notEqual(copy.skeleton.bones[0], bone); assert.equal(copy.geometry, geometry);
  stage.end(); assert.equal(disposed, 0); assert.equal(mesh.skeleton.boneTexture, texture);
});
test('render covers viewport and restores renderer state even when rendering throws', () => {
  const stage = new UltimateStage(); stage.begin({ identity: 'saber', sourceRoot: fixture().source });
  const target = {}, viewport = new THREE.Vector4(2, 3, 4, 5), scissor = new THREE.Vector4(6, 7, 8, 9), color = new THREE.Color(0x123456);
  let activeTarget: unknown = target, activeViewport = viewport.clone(), activeScissor = scissor.clone(), test = true, clear = color.clone(), alpha = .4;
  const renderer = { autoClear: false, getRenderTarget: () => activeTarget, setRenderTarget: (x: unknown) => { activeTarget = x; },
    getViewport: (v: THREE.Vector4) => v.copy(activeViewport), getScissor: (v: THREE.Vector4) => v.copy(activeScissor),
    setViewport: (...v: unknown[]) => { activeViewport = v[0] instanceof THREE.Vector4 ? v[0].clone() : new THREE.Vector4(...v as [number, number, number, number]); },
    setScissor: (v: THREE.Vector4) => { activeScissor = v.clone(); }, getScissorTest: () => test, setScissorTest: (v: boolean) => { test = v; },
    getClearColor: (v: THREE.Color) => v.copy(clear), getClearAlpha: () => alpha, setClearColor: (v: THREE.Color, a: number) => { clear = v.clone(); alpha = a; },
    getSize: (v: THREE.Vector2) => v.set(1920, 1080), render: () => { assert.deepEqual(activeViewport.toArray(), [0, 0, 1920, 1080]); assert.equal(test, false); throw new Error('GPU unavailable'); },
  };
  assert.throws(() => stage.render(renderer as unknown as THREE.WebGLRenderer, 16 / 9), /GPU unavailable/);
  assert.equal(activeTarget, target); assert.deepEqual(activeViewport, viewport); assert.deepEqual(activeScissor, scissor); assert.equal(test, true); assert.equal(renderer.autoClear, false); assert.equal(alpha, .4); assert.ok(clear.equals(color)); stage.end();
});
test('reduced effects keep a constant backdrop and bounded pool through repeated frame/skip cycles', () => {
  const stage = new UltimateStage(), source = fixture().source;
  for (let cycle = 0; cycle < 6; cycle++) {
    stage.begin({ identity: 'napoleonMounted', sourceRoot: source, reducedEffects: true });
    const initial = stage.resourceCounts, background = (stage.scene.background as THREE.Color).clone();
    for (let i = 0; i < 60; i++) {
      stage.update({ elapsed: i / 10, phase: i < 10 ? 'intro' : i < 20 ? 'charge' : i < 50 ? 'release' : 'outro', progress: (i % 10) / 10, pulse: i % 2 });
      assert.deepEqual(stage.resourceCounts, initial); assert.ok((stage.scene.background as THREE.Color).equals(background));
      assert.ok(stage.camera.projectionMatrix.elements.every(Number.isFinite));
    }
  }
  stage.end(); stage.update({ elapsed: NaN, phase: 'release', progress: NaN, pulse: NaN }); assert.equal(stage.isActive, false);
});
test('a replacement source ends the stage instead of reading an obsolete character tree', () => {
  const stage = new UltimateStage(); stage.begin({ identity: 'saber', sourceRoot: fixture().source });
  stage.update({ elapsed: 1, phase: 'release', progress: 0, pulse: 0, sourceRoot: fixture().source });
  assert.equal(stage.isActive, false); assert.equal(stage.resourceCounts.actors, 0);
});
test('end removes retained actor/effect children, not only the scene references', () => {
  const stage = new UltimateStage(); stage.begin({ identity: 'blackbeard', sourceRoot: fixture().source });
  const groups = stage.scene.children.filter(o => o instanceof THREE.Group);
  assert.equal(groups.length, 2); assert.ok(groups.every(g => g.children.length > 0));
  stage.end(); assert.ok(groups.every(g => g.children.length === 0)); assert.equal(stage.scene.children.length, 0);
  const internal = stage as unknown as { clone?: THREE.Object3D; sourceRoot?: THREE.Object3D; pairs: unknown[] };
  assert.equal(internal.clone, undefined); assert.equal(internal.sourceRoot, undefined); assert.equal(internal.pairs.length, 0);
});
test('framing scans once per model identity and new outfit models get independent bounds', () => {
  const stage = new UltimateStage(), source = fixture().source, replacement = fixture().source;
  replacement.scale.setScalar(2);
  const original = THREE.Box3.prototype.setFromObject; let scans = 0;
  THREE.Box3.prototype.setFromObject = function(object, precise) { scans++; return original.call(this, object, precise); };
  try {
    stage.begin({ identity: 'saber', sourceRoot: source });
    const actor = stage.scene.children.find(o => o instanceof THREE.Group)!; const scale = actor.scale.x;
    stage.end(); stage.begin({ identity: 'saber', sourceRoot: source }); assert.equal(scans, 1);
    stage.begin({ identity: 'saber', sourceRoot: replacement }); assert.equal(scans, 2);
    assert.equal(stage.scene.children.find(o => o instanceof THREE.Group)!.scale.x, scale / 2);
    stage.dispose(); stage.begin({ identity: 'saber', sourceRoot: source }); assert.equal(scans, 3);
  } finally { THREE.Box3.prototype.setFromObject = original; stage.dispose(); }
});
test('energy uses bounded RGBA feathered sheets rather than opaque capped cylinders', () => {
  for (const identity of ['saber', 'blackbeard', 'napoleon', 'musashi']) {
    const stage = new UltimateStage(); stage.begin({ identity, sourceRoot: fixture().source });
    let ribbons = 0, triangles = 0;
    stage.scene.traverse(o => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      const color = mesh.geometry.attributes.color;
      if (color?.itemSize === 4) {
        ribbons++; let zero = 0, positive = 0;
        for (let i = 0; i < color.count; i++) { const alpha = color.getW(i); assert.ok(alpha >= 0 && alpha <= 1); alpha === 0 ? zero++ : positive++; }
        assert.ok(zero > 0 && positive > 0); const material = mesh.material as THREE.MeshBasicMaterial;
        assert.equal(material.vertexColors, true); assert.equal(material.forceSinglePass, true); assert.equal(material.transparent, true); assert.equal(material.depthWrite, false);
      }
    });
    assert.ok(ribbons >= 1); assert.ok(triangles < 25000, 'stage geometry budget excluding production actor'); stage.dispose();
  }
});
test('all stage-owned ship and ribbon resources dispose exactly once across repeated begin/end', () => {
  const stage = new UltimateStage(); const source = fixture().source;
  for (let cycle = 0; cycle < 3; cycle++) for (const identity of ['saber', 'blackbeard', 'napoleon', 'musashi']) {
    stage.begin({ identity, sourceRoot: source, reducedEffects: cycle === 1 });
    const owned = stage as unknown as { geometries: Set<THREE.BufferGeometry>; materials: Set<THREE.Material> };
    const expected = owned.geometries.size + owned.materials.size; let disposals = 0;
    for (const geometry of owned.geometries) geometry.addEventListener('dispose', () => disposals++);
    for (const material of owned.materials) material.addEventListener('dispose', () => disposals++);
    stage.update({ elapsed: 3, phase: 'release', progress: .5, pulse: 1 }); stage.end(); stage.end();
    assert.equal(disposals, expected); assert.equal(stage.scene.children.length, 0);
  }
  stage.dispose();
});
test('mid-cast reduced effects latch without allocations or return to bright orbit', () => {
  const stage = new UltimateStage(), source = fixture().source;
  stage.begin({ identity: 'saber', sourceRoot: source }); const counts = stage.resourceCounts;
  stage.update({ elapsed: 2, phase: 'release', progress: .2, pulse: 1, reduced: true });
  const position = stage.camera.position.clone();
  stage.update({ elapsed: 3, phase: 'release', progress: .8, pulse: 1, reduced: false });
  assert.deepEqual(stage.camera.position, position); assert.deepEqual(stage.resourceCounts, counts);
  stage.scene.traverse(o => { const mesh = o as THREE.Mesh; if (!mesh.isMesh) return; const mat = mesh.material as THREE.MeshBasicMaterial; if (mat.isMeshBasicMaterial && mat.vertexColors) assert.ok(mat.opacity <= .55); });
  stage.begin({ identity: 'saber', sourceRoot: source, reducedEffects: false });
  let bright = false; stage.scene.traverse(o => { const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined; if (mat?.isMeshBasicMaterial && mat.vertexColors && mat.opacity > .55) bright = true; });
  assert.equal(bright, true); stage.dispose();
});
test('portrait protects actor/weapon framing while landscape and intro close-ups stay unchanged', () => {
  const stage = new UltimateStage();
  for (const identity of ['saber', 'blackbeard', 'napoleon', 'musashi']) {
    stage.begin({ identity, sourceRoot: fixture().source });
    stage.update({ elapsed: .3, phase: 'intro', progress: .5, pulse: 0 }); stage.setAspect(16 / 9);
    const intro = stage.camera.position.clone();
    for (const aspect of [16 / 9, 4 / 3, 21 / 9, 9 / 16]) {
      stage.setAspect(aspect); assert.deepEqual(stage.camera.position, intro, 'intro remains a face close-up');
      for (const x of [-.25, .25]) for (const y of [2.15, 2.65]) {
        const head = new THREE.Vector3(x, y, .1).project(stage.camera); assert.ok(Math.abs(head.x) < 1 && Math.abs(head.y) < 1, `head ${identity}/${aspect}`);
      }
    }
    stage.update({ elapsed: 3, phase: 'release', progress: .5, pulse: 0 }); stage.setAspect(16 / 9);
    const landscape = stage.camera.position.clone();
    for (const aspect of [16 / 9, 4 / 3, 21 / 9]) { stage.setAspect(aspect); assert.deepEqual(stage.camera.position, landscape); }
    stage.setAspect(9 / 16); const portrait = stage.camera.position.clone();
    assert.ok(portrait.z > landscape.z); stage.setAspect(9 / 16); assert.deepEqual(stage.camera.position, portrait, 'no cumulative zoom');
    // Conservative body/weapon envelope; real production-vertex audit is separate.
    const halfWidth = identity === 'musashi' ? 1.7 : 1.2;
    for (const x of [-halfWidth, halfWidth]) for (const y of [0, 2.8]) for (const z of [-.4, .4]) {
      const point = new THREE.Vector3(x, y, z).project(stage.camera); assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1, `actor ${identity}`);
    }
  }
  stage.dispose();
});
test('charge-to-release blends from the last clone pose then matches the moving live source exactly', () => {
  const f = fixture(), stage = new UltimateStage();
  const idle = new THREE.AnimationClip('Idle', 1, [new THREE.VectorKeyframeTrack('Hand.position', [0, 1], [0, 0, 0, 0, 0, 0])]);
  const attack = new THREE.AnimationClip('Attack', 1, [new THREE.VectorKeyframeTrack('Hand.position', [0, 1], [0, 0, 0, 0, 10, 0])]);
  stage.begin({ identity: 'musashi', sourceRoot: f.source, clips: [idle, attack] });
  stage.update({ elapsed: 1, phase: 'charge', progress: 1, pulse: 0 });
  const copy = stage.scene.getObjectByName('Hand')!, charge = copy.position.clone(), counts = stage.resourceCounts;
  assert.ok(charge.y > 2.9); f.bone.position.set(0, .2, 0); f.bone.rotation.z = .8;
  stage.update({ elapsed: 1.05, phase: 'release', progress: 0, pulse: 0 });
  assert.deepEqual(copy.position, charge, 'first release is position-continuous'); assert.ok(Math.abs(copy.rotation.z) < 1e-10, 'first release is rotation-continuous');
  f.bone.position.y = .6;
  stage.update({ elapsed: 1.12, phase: 'release', progress: .1, pulse: 1 });
  assert.ok(copy.position.y > f.bone.position.y && copy.position.y < charge.y); assert.ok(copy.rotation.z > 0 && copy.rotation.z < .8);
  f.bone.position.y = .8;
  stage.update({ elapsed: 1.2, phase: 'release', progress: .2, pulse: 0 });
  assert.deepEqual(copy.position, f.bone.position); assert.deepEqual(copy.quaternion.toArray(), f.bone.quaternion.toArray()); assert.deepEqual(stage.resourceCounts, counts);
  assert.equal(f.bone.position.y, .8); stage.end(); stage.update({ elapsed: 2, phase: 'release', progress: 1, pulse: 0 }); assert.equal(stage.isActive, false);
});
