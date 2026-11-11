import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterKit, type CharacterKitDefinition } from '../src/characters/characterKit.ts';
import { ModelCompanion } from '../src/companions/modelCompanion.ts';
import { FirstContract } from '../src/companions/contracts.ts';
import { ContractServant, SERVANT_CLIPS } from '../src/companions/servant.ts';
import { setLanguage } from '../../shared-client/i18n.ts';
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context); } });

class Element {
  id = ''; type = ''; className = ''; textContent = ''; value = ''; hidden = false; disabled = false; open = false; removed = false;
  children: Element[] = []; attributes = new Map<string, string>(); listeners = new Map<string, ((e: any) => void)[]>();
  onclick?: (e: any) => void; onchange?: (e: any) => void;
  append(...nodes: Element[]) { this.children.push(...nodes); }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  addEventListener(name: string, listener: (e: any) => void) { this.listeners.set(name, [...this.listeners.get(name) ?? [], listener]); }
  removeEventListener(name: string, listener: (e: any) => void) { this.listeners.set(name, (this.listeners.get(name) ?? []).filter(fn => fn !== listener)); }
  showModal() { this.open = true; } close() { this.open = false; } remove() { this.removed = true; }
}
const body = new Element(), doc = Object.assign(new Element(), { body, documentElement: { lang: 'zh-CN' }, pointerLockElement: null, createElement: () => new Element() });
(globalThis as any).document = doc;
const { createServantPanel } = await import('../src/ui/servantPanel.ts');
const { createModelCompanionControls } = await import('../src/ui/modelCompanionControls.ts');
const flatten = (root: Element): Element[] => [root, ...root.children.flatMap(flatten)];
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function fixture(definition: CharacterKitDefinition) {
  const scene = new THREE.Group();
  for (const socket of Object.values(definition.sockets)) { const node = new THREE.Object3D(); node.name = socket.node; scene.add(node); }
  return new CharacterKit({ scene, animations: Object.values(definition.clips).map(clip => new THREE.AnimationClip(clip.name, clip.duration, [])) } as GLTF, definition);
}

test('model selector remains separate from story roster; retry, rapid choices, None, language and modal cleanup work', async () => {
  const done = new Set(['saber_contract', 'relay_a']), contract = new FirstContract(done), scene = new THREE.Scene();
  const servant = new ContractServant({ scene, marker: { id: 'saber_contract', type: 'interact', label: 'Saber', p: [0, 0, 0] }, contract, colliders: [], target: () => null, strike: () => null,
    load: async () => ({ scene: new THREE.Group(), animations: SERVANT_CLIPS.map(name => new THREE.AnimationClip(name, 1, [])) }) as GLTF });
  let loads = 0;
  const companion = new ModelCompanion({ scene, colliders: [], load: async definition => { if (++loads === 1) throw new Error('unavailable'); return fixture(definition); } });
  let opens = 0;
  const panel = createServantPanel(servant, contract, () => { opens++; });
  const controls = createModelCompanionControls(companion); panel.addSection(controls);
  const all = flatten(body), launcher = all.find(element => element.id === 'servant-open')!, dialog = all.find(element => element.id === 'servant-settings')!;
  const select = all.find(element => element.id === 'model-companion')!, retry = all.find(element => element.id === 'model-companion-retry')!;
  assert.equal(select.value, ''); assert.deepEqual(select.children.map(option => option.value), ['', 'jeanne', 'ozymandias', 'qinShiHuang']); assert.equal(loads, 0);
  launcher.onclick!({ stopPropagation() {} }); launcher.onclick!({ stopPropagation() {} }); assert.equal(opens, 1);
  select.value = 'jeanne'; select.onchange!({}); await settle(); panel.render(); assert.equal(companion.state, 'failed'); assert.equal(retry.hidden, false);
  retry.onclick!({}); await settle(); panel.render(); assert.equal(companion.state, 'ready'); assert.equal(retry.hidden, true);
  select.value = 'ozymandias'; select.onchange!({}); select.value = 'qinShiHuang'; select.onchange!({}); await settle(); panel.render(); assert.equal(companion.selected, 'qinShiHuang');
  dialog.close(); launcher.onclick!({ stopPropagation() {} }); assert.equal(select.value, 'qinShiHuang');
  setLanguage('en'); assert.equal(select.children[3].textContent, 'Qin Shi Huang'); assert.match((controls.element as unknown as Element).children[0].children[0].textContent, /Claimable/);
  select.value = ''; select.onchange!({}); await settle(); panel.render(); assert.equal(companion.actor, undefined); assert.equal(companion.state, 'off');
  assert.deepEqual([...done], ['saber_contract', 'relay_a']); assert.equal(contract.selected, 'saber'); assert.equal(contract.summoned, true);
  let stopped = 0; for (const listener of dialog.listeners.get('keydown')!) listener({ stopPropagation() { stopped++; } }); assert.equal(stopped, 1);
  panel.dispose(); panel.dispose(); assert.equal((controls.element as unknown as Element).removed, true); assert.equal(select.onchange, null); assert.equal(retry.onclick, null);
  companion.dispose(); servant.dispose(); setLanguage('zh');
});
