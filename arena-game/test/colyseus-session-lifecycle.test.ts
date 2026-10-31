/** Actual installed SDK and ArenaRoom on an ephemeral loopback port only. */
import { createServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client } from '@colyseus/sdk';
import { expect, it } from 'vitest';
import { ArenaRoom } from '../server/ArenaRoom.ts';
import { joinOnline, type Session } from '../src/session.ts';

it('LAN drop is terminal and deliberate Leave cannot retain unsupported SDK retries', async () => {
  let serverClient: any, serverRoom: ArenaRoom | undefined, sdkRoom: any;
  class TrackedRoom extends ArenaRoom { override onJoin(client: any, options: any) { super.onJoin(client, options); serverClient = client; serverRoom = this; } }
  const http = createServer(), server = new Server({ transport: new WebSocketTransport({ server: http }), greet: false });
  server.define('arena', TrackedRoom);
  const original = Client.prototype.joinOrCreate;
  Client.prototype.joinOrCreate = async function(this: Client, ...args: any[]) { const room = await original.apply(this, args as any); sdkRoom = room; return room; } as any;
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const until = async (predicate: () => boolean) => { const end = Date.now() + 2500; while (!predicate() && Date.now() < end) await wait(10); expect(predicate()).toBe(true); };
  const sessions: Session[] = [];
  try {
    await server.listen(0, '127.0.0.1'); const port = (http.address() as any).port;
    const opts = { layout: '1v1' as const, team: 'A' as const, name: 'Local test', char: 0, skins: [], map: 'blackflag' };
    const session = await joinOnline(`ws://127.0.0.1:${port}`, opts); sessions.push(session);
    expect(sdkRoom.reconnection.enabled).toBe(false);
    let closed = 0, snapshots = 0, reconnects = 0;
    session.onClose = () => closed++; session.onSnapshot = () => snapshots++;
    const reconnect = sdkRoom.connection.reconnect.bind(sdkRoom.connection);
    sdkRoom.connection.reconnect = (...args: any[]) => { reconnects++; return reconnect(...args); };
    await until(() => snapshots > 0);
    // Beyond the installed SDK's default 5-second minimum uptime: this was the
    // real branch that scheduled retries despite ArenaRoom removing the player.
    await wait(5100); serverClient.ref.terminate();
    await until(() => closed === 1 && !serverRoom!.match.slots.has(session.id));
    const before = snapshots; session.close(); session.close(); session.rematch();
    await wait(700);
    expect(reconnects).toBe(0); expect(sdkRoom.reconnection.retryCount).toBe(0); expect(closed).toBe(1); expect(snapshots).toBe(before);
    const second = await joinOnline(`ws://127.0.0.1:${port}`, opts); sessions.push(second);
    const leave = sdkRoom.leave.bind(sdkRoom); let leaves = 0, voluntaryCloseEvents = 0;
    sdkRoom.leave = (...args: any[]) => { leaves++; return leave(...args); }; second.onClose = () => voluntaryCloseEvents++;
    second.close(); second.close(); await until(() => !serverRoom!.match.slots.has(second.id));
    expect(leaves).toBe(1); expect(voluntaryCloseEvents).toBe(0);
  } finally {
    for (const session of sessions) session.close();
    Client.prototype.joinOrCreate = original; await server.gracefullyShutdown(false);
  }
}, 15000);
