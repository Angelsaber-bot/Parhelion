import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';
import {PARALLAX as P} from '../src/story/parallaxSurvey';
test('production garden records facing views, rejects distant decisions and saves an optional correction',async()=>{
 const h=await bootWorldWithoutGpu({deterministic:true}),w=h.world,d=h.window.document;let time=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(time+=1000/60);};
 const key=(code:string)=>{for(const type of ['keydown','keyup'])d.body.dispatchEvent(new h.window.KeyboardEvent(type,{code,key:code==='Escape'?'Escape':code.slice(3).toLowerCase(),bubbles:true,cancelable:true}));};
 const approach=(id:string,face=true)=>{const m=w.layout.markers.find((m:any)=>m.id===id)!;w.player.teleport(m.p[0],m.p[1]+.1,m.p[2]+(id===P.board?1.1:0));w.player.yaw=face?Math.atan2(w.player.pos.x-w.parallaxGarden.subject[0],w.player.pos.z-w.parallaxGarden.subject[2]):Math.PI;w.player.pitch=0;frame(70);assert.ok(w.player.onGround);};
 const closeDialogue=()=>{for(let i=0;i<40&&w.narrative.open;i++)key('KeyF');assert.equal(w.narrative.open,false);};
 const read=()=>{for(let i=0;i<40&&d.getElementById('world-dialogue-choices')!.hidden;i++)key('KeyF');assert.equal(d.getElementById('world-dialogue-choices')!.hidden,false);};
 try{d.getElementById('start')!.click();await Promise.resolve();
 approach(P.front);key('KeyF');assert.equal(w.done.has(P.front),false);approach(P.board);key('KeyF');assert.ok(w.done.has(P.started));closeDialogue();
 approach(P.front);key('KeyF');assert.equal(w.done.has(P.front),false,'misaligned instrument cannot be recorded');
 approach(P.near);key('KeyF');approach(P.far);key('KeyF');key('KeyF');
 approach(P.front,false);key('KeyF');assert.equal(w.done.has(P.front),false);approach(P.front);key('KeyF');assert.ok(w.done.has(P.front),'front view can be recorded with production camera');approach(P.side);key('KeyF');assert.ok(w.done.has(P.side));
 assert.equal(w.parallaxGarden.root.getObjectByName('Campaign_alpha_resolved').visible,true,'verified readings light the board');assert.equal(w.parallaxGarden.root.getObjectByName('Parallax_Near_Ring').rotation.y,0);assert.equal(w.parallaxGarden.root.getObjectByName('Parallax_Far_Ring').rotation.y,0);
 approach(P.board);key('KeyF');read();d.querySelector<HTMLButtonElement>('[data-choice="vanished"]')!.click();assert.equal(w.done.has(P.complete),false);closeDialogue();
 approach(P.board);key('KeyF');read();w.player.teleport(-110,10,300);d.querySelector<HTMLButtonElement>('[data-choice="perspective"]')!.click();assert.equal(w.done.has(P.complete),false);
 approach(P.board);key('KeyF');read();d.querySelector<HTMLButtonElement>('[data-choice="perspective"]')!.click();assert.ok(w.done.has(P.complete));assert.ok(JSON.parse(h.window.localStorage.getItem('parhelion.world.progress.v2')!).done.includes(P.complete));assert.equal(w.done.has('armory_rack'),false);assert.equal(w.done.has('summon_circle'),false);
 closeDialogue();approach(P.board);key('KeyF');read();d.querySelector<HTMLButtonElement>('[data-choice="replay"]')!.click();assert.ok(w.done.has(P.complete),'replay keeps earned cosmetic');assert.ok(w.done.has(P.experiment));assert.equal(w.parallaxGarden.root.getObjectByName('Campaign_alpha_resolved').visible,false);assert.equal(w.done.has(P.front),false);closeDialogue();assert.notEqual(w.parallaxGarden.root.getObjectByName('Parallax_Near_Ring').rotation.y,0);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});
