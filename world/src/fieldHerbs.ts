import * as THREE from 'three';
import type { Localized, RegionId } from './settlements/types';
import { CAMPS } from './exploration/catalog';
import { MINIBOSSES } from './minibosses';
/**
 * Field herbs: each era grows one healing plant near the places where fights happen — outposts,
 * domains, duel rings and elite pockets. Walking through one mid-fight restores 25 HP at once; it
 * grows back after 90 s. Health regenerates on its own only after five quiet seconds, so in a long
 * fight the herbs are the reason to break line and reposition, the way health packs are in a shooter.
 *
 * Visual only apart from the heal: no collision, no save state. One body and one glow batch per
 * era (InstancedMesh), drawn only near the player's era.
 */
export const FIELD_HERB = Object.freeze({ heal: 25, regrow: 90, reach: 1.5, perAnchor: 2, ring: [9, 13] as const, maxPerRegion: 12 });

export interface HerbKind { name: Localized; stem: number; leaf: number; bloom: number; glow: number }
export const HERB_KINDS: Readonly<Record<RegionId, HerbKind>> = Object.freeze({
  alpha: { name: ['晴光铃兰', 'Sunbell Lily'], stem: 0x4f8a4a, leaf: 0x6fb85c, bloom: 0xf4fbff, glow: 0x9ff3ff },
  britain: { name: ['誓约玫瑰', 'Oath Rose'], stem: 0x3f6a36, leaf: 0x587f3e, bloom: 0xc8323e, glow: 0xffb0a0 },
  blacksail: { name: ['潮盐海葵', 'Brine Anemone'], stem: 0x8a6f5a, leaf: 0xd9c3a3, bloom: 0xff8fb2, glow: 0xb8fff1 },
  winter: { name: ['霜心莓', 'Frostheart Berry'], stem: 0x34503f, leaf: 0x2f5b47, bloom: 0xd8283a, glow: 0xd8f2ff },
  kyoto: { name: ['狐火灯笼草', 'Foxfire Lantern'], stem: 0x4d6b3a, leaf: 0x6c8f45, bloom: 0xff8a2a, glow: 0xffc070 },
});

export interface HerbSpot { id: string; region: RegionId; x: number; z: number }
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/** Candidate spots: a ring around every outpost and elite home, deterministic per anchor. */
export function herbCandidates(): HerbSpot[] {
  const anchors: { id: string; region: RegionId; x: number; z: number }[] = [
    ...CAMPS.map(c => ({ id: c.id, region: c.region, x: c.anchor[0], z: c.anchor[1] })),
    ...MINIBOSSES.map(m => ({ id: m.id, region: m.region as RegionId, x: m.x, z: m.z })),
  ];
  const out: HerbSpot[] = [];
  for (const a of anchors) {
    const h = hash(a.id);
    for (let k = 0; k < FIELD_HERB.perAnchor; k++) {
      const angle = (h % 360) * Math.PI / 180 + k * Math.PI * (0.8 + (h >>> 9) % 40 / 100);
      const r = FIELD_HERB.ring[0] + ((h >>> (4 + k * 5)) % 100) / 100 * (FIELD_HERB.ring[1] - FIELD_HERB.ring[0]);
      out.push({ id: `${a.id}_${k}`, region: a.region, x: a.x + Math.cos(angle) * r, z: a.z + Math.sin(angle) * r });
    }
  }
  return out;
}

/** Keep spots on dry, walkable ground; cap each era. */
export function placeHerbs(terrain: (x: number, z: number) => number, waterLevel: number, blocked: (x: number, z: number) => boolean = () => false): HerbSpot[] {
  const kept: HerbSpot[] = [], count = new Map<RegionId, number>();
  for (const s of herbCandidates()) {
    const h = terrain(s.x, s.z);
    if (!Number.isFinite(h) || h < waterLevel + .25 || blocked(s.x, s.z)) continue;
    const slope = Math.max(Math.abs(terrain(s.x + 1, s.z) - h), Math.abs(terrain(s.x, s.z + 1) - h));
    if (slope > .7) continue;
    const n = count.get(s.region) ?? 0; if (n >= FIELD_HERB.maxPerRegion) continue;
    count.set(s.region, n + 1); kept.push(s);
  }
  return kept;
}

type Part = { g: THREE.BufferGeometry; c: number; p: [number, number, number]; s?: [number, number, number]; r?: [number, number, number] };
function bake(parts: Part[]) {
  const geos = parts.map(({ g, c, p, s, r }) => {
    const x = (g.index ? g.toNonIndexed() : g.clone()); if (x.getAttribute('uv')) x.deleteAttribute('uv');
    x.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(r ?? [0, 0, 0]), 'YXZ')), new THREE.Vector3(...(s ?? [1, 1, 1]))));
    const col = new THREE.Color(c), n = x.getAttribute('position').count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([col.r, col.g, col.b], i * 3);
    x.setAttribute('color', new THREE.BufferAttribute(colors, 3)); return x;
  });
  const count = geos.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3); let o = 0;
  for (const g of geos) { pos.set(g.getAttribute('position').array as Float32Array, o * 3); nor.set(g.getAttribute('normal').array as Float32Array, o * 3); col.set(g.getAttribute('color').array as Float32Array, o * 3); o += g.getAttribute('position').count; g.dispose(); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere(); return out;
}

/** Per-era plant: a body batch (stems, leaves, petals) and a glow batch (the part that heals). */
export function herbModel(region: RegionId) {
  const k = HERB_KINDS[region];
  const sphere = new THREE.SphereGeometry(1, 10, 7), cone = new THREE.ConeGeometry(1, 1, 7), cyl = new THREE.CylinderGeometry(1, 1, 1, 6), salt = new THREE.OctahedronGeometry(.03);
  const body: Part[] = [], glow: Part[] = [];
  // Leaves spring from the root and splay outward, tips lifted.
  const leaf = (yaw: number, len = .22, lift = .6) => body.push({ g: sphere, c: k.leaf, p: [Math.sin(yaw) * Math.cos(lift) * len * .85, .02 + Math.sin(lift) * len * .85, Math.cos(yaw) * Math.cos(lift) * len * .85], s: [.05, .016, len], r: [-lift, yaw, 0] });
  if (region === 'alpha') {
    leaf(.4, .22, 1.05); leaf(2.6, .2, .95);
    body.push({ g: cyl, c: k.stem, p: [0, .17, 0], s: [.008, .34, .008], r: [0, 0, -.08] });
    // The bells hang in a row under an arching tip, smallest last.
    for (let i = 0; i < 6; i++) { const x = .015 + i * .03, y = .34 - i * i * .006; body.push({ g: cyl, c: k.stem, p: [x, y - .015, 0], s: [.003, .03, .003] }); glow.push({ g: sphere, c: k.bloom, p: [x, y - .045, 0], s: [.03 - i * .0025, .028 - i * .002, .03 - i * .0025] }); }
  } else if (region === 'britain') {
    for (let i = 0; i < 3; i++) leaf(i * 2.1, .15, .5);
    for (const side of [-1, 1]) body.push({ g: sphere, c: k.leaf, p: [side * .045, .2 + side * .04, 0], s: [.035, .012, .06], r: [0, side * 1.57, side * .5] });
    body.push({ g: cyl, c: k.stem, p: [0, .2, 0], s: [.01, .4, .01] });
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; glow.push({ g: sphere, c: k.bloom, p: [Math.cos(a) * .035, .42, Math.sin(a) * .035], s: [.045, .035, .03], r: [0, -a, .5] }); }
    glow.push({ g: sphere, c: 0x8e1d2a, p: [0, .44, 0], s: [.035, .04, .035] });
    body.push({ g: cone, c: k.leaf, p: [0, .385, 0], s: [.045, .04, .045], r: [Math.PI, 0, 0] });
  } else if (region === 'blacksail') {
    // A spiral shell crusted with salt, its anemone fronds glowing at the mouth.
    for (let i = 0; i < 5; i++) body.push({ g: sphere, c: i % 2 ? k.leaf : 0xc9ae8c, p: [Math.cos(i * 1.3) * .03 * (5 - i) / 5, .06 + i * .035, Math.sin(i * 1.3) * .03 * (5 - i) / 5], s: [.11 - i * .018, .05, .11 - i * .018] });
    body.push({ g: cone, c: 0xe9e2d0, p: [0, .26, 0], s: [.03, .08, .03] });
    for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; glow.push({ g: cyl, c: k.bloom, p: [Math.cos(a) * .06, .13, Math.sin(a) * .06 + .08], s: [.008, .12, .008], r: [Math.sin(a) * .5, 0, Math.cos(a) * .5] }); }
    for (let i = 0; i < 4; i++) body.push({ g: salt, c: 0xf2fbff, p: [Math.cos(i * 1.7) * .13, .03, Math.sin(i * 1.7) * .13] });
  } else if (region === 'winter') {
    for (let i = 0; i < 6; i++) body.push({ g: sphere, c: i % 2 ? k.leaf : 0x24463a, p: [Math.cos(i) * .09, .1 + (i % 3) * .05, Math.sin(i) * .09], s: [.09, .08, .09] });
    body.push({ g: sphere, c: 0xf4f8ff, p: [0, .23, 0], s: [.1, .03, .1] });
    for (let i = 0; i < 9; i++) { const a = i * 2.4; glow.push({ g: sphere, c: k.bloom, p: [Math.cos(a) * .11, .12 + (i % 3) * .06, Math.sin(a) * .11], s: [.026, .026, .026] }); }
  } else {
    for (let i = 0; i < 3; i++) leaf(i * 2.1 + .5, .18, .7);
    body.push({ g: cyl, c: k.stem, p: [0, .24, 0], s: [.01, .46, .01], r: [0, 0, -.1] });
    // Paper-lantern husks hanging from the arching stalk.
    for (let i = 0; i < 3; i++) {
      const y = .44 - i * .1, x = -.03 + i * .045;
      body.push({ g: cyl, c: k.stem, p: [x, y + .035, 0], s: [.004, .05, .004] });
      glow.push({ g: sphere, c: k.bloom, p: [x, y, 0], s: [.04, .05, .04] });
      for (let r = 0; r < 4; r++) body.push({ g: cyl, c: 0xc25a14, p: [x + Math.cos(r * 1.57) * .038, y, Math.sin(r * 1.57) * .038], s: [.004, .085, .004] });
    }
  }
  // A small glint floats above every herb so it reads over tall grass.
  glow.push({ g: salt, c: k.glow, p: [0, .78, 0], s: [1.1, 1.6, 1.1] }, { g: salt, c: k.glow, p: [0, .78, 0], s: [1.9, .35, 1.9], r: [0, .785, 0] });
  const out = { body: bake(body), glow: bake(glow) };
  sphere.dispose(); cone.dispose(); cyl.dispose(); salt.dispose();
  return out;
}

const HERB_SCALE = 1.8;
export interface FieldHerbHost {
  terrain(x: number, z: number): number; waterLevel: number;
  /** Restores up to `amount` HP and returns what was actually restored (0 when full or defeated). */
  heal(amount: number): number;
  eaten?(name: Localized, gained: number): void;
  blocked?(x: number, z: number): boolean;
}

export function createFieldHerbs(host: FieldHerbHost) {
  const root = new THREE.Group(); root.name = 'FieldHerbs';
  const spots = placeHerbs(host.terrain, host.waterLevel, host.blocked);
  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  interface Patch { region: RegionId; body: THREE.InstancedMesh; glow: THREE.InstancedMesh; spots: HerbSpot[]; regrow: number[]; y: number[] }
  const patches: Patch[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (const region of Object.keys(HERB_KINDS) as RegionId[]) {
    const mine = spots.filter(x => x.region === region); if (!mine.length) continue;
    const model = herbModel(region);
    const body = new THREE.InstancedMesh(model.body, bodyMat, mine.length), glow = new THREE.InstancedMesh(model.glow, glowMat, mine.length);
    body.name = `FieldHerb_${region}`; glow.name = `FieldHerbGlow_${region}`; body.castShadow = glow.castShadow = false;
    const patch: Patch = { region, body, glow, spots: mine, regrow: mine.map(() => 0), y: mine.map(x => host.terrain(x.x, x.z)) };
    mine.forEach((spot, i) => { q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, hash(spot.id) % 628 / 100); m.compose(p.set(spot.x, patch.y[i], spot.z), q, s.set(HERB_SCALE, HERB_SCALE, HERB_SCALE)); body.setMatrixAt(i, m); glow.setMatrixAt(i, m); });
    body.computeBoundingSphere(); glow.computeBoundingSphere();
    root.add(body, glow); patches.push(patch);
  }
  let elapsed = 0, disposed = false;
  function show(patch: Patch, i: number, visible: boolean, bob = 0) {
    const spot = patch.spots[i];
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, hash(spot.id) % 628 / 100);
    m.compose(p.set(spot.x, patch.y[i] + bob, spot.z), q, visible ? s.set(HERB_SCALE, HERB_SCALE, HERB_SCALE) : s.set(0, 0, 0));
    patch.body.setMatrixAt(i, m); patch.glow.setMatrixAt(i, m);
  }
  return {
    root, spots,
    /** For tests and probes: seconds until each herb in an era grows back (0 = ready). */
    regrowing(region: RegionId) { return patches.find(x => x.region === region)?.regrow.slice() ?? []; },
    update(dtRaw: number, player: THREE.Vector3, region: RegionId, active: boolean) {
      if (disposed) return;
      const dt = Number.isFinite(dtRaw) ? Math.max(0, Math.min(.1, dtRaw)) : 0; elapsed += dt;
      for (const patch of patches) {
        const near = patch.region === region; patch.body.visible = patch.glow.visible = near;
        if (!near) continue;
        let dirty = false;
        for (let i = 0; i < patch.spots.length; i++) {
          if (patch.regrow[i] > 0) { patch.regrow[i] = Math.max(0, patch.regrow[i] - dt); if (patch.regrow[i] === 0) { show(patch, i, true); dirty = true; } continue; }
          const spot = patch.spots[i], dx = player.x - spot.x, dz = player.z - spot.z, dy = player.y - patch.y[i];
          if (active && dx * dx + dz * dz < FIELD_HERB.reach ** 2 && Math.abs(dy) < 2.2) {
            const gained = host.heal(FIELD_HERB.heal);
            if (gained > 0) { patch.regrow[i] = FIELD_HERB.regrow; show(patch, i, false); dirty = true; host.eaten?.(HERB_KINDS[patch.region].name, gained); }
          }
        }
        if (dirty) { patch.body.instanceMatrix.needsUpdate = true; patch.glow.instanceMatrix.needsUpdate = true; }
      }
      glowMat.color.setScalar(.85 + Math.sin(elapsed * 2.2) * .15);
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const x of patches) { x.body.geometry.dispose(); x.glow.geometry.dispose(); x.body.dispose(); x.glow.dispose(); }
      bodyMat.dispose(); glowMat.dispose(); root.removeFromParent(); root.clear();
    },
  };
}
