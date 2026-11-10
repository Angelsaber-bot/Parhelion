// Silent headless review of the Egypt region: no audio device, no visible browser.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),chromium=pw.chromium??pw.default.chromium;
const output=resolve(process.env.WORLD_TEST_OUTPUT||'validation/egypt/artifacts');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const O=[0,-1440]; // the region stands turned half a circle: authored (x,z) is world O−(x,z)
const shots=[
 {id:'overview',eye:[-300,150,260],target:[40,30,-60]},
 {id:'oasis-town',eye:[-125,32,150],target:[-170,15,108]},
 {id:'river-quay',eye:[-4,20,186],target:[-34,10,150]},
 {id:'sphinx-avenue',eye:[-10,22,128],target:[50,22,64]},
 {id:'colossi',eye:[80,30,78],target:[80,34,-6]},
 {id:'temple-pylon',eye:[80,36,-40],target:[80,40,-90]},
 {id:'temple-court',eye:[102,38,-98],target:[64,31,-130]},
 {id:'temple-lit',eye:[102,38,-98],target:[64,31,-130],solve:true},
 {id:'temple-hall',eye:[74,33,-128],target:[80,32,-170],solve:true},
 {id:'roof-shrine',eye:[38,46,-128],target:[56,41,-150]},
 {id:'canyon-tombs',eye:[-100,24,-92],target:[-62,24,-126]},
 {id:'pyramid',eye:[110,60,-120],target:[202,50,-212]},
 {id:'solar-trial',eye:[130,34,90],target:[165,18,125]},
 {id:'barque-tomb',eye:[70,20,-238],target:[80,15,-256]},
];
const only=process.env.SHOTS?.split(','),results=[];
try{for(const shot of shots.filter(s=>!only||only.includes(s.id))){
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const eye=[O[0]-shot.eye[0],shot.eye[1],O[1]-shot.eye[2]],dx=-(shot.target[0]-shot.eye[0]),dy=shot.target[1]-shot.eye[1],dz=-(shot.target[2]-shot.eye[2]);
 const cam=[...eye,Math.atan2(-dx,-dz)*180/Math.PI,Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI];
 await page.addInitScript(()=>localStorage.setItem('parhelion-language-v1','zh'));
 await page.goto(`${process.env.WORLD_URL||'http://127.0.0.1:4177'}/?region=egypt&q=${process.env.Q||'low'}&nograss&clean&cam=${cam.join(',')}`);
 await page.waitForFunction(()=>window.__world?.ready,null,{timeout:180000});
 if(shot.solve)await page.evaluate(()=>{const w=window.__world;[['egypt_mirror_court',3],['egypt_mirror_hall',0],['egypt_mirror_axis',2]].forEach(([id,k])=>{for(let i=0;i<4;i++)w.done.delete(`${id}_${i}`);w.done.add(`${id}_${k}`);});w.done.add('egypt_sun_sanctuary_lit');w.egyptMirrors.apply(w.done);});
 await page.waitForTimeout(3500);
 const info=await page.evaluate(()=>({lit:window.__world.egyptMirrors.lit,regions:window.__world.layout.objectives.length,render:window.__world.renderer.info.render,egyptMarkers:window.__world.layout.markers.filter(m=>m.id.startsWith('egypt_')).length}));
 await page.screenshot({path:resolve(output,`${shot.id}.png`),timeout:180000});
 results.push({id:shot.id,info,errors});await page.close();
}}finally{await browser.close();await writeFile(resolve(output,'browser-results.json'),JSON.stringify(results,null,2));}
console.log(JSON.stringify(results.map(r=>({id:r.id,errors:r.errors,lit:r.info.lit,markers:r.info.egyptMarkers,tris:r.info.render.triangles}))));
if(results.some(r=>r.errors.length))process.exit(1);
