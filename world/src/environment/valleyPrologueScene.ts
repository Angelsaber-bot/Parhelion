import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import { mergeParts } from '../settlements/merge';
import type { PlacedNpcSocket, SettlementPlacement } from '../settlements/types';
import { SiteArt } from '../story/campaignSites';
import { PROLOGUE_LABELS, VALLEY_PROLOGUE as P, type ValleyPrologueStage } from '../story/valleyPrologue';

type Point = [number, number, number];

export function createValleyPrologueScene(residence: SettlementPlacement, ground: (x: number, z: number) => number | null) {
  const [ox, oy, oz] = residence.position;
  const court = (x: number, y: number, z: number): Point => [ox + x, oy + y, oz + z];
  const floor = (x: number, z: number): Point => [x, ground(x, z) ?? 10, z];
  const [bx, by, bz] = floor(-47, 244);
  const bay = (x: number, y: number, z: number): Point => [bx + x, by + y, bz + z];
  const radio = floor(-63, 234);
  const workerInside = bay(0, .04, -.95);
  const workerSafe = bay(0, .04, 4.1);
  const cartStart = court(7.3, .025, 3.8);
  const cartEnd = court(7.3, .025, 8.9);
  const art = new SiteArt();
  const slate = '#394d59', cream = '#ccd1c6', amber = '#eca64d', steel = '#75848a', dark = '#253540';

  for (const dx of [-.46, .46]) {
    art.box(court(7.3 + dx, .043, 6.6), [.065, .065, 7.15], steel, false, 'metal');
    art.box(court(7.3 + dx, .13, 10.15), [.18, .22, .18], slate);
  }
  art.box(court(7.3, .068, 9.45), [1.3, .11, .3], amber);
  art.box(court(7.3, .32, 9.45), [1.3, .38, .15], amber, false, 'resolved');
  art.box(court(8.25, .51, 9.45), [.18, 1, .24], slate, true);
  art.box(court(8.25, 1.05, 9.45), [.32, .14, .28], amber);

  const [rx, ry, rz] = radio;
  art.box([rx, ry + .51, rz - .65], [1.1, 1.02, .58], slate, true);
  art.box([rx, ry + 1.08, rz - .65], [1.22, .18, .65], cream);
  art.box([rx - .19, ry + 1.22, rz - .65], [.54, .14, .34], dark);
  art.box([rx - .19, ry + 1.296, rz - .66], [.41, .018, .16], amber);
  art.beam([rx + .42, ry + 1.1, rz - .85], [rx + .48, ry + 2.1, rz - .87], .04, steel);

  // The grated front lets the player see the worker and platform. The solid
  // return walls hide the bypass pin until the player comes around the east side.
  for (const x of [-3, 3]) {
    art.box(bay(x, 1.25, -.85), [.22, 2.5, 6.1], slate, true);
    art.box(bay(x, 2.58, -.85), [.34, .16, 6.2], cream);
  }
  art.box(bay(0, 1.25, -3.9), [6.2, 2.5, .22], slate, true);
  for (const side of [-1, 1]) {
    for (const x of [1.17, 1.57, 1.97, 2.37, 2.77]) art.box(bay(x * side, 1.18, 2.2), [.075, 2.36, .12], steel, true);
    art.box(bay(side * 1.98, .48, 2.2), [2.08, .96, .14], slate, true);
    art.box(bay(side * 1.98, 2.39, 2.2), [2.14, .11, .18], cream);
  }
  art.box(bay(0, 2.42, 2.2), [1.94, .18, .2], slate);
  art.box(bay(-1.72, .57, 2.55), [.57, 1.14, .34], slate, true);
  art.box(bay(-1.72, 1.16, 2.58), [.34, .1, .2], '#d17552');
  art.box(bay(1.73, .57, 2.55), [.48, 1.14, .36], slate, true);
  art.box(bay(1.73, 1.16, 2.55), [.32, .1, .23], amber);
  art.box(bay(3.12, 1.25, -1.65), [.15, .91, .84], dark);
  for (const z of [-1.93, -1.37]) art.box(bay(3.22, 1.25, z), [.12, .8, .09], amber);
  art.box(bay(2.64, .56, 4.4), [1.6, 1.12, .63], slate, true);
  art.box(bay(2.64, 1.13, 4.4), [1.73, .09, .78], cream);
  art.paper(bx + 2.62, by + 1.18, bz + 4.4, .62, .4);
  art.box(bay(0, .035, 3.77), [1.72, .05, .15], amber);
  art.box(bay(0, .04, 2.21), [1.82, .065, .18], cream, false, 'choiceA');
  art.box(bay(0, 2.57, 2.31), [.44, .12, .14], '#ca6852', false, 'briefed');
  art.box(bay(0, 2.57, 2.31), [.44, .12, .14], '#7ab991', false, 'choiceA');
  art.finish('alpha');
  art.root.name = 'ValleyPrologue';

  const cartArt = new SiteArt();
  cartArt.box([0, .36, 0], [1.15, .18, 1.45], slate);
  cartArt.box([-.18, .55, -.12], [.53, .21, .58], amber);
  cartArt.box([.22, .52, .34], [.4, .15, .49], steel);
  cartArt.beam([-.5, .35, -.66], [-.5, .93, -.83], .06, steel);
  cartArt.beam([.5, .35, -.66], [.5, .93, -.83], .06, steel);
  cartArt.beam([-.5, .93, -.83], [.5, .93, -.83], .06, dark);
  for (const dx of [-.5, .5]) for (const dz of [-.5, .5]) {
    cartArt.cyl([dx, .17, dz], .16, .12, dark, false, 'body', [0, 0, Math.PI / 2]);
  }
  cartArt.finish('alpha');
  const cart = cartArt.root;
  cart.name = 'PrologueToolCart';
  art.root.add(cart);

  const material = new THREE.MeshStandardMaterial({ color: slate, roughness: .75 });
  const pinMaterial = new THREE.MeshStandardMaterial({ color: amber, emissive: amber, emissiveIntensity: .28 });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(4.75, .25, 1.4), material);
  platform.name = 'PrologueServicePlatform';
  platform.position.fromArray(bay(0, 1.2, -2.8));
  const gate = new THREE.Group();
  gate.name = 'PrologueEscapeGate';
  gate.position.fromArray(bay(0, 0, 2.2));
  const barGeometry = new THREE.BoxGeometry(.08, 2.35, .12);
  for (const x of [-.86, -.57, -.29, 0, .29, .57, .86]) {
    const bar = new THREE.Mesh(barGeometry, material);
    bar.position.set(x, 1.175, 0);
    gate.add(bar);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.82, .12, .16), material);
  rail.position.y = 1.43;
  gate.add(rail);
  const pin = new THREE.Mesh(new THREE.BoxGeometry(.26, .52, .27), pinMaterial);
  pin.name = 'TGT_ValleyProloguePin';
  pin.userData.target = P.pin;
  pin.position.fromArray(bay(3.36, 1.25, -1.65));
  art.root.add(platform, gate, pin);

  const solid = mergeParts(art.solids);
  art.solids.forEach(geometry => geometry.dispose());
  const gateSolid = new THREE.BoxGeometry(1.82, 2.36, .16).translate(...bay(0, 1.18, 2.2));
  const gateCollider: Collider = { name: 'VALLEY_PrologueEscapeGate', bvh: new MeshBVH(gateSolid), enabled: true };
  const colliders: Collider[] = [{ name: 'VALLEY_PrologueFixtures', bvh: new MeshBVH(solid), enabled: true }, gateCollider];

  function marker(id: keyof typeof PROLOGUE_LABELS, p: Point, radius = 1.85): Marker {
    return { id, type: 'interact', label: PROLOGUE_LABELS[id][0], p, radius };
  }
  const cartReturn = marker(P.cartReturn, [...cartStart]);
  const markers = [marker(P.cartStop, court(8.25, 1.08, 9.77)), cartReturn,
    marker(P.radio, [rx, ry + 1.1, rz]), marker(P.survey, bay(0, 1.08, 3.5)),
    marker(P.breaker, bay(-1.72, 1.13, 2.89)), marker(P.ratchet, bay(1.73, 1.13, 2.92)),
    marker(P.record, bay(2.64, 1.12, 4.81), 1.95)];
  const targets = [pin];
  const spawn: Marker = { id: 'valley_prologue_spawn', type: 'spawn', label: '归灯镇 · 生活馆', p: court(.4, .05, 5) };
  const radioSpawn: Marker = { id: 'valley_prologue_field_spawn', type: 'spawn', label: '工坊北侧', p: [rx - 2, ry, rz + 1] };
  const npcs: PlacedNpcSocket[] = [
    { id: P.apprentice, region: 'alpha', role: ['阿舟', 'Azhou'], position: court(9.9, .025, 5.7), yaw: -1.3,
      appearance: { coat: 0x688e99, trim: 0x334c63 }, lines: [['屋顶那条信号线是我自己接的。你回来记得试试。', 'I wired the rooftop signal line myself. Try it when you get back.']] },
    { id: P.worker, region: 'alpha', role: ['顾桥', 'Gu Qiao'], position: workerInside, yaw: 0,
      appearance: { coat: 0xb69352, trim: 0x465360 }, lines: [['电锁松开以后，先撑住平台。我能自己走。', 'Once the lock releases, brace the platform. I can walk out.']] },
  ];

  let stage: ValleyPrologueStage = 'briefing';
  let cartTravel = 0, platformDrop = 0, escape = 0;
  let cartStopped = false, workerMoved = false;
  function placeCart() {
    cart.position.set(cartStart[0], cartStart[1], THREE.MathUtils.lerp(cartStart[2], cartEnd[2], cartTravel));
    cartReturn.p[0] = cart.position.x - .88;
    cartReturn.p[1] = cart.position.y + .58;
    cartReturn.p[2] = cart.position.z;
  }
  function apply(next: ValleyPrologueStage, done: ReadonlySet<string>, initial = false) {
    const previous = stage;
    stage = next;
    if (next === 'briefing') { cartTravel = 0; platformDrop = 0; escape = 0; }
    if (initial && next === 'cart') cartTravel = 1;
    cartStopped = done.has(P.cartStop);
    if (next !== 'cart') cartTravel = cartStopped ? .94 : 0;
    if (initial && (next === 'secure' || next === 'record' || next === 'complete')) platformDrop = 1;
    if (next === 'record' && previous === 'secure') platformDrop = 1;
    if (initial && (next === 'record' || next === 'complete')) escape = 1;
    pin.visible = next === 'release';
    gateCollider.enabled = next !== 'record' && next !== 'complete' && next !== 'legacy';
    gate.visible = gateCollider.enabled;
    art.layers.get('resolved')!.visible = cartStopped;
    art.layers.get('briefed')!.visible = next === 'release' || next === 'secure';
    art.layers.get('choiceA')!.visible = next === 'record' || next === 'complete';
    placeCart();
    platform.rotation.z = platformDrop * -.16;
    art.root.updateMatrixWorld(true);
  }
  const activeMarkers: Partial<Record<ValleyPrologueStage, readonly string[]>> = {
    cart: [P.cartStop, P.cartReturn], radio: [P.radio], survey: [P.survey],
    release: [P.breaker], secure: [P.ratchet], record: [P.record],
  };
  const markerIds = new Set<string>(markers.map(marker => marker.id));
  function update(dt: number, poseWorker: (id: string, position: Point, yaw: number) => boolean) {
    if (stage === 'briefing' && workerMoved) { poseWorker(P.worker, workerInside, 0); workerMoved = false; }
    if (stage === 'cart' && cartTravel < 1) { cartTravel = Math.min(1, cartTravel + dt / 4.5); placeCart(); }
    if (stage === 'secure' && platformDrop < 1) { platformDrop = Math.min(1, platformDrop + dt / 2); platform.rotation.z = platformDrop * -.16; }
    if ((stage === 'record' || stage === 'complete') && (!workerMoved || escape < 1)) {
      escape = Math.min(1, escape + dt / 2.8);
      const position: Point = [workerInside[0], workerInside[1], THREE.MathUtils.lerp(workerInside[2], workerSafe[2], escape)];
      poseWorker(P.worker, position, 0);
      workerMoved = true;
    }
  }
  return { root: art.root, colliders, markers, targets, npcs, spawn, radioSpawn, apply, update,
    workerClear: () => escape >= 1,
    ownsMarker: (id: string) => markerIds.has(id),
    markerActive: (id: string) => activeMarkers[stage]?.includes(id) ?? false,
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>([solid, gateSolid]);
      art.root.traverse(node => { if (node instanceof THREE.Mesh) geometries.add(node.geometry); });
      geometries.forEach(geometry => geometry.dispose());
      [...Object.values(art.materials), ...Object.values(cartArt.materials), material, pinMaterial].forEach(value => value.dispose());
      colliders.forEach(collider => { collider.enabled = false; });
      art.root.removeFromParent();
    },
  };
}
