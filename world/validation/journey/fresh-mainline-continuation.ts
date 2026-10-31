/** NON-GPU synthetic operator, starting with empty browser storage.
 * Only real keyboard/mouse interactions and production RAF: no teleport,
 * progress, health, energy, grounded or enemy state writes. Waypoints and correct
 * work answers are authored knowledge, not a human discoverability/time trial.
 * Run: node --import tsx validation/journey/fresh-mainline-continuation.ts FROZEN_WORLD OUTPUT.json
 * Extends the original driver through real range/ruin/relays/tower/north seam.
 * No setup positioning: tower uses jump→glide→natural perch→grounded jump;
 * northern ice uses an ordinary water-edge lunge. Failed earlier routes retained.
 */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import { createStoryInputPolicy } from '../combat-review/story-input-policy';
import { bootWorldWithoutGpu } from '../world-dom-boot.fixture';

const h = await bootWorldWithoutGpu({ worldRoot:process.argv[2], deterministic: true });
const w = h.world, document = h.window.document;
let now = 0, swimmingFrames = 0;
const step = () => { h.frame(now += 1000 / 60); if (w.player.swimming) swimmingFrames++; };
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
  walk(position[0], position[2],120,id==='summon_circle'?.2:1); settle();
  const prompt=document.getElementById('prompt')?.textContent??'';
  assert.ok(prompt.includes(`[${w.settings.label('interact')}]`),`Actual eligible prompt before ${id}: ${prompt}`);
  const target=w.layout.markers.find((m:any)=>m.id===id);
  if(target)assert.ok(Math.hypot(...target.p.map((v:number,i:number)=>v-w.player.pos.getComponent(i)))<(target.radius??3),`Authored radius before ${id}`);
  console.log('ELIGIBLE_PROMPT',id,prompt);press();
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
function jumpToward(x:number,z:number){
 for(let i=0;i<120&&orient(x,z)>.1;i++)step();
 key('KeyW');key('Space');step();key('Space','keyup');
 try{walk(x,z,120,.7);}finally{key('KeyW','keyup');key('Space','keyup');}
}
function climbOriginalTower(){
 if(process.argv.includes('--walking-ramp')){
  // Explicit later-product variant: preserve the original staged climb below.
  for(const[x,z]of[[-29,-159.5],[-13,-159.5],[-9,-162],[-8,-154],[-2,-154],[-2,-149]])walk(x,z,120,.2);
  settle();press();assert.ok(w.done.has('tower_console'),'real F after earned relays and optional walking ramp');closeText();
  console.log('TOWER_WALKING_ACCESS',JSON.stringify({p:w.player.pos.toArray(),ground:w.player.onGround}));return;
 }
 walk(-30,-162,120,.12);settle();
 for(let i=0;i<180&&orient(0,-162)>.001;i++)step();
 key('ShiftLeft');key('KeyW');let launch=false;
 for(let i=0;i<300;i++){step();if(Math.hypot(w.player.pos.x,w.player.pos.z+162)<=20){launch=true;break;}}
 assert.ok(launch&&w.player.onGround,'real supported running jump admission');
 console.log('TOWER_LAUNCH',JSON.stringify({p:w.player.pos.toArray(),ground:w.player.onGround}));
 key('Space');step();key('Space','keyup');step();step();key('Space');step();key('Space','keyup');
 for(let i=0;i<240;i++)step();key('KeyW','keyup');key('ShiftLeft','keyup');settle();
 console.log('TOWER_PERCH',JSON.stringify({p:w.player.pos.toArray(),ground:w.player.onGround,glide:w.player.gliding}));
 assert.ok(w.player.onGround&&w.player.pos.y>28,'original collar supplies a real supported perch');
 for(let i=0;i<180&&orient(-10,-162)>.001;i++)step();assert.ok(w.player.onGround);
 key('ShiftLeft');key('KeyW');key('Space');step();key('Space','keyup');let landed=false;
 for(let i=0;i<240;i++){step();if(w.player.pos.y>30.4&&w.player.onGround){landed=true;break;}}
 key('KeyW','keyup');key('ShiftLeft','keyup');assert.ok(landed,'second grounded jump reaches original deck');
 console.log('TOWER_DECK',JSON.stringify({p:w.player.pos.toArray(),ground:w.player.onGround}));
 for(const[x,z]of[[-9,-163],[-9,-154],[-3,-154]])walk(x,z);walk(-3,-150.5,120,.2);settle();press();assert.ok(w.done.has('tower_console'),'real F activates tower after both earned relays');closeText();
}
function aimPoint(point:number[]) {
 const dx=point[0]-w.camera.position.x,dz=point[2]-w.camera.position.z,dy=point[1]-w.camera.position.y;
 const yaw=Math.atan2(-dx,-dz),pitch=Math.atan2(dy,Math.hypot(dx,dz)),delta=Math.atan2(Math.sin(w.player.yaw-yaw),Math.cos(w.player.yaw-yaw));
 const sensitivity=.0022*w.settings.value.sensitivity*(1+(w.settings.value.adsSensitivity-1)*w.aim.value),event=new h.window.MouseEvent('mousemove',{bubbles:true});
 Object.defineProperties(event,{movementX:{value:Math.max(-.07,Math.min(.07,delta))/sensitivity},movementY:{value:Math.max(-.05,Math.min(.05,w.player.pitch-pitch))/sensitivity}});document.dispatchEvent(event);
}
function fire(down:boolean){h.window.dispatchEvent(new h.window.MouseEvent(down?'mousedown':'mouseup',{button:0,bubbles:true,cancelable:true}));}
function shootMarker(id:string){const m=marker(id);try{for(let i=0;i<60*12&&!w.done.has(id);i++){aimPoint(m.p);fire(i>30);step();assert.equal(w.combat.defeated,false);}}finally{fire(false);}assert.ok(w.done.has(id),`Normal rifle must hit ${id}`);console.log('SHOT_TARGET',id);}
function clearNearby(){
 const started=now;try{for(let i=0;i<60*45;i++){const enemies=w.combat.state.enemies.filter((e:any)=>e.active&&e.hp>0&&!e.pacified&&Math.hypot(e.p.x-w.player.pos.x,e.p.z-w.player.pos.z)<24).sort((a:any,b:any)=>Math.hypot(a.p.x-w.player.pos.x,a.p.z-w.player.pos.z)-Math.hypot(b.p.x-w.player.pos.x,b.p.z-w.player.pos.z));if(!enemies.length)return;
 const e=enemies[0];aimPoint([e.p.x,e.p.y+1,e.p.z]);fire(now-started>300);key('KeyD',enemies.some((x:any)=>x.mode==='windup')?'keydown':'keyup');step();assert.equal(w.combat.defeated,false,'Original mainline combat defeat is a real stop');
 }throw Error('Original mainline enemy clearance exceeded bounded input policy');}finally{fire(false);key('KeyD','keyup');}
}
try {
  assert.equal(w.done.size, 0); assert.equal(w.found.size, 0);
  (document.getElementById('start') as HTMLElement).click(); await Promise.resolve();
  settle(); settle();
  console.log('INITIAL', JSON.stringify({ pos: w.player.pos.toArray(), hp: w.combat.state.hp, energy: w.actions.skills.energy }));
  // Central garden entrance, rather than walking through the closed maintenance gate.
  walk(-166, 224); walk(-166, 230);
  visit('archivist', w.valleyStory.scene.archivistInitial, 'valley_story_met');
  visit('hq_terminal', marker('hq_terminal').p, 'hq_terminal');
  // The archivist relocates only after this report, not after terminal activation.
  visit('archivist_report', w.valleyStory.scene.archivistInitial, 'valley_story_resolved');
  visit('armory_rack', marker('armory_rack').p, 'armory_rack');
  visit('alpha_signal_keeper', w.campaignSites.sites.find((site: any) => site.region === 'alpha').npc.position, 'campaign_alpha_met');
  const work = marker('campaign_alpha_work');
  for (const choice of ['work_1_ground', 'work_2_echo']) {
    walk(work.p[0], work.p[2], 120, .25); settle(); press(); choose(choice);
  }
  assert.ok(w.done.has('campaign_alpha_worked'));
  // Leave through the front court, pass outside the HQ wall, then use Valley
  // road waypoints and the original elevated West Ford bridge (no new geometry).
  const road = [[-166, 232], [-145, 232], [-145, 198], [-124, 190], [-124, 170],
    [-108, 120], [-81.712, 83.348], [-95, 61], [-108.288, 38.652],
    [-110, 25], [-100, 0], [-80, -30], [-60, -60], [-52, -85]];
  for (const [x, z] of road) walk(x, z);
  const recorder = marker('false_dawn_recorder');
  walk(recorder.p[0], recorder.p[2], 180); settle(); press();
  choose('start:false_dawn_courier');
  assert.equal(w.combat.storyEncounter?.id, 'false_dawn_courier');
  const fight = createStoryInputPolicy({ world: w, window: h.window, nowSeconds: () => now / 1000, step },
    { reactionSeconds: .5, useSkill: false, useEarnedUltimate: false }).run(45);
  assert.equal(fight.defeated, false); assert.equal(fight.remaining, null);
  assert.ok(w.done.has('false_dawn_courier_cleared'));
  assert.equal(w.done.has('summon_circle'), false, 'No original seam unlock was invented');
  assert.equal(swimmingFrames, 0, 'The original West Ford bridge supplies a dry route');
  assert.deepEqual(h.errors, []); assert.deepEqual(h.warnings, []);
  console.log('COURIER', JSON.stringify(fight));
  press();choose('route_harbor');assert.ok(w.done.has('false_dawn_route_harbor'));assert.equal(w.done.has('summon_circle'),false,'Optional lead cannot open original seams');
  // Continue the same genuinely earned state; do not unlock remote seams by setup.
  console.log('CONTINUATION_START',JSON.stringify({done:[...w.done],hp:w.combat.state.hp,energy:w.actions.skills.energy}));
  for(const [x,z]of [[-52,-85],[-60,-60],[-80,-30],[-100,0],[-110,25],[-108.288,38.652],[-95,61],[-81.712,83.348],[-108,120],[-124,170],[-124,190],[-145,198],[-145,232],[-90,250],[-90,264.5],[-75,264.5]])walk(x,z);
  for(const id of ['range_target_1','range_target_2','range_target_3'])shootMarker(id);
  for(const [x,z]of [[-90,264.5],[-90,250],[-90,212],[-62,182],[-60,120],[-60,92],[-22,118],[2,142],[16,144],[48,118],[86,80],[110,54]])walk(x,z);
  clearNearby();
  for(const id of ['ruin_target_1','ruin_target_2','ruin_target_3'])shootMarker(id);
  visit('relay_a',marker('relay_a').p,'relay_a');
  console.log('ORIGINAL_GATE_REACHED',JSON.stringify({gate:'relay_a',done:[...w.done],hp:w.combat.state.hp,energy:w.actions.skills.energy}));
  // Authored forest log bridge and tower ridge, then the outpost's real north gate.
  for(const [x,z]of [[116,40],[112,30],[96,-4],[82,-36],[64,-78],[30,-126],[10,-142],[-18,-160],[-70,-146],[-124,-118],[-156,-86],[-156,-76],[-145,-76],[-126,-75],[-130,-55],[-138,-55],[-145,-58]])walk(x,z);
  visit('relay_b',[-147,8,-57],'relay_b');
  for(const [x,z]of [[-138,-55],[-130,-55],[-126,-75],[-145,-76],[-156,-76],[-156,-86],[-124,-118],[-70,-146],[-30,-162]])walk(x,z);
  climbOriginalTower();
  console.log('ORIGINAL_GATE_REACHED',JSON.stringify({gate:'tower_console',done:[...w.done],hp:w.combat.state.hp,energy:w.actions.skills.energy}));
  for(const [x,z]of [[-3,-154],[-10,-154],[-22,-154],[-22,-180],[0,-190],[8,-212],[0,-244],[0,-250]])walk(x,z);
  walk(0,-252.2,120,.1);for(let i=0;i<120&&!w.player.swimming;i++)step();console.log('ICE_LUNGE',JSON.stringify({p:w.player.pos.toArray(),swim:w.player.swimming,ground:w.player.onGround}));assert.ok(w.player.swimming,'ordinary water state before real ice-lip lunge');jumpToward(0,-260);walk(0,-292);visit('seam_north',marker('seam_north').p,'seam_north');
  console.log('ORIGINAL_GATE_REACHED',JSON.stringify({gate:'seam_north',done:[...w.done],hp:w.combat.state.hp,swimmingFrames}));
  for(const [x,z]of [[0,-292],[0,-260],[0,-244],[0,-238],[-40,-210],[-70,-146],[-124,-118],[-156,-86],[-184,-90],[-184,-36],[-230,-34],[-280,-30]])walk(x,z);
  visit('seam_west',marker('seam_west').p,'seam_west');
  for(const [x,z]of [[-280,-30],[-230,-34],[-184,-36],[-184,-14],[-140,-14],[-124,22],[-108.288,38.652],[-95,61],[-81.712,83.348],[-60,92],[-22,118],[2,142],[16,144],[48,118],[86,80],[110,50],[132,40],[170,32],[210,30],[260,30]])walk(x,z);
  visit('seam_east',marker('seam_east').p,'seam_east');
  for(const [x,z]of [[260,30],[210,30],[170,32],[132,40],[110,50],[86,80],[48,118],[16,144],[16,182],[16,222],[40,250],[40,290]])walk(x,z);
  visit('seam_south',marker('seam_south').p,'seam_south');
  for(const [x,z]of [[40,290],[40,250],[70,200],[86,120],[86,80],[48,118],[16,144],[2,142],[-22,118],[-60,92],[-60,120],[-62,182],[-90,212],[-118,246],[-130,256],[-150,256]])walk(x,z);
  visit('summon_circle',[-163,10.8,256],'summon_circle');
  console.log('FINAL', JSON.stringify({ pos: w.player.pos.toArray(), done: [...w.done], seconds: now / 1000,
    hp: w.combat.state.hp, energy: w.actions.skills.energy, swimmingFrames, errors: h.errors }));
} finally { if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify({sourceRoot:process.argv[2],towerVariant:process.argv.includes('--walking-ramp')?'approved walking ramp':'original staged jump/glider',scope:'Fresh empty-storage normal-input continuation; authored waypoints/answers, no state grants. Exact synthetic earned storage retained for diagnosis.',seconds:now/1000,swimmingFrames,position:w.player.pos.toArray(),hp:w.combat.state.hp,energy:w.actions.skills.energy,done:[...w.done],found:[...w.found],saved:h.window.localStorage.getItem('parhelion.world.progress.v2'),errors:h.errors},null,2));await h.close(); }
