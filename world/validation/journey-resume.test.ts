import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WORLD_PROGRESS_KEY} from '../src/core/progress';
import {echoMarkerId} from '../src/story/echoDestinations';
import {bootWorldWithoutGpu} from './world-dom-boot.fixture';

test('the menu preserves a fresh prologue and each settlement points to its own Arena station', async () => {
  const h=await bootWorldWithoutGpu({deterministic:true});
  try {
    const w=h.world, doc=h.window.document;
    assert.match(doc.getElementById('world-enter')!.textContent!,/开始旅程|Begin journey/);
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
  const resumed=await bootWorldWithoutGpu({deterministic:true,streaming:true,initialStorage:{[WORLD_PROGRESS_KEY]:raw!}});
  try {
    const w=resumed.world, stop=w.travelStops.find((s:any)=>s.id==='travel_egypt');
    assert.match(resumed.window.document.getElementById('world-enter')!.textContent!,/继续旅程|Continue journey/);
    assert.equal(w.player.pos.x,stop.position[0]); assert.equal(w.player.pos.z,stop.position[2]);
    assert.ok(Math.abs(w.player.pos.y-stop.position[1])<1.2);
    assert.ok(w.done.has('armory_rack')); assert.deepEqual(resumed.errors,[]);
  } finally {await resumed.close();}
});
