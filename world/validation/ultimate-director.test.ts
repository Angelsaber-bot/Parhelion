import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { UltimateClock, UltimateDirector, ULTIMATE_MODE_KEY, type UltimateMode } from '../src/ultimateDirector';
import { setLanguage } from '../../shared-client/i18n';
function advance(clock: { tick(dt: number): void }, seconds: number) { for (let i = 0; i < Math.round(seconds * 100); i++) clock.tick(.01); }
function fixture(options: ConstructorParameters<typeof UltimateDirector>[0] = {}) {
  const dom = new JSDOM('<body><button id="before">Before</button><div class="hud" style="display:none">Hidden HUD</div></body>', { url: 'https://example.com' });
  const director = new UltimateDirector({ document: dom.window.document, storage: null, ...options });
  return { dom, director, close() { director.dispose(); dom.window.close(); } };
}
test('pure full clock gates release, never auto-completes the real action, then bounded outro', () => {
  const clock = new UltimateClock(); assert.equal(clock.begin('saber', 'full'), true); assert.equal(clock.begin('musashi', 'off'), false);
  advance(clock, .65); assert.equal(clock.frame?.phase, 'charge'); advance(clock, 1.9); assert.equal(clock.releasing, true);
  advance(clock, 30); assert.equal(clock.releasing, true); clock.complete(); assert.equal(clock.frame?.phase, 'outro'); advance(clock, .45); assert.equal(clock.active, false);
});
test('short, off, skip all retain the original transaction until complete', () => {
  for (const mode of ['full', 'short', 'off'] as UltimateMode[]) {
    const clock = new UltimateClock(); clock.begin('blackbeard', mode); if (mode === 'short') { advance(clock, .25); assert.equal(clock.releasing, true); }
    clock.skip(); assert.equal(clock.releasing, true); assert.equal(clock.showing, false); assert.equal(clock.frame?.identity, 'blackbeard');
    clock.complete(); assert.equal(clock.active, false);
  }
});
test('pause, invalid delta and stalls cannot advance or produce catch-up bursts; contacts decay', () => {
  const clock = new UltimateClock(); clock.begin('musashi', 'full'); const initial = clock.frame;
  clock.tick(200, true); clock.tick(NaN); clock.tick(Infinity); clock.tick(-1); assert.deepEqual(clock.frame, initial);
  clock.tick(1000); assert.equal(clock.frame?.elapsed, .1); clock.notifyStrike(); assert.equal(clock.frame?.pulse, 0);
  clock.skip(); clock.notifyStrike(); assert.equal(clock.frame?.pulse, 1); clock.tick(.1,true); assert.equal(clock.frame?.pulse, 1); clock.tick(.1); assert.ok(clock.frame!.pulse < 1);
});
test('DOM full mode focus, input capture, skip once, focus restoration and HUD styles survive', () => {
  let releases = 0, ends = 0, gameplay = 0;
  const f = fixture({ onRelease: () => releases++, onEnd: () => ends++ }); const { director: d, dom } = f;
  const before = dom.window.document.querySelector<HTMLButtonElement>('#before')!; before.focus();
  dom.window.document.addEventListener('keydown', () => gameplay++);
  assert.equal(d.begin('saber'), true); assert.equal(d.begin('saber'), false);
  assert.equal(dom.window.document.body.classList.contains('ultimate-showing'),true); assert.equal(d.overlay.hidden,false);
  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key:'w', bubbles:true,cancelable:true })); assert.equal(gameplay,0);
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key:'Escape', bubbles:true,cancelable:true }));
  assert.equal(d.active,true); assert.equal(d.showing,false); assert.equal(releases,1);
  d.skip(); assert.equal(releases,1); d.complete(); assert.equal(ends,1); assert.equal(dom.window.document.activeElement,before);
  assert.equal(dom.window.document.querySelector<HTMLElement>('.hud')!.style.display,'none'); assert.equal(dom.window.document.body.classList.contains('ultimate-showing'),false);
  f.close();
});
test('click, Space and Enter skip; repeated casts and disposal leak no ownership or handlers', () => {
  const f = fixture(); const d = f.director;
  for (const key of [' ', 'Enter', 'click']) {
    d.begin('musashi'); if (key === 'click') d.overlay.querySelector('button')!.click();
    else f.dom.window.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
    assert.equal(d.releasing,true); d.complete(); assert.equal(d.active,false);
  }
  d.begin('saber'); d.dispose(); d.dispose(); assert.equal(d.active,false); assert.equal(d.begin('saber'),false); assert.equal(f.dom.window.document.querySelector('.ultimate-overlay'),null);
  let received = false; f.dom.window.document.addEventListener('keydown',()=>received=true);
  f.dom.window.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'w',bubbles:true})); assert.equal(received,true); f.close();
});
test('mode storage defaults, denied storage, reduced motion, next-cast preference and bilingual titles', () => {
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  const f = fixture({ reducedMotion: true, storage: denied }); const d=f.director;
  assert.equal(d.mode,'short'); d.setMode('full'); d.begin('napoleonMounted'); d.setMode('off'); assert.equal(d.showing,true);
  setLanguage('en',undefined); assert.equal(d.overlay.querySelector('h2')!.textContent,'Imperial Cavalry');
  setLanguage('zh',undefined); assert.equal(d.overlay.querySelector('h2')!.textContent,'帝国铁骑');
  d.abort(); d.begin('blackbeard'); assert.equal(d.showing,false); assert.equal(d.releasing,true); d.complete(); f.close();
  const saved = fixture({ reducedMotion:true, storage:{ getItem(key) { assert.equal(key,ULTIMATE_MODE_KEY); return 'full'; }, setItem() {} } }); assert.equal(saved.director.mode,'full'); saved.close();
});
test('pause freezes outro, abort is immediate, disconnected focus is safe', () => {
  const f=fixture(); const d=f.director; d.begin('saber'); advance(d,2.55); advance(d,1.4); d.notifyStrike(); d.complete(); const frame=d.frame;
  d.tick(10,true); assert.deepEqual(d.frame,frame); advance(d,1.25); assert.equal(d.active,false);
  const before=f.dom.window.document.querySelector<HTMLButtonElement>('#before')!; before.focus(); d.begin('saber'); before.remove(); d.abort(); assert.equal(d.active,false); assert.equal(d.showing,false); f.close();
});

test('full mode keeps the completed pose until nominal 5.2s without delaying or adding contacts', () => {
  const clock=new UltimateClock(); clock.begin('saber','full'); advance(clock,2.55); assert.equal(clock.releasing,true);
  advance(clock,1.4); clock.complete(); assert.equal(clock.frame?.phase,'outro'); advance(clock,1.24); assert.equal(clock.active,true); clock.tick(.01); assert.equal(clock.active,false);
});

test('code-only skip keys and repeated keydowns release the accepted cast exactly once', () => {
  for (const code of ['Space','Escape','Enter']) {
    let releases=0; const f=fixture({onRelease:()=>releases++}); const d=f.director; d.begin('saber');
    const press=(repeat=false)=>f.dom.window.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{code,repeat,bubbles:true,cancelable:true}));
    press(true); assert.equal(d.showing,true); assert.equal(releases,0);
    press(); press(); press(true); d.skip(); assert.equal(releases,1); assert.equal(d.active,true); assert.equal(d.showing,false);
    assert.equal(d.begin('musashi'),false); d.complete(); assert.equal(d.active,false); f.close();
  }
});
test('native modifier shortcuts remain uncancelled and never skip or re-release a cast', () => {
  let releases=0; const f=fixture({onRelease:()=>releases++}); const d=f.director; d.begin('saber');
  for (const modifier of ['metaKey','ctrlKey','altKey']) for (const type of ['keydown','keyup']) {
    const event=new f.dom.window.KeyboardEvent(type,{code:'Enter',key:'Enter',[modifier]:true,bubbles:true,cancelable:true});
    f.dom.window.document.dispatchEvent(event); assert.equal(event.defaultPrevented,false); assert.equal(d.showing,true); assert.equal(releases,0);
  }
  d.skip();
  for (const modifier of ['metaKey','ctrlKey','altKey']) {
    const event=new f.dom.window.KeyboardEvent('keydown',{code:'KeyX',key:'x',[modifier]:true,bubbles:true,cancelable:true});
    f.dom.window.document.dispatchEvent(event); assert.equal(event.defaultPrevented,false); assert.equal(d.active,true); assert.equal(releases,1); assert.equal(d.begin('musashi'),false);
  }
  d.complete(); f.close();
});

test('modified mouse inputs cannot reach remapped settings and abort a paid cast', () => {
  let opens=0, releases=0; const f=fixture({onRelease:()=>releases++}); const d=f.director;
  // Mirrors a downstream Mouse0 → settings binding whose onOpen aborts the cast.
  const openSettings=()=>{opens++;d.abort();};
  f.dom.window.addEventListener('mousedown',openSettings);
  d.begin('saber');
  for(const modifier of ['ctrlKey','metaKey','altKey']) for(const type of ['pointerdown','mousedown','mouseup','click']) {
    const event=new f.dom.window.MouseEvent(type,{button:0,[modifier]:true,bubbles:true,cancelable:true});
    f.dom.window.document.body.dispatchEvent(event); assert.equal(event.defaultPrevented,true); assert.equal(opens,0); assert.equal(d.active,true); assert.equal(d.showing,true);
  }
  d.skip(); assert.equal(releases,1); assert.equal(d.active,true); d.complete(); assert.equal(d.active,false);
  f.dom.window.removeEventListener('mousedown',openSettings); f.close();
});
