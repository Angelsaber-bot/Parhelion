import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

type Ground = (x: number, z: number, ceiling: number) => number | null;

/** Valley infrastructure connects the water, work and observation elevations.
 * It remains in the world before and after the associated story interactions. */
export function createValleyCivilLandscape(ground: Ground) {
  const art = new SiteArt(), timber = '#80715a', steel = '#52616a', bronze = '#b29c6d', stone = '#96988c';
  const floor = (x: number, z: number, ceiling = 45) => ground(x, z, ceiling) ?? 5;
  const p = (x: number, z: number, lift = .15): Point => [x, floor(x, z) + lift, z];
  const stairs: Point[] = [[154, floor(154, -108) + .15, -108], [154, 13.5, -148], [147, 13.5, -148],
    [147, 21.5, -108], [158, 21.5, -108], [158, 29.5, -148], [165, 29.5, -148],
    [165, 38, -108], [180, 38, -108], [190, 38, -108]];
  landscapeWalkway(art, stairs, { width: 3.4, floor: timber, edge: steel, rails: true, steps: true, supports: floor });
  // A transparent scaffold, with each landing visible from the next flight.
  // No switchback is hidden in a sealed tower or replaced by a teleport.
  for (const [x, top, z] of [[147, 21.5, -108], [154, 13.5, -148], [158, 29.5, -148], [165, 38, -108]] as Point[]) {
    const base = floor(x, z), h = top - base;
    art.box([x, base + h / 2, z], [.43, h, .43], steel, true);
    art.beam([x - 1.5, top - 2.4, z], [x + 1.5, top - .18, z], .19, bronze);
    art.lantern(x + 1.45, top + 1.55, z + .35);
  }
  // North high-water channel, service controls and exposed stone intake.
  for (let z = -107; z <= -82; z += 2.5) {
    const y = Math.max(floor(188, z), floor(192, z)) + .2;
    art.box([191, y, z], [2.5, .3, 2.55], stone);
    art.box([191, y + .2, z], [1.8, .025, 2.53], '#6c9c9c');
    for (const side of [-1, 1]) art.box([191 + side * 1.16, y + .3, z], [.2, .5, 2.55], steel);
  }
  const crest: Point[] = [[190, 38, -108], [198, 37, -108], p(204, -96, .5), p(203, -80, .5),
    p(202, -61, .5), p(204, -40, .5), p(215, -24, .5), p(227, -8, .5), p(235, 10, .5), p(225, 30, .2)];
  landscapeWalkway(art, crest, { width: 3.4, floor: timber, edge: steel, rails: true, steps: true, supports: floor });
  const intakeY = floor(186, -81) + .2;
  art.box([186, intakeY + 1.05, -81], [1.5, 2.1, 1], steel, true);
  art.ring([186, intakeY + 1.4, -80.4], .55, .065, bronze);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    art.beam([186, intakeY + 1.4, -80.4], [186 + Math.cos(a) * .51, intakeY + 1.4 + Math.sin(a) * .51, -80.4], .04, bronze);
  }
  const terrace: Point[] = [p(134, -73), p(146, -80), p(146, -96), stairs[0]];
  landscapeWalkway(art, terrace, { width: 3.4, floor: stone, edge: steel, rails: true, supports: floor,
    railOpenings: [{ p: terrace[1], radius: 3.6 }] });
  // Lower water channel is visible below the upper channel, with measuring
  // marks and a refuge beside the existing waterfall cave entrance.
  const lowerY = floor(148, -72, 8) + .15;
  landscapeWalkway(art, [terrace[1], [148, lowerY, -74.8]], { width: 3, floor: timber, edge: steel });
  art.box([148, lowerY - .16, -72], [6, .32, 6], stone, true);
  for (const x of [145.3, 150.7]) art.box([x, lowerY + 2.1, -74.6], [.16, 4.2, .16], steel, true);
  art.box([148, lowerY + 4.2, -73.7], [6.2, .2, 2.4], timber, true, 'body', [.08, 0, 0]);
  for (let i = 0; i < 9; i++) art.box([150.6, lowerY + .35 + i * .28, -74.5], [.32, .05, .04], bronze);
  art.box([146, lowerY + .45, -74], [1.5, .9, .7], timber, true);
  art.lantern(150.7, lowerY + 2.8, -74.3);

  // Short, bent freight railway alongside the northern frozen inlet. It does
  // not turn the region boundary into a flat rectangular train station.
  const rail: Point[] = [];
  for (let i = 0; i <= 40; i++) {
    const z = -215 - i * 1.8, x = -90 - 2.8 * Math.sin(i / 40 * Math.PI);
    rail.push(p(x, z, .16));
  }
  landscapeWalkway(art, rail, { width: 3.2, floor: '#7e837d', edge: steel });
  for (let i = 1; i < rail.length; i++) {
    const a = rail[i - 1], b = rail[i];
    for (const side of [-1, 1]) art.beam([a[0] + side * .7, a[1] + .08, a[2]], [b[0] + side * .7, b[1] + .08, b[2]], .1, steel);
    art.box([b[0], b[1], b[2]], [2.3, .12, .23], timber);
  }
  for (const end of [rail[0], rail[rail.length - 1]]) {
    art.box([end[0], end[1] + .6, end[2]], [2.2, .22, .24], steel, true);
    for (const side of [-1, 1]) art.beam([end[0] + side * .8, end[1], end[2] + 1], [end[0] + side * .8, end[1] + .6, end[2]], .16, timber);
  }
  const yardY = Math.max(floor(-105, -260), floor(-105, -270), floor(-97, -260), floor(-97, -270)) + .2;
  art.box([-101, yardY - .45, -265], [11, .9, 14], stone, true);
  landscapeWalkway(art, [p(-91, -252), [-96, yardY, -258], [-101, yardY, -258]], { width: 3.2, floor: timber, edge: bronze });
  landscapeWalkway(art, [[-101, yardY, -272], p(-94, -280)], { width: 3.2, floor: timber, edge: bronze });
  for (const z of [-270.8, -259.2]) for (const x of [-105.7, -96.3]) art.box([x, yardY + 2, z], [.25, 4, .25], timber, true);
  art.box([-105.7, yardY + 1.6, -265], [.22, 3.2, 12], timber, true);
  art.box([-101, yardY + 4.1, -265], [10.6, .2, 13.2], '#a0aaa5', true, 'body', [0, 0, -.09]);
  for (const z of [-269, -261]) {
    art.box([-104.2, yardY + .48, z], [1.6, .96, 2], timber, true);
    art.box([-104.2, yardY + 1, z], [1.65, .1, 2.05], bronze);
  }
  art.box([-101, yardY + .95, -270], [3.8, .18, 1.2], steel, true);
  art.paper(-101, yardY + 1.06, -270, 1.3, .8);
  art.lantern(-104.9, yardY + 2.8, -264);
  for (let i = 0; i < 6; i++) {
    const z = -251 - i * 5, y = floor(-112, z);
    art.box([-112, y + 1.1, z], [.3, 2.2, 4.5], '#808b87', true, 'body', [0, .08 * (i % 2 ? 1 : -1), 0]);
    art.box([-112, y + 2.23, z], [.55, .12, 4.5], '#c9d0c6');
  }
  const geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose());
  const collider: Collider = { name: 'COL_ValleyCivilLandscape', bvh: new MeshBVH(geometry), enabled: true };
  art.finish('alpha'); art.root.name = 'ValleyFallsAndNorthernFreight';
  return { root: art.root, collider,
    update(player: THREE.Vector3) { art.root.visible = Math.abs(player.x) < 520 && Math.abs(player.z) < 520 && player.y < 125; },
    dispose() {
      collider.enabled = false; geometry.dispose(); for (const mesh of art.layers.values()) mesh.geometry.dispose();
      for (const material of Object.values(art.materials)) material.dispose(); art.root.removeFromParent();
    },
  };
}
