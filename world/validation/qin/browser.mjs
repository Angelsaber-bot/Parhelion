// Silent headless review of the Qin region: no audio device, no visible browser.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),chromium=pw.chromium??pw.default.chromium;
const output=resolve(process.env.WORLD_TEST_OUTPUT||'validation/qin/artifacts');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const O=[720,-720];
const shots=[
 {id:'overview',eye:[-330,190,260],target:[20,60,-40]},
 {id:'artisan-town',eye:[-140,48,150],target:[-190,23,95]},
 {id:'river-pass',eye:[-18,46,112],target:[-70,31,80]},
 {id:'palace',eye:[40,96,160],target:[40,66,0]},
 {id:'aqueduct',eye:[-130,62,-30],target:[-60,48,-10]},
 {id:'watch-tower-ridge',eye:[150,118,20],target:[80,84,-40]},
 {id:'quarry-portal',eye:[-126,40,-14],target:[-125,30,-56]},
 {id:'foundry',eye:[106,53,-70],target:[140,47,-104]},
 {id:'garrison-guard',eye:[27,37,-103],target:[-25,28,-140]},
 {id:'garrison-open',eye:[27,37,-103],target:[-25,28,-140],order:true},
 {id:'royal-city',eye:[43,21,-191],target:[57,12,-176]},
 {id:'palace-hall',eye:[40,77,34],target:[40,76,-2]},
 {id:'palace-gate',eye:[44,63,114],target:[40,65,84]},
 {id:'town-street',eye:[-168,27,134],target:[-186,24,106]},
 {id:'kiln-yard',eye:[-198,31,72],target:[-224,26,52]},
 {id:'garrison-pit',eye:[29,31.5,-121],target:[14,28.5,-134]},
 {id:'chariot',eye:[-13,30.5,-110],target:[-22,29,-121]},
 {id:'furnace',eye:[117,50.5,-93],target:[140,49,-84]},
 {id:'palace-portal',eye:[42,74,-20],target:[40,74,-42]},
];
const only=process.env.SHOTS?.split(','),results=[];
try{for(const shot of shots.filter(s=>!only||only.includes(s.id))){
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const eye=[shot.eye[0]+O[0],shot.eye[1],shot.eye[2]+O[1]],dx=shot.target[0]-shot.eye[0],dy=shot.target[1]-shot.eye[1],dz=shot.target[2]-shot.eye[2];
 const cam=[...eye,Math.atan2(-dx,-dz)*180/Math.PI,Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI];
 await page.addInitScript(()=>localStorage.setItem('parhelion-language-v1','zh'));
 await page.goto(`${process.env.WORLD_URL||'http://127.0.0.1:4177'}/?region=qin&q=${process.env.Q||'low'}&nograss&clean&cam=${cam.join(',')}`);
 await page.waitForFunction(()=>window.__world?.ready,null,{timeout:180000});
 if(shot.order)await page.evaluate(()=>{const w=window.__world;w.done.add('qin_army_order_b');w.qinArmyOrder.apply(w.done,true);});
 await page.waitForTimeout(3500);
 const info=await page.evaluate(()=>({phase:window.__world.qinArmyOrder.phase,regions:window.__world.layout.objectives.length,render:window.__world.renderer.info.render,qinMarkers:window.__world.layout.markers.filter(m=>m.id.startsWith('qin_')).length}));
 await page.screenshot({path:resolve(output,`${shot.id}.png`),timeout:180000});
 results.push({id:shot.id,info,errors});await page.close();
}}finally{await browser.close();await writeFile(resolve(output,'browser-results.json'),JSON.stringify(results,null,2));}
console.log(JSON.stringify(results.map(r=>({id:r.id,errors:r.errors,phase:r.info.phase,markers:r.info.qinMarkers,tris:r.info.render.triangles}))));
if(results.some(r=>r.errors.length))process.exit(1);
