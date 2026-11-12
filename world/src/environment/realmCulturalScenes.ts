import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import { ORLEANS_OFFSET } from '../map/orleansOutskirts';
import { qinToWorld } from '../map/qinPlan';
import type { Collider } from '../player/player';
import { mergeParts } from '../settlements/merge';
import { createSettlementNpcs } from '../settlements/npcs';
import { SiteArt } from '../story/campaignSites';
import { CROOKED_EFFIGY as Q, CULTURAL_STEPS, SHADOW_PLAY as O } from '../story/realmCulturalStories';
import { JOURNEY } from '../story/worldJourney';

type Point = [number, number, number];
type Ground = (x: number, z: number, ceiling: number) => number | null;
type Clear = (p: THREE.Vector3) => boolean;
const around = ([x, y, z]: Point, dx: number, dy: number, dz: number): Point => [x + dx, y + dy, z + dz];

function place(ground: Ground, clear: Clear, x: number, y: number, z: number): Point | null {
  for (const [dx, dz] of [[0, 0], [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6], [3.2, 0], [-3.2, 0]]) {
    const floor = ground(x + dx, z + dz, y + 1.6);
    if (floor !== null && Math.abs(floor - y) < 2 && clear(new THREE.Vector3(x + dx, floor + .06, z + dz))) return [x + dx, floor, z + dz];
  }
  return null;
}
function marker(id: string, p: Point): Marker {
  return { id, label: CULTURAL_STEPS.get(id)!.label[0], p: around(p, 0, .88, 0), type: 'interact', radius: 1.9 };
}
function colliderFor(art: SiteArt, name: string): Collider {
  const geometry = mergeParts(art.solids);
  for (const solid of art.solids) solid.dispose();
  art.solids.length = 0;
  return { name, bvh: new MeshBVH(geometry), enabled: true };
}
function disposeArt(art: SiteArt) {
  for (const layer of art.layers.values()) layer.geometry.dispose();
  for (const material of Object.values(art.materials)) material.dispose();
  art.root.removeFromParent();
}

export function createOrleansShadowPlay(ground: Ground, clear: Clear) {
  const [ox, oz] = ORLEANS_OFFSET;
  const anchor = place(ground, clear, ox - 64, 14, oz + 95);
  if (!anchor) return null;
  const [x, y, z] = anchor;
  const door = place(ground, clear, x + 3.1, y, z - .7);
  const rope = place(ground, clear, x - 3.05, y, z + .55);
  if (!door || !rope) return null;
  const ropeY = rope[1];
  const art = new SiteArt(), root = art.root;
  const oak = '#5d3c36', red = '#7f3d47', paper = '#ffdaa2';
  art.box(around(anchor, 0, .33, 0), [4.5, .62, 2.1], oak, true);
  art.box(around(anchor, 0, 2.9, -.08), [4.8, .2, 2.25], oak);
  art.box(around(anchor, 0, 2.92, .78), [4.68, .29, .38], red);
  art.box(around(anchor, 0, 1.74, .68), [3.38, 1.8, .066], paper, false, 'glow');
  art.box(around(anchor, 0, 1.74, -.68), [3.38, 1.8, .066], paper, false, 'glow');
  for (const side of [-1, 1]) {
    art.box(around(anchor, side * 2.12, 1.52, .78), [.2, 2.78, .25], oak, true);
    art.box(around(anchor, side * 1.91, 1.78, .78), [.42, 1.95, .11], red);
    art.lantern(x + side * 2.3, y + 2.08, z + .9, oak);
  }
  art.box(around(door, -.28, .96, -.67), [.91, 1.88, .16], oak, true);
  art.box(around(door, -.28, 1.61, -.57), [.48, .33, .036], paper, false, 'glow');
  art.ring(around(door, .02, .93, -.55), .075, .014, '#ab9065');
  art.box(around(rope, .3, .64, -.81), [.17, 1.28, .16], oak, true);
  const collision = colliderFor(art, 'COL_OrleansShadowTheatreStage');
  art.finish('alpha'); root.name = 'OrleansShadowTheatre';

  const puppets = new THREE.Group(); root.add(puppets);
  const silhouette = new THREE.MeshBasicMaterial({ color: 0x3c2430 });
  const gold = new THREE.MeshBasicMaterial({ color: 0xd38842, side: THREE.DoubleSide });
  const blue = new THREE.MeshBasicMaterial({ color: 0x597e8f, side: THREE.DoubleSide });
  const part = (parent: THREE.Group, g: THREE.BufferGeometry, m: THREE.Material, p: Point) => {
    const mesh = new THREE.Mesh(g, m); mesh.position.fromArray(p); parent.add(mesh); return mesh;
  };
  function puppet(name: string) {
    const figure = new THREE.Group(); figure.name = name; puppets.add(figure);
    part(figure, new THREE.CircleGeometry(.115, 12), silhouette, [0, .48, 0]);
    part(figure, new THREE.CircleGeometry(.16, 5), silhouette, [0, .22, 0]).scale.set(1, 1.54, 1);
    for (const side of [-1, 1]) part(figure, new THREE.PlaneGeometry(.068, .23), silhouette, [side * .087, .03, 0]).rotation.z = side * .18;
    return figure;
  }
  const carrier = puppet('ShadowFlagBearer'), actor = puppet('ShadowSecondActor');
  const staff = new THREE.Group(); staff.name = 'ShadowPlayFlag'; puppets.add(staff);
  part(staff, new THREE.PlaneGeometry(.035, .88), silhouette, [0, .39, 0]);
  const pennant = part(staff, new THREE.CircleGeometry(.2, 3), gold, [.2, .67, 0]);
  const swallowtail = new THREE.Shape().moveTo(0, -.15).lineTo(.44, -.15).lineTo(.29, 0).lineTo(.44, .15).lineTo(0, .15).closePath();
  const swallow = part(staff, new THREE.ShapeGeometry(swallowtail), blue, [0, .67, 0]);
  const pullRope = part(root, new THREE.CylinderGeometry(.026, .026, 1.19, 6),
    new THREE.MeshStandardMaterial({ color: 0xbfa07e }), around(rope, .3, 1.56, -.78));
  pullRope.name = 'OrleansTheatreRope';
  let playing = false, elapsed = 0, siege = false, blueFlag = false;
  const duration = 4.8;
  function pose(done: ReadonlySet<string>) {
    const t = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
    const beat = THREE.MathUtils.smoothstep(t, .12, .78);
    const settled = !playing;
    swallow.visible = playing ? blueFlag : done.has(O.swallowtail); pennant.visible = !swallow.visible;
    carrier.position.set(x - 1.22 + beat * 1.25, y + 1.22 + Math.abs(Math.sin(t * 8 * Math.PI)) * .1 * Math.sin(t * Math.PI), z + .738);
    actor.position.set(x + 1.15 - beat * .75, y + 1.22, z + .738);
    actor.rotation.z = siege ? -.44 * Math.sin(t * Math.PI) : .66 * Math.sin(t * Math.PI * 2);
    staff.rotation.z = siege ? -.56 * Math.sin(t * Math.PI) : .58 * Math.sin(t * Math.PI);
    pullRope.position.y = ropeY + 1.56 - .41 * Math.sin(t * Math.PI);
    if (settled) {
      carrier.position.x = x - .63;
      actor.position.x = x + .62;
      actor.rotation.z = 0; staff.rotation.z = -.12;
    }
    const handover = !settled && siege ? THREE.MathUtils.smoothstep(t, .43, .66) : 0;
    staff.position.set(THREE.MathUtils.lerp(carrier.position.x + .16, actor.position.x - .16, handover),
      THREE.MathUtils.lerp(carrier.position.y, actor.position.y, handover) + .13, z + .75);
  }
  return {
    root, collider: collision, markers: [marker(O.discover, door), marker(O.rope, rope), marker(O.encore, rope)],
    start(afterSiege: boolean, swallowtail: boolean) { elapsed = 0; siege = afterSiege; blueFlag = swallowtail; playing = true; },
    update(done: ReadonlySet<string>, dt: number, p: THREE.Vector3) {
      root.visible = (p.x - x) ** 2 + (p.z - z) ** 2 < 110 ** 2;
      puppets.visible = playing || done.has(O.rope);
      const near = Math.hypot(p.x - rope[0], p.z - rope[2]) < 9 && Math.abs(p.y - rope[1]) < 3;
      if (playing && near) elapsed += dt;
      pose(done);
      if (!playing || elapsed < duration) return false;
      playing = false;
      return true;
    },
    get playing() { return playing; },
    reset() { playing = false; elapsed = 0; },
    dispose() {
      puppets.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      for (const mat of [silhouette, gold, blue, pullRope.material]) mat.dispose();
      pullRope.geometry.dispose(); collision.bvh.geometry.dispose(); disposeArt(art);
    },
  };
}

export function createQinCrookedEffigy(ground: Ground, clear: Clear) {
  const [x0, z0] = qinToWorld(-217, 66);
  const stand = place(ground, clear, x0, 24, z0);
  if (!stand) return null;
  const [x, y, z] = stand;
  const maker = place(ground, clear, x + 3, y, z + .4);
  const display = place(ground, clear, x + 5.3, y, z + 2.5);
  if (!maker || !display) return null;
  const art = new SiteArt(), root = art.root;
  const timber = '#5a4536', sand = '#bd9574';
  for (const side of [-1, 1]) {
    art.box(around(stand, side * .45, .41, -.95), [.15, .82, .63], timber, true);
    art.box(around(stand, side * 1.4, .64, -1.23), [.56, 1.27, .5], '#937866');
    art.cyl(around(stand, side * 1.4, 1.43, -1.23), .42, .37, '#9d7860');
  }
  art.box(around(stand, 0, .85, -.95), [1.26, .15, .82], timber, true);
  art.box(around(display, 0, .39, 0), [.83, .78, .71], sand, true);
  art.box(around(display, 0, .8, 0), [.91, .12, .82], timber);
  const collision = colliderFor(art, 'COL_QinEffigyWorktable');
  art.finish('alpha'); root.name = 'QinCrookedEffigy';
  const clay = new THREE.MeshStandardMaterial({ color: 0xae7055, roughness: .88 });
  const groove = new THREE.MeshStandardMaterial({ color: 0x754b3a, roughness: .95 });
  const pine = new THREE.MeshStandardMaterial({ color: 0x644934, roughness: .88 });
  const effigy = new THREE.Group(); root.add(effigy); effigy.name = 'QinClayStudy';
  const piece = (parent: THREE.Group, g: THREE.BufferGeometry, mat: THREE.Material, p: Point) => {
    const mesh = new THREE.Mesh(g, mat); mesh.position.fromArray(p); parent.add(mesh); return mesh;
  };
  piece(effigy, new THREE.CylinderGeometry(.44, .47, .105, 20), pine, [0, .05, 0]);
  const chest = piece(effigy, new THREE.CylinderGeometry(.24, .31, .57, 8), clay, [0, .36, 0]);
  chest.scale.z = .63;
  const tilt = new THREE.Group(); tilt.position.y = .74; tilt.rotation.z = -.33; effigy.add(tilt);
  piece(tilt, new THREE.SphereGeometry(.22, 14, 10), clay, [0, .04, 0]).scale.set(.83, 1.07, .89);
  piece(tilt, new THREE.SphereGeometry(.084, 10, 7), groove, [-.04, .25, -.046]);
  piece(tilt, new THREE.ConeGeometry(.072, .126, 4).rotateX(Math.PI / 2), clay, [0, .02, .202]);
  for (const side of [-1, 1]) {
    piece(tilt, new THREE.BoxGeometry(.09, .019, .025), groove, [side * .074, .091, .18]).rotation.z = -side * .12;
    piece(tilt, new THREE.SphereGeometry(.063, 8, 6), clay, [side * .172, .012, 0]).scale.y = 1.37;
    piece(effigy, new THREE.CapsuleGeometry(.062, .18, 3, 7), clay, [side * .225, .42, .012]).rotation.z = side * .27;
    for (let finger = 0; finger < 4; finger++) {
      const mark = piece(effigy, new THREE.BoxGeometry(.015, .092 - finger * .008, .012), groove,
        [side * .115 + .018 * (finger - 1), .41, -.159]);
      mark.rotation.z = side * .14 + finger * .11;
    }
    piece(effigy, new THREE.CircleGeometry(.039, 10), groove, [side * .115, .346, -.167]).rotation.y = Math.PI;
  }
  const people = createSettlementNpcs([{ id: 'qin_kiln_potter_lu_rong', role: ['陶工路容', 'Lu Rong, potter'], region: 'alpha',
    worldRegion: 'qin', position: maker, yaw: -.45, appearance: { coat: 0x7c5746, trim: 0xc4ac88, accent: 0x598078 },
    lines: [['这尊还有两道没修的接缝。', 'This one still has two seams to finish.']] }]);
  root.add(people.group);
  let first = true;
  return {
    root, collider: collision, markers: [marker(Q.turn, stand), marker(Q.maker, maker)],
    gesture() { people.gesture('qin_kiln_potter_lu_rong'); },
    update(done: ReadonlySet<string>, dt: number, p: THREE.Vector3, speaking: boolean) {
      root.visible = (p.x - x) ** 2 + (p.z - z) ** 2 < 120 ** 2;
      people.setSpeaking(speaking ? 'qin_kiln_potter_lu_rong' : null);
      if (root.visible) people.update(dt, p);
      const open = done.has(Q.maker) && done.has(JOURNEY.qinDone);
      const [ex, ey, ez] = open ? around(display, 0, .88, 0) : around(stand, 0, .93, -.95);
      effigy.position.set(ex, ey, ez);
      const angle = done.has(Q.turn) && !open ? Math.PI : 0;
      effigy.rotation.y = first ? angle : THREE.MathUtils.damp(effigy.rotation.y, angle, 4.1, dt);
      first = false;
    },
    dispose() {
      people.dispose(); collision.bvh.geometry.dispose(); effigy.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      for (const mat of [clay, groove, pine]) mat.dispose();
      disposeArt(art);
    },
  };
}
