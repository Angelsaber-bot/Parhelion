import { makeChaserShip, makeLungingShell, makeRelayPennant, makeWavingStandard } from './chaserShip';
import * as THREE from 'three';
import type { Marker } from '../core/types';
import type { FieldChapterContent, FieldEscortPose } from '../story/fieldChapters';
import { createSettlementNpcs } from '../settlements/npcs';
import { residentWalkRig } from '../settlements/residentWalk';
import { buildFieldProp, supportPosts } from './fieldPropArt';

type P = [number, number, number];
/** Standing points come from existing layout markers, then a short search for supported, clear ground. */
export function createFieldChapterScene(content: readonly FieldChapterContent[], anchor: (id: string) => readonly number[] | undefined,
  ground: (x: number, z: number, ceiling: number) => number | null, clear: (p: THREE.Vector3) => boolean,
  follow?: { anchors: readonly string[]; offset: () => { x: number; y: number; z: number } }) {
  const root = new THREE.Group(); root.name = 'RegionalFieldChapters';
  const markers: Marker[] = [], targets: THREE.Mesh[] = [], missing: string[] = [];
  const geo = new Set<THREE.BufferGeometry>(), mat = new Map<string, THREE.MeshStandardMaterial>();
  const points = new Map<string, P>(), riders = new Map<string, P>();
  const start = follow?.offset();
  let shipX = start?.x ?? 0, shipY = start?.y ?? 0, shipZ = start?.z ?? 0;
  for (const { set } of content) for (const a of set.actions) {
    // `near` is a layout marker id, or explicit world coordinates written as '@x,y,z'.
    const base = a.near.startsWith('@') ? a.near.slice(1).split(',').map(Number) : anchor(a.near);
    if (!base) { missing.push(`${a.id}<-${a.near}`); continue; }
    const [ox, oz] = a.off ?? [0, 0], by = base[1] - .9;
    let p: P | null = null;
    outer: for (const r of [0, 1.2, 2.4, 3.6, 5]) for (let i = 0; i < (r ? 12 : 1); i++) {
      const x = base[0] + ox + r * Math.cos(i * Math.PI / 6), z = base[2] + oz + r * Math.sin(i * Math.PI / 6), y = ground(x, z, by + 2.2);
      if (y !== null && Math.abs(y - by) < 3.5 && clear(new THREE.Vector3(x, y + .1, z))) { p = [x, y, z]; break outer; }
    }
    p ??= [base[0], by, base[2]];
    points.set(a.id, p);
    if (follow?.anchors.includes(a.near)) { const o = follow.offset(); riders.set(a.id, [p[0] - o.x, p[1] - o.y, p[2] - o.z]); }
    markers.push({ id: a.id, type: 'interact', label: `${a.chapter} · ${a.label[0]}`, p: [p[0], p[1] + .9, p[2]], radius: 2.8 });
  }
  // Each realm grades its props toward its own palette (and finish), so a crate or post in Winter
  // does not look like the same object in Kyoto or Black Sail.
  const PALETTE: Record<string, [number, number, number]> = { britain: [0x8e8a82, .22, .88], winter: [0xb8d0e0, .28, .7], blacksail: [0x4f6b66, .25, .9],
    kyoto: [0xa8452f, .18, .6], egypt: [0xd8b98a, .25, .85], orleans: [0x9a8566, .18, .86], qin: [0x8c7356, .25, .92], alpha: [0xe0dccf, .1, .78] };
  const modelMaterials: THREE.Material[] = [], animated: THREE.Object3D[] = []; let clock = 0;
  function material(key: string, make: () => THREE.MeshStandardMaterial) { let m = mat.get(key); if (!m) { m = make(); mat.set(key, m); } return m; }
  function palette(color: number, region: string) {
    const [tint, amount, roughness] = PALETTE[region] ?? PALETTE.alpha, base = new THREE.Color(color).lerp(new THREE.Color(tint), amount);
    return {
      body: material(`${color}:${region}`, () => new THREE.MeshStandardMaterial({ color: base, roughness })),
      trim: material(`${color}:${region}:trim`, () => new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(.62), roughness: Math.min(1, roughness + .05) })),
      iron: material(`iron:${region}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(0x34322f).lerp(new THREE.Color(tint), .12), roughness: .5, metalness: .55 })),
    };
  }
  /** A built object of the prop's exact size (see fieldPropArt); a shot target gets an invisible box to hit. */
  function crafted(size: readonly number[], color: number, region = 'alpha', shootable = false) {
    const group = buildFieldProp(size, palette(color, region), geo); root.add(group);
    let hit: THREE.Mesh | undefined;
    if (shootable) { const g = new THREE.BoxGeometry(size[0], size[1], size[2]); geo.add(g); hit = new THREE.Mesh(g, hidden); hit.name = 'FieldPropHitBox'; group.add(hit); }
    return { group, hit };
  }
  type EscortModel = 'stretcher' | 'receiving-mat' | 'muster-board';
  function escortModel(kind: EscortModel) {
    const group = new THREE.Group();
    function part(name: string, geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) {
      geo.add(geometry);
      const mesh = new THREE.Mesh(geometry, material(`escort:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: .87 })));
      mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
      return mesh;
    }
    if (kind === 'receiving-mat') {
      part('WovenReceivingMat', new THREE.BoxGeometry(2.04, .04, 2.44), 0x947351, 0, .025, -.65);
      for (const x of [-.84, .84]) part('MatBorder', new THREE.BoxGeometry(.07, .012, 2.44), 0x60564e, x, .05, -.65);
      part('LampPost', new THREE.CylinderGeometry(.046, .07, 1.39, 8), 0x705742, 1.07, .69, .08);
      part('LampHood', new THREE.ConeGeometry(.19, .14, 8), 0x4d4643, 1.07, 1.52, .08);
      const lamp = part('Lantern', new THREE.CylinderGeometry(.12, .10, .23, 8), 0xf3d895, 1.07, 1.34, .08);
      lamp.material.emissive.setHex(0xac742e); lamp.material.emissiveIntensity = .6;
      return group;
    }
    if (kind === 'muster-board') {
      for (const x of [.63, 1.53]) part('MusterUpright', new THREE.BoxGeometry(.09, 1.65, .12), 0x654b39, x, .82, .25);
      part('SlatRail', new THREE.BoxGeometry(1.15, .1, .14), 0x604832, 1.08, 1.52, .25);
      for (let i = 0; i < 7; i++) {
        const x = .71 + i * .126;
        part('BambooRegister', new THREE.BoxGeometry(.105, .60 - i % 3 * .03, .065), 0xbd9e68, x, 1.17, .27);
        for (const y of [1.19, 1.30]) part('InkMark', new THREE.BoxGeometry(.047, .025, .006), 0x564831, x, y, .307);
      }
      part('GatheringPennant', new THREE.BoxGeometry(.31, .61, .04), 0x975742, 1.75, 1.21, .25);
      return group;
    }
    for (const x of [-.28, .28]) {
      part('StretcherHandle', new THREE.CylinderGeometry(.034, .035, 2.32, 8).rotateX(Math.PI / 2), 0x79583d, x, 0, 0);
      for (const z of [-.67, .67]) part('StretcherFoot', new THREE.BoxGeometry(.065, .14, .08), 0x644831, x, -.06, z);
    }
    part('StretcherCanvas', new THREE.BoxGeometry(.57, .055, 1.68), 0xbfb59d, 0, .022, 0);
    part('CasualtyCoat', new THREE.CapsuleGeometry(.17, .52, 4, 10).rotateX(Math.PI / 2), 0x57636e, 0, .14, .02);
    part('CasualtyFace', new THREE.SphereGeometry(.124, 12, 8), 0xbc937b, 0, .17, .55);
    part('CasualtyWoolCap', new THREE.SphereGeometry(.127, 12, 8, 0, Math.PI * 2, 0, Math.PI * .54), 0x574e46, 0, .18, .57).rotation.x = .65;
    const blanket = part('CasualtyBlanket', new THREE.SphereGeometry(1, 12, 8), 0x8f9e9a, 0, .12, -.13);
    blanket.scale.set(.24, .15, .52);
    for (const x of [-.1, .1]) part('CasualtyBoot', new THREE.CapsuleGeometry(.068, .22, 3, 8).rotateX(Math.PI / 2), 0x514a42, x, .10, -.62);
    return group;
  }
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const posts: { prop: (typeof content)[number]['props'][number]; mesh: THREE.Object3D }[] = [];
  const lifts: { leaf: THREE.Object3D; ropes: THREE.Mesh[]; headY: number; halfHeight: number }[] = [];
  function payOutLiftRopes() {
    for (const { leaf, ropes, headY, halfHeight } of lifts) {
      const top = leaf.position.y + halfHeight;
      for (const rope of ropes) {
        rope.visible = leaf.visible;
        rope.position.y = (top + headY) / 2;
        rope.scale.y = Math.max(.02, headY - top);
      }
    }
  }
  const props = content.flatMap(({ set, props: list }) => list.flatMap(prop => {
    const at = points.get(prop.at); if (!at) return [];
    let mesh: THREE.Object3D;
    let hitBox: THREE.Mesh | undefined;
    if (prop.model === 'stretcher' || prop.model === 'receiving-mat' || prop.model === 'muster-board') {
      mesh = escortModel(prop.model); root.add(mesh);
    } else if (prop.model) {
      let model: THREE.Object3D;
      if (prop.model === 'shell') { const shell = makeLungingShell(prop.size, geo, modelMaterials); model = shell.group; hitBox = shell.hit; }
      else model = prop.model === 'chaser' ? makeChaserShip(prop.size, geo, modelMaterials) : prop.model === 'pennant' ? makeRelayPennant(prop.size, geo, modelMaterials) : makeWavingStandard(prop.size, geo, modelMaterials);
      root.add(model); mesh = model; animated.push(model);
    }
    else {
      const built = crafted(prop.size, prop.color, set.region, !!prop.target); mesh = built.group; hitBox = built.hit;
      // A prop left hanging in the air (a raised rack, a lifted gate) stands on two posts instead of floating.
      const guides = riders.has(prop.at) ? [] : supportPosts(prop, at, ground);
      for (const post of guides) {
        const height = post.top - post.bottom, g = new THREE.BoxGeometry(.2, height, .2); geo.add(g);
        const leg = new THREE.Mesh(g, palette(prop.color, set.region).trim); leg.castShadow = true; leg.receiveShadow = true;
        leg.position.set(post.x, post.bottom + height / 2, post.z); leg.name = `FieldPropPost_${prop.at}`; root.add(leg); posts.push({ prop, mesh: leg });
      }
      // A vertically sliding gate needs a lintel tying its two guide posts together.
      if (guides.length === 2 && prop.moved && prop.size[1] >= 1 && prop.size[2] < .5 &&
          prop.moved.off[0] === prop.off[0] && prop.moved.off[2] === prop.off[2]) {
        const [left, right] = guides;
        const length = Math.hypot(right.x - left.x, right.z - left.z);
        const g = new THREE.BoxGeometry(length + .35, .24, .4); geo.add(g);
        const cap = new THREE.Mesh(g, palette(prop.color, set.region).trim);
        cap.position.set((left.x + right.x) / 2, left.top + .05, (left.z + right.z) / 2);
        cap.rotation.y = Math.atan2(left.z - right.z, right.x - left.x);
        cap.name = `FieldPropLintel_${prop.at}`; root.add(cap); posts.push({ prop, mesh: cap });
        const cable = new THREE.CylinderGeometry(.032, .032, 1, 6); geo.add(cable);
        const ropes = [.22, .78].map(t => {
          const rope = new THREE.Mesh(cable, palette(prop.color, set.region).iron);
          rope.name = `FieldLiftRope_${prop.at}`;
          rope.position.set(left.x + (right.x - left.x) * t, 0, left.z + (right.z - left.z) * t);
          root.add(rope); return rope;
        });
        lifts.push({ leaf: mesh, ropes, headY: cap.position.y, halfHeight: prop.size[1] / 2 });
      }
    }
    mesh.name = prop.model === 'receiving-mat' || prop.model === 'muster-board' ? `FieldDestination_${prop.at}` : `FieldProp_${prop.at}`;
    // A modelled target is shot through its invisible hit box; the model hides with it.
    const shootable = hitBox ?? (mesh instanceof THREE.Mesh ? mesh : undefined);
    if (prop.target && shootable) { shootable.userData.target = prop.target; targets.push(shootable); }
    return [{ prop, mesh, hitBox }];
  }));
  const actors = createSettlementNpcs(content.flatMap(({ set, actors: list }) => list.map(actor => ({
    id: actor.id, role: actor.role, ...(['alpha', 'britain', 'winter', 'blacksail', 'kyoto'].includes(set.region) ? { region: set.region as 'alpha' } : { region: 'alpha' as const, worldRegion: set.region as 'egypt' }), position: [0, -500, 0] as P, appearance: { coat: actor.coat }, lines: [],
  }))));
  root.add(actors.group);
  const walkers = content.flatMap(({ actors: list }) => list.flatMap(actor => {
    if (!actor.escort) return [];
    const person = actors.group.getObjectByName('Resident_' + actor.id)!;
    return [{ actor, escort: actor.escort, person, walk: residentWalkRig(person), baseY: person.position.y,
      arms: [person.getObjectByName('ResidentArmLeft')!, person.getObjectByName('ResidentArmRight')!],
      phase: 0, last: null as P | null, placed: false, moving: false, carrying: false }];
  }));
  const stretchers = props.filter(({ prop }) => prop.model === 'stretcher').map(entry => ({ ...entry, last: null as P | null }));
  const receivingSites = props.filter(({ prop }) => prop.model === 'receiving-mat' || prop.model === 'muster-board');
  function escortPosition(pose: FieldEscortPose, right: number, forward: number, previous: P | null): P {
    const s = Math.sin(pose.yaw), c = Math.cos(pose.yaw);
    const x = pose.point[0] + right * c + forward * s, z = pose.point[2] - right * s + forward * c;
    if (previous && previous[0] === x && previous[2] === z) return previous;
    return [x, ground(x, z, pose.point[1] + 1.2) ?? pose.point[1], z];
  }
  const watched = [...new Set(content.flatMap(({ set }) => set.actions.flatMap(a => [a.id, ...(a.adds ?? [])])).concat(['sea_core', 'winter_core', 'sun_core']))];
  let lastKey = '';
  return {
    root, markers, targets, missing,
    point: (id: string) => points.get(id),
    apply(d: ReadonlySet<string>) {
      // Props may depend on flags outside the chapter (predicates), so any new fact re-applies.
      const key = `${d.size}:${watched.map(f => d.has(f) ? '1' : '0').join('')}`;
      if (key === lastKey) return;
      lastKey = key;
      for (const { prop, mesh, hitBox } of props) {
        const at = points.get(prop.at)!;
        const moved = prop.moved && (typeof prop.moved.when === 'string' ? d.has(prop.moved.when) : prop.moved.when(d)) ? prop.moved : null, off = moved?.off ?? prop.off, rot = moved?.rot ?? prop.rot ?? [0, 0, 0];
        mesh.position.set(at[0] + off[0], at[1] + off[1], at[2] + off[2]); mesh.rotation.set(rot[0], rot[1], rot[2]);
        mesh.visible = prop.show ? prop.show(d) : true;
        if (prop.target) mesh.visible &&= !d.has(prop.target);
        if (hitBox) hitBox.visible = mesh.visible;
      }
      payOutLiftRopes();
      for (const { prop, mesh } of posts) mesh.visible = (!prop.show || prop.show(d)) && (!prop.target || !d.has(prop.target));
      for (const { actors: list } of content) for (const actor of list) {
        const where = actor.place(d), at = where && points.get(where[0]);
        if (!at) { actors.pose(actor.id, [0, -500, 0], 0); continue; }
        const x = at[0] + where[1], z = at[2] + where[2], y = ground(x, z, at[1] + 2) ?? at[1];
        actors.pose(actor.id, [x, y, z], Math.atan2(at[0] - x, at[2] - z) || 0);
      }
      for (const walker of walkers) {
        walker.placed = !!walker.actor.place(d);
        if (!walker.placed) walker.last = null;
      }
    },
    update(dt: number, viewer: THREE.Vector3, progress?: (id: string) => number, escortPose?: (id: string) => FieldEscortPose | null) {
      const o = follow?.offset();
      if (o && Math.hypot(o.x - shipX, o.y - shipY, o.z - shipZ) > .01) {
        shipX = o.x; shipY = o.y; shipZ = o.z;
        for (const [id, base] of riders) {
          const p: P = [base[0] + o.x, base[1] + o.y, base[2] + o.z]; points.set(id, p);
          const marker = markers.find(m => m.id === id); if (marker) marker.p = [p[0], p[1] + .9, p[2]];
        }
        lastKey = '';
      }
      // Visible near any chapter site (sites span several regions, including Homeward Town).
      root.visible = [...points.values()].some(p => Math.abs(viewer.x - p[0]) < 260 && Math.abs(viewer.z - p[2]) < 260);
      if (root.visible && escortPose) {
        for (const { prop, mesh } of receivingSites) {
          if (!mesh.visible) continue;
          const pose = escortPose(prop.at);
          if (pose) mesh.position.set(...pose.destination);
        }
        for (const stretcher of stretchers) {
          const { prop, mesh } = stretcher;
          if (!mesh.visible) continue;
          const pose = escortPose(prop.at);
          if (!pose || Math.hypot(pose.point[0] - viewer.x, pose.point[2] - viewer.z) > 100) continue;
          stretcher.last = escortPosition(pose, prop.off[0], prop.off[2], stretcher.last);
          const [x, y, z] = stretcher.last;
          mesh.position.set(x, y + (pose.active && !pose.waiting ? .78 : prop.off[1]), z);
          mesh.rotation.y = pose.yaw;
        }
        for (const walker of walkers) {
          if (!walker.placed) continue;
          const pose = escortPose(walker.escort.action);
          if (!pose || Math.hypot(pose.point[0] - viewer.x, pose.point[2] - viewer.z) > 100) { walker.last = null; continue; }
          const p = escortPosition(pose, walker.escort.right, walker.escort.forward, walker.last);
          const step = walker.last ? Math.hypot(p[0] - walker.last[0], p[2] - walker.last[2]) : 0;
          actors.pose(walker.actor.id, p, pose.yaw);
          walker.phase += Math.min(step, .6) * 4.9;
          walker.last = p;
          walker.moving = pose.active && step > .001 && dt > 0;
          walker.carrying = pose.active && !pose.waiting && !!walker.escort.grips;
        }
      }
      actors.update(dt, viewer);
      if (root.visible && escortPose) for (const walker of walkers) {
        if (!walker.last || !walker.placed || !walker.person.visible) continue;
        walker.walk.update(walker.phase, walker.moving, walker.last[1] - walker.baseY);
        if (walker.carrying) for (const arm of walker.arms) arm.rotation.x = -.48;
      }
      clock += dt; if (root.visible) for (const o of animated) if (o.visible) (o.userData.animate as (t: number) => void)(clock);
      // Gliding props follow their work action's progress between the start and moved positions.
      if (progress && root.visible) for (const { prop, mesh } of props) {
        if (!prop.glide || !prop.moved || !mesh.visible) continue;
        const at = points.get(prop.at); if (!at) continue;
        const k = Math.min(1, Math.max(0, progress(prop.glide))), a = prop.off, b = prop.moved.off;
        mesh.position.set(at[0] + a[0] + (b[0] - a[0]) * k, at[1] + a[1] + (b[1] - a[1]) * k, at[2] + a[2] + (b[2] - a[2]) * k);
        const r0 = prop.rot ?? [0, 0, 0], r1 = prop.moved.rot ?? r0;
        mesh.rotation.set(r0[0] + (r1[0] - r0[0]) * k, r0[1] + (r1[1] - r0[1]) * k, r0[2] + (r1[2] - r0[2]) * k);
      }
      if (progress && root.visible) payOutLiftRopes();
    },
    dispose() { actors.dispose(); geo.forEach(g => g.dispose()); mat.forEach(m => m.dispose()); modelMaterials.forEach(m => m.dispose()); hidden.dispose(); root.removeFromParent(); },
  };
}
