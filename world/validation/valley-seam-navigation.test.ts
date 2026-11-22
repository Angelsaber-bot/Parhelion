import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_PROGRESS_KEY, WorldProgress } from '../src/core/progress';
import { REGIONS } from '../src/map/regions';
import { nextStoryPass } from '../src/story/trackedStoryNavigation';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('the three surviving valley surveys unlock the circle and its directions follow the mainland road', async () => {
  const flags = ['seam_west', 'seam_north', 'seam_east'];
  const start = JSON.stringify({ done: ['tower_console', 'armory_rack'], found: [] });
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: { [WORLD_PROGRESS_KEY]: start } });
  const w = h.world, d = h.window.document, markers = w.layout.markers;
  let finished = '';
  let now = 0;
  function frames(n: number) { for (let i = 0; i < n; i++) h.frame(now += 1000 / 60); }
  function use(id: string) {
    const m = markers.find((entry: { id: string }) => entry.id === id);
    assert.ok(m, id);
    const [x, y, z] = m.p;
    const floor = w.combat.geometry.ground(x, z, y + 1.2);
    assert.ok(floor, id);
    w.player.teleport(x, floor.point.y + .15, z);
    frames(15);
    const code = w.settings.bindingsFor('interact')[0];
    for (const type of ['keydown', 'keyup']) d.body.dispatchEvent(new h.window.KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
  }
  try {
    (d.getElementById('start') as HTMLElement).click(); await Promise.resolve(); frames(3);
    const circle = markers.find((m: { id: string }) => m.id === 'summon_circle');
    const seams = w.layout.objectives.find((o: { region: string }) => o.region === 'alpha').objective.steps.find((s: { id: string }) => s.id === 'seams');
    assert.deepEqual([...circle.requires], flags); assert.deepEqual([...seams.done], flags);
    assert.ok(!markers.some((m: { id: string }) => m.id === 'seam_south'));
    assert.equal(w.layout.areas.find((a: {id: string}) => a.id === 'seam_s').nameEn, 'Old South Road');
    for (const id of flags) {
      use('summon_circle');
      assert.ok(!w.done.has('summon_circle'), 'an outstanding survey still blocks the circle');
      use(id);
      assert.ok(w.done.has(id), 'real interact at ' + id + ': ' + d.getElementById('prompt')?.textContent);
    }
    use('summon_circle');
    assert.ok(w.done.has('summon_circle'));
    assert.match(d.getElementById('toast')!.textContent!, /北路通永冬.*永冬向东进入黑帆.*从黑帆向北.*京都/);
    const route = ['alpha', 'winter', 'blacksail', 'kyoto'];
    for (let i = 0; i < route.length - 1; i++) assert.equal(nextStoryPass(route[i], 'kyoto')?.toward, route[i + 1]);
    const [valley, winter, coast, kyoto] = route.map(id => REGIONS.find(region => region.id === id)!.offset);
    assert.ok(winter[1] < valley[1] && coast[0] > winter[0] && kyoto[1] < coast[1], 'north, east, north in world coordinates');
    const restored = new WorldProgress(h.window.localStorage);
    for (const id of [...flags, 'summon_circle']) assert.ok(restored.done.has(id), 'restored ' + id);
    assert.ok(!restored.done.has('seam_south'));
    finished = h.window.localStorage.getItem(WORLD_PROGRESS_KEY)!;
    const previous = JSON.parse(finished);
    previous.done.push('seam_south');
    h.window.localStorage.setItem(WORLD_PROGRESS_KEY, JSON.stringify(previous));
    assert.ok(new WorldProgress(h.window.localStorage).done.has('seam_south'), 'the retired survey survives in an older save');
  } finally { await h.close(); }
  const reload = await bootWorldWithoutGpu({ deterministic: true, initialStorage: { [WORLD_PROGRESS_KEY]: finished } });
  try {
    assert.ok(reload.world.done.has('summon_circle'));
    assert.ok(!reload.world.done.has('seam_south'));
    for (const id of flags) assert.ok(reload.world.done.has(id), id);
  } finally { await reload.close(); }
});
