import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { EGYPT_OFFSET, egyptDistanceToPolyline, egyptToWorld } from '../map/egyptPlan';
import { EGYPT_COLUMN_BRANCH, EGYPT_HIGH_BRANCH, EGYPT_HIGH_WALK_ENTRY, EGYPT_MAINTENANCE_DESCENT, EGYPT_SOLAR_APPROACH,
  EGYPT_SOLAR_FORK, EGYPT_SOLAR_MERGE, EGYPT_SOLAR_RETURN, EGYPT_TEMPLE_SIDE_DOOR, EGYPT_TEMPLE_SIDE_WALK,
  EGYPT_TEMPLE_WORKS, EGYPT_WHEEL_BYPASS, EGYPT_HIGH_STAIR, egyptInspectionWalk } from '../map/egyptRiverworksPlan';
import { polylineRibbon } from '../map/polylineRibbon';
import { landscapeWalkway, type LandscapePoint as Point } from './landscapeWalkway';

/** Old low-water maintenance entrance, inverted high waterway and the temple's
 * two-storey working side. All routes reconnect to the existing western temple
 * entrance; neither mirrors nor the sanctuary/tomb doors are bypassed. */
export function createEgyptTempleMaintenance(ground: (x: number, z: number, ceiling: number) => number | null) {
  const art = new SiteArt(), pale = '#d8c8a0', stone = '#b79b70', dark = '#7d684e', bronze = '#af914e', blue = '#477b80';
  const floor = (x: number, z: number) => { const [wx, wz] = egyptToWorld(x, z); return ground(wx, wz, 44) ?? 16; };
  const route = (points: readonly (readonly [number, number, number])[], width = 3.4, openings: { p: Point; radius: number }[] = [], supports = true) =>
    landscapeWalkway(art, points.map(p => [...p]), { width, floor: pale, edge: bronze, steps: true, rails: true, continuousCorners: true, supports: supports ? floor : undefined, railOpenings: openings });
  const [entrance, westBank, eastBank, junction] = EGYPT_MAINTENANCE_DESCENT;
  route([[-55, 16, 14], entrance], 3.8, [{ p: [-55, 16, 14], radius: 3 }, { p: [...entrance], radius: 5 }], false);
  route([entrance, westBank, [-39.9, 10, 47]], 4, [{ p: [...entrance], radius: 5 }, { p: [...westBank], radius: 3.1 }]);
  route([[-32.1, 10, 47], eastBank, junction], 4, [{ p: [...junction], radius: 4 }]);
  route(EGYPT_WHEEL_BYPASS, 3.2, EGYPT_WHEEL_BYPASS.map(p => ({ p: [...p], radius: 5 })));
  route(EGYPT_HIGH_STAIR, 3.2, EGYPT_HIGH_STAIR.map(p => ({ p: [...p], radius: 4.5 })), false);
  for (const x of [-47, -28]) {
    art.box([x, 11, 43.5], [2.4, 2, .7], stone, true);
    art.box([x, 11.9, 43.1], [2, .12, .08], blue);
    for (let i = 0; i < 5; i++) art.box([x, 10.4 + i * .27, 43.08], [1 + .16 * (i % 2), .05, .08], pale);
    art.lantern(x, 12.6, 43.8);
  }
  const pipe = new THREE.TorusGeometry(1.3, .25, 8, 24);
  art.add(pipe, stone, [-36, 11.7, 44], [1, 1, 1], true); pipe.dispose();
  for (const x of [-37, -36.5, -36, -35.5, -35]) art.box([x, 11.7, 43.8], [.09, 2.2, .15], bronze, true);
  art.box([-36, 13.4, 44], [4, .4, 1.5], pale, true);

  const flowing: { mesh: THREE.Mesh; points: THREE.Vector3[]; length: number }[] = [];
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#6ab7c7', roughness: .22, metalness: .26, transparent: true, opacity: .8, side: THREE.DoubleSide });
  const foamMaterial = new THREE.MeshBasicMaterial({ color: '#d4f5e9', transparent: true, opacity: .72, depthWrite: false });
  const waterGeometries: THREE.BufferGeometry[] = [];
  const channels = [EGYPT_SOLAR_APPROACH, EGYPT_HIGH_BRANCH, EGYPT_COLUMN_BRANCH, EGYPT_SOLAR_RETURN];
  function highChannel(points: readonly (readonly [number, number, number])[], exits: readonly number[], shadow = false) {
    const others = channels.filter(channel => channel !== points);
    const vertices = polylineRibbon(points, 4.4), walk = egyptInspectionWalk(points);
    const junctions: { p: Point; radius: number }[] = [
      { p: [...EGYPT_SOLAR_FORK], radius: 10 }, { p: [...EGYPT_SOLAR_MERGE], radius: 7 },
    ];
    for (const other of others) for (let i = 1; i < other.length; i++) {
      const a = new THREE.Vector3(...other[i - 1]), b = new THREE.Vector3(...other[i]);
      const sections = Math.ceil(a.distanceTo(b) / 1.5);
      for (let j = 0; j <= sections; j++) {
        const p = a.clone().lerp(b, j / sections);
        const channel = egyptDistanceToPolyline(p.x, p.z, points);
        if (channel.d < 8 && Math.abs(p.y - channel.y) < 2.3) junctions.push({ p: p.toArray(), radius: 2.3 });
      }
    }
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!i) continue;
      const a = new THREE.Vector3(...points[i - 1]), b = new THREE.Vector3(...p), d = b.clone().sub(a), run = Math.hypot(d.x, d.z);
      const side = new THREE.Vector3(d.z / run, 0, -d.x / run), middle = a.clone().lerp(b, .5);
      const rot = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.atan2(d.y, run), Math.atan2(d.x, d.z), 0, 'YXZ')));
      const angles: Point = [rot.x, rot.y, rot.z];
      art.box([middle.x, middle.y - .8, middle.z], [5.2, .8, d.length() + .2], stone, true, 'body', angles);
      // Leave clear water where the branches meet and through the open sides of each berth.
      const cutStart = i === 1 ? 4.4 : exits.includes(i - 1) ? 3.1 : .55;
      const cutEnd = i === points.length - 1 ? 4.4 : exits.includes(i) ? 3.1 : .55;
      const wallRun = run - cutStart - cutEnd, wallSections = Math.max(1, Math.ceil(wallRun / 2.2));
      for (const sign of [-1, 1]) {
        let start = cutStart;
        for (let section = 0; section <= wallSections; section++) {
          const end = cutStart + wallRun * section / wallSections;
          const edge = a.clone().addScaledVector(d, (end + wallRun / (wallSections * 2)) / run).addScaledVector(side, sign * 2.5);
          const crosses = others.some(other => {
            const crossing = egyptDistanceToPolyline(edge.x, edge.z, other);
            return crossing.d < 2.2 && Math.abs(crossing.y - edge.y) < 1.45;
          });
          if (section < wallSections && !crosses) continue;
          if (end - start > .04) {
            const center = a.clone().addScaledVector(d, (start + end) / (2 * run)).addScaledVector(side, sign * 2.5);
            const length = (end - start) * d.length() / run;
            art.box([center.x, center.y + .05, center.z], [.55, 1.4, length], pale, true, 'body', angles);
            art.box([center.x, center.y + .79, center.z], [.68, .12, length], blue, false, 'body', angles);
          }
          start = end + wallRun / wallSections;
        }
      }
      // Broad masonry arches carry the water and inspection walk together.
      // This replaces the forest of temporary scaffold posts below a high route.
      const axis = new THREE.Vector3(d.x / run, 0, d.z / run), yaw = -Math.atan2(d.z, d.x);
      for (let along = 6; along < run - 4; along += 12) {
        const p = a.clone().lerp(b, along / run).addScaledVector(side, 2.1), base = floor(p.x, p.z), height = p.y - base;
        // Leave a clear span where the lower maintenance route passes beneath
        // the aqueduct; adjacent arches carry this short street opening.
        const lowerWalk = egyptDistanceToPolyline(p.x, p.z, EGYPT_WHEEL_BYPASS);
        if (lowerWalk.d < 11 && p.y - lowerWalk.y < 14) continue;
        if (height < 5) {
          if (height > 1) art.box([p.x, (p.y + base) / 2 - .4, p.z], [1.8, height, 8.6], stone, true, 'body', [0, yaw, 0]);
          continue;
        }
        const r = Math.min(5.7, height - 1.7), inner = r - .8, spring = p.y - 1.1 - r;
        const shape = new THREE.Shape(); shape.moveTo(r, 0);
        for (let k = 0; k <= 20; k++) { const t = k / 20 * Math.PI; shape.lineTo(Math.cos(t) * r, Math.sin(t) * r); }
        shape.lineTo(-inner, 0);
        for (let k = 20; k >= 0; k--) { const t = k / 20 * Math.PI; shape.lineTo(Math.cos(t) * inner, Math.sin(t) * inner); }
        shape.closePath();
        const arch = new THREE.ExtrudeGeometry(shape, { depth: 8.6, bevelEnabled: false, steps: 1 }); arch.translate(0, 0, -4.3);
        art.add(arch, pale, [p.x, spring, p.z], [1, 1, 1], true, 'body', [0, yaw, 0]); arch.dispose();
        for (const s of [-1, 1]) {
          const foot = p.clone().addScaledVector(axis, s * (r - .4)), bottom = Math.min(spring - .15, floor(foot.x, foot.z) - .2);
          art.box([foot.x, (spring + bottom) / 2, foot.z], [.95, spring - bottom, 8.6], stone, true, 'body', [0, yaw, 0]);
          art.box([foot.x, bottom + .25, foot.z], [1.5, .5, 9], pale, true, 'body', [0, yaw, 0]);
        }
      }
      // Stone pylons at the landings support both channel and inspection ledge.
      if (i % 2 || shadow) {
        const bottom = floor(p[0], p[2]);
        if (p[1] - bottom > 1) {
          art.box([p[0], (p[1] + bottom) / 2 - .4, p[2]], [2.2, p[1] - bottom, 2.6], stone, true);
          art.box([p[0], p[1] - 1.1, p[2]], [7.1, .8, 4], pale, true);
          art.box([p[0], p[1] - 1.65, p[2]], [5.7, .3, 3.4], blue);
        }
      }
      if (shadow && i < points.length - 1) {
        for (const s of [-1, 1]) {
          const c = b.clone().addScaledVector(side, s * 3.8);
          art.cyl([c.x, p[1] + 2.8, c.z], .45, 5.6, pale, true);
          art.cyl([c.x, p[1] + 5.5, c.z], .9, .6, blue);
        }
        art.box([p[0], p[1] + 5.9, p[2]], [8.8, .45, 4.5], pale, false, 'body', [0, Math.atan2(d.x, d.z), 0]);
      }
    }
    for (const i of exits) junctions.push({ p: walk[i], radius: shadow && i === 2 ? 5 : 3.4 });
    route(walk, 3.6, [{ p: walk[0], radius: 4 }, { p: walk[walk.length - 1], radius: 4 }, ...junctions], false);
    for (const i of exits) {
      const [x, y, z] = walk[i];
      art.box([x, y + .025, z], [1.45, .055, 1.45], blue, false, 'body', [0, Math.PI / 4, 0]);
    }
    // Broad end landings meet the shared entrance and the temple stair.
    for (const i of [0, points.length - 1]) {
      if (points[i] === EGYPT_SOLAR_FORK || points[i] === EGYPT_SOLAR_MERGE) continue;
      const berth: Point = [points[i][0], points[i][1] + .3, points[i][2]];
      route([berth, walk[i]], 4, [{ p: berth, radius: 5.2 }], false);
    }
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals(); waterGeometries.push(geometry);
    const water = new THREE.Mesh(geometry, waterMaterial); art.root.add(water);
    // Short moving reed/foam strokes reveal the impossible upstream direction.
    const v = points.map(p => new THREE.Vector3(...p)), length = v.slice(1).reduce((n, p, i) => n + p.distanceTo(v[i]), 0);
    const streakCount = Math.max(1, Math.ceil(length / 26));
    for (let i = 0; i < streakCount; i++) {
      const g = new THREE.PlaneGeometry(.14, 1.5).rotateX(-Math.PI / 2); waterGeometries.push(g);
      const mesh = new THREE.Mesh(g, foamMaterial); mesh.userData.offset = i / streakCount; art.root.add(mesh); flowing.push({ mesh, points: v, length });
    }
  }
  highChannel(EGYPT_SOLAR_APPROACH, []);
  highChannel(EGYPT_HIGH_BRANCH, [2, 4, 6]);
  highChannel(EGYPT_COLUMN_BRANCH, [2, 4], true);
  highChannel(EGYPT_SOLAR_RETURN, []);
  // The east bridge clears the boat channel overhead and enters the main inspection ledge.
  route(EGYPT_HIGH_WALK_ENTRY, 3.25, EGYPT_HIGH_WALK_ENTRY.map(p => ({ p: [...p], radius: 3.2 })), false);
  for (const [x, y, z] of EGYPT_HIGH_WALK_ENTRY.slice(1, -1)) {
    if (x > 8 && z < 78) continue;
    const [wx, wz] = egyptToWorld(x, z);
    const bottom = ground(wx, wz, y - .8);
    if (bottom === null || y - bottom < 1) continue;
    const top = y - .85;
    art.box([x, (bottom + top) / 2, z], [1.3, top - bottom, 1.3], stone, true);
    art.box([x, top - .19, z], [2.1, .38, 2.1], pale, true);
  }
  for (const [x, y, z] of [EGYPT_HIGH_WALK_ENTRY[0], EGYPT_HIGH_WALK_ENTRY[4]]) art.lantern(x, y + 1.45, z + 1.4);
  const mergeWalk = [[-18.55, 36.3, -91.35], [-20, 36.3, -92.2], [-18.47, 36.3, -93.08]] as const;
  route(mergeWalk, 3.6, mergeWalk.map(p => ({ p: [...p], radius: 3 })), false);
  // The shaded inspection walk has a landward entrance outside the shared boat approach.
  route([[-20.9, 24.3, 85.5], [-24.7, 25.7, 81.4], [-25.1, 26.55, 75.7]], 3.2,
    [{ p: [-25.1, 26.55, 75.7], radius: 3.6 }]);
  for (const [x, y, z] of [EGYPT_SOLAR_FORK, EGYPT_SOLAR_MERGE]) {
    const pool = new THREE.CircleGeometry(2.23, 20).rotateX(-Math.PI / 2).translate(x, y - .025, z);
    waterGeometries.push(pool); art.root.add(new THREE.Mesh(pool, waterMaterial));
    art.cyl([x, y - .81, z], 2.6, .76, stone, true);
  }
  // Two colored beacons identify the channels from either side of the fork.
  for (const [x, y, z, color] of [[-11, 26.3, 70, bronze], [-22, 26.2, 70, blue],
    [-9, 36.2, -87, bronze], [-19, 36.2, -87, blue]] as const) {
    art.cyl([x, y + .78, z], .14, 1.56, color);
    art.ring([x, y + 1.53, z], .36, .07, color);
    art.lantern(x, y + 1.8, z);
  }
  // Short branch rejoin and the always-available stair down to the temple yard.
  route([[-6, 36.3, -146], [10, 36.3, -146], [10, 32, -164], [12, 32, -164]], 4, [{ p: [-6, 36.3, -146], radius: 6 }]);
  route([[-17, 24, 82], [-17, 24.3, 87], [-12, 24.3, 87]], 4, [
    { p: [-17, 24.3, 82], radius: 5 }, { p: [-12, 24.3, 87], radius: 3 },
  ]);
  // Mooring platforms leave the working rope side open and carry people on real deck planks.
  for (const [x, y, z, w, d] of [[-18.6, 24.3, 86.7, 6.6, 4.2], [-1.1, 36.3, -146, 6.4, 5.4]]) {
    art.box([x, y - .2, z], [w, .4, d], '#a58a60', true);
    for (let i = -w / 2 + .27; i < w / 2; i += .53) art.box([x + i, y + .009, z], [.027, .018, d - .13], bronze);
    for (const sign of [-1, 1]) art.cyl([x + sign * (w / 2 - .45), y + .45, z + d / 2 - .35], .15, .9, bronze, true);
  }

  const works = EGYPT_TEMPLE_WORKS, low = works.floor, high = works.gallery;
  art.box([20, low - .18, -150], [24, .36, 52], stone, true);
  for (const x of [8, 32]) {
    art.box([x, 28.6, -150], [.7, 9.2, 52], stone, true);
    for (let z = -170; z <= -130; z += 10) {
      art.cyl([x === 8 ? 12 : 28, low + 5.5, z], .65, 11, pale, true);
      art.cyl([x === 8 ? 12 : 28, low + .25, z], 1.15, .5, dark, true);
      art.cyl([x === 8 ? 12 : 28, low + 10.7, z], 1.2, .6, blue);
      art.lantern(x === 8 ? 8.8 : 31.2, low + 2.5, z);
    }
  }
  // Upper columns sit outside the ledge's clear walking strip; the lower aisle
  // remains wide enough for combat and for looking up through the colonnade.
  // The east gallery has a real lift bay, rather than a solid floor through the boat.
  const galleryOpenings = [{ p: [15.5, high, -164] as Point, radius: 4 }, { p: [24.5, high, -171] as Point, radius: 3.1 },
    { p: [24.5, high, -128] as Point, radius: 4 }, { p: [20, high, -171] as Point, radius: 3.6 },
    { p: [15.5, high, -134] as Point, radius: 3.6 }];
  route([[15.5, high, -128], [15.5, high, -171], [24.5, high, -171], [24.5, high, -144.1]], 3, galleryOpenings);
  route([[24.5, high, -135.9], [24.5, high, -128], [15.5, high, -128]], 3, galleryOpenings);
  route([[12, high, -164], [15.5, high, -164]], 3.2);
  route([[20, high, -171], [20, high, -167.5], [20, 28, -154.5], [20, 28, -150.5], [20, low, -137.5]], 3.2);
  route([[24.5, high, -128], [28, high, -118], [34, 30, -110]], 4.4);
  // Lower service return climbs at the opposite end, making a complete loop.
  route([[10, low, -164], [10, low, -160], [10, 28, -147], [10, 28, -143], [10, high, -130], [15.5, high, -134]], 2.6);
  art.box([20, low + 1.6, -127], [9, 3.2, .55], stone, true);
  const seam = EGYPT_TEMPLE_SIDE_DOOR, wing = (9 - seam.width) / 2;
  for (const sign of [-1, 1]) {
    art.box([seam.x + sign * (seam.width + wing) / 2, low + 1.6, seam.z], [wing, 3.2, .62], stone, true);
    art.box([seam.x + sign * (seam.width / 2 + .17), low + 1.48, seam.z], [.34, 2.96, .87], pale, true);
  }
  art.box([seam.x, low + seam.height + .46, seam.z], [seam.width + .6, .92, .86], pale, true);
  art.ring([seam.x, low + seam.height + .45, seam.z + .48], .3, .045, bronze);
  for (const x of [18.2, 18.8, 19.4, 20]) art.box([x, low + .012, -169.5 - (x - 18.2) * 1.1],
    [.42, .024, .13], '#e4c67b', false, 'metal', [0, -Math.PI / 4, 0]);
  route(EGYPT_TEMPLE_SIDE_WALK, 3.1, EGYPT_TEMPLE_SIDE_WALK.map(p => ({ p: [...p], radius: 2.8 })));
  // The outer stair is a separate maintenance return from the upper gallery.
  for (const [x, y, z] of [[20, low, -178], [25.5, 26.2, -185.5], [30, 29.5, -179.5]]) {
    art.lantern(x - 1.7, y + 1.5, z);
  }
  for (let z = -168; z <= -132; z += 12) {
    art.box([9.4, low + 1.1, z], [1.6, 2.2, 3.4], dark, true);
    art.box([30.6, low + .8, z], [1.6, 1.6, 2.2], stone, true);
    art.paper(30.5, low + 1.62, z, 1, .8);
  }
  // Small engineering specimen: separate central slide and side receiving
  // grooves make the large gate's construction readable at human scale.
  art.box([19.5, low + .7, -133.5], [6.5, 1.4, 3.2], dark, true);
  art.box([19.5, low + 1.5, -133.5], [2.6, .2, 2.7], blue);
  for (const x of [17.5, 21.5]) art.box([x, low + 1.5, -133.5], [.6, .15, 2.9], bronze);

  const frame = new THREE.Matrix4().makeRotationY(Math.PI); frame.setPosition(EGYPT_OFFSET[0], 0, EGYPT_OFFSET[1]); art.relocate(frame);
  const geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose());
  const collider: Collider = { name: 'COL_EgyptTempleMaintenance', bvh: new MeshBVH(geometry), enabled: true };
  art.finish('alpha'); art.root.name = 'EgyptTempleWorkingSide';
  const markers: Marker[] = [
    { id: 'egypt_low_maintenance', type: 'poi', label: '旧水车 · 下行检修道', p: new THREE.Vector3(-42, 10, 47).applyMatrix4(frame).toArray() },
    { id: 'egypt_high_waterway', type: 'poi', label: '倒置水道 · 柱影航路', p: new THREE.Vector3(-40, 28, 64).applyMatrix4(frame).toArray() },
    { id: 'egypt_temple_working_side', type: 'poi', label: '神庙背面 · 两层检修柱廊', p: new THREE.Vector3(24.5, high, -128).applyMatrix4(frame).toArray() },
    { id: 'egypt_temple_service_stair', type: 'poi', label: '神庙背面 · 侧门外梯', p: new THREE.Vector3(30, 27.8, -185.5).applyMatrix4(frame).toArray() },
  ];
  let time = 0;
  return { root: art.root, collider, markers,
    update(dt: number, player: THREE.Vector3) {
      art.root.visible = Math.hypot(player.x, player.z + 1410) < 440;
      if (!art.root.visible) return;
      time += Math.max(0, Math.min(dt, .1));
      for (const flow of flowing) {
        let distance = ((time * 2 / flow.length + flow.mesh.userData.offset) % 1) * flow.length;
        for (let i = 1; i < flow.points.length; i++) {
          const a = flow.points[i - 1], b = flow.points[i], length = a.distanceTo(b);
          if (distance > length) { distance -= length; continue; }
          flow.mesh.position.copy(a).lerp(b, distance / length); flow.mesh.position.y += .035;
          flow.mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); break;
        }
      }
    },
    dispose() {
      collider.enabled = false; geometry.dispose(); waterGeometries.forEach(g => g.dispose()); waterMaterial.dispose(); foamMaterial.dispose();
      for (const mesh of art.layers.values()) mesh.geometry.dispose(); for (const m of Object.values(art.materials)) m.dispose(); art.root.removeFromParent();
    },
  };
}
