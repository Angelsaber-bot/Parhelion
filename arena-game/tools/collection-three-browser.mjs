// Start the arena Vite server first (port 5174). Muted, headless.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROMIUM_EXECUTABLE=/path/to/chromium node tools/collection-three-browser.mjs
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../test/collection-three-20261109',import.meta.url).pathname;await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],watch=page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
const styles=[['dawn','lumen','stormcoil'],['afterglow','corona','lantern-warden'],['afterglow','corona','bastion-breaker'],['meridian','halo','petal-scabbard'],['firefly','firefly','hummingbird'],['longnight','longnight','void-lance']];
const page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);page.setDefaultTimeout(60000);
await page.goto('http://127.0.0.1:5174/?low');await page.click('#armory');
const counts=await page.$$eval('[data-art] span',s=>s.map(e=>e.textContent));
const spins={};
for(const [art,,id]of styles){
 await page.locator(`[data-art="${art}"]`).dispatchEvent('click');await page.locator(`[data-finish-id="${id}"]`).dispatchEvent('click');
 await page.waitForFunction(()=>document.querySelector('#armory-dialog')?.getAttribute('aria-busy')==='false');
 await page.waitForTimeout(400);await page.locator('#art-view-reset').dispatchEvent('click');await page.waitForTimeout(150);await page.click('#art-fx');await page.waitForTimeout(40);
 await page.screenshot({path:`${out}/${id}.png`});
}
await page.close();
// First-person: equip each new finish, fire a short burst, aim, and confirm the rotor turned.
const fps={};
for(const [,weapon,id]of styles){
 const p=await browser.newPage({viewport:{width:1280,height:800}});watch(p);p.setDefaultTimeout(120000);
 await p.addInitScript(([weapon,id])=>{localStorage.setItem('parhelion-loadout-v1',JSON.stringify({version:1,weapons:[weapon,weapon==='lumen'?'halo':'lumen','blade']}));localStorage.setItem('arena-lobby',JSON.stringify({skinIds:{[weapon]:id}}));},[weapon,id]);
 await p.goto('http://127.0.0.1:5174/?low&test&autostart');
 await p.waitForFunction(()=>window.arena?.scene?.viewmodel?.root.children.some(o=>o.userData.artState==='ready'));
 const read=()=>p.evaluate(()=>{let a=null,name='';window.arena.scene.viewmodel.root.traverse(o=>{if(o.userData.spin&&a===null){a=o.userData.spinAngle??0;}if(o.userData.structuralSkin)name=o.userData.structuralSkin;});return{a,name};});
 const before=await read();await p.mouse.down();await p.waitForTimeout(500);await p.mouse.up();await p.waitForTimeout(80);
 await p.screenshot({path:`${out}/fps-${id}.png`});const after=await read();
 fps[id]={model:after.name,rotorBefore:before.a,rotorAfter:after.a};await p.close();
}
await writeFile(out+'/verification.json',JSON.stringify({workshopCounts:counts,fps,errors},null,2));await browser.close();
console.log(JSON.stringify({counts,fps,errors},null,1));if(errors.length)process.exitCode=1;
