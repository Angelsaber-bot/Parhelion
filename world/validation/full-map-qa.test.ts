/** Presentation may change; historical projection and the published minimap may not. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import * as THREE from 'three';
import { WorldMap } from '../src/map';
import * as regions from '../src/regions';
import * as mini from '../src/minimapMarkers';
import { fullMapPresentation, projectFullMapTarget } from '../src/fullMapPresentation';
import { getLanguage, localizeText, setLanguage } from '../../shared-client/i18n';
import type { Layout } from '../src/types';
const layout = regions.mergeLayouts(regions.REGIONS.map(def => ({ def,
  layout: JSON.parse(readFileSync(new URL(`../public/assets/${def.file}.layout.json`, import.meta.url), 'utf8')) as Layout,
})));
function historical(file: string) {
  const source = readFileSync(new URL(`./map-qa/${file}`, import.meta.url), 'utf8');
  assert.equal(createHash('sha256').update(source).digest('hex'), file.startsWith('a309625')
    ? '8e72dcb707707b911278318118f8efe93b1d9fa1aefeb5ead2cf09690eb1ae8d'
    : '7cd631f6c00ac9deb50229911eab331f9a2b75a982df085f63d5c03ce5e50de8', 'historical sources remain verbatim');
  const module = { exports: {} as Record<string, unknown> };
  runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs' }).code, { module, exports: module.exports,
    require: (name: string) => ({ three: THREE, '../../shared-client/i18n': { localizeText }, './regions': regions, './minimapMarkers': mini })[name] ?? (() => { throw new Error(name); })(),
    performance: { now: () => 123 } });
  return module.exports.WorldMap as typeof WorldMap;
}
const old = historical('a309625-map.ts.txt'), previous = historical('5c90ffa-map.ts.txt');
const measure = (text: string, size: number) => [...text].reduce((n, c) => n + (/[^\x00-\xff]/.test(c) ? size : size * .55), 0);
function recorder(width: number, clientWidth = width) {
  const commands: unknown[][] = [];
  const ctx = new Proxy({ canvas: { width, clientWidth } } as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text: string) => ({ width: measure(text, Number(/([\d.]+)px/.exec(String(target.font))?.[1] ?? 12)) });
      return (...args: unknown[]) => { commands.push([key, ...args]); };
    },
    set(target, key: string, value) { target[key] = value; commands.push(['set', key, value]); return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, commands };
}
const shapes = [{ size: 361, half: 360 },
  { size: 1081, sizeZ: 641, half: 1080, halfZ: 640, x0: -500, z0: -250 },
  { size: 321, sizeZ: 901, half: 320, halfZ: 900, x0: 130, z0: -740 }];
const instance = (Class: typeof WorldMap, shape = shapes[0]) => Object.assign(Object.create(Class.prototype) as WorldMap, shape, { base: 'same terrain', layout });
test('36 historical full-map projection cases and 36 published-minimap draw streams remain unchanged', t => {
  t.mock.method(performance, 'now', () => 123);
  const language = getLanguage();
  try {
    for (const lang of ['zh', 'en'] as const) for (const shape of shapes) for (const target of [null, [0, 0], [10000, -10000]] as const) for (const completed of [false, true]) {
      setLanguage(lang);
      for (const full of [false, true]) {
        const original = instance(full ? old : previous, shape), current = instance(WorldMap, shape);
        const a = recorder(full ? 1200 : 380), b = recorder(full ? 1200 : 380);
        const opts = { full, done: new Set(completed ? layout.markers.map(m => m.id) : []), found: new Set<string>(), target: target ? [...target] as [number, number] : null,
          enemies: [{ p: { x: 300, z: 100 }, boss: false }, { p: { x: -50, z: 90 }, boss: true }] };
        for (const [map, ctx] of [[original, a.ctx], [current, b.ctx]] as const) map.draw(ctx, new THREE.Vector3(321, 10, 27), 1.35, opts);
        if (!full) assert.equal(JSON.stringify(b.commands), JSON.stringify(a.commands));
        else {
          const geometry = (commands: unknown[][]) => commands.filter(c => ['drawImage', 'translate', 'rotate'].includes(String(c[0])));
          assert.deepEqual(geometry(b.commands), geometry(a.commands));
          for (const v of [-10000, -720, 0, 159, 10000]) { assert.equal(current.px(v), original.px(v)); assert.equal(current.pz(v), original.pz(v)); }
          assert.ok(!b.commands.some(c => c[0] === 'arc'), 'ordinary dots must not return');
          for (const color of ['#ff3b4e', '#ffb547', '#7ad18a', '#ffffff55', '#c9a2ff', '#5fe7f2', '#ff5d6c']) assert.ok(!b.commands.some(c => c[2] === color));
        }
      }
    }
  } finally { setLanguage(language); }
});
const project = ([x, z]: readonly [number, number]) => ({ x: (x + 1080) / 2160 * 1200, y: (z + 1080) / 2160 * 1200 });
test('five localized readable headings, bounded existing symbols, nonoverlapping labels on small and retina canvases', () => {
  const language = getLanguage();
  try {
    for (const lang of ['zh', 'en'] as const) for (const width of [320, 480, 720, 1200]) {
      setLanguage(lang);
      const result = fullMapPresentation(layout, project, 1200, width, project([3, 159]), project([-118, 222]), new Set(), measure);
      assert.equal(new Set(result.labels.filter(l => l.region).map(l => l.box)).size, 5, `${lang} at ${width}px`);
      assert.ok(result.landmarks.length <= 9);
      const boxes = [...new Set(result.labels.map(l => l.box))];
      for (const a of boxes) for (const b of boxes) if (a !== b) assert.ok(a[0] >= b[2] || a[2] <= b[0] || a[1] >= b[3] || a[3] <= b[1]);
      for (const label of result.labels) assert.ok(label.size / result.unit >= (label.region ? 12 : 9));
      if (lang === 'en') assert.ok(result.labels.every(l => !/[\u3400-\u9fff]/.test(l.text)));
      if (width >= 540) assert.ok(result.labels.some(l => !l.region), 'useful key-location names remain');
      for (const p of result.landmarks.filter(p => p.kind === 'travel')) {
        const [, region, id] = p.id.split(':'); const area = layout.areas.find(a => a.region === region && a.id === id)!;
        assert.ok(area); assert.deepEqual({ x: p.x, y: p.y }, project(area.tp));
      }
    }
  } finally { setLanguage(language); }
});
test('region headings relocate inside their region when player and quest cover the usual anchor', () => {
  for (const width of [320, 640]) for (const player of [[0, -402], [3, 159]] as const) {
    const result = fullMapPresentation(layout, project, 1200, width, project(player), project([0, -150.5]), new Set(), measure);
    assert.equal(new Set(result.labels.filter(l => l.region).map(l => l.box)).size, 5);
  }
});
test('chapter symbols reflect existing summon unlock, and presentation cannot mutate progress', () => {
  for (const unlocked of [false, true, false]) {
    const done = new Set(unlocked ? ['summon_circle'] : []), before = [...done];
    const result = fullMapPresentation(layout, project, 1200, 720, project([3, 159]), null, done, measure);
    const gates = result.landmarks.filter(l => l.kind === 'entrance');
    assert.equal(gates.length, 4); assert.ok(gates.every(g => g.locked === !unlocked)); assert.deepEqual([...done], before);
  }
});
test('active quest survives clustering, switching, clearing, arrival and out-of-world positions', t => {
  t.mock.method(performance, 'now', () => 123);
  const map = instance(WorldMap, { size: 1081, half: 1080 });
  for (const target of [[-112, 246], [360, 30], [3, 159], [1032, 0], [10000, -10000], null] as Array<[number, number] | null>) {
    const drawn = recorder(1200, 320);
    map.draw(drawn.ctx, new THREE.Vector3(3, 0, 159), 0, { full: true, done: new Set(), found: new Set(), target });
    assert.equal(drawn.commands.filter(c => c[0] === 'set' && c[1] === 'fillStyle' && c[2] === '#ffd76a').length, target ? 1 : 0);
    if (target) {
      const p = projectFullMapTarget(project(target), 1200, 3.75);
      assert.ok(p.x >= 0 && p.x <= 1200 && p.y >= 0 && p.y <= 1200);
      const result = fullMapPresentation(layout, project, 1200, 320, project([3, 159]), p, new Set(), measure);
      assert.ok(result.landmarks.every(l => Math.hypot(l.x - p.x, l.y - p.y) > 23 * 3.75));
    }
  }
  for (const position of [[300, 300], [1032, 0]] as const) assert.deepEqual(projectFullMapTarget(project(position), 1200, 3.75), project(position));
});
test('full-map overlay covers help/HUD without modifying controls or their visibility state', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /#bigmap \{ z-index: 6;/); assert.match(html, /#bigmap\.open \{ display: flex; \}/);
});
