import * as THREE from 'three';
import type { SiteArt } from '../story/campaignSites';

type Point = [number, number, number];
type Roof = (x: number) => number;
const SNOW = ['#d3dce1', '#e0e7e9', '#e8edeb', '#ccd7de'] as const;
const GRANITE = ['#a4a5a0', '#b2b3ac', '#979c9d', '#babcb6', '#a9ada9'] as const;
const BRICK = ['#977965', '#9b806c', '#aa8c76', '#8f7668', '#a07e6a'] as const;
const BEAM = '#514a43';
const AGED_WOOD = '#73675a';
const IRON = '#505b61';

function surface(art: SiteArt, points: Point[], color: string) {
  const [a, b, c, d] = points;
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  art.add(g, color, [0, 0, 0], undefined, false, 'ground');
  g.dispose();
}

/** Roof snow gathers at the intact eave; the riven side shows the underlying boards through it. */
export function dressWinterSchool(art: SiteArt, y: number) {
  const pitch = .197, slope = Math.tan(pitch);
  const roof: Roof = x => y + 5.72 + slope * (x - 12.2) + .13 / Math.cos(pitch);
  const cross = (x0: number, x1: number, z0: number, z1: number, rise: number, color: string) => {
    surface(art, [[x0,roof(x0)+rise,z0], [x0,roof(x0)+rise,z1], [x1,roof(x1)+rise,z1], [x1,roof(x1)+rise,z0]], color);
  };
  const wear = [.76, .32, .91, .54, 1.25, .43, .67, 1.43, .84, .53, 1.07, .35] as const;
  for (let row = 0; row < wear.length; row++) {
    const z0 = -99.48 + row * 1.245;
    const z1 = z0 + 1.245;
    const exposed = 17.55 - wear[row];
    cross(6.94, exposed, z0, z1, .021, SNOW[(row * 7 + 1) % SNOW.length]);
    cross(exposed, exposed + .33, z0, z1, .015, SNOW[0]);
    // Low exposed battens continue from the jagged snow edge to the torn ridge.
    const x = (exposed + 17.54) / 2;
    art.box([x, roof(x) + .028, z0 + .13], [(17.54 - exposed) / Math.cos(pitch), .051, .064], '#60564c', false, 'body', [0, 0, pitch]);
  }
  art.box([6.875, roof(6.875) - .095, -92], [.17, .23, 15.14], BEAM);
  art.box([6.855, roof(6.855) + .02, -92], [.21, .075, 15], SNOW[1]);

  // Two real door openings retain their original clear widths. Brick appears at feet, jambs and burnt eaves.
  for (const face of [-1, 1]) {
    const z = face < 0 ? -99.32 : -84.68;
    for (const [start, end] of [[7.36, 13.02], [20.00, 28.64]] as const) {
      for (let line = 0; line < 3; line++) {
        const course = y + .18 + line * .232;
        for (let x = start + (line % 2) * .27; x < end - .21; x += .56) {
          const width = Math.min(.535, end - x);
          const mask = Math.floor((x - start) * 1.7) + line * 3;
          if (line === 2 && mask % 4 !== 1 && mask % 4 !== 2) continue;
          art.box([x + width / 2, course, z], [width, .207, .073], BRICK[(mask * 3 + 2) % BRICK.length]);
        }
      }
    }
    // Preserve the dark upper threshold beneath the restored cap and iron joinery.
    art.box([16.5, y + 3.23, z + face * .04], [7.05, .23, .18], AGED_WOOD);
    for (const x of [13.20, 19.80]) for (const h of [1.22, 2.61]) {
      art.box([x, y + h, z + face * .11], [.36, .16, .11], IRON, false, 'metal');
      art.cyl([x, y + h, z + face * .18], .044, .045, '#817c70', false, 'metal', [Math.PI / 2, 0, 0]);
    }
  }
  // Burnt plank infill remains on the east wall between the window bays.
  for (const z of [-98, -94, -90, -86]) {
    const x = 29.315;
    for (let i = 0; i < 5; i++) {
      const dz = (i - 2) * .178;
      const h = .99 + ((i * 7 + Math.floor(-z)) % 4) * .115;
      art.box([x, y + 2.9 - h / 2, z + dz], [.074, h, .156], i % 2 ? '#61534b' : '#736458');
    }
    art.box([x + .047, y + 2.55, z], [.055, .115, 1.02], '#4f4944');
  }

  // The infirmary sheds meltwater through an outer gutter; strips and drip edge sit on its original pitch.
  const awning: Roof = x => y + 3.3 - (x - 25.2) * Math.tan(.06) + .075 / Math.cos(.06);
  for (let i = 0; i < 8; i++) {
    const z = -84.61 + .82 * i;
    art.box([25.2, awning(25.2) + .033, z], [7.92, .05, .056], IRON, false, 'metal', [0, 0, -.06]);
    const x = 25.2 + (i % 3 - 1) * .28;
    art.box([x, awning(x) + .023, z + .19], [5.8 + (i % 3) * .34, .035, .3], SNOW[i % SNOW.length], false, 'body', [0, 0, -.06]);
  }
  art.box([29.18, awning(29.18) - .10, -81.5], [.17, .19, 6.46], IRON, false, 'metal');
}

/** Hand-set stone and scattered snow tiling add depth above the square's flat walk surface. */
export function dressWinterCustoms(art: SiteArt, y: number, upper: number) {
  const stone = (x0: number, x1: number, z0: number, z1: number, rise: number, color: string) =>
    surface(art, [[x0,y+rise,z0], [x0,y+rise,z1], [x1,y+rise,z1], [x1,y+rise,z0]], color);
  for (const [lane, center] of [231, 259].entries()) {
    for (let row = 0; row < 4; row++) {
      const z = center - 2.11 + row * 1.075;
      for (let col = 0; col < 21; col++) {
        const x = -95.19 + col * 2.085 + (row % 2) * .42;
        const width = Math.min(-51.07 - x, 2.035);
        if (width < .1) continue;
        const colors = (col + row * 3 + lane) % 7 <= 1 ? SNOW : GRANITE;
        stone(x, x + width, z, z + 1.032, .037, colors[(col * 3 + row + lane) % colors.length]);
      }
    }
  }
  // The north threshold extends the joinery beside both established traffic lines.
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
    const x = -75.81 + col * 1.86 + (row % 2) * .09, z = 226.32 + row * .93;
    stone(x, x + 1.81, z, z + .889, .019, GRANITE[(row * 4 + col) % GRANITE.length]);
  }

  for (const side of [-1, 1]) {
    const x = -98 + side * 6.053;
    for (let col = 0; col < 19; col++) {
      const z = 233.07 + col * 1.315;
      art.box([x, y + .43, z], [.124, .36, 1.274], GRANITE[col % GRANITE.length]);
    }
    for (const z of [235.7, 243.1, 250.2, 255.7]) {
      // Closed loading shutters are inset into a load-bearing wall bay. Doors are at the gable ends.
      art.box([x + side * .056, y + 2.37, z], [.12, 1.69, 2.59], BEAM);
      for (let slat = 0; slat < 8; slat++) {
        const color = slat % 3 === 0 ? '#746b61' : '#87796b';
        art.box([x + side * .12, y + 2.38, z + (slat - 3.5) * .285], [.11, 1.38, .258], color);
      }
      for (const h of [1.88, 2.88]) art.box([x + side * .187, y + h, z], [.041, .104, 2.32], IRON, false, 'metal');
      art.box([x + side * .172, y + 1.54, z], [.34, .14, 2.76], '#817569');
      art.box([x + side * .198, y + 1.626, z], [.26, .044, 2.68], SNOW[0]);
    }
    // Snow and cap pieces stay outside the inner footway and the existing rails.
    for (let col = 0; col < 12; col++) {
      const z = 232.81 + col * 2.16;
      const width = .51 + (col * 5 % 4) * .04;
      art.box([-98 + side * (6.4 - width / 2), upper + .032, z], [width, .064, 2.13], SNOW[col % 4]);
    }
    art.box([-98 + side * 6.40, upper - .185, 245], [.10, .19, 26.55], BEAM);
  }
  // Stone cover reads as courses tied to the snow-capped body rather than a new obstacle.
  for (const x of [-89, -59]) for (const z of [234, 256]) for (const side of [-1, 1]) {
    for (let course = 0; course < 3; course++) {
      for (let block = 0; block < 6; block++) {
        const cx = x - 2.02 + block * .78 + (course % 2) * .11;
        art.box([cx, y + .21 + course * .34, z + side * .69], [.75, .31, .078], GRANITE[(block * 3 + course) % GRANITE.length]);
      }
    }
  }
}

/** Bents carry the repaired inner walk strip down into the existing ice at each individual foot. */
export function braceWinterPedestrianStrip(art: SiteArt, deck: number, ground: (x: number, z: number, ceiling: number) => number | null) {
  const top = deck - .26, southZ = 229.16, northZ = 226.84;
  for (const x of [-9.8, -4.7, .55]) {
    const south = ground(x, southZ, top - .09), north = ground(x, northZ, top - .09);
    if (north === null || south === null || top - Math.min(north, south) > 3 || Math.max(north, south) >= top - .14) continue;
    for (const [z, foot] of [[northZ, north], [southZ, south]]) {
      const bottom = foot - .075;
      art.box([x, (top + bottom) / 2, z], [.27, top - bottom, .29], '#766451', true);
      art.box([x, foot + .1, z], [.34, .27, .35], '#594f47');
    }
    art.box([x, top - .035, 228], [.42, .20, southZ - northZ + .39], BEAM, true);
    art.beam([x, north + .26, northZ], [x, top - .09, southZ], .15, '#6e5c4b', true);
    for (const z of [northZ, southZ]) {
      art.box([x, top - .28, z], [.29, .11, .32], IRON, false, 'metal');
    }
  }
}
