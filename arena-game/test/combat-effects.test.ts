import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ArenaCombatEffects, ARENA_EFFECT_BUDGET, createNumberSurface, type NumberSurface } from '../src/combatEffects';
import { ArenaScene } from '../src/scene';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fixture(quality: 'high' | 'low' = 'high') {
  const scene = new THREE.Scene(), glow = new THREE.Texture(), surfaces: Array<NumberSurface & { paints: number; disposals: number }> = [];
  const effects = new ArenaCombatEffects(scene, glow, quality, () => {
    const surface = { texture: new THREE.Texture(), paints: 0, disposals: 0, paint() { this.paints++; } };
    surface.texture.addEventListener('dispose', () => surface.disposals++); surfaces.push(surface); return surface;
  });
  return { scene, glow, effects, surfaces, close() { effects.dispose(); glow.dispose(); } };
}
it('reuses actual scene resources across 100 shotgun bursts instead of 7,200 materials and 900 geometries', () => {
  const f = fixture(); const materials = new Set<string>(), geometries = new Set<string>(); let peak = 0;
  const state = Object.assign(Object.create(ArenaScene.prototype), { scene: f.scene, combatEffects: f.effects, flashT: 0, muzzleLight: new THREE.PointLight(), avatars: new Map(), shields: new Map(), camera: new THREE.PerspectiveCamera(), viewmodel: { update() {}, resetMotion() {} }, particles: null, blackflagEffects: null, chapterEffects: null }) as ArenaScene;
  try {
    for (let shot = 0; shot < 100; shot++) {
      for (let pellet = 0; pellet < 9; pellet++) { state.tracer([0, 1, 0], [pellet * .05, 1, -10], 0xfff4c0, .5); state.impact([pellet * .05, 1, -10], false); }
      peak = Math.max(peak, f.scene.children.length);
      for (const node of f.scene.children) { const mesh = node as THREE.Mesh; materials.add((mesh.material as THREE.Material).uuid); if ((node as THREE.Line).isLine) geometries.add(mesh.geometry.uuid); }
      for (let frame = 0; frame < 30; frame++) state.update(1 / 60);
    }
    expect({ materials: materials.size, geometries: geometries.size, peak }).toEqual({ materials: 72, geometries: 9, peak: 72 });
    expect(f.scene.children).toHaveLength(0); expect(f.effects.inventory.recycled).toEqual({ tracers: 0, sparks: 0, numbers: 0 });
    state.clearCombatEffects(); expect(f.effects.inventory.allocated).toEqual({ tracers: 9, sparks: 63, numbers: 0 });
    state.disposeCombatEffects(); expect(f.effects.inventory.disposed).toBe(true);
  } finally { f.close(); }
});
it('keeps the legacy tracer and spark visible parameters while resetting reused geometry bounds', () => {
  const f = fixture();
  try {
    f.effects.tracer([0, 1, 0], [1, 2, -10], 0xffcc88, .5);
    const line = f.scene.children[0] as THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    expect(line.material.opacity).toBe(.45); expect(line.material.blending).toBe(THREE.AdditiveBlending); expect(line.material.depthWrite).toBe(false);
    f.effects.update(.03); expect(line.material.opacity).toBeCloseTo(.6, 12); // Legacy fade intentionally ignores initial width.
    f.effects.update(.1); expect(f.scene.children).toHaveLength(0);
    f.effects.tracer([100, 0, 0], [110, 0, 0], 0x44aacc); expect(f.scene.children[0]).toBe(line);
    expect(line.geometry.boundingSphere!.center.x).toBe(105); expect(line.geometry.boundingSphere!.radius).toBe(5);
    f.effects.burst([2, 3, 4], 0xff00aa, .5, .35, 0);
    const spark = f.scene.children[1] as THREE.Sprite;
    expect(spark.position.toArray()).toEqual([2, 3, 4]); expect(spark.scale.x).toBe(.2); expect(spark.material.map).toBe(f.glow);
    f.effects.update(.1); expect(spark.scale.x).toBeCloseTo(.32, 12); expect(spark.material.opacity).toBeCloseTo(.25 / .35, 12);
  } finally { f.close(); }
});
it('bounds high and low catch-up bursts with oldest cosmetic replacement, then fully clears on long pause', () => {
  for (const quality of ['high', 'low'] as const) {
    const f = fixture(quality); const budget = ARENA_EFFECT_BUDGET[quality];
    try {
      for (let i = 0; i < 1000; i++) { f.effects.tracer([i, 0, 0], [i, 1, -1], 0xffffff); f.effects.burst([i, 0, 0], 0xffffff, 1, .3, 1); f.effects.damageNumber([i, 2, 0], i, false, false); }
      expect(f.effects.inventory.allocated).toEqual(budget); expect(f.effects.inventory.active).toEqual(budget);
      expect(f.scene.children.length).toBe(budget.tracers + budget.sparks + budget.numbers);
      expect(f.effects.inventory.recycled.tracers).toBe(1000 - budget.tracers);
      expect(f.surfaces.every(surface => surface.disposals === 0)).toBe(true);
      f.effects.update(NaN); expect(f.effects.inventory.active).toEqual(budget);
      f.effects.update(30); expect(f.scene.children).toHaveLength(0); expect(f.effects.inventory.active).toEqual({ tracers: 0, sparks: 0, numbers: 0 });
      for (let round = 0; round < 30; round++) { f.effects.damageNumber([0, 2, 0], 16, false, false); f.effects.clear(); }
      expect(f.effects.inventory.allocated).toEqual(budget);
    } finally { f.close(); }
    expect(f.surfaces.every(surface => surface.disposals === 1)).toBe(true);
  }
});
it('active labels own distinct textures; reuse skips repaint only for an identical label/style and disposal is once', () => {
  const f = fixture(); let glowDisposals = 0; f.glow.addEventListener('dispose', () => glowDisposals++);
  try {
    f.effects.damageNumber([0, 2, 0], 16, false, false); f.effects.damageNumber([1, 2, 0], 32, true, false);
    expect(f.surfaces).toHaveLength(2); expect(f.surfaces[0].texture).not.toBe(f.surfaces[1].texture);
    f.effects.clear(); f.effects.damageNumber([0, 2, 0], 16, false, false); expect(f.surfaces[0].paints).toBe(1);
    f.effects.clear(); f.effects.damageNumber([0, 2, 0], 16, true, false); expect(f.surfaces[0].paints).toBe(2);
    f.effects.dispose(); f.effects.dispose(); expect(glowDisposals).toBe(0); expect(f.surfaces.map(surface => surface.disposals)).toEqual([1, 1]);
    f.effects.damageNumber([0, 2, 0], 99, true, true); f.effects.burst([0, 0, 0], 0xffffff, 1, 1, 0); f.effects.tracer([0, 0, 0], [1, 1, 1], 0xffffff); expect(f.scene.children).toHaveLength(0);
  } finally { f.close(); }
});

it('repaints the same canvas with the original number fonts and colors, clearing old glyphs first', () => {
  const calls: string[] = [];
  const context = { font: '', textAlign: '', lineWidth: 0, strokeStyle: '', fillStyle: '', clearRect() { calls.push('clear'); }, strokeText(text: string, x: number, y: number) { calls.push(`stroke:${text}:${x}:${y}`); }, fillText(text: string, x: number, y: number) { calls.push(`fill:${text}:${x}:${y}`); } };
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const surface = createNumberSurface();
  try {
    surface.paint(15.6, false, false); expect(context.font).toBe('900 38px sans-serif'); expect(context.fillStyle).toBe('#ffffff');
    expect(calls).toEqual(['clear', 'stroke:16:64:48', 'fill:16:64:48']);
    calls.length = 0; surface.paint(32, true, false); expect(context.font).toBe('900 46px sans-serif'); expect(context.fillStyle).toBe('#ffd34d'); expect(calls[0]).toBe('clear');
    surface.paint(32, true, true); expect(context.fillStyle).toBe('#ff5d7a');
  } finally { surface.texture.dispose(); }
});
it('unavailable damage-label canvas is a cosmetic failure, never an exception in hit delivery', () => {
  const parent = new THREE.Scene(), glow = new THREE.Texture();
  const effects = new ArenaCombatEffects(parent, glow, 'high', () => { throw new Error('no canvas'); });
  try { expect(() => effects.damageNumber([0, 1, 0], 16, false, false)).not.toThrow(); expect(effects.inventory.allocated.numbers).toBe(0); }
  finally { effects.dispose(); glow.dispose(); }
});

it('actual scene muzzle flash keeps the 60 Hz baseline and equal elapsed brightness at 30/60/144 Hz', () => {
  const intensities: number[] = [];
  for (const hz of [30, 60, 144]) {
    const f = fixture(), light = new THREE.PointLight();
    const state = Object.assign(Object.create(ArenaScene.prototype), { combatEffects: f.effects, flashT: 0, muzzleLight: light, viewmodel: { update() {} }, particles: null, blackflagEffects: null, chapterEffects: null }) as ArenaScene;
    try {
      state.muzzleFlash([1, 2, 3]); expect(light.position.toArray()).toEqual([1, 2, 3]); expect(light.intensity).toBe(9);
      let elapsed = 0;
      while (elapsed < .05 - 1e-12) { const dt = Math.min(1 / hz, .05 - elapsed); state.update(dt); elapsed += dt; }
      intensities.push(light.intensity); expect(light.intensity).toBeCloseTo(9 * .6 ** 3, 12);
      state.update(.01); expect(light.intensity).toBe(0);
    } finally { f.close(); light.dispose(); }
  }
  expect(Math.max(...intensities) - Math.min(...intensities)).toBeLessThan(1e-12);
});
