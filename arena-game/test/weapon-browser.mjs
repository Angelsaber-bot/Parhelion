// Optional actual WebGL + UI validation. Start both Vite apps first.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROMIUM_EXECUTABLE=/path/to/chromium node test/weapon-browser.mjs
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.WEAPON_QA_OUTPUT || '../validation-artifacts';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const arena = process.env.ARENA_URL || 'http://127.0.0.1:5174';
const world = process.env.WORLD_URL || 'http://127.0.0.1:5173';
const results = [];
async function check(name, fn) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  try { await fn(page); assert.deepEqual(errors, []); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: String(error), pageErrors: errors }); }
  finally { await page.close(); }
}
await check('gallery fetches only selected art; closes during loading and reopens safely', async (page) => {
  const requests = []; page.on('request', (r) => { if (/weapons.*\.glb|0[1-8]_.*\.glb/.test(r.url())) requests.push(r.url()); });
  await page.goto(arena + '?low'); await page.waitForSelector('#armory');
  assert.equal(requests.length, 0);
  await page.click('#armory'); await page.waitForFunction(() => document.querySelector('#art-status')?.textContent.includes('40,360'));
  assert.equal(requests.length, 1);
  for (const id of ['firefly', 'afterglow', 'meridian', 'longnight', 'refract', 'meteor', 'faultline']) {
    await page.click(`[data-art="${id}"]`);
    await page.waitForFunction(() => document.querySelector('#art-status')?.textContent.includes('三角形'));
  }
  assert.equal(requests.length, 8); assert.match(await page.textContent('#art-info'), /仅模型展示/);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#armory-dialog').count(), 0);
  await page.click('#armory'); await page.click('[data-art="longnight"]'); await page.click('#armory-close');
  await page.click('#armory'); await page.waitForFunction(() => document.querySelector('#art-status')?.textContent.includes('三角形'));
  await page.screenshot({ path: output + '/armory.png' });
});
await check('Arena equipped models, FPS ADS, scope reset and weapon-switch interruption', async (page) => {
  await page.goto(arena + '?low&test&autostart');
  await page.waitForFunction(() => window.arena?.scene?.viewmodel?.root.children.some((o) => o.userData.artState === 'ready'));
  await page.mouse.down({ button: 'right' });
  await page.waitForFunction(() => window.arena.scene.camera.fov < 58);
  assert.equal(await page.evaluate(() => window.arena.scene.viewmodel.aim > .9), true);
  await page.keyboard.press('3');
  await page.waitForFunction(() => window.arena.scene.camera.fov > 77);
  await page.mouse.up({ button: 'right' }); await page.mouse.down({ button: 'right' });
  await page.waitForFunction(() => window.arena.scene.camera.fov < 26);
  assert.equal(await page.locator('#scope').isVisible(), true);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.arena.scene.camera.fov > 77);
  await page.mouse.up({ button: 'right' });
  await page.screenshot({ path: output + '/arena.png' });
});
await check('Arena missing model keeps procedural fallback and remains playable', async (page) => {
  await page.route('**/*01_Dawn_AR*.glb', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto(arena + '?low&test&autostart');
  await page.waitForFunction(() => window.arena?.scene?.viewmodel?.root.children.some((o) => o.userData.artState === 'fallback'));
  await page.mouse.click(640, 400); assert.equal(await page.locator('#hud').isVisible(), true);
});
await check('World remains TPS with fitted rifle and shoulder zoom; map clears ADS', async (page) => {
  await page.goto(world + '?q=low'); await page.waitForFunction(() => window.__world?.ready, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__world.rig.joints.Gun.userData.artState === 'ready');
  assert.equal(await page.evaluate(() => window.__world.thirdPerson), true);
  await page.click('#start'); await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.mouse.down({ button: 'right' }); await page.waitForFunction(() => window.__world.camera.fov < 52);
  assert.equal(await page.evaluate(() => window.__world.rig.root.visible), true);
  await page.keyboard.press('m'); await page.waitForFunction(() => window.__world.camera.fov > 74);
  assert.equal(await page.evaluate(() => window.__world.aim.held), false);
  await page.mouse.up({ button: 'right' }); await page.keyboard.press('m');
  await page.screenshot({ path: output + '/world.png' });
});
for (const mode of ['arena', 'world']) await check(`${mode} settings: capture cancel, rebind, conflict swap, persistence and reset`, async (page) => {
  await page.goto(mode === 'arena' ? arena + '?low' : world + '?q=low');
  if (mode === 'world') await page.waitForFunction(() => window.__world?.ready, null, { timeout: 60000 });
  const open = mode === 'arena' ? '#settings-lobby' : '#settings-open';
  const panel = `#${mode}-settings`;
  await page.click(open); assert.equal(await page.locator(panel).isVisible(), true);
  await page.click(`${panel} [data-bind="aim"]`); await page.keyboard.press('Escape');
  assert.equal(await page.locator(panel).isVisible(), true); // capture cancelled, not trapped/closed
  await page.click(`${panel} [data-bind="fire"]`); await page.keyboard.press('p');
  assert.equal(await page.textContent(`${panel} [data-bind="fire"]`), 'P');
  await page.click(`${panel} [data-bind="fire"]`); await page.keyboard.press('w');
  assert.match(await page.textContent(`${panel} [data-status]`), /已用于/);
  await page.click(`${panel} [data-swap]`);
  assert.equal(await page.textContent(`${panel} [data-bind="forward"]`), 'P');
  await page.locator(`${panel} [data-normal]`).evaluate((el) => { el.value = '1.5'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click(`${panel} [data-close]`); await page.reload();
  if (mode === 'world') await page.waitForFunction(() => window.__world?.ready, null, { timeout: 60000 });
  await page.click(open);
  assert.equal(await page.inputValue(`${panel} [data-normal]`), '1.5');
  assert.equal(await page.textContent(`${panel} [data-bind="forward"]`), 'P');
  await page.click(`${panel} [data-reset]`);
  assert.equal(await page.textContent(`${panel} [data-bind="forward"]`), 'W');
  await page.keyboard.press('Escape'); assert.equal(await page.locator(panel).isVisible(), false);
});
await browser.close();
await writeFile(output + '/weapon-browser-report.json', JSON.stringify({ arena, world, results }, null, 2));
for (const result of results) console.log(result);
process.exitCode = results.some((r) => !r.passed) ? 1 : 0;
