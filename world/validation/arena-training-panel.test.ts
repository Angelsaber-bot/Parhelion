import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {createArenaTrainingPanel} from '../src/arenaTrainingPanel';import {setLanguage} from '../../shared-client/i18n';
test('practice entry is fixed, save-gated, explicit and invalid after close/dispose',()=>{
 const dom=new JSDOM('<body><button id="open">open</button></body>',{url:'https://example.test/world/',pretendToBeVisual:true});
 const old=new Map(['document','HTMLElement'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const k of old.keys())Object.defineProperty(globalThis,k,{configurable:true,value:(dom.window as any)[k]});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new dom.window.Event('close'));};
 let allowed=true,saved=false,saves=0;const panel=createArenaTrainingPanel({worldKey:a=>`W-${a}`,arenaKey:a=>`A-${a}`,canOpen:()=>allowed,beforeLeave:()=>{saves++;return saved;}});
 try{const d=dom.window.document;d.getElementById('open')!.focus();assert.equal(panel.show(),true);assert.match(panel.root.textContent!,/W-reset/);assert.match(panel.root.textContent!,/A-reload/);
 const link=d.querySelector<HTMLAnchorElement>('#arena-training-new-tab')!;assert.equal(link.href,'https://example.test/arena/?mode=offline');assert.equal(link.target,'_blank');assert.match(link.rel,/noopener/);
 const click=()=>{const e=new dom.window.MouseEvent('click',{bubbles:true,cancelable:true});link.dispatchEvent(e);return e.defaultPrevented;};assert.equal(click(),true);assert.equal(saves,1);assert.match(panel.root.textContent!,/未离开/);
 saved=true;assert.equal(click(),false);assert.equal(saves,2);setLanguage('en');assert.match(panel.root.textContent!,/Controls are saved separately/);assert.match(panel.root.textContent!,/Fallback: save/);
 panel.hide();assert.equal(d.activeElement,d.getElementById('open'));assert.equal(click(),true);assert.equal(saves,2);allowed=false;assert.equal(panel.show(),false);panel.dispose();assert.equal(click(),true);
 }finally{panel.dispose();setLanguage('zh');dom.window.close();for(const[k,v]of old){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}}
});
