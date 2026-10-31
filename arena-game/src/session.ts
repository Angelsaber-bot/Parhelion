// A Session is "the server" from the game's point of view. Online it is a Colyseus room; offline
// it is the same shared Match running in the browser with bots. The game code is identical.

import { Client } from '@colyseus/sdk';
import { getMap } from '../shared/arenaMap.ts';
import { Bot, BOT_SKILL, navFor } from '../shared/bot.ts';
import { DT, SNAPSHOT_EVERY, TEAM_CAPACITY, botLoadout, type Team } from '../shared/content.ts';
import type { ArenaMap } from '../shared/map.ts';
import { Match, type Snapshot } from '../shared/match.ts';
import { isWorkerUrl, ROOM_NAME, RULES_VERSION, assertRulesVersion, type JoinOptions } from '../shared/protocol.ts';
import type { Input } from '../shared/sim.ts';

export interface Session {
  readonly id: string;
  readonly online: boolean;
  readonly map: ArenaMap;
  send(inputs: Input[]): void;
  onSnapshot: (s: Snapshot) => void;
  onClose: (reason: string) => void;
  close(): void;
  /** Ask for the next match after the results screen. */
  rematch(): void;
  /** Freeze the whole match (offline only; an online server keeps running). */
  setPaused(paused: boolean): void;
  /** Offline only: the in-browser authoritative match (debug/testing). */
  match?: Match;
}

export async function joinOnline(url: string, opts: JoinOptions): Promise<Session> {
  // An absent false filter matches rooms of either bot policy; always send a boolean.
  opts = { ...opts, rulesVersion: RULES_VERSION, bots: opts.bots === true };
  if (isWorkerUrl(url)) return joinWorker(url, opts);
  const client = new Client(url);
  const room = await client.joinOrCreate(ROOM_NAME, opts);
  const s: Session = {
    id: room.sessionId,
    online: true,
    map: getMap(opts.map),
    send: (inputs) => room.send('input', inputs),
    onSnapshot: () => {},
    onClose: () => {},
    close: () => { void room.leave(); },
    rematch: () => room.send('rematch', true),
    setPaused: () => {},
  };
  room.onMessage('snap', (snap: Snapshot) => {
    try { assertRulesVersion(snap.rulesVersion); }
    catch (error) { s.onClose((error as Error).message); void room.leave(); return; }
    s.onSnapshot(snap);
  });
  // Old servers accept unknown join fields but advertise no current rules version: fail before starting prediction.
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { void room.leave(); reject(new Error('服务器版本握手超时，请更新客户端与服务器到同一版本。')); }, 5000);
    room.onMessage('welcome', (welcome: { rulesVersion?: number }) => {
      clearTimeout(timeout);
      try { assertRulesVersion(welcome.rulesVersion); resolve(); }
      catch (error) { void room.leave(); reject(error); }
    });
    room.onLeave(() => { clearTimeout(timeout); reject(new Error('服务器在版本确认前断开连接')); });
  });
  room.onLeave((code: number) => s.onClose(`disconnected (${code})`));
  return s;
}

/** Public server: plain-JSON WebSocket to the Cloudflare Durable Object room (worker/index.ts). */
function joinWorker(url: string, opts: JoinOptions): Promise<Session> {
  const ws = new WebSocket(`${url.trim().replace(/\/?(\?.*)?$/, '')}?o=${encodeURIComponent(JSON.stringify(opts))}`);
  // batch inputs to ~30 Hz: halves the message count (the free Cloudflare tier counts messages)
  let outbox: Input[] = [];
  let flush: ReturnType<typeof setTimeout> | null = null;
  const clearQueued = () => { if (flush) clearTimeout(flush); flush = null; outbox = []; };
  const sendNow = () => {
    flush = null;
    if (outbox.length && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'input', d: outbox }));
    outbox = [];
  };
  return new Promise((resolve, reject) => {
    let s: Session | null = null, joinFailed = false;
    const failJoin = (error: unknown) => {
      if (s || joinFailed) return;
      joinFailed = true; clearTimeout(timeout); clearQueued();
      // The caller no longer owns this socket after rejection. A delayed peer
      // close or welcome must not create an unreachable live Session.
      ws.onmessage = null; ws.onerror = null; ws.onclose = null;
      try { if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) ws.close(); } catch { /* rejected join remains terminal */ }
      reject(error);
    };
    const timeout = setTimeout(() => failJoin(new Error('timeout')), 10000);
    ws.onmessage = (ev) => {
      if (joinFailed) return;
      let msg: { t: string; d: unknown };
      try { msg = JSON.parse(ev.data as string); } catch { return; }
      if (msg.t === 'snap') {
        const snap = msg.d as Snapshot;
        try { assertRulesVersion(snap.rulesVersion); }
        catch (error) { if (s) { s.onClose((error as Error).message); ws.close(); } else failJoin(error); return; }
        s?.onSnapshot(snap);
      }
      else if (msg.t === 'welcome' && !s) {
        clearTimeout(timeout);
        try { assertRulesVersion((msg.d as { rulesVersion?: number }).rulesVersion); }
        catch (error) { failJoin(error); return; }
        s = {
          id: (msg.d as { id: string }).id,
          online: true,
          map: getMap(opts.map),
          send: (inputs) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            outbox.push(...inputs);
            if (outbox.length > 16) sendNow();
            else flush ??= setTimeout(sendNow, 30);
          },
          onSnapshot: () => {},
          onClose: () => {},
          close: () => { clearQueued(); ws.close(1000); },
          rematch: () => { clearQueued(); if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'rematch' })); },
          setPaused: () => {},
        };
        resolve(s);
      } else if (msg.t === 'error' && !s) failJoin(new Error(String(msg.d)));
    };
    ws.onerror = () => { if (!s) failJoin(new Error('无法连接服务器')); };
    ws.onclose = (ev) => {
      clearQueued();
      if (s) s.onClose(`disconnected (${ev.code})`);
      else failJoin(new Error(`连接被关闭 (${ev.code})`));
    };
  });
}

export function startOffline(opts: JoinOptions, difficulty: keyof typeof BOT_SKILL): Session {
  const match = new Match(getMap(opts.map), opts.layout);
  navFor(match); // build the nav grid up front so the first bot tick doesn't hitch
  const team: Team = opts.team === 'B' ? 'B' : 'A';
  const id = 'you';
  match.addPlayer(id, { name: opts.name || 'You', team, char: opts.char, skins: opts.skins, loadout: opts.loadout, bot: false });
  let seed = 7;
  for (const t of ['A', 'B'] as Team[]) {
    for (let i = match.teamCount(t); i < TEAM_CAPACITY[opts.layout][t]; i++) {
      const n = seed++;
      match.addPlayer(`bot-${n}`, { name: `Bot ${n - 6}`, team: t, char: n % 2, skins: [n % 2, n % 2, n % 2], loadout: botLoadout(n), bot: true }, new Bot(n, BOT_SKILL[difficulty]));
    }
  }
  let last = performance.now(), acc = 0, paused = false;
  const s: Session = {
    id,
    online: false,
    map: match.map,
    send: (inputs) => match.queueInputs(id, inputs),
    onSnapshot: () => {},
    onClose: () => {},
    close: () => clearInterval(timer),
    rematch: () => match.rematch(),
    setPaused: (p) => { paused = p; last = performance.now(); acc = 0; },
    match,
  };
  const timer = setInterval(() => {
    if (paused) return;
    const now = performance.now();
    acc = Math.min(acc + (now - last) / 1000, 0.25);
    last = now;
    while (acc >= DT) {
      acc -= DT;
      match.step();
      if (match.tick % SNAPSHOT_EVERY === 0) s.onSnapshot(match.snapshot());
    }
  }, 4);
  return s;
}
