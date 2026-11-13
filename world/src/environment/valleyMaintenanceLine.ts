import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider, Player } from '../player/player';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { landscapeWalkway } from './landscapeWalkway';
import { JOURNEY } from '../story/worldJourney';

type Point = [number, number, number];
export const VALLEY_LINE = { outpost: 'map_valley_line_outpost', observatory: 'map_valley_line_observatory', cabin: 'map_valley_line_cabin', restored: 'map_valley_line_restored' } as const;
export const VALLEY_LINE_PATH: Point[] = [[-140, 8.25, -6], [-140, 45, 35], [-118, 45, 204], [-118, 10.25, 247]];
export const valleyLineAvailable = (done: ReadonlySet<string>) => done.has(VALLEY_LINE.restored) || done.has(JOURNEY.compare)
  || ['sun_core', 'winter_core', 'sea_core', 'fire_core', 'egypt_core', 'qin_core', 'orleans_core'].filter(id => done.has(id)).length >= 2;

/** The late valley shortcut is a cable-supported maintenance carrier, with two
 * real landings and one continuous route above the existing civil road. */
export function createValleyMaintenanceLine() {
  const root = new THREE.Group(); root.name = 'ValleyMaintenanceLine';
  const steel = '#526570', brass = '#b29b6c', wood = '#8b7a60';
  const arts: SiteArt[] = [], colliders: Collider[] = [];
  function finish(a: SiteArt, name: string) {
    a.finish('alpha'); a.root.name = name; root.add(a.root); arts.push(a);
    if (!a.solids.length) return null;
    const geometry = mergeParts(a.solids); a.solids.forEach(g => g.dispose()); a.solids.length = 0;
    const collider: Collider = { name, bvh: new MeshBVH(geometry), enabled: true }; colliders.push(collider); return collider;
  }
  const frame = new SiteArt(), ends = [VALLEY_LINE_PATH[0], VALLEY_LINE_PATH.at(-1)!];
  const approaches = ends.map(([x, y, z]) => [[x, y, z - 8], [x, y, z - 2.2]] as Point[]);
  for (const [i, [x, y, z]] of ends.entries()) {
    landscapeWalkway(frame, approaches[i], { width: 5.8, floor: wood, edge: steel, rails: true });
    for (const dx of [-3.4, 3.4]) {
      frame.box([x + dx, y + 2.3, z], [.3, 5, .3], steel, true);
      frame.beam([x + dx, y + 4.65, z], [x, y + 5.3, z], .25, steel);
    }
    frame.box([x - 2.1, y + .6, z - 5], [.4, 1.2, .45], steel, true);
    frame.ring([x - 2.1, y + 1.3, z - 5], .28, .06, brass);
    frame.box([x, y + 4.4, z], [4, .6, .14], wood);
    frame.box([x - .8, y + 4.4, z - .09], [1.4, .26, .025], '#d8d5bd');
    frame.box([x + 1.1, y + 4.4, z - .09], [.5, .26, .025], '#7da5a3');
  }
  for (let i = 1; i < VALLEY_LINE_PATH.length; i++) for (const dx of [-2, 2]) {
    const a = VALLEY_LINE_PATH[i - 1], b = VALLEY_LINE_PATH[i];
    frame.beam([a[0] + dx, a[1] + 4.2, a[2]], [b[0] + dx, b[1] + 4.2, b[2]], .065, steel);
  }
  // Tall pylons stand outside the travel envelope, leaving the old path below.
  for (const [x, y, z] of VALLEY_LINE_PATH.slice(1, -1)) {
    for (const dx of [-4.2, 4.2]) {
      frame.box([x + dx, y / 2, z], [.5, y + 1, .5], steel, true);
      for (let h = 4; h < y - 8; h += 8) frame.beam([x + dx, h, z], [x - dx, h + 7, z], .12, steel);
    }
    frame.box([x, y + 5, z], [9, .35, .4], steel, true);
  }
  finish(frame, 'COL_ValleyMaintenanceLineStations');
  const cabin = new SiteArt();
  cabin.box([0, -.16, 0], [6, .32, 5], steel, true);
  for (const h of [.5, 1.05]) {
    for (const x of [-2.85, 2.85]) cabin.box([x, h, 0], [.14, .14, 4.8], brass, true);
    cabin.box([0, h, 2.35], [5.8, .14, .14], brass, true);
  }
  for (const x of [-2.6, 2.6]) for (const z of [-2.1, 2.1]) cabin.box([x, 2, z], [.1, 4, .1], steel, true);
  cabin.box([0, 3.55, 0], [5.8, .12, 4.7], '#718b8a', true);
  cabin.box([1.6, .55, 1.45], [.45, 1.1, .45], wood, true);
  cabin.ring([1.6, 1.17, 1.45], .25, .05, brass);
  const car = finish(cabin, 'COL_ValleyMaintenanceCarrier')!;
  const door = new SiteArt(); door.box([0, .65, -2.35], [5.7, 1.3, .12], brass, true);
  const doorCollider = finish(door, 'COL_ValleyMaintenanceCarrierDoor')!;
  const moving = [car, doorCollider].map(c => ({ c, attr: c.bvh.geometry.getAttribute('position') as THREE.BufferAttribute, base: Float32Array.from(c.bvh.geometry.getAttribute('position').array) }));
  const gates = ends.map(([x, y, z], i) => {
    const a = new SiteArt(); a.box([x, y + .65, z - 2.5], [5.8, 1.3, .12], brass, true);
    return { art: a, collider: finish(a, `COL_ValleyMaintenanceLanding_${i}`)! };
  });
  const markers: Marker[] = ends.map(([x, y, z], i) => ({ id: i ? VALLEY_LINE.observatory : VALLEY_LINE.outpost, type: 'interact', label: i ? '观测所维护线 · 呼车' : '旧前哨维护线 · 恢复或呼车', p: [x - 2.1, y + 1.35, z - 5], radius: 2.2 }));
  markers.push({ id: VALLEY_LINE.cabin, type: 'interact', label: '维护线轿厢 · 前往另一站', p: [0, 0, 0], radius: 2.2 });
  let segment = 0, destination = 0, currentEnd = 0, travelling = false, unlocked = false;
  const position = new THREE.Vector3(...ends[0]);
  function sync() {
    cabin.root.position.copy(position); door.root.position.copy(position);
    for (const { c, attr, base } of moving) {
      for (let i = 0; i < attr.count; i++) attr.setXYZ(i, base[i * 3] + position.x, base[i * 3 + 1] + position.y, base[i * 3 + 2] + position.z);
      attr.needsUpdate = true; c.bvh.geometry.computeBoundingBox(); c.bvh.geometry.computeBoundingSphere(); c.bvh.refit();
    }
    door.root.visible = doorCollider.enabled = travelling;
    gates.forEach((gate, i) => gate.art.root.visible = gate.collider.enabled = travelling || currentEnd !== i);
    markers[2].p = [position.x + 1.6, position.y + 1.3, position.z + 1.45];
    root.updateMatrixWorld(true);
  }
  sync();
  return { root, colliders, markers, approaches,
    get moving() { return travelling; }, get position() { return position.clone(); },
    apply(done: ReadonlySet<string>) { unlocked = done.has(VALLEY_LINE.restored); },
    operate(id: string) {
      if (!unlocked || travelling) return false;
      destination = id === VALLEY_LINE.outpost ? 0 : id === VALLEY_LINE.observatory ? 1 : 1 - currentEnd;
      if (destination === currentEnd) return true;
      segment = destination ? 1 : VALLEY_LINE_PATH.length - 2; travelling = true; sync(); return true;
    },
    update(dt: number, player: Pick<Player, 'pos' | 'vel' | 'onGround' | 'flying' | 'swimming'>) {
      if (!travelling || dt <= 0) return;
      const aboard = !player.flying && !player.swimming && player.onGround && Math.abs(player.pos.x - position.x) < 2.85 && Math.abs(player.pos.z - position.z) < 2.35 && Math.abs(player.pos.y - position.y) < .18;
      const delta = new THREE.Vector3(...VALLEY_LINE_PATH[segment]).sub(position), distance = delta.length();
      const step = Math.min(distance, Math.min(dt, .05) * 8), motion = delta.multiplyScalar(step / Math.max(distance, .0001));
      // Stop before the carrier descends onto a person waiting beneath it.
      if (!aboard && motion.y < 0 && Math.abs(player.pos.x - position.x) < 3.4 && Math.abs(player.pos.z - position.z) < 2.9 && player.pos.y < position.y && player.pos.y + 2.2 > position.y + motion.y) return;
      position.add(motion);
      if (aboard) { player.pos.add(motion); player.vel.y = 0; player.onGround = true; }
      if (step === distance) { if (segment === (destination ? VALLEY_LINE_PATH.length - 1 : 0)) { travelling = false; currentEnd = destination; } else segment += destination ? 1 : -1; }
      sync();
    },
    dispose() { colliders.forEach(c => { c.enabled = false; c.bvh.geometry.dispose(); }); arts.forEach(a => { a.layers.forEach(m => m.geometry.dispose()); Object.values(a.materials).forEach(m => m.dispose()); }); root.removeFromParent(); },
  };
}
