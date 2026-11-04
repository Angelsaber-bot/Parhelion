import { WORLD_COOP_SERVER, WORLD_COOP_VERSION, decodeEnemies, decodeHit, decodeState, type EnemyWireState, type HitWire, type PlayerWireState } from './coopProtocol';

export type CoopStatus = 'idle' | 'connecting' | 'waiting' | 'paired' | 'closed' | 'error';
export interface CoopSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code?: number; reason?: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}
export interface CoopEvents {
  status?(status: CoopStatus, detail?: string): void;
  partnerState?(state: PlayerWireState): void;
  enemies?(enemies: EnemyWireState[]): void;
  hit?(hit: HitWire): void;
  event?(event: { kind: string; data?: unknown }): void;
  role?(host: boolean): void;
}

/** One World co-op connection. Socket creation is injectable so tests run without a network. */
export class CoopSession {
  status: CoopStatus = 'idle';
  code: string | null = null;
  id: string | null = null;
  host = false;
  partner: string | null = null;
  private socket: CoopSocket | null = null;
  constructor(private readonly events: CoopEvents = {}, private readonly open: (url: string) => CoopSocket = url => new WebSocket(url) as unknown as CoopSocket, private readonly server = WORLD_COOP_SERVER) {}
  get paired() { return this.status === 'paired'; }
  connect(code: string) {
    this.leave();
    this.code = code; this.setStatus('connecting');
    let socket: CoopSocket;
    try { socket = this.open(`${this.server}?code=${encodeURIComponent(code)}&v=${WORLD_COOP_VERSION}`); }
    catch (error) { this.setStatus('error', error instanceof Error ? error.message : String(error)); return; }
    this.socket = socket;
    socket.onmessage = ev => { if (this.socket === socket) this.receive(ev.data); };
    socket.onclose = ev => { if (this.socket !== socket) return; this.socket = null; this.partner = null; this.setStatus(this.status === 'error' ? 'error' : 'closed', ev.reason || undefined); };
    socket.onerror = () => { if (this.socket === socket) this.setStatus('error', 'connection failed'); };
  }
  leave() {
    const socket = this.socket; this.socket = null; this.partner = null; this.id = null; this.host = false;
    if (socket) { try { socket.close(1000, 'left'); } catch { /* already closed */ } }
    if (this.status !== 'idle') this.setStatus('idle');
  }
  send(t: 'state' | 'enemies' | 'hit' | 'event', d: unknown) {
    const socket = this.socket; if (!socket || socket.readyState !== 1 || !this.partner) return false;
    try { socket.send(JSON.stringify({ t, d })); return true; } catch { return false; }
  }
  private receive(raw: unknown) {
    let msg: { t?: string; d?: unknown; from?: string };
    try { msg = JSON.parse(typeof raw === 'string' ? raw : ''); } catch { return; }
    const d = msg.d as Record<string, unknown> | undefined;
    switch (msg.t) {
      case 'welcome': {
        this.id = String(d?.id ?? ''); this.host = !!d?.host; this.events.role?.(this.host);
        const peers = Array.isArray(d?.peers) ? d!.peers as string[] : [];
        this.partner = peers[0] ?? null; this.setStatus(this.partner ? 'paired' : 'waiting'); return;
      }
      case 'peer':
        if (d?.joined) { this.partner = String(d.id); this.setStatus('paired'); }
        else if (d?.id === this.partner) { this.partner = null; this.setStatus('waiting'); }
        return;
      case 'host': this.host = true; this.events.role?.(true); return;
      case 'error': this.setStatus('error', String(msg.d ?? 'error')); return;
      case 'state': { const s = decodeState(msg.d); if (s) this.events.partnerState?.(s); return; }
      case 'enemies': { if (this.host) return; const e = decodeEnemies(msg.d); if (e) this.events.enemies?.(e); return; }
      case 'hit': { if (!this.host) return; const h = decodeHit(msg.d); if (h) this.events.hit?.(h); return; }
      case 'event': { const e = msg.d as { kind?: unknown; data?: unknown } | undefined; if (e && typeof e.kind === 'string') this.events.event?.({ kind: e.kind.slice(0, 32), data: e.data }); return; }
    }
  }
  private setStatus(status: CoopStatus, detail?: string) { this.status = status; this.events.status?.(status, detail); }
}
