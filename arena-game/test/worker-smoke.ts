// Smoke test for the Cloudflare Worker server (local `npm run worker:dev` or the deployed URL):
//   npx tsx test/worker-smoke.ts wss://parhelion-arena.<sub>.workers.dev/arena
// Two clients join a 1v1, must share a room, see both players in snapshots, and move by input.
const url = process.argv[2] ?? 'ws://127.0.0.1:8787/arena';
const join = (team: string, name: string) => new Promise<{ ws: WebSocket; id: string; snaps: any[] }>((res, rej) => {
  const o = { layout: '1v1', team, name, char: 0, skins: [], map: 'aster' };
  const ws = new WebSocket(`${url}?o=${encodeURIComponent(JSON.stringify(o))}`);
  const c = { ws, id: '', snaps: [] as any[] };
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'welcome') { c.id = m.d.id; res(c); } else if (m.t === 'snap') c.snaps.push(m.d); else if (m.t === 'error') rej(new Error(m.d)); };
  ws.onerror = () => rej(new Error('ws error'));
  setTimeout(() => rej(new Error('timeout')), 10000);
});
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const a = await join('A', 'SmokeA');
const b = await join('auto', 'SmokeB');
await wait(500);
const last = a.snaps.at(-1);
const ids = last.players.map((p: any) => p.id).sort();
console.log('players in A snapshot:', last.players.map((p: any) => `${p.name}/${p.team}`).join(', '));
if (!ids.includes(a.id) || !ids.includes(b.id)) throw new Error('clients are not in the same room');
const before = last.players.find((p: any) => p.id === a.id); const pa = (p: any) => [p.x.toFixed(2), p.z.toFixed(2)];
let seq = 0;
for (let i = 0; i < 6; i++) {
  a.ws.send(JSON.stringify({ t: 'input', d: Array.from({ length: 10 }, () => ({ seq: ++seq, mx: 0, mz: 1, yaw: 0, pitch: 0, buttons: 0, weapon: 0, view: 0 })) }));
  await wait(170);
}
await wait(300);
const after = b.snaps.at(-1).players.find((p: any) => p.id === a.id);
console.log('A moved (seen by B):', pa(before), '→', pa(after), last.phase, `snapshots/s ≈ ${(a.snaps.length / 1.8).toFixed(0)}`);
a.ws.close(); b.ws.close();
console.log('OK');
process.exit(0);
