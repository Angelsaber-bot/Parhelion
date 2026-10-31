import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
/** Actual main and loaded GLB, explicit legacy recruitment + supported Winter entry.
 * Normal input, no actor transforms/HP/ground writes; CPU only. */
test('native Saber terrain survives pause, recall and actual outfit control without stale ownership',async t=>{
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['armory_rack','saber_contract','winter_core'],found:[]})}});
 const {world:w,window}=h,d=window.document;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const input=(action:string,down:boolean)=>d.body.dispatchEvent(new window.KeyboardEvent(down?'keydown':'keyup',{code:w.settings.bindingsFor(action)[0],bubbles:true,cancelable:true}));
 const tap=(action:string)=>{input(action,true);input(action,false);};
 const start=async()=>{(d.getElementById('start') as HTMLElement).click();await Promise.resolve();frame();};
 const snapshot=()=>{const bones:any[]=[];w.servant.root.traverse((o:any)=>{if(o.isBone)bones.push([o.name,...o.position.toArray(),...o.quaternion.toArray()]);});return JSON.stringify({root:w.servant.root.position.toArray(),bones,ground:w.servant.groundDiagnostics,stride:w.servant.strideDiagnostics});};
 try{
  const g=w.combat.geometry.ground(50,-593.5,100);assert.ok(g);w.player.teleport(50,g.point.y+.15,-593.5);await start();await h.settleAssets();frame(180);assert.ok(w.player.onGround);assert.ok(w.contract.summoned);
  input('forward',true);input('sprint',true);frame(90);input('forward',false);input('sprint',false);assert.ok(w.servant.groundDiagnostics.patch.shapecasts>0);
  d.exitPointerLock();frame();const paused=snapshot();frame(120);assert.equal(snapshot(),paused,'all pose/support state freezes while paused');await start();{const a=JSON.parse(snapshot()),b=JSON.parse(paused);let maxBone=0;for(let i=0;i<a.bones.length;i++)for(let j=1;j<a.bones[i].length;j++)maxBone=Math.max(maxBone,Math.abs(a.bones[i][j]-b.bones[i][j]));t.diagnostic(JSON.stringify({resumeRoot:a.root,pausedRoot:b.root,maxBone,groundBefore:b.ground,groundAfter:a.ground,strideBefore:b.stride,strideAfter:a.stride}));assert.equal(maxBone,0,'first resumed dt-zero pose');assert.deepEqual(a.root,b.root);}frame(20);
  tap('summon');frame(2);assert.equal(w.contract.summoned,false);assert.equal(w.servant.root.visible,false);const hidden=snapshot();input('forward',true);frame(60);input('forward',false);assert.equal(snapshot(),hidden,'hidden actor does not keep solving or advancing bones');tap('summon');frame(120);assert.ok(w.servant.root.visible);assert.ok(w.servant.root.position.toArray().every(Number.isFinite));
  d.exitPointerLock();frame();(d.getElementById('servant-open') as HTMLElement).click();const dialog=d.getElementById('servant-settings') as HTMLDialogElement;assert.ok(dialog.open);
  const oldModel=w.servant.presentationModel,select=d.getElementById('servant-outfit') as HTMLSelectElement;select.value='civilian';select.dispatchEvent(new window.Event('change',{bubbles:true}));await h.settleAssets();assert.notEqual(w.servant.presentationModel,oldModel);assert.equal(oldModel.parent,null);assert.equal(w.servant.appearance.outfit,'civilian');assert.ok(w.contract.summoned);
  (dialog.querySelector('header button') as HTMLElement).click();await start();input('forward',true);frame(90);input('forward',false);assert.ok(w.servant.groundDiagnostics.patch.shapecasts>0);assert.equal(w.servant.groundDiagnostics.patch.overflows,0);assert.ok(w.servant.groundDiagnostics.contact.adjustments>0);assert.deepEqual(h.errors,[]);t.diagnostic(JSON.stringify(w.servant.groundDiagnostics));
 }finally{await h.close();}
});
