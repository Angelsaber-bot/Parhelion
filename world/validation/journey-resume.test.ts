import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WORLD_PROGRESS_KEY} from '../src/core/progress';
import {echoMarkerId} from '../src/story/echoDestinations';
import {ADVENTURE} from '../src/story/openWorldCampaign';
import {JOURNEY} from '../src/story/worldJourney';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';

test('the menu preserves a fresh prologue and each settlement points to its own Arena station', async () => {
  const messages = new Set<string>();
  const h=await bootWorldWithoutGpu({deterministic:true, beforeBoot(window) {
    const loading = window.document.getElementById('loading')!;
    let switched = false;
    new window.MutationObserver(() => {
      const text = loading.textContent ?? '';
      messages.add(text);
      if (text === '正在加载角色…' && !switched) {
        switched = true;
        const locale = window.document.querySelector<HTMLSelectElement>('.parhelion-language select')!;
        locale.value = 'en';
        locale.dispatchEvent(new window.Event('change', { bubbles: true }));
      }
    }).observe(loading, { childList: true, subtree: true });
  }});
  try {
    const w=h.world, doc=h.window.document;
    assert.ok(messages.has('正在加载角色…'));
    assert.ok(messages.has('Loading your character…'));
    for (let i = 1; i <= 20; i++) h.frame(i * 1000 / 60);
    assert.equal(doc.getElementById('world-enter')!.textContent!, 'Start journey');
    assert.equal(doc.querySelector('#area .zh')!.textContent, 'Companion Residence');
    const locale = doc.querySelector<HTMLSelectElement>('.parhelion-language select')!;
    locale.value = 'zh';
    locale.dispatchEvent(new h.window.Event('change', { bubbles: true }));
    assert.equal(doc.getElementById('world-enter')!.textContent!, '开始旅程');
    assert.equal(doc.querySelector('#area .zh')!.textContent, '从者生活馆');
    doc.getElementById('world-adventure-continue')!.click();
    assert.deepEqual([...w.done],[]);
    for (const stop of w.travelStops.filter((s:any)=>!s.requiredCompletionFlag)) {
      const sign=w.scene.getObjectByName('EchoWaypost_'+stop.region);
      assert.ok(sign,stop.id);
      const station=w.echoHall.markers.find((m:any)=>m.id===echoMarkerId(stop.region));
      const direction=new w.THREE.Vector3(station.p[0]-sign.position.x,0,station.p[2]-sign.position.z).normalize();
      assert.ok(sign.getWorldDirection(new w.THREE.Vector3()).dot(direction)>.999,stop.id);
      assert.ok(Math.hypot(sign.position.x-stop.position[0],sign.position.z-stop.position[2])>3);
    }
    assert.deepEqual(h.errors,[]);
  } finally {await h.close();}
});

test('an earned Egypt checkpoint saves on foot and starts the next streamed session at the same landing',async()=>{
  const seed=JSON.stringify({done:['armory_rack','summon_circle','adventure_v2'],found:[]});
  const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{[WORLD_PROGRESS_KEY]:seed}});
  let raw:string;
  try {
    const w=h.world,stop=w.travelStops.find((s:any)=>s.id==='travel_egypt');
    h.window.document.getElementById('world-enter')!.click(); await Promise.resolve();
    w.player.teleport(stop.position[0],stop.position[1]+.25,stop.position[2]);
    w.combat.state.ammo=0;
    for(let i=1;i<=380;i++) h.frame(i*1000/60);
    raw=h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!;
    assert.equal(JSON.parse(raw).camp,'egypt');
    assert.ok(JSON.parse(raw).found.includes('travel_egypt')); assert.ok(w.combat.state.ammo>0);
    assert.deepEqual(h.errors,[]);
  } finally {await h.close();}
  const resumed=await bootWorldWithoutGpu({deterministic:true,streaming:true,initialStorage:{[WORLD_PROGRESS_KEY]:raw!, 'parhelion-language-v1':'en'}});
  try {
    const w=resumed.world, stop=w.travelStops.find((s:any)=>s.id==='travel_egypt');
    assert.equal(resumed.window.document.getElementById('world-enter')!.textContent, 'Continue journey');
    assert.equal(w.player.pos.x,stop.position[0]); assert.equal(w.player.pos.z,stop.position[2]);
    assert.ok(Math.abs(w.player.pos.y-stop.position[1])<1.2);
    assert.ok(w.done.has('armory_rack')); assert.deepEqual(resumed.errors,[]);
  } finally {await resumed.close();}
});

test('the live guide follows the Western Desert Road past the regional border and hands off at the market', async () => {
  const seed = JSON.stringify({
    done: ['armory_rack', 'summon_circle', 'adventure_v2', ADVENTURE.ending, JOURNEY.cutoff, JOURNEY.egyptRead, JOURNEY.egyptWeir, JOURNEY.egyptDone],
    found: [],
  });
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    [WORLD_PROGRESS_KEY]: seed, 'parhelion-language-v1': 'en',
  } });
  try {
    const { world, window } = h;
    const doc = window.document, guide = doc.getElementById('guide')!;
    doc.getElementById('world-enter')!.click();
    await Promise.resolve();
    let now = 0;
    const stand = (x: number, z: number) => {
      world.player.teleport(x, world.grid.sampleHeight(x, z) + .15, z);
      for (let i = 0; i < 8; i++) h.frame(now += 1000 / 60);
    };
    stand(-200, -1520);
    assert.ok(guide.classList.contains('on') && guide.classList.contains('travel'));
    assert.equal(guide.querySelector('.label')?.textContent, 'Via Western Desert Road to Orleans');
    stand(-470, -1240);
    assert.ok(guide.classList.contains('travel'), 'the marker still follows the road around its next bend');
    assert.match(guide.querySelector('.dist')?.textContent ?? '', /^3[0-9] m$/);
    stand(-800, -1350);
    assert.ok(guide.classList.contains('on'));
    assert.ok(!guide.classList.contains('travel'));
    assert.match(guide.querySelector('.label')?.textContent ?? '', /meet the defenders/i);
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});
