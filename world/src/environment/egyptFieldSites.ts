import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import { createSettlementNpcs } from '../settlements/npcs';
import type { SiteArt } from '../story/campaignSites';
import { climaxMarker } from '../story/realmClimaxes';
import { JOURNEY } from '../story/worldJourney';
import {
  EGYPT_MAIL as EM, EGYPT_REED_RACE as ER, EGYPT_SHIP_HINGE as EH, EGYPT_REVERSE_WHEEL as EW,
  EGYPT_HERD as EG, EGYPT_THRONE as ET, FIELD_SIDE_STEPS, fieldSideReady,
} from '../story/fieldSideStories';

type Point = [number, number, number];
type Region = Parameters<SiteArt['finish']>[0];
type Apply = (done: ReadonlySet<string>, dt: number, player: THREE.Vector3) => void;
type FieldAuthoring = {
  place(guess: Point, range?: number): Point | null;
  interact(id: string, point: Point): void;
  scenery(name: string): SiteArt;
  finish(art: SiteArt, region: Region, solid?: boolean): Collider | null;
  table(art: SiteArt, p: Point, color?: string): void;
  mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, p: Point, name?: string): THREE.Mesh;
  group(parent: THREE.Object3D, p: Point, name: string): THREE.Group;
  walkway(name: string, region: Region, points: [Point, Point], width: number, color: string, enabled: boolean, rails?: boolean): { art: SiteArt; collider: Collider };
  ground(x: number, z: number, ceiling: number): number | null;
  materials: Record<'wood' | 'dark' | 'red' | 'blue' | 'metal' | 'beacon', THREE.MeshStandardMaterial>;
  prior: ReadonlyMap<string, Marker>;
  markers: Marker[];
  colliders: Collider[];
  targets: THREE.Mesh[];
  updates: Apply[];
  actorCleanup: (() => void)[];
};
const offset = (p: Point, x = 0, y = 0, z = 0): Point => [p[0] + x, p[1] + y, p[2] + z];
const wood = '#73513d', faded = '#9b7961', bronze = '#a78955';

export function createEgyptFieldSites({ place, interact, scenery, finish, table, mesh, group, walkway, ground,
  materials, prior, markers, colliders, targets, updates, actorCleanup }: FieldAuthoring) {
  const sandFlag = place([41, 10, -1588], 15);
  const mailStern = sandFlag && place(offset(sandFlag, 3.8, 0, -6.7), 10.5);
  const salvage = sandFlag && place(offset(sandFlag, -4.1, 0, 4.8), 9);
  const mailTable = place([151, 14, -1554], 12);
  if (sandFlag && mailStern && salvage && mailTable) {
    interact(EM.flag, sandFlag); interact(EM.locker, mailStern); interact(EM.late, salvage); interact(EM.return, mailTable);
    const art = scenery('EgyptOverturnedMailboat');
    const [x, y, z] = mailStern;
    const vessel = group(art.root, [x, y, z - 2.2], 'EgyptInvertedMailHull');
    for (let i = 0; i < 9; i++) {
      const a = -1.33 + i * 2.66 / 8;
      const rib = mesh(vessel, new THREE.BoxGeometry(.46, .19, 5.63 - Math.abs(a) * .61), materials.wood,
        [Math.sin(a) * 1.82, 1.12 + Math.cos(a) * 1.53, -.24]);
      rib.rotation.z = -a;
    }
    for (const side of [-1, 1]) art.box([x + side * 1.7, y + .85, z - 2.12], [.21, 1.7, 5.43], faded, true);
    art.box([x, y + 2.57, z - 2.12], [2.66, .18, 5.51], wood, true);
    const shutter = mesh(art.root, new THREE.BoxGeometry(2.88, 2.1, .14), materials.wood, [x, y + 1.04, z - 4.76], 'EgyptMailHoldLatch');
    const closed = { name: 'COL_EgyptMailHoldLatch', bvh: new MeshBVH(shutter.geometry.clone().translate(...shutter.position.toArray())), enabled: true };
    colliders.push(closed);
    art.beam(offset(sandFlag, .32, 0, -.79), offset(sandFlag, 1.12, 1.71, -.79), .061, wood);
    mesh(art.root, new THREE.BoxGeometry(.77, .54, .04), materials.red, offset(sandFlag, 1.25, 1.63, -.79), 'EgyptBuriedMailFlag');
    table(art, salvage); table(art, mailTable);
    art.paper(...offset(mailTable, -.39, .915, -.85), .43, .31);
    const bag = new THREE.SphereGeometry(.31, 12, 8).scale(1, .61, .77);
    const hold = mesh(art.root, bag, materials.blue, [x + .82, y + .33, z - 1.26], 'EgyptMailHoldBag');
    const rack = mesh(art.root, bag, materials.blue, offset(salvage, .2, .96, -.86), 'EgyptSalvageRackBag');
    const posted = mesh(art.root, new THREE.BoxGeometry(.55, .037, .33), materials.beacon, offset(mailTable, .3, .93, -.86), 'EgyptDeliveredMail');
    const shortcut = walkway('EgyptMailBoatShortcut', 'alpha', [[x, y + .045, z - 4.87], [x, y + .19, z - 7.1]], 2.45, faded, false, false);
    finish(art, 'alpha');
    updates.push(done => {
      const recovered = done.has(EM.locker) || done.has(EM.late), late = done.has(JOURNEY.egyptDone);
      shutter.position.y = y + (recovered || late ? 3.45 : 1.04);
      closed.enabled = !(recovered || late);
      hold.visible = !recovered && !late; rack.visible = !recovered && late;
      shortcut.art.root.visible = shortcut.collider.enabled = recovered || late;
      posted.visible = done.has(EM.return);
    });
  }

  let startReeds: ((guess: 'short' | 'long', first: boolean) => boolean) | null = null;
  let reedResult: { won: boolean; first: boolean } | null = null;
  const reeds = place([190, 14, -1579], 13.5);
  const reedFinish = reeds && place(offset(reeds, -.3, 0, -6.8), 9);
  if (reeds && reedFinish) {
    interact(ER.meet, reeds); interact(ER.race, reeds); interact(ER.again, reeds); interact(ER.prize, reedFinish);
    const art = scenery('EgyptReedRaceChannels');
    const from = new THREE.Vector3(...offset(reeds, 1.32, .35, -.61));
    const to = new THREE.Vector3(...offset(reedFinish, 1.36, .31, -.62));
    const side = new THREE.Vector3(from.z - to.z, 0, to.x - from.x).normalize();
    const curves = [-.39, .46].map((lane, i) => new THREE.CatmullRomCurve3([
      from.clone().addScaledVector(side, lane),
      from.clone().lerp(to, .46).addScaledVector(side, lane + (i ? .8 : 0)),
      to.clone().addScaledVector(side, lane),
    ]));
    const waterMaterial = new THREE.MeshStandardMaterial({ color: '#5e999a', roughness: .35, metalness: .25 });
    const chips = curves.map((curve, i) => {
      for (let j = 0; j < 9; j++) {
        const a = curve.getPoint(j / 9), b = curve.getPoint((j + 1) / 9), v = b.clone().sub(a);
        const center = a.lerp(b, .5).toArray();
        const angle = Math.atan2(v.x, v.z);
        art.box(offset(center, 0, -.11), [.53, .2, v.length() + .12], '#a99170', false, 'body', [0, angle, 0]);
        mesh(art.root, new THREE.BoxGeometry(.41, .026, v.length() + .08), waterMaterial, center).rotation.y = angle;
      }
      const chip = group(art.root, curve.getPoint(0).toArray(), 'EgyptRacingReed_' + i);
      mesh(chip, new THREE.BoxGeometry(.056, .043, .36), materials.wood, [0, .055, 0]);
      mesh(chip, new THREE.BoxGeometry(.15, .13, .035), i ? materials.red : materials.blue, [0, .15, -.057]);
      return chip;
    });
    const charm = mesh(art.root, new THREE.TorusGeometry(.14, .035, 8, 17), materials.beacon, offset(reedFinish, -.55, .46, -.86), 'EgyptWovenReedCharm');
    finish(art, 'alpha');
    let race: { t: number; faster: number; guess: number; first: boolean } | null = null;
    let runs = 0;
    startReeds = (guess, first) => {
      if (race || reedResult) return false;
      race = { t: 0, faster: runs % 2 === 0 ? 1 : 0, guess: guess === 'long' ? 1 : 0, first };
      runs++;
      return true;
    };
    updates.push((done, dt, player) => {
      charm.visible = done.has(ER.prize);
      if (!race || Math.hypot(player.x - reeds[0], player.z - reeds[2]) > 38) return;
      race.t += dt;
      for (const [i, chip] of chips.entries()) {
        const elapsed = Math.min(1, race.t / (i === race.faster ? 3.35 : 4.62));
        curves[i].getPointAt(elapsed, chip.position);
        const tangent = curves[i].getTangentAt(elapsed);
        chip.rotation.y = Math.atan2(tangent.x, tangent.z);
      }
      if (race.t >= 4.62) {
        reedResult = { won: race.guess === race.faster, first: race.first };
        race = null;
      }
    });
  }

  let shieldsWave = (_a: { x: number; y: number; z: number }, _b: THREE.Vector3) => false;
  const hingeStall = place([173, 14, -1558], 13.5);
  const confluence = prior.get(climaxMarker('egypt', 'start'))?.p;
  const shieldStand = confluence && place(offset(confluence, 4.1, -.92, 4.4), 9);
  if (hingeStall && shieldStand) {
    interact(EH.inspect, hingeStall); interact(EH.brace, hingeStall); interact(EH.shutter, shieldStand);
    const art = scenery('EgyptSolarBoatFoldingShield');
    const panel = group(art.root, offset(hingeStall, .82, .53, -1.02), 'EgyptHingeFoldedPanel');
    mesh(panel, new THREE.BoxGeometry(1.75, .14, .9), materials.wood, [0, .48, 0]);
    for (const x of [-.75, .73]) mesh(panel, new THREE.BoxGeometry(.13, .18, .94), materials.metal, [x, .49, 0]);
    const pin = mesh(art.root, new THREE.CylinderGeometry(.15, .15, .32, 12).rotateX(Math.PI / 2), materials.beacon,
      offset(hingeStall, .53, .83, -.58), 'EgyptRustedHingePin');
    pin.userData.target = EH.pin;
    targets.push(pin);
    markers.push({ id: EH.pin, type: 'objective', p: pin.position.toArray(), label: FIELD_SIDE_STEPS.get(EH.pin)!.label[0] });
    const [x, y, z] = offset(shieldStand, 0, 0, -1.38);
    const shutter = group(art.root, [x, y + .1, z], 'EgyptConfluenceFoldingShield');
    mesh(shutter, new THREE.BoxGeometry(3.16, 1.77, .18), materials.wood, [0, .9, 0]);
    for (const dx of [-1.2, 1.2]) mesh(shutter, new THREE.BoxGeometry(.19, 1.92, .24), materials.metal, [dx, .9, 0]);
    const collider = { name: 'COL_EgyptConfluenceFoldingShield', bvh: new MeshBVH(new THREE.BoxGeometry(3.16, 1.8, .18).translate(x, y + .98, z)), enabled: false };
    colliders.push(collider);
    finish(art, 'alpha');
    shieldsWave = (a, b) => {
      if (!collider.enabled || a.z === b.z) return false;
      const f = (z - a.z) / (b.z - a.z), across = THREE.MathUtils.lerp(a.x, b.x, f);
      return f > 0 && f < 1 && Math.abs(across - x) < 1.57 && Math.abs(b.y - y) < 1.35;
    };
    updates.push((done, dt) => {
      pin.visible = fieldSideReady(EH.pin, done);
      panel.rotation.z = THREE.MathUtils.damp(panel.rotation.z, done.has(EH.brace) ? 0 : .67, 6, dt);
      shutter.visible = done.has(EH.brace);
      collider.enabled = shutter.visible && done.has(EH.coverOpen);
      shutter.rotation.x = collider.enabled ? 0 : -Math.PI / 2;
    });
  }

  const wheelBase = place([57, 15.5, -1451], 13.5);
  const wheelFoot = wheelBase && place(offset(wheelBase, 4.3, 0, 1), 6);
  const wheelExit = wheelBase && place(offset(wheelBase, -8.2, 0, -4.7), 9);
  if (wheelBase && wheelFoot && wheelExit) {
    const roof = offset(wheelBase, -.4, 2.08, -2.12);
    interact(EW.trace, wheelBase); interact(EW.ladder, roof);
    interact(EW.baffle, offset(roof, -1.6, 0, -.62)); interact(EW.view, wheelExit);
    const art = scenery('EgyptOldIrrigationWheel');
    art.box(offset(roof, 0, -.15), [5.2, .3, 3.25], wood, true);
    for (const x of [-2.21, 2.21]) for (const z of [-1.23, 1.23])
      art.box(offset(roof, x, -1.14, z), [.24, 2.27, .24], '#93816b', true);
    const wheel = group(art.root, offset(wheelBase, .9, 1.19, -.55), 'EgyptReverseWheel');
    mesh(wheel, new THREE.TorusGeometry(1.16, .086, 9, 26), materials.dark, [0, 0, 0]);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * 2 * Math.PI;
      mesh(wheel, new THREE.BoxGeometry(.074, 1.06, .082), materials.wood, [Math.sin(a) * .51, Math.cos(a) * .51, 0]).rotation.z = -a;
      mesh(wheel, new THREE.BoxGeometry(.31, .16, .42), materials.wood, [Math.sin(a) * 1.11, Math.cos(a) * 1.11, 0]).rotation.z = -a;
    }
    const gate = mesh(art.root, new THREE.BoxGeometry(.51, .64, .13), materials.beacon, offset(roof, -1.73, .51, -1.34), 'EgyptHighChannelBaffle');
    walkway('EgyptWheelServiceRamp', 'alpha', [offset(wheelFoot, 0, .045), offset(roof, 2.62, .025, .59)], 2.03, faded, true, false);
    const crossing = walkway('EgyptHighChannelShortcut', 'alpha', [offset(roof, -2.66, .035, -.62), offset(wheelExit, 0, .06)], 2.03, faded, false);
    finish(art, 'alpha');
    let speed = -.95;
    updates.push((done, dt, p) => {
      const redirected = done.has(EW.baffle);
      crossing.art.root.visible = crossing.collider.enabled = redirected;
      gate.rotation.y = redirected ? 1.2 : 0;
      if (Math.hypot(p.x - wheelBase[0], p.z - wheelBase[2]) < 88) {
        speed = THREE.MathUtils.damp(speed, redirected ? 1.36 : -.95, 4, dt);
        wheel.rotation.z += speed * dt;
      }
    });
  }

  let herdSafe = false;
  const herdBank = place([82, 10.2, -1596], 15);
  const herdRope = herdBank && place(offset(herdBank, 5.2, 0, -.6), 7.5);
  const pen = herdRope && place(offset(herdRope, 8.3, .5, -.4), 10.5);
  const herdSupply = pen && place(offset(pen, .1, 0, 3.8), 6);
  const newPen = place([156, 14.1, -1544], 13.5);
  if (herdBank && herdRope && pen && herdSupply && newPen) {
    interact(EG.bell, herdBank); interact(EG.rig, herdRope); interact(EG.settle, pen); interact(EG.supplies, herdSupply);
    const art = scenery('EgyptHerdUphill');
    const [a, b] = [offset(herdRope, 0, .055), offset(pen, 0, .055)];
    const bridge = walkway('EgyptHerdFloatBridge', 'alpha', [a, b], 2.69, faded, false, false);
    for (const p of [a, b]) {
      art.box(offset(p, 0, .48, -1.17), [.22, .96, .22], wood, true);
      art.ring(offset(p, 0, .68, -1.04), .145, .033, bronze, 'metal');
    }
    const float = mesh(art.root, new THREE.BoxGeometry(2.5, .16, 1.22), materials.wood, offset(herdRope, -.47, -.08, -1.78), 'EgyptUnriggedHerdFloat');
    const buildPen = (p: Point) => {
      for (const dx of [-2.1, -1.08, .13, 1.29, 2.43]) {
        art.box(offset(p, dx, .47, -1.68), [.12, .95, .13], faded);
        if (dx < 2) art.box(offset(p, dx + .57, .61, -1.69), [1.15, .09, .11], wood);
      }
    };
    buildPen(pen); buildPen(newPen);
    const herder = createSettlementNpcs([
      { id: 'egypt_river_herder', region: 'alpha', worldRegion: 'egypt', position: offset(herdBank, .82, 0, -.72),
        role: ['河岸牧人', 'River herder'], appearance: { coat: 0x9b7657, trim: 0x577c76 }, lines: [] },
    ]);
    art.root.add(herder.group); actorCleanup.push(() => herder.dispose());
    const bottle = mesh(art.root, new THREE.SphereGeometry(.165, 10, 9).scale(1, 1.41, .6), materials.blue,
      offset(herdSupply, -.46, .98, -.82), 'EgyptHerderWaterskin');
    table(art, herdSupply);
    const fur = [new THREE.MeshStandardMaterial({ color: '#cbb28b' }), new THREE.MeshStandardMaterial({ color: '#7c604e' })];
    const goats = Array.from({ length: 3 }, (_, i) => {
      const animal = group(art.root, offset(herdBank, .85 + .44 * i, 0, 1.38 + i * .41), 'EgyptUphillGoat_' + i);
      const coat = fur[i % 2], body = new THREE.SphereGeometry(1, 12, 9);
      mesh(animal, body, coat, [0, .57, 0]).scale.set(.25, .23, .54);
      const head = mesh(animal, body, coat, [0, .74, .44]);
      head.scale.set(.13, .15, .24); head.rotation.x = .27;
      for (const side of [-1, 1]) {
        mesh(animal, new THREE.ConeGeometry(.044, .195, 6), materials.metal, [side * .076, .91, .39]).rotation.x = -.52;
        mesh(animal, new THREE.SphereGeometry(.042, 7, 5), materials.dark, [side * .122, .78, .51]);
      }
      const legs = [];
      for (const x of [-.147, .147]) for (const z of [-.27, .31]) {
        const joint = group(animal, [x, .43, z], 'GoatLegJoint');
        mesh(joint, new THREE.BoxGeometry(.083, .43, .091), coat, [0, -.21, 0]);
        legs.push(joint);
      }
      return { animal, start: animal.position.clone(), legs };
    });
    finish(art, 'alpha');
    let walk = 0, started = false, clock = 0;
    updates.push((done, dt, player) => {
      const rigged = done.has(EG.rig), finished = done.has(EG.settle), moved = finished && done.has(JOURNEY.egyptDone);
      bridge.art.root.visible = bridge.collider.enabled = rigged;
      float.visible = !rigged;
      bottle.visible = finished && !done.has(EG.supplies);
      if (!rigged) walk = 0;
      else if (finished || !started) walk = 1;
      else if (Math.hypot(player.x - pen[0], player.z - pen[2]) < 80) walk = Math.min(1, walk + dt / 6.4);
      herdSafe = walk >= 1;
      started = true;
      const area = moved ? newPen : pen;
      if (Math.hypot(player.x - area[0], player.z - area[2]) > 120) return;
      clock += dt;
      const person = moved ? offset(newPen, 1.6, 0, -.35) : walk >= 1 ? offset(pen, 1.65, 0, -.65) : offset(herdBank, .82, 0, -.72);
      herder.pose('egypt_river_herder', person, .32);
      herder.update(dt, player);
      for (const [i, { animal, start, legs }] of goats.entries()) {
        const t = THREE.MathUtils.smoothstep(walk, i * .07, .84 + i * .075);
        const target = moved ? offset(newPen, -.62 + i * .65, 0, .34 + i * .23) : offset(pen, -.25, 0, .17 + i * .39);
        const x = THREE.MathUtils.lerp(start.x, target[0], t), z = THREE.MathUtils.lerp(start.z, target[2], t);
        const y = THREE.MathUtils.lerp(start.y, target[1], t);
        const stepping = rigged && t > 0 && t < 1;
        if (animal.position.x !== x || animal.position.z !== z) animal.position.set(x, ground(x, z, y + .85) ?? y, z);
        animal.rotation.y = stepping ? Math.atan2(target[0] - start.x, target[2] - start.z) : .65 + i * .3;
        for (const [n, leg] of legs.entries()) leg.rotation.x = stepping ? Math.sin(clock * 12 + i * .43 + n * Math.PI) * .29 : 0;
      }
    });
  }

  const portico = place([-191, 25.8, -1385], 16.5);
  const throneFoot = portico && place(offset(portico, 4.8, 0, .15), 8);
  if (portico && throneFoot) {
    const seat = offset(portico, -2.4, 1.55, -2.5);
    interact(ET.colonnade, portico); interact(ET.terrace, seat); interact(ET.revisit, seat);
    const art = scenery('EgyptVacantSunThrone');
    art.box(offset(seat, 0, -.17), [5.9, .34, 4.3], '#ae906a', true);
    for (const x of [-2.54, 2.53]) for (const z of [-1.79, 1.79]) {
      art.box(offset(seat, x, -.86, z), [.34, 1.73, .34], '#9b8065', true);
      art.box(offset(seat, x, .33, z), [.25, .67, .25], '#b1976b');
    }
    art.box(offset(seat, -.68, .36, -1.08), [1.41, .73, 1.21], '#be9d69', true);
    art.box(offset(seat, -.68, 1.17, -1.58), [1.49, 1.17, .23], '#b68a58', true);
    art.ring(offset(seat, -.68, 1.68, -1.445), .32, .045, bronze);
    const board = group(art.root, offset(seat, 1.08, .9, -.98), 'EgyptTwoWaterwaySurvey');
    mesh(board, new THREE.BoxGeometry(.94, .09, .59), materials.wood, [0, 0, 0]);
    for (const n of [-1, 1]) for (let i = 0; i < 4; i++) {
      const stroke = mesh(board, new THREE.BoxGeometry(.19, .016, .043), n < 0 ? materials.blue : materials.red,
        [n * .2 + (i - 1.5) * .11, .05, n * .081 + .071 * Math.sin(i)]);
      stroke.rotation.y = n * .39 * Math.sin(i + .6);
    }
    walkway('EgyptSunThroneRamp', 'alpha', [offset(throneFoot, 0, .04), offset(seat, 3.17, .045, .72)], 2.31, faded, true, false);
    finish(art, 'alpha');
  }

  return {
    startReedRace(choice: 'short' | 'long', first: boolean) { return startReeds?.(choice, first) ?? false; },
    readReedOutcome() { const result = reedResult; reedResult = null; return result; },
    get herdSafe() { return herdSafe; },
    shieldBlocksWater(origin: { x: number; y: number; z: number }, player: THREE.Vector3) { return shieldsWave(origin, player); },
  };
}
