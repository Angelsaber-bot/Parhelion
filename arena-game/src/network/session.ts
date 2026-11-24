import {CONTENT_MANIFEST,assertContentManifest} from '../../shared/manifest.ts';
// A Session is "the server" from the game's point of view. Online it is a Colyseus room; offline
// it is the same shared Match running in the browser with bots. The game code is identical.

import { Client } from '@colyseus/sdk';
import { getMap, mapIdOf } from '../../shared/arenaMap.ts';
import { learnedOpponent } from '../../shared/learnedOpponent.ts';
import type { ExplorationModel } from '../../shared/exploration.ts';
import type { NeuralPolicyModel } from '../../shared/neuralPolicy.ts';
import { randomBotHero, DT, SNAPSHOT_EVERY, TEAM_CAPACITY, randomBotLoadout, randomBotUtility, type Team } from '../../shared/content.ts';
import type { ArenaMap } from '../../shared/map.ts';
import { Match, type Snapshot } from '../../shared/match.ts';
import { applyPracticeLoadout, getRangeMap, resetDummies, setupRange } from '../../shared/trainingRange.ts';
import type { Loadout, UtilityId } from '../../shared/content.ts';
import { isWorkerUrl, normalizeRoomCode, PRIVATE_ROOM_NAME, ROOM_NAME, RULES_VERSION, assertRulesVersion, type JoinOptions } from '../../shared/protocol.ts';
import type { Input } from '../../shared/sim.ts';
import type { MatchRecord } from '../../shared/weaponStats.ts';

export interface Session {
  readonly id: string;
  readonly online: boolean;
  readonly map: ArenaMap;
  /** The room's map id when the server chose it (a private room keeps its first player's map). */
  readonly mapId?: string;
  /** Private room code, shown in the HUD so friends can join. */
  readonly roomCode?: string;
  /** Terminal peer failure, including one received before the game attaches its listener. */
  readonly closeReason?: string;
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
  /** Training range only: live loadout swaps and a dummy reset. */
  practice?: PracticeControls;
  /** Offline only: a finished (or quit) round's human weapon telemetry. */
  onStats?: (record: MatchRecord) => void;
}
export interface PracticeControls {
  apply(choice: { loadout: Loadout; utility: UtilityId; skins: number[] }): boolean;
  resetDummies(): void;
}

export async function joinOnline(url: string, opts: JoinOptions): Promise<Session> {
  // An absent false filter matches rooms of either bot policy; always send a boolean.
  opts = { ...opts, rulesVersion: RULES_VERSION, contentManifest:CONTENT_MANIFEST, bots: opts.bots === true };
  if (opts.room !== undefined) {
    const code = normalizeRoomCode(opts.room);
    if (!code) throw new Error('房间号应为 5 位字母或数字（不含 O、0、I、1）');
    opts.room = code;
  }
  if (isWorkerUrl(url)) return joinWorker(url, opts);
  const client = new Client(url);
  const room = await client.joinOrCreate(opts.room ? PRIVATE_ROOM_NAME : ROOM_NAME, opts);
  // ArenaRoom removes disconnected players and has no allowReconnection path.
  // Do not let the SDK silently retry a session that the server cannot restore.
  room.reconnection.enabled = false;
  let closed = false, closeReason: string | undefined;
  const closeRoom = () => {
    if (closed) return;
    closed = true; room.reconnection.enabled = false;
    try { void room.leave().catch(() => {}); } catch { /* terminal local ownership */ }
  };
  const s: Session = {
    id: room.sessionId,
    online: true,
    map: getMap(opts.map),
    mapId: mapIdOf(opts.map),
    roomCode: opts.room,
    get closeReason() { return closeReason; },
    send: (inputs) => { if (!closed) room.send('input', inputs); },
    onSnapshot: () => {},
    onClose: () => {},
    close: closeRoom,
    rematch: () => { if (!closed) room.send('rematch', true); },
    setPaused: () => {},
  };
  room.onMessage('snap', (snap: Snapshot) => {
    if (closed) return;
    try { assertRulesVersion(snap.rulesVersion); }
    catch (error) { closeReason = (error as Error).message; closeRoom(); s.onClose(closeReason); return; }
    s.onSnapshot(snap);
  });
  // Old servers accept unknown join fields but advertise no current rules version: fail before starting prediction.
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { closeRoom(); reject(new Error('服务器版本握手超时，请更新客户端与服务器到同一版本。')); }, 5000);
    room.onMessage('welcome', (welcome: { rulesVersion?: number;contentManifest?:string;map?:string }) => {
      if (closed) return;
      clearTimeout(timeout);
      // A private room plays its first player's map, whatever this player had selected.
      if (typeof welcome.map === 'string') Object.assign(s, { map: getMap(welcome.map), mapId: mapIdOf(welcome.map) });
      try { assertRulesVersion(welcome.rulesVersion);assertContentManifest(welcome.contentManifest); resolve(); }
      catch (error) { closeRoom(); reject(error); }
    });
    room.onLeave(() => { clearTimeout(timeout); reject(new Error('服务器在版本确认前断开连接')); });
  });
  room.onLeave((code: number) => {
    if (closed) return;
    closed = true; closeReason = `disconnected (${code})`; s.onClose(closeReason);
  });
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
    let s: Session | null = null, terminal = false, closeReason: string | undefined;
    const endSocket = (notify?: string, closeCode?: number) => {
      if (terminal) return;
      terminal = true; closeReason = notify;
      clearTimeout(timeout); clearQueued();
      ws.onmessage = null; ws.onerror = null; ws.onclose = null;
      try {
        if (closeCode !== undefined && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) ws.close(closeCode);
      } catch { /* terminal ownership has already ended */ }
      if (notify) s?.onClose(notify);
    };
    const failJoin = (error: unknown, peerClosed = false) => {
      if (s || terminal) return;
      endSocket(undefined, peerClosed ? undefined : 1000);
      reject(error);
    };
    const timeout = setTimeout(() => failJoin(new Error('timeout')), 10000);
    ws.onmessage = (ev) => {
      if (terminal) return;
      let msg: { t: string; d: unknown };
      try { msg = JSON.parse(ev.data as string); } catch { return; }
      if (msg.t === 'snap') {
        const snap = msg.d as Snapshot;
        try { assertRulesVersion(snap.rulesVersion); }
        catch (error) { if (s) endSocket((error as Error).message, 1000); else failJoin(error); return; }
        s?.onSnapshot(snap);
      }
      else if (msg.t === 'welcome' && !s) {
        clearTimeout(timeout);
        try { assertRulesVersion((msg.d as { rulesVersion?: number }).rulesVersion);assertContentManifest((msg.d as {contentManifest?:string}).contentManifest); }
        catch (error) { failJoin(error); return; }
        s = {
          id: (msg.d as { id: string }).id,
          online: true,
          // A private room plays its first player's map, whatever this player had selected.
          map: getMap((msg.d as { map?: string }).map ?? opts.map),
          mapId: mapIdOf((msg.d as { map?: string }).map ?? opts.map),
          roomCode: opts.room,
          get closeReason() { return closeReason; },
          send: (inputs) => {
            if (terminal || ws.readyState !== WebSocket.OPEN) return;
            outbox.push(...inputs);
            if (outbox.length > 16) sendNow();
            else flush ??= setTimeout(sendNow, 30);
          },
          onSnapshot: () => {},
          onClose: () => {},
          close: () => endSocket(undefined, 1000),
          rematch: () => { clearQueued(); if (!terminal && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'rematch' })); },
          setPaused: () => {},
        };
        resolve(s);
      } else if (msg.t === 'error' && !s) failJoin(new Error(String(msg.d)));
    };
    ws.onerror = () => { if (!s) failJoin(new Error('无法连接服务器')); };
    ws.onclose = (ev) => {
      if (s) endSocket(`disconnected (${ev.code})`);
      else failJoin(new Error(`连接被关闭 (${ev.code})`), true);
    };
  });
}

/** `rand` picks the bots' kits: every legal loadout, re-rolled for each rematch. */
export function startOffline(opts: JoinOptions, difficulty: 'easy' | 'normal' | 'hard', rand: () => number = Math.random,
  _exploration?: ExplorationModel, neural?: NeuralPolicyModel): Session {
  const match = new Match(getMap(opts.map), opts.layout);
  const team: Team = opts.team === 'B' ? 'B' : 'A';
  const id = 'you';
  match.addPlayer(id, { name: opts.name || 'You', team, char: opts.char, heroId:opts.heroId, skins: opts.skins, loadout: opts.loadout, utility: opts.utility, bot: false });
  const kit = () => ({ loadout: randomBotLoadout(rand), utility: randomBotUtility(rand) });
  let seed = 7;
  for (const t of ['A', 'B'] as Team[]) {
    for (let i = match.teamCount(t); i < TEAM_CAPACITY[opts.layout][t]; i++) {
      const n = seed++, k = kit();
      const bot = learnedOpponent(neural);
      match.addPlayer(`bot-${n}`, { name: `Bot ${n - 6}`, team: t, char: randomBotHero([...match.slots.values()].map(s => ({ team: s.info.team, char: s.state.char })), t, rand), skins: [n % 2, n % 2, n % 2], loadout: k.loadout, utility: k.utility, bot: true }, bot);
    }
  }
  match.botKit = kit;
  match.stats.meta = { source: 'offline', botSkill: difficulty, host: typeof location === 'undefined' ? undefined : location.hostname };
  return runLocal(match, id);
}

/** Offline training range: you, the range map and its dummies. */
export function startRange(opts: JoinOptions): Session {
  const match = new Match(getRangeMap(), '1v1');
  setupRange(match);
  const id = 'you';
  match.addPlayer(id, { name: opts.name || 'You', team: 'A', char: opts.char, heroId:opts.heroId, skins: opts.skins, loadout: opts.loadout, utility: opts.utility, bot: false });
  const s = runLocal(match, id);
  s.practice = { apply: (choice) => applyPracticeLoadout(match, id, choice), resetDummies: () => resetDummies(match) };
  return s;
}

function runLocal(match: Match, id: string): Session {
  let last = performance.now(), acc = 0, paused = false;
  const s: Session = {
    id,
    online: false,
    map: match.map,
    send: (inputs) => match.queueInputs(id, inputs),
    onSnapshot: () => {},
    onClose: () => {},
    close: () => { clearInterval(timer); match.flushStats(); deliver(); },
    rematch: () => match.rematch(),
    setPaused: (p) => { paused = p; last = performance.now(); acc = 0; },
    match,
  };
  const deliver = () => { for (const r of match.stats.drain()) { try { s.onStats?.(r); } catch { /* telemetry never breaks play */ } } };
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
    deliver();
  }, 4);
  return s;
}
