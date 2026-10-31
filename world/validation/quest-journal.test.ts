import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createQuestJournal} from '../src/questJournal';
import type {QuestEntry} from '../src/questGuideCatalog';
import {setLanguage} from '../../shared-client/i18n';
const entry=(id='main:alpha'):QuestEntry=>({id,region:'alpha',category:'main',title:['主线测试','Main test'],complete:false,guide:{title:['主线测试','Main test'],text:['到记录员身边交谈。','Speak with the archivist.'],targetId:'archivist',targetKind:'npc',region:'alpha',position:[3,0,4],targetLabel:['记录员','Archivist']}});
function fixture(){const old=new Map(['document','getComputedStyle'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));const dom=new JSDOM('<!doctype html><body><button id="opener">open</button><button id="other">other</button></body>',{pretendToBeVisual:true});Object.defineProperty(globalThis,'document',{configurable:true,value:dom.window.document});Object.defineProperty(globalThis,'getComputedStyle',{configurable:true,value:dom.window.getComputedStyle.bind(dom.window)});setLanguage('zh');return{dom,d:dom.window.document,close(){setLanguage('zh');dom.window.close();for(const[k,v]of old){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}}};}
test('read-only journal shows concrete target/distance; locale retains focus and stale controls cannot pin',()=>{
 const f=fixture();let entries=[entry()],pins:string[]=[],closed=0,allowed=true;
 const panel=createQuestJournal({entries:()=>entries,pin:id=>{pins.push(id);return allowed},restoreMain(){},onOpen(){f.d.getElementById('other')!.focus()},onClose(){closed++},currentRegion:()=> 'alpha',position:()=>[0,0,0]});
 try{f.d.getElementById('opener')!.focus();panel.show();assert.equal(panel.open,true);assert.deepEqual(pins,[]);assert.match(f.d.querySelector('.quest-target')!.textContent!,/5 米/);
 const stale=f.d.querySelector<HTMLButtonElement>('[data-quest-track]')!;stale.focus();setLanguage('en');assert.equal((f.d.activeElement as HTMLElement).dataset.questTrack,'main:alpha');assert.match(f.d.querySelector('.quest-target')!.textContent!,/5 m straight-line/);stale.click();assert.deepEqual(pins,[]);
 const current=f.d.querySelector<HTMLButtonElement>('[data-quest-track]')!;allowed=false;current.click();assert.equal(panel.open,true);assert.deepEqual(pins,['main:alpha']);
 entries=[{...entry(),complete:true,guide:null}];current.click();assert.equal(pins.length,1,'revalidate actual current facts, even before refresh');panel.refresh();assert.equal(f.d.querySelectorAll('[data-quest-track]').length,0);
 f.d.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(panel.open,false);assert.equal(f.d.activeElement,f.d.getElementById('opener'));assert.equal(closed,1);
 entries=[entry()];panel.show();current.click();assert.equal(pins.length,1,'retained controls from previous opening stay invalid');panel.dispose();current.click();assert.equal(pins.length,1);
 }finally{panel.dispose();f.close()}
});
test('gate explanation, filter controls, focus trap and explicit story-link do not remotely mutate progress',()=>{
 const f=fixture();let main=0,stories=0,closed=0;
 const remote={...entry('main:winter'),region:'winter' as const,guide:{...entry().guide!,region:'winter' as const}};
 const panel=createQuestJournal({entries:()=>[entry(),remote],pin:()=>assert.fail('blocked'),restoreMain:()=>main++,onOpen(){},onClose:()=>closed++,currentRegion:()=> 'alpha',position:()=>[0,0,0],trackingBlocked:g=>g.region==='winter'?['先稳定召唤阵。','Stabilize the summoning circle first.']:null,openChronicles:()=>stories++});
 try{panel.show();const region=f.d.querySelector<HTMLSelectElement>('#world-quest-journal select')!;region.value='all';region.dispatchEvent(new f.dom.window.Event('change'));
 const track=f.d.querySelector<HTMLButtonElement>('[data-quest-track="main:winter"]')!;assert.equal(track.disabled,true);assert.match(track.closest('article')!.textContent!,/先稳定召唤阵/);
 const buttons=[...f.d.querySelectorAll<HTMLButtonElement>('#world-quest-journal button')];buttons[0].focus();const browserTab=new f.dom.window.KeyboardEvent('keydown',{key:'Tab',ctrlKey:true,bubbles:true,cancelable:true});f.d.dispatchEvent(browserTab);assert.equal(browserTab.defaultPrevented,false,'browser tab shortcut is not trapped');f.d.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal((f.d.activeElement as HTMLElement).dataset.questTrack,'main:alpha');
 buttons[2].click();assert.equal(stories,1);assert.equal(closed,1);assert.equal(main,0);panel.show();(f.d.querySelectorAll('#world-quest-journal button')[1]as HTMLButtonElement).click();assert.equal(main,1);assert.equal(panel.open,false);
 }finally{panel.dispose();f.close()}
});
test('rejected modal admission stays closed and uses scrollable, wrapping small-window contract',()=>{
 const f=fixture();const panel=createQuestJournal({entries:()=>[entry()],pin(){},restoreMain(){},onOpen:()=>false,onClose:()=>assert.fail('not opened'),currentRegion:()=> 'alpha',position:()=>[0,0,0]});
 try{panel.show();assert.equal(panel.open,false);const root=f.d.getElementById('world-quest-journal')!;assert.equal(root.style.overflow,'auto');assert.equal(root.getAttribute('aria-modal'),'true');assert.equal(root.style.position,'fixed');}finally{panel.dispose();f.close()}
});
