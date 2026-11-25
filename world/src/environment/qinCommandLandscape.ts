import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { QIN_OFFSET, qinToWorld } from '../map/qinPlan';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { landscapeWalkway, type LandscapePoint } from './landscapeWalkway';

export const QIN_COMMAND_RETURN = 'map_qin_command_return';
export const QIN_COMMAND_PATHS: LandscapePoint[][] = [
  [[34, 10, -198], [25, 10, -198], [19, 10, -198], [19, 10, -211], [6, 10, -211]],
  [[-7, 10, -220], [-10, 10, -220], [-120.5, 28, -220], [-125, 28, -220], [-125, 28, -164], [-125, 28, -115]],
  [[-61, 28, -156], [-80, 28, -156], [-86, 28, -156], [-86, 28, -164], [-125, 28, -164]],
];

/** Furnishes the generated rooms; the generator, rather than an overlaid ramp,
 * cuts their doors and the return passage through the actual mountain. */
export function createQinCommandLandscape() {
  const root = new THREE.Group(), colliders: Collider[] = [], arts: SiteArt[] = [];
  root.name = 'QinCommandHallAndQuietRoom';
  const frame = new THREE.Matrix4().makeRotationY(Math.PI); frame.setPosition(QIN_OFFSET[0], 0, QIN_OFFSET[1]);
  const clay = '#a77657', stone = '#888a7c', bronze = '#ad8c4f', wood = '#554638', red = '#773e34';
  function finish(a: SiteArt, name: string) {
    a.relocate(frame); a.finish('alpha'); a.root.name = name; root.add(a.root); arts.push(a);
    const geo = mergeParts(a.solids); a.solids.forEach(g => g.dispose()); a.solids.length = 0;
    const collider: Collider = { name, bvh: new MeshBVH(geo), enabled: true }; colliders.push(collider); return collider;
  }
  const art = new SiteArt();
  // The command table is an operating place at human height, surrounded by
  // full-width aisles. Seals follow the model river instead of a throne pedestal.
  for (const x of [3.35, 8.65]) {
    art.box([x, 10.11, -229], [.55, .22, 3.8], stone, true);
    for (const sz of [-1, 1]) {
      art.beam([x, 10.20, -229 + sz * 1.52], [x, 11.05, -229 + sz * 1.15], .25, wood, true);
    }
    art.box([x, 11.02, -229], [.43, .22, 3.85], red, true);
  }
  art.box([6, 10.5, -229], [5.9, .2, .2], wood, true);
  for (const x of [3.35, 8.65])
    art.box([x, 10.5, -229], [.24, .18, 2.95], wood);
  art.box([6, 11.15, -229], [7, .21, 4], wood, true);
  art.box([6, 11.25, -229], [7.2, .1, 4.2], bronze);
  art.box([6, 11.305, -229], [6.8, .03, 3.82], '#796248');
  for (let n = 0; n < 12; n++) {
    art.box([3.1 + n * .53, 11.34, -229], [.51, .08, 3.56], n % 4 === 1 ? '#baa985' : '#c3b38d');
  }
  // The bronze watercourse and clay ridge give the table a topographic relief.
  const river = [[2.98, -229.7], [3.95, -229.44], [5.1, -229.65], [6.22, -229.15], [7.4, -229.3], [8.93, -228.58]];
  for (let i = 1; i < river.length; i++)
    art.beam([river[i - 1][0], 11.39, river[i - 1][1]], [river[i][0], 11.39, river[i][1]], .083, '#4d786c', false, 'metal');
  const ridge = new THREE.IcosahedronGeometry(1);
  for (const [dx, dz, height, width] of [[-1.94, .85, .35, .88], [-1.12, .93, .52, .73], [-.52, 1.16, .31, .58], [1.44, -1.15, .28, .75]]) {
    art.add(ridge, '#a57957', [6 + dx, 11.38, -229 + dz], [width, height, .43]);
  }
  ridge.dispose();
  for (const [px, pz] of [[3.65, -229.05], [5.2, -230.15], [6.53, -228.65], [8.0, -229.93]]) {
    art.box([px, 11.43, pz], [.3, .1, .32], red);
    art.box([px, 11.51, pz], [.13, .09, .17], bronze, false, 'metal');
  }
  // A pair of notched, flaring arms transfers roof weight from the tie beams
  // into each red column. The profile is extruded once and shared by all capitals.
  const bracketProfile = new THREE.Shape();
  bracketProfile.moveTo(-.43, 0);
  for (const [bx, by] of [[.43, 0], [.7, .18], [.96, .18], [1.12, .38], [1.41, .38],
    [1.41, .6], [-1.41, .6], [-1.41, .38], [-1.12, .38], [-.96, .18], [-.7, .18]])
    bracketProfile.lineTo(bx, by);
  bracketProfile.closePath();
  const bracket = new THREE.ExtrudeGeometry(bracketProfile, { depth: .56, bevelEnabled: false }).translate(0, 0, -.28);
  for (const x of [-6, 18]) for (const z of [-216, -236]) {
    art.box([x, 15.2, z], [.7, 10.4, .7], red, true);
    art.box([x, 10.19, z], [1.15, .38, 1.15], stone, true);
    art.box([x, 18.92, z], [.81, .19, .81], bronze);
    art.box([x, 20.28, z], [1.19, .36, 1.19], '#61413b');
    art.add(bracket, wood, [x, 20.42, z]);
    art.add(bracket, red, [x, 20.83, z], [1, 1, 1], false, 'body', [0, Math.PI / 2, 0]);
    for (const sign of [-1, 1]) {
      art.box([x + sign * 1.15, 21.19, z], [.52, .37, .69], red);
      art.box([x + sign * 1.15, 21.37, z], [.63, .11, .77], bronze, false, 'metal');
    }
    art.beam([x, 13.87, z], [x, 13.87, z + .7], .1, wood);
    art.beam([x, 13.87, z + .7], [x, 13.33, z + .7], .035, bronze);
    art.lantern(x, 13, z + .7, bronze);
  }
  bracket.dispose();
  // The outer tie beams key into the excavated walls. Rising webs connect the
  // lower chords to the roof saddles; there is no column in the processional aisle.
  for (const z of [-216, -236]) {
    art.box([6, 21.62, z], [32.2, .46, .7], wood);
    art.box([6, 22.81, z], [32.2, .44, .83], wood);
    for (let x = -9; x < 21; x += 6) {
      art.beam([x, 22.76, z], [x + 3, 21.81, z], .2, red);
      art.beam([x + 3, 21.81, z], [x + 6, 22.76, z], .2, red);
    }
  }
  for (const x of [-6, 18]) art.box([x, 22.14, -226], [.54, .65, 20.7], wood);
  // Two stair flights meet an overhead workshop beam. It gives a continuous
  // flanking route above the processional floor, with both ends on the same hall.
  const beam: LandscapePoint[] = [[-4, 10, -214], [-4, 14.6, -231], [-4, 14.6, -238], [15, 14.6, -238], [15, 14.6, -231], [15, 10, -214]];
  landscapeWalkway(art, beam, { width: 2.8, floor: wood, edge: bronze, rails: true, steps: true, continuousCorners: true,
    railOpenings: beam.map(p => ({ p, radius: 2 })) });
  // Two trestles carry the northern transverse platform. The braces live under
  // the deck, leaving the hall's east–west access from the landing untouched.
  for (const x of [1, 10]) {
    for (const z of [-239.04, -236.96]) {
      art.box([x, 10.16, z], [.66, .32, .66], stone, true);
      art.box([x, 12.32, z], [.32, 4.1, .32], wood, true);
    }
    art.box([x, 14.37, -238], [.44, .34, 2.75], red, true);
    art.beam([x, 10.5, -238.97], [x, 14.18, -237.01], .19, wood, true);
  }
  for (const x of [-2, 12]) {
    art.box([x, 10.6, -219], [2.5, 1.2, 1.3], clay, true);
    art.box([x, 11.26, -219], [2.7, .12, 1.4], stone);
  }
  for (const x of [-6.5, 18.5]) for (const z of [-225, -230]) {
    art.box([x, 10.4, z], [.8, .8, 2.2], wood, true);
    for (let n = 0; n < 7; n++) art.box([x, 10.86, z - .84 + n * .28], [.65, .12, .18], '#bb9c70');
  }
  // Rest room: sleeping shelves, absent workers' shoes, an unfinished figure
  // and an open workbench. The diagonal entrance-to-exit route stays clear.
  for (const z of [-155, -160, -167]) {
    for (const dx of [-1.3, 1.3]) for (const dz of [-.82, .82]) {
      art.box([-92.5 + dx, 28.28, z + dz], [.19, .56, .19], wood, true);
    }
    art.box([-92.5, 28.61, z], [3.2, .18, 2.1], wood, true);
    art.box([-92.5, 28.75, z], [2.9, .1, 1.9], '#9b9c7c');
    for (const dx of [-1.12, 1.12]) art.box([-92.5 + dx, 28.806, z], [.06, .017, 1.88], '#6d7657');
    art.box([-93.4, 28.9, z], [.7, .2, 1.5], '#bdad89');
    for (const dz of [-.2, .2]) art.box([-90.45, 28.08, z + dz], [.5, .16, .22], '#4c4237');
  }
  art.box([-80, 28.48, -169.5], [3.8, .96, 1.7], wood, true);
  art.paper(-80, 29, -169.5, 1.2, .75);
  for (const x of [-80.8, -80.2, -79.6]) art.beam([x, 29.02, -170], [x + .15, 29.02, -169.4], .06, bronze);
  art.box([-80, 28.75, -152.2], [2.1, 1.5, 1.3], clay, true);
  art.cyl([-80, 29.7, -152.2], .35, .5, clay);
  for (const z of [-153, -171]) art.lantern(-86, 31, z, bronze);
  art.box([-7.3, 10.5, -217.2], [.5, 1, .5], bronze, true);
  art.ring([-7.3, 11.2, -217.2], .32, .06, bronze);
  for (const z of [-222.01, -217.99]) {
    art.box([-10.76, 12.14, z], [.25, 4.28, .16], wood, true);
    art.box([-11.22, 12.14, z], [.22, 4.28, .16], wood, true);
  }
  art.box([-10.98, 14.37, -220], [.73, .33, 4.18], wood, true);
  art.beam([-7.3, 10.97, -217.2], [-7.3, 14.35, -217.2], .075, bronze);
  art.beam([-7.3, 14.35, -217.2], [-10.98, 14.35, -218.1], .075, bronze);
  finish(art, 'COL_QinCommandFurnishings');
  const gate = new SiteArt();
  gate.box([-11, 12, -220], [.3, 4, 4.15], bronze, true);
  for (const z of [-221.4, -220.7, -220, -219.3, -218.6]) gate.box([-10.8, 12, z], [.13, 3.8, .16], wood);
  const gateCollider = finish(gate, 'COL_QinCommandReturnGate');
  const at = (x: number, y: number, z: number): [number, number, number] => { const [wx, wz] = qinToWorld(x, z); return [wx, y, wz]; };
  const markers: Marker[] = [
    { id: QIN_COMMAND_RETURN, p: at(-7.3, 11, -217.2), label: '统御厅 · 从内侧打开工道回路', type: 'interact', radius: 2.3 },
    { id: 'disc_qin_quiet_room', p: at(-86, 28, -162), label: '没有军令的静室', type: 'discovery', radius: 5, note: '两扇门把军阵西侧与采石场工道连成环路，床铺旁留着工人的鞋。' },
    { id: 'disc_qin_command_hall', p: at(6, 10, -221), label: '中枢统御厅', type: 'discovery', radius: 5, note: '军令案上仍是工人的尺度，横梁可以从两端登上，西门通向外层检修工道。' },
  ];
  return { root, colliders, markers,
    apply(done: ReadonlySet<string>) {
      const open = done.has(QIN_COMMAND_RETURN);
      gateCollider.enabled = !open; gate.root.position.y = open ? 4 : 0;
    },
    update(p: THREE.Vector3) { const [x, z] = qinToWorld(-40, -180); root.visible = Math.hypot(p.x - x, p.z - z) < 260 && p.y < 100; },
    dispose() { colliders.forEach(c => { c.enabled = false; c.bvh.geometry.dispose(); }); for (const a of arts) { a.layers.forEach(m => m.geometry.dispose()); Object.values(a.materials).forEach(m => m.dispose()); } root.removeFromParent(); },
  };
}
