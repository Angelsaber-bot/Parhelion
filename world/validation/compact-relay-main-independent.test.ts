/** NON-GPU event-order/fault fixture. Preboot armory ownership and supported
 * entry placement are explicit setup. Injected enemy kills and one real hurt()
 * event test lifecycle ordering, NOT normal combat/playability or earned rewards. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('actual main relay: held input, damage on completion frame, pause and replay retain authority', async () => {
  const h = await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['armory_rack'],found:[]})}});
  const w=h.world,d=h.window.document;let now=0;
  const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
  const key=(action:string,down=true,repeat=false)=>{
    const code=w.settings.bindingsFor(action)[0];
    d.body.dispatchEvent(new h.window.KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true,cancelable:true,repeat}));
  };
  const tap=(action:string)=>{key(action);key(action,false);};
  const place=(id:string)=>{const m=w.layout.markers.find((m:any)=>m.id===id);assert.ok(m);w.player.teleport(m.p[0],m.p[1]+.3,m.p[2]);frame(90);assert.ok(w.player.onGround&&!w.player.swimming,'real physics settles; no ground writes');};
  const start=()=>{
    place('compact_relay_entry');tap('interact');
    for(let i=0;!w.narrative.choosing&&w.narrative.open&&i<30;i++)tap('interact');
    const button=d.querySelector<HTMLButtonElement>('#world-dialogue-choices [data-choice="start"]');assert.ok(button);button.click();
    for(let i=0;w.narrative.open&&!w.narrative.choosing&&i<20;i++)tap('interact');
    frame();assert.equal(w.compactRelayRuntime.active,true,d.getElementById('toast')?.textContent??'no toast');
  };
  try {
    (d.getElementById('start') as HTMLElement).click();await Promise.resolve();frame(2);await h.settleAssets();
    place('compact_relay_entry');
    assert.equal(w.settings.bind('interact','WheelUp',true),null); w.settings.clearSecondary('interact');
    const wheel=()=>h.window.dispatchEvent(new h.window.WheelEvent('wheel',{deltaY:-1,bubbles:true,cancelable:true}));
    wheel();
    for(let i=0;!w.narrative.choosing&&w.narrative.open&&i<30;i++)wheel();
    const wheelStart=d.querySelector<HTMLButtonElement>('#world-dialogue-choices [data-choice="start"]');assert.ok(wheelStart);wheelStart.click();
    frame();assert.equal(w.compactRelayRuntime.active,false,'wheel-only binding cannot trap player in unholdable task');
    assert.equal(w.done.has('compact_relay_complete'),false);
    assert.equal(w.settings.bind('interact','KeyF',true),null);
    if(w.narrative.open)w.narrative.hide(); // fixture closes failed-admission feedback before real retry
    start();
    for(const enemy of w.combat.state.enemies.filter((e:any)=>e.storyEncounter==='compact_relay_training'))w.combat.damageEnemy(enemy.id,10000,{source:'ranged',origin:w.player.pos});
    frame();assert.equal(w.compactRelayRuntime.cleared,true);assert.equal(w.done.has('compact_relay_complete'),false);
    place('compact_relay_controller');key('interact',false);frame();key('interact');
    for(let i=0;w.compactRelayRuntime.progress<.99&&i<190;i++)frame();
    assert.ok(w.compactRelayRuntime.progress>=.99&&w.compactRelayRuntime.progress<1);
    // This queues production onHurt; main must drain it BEFORE the same frame's
    // channel completion check. Direct damageRevision writes would miss that bug.
    w.combat.state.hurt(1);frame();
    assert.equal(w.done.has('compact_relay_complete'),false);assert.equal(w.compactRelayRuntime.progress,0);
    frame(200);assert.equal(w.compactRelayRuntime.progress,0,'holding after hurt cannot restart');
    key('interact',false);frame();key('interact');frame(30);
    assert.ok(w.compactRelayRuntime.progress>0);
    key('interact',true,true);frame();assert.ok(w.compactRelayRuntime.progress<.2,'browser repeat grants no extra time');
    d.exitPointerLock();frame(5);assert.equal(w.compactRelayRuntime.progress,0);
    assert.equal(w.compactRelayRuntime.active,true,'ordinary pause retains encounter');
    (d.getElementById('start') as HTMLElement).click();await Promise.resolve();frame(2);
    key('interact');frame(190);key('interact',false);
    assert.equal(w.done.has('compact_relay_complete'),true);assert.equal(w.done.has('relay_b'),false);
    assert.equal(w.compactRelayRuntime.active,false);
    assert.ok(JSON.parse(h.window.localStorage.getItem('parhelion.world.progress.v2')!).done.includes('compact_relay_complete'));
    const completedFlags=[...w.done].sort();
    frame(360);place('compact_relay_deployment');tap('interact');
    for(let i=0;!w.narrative.choosing&&w.narrative.open&&i<20;i++)tap('interact');
    const deploy=d.querySelector<HTMLButtonElement>('#world-dialogue-choices [data-choice="deploy"]');assert.ok(deploy);
    console.log('DEPLOYMENT_NEARBY',JSON.stringify(w.combat.state.enemies.filter((e:any)=>e.hp>0&&!e.pacified).map((e:any)=>({id:e.id,active:e.active,mode:e.mode,distance:Math.hypot(e.p.x+140,e.p.z+12),p:e.p})).sort((a:any,b:any)=>a.distance-b.distance).slice(0,6)));
    // Fault setup only: an already-active old-world pursuer at the destination.
    const pursuer=w.combat.state.enemies.find((e:any)=>!e.storyEncounter&&e.hp>0&&!e.pacified);assert.ok(pursuer);
    const oldP=pursuer.p,oldActive=pursuer.active,oldMode=pursuer.mode,departure=w.player.pos.toArray();
    try {pursuer.p={x:-140,y:8,z:-12};pursuer.active=true;pursuer.mode='chase';deploy.click();assert.deepEqual(w.player.pos.toArray(),departure,'destination pressure denies new reward travel');}
    finally {pursuer.p=oldP;pursuer.active=oldActive;pursuer.mode=oldMode;}
    tap('interact');for(let i=0;!w.narrative.choosing&&w.narrative.open&&i<20;i++)tap('interact');
    const retryDeploy=d.querySelector<HTMLButtonElement>('#world-dialogue-choices [data-choice="deploy"]');assert.ok(retryDeploy);
    retryDeploy.click();const arrival=w.player.pos.toArray();retryDeploy.click();
    assert.deepEqual(w.player.pos.toArray(),arrival,'detached second deployment click does not repeat');
    assert.ok(Math.hypot(arrival[0]+140,arrival[2]+12)<1,'real approved outpost gate arrival');
    assert.deepEqual([...w.done].sort(),completedFlags,'deployment does not grant old relay or story flags');
    d.exitPointerLock();frame();
    (d.getElementById('world-arena-training-open') as HTMLElement).click();
    const launch=d.getElementById('arena-training-new-tab') as HTMLAnchorElement;
    assert.equal(launch.target,'_blank');assert.ok(launch.href.includes('offline'));
    const raw=h.window.localStorage.getItem('parhelion.world.progress.v2');
    const original=h.window.Storage.prototype.setItem;let reject=true;
    h.window.Storage.prototype.setItem=function(k:string,v:string){if(reject&&k==='parhelion.world.progress.v2')throw new Error('QA quota fault');return original.call(this,k,v);};
    let applicationPrevented=false;
    // Observe application cancellation first, then prevent all actual navigation in this CPU test.
    launch.addEventListener('click',event=>{applicationPrevented=event.defaultPrevented;event.preventDefault();});
    try {
      launch.dispatchEvent(new h.window.MouseEvent('click',{bubbles:true,cancelable:true}));
      assert.equal(applicationPrevented,true,'failed save cannot leave World');
      assert.equal(h.window.localStorage.getItem('parhelion.world.progress.v2'),raw);
      reject=false;launch.dispatchEvent(new h.window.MouseEvent('click',{bubbles:true,cancelable:true}));
      assert.equal(applicationPrevented,false,'successful save permits explicit new-tab navigation');
      assert.deepEqual([...w.done].sort(),completedFlags,'retained World tab owns same progress');
    } finally { h.window.Storage.prototype.setItem=original; }
    assert.deepEqual(h.errors,[]);
  } finally { await h.close(); }
});
