import * as THREE from 'three';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { climaxCheckpoint, climaxCleared, climaxMarker, climaxTarget, QIN_GENERAL_DOWN, REALM_CLIMAX_IDS, REALM_CLIMAXES, type ClimaxPoint, type ClimaxTell, type RealmClimaxId, type createRealmClimax } from '../story/realmClimaxes';
import type { JourneyPoint } from '../story/worldJourney';

type Ground = (x: number, z: number, ceiling: number) => number | null;
type Reach = (a: THREE.Vector3, b: THREE.Vector3) => boolean;
type Site = ReturnType<typeof createSite>;
const raised = ([x, y, z]: JourneyPoint, dy: number) => new THREE.Vector3(x, y + dy, z);
const colors = { egypt: '#977052', orleans: '#8f4a3d', qin: '#6c867b' };
const groups = { egypt: 'TideEater', orleans: 'Bridgefort', qin: 'SealingGeneral' };

export function createRealmClimaxSites(anchors: Record<RealmClimaxId, Marker>, ground: Ground, clear: (p: THREE.Vector3) => boolean, reachable: Reach) {
  const root = new THREE.Group(); root.name = 'RealmClimaxSites';
  const sites = {} as Record<RealmClimaxId, Site>;
  for (const id of REALM_CLIMAX_IDS) {
    sites[id] = createSite(id, anchors[id], ground, clear, reachable);
    root.add(sites[id].root);
  }
  return {
    root, sites,
    markers: REALM_CLIMAX_IDS.flatMap(id => sites[id].markers),
    targets: REALM_CLIMAX_IDS.flatMap(id => sites[id].targets),
    apply(done: ReadonlySet<string>) { for (const site of Object.values(sites)) site.apply(done); },
    dispose() { for (const site of Object.values(sites)) site.dispose(); root.removeFromParent(); },
  };
}

function createSite(id: RealmClimaxId, anchor: Marker, ground: Ground, clear: (p: THREE.Vector3) => boolean, reachable: Reach) {
  const start: JourneyPoint = [anchor.p[0], anchor.p[1] - .92, anchor.p[2]];
  const [sx, sy, sz] = start;
  function choose(offsets: readonly (readonly [number, number])[], reference = start): JourneyPoint {
    for (const [dx, dz] of offsets) {
      const x = sx + dx, z = sz + dz, y = ground(x, z, sy + 2.4);
      if (y === null || Math.abs(y - sy) > 1.55) continue;
      const p: JourneyPoint = [x, y, z];
      if (clear(raised(p, .04)) && reachable(raised(reference, 1.25), raised(p, 1.25))) return p;
    }
    return start;
  }

  const boss = choose([[0, -8], [0, 8], [8, 0], [-8, 0], [5, -5], [-5, -5], [5, 5], [-5, 5], [0, -5], [0, 5]]);
  const west = choose([[-4.2, 0], [-4, 3], [0, 4.5], [4.2, -3], [-3, -2], [3, 3]]);
  const east = choose([[4.2, 0], [4, 3], [0, -4.5], [-4.2, 3], [3, -2], [-3, 3]]);
  const safeWest: JourneyPoint = west === start ? [sx, sy, sz] : west;
  const safeEast: JourneyPoint = east === start ? [sx, sy, sz] : east;
  const origin: ClimaxPoint = { x: boss[0], y: boss[1], z: boss[2] };
  const markers: Marker[] = [
    { ...anchor, id: climaxMarker(id, 'start'), label: REALM_CLIMAXES[id].start[0] },
    { id: climaxMarker(id, 'west'), type: 'interact', p: raised(safeWest, .92).toArray(), radius: 2.4, label: '左侧机关' },
    { id: climaxMarker(id, 'east'), type: 'interact', p: raised(safeEast, .92).toArray(), radius: 2.4, label: '右侧机关' },
  ];
  const art = new SiteArt();
  for (const [point, tint] of [[safeWest, '#71ad9f'], [safeEast, '#dbad68']] as const) {
    const [x, y, z] = point;
    art.box([x, y + .45, z - .7], [.58, .9, .46], '#424747');
    art.box([x, y + .91, z - .7], [1.03, .13, .65], colors[id]);
    art.box([x, y + 1, z - .67], [.61, .06, .31], tint, false, 'glow');
    art.box([x, y + .023, z], [1.45, .035, 1.35], tint);
  }
  art.finish('alpha');
  art.root.name = groups[id];
  const body = new THREE.Group(); body.name = `${groups[id]}Body`;
  body.position.fromArray(boss);
  body.rotation.y = Math.atan2(sx - boss[0], sz - boss[2]);
  art.root.add(body);
  const hide = new THREE.MeshStandardMaterial({ color: colors[id], roughness: .67, metalness: id === 'qin' ? .45 : .14 });
  const trim = new THREE.MeshStandardMaterial({ color: id === 'egypt' ? '#577a70' : '#d4b47d', roughness: .42, metalness: .42 });
  const lit = new THREE.MeshStandardMaterial({ color: '#4f967e', emissive: '#3a745e', emissiveIntensity: .85 });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCone = new THREE.ConeGeometry(.5, 1, 5);
  function part(geometry: THREE.BufferGeometry, material: THREE.Material, p: JourneyPoint, scale: JourneyPoint, rx = 0, rz = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.fromArray(p); mesh.scale.fromArray(scale); mesh.rotation.set(rx, 0, rz);
    mesh.castShadow = true; mesh.receiveShadow = true; body.add(mesh); return mesh;
  }
  if (id === 'egypt') {
    part(unitBox, hide, [0, 1.12, -.66], [3.15, 1.55, 4.8]);
    part(unitBox, hide, [0, 1.13, 2.05], [2.3, .92, 2.6]);
    part(unitBox, trim, [0, .68, 2.45], [2.15, .31, 2.4]);
    part(unitCone, hide, [0, .7, -3.8], [1.65, 3.4, 1.6], -Math.PI / 2);
    for (const x of [-1.55, 1.55]) {
      for (const z of [-1.8, .8]) part(unitBox, hide, [x, .38, z], [.84, .75, 1.22], 0, x * .24);
      for (const z of [-2.4, -1.35, -.3, .72]) part(unitCone, trim, [x * .58, 2.01, z], [.81, 1.03, .84]);
    }
  } else {
    part(unitBox, hide, [0, 1.28, 0], [.94, 1.03, .48]);
    part(unitBox, trim, [0, 2.03, .01], [.54, .59, .53]);
    part(unitBox, hide, [0, .48, 0], [1.1, .8, .52]);
    for (const side of [-1, 1]) part(unitBox, trim, [side * .61, 1.43, .03], [.36, .73, .36], 0, side * .27);
    if (id === 'qin') {
      part(unitBox, trim, [-.7, 1.04, .42], [.73, 1.24, .15], 0, -.22);
      part(unitBox, trim, [.78, 1.66, .12], [.14, 2.9, .14], 0, .18);
      part(unitCone, trim, [.53, 3.14, .12], [.43, .84, .43], 0, .18);
    } else {
      part(unitBox, trim, [0, 2.27, .1], [.92, .14, .8]);
      for (const side of [-1, 1]) {
        part(unitBox, hide, [side * 1.44, .96, -.1], [1.18, 1.9, .23]);
        part(unitBox, trim, [side * 1.44, 1.18, .05], [.73, .16, .14]);
      }
    }
  }
  const weakMat = new THREE.MeshStandardMaterial({ color: '#f7cf75', emissive: '#f9b74c', emissiveIntensity: .6, roughness: .48 });
  const targetGeometry = id === 'egypt' ? new THREE.OctahedronGeometry(.68, 0) : new THREE.BoxGeometry(.64, .87, .28);
  const targets = [0, 1].map(index => {
    const mesh = new THREE.Mesh(targetGeometry, weakMat);
    mesh.name = `${groups[id]}Target${index + 1}`;
    mesh.position.set(id === 'orleans' ? (index ? 1.44 : -1.44) : id === 'egypt' && index ? .58 : 0,
      id === 'egypt' ? (index ? 1.9 : 1.65) : 1.46, id === 'egypt' ? 2.85 : .51);
    mesh.userData.target = climaxTarget(id, index); mesh.userData.realmClimax = id; mesh.userData.realmPhase = index;
    mesh.visible = false; body.add(mesh); return mesh;
  });

  const warning = new THREE.MeshBasicMaterial({ color: '#ff8d57', transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide });
  const warningPlane = new THREE.PlaneGeometry(1, 1, 1, 10).rotateX(-Math.PI / 2);
  const beam = new THREE.Mesh(warningPlane, warning), cross = new THREE.Mesh(warningPlane.clone(), warning);
  const ring = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), warning);
  const warningVertices = new Map([beam, cross, ring].map(mesh => [mesh, mesh.geometry.attributes.position.clone()]));
  art.root.add(beam, cross, ring);
  beam.visible = cross.visible = ring.visible = body.visible = false;
  const result = new THREE.Group(); result.name = `${groups[id]}Handover`; result.visible = false; art.root.add(result);
  const fixed = (p: JourneyPoint, scale: JourneyPoint, material: THREE.Material) => {
    const mesh = new THREE.Mesh(unitBox, material); mesh.position.fromArray(p); mesh.scale.fromArray(scale); result.add(mesh); return mesh;
  };
  if (id === 'egypt') {
    for (let i = 0; i < 6; i++) {
      const t = (i + .5) / 6, x = THREE.MathUtils.lerp(sx, boss[0], t), z = THREE.MathUtils.lerp(sz, boss[2], t);
      const stream = fixed([x, (ground(x, z, sy + 2.4) ?? sy) + .065, z], [1.7, .06, 1.42], lit);
      stream.rotation.y = body.rotation.y;
    }
  } else if (id === 'orleans') {
    const [x, y, z] = safeWest;
    fixed([x, y + 1.25, z - .65], [.12, 2.5, .12], trim);
    fixed([x + .53, y + 2.13, z - .65], [1.1, .68, .08], hide);
    fixed([x + .53, y + 2.13, z - .6], [.53, .095, .027], trim);
  } else {
    const [x, y, z] = safeEast;
    fixed([x, y + .49, z - .65], [1.02, .98, .45], hide);
    fixed([x, y + 1.015, z - .65], [1.12, .14, .65], trim);
    fixed([x, y + 1.12, z - .65], [.36, .09, .26], lit);
  }
  const indicators = [safeWest, safeEast].map(([x, y, z]) => {
    const mesh = new THREE.Mesh(unitBox, lit); mesh.position.set(x, y + 1.063, z - .67); mesh.scale.set(.59, .07, .29);
    mesh.visible = false; art.root.add(mesh); return mesh;
  });
  let done: ReadonlySet<string> = new Set();
  function paintWarning(mesh: typeof beam | typeof ring, x: number, z: number, angle: number, width: number, depth: number) {
    const source = warningVertices.get(mesh)!;
    const target = mesh.geometry.attributes.position;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (let i = 0; i < source.count; i++) {
      const dx = source.getX(i) * width, dz = source.getZ(i) * depth;
      const wx = x + dx * cos + dz * sin, wz = z - dx * sin + dz * cos;
      target.setXYZ(i, wx, (ground(wx, wz, sy + 2.4) ?? sy) + .075, wz);
    }
    target.needsUpdate = true; mesh.geometry.computeBoundingSphere();
  }
  function showTell(tell: ClimaxTell | null) {
    beam.visible = !!tell && tell.shape !== 'circle'; cross.visible = tell?.shape === 'cross'; ring.visible = tell?.shape === 'circle';
    if (!tell) return;
    const angle = Math.atan2(tell.x - origin.x, tell.z - origin.z), vx = Math.sin(angle), vz = Math.cos(angle);
    if (ring.visible) {
      paintWarning(ring, tell.x, tell.z, 0, tell.width, tell.width);
      return;
    }
    const x = origin.x + vx * tell.length / 2, z = origin.z + vz * tell.length / 2;
    paintWarning(beam, x, z, angle, tell.width * 2, tell.length);
    if (cross.visible) {
      const n = Math.hypot(tell.x - origin.x, tell.z - origin.z) * .65;
      const cx = origin.x + vx * n, cz = origin.z + vz * n;
      paintWarning(cross, cx, cz, angle + Math.PI / 2, tell.width * 2, tell.length * .9);
    }
  }
  let lastTell: ClimaxTell | null = null;
  return {
    root: art.root, markers, targets, origin, start,
    apply(flags: ReadonlySet<string>) {
      done = flags;
      result.visible = done.has(climaxCleared(id));
    },
    update(fight: ReturnType<typeof createRealmClimax>) {
      body.visible = fight.phase >= 0 && fight.phase < 2 && !(id === 'qin' && done.has(QIN_GENERAL_DOWN));
      if (id === 'qin' && fight.phase === 1 && done.has(climaxCheckpoint(id, 0)) && body.visible) body.rotation.x = -.14;
      else body.rotation.x = 0;
      for (const [index, target] of targets.entries()) target.visible = body.visible && fight.phase === index && fight.hp > 0;
      indicators[0].visible = fight.phase >= 0 && fight.stationWorked('west');
      indicators[1].visible = fight.phase >= 0 && fight.stationWorked('east');
      weakMat.emissiveIntensity = fight.exposed ? 1.15 : .05;
      weakMat.color.setHex(fight.exposed ? 0xf7cf75 : 0x655f58);
      if (fight.tell !== lastTell) { lastTell = fight.tell; showTell(lastTell); }
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      art.root.traverse(node => { if (node instanceof THREE.Mesh) geometries.add(node.geometry); });
      geometries.forEach(geometry => geometry.dispose());
      for (const material of [...Object.values(art.materials), hide, trim, lit, weakMat, warning]) material.dispose();
      art.root.removeFromParent();
    },
  };
}
