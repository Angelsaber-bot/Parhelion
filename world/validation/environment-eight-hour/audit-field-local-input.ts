/** Actual-main local locomotion only. Each segment has one explicit supported setup
 * placement; thereafter keyboard/mouse + production RAF, no forced ground/state edits.
 * Not a full journey, combat trial, GPU test or human discoverability test. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bootWorldWithoutGpu } from '../world-dom-boot.fixture';
const out = process.argv[2]; assert(out, 'OUTPUT_DIR required');
const h = await bootWorldWithoutGpu({ deterministic: true, effectsQuality: 'med' });
const w = h.world, d = h.window.document; let now = 0;
const frame = () => h.frame(now += 1000 / 60);
const hold = (down: boolean) => d.body.dispatchEvent(new h.window.KeyboardEvent(down ? 'keydown' : 'keyup', { code: 'KeyW', bubbles: true }));
const cases: [string, [number, number], [number, number]][] = [
  ['alpha-exit', [-45,-98.8], [-52,-85]],
  ['alpha-peek', [-52,-91], [-53.5,-91]],
  ['harbor-exit', [794,27.2], [786,28]],
  ['harbor-peek', [786,35], [786,32]],
  ['winter-exit', [64.1,-631.6], [60,-626]],
  ['winter-peek', [60,-625], [60,-628.5]],
];
const results: any[] = [];
try {
  (d.getElementById('start') as HTMLElement).click(); await Promise.resolve();
  for (const [label, start, target] of cases) {
    w.player.teleport(start[0], w.ground(...start) + .08, start[1]);
    for (let i = 0; i < 60; i++) frame();
    assert(w.player.onGround && !w.player.swimming, `${label}: supported setup`);
    const feet = w.player.pos.toArray(), before = now;
    let reached = false, swimmingFrames = 0, airborneFrames = 0;
    for (let i = 0; i < 1800 && !w.combat.defeated; i++) {
      if (Math.hypot(w.player.pos.x-target[0], w.player.pos.z-target[1]) < .24) { reached = true; break; }
      const yaw = Math.atan2(-(target[0]-w.player.pos.x), -(target[1]-w.player.pos.z));
      const delta = Math.atan2(Math.sin(w.player.yaw-yaw), Math.cos(w.player.yaw-yaw));
      const mouse = new h.window.MouseEvent('mousemove', { bubbles: true });
      Object.defineProperties(mouse, {
        movementX: { value: Math.max(-.07,Math.min(.07,delta)) / (.0022*w.settings.value.sensitivity) },
        movementY: { value: w.player.pitch / (.0022*w.settings.value.sensitivity) },
      });
      d.dispatchEvent(mouse); hold(Math.abs(delta) < .35); frame();
      if (w.player.swimming) swimmingFrames++;
      if (!w.player.onGround) airborneFrames++;
    }
    hold(false); for (let i = 0; i < 30; i++) frame();
    const row = { label, setup: feet, target, reached, seconds: (now-before)/1000,
      feet: w.player.pos.toArray(), onGround: w.player.onGround, swimmingFrames,
      airborneFrames, hp: w.combat.state.hp, defeated: w.combat.defeated };
    results.push(row); console.log(JSON.stringify(row));
    assert(reached && w.player.onGround && !swimmingFrames && !w.combat.defeated, `${label}: ordinary walk failed`);
  }
  assert.equal(h.errors.length, 0);
} finally {
  hold(false); await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'local-input.json'), JSON.stringify({
    setup: 'One explicit supported placement per independent local segment, normal settle; no subsequent position/ground/state writes',
    mode: 'Production main keyboard/mouse/RAF, no GPU', results,
  }, null, 2) + '\n');
  await h.close();
}
