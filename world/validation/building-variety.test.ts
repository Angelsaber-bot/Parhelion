// Re-measures visually identical buildings (same visible triangles, area and colour mix inside a hull)
// after src/map/buildingVariety.ts is applied, exactly as tools/building-variety.ts measured them before.
import * as THREE from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';
import { applyBuildingVariety } from '../src/map/buildingVariety';
import test from 'node:test';
import assert from 'node:assert/strict';
const shares: Record<string, number> = {};
const result: Record<string, { box: number[]; group: string; size: number }[]> = {};
for (const region of ['alpha', 'britain', 'blacksail', 'winter', 'kyoto', 'egypt', 'orleans', 'qin', 'home']) {
  let bytes: Buffer; try { bytes = readFileSync(`public/assets/world_${region}.glb`); } catch { continue; }
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(gltf.scene); gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o: any) => { if (!o.isMesh) return; const v = applyBuildingVariety(region, o.name, o.geometry); if (v) o.geometry = v; });
  // 1. building hulls from COL_Props components
  const hulls: number[][] = [];
  gltf.scene.traverse((o: any) => {
    if (!o.isMesh || o.name !== 'COL_Props') return;
    const g = o.geometry, pos = g.attributes.position, n = pos.count, idx = g.index, count = idx ? idx.count : n, at = (i: number) => idx ? idx.getX(i) : i;
    const parent = new Int32Array(n); for (let i = 0; i < n; i++) parent[i] = i; const root = (i: number) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const weld = new Map<string, number>(), v = new THREE.Vector3(), world = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); world.set([v.x, v.y, v.z], i * 3); const k = `${Math.round(v.x * 20)},${Math.round(v.y * 20)},${Math.round(v.z * 20)}`; const q = weld.get(k); if (q === undefined) weld.set(k, i); else parent[root(i)] = root(q); }
    for (let i = 0; i < count; i += 3) { parent[root(at(i))] = root(at(i + 1)); parent[root(at(i + 2))] = root(at(i + 1)); }
    const box = new Map<number, number[]>();
    for (let i = 0; i < n; i++) { const r = root(i), x = world[i * 3], y = world[i * 3 + 1], z = world[i * 3 + 2], b = box.get(r); if (!b) box.set(r, [x, y, z, x, y, z]); else { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.min(b[2], z); b[3] = Math.max(b[3], x); b[4] = Math.max(b[4], y); b[5] = Math.max(b[5], z); } }
    for (const b of box.values()) { const sx = b[3] - b[0], sy = b[4] - b[1], sz = b[5] - b[2]; if (sx * sz >= 20 && sy >= 2.5 && sx <= 40 && sz <= 40) hulls.push(b); }
  });
  // 2. visible triangles inside each hull: count, rounded area and colour mix
  const acc = hulls.map(() => ({ tris: 0, area: 0, col: new Map<string, number>() }));
  const cell = 8, grid = new Map<string, number[]>(); hulls.forEach((b, i) => { for (let x = Math.floor((b[0] - 1) / cell); x <= Math.floor((b[3] + 1) / cell); x++) for (let z = Math.floor((b[2] - 1) / cell); z <= Math.floor((b[5] + 1) / cell); z++) { const k = `${x},${z}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); } });
  const a = new THREE.Vector3(), b2 = new THREE.Vector3(), c2 = new THREE.Vector3(), tri = new THREE.Triangle();
  gltf.scene.traverse((o: any) => {
    if (!o.isMesh || /^(Terrain|Water|COL_|Trees|Bushes|Rocks|Grass)/.test(o.name)) return;
    let p = o.parent, art = false; while (p) { if (p.name === 'ART') art = true; p = p.parent; } if (!art) return;
    const g = o.geometry, pos = g.attributes.position, col = g.attributes.color, idx = g.index, count = idx ? idx.count : pos.count, at = (i: number) => idx ? idx.getX(i) : i;
    for (let i = 0; i < count; i += 3) {
      a.fromBufferAttribute(pos, at(i)).applyMatrix4(o.matrixWorld); b2.fromBufferAttribute(pos, at(i + 1)).applyMatrix4(o.matrixWorld); c2.fromBufferAttribute(pos, at(i + 2)).applyMatrix4(o.matrixWorld);
      const cx = (a.x + b2.x + c2.x) / 3, cy = (a.y + b2.y + c2.y) / 3, cz = (a.z + b2.z + c2.z) / 3;
      for (const h of grid.get(`${Math.floor(cx / cell)},${Math.floor(cz / cell)}`) ?? []) { const bb = hulls[h]; if (cx < bb[0] - .8 || cx > bb[3] + .8 || cz < bb[2] - .8 || cz > bb[5] + .8 || cy < bb[1] - .5 || cy > bb[4] + 3) continue;
        const s = acc[h]; s.tris++; s.area += tri.set(a, b2, c2).getArea();
        if (col) { const k = `${o.name}:${Math.round(col.getX(at(i)) * 8)},${Math.round(col.getY(at(i)) * 8)},${Math.round(col.getZ(at(i)) * 8)}`; s.col.set(k, (s.col.get(k) ?? 0) + 1); } break; }
    }
  });
  const groups = new Map<string, number[]>();
  acc.forEach((s, i) => { if (s.tris < 20) return; const colours = [...s.col].sort().map(([k, n]) => `${k}=${n}`).join(';'); const key = `${s.tris}|${Math.round(s.area)}|${colours}`; (groups.get(key) ?? groups.set(key, []).get(key)!).push(i); });
  const repeated = [...groups.values()].filter(l => l.length > 1).sort((x, y) => y.length - x.length);
  const inRepeat = repeated.reduce((t, l) => t + l.length, 0), counted = [...groups.values()].reduce((t, l) => t + l.length, 0);
  shares[region] = inRepeat / Math.max(1, counted);
  void (`I ${region}: buildings ${counted}, visually identical to another ${inRepeat} (${(100 * inRepeat / Math.max(1, counted)).toFixed(0)}%), groups ${repeated.length}, largest ${repeated.slice(0, 5).map(l => l.length).join(',')}`);
  result[region] = repeated.flatMap((l, gi) => l.map(h => ({ box: hulls[h].map(v => Math.round(v * 100) / 100), group: `${region}_${gi}`, size: l.length })));
}

test('repeated buildings get their own look: under 3% visually identical in every region', () => {
  for (const [region, share] of Object.entries(shares)) assert.ok(share < .03, `${region}: ${(share * 100).toFixed(1)}% identical`);
});
