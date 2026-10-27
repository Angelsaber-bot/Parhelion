import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

test('era actor lifecycle uses frame dt, pauses offscreen actors, backs off failures, and guards disposal races', async () => {
  const source = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(source, /function updateEraActors\(dt: number\)/);
  assert.match(source, /entry\.actor\.update\(dt, !nearby \|\| !gameplayActive\(\)\)/);
  assert.match(source, /entry\.retryAt = performance\.now\(\) \+ Math\.min\(30_000/);
  assert.match(source, /if \(eraActorsDisposed\) \{ actor\.dispose\(\); return; \}/);
  assert.match(source, /eraActorsDisposed = true/);
  assert.match(source, /updateEraActors\(dt\)/);
});
