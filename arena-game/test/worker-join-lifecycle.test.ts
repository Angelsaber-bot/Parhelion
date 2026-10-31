import { afterEach, expect, it, vi } from 'vitest';
import { joinOnline } from '../src/session.ts';
import { RULES_VERSION } from '../shared/protocol.ts';

class Socket {
  static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
  static instances: Socket[] = [];
  readyState = Socket.OPEN; closes: (number | undefined)[] = []; sent: string[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  constructor(_url: string) { Socket.instances.push(this); }
  send(value: string) { this.sent.push(value); }
  close(code?: number) { this.closes.push(code); this.readyState = Socket.CLOSING; }
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); Socket.instances = []; });
for (const failure of ['server-error', 'socket-error', 'timeout', 'bad-welcome', 'bad-snapshot', 'closed'] as const) it(`rejected Worker ${failure} releases client ownership and ignores late messages`, async () => {
  vi.useFakeTimers(); vi.stubGlobal('WebSocket', Socket);
  const pending = joinOnline('wss://mock.invalid/arena', { layout: '1v1', team: 'A', name: 'Test', char: 0, skins: [], map: 'blackflag' });
  const rejected = pending.then(() => { throw new Error('must reject'); }, error => error);
  const socket = Socket.instances[0], staleMessage = socket.onmessage!;
  if (failure === 'server-error') socket.message({ t: 'error', d: 'room full' });
  if (failure === 'socket-error') socket.onerror!();
  if (failure === 'timeout') vi.advanceTimersByTime(10000);
  if (failure === 'bad-welcome') socket.message({ t: 'welcome', d: { id: 'x', rulesVersion: -1 } });
  if (failure === 'bad-snapshot') socket.message({ t: 'snap', d: { rulesVersion: -1 } });
  if (failure === 'closed') { socket.readyState = Socket.CLOSED; socket.onclose!({ code: 1006 }); }
  expect(await rejected).toBeInstanceOf(Error);
  expect(socket.closes.length).toBe(failure === 'closed' ? 0 : 1);
  expect(vi.getTimerCount()).toBe(0); expect(socket.onmessage).toBeNull(); expect(socket.onerror).toBeNull();
  staleMessage({ data: JSON.stringify({ t: 'welcome', d: { id: 'late', rulesVersion: RULES_VERSION } }) });
  staleMessage({ data: JSON.stringify({ t: 'snap', d: { rulesVersion: RULES_VERSION } }) });
  expect(socket.closes.length).toBe(failure === 'closed' ? 0 : 1); expect(socket.sent).toEqual([]); expect(vi.getTimerCount()).toBe(0);
});
it('healthy Worker join keeps normal input batching, rematch and server-close delivery', async () => {
  vi.useFakeTimers(); vi.stubGlobal('WebSocket', Socket);
  const pending = joinOnline('wss://mock.invalid/arena', { layout: '1v1', team: 'A', name: 'Test', char: 0, skins: [] });
  const socket = Socket.instances[0]; socket.message({ t: 'welcome', d: { id: 'live', rulesVersion: RULES_VERSION } });
  const session = await pending; let snapshots = 0, closes = 0;
  session.onSnapshot = () => snapshots++; session.onClose = () => closes++;
  socket.message({ t: 'snap', d: { rulesVersion: RULES_VERSION } }); expect(snapshots).toBe(1);
  session.send([{ seq: 1, mx: 1, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 0, view: 0 }]);
  vi.advanceTimersByTime(30); expect(JSON.parse(socket.sent[0]).t).toBe('input');
  session.rematch(); expect(JSON.parse(socket.sent[1]).t).toBe('rematch');
  socket.onclose!({ code: 1006 }); expect(closes).toBe(1); expect(vi.getTimerCount()).toBe(0);
});
