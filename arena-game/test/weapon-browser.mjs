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
  assert.equal(requests.length, 8); assert.match(await page.textContent('#art-info'), /可在大厅对应配装槽装备/);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#armory-dialog').count(), 0);
  await page.click('#armory'); await page.click('[data-art="longnight"]'); await page.click('#armory-close');
  await page.click('#armory'); await page.waitForFunction(() => document.querySelector('#art-status')?.textContent.includes('三角形'));
  await page.screenshot({ path: output + '/armory.png' });
});
await check('Arena equipped models, FPS ADS, scope reset and weapon-switch interruption', async (page) => {
  await page.addInitScript(() => localStorage.setItem('parhelion-loadout-v1', JSON.stringify({ version: 1, weapons: ['lumen', 'longnight', 'blade'] })));
  await page.goto(arena + '?low&test&autostart');
  await page.waitForFunction(() => window.arena?.scene?.viewmodel?.root.children.some((o) => o.userData.artState === 'ready'));
  await page.keyboard.down('e');
  await page.mouse.down({ button: 'right' });
  await page.waitForFunction(() => window.arena.scene.camera.fov < 58);
  await page.keyboard.up('e');
  assert.equal(await page.evaluate(() => window.arena.controls.aimHeld), true);
  assert.equal(await page.evaluate(() => window.arena.scene.viewmodel.aim > .9), true);
  await page.keyboard.press('2');
  await page.waitForFunction(() => window.arena.scene.camera.fov > 77);
  await page.mouse.up({ button: 'right' }); await page.mouse.down({ button: 'right' });
  await page.waitForFunction(() => window.arena.scene.camera.fov < 18);
  assert.equal(await page.locator('#scope').isVisible(), true);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.arena.scene.camera.fov > 77);
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('3'); await page.keyboard.down('e');
  await page.waitForFunction(() => window.arena.scene.viewmodel.root.children.some((o) => o.userData.artId === 'refract'));
  assert.equal(await page.evaluate(() => window.arena.scene.camera.fov > 77), true); // melee cannot scope
  await page.keyboard.up('e');
  await page.screenshot({ path: output + '/arena.png' });
});
for (const choice of [
  { ids: ['lumen', 'corona', 'blade'], arts: ['dawn', 'afterglow', 'refract'] },
  { ids: ['halo', 'firefly', 'polearm'], arts: ['meridian', 'firefly', 'meteor'] },
  { ids: ['longnight', 'lumen', 'hammer'], arts: ['longnight', 'dawn', 'faultline'] },
]) await check(`normal lobby selection + real combat art: ${choice.ids.join('/')}`, async (page) => {
  await page.goto(arena + '?low&test');
  // Choose the first gun while the default second is corona; then choose the second.
  await page.selectOption('#loadout [data-slot="0"]', choice.ids[0]);
  await page.selectOption('#loadout [data-slot="1"]', choice.ids[1]);
  await page.selectOption('#loadout [data-slot="2"]', choice.ids[2]);
  await page.reload();
  for (let slot = 0; slot < 3; slot++) assert.equal(await page.inputValue(`#loadout [data-slot="${slot}"]`), choice.ids[slot]);
  await page.click('#play'); await page.waitForFunction(() => window.session?.match?.player('you'));
  // Keep this a repeatable input/art smoke rather than a difficulty benchmark.
  await page.evaluate(() => { for (const slot of window.session.match.slots.values()) if (slot.info.bot) slot.controller = undefined; });
  for (let slot = 0; slot < 3; slot++) {
    await page.keyboard.press(String(slot + 1));
    await page.waitForFunction((id) => window.arena.scene.viewmodel.root.children.some((o) => o.userData.artState === 'ready' && o.userData.artId === id), choice.arts[slot]);
    assert.equal(await page.evaluate(() => window.session.match.player('you').weaponSlot), slot);
    assert.deepEqual(await page.evaluate(() => window.session.match.player('you').loadout), choice.ids);
    await page.waitForFunction(() => window.session.match.player('you').fireCd === 0);
    if (slot < 2) {
      const before = await page.evaluate(() => { const p = window.session.match.player('you'); return p.ammo[p.weapon]; });
      await page.mouse.click(640, 400);
      await page.waitForFunction((n) => { const p = window.session.match.player('you'); return p.ammo[p.weapon] < n; }, before);
    } else {
      await page.mouse.down();
      await page.waitForFunction(() => window.session.match.player('you').meleeWindup > 0);
      await page.mouse.up();
      await page.waitForFunction(() => window.session.match.player('you').meleeWindup === 0);
      assert.match(await page.textContent('#ammo'), /恢复|就绪/);
    }
  }
});
await check('Arena ended S scoreboard and two fresh rematches never retain prior-round scores', async (page) => {
  await page.goto(arena + '?low&test&autostart');
  await page.waitForFunction(() => window.session?.match?.player('you'));
  await page.evaluate(() => { for (const slot of window.session.match.slots.values()) slot.controller = undefined; });
  for (let round = 0; round < 2; round++) {
    await page.evaluate(() => {
      const match = window.session.match; match.phase = 'live'; match.phaseT = 1;
      match.score = { A: 7, B: 3 };
      for (const slot of match.slots.values()) { slot.kills = 4; slot.deaths = 2; }
    });
    await page.waitForFunction(() => window.game.ended);
    assert.equal(await page.locator('#scoreboard').isVisible(), false);
    await page.keyboard.press('s'); await page.waitForSelector('#scoreboard.results:not(.hidden)');
    assert.equal(await page.locator('#scoreboard [data-close-scores]').isVisible(), true);
    await page.click('#scoreboard [data-close-scores]'); assert.equal(await page.locator('#scoreboard').isVisible(), false);
    await page.keyboard.press('s'); await page.waitForSelector('#scoreboard.results:not(.hidden)');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#scoreboard').isVisible(), false);
    await page.click('#rematch'); await page.waitForFunction(() => !window.game.ended);
    assert.deepEqual(await page.evaluate(() => window.session.match.score), { A: 0, B: 0 });
    assert.equal(await page.evaluate(() => [...window.session.match.slots.values()].every((p) => p.kills === 0 && p.deaths === 0)), true);
    assert.equal(await page.locator('#scoreboard').isVisible(), false);
    await page.keyboard.down('s');
    assert.equal(await page.evaluate(() => window.arena.controls.sample().mz), -1);
    await page.keyboard.up('s');
  }
});
await check('Arena language changes live menus and weapon categories without changing player name', async (page) => {
  await page.goto(arena + '?low');
  await page.fill('#name', '准备玩家');
  await page.selectOption('body > .parhelion-language select', 'en');
  assert.match(await page.textContent('#loadout'), /Assault Rifle AR/);
  assert.equal(await page.inputValue('#name'), '准备玩家');
  await page.click('#settings-lobby');
  assert.match(await page.textContent('#arena-settings h2'), /Controls/);
  await page.selectOption('#arena-settings .parhelion-language select', 'zh');
  assert.match(await page.textContent('#arena-settings h2'), /操作设置/);
  await page.click('#arena-settings [data-close]');
  assert.match(await page.textContent('#loadout'), /突击步枪 AR/);
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
  await page.click(`${panel} [data-slot="primary"][data-bind="aim"]`); await page.keyboard.press('Escape');
  assert.equal(await page.locator(panel).isVisible(), true); // capture cancelled, not trapped/closed
  await page.click(`${panel} [data-slot="primary"][data-bind="fire"]`); await page.keyboard.press('p');
  assert.equal(await page.textContent(`${panel} [data-slot="primary"][data-bind="fire"]`), '主：P');
  await page.click(`${panel} [data-slot="primary"][data-bind="fire"]`); await page.keyboard.press('w');
  assert.match(await page.textContent(`${panel} [data-status]`), /已用于/);
  await page.click(`${panel} [data-swap]`);
  assert.equal(await page.textContent(`${panel} [data-slot="primary"][data-bind="forward"]`), '主：P');
  await page.locator(`${panel} [data-normal]`).evaluate((el) => { el.value = '1.5'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click(`${panel} [data-close]`); await page.reload();
  if (mode === 'world') await page.waitForFunction(() => window.__world?.ready, null, { timeout: 60000 });
  await page.click(open);
  assert.equal(await page.inputValue(`${panel} [data-normal]`), '1.5');
  assert.equal(await page.textContent(`${panel} [data-slot="primary"][data-bind="forward"]`), '主：P');
  await page.click(`${panel} [data-reset]`);
  assert.equal(await page.textContent(`${panel} [data-slot="primary"][data-bind="forward"]`), '主：W');
  await page.keyboard.press('Escape'); assert.equal(await page.locator(panel).isVisible(), false);
});
await browser.close();
await writeFile(output + '/weapon-browser-report.json', JSON.stringify({ arena, world, results }, null, 2));
for (const result of results) console.log(result);
process.exitCode = results.some((r) => !r.passed) ? 1 : 0;
