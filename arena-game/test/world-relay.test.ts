import { describe, expect, it } from 'vitest';
import { WorldRelayCore, WORLD_MESSAGE_RATE, WORLD_MESSAGE_MAX, validWorldRoomCode } from '../worker/worldRelay';

const inbox = () => { const got: any[] = []; return { got, send: (d: string) => got.push(JSON.parse(d)) }; };

describe('World co-op relay', () => {
  it('first in hosts, the second sees the host, a third is refused', () => {
    const r = new WorldRelayCore(), a = inbox(), b = inbox();
    r.join('a', a.send); r.join('b', b.send);
    expect(a.got[0]).toEqual({ t: 'welcome', d: { id: 'a', host: true, peers: [] } });
    expect(b.got[0]).toEqual({ t: 'welcome', d: { id: 'b', host: false, peers: ['a'] } });
    expect(a.got[1]).toEqual({ t: 'peer', d: { id: 'b', joined: true } });
    expect(() => r.join('c', inbox().send)).toThrow('room full');
  });
  it('forwards only known message types to the other player; enemies only from the host', () => {
    const r = new WorldRelayCore(), a = inbox(), b = inbox();
    r.join('a', a.send); r.join('b', b.send); a.got.length = b.got.length = 0;
    expect(r.message('b', JSON.stringify({ t: 'state', d: { p: [1, 2, 3] } }))).toBe(true);
    expect(a.got).toEqual([{ t: 'state', from: 'b', d: { p: [1, 2, 3] } }]); expect(b.got).toEqual([]);
    expect(r.message('b', JSON.stringify({ t: 'enemies', d: [] }))).toBe(false);
    expect(r.message('a', JSON.stringify({ t: 'enemies', d: [] }))).toBe(true);
    expect(r.message('a', JSON.stringify({ t: 'welcome', d: {} }))).toBe(false);
    expect(r.message('a', 'not json')).toBe(false);
    expect(r.message('a', 'x'.repeat(WORLD_MESSAGE_MAX + 1))).toBe(false);
  });
  it('rate-limits a flooding client and hands hosting over when the host leaves', () => {
    const r = new WorldRelayCore(), a = inbox(), b = inbox();
    r.join('a', a.send); r.join('b', b.send);
    let sent = 0; for (let i = 0; i < WORLD_MESSAGE_RATE + 20; i++) if (r.message('b', '{"t":"state","d":0}', 1000)) sent++;
    expect(sent).toBe(WORLD_MESSAGE_RATE);
    expect(r.message('b', '{"t":"state","d":0}', 2100)).toBe(true);
    b.got.length = 0; r.leave('a');
    expect(b.got).toEqual([{ t: 'peer', d: { id: 'a', joined: false } }, { t: 'host', d: { id: 'b' } }]);
    expect(r.host).toBe('b');
  });
  it('room codes are five unambiguous characters', () => {
    expect(validWorldRoomCode('AB2CD')).toBe(true);
    for (const bad of ['ab2cd', 'AB0CD', 'ABCD', 'ABCDEF', 'ABIOD', 7]) expect(validWorldRoomCode(bad)).toBe(false);
  });
});
