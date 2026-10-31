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

function hasProgressArrays(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.done) || Array.isArray(record.found);
}

function flags(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
}

/** The armory quest flag is the single source of weapon ownership; no stale selected slot can equip it. */
export class WorldProgress {
  readonly done = new Set<string>();
  readonly found = new Set<string>();
  private listeners = new Set<() => void>();
  private unreadableLegacy = new Set<string>();
  private unreadableCurrent: string | null = null;
  private initialReadFailed = false;
  private replacementAuthorized = false;
  persistence: ProgressPersistenceState = 'ready';
  constructor(private storage?: ProgressStorage) {
    if (!storage) { this.persistence = 'unavailable'; return; }
    let current: string | null;
    try { current = storage.getItem(WORLD_PROGRESS_KEY); } catch { this.initialReadFailed = true; this.persistence = 'unavailable'; return; }
    if (current !== null) {
      // Even an empty reset snapshot is authoritative. Never merge old v1 quests back into it.
      if (!this.read(current, true)) { this.unreadableCurrent = current; this.persistence = 'invalid'; }
      // Current progress remains authoritative; inspect only the shape of old
      // records so a later ordinary save will not erase malformed evidence.
      for (const key of LEGACY_WORLD_PROGRESS_KEYS) {
        try { const raw = storage.getItem(key); if (raw !== null && !hasProgressArrays(JSON.parse(raw))) this.unreadableLegacy.add(key); }
        catch { this.unreadableLegacy.add(key); }
      }
      return;
    }
    let migrated = false, malformedLegacy = false;
    for (const key of LEGACY_WORLD_PROGRESS_KEYS) {
      try {
        const raw = storage?.getItem(key);
        if (raw != null) { if (this.read(raw)) migrated = true; else { malformedLegacy = true; this.unreadableLegacy.add(key); } }
      } catch { /* Other legacy regions can still be recovered. */ }
    }
    if (migrated) this.save();
    else if (malformedLegacy) this.persistence = 'invalid';
  }
  /** Ordinary autosave cannot replace unreadable or never-read current data. */
  get saveBlocked() { return !this.replacementAuthorized && (this.unreadableCurrent !== null || this.initialReadFailed); }
  exportUnreadableSnapshot(): string | null { return this.unreadableCurrent; }
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
  captureStoredSnapshot(): { raw: string | null } | null {
    try { return this.storage ? { raw: this.storage.getItem(WORLD_PROGRESS_KEY) } : null; }
    catch { this.report('unavailable'); return null; }
  }
  restoreSnapshot(raw: string, expected?: { raw: string | null }): 'restored' | 'invalid' | 'unavailable' | 'conflict' {
    const snapshot = parseProgressBackup(raw);
    if (!snapshot) return 'invalid';
    if (!this.storage) { this.report('unavailable'); return 'unavailable'; }
    try {
      // Synchronous compare/write protects a stale confirmation from an already
      // changed tab. localStorage has no cross-process atomic CAS transaction.
      const guard = expected ?? (this.saveBlocked && this.unreadableCurrent !== null ? { raw: this.unreadableCurrent } : undefined);
      if (guard && this.storage.getItem(WORLD_PROGRESS_KEY) !== guard.raw) { this.report('failed'); return 'conflict'; }
      this.storage.setItem(WORLD_PROGRESS_KEY, JSON.stringify(snapshot));
    }
    catch { this.report('failed'); return 'unavailable'; }
    this.unreadableCurrent = null; this.initialReadFailed = false; this.replacementAuthorized = false;
    this.done.clear(); this.found.clear();
    for (const id of snapshot.done) this.done.add(id);
    for (const id of snapshot.found) this.found.add(id);
    this.report('saved'); return 'restored';
  }
  private read(raw: string, protectPartialCurrent = false) {
    try {
      const value = JSON.parse(raw);
      // Historical saves may contain mixed flag values or only one array, but
      // primitives/unrelated objects are not evidence of an empty new game.
      if (!hasProgressArrays(value)) return false;
      for (const id of flags(value?.done)) this.done.add(id);
      for (const id of flags(value?.found)) this.found.add(id);
      // Current records may be partly recoverable. Keep useful flags in memory,
      // but require explicit repair before normalizing away malformed known fields.
      // Unknown flag strings, duplicates and newer extra fields remain compatible.
      if (protectPartialCurrent) for (const key of ['done', 'found']) {
        if (!(key in value)) continue;
        if (!Array.isArray(value[key]) || value[key].some((id: unknown) => typeof id !== 'string' || id.length === 0)) return false;
      }
      return true;
    } catch { return false; /* Invalid progress cannot restore inventory, location or arbitrary object fields. */ }
  }
  save(): boolean {
    if (this.saveBlocked) { this.report(this.unreadableCurrent !== null ? 'invalid' : 'unavailable'); return false; }
    if (!this.storage) { this.report('unavailable'); return false; }
    try {
      this.storage.setItem(WORLD_PROGRESS_KEY, this.exportSnapshot());
    } catch { this.report('failed'); return false; }
    this.unreadableCurrent = null; this.initialReadFailed = false; this.replacementAuthorized = false;
    // Remove only superseded progress, and only after the authoritative replacement was written.
    // Keeping a legacy key when removeItem is unavailable is safe: current always wins on reload.
    for (const key of LEGACY_WORLD_PROGRESS_KEYS) {
      // A malformed legacy record was not migrated: retain its original bytes
      // rather than deleting possible recovery evidence on an ordinary save.
      if (this.unreadableLegacy.has(key)) continue;
      try { this.storage.removeItem?.(key); } catch { /* Current snapshot remains authoritative. */ }
    }
    this.report('saved'); return true;
  }
  reset(): boolean { this.done.clear(); this.found.clear(); this.unreadableLegacy.clear(); this.replacementAuthorized = true; return this.save(); }
}
