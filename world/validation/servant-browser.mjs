// OPTIONAL / NOT EXECUTED in the restricted cloud: requires an authorized working browser.
// Uses existing Playwright only. Start World preview separately, then run this file.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out=resolve(process.env.WORLD_TEST_OUTPUT || 'validation/artifacts/artoria');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:960},recordVideo:{dir:out}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(process.env.WORLD_URL || 'http://127.0.0.1:4177/?region=britain');
  await page.waitForFunction(()=>window.__world?.ready,null,{timeout:90000});
  await page.evaluate(async()=>{
    const w=window.__world,m=w.layout.markers.find(m=>m.id==='saber_contract');
    w.done.delete('saber_contract');w.contract.reset();w.player.teleport(m.p[0]+1.5,m.p[1],m.p[2]-4,Math.PI);
    w.player.pitch=-.05;await w.servant.ensureLoaded();
  });
  await page.waitForFunction(()=>window.__world.servant.state==='ready');
  await page.screenshot({path:resolve(out,'01-armor-npc.png')});
  await page.locator('#servant-open').click();await page.locator('#servant-outfit').selectOption('civilian');
  await page.waitForFunction(()=>window.__world.servant.activeOutfit==='civilian');
  await page.screenshot({path:resolve(out,'02-civilian-menu.png')});
  await page.keyboard.press('Escape');assert.equal(await page.locator('#servant-settings').evaluate(e=>e.open),false);
  await page.evaluate(()=>window.__world.contract.recruit());await page.locator('#start').click();
  await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#view'));
  await page.keyboard.down('w');await page.waitForTimeout(1500);await page.keyboard.up('w');
  await page.screenshot({path:resolve(out,'03-civilian-follow.png')});
  await page.keyboard.press('t');await page.waitForFunction(()=>!window.__world.servant.root.visible);
  await page.keyboard.press('t');await page.waitForFunction(()=>window.__world.servant.root.visible);
  await page.evaluate(()=>document.exitPointerLock());await page.locator('#servant-open').click();
  await page.locator('#servant-outfit').selectOption('armor');await page.waitForFunction(()=>window.__world.servant.activeOutfit==='armor');
  assert.equal(await page.evaluate(()=>window.__world.done.has('saber_contract')),true);
  assert.deepEqual(errors,[]);await writeFile(resolve(out,'browser-result.json'),JSON.stringify({passed:true,errors,note:'Screenshots/video still require human visual review; not an automatic quality acceptance.'},null,2));
}finally{await page.close();await browser.close();}
