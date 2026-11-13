import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { QIN_OFFSET } from '../map/qinPlan';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

/** A real upper route within the star dome. Both stairs return to the existing
 * west/east aisles; the silver rivers, pit doors and floor procession stay open. */
export function createQinSurveyGallery() {
  const art = new SiteArt(), bronze = '#a9905d', dark = '#544b3e', stone = '#8f9587', red = '#864c3e';
  const route: Point[] = [[34.2, 10.04, -190], [34.2, 13.5, -178], [38, 16.1, -165],
    [45, 16.1, -163], [55, 16.1, -162], [65, 16.1, -164], [73, 13.4, -178], [73, 10.04, -192]];
  landscapeWalkway(art, route, { width: 2.8, floor: stone, edge: bronze, rails: true, steps: true, supports: () => 10,
    railOpenings: [{ p: [51, 16.1, -163.5], radius: 4.3 }] });
  // Broad observation bay on the inside of the gallery faces the river relief.
  art.box([51, 15.92, -164.5], [12, .36, 5.6], stone, true);
  for (let i = 0; i < 10; i++) {
    const x = 45.6 + i * 1.2;
    art.box([x, 16.64, -167.2], [.12, 1.08, .12], bronze, true);
    art.box([x, 16.44, -167.2], [.8, .08, .1], dark);
  }
  art.beam([45.3, 17.18, -167.2], [56.7, 17.18, -167.2], .14, bronze, true);
  for (const x of [46, 56]) {
    art.box([x, 13, -166.1], [.38, 6, .38], red, true);
    art.beam([x, 13.6, -166.1], [x, 15.8, -163.6], .2, dark);
  }
  // Armillary sight: the player can stand beside it and look down at the army
  // and up at the existing constellations, without a wall of puzzle buttons.
  art.cyl([48, 16.63, -164.8], .72, 1.06, dark, true);
  art.cyl([48, 17.21, -164.8], .92, .13, bronze);
  for (const rotation of [[Math.PI / 2, 0, 0], [0, .5, .3], [.7, -.3, 0]] as Point[])
    art.ring([48, 18.05, -164.8], .9, .052, bronze, 'metal', rotation);
  art.beam([47.5, 17.6, -164.8], [48.5, 18.5, -164.8], .065, red);
  art.cyl([48, 18.05, -164.8], .12, .17, '#8fa397', false, 'metal');
  art.box([53.2, 16.9, -164.9], [2.4, .16, 1.2], dark, true);
  for (const side of [-1, 1]) art.box([53.2 + side * .9, 16.5, -164.9], [.15, .8, .9], bronze, true);
  for (let i = 0; i < 12; i++) {
    const x = 52.35 + i * .15;
    art.box([x, 17.01, -164.9], [.12, .06, .74], '#c2ab7a');
    art.box([x, 17.045, -164.98 + .07 * (i % 3)], [.035, .013, .18], dark);
  }
  for (const x of [44, 58]) {
    art.cyl([x, 17.1, -162.5], .08, 2, bronze, true, 'metal');
    art.cyl([x, 18.18, -162.5], .31, .17, bronze);
    art.box([x, 18.36, -162.5], [.15, .23, .15], '#e6c38b', false, 'glow');
  }
  // Gold-sheathed bridge plates cross the decorative rivers at ground level.
  // They remain low enough for the procession and keep every pit approach clear.
  for (const [x, z, yaw] of [[41, -178, 0], [55, -193, Math.PI / 2], [69, -180, 0]] as const) {
    art.box([x, 10.055, z], [4.4, .11, 2.2], bronze, true, 'metal', [0, yaw, 0]);
    for (const side of [-1, 1]) {
      const local = new THREE.Vector3(0, 0, side * 1.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      art.box([x + local.x, 10.2, z + local.z], [4.4, .18, .12], dark, false, 'body', [0, yaw, 0]);
    }
  }
  const frame = new THREE.Matrix4().makeRotationY(Math.PI); frame.setPosition(QIN_OFFSET[0], 0, QIN_OFFSET[1]);
  art.relocate(frame);
  const geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose());
  const collider: Collider = { name: 'COL_QinStarDomeSurveyGallery', bvh: new MeshBVH(geometry), enabled: true };
  art.finish('alpha'); art.root.name = 'QinStarDomeSurveyGallery';
  const center = new THREE.Vector3(55, 17, -178).applyMatrix4(frame);
  return {
    root: art.root, collider,
    update(player: THREE.Vector3) { art.root.visible = player.distanceToSquared(center) < 160 ** 2; },
    dispose() {
      collider.enabled = false; geometry.dispose(); for (const mesh of art.layers.values()) mesh.geometry.dispose();
      for (const material of Object.values(art.materials)) material.dispose(); art.root.removeFromParent();
    },
  };
}
