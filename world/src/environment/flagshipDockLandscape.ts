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
  for (const u of [-15, -5, 5, 15]) for (const v of [-20, -14]) {
    box(u, v, -1, .55, 30, .55, dark);
    box(u, v, 14.6, .64, 1.3, .64, wood);
    beam([u, -20, 4.2], [u, -14, 13.6], .28, dark);
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
  // Upper lifting gantry, pulleys and cable drums give the dock a distinct silhouette.
  for (const u of [-13, 13]) {
    box(u, -19.5, 18.9, .7, 10, .7, dark);
    beam([u, -19.5, 23.9], [u, -6.5, 23.9], .55, dark, true);
    beam([u, -19.5, 18], [u, -7, 23.9], .25, iron);
    art.ring(P(u, -7.2, 23.4), .55, .09, iron, 'metal', [Math.PI / 2, SHIP_INTERIOR.yaw, 0]);
    beam([u, -7.2, 23.3], [u, -7.2, 9.4], .075, rope);
    box(u, -7.2, 9.3, .6, .9, .6, iron, false);
    box(u, -18, 14.5, 2.5, 1, 1.8, dark);
    art.cyl(P(u, -18, 15.2), .55, 1.3, wood, true, 'body', [Math.PI / 2, SHIP_INTERIOR.yaw, 0]);
    art.ring(P(u - .8, -18, 15.2), .65, .09, iron, 'metal', [Math.PI / 2, SHIP_INTERIOR.yaw, 0]);
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
