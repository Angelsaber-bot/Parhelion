// Live Arena latency probe: joins a room, sends 60 Hz inputs for 15 s and reports input round trip, snapshot
// size/rate and server tick rate. Run two at once to measure a live 1v1:
//   npx tsx tools/latency-probe.ts wss://parhelion-arena.lejiazhang-us.workers.dev/arena 1v1
import { RULES_VERSION, type JoinOptions } from '../shared/protocol.ts';
const url = process.argv[2] ?? 'wss://parhelion-arena.lejiazhang-us.workers.dev/arena';
const layout = (process.argv[3] ?? '2v2') as JoinOptions['layout'];
const opts: JoinOptions = { rulesVersion: RULES_VERSION, layout, team: 'auto', name: 'Probe', char: 2, skins: [], map: 'aster', loadout: ['lumen', 'corona', 'blade'], utility: 'smoke' } as JoinOptions;
const t0 = performance.now();
const ws = new WebSocket(`${url}?o=${encodeURIComponent(JSON.stringify(opts))}`);
let players = 0, phase = '', ents = 0; let id = '', seq = 0, bytes = 0, snaps = 0, firstTick = -1, firstAt = 0, lastTick = 0;
const sent = new Map<number, number>(), rtts: number[] = [], gaps: number[] = []; let lastSnapAt = 0, maxSize = 0;
ws.onmessage = (e) => {
  const now = performance.now(), raw = String(e.data), msg = JSON.parse(raw);
  if (msg.t === 'welcome') { id = msg.d.id; console.log('welcome after', Math.round(now - t0), 'ms'); return; }
  if (msg.t !== 'snap') return;
  bytes += raw.length; snaps++; players = msg.d.players.length; phase = msg.d.phase; ents = (msg.d.entities?.length ?? 0) + (msg.d.smokes?.length ?? 0); maxSize = Math.max(maxSize, raw.length);
  if (lastSnapAt) gaps.push(now - lastSnapAt); lastSnapAt = now;
  if (firstTick < 0) { firstTick = msg.d.tick; firstAt = now; } lastTick = msg.d.tick;
  const me = msg.d.players.find((p: { id: string }) => p.id === id);
  if (me) for (const [s, at] of sent) if (me.lastSeq >= s) { rtts.push(now - at); sent.delete(s); }
};
ws.onopen = () => {
  const timer = setInterval(() => { seq++; sent.set(seq, performance.now()); ws.send(JSON.stringify({ t: 'input', d: [{ seq, mx: seq % 120 < 60 ? 1 : -1, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 0, view: lastTick }] })); }, 1000 / 60);
  setTimeout(() => {
    clearInterval(timer); ws.close();
    const secs = (lastSnapAt - firstAt) / 1000, q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length * p)] ?? -1); };
    console.log(JSON.stringify({ layout, players, phase, ents, snaps, snapsPerSec: +(snaps / secs).toFixed(1), avgKB: +(bytes / snaps / 1024).toFixed(1), maxKB: +(maxSize / 1024).toFixed(1), KBps: +(bytes / secs / 1024).toFixed(0),
      serverTicksPerSec: +((lastTick - firstTick) / secs).toFixed(1), rtt: { p50: q(rtts, .5), p90: q(rtts, .9), max: q(rtts, .999) }, snapGap: { p50: q(gaps, .5), p99: q(gaps, .99), max: q(gaps, .999) }, unacked: sent.size }));
    process.exit(0);
  }, 15000);
};
