// End-to-end: real Colyseus server + SDK clients exchanging inputs and snapshots.
import { Server, Room, type Client as ServerClient } from '@colyseus/core';
import { joinOnline } from '../src/session.ts';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client } from '@colyseus/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArenaRoom } from '../server/ArenaRoom.ts';
import type { Snapshot } from '../shared/match.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { BTN, type Input } from '../shared/sim.ts';

const PORT = 25670 + Math.floor(Math.random() * 100);
let server: Server;
beforeAll(async () => {
  server = new Server({ transport: new WebSocketTransport() });
  server.define('arena', ArenaRoom).filterBy(['layout', 'map', 'bots']);
  await server.listen(PORT);
});
afterAll(async () => { await server.gracefullyShutdown(false); });

// This delay paces input traffic only; assertions wait for observed protocol state.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function snapshots() {
  let latest: Snapshot | null = null;
  const pending = new Set<{ predicate: (snapshot: Snapshot) => boolean; resolve: (snapshot: Snapshot) => void }>();
  return {
    receive(snapshot: Snapshot) { latest = snapshot; for (const request of [...pending]) if (request.predicate(snapshot)) request.resolve(snapshot); },
    waitFor(predicate: (snapshot: Snapshot) => boolean, description: string, timeoutMs = 4000): Promise<Snapshot> {
      if (latest && predicate(latest)) return Promise.resolve(latest);
      return new Promise((resolve, reject) => {
        const request = { predicate, resolve: (snapshot: Snapshot) => { clearTimeout(timeout); pending.delete(request); resolve(snapshot); } };
        const timeout = setTimeout(() => {
          pending.delete(request);
          const observed = latest ? `tick=${latest.tick}, phase=${latest.phase}, players=${latest.players.length}, acknowledged=${latest.players.map((p) => p.lastSeq).join('/')}` : 'no snapshot received';
          reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${description}; ${observed}`));
        }, timeoutMs);
        pending.add(request);
      });
    },
  };
}

describe('ArenaRoom', () => {
  it('1v1: two clients get teams, snapshots, and a team-full rejection', async () => {
    const url = `ws://127.0.0.1:${PORT}`;
    const a = await new Client(url).joinOrCreate('arena', { rulesVersion: RULES_VERSION, layout: '1v1', team: 'A', name: 'A', char: 0, skins: [] });
    const b = await new Client(url).joinOrCreate('arena', { rulesVersion: RULES_VERSION, layout: '1v1', team: 'auto', name: 'B', char: 1, skins: [] });
    expect(b.roomId).toBe(a.roomId);
    const observed = snapshots();
    a.onMessage('snap', observed.receive);
    b.onMessage('snap', () => {});
    // Start the movement assertion after the real countdown, so CPU contention cannot
    // cause startLive's intentional spawn/ammo reset halfway through the input stream.
    const snap = await observed.waitFor((s) => s.phase === 'live' && s.players.length === 2, 'a live 1v1 snapshot', 6000);
    expect(snap.players.map((p) => p.team).sort()).toEqual(['A', 'B']);
    // a third client asking for team A in this full 1v1 room lands in a new room instead
    const c = await new Client(url).joinOrCreate('arena', { rulesVersion: RULES_VERSION, layout: '1v1', team: 'A', name: 'C', char: 0, skins: [] });
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
    const acknowledged = await observed.waitFor((s) => s.players.some((p) => p.id === a.sessionId && p.lastSeq === seq), `movement input sequence ${seq}`);
    const meAfter = acknowledged.players.find((p) => p.id === a.sessionId)!;
    expect(Math.hypot(meAfter.x - meBefore.x, meAfter.z - meBefore.z)).toBeGreaterThan(3);
    expect(meAfter.lastSeq).toBe(seq);
    expect(meAfter.ammo[0]).toBe(29);
    await Promise.all([a.leave(), b.leave(), c.leave()]);
  }, 12000);

  it('bot fill: a lone human gets bots in the other slots', async () => {
    const r = await new Client(`ws://127.0.0.1:${PORT}`).joinOrCreate('arena', { rulesVersion: RULES_VERSION, layout: '2v2', team: 'B', name: 'H', char: 0, skins: [], bots: true });
    const observed = snapshots();
    r.onMessage('snap', observed.receive);
    const s = await observed.waitFor((snap) => snap.players.length === 4 && snap.players.some((p) => p.id === r.sessionId), 'four occupied bot-fill seats');
    expect(s.players.length).toBe(4);
    expect(s.players.filter((p) => p.bot).length).toBe(3);
    expect(s.players.find((p) => p.id === r.sessionId)!.team).toBe('B');
    await r.leave();
  });

  it('map choice: players on different maps get different rooms, each told its map', async () => {
    const url = `ws://127.0.0.1:${PORT}`;
    const welcome = (r: { onMessage: (t: string, cb: (m: { map: string }) => void) => void }) =>
      new Promise<string>((res) => r.onMessage('welcome', (m) => res(m.map)));
    const z = await new Client(url).joinOrCreate('arena', { rulesVersion: RULES_VERSION, layout: '1v1', team: 'A', name: 'Z', char: 0, skins: [], map: 'sakura' });
    const zMap = welcome(z);
    const a = await new Client(url).joinOrCreate('arena', { rulesVersion: RULES_VERSION, layout: '1v1', team: 'A', name: 'S', char: 0, skins: [], map: 'aster' });
    const aMap = welcome(a);
    z.onMessage('snap', () => {}); a.onMessage('snap', () => {});
    expect(a.roomId).not.toBe(z.roomId);
    expect(await zMap).toBe('sakura');
    expect(await aMap).toBe('aster');
    const z2 = await new Client(url).joinOrCreate('arena', { rulesVersion: RULES_VERSION, layout: '1v1', team: 'auto', name: 'Z2', char: 1, skins: [], map: 'sakura' });
    z2.onMessage('snap', () => {}); z2.onMessage('welcome', () => {});
    expect(z2.roomId).toBe(z.roomId);
    await Promise.all([z.leave(), a.leave(), z2.leave()]);
  });
  it('crouch bit reaches authoritative Colyseus snapshot; release stands again', async () => {
    const session = await joinOnline(`ws://127.0.0.1:${PORT}`, { layout: '1v1', team: 'A', name: 'Crouch', char: 0, skins: [], map: 'blackflag' });
    const observed = snapshots(); session.onSnapshot = observed.receive;
    session.send([{ seq: 1, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: BTN.CROUCH, weapon: 0, view: 0 }]);
    const crouched = await observed.waitFor((s) => s.players.some((p) => p.id === session.id && p.lastSeq === 1), 'acknowledged crouch input');
    expect(crouched.rulesVersion).toBe(RULES_VERSION);
    expect(crouched.players.find((p) => p.id === session.id)!.crouched).toBe(true);
    session.send([{ seq: 2, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 0, view: 0 }]);
    const standing = await observed.waitFor((s) => s.players.some((p) => p.id === session.id && p.lastSeq === 2), 'acknowledged standing input');
    expect(standing.players.find((p) => p.id === session.id)!.crouched).toBe(false);
    session.close();
  });

  it('new server rejects an old client without crouch rules version', async () => {
    await expect(new Client(`ws://127.0.0.1:${PORT}`).joinOrCreate('arena', { layout: '1v1', team: 'A', name: 'Old' })).rejects.toThrow(/版本/);
  });

  it('real Colyseus validates loadouts and broadcasts selected catalog IDs for slot inputs', async () => {
    const url = `ws://127.0.0.1:${PORT}`;
    await expect(new Client(url).joinOrCreate('arena', { rulesVersion: RULES_VERSION, layout: '1v1', team: 'A', loadout: ['lumen', 'lumen', 'blade'] })).rejects.toThrow(/装备/);
    await expect(new Client(url).joinOrCreate('arena', { rulesVersion: 2, layout: '1v1', team: 'A' })).rejects.toThrow(/版本/);
    const session = await joinOnline(url, { layout: '1v1', team: 'A', name: 'Loadout', char: 0, skins: [], map: 'sakura', loadout: ['firefly', 'longnight', 'hammer'] });
    const observed = snapshots(); session.onSnapshot = observed.receive;
    try {
      for (const [seq, slot] of [0, 1, 2].entries()) {
        session.send([{ seq: seq + 1, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: slot, view: 0 }]);
        const acknowledged = await observed.waitFor((s) => s.players.some((p) => p.id === session.id && p.lastSeq === seq + 1), `loadout slot ${slot} acknowledgement`);
        const p = acknowledged.players.find((p) => p.id === session.id)!;
        expect(p.loadout).toEqual(['firefly', 'longnight', 'hammer']); expect(p.weaponSlot).toBe(slot); expect(p.weapon).toBe([3, 4, 7][slot]);
      }
    } finally { session.close(); }
  });

  it('new client rejects an old server welcome before prediction begins', async () => {
    class LegacyRoom extends Room {
      onJoin(client: ServerClient) { client.send('welcome', { id: client.sessionId, tick: 0, map: 'aster' }); }
    }
    const legacy = new Server({ transport: new WebSocketTransport() }); legacy.define('arena', LegacyRoom);
    await legacy.listen(PORT + 1000);
    try {
      await expect(joinOnline(`ws://127.0.0.1:${PORT + 1000}`, { layout: '1v1', team: 'A', name: 'New', char: 0, skins: [] })).rejects.toThrow(/版本/);
    } finally { await legacy.gracefullyShutdown(false); }
  });



});
