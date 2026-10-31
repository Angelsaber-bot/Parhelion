/** Real-main keyboard/120Hz support diagnostic. The slope is production terrain;
 * flat/ledge controls explicitly add one temporary synthetic collider at height20.
 * No grounded/HP/evade/velocity writes. Entry teleport is fixture setup. */
import {installEvadeSupportCandidate} from './evade-support-candidate';
import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';import {mkdir,writeFile} from 'node:fs/promises';import {bootWorldWithoutGpu} from '../world-dom-boot.fixture';
const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['armory_rack'],found:[]})}}),{world:w,window}=h,d=window.document;let now=0;const frame=()=>h.frame(now+=1000/60),rows:any[]=[],traces:any[]=[];let current='setup',start=0;
const key=(action:string,down:boolean)=>d.body.dispatchEvent(new window.KeyboardEvent(down?'keydown':'keyup',{code:w.settings.bindingsFor(action)[0],bubbles:true,cancelable:true}));
const face=(yaw:number)=>{const event=new window.MouseEvent('mousemove',{bubbles:true});Object.defineProperties(event,{movementX:{value:Math.atan2(Math.sin(w.player.yaw-yaw),Math.cos(w.player.yaw-yaw))/(.0022*w.settings.value.sensitivity)},movementY:{value:0}});d.dispatchEvent(event);};
const candidate=process.argv.includes('--candidate')?installEvadeSupportCandidate(w.player):null;
const step=w.player.step.bind(w.player);w.player.step=(...args:any[])=>{const before=w.player.pos.toArray(),grounded=w.player.onGround,remaining=w.actions.evade.remaining,result=step(...args);if(current!=='setup'&&(remaining>0||args[1]?.jump)){const support=w.combat.geometry.ground(w.player.pos.x,w.player.pos.z,w.player.pos.y+.5);traces.push({case:current,time:(now-start)/1000,before,after:w.player.pos.toArray(),wasGrounded:grounded,grounded:w.player.onGround,remaining,velocity:w.player.vel.toArray(),support:support?.point.toArray(),normalY:support?.face?.normal.y??null,gap:support?w.player.pos.y-support.point.y:null});}return result;};
const cancel=w.actions.cancel.bind(w.actions);w.actions.cancel=()=>{if(current!=='setup'&&w.actions.evade.remaining>0)traces.push({case:current,type:'cancel',time:(now-start)/1000,remaining:w.actions.evade.remaining,context:{...w.actions.actionContext}});return cancel();};
const plane=new THREE.BoxGeometry(20,.2,20).translate(-52,20,-100),platform={name:'validation-only-flat-and-ledge',enabled:true,bvh:new MeshBVH(plane)};
try{
 (d.getElementById('start')as HTMLElement).click();frame();await h.settleAssets();
 for(const scenario of ['production-slope','synthetic-flat','synthetic-ledge','synthetic-jump']as const){
  current='setup';if(scenario!=='production-slope'&&!w.colliders.includes(platform))w.colliders.push(platform);
  const x=scenario==='production-slope'?-54.303720415746646:scenario==='synthetic-ledge'?-42.45:-52,z=scenario==='production-slope'?-105.20407474105565:-100,ground=w.combat.geometry.ground(x,z,scenario==='production-slope'?5:22);assert.ok(ground);w.player.teleport(x,ground.point.y+.04,z);for(let i=0;i<180;i++)frame();assert.equal(w.player.onGround,true);assert.equal(w.actions.evade.cooldown,0);
  const yaw=scenario==='production-slope'?Math.atan2(x-(-53.87395070094748),z-(-102.1539371039129)):0;face(yaw);frame();current=scenario;start=now;const from=w.player.pos.toArray();
  if(scenario==='synthetic-jump'){key('jump',true);frame();key('jump',false);assert.equal(w.player.onGround,false);}
  key('right',true);key('evade',true);key('evade',false);const admitted=w.actions.evade.remaining>0;frame();key('right',false);for(let i=0;i<40;i++)frame();
  rows.push({case:scenario,admitted,start:from,end:w.player.pos.toArray(),distance:Math.hypot(w.player.pos.x-from[0],w.player.pos.z-from[2]),cooldown:w.actions.evade.cooldown,cancels:traces.filter(row=>row.case===scenario&&row.type==='cancel'),firstGroundLoss:traces.find(row=>row.case===scenario&&row.wasGrounded&&!row.grounded)});
 }
 assert.equal(rows.find(row=>row.case==='synthetic-flat').cancels.length,0);assert.ok(Math.abs(rows.find(row=>row.case==='synthetic-flat').distance-3.12)<.01);assert.equal(rows.find(row=>row.case==='synthetic-jump').admitted,false);assert.ok(rows.find(row=>row.case==='synthetic-ledge').cancels.length>0);
 const report={evidence:'Actual main keyboard and Player/BVH120Hz, no forced grounded/velocity/HP/evade state. Production slope + explicitly synthetic flat/ledge collider controls, not a gameplay journey or GPU test.',rows,traces,candidate:candidate?.diagnostics??null};await mkdir('../artifacts/defense-input',{recursive:true});await writeFile(`../artifacts/defense-input/support-controls${candidate?'-candidate':''}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,traces:traces.length}));assert.deepEqual(h.errors,[]);
}finally{candidate?.dispose();const index=w.colliders.indexOf(platform);if(index>=0)w.colliders.splice(index,1);plane.dispose();await h.close();}
