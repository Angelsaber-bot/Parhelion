import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPANIONS, CONTRACT_STORAGE_KEY } from '../src/companions/contracts';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

const ids = COMPANIONS.map(companion => companion.id);
const progress = JSON.stringify({ done: ['hq_terminal', 'armory_rack', 'summon_circle', ...COMPANIONS.map(companion => companion.contract)], found: [] });
const name = (id: string) => 'CharacterKit:' + (id === 'napoleon' ? 'napoleonMounted' : id);

test('all seven World companions share selection, recall, visibility and saved preference', async () => {
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: { [WORLD_PROGRESS_KEY]: progress } });
  let saved = '';
  try {
    const w = h.world, d = h.window.document;
    let time = 0;
    const frames = (count = 1) => { for (let i = 0; i < count; i++) h.frame(time += 1000 / 60); };
    const enter = async () => { (d.getElementById('start') as HTMLElement).click(); await Promise.resolve(); frames(3); };
    function key(action: string) {
      const code = w.settings.bindingsFor(action)[0];
      for (const type of ['keydown', 'keyup']) d.body.dispatchEvent(new h.window.KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
    }
    const rootFor = (id: string) => id === 'saber' ? w.servant.root : w.scene.getObjectByName(name(id));
    const visible = () => ids.filter(id => rootFor(id)?.visible);
    async function assertActive(id: string) {
      frames(); await h.settleAssets(); frames(18);
      assert.equal(w.contract.following, id);
      assert.deepEqual(visible(), [id]);
      let skinned = false;
      rootFor(id)!.traverse((node: { isSkinnedMesh?: boolean }) => { skinned ||= node.isSkinnedMesh === true; });
      assert.ok(skinned, id + ' loads its native rig');
    }
    await enter();
    await assertActive('saber');
    for (const id of ids.slice(1)) {
      const old = w.contract.following;
      key('switchServant');
      assert.equal(rootFor(old)?.visible ?? false, false, old + ' hides before the next renderer loads');
      await assertActive(id);
    }
    key('summon'); assert.deepEqual(visible(), []);
    key('summon'); await assertActive('qinShiHuang');

    d.exitPointerLock();
    (d.getElementById('servant-open') as HTMLElement).click();
    const panel = d.getElementById('servant-settings') as HTMLDialogElement;
    assert.ok(panel.open);
    const picker = panel.querySelector<HTMLSelectElement>('#servant-active')!;
    assert.deepEqual(Array.from(picker.options, option => option.value), ids);
    assert.equal(panel.querySelectorAll('select').length, 2, "one companion picker plus Saber's outfit control");
    assert.ok(panel.querySelector('#servant-outfit')?.closest('label')?.hidden);
    picker.value = 'jeanne'; picker.dispatchEvent(new h.window.Event('change'));
    picker.value = 'ozymandias'; picker.dispatchEvent(new h.window.Event('change'));
    assert.equal(rootFor('qinShiHuang')?.visible ?? false, false);
    panel.close(); await enter();
    await assertActive('ozymandias');
    key('summon'); assert.deepEqual(visible(), []);
    saved = h.window.localStorage.getItem(CONTRACT_STORAGE_KEY)!;
    assert.deepEqual(JSON.parse(saved), { version: 1, summoned: false, servant: 'ozymandias' });
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }

  const restored = await bootWorldWithoutGpu({ deterministic: true, initialStorage: {
    [WORLD_PROGRESS_KEY]: progress, [CONTRACT_STORAGE_KEY]: saved,
  } });
  try {
    const w = restored.world;
    assert.deepEqual([...w.contract.roster], ids);
    assert.equal(w.contract.selected, 'ozymandias');
    assert.equal(w.contract.following, null);
    assert.ok(!w.scene.getObjectByName(name('ozymandias'))?.visible);
  } finally { await restored.close(); }
});
