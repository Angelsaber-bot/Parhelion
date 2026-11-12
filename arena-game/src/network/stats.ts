// Offline rounds run in the browser, so their human weapon telemetry is handed to the public Arena
// Worker (the online rooms record theirs server-side). Anonymous: no names, no device id.
import { PUBLIC_SERVER } from '../../shared/protocol.ts';
import type { MatchRecord } from '../../shared/weaponStats.ts';

/** wss://host/arena → https://host/stats */
export const statsUrl = (server = PUBLIC_SERVER): string => server.replace(/^ws/, 'http').replace(/\/arena\/?$/, '/stats');

export function postStats(record: MatchRecord): void {
  try {
    // text/plain keeps it a simple CORS request; keepalive lets a round quit on page close still land.
    void fetch(statsUrl(), { method: 'POST', body: JSON.stringify(record), keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
  } catch { /* telemetry never breaks play */ }
}
