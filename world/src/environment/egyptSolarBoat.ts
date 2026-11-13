import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider, Player } from '../player/player';
import { mergeParts } from '../settlements/merge';
import { EGYPT_OFFSET } from '../map/egyptPlan';
import type { Marker } from '../core/types';
import type { Localized } from '../settlements/types';
import { SiteArt } from '../story/campaignSites';
import { EGYPT_HIGH_CHANNEL, EGYPT_COLUMN_CHANNEL } from '../map/egyptRiverworksPlan';

export const EGYPT_SOLAR_BOAT = {
  lower: 'egypt_solar_boat_lower', temple: 'egypt_solar_boat_temple',
  helm: 'egypt_solar_boat_helm', arrived: 'egypt_solar_boat_arrived',
  survey: 'egypt_upper_water_survey', evidence: 'egypt_upper_water_evidence',
  shield: 'egypt_solar_boat_shield', shieldRaised: 'egypt_solar_boat_shield_raised',
} as const;
export const SOLAR_BOAT_LABELS = new Map<string, Localized>([
  [EGYPT_SOLAR_BOAT.lower, ['高渠栈台 · 呼叫或搭乘太阳舟', 'High-channel landing · Call or board the solar boat']],
  [EGYPT_SOLAR_BOAT.temple, ['神庙后场 · 太阳舟返航', 'Temple working side · Return by solar boat']],
  [EGYPT_SOLAR_BOAT.helm, ['太阳舟 · 操作舵柄', 'Solar boat · Work the tiller']],
  [EGYPT_SOLAR_BOAT.survey, ['检修观景台 · 记录逆流', 'Inspection overlook · Record the reversed flow']],
  [EGYPT_SOLAR_BOAT.shield, ['船匠侧板 · 收放掩体', 'Shipwright’s side panel · Fold or raise cover']],
]);
export type SolarBoatRoute = 'main' | 'columns';
const B = EGYPT_SOLAR_BOAT;
const DECK_Y = .62;
const HELM = new THREE.Vector3(0, DECK_Y + 1, -.92);

/** The ordinary player capsule walks the moving deck and can jump to either bank. */
export function createEgyptSolarBoat() {
  const root = new THREE.Group(); root.name = 'EgyptSolarBoatRoute';
  const vessel = new THREE.Group(); vessel.name = 'EgyptSolarBoat'; root.add(vessel);
  const art = new SiteArt(), brass = '#bd9b52', blue = '#487d85', wood = '#98724b';
  const outline = [[0, -1.95], [1.02, -1.15], [1.02, 1.12], [0, 1.95], [-1.02, 1.12], [-1.02, -1.15]];
  const hull: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length],
      rimA = [a[0], .42, a[1]], rimB = [b[0], .42, b[1]],
      keelA = [a[0] * .57, -.24, a[1] * .8], keelB = [b[0] * .57, -.24, b[1] * .8];
    hull.push(...rimA, ...keelA, ...rimB, ...rimB, ...keelA, ...keelB);
    art.beam(rimA as [number, number, number], rimB as [number, number, number], .09, brass);
  }
  const hullGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(hull, 3));
  hullGeometry.computeVertexNormals(); art.add(hullGeometry, blue, [0, 0, 0]); hullGeometry.dispose();
  art.box([0, DECK_Y - .06, 0], [1.96, .12, 2.9], wood, true);
  for (let z = -1.3; z < 1.4; z += .22) art.box([0, DECK_Y + .008, z], [1.88, .015, .025], '#d5bd82');
  for (const x of [-.92, .92]) {
    for (const z of [-1.25, -.48, .48, 1.25]) art.box([x, .93, z], [.08, .62, .08], brass, true);
    for (const side of [-1, 1]) art.beam([x, 1.22, side * .48], [x, 1.22, side * 1.25], .08, brass, true);
  }
  for (const z of [-1.68, 1.68]) { art.box([0, .8, z], [.16, .8, .16], brass); art.ring([0, 1.3, z], .22, .045, brass); }
  art.box([0, .82, -1.2], [.62, .4, .36], '#c8b085', true);
  art.beam([0, .96, -1.28], [.27, 1.09, -.61], .09, brass);
  art.box([0, .96, 1.29], [1.48, .69, .16], '#bd9b52', true);
  for (const x of [-.57, 0, .57]) art.box([x, 1.03, 1.19], [.31, .48, .05], blue);
  const geometry = mergeParts(art.solids);
  art.solids.forEach(solid => solid.dispose()); art.solids.length = 0;
  const collider: Collider = { name: 'COL_EgyptSolarBoat', bvh: new MeshBVH(geometry), enabled: true };
  const base = Float32Array.from(geometry.attributes.position.array);
  art.finish('alpha'); vessel.add(art.root);
  const shield = new SiteArt();
  shield.box([0, .62, 0], [.12, 1.24, 1.8], wood, true);
  for (const z of [-.76, .76]) shield.box([-.075, .62, z], [.035, 1.24, .09], brass);
  shield.ring([-.1, .25, -.57], .09, .025, brass, 'metal', [0, Math.PI / 2, 0]);
  const shieldGeometry = mergeParts(shield.solids);
  shield.solids.forEach(solid => solid.dispose()); shield.solids.length = 0;
  const shieldBase = Float32Array.from(shieldGeometry.attributes.position.array);
  const shieldCollider: Collider = { name: 'COL_EgyptSolarBoatShield', bvh: new MeshBVH(shieldGeometry), enabled: false };
  shield.finish('alpha'); shield.root.name = 'EgyptSolarBoatRepairedShield'; shield.root.visible = false;
  shield.root.position.set(1.04, DECK_Y, .15); vessel.add(shield.root);
  let repairedShield = false, raisedShield = false;
  const landmarks = new SiteArt();
  const landingLocal = [[-17, 24.3, 86.5], [-1.8, 36.3, -146]] as const;
  for (const [x, y, z] of landingLocal) {
    landmarks.cyl([x + 1.7, y + .65, z + 1.1], .12, 1.3, brass);
    landmarks.ring([x + 1.7, y + 1.35, z + 1.1], .3, .05, brass);
    landmarks.lantern(x + 1.7, y + 1.95, z + 1.1);
  }
  const frame = new THREE.Matrix4().makeRotationY(Math.PI); frame.setPosition(EGYPT_OFFSET[0], 0, EGYPT_OFFSET[1]);
  landmarks.relocate(frame); landmarks.finish('alpha'); root.add(landmarks.root);
  const routes = {
    main: EGYPT_HIGH_CHANNEL.map(p => new THREE.Vector3(...p).applyMatrix4(frame)),
    columns: EGYPT_COLUMN_CHANNEL.map(p => new THREE.Vector3(...p).applyMatrix4(frame)),
  };
  const landings = landingLocal.map(p => new THREE.Vector3(...p).applyMatrix4(frame));
  const markers: Marker[] = [
    ...landings.map((p, i): Marker => { const id = i ? B.temple : B.lower; return { id, type: 'interact', p: [p.x, p.y + 1.1, p.z], radius: 2.8, label: SOLAR_BOAT_LABELS.get(id)![0] }; }),
    { id: B.helm, type: 'interact', p: [0, 0, 0], radius: 2.45, label: SOLAR_BOAT_LABELS.get(B.helm)![0] },
    { id: B.survey, type: 'interact', p: new THREE.Vector3(4.1, 37.4, -146).applyMatrix4(frame).toArray(), radius: 2.4, label: SOLAR_BOAT_LABELS.get(B.survey)![0] },
    { id: B.shield, type: 'interact', p: [0, 0, 0], radius: 1.15, label: SOLAR_BOAT_LABELS.get(B.shield)![0] },
  ];
  type Side = 0 | 1;
  type Leg = { to: Side; route: SolarBoatRoute | null; path: THREE.Vector3[]; section: number; distance: number; called: boolean;
    atFork: boolean; mooring: boolean; idle: number };
  let dock: Side = 0, leg: Leg | null = null;
  let arrival: { point: THREE.Vector3; side: Side; route: SolarBoatRoute } | null = null;
  const seat = new THREE.Vector3(), forward = new THREE.Vector3(), deckFoot = new THREE.Vector3();
  const heading = new THREE.Quaternion(), inverse = new THREE.Quaternion(), scratch = new THREE.Vector3();
  function placeShield() {
    shield.root.visible = repairedShield;
    // Fold against the outside hull, away from the player's feet and the tiller.
    shield.root.rotation.z = raisedShield ? 0 : Math.PI;
    shieldCollider.enabled = repairedShield && raisedShield && root.visible;
    markers[4].p = scratch.set(.45, DECK_Y + .75, .85).applyQuaternion(vessel.quaternion).add(vessel.position).toArray();
    if (!shieldCollider.enabled) return;
    const positions = shieldGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      scratch.fromArray(shieldBase, i * 3).add(shield.root.position).applyQuaternion(vessel.quaternion).add(vessel.position);
      positions.setXYZ(i, scratch.x, scratch.y, scratch.z);
    }
    positions.needsUpdate = true; shieldCollider.bvh.refit();
  }
  function aboard(player: Pick<Player, 'pos' | 'flying' | 'swimming' | 'gliding'>) {
    if (player.flying || player.swimming || player.gliding) return false;
    scratch.copy(player.pos).sub(vessel.position).applyQuaternion(inverse);
    return Math.abs(scratch.x) <= 1.08 && Math.abs(scratch.z) <= 1.51 && Math.abs(scratch.y - DECK_Y) < .17;
  }
  function place(a: THREE.Vector3, b: THREE.Vector3, t: number, dt: number) {
    vessel.position.copy(a).lerp(b, t); forward.copy(b).sub(a); forward.y = 0;
    heading.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(forward.x, forward.z));
    if (dt === 0) vessel.quaternion.copy(heading);
    else vessel.quaternion.slerp(heading, 1 - Math.exp(-dt * 5));
    inverse.copy(vessel.quaternion).invert();
    seat.copy(vessel.position); seat.y += DECK_Y;
    markers[2].p = scratch.copy(HELM).applyQuaternion(vessel.quaternion).add(vessel.position).toArray();
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      scratch.fromArray(base, i * 3).applyQuaternion(vessel.quaternion).add(vessel.position);
      positions.setXYZ(i, scratch.x, scratch.y, scratch.z);
    }
    collider.bvh.refit();
    positions.needsUpdate = true;
    placeShield();
  }
  function reset() {
    dock = 0; leg = null; arrival = null;
    place(routes.main[0], routes.main[1], 0, 0);
  }
  function pathFromDock(route: SolarBoatRoute) {
    return dock === 0 ? routes[route].slice() : routes[route].slice().reverse();
  }
  function chooseRoute(route: SolarBoatRoute) {
    if (!leg?.atFork) return false;
    leg.route = route; leg.path = pathFromDock(route); leg.atFork = false; leg.idle = 0;
    return true;
  }
  reset();
  return {
    root, collider, shieldCollider, markers, seat, aboard, reset, chooseRoute,
    showRepairedShield(repaired: boolean, raised = false) { repairedShield = repaired; raisedShield = raised; placeShield(); },
    get sailing() { return !!leg; },
    get moored() { return !!leg?.mooring; },
    get atFork() { return !!leg?.atFork; },
    get dock() { return leg ? null : dock; },
    get arrival() { const result = arrival; arrival = null; return result; },
    board(side: Side): 'busy' | 'called' | 'boarding' {
      if (leg) return 'busy';
      const called = dock !== side;
      const path = pathFromDock('main');
      leg = { to: dock === 0 ? 1 : 0, route: called ? 'main' : null, path, section: 0, distance: 0,
        called, atFork: false, mooring: false, idle: 0 };
      arrival = null;
      place(path[0], path[1], 0, 0);
      return called ? 'called' : 'boarding';
    },
    workHelm() {
      if (!leg || leg.atFork) return false;
      leg.mooring = !leg.mooring;
      return leg.mooring;
    },
    update(dt: number, player: Pick<Player, 'pos' | 'vel' | 'onGround' | 'flying' | 'swimming' | 'gliding'>) {
      root.visible = Math.hypot(player.pos.x - EGYPT_OFFSET[0], player.pos.z - EGYPT_OFFSET[1] - 30) < 440;
      collider.enabled = root.visible;
      shieldCollider.enabled = root.visible && repairedShield && raisedShield;
      if (!leg || dt <= 0) return;
      const carrying = aboard(player) && player.vel.y <= .5;
      if (leg.mooring || leg.atFork) {
        leg.idle = carrying ? 0 : leg.idle + dt;
        // An unattended boat clears the channel. The landing can call it back.
        if (leg.idle < 2) return;
        if (leg.atFork) chooseRoute('main');
        leg.mooring = false; leg.idle = 0;
      }
      if (carrying) deckFoot.copy(player.pos).sub(vessel.position).applyQuaternion(inverse);
      const speed = leg.called ? 7 : !leg.route || dock === 1 ? 4.5 : leg.route === 'main' ? 2.55 : 1.85;
      leg.distance += dt * speed;
      while (leg.section < leg.path.length - 1) {
        const a = leg.path[leg.section], b = leg.path[leg.section + 1], length = a.distanceTo(b);
        if (leg.distance < length) { place(a, b, leg.distance / length, dt); break; }
        leg.distance -= length; leg.section++;
        if (leg.section === 1 && !leg.route) {
          place(a, b, 1, dt);
          leg.distance = 0; leg.atFork = true; break;
        }
        if (leg.section === leg.path.length - 1) {
          place(a, b, 1, 0); dock = leg.to;
          if (carrying && leg.route) arrival = { point: landings[dock].clone(), side: dock, route: leg.route };
          leg = null; break;
        }
      }
      if (carrying) player.pos.copy(deckFoot.applyQuaternion(vessel.quaternion).add(vessel.position));
    },
    dispose() {
      collider.enabled = false; shieldCollider.enabled = false; geometry.dispose(); shieldGeometry.dispose();
      for (const a of [art, landmarks, shield]) { for (const mesh of a.layers.values()) mesh.geometry.dispose(); Object.values(a.materials).forEach(m => m.dispose()); }
      root.removeFromParent();
    },
  };
}
