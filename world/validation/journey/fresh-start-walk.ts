/** NON-GPU synthetic operator, starting with empty browser storage.
 * Only real keyboard/mouse interactions and production RAF: no teleport,
 * progress, health, energy, grounded or enemy state writes. Waypoints and correct
 * work answers are authored knowledge, not a human discoverability/time trial.
 * Run: node --import tsx validation/journey/fresh-start-walk.ts
 */
import assert from 'node:assert/strict';
import { createStoryInputPolicy } from '../combat-review/story-input-policy';
import { bootWorldWithoutGpu } from '../world-dom-boot.fixture';

const h = await bootWorldWithoutGpu({ deterministic: true });
const w = h.world, document = h.window.document;
let now = 0;
const step = () => h.frame(now += 1000 / 60);
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
  // road waypoints. The central low crossing legitimately uses swimming.
  const road = [[-166, 232], [-145, 232], [-145, 198], [-124, 190], [-124, 170],
    [-108, 120], [-96, 82], [-44, 14], [-44, -20], [-36, -60], [-35, -92]];
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
  assert.deepEqual(h.errors, []); assert.deepEqual(h.warnings, []);
  console.log('COURIER', JSON.stringify(fight));
  console.log('FINAL', JSON.stringify({ pos: w.player.pos.toArray(), done: [...w.done], seconds: now / 1000,
    hp: w.combat.state.hp, energy: w.actions.skills.energy, errors: h.errors }));
} finally { await h.close(); }
