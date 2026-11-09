import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve(process.env.WORLD_TEST_OUTPUT||'validation/expansion/artifacts');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const shots=[{id:'orleans',offset:[-720,-720],eye:[240,210,300],target:[0,20,-80]},{id:'egypt',offset:[720,720],eye:[260,180,280],target:[0,25,-60]},{id:'qin',offset:[720,-720],eye:[260,320,300],target:[0,25,0]}];
const results=[];
try{for(const shot of shots){const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const eye=[shot.eye[0]+shot.offset[0],shot.eye[1],shot.eye[2]+shot.offset[1]],dx=shot.target[0]-shot.eye[0],dy=shot.target[1]-shot.eye[1],dz=shot.target[2]-shot.eye[2];
const cam=[...eye,Math.atan2(-dx,-dz)*180/Math.PI,Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI];
await page.addInitScript(()=>localStorage.setItem('parhelion-language-v1','zh'));
await page.goto(`${process.env.WORLD_URL||'http://127.0.0.1:4177'}/?region=${shot.id}&q=low&nograss&clean&cam=${cam.join(',')}`);
await page.waitForFunction(()=>window.__world?.ready,null,{timeout:120000});
await page.waitForTimeout(2000);
const info=await page.evaluate(()=>({regions:window.__world.layout.objectives.map(o=>o.region),spawn:window.__world.player.pos.toArray(),stream:window.__world.regionVisuals.diagnostics,render:window.__world.renderer.info.render,objective:document.getElementById('objective').textContent}));
await page.screenshot({path:resolve(output,`${shot.id}.png`)});
if(shot.id==='orleans'){await page.evaluate(()=>{document.body.classList.remove('clean');document.getElementById('start').style.visibility='hidden';document.getElementById('settings-open').style.visibility='hidden';document.getElementById('bigmap').classList.add('open');});await page.waitForTimeout(500);await page.locator('#bigmap canvas').screenshot({path:resolve(output,'atlas.png')});}
results.push({id:shot.id,info,errors});await page.close();}}
finally{await browser.close();await writeFile(resolve(output,'browser-results.json'),JSON.stringify(results,null,2));}
if(results.some(r=>r.errors.length||r.info.regions.length!==8))throw Error(JSON.stringify(results));console.log(JSON.stringify(results,null,2));
