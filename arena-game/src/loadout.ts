import { bilingual, localizeText } from '../../shared-client/i18n.ts';
import { DEFAULT_LOADOUT, GUN_IDS, MELEE_IDS, MELEE_MOVE, TICK_HZ, WEAPONS, isLoadout, validateLoadout, weaponIndex, type Loadout, type WeaponDef, type WeaponId } from '../shared/content.ts';

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

/** Display labels are deliberately separate from stable weapon/protocol IDs and skin names. */
export function displayWeaponName(id: string): string {
  const names: Record<string, [string, string]> = {
    lumen: ['突击步枪 AR', 'Assault Rifle AR'], corona: ['霰弹枪', 'Shotgun'], halo: ['精确射手步枪 DMR', 'Marksman Rifle DMR'],
    firefly: ['冲锋枪 SMG', 'Submachine Gun SMG'], longnight: ['狙击步枪', 'Sniper Rifle'],
    blade: ['单手剑', 'Sword'], polearm: ['长枪', 'Spear'], hammer: ['战锤', 'War Hammer'],
  };
  const name = names[id];
  return name ? bilingual(...name) : bilingual('未知武器', 'Unknown weapon');
}
const ROLES: Record<string, [string, string]> = {
  lumen: ['均衡全自动，适合中距离持续交火', 'Balanced automatic fire for sustained mid-range combat'],
  corona: ['近距离九弹丸齐射，单发后需重新扣动扳机', 'Nine-pellet close-range burst; pull the trigger for each shot'],
  halo: ['半自动精确射击，适合中远距离', 'Precise semi-automatic fire for medium to long range'],
  firefly: ['高射速短程压制，远距离伤害较低', 'Rapid close-range fire with lower damage at distance'],
  longnight: ['慢速高伤狙击，强倍率瞄准，失手恢复慢', 'Slow, powerful sniper with high magnification and long recovery'],
  blade: ['短程快速斩击，伤害较低', 'Quick short-range slash with lower damage'],
  polearm: ['伸距较长的窄弧刺击，需要准确朝向', 'Long-reach narrow thrust; precise aim matters'],
  hammer: ['高伤宽弧重击，前摇和恢复较长', 'Heavy wide-arc hit with a long windup and recovery'],
};
export function weaponRole(id: string) { return ROLES[id] ? bilingual(...ROLES[id]) : ''; }
export function weaponStats(w: WeaponDef): string {
  if ((MELEE_IDS as readonly string[]).includes(w.id)) {
    return bilingual(
      `伤害 ${w.damage} · 距离 ${w.range}m · 移速 +${Math.round((MELEE_MOVE.speedMultiplier - 1) * 100)}% · 前摇 ${((w.windup ?? 0) / TICK_HZ).toFixed(2)}s · 间隔 ${(w.interval / TICK_HZ).toFixed(2)}s`,
      `Damage ${w.damage} · Range ${w.range}m · Move +${Math.round((MELEE_MOVE.speedMultiplier - 1) * 100)}% · Windup ${((w.windup ?? 0) / TICK_HZ).toFixed(2)}s · Interval ${(w.interval / TICK_HZ).toFixed(2)}s`);
  }
  const damage = w.pellets > 1 ? `${w.damage} × ${w.pellets}` : String(w.damage);
  return bilingual(`伤害 ${damage} · 弹匣 ${w.mag} · 间隔 ${(w.interval / TICK_HZ).toFixed(2)}s · 装填 ${(w.reload / TICK_HZ).toFixed(1)}s`,
    `Damage ${damage} · Magazine ${w.mag} · Interval ${(w.interval / TICK_HZ).toFixed(2)}s · Reload ${(w.reload / TICK_HZ).toFixed(1)}s`);
}

export function loadoutCards(loadout: Loadout, keyLabel: (action: string) => string) {
  return loadout.map((id, slot) => {
    const weapon = WEAPONS[weaponIndex(id)];
    return {
      slot, id, weapon, key: keyLabel(`weapon${slot + 1}`), label: slot === 2 ? bilingual('近战', 'Melee') : bilingual(`枪械 ${slot + 1}`, `Gun ${slot + 1}`),
      role: weaponRole(id), stats: weaponStats(weapon),
      choices: (slot === 2 ? MELEE_IDS : GUN_IDS).map((choice) => ({
        id: choice, name: displayWeaponName(choice),
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
    ammo: melee ? localizeText(windup > 0 ? '蓄势' : cooldown > 0 ? '恢复' : '就绪') : state.reload > 0 ? localizeText('装填中') : String(state.ammo[state.weapon]),
    detail: melee ? (windup > 0 ? bilingual(`${windup.toFixed(1)}s · 攻击已起手`, `${windup.toFixed(1)}s · Windup`) : cooldown > 0 ? `${cooldown.toFixed(1)}s` : bilingual(`${w.range}m · 近战`, `${w.range}m · Melee`)) : `/ ${w.mag}`,
    name: displayWeaponName(w.id),
    scope: w.id === 'longnight' ? bilingual('狙击镜', 'SNIPER SCOPE') : 'DMR',
    slots: state.loadout.map((id, slot) => ({ name: displayWeaponName(id), active: slot === state.weaponSlot })),
  };
}
