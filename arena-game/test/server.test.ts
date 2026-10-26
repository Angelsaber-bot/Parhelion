// End-to-end: real Colyseus server + SDK clients exchanging inputs and snapshots.
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client } from '@colyseus/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArenaRoom } from '../server/ArenaRoom.ts';
import type { Snapshot } from '../shared/match.ts';
import { BTN, type Input } from '../shared/sim.ts';

const PORT = 25670 + Math.floor(Math.random() * 100);
let server: Server;
beforeAll(async () => {
  server = new Server({ transport: new WebSocketTransport() });
  server.define('arena', ArenaRoom).filterBy(['layout', 'map', 'bots']);
  await server.listen(PORT);
});
afterAll(async () => { await server.gracefullyShutdown(false); });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('ArenaRoom', () => {
  it('1v1: two clients get teams, snapshots, and a team-full rejection', async () => {
    const url = `ws://127.0.0.1:${PORT}`;
    const a = await new Client(url).joinOrCreate('arena', { layout: '1v1', team: 'A', name: 'A', char: 0, skins: [] });
    const b = await new Client(url).joinOrCreate('arena', { layout: '1v1', team: 'auto', name: 'B', char: 1, skins: [] });
    expect(b.roomId).toBe(a.roomId);
    let last: Snapshot | null = null;
    a.onMessage('snap', (s: Snapshot) => { last = s; });
    b.onMessage('snap', () => {});
    await wait(300);
    expect(last).not.toBeNull();
    const snap = last as unknown as Snapshot;
    expect(snap.players.map((p) => p.team).sort()).toEqual(['A', 'B']);
    // a third client asking for team A in this full 1v1 room lands in a new room instead
    const c = await new Client(url).joinOrCreate('arena', { layout: '1v1', team: 'A', name: 'C', char: 0, skins: [] });
    expect(c.roomId).not.toBe(a.roomId);
    // inputs move the player authoritatively
    const meBefore = snap.players.find((p) => p.id === a.sessionId)!;
    let seq = 0;
    for (let i = 0; i < 30; i++) {
      const batch: Input[] = [];
      for (let k = 0; k < 2; k++) batch.push({ seq: ++seq, mx: 0, mz: 1, yaw: meBefore.yaw, pitch: 0, buttons: i === 0 && k === 0 ? BTN.FIRE : 0, weapon: 0, view: 0 });
      a.send('input', batch);
      await wait(33);
    }
    await wait(200);
    const meAfter = (last as unknown as Snapshot).players.find((p) => p.id === a.sessionId)!;
    expect(Math.hypot(meAfter.x - meBefore.x, meAfter.z - meBefore.z)).toBeGreaterThan(3);
    expect(meAfter.lastSeq).toBe(seq);
    expect(meAfter.ammo[0]).toBe(29);
    await Promise.all([a.leave(), b.leave(), c.leave()]);
  });

  it('bot fill: a lone human gets bots in the other slots', async () => {
    const r = await new Client(`ws://127.0.0.1:${PORT}`).joinOrCreate('arena', { layout: '2v2', team: 'B', name: 'H', char: 0, skins: [], bots: true });
    let last: Snapshot | null = null;
    r.onMessage('snap', (s: Snapshot) => { last = s; });
    await wait(300);
    const s = last as unknown as Snapshot;
    expect(s.players.length).toBe(4);
    expect(s.players.filter((p) => p.bot).length).toBe(3);
    expect(s.players.find((p) => p.id === r.sessionId)!.team).toBe('B');
    await r.leave();
  });

  it('map choice: players on different maps get different rooms, each told its map', async () => {
    const url = `ws://127.0.0.1:${PORT}`;
    const welcome = (r: { onMessage: (t: string, cb: (m: { map: string }) => void) => void }) =>
      new Promise<string>((res) => r.onMessage('welcome', (m) => res(m.map)));
    const z = await new Client(url).joinOrCreate('arena', { layout: '1v1', team: 'A', name: 'Z', char: 0, skins: [], map: 'zenith' });
    const zMap = welcome(z);
    const a = await new Client(url).joinOrCreate('arena', { layout: '1v1', team: 'A', name: 'S', char: 0, skins: [], map: 'aster' });
    const aMap = welcome(a);
    z.onMessage('snap', () => {}); a.onMessage('snap', () => {});
    expect(a.roomId).not.toBe(z.roomId);
    expect(await zMap).toBe('zenith');
    expect(await aMap).toBe('aster');
    const z2 = await new Client(url).joinOrCreate('arena', { layout: '1v1', team: 'auto', name: 'Z2', char: 1, skins: [], map: 'zenith' });
    z2.onMessage('snap', () => {}); z2.onMessage('welcome', () => {});
    expect(z2.roomId).toBe(z.roomId);
    await Promise.all([z.leave(), a.leave(), z2.leave()]);
  });
});
