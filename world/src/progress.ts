/** Progress is deliberately separate from controls, locale, graphics and cosmetic preferences. */
export const WORLD_PROGRESS_KEY = 'parhelion.world.progress.v2';
export const LEGACY_WORLD_PROGRESS_KEYS = ['parhelion.world_alpha.progress.v1', 'parhelion.world_coast.progress.v1'] as const;
export const ARMORY_MARKER = 'armory_rack';
export const INITIAL_SPAWN_ID = 'spawn_p1';
/** Only these debug overrides can restore a different start or grant progress on reload. */
export function clearStartOverrides(params: URLSearchParams) {
  for (const key of ['region', 'spawn', 'cam', 'lit']) params.delete(key);
}
export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function flags(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
}

/** The armory quest flag is the single source of weapon ownership; no stale selected slot can equip it. */
export class WorldProgress {
  readonly done = new Set<string>();
  readonly found = new Set<string>();
  constructor(private storage?: ProgressStorage) {
    let current: string | null;
    try { current = storage?.getItem(WORLD_PROGRESS_KEY) ?? null; } catch { return; }
    if (current !== null) {
      // Even an empty reset snapshot is authoritative. Never merge old v1 quests back into it.
      this.read(current);
      return;
    }
    let migrated = false;
    for (const key of LEGACY_WORLD_PROGRESS_KEYS) {
      try {
        const raw = storage?.getItem(key);
        if (raw != null) { this.read(raw); migrated = true; }
      } catch { /* Other legacy regions can still be recovered. */ }
    }
    if (migrated) this.save();
  }
  get equippedWeapon(): 'dawn_ar' | null { return this.done.has(ARMORY_MARKER) ? 'dawn_ar' : null; }
  get armed() { return this.equippedWeapon !== null; }
  private read(raw: string) {
    try {
      const value = JSON.parse(raw);
      for (const id of flags(value?.done)) this.done.add(id);
      for (const id of flags(value?.found)) this.found.add(id);
    } catch { /* Invalid progress cannot restore inventory, location or arbitrary object fields. */ }
  }
  save(): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(WORLD_PROGRESS_KEY, JSON.stringify({ done: [...this.done], found: [...this.found] }));
    } catch { return false; }
    // Remove only superseded progress, and only after the authoritative replacement was written.
    // Keeping a legacy key when removeItem is unavailable is safe: current always wins on reload.
    for (const key of LEGACY_WORLD_PROGRESS_KEYS) {
      try { this.storage.removeItem?.(key); } catch { /* Current snapshot remains authoritative. */ }
    }
    return true;
  }
  reset(): boolean { this.done.clear(); this.found.clear(); return this.save(); }
}
