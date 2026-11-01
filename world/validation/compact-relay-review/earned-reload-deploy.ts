/** NON-GPU exact earned-save reload at normal spawn, then ordinary movement and
 * explicit deployment. No constructed flags or direct player/actor state writes.
 * Run: node --import tsx validation/compact-relay-review/earned-reload-deploy.ts EARNED_REPORT.json OUTPUT.json
 */
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { COMPACT_RELAY_ROUTES as routes } from '../../src/compactRelaySitesData';
import { createStoryInputPolicy } from '../combat-review/story-input-policy';
import { bootWorldWithoutGpu } from '../world-dom-boot.fixture';

const [inputReport,output]=process.argv.slice(2);assert.ok(inputReport&&output,'earned report and output required');
const earned=JSON.parse(readFileSync(inputReport,'utf8'));assert.equal(earned.error,null);const raw=earned.saved;assert.equal(typeof raw,'string');const expected=JSON.parse(raw);assert.ok(expected.done.includes('compact_relay_complete'));const saveHash=createHash('sha256').update(raw).digest('hex');
const source = () => Object.fromEntries(['main.ts','relayChannel.ts','compactRelayRuntime.ts','compactRelayCampaign.ts','compactRelaySites.ts','compactRelaySitesData.ts','compactRelayEncounter.ts','storyEncounters.ts','safeTravel.ts','combatTerrain.ts','combatView.ts'].map(name=>[name,createHash('sha256').update(readFileSync(new URL('../../src/'+name,import.meta.url))).digest('hex')]));
const beforeSource = source(), head = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const events: unknown[] = []; let failure: unknown;
const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage:{'parhelion.world.progress.v2':raw} });
const w = h.world, document = h.window.document;
const originalStart=w.combat.startStoryEncounter.bind(w.combat);
w.combat.startStoryEncounter=(...args: any[])=>{const result=originalStart(...args);events.push({kind:'admission-observation',spec:JSON.parse(JSON.stringify(args[0])),admission:args[1]?{...args[1],position:{...args[1].position}}:null,result:{...result}});return result;};
let now = 0, swimmingFrames = 0;
let lastTactical='', nextTrace=0;
const step = () => { h.frame(now += 1000 / 60); if (w.player.swimming) swimmingFrames++;
  const actors=w.combat.state.enemies.filter((e:any)=>e.storyEncounter).map((e:any)=>({id:e.id,role:e.role,hp:e.hp,mode:e.mode,attackCount:e.attackCount,contactSequence:e.contactSequence}));
  if(actors.length&&now>=nextTrace){nextTrace=now+100;events.push({kind:'enemy-position-trace',seconds:now/1000,pos:w.player.pos.toArray(),actors:w.combat.state.enemies.filter((e:any)=>e.storyEncounter).map((e:any)=>({id:e.id,role:e.role,p:{...e.p},mode:e.mode,timer:e.timer,contactSequence:e.contactSequence}))});}
  const signature=JSON.stringify({actors,hp:w.combat.state.hp});
  if(actors.length&&signature!==lastTactical){lastTactical=signature;events.push({kind:'tactical-change',seconds:now/1000,hp:w.combat.state.hp,pos:w.player.pos.toArray(),actors});}
  const progress=w.compactRelayRuntime?.progress??0;
  if(progress>0&&Math.floor(progress*3*10)!==Math.floor(Math.max(0,progress-1/180)*3*10))events.push({kind:'actual-channel-dom',seconds:now/1000,progress,text:document.getElementById('compact-relay-channel')?.textContent,value:document.querySelector<HTMLProgressElement>('#compact-relay-channel progress')?.value});
};
const snapshot = (kind: string) => events.push({kind,seconds:now/1000,pos:w.player.pos.toArray(),hp:w.combat.state.hp,active:w.compactRelayRuntime?.active,progress:w.compactRelayRuntime?.progress,enemies:w.combat.state.enemies.filter((e:any)=>e.storyEncounter).map((e:any)=>({id:e.id,role:e.role,hp:e.hp,mode:e.mode,timer:e.timer,attackCount:e.attackCount,contactSequence:e.contactSequence,p:{...e.p}}))});
const key = (code: string, type = 'keydown') => document.body.dispatchEvent(
  new h.window.KeyboardEvent(type, { code, bubbles: true }));
const press = (code = 'KeyF') => { key(code); key(code, 'keyup'); };
const settle = () => { for (let i = 0; i < 30; i++) step(); };
const marker = (id: string) => {
  const result = w.layout.markers.find((m: any) => m.id === id);
  assert.ok(result, id); return result;
};

function orient(x: number, z: number) {
  const yaw = Math.atan2(-(x - w.player.pos.x), -(z - w.player.pos.z));
  const delta = Math.atan2(Math.sin(w.player.yaw - yaw), Math.cos(w.player.yaw - yaw));
  const event = new h.window.MouseEvent('mousemove', { bubbles: true });
  Object.defineProperties(event, {
    movementX: { value: Math.max(-.07, Math.min(.07, delta)) / (.0022 * w.settings.value.sensitivity) },
    movementY: { value: 0 },
  });
  document.dispatchEvent(event); return Math.abs(delta);
}
function walk(x: number, z: number, maxSeconds = 120, arrival = 1) {
  const before = w.player.pos.clone(); let last = now;
  try {
    for (let i = 0; i < maxSeconds * 60; i++) {
      assert.equal(w.combat.defeated, false, 'Journey cannot continue through a death/reset');
      key('KeyW', orient(x, z) > 1 ? 'keyup' : 'keydown'); step();
      if (Math.hypot(x - w.player.pos.x, z - w.player.pos.z) < arrival) return;
      if (now - last > 5000) {
        const moved = w.player.pos.distanceTo(before);
        console.log(JSON.stringify({ seconds: now / 1000, pos: w.player.pos.toArray(), moved,
          grounded: w.player.onGround, swimming: w.player.swimming, hp: w.combat.state.hp, target: [x, z] }));
        assert.ok(moved >= .3, `Blocked physical route to ${x},${z}`);
        before.copy(w.player.pos); last = now;
      }
    }
    throw Error(`Timed out walking to ${x},${z}`);
  } finally { key('KeyW', 'keyup'); }
}
function closeText() {
  for (let i = 0; w.narrative.open && i < 40; i++) {
    assert.equal(w.narrative.choosing, false, 'Never default-confirm a choice'); press();
  }
  assert.equal(w.narrative.open, false, 'Dialogue closes through ordinary Interact');
}
function visit(id: string, position: number[], expectedFlag: string) {
  walk(position[0], position[2]); settle(); press();
  console.log('INTERACTION', id, JSON.stringify({ pos: w.player.pos.toArray(), done: [...w.done] }));
  closeText(); assert.ok(w.done.has(expectedFlag), `Physical interaction completed ${expectedFlag}`);
}
function choose(id: string) {
  for (let i = 0; !w.narrative.choosing && i < 40; i++) press();
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('#world-dialogue-choices [data-choice]')];
  const index = buttons.findIndex(button => button.dataset.choice === id);
  assert.ok(index >= 0, `Physical dialogue offers ${id}`);
  press(`Digit${index + 1}`); press(); closeText();
}
try {
  assert.deepEqual([...w.done].sort(),[...expected.done].sort());assert.equal(w.compactRelayRuntime.active,false);assert.equal(w.compactRelayRuntime.progress,0);
  (document.getElementById('start') as HTMLElement).click();await Promise.resolve();settle();settle();await h.settleAssets();snapshot('normal-earned-reload-spawn');
  walk(-166,224);walk(-166,230);walk(-160.8,228.5);walk(-65,250);
  for(const [x,z] of routes.approach.slice(0,-2))walk(x,z,120,.25);
  walk(-82,231,120,.25);settle();snapshot('earned-deployment-board');
  const beforeFlags=[...w.done].sort(),hp=w.combat.state.hp,energy=w.actions.skills.energy;
  press();choose('deploy');snapshot('actual-deployment');
  assert.ok(Math.hypot(w.player.pos.x+140,w.player.pos.z+12)<1);
  assert.deepEqual([...w.done].sort(),beforeFlags);assert.equal(w.done.has('relay_b'),false);
  assert.equal(w.combat.state.hp,hp);assert.equal(w.actions.skills.energy,energy);
  assert.equal(w.compactRelayRuntime.active,false);assert.equal(w.combat.storyEncounter,null);
  settle();assert.ok(w.player.onGround&&!w.player.swimming);
  walk(-140,-17);walk(-140,-22);walk(-137,-24);snapshot('walked-through-original-station-gate');
  assert.equal(w.done.has('relay_b'),false);assert.deepEqual(h.errors,[]);assert.deepEqual(source(),beforeSource);
} catch(error){failure=error;console.error(error);snapshot('failure');}
finally{
 writeFileSync(output,JSON.stringify({scope:'Exact prior synthetic earned-save bytes reloaded at normal spawn. Ordinary walking to deployment board, explicit dialogue choice, genuine permitted travel and original gate approach. No added flags/HP/energy/ground or positioning writes. CPU only.',head,inputReport,inputSaveSHA256:saveHash,beforeSource,afterSource:source(),events,seconds:now/1000,done:[...w.done],found:[...w.found],error:failure?String(failure):null,errors:h.errors},null,2));await h.close();
}
if(failure)process.exitCode=1;
