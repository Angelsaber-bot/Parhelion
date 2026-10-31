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
export type ProgressPersistenceState = 'ready' | 'saved' | 'unavailable' | 'invalid' | 'failed';
export interface ProgressSnapshot { done: string[]; found: string[]; }
/** Imports are intentionally stricter than historical save migration. */
export function parseProgressBackup(raw: string): ProgressSnapshot | null {
  if (raw.length > 262144) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const valid = (list: unknown): list is string[] => Array.isArray(list) && list.length <= 8192 && list.every(id => typeof id === 'string' && id.length > 0 && id.length <= 160 && !/[\u0000-\u001f]/.test(id));
    if (!valid(value.done) || !valid(value.found)) return null;
    return { done: [...new Set<string>(value.done)], found: [...new Set<string>(value.found)] };
  } catch { return null; }
}

function flags(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
}

/** The armory quest flag is the single source of weapon ownership; no stale selected slot can equip it. */
export class WorldProgress {
  readonly done = new Set<string>();
  readonly found = new Set<string>();
  private listeners = new Set<() => void>();
  persistence: ProgressPersistenceState = 'ready';
  constructor(private storage?: ProgressStorage) {
    if (!storage) { this.persistence = 'unavailable'; return; }
    let current: string | null;
    try { current = storage.getItem(WORLD_PROGRESS_KEY); } catch { this.persistence = 'unavailable'; return; }
    if (current !== null) {
      // Even an empty reset snapshot is authoritative. Never merge old v1 quests back into it.
      if (!this.read(current)) this.persistence = 'invalid';
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
  /** Observers never own or replace the live sets used by combat and quest systems. */
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private report(state: ProgressPersistenceState) {
    this.persistence = state;
    for (const listener of this.listeners) { try { listener(); } catch { /* Presentation cannot break a successful save. */ } }
  }
  /** Portable local backup: progress only, never controls, credentials or browser state. */
  exportSnapshot(): string { return JSON.stringify({ done: [...this.done], found: [...this.found] }); }
  /** Commit storage first: a failed restore never replaces the current session.
   * Runtime callers reload after success so all gates/actors use one snapshot. */
  restoreSnapshot(raw: string): 'restored' | 'invalid' | 'unavailable' {
    const snapshot = parseProgressBackup(raw);
    if (!snapshot) return 'invalid';
    if (!this.storage) { this.report('unavailable'); return 'unavailable'; }
    try { this.storage.setItem(WORLD_PROGRESS_KEY, JSON.stringify(snapshot)); }
    catch { this.report('failed'); return 'unavailable'; }
    this.done.clear(); this.found.clear();
    for (const id of snapshot.done) this.done.add(id);
    for (const id of snapshot.found) this.found.add(id);
    this.report('saved'); return 'restored';
  }
  private read(raw: string) {
    try {
      const value = JSON.parse(raw);
      for (const id of flags(value?.done)) this.done.add(id);
      for (const id of flags(value?.found)) this.found.add(id);
      return true;
    } catch { return false; /* Invalid progress cannot restore inventory, location or arbitrary object fields. */ }
  }
  save(): boolean {
    if (!this.storage) { this.report('unavailable'); return false; }
    try {
      this.storage.setItem(WORLD_PROGRESS_KEY, this.exportSnapshot());
    } catch { this.report('failed'); return false; }
    // Remove only superseded progress, and only after the authoritative replacement was written.
    // Keeping a legacy key when removeItem is unavailable is safe: current always wins on reload.
    for (const key of LEGACY_WORLD_PROGRESS_KEYS) {
      try { this.storage.removeItem?.(key); } catch { /* Current snapshot remains authoritative. */ }
    }
    this.report('saved'); return true;
  }
  reset(): boolean { this.done.clear(); this.found.clear(); return this.save(); }
}
