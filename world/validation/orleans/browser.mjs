import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve('validation/orleans/artifacts');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--mute-audio',...(process.env.WORLD_GPU_NATIVE==='1'?['--use-angle=metal']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])]});
const layout=JSON.parse(await readFile(new URL('../../public/assets/world_orleans.layout.json',import.meta.url),'utf8'));
const warehouse=layout.development.houses.find(h=>h.family==='harbour-warehouse');
const [hx,hy,hz]=warehouse.position,ha=warehouse.rotation,entry=warehouse.depth/2-1;
const street=layout.development.streetLanes[0],streetEye=street[12],streetTarget=street[24];
const allShots=[
  {id:'watercourse',eye:[-158,4.2,-61.7],target:[-142,4.1,-73.2]},
  {id:'overview',eye:[190,145,190],target:[-20,26,-65]},
  {id:'working-harbour',eye:[-232,31,48],target:[-175,16,-12]},
  {id:'cloister',eye:[155,55,-125],target:[111,35,-194]},
  {id:'belfry-gallery',eye:[-52,47,-32],target:[-12,32,-62]},
  {id:'wall-works',eye:[240,65,80],target:[175,20,0]},
  {id:'warehouse-interior',eye:[hx+Math.sin(ha)*entry,hy+1.8,hz+Math.cos(ha)*entry],target:[hx,hy+1.5,hz]},
  {id:'market-street',eye:[streetEye[0],streetEye[1]+1.8,streetEye[2]],target:[streetTarget[0],streetTarget[1]+2,streetTarget[2]]},
  {id:'cathedral',eye:[53,37,-96],target:[35,50,-147]},
  {id:'churchyard',eye:[-124,44,-170],target:[-70,31,-213]},
  // Second ring (2026-11-11)
  {id:'outskirts-overview',eye:[260,170,330],target:[-20,10,60]},
  {id:'tourelles',eye:[30,24,318],target:[-8,20,282]},
  {id:'long-bridge',eye:[205,34,325],target:[168,16,297]},
  {id:'bridge-mill',eye:[-205,22,160],target:[-172,9,128]},
  {id:'mill-trestle',eye:[-225,26,70],target:[-180,10,125]},
  {id:'vineyard',eye:[-95,30,280],target:[-132,17,312]},
  {id:'scorched-grange',eye:[128,30,335],target:[158,16,300]},
  {id:'windmill',eye:[214,30,-178],target:[238,34,-204]},
  {id:'siege-bastille',eye:[250,34,40],target:[292,14,-6]},
  {id:'west-levee',eye:[-300,40,-120],target:[-255,8,10]},
];
const shots=process.env.WORLD_VIEWS?allShots.filter(s=>process.env.WORLD_VIEWS.split(',').includes(s.id)):allShots;
const records=[];
try{
 for(const shot of shots){
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))errors.push(m.text());});
  await page.addInitScript(()=>localStorage.setItem('parhelion-language-v1','zh'));
  const d=shot.target.map((n,i)=>n-shot.eye[i]),cam=[shot.eye[0]-720,shot.eye[1],shot.eye[2]-1440,Math.atan2(-d[0],-d[2])*180/Math.PI,Math.atan2(d[1],Math.hypot(d[0],d[2]))*180/Math.PI];
  await page.goto(`${process.env.WORLD_URL||'http://127.0.0.1:4177'}/?region=orleans&q=${process.env.WORLD_QUALITY||'med'}&clean&cam=${cam.join(',')}`);
  await page.waitForFunction(()=>window.__world?.ready,null,{timeout:120000});
  await page.evaluate(()=>window.__world.regionVisuals.ensure('orleans'));
  await page.waitForTimeout(2400);
  const info=await page.evaluate(()=>({machines:{wheel:window.__world.orleansOutskirts.wheel.rotation.x>0,sails:window.__world.orleansOutskirts.sails.rotation.z>0},emitters:window.__world.orleansAtmosphere.systems.length,residents:window.__world.settlementNpcs?.group.children.filter(p=>p.userData.region==='orleans').length,regions:window.__world.layout.objectives.length,stream:window.__world.regionVisuals.diagnostics,render:window.__world.renderer.info.render}));
  await page.screenshot({path:resolve(output,`${shot.id}.png`),timeout:120000});
  if(shot.id==='overview'){
   await page.evaluate(()=>{document.body.classList.remove('clean');document.getElementById('start').style.visibility='hidden';document.getElementById('settings-open').style.visibility='hidden';document.getElementById('bigmap').classList.add('open');});
   await page.waitForTimeout(500);await page.locator('#bigmap canvas').screenshot({path:resolve(output,'atlas.png')});
  }
  records.push({view:shot.id,info,errors});await page.close();
 }
}finally{await browser.close();
 const prior=process.env.WORLD_VIEWS?JSON.parse(await readFile(resolve(output,'browser-results.json'),'utf8').catch(()=> '[]')):[];
 await writeFile(resolve(output,'browser-results.json'),JSON.stringify([...prior.filter(p=>!records.some(r=>r.view===p.view)),...records],null,2));
}
if(records.length!==shots.length||records.some(r=>r.errors.length||r.info.residents!==13||!r.info.machines.wheel||!r.info.machines.sails||!r.info.stream.resident.includes('orleans')))throw new Error(JSON.stringify(records));
console.log(JSON.stringify(records,null,2));
