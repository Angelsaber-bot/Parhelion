import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { DEFAULT_PORT } from '../shared/protocol.ts';
import { registerArenaRooms } from './ArenaRoom.ts';

const port = Number(process.env.ARENA_PORT ?? DEFAULT_PORT);
const server = new Server({ transport: new WebSocketTransport() });
registerArenaRooms(server);
await server.listen(port);
console.log(`Parhelion Arena server on ws://0.0.0.0:${port}`);
