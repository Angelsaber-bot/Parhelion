// Public Arena server for https://parhelion-game.pages.dev: a Cloudflare Worker + Durable Objects.
// Same rules as the local Colyseus server (both wrap shared/room.ts), plain-JSON WebSocket protocol:
//   connect  wss://<worker>/arena?o=<encodeURIComponent(JSON JoinOptions)>
//   client → {t:'input', d:Input[]} | {t:'rematch'}
//   server → {t:'welcome', d:{id,tick,map,rulesVersion}} | {t:'snap', d:Snapshot} | {t:'error', d:string}
// Lobby (one DO) keeps open rooms per layout/map/bots key; each ArenaRoomDO runs one 60 Hz match.

import { DurableObject } from 'cloudflare:workers';
import { TICK_HZ, validateLoadout } from '../shared/content.ts';
import { RULES_VERSION, RULES_MISMATCH, type JoinOptions } from '../shared/protocol.ts';
import { RoomCore } from '../shared/room.ts';

interface Env {
  LOBBY: DurableObjectNamespace<Lobby>;
  ROOM: DurableObjectNamespace<ArenaRoomDO>;
}

const CORS = { 'access-control-allow-origin': '*' };

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
    if (url.pathname !== '/arena') return new Response('not found', { status: 404, headers: CORS });
    if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('expected websocket', { status: 426, headers: CORS });
    }
    const opts = parseOptions(url);
    if (opts.rulesVersion !== RULES_VERSION) return new Response(RULES_MISMATCH, { status: 426, headers: CORS });
    try { validateLoadout(opts.loadout); } catch (e) { return new Response((e as Error).message, { status: 400, headers: CORS }); }
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
    this.core ??= new RoomCore(opts);
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
    ws.addEventListener('message', (ev) => {
      let msg: { t?: string; d?: unknown };
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
      if (msg.t === 'input') this.core?.input(id, msg.d);
      else if (msg.t === 'rematch') this.core?.rematch();
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
          const data = JSON.stringify({ t: 'snap', d: snap });
          for (const ws of this.sockets.values()) { try { ws.send(data); } catch { /* closing */ } }
        }
      }
    }, dt);
  }

  private drop(id: string) {
    if (!this.sockets.delete(id)) return;
    this.core?.leave(id);
    if (this.sockets.size === 0) {
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
