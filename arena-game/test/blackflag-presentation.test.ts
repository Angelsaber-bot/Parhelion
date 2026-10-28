// CPU-side scene/policy/lifecycle checks, not WebGL shader/FPS or browser evidence.
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
import { atmosphereFor } from '../src/atmosphere.ts';
import { BLACKFLAG_ATMOSPHERE, BLACKFLAG_EFFECT_BUDGET, BlackflagEffects, blackflagCastsShadow } from '../src/blackflagPresentation.ts';
import { ArenaScene } from '../src/scene.ts';

const sceneSource = readFileSync(new URL('../src/scene.ts', import.meta.url), 'utf8');
const pointsOf = (effect: BlackflagEffects) => effect.root.children.filter(node => (node as THREE.Points).isPoints) as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>[];

it('ship atmosphere is a separate map-ID gate and leaves shared seabreeze and other map paths untouched', () => {
  expect(BLACKFLAG_ATMOSPHERE).not.toBe(atmosphereFor('seabreeze'));
  expect(atmosphereFor('seabreeze')).toMatchObject({
    background: 0x9cbbc8, fog: [0xaac8d2, 90, 240], exposure: 1,
    hemi: [0xcbe1e8, 0x69656b, 1.7], particles: 'none', bloom: 0.18, bloomThreshold: 1.8,
  });
  expect(sceneSource).toContain("id === 'blackflag' ? BLACKFLAG_ATMOSPHERE : atmosphereFor(preset)");
  expect(sceneSource).toContain("id === 'blackflag' ? blackflagCastsShadow(m) : !decorative && role !== 'floor' && role !== 'wayfinding'");
  expect(sceneSource).toContain("id === 'blackflag' ? new BlackflagEffects(this.sparkTex, this.quality) : null");
  expect(sceneSource.indexOf('this.blackflagEffects?.dispose()')).toBeLessThan(sceneSource.indexOf("new BlackflagEffects(this.sparkTex, this.quality)"));
});

it('ship fog starts beyond the full combat diagonal, without broad bloom or generic haze', () => {
  expect(BLACKFLAG_ATMOSPHERE.fog[1]).toBeGreaterThan(Math.hypot(64, 34, 20));
  expect(BLACKFLAG_ATMOSPHERE.fog[2]).toBeGreaterThan(200);
  expect(BLACKFLAG_ATMOSPHERE.bloom).toBeLessThanOrEqual(0.15);
  expect(BLACKFLAG_ATMOSPHERE.bloomThreshold).toBeGreaterThanOrEqual(1.9);
  expect(BLACKFLAG_ATMOSPHERE.particles).toBe('none');
});

describe('Blackflag shadow metadata', () => {
  function mesh(name: string, parentData: Record<string, unknown>, ownData = {}) {
    const group = new THREE.Group();
    group.userData = parentData;
    const result = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ name }));
    result.userData = ownData;
    group.add(result);
    return result;
  }
  it('honors parent multi-primitive glTF castShadow extras and child overrides', () => {
    expect(blackflagCastsShadow(mesh('tarCloth', { decorative: true, castShadow: true }))).toBe(true);
    expect(blackflagCastsShadow(mesh('canvasShade', { decorative: true, castShadow: false }))).toBe(false);
    expect(blackflagCastsShadow(mesh('blackSail', { castShadow: false }, { castShadow: true }))).toBe(true);
  });
  it('fallback casts opaque ship craft, not sea/foam/islands/lamp glows', () => {
    for (const name of ['blackSail', 'canvas', 'tar', 'timber', 'brass']) {
      expect(blackflagCastsShadow(mesh(name, { decorative: true })), name).toBe(true);
    }
    for (const name of ['sea', 'deepSea', 'foam', 'farRock', 'distant', 'lamp', 'glass']) {
      expect(blackflagCastsShadow(mesh(name, { decorative: true })), name).toBe(false);
    }
  });
  it('keeps floors and wayfinding out of shadows while retaining solid cover', () => {
    for (const role of ['floor', 'wayfinding']) expect(blackflagCastsShadow(mesh('timber', { role, decorative: false }))).toBe(false);
    expect(blackflagCastsShadow(mesh('timber', { role: 'cover', decorative: false }))).toBe(true);
  });
  it('the actual exported glTF routes sail/gallery shadows but excludes the sea/background detail batch', async () => {
    // Parsing uses the installed loader; only image bitmap decoding is stubbed.
    // This verifies scene hierarchy/metadata, not pixels or shader compilation.
    vi.stubGlobal('self', globalThis);
    vi.stubGlobal('createImageBitmap', async (blob: Blob) => {
      const data = new DataView(await blob.arrayBuffer());
      return { width: data.getUint32(16), height: data.getUint32(20), close() {} };
    });
    try {
      const bytes = readFileSync(new URL('../../arena-maps/blackflag/assets/blackflag_visual.glb', import.meta.url));
      const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
      for (const [name, casts] of [['DETAIL_ship_sails', true], ['DETAIL_ship_gallery', true], ['DETAIL_chapter_craft', false]] as const) {
        const group = gltf.scene.getObjectByName(name);
        expect(group, name).toBeDefined(); expect(group!.userData.castShadow).toBe(casts);
        let checked = 0;
        group!.traverse(object => {
          if (!(object as THREE.Mesh).isMesh) return;
          checked++; expect(blackflagCastsShadow(object as THREE.Mesh), name).toBe(casts);
        });
        expect(checked).toBeGreaterThan(0);
      }
      const textures = new Set<THREE.Texture>();
      gltf.scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
          material.dispose();
        }
      });
      textures.forEach(texture => texture.dispose());
    } finally { vi.unstubAllGlobals(); }
  });
});

for (const quality of ['high', 'low'] as const) describe(`${quality} bounded ship effects`, () => {
  it('uses capped built-in points, a shadowless fill, no additional textures or render targets', () => {
    const texture = new THREE.Texture(), effect = new BlackflagEffects(texture, quality);
    try {
      const points = pointsOf(effect);
      const budget = BLACKFLAG_EFFECT_BUDGET[quality];
      expect(points).toHaveLength(quality === 'high' ? 2 : 1);
      expect(points.reduce((n, point) => n + point.geometry.getAttribute('position').count, 0)).toBe(budget.sea + budget.motes);
      for (const point of points) {
        expect(point.material.type).toBe('PointsMaterial');
        expect(point.material.map).toBe(texture);
        expect(point.material.blending).toBe(THREE.NormalBlending);
        expect(point.material.depthTest).toBe(true);
        expect(point.material.depthWrite).toBe(false);
        expect(point.material.fog).toBe(true);
        expect(point.castShadow).toBe(false);
      }
      const lights = effect.root.children.filter(node => (node as THREE.Light).isLight) as THREE.DirectionalLight[];
      expect(lights).toHaveLength(1);
      expect(lights[0].castShadow).toBe(false);
      expect(lights[0].intensity).toBeLessThan(0.4);
    } finally { effect.dispose(); texture.dispose(); }
  });

  it('retains the same typed buffers, object and material identities throughout repeated updates', () => {
    const texture = new THREE.Texture(), effect = new BlackflagEffects(texture, quality);
    try {
      const points = pointsOf(effect), objects = [...effect.root.children];
      const buffers = points.map(point => point.geometry.getAttribute('position').array);
      const geometries = points.map(point => point.geometry), materials = points.map(point => point.material);
      for (let frame = 0; frame < 1200; frame++) effect.update(1 / 60);
      expect(effect.root.children).toEqual(objects);
      points.forEach((point, i) => {
        expect(point.geometry).toBe(geometries[i]); expect(point.material).toBe(materials[i]);
        expect(point.geometry.getAttribute('position').array).toBe(buffers[i]);
      });
    } finally { effect.dispose(); texture.dispose(); }
  });

  it('keeps all ambient particles outside the playable eye band and inside conservative culling bounds', () => {
    const texture = new THREE.Texture(), effect = new BlackflagEffects(texture, quality);
    try {
      for (const dt of [0, 1 / 60, 4, -1, NaN, Infinity, 1 / 60]) {
        effect.update(dt);
        for (const point of pointsOf(effect)) {
          const positions = point.geometry.getAttribute('position').array;
          for (let k = 0; k < positions.length; k += 3) {
            const x = positions[k], y = positions[k + 1], z = positions[k + 2];
            expect(Number.isFinite(x + y + z)).toBe(true);
            expect(Math.hypot(x, y, z)).toBeLessThan(point.geometry.boundingSphere!.radius);
            if (point.name === 'BLACKFLAG_sea_glints') {
              expect(Math.abs(z)).toBeGreaterThan(21.5); expect(y).toBeLessThan(-5.9); expect(y).toBeGreaterThan(-6.025);
            } else expect(y).toBeGreaterThan(5.7);
          }
        }
      }
    } finally { effect.dispose(); texture.dispose(); }
  });

  it('is deterministic and disposes exactly once without taking ownership of the shared texture', () => {
    const texture = new THREE.Texture(), scene = new THREE.Scene();
    const a = new BlackflagEffects(texture, quality), b = new BlackflagEffects(texture, quality);
    scene.add(a.root);
    let geometryDisposals = 0, materialDisposals = 0, textureDisposals = 0;
    texture.addEventListener('dispose', () => textureDisposals++);
    const points = pointsOf(a), expected = points.length;
    points.forEach(point => {
      point.geometry.addEventListener('dispose', () => geometryDisposals++);
      point.material.addEventListener('dispose', () => materialDisposals++);
    });
    for (let frame = 0; frame < 40; frame++) { a.update(1 / 60); b.update(1 / 60); }
    points.forEach((point, i) => expect(point.geometry.getAttribute('position').array).toEqual(pointsOf(b)[i].geometry.getAttribute('position').array));
    a.dispose(); a.dispose(); a.update(1 / 60);
    expect(scene.children).toHaveLength(0); expect(a.root.children).toHaveLength(0);
    expect(geometryDisposals).toBe(expected); expect(materialDisposals).toBe(expected); expect(textureDisposals).toBe(0);
    b.dispose(); texture.dispose();
  });
});

describe('real ArenaScene.loadMap lifecycle without constructing WebGL', () => {
  function harness() {
    const aster = new THREE.Group(), blackflag = new THREE.Group(), sakura = new THREE.Group();
    const state = {
      wantMap: 'aster', shownMap: aster as THREE.Object3D | null,
      maps: new Map<string, Promise<THREE.Object3D>>([
        ['aster', Promise.resolve(aster)], ['blackflag', Promise.resolve(blackflag)], ['sakura', Promise.resolve(sakura)],
      ]),
      blackflagEffects: null as BlackflagEffects | null,
      sparkTex: new THREE.Texture(), quality: 'high' as const, scene: new THREE.Scene(),
      renderer: { shadowMap: { autoUpdate: true, needsUpdate: false } },
      atmo: atmosphereFor('day'), setAtmosphere(a: typeof BLACKFLAG_ATMOSPHERE) { this.atmo = a; },
    };
    state.scene.add(aster);
    return { state, load: (id: string, preset?: string) => ArenaScene.prototype.loadMap.call(state as unknown as ArenaScene, id, preset) };
  }
  it('same-map reload preserves one ambient instance; repeated map switches leave no ship effects or fill in Sakura', async () => {
    const { state, load } = harness();
    try {
      for (let cycle = 0; cycle < 3; cycle++) {
        await load('blackflag', 'seabreeze');
        const effects = state.blackflagEffects!;
        expect(effects).not.toBeNull(); expect(state.atmo).toBe(BLACKFLAG_ATMOSPHERE);
        await load('blackflag', 'seabreeze');
        expect(state.blackflagEffects).toBe(effects);
        expect(state.scene.children.filter(child => child.name === 'BLACKFLAG_sea_light_and_air')).toHaveLength(1);
        await load('sakura', 'dusk');
        expect(state.blackflagEffects).toBeNull(); expect(state.atmo).toBe(atmosphereFor('dusk'));
        expect(effects.root.children).toHaveLength(0); expect(effects.root.parent).toBeNull();
        expect(state.scene.children.filter(child => child.name.startsWith('BLACKFLAG'))).toHaveLength(0);
      }
    } finally { state.blackflagEffects?.dispose(); state.sparkTex.dispose(); }
  });
  it('a superseded asynchronous ship load cannot attach its atmosphere effects after a newer selection wins', async () => {
    const { state, load } = harness();
    try {
      let completeShip!: (root: THREE.Object3D) => void;
      state.maps.set('blackflag', new Promise(resolve => { completeShip = resolve; }));
      const shipLoad = load('blackflag', 'seabreeze');
      await load('sakura', 'dusk');
      completeShip(new THREE.Group()); await shipLoad;
      expect(state.wantMap).toBe('sakura'); expect(state.blackflagEffects).toBeNull();
      expect(state.atmo).toBe(atmosphereFor('dusk'));
      expect(state.scene.children).toHaveLength(1);
    } finally { state.blackflagEffects?.dispose(); state.sparkTex.dispose(); }
  });
});
