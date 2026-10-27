import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { loadLayout } from '../src/load.ts';
import { localizeText, onLanguageChange, setLanguage } from '../../shared-client/i18n';
const valid = JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json', import.meta.url), 'utf8'));
const fetchJSON = (value: unknown) => (async () => new Response(JSON.stringify(value), { status: 200 })) as typeof fetch;

test('committed layout loads without changing data', async () => {
  assert.deepEqual(await loadLayout('fixture', fetchJSON(valid)), valid);
});
test('HTTP error is rejected before parsing its response body', async () => {
  let parsed = false;
  const fetcher = (async () => ({ ok: false, status: 503, json() { parsed = true; return valid; } })) as unknown as typeof fetch;
  await assert.rejects(loadLayout('fixture', fetcher), /HTTP 503/);
  assert.equal(parsed, false);
});
test('malformed JSON and invalid layout roots fail with useful errors', async () => {
  await assert.rejects(loadLayout('fixture', (async () => new Response('not JSON')) as typeof fetch));
  for (const value of [null, [], {}, { ...valid, world: { ...valid.world, half: 0 } }, { ...valid, areas: [] }, { ...valid, markers: [] }]) {
    await assert.rejects(loadLayout('fixture', fetchJSON(value)), /地图布局数据无效/);
  }
});
test('invalid positions, duplicate marker IDs and missing prerequisites are rejected', async () => {
  for (const mutate of [
    (v: any) => { v.markers[0].p = [0, 'NaN', 0]; },
    (v: any) => { v.markers.push(v.markers[0]); },
    (v: any) => { v.markers[0].requires = ['absent']; },
    (v: any) => { v.objective.steps[0].done = ['absent']; },
  ]) {
    const fixture = structuredClone(valid); mutate(fixture);
    await assert.rejects(loadLayout('fixture', fetchJSON(fixture)), /地图布局数据无效/);
  }
});
test('bootstrap rejection disposes renderer and exposes a single functional retry button', async () => {
  const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const section = source.slice(source.indexOf('void boot().catch'));
  assert.ok(section.length > 200);
  const loading = { textContent: '' }, children: any[] = [];
  let disposed = 0, reloaded = 0, stopped = 0;
  const start = { classList: { remove() {} }, append(child: any) { children.push(child); } };
  const context = vm.createContext({ localizeText, onLanguageChange, setLoading: (source: string) => { loading.textContent = localizeText(source); }, bootFailed: false, boot: async () => { throw new Error('HTTP 503'); }, disposeRenderer() { disposed++; }, $: (id: string) => id === 'loading' ? loading : start, document: { createElement() { return { addEventListener(_s: string, fn: unknown) { this.click = fn; } }; } }, location: { reload() { reloaded++; } } });
  vm.runInContext(transformSync(section, { loader: 'ts', format: 'cjs' }).code, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.bootFailed, true);
  assert.equal(disposed, 1);
  assert.match(loading.textContent, /地图加载失败.*HTTP 503/);
  assert.equal(children.length, 1); assert.equal(children[0].id, 'retry');
  setLanguage('en'); assert.equal(children[0].textContent, 'Reload');
  setLanguage('zh'); assert.equal(children[0].textContent, '重新加载');
  children[0].click({ stopPropagation() { stopped++; } });
  assert.equal(reloaded, 1); assert.equal(stopped, 1);
});
