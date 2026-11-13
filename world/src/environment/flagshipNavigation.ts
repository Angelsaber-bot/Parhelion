import * as THREE from 'three';
import type { Collider, Player } from '../player/player';
import type { Marker } from '../core/types';
import { MeshBVH } from 'three-mesh-bvh';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { flagshipPoint as P, SHIP_INTERIOR } from '../map/shipInteriorCut';
import { FLAGSHIP_WORKS as F, flagshipBridgeLowered } from '../story/flagshipWorks';
import { ghostBridgeOpen } from '../story/eraStories';
import { landscapeWalkway } from './landscapeWalkway';

type Point = [number, number, number];
export const FLAGSHIP_NAV = {
  inner: 'map_flagship_inner_lane', outer: 'map_flagship_outer_lane',
  stop: 'map_flagship_brake', recall: 'map_flagship_recall',
  innerComplete: 'map_flagship_inner_complete', outerComplete: 'map_flagship_outer_complete',
  shared: 'map_flagship_shared_pilot', fixed: 'map_flagship_fixed_harbor',
} as const;
export type FlagshipLane = 'inner' | 'outer';
// Translation paths in the sheltered bay; neither path crosses the reef island
// or the adjacent world tile. The return follows the same surveyed channel.
export const FLAGSHIP_LANES: Record<FlagshipLane, Point[]> = {
  inner: [[0, 0, 0], [20, 0, 27], [15, 0, 86], [-1, 0, 142]],
  outer: [[0, 0, 0], [39, 0, 27], [43, 0, 100], [30, 0, 158], [-1, 0, 142]],
};
export const FLAGSHIP_MAINTENANCE: Point[] = [[8, -13, 14], [8, -9, 14], [-10, -9, 9.5], [-10, -6, 8.7], [-10, -3.75, 7], [-10, -2.5, 7]];

/** One vessel owns all three floors, original hull collision, deck dressing and
 * interaction points. Hoisting and sailing never substitute a second ship. */
export function createFlagshipNavigation(host: {
  world: THREE.Group; art: THREE.Object3D[]; colliders: Collider[];
  points: number[][]; done: ReadonlySet<string>;
  link?: { art?: THREE.Object3D; collider?: Collider };
  commit(flag: string): boolean;
}) {
  const root = new THREE.Group(); root.name = 'FlagshipNavigation'; host.world.add(root);
  const vessel = new THREE.Group(); vessel.name = 'FlagshipMovingVessel'; root.add(vessel);
  host.world.updateMatrixWorld(true);
  for (const node of host.art) vessel.attach(node);
  const owned = host.colliders.map(c => ({ collider: c, geometry: c.bvh.geometry,
    attr: c.bvh.geometry.getAttribute('position') as THREE.BufferAttribute,
    base: Float32Array.from(c.bvh.geometry.getAttribute('position').array) }));
  const points = host.points.map(point => ({ point, base: [...point] }));
  const resources: SiteArt[] = [], colliders: Collider[] = [];
  const timber = '#8d7150', dark = '#4b4337', rope = '#b6a17a';
  const rot: Point = [0, SHIP_INTERIOR.yaw, 0];
  function finish(a: SiteArt, name: string) {
    a.finish('blacksail'); a.root.name = name; root.add(a.root); resources.push(a);
    if (!a.solids.length) return null;
    const geometry = mergeParts(a.solids); a.solids.forEach(g => g.dispose()); a.solids.length = 0;
    const c: Collider = { name, bvh: new MeshBVH(geometry), enabled: true }; colliders.push(c); return c;
  }
  const gangway = new SiteArt();
  landscapeWalkway(gangway, FLAGSHIP_MAINTENANCE.map(p => P(...p)), { width: 2.55, floor: timber, edge: rope, steps: true, rails: true,
    continuousCorners: true, railOpenings: FLAGSHIP_MAINTENANCE.slice(1, -1).map(p => ({ p: P(...p), radius: 2 })) });
  const gangCollider = finish(gangway, 'COL_FlagshipArticulatedGangway')!;
  const gangGeometries = [gangCollider.bvh.geometry, ...[...gangway.layers.values()].map(m => m.geometry)].map(geometry => ({
    geometry, attr: geometry.getAttribute('position') as THREE.BufferAttribute,
    base: Float32Array.from(geometry.getAttribute('position').array),
  }));
  const shoreGate = new SiteArt();
  for (const y of [14.55, 15.05]) shoreGate.beam(P(6.8, -13, y), P(9.2, -13, y), .15, '#b49359', true);
  const shoreCollider = finish(shoreGate, 'COL_FlagshipGangwaySafety')!;
  const fleetGate = new SiteArt();
  // The last ghost bridge closes at the preceding ship, before its open edge.
  for (const y of [7.05, 7.55]) fleetGate.beam([1026.7, y, -650.4], [1029.8, y, -649.45], .15, '#b49359', true);
  const fleetGateCollider = finish(fleetGate, 'COL_FlagshipFleetSafety')!;
  const boatGate = new SiteArt();
  for (const y of [7.55, 8.05]) boatGate.beam(P(-10, -5, y), P(-10, -2.5, y), .15, '#b49359', true);
  const boatCollider = finish(boatGate, 'COL_FlagshipGangwayShipSafety')!;
  vessel.attach(boatGate.root);
  owned.push({ collider: boatCollider, geometry: boatCollider.bvh.geometry, attr: boatCollider.bvh.geometry.getAttribute('position') as THREE.BufferAttribute, base: Float32Array.from(boatCollider.bvh.geometry.getAttribute('position').array) });
  const helm = new SiteArt();
  helm.box(P(12, -2, 7.7), [.45, 1.4, .5], dark, true, 'body', rot);
  helm.ring(P(12, -2, 8.25), .58, .07, timber, 'body', [0, SHIP_INTERIOR.yaw, Math.PI / 2]);
  for (let n = 0; n < 8; n++) { const a = n * Math.PI / 4; helm.beam(P(12, -2, 8.25), P(12, -2 + Math.cos(a) * .7, 8.25 + Math.sin(a) * .7), .045, dark); }
  const helmCollider = finish(helm, 'COL_FlagshipWheel')!; vessel.attach(helm.root);
  owned.push({ collider: helmCollider, geometry: helmCollider.bvh.geometry, attr: helmCollider.bvh.geometry.getAttribute('position') as THREE.BufferAttribute, base: Float32Array.from(helmCollider.bvh.geometry.getAttribute('position').array) });
  const labels = [
    [FLAGSHIP_NAV.inner, '轮舵左侧 · 沿礁口内线巡航', P(10.3, -2, 8)],
    [FLAGSHIP_NAV.outer, '轮舵右侧 · 沿外侧桅道巡航', P(12, .1, 8)],
    [FLAGSHIP_NAV.stop, '轮舵制动 · 停航或继续', P(10.2, .4, 8)],
    [FLAGSHIP_NAV.recall, '吊装台 · 召回无人旗舰', P(5.4, -16.1, 15)],
    [FLAGSHIP_NAV.shared, '公开班次台 · 保留共同领航船', P(3, -16, 15)],
    [FLAGSHIP_NAV.fixed, '公开班次台 · 改为固定渡港', P(1.4, -16, 15)],
  ] as const;
  const markers: Marker[] = labels.map(([id, label, p]) => ({ id, label, p: [...p], type: 'interact', radius: 1.35 }));
  for (const marker of markers.slice(0, 3)) points.push({ point: marker.p, base: [...marker.p] });
  const buoys = new SiteArt();
  for (const [lane, path] of Object.entries(FLAGSHIP_LANES)) for (const delta of path.slice(1)) {
    const x = 1016 + delta[0], z = -616 + delta[2], side = lane === 'inner' ? -10 : 10;
    buoys.cyl([x + side, 1.25, z], .8, .5, dark);
    buoys.cyl([x + side, 2.5, z], .09, 2.3, timber);
    buoys.box([x + side, 3.4, z], [1.2, .6, .06], lane === 'inner' ? '#c69759' : '#74b2bd');
  }
  finish(buoys, 'FlagshipChannelBuoys');
  const publicBoard = new SiteArt();
  publicBoard.box(P(2.2, -18, 15), [2.2, 1.6, .12], timber, false, 'body', rot);
  for (let n = 0; n < 6; n++) publicBoard.box(P(1.35 + n * .32, -17.91, 15), [.23, 1.1, .025], '#dfcda6', false, 'body', rot);
  finish(publicBoard, 'FlagshipPublicTimetable');
  const warehouse = new SiteArt();
  // The fixed-harbor choice leaves both hatch stairways and the wheel lane clear.
  for (const u of [7, 10, 13]) for (const v of [3.8, -4.2]) warehouse.box(P(u, v, 3.9), [1, 1, 1.4], timber, true, 'body', rot);
  const storeCollider = finish(warehouse, 'COL_FlagshipPublicWarehouse')!; vessel.attach(warehouse.root);
  owned.push({ collider: storeCollider, geometry: storeCollider.bvh.geometry, attr: storeCollider.bvh.geometry.getAttribute('position') as THREE.BufferAttribute, base: Float32Array.from(storeCollider.bvh.geometry.getAttribute('position').array) });

  const offset = new THREE.Vector3(), previous = new THREE.Vector3();
  let initialized = false, lane: FlagshipLane | null = null, leg = 0, returning = false, paused = false, lastY = NaN;
  // B05→B06: Meyrick's crane holds the whole ship up in its dock until the last cable is cut.
  const craneHeld = () => host.done.has('b05_complete') && !host.done.has('b06_complete') && !host.done.has('sea_core');
  const desiredHeight = () => craneHeld() || host.done.has(F.inspect) && !flagshipBridgeLowered(host.done) && !host.done.has('sea_core') ? 6 : 0;
  const moving = () => !!lane || Math.abs(offset.y - desiredHeight()) > .001;
  const atDock = () => Math.hypot(offset.x, offset.z) < .001;
  function refit(entry: typeof owned[number]) {
    for (let i = 0; i < entry.attr.count; i++) entry.attr.setXYZ(i, entry.base[3 * i] + offset.x, entry.base[3 * i + 1] + offset.y, entry.base[3 * i + 2] + offset.z);
    entry.attr.needsUpdate = true; entry.geometry.computeBoundingBox(); entry.geometry.computeBoundingSphere(); entry.collider.bvh.refit();
  }
  function sync() {
    vessel.position.copy(offset);
    if (!offset.equals(previous) || !initialized) for (const entry of owned) refit(entry);
    for (const binding of points) for (let n = 0; n < 3; n++) binding.point[n] = binding.base[n] + offset.getComponent(n);
    if (lastY !== offset.y) {
      const center = P(0, 0, 0);
      for (const item of gangGeometries) {
        for (let i = 0; i < item.attr.count; i++) {
          const v = (item.base[3 * i] - center[0]) * Math.cos(SHIP_INTERIOR.yaw) - (item.base[3 * i + 2] - center[2]) * Math.sin(SHIP_INTERIOR.yaw);
          const u = (item.base[3 * i] - center[0]) * Math.sin(SHIP_INTERIOR.yaw) + (item.base[3 * i + 2] - center[2]) * Math.cos(SHIP_INTERIOR.yaw);
          let distance = Infinity, weight = 0;
          for (let j = 1; j < FLAGSHIP_MAINTENANCE.length; j++) {
            const a = FLAGSHIP_MAINTENANCE[j - 1], b = FLAGSHIP_MAINTENANCE[j], du = b[0] - a[0], dv = b[1] - a[1];
            const t = THREE.MathUtils.clamp(((u - a[0]) * du + (v - a[1]) * dv) / (du * du + dv * dv), 0, 1);
            const d = Math.hypot(u - a[0] - du * t, v - a[1] - dv * t);
            if (d < distance) { distance = d; weight = j === 1 ? 0 : j === 2 ? t : 1; }
          }
          item.attr.setY(i, item.base[3 * i + 1] + offset.y * weight);
        }
        item.attr.needsUpdate = true; item.geometry.computeBoundingBox(); item.geometry.computeBoundingSphere();
      }
      gangCollider.bvh.refit(); lastY = offset.y;
    }
    const open = atDock() && !moving();
    gangway.root.visible = gangCollider.enabled = open;
    shoreGate.root.visible = shoreCollider.enabled = !open;
    boatGate.root.visible = boatCollider.enabled = !open;
    fleetGate.root.visible = fleetGateCollider.enabled = !open || offset.y > 0;
    // Same rule as the ghost bridge it continues (the adventure campaign never collects shards).
    const linkOpen = open && offset.y === 0 && ghostBridgeOpen(host.done);
    if (host.link?.art) host.link.art.visible = linkOpen;
    if (host.link?.collider) host.link.collider.enabled = linkOpen;
    publicBoard.root.visible = host.done.has(FLAGSHIP_NAV.shared) || host.done.has(FLAGSHIP_NAV.fixed);
    warehouse.root.visible = storeCollider.enabled = host.done.has(FLAGSHIP_NAV.fixed);
    root.updateMatrixWorld(true); previous.copy(offset); initialized = true;
  }
  function supported(player: Pick<Player, 'pos' | 'onGround' | 'flying' | 'swimming'>) {
    if (!player.onGround || player.flying || player.swimming) return false;
    const ray = new THREE.Ray(player.pos.clone().add(new THREE.Vector3(0, .15, 0)), new THREE.Vector3(0, -1, 0));
    return owned.some(e => e.collider.enabled && e.collider.bvh.raycastFirst(ray, THREE.DoubleSide, 0, .35));
  }
  offset.y = desiredHeight(); sync();
  return { root, vessel, colliders, markers, gangwayPoints: FLAGSHIP_MAINTENANCE.map(p => P(...p)),
    get offset() { return offset.clone(); }, get moving() { return moving(); }, get docked() { return atDock() && !moving(); },
    get floating() { return offset.y === 0 && !moving(); }, get sailing() { return !!lane; },
    get paused() { return paused; },
    active(id: string) {
      if (id === FLAGSHIP_NAV.stop) return !!lane;
      if (id === FLAGSHIP_NAV.recall) return !!lane && !atDock();
      if (id === FLAGSHIP_NAV.inner || id === FLAGSHIP_NAV.outer) return !moving() && flagshipBridgeLowered(host.done) && !host.done.has(FLAGSHIP_NAV.fixed);
      return host.done.has('sea_core') && !moving() && !host.done.has(FLAGSHIP_NAV.shared) && !host.done.has(FLAGSHIP_NAV.fixed);
    },
    operate(id: string, player: Pick<Player, 'pos' | 'onGround' | 'flying' | 'swimming'>) {
      if (!this.active(id)) return false;
      if (id === FLAGSHIP_NAV.stop) { paused = !paused; return true; }
      if (id === FLAGSHIP_NAV.recall) { returning = true; paused = false; return true; }
      if (id === FLAGSHIP_NAV.shared || id === FLAGSHIP_NAV.fixed) { const ok = host.commit(id); sync(); return ok; }
      if (!supported(player)) return false;
      lane = id === FLAGSHIP_NAV.inner ? 'inner' : 'outer'; leg = 1; returning = paused = false; sync(); return true;
    },
    update(dt: number, player: Pick<Player, 'pos' | 'vel' | 'onGround' | 'flying' | 'swimming'>, blocked = false) {
      if (dt <= 0 || blocked) { sync(); return; }
      const aboard = supported(player), before = offset.clone(), step = Math.min(dt, .05);
      // A released crane drops the hull fast (about one second); ordinary hoisting stays slow.
      if (!lane) offset.y += Math.sign(desiredHeight() - offset.y) * Math.min(Math.abs(desiredHeight() - offset.y), step * (host.done.has('b06_complete') && offset.y > desiredHeight() ? 6 : .8));
      else if (!paused) {
        const path = FLAGSHIP_LANES[lane], target = new THREE.Vector3(...path[returning ? Math.max(0, leg - 1) : leg]);
        const delta = target.sub(offset), distance = delta.length(), speed = 3.5;
        if (distance <= step * speed) {
          offset.add(delta);
          if (returning) { leg--; if (leg <= 0) { lane = null; leg = 0; } }
          else if (leg >= path.length - 1) { host.commit(lane === 'inner' ? FLAGSHIP_NAV.innerComplete : FLAGSHIP_NAV.outerComplete); returning = true; }
          else leg++;
        } else offset.addScaledVector(delta, step * speed / distance);
      }
      if (Math.abs(offset.y - desiredHeight()) < .001) offset.y = desiredHeight();
      if (aboard) { player.pos.add(offset.clone().sub(before)); player.vel.y = 0; player.onGround = true; }
      sync();
    },
    dispose() {
      for (const c of colliders) { c.enabled = false; c.bvh.geometry.dispose(); }
      for (const a of resources) { a.layers.forEach(m => m.geometry.dispose()); Object.values(a.materials).forEach(m => m.dispose()); }
      root.removeFromParent();
    },
  };
}
