export const CONTRACT_ID = 'saber_contract';
export const CONTRACT_STORAGE_KEY = 'parhelion.world.contract.v1';
export interface ContractStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** Servants with authored skill and cinematic tracks. */
export const SERVANTS = [
  { id: 'saber', contract: CONTRACT_ID, name: 'Saber', nameEn: 'Saber' },
  { id: 'blackbeard', contract: 'blackbeard_contract', name: '黑胡子', nameEn: 'Blackbeard' },
  { id: 'napoleon', contract: 'napoleon_contract', name: '拿破仑', nameEn: 'Napoleon' },
  { id: 'musashi', contract: 'musashi_contract', name: '宫本武藏', nameEn: 'Miyamoto Musashi' },
] as const;
export type ServantId = typeof SERVANTS[number]['id'];
export const COMPANIONS = [
  ...SERVANTS,
  { id: 'jeanne', contract: 'servant_claim_jeanne', name: '贞德', nameEn: 'Jeanne' },
  { id: 'ozymandias', contract: 'servant_claim_ozymandias', name: '奥斯曼迪斯', nameEn: 'Ozymandias' },
  { id: 'qinShiHuang', contract: 'servant_claim_qin', name: '秦始皇', nameEn: 'Qin Shi Huang' },
] as const;
export type CompanionId = typeof COMPANIONS[number]['id'];
export const servantByContract = (contractId: string) => COMPANIONS.find((s) => s.contract === contractId);

/**
 * The quest's done flags are authoritative for who is contracted; the separate preference only
 * remembers recall/summon and which contracted servant is the active companion. Only one follows.
 */
export class FirstContract {
  private active = false;
  private chosen: CompanionId = 'saber';
  private readonly listeners = new Set<() => void>();
  constructor(private done: Set<string>, private storage?: ContractStorage) {
    try {
      const parsed = JSON.parse(storage?.getItem(CONTRACT_STORAGE_KEY) ?? 'null');
      if (parsed?.version === 1 && COMPANIONS.some((s) => s.id === parsed.servant)) this.chosen = parsed.servant;
      this.active = this.anyRecruited && (parsed?.version === 1 ? parsed.summoned === true : true);
    } catch { this.active = this.anyRecruited; }
  }
  /** Saber's contract (the first contract at Sword Lake). */
  get recruited() { return this.done.has(CONTRACT_ID); }
  get roster(): CompanionId[] { return COMPANIONS.filter((s) => this.done.has(s.contract)).map((s) => s.id); }
  has(id: CompanionId) { return COMPANIONS.some(s => s.id === id && this.done.has(s.contract)); }
  get anyRecruited() { return COMPANIONS.some(s => this.done.has(s.contract)); }
  /** The contracted servant that is (or would be) following; falls back to the first contracted one. */
  get selected(): CompanionId | null { return this.has(this.chosen) ? this.chosen : this.roster[0] ?? null; }
  get following(): CompanionId | null { return this.active ? this.selected : null; }
  get skillIdentity(): ServantId | null {
    const id = this.following;
    return SERVANTS.find(servant => servant.id === id)?.id ?? null;
  }
  get companionSummoned() { return this.anyRecruited && this.active; }
  /** Saber is the active companion and summoned. */
  get summoned() { return this.isFollowing('saber'); }
  isFollowing(id: CompanionId) { return this.following === id; }
  recruit(contractId: string = CONTRACT_ID) {
    const servant = servantByContract(contractId);
    if (!servant) return;
    this.done.add(contractId); this.chosen = servant.id; this.active = true; this.changed();
  }
  toggle() { if (!this.anyRecruited) return false; this.active = !this.active; this.changed(); return true; }
  /** Make a contracted servant the companion and summon them. */
  select(id: CompanionId) {
    if (!this.has(id)) return false;
    if (this.chosen === id && this.active) return true;
    this.chosen = id; this.active = true; this.changed(); return true;
  }
  /** Cycle to the next contracted servant; null when fewer than two are contracted. */
  cycle(): CompanionId | null {
    const r = this.roster, current = this.selected;
    if (r.length < 2 || !current) return null;
    const next = r[(r.indexOf(current) + 1) % r.length];
    this.select(next); return next;
  }
  reset() { this.active = false; this.chosen = 'saber'; this.changed(); }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private changed() {
    try { this.storage?.setItem(CONTRACT_STORAGE_KEY, JSON.stringify({ version: 1, summoned: this.companionSummoned, servant: this.chosen })); } catch { /* memory-only in restricted browsers */ }
    for (const listener of this.listeners) listener();
  }
}
