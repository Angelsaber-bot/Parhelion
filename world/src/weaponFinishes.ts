import type { ContractStorage } from './contracts';

export const WEAPON_FINISH_KEY = 'parhelion.world.weapon.finish.v1';
export type WeaponFinishId = 'original' | 'signal' | 'oath' | 'tide' | 'frost' | 'ember';
export interface WeaponFinish {
  readonly id: WeaponFinishId;
  readonly name: readonly [string, string];
  readonly story: readonly [string, string];
  readonly unlock?: string;
  readonly colors?: { readonly ivory: string; readonly dark: string; readonly copper: string; readonly glow: string; readonly amber: string };
}
/** Finish definitions contain ONLY appearance metadata. No weapon/range/damage fields,
 * mesh URLs, hitboxes, currency, purchases or multiplayer messages are involved.
 */
export const WEAPON_FINISHES: readonly WeaponFinish[] = [
  { id: 'original', name: ['原装 · 晨曦', 'Original · Dawn'], story: ['保留原装枪械与折光刃材质。', 'The original rifle and Refract Blade materials.'] },
  { id: 'signal', name: ['回声电台', 'Radio Echo'], unlock: 'campaign_alpha_complete', story: ['完成幻日谷居民纪事：留下能被听见的讯号。', 'Complete the Valley chronicle: leave a signal someone can hear.'], colors: { ivory: '#d9eee8', dark: '#183c46', copper: '#549b9d', glow: '#72eadc', amber: '#dca454' } },
  { id: 'oath', name: ['留名之誓', 'Remembered Oath'], unlock: 'campaign_britain_complete', story: ['完成落日王国居民纪事：让誓言记住普通人的名字。', 'Complete the Britain chronicle: let the oath remember ordinary names.'], colors: { ivory: '#e6ddc6', dark: '#292c52', copper: '#b39250', glow: '#9baceb', amber: '#e8c370' } },
  { id: 'tide', name: ['归港潮汐', 'Homeward Tide'], unlock: 'campaign_blacksail_complete', story: ['完成黑帆尽头居民纪事：为下一艘归船留一盏灯。', 'Complete the Black Sail chronicle: keep a light for the next ship home.'], colors: { ivory: '#d5e4dd', dark: '#194843', copper: '#b08a5b', glow: '#63ddbc', amber: '#d9bc75' } },
  { id: 'frost', name: ['雪线余温', 'Winter Ember'], unlock: 'campaign_winter_complete', story: ['完成永冬之城居民纪事：把一点余温留给后来者。', 'Complete the Winter chronicle: leave warmth for those who follow.'], colors: { ivory: '#e1e9ee', dark: '#344b68', copper: '#90adbf', glow: '#a3e5f0', amber: '#dc9f69' } },
  { id: 'ember', name: ['纸灯余烬', 'Paper Lantern'], unlock: 'campaign_kyoto_complete', story: ['完成业火京都居民纪事：让纸灯照见仍在的人。', 'Complete the Kyoto chronicle: let the lanterns reveal those who remain.'], colors: { ivory: '#e8d4bd', dark: '#422d32', copper: '#ad5240', glow: '#ffbd83', amber: '#ed925e' } },
];
export function weaponFinish(value: unknown): WeaponFinish | undefined {
  return typeof value === 'string' ? WEAPON_FINISHES.find(finish => finish.id === value) : undefined;
}
export function weaponFinishUnlocked(value: unknown, done: ReadonlySet<string>): boolean {
  const finish = weaponFinish(value); return !!finish && (!finish.unlock || done.has(finish.unlock));
}
/** Preferences cannot unlock content or mutate progress. An old preference stays saved
 * but renders original if a new-game save no longer has its story completion flag.
 */
export class WeaponFinishStore {
  private selected: WeaponFinishId = 'original';
  saved = false;
  constructor(private storage?: ContractStorage) {
    this.saved = !!storage;
    try {
      const text = storage?.getItem(WEAPON_FINISH_KEY);
      const data = text && text.length < 256 ? JSON.parse(text) : null;
      if (data?.version === 1 && weaponFinish(data.finish)) this.selected = data.finish;
    } catch { this.saved = false; }
  }
  get preference() { return this.selected; }
  active(done: ReadonlySet<string>): WeaponFinishId { return weaponFinishUnlocked(this.selected, done) ? this.selected : 'original'; }
  select(value: unknown, done: ReadonlySet<string>): boolean {
    if (!weaponFinishUnlocked(value, done)) return false;
    this.selected = value as WeaponFinishId;
    try {
      this.storage?.setItem(WEAPON_FINISH_KEY, JSON.stringify({ version: 1, finish: this.selected })); this.saved = !!this.storage;
    } catch { this.saved = false; }
    return true;
  }
}
