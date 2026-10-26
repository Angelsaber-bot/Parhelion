import { DEFAULT_LOADOUT, GUN_IDS, MELEE_IDS, TICK_HZ, WEAPONS, isLoadout, validateLoadout, weaponIndex, type Loadout, type WeaponDef, type WeaponId } from '../shared/content.ts';

export interface LoadoutStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const LOADOUT_KEY = 'parhelion-loadout-v1';
function browserStorage(): LoadoutStorage | undefined { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } }

/** Local convenience only: both server transports independently validate the submitted tuple. */
export class LoadoutStore {
  private selection: Loadout = [...DEFAULT_LOADOUT];
  saved = true;
  notice = '';
  constructor(private readonly storage: LoadoutStorage | undefined = browserStorage()) {
    try {
      const text = storage?.getItem(LOADOUT_KEY);
      if (text) {
        const raw = JSON.parse(text);
        if (raw?.version !== 1 || !isLoadout(raw.weapons)) throw new Error('version or selection');
        this.selection = validateLoadout(raw.weapons);
      }
    } catch { this.notice = '本机配装记录无效，已使用默认的两把枪和一件近战；其他设置不受影响。'; }
  }
  get value(): Loadout { return [...this.selection]; }
  select(slot: number, id: string): 'slot' | 'type' | 'duplicate' | null {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2) return 'slot';
    const allowed: readonly string[] = slot === 2 ? MELEE_IDS : GUN_IDS;
    if (!allowed.includes(id)) return 'type';
    if (slot < 2 && this.selection[1 - slot] === id) return 'duplicate';
    const next = [...this.selection]; next[slot] = id as WeaponId;
    this.selection = validateLoadout(next);
    try {
      this.storage?.setItem(LOADOUT_KEY, JSON.stringify({ version: 1, weapons: this.selection }));
      this.saved = !!this.storage;
    } catch { this.saved = false; }
    this.notice = this.saved ? '配装已保存到本机；下一局生效。' : '配装已应用；当前浏览器无法持久保存。';
    return null;
  }
}

const ROLES: Record<string, string> = {
  lumen: '曙光 · 均衡全自动，适合中距离持续交火',
  corona: '余辉 · 近距离九弹丸齐射，单发后需重新扣动扳机',
  halo: '子午线 · 半自动精确射击，适合中远距离',
  firefly: '流萤 · 高射速短程压制，远距离伤害较低',
  longnight: '长夜 · 慢速高伤狙击，强倍率瞄准，失手恢复慢',
  blade: '折光刃 · 短程快速斩击，伤害较低',
  polearm: '流星 · 伸距较长的窄弧刺击，需要准确朝向',
  hammer: '断层锤 · 高伤宽弧重击，前摇和恢复较长',
};
export function weaponRole(id: string) { return ROLES[id] ?? ''; }
export function weaponStats(w: WeaponDef): string {
  if ((MELEE_IDS as readonly string[]).includes(w.id)) {
    return `伤害 ${w.damage} · 距离 ${w.range}m · 前摇 ${((w.windup ?? 0) / TICK_HZ).toFixed(2)}s · 间隔 ${(w.interval / TICK_HZ).toFixed(2)}s`;
  }
  const damage = w.pellets > 1 ? `${w.damage} × ${w.pellets}` : String(w.damage);
  return `伤害 ${damage} · 弹匣 ${w.mag} · 间隔 ${(w.interval / TICK_HZ).toFixed(2)}s · 装填 ${(w.reload / TICK_HZ).toFixed(1)}s`;
}

export function loadoutCards(loadout: Loadout, keyLabel: (action: string) => string) {
  return loadout.map((id, slot) => {
    const weapon = WEAPONS[weaponIndex(id)];
    return {
      slot, id, weapon, key: keyLabel(`weapon${slot + 1}`), label: slot === 2 ? '近战' : `枪械 ${slot + 1}`,
      role: weaponRole(id), stats: weaponStats(weapon),
      choices: (slot === 2 ? MELEE_IDS : GUN_IDS).map((choice) => ({
        id: choice, name: WEAPONS[weaponIndex(choice)].name,
        disabled: slot < 2 && loadout[1 - slot] === choice,
      })),
    };
  });
}

/** The saved legacy skin array is catalog-indexed, never loadout-slot-indexed. */
export function sanitizedSkins(raw: unknown): number[] {
  return WEAPONS.map((w, i) => {
    const n: unknown = Array.isArray(raw) ? raw[i] : undefined;
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < w.skins.length ? n : 0;
  });
}

/** Pure presentation derived from authoritative/predicted state, easy to exercise without WebGL. */
export function weaponHud(state: {
  weapon: number; weaponSlot: number; loadout: Loadout; ammo: number[];
  reload: number; fireCd: number; meleeWindup: number;
}, skins: number[]) {
  const w = WEAPONS[state.weapon];
  const melee = w.kind === 'melee';
  const windup = state.meleeWindup / TICK_HZ;
  const cooldown = state.fireCd / TICK_HZ;
  return {
    melee,
    ammo: melee ? (windup > 0 ? '蓄势' : cooldown > 0 ? '恢复' : '就绪') : state.reload > 0 ? '装填中' : String(state.ammo[state.weapon]),
    detail: melee ? (windup > 0 ? `${windup.toFixed(1)}s · 攻击已起手` : cooldown > 0 ? `${cooldown.toFixed(1)}s` : `${w.range}m · 近战`) : `/ ${w.mag}`,
    name: `${w.name} · ${(w.skins[skins[state.weapon]] ?? w.skins[0]).name}`,
    scope: w.id === 'longnight' ? 'LONGNIGHT · 狙击镜' : 'HALO · DMR',
    slots: state.loadout.map((id, slot) => ({ name: WEAPONS[weaponIndex(id)].name, active: slot === state.weaponSlot })),
  };
}
