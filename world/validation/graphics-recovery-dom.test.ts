/** GPU boundary is mocked. These tests establish event/input/state behavior,
 * not successful real graphics restoration, render correctness or device FPS. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('actual World suspends on context loss, rejects stale resume, and requires a fresh click without catch-up or held inputs', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    'parhelion.world.progress.v2': JSON.stringify({ done: ['armory_rack'], found: [] }),
  } });
  const w = h.world, d = h.window.document, canvas = d.getElementById('view') as HTMLCanvasElement;
  let now = 0, renders = 0;
  const render = w.renderer.render.bind(w.renderer); w.renderer.render = (...args: any[]) => { renders++; return render(...args); };
  const frame = (count = 1, dt = 1000 / 60) => { for (let i = 0; i < count; i++) h.frame(now += dt); };
  const key = (code: string, type = 'keydown') => d.body.dispatchEvent(new h.window.KeyboardEvent(type, { code, bubbles: true }));
  const start = async () => { (d.getElementById('start') as HTMLElement).click(); await Promise.resolve(); };
  const event = (name: string) => canvas.dispatchEvent(new h.window.Event(name, { cancelable: true }));
  const snapshot = () => JSON.stringify({ pos: w.player.pos.toArray(), hp: w.combat.state.hp, energy: w.actions.skills.energy,
    enemies: w.combat.state.enemies.map((e: any) => [e.id, e.hp, e.timer, e.mode, e.p.x, e.p.y, e.p.z]) });
  try {
    await start(); frame(60); key('KeyW'); frame(4);
    const saved = h.window.localStorage.getItem('parhelion.world.progress.v2');
    event('webglcontextlost'); assert.equal(w.graphicsRecovery.state, 'lost'); assert.equal(d.pointerLockElement, null);
    const frozen = snapshot(), renderCount = renders;
    event('webglcontextlost'); frame(20, 500);
    assert.equal(snapshot(), frozen); assert.equal(renders, renderCount);
    assert.equal(h.window.localStorage.getItem('parhelion.world.progress.v2'), saved);
    await start(); assert.equal(d.pointerLockElement, null); assert.match(d.getElementById('loading')!.textContent!, /不可用|unavailable/);
    event('webglcontextrestored'); event('webglcontextrestored'); frame(10, 500);
    assert.equal(w.graphicsRecovery.state, 'awaiting-resume'); assert.equal(snapshot(), frozen); assert.equal(renders, renderCount);
    // A lock request begun before loss cannot silently resume after restoration.
    await canvas.requestPointerLock(); assert.equal(d.pointerLockElement, null);
    w.settingsPanel.show(); await start(); assert.equal(w.graphicsRecovery.state, 'awaiting-resume');
    const resolution = d.getElementById('world-resolution') as HTMLSelectElement;
    resolution.value = 'adaptive'; resolution.dispatchEvent(new h.window.Event('change', { bubbles: true }));
    assert.equal(w.graphicsRecovery.state, 'awaiting-resume'); assert.equal(renders, renderCount);
    const navigation: Error[] = [];
    const capture = (error: Error) => navigation.push(error); h.virtualConsole.on('jsdomError', capture);
    const effects = d.getElementById('world-effects-quality') as HTMLSelectElement;
    effects.value = 'med'; effects.closest('.settings-sliders')!.querySelector<HTMLButtonElement>('button')!.click();
    h.virtualConsole.removeListener('jsdomError', capture);
    assert.equal(navigation.length, 1); assert.match(navigation[0].message, /Not implemented: navigation/);
    assert.equal(w.graphicsRecovery.state, 'awaiting-resume'); assert.equal(w.done.has('armory_rack'), true);
    w.settingsPanel.close(); await start(); assert.equal(w.graphicsRecovery.state, 'available'); assert.equal(d.pointerLockElement, canvas);
    const position = w.player.pos.clone(); frame(30);
    assert.ok(w.player.pos.distanceTo(position) < .01, 'Held pre-loss movement was cleared, not replayed');
    assert.ok(renders > renderCount); assert.equal(w.done.has('armory_rack'), true);
    // Existing journal pause intent survives loss/restoration; the browser cannot dismiss it.
    w.campaignJournal.show();assert.equal(w.campaignJournal.open,true);event('webglcontextlost');event('webglcontextrestored');
    assert.equal(w.campaignJournal.open,true);await start();assert.equal(w.graphicsRecovery.state,'awaiting-resume');
    w.campaignJournal.hide();await start();assert.equal(w.graphicsRecovery.state,'available');
    // A queued local-file restore must not show a stale confirmation after loss.
    const file = d.querySelector<HTMLInputElement>('#world-progress-status input[type=file]')!;
    let finish!: (raw: string) => void; const pending = new Promise<string>(resolve => { finish = resolve; });
    Object.defineProperty(file, 'files', { configurable: true, value: [{ size: 40, text: () => pending }] });
    let confirmations = 0; h.window.confirm = () => { confirmations++; return true; };
    file.dispatchEvent(new h.window.Event('change')); event('webglcontextlost');
    finish('{"done":["stale_restore"],"found":[]}'); await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(confirmations, 0); assert.equal(w.done.has('stale_restore'), false);
    // Final page exit removes context listeners; BFCache behavior is separate.
    h.window.dispatchEvent(new h.window.PageTransitionEvent('pagehide', { persisted: false }));
    const before = d.getElementById('loading')!.textContent; event('webglcontextrestored'); event('webglcontextlost');
    assert.equal(w.graphicsRecovery.state, 'disposed'); assert.equal(d.getElementById('loading')!.textContent, before);
    await start(); assert.equal(d.pointerLockElement, null); assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});


test('context loss/restoration during asynchronous boot still requires a deliberate first entry', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, contextLossDuringBoot: true });
  try {
    assert.equal(h.world.graphicsRecovery.state, 'awaiting-resume');
    assert.equal(h.window.document.pointerLockElement, null);
    const p = h.world.player.pos.clone(); h.frame(50000); assert.deepEqual(h.world.player.pos.toArray(), p.toArray());
    (h.window.document.getElementById('start') as HTMLElement).click(); await Promise.resolve();
    assert.equal(h.world.graphicsRecovery.state, 'available'); assert.ok(h.window.document.pointerLockElement);
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});

test('paid native cinematic cancellation cannot replay contact or refund on graphics recovery',async()=>{
 const {getFalseDawnEncounterSpec}=await import('../src/falseDawnEncounterCatalog');
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['armory_rack','saber_contract'],found:[]})}}),w=h.world,d=h.window.document,canvas=d.getElementById('view')!;let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=(code:string)=>{for(const type of ['keydown','keyup'])d.body.dispatchEvent(new h.window.KeyboardEvent(type,{code,bubbles:true}));};
 const start=async()=>{(d.getElementById('start')as HTMLElement).click();await Promise.resolve();};
 const loss=()=>canvas.dispatchEvent(new h.window.Event('webglcontextlost',{cancelable:true})),restore=()=>canvas.dispatchEvent(new h.window.Event('webglcontextrestored'));
 const spec=getFalseDawnEncounterSpec('false_dawn_array')!,hits:any[]=[];const record=w.actions.recordDamage.bind(w.actions);w.actions.recordDamage=(hit:any)=>{hits.push({...hit});return record(hit);};
 const aim=(e:any)=>{const dx=e.p.x-w.camera.position.x,dz=e.p.z-w.camera.position.z,dy=e.p.y+1-w.camera.position.y,yaw=Math.atan2(-dx,-dz),pitch=Math.atan2(dy,Math.hypot(dx,dz)),sens=.0022*w.settings.value.sensitivity,event=new h.window.MouseEvent('mousemove',{bubbles:true});Object.defineProperties(event,{movementX:{value:Math.atan2(Math.sin(w.player.yaw-yaw),Math.cos(w.player.yaw-yaw))/sens},movementY:{value:(w.player.pitch-pitch)/sens}});d.dispatchEvent(event);};
 try{
  await start();w.ultimateDirector.setMode('full');const x=spec.anchor.x,z=spec.anchor.z-6,g=w.combat.geometry.ground(x,z,spec.anchor.y+4);assert.ok(g);
  // Entry position and full charge are explicit compatibility fixtures, not balance evidence.
  w.player.teleport(x,g.point.y+.04,z);frame(60);await h.settleAssets();frame(30);assert.equal(w.combat.startStoryEncounter(spec,{position:w.player.pos,playable:true}).ok,true);
  const actors=w.combat.state.enemies.filter((e:any)=>e.storyEncounter);
  for(let i=0;i<600&&!actors.some((e:any)=>e.mode==='windup');i++)frame();assert.ok(actors.some((e:any)=>e.mode==='windup'));
  loss();const windup=actors.map((e:any)=>[e.hp,e.timer,e.mode]),playerHp=w.combat.state.hp;frame(120);restore();frame(120);
  assert.deepEqual(actors.map((e:any)=>[e.hp,e.timer,e.mode]),windup);assert.equal(w.combat.state.hp,playerHp);await start();
  for(let i=0;i<6;i++){aim(actors[0]);frame();}
  w.actions.skills.energyValue=100;key('KeyX');assert.ok(w.ultimateDirector.active);assert.equal(w.actions.skills.energy,0);
  loss();assert.equal(w.ultimateDirector.active,false);const hp=actors.map((e:any)=>e.hp),timers=actors.map((e:any)=>[e.timer,e.mode]);frame(120);restore();frame(120);
  assert.deepEqual(actors.map((e:any)=>e.hp),hp);assert.deepEqual(actors.map((e:any)=>[e.timer,e.mode]),timers);assert.equal(hits.filter(h=>h.source==='ultimate').length,0);assert.equal(w.actions.skills.energy,0);
  await start();frame(2);assert.equal(hits.filter(h=>h.source==='ultimate').length,0);
  w.actions.reset();w.actions.skills.energyValue=100;for(let i=0;i<6;i++){aim(actors[0]);frame();}key('KeyX');assert.ok(w.ultimateDirector.active);
  for(let i=0;i<1200&&!hits.some(h=>h.source==='ultimate');i++)frame();assert.ok(hits.some(h=>h.source==='ultimate'));
  for(let i=0;i<600&&w.ultimateDirector.frame?.phase!=='outro';i++)frame();assert.equal(w.ultimateDirector.frame?.phase,'outro');
  const count=hits.filter(h=>h.source==='ultimate').length;loss();const after=actors.map((e:any)=>e.hp);frame(120);restore();frame(120);await start();frame(2);
  assert.equal(w.ultimateDirector.active,false);assert.equal(hits.filter(h=>h.source==='ultimate').length,count);assert.deepEqual(actors.map((e:any)=>e.hp),after);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

test('loss at a synchronous autosave boundary preserves the accepted write without reopening dialogue',async()=>{
 const KEY='parhelion.world.progress.v2',h=await bootWorldWithoutGpu({deterministic:true}),w=h.world,d=h.window.document;let now=0;
 try{
  (d.getElementById('start')as HTMLElement).click();await Promise.resolve();const npc=w.campaignSites.sites.find((s:any)=>s.region==='alpha').npc,[x,y,z]=npc.position,g=w.combat.geometry.ground(x,z+.65,y+3);assert.ok(g);w.player.teleport(x,g.point.y+.1,z+.65);
  for(let i=0;i<180&&!w.player.onGround;i++)h.frame(now+=1000/60);assert.ok(w.player.onGround);
  const proto=Object.getPrototypeOf(h.window.localStorage),set=proto.setItem;let writes=0;
  proto.setItem=function(key:string,value:string){set.call(this,key,value);if(key===KEY){writes++;d.getElementById('view')!.dispatchEvent(new h.window.Event('webglcontextlost',{cancelable:true}));}};
  try{for(const type of ['keydown','keyup'])d.body.dispatchEvent(new h.window.KeyboardEvent(type,{code:'KeyF',bubbles:true}));}finally{proto.setItem=set;}
  assert.equal(writes,1);assert.ok(w.done.has('campaign_alpha_met'));assert.ok(JSON.parse(h.window.localStorage.getItem(KEY)!).done.includes('campaign_alpha_met'));assert.equal(w.graphicsRecovery.state,'lost');assert.equal(w.narrative.open,false);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});
