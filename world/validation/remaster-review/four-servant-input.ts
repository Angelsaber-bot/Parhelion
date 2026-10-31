/** CPU synthetic operator: explicit old-unlocked-save fixture, normal spawn, real inputs.
 * Known route/target coordinates and bounded aim are operator knowledge, not human play evidence.
 * No gameplay state grants; observation wrappers forward original damage/event callbacks unchanged. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {sourceEvidence} from './source-evidence';
import {nativeStageProjection} from './native-stage-projection';
import {bootWorldWithoutGpu} from '../world-dom-boot.fixture';
const [worldRoot,inputReport,output,identity='saber']=process.argv.slice(2),saved=JSON.parse(readFileSync(inputReport,'utf8')).saved;
assert.ok(['saber','blackbeard','napoleon','musashi'].includes(identity));
const sourceCommit=execFileSync('git',['-C',worldRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim();const sourceStatus=execFileSync('git',['-C',worldRoot,'status','--short'],{encoding:'utf8'});
const sourceDiff=execFileSync('git',['-C',worldRoot,'diff','--binary'],{encoding:'utf8'});const sourceDiffSha256=createHash('sha256').update(sourceDiff).digest('hex');
assert.equal(typeof saved,'string');const parsed=JSON.parse(saved),savedHash=createHash('sha256').update(saved).digest('hex');
assert.ok(parsed.done.includes('summon_circle'));
// Explicit synthetic old-unlocked-save fixture, NOT a four-person recruitment journey.
for(const flag of ['saber_contract','blackbeard_contract','napoleon_contract','musashi_contract'])if(!parsed.done.includes(flag))parsed.done.push(flag);
const legacyRaw=JSON.stringify(parsed),legacyFixtureSha256=createHash('sha256').update(legacyRaw).digest('hex');
const sourceBefore=sourceEvidence(worldRoot);
const h=await bootWorldWithoutGpu({worldRoot,deterministic:true,initialStorage:{'parhelion.world.progress.v2':legacyRaw,'parhelion-world-reduced-effects':process.env.QA_REDUCED==='1'?'1':'0'}}),w=h.world,win=h.window,d=win.document;
let now=0,error:unknown,castResult:any;const stageSamples:any[]=[];const projectedPhases=new Set<string>();
const actorRoot=()=>identity==='saber'?w.servant.root:w.scene.children.find((o:any)=>o.name===`CharacterKit:${identity==='napoleon'?'napoleonMounted':identity}`);
const pose=(root:any)=>{assert.ok(root);let bones=0,meshes=0,skinned=0;const rows:any[]=[],meshNames:string[]=[];root.traverse((o:any)=>{if(o.isBone){bones++;rows.push([o.name,...o.position.toArray(),...o.quaternion.toArray()]);}if(o.isMesh){meshNames.push(o.name);meshes++;if(o.isSkinnedMesh)skinned++;}});return{bones,meshes,meshNames,skinned,hash:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};};const events:any[]=[],hits:any[]=[],skillEvents:any[]=[];
const step=()=>{h.frame(now+=1000/60);assert.equal(w.combat.defeated,false,'Defeat is a real test stop');};
const key=(code:string,down:boolean)=>d.body.dispatchEvent(new win.KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true,cancelable:true}));
const tap=(code:string)=>{key(code,true);key(code,false);};const action=(name:string)=>tap(w.settings.bindingsFor(name)[0]);
const fire=(down:boolean)=>win.dispatchEvent(new win.MouseEvent(down?'mousedown':'mouseup',{button:0,bubbles:true,cancelable:true}));
function note(kind:string,data:any={}){const e={kind,seconds:now/1000,p:w.player.pos.toArray(),hp:w.combat.state.hp,energy:w.actions.skills.energy,...data};events.push(e);console.log(JSON.stringify(e));}
function orient(x:number,z:number,y?:number){const source=y===undefined?w.player.pos:w.camera.position,dx=x-source.x,dz=z-source.z,dy=(y??source.y)-source.y,yaw=Math.atan2(-dx,-dz),pitch=y===undefined?0:Math.atan2(dy,Math.hypot(dx,dz)),delta=Math.atan2(Math.sin(w.player.yaw-yaw),Math.cos(w.player.yaw-yaw));const s=.0022*w.settings.value.sensitivity*(1+(w.settings.value.adsSensitivity-1)*w.aim.value),e=new win.MouseEvent('mousemove',{bubbles:true});Object.defineProperties(e,{movementX:{value:Math.max(-.07,Math.min(.07,delta))/s},movementY:{value:Math.max(-.05,Math.min(.05,w.player.pitch-pitch))/s}});d.dispatchEvent(e);return Math.abs(delta);}
function settle(n=60){for(let i=0;i<n;i++)step();}
function walk(x:number,z:number,arrival=.7){let last=now,previous=w.player.pos.clone();try{for(let i=0;i<60*120;i++){key('KeyW',orient(x,z)<.7);step();if(Math.hypot(x-w.player.pos.x,z-w.player.pos.z)<arrival){note('walk',{target:[x,z]});return;}if(now-last>5000){assert.ok(w.player.pos.distanceTo(previous)>.25,`Blocked route ${x},${z} from ${w.player.pos.toArray()}`);previous.copy(w.player.pos);last=now;}}throw Error(`Route timeout ${x},${z}`);}finally{key('KeyW',false);}}
function closeText(){for(let i=0;i<50&&w.narrative.open;i++){assert.equal(w.narrative.choosing,false);tap('KeyF');}assert.equal(w.narrative.open,false);}
const record=w.actions.recordDamage.bind(w.actions);w.actions.recordDamage=(hit:any)=>{const before=w.actions.skills.energy;record(hit);hits.push({seconds:now/1000,...hit,energyBefore:before,energyAfter:w.actions.skills.energy});};
const originalEvent=w.actions.options.skillEvent;w.actions.options.skillEvent=(event:any)=>{skillEvents.push({seconds:now/1000,...event});originalEvent?.(event);};
async function castAt(target:any){
 fire(false);key('KeyD',false);key('KeyW',false);
 if(!w.contract.companionSummoned)action('summon');await h.settleAssets();
 for(let i=0;i<360;i++){orient(target.p.x,target.p.z,target.p.y+1);if(identity==='musashi')key('KeyW',Math.hypot(target.p.x-w.player.pos.x,target.p.z-w.player.pos.z)>5);step();const close=identity!=='musashi'||Math.hypot(target.p.x-actorRoot().position.x,target.p.z-actorRoot().position.z)<6.7;if(w.player.onGround&&actorRoot()?.visible&&actorRoot().position.distanceTo(w.player.pos)<18&&close&&i>30)break;}key('KeyW',false);
 assert.equal(w.contract.selected,identity);assert.ok(w.contract.companionSummoned);const native=pose(actorRoot());assert.ok(native.bones>5&&native.skinned>0,'positive native actor, not unloaded/proxy state');assert.equal(w.actions.skills.energy,100);if(process.env.QA_EXPECT_CAPTAIN_V2==='1'){assert.ok(native.meshNames.some(n=>/CaptainCavalry[ _]remaster[ _]tailoring/.test(n)),'new physical remaster garment loaded');if(identity==='napoleon')assert.ok(native.meshNames.some(n=>/White[ _]horse[ _]cavalry[ _]breast[ _]crest/.test(n)),'new horse crest loaded');}
 const hpBefore=target.hp,energyBefore=w.actions.skills.energy,playerBefore=w.player.pos.clone(),cameraBefore=w.camera.position.clone(),yawBefore=w.player.yaw,hitStart=hits.length,eventStart=skillEvents.length;
 action('ultimate');note('ultimate-input',{target:target.id,hpBefore,accepted:w.ultimateDirector.active,toast:d.getElementById('toast')?.textContent});
 assert.ok(w.ultimateDirector.active,'Normal X admits valid paid selected-servant cast');assert.equal(w.actions.skills.energy,0);
 const phases:string[]=[];for(let i=0;i<1200&&w.ultimateDirector.active;i++){const phase=w.ultimateDirector.frame?.phase;if(phase&&!phases.includes(phase))phases.push(phase);if(i%15===0){const clone=w.ultimateStage.clone;assert.ok(clone&&clone!==actorRoot(),'private real stage clone');const frame=w.ultimateDirector.frame;let projection; if(process.env.QA_NATIVE_PROJECTION==='1'&&(phase==='charge'||phase==='release')&&frame.progress>=(phase==='charge'?.45:.1)&&!projectedPhases.has(phase)){projectedPhases.add(phase);projection=nativeStageProjection(w.ultimateStage);}stageSamples.push({seconds:now/1000,phase,projection,identity:w.ultimateDirector.frame.identity,...pose(clone),resources:w.ultimateStage.resourceCounts,camera:w.ultimateStage.camera.position.toArray()});}step();}
 assert.equal(w.ultimateDirector.active,false);assert.equal(w.actions.skills.casting,false);assert.equal(w.ultimateStage.isActive,false);
 const castHits=hits.slice(hitStart).filter((hit:any)=>hit.source==='ultimate');assert.ok(castHits.some((hit:any)=>hit.id===target.id&&hit.damage>0),'Actual hostile HP damage from native ultimate contact');
 assert.equal(skillEvents.slice(eventStart).filter((e:any)=>e.type==='cast'&&e.slot==='ultimate').length,1);assert.equal(skillEvents.slice(eventStart).filter((e:any)=>e.type==='strike'&&e.slot==='ultimate').length,identity==='saber'||identity==='napoleon'?1:3);assert.ok(stageSamples.every(s=>s.identity===identity));assert.ok(new Set(stageSamples.map(s=>s.hash)).size>3,'native stage pose visibly changes, not a no-op');
 settle(2);assert.ok(d.pointerLockElement);assert.ok(w.actions.actionContext.enabled);assert.ok(w.camera.position.distanceTo(w.player.pos)<10,'World camera restored near unchanged player');
 const restored=w.player.pos.clone(),restoredCamera=w.camera.position.clone();assert.ok(restored.distanceTo(playerBefore)<1e-9,'No cinematic player relocation beyond floating-point roundoff');assert.ok(restoredCamera.distanceTo(cameraBefore)<1e-8,'Exact world camera restoration before further input');const oldYaw=w.player.yaw;orient(w.player.pos.x+4,w.player.pos.z+4);step();assert.notEqual(w.player.yaw,oldYaw,'Normal mouse look restored');key('KeyS',true);settle(20);key('KeyS',false);assert.ok(w.player.pos.distanceTo(restored)>.1,'Normal movement restored');
 castResult={target:target.id,hpBefore,hpAfter:target.hp,energyBefore,energyAfter:w.actions.skills.energy,castHits,events:skillEvents.slice(eventStart),phases,playerBefore:playerBefore.toArray(),cameraBefore:cameraBefore.toArray(),yawBefore,restoredPlayer:restored.toArray(),restoredCamera:restoredCamera.toArray(),mouseLookRestored:w.player.yaw!==oldYaw,finalPlayer:w.player.pos.toArray(),finalCamera:w.camera.position.toArray(),controlsEnabled:w.actions.actionContext.enabled};note('ultimate-completed',castResult);
}
async function fight(id:string){const target=w.combat.state.enemies.find((e:any)=>e.id===id);assert.ok(target,id);if(target.hp<=0)return;note('approach-enemy',{id,home:{...target.home}});
 // Walk to the live actor, stopping at ordinary engagement range; no actor placement.
 let last=now,previous=w.player.pos.clone();try{for(let i=0;i<60*60;i++){const distance=Math.hypot(target.p.x-w.player.pos.x,target.p.z-w.player.pos.z);if(distance<13)break;key('KeyW',orient(target.p.x,target.p.z)<.7);step();if(now-last>5000){assert.ok(w.player.pos.distanceTo(previous)>.25,`Blocked enemy approach ${id}`);previous.copy(w.player.pos);last=now;}}}finally{key('KeyW',false);}
 await h.settleAssets();const start=now;
 try{for(let i=0;i<60*35&&target.hp>0;i++){orient(target.p.x,target.p.z,target.p.y+1);if(w.actions.skills.energy>=100){if(target.hp<20){note('charge-earned-spare-low-hp-target',{id:target.id,targetHp:target.hp});return;}await castAt(target);return;}fire(now-start>350);key('KeyD',target.mode==='windup');step();}assert.ok(target.hp<=0,`Ordinary shooting policy timeout ${id}`);note('ordinary-defeat',{id});}finally{fire(false);key('KeyD',false);}
}
try{
 assert.deepEqual([...w.done].sort(),[...parsed.done].sort());(d.getElementById('start')as HTMLElement).click();await Promise.resolve();step();await h.settleAssets();settle();assert.equal(w.actions.skills.energy,0);note('normal-spawn',{source:worldRoot,savedHash});
 for(let i=0;i<4&&w.contract.selected!==identity;i++){action('switchServant');step();await h.settleAssets();}assert.equal(w.contract.selected,identity);
 if(w.contract.companionSummoned)action('summon');assert.equal(w.contract.companionSummoned,false);
 for(const[x,z]of[[2,142],[-22,118],[-60,92],[-81.712,83.348],[-95,61],[-108.288,38.652],[-110,25],[-140,-14],[-184,-14],[-184,-36],[-230,-34],[-280,-30],[-320,-30],[-360,-30],[-420,-30],[-480,-24],[-540,-8],[-610,12],[-640,20]])walk(x,z);
 for(const id of ['wild_56b','wild_56','wild_3b','wild_3','wild_4','wild_4b','wild_5b','wild_5']){await fight(id);if(castResult)break;}
 assert.ok(castResult,'Bounded ordinary roster supplies earned charge and a valid target');assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
}catch(e){error=e;console.error(e);}finally{fire(false);for(const k of['KeyW','KeyS','KeyD'])key(k,false);writeFileSync(output,JSON.stringify({scope:'Explicit synthetic legacy save adds four contract flags before boot. Normal spawn and physical walking; normal Y/T, rifle damage earns all charge, normal X. No post-boot position/ground/HP/energy/damage/flag writes. CPU synthetic operator, not four-person recruitment or GPU/FPS evidence.',worldRoot,reducedEffects:process.env.QA_REDUCED==='1',sourceBefore,sourceAfter:sourceEvidence(worldRoot),sourceCommit,sourceStatus,sourceDiffSha256,identity,inputReport,savedHash,legacyFixtureSha256,stageSamples,events,hits,skillEvents,castResult,seconds:now/1000,hp:w.combat.state.hp,energy:w.actions.skills.energy,saved:win.localStorage.getItem('parhelion.world.progress.v2'),error:error?String(error):null,errors:h.errors,warnings:h.warnings},null,2),{flag:'wx'});await h.close();}if(error)process.exitCode=1;
