import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve('validation/orleans/artifacts');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let result;
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('parhelion-language-v1','zh'));
 await page.goto(`${process.env.WORLD_URL||'http://127.0.0.1:4178'}/?region=orleans&q=low&nograss`);
 await page.waitForFunction(()=>window.__world?.ready,null,{timeout:120000});await page.evaluate(()=>window.__world.regionVisuals.ensure('orleans'));
 await page.bringToFront();await page.locator('#world-drag-controls').evaluate(el=>el.hidden=false);await page.locator('#world-drag-controls').click();
 const before=await page.evaluate(()=>{
   const w=window.__world,p=w.settlementNpcs.getPosition('orleans_market_vendor');w.player.flying=false;w.player.teleport(p[0]+1.3,p[1]+.5,p[2]+1.3,Math.PI*.25);
   for(let i=0;i<120;i++)w.player.step(1/120,{x:0,z:0,jump:false,sprint:false});return [...w.done].sort();
 });
 await page.waitForTimeout(700);await page.keyboard.press('f');await page.waitForFunction(()=>!document.getElementById('world-dialogue').hidden,null,{timeout:10000});
 await page.waitForTimeout(400);
 const state=await page.evaluate(()=>({title:document.getElementById('world-dialogue-title').textContent,text:document.getElementById('world-dialogue-text').textContent,done:[...window.__world.done].sort(),grounded:window.__world.player.onGround}));
 await page.screenshot({path:resolve(output,'resident-conversation.png')});
 result={before,...state,errors};if(!state.text.includes('守城旗')||!state.title.includes('露西')||JSON.stringify(before)!==JSON.stringify(state.done)||errors.length||!state.grounded)throw new Error(JSON.stringify(result));
 await page.keyboard.press('f');await page.waitForFunction(()=>document.getElementById('world-dialogue').hidden);
 const landmarks=await page.evaluate(()=>window.__world.layout.markers.filter(m=>m.type==='discovery'&&m.id.startsWith('orleans_')).map(m=>({id:m.id,p:m.p})));
 for(const m of landmarks){
   await page.evaluate(p=>{const w=window.__world;w.player.flying=false;w.player.teleport(p[0],p[1]+.5,p[2]);},m.p);
   await page.waitForFunction(id=>window.__world.found.has(id),m.id,{timeout:10000});
 }
 const discovered=await page.evaluate(()=>({found:[...window.__world.found].filter(id=>id.startsWith('orleans_')).sort(),done:[...window.__world.done].sort()}));
 await page.reload();await page.waitForFunction(()=>window.__world?.ready,null,{timeout:120000});
 const restored=await page.evaluate(()=>({found:[...window.__world.found].filter(id=>id.startsWith('orleans_')).sort(),done:[...window.__world.done].sort()}));
 result={...result,discovered,restored};
 if(landmarks.length!==9||discovered.found.length!==9||JSON.stringify(discovered)!==JSON.stringify(restored)||JSON.stringify(before)!==JSON.stringify(restored.done)||errors.length)throw new Error(JSON.stringify(result));
 console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await writeFile(resolve(output,'dialogue-results.json'),JSON.stringify(result??{failed:true},null,2));}
