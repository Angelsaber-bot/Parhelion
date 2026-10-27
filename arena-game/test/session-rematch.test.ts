// Real clients over both supported transports: reset in the same room, not a stale result reload.
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { WebSocketServer } from 'ws';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ArenaRoom } from '../server/ArenaRoom.ts';
import { RoomCore } from '../shared/room.ts';
import { joinOnline, type Session } from '../src/session.ts';
import type { Match, Snapshot } from '../shared/match.ts';
import { COUNTDOWN_TICKS } from '../shared/content.ts';
const PORT = 30000 + Math.floor(Math.random() * 500);
let colyseus: Server, worker: WebSocketServer, room: ArenaRoom | undefined;
const core = new RoomCore({ layout: '1v1' });
class TrackedRoom extends ArenaRoom { override onCreate(options: Parameters<ArenaRoom['onCreate']>[0]) { super.onCreate(options); room = this; } }
const publish = () => { core.match.step(); const snap = core.match.snapshot(); for (const ws of worker.clients) ws.send(JSON.stringify({ t: 'snap', d: snap })); };
beforeAll(async () => {
  colyseus = new Server({ transport: new WebSocketTransport() }); colyseus.define('arena', TrackedRoom);
  await colyseus.listen(PORT);
  let next = 0; worker = new WebSocketServer({ port: PORT + 1000 });
  worker.on('connection', (ws, req) => {
    const options = JSON.parse(new URL(req.url!, `http://localhost:${PORT}`).searchParams.get('o') ?? '{}'), id = `rematch-${++next}`;
    ws.send(JSON.stringify({ t: 'welcome', d: core.join(id, options) }));
    ws.on('message', (bytes) => { const msg = JSON.parse(String(bytes)); if (msg.t === 'input') core.input(id, msg.d); if (msg.t === 'rematch') core.rematch(); publish(); });
    ws.on('close', () => core.leave(id));
  });
  await new Promise<void>((resolve) => worker.once('listening', resolve));
});
afterAll(async () => {
  worker.clients.forEach((ws) => ws.terminate()); await new Promise<void>((resolve) => worker.close(() => resolve()));
  await colyseus.gracefullyShutdown(false);
});
function finish(match: Match) {
  match.phase = 'ended'; match.phaseT = 0; match.score = { A: 7, B: 3 };
  for (const slot of match.slots.values()) { slot.kills = 4; slot.deaths = 2; slot.state.hp = 0; slot.state.alive = false; slot.respawn = 90; }
}
function waitSnapshot(session: Session, predicate: (snapshot: Snapshot) => boolean) {
  return new Promise<Snapshot>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('expected rematch snapshot timed out')), 2000);
    session.onSnapshot = (snapshot) => { if (predicate(snapshot)) { clearTimeout(timeout); resolve(snapshot); } };
  });
}
for (const transport of ['Colyseus', 'Worker JSON'] as const) it(`${transport}: two consecutive fresh rounds, duplicate requests, preserved equipment and one room`, async () => {
  const url = `ws://127.0.0.1:${transport === 'Colyseus' ? PORT : PORT + 1000}${transport === 'Colyseus' ? '' : '/arena'}`;
  const a = await joinOnline(url, { layout: '1v1', team: 'A', name: 'Keep me', char: 0, skins: [1], loadout: ['longnight','firefly','hammer'] });
  const b = await joinOnline(url, { layout: '1v1', team: 'B', name: 'Opponent', char: 1, skins: [], loadout: ['halo','lumen','blade'] });
  const match = transport === 'Colyseus' ? room!.match : core.match, ids = [...match.slots.keys()].sort();
  try {
    for (let round = 0; round < 2; round++) {
      finish(match);
      const ended = waitSnapshot(a, (s) => s.phase === 'ended'); if (transport !== 'Colyseus') publish();
      expect((await ended).score).toEqual({ A: 7, B: 3 });
      const nextA = waitSnapshot(a, (s) => s.phase === 'countdown'), nextB = waitSnapshot(b, (s) => s.phase === 'countdown');
      if (transport === 'Worker JSON') a.send([{ seq: 999 + round, mx: 1, mz: 1, yaw: 0, pitch: 0, buttons: 1, weapon: 0, view: 0 }]);
      a.rematch(); a.rematch(); b.rematch();
      for (const snap of await Promise.all([nextA,nextB])) {
        expect(snap.score).toEqual({ A: 0, B: 0 }); expect(snap.phaseT).toBeLessThanOrEqual(COUNTDOWN_TICKS);
        expect(snap.players.every((p) => p.kills === 0 && p.deaths === 0 && p.alive && p.respawn === 0)).toBe(true);
        expect(snap.players.find((p) => p.id === a.id)!.loadout).toEqual(['longnight','firefly','hammer']);
        expect(snap.players.find((p) => p.id === a.id)!.name).toBe('Keep me');
        if (transport === 'Worker JSON') expect(snap.players.find((p) => p.id === a.id)!.lastSeq).toBe(0); // pending old-round batch was discarded before rematch
        expect(snap.events.filter((e) => e.t === 'phase' && e.phase === 'countdown').length).toBeLessThanOrEqual(1);
      }
      const live = waitSnapshot(a, (s) => s.phase === 'live'); match.phaseT = 1;
      if (transport !== 'Colyseus') publish();
      expect((await live).score).toEqual({ A: 0, B: 0 }); expect([...match.slots.keys()].sort()).toEqual(ids);
    }
  } finally { a.close(); b.close(); }
}, 10000);
