'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../runtime/input.js'),{dom}=require('./input_test_support.cjs');
function fixture(){const env=dom(),resets=[],shortcuts=[];let enabled=true;
  const input=create({window:env.win,document:env.doc,view:env.view,isEnabled:()=>enabled,onReset:r=>resets.push(r),onShortcut:k=>shortcuts.push(k)});
  return {...env,input,resets,shortcuts,disable(){enabled=false;}};
}
test('all WASD and arrow keys remain held until keyup; diagonals are independent',()=>{
  const f=fixture(),codes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  codes.forEach(code=>assert.equal(f.key(code).defaultPrevented,true));assert.equal(f.input.keys.size,8);
  for(let now=0;now<10000;now+=16)f.input.beginFrame(now);assert.equal(f.input.keys.size,8);
  codes.forEach(code=>f.up(code));assert.equal(f.input.keys.size,0);
});
const transitions={blur:f=>f.blur(),focus:f=>f.focus(),hidden:f=>f.visibility(true),visible:f=>f.visibility(false),
  'pointer lock acquired':f=>{f.doc.pointerLockElement=f.view;f.doc.emit('pointerlockchange');},
  'pointer lock released':f=>f.doc.exitPointerLock(),'pointer lock error':f=>f.doc.emit('pointerlockerror'),
  pagehide:f=>f.win.emit('pagehide'),pageshow:f=>f.win.emit('pageshow'),freeze:f=>f.doc.emit('freeze'),resume:f=>f.doc.emit('resume'),
  'UI focus':f=>f.nodes.get('tourSelect').focus(),'outside pointer':f=>f.doc.emit('pointerdown',{target:f.nodes.get('west')}),
  Escape:f=>f.key('Escape'),'Ctrl shortcut':f=>f.key('KeyR',{ctrlKey:true}),'Meta shortcut':f=>f.key('MetaLeft',{metaKey:true}),
  'Alt shortcut':f=>f.key('AltLeft',{altKey:true}),'frame suspension':f=>{f.input.beginFrame(0);f.input.beginFrame(1001);},
  'mode reset':f=>f.input.reset('overview'),resize:f=>f.win.emit('resize'),fullscreen:f=>f.doc.emit('fullscreenchange'),contextmenu:f=>f.doc.emit('contextmenu'),pointercancel:f=>f.doc.emit('pointercancel')};
for(const [name,transition] of Object.entries(transitions))test(name+' clears held keys and rejects repeat resurrection',()=>{
  const f=fixture();f.key('KeyW');f.key('ArrowUp');transition(f);assert.equal(f.input.keys.size,0);
  f.focus();f.visibility(false);f.view.focus();f.key('KeyW',{repeat:true});f.key('ArrowUp',{repeat:true});assert.equal(f.input.keys.size,0);
  f.up('KeyW');f.up('ArrowUp');f.key('KeyW');f.key('ArrowUp');assert.equal(f.input.keys.size,2);
});
test('hidden and unfocused windows cannot accept even non-repeat keys',()=>{
  const f=fixture();f.blur();f.key('KeyW');assert.equal(f.input.keys.size,0);f.focus();f.visibility(true);f.key('KeyW');assert.equal(f.input.keys.size,0);
});
for(const kind of ['INPUT','TEXTAREA','SELECT','BUTTON','contenteditable','textbox'])test(kind+' keeps native keyboard behavior',()=>{
  const f=fixture(),el=f.element('edit',kind);if(kind==='contenteditable')el.isContentEditable=true;if(kind==='textbox')el.role='textbox';
  f.key('KeyW');el.focus();assert.equal(f.input.keys.size,0);
  for(const code of ['KeyW','ArrowUp','Digit1','KeyM'])assert.equal(f.key(code).defaultPrevented,undefined);
  assert.equal(f.input.keys.size,0);assert.equal(f.shortcuts.length,0);
});
test('movement disabled in overview/intro; one-shot shortcuts work without pointer lock',()=>{
  const f=fixture();f.disable();f.key('KeyW');assert.equal(f.input.keys.size,0);
  f.key('Digit1');f.key('Digit1',{repeat:true});assert.deepEqual(f.shortcuts,['Digit1']);
});
test('IME and unrelated keys do not become movement; Shift does not disable walking',()=>{
  const f=fixture();f.key('KeyW',{isComposing:true});f.key('Space');assert.equal(f.input.keys.size,0);
  f.key('KeyW',{shiftKey:true});assert.equal(f.input.keys.size,1);
});
test('keyup always releases after focus changes or modifier changes',()=>{
  const f=fixture();f.key('KeyW');f.up('KeyW',{target:f.nodes.get('tourSelect'),ctrlKey:true});assert.equal(f.input.keys.size,0);
});
test('destroy removes listeners and clears state',()=>{
  const f=fixture();f.key('KeyW');f.input.destroy();f.key('KeyW');assert.equal(f.input.keys.size,0);
});
test('captured element blur is not mistaken for window blur',()=>{
  const f=fixture();f.win.emit('blur',{target:f.view});f.key('KeyW');assert.equal(f.input.keys.size,1);
});
test('frame polling stops input if host focus/visibility events were missed',()=>{
  const f=fixture();f.key('KeyW');f.doc.focused=false;f.input.beginFrame(16);assert.equal(f.input.keys.size,0);assert.equal(f.resets.at(-1),'inactive');
  f.focus();f.key('KeyW');f.doc.hidden=true;f.input.beginFrame(32);assert.equal(f.input.keys.size,0);
});
