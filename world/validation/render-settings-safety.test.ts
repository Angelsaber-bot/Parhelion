import vm from 'node:vm';
import {transformSync} from 'esbuild';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readResolutionMode} from '../src/renderSettings.ts';
import {readFileSync} from 'node:fs';

test('resolution URL wins over saved mode; malformed and inaccessible storage are safe',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try{
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=> 'balanced'}});
 assert.equal(readResolutionMode(new URLSearchParams()),'balanced');
 assert.equal(readResolutionMode(new URLSearchParams('resolution=crisp')),'crisp');
 assert.equal(readResolutionMode(new URLSearchParams('resolution=adaptive')),'adaptive');
 assert.equal(readResolutionMode(new URLSearchParams('resolution=bad')),'balanced');
 for(const saved of [null,'bad','balanced','crisp','adaptive']){
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>saved}});
 assert.equal(readResolutionMode(new URLSearchParams()),saved==='crisp'||saved==='adaptive'?saved:'balanced');
 }
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get:()=>{throw new Error('private storage');}});
 assert.equal(readResolutionMode(new URLSearchParams()),'balanced');
 assert.equal(readResolutionMode(new URLSearchParams('resolution=balanced')),'balanced');
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
});
test('main counts all render passes once and screenshot mode disables automatic resolution changes',()=>{
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 assert.match(main,/renderer\.info\.autoReset\s*=\s*false/);
 assert.equal((main.match(/renderer\.info\.reset\(\)/g)??[]).length,1);
 assert.match(main,/renderer\.info\.reset\(\);\s*if \(composer\) composer\.render\(\); else renderer\.render\(scene, camera\);/);
 assert.match(main,/resolution === 'adaptive' && !params\.has\('shot'\)/);
});
test('both resize and monitor DPR change refresh renderer and composer without scene mutation',()=>{
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 const start=main.indexOf('function applyResolution()'),end=main.indexOf("addEventListener('resize'",start);assert.ok(start>=0&&end>start);
 const calls:unknown[]=[];const context=vm.createContext({graphicsRecovery:undefined,worldExited:false,bootFailed:false,dpr:1.25,renderer:{setPixelRatio:(value:number)=>calls.push(['renderer',value])},composer:{setPixelRatio:(value:number)=>calls.push(['composer',value])}});
 vm.runInContext(transformSync(main.slice(start,end)+'\nglobalThis.apply=applyResolution;',{loader:'ts'}).code,context);
 context.apply();assert.deepEqual(calls,[['renderer',1.25],['composer',1.25]]);
 for(const field of ['graphicsRecovery','worldExited','bootFailed']){calls.length=0;context[field]=field==='graphicsRecovery'?{blocked:true}:true;context.apply();assert.deepEqual(calls,[],field+' suppresses unsafe renderer mutation');context[field]=field==='graphicsRecovery'?undefined:false;}
 context.composer=undefined;calls.length=0;context.apply();assert.deepEqual(calls,[['renderer',1.25]]);
 assert.match(main,/if \(observedDeviceDpr !== devicePixelRatio\)\s*\{[\s\S]*?targetDpr\(devicePixelRatio, resolution, lowQ\); applyResolution\(\);/);
 assert.match(main,/addEventListener\('resize',[\s\S]*?camera\.updateProjectionMatrix\(\);[\s\S]*?composer\?\.setSize\(innerWidth, innerHeight\);/);
});
