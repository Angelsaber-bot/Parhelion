import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider, Player } from '../player/player';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { landscapeWalkway } from './landscapeWalkway';

export const SKY_LIFT = {
  upper: 'journey_sky_lift_upper', lower: 'journey_sky_lift_lower',
  cabin: 'journey_sky_lift_cabin',
} as const;
export const SKY_LIFT_FLOORS = [156, 208] as const;
export const SKY_LIFT_CENTER = [263, 244] as const;
export const SKY_LIFT_LOWER_ROUTE: [number, number, number][] = [[157, 156, 216], [181, 156, 231], [236, 156, 253], [263, 156, 253], [263, 156, 246.9]];
export const SKY_LIFT_UPPER_ROUTE: [number, number, number][] = [[265.9, 208, 244], [274, 208, 244]];

/** The J–C service connection is a traversable 52 m hoist. Calling it never
 * moves the player: only a grounded passenger on the moving floor is carried. */
export function createSkyServiceLift() {
  const root = new THREE.Group(); root.name = 'SkyServiceLift';
  const arts: SiteArt[] = [], colliders: Collider[] = [];
  const [x, z] = SKY_LIFT_CENTER, [low, high] = SKY_LIFT_FLOORS;
  const steel = '#344d60', brass = '#b5a075', pale = '#c0c9c4';
  function finish(a: SiteArt, name: string) {
    const geo = mergeParts(a.solids); a.solids.forEach(g => g.dispose()); a.solids.length = 0;
    const collider: Collider = { name, bvh: new MeshBVH(geo), enabled: true };
    a.finish('alpha'); a.root.name = name; root.add(a.root); arts.push(a); colliders.push(collider);
    return collider;
  }
  const frame = new SiteArt();
  for (const points of [SKY_LIFT_LOWER_ROUTE, SKY_LIFT_UPPER_ROUTE]) landscapeWalkway(frame, points,
    { width: 4.7, floor: steel, edge: brass, rails: true, continuousCorners: true,
      railOpenings: points.map(p => ({ p, radius: 3 })) });
  for (const dx of [-3.15, 3.15]) for (const dz of [-3.15, 3.15]) {
    frame.box([x + dx, (low + high) / 2 + 1.5, z + dz], [.24, high - low + 4.5, .24], steel, true);
    for (let y = low + 7; y < high; y += 9) frame.box([x + dx, y, z + dz], [.5, .35, .5], brass);
  }
  frame.box([x, high + 3.8, z], [6.8, .4, 6.8], steel, true);
  for (const y of [low, high]) {
    frame.ring([x, y + 2.6, z - 3.2], .53, .08, brass);
    frame.box([x, y + 2.6, z - 3.25], [1.8, .9, .12], pale);
  }
  for (const [xx, y, zz] of [[x - 1.5, low, z + 4.5], [x + 4.5, high, z + 1.5]]) {
    frame.box([xx, y + .6, zz], [.45, 1.2, .45], steel, true);
    frame.ring([xx, y + 1.27, zz], .24, .06, brass);
  }
  finish(frame, 'COL_SkyLiftTower');
  const car = new SiteArt();
  car.box([x, low - .15, z], [6, .3, 6], steel, true);
  // North and west walls remain solid; east and south doors meet their landings.
  for (const h of [.5, 1.08]) {
    car.box([x - 2.9, low + h, z], [.12, .12, 5.8], brass, true);
    car.box([x, low + h, z - 2.9], [5.8, .12, .12], brass, true);
  }
  car.box([x - 2.25, low + .6, z - 1.8], [.4, 1.2, .4], pale, true);
  car.ring([x - 2.25, low + 1.27, z - 1.8], .25, .06, brass);
  const cabin = finish(car, 'COL_SkyLiftCabin');
  const pos = cabin.bvh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const base = Float32Array.from(pos.array);
  const gates = [
    { floor: low, p: [x, low + .65, z + 3] as [number, number, number], size: [6, 1.3, .16] as [number, number, number] },
    { floor: high, p: [x + 3, high + .65, z] as [number, number, number], size: [.16, 1.3, 6] as [number, number, number] },
  ].map(g => { const art = new SiteArt(); art.box(g.p, g.size, brass, true); return { ...g, art, collider: finish(art, 'COL_SkyLiftLandingGate') }; });
  const doors = [
    { floor: low, p: [x, low + .65, z + 2.87] as [number, number, number], size: [5.7, 1.3, .12] as [number, number, number] },
    { floor: high, p: [x + 2.87, low + .65, z] as [number, number, number], size: [.12, 1.3, 5.7] as [number, number, number] },
  ].map(g => {
    const art = new SiteArt(); art.box(g.p, g.size, brass, true);
    const collider = finish(art, 'COL_SkyLiftCabinDoor');
    const attr = collider.bvh.geometry.getAttribute('position') as THREE.BufferAttribute;
    return { ...g, art, collider, attr, base: Float32Array.from(attr.array) };
  });
  const markers: Marker[] = [
    { id: SKY_LIFT.lower, p: [x - .6, low + 1, z + 4.5], type: 'interact', radius: 2.2, label: '观测厅维修升降机 · 呼叫下层' },
    { id: SKY_LIFT.upper, p: [x + 4.5, high + 1, z + .6], type: 'interact', radius: 2.2, label: '晴空庭维修升降机 · 呼叫上层' },
    { id: SKY_LIFT.cabin, p: [x - 1.35, low + 1, z - 1.8], type: 'interact', radius: 2.2, label: '维修升降机 · 前往另一层' },
  ];
  let y: number = low, target: number = low, unlocked = false;
  const moving = () => Math.abs(y - target) > .001;
  function sync() {
    const dy = y - low;
    car.root.position.y = dy;
    for (let i = 0; i < pos.count; i++) pos.setY(i, base[i * 3 + 1] + dy);
    pos.needsUpdate = true; cabin.bvh.refit();
    markers[2].p[1] = y + 1;
    for (const door of doors) {
      door.art.root.position.y = dy;
      for (let i = 0; i < door.attr.count; i++) door.attr.setY(i, door.base[i * 3 + 1] + dy);
      door.attr.needsUpdate = true; door.collider.bvh.refit();
      door.art.root.visible = door.collider.enabled = moving() || y !== door.floor;
    }
    for (const gate of gates) gate.art.root.visible = gate.collider.enabled = moving() || y !== gate.floor;
    root.updateMatrixWorld(true);
  }
  sync();
  return { root, markers, colliders,
    get height() { return y; }, get moving() { return moving(); },
    unlock(value: boolean) { unlocked = value; },
    operate(id: string) {
      if (!unlocked || moving()) return false;
      target = id === SKY_LIFT.upper ? high : id === SKY_LIFT.lower ? low : y === low ? high : low;
      sync(); return true;
    },
    update(dt: number, player: Pick<Player, 'pos' | 'vel' | 'onGround' | 'flying' | 'swimming' | 'gliding'>) {
      if (dt <= 0 || !moving()) return;
      const inside = Math.abs(player.pos.x - x) < 2.8 && Math.abs(player.pos.z - z) < 2.8;
      const aboard = inside && !player.flying && !player.swimming && !player.gliding && player.vel.y <= .5 && Math.abs(player.pos.y - y) < .18;
      if (target < y && inside && player.pos.y < y - .18 && player.pos.y + 2 > y - .4) return;
      const before = y;
      y += Math.sign(target - y) * Math.min(Math.abs(target - y), Math.min(dt, .05) * 4);
      if (Math.abs(y - target) < .001) y = target;
      if (aboard) { player.pos.y += y - before; player.vel.y = 0; player.onGround = true; }
      sync();
    },
    dispose() {
      colliders.forEach(c => { c.enabled = false; c.bvh.geometry.dispose(); });
      for (const art of arts) { art.layers.forEach(m => m.geometry.dispose()); Object.values(art.materials).forEach(m => m.dispose()); }
      root.removeFromParent();
    },
  };
}
