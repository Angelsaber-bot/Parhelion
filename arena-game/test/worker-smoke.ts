// Actual local/production Worker smoke. Intentionally opens temporary 1v1 clients, then leaves.
// npx tsx test/worker-smoke.ts wss://parhelion-arena.lejiazhang-us.workers.dev/arena
import { WebSocket } from 'ws';
import { RULES_VERSION, newRoomCode, type JoinOptions } from '../shared/protocol.ts';
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
class JoinRejected extends Error {}

function join(team: 'A' | 'auto', name: string, loadout: Loadout, version = RULES_VERSION, utility: UtilityId = 'frag', extra: Partial<JoinOptions> = {}) {
  return new Promise<{ ws: WebSocket; id: string; snaps: Snapshot[]; map: string }>((resolve, reject) => {
    const opts: JoinOptions = { rulesVersion: version, layout: '1v1', team, name, char: 0, skins: releaseSkins, map: 'aster', loadout, utility, ...extra };
    const endpoint = new URL(url);
    endpoint.searchParams.set('o', JSON.stringify(opts));
    const stage = `${name} (${opts.room ? 'private room' : 'quick match'}, ${opts.map})`;
    const ws = new WebSocket(endpoint); sockets.push(ws);
    const client = { ws, id: '', snaps: [] as Snapshot[], map: '' };
    let settled = false;
    const fail = (detail: string, rejected = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(rejected ? new JoinRejected(`${stage}: ${detail}`) : new Error(`${stage}: ${detail}`));
      if (ws.readyState < WebSocket.CLOSING) ws.terminate();
    };
    const timer = setTimeout(() => fail(`join timeout (socket state ${ws.readyState})`), 10000);
    ws.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (msg.t === 'welcome') {
        if (msg.d.rulesVersion !== RULES_VERSION) { fail('rules version mismatch'); return; }
        clearTimeout(timer);
        settled = true;
        client.id = msg.d.id; client.map = msg.d.map; resolve(client);
      } else if (msg.t === 'snap') client.snaps.push(msg.d);
      else if (msg.t === 'error') fail(String(msg.d), true);
    });
    ws.on('unexpected-response', (_request, response) => {
      const status = response.statusCode ?? 0;
      const ray = response.headers['cf-ray'];
      const prefix = `WebSocket upgrade returned HTTP ${status}${ray ? ` (Cloudflare Ray ${ray})` : ''}`;
      let preview = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { if (preview.length < 2048) preview += String(chunk).slice(0, 2048 - preview.length); });
      response.once('error', error => fail(`${prefix}: ${error.message}`));
      response.once('end', () => {
        const detail = /text\/html/i.test(response.headers['content-type'] ?? '')
          ? preview.match(/<title>([^<]+)<\/title>/i)?.[1] ?? preview.match(/error code:\s*\d+/i)?.[0]
          : preview.trim().replace(/\s+/g, ' ').slice(0, 240);
        fail(detail ? `${prefix}: ${detail}` : prefix, status === 400 || status === 426);
      });
    });
    ws.on('error', error => fail(`WebSocket error: ${error.message}`));
    ws.on('close', (code, reason) => fail(`closed before welcome (${code}${reason.length ? ` ${reason.toString()}` : ''})`));
  });
}
async function refused(choice: Loadout, version = RULES_VERSION, extra: Partial<JoinOptions> = {}) {
  try { await join('auto', 'InvalidSmoke', choice, version, 'frag', extra); }
  catch (error) {
    if (error instanceof JoinRejected) return;
    throw error;
  }
  throw new Error('server accepted invalid rules/loadout');
}
try {
  const choice: Loadout = ['firefly', 'longnight', 'hammer'];
  // A fresh private room: strangers' quick-match games can never land in it. The second player picked
  // another map and must still join the first player's room and map.
  const code = newRoomCode();
  const a = await join('A', 'SmokeA', choice, RULES_VERSION, 'frag', { room: code }), b = await join('auto', 'SmokeB', ['halo', 'corona', 'polearm'], RULES_VERSION, 'smoke', { room: code, map: 'sakura' });
  await wait(500);
  const first = a.snaps.at(-1)!;
  if (!first?.players.some((p) => p.id === b.id)) throw new Error(`private room ${code}: clients are not in the same room`);
  if (a.map !== 'aster' || b.map !== 'aster') throw new Error(`private room ${code}: the second player did not get the room's map (${b.map})`);
  for (const [snapshots, remoteId] of [[a.snaps, b.id], [b.snaps, a.id]] as const) {
    const remote = snapshots.at(-1)?.players.find(player => player.id === remoteId);
    if (!remote || JSON.stringify(remote.skins) !== JSON.stringify(releaseSkins)) throw new Error('new finish indices were lost or clamped in the remote snapshot');
  }
  let seq = 0;
  for (const slot of [0, 1, 2]) {
    a.ws.send(JSON.stringify({ t: 'input', d: [{ seq: ++seq, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: BTN.CROUCH, weapon: slot, view: 0 }] }));
    // Poll the other client's view instead of a fixed wait: edge latency varies between runs.
    const ok = (q: Snapshot['players'][number] | undefined) => !!q && q.crouched && q.weaponSlot === slot && q.weapon === loadoutWeapon(choice, slot);
    for (let t = 0; t < 30 && !ok(b.snaps.at(-1)!.players.find((p) => p.id === a.id)); t++) await wait(100);
    const p = b.snaps.at(-1)!.players.find((p) => p.id === a.id)!;
    if (!p.crouched || p.weaponSlot !== slot || p.weapon !== loadoutWeapon(choice, slot) || JSON.stringify(p.loadout) !== JSON.stringify(choice)) throw new Error('remote selected loadout/crouch snapshot mismatch');
  }
  a.ws.send(JSON.stringify({ t: 'input', d: Array.from({ length: 20 }, () => ({ seq: ++seq, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 2, view: 0 })) }));
  await wait(450); // let the normal 15-input equip recovery finish before starting the strike
  a.ws.send(JSON.stringify({ t: 'input', d: [{ seq: ++seq, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: BTN.FIRE, weapon: 2, view: 0 }] }));
  await wait(850); // hammer windup is 500ms; scheduled impact must occur with no extra packets
  const events = b.snaps.flatMap((s) => s.events);
  if (!events.some((e) => e.t === 'meleeStart' && e.id === a.id && e.w === 7) || !events.some((e) => e.t === 'meleeStrike' && e.id === a.id && e.w === 7)) throw new Error('authoritative melee telegraph/impact missing');
  // Going live respawns everyone: measure movement only after the countdown, or a late respawn reads as no movement.
  for (let t = 0; t < 60 && b.snaps.at(-1)!.phase !== 'live'; t++) await wait(100);
  await wait(250);
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
  // Quick match: two players asking for the same game meet in one room.
  const qa = await join('A', 'QuickA', choice, RULES_VERSION, 'frag', { layout: '2v2', map: 'frostcourt' }), qb = await join('auto', 'QuickB', choice, RULES_VERSION, 'frag', { layout: '2v2', map: 'frostcourt' });
  await wait(500);
  if (!qa.snaps.at(-1)?.players.some((p) => p.id === qb.id)) throw new Error('quick match: clients are not in the same room');
  qa.ws.close(); qb.ws.close(); await wait(250);
  await refused(['lumen', 'corona', 'blade'], RULES_VERSION, { room: 'ABCD0' });
  await refused(['lumen', 'lumen', 'blade']);
  await refused(['lumen', 'corona', 'admin'] as unknown as Loadout);
  await refused(['lumen', 'corona', 'blade'], 2);
  await refused(['lumen', 'corona', 'blade'], RULES_VERSION - 1);
  console.log(`OK: v${RULES_VERSION} private room (map from its first player), quick match, finish indices, two-client slot/loadout/crouch/movement, scheduled melee, grounded frag and smoke, forged/duplicate/old-version/bad-code rejection`);
} finally { for (const ws of sockets) if (ws.readyState < WebSocket.CLOSING) ws.close(); }
