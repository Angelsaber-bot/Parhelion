import * as THREE from 'three';
import { T } from '../geo';
import { Frame } from './craft';
import type { ORLEANS_BUILDING_FAMILIES } from './landscape';

type Point = [number, number, number];
type HouseFamily = (typeof ORLEANS_BUILDING_FAMILIES)[number];
const sheave = new THREE.CylinderGeometry(1, 1, 1, 12).rotateZ(Math.PI / 2);
const loaf = new THREE.IcosahedronGeometry(1, 0);
const oak = '#926d47', darkOak = '#634b37', iron = '#49515a', stone = '#b9ae91';
const canvas = '#d6c8a5', slate = '#687d83';

/** Complete each house's existing trade bay in its local street-facing frame. */
export function buildOrleansShopfront(f: Frame, family: HouseFamily, width: number, bayCenter: number) {
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string) =>
    f.box(x, y, z, w, h, d, color, false);
  const beam = (a: Point, b: Point, size: number, color: string) => f.beam(a, b, size, color);
  function prop(shape: THREE.BufferGeometry, x: number, y: number, z: number,
    w: number, h: number, d: number, tint: string) {
    const p = f.point(x, y, z);
    f.b.add(shape, tint, T(p.x, p.y, p.z, f.a, w, h, d), false);
  }

  if (family === 'river-merchant') {
    // Cover the exposed ends of the jettied balcony with two pegged oak knees and return rails.
    for (const side of [-1, 1]) {
      const x = side * width * .31;
      box(x, 3.78, .18, .24, 1.5, .32, darkOak);
      beam([x, 3.28, .20], [x, 4.52, 1.64], .20, oak);
      box(x, 4.50, .9, .25, .22, 1.72, darkOak);
      box(x, 5.75, .9, .12, .12, 1.6, oak);
      box(x, 5.23, .34, .12, .96, .13, darkOak);
    }
  } else if (family === 'stone-arcade') {
    // A drop leaf opens inside the stone arcade. The baker can trade through the left bay.
    const x = -width * .30;
    for (const dx of [-.93, .93]) {
      box(x + dx, .81, .50, .11, .59, .16, darkOak);
      beam([x + dx, .65, .5], [x + dx, 1.02, 1.32], .105, oak);
    }
    box(x, 1.07, .95, 2.24, .12, 1, oak);
    box(x, 1.17, .52, 2.20, .12, .07, darkOak);
    for (const dx of [-.72, -.04, .67])
      prop(loaf, x + dx, 1.24, .93, .37, .18, .24, '#c79856');
    box(x, 1.2, 1.4, 2.20, .13, .07, darkOak);
  } else if (family === 'harbour-warehouse') {
    // Complete the hoist already on the loading loft: bearings straddle the rope, a cargo
    // sling hangs off the returning block, and every hanging part clears the front passage.
    const jib = 3.1;
    for (const side of [-1, 1]) {
      box(side * .20, 8.25, jib, .075, .66, .42, darkOak);
      box(side * .15, 5.80, jib, .08, .55, .35, oak);
    }
    for (const y of [8.16, 5.81])
      prop(sheave, 0, y, jib, .31, .24, .24, iron);
    beam([0, 8.16, jib + .21], [0, 5.80, jib + .21], .045, canvas);
    for (const z of [jib - .21, jib + .21]) beam([0, 5.62, jib], [0, 5.16, z], .055, canvas);
    beam([0, 5.16, jib - .21], [0, 5.16, jib + .21], .065, iron);
  } else if (family === 'narrow-street-house') {
    // The upper drying rack clears the low front window and the public doorway.
    const x = width * .28;
    for (const dx of [-1.01, 1.01]) {
      beam([x + dx, 7.31, .2], [x + dx, 7.60, 1.05], .085, darkOak);
      beam([x + dx, 7.60, .13], [x + dx, 7.60, 1.05], .085, oak);
    }
    box(x, 7.61, .98, 2.12, .085, .085, oak);
    for (const [dx, drop, tint] of [[-.5, .75, canvas], [.43, .58, slate]] as const) {
      box(x + dx, 7.63 - drop / 2, .98, .68, drop, .07, tint);
      box(x + dx, 7.66, .98, .68, .055, .16, tint);
    }
  } else if (family === 'artisan-workshop') {
    // A two-jaw press and its horizontal screw seat on the existing joiner's bench.
    const x = bayCenter;
    box(x, 2.16, 1.32, 1.16, .12, .64, darkOak);
    for (const dx of [-.34, .34]) box(x + dx, 2.41, 1.32, .15, .46, .59, oak);
    beam([x - .40, 2.39, 1.32], [x + .76, 2.39, 1.32], .10, iron);
    beam([x + .7, 2.19, 1.17], [x + .7, 2.59, 1.47], .06, darkOak);
    box(x, 2.49, 1.32, .50, .22, .72, canvas);
  } else if (family === 'oriel-corner-house') {
    // The three projecting lights share a stone sill seated on stepped corbels.
    const x = -width * .20;
    for (const dx of [-1.39, 0, 1.39]) {
      box(x + dx, 3.64, .30, .33, 1.08, .68, stone);
      box(x + dx, 3.98, .73, .41, .43, 1.46, stone);
      beam([x + dx, 3.35, .25], [x + dx, 4.19, 1.65], .19, darkOak);
    }
    box(x, 4.20, 1.25, 3.32, .12, 2.30, darkOak);
  }
}
