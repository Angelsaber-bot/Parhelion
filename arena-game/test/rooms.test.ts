import { afterEach, describe, expect, it, vi } from 'vitest';
import { assignRoom, reportRoom, ROOM_STALE_MS, type OpenRoom } from '../worker/lobbyRooms.ts';
import { newRoomCode, normalizeRoomCode, RULES_VERSION } from '../shared/protocol.ts';
import { joinOnline } from '../src/network/session.ts';

describe('quick match', () => {
  let n = 0; const id = () => `r${++n}`;
  it('two players asking at the same time share one room', () => {
    const rooms: Record<string, OpenRoom> = {};
    const a = assignRoom(rooms, 'k', 2, 0, id), b = assignRoom(rooms, 'k', 2, 10, id);
    expect(a).toBe(b); expect(assignRoom(rooms, 'k', 2, 20, id)).not.toBe(a);
  });
  it('a room that stopped reporting (deploy, eviction, lost socket) no longer splits the next pair', () => {
    const rooms: Record<string, OpenRoom> = {};
    const ghost = assignRoom(rooms, 'k', 2, 0, id); // its player vanished without a goodbye
    const later = ROOM_STALE_MS + 1000, a = assignRoom(rooms, 'k', 2, later, id), b = assignRoom(rooms, 'k', 2, later + 50, id);
    expect(rooms[ghost]).toBeUndefined(); expect(a).toBe(b);
  });
  it('a live room keeps its seats through heartbeats, and its own count is the truth', () => {
    const rooms: Record<string, OpenRoom> = {};
    const live = assignRoom(rooms, 'k', 2, 0, id);
    for (let t = 4000; t <= 40_000; t += 4000) expect(reportRoom(rooms, live, 1, t)).toBe(true);
    expect(assignRoom(rooms, 'k', 2, 40_500, id)).toBe(live);
    expect(reportRoom(rooms, live, 0, 41_000)).toBe(true); expect(rooms[live]).toBeUndefined();
    expect(reportRoom(rooms, 'code:v1:ABCDE', 1, 0)).toBe(false);
  });
  it('rebuilds an empty lobby from its live rooms without resurrecting closed or private rooms', () => {
    const rooms: Record<string, OpenRoom> = {}, queue = { key: 'v44|2v2|frostcourt|0', cap: 4 };
    const live = `${queue.key}#live`;
    expect(reportRoom(rooms, 'code:v44:ABCDE', 1, 100, queue)).toBe(false);
    expect(reportRoom(rooms, `${queue.key}#closed`, 0, 100, queue)).toBe(false);
    expect(reportRoom(rooms, live, 3, 100, queue)).toBe(true);
    expect(assignRoom(rooms, 'v44|2v2|aster|0', 4, 101, id)).not.toBe(live);
    expect(assignRoom(rooms, queue.key, queue.cap, 102, id)).toBe(live);
    expect(assignRoom(rooms, queue.key, queue.cap, 103, id)).not.toBe(live);
  });
});

describe('private room codes', () => {
  it('accept what people type and reject look-alike characters', () => {
    expect(normalizeRoomCode(' ab-c2d ')).toBe('ABC2D'); expect(normalizeRoomCode('abcde')).toBe('ABCDE');
    for (const bad of ['ABCD', 'ABCDEF', 'ABCD0', 'ABCDO', 'ABCD1', 'ABCDI', '', null, 7]) expect(normalizeRoomCode(bad)).toBeNull();
    for (let i = 0; i < 200; i++) expect(normalizeRoomCode(newRoomCode())).not.toBeNull();
  });
});

class Socket {
  static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
  static instances: Socket[] = [];
  readyState = Socket.OPEN; sent: string[] = []; url: string;
  onmessage: ((event: { data: string }) => void) | null = null; onerror: (() => void) | null = null; onclose: ((event: { code: number }) => void) | null = null;
  constructor(url: string) { this.url = url; Socket.instances.push(this); }
  send(value: string) { this.sent.push(value); }
  close() { this.readyState = Socket.CLOSING; }
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
afterEach(() => { vi.unstubAllGlobals(); Socket.instances = []; });
describe('joining a private room', () => {
  it('sends the normalised code and plays the room map, not the one this player picked', async () => {
    vi.stubGlobal('WebSocket', Socket);
    const pending = joinOnline('wss://mock.invalid/arena', { layout: '1v1', team: 'A', name: 'Guest', char: 0, skins: [], map: 'sakura', room: 'ab cde' });
    const socket = Socket.instances[0];
    expect(JSON.parse(decodeURIComponent(new URL(socket.url).searchParams.get('o')!)).room).toBe('ABCDE');
    socket.message({ t: 'welcome', d: { id: 'p2', rulesVersion: RULES_VERSION, map: 'lishan' } });
    const session = await pending;
    expect(session.mapId).toBe('lishan'); expect(session.roomCode).toBe('ABCDE');
    session.close();
  });
  it('rejects a malformed code before connecting', async () => {
    vi.stubGlobal('WebSocket', Socket);
    await expect(joinOnline('wss://mock.invalid/arena', { layout: '1v1', team: 'A', name: 'Guest', char: 0, skins: [], room: 'ABCD0' })).rejects.toThrow();
    expect(Socket.instances).toHaveLength(0);
  });
});
