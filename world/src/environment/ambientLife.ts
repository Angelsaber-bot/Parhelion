import * as THREE from 'three';
import type { WorldRegionId as RegionId } from '../core/regionIdentity';
/**
 * Ambient life: butterflies over the grass, birds that perch and take flight, fireflies in the
 * dusk. Each era has its own mix — swallows over the valley, crows in the dusk kingdom, gulls over
 * the pirate sea, ravens on the winter road, fireflies under the Kyoto lanterns.
 *
 * Three draw calls in total (one instanced mesh per kind, one point cloud), no shadows, no
 * collision and no gameplay effect. Creatures live in a ring around the player and are recycled
 * as the player moves; wings flap in the vertex shader from a per-instance phase and amplitude.
 */
export const AMBIENT_LIFE = Object.freeze({ radius: 46, near: 9, flee: 6.5, maxButterflies: 16, maxBirds: 12, maxFireflies: 40 });

export interface RegionLife {
  butterflies: number; butterflyColors: readonly number[];
  birds: number; birdColor: number; perched: number; /** share of birds that start on the ground */
  overWater: boolean; /** gulls prefer the sea */
  fireflies: number;
}
export const REGION_LIFE: Readonly<Record<RegionId, RegionLife>> = Object.freeze({
  orleans:{butterflies:5,butterflyColors:[0xe5d9a4,0xffffff],birds:7,birdColor:0x34333c,perched:.5,overWater:false,fireflies:4},
  egypt:{butterflies:2,butterflyColors:[0xe6c576],birds:4,birdColor:0x57442c,perched:.2,overWater:false,fireflies:0},
  qin:{butterflies:6,butterflyColors:[0xd4dcb5,0xe5c77d],birds:5,birdColor:0x333a36,perched:.5,overWater:false,fireflies:8},
  alpha: { butterflies: 12, butterflyColors: [0x8fd3ff, 0xffe27a, 0xffffff], birds: 6, birdColor: 0x2a3550, perched: .3, overWater: false, fireflies: 14 },
  britain: { butterflies: 14, butterflyColors: [0xffffff, 0xf4a25a, 0xe9d68a], birds: 8, birdColor: 0x1b1b20, perched: .55, overWater: false, fireflies: 12 },
  blacksail: { butterflies: 4, butterflyColors: [0xffd27a, 0xffffff], birds: 11, birdColor: 0xeef2f2, perched: .3, overWater: true, fireflies: 0 },
  winter: { butterflies: 0, butterflyColors: [0xffffff], birds: 6, birdColor: 0x17181c, perched: .6, overWater: false, fireflies: 0 },
  kyoto: { butterflies: 9, butterflyColors: [0xd9a2ff, 0xffb6d0, 0x9be8ff], birds: 4, birdColor: 0x2c2a33, perched: .4, overWater: false, fireflies: 40 },
});

export interface AmbientLifeHost { terrain(x: number, z: number): number; waterLevel: number }
type Mode = 0 | 1 | 2; // butterflies: wander/flee; birds: 0 perched, 1 circling, 2 taking off
interface Creature { x: number; y: number; z: number; vx: number; vy: number; vz: number; heading: number; phase: number; mode: Mode; t: number; cx: number; cz: number; r: number; alt: number }

/** Deterministic little PRNG so the same seed lays out the same flock (tests, and no flicker on re-roll). */
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

function wingMaterial(rate: number) {
  const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const uniforms = { uTime: { value: 0 } };
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPhase;\nattribute float aFlap;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float wingAngle = sin(uTime * ${rate.toFixed(2)} + aPhase) * aFlap;
        float span = abs(transformed.x);
        transformed.y += span * sin(wingAngle);
        transformed.x = sign(transformed.x) * span * cos(wingAngle);`);
  };
  return { material, uniforms };
}

/** Two rounded wing lobes either side of a slim body; +Z is forward, wings span X. */
function butterflyGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, .01); s.bezierCurveTo(.05, .09, .13, .1, .13, .03); s.bezierCurveTo(.13, -.01, .07, -.02, 0, -.005);
  s.bezierCurveTo(.06, -.03, .1, -.08, .07, -.1); s.bezierCurveTo(.04, -.11, .01, -.06, 0, -.02);
  const right = new THREE.ShapeGeometry(s, 5); right.rotateX(-Math.PI / 2);
  const left = right.clone(); left.scale(-1, 1, 1);
  const body = new THREE.CylinderGeometry(.008, .006, .1, 5); body.rotateX(Math.PI / 2);
  const parts = [right, left, body].map(g => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; });
  const merged = mergeSimple(parts); [right, left, body].forEach(g => g.dispose()); return merged;
}
/** A gull-wing silhouette: bent wings, a short tail and a head. */
function birdGeometry() {
  const wing = new THREE.BufferGeometry();
  const v = [
    0, 0, .1, .18, .03, .02, 0, 0, -.06,
    .18, .03, .02, .42, -.02, -.07, .2, .02, -.04,
    -0, 0, .1, -0, 0, -.06, -.18, .03, .02,
    -.18, .03, .02, -.2, .02, -.04, -.42, -.02, -.07,
    0, 0, -.06, .05, 0, -.2, -.05, 0, -.2,
  ];
  wing.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); wing.computeVertexNormals();
  const body = new THREE.SphereGeometry(.05, 6, 4); body.scale(.8, .7, 2.4);
  const head = new THREE.SphereGeometry(.035, 6, 4); head.translate(0, .02, .13);
  const parts = [wing, body, head].map(g => { const n = g.index ? g.toNonIndexed() : g; if (n.getAttribute('uv')) n.deleteAttribute('uv'); return n; });
  const merged = mergeSimple(parts); [wing, body, head].forEach(g => g.dispose()); return merged;
}
function mergeSimple(parts: THREE.BufferGeometry[]) {
  const count = parts.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3); let o = 0;
  for (const g of parts) {
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    pos.set(g.getAttribute('position').array as Float32Array, o * 3); nor.set(g.getAttribute('normal').array as Float32Array, o * 3);
    o += g.getAttribute('position').count; g.dispose();
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

export function createAmbientLife(host: AmbientLifeHost, seed = 0x5eed) {
  const root = new THREE.Group(); root.name = 'AmbientLife';
  const random = rng(seed);
  const flutter = wingMaterial(17), wingbeat = wingMaterial(9);
  const make = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, name: string) => {
    const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.name = name; mesh.frustumCulled = false; mesh.count = 0;
    mesh.castShadow = false; mesh.receiveShadow = false;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('aFlap', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color()); root.add(mesh); return mesh;
  };
  const butterflyMesh = make(butterflyGeometry(), flutter.material, AMBIENT_LIFE.maxButterflies, 'AmbientButterflies');
  const birdMesh = make(birdGeometry(), wingbeat.material, AMBIENT_LIFE.maxBirds, 'AmbientBirds');
  const fireflyGeo = new THREE.BufferGeometry();
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AMBIENT_LIFE.maxFireflies * 3), 3).setUsage(THREE.DynamicDrawUsage));
  fireflyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(AMBIENT_LIFE.maxFireflies * 3), 3).setUsage(THREE.DynamicDrawUsage));
  fireflyGeo.setDrawRange(0, 0);
  const fireflyMat = new THREE.PointsMaterial({ size: .16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const fireflies = new THREE.Points(fireflyGeo, fireflyMat); fireflies.name = 'AmbientFireflies'; fireflies.frustumCulled = false; root.add(fireflies);

  let region: RegionId | null = null, elapsed = 0, disposed = false;
  const butterflies: Creature[] = [], birds: Creature[] = [], bugs: Creature[] = [];
  const blank = (): Creature => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, heading: 0, phase: random() * Math.PI * 2, mode: 0, t: 0, cx: 0, cz: 0, r: 0, alt: 0 });
  const ground = (x: number, z: number) => { const h = host.terrain(x, z); return Number.isFinite(h) ? h : 0; };
  /** A point on the ring around the player that suits the creature (land or sea), or null. */
  function spot(px: number, pz: number, water: boolean | null, min: number = AMBIENT_LIFE.near): [number, number, number] | null {
    for (let i = 0; i < 6; i++) {
      const a = random() * Math.PI * 2, d = min + random() * (AMBIENT_LIFE.radius - min), x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d, h = ground(x, z);
      const wet = h < host.waterLevel;
      if (water === null || wet === water) return [x, Math.max(h, host.waterLevel), z];
    }
    return null;
  }
  function placeButterfly(c: Creature, px: number, pz: number) {
    const p = spot(px, pz, false, 4); if (!p) { c.mode = 1; c.y = -1e4; return; }
    c.x = p[0]; c.z = p[2]; c.alt = .95 + random() * 1.3; c.y = p[1] + c.alt; c.heading = random() * Math.PI * 2; c.mode = 0; c.t = 0;
  }
  function placeBird(c: Creature, px: number, pz: number, life: RegionLife) {
    const perch = random() < life.perched;
    const p = spot(px, pz, perch ? false : life.overWater ? true : null) ?? spot(px, pz, null);
    if (!p) { c.y = -1e4; return; }
    c.cx = p[0]; c.cz = p[2]; c.r = 6 + random() * 12; c.alt = 8 + random() * 10; c.heading = random() * Math.PI * 2; c.t = 0;
    if (perch) { c.mode = 0; c.x = p[0]; c.z = p[2]; c.y = p[1] + .05; }
    else { c.mode = 1; c.x = c.cx + Math.cos(c.heading) * c.r; c.z = c.cz + Math.sin(c.heading) * c.r; c.y = p[1] + c.alt; }
  }
  function placeBug(c: Creature, px: number, pz: number) {
    const p = spot(px, pz, false, 3); if (!p) { c.y = -1e4; return; }
    c.cx = c.x = p[0]; c.cz = c.z = p[2]; c.alt = .35 + random() * 1.6; c.y = p[1] + c.alt; c.t = random() * 10;
  }
  function populate(next: RegionId, px: number, pz: number) {
    const life = REGION_LIFE[next];
    butterflies.length = 0; birds.length = 0; bugs.length = 0;
    for (let i = 0; i < Math.min(life.butterflies, AMBIENT_LIFE.maxButterflies); i++) { const c = blank(); placeButterfly(c, px, pz); butterflies.push(c); }
    for (let i = 0; i < Math.min(life.birds, AMBIENT_LIFE.maxBirds); i++) { const c = blank(); placeBird(c, px, pz, life); birds.push(c); }
    for (let i = 0; i < Math.min(life.fireflies, AMBIENT_LIFE.maxFireflies); i++) { const c = blank(); placeBug(c, px, pz); bugs.push(c); }
    const color = new THREE.Color();
    butterflies.forEach((c, i) => { butterflyMesh.setColorAt(i, color.setHex(life.butterflyColors[i % life.butterflyColors.length])); (butterflyMesh.geometry.getAttribute('aPhase') as THREE.BufferAttribute).setX(i, c.phase); });
    birds.forEach((c, i) => { birdMesh.setColorAt(i, color.setHex(life.birdColor).offsetHSL(0, 0, (i % 3 - 1) * .03)); (birdMesh.geometry.getAttribute('aPhase') as THREE.BufferAttribute).setX(i, c.phase); });
    for (const mesh of [butterflyMesh, birdMesh]) { if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.geometry.getAttribute('aPhase').needsUpdate = true; }
    butterflyMesh.count = butterflies.length; birdMesh.count = birds.length; fireflyGeo.setDrawRange(0, bugs.length);
    region = next;
  }
  // Stylised a little larger than life so they read at walking distance over the grass.
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), wingSize = new THREE.Vector3(1.8, 1.8, 1.8), birdSize = new THREE.Vector3(1.7, 1.7, 1.7), at = new THREE.Vector3();
  const far = (c: Creature, px: number, pz: number, extra = 1.25) => (c.x - px) ** 2 + (c.z - pz) ** 2 > (AMBIENT_LIFE.radius * extra) ** 2;

  return {
    root,
    get region() { return region; },
    get counts() { return { butterflies: butterflies.length, birds: birds.length, fireflies: bugs.length }; },
    /** Read-only view for tests and probes. */
    creatures: { butterflies, birds, fireflies: bugs },
    update(dtRaw: number, player: THREE.Vector3, current: RegionId, active: boolean) {
      if (disposed) return;
      root.visible = active;
      const dt = Number.isFinite(dtRaw) ? Math.max(0, Math.min(.1, dtRaw)) : 0;
      if (!active) return;
      if (current !== region) populate(current, player.x, player.z);
      const life = REGION_LIFE[current];
      elapsed += dt; flutter.uniforms.uTime.value = elapsed; wingbeat.uniforms.uTime.value = elapsed;
      const px = player.x, pz = player.z, py = player.y;
      // Butterflies wander low and scatter upward from a player who walks into them.
      const bFlap = butterflyMesh.geometry.getAttribute('aFlap') as THREE.BufferAttribute;
      butterflies.forEach((c, i) => {
        if (far(c, px, pz)) placeButterfly(c, px, pz);
        const d2 = (c.x - px) ** 2 + (c.z - pz) ** 2 + (c.y - py - 1) ** 2, fleeing = d2 < AMBIENT_LIFE.flee ** 2 * .4;
        c.heading += (Math.sin(elapsed * .9 + c.phase * 3) * 1.6 + (fleeing ? Math.atan2(c.z - pz, c.x - px) - c.heading : 0) * .9) * dt;
        const speed = fleeing ? 3.2 : 1.1;
        c.x += Math.cos(c.heading) * speed * dt; c.z += Math.sin(c.heading) * speed * dt;
        const floor = ground(c.x, c.z), want = floor + c.alt + (fleeing ? 1.6 : 0) + Math.sin(elapsed * 2.1 + c.phase) * .25;
        c.y += (want - c.y) * Math.min(1, dt * 2.5);
        e.set(0, -c.heading + Math.PI / 2, Math.sin(elapsed * 3 + c.phase) * .15); q.setFromEuler(e);
        butterflyMesh.setMatrixAt(i, m.compose(at.set(c.x, c.y, c.z), q, wingSize));
        bFlap.setX(i, fleeing ? 1.25 : 1.05);
      });
      // Birds circle high; perched birds peck and burst into the air when the player comes close.
      const wFlap = birdMesh.geometry.getAttribute('aFlap') as THREE.BufferAttribute;
      birds.forEach((c, i) => {
        if (far(c, px, pz, 1.6)) placeBird(c, px, pz, life);
        c.t += dt;
        let pitch = 0, bank = 0, flap = .55;
        if (c.mode === 0) {
          const d2 = (c.x - px) ** 2 + (c.z - pz) ** 2;
          c.y = ground(c.x, c.z) + .05 + Math.max(0, Math.sin(c.t * 5 + c.phase)) * .02; flap = 0;
          pitch = Math.max(0, Math.sin(c.t * 1.7 + c.phase)) * .5;
          if (d2 < AMBIENT_LIFE.flee ** 2) { c.mode = 2; c.t = 0; c.heading = Math.atan2(c.z - pz, c.x - px); }
        } else if (c.mode === 2) {
          // Take-off: hard climb away from the player, then settle into a wide circle above.
          c.x += Math.cos(c.heading) * 6 * dt; c.z += Math.sin(c.heading) * 6 * dt; c.y += 5.5 * dt; pitch = -.6; flap = 1.25;
          if (c.t > 2.6) { c.mode = 1; c.cx = c.x - Math.cos(c.heading) * c.r; c.cz = c.z - Math.sin(c.heading) * c.r; c.alt = Math.max(10, c.y - ground(c.x, c.z)); }
        } else {
          const omega = 6.5 / c.r; c.heading += omega * dt;
          const tx = c.cx + Math.cos(c.heading) * c.r, tz = c.cz + Math.sin(c.heading) * c.r;
          const floor = Math.max(ground(tx, tz), host.waterLevel), ty = floor + c.alt + Math.sin(c.t * .4 + c.phase) * 1.5;
          c.x += (tx - c.x) * Math.min(1, dt * 3); c.z += (tz - c.z) * Math.min(1, dt * 3); c.y += (ty - c.y) * Math.min(1, dt);
          bank = -.35; flap = Math.sin(c.t * .5 + c.phase) > .3 ? .6 : .04; // glide most of the lap
        }
        const yaw = c.mode === 1 ? -c.heading : -c.heading + Math.PI / 2;
        e.set(pitch, c.mode === 1 ? yaw : yaw, bank, 'YXZ'); q.setFromEuler(e);
        birdMesh.setMatrixAt(i, m.compose(at.set(c.x, c.y, c.z), q, birdSize));
        wFlap.setX(i, flap);
      });
      // Fireflies drift near the ground and pulse; brightest where the sky is dusk.
      const pos = fireflyGeo.getAttribute('position') as THREE.BufferAttribute, col = fireflyGeo.getAttribute('color') as THREE.BufferAttribute;
      bugs.forEach((c, i) => {
        if (far(c, px, pz, 1.1)) placeBug(c, px, pz);
        c.t += dt;
        c.x = c.cx + Math.sin(c.t * .35 + c.phase) * 1.4; c.z = c.cz + Math.cos(c.t * .29 + c.phase * 1.3) * 1.4;
        c.y = ground(c.x, c.z) + c.alt + Math.sin(c.t * .8 + c.phase) * .3;
        const pulse = Math.max(0, Math.sin(c.t * 1.6 + c.phase)) ** 3;
        pos.setXYZ(i, c.x, c.y, c.z); col.setXYZ(i, 1 * pulse, .92 * pulse, .45 * pulse);
      });
      butterflyMesh.instanceMatrix.needsUpdate = true; birdMesh.instanceMatrix.needsUpdate = true;
      bFlap.needsUpdate = true; wFlap.needsUpdate = true; pos.needsUpdate = true; col.needsUpdate = true;
    },
    dispose() {
      if (disposed) return; disposed = true;
      butterflyMesh.geometry.dispose(); birdMesh.geometry.dispose(); fireflyGeo.dispose();
      flutter.material.dispose(); wingbeat.material.dispose(); fireflyMat.dispose();
      butterflyMesh.dispose(); birdMesh.dispose(); root.removeFromParent(); root.clear();
    },
  };
}
export type AmbientLife = ReturnType<typeof createAmbientLife>;
