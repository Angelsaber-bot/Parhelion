import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';
import type { Collider } from '../player/player';

/** The mill fork is a place to work and recover, visible before choosing a
 * withdrawal route. Its workshop and rear door are actual walk-in spaces. */
export function createWinterMillArchitecture(north: Point, ground: (x: number, z: number, ceiling?: number) => number | null) {
  const a = new SiteArt(), root = a.root;
  const x = north[0] - 15, z = north[2] - 9;
  const y = ground(x, z, north[1] + 4) ?? north[1];
  const stone = '#8e9295', timber = '#746255', dark = '#4c4b4d', snow = '#d5e4ed', plaster = '#b6b0a1';
  const at = (dx: number, dy: number, dz: number): Point => [x + dx, y + dy, z + dz];
  const box = (dx: number, dy: number, dz: number, w: number, h: number, depth: number, color: string, solid = false) => a.box(at(dx, dy, dz), [w, h, depth], color, solid);
  box(0, -.33, 0, 11.8, .6, 14.8, stone);
  // Top-only floor preserves both flush thresholds and never adds an invisible step.
  const floor = new THREE.PlaneGeometry(11.8, 14.8).rotateX(-Math.PI / 2).translate(x, y, z);
  a.solids.push(floor.toNonIndexed()); floor.dispose();
  box(-5.6, 2.7, 0, .45, 5.4, 14.5, plaster, true);
  box(0, 2.7, -7, 11.6, 5.4, .5, plaster, true);
  // Split the front and river-facing walls around wide, visible door openings.
  for (const sign of [-1, 1]) {
    box(sign * 3.8, 2.7, 7, 4, 5.4, .5, plaster, true);
    box(5.6, 2.7, sign * 4.85, .45, 5.4, 4.8, plaster, true);
  }
  box(0, 4.6, 7, 3.6, 1.6, .5, plaster, true);
  box(5.6, 4.6, 0, .45, 1.6, 4.9, plaster, true);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * 5.6, 2.7, sz * 7, .36, 5.5, .36, dark);
  for (const height of [.6, 3.6, 5.2]) {
    box(0, height, 7.27, 11.7, .24, .12, timber);
    box(5.87, height, 0, .12, .24, 14.3, timber);
  }
  for (const side of [-1, 1]) {
    a.box(at(side * 3.1, 6.6, 0), [7.1, .2, 16], dark, false, 'body', [0, 0, -side * .43]);
    a.box(at(side * 3.1, 6.76, 0), [7.12, .14, 16.05], snow, false, 'body', [0, 0, -side * .43]);
    for (const end of [-1, 1]) a.beam(at(side * 6.2, 5.23, end * 7.9), at(0, 8.04, end * 7.9), .2, timber);
  }
  box(0, 8.1, 0, .3, .26, 16.3, dark);
  box(-3.6, 7.2, -3.4, 1.1, 4.7, 1.2, stone, true);
  box(-3.6, 9.6, -3.4, 1.4, .3, 1.5, snow);
  for (const xx of [-3.5, 3.5]) {
    box(xx, 2.8, 7.3, 1.55, 1.55, .08, dark);
    box(xx, 2.8, 7.35, 1.3, 1.3, .03, '#cfb788');
    box(xx, 2.8, 7.39, .08, 1.4, .05, timber);
    box(xx, 2.8, 7.39, 1.4, .08, .05, timber);
  }
  // Ground-floor millstones, open aisle, a carpenter's bench and real flour shelves.
  for (const dx of [-3, .5]) {
    a.cyl(at(dx, .35, -3.2), 1.15, .7, stone, true);
    a.cyl(at(dx, .85, -3.2), 1.05, .3, '#b6b8b7');
    a.cyl(at(dx, 1.6, -3.2), .1, 2.1, dark);
    box(dx, 2.6, -3.2, 1.3, .8, 1.3, timber);
  }
  box(-3.7, .85, 2, 1.6, .18, 3.7, timber, true);
  for (const dz of [.6, 3.4]) box(-3.7, .4, dz, 1.4, .8, .18, dark, true);
  for (const dz of [1, 2, 3]) box(-3.7, 1.02, dz, .8, .12, .4, stone);
  a.paper(...at(-3.7, .96, 2), .75, .55);
  for (const dz of [-5.7, -1, 4.6]) a.lantern(...at(-5.1, 3.4, dz));
  // A usable loading porch links both the road and the bridge's north landing.
  const front: Point = at(0, 0, 10.8), road: Point = [x, ground(x, z + 20, y + 4) ?? y, z + 20];
  landscapeWalkway(a, [at(0, 0, 6.7), front, road], { width: 3.4, floor: timber, edge: dark, supports: (px, pz, c) => ground(px, pz, c) });
  landscapeWalkway(a, [at(5.3, 0, 0), at(9.4, 0, 0), [north[0], north[1], north[2] - 4], north],
    { width: 3.6, floor: timber, edge: dark, rails: true, supports: (px, pz, c) => ground(px, pz, c) });

  // A wheel with open spokes, rim bands, paddles and a visible axle to the millstones.
  const wheel = new THREE.Group(); wheel.name = 'WinterMillWaterwheel'; wheel.position.fromArray(at(-7.1, 2.1, -1.5));
  root.add(wheel);
  const wood = new THREE.MeshStandardMaterial({ color: timber, roughness: .93 });
  const metal = new THREE.MeshStandardMaterial({ color: '#62696c', roughness: .62, metalness: .32 });
  const geos: THREE.BufferGeometry[] = [];
  const part = (geo: THREE.BufferGeometry, p: Point, material: THREE.Material = wood) => {
    geos.push(geo); const mesh = new THREE.Mesh(geo, material); mesh.position.fromArray(p); wheel.add(mesh); return mesh;
  };
  for (const side of [-1, 1]) {
    part(new THREE.TorusGeometry(2.65, .15, 5, 26).rotateY(Math.PI / 2), [side * .7, 0, 0], metal);
    for (let i = 0; i < 8; i++) part(new THREE.BoxGeometry(.14, 5.1, .18), [side * .7, 0, 0]).rotation.x = i * Math.PI / 8;
  }
  for (let i = 0; i < 16; i++) {
    const t = i * Math.PI / 8;
    part(new THREE.BoxGeometry(1.65, .12, .68), [0, Math.sin(t) * 2.52, Math.cos(t) * 2.52]).rotation.x = -t;
  }
  part(new THREE.CylinderGeometry(.2, .2, 4.8, 10).rotateZ(Math.PI / 2), [1.3, 0, 0], metal);
  // Broken panes and a spare sled tell why this is an engineering refuge, not a second fortress.
  for (const side of [-1, 1]) {
    a.beam(at(side * .55 + 3, .2, 10.2), at(side * .55 + 3, .2, 14), .13, dark);
    a.beam(at(side * .55 + 3, .2, 14), at(side * .55 + 3, .5, 14.6), .13, dark);
  }
  for (let i = 0; i < 7; i++) box(3, .45, 10.5 + i * .45, 1.35, .12, .38, timber);
  const collision = mergeParts(a.solids); a.solids.forEach(g => g.dispose());
  const collider: Collider = { name: 'COL_WinterMillWorkshop', bvh: new MeshBVH(collision), enabled: true };
  a.finish('winter'); root.name = 'WinterMillWorkshop';
  return {
    root, collider,
    update(dt: number) { wheel.rotation.x += Math.max(0, Math.min(.1, dt)) * .15; },
    dispose() {
      collider.enabled = false; collision.dispose(); for (const geo of geos) geo.dispose(); wood.dispose(); metal.dispose();
      for (const mesh of a.layers.values()) mesh.geometry.dispose(); for (const material of Object.values(a.materials)) material.dispose(); root.removeFromParent();
    },
  };
}
