// Public Arena server for https://parhelion-game.pages.dev: a Cloudflare Worker + Durable Objects.
// Same rules as the local Colyseus server (both wrap shared/room.ts), plain-JSON WebSocket protocol:
//   connect  wss://<worker>/arena?o=<encodeURIComponent(JSON JoinOptions)>
//   client → {t:'input', d:Input[]} | {t:'rematch'}
//   server → {t:'welcome', d:{id,tick,map,rulesVersion}} | {t:'snap', d:Snapshot} | {t:'error', d:string}
// Lobby (one DO) keeps open rooms per layout/map/bots key; each ArenaRoomDO runs one 60 Hz match.
// Weapon telemetry (human shooters only, no names) lands in one ArenaStats DO:
//   GET  /stats?since=<ms>&limit=<n>  → {records: MatchRecord[]} oldest first
//   POST /stats  (offline browser rounds; online rooms write server-side)

import { ArenaTrafficGuard, ANTI_CHEAT_CLOSE, ANTI_CHEAT_REASON, MAX_ARENA_MESSAGE } from '../shared/antiCheat.ts';
import { DurableObject } from 'cloudflare:workers';
import { TICK_HZ, validateLoadout, validateUtility } from '../shared/content.ts';
import { RULES_VERSION, RULES_MISMATCH, type JoinOptions } from '../shared/protocol.ts';
import { RoomCore } from '../shared/room.ts';
import { WorldRelayCore, WORLD_COOP_VERSION, validWorldRoomCode } from './worldRelay.ts';
import { sanitizeRecord, type MatchRecord } from '../shared/weaponStats.ts';

interface Env {
  LOBBY: DurableObjectNamespace<Lobby>;
  ROOM: DurableObjectNamespace<ArenaRoomDO>;
  WORLD: DurableObjectNamespace<WorldRoomDO>;
  STATS: DurableObjectNamespace<ArenaStats>;
}

const statsStore = (env: Env) => env.STATS.get(env.STATS.idFromName('stats'));
const MAX_STATS_BODY = 64 * 1024;

const CORS = { 'access-control-allow-origin': '*' };
const JSON_HEADERS = { ...CORS, 'content-type': 'application/json' };

function parseOptions(url: URL): Partial<JoinOptions> {
  try { const value: unknown = JSON.parse(url.searchParams.get('o') ?? '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<JoinOptions> : {}; } catch { return {}; }
}

function roomKey(o: Partial<JoinOptions>) {
  return `v${o.rulesVersion ?? 0}|${o.layout ?? '1v1'}|${o.map ?? ''}|${o.bots ? 1 : 0}`;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('Parhelion Arena server OK', { headers: CORS });
    }
    if (url.pathname === '/stats') {
      if (req.method === 'OPTIONS') return new Response(null, { headers: { ...CORS, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type' } });
      if (req.method === 'GET') {
        const since = Number(url.searchParams.get('since')) || 0, limit = Number(url.searchParams.get('limit')) || 500;
        return new Response(JSON.stringify({ records: await statsStore(env).list(since, limit) }), { headers: JSON_HEADERS });
      }
      if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });
      const body = await req.text();
      if (body.length > MAX_STATS_BODY) return new Response('too large', { status: 413, headers: CORS });
      let raw: unknown;
      try { raw = JSON.parse(body); } catch { return new Response('bad json', { status: 400, headers: CORS }); }
      const record = sanitizeRecord(raw, 'offline');
      if (!record) return new Response('bad record', { status: 400, headers: CORS });
      await statsStore(env).add(record);
      return new Response(null, { status: 204, headers: CORS });
    }
    if (url.pathname === '/world') {
      // World co-op: a plain relay room per 5-character code (see worldRelay.ts).
      if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('expected websocket', { status: 426, headers: CORS });
      if (Number(url.searchParams.get('v')) !== WORLD_COOP_VERSION) return new Response('world co-op version mismatch; reload the page', { status: 426, headers: CORS });
      const code = url.searchParams.get('code');
      if (!validWorldRoomCode(code)) return new Response('bad room code', { status: 400, headers: CORS });
      return env.WORLD.get(env.WORLD.idFromName(`world:${code}`)).fetch(req);
    }
    if (url.pathname !== '/arena') return new Response('not found', { status: 404, headers: CORS });
    if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('expected websocket', { status: 426, headers: CORS });
    }
    const opts = parseOptions(url);
    if (opts.rulesVersion !== RULES_VERSION) return new Response(RULES_MISMATCH, { status: 426, headers: CORS });
    try { validateLoadout(opts.loadout); validateUtility(opts.utility); } catch (e) { return new Response((e as Error).message, { status: 400, headers: CORS }); }
    const key = roomKey(opts);
    const lobby = env.LOBBY.get(env.LOBBY.idFromName('lobby'));
    const room = await lobby.assign(key, new RoomCore(opts).capacity);
    const fwd = new URL(req.url);
    fwd.searchParams.set('room', room);
    fwd.searchParams.set('key', key);
    return env.ROOM.get(env.ROOM.idFromName(room)).fetch(new Request(fwd, req));
  },
};

interface OpenRoom { name: string; key: string; humans: number; cap: number; at: number }

/** Matchmaking: hands out a room with a free human seat (or a new one) per key. */
export class Lobby extends DurableObject<Env> {
  private rooms: Record<string, OpenRoom> | null = null;

  private async load() {
    this.rooms ??= (await this.ctx.storage.get<Record<string, OpenRoom>>('rooms')) ?? {};
    return this.rooms;
  }
  private save() { return this.ctx.storage.put('rooms', this.rooms); }

  async assign(key: string, cap: number): Promise<string> {
    const rooms = await this.load();
    const now = Date.now();
    // a seat reserved but never confirmed by the room (lost socket) expires after 2 minutes
    for (const r of Object.values(rooms)) if (r.humans <= 0 && now - r.at > 120_000) delete rooms[r.name];
    let room = Object.values(rooms).find((r) => r.key === key && r.humans < r.cap);
    if (!room) {
      room = { name: `${key}#${crypto.randomUUID().slice(0, 8)}`, key, humans: 0, cap, at: now };
      rooms[room.name] = room;
    }
    room.humans++;
    room.at = now;
    await this.save();
    return room.name;
  }

  /** Called by a room whenever its human count changes (0 closes it). */
  async report(name: string, humans: number) {
    const rooms = await this.load();
    const r = rooms[name];
    if (!r) return;
    if (humans <= 0) delete rooms[name];
    else { r.humans = humans; r.at = Date.now(); }
    await this.save();
  }
}

/** One live match. Runs only while humans are connected. */
export class ArenaRoomDO extends DurableObject<Env> {
  private core: RoomCore | null = null;
  private name = '';
  private sockets = new Map<string, WebSocket>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const opts = parseOptions(url);
    this.name = url.searchParams.get('room') ?? this.name;
    const pair = new WebSocketPair();
    const [client, ws] = [pair[0], pair[1]];
    ws.accept();
    this.core ??= new RoomCore(opts, 'online');
    const id = `p${++this.seq}-${crypto.randomUUID().slice(0, 6)}`;
    try {
      const welcome = this.core.join(id, opts);
      this.sockets.set(id, ws);
      ws.send(JSON.stringify({ t: 'welcome', d: welcome }));
    } catch (e) {
      ws.send(JSON.stringify({ t: 'error', d: (e as Error).message }));
      ws.close(4000, 'room full');
      void this.report();
      return new Response(null, { status: 101, webSocket: client });
    }
    const traffic = new ArenaTrafficGuard();
    const reject = () => {
      // Remove the slot immediately: close events can be delayed by a hostile peer.
      this.drop(id);
      ws.close(ANTI_CHEAT_CLOSE, ANTI_CHEAT_REASON);
    };
    ws.addEventListener('message', (ev) => {
      if (!this.sockets.has(id)) return;
      if (!traffic.message()) { reject(); return; }
      if (typeof ev.data !== 'string' || ev.data.length > MAX_ARENA_MESSAGE) { reject(); return; }
      let msg: unknown;
      try { msg = JSON.parse(ev.data); } catch { traffic.invalid(); if (traffic.blocked) reject(); return; }
      if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
        traffic.invalid(); if (traffic.blocked) reject(); return;
      }
      const packet = msg as { t?: unknown; d?: unknown };
      if (packet.t === 'input') { if (!this.core?.input(id, packet.d)) reject(); }
      else if (packet.t === 'rematch') { if (!this.core?.requestRematch(id)) reject(); }
      else { traffic.invalid(); if (traffic.blocked) reject(); }
    });
    const gone = () => this.drop(id);
    ws.addEventListener('close', gone);
    ws.addEventListener('error', gone);
    this.start();
    void this.report();
    return new Response(null, { status: 101, webSocket: client });
  }

  private start() {
    if (this.timer) return;
    // fixed-step clock: catch up after timer jitter, but never more than 6 ticks at once
    let last = Date.now(), acc = 0;
    const dt = 1000 / TICK_HZ;
    this.timer = setInterval(() => {
      const core = this.core;
      if (!core) return;
      const now = Date.now();
      acc = Math.min(acc + now - last, dt * 6);
      last = now;
      while (acc >= dt) {
        acc -= dt;
        const snap = core.step();
        if (snap) {
          for (const [id, ws] of this.sockets) {
            try { ws.send(JSON.stringify({ t: 'snap', d: core.snapshotFor(id, snap) })); } catch { /* closing */ }
          }
        }
      }
      this.saveStats(core);
    }, dt);
  }

  /** Server-side human weapon telemetry; never blocks the tick. */
  private saveStats(core: RoomCore) {
    for (const r of core.match.stats.drain()) {
      const record = sanitizeRecord(r, 'online');
      if (record) void statsStore(this.env).add(record).catch(() => {});
    }
  }

  private drop(id: string) {
    if (!this.sockets.delete(id)) return;
    this.core?.leave(id);
    if (this.sockets.size === 0) {
      if (this.core) { this.core.match.flushStats(); this.saveStats(this.core); }
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.core = null; // next player to get this room name starts fresh
    }
    void this.report();
  }

  private report() {
    const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby'));
    return lobby.report(this.name, this.sockets.size);
  }
}

const STATS_CAP = 3000;
const statsKey = (at: number) => `r:${String(Math.max(0, Math.floor(at))).padStart(15, '0')}`;

/** Rolling store of the latest STATS_CAP match records, one storage key each. */
export class ArenaStats extends DurableObject<Env> {
  async add(record: MatchRecord): Promise<void> {
    const store = this.ctx.storage;
    await store.put(`${statsKey(record.at)}:${crypto.randomUUID().slice(0, 8)}`, record);
    const n = ((await store.get<number>('count')) ?? 0) + 1;
    if (n <= STATS_CAP + 100) { await store.put('count', n); return; }
    const oldest = [...(await store.list({ prefix: 'r:', limit: n - STATS_CAP })).keys()];
    await store.delete(oldest);
    await store.put('count', n - oldest.length);
  }

  async list(since: number, limit: number): Promise<MatchRecord[]> {
    const rows = await this.ctx.storage.list<MatchRecord>({ prefix: 'r:', start: statsKey(since), limit: Math.max(1, Math.min(1000, limit | 0)) });
    return [...rows.values()];
  }
}

/** One World co-op room: relays messages between at most two players; no game state is kept. */
export class WorldRoomDO extends DurableObject<Env> {
  private core = new WorldRelayCore();
  private seq = 0;
  async fetch(): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, ws] = [pair[0], pair[1]];
    ws.accept();
    const id = `w${++this.seq}-${crypto.randomUUID().slice(0, 6)}`;
    try { this.core.join(id, data => ws.send(data)); }
    catch (e) {
      ws.send(JSON.stringify({ t: 'error', d: (e as Error).message }));
      ws.close(4000, 'room full');
      return new Response(null, { status: 101, webSocket: client });
    }
    ws.addEventListener('message', ev => { this.core.message(id, ev.data); });
    const gone = () => this.core.leave(id);
    ws.addEventListener('close', gone);
    ws.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }
}
