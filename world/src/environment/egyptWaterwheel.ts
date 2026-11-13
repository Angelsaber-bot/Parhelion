import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import { EGYPT_OFFSET, egyptToWorld } from '../map/egyptPlan';
import { EGYPT_WHEEL_TRENCH, EGYPT_WATER_LIFT_APPROACH } from '../map/egyptRiverworksPlan';
import type { Collider, Player } from '../player/player';
import { mergeParts } from '../settlements/merge';
import type { Localized } from '../settlements/types';
import { SiteArt } from '../story/campaignSites';
import { landscapeWalkway } from './landscapeWalkway';

export const EGYPT_WHEEL = {
  sign: 'egypt_waterwheel_sign', valve: 'egypt_waterwheel_valve', latch: 'egypt_waterwheel_latch',
  pin: 'egypt_waterwheel_sluice_pin', lever: 'egypt_waterwheel_sluice_lever',
  liftLow: 'egypt_waterwheel_lift_lower', liftHigh: 'egypt_waterwheel_lift_upper',
  liftDeck: 'egypt_waterwheel_lift_deck', liftRaised: 'egypt_waterwheel_lift_raised',
} as const;
const W = EGYPT_WHEEL;
export const EGYPT_WHEEL_LABELS = new Map<string, Localized>([
  [W.sign, ['旧水车 · 察看泥痕与检修牌', 'Old waterwheel · Read the mud lines and maintenance sign']],
  [W.valve, ['定流阀 · 暂时抬起过渠踏板', 'Still-flow valve · Raise the crossing temporarily']],
  [W.latch, ['止回销 · 把过渠踏板固定在高位', 'Locking pin · Secure the raised crossing']],
  [W.lever, ['旁路拉柄 · 把反涌引到侧池', 'Bypass lever · Divert the reverse flow into the side basin']],
  ...[W.liftLow, W.liftHigh, W.liftDeck].map(id => [id,
    ['引水浮架 · 切换高渠与下层', 'Water lift · Switch between the high channel and lower walk'] as Localized] as const),
]);

const LOW = EGYPT_WHEEL_TRENCH.floor + .2;
const HIGH = 10;
const CROSSING_X = -36;
const CROSSING_Z = 47;

export function createEgyptWaterwheel() {
  const root = new THREE.Group(); root.name = 'EgyptWaterwheelWorks';
  const frame = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(EGYPT_OFFSET[0], 0, EGYPT_OFFSET[1]);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(frame);
  const stone = '#b8a17d', dark = '#75634d', brass = '#bf9851', wood = '#90714b';
  const arts: SiteArt[] = [], colliders: Collider[] = [];
  function finish(art: SiteArt, name: string) {
    art.relocate(frame);
    const geometry = mergeParts(art.solids);
    art.solids.forEach(solid => solid.dispose()); art.solids.length = 0;
    const collider = { name: `COL_${name}`, bvh: new MeshBVH(geometry), enabled: true };
    colliders.push(collider);
    art.finish('alpha'); art.root.name = name; root.add(art.root); arts.push(art);
    return collider;
  }

  const banks = new SiteArt();
  for (const x of [-40.4, -31.6]) {
    banks.box([x, 9, 47], [1.15, 2, 4.8], stone, true);
    banks.box([x, 9.96, 47], [1.2, .08, 4.8], brass);
  }
  // A missed crossing drops to a shallow ledge and a ramp back to the valve.
  landscapeWalkway(banks, [[-34.7, 8.5, 49.5], [-39.5, 8.5, 49.5], [-42.6, 9.17, 49.5], [-42.6, 10, 47]],
    { width: 2.1, floor: stone, edge: dark, steps: true });
  banks.box([-41.3, 10.47, 45.7], [.63, .94, .5], stone, true);
  banks.ring([-41.3, 11.04, 45.7], .31, .065, brass);
  banks.box([-41.9, 11.05, 44.55], [1.5, .95, .23], dark, true);
  for (const [y, direction, color] of [[10.84, -1, '#775945'], [11.22, 1, '#d8c192']] as const) {
    banks.beam([-42.43, y, 44.69], [-41.4, y + direction * .15, 44.69], .055, color);
    const x = direction > 0 ? -41.45 : -42.37;
    banks.beam([x - direction * .17, y + direction * .08, 44.69], [x, y + direction * .14, 44.69], .04, color);
  }
  banks.box([-31.55, 10.48, 45.5], [.5, .96, .48], stone, true);
  banks.box([-31.55, 10.99, 45.5], [.69, .12, .13], brass);
  banks.box([-30.9, 10.49, 48.55], [.53, .98, .5], stone, true);
  banks.beam([-30.9, 10.87, 48.55], [-30.9, 11.25, 48.2], .105, brass);
  banks.box([-35.7, 8.43, 44.17], [5.8, .3, 1.32], dark, true);
  banks.box([-33.4, 8.6, 44.13], [.25, .5, 1.34], brass);
  banks.lantern(-42.8, 11.75, 45.45); banks.lantern(-30.55, 11.7, 45.24);
  finish(banks, 'EgyptWaterwheelBanks');

  const crossing = new SiteArt();
  crossing.box([CROSSING_X, LOW - .14, CROSSING_Z], [8.25, .28, 3.72], wood, true);
  for (let x = -39.8; x < -32; x += .46) crossing.box([x, LOW + .014, CROSSING_Z], [.035, .029, 3.65], brass);
  for (const x of [-39.7, -37.2, -34.8, -32.3]) crossing.box([x, LOW + .5, 45.22], [.1, 1, .1], wood, true);
  crossing.box([CROSSING_X, LOW + .92, 45.22], [7.6, .12, .12], wood, true);
  const deck = finish(crossing, 'EgyptWaterwheelCrossing');
  const position = deck.bvh.geometry.attributes.position;
  const baseY = Array.from({ length: position.count }, (_, i) => position.getY(i));

  // Diverted water drives a reusable lift beside the permanent stair. Both
  // banks can call it; the rider uses the same capsule and can step off freely.
  const liftLow = 17.9, liftHigh = 24.3, liftX = -18.6, liftZ = 94;
  const liftFrame = new SiteArt();
  landscapeWalkway(liftFrame, EGYPT_WATER_LIFT_APPROACH.map(p => [...p]),
    { width: 3.2, floor: stone, edge: brass, rails: true, railOpenings: [
      ...EGYPT_WATER_LIFT_APPROACH.map(p => ({ p: [...p] as [number, number, number], radius: 3 })),
      { p: [-10, liftLow, 66], radius: 3.3 },
    ] });
  landscapeWalkway(liftFrame, [[liftX, liftHigh, 92.2], [liftX, liftHigh, 86.7]],
    { width: 3.2, floor: stone, edge: brass, rails: true, railOpenings: [{ p: [liftX, liftHigh, 92.2], radius: 2 }, { p: [liftX, liftHigh, 86.7], radius: 3 }] });
  for (const x of [liftX - 2.05, liftX + 2.05]) for (const z of [liftZ - 1.9, liftZ + 1.9]) {
    liftFrame.box([x, 21.5, z], [.24, 8.4, .24], dark, true);
    liftFrame.box([x, 25.8, z], [.6, .28, .6], brass);
  }
  for (const [y, z] of [[liftLow, 97], [liftHigh, 90.9]]) {
    liftFrame.box([liftX - 1.1, y + .5, z], [.45, 1, .45], stone, true);
    liftFrame.ring([liftX - 1.1, y + 1.1, z], .29, .06, brass);
  }
  finish(liftFrame, 'EgyptWaterwheelLiftFrame');
  const liftArt = new SiteArt();
  liftArt.box([liftX, liftLow - .16, liftZ], [3.7, .32, 3.6], wood, true);
  for (const x of [liftX - 1.75, liftX + 1.75]) {
    liftArt.box([x, liftLow + .57, liftZ], [.11, 1.14, 3.55], brass, true);
    liftArt.box([x, liftLow - .48, liftZ], [.6, .6, 3.45], dark);
  }
  liftArt.ring([liftX - 1.6, liftLow + 1.1, liftZ + .4], .25, .06, brass);
  const lift = finish(liftArt, 'EgyptWaterwheelLift');
  const liftPosition = lift.bvh.geometry.attributes.position;
  const liftBaseY = Array.from({ length: liftPosition.count }, (_, i) => liftPosition.getY(i));
  const liftBarriers = [liftLow, liftHigh].map((y, i) => {
    const barrier = new SiteArt();
    barrier.box([liftX, y + .6, i ? 92.2 : 95.8], [3.7, 1.2, .14], brass, true);
    return { art: barrier, collider: finish(barrier, `EgyptWaterwheelLiftBarrier_${i}`) };
  });
  const [liftWorldX, liftWorldZ] = egyptToWorld(liftX, liftZ);
  let liftHeight = liftLow, liftTarget = liftLow;

  const wheel = new SiteArt(), wheelGroup = new THREE.Group(); wheelGroup.position.copy(at(-44.2, 12.35, 43.6)); root.add(wheelGroup);
  for (const z of [-.3, .3]) {
    const rim = new THREE.TorusGeometry(1.65, .13, 6, 24);
    wheel.add(rim, wood, [0, 0, z]); rim.dispose();
  }
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, x = Math.cos(angle), y = Math.sin(angle);
    wheel.beam([0, 0, 0], [x * 1.64, y * 1.64, 0], .12, dark);
    wheel.box([x * 1.54, y * 1.54, 0], [.36, .24, .84], i % 3 ? wood : brass, false, 'body', [0, 0, angle]);
  }
  wheel.finish('alpha'); wheelGroup.add(wheel.root); arts.push(wheel);

  const pinGeometry = new THREE.BoxGeometry(.66, .3, .24);
  const pinMaterial = new THREE.MeshStandardMaterial({ color: '#ad593b', roughness: .7 });
  const pin = new THREE.Mesh(pinGeometry, pinMaterial); pin.position.copy(at(-34.8, 11.08, 44.02));
  pin.name = 'EgyptWaterwheelSluicePin'; pin.userData.target = W.pin; root.add(pin);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.1, .19), new THREE.MeshStandardMaterial({ color: '#77624b' }));
  gate.position.copy(at(-34.8, 9.2, 44.2)); root.add(gate);
  const water = new THREE.MeshBasicMaterial({ color: '#96d3cc', transparent: true, opacity: .74, depthWrite: false });
  const foamGeometry = new THREE.BoxGeometry(.16, .035, .65);
  const foam = Array.from({ length: 9 }, () => { const m = new THREE.Mesh(foamGeometry, water); root.add(m); return m; });
  const marker = (id: string, x: number, y: number, z: number, radius: number): Marker => ({
    id, type: 'interact', p: at(x, y, z).toArray(), radius, label: EGYPT_WHEEL_LABELS.get(id)![0],
  });
  const markers: Marker[] = [
    marker(W.sign, -42.1, 11.16, 45.05, 1.75),
    marker(W.valve, -41.1, 11.15, 46.12, 2.2),
    marker(W.latch, -31.35, 11.08, 46, 2.15),
    marker(W.lever, -30.95, 11.1, 48.08, 2.15),
    marker(W.liftLow, liftX - .6, liftLow + 1.1, 97, 2.1),
    marker(W.liftHigh, liftX - .6, liftHigh + 1.1, 90.9, 2.1),
    marker(W.liftDeck, liftX - 1.35, liftLow + 1.1, liftZ + .4, 2.1),
  ];
  const [crossingX, crossingZ] = egyptToWorld(CROSSING_X, CROSSING_Z);
  let timer = 0, height = LOW, phase = 0, gateLift = 0, initialized = false;

  return {
    root, colliders, markers, pin,
    get raised() { return height >= HIGH - .02; },
    get liftMoving() { return Math.abs(liftHeight - liftTarget) > .01; },
    hold() { timer = 12; },
    reset() { timer = 0; initialized = false; },
    apply(done: ReadonlySet<string>, dt: number, player?: Pick<Player, 'pos' | 'vel' | 'onGround' | 'flying' | 'swimming' | 'gliding'>) {
      const fixed = done.has(W.latch), diverted = done.has(W.pin);
      dt = Math.max(0, Math.min(dt, .05));
      liftTarget = diverted && done.has(W.liftRaised) ? liftHigh : liftLow;
      const beforeLift = liftHeight;
      const inLift = !!player && Math.abs(player.pos.x - liftWorldX) < 1.65 && Math.abs(player.pos.z - liftWorldZ) < 1.8;
      const ridingLift = inLift && !player.flying && !player.swimming && !player.gliding
        && player.vel.y <= .5 && Math.abs(player.pos.y - liftHeight) < .17;
      const underLift = inLift && player.pos.y < liftHeight - .2 && player.pos.y + 1.95 > liftHeight - .5;
      if (!initialized) liftHeight = liftTarget;
      else if (liftTarget >= liftHeight || !underLift) liftHeight += Math.sign(liftTarget - liftHeight) * Math.min(Math.abs(liftTarget - liftHeight), dt * 1.5);
      if (!initialized || beforeLift !== liftHeight) {
        liftArt.root.position.y = liftHeight - liftLow;
        for (let i = 0; i < liftPosition.count; i++) liftPosition.setY(i, liftBaseY[i] + liftHeight - liftLow);
        liftPosition.needsUpdate = true; lift.bvh.refit();
        markers[6].p[1] = liftHeight + 1.1;
        if (ridingLift) { player.pos.y += liftHeight - beforeLift; player.vel.y = 0; player.onGround = true; }
      }
      for (const [i, barrier] of liftBarriers.entries()) {
        barrier.art.root.visible = barrier.collider.enabled = Math.abs(liftHeight - (i ? liftHigh : liftLow)) > .01;
      }
      timer = Math.max(0, timer - dt);
      const target = fixed || timer > 0 ? HIGH : LOW;
      const onDeck = player && Math.abs(player.pos.x - crossingX) < 4.05 && Math.abs(player.pos.z - crossingZ) < 1.8
        && !player.flying && !player.gliding && !player.swimming && player.vel.y <= .5 && Math.abs(player.pos.y - height) < .16;
      const previous = height;
      height = initialized ? THREE.MathUtils.damp(height, target, 5, dt) : target;
      if (Math.abs(height - target) < .015) height = target;
      if (!initialized || previous !== height) {
        crossing.root.position.y = height - LOW;
        for (let i = 0; i < position.count; i++) position.setY(i, baseY[i] + height - LOW);
        position.needsUpdate = true; deck.bvh.refit();
        if (onDeck) player.pos.y += height - previous;
      }
      gateLift = initialized ? THREE.MathUtils.damp(gateLift, diverted ? 1 : 0, 5, dt) : Number(diverted);
      gate.position.y = 9.2 + gateLift * 1.32;
      pin.visible = !diverted;
      if (!initialized) { initialized = true; root.updateMatrixWorld(true); }
    },
    update(dt: number, player: THREE.Vector3, diverted: boolean) {
      root.visible = Math.hypot(player.x - crossingX, player.z - crossingZ) < 330;
      if (!root.visible) return;
      phase += dt * (diverted ? .48 : 1.15);
      wheelGroup.rotation.z = diverted ? phase : -phase;
      for (const [i, streak] of foam.entries()) {
        const t = (phase * .58 + i / foam.length) % 1;
        const x = diverted ? -36.9 + t * 3.6 : -35.4 + (i % 3) * .46;
        const z = diverted ? 44.15 + (i % 3 - 1) * .2 : 49.45 - t * 5.1;
        streak.position.set(x, diverted ? 8.65 : 8.49 + t * .68, z).applyMatrix4(frame);
        streak.rotation.y = diverted ? Math.PI / 2 : 0;
      }
    },
    dispose() {
      for (const c of colliders) { c.enabled = false; c.bvh.geometry.dispose(); }
      for (const art of arts) {
        for (const layer of art.layers.values()) layer.geometry.dispose();
        Object.values(art.materials).forEach(material => material.dispose());
      }
      pinGeometry.dispose(); pinMaterial.dispose(); gate.geometry.dispose(); gate.material.dispose(); foamGeometry.dispose(); water.dispose();
      root.removeFromParent();
    },
  };
}
