import { SiteArt } from '../story/campaignSites';
import type { GatePoint } from '../story/kingdomGate';

/** Undershot street mill. The masonry race and the two bearing caps are fixed;
 * only the axle, wheel and buckets rotate around the shared bearing centre. */
export function buildKingdomMill(site: SiteArt, [x, floorY, approachZ]: GatePoint, floor: (x: number, z: number, ceiling: number) => number | null) {
  const timber = '#79543c', oak = '#a17b50', stone = '#897e6c', iron = '#525956';
  const z = approachZ - 1.65, axleY = floorY + 1.12;
  const waterY = floorY + .22;
  for (const side of [-1, 1]) {
    const bank = z + side * .56, bottom = (floor(x, bank, floorY + .35) ?? floorY) - .06;
    site.box([x, (bottom + waterY + .10) / 2, bank], [3.35, waterY + .10 - bottom, .18], stone, true);
    site.box([x, (waterY + axleY) / 2, bank], [.25, axleY - waterY, .23], timber);
    for (const dx of [-.54, .54]) site.beam([x + dx, waterY + .08, bank], [x, axleY - .09, bank], .12, oak);
    site.box([x, axleY, bank], [.32, .25, .32], iron);
  }
  site.box([x, waterY - .035, z], [3.35, .07, .96], '#658e91');
  // Raised headwater discharges through the open notch at the upstream end.
  site.box([x - 1.44, waterY + .16, z], [.42, .32, .95], stone);
  site.box([x - 1.44, waterY + .33, z], [.44, .025, .80], '#779ba0');
  site.box([x - 1.21, waterY + .16, z], [.045, .32, .78], '#89adb0');
  const rotor = new SiteArt();
  for (const side of [-1, 1]) {
    rotor.ring([0, 0, side * .34], .82, .07, timber, 'body');
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 4, dx = .82 * Math.cos(a), dy = .82 * Math.sin(a);
      rotor.beam([-dx, -dy, side * .34], [dx, dy, side * .34], .075, oak);
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    rotor.box([.86 * Math.cos(a), .86 * Math.sin(a), 0], [.16, .16, .80], oak, false, 'body', [0, 0, a]);
  }
  rotor.cyl([0, 0, 0], .12, 1.58, iron, false, 'metal', [Math.PI / 2, 0, 0]);
  rotor.cyl([0, 0, 0], .22, .79, timber, false, 'body', [Math.PI / 2, 0, 0]);
  rotor.finish('britain');
  rotor.root.name = 'KingdomStreetMillRotor';
  rotor.root.position.set(x, axleY, z);
  site.root.add(rotor.root);
  return rotor.root;
}
