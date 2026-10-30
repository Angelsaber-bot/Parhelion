import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { JSDOM } from 'jsdom';
import { WorldActions, type WorldActionContext } from '../src/worldActions';
import { actionPresentation, createActionHud } from '../src/actionHud';
import { PlayerMelee } from '../src/playerMelee';
function fixture() {
 const context:WorldActionContext={enabled:true,grounded:true,armed:true,bladeReady:true,position:{x:0,y:0,z:0},yaw:0,moveX:0,moveZ:0,identity:null};
 const actions=new WorldActions({scene:new THREE.Scene(),context:()=>context,strike:()=>({damage:0,hits:[],kills:[]}),defense:()=>{},startPose:()=>true,cancelPoses:()=>{},toast:()=>{},reducedEffects:()=>false});return {context,actions};
}
test('HUD distinguishes equipment, model failure, airborne state and ultimate energy',()=>{
 const f=fixture();try {
  assert.equal(actionPresentation(f.actions,'skill').available,true);assert.equal(actionPresentation(f.actions,'ultimate').available,false);assert.match(actionPresentation(f.actions,'ultimate').status,/0\/100/);
  f.context.armed=false;assert.equal(actionPresentation(f.actions,'melee').available,false);assert.equal(actionPresentation(f.actions,'evade').available,true);
  f.context.armed=true;f.context.bladeReady=false;const loading=actionPresentation(f.actions,'melee').status;f.context.bladeFailed=true;assert.notEqual(actionPresentation(f.actions,'melee').status,loading);
  f.context.grounded=false;for(const id of ['melee','evade','skill','ultimate'] as const)assert.equal(actionPresentation(f.actions,id).available,false);
  f.context.grounded=true;f.context.enabled=false;assert.equal(actionPresentation(f.actions,'evade').available,false);
 }finally{f.actions.dispose();}
});
test('combo hint matches late input and queued cut, cancellation retains recovery',()=>{
 const f=fixture();try{
  f.actions.press('melee');assert.equal(actionPresentation(f.actions,'melee').chaining,false);
  f.actions.update(.1);f.actions.update(.1);f.actions.update(.05);assert.equal(actionPresentation(f.actions,'melee').chaining,true);assert.equal(actionPresentation(f.actions,'melee').available,true);
  f.actions.press('melee');assert.equal(f.actions.melee.nextCutQueued,true);assert.equal(actionPresentation(f.actions,'melee').chaining,false);assert.equal(actionPresentation(f.actions,'melee').available,false);
  const queued=actionPresentation(f.actions,'melee').status;f.actions.cancel();assert.equal(f.actions.melee.nextCutQueued,false);assert.notEqual(actionPresentation(f.actions,'melee').status,queued);assert.equal(actionPresentation(f.actions,'melee').available,false);
  f.actions.update(.1);f.actions.update(.1);assert.equal(actionPresentation(f.actions,'melee').available,true);
 }finally{f.actions.dispose();}
});
test('presentation window equals actual input acceptance at 27,40,60,120Hz',()=>{
 for(const fps of [27,40,60,120]){const a=new PlayerMelee(),b=new PlayerMelee();a.press(0);b.press(0);let found=false;
  for(let i=0;i<Math.ceil(.5*fps);i++){if(a.active){const window=a.comboWindowOpen;assert.equal(b.press(0),window);if(window){found=true;break;}}a.update(1/fps,true);b.update(1/fps,true);}assert.equal(found,true);
 }
});
test('companion cast permits evade while player pulse and cooldown correctly block it',()=>{
 const f=fixture();try{f.actions.press('skill');assert.equal(actionPresentation(f.actions,'evade').available,false);f.actions.reset();f.context.identity='saber';f.actions.press('skill');assert.equal(actionPresentation(f.actions,'evade').available,true);f.actions.press('evade');assert.equal(actionPresentation(f.actions,'evade').available,false);f.actions.cancel();assert.equal(actionPresentation(f.actions,'evade').available,false);}finally{f.actions.dispose();}
});
test('real HUD retains nodes, shows custom keys, energy semantics, queue state and reset',()=>{
 const dom=new JSDOM('<!doctype html><body></body>'),previous=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});const f=fixture(),hud=createActionHud(id=>id==='melee'?'Mouse4':id.toUpperCase());
 try{hud.update(f.actions,true);const root=hud.root,first=root.querySelector('[data-action="melee"]')!;assert.equal(first.querySelector('b')?.textContent,'Mouse4');assert.equal(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'),'0');assert.equal(root.querySelector('[data-action="ultimate"]')?.classList.contains('unavailable'),true);
 f.actions.press('melee');f.actions.update(.1);f.actions.update(.1);f.actions.update(.05);hud.update(f.actions,true);assert.equal(first.classList.contains('chain-open'),true);assert.equal(root.querySelector('[data-action="melee"]'),first);hud.update(f.actions,false);assert.equal(root.hidden,true);f.actions.reset();hud.update(f.actions,true);assert.equal(first.classList.contains('chain-open'),false);hud.dispose();assert.equal(dom.window.document.querySelector('#world-action-bar'),null);
 }finally{f.actions.dispose();dom.window.close();if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');}
});
