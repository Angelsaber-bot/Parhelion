const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const identity=process.argv[2]||'saber',out=path.resolve(process.argv[3]||'/tmp/remake-preview'),mode=process.argv[4]||'keys';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:540}});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
await page.goto('http://127.0.0.1:4188/validation/characters/cinematic-preview.html?identity='+identity+'&capture=1');await page.waitForFunction(()=>window.__cinema?.ready,null,{timeout:90000});
const init=await page.evaluate(()=>({renderer:window.__cinema.renderer,totalRelease:window.__cinema.totalRelease,hits:window.__cinema.hits}));console.log(init);
const times=mode==='sequence'?Array.from({length:Math.ceil(((identity==='saber'?9.8:5.85)+init.totalRelease)*24)},(_,i)=>i/24):(process.env.CINEMA_TIMES||'0,0.5,1.5,3.5,5,6.5,7.5,8,8.5,9,10,11').split(',').map(Number);
const frames=[];for(let i=0;i<times.length;i++){const t=times[i],state=await page.evaluate(t=>window.__cinema.seek(t),t);await page.screenshot({path:path.join(out,`${identity}-${String(i).padStart(4,'0')}.png`)});frames.push({i,t,...state});if(i%24===0)console.log(identity,i,t,state.frame?.phase,state.drawCalls);if(state.done)break;}
await writeFile(path.join(out,identity+'-capture.json'),JSON.stringify({identity,init,errors,frames,limitations:['Actual WebGL rendering in Chromium SwiftShader software renderer; not a hardware GPU/FPS benchmark','Deterministic timeline sampling, not wall-clock realtime recording','Stage animation uses actual game scene and authored contact profile; isolated scene not full gameplay capture']},null,2));await browser.close();if(errors.length)process.exitCode=1;
