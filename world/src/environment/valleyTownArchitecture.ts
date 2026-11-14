import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { LOOKBACK_CHANNEL } from '../map/valleyFoundationPlan';

type V3 = [number, number, number];
/** Valley and Homeward Town formal set pieces with real collision, placed at load on the reviewed maps:
 * V01 Lookback Bridge (stream abutments, rails, town north gate, under-bridge steps and old path),
 * V06 West Ridge (breach rock slopes, local camp, lookout), T02 kitchen annex with its back door,
 * the protagonist's room and small yard, T01 Homeward Square fixtures, and the H13 residents' footbridge.
 * Roofs are visual only, so ground queries from above never land on them. */
export function createValleyTownArchitecture(ground: (x: number, z: number) => number) {
  const root = new THREE.Group(); root.name = 'ValleyTownArchitecture';
  const colliders: Collider[] = [], arts: SiteArt[] = [];
  const stone = '#8a8578', darkStone = '#6f6a5f', timber = '#8d7150', darkTimber = '#5b4632', plaster = '#e4dccb', roof = '#6b4e3a', iron = '#45474a', canvas = '#cdbb94';
  function finish(a: SiteArt, name: string, enabled = true) {
    a.finish('alpha'); a.root.name = name; root.add(a.root); arts.push(a);
    if (!a.solids.length) return null;
    const geometry = mergeParts(a.solids); a.solids.forEach(g => g.dispose()); a.solids.length = 0;
    const c: Collider = { name: `COL_${name}`, enabled, bvh: new MeshBVH(geometry) }; colliders.push(c); return c;
  }
  const at = (x: number, z: number, lift = 0): V3 => [x, ground(x, z) + lift, z];

  // V01 Lookback Bridge: stone abutments at both banks under the existing decks, outer rails,
  // the town north gate at the east end, steps down to the stream bed and the old path beneath.
  const bridge = new SiteArt(), c = LOOKBACK_CHANNEL, west = c.x - c.halfWidth - c.bank, east = c.x + c.halfWidth + c.bank;
  // Abutments face the banks under the deck ends; flush with the ground so they never trip the walk.
  for (const x of [west + .25, east - .25]) for (const z of [-30, -26]) bridge.box([x, ground(x, z) - .5, z], [.6, 1.1, 2.4], stone);
  for (const z of [-31.4, -23.8]) {
    for (let x = west - .6; x <= east + .6; x += 1.6) bridge.box([x, ground(x, z) + .55, z], [.12, 1.1, .12], darkTimber, true);
    bridge.box([c.x, ground(c.x - 3, z) + 1.08, z], [east - west + 1.4, .1, .1], timber, true);
  }
  for (const z of [-33.6, -21.6]) {
    const p = at(-263, z); bridge.box([p[0], p[1] + 2.6, z], [1.2, 5.2, 1.2], stone, true);
    bridge.box([p[0], p[1] + .3, z], [1.6, .6, 1.6], darkStone, true);
  }
  { const p = at(-263, -27.6); bridge.box([p[0], p[1] + 5.45, -27.6], [1.4, .5, 13.4], darkTimber); bridge.box([p[0], p[1] + 6, -27.6], [2.2, .25, 14.2], roof); }
  // Steps from the south walk down the west bank to the stream bed, then the old path under the bridge.
  for (let i = 0; i < 4; i++) { const x = west - .2 + i * .45, z = -21.2; bridge.box([x, ground(x, z) + .1, z], [.45, .2, 1.2], stone, true); }
  for (let z = -22; z >= -36; z -= 2) { const x = c.x - c.halfWidth + .7; bridge.box([x, ground(x, z) + .06, z], [1.3, .12, 1.9], darkStone, true); }
  bridge.box([c.x, ground(c.x, -40) + .32, -28], [c.halfWidth * 2 - .2, .04, 40], '#5d8fa0');
  finish(bridge, 'ValleyLookbackBridge');

  // H13: the footbridge residents finish while the player is away (enabled by state).
  const foot = new SiteArt(), fz = -41;
  foot.box([c.x, ground(west - .5, fz) + .2, fz], [east - west + 2, .22, 1.8], timber, true);
  for (const z of [fz - .85, fz + .85]) foot.box([c.x, ground(west - .5, fz) + .78, z], [east - west + 2, .08, .08], darkTimber, true);
  for (const x of [west - .4, east + .4]) foot.box([x, ground(x, fz) - .1, fz], [.6, .8, 2], stone, true);
  const footCollider = finish(foot, 'ValleyResidentsFootbridge', false)!;

  // V06 West Ridge: breach rock slopes on both sides of the route, the local camp and a lookout.
  const ridge = new SiteArt();
  for (const [x, z, w, d, h, r] of [[-322, -50, 7, 3.4, 3.2, .3], [-316, -52, 5, 3, 2.4, -.2], [-322, -10, 7, 3.4, 3, -.25], [-316, -8, 5, 3, 2.2, .2]] as const) {
    ridge.box([x, ground(x, z) + h / 2 - .4, z], [w, h, d], darkStone, true, 'body', [0, r, z < -30 ? .18 : -.18]);
  }
  for (const x of [-324, -322.5, -321]) ridge.box([x, ground(x, -44) + .9, -44], [.5, 1.8, .5], '#c8a86a', true);
  { const p = at(-302, -19); ridge.box([p[0], p[1] + .7, p[2]], [3, 1.4, 2.2], canvas, true, 'body', [0, .3, 0]); ridge.box([p[0] + 2.2, p[1] + .12, p[2] + 2], [.8, .24, .8], '#d88a3a'); ridge.box([p[0] - 1.2, p[1] + .25, p[2] + 2.4], [2, .2, .45], timber, true); }
  { const p = at(-305, -41); ridge.box([p[0], p[1] + 1.55, p[2]], [3.2, .2, 3.2], timber, true);
    for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) ridge.box([p[0] + dx, p[1] + .75, p[2] + dz], [.2, 1.5, .2], darkTimber, true);
    for (let i = 0; i < 5; i++) ridge.box([p[0] + 1.6 + i * .5, p[1] + 1.4 - i * .3, p[2]], [.5, .2, 1.1], timber, true); }
  finish(ridge, 'ValleyWestRidge');

  // T02: kitchen annex north of the residence hall (back door on the west), the protagonist's room,
  // and the small yard. Walls are solid; door gaps are real openings; roofs are visual.
  // The ground falls ~2 m toward the north; a stone plinth carries the annex level with the hall floor.
  const annex = new SiteArt(), floor = Math.max(...[[-183, 183.3], [-171.3, 183.3], [-183, 196.6], [-171.3, 196.6], [-177, 190]].map(([x, z]) => ground(x, z)));
  { const low = Math.min(ground(-183, 183.3), ground(-171.3, 183.3)) - .3; annex.box([-177.25, (floor + low) / 2, 189.95], [12.1, floor - low, 13.4], '#8a8578', true); }
  const wall = (x0: number, z0: number, x1: number, z1: number) => { const len = Math.hypot(x1 - x0, z1 - z0); annex.box([(x0 + x1) / 2, floor + 1.5, (z0 + z1) / 2], [Math.abs(x1 - x0) > .01 ? len : .2, 3, Math.abs(z1 - z0) > .01 ? len : .2], plaster, true); };
  wall(-183, 183.5, -176, 183.5); wall(-183, 196.5, -176, 196.5);                 // south (hall side) and north
  wall(-183, 183.5, -183, 193.6); wall(-183, 195.2, -183, 196.5);                 // west wall with the kitchen back door
  wall(-176, 183.5, -176, 185); wall(-176, 186.6, -176, 191.6); wall(-176, 193.2, -176, 196.5); // east wall, room and kitchen doors
  wall(-183, 189.6, -180.6, 189.6); wall(-179, 189.6, -176, 189.6);               // shared wall with an inner door
  annex.box([-179.5, floor + 3.15, 190], [7.6, .2, 13.6], roof);
  annex.box([-183.1, floor + 1.15, 194.4], [.08, 2.3, 1.5], darkTimber);          // back door leaf, ajar
  // Kitchen: counter, stove, water barrel and shelf along the north wall.
  annex.box([-179.5, floor + .45, 195.8], [5, .9, .8], timber, true); annex.box([-181.6, floor + .55, 195.8], [1, 1.1, .8], iron, true);
  annex.cyl([-177, floor + .5, 195.6], .4, 1, darkTimber, true); annex.box([-179.5, floor + 1.9, 196.25], [4, .1, .4], timber);
  // The protagonist's room: bed, desk and chair, a chest and one keepsake shelf.
  annex.box([-181.6, floor + .3, 185.2], [2.2, .6, 1.3], darkTimber, true); annex.box([-181.6, floor + .66, 185.2], [2.1, .14, 1.2], '#f1ece2');
  annex.box([-177.2, floor + .38, 188.4], [1.4, .76, .7], timber, true); annex.box([-177.2, floor + .23, 187.6], [.5, .46, .5], darkTimber, true);
  annex.box([-182.4, floor + .3, 188.5], [.9, .6, .6], darkTimber, true); annex.box([-182.85, floor + 1.6, 187], [.25, .08, 1.4], timber);
  // Yard: low fence with a gate toward the hall path, a bench and a clothesline.
  // East fence with its gate near the hall end (level ground); the north edge is a closed fence above the drop.
  for (let z = 183.7; z <= 196.3; z += 1.4) if (z < 193.4 || z > 195.6) annex.box([-171.6, floor + .45, z], [.1, .9, .1], darkTimber, true);
  annex.box([-171.6, floor + .75, 188.4], [.08, .08, 9.4], timber, true);
  for (let x = -175.8; x <= -171.8; x += 1) annex.box([x, floor + .45, 183.4], [.1, .9, .1], darkTimber, true);
  annex.box([-173.8, floor + .75, 183.4], [4.2, .08, .08], timber, true);
  annex.box([-173.5, floor + .25, 194.8], [2.2, .5, .5], timber, true); annex.beam([-175.6, floor + 2, 185.2], [-172, floor + 2, 192], .02, '#d9d2c0');
  finish(annex, 'ValleyCanteenAnnex');

  // T01 Homeward Square: return lamp, posted timetable, public bench, departure platform.
  const square = new SiteArt(), sx = 660, sz = 79, sy = ground(sx, sz);
  square.box([sx, sy + 2.6, sz - 1.4], [.18, 5.2, .18], iron, true); square.box([sx, sy + 5.3, sz - 1.4], [.6, .5, .6], '#ffd98a', false, 'glow');
  square.box([sx + 2, sy + 1.2, sz - .6], [2.2, 1.4, .1], timber, true); square.box([sx + 2, sy + 1.3, sz - .54], [2, 1.1, .02], '#e8dfc8');
  square.box([sx - 2.5, sy + .45, sz + .6], [2, .12, .5], timber, true); square.box([sx, sy + .12, sz + 5], [4, .24, 2.5], stone, true);
  finish(square, 'HomewardSquareFixtures');

  return {
    root, colliders,
    apply(d: ReadonlySet<string>) { const built = d.has('journey_sky_return'); footCollider.enabled = built; arts[1].root.visible = built; },
    update(viewer: THREE.Vector3) { root.visible = Math.hypot(viewer.x + 220, viewer.z - 100) < 420 || Math.hypot(viewer.x - 660, viewer.z - 79) < 260; },
    dispose() { colliders.forEach(c => c.enabled = false); root.removeFromParent(); },
  };
}
