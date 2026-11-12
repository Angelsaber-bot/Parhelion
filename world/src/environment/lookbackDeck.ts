import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { mergeParts } from '../settlements/merge';
import { SiteArt } from '../story/campaignSites';

export function createLookbackDeck(id: 'North' | 'South', start: number, end: number, z: number, ground: (x: number) => number) {
  const deck = new SiteArt();
  const width = 2.45;
  const height = Math.max(...[start + 1.6, start + 3.8, end - 1.6].map(ground)) + .22;
  const points = [
    new THREE.Vector3(start, ground(start) - .04, z),
    new THREE.Vector3(start + 1.55, height, z),
    new THREE.Vector3(end - 1.55, height, z),
    new THREE.Vector3(end, ground(end) - .04, z),
  ];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1], to = points[i];
    const delta = to.clone().sub(from), center = from.clone().lerp(to, .5);
    const length = delta.length();
    const tilt = Math.atan2(delta.y, delta.x);
    const surface = new THREE.PlaneGeometry(length + .04, width).rotateX(-Math.PI / 2).rotateZ(tilt).translate(center.x, center.y, z);
    deck.solids.push(surface.toNonIndexed());
    surface.dispose();
    const count = Math.ceil(length / .32);
    for (let plank = 0; plank < count; plank++) {
      const point = from.clone().lerp(to, (plank + .5) / count);
      deck.box([point.x, point.y - .074, z], [length / count - .018, .145, width], plank % 3 === 0 ? '#8b7662' : '#ac9274', false, 'body', [0, 0, tilt]);
    }
    for (const side of [-1, 1]) {
      const railZ = z + side * (width / 2 - .08);
      deck.box([center.x, center.y + .84, railZ], [length, .12, .12], '#77614c', true, 'body', [0, 0, tilt]);
      deck.box([center.x, center.y + .44, railZ], [length, .08, .09], '#647b72', false, 'metal', [0, 0, tilt]);
      for (const fraction of [.08, .92]) {
        const point = from.clone().lerp(to, fraction);
        deck.box([point.x, point.y + .43, railZ], [.13, .89, .14], '#77614c', true);
      }
    }
  }
  deck.finish('alpha');
  deck.root.name = `Lookback${id}Deck`;
  const geometry = mergeParts(deck.solids);
  deck.solids.forEach(solid => solid.dispose());
  const collider: Collider = { name: `COL_Lookback${id}Deck`, bvh: new MeshBVH(geometry), enabled: false };
  return {
    root: deck.root, collider,
    lower(fraction: number, active: boolean) {
      deck.root.position.y = 1.3 * (1 - THREE.MathUtils.smoothstep(fraction, 0, 1));
      collider.enabled = active && fraction >= 1;
    },
    dispose() {
      collider.enabled = false;
      deck.root.removeFromParent();
      for (const mesh of deck.layers.values()) mesh.geometry.dispose();
      Object.values(deck.materials).forEach(material => material.dispose());
      geometry.dispose();
    },
  };
}
