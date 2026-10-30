import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { ERA_IDS, ERA_STORIES, ERA_OPTIONALS, getEraStoryGuide, getEraStoryState } from '../src/eraStories';
import { BOSSES } from '../src/combat';
import { FORT_CANNON } from '../src/fortCannon';
import { WorldProgress, WORLD_PROGRESS_KEY } from '../src/progress';

/** Production handlers/state, NOT a human playthrough. Test positioning skips
 * travel already covered by real-Player route tests; decisive combat damage skips
 * boss endurance. No direct done.add is used to complete chapter requirements. */
test('NON-GPU four chapters: fresh save, resident, mandatory route, victory, return, optional revisit, rematch and reset', async t => {
  const h = await bootWorldWithoutGpu({ deterministic: true });
  const { world: w, window } = h, document = window.document;
  let now = 0, progressWrites = 0;
  const originalSetItem = window.Storage.prototype.setItem;
  window.Storage.prototype.setItem = function (key: string, value: string) { if (key === WORLD_PROGRESS_KEY) progressWrites++; return originalSetItem.call(this, key, value); };
  const frame = (n = 1) => { for (let i = 0; i < n; i++) h.frame(now += 1000 / 60); };
  const key = (code: string) => {
    document.body.dispatchEvent(new window.KeyboardEvent('keydown', { code, bubbles: true }));
    document.body.dispatchEvent(new window.KeyboardEvent('keyup', { code, bubbles: true }));
  };
  const enter = async () => { (document.getElementById('start') as HTMLElement).click(); await Promise.resolve(); };
  const closeDialogue = () => { for (let i = 0; !document.getElementById('world-dialogue')!.hidden && i < 30; i++) key('KeyF'); assert.equal(document.getElementById('world-dialogue')!.hidden, true); };
  const position = (p: number[]) => { closeDialogue(); w.player.teleport(...p); w.player.onGround = true; w.player.flying = false; w.player.swimming = false; w.player.gliding = false; };
  const marker = (id: string) => { const m = w.layout.markers.find((m: any) => m.id === id); assert.ok(m, id); return m; };
  const interact = (id: string) => { position(marker(id).p); key('KeyF'); };
  const resident = (id: string) => { const npc = w.scene.getObjectByName(`Resident_${id}`); assert.ok(npc, id); position(npc.position.toArray()); key('KeyF'); assert.equal(document.getElementById('world-dialogue')!.hidden, false, `${id} dialogue opens`); };
  const shootAt = (id: string, cannon: boolean) => {
    let mesh: any; w.scene.traverse((o: any) => { if (o.userData.target === id) mesh = o; });
    assert.ok(mesh, id); mesh.updateWorldMatrix(true, false);
    const point = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    const origin = cannon ? new THREE.Vector3(FORT_CANNON.muzzle.x, FORT_CANNON.muzzle.y, FORT_CANNON.muzzle.z) : w.player.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    w.camera.position.copy(origin); w.camera.lookAt(point); w.camera.updateMatrixWorld(true);
    document.body.dispatchEvent(new window.MouseEvent('mousedown', { button: 0, bubbles: true }));
    document.body.dispatchEvent(new window.MouseEvent('mouseup', { button: 0, bubbles: true }));
    assert.ok(w.done.has(id), `${id} is recorded by the actual shooting handler`);
  };
  try {
    await enter();
    for (const region of ERA_IDS) await t.test(region, async () => {
      if (w.done.size) { closeDialogue(); window.confirm = () => true; key('KeyR'); await enter(); }
      assert.equal(w.done.size, 0, 'each chapter starts with empty World progress');
      const chapter = ERA_STORIES[region], boss = BOSSES.find(b => b.core === chapter.core)!;
      resident(chapter.npc);
      const opening = document.getElementById('world-dialogue-text')!.textContent!;
      const openingGoal = getEraStoryGuide(region, w.done)!;
      assert.ok(opening.includes(openingGoal.text[0]) || opening.includes(openingGoal.text[1]), 'first resident gives the concrete next goal');
      closeDialogue();
      assert.deepEqual([...w.done], [`era_${region}_met`], 'first resident does not grant chapter preparation');
      assert.equal(getEraStoryGuide(region, w.done)!.targetId, chapter.beats[0].flags[0]);
      assert.equal(w.combat.beginBoss(chapter.core), false, 'fresh save cannot skip preparation');
      // Acquire equipment via actual original markers, not a synthetic inventory flag.
      interact('hq_terminal'); interact('armory_rack'); closeDialogue();
      assert.ok(w.done.has('armory_rack'));
      for (const beat of chapter.beats) for (const id of beat.flags) {
        assert.equal(getEraStoryGuide(region, w.done)!.targetId, id, 'next mandatory goal advances monotonically');
        if (id.startsWith('ghost_boat_')) {
          position([FORT_CANNON.station.x, FORT_CANNON.station.y, FORT_CANNON.station.z]);
          shootAt(id, true); frame(90); w.combat.state.hp = 100;
        } else if (id.startsWith('kikyo_banner_')) {
          position([-224, 11.56, 840]); frame(2); w.player.onGround = true;
          shootAt(id, false); frame(15); w.combat.state.hp = 100;
        } else interact(id);
        closeDialogue(); assert.ok(w.done.has(id), `${id} actual interaction completed`);
        // Settle the actual lazy-loader fetch/body/parse tasks, not a timed guess.
        await h.settleAssets();
      }
      assert.ok([...w.done].every((id: any) => !id.startsWith('shard_')), 'no optional fragment used as a mainline toll');
      assert.equal(getEraStoryState(region, w.done).stage, 'challenge');
      assert.equal(getEraStoryGuide(region, w.done)!.targetId, chapter.core);
      interact(chapter.core);
      assert.equal(w.combat.bossStarted, true);
      assert.equal(w.combat.damageEnemy(boss.id, 100000, { source: 'melee', origin: w.player.pos }), true);
      assert.ok(w.done.has(chapter.core)); assert.ok(w.done.has(boss.reward));
      if (region !== 'britain') {
        assert.equal(getEraStoryGuide(region, w.done)!.targetId, chapter.contract);
        interact(chapter.contract);
      }
      assert.ok(w.contract.roster.includes(({ britain: 'saber', blacksail: 'blackbeard', winter: 'napoleon', kyoto: 'musashi' } as const)[region]));
      assert.equal(getEraStoryGuide(region, w.done), null);
      const site = w.eraStoryScenes.find((entry: any) => entry.region === region);
      assert.equal(site.group.userData.state.discovered, false);
      interact(ERA_OPTIONALS[region].id); closeDialogue();
      assert.ok(w.done.has(ERA_OPTIONALS[region].id));
      assert.equal(site.group.userData.state.discovered, true, 'production world refresh projects the saved optional deed into scene art');
      const optionalWrites = progressWrites;
      interact(ERA_OPTIONALS[region].id); closeDialogue();
      assert.equal(progressWrites, optionalWrites, 'repeating the station does not duplicate a save/reward');
      resident(chapter.npc); closeDialogue();
      const beforeReplay = [...w.done].sort(), writesBeforeReplay = progressWrites;
      interact(chapter.core); assert.equal(w.combat.bossStarted, true);
      w.combat.damageEnemy(boss.id, 100000, { source: 'melee', origin: w.player.pos });
      assert.deepEqual([...w.done].sort(), beforeReplay, 'rematch cannot grant a second reward or remove optional work');
      assert.equal(progressWrites, writesBeforeReplay, 'rematch does not dispatch the first-clear save again');
      const rehydrated = new WorldProgress(window.localStorage);
      assert.deepEqual([...rehydrated.done].sort(), beforeReplay);
      assert.equal(getEraStoryGuide(region, rehydrated.done), null);
      const saved = JSON.parse(window.localStorage.getItem(WORLD_PROGRESS_KEY)!);
      assert.deepEqual([...saved.done].sort(), [...w.done].sort());
      window.confirm = () => true; key('KeyR');
      assert.equal(site.group.userData.state.discovered, false, 'reset restores the unrepaired scene state');
      assert.equal(w.done.size, 0); assert.equal(w.found.size, 0); assert.equal(w.contract.roster.length, 0);
      assert.equal(JSON.parse(window.localStorage.getItem(WORLD_PROGRESS_KEY)!).done.length, 0);
      assert.equal(getEraStoryGuide(region, w.done)!.targetId, chapter.beats[0].flags[0]);
      await enter();
    });
    await h.settleAssets();
    assert.deepEqual(h.errors, []); assert.deepEqual(h.warnings, []);
  } finally { await h.close(); }
});
