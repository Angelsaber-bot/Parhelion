/** Independent actual Arena main lifecycle edges; explicit fake async boundaries, no network/WebGL. */
import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{resolve}from'node:path';import{build}from'esbuild';import{JSDOM}from'jsdom';
const root=resolve(process.env.ARENA_SOURCE_QA_ROOT??'../arena-game');
const mocks:Record<string,string>={
 'scene.ts':`export class ArenaScene{loadMap(){return window.__qa.mapPromise}setView(){}render(){}disposeCombatEffects(){}}`,
 'game.ts':`export class Game{constructor(session,scene,controls,hud,onExit){this.session=session;this.onExit=onExit;window.__qa.games++;if(window.__qa.throwGame)throw Error('constructor failure')}stop(){if(this.stopped)return;this.stopped=true;try{this.session.close()}finally{this.onExit('')}}setPaused(){}}`,
 'session.ts':`export function startOffline(){return window.__qa.session()}export function joinOnline(){return window.__qa.joinPromise}`,
 'audio.ts':`export const sfx={unlock(){}}`,
 'armory.ts':`export function openArmory(){window.__qa.armory++}`,
};
const bundle=build({entryPoints:[resolve(root,'src/main.ts')],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',loader:{'.webp':'dataurl','.css':'empty'},plugins:[{name:'independent-startup-boundaries',setup(b){b.onResolve({filter:/\.\/(scene|game|session|audio|armory)\.ts$/},a=>({path:a.path.slice(2),namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
function deferred(){let resolve!:(v?:any)=>void,reject!:(e:Error)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};}
async function boot(){const dom=new JSDOM(readFileSync(resolve(root,'index.html'),'utf8'),{url:'https://arena.test',pretendToBeVisual:true,runScripts:'outside-only'}),w=dom.window,d=w.document,map=deferred(),join=deferred();const errors:string[]=[];dom.virtualConsole.on('jsdomError',(e:any)=>errors.push(String(e)));const qa={mapPromise:map.promise,joinPromise:join.promise,games:0,armory:0,closes:0,throwGame:false,throwClose:false,session(){return{close(){qa.closes++;if(qa.throwClose)throw Error('close failed')}}}};(w as any).__qa=qa;(w.HTMLDialogElement.prototype as any).showModal=function(){this.setAttribute('open','')};(w.HTMLDialogElement.prototype as any).close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'))};w.requestAnimationFrame=()=>1;(w as any).matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});(w as any).fetch=()=>{throw Error('network forbidden')};(w as any).WebSocket=class{constructor(){throw Error('socket forbidden')}};(w.HTMLCanvasElement.prototype as any).requestPointerLock=()=>Promise.resolve();w.eval((await bundle).outputFiles[0].text);return{dom,w,d,qa,map,join,errors,click:(id:string)=>(d.getElementById(id)as HTMLButtonElement).click(),flush:async()=>{for(let i=0;i<15;i++)await Promise.resolve()}};}
test('pending startup rejects stale armory import completions',async()=>{const h=await boot();try{
 h.click('armory');h.click('play');await h.flush();
 assert.equal(h.qa.armory,0,'an armory import begun before Start must not open over startup');
 assert.equal((h.w as any).arena.controls.blocked,true);assert.equal((h.d.getElementById('arena-settings')as HTMLDialogElement).open,false,'stale lobby Settings click must not open a modal over startup');
 h.map.resolve();await h.flush();assert.equal(h.qa.games,1);assert.equal((h.w as any).arena.controls.blocked,false);
}finally{h.dom.window.close();assert.deepEqual(h.errors,[])}});
test('pending startup rejects a queued lobby Settings callback',async()=>{const h=await boot();try{h.click('play');h.click('settings-lobby');assert.equal((h.d.getElementById('arena-settings')as HTMLDialogElement).open,false);h.map.resolve();await h.flush();assert.equal(h.qa.games,1);}finally{h.dom.window.close();assert.deepEqual(h.errors,[])}});
test('canceled pending map may resolve and be reused without starting the canceled attempt',async()=>{const h=await boot();try{
 h.click('play');h.click('cancel-start');h.map.resolve();await h.flush();assert.equal(h.qa.games,0);h.click('play');await h.flush();assert.equal(h.qa.games,1);assert.equal(h.qa.closes,0);
}finally{h.dom.window.close();assert.deepEqual(h.errors,[])}});
test('throwing stale session close cannot corrupt a newer attempt; throwing constructor cleanup permits retry',async()=>{const h=await boot();try{
 h.map.resolve();await h.flush();(h.d.querySelector('[data-mode="online"]')as HTMLButtonElement).click();h.click('play');await h.flush();h.click('cancel-start');h.qa.throwClose=true;h.join.resolve(h.qa.session());await h.flush();assert.equal(h.qa.closes,1);assert.equal(h.qa.games,0);assert.equal((h.d.getElementById('play')as HTMLButtonElement).disabled,false);
 (h.d.querySelector('[data-mode="offline"]')as HTMLButtonElement).click();h.qa.throwGame=true;h.click('play');await h.flush();assert.equal(h.qa.closes,2);assert.equal((h.d.getElementById('play')as HTMLButtonElement).disabled,false);h.qa.throwGame=false;h.qa.throwClose=false;h.click('play');await h.flush();assert.equal(h.qa.games,2);
}finally{h.dom.window.close();assert.deepEqual(h.errors,[])}});

test('final exit suppresses an already-requested armory import',async()=>{const h=await boot();try{h.click('armory');h.w.dispatchEvent(new h.w.PageTransitionEvent('pagehide',{persisted:false}));await h.flush();assert.equal(h.qa.armory,0);h.map.resolve();await h.flush();h.click('play');await h.flush();assert.equal(h.qa.games,0);}finally{h.dom.window.close();assert.deepEqual(h.errors,[])}});
