import * as THREE from 'three';
import { Batch, T } from '../geo';
import { mulberry32 } from '../rng';
import type { Piece } from '../structures';
import { Frame } from '../orleans/craft';
import { distanceToLine, type ExpansionPlan, type RoutePoint } from '../../../src/map/worldPlan';
import { QIN_ROOMS, QIN_CORRIDORS, QIN_PALACE, QIN_STREAM, QIN_ARMY, type QinCorridor, type QinPoint, type QinRoom } from '../../../src/map/qinPlan';
import { Q, CYL, CYL8, qinRoof, rammedPlatform, earthWall, column, palaceHall, gateHouse, slabBetween, walkStrip, warrior } from './craft';
import { corridorRect, qinStreamDistance } from './landscape';

type Height = (x: number, z: number) => number;
const WALL = 2.4;

export function buildQin(plan: ExpansionPlan, heightAt: Height, access: RoutePoint[]): Piece[] {
  const pieces: Piece[] = [];
  const make = (name: string, material = 'M_Toon', outline = true, userData?: Record<string, unknown>) => {
    const b = new Batch(`qin_${name}`, material); pieces.push({ name: b.name, material, batch: b, outline, userData }); return b;
  };
  const town = make('ArtisanTown'), works = make('Workshops'), palace = make('Palace'), pass = make('RiverPass'), aqueduct = make('Aqueduct');
  const ridge = make('RidgeBeacons'), halls = make('BuriedHalls'), foundry = make('BuriedFoundry'), garrison = make('TerracottaGarrison');
  const royal = make('BuriedRoyalCity'), glow = make('Glow', 'M_Emissive', false), water = make('Water', 'M_Water', false);
  const trunks = make('Trees_Trunks'), leaves = make('Trees_Leaves', 'M_Foliage', false);
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
  const well = new Frame(town, -173, 22, 112); well.cyl(0, .5, 0, 1.3, 1, Q.stone); well.cyl(0, 1.02, 0, .95, .05, Q.water, false);
  for (const s of [-1, 1]) well.box(s * 1.6, 1.6, 0, .25, 3.2, .25, Q.wood); qinRoof(well, 3.6, 2.6, 3.2, 1, Q.tile, .6);
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
  // ───────────── 窑场 · 铸造棚 · 简牍库 ─────────────
  kilnYard(works, glow, -222, 24, 58);
  foundryShed(works, glow, water, -128, 22.6, 124);
  archive(works, -212, 22, 138);

  // ───────────── 石料场 and the maintenance-tunnel portal ─────────────
  quarry(works, heightAt);

  // ───────────── 骊水关: twin-pier pass gate and walls up both slopes ─────────────
  gateHouse(pass, -70, 26.9, 82, 9, 9, Math.PI / 2, 10, 8);
  for (const [z0, z1] of [[46, 69.5], [94.5, 120]] as const) {
    for (let z = z0; z < z1; z += 3.5) {
      const zz = Math.min(z + 3.5, z1), cz = (z + zz) / 2, g = heightAt(-70, cz);
      if (qinStreamDistance(-70, cz) < 3.5) { earthWall(new Frame(pass, -70, 0, cz), zz - z + .1, g + 7.5, 2.6, g + 3.6); continue; }
      earthWall(new Frame(pass, -70, 0, cz), zz - z + .1, Math.max(g + 6.5, 33), 2.6, g - 1.5);
    }
  }
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
  palaceHall(palace, 40, terraceTop, -3, 36, 18, 9, 0, 'front');
  // Throne dais and twelve bronze figures along the hall front.
  palace.box(40, terraceTop, -8, 8, .8, 3, Q.lacquer); palace.box(40, terraceTop + .8, -8.5, 2.4, 1.6, 1, Q.redDark, 0, false);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const x = 40 + s * (6 + i * 2.2); palace.add(CYL8, Q.bronze, T(x, terraceTop + .9, 12, 0, .35, 1.8, .35), false); palace.add(new THREE.SphereGeometry(.32, 6, 4), Q.bronze, T(x, terraceTop + 2.05, 12), false); }
  palaceHall(palace, 80, terraceTop, -4, 18, 10, 6, -Math.PI / 2, 'front');
  palaceHall(palace, 10, terraceTop, 6, 10, 10, 5.5, 0, 'all');
  // Terrace parapet: low rammed walls on the open edges, gaps for every arriving route.
  for (const [x, z, len, a] of [[tx0 + .6, -2, 24, 0], [tx1 - .6, -10, 52, 0], [(tx0 + 32) / 2, tz1 - .6, 30, Math.PI / 2], [(48 + tx1) / 2, tz1 - .6, tx1 - 48, Math.PI / 2]] as const) earthWall(new Frame(palace, x, terraceTop, z, a), len, 1.2, 1);
  // 观阙: two-storey watch tower on its own high platform, and its ramp to the rear court.
  palaceHall(palace, 90, pavTop, -32, 12, 10, 4.6, Math.PI / 2, 'all');
  const tower = new Frame(palace, 90, pavTop, -32);
  tower.box(0, 8.6, 0, 7, 3.4, 6, Q.plaster, false); for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower.box(sx * 3.3, 8.6, sz * 2.8, .45, 3.4, .45, Q.red, false);
  qinRoof(tower, 7, 6, 10.4, 2.8, Q.tile, 1.6);
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
  for (const [x, z] of [[-150, -72], [-50, -130], [25, -131], [84, -96]] as const) {
    const g = heightAt(x + 8, z - 6), f = new Frame(ridge, x + 8, g, z - 6, .3);
    f.box(0, 3, 0, 5, 7, 5, Q.earth); f.box(0, 6.8, 0, 6, .6, 6, Q.stoneDark, false);
    f.box(0, 7.8, 0, 2, 1.4, 2, Q.lacquer, false); f.box(0, 8.7, 0, 1.4, .6, 1.4, Q.ember, false);
    for (let i = 0; i < 4; i++) f.box(-2.2, 1 + i * 1.5, 2.6, 1.4, .25, .9, Q.wood, false);
  }
  const ridgeRoute = plan.routes.find(r => r.id === 'ridge')!.points;
  for (let i = 1; i < ridgeRoute.length; i++) {
    const a = ridgeRoute[i - 1], b = ridgeRoute[i], n = Math.floor(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.6), yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    if (Math.abs(b[1] - a[1]) / Math.hypot(b[0] - a[0], b[2] - a[2]) < .12) continue;
    for (let k = 1; k < n; k++) { const t = k / n; ridge.add(new THREE.BoxGeometry(4.6, .08, .3), Q.stoneDark, T(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + .13, a[2] + (b[2] - a[2]) * t, yaw), false); }
  }

  // ───────────── 地宫: rooms, corridors, portals ─────────────
  for (const room of QIN_ROOMS) buildRoom(room.id === 'royal' ? royal : halls, room);
  for (const c of QIN_CORRIDORS) buildCorridor(c.id === 'rail-incline' ? foundry : halls, glow, c);
  portal(halls, QIN_CORRIDORS.find(c => c.id === 'maintenance-south')!, '工');
  furnishFoundry(foundry, glow, make);
  furnishGarrison(garrison, glow);
  furnishRoyalCity(royal, glow);

  // ───────────── vegetation: pines on the mountain, willows in the valley ─────────────
  const random = mulberry32(7019); let trees = 0;
  const avoid = (x: number, z: number) => roadDistance(x, z) < 9 || houses.some(h => Math.hypot(h.position[0] - x, h.position[2] - z) < 10) || workshopZones.some(([zx, zz, zr]) => Math.hypot(x - zx, z - zz) < zr + 4)
    || (x > -10 && x < 110 && z > -50 && z < 100) || (x > -150 && x < -100 && z > -70 && z < -20) || Math.abs(x + 70) < 10 && z > 45 && z < 125;
  for (let i = 0; i < 1400 && trees < 230; i++) {
    const x = -300 + random() * 600, z = -260 + random() * 560, y = heightAt(x, z);
    if (y < 18.5 || avoid(x, z) || qinStreamDistance(x, z) < 6 || Math.abs(x) > 330 || Math.abs(z) > 330) continue;
    const pine = y > 34 || random() < .3;
    if (pine) {
      const h = 7 + random() * 6; trunks.add(CYL8, Q.wood, T(x, y + h * .35, z, 0, .4, h * .7, .4));
      for (let j = 0; j < 3; j++) leaves.add(new THREE.ConeGeometry(1, 1, 7), j % 2 ? '#3f5e45' : '#4b6b4c', T(x, y + h * (.45 + j * .2), z, j, 3.2 - j * .8, h * .38, 3.2 - j * .8), false);
    } else {
      const h = 5 + random() * 3, r = 2.4 + random() * 1.4; trunks.add(CYL8, Q.wood, T(x, y + h / 2, z, 0, .45, h, .45));
      for (let j = 0; j < 3; j++) leaves.add(new THREE.IcosahedronGeometry(1, 1), j % 2 ? '#7f9a58' : '#6f8c50', T(x + (j - 1) * r * .5, y + h + (j % 2) * r * .4, z + (j % 2) * r * .3, 0, r, r * .9, r), false);
    }
    trees++;
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
    const f = new Frame(b, x, y, z, a), eave = 3.5 + (index % 3) * .3, kind = index % 4;
    f.box(0, (bottom - y) / 2, 0, w + .6, y - bottom, d + .6, Q.stoneDark);
    f.box(0, -.12, 0, w, .24, d, Q.paving);
    const wall = (xx: number, zz: number, ww: number, dd: number) => { f.box(xx, .6, zz, ww, 1.2, dd, Q.earthDark); f.box(xx, 1.2 + (eave - 1.2) / 2, zz, ww, eave - 1.2, dd, Q.plaster); };
    wall(-w / 2 + .35, 0, .7, d); wall(w / 2 - .35, 0, .7, d); wall(0, -d / 2 + .35, w, .7);
    const gap = 2.4, side = (w - gap) / 2;
    for (const s of [-1, 1]) wall(s * (gap / 2 + side / 2), d / 2 - .35, side, .7);
    f.box(0, (eave + 2.8) / 2, d / 2 - .35, gap, eave - 2.8, .7, Q.plaster);
    for (const s of [-1, 1]) f.box(s * (gap / 2 + .1), 1.4, d / 2 - .1, .22, 2.8, .3, Q.wood, false);
    f.box(0, 2.85, d / 2 - .1, gap + .6, .25, .3, Q.wood, false);
    for (const s of [-1, 1]) { f.box(s * w * .3, 2.3, d / 2 + .02, 1.2, .9, .1, Q.lacquer, false); for (let i = -1; i <= 1; i++) f.box(s * w * .3 + i * .3, 2.3, d / 2 + .08, .06, .9, .06, Q.woodPale, false); }
    for (const s of [-1, 1]) f.box(s * (w / 2 - .2), eave - .15, d / 2 - .2, .3, .3, .3, Q.redDark, false);
    qinRoof(f, w, d, eave + .2, Math.min(w, d) * .32, Q.tile, 1.3);
    // Trades read from the street: pottery jars, a bronze-smith's anvil, grain bins, cloth.
    if (kind === 0) for (let i = 0; i < 3; i++) { const p = f.point(-w / 2 + 1 + i * 1.1, 0, d / 2 + 1.2); b.add(new THREE.SphereGeometry(.45, 8, 6), i % 2 ? Q.clay : Q.terracottaDark, T(p.x, y + .4, p.z, 0, 1, 1.25, 1), false); }
    else if (kind === 1) { f.box(w * .32, .45, d / 2 + 1.1, .7, .9, .5, Q.lacquer, false); f.box(w * .32, .95, d / 2 + 1.1, 1, .2, .5, Q.bronze, false); }
    else if (kind === 2) for (const s of [-1, 1]) { const p = f.point(s * (w / 2 + 1.6), 0, 0); b.add(CYL, Q.earthPale, T(p.x, y + 1.1, p.z, 0, 1.2, 2.2, 1.2)); b.add(new THREE.ConeGeometry(1.6, 1.4, 10), Q.tile, T(p.x, y + 2.9, p.z), false); }
    else { f.beam([-w / 2 - .5, 2.4, d / 2 + 1.8], [w / 2 + .5, 2.4, d / 2 + 1.8], .06, Q.wood); for (let i = 0; i < 4; i++) f.box(-w / 2 + 1.5 + i * 2, 1.7, d / 2 + 1.8, 1.1, 1.3, .04, i % 2 ? '#4f6878' : '#b9a26f', false); }
    // Interior: sleeping platform, chest and jars, clear of the door line.
    f.box(-w / 2 + 1.6, .25, -d / 2 + 1.8, 2.4, .5, 2.8, Q.earthPale); f.box(w / 2 - 1.3, .4, -d / 2 + 1.2, 1.4, .8, .9, Q.wood);
    const ramp = f.point(0, 0, out), sill = f.point(0, 0, d / 2 - .2), dy = y - heightAt(ramp.x, ramp.z);
    if (dy > .12) {
      walkStrip(b, [[ramp.x, heightAt(ramp.x, ramp.z) + .03, ramp.z], [sill.x, y, sill.z]], 2.4, Q.paving);
      // Rammed cheeks under the ramp so it never floats.
      const g0 = heightAt(ramp.x, ramp.z), seg = (out - d / 2 + .2) / 4;
      for (let k = 0; k < 4; k++) { const top = g0 + (y - g0) * k / 4 - .05, bottom = g0 - .6, p = f.point(0, 0, out - seg * (k + .5)); b.add(new THREE.BoxGeometry(2.3, top - bottom, seg), Q.stoneDark, T(p.x, (top + bottom) / 2, p.z, a), false); }
    }
  }

  function kilnYard(b: Batch, g: Batch, x: number, y: number, z: number) {
    // Two dragon kilns stepping up the yard, their firing ports glowing.
    for (const [dx, len, yaw] of [[-5, 16, .35], [5, 13, .35]] as const) {
      const f = new Frame(b, x + dx, y, z, yaw);
      f.box(0, .9, 0, 3.6, 1.8, len, Q.clay);
      const half = new THREE.CylinderGeometry(1.8, 1.8, len, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
      const p = f.point(0, 1.8, 0); b.add(half, Q.clay, T(p.x, p.y, p.z, yaw)); half.dispose();
      for (let k = -1; k <= 1; k++) for (const s of [-1, 1]) { const q = f.point(s * 1.85, 1, k * len / 3.5); g.add(new THREE.BoxGeometry(.1, .5, .5), Q.ember, T(q.x, q.y, q.z, yaw), false); }
      f.box(0, 3, -len / 2 - .6, 1.4, 6, 1.4, Q.earthDark);
      f.box(0, .9, len / 2 + .3, 2, 1.4, .3, Q.lacquer, false);
    }
    // Drying racks of roof tiles and stacked jars.
    for (let i = 0; i < 3; i++) {
      const f = new Frame(b, x + 9 + i * 3.2, y, z + 8, -.2);
      for (const s of [-1, 1]) f.box(s * 1.2, 1, 0, .15, 2, .15, Q.wood, false);
      for (let r = 0; r < 3; r++) f.box(0, .5 + r * .6, 0, 2.6, .08, .9, r % 2 ? Q.tile : Q.clay, false);
    }
    for (let i = 0; i < 6; i++) b.add(new THREE.SphereGeometry(.42, 8, 6), i % 2 ? Q.clay : Q.terracotta, T(x - 9 + (i % 3) * 1, y + .4 + Math.floor(i / 3) * .7, z + 8, 0, 1, 1.2, 1), false);
    for (let i = 0; i < 4; i++) b.add(CYL8, Q.woodPale, T(x - 10, y + .3 + i * .45, z - 4, 0, .25, 3, .25, 0, Math.PI / 2), false);
  }

  function foundryShed(b: Batch, g: Batch, wtr: Batch, x: number, y: number, z: number) {
    const f = new Frame(b, x, y, z, .1);
    for (const sx of [-7, 0, 7]) for (const sz of [-4.5, 4.5]) f.box(sx, 2.4, sz, .45, 4.8, .45, Q.wood);
    qinRoof(f, 15, 10, 4.9, 2.4, Q.tile, 1.2);
    f.cyl(-3, 1.1, -1, 1.4, 2.2, Q.clay); const fire = f.point(-3, 2.25, -1); g.add(new THREE.CylinderGeometry(1, 1, .1, 12), Q.molten, T(fire.x, fire.y, fire.z), false);
    f.box(-5.4, .5, -1, 1.6, .6, 1, Q.wood, false); f.beam([-4.6, .9, -1], [-3.6, 1.6, -1], .25, Q.lacquer);
    for (let i = 0; i < 4; i++) f.box(2 + i * 1.1, .2, 1.5, .8, .4, 1.6, Q.earthPale, false);
    for (let i = 0; i < 5; i++) f.box(4.6, .12 + i * .14, -2.4, 1.4, .12, .45, Q.bronzeBright, false);
    f.box(-1, .5, 3, 3.4, 1, 1.2, Q.stoneDark); const q = f.point(-1, 1.02, 3); wtr.add(new THREE.BoxGeometry(3, .04, .9), Q.water, T(q.x, q.y, q.z, .1), false);
  }

  function archive(b: Batch, x: number, y: number, z: number) {
    const w = 14, d = 10, f = new Frame(b, x, y, z, Math.atan2(-185 - x, 100 - z));
    rammedPlatform(b, x - 10, x + 10, z - 9, z + 9, heightAt(x, z) - 1.4, y + .1, false);
    f.box(0, 3, -d / 2 + .5, w, 6, 1, Q.earth); for (const s of [-1, 1]) f.box(s * (w / 2 - .5), 3, 0, 1, 6, d, Q.earth);
    for (const s of [-1, 1]) f.box(s * (w / 4 + .9), 3, d / 2 - .5, w / 2 - 1.8, 6, 1, Q.earth);
    f.box(0, 4.6, d / 2 - .5, 3.6, 2.8, 1, Q.earth); f.box(0, 3.3, d / 2 + .05, 4.2, .3, .3, Q.redDark, false);
    qinRoof(f, w, d, 6.2, 3, Q.tile, 1.6);
    // Shelves of rolled bamboo-slip bundles.
    for (const sx of [-4.2, -1.6, 1.6, 4.2]) {
      f.box(sx, 1.6, -1.5, .9, 3.2, 5, Q.wood);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { const p = f.point(sx + (sx > 0 ? -.55 : .55), .5 + r * .75, -3.4 + k * 1.2); b.add(CYL8, r % 2 ? '#c9b07a' : '#b59a62', T(p.x, y + .5 + r * .75, p.z, 0, .22, .5, .22, 0, Math.PI / 2), false); }
    }
    f.box(4.3, .45, 3.3, 1.6, .9, 1.2, Q.lacquer);
  }

  function quarry(b: Batch, h: Height) {
    // Stepped benches cut into the spur, a timber derrick and blocks waiting to be dressed.
    for (let tier = 0; tier < 4; tier++) for (let i = -3; i <= 3; i++) {
      const x = -125 + i * 4.4, z = -58 - tier * 3.2, g = h(x, z), top = 28 + 2.8 * (tier + 1);
      if (Math.abs(x + 125) < 6.5) continue;
      b.box(x, Math.min(g, 28) - 1, z, 4.3, top - Math.min(g, 28) + 1, 3.1, tier % 2 ? Q.stone : '#9b9a91', 0);
    }
    for (let i = 0; i < 9; i++) { const x = -140 + (i % 3) * 3.4, z = -38 + Math.floor(i / 3) * 2.8; b.box(x, 28, z, 2.6, 1.2 + (i % 2) * .5, 1.8, i % 2 ? Q.stone : '#a3a198', (i * .37) % 1 - .5); }
    const f = new Frame(b, -112, 28, -40, -.4);
    f.box(0, 4, 0, .45, 8, .45, Q.wood); f.beam([0, 7.6, 0], [0, 6, 6], .3, Q.wood); f.beam([0, 6, 6], [0, 2.4, 6], .04, '#b9a77d');
    f.box(0, 1.1, 6, 1.4, 1.2, 1.4, Q.stone, false);
    for (const s of [-1, 1]) f.beam([s * 1.2, .2, -2.5], [s * 1.2, .2, 9], .2, Q.woodPale, false);
  }

  function portal(b: Batch, c: QinCorridor, glyph: string) {
    const end = c.portal === 'a' ? c.a : c.b, other = c.portal === 'a' ? c.b : c.a;
    const yaw = Math.atan2(end[0] - other[0], end[2] - other[2]), f = new Frame(b, end[0], end[1], end[2], yaw);
    const w = c.width, h = c.height, span = w + 16, tall = h + 7;
    for (const s of [-1, 1]) f.box(s * (w / 2 + (span - w) / 4), tall / 2 - 1.5, -.5, (span - w) / 2, tall + 3, 3.4, Q.earth);
    f.box(0, h + (tall - h) / 2, -.5, w + .2, tall - h, 3.4, Q.earth);
    f.box(0, h + .3, 1.3, w + 1.6, .6, .5, Q.redDark, false);
    for (const s of [-1, 1]) { f.box(s * (w / 2 + .3), h / 2, 1.3, .6, h, .6, Q.red, false); f.box(s * (w / 2 + .3), .3, 1.3, 1, .6, 1, Q.bronze, false); }
    f.box(0, h + 2.4, 1.32, 3, 2.4, .2, Q.lacquer, false); f.box(0, h + 2.4, 1.44, 1.2, 1.2, .1, Q.bronzeBright, false);
    qinRoof(new Frame(b, f.point(0, 0, .3).x, end[1], f.point(0, 0, .3).z, yaw), span, 4.2, tall + 1.2, 1.8, Q.tile, 1.2);
    void glyph;
  }

  function buildRoom(b: Batch, r: QinRoom) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, top = r.floor + r.height;
    // Floor only under the interior: sloped corridors own the floor through the doorway.
    b.box(cx, r.floor - 1.2, cz, w, 1.2, d, r.id === 'royal' ? '#5a5f68' : Q.paving);
    b.box(cx, top, cz, w + WALL * 2, 1.4, d + WALL * 2, Q.earthDark);
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
    if (r.id !== 'royal') for (let x = r.x0 + 1.5; x < r.x1; x += 3) b.box(x, top - .7, cz, .7, .7, d, Q.wood, 0, false);
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
    for (const [x, z] of [[124, -84], [142, -84], [146, -106]] as const) {
      b.add(CYL, Q.clay, T(x, y + 2.2, z, 0, 3, 4.4, 3)); b.add(CYL, Q.earthDark, T(x, y + 4.6, z, 0, 2.2, .4, 2.2), false);
      g.add(new THREE.CylinderGeometry(1.9, 1.9, .1, 16), Q.molten, T(x, y + 4.82, z), false);
      for (let k = 0; k < 4; k++) g.box(x + Math.cos(k * 1.57) * 3.02, y + .6, z + Math.sin(k * 1.57) * 3.02, .6, .5, .6, Q.ember, k * 1.57, false);
      b.add(CYL8, Q.earthDark, T(x, y + 7.5, z, 0, .8, 5, .8), false);
    }
    // Molten channels from the furnaces to rows of moulds (gleaming bronze in sand).
    for (const [x0, z0, x1, z1] of [[124, -80, 124, -66], [142, -80, 142, -66], [142, -102, 128, -102]] as const) g.box((x0 + x1) / 2, y + .02, (z0 + z1) / 2, Math.abs(x1 - x0) + .5, .06, Math.abs(z1 - z0) + .5, Q.molten, 0, false);
    for (let i = 0; i < 6; i++) for (const z of [-66.5, -64]) b.box(116 + i * 5, y, z, 3.2, .5, 1.8, '#a89a7d', 0, false);
    // Assembly line: torsos, heads and arms waiting on benches for the rail carts.
    for (let i = 0; i < 4; i++) {
      const x = 118 + i * 9, z = -122; b.box(x, y, z, 6, 1, 2.2, Q.wood);
      for (let k = 0; k < 3; k++) { b.box(x - 2 + k * 2, y + 1, z, .7, .8, .45, Q.terracotta, 0, false); b.add(new THREE.SphereGeometry(.3, 6, 4), Q.terracottaDark, T(x - 2 + k * 2, y + 2.05, z), false); }
    }
    for (const s of [-1, 1]) slabBetween(b, [106 + s * .8, y + .08, -66], [106 + s * .8, y + .08, -128], .12, .12, Q.bronze, false);
    for (let z = -128; z < -66; z += 1.4) b.box(106, y + .01, z, 2.4, .06, .3, Q.wood, 0, false);
    for (const z of [-90, -124]) { b.box(106, y + .55, z, 2, 1, 3, Q.wood, 0, false); for (const s of [-1, 1]) for (const zz of [-1, 1]) b.add(CYL8, Q.lacquer, T(106 + s * .9, y + .4, z + zz, 0, .35, .15, .35, 0, Math.PI / 2), false); b.box(106, y + 1.05, z, .7, .9, .45, Q.terracotta, 0, false); }
    // Still running: a horse-mill gear turns the bellows shaft overhead.
    const gear = mk('FoundryGear', 'M_Toon', true, { spin: .35, pivot: [148, -120] });
    gear.add(new THREE.CylinderGeometry(4, 4, .5, 20), Q.bronze, T(148, y + 6.5, -120), false);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; gear.box(148 + Math.cos(a) * 4.2, y + 6.25, -120 + Math.sin(a) * 4.2, .8, .5, .5, Q.bronzeBright, -a, false); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; gear.add(new THREE.BoxGeometry(8.8, .3, .4), Q.wood, T(148, y + 6.9, -120, a), false); }
    b.add(CYL8, Q.wood, T(148, y + 3.2, -120, 0, .45, 6.4, .45));
    for (let x = 112; x < 160; x += 12) for (const z of [-70, -96, -126]) if (Math.abs(x - 106) > 4 && Math.hypot(x - 148, z + 120) > 6 && !(z === -96 && x > 118 && x < 150)) { column(new Frame(b, x, y, z), 0, 0, 11, .55); }
  }

  function furnishGarrison(b: Batch, g: Batch) {
    const y = 28;
    // Static ranks stand in rammed pits in the east zone and along the south wall.
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) warrior(b, 11 + c * 2.2, y, -128 - r * 3.6, 0, r * 6 + c, true);
    b.box(16.5, y - .3, -133.4, 15, .3, 15.5, Q.earthDark, 0, false);
    for (const s of [-1, 1]) b.box(16.5, y, -133.4 + s * 8.2, 15, 1.2, .9, Q.earth);
    for (let c = 0; c < 20; c++) { const x = -56 + c * 4.3; if (Math.abs(x + 17) < 6 || Math.abs(x - 0) < 9 || Math.abs(x + 35) < 9) continue; warrior(b, x, y, -101.8, Math.PI, c, true); }
    // Generals' banners and chariot at the head of the central avenue.
    const ch = new Frame(b, -17, y, -119, Math.PI);
    for (const s of [-1, 1]) { ch.cyl(s * 1.4, 1, 0, 1, .2, Q.lacquer, false); }
    ch.box(0, 1.1, 0, 2.4, .6, 1.8, Q.wood, false); ch.beam([0, 1, -1], [0, 1.2, -5], .2, Q.wood);
    for (const s of [-1, 1]) { ch.box(s * .6, 1, -4.4, .8, 1.4, 2, Q.terracotta, false); ch.box(s * .6, 1.6, -5.4, .4, .8, .6, Q.terracottaDark, false); }
    // Turntable plinths, painted with the order's arrow, flush with the floor.
    for (const row of QIN_ARMY.rows) for (const zc of QIN_ARMY.rankCenters) {
      b.add(new THREE.CylinderGeometry(8.4, 8.4, .04, 28), '#6f6355', T(row.x, y + .02, zc), false);
      b.add(new THREE.TorusGeometry(8.2, .12, 4, 28), Q.bronze, T(row.x, y + .04, zc, 0, 1, 1, 1, Math.PI / 2), false);
    }
    // Skylight (天井): a shaft of daylight falling onto the central avenue.
    g.add(new THREE.CylinderGeometry(2.6, 2.6, .1, 16), '#f6edc8', T(-17, y + 10.9, -130), false);
    // Bronze lamps on the side walls.
    for (let x = -54; x < 28; x += 12) for (const z of [-159.6, -100.4]) g.box(x, y + 4.2, z, .5, .4, .2, Q.molten, 0, false);
  }

  function furnishRoyalCity(b: Batch, g: Batch) {
    const y = 10, cx = 55, cz = -178;
    // 星图穹顶: an inward-facing dome over the hall, set with lit constellations.
    const dome = new THREE.SphereGeometry(22.95, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, .86, -1);
    b.add(dome, '#33457a', T(cx, y + 8, cz), false); dome.dispose();
    const stars = mulberry32(221); for (let i = 0; i < 320; i++) {
      const az = stars() * Math.PI * 2, el = .12 + stars() * 1.38, r = 22.5, p = [cx + Math.cos(az) * Math.cos(el) * r, y + 8 + Math.sin(el) * r * .86, cz + Math.sin(az) * Math.cos(el) * r];
      const s = stars() < .1 ? .7 : .32; g.add(new THREE.OctahedronGeometry(s, 0), i % 9 ? Q.star : '#ffd88a', T(p[0], p[1], p[2]), false);
    }
    const rim = new THREE.Shape([new THREE.Vector2(-24, -24), new THREE.Vector2(24, -24), new THREE.Vector2(24, 24), new THREE.Vector2(-24, 24)]);
    rim.holes.push(new THREE.Path().absarc(0, 0, 22.9, 0, Math.PI * 2, true));
    const band = new THREE.ShapeGeometry(rim, 24).rotateX(Math.PI / 2); b.add(band, '#3e4a6a', T(cx, y + 8, cz), false); band.dispose();
    // 水银百川: silver rivers run from the walls toward a sea around the mound.
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + .2, pts: QinPoint[] = [];
      for (let t = 0; t <= 8; t++) { const r = 22 - t * 1.6, w = Math.sin(t * 1.3 + k) * 1.5; pts.push([cx + Math.cos(a) * r - Math.sin(a) * w, y + .03, cz + Math.sin(a) * r + Math.cos(a) * w]); }
      walkStripMercury(g, pts, .9);
    }
    g.add(new THREE.RingGeometry(8, 10.5, 32).rotateX(-Math.PI / 2), Q.mercury, T(cx, y + .04, cz), false);
    // Stepped mound with the sealed bronze sarcophagus and a ring of jade lamps.
    for (let i = 0; i < 3; i++) b.add(CYL, i % 2 ? Q.earthDark : Q.earth, T(cx, y + .5 + i * 1, cz, 0, 7.6 - i * 2, 1, 7.6 - i * 2));
    b.box(cx, y + 3, cz, 3, 1.4, 5.2, Q.bronze); b.box(cx, y + 4.4, cz, 3.3, .3, 5.5, Q.bronzeBright, 0, false);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.add(CYL8, Q.jade, T(cx + Math.cos(a) * 11.6, y + .7, cz + Math.sin(a) * 11.6, 0, .25, 1.4, .25), false); }
    // A city in miniature along the walls: palace models on low rammed bases.
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
      const x = 36 + i * 7.6, z = s < 0 ? cz - 21 : cz + 21; if (Math.abs(x - 31) < 4) continue;
      const f = new Frame(b, x, y, z, s < 0 ? 0 : Math.PI); f.box(0, .4, 0, 5, .8, 3, Q.earth); f.box(0, 1.4, 0, 3.6, 1.2, 2, Q.plaster, false);
      qinRoof(f, 3.6, 2, 2, .9, Q.tile, .5);
    }
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
