import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const site = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(site, 'apply-localization.mjs');
const run = (args) => execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
test('homepage patch preserves live HTML/assets, makes a backup, and is idempotent', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'parhelion-home-review-'));
  try {
    const original = await fs.readFile(path.join(site, 'reference-home.html'), 'utf8');
    await fs.writeFile(path.join(root, 'index.html'), original); await fs.mkdir(path.join(root, 'site/assets'), { recursive: true });
    await fs.writeFile(path.join(root, 'site/style.css'), 'original CSS'); await fs.writeFile(path.join(root, 'site/assets/hero.webp'), 'original asset');
    assert.match(run([root, '--dry-run']), /Verified/); assert.equal(await fs.readFile(path.join(root, 'index.html'), 'utf8'), original);
    assert.match(run([root]), /No deployment/);
    const result = await fs.readFile(path.join(root, 'index.html'), 'utf8');
    assert.equal(result.replace(/  <link rel="stylesheet" href="\/site\/language.css" data-parhelion-language>\n/, '').replace(/  <script type="module" src="\/site\/home-language.js" data-parhelion-language><\/script>\n/, ''), original);
    assert.equal(await fs.readFile(path.join(root, 'index.html.before-language'), 'utf8'), original);
    assert.equal(await fs.readFile(path.join(root, 'site/style.css'), 'utf8'), 'original CSS');
    assert.equal(await fs.readFile(path.join(root, 'site/assets/hero.webp'), 'utf8'), 'original asset');
    run([root]); assert.equal(await fs.readFile(path.join(root, 'index.html'), 'utf8'), result);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('homepage patch refuses incompatible pages and existing different locale artifacts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'parhelion-home-reject-'));
  try {
    const wrong = '<html><head></head><body>Another site</body></html>';
    await fs.writeFile(path.join(root, 'index.html'), wrong);
    assert.throws(() => run([root]), /recognized Parhelion homepage/); assert.equal(await fs.readFile(path.join(root, 'index.html'), 'utf8'), wrong);
    const original = await fs.readFile(path.join(site, 'reference-home.html'), 'utf8'); await fs.writeFile(path.join(root, 'index.html'), original);
    await fs.mkdir(path.join(root, 'site')); await fs.writeFile(path.join(root, 'site/home-language.js'), 'unrelated customization');
    assert.throws(() => run([root]), /Existing locale file differs/);
    assert.equal(await fs.readFile(path.join(root, 'index.html'), 'utf8'), original);
    assert.equal(await fs.readFile(path.join(root, 'site/home-language.js'), 'utf8'), 'unrelated customization');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
