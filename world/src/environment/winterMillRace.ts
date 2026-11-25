import * as THREE from 'three';
import type { SiteArt } from '../story/campaignSites';
import type { LandscapePoint as Point } from './landscapeWalkway';

const STONE = ['#83898c', '#949998', '#a2a6a3', '#7b8388'] as const;
const TIMBER = '#746352';
const IRON = '#4c565d';

/** The winter sluice is shut. Its ice, bearing stands and axle make the stationary wheel part of the mill. */
export function buildFrozenMillRace(art: SiteArt, at: (x: number, y: number, z: number) => Point,
  ground: (x: number, z: number, ceiling?: number) => number | null) {
  const wheelX = -7.35, axleY = 2.69, wheelZ = -1.5, radius = 2.23;
  const bottomAt = (dx: number, dz: number) => {
    const [x, y, z] = at(dx, .74, dz);
    const level = ground(x, z, y);
    return level === null ? -.20 : Math.min(.57, level - y + .66);
  };
  for (const side of [-1, 1]) {
    const dx = wheelX + side * 1.44;
    for (let block = 0; block < 10; block++) {
      const dz = -6.40 + block * .98, bottom = bottomAt(dx, dz), cap = .65;
      art.box(at(dx, (bottom + cap) / 2, dz), [.52, cap - bottom, .955], STONE[(block + side + 1) % STONE.length], true);
      art.box(at(dx, cap + .059, dz), [.60, .118, .97], STONE[(block * 3) % STONE.length], true);
      if ((block + side + 1) % 5 < 3) art.box(at(dx, cap + .134, dz), [.54, .034, .87], '#d7e4eb');
    }
  }
  // Low ice panes hide the original terrain, with a darker seam in the centre of the race.
  for (let block = 0; block < 8; block++) {
    const z = -6.20 + block * 1.19;
    art.box(at(wheelX, .415, z), [2.49, .067, 1.19], block % 3 ? '#a5bdc9' : '#b7cbd0');
    const edge = block % 2 ? -.89 : .89;
    art.box(at(wheelX + edge, .463, z), [.44, .034, 1.04], '#d9e5ed');
  }
  // Uprights cradle both ends of the axle, and braces feed the load down to the stone courses.
  for (const side of [-1, 1]) {
    const dx = wheelX + side * 1.34;
    art.box(at(dx, (axleY + .75) / 2, wheelZ), [.39, axleY - .66, .45], TIMBER, true);
    for (const sign of [-1, 1]) art.beam(at(dx, .72, wheelZ + sign * 1.18), at(dx, axleY - .47, wheelZ), .22, '#5a5149', true);
    art.box(at(dx, axleY - .07, wheelZ), [.50, .42, .60], IRON, true, 'metal');
  }
  art.box(at(wheelX, .78, -5.80), [2.42, .68, .26], TIMBER, true);
  art.beam(at(wheelX - 1.57, 1.13, -5.8), at(wheelX + 1.57, 1.13, -5.8), .22, '#595046');
  art.beam(at(wheelX, .9, -5.82), at(wheelX, 1.82, -5.82), .09, IRON, false, 'metal');

  const rim = new THREE.TorusGeometry(radius, .125, 5, 32).rotateY(Math.PI / 2);
  const plank = new THREE.BoxGeometry(1, 1, 1);
  for (const side of [-1, 1]) {
    const dx = wheelX + side * .68;
    art.add(rim, TIMBER, at(dx, axleY, wheelZ));
    art.add(rim, IRON, at(dx + side * .10, axleY, wheelZ), [.42, 1, 1], false, 'metal');
    for (let i = 0; i < 6; i++) art.add(plank, '#776653', at(dx, axleY, wheelZ), [.16, radius * 2 - .13, .19], false, 'body', [i * Math.PI / 6, 0, 0]);
  }
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8, reach = radius - .055;
    art.add(plank, i % 3 ? TIMBER : '#867460', at(wheelX, axleY + Math.sin(angle) * reach, wheelZ + Math.cos(angle) * reach),
      [1.64, .10, .54], false, 'body', [-angle, 0, 0]);
  }
  art.cyl(at(wheelX + 2.07, axleY, wheelZ), .17, 7.12, IRON, false, 'metal', [0, 0, Math.PI / 2]);
  for (const side of [-1, 1]) art.cyl(at(wheelX + side * .80, axleY, wheelZ), .29, .24, '#5c534b', false, 'metal', [0, 0, Math.PI / 2]);
  rim.dispose(); plank.dispose();
}
