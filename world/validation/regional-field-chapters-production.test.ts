import test from 'node:test';
import assert from 'node:assert/strict';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { K04 } from '../src/story/kingdomBackPassage';
import { WC } from '../src/story/winterChapters';
import { BC } from '../src/story/blacksailChapters';
import { KINGDOM_GATE } from '../src/story/kingdomGate';

test('K04, W03 and B02 play through production input, real encounters, on-site work, real targets and saves', async () => {
  const seed = ['armory_rack', 'adventure_v2', 'adventure_started', 'adventure_online', KINGDOM_GATE.rescued, 'k03_complete', WC.w02, BC.b01];
  const h = await bootWorldWithoutGpu({ deterministic: true, bootTimeoutMs: 120000, initialStorage: { [WORLD_PROGRESS_KEY]: JSON.stringify({ done: seed, found: [] }) } });
  const w = h.world, d = h.window.document; let time = 0;
  const frame = (n = 1) => { for (let i = 0; i < n; i++) h.frame(time += 1000 / 60); };
  const tap = () => { for (const type of ['keydown', 'keyup']) d.body.dispatchEvent(new h.window.KeyboardEvent(type, { code: w.settings.bindingsFor('interact')[0], bubbles: true, cancelable: true })); };
  const go = (id: string) => {
    const m = w.layout.markers.find((m: { id: string }) => m.id === id); assert.ok(m, id);
    const floor = w.combat.geometry.ground(m.p[0], m.p[2], m.p[1] + .5); assert.ok(floor, `${id} has supported ground`);
    assert.ok(Math.abs(floor.point.y - (m.p[1] - .9)) < 1.2, `${id} marker stands on its floor (${floor.point.y.toFixed(2)} vs ${m.p[1]})`);
    w.player.teleport(floor.point.x, floor.point.y + .12, floor.point.z); frame(20);
  };
  const earn = (id: string) => { go(id); tap(); frame(2); assert.ok(w.done.has(id), `${id}: ${d.getElementById('prompt')?.textContent} | ${d.getElementById('toast')?.textContent}`); };
  const win = (id: string) => {
    go(id); tap(); const active = w.combat.storyEncounter; assert.ok(active, `${id}: encounter did not start (${d.getElementById('toast')?.textContent})`);
    for (const e of w.combat.state.enemies.filter((e: { storyEncounter?: string }) => e.storyEncounter === active.id)) for (let i = 0; i < 40 && e.hp > 0; i++) w.combat.damageEnemy(e.id, 100);
    frame(10); assert.ok(w.done.has(id), id);
  };
  const work = (id: string, seconds: number) => { go(id); tap(); frame(Math.ceil(seconds * 60) + 90); assert.ok(w.done.has(id), `${id} finished on site`); };
  const shoot = (id: string) => {
    const mesh = w.fieldChapterScene.targets.find((t: { userData: { target?: string } }) => t.userData.target === id);
    assert.ok(mesh && mesh.visible, `${id} has a visible target`);
    go(id); assert.ok(w.fieldChapters.hit(id)); assert.ok(w.done.has(id), id); frame(2); assert.equal(mesh.visible, false, `${id} target is consumed`);
  };
  try {
    (d.getElementById('start') as HTMLElement).click(); await Promise.resolve(); frame(3);
    // K04: main street route; the guide points at the chapter while it is open.
    earn(K04.overlook); win(K04.street); work(K04.winch, 6); earn(K04.open); work(K04.residents, 9); earn(K04.ada);
    assert.ok(w.done.has(K04.complete) && !w.done.has(K04.ladder));
    // W03: a shot, joint work, and the count.
    earn(WC.school); shoot(WC.beam); work(WC.door, 6); earn(WC.count); assert.ok(w.done.has(WC.w03));
    // B02: free the winch by fighting, send the workers by tug, take the flag down, Mira's station.
    win(BC.hold); earn(BC.tugPlan); earn(BC.flag); earn(BC.mira); assert.ok(w.done.has(BC.b02) && w.done.has(BC.sent));
    const stored = JSON.parse(h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!);
    for (const flag of [K04.complete, WC.w03, BC.b02]) assert.ok(stored.done.includes(flag), flag);
  } finally { await h.close(); }
});

test('every field chapter marker is placed on supported ground in production', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, bootTimeoutMs: 120000 });
  try {
    const w = h.world, ids = new Set<string>();
    for (const m of w.fieldChapterScene.markers) {
      ids.add(m.id);
      const floor = w.combat.geometry.ground(m.p[0], m.p[2], m.p[1] + .5) ?? null;
      const flagship = /^(b0[5-9])_/.test(m.id);
      if (!flagship) { assert.ok(floor, `${m.id} has ground`); assert.ok(Math.abs(floor.point.y - (m.p[1] - .9)) < 1.2, `${m.id} floor ${floor.point.y.toFixed(2)} vs ${m.p[1]}`); }
    }
    assert.equal(w.fieldChapterScene.missing.length, 0, w.fieldChapterScene.missing.join(', '));
    // Every chapter fight must find room for all of its actors with the production slot rings.
    for (const m of w.fieldChapterScene.markers) {
      const action = w.fieldChapters.action(m.id); if (action?.kind !== 'fight') continue;
      const spec = { id: `chapter_${m.id}`, anchor: { x: m.p[0], y: m.p[1] - .9, z: m.p[2] }, actors: [] as unknown[] };
      let room = 0;
      for (const r of [4, 6, 8]) for (let i = 0; i < 12; i++) {
        const offset = [Math.cos(i * Math.PI / 6) * r, Math.sin(i * Math.PI / 6) * r];
        if (w.combat.geometry.safeAdventureSpawn({ ...spec, actors: [{ role: 'lancer', offset }] }, m.p[0] + offset[0], m.p[2] + offset[1])) room++;
      }
      assert.ok(room >= (action.foes?.length ?? 2) + 1, `${m.id}: only ${room} spawn slots`);
    }
    assert.ok(ids.size >= 80, `placed ${ids.size}`);
  } finally { await h.close(); }
});
