// Quick-match bookkeeping for the Lobby Durable Object (worker/index.ts), kept free of Cloudflare
// imports so it can be tested directly.

export interface OpenRoom { name: string; key: string; humans: number; cap: number; at: number }
export type MatchQueue = Pick<OpenRoom, 'key' | 'cap'>;
/** A running room reports its player count at least this often; the lobby forgets quieter ones. */
export const ROOM_HEARTBEAT_MS = 4_000, ROOM_STALE_MS = 15_000;

/**
 * Hands out a room with a free human seat for `key` (or opens one) and reserves that seat.
 * Rooms not heard from for ROOM_STALE_MS are dropped first: a socket that never confirmed its seat,
 * or a room process that a deploy or eviction ended without saying goodbye, would otherwise keep a
 * phantom player count that sends the next two players to different rooms.
 */
export function assignRoom(rooms: Record<string, OpenRoom>, key: string, cap: number, now: number, newId: () => string): string {
  for (const r of Object.values(rooms)) if (now - r.at > ROOM_STALE_MS) delete rooms[r.name];
  let room = Object.values(rooms).find((r) => r.key === key && r.humans < r.cap);
  if (!room) {
    room = { name: `${key}#${newId()}`, key, humans: 0, cap, at: now };
    rooms[room.name] = room;
  }
  room.humans++;
  room.at = now;
  return room.name;
}

/** Live rooms can rebuild the lobby after an eviction. Zero closes a room. */
export function reportRoom(rooms: Record<string, OpenRoom>, name: string, humans: number, now: number, queue?: MatchQueue) {
  const r = rooms[name];
  if (!r) {
    if (humans <= 0 || !queue || !name.startsWith(`${queue.key}#`)) return false;
    rooms[name] = { name, ...queue, humans, at: now };
    return true;
  }
  if (humans <= 0) delete rooms[name];
  else { r.humans = humans; r.at = now; }
  return true;
}
