import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { gatePoint } from '../story/kingdomGate';
import { KINGDOM_ROAD as K, KINGDOM_ROAD_LABELS, kingdomRoadChoice } from '../story/kingdomRoad';
import { KINGDOM_SIDE_GATE_ANGLE, KINGDOM_SIDE_ROUTE } from '../map/kingdomRoadPlan';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

/** Both routes are visible before committing. Preparation is reversible; the
 * donated bridge and broken winch only change after the oath and final handle. */
export function createKingdomRoadLandscape(ground: (x: number, z: number) => number | null) {
  const root = new THREE.Group(), colliders: Collider[] = [], arts: SiteArt[] = [];
  root.name = 'KingdomPermanentRoadWorks';
  const wood = '#816348', pale = '#b9ab8a', stone = '#9c9984', iron = '#665c52';
  const local = (x: number, z: number) => ground(x - 720, z) ?? 10;
  const world = (p: Point): Point => [p[0] - 720, p[1], p[2]];
  function finish(a: SiteArt, name: string, localFrame = true) {
    if (localFrame) a.relocate(new THREE.Matrix4().makeTranslation(-720, 0, 0));
    a.finish('britain'); a.root.name = name; root.add(a.root); arts.push(a);
    const geo = mergeParts(a.solids); a.solids.forEach(g => g.dispose()); a.solids.length = 0;
    const c: Collider = { name, bvh: new MeshBVH(geo), enabled: true }; colliders.push(c); return c;
  }
  // Sample the full width, not just the centre: the castle slope is steep enough
  // to bury a narrow path's uphill edge if graded from its centre alone.
  const sidePath: Point[] = [];
  for (let i = 1; i < KINGDOM_SIDE_ROUTE.length; i++) {
    const a = KINGDOM_SIDE_ROUTE[i - 1], b = KINGDOM_SIDE_ROUTE[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.ceil(length / 2), nx = -(b[1] - a[1]) / length, nz = (b[0] - a[0]) / length;
    for (let n = i === 1 ? 0 : 1; n <= count; n++) {
      const t = n / count, x = THREE.MathUtils.lerp(a[0], b[0], t), z = THREE.MathUtils.lerp(a[1], b[1], t);
      const earth = Math.max(...[-1.7, 0, 1.7].map(s => local(x + nx * s, z + nz * s)));
      let y = Math.max(13.2, earth + .18);
      if (z < -125) y = 34.18;
      if (i === KINGDOM_SIDE_ROUTE.length - 1) y = THREE.MathUtils.lerp(y, 13.2, Math.max(0, (t - .6) / .4));
      sidePath.push([x, y, z]);
    }
  }
  const side = new SiteArt();
  landscapeWalkway(side, sidePath, { width: 3.4, floor: stone, edge: pale, rails: true, steps: true, continuousCorners: true,
    railOpenings: [...KINGDOM_SIDE_ROUTE.map(([x, z]) => ({ p: sidePath.reduce((a, b) => Math.hypot(a[0] - x, a[2] - z) < Math.hypot(b[0] - x, b[2] - z) ? a : b), radius: 2.3 })), { p: [-169, sidePath.find(p => Math.abs(p[2] + 109) < .01)![1], -109], radius: 3 }, { p: [-151, 13.2, -30], radius: 4 }],
    supports: (x, z) => local(x, z) });
  const gx = -190 + Math.cos(KINGDOM_SIDE_GATE_ANGLE) * 60, gz = -190 + Math.sin(KINGDOM_SIDE_GATE_ANGLE) * 60;
  const yaw = Math.PI / 2 - KINGDOM_SIDE_GATE_ANGLE;
  // Lintel and columns preserve the military wall around its narrow service door.
  side.box([gx, 39.5, gz], [5.5, 2.3, 2.6], stone, true, 'body', [0, yaw, 0]);
  side.lantern(gx + 2.1, 37.1, gz - .6);
  finish(side, 'COL_KingdomAqueductCityConnection');
  const hatch = new SiteArt(); hatch.box([gx, 36.4, gz], [4.9, 4.5, .3], iron, true, 'body', [0, yaw, 0]);
  const hatchCollider = finish(hatch, 'COL_KingdomAqueductServiceDoor');

  const frontPath: Point[] = [];
  const end = gatePoint(0, 110), endY = (ground(end[0], end[2]) ?? 10) + .18;
  for (let out = -4; out <= 110; out += 3) {
    const p = gatePoint(0, out);
    const earth = Math.max(...[-4, 0, 4].map(s => { const q = gatePoint(s, out); return ground(q[0], q[2]) ?? 10; }));
    p[1] = Math.max(earth + .18, out <= 32 ? 34.22 : THREE.MathUtils.lerp(34.22, endY, (out - 32) / 78));
    frontPath.push(p);
  }
  const front = new SiteArt();
  landscapeWalkway(front, frontPath, { width: 8, floor: wood, edge: iron, rails: true, continuousCorners: true,
    railOpenings: [{ p: gatePoint(0, -4), radius: 6 }, { p: gatePoint(0, 11), radius: 6 }], supports: (x, z) => ground(x, z) });
  const frontCollider = finish(front, 'COL_KingdomPermanentCartBridge', false);
  // Only the finished front-gate plan builds the cart bridge: never solid before the first state apply,
  // or anything placed at load (residents, chapter markers) can land on an invisible deck.
  frontCollider.enabled = false; front.root.visible = false;
  const gantry = new SiteArt();
  for (const s of [-5, 5]) {
    gantry.box(gatePoint(s, 15, 4.3), [.8, 8.6, .8], stone, true);
    gantry.box(gatePoint(s, 15, .3), [1.6, .6, 1.6], stone, true);
  }
  gantry.beam(gatePoint(-5, 15, 8.6), gatePoint(5, 15, 8.6), .5, wood);
  finish(gantry, 'COL_KingdomOuterGateGantry', false);
  const gateMaterial = new THREE.MeshStandardMaterial({ color: wood, roughness: .9 });
  const outerGate = new THREE.Group(); outerGate.position.fromArray(gatePoint(0, 15, .22)); outerGate.rotation.y = Math.PI / 4; root.add(outerGate);
  for (let n = 0; n < 12; n++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(.64, 7.8, .22), gateMaterial); plank.position.set(-3.52 + n * .64, 4, 0); outerGate.add(plank);
  }
  // The existing pedestrian arch stays open; the new outer shutter is stored
  // overhead during preparations. Its fall becomes part of the broad deck.
  const winch = new SiteArt(), broken = new SiteArt();
  winch.box(gatePoint(5.8, 13, .7), [1.3, 1.4, 1.1], wood, true);
  winch.ring(gatePoint(5.8, 13, 1.6), .65, .12, iron);
  broken.box(gatePoint(5.8, 13, .3), [1.5, .6, 1.1], wood, true);
  broken.beam(gatePoint(5.2, 13, .6), gatePoint(6.7, 14, .15), .2, iron);
  const winchCollider = finish(winch, 'COL_KingdomIntactOuterWinch', false), brokenCollider = finish(broken, 'COL_KingdomBrokenOuterWinch', false);
  brokenCollider.enabled = false; broken.root.visible = false;

  const junctionY = sidePath.find(p => Math.abs(p[2] + 109) < .01)![1];
  const abbeyApproach: Point[] = [[-169, junctionY, -109], [-179, 34, -110], [-186, 34, -110]];
  const abbeySection: Point[] = [[-186, 34, -110], [-198, 34, -110]];
  const abbeyReturn: Point[] = [[-198, 34, -110], [-214, 34, -110], [-223, 34, -105], [-247, 22, -105], [-250, 22, -92], [-234, local(-230, -80) + .2, -80], [-230, local(-230, -80) + .2, -80]];
  const abbey = new SiteArt(), donation = new SiteArt(), closed = new SiteArt();
  for (const path of [abbeyApproach, abbeyReturn]) landscapeWalkway(abbey, path,
    { width: 3.4, floor: wood, edge: pale, rails: true, steps: true, continuousCorners: true, railOpenings: path.map(p => ({ p, radius: 2.2 })), supports: (x, z) => local(x, z) });
  landscapeWalkway(donation, abbeySection, { width: 3.4, floor: wood, edge: pale, rails: true });
  for (const x of [-185.2, -198.8]) {
    closed.box([x, 34.65, -110], [.22, 1.3, 3.6], wood, true);
    closed.box([x, 35, -110], [.25, .5, 1.8], '#a77554');
  }
  abbey.box([-214, 33.8, -110], [10, .4, 8], stone, true);
  for (const z of [-113, -107]) abbey.box([-215, 34.4, z], [4, .8, .6], wood, true);
  abbey.box([-217, 35, -110], [1.2, 2, 1.2], stone, true);
  finish(abbey, 'COL_KingdomAbbeyMeetingApproach');
  const donationCollider = finish(donation, 'COL_KingdomAbbeyDonatedSpan');
  const closedCollider = finish(closed, 'COL_KingdomAbbeyClosedBridgeEnds');
  const relocation = new SiteArt();
  // Lower-street assembly and porter exchange sit beside, not across, the route.
  const lowerY = Math.max(13.2, local(-144, -25) + .2);
  relocation.box([-142, lowerY - .2, -25], [9, .4, 10], stone, true);
  landscapeWalkway(relocation, [[-151, 13.2, -30], [-147, lowerY, -25], [-142, lowerY, -25]],
    { width: 3, floor: stone, edge: pale });
  for (const z of [-28, -22]) relocation.box([-141, lowerY + .4, z], [4, .8, .6], wood, true);
  relocation.box([-139, lowerY + .7, -25], [1.1, 1.4, 1.1], wood, true);
  for (const x of [-146, -138]) { relocation.box([x, lowerY + 1.7, -20.5], [.16, 3.4, .16], wood, true); }
  relocation.box([-142, lowerY + 3.5, -20.5], [8.5, .2, 2], '#ad9b73');
  const relocationCollider = finish(relocation, 'COL_KingdomLowerStreetAssembly');
  const reinforcements = new SiteArt();
  for (let i = 20; i < sidePath.length - 3; i += 6) {
    const [x, y, z] = sidePath[i];
    for (const s of [-1, 1]) reinforcements.beam([x + s * 1.7, y - .15, z], [x + s * 2.3, y - 3.4, z - 2], .28, wood);
  }
  // Render-only support timbers remain below the walk surface.
  reinforcements.finish('britain'); reinforcements.root.position.x = -720; root.add(reinforcements.root); arts.push(reinforcements);

  const controls = new SiteArt();
  const markerPositions: [string, Point][] = [[K.front, gatePoint(-5, -7, 1.5)], [K.side, gatePoint(-8, -7, 1.5)],
    [K.start, gatePoint(-5, -11, 1.5)], [K.finish, gatePoint(-8, -11, 1.5)]];
  for (const [, p] of markerPositions) {
    controls.box([p[0], p[1] - .95, p[2]], [.65, 1.1, .65], wood, true);
    controls.paper(p[0], p[1] - .38, p[2], .6, .6);
  }
  finish(controls, 'COL_KingdomRoadPlanningTables', false);
  const markers: Marker[] = markerPositions.map(([id, p]) => ({ id, p, type: 'interact', label: KINGDOM_ROAD_LABELS[id][0], radius: 2.4 }));
  markers.push({ id: 'disc_kingdom_abbey_bridge', p: world([-211, 34, -110]), type: 'discovery', radius: 4,
    label: '修院外桥与集会台', note: '桥上的梁可加固旧水道。拆走中段后，这里的集会必须迁到下城，旧桥两端会封起。' });
  let t = 1, finished = false, initialized = false;
  function apply(done: ReadonlySet<string>, dt = 0) {
    const completed = done.has(K.finish), choice = kingdomRoadChoice(done);
    if (!initialized) { initialized = true; finished = completed; }
    if (finished !== completed) { finished = completed; t = completed ? 0 : 1; }
    if (dt > 0) t = Math.min(1, t + dt / 2.8);
    const frontDone = completed && choice === 'front', sideDone = completed && choice === 'side';
    const open = choice === 'side'; hatch.root.visible = !open; hatchCollider.enabled = !open;
    front.root.visible = frontDone; frontCollider.enabled = frontDone;
    outerGate.position.y = 34.22 + (frontDone ? 7 * (1 - t) : 7);
    outerGate.rotation.x = frontDone ? Math.PI / 2 * t : 0;
    winch.root.visible = !frontDone; winchCollider.enabled = !frontDone;
    broken.root.visible = frontDone; brokenCollider.enabled = frontDone;
    donation.root.visible = !sideDone; donationCollider.enabled = !sideDone;
    closed.root.visible = sideDone; closedCollider.enabled = sideDone;
    relocation.root.visible = sideDone; relocationCollider.enabled = sideDone;
    reinforcements.root.visible = sideDone;
  }
  return { root, colliders, markers, sidePath: sidePath.map(world), frontPath,
    abbeyPaths: [abbeyApproach, abbeySection, abbeyReturn].map(path => path.map(world)), apply,
    update(p: THREE.Vector3) { root.visible = Math.hypot(p.x + 900, p.z + 90) < 450 && p.y < 130; },
    dispose() { colliders.forEach(c => { c.enabled = false; c.bvh.geometry.dispose(); }); arts.forEach(a => { a.layers.forEach(m => m.geometry.dispose()); Object.values(a.materials).forEach(m => m.dispose()); }); outerGate.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); gateMaterial.dispose(); root.removeFromParent(); },
  };
}
