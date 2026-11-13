import * as THREE from 'three';
import { SiteArt } from '../story/campaignSites';

type Point = [number, number, number];
export interface CrownDeck { p: Point; w: number; d: number; }
type Decks = Record<'dock' | 'range' | 'hall' | 'anchor' | 'light' | 'service' | 'throat' | 'archive' | 'back' | 'court', CrownDeck>;
const C = { steel: '#293f52', plate: '#bfc6bc', edge: '#d4b881', blue: '#4c677c', dark: '#1c2b39', warm: '#e6b469', teal: '#76c6b1', cloth: '#7f6275' };

/** The crown is one working instrument: ribs, supply trunks and maintenance rooms
 * join its platforms. All small fittings are batched; only usable cover collides.
 * Broad central paths and every existing interaction socket remain unobstructed. */
export function addSkyCrownArchitecture(a: SiteArt, decks: Decks) {
  const at = (deck: CrownDeck, x: number, y: number, z: number): Point => [deck.p[0] + x, deck.p[1] + y, deck.p[2] + z];
  function box(d: CrownDeck, x: number, y: number, z: number, w: number, h: number, depth: number, color = C.steel, solid = false) {
    a.box(at(d, x, y, z), [w, h, depth], color, solid);
  }
  function arc(p: Point, radius: number, start: number, end: number, thick: number, color: string, tilt = 0) {
    const steps = Math.max(12, Math.ceil(Math.abs(end - start) * radius / 3.8));
    const points: Point[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = start + (end - start) * i / steps;
      points.push([p[0] + Math.cos(t) * radius, p[1] + Math.sin(t) * radius * Math.cos(tilt), p[2] + Math.sin(t) * radius * Math.sin(tilt)]);
    }
    for (let i = 1; i < points.length; i++) a.beam(points[i - 1], points[i], thick, color, false, 'metal');
  }
  function bench(d: CrownDeck, x: number, z: number, length = 3.8) {
    box(d, x, .52, z, length, .2, .65, C.plate, true);
    box(d, x, .93, z - .31, length, .64, .12, C.blue);
    for (const sign of [-1, 1]) box(d, x + sign * (length / 2 - .35), .24, z, .16, .48, .6, C.steel, true);
  }
  function cabinet(d: CrownDeck, x: number, z: number, color: string, panels = 3) {
    box(d, x, 1.15, z, 1.2 * panels, 2.3, .72, C.steel, true);
    for (let n = 0; n < panels; n++) {
      const px = x + (n - (panels - 1) / 2) * 1.2;
      box(d, px, 1.18, z + .38, 1.09, 2.12, .06, color);
      box(d, px + .39, 1.08, z + .43, .045, .4, .06, C.edge);
      for (let j = 0; j < 5; j++) box(d, px, .45 + j * .09, z + .43, .72, .025, .03, C.dark);
      a.box(at(d, px - .27, 1.92, z + .44), [.14, .065, .02], C.warm, false, 'glow');
    }
  }
  function console(d: CrownDeck, x: number, z: number, color: string) {
    box(d, x, .54, z, 3.4, 1.08, 1.05, C.blue, true);
    a.box(at(d, x, 1.16, z), [3.6, .15, 1.3], C.plate, false, 'body', [-.18, 0, 0]);
    for (let n = 0; n < 3; n++) {
      box(d, x - 1.12 + n * 1.12, 1.56, z - .44, .94, .66, .14, C.dark);
      a.box(at(d, x - 1.12 + n * 1.12, 1.56, z - .35), [.78, .49, .025], color, false, 'glow');
      for (let k = 0; k < 4; k++) box(d, x - 1.43 + n * 1.12 + k * .21, 1.28, z + .28, .09, .06, .1, C.edge);
    }
  }
  function canopy(d: CrownDeck, x: number, z: number, w: number, depth: number, height: number) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(d, x + sx * (w / 2 - .25), height / 2, z + sz * (depth / 2 - .25), .26, height, .26, C.steel, true);
      a.beam(at(d, x + sx * (w / 2 - .25), height - 1.5, z + sz * (depth / 2 - .25)),
        at(d, x + sx * (w / 2 - 1.8), height, z + sz * (depth / 2 - .25)), .16, C.edge);
    }
    for (let i = 0; i < 8; i++) {
      const px = x + (i - 3.5) * w / 8;
      a.box(at(d, px, height + .6 * Math.cos((i - 3.5) / 4), z), [w / 8 + .08, .18, depth + .9],
        i === 2 ? '#8e9b99' : C.plate, false, 'body', [0, 0, -.15 * Math.sin((i - 3.5) / 4)]);
    }
    for (const sign of [-1, 1]) a.beam(at(d, x - w / 2, height, z + sign * depth / 2), at(d, x + w / 2, height, z + sign * depth / 2), .23, C.steel);
  }
  function enclosure(d: CrownDeck, x: number, z: number, width: number, depth: number, height: number, door = 5, sideDoorOffset = 0) {
    // Four open doorways preserve circulation around the instrument desks.
    // The windows are actual openings with sills and mullions, not painted walls.
    for (const axis of [0, 1]) for (const side of [-1, 1]) {
      const length = axis === 0 ? width : depth, opening = axis === 0 ? 0 : sideDoorOffset;
      const face = (offset: number, y: number, w: number, h: number, thickness: number, color: string, solid = false) =>
        box(d, axis === 0 ? x + offset : x + side * width / 2, y, axis === 0 ? z + side * depth / 2 : z + offset,
          axis === 0 ? w : thickness, h, axis === 0 ? thickness : w, color, solid);
      for (const end of [-1, 1]) {
        const inner = opening + end * door / 2, outer = end * length / 2;
        const span = Math.abs(outer - inner), center = (inner + outer) / 2;
        if (span < .01) continue;
        face(center, .65, span, 1.3, .32, C.blue, true);
        face(center, height - 1, span, 2, .32, C.plate, true);
        face(center, 1.35, span + .1, .15, .45, C.edge);
        const posts = Math.ceil(span / 3);
        for (let i = 0; i <= posts; i++) face(inner + end * i * span / posts, height / 2, .18, height, .38, C.steel, true);
        face(center, height / 2, span, .13, .19, C.edge);
      }
      face(opening, height - .4, door, .8, .45, C.plate, true);
    }
  }

  // An incomplete armillary cage makes a single recognisable silhouette from the valley.
  // It stays above walking layers and behind the boss rather than masking enemy tells.
  const instrument: Point = [220, 264, 158];
  arc(instrument, 57, -.16, Math.PI + .1, .86, C.plate, .28);
  arc(instrument, 49, -.35, Math.PI + .22, .38, C.edge, -.36);
  arc(instrument, 41, .2, Math.PI - .25, 1.25, C.steel, .42);
  for (let i = 0; i < 18; i++) {
    const theta = .08 + i * (Math.PI - .16) / 17;
    const r = 56;
    const p: Point = [instrument[0] + Math.cos(theta) * r, instrument[1] + Math.sin(theta) * r * Math.cos(.28), instrument[2] + Math.sin(theta) * r * Math.sin(.28)];
    a.box(p, [.32, i % 3 ? 1.8 : 3.1, .5], C.edge, false, 'metal', [0, 0, theta - Math.PI / 2]);
    // Porcelain-clad instrument sectors give the crown a readable engineered
    // mass. Calibration gaps remain open instead of filling its viewing aperture.
    if (i % 5 !== 2) a.box(p, [7.6, 1.45, 4.8], i % 3 ? C.plate : C.blue, false, 'body', [.28, 0, theta + Math.PI / 2]);
  }
  for (const side of [-1, 1]) {
    a.beam([220 + side * 55, 263, 158], [220 + side * 30, 224, 132], 1.2, C.steel);
    a.beam([220 + side * 30, 224, 132], [220 + side * 28, 208, 145], .7, C.plate);
  }

  // The decks are carried by a connected instrument chassis. Lower triangular
  // ribs and longitudinal service trunks link the rooms into one building.
  const chassis: [CrownDeck, CrownDeck][] = [[decks.dock, decks.range], [decks.range, decks.hall],
    [decks.anchor, decks.hall], [decks.hall, decks.light], [decks.hall, decks.service],
    [decks.service, decks.archive], [decks.service, decks.throat], [decks.light, decks.throat],
    [decks.throat, decks.back], [decks.back, decks.court]];
  for (const [first, last] of chassis) {
    const start: Point = [first.p[0], first.p[1] - 3, first.p[2]];
    const end: Point = [last.p[0], last.p[1] - 3, last.p[2]];
    const dx = end[0] - start[0], dz = end[2] - start[2], run = Math.hypot(dx, dz);
    const side: Point = [dz / run * 2.5, 0, -dx / run * 2.5];
    const lowerStart: Point = [start[0], start[1] - 7.5, start[2]];
    const lowerEnd: Point = [end[0], end[1] - 7.5, end[2]];
    a.beam(lowerStart, lowerEnd, .85, C.steel);
    for (const sign of [-1, 1]) {
      const upperStart: Point = [start[0] + side[0] * sign, start[1], start[2] + side[2] * sign];
      const upperEnd: Point = [end[0] + side[0] * sign, end[1], end[2] + side[2] * sign];
      a.beam(upperStart, upperEnd, .56, C.plate);
      const sections = Math.max(2, Math.ceil(run / 13));
      for (let i = 0; i < sections; i++) {
        const t = i / sections, t1 = (i + .5) / sections, t2 = (i + 1) / sections;
        const lower: Point = [start[0] + dx * t1, start[1] + (end[1] - start[1]) * t1 - 7.5, start[2] + dz * t1];
        for (const u of [t, t2]) a.beam([upperStart[0] + dx * u,
          start[1] + (end[1] - start[1]) * u, upperStart[2] + dz * u], lower, .28, C.blue);
      }
    }
  }
  // Pale service lanes, segmented perimeter cladding and exposed under-deck
  // housings make each room read as part of the same maintained instrument.
  for (const d of Object.values(decks)) {
    box(d, 0, .025, 0, Math.max(8, d.w - 10), .05, 5.2, C.plate);
    for (const side of [-1, 1]) {
      box(d, 0, .06, side * 2.8, Math.max(8, d.w - 10), .035, .13, C.edge);
      const count = Math.floor(d.w / 5);
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * 4.8;
        box(d, x, -1.4, side * (d.d / 2 - .35), 4.35, 1.9, .42, i % 4 ? C.plate : C.blue);
      }
    }
    for (const side of [-1, 1]) box(d, side * d.w * .28, -3.4, 0, 4.5, 4.8, d.d * .55, C.blue);
  }

  // A: docking collar, recycled winches, shield rails and an open-front arrival shelter.
  const dock = decks.dock;
  canopy(dock, -11, 0, 12, 16, 5.3);
  bench(dock, -12, -5.3, 6);
  cabinet(dock, -16, 4.5, C.blue, 2);
  for (const side of [-1, 1]) {
    const x = side * 17;
    box(dock, x, .46, 9.5, 3.5, .92, 2.5, C.blue, true);
    for (const dx of [-.85, .85]) a.cyl(at(dock, x + dx, 1.25, 9.5), .61, .15, C.edge, false, 'metal', [0, 0, Math.PI / 2]);
    a.cyl(at(dock, x, 1.25, 9.5), .39, 1.8, '#665e52', false, 'body', [0, 0, Math.PI / 2]);
    a.beam(at(dock, x, 1.5, 10), at(dock, x, -.6, 17), .07, C.edge);
    for (let i = 0; i < 4; i++) {
      box(dock, side * (10 + i * 2), 1.1, 12.6, 1.55, 1.8, .18, i % 2 ? C.plate : C.blue, true);
      box(dock, side * (10 + i * 2), 1.12, 12.72, .12, 1.38, .06, C.edge);
    }
  }

  // B: a visibly mechanical rangefinder with fixed calibration ticks and low hard cover.
  const range = decks.range;
  for (const sx of [-1, 1]) {
    box(range, sx * 13, .65, -1, 5.6, 1.3, 1.3, C.blue, true);
    box(range, sx * 13, 1.34, -1, 5.8, .12, 1.5, C.plate);
    box(range, sx * 19, 3.4, -10, .65, 6.8, .65, C.steel, true);
    arc(at(range, sx * 19, 5.7, -10), 2.4, 0, Math.PI * 2, .14, C.edge);
    a.beam(at(range, sx * 19 - 1.7, 5.7, -10), at(range, sx * 19 + 1.7, 5.7, -10), .09, C.plate);
  }
  for (let i = 0; i < 11; i++) box(range, (i - 5) * 2.3, .035, 8, .1, .025, i % 5 ? .6 : 1.2, C.edge);

  // C: a roofed observation hall with open circulation and paired recorded/live desks.
  const hall = decks.hall;
  canopy(hall, 0, -7, 35, 21, 9.4);
  // Align side doors with the deck's crosswalk, south of the telescope axis.
  enclosure(hall, 0, -7, 35, 21, 8.8, 7, 7);
  // Observatory crown: a segmented porcelain dome, open sighting slit and
  // raised optical tube. It is visible from the arrival deck and valley floor.
  const dome = new THREE.SphereGeometry(8.7, 32, 12, .16, Math.PI * 2 - .32, 0, Math.PI / 2);
  a.add(dome, C.plate, at(hall, 0, 9.8, -7), [1, .65, 1], true); dome.dispose();
  a.ring(at(hall, 0, 9.8, -7), 8.8, .24, C.steel, 'metal', [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const theta = i * Math.PI / 4;
    a.beam(at(hall, Math.cos(theta) * 8.6, 9.8, -7 + Math.sin(theta) * 8.6), at(hall, 0, 15.4, -7), .12, C.edge);
  }
  a.cyl(at(hall, 0, 16, -7), .7, 1.8, C.steel, true);
  a.cyl(at(hall, 0, 17.3, -7), .56, 6.5, C.blue, false, 'body', [Math.PI / 2 - .5, 0, 0]);
  a.ring(at(hall, 0, 18.85, -4.15), .61, .1, C.edge, 'metal', [-.5, 0, 0]);
  for (const side of [-1, 1]) {
    console(hall, side * 11, -10, side < 0 ? '#b28f62' : C.teal);
    bench(hall, side * 12, -1, 5);
    box(hall, side * 16, 3.7, -13, .5, 7.4, 5.2, C.blue, true);
    for (let n = 0; n < 4; n++) box(hall, side * 16, 2 + n * 1.3, -9.9, .62, .18, .5, C.edge);
  }
  cabinet(hall, -11, -16.3, C.plate, 4);
  // A physically framed window is kept transparent: the actual valley remains visible.
  box(hall, 8, 1.1, -16.8, 12, .3, .5, C.plate);
  box(hall, 8, 6.2, -16.8, 12, .3, .5, C.plate);
  for (const x of [2, 8, 14]) box(hall, x, 3.6, -16.8, .16, 5.2, .24, C.edge);

  // D: storm anchors show bearings, tension cables and the original rescue stretcher.
  const anchor = decks.anchor;
  for (const side of [-1, 1]) {
    box(anchor, side * 15, .6, -9, 5, 1.2, 3.8, C.blue, true);
    a.cyl(at(anchor, side * 15, 2.1, -9), 1.5, 1.4, C.edge, false, 'metal', [Math.PI / 2, 0, 0]);
    a.beam(at(anchor, side * 15, 2.1, -9), at(anchor, side * 18, 8, -13), .35, C.steel);
    a.beam(at(anchor, side * 18, 8, -13), at(anchor, side * 12, 12, -15), .25, C.edge);
    a.beam(at(anchor, side * 12, 12, -15), at(anchor, side * 12, 1.6, -15), .045, C.edge);
    a.box(at(anchor, side * 12 + .7, 10.9, -15), [1.4, .7, .035], C.cloth);
  }
  box(anchor, -8, .6, 3, 1.2, .12, 2.7, C.cloth, true);
  for (const sign of [-1, 1]) a.beam(at(anchor, -8 + sign * .64, .62, 1.2), at(anchor, -8 + sign * .64, .62, 4.8), .09, C.edge);

  // E: large optical fins create alternating sun and shadow, with readable firing lanes.
  const light = decks.light;
  for (let i = 0; i < 6; i++) {
    const x = -26 + i * 10;
    box(light, x, 4.7, -9.5, .65, 9.4, 2.2, C.steel, true);
    a.box(at(light, x + 1.8, 6.5, -8), [4.1, 7.4, .27], i % 2 ? C.plate : C.blue, false, 'body', [0, -.48, .12]);
    a.beam(at(light, x, 2, -9.5), at(light, x + 2.9, 8.4, -8), .18, C.edge);
    if (i % 2 === 0) box(light, x, .6, 5.5, 3, 1.2, 1.2, C.blue, true);
  }

  // F: a warm maintenance workshop, with two visibly separate feed trunks.
  const service = decks.service;
  canopy(service, -14, -4.5, 15, 15, 5.6);
  enclosure(service, -14, -4.5, 15, 15, 5.3, 4.5);
  for (const x of [-18.5, -9.5]) {
    box(service, x, 6.7, -8, 2.1, 2.4, 3, C.blue);
    for (let i = 0; i < 6; i++) box(service, x, 5.8 + i * .28, -6.46, 1.6, .08, .05, C.edge);
  }
  cabinet(service, -18, -9.3, C.blue, 3);
  bench(service, -18, 1.1);
  box(service, -12, .85, -7, 4.8, .2, 1.5, C.plate, true);
  for (const x of [-13.5, -10.5]) box(service, x, .4, -7, .2, .8, 1.2, C.steel, true);
  for (const z of [-11.5, 11.5]) {
    a.beam(at(service, -23, 2.8, z), at(service, 23, 2.8, z), .34, z < 0 ? C.teal : C.edge);
    for (let x = -20; x <= 20; x += 8) {
      box(service, x, 1.5, z, .14, 3, .14, C.steel, true);
      for (const dx of [-.22, .22]) a.ring(at(service, x + dx, 2.8, z), .24, .045, C.plate, 'metal', [0, Math.PI / 2, 0]);
    }
  }
  for (const x of [-20, -8, 12]) a.lantern(...at(service, x, 3.9, -9.2));

  // G: distribution machinery surrounds the work floor rather than occupying it.
  const throat = decks.throat;
  for (const side of [-1, 1]) {
    box(throat, side * 20, 4.5, -6, 3, 9, 8, C.blue, true);
    for (let n = 0; n < 4; n++) {
      box(throat, side * 20, 1.2 + n * 2, -1.9, 2.6, 1.3, .12, C.plate);
      a.ring(at(throat, side * 20, 1.2 + n * 2, -1.8), .4, .06, C.edge);
    }
    a.beam(at(throat, side * 20, 9.4, -6), at(throat, side * 11, 13.8, -6), .7, C.steel);
    a.beam(at(throat, side * 11, 13.8, -6), at(throat, 0, 13.8, -6), .7, C.plate);
    for (const z of [8, 12]) {
      a.cyl(at(throat, side * 19, 2.7, z), 1.05, 5.4, side < 0 ? C.teal : C.edge, true, 'metal');
      for (const y of [1, 4.6]) a.ring(at(throat, side * 19, y, z), 1.13, .13, C.steel, 'metal', [Math.PI / 2, 0, 0]);
    }
  }

  // H: the unreturned duty room is a human-scale alcove beside the record equipment.
  const archive = decks.archive;
  canopy(archive, 0, 0, 28, 19, 5.2);
  enclosure(archive, 0, 0, 28, 19, 4.9, 6.4);
  cabinet(archive, -8, -7, C.plate, 4);
  cabinet(archive, 8, -7, C.blue, 3);
  console(archive, -8, -3, C.warm);
  bench(archive, 8, 5, 5);
  box(archive, 8, .76, 1, 3.2, .17, 1.5, '#84745e', true);
  a.paper(...at(archive, 8, .86, 1), 1.1, .74);
  a.cyl(at(archive, 8.9, 1.02, 1), .12, .26, C.plate);
  a.lantern(...at(archive, 10, 2.2, 1));
  for (const side of [-1, 1]) box(archive, side * 13.5, 1.1, -1, .24, 2.2, 10, C.blue, true);

  // I: a downward sighting balcony, left open to the town and its lights.
  const back = decks.back;
  box(back, 13, .6, 5, 5, 1.2, 1.1, C.blue, true);
  a.cyl(at(back, 13, 1.7, 5), .17, 1.1, C.edge);
  a.cyl(at(back, 13, 2.35, 5.5), .22, 1.8, C.plate, false, 'body', [Math.PI / 2 - .4, 0, 0]);
  a.ring(at(back, 13, 1.97, 6.32), .23, .05, C.edge);
  bench(back, -12, 5, 4.5);

  // J: low camp furniture leaves a quiet, unobstructed view of the final arena.
  const court = decks.court;
  canopy(court, 6.7, -9, 10, 9, 4.6);
  bench(court, 7, -8, 5);
  cabinet(court, 9, -2, C.plate, 2);
  for (const x of [-8, 10]) {
    box(court, x, .43, 4, 2.1, .86, 1.5, C.blue, true);
    box(court, x, .9, 4, 2.2, .12, 1.6, C.edge);
  }
  a.lantern(...at(court, 7, 3.6, -8));
}
