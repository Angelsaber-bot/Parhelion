// Structures, props and vegetation for 黑帆尽头 (Black Sail's End).
import * as THREE from 'three';
import { Batch, T, BOX, distToPolyline } from '../geo.js';
import { mulberry32, range, fbm } from '../rng.js';
import { PAL, type Piece } from '../structures.js';
import { canopy, conifer } from '../vegetation.js';
import type { Marker, V2 } from '../layout.js';
import {
  BLACKSAIL, PASS_Z, PORT, TAVERN, MEADOW, WINDMILL, FORT, CANNON, GHOST_BOATS, VORTEX, WRECKS, UPDRAFTS, REEF,
  SANDBAR, HALF_WRECK, WRECK_SPIT, LIGHTHOUSE, FLEET, PATHS,
} from './layout.js';
import { coastD } from './terrain.js';

type HeightAt = (x: number, z: number) => number;

const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const CYL20 = new THREE.CylinderGeometry(1, 1, 1, 20);
const ROCK = new THREE.DodecahedronGeometry(1, 0);
const CRYSTAL = new THREE.OctahedronGeometry(1, 0);
const BALL = new THREE.IcosahedronGeometry(1, 0);
const SPHERE = new THREE.IcosahedronGeometry(1, 2);
const CONE8 = new THREE.ConeGeometry(1, 1, 8);
const CONE16 = new THREE.ConeGeometry(1, 1, 16);
const ROOF = new THREE.CylinderGeometry(1, 1, 1, 3, 1, false, Math.PI / 2); // apex up after rz = π/2
const WL = BLACKSAIL.waterLevel;

const C = {
  ...PAL,
  hull: '#5b3a26',
  hullDark: '#3e271a',
  deck: '#b8875a',
  sail: '#efe4c8',
  sailBlack: '#2b2730',
  red: '#c8443c',
  plaster: '#f1e4c8',
  plasterB: '#e8cfa4',
  roofRed: '#c25a3c',
  roofTeal: '#3f8f8f',
  roofBlue: '#4f6fa8',
  stoneWall: '#c9bda4',
  stoneDark: '#9c907a',
  iron: '#3f434e',
  ghost: '#8fd4d0',
  ghostDark: '#4d8f9a',
  ghostSail: '#c8f4ef',
  coldLight: '#9fdcff',
  lantern: '#ffcf7a',
  palm: '#5fbf62',
  palmDark: '#3f9e58',
  palmTrunk: '#b98e5e',
  bone: '#ece2c9',
  boneDark: '#b9ad92',
  gold: '#f4c95d',
};

const _v = new THREE.Vector3();
const _col = new THREE.Color();
/** Add a piece with normals pointing away from `centre` (soft, volumetric toon shading). */
function soft(out: Batch, geo: THREE.BufferGeometry, m: THREE.Matrix4, centre: THREE.Vector3, color: string, grad = 0.35, yScale = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.applyMatrix4(m);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = new Float32Array(pos.count * 3), col = new Float32Array(pos.count * 3);
  _col.set(color);
  for (let i = 0; i < pos.count; i++) {
    _v.set(pos.getX(i) - centre.x, (pos.getY(i) - centre.y) * yScale, pos.getZ(i) - centre.z).normalize();
    nor[i * 3] = _v.x; nor[i * 3 + 1] = _v.y; nor[i * 3 + 2] = _v.z;
    const k = 1 - grad + grad * (0.5 + 0.5 * _v.y) * 1.6;
    col[i * 3] = _col.r * k; col[i * 3 + 1] = _col.g * k; col[i * 3 + 2] = _col.b * k;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.vis.push(g);
}

interface ShipStyle { hull: string; hullDark: string; deck: string; sail: string; sailBatch?: Batch; castle?: boolean; masts?: number; keel?: number }
/**
 * A walkable sailing ship along heading ry (+local z = stern). Deck top at `deck`; rails leave both
 * ends open so gangways and bridges can meet the bow and the stern. Returns bow/stern deck points.
 */
function ship(b: Batch, cx: number, cz: number, ry: number, len: number, deck: number, st: ShipStyle) {
  const f: V2 = [Math.sin(ry), Math.cos(ry)], s: V2 = [Math.cos(ry), -Math.sin(ry)];
  const at = (u: number, v = 0): V2 => [cx + f[0] * u + s[0] * v, cz + f[1] * u + s[1] * v];
  const W = Math.max(6, len * 0.27), keel = st.keel ?? WL - 2.5;
  const H = deck - keel;
  // hull: main body + a diamond bow; dark band at the waterline
  b.add(BOX, st.hull, T(cx + f[0] * len * 0.06, keel + H / 2 - 0.15, cz + f[1] * len * 0.06, ry, W, H - 0.3, len * 0.78));
  { const [x, z] = at(-len * 0.33); b.add(BOX, st.hull, T(x, keel + H / 2 - 0.15, z, ry + Math.PI / 4, W * 0.72, H - 0.3, W * 0.72)); }
  b.add(BOX, st.hullDark, T(cx + f[0] * len * 0.06, WL + 0.2, cz + f[1] * len * 0.06, ry, W + 0.08, 0.6, len * 0.78 + 0.08), false);
  // deck (walkable): main planks + bow diamond deck
  b.add(BOX, st.deck, T(cx + f[0] * len * 0.06, deck - 0.15, cz + f[1] * len * 0.06, ry, W - 0.3, 0.3, len * 0.78));
  { const [x, z] = at(-len * 0.33); b.add(BOX, st.deck, T(x, deck - 0.15, z, ry + Math.PI / 4, W * 0.72 - 0.3, 0.3, W * 0.72 - 0.3)); }
  for (let u = -len * 0.3; u < len * 0.44; u += 1.2) { const [x, z] = at(u); b.add(BOX, st.hullDark, T(x, deck + 0.005, z, ry, W - 0.4, 0.02, 0.08), false); }
  // rails along both sides (bow and stern ends stay open)
  for (const side of [-1, 1]) {
    const [x, z] = at(len * 0.06, side * (W / 2 - 0.15));
    b.add(BOX, st.hullDark, T(x, deck + 0.5, z, ry, 0.25, 1.0, len * 0.62));
  }
  // stern castle with a ramp up from the main deck
  if (st.castle) {
    const u0 = len * 0.3, u1 = len * 0.45, h = 2.4;
    const [x, z] = at((u0 + u1) / 2);
    b.add(BOX, st.hull, T(x, deck + h / 2, z, ry, W, h, u1 - u0));
    b.add(BOX, st.deck, T(x, deck + h + 0.1, z, ry, W - 0.2, 0.2, u1 - u0), true);
    const [rx, rz] = at(u0 - 3.2, W / 2 - 1.4);
    b.ramp(rx, rz, deck, deck + h + 0.2, 6.4, 2.2, st.deck, ry + Math.PI);
    for (const side of [-1, 1]) { const [qx, qz] = at((u0 + u1) / 2, side * (W / 2 - 0.15)); b.add(BOX, st.hullDark, T(qx, deck + h + 0.6, qz, ry, 0.2, 0.9, u1 - u0)); }
    const [lx, lz] = at(u1 + 0.1);
    b.add(BOX, st.hullDark, T(lx, deck + h + 0.6, lz, ry, W, 0.9, 0.2));
  }
  // masts, yards and sails
  const masts = st.masts ?? (len > 30 ? 3 : 2);
  for (let k = 0; k < masts; k++) {
    const u = -len * 0.22 + (k * len * 0.48) / Math.max(1, masts - 1);
    const [x, z] = at(u), mh = len * 0.75 * (k === 1 && masts === 3 ? 1.12 : 1);
    b.add(CYL8, st.hullDark, T(x, deck + mh / 2, z, 0, 0.28, mh, 0.28), true);
    for (const [yy, ww] of [[0.45, 1], [0.78, 0.75]] as const) {
      b.add(CYL8, st.hullDark, T(x, deck + mh * yy + 2.4, z, ry, 0.12, W * 1.3 * ww, 0.12, 0, Math.PI / 2), false);
      (st.sailBatch ?? b).add(BOX, st.sail, T(x + f[0] * 0.25, deck + mh * yy, z + f[1] * 0.25, ry, W * 1.2 * ww, mh * 0.3, 0.08), false);
    }
  }
  const bow = at(-len * 0.33 - W * 0.5), stern = at(len * 0.45);
  return { bow, stern, at, W };
}

export function buildBlacksail(heightAt: HeightAt) {
  const pieces: Piece[] = [];
  const markers: Marker[] = [];
  const mk = (m: Marker) => markers.push(m);
  const rng = mulberry32(BLACKSAIL.seed + 5);
  const glow = new Batch('Glow_Props', 'M_Emissive');
  const lamps = new Batch('Lamps');
  const rocks = new Batch('Rocks');
  const leaves = new Batch('Trees_Leaves', 'M_Foliage');
  const trunks = new Batch('Trees_Trunks');
  const bushes = new Batch('Bushes', 'M_Foliage');
  pieces.push({ name: 'Glow_Props', material: 'M_Emissive', batch: glow });

  const slope = (x: number, z: number) => {
    const e = 1.5;
    return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  };
  const lowest = (x: number, z: number, r: number) =>
    Math.min(heightAt(x, z), heightAt(x + r, z), heightAt(x - r, z), heightAt(x, z + r), heightAt(x, z - r));
  const lantern = (x: number, z: number, y = heightAt(x, z), color = C.lantern) => {
    lamps.add(CYL8, C.iron, T(x, y + 1.3, z, 0, 0.08, 2.6, 0.08));
    lamps.add(BOX, C.iron, T(x, y + 2.7, z, 0, 0.4, 0.08, 0.4), false);
    glow.add(BOX, color, T(x, y + 2.95, z, 0, 0.3, 0.45, 0.3), false);
  };
  const barrel = (b: Batch, x: number, z: number, y = heightAt(x, z), collide = true) => {
    b.add(CYL8, C.wood, T(x, y + 0.55, z, 0, 0.45, 1.1, 0.45), collide);
    b.add(CYL8, C.iron, T(x, y + 0.3, z, 0, 0.47, 0.08, 0.47), false);
    b.add(CYL8, C.iron, T(x, y + 0.8, z, 0, 0.47, 0.08, 0.47), false);
  };
  const flag = (b: Batch, x: number, y: number, z: number, h = 4, color = C.sailBlack) => {
    b.add(CYL8, C.hullDark, T(x, y + h / 2, z, 0, 0.06, h, 0.06), false);
    b.add(BOX, color, T(x + 0.7, y + h - 0.5, z, 0, 1.4, 0.9, 0.04), false);
    b.add(BALL, C.bone, T(x + 0.7, y + h - 0.45, z + 0.03, 0, 0.18, 0.18, 0.03), false);
  };
  /** Gangway from a to b (deck heights ya → yb). */
  const bridge = (b: Batch, a: V2, ya: number, c: V2, yc: number, w = 2.4, color = C.deck) => {
    const dx = c[0] - a[0], dz = c[1] - a[1];
    b.ramp((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, ya - 0.15, yc - 0.15, Math.hypot(dx, dz), w, color, Math.atan2(dx, dz));
  };

  // ───────────────────────── Pass trail (arrival from 幻日谷) ─────────────────────────
  {
    const b = new Batch('Pass_Trail');
    for (let x = -350; x < -200; x += 9) {
      for (const side of [-1, 1]) {
        const z = PASS_Z + side * 4.2, g = heightAt(x, z);
        b.add(CYL8, C.hullDark, T(x, g + 0.6, z, 0, 0.1, 1.2, 0.1), false);
      }
      const g = heightAt(x + 4.5, PASS_Z - 4.2);
      b.add(CYL8, C.canvas, T(x + 4.5, g + 1.05, PASS_Z - 4.2, Math.PI / 2, 0.04, 9, 0.04, 0, Math.PI / 2), false);
    }
    for (let x = -340; x < -200; x += 28) lantern(x, PASS_Z + 5.4);
    const sx = -318, sz = PASS_Z, g = heightAt(-300, PASS_Z - 7);
    b.add(CYL8, C.wood, T(-300, g + 1.4, PASS_Z - 7, 0, 0.12, 2.8, 0.12));
    b.add(BOX, C.wood, T(-300, g + 2.3, PASS_Z - 7, 0.3, 1.8, 0.4, 0.1), false);
    flag(b, -296, g, PASS_Z - 8, 5);
    pieces.push({ name: 'Pass_Trail', material: 'M_Toon', batch: b, outline: true });
    mk({ id: 'spawn_p1', type: 'spawn', label: '玩家1出生点（东侧山口）', p: [sx, heightAt(sx, sz), sz] });
    mk({ id: 'spawn_p2', type: 'spawn', label: '玩家2出生点（东侧山口）', p: [sx, heightAt(sx, sz + 3), sz + 3] });
    mk({ id: 'disc_first_sea', type: 'discovery', label: '初见黑帆海', p: [-252, heightAt(-252, PASS_Z), PASS_Z], radius: 6, note: '远处灯塔外海泊着一排幽灵船' });
  }

  // ───────────────────────── Nassau: piers, moored ships, tavern, shipyard, gallows ─────────────────────────
  {
    const b = new Batch('Nassau');
    const sails = new Batch('Nassau_Sails');
    const [px, pz] = PORT.c, y = PORT.y;
    // piers: from the terrace edge out into the sea, deck at y
    for (const [i, x] of PORT.piers.entries()) {
      let z0 = pz + 20;
      while (z0 < PORT.pierZ1 && heightAt(x, z0) > y - 0.4) z0 += 0.5;
      z0 -= 4;
      const z1 = PORT.pierZ1 - i * 8;
      b.box(x, y - 0.35, (z0 + z1) / 2, 5, 0.35, z1 - z0, C.wood);
      for (let z = z0 + 1; z < z1; z += 4) for (const s of [-2.2, 2.2]) b.add(CYL8, C.woodDark, T(x + s, (y - 5) / 2, z, 0, 0.2, y + 5, 0.2), false);
      for (let z = z0 + 0.5; z < z1; z += 1.2) b.box(x, y - 0.01, z, 5.02, 0.02, 0.12, C.woodDark, 0, false);
      for (let z = z0 + 6; z <= z1; z += 14) lantern(x - 2.3, z, y);
      for (const z of [z1 - 2, z1 - 14]) { b.add(CYL8, C.iron, T(x + 2.1, y + 0.3, z, 0, 0.22, 0.6, 0.22)); }
      // a moored ship beside each pier, gangway from the pier
      const sx = x + 11, sz = z1 - 16, deck = y + 1.4;
      const st: ShipStyle = { hull: i === 1 ? C.hullDark : C.hull, hullDark: C.hullDark, deck: C.deck, sail: i === 1 ? C.sailBlack : C.sail, sailBatch: sails, castle: true };
      const sh = ship(b, sx, sz, 0, 32, deck, st);
      const [gx, gz] = sh.at(0, -sh.W / 2 - 0.4);
      bridge(b, [x + 2.4, gz], y, [gx + 0.3, gz], deck, 2);
      if (i === 1) flag(b, sx, deck + 2.4, sz + 15, 6); // Queen Anne's Revenge's living twin flies the black flag
      barrel(b, sx - 2, sz + 4, deck); barrel(b, sx + 2, sz - 6, deck);
    }
    // quay wall along the terrace edge
    for (let x = -186; x < -50; x += 4) {
      const z = pz + 44 + Math.sin(x * 0.05) * 2, g = Math.min(y, heightAt(x, z + 3));
      b.add(BOX, C.stoneDark, T(x, (g - 2 + y) / 2, z, 0, 4.1, y - g + 2, 1.2));
    }
    // tavern: open-fronted hall facing the square, with the counter where Blackbeard waits
    {
      const [tx, tz] = TAVERN.c, w = TAVERN.w, d = TAVERN.d, h = 5;
      b.box(tx, y, tz - d / 2, w, h, 0.8, C.plasterB); // back (north)
      for (const s of [-1, 1]) b.box(tx + s * w / 2, y, tz, 0.8, h, d, C.plasterB);
      for (const s of [-1, 1]) b.box(tx + s * (w / 2 - 2.5), y, tz + d / 2, 5, h, 0.8, C.plasterB); // front with a wide door
      b.box(tx, y + 3.4, tz + d / 2, 6, h - 3.4, 0.8, C.plasterB);
      for (const s of [-1, 1]) b.add(BOX, C.woodDark, T(tx + s * (w / 2), y + h / 2, tz + d / 2, 0, 0.3, h, 0.3), false);
      b.add(ROOF, C.roofRed, T(tx, y + h + 1.6, tz, Math.PI / 2, 3.2, w + 1.4, (d + 2) / 1.732, 0, Math.PI / 2));
      b.box(tx, y, tz - d / 2 + 2.2, w - 4, 1.1, 1.0, C.woodDark); // counter
      for (let k = 0; k < 5; k++) barrel(b, tx - w / 2 + 2 + k * 1.1, tz - d / 2 + 1.0, y + 1.1, false);
      for (const [dx, dz] of [[-4, 1.5], [3.5, 2]]) {
        b.add(CYL20, C.wood, T(tx + dx, y + 0.9, tz + dz, 0, 1.2, 0.12, 1.2));
        b.add(CYL8, C.woodDark, T(tx + dx, y + 0.45, tz + dz, 0, 0.15, 0.9, 0.15), false);
      }
      glow.add(BOX, C.lantern, T(tx, y + 4.2, tz, 0, 0.4, 0.5, 0.4), false);
      b.add(BOX, C.woodDark, T(tx + 4, y + 4.4, tz + d / 2 + 0.9, 0, 2.4, 1.0, 0.1), false); // sign
      mk({ id: 'blackbeard_meet', type: 'interact', label: '黑胡子（酒馆）', p: [tx, y, tz - d / 2 + 3.6], radius: 3.4, note: '海盗王愿意帮你打破这片海的循环' });
      mk({ id: 'blackbeard_contract', type: 'interact', label: '与黑胡子缔结契约', p: [tx + 3, y, tz - d / 2 + 3.6], radius: 3, requires: ['sea_core'], note: 'Rider 职阶从者 · 安妮女王复仇号的船长' });
      mk({ id: 'disc_tavern_cellar', type: 'discovery', label: '朗姆酒窖', p: [tx - w / 2 + 2, y, tz - d / 2 + 2], radius: 2.5 });
    }
    // houses and warehouses on the terrace
    const homes: [number, number, number, string][] = [
      [-160, 120, 0.05, C.roofTeal], [-146, 104, -0.1, C.roofRed], [-96, 108, 0.12, C.roofBlue], [-80, 126, -0.05, C.roofRed],
      [-170, 150, 0.2, C.roofBlue], [-74, 150, -0.2, C.roofTeal], [-150, 172, 0, C.roofRed], [-96, 172, 0.1, C.roofTeal],
    ];
    homes.forEach(([x, z, ry, roof], i) => {
      const w = 7 + (i % 2) * 2, d = 6, h = 4 + (i % 3);
      b.add(BOX, i % 2 ? C.plaster : C.plasterB, T(x, y + h / 2, z, ry, w, h, d));
      b.add(ROOF, roof, T(x, y + h + 1.1, z, ry, 2.2, w + 1, (d + 1.6) / 1.732, 0, Math.PI / 2));
      b.add(BOX, C.woodDark, T(x + Math.sin(ry) * (d / 2 + 0.03), y + 1.1, z + Math.cos(ry) * (d / 2 + 0.03), ry, 1.2, 2.2, 0.06), false);
      glow.add(BOX, C.lantern, T(x + Math.sin(ry) * (d / 2 + 0.04) + Math.cos(ry) * 2, y + 2.4, z + Math.cos(ry) * (d / 2 + 0.04) - Math.sin(ry) * 2, ry, 0.9, 0.7, 0.05), false);
    });
    // square: gallows + well + market stalls
    {
      const sx = -118, sz = 146;
      b.box(sx - 10, y, sz, 4, 1.2, 4, C.wood);
      for (const s of [-1.6, 1.6]) b.add(CYL8, C.woodDark, T(sx - 10 + s, y + 3, sz, 0, 0.15, 3.6, 0.15));
      b.add(BOX, C.woodDark, T(sx - 10, y + 4.8, sz, 0, 3.8, 0.25, 0.25), false);
      b.add(CYL20, C.stoneDark, T(sx + 8, y + 0.5, sz, 0, 1.5, 1.0, 1.5));
      for (let k = 0; k < 4; k++) {
        const x = sx - 6 + k * 6, z = sz + 14;
        b.box(x, y, z, 2.6, 1.0, 1.4, C.wood);
        b.add(BOX, [C.red, C.roofTeal, C.sail, C.gold][k], T(x, y + 2.4, z, 0, 3.0, 0.08, 2.0), false);
        for (const s of [-1.3, 1.3]) b.add(CYL8, C.woodDark, T(x + s, y + 1.2, z + 0.9, 0, 0.05, 2.4, 0.05), false);
      }
      for (let k = 0; k < 8; k++) lantern(sx + Math.cos(k * 0.8) * 16, sz + Math.sin(k * 0.8) * 12, y);
      mk({ id: 'disc_gallows', type: 'discovery', label: '绞刑架广场', p: [sx - 10, y, sz + 4], radius: 4, note: '1718 年，总督的赦免令就贴在这里' });
    }
    // shipyard: a half-built hull on the slipway + timber stacks; the first chart piece lies on the bench
    {
      const yx = -196, yz = 158;
      const g = heightAt(yx, yz);
      for (let k = 0; k < 9; k++) b.add(CYL8, C.wood, T(yx + (k - 4) * 2.2, g + 2.4, yz, 0, 0.18, 4.8, 0.18, 0, 0.12 * (k - 4)), false);
      b.add(BOX, C.hull, T(yx, g + 0.6, yz, 0, 1.2, 1.2, 20));
      for (let k = 0; k < 6; k++) b.box(yx + 8, g, yz - 6 + k * 1.1, 4, 0.5, 0.5, C.wood, 0.05 * k);
      b.box(yx - 8, g, yz - 4, 3, 1.0, 1.4, C.woodDark);
      mk({ id: 'map_piece_1', type: 'interact', label: '藏宝图碎片·其一（造船厂）', p: [yx - 8, g + 1, yz - 4], radius: 3 });
      const piece = new Batch('Map_Piece_1', 'M_Emissive');
      piece.add(BOX, C.canvas, T(yx - 8, g + 1.06, yz - 4, 0.3, 0.8, 0.02, 0.6), false);
      pieces.push({ name: 'Map_Piece_1', material: 'M_Emissive', batch: piece, userData: { hideWhen: 'map_piece_1' } });
    }
    pieces.push({ name: 'Nassau', material: 'M_Toon', batch: b, outline: true }, { name: 'Nassau_Sails', material: 'M_Toon', batch: sails, outline: true });
    for (const [dx, dz] of [[-30, -10], [24, -6]])
      mk({ id: `enemy_port_${dx}`, type: 'enemy', label: '醉酒水手（占位）', p: [px + dx, y, pz + dz] });
  }

  // ───────────────────────── Smugglers' Downs: windmill, sugar mill ruin, smugglers' cave ─────────────────────────
  {
    const b = new Batch('Smugglers');
    const [wx, wz] = WINDMILL.c, g = lowest(wx, wz, 4) - 0.2;
    b.add(new THREE.CylinderGeometry(3.2, 4.2, 12, 12), C.plaster, T(wx, g + 6, wz));
    b.add(CONE16, C.roofRed, T(wx, g + 13.6, wz, 0, 4.0, 3.4, 4.0));
    b.box(wx, g, wz + 4.1, 1.4, 2.4, 0.3, C.woodDark, 0, false);
    const blades = new Batch('Windmill_Blades');
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      blades.add(BOX, C.canvas, T(wx + Math.cos(a) * 4.5, g + 11 + Math.sin(a) * 4.5, wz + 4.6, 0, 1.4, 8, 0.08, 0, a - Math.PI / 2), false);
    }
    pieces.push({ name: 'Windmill_Blades', material: 'M_Toon', batch: blades, outline: true });
    mk({ id: 'map_piece_2', type: 'interact', label: '藏宝图碎片·其二（风车）', p: [wx, g + 0.2, wz + 5.4], radius: 3 });
    const piece = new Batch('Map_Piece_2', 'M_Emissive');
    piece.add(BOX, C.canvas, T(wx + 0.6, g + 1.2, wz + 4.4, 0, 0.7, 0.5, 0.02), false);
    pieces.push({ name: 'Map_Piece_2', material: 'M_Emissive', batch: piece, userData: { hideWhen: 'map_piece_2' } });
    // sugar mill ruin: broken walls + a chimney
    const [mx, mz] = [MEADOW.c[0] - 34, MEADOW.c[1] + 22];
    const mg = lowest(mx, mz, 8);
    for (const [dx, dz, w, d, h] of [[0, -6, 14, 1, 4], [-7, 0, 1, 12, 3], [7, 2, 1, 8, 2.2], [-3, 6, 6, 1, 1.4]] as const)
      b.box(mx + dx, mg - 0.3, mz + dz, w, h, d, C.stoneWall);
    b.add(CYL8, C.stoneDark, T(mx + 4, mg + 6, mz - 4, 0, 1.2, 12, 1.2));
    // smugglers' cave mouth in the knoll
    const [cx, cz] = [MEADOW.c[0] + 52, MEADOW.c[1] - 50];
    const cg = heightAt(cx, cz);
    b.add(ROCK, C.rockDark, T(cx, cg + 2.5, cz, 0.3, 6, 4.5, 4));
    b.add(BOX, '#1f1d24', T(cx, cg + 1.5, cz + 3.2, 0.3, 3.2, 3, 0.2), false);
    for (let k = 0; k < 5; k++) barrel(b, cx - 4 + k * 1.3, cz + 5 + (k % 2), undefined);
    mk({ id: 'disc_smugglers_cave', type: 'discovery', label: '走私者洞口', p: [cx, cg, cz + 5], radius: 4 });
    pieces.push({ name: 'Smugglers', material: 'M_Toon', batch: b, outline: true });
  }

  // ───────────────────────── Blackbeard's Fort: star fort on the sea cliff, battery, magazine ─────────────────────────
  {
    const b = new Batch('Fort');
    const [fx, fz] = FORT.c, y = FORT.top, R = FORT.r - 3, wallH = 5;
    const angDiff = (a: number, c: number) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c)));
    // curtain walls between four bastions (a star outline)
    const corner = (k: number): V2 => { const a = Math.PI / 4 + (k * Math.PI) / 2; return [fx + Math.cos(a) * R * 1.15, fz + Math.sin(a) * R * 1.15]; };
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corner(k), [bx, bz] = corner(k + 1);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const inward: V2 = [fx - mx, fz - mz], L = Math.hypot(inward[0], inward[1]);
      const nx = mx + (inward[0] / L) * 6, nz = mz + (inward[1] / L) * 6; // curtain bends inward
      for (const [[sx, sz], [ex, ez]] of [[[ax, az], [nx, nz]], [[nx, nz], [bx, bz]]] as [V2, V2][]) {
        const len = Math.hypot(ex - sx, ez - sz), ry = Math.atan2(ex - sx, ez - sz);
        const n = Math.ceil(len / 4);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, x = sx + (ex - sx) * t, z = sz + (ez - sz) * t;
          if (angDiff(Math.atan2(z - fz, x - fx), FORT.gateA) < 0.12) continue; // gate gap (south-west)
          const gnd = Math.min(y, lowest(x, z, 1.5));
          // in front of the battery the east curtain is only a parapet, so the guns can see the sea
          const top = k === 3 && Math.abs(z - CANNON.c[1]) < 15 ? 1.0 : wallH;
          b.add(BOX, i % 2 ? C.stoneWall : C.stoneDark, T(x, (gnd - 2 + y + top) / 2, z, ry, 2.6, y + top - gnd + 2, len / n + 0.3));
          if (i % 2 && top === wallH) b.add(BOX, C.stoneWall, T(x, y + wallH + 0.5, z, ry, 2.6, 1.0, (len / n) * 0.5), false);
        }
      }
      // bastion tip: watchtower
      const g = Math.min(y, lowest(ax, az, 3));
      b.add(CYL20, C.stoneDark, T(ax, (g + y + wallH + 3) / 2 - 1, az, 0, 2.6, y + wallH + 5 - g, 2.6));
      b.add(CONE16, C.roofRed, T(ax, y + wallH + 5.4, az, 0, 3.1, 2.6, 3.1));
    }
    // gate arch + torches
    {
      const gx = fx + Math.cos(FORT.gateA) * R, gz = fz + Math.sin(FORT.gateA) * R;
      b.add(BOX, C.stoneDark, T(gx, y + wallH + 1, gz, -FORT.gateA, 3, 2.4, 9));
      flag(b, gx, y + wallH + 2.2, gz, 5);
      lantern(gx + Math.cos(FORT.gateA) * 5 + 3, gz + Math.sin(FORT.gateA) * 5 + 3);
      lantern(gx + Math.cos(FORT.gateA) * 5 - 3, gz + Math.sin(FORT.gateA) * 5 - 3);
    }
    // barracks, captain's house and the powder magazine
    b.box(fx - 14, y, fz + 4, 14, 4, 7, C.plasterB);
    b.add(ROOF, C.roofRed, T(fx - 14, y + 5, fz + 4, 0, 1.8, 15, 4.6, 0, Math.PI / 2));
    b.box(fx - 6, y, fz - 18, 9, 5, 8, C.stoneWall);
    b.add(ROOF, C.roofBlue, T(fx - 6, y + 6.2, fz - 18, Math.PI / 2, 2.2, 9.6, 5.2, 0, Math.PI / 2));
    const [gx0, gz0] = [fx + 4, fz + 16];
    b.box(gx0, y, gz0, 7, 3.4, 6, C.stoneDark);
    b.add(new THREE.CylinderGeometry(3.6, 3.6, 7, 12, 1, false, 0, Math.PI), C.stoneDark, T(gx0, y + 3.4, gz0, 0, 1, 1, 1, 0, Math.PI / 2), false);
    b.box(gx0, y, gz0 - 3.05, 1.6, 2.2, 0.1, C.woodDark, 0, false);
    for (let k = 0; k < 6; k++) barrel(b, gx0 - 4.6, gz0 - 2.5 + k * 1.0);
    // seaward battery: a raised gun deck along the east wall, five cannons, the working one at CANNON
    const [cx, cz] = CANNON.c;
    // the gun deck stands higher than the parapet so shots clear it on the way down to the sea
    const deckH = 2.6;
    b.box(cx - 4, y, cz - 2, 8, deckH, 24, C.stoneWall);
    b.ramp(cx - 12.5, cz - 10, y, y + deckH, 9, 3, C.stoneWall, Math.PI / 2);
    for (let k = -2; k <= 2; k++) {
      const z = cz + k * 4.5, top = y + deckH;
      b.add(BOX, C.woodDark, T(cx - 2.5, top + 0.35, z, 0, 1.6, 0.7, 2.0), k !== 0); // stand right at the working gun
      for (const s of [-0.9, 0.9]) b.add(new THREE.CylinderGeometry(0.45, 0.45, 0.15, 12), C.woodDark, T(cx - 2.5 + s * 0.6, top + 0.4, z + s, 0, 1, 1, 1, Math.PI / 2), false);
      b.add(CYL8, C.iron, T(cx - 1.4, top + 1.0, z, Math.PI / 2, 0.32, 3.0, 0.32, 0, Math.PI / 2), false);
      if (k === 0) glow.add(new THREE.TorusGeometry(1.6, 0.06, 6, 24), C.lantern, T(cx - 2.5, top + 0.05, z, 0, 1, 1, 1, Math.PI / 2), false);
    }
    // the gunner stands at the front edge of the deck, beside the working gun (nothing in front but sea)
    mk({ id: 'fort_cannon', type: 'interact', label: '要塞大炮', p: [cx - 1.5, y + deckH, cz], radius: 3, note: '装填后，在炮位附近射击海面上的幽灵小艇' });
    mk({ id: 'cannon_post', type: 'poi', label: '炮位', p: [cx - 1.5, y + deckH, cz] });
    // ghost boats offshore: shootable once the cannon is loaded
    GHOST_BOATS.forEach(([x, z], i) => {
      const t = new Batch(`TGT_ghost_boat_${i + 1}`, 'M_Target');
      t.add(BOX, C.ghostDark, T(x, WL + 0.5, z, 0.3 + i, 2.6, 1.2, 8), true);
      t.add(CYL8, C.ghostDark, T(x, WL + 3.2, z, 0, 0.12, 5, 0.12), true);
      t.add(BOX, C.ghostSail, T(x, WL + 3.6, z, 0.3 + i, 2.6, 2.6, 0.06), true);
      pieces.push({ name: `TGT_ghost_boat_${i + 1}`, material: 'M_Target', batch: t, dynamic: true, userData: { target: `ghost_boat_${i + 1}`, needs: 'fort_cannon', near: [cx - 1.5, cz], nearR: 8 } });
      mk({ id: `ghost_boat_${i + 1}`, type: 'objective', label: `幽灵小艇 ${i + 1}`, p: [x, WL + 2, z] });
    });
    const shard = new Batch('Shard_powder', 'M_Emissive');
    shard.add(CRYSTAL, C.red, T(gx0, y + 1.6, gz0 - 4.2, 0.4, 0.4, 0.8, 0.4), false);
    pieces.push({ name: 'Shard_powder', material: 'M_Emissive', batch: shard, userData: { showWhen: ['ghost_boat_1', 'ghost_boat_2', 'ghost_boat_3'], hideWhen: 'shard_powder', bob: true } });
    mk({ id: 'shard_powder', type: 'interact', label: '海之碎片·火药', p: [gx0, y, gz0 - 4.4], radius: 3.2, requires: ['ghost_boat_1', 'ghost_boat_2', 'ghost_boat_3'] });
    mk({ id: 'disc_fort_tower', type: 'discovery', label: '要塞瞭望', p: [corner(0)[0] - 4, y, corner(0)[1] - 4], radius: 5 });
    pieces.push({ name: 'Fort', material: 'M_Toon', batch: b, outline: true });
    for (const [dx, dz] of [[-20, -6], [6, 8], [-8, 22]])
      mk({ id: `enemy_fort_${dx}`, type: 'enemy', label: '要塞海盗（占位）', p: [fx + dx, y, fz + dz] });
  }

  // ───────────────────────── Sky Wrecks over the storm vortex ─────────────────────────
  {
    const b = new Batch('Sky_Wrecks');
    const [vx, vz] = VORTEX.c, f = heightAt(vx, vz);
    // the eye of the storm: broken mast stumps and a whirl of debris
    for (let i = 0; i < 18; i++) {
      const a = range(rng, 0, Math.PI * 2), d = range(rng, 8, VORTEX.R - 6);
      const x = vx + Math.cos(a) * d, z = vz + Math.sin(a) * d, g = heightAt(x, z);
      if (i % 3 === 0) b.add(CYL8, C.hullDark, T(x, g + 1.5, z, a, 0.25, 4, 0.25, range(rng, -0.4, 0.4)), true);
      else b.add(BOX, C.hull, T(x, g + 0.3, z, a, range(rng, 1, 3), 0.4, range(rng, 2, 5), range(rng, -0.3, 0.3)), true);
    }
    const debris = new Batch('Vortex_Debris');
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2, r = range(rng, 10, 22), s = range(rng, 0.5, 1.5);
      debris.add(BOX, i % 3 ? C.hull : C.sail, T(vx + Math.cos(a) * r, f + range(rng, 8, 34), vz + Math.sin(a) * r, range(rng, 0, 6), s * 2, s * 0.3, s, range(rng, 0, 3)), false);
    }
    pieces.push({ name: 'Vortex_Debris', material: 'M_Toon', batch: debris, outline: true, userData: { spin: 0.12, pivot: [vx, vz] } });
    // wrecks: hulls lifted by the storm (walkable decks), the highest one carries the compass shard
    const sails = new Batch('Sky_Wreck_Sails');
    for (const w of WRECKS) {
      const sh = ship(b, w.c[0], w.c[1], w.ry, w.len, w.y, { hull: C.hull, hullDark: C.hullDark, deck: C.deck, sail: C.sail, sailBatch: sails, keel: w.y - 4.5, masts: w.len > 24 ? 2 : 1 });
      void sh;
      // dangling rigging below the hull
      for (let k = 0; k < 5; k++) {
        const L = range(rng, 3, 8);
        bushes.add(BOX, C.woodDark, T(w.c[0] + range(rng, -3, 3), w.y - 4.5 - L / 2, w.c[1] + range(rng, -6, 6), 0, 0.08, L, 0.08), false);
      }
    }
    for (const u of UPDRAFTS) {
      const g = u.y0 < 10 ? heightAt(u.x, u.z) : u.y0 + 1;
      b.add(CYL20, C.stoneDark, T(u.x, g + 0.1, u.z, 0, u.r * 0.7, 0.3, u.r * 0.7), false);
      glow.add(new THREE.TorusGeometry(u.r * 0.62, 0.08, 6, 32), C.glowCyan, T(u.x, g + 0.28, u.z, 0, 1, 1, 1, Math.PI / 2), false);
    }
    const top = WRECKS.find((w) => w.id === 'w4')!;
    const [tx, tz] = top.c;
    b.add(CYL20, C.woodDark, T(tx, top.y + 0.2, tz, 0, 2.2, 0.4, 2.2));
    const shard = new Batch('Shard_compass', 'M_Emissive');
    shard.add(CRYSTAL, C.glowCyan, T(tx, top.y + 2.0, tz, 0.4, 0.4, 0.8, 0.4), false);
    pieces.push({ name: 'Shard_compass', material: 'M_Emissive', batch: shard, userData: { hideWhen: 'shard_compass', bob: true } });
    mk({ id: 'shard_compass', type: 'interact', label: '海之碎片·罗盘', p: [tx, top.y + 0.4, tz], radius: 3.2 });
    mk({ id: 'disc_vortex_eye', type: 'discovery', label: '风暴之眼', p: [vx, f, vz], radius: 6, note: '踩上发光的气流，一艘接一艘往上滑翔' });
    for (const w of WRECKS) mk({ id: `wreck_${w.id}`, type: 'poi', label: `浮空沉船 ${w.id.toUpperCase()}`, p: [w.c[0], w.y, w.c[1]] });
    pieces.push({ name: 'Sky_Wrecks', material: 'M_Toon', batch: b, outline: true }, { name: 'Sky_Wreck_Sails', material: 'M_Toon', batch: sails, outline: true });
  }

  // ───────────────────────── Skull Reef: sandbar, skull rock, the X, the half-sunk wreck ─────────────────────────
  {
    const b = new Batch('Skull_Reef');
    const [rx, rz] = REEF.c, g = heightAt(rx, rz);
    // skull rock: a dome with two dark eye caves and a row of teeth, on the reef's seaward side
    const [kx, kz] = [rx + 10, rz + 10];
    const kg = heightAt(kx, kz);
    b.add(SPHERE, C.bone, T(kx, kg + 6, kz, 0.6, 9, 8, 8));
    b.add(BOX, C.boneDark, T(kx, kg + 1.2, kz, 0.6, 12, 2.4, 10));
    for (const s of [-1, 1]) b.add(SPHERE, '#24212a', T(kx + Math.cos(0.6) * s * 3.6 - Math.sin(0.6) * 7.2, kg + 7, kz - Math.sin(0.6) * s * 3.6 - Math.cos(0.6) * 7.2, 0.6, 2.4, 2.8, 1.2), false);
    for (let k = -2; k <= 2; k++) b.add(BOX, C.bone, T(kx + Math.cos(0.6) * k * 1.6 - Math.sin(0.6) * 7.6, kg + 2.6, kz - Math.sin(0.6) * k * 1.6 - Math.cos(0.6) * 7.6, 0.6, 1.0, 1.6, 0.8), false);
    // stepping stones along the sandbar
    for (let i = 0; i < SANDBAR.length; i++) {
      const [x, z] = SANDBAR[i];
      rocks.add(ROCK, C.rockDark, T(x + 5, WL - 0.2, z - 3, i, 1.6, 0.9, 1.3), false);
    }
    // the X: appears when all three chart pieces are found
    const [xx, xz] = [rx - 8, rz - 4];
    const xg = heightAt(xx, xz);
    const mark = new Batch('Treasure_X', 'M_Emissive');
    for (const a of [Math.PI / 4, -Math.PI / 4]) mark.add(BOX, C.red, T(xx, xg + 0.06, xz, a, 0.5, 0.06, 3.6), false);
    pieces.push({ name: 'Treasure_X', material: 'M_Emissive', batch: mark, userData: { showWhen: ['map_piece_1', 'map_piece_2', 'map_piece_3'], hideWhen: 'shard_treasure' } });
    const chest = new Batch('Treasure_Chest');
    chest.add(BOX, C.wood, T(xx, xg + 0.4, xz, 0.3, 1.6, 0.8, 1.0), false);
    chest.add(BOX, C.gold, T(xx, xg + 0.82, xz, 0.3, 1.64, 0.1, 1.04), false);
    pieces.push({ name: 'Treasure_Chest', material: 'M_Toon', batch: chest, outline: true, userData: { showWhen: 'shard_treasure' } });
    const shard = new Batch('Shard_treasure', 'M_Emissive');
    shard.add(CRYSTAL, C.gold, T(xx, xg + 2.2, xz, 0.4, 0.4, 0.8, 0.4), false);
    pieces.push({ name: 'Shard_treasure', material: 'M_Emissive', batch: shard, userData: { showWhen: ['map_piece_1', 'map_piece_2', 'map_piece_3'], hideWhen: 'shard_treasure', bob: true } });
    mk({ id: 'shard_treasure', type: 'interact', label: '海之碎片·藏宝（在 X 处挖掘）', p: [xx, xg, xz], radius: 3.4, requires: ['map_piece_1', 'map_piece_2', 'map_piece_3'] });
    // palms and a beached longboat on the reef
    b.add(BOX, C.hull, T(rx - 14, g + 0.3, rz + 6, 1.1, 1.6, 0.8, 5), true);
    flag(b, rx - 4, g, rz - 12, 4);
    mk({ id: 'disc_skull_eyes', type: 'discovery', label: '骷髅之眼', p: [kx - Math.sin(0.6) * 9, heightAt(kx - Math.sin(0.6) * 9, kz - Math.cos(0.6) * 9), kz - Math.cos(0.6) * 9], radius: 4 });
    pieces.push({ name: 'Skull_Reef', material: 'M_Toon', batch: b, outline: true });
    // half-sunk merchantman in the bay, its stern still above water: the third chart piece
    {
      const w = new Batch('Half_Wreck');
      const [hx, hz] = HALF_WRECK.c;
      w.add(BOX, C.hull, T(hx, WL + 0.4, hz, 0.7, 6, 5, 16, 0.18), true);
      w.add(BOX, C.deck, T(hx + Math.sin(0.7) * 4, WL + 2.6, hz + Math.cos(0.7) * 4, 0.7, 5.4, 0.3, 7, 0.08), true);
      w.add(CYL8, C.hullDark, T(hx, WL + 6, hz, 0.7, 0.25, 9, 0.25, 0.4), false);
      const [ex, ez] = [hx + Math.sin(0.7) * 5, hz + Math.cos(0.7) * 5];
      mk({ id: 'map_piece_3', type: 'interact', label: '藏宝图碎片·其三（半沉商船）', p: [ex, WL + 2.8, ez], radius: 3.2 });
      const p3 = new Batch('Map_Piece_3', 'M_Emissive');
      p3.add(BOX, C.canvas, T(ex, WL + 3.0, ez, 0.3, 0.8, 0.02, 0.6), false);
      pieces.push({ name: 'Half_Wreck', material: 'M_Toon', batch: w, outline: true }, { name: 'Map_Piece_3', material: 'M_Emissive', batch: p3, userData: { hideWhen: 'map_piece_3' } });
      // stepping stones from the end of the sand spit up onto the stern deck
      const [sx, sz] = WRECK_SPIT[WRECK_SPIT.length - 1];
      for (let k = 1; k <= 4; k++) {
        const t = k / 5, x = sx + (ex - sx) * t, z = sz + (ez - sz) * t, top = WL + 0.9 + t * 1.8;
        w.add(CYL8, C.rock, T(x, (top + WL - 3) / 2, z, k, 1.2, top - WL + 3, 1.2), true);
      }
    }
  }

  // ───────────────────────── Drowned Lighthouse + ghost fleet ─────────────────────────
  {
    const b = new Batch('Lighthouse');
    const [cx, cz] = LIGHTHOUSE.c;
    const base = heightAt(cx, cz) - 0.3, H = LIGHTHOUSE.h;
    for (let i = 0; i < 6; i++) {
      const y0 = base + (H * i) / 6, h = H / 6;
      b.add(new THREE.CylinderGeometry(4.2 - i / 6, 4.2 - (i - 1) / 6 - 1 / 6, 1, 24), i % 2 ? '#4f5f7a' : '#d9dfe8', T(cx, y0 + h / 2, cz, 0, 1, h, 1));
    }
    b.add(CYL20, C.stoneDark, T(cx, base + 0.4, cz, 0, 5.4, 0.8, 5.4));
    b.box(cx - 4.05, base + 0.8, cz, 0.3, 2.2, 1.3, C.woodDark, 0, false);
    const R = 5.65, seg = 24, turns = 4, rise = H / (seg * turns);
    const segLen = (2 * Math.PI * R) / seg, slopeA = Math.atan2(rise, segLen);
    let lastA = 0;
    for (let k = 0; k < seg * turns; k++) {
      const a = ((k + 0.5) / seg) * Math.PI * 2, yy = base + 0.8 + (k + 0.5) * rise;
      b.add(BOX, k % 2 ? C.stoneWall : C.stoneDark, T(cx + Math.cos(a) * R, yy - 0.15, cz + Math.sin(a) * R, -a, 2.3, 0.3, segLen + 0.35, -slopeA));
      b.add(BOX, C.woodDark, T(cx + Math.cos(a) * (R + 1.1), yy + 0.35, cz + Math.sin(a) * (R + 1.1), -a, 0.12, 0.9, segLen + 0.3, -slopeA));
      if (k % 3 === 0) b.add(CYL8, C.woodDark, T(cx + Math.cos(a) * (R - 0.4), yy - 1.4, cz + Math.sin(a) * (R - 0.4), 0, 0.12, 2.4, 0.12), false);
      lastA = a;
    }
    const top = base + 0.8 + H;
    for (let s = 0; s < 24; s++) {
      const a = ((s + 0.5) / 24) * Math.PI * 2;
      const da = ((lastA - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (da < 3.1) continue;
      const w = (2 * Math.PI * 5.4) / 24 + 0.3;
      b.add(BOX, C.stoneWall, T(cx + Math.cos(a) * 5.4, top - 0.2, cz + Math.sin(a) * 5.4, -a, 4.2, 0.4, w));
      b.add(BOX, C.iron, T(cx + Math.cos(a) * 7.35, top + 0.5, cz + Math.sin(a) * 7.35, -a, 0.15, 1.0, w));
    }
    b.add(CYL20, C.stoneWall, T(cx, top - 0.2, cz, 0, 3.4, 0.4, 3.4));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.add(BOX, C.iron, T(cx + Math.cos(a) * 2.35, top + 1.4, cz + Math.sin(a) * 2.35, -a, 0.18, 2.8, 0.18), false);
    }
    b.add(CONE16, '#4f5f7a', T(cx, top + 3.8, cz, 0, 3.0, 2.2, 3.0));
    pieces.push({ name: 'Lighthouse', material: 'M_Toon', batch: b, outline: true });
    const cold = new Batch('Cold_Lamp', 'M_Emissive');
    cold.add(new THREE.CylinderGeometry(2.3, 2.3, 2.8, 16), C.coldLight, T(cx, top + 1.4, cz), false);
    pieces.push({ name: 'Cold_Lamp', material: 'M_Emissive', batch: cold, userData: { hideWhen: 'sea_core' } });
    const warm = new Batch('Warm_Lamp', 'M_Emissive');
    warm.add(new THREE.CylinderGeometry(2.3, 2.3, 2.8, 16), C.lantern, T(cx, top + 1.4, cz), false);
    pieces.push({ name: 'Warm_Lamp', material: 'M_Emissive', batch: warm, userData: { showWhen: 'sea_core' } });
    const beam = new Batch('Lighthouse_Beam', 'M_Beam');
    for (const s of [0, Math.PI]) beam.add(new THREE.ConeGeometry(5, 90, 16, 1, true).translate(0, -45, 0), C.coldLight, T(cx, top + 1.4, cz, s, 1, 1, 1, Math.PI / 2 + 0.05), false);
    pieces.push({ name: 'Lighthouse_Beam', material: 'M_Beam', batch: beam, userData: { spin: 0.4, pivot: [cx, cz] } });
    mk({ id: 'disc_lighthouse_top', type: 'discovery', label: '冷灯之巅', p: [cx, top, cz - 4.6], radius: 3, note: '从这里看得见整支幽灵舰队' });

    // dock at the tip of the headland, then the ghost fleet
    const fleet = new Batch('Ghost_Fleet');
    const fsails = new Batch('Ghost_Sails', 'M_Beam');
    const ghost: ShipStyle = { hull: C.ghostDark, hullDark: '#2f5f6a', deck: C.ghost, sail: C.ghostSail, sailBatch: fsails };
    // a stone jetty runs from the headland road (north of the tower) out past the cliff to the bridge
    const dockY = 10.5, dock: V2 = [cx + 25, cz + 10];
    b.box(cx + 17, WL - 3, cz + 10, 18, dockY - WL + 3, 6, C.stoneWall);
    for (const s of [-1, 1]) for (let x = cx + 10; x <= cx + 25; x += 5) b.add(CYL8, C.iron, T(x, dockY + 0.45, cz + 10 + s * 2.8, 0, 0.12, 0.9, 0.12), false);
    lantern(cx + 25, cz + 7.4, dockY);
    const ends: { bow: V2; stern: V2; deck: number }[] = [];
    for (const g of FLEET) {
      const flag = g.id === 'flag';
      const sh = ship(fleet, g.c[0], g.c[1], g.ry, g.len, WL + g.deck, { ...ghost, castle: flag, masts: flag ? 3 : 2 });
      ends.push({ bow: sh.bow, stern: sh.stern, deck: WL + g.deck });
      for (let k = 0; k < 4; k++) { const [lx, lz] = sh.at(-g.len * 0.25 + k * g.len * 0.2, (k % 2 ? 1 : -1) * (sh.W / 2 - 0.2)); glow.add(BOX, C.glowCyan, T(lx, WL + g.deck + 1.4, lz, 0, 0.3, 0.45, 0.3), false); }
    }
    pieces.push({ name: 'Ghost_Fleet', material: 'M_Toon', batch: fleet, outline: true }, { name: 'Ghost_Sails', material: 'M_Beam', batch: fsails });
    // ghost-fire bridges: appear (and become solid) once all three sea shards are held
    const shards = ['shard_powder', 'shard_compass', 'shard_treasure'];
    const br = new Batch('Ghost_Bridge', 'M_Emissive');
    const links: [V2, number, V2, number][] = [
      [dock, dockY, ends[0].bow, ends[0].deck],
      [ends[0].stern, ends[0].deck, ends[1].bow, ends[1].deck],
      [ends[1].stern, ends[1].deck, ends[2].bow, ends[2].deck],
    ];
    for (const [a, ya, c, yc] of links) {
      bridge(br, a, ya, c, yc, 2.6, '#7ff7e8');
      const dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz);
      for (let t = 4; t < L; t += 5) for (const s of [-1.6, 1.6]) {
        const x = a[0] + (dx * t) / L + (dz / L) * s, z = a[1] + (dz * t) / L - (dx / L) * s;
        br.add(CONE8, '#b6fff5', T(x, ya + ((yc - ya) * t) / L + 0.5, z, 0, 0.15, 0.7, 0.15), false);
      }
    }
    pieces.push({ name: 'Ghost_Bridge', material: 'M_Emissive', batch: br, dynamic: true, userData: { showWhen: shards, solidWhen: shards } });
    // flagship: the sea core on the quarterdeck, the boss in the waist
    const flagDef = FLEET.find((g) => g.id === 'flag')!;
    const fdeck = WL + flagDef.deck;
    const f: V2 = [Math.sin(flagDef.ry), Math.cos(flagDef.ry)];
    const coreP: V2 = [flagDef.c[0] - f[0] * 8, flagDef.c[1] - f[1] * 8];
    fleet.add(CYL20, C.ghostDark, T(coreP[0], fdeck + 0.35, coreP[1], 0, 1.6, 0.7, 1.6));
    const core = new Batch('Sea_Core_Dark', 'M_Emissive');
    core.add(SPHERE, '#1f3a4a', T(coreP[0], fdeck + 3, coreP[1], 0, 1.4, 1.4, 1.4), false);
    core.add(new THREE.TorusGeometry(2, 0.12, 6, 40), C.glowCyan, T(coreP[0], fdeck + 3, coreP[1], 0, 1, 1, 1, Math.PI / 2 - 0.4), false);
    pieces.push({ name: 'Sea_Core_Dark', material: 'M_Emissive', batch: core, userData: { hideWhen: 'sea_core', bob: true } });
    const lit = new Batch('Sea_Core', 'M_Emissive');
    lit.add(SPHERE, C.lantern, T(coreP[0], fdeck + 3, coreP[1], 0, 1.6, 1.6, 1.6), false);
    pieces.push({ name: 'Sea_Core', material: 'M_Emissive', batch: lit, userData: { showWhen: 'sea_core', bob: true } });
    const cbeam = new Batch('Sea_Core_Beam', 'M_Beam');
    cbeam.add(new THREE.CylinderGeometry(1.2, 2.0, 160, 20, 1, true), C.lantern, T(coreP[0], fdeck + 80, coreP[1]), false);
    pieces.push({ name: 'Sea_Core_Beam', material: 'M_Beam', batch: cbeam, userData: { showWhen: 'sea_core' } });
    mk({ id: 'sea_core', type: 'interact', label: '海之核', p: [coreP[0], fdeck, coreP[1]], radius: 3.6, requires: ['shard_powder', 'shard_compass', 'shard_treasure'] });
    mk({ id: 'boss_drowned_admiral', type: 'enemy', label: '亡航提督（Boss）', p: [flagDef.c[0] + f[0] * 4, fdeck, flagDef.c[1] + f[1] * 4] });
    mk({ id: 'disc_flagship', type: 'discovery', label: '安妮女王复仇号', p: [flagDef.c[0], fdeck, flagDef.c[1]], radius: 6, note: '幽灵舰队的旗舰' });
  }

  // ───────────────────────── Vegetation ─────────────────────────
  const blocked = (x: number, z: number) => {
    const near = (c: readonly [number, number], r: number) => Math.hypot(x - c[0], z - c[1]) < r;
    if (Math.hypot(x - PORT.c[0], (z - PORT.c[1]) * 1.3) < 66) return true;
    if (near(FORT.c, FORT.r + 8) || near(VORTEX.c, VORTEX.R + 2) || near(REEF.c, REEF.r - 2) || near(LIGHTHOUSE.c, 16)) return true;
    if (near(WINDMILL.c, 10) || near([MEADOW.c[0] - 34, MEADOW.c[1] + 22], 12) || near([MEADOW.c[0] + 52, MEADOW.c[1] - 50], 10)) return true;
    for (const u of UPDRAFTS) if (near([u.x, u.z], u.r + 2)) return true;
    if (Math.abs(x + 300) < 70 && Math.abs(z - PASS_Z) < 9) return true;
    for (const p of PATHS) if (distToPolyline(x, z, p) < 3.5) return true;
    return false;
  };
  let nPalm = 0, nTree = 0;
  const STEP = 6;
  for (let gz = -BLACKSAIL.half; gz < BLACKSAIL.half; gz += STEP)
    for (let gx = -BLACKSAIL.half; gx < BLACKSAIL.half; gx += STEP) {
      const x = gx + range(rng, 0, STEP), z = gz + range(rng, 0, STEP);
      const roll = rng(), s = range(rng, 0.8, 1.3), ry = range(rng, 0, Math.PI * 2);
      if (Math.abs(x) > BLACKSAIL.playHalf + 12 || Math.abs(z) > BLACKSAIL.playHalf + 12) continue;
      const h = heightAt(x, z);
      if (h < WL + 0.8 || blocked(x, z) || slope(x, z) > 0.8) continue;
      const d = coastD(x, z);
      const n = fbm(x * 0.02, z * 0.02, 3, BLACKSAIL.seed + 40);
      const y = h - 0.3;
      if (d > 3 && d < 50 && h < 10) {
        if (roll > 0.12 + Math.max(0, n) * 0.22) continue;
        nPalm++;
        const lean = range(rng, 0.12, 0.32), segs = 6, segH = 1.05 * s;
        let px = x, py = y, pz = z;
        for (let k = 0; k < segs; k++) {
          const tilt = lean * (k / segs) * 1.6;
          const dx = Math.sin(tilt) * segH, dy = Math.cos(tilt) * segH;
          trunks.add(new THREE.CylinderGeometry(0.2 * s, 0.26 * s, 1, 7), k % 2 ? C.palmTrunk : '#a57d52', T(px + Math.cos(ry) * dx / 2, py + dy / 2, pz + Math.sin(ry) * dx / 2, -ry + Math.PI / 2, 1, segH * 1.04, 1, tilt), false);
          px += Math.cos(ry) * dx; pz += Math.sin(ry) * dx; py += dy;
        }
        trunks.addCol(BOX, T(x, y + 2, z, 0, 0.5, 4, 0.5));
        const crown = new THREE.Vector3(px, py + 0.2, pz);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + range(rng, -0.2, 0.2), col = k % 2 ? C.palm : C.palmDark;
          for (let seg = 0; seg < 2; seg++) {
            const L = 2.1 * s, droop = 0.25 + seg * 0.75, off = (seg * 1.9 + 1.0) * s;
            soft(leaves, BOX, T(crown.x + Math.cos(a) * off, crown.y - seg * 0.85 * s - 0.1, crown.z + Math.sin(a) * off, -a + Math.PI / 2, 0.9 * s * (seg ? 0.75 : 1), 0.07, L, droop), crown, col, 0.3, 2.5);
          }
        }
        continue;
      }
      const dens = h > 50 ? 0.03 : h > 24 ? 0.2 + n * 0.2 : 0.05 + Math.max(0, n) * 0.28;
      if (roll > dens) continue;
      nTree++;
      if (h > 24 || rng() < 0.3) {
        const th = 2.6 * s;
        trunks.add(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), C.woodDark, T(x, y + th / 2, z, ry, s, th, s), false);
        conifer(leaves, x, y + th * 0.75, z, s, ['#3f8a5a', '#4a9863', '#367c55'][Math.floor(rng() * 3)], ry);
      } else {
        const th = 3.0 * s;
        trunks.add(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), C.wood, T(x, y + th / 2, z, ry, s * 1.2, th, s * 1.2), false);
        canopy(leaves, rng, x, y + th + 1.3 * s, z, 2.5 * s, 2.0 * s, ['#6cb86a', '#5bab5f', '#7fc46f'][Math.floor(rng() * 3)]);
      }
      trunks.addCol(BOX, T(x, y + 2, z, ry, 0.6 * s, 4, 0.6 * s));
    }
  for (let i = 0; i < 2200; i++) {
    const x = range(rng, -BLACKSAIL.playHalf, BLACKSAIL.playHalf), z = range(rng, -BLACKSAIL.playHalf, BLACKSAIL.playHalf);
    const h = heightAt(x, z);
    if (blocked(x, z) || h < WL + 1.5 || h > 30 || coastD(x, z) < 20) continue;
    const n = fbm(x * 0.03, z * 0.03, 2, BLACKSAIL.seed + 60);
    if (n < 0.05) continue;
    if (i % 9 === 0) {
      const s = range(rng, 0.6, 1.2);
      bushes.add(BALL, ['#6cb86a', '#5bab5f', '#7fc46f'][i % 3], T(x, h + 0.3 * s, z, range(rng, 0, 6), s * 1.3, s * 0.8, s * 1.3), false);
    } else {
      const s = range(rng, 0.1, 0.18);
      bushes.add(BALL, ['#ff9ed2', '#ffe27a', '#ffffff', '#ff8a5c'][i % 4], T(x, h + 0.25, z, 0, s, s * 0.7, s), false);
    }
  }
  let nRocks = 0;
  for (let i = 0; i < 2600 && nRocks < 300; i++) {
    const x = range(rng, -BLACKSAIL.playHalf, BLACKSAIL.playHalf), z = range(rng, -BLACKSAIL.playHalf, BLACKSAIL.playHalf);
    const h = heightAt(x, z), sl = slope(x, z), d = coastD(x, z);
    if (blocked(x, z) || h < WL - 1.2) continue;
    const want = sl > 0.5 ? 0.45 : d > -4 && d < 6 ? 0.3 : 0.03;
    if (rng() > want) continue;
    const s = range(rng, 0.6, sl > 0.5 ? 3.0 : 1.8);
    rocks.add(ROCK, rng() > 0.5 ? C.rock : C.rockDark, T(x, lowest(x, z, s) + s * 0.15, z, range(rng, 0, 6), s * range(rng, 0.9, 1.5), s * range(rng, 0.6, 1.0), s, range(rng, -0.3, 0.3)));
    nRocks++;
  }

  pieces.push(
    { name: 'Lamps', material: 'M_Toon', batch: lamps, outline: true },
    { name: 'Trees_Trunks', material: 'M_Toon', batch: trunks, outline: true, userData: { count: nTree + nPalm, palms: nPalm } },
    { name: 'Trees_Leaves', material: 'M_Foliage', batch: leaves, outline: true },
    { name: 'Rocks', material: 'M_Toon', batch: rocks, outline: true, userData: { count: nRocks } },
    { name: 'Bushes', material: 'M_Foliage', batch: bushes },
  );
  return { pieces, markers };
}
