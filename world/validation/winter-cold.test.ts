/** Executes the actual production cold update, with exported warmth triggers and a minimal DOM fixture. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
const layout=JSON.parse(readFileSync(new URL('../public/assets/world_winter.layout.json',import.meta.url),'utf8'));
function setup(){
 const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),section=source.slice(source.indexOf('function updateCold('),source.indexOf('// ───────────── player / input'));
 assert.ok(section.length>900,'production cold updater located');
 const element=()=>({style:{},textContent:'',hidden:false,querySelector:()=>({style:{},textContent:''})});
 const c=vm.createContext({cold:{warmth:100,frozen:false,warned:false},coldHud:element(),frost:element(),warmSpots:layout.markers.filter((m:any)=>/(^|_)warm_/.test(m.id)),player:{pos:{x:0,y:12,z:0},flying:false},done:new Set(),region:'winter',active:true,warnings:0});
 Object.assign(c,{regionAt:()=>({id:c.region}),gameplayActive:()=>c.active,bilingual:(_zh:string,en:string)=>en,toast:()=>c.warnings++});
 vm.runInContext(transformSync(section+'\nglobalThis.update=updateCold;', {loader:'ts',format:'cjs'}).code,c);return c;
}
const move=(c:any,p:number[])=>Object.assign(c.player.pos,{x:p[0],y:p[1],z:p[2]});
test('Everwinter production cold drains in the snowfield, freezes once, and all exported fires restore warmth',()=>{
 const c=setup();c.update(50);assert.equal(c.cold.warmth,0);assert.equal(c.cold.frozen,true);assert.equal(c.warnings,1);c.update(2);assert.equal(c.warnings,1);
 for(const m of c.warmSpots){c.cold.warmth=10;move(c,m.p);for(const req of m.requires??[])c.done.add(req);c.update(1);assert.equal(c.cold.warmth,40,m.id);assert.equal(c.cold.frozen,false);}
});
test('Everwinter beacon warmth requires its actual quest flag; pause/flying stop drain and the winter core ends cold',()=>{
 const c=setup(),m=c.warmSpots.find((m:any)=>m.requires?.includes('beacon_1'));assert.ok(m);move(c,m.p);c.cold.warmth=50;c.update(1);assert.equal(c.cold.warmth,48);
 c.done.add('beacon_1');c.update(1);assert.equal(c.cold.warmth,78);move(c,[0,12,0]);c.active=false;c.update(20);assert.equal(c.cold.warmth,78);
 c.active=true;c.player.flying=true;c.update(20);assert.equal(c.cold.warmth,78);c.player.flying=false;c.done.add('winter_core');c.update(1);assert.equal(c.cold.warmth,100);assert.equal(c.coldHud.hidden,true);assert.equal(c.frost.style.opacity,'0');
});
