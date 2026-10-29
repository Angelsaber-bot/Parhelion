// Prepared browser integration checks. A launch failure is a BLOCK, never a pass.
// Uses actual UI F interaction; damage is injected to focus repeat/reward state, not a combat-skill playthrough.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve(process.env.WORLD_TEST_OUTPUT||'validation/artifacts/enemies');await mkdir(out,{recursive:true});
const report={stage:'launch',passed:false,errors:[],checks:[],limitation:'Injected damage accelerates boss victories; screenshots require visual review.'};let browser;
try {
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>report.errors.push(e.message));
 report.stage='world-load';await page.goto(process.env.WORLD_URL||'http://127.0.0.1:4177');await page.waitForFunction(()=>window.__world?.ready,null,{timeout:120000});
 async function enter(){if(!await page.evaluate(()=>!!document.pointerLockElement)){await page.locator('#start').click();await page.waitForFunction(()=>!!document.pointerLockElement);}}
 const cores=['sun_core','sea_core','winter_core','fire_core'];
 for(const core of cores){
  report.stage=`boss:${core}`;
  await page.evaluate(core=>{const w=window.__world,m=w.layout.markers.find(m=>m.id===core);if(!m)throw new Error(`Missing ${core}`);w.done.delete(core);for(const r of m.requires||[])w.done.add(r);w.combat.reset();w.player.flying=false;w.player.teleport(...m.p);},core);
  await enter();
  for(let round=0;round<3;round++){
   await page.keyboard.press('f');await page.waitForFunction(()=>window.__world.combat.bossStarted);
   const before=await page.evaluate(()=>window.__world.combat.state.boss.hp);await page.keyboard.press('f');assert.equal(await page.evaluate(()=>window.__world.combat.state.boss.hp),before);
   await page.screenshot({path:resolve(out,`${core}-round-${round}.png`)});
   await page.evaluate(()=>{const c=window.__world.combat;c.damageEnemy(c.state.boss.id,c.state.boss.maxHp);});
   await page.waitForFunction(()=>!window.__world.combat.bossStarted);
   assert.equal(await page.evaluate(core=>window.__world.done.has(core),core),true);
  }
  report.checks.push(`${core}: three UI challenges, duplicate interaction, injected victories`);
 }
 report.stage='save-reload';await page.reload();await page.waitForFunction(()=>window.__world?.ready,null,{timeout:120000});
 for(const core of cores)assert.equal(await page.evaluate(core=>window.__world.done.has(core),core),true);
 await page.evaluate(()=>{const w=window.__world,m=w.layout.markers.find(m=>m.id==='sun_core');w.player.teleport(...m.p);});await enter();await page.keyboard.press('f');await page.waitForFunction(()=>window.__world.combat.bossStarted);
 report.checks.push('completed save reload accepts UI rechallenge');
 report.stage='actual-models';
 for(const [region,x,z] of [['britain',-720,0],['blacksail',720,0],['winter',0,-720],['kyoto',0,720]]){
  await page.evaluate(({x,z})=>{const w=window.__world;w.combat.state.resetBoss();const e=w.combat.state.enemies.filter(e=>e.kind!=='king').sort((a,b)=>Math.hypot(a.home.x-x,a.home.z-z)-Math.hypot(b.home.x-x,b.home.z-z))[0];w.player.teleport(e.home.x,e.home.y,e.home.z+8,0);w.player.pitch=0;},{x,z});
  await page.waitForFunction(()=>window.__world.combat.visualDiagnostics.activeMixers>0,null,{timeout:30000});
  const diagnostics=await page.evaluate(()=>window.__world.combat.visualDiagnostics);assert.ok(diagnostics.activeMixers<=diagnostics.budget);
  await page.screenshot({path:resolve(out,`${region}-actual-enemies.png`)});report.checks.push(`${region}: loaded actual model instance within mixer budget`);
 }
 assert.deepEqual(report.errors,[]);report.stage='complete';report.passed=true;
}catch(e){report.failure=String(e.stack||e);process.exitCode=1;}finally{await browser?.close();await writeFile(resolve(out,'enemy-boss-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
