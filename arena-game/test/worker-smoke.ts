// Actual local/production Worker smoke. Intentionally opens temporary 1v1 clients, then leaves.
// npx tsx test/worker-smoke.ts wss://parhelion-arena.lejiazhang-us.workers.dev/arena
import { RULES_VERSION, type JoinOptions } from '../shared/protocol.ts';
import { BTN } from '../shared/sim.ts';
import type { Snapshot } from '../shared/match.ts';
import { loadoutWeapon, type Loadout } from '../shared/content.ts';
const url = process.argv[2] ?? 'ws://127.0.0.1:8787/arena';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sockets: WebSocket[] = [];
function join(team: 'A' | 'auto', name: string, loadout: Loadout, version = RULES_VERSION) {
  return new Promise<{ ws: WebSocket; id: string; snaps: Snapshot[] }>((resolve, reject) => {
    const opts: JoinOptions = { rulesVersion: version, layout: '1v1', team, name, char: 0, skins: [], map: 'aster', loadout };
    const ws = new WebSocket(`${url}?o=${encodeURIComponent(JSON.stringify(opts))}`); sockets.push(ws);
    const client = { ws, id: '', snaps: [] as Snapshot[] };
    const timer = setTimeout(() => { ws.close(); reject(new Error('join timeout')); }, 10000);
    ws.onmessage = (e) => {
      const msg = JSON.parse(String(e.data));
      if (msg.t === 'welcome') {
        clearTimeout(timer);
        if (msg.d.rulesVersion !== RULES_VERSION) { ws.close(); reject(new Error('rules version mismatch')); return; }
        client.id = msg.d.id; resolve(client);
      } else if (msg.t === 'snap') client.snaps.push(msg.d);
      else if (msg.t === 'error') { clearTimeout(timer); ws.close(); reject(new Error(String(msg.d))); }
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket refused')); };
    ws.onclose = () => { clearTimeout(timer); if (!client.id) reject(new Error('closed before welcome')); };
  });
}
async function refused(choice: Loadout, version = RULES_VERSION) {
  let accepted = false;
  try { await join('auto', 'InvalidSmoke', choice, version); accepted = true; } catch { /* expected handshake refusal */ }
  if (accepted) throw new Error('server accepted invalid rules/loadout');
}
try {
  const choice: Loadout = ['firefly', 'longnight', 'hammer'];
  const a = await join('A', 'SmokeA', choice), b = await join('auto', 'SmokeB', ['halo', 'corona', 'polearm']);
  await wait(500);
  const first = a.snaps.at(-1)!;
  if (!first?.players.some((p) => p.id === b.id)) throw new Error('clients are not in the same room');
  let seq = 0;
  for (const slot of [0, 1, 2]) {
    a.ws.send(JSON.stringify({ t: 'input', d: [{ seq: ++seq, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: BTN.CROUCH, weapon: slot, view: 0 }] }));
    await wait(200);
    const p = b.snaps.at(-1)!.players.find((p) => p.id === a.id)!;
    if (!p.crouched || p.weaponSlot !== slot || p.weapon !== loadoutWeapon(choice, slot) || JSON.stringify(p.loadout) !== JSON.stringify(choice)) throw new Error('remote selected loadout/crouch snapshot mismatch');
  }
  a.ws.send(JSON.stringify({ t: 'input', d: Array.from({ length: 20 }, () => ({ seq: ++seq, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 2, view: 0 })) }));
  await wait(450); // let the normal 15-input equip recovery finish before starting the strike
  a.ws.send(JSON.stringify({ t: 'input', d: [{ seq: ++seq, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: BTN.FIRE, weapon: 2, view: 0 }] }));
  await wait(850); // hammer windup is 500ms; scheduled impact must occur with no extra packets
  const events = b.snaps.flatMap((s) => s.events);
  if (!events.some((e) => e.t === 'meleeStart' && e.id === a.id && e.w === 7) || !events.some((e) => e.t === 'meleeStrike' && e.id === a.id && e.w === 7)) throw new Error('authoritative melee telegraph/impact missing');
  const before = b.snaps.at(-1)!.players.find((p) => p.id === a.id)!;
  for (let batch = 0; batch < 6; batch++) {
    a.ws.send(JSON.stringify({ t: 'input', d: Array.from({ length: 10 }, () => ({ seq: ++seq, mx: 0, mz: 1, yaw: 0, pitch: 0, buttons: BTN.CROUCH, weapon: 0, view: 0 })) })); await wait(170);
  }
  await wait(250);
  const after = b.snaps.at(-1)!.players.find((p) => p.id === a.id)!;
  if (!after.crouched || Math.hypot(after.x - before.x, after.z - before.z) < .1) throw new Error('movement or crouch missing remotely');
  a.ws.close(); b.ws.close(); await wait(250);
  await refused(['lumen', 'lumen', 'blade']);
  await refused(['lumen', 'corona', 'admin'] as unknown as Loadout);
  await refused(['lumen', 'corona', 'blade'], 2);
  console.log('OK: v3 two-client slot/loadout/crouch/movement, scheduled melee, forged/duplicate/v2 rejection');
} finally { for (const ws of sockets) if (ws.readyState < WebSocket.CLOSING) ws.close(); }
