// World co-op relay (no game rules on the server). Two players share a 5-character room code;
// the first in is the host, whose game owns enemies and world state. The server only forwards
// small JSON messages to the other player and says who joined or left.
//   connect  wss://<worker>/world?code=ABCDE&v=<WORLD_COOP_VERSION>
//   server → {t:'welcome', d:{id, host, peers}} | {t:'peer', d:{id, joined}} | {t:'host', d:{id}}
//            | {t:'error', d:string} | relayed {t, from, d}
//   client → {t:'state'|'enemies'|'hit'|'event', d}

export const WORLD_COOP_VERSION = 1;
export const WORLD_ROOM_CAP = 2;
/** Larger messages are dropped: an enemy snapshot for a 120 m bubble stays well under this. */
export const WORLD_MESSAGE_MAX = 12_000;
/** Per player, per second. State 15 Hz + enemies 10 Hz + hits/events leave ample headroom. */
export const WORLD_MESSAGE_RATE = 60;
export const WORLD_RELAYED = new Set(['state', 'enemies', 'hit', 'event']);
const CODE = /^[A-HJ-NP-Z2-9]{5}$/;
export const validWorldRoomCode = (code: unknown): code is string => typeof code === 'string' && CODE.test(code);

type Send = (data: string) => void;
interface Peer { send: Send; windowStart: number; count: number }

export class WorldRelayCore {
  readonly peers = new Map<string, Peer>();
  host: string | null = null;
  join(id: string, send: Send) {
    if (this.peers.size >= WORLD_ROOM_CAP) throw new Error('room full');
    this.peers.set(id, { send, windowStart: 0, count: 0 });
    this.host ??= id;
    send(JSON.stringify({ t: 'welcome', d: { id, host: this.host === id, peers: [...this.peers.keys()].filter(p => p !== id) } }));
    this.broadcast(id, JSON.stringify({ t: 'peer', d: { id, joined: true } }));
  }
  leave(id: string) {
    if (!this.peers.delete(id)) return;
    this.broadcast(id, JSON.stringify({ t: 'peer', d: { id, joined: false } }));
    if (this.host === id) {
      // The remaining player's game takes over as the world owner.
      this.host = this.peers.keys().next().value ?? null;
      if (this.host) this.peers.get(this.host)!.send(JSON.stringify({ t: 'host', d: { id: this.host } }));
    }
  }
  /** Returns whether the message was forwarded. */
  message(id: string, raw: unknown, now = Date.now()) {
    const peer = this.peers.get(id);
    if (!peer || typeof raw !== 'string' || raw.length > WORLD_MESSAGE_MAX) return false;
    if (now - peer.windowStart >= 1000) { peer.windowStart = now; peer.count = 0; }
    if (++peer.count > WORLD_MESSAGE_RATE) return false;
    let msg: { t?: unknown; d?: unknown };
    try { msg = JSON.parse(raw); } catch { return false; }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string' || !WORLD_RELAYED.has(msg.t)) return false;
    // Only the host's game may publish enemy state.
    if (msg.t === 'enemies' && id !== this.host) return false;
    this.broadcast(id, JSON.stringify({ t: msg.t, from: id, d: msg.d }));
    return true;
  }
  private broadcast(from: string, data: string) {
    for (const [id, peer] of this.peers) if (id !== from) { try { peer.send(data); } catch { /* closing */ } }
  }
}
