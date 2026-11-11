// Actual local/production Worker smoke. Intentionally opens temporary 1v1 clients, then leaves.
// npx tsx test/worker-smoke.ts wss://parhelion-arena.lejiazhang-us.workers.dev/arena
import { RULES_VERSION, type JoinOptions } from '../shared/protocol.ts';
import { BTN } from '../shared/sim.ts';
import type { Snapshot } from '../shared/match.ts';
import { GRENADE, loadoutWeapon, WEAPONS, type Loadout, type UtilityId } from '../shared/content.ts';
import { ARENA_MAP } from '../shared/arenaMap.ts';
import { groundAt } from '../shared/map.ts';
const url = process.argv[2] ?? 'ws://127.0.0.1:8787/arena';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sockets: WebSocket[] = [];
// A compatible handshake alone does not prove the new cosmetic catalog reached
// production. Send real appended indices and inspect the other client's snapshot.
const releaseFinishes: Record<string, string> = {
  lumen: 'stormcoil', corona: 'bastion-breaker', halo: 'petal-scabbard',
  firefly: 'hummingbird', longnight: 'void-lance',
  blade: 'frost-fang', polearm: 'storm-halberd', hammer: 'amethyst-geode',
};
const releaseSkins = WEAPONS.map(weapon => {
  const id = releaseFinishes[weapon.id];
  if (!id) return 0;
  const index = weapon.skins.findIndex(skin => skin.id === id);
  if (index < 0) throw new Error(`release finish missing from catalog: ${id}`);
  return index;
});
function join(team: 'A' | 'auto', name: string, loadout: Loadout, version = RULES_VERSION, utility: UtilityId = 'frag') {
  return new Promise<{ ws: WebSocket; id: string; snaps: Snapshot[] }>((resolve, reject) => {
    const opts: JoinOptions = { rulesVersion: version, layout: '1v1', team, name, char: 0, skins: releaseSkins, map: 'aster', loadout, utility };
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
  const a = await join('A', 'SmokeA', choice), b = await join('auto', 'SmokeB', ['halo', 'corona', 'polearm'], RULES_VERSION, 'smoke');
  await wait(500);
  const first = a.snaps.at(-1)!;
  if (!first?.players.some((p) => p.id === b.id)) throw new Error('clients are not in the same room');
  for (const [snapshots, remoteId] of [[a.snaps, b.id], [b.snaps, a.id]] as const) {
    const remote = snapshots.at(-1)?.players.find(player => player.id === remoteId);
    if (!remote || JSON.stringify(remote.skins) !== JSON.stringify(releaseSkins)) throw new Error('new finish indices were lost or clamped in the remote snapshot');
  }
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
  // Both throws travel through the real room; peers must see flight and effects on supported ground.
  for (const [client, inputSeq] of [[a, ++seq], [b, 1]] as const) {
    client.ws.send(JSON.stringify({ t: 'input', d: [{ seq: inputSeq, mx: 0, mz: 0, yaw: 0, pitch: 1.45, buttons: BTN.THROW, weapon: 0, view: 0 }] }));
  }
  for (const [thrower, peer, kind, effect] of [[a, b, 'frag', 'blast'], [b, a, 'smoke', 'smoke']] as const) {
    const deadline = Date.now() + 7000;
    for (;;) {
      const events = peer.snaps.flatMap(s => s.events);
      const release = events.find(e => (e.t === 'blast' || e.t === 'smoke') && e.t === effect && e.owner === thrower.id);
      if (release && (release.t === 'blast' || release.t === 'smoke')) {
        const [x, y, z] = release.at;
        if (Math.abs(y - groundAt(ARENA_MAP, x, z, y, 0) - GRENADE.radius) > .005) throw new Error(`${kind} triggered without ground contact at ${release.at}`);
        if (!events.some(e => e.t === 'throw' && e.id === thrower.id && e.kind === kind)) throw new Error(`${kind} throw missing remotely`);
        if (!peer.snaps.some(s => s.grenades?.some(g => g.owner === thrower.id && g.kind === kind))) throw new Error(`${kind} flight missing remotely`);
        break;
      }
      if (Date.now() >= deadline) throw new Error(`grounded ${kind} effect missing remotely`);
      await wait(100);
    }
  }
  a.ws.close(); b.ws.close(); await wait(250);
  await refused(['lumen', 'lumen', 'blade']);
  await refused(['lumen', 'corona', 'admin'] as unknown as Loadout);
  await refused(['lumen', 'corona', 'blade'], 2);
  await refused(['lumen', 'corona', 'blade'], RULES_VERSION - 1);
  console.log(`OK: v${RULES_VERSION} finish indices, two-client slot/loadout/crouch/movement, scheduled melee, grounded frag and smoke, forged/duplicate/old-version rejection`);
} finally { for (const ws of sockets) if (ws.readyState < WebSocket.CLOSING) ws.close(); }
