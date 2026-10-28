// Dev scan for movement traps. Drops a player onto a grid of points (from just above
// the highest surface there), lets it settle, then tries to walk and jump out in
// 8 directions. A spot where nothing gets it 0.6 m away in 3 s is a trap. Only spots a
// player can get into count: a reachable nav node (flood-filled from a spawn) within
// 2.5 m that is not lower than the spot. Bank tops and wall crowns are skipped.
// Usage: STEP=0.5 npx tsx test/stuck-scan.ts [mapId...]
import { getMap, MAPS } from '../shared/arenaMap.ts';
import { groundAt } from '../shared/map.ts';
import { NavGrid } from '../shared/nav.ts';
import { applyInput, BTN, newPlayer, type PlayerState } from '../shared/sim.ts';

export function findTraps(id: string, step = 1): number[][] {
  const m = getMap(id); const { min, max } = m.data.bounds; const traps: number[][] = [];
  const nav = new NavGrid(m), spawn = m.data.anchors.find((a) => a.kind === 'spawn')!;
  const start = nav.nearest(spawn.position[0], spawn.position[1], spawn.position[2])!;
  const seen = new Set([start.id]), queue = [start.id];
  while (queue.length) for (const nb of nav.nodes[queue.pop()!].links) if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
  const reach = [...seen].map((i) => nav.nodes[i]);
  const reachable = (x: number, y: number, z: number) => reach.some((n) => Math.abs(n.x - x) < 2.5 && Math.abs(n.z - z) < 2.5 && n.y > y - .3);
  const idle = { mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 0, view: 0 };
  for (let x = min[0] + step / 2; x < max[0]; x += step) for (let z = min[2] + step / 2; z < max[2]; z += step) {
    const p = newPlayer('s', 'A', 1);
    Object.assign(p, { x, z, y: Math.max(0, groundAt(m, x, z, 30)) + 1, alive: true });
    for (let seq = 1; seq <= 40; seq++) applyInput(m, p, { ...idle, seq });
    const sx = p.x, sz = p.z;
    let best = 0;
    for (let k = 0; k < 8 && best < .6; k++) for (const jump of [false, true]) {
      const q: PlayerState = structuredClone(p);
      for (let seq = 41; seq <= 220 && best < .6; seq++) {
        applyInput(m, q, { ...idle, seq, mz: 1, yaw: k * Math.PI / 4, buttons: jump && seq % 30 === 1 ? BTN.JUMP : 0 });
        best = Math.max(best, Math.hypot(q.x - sx, q.z - sz));
      }
    }
    if (best < .6 && reachable(sx, p.y, sz)) traps.push([Number(sx.toFixed(2)), Number(p.y.toFixed(2)), Number(sz.toFixed(2))]);
  }
  return traps;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : MAPS.map((m) => m.id);
  for (const id of ids) { const t = findTraps(id, Number(process.env.STEP ?? 1)); console.log(id, 'traps', t.length, JSON.stringify(t.slice(0, 20))); }
}
