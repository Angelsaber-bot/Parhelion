import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve('validation/orleans/artifacts');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:process.env.WORLD_GPU_NATIVE==='1'?['--use-angle=metal']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let result={operations:[],errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>result.errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('parhelion-language-v1','zh'));
 await page.goto(`${process.env.WORLD_URL||'http://127.0.0.1:4185'}/?region=orleans&q=low&nograss`);
 await page.waitForFunction(()=>window.__world?.ready,null,{timeout:120000});await page.evaluate(()=>window.__world.regionVisuals.ensure('orleans'));
 await page.bringToFront();await page.locator('#world-drag-controls').evaluate(el=>el.hidden=false);await page.locator('#world-drag-controls').click();
 result.before=await page.evaluate(()=>[...window.__world.done].sort());
 for(const [id,flag,seconds]of [['orleans_crane_handle','orleans_crane_delivered',5],['orleans_sluice_winch','orleans_sluice_open',3],['orleans_belfry_rope','orleans_belfry_rung',1.5]]){
  await page.evaluate(id=>{const w=window.__world,m=w.layout.markers.find(m=>m.id===id);w.player.flying=false;w.player.teleport(m.p[0],m.p[1]-.35,m.p[2]);},id);
  await page.waitForTimeout(1500);await page.keyboard.press('f');
  await page.waitForFunction(id=>window.__world.orleansWorksRuntime.active===id,id,{timeout:10000});
  await page.waitForFunction(()=>window.__world.orleansWorksRuntime.requiresRelease===false,null,{timeout:10000});
  await page.keyboard.down('f');await page.waitForTimeout(seconds*350);
  if(id==='orleans_crane_handle')await page.screenshot({path:resolve(output,'crane-operating.png')});
  // Software WebGL can render below real time, so wait for simulated completion.
  await page.waitForFunction(flag=>window.__world.done.has(flag),flag,{timeout:120000});await page.keyboard.up('f');
  result.operations.push(await page.evaluate(({id,flag})=>({id,flag,grounded:window.__world.player.onGround,done:window.__world.done.has(flag),active:window.__world.orleansWorksRuntime.active,grilleEnabled:window.__world.orleansWorksScene.collider.enabled}),{id,flag}));
 }
 result.completed=await page.evaluate(()=>({done:[...window.__world.done].sort(),grilleEnabled:window.__world.orleansWorksScene.collider.enabled}));
 await page.reload();await page.waitForFunction(()=>window.__world?.ready,null,{timeout:120000});
 result.restored=await page.evaluate(()=>({done:[...window.__world.done].sort(),grilleEnabled:window.__world.orleansWorksScene.collider.enabled}));
 if(result.errors.length||result.operations.some(a=>!a.done||!a.grounded||a.active)||result.completed.grilleEnabled||JSON.stringify(result.completed)!==JSON.stringify(result.restored))throw Error(JSON.stringify(result));
 console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await writeFile(resolve(output,'works-results.json'),JSON.stringify(result,null,2));}
