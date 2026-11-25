import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';
import { buildFrozenMillRace } from './winterMillRace';
import type { Collider } from '../player/player';

/** The mill fork is a place to work and recover, visible before choosing a
 * withdrawal route. Its workshop and rear door are actual walk-in spaces. */
export function createWinterMillArchitecture(north: Point, ground: (x: number, z: number, ceiling?: number) => number | null) {
  const a = new SiteArt(), root = a.root;
  // West of the shared x = 40 convoy road: both withdrawal carts need 1.6 m of body
  // clearance along x = 40, z = -620 and z = -609, so the workshop stands beside the
  // fork instead of on it (rules: millConvoyRoute.ts, convoyRoute.ts).
  const x = north[0] - 32, z = north[2] - 9;
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
  for (const height of [.6, 3.6]) {
    for (const side of [-1, 1]) {
      box(side * 3.82, height, 7.27, 3.98, .24, .12, timber);
      box(5.87, height, side * 4.82, .12, .24, 4.66, timber);
    }
  }
  box(0, 5.2, 7.27, 11.7, .24, .12, timber);
  box(5.87, 5.2, 0, .12, .24, 14.3, timber);
  const stoneCourse = ['#878e91', '#929694', '#9e9d96', '#81878a'];
  for (let col = 0; col < 10; col++) {
    const dz = -6.46 + col * 1.43, dx = -5.2 + col * 1.15;
    const color = stoneCourse[col % stoneCourse.length];
    box(-5.87, .36, dz, .24, .72, 1.40, color);
    box(dx, .36, -7.30, 1.12, .72, .23, color);
  }
  for (const side of [-1, 1]) for (let col = 0; col < 4; col++) {
    const color = stoneCourse[(col + side + 1) % stoneCourse.length];
    box(side * (2.34 + col * .96), .36, 7.31, .92, .72, .22, color);
    box(5.90, .36, side * (3.01 + col * 1.15), .22, .72, 1.11, color);
  }
  for (const dz of [-6.9, -3.4, .4, 3.77, 6.9]) box(-5.863, 2.9, dz, .21, 4.45, .22, timber);
  box(-5.885, 4.97, 0, .24, .27, 14.2, dark);
  box(-5.944, 2.69, -1.5, .19, .81, .84, dark);
  const slab = new THREE.BoxGeometry(1, 1, 1);
  for (const side of [-1, 1]) {
    const pitch = .43, rotation: Point = [0, 0, -side * pitch];
    const roof = (dx: number) => 6.6 + (3.1 - dx) * Math.tan(pitch) + .1 / Math.cos(pitch);
    a.add(slab, '#64594d', at(side * 3.1, 6.6, 0), [7.1, .2, 16], false, 'body', rotation);
    for (let section = 0; section < 12; section++) {
      const dz = -7.31 + section * 1.33;
      const eave = 5.33 + ((section * 7 + side + 1) % 6) * .13;
      const middle = (.10 + eave) / 2;
      a.add(slab, section % 3 ? snow : '#c6d7df', at(side * middle, roof(middle) + .058, dz), [(eave - .1) / Math.cos(pitch), .115, 1.33], false, 'body', rotation);
      const rafter = (eave + 6.32) / 2;
      a.add(slab, timber, at(side * rafter, roof(rafter) + .018, dz + .41), [(6.32 - eave) / Math.cos(pitch), .056, .08], false, 'body', rotation);
    }
    box(side * 6.31, roof(6.31) - .06, 0, .18, .26, 16.1, dark);
    for (const end of [-1, 1]) a.beam(at(side * 6.2, 5.23, end * 7.9), at(0, 8.04, end * 7.9), .2, timber);
  }
  // The loft carries grain. Both ends stop driving snow while a louvred
  // opening below each ridge lets the damp air escape.
  const gable = new THREE.Shape();
  gable.moveTo(-5.72, -.10); gable.lineTo(5.72, -.10);
  gable.lineTo(5.72, .02); gable.lineTo(0, 2.64); gable.lineTo(-5.72, .02); gable.closePath();
  const vent = new THREE.Path();
  vent.moveTo(-.72,.65); vent.lineTo(-.72,1.52); vent.lineTo(.72,1.52); vent.lineTo(.72,.65); vent.closePath();
  gable.holes.push(vent);
  const infill = new THREE.ExtrudeGeometry(gable, {depth:.17, bevelEnabled:false});
  infill.translate(0,0,-.085);
  for (const end of [-1,1]) {
    a.add(infill, plaster, at(0,5.4,end*7), [1,1,1], true);
    for (const side of [-1,1]) box(side*.76,6.49,end*7.02,.10,.99,.23,dark);
    for (const h of [6.05,6.92]) box(0,h,end*7.02,1.58,.10,.24,timber);
    for (const h of [6.27,6.53,6.79])
      a.box(at(0,h,end*7.02), [1.44,.11,.29], timber, false, 'body', [end*.32,0,0]);
  }
  infill.dispose();
  box(0, 8.1, 0, .3, .26, 16.3, dark);
  box(-3.6, 7.2, -3.4, 1.1, 4.7, 1.2, stone, true);
  box(-3.6, 9.6, -3.4, 1.4, .3, 1.5, snow);
  for (const xx of [-3.5, 3.5]) {
    box(xx, 2.8, 7.3, 1.55, 1.55, .08, dark);
    box(xx, 2.8, 7.35, 1.3, 1.3, .03, '#cfb788');
    box(xx, 2.8, 7.39, .08, 1.4, .05, timber);
    box(xx, 2.8, 7.39, 1.4, .08, .05, timber);
  }
  a.lantern(...at(0, 4.01, 7.48));
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
  // A usable loading porch leads north to the road. The river door keeps a short stoop that
  // stops before the convoy road; the bridge's north landing is a short walk across open ground.
  function landing(dx: number, dz: number, crossX: number, crossZ: number): Point {
    const px = x + dx, pz = z + dz;
    const heights = [-1, 0, 1].map(side => ground(px + crossX * side, pz + crossZ * side, y + 1.4) ?? y);
    return [px, Math.max(...heights) + .055, pz];
  }
  const front = [at(0, 0, 6.7), ...[9, 12.7, 16.5, 20].map(dz => landing(0, dz, 1.55, 0))];
  const side = [at(5.3, 0, 0), landing(7.6, 0, 0, 1.65)];
  function loadingWalk(points: Point[], width: number) {
    landscapeWalkway(a, points, { width, floor: timber, edge: dark, continuousCorners: true, supports: ground });
    for (let n = 1; n < points.length; n++) {
      const start = new THREE.Vector3(...points[n - 1]), end = new THREE.Vector3(...points[n]);
      const delta = end.clone().sub(start), length = delta.length(), count = Math.ceil(length / .56);
      const turn = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.normalize()));
      for (let plank = 0; plank < count; plank++) {
        const p = start.clone().lerp(end, (plank + .5) / count); p.y += .005;
        const shade = (plank + n) % 5 < 2 ? '#867160' : '#7c695a';
        a.add(slab, shade, p.toArray(), [width - .045, .025, length / count - .022], false, 'body', [turn.x, turn.y, turn.z]);
      }
    }
  }
  loadingWalk(front, 3.4);
  loadingWalk(side, 3.6);
  slab.dispose();

  buildFrozenMillRace(a, at, ground);
  // The spare sled sits beside the loading track, clear of both thresholds.
  const sledY = (ground(x + 3, z + 12.35, y + 1.4) ?? y) - y;
  for (const side of [-1, 1]) {
    a.beam(at(side * .55 + 3, sledY + .15, 10.2), at(side * .55 + 3, sledY + .15, 14), .13, dark);
    a.beam(at(side * .55 + 3, sledY + .15, 14), at(side * .55 + 3, sledY + .46, 14.6), .13, dark);
  }
  for (let i = 0; i < 7; i++) {
    box(3, sledY + .315, 10.5 + i * .45, 1.35, .12, .38, timber);
    if (i === 0 || i === 6) box(3, sledY + .237, 10.5 + i * .45, 1.28, .14, .21, dark);
  }
  const collision = mergeParts(a.solids); a.solids.forEach(g => g.dispose());
  const collider: Collider = { name: 'COL_WinterMillWorkshop', bvh: new MeshBVH(collision), enabled: true };
  a.finish('winter'); root.name = 'WinterMillWorkshop';
  return {
    root, collider,
    dispose() {
      collider.enabled = false; collision.dispose();
      for (const mesh of a.layers.values()) mesh.geometry.dispose(); for (const material of Object.values(a.materials)) material.dispose(); root.removeFromParent();
    },
  };
}
