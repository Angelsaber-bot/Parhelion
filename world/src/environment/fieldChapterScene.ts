import * as THREE from 'three';
import type { Marker } from '../core/types';
import type { FieldChapterContent } from '../story/fieldChapters';
import { createSettlementNpcs } from '../settlements/npcs';
import { REGIONS } from '../map/regions';

type P = [number, number, number];
/** Standing points come from existing layout markers, then a short search for supported, clear ground. */
export function createFieldChapterScene(content: readonly FieldChapterContent[], anchor: (id: string) => readonly number[] | undefined,
  ground: (x: number, z: number, ceiling: number) => number | null, clear: (p: THREE.Vector3) => boolean,
  follow?: { anchors: readonly string[]; offset: () => { x: number; y: number; z: number } }) {
  const root = new THREE.Group(); root.name = 'RegionalFieldChapters';
  const markers: Marker[] = [], targets: THREE.Mesh[] = [], missing: string[] = [];
  const geo = new Set<THREE.BufferGeometry>(), mat = new Map<number, THREE.MeshStandardMaterial>();
  const points = new Map<string, P>(), riders = new Map<string, P>();
  const start = follow?.offset();
  let shipX = start?.x ?? 0, shipY = start?.y ?? 0, shipZ = start?.z ?? 0;
  for (const { set } of content) for (const a of set.actions) {
    const base = anchor(a.near);
    if (!base) { missing.push(`${a.id}<-${a.near}`); continue; }
    const [ox, oz] = a.off ?? [0, 0], by = base[1] - .9;
    let p: P | null = null;
    outer: for (const r of [0, 1.2, 2.4, 3.6, 5]) for (let i = 0; i < (r ? 12 : 1); i++) {
      const x = base[0] + ox + r * Math.cos(i * Math.PI / 6), z = base[2] + oz + r * Math.sin(i * Math.PI / 6), y = ground(x, z, by + 2.2);
      if (y !== null && Math.abs(y - by) < 3.5 && clear(new THREE.Vector3(x, y + .1, z))) { p = [x, y, z]; break outer; }
    }
    p ??= [base[0], by, base[2]];
    points.set(a.id, p);
    if (follow?.anchors.includes(a.near)) { const o = follow.offset(); riders.set(a.id, [p[0] - o.x, p[1] - o.y, p[2] - o.z]); }
    markers.push({ id: a.id, type: 'interact', label: `${a.chapter} · ${a.label[0]}`, p: [p[0], p[1] + .9, p[2]], radius: 2.8 });
  }
  function box(size: readonly number[], color: number) {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]); geo.add(g);
    let m = mat.get(color); if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: .82 }); mat.set(color, m); }
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
  }
  const props = content.flatMap(({ props: list }) => list.flatMap(prop => {
    const at = points.get(prop.at); if (!at) return [];
    const mesh = box(prop.size, prop.color); mesh.name = `FieldProp_${prop.at}`;
    if (prop.target) { mesh.userData.target = prop.target; targets.push(mesh); }
    return [{ prop, mesh }];
  }));
  const regionOf = (region: string) => REGIONS.find(r => r.id === region);
  const actors = createSettlementNpcs(content.flatMap(({ set, actors: list }) => list.map(actor => ({
    id: actor.id, role: actor.role, region: set.region, position: [0, -500, 0] as P, appearance: { coat: actor.coat }, lines: [],
  }))));
  root.add(actors.group);
  const watched = [...new Set(content.flatMap(({ set }) => set.actions.flatMap(a => [a.id, ...(a.adds ?? [])])).concat(['sea_core', 'winter_core', 'sun_core']))];
  let lastKey = '';
  const centres = content.map(({ set }) => { const r = regionOf(set.region); return r ? [r.offset[0], r.offset[1]] as const : [0, 0] as const; });
  return {
    root, markers, targets, missing,
    point: (id: string) => points.get(id),
    apply(d: ReadonlySet<string>) {
      const key = watched.map(f => d.has(f) ? '1' : '0').join('');
      if (key === lastKey) return;
      lastKey = key;
      for (const { prop, mesh } of props) {
        const at = points.get(prop.at)!;
        const moved = prop.moved && d.has(prop.moved.when) ? prop.moved : null, off = moved?.off ?? prop.off, rot = moved?.rot ?? prop.rot ?? [0, 0, 0];
        mesh.position.set(at[0] + off[0], at[1] + off[1], at[2] + off[2]); mesh.rotation.set(rot[0], rot[1], rot[2]);
        mesh.visible = prop.show ? prop.show(d) : true;
        if (prop.target) mesh.visible &&= !d.has(prop.target);
      }
      for (const { actors: list } of content) for (const actor of list) {
        const where = actor.place(d), at = where && points.get(where[0]);
        if (!at) { actors.pose(actor.id, [0, -500, 0], 0); continue; }
        const x = at[0] + where[1], z = at[2] + where[2], y = ground(x, z, at[1] + 2) ?? at[1];
        actors.pose(actor.id, [x, y, z], Math.atan2(at[0] - x, at[2] - z) || 0);
      }
    },
    update(dt: number, viewer: THREE.Vector3) {
      const o = follow?.offset();
      if (o && Math.hypot(o.x - shipX, o.y - shipY, o.z - shipZ) > .01) {
        shipX = o.x; shipY = o.y; shipZ = o.z;
        for (const [id, base] of riders) {
          const p: P = [base[0] + o.x, base[1] + o.y, base[2] + o.z]; points.set(id, p);
          const marker = markers.find(m => m.id === id); if (marker) marker.p = [p[0], p[1] + .9, p[2]];
        }
        lastKey = '';
      }
      root.visible = centres.some(([x, z]) => Math.max(Math.abs(viewer.x - x), Math.abs(viewer.z - z)) < 420);
      actors.update(dt, viewer);
    },
    dispose() { actors.dispose(); geo.forEach(g => g.dispose()); mat.forEach(m => m.dispose()); root.removeFromParent(); },
  };
}
