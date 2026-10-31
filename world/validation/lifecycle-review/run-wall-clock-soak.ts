/** Host-paced actual-main lifecycle soak. No GPU, accelerated time, or human-play claim. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {bootWorldWithoutGpu} from '../world-dom-boot.fixture';
const require=createRequire(import.meta.url),{implForWrapper}=require('jsdom/lib/generated/idl/utils.js');
const [worldRoot,inputReport,output,until='2026-10-31T12:15:00Z']=process.argv.slice(2);
const deadline=Date.parse(until);assert.ok(Number.isFinite(deadline)&&deadline>Date.now());
const prior=JSON.parse(readFileSync(inputReport,'utf8'));assert.equal(prior.error,null);assert.equal(prior.stage.ending,'seal');
const key='parhelion.world.progress.v2',original=JSON.parse(prior.saved),source=execFileSync('git',['rev-parse','HEAD'],{cwd:worldRoot,encoding:'utf8'}).trim();
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
let storage:Record<string,string>={[key]:prior.saved},frames=0,cycles=0,boots=0,error:unknown,plateau:unknown;
const started=new Date().toISOString(),hostStart=performance.now(),rows:unknown[]=[],reloadHashes:string[]=[];
function census(w:any,d:Document,win:any){
 const geometry=new Set(),material=new Set(),texture=new Set();let nodes=0,listeners=0;
 w.scene.traverse((o:any)=>{nodes++;if(o.isMesh)geometry.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])material.add(m);});
 for(const m of material)for(const v of Object.values(m as object))if((v as any)?.isTexture)texture.add(v);
 for(const o of [win,d,...d.querySelectorAll('*')])for(const entries of Object.values(implForWrapper(o)?._eventListeners??{}))listeners+=(entries as unknown[]).length;
 const p=w.anim.terrainSupport.patch,c=w.combat.contactEffects.diagnostics;
 assert.equal(p.data.byteLength,53248);assert.ok(p.count<=512&&p.snapshot.length<=256);assert.equal(c.active,0);assert.equal(c.slots,3);assert.equal(c.bytes,55296);
 return{nodes,geometries:geometry.size,materials:material.size,textures:texture.size,listeners,domNodes:d.querySelectorAll('*').length,footBytes:p.data.byteLength,cueSlots:c.slots,cueBytes:c.bytes};
}
const write=()=>writeFileSync(output,JSON.stringify({scope:'Exact earned save, normal spawn, host-paced 30Hz requested frames; actual elapsed clock forwarded, not accelerated. Real JavaScript delayed callbacks, ordinary UI pause/settings/resume and five-minute exact-storage reloads. NON-GPU synthetic operator, not human play or device FPS.',source,worldRoot,inputReport,inputSaveSha256:sha(prior.saved),started,observedAt:new Date().toISOString(),requestedUntil:until,elapsedWallSeconds:(performance.now()-hostStart)/1000,frames,cycles,boots,reloadHashes,rows,error:error?String(error):null},null,2));
try{
 while(Date.now()<deadline){
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:worldRoot,encoding:'utf8'}).trim(),source);
  const h=await bootWorldWithoutGpu({worldRoot,deterministic:true,initialStorage:storage});boots++;
  const w=h.world,d=h.window.document,win=h.window,bootStart=performance.now();let phase=-1,minute=0,pausedPosition:number[]|null=null,pausedHp=0;
  const click=(selector:string)=>{const e=d.querySelector<HTMLElement>(selector);assert.ok(e,selector);e.click();};
  const start=async()=>{click('#start');await Promise.resolve();assert.equal(d.pointerLockElement,d.getElementById('view'));};
  try{
   assert.deepEqual([...w.done].sort(),[...original.done].sort());assert.deepEqual([...w.found].sort(),[...original.found].sort());
   await h.settleAssets();await start();
   while(Date.now()<deadline&&performance.now()-bootStart<300000){
    const elapsed=performance.now()-bootStart,nextPhase=Math.floor(elapsed/15000)%4;
    if(nextPhase!==phase){
     phase=nextPhase;
     if(phase===0){await start();cycles++;}
     if(phase===1){d.exitPointerLock();pausedPosition=w.player.pos.toArray();pausedHp=w.combat.state.hp;}
     if(phase===2){click('#settings-open');assert.equal(w.settingsPanel.open,true);}
     if(phase===3){click('#world-settings [data-close]');assert.equal(w.settingsPanel.open,false);await start();}
    }
    h.frame(performance.now()-bootStart);frames++;
    if(phase===1||phase===2){assert.deepEqual(w.player.pos.toArray(),pausedPosition);assert.equal(w.combat.state.hp,pausedHp);}
    assert.equal(w.combat.defeated,false);assert.equal(w.combat.storyEncounter,null);assert.equal(w.narrative.open,false);assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
    if(elapsed>=(minute+1)*60000){
     minute++;const counts=census(w,d,win);if(plateau)assert.deepEqual(counts,plateau,'warm retained resource/listener plateau');else plateau=counts;
     assert.deepEqual([...w.done].sort(),[...original.done].sort());assert.deepEqual([...w.found].sort(),[...original.found].sort());
     const row={at:new Date().toISOString(),boot:boots,minute,elapsedWallSeconds:(performance.now()-hostStart)/1000,frames,hp:w.combat.state.hp,energy:w.actions.skills.energy,counts};rows.push(row);appendFileSync(output+'.jsonl',JSON.stringify(row)+'\n');write();
    }
    await new Promise(r=>setTimeout(r,Math.max(1,1000/30-(performance.now()-bootStart-elapsed))));
   }
   storage={};for(let i=0;i<win.localStorage.length;i++){const k=win.localStorage.key(i)!;storage[k]=win.localStorage.getItem(k)!;}
   const saved=JSON.parse(storage[key]);assert.deepEqual([...saved.done].sort(),[...original.done].sort());assert.deepEqual([...saved.found].sort(),[...original.found].sort());reloadHashes.push(sha(storage[key]));
  }finally{await h.close();}
 }
}catch(e){error=e;console.error(e);process.exitCode=1;}finally{write();}
console.log(JSON.stringify({source,frames,cycles,boots,elapsedWallSeconds:(performance.now()-hostStart)/1000,error:error?String(error):null}));
