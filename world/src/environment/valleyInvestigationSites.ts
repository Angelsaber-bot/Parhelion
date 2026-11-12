import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import { mergeParts } from '../settlements/merge';
import { SiteArt } from '../story/campaignSites';
import {
  FIFTH_ROAD as R, REPLAY_TEST as B, WATERWORKS as W, VALLEY_INVESTIGATION_STEPS, VALLEY_WATER_RESTORE,
} from '../story/valleyInvestigations';

type Point = [number, number, number];
type Ground = (x: number, z: number, ceiling: number) => number | null;
type Apply = (done: ReadonlySet<string>, dt: number) => void;
const near = (p: Point, x = 0, y = 0, z = 0): Point => [p[0] + x, p[1] + y, p[2] + z];

export function createValleyInvestigationSites(residence: Point, existing: readonly Marker[], water: number, ground: Ground,
  clear: (position: THREE.Vector3) => boolean) {
  const root = new THREE.Group(); root.name = 'ValleyInvestigations';
  const markers: Marker[] = [], colliders: Collider[] = [], art: SiteArt[] = [], animate: Apply[] = [];
  const stone = '#8a8d78', bronze = '#b7a274', wood = '#725846', metal = '#465e6d', chalk = '#e3d8b4';
  const painted = new THREE.MeshStandardMaterial({ color: '#5b7869' });
  const dark = new THREE.MeshStandardMaterial({ color: '#293945' });
  const glow = new THREE.MeshBasicMaterial({ color: '#f2d6a0' });
  function choose(guess: Point, search = 6, accepts: (x: number, z: number) => boolean = () => true): Point | null {
    for (let radius = 0; radius <= search; radius += 1.5) {
      for (let i = 0; i < (radius ? 12 : 1); i++) {
        const a = i * Math.PI / 6, x = guess[0] + Math.cos(a) * radius, z = guess[2] + Math.sin(a) * radius;
        if (!accepts(x, z)) continue;
        const y = ground(x, z, guess[1] + 2);
        if (y === null || y <= water + .08 || Math.abs(y - guess[1]) > 4 || !clear(new THREE.Vector3(x, y + .04, z))) continue;
        if ([...existing, ...markers].some(m => m.type === 'interact' && Math.abs(m.p[1] - y - .9) < 2 && Math.hypot(m.p[0] - x, m.p[2] - z) < 2.3)) continue;
        return [x, y, z];
      }
    }
    return null;
  }
  function marker(id: string, point: Point, type: Marker['type'] = 'interact') {
    const label = VALLEY_INVESTIGATION_STEPS.get(id)?.label ?? VALLEY_WATER_RESTORE;
    markers.push({ id, type, label: label[0], p: near(point, 0, .9), radius: 1.85 });
  }
  function object(parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, p: Point, name = '') {
    const mesh = new THREE.Mesh(g, m); mesh.name = name; mesh.position.fromArray(p); parent.add(mesh); return mesh;
  }
  function solid(name: string, geometry: THREE.BufferGeometry, enabled = true) {
    const result = { name, enabled, bvh: new MeshBVH(geometry) };
    colliders.push(result); return result;
  }
  function site(name: string, a: SiteArt) {
    a.finish('alpha'); a.root.name = name; root.add(a.root); art.push(a);
    if (a.solids.length) {
      solid('COL_' + name, mergeParts(a.solids));
      for (const g of a.solids) g.dispose();
      a.solids.length = 0;
    }
  }
  function upright(a: SiteArt, p: Point, tint = wood) {
    a.box(near(p, 0, .51, -.77), [.48, 1.02, .47], tint, true);
    a.box(near(p, 0, 1.01, -.77), [.79, .13, .56], metal);
    a.ring(near(p, 0, 1.19, -.68), .17, .028, bronze, 'metal', [Math.PI / 2, 0, 0]);
  }
  function passageGate(a: SiteArt, p: Point, name: string) {
    const geometry = new THREE.BoxGeometry(2.17, 1.92, .18).translate(p[0], p[1] + .96, p[2]);
    const node = object(a.root, new THREE.BoxGeometry(2.17, 1.92, .16), dark, near(p, 0, .96), name);
    for (let i = -2; i <= 2; i++)
      object(node, new THREE.BoxGeometry(.054, 1.74, .032), painted, [i * .35, 0, .093]);
    return { node, collider: solid('COL_' + name, geometry), y: p[1] + .96 };
  }

  let lock: THREE.Mesh | null = null;
  const start = choose([-245, 4.8, -35], 9);
  const tunnel = start && choose(near(start, 6, 0, 2.65), 4.5);
  if (start && tunnel) {
    const [x, y, z] = tunnel;
    const exit = choose([x, y, z - 10], 4.5);
    if (exit) {
      const a = new SiteArt();
      marker(R.map, start); marker(R.trace, tunnel);
      marker(R.lock, near(tunnel, .02, .13, -.92), 'objective');
      marker(R.gate, near(exit, 0, 0, 1.64));
      upright(a, start);
      a.box(near(start, 0, 1.36, -.94), [1.26, .73, .055], chalk);
      for (let i = 0; i < 5; i++) a.box(near(start, -.43 + i * .21, 1.39, -.9), [.026, i === 4 ? .029 : .28, .019], stone);
      const mouth = passageGate(a, near(tunnel, 0, 0, -1.08), 'ValleyDryChannelGrate');
      const back = passageGate(a, near(exit, 0, 0, .91), 'ValleyFifthRoadBackGate');
      lock = object(a.root, new THREE.BoxGeometry(.27, .36, .19), painted, near(tunnel, .02, 1.03, -.943), 'ValleyFifthRoadRustLock');
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        const cx = THREE.MathUtils.lerp(x, exit[0], t);
        const cz = THREE.MathUtils.lerp(z - 1.1, exit[2] + 1.1, t);
        const cy = ground(cx, cz, Math.max(y, exit[1]) + 1.8) ?? THREE.MathUtils.lerp(y, exit[1], t);
        for (const side of [-1, 1]) {
          a.box([cx + side * 1.22, cy + .82, cz], [.29, 1.64, 1.85], stone, true);
          if (i < 3) a.beam([cx + side * 1.25, cy + 2.01, cz], [cx + side * .83, cy + .7, cz - 1.2], .055, '#586b51');
        }
        if (i < 4) a.box([cx, cy + 2.19, cz], [2.75, .23, 1.89], stone, true);
      }
      for (let i = 0; i < 7; i++) {
        const t = i / 7, px = THREE.MathUtils.lerp(start[0], x, t) + .18 * Math.cos(i * 2);
        const pz = THREE.MathUtils.lerp(start[2], z, t);
        const py = ground(px, pz, Math.max(start[1], y) + 1.8);
        if (py !== null) a.box([px, py + .024, pz], [.135, .035, .27], '#665747', false, 'body', [0, i * .35, 0]);
      }
      a.lantern(exit[0] - 1.24, exit[1] + 1.58, exit[2] + .91);
      site('ValleyFifthRoadChannel', a);
      let initial = true;
      animate.push((done, dt) => {
        const broken = done.has(R.lock), open = done.has(R.gate);
        if (lock) lock.visible = !broken;
        mouth.collider.enabled = !broken;
        back.collider.enabled = !open;
        const entrance = mouth.y + (broken ? 2.1 : 0), out = back.y + (open ? 2.1 : 0);
        mouth.node.position.y = initial ? entrance : THREE.MathUtils.damp(mouth.node.position.y, entrance, 6, dt);
        back.node.position.y = initial ? out : THREE.MathUtils.damp(back.node.position.y, out, 6, dt);
        initial = false;
      });
    }
  }

  let reservoir = 0, reservoirInitialized = false, waterTarget: boolean | null = null;
  let waterBlend = 0, waterSeeded = false, waterComplete: boolean | null = null;
  let waterBounds: { x: number; y: number; z: number; radius: number } | null = null;
  const gauge = choose([-69, 4.8, 58], 12);
  const flap = gauge && choose(near(gauge, -7.8, .7, 0), 7.5);
  const inlet = flap && choose(near(flap, -6.6, 1.6, -4), 9);
  const town = inlet && choose(near(inlet, -.4, 0, -5.8), 6);
  const shore = gauge && choose(near(gauge, 2.3, 0, -10.8), 9);
  const basin = shore && choose(near(shore, -5.25, 0, 0), 4.5);
  const drain = shore && basin && choose(shore, 9, (x, z) =>
    Math.abs(x - basin[0]) >= 4.6 || Math.abs(z - basin[2]) >= 4.1);
  if (gauge && flap && inlet && town && drain && basin) {
    const a = new SiteArt();
    for (const [id, point] of [[W.gauge, gauge], [W.seal, flap], [W.fill, inlet], [W.divert, town], [W.drain, drain]] as const) {
      marker(id, point); upright(a, point, stone);
    }
    marker(W.restore, drain);
    marker(W.foundation, basin);
    const reservoirArt = new THREE.Group();
    reservoirArt.position.fromArray(near(inlet, 2.1, 0, -.86)); a.root.add(reservoirArt);
    a.box(near(inlet, 2.1, .26, -.86), [2.6, .51, 1.6], stone, true);
    for (const side of [-1, 1]) a.box(near(inlet, 2.1 + side * 1.23, .61, -.86), [.13, .74, 1.65], stone, true);
    const waterMaterial = new THREE.MeshStandardMaterial({ color: '#568f93', transparent: true, opacity: .75, roughness: .29, side: THREE.DoubleSide });
    const reservoirSurface = object(reservoirArt, new THREE.PlaneGeometry(2.26, 1.35).rotateX(-Math.PI / 2),
      waterMaterial, [0, .53, 0], 'QuarryReservoirWater');
    const float = object(reservoirArt, new THREE.CylinderGeometry(.155, .155, .075, 12), glow, [0, .6, 0], 'QuarryWaterFloat');
    a.box(near(inlet, 2.1, .86, -.86), [.036, .58, .041], wood);
    a.box(near(inlet, 2.1, 1.04, -.83), [.26, .033, .035], chalk);
    const sluice = object(a.root, new THREE.BoxGeometry(.78, .38, .14), painted, near(flap, 0, .43, -.67), 'ValleyLeakingFlap');
    const pipe = [gauge, flap, inlet, town];
    for (let i = 1; i < pipe.length; i++) a.beam(near(pipe[i - 1], .34, .09, -.96), near(pipe[i], .34, .09, -.96), .1, metal);
    const wheelRoot = new THREE.Group(); wheelRoot.position.fromArray(near(town, 1.4, 1.03, -.78)); a.root.add(wheelRoot);
    const hoop = object(wheelRoot, new THREE.TorusGeometry(.62, .055, 7, 24), dark, [0, 0, 0], 'ValleyBackupWheel');
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      object(wheelRoot, new THREE.BoxGeometry(.054, .58, .064), painted,
        [Math.sin(angle) * .29, Math.cos(angle) * .29, 0]).rotation.z = -angle;
    }

    const [x, y, z] = basin;
    const pool = object(a.root, new THREE.PlaneGeometry(5.9, 4.85).rotateX(-Math.PI / 2), waterMaterial, near(basin, 0, .69), 'MirrorLakeServicePool');
    for (const side of [-1, 1]) a.box(near(basin, side * 3, .48), [.24, .96, 5.1], stone, true);
    a.box(near(basin, 0, .49, -2.45), [6.2, .98, .24], stone, true);
    for (const side of [-1, 1]) a.box(near(basin, side * 2.1, .46, 2.5), [1.76, .92, .24], stone, true);
    const poolGate = passageGate(a, near(basin, 0, 0, 2.5), 'MirrorLakePoolGate');
    const foundation = new SiteArt();
    for (let i = 0; i < 3; i++)
      foundation.box(near(basin, 0, .055 * (3 - i), 1.21 + i * .34), [1.7, .09, .32], '#a39379');
    for (const side of [-1, 1]) {
      foundation.box(near(basin, side * 1.7, .06, -.72), [.32, .12, 2.6], '#9a8265');
      foundation.box(near(basin, side * 1.32, .21, -1.26), [.58, .42, .77], '#aa9679');
    }
    site('ValleyFreightFoundations', foundation); site('MirrorLakeWaterworks', a);
    waterBounds = { x, y, z, radius: 3.4 };
    animate.push((done, dt) => {
      reservoir = reservoirInitialized && done.has(W.fill) ? Math.min(1, reservoir + dt * .48) : Number(done.has(W.fill));
      reservoirInitialized = true;
      reservoirSurface.position.y = .53 + .41 * reservoir;
      float.position.y = reservoirSurface.position.y + .067;
      sluice.rotation.x = done.has(W.seal) ? 0 : .54;
      const restored = done.has(W.divert);
      if (restored) wheelRoot.rotation.z += dt * 1.53;
      hoop.visible = true;
      const committed = done.has(W.low);
      if (!restored) {
        waterTarget = null;
        waterComplete = null;
        waterBlend = 0;
      } else if (!waterSeeded) waterBlend = Number(committed);
      else if (waterTarget !== null) {
        const intended = Number(waterTarget);
        waterBlend = intended > waterBlend ? Math.min(intended, waterBlend + dt * .67) : Math.max(intended, waterBlend - dt * .67);
        if (waterBlend === intended) {
          waterComplete = waterTarget;
          waterTarget = null;
        }
      } else waterBlend = Number(waterComplete ?? committed);
      pool.position.y = y + THREE.MathUtils.lerp(.69, -.12, waterBlend);
      pool.visible = waterBlend < .91;
      poolGate.collider.enabled = !committed || waterTarget !== null;
      poolGate.node.position.y = poolGate.y + (poolGate.collider.enabled ? 0 : 1.98);
      foundation.root.visible = waterBlend > .75;
      waterSeeded = true;
    });
  }

  let plateState = false, birdAlarm = 0;
  const broadcast = choose(near(residence, -11.5, 0, -5.8), 10.5);
  const panel = broadcast && choose(near(broadcast, -3.6, 0, -.7), 4.5);
  const bell = panel && choose(near(panel, 0, 0, 3.85), 4.5);
  const rack = broadcast && choose(near(broadcast, .48, 0, -4.15), 4.5);
  if (broadcast && panel && bell && rack) {
    const a = new SiteArt();
    marker(B.desk, broadcast); marker(B.plate, panel); marker(B.bell, bell); marker(B.cache, rack); marker(B.compare, broadcast);
    upright(a, rack); upright(a, bell);
    for (const sx of [-1, 1]) a.box(near(broadcast, sx * 1.83, 1.46, -1.64), [.19, 2.92, .19], wood, true);
    a.box(near(broadcast, 0, 2.85, -1.67), [3.9, .18, 1.25], metal, true);
    a.box(near(broadcast, .73, 1.49, -1.42), [1.63, 1.04, .21], metal, true);
    a.box(near(broadcast, .73, 1.52, -1.296), [1.38, .79, .035], '#89998a');
    const still = object(a.root, new THREE.PlaneGeometry(.35, .29), glow, near(broadcast, .9, 1.53, -1.269), 'BroadcastRecordedPlate');
    still.rotation.z = .51;
    for (const y of [1.21, 2.17]) a.box(near(broadcast, -.91, y, -1.42), [1.41, .09, .22], wood);
    for (const x of [-1.62, -.2]) a.box(near(broadcast, x, 1.68, -1.42), [.085, 1.04, .21], wood);
    const real = object(a.root, new THREE.BoxGeometry(.69, .58, .041), painted, near(panel, 0, 1.19, -.66), 'BroadcastActualPlate');
    const stripe = object(real, new THREE.BoxGeometry(.47, .064, .046), glow, [0, 0, 0]); stripe.rotation.z = .61;
    const signalBell = object(a.root, new THREE.CylinderGeometry(.13, .24, .28, 14), dark, near(bell, .1, 1.52, -.75), 'BroadcastTestBell');
    a.beam(near(rack, 0, 1.1, -.66), near(broadcast, .73, 1.01, -1.47), .049, metal);
    a.paper(...near(broadcast, -.6, .94, -.83));
    const wing = new THREE.ConeGeometry(.045, .19, 3).rotateZ(Math.PI / 2);
    const recording = Array.from({ length: 3 }, (_, i) => object(a.root, wing, dark,
      near(broadcast, .17 + i * .21, 1.77, -1.251), 'BroadcastRecordedBird'));
    const flock = Array.from({ length: 3 }, (_, i) => object(a.root, wing, dark,
      near(broadcast, -1.34 + i * .33, 1.78, -1.53), 'BroadcastActualBird'));
    site('ValleyBroadcastExperiment', a);
    let age = 0, initialized = false;
    animate.push((done, dt) => {
      if (!initialized || !done.has(B.desk)) plateState = done.has(B.plate);
      initialized = true;
      age += dt;
      birdAlarm = Math.max(0, birdAlarm - dt);
      real.rotation.y = THREE.MathUtils.damp(real.rotation.y, plateState ? Math.PI : 0, 9, dt);
      signalBell.rotation.z = birdAlarm > 0 ? Math.sin(birdAlarm * 24) * .17 : 0;
      for (let i = 0; i < recording.length; i++) {
        const t = (age * .29 + i * .13) % 1;
        recording[i].position.set(broadcast[0] + .18 + t * .92, broadcast[1] + 1.73 + Math.sin(t * 6) * .1, broadcast[2] - 1.249);
        const j = (age * .23 + i * .16) % 1;
        const scatter = birdAlarm > 0 ? (2.4 - birdAlarm) * (i + 1) : 0;
        flock[i].position.set(broadcast[0] - 1.6 + j * 1.23 - scatter * .15, broadcast[1] + 1.52 + j * .39 + scatter * .22, broadcast[2] - 1.72 - scatter * .18);
      }
    });
  }
  const scratch = new THREE.Vector3();
  return {
    root, markers, colliders, lock,
    apply(done: ReadonlySet<string>, dt = 0) { animate.forEach(update => update(done, dt)); },
    floatReady: () => reservoir >= 1,
    waterChanging: () => waterTarget !== null || waterComplete !== null,
    waterContains(point?: THREE.Vector3) {
      return !!point && !!waterBounds && Math.abs(point.y - waterBounds.y) < 2 && Math.abs(point.x - waterBounds.x) < waterBounds.radius
        && Math.abs(point.z - waterBounds.z) < waterBounds.radius;
    },
    moveWater(low: boolean) { if (waterBounds && waterTarget === null) { waterTarget = low; return true; } return false; },
    waterResult() { const result = waterComplete; waterComplete = null; return result; },
    flipPlate() { plateState = !plateState; },
    ringBell() { birdAlarm = 2.4; },
    lockPoint() { return lock?.getWorldPosition(scratch) ?? null; },
    dispose() {
      const geos = new Set<THREE.BufferGeometry>(colliders.map(c => c.bvh.geometry));
      const materials = new Set<THREE.Material>([painted, dark, glow, ...art.flatMap(a => Object.values(a.materials))]);
      root.traverse(node => { if (node instanceof THREE.Mesh) { geos.add(node.geometry); for (const m of [node.material].flat()) materials.add(m); } });
      geos.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); root.removeFromParent();
    },
  };
}
