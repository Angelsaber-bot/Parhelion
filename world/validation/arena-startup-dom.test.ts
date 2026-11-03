/** Production Arena startup UI; renderer and session creation are controllable
 * async boundaries. No real sockets, WebGL or gameplay simulation are exercised. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const root=resolve('../arena-game');
const mocks:Record<string,string>={
 'scene.ts':`export class ArenaScene { setQuality(value){window.__qa.graphics.push(value)}loadMap(id){return window.__qa.loadMap(id)}setView(){}render(){}disposeCombatEffects(){} }`,
 'game.ts':`export class Game { constructor(session){window.__qa.games++;if(window.__qa.throwGame)throw Error('view construction failed');this.session=session}stop(){this.session.close()}setPaused(){} }`,
 'session.ts':`export function startOffline(opts){window.__qa.offline++;window.__qa.offlineInputs.push(opts);return window.__qa.session(opts)}export function joinOnline(url,opts){return window.__qa.join(url,opts)}`,
 'audio.ts':`export const sfx={unlock(){}}`, 'armory.ts':`export function openArmory(options){window.__qa.armory=options}`,
};
const bundle=build({entryPoints:[resolve(root,'src/main.ts')],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',loader:{'.webp':'dataurl','.css':'empty'},plugins:[{name:'startup-boundaries',setup(b){b.onResolve({filter:/\.\/(scene|game|session|audio|armory)\.ts$/},a=>({path:a.path.slice(2),namespace:'startup-boundary'}));b.onLoad({filter:/.*/,namespace:'startup-boundary'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
function deferred(){let resolve!:(value?:any)=>void,reject!:(error:Error)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};}
async function boot(saved?:unknown){
 const dom=new JSDOM(readFileSync(resolve(root,'index.html'),'utf8'),{url:'https://arena.test/',pretendToBeVisual:true,runScripts:'outside-only'}),w=dom.window,d=w.document;
 if(saved!==undefined)w.localStorage.setItem('arena-lobby',JSON.stringify(saved));
 const qa={graphics:[]as string[],armory:null as any,maps:[]as {id:string;task:ReturnType<typeof deferred>}[],joins:[]as {url:string;opts:any;task:ReturnType<typeof deferred>}[],games:0,offline:0,offlineInputs:[]as any[],closed:0,throwGame:false,
  loadMap(id:string){const task=deferred();this.maps.push({id,task});return task.promise},join(url:string,opts:any){const task=deferred();this.joins.push({url,opts,task});return task.promise},session(opts?:any){return{opts,close:()=>{qa.closed++}}}};
 (w as any).__qa=qa;w.requestAnimationFrame=()=>1;(w as any).matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 (w as any).fetch=()=>{throw Error('real network forbidden')};(w as any).WebSocket=class{constructor(){throw Error('real network forbidden')}};
 (w.HTMLCanvasElement.prototype as any).requestPointerLock=()=>Promise.resolve();
 w.eval((await bundle).outputFiles[0].text);
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
 const click=(selector:string)=>{const el=d.querySelector<HTMLButtonElement>(selector);assert.ok(el,`missing ${selector}`);el.click()};
 const language=d.querySelector<HTMLSelectElement>('.parhelion-language select')!;language.value='en';language.dispatchEvent(new w.Event('change',{bubbles:true}));
 return{dom,w,d,qa,flush,click};
}
test('obsolete map rejection cannot overwrite the current successful selection',async()=>{const h=await boot();try{
 h.click('[data-id="blackflag"]');h.qa.maps[1].task.resolve();await h.flush();h.qa.maps[0].task.reject(Error('old map failed'));await h.flush();
 assert.ok(h.d.getElementById('error')!.classList.contains('hidden'));
}finally{h.dom.window.close()}});
test('Start deliberately retries a failed map instead of reawaiting its rejected promise',async()=>{const h=await boot();try{
 h.qa.maps[0].task.reject(Error('temporary asset failure'));await h.flush();h.click('#play');await h.flush();
 assert.equal(h.qa.maps.length,2);h.qa.maps[1].task.resolve();await h.flush();assert.equal(h.qa.offline,1);assert.equal(h.qa.games,1);
}finally{h.dom.window.close()}});
test('online asset failure remains an asset error rather than a server-address error',async()=>{const h=await boot();try{
 h.click('[data-mode="online"]');h.click('#play');h.qa.maps[0].task.reject(Error('mesh missing'));await h.flush();
 const error=h.d.getElementById('error')!.textContent!;assert.match(error,/Map failed to load/);assert.doesNotMatch(error,/Connection failed|server address/);assert.equal(h.qa.joins.length,0);
 assert.equal((h.d.getElementById('play')as HTMLButtonElement).disabled,false);
}finally{h.dom.window.close()}});
test('failed Game construction closes the created session and restores lobby UI',async()=>{const h=await boot();try{
 h.qa.maps[0].task.resolve();await h.flush();h.qa.throwGame=true;h.click('#play');await h.flush();
 assert.equal(h.qa.closed,1);assert.ok(!h.d.getElementById('lobby')!.classList.contains('hidden'));assert.ok(h.d.getElementById('hud')!.classList.contains('hidden'));
}finally{h.dom.window.close()}});
test('cancel invalidates an online join, closes its eventual session and cannot hide a newer load',async()=>{const h=await boot();try{
 h.qa.maps[0].task.resolve();await h.flush();h.click('[data-mode="online"]');h.click('#play');await h.flush();assert.equal(h.qa.joins.length,1);
 h.click('#cancel-start');assert.equal((h.d.getElementById('play')as HTMLButtonElement).disabled,false);assert.ok(h.d.getElementById('loading')!.classList.contains('hidden'));
 h.click('#play');await h.flush();assert.equal(h.qa.joins.length,2);
 h.qa.joins[0].task.resolve(h.qa.session());await h.flush();assert.equal(h.qa.closed,1);assert.equal(h.qa.games,0);assert.ok(!h.d.getElementById('loading')!.classList.contains('hidden'));
 h.qa.joins[1].task.resolve(h.qa.session());await h.flush();assert.equal(h.qa.games,1);assert.equal(h.qa.closed,1);
}finally{h.dom.window.close()}});
test('canceling a map load never starts a session later, and its late rejection stays silent',async()=>{const h=await boot();try{
 h.click('#play');h.click('#cancel-start');h.qa.maps[0].task.reject(Error('canceled asset'));await h.flush();
 assert.equal(h.qa.offline,0);assert.equal(h.qa.games,0);assert.ok(h.d.getElementById('error')!.classList.contains('hidden'));
 h.click('#play');assert.equal(h.qa.maps.length,2);h.qa.maps[1].task.resolve();await h.flush();assert.equal(h.qa.games,1);
}finally{h.dom.window.close()}});
for(const persisted of[true,false])test(`pagehide persisted=${persisted} invalidates pending join and closes its late session`,async()=>{const h=await boot();try{
 h.qa.maps[0].task.resolve();await h.flush();h.click('[data-mode="online"]');h.click('#play');await h.flush();
 h.w.dispatchEvent(new h.w.PageTransitionEvent('pagehide',{persisted}));h.qa.joins[0].task.resolve(h.qa.session());await h.flush();
 assert.equal(h.qa.closed,1);assert.equal(h.qa.games,0);assert.equal((h.d.getElementById('play')as HTMLButtonElement).disabled,false);
 h.click('#play');await h.flush();assert.equal(h.qa.joins.length,persisted?2:1,'only BFCache page can be reused');
}finally{h.dom.window.close()}});
test('pending attempt captures mode, ignores duplicate starts, and re-localizes loading/error text',async()=>{const h=await boot();try{
 h.click('[data-mode="online"]');h.click('#play');h.click('#play');h.click('[data-mode="offline"]');
 const locale=h.d.querySelector<HTMLSelectElement>('.parhelion-language select')!;locale.value='zh';locale.dispatchEvent(new h.w.Event('change',{bubbles:true}));
 assert.equal(h.d.getElementById('loading-status')!.textContent,'加载地图…');assert.equal(h.d.getElementById('cancel-start')!.textContent,'取消并返回大厅');
 h.qa.maps[0].task.resolve();await h.flush();assert.equal(h.qa.joins.length,1);assert.equal(h.qa.offline,0);assert.equal(h.d.getElementById('loading-status')!.textContent,'正在连接服务器…');
 h.qa.joins[0].task.reject(Error('refused'));await h.flush();assert.match(h.d.getElementById('error')!.textContent!,/连接失败/);
 locale.value='en';locale.dispatchEvent(new h.w.Event('change',{bubbles:true}));assert.match(h.d.getElementById('error')!.textContent!,/Connection failed/);
}finally{h.dom.window.close()}});
test('obsolete rejected join cannot overwrite a newer active attempt or its selected server',async()=>{const h=await boot();try{
 h.qa.maps[0].task.resolve();await h.flush();h.click('[data-mode="online"]');const server=h.d.getElementById('server')as HTMLInputElement;server.value='ws://192.168.1.2:2567';h.click('#play');await h.flush();h.click('#cancel-start');
 server.value='ws://192.168.1.3:2567';h.click('#play');await h.flush();h.qa.joins[0].task.reject(Error('old timeout'));await h.flush();
 assert.equal(h.qa.joins[1].url,'ws://192.168.1.3:2567');assert.ok(h.d.getElementById('error')!.classList.contains('hidden'));assert.ok(!h.d.getElementById('loading')!.classList.contains('hidden'));
 h.qa.joins[1].task.resolve(h.qa.session());await h.flush();assert.equal(h.qa.games,1);
}finally{h.dom.window.close()}});
test('choosing a fresh map clears the old map failure rather than retaining a misleading warning',async()=>{const h=await boot();try{
 h.qa.maps[0].task.reject(Error('old asset'));await h.flush();assert.ok(!h.d.getElementById('error')!.classList.contains('hidden'));
 h.click('[data-id="blackflag"]');h.qa.maps[1].task.resolve();await h.flush();assert.ok(h.d.getElementById('error')!.classList.contains('hidden'));
}finally{h.dom.window.close()}});
test('final page exit stops an already active session once, while BFCache retains it',async()=>{const h=await boot();try{
 h.qa.maps[0].task.resolve();await h.flush();h.click('#play');await h.flush();assert.equal(h.qa.games,1);
 h.w.dispatchEvent(new h.w.PageTransitionEvent('pagehide',{persisted:true}));assert.equal(h.qa.closed,0);
 h.w.dispatchEvent(new h.w.PageTransitionEvent('pagehide',{persisted:false}));assert.equal(h.qa.closed,1);
 h.w.dispatchEvent(new h.w.PageTransitionEvent('pagehide',{persisted:false}));assert.equal(h.qa.closed,1);
}finally{h.dom.window.close()}});

for(const mode of['offline','online'])test(`production ${mode} startup snapshots actual selected loadout and options once`,async()=>{const h=await boot();try{
 const change=(selector:string,value:string)=>{const el=h.d.querySelector<HTMLSelectElement>(selector)!;assert.ok(el);el.value=value;el.dispatchEvent(new h.w.Event('change',{bubbles:true}));};
 assert.equal(h.d.querySelectorAll('#wslots .wslot').length,3);assert.ok(h.d.getElementById('loadout')!.getAttribute('aria-label'));
 change('[data-slot="0"]','firefly');change('[data-slot="1"]','halo');change('[data-slot="2"]','hammer');
 change('#layout','1v2');change('#team','B');(h.d.getElementById('name')as HTMLInputElement).value='Selected fighter';
 h.click('[data-i="1"]');h.click('[data-id="blackflag"]');h.click(`[data-mode="${mode}"]`);
 const server=h.d.getElementById('server')as HTMLInputElement;server.value='ws://192.168.1.44:2567';(h.d.getElementById('bots')as HTMLInputElement).checked=true;
 const skinSnapshot:Record<number,number>={};for(const i of[3,2,7]){const select=h.d.querySelector<HTMLSelectElement>(`[data-w="${i}"]`)!;skinSnapshot[i]=Number(select.options[select.options.length-1].value);change(`[data-w="${i}"]`,String(skinSnapshot[i]));}
 const settings=(h.w as any).arena.controls.settings;assert.equal(settings.bind('weapon1','KeyI',true),null);assert.equal(h.d.querySelector('#wslots kbd')!.textContent,'I');
 h.click('#play');h.click('#play');assert.equal(h.qa.offline+h.qa.joins.length,0,'asset readiness remains required');
 // Simulate a queued stale edit while awaiting assets: the accepted request must own its snapshot.
 change('[data-slot="0"]','lumen');(h.d.getElementById('name')as HTMLInputElement).value='Later edit';server.value='ws://later.invalid:2567';
 h.qa.maps[1].task.resolve();await h.flush();
 const requests=mode==='online'?h.qa.joins.map(j=>j.opts):h.qa.offlineInputs;assert.equal(requests.length,1);
 const opts=requests[0];assert.deepEqual(Array.from(opts.loadout),['firefly','halo','hammer']);assert.equal(opts.map,'blackflag');assert.equal(opts.layout,'1v2');assert.equal(opts.team,'B');assert.equal(opts.char,1);assert.equal(opts.name,'Selected fighter');assert.equal(opts.bots,true);
 for(const i of[3,2,7])assert.equal(opts.skins[i],skinSnapshot[i]); assert.equal(h.d.querySelector('#wslots kbd')!.textContent,'I');
 if(mode==='online'){assert.equal(h.qa.joins[0].url,'ws://192.168.1.44:2567');h.qa.joins[0].task.resolve(h.qa.session(opts));await h.flush();}
 assert.equal(h.qa.games,1);h.click('#play');await h.flush();assert.equal(h.qa.offline+h.qa.joins.length,1,'active game rejects another start');
 }finally{h.dom.window.close()}});

// Exercise migration through the production entry point and both save paths.
test('legacy equipped identities survive catalog curation and startup saves stable IDs',async()=>{const h=await boot({name:'Returning',skins:[6,6,5,5,6,5,5,6]});try{
 assert.equal(h.d.querySelector<HTMLSelectElement>('[data-w="0"]')!.selectedOptions[0].textContent,'琥珀蜂巢 · Amber Apiary');
 assert.equal(h.d.querySelector<HTMLSelectElement>('[data-w="1"]')!.selectedOptions[0].textContent,'深渊巨口 · Abyssal Maw');
 h.qa.maps[0].task.resolve();await h.flush();h.click('#play');await h.flush();
 assert.deepEqual(Array.from(h.qa.offlineInputs[0].skins),[1,0,0,0,1,0,1,1]);
 const saved=JSON.parse(h.w.localStorage.getItem('arena-lobby')!);assert.equal(saved.name,'Returning');assert.ok(!('skins'in saved));assert.equal(saved.skinIds.lumen,'amber-apiary');assert.equal(saved.skinIds.blade,'prismwing');
}finally{h.dom.window.close()}});
test('workshop equipment saves IDs without erasing other lobby choices and reloads correctly',async()=>{
 const h=await boot({name:'Keep name',layout:'1v2',map:'blackflag',char:1,skins:[7,5,7,4,5,6,6,5]});let saved;try{
 h.click('#armory');await h.flush();assert.ok(h.qa.armory);assert.deepEqual(Array.from(h.qa.armory.skins),[0,0,0,0,0,0,0,0]);
 assert.equal(h.qa.armory.equip(7,1).saved,true);saved=JSON.parse(h.w.localStorage.getItem('arena-lobby')!);
 assert.equal(saved.name,'Keep name');assert.equal(saved.map,'blackflag');assert.equal(saved.layout,'1v2');assert.equal(saved.char,1);assert.equal(saved.skinIds.hammer,'sugar-crash');assert.ok(!('skins'in saved));
}finally{h.dom.window.close()}
 const restored=await boot(saved);try{restored.click('#armory');await restored.flush();assert.equal(restored.qa.armory.skins[7],1);}finally{restored.dom.window.close()}
});

test('live graphics control preserves lobby choices, persists quality and removes the legacy low URL flag',async()=>{const h=await boot({name:'Keep graphics name',skins:[6,6,5,5,6,5,5,6]});try{
 const before=h.w.localStorage.getItem('arena-lobby');h.click('#settings-lobby');
 const quality=h.d.querySelector<HTMLSelectElement>('#arena-graphics')!;assert.ok(quality);quality.value='low';quality.dispatchEvent(new h.w.Event('change',{bubbles:true}));
 assert.deepEqual(h.qa.graphics,['low']);assert.equal(h.w.localStorage.getItem('parhelion-arena-graphics-v2'),'low');assert.equal(new URL(h.w.location.href).searchParams.has('low'),true);
 quality.value='high';quality.dispatchEvent(new h.w.Event('change',{bubbles:true}));assert.deepEqual(h.qa.graphics,['low','high']);assert.equal(new URL(h.w.location.href).searchParams.has('low'),false);assert.equal(h.w.localStorage.getItem('parhelion-arena-graphics-v2'),'high');assert.equal(h.w.localStorage.getItem('arena-lobby'),before);assert.equal((h.d.getElementById('name')as HTMLInputElement).value,'Keep graphics name');assert.equal(h.qa.offline,0);
}finally{h.dom.window.close()}});
