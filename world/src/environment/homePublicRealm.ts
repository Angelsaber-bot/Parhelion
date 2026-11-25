import * as THREE from 'three';
import { HOME_ROUTES, HOME_SHELTERS, HOME_SITES, homeWorld } from '../map/homePlan';
import { SiteArt } from '../story/campaignSites';

type Point = [number, number, number];
type Surface = (x: number, z: number) => number;
type Section = readonly [radius: number, rise: number];

const STONE = ['#b9ad96', '#c2b7a0', '#b0a58e', '#c5b9a5', '#a99e8a', '#bcb49f'] as const;
const GROUT = '#827d72';
const TRIM = '#d8c9ac';
const TIMBER = '#775b43';
const DARK_TIMBER = '#513f32';
const PATINA = '#537775';
const METAL = '#565b52';

function point(x: number, z: number, radius: number, angle: number, height: Surface): Point {
  const px = x + Math.cos(angle) * radius, pz = z + Math.sin(angle) * radius;
  return [px, height(px, pz), pz];
}

function face(art: SiteArt, vertices: readonly Point[], color: string, layer: 'body' | 'ground' = 'body', solid = false) {
  const triangles = vertices.length === 3 ? vertices : [vertices[0], vertices[1], vertices[2], vertices[0], vertices[2], vertices[3]];
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(triangles.flat(), 3));
  art.add(geometry, color, [0, 0, 0], undefined, solid, layer);
  geometry.dispose();
}

function ring(art: SiteArt, x: number, z: number, inner: Section, outer: Section, height: Surface,
  segments: number, color: (index: number) => string, options: { seam?: number; turn?: number; layer?: 'body' | 'ground'; solid?: boolean } = {}) {
  const step = Math.PI * 2 / segments, inset = (options.seam ?? 0) / (inner[0] + outer[0]);
  const at = (section: Section, angle: number) => point(x, z, section[0], angle, (px, pz) => height(px, pz) + section[1]);
  for (let i = 0; i < segments; i++) {
    const start = (i + (options.turn ?? 0)) * step + inset, end = (i + 1 + (options.turn ?? 0)) * step - inset;
    const vertices = inner[0] > 0 ? [at(inner, start), at(inner, end), at(outer, end), at(outer, start)]
      : [at(inner, start), at(outer, end), at(outer, start)];
    face(art, vertices, color(i), options.layer, options.solid);
  }
}

function squarePaving(surface: Surface) {
  const art = new SiteArt();
  const [x, , z] = homeWorld(HOME_SITES.find(site => site.id === 'square')!.position);
  // Grout masks the original pale court through the open joints between the ashlar blocks.
  ring(art, x, z, [0, .009], [24.75, .009], surface, 96, () => GROUT, { layer: 'ground' });
  ring(art, x, z, [0, .025], [2, .025], surface, 16, i => i % 4 < 2 ? PATINA : '#638381', { layer: 'ground' });
  ring(art, x, z, [2.02, .023], [2.32, .023], surface, 16, () => TRIM, { seam: .018, layer: 'ground' });
  // Eight small pale spokes align the darker centre with the surrounding pavement.
  for (let i = 0; i < 8; i++) {
    const heading = i * Math.PI / 4, mark = (radius: number, offset: number) =>
      point(x, z, radius, heading + offset, (px, pz) => surface(px, pz) + .031);
    face(art, [mark(.39, -.31), mark(.39, .31), mark(1.73, 0)], i % 2 ? '#bcbca5' : '#e6d3a4', 'ground');
  }
  for (let band = 0; band < 10; band++) {
    const inner = 2.36 + band * 1.94, outer = inner + 1.91;
    const segments = Math.max(12, Math.round((inner + outer) * Math.PI / 2.25 / 4) * 4);
    ring(art, x, z, [inner, .027], [outer, .027], surface, segments,
      i => STONE[(i * 11 + band * 7 + (i * i) % 5) % STONE.length], { seam: .029, turn: band % 2 / 2, layer: 'ground' });
  }
  ring(art, x, z, [21.81, .025], [22.14, .015], surface, 72, i => i % 3 ? '#a49c8a' : TRIM, { seam: .028, layer: 'ground' });
  for (let band = 0; band < 3; band++) {
    const start = 22.18 + band * .825;
    ring(art, x, z, [start, .025], [start + .80, .023], surface, 96,
      i => STONE[(i * 7 + band * 3) % STONE.length], { seam: .024, turn: band % 2 / 2, layer: 'ground' });
  }
  // Four short thresholds carry the same ashlar onto the streets, then taper into the original road stone.
  for (const route of HOME_ROUTES) {
    const [start, next] = route.points.map(homeWorld);
    if (start[0] !== x || start[2] !== z) continue;
    const run = Math.hypot(next[0] - x, next[2] - z);
    const ux = (next[0] - x) / run, uz = (next[2] - z) / run;
    const tile = (along: number, across: number): Point => {
      const px = x + ux * along + uz * across, pz = z + uz * along - ux * across;
      return [px, surface(px, pz) + .036, pz];
    };
    const width = route.kind === 'main' ? 6.3 : 4.5;
    for (let row = 0; row < 5; row++) {
      const from = 24.35 + row * .84, span = width * (1 - row * .115) / 4;
      for (let col = 0; col < 4; col++) {
        const left = (col - 2) * span + .02, right = left + span - .044;
        face(art, [tile(from, left), tile(from + .80, left), tile(from + .80, right), tile(from, right)],
          STONE[(row * 5 + col * 3) % STONE.length], 'ground');
      }
    }
  }
  art.materials.body.userData.noGroundGrime = true;
  return art;
}

function fountain() {
  const art = new SiteArt();
  // The existing cistern and its collector are part of the shipped town mesh.
  const [x, y, z] = homeWorld([-155, 16, 53]);
  const level = () => y, colors = (i: number) => STONE[i % STONE.length];
  // The lower courses overlay the stone cylinder and step in to the coping.
  ring(art, x, z, [3.44, .37], [3.46, .1], level, 24, colors, { seam: .023 });
  ring(art, x, z, [3.44, .64], [3.44, .38], level, 24, colors, { seam: .023, turn: .5 });
  ring(art, x, z, [3.43, .73], [3.53, .65], level, 24, () => '#938a76');
  ring(art, x, z, [2.88, .82], [3.43, .73], level, 24, colors, { seam: .025, solid: true });
  ring(art, x, z, [2.78, .752], [2.88, .82], level, 24, () => '#9a8e73');
  // A shallow upper dish connects visually to the existing shaft and brass collar.
  art.cyl([x, y + 1.73, z], .4, .13, '#977f50', false, 'metal');
  ring(art, x, z, [.34, 1.94], [1.15, 2.04], level, 24, () => '#c8b899');
  ring(art, x, z, [1.15, 2.04], [1.19, 1.91], level, 24, () => '#9f8c73');
  art.cyl([x, y + 2.11, z], .19, .34, '#a68554', false, 'metal');
  // Cut-in ripple bands use the bottom basin's existing water level.
  for (const [radius, rise] of [[.76, .795], [1.35, .794], [2.32, .793]] as const)
    ring(art, x, z, [radius, rise], [radius + .048, rise], level, 32, i => i % 4 === 1 ? '#87b0aa' : '#6a9b98');
  return art;
}

// The market opens towards the square. Each dyed panel follows the same bowed
// profile and wraps over the front rail into a short scalloped valance.
function marketAwning(art: SiteArt, x: number, eave: number, z: number) {
  const width = 6.82, strips = 11;
  const back = z + 2.32, front = z + 3.43, lip = eave - .48;
  for (const dx of [-3.06, 0, 3.06]) {
    art.beam([x + dx, eave - .78, z + 1.88], [x + dx, lip - .015, front], .09, DARK_TIMBER);
    art.beam([x + dx, eave + .02, back], [x + dx, lip - .015, front], .085, TIMBER);
  }
  art.box([x, lip - .045, front], [width + .16, .085, .10], DARK_TIMBER);
  const cloth = (vertices: Point[], color: string) => {
    face(art, vertices, color);
    face(art, [...vertices].reverse(), color);
  };
  for (let i = 0; i < strips; i++) {
    const left = x - width / 2 + width * i / strips, right = left + width / strips;
    const color = i % 2 ? '#dfcdaa' : '#ad6850';
    const profile = [[back, eave + .08], [back + .45, eave - .19], [front, lip + .055]] as const;
    for (let j = 1; j < profile.length; j++) {
      const [bz, by] = profile[j - 1], [fz, fy] = profile[j];
      cloth([[left, by, bz], [left, fy, fz], [right, fy, fz], [right, by, bz]], color);
    }
    const zz = front + .056;
    cloth([[left, lip + .055, front], [left, lip - .13, zz],
      [right, lip - .13, zz], [right, lip + .055, front]], color);
    cloth([[left, lip - .13, zz], [left + .11, lip - .24, zz],
      [right - .11, lip - .24, zz], [right, lip - .13, zz]], color);
  }
}

// A cordon-trained vine grows up the end posts and spans the back lintel.
// Its arched canes establish the silhouette before the leaf clusters are added.
function gardenArbor(art: SiteArt, x: number, eave: number, z: number, floor: Surface) {
  const back = z - 1.96;
  const leaf = new THREE.IcosahedronGeometry(1, 0);
  const greens = ['#607349', '#859252', '#6d884d', '#9b9f65'];
  for (const side of [-1, 1]) {
    const start = x + side * 3.15, base = floor(start, back);
    const trunk: Point[] = [[start, base, back], [start - side * .19, base + 1.28, back - .045],
      [start + side * .05, eave - .56, back], [start - side * .53, eave - .16, back]];
    for (let i = 1; i < trunk.length; i++) art.beam(trunk[i - 1], trunk[i], .115 - .015 * i, '#68543d');
    let tip = trunk[3];
    for (let i = 0; i < 5; i++) {
      const next: Point = [tip[0] - side * .49, eave - .18 + .10 * Math.sin(i * 1.7), back - .06];
      art.beam(tip, next, .065, '#73623f');
      const shoot: Point = [next[0] + side * .10, next[1] + (i % 2 ? .18 : -.25), back - .19];
      art.beam(next, shoot, .036, '#848252');
      art.add(leaf, greens[(i + (side < 0 ? 1 : 0)) % greens.length], shoot,
        [.29, .19, .20], false, 'body', [.24, i * .8, side * .58]);
      if (i % 2 === 0) {
        const grapes: Point = [shoot[0], shoot[1] - .20, shoot[2] - .04];
        art.add(leaf, '#786377', grapes, [.085, .14, .075], false, 'body', [.12, i * .64, -.13]);
      }
      tip = next;
    }
  }
  leaf.dispose();
}

function shelter(site: readonly [number, number, number], pitch: number, garden: boolean, floor: Surface) {
  const art = new SiteArt();
  const [x, , z] = homeWorld(site);
  const foot = floor(x, z), eave = foot + 3.05, ridge = eave + 2.37 * Math.tan(pitch);
  const roofLength = 7.1, metalRoof = garden ? ['#55716b', '#617972', '#647c75', '#526d66'] : ['#ad795c', '#a56e55', '#b28165', '#9b6751'];
  const at = (dx: number, y: number, dz: number): Point => [x + dx, y, z + dz];
  const roofY = (dz: number) => ridge - Math.abs(dz) * Math.tan(pitch);
  const blocks = [-3.06, 0, 3.06];
  for (const side of [-1, 1]) {
    const dz = side * 1.88;
    const postTop = roofY(dz) - .17;
    art.box(at(0, postTop + .035, dz), [6.52, .23, .22], DARK_TIMBER, true);
    for (const dx of blocks) {
      const bottom = floor(x + dx, z + dz) - .08, pedestal = bottom + .42;
      art.box(at(dx, (bottom + pedestal) / 2, dz), [.49, pedestal - bottom, .48], '#9d937d', true);
      art.box(at(dx, pedestal - .027, dz), [.56, .09, .53], TRIM);
      art.box(at(dx, (postTop + pedestal) / 2, dz), [.19, postTop - pedestal, .23], TIMBER, true);
      const inward = dx > 0 ? -1 : 1;
      art.beam(at(dx, postTop - .63, dz), at(dx + inward * .77, postTop, dz), .12, DARK_TIMBER);
    }
    for (let row = 0; row < 5; row++) {
      const dzCenter = (row + .5) * 2.39 / 5;
      art.box(at(0, roofY(dzCenter) + .06, side * dzCenter), [roofLength, .15, .483 / Math.cos(pitch)],
        metalRoof[row % metalRoof.length], true, 'body', [side * pitch, 0, 0]);
      const seam = (row + 1) * 2.39 / 5;
      art.box(at(0, roofY(seam) + .152, side * seam), [roofLength + .025, .038, .075], METAL, false, 'metal', [side * pitch, 0, 0]);
    }
    art.box(at(0, eave - .04, side * 2.39), [roofLength + .08, .16, .15], DARK_TIMBER);
  }
  art.box(at(0, ridge + .165, 0), [roofLength + .12, .13, .25], garden ? PATINA : '#9a624a');
  for (const dx of blocks) {
    art.box(at(dx, roofY(1.88) - .125, 0), [.16, .15, 4.19], TIMBER);
    art.beam(at(dx, roofY(2.23) - .05, -2.23), at(dx, ridge - .05, 0), .13, TIMBER);
    art.beam(at(dx, ridge - .05, 0), at(dx, roofY(2.23) - .05, 2.23), .13, TIMBER);
  }
  for (const dx of [-1.72, 1.72]) {
    const dz = -1.04, top = floor(x + dx, z + dz) + .53;
    for (const side of [-1, 1]) {
      const bx = x + dx + side * .72, lower = floor(bx, z + dz) - .045;
      art.box([bx, (top + lower) / 2, z + dz], [.22, top - lower, .42], '#9d937d', true);
    }
    for (const offset of [-.155, 0, .155])
      art.box(at(dx, top + .06, dz + offset), [2.04, .13, .145], TIMBER, true);
    const lampZ = 1.68, lamp = roofY(lampZ) - .55;
    art.beam(at(dx, lamp + .33, lampZ), at(dx, roofY(lampZ), lampZ), .046, METAL);
    art.lantern(x + dx, lamp, z + lampZ, METAL);
  }
  const downpipeX = garden ? 3.24 : -3.24, downpipeZ = -2.28;
  const potY = floor(x + downpipeX, z + downpipeZ);
  art.cyl(at(downpipeX, potY + .49, downpipeZ), .36, 1, garden ? '#926645' : '#756b57', true);
  for (const dy of [.18, .78, .99])
    art.cyl(at(downpipeX, potY + dy, downpipeZ), .375, .073, METAL, false, 'metal');
  art.beam(at(downpipeX, potY + .98, downpipeZ + .23), at(downpipeX, eave - .03, downpipeZ + .23), .085, METAL);
  if (garden) gardenArbor(art, x, eave, z, floor);
  else marketAwning(art, x, eave, z);
  return art;
}

function gardenApron(surface: Surface) {
  const art = new SiteArt();
  const [x, , z] = homeWorld(HOME_SHELTERS.garden);
  // The arrival apron widens near the shelter and reaches the public footpath.
  for (let row = 0; row < 9; row++) {
    const west = row < 6 ? -3.42 : -1.34, east = -west;
    const z0 = z - 2.96 + row * .965, z1 = z0 + .925;
    const count = row < 6 ? 7 : 3;
    for (let col = 0; col < count; col++) {
      const dx = (east - west) / count;
      const x0 = x + west + col * dx + .018, x1 = x0 + dx - .039;
      const vertex = (px: number, pz: number): Point => [px, surface(px, pz) + .022, pz];
      face(art, [vertex(x0, z0), vertex(x0, z1), vertex(x1, z1), vertex(x1, z0)], STONE[(row * 3 + col * 11) % STONE.length], 'ground', true);
    }
  }
  art.materials.body.userData.noGroundGrime = true;
  return art;
}

function squareTreePits(surface: Surface) {
  const art = new SiteArt();
  const leaves = new THREE.IcosahedronGeometry(1, 1);
  const arbor = [
    { at: [-166, 16, 25], height: 4.6, colors: ['#819668', '#728955', '#9caa73'] },
    { at: [-145, 16, 60], height: 5.2, colors: ['#778d5d', '#879b66', '#688254'] },
    { at: [-135, 16, 52], height: 4.1, colors: ['#82935f', '#9d9d65', '#738557'] },
  ] as const;
  for (const { at, height, colors } of arbor) {
    const [x, , z] = homeWorld(at), y = surface(x, z);
    ring(art, x, z, [1.38, .20], [1.68, .20], surface, 20, i => STONE[i % STONE.length], { seam: .016, solid: true });
    ring(art, x, z, [1.68, .20], [1.68, -.03], surface, 20, () => '#a59a83', { solid: true });
    ring(art, x, z, [0, .145], [1.41, .145], surface, 24, i => i % 4 ? '#776651' : '#867258', { solid: true });
    art.cyl([x, y + 1.86, z], .23, 3.55, '#735a43', true);
    art.cyl([x, y + .26, z], .38, .24, '#80644a');
    for (const [index, dx, dz] of [[0, -1.20, .58], [1, 1.15, .47], [2, .12, -1.18]] as const) {
      art.beam([x, y + 2.35, z], [x + dx, y + height - .53, z + dz], .17, '#735a43');
      art.add(leaves, colors[index], [x + dx, y + height - .18, z + dz], [1.35, 1.29, 1.45], false, 'body', [0, index * .55, .13]);
    }
    art.add(leaves, colors[0], [x + .13, y + height + .85, z - .32], [1.54, 1.42, 1.43], false, 'body', [0, .38, -.1]);
  }
  leaves.dispose();
  return art;
}

function gardenBeds(surface: Surface) {
  const art = new SiteArt();
  const foliage = new THREE.IcosahedronGeometry(1, 0);
  const beds = [
    { at: [-117.2, 16, 114.6], flowers: ['#a16b72', '#c08278', '#ccaf79'] },
    { at: [-117.9, 16, 119.1], flowers: ['#a88d69', '#c6a979', '#ddbb84'] },
    { at: [-111.9, 16, 124.3], flowers: ['#908097', '#b29caf', '#ab8182'] },
    { at: [-99.4, 16, 106], flowers: ['#a88d69', '#c1a76b', '#ddba81'] },
  ] as const;
  for (const { at, flowers } of beds) {
    const [x, , z] = homeWorld(at);
    const atGround = (dx: number, dz: number, lift: number): Point =>
      [x + dx, surface(x + dx, z + dz) + lift, z + dz];
    face(art, [atGround(-2.02, -.71, .12), atGround(-2.02, .71, .12),
      atGround(2.02, .71, .12), atGround(2.02, -.71, .12)], '#7b654e', 'body', true);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const dx = (k - 2.5) * .70;
        art.box(atGround(dx, side * .76, .088), [.674, .245, .24], STONE[k % STONE.length], true);
      }
      art.box(atGround(side * 2.11, 0, .09), [.23, .25, 1.65], '#b1a18a', true);
    }
    for (let k = 0; k < 7; k++) {
      const dx = (k - 3) * .51, dz = k % 2 ? -.22 : .20;
      const height = .31 + (k * 3 % 5) * .046;
      art.add(foliage, k % 2 ? '#6b8657' : '#7c955e', atGround(dx, dz, height), [.25, .26, .31], false, 'body', [.13, k * .76, -.15]);
      art.add(foliage, flowers[k % flowers.length], atGround(dx + .057, dz - .025, height + .26), [.14, .102, .125], false, 'body', [0, k * .74, .12]);
    }
  }
  foliage.dispose();
  return art;
}

export function buildHomePublicRealm(surface: Surface): [SiteArt, string][] {
  return [
    [squarePaving(surface), 'HomeSquareStoneApron'],
    [fountain(), 'HomeSquareCisternStonework'],
    [shelter(HOME_SHELTERS.square, .30, false, surface), 'HomeSquareMarketShelter'],
    [squareTreePits(surface), 'HomeSquareTreePits'],
    [gardenApron(surface), 'HomeSouthGardenPath'],
    [shelter(HOME_SHELTERS.garden, .24, true, surface), 'HomeSouthGardenShelter'],
    [gardenBeds(surface), 'HomeSouthGardenFlowerBeds'],
  ];
}
