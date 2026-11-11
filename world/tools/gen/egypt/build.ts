import * as THREE from 'three';
import { Batch, T } from '../geo';
import { mulberry32 } from '../rng';
import type { Piece } from '../structures';
import { Frame } from '../orleans/craft';
import { Shell, walkStrip, slabBetween } from '../qin/craft';
import { distanceToLine, type ExpansionPlan, type RoutePoint } from '../../../src/map/worldPlan';
import { EGYPT_LAKE, EGYPT_RIVER, EGYPT_TEMPLE, EGYPT_MIRRORS, EGYPT_ROOMS, EGYPT_CORRIDORS, EGYPT_CANYON, EGYPT_TREASURY_DOOR, type EgyptPoint } from '../../../src/map/egyptPlan';
import { buildEgyptMonuments } from './monuments';
import { E, EMAT, CYL8, batter, cornice, pylonTower, papyrusColumn, lotusColumn, obelisk, seatedColossus, criosphinx, palm, felucca, camel, shaduf, pyramid } from './craft';
import { egyptLakeDistance, egyptRiver, egyptGreen, plateauDepth } from './landscape';

type Height = (x: number, z: number) => number;
const BOXG = new THREE.BoxGeometry(1, 1, 1);

export function buildEgypt(plan: ExpansionPlan, heightAt: Height, access: RoutePoint[]): Piece[] {
  const pieces: Piece[] = [];
  const make = (name: string, material = EMAT, outline = true, userData?: Record<string, unknown>) => { const b = new Batch(`egypt_${name}`, material); pieces.push({ name: b.name, material, batch: b, outline, userData }); return b; };
  const town = make('OasisTown'), market = make('Market'), river = make('RiverQuay'), avenue = make('SphinxAvenue'), colossi = make('Colossi');
  const temple = make('SunTemple'), pyramidB = make('Pyramid'), trial = make('SolarTrial'), canyon = make('CanyonTombs'), tomb = make('BarqueTomb');
  const glow = make('Glow', 'M_Emissive', false), water = make('Water', 'M_Water', false), beams = make('LightShafts', 'M_Beam', false);
  const trunks = make('Palms_Trunks'), leaves = make('Palms_Leaves', 'M_Foliage', false);
  const routeLines = [...plan.routes.filter(r => r.kind !== 'underground').map(r => r.points.map(p => [p[0], p[2]] as const)), access.map(p => [p[0], p[2]] as const)];
  const roadDistance = (x: number, z: number) => Math.min(...routeLines.map(l => distanceToLine(x, z, l)));
  const accessLine = access.map(p => [p[0], p[2]] as const);
  const minGround = (x0: number, x1: number, z0: number, z1: number) => { let y = Infinity; for (let x = x0; x <= x1 + .01; x += Math.max(1, (x1 - x0) / 6)) for (let z = z0; z <= z1 + .01; z += Math.max(1, (z1 - z0) / 6)) y = Math.min(y, heightAt(x, z)); return y; };
  const ribbon = (b: Batch, pts: EgyptPoint[], width: number, color: string) => {
    const v: number[] = [];
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], q = pts[i], dx = q[0] - a[0], dz = q[2] - a[2], l = Math.hypot(dx, dz) || 1, ox = -dz / l * width / 2, oz = dx / l * width / 2; v.push(a[0] + ox, a[1], a[2] + oz, q[0] + ox, q[1], q[2] + oz, a[0] - ox, a[1], a[2] - oz, a[0] - ox, a[1], a[2] - oz, q[0] + ox, q[1], q[2] + oz, q[0] - ox, q[1], q[2] - oz); }
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); b.add(g, color, new THREE.Matrix4(), false); g.dispose();
  };

  // ───────────── water: spring lake and the Sun River ─────────────
  { const disc = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2); water.add(disc, E.water, T(EGYPT_LAKE.x, EGYPT_LAKE.surface, EGYPT_LAKE.z, 0, EGYPT_LAKE.rx * .93, 1, EGYPT_LAKE.rz * .93), false); disc.dispose(); }
  ribbon(water, EGYPT_RIVER.map(p => [p[0], p[1] - .35, p[2]] as EgyptPoint), 8.4, E.water);

  // ───────────── 商队绿洲: courtyard houses round a market square by the spring ─────────────
  const square: [number, number] = [-165, 110];
  { const ring: number[] = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; ring.push(square[0] + Math.cos(a) * 14, 14.06, square[1] + Math.sin(a) * 12); }
    for (let i = 1; i <= 24; i++) { const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([square[0], 14.06, square[1], ring[i * 3], ring[i * 3 + 1], ring[i * 3 + 2], ring[i * 3 - 3], ring[i * 3 - 2], ring[i * 3 - 1]], 3)); market.add(g, '#d9c494', new THREE.Matrix4(), false); g.dispose(); } }
  const houses: { position: [number, number, number]; width: number; depth: number; rotation: number; approach: [number, number, number] }[] = [];
  const rng = mulberry32(5211);
  const lanes: EgyptPoint[][] = [[[-165, 14, 110], [-150, 14, 84], [-138, 14, 62]], [[-165, 14, 110], [-190, 14, 96], [-214, 14, 82]]];
  for (const lane of lanes) ribbon(town, lane.map(p => [p[0], heightAt(p[0], p[2]) + .05, p[2]] as EgyptPoint), 3.4, '#dcc796');
  const candidates: [number, number][] = [];
  for (const lane of lanes) for (let i = 1; i < lane.length; i++) { const a = lane[i - 1], c = lane[i], len = Math.hypot(c[0] - a[0], c[2] - a[2]), nx = -(c[2] - a[2]) / len, nz = (c[0] - a[0]) / len; for (let t = 7; t < len; t += 10) for (const s of [-1, 1]) candidates.push([a[0] + (c[0] - a[0]) * t / len + nx * s * 9.5, a[2] + (c[2] - a[2]) * t / len + nz * s * 9.5]); }
  for (let ring = 0; ring < 5; ring++) for (let k = 0; k < 34; k++) { const a = k / 34 * Math.PI * 2 + ring * .5, r = 22 + ring * 10; candidates.push([square[0] + Math.cos(a) * r, square[1] + Math.sin(a) * r]); }
  const laneDist = (x: number, z: number) => Math.min(...lanes.map(l => distanceToLine(x, z, l.map(p => [p[0], p[2]] as const))));
  for (const [x, z] of candidates) {
    if (houses.length >= 22) break;
    const w = 8 + Math.floor(rng() * 4), d = 7 + Math.floor(rng() * 3), rad = Math.hypot(w, d) / 2;
    if (distanceToLine(x, z, accessLine) < rad + 9.5 || plan.routes.filter(r => r.kind !== 'underground').some(r => distanceToLine(x, z, r.points.map(p => [p[0], p[2]] as const)) < rad + (r.kind === 'main' ? 5 : 4)) || laneDist(x, z) < rad + 1.4) continue;
    if (egyptLakeDistance(x, z) < 1.25 + rad / 30 || egyptRiver(x, z).d < rad + 8 || houses.some(h => Math.hypot(h.position[0] - x, h.position[2] - z) < rad + Math.hypot(h.width, h.depth) / 2 + 2.5)) continue;
    let best = { d: Infinity, x: 0, z: 0, y: 0 };
    for (const line of [...plan.routes.filter(r => r.kind !== 'underground').map(r => r.points), access, ...lanes]) for (let i = 1; i < line.length; i++) { const p = line[i - 1], q = line[i], dx = q[0] - p[0], dz = q[2] - p[2], t = THREE.MathUtils.clamp(((x - p[0]) * dx + (z - p[2]) * dz) / (dx * dx + dz * dz || 1), 0, 1), px = p[0] + dx * t, pz = p[2] + dz * t, dd = Math.hypot(px - x, pz - z); if (dd < best.d) best = { d: dd, x: px, z: pz, y: p[1] }; }
    if (best.d > 30) continue;
    const yaw = Math.atan2(best.x - x, best.z - z), f = new Frame(town, x, 0, z, yaw);
    let top = -Infinity, low = Infinity;
    for (let ix = 0; ix <= 6; ix++) for (let iz = 0; iz <= 6; iz++) { const p = f.point(-w / 2 + w * ix / 6, 0, -d / 2 + (d + 1.6) * iz / 6), h = heightAt(p.x, p.z); top = Math.max(top, h); low = Math.min(low, h); }
    if (top - low > 3) continue;
    const y = top + .3, near = f.point(0, 0, d / 2 + 1.6), rise = y - heightAt(near.x, near.z);
    if (rise > 2) continue;
    const out = d / 2 + 1.6 + Math.max(0, rise) * 2.6, door = f.point(0, 0, out);
    mudHouse(town, x, y, z, w, d, yaw, houses.length, low - .5, out);
    houses.push({ position: [x, y, z], width: w, depth: d, rotation: yaw, approach: [door.x, heightAt(door.x, door.z), door.z] });
  }
  marketPlace();

  // ───────────── 日河码头: quay steps, moored feluccas, shadufs and papyrus ─────────────
  { const q = new Frame(river, -30, 10, 147, .2); q.box(0, -1.2, 0, 16, 2.4, 6, E.limestone); for (let k = 0; k < 4; k++) q.box(0, -1.2 - k * .45, 3.4 + k * .9, 10, .45, .9, E.limestoneDark);
    for (const x of [-7, -2.5, 2.5, 7]) q.cyl(x, .5, 2.6, .25, 1, E.wood, false);
    // 量水尺 (nilometer): a stair down to the water with incised level marks
    for (let k = 0; k < 9; k++) q.box(9.4, -.2 - k * .4, 2 + k * .5, .1, .06, .5, E.black, false); }
  for (const [x, z, a, s] of [[-34, 156, 1.5, 1], [-20, 154, 1.3, .8], [-70, 169, 1.6, .9], [8, 158, 1.1, 1.1]] as const) felucca(river, x, egyptRiver(x, z).y - .2, z, a, s);
  for (const [x, z, a] of [[-60, 150, 2.6], [-112, 168, -2.8], [16, 142, 2.2], [-150, 170, -2.4]] as const) shaduf(river, x, heightAt(x, z), z, a);
  // papyrus thickets along the banks
  const reed = mulberry32(77);
  for (let i = 0; i < 900; i++) {
    const t = reed(), seg = Math.floor(t * (EGYPT_RIVER.length - 1)), a = EGYPT_RIVER[seg], b = EGYPT_RIVER[seg + 1], f = t * (EGYPT_RIVER.length - 1) - seg, side = reed() < .5 ? -1 : 1;
    const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz), off = 4.6 + reed() * 2.4, x = a[0] + dx * f - dz / l * off * side, z = a[2] + dz * f + dx / l * off * side;
    if (roadDistance(x, z) < 6 || x > 70) continue; const y = heightAt(x, z);
    if (i % 3) { leaves.add(CYL8, E.reed, T(x, y + .9, z, 0, .04, 1.8, .04), false); leaves.add(new THREE.ConeGeometry(.35, .35, 6), E.leaf, T(x, y + 1.9, z, 0, 1, 1, 1, Math.PI), false); }
  }

  // ───────────── 狮身像大道: a raised processional way lined with ram-headed sphinxes ─────────────
  const mainRoute = plan.routes.find(r => r.id === 'main')!.points;
  for (let i = 2; i <= 4; i++) {
    const a = mainRoute[i], c = mainRoute[i + 1], len = Math.hypot(c[0] - a[0], c[2] - a[2]), nx = -(c[2] - a[2]) / len, nz = (c[0] - a[0]) / len, yaw = Math.atan2(c[0] - a[0], c[2] - a[2]);
    for (let t = 6; t < len - 4; t += 8.5) for (const s of [-1, 1]) { const x = a[0] + (c[0] - a[0]) * t / len + nx * s * 6.8, z = a[2] + (c[2] - a[2]) * t / len + nz * s * 6.8; criosphinx(avenue, x, heightAt(x, z), z, yaw + s * Math.PI / 2 + Math.PI); }
    for (const s of [-1, 1]) { const pts: EgyptPoint[] = []; for (let t = 0; t <= len; t += 4) { const x = a[0] + (c[0] - a[0]) * t / len + nx * s * 4.2, z = a[2] + (c[2] - a[2]) * t / len + nz * s * 4.2; pts.push([x, heightAt(x, z) + .25, z]); } ribbon(avenue, pts, .7, E.limestoneDark); }
  }

  // ───────────── 双巨像庭院: a battered stone platform, two seated colossi and obelisks ─────────────
  { const top = 24, x0 = 50, x1 = 110, z0 = -30, z1 = 44, bot = minGround(x0, x1, z0, z1) - 1.5;
    colossi.box((x0 + x1) / 2, bot, (z0 + z1) / 2, x1 - x0, top - bot, z1 - z0, E.limestoneDark);
    for (let x = x0 + 2; x < x1 - 1; x += 4) for (let z = z0 + 2; z < z1 - 1; z += 4) colossi.box(x, top - .02, z, 3.85, .04, 3.85, (x + z) % 8 ? '#e3d4b2' : '#d6c59f', 0, false);
    colossi.box(80, top - .01, (z0 + z1) / 2, 8, .05, z1 - z0, E.sand, 0, false);
    for (const s of [-1, 1]) seatedColossus(colossi, 80 + s * 17.5, top, -8, 0, 1.45);
    for (const s of [-1, 1]) obelisk(colossi, 80 + s * 9, top, 32, 22);
    for (const s of [-1, 1]) for (let z = z0 + 6; z < z1 - 6; z += 12) { const f = new Frame(colossi, 80 + s * 27, top, z); f.box(0, .6, 0, 1.4, 1.2, 1.4, E.limestone); f.cyl(0, 1.6, 0, .55, .8, E.gold, false); glow.add(new THREE.CylinderGeometry(.4, .4, .1, 10), E.ember, T(80 + s * 27, top + 2.05, z), false); } }

  // ───────────── 太阳神殿 ─────────────
  sunTemple();

  // ───────────── 堤道与金字塔 ─────────────
  { const cw = plan.routes.find(r => r.id === 'causeway')!.points;
    for (let i = 3; i < cw.length; i++) { const a = cw[i - 1], c = cw[i], len = Math.hypot(c[0] - a[0], c[2] - a[2]), nx = -(c[2] - a[2]) / len, nz = (c[0] - a[0]) / len; for (const s of [-1, 1]) slabBetween(pyramidB, [a[0] + nx * s * 3.6, a[1] + 1.1, a[2] + nz * s * 3.6], [c[0] + nx * s * 3.6, c[1] + 1.1, c[2] + nz * s * 3.6], .7, 2.2, E.limestoneDark); }
    pyramid(pyramidB, 202, heightAt(202, -212) - .5, -212, 58, 42);
    const vt = new Frame(pyramidB, 162, 37, -186, -.83); vt.box(0, -.5, 0, 14, 1, 10, E.limestone); for (const sx of [-5, -1.7, 1.7, 5]) for (const sz of [-3.5, 3.5]) vt.box(sx, 2.6, sz, 1.1, 5.2, 1.1, '#9a7360'); vt.box(0, 5.5, 0, 13, .7, 9, E.limestoneDark);
    cornice(vt, 0, 0, 12.6, 8.6, 5.8); obelisk(pyramidB, 176, heightAt(176, -196), -196, 12); }

  // ───────────── 引光试炼台: a sun-court of gnomon and obelisks on the dunes ─────────────
  { const y = 18; trial.add(new THREE.CylinderGeometry(24, 25, 1.2, 40), E.limestone, T(165, y - .6, 125)); trial.add(new THREE.CylinderGeometry(24.2, 24.2, .1, 40), E.limestoneDark, T(165, y + .02, 125), false);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; trial.add(BOXG, k % 3 ? E.sandstoneDark : E.gold, T(165 + Math.cos(a) * 18, y + .05, 125 + Math.sin(a) * 18, -a, 3, .06, .4), false); if (k % 3 === 0) obelisk(trial, 165 + Math.cos(a) * 22.5, y, 125 + Math.sin(a) * 22.5, 9, a); }
    trial.add(new THREE.ConeGeometry(1.2, 6, 4), E.gold, T(165, y + 3, 125, Math.PI / 4)); }

  // ───────────── 峡谷崖墓: rock-cut facades along the canyon's northern wall ─────────────
  for (let i = 1; i < EGYPT_CANYON.length - 1; i++) {
    const a = EGYPT_CANYON[i], c = EGYPT_CANYON[i + 1], len = Math.hypot(c[0] - a[0], c[2] - a[2]), nx = -(c[2] - a[2]) / len, nz = (c[0] - a[0]) / len;
    for (const t of [.3, .7]) {
      const side = (i + (t > .5 ? 1 : 0)) % 2 ? 1 : -1, x = a[0] + (c[0] - a[0]) * t + nx * side * 9.6, z = a[2] + (c[2] - a[2]) * t + nz * side * 9.6, y = a[1] + (c[1] - a[1]) * t;
      const f = new Frame(canyon, x, y, z, Math.atan2(-nx * side, -nz * side));
      f.box(0, 4.5, -.8, 9, 9, 2, E.sandstone); f.box(0, 2.1, .25, 3, 4.2, .2, E.black, false);
      for (const s of [-1, 1]) { f.box(s * 1.9, 2.4, .3, .5, 4.8, .5, E.sandstoneDark); f.box(s * 3.4, 2.6, .5, 1.3, 5.2, 1, E.sandstone); f.box(s * 3.4, 5.6, .5, 1.1, 1, .9, E.yellow); }
      f.box(0, 5, .35, 4.6, .8, .5, E.limestone); for (let k = 0; k < 5; k++) f.box(-1.6 + k * .8, 5, .62, .5, .5, .05, [E.blue, E.red, E.yellow, E.green, E.blue][k], false);
      cornice(f, 0, -.6, 8.6, 2.2, 8.4, E.sandstone);
    }
  }

  // ───────────── 太阳船墓: the incline and the barque tomb under the plateau ─────────────
  barqueTomb();

  // ───────────── 第二圈: cliff temple, sacred lake, village, quarry, necropolis, treasury ─────────────
  const keep = buildEgyptMonuments({ make, heightAt, roadDistance, glow, water, leaves, trunks, beams });

  // ───────────── vegetation: palms by water and town, acacias on the desert edge ─────────────
  { const r = mulberry32(919); let palms = 0, acacias = 0;
    for (let i = 0; i < 3000 && (palms < 170 || acacias < 40); i++) {
      const x = -320 + r() * 640, z = -320 + r() * 640, y = heightAt(x, z), g = egyptGreen(x, z), lake = egyptLakeDistance(x, z);
      if (y < 2 || roadDistance(x, z) < 7 || houses.some(h => Math.hypot(h.position[0] - x, h.position[2] - z) < 8.5) || Math.abs(x) > 330 || Math.abs(z) > 330 || lake < 1.05 || egyptRiver(x, z).d < 6.5) continue;
      if (x > 25 && x < 135 && z > -205 && z < 50) continue;
      if (keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
      if ((g > .35 || lake < 2.2) && palms < 170) { palm(trunks, leaves, x, y, z, 8 + r() * 6, .1 + r() * .25, r() * 6.28, i); palms++; }
      else if (plateauDepth(x, z) < -25 && r() < .04 && acacias < 40) { trunks.add(CYL8, '#5e4a36', T(x, y + 1.6, z, 0, .25, 3.2, .25)); leaves.add(new THREE.CylinderGeometry(3, 2.2, .8, 10), '#748a46', T(x, y + 3.6, z), false); acacias++; }
    }
  }

  pieces.find(p => p.batch === town)!.userData = { houses };
  return pieces;

  // ───────────── local builders ─────────────
  function mudHouse(b: Batch, x: number, y: number, z: number, w: number, d: number, a: number, index: number, bottom: number, out: number) {
    // Six trades with distinct massing: courtyard house, dovecote tower house, potter's shop,
    // bakery with a dome oven, weaver's house and a caravanserai, all flat-roofed in mudbrick.
    const f = new Frame(b, x, y, z, a), type = index % 6, h = 3.4 + (type === 1 ? 2.6 : 0) + (index * 37 % 5) * .15;
    const lime = (index * 13) % 3 === 0, wallC = lime ? E.plaster : E.brick;
    f.box(0, (bottom - y) / 2, 0, w + .5, y - bottom, d + .5, E.brickDark);
    f.box(0, -.12, 0, w, .24, d, '#cdb88a');
    const wall = (xx: number, zz: number, ww: number, dd: number, hh = h) => { f.box(xx, hh / 2, zz, ww, hh, dd, wallC); f.box(xx, .35, zz, ww + .04, .7, dd + .04, E.brickDark, false); };
    wall(-w / 2 + .35, 0, .7, d); wall(w / 2 - .35, 0, .7, d); wall(0, -d / 2 + .35, w, .7);
    const gap = 1.8, side = (w - gap) / 2;
    for (const s of [-1, 1]) wall(s * (gap / 2 + side / 2), d / 2 - .35, side, .7);
    f.box(0, (h + 2.5) / 2, d / 2 - .35, gap, h - 2.5, .7, wallC);
    f.box(0, 2.55, d / 2 - .05, gap + .5, .2, .3, E.wood, false);
    for (const s of [-1, 1]) f.box(s * (gap / 2 + .05), 1.25, d / 2 - .05, .12, 2.5, .25, E.wood, false);
    // flat palm-log roof: beam ends show along the front, a parapet and a reed mat
    f.box(0, h + .15, 0, w + .2, .3, d + .2, E.brickDark);
    for (let i = 0; i < Math.floor(w / .7); i++) f.cyl(-w / 2 + .5 + i * .7, h - .15, d / 2 + .1, .1, .2, E.trunk, false);
    for (const s of [-1, 1]) { f.box(s * (w / 2 - .1), h + .65, 0, .2, .7, d, wallC, false); f.box(0, h + .65, s * (d / 2 - .1), w, .7, .2, wallC, false); }
    f.box(w * .15, h + .32, -d * .1, w * .5, .04, d * .5, '#b9a26a', false);
    for (const s of [-1, 1]) f.box(s * w * .28, 2.6, d / 2 - .02, .7, .5, .12, E.black, false);
    // 风塔 (wind catcher) on most roofs
    if (type !== 5) { f.box(-w * .3, h + 1.4, -d * .25, 1.2, 2.2, 1.2, wallC); f.box(-w * .3, h + 1.8, -d * .25 + .62, .8, .9, .06, E.black, false); f.box(-w * .3, h + 2.6, -d * .25, 1.5, .2, 1.5, E.brickDark, false); }
    // exterior stair to the roof along one side
    for (let k = 0; k < 7; k++) f.box(w / 2 + .6, (k + .5) * h / 7, -d / 2 + 1 + k * .6, 1, h / 7, .6, E.brickDark, false);
    const P = (lx: number, ly: number, lz: number) => f.point(lx, ly, lz);
    if (type === 0) { for (const s of [-1, 1]) f.box(s * (w / 2 + 2.2), 1, -d / 2 - .1 + 3, .5, 2, 6, wallC); const tree = P(w / 2 + 1, 0, -d / 2 + 2); palm(trunks, leaves, tree.x, y, tree.z, 6, .1, a, index); }
    else if (type === 1) { const dv = P(w * .25, 0, -d * .2); b.add(new THREE.CylinderGeometry(1, 1.5, 3, 10), E.plaster, T(dv.x, y + h + 1.8, dv.z), false); b.add(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), E.plaster, T(dv.x, y + h + 3.3, dv.z), false); for (let k = 0; k < 8; k++) b.add(BOXG, E.black, T(dv.x + Math.cos(k) * 1.25, y + h + 1.2 + (k % 3) * .7, dv.z + Math.sin(k) * 1.25, -k, .18, .14, .1), false); }
    else if (type === 2) { for (let k = 0; k < 6; k++) { const p = P(-w / 2 + .9 + k * .9, 0, d / 2 + 1); b.add(new THREE.SphereGeometry(.38 + (k % 2) * .1, 9, 7), k % 2 ? '#b86e45' : '#9c5c3a', T(p.x, y + .45, p.z, 0, 1, 1.3, 1), false); } f.box(0, 2.9, d / 2 + 1.3, w * .8, .08, 2.4, E.reed, false); for (const s of [-1, 1]) f.box(s * w * .38, 1.45, d / 2 + 2.4, .1, 2.9, .1, E.trunk, false); }
    else if (type === 3) { const ov = P(-w / 2 - 1.6, 0, 0); b.add(new THREE.SphereGeometry(1.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), E.brick, T(ov.x, y, ov.z), true); glow.add(new THREE.BoxGeometry(.6, .5, .1), E.ember, T(P(-w / 2 - 1.6, 0, 1.45).x, y + .45, P(-w / 2 - 1.6, 0, 1.45).z, a), false); for (let k = 0; k < 4; k++) { const p = P(-w / 2 - .4, 0, -1 + k * .5); b.add(new THREE.CylinderGeometry(.22, .22, .06, 10), '#d9a35a', T(p.x, y + 1.05, p.z), false); } f.box(-w / 2 - .4, .5, -.2, .8, 1, 2.6, E.wood, false); }
    else if (type === 4) { f.box(w / 2 + 1.6, 1, 0, 1.8, .15, 1.2, E.wood, false); for (const s of [-1, 1]) f.box(w / 2 + 1.6 + s * .8, 1.2, 0, .1, 2.4, .1, E.wood, false); for (let k = 0; k < 3; k++) f.box(-w * .3 + k * w * .3, 2.2, d / 2 + .8, w * .25, 1.6, .03, [E.linen, E.blue, E.red][k], false); f.beam([-w / 2, 3, d / 2 + .8], [w / 2, 3, d / 2 + .8], .05, E.wood); }
    else { for (const s of [-1, 1]) f.box(s * (w / 2 + 4), 1.4, 0, .6, 2.8, d + 6, wallC); f.box(0, 1.4, -d / 2 - 3, w + 8.6, 2.8, .6, wallC); const cm = P(w / 2 + 2, 0, d / 2 + .5); camel(b, cm.x, y - .3, cm.z, a + 1.2, true); }
    // interior: mat bed, chest, jars and a hanging lamp
    f.box(-w / 2 + 1.5, .2, -d / 2 + 1.6, 2.2, .4, 2.6, E.linen); f.box(w / 2 - 1.2, .4, -d / 2 + 1.1, 1.2, .8, .8, E.wood);
    for (let k = 0; k < 2; k++) { const p = P(w / 2 - 1, 0, d / 2 - 1.6 - k * .8); b.add(new THREE.SphereGeometry(.3, 8, 6), '#b86e45', T(p.x, y + .35, p.z, 0, 1, 1.3, 1), false); }
    const ramp = f.point(0, 0, out), sill = f.point(0, 0, d / 2 - .2), g0 = heightAt(ramp.x, ramp.z);
    // Always lay the threshold strip: the ground can dip between the street and the plinth.
    { walkStrip(b, [[ramp.x, g0 + .03, ramp.z], [sill.x, y, sill.z]], 2.2, '#cdb88a'); const seg = (out - d / 2 + .2) / 4; for (let k = 0; k < 4; k++) { const tp = g0 + (y - g0) * k / 4 - .05, p = f.point(0, 0, out - seg * (k + .5)); b.add(new THREE.BoxGeometry(2.1, tp - g0 + .6, seg), E.brickDark, T(p.x, (tp + g0 - .6) / 2, p.z, a), false); } }
  }

  function marketPlace() {
    // striped awnings, baskets of dates and grain, spice cones, rugs and a well with a shaduf
    const clear = (x: number, z: number, r: number) => distanceToLine(x, z, accessLine) > r + 8.6 && plan.routes.filter(rt => rt.kind !== 'underground').every(rt => distanceToLine(x, z, rt.points.map(p => [p[0], p[2]] as const)) > r + 3.4) && laneDist(x, z) > r + 1.8 && houses.every(h => Math.hypot(h.position[0] - x, h.position[2] - z) > r + Math.hypot(h.width, h.depth) / 2 + 1);
    let n = 0;
    for (let k = 0; k < 40 && n < 7; k++) {
      const ang = k * 2.39, r = 9 + (k % 4) * 2.2, x = square[0] + Math.cos(ang) * r, z = square[1] + Math.sin(ang) * r;
      if (!clear(x, z, 2)) continue;
      const f = new Frame(market, x, heightAt(x, z), z, ang + Math.PI / 2), col = [E.red, E.blue, E.yellow, E.green, E.linen, E.faience, E.red][n];
      for (const sx of [-1.4, 1.4]) for (const sz of [-1, 1]) f.box(sx, 1.2, sz, .1, 2.4, .1, E.trunk, false);
      for (let s = 0; s < 6; s++) f.box(-1.25 + s * .5, 2.45, 0, .5, .06, 2.4, s % 2 ? col : E.linen, false);
      f.box(0, .45, .2, 2.6, .9, 1.2, E.wood);
      if (n % 3 === 0) for (let i = 0; i < 4; i++) { f.cyl(-.9 + i * .6, 1.05, .2, .25, .3, E.reed, false); f.cyl(-.9 + i * .6, 1.22, .2, .22, .06, ['#7a3b22', '#d9b44a', '#a8642c', '#6b7a3a'][i], false); }
      else if (n % 3 === 1) for (let i = 0; i < 4; i++) { const p = f.point(-.9 + i * .6, 0, .2); market.add(new THREE.ConeGeometry(.22, .4, 8), ['#c7442a', '#d9a33a', '#8f6a2a', '#5b7a3a'][i], T(p.x, heightAt(x, z) + 1.12, p.z), false); }
      else { f.box(0, .93, .2, 2.4, .06, 1.1, E.red, false); for (let i = 0; i < 5; i++) f.box(-1 + i * .5, .965, .2, .2, .02, 1.1, E.yellow, false); }
      n++;
    }
    const w = new Frame(market, -183, heightAt(-183, 128), 128, .5);
    w.cyl(0, .5, 0, 1.4, 1, E.limestone); w.cyl(0, 1.02, 0, 1.05, .05, E.water, false);
    for (const s of [-1, 1]) w.box(s * 1.7, 1.5, 0, .25, 3, .25, E.trunk); w.beam([-1.7, 3, 0], [1.7, 3, 0], .15, E.trunk);
    for (const [cx, cz, a] of [[-150, 128, .4], [-146, 132, 2.2], [-178, 88, 3.4]] as const) if (clear(cx, cz, 2)) camel(market, cx, heightAt(cx, cz), cz, a, cx > -160);
  }

  function sunTemple() {
    const [tx0, tx1, tz0, tz1, top] = EGYPT_TEMPLE.terrace, [cx0, cx1, cz0, cz1] = EGYPT_TEMPLE.court, [hx0, hx1, hz0, hz1, hh] = EGYPT_TEMPLE.hall, [sx0, sx1, sz0, sz1, sh] = EGYPT_TEMPLE.sanctuary;
    const roofY = EGYPT_TEMPLE.courtRoof;
    // terrace: battered limestone podium with a sandstone kerb
    const bot = minGround(tx0, tx1, tz0, tz1) - 2;
    // The rear strip leaves a slot for the tomb incline where it passes under the back of the terrace.
    { const f = new Frame(temple, 0, 0, 0), rear = -191; batter(f, (tx0 + tx1) / 2, (rear + tz1 + 1) / 2, tx1 - tx0 + 2, tz1 + 1 - rear, bot, top - bot, .04, E.limestoneDark);
      const sl = EGYPT_MIRRORS.door.x - 3.4, sr = EGYPT_MIRRORS.door.x + 3.4;
      temple.box((tx0 - 1 + sl) / 2, bot, (tz0 - 1 + rear) / 2, sl - tx0 + 1, top - bot, rear - tz0 + 1, E.limestoneDark); temple.box((sr + tx1 + 1) / 2, bot, (tz0 - 1 + rear) / 2, tx1 + 1 - sr, top - bot, rear - tz0 + 1, E.limestoneDark); }
    for (let x = tx0 + 2; x < tx1 - 1; x += 4) for (let z = tz0 + 2; z < tz1 - 1; z += 4) temple.box(x, top - .02, z, 3.85, .04, 3.85, (x * 3 + z) % 8 ? '#e1d2ae' : '#d4c39c', 0, false);
    // the ceremonial ramp from the colossi court up to the terrace, flanked by sphinxes
    for (let k = 0; k < 8; k++) { const z0 = -40 - k * (38 / 8), z1 = z0 - 38 / 8, y = 24 + 6 * k / 8 - .06; temple.box(80, y - 6, (z0 + z1) / 2, 12, 6, Math.abs(z1 - z0), E.limestoneDark, 0, false); }
    walkStrip(temple, [[80, 24, -40], [80, 30, -78.02]], 10, '#e1d2ae');
    for (const s of [-1, 1]) { slabBetween(temple, [80 + s * 5.6, 24.6, -40], [80 + s * 5.6, 30.6, -78], .8, 1.2, E.limestone); criosphinx(temple, 80 + s * 9, heightAt(80 + s * 9, -50), -50, s * Math.PI / 2 + Math.PI); }
    // pylon towers and the gateway with its winged sun disc
    const py = EGYPT_TEMPLE.pylon, pf = new Frame(temple, 0, 0, 0);
    for (const [x0, x1] of py.towers) pylonTower(pf, (x0 + x1) / 2, py.z, x1 - x0, py.depth, top, py.height, 1);
    for (const s of [-1, 1]) pf.box(80 + s * 6, top + 6.5, py.z, 4, 13, py.depth - 1, E.sandstone);
    pf.box(80, top + 10.8, py.z, 8.2, 2.4, py.depth - 1, E.sandstone); cornice(pf, 80, py.z, 16, py.depth - 1, top + 12.1);
    pf.box(80, top + 10.8, py.z + py.depth / 2 - .3, 6, 1.6, .2, E.gold, false);
    for (const s of [-1, 1]) pf.box(80 + s * 2.6, top + 10.8, py.z + py.depth / 2 - .25, 3.4, .9, .15, E.blue, false);
    // court walls (side gate in the west wall for the canyon road), colonnades and roofs
    for (const [x, gap] of [[cx0, true], [cx1, false]] as const) {
      if (gap) { temple.box(x, top, (cz1 + -108) / 2, 2, roofY - top, cz1 - -108, E.sandstone); temple.box(x, top, (cz0 + -112) / 2, 2, roofY - top, -112 - cz0, E.sandstone); temple.box(x, top + 4, -110, 2, roofY - top - 4, 4, E.sandstone); }
      else temple.box(x, top, (cz0 + cz1) / 2, 2, roofY - top, cz1 - cz0, E.sandstone);
    }
    const colRoof = (x0: number, x1: number, z0: number, z1: number) => { temple.box((x0 + x1) / 2, roofY - .8, (z0 + z1) / 2, x1 - x0, .8, z1 - z0, E.limestone); };
    colRoof(cx0 - 1, 50, cz0, cz1); colRoof(110, cx1 + 1, cz0, cz1);
    for (let z = cz1 - 3; z > cz0 + 1; z -= 4.8) for (const x of [49, 111]) lotusColumn(new Frame(temple, 0, 0, 0), x, z, top, roofY - .8 - top);
    for (let z = cz1 - 1; z > cz0; z -= 3) temple.box(cx0 + .5, roofY, z, .6, .9, 2.6, E.sandstone, 0, false);
    // high route: the stair ramp onto the west colonnade roof
    for (let k = 0; k < 8; k++) { const z0 = -99 - k * 3, y = top + (roofY - top) * k / 8 - .06; temple.box(52, top, z0 - 1.5, 4, y - top + .01, 3, E.limestoneDark, 0, false); }
    walkStrip(temple, [[52, top, -99], [52, roofY, -123]], 4, '#e1d2ae');
    slabBetween(temple, [54.3, top + .6, -99], [54.3, roofY + .6, -123], .4, 1.2, E.limestone);
    // hypostyle hall: open portico on the court, papyrus columns, a raised clerestory nave
    for (const x of EGYPT_TEMPLE.columns.x) papyrusColumn(new Frame(temple, 0, 0, 0), x, hz1 - .5, top, hh - .8, .85);
    for (const x of EGYPT_TEMPLE.columns.x) for (const z of EGYPT_TEMPLE.columns.z) papyrusColumn(new Frame(temple, 0, 0, 0), x, z, top, hh - .8, .9);
    for (const x of [hx0, hx1]) temple.box(x, top, (hz0 + hz1) / 2, 2, hh, hz1 - hz0, E.sandstone);
    temple.box((hx0 + 76) / 2, top, hz0, 76 - hx0, hh, 2, E.sandstone); temple.box((84 + hx1) / 2, top, hz0, hx1 - 84, hh, 2, E.sandstone); temple.box(80, top + 7, hz0, 8, hh - 7, 2, E.sandstone);
    temple.box((hx0 + 70) / 2, top + hh - .8, (hz0 + hz1) / 2, 70 - hx0 + 1, .8, hz1 - hz0, E.limestone); temple.box((90 + hx1) / 2, top + hh - .8, (hz0 + hz1) / 2, hx1 - 90 + 1, .8, hz1 - hz0, E.limestone);
    // clerestory: stone grilles letting slanted light into the nave
    for (const s of [-1, 1]) { temple.box(80 + s * 10, top + hh, (hz0 + hz1) / 2, .6, 4, hz1 - hz0, E.limestone); for (let z = hz1 - 3; z > hz0 + 1; z -= 2.5) temple.box(80 + s * 10, top + hh + .6, z, .7, 2.6, 1.2, E.limestoneDark, 0, false); }
    temple.box(80, top + hh + 4, (hz0 + hz1) / 2, 21, .8, hz1 - hz0, E.limestone);
    for (let z = hz1 - 6; z > hz0 + 3; z -= 9) beams.add(new THREE.BoxGeometry(1.6, 12, 2.2), E.light, T(80 - 4, top + 7, z, 0, 1, 1, 1, 0, .45), false);
    // painted ceiling of the nave: blue with gold stars, and vultures along the axis
    temple.box(80, top + hh + 3.9, (hz0 + hz1) / 2, 19.6, .1, hz1 - hz0 - .2, E.lapis, 0, false);
    for (let k = 0; k < 40; k++) glow.add(new THREE.OctahedronGeometry(.16, 0), E.yellow, T(72 + (k * 37 % 16), top + hh + 3.82, hz0 + 1 + (k * 53 % (hz1 - hz0 - 2))), false);
    // roof parapets round the outer edges, and the roof sun-altar
    for (let z = hz1; z > hz0; z -= 3) temple.box(hx0 + .3, roofY, z - 1.5, .6, .9, 2.6, E.sandstone, 0, false);
    { const [ax, , az] = EGYPT_TEMPLE.roofShrine, f = new Frame(temple, ax, roofY, az); for (const sx of [-1, 1]) for (const sz of [-1, 1]) lotusColumn(f, sx * 2.2, sz * 2.2, 0, 3.6, .3); f.box(0, 3.75, 0, 5.8, .4, 5.8, E.limestone, false); cornice(f, 0, 0, 5.6, 5.6, 3.95); f.box(0, .5, 0, 1.6, 1, 1.6, E.limestoneDark); f.cyl(0, 1.3, 0, .55, .12, E.gold, false); glow.add(new THREE.SphereGeometry(.4, 10, 8), E.ember, T(ax, roofY + 1.6, az), false); }
    // sanctuary: front door on the axis, the sun-disc door at the back, two divine statues
    temple.box((sx0 + 76) / 2, top, sz1, 76 - sx0, sh, 1.6, E.sandstone); temple.box((84 + sx1) / 2, top, sz1, sx1 - 84, sh, 1.6, E.sandstone); temple.box(80, top + 6.5, sz1, 8, sh - 6.5, 1.6, E.sandstone);
    for (const x of [sx0, sx1]) temple.box(x, top, (sz0 + sz1) / 2, 1.6, sh, sz1 - sz0, E.sandstone);
    const door = EGYPT_MIRRORS.door; temple.box((sx0 + door.x - door.width / 2) / 2, top, sz0, door.x - door.width / 2 - sx0, sh, 1.6, E.sandstone); temple.box((door.x + door.width / 2 + sx1) / 2, top, sz0, sx1 - door.x - door.width / 2, sh, 1.6, E.sandstone); temple.box(80, top + door.height, sz0, door.width, sh - door.height, 1.6, E.sandstone);
    temple.box(80, top + sh, (sz0 + sz1) / 2, sx1 - sx0 + 1.6, .8, sz1 - sz0 + 1.6, E.limestone);
    cornice(new Frame(temple, 0, 0, 0), 80, (sz0 + sz1) / 2, sx1 - sx0 + 1.6, sz1 - sz0 + 1.6, top + sh + .8);
    for (const s of [-1, 1]) { seatedColossus(temple, 80 + s * 9, top, -184, 0, .26); temple.box(80 + s * 9, top, -184.5, 3, .8, 4, E.limestoneDark); }
    for (const s of [-1, 1]) for (const zz of [-172, -180]) { temple.box(80 + s * 12.8, top + 4, zz, .2, 2.4, 3, E.plaster, 0, false); for (let k = 0; k < 4; k++) temple.box(80 + s * 12.68, top + 3.2 + k * .55, zz - 1 + (k % 2) * .6, .05, .4, .8, [E.blue, E.red, E.yellow, E.green][k], 0, false); }
    // the emitter: a gilded sun-mirror set in the court's east colonnade
    { const [ex, ez] = EGYPT_MIRRORS.emitter.p, f = new Frame(temple, ex, top, ez); f.box(0, .8, 0, 2.4, 1.6, 2.4, E.limestoneDark); f.cyl(0, 2.4, 0, .25, 1.6, E.gold, false); const disc = f.point(-.2, EGYPT_MIRRORS.y - top + .02, 0); glow.add(new THREE.CylinderGeometry(1, 1, .12, 24), E.gold, T(disc.x, disc.y, disc.z, Math.PI / 2, 1, 1, 1, 0, Math.PI / 2), false); }
    // mirror pedestals (the turning mirrors themselves are runtime)
    for (const m of EGYPT_MIRRORS.mirrors) { temple.box(m.p[0], top, m.p[1], 1.8, .9, 1.8, E.limestoneDark); temple.add(CYL8, E.gold, T(m.p[0], top + 1, m.p[1], 0, .7, .2, .7), false); }
    // offering tables and braziers in the court
    for (const [x, z] of [[70, -100], [90, -100], [70, -120], [90, -120]] as const) { const f = new Frame(temple, x, top, z); f.box(0, .5, 0, 1.6, 1, 1, E.limestone); f.cyl(0, 1.1, 0, .5, .2, E.gold, false); glow.add(new THREE.ConeGeometry(.35, .7, 8), E.ember, T(x, top + 1.5, z), false); }
    // a covered passage behind the sanctuary over the start of the tomb incline
    temple.box(80 - 4.6, top, -195, 3.2, 7.2, 6, E.sandstone); temple.box(80 + 4.6, top, -195, 3.2, 7.2, 6, E.sandstone); temple.box(80, top + 6.2, -195, 12.4, 1, 6.2, E.limestone);
  }

  function barqueTomb() {
    const c = EGYPT_CORRIDORS[0], r = EGYPT_ROOMS[0], hw = c.width / 2, lo = Math.min(c.a[1], c.b[1]), hi = Math.max(c.a[1], c.b[1]);
    walkStrip(tomb, [c.a, c.b], c.width + .3, '#cdbb94');
    for (const s of [-1, 1]) tomb.box(c.a[0] + s * (hw + 1.2), lo - 1.2, (c.a[2] + c.b[2]) / 2, 2.4, hi - lo + c.height + 2.6, Math.abs(c.b[2] - c.a[2]), E.limestoneDark);
    slabBetween(tomb, [c.a[0], c.a[1] + c.height + .7, c.a[2]], [c.b[0], c.b[1] + c.height + .7, c.b[2]], c.width + 4.8, 1.4, E.limestone);
    // painted registers down both walls of the incline: processions toward the dark
    const len = Math.abs(c.b[2] - c.a[2]);
    for (let t = 2; t < len - 1; t += 2.2) { const k = t / len, z = c.a[2] - t, y = c.a[1] + (c.b[1] - c.a[1]) * k; for (const s of [-1, 1]) { tomb.box(c.a[0] + s * (hw - .05), y + 1.2, z, .06, 1.8, 1.6, E.plaster, 0, false); tomb.box(c.a[0] + s * (hw - .1), y + 1.3, z, .04, 1.3, .5, [E.red, E.blue, E.yellow, E.green][Math.round(t) % 4], 0, false); } if (Math.round(t / 2.2) % 3 === 0) glow.box(c.a[0] - hw + .25, y + 2.9, z, .2, .3, .2, E.ember, 0, false); }
    // the chamber: floor, walls with a door from the incline, starred ceiling, pillars
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, w = r.x1 - r.x0, d = r.z1 - r.z0, rt = r.floor + r.height;
    tomb.box(cx, r.floor - 1.2, cz, w, 1.2, d, '#cdbb94');
    tomb.box(cx, rt, cz, w + 4.8, 1.4, d + 4.8, E.limestone);
    // The east wall opens on the short passage into the treasury.
    { const D = EGYPT_TREASURY_DOOR, wx = cx - w / 2 - 1.2, ex = cx + w / 2 + 1.2, za = r.z0 - 2.4, zb = r.z1 + 2.4, dz0 = D.z - D.width / 2, dz1 = D.z + D.width / 2;
      tomb.box(wx, r.floor - 1.2, cz, 2.4, r.height + 2.6, d + 4.8, E.limestoneDark);
      tomb.box(ex, r.floor - 1.2, (za + dz0) / 2, 2.4, r.height + 2.6, dz0 - za, E.limestoneDark); tomb.box(ex, r.floor - 1.2, (dz1 + zb) / 2, 2.4, r.height + 2.6, zb - dz1, E.limestoneDark);
      tomb.box(ex, r.floor + D.height, D.z, 2.4, r.height - D.height + 1.4, D.width, E.limestoneDark); }
    tomb.box(cx, r.floor - 1.2, r.z0 - 1.2, w, r.height + 2.6, 2.4, E.limestoneDark);
    tomb.box((r.x0 + c.b[0] - hw) / 2, r.floor - 1.2, r.z1 + 1.2, c.b[0] - hw - r.x0, r.height + 2.6, 2.4, E.limestoneDark);
    tomb.box((c.b[0] + hw + r.x1) / 2, r.floor - 1.2, r.z1 + 1.2, r.x1 - c.b[0] - hw, r.height + 2.6, 2.4, E.limestoneDark);
    tomb.box(c.b[0], c.b[1] + c.height, r.z1 + 1.2, c.width, r.height - c.height + 1.4, 2.4, E.limestoneDark);
    tomb.box(cx, rt - .06, cz, w - .2, .05, d - .2, E.lapis, 0, false);
    for (let k = 0; k < 90; k++) glow.add(new THREE.OctahedronGeometry(.14, 0), E.yellow, T(r.x0 + 1 + (k * 37 % (w - 2)), rt - .12, r.z0 + 1 + (k * 53 % (d - 2))), false);
    for (const x of [r.x0 + 6, r.x1 - 6]) for (const z of [r.z0 + 7, r.z1 - 9]) { const f = new Frame(tomb, x, r.floor, z); f.box(0, r.height / 2, 0, 1.6, r.height, 1.6, E.limestone); for (const s of [-1, 1]) f.box(0, r.height * .55, s * .82, 1.2, r.height * .7, .05, E.plaster, false); f.box(0, r.height * .6, .86, .7, 2.4, .04, E.red, false); }
    // painted walls: the sun's night journey in registers of coloured figures
    for (const s of [-1, 1]) for (let i = 0; i < 12; i++) { const z = r.z0 + 2 + i * (d - 4) / 11; if (s > 0 && Math.abs(z - EGYPT_TREASURY_DOOR.z) < EGYPT_TREASURY_DOOR.width / 2 + 1.1) continue; tomb.box(cx + s * (w / 2 - .05), r.floor + 2.4, z, .05, 3.2, 2.2, E.plaster, 0, false); tomb.box(cx + s * (w / 2 - .1), r.floor + 2.4, z, .04, 2.2, .6, [E.red, E.blue, E.yellow, E.green, E.black][i % 5], 0, false); tomb.box(cx + s * (w / 2 - .1), r.floor + 4.4, z, .04, .3, 2, E.yellow, 0, false); }
    // 太阳船: the gilded solar barque on its stand, with its cabin, oars and sun disc
    { const f = new Frame(tomb, cx, r.floor + 1.3, cz - 2, 0), sh = new Shell(f), L = 9, W = 1.5;
      const ring = (zz: number, ww: number, yy: number): [number, number, number][] => [[-ww, yy + .7, zz], [ww, yy + .7, zz], [ww * .55, yy, zz], [-ww * .55, yy, zz]];
      const sec = [ring(-L, .2, 1.6), ring(-L * .6, W * .8, .3), ring(0, W, 0), ring(L * .6, W * .8, .3), ring(L, .2, 1.6)];
      for (let i = 1; i < sec.length; i++) { const p = sec[i - 1], q = sec[i]; sh.quad(p[0], q[0], q[3], p[3], [-1, -.3, 0]); sh.quad(p[1], q[1], q[2], p[2], [1, -.3, 0]); sh.quad(p[3], q[3], q[2], p[2], [0, -1, 0]); sh.quad(p[0], q[0], q[1], p[1], [0, 1, 0]); }
      sh.done(E.gold);
      for (const z of [-L - .2, L + .2]) { f.beam([0, 1.7, z * .97], [0, 3.4, z * 1.08], .3, E.gold); f.cyl(0, 3.6, z * 1.08, .3, .3, E.faience, false); }
      f.box(0, 1.4, 0, 2, 1.4, 3, E.lapis); f.box(0, 2.2, 0, 2.3, .2, 3.3, E.gold, false); f.cyl(0, 2.9, 0, .7, .1, E.gold, false);
      for (let k = -2; k <= 2; k++) for (const s of [-1, 1]) f.beam([s * 1.1, .8, k * 1.4], [s * 2.4, -.6, k * 1.4 + .6], .08, E.wood);
      f.box(0, -.6, 0, 2.4, 1.4, 10, E.limestoneDark); }
    // sarcophagus, canopic chests and treasure along the far wall
    { const f = new Frame(tomb, cx, r.floor, r.z0 + 3.5); f.box(0, .8, 0, 3.6, 1.6, 2, '#5d5450'); f.box(0, 1.7, 0, 3.8, .3, 2.2, '#4d4542'); for (const s of [-1, 1]) { f.box(s * 4.5, .6, 0, 1.2, 1.2, 1.2, E.gold); f.box(s * 4.5, 1.3, 0, .9, .3, .9, E.faience, false); } for (let k = 0; k < 6; k++) f.cyl(-6 + k * 2.4, .45, 1.2, .25, .9, k % 2 ? E.limestone : E.faience, false); }
  }
}
