import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createNarrativePanel, type NarrativeChoice } from '../src/narrativePanel';
import { createCampaignJournal } from '../src/campaignJournal';
import { setLanguage } from '../../shared-client/i18n';
import { CAMPAIGN_EPISODES as D, CAMPAIGN_REGIONS as R, campaignEpisodeFlags as flags, getCampaignDispatchState, getCampaignDispatchText, chooseCampaignEpisode as choose, interactCampaignEpisode as interact, getCampaignEpisodeGuide as guide } from '../src/campaignEpisodes';
const options: NarrativeChoice[] = [{id:'one',label:['一','One']},{id:'two',label:['二','Two']}];
function fixture() {
 const old = new Map(['document','getComputedStyle'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const dom=new JSDOM('<!DOCTYPE html><body><button id="opener">open</button></body>',{pretendToBeVisual:true});
 Object.defineProperty(globalThis,'document',{configurable:true,value:dom.window.document});
 Object.defineProperty(globalThis,'getComputedStyle',{configurable:true,value:dom.window.getComputedStyle.bind(dom.window)});setLanguage('zh');
 return{dom,document:dom.window.document,close(){setLanguage('zh');dom.window.close();for(const[key,value]of old){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}};
}
test('choices never implicitly select; explicit selection survives language change and confirms exactly once',()=>{
 const f=fixture(),panel=createNarrativePanel(()=> 'F'),calls:string[]=[];
 try{panel.showChoices(['决定','Decide'],['人','Person'],options,id=>calls.push(id));
 assert.equal(panel.choosing,true);for(let i=0;i<5;i++)panel.advance();assert.deepEqual(calls,[]);assert.equal(panel.open,true);
 assert.equal(panel.selectChoice(-1),false);assert.equal(panel.selectChoice(NaN),false);assert.equal(panel.selectChoice(9),false);
 panel.selectChoice(1);setLanguage('en');const buttons=f.document.querySelectorAll<HTMLButtonElement>('#world-dialogue-choices button');
 assert.equal(buttons[1].getAttribute('aria-pressed'),'true');assert.match(buttons[1].textContent!,/Two/);panel.advance();panel.advance();assert.deepEqual(calls,['two']);assert.equal(panel.open,false);
 }finally{panel.dispose();f.close();}
});
test('pages must be read before selection, and dismissal/replacement/disposal invalidates all callbacks',()=>{
 const f=fixture(),panel=createNarrativePanel(()=> 'F'),calls:string[]=[];
 try{const line:[string,string]=['甲'.repeat(90)+'\n乙'.repeat(40),'A'.repeat(300)+'\nB'.repeat(40)];panel.showChoices(line,['人','Person'],options,id=>calls.push(id));
 assert.equal(panel.choosing,false);assert.equal(panel.selectChoice(0),false);for(let i=0;i<100&&!panel.choosing;i++)panel.advance();assert.equal(panel.choosing,true);
 panel.moveChoice(-1);assert.equal(f.document.querySelectorAll('#world-dialogue-choices button')[1].getAttribute('aria-pressed'),'true');
 const stale=f.document.querySelector<HTMLButtonElement>('#world-dialogue-choices button')!;panel.hide();stale.click();panel.advance();assert.deepEqual(calls,[]);
 panel.showChoices(['新','New'],['人','Person'],options,id=>calls.push(id));stale.click();assert.deepEqual(calls,[],'detached old controls cannot act on replacement dialog');
 panel.selectChoice(0);panel.show(['普通','Ordinary']);panel.advance();assert.deepEqual(calls,[]);
 panel.showChoices(['新','New'],['人','Person'],options,id=>calls.push(id));panel.selectChoice(0);panel.dispose();panel.advance();assert.deepEqual(calls,[]);
 }finally{panel.dispose();f.close();}
});
test('callback can replace dialog; detached double clicks cannot confirm the newly opened dialog',()=>{
 const f=fixture(),panel=createNarrativePanel(()=> 'F'),calls:string[]=[];
 try{panel.showChoices(['一','One'],['人','Person'],options,id=>{calls.push(id);panel.showChoices(['二','Two'],['人','Person'],options,id=>calls.push(id));});
 const button=f.document.querySelector<HTMLButtonElement>('#world-dialogue-choices button')!;button.click();button.click();assert.deepEqual(calls,['one']);assert.equal(panel.open,true);
 panel.advance();assert.deepEqual(calls,['one']);panel.moveChoice(1);panel.advance();assert.deepEqual(calls,['one','one']);
 }finally{panel.dispose();f.close();}
});
test('journal reads no progress, has five episodes, tracks only an explicit action and restores focus',()=>{
 const f=fixture(),done=new Set<string>(),pins:string[]=[];let opened=0,closed=0,main=0;
 const panel=createCampaignJournal({done:()=>done,onOpen:()=>{opened++;},onClose:()=>{closed++;},pin:r=>{pins.push(r);},restoreMain:()=>{main++;}});
 try{const opener=f.document.getElementById('opener')!;opener.focus();panel.show();panel.show();assert.equal(opened,1);assert.equal(panel.open,true);assert.equal(f.document.querySelectorAll('[data-campaign-entry]').length,5);assert.equal(done.size,0);assert.deepEqual(pins,[]);
 setLanguage('en');assert.match(f.document.getElementById('world-campaign-journal-title')!.textContent!,/Chronicles/);
 f.document.querySelector<HTMLButtonElement>('[data-campaign-region="winter"]')!.click();assert.deepEqual(pins,['winter']);assert.equal(done.size,0);assert.equal(panel.open,false);assert.equal(closed,1);assert.equal(f.document.activeElement,opener);
 panel.show();f.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(panel.open,false);assert.equal(closed,2);assert.deepEqual(pins,['winter']);
 panel.show();f.document.querySelector<HTMLButtonElement>('[data-journal-action="main"]')!.click();assert.equal(main,1);assert.equal(panel.open,false);
 panel.dispose();panel.show();assert.equal(panel.open,false);
 }finally{panel.dispose();f.close();}
});
test('journal traps focus, preserves focused region on translation, and honors rejected open/pin',()=>{
 const f=fixture();let allowed=false;
 const panel=createCampaignJournal({done:()=>new Set(),onOpen:()=>allowed,pin:()=>false,restoreMain(){}});
 try{panel.show();assert.equal(panel.open,false);allowed=true;panel.show();const first=f.document.querySelector<HTMLButtonElement>('[data-campaign-region="alpha"]')!;first.focus();setLanguage('en');assert.equal((f.document.activeElement as HTMLElement).dataset.campaignRegion,'alpha');
 const close=f.document.querySelector<HTMLButtonElement>('[data-journal-action="close"]')!;close.focus();f.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal((f.document.activeElement as HTMLElement).dataset.campaignRegion,'alpha');
 f.document.querySelector<HTMLButtonElement>('[data-campaign-region="alpha"]')!.click();assert.equal(panel.open,true);
 }finally{panel.dispose();f.close();}
});
test('unified final dispatch is explicit, branch-reflective, legacy-safe and one-time',()=>{
 for(const ending of['dispatch_share','dispatch_private']){const done=new Set<string>();assert.equal(getCampaignDispatchState(done),'waiting');assert.equal(choose('alpha',ending,done).changed,false);
 for(const[r,i]of R.map((r,i)=>[r,i]as const)){done.add(flags(r).complete);done.add(flags(r).choice(D[r].choices[i%2].id));}
 assert.equal(getCampaignDispatchState(done),'ready');assert.equal(guide('alpha',done)?.targetId,D.alpha.decision);const offered=interact(D.alpha.decision,done);assert.equal(offered.choices?.length,2);assert.equal(offered.changed,false);
 assert.equal(choose('britain',ending,done).changed,false);assert.equal(choose('alpha','dispatch_invalid',done).changed,false);
 assert.equal(choose('alpha',ending,done).changed,true);assert.equal(getCampaignDispatchState(done),'recorded');assert.equal(guide('alpha',done),null);
 for(const r of R){const chosen=D[r].choices.find(c=>done.has(flags(r).choice(c.id)))!;assert.ok(getCampaignDispatchText(done)[1].includes(chosen.ending[1]));}
 const before=[...done];assert.equal(choose('alpha',ending,done).changed,false);assert.equal(interact(D.alpha.decision,done).changed,false);assert.deepEqual([...done],before);
 }
});

test('arc journal tracking is explicit, route-gated, read-only and retains keyboard focus on language change',()=>{
 const f=fixture(),done=new Set<string>();let pinned=0,blocked=true;
 const panel=createCampaignJournal({done:()=>done,onOpen(){},pin(){},restoreMain(){},pinArc(){pinned++;},arcTrackingBlocked:()=>blocked?['先稳定召唤阵','Stabilize the summoning circle first']:null});
 try{panel.show();assert.equal(f.document.querySelectorAll('[data-false-dawn-entry]').length,1);const before=[...done];let button=f.document.querySelector<HTMLButtonElement>('[data-false-dawn-track]')!;assert.equal(button.disabled,true);button.click();assert.equal(pinned,0);assert.equal(panel.open,true);
 blocked=false;panel.refresh();button=f.document.querySelector<HTMLButtonElement>('[data-false-dawn-track]')!;button.focus();setLanguage('en');assert.ok((f.document.activeElement as HTMLElement).hasAttribute('data-false-dawn-track'));assert.deepEqual([...done],before);f.document.querySelector<HTMLButtonElement>('[data-false-dawn-track]')!.click();assert.equal(pinned,1);assert.equal(panel.open,false);assert.deepEqual([...done],before);
 }finally{panel.dispose();f.close();}
});
test('choice group explicitly overrides inherited noninteractive HUD CSS and provides bounded overflow',()=>{
 const f=fixture(),panel=createNarrativePanel(()=> 'Digit1');
 try{panel.showChoices(['选择','Choose'],['人','Person'],options,()=>{});const group=f.document.getElementById('world-dialogue-choices')!;assert.equal(group.style.pointerEvents,'auto');assert.equal(group.style.overflowY,'auto');assert.equal(group.style.maxHeight,'30vh');assert.match(f.document.getElementById('world-dialogue-hint')!.textContent!,/Digit1/);setLanguage('en');assert.equal(group.getAttribute('aria-label'),'Choose your action');}
 finally{panel.dispose();f.close();}
});

test('choice dialogs bound text and container height, reveal keyboard selection and reset scroll on replacement',()=>{
 const f=fixture(),panel=createNarrativePanel(()=> 'F');let scrolled=0;
 const old=f.dom.window.HTMLElement.prototype.scrollIntoView;f.dom.window.HTMLElement.prototype.scrollIntoView=function(){scrolled++;};
 try{panel.showChoices(['选择','Choose'],['人','Person'],options,()=>{});const root=f.document.getElementById('world-dialogue')!,text=f.document.getElementById('world-dialogue-text')!;assert.equal(root.style.maxHeight,'84vh');assert.equal(root.style.overflowY,'auto');assert.equal(text.style.maxHeight,'min(30vh, 220px)');panel.selectChoice(1);assert.equal(scrolled,1);root.scrollTop=120;panel.show(['短句','Short line']);assert.equal(root.scrollTop,0);assert.equal(text.style.maxHeight,'min(42vh, 320px)');root.scrollTop=120;panel.hide();assert.equal(root.scrollTop,0);}
 finally{f.dom.window.HTMLElement.prototype.scrollIntoView=old;panel.dispose();f.close();}
});

test('detached chronicle/arc/dispatch controls cannot alter tracking or close a replacement journal',()=>{
 const f=fixture(),done=new Set<string>();for(const r of R){done.add(flags(r).complete);done.add(flags(r).choice(D[r].choices[0].id));}let pins=0,arcs=0;
 const panel=createCampaignJournal({done:()=>done,onOpen(){},pin(){pins++;},restoreMain(){},pinArc(){arcs++;}});
 try{panel.show();const oldArc=f.document.querySelector<HTMLButtonElement>('[data-false-dawn-track]')!,oldChronicle=f.document.querySelector<HTMLButtonElement>('[data-campaign-region="alpha"]')!,oldDispatch=f.document.querySelector<HTMLButtonElement>('[data-campaign-dispatch-track]')!;
 setLanguage('en');for(const button of[oldArc,oldChronicle,oldDispatch])button.click();assert.equal(pins,0);assert.equal(arcs,0);assert.equal(panel.open,true);
 const next=[...f.document.querySelectorAll<HTMLButtonElement>('[data-false-dawn-track],[data-campaign-region="alpha"],[data-campaign-dispatch-track]')];panel.hide();panel.show();for(const button of next)button.click();assert.equal(pins,0);assert.equal(arcs,0);assert.equal(panel.open,true);
 f.document.querySelector<HTMLButtonElement>('[data-campaign-dispatch-track]')!.click();assert.equal(pins,1);assert.equal(panel.open,false);
 }finally{panel.dispose();f.close();}
});
test('focused dialogue choice survives locale refresh and follows explicit keyboard selection without committing',()=>{
 const f=fixture(),panel=createNarrativePanel(()=> 'Mouse4');let commits=0;
 try{panel.showChoices(['决定','Decide'],['人','Person'],options,()=>commits++);
 f.document.querySelector<HTMLButtonElement>('[data-choice="one"]')!.focus();setLanguage('en');
 assert.equal((f.document.activeElement as HTMLElement).dataset.choice,'one','translation keeps focus inside the current dialogue');
 panel.moveChoice(-1);assert.equal((f.document.activeElement as HTMLElement).dataset.choice,'two','focused option follows explicit selection');
 assert.equal(commits,0);panel.advance();assert.equal(commits,1);
 }finally{panel.dispose();f.close();}
});
