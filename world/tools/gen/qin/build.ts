import * as THREE from 'three';
import { Batch, T } from '../geo';
import { mulberry32 } from '../rng';
import type { Piece } from '../structures';
import { Frame } from '../orleans/craft';
import { distanceToLine, type ExpansionPlan, type RoutePoint } from '../../../src/map/worldPlan';
import { QIN_ROOMS, QIN_CORRIDORS, QIN_PALACE, QIN_STREAM, QIN_ARMY, QIN_LIFT, QIN_LEVELS, QIN_MAUSOLEUM, type QinCorridor, type QinPoint, type QinRoom } from '../../../src/map/qinPlan';
import { buildMausoleumPark, furnishChariotPit, furnishArmourPit, furnishWaterfowlPit, royalCityDetails } from './mausoleum';
import { ding, banner, balustrade } from './craft';
import { warriorPrims, horsePrims } from '../../../src/map/qinFigures';
import { Q, CYL, CYL8, MAT, qinRoof, pentRoof, gableRoof, barWindow, bracket, terrainWall, figure, rammedPlatform, earthWall, column, palaceHall, gateHouse, slabBetween, walkStrip, warrior, Shell } from './craft';
import { corridorRect, qinStreamDistance } from './landscape';

type Height = (x: number, z: number) => number;
const BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const WALL = 2.4;

export function buildQin(plan: ExpansionPlan, heightAt: Height, access: RoutePoint[]): Piece[] {
  const pieces: Piece[] = [];
  const make = (name: string, material = MAT, outline = true, userData?: Record<string, unknown>) => {
    const b = new Batch(`qin_${name}`, material); pieces.push({ name: b.name, material, batch: b, outline, userData }); return b;
  };
  const town = make('ArtisanTown'), works = make('Workshops'), palace = make('Palace'), pass = make('RiverPass'), aqueduct = make('Aqueduct');
  const ridge = make('RidgeBeacons'), halls = make('BuriedHalls'), foundry = make('BuriedFoundry'), garrison = make('TerracottaGarrison');
  const royal = make('BuriedRoyalCity'), glow = make('Glow', 'M_Emissive', false), water = make('Water', 'M_Water', false);
  const park = make('MausoleumPark'), pits = make('BurialPits'), mercury = make('Mercury', 'M_QinMercury', false);
  const trunks = make('Trees_Trunks'), leaves = make('Trees_Leaves', 'M_Foliage', false), beams = make('LightShafts', 'M_Beam', false);
  const surfaceRoutes = plan.routes.filter(r => r.kind !== 'underground');
  const roadLines = [...surfaceRoutes.map(r => r.points.map(p => [p[0], p[2]] as const)), access.map(p => [p[0], p[2]] as const)];
  const roadDistance = (x: number, z: number) => Math.min(...roadLines.map(line => distanceToLine(x, z, line)));
  const minGround = (x0: number, x1: number, z0: number, z1: number) => {
    let y = Infinity; for (let x = x0; x <= x1 + .01; x += Math.max(1, (x1 - x0) / 6)) for (let z = z0; z <= z1 + .01; z += Math.max(1, (z1 - z0) / 6)) y = Math.min(y, heightAt(x, z)); return y;
  };

  // ───────────── 骊水: stream ribbon and bridges where roads cross ─────────────
  walkStripVisual(water, QIN_STREAM.map(p => [p[0], p[1] - .45, p[2]] as QinPoint), 3.2);
  const crossings: [number, number, number, number][] = [];
  for (const line of [...surfaceRoutes.map(r => r.points), access]) for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]));
    for (let k = 0; k <= n; k++) {
      const x = a[0] + (b[0] - a[0]) * k / n, z = a[2] + (b[2] - a[2]) * k / n;
      if (qinStreamDistance(x, z) < .8 && !crossings.some(c => Math.hypot(c[0] - x, c[2] - z) < 10)) crossings.push([x, a[1] + (b[1] - a[1]) * k / n, z, Math.atan2(b[0] - a[0], b[2] - a[2])]);
    }
  }
  for (const [x, y, z, yaw] of crossings) {
    const f = new Frame(town, x, y, z, yaw);
    for (const s of [-1, 1]) { f.box(s * 3.4, .55, 0, .35, .7, 9, Q.stone, false); for (const zz of [-4.5, 4.5]) f.box(s * 3.4, .7, zz, .55, 1.1, .55, Q.stoneDark, false); }
    f.box(0, -.75, 0, 7.2, 1.3, 7.6, Q.stone, false);
  }

  // ───────────── 工匠集镇: houses around the post-road square ─────────────
  const square: RoutePoint = [-185, 22, 100];
  const paved: RoutePoint[] = []; for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI * 2; paved.push([square[0] + Math.cos(a) * 13, 22.06, square[2] + Math.sin(a) * 11]); }
  for (let i = 1; i < paved.length; i++) { const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([square[0], 22.06, square[2], ...paved[i], ...paved[i - 1]], 3)); town.add(g, Q.paving, new THREE.Matrix4(), false); g.dispose(); }
  // Well pavilion: an octagonal stone curb, windlass and a little hip roof on four posts.
  const well = new Frame(town, -173, 22, 112, .4);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; well.box(Math.cos(a) * 1.15, .45, Math.sin(a) * 1.15, .55, .9, .3, Q.stone, true, -a + Math.PI / 2); }
  well.cyl(0, .85, 0, .95, .05, Q.water, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) well.box(sx * 1.7, 1.6, sz * 1.4, .22, 3.2, .22, Q.redDark);
  well.beam([-1.5, 2.1, 0], [1.5, 2.1, 0], .18, Q.wood); well.cyl(0, 2.1, 0, .25, .9, Q.woodPale, false); well.beam([0, 2.05, 0], [0, 1, 0], .03, '#b9a77d');
  qinRoof(well, 3.4, 2.8, 3.25, 1.1, Q.tile, .6, false, { finScale: .45 });
  { const g0 = heightAt(-178, 86), st = new Frame(town, -178, g0, 86, .2); st.box(0, .4, 0, 2.6, .8, 1.6, Q.stoneDark); st.box(0, 2.4, 0, 1.6, 3.2, .45, Q.stone); for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) st.box(-.5 + c * .33, 3.6 - r * .36, .24, .2, .14, .02, Q.stoneDark, false); st.box(0, 4.15, 0, 1.9, .3, .6, Q.stone, false); }
  const workshopZones: [number, number, number][] = [[-222, 58, 18], [-128, 124, 13], [-212, 138, 12]];
  const houses: { position: [number, number, number]; width: number; depth: number; rotation: number; approach: [number, number, number] }[] = [];
  const rng = mulberry32(20261110), why: Record<string, number> = {};
  const reject = (k: string) => { why[k] = (why[k] ?? 0) + 1; };
  // Two paved lanes off the square, lined with houses on both sides.
  const lanes: QinPoint[][] = [[[-185, 22, 100], [-174, 22, 126], [-162, 22, 150]], [[-185, 22, 100], [-187, 22, 128], [-185, 22, 156]]];
  for (const lane of lanes) walkStripVisual2(town, lane.map(p => [p[0], heightAt(p[0], p[2]) + .05, p[2]] as QinPoint), 3.6, Q.paving);
  const candidates: [number, number][] = [];
  for (const lane of lanes) for (let i = 1; i < lane.length; i++) {
    const a = lane[i - 1], c = lane[i], len = Math.hypot(c[0] - a[0], c[2] - a[2]), nx = -(c[2] - a[2]) / len, nz = (c[0] - a[0]) / len;
    for (let t = 8; t < len; t += 11) for (const s of [-1, 1]) candidates.push([a[0] + (c[0] - a[0]) * t / len + nx * s * 10, a[2] + (c[2] - a[2]) * t / len + nz * s * 10]);
  }
  // Houses also line the post road as it leaves town toward the pass.
  const mainRoute = surfaceRoutes.find(r => r.kind === 'main')!.points;
  for (let i = 1; i < 3; i++) {
    const a = mainRoute[i - 1], c = mainRoute[i], len = Math.hypot(c[0] - a[0], c[2] - a[2]), nx = -(c[2] - a[2]) / len, nz = (c[0] - a[0]) / len;
    for (let t = 6; t < len - 4; t += 12) for (const s of [-1, 1]) candidates.push([a[0] + (c[0] - a[0]) * t / len + nx * s * 12.5, a[2] + (c[2] - a[2]) * t / len + nz * s * 12.5]);
  }
  for (let ring = 0; ring < 5; ring++) for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2 + ring * .4, r = 20 + ring * 11; candidates.push([square[0] + Math.cos(a) * r, square[2] + Math.sin(a) * r]); }
  const laneDistance = (x: number, z: number) => Math.min(...lanes.map(l => distanceToLine(x, z, l.map(p => [p[0], p[2]] as const))));
  for (const [x, z] of candidates) {
    if (houses.length >= 22) break;
    const w = 9 + Math.floor(rng() * 4), d = 7 + Math.floor(rng() * 3);
    const rad = Math.hypot(w, d) / 2;
    // Clear of each road's actual deck (the imperial post road is 16 m wide).
    if (surfaceRoutes.some(r => distanceToLine(x, z, r.points.map(p => [p[0], p[2]] as const)) < rad + (r.kind === 'main' ? 5.5 : 4.5)) || distanceToLine(x, z, access.map(p => [p[0], p[2]] as const)) < rad + 9.5 || laneDistance(x, z) < rad + 1.4) { reject('road'); continue; }
    if (qinStreamDistance(x, z) < rad + 4) { reject('stream'); continue; }
    if (workshopZones.some(([zx, zz, zr]) => Math.hypot(x - zx, z - zz) < zr + rad)) { reject('works'); continue; }
    if (houses.some(h => Math.hypot(h.position[0] - x, h.position[2] - z) < rad + Math.hypot(h.width, h.depth) / 2 + 3)) { reject('overlap'); continue; }
    // Face the nearest street; reject lots whose footprint varies by more than a step.
    let best = { d: Infinity, x: 0, z: 0, y: 0 };
    for (const line of [...surfaceRoutes.map(r => r.points), access, ...lanes]) for (let i = 1; i < line.length; i++) {
      const p = line[i - 1], q = line[i], dx = q[0] - p[0], dz = q[2] - p[2], t = THREE.MathUtils.clamp(((x - p[0]) * dx + (z - p[2]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      const px = p[0] + dx * t, pz = p[2] + dz * t, dd = Math.hypot(px - x, pz - z);
      if (dd < best.d) best = { d: dd, x: px, z: pz, y: p[1] + (q[1] - p[1]) * t };
    }
    if (best.d > 34) { reject('far'); continue; }
    const yaw = Math.atan2(best.x - x, best.z - z), f = new Frame(town, x, 0, z, yaw);
    let top = -Infinity, low = Infinity;
    for (let ix = 0; ix <= 6; ix++) for (let iz = 0; iz <= 6; iz++) { const p = f.point(-w / 2 + w * ix / 6, 0, -d / 2 + (d + 1.6) * iz / 6), h = heightAt(p.x, p.z); top = Math.max(top, h); low = Math.min(low, h); }
    if (top - low > 3.4) { reject('slope'); continue; }
    const y = top + .35, near = f.point(0, 0, d / 2 + 1.6), rise = y - heightAt(near.x, near.z);
    if (rise > 2) { reject('step'); continue; }
    const out = d / 2 + 1.6 + Math.max(0, rise) * 2.6, door = f.point(0, 0, out);
    if (best.d < out + 1 && best.d > d / 2 + 1) { reject('step'); continue; }
    qinHouse(town, x, y, z, w, d, yaw, houses.length, low - .5, out);
    houses.push({ position: [x, y, z], width: w, depth: d, rotation: yaw, approach: [door.x, heightAt(door.x, door.z), door.z] });
  }

  if (process.env.QIN_DEBUG) console.log('houses', houses.length, why);
  // 市: four stalls around the square, each with its own goods and awning.
  const accessLine = access.map(p => [p[0], p[2]] as const), laneLines = lanes.map(l => l.map(p => [p[0], p[2]] as const));
  const clear = (x: number, z: number, r: number) => distanceToLine(x, z, accessLine) > r + 8.6 && surfaceRoutes.every(rt => distanceToLine(x, z, rt.points.map(p => [p[0], p[2]] as const)) > r + (rt.kind === 'main' ? 4.2 : 3.4)) && laneLines.every(l => distanceToLine(x, z, l) > r + 2) && houses.every(h => Math.hypot(h.position[0] - x, h.position[2] - z) > r + Math.hypot(h.width, h.depth) / 2 + 1.2) && qinStreamDistance(x, z) > r + 2 && Math.hypot(x + 173, z - 112) > r + 3;
  const stalls: [number, number, number][] = [];
  for (const lane of laneLines) for (let t = .2; t < .9 && stalls.length < 6; t += .12) {
    const a = lane[0], c = lane[lane.length - 1], x0 = a[0] + (c[0] - a[0]) * t, z0 = a[1] + (c[1] - a[1]) * t, len = Math.hypot(c[0] - a[0], c[1] - a[1]), nx = -(c[1] - a[1]) / len, nz = (c[0] - a[0]) / len;
    for (const sd of [-1, 1]) { const x = x0 + nx * sd * 4.4, z = z0 + nz * sd * 4.4; if (stalls.length < 6 && clear(x, z, 1.8) && stalls.every(q => Math.hypot(q[0] - x, q[1] - z) > 4.5)) stalls.push([x, z, Math.atan2(-nx * sd, -nz * sd)]); }
  }
  for (const [i, [sx, sz, a]] of stalls.entries()) {
    const f = new Frame(town, sx, heightAt(sx, sz), sz, a);
    f.box(0, .45, 0, 2.6, .9, 1.2, Q.wood); for (const px of [-1.3, 1.3]) for (const pz of [-.5, 1.1]) f.box(px, 1.25, pz, .1, 2.5, .1, Q.wood, false);
    f.box(0, 2.55, .3, 3, .06, 2, [Q.silk, Q.ochre, '#7e8b6a', Q.azure, Q.cinnabar, '#8a7a5a'][i], false, 0); f.box(0, 2.45, 1.3, 3, .3, .04, [Q.cinnabar, Q.lacquer, Q.gold, Q.silk, Q.azure, Q.ochre][i], false);
    if (i % 4 === 0) for (let k = 0; k < 5; k++) f.cyl(-1 + k * .5, 1.05, 0, .14, .25, k % 2 ? Q.clay : Q.ochre, false);
    else if (i % 4 === 1) for (let k = 0; k < 4; k++) f.box(-.9 + k * .6, 1.0, 0, .5, .14, .9, [Q.silk, Q.azure, Q.cinnabar, '#d8c79a'][k], false);
    else if (i % 4 === 2) for (let k = 0; k < 6; k++) f.box(-1 + k * .4, .95, (k % 2) * .3 - .15, .06, .06, .55, Q.bronzeBright, false, k * .3);
    else for (let k = 0; k < 3; k++) f.cyl(-.8 + k * .8, 1.1, 0, .32, .35, '#3a5b45', false);
  }
  // Carts (双辕车) parked off the road.
  const carts: [number, number, number][] = [];
  for (let k = 0; k < 40 && carts.length < 3; k++) { const ang = k * 2.4, r = 16 + (k % 5) * 4, x = -185 + Math.cos(ang) * r, z = 100 + Math.sin(ang) * r; if (clear(x, z, 2.4) && stalls.every(q => Math.hypot(q[0] - x, q[1] - z) > 5) && carts.every(q => Math.hypot(q[0] - x, q[1] - z) > 6)) carts.push([x, z, ang + 1.2]); }
  for (const [cx, cz, a] of carts) {
    const f = new Frame(town, cx, heightAt(cx, cz), cz, a);
    for (const s of [-1, 1]) { const w = f.point(s * 1.1, .8, 0); town.add(new THREE.TorusGeometry(.78, .07, 6, 16), Q.wood, T(w.x, w.y, w.z, a + Math.PI / 2), false); town.add(new THREE.CylinderGeometry(.12, .12, .25, 8), Q.bronze, T(w.x, w.y, w.z, a, 1, 1, 1, 0, Math.PI / 2), false); }
    f.box(0, 1.05, 0, 1.9, .14, 2.2, Q.woodPale); for (const s of [-1, 1]) { f.box(s * .9, 1.4, 0, .08, .6, 2.2, Q.wood, false); f.beam([s * .45, 1, 1.1], [s * .45, .5, 3.6], .1, Q.wood); }
    for (let k = 0; k < 3; k++) town.add(new THREE.IcosahedronGeometry(.4, 1), '#b8aa82', T(f.point(-.4 + k * .4, 1.4, -.3 + (k % 2) * .5).x, heightAt(cx, cz) + 1.4, f.point(-.4 + k * .4, 1.4, -.3 + (k % 2) * .5).z, k, 1.2, .8, 1), false);
  }
  // ───────────── 窑场 · 铸造棚 · 简牍库 ─────────────
  kilnYard(works, glow, -222, 24, 58);
  foundryShed(works, glow, water, -128, 22.6, 124);
  archive(works, -212, 22, 138);

  // ───────────── 石料场 and the maintenance-tunnel portal ─────────────
  quarry(works, heightAt);

  // ───────────── 骊水关: twin-pier pass gate and walls up both slopes ─────────────
  gateHouse(pass, -70, 26.9, 82, 9, 9, Math.PI / 2, 10, 8);
  // Pass walls climb both slopes as continuous pounded-earth ramparts with battlements,
  // ending in small watch towers; the stream runs under a bridged section with a grille.
  terrainWall(pass, [[-70, 30], [-71, 46], [-70, 60.4]], heightAt, 6.5, 2.6, -1, 33);
  terrainWall(pass, [[-70, 67.6], [-70, 69.6]], heightAt, 6.5, 2.6, -1, 33);
  terrainWall(pass, [[-70, 94.4], [-71, 112], [-69, 132]], heightAt, 6.5, 2.6, -1, 33);
  for (let z = 60.4; z < 67.6; z += 3.6) { const zz = Math.min(z + 3.6, 67.6), cz = (z + zz) / 2, g = heightAt(-70, cz); earthWall(new Frame(pass, -70, 0, cz), zz - z + .1, Math.max(g + 7.5, 33), 2.6, g + 3.6); }
  for (const [x, z] of [[-70, 30], [-69, 132]] as const) {
    const g = heightAt(x, z), t = new Frame(pass, x, g, z);
    t.box(0, 4.2, 0, 5.4, 8.4, 5.4, Q.earth); t.box(0, .6, 0, 6, 1.2, 6, Q.stoneDark);
    t.box(0, 8.8, 0, 6.2, .5, 6.2, Q.wood, false); t.box(0, 10.3, 0, 4.4, 2.6, 4.4, Q.plaster, false);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box(sx * 2.1, 10.3, sz * 2.1, .35, 2.6, .35, Q.red, false);
    qinRoof(t, 4.4, 4.4, 11.8, 1.8, Q.tile, 1.4, false, { finScale: .5 });
  }
  for (const [x, z] of [[-60, 92], [-60, 72]] as const) banner(pass, x, heightAt(x, z), z, Math.PI / 2, 8);
  // Culvert arch over the stream: a bronze grille under the wall walk.
  for (let i = -1; i <= 1; i++) pass.box(-70, heightAt(-70, 64) - .5, 64 + i * .9, .2, 4, .12, Q.bronze, 0, false);

  // ───────────── 宫城: court, dragon-tail ramp, terrace, halls, watch tower ─────────────
  const [cx0, cx1, cz0, cz1, courtTop] = QIN_PALACE.court, [tx0, tx1, tz0, tz1, terraceTop] = QIN_PALACE.terrace, [px0, px1, pz0, pz1, pavTop] = QIN_PALACE.pavilion;
  rammedPlatform(palace, cx0, cx1, cz0, cz1, minGround(cx0, cx1, cz0, cz1) - 1.5, courtTop);
  rammedPlatform(palace, tx0, tx1, tz0, tz1, minGround(tx0, tx1, tz0, tz1) - 1.5, terraceTop);
  rammedPlatform(palace, px0, px1, pz0, pz1, minGround(px0, px1, pz0, pz1) - 1.5, pavTop);
  // Court paving: one stone axis and flagged squares either side.
  palace.box(40, courtTop - .02, (cz0 + cz1) / 2, 10, .06, cz1 - cz0 - 1, Q.paving, 0, false);
  for (let x = cx0 + 4; x < cx1 - 3; x += 8) for (let z = cz0 + 4; z < cz1 - 3; z += 8) if (Math.abs(x - 40) > 7) palace.box(x, courtTop - .02, z, 7.6, .04, 7.6, (x + z) % 16 ? '#a59f8b' : '#9a947f', 0, false);
  gateHouse(palace, QIN_PALACE.gate[0], courtTop, QIN_PALACE.gate[2], 10, 10, 0, 8, 9);
  // Court walls run back from the gate piers to the terrace, leaving the gate the only way in.
  for (const x of [cx0 + 1.2, cx1 - 1.2]) earthWall(new Frame(palace, x, courtTop, (cz0 + cz1 - 8) / 2), cz1 - cz0 - 8, 4.5, 2.2);
  for (const [xa, xb] of [[cx0, 26], [54, cx1]] as const) earthWall(new Frame(palace, (xa + xb) / 2, courtTop, cz1 - 1.2, Math.PI / 2), xb - xa, 4.5, 2.2);
  // 龙尾道: the broad ramp from court to terrace, with rammed cheeks and bronze posts.
  for (let k = 0; k < 7; k++) { const z1 = cz0 - k * (cz0 - tz1) / 7, z0 = z1 - (cz0 - tz1) / 7, top = courtTop + (terraceTop - courtTop) * k / 7 - .06; palace.box(40, courtTop - 1, (z0 + z1) / 2, 14, top - courtTop + 1, z1 - z0, Q.earth, 0, false); }
  walkStrip(palace, [[40, courtTop, cz0 + .01], [40, terraceTop, tz1 - .01]], 10.4, Q.paving);
  for (const s of [-1, 1]) {
    slabBetween(palace, [40 + s * 5.6, courtTop + .5, cz0], [40 + s * 5.6, terraceTop + .5, tz1], .6, 1, Q.stoneDark);
    for (let k = 0; k <= 5; k++) { const t = k / 5, y = courtTop + (terraceTop - courtTop) * t, z = cz0 + (tz1 - cz0) * t; palace.box(40 + s * 5.6, y + .9, z, .45, 1.3, .45, Q.bronze, 0, false); }
  }
  for (let k = 1; k < 24; k++) { const t = k / 24; palace.box(40, courtTop + (terraceTop - courtTop) * t + .02, cz0 + (tz1 - cz0) * t, 10, .05, .18, Q.stoneDark, 0, false); }
  palaceHall(palace, 40, terraceTop, -3, 36, 18, 9, 0, 'front', true);
  // Throne dais and twelve bronze figures along the hall front.
  palace.box(40, terraceTop, -8, 8, .8, 3, Q.lacquer); palace.box(40, terraceTop + .8, -8.5, 2.4, 1.6, 1, Q.redDark, 0, false);
  // 十二金人: twelve bronze colossi on stone pedestals, six either side of the hall axis.
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
    const x = 40 + s * (7 + i * 2.6); palace.box(x, terraceTop, 12, 1.5, .9, 1.5, Q.stone);
    figure(palace, warriorPrims(i % 2 ? 1 : 3, i).map(p => ({ ...p, color: p.color === '#5f5047' ? Q.bronzeBright : Q.bronze })), x, terraceTop + .9, 12, 0, true, 1.45);
  }
  for (const s of [-1, 1]) ding(palace, 40 + s * 9, courtTop, 72, 1.6);
  for (let z = cz0 + 6; z < cz1 - 10; z += 7) for (const x of [cx0 + 4.5, cx1 - 4.5]) banner(palace, x, courtTop, z, x < 40 ? Math.PI / 2 : -Math.PI / 2, 8);
  palaceHall(palace, 80, terraceTop, -4, 18, 10, 6, -Math.PI / 2, 'front');
  palaceHall(palace, 10, terraceTop, 6, 10, 10, 5.5, 0, 'all');
  // Terrace parapet: low rammed walls on the open edges, gaps for every arriving route.
  // Terrace balustrades on the open edges, with gaps for the ramp, the water gate and the watch-tower ramp.
  for (const [ax, az, bx, bz] of [[tx0 + .5, -14, tx0 + .5, tz1 - .5], [tx0 + .5, tz1 - .5, 34, tz1 - .5], [46, tz1 - .5, tx1 - .5, tz1 - .5], [tx1 - .5, tz1 - .5, tx1 - .5, -36]] as const) balustrade(palace, ax, az, bx, bz, terraceTop);
  for (const [ax, az, bx, bz] of [[cx0 + 2.5, cz0 + .5, 34, cz0 + .5], [46, cz0 + .5, cx1 - 2.5, cz0 + .5]] as const) balustrade(palace, ax, az, bx, bz, courtTop);
  // 观阙: two-storey watch tower on its own high platform, and its ramp to the rear court.
  palaceHall(palace, 90, pavTop, -32, 12, 10, 4.6, Math.PI / 2, 'all');
  const tower = new Frame(palace, 90, pavTop, -32);
  tower.box(0, 8.6, 0, 7, 3.4, 6, Q.plaster, false); for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower.box(sx * 3.3, 8.6, sz * 2.8, .45, 3.4, .45, Q.red, false);
  tower.box(0, 6.6, 0, 9, .4, 8, Q.wood, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bracket(tower, sx * 3.3, sz * 2.8, 6.8, .6);
  for (const sz of [-1, 1]) { tower.box(0, 7.35, sz * 3.95, 9, .08, .08, Q.redDark, false); for (let i = 0; i <= 10; i++) tower.box(-4.4 + i * .88, 7.05, sz * 3.95, .06, .55, .06, Q.wood, false); }
  pentRoof(tower, 12, 10, 6.4, 1.6, 1.1);
  qinRoof(tower, 7, 6, 10.4, 2.8, Q.tile, 1.6, false, { finScale: .9 });
  banner(palace, 98, pavTop, -40, -Math.PI / 2, 9);
  for (let k = 0; k < 8; k++) { const x0 = 48 + k * (px0 - 48) / 8, x1 = x0 + (px0 - 48) / 8, top = terraceTop + (pavTop - terraceTop) * k / 8 - .06; palace.box((x0 + x1) / 2, terraceTop - .5, -28, x1 - x0, top - terraceTop + .5, 6, Q.earth, 0, false); }
  walkStrip(palace, [[px0 + .01, pavTop, -28], [48, terraceTop, -28]], 6.4, Q.paving);
  for (const s of [-1, 1]) slabBetween(palace, [px0, pavTop + .5, -28 + s * 3.4], [48, terraceTop + .5, -28 + s * 3.4], .6, 1, Q.stoneDark);
  // Rear-court portal facade into the mountain (斜道).
  portal(halls, QIN_CORRIDORS.find(c => c.id === 'palace-incline')!, '宫');
  // Palace cistern where the aqueduct arrives (water gate on the west parapet).
  palace.box(11, terraceTop - .9, -37, 12, .9, 7, Q.stoneDark, 0, false); water.box(11, terraceTop - .25, -37, 11, .05, 6, Q.water, 0, false);

  // ───────────── 输水渠: channel and viaduct along the aqueduct route ─────────────
  buildAqueduct(aqueduct, water, plan.routes.find(r => r.id === 'aqueduct')!.points, heightAt);

  // ───────────── 山脊: beacon towers and steps on the crest path ─────────────
  // 烽燧: tapering rammed towers set beside (never on) the crest path, each a little different.
  const ridgeLine = plan.routes.find(r => r.id === 'ridge')!.points;
  for (const [bi, [x, z]] of ([[-150, -72], [-50, -130], [25, -131], [84, -96]] as const).entries()) {
    let best = { d: Infinity, nx: 0, nz: 1 };
    for (let i = 1; i < ridgeLine.length; i++) { const a = ridgeLine[i - 1], c = ridgeLine[i], len = Math.hypot(c[0] - a[0], c[2] - a[2]), t = Math.max(0, Math.min(1, ((x - a[0]) * (c[0] - a[0]) + (z - a[2]) * (c[2] - a[2])) / (len * len))), d = Math.hypot(a[0] + (c[0] - a[0]) * t - x, a[2] + (c[2] - a[2]) * t - z); if (d < best.d) best = { d, nx: -(c[2] - a[2]) / len, nz: (c[0] - a[0]) / len }; }
    const bx = x + best.nx * -11, bz = z + best.nz * -11, g = heightAt(bx, bz), f = new Frame(ridge, bx, g, bz, .3 + bi * .5), tall = 6 + (bi % 2) * 2;
    f.box(0, -.5, 0, 7, 1.5, 7, Q.stoneDark);
    for (let k = 0; k < 4; k++) { const w = 5.6 - k * .45, h = tall / 4; f.box(0, k * h + h / 2, 0, w, h, w, Q.earth); f.box(0, (k + 1) * h - .1, 0, w + .1, .18, w + .1, Q.wood, false); }
    const top = tall, tw = 5.6 - 1.8;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.box(sx * (tw / 2 - .25), top + .55, sz * (tw / 2 - .25), .5, 1.1, .5, Q.earth);
    f.box(0, top + .9, 0, 1.6, .3, 1.6, Q.bronze, false); f.box(0, top + 1.3, 0, 1.2, .5, 1.2, Q.ember, false);
    for (let k = 0; k < 3; k++) f.box(-1.1 + k * 1.1, top + .35, 1.4, .5, .7, .5, '#6a6458', false);
    for (let i = 0; i < 6; i++) { f.box(-3.1, .7 + i * (tall / 6), 2.9, .12, .12, 1.1, Q.wood, false); }
    for (const s of [-1, 1]) f.beam([-3.1, 0, 2.9 + s * .5], [-3.1, tall + .3, 2.9 + s * .5], .1, Q.wood);
    const hut = new Frame(ridge, f.point(4.6, 0, -1).x, heightAt(f.point(4.6, 0, -1).x, f.point(4.6, 0, -1).z), f.point(4.6, 0, -1).z, f.a);
    hut.box(0, 1.1, 0, 3, 2.2, 2.6, Q.earth); gableRoof(hut, 3, 2.6, 2.3, .9, Q.tile, .5, .4);
    banner(ridge, f.point(-2.2, 0, -2.4).x, g + top - .1, f.point(-2.2, 0, -2.4).z, f.a, 4);
  }
  const ridgeRoute = plan.routes.find(r => r.id === 'ridge')!.points;
  for (let i = 1; i < ridgeRoute.length; i++) {
    const a = ridgeRoute[i - 1], b = ridgeRoute[i], n = Math.floor(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.6), yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    if (Math.abs(b[1] - a[1]) / Math.hypot(b[0] - a[0], b[2] - a[2]) < .12) continue;
    for (let k = 1; k < n; k++) { const t = k / n; ridge.add(new THREE.BoxGeometry(4.6, .08, .3), Q.stoneDark, T(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + .13, a[2] + (b[2] - a[2]) * t, yaw), false); }
  }

  // ───────────── 地宫: rooms, corridors, portals ─────────────
  for (const room of QIN_ROOMS) buildRoom(room.id === 'royal' ? royal : room.id.endsWith('-pit') ? pits : halls, room);
  for (const c of QIN_CORRIDORS) buildCorridor(c.id === 'rail-incline' ? foundry : halls, glow, c);
  portal(halls, QIN_CORRIDORS.find(c => c.id === 'maintenance-south')!, '工');
  buildLiftShaft(halls);
  furnishFoundry(foundry, glow, make);
  furnishGarrison(garrison, glow);
  furnishRoyalCity(royal, glow);
  // 陪葬坑 off the royal city, and the walled mausoleum park on the plain above.
  { const room = (id: string) => QIN_ROOMS.find(r => r.id === id)!;
    const c = room('chariot-pit'), a = room('armour-pit'), w = room('waterfowl-pit');
    furnishChariotPit(pits, glow, c.x0, c.x1, c.z0, c.z1, c.floor);
    furnishArmourPit(pits, glow, a.x0, a.x1, a.z0, a.z1, a.floor);
    furnishWaterfowlPit(pits, glow, water, w.x0, w.x1, w.z0, w.z1, w.floor); }
  buildMausoleumPark(park, trunks, leaves, glow, heightAt);

  // ───────────── vegetation: pines on the mountain, willows in the valley ─────────────
  const random = mulberry32(7019); let trees = 0;
  const avoid = (x: number, z: number) => roadDistance(x, z) < 9 || houses.some(h => Math.hypot(h.position[0] - x, h.position[2] - z) < 10) || workshopZones.some(([zx, zz, zr]) => Math.hypot(x - zx, z - zz) < zr + 4)
    || (x > QIN_MAUSOLEUM.outer[0] - 6 && x < QIN_MAUSOLEUM.spiritWay.x1 + 6 && z > QIN_MAUSOLEUM.outer[2] - 6 && z < QIN_MAUSOLEUM.outer[3] + 6)
    || (x > -10 && x < 110 && z > -50 && z < 100) || (x > -150 && x < -100 && z > -70 && z < -20) || Math.abs(x + 70) < 10 && z > 45 && z < 125;
  for (let i = 0; i < 1400 && trees < 230; i++) {
    const x = -300 + random() * 600, z = -260 + random() * 560, y = heightAt(x, z);
    if (y < 18.5 || avoid(x, z) || qinStreamDistance(x, z) < 6 || Math.abs(x) > 330 || Math.abs(z) > 330) continue;
    const kind = y > 34 || random() < .3 ? 'pine' : qinStreamDistance(x, z) < 18 ? 'willow' : 'elm';
    if (kind === 'pine') {
      // Chinese pine: a leaning, branching trunk under flat layered canopies.
      const h = 7 + random() * 6, lean = (random() - .5) * .35, dir = random() * Math.PI * 2;
      trunks.add(CYL8, '#4f3b2c', T(x, y + h * .35, z, dir, .38, h * .7, .38, lean));
      for (let j = 0; j < 4; j++) {
        const t = .45 + j * .17, ox = Math.sin(dir) * lean * h * t + Math.cos(j * 2.1 + dir) * (1.6 - j * .3), oz = Math.cos(dir) * lean * h * t + Math.sin(j * 2.1 + dir) * (1.6 - j * .3), r = 2.9 - j * .55;
        trunks.add(CYL8, '#4f3b2c', T(x + ox * .5, y + h * t - .2, z + oz * .5, j * 2.1 + dir, .12, Math.hypot(ox, oz) + .4, .12, 0, Math.PI / 2 - .2));
        leaves.add(new THREE.CylinderGeometry(1, 1.15, 1, 9), j % 2 ? '#365640' : '#46664a', T(x + ox, y + h * t + .25, z + oz, j, r, .55, r * .85), false);
        leaves.add(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), j % 2 ? '#3f6047' : '#507253', T(x + ox, y + h * t + .5, z + oz, j, r * .92, .45, r * .8), false);
      }
    } else if (kind === 'willow') {
      // Willow: a stout trunk and long drooping streamers toward the water.
      const h = 5.5 + random() * 2; trunks.add(CYL8, '#5a4a3a', T(x, y + h / 2, z, 0, .5, h, .5));
      leaves.add(new THREE.SphereGeometry(2.6, 9, 6), '#8aa35e', T(x, y + h + .6, z, 0, 1, .7, 1), false);
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, rr = 2.2; leaves.add(new THREE.ConeGeometry(.55, 3.8, 5), k % 2 ? '#9ab36b' : '#7d9a55', T(x + Math.cos(a) * rr, y + h - 1.2, z + Math.sin(a) * rr, a, 1, 1, 1, Math.PI), false); }
    } else {
      const h = 5 + random() * 3, r = 2.4 + random() * 1.4; trunks.add(CYL8, Q.wood, T(x, y + h / 2, z, 0, .45, h, .45));
      for (let j = 0; j < 3; j++) leaves.add(new THREE.IcosahedronGeometry(1, 1), j % 2 ? '#7f9a58' : '#6f8c50', T(x + (j - 1) * r * .5, y + h + (j % 2) * r * .4, z + (j % 2) * r * .3, 0, r, r * .9, r), false);
    }
    trees++;
  }
  // 柏: dark columnar cypresses lining the palace approach and court walls.
  for (const [x, z] of [[2, 50], [2, 62], [2, 74], [78, 50], [78, 62], [78, 74], [26, 105], [54, 105], [-4, 0], [108, 0]] as const) {
    const y = heightAt(x, z); trunks.add(CYL8, '#4a3a2c', T(x, y + 1.5, z, 0, .3, 3, .3));
    for (let j = 0; j < 3; j++) leaves.add(new THREE.ConeGeometry(1.5 - j * .3, 4 - j * .6, 8), j % 2 ? '#2f4a36' : '#38553d', T(x, y + 3.2 + j * 2.1, z, j), false);
  }
  pieces.find(p => p.batch === town)!.userData = { houses };
  return pieces;

  // ───────────── local builders ─────────────
  function walkStripVisual2(b: Batch, points: QinPoint[], width: number, color: string) {
    const v: number[] = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], q = points[i], dx = q[0] - a[0], dz = q[2] - a[2], l = Math.hypot(dx, dz) || 1, ox = -dz / l * width / 2, oz = dx / l * width / 2;
      v.push(a[0] + ox, a[1], a[2] + oz, q[0] + ox, q[1], q[2] + oz, a[0] - ox, a[1], a[2] - oz, a[0] - ox, a[1], a[2] - oz, q[0] + ox, q[1], q[2] + oz, q[0] - ox, q[1], q[2] - oz);
    }
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); b.add(g, color, new THREE.Matrix4(), false); g.dispose();
  }
  function walkStripVisual(b: Batch, points: QinPoint[], width: number) {
    const v: number[] = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], q = points[i], dx = q[0] - a[0], dz = q[2] - a[2], l = Math.hypot(dx, dz) || 1, ox = -dz / l * width / 2, oz = dx / l * width / 2;
      v.push(a[0] + ox, a[1], a[2] + oz, q[0] + ox, q[1], q[2] + oz, a[0] - ox, a[1], a[2] - oz, a[0] - ox, a[1], a[2] - oz, q[0] + ox, q[1], q[2] + oz, q[0] - ox, q[1], q[2] - oz);
    }
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); b.add(g, Q.water, new THREE.Matrix4(), false); g.dispose();
  }

  function qinHouse(b: Batch, x: number, y: number, z: number, w: number, d: number, a: number, index: number, bottom: number, out: number) {
    // Six trades with their own massing, roof form and street furniture; no two neighbours alike.
    const type = index % 6, f = new Frame(b, x, y, z, a), hash = (index * 7919 + 13) % 97 / 97;
    const eave = 3.3 + hash * .7, bare = hash > .55, upper = type === 3 ? eave : eave;
    f.box(0, (bottom - y) / 2, 0, w + .6, y - bottom, d + .6, Q.stoneDark);
    f.box(0, -.12, 0, w, .24, d, Q.paving);
    const plasterC = bare ? Q.earthPale : Q.plaster;
    const wall = (xx: number, zz: number, ww: number, dd: number) => { f.box(xx, .6, zz, ww, 1.2, dd, Q.earthDark); f.box(xx, 1.2 + (upper - 1.2) / 2, zz, ww, upper - 1.2, dd, plasterC); };
    wall(-w / 2 + .35, 0, .7, d); wall(w / 2 - .35, 0, .7, d); wall(0, -d / 2 + .35, w, .7);
    const gap = 2.4, side = (w - gap) / 2;
    for (const s of [-1, 1]) wall(s * (gap / 2 + side / 2), d / 2 - .35, side, .7);
    f.box(0, (upper + 2.8) / 2, d / 2 - .35, gap, upper - 2.8, .7, plasterC);
    // timber frame showing through the plaster: corner posts, sill and head beams
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.box(sx * (w / 2 - .2), upper / 2, sz * (d / 2 - .2), .32, upper, .32, type === 5 ? Q.redDark : Q.wood, false);
    for (const sz of [-1, 1]) f.box(0, upper - .15, sz * (d / 2 - .02), w, .25, .12, Q.wood, false);
    for (const s of [-1, 1]) f.box(s * (gap / 2 + .1), 1.4, d / 2 - .1, .22, 2.8, .3, Q.wood, false);
    f.box(0, 2.85, d / 2 - .1, gap + .6, .25, .3, Q.wood, false);
    for (const s of [-1, 1]) { f.box(s * (gap / 2 - .2), 1.4, d / 2 - .9, .12, 2.6, 1.1, Q.lacquer, false); f.box(s * (gap / 2 - .14), 1.4, d / 2 - .9, .06, .18, .18, Q.bronzeBright, false); }
    for (const s of [-1, 1]) barWindow(f, s * w * .3, 2.1, d / 2 + .02, 1.3, .9, 6);
    const sideWin = new Frame(b, x, y, z, a + Math.PI / 2); barWindow(sideWin, 0, 2.1, w / 2 + .02, 1, .7, 4);
    const roofTop = type === 3 ? eave + 3.2 : eave;
    if (type === 3) {
      // 二层商楼: an upper storey on a projecting floor with a railed balcony
      f.box(0, eave + .15, .3, w + 1.2, .3, d + 1.6, Q.wood, false);
      f.box(0, eave + 1.7, -.2, w - 1, 2.8, d - 1, plasterC, false);
      for (let i = 0; i < 5; i++) f.box(-w / 2 + .6 + i * (w - 1.2) / 4, eave + 1.7, d / 2 - .6, .25, 2.8, .25, Q.red, false);
      f.box(0, eave + .9, d / 2 + .85, w + 1.2, .1, .1, Q.redDark, false); for (let i = 0; i <= 12; i++) f.box(-w / 2 - .5 + i * (w + 1) / 12, eave + .6, d / 2 + .85, .07, .6, .07, Q.wood, false);
      barWindow(f, -w * .2, eave + 1.9, d / 2 - .45, 1.6, 1, 7); barWindow(f, w * .2, eave + 1.9, d / 2 - .45, 1.6, 1, 7);
      pentRoof(f, w - .4, d - .4, eave + .05, 1.1, .7);
      qinRoof(f, w - 1, d - 1, roofTop + .2, Math.min(w, d) * .3, Q.tile, 1.2, false, { finScale: .5 });
      for (const s of [-1, 1]) { f.box(s * (w / 2 + .3), eave - .6, d / 2 + 1, .08, 2.4, .9, s < 0 ? Q.azure : Q.cinnabar, false); }
    } else if (type === 1 || type === 2 || type === 5) gableRoof(f, w, d, eave + .2, Math.min(w, d) * .36, Q.tile, 1.2, .9);
    else qinRoof(f, w, d, eave + .2, Math.min(w, d) * .32, Q.tile, 1.3, false, { finScale: .5 });
    const P = (lx: number, ly: number, lz: number) => f.point(lx, ly, lz);
    if (type === 0) {
      // 陶器铺: propped shutters over a counter, and stepped shelves of jars
      for (const s of [-1, 1]) { f.box(s * w * .3, 1.1, d / 2 + .5, 1.6, .9, .7, Q.wood); f.beam([s * w * .3 - .8, 2.6, d / 2 + .1], [s * w * .3 - .8, 3.1, d / 2 + 1.2], .12, Q.woodPale); f.box(s * w * .3, 3.15, d / 2 + .75, 1.7, .08, 1.1, Q.wood, false, -.0); }
      for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) { const p = P(-w / 2 - 1.1, .35 + r * .8, -d / 2 + 1.2 + i * 1.3); b.add(new THREE.SphereGeometry(.38 - r * .08, 9, 7), (i + r) % 3 === 0 ? Q.clay : (i + r) % 3 === 1 ? Q.terracottaDark : '#3e3a36', T(p.x, y + p.y - y, p.z, 0, 1, 1.25, 1), false); }
      f.box(-w / 2 - 1.1, .3, 0, 1.2, .1, d - 1, Q.wood, false); f.box(-w / 2 - 1.1, 1.1, 0, 1.2, .1, d - 1, Q.wood, false);
    } else if (type === 1) {
      // 铜匠铺: a lean-to forge shed against the side wall, its hearth still warm
      const ls = new Frame(b, x, y, z, a); ls.box(w / 2 + 1.6, 1.2, 0, .25, 2.4, .25, Q.wood, false);
      for (const zz of [-d / 2 + .6, d / 2 - .6]) ls.box(w / 2 + 2.8, 1.1, zz, .22, 2.2, .22, Q.wood, false);
      const sh = new Shell(ls); sh.quad([w / 2, 3.3, -d / 2], [w / 2, 3.3, d / 2], [w / 2 + 3.4, 2.3, d / 2], [w / 2 + 3.4, 2.3, -d / 2], [1, 1, 0]); sh.done(Q.tile);
      ls.box(w / 2 + 1.7, .5, -1, 1.4, 1, 1.4, Q.clay); ls.box(w / 2 + 1.7, 3.6, -1, .6, 3, .6, Q.earthDark, false);
      const hearth = P(w / 2 + 1.7, 1.05, -1); glow.add(new THREE.BoxGeometry(.9, .08, .9), Q.ember, T(hearth.x, y + 1.02, hearth.z, a), false);
      ls.box(w / 2 + 1.6, .45, 1.3, .5, .9, .5, Q.lacquer); ls.box(w / 2 + 1.6, .95, 1.3, .9, .18, .4, Q.bronze, false);
      for (let i = 0; i < 4; i++) ls.box(w / 2 + .4, 1.6 + i * .25, -d / 2 + 1 + i * .4, .05, .9, .05, Q.bronzeBright, false);
    } else if (type === 2) {
      // 粮仓院: two round granaries (囷) with conical thatch and a low yard wall
      for (const s of [-1, 1]) { const p = P(s * (w / 2 + 1.7), 0, -d * .15); b.add(CYL, Q.earthPale, T(p.x, y + 1.2, p.z, 0, 1.25, 2.4, 1.25)); b.add(new THREE.ConeGeometry(1.75, 1.6, 12), '#8f8156', T(p.x, y + 3.2, p.z), false); b.add(CYL8, Q.wood, T(p.x, y + .15, p.z, 0, 1.35, .3, 1.35), false); }
      f.box(0, .6, -d / 2 - 1.8, w + 5, 1.2, .5, Q.earth); for (const s of [-1, 1]) f.box(s * (w / 2 + 2.5), .6, -d / 2 - .6, .5, 1.2, 2.6, Q.earth);
    } else if (type === 4) {
      // 院落宅: a gate-house (门屋) with its own little roof ahead of the door
      const gz = Math.min(out - .6, d / 2 + 2.4);
      for (const s of [-1, 1]) { f.box(s * 1.7, 1.2, gz, 1, 2.4, .6, Q.earth); f.box(s * 1.25, 1.3, gz + .1, .22, 2.6, .22, Q.redDark, false); }
      qinRoof(new Frame(b, P(0, 0, gz).x, y, P(0, 0, gz).z, a), 3.6, 1.4, 2.8, .7, Q.tile, .5, false, { finScale: .35, rafters: false });
      for (const s of [-1, 1]) { const p = P(s * 2.6, 0, d / 2 + 1); b.add(new THREE.SphereGeometry(.7, 8, 6), '#5d7a4c', T(p.x, y + .7, p.z, 0, 1, 1.1, 1), false); }
    } else if (type === 5) {
      // 酒肆: tall pole with a wine banner, a vine pergola and sealed jars
      const pole = P(w / 2 + .9, 0, d / 2 + .9); b.add(CYL8, Q.wood, T(pole.x, y + 3.4, pole.z, 0, .09, 6.8, .09), false);
      const flag = new Frame(b, pole.x, y, pole.z, a); flag.box(0, 6.4, -.7, .05, .2, 1.4, Q.wood, false); flag.box(0, 5.3, -.7, .03, 2, 1.1, Q.cinnabar, false); flag.box(0, 4.15, -.7, .03, .25, 1.1, Q.gold, false);
      for (const xx of [-w / 2 + .8, -w / 2 + 3]) for (const zz of [d / 2 + 1, d / 2 + 3]) f.box(xx, 1.3, zz, .16, 2.6, .16, Q.wood, false);
      f.box(-w / 2 + 1.9, 2.65, d / 2 + 2, 2.6, .1, 2.4, '#6f8c50', false);
      for (let i = 0; i < 5; i++) { const p = P(w / 2 - .8 - i * .9, 0, d / 2 + .9); b.add(new THREE.CylinderGeometry(.3, .38, .75, 9), i % 2 ? Q.clay : Q.terracottaDark, T(p.x, y + .38, p.z), false); b.add(new THREE.CylinderGeometry(.22, .22, .12, 8), Q.cinnabar, T(p.x, y + .8, p.z), false); }
    }
    // Interior: sleeping platform (炕), a lacquer chest and a low table with dishes.
    f.box(-w / 2 + 1.6, .25, -d / 2 + 1.8, 2.4, .5, 2.8, Q.earthPale); f.box(-w / 2 + 1.6, .52, -d / 2 + 1.8, 2.2, .06, 2.6, Q.silk, false);
    f.box(w / 2 - 1.3, .4, -d / 2 + 1.2, 1.4, .8, .9, Q.lacquer); f.box(w / 2 - 1.3, .82, -d / 2 + 1.2, 1.45, .06, .95, Q.cinnabar, false);
    const ramp = f.point(0, 0, out), sill = f.point(0, 0, d / 2 - .2), dy = y - heightAt(ramp.x, ramp.z);
    if (dy > .12) {
      walkStrip(b, [[ramp.x, heightAt(ramp.x, ramp.z) + .03, ramp.z], [sill.x, y, sill.z]], 2.4, Q.paving);
      const g0 = heightAt(ramp.x, ramp.z), seg = (out - d / 2 + .2) / 4;
      for (let k = 0; k < 4; k++) { const top = g0 + (y - g0) * k / 4 - .05, bottom = g0 - .6, p = f.point(0, 0, out - seg * (k + .5)); b.add(new THREE.BoxGeometry(2.3, top - bottom, seg), Q.stoneDark, T(p.x, (top + bottom) / 2, p.z, a), false); }
    }
  }

  function kilnYard(b: Batch, g: Batch, x: number, y: number, z: number) {
    // 龙窑: two long climbing kilns built of brick in stepped chambers, firing ports aglow,
    // each ending in a tall flue; firewood ricks, a tile drying ground and a potter's wheel.
    for (const [dx, len, yaw, rise] of [[-5, 16, .35, 1.6], [5, 13, .35, 1.2]] as const) {
      const f = new Frame(b, x + dx, y, z, yaw), n = 5;
      for (let k = 0; k < n; k++) {
        const zz = -len / 2 + (k + .5) * len / n, lift = rise * k / (n - 1), seg = len / n + .05;
        f.box(0, .45 + lift / 2, zz, 4, .9 + lift, seg, Q.stoneDark);
        const p = f.point(0, 1.6 + lift, zz), half = new THREE.CylinderGeometry(1.75, 1.75, seg, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
        b.add(half, k % 2 ? Q.clay : '#a86f50', T(p.x, p.y - .7 + .7, p.z, yaw)); half.dispose();
        f.box(0, .9 + lift + .1, zz, 3.6, .9, seg, Q.clay);
        for (const sd of [-1, 1]) { const q = f.point(sd * 1.82, 1.2 + lift, zz); g.add(new THREE.BoxGeometry(.08, .42, .42), k % 2 ? Q.ember : Q.molten, T(q.x, q.y, q.z, yaw), false); b.add(new THREE.BoxGeometry(.12, .6, .6), Q.earthDark, T(q.x, q.y, q.z, yaw), false); }
        for (const sd of [-1, 1]) f.beam([sd * 1.95, 3.3 + lift, zz - seg / 2], [sd * 1.95, 3.3 + lift, zz + seg / 2], .08, Q.bronze);
      }
      f.box(0, 3.4 + rise, -len / 2 - .9, 1.6, 6.8, 1.6, Q.earthDark); f.box(0, 6.9 + rise, -len / 2 - .9, 2, .3, 2, Q.stoneDark, false);
      f.box(0, .9, len / 2 + .4, 2.4, 1.8, .5, Q.earthDark, false); const mouth = f.point(0, .9, len / 2 + .68); g.add(new THREE.BoxGeometry(1.3, .9, .05), Q.molten, T(mouth.x, y + .9, mouth.z, yaw), false);
      // a tiled shelter over the firing mouth
      const shelter = new Frame(b, f.point(0, 0, len / 2 + 2).x, y, f.point(0, 0, len / 2 + 2).z, yaw); for (const sx of [-1.6, 1.6]) shelter.box(sx, 1.4, 1.2, .18, 2.8, .18, Q.wood, false); gableRoof(shelter, 3.6, 3, 2.8, .9, Q.tile, .5, .4);
    }
    for (let i = 0; i < 3; i++) {
      const f = new Frame(b, x + 9 + i * 3.2, y, z + 8, -.2);
      for (const s of [-1, 1]) f.box(s * 1.2, 1, 0, .15, 2, .15, Q.wood, false);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) f.box(-1 + k * .5, .4 + r * .5, 0, .42, .06, .8, r % 2 ? Q.tile : Q.clay, false, .0);
    }
    for (let i = 0; i < 7; i++) { const jar = i % 3; b.add(new THREE.CylinderGeometry(jar === 0 ? .3 : .22, .4, .8, 10), i % 2 ? Q.clay : Q.terracotta, T(x - 9 + (i % 4) * 1, y + .4 + Math.floor(i / 4) * .82, z + 8), false); }
    for (let i = 0; i < 12; i++) b.add(CYL8, i % 3 ? Q.woodPale : Q.wood, T(x - 10 + (i % 3) * .05, y + .25 + Math.floor(i / 3) * .42, z - 4 + (i % 3) * .5 - .5, 0, .2, 3, .2, 0, Math.PI / 2), false);
    const wheel = new Frame(b, x - 8, y, z - 9); wheel.cyl(0, .35, 0, .5, .7, Q.wood); wheel.cyl(0, .75, 0, .7, .1, Q.stoneDark, false); wheel.cyl(0, .95, 0, .3, .3, Q.clay, false);
  }

  function foundryShed(b: Batch, g: Batch, wtr: Batch, x: number, y: number, z: number) {
    const f = new Frame(b, x, y, z, .1);
    for (const sx of [-7, 0, 7]) for (const sz of [-4.5, 4.5]) { f.box(sx, 2.4, sz, .45, 4.8, .45, Q.wood); bracket(f, sx, sz, 4.6, .45, 1); }
    f.box(0, 5, -4.5, 15, .3, .35, Q.wood, false); f.box(0, 5, 4.5, 15, .3, .35, Q.wood, false);
    gableRoof(f, 15, 10, 5.2, 2.6, Q.tile, 1.2, 1);
    f.cyl(-3, 1.1, -1, 1.4, 2.2, Q.clay); f.cyl(-3, 2.3, -1, 1.1, .3, Q.earthDark, false); const fire = f.point(-3, 2.48, -1); g.add(new THREE.CylinderGeometry(.85, .85, .08, 12), Q.molten, T(fire.x, fire.y, fire.z), false);
    for (const h of [.6, 1.6]) { const r = f.point(-3, h, -1); b.add(new THREE.TorusGeometry(1.42, .06, 5, 18), Q.bronze, T(r.x, r.y, r.z, 0, 1, 1, 1, Math.PI / 2), false); }
    f.box(-5.4, .5, -1, 1.6, .6, 1, Q.wood, false); b.add(new THREE.SphereGeometry(.55, 9, 6), '#6d5440', T(f.point(-5.4, 1.05, -1).x, y + 1.05, f.point(-5.4, 1.05, -1).z, .1, 1.1, .5, .8), false); f.beam([-4.6, .9, -1], [-3.6, 1.6, -1], .25, Q.clay);
    for (let i = 0; i < 4; i++) { f.box(2 + i * 1.1, .2, 1.5, .8, .4, 1.6, Q.earthPale, false); g.box(f.point(2 + i * 1.1, 0, 1.5).x, y + .41, f.point(2 + i * 1.1, 0, 1.5).z, .4, .02, 1, i % 2 ? Q.ember : Q.molten, .1, false); }
    for (let i = 0; i < 6; i++) f.box(4.6, .12 + i * .14, -2.4, 1.4, .12, .45, Q.bronzeBright, false, i * .15);
    f.box(-1, .5, 3, 3.4, 1, 1.2, Q.stoneDark); const q = f.point(-1, 1.02, 3); wtr.add(new THREE.BoxGeometry(3, .04, .9), Q.water, T(q.x, q.y, q.z, .1), false);
    f.box(5.6, .45, 2.6, 1.2, .9, .6, Q.lacquer); f.box(5.6, .95, 2.6, 1.6, .15, .55, Q.bronze, false);
    for (let k = 0; k < 5; k++) f.beam([6.6, .1, -3.6 + k * .5], [6.9, 2.4, -3.6 + k * .5], .06, k % 2 ? Q.wood : Q.bronzeBright);
  }

  function archive(b: Batch, x: number, y: number, z: number) {
    const w = 14, d = 10, f = new Frame(b, x, y, z, Math.atan2(-185 - x, 100 - z));
    rammedPlatform(b, x - 10, x + 10, z - 9, z + 9, heightAt(x, z) - 1.4, y + .1, false);
    f.box(0, 3, -d / 2 + .5, w, 6, 1, Q.earth); for (const s of [-1, 1]) f.box(s * (w / 2 - .5), 3, 0, 1, 6, d, Q.earth);
    for (const s of [-1, 1]) f.box(s * (w / 4 + .9), 3, d / 2 - .5, w / 2 - 1.8, 6, 1, Q.earth);
    f.box(0, 4.6, d / 2 - .5, 3.6, 2.8, 1, Q.earth); f.box(0, 3.3, d / 2 + .05, 4.2, .3, .3, Q.redDark, false);
    // Plaque over the door, high clerestory windows for dry air, and doors of studded lacquer.
    f.box(0, 4.6, d / 2 + .08, 2.2, .9, .12, Q.lacquer, false); f.box(0, 4.6, d / 2 + .15, 1.9, .7, .05, Q.gold, false);
    for (const s of [-1, 1]) { barWindow(f, s * 4, 5.1, d / 2 + .02, 1.6, .6, 7); const sw = new Frame(b, x, y, z, f.a + s * Math.PI / 2); for (const k of [-2.4, 0, 2.4]) barWindow(sw, k, 5.1, w / 2 + .02, 1.2, .6, 5); }
    for (const s of [-1, 1]) { f.box(s * 1.3, 1.6, d / 2 - 1.3, .12, 3.2, 1.6, Q.lacquer, false); for (let r = 0; r < 4; r++) f.box(s * 1.38, .6 + r * .7, d / 2 - 1.3, .06, .12, .12, Q.bronzeBright, false); }
    for (const s of [-1, 1]) for (const sz of [-1, 1]) f.box(s * (w / 2 - .4), 3.1, sz * (d / 2 - .4), .5, 6.2, .5, Q.wood, false);
    qinRoof(f, w, d, 6.4, 3, Q.tile, 1.8, false, { finScale: .8 });
    // Shelves of rolled bamboo-slip bundles, tagged with coloured silk.
    for (const sx of [-4.2, -1.6, 1.6, 4.2]) {
      f.box(sx, 1.6, -1.5, .9, 3.2, 5, Q.wood);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { const p = f.point(sx + (sx > 0 ? -.55 : .55), .5 + r * .75, -3.4 + k * 1.2); b.add(CYL8, (r + k) % 3 ? '#c9b07a' : '#b59a62', T(p.x, y + .5 + r * .75, p.z, 0, .22, .5, .22, 0, Math.PI / 2), false); const t = f.point(sx + (sx > 0 ? -.82 : .82), .45 + r * .75, -3.4 + k * 1.2); b.add(new THREE.BoxGeometry(.02, .14, .08), [Q.cinnabar, Q.azure, Q.gold][(r + k) % 3], T(t.x, y + .45 + r * .75, t.z, f.a), false); }
    }
    f.box(4.3, .45, 3.3, 1.6, .9, 1.2, Q.lacquer); for (let k = 0; k < 3; k++) f.box(4.1 + k * .2, .95, 3.2, .5, .02, .35, '#d8c79a', false, k * .2);
    const lamp = f.point(-4.4, 0, 3.4); b.add(CYL8, Q.bronze, T(lamp.x, y + .6, lamp.z, 0, .06, 1.2, .06), false); glow.add(new THREE.ConeGeometry(.1, .25, 6), Q.molten, T(lamp.x, y + 1.32, lamp.z), false);
  }

  function quarry(b: Batch, h: Height) {
    // Stepped benches cut into the spur with tool-split faces, wedge slots and a timber derrick.
    for (let tier = 0; tier < 4; tier++) for (let i = -3; i <= 3; i++) {
      const x = -125 + i * 4.4, z = -58 - tier * 3.2, g = h(x, z), top = 28 + 2.8 * (tier + 1);
      if (Math.abs(x + 125) < 6.5) continue;
      b.box(x, Math.min(g, 28) - 1, z, 4.3, top - Math.min(g, 28) + 1, 3.1, tier % 2 ? Q.stone : '#9b9a91', 0);
      for (let k = -1; k <= 1; k++) b.box(x + k * 1.3, top - .25, z + 1.56, .18, .3, .06, Q.stoneDark, 0, false);
    }
    for (let i = 0; i < 9; i++) { const x = -140 + (i % 3) * 3.4, z = -38 + Math.floor(i / 3) * 2.8; b.box(x, 28, z, 2.6, 1.2 + (i % 2) * .5, 1.8, i % 2 ? Q.stone : '#a3a198', (i * .37) % 1 - .5); }
    for (let i = 0; i < 14; i++) b.add(new THREE.DodecahedronGeometry(.35 + (i % 4) * .12, 0), i % 2 ? Q.stone : Q.stoneDark, T(-133 + (i * 2.7) % 14, 28.2, -46 + (i * 1.9) % 6, i), false);
    const f = new Frame(b, -112, 28, -40, -.4);
    f.box(0, 4, 0, .45, 8, .45, Q.wood); for (const s of [-1, 1]) f.beam([0, 7.6, 0], [s * 2.2, 0, -2.4], .18, Q.wood); f.beam([0, 7.6, 0], [0, 6, 6], .3, Q.wood); f.beam([0, 6, 6], [0, 2.4, 6], .04, '#b9a77d');
    f.box(0, 1.1, 6, 1.4, 1.2, 1.4, Q.stone, false); f.cyl(0, 1.2, -1, .5, 1.6, Q.wood, false);
    for (const s of [-1, 1]) f.beam([s * 1.2, .2, -2.5], [s * 1.2, .2, 9], .2, Q.woodPale, false);
    // masons' shelter with mallets, chisels and a water jar
    const shelter = new Frame(b, -146, 28, -50, .6); for (const sx of [-1.8, 1.8]) for (const sz of [-1.3, 1.3]) shelter.box(sx, 1.3, sz, .16, 2.6, .16, Q.wood, false);
    gableRoof(shelter, 4, 3, 2.6, .9, Q.tile, .5, .5); shelter.box(0, .4, 0, 2.6, .8, 1, Q.wood); for (let k = 0; k < 4; k++) shelter.box(-.9 + k * .6, .85, 0, .1, .1, .5, k % 2 ? Q.bronze : Q.wood, false);
    b.add(new THREE.CylinderGeometry(.35, .45, .9, 9), Q.clay, T(-148, 28.45, -47.5), false);
  }

  function buildLiftShaft(b: Batch) {
    // 竖井: a timber-lined square shaft from the garrison roof to the ridge, guide posts in
    // each corner, and above ground a deck, a winch house and a headframe with its wheel.
    const { x, z, half, top } = QIN_LIFT, base = QIN_LEVELS.army + 11, h = top - base, t = 1.2;
    for (const [dx, dz, w, d] of [[-half - t / 2, 0, t, half * 2 + t * 2], [half + t / 2, 0, t, half * 2 + t * 2], [0, -half - t / 2, half * 2, t], [0, half + t / 2, half * 2, t]] as const) b.box(x + dx, base, z + dz, w, h - .02, d, Q.earth);
    for (let yy = base + 2; yy < top - 1; yy += 3.2) for (const s of [-1, 1]) { b.box(x + s * (half - .1), yy, z, .2, .3, half * 2, Q.wood, 0, false); b.box(x, yy, z + s * (half - .1), half * 2, .3, .2, Q.wood, 0, false); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(x + sx * (half - .15), QIN_LEVELS.army, z + sz * (half - .15), .3, top - QIN_LEVELS.army + 6, .3, Q.bronze, 0, false);
    // bottom: a bronze-kerbed landing ring flush with the garrison floor
    for (const s of [-1, 1]) { b.box(x + s * (half + .2), QIN_LEVELS.army, z, .4, .06, half * 2 + .8, Q.bronzeBright, 0, false); b.box(x, QIN_LEVELS.army, z + s * (half + .2), half * 2 + .8, .06, .4, Q.bronzeBright, 0, false); }
    // top deck around the opening, flush with the ridge path, with a stone foot
    const [dx0, dx1, dz0, dz1] = QIN_LIFT.deck;
    for (const [ax0, ax1, az0, az1] of [[dx0, x - half, dz0, dz1], [x + half, dx1, dz0, dz1], [x - half, x + half, dz0, z - half], [x - half, x + half, z + half, dz1]] as const) b.box((ax0 + ax1) / 2, top - 3, (az0 + az1) / 2, ax1 - ax0, 3, az1 - az0, Q.stoneDark);
    for (let k = 0; k < 12; k++) b.box(dx0 + .5 + k * (dx1 - dx0 - 1) / 11, top - .02, (dz0 + dz1) / 2, (dx1 - dx0) / 12 - .1, .04, dz1 - dz0 - .6, Q.wood, 0, false);
    // railings on the south and side edges of the opening; the north side is the boarding side
    for (const s of [-1, 1]) { b.box(x + s * (half + .15), top, z + .6, .2, 1.1, half * 2 - 1.2, Q.redDark); }
    b.box(x, top, z + half + .15, half * 2 + .5, 1.1, .2, Q.redDark);
    // headframe: two raked legs each side carrying the sheave wheel axle over the shaft
    const hf = new Frame(b, x, top, z);
    for (const sx of [-1, 1]) { hf.beam([sx * (half + 1.6), 0, -2.6], [sx * (half + .4), 9, 0], .45, Q.wood); hf.beam([sx * (half + 1.6), 0, 2.6], [sx * (half + .4), 9, 0], .45, Q.wood); hf.beam([sx * (half + 1.2), 3.2, -1.8], [sx * (half + 1.2), 3.2, 1.8], .25, Q.wood); }
    hf.box(0, 9.1, 0, half * 2 + 1.6, .5, .6, Q.wood); hf.box(0, 9.6, 0, half * 2 + 2.2, .2, 1, Q.tile, false);
    const winch = new Frame(b, x + half + 4.2, top, z - 4.6, 0); winch.box(0, 1.4, 0, 3.4, 2.8, 3, Q.earth); gableRoof(winch, 3.4, 3, 2.9, 1, Q.tile, .5, .5);
    winch.cyl(-2.4, 1.2, 0, .6, 2.2, Q.wood, false); for (let k = 0; k < 4; k++) winch.box(-2.4, 1.2, 0, .12, 2.6, .12, Q.woodPale, false, k * Math.PI / 4);
    banner(b, x - half - 2.5, top, z - 6.5, Math.PI / 2, 7);
  }

  function portal(b: Batch, c: QinCorridor, glyph: string) {
    // A gate-face cut into the mountain: rammed side walls stepping down like que towers,
    // a lintel of timber and bronze, a hip-roofed porch, guardian figures and hanging lamps.
    const end = c.portal === 'a' ? c.a : c.b, other = c.portal === 'a' ? c.b : c.a;
    const yaw = Math.atan2(end[0] - other[0], end[2] - other[2]), f = new Frame(b, end[0], end[1], end[2], yaw);
    const w = c.width, h = c.height, span = w + 16, tall = h + 7;
    for (const s of [-1, 1]) {
      f.box(s * (w / 2 + (span - w) / 4), tall / 2 - 1.5, -.5, (span - w) / 2, tall + 3, 3.4, Q.earth);
      f.box(s * (w / 2 + (span - w) / 2 + 1.6), (tall - 3) / 2 - 1.5, -.9, 3.2, tall, 2.6, Q.earth);
      f.box(s * (w / 2 + (span - w) / 4), .5, 1.3, (span - w) / 2 + .4, 1, .6, Q.stoneDark, false);
      for (let yy = 1.6; yy < tall - .5; yy += 2) f.box(s * (w / 2 + (span - w) / 4), yy, 1.25, (span - w) / 2, .16, .1, Q.wood, false);
      figure(b, warriorPrims(s < 0 ? 3 : 1, glyph.length + (s > 0 ? 1 : 0)).map(p => ({ ...p, color: p.color === '#5f5047' ? Q.bronzeBright : Q.bronze })), f.point(s * (w / 2 + 1.8), 0, 2.2).x, end[1], f.point(s * (w / 2 + 1.8), 0, 2.2).z, yaw, true, 1.3);
      const lamp = f.point(s * (w / 2 + .6), h + .2, 1.9); b.add(new THREE.CylinderGeometry(.22, .3, .5, 8), Q.bronze, T(lamp.x, lamp.y - .6, lamp.z), false); glow.add(new THREE.CylinderGeometry(.16, .16, .35, 8), Q.molten, T(lamp.x, lamp.y - .6, lamp.z), false); b.add(CYL8, Q.bronze, T(lamp.x, lamp.y - .1, lamp.z, 0, .02, .6, .02), false);
    }
    f.box(0, h + (tall - h) / 2, -.5, w + .2, tall - h, 3.4, Q.earth);
    f.box(0, h + .3, 1.3, w + 1.6, .6, .5, Q.redDark, false); f.box(0, h + .8, 1.3, w + 2.4, .4, .7, Q.wood, false);
    for (let k = -2; k <= 2; k++) f.box(k * (w / 5), h + .3, 1.58, .45, .45, .08, Q.bronzeBright, false);
    for (const s of [-1, 1]) { f.box(s * (w / 2 + .3), h / 2, 1.3, .6, h, .6, Q.red, false); f.box(s * (w / 2 + .3), .3, 1.3, 1, .6, 1, Q.bronze, false); f.box(s * (w / 2 - .1), h / 2, .3, .2, h - .3, w / 2 - .4, Q.lacquer, false); }
    f.box(0, h + 2.6, 1.32, 3.2, 2.6, .2, Q.lacquer, false); f.box(0, h + 2.6, 1.44, 2.6, 2, .06, Q.gold, false); f.box(0, h + 2.6, 1.48, 2.2, 1.6, .06, Q.lacquer, false);
    for (let k = -1; k <= 1; k++) bracket(f, k * (w / 2 + 1), 1.6, h + 1, .7);
    qinRoof(new Frame(b, f.point(0, 0, .8).x, end[1], f.point(0, 0, .8).z, yaw), span - 3, 4.6, tall + .4, 2.2, Q.tile, 1.6, false, { finScale: 1 });
    for (const s of [-1, 1]) qinRoof(new Frame(b, f.point(s * (w / 2 + (span - w) / 2 + 1.6), 0, -.9).x, end[1], f.point(s * (w / 2 + (span - w) / 2 + 1.6), 0, -.9).z, yaw), 3.2, 2.6, tall - 1.4, 1, Q.tile, .9, false, { fins: false });
  }

  function buildRoom(b: Batch, r: QinRoom) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, top = r.floor + r.height;
    // Floor only under the interior: sloped corridors own the floor through the doorway.
    b.box(cx, r.floor - 1.2, cz, w, 1.2, d, r.id === 'royal' ? '#5a5f68' : Q.paving);
    if (r.id === 'army') {
      // The lift shaft pierces the garrison roof over the central avenue.
      const hx0 = QIN_LIFT.x - QIN_LIFT.half - .1, hx1 = QIN_LIFT.x + QIN_LIFT.half + .1, hz0 = QIN_LIFT.z - QIN_LIFT.half - .1, hz1 = QIN_LIFT.z + QIN_LIFT.half + .1, X0 = r.x0 - WALL, X1 = r.x1 + WALL, Z0 = r.z0 - WALL, Z1 = r.z1 + WALL;
      b.box((X0 + hx0) / 2, top, cz, hx0 - X0, 1.4, Z1 - Z0, Q.earthDark); b.box((hx1 + X1) / 2, top, cz, X1 - hx1, 1.4, Z1 - Z0, Q.earthDark);
      b.box(QIN_LIFT.x, top, (Z0 + hz0) / 2, hx1 - hx0, 1.4, hz0 - Z0, Q.earthDark); b.box(QIN_LIFT.x, top, (hz1 + Z1) / 2, hx1 - hx0, 1.4, Z1 - hz1, Q.earthDark);
    } else b.box(cx, top, cz, w + WALL * 2, 1.4, d + WALL * 2, Q.earthDark);
    const openings = (axis: 'x' | 'z', at: number) => QIN_CORRIDORS.flatMap(c => [c.a, c.b].filter(p => Math.abs((axis === 'x' ? p[0] : p[2]) - at) < .01 && (axis === 'x' ? p[2] > r.z0 && p[2] < r.z1 : p[0] > r.x0 && p[0] < r.x1)).map(p => ({ at: axis === 'x' ? p[2] : p[0], half: c.width / 2, top: p[1] + c.height })));
    const side = (axis: 'x' | 'z', at: number, from: number, to: number, out: number) => {
      const holes = openings(axis, at).sort((p, q) => p.at - q.at);
      let cursor = from - WALL;
      const piece = (a0: number, a1: number, y0: number, y1: number) => {
        if (a1 - a0 < .05 || y1 - y0 < .05) return;
        if (axis === 'x') b.box(at + out * WALL / 2, y0, (a0 + a1) / 2, WALL, y1 - y0, a1 - a0, Q.earth);
        else b.box((a0 + a1) / 2, y0, at + out * WALL / 2, a1 - a0, y1 - y0, WALL, Q.earth);
      };
      for (const hole of holes) { piece(cursor, hole.at - hole.half, r.floor - 1.2, top + .2); piece(hole.at - hole.half, hole.at + hole.half, hole.top, top + .2); cursor = hole.at + hole.half; }
      piece(cursor, to + WALL, r.floor - 1.2, top + .2);
      // Rammed courses and a painted dado on the inner face.
      const inner = at - out * .02;
      for (let y = r.floor + 1.6; y < top - .5; y += 1.6) {
        if (axis === 'x') b.box(inner, y, (from + to) / 2, .06, .12, to - from, Q.earthPale, 0, false); else b.box((from + to) / 2, y, inner, to - from, .12, .06, Q.earthPale, 0, false);
      }
    };
    side('x', r.x0, r.z0, r.z1, -1); side('x', r.x1, r.z0, r.z1, 1); side('z', r.z0, r.x0, r.x1, -1); side('z', r.z1, r.x0, r.x1, 1);
    // Roof timbers (棚木) under the ceiling.
    if (r.id !== 'royal') for (let x = r.x0 + 1.5; x < r.x1; x += 3) { if (r.id === 'army' && Math.abs(x - QIN_LIFT.x) < QIN_LIFT.half + .6) continue; b.box(x, top - .7, cz, .7, .7, d, Q.wood, 0, false); }
  }

  function buildCorridor(b: Batch, g: Batch, c: QinCorridor) {
    const alongZ = c.a[0] === c.b[0], hw = c.width / 2, lo = Math.min(c.a[1], c.b[1]), hi = Math.max(c.a[1], c.b[1]);
    walkStrip(b, [c.a, c.b], c.width + .3, c.id === 'rail-incline' ? '#7d776a' : Q.paving);
    slabBetween(b, [c.a[0], c.a[1] - .45, c.a[2]], [c.b[0], c.b[1] - .45, c.b[2]], c.width + .2, .8, Q.stoneDark, false);
    const r = corridorRect(c);
    for (const s of [-1, 1]) {
      if (alongZ) b.box(c.a[0] + s * (hw + WALL / 2), lo - 1.2, (r[2] + r[3]) / 2, WALL, hi - lo + c.height + 2.6, r[3] - r[2], Q.earth);
      else b.box((r[0] + r[1]) / 2, lo - 1.2, c.a[2] + s * (hw + WALL / 2), r[1] - r[0], hi - lo + c.height + 2.6, WALL, Q.earth);
    }
    slabBetween(b, [c.a[0], c.a[1] + c.height + .7, c.a[2]], [c.b[0], c.b[1] + c.height + .7, c.b[2]], c.width + WALL * 2, 1.4, Q.earthDark);
    // Timber frames every few metres and bronze oil lamps along one wall.
    const len = Math.hypot(c.b[0] - c.a[0], c.b[2] - c.a[2]);
    for (let t = 2; t < len - 1; t += 5) {
      const k = t / len, x = c.a[0] + (c.b[0] - c.a[0]) * k, z = c.a[2] + (c.b[2] - c.a[2]) * k, y = c.a[1] + (c.b[1] - c.a[1]) * k;
      for (const s of [-1, 1]) b.box(alongZ ? x + s * (hw - .2) : x, y, alongZ ? z : z + s * (hw - .2), .4, c.height, .4, Q.wood, 0, false);
      b.box(x, y + c.height - .45, z, alongZ ? c.width : .4, .4, alongZ ? .4 : c.width, Q.wood, 0, false);
      if (Math.round(t / 5) % 2) g.box(alongZ ? x - hw + .25 : x, y + 2.4, alongZ ? z : z - hw + .25, .3, .35, .3, Q.molten, 0, false);
    }
    if (c.id === 'rail-incline' || c.id === 'maintenance-east') {
      // 运俑轨道: two timber rails and sleepers, with a cart parked part-way.
      for (const s of [-.8, .8]) slabBetween(b, [c.a[0], c.a[1] + .08, c.a[2] + s], [c.b[0], c.b[1] + .08, c.b[2] + s], .12, .12, Q.bronze, false);
      for (let t = 1; t < len; t += 1.4) { const k = t / len; b.box(c.a[0] + (c.b[0] - c.a[0]) * k, c.a[1] + (c.b[1] - c.a[1]) * k + .01, c.a[2], .3, .06, 2.4, Q.wood, 0, false); }
    }
  }

  function furnishFoundry(b: Batch, g: Batch, mk: typeof make) {
    const y = 46;
    for (const [i, [x, z]] of ([[124, -84], [142, -84], [146, -106]] as const).entries()) {
      // Shaft furnace: stone footing, tapered clay stack bound with bronze hoops, a hood to the roof.
      b.add(CYL, Q.stoneDark, T(x, y + .4, z, 0, 3.6, .8, 3.6));
      b.add(new THREE.CylinderGeometry(2.3, 3.1, 4.6, 16), Q.clay, T(x, y + 3.1, z));
      for (const h of [1.6, 2.9, 4.2]) b.add(new THREE.TorusGeometry(3.1 - (h - .8) / 4.6 * .8 + .07, .1, 6, 28), Q.bronze, T(x, y + h, z, 0, 1, 1, 1, Math.PI / 2), false);
      b.add(CYL, Q.earthDark, T(x, y + 5.5, z, 0, 2.5, .4, 2.5), false);
      g.add(new THREE.CylinderGeometry(1.8, 1.8, .1, 16), Q.molten, T(x, y + 5.72, z), false);
      b.add(new THREE.CylinderGeometry(.9, 2.6, 2, 14), Q.earthDark, T(x, y + 8.4, z), false);
      b.add(CYL8, Q.earthDark, T(x, y + 10.3, z, 0, .9, 1.8, .9), false);
      // tapping spout pouring into the floor channel
      const spout = new Frame(b, x, y, z, Math.PI); spout.box(0, .9, 3.2, .7, .3, 1.4, Q.clay, false);
      const sp = spout.point(0, .9, 3.9); g.add(new THREE.BoxGeometry(.25, .9, .25), Q.molten, T(sp.x, y + .45, sp.z), false);
      // twin leather bellows (橐) on timber frames, their pipes driving into the stack
      for (const s of [-1, 1]) {
        const bf = new Frame(b, x - 4.6, y, z + s * 1.6, 0);
        bf.box(0, .3, 0, 1.6, .6, 1.2, Q.wood); b.add(new THREE.SphereGeometry(.75, 10, 7), '#6d5440', T(bf.point(0, 1.1, 0).x, y + 1.1, bf.point(0, 1.1, 0).z, 0, 1.1, .55, .8), false);
        bf.box(0, 1.55, 0, 1.3, .1, 1, Q.wood, false); bf.beam([0, 1.6, 0], [-.4, 2.4 + (s > 0 ? .3 : 0), 0], .1, Q.wood);
        bf.beam([.8, 1, 0], [2.2, 1.6, -s * 1.2], .16, Q.clay);
      }
      for (let k = 0; k < 6; k++) g.box(x + Math.cos(k * 1.05) * 3.15, y + .55, z + Math.sin(k * 1.05) * 3.15, .5, .35, .5, Q.ember, -k * 1.05, false);
      // crucible gantry on the far side
      if (i < 2) {
        const gx = x + 4.2, gf = new Frame(b, gx, y, z, 0);
        for (const s of [-1, 1]) gf.box(0, 3, s * 2.2, .35, 6, .35, Q.wood); gf.box(0, 6, 0, .4, .4, 4.8, Q.wood);
        gf.beam([0, 6, 0], [0, 3.2, 0], .05, Q.bronze);
        b.add(new THREE.CylinderGeometry(.55, .38, .8, 10), Q.earthDark, T(gx, y + 2.8, z), false); g.add(new THREE.CylinderGeometry(.48, .48, .06, 10), Q.molten, T(gx, y + 3.22, z), false);
      }
    }
    // Molten channels from the furnaces to rows of moulds (gleaming bronze in sand).
    for (const [x0, z0, x1, z1] of [[124, -80, 124, -66], [142, -80, 142, -66], [142, -102, 128, -102]] as const) { g.box((x0 + x1) / 2, y + .02, (z0 + z1) / 2, Math.abs(x1 - x0) + .5, .06, Math.abs(z1 - z0) + .5, Q.molten, 0, false); b.box((x0 + x1) / 2, y, (z0 + z1) / 2, Math.abs(x1 - x0) + 1.1, .16, Math.abs(z1 - z0) + 1.1, Q.stoneDark, 0, false); }
    for (let i = 0; i < 6; i++) for (const z of [-66.5, -64]) { b.box(116 + i * 5, y, z, 3.2, .5, 1.8, '#a89a7d', 0, false); g.box(116 + i * 5, y + .5, z, 2.2, .04, .25, (i + (z < -65 ? 1 : 0)) % 2 ? Q.molten : Q.ember, 0, false); }
    // Weapon racks: dagger-axes (戈), spears and crossbows fresh from the moulds.
    for (const x of [150, 156]) {
      const r = new Frame(b, x, y, -72, 0); for (const s of [-1, 1]) r.box(s * 2, 1.4, 0, .2, 2.8, .2, Q.wood); r.box(0, 2.6, 0, 4.4, .15, .3, Q.wood, false); r.box(0, .7, 0, 4.4, .15, .3, Q.wood, false);
      for (let k = 0; k < 7; k++) { r.box(-1.6 + k * .53, 1.7, .05, .05, 3, .05, Q.wood, false); r.box(-1.6 + k * .53 + (k % 2 ? .12 : 0), 3.2, .05, k % 2 ? .3 : .06, .1, .05, Q.bronzeBright, false); }
    }
    for (let k = 0; k < 6; k++) b.box(155, y + k * .18, -84 + (k % 2) * .3, 1.6, .16, .5, Q.bronzeBright, k * .2, false);
    // Assembly line: headless torsos waiting for heads, which wait on their own shelves.
    for (let i = 0; i < 4; i++) {
      const x = 118 + i * 9, z = -122; b.box(x, y, z, 6, .9, 2.2, Q.wood);
      for (let k = 0; k < 3; k++) figure(b, warriorPrims(((i + k) % 4) as 0 | 1 | 2 | 3, i + k).filter(p => p.at[1] < 1.62 && p.at[1] > .6), x - 2 + k * 2, y + .9 - .65, z, 0);
      const sh = new Frame(b, x, y, z - 4.2); sh.box(0, 1.2, 0, 5.2, .12, .8, Q.wood, false); sh.box(0, 2.1, 0, 5.2, .12, .8, Q.wood, false); for (const s of [-1, 1]) sh.box(s * 2.5, 1.2, 0, .15, 2.4, .7, Q.wood, false);
      for (let k = 0; k < 5; k++) for (const lv of [1.26, 2.16]) figure(b, warriorPrims(((k + i) % 4) as 0 | 1 | 2 | 3, k).filter(p => p.at[1] > 1.72 && p.at[1] < 2.2 && p.kind !== 'cyl'), x - 2 + k, y + lv - 1.66, z - 4.2, (k - 2) * .4);
    }
    for (const s of [-1, 1]) slabBetween(b, [106 + s * .8, y + .08, -66], [106 + s * .8, y + .08, -128], .12, .12, Q.bronze, false);
    for (let z = -128; z < -66; z += 1.4) b.box(106, y + .01, z, 2.4, .06, .3, Q.wood, 0, false);
    for (const z of [-90, -124]) { b.box(106, y + .55, z, 2, 1, 3, Q.wood, 0, false); for (const s of [-1, 1]) for (const zz of [-1, 1]) b.add(CYL8, Q.lacquer, T(106 + s * .9, y + .4, z + zz, 0, .35, .15, .35, 0, Math.PI / 2), false); figure(b, warriorPrims(1, z < -100 ? 2 : 0), 106, y + 1.05, z, Math.PI); }
    // Still running: a horse-mill gear turns the bellows shaft overhead.
    const gear = mk('FoundryGear', MAT, true, { spin: .35, pivot: [148, -120] });
    gear.add(new THREE.CylinderGeometry(4, 4, .5, 24), Q.bronze, T(148, y + 6.5, -120), false);
    gear.add(new THREE.TorusGeometry(3.6, .18, 6, 24), Q.bronzeBright, T(148, y + 6.78, -120, 0, 1, 1, 1, Math.PI / 2), false);
    for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; gear.box(148 + Math.cos(a) * 4.2, y + 6.25, -120 + Math.sin(a) * 4.2, .8, .5, .5, Q.bronzeBright, -a, false); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; gear.add(new THREE.BoxGeometry(8.8, .3, .4), Q.wood, T(148, y + 6.9, -120, a), false); }
    b.add(CYL8, Q.wood, T(148, y + 3.2, -120, 0, .45, 6.4, .45));
    for (let x = 112; x < 160; x += 12) for (const z of [-70, -96, -126]) if (Math.abs(x - 106) > 4 && Math.hypot(x - 148, z + 120) > 6 && !(z === -96 && x > 118 && x < 150) && !(z === -70 && x > 146)) { column(new Frame(b, x, y, z), 0, 0, 11, .55); bracket(new Frame(b, x, y, z), 0, 0, 9.6, .9); }
  }

  function furnishGarrison(b: Batch, g: Batch) {
    const y = 28;
    // 俑坑: three east-west corridors (过洞) between rammed partition ridges (隔梁),
    // roofed with timber planks (棚木); kneeling archers lead the front rank.
    b.box(16.5, y - .3, -133.4, 15.6, .3, 16.4, Q.earthDark, 0, false);
    // Partition ridges with timber edge-beams; the roof planks survive only over the rear
    // corridor, some fallen in at an angle, so the front ranks stand open to view.
    for (const zz of [-125.2, -130.6, -136.2, -141.6]) { b.box(16.5, y, zz, 15.6, 1.25, .9, Q.earth); b.box(16.5, y + 1.25, zz, 15.6, .2, .3, Q.wood, 0, false); }
    for (let x = 9.6; x < 24; x += 1.6) { const fallen = Math.round(x * 3) % 4 === 0; b.add(BOX_GEO, Q.wood, T(x, y + (fallen ? 1.2 : 1.55), -138.9, .04 * Math.sin(x), .34, .2, 5.6, fallen ? .32 : 0, fallen ? .12 : 0), false); }
    for (const x of [10.4, 15.2, 21.6]) b.add(BOX_GEO, Q.wood, T(x, y + 1.4, -133.4, .3, .3, .2, 5.6, 0, .1), false);
    for (const [r, zz] of [-127.9, -133.4, -138.9].entries()) for (let c = 0; c < 6; c++) warrior(b, 11 + c * 2.2, y, zz, 0, r === 0 ? (c % 2 ? 4 : 2) + 5 * c : (r * 3 + c) % 4 + 5 * (c + r), true);
    // South-wall file: officers at intervals among infantry and crossbowmen.
    for (let c = 0; c < 20; c++) { const x = -56 + c * 4.3; if (Math.abs(x + 17) < 6 || Math.abs(x - 0) < 9 || Math.abs(x + 35) < 9) continue; warrior(b, x, y, -101.8, Math.PI, c % 5 === 2 ? 3 + 5 * c : (c % 3) + 5 * c, true); }
    // 驷马战车: a four-horse chariot with driver and commander at the head of the central avenue.
    const cxp = -22, czp = -117, ch = new Frame(b, cxp, y, czp, Math.PI);
    for (const s of [-1, 1]) { const w = ch.point(s * 1.5, .9, 0); b.add(new THREE.TorusGeometry(.9, .07, 6, 18), Q.wood, T(w.x, y + .9, w.z, Math.PI / 2, 1, 1, 1), false); for (let k = 0; k < 6; k++) b.add(new THREE.BoxGeometry(.05, 1.7, .05), Q.wood, T(w.x, y + .9, w.z, Math.PI / 2, 1, 1, 1, 0, k * Math.PI / 6), false); }
    ch.box(0, .9, 0, 3.2, .12, .12, Q.wood, false); ch.box(0, 1.2, 0, 1.6, .2, 1.4, Q.wood); ch.box(0, 1.55, -.6, 1.6, .5, .08, Q.wood, false); for (const s of [-1, 1]) ch.box(s * .78, 1.55, 0, .08, .5, 1.3, Q.wood, false);
    ch.beam([0, 1.1, .7], [0, 1.6, 4.4], .14, Q.wood); ch.box(0, 1.6, 4.3, 3.2, .12, .12, Q.wood, false);
    ch.cyl(0, 2.9, -.2, .05, 2.6, Q.wood, false); b.add(new THREE.ConeGeometry(1.2, .25, 14), Q.lacquer, T(ch.point(0, 4.2, -.2).x, y + 4.2, ch.point(0, 4.2, -.2).z), false);
    figure(b, warriorPrims(3, 1), ch.point(.35, 0, -.3).x, y + 1.3, ch.point(.35, 0, -.3).z, Math.PI);
    figure(b, warriorPrims(1, 2), ch.point(-.35, 0, .3).x, y + 1.3, ch.point(-.35, 0, .3).z, Math.PI);
    for (let k = 0; k < 4; k++) { const hp = ch.point(-1.5 + k, 0, 3.2); figure(b, horsePrims(k), hp.x, y, hp.z, Math.PI, true, .92); }
    // Turntable plinths: bronze-rimmed discs with the eight directions inlaid.
    for (const row of QIN_ARMY.rows) for (const zc of QIN_ARMY.rankCenters) {
      b.add(new THREE.CylinderGeometry(8.4, 8.4, .04, 32), '#6f6355', T(row.x, y + .02, zc), false);
      for (const r of [8.2, 6.9]) b.add(new THREE.TorusGeometry(r, .1, 4, 36), Q.bronze, T(row.x, y + .04, zc, 0, 1, 1, 1, Math.PI / 2), false);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.box(row.x + Math.cos(a) * 7.55, y + .02, zc + Math.sin(a) * 7.55, k % 2 ? .25 : .5, .05, 1.1, k % 2 ? Q.bronze : Q.bronzeBright, Math.PI / 2 - a, false); }
    }
    // Skylight (天井): a shaft of daylight falling onto the central avenue.
    beams.add(new THREE.CylinderGeometry(2.5, 3.8, 10.8, 20, 1, true), '#fff1c8', T(-17, y + 5.45, -130), false);
    // Standing bronze lamps and wall sconces; racks of crossbows along the north wall.
    for (let x = -54; x < 28; x += 12) for (const z of [-159.6, -100.4]) { g.box(x, y + 4.2, z, .5, .4, .2, Q.molten, 0, false); b.box(x, y + 3.7, z, .7, .35, .5, Q.bronze, 0, false); }
    for (const [x, z] of [[26, -104], [26, -156], [-56, -104], [-56, -140]] as const) { b.add(CYL8, Q.bronze, T(x, y + 1.3, z, 0, .1, 2.6, .1)); b.add(new THREE.CylinderGeometry(.45, .2, .35, 10), Q.bronze, T(x, y + 2.75, z), false); g.add(new THREE.ConeGeometry(.18, .5, 8), Q.molten, T(x, y + 3.15, z), false); }
    for (const x of [-56, -48, 10, 18]) { const r = new Frame(b, x, y, -158.4); r.box(0, 1.2, 0, 4, .12, .5, Q.wood, false); r.box(0, 2.2, 0, 4, .12, .5, Q.wood, false); for (const s of [-1, 1]) r.box(s * 1.9, 1.3, 0, .15, 2.6, .4, Q.wood); for (let k = 0; k < 4; k++) { r.box(-1.4 + k * .95, 1.45, .1, .06, .06, .7, Q.wood, false); r.box(-1.4 + k * .95, 1.45, .4, .6, .04, .05, Q.wood, false); } }
  }

  function furnishRoyalCity(b: Batch, g: Batch) {
    const y = 10, cx = 55, cz = -178;
    // 星图穹顶: an inward-facing dome over the hall, set with lit constellations.
    const dome = new THREE.SphereGeometry(22.95, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, .86, -1);
    b.add(dome, '#3a4f8c', T(cx, y + 8, cz), false); dome.dispose();
    const domePoint = (az: number, el: number, r = 22.5) => [cx + Math.cos(az) * Math.cos(el) * r, y + 8 + Math.sin(el) * r * .86, cz + Math.sin(az) * Math.cos(el) * r] as const;
    const stars = mulberry32(221); for (let i = 0; i < 360; i++) {
      const p = domePoint(stars() * Math.PI * 2, .12 + stars() * 1.38);
      const s = stars() < .1 ? .55 : .24; g.add(new THREE.OctahedronGeometry(s, 0), i % 9 ? Q.star : '#ffd88a', T(p[0], p[1], p[2]), false);
    }
    // 北斗 and the four celestial palaces drawn as gilt lines between bright stars.
    const lines: [number, number][][] = [
      [[.3, 1.05], [.42, 1.0], [.52, .98], [.6, 1.02], [.72, .95], [.83, .9], [.95, .92]],
      [[2.0, .45], [2.15, .55], [2.3, .5], [2.42, .62], [2.55, .58]],
      [[3.4, .4], [3.55, .32], [3.7, .42], [3.82, .36]],
      [[4.6, .5], [4.72, .62], [4.85, .55], [5.0, .66], [5.1, .6]],
      [[5.7, .3], [5.85, .38], [6.0, .3], [6.1, .42]],
    ];
    for (const line of lines) for (let i = 0; i < line.length; i++) {
      const p = domePoint(line[i][0], line[i][1], 22.3); g.add(new THREE.OctahedronGeometry(.6, 0), '#ffe2a0', T(p[0], p[1], p[2]), false);
      if (i) { const q = domePoint(line[i - 1][0], line[i - 1][1], 22.3), a = new THREE.Vector3(...q), c = new THREE.Vector3(...p), m = new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize()), new THREE.Vector3(.07, a.distanceTo(c), .07)); g.add(new THREE.BoxGeometry(1, 1, 1), Q.gold, m, false); }
    }
    for (const [az, el, col] of [[1.2, .75, '#ffd27a'], [4.2, .7, '#dfe8ff']] as const) { const p = domePoint(az, el, 22.2), n = new THREE.Vector3(cx - p[0], y + 8 - p[1], cz - p[2]).normalize(); g.add(new THREE.CircleGeometry(1.6, 24), col, new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n), new THREE.Vector3(1, 1, 1)), false); }
    const rim = new THREE.Shape([new THREE.Vector2(-24, -24), new THREE.Vector2(24, -24), new THREE.Vector2(24, 24), new THREE.Vector2(-24, 24)]);
    rim.holes.push(new THREE.Path().absarc(0, 0, 22.9, 0, Math.PI * 2, true));
    const band = new THREE.ShapeGeometry(rim, 24).rotateX(Math.PI / 2); b.add(band, '#3e4a6a', T(cx, y + 8, cz), false); band.dispose();
    b.add(new THREE.TorusGeometry(22.9, .35, 6, 64), Q.bronzeBright, T(cx, y + 8, cz, 0, 1, 1, 1, Math.PI / 2), false);
    // 水银百川: silver rivers run from the walls toward a sea around the mound, with gilt geese.
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + .2, pts: QinPoint[] = [];
      for (let t = 0; t <= 8; t++) { const r = 22 - t * 1.6, w = Math.sin(t * 1.3 + k) * 1.5; pts.push([cx + Math.cos(a) * r - Math.sin(a) * w, y + .03, cz + Math.sin(a) * r + Math.cos(a) * w]); }
      walkStripMercury(mercury, pts, .9);
      for (const t of [3, 6]) { const p = pts[t]; b.add(new THREE.SphereGeometry(.22, 7, 5), Q.gold, T(p[0], y + .2, p[2], a, 1.3, .8, .9), false); b.add(new THREE.SphereGeometry(.09, 6, 4), Q.gold, T(p[0] + Math.cos(a) * .3, y + .42, p[2] + Math.sin(a) * .3), false); }
    }
    mercury.add(new THREE.RingGeometry(8.6, 11, 40).rotateX(-Math.PI / 2), Q.mercury, T(cx, y + .04, cz), false);
    // 封土: three stepped rammed terraces with a stone stair on the gallery side.
    for (let i = 0; i < 3; i++) { const r = 8 - i * 2.1; b.box(cx, y + i * 1.1, cz, r * 2, 1.1, r * 2, i % 2 ? Q.earthDark : Q.earth); b.box(cx, y + (i + 1) * 1.1 - .1, cz, r * 2 + .3, .2, r * 2 + .3, Q.stoneDark, 0, false); }
    for (let k = 0; k < 9; k++) b.box(cx - 8.6 + k * .62, y, cz, .62, (k + 1) * 3.3 / 9, 2.4, Q.stone, 0, false);
    // Coffin hall: a small columned canopy over the double bronze coffin (椁).
    const top = y + 3.3, hall = new Frame(b, cx, top, cz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) column(hall, sx * 2.4, sz * 3.2, 3.2, .22);
    qinRoof(hall, 4.8, 6.4, 3.6, 1.6, Q.tile, 1, false, { finScale: .6 });
    hall.box(0, .55, 0, 2.2, 1.1, 4, Q.bronze); hall.box(0, 1.15, 0, 2.4, .2, 4.2, Q.bronzeBright, false);
    for (let k = -1; k <= 1; k++) { hall.box(1.12, .55, k * 1.2, .05, .7, .7, Q.gold, false); hall.box(-1.12, .55, k * 1.2, .05, .7, .7, Q.gold, false); }
    // 长明灯: tall lamps of whale oil ringing the sea, and jade lamps on the terraces.
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8, x = cx + Math.cos(a) * 12.4, z = cz + Math.sin(a) * 12.4; b.add(CYL8, Q.bronze, T(x, y + 1.4, z, 0, .12, 2.8, .12)); b.add(new THREE.CylinderGeometry(.55, .25, .35, 12), Q.bronzeBright, T(x, y + 2.9, z), false); g.add(new THREE.ConeGeometry(.22, .6, 8), '#fff0c8', T(x, y + 3.35, z), false); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.add(CYL8, Q.jade, T(cx + Math.cos(a) * 7.4, y + 1.6, cz + Math.sin(a) * 7.4, 0, .2, .5, .2), false); }
    // A city in miniature along the walls: halls, gate towers and que pairs, no two alike.
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
      if (i === 2 || i === 3 || (i === 0 && s < 0)) continue; // burial-pit doors and the west command-hall approach
      const x = 36 + i * 7.6, z = s < 0 ? cz - 21 : cz + 21, f = new Frame(b, x, y, z, s < 0 ? 0 : Math.PI), kind = (i + (s > 0 ? 3 : 0)) % 4;
      f.box(0, .4, 0, 5.4, .8, 3.2, Q.earth); f.box(0, .82, 0, 5.6, .06, 3.4, Q.stoneDark, false);
      if (kind === 0) { f.box(0, 1.5, 0, 3.6, 1.3, 2, Q.plaster, false); qinRoof(f, 3.6, 2, 2.2, .9, Q.tile, .5, false, { finScale: .3, rafters: false }); }
      else if (kind === 1) { for (const sx of [-1, 1]) { f.box(sx * 1.6, 1.6, 0, 1.2, 1.6, 1.4, Q.earth, false); qinRoof(new Frame(b, f.point(sx * 1.6, 0, 0).x, y, f.point(sx * 1.6, 0, 0).z, f.a), 1.2, 1.4, 2.5, .5, Q.tile, .35, false, { fins: false, rafters: false }); } }
      else if (kind === 2) { f.box(0, 1.4, 0, 4, 1.1, 2.2, Q.plaster, false); f.box(0, 2.3, 0, 2.6, .8, 1.4, Q.plaster, false); qinRoof(f, 2.6, 1.4, 2.8, .7, Q.tile, .45, false, { finScale: .25, rafters: false }); pentRoof(f, 4, 2.2, 2, .5, .35); }
      else { f.box(0, 1.6, 0, 2.2, 1.6, 2.2, Q.earth, false); f.box(0, 2.7, 0, 1.6, .6, 1.6, Q.plaster, false); qinRoof(f, 1.6, 1.6, 3.1, .8, Q.tile, .5, false, { fins: false, rafters: false }); }
    }
    royalCityDetails(b, g, cx, y, cz, 31, -190);
  }
  function walkStripMercury(b: Batch, points: QinPoint[], width: number) {
    const v: number[] = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], q = points[i], dx = q[0] - a[0], dz = q[2] - a[2], l = Math.hypot(dx, dz) || 1, ox = -dz / l * width / 2, oz = dx / l * width / 2;
      v.push(a[0] + ox, a[1], a[2] + oz, q[0] + ox, q[1], q[2] + oz, a[0] - ox, a[1], a[2] - oz, a[0] - ox, a[1], a[2] - oz, q[0] + ox, q[1], q[2] + oz, q[0] - ox, q[1], q[2] - oz);
    }
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); b.add(geo, Q.mercury, new THREE.Matrix4(), false); geo.dispose();
  }
}

/** Channel beside the walkway; piers and a deck wherever the route stands above ground. */
function buildAqueduct(b: Batch, water: Batch, route: readonly RoutePoint[], heightAt: Height) {
  const samples: { x: number; y: number; z: number; nx: number; nz: number }[] = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], c = route[i], len = Math.hypot(c[0] - a[0], c[2] - a[2]), n = Math.max(1, Math.round(len / 2)), nx = -(c[2] - a[2]) / len, nz = (c[0] - a[0]) / len;
    for (let k = i === 1 ? 0 : 1; k <= n; k++) { const t = k / n; samples.push({ x: a[0] + (c[0] - a[0]) * t, y: a[1] + (c[1] - a[1]) * t, z: a[2] + (c[2] - a[2]) * t, nx, nz }); }
  }
  const off = 4.1, chan: QinPoint[] = [];
  for (const [i, s] of samples.entries()) {
    if (i < 4 || s.y > 69.8) continue;
    const x = s.x + s.nx * off, z = s.z + s.nz * off, g = heightAt(x, z), bed = s.y + .35;
    chan.push([x, bed + .55, z]);
    if (i % 2) continue;
    const yaw = Math.atan2(s.nz, -s.nx);
    // Trough: floor and two walls, carried on the ground or on a stone pier.
    b.add(new THREE.BoxGeometry(2.8, .4, 4.2), Q.stone, T(x, bed - .2, z, yaw), false);
    for (const side of [-1, 1]) b.add(new THREE.BoxGeometry(.35, 1.2, 4.2), Q.stoneDark, T(x + s.nx * side * 1.25, bed + .4, z + s.nz * side * 1.25, yaw), false);
    if (bed - g > 1.2) b.add(new THREE.BoxGeometry(2.4, bed - g + 1, 2.2), Q.earth, T(x, (bed + g) / 2 - .4, z, yaw), false);
    const walkGround = heightAt(s.x, s.z);
    if (s.y - walkGround > 1.4 && i % 4 === 0) {
      b.add(new THREE.BoxGeometry(5.6, .5, 4.2), Q.stone, T(s.x, s.y - .4, s.z, yaw), false);
      b.add(new THREE.BoxGeometry(3.2, s.y - walkGround + 1, 1.8), Q.earth, T(s.x, (s.y + walkGround) / 2 - .6, s.z, yaw), false);
    }
    if (i % 8 === 0) b.add(new THREE.BoxGeometry(2.5, .5, .3), Q.stone, T(x, bed + .35, z, yaw), false);
  }
  // Water surface follows the channel's fall in short weired steps.
  const v: number[] = [];
  for (let i = 1; i < chan.length; i++) {
    const a = chan[i - 1], q = chan[i], dx = q[0] - a[0], dz = q[2] - a[2], l = Math.hypot(dx, dz) || 1, ox = -dz / l * 1, oz = dx / l * 1;
    if (l > 4) continue;
    v.push(a[0] + ox, a[1], a[2] + oz, q[0] + ox, q[1], q[2] + oz, a[0] - ox, a[1], a[2] - oz, a[0] - ox, a[1], a[2] - oz, q[0] + ox, q[1], q[2] + oz, q[0] - ox, q[1], q[2] - oz);
  }
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); water.add(g, Q.water, new THREE.Matrix4(), false); g.dispose();
}
