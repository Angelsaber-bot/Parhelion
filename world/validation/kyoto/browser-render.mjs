// Screenshots from the actual runtime, not proxy rendering. Same camera manifest as Blender QA.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output=resolve(process.argv[2]); await mkdir(output,{recursive:true});
const cameras=JSON.parse(await readFile(new URL('./cameras.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
for(const shot of cameras){
 if(process.argv[3] && process.argv[3]!==shot.name)continue;
 const page=await browser.newPage({viewport:{width:1200,height:800}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const [x,y,z]=shot.eye;const dx=shot.target[0]-x,dy=shot.target[1]-y,dz=shot.target[2]-z;
 const yaw=Math.atan2(-dx,-dz)*180/Math.PI,pitch=Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI;
 const url=`${process.env.WORLD_URL||'http://127.0.0.1:4177'}/?region=kyoto&cam=${x},${y},${z+720},${yaw},${pitch}&clean`;
 try{
  await page.goto(url);await page.waitForFunction(()=>window.__world?.ready,null,{timeout:120000});
  await page.waitForTimeout(3500);
  const info=await page.evaluate(()=>({render:window.__world.renderer.info.render,memory:window.__world.renderer.info.memory,camera:window.__world.camera.position.toArray(),programs:window.__world.renderer.info.programs.map(p=>({name:p.name,diagnostics:p.diagnostics}))}));
  await page.screenshot({path:resolve(output,shot.name+'.png')});results.push({shot:shot.name,url,info,errors});
 }catch(e){results.push({shot:shot.name,url,error:String(e),errors});}
 await page.close();
}
await browser.close();await writeFile(resolve(output,'browser-report.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({shot,error,errors,info})=>({shot,error,errors,render:info?.render})),null,2));
if(results.some(r=>r.error||r.errors.some(e=>/shader|WebGL|THREE/.test(e))))process.exitCode=1;
