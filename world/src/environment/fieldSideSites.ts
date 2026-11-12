import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import { egyptToWorld } from '../map/egyptPlan';
import { qinToWorld } from '../map/qinPlan';
import { JOURNEY } from '../story/worldJourney';
import type { Collider } from '../player/player';
import { createSettlementNpcs } from '../settlements/npcs';
import { residentWalkRig } from '../settlements/residentWalk';
import { mergeParts } from '../settlements/merge';
import { SiteArt } from '../story/campaignSites';
import { HARBOR_WORKBOAT as HB } from '../story/harborRelief';
import {
  FIELD_SIDE_STEPS, FIELD_SERVICE_LABELS, ROYAL_BOAT as B, HARBOR_WAGES as W, ICE_BELL as I, KYOTO_REFLECTION as K,
  KYOTO_PASS as KP, KYOTO_PAPERLINE as KL,
  HARBOR_KEEPSAKES as HK, CAPTAINS_CHAIR as CC,
  WINTER_BREAD as WB, WINTER_SHOES as WS, WINTER_RANGE as WR,
  VALLEY_RADIO as V, SKY_MAINTENANCE as S, EGYPT_SEEDS as E, ORLEANS_SOUP as O, QIN_QUIET_ROOM as Q, fieldSideReady, harborCustomsGone,
} from '../story/fieldSideStories';
import { SKY_APPROACH_DECKS as DECK } from './skyCrownApproach';

type Point = [number, number, number];
type Ground = (x: number, z: number, ceiling: number) => number | null;
type Apply = (done: ReadonlySet<string>, dt: number, p: THREE.Vector3) => void;
const offset = (p: Point, x = 0, y = 0, z = 0): Point => [p[0] + x, p[1] + y, p[2] + z];

export function createFieldSideSites(layout: readonly Marker[], residence: Point, water: number, ground: Ground,
  clear: (p: THREE.Vector3) => boolean) {
  const root = new THREE.Group();
  root.name = 'FieldSideSites';
  const markers: Marker[] = [], colliders: Collider[] = [], targets: THREE.Mesh[] = [], updates: Apply[] = [];
  const actorCleanup: (() => void)[] = [];
  const artMaterials = new Set<THREE.Material>();
  const prior = new Map(layout.map(marker => [marker.id, marker]));
  const wood = '#73513d', faded = '#9b7961', bronze = '#a78955', steel = '#41576b', glass = '#68b5a7';
  const materials = {
    metal: new THREE.MeshStandardMaterial({ color: bronze, metalness: .59, roughness: .47 }),
    dark: new THREE.MeshStandardMaterial({ color: '#504b4c', roughness: .78 }),
    wood: new THREE.MeshStandardMaterial({ color: wood, roughness: .84 }),
    beacon: new THREE.MeshStandardMaterial({ color: glass, emissive: '#458b84', emissiveIntensity: .25 }),
    red: new THREE.MeshStandardMaterial({ color: '#902e36', roughness: .9 }),
    blue: new THREE.MeshStandardMaterial({ color: '#233b68', roughness: .9 }),
  };

  const reserved: Point[] = [];
  function place(guess: Point, range = 6, headroom = 1.8): Point | null {
    for (let distance = 0; distance <= range; distance += 1.5) {
      const samples = distance === 0 ? 1 : 12;
      for (let i = 0; i < samples; i++) {
        const a = i * Math.PI * 2 / samples;
        const x = guess[0] + Math.cos(a) * distance, z = guess[2] + Math.sin(a) * distance;
        const y = ground(x, z, guess[1] + headroom);
        if (y === null || y < water + .06 || Math.abs(y - guess[1]) > 4.2 || !clear(new THREE.Vector3(x, y + .04, z))) continue;
        if (reserved.some(point => Math.hypot(x - point[0], z - point[2]) < 2.3 && Math.abs(y - point[1]) < 2)) continue;
        if (layout.some(marker => marker.type === 'interact' && Math.hypot(x - marker.p[0], z - marker.p[2]) < 2.15 && Math.abs(y + .9 - marker.p[1]) < 2)) continue;
        const point: Point = [x, y, z]; reserved.push(point); return point;
      }
    }
    return null;
  }
  function interact(id: string, p: Point) {
    const label = FIELD_SIDE_STEPS.get(id)?.label ?? FIELD_SERVICE_LABELS.get(id)!;
    markers.push({ id, label: label[0], p: offset(p, 0, .9), radius: 2, type: 'interact' });
  }
  function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, p: Point, name?: string) {
    const node = new THREE.Mesh(geometry, material);
    node.position.set(...p);
    if (name) node.name = name;
    parent.add(node);
    return node;
  }
  function group(parent: THREE.Object3D, p: Point, name: string) {
    const node = new THREE.Group(); node.name = name; node.position.set(...p); parent.add(node); return node;
  }
  function scenery(name: string) {
    const art = new SiteArt(); art.root.name = name; return art;
  }
  function finish(art: SiteArt, region: Parameters<SiteArt['finish']>[0], solid = true) {
    const name = art.root.name;
    art.finish(region); art.root.name = name; root.add(art.root);
    for (const material of Object.values(art.materials)) artMaterials.add(material);
    if (!art.solids.length) return null;
    const geometry = mergeParts(art.solids);
    for (const g of art.solids) g.dispose();
    art.solids.length = 0;
    const collider = { name: 'COL_' + name, enabled: solid, bvh: new MeshBVH(geometry) };
    colliders.push(collider);
    return collider;
  }
  function table(art: SiteArt, p: Point, color = wood) {
    art.box(offset(p, 0, .83, -.87), [1.64, .12, .67], color, true);
    for (const x of [-.65, .65]) art.box(offset(p, x, .39, -.87), [.16, .78, .51], color, true);
  }
  function beamMesh(parent: THREE.Object3D, a: Point, b: Point, radius: number, mat = materials.metal) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
    const node = mesh(parent, new THREE.CylinderGeometry(radius, radius, direction.length(), 8), mat, start.lerp(end, .5).toArray());
    node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return node;
  }
  function walkway(name: string, region: Parameters<SiteArt['finish']>[0], points: [Point, Point], width: number, color: string, enabled: boolean, rails = true) {
    const art = scenery(name);
    const from = new THREE.Vector3(...points[0]), to = new THREE.Vector3(...points[1]);
    const run = to.clone().sub(from), length = run.length();
    const mid = from.clone().lerp(to, .5);
    const pitch = -Math.atan2(run.y, Math.hypot(run.x, run.z));
    const yaw = Math.atan2(run.x, run.z);
    const turn = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')));
    const angles: Point = [turn.x, turn.y, turn.z];
    const up = new THREE.Vector3(0, 1, 0).applyEuler(turn);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(turn);
    art.box(mid.clone().addScaledVector(up, -.13).toArray(), [width, .26, length + 1.4], color, true, 'body', angles);
    for (let t = .5; t < length; t += .55) {
      const p = from.clone().lerp(to, t / length).addScaledVector(up, .025);
      art.box(p.toArray(), [width - .08, .03, .028], wood, false, 'body', angles);
    }
    for (const side of rails ? [-1, 1] : []) {
      const off = width / 2 * side;
      const rail = mid.clone().addScaledVector(right, off).addScaledVector(up, .9);
      art.box(rail.toArray(), [.095, .11, length], wood, true, 'body', angles);
      for (let t = .45; t < length - .2; t += 1.9) {
        const post = from.clone().lerp(to, t / length).addScaledVector(right, off).addScaledVector(up, .46);
        art.box(post.toArray(), [.11, .96, .11], faded, true);
      }
    }
    const collider = finish(art, region, enabled)!;
    return { art, collider };
  }

  const lake = prior.get('disc_lake_lady')?.p;
  let ferry: { board(side: 0 | 1): 'sailing' | 'called' | 'boarding'; update(dt: number): void;
    seat: THREE.Vector3; yaw: number; riding: boolean; landing: Point | null; cancel(): void } | null = null;
  if (lake) {
    const shed = place(offset(lake, 4, .25, 6.7), 10.5);
    const crank = shed && place(offset(shed, -2.7, 0, -2.9), 4.5);
    const hullWork = crank && place(offset(crank, -2.7, 0, 2.75), 4.5);
    const mooring = hullWork && place(offset(hullWork, -3, 0, -3), 9);
    if (shed && crank && hullWork && mooring) {
      interact(B.shed, shed); interact(B.haul, crank); interact(B.brace, hullWork); interact(B.launch, mooring);
      const art = scenery('SwordLakeFerryShelter');
      const shade = '#42362b', linen = '#a0a493';
      table(art, shed);
      art.paper(...offset(shed, 0, .915, -.84));
      for (const x of [-1.7, 1.7]) {
        art.box(offset(shed, x, 1.31, -2.7), [.2, 2.62, .19], wood, true);
        art.box(offset(shed, x, 1.21, -5), [.2, 2.42, .19], wood);
      }
      art.box(offset(shed, 0, 2.49, -3.85), [3.75, .19, 2.66], shade, false, 'body', [-.11, 0, 0]);
      for (let i = -4; i <= 4; i++) art.box(offset(shed, i * .405, 2.61, -3.84), [.033, .07, 2.66], faded, false, 'body', [-.11, 0, 0]);
      art.lantern(shed[0] - 1.48, shed[1] + 1.6, shed[2] - 2.64, shade);
      for (const x of [-.56, .56]) art.beam(offset(crank, x, .045, -1), offset(hullWork, x, .05, -2), .08, steel);
      art.box(offset(crank, 0, .58, -.94), [.21, 1.16, .23], wood);
      art.ring(offset(crank, 0, .94, -.81), .26, .046, bronze);
      art.box(offset(mooring, .47, .34, -.61), [.23, .68, .22], wood, true);
      const patch = mesh(art.root, new THREE.BoxGeometry(.66, .055, .31), materials.wood, offset(hullWork, 0, .26, -.71), 'SwordLakeHullPatch');
      const boat = group(art.root, offset(shed, 0, .3, -3.8), 'SwordLakeRoyalBoat');
      const hull = new THREE.Shape().moveTo(0, -2.08).quadraticCurveTo(.88, -1.28, .79, -.38).lineTo(.56, 1.61)
        .quadraticCurveTo(0, 1.9, -.56, 1.61).lineTo(-.79, -.38).quadraticCurveTo(-.88, -1.28, 0, -2.08).closePath();
      const outer = new THREE.ExtrudeGeometry(hull, { depth: .15, bevelEnabled: true, bevelSegments: 2, bevelSize: .085, bevelThickness: .065 }).rotateX(-Math.PI / 2);
      mesh(boat, outer, materials.wood, [0, .03, 0]);
      for (const side of [-1, 1]) {
        const rail: Point[] = [[0, .45, -2.08], [side * .62, .37, -1.14], [side * .75, .31, .06], [side * .54, .31, 1.63]];
        for (let i = 1; i < rail.length; i++) {
          beamMesh(boat, rail[i - 1], rail[i], .069, materials.wood);
          mesh(boat, new THREE.BoxGeometry(.093, .19, Math.hypot(rail[i][0] - rail[i - 1][0], rail[i][2] - rail[i - 1][2])), materials.wood,
            [(rail[i][0] + rail[i - 1][0]) / 2, .198, (rail[i][2] + rail[i - 1][2]) / 2]).rotation.y =
            Math.atan2(rail[i][0] - rail[i - 1][0], rail[i][2] - rail[i - 1][2]);
        }
      }
      for (const z of [-.83, .52]) mesh(boat, new THREE.BoxGeometry(1.25, .085, .25), materials.wood, [0, .29, z]);
      const seal = mesh(boat, new THREE.TorusGeometry(.21, .033, 8, 18).rotateX(-Math.PI / 2), materials.beacon, [0, .185, -.17], 'SwordLakeOldOathSeal');
      const plank = mesh(boat, new THREE.BoxGeometry(.63, .066, .25), materials.dark, [0, .21, -.15]);
      const crew = createSettlementNpcs([
        { id: 'field_boat_oren', region: 'britain', position: [.19, .16, .35], yaw: .24, role: ['奥伦 · 船匠', 'Oren · boatbuilder'],
          appearance: { coat: 0x6d5946, trim: 0x3a5651, accent: 0xac9b78 }, lines: [] },
        { id: 'field_boat_eve', region: 'britain', position: [-.18, .15, -.83], yaw: .37, role: ['伊芙 · 船匠学徒', 'Eve · boatbuilding apprentice'],
          appearance: { coat: 0x638178, trim: 0xa5885c, accent: 0xab675c }, lines: [] },
      ]);
      boat.add(crew.group); actorCleanup.push(() => crew.dispose());
      const boatmen = crew.group.children;
      const rowers = boatmen.map(person => {
        const arm = person.getObjectByName('ResidentArmRight')!;
        const oar = beamMesh(arm, [.04, -.63, .11], [.73, -.93, .22], .032, materials.wood);
        const paddle = mesh(oar, new THREE.BoxGeometry(.18, .26, .045), materials.wood, [0, .38, 0]);
        paddle.rotation.z = .1;
        return arm;
      });
      const deckBank = place(offset(mooring, -2, 0, 1.5), 4.5);
      const westBank = place(offset(lake, -58, 2.9, -1.75), 9);
      if (deckBank && westBank) {
        const end = offset(deckBank, -2.5, .13, -3.65);
        const westEnd: Point = [-704.2, water + .59, 133.3];
        const deck = walkway('SwordLakeViewingDeck', 'britain', [offset(deckBank, 0, .035), end], 2.55, faded, false);
        const west = walkway('SwordLakeWestLanding', 'britain', [offset(westBank, 0, .035), westEnd], 2.65, faded, false);
        interact(B.watch, end);
        const eastLand = offset(end, .84, 0, 1.23), westLand = offset(westEnd, -.5, .012, .15);
        interact(B.board, eastLand); interact(B.returnFerry, westLand);
        const outlook = scenery('SwordLakeWestOutlook');
        outlook.box(offset(westEnd, -.4, -.145, .1), [3.7, .29, 3.1], faded, true);
        for (const x of [-1.52, 1.5]) {
          outlook.box(offset(westEnd, x, -.63, -.98), [.23, 1.4, .22], wood, true);
          outlook.box(offset(westEnd, x, -.63, 1.14), [.23, 1.4, .22], wood, true);
        }
        outlook.box(offset(westEnd, -.4, .47, 1.22), [1.58, .13, .38], wood, true);
        outlook.box(offset(westEnd, -.4, .74, 1.38), [1.57, .49, .09], faded, true);
        outlook.lantern(westEnd[0] + .96, westEnd[1] + .57, westEnd[2] + 1.02, wood);
        const outlookFloor = finish(outlook, 'britain', false)!;
        const ports = [eastLand, westLand] as const;
        const route = new THREE.CatmullRomCurve3([
          new THREE.Vector3(end[0] - .7, water + .18, end[2] - 3.1),
          new THREE.Vector3(-674, water + .18, 131.8),
          new THREE.Vector3(-690.1, water + .18, 130.35),
          new THREE.Vector3(westEnd[0] + 2.9, water + .18, westEnd[2] - .6),
        ]);
        let dock: 0 | 1 = 0, leg: { from: 0 | 1; time: number } | null = null;
        let riding = false, trial = 0, firstFrame = true, settled: Point | null = null, clock = 0;
        const at = new THREE.Vector3(), aim = new THREE.Vector3(), seat = new THREE.Vector3();
        const forward = new THREE.Vector3();
        let heading = 0;
        function sample() {
          const t = leg ? THREE.MathUtils.smoothstep(leg.time, 0, 10.8) : dock;
          const progress = leg?.from === 1 ? 1 - t : t;
          route.getPointAt(progress, at); route.getTangentAt(progress, forward);
          if ((leg?.from ?? dock) === 1) forward.negate();
          if (trial < 7.4 && !leg) {
            const swing = Math.sin(Math.PI * THREE.MathUtils.clamp(trial / 7.4, 0, 1));
            at.x -= swing * 5.3; at.z -= swing * 2.65;
          }
          at.y += Math.sin(clock * 2.5) * .035;
          boat.position.copy(at);
          heading = Math.atan2(forward.x, forward.z);
          boat.rotation.y = heading;
          boat.rotation.z = Math.sin(clock * 2.4) * .028;
          aim.set(-.26, .21, 1.14).applyAxisAngle(THREE.Object3D.DEFAULT_UP, heading);
          seat.copy(at).add(aim);
        }
        ferry = {
          get riding() { return riding; },
          get landing() { const result = settled; settled = null; return result; },
          seat,
          get yaw() { return heading; },
          board(side) {
            if (trial < 7.4 || leg) return 'sailing';
            settled = null;
            riding = side === dock;
            leg = { from: dock, time: 0 };
            sample();
            return riding ? 'boarding' : 'called';
          },
          update(dt) {
            trial = Math.min(7.4, trial + dt); clock += dt;
            if (leg) {
              leg.time += dt;
              if (leg.time >= 10.8) {
                dock = leg.from === 0 ? 1 : 0;
                leg = null;
                if (riding) { riding = false; settled = ports[dock]; }
              }
            }
            sample();
          },
          cancel() { leg = null; riding = false; settled = null; },
        };
        updates.push((done, dt, player) => {
          const open = done.has(B.launch);
          deck.art.root.visible = deck.collider.enabled = open;
          west.art.root.visible = west.collider.enabled = open;
          outlook.root.visible = outlookFloor.enabled = open;
          if (!open) { firstFrame = true; trial = 0; dock = 0; ferry?.cancel(); return; }
          if (firstFrame) {
            firstFrame = false;
            if (Math.hypot(player.x - end[0], player.z - end[2]) > 55) trial = 7.4;
          }
        });
      }
      art.box(offset(shed, -1.48, 1.38, -2.56), [.57, .46, .06], linen);
      finish(art, 'britain');
      const dry = new THREE.Vector3(...offset(shed, 0, .3, -3.8)), hauled = new THREE.Vector3(...offset(hullWork, 0, .29, -1.08));
      const destination = new THREE.Vector3(), crewView = new THREE.Vector3(0, 1, 2);
      const seats = boatmen.map(person => ({
        torso: person.getObjectByName('ResidentTorso')!, legs: person.getObjectByName('ResidentBootsAndLegs')!,
      }));
      const wakeMaterial = new THREE.MeshBasicMaterial({ color: '#adcbc3', opacity: .24, transparent: true, depthWrite: false });
      const wake = group(boat, [0, -.084, 1.54], 'SwordLakeOarWake');
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        const track = mesh(wake, new THREE.BoxGeometry(.039, .007, .65 + i * .21), wakeMaterial,
          [side * (.5 + i * .22), 0, 1.07 + i * .47]);
        track.rotation.y = side * (.27 + .043 * i);
      }
      let run = 0, visited = false, haulProgress = 0;
      updates.push((done, dt, player) => {
        const launched = done.has(B.launch);
        const pulled = done.has(B.haul);
        const near = Math.hypot(player.x - mooring[0], player.z - mooring[2]) < 76;
        haulProgress = visited ? THREE.MathUtils.damp(haulProgress, Number(pulled), 4, dt) : Number(pulled);
        destination.copy(dry).lerp(hauled, haulProgress);
        if (launched && ferry) {
          ferry.update(near || ferry.riding ? dt : 0);
          destination.copy(boat.position);
          if (near) run += dt;
        } else if (launched) {
          if (near) run += dt;
          const cycle = run * .16;
          const x = mooring[0] - 8.1 - Math.cos(cycle) * 5.4;
          const z = mooring[2] - 7.2 + Math.sin(cycle) * 4.5;
          destination.set(x, water + .12 + Math.sin(run * 2.4) * .038, z);
          boat.rotation.y = Math.atan2(-Math.sin(cycle) * 5.4, -Math.cos(cycle) * 4.5);
          boat.rotation.z = Math.sin(run * 2.4) * .028;
        } else {
          run = 0;
          boat.rotation.y = -.4;
          boat.rotation.z = .045;
        }
        boat.position.copy(destination);
        patch.visible = !done.has(B.brace);
        seal.visible = !pulled && !done.has('sun_core') && !done.has(B.brace);
        plank.visible = done.has(B.brace);
        wake.visible = launched;
        crew.group.visible = launched || done.has(B.shed);
        if (crew.group.visible && near) {
          crew.update(dt, crewView);
          seats.forEach(seat => { seat.torso.position.y = launched ? .62 : 1.04; seat.legs.scale.y = launched ? .48 : 1; });
          boatmen[0].rotation.y = .23;
          boatmen[1].rotation.y = -.4;
          if (launched) rowers.forEach((arm, i) => { arm.rotation.x = -.64 + Math.sin(run * 2.6 + i * .68) * .55; arm.rotation.z = -.62; });
          wakeMaterial.opacity = .21 + Math.sin(run * 2.6) * .08;
        }
        visited = true;
      });
    }
  }

  const shipyard = prior.get('map_piece_1')?.p;
  let workboatReady = false, workboatBattle = false;
  if (shipyard) {
    const bench = place(offset(shipyard, 1.8, -1, 3.6));
    const bell = place(offset(shipyard, -7.6, -1, -3.8));
    const store = place(offset(shipyard, -12.5, -1, -9));
    if (bench && bell && store) {
      interact(W.bench, bench); interact(W.return, bench); interact(W.divert, bell); interact(W.chest, store);
      const art = scenery('NassauWageStore');
      table(art, bench); art.paper(...offset(bench, -.28, .91, -.78));
      const toolShelf = group(art.root, offset(bench, .5, .94, -.89), 'SeizedTools');
      for (let i = 0; i < 4; i++) {
        const x = i * .17 - .33;
        mesh(toolShelf, new THREE.BoxGeometry(.038, .035, .29), materials.wood, [x, .03, 0]);
        mesh(toolShelf, new THREE.BoxGeometry(.115, .065, .08), materials.dark, [x, .055, -.115]);
      }
      for (const side of [-1, 1]) {
        art.box(offset(store, side * 1.66, 1.3, -1.38), [.22, 2.6, .24], wood, true);
        art.box(offset(store, side * 1.66, 1.32, -2.7), [.18, 2.64, 2.8], faded, true);
      }
      art.box(offset(store, 0, 1.3, -4), [3.5, 2.6, .2], faded, true);
      art.box(offset(store, 0, 2.68, -2.62), [3.7, .2, 3.1], wood, true);
      const shutter = mesh(art.root, new THREE.BoxGeometry(3.07, 1.8, .12), materials.wood, offset(store, 0, 1.05, -1.38), 'NassauStoreShutter');
      const chest = mesh(art.root, new THREE.BoxGeometry(.78, .47, .54), materials.wood, offset(store, -.23, .3, -2.1), 'NassauPayChest');
      for (const side of [-1, 1]) mesh(chest, new THREE.BoxGeometry(.085, .49, .57), materials.metal, [side * .26, 0, 0]);
      mesh(chest, new THREE.BoxGeometry(.12, .16, .024), materials.metal, [0, .028, .28]);
      const portBell = group(art.root, offset(bell, 0, 2.2, -.65), 'NassauUnloadingBell');
      mesh(portBell, new THREE.CylinderGeometry(.14, .27, .31, 14), materials.metal, [0, -.18, 0]);
      mesh(portBell, new THREE.SphereGeometry(.052, 8, 6), materials.dark, [0, -.35, 0]);
      art.box(offset(bell, .6, 1.24, -.66), [.15, 2.48, .15], wood, true);
      art.box(offset(bell, .27, 2.25, -.66), [.8, .12, .12], wood);
      finish(art, 'blacksail');
      const gateGeometry = new THREE.BoxGeometry(3.07, 1.8, .16).translate(...shutter.position.toArray());
      const gate: Collider = { name: 'COL_NassauWageShutter', enabled: true, bvh: new MeshBVH(gateGeometry) };
      colliders.push(gate);
      const guardHome = place(offset(store, 2.15, 0, .9), 4.5);
      const guardAway = place(offset(bell, -1.7, 0, 2), 4.5);
      const miraHome = place(offset(bench, -.4, 0, -2), 4.5);
      const crew = guardHome && guardAway && miraHome ? createSettlementNpcs([
        { id: 'field_wages_mira', region: 'blacksail', position: miraHome, role: ['米拉 · 修船工', 'Mira · shipwright'],
          appearance: { coat: 0x496d63, trim: 0x815c42, accent: 0xc29b64 }, lines: [] },
        { id: 'field_wages_guard', region: 'blacksail', position: guardHome, role: ['海务哨兵', 'Customs sentry'],
          appearance: { coat: 0x793e3c, trim: 0x253540, accent: 0xd1b776 }, lines: [] },
      ]) : null;
      const guard = crew?.group.getObjectByName('Resident_field_wages_guard');
      const walk = guard && residentWalkRig(guard);
      if (crew) { root.add(crew.group); actorCleanup.push(() => crew.dispose()); }
      // The old ramp bypasses the bend around the unloading station after workers lower it.
      const crossing = walkway('NassauFoldingRamp', 'blacksail', [offset(bell, .65, .12, 1.25), offset(store, .9, .12, 1.2)], 1.85, faded, false);
      let initialized = false, progress = 0, gait = 0, ringTime = 0, previousOpen = false;
      updates.push((done, dt, player) => {
        const gone = harborCustomsGone(done);
        const open = done.has(W.divert) || gone;
        const y = store[1] + (open ? 2.99 : 1.05);
        shutter.position.y = initialized ? THREE.MathUtils.damp(shutter.position.y, y, 6, dt) : y;
        const destination = done.has(W.return) ? offset(bench, .43, 1.16, -.87) : offset(store, -.23, .3, -2.1);
        chest.position.set(...destination);
        chest.visible = !done.has(W.chest) || done.has(W.return);
        toolShelf.visible = !done.has(W.chest) || done.has(W.return);
        gate.enabled = !open;
        crossing.art.root.visible = crossing.collider.enabled = done.has(W.return);
        if (open && initialized && !previousOpen && !gone) ringTime = 1.25;
        previousOpen = open;
        ringTime = Math.max(0, ringTime - dt);
        portBell.rotation.z = Math.sin(ringTime * 17) * ringTime * .23;
        if (crew && guard && guardHome && guardAway && walk) {
          crew.update(dt, player);
          progress = initialized && !gone ? Math.min(open ? 1 : 0, progress + dt * .38) : Number(open);
          const x = THREE.MathUtils.lerp(guardHome[0], guardAway[0], progress);
          const z = THREE.MathUtils.lerp(guardHome[2], guardAway[2], progress);
          const y = progress === 0 ? guardHome[1] : progress === 1 ? guardAway[1]
            : ground(x, z, Math.max(guardHome[1], guardAway[1]) + 1.9) ?? guardHome[1];
          guard.position.x = x; guard.position.z = z;
          guard.rotation.y = open ? Math.atan2(guardAway[0] - guardHome[0], guardAway[2] - guardHome[2]) : .18;
          guard.visible = !gone && Math.hypot(x - player.x, z - player.z) < 70;
          gait += dt * 9;
          walk.update(gait, open && progress < 1, y - guardHome[1]);
        }
        initialized = true;
      });
    }
  }

  const workboatQuay = place([599, 3.4, -525], 9);
  const flagStation = workboatQuay && place(offset(workboatQuay, -1.7, 0, -9.9), 7.5);
  const fight = workboatQuay && place(offset(workboatQuay, 0, 0, 4.4), 6);
  const release = fight && place(offset(fight, -.6, 0, 11.2), 7.5);
  const gangway = release && place(offset(release, .7, 0, 7.2), 7.5);
  if (workboatQuay && flagStation && fight && release && gangway) {
    interact(HB.inspect, workboatQuay); interact(HB.access, flagStation); interact(HB.fight, fight);
    interact(HB.release, release); interact(HB.gangway, gangway);
    const art = scenery('NassauSeizedWorkboat');
    const post = offset(workboatQuay, -.96, 0, -.91);
    art.box(offset(post, 0, .77), [.18, 1.54, .19], faded, true);
    art.box(offset(post, 0, 1.11, .12), [.46, .84, .09], steel);
    for (let i = 0; i < 5; i++) art.box(offset(post, .075, .75 + .15 * i, .181), [.22 + (i % 2) * .08, .026, .02], bronze);
    const hullShape = new THREE.Shape().moveTo(0, -4.8).quadraticCurveTo(1.76, -3.5, 1.7, -1.4).lineTo(1.56, 3.4)
      .quadraticCurveTo(0, 4.43, -1.56, 3.4).lineTo(-1.7, -1.4).quadraticCurveTo(-1.76, -3.5, 0, -4.8);
    const hull = new THREE.ExtrudeGeometry(hullShape, { depth: .58, bevelSize: .09, bevelThickness: .09, bevelSegments: 1 }).rotateX(-Math.PI / 2);
    const ship = group(art.root, [release[0] + 5, water + .14, release[2] + 1.6], 'EliNassauWorkboat');
    mesh(ship, hull, materials.wood, [0, 0, 0]);
    for (const side of [-1, 1]) {
      beamMesh(ship, [side * 1.54, .84, -2.8], [side * 1.5, .84, 2.9], .065, materials.dark);
      for (const z of [-2.8, -.8, 1, 2.9]) mesh(ship, new THREE.BoxGeometry(.135, .32, .13), materials.wood, [side * 1.51, .71, z]);
    }
    const load = group(ship, [.33, .6, .1], 'EliWorkboatMedicine');
    for (let i = 0; i < 3; i++) {
      mesh(load, new THREE.BoxGeometry(.59, .39, .52), materials.wood, [i % 2 * .53 - .53, .23, Math.floor(i / 2) * .63]);
      mesh(load, new THREE.BoxGeometry(.23, .11, .026), materials.beacon, [i % 2 * .53 - .53, .27, Math.floor(i / 2) * .63 + .275]);
    }
    const emptyBoat = group(art.root, [flagStation[0] + 5.3, water + .16, flagStation[2] - 1.2], 'NassauBlackFlagDecoy');
    const small = mesh(emptyBoat, hull, materials.dark, [0, 0, 0]);
    small.scale.set(.67, .62, .55);
    const mast = mesh(emptyBoat, new THREE.CylinderGeometry(.072, .1, 4.7, 8), materials.wood, [0, 2.28, 0]);
    mast.rotation.z = -.065;
    const flag = mesh(emptyBoat, new THREE.BoxGeometry(1.56, .84, .018), materials.dark, [.68, 1.24, 0], 'NassauRaisedDecoyFlag');
    mesh(flag, new THREE.BoxGeometry(.19, .19, .026), materials.metal, [.44, 0, .015]).rotation.z = Math.PI / 4;
    const beam = group(art.root, offset(gangway, .91, .18, -.84), 'NassauRearGangway');
    mesh(beam, new THREE.BoxGeometry(.93, .12, 3.3), materials.wood, [0, 0, -1.65]);
    for (const x of [-.44, .44]) mesh(beam, new THREE.BoxGeometry(.055, .18, 3.31), materials.metal, [x, .12, -1.65]);
    for (const p of [fight, release, gangway]) {
      art.box(offset(p, .71, .46, -.82), [.24, .92, .25], wood, true);
      art.ring(offset(p, .71, .61, -.664), .118, .03, bronze, 'metal');
    }
    const recovery = scenery('NassauWorkboatReception');
    table(recovery, offset(workboatQuay, .82, 0, 1.7));
    for (const x of [-.22, .23]) recovery.box(offset(workboatQuay, .82 + x, .947, .86), [.37, .12, .41], '#657f75');
    recovery.lantern(workboatQuay[0] + 1.39, workboatQuay[1] + 1.34, workboatQuay[2] + .7);
    const receptionCollider = finish(recovery, 'blacksail', false)!;
    const sentries = createSettlementNpcs([
      { id: 'field_workboat_levy', region: 'blacksail', position: offset(release, -.92, 0, -2.4),
        role: ['征召兵乌里', 'Uri the conscript'], appearance: { coat: 0x746057, trim: 0x424f56 }, lines: [] },
      { id: 'field_workboat_quayside', region: 'blacksail', position: offset(release, .91, 0, -2.1),
        role: ['征召兵拉夫', 'Ralph the conscript'], appearance: { coat: 0x77664b, trim: 0x465868 }, lines: [] },
    ]);
    art.root.add(sentries.group); actorCleanup.push(() => sentries.dispose());
    const walkers = sentries.group.children.map(actor => {
      const start = actor.position.clone();
      return { actor, start, walk: residentWalkRig(actor) };
    });
    finish(art, 'blacksail');
    const start = ship.position.clone();
    let clock = 0, walkTime = 0, towTime = 0, initialized = false;
    updates.push((done, dt, player) => {
      const gone = harborCustomsGone(done), freed = done.has(HB.release);
      const moving = done.has(HB.signal) || done.has(HB.gangway);
      if (dt > 0 && Math.hypot(player.x - release[0], player.z - release[2]) < 85) clock += dt;
      if (!moving) walkTime = 0;
      else if (!initialized || freed) walkTime = 1;
      else if (dt > 0 && Math.hypot(player.x - release[0], player.z - release[2]) < 85) walkTime = Math.min(1, walkTime + dt / 4.5);
      if (!freed) towTime = 0;
      else if (!initialized) towTime = 1;
      else if (dt > 0 && Math.hypot(player.x - release[0], player.z - release[2]) < 85) towTime = Math.min(1, towTime + dt / 6);
      workboatReady = gone || done.has(HB.fought) || (moving && walkTime >= 1);
      flag.position.y = THREE.MathUtils.damp(flag.position.y, done.has(HB.signal) ? 4.14 : 1.24, 5, dt);
      flag.rotation.y = Math.sin(clock * 2) * .09;
      beam.rotation.x = THREE.MathUtils.damp(beam.rotation.x, done.has(HB.gangway) || gone ? 0 : -.85, 6, dt);
      ship.position.set(start.x, start.y + Math.sin(clock * 1.8) * .035, start.z + towTime * 16.7);
      ship.rotation.z = Math.sin(clock * 1.47) * .019;
      load.visible = freed;
      recovery.root.visible = receptionCollider.enabled = freed;
      const battle = workboatBattle || done.has(HB.fight);
      sentries.group.visible = done.has(HB.inspect) && !gone && !battle && !freed && walkTime < 1;
      if (sentries.group.visible) {
        sentries.update(dt, player);
        for (const { actor, start: p, walk } of walkers) {
          const targetZ = done.has(HB.signal) ? flagStation[2] + 2.1 : gangway[2] + 3.6;
          const z = THREE.MathUtils.lerp(p.z, targetZ, walkTime);
          const y = ground(p.x, z, p.y + 1.2) ?? p.y;
          actor.position.set(p.x, y, z);
          actor.rotation.y = moving ? targetZ > p.z ? 0 : Math.PI : .4;
          walk.update(clock * 9, moving && walkTime < 1, y - p.y);
        }
      }
      initialized = true;
    });
  }

  let adjustWreck: ((id: string) => boolean) | null = null;
  let startChipToss: ((choice: 'left' | 'right', first: boolean) => boolean) | null = null;
  let chipOutcome: { won: boolean; first: boolean } | null = null;
  const wreckSight = place([582, 6.2, -909], 12);
  const firstWinch = place([609, 26.05, -883.6], 4.5);
  const secondWinch = firstWinch && place(offset(firstWinch, .28, 0, 2.85), 4.5);
  const memorial = place([586, 3.4, -587], 7.5);
  if (wreckSight && firstWinch && secondWinch && memorial) {
    const x = 598.1, y = 27.41, z = -883.4;
    interact(HK.sight, wreckSight); interact(HK.forward, firstWinch); interact(HK.aft, secondWinch);
    interact(HK.chest, [x - .25, y, z - 1.25]); interact(HK.lookout, [x - 2.55, y, z + .4]);
    interact(HK.choose, memorial);
    const art = scenery('NassauPassengerWreck');
    art.box([x, y - .19, z], [6.1, .38, 5.15], faded, true);
    art.box([x - 1.28, y - .74, z], [5.9, .36, 4.8], wood);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        art.box([x - 2.6 + i * 1.1, y - .56, z + side * 2.4], [.18, 1.27, .34], '#5d4c46', false, 'body', [side * -.34, 0, 0]);
      }
      art.box([x, y + .61, z + side * 2.52], [6.35, .13, .2], wood, true);
      for (const px of [-2.95, -.98, 1.8]) art.box([x + px, y + .3, z + side * 2.52], [.145, .63, .15], steel, true);
    }
    art.box([x - 3, y + .56, z], [.19, .13, 5.12], wood, true);
    const casework = group(art.root, [x - .45, y + .18, z - 1.95], 'NassauWaterproofCase');
    mesh(casework, new THREE.BoxGeometry(.72, .29, .43), materials.wood, [0, 0, 0]);
    const lid = group(casework, [0, .16, -.19], 'NassauWaterproofCaseLid');
    mesh(lid, new THREE.BoxGeometry(.72, .085, .44), materials.metal, [0, 0, .21]);
    const keepsake = mesh(casework, new THREE.TorusGeometry(.099, .023, 7, 15).rotateX(Math.PI / 2),
      materials.metal, [-.15, .15, .018], 'NassauFamilyPendant');
    mesh(casework, new THREE.BoxGeometry(.22, .055, .081), materials.dark, [.18, .146, .013]);
    const mast = [x - 2.05, y + 1.64, z - 1.83] as Point;
    art.beam(offset(mast, 0, -1.65), mast, .103, faded, true);
    const beacon = mesh(art.root, new THREE.SphereGeometry(.23, 12, 8), materials.beacon, mast, 'NassauRepairedWreckBeacon');
    art.ring(mast, .33, .048, bronze);
    const spar = offset(wreckSight, .9, 1.5, -.72);
    art.beam(offset(wreckSight, .92, 0, -.76), spar, .13, faded, true);
    for (const j of [0, 1, 2]) art.box(offset(wreckSight, .93, .48 + j * .32, -.59), [.18, .036, .053], bronze);
    const reflection = mesh(art.root, new THREE.OctahedronGeometry(.13), materials.beacon, offset(spar, 0, .09), 'NassauLowWaterReflection');
    const settings = [
      { id: HK.forward, p: firstWinch, a: [608.86, 26.02, z] as Point, b: [603.23, y, z] as Point, name: 'NassauForwardWreckDeck' },
      { id: HK.aft, p: secondWinch, a: [603.23, y, z] as Point, b: [600.86, y, z] as Point, name: 'NassauAftWreckDeck' },
    ];
    const trims = settings.map(({ id, p, a, b, name }, i) => {
      const bridge = walkway(name, 'blacksail', [a, b], 2.28, faded, false, i !== 0);
      const distance = Math.abs(a[0] - b[0]);
      const tilt = group(art.root, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - .13, z], name + 'Hinge');
      mesh(tilt, new THREE.BoxGeometry(distance + .85, .23, 2.21), materials.wood, [0, 0, 0]);
      for (const edge of [-.96, .96]) mesh(tilt, new THREE.BoxGeometry(distance + .85, .11, .11), materials.metal, [0, .66, edge]);
      const base = group(art.root, offset(p, .65, .69, -.72), name + 'Lever');
      mesh(base, new THREE.BoxGeometry(.22, .85, .23), materials.wood, [0, -.21, 0]);
      mesh(base, new THREE.BoxGeometry(.08, .56, .078), materials.metal, [0, .24, .09]);
      mesh(base, new THREE.SphereGeometry(.095, 8, 6), materials.beacon, [0, .53, .09]);
      const angles = i === 0 ? [-.52, .31, 0] : [.49, -.32, 0];
      tilt.rotation.z = angles[0];
      return { id, bridge, tilt, base, angles, notch: 0 };
    });
    adjustWreck = id => {
      const lever = trims.find(t => t.id === id);
      if (!lever) return false;
      lever.notch = (lever.notch + 1) % lever.angles.length;
      return lever.notch === 2;
    };
    table(art, memorial);
    const publicCase = mesh(art.root, new THREE.BoxGeometry(.41, .18, .31), materials.metal, offset(memorial, -.35, 1, -.84), 'NassauPublicMemorialCase');
    const familyCase = mesh(art.root, new THREE.BoxGeometry(.41, .18, .31), materials.wood, offset(memorial, .29, 1, -.84), 'NassauReturnedFamilyCase');
    finish(art, 'blacksail');
    let tide = 0;
    updates.push((done, dt, player) => {
      tide = (tide + dt) % 13;
      reflection.scale.setScalar(.8 + .46 * (Math.sin(tide * Math.PI / 6.5) * .5 + .5));
      reflection.rotation.y = tide * .7;
      for (const t of trims) {
        const flat = done.has(t.id);
        if (flat) t.notch = 2;
        else if (!done.has(HK.sight)) t.notch = 0;
        t.tilt.rotation.z = THREE.MathUtils.damp(t.tilt.rotation.z, t.angles[t.notch], 7, dt);
        t.tilt.visible = !flat; t.bridge.art.root.visible = t.bridge.collider.enabled = flat;
        t.base.rotation.x = (t.notch - 1) * .29;
      }
      const open = done.has(HK.chest);
      lid.rotation.x = open ? -1.52 : 0;
      keepsake.visible = !open; beacon.visible = open;
      if (open && Math.hypot(player.x - mast[0], player.z - mast[2]) < 185) beacon.scale.setScalar(1 + .22 * Math.sin(tide * 4.1));
      publicCase.visible = done.has(HK.memorial); familyCase.visible = done.has(HK.family);
    });
  }

  const tavern = place([583.2, 3.4, -581.4], 9);
  const stool = tavern && place(offset(tavern, -2.5, 0, 1.82), 5.5);
  if (tavern && stool) {
    interact(CC.talk, tavern); interact(CC.throw, tavern); interact(CC.rematch, tavern); interact(CC.repair, stool);
    const art = scenery('NassauCaptainsTable');
    table(art, tavern);
    const tableTop = group(art.root, offset(tavern, 0, .933, -.84), 'NassauThrowingBoard');
    tableTop.rotation.z = -.083;
    for (const side of [-1, 1]) {
      mesh(tableTop, new THREE.CylinderGeometry(.268, .3, .055, 18), side === -1 ? materials.blue : materials.red, [side * .49, .02, -.03]);
      for (let i = 0; i < (side === -1 ? 1 : 2); i++)
        mesh(tableTop, new THREE.BoxGeometry(.14, .012, .026), materials.metal, [side * .49, .054, i * .073 - .054]);
    }
    const chip = mesh(tableTop, new THREE.CylinderGeometry(.071, .071, .025, 16), materials.metal, [0, .08, .28], 'NassauWoodenStake');
    const chair = group(art.root, offset(stool, -.13, 0, -.86), 'NassauCaptainsLooseStool');
    mesh(chair, new THREE.BoxGeometry(.64, .115, .54), materials.wood, [0, .49, 0]);
    mesh(chair, new THREE.BoxGeometry(.62, .34, .10), materials.wood, [0, .77, -.22]);
    let looseLeg: THREE.Mesh | null = null;
    for (const x of [-.23, .23]) for (const z of [-.19, .19]) {
      const leg = mesh(chair, new THREE.BoxGeometry(.09, .49, .09), materials.wood, [x, .24, z]);
      if (x > 0 && z > 0) looseLeg = leg;
    }
    const wedge = mesh(chair, new THREE.BoxGeometry(.144, .041, .092), materials.metal, [.224, .423, .18]);
    finish(art, 'blacksail');
    let toss: { landed: 'left' | 'right'; chosen: 'left' | 'right'; time: number; first: boolean } | null = null;
    let round = 0;
    startChipToss = (choice, first) => {
      if (toss || chipOutcome) return false;
      toss = { landed: round % 2 === 0 ? 'right' : 'left', chosen: choice, time: 0, first };
      round++;
      return true;
    };
    updates.push((done, dt, player) => {
      if (toss && Math.hypot(player.x - tavern[0], player.z - tavern[2]) < 14) {
        toss.time = Math.min(1, toss.time + dt / 1.55);
        const t = toss.time;
        chip.position.set((toss.landed === 'right' ? .49 : -.49) * t, .075 + Math.sin(t * Math.PI) * .56, .28 - .31 * t);
        chip.rotation.set(t * Math.PI * 8, t * 9, t * Math.PI * 4);
        if (t === 1) {
          chipOutcome = { won: toss.chosen === toss.landed, first: toss.first };
          toss = null;
          tableTop.rotation.z = round % 2 === 0 ? -.083 : .083;
        }
      }
      if (looseLeg) looseLeg.rotation.x = THREE.MathUtils.damp(looseLeg.rotation.x, done.has(CC.repair) ? 0 : -.44, 8, dt);
      wedge.visible = done.has(CC.repair);
    });
  }

  const school = place([29, 5, -660], 12);
  const warmHouse = school && place(offset(school, -13.8, 0, 2.5), 10.5);
  const roofFoot = warmHouse && place(offset(warmHouse, 0, 0, 5), 6);
  if (school && warmHouse && roofFoot) {
    interact(WB.box, school); interact(WB.report, school);
    interact(WB.house, warmHouse); interact(WB.plan, warmHouse);
    const art = scenery('WinterSchoolAndWarmHouse');
    const snow = '#9ba8a8', fireColor = new THREE.MeshBasicMaterial({ color: '#f4ab65' });
    table(art, school, steel); art.paper(...offset(school, -.14, .91, -.78), .54, .36);
    for (const x of [-1.72, 1.72]) art.box(offset(school, x, 1.29, -1.81), [.24, 2.58, .23], steel, true);
    art.box(offset(school, 0, 2.61, -2.2), [4.37, .23, 3.44], snow, true);
    art.box(offset(school, 0, 1.27, -3.62), [4.18, 2.54, .24], faded, true);
    for (let i = 0; i < 4; i++) art.box(offset(school, -1.46 + .96 * i, .44, -2.7), [.73, .13, .39], wood);
    const schoolTray = mesh(art.root, new THREE.BoxGeometry(.64, .056, .43), materials.metal, offset(school, -.22, .932, -.93), 'WinterReturnedBreadTray');
    const [x, y, z] = offset(warmHouse, -.23, 0, -2.8);
    for (const side of [-1, 1]) art.box([x + side * 2.36, y + 1.13, z], [.22, 2.26, 4.6], faded, true);
    art.box([x, y + 1.12, z - 2.27], [4.77, 2.23, .24], faded, true);
    for (const side of [-1, 1]) {
      art.box([x + side * 1.67, y + 1.1, z + 2.24], [1.43, 2.2, .22], wood, true);
      art.box([x + side * 1.67, y + 1.47, z + 2.36], [.89, .82, .075], '#e8af75');
      art.box([x + side * 1.67, y + 1.47, z + 2.42], [.065, .84, .06], steel);
    }
    art.box([x, y + 2.32, z], [5.08, .32, 4.78], snow, true);
    art.box([x - 1.38, y + 3.08, z - 1.3], [.62, 1.65, .6], '#7e655c');
    const flue = mesh(art.root, new THREE.BoxGeometry(.66, .15, .65), materials.metal, [x - 1.38, y + 3.99, z - 1.3], 'WinterHouseRepairedFlue');
    const stove = group(art.root, [x - 1.08, y + .38, z - .94], 'WinterWarmHouseStove');
    mesh(stove, new THREE.BoxGeometry(.85, .77, .73), materials.dark, [0, 0, 0]);
    const flame = mesh(stove, new THREE.BoxGeometry(.39, .27, .042), fireColor, [0, -.035, .383]);
    const householdTray = mesh(stove, new THREE.BoxGeometry(.62, .073, .52), materials.metal, [.01, .42, .01]);
    const roof = walkway('WinterWarmHouseRoofRoute', 'winter', [offset(roofFoot, 0, .03), [x, y + 2.51, z + 2.1]], 1.93, faded, false);
    const valleyBread = group(art.root, offset(residence, -3.2, .88, 2.7), 'ValleyBreadFromLuc');
    mesh(valleyBread, new THREE.BoxGeometry(.82, .13, .58), materials.wood, [0, -.12, 0]);
    for (const px of [-.21, .17]) mesh(valleyBread, new THREE.SphereGeometry(.17, 10, 8), new THREE.MeshStandardMaterial({ color: '#b9864c' }), [px, 0, 0]).scale.set(1, .55, 1.18);
    markers.push({ id: 'field_winter_warm_house', type: 'poi', label: '卢克的暖屋', p: [x, y + .3, z], radius: 6.5, requires: [WB.leave] });
    finish(art, 'winter');
    let clock = 0;
    updates.push((done, dt) => {
      clock += dt;
      flue.visible = done.has(WB.chimney);
      householdTray.visible = !done.has(WB.chimney);
      schoolTray.visible = valleyBread.visible = done.has(WB.chimney) && done.has(WB.report);
      roof.art.root.visible = roof.collider.enabled = done.has(WB.leave);
      flame.scale.y = .87 + .13 * Math.sin(clock * 9);
    });
  }

  const shoeWell = place([17, 5, -613], 12);
  const shoeDoor = shoeWell && place(offset(shoeWell, -9.5, -.8, -3.9), 9);
  const cobblerTable = shoeDoor && place(offset(shoeDoor, 0, 0, -4.7), 6);
  const shoeLanding = place([26, 4, -467], 10.5);
  if (shoeWell && shoeDoor && cobblerTable && shoeLanding) {
    interact(WS.line, shoeWell); interact(WS.cellar, shoeDoor); interact(WS.choose, cobblerTable);
    const art = scenery('WinterCobblerStore');
    art.ring(offset(shoeWell, -.7, .43, -.86), .53, .125, steel, 'metal', [Math.PI / 2, 0, 0]);
    const shoes = [offset(shoeWell, -.1, .12, -.44), offset(shoeWell, .29, .12, -.41), offset(shoeWell, .63, .09, -.58)];
    shoes.forEach((p, i) => {
      const leather = i === 2 ? '#996554' : i === 0 ? '#424655' : '#575447';
      art.box(p, [.19 - i * .02, .13, .37 - i * .045], leather);
      art.box(offset(p, 0, .095, -.083), [.16 - i * .02, .22 - i * .05, .15], leather);
      for (const h of [-.025, .023]) art.box(offset(p, 0, .06 + h, .187 - i * .025), [.12 - i * .018, .018, .021], '#b7a287');
    });
    const cellar = offset(cobblerTable, 0, 0, -.9);
    for (const side of [-1, 1]) art.box(offset(cellar, side * 1.96, 1.01, -.58), [.25, 2.02, 5.95], steel, true);
    art.box(offset(cellar, 0, 2.4, -.59), [4.17, .26, 6.04], '#a5b5b7', true);
    art.box(offset(cellar, 0, 1.01, -3.55), [4.12, 2.05, .23], steel, true);
    table(art, cobblerTable, '#656451'); art.lantern(cellar[0] - 1.38, cellar[1] + 1.33, cellar[2] - 1.24);
    const signage = scenery('WinterTwoSidedShoeSign');
    for (const p of [offset(shoeWell, -1.12, 0, 1.5), offset(shoeDoor, 1.35, 0, .8)]) {
      signage.box(offset(p, 0, .89), [.14, 1.77, .14], faded);
      for (const side of [-1, 1]) {
        signage.box(offset(p, 0, 1.49, side * .081), [.62, .35, .075], wood);
        signage.box(offset(p, .049, 1.47, side * .124), [.38, .084, .028], bronze);
        signage.box(offset(p, -.082, 1.55, side * .126), [.142, .12, .028], bronze);
      }
    }
    const stall = scenery('WinterCrossingShoeStall');
    table(stall, shoeLanding, steel);
    for (const px of [-.63, -.14, .45]) stall.box(offset(shoeLanding, px, .93, -.86), [.19, .08, .29], wood);
    const stallCollider = finish(stall, 'winter', false)!;
    finish(signage, 'winter'); finish(art, 'winter');
    const actors = createSettlementNpcs([
      { id: 'winter_cobbler_original', region: 'winter', position: offset(cobblerTable, 1, 0, -.83),
        role: ['老鞋匠', 'The old cobbler'], appearance: { coat: 0x645349 }, lines: [] },
      { id: 'winter_cobbler_crossing', region: 'winter', position: offset(shoeLanding, 1, 0, -.83),
        role: ['渡口鞋匠', 'Crossing cobbler'], appearance: { coat: 0x645349 }, lines: [] },
      { id: 'winter_cobbler_valley', region: 'alpha', position: offset(residence, 4.1, 0, 4.7),
        role: ['随药车来的鞋匠', 'Cobbler from the convoy'], appearance: { coat: 0x645349 }, lines: [] },
    ]);
    root.add(actors.group); actorCleanup.push(() => actors.dispose());
    updates.push((done, dt, player) => {
      const moved = done.has(WS.crossing), returned = moved && done.has('adventure_winter_arrived');
      signage.root.visible = done.has(WS.sign); stall.root.visible = stallCollider.enabled = moved;
      actors.update(dt, player);
      actors.group.children[0].visible &&= !moved;
      actors.group.children[1].visible &&= moved && !returned;
      actors.group.children[2].visible &&= returned;
    });
  }

  let rangeSmoke = 0;
  const battery = place([50, 4.9, -631], 10.5);
  const crest = battery && place(offset(battery, 8.6, 0, -4.8), 7.5);
  const valleySight = crest && place(offset(crest, -.9, 0, 10.2), 7.5);
  const bend = valleySight && place(offset(valleySight, 5.8, 0, 8.3), 7.5);
  const smokeLever = place([44, 8.2, -688], 9);
  if (battery && crest && valleySight && bend && smokeLever) {
    interact(WR.meet, battery); interact(WR.choose, battery); interact(WR.crest, crest);
    interact(WR.valley, valleySight); interact(WR.bend, bend); interact(WR.trigger, smokeLever);
    const art = scenery('WinterGunnerRangeStations');
    table(art, battery); art.paper(...offset(battery, -.27, .92, -.81), .62, .4);
    const marks = [crest, valleySight, bend].map((p, i) => {
      const column = offset(p, .68, .7, -.69);
      art.box(column, [.21, 1.4, .22], wood, true);
      art.ring(offset(column, 0, .61), .26, .039, bronze);
      return mesh(art.root, new THREE.SphereGeometry(.105, 9, 7), materials.beacon, offset(column, 0, .62), 'WinterRangeLock_' + i);
    });
    const rails = scenery('WinterGunnerMillRailings');
    for (const x of [59.5, 66.1]) {
      for (const z of [-610.8, -607.1]) {
        const y = ground(x, z, 7.4) ?? 4;
        rails.box([x, y + .45, z], [.18, .9, .21], faded, true);
      }
      const y = ground(x, -609, 7.4) ?? 4;
      rails.box([x, y + .78, -609], [.17, .17, 4.12], faded, true);
    }
    const railCollider = finish(rails, 'winter', false)!;
    const smokeMaterial = new THREE.MeshStandardMaterial({ color: '#b8c4cc', transparent: true, opacity: 0, depthWrite: false });
    const smoke = group(art.root, offset(smokeLever, 1, 0, -3.8), 'WinterGunnerSmokeVolley');
    for (let i = 0; i < 7; i++) {
      mesh(smoke, new THREE.SphereGeometry(1, 9, 6), smokeMaterial, [(i - 3) * 1.05, .8 + (i % 3) * .33, -.82 * Math.cos(i)]);
    }
    finish(art, 'winter');
    updates.push((done, dt) => {
      marks.forEach((mark, i) => { mark.visible = done.has([WR.crest, WR.valley, WR.bend][i]); });
      rails.root.visible = railCollider.enabled = done.has(WR.rails);
      rangeSmoke = Math.max(0, rangeSmoke - dt);
      smoke.visible = rangeSmoke > 0;
      if (rangeSmoke > 0) {
        const age = 5 - rangeSmoke;
        smoke.scale.setScalar(.48 + age * .29);
        smoke.position.y = smokeLever[1] + age * .42;
        smokeMaterial.opacity = Math.min(.24, rangeSmoke * .1, age * .56);
      }
    });
  }

  const hear = place([222, 2.1, -642], 12), rope = place([229, 2.2, -650], 12);
  const hoist = place([224, 1.5, -653], 10);
  const landing = place([28, 4, -461], 9);
  let bellRing = 0;
  if (hear && rope && hoist && landing) {
    interact(I.hear, hear); interact(I.rope, rope); interact(I.raise, hoist); interact(I.choose, hoist);
    const art = scenery('BerezinaFerryBell');
    const winterCamp = scenery('BerezinaLandingMuster');
    for (const [x, p] of [[-.84, hoist], [.84, hoist]] as const) art.box(offset(p, x, 1.25, -1.18), [.2, 2.5, .23], wood, true);
    art.box(offset(hoist, 0, 2.44, -1.18), [2, .2, .19], wood);
    for (let i = 0; i < 7; i++) {
      const y = i * .095, z = i * .36;
      art.box(offset(hoist, 1.95 + i * .07, .16 + y, -1.8 - z), [.16, .24, .43], i % 3 ? faded : '#8c9ca8', false, 'body', [0, .3, .17]);
      art.box(offset(hoist, 2.43 + i * .1, .08 + y, -1.83 - z), [.17, .22, .45], wood, false, 'body', [0, -.23, .3]);
    }
    const frozenLine = beamMesh(art.root, offset(hear, 0, .45, -.9), offset(rope, 0, .94, -.8), .036);
    const tether = beamMesh(art.root, offset(rope, 0, .94, -.8), offset(hoist, 2.35, .23, -1.5), .046);
    art.box(offset(rope, 0, .56, -.8), [.3, 1.12, .3], wood, true);
    art.ring(offset(rope, 0, .91, -.63), .16, .032, bronze);
    const pin = mesh(art.root, new THREE.BoxGeometry(.32, .27, .24), materials.metal, offset(rope, 0, 1.01, -.55), 'BerezinaBellClevis');
    pin.userData.target = I.pin; pin.visible = false; targets.push(pin);
    const mouth = group(art.root, offset(hoist, 0, .4, -1.18), 'BerezinaRecoveredBell');
    mesh(mouth, new THREE.LatheGeometry([
      new THREE.Vector2(.34, -.38), new THREE.Vector2(.29, -.32), new THREE.Vector2(.21, -.15),
      new THREE.Vector2(.17, .11), new THREE.Vector2(.11, .18), new THREE.Vector2(.04, .2),
    ], 24), materials.metal, [0, 0, 0]);
    mesh(mouth, new THREE.TorusGeometry(.32, .025, 8, 24).rotateX(Math.PI / 2), materials.metal, [0, -.37, 0]);
    mesh(mouth, new THREE.SphereGeometry(.078, 9, 7), materials.dark, [0, -.38, 0]);
    const campMarker = offset(landing, 0, 0, -1.18);
    for (const side of [-1, 1]) winterCamp.box(offset(campMarker, side * .82, 1.26), [.18, 2.52, .2], wood, true);
    winterCamp.box(offset(campMarker, 0, 2.49), [1.93, .2, .19], wood);
    winterCamp.lantern(campMarker[0] + 1.2, campMarker[1] + 1.84, campMarker[2], steel);
    finish(art, 'winter'); finish(winterCamp, 'winter');
    interact(I.test, hoist);
    const bellMarker = markers.at(-1)!;
    let initialized = false;
    updates.push((done, dt) => {
      const atCamp = done.has(I.camp), raised = done.has(I.raise);
      const p = atCamp ? campMarker : offset(hoist, 0, 0, -1.18);
      const y = p[1] + (raised ? 2.04 : .42);
      bellMarker.p[0] = atCamp ? landing[0] : hoist[0];
      bellMarker.p[1] = (atCamp ? landing[1] : hoist[1]) + .9;
      bellMarker.p[2] = atCamp ? landing[2] : hoist[2];
      mouth.position.set(p[0], initialized && !atCamp ? THREE.MathUtils.damp(mouth.position.y, y, 3, dt) : y, p[2]);
      bellRing = Math.max(0, bellRing - dt);
      mouth.rotation.z = Math.sin(bellRing * 15) * bellRing * .2;
      pin.visible = fieldSideReady(I.pin, done);
      tether.visible = !done.has(I.pin) && !done.has(I.rope);
      frozenLine.visible = !raised;
      initialized = true;
    });
  }

  const pond = prior.get('disc_kyokochi')?.p;
  const pavilion = prior.get('disc_kinkaku')?.p;
  if (pond && pavilion) {
    const shore = place(offset(pond, 1.7, 0, -.1), 9);
    if (shore) {
      const base = place(offset(shore, -6.2, 0, 3.2), 6);
      if (base) {
        const upper = offset(base, -5.8, 1.62, 1.7);
        const platform = scenery('KinkakuDispatchOverlook');
        const [x, y, z] = upper;
        platform.box([x, y - .22, z], [5.8, .44, 5.7], faded, true);
        for (const dx of [-2.6, 2.6]) for (const dz of [-2.53, 2.53]) {
          platform.box([x + dx, y - .8, z + dz], [.23, 1.9, .23], wood);
          platform.box([x + dx, y + .56, z + dz], [.13, 1.12, .13], wood, true);
        }
        platform.box([x - 2.64, y + 1.06, z], [.13, .12, 5.3], wood, true);
        platform.lantern(x + 1.8, y + 1.12, z + 2.1, wood);
        platform.lantern(x - 2, y + 1.12, z - 2.05, wood);
        finish(platform, 'kyoto');
        walkway('KinkakuOverlookRamp', 'kyoto', [offset(base, .3, .06, -.1), offset(upper, 2.15, .035, -.15)], 1.9, faded, true);
        const short = walkway('KinkakuServiceWalk', 'kyoto', [offset(shore, -.4, .08, 1.35), offset(upper, 1, .05, -2.17)], 1.8, faded, false);
        interact(K.shore, shore); interact(K.upper, offset(upper, 0, 0, .87)); interact(K.inspect, offset(upper, -.3, 0, -1.54));
        const sight = scenery('KinkakuTwoFacedFlag');
        const post = offset(upper, 1.15, 0, -.45);
        const flag = group(sight.root, offset(post, 0, 2.16), 'KinkakuDispatchCloth');
        flag.rotation.y = Math.atan2(shore[0] - x, shore[2] - z);
        const cloth = new THREE.PlaneGeometry(1.25, .84, 7, 4);
        const other = cloth.clone().rotateY(Math.PI);
        mesh(flag, cloth, materials.blue, [.59, 0, .014]);
        mesh(flag, other, materials.red, [.59, 0, -.014]);
        for (const side of [-1, 1]) mesh(flag, new THREE.CircleGeometry(.14, 6).rotateY(side < 0 ? Math.PI : 0),
          materials.metal, [.64, .04, side * .022]);
        sight.cyl(offset(post, 0, 1.3), .15, 2.6, wood);
        sight.cyl(offset(post, 0, 2.67), .12, .12, bronze);
        const waterGlint = mesh(sight.root, new THREE.PlaneGeometry(.62, .21).rotateX(-Math.PI / 2),
          materials.red, offset(shore, 1.18, .035, -1.65), 'KinkakuRedReflection');
        waterGlint.scale.set(1, 1, .4);
        finish(sight, 'kyoto');
        let elapsed = 0;
        updates.push((done, dt, p) => {
          short.art.root.visible = short.collider.enabled = done.has(K.inspect);
          if (Math.abs(p.x - x) + Math.abs(p.z - z) > 65) return;
          elapsed += dt;
          const sway = Math.sin(elapsed * 2.5) * .045;
          flag.rotation.z = sway;
          waterGlint.scale.x = .86 + Math.sin(elapsed * 3.4) * .14;
        });
      }
    }
  }

  let paperLineT = 0;
  const riverbank = prior.get('disc_tobiishi')?.p;
  if (riverbank) {
    const register = place(offset(riverbank, -35, 1.8, -12), 12);
    const decision = register && place(offset(register, -4.5, 0, 1), 7.5);
    const handoff = decision && place(offset(decision, 0, 0, -5.8), 6);
    if (register && decision && handoff) {
      interact(KP.register, register); interact(KP.choice, decision); interact(KP.return, decision);
      const shelter = scenery('KyotoProtectedHandoff');
      table(shelter, register); shelter.paper(...offset(register, -.1, .904, -.87), .6, .35);
      const screenPoint = offset(decision, 0, 0, -2.3);
      const door = mesh(shelter.root, new THREE.BoxGeometry(2.46, 1.87, .13), materials.dark, offset(screenPoint, 0, .93), 'KyotoHandoffShutter');
      const g = door.geometry.clone().translate(...door.position.toArray());
      const gate = { name: 'COL_KyotoHandoffShutter', bvh: new MeshBVH(g), enabled: true };
      colliders.push(gate);
      for (const x of [-1.45, 1.45]) {
        shelter.box(offset(screenPoint, x, 1.35), [.21, 2.7, .22], wood, true);
        shelter.box(offset(screenPoint, x * 1.66, .75), [1.65, 1.5, .18], faded, true);
      }
      shelter.box(offset(screenPoint, 0, 2.7, -1.2), [5.5, .17, 3.3], '#775350', true);
      table(shelter, handoff);
      const workPass = mesh(shelter.root, new THREE.BoxGeometry(.27, .36, .041), materials.beacon, offset(screenPoint, 1.56, 1.45, .14), 'KyotoWorkNumberPass');
      const registry = mesh(shelter.root, new THREE.BoxGeometry(.46, .14, .31), materials.red, offset(handoff, .25, .99, -.8), 'KyotoSealedNames');
      const family = createSettlementNpcs([
        { id: 'kyoto_pass_kenta', role: ['搬运工健太', 'Kenta the porter'], region: 'kyoto',
          position: offset(decision, -1.35, 0, -.35), appearance: { coat: 0x466069, carry: 'sack' }, lines: [] },
        { id: 'kyoto_pass_household', role: ['健太的家人', 'Kenta’s family'], region: 'kyoto',
          position: offset(decision, 1.35, 0, -.35), appearance: { coat: 0x805742, carry: 'sack' }, lines: [] },
      ]);
      shelter.root.add(family.group); actorCleanup.push(() => family.dispose());
      const walkers = family.group.children.map(residentWalkRig);
      finish(shelter, 'kyoto');
      let left = 0, initialized = false;
      updates.push((done, dt, player) => {
        const sealed = done.has(KP.sealed), departing = done.has(KP.family);
        if (!departing) left = 0;
        else if (!initialized) left = 1;
        else if (left < 1) left = Math.min(1, left + dt / 5);
        initialized = true;
        door.position.y = screenPoint[1] + (sealed ? 3.51 : .93);
        gate.enabled = !sealed;
        workPass.visible = registry.visible = sealed;
        family.group.visible = done.has(KP.register) && left < 1;
        if (!family.group.visible || Math.hypot(player.x - decision[0], player.z - decision[2]) > 55) return;
        family.update(dt, player);
        family.group.children.forEach((resident, i) => {
          const x = decision[0] + (i ? 1.35 : -1.35), z = decision[2] - .35 + left * 8.4;
          resident.position.x = x; resident.position.z = z;
          walkers[i].update(left * 45, departing && left < 1, (ground(x, z, decision[1] + 1.3) ?? decision[1]) - decision[1]);
        });
      });
    }

    const shop = place(offset(riverbank, -38, 2.5, 17), 13.5);
    const farStreet = shop && place(offset(shop, -12, 0, 3.6), 7.5);
    const landing = farStreet && place(offset(farStreet, -5.55, 0, 3.1), 7.5);
    if (shop && farStreet && landing) {
      const art = scenery('KyotoKamoPaperRoofs'), paper = '#dbcba9';
      const nearRoof = offset(shop, -5.55, 2.15, -.25), farRoof = offset(farStreet, .9, 2.15, -1.1);
      interact(KL.shop, shop); interact(KL.rooftop, nearRoof);
      interact(KL.counterweight, offset(farRoof, .67, .22, -1.32)); interact(KL.courier, landing);
      walkway('KyotoPaperShopRamp', 'kyoto', [offset(shop, 0, .03), offset(nearRoof, 1.92, .035, -.12)], 2.12, faded, true);
      const direction = new THREE.Vector3(farRoof[0] - nearRoof[0], 0, farRoof[2] - nearRoof[2]).normalize();
      const edge = Math.min(1.675 / Math.abs(direction.x), 1.575 / Math.abs(direction.z)) + .16;
      const dx = direction.x * edge, dz = direction.z * edge;
      walkway('KyotoPaperRoofBeam', 'kyoto', [offset(nearRoof, dx, .028, dz), offset(farRoof, -dx, .028, -dz)], 1.78, faded, true);
      const farRamp = walkway('KyotoPaperRoofShortcut', 'kyoto',
        [offset(farRoof, -1.79, .025, .56), offset(landing, 0, .05)], 1.89, faded, false);
      table(art, shop); art.paper(...offset(shop, -.11, .91, -.81), .5, .35);
      for (const [i, p] of [nearRoof, farRoof].entries()) {
        art.box(offset(p, 0, -.16), [3.35, .32, 3.15], wood, true);
        for (const x of [-1.45, 1.45]) for (const z of [-1.25, 1.25])
          art.box(offset(p, x, -1.16, z), [.16, 2.32, .16], faded, true);
        art.box(offset(p, .84, .93, -1.14), [.16, 1.86, .16], faded);
        art.ring(offset(p, .84, 1.5, -1.04), .17, .048, steel, 'metal');
        art.lantern(p[0] - .95, p[1] + .35, p[2] + 1.11, wood);
        for (let j = 0; j < 4; j++) art.box(offset(p, -.74 + j * .46, .46, -1.35), [.38, .71, .025], i === 1 ? paper : '#bcb69d');
      }
      const start = offset(nearRoof, .84, 1.47, -1.11), end = offset(farRoof, .84, 1.47, -1.11);
      art.beam(start, end, .025, steel);
      const weight = mesh(art.root, new THREE.BoxGeometry(.33, .43, .34), materials.metal, offset(farRoof, .83, 1.22, -1.12), 'KyotoJammedPaperWeight');
      const carrier = group(art.root, start, 'KyotoPaperSampleCarrier');
      mesh(carrier, new THREE.BoxGeometry(.58, .08, .12), materials.dark, [0, -.04, 0]);
      const sample = new THREE.MeshStandardMaterial({ color: paper, roughness: 1, side: THREE.DoubleSide });
      mesh(carrier, new THREE.PlaneGeometry(.47, .7), sample, [0, -.45, -.04]);
      finish(art, 'kyoto');
      const from = new THREE.Vector3(...start), to = new THREE.Vector3(...end);
      let initialized = false;
      updates.push((done, dt) => {
        const released = done.has(KL.counterweight);
        farRamp.art.root.visible = farRamp.collider.enabled = released;
        const rest = farRoof[1] + (released ? .43 : 1.22);
        weight.position.y = initialized ? THREE.MathUtils.damp(weight.position.y, rest, 6, dt) : rest;
        initialized = true;
        carrier.visible = released;
        if (paperLineT > 0) paperLineT = Math.max(0, paperLineT - dt / 3.8);
        carrier.position.copy(from).lerp(to, 1 - paperLineT);
        carrier.rotation.z = Math.sin(paperLineT * 24) * .15 * paperLineT;
      });
    }
  }

  const desk = place(offset(residence, 4.5, 0, -3), 9);
  const aerial = desk && place(offset(desk, -9, 1.8, -14), 12);
  if (desk && aerial) {
    interact(V.desk, desk); interact(V.return, desk); interact(V.listen, desk); interact(V.repeater, aerial);
    const art = scenery('ValleyCommunityBroadcast');
    table(art, desk, steel);
    const casework = offset(desk, -.13, 1.13, -.84);
    art.box(casework, [.92, .43, .4], '#5b706a');
    art.box(offset(casework, .19, .04, .205), [.43, .17, .03], '#b8bc92');
    for (let i = 0; i < 5; i++) art.box(offset(casework, -.23, -.105 + i * .05, .213), [.23, .022, .024], wood);
    art.cyl(offset(aerial, 0, 1.4, -.96), .18, 2.8, steel, true);
    const antenna = group(art.root, offset(aerial, 0, 2.35, -.96), 'ValleyShortwaveAerial');
    beamMesh(antenna, [-.84, -.03, 0], [.84, -.03, 0], .04, materials.dark);
    for (let i = 0; i < 5; i++) {
      const dx = (i - 2) * .34;
      beamMesh(antenna, [dx, 0, -.52 + i * .06], [dx, 0, .52 - i * .06], .019);
    }
    const readyLight = mesh(art.root, new THREE.SphereGeometry(.047, 12, 7), materials.beacon, offset(casework, .35, -.13, .22));
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const x = THREE.MathUtils.lerp(desk[0], aerial[0], t), z = THREE.MathUtils.lerp(desk[2], aerial[2], t);
      const y = ground(x, z, Math.max(desk[1], aerial[1]) + 2);
      if (y !== null && y > water) art.box([x, y + .03, z], [.22, .065, .32], steel);
    }
    finish(art, 'alpha');
    let initialized = false;
    updates.push((done, dt) => {
      const target = done.has(V.repeater) ? 1.08 : -.85;
      antenna.rotation.y = initialized ? THREE.MathUtils.damp(antenna.rotation.y, target, 4.8, dt) : target;
      readyLight.visible = done.has(V.return);
      initialized = true;
    });
  }

  let seedTravel = 0;
  const [ex, ez] = egyptToWorld(-178, 112);
  const seedYard = place([ex, 14.2, ez], 10.5);
  const seedWinch = seedYard && place(offset(seedYard, 4.4, 0, -2.8), 6);
  const seedRack = seedWinch && place(offset(seedWinch, -2.4, .1, -6.6), 6);
  if (seedYard && seedWinch && seedRack) {
    interact(E.yard, seedYard); interact(E.cart, seedWinch); interact(E.rack, seedRack);
    const art = scenery('EgyptSeedJarYard');
    const cart = group(art.root, [0, 0, 0], 'EgyptSeedRailCart');
    mesh(cart, new THREE.BoxGeometry(.97, .15, 1.42), materials.wood, [0, .25, 0]);
    for (const x of [-.49, .49]) for (const z of [-.43, .43])
      mesh(cart, new THREE.CylinderGeometry(.155, .155, .075, 12).rotateZ(Math.PI / 2), materials.dark, [x, .15, z]);
    const clay = new THREE.MeshStandardMaterial({ color: '#bc8258', roughness: .8 });
    for (let i = 0; i < 3; i++) {
      const jar = group(cart, [(i % 2 ? 1 : -1) * .23, .31, i < 2 ? -.35 : .33], 'EgyptSealedSeedJar');
      mesh(jar, new THREE.LatheGeometry([[.1, 0], [.145, .04], [.195, .19], [.178, .34], [.108, .44], [.113, .48]]
        .map(([r, y]) => new THREE.Vector2(r, y)), 14), clay, [0, 0, 0]);
      mesh(jar, new THREE.CylinderGeometry(.113, .115, .054, 12), materials.wood, [0, .49, 0]);
      mesh(jar, new THREE.TorusGeometry(.113, .019, 5, 14).rotateX(Math.PI / 2), materials.blue, [0, .447, 0]);
    }
    const from = new THREE.Vector3(...offset(seedYard, -.54, .03, -.97));
    const to = new THREE.Vector3(...offset(seedRack, 0, .23, -.97));
    const direction = to.clone().sub(from).normalize();
    const tangent = new THREE.Vector3(direction.z, 0, -direction.x);
    for (const x of [-.46, .46]) art.beam(from.clone().addScaledVector(tangent, x).toArray(),
      to.clone().addScaledVector(tangent, x).toArray(), .062, steel);
    for (let i = 0; i <= 12; i++) {
      const p = from.clone().lerp(to, i / 12); p.y -= .058;
      art.box(p.toArray(), [1.24, .075, .2], wood, false, 'body', [0, Math.atan2(direction.x, direction.z), 0]);
    }
    art.box(offset(seedWinch, 0, .53, -.77), [.46, 1.06, .39], steel, true);
    art.ring(offset(seedWinch, .18, .96, -.54), .24, .041, bronze, 'metal');
    art.box(offset(seedRack, 0, .21, -.97), [1.5, .42, 1.84], faded);
    art.box(offset(seedRack, 0, .15, 1.95), [3.4, .29, 2.18], '#69523c', true);
    const crops = scenery('EgyptTestPlantings');
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) {
      const point = offset(seedRack, (i - 2.5) * .46, .42, 1.27 + row * .63);
      for (const side of [-1, 1]) crops.box(offset(point, side * .024), [.068, .3, .025],
        (row + i) % 2 ? '#709b4b' : '#87a758', false, 'body', [0, side * .29, side * .48]);
    }
    finish(art, 'alpha'); finish(crops, 'alpha');
    let initialized = false;
    const cord = mesh(cart, new THREE.BoxGeometry(.055, .045, 1.23), materials.blue, [0, .55, -.1]);
    updates.push((done, dt) => {
      if (!done.has(E.cart)) seedTravel = 0;
      else if (!initialized || done.has(E.rack)) seedTravel = 1;
      else seedTravel = Math.min(1, seedTravel + dt * .61);
      cart.position.copy(from).lerp(to, THREE.MathUtils.smoothstep(seedTravel, 0, 1));
      cart.rotation.y = Math.atan2(direction.x, direction.z);
      cord.visible = !done.has(E.rack);
      crops.root.visible = done.has(E.rack) && done.has(JOURNEY.egyptDone);
      initialized = true;
    });
  }

  function hingedScreen(art: SiteArt, p: Point, name: string, width: number, color: THREE.Material) {
    const panel = group(art.root, offset(p, -width / 2, 0), name);
    mesh(panel, new THREE.BoxGeometry(width, 1.78, .12), color, [width / 2, .89, 0]);
    for (const height of [.24, 1.41]) mesh(panel, new THREE.BoxGeometry(width, .11, .22), materials.dark, [width / 2, height, 0]);
    mesh(panel, new THREE.TorusGeometry(.087, .019, 7, 12), materials.metal, [width - .14, .97, .087]);
    const geometry = new THREE.BoxGeometry(width, 1.79, .16).translate(p[0], p[1] + .9, p[2]);
    const collider: Collider = { name: 'COL_' + name, enabled: true, bvh: new MeshBVH(geometry) };
    colliders.push(collider);
    return { panel, collider };
  }

  const soupPot = place([-786, 14, -1368], 10.5);
  const soupGate = soupPot && place(offset(soupPot, 4.1, 0, -.4), 6);
  const soupShare = soupGate && place(offset(soupGate, 0, 0, -4.75), 6);
  if (soupPot && soupGate && soupShare) {
    interact(O.pot, soupPot); interact(O.gate, soupGate); interact(O.share, soupShare); interact(O.bowl, soupShare);
    const art = scenery('OrleansWorkshopSoupLane');
    const gate = hingedScreen(art, offset(soupGate, 0, 0, -.97), 'OrleansWorkshopSideGate', 2.5, materials.wood);
    for (const side of [-1, 1]) {
      art.box(offset(soupGate, side * 2.85, .88, -.98), [3.22, 1.76, .24], faded, true);
      art.box(offset(soupGate, side * 1.3, 1.08, -.98), [.18, 2.16, .29], steel, true);
    }
    table(art, soupPot); table(art, soupShare);
    art.cyl(offset(soupPot, 0, 1.05, -.88), .33, .36, '#473c34', false, 'metal');
    art.ring(offset(soupPot, 0, 1.21, -.88), .285, .035, bronze, 'metal', [Math.PI / 2, 0, 0]);
    art.lantern(soupPot[0] - .87, soupPot[1] + 1.36, soupPot[2] - .92);
    for (const x of [-.4, .4]) art.cyl(offset(soupShare, x, .956, -.82), .23, .11, '#c2966e');
    const ration = mesh(art.root, new THREE.CylinderGeometry(.193, .09, .116, 14), materials.metal, offset(soupShare, 0, .969, -.66), 'OrleansSharedBowl');
    finish(art, 'alpha');
    let initial = true;
    updates.push((done, dt) => {
      gate.collider.enabled = !done.has(O.gate);
      const angle = gate.collider.enabled ? 0 : -1.36;
      gate.panel.rotation.y = initial ? angle : THREE.MathUtils.damp(gate.panel.rotation.y, angle, 7, dt);
      ration.visible = done.has(O.share) && !done.has(O.bowl);
      initial = false;
    });
  }

  const [qx, qz] = qinToWorld(153, -97);
  const quiet = place([qx, 46, qz], 10.5);
  const qinLatch = quiet && place(offset(quiet, 4.3, 0, -1.5), 6);
  const drawing = qinLatch && place(offset(qinLatch, .16, 0, -5.75), 6);
  if (quiet && qinLatch && drawing) {
    interact(Q.alcove, quiet); interact(Q.door, qinLatch); interact(Q.sketch, drawing); interact(Q.supplies, drawing);
    const art = scenery('QinFoundryQuietRecess');
    const screen = hingedScreen(art, offset(qinLatch, 0, 0, -1.03), 'QinQuietRoomDoor', 1.92, materials.dark);
    for (const side of [-1, 1]) {
      art.box(offset(qinLatch, side * 1.68, 1.25, -2.2), [.24, 2.5, 2.6], '#75665a', true);
      art.box(offset(drawing, side * 1.87, 1.26, .38), [.21, 2.52, 2.74], '#75665a', true);
      art.box(offset(qinLatch, side * 1.11, 1.12, -1.13), [.25, 2.24, .22], steel, true);
    }
    art.box(offset(drawing, 0, 1.29, -1.11), [3.9, 2.58, .21], '#907e68', true);
    art.box(offset(drawing, 0, 1.34, -.981), [1.43, .99, .016], '#bca78b');
    const a = offset(drawing, -.42, 1.11, -.96), b = offset(drawing, .42, 1.11, -.96);
    const c = offset(drawing, .42, 1.58, -.96), d = offset(drawing, -.42, 1.58, -.96), e = offset(drawing, 0, 1.83, -.96);
    for (const [from, to] of [[a, b], [b, c], [c, e], [e, d], [d, a]])
      art.beam(from, to, .018, '#4e463c');
    for (let i = 0; i < 4; i++)
      art.box(offset(drawing, -.24 + i * .12, 1.26 + i * .075, -.956), [.097, .019, .015], '#554f40');
    art.lantern(drawing[0] + 1.18, drawing[1] + 1.66, drawing[2] - .94, steel);
    const cache = mesh(art.root, new THREE.BoxGeometry(.49, .28, .38), materials.wood, offset(drawing, .94, .41, -.73), 'QinQuietRoomCache');
    art.box(offset(drawing, .94, .14, -.73), [.73, .28, .54], '#796957');
    finish(art, 'alpha');
    let initial = true;
    updates.push((done, dt) => {
      screen.collider.enabled = !done.has(Q.door);
      const angle = screen.collider.enabled ? 0 : 1.46;
      screen.panel.rotation.y = initial ? angle : THREE.MathUtils.damp(screen.panel.rotation.y, angle, 6, dt);
      cache.visible = done.has(Q.sketch) && !done.has(Q.supplies);
      initial = false;
    });
  }

  const sky = scenery('SkyCrownCrewQuarters');
  const log = offset(DECK.hall.p, -12, 0, -11), play = offset(DECK.hall.p, -19, 0, -11);
  const start = offset(DECK.service.p, 9, 0, -6), repair = offset(DECK.service.p, 18, 0, 4);
  const medicine = offset(DECK.court.p, -7, 0, 5), lookout = offset(DECK.back.p, -8, 0, -8);
  for (const [id, point] of [[S.log, log], [S.playback, play], [S.conduit, start], [S.repair, repair], [S.medicine, medicine], [S.lookout, lookout]] as const)
    interact(id, point);
  const [lx, ly, lz] = log;
  sky.box([lx, ly + 1.63, lz - 3], [5.8, 3.26, .19], steel, true);
  sky.box([lx, ly + 3.32, lz - 1.15], [6, .24, 3.8], steel, true);
  sky.box([lx - 2.8, ly + 1.65, lz - 1.55], [.2, 3.3, 2.9], steel, true);
  sky.lantern(lx + 1.7, ly + 2.46, lz - 2.72);
  table(sky, offset(log, .35, 0, -1.44)); sky.paper(...offset(log, .35, .913, -2.26), .83, .53);
  sky.box(offset(log, -1.56, .42, -1.86), [.82, .82, 1.52], '#9b8263');
  table(sky, play, steel);
  const reel = group(sky.root, offset(play, -.34, 1.28, -.86), 'SkyOriginalRescueReel');
  for (const side of [-1, 1]) {
    mesh(reel, new THREE.CylinderGeometry(.22, .22, .045, 15).rotateX(Math.PI / 2), materials.dark, [side * .31, 0, 0]);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      mesh(reel, new THREE.BoxGeometry(.07, .1, .024), materials.metal,
        [side * .31 + Math.cos(a) * .09, Math.sin(a) * .09, .027]).rotation.z = a;
    }
  }
  const projection = group(sky.root, offset(play, .35, 1.06, -.65), 'SkyRescueMemoryProjection');
  const memoryLight = new THREE.MeshBasicMaterial({ color: '#7fd1c4', transparent: true, opacity: .75, depthWrite: false });
  const memoryWarm = new THREE.MeshBasicMaterial({ color: '#f0b97c', transparent: true, opacity: .7, depthWrite: false });
  const projectionRail = mesh(projection, new THREE.BoxGeometry(1.53, .036, .38), memoryLight, [0, 0, 0]);
  projectionRail.rotation.x = -.12;
  function memoryFigure(name: string, material: THREE.Material, x: number, scale: number) {
    const puppet = group(projection, [x, .025, 0], name);
    mesh(puppet, new THREE.CylinderGeometry(.085, .135, .26, 7), material, [0, .15, 0]);
    mesh(puppet, new THREE.SphereGeometry(.071, 11, 8), material, [0, .336, 0]);
    puppet.scale.setScalar(scale);
    return puppet;
  }
  const operator = memoryFigure('MemoryHelion', memoryWarm, -.49, 1.12);
  const evacuees = [memoryFigure('MemoryFirstEvacuee', memoryLight, .58, .85), memoryFigure('MemoryLastEvacuee', memoryLight, .77, .72)];
  const conduit = mesh(sky.root, new THREE.CylinderGeometry(.085, .085, 1.36, 10).rotateZ(Math.PI / 2), materials.metal, offset(repair, 0, .83, -.8), 'SkyLooseLifeContact');
  for (const p of [start, repair]) table(sky, p, steel);
  for (const x of [-.36, .36]) sky.ring(offset(start, x, 1.04, -.65), .16, .031, glass, 'glow');
  const route = [offset(start, .77, .11, -.82), offset(start, 3, .11, -.82), offset(repair, -3.2, .11, -.79), offset(repair, -.68, .11, -.79)];
  for (let i = 1; i < route.length; i++) sky.beam(route[i - 1], route[i], .11, steel);
  sky.box(offset(medicine, 0, .69, -.84), [.78, 1.38, .48], steel, true);
  sky.box(offset(medicine, 0, .98, -.576), [.44, .39, .04], '#f5e2c4');
  for (const size of [[.06, .23, .022], [.23, .06, .022]] as const) sky.box(offset(medicine, 0, .98, -.55), [...size], '#a34a46');
  const light = mesh(sky.root, new THREE.SphereGeometry(.09, 12, 7), materials.beacon, offset(medicine, 0, 1.34, -.55), 'SkyReserveStatus');
  table(sky, lookout, steel);
  const signal = mesh(sky.root, new THREE.SphereGeometry(.21, 12, 7), materials.beacon, offset(lookout, 0, 1.2, -.86), 'SkyLookoutLamp');
  const reply = mesh(sky.root, new THREE.SphereGeometry(.19, 12, 7), materials.beacon, offset(residence, -3.9, 2.2, 2.6), 'ValleyReplyLamp');
  finish(sky, 'alpha');
  let time = 0, pulse = 0, sent = false, playbackTime = 0;
  updates.push((done, dt) => {
    time += dt;
    if (done.has(S.playback)) {
      playbackTime += dt;
      reel.rotation.z += dt * 1.75;
    } else playbackTime = 0;
    projection.visible = done.has(S.playback);
    const passage = THREE.MathUtils.smoothstep(playbackTime, .45, 4.2);
    for (let i = 0; i < evacuees.length; i++) {
      const figure = evacuees[i];
      figure.position.x = .59 + i * .16 - passage * (.63 + i * .04);
      figure.position.y = .025 + Math.sin(passage * Math.PI * 8 - i * .7) * .024 * (1 - passage);
    }
    operator.rotation.z = -.11 * Math.sin(passage * Math.PI);
    memoryLight.opacity = .66 + .1 * Math.sin(playbackTime * 11);
    conduit.rotation.z = THREE.MathUtils.damp(conduit.rotation.z, done.has(S.repair) ? 0 : -.26, 7, dt);
    light.visible = done.has(S.repair) && !done.has(S.medicine);
    if (done.has(S.lookout) && !sent) pulse = 3.5;
    sent = done.has(S.lookout);
    pulse = Math.max(0, pulse - dt);
    signal.scale.setScalar(1 + .44 * (pulse > 1.8 ? Math.max(0, Math.sin(time * 8)) : 0));
    reply.scale.setScalar(1 + .44 * (pulse > 0 && pulse <= 1.8 ? Math.max(0, Math.sin(time * 8)) : 0));
    reply.visible = sent;
  });

  return {
    root, markers, colliders, targets,
    get royalFerry() { return ferry; },
    get workboatReady() { return workboatReady; },
    setWorkboatBattle(active: boolean) { workboatBattle = active; },
    turnWreckDeck(id: string) { return adjustWreck?.(id) ?? false; },
    startChipToss(choice: 'left' | 'right', first: boolean) { return startChipToss?.(choice, first) ?? false; },
    readChipOutcome() { const result = chipOutcome; chipOutcome = null; return result; },
    smokeVolley() { rangeSmoke = 5; },
    sendPaper() { paperLineT = 1; },
    ring() { bellRing = 1.25; },
    seedsArrived() { return seedTravel >= 1; },
    apply(done: ReadonlySet<string>, dt: number, p: THREE.Vector3) { updates.forEach(update => update(done, dt, p)); },
    dispose() {
      actorCleanup.forEach(dispose => dispose());
      root.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose(); });
      for (const c of colliders) c.bvh.geometry.dispose();
      const owned = new Set<THREE.Material>([...artMaterials, ...Object.values(materials)]);
      root.traverse(node => { if (node instanceof THREE.Mesh && !Array.isArray(node.material)) owned.add(node.material); });
      for (const material of owned) material.dispose();
      root.removeFromParent();
    },
  };
}
