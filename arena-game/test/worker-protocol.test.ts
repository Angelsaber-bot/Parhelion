// Real WebSocket JSON transport against the same RoomCore as the Cloudflare DO.
// This exercises client/server messages, not Cloudflare's unavailable host runtime.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { joinOnline } from '../src/session.ts';
import { RoomCore } from '../shared/room.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { BTN } from '../shared/sim.ts';
import type { Snapshot } from '../shared/match.ts';
const PORT = 28000 + Math.floor(Math.random() * 500);
let server: WebSocketServer, legacy: WebSocketServer;
beforeAll(async () => {
  const core = new RoomCore({ layout: '1v1' }); let next = 0;
  server = new WebSocketServer({ port: PORT });
  server.on('connection', (ws, req) => {
    const options = JSON.parse(new URL(req.url!, `http://localhost:${PORT}`).searchParams.get('o') ?? '{}');
    const id = `worker-${++next}`;
    try { ws.send(JSON.stringify({ t: 'welcome', d: core.join(id, options) })); }
    catch (error) { ws.send(JSON.stringify({ t: 'error', d: (error as Error).message })); ws.close(); return; }
    ws.on('message', (bytes) => {
      const msg = JSON.parse(String(bytes));
      if (msg.t === 'input') core.input(id, msg.d);
      let snap: Snapshot | null = null;
      for (let i = 0; i < 3; i++) snap = core.step() ?? snap;
      if (snap) for (const other of server.clients) other.send(JSON.stringify({ t: 'snap', d: snap }));
    });
    ws.on('close', () => core.leave(id));
  });
  legacy = new WebSocketServer({ port: PORT + 1000 });
  legacy.on('connection', (ws) => ws.send(JSON.stringify({ t: 'welcome', d: { id: 'old', tick: 0, map: 'aster' } })));
  await Promise.all([new Promise<void>((r) => server.once('listening', r)), new Promise<void>((r) => legacy.once('listening', r))]);
});
afterAll(async () => {
  for (const s of [server, legacy]) { s.clients.forEach((ws) => ws.terminate()); await new Promise<void>((r) => s.close(() => r())); }
});
it('plain JSON Worker protocol carries crouch and standing snapshots through actual sockets', async () => {
  const session = await joinOnline(`ws://127.0.0.1:${PORT}/arena`, { layout: '1v1', team: 'A', name: 'Crouch', char: 0, skins: [] });
  const snapshot = (buttons: number, seq: number) => new Promise<Snapshot>((resolve) => {
    session.onSnapshot = resolve;
    session.send([{ seq, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons, weapon: 0, view: 0 }]);
  });
  const crouch = await snapshot(BTN.CROUCH, 1);
  expect(crouch.rulesVersion).toBe(RULES_VERSION);
  expect(crouch.players.find((p) => p.id === session.id)!.crouched).toBe(true);
  const standing = await snapshot(0, 2);
  expect(standing.players.find((p) => p.id === session.id)!.crouched).toBe(false);
  session.close();
});
it('new Worker client refuses a legacy welcome rather than silently stripping crouch', async () => {
  await expect(joinOnline(`ws://127.0.0.1:${PORT + 1000}/arena`, { layout: '1v1', team: 'A', name: 'New', char: 0, skins: [] })).rejects.toThrow(/版本/);
});
