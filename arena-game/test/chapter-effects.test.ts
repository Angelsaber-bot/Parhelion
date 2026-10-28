// CPU-side checks of the chapter light dressing: authored data, budgets and lifecycle.
// Not WebGL pixels or GPU frame time.
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { getMap } from '../shared/arenaMap.ts';
import { buildMap } from '../shared/map.ts';
import { CHAPTER_EFFECT_BUDGET, ChapterEffects } from '../src/chapterEffects.ts';
import { atmosphereFor } from '../src/atmosphere.ts';
import { BLACKFLAG_ATMOSPHERE } from '../src/blackflagPresentation.ts';

const CHAPTERS = ['camlann', 'frostcourt', 'blackflag'];

it('each chapter authors finite light dressing, and presentation never reaches collision', () => {
  for (const id of CHAPTERS) {
    const data = getMap(id).data, p = data.presentation!;
    expect(p.glows?.length, id).toBeGreaterThan(4);
    for (const g of p.glows!) { expect(g.slice(0, 4).every(Number.isFinite), id).toBe(true); expect(g[4]).toMatch(/^#[0-9a-f]{6}$/i); }
    for (const pool of p.pools ?? []) expect(pool.slice(0, 4).every(Number.isFinite), id).toBe(true);
    // Stripping the whole presentation block leaves the built collision world identical.
    const bare = buildMap({ ...data, presentation: undefined });
    expect(bare.solids).toEqual(getMap(id).solids);
  }
});

it('effects stay finite over time and in both quality budgets, then dispose cleanly', () => {
  const tex = new THREE.Texture();
  expect(CHAPTER_EFFECT_BUDGET.low.embersPerFire).toBeLessThan(CHAPTER_EFFECT_BUDGET.high.embersPerFire);
  for (const id of CHAPTERS) for (const quality of ['high', 'low'] as const) {
    const fx = new ChapterEffects(getMap(id).data.presentation!, tex, quality);
    for (const dt of [1 / 60, 0.5, NaN, -1, 1 / 30]) fx.update(dt);
    fx.sync(new THREE.PerspectiveCamera(78, 1.6, .05, 260), 720, new THREE.Fog(0xffffff, 60, 200));
    let points = 0;
    fx.root.traverse((o) => {
      const geo = (o as THREE.Points).geometry;
      if (!geo) return;
      points++;
      for (const v of geo.getAttribute('position').array as Float32Array) expect(Number.isFinite(v), id).toBe(true);
    });
    expect(points, id).toBeGreaterThan(0);
    // Every layer is one draw: glows, pools, embers, smoke and one ambient field at most.
    expect(fx.root.children.length, id).toBeLessThanOrEqual(5);
    fx.dispose(); fx.dispose();
    expect(fx.root.parent).toBeNull();
  }
});

it('crafted chapters dim the room environment so sun shadows read', () => {
  for (const a of [atmosphereFor('oathfield'), atmosphereFor('snowcourt'), BLACKFLAG_ATMOSPHERE]) {
    expect(a.environment).toBeGreaterThan(0); expect(a.environment).toBeLessThan(1);
  }
  // Legacy presets keep the original full-strength environment.
  for (const preset of ['dusk', 'aurora', 'day']) expect(atmosphereFor(preset).environment).toBeUndefined();
});
