import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import { mergeParts } from '../settlements/merge';
import { createSettlementNpcs } from '../settlements/npcs';
import type { SettlementPlacement } from '../settlements/types';
import { SiteArt } from '../story/campaignSites';
import { nightAuthorityOpen, VALLEY_FIELD as F, VALLEY_FIELD_BY_ID } from '../story/valleyField';

type Point = [number, number, number];
type Ground = (x: number, z: number, ceiling: number) => number | null;
const slate = '#425869', bronze = '#a88650', timber = '#836953', glass = '#7ab9a6';

export function createValleyFieldScene(residence: SettlementPlacement, ground: Ground, clear: (point: THREE.Vector3) => boolean) {
  const art = new SiteArt(), markers: Marker[] = [], gates: Collider[] = [];
  const [ox, oy, oz] = residence.position;
  const town = (x: number, y: number, z: number): Point => [ox + x, oy + y, oz + z];
  function floor([x, y, z]: Point): Point {
    for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [4, 1], [-4, 1], [1, 4], [1, -4], [5, 5], [-5, -5]]) {
      const px = x + dx, pz = z + dz, py = ground(px, pz, y + 2.4);
      if (py !== null && py > 1.15 && Math.abs(py - y) < 3 && clear(new THREE.Vector3(px, py + .04, pz))) return [px, py, pz];
    }
    return [x, ground(x, z, y + 2.4) ?? y, z];
  }
  function station(id: string, preferred: Point, props = true, knownFloor = false) {
    const [x, y, z] = knownFloor ? preferred : floor(preferred);
    markers.push({ id, p: [x, y + .92, z], type: 'interact', label: VALLEY_FIELD_BY_ID.get(id)!.label[0], radius: 2.12 });
    if (props) {
      art.box([x, y + .46, z - .8], [.59, .92, .49], slate);
      art.box([x, y + .98, z - .8], [1.04, .12, .69], timber);
      art.box([x, y + 1.055, z - .73], [.65, .032, .38], bronze);
    }
    return [x, y, z] as Point;
  }

  const start = station(F.nightStart, [-117, 10, 241]);
  const paper = station(F.paperMap, [96, 9.2, 56]);
  const lamp = station(F.dimWatch, [135, 3.1, -71]);
  station(F.soundDecoy, [128, 4.5, -75]);
  const patrol = station(F.nightPatrol, [-187, 8, -23], false);
  station(F.radioRemove, [-192, 8, -20]);
  station(F.countPatch, [-181, 8, -20]);
  const brace = station(F.nightBrace, [-253, 4.8, -31]);
  const checkpoint = station(F.nightDone, [-248, 4.8, -31], false);
  art.paper(paper[0], paper[1] + 1.09, paper[2] - .72, .62, .4);
  for (const x of [-1.1, 1.1]) art.box([start[0] + x, start[1] + 1.45, start[2] - 1.45], [.15, 2.9, .15], timber);
  art.box([start[0], start[1] + 2.95, start[2] - 1.45], [2.72, .12, 1.42], slate, false, 'briefed');
  art.box([start[0] + .23, start[1] + 2.65, start[2] - 1.5], [2.19, .12, 1.33], slate, false, 'resolved', [0, .13, -.31]);
  art.box([start[0] - .67, start[1] + 2.8, start[2] - 1.45], [.44, .11, 1.54], timber, false, 'choiceA');

  // The observation deck is reached by a continuous collision-backed ramp outside the hall.
  const roofHeight = 4.55, slope = Math.atan2(roofHeight, 20);
  art.box(town(18.25, roofHeight / 2 - .13, 4.5), [2.9, .26, Math.hypot(20, roofHeight)], timber, true, 'body', [slope, 0, 0]);
  art.box(town(18.25, roofHeight - .14, -9), [5.8, .28, 7.4], slate, true);
  for (const x of [15.5, 21]) art.box(town(x, roofHeight + .53, -9.3), [.14, .13, 6.4], bronze, true);
  for (const x of [16.84, 19.66]) art.box(town(x, roofHeight / 2 + .76, 4.5), [.12, .13, Math.hypot(20, roofHeight)], bronze, true, 'metal', [slope, 0, 0]);
  for (const x of [16.3, 20.2]) for (const z of [-11.9, -6.1]) art.box(town(x, roofHeight / 2 - .1, z), [.21, roofHeight + .24, .21], timber, true);
  const roof = station(F.roofSight, town(18.35, roofHeight, -9), false, true);
  art.box([roof[0], roof[1] + .5, roof[2] - .85], [.29, 1, .39], slate);
  art.ring([roof[0], roof[1] + 1.31, roof[2] - 1.12], .38, .05, bronze, 'metal');
  art.ring([roof[0] + .28, roof[1] + 1.48, roof[2] - 1.54], .26, .042, glass, 'glow');
  station(F.replay, [24, 3.7, -97]);
  const disconnect = station(F.disconnect, [27, 4.4, -103]);

  const near = station(F.doorNear, [-195, 8.1, -35]);
  const far = station(F.doorFar, [near[0], near[1], near[2] - 6]);
  station(F.doorPower, [near[0] - 4.1, near[1], near[2] + 1]);
  station(F.doorDisconnect, [near[0] - 6.1, near[1], near[2] - 1.2]);
  station(F.doorRequest, [near[0] + 4, near[1], near[2] + .2]);
  station(F.doorLoad, [far[0] - 3.2, far[1], far[2] - .6]);
  const door: Point = [(near[0] + far[0]) / 2, (near[1] + far[1]) / 2, (near[2] + far[2]) / 2];
  for (const x of [-2.2, 2.2]) art.box([door[0] + x, door[1] + 1.48, door[2]], [.35, 2.96, .39], timber, true);
  art.box([door[0], door[1] + 2.9, door[2]], [4.8, .22, .62], slate, true);
  for (const x of [-3.4, 3.4]) art.box([door[0] + x, door[1] + .67, door[2]], [2.3, 1.34, .42], slate, true);

  station(F.drillStart, town(-6.2, 0, 6.5));
  station(F.drillBeacon, [103, 7.7, 53]);
  station(F.drillCart, [91, 10, 56]);
  station(F.drillObserver, [107, 7.5, 62]);
  const drill = station(F.drillDone, town(-6.2, 0, 10.5), false);
  station(F.towerLow, [-41, 3, -82]);
  station(F.towerHigh, [33, 6.7, -119]);
  const chairSpot = station(F.chair, town(-10, 0, 5), false);
  station(F.nextSlip, town(-9, 0, 2));
  art.finish('alpha'); art.root.name = 'ValleyFieldwork';

  const fixed = mergeParts(art.solids); art.solids.forEach(value => value.dispose());
  const mat = new THREE.MeshStandardMaterial({ color: slate, roughness: .67, metalness: .23 });
  const gold = new THREE.MeshStandardMaterial({ color: bronze, roughness: .55 });
  const green = new THREE.MeshStandardMaterial({ color: glass, emissive: '#3c785c', emissiveIntensity: .75 });
  const amber = new THREE.MeshStandardMaterial({ color: '#f0a45f', emissive: '#9e5127', emissiveIntensity: .73 });
  const cube = new THREE.BoxGeometry(1, 1, 1);
  function box(parent: THREE.Object3D, p: Point, size: Point, material = mat) {
    const mesh = new THREE.Mesh(cube, material);
    mesh.position.fromArray(p); mesh.scale.fromArray(size); mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  function dynamicGate(name: string, p: Point, size: Point) {
    const geo = new THREE.BoxGeometry(...size).translate(...p);
    const collider: Collider = { name, bvh: new MeshBVH(geo), enabled: false };
    gates.push(collider);
    const model = box(art.root, p, size);
    model.name = name;
    return { model, collider };
  }
  const bridgeGate = dynamicGate('ValleyNightBraceGate', [brace[0] + 2.3, brace[1] + .87, brace[2]], [.21, 1.74, 3.32]);
  const localDoor = dynamicGate('ValleyDoubleSidedDoor', [door[0], door[1] + 1.1, door[2]], [4.06, 2.2, .26]);
  const watch = box(art.root, [lamp[0], lamp[1] + 1.34, lamp[2] - .81], [.31, .38, .26], amber);
  watch.name = 'ValleyWatchlamp';
  const replayLight = box(art.root, [disconnect[0] - .24, disconnect[1] + 1.19, disconnect[2] - .86], [.25, .09, .23], green);
  const relayLight = box(art.root, [disconnect[0] + .25, disconnect[1] + 1.19, disconnect[2] - .86], [.25, .09, .23], amber);
  const gatePower = box(art.root, [door[0] - .36, door[1] + 2.67, door[2] + .3], [.23, .13, .18], green);
  const remoteRequest = box(art.root, [door[0] + .36, door[1] + 2.67, door[2] + .3], [.23, .13, .18], amber);
  const chair = new THREE.Group(); chair.name = 'ValleyEveningChair'; art.root.add(chair);
  box(chair, [0, .46, 0], [.52, .12, .48], gold);
  box(chair, [0, .79, -.24], [.53, .61, .08], gold);
  for (const x of [-.19, .19]) for (const z of [-.17, .17]) box(chair, [x, .22, z], [.076, .44, .076], mat);

  const drillCart = new THREE.Group(); drillCart.name = 'ValleyDrillCart'; art.root.add(drillCart);
  box(drillCart, [0, .44, 0], [1.48, .16, .98], gold);
  box(drillCart, [0, .71, 0], [1.15, .44, .71], mat);
  const wheel = new THREE.CylinderGeometry(.22, .22, .16, 10).rotateX(Math.PI / 2);
  for (const x of [-.49, .49]) for (const z of [-.45, .45]) {
    const mesh = new THREE.Mesh(wheel, mat); mesh.position.set(x, .24, z); drillCart.add(mesh);
  }

  const crew = createSettlementNpcs([
    { id: 'valley_night_worker', role: ['末班工人','Last worker'], region: 'alpha', position: brace, appearance: { coat: 0x676e56, carry: 'sack' }, lines: [] },
    { id: 'valley_drill_observer', role: ['外勤观测员','Field observer'], region: 'alpha', position: drill, appearance: { coat: 0x846147, carry: 'sack' }, lines: [] },
  ]);
  art.root.add(crew.group);
  const worker = crew.group.getObjectByName('Resident_valley_night_worker')!;
  const observer = crew.group.getObjectByName('Resident_valley_drill_observer')!;
  let done: ReadonlySet<string> = new Set(), escape = 0, cartTravel = 0, observerTravel = 0;
  function placedBetween(a: Point, b: Point, t: number): Point {
    const x = THREE.MathUtils.lerp(a[0], b[0], t), z = THREE.MathUtils.lerp(a[2], b[2], t);
    const y = THREE.MathUtils.lerp(a[1], b[1], t);
    return [x, ground(x, z, y + .65) ?? y, z];
  }
  const workerStart = floor([brace[0] - 2, brace[1], brace[2] + .5]);
  const workerEnd = floor([checkpoint[0] + .7, checkpoint[1], checkpoint[2] + .7]);
  const cartFrom = floor(town(-9, 0, 13)), cartTo = floor(town(-5.5, 0, 11.3));
  const personFrom = floor(town(-3, 0, 13.4)), personTo = floor(town(-4.8, 0, 8.9));

  function placeCrew() {
    crew.pose('valley_night_worker', placedBetween(workerStart, workerEnd, escape), Math.PI / 2);
    crew.pose('valley_drill_observer', placedBetween(personFrom, personTo, observerTravel), Math.PI);
    drillCart.position.fromArray(placedBetween(cartFrom, cartTo, cartTravel));
  }
  function apply(flags: ReadonlySet<string>) {
    done = flags;
    if (!done.has(F.nightBrace)) escape = 0;
    else if (done.has(F.nightDone)) escape = 1;
    if (!done.has(F.drillBeacon)) { cartTravel = 0; observerTravel = 0; }
    else if (done.has(F.drillDone)) { cartTravel = 1; observerTravel = 1; }
    bridgeGate.model.visible = bridgeGate.collider.enabled = done.has(F.nightStart) && !nightAuthorityOpen(done);
    localDoor.model.visible = localDoor.collider.enabled = done.has(F.doorPower) && !done.has(F.doorLoad) && (!done.has(F.doorNear) || done.has(F.doorFar));
    watch.visible = !done.has(F.dimWatch);
    gatePower.visible = done.has(F.doorPower); remoteRequest.visible = done.has(F.doorRequest) && !done.has(F.doorLoad);
    replayLight.visible = done.has(F.replay); relayLight.visible = done.has(F.replay) && !done.has(F.disconnect);
    art.layers.get('briefed')!.visible = !done.has(F.nightDone);
    art.layers.get('resolved')!.visible = done.has(F.nightDone);
    art.layers.get('choiceA')!.visible = done.has(F.roofSight);
    drillCart.visible = done.has(F.drillBeacon);
    chair.position.set(chairSpot[0] + (done.has(F.chair) ? 2.1 : .9), chairSpot[1], chairSpot[2] - (done.has(F.chair) ? 1.35 : .45));
    placeCrew();
  }
  function update(dt: number, player: THREE.Vector3) {
    let moving = false;
    if (done.has(F.nightBrace) && escape < 1 && Math.hypot(player.x - brace[0], player.z - brace[2]) < 85) {
      escape = Math.min(1, escape + dt / 4.6); moving = true;
    }
    if (done.has(F.drillBeacon) && (cartTravel < 1 || observerTravel < 1)) {
      cartTravel = Math.min(1, cartTravel + dt / (done.has(F.drillCart) ? 3.5 : 14));
      observerTravel = Math.min(1, observerTravel + dt / (done.has(F.drillObserver) ? 3.5 : 17));
      moving = true;
    }
    if (moving) placeCrew();
    crew.update(dt, player);
    worker.visible &&= done.has(F.nightStart);
    observer.visible &&= done.has(F.drillBeacon);
  }

  return {
    root: art.root, markers, colliders: [{ name: 'ValleyFieldworkFixtures', bvh: new MeshBVH(fixed), enabled: true }, ...gates],
    patrol, apply, update,
    workerSafe: () => escape >= 1,
    drillReady: () => cartTravel >= 1 && observerTravel >= 1,
    dispose() {
      crew.dispose();
      const geometries = new Set([fixed, ...gates.map(collider => collider.bvh.geometry)]);
      art.root.traverse(node => { if (node instanceof THREE.Mesh) geometries.add(node.geometry); });
      geometries.forEach(geometry => geometry.dispose());
      for (const material of [...Object.values(art.materials), mat, gold, green, amber]) material.dispose();
      for (const gate of gates) gate.enabled = false;
      art.root.removeFromParent();
    },
  };
}
