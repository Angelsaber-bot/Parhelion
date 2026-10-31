/** Actual Arena main/index menu logic. Rendering, game/session creation and audio
 * are explicit boundary spies: no WebGL/network/simulation acceptance claim. */
import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{resolve}from'node:path';import{build}from'esbuild';import{JSDOM}from'jsdom';
test('Arena actual menu mode/team/Bot/locale/custom-key edits update truthful brief without starting a session',async()=>{
 const root=resolve(process.env.ARENA_SOURCE_QA_ROOT??'../arena-game');const dom=new JSDOM(readFileSync(resolve(root,'index.html'),'utf8'),{url:'https://arena.test/',pretendToBeVisual:true,runScripts:'outside-only'}),w=dom.window,d=w.document;
 const calls={scene:0,map:0,render:0,offline:0,online:0,game:0,network:0,dispose:0};(w as any).__calls=calls;
 w.requestAnimationFrame=()=>1;(w as any).matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});(w as any).fetch=()=>{calls.network++;throw Error('unexpected network');};(w as any).WebSocket=class{constructor(){calls.network++;throw Error('unexpected socket');}};
 const mocks:Record<string,string>={
  'scene.ts':`export class ArenaScene{constructor(){window.__calls.scene++}async loadMap(){window.__calls.map++}setView(){}render(){window.__calls.render++}disposeCombatEffects(){window.__calls.dispose++}}`,
  'game.ts':`export class Game{constructor(){window.__calls.game++}}`,
  'session.ts':`export function startOffline(){window.__calls.offline++;throw Error('unexpected start')}export async function joinOnline(){window.__calls.online++;throw Error('unexpected join')}`,
  'audio.ts':`export const sfx={unlock(){}}`,
  'armory.ts':`export function openArmory(){throw Error('not under test')}`,
 };
 const output=await build({entryPoints:[resolve(root,'src/main.ts')],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',loader:{'.webp':'dataurl','.css':'empty'},plugins:[{name:'menu-boundaries',setup(b){b.onResolve({filter:/\.\/(scene|game|session|audio|armory)\.ts$/},a=>({path:a.path.slice(2),namespace:'qa-menu-boundary'}));b.onLoad({filter:/.*/,namespace:'qa-menu-boundary'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
 try{w.eval(output.outputFiles[0].text);await Promise.resolve();
  const change=(id:string,value:string|boolean)=>{const el=d.getElementById(id)as HTMLInputElement;if(typeof value==='boolean')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
  const locale=d.querySelector<HTMLSelectElement>('.parhelion-language select')!;const language=(value:string)=>{locale.value=value;locale.dispatchEvent(new w.Event('change',{bubbles:true}));};
  language('en');change('layout','1v2');change('team','B');assert.match(d.getElementById('match-teams')!.textContent!,/West\/Cyan 1 \/ East\/Orange 2/);assert.match(d.getElementById('match-teams')!.textContent!,/You join East\/Orange/);assert.match(d.getElementById('match-connection')!.textContent!,/pauses the entire offline match/);
  (d.querySelector('[data-mode="online"]')as HTMLButtonElement).click();change('bots',false);assert.match(d.getElementById('match-connection')!.textContent!,/No Bots/);assert.match(d.getElementById('pause-title')!.textContent!,/Match continues/);assert.match(d.getElementById('match-teams')!.textContent!,/full team may place you/);
  change('bots',true);assert.match(d.getElementById('match-connection')!.textContent!,/Bots fill empty seats/);change('team','A');assert.match(d.getElementById('match-teams')!.textContent!,/Preference: West\/Cyan/);
  const baselineNodes=d.querySelectorAll('*').length;for(let i=0;i<20;i++){language(i%2?'en':'zh');assert.equal(d.querySelectorAll('*').length,baselineNodes);assert.match(d.getElementById('pause-title')!.textContent!,i%2?/Match continues/:/对局仍在继续/);}
  language('en');const settings=(w as any).arena.controls.settings;assert.equal(settings.bind('dash','KeyU',true),null);assert.ok(d.getElementById('control-hints')!.textContent!.includes(`${settings.label('dash')} Dash`),'custom primary and retained secondary keys are shown');
  (d.querySelector('[data-mode="offline"]')as HTMLButtonElement).click();assert.equal(d.getElementById('pause-title')!.textContent,'Paused');assert.match(d.getElementById('control-hints')!.textContent!,/Esc Pause/);assert.equal((w as any).game,undefined);
  assert.deepEqual({...calls,scene:0,map:0,render:0},{scene:0,map:0,render:0,offline:0,online:0,game:0,network:0,dispose:0});assert.equal(calls.map,1,'locale/menu changes never reload the map');
  w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:true}));assert.equal(calls.dispose,0,'BFCache preserves reusable resources');w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:false}));assert.equal(calls.dispose,1,'final page exit releases effect pool');
 }finally{dom.window.close();}
});
