// Start the arena Vite server first. Optional PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE overrides.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../test/collection-two-20261103',import.meta.url).pathname;await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.setDefaultTimeout(30000);await page.goto('http://127.0.0.1:5174/?low');console.log('page loaded');await page.screenshot({path:out+'/lobby.png'});await page.click('#armory');console.log('armory open');
const styles=[['dawn','cloudline'],['afterglow','cinder-express'],['meridian','brass-horizon'],['firefly','mixtape'],['longnight','glacier-survey'],['refract','crescent-sabre'],['meteor','reef-regalia'],['faultline','cathedral-chime']];
for(const [art,id]of styles){console.log('select',id);await page.locator(`[data-art="${art}"]`).dispatchEvent('click');await page.locator(`[data-finish-id="${id}"]`).dispatchEvent('click');await page.waitForFunction(()=>document.querySelector('#armory-dialog')?.getAttribute('aria-busy')==='false',null,{timeout:20000});await page.waitForTimeout(350);await page.locator('#art-view-reset').dispatchEvent('click');await page.waitForTimeout(120);await page.click('#art-fx');await page.waitForTimeout(40);await page.screenshot({path:`${out}/${id}.png`});}
await page.click('#armory-close');
await page.goto('http://127.0.0.1:5174/?low&test&autostart');await page.waitForFunction(()=>window.arena?.scene?.combatEffects,null,{timeout:120000});
// Exercise every live sprite shader and shaped tracer through the actual renderer.
const result=await page.evaluate(async()=>{
 const {SIGNATURE_SKINS}=await import('/shared/signatureSkins.ts'),scene=window.arena.scene;
 const c=scene.camera,p=c.position,d=c.getWorldDirection(new (c.position.constructor)());
 const at=[p.x+d.x*3,p.y+d.y*3,p.z+d.z*3],from=[p.x+.3,p.y-.3,p.z];
 for(const s of SIGNATURE_SKINS){scene.skinTracer(from,at,s.id);scene.skinImpact(at,false,s.id);scene.muzzleFlash(from,.6,s.id);await new Promise(r=>requestAnimationFrame(r));}
 return {profiles:SIGNATURE_SKINS.length,inventory:scene.combatEffects.inventory};
});
await page.screenshot({path:`out/effects.png`.replace('out',out)});await writeFile(out+'/verification.json',JSON.stringify({result,errors},null,2));await browser.close();if(errors.length)throw Error(errors.join('\n'));
