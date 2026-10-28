/** Independent baseline differential: simplifying mini must not alter the full map. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import * as THREE from 'three';
import { WorldMap } from '../src/map';
import { REGIONS, mergeLayouts } from '../src/regions';
import { getLanguage, localizeText, setLanguage } from '../../shared-client/i18n';
import type { Layout } from '../src/types';

const baseline = readFileSync(new URL('./map-qa/a309625-map.ts.txt', import.meta.url), 'utf8');
assert.equal(createHash('sha256').update(baseline).digest('hex'), '8e72dcb707707b911278318118f8efe93b1d9fa1aefeb5ead2cf09690eb1ae8d',
  'The fixture is the verbatim committed a309625 map renderer, not a regenerated expected result.');
const compiled = transformSync(baseline, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
const oldModule: { exports: Record<string, unknown> } = { exports: {} };
runInNewContext(compiled, { module: oldModule, exports: oldModule.exports,
  require(name: string) {
    if (name === 'three') return THREE;
    if (name === '../../shared-client/i18n') return { localizeText };
    throw new Error(`Unexpected historical import: ${name}`);
  }, performance: { now: () => 123 } });
const HistoricalWorldMap = oldModule.exports.WorldMap as typeof WorldMap;

function recorder(width: number) {
  const commands: unknown[][] = [];
  const ctx = new Proxy({ canvas: { width } } as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text: string) => ({ width: text.length * 12 });
      return (...args: unknown[]) => { commands.push([key, ...args]); };
    },
    set(target, key: string, value) { target[key] = value; commands.push(['set', key, value]); return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, commands };
}

test('full-map draw commands exactly preserve committed baseline across languages, aspect ratios and quest/completion states', t => {
  t.mock.method(performance, 'now', () => 123);
  const language = getLanguage();
  const layout = mergeLayouts(REGIONS.map(def => ({ def,
    layout: JSON.parse(readFileSync(new URL(`../public/assets/${def.file}.layout.json`, import.meta.url), 'utf8')) as Layout,
  })));
  const shapes = [
    { size: 361, half: 360 },
    { size: 1081, sizeZ: 641, half: 1080, halfZ: 640, x0: -500, z0: -250 },
    { size: 321, sizeZ: 901, half: 320, halfZ: 900, x0: 130, z0: -740 },
  ];
  let cases = 0;
  try {
    for (const language of ['zh', 'en'] as const) {
      setLanguage(language);
      for (const shape of shapes) for (const target of [undefined, [0, 0], [10000, -10000]] as const) for (const completed of [false, true]) {
        const original = Object.assign(Object.create(HistoricalWorldMap.prototype) as WorldMap, shape, { base: 'same terrain', layout });
        const current = Object.assign(Object.create(WorldMap.prototype) as WorldMap, shape, { base: 'same terrain', layout });
        const a = recorder(1200), b = recorder(1200);
        const opts = { full: true, done: new Set(completed ? layout.markers.map(m => m.id) : []),
          found: new Set(completed ? layout.markers.map(m => m.id) : []), target: target ? [...target] as [number, number] : null,
          enemies: [{ p: { x: 300, z: 100 }, boss: false }, { p: { x: -50, z: 90 }, boss: true }] };
        original.draw(a.ctx, new THREE.Vector3(321, 10, 27), 1.35, opts);
        current.draw(b.ctx, new THREE.Vector3(321, 10, 27), 1.35, opts);
        assert.equal(JSON.stringify(b.commands), JSON.stringify(a.commands), `${language}, shape ${JSON.stringify(shape)}, target ${target}, complete ${completed}`);
        cases++;
      }
    }
  } finally { setLanguage(language); }
  assert.equal(cases, 36);
  t.diagnostic('36 full-map canvas command streams exactly match the preserved a309625 source; not a browser screenshot.');
});
