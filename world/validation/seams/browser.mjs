// Silent headless review of the twelve region joins (world coordinates).
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),chromium=pw.chromium??pw.default.chromium;
const output=resolve(process.env.WORLD_TEST_OUTPUT||'validation/seams/artifacts');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const joins=[
 ['orleans-winter',-360,-720,'x'],['winter-qin',360,-720,'x'],['britain-valley',-360,0,'x'],['valley-blacksail',360,0,'x'],['southwest-kyoto',-360,720,'x'],['kyoto-egypt',360,720,'x'],
 ['orleans-britain',-720,-360,'z'],['winter-valley',0,-360,'z'],['qin-blacksail',720,-360,'z'],['britain-southwest',-720,360,'z'],['valley-kyoto',0,360,'z'],['blacksail-egypt',720,360,'z'],
];
const only=process.env.SHOTS?.split(','),results=[];
try{for(const [id,x,z,axis] of joins.filter(j=>!only||only.includes(j[0]))){
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // look along the join from 140 m off it, 70 m up, so both sides show
 const eye=axis==='x'?[x,90,z+170]:[x+170,90,z],target=[x,20,z],dx=target[0]-eye[0],dy=target[1]-eye[1],dz=target[2]-eye[2];
 const cam=[...eye,Math.atan2(-dx,-dz)*180/Math.PI,Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI];
 await page.addInitScript(()=>localStorage.setItem('parhelion-language-v1','zh'));
 await page.goto(`${process.env.WORLD_URL||'http://127.0.0.1:4177'}/?q=low&clean&cam=${cam.join(',')}`);
 await page.waitForFunction(()=>window.__world?.ready,null,{timeout:180000});await page.waitForTimeout(4000);
 await page.screenshot({path:resolve(output,`${id}.png`),timeout:180000});results.push({id,errors});await page.close();
}}finally{await browser.close();await writeFile(resolve(output,'browser-results.json'),JSON.stringify(results,null,2));}
console.log(JSON.stringify(results));
