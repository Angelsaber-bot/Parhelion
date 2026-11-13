import * as THREE from 'three';
import { qinToWorld } from '../map/qinPlan';
import { createSettlementNpcs } from '../settlements/npcs';
import { QIN_FIELD as Q } from '../story/qinFieldStories';
import { JOURNEY } from '../story/worldJourney';
import { climaxMarker } from '../story/realmClimaxes';
import type { FieldAuthoring } from './fieldSiteAuthoring';

type Point = [number, number, number];
const shift = ([x, y, z]: Point, dx = 0, dy = 0, dz = 0): Point => [x + dx, y + dy, z + dz];
const local = (x: number, y: number, z: number): Point => {
  const [wx, wz] = qinToWorld(x, z);
  return [wx, y, wz];
};
const ash = '#78604b', clay = '#a16b51', paper = '#ccb693', slate = '#45494a';

export function createQinFieldSites({ place, interact, scenery, finish, table, mesh, group, walkway, ground,
  materials, prior, updates, actorCleanup }: FieldAuthoring) {
  const { lists, cart, stars, oldRank, troupe, range } = Q;
  const qinTable = prior.get(JOURNEY.qinRead)?.p;
  const people = qinTable && place(shift(qinTable, 5, -.9, 3.5), 9);
  const tools = people && place(shift(people, -6.6, 0, -5.1), 9);
  const seats = people && place(shift(people, 6.6, 0, -5.1), 9);
  if (people && tools && seats) {
    interact(lists.people, people); interact(lists.tools, tools); interact(lists.seats, seats);
    const art = scenery('QinTwoWorkRolls');
    for (const p of [people, tools, seats]) table(art, p, ash);
    for (const p of [people, tools]) {
      art.paper(...shift(p, -.24, .912, -.86), .66, .45);
      for (let i = 0; i < 6; i++) {
        art.box(shift(p, -.49 + i * .092, .938, -.92), [.061, .017, .34], paper);
        art.box(shift(p, -.49 + i * .092, .951, -.95 + .056 * (i % 3)), [.023, .006, .056], slate);
      }
      art.lantern(...shift(p, .65, 1.05, -1.04));
    }
    for (const dx of [-1.45, 1.45]) {
      art.box(shift(seats, dx, 1.21, -1.63), [.12, 2.42, .15], ash, true);
      art.box(shift(seats, dx, 1.21, .41), [.12, 2.42, .15], ash, true);
    }
    art.box(shift(seats, 0, 2.45, -.61), [3.15, .12, 2.4], '#8c573e', false, 'body', [.09, 0, 0]);
    const tags = group(art.root, shift(seats, 0, .89, -.52), 'QinReservedFamilySeats');
    for (const x of [-.58, .58]) mesh(tags, new THREE.BoxGeometry(.14, .24, .04), materials.red, [x, -.11, .02]);
    finish(art, 'alpha');
    const peopleRig = createSettlementNpcs([
      { id: 'qin_family_clerk', region: 'alpha', worldRegion: 'qin', role: ['周弭', 'Zhou Mi'], position: shift(people, .9, 0, -1.22), yaw: -.7, appearance: { coat: 0x86644b, trim: 0x524e3b }, lines: [] },
      { id: 'qin_family_carver', region: 'alpha', worldRegion: 'qin', role: ['刻木学徒', 'Woodcarving apprentice'], position: shift(tools, .83, 0, -.76), yaw: -.6, appearance: { coat: 0x758065, trim: 0x493b38 }, lines: [] },
    ]);
    art.root.add(peopleRig.group); actorCleanup.push(() => peopleRig.dispose());
    updates.push((done, dt, player) => {
      tags.visible = done.has(lists.seats);
      peopleRig.update(dt, player);
    });
  }

  const found = place(local(109, 46, -114), 4.5);
  const lift = found && place(shift(found, -1.8, 0, -3.4), 4.5);
  const spare = found && place(shift(found, -4.5, 0, .1), 4.5);
  const handles = found && place(shift(found, -3.7, 0, 3.8), 4.5);
  const endpoint = place(local(89, 43, -115), 4.5);
  let cartTime = 0, pushing = false, pushed = false;
  if (found && lift && spare && handles && endpoint) {
    interact(cart.find, found); interact(cart.align, lift); interact(cart.wheel, spare); interact(cart.push, handles); interact(cart.cache, endpoint);
    const art = scenery('QinFoundryCartSiding');
    const center = shift(handles, 1.48, .3);
    const work = group(art.root, shift(lift, .45, 0, -.58), 'QinCartWorkerEffigy');
    function clayBody(parent: THREE.Group, pose: number) {
      mesh(parent, new THREE.BoxGeometry(.48, .12, .36), materials.dark, [0, .06, 0]);
      for (const x of [-.12, .12]) mesh(parent, new THREE.CylinderGeometry(.094, .105, .68, 9), materials.wood, [x, .46, 0]);
      mesh(parent, new THREE.CapsuleGeometry(.2, .39, 4, 9), materials.wood, [0, 1.02, 0]).rotation.z = pose;
      mesh(parent, new THREE.SphereGeometry(.16, 13, 9), materials.wood, [Math.sin(-pose) * .24, 1.52, 0]);
      for (const x of [-1, 1]) {
        const arm = mesh(parent, new THREE.CapsuleGeometry(.068, .45, 3, 8), materials.wood, [x * .27, 1.08, .16]);
        arm.rotation.x = -.84; arm.rotation.z = x * (.24 + pose * .5);
      }
    }
    clayBody(work, -.12);
    const wagon = group(art.root, center, 'QinRepairedSupplyCart');
    mesh(wagon, new THREE.BoxGeometry(1.38, .21, .89), materials.wood, [0, .32, 0]);
    mesh(wagon, new THREE.BoxGeometry(.72, .47, .61), materials.wood, [.16, .59, 0]);
    const wheels = [-.49, .49].map(z => {
      const wheel = group(wagon, [0, .12, z], 'QinCartWheel');
      mesh(wheel, new THREE.TorusGeometry(.34, .041, 7, 20), materials.dark, [0, 0, 0]);
      for (let i = 0; i < 6; i++) mesh(wheel, new THREE.BoxGeometry(.044, .63, .041), materials.wood, [0, 0, 0]).rotation.z = i * Math.PI / 6;
      return wheel;
    });
    const spareWheel = mesh(art.root, new THREE.TorusGeometry(.34, .041, 7, 20), materials.dark, shift(spare, .33, .87, -.81), 'QinLooseCartWheel');
    table(art, spare);
    for (const z of [-.46, .46]) art.beam(shift(center, -.86, -.23, z), shift(endpoint, -.62, .05, z), .067, slate);
    const cache = mesh(art.root, new THREE.BoxGeometry(.71, .34, .53), materials.metal, shift(endpoint, -.69, .17, -.36), 'QinCartSupplyCache');
    finish(art, 'alpha');
    const from = new THREE.Vector3(...center), destination = new THREE.Vector3(...shift(endpoint, -.3, .31));
    let restored = false;
    updates.push((done, dt, player) => {
      const ready = done.has(cart.wheel), aligned = done.has(cart.align);
      if (!restored || done.has(cart.push)) cartTime = done.has(cart.push) ? 1 : 0;
      restored = true;
      if (pushing && player.distanceTo(wagon.position) < 4.7) {
        cartTime = Math.min(1, cartTime + dt / 4);
        if (cartTime >= 1) { pushing = false; pushed = true; }
      }
      wagon.position.copy(from).lerp(destination, cartTime);
      const y = ground(wagon.position.x, wagon.position.z, 47.25);
      if (y !== null) wagon.position.y = y + .31;
      wagon.rotation.x = aligned ? 0 : -.2;
      work.rotation.x = aligned ? -.28 : 0;
      spareWheel.visible = !ready;
      wheels[0].visible = ready;
      wheels.forEach(wheel => { wheel.rotation.z = -cartTime * from.distanceTo(destination) / .34; });
      cache.visible = done.has(cart.push) && !done.has(cart.cache);
    });
  }

  const foot = place(local(22, 28, -129), 4.5);
  if (foot) {
    const art = scenery('QinAstronomerCatwalk');
    interact(stars.foot, foot);
    const landing = shift(foot, -4.7, 3.05, 7.2), latch = shift(landing, 0, 0, 1.45);
    const far = shift(latch, 0, 0, 7.2), view = shift(far, 0, 0, 1.15);
    interact(stars.latch, latch); interact(stars.view, view);
    walkway('QinAstronomerServiceStair', 'alpha', [shift(foot, -4.7, .08, -3.8), landing], 2.7, ash, true);
    art.box(shift(latch, 0, -.12), [3.05, .24, 3.65], ash, true);
    art.box(shift(view, 0, -.12), [3.05, .24, 3.9], ash, true);
    for (const p of [landing, far]) for (const x of [-1.35, 1.35]) {
      art.beam(shift(p, x, -3.05, -.67), shift(p, x, .88, -.67), .13, slate, true);
    }
    for (const x of [-.67, .67]) art.ring(shift(view, x, 1.31, .84), .34, .048, '#b88752', 'metal');
    const crossing = walkway('QinAstronomerHingedDeck', 'alpha', [shift(latch, 0, 0, .82), shift(far, 0, 0, -.76)], 2.67, ash, false);
    const hinge = mesh(art.root, new THREE.BoxGeometry(2.55, .19, 4.45), materials.wood, shift(latch, 0, 2.03, 1.2), 'QinRaisedSurveyDeck');
    hinge.rotation.x = Math.PI / 2;
    finish(art, 'alpha');
    updates.push(done => {
      const ready = done.has(stars.latch);
      crossing.art.root.visible = crossing.collider.enabled = ready;
      hinge.visible = !ready;
    });
  }

  const trace = place(local(7, 36, -295), 13.5);
  const first = trace && place(shift(trace, -3.3, 0, 2.4), 4.5);
  const second = first && place(shift(first, -3.6, 0, .15), 4.5);
  const outer = second && place(shift(second, -1.4, 0, 5.2), 6);
  if (trace && first && second && outer) {
    interact(oldRank.traces, trace); interact(oldRank.first, first); interact(oldRank.second, second); interact(oldRank.exit, outer);
    const art = scenery('QinOldRankServicePortal');
    const pair = [first, second].map((p, i) => {
      const position = shift(p, 0, 0, 1.04);
      const statue = group(art.root, position, 'QinOldShieldFigure' + i);
      art.cyl(shift(position, 0, .14), .68, .28, '#766051', true);
      mesh(statue, new THREE.CapsuleGeometry(.3, .64, 4, 10), materials.wood, [0, .96, 0]);
      mesh(statue, new THREE.SphereGeometry(.17, 10, 8), materials.wood, [0, 1.64, 0]);
      mesh(statue, new THREE.BoxGeometry(.62, 1.14, .13), materials.dark, [.18, .94, .34]);
      mesh(statue, new THREE.BoxGeometry(.047, .82, .038), materials.metal, [.18, .94, .42]);
      return statue;
    });
    const portal = shift(outer, 0, 0, -1.83);
    const barrier = scenery('QinOldRankSlidingPanel');
    barrier.box(shift(portal, 0, 1.02), [2.33, 2.04, .24], clay, true);
    const collision = finish(barrier, 'alpha')!;
    for (const side of [-1, 1]) {
      art.box(shift(portal, side * 1.31, 1.23), [.27, 2.46, .55], slate, true);
      art.box(shift(portal, side * 2.83, .96), [2.72, 1.92, .45], '#9c7c5f', true);
    }
    art.box(shift(portal, 0, 2.39), [3, .2, .58], clay);
    art.ring(shift(outer, .89, 1.2, -.36), .17, .04, '#b88752', 'metal');
    finish(art, 'alpha');
    updates.push((done, dt) => {
      const open = done.has(oldRank.second);
      pair.forEach((statue, i) => {
        const target = done.has(i ? oldRank.second : oldRank.first) ? Math.PI : i ? -.32 : .72;
        statue.rotation.y = dt ? THREE.MathUtils.damp(statue.rotation.y, target, 7, dt) : target;
      });
      collision.enabled = !open;
      barrier.root.position.x = dt ? THREE.MathUtils.damp(barrier.root.position.x, open ? 2.4 : 0, 7, dt) : open ? 2.4 : 0;
    });
  }

  const corner = place(local(123, 46, -87), 6);
  const frame = corner && place(shift(corner, 2.8, 0, 4), 4.5);
  const ledge = corner && place(shift(corner, 6.6, 0, 9.3), 4.5);
  if (corner && frame && ledge) {
    interact(troupe.entry, corner); interact(troupe.frame, frame); interact(troupe.finish, ledge);
    const art = scenery('QinSilentAcrobatCorner');
    const puppet = new THREE.MeshStandardMaterial({ color: clay, roughness: .84 });
    for (let i = 0; i < 4; i++) {
      const base = shift(corner, -2.1 - i * .82, 0, 1.5 + i * .88);
      const figure = group(art.root, base, 'QinAcrobat' + i);
      const lean = (i - 1.5) * .42;
      mesh(figure, new THREE.CapsuleGeometry(.19, .44, 4, 10), puppet, [0, .94, 0]).rotation.z = lean;
      mesh(figure, new THREE.SphereGeometry(.145, 12, 8), puppet, [-lean * .46, 1.38, 0]);
      for (const s of [-1, 1]) {
        mesh(figure, new THREE.CapsuleGeometry(.064, .44, 4, 8), puppet, [s * .32, 1.2, .05]).rotation.z = s * (.82 + .15 * i);
        mesh(figure, new THREE.CapsuleGeometry(.075, .48, 4, 8), puppet, [s * .18, .41, 0]).rotation.z = s * (.1 + .17 * i);
      }
    }
    const near = shift(frame, -1.25, .7, .9), far = shift(ledge, -1.6, .93, -2.2);
    art.box(shift(near, 0, -.34), [2.1, .68, 1.79], ash, true);
    art.box(shift(far, 0, -.47), [2.2, .94, 1.84], ash, true);
    art.box(shift(near, .65, -.55, -1.29), [.8, .46, .8], ash, true);
    const jump = walkway('QinAcrobatJumpBoard', 'alpha', [shift(near, 0, .015, .25), shift(near, .9, .07, 1.6)], 1.21, ash, false, false);
    art.lantern(...shift(ledge, .59, 1.33, .83));
    finish(art, 'alpha');
    updates.push(done => { jump.art.root.visible = jump.collider.enabled = done.has(troupe.frame); });
  }

  const board = place(local(-49, 28, -121), 4.5);
  const origin = board && place(shift(board, -1.9, 0, 6.4), 4.5);
  let lane = -1, clock = 0, waiting = false, rangeResult: 'success' | 'hit' | 'left' | null = null;
  let rangeOrigin: Point | null = null;
  if (board && origin) {
    rangeOrigin = origin;
    interact(range.read, board); interact(range.start, origin);
    const art = scenery('QinCrossbowTrainingGallery');
    table(art, board);
    const lines = [-2, 0, 2].map((x, i) => {
      const start = shift(origin, x, .065, -1.1), end = shift(origin, x, .065, 8.4);
      art.beam(start, end, .032, '#a4574c');
      const target = shift(end, 0, 1.16);
      art.box(target, [1.16, 1.48, .17], '#a28f6d', true);
      art.ring(shift(target, 0, .07, -.092), .32, .03, '#8c493e', 'body', [0, 0, 0]);
      art.box(shift(target, 0, -1), [.16, .48, .28], ash);
      return mesh(art.root, new THREE.BoxGeometry(1.45, .032, 9.8), new THREE.MeshBasicMaterial({
        color: '#fa6d42', opacity: .47, transparent: true, depthWrite: false,
      }), shift(start, 0, .006 + i * .003, 4.75), 'QinCrossbowWarning' + i);
    });
    const bolt = mesh(art.root, new THREE.CylinderGeometry(.037, .037, .87, 6).rotateX(Math.PI / 2), materials.metal,
      shift(origin, 0, .88), 'QinPracticeBolt');
    const arena = prior.get(climaxMarker('qin', 'start'))?.p ?? local(-17, 28, -162);
    const sideSign = mesh(art.root, new THREE.BoxGeometry(.48, .035, .48), materials.beacon, shift(arena, 2.2, -.84, .45), 'QinSealGeneralRangeMark');
    finish(art, 'alpha');
    updates.push((done, dt, p) => {
      sideSign.visible = done.has(range.start);
      const dx = p.x - origin[0], dz = p.z - origin[2];
      if (lane >= 0 && dt > 0) {
        if (Math.abs(dx) > 6 || dz < -3 || dz > 10 || Math.abs(p.y - origin[1]) > 2) {
          lane = -1; rangeResult = 'left';
        } else if (waiting) {
          if (Math.hypot(dx, dz) < 3.1) { waiting = false; clock = 0; }
        } else {
          const priorTime = clock;
          clock += dt;
          if (priorTime < 1.28 && clock >= 1.28 && Math.abs(dx - (lane - 1) * 2) < .83) {
            lane = -1; rangeResult = 'hit';
          } else if (clock >= 1.72) {
            if (++lane === 3) { lane = -1; rangeResult = 'success'; }
            else waiting = true;
          }
        }
      }
      lines.forEach((light, i) => { light.visible = lane === i && !waiting && clock < 1.28; });
      bolt.visible = lane >= 0 && !waiting && clock >= 1.28;
      if (bolt.visible) bolt.position.set(origin[0] + (lane - 1) * 2, origin[1] + .86,
        origin[2] + 8.1 - Math.min(9.2, (clock - 1.28) * 23));
    });
  }

  return {
    startCart() {
      if (!endpoint || !handles || !lift || !spare || !found) return false;
      pushing = true; return true;
    },
    readCartArrival() { const value = pushed; pushed = false; return value; },
    startRange() {
      if (!rangeOrigin || lane >= 0) return false;
      lane = 0; clock = 0; waiting = false; rangeResult = null; return true;
    },
    readRangeResult() { const value = rangeResult; rangeResult = null; return value; },
  };
}
