import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ArenaRoom } from '../../arena-game/server/ArenaRoom.ts';
import { ROOM_NAME } from '../../arena-game/shared/protocol.ts';
import { createStaticHandler, isLocalRequest } from './http.mjs';

async function main() {
  let shutdown: (() => Promise<void>) | undefined;
  // An interrupted Terminal/launcher must not leave a listening child behind.
  if (process.send) process.once('disconnect', () => {
    if (shutdown) void shutdown();
    else process.exit(0);
  });
  const root = process.argv[2];
  const port = Number(process.argv[3]);
  if (!root || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid server root or port');
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'dist/build.json'), 'utf8'));
  const serve = await createStaticHandler(root, manifest.buildId);
  const http = createServer();
  // The transport and static files share one HTTP server; no proxy or second port.
  const transport = new WebSocketTransport({ server: http });
  // Port collisions are an expected launcher fallback, not a scary stack trace.
  const transportErrors = http.listeners('error');
  http.removeAllListeners('error');
  http.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EADDRINUSE') for (const listener of transportErrors) listener.call(http, error);
  });
  const game = new Server({
    transport, greet: false, gracefullyShutdown: false,
    express(app) {
      app.disable('x-powered-by');
      app.use((req, res) => {
        void serve(req, res).catch((error: Error) => {
          console.error('Static request failed:', error.message);
          if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          if (!res.writableEnded) res.end('File unavailable');
        });
      });
    },
  });
  game.define(ROOM_NAME, ArenaRoom).filterBy(['layout', 'map', 'bots']);

  // Complete Colyseus route registration *before* wrapping its request handlers.
  // A plain createServer(staticHandler) would otherwise compete with matchmaking.
  await game.serverless();
  const requestListeners = http.listeners('request');
  http.removeAllListeners('request');
  http.on('request', (req: IncomingMessage, res: ServerResponse) => {
    if (!isLocalRequest(req)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Connection': 'close' });
      res.end('Only local requests are allowed.');
      return;
    }
    for (const listener of requestListeners) listener.call(http, req, res);
  });
  const upgradeListeners = http.listeners('upgrade');
  http.removeAllListeners('upgrade');
  http.on('upgrade', (req, socket, head) => {
    if (!isLocalRequest(req)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    for (const listener of upgradeListeners) listener.call(http, req, socket, head);
  });
  let closing = false;
  shutdown = async () => {
    if (closing) return;
    closing = true;
    const timer = setTimeout(() => process.exit(0), 2500).unref();
    await game.gracefullyShutdown(false);
    clearTimeout(timer);
    process.exit(0);
  };
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) process.on(signal, () => { void shutdown?.(); });

  try {
    // Bind only loopback. Register error before listening, including EADDRINUSE.
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      http.once('error', onError);
      http.listen(port, '127.0.0.1', () => {
        http.removeListener('error', onError);
        resolve();
      });
    });
    process.send?.({ event: 'ready', port });
    console.log(`Parhelion ready at http://127.0.0.1:${port}/`);
  } catch (error) {
    await game.gracefullyShutdown(false);
    throw error;
  }
}

void main().catch((error: NodeJS.ErrnoException) => {
  process.send?.({ event: 'error', code: error.code ?? 'START_ERROR', message: error.message });
  if (error.code !== 'EADDRINUSE') console.error(`Parhelion could not start: ${error.message}`);
  process.exit(error.code === 'EADDRINUSE' ? 20 : 1);
});
