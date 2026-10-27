export const CONTRACT_ID = 'saber_contract';
export const CONTRACT_STORAGE_KEY = 'parhelion.world.contract.v1';
export interface ContractStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** The quest's done flag is authoritative; the separate preference only remembers recall/summon. */
export class FirstContract {
  private active = false;
  constructor(private done: Set<string>, private storage?: ContractStorage) {
    try {
      const parsed = JSON.parse(storage?.getItem(CONTRACT_STORAGE_KEY) ?? 'null');
      this.active = this.recruited && (parsed?.version === 1 ? parsed.summoned === true : true);
    } catch { this.active = this.recruited; }
  }
  get recruited() { return this.done.has(CONTRACT_ID); }
  get summoned() { return this.recruited && this.active; }
  recruit() { this.done.add(CONTRACT_ID); this.active = true; this.save(); }
  toggle() { if (!this.recruited) return false; this.active = !this.active; this.save(); return true; }
  reset() { this.active = false; this.save(); }
  private save() {
    try { this.storage?.setItem(CONTRACT_STORAGE_KEY, JSON.stringify({ version: 1, summoned: this.summoned })); } catch { /* memory-only in restricted browsers */ }
  }
}
