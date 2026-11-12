import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { JOURNEY as J, journeyStepReady, legacySkyApproach, type JourneyPoint } from '../story/worldJourney';

type Deck = { p: JourneyPoint; w: number; d: number };
const DECK = {
  dock: { p: [53, 138, 291], w: 44, d: 28 },
  range: { p: [92, 148, 249], w: 48, d: 34 },
  hall: { p: [134, 156, 203], w: 54, d: 42 },
  anchor: { p: [62, 152, 159], w: 48, d: 34 },
  light: { p: [173, 170, 125], w: 70, d: 26 },
  service: { p: [157, 156, 271], w: 56, d: 30 },
  throat: { p: [234, 180, 265], w: 50, d: 44 },
  archive: { p: [156, 164, 329], w: 44, d: 28 },
  back: { p: [305, 196, 280], w: 42, d: 32 },
  court: { p: [286, 208, 234], w: 29, d: 27 },
  oldDock: { p: [250, 212, 222], w: 21, d: 17 },
} satisfies Record<string, Deck>;
export const SKY_APPROACH_DECKS = DECK;
export const SKY_APPROACH_LANDING = DECK.dock.p;
export const SKY_HALL_CHECKPOINT = DECK.hall.p;
export const SKY_THROAT_CHECKPOINT: JourneyPoint = [DECK.throat.p[0] - 4, DECK.throat.p[1], DECK.throat.p[2] + 6];
export const SKY_UP_LIFT = 'journey_sky_lift_upper', SKY_DOWN_LIFT = 'journey_sky_lift_lower';
export const SKY_UP_LANDING: JourneyPoint = [286, 208, 240], SKY_DOWN_LANDING: JourneyPoint = [135, 156, 211];
const slate = '#445c71', steel = '#2a3c51', bronze = '#bb9c66', bone = '#c6c6b5', teal = '#66b6ab';

export function addSkyCrownApproach(art: SiteArt) {
  const markers: Marker[] = [], colliders: Collider[] = [];
  const gateMaterial = new THREE.MeshStandardMaterial({ color: steel, emissive: '#8d4934', emissiveIntensity: .5 });
  const workingMaterial = new THREE.MeshStandardMaterial({ color: '#ecba64', emissive: '#bd7f2c', emissiveIntensity: .75 });
  const lockedGates: { node: THREE.Mesh; collider: Collider; flag: string }[] = [];
  const [cx, , cz] = DECK.hall.p;
  const rangeTarget = new THREE.Mesh(new THREE.BoxGeometry(.67, .56, .51), workingMaterial);
  rangeTarget.name = 'SkyRangingScanner'; rangeTarget.userData.target = J.skyScan;
  rangeTarget.position.set(DECK.range.p[0], DECK.range.p[1] + 1.7, DECK.range.p[2] - 7.8);
  const latch = new THREE.Mesh(new THREE.BoxGeometry(.72, .6, .42), workingMaterial);
  latch.name = 'SkyEnforcementLatch'; latch.userData.target = J.eastLatch;
  latch.position.set(DECK.light.p[0] + 2, DECK.light.p[1] + 1.45, DECK.light.p[2] - 5);
  art.root.add(rangeTarget, latch);
  markers.push({ id: J.skyScan, p: rangeTarget.position.toArray(), type: 'objective', label: '外环采样器' });
  function post(id: string, label: string, deck: Deck, dx: number, dz: number, prop = true) {
    const [x, y, z] = deck.p;
    markers.push({ id, p: [x + dx, y + 1, z + dz], label, type: 'interact', radius: 2.25 });
    if (prop) {
      art.box([x + dx, y + .52, z + dz - .81], [.66, 1.03, .44], steel, true);
      art.box([x + dx, y + 1.06, z + dz - .81], [1.08, .14, .58], bone);
      art.box([x + dx, y + 1.145, z + dz - .75], [.63, .028, .32], teal, false, 'metal');
    }
  }
  function deck({ p: [x, y, z], w, d }: Deck, index: number) {
    art.box([x, y - .53, z], [w, 1.06, d], slate);
    // The ramp overlaps the floor. A solid fascia at the deck edge catches
    // the player capsule as it walks up to the seam.
    const floor = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, y, z);
    art.solids.push(floor.toNonIndexed()); floor.dispose();
    art.box([x, y - 1.5, z], [w - 1, 1.06, d - 1], steel);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      art.beam([x + sx * (w / 2 - 1), y - .86, z + sz * (d / 2 - 1)], [x + sx * w / 5, y - 6, z + sz * d / 5], .28, bone);
      art.box([x + sx * (w / 2 - 1.2), y + .66, z + sz * (d / 2 - 1.2)], [.19, 1.32, .19], bronze, true);
      art.box([x + sx * (w / 2 - 1.2), y + 1.39, z + sz * (d / 2 - 1.2)], [.27, .16, .27], teal, false, 'glow');
    }
    for (let dz = -d / 2 + 1.25; dz <= d / 2 - 1; dz += 3) art.box([x, y + .015, z + dz], [w - 2.7, .023, .025], steel);
    for (const side of [-1, 1]) {
      art.box([x + side * (w / 2 - 1.1), y + .035, z], [.15, .055, d - 2.2], bronze);
      art.box([x, y + .035, z + side * (d / 2 - 1.1)], [w - 2.2, .055, .15], bronze);
    }
    if (index === 2 || index === 6 || index === 9) art.ring([x, y + 8.5, z], index === 6 ? 11 : 8, .13, bronze, 'metal', [Math.PI / 2, 0, 0]);
  }
  const list = Object.values(DECK).filter(item => item !== DECK.oldDock);
  list.forEach(deck);

  function connect(a: Deck, b: Deck, width: number, gate?: string) {
    const from = new THREE.Vector3(...a.p), to = new THREE.Vector3(...b.p);
    const delta = to.clone().sub(from), horizontal = Math.hypot(delta.x, delta.z);
    const dx = delta.x / horizontal, dz = delta.z / horizontal;
    const edge = (deck: Deck) => Math.min(deck.w / 2 / Math.max(Math.abs(dx), .001), deck.d / 2 / Math.max(Math.abs(dz), .001));
    const start = from.clone().add(new THREE.Vector3(dx, 0, dz).multiplyScalar(edge(a) + .45));
    const end = to.clone().add(new THREE.Vector3(-dx, 0, -dz).multiplyScalar(edge(b) + .45));
    const bridge = end.clone().sub(start), middle = start.clone().lerp(end, .5);
    const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(bridge.y, Math.hypot(bridge.x, bridge.z));
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')));
    const r = [rotation.x, rotation.y, rotation.z] as JourneyPoint;
    const span = bridge.length();
    const normal = new THREE.Vector3(0, 1, 0).applyEuler(rotation);
    const slab = middle.clone().addScaledVector(normal, -.24);
    art.box(slab.toArray(), [width, .48, span + 1.8], slate, true, 'body', r);
    for (const side of [-1, 1]) {
      const offset = side * (width / 2 - .12), ex = dz * offset, ez = -dx * offset;
      art.box([middle.x + ex, middle.y + .94, middle.z + ez], [.14, .12, span + .35], bronze, true, 'metal', r);
      for (let length = 2; length < span - 1; length += 4.25) {
        const p = start.clone().lerp(end, length / span);
        art.box([p.x + ex, p.y + .46, p.z + ez], [.13, .92, .13], bone, true);
      }
    }
    if (gate) {
      const c = start.clone().lerp(end, .3); c.y += 1.35;
      const geo = new THREE.BoxGeometry(width + .16, 2.7, .28).rotateY(yaw).translate(c.x, c.y, c.z);
      const node = new THREE.Mesh(geo, gateMaterial); node.name = `SkyApproachGate_${gate}`; art.root.add(node);
      const collider: Collider = { name: node.name, bvh: new MeshBVH(geo), enabled: true };
      colliders.push(collider); lockedGates.push({ node, collider, flag: gate });
    }
  }
  connect(DECK.dock, DECK.range, 6);
  connect(DECK.range, DECK.hall, 6.4, J.skyScan);
  connect(DECK.hall, DECK.anchor, 4.7);
  connect(DECK.hall, DECK.light, 5.7, J.skyReview);
  connect(DECK.hall, DECK.service, 5.7, J.skyReview);
  connect(DECK.light, DECK.throat, 6.1);
  connect(DECK.service, DECK.throat, 6.1);
  connect(DECK.service, DECK.archive, 4.2);
  connect(DECK.throat, DECK.back, 6, J.isolate);
  connect(DECK.back, DECK.court, 6);
  connect(DECK.court, DECK.oldDock, 5.9);

  post(J.returnHome, '升云泊台 · 回到幻日谷', DECK.dock, -4, 6);
  post(J.skyRanging, '外环测距 · 启动采样', DECK.range, 0, 4);
  post(J.skyReview, '下层观测厅 · 对照实况', DECK.hall, 1, -3);
  post(J.skyAnchor, '风暴锚场 · 修复锚臂', DECK.anchor, 1, -2);
  post(J.westService, '背光维护层 · 独立旁路', DECK.service, -4, 0);
  post(J.skyArchive, '零号记录室 · 救援缓存', DECK.archive, 3, 2);
  post(J.feed, '配光喉 · 并联生活线路', DECK.throat, -6, 7);
  post(J.test, '配光喉 · 旁路负荷台', DECK.throat, 4, -7);
  post(J.isolate, '配光喉 · 机械隔离锁', DECK.throat, 8, -6);
  post(J.skyReturnSight, '日背回廊 · 核验地面灯', DECK.back, -2, 2);
  post(J.skyCourt, '晴空庭 · 登记承日台检查点', DECK.court, 2, -3);
  post(SKY_UP_LIFT, '晴空庭 · 返回下层观测厅', DECK.court, 2, 9, false);
  post(SKY_DOWN_LIFT, '观测厅 · 前往晴空庭', DECK.hall, 1, 10, false);
  // Three state lights carry the life-support and enforcement readings through the throat.
  for (const x of [-10, 10]) {
    art.beam([DECK.throat.p[0] + x, DECK.throat.p[1] + .13, DECK.throat.p[2] - 13], [DECK.throat.p[0] + x, DECK.throat.p[1] + .13, DECK.throat.p[2] + 14], .12, teal, false, 'choiceA');
  }
  art.box([cx, DECK.hall.p[1] + 1.36, cz - 6.2], [2.45, 1.13, .17], steel);
  art.box([cx, DECK.hall.p[1] + 1.36, cz - 6.1], [2.15, .85, .026], teal);
  const tellMaterial = new THREE.MeshBasicMaterial({ color: '#ffad57', transparent: true, opacity: .53, depthWrite: false, side: THREE.DoubleSide });
  const tell = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), tellMaterial);
  tell.name = 'SkyRangingLock'; tell.visible = false; art.root.add(tell);
  let timer = 1, locked = false;
  const direction = new THREE.Vector3(0, 0, 1);
  const from = new THREE.Vector3(...DECK.range.p).add(new THREE.Vector3(0, 0, -7.8));
  function apply(done: ReadonlySet<string>) {
    rangeTarget.visible = journeyStepReady(J.skyScan, done);
    latch.visible = journeyStepReady(J.eastLatch, done);
    for (const { collider, node, flag } of lockedGates) {
      const grandfathered = flag !== J.isolate && legacySkyApproach(done);
      node.visible = collider.enabled = !done.has(flag) && !done.has(J.skyCourt) && !grandfathered;
    }
    if (!rangeTarget.visible) { tell.visible = locked = false; timer = 1; }
  }
  function update(dt: number, player: THREE.Vector3, hurt: (damage: number) => void) {
    if (!rangeTarget.visible || Math.abs(player.y - from.y) > 3 || Math.hypot(player.x - from.x, player.z - from.z) > 25) {
      tell.visible = locked = false; timer = 1; return;
    }
    if (dt <= 0) return;
    timer -= dt;
    if (timer > 0) return;
    if (!locked) {
      direction.set(player.x - from.x, 0, player.z - from.z);
      if (direction.lengthSq() < .01) direction.set(0, 0, 1);
      direction.normalize();
      tell.position.copy(from).addScaledVector(direction, 10); tell.position.y += .055;
      tell.rotation.y = Math.atan2(direction.x, direction.z); tell.scale.set(2.4, 1, 20);
      tell.visible = locked = true; timer = 1.3; return;
    }
    const x = player.x - from.x, z = player.z - from.z, along = x * direction.x + z * direction.z;
    if (along >= 0 && along <= 20 && Math.abs(x * direction.z - z * direction.x) < 1.2) hurt(16);
    tell.visible = locked = false; timer = 2.3;
  }
  return { markers, colliders, targets: [rangeTarget, latch], apply, update,
    materials: [gateMaterial, workingMaterial, tellMaterial] };
}
