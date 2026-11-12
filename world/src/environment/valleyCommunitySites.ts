import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import { mergeParts } from '../settlements/merge';
import { createSettlementNpcs } from '../settlements/npcs';
import { residentWalkRig } from '../settlements/residentWalk';
import { SiteArt } from '../story/campaignSites';
import {
  FREIGHT_YARD as Y, MIST_RESCUE as M, NEXT_SHIFT as N, OLD_TICKET as T, VALLEY_COMMUNITY_STEPS,
} from '../story/valleyCommunity';

type Point = [number, number, number];
type Ground = (x: number, z: number, ceiling: number) => number | null;
type Animate = (done: ReadonlySet<string>, dt: number, player: THREE.Vector3) => void;
const shift = (p: Point, x = 0, y = 0, z = 0): Point => [p[0] + x, p[1] + y, p[2] + z];
const plank = '#9c805b', iron = '#465766', stone = '#808575', brass = '#bc9d63', cloth = '#638c83';

export function createValleyCommunitySites(residence: Point, existing: readonly Marker[], water: number, ground: Ground,
  clear: (position: THREE.Vector3) => boolean) {
  const root = new THREE.Group(); root.name = 'ValleyCommunitySites';
  const art = new SiteArt(), markers: Marker[] = [], colliders: Collider[] = [], animate: Animate[] = [];
  const timber = new THREE.MeshStandardMaterial({ color: plank, roughness: .85 });
  const steel = new THREE.MeshStandardMaterial({ color: iron, metalness: .45, roughness: .56 });
  const yellow = new THREE.MeshStandardMaterial({ color: brass, roughness: .8 });
  const enamel = new THREE.MeshStandardMaterial({ color: cloth, roughness: .64 });
  const resources = new Set<THREE.BufferGeometry>();
  const cleanup: (() => void)[] = [];
  const performance = new Map<string, () => void>();
  function find(p: Point, radius = 6) {
    for (let r = 0; r <= radius; r += 1.5) for (let i = 0; i < (r ? 12 : 1); i++) {
      const x = p[0] + r * Math.cos(i * Math.PI / 6), z = p[2] + r * Math.sin(i * Math.PI / 6);
      const y = ground(x, z, p[1] + 2.3);
      if (y === null || y <= water + .12 || Math.abs(y - p[1]) > 3.6 || !clear(new THREE.Vector3(x, y + .04, z))) continue;
      if (existing.some(m => m.type === 'interact' && Math.hypot(x - m.p[0], z - m.p[2]) < 2.4 && Math.abs(y + .9 - m.p[1]) < 2)) continue;
      if (markers.some(m => Math.hypot(x - m.p[0], z - m.p[2]) < 2.2 && Math.abs(y + .9 - m.p[1]) < 2)) continue;
      return [x, y, z] as Point;
    }
    return null;
  }
  function marker(id: string, p: Point) {
    markers.push({ id, p: shift(p, 0, .9), label: VALLEY_COMMUNITY_STEPS.get(id)!.label[0], type: 'interact', radius: 1.85 });
  }
  function mesh(parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, p: Point, name = '') {
    const model = new THREE.Mesh(g, m); model.name = name;
    model.position.fromArray(p); model.castShadow = true; model.receiveShadow = true;
    parent.add(model); resources.add(g); return model;
  }
  function box(parent: THREE.Object3D, p: Point, size: Point, m = timber, name = '') {
    return mesh(parent, new THREE.BoxGeometry(...size), m, p, name);
  }
  function sign(p: Point, color = plank) {
    art.box(shift(p, 0, .68, -.72), [.17, 1.35, .15], iron, true);
    art.box(shift(p, 0, 1.22, -.68), [.94, .44, .1], color);
    for (let i = 0; i < 3; i++) art.box(shift(p, 0, 1.08 + i * .12, -.623), [.6 - i * .09, .018, .012], brass);
  }
  function movableRail(a: Point, b: Point, width: number, name: string) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.clone().normalize());
    const middle = start.clone().addScaledVector(delta, .5);
    const node = new THREE.Group(); node.position.copy(middle); node.quaternion.copy(rotation); root.add(node);
    const deck = box(node, [0, -.12, 0], [width, .24, delta.length() + .6]);
    const floor = deck.geometry.clone().translate(0, -.12, 0);
    floor.applyQuaternion(rotation); floor.translate(middle.x, middle.y, middle.z);
    const collider = { name: 'COL_' + name, bvh: new MeshBVH(floor), enabled: false };
    colliders.push(collider); resources.add(floor);
    for (const x of [-width / 2, width / 2]) {
      box(node, [x, .74, 0], [.10, .12, delta.length()], steel);
      for (const z of [-.42, 0, .42]) box(node, [x, .32, delta.length() * z], [.12, .75, .12], steel);
    }
    node.name = name;
    return { node, collider };
  }
  function person(id: string, p: Point, role: [string, string], coat: number, carry?: 'sack') {
    const npc = createSettlementNpcs([{ id, position: p, role, appearance: { coat, carry }, region: 'alpha', lines: [] }]);
    const model = npc.group.getObjectByName('Resident_' + id)!;
    const gait = residentWalkRig(model);
    let phase = 0, moving = false, wasMoving = false, groundOffset = 0, lastX = Infinity, lastZ = Infinity;
    root.add(npc.group); cleanup.push(() => npc.dispose());
    return {
      model,
      gesture: () => npc.gesture(id),
      pose(a: Point, b: Point, progress: number, walking: boolean) {
        const x = THREE.MathUtils.lerp(a[0], b[0], progress), z = THREE.MathUtils.lerp(a[2], b[2], progress);
        if (lastX !== x || lastZ !== z) {
          const y = THREE.MathUtils.lerp(a[1], b[1], progress);
          const floor = ground(x, z, y + .8) ?? y;
          npc.pose(id, [x, floor, z], Math.atan2(b[0] - a[0], b[2] - a[2]));
          groundOffset = floor - p[1]; lastX = x; lastZ = z;
        }
        moving = walking;
      },
      update(dt: number, player: THREE.Vector3) {
        if (wasMoving && !moving) gait.update(phase, false, groundOffset);
        npc.update(dt, player);
        if (moving && model.visible) {
          phase += dt * 11;
          gait.update(phase, true, groundOffset);
        }
        wasMoving = moving;
      },
    };
  }
  function close(player: THREE.Vector3, p: Point, distance: number) {
    return Math.hypot(player.x - p[0], player.z - p[2]) < distance;
  }
  let rescue = 0, hoistTravel = 0, taoTravel = 0, depart = 0;
  let practice: string | null = null;

  const intake = find([141, 4, -46], 9), upper = find([163, 7, -48], 13.5);
  const lower = find([177, 2.4, -63], 9), hatch = find([184, 2.4, -62], 6), safe = find([175, 2.4, -60], 7.5);
  if (intake && upper && lower && hatch && safe) {
    for (const [id, p] of [[M.intake, intake], [M.upper, upper], [M.lower, lower], [M.hatch, hatch], [M.safe, safe]] as const) marker(id, p);
    sign(intake, cloth);
    for (const p of [upper, lower]) {
      art.beam(shift(p, .7, .13, -.82), shift(p, .7, 1.3, -.82), .104, iron);
      art.beam(shift(p, .7, 1.3, -.82), shift(p, .22, 1.3, -.56), .104, iron);
      art.ring(shift(p, .2, 1.3, -.52), .15, .038, brass);
      art.box(shift(p, .7, .55, -.85), [.38, .12, .34], stone, true);
    }
    for (const x of [-1.14, 1.14]) art.box(shift(hatch, x, 1.07, -.79), [.18, 2.15, .17], iron, true);
    art.box(shift(hatch, 0, 2.19, -.79), [2.55, .18, .24], iron);
    const trap = box(root, shift(hatch, 0, 1.04, -.79), [1.97, 1.95, .13], steel, 'ValleyMistBentHatch');
    const hatchFloor = trap.geometry.clone().translate(...trap.position.toArray());
    const barrier = { name: 'COL_ValleyMistBentHatch', bvh: new MeshBVH(hatchFloor), enabled: true };
    resources.add(hatchFloor); colliders.push(barrier);
    const portal: Point = [162.4, 2.4, -60];
    const ramps = [movableRail(safe, portal, 2.52, 'ValleyMistMaintenanceRamp'),
      movableRail(portal, upper, 2.52, 'ValleyMistMaintenanceTurn')];
    const rescueNpc = person('valley_mist_lineman', shift(hatch, 0, 0, -1.35), ['检修工罗河', 'Lineman Luo He'], 0x647875, 'sack');
    performance.set(M.hatch, rescueNpc.gesture); performance.set(M.safe, rescueNpc.gesture);
    for (let i = 0; i < 4; i++) art.box(shift(safe, -.78 + i * .52, .036, -.39), [.37, .03, .1], brass);
    const patch = new THREE.Group(); patch.name = 'ValleyOutpostRepairedCanopy'; root.add(patch);
    const shelter = find([-174, 8, -25], 9);
    if (shelter) {
      patch.position.fromArray(shift(shelter, 0, 0, -1.15));
      for (const x of [-1.42, 1.42]) box(patch, [x, 1.28, 0], [.16, 2.56, .17], steel);
      for (let i = 0; i < 5; i++) box(patch, [-1.39 + i * .69, 2.54 - i * .045, -.46], [.72, .1, 2.16], i % 2 ? enamel : timber);
    }
    animate.push((done, dt, player) => {
      const open = done.has(M.hatch);
      if (!open) rescue = 0;
      else if (done.has(M.safe)) rescue = 1;
      else if (close(player, hatch, 45)) rescue = Math.min(1, rescue + dt / 4.1);
      trap.position.y = hatch[1] + (open ? 3.04 : 1.04);
      barrier.enabled = !open;
      for (const ramp of ramps) ramp.node.visible = ramp.collider.enabled = done.has(M.safe);
      patch.visible = done.has(M.safe);
      rescueNpc.pose(shift(hatch, 0, 0, -1.25), shift(safe, 1.05), rescue, open && rescue < 1);
      rescueNpc.update(dt, player); rescueNpc.model.visible &&= done.has(M.intake);
    });
  }

  const yard = find(shift(residence, -23, 0, 12), 13.5);
  const west = yard && find(shift(yard, -3.2, 0, 4.8));
  const east = west && find(shift(west, 8.3, 0, 0));
  const hoist = yard && find(shift(yard, -.9, 0, -4.6));
  const review = hoist && find(shift(hoist, 3.5, 0, -.13));
  if (yard && west && east && hoist && review) {
    for (const [id, p] of [[Y.notice, yard], [Y.practice, yard], [Y.decision, yard], [Y.west, west], [Y.east, east],
      [Y.variant, east], [Y.variantDone, west], [Y.load, hoist], [Y.loadTest, review]] as const) marker(id, p);
    sign(yard);
    const proposals = createSettlementNpcs([
      { id: 'valley_yard_meng', role: ['公共厨房孟槐', 'Meng Huai from the public kitchen'], region: 'alpha',
        position: shift(yard, -1.8, 0, -.36), appearance: { coat: 0x80584d, trim: 0xb2966d }, lines: [] },
      { id: 'valley_yard_xu', role: ['机械师许青', 'Mechanic Xu Qing'], region: 'alpha',
        position: shift(yard, 1.65, 0, -.36), appearance: { coat: 0x466571, trim: 0x937653 }, lines: [] },
    ]);
    root.add(proposals.group); cleanup.push(() => proposals.dispose());
    performance.set(Y.notice, () => { proposals.gesture('valley_yard_meng'); proposals.gesture('valley_yard_xu'); });
    performance.set(Y.loadTest, () => proposals.gesture('valley_yard_xu'));
    performance.set(Y.decision, () => proposals.gesture('valley_yard_meng'));
    for (const p of [west, east]) {
      art.box(shift(p, 0, .64, -.86), [2.06, 1.28, .21], stone, true);
      art.box(shift(p, 0, 1.31, -.86), [2.17, .08, .32], iron);
      art.ring(shift(p, .5, 1.56, -.74), .16, .043, brass);
    }
    for (const x of [-1.53, 1.53]) art.box(shift(hoist, x, 1.29, -.92), [.22, 2.58, .22], plank, true);
    art.box(shift(hoist, 0, 2.58, -.92), [3.38, .2, .21], iron, true);
    art.beam(shift(hoist, -1.45, 1.97, -.93), shift(hoist, -.78, 2.55, -.93), .105, plank);
    art.beam(shift(hoist, 1.45, 1.97, -.93), shift(hoist, .78, 2.55, -.93), .105, plank);
    const load = box(root, shift(hoist, 0, .41, -.92), [.73, .67, .66], timber, 'ValleyFreightTestLoad');
    const strap = box(root, shift(hoist, 0, 1.35, -.92), [.053, 2, .053], steel);
    art.box(shift(hoist, 1.4, 1.46, -.785), [.19, .07, .07], brass);
    const training = new THREE.Group(); training.name = 'ValleyFreightTrainingLayout'; root.add(training);
    for (const p of [west, east]) {
      const stand = box(training, shift(p, -.83, .45, -1.44), [.17, .9, .16], steel);
      box(training, shift(p, -.83, 1.04, -1.44), [.52, .42, .08], yellow);
      stand.rotation.y = .23;
    }
    const workshop = new THREE.Group(); workshop.name = 'ValleyFreightWorkshopLayout'; root.add(workshop);
    for (const p of [west, east]) {
      box(workshop, shift(p, -.7, .85, -1.42), [1.62, .14, .57], timber);
      for (const x of [-1.36, -.06]) box(workshop, shift(p, x, .4, -1.42), [.12, .8, .43], steel);
      box(workshop, shift(p, -.92, 1.01, -1.4), [.34, .19, .3], enamel);
    }
    animate.push((done, dt, player) => {
      if (!done.has(Y.practice)) practice = null;
      if (!done.has(Y.load)) hoistTravel = 0;
      else if (done.has(Y.loadTest)) hoistTravel = 1;
      else if (close(player, hoist, 26)) hoistTravel = Math.min(1, hoistTravel + dt / 2.3);
      load.position.y = hoist[1] + .41 + hoistTravel * 1.06;
      strap.scale.y = 1 - hoistTravel * .53;
      strap.position.y = hoist[1] + 1.48 + hoistTravel * .53;
      training.visible = done.has(Y.training); workshop.visible = done.has(Y.workshop);
      proposals.update(dt, player);
      proposals.group.visible = !done.has(Y.decision);
    });
  }

  const ticketStart = find([-91, 5.5, 80], 10.5);
  const mile = ticketStart && find(shift(ticketStart, 7.5, 0, -2.2), 9);
  const stop = mile && find(shift(mile, 8.8, 0, -2), 9);
  const seat = stop && find(shift(stop, .5, 0, 3.2));
  if (ticketStart && mile && stop && seat) {
    for (const [id, p] of [[T.meet, ticketStart], [T.mile, mile], [T.terminus, stop], [T.seat, seat]] as const) marker(id, p);
    sign(mile, cloth); sign(stop, cloth);
    for (const [a, b] of [[ticketStart, mile], [mile, stop]]) for (let i = 0; i < 8; i++) {
      const t = i / 8, x = THREE.MathUtils.lerp(a[0], b[0], t), z = THREE.MathUtils.lerp(a[2], b[2], t);
      const y = ground(x, z, Math.max(a[1], b[1]) + 1.1);
      if (y !== null) art.box([x, y + .033, z], [.27, .065, 1.5], plank);
    }
    art.box(shift(seat, 0, .48, -.68), [1.65, .105, .54], plank, true);
    art.box(shift(seat, 0, .74, -.91), [1.65, .28, .1], plank, true);
    for (const x of [-.61, .61]) art.box(shift(seat, x, .23, -.69), [.15, .46, .45], iron, true);
    const oldTicket = box(root, shift(stop, .2, 1.03, -.60), [.14, .22, .018], yellow, 'ValleyUnsentRailTicket');
    const tao = person('valley_old_route_tao', ticketStart, ['运输负责人陶叔', 'Freight keeper Tao'], 0x786452);
    performance.set(T.mile, tao.gesture); performance.set(T.terminus, tao.gesture);
    let age = 0;
    animate.push((done, dt, player) => {
      age += dt;
      if (!done.has(T.meet)) taoTravel = 0;
      else if (done.has(T.terminus)) taoTravel = 1;
      else if (close(player, mile, 46)) {
        const limit = done.has(T.mile) ? 1 : .5;
        taoTravel = Math.min(limit, taoTravel + dt / 9);
      }
      const walking = done.has(T.meet) && taoTravel < (done.has(T.mile) ? 1 : .5);
      if (taoTravel < .5) tao.pose(ticketStart, mile, taoTravel * 2, walking);
      else tao.pose(mile, stop, taoTravel * 2 - 1, walking);
      tao.update(dt, player);
      tao.model.visible &&= done.has(T.meet);
      oldTicket.visible = done.has(T.terminus);
      oldTicket.rotation.x = Math.sin(age * 4.6) * .19;
    });
  }

  const orders = find(shift(residence, 7, 0, 16), 12);
  const brake = orders && find(shift(orders, 4.5, 0, .7));
  const lash = brake && find(shift(brake, 0, 0, -2.9), 4.5);
  const handoff = brake && find(shift(brake, 4.5, 0, .8));
  const view = handoff && find(shift(handoff, 1.8, 0, 5));
  const end = handoff && find(shift(handoff, 10.5, 0, .9), 9);
  if (orders && brake && lash && handoff && view && end) {
    for (const [id, p] of [[N.orders, orders], [N.brake, brake], [N.load, lash], [N.handoff, handoff], [N.view, view]] as const) marker(id, p);
    sign(orders); sign(view, cloth);
    for (const x of [-1.2, 1.2]) art.box(shift(view, x, 1.36, -.93), [.15, 2.72, .16], iron, true);
    art.box(shift(view, 0, 2.7, -1.18), [2.86, .16, 1.76], plank, true);
    const cart = new THREE.Group(); cart.name = 'ValleyNextDepartureCart'; root.add(cart);
    box(cart, [0, .47, 0], [1.12, .18, 1.8]);
    box(cart, [0, .76, -.16], [.85, .45, .98], enamel);
    const band = box(cart, [0, .998, -.16], [.86, .044, .13], yellow);
    const handle = box(cart, [.35, .72, .73], [.09, .45, .11], steel);
    const rollers: THREE.Group[] = [];
    for (const x of [-.51, .51]) for (const z of [-.62, .58]) {
      const pivot = new THREE.Group(); pivot.position.set(x, .25, z); cart.add(pivot); rollers.push(pivot);
      const g = new THREE.CylinderGeometry(.235, .235, .15, 12).rotateZ(Math.PI / 2);
      mesh(pivot, g, steel, [0, 0, 0]);
      box(pivot, [Math.sign(x) * .085, 0, 0], [.036, .355, .046], yellow);
    }
    const pilot = person('valley_departure_azhou', handoff, ['阿舟', 'Azhou'], 0x4c7480);
    performance.set(N.handoff, pilot.gesture);
    let departureInitialized = false;
    animate.push((done, dt, player) => {
      if (!done.has(N.handoff)) depart = 0;
      else if (!departureInitialized) depart = 1;
      else if (depart < 1) depart = Math.min(1, depart + dt / 5.2);
      departureInitialized = true;
      const visible = done.has(N.orders);
      cart.visible = visible;
      band.visible = done.has(N.load);
      handle.rotation.x = done.has(N.brake) && !done.has(N.handoff) ? -.54 : .17;
      const a = shift(brake, 0, 0, -.93), b = shift(end, 0, 0, -.93);
      const x = THREE.MathUtils.lerp(a[0], b[0], depart), z = THREE.MathUtils.lerp(a[2], b[2], depart);
      const y = THREE.MathUtils.lerp(a[1], b[1], depart);
      if (cart.position.x !== x || cart.position.z !== z) cart.position.set(x, ground(x, z, y + .85) ?? y, z);
      cart.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]);
      for (const wheel of rollers) wheel.rotation.x = depart * 56;
      pilot.pose(handoff, shift(end, 1.1, 0, .25), depart, done.has(N.handoff) && depart < 1);
      pilot.update(dt, player); pilot.model.visible &&= visible;
    });
  }

  art.finish('alpha'); root.add(art.root);
  if (art.solids.length) {
    const g = mergeParts(art.solids); resources.add(g);
    colliders.push({ name: 'COL_ValleyCommunityFixtures', bvh: new MeshBVH(g), enabled: true });
    for (const original of art.solids) original.dispose();
  }
  return {
    root, colliders, markers,
    update(done: ReadonlySet<string>, dt: number, player: THREE.Vector3) { for (const update of animate) update(done, dt, player); },
    cue(id: string) { performance.get(id)?.(); },
    workerSafe: () => rescue >= 1, hoistReady: () => hoistTravel >= 1,
    taoAtMile: () => taoTravel >= .5, taoReady: () => taoTravel >= 1,
    usePartner(id: string | null) { practice = id; },
    activePartner: () => practice,
    dispose() {
      cleanup.forEach(dispose => dispose());
      root.traverse(node => { if (node instanceof THREE.Mesh) resources.add(node.geometry); });
      resources.forEach(g => g.dispose());
      for (const m of [timber, steel, yellow, enamel, ...Object.values(art.materials)]) m.dispose();
      root.removeFromParent();
    },
  };
}
