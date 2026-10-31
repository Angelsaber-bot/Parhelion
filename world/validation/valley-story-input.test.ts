import { WorldAudio } from '../src/worldAudio';
import * as campaignClosure from '../src/campaignClosure';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const press=source.slice(source.indexOf('function press('),source.indexOf('function release('));
function setup(overrides:Record<string,unknown>={}){
 let npc=0,marker=0;const state={narrative:undefined,...campaignClosure,audio:new WorldAudio({listen:false}),travelOpenState:false,campaignJournalOpen:false,campaignTrackedRegion:null,falseDawnTracked:false,falseDawnRuntime:undefined,actions:undefined,inspectServant:false,locked:true,settings:{action:()=> 'interact'},settingsPanel:{open:false},document:{visibilityState:'visible',hasFocus:()=>true},gameplayActive:()=>true,combat:{defeated:false},player:{flying:false,gliding:false,swimming:false,onGround:true},keys:new Set(),interactSettlementNpc:()=>{npc++;return false;},interact:()=>marker++,...overrides};
 const c=vm.createContext(state);vm.runInContext(transformSync(press+'\nglobalThis.invoke=press;',{loader:'ts'}).code,c);return{invoke:(repeat=false)=>c.invoke('KeyF',repeat),counts:()=>[npc,marker]};
}
test('production interaction input only reaches story behind active, focused, non-flight gameplay guards',()=>{
 for(const override of [{locked:false},{settingsPanel:{open:true}},{document:{visibilityState:'hidden',hasFocus:()=>true}},{document:{visibilityState:'visible',hasFocus:()=>false}},{gameplayActive:()=>false},{combat:{defeated:true}},{player:{flying:true,onGround:true}},{player:{flying:false,onGround:false}},{player:{flying:false,swimming:true,onGround:true}},{player:{flying:false,gliding:true,onGround:true}}]){
 const f=setup(override);f.invoke();assert.deepEqual(f.counts(),[0,0]);
 }
 const repeated=setup();repeated.invoke(true);assert.deepEqual(repeated.counts(),[0,0]);
 const active=setup();active.invoke();assert.deepEqual(active.counts(),[1,1]);
});
