import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { DEFAULT_PORT, PRIVATE_ROOM_NAME, ROOM_NAME } from '../shared/protocol.ts';
import { ArenaRoom } from './ArenaRoom.ts';

const port = Number(process.env.ARENA_PORT ?? DEFAULT_PORT);
const server = new Server({ transport: new WebSocketTransport() });
// Players asking for the same layout, map (and bot setting) share rooms.
server.define(ROOM_NAME, ArenaRoom).filterBy(['layout', 'map', 'bots']);
// Private rooms: same code, same room, whatever map each player had picked (the first one's wins).
server.define(PRIVATE_ROOM_NAME, ArenaRoom).filterBy(['room']);
await server.listen(port);
console.log(`Parhelion Arena server on ws://0.0.0.0:${port}`);
