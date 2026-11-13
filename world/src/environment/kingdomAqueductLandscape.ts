import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

type Ground = (x: number, z: number, ceiling: number) => number | null;

/** The abandoned watercourse is a continuous return path between the Camelot
 * approach and Camlann, with open arches that preserve the lower landscape. */
export function createKingdomAqueductLandscape(ground: Ground) {
  const art = new SiteArt(), stone = '#9c9984', pale = '#bcb299', moss = '#6d7d5f', timber = '#75604a';
  const floor = (x: number, z: number) => ground(x - 720, z, 22) ?? 7;
  const route: Point[] = [[-120, floor(-120, -70) + .15, -70], [-151, 13.2, -30], [-151, 13.2, 20],
    [-170, 13.8, 60], [-176, 14.2, 105], [-154, 12.8, 144], [-120, floor(-120, 184) + .15, 184]];
  landscapeWalkway(art, route, { width: 4.6, floor: stone, edge: pale, rails: true, steps: true,
    railOpenings: [{ p: [-151, 13.2, -30], radius: 4.5 }, { p: [-153.2, 13.2, 12], radius: 3.6 }, { p: [-176, 14.2, 105], radius: 4.6 }] });
  for (let i = 1; i < route.length; i++) {
    const a = new THREE.Vector3(...route[i - 1]), b = new THREE.Vector3(...route[i]);
    const direction = b.clone().sub(a), run = Math.hypot(direction.x, direction.z);
    const dx = direction.x / run, dz = direction.z / run, yaw = -Math.atan2(dz, dx);
    for (let distance = 5; distance < run - 4; distance += 9) {
      const p = a.clone().lerp(b, distance / run), base = floor(p.x, p.z), height = p.y - base;
      if (height < 4.8) {
        art.box([p.x, base + height / 2 - .12, p.z], [4.4, Math.max(.3, height), 1.4], stone, true, 'body', [0, Math.atan2(dx, dz), 0]);
        continue;
      }
      const radius = Math.min(3.4, height - 2), spring = p.y - .5 - radius, inner = radius - .65;
      const arch = new THREE.Shape();
      arch.moveTo(radius, 0);
      for (let n = 0; n <= 18; n++) { const t = n / 18 * Math.PI; arch.lineTo(Math.cos(t) * radius, Math.sin(t) * radius); }
      arch.lineTo(-inner, 0);
      for (let n = 18; n >= 0; n--) { const t = n / 18 * Math.PI; arch.lineTo(Math.cos(t) * inner, Math.sin(t) * inner); }
      arch.closePath();
      const geometry = new THREE.ExtrudeGeometry(arch, { depth: 3.8, bevelEnabled: false, steps: 1 });
      geometry.translate(0, 0, -1.9);
      art.add(geometry, stone, [p.x, spring, p.z], [1, 1, 1], true, 'body', [0, yaw, 0]); geometry.dispose();
      for (const side of [-1, 1]) {
        const x = p.x + dx * side * (radius - .325), z = p.z + dz * side * (radius - .325), bottom = floor(x, z) - .2;
        art.box([x, (spring + bottom) / 2, z], [.7, Math.max(.3, spring - bottom), 3.8], stone, true, 'body', [0, yaw, 0]);
        art.box([x, bottom + .32, z], [1.1, .64, 4.3], moss, true, 'body', [0, yaw, 0]);
      }
      for (let n = 1; n < 8; n++) {
        const t = n / 8 * Math.PI;
        const x = p.x + dx * Math.cos(t) * (radius - .3), z = p.z + dz * Math.cos(t) * (radius - .3);
        art.box([x - dz * 1.93, spring + Math.sin(t) * (radius - .3), z + dx * 1.93], [.06, .65, .04], pale, false, 'body', [0, yaw, t - Math.PI / 2]);
      }
    }
  }
  // A widened inspection refuge has open entries at both ends. Its sightline
  // faces the lake; the castle silhouette remains visible over the return route.
  art.box([-155.5, 13.03, 12], [5.8, .34, 9], stone, true);
  for (const z of [8.2, 15.8]) {
    art.box([-157.4, 14.6, z], [.23, 3.2, .23], timber, true);
    art.box([-153.6, 14.6, z], [.23, 3.2, .23], timber, true);
  }
  art.box([-155.5, 16.4, 12], [5.1, .2, 9.1], '#6c7164', true, 'body', [0, 0, -.08]);
  art.box([-156.8, 13.7, 12], [.9, 1, 3.8], timber, true);
  art.paper(-156.8, 14.23, 12, .7, 1.1);
  art.lantern(-157.2, 15.3, 10.2);
  // A flight down beside the arches connects the lower battlefield approach.
  landscapeWalkway(art, [[-176, 14.2, 105], [-186, 14.2, 105], [-186, 10.2, 124],
    [-180, 10.2, 128], [-169, floor(-169, 146) + .15, 146]],
    { width: 3, floor: timber, edge: pale, rails: true, steps: true, supports: floor });
  const frame = new THREE.Matrix4().makeTranslation(-720, 0, 0); art.relocate(frame);
  const geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose());
  const collider: Collider = { name: 'COL_KingdomOldAqueduct', bvh: new MeshBVH(geometry), enabled: true };
  art.finish('britain'); art.root.name = 'KingdomOldAqueductReturn';
  return { root: art.root, collider,
    update(player: THREE.Vector3) { art.root.visible = Math.hypot(player.x + 875, player.z - 50) < 430 && player.y < 125; },
    dispose() {
      collider.enabled = false; geometry.dispose(); for (const mesh of art.layers.values()) mesh.geometry.dispose();
      for (const material of Object.values(art.materials)) material.dispose(); art.root.removeFromParent();
    },
  };
}
