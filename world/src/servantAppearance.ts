import type { ContractStorage } from './contracts';

export type ServantOutfit = 'armor' | 'civilian';
export const SERVANT_APPEARANCE_KEY = 'parhelion.world.servant.appearance.v1';
export const isServantOutfit = (value: unknown): value is ServantOutfit => value === 'armor' || value === 'civilian';

/** Cosmetic only: never changes recruitment, summon state, quest flags or combat stats. */
export class ServantAppearance {
  private selected: ServantOutfit = 'armor';
  saved = false;
  constructor(private storage?: ContractStorage) {
    this.saved = !!storage;
    try {
      const data = JSON.parse(storage?.getItem(SERVANT_APPEARANCE_KEY) ?? 'null');
      if (data?.version === 1 && isServantOutfit(data.outfit)) this.selected = data.outfit;
    } catch { this.saved = false; /* Cosmetic storage must not affect a quest save. */ }
  }
  get outfit() { return this.selected; }
  select(value: unknown) {
    if (!isServantOutfit(value)) return false;
    this.selected = value;
    try {
      this.storage?.setItem(SERVANT_APPEARANCE_KEY, JSON.stringify({ version: 1, outfit: value }));
      this.saved = !!this.storage;
    } catch { this.saved = false; }
    return true;
  }
}
