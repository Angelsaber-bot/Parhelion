import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_PROGRESS_KEY } from '../src/core/progress';
import { COMPANIONS } from '../src/companions/contracts';
import { CONTRACT_SKILLS } from '../src/companions/contractSkills';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

test('regional companion inputs use native rigs and resolve each authored contact once', async t => {
  const progress = JSON.stringify({ done: ['hq_terminal', 'armory_rack', 'summon_circle',
    ...COMPANIONS.map(companion => companion.contract)], found: [] });
  const h = await bootWorldWithoutGpu({ deterministic: true, initialStorage: { [WORLD_PROGRESS_KEY]: progress } });
  const { world: w, window } = h;
  let now = 0;
  const frame = (count = 1) => { for (let i = 0; i < count; i++) h.frame(now += 1000 / 60); };
  const key = (action: string) => {
    const code = w.settings.bindingsFor(action)[0];
    for (const type of ['keydown', 'keyup']) window.document.body.dispatchEvent(new window.KeyboardEvent(type, { code, bubbles: true }));
  };
  const center = w.layout.markers.find((m: {id: string}) => m.id === 'boss_vacant_king').p;
  const ground = (x: number, z: number) => {
    const hit = w.combat.geometry.ground(x, z, center[1] + 3);
    assert.ok(hit);
    return hit.point.y;
  };
  const enemy = w.combat.state.enemies.find((e: {kind: string; miniboss?: string}) => e.kind !== 'king' && !e.miniboss);
  const hits: {id: string; damage: number; source: string}[] = [];
  const record = w.actions.recordDamage.bind(w.actions);
  w.actions.recordDamage = (hit: typeof hits[number]) => { hits.push({ ...hit }); record(hit); };
  try {
    (window.document.getElementById('start') as HTMLElement).click();
    await Promise.resolve(); frame(3); await h.settleAssets();
    for (const actor of w.combat.state.enemies) if (actor !== enemy) {
      actor.mode = 'dead'; actor.timer = Infinity; actor.hp = 0; actor.active = false;
    }
    for (const id of ['jeanne', 'ozymandias', 'qinShiHuang'] as const) {
      async function ready() {
        w.ultimateDirector.abort(); w.actions.reset(); w.contract.select(id);
        w.player.teleport(center[0], ground(center[0], center[2] + 7) + .05, center[2] + 7);
        w.player.onGround = true;
        w.player.flying = w.player.swimming = w.player.gliding = false;
        Object.assign(enemy.p, { x: center[0], y: ground(center[0], center[2]), z: center[2] });
        Object.assign(enemy.home, enemy.p);
        Object.assign(enemy, { hp: 10000, maxHp: 10000, mode: 'recover', timer: 100, active: true, pacified: false });
        frame(20); await h.settleAssets(); frame(2);
        const root = w.scene.getObjectByName('CharacterKit:' + id);
        assert.ok(root?.visible);
        root.position.set(center[0], ground(center[0], center[2] + 4), center[2] + 4);
        w.camera.lookAt(enemy.p.x, enemy.p.y + 1, enemy.p.z); w.camera.updateMatrixWorld();
        hits.length = 0;
      }
      const expectContacts = (slot: 'skill' | 'ultimate') => {
        const contacts = hits.filter(hit => hit.source === slot && hit.id === enemy.id).map(hit => hit.damage);
        assert.deepEqual(contacts, CONTRACT_SKILLS[id][slot].pulses.map(pulse => pulse.damage));
      };
      await t.test(id + ' skill', async () => {
        await ready(); key('skill');
        assert.equal(w.actions.skills.casting, true);
        if (id === 'jeanne') assert.equal(w.actions.skills.guarding, true);
        frame(100); expectContacts('skill');
        assert.equal(w.actions.skills.casting, false);
      });
      for (const mode of ['full', 'off'] as const) await t.test(id + ' ultimate ' + mode, async () => {
        await ready(); w.ultimateDirector.setMode(mode); w.actions.skills.energyValue = 100;
        key('ultimate');
        assert.equal(w.actions.skills.casting, true);
        const art = w.ultimateStage.scene.getObjectByName('RegionalUltimate:' + id.toLowerCase());
        assert.equal(Boolean(art), mode === 'full');
        for (let i = 0; i < 900 && w.ultimateDirector.active; i++) frame();
        assert.equal(w.ultimateDirector.active, false);
        assert.equal(w.actions.skills.casting, false);
        assert.equal(w.actions.skills.energy, 0);
        expectContacts('ultimate');
      });
    }
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});
