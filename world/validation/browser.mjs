// Optional Playwright browser checks: PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE can
// point to an already installed runner/browser; otherwise use local Playwright.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.WORLD_URL || 'http://127.0.0.1:4177';
const output = resolve(process.env.WORLD_TEST_OUTPUT || 'validation/artifacts');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
async function check(name, fn) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try { await fn(page); results.push({ name, passed: true }); }
  catch (e) { results.push({ name, passed: false, error: e.message }); }
  finally { await page.close(); }
}
async function ready(page) {
  await page.goto(base);
  await page.waitForFunction(() => window.__world?.ready, null, { timeout: 30000 });
  await page.evaluate(() => { localStorage.clear(); window.__world.done.clear(); window.__world.found.clear(); });
}
async function enter(page) {
  await page.locator('#start').click();
  await page.waitForFunction(() => document.pointerLockElement === document.getElementById('view'));
}
await check('minimap arrow stays centered when x differs from z', async page => {
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.translate;
    CanvasRenderingContext2D.prototype.translate = function(x, y) { this.__lastTranslate = [x, y]; return original.call(this, x, y); };
  });
  await ready(page);
  await page.evaluate(() => { const p = window.__world.player; p.flying = true; p.teleport(3, 21, 159); });
  await page.waitForTimeout(100);
  const xy = await page.evaluate(() => document.getElementById('minimap').getContext('2d').__lastTranslate);
  assert.ok(Math.abs(xy[0] - 190) < 0.001 && Math.abs(xy[1] - 190) < 0.001, `expected [190,190], got ${JSON.stringify(xy)}`);
});
await check('unlocked movement and progress reset are ignored', async page => {
  await ready(page);
  await page.evaluate(() => { const w = window.__world; w.player.flying = true; w.player.teleport(3, 40, 159); w.done.add('relay_b'); });
  await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w');
  await page.keyboard.press('r');
  const result = await page.evaluate(() => ({ z: window.__world.player.pos.z, done: window.__world.done.has('relay_b') }));
  assert.equal(result.z, 159); assert.equal(result.done, true);
});
await check('locked movement works and release clears held inputs', async page => {
  await ready(page); await enter(page);
  await page.evaluate(() => { const p = window.__world.player; p.flying = true; p.teleport(3, 40, 159, 0); });
  await page.keyboard.down('w'); await page.waitForTimeout(200);
  const moved = await page.evaluate(() => window.__world.player.pos.z);
  assert.ok(moved < 158);
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => document.pointerLockElement === null);
  const stopped = await page.evaluate(() => window.__world.player.pos.z);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__world.player.pos.z), stopped);
  await page.keyboard.up('w'); await enter(page);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__world.player.pos.z), stopped);
});
await check('full map blocks movement, interaction and reset until closed', async page => {
  await ready(page); await enter(page);
  await page.evaluate(() => { const w = window.__world; w.player.flying = true; w.player.teleport(3, 40, 159); w.done.add('relay_b'); });
  await page.keyboard.press('m');
  await page.keyboard.down('w'); await page.keyboard.press('r'); await page.waitForTimeout(200); await page.keyboard.up('w');
  const r = await page.evaluate(() => ({ z: window.__world.player.pos.z, done: window.__world.done.has('relay_b'), open: document.getElementById('bigmap').classList.contains('open') }));
  assert.equal(r.open, true); assert.equal(r.z, 159); assert.equal(r.done, true);
  await page.keyboard.press('m');
  await page.keyboard.down('w'); await page.waitForTimeout(150); await page.keyboard.up('w');
  assert.ok(await page.evaluate(() => window.__world.player.pos.z < 158));
});
await check('flight ascend does not activate nearby relay', async page => {
  await ready(page); await enter(page);
  await page.evaluate(() => { const w = window.__world; const m = w.layout.markers.find(m => m.id === 'relay_b'); w.player.flying = true; w.player.teleport(...m.p); });
  await page.keyboard.press('e');
  assert.equal(await page.evaluate(() => window.__world.done.has('relay_b')), false);
});
await check('failed layout shows actionable error and retry recovers', async page => {
  let fail = true;
  await page.route('**/assets/world_alpha.layout.json', route => fail ? route.fulfill({ status: 503, body: 'unavailable' }) : route.continue());
  await page.goto(base);
  await page.waitForFunction(() => /加载失败/.test(document.getElementById('loading')?.textContent || ''), null, { timeout: 5000 });
  assert.equal(await page.locator('#retry').isVisible(), true);
  fail = false;
  await page.locator('#retry').click();
  await page.waitForFunction(() => window.__world?.ready, null, { timeout: 30000 });
  assert.equal(await page.locator('#retry').count(), 0);
});
await check('pointer-lock rejection stays recoverable without unhandled rejection', async page => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  await page.evaluate(() => { document.getElementById('view').requestPointerLock = () => Promise.reject(new Error('denied for test')); });
  await page.locator('#start').click();
  await page.waitForTimeout(150);
  assert.equal(errors.length, 0, errors.join('; '));
  assert.match(await page.locator('#loading').textContent(), /鼠标.*(失败|未|无法)|无法.*鼠标/);
  assert.equal(await page.locator('#start').isVisible(), true);
});
await check('healthy scene screenshot and no runtime errors', async page => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  await page.screenshot({ path: resolve(output, 'world-spawn.png') });
  await page.keyboard.press('3'); // intentionally ignored before entering
  assert.equal(errors.length, 0, errors.join('; '));
});
await browser.close();
await writeFile(resolve(output, 'browser-report.json'), JSON.stringify({ base, results }, null, 2));
for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'} ${r.name}${r.error ? ': ' + r.error : ''}`);
process.exitCode = results.some(r => !r.passed) ? 1 : 0;
