import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve('validation/home/artifacts');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:process.env.WORLD_GPU_NATIVE==='1'?['--mute-audio','--use-angle=metal']:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const shots=[
 {id:'overview',eye:[-305,120,240],target:[-20,10,30]},
 {id:'square',eye:[-192,25,65],target:[-130,19,40]},
 {id:'your-home',eye:[-145,29,99],target:[-175,20,135]},
 {id:'living-room',eye:[-175,18.7,126],target:[-168,17.5,133]},
 {id:'upstairs',eye:[-176,22.6,143],target:[-169,21.3,137]},
 {id:'homeward-house',eye:[-86,39,22],target:[-35,19,-40]},
 {id:'shared-dining',eye:[-35,18.8,-17],target:[-23,17.5,-22]},
 {id:'saber-room',eye:[-43,18.1,-33],target:[-49,17.2,-37]},
 {id:'harbour',eye:[200,28,150],target:[280,7,110]},
 {id:'garden-restored',eye:[-97,21,127],target:[-109,17,115],flags:['home_garden_watered']},
 {id:'boat-repaired',eye:[285,17,151],target:[265,7,143],flags:['home_boat_hauled']},
 {id:'lighthouse-restored',eye:[232,17,105],target:[255,15,86],flags:['home_lighthouse_aligned']},
];
let results=[];try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('parhelion-language-v1','zh');localStorage.setItem('parhelion.world.progress.v2',JSON.stringify({version:2,done:['saber_contract','sun_core','home_saber_invited'],found:[]}));localStorage.setItem('parhelion.world.contract.v1',JSON.stringify({version:1,servant:'saber',summoned:false}));});
 await page.goto(`${process.env.WORLD_URL||'http://127.0.0.1:4177'}/?region=home&q=${process.env.Q||'low'}&nograss&clean&cam=420,120,240,0,0`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__world?.ready,null,{timeout:120000});
 await page.evaluate(()=>window.__world.regionVisuals.ensure('home'));
 for(const shot of shots.filter(s=>!process.env.SHOTS||process.env.SHOTS.split(',').includes(s.id))){
  console.log('Reviewing',shot.id);
  await page.evaluate(shot=>{const w=window.__world;for(const flag of['home_garden_watered','home_boat_hauled','home_lighthouse_aligned'])w.done.delete(flag);for(const flag of shot.flags??[])w.done.add(flag);w.homeTown.apply();const dx=shot.target[0]-shot.eye[0],dy=shot.target[1]-shot.eye[1],dz=shot.target[2]-shot.eye[2];w.player.flying=true;w.player.teleport(720+shot.eye[0],shot.eye[1]-1.62,shot.eye[2],Math.atan2(-dx,-dz));w.player.pitch=Math.atan2(dy,Math.hypot(dx,dz));},shot);
  await page.waitForTimeout(1200);await page.screenshot({path:resolve(output,`${shot.id}.png`),timeout:120000});
  results.push({id:shot.id,errors:[...errors],info:await page.evaluate(()=>({calls:window.__world.renderer.info.render.calls,triangles:window.__world.renderer.info.render.triangles,saberVisible:window.__world.servant.root.visible}))});
 }
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();await writeFile(resolve(output,'browser-results.json'),JSON.stringify(results,null,2));}
console.log(JSON.stringify(results));
