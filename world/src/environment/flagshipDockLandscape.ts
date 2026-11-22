import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { flagshipPoint as P, SHIP_INTERIOR } from '../map/shipInteriorCut';
import { landscapeWalkway } from './landscapeWalkway';

/** Fixed harbor lifting works beside the flagship. The lower catch-net and
 * two return flights make the exterior a traversable space, not a death pit.
 * Hoist/release mission state is deliberately not inferred from visiting it. */
export function createFlagshipDockLandscape() {
  const art = new SiteArt(), wood = '#7c6047', dark = '#493b30', iron = '#566364', rope = '#b3a17c';
  const rot: [number, number, number] = [0, SHIP_INTERIOR.yaw, 0];
  const box = (u: number, v: number, y: number, w: number, h: number, d: number, color: string, solid = true) =>
    art.box(P(u, v, y), [w, h, d], color, solid, 'body', rot);
  const beam = (a: [number, number, number], b: [number, number, number], width: number, color = dark, solid = false) =>
    art.beam(P(...a), P(...b), width, color, solid);
  const route = (points: [number, number, number][], width = 3, rails = true) => landscapeWalkway(art, points.map(p => P(...p)),
    { width, floor: wood, edge: rope, steps: true, rails });

  // Port-side working floor is outside the original hull and its cannon line.
  box(0, -17, 13.84, 8, .32, 32, wood);
  for (const u of [-15, -5, 5, 15]) {
    for (const v of [-20, -14]) {
      box(u, v, -1, .55, 30, .55, dark);
      box(u, v, 14.6, .64, 1.3, .64, wood);
    }
    beam([u, -20, 4.2], [u, -14, 13.6], .28, dark);
    box(u, -17, 13.52, 7.3, .38, .46, dark, false);
  }
  // The deck rim has deliberate openings for the return stairs and ship bridge.
  for (const v of [-20.8, -13.2]) {
    const spans = v === -13.2 ? [[-16, -10], [-6, 6], [10, 16]] : [[-16, 16]];
    for (const [a, b] of spans) {
      beam([a, v, 15.05], [b, v, 15.05], .14, rope, true);
      beam([a, v, 14.5], [b, v, 14.5], .1, rope, true);
    }
  }
  for (let u = -15; u <= 15; u += 1) box(u, -17, 14.014, 7.9, .028, .04, dark, false);
  // The long flight follows the hull before crossing its rail at an open hatch head.
  // The articulated maintenance gangway is owned by flagshipNavigation.

  // Catch-net rests well above the water and stays outside the hull's port skin.
  const net = [[-17, -23, 4.6], [17, -23, 4.6], [17, -11, 4.6], [-17, -11, 4.6]] as const;
  const vertices = [0, 1, 2, 0, 2, 3].flatMap(i => P(net[i][0], net[i][1], net[i][2]));
  const surface = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  // Ship-local (u,v) maps with an upward-facing winding for these four corners.
  surface.computeVertexNormals(); art.solids.push(surface);
  for (let u = -17; u <= 17; u += 1) beam([u, -23, 4.6], [u, -11, 4.6], .075, rope);
  for (let v = -23; v <= -11; v += 1) beam([-17, v, 4.6], [17, v, 4.6], .075, rope);
  for (const u of [-17, 17]) {
    beam([u, -23, 4.6], [u, -11, 4.6], .22, dark, true);
    for (const v of [-23, -11]) beam([u, v, 4.6], [u * .88, v < -17 ? -20 : -14, 13.7], .075, rope);
  }
  for (const v of [-23, -11]) beam([-17, v, 4.6], [17, v, 4.6], .22, dark, true);
  // Two rising flights return from the net; no teleport or narrow vertical ladder.
  route([[-14, -18, 4.6], [-26, -18, 8], [-26, -12, 8], [-14, -12, 14], [-8, -13, 14]], 2.6);
  route([[14, -21, 4.6], [28, -21, 9], [28, -16, 9], [15, -16, 14]], 2.6);
  box(-14, -18, 4.45, 4, .3, 4, wood);
  box(14, -21, 4.45, 4, .3, 4, wood);
  for (const [u, v, top] of [[-26, -18, 8], [-26, -12, 8], [28, -21, 9], [28, -16, 9]] as const) {
    box(u, v, (top - 16) / 2, .5, top + 16, .5, dark);
    const anchorU = u < 0 ? -15 : 15;
    beam([u, v, top - .35], [anchorU, -17, 3], .25, dark);
  }
  // Drums and sheaves share the ship's longitudinal axle. The running line
  // leaves the drum, bends around both sheaves and descends to the lifting hook.
  const axleEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromEuler(
    new THREE.Euler(Math.PI / 2, SHIP_INTERIOR.yaw, 0, 'YXZ')));
  const axle: [number,number,number] = [axleEuler.x,axleEuler.y,axleEuler.z];
  for (const u of [-13, 13]) {
    box(u, -19.5, 18.9, .7, 10, .7, dark);
    beam([u, -19.5, 23.9], [u, -6.5, 23.9], .55, dark, true);
    beam([u, -19.5, 18], [u, -7, 23.9], .25, iron);
    box(u, -18, 14.5, 2.5, 1, 1.8, dark);
    art.cyl(P(u, -18, 15.55), .55, 1.3, wood, true, 'body', axle);
    for (const sign of [-1,1]) {
      box(u + sign*.76, -18, 15.28, .64, .58, .16, dark, false);
      art.cyl(P(u + sign*.63, -18, 15.55), .63, .09, iron, false, 'metal', axle);
    }
    art.cyl(P(u, -18, 15.55), .12, 1.96, iron, false, 'metal', axle);
    art.ring(P(u - .96, -18, 15.55), .65, .065, iron, 'metal', rot);
    for (const [dv,dy] of [[.64,0],[0,.64]]) beam([u-.96,-18-dv,15.55-dy],[u-.96,-18+dv,15.55+dy],.085,iron);
    for (const v of [-18,-7.2]) {
      art.cyl(P(u,v,22.95), .53, .2, wood, false, 'body', axle);
      art.cyl(P(u,v,22.95), .12, .7, iron, false, 'metal', axle);
      for (const sign of [-1,1]) box(u+sign*.26,v,23.33,.18,.92,.1,iron,false);
    }
    const line: [number,number][] = [[-18.55,15.55],[-18.55,22.95],[-18.389,23.339],[-18,23.5],
      [-7.2,23.5],[-6.811,23.339],[-6.65,22.95],[-6.65,9.52]];
    for (let i=1;i<line.length;i++) beam([u,...line[i-1]],[u,...line[i]],.075,rope);
    box(u,-6.65,9.36,.38,.36,.38,iron,false);
    beam([u,-6.65,9.2],[u,-6.65,8.72],.12,iron);
    beam([u,-6.65,8.72],[u,-6.4,8.62],.12,iron);
    beam([u,-6.4,8.62],[u,-6.23,8.87],.12,iron);
    art.lantern(...P(u, -19.5, 17.4));
  }
  beam([-13, -19.5, 23.9], [13, -19.5, 23.9], .55, dark, true);
  for (const u of [-7, 1, 9]) {
    box(u, -19, 14.5, 1.6, 1, 2.1, wood);
    box(u, -19, 15.02, 1.65, .08, 2.15, iron, false);
  }
  art.finish('blacksail'); art.root.name = 'FlagshipExteriorLiftingDock';
  const geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose()); art.solids.length = 0;
  const collider: Collider = { name: 'COL_FlagshipExteriorLiftingDock', bvh: new MeshBVH(geometry), enabled: true };
  const markers: Marker[] = [
    { id: 'disc_flagship_lifting_dock', type: 'discovery', label: '旗舰外侧吊装台', p: P(0, -16, 14), radius: 4, note: '绞盘台、船舷和下方承接网由两段楼梯相连' },
  ];
  return { root: art.root, collider, markers,
    update(player: THREE.Vector3) { const c = P(0, 0, 7); art.root.visible = Math.hypot(player.x - c[0], player.z - c[2]) < 400 && player.y < 140; },
    dispose() { collider.enabled = false; geometry.dispose(); for (const layer of art.layers.values()) layer.geometry.dispose(); for (const material of Object.values(art.materials)) material.dispose(); art.root.removeFromParent(); },
  };
}
