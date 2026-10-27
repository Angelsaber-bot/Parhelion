import { describe, expect, it, vi } from 'vitest';
import { Hud } from '../src/hud.ts';
import { newPlayer } from '../shared/sim.ts';
import type { Snapshot } from '../shared/match.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { DEFAULT_LOADOUT, GUN_IDS, MELEE_IDS, WEAPONS, weaponIndex, type Loadout } from '../shared/content.ts';
import { displayWeaponName, LOADOUT_KEY, LoadoutStore, loadoutCards, sanitizedSkins, weaponHud, weaponStats } from '../src/loadout.ts';
import { SettingsStore } from '../../shared-client/settings.ts';
import { readFileSync } from 'node:fs';

function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
function presentation(loadout: Loadout, slot = 0) {
  return { loadout, weaponSlot: slot, weapon: weaponIndex(loadout[slot]), ammo: WEAPONS.map((w) => w.mag), reload: 0, fireCd: 0, meleeWindup: 0 };
}

describe('local two-gun/one-melee loadout selection', () => {
  it('starts with a safe default and exposes defensive copies', () => {
    const store = new LoadoutStore(storage());
    expect(store.value).toEqual(DEFAULT_LOADOUT);
    const copy = store.value; copy[0] = 'longnight';
    expect(store.value).toEqual(DEFAULT_LOADOUT);
  });
  it('round-trips every one of 60 valid combinations, including all eight weapons', () => {
    let combinations = 0;
    for (const first of GUN_IDS) for (const second of GUN_IDS) for (const melee of MELEE_IDS) {
      if (first === second) continue;
      const disk = storage();
      disk.values.set(LOADOUT_KEY, JSON.stringify({ version: 1, weapons: [first, second, melee] }));
      const store = new LoadoutStore(disk);
      expect(store.value).toEqual([first, second, melee]);
      expect(store.select(2, melee)).toBeNull();
      expect(new LoadoutStore(disk).value).toEqual([first, second, melee]);
      combinations++;
    }
    expect(combinations).toBe(60);
  });
  it('changes slots immediately, persists before starting a match, and keeps the other choices', () => {
    const disk = storage(), store = new LoadoutStore(disk);
    expect(store.select(0, 'longnight')).toBeNull();
    expect(store.select(1, 'firefly')).toBeNull();
    expect(store.select(2, 'hammer')).toBeNull();
    expect(new LoadoutStore(disk).value).toEqual(['longnight', 'firefly', 'hammer']);
    expect(store.notice).toContain('下一局');
  });
  it('rejects duplicate guns, wrong categories, unknown/prohibited IDs and invalid slots without changing or persisting', () => {
    const disk = storage(), store = new LoadoutStore(disk);
    for (const [slot, id, error] of [[0, 'corona', 'duplicate'], [0, 'blade', 'type'], [2, 'lumen', 'type'], [0, 'admin', 'type'], [2, '__proto__', 'type'], [0, '<script>', 'type'], [3, 'halo', 'slot'], [-1, 'halo', 'slot'], [.5, 'halo', 'slot'], [NaN, 'halo', 'slot']] as const) {
      expect(store.select(slot, id)).toBe(error);
      expect(store.value).toEqual(DEFAULT_LOADOUT);
      expect(disk.values.has(LOADOUT_KEY)).toBe(false);
    }
  });
  it('recovers corrupt data without touching legacy lobby/skins/input records', () => {
    for (const raw of ['{broken', 'null', '[]', '{"version":9}', '{"version":1}', '{"version":1,"weapons":["lumen","lumen","blade"]}', '{"version":1,"weapons":[0,1,5]}']) {
      const disk = storage(); disk.values.set(LOADOUT_KEY, raw); disk.values.set('arena-lobby', 'preserve me');
      const store = new LoadoutStore(disk);
      expect(store.value).toEqual(DEFAULT_LOADOUT); expect(store.notice).toContain('记录无效');
      expect(disk.values.get('arena-lobby')).toBe('preserve me');
      expect(disk.values.get(LOADOUT_KEY)).toBe(raw);
    }
  });
  it('keeps the session usable when localStorage is blocked and reports non-persistence', () => {
    const store = new LoadoutStore({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
    expect(store.select(2, 'polearm')).toBeNull(); expect(store.value[2]).toBe('polearm');
    expect(store.saved).toBe(false); expect(store.notice).toContain('无法持久保存');
  });
});

describe('lobby and combat equipment presentation', () => {
  it('lists five gun choices and three melee choices, disabling only the other selected gun', () => {
    const cards = loadoutCards(['longnight', 'halo', 'polearm'], (action) => `remapped-${action}`);
    expect(cards.map((c) => c.choices.length)).toEqual([5, 5, 3]);
    expect(cards.map((c) => c.key)).toEqual(['remapped-weapon1', 'remapped-weapon2', 'remapped-weapon3']);
    expect(cards[0].choices.filter((c) => c.disabled).map((c) => c.id)).toEqual(['halo']);
    expect(cards[1].choices.filter((c) => c.disabled).map((c) => c.id)).toEqual(['longnight']);
    expect(cards[2].choices.some((c) => c.disabled)).toBe(false);
  });
  it('key hints follow the real current binding and never show a hard-coded numeric slot', () => {
    const settings = new SettingsStore('arena', storage());
    expect(settings.bind('weapon1', 'KeyP')).toBeNull();
    const cards = loadoutCards(['firefly', 'longnight', 'blade'], (action) => settings.label(action));
    expect(cards[0].key).toBe('P'); expect(cards[0].weapon.id).toBe('firefly');
  });
  it('uses catalog-indexed ammo/skin and slot-indexed highlights for non-default loadouts', () => {
    const state = presentation(['longnight', 'firefly', 'hammer'], 1); state.ammo[3] = 7;
    const view = weaponHud(state, sanitizedSkins([1, 1, 1]));
    expect(view.ammo).toBe('7'); expect(view.detail).toBe('/ 36');
    expect(view.name).toBe('冲锋枪 SMG'); expect(view.slots.map((s) => s.active)).toEqual([false, true, false]);
    expect(view.slots.map((s) => s.name)).toEqual(['狙击步枪', '冲锋枪 SMG', '战锤']);
  });
  it('renders gun reload and the actual scoped weapon name', () => {
    const state = presentation(['longnight', 'halo', 'blade']); state.reload = 60;
    expect(weaponHud(state, []).ammo).toBe('装填中');
    expect(weaponHud(state, []).scope).toContain('狙击镜');
    state.weapon = 2; state.weaponSlot = 1;
    expect(weaponHud(state, []).scope).toBe('DMR');
  });
  it('shows every melee weapon windup, recovery, and ready state instead of zero ammunition', () => {
    for (const id of MELEE_IDS) {
      const state = presentation(['lumen', 'corona', id], 2), w = WEAPONS[state.weapon];
      let view = weaponHud(state, []);
      expect(view.melee).toBe(true); expect(view.ammo).toBe('就绪'); expect(view.detail).toContain(`${w.range}m`);
      state.meleeWindup = w.windup!; state.fireCd = w.interval;
      view = weaponHud(state, []); expect(view.ammo).toBe('蓄势'); expect(view.detail).toContain('攻击已起手');
      state.meleeWindup = 0; view = weaponHud(state, []); expect(view.ammo).toBe('恢复');
      expect(weaponStats(w)).toContain('前摇'); expect(weaponStats(w)).not.toContain('弹匣');
    }
  });
  it('preserves existing skin choices and safely extends the legacy three-weapon array', () => {
    expect(sanitizedSkins([1, 1, 1])).toEqual([1, 1, 1, 0, 0, 0, 0, 0]);
    expect(sanitizedSkins([NaN, -1, 9, 1, .5])).toEqual(WEAPONS.map(() => 0));
    expect(sanitizedSkins({ 0: 1 })).toEqual(WEAPONS.map(() => 0));
  });
  it('ships three HUD slots, an accessible loadout panel, prototype disclosure, and submits selection through shared JoinOptions', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
    const armory = readFileSync(new URL('../src/armory.ts', import.meta.url), 'utf8');
    expect((html.match(/class="wslot"/g) ?? []).length).toBe(3);
    expect(html).toContain('aria-label="出战配装"'); expect(html).toContain('尚未经过竞技平衡验证');
    expect(main).toContain('loadout: loadoutStore.value'); expect(main).toContain('if (starting) return');
    expect(main).toContain("settings.label(action)");
    expect(armory).not.toContain('仅模型展示'); expect(armory).not.toContain('不能装备作战');
  });
});


it('updates the real HUD using new player state without overwriting remapped keys on repeated weapon swaps', () => {
  class Element {
    textContent = ''; innerHTML = ''; attributes = new Map<string, string>();
    private children = new Map<string, Element>();
    private classes = new Set<string>();
    style = { opacity: '', width: '', setProperty() {} };
    classList = {
      toggle: (name: string, force?: boolean) => { const on = force ?? !this.classes.has(name); if (on) this.classes.add(name); else this.classes.delete(name); return on; },
      add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name), contains: (name: string) => this.classes.has(name),
    };
    querySelector(selector: string): Element { if (!this.children.has(selector)) this.children.set(selector, new Element()); return this.children.get(selector)!; }
    querySelectorAll(_selector: string): Element[] { return slots; }
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  }
  const slots = [new Element(), new Element(), new Element()];
  slots.forEach((el, i) => { el.querySelector('kbd').textContent = ['P', '鼠标侧键 1', '3'][i]; });
  const nodes = new Map<string, Element>();
  const el = (id: string) => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id)!; };
  vi.stubGlobal('document', { getElementById: el });
  try {
    const hud = new Hud(), p = newPlayer('self', 'A', 0, ['longnight', 'firefly', 'hammer']); p.alive = true;
    const self = { ...p, name: 'Player', skins: [], bot: false, kills: 0, deaths: 0, respawn: 0 };
    const snap: Snapshot = { rulesVersion: RULES_VERSION, tick: 0, layout: '1v1', phase: 'live', phaseT: 60, score: { A: 0, B: 0 }, players: [self], shields: [], events: [] };
    for (const slot of [0, 1, 2, 0, 2]) {
      p.weaponSlot = slot; p.weapon = weaponIndex(p.loadout[slot]);
      hud.update(1 / 60, p, snap, p.id, false, 'local');
      expect(slots.map((node) => node.classList.contains('on'))).toEqual([0, 1, 2].map((n) => n === slot));
      expect(slots.map((node) => node.querySelector('kbd').textContent)).toEqual(['P', '鼠标侧键 1', '3']);
      expect(el('wname').textContent).toBe(displayWeaponName(WEAPONS[p.weapon].id));
      expect(el('weapon').classList.contains('melee')).toBe(slot === 2);
    }
    p.meleeWindup = 30; p.fireCd = 72; hud.update(1 / 60, p, snap, p.id, false, 'local');
    expect(el('ammo').textContent).toBe('蓄势'); expect(el('mag').textContent).toContain('0.5s');
    expect(slots[0].attributes.get('aria-label')).toContain('P · 狙击步枪');
    el('scoreA').textContent = '7'; el('scoreB').textContent = '4'; el('clock').textContent = '2:45';
    el('scoreboard').innerHTML = 'old scores';
    hud.resetRound();
    expect(el('scoreA').textContent).toBe('0'); expect(el('scoreB').textContent).toBe('0');
    expect(el('clock').textContent).toBe('—'); expect(el('limit').textContent).toBe('');
    expect(el('ammo').textContent).toBe('—'); expect(el('wname').textContent).toBe('');
    expect(el('scoreboard').innerHTML).toBe(''); expect(el('scoreboard').classList.contains('hidden')).toBe(true);
    expect(el('banner').textContent).toBe(''); expect(el('banner').classList.contains('hidden')).toBe(true);
  } finally { vi.unstubAllGlobals(); }
});
