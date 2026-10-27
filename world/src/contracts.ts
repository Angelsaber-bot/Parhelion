export const CONTRACT_ID = 'saber_contract';
export const CONTRACT_STORAGE_KEY = 'parhelion.world.contract.v1';
export interface ContractStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** Every servant the player can contract, in quest order. `contract` is the quest's done flag. */
export const SERVANTS = [
  { id: 'saber', contract: CONTRACT_ID, name: 'Saber', nameEn: 'Saber' },
  { id: 'blackbeard', contract: 'blackbeard_contract', name: '黑胡子', nameEn: 'Blackbeard' },
  { id: 'napoleon', contract: 'napoleon_contract', name: '拿破仑', nameEn: 'Napoleon' },
  { id: 'musashi', contract: 'musashi_contract', name: '宫本武藏', nameEn: 'Miyamoto Musashi' },
] as const;
export type ServantId = typeof SERVANTS[number]['id'];
export const servantByContract = (contractId: string) => SERVANTS.find((s) => s.contract === contractId);

/**
 * The quest's done flags are authoritative for who is contracted; the separate preference only
 * remembers recall/summon and which contracted servant is the active companion. Only one follows.
 */
export class FirstContract {
  private active = false;
  private chosen: ServantId = 'saber';
  constructor(private done: Set<string>, private storage?: ContractStorage) {
    try {
      const parsed = JSON.parse(storage?.getItem(CONTRACT_STORAGE_KEY) ?? 'null');
      if (parsed?.version === 1 && SERVANTS.some((s) => s.id === parsed.servant)) this.chosen = parsed.servant;
      this.active = this.anyRecruited && (parsed?.version === 1 ? parsed.summoned === true : true);
    } catch { this.active = this.anyRecruited; }
  }
  /** Saber's contract (the first contract at Sword Lake). */
  get recruited() { return this.done.has(CONTRACT_ID); }
  get roster(): ServantId[] { return SERVANTS.filter((s) => this.done.has(s.contract)).map((s) => s.id); }
  get anyRecruited() { return this.roster.length > 0; }
  /** The contracted servant that is (or would be) following; falls back to the first contracted one. */
  get selected(): ServantId | null { const r = this.roster; return r.includes(this.chosen) ? this.chosen : r[0] ?? null; }
  get companionSummoned() { return this.anyRecruited && this.active; }
  /** Saber is the active companion and summoned. */
  get summoned() { return this.isFollowing('saber'); }
  isFollowing(id: ServantId) { return this.companionSummoned && this.selected === id; }
  recruit(contractId: string = CONTRACT_ID) {
    const servant = servantByContract(contractId);
    if (!servant) return;
    this.done.add(contractId); this.chosen = servant.id; this.active = true; this.save();
  }
  toggle() { if (!this.anyRecruited) return false; this.active = !this.active; this.save(); return true; }
  /** Make a contracted servant the companion and summon them. */
  select(id: ServantId) {
    if (!this.roster.includes(id)) return false;
    this.chosen = id; this.active = true; this.save(); return true;
  }
  /** Cycle to the next contracted servant; null when fewer than two are contracted. */
  cycle(): ServantId | null {
    const r = this.roster, current = this.selected;
    if (r.length < 2 || !current) return null;
    const next = r[(r.indexOf(current) + 1) % r.length];
    this.select(next); return next;
  }
  reset() { this.active = false; this.chosen = 'saber'; this.save(); }
  private save() {
    try { this.storage?.setItem(CONTRACT_STORAGE_KEY, JSON.stringify({ version: 1, summoned: this.companionSummoned, servant: this.chosen })); } catch { /* memory-only in restricted browsers */ }
  }
}
