/** Isolated support wrapper in actual main. Entry positioning/synthetic flat
 * collider are explicit controls; no forced grounding, HP or evade-clock writes. */
import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';import {writeFileSync} from 'node:fs';
import {bootWorldWithoutGpu} from '../world-dom-boot.fixture';import {installEvadeSupportCandidate} from './evade-support-candidate';
const h=await bootWorldWithoutGpu({deterministic:true}),w=h.world,d=h.window.document;let now=0,hz=60,active=false;const rows:any[]=[],trace:any[]=[];
const frame=()=>h.frame(now+=1000/hz),key=(action:string,down:boolean)=>d.body.dispatchEvent(new h.window.KeyboardEvent(down?'keydown':'keyup',{code:w.settings.bindingsFor(action)[0],bubbles:true,cancelable:true}));
const originalStep=w.player.step;w.player.step=function(...args:any[]){const result=originalStep.apply(this,args);if(active)trace.push({remaining:w.actions.evade.remaining,cooldown:w.actions.evade.cooldown,invulnerable:w.actions.evade.remaining>.10,grounded:this.onGround});return result;};
const geo=new THREE.BoxGeometry(20,.2,20).translate(-52,20,-100),flat={name:'independent-validation-flat',enabled:true,bvh:new MeshBVH(geo)};let helper:ReturnType<typeof installEvadeSupportCandidate>|null=null,error:unknown;
try{
 (d.getElementById('start')as HTMLElement).click();await Promise.resolve();frame();
 for(const candidate of [false,true]){if(candidate)helper=installEvadeSupportCandidate(w.player);
  for(const rate of [30,60,120])for(const terrain of ['flat','production-slope']){hz=rate;active=false;const index=w.colliders.indexOf(flat);if(terrain==='flat'&&index<0)w.colliders.push(flat);else if(terrain!=='flat'&&index>=0)w.colliders.splice(index,1);
   const x=terrain==='flat'?-52:-54.303720415746646,z=terrain==='flat'?-100:-105.20407474105565,g=w.combat.geometry.ground(x,z,terrain==='flat'?22:5);assert.ok(g);w.player.teleport(x,g.point.y+.04,z);for(let i=0;i<hz*2;i++)frame();assert.equal(w.player.onGround,true);assert.equal(w.actions.evade.cooldown,0);
   const yaw=terrain==='flat'?0:Math.atan2(x+53.87395070094748,z+102.1539371039129),event=new h.window.MouseEvent('mousemove',{bubbles:true});Object.defineProperties(event,{movementX:{value:Math.atan2(Math.sin(w.player.yaw-yaw),Math.cos(w.player.yaw-yaw))/(.0022*w.settings.value.sensitivity)},movementY:{value:0}});d.dispatchEvent(event);frame();
   const from=w.player.pos.clone();trace.length=0;active=true;key('right',true);key('evade',true);key('evade',false);assert.equal(w.actions.evade.remaining,.24);assert.equal(w.actions.evade.cooldown,1.25);frame();key('right',false);for(let i=0;i<hz;i++)frame();active=false;
   const row={candidate,hz,terrain,distance:Math.hypot(w.player.pos.x-from.x,w.player.pos.z-from.z),trace:trace.map(v=>({...v})),support:helper?.diagnostics};rows.push(row);
   if(candidate||terrain==='flat')assert.ok(Math.abs(row.distance-3.12)<1e-6,JSON.stringify({...row,trace:row.trace.length}));else assert.ok(row.distance<.5,'baseline reproduces real slope truncation');
  }
 }
 for(const rate of [30,60,120]){const base=rows.find(r=>!r.candidate&&r.hz===rate&&r.terrain==='flat');for(const row of rows.filter(r=>r.candidate&&r.hz===rate)){const clean=(r:any)=>r.trace.map(({remaining,cooldown,invulnerable}:any)=>({remaining,cooldown,invulnerable}));assert.deepEqual(clean(row),clean(base),'support must preserve actual main action clocks, not grant extra invulnerability');}}
 assert.deepEqual(h.errors,[]);
}catch(e){error=e;console.error(e);}finally{helper?.dispose();w.player.step=originalStep;const i=w.colliders.indexOf(flat);if(i>=0)w.colliders.splice(i,1);geo.dispose();await h.close();}
const out={scope:'Actual main fixed120Hz physics under30/60/120Hz synthetic RAF, normal evade keys. Explicit supported entry setup and synthetic flat control; isolated candidate only, no GPU/human/performance claim.',rows,error:error?String(error):null};writeFileSync('../../parhelion-eight-hour-evidence/qa/evade-main-cadence-independent.json',JSON.stringify(out,null,2));console.log(JSON.stringify({rows:rows.map(({trace,...r})=>({...r,steps:trace.length})),error:out.error}));if(error)process.exitCode=1;
