import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider, Player } from '../player/player';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { EGYPT_TEMPLE_WORKS_STATE as S, EGYPT_TEMPLE_WORK_LABELS } from '../story/egyptTempleWorks';
import { landscapeWalkway } from './landscapeWalkway';
import { EGYPT_OFFSET } from '../map/egyptPlan';
import { EGYPT_TEMPLE_SIDE_DOOR, EGYPT_TEMPLE_WORKS } from '../map/egyptRiverworksPlan';

/** Working gate specimen and reusable hoist. Both permanent stairs stay open. */
export function createEgyptTempleMechanisms() {
  const root = new THREE.Group(); root.name = 'EgyptTempleMechanisms';
  const frame = new THREE.Matrix4().makeRotationY(Math.PI); frame.setPosition(EGYPT_OFFSET[0], 0, EGYPT_OFFSET[1]);
  const local = (x: number, y: number, z: number): [number, number, number] => [EGYPT_OFFSET[0] - x, y, EGYPT_OFFSET[1] - z];
  const arts: SiteArt[] = [], geometries: THREE.BufferGeometry[] = [], colliders: Collider[] = [];
  const stone = '#d6c39c', wood = '#8c6848', bronze = '#a48b51';
  function finish(art: SiteArt, name: string) {
    art.relocate(frame); art.finish('alpha'); art.root.name = name; root.add(art.root); arts.push(art);
    const geometry = mergeParts(art.solids); art.solids.forEach(g => g.dispose()); art.solids.length = 0;
    const collider: Collider = { name: 'COL_' + name, bvh: new MeshBVH(geometry), enabled: true };
    geometries.push(geometry); colliders.push(collider); return { art, geometry, collider };
  }
  const fixed = new SiteArt();
  for (const x of [22.45, 26.55]) for (const z of [-144.65, -135.35]) {
    fixed.box([x, 29.1, z], [.28, 10.2, .28], stone, true);
    fixed.box([x, 24.2, z], [.65, .4, .65], stone, true);
  }
  for (const z of [-144.65, -135.35]) {
    fixed.box([24.5, 34.1, z], [4.65, .35, .5], bronze, true);
    fixed.ring([24.5, 34.35, z], .37, .08, bronze);
  }
  landscapeWalkway(fixed, [[29, 24, -140], [26.25, 24.8, -140]], { width: 2.8, floor: stone, edge: bronze, steps: true });
  for (const [x, y, z] of [[29.1, 24, -142.3], [24.5, 32, -146.5]]) {
    fixed.box([x, y + .5, z], [.55, 1, .55], stone, true);
    fixed.ring([x, y + 1.15, z], .36, .06, bronze);
    fixed.beam([x - .25, y + 1.15, z], [x + .25, y + 1.15, z], .08, bronze);
  }
  finish(fixed, 'EgyptTempleHoistFrame');

  const barge = new SiteArt(), low = 24.8, high = 32;
  barge.box([24.5, low - .16, -140], [3.5, .32, 8.1], wood, true);
  const outline = [[0, -4.9], [1.8, -3.6], [1.9, 2.9], [1.25, 4.25], [0, 4.9], [-1.25, 4.25], [-1.9, 2.9], [-1.8, -3.6]];
  const hull: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const rimA = [a[0], -.17, a[1]], rimB = [b[0], -.17, b[1]],
      keelA = [a[0] * .63, -.72, a[1] * .83], keelB = [b[0] * .63, -.72, b[1] * .83];
    hull.push(...rimA, ...keelA, ...rimB, ...rimB, ...keelA, ...keelB);
    barge.beam([24.5 + a[0], low - .13, -140 + a[1]], [24.5 + b[0], low - .13, -140 + b[1]], .11, bronze);
  }
  const hullGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(hull, 3));
  hullGeometry.computeVertexNormals(); barge.add(hullGeometry, '#527b80', [24.5, low, -140]); hullGeometry.dispose();
  for (const x of [23.25, 24.5, 25.75]) barge.box([x, low - .38, -140], [.22, .28, 7.8], bronze);
  for (let z = -143.7; z < -136; z += .5) barge.box([24.5, low + .015, z], [3.4, .03, .035], '#bca77e');
  // East opening meets the low gangway; both ends meet the upper gallery.
  for (const x of [22.8, 26.2]) for (let z = -143.6; z <= -136.4; z += 1.2) {
    if (x > 25 && z > -141.8 && z < -138.2) continue;
    barge.box([x, low + .55, z], [.11, 1.1, .11], bronze, true);
  }
  barge.box([22.8, low + 1, -140], [.12, .12, 7.8], bronze, true);
  for (const z of [-142.9, -137.1]) barge.box([26.2, low + 1, z], [.12, .12, 2], bronze, true);
  barge.box([23.1, low + .45, -142.4], [.7, .9, 1.4], '#bdad7a', true);
  barge.ring([23.1, low + 1.15, -142.4], .22, .045, bronze);
  const moving = finish(barge, 'EgyptTempleCeremonialBarge');
  const base = Float32Array.from(moving.geometry.attributes.position.array);
  const gateParts: ReturnType<typeof finish>[] = [];
  for (const z of [-144.1, -135.9]) {
    const a = new SiteArt();
    a.box([24.5, high + .65, z], [3.5, 1.3, .16], '#a58952', true);
    for (const x of [23.05, 25.95]) a.box([x, high + .68, z + .09], [.13, 1.4, .05], '#e3d4a5');
    gateParts.push(finish(a, 'EgyptTempleUpperSafetyGate_' + z));
  }
  const lowerGate = new SiteArt(); lowerGate.box([26.38, low + .6, -140], [.14, 1.2, 2.8], '#a58952', true);
  const lowerBarrier = finish(lowerGate, 'EgyptTempleLowerSafetyGate');
  const cableMaterial = new THREE.MeshStandardMaterial({ color: '#5c513e', roughness: .9 });
  const cables: THREE.Mesh[] = [];
  for (const x of [23, 26]) for (const z of [-143.65, -136.35]) {
    const g = new THREE.CylinderGeometry(.045, .045, 1, 6); geometries.push(g);
    const cable = new THREE.Mesh(g, cableMaterial); cable.position.set(-x, 0, -1440 - z); root.add(cable); cables.push(cable);
  }

  // Side wings settle first. The central leaf then slides below the water bed.
  const specimen = new THREE.Group(); specimen.applyMatrix4(frame); specimen.position.x += .5; specimen.position.z -= 34.5; root.add(specimen);
  const specimenMaterials = [new THREE.MeshStandardMaterial({ color: stone }), new THREE.MeshStandardMaterial({ color: bronze }),
    new THREE.MeshStandardMaterial({ color: '#69b3be', transparent: true, opacity: .85 }), new THREE.MeshBasicMaterial({ color: '#dbf8e4' })];
  function prop(size: [number, number, number], p: [number, number, number], material = 0, parent: THREE.Object3D = specimen) {
    const geo = new THREE.BoxGeometry(...size); geometries.push(geo);
    const mesh = new THREE.Mesh(geo, specimenMaterials[material]); mesh.position.fromArray(p); parent.add(mesh); return mesh;
  }
  const wings = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.set(20 + side * 1.5, 25.6, -168); specimen.add(pivot);
    prop([.36, 1.45, 2.65], [0, .725, 0], 0, pivot); prop([.4, .12, 2.7], [0, 1.4, 0], 1, pivot); return pivot;
  });
  const leaf = prop([2.5, 1.2, .25], [20, 26.2, -168.5], 1);
  const water = prop([2.45, .035, 2.8], [20, 25.55, -168], 2);
  const foam = Array.from({ length: 6 }, (_, i) => prop([.08, .02, .28], [19.2 + (i % 3) * .8, 25.58, -169 + Math.floor(i / 3)], 3));
  const door = EGYPT_TEMPLE_SIDE_DOOR, floor = EGYPT_TEMPLE_WORKS.floor;
  const sideArt = new SiteArt();
  sideArt.box([door.x, floor + door.height / 2, door.z], [door.width, door.height, .3], stone, true);
  for (const h of [.5, 1.9]) sideArt.box([door.x, floor + h, door.z + .16], [door.width - .1, .11, .06], bronze);
  for (const x of [door.x - .4, door.x + .4]) sideArt.box([x, floor + 1.25, door.z + .17], [.08, 2.15, .055], bronze);
  const sideGate = finish(sideArt, 'EgyptTempleSeepageGate');
  const sideControls = new SiteArt();
  sideControls.box([17.8, floor + .53, -170.9], [.52, 1.06, .5], stone, true);
  sideControls.ring([17.8, floor + 1.12, -170.9], .38, .075, bronze);
  sideControls.box([21.35, floor + 1.02, -173.62], [.25, .28, .22], bronze);
  finish(sideControls, 'EgyptTempleSideControls');
  const seepage = new THREE.Group(); seepage.applyMatrix4(frame); root.add(seepage);
  for (const x of [19.12, 19.6, 20.37, 20.85]) {
    const stream = prop([.06, 1.85, .045], [x, floor + .96, door.z + .18], 2, seepage);
    stream.rotation.z = (x - door.x) * .065;
  }
  const markers: Marker[] = [
    { id: S.specimen, type: 'interact', p: local(19.5, 24.9, -135.8), radius: 2.4, label: EGYPT_TEMPLE_WORK_LABELS.get(S.specimen)![0] },
    { id: S.lower, type: 'interact', p: local(29.1, 25.3, -142.3), radius: 2.3, label: EGYPT_TEMPLE_WORK_LABELS.get(S.lower)![0] },
    { id: S.upper, type: 'interact', p: local(24.5, 33.3, -146.5), radius: 2.3, label: EGYPT_TEMPLE_WORK_LABELS.get(S.upper)![0] },
    { id: S.aboard, type: 'interact', p: local(23.1, low + 1.3, -142.4), radius: 2.1, label: EGYPT_TEMPLE_WORK_LABELS.get(S.aboard)![0] },
    { id: S.seepage, type: 'interact', p: local(17.8, floor + 1.16, -170.7), radius: 2.2, label: EGYPT_TEMPLE_WORK_LABELS.get(S.seepage)![0] },
    { id: S.sideLatch, type: 'interact', p: local(21.05, floor + 1.1, -174.1), radius: 2.1, label: EGYPT_TEMPLE_WORK_LABELS.get(S.sideLatch)![0] },
  ];
  let height = low, initialized = false, target = low, demo = -1, demoResult = false, learned = false;
  const sideRise = door.height + .08;
  let sideHeight = 0, drainTime = 0, sideSecured = false;
  const moveGeometry = () => {
    const offset = height - low; moving.art.root.position.y = offset;
    const position = moving.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setY(i, base[i * 3 + 1] + offset);
    position.needsUpdate = true; moving.collider.bvh.refit(); moving.geometry.computeBoundingBox(); moving.geometry.computeBoundingSphere();
    markers[3].p[1] = height + 1.3;
  };
  return {
    root, colliders, markers,
    get moving() { return Math.abs(height - target) > .001; },
    get demonstrating() { return demo >= 0; },
    get sideOpen() { return sideHeight >= sideRise; },
    drainSeepage() { drainTime = 10; },
    resetSideDoor() { drainTime = 0; },
    demonstrate() { if (demo < 0) { demo = 0; demoResult = false; return true; } return false; },
    takeDemonstrationResult() { const result = demoResult; demoResult = false; return result; },
    apply(done: ReadonlySet<string>, dt: number, player?: Pick<Player, 'pos' | 'vel' | 'onGround' | 'flying' | 'swimming' | 'gliding'>) {
      target = done.has(S.raised) ? high : low; learned = done.has(S.learned);
      if (!initialized) { initialized = true; height = target; moveGeometry(); }
      const step = Math.max(0, Math.min(.05, dt)), before = height;
      if (Math.abs(target - height) > .001 && step > 0) {
        const x = player ? EGYPT_OFFSET[0] - player.pos.x : Infinity, z = player ? EGYPT_OFFSET[1] - player.pos.z : Infinity;
        const aboard = !!player && Math.abs(x - 24.5) < 1.7 && Math.abs(z + 140) < 4
          && Math.abs(player.pos.y - height) < .16 && player.vel.y <= .5 && !player.flying && !player.swimming && !player.gliding;
        const underneath = !!player && Math.abs(x - 24.5) < 2.1 && Math.abs(z + 140) < 4.4
          && player.pos.y < height - .2 && player.pos.y + 1.95 >= height - .6;
        if (target > height || !underneath) {
          height += Math.sign(target - height) * Math.min(Math.abs(target - height), step * 1.2);
          moveGeometry();
          if (aboard && player) { player.pos.y += height - before; player.vel.y = 0; player.onGround = true; }
        }
      }
      const settled = Math.abs(height - target) <= .001;
      for (const gate of gateParts) gate.art.root.visible = gate.collider.enabled = !(settled && height === high);
      lowerBarrier.art.root.visible = lowerBarrier.collider.enabled = !(settled && height === low);
      for (const cable of cables) { cable.scale.y = 34 - height; cable.position.y = (34 + height) / 2; }
      if (demo >= 0) { demo += step; if (demo >= 6) { demo = -1; demoResult = true; } }
      const t = demo < 0 ? (learned || demoResult ? 6 : 0) : demo;
      const fall = THREE.MathUtils.smoothstep(t, .5, 2.5), open = THREE.MathUtils.smoothstep(t, 3, 4.5);
      wings[0].rotation.z = fall * Math.PI / 2; wings[1].rotation.z = -fall * Math.PI / 2;
      leaf.position.y = 26.2 - open * 1.4; water.visible = open > .75;
      for (const [i, streak] of foam.entries()) { streak.visible = water.visible; streak.position.z = -169.3 + ((t * .8 + i * .41) % 2.6); }
      const secured = done.has(S.shortcut);
      if (secured && !sideSecured) sideHeight = sideRise;
      sideSecured = secured;
      const inDoorway = !!player && Math.abs(player.pos.x - (EGYPT_OFFSET[0] - door.x)) < door.width / 2 + .5
        && Math.abs(player.pos.z - (EGYPT_OFFSET[1] - door.z)) < 1.05 && player.pos.y >= floor - .3 && player.pos.y < floor + door.height;
      if (!inDoorway) drainTime = Math.max(0, drainTime - step);
      const goal = secured || drainTime > 0 ? sideRise : 0;
      if (sideHeight < goal) sideHeight = Math.min(goal, sideHeight + step * 3.2);
      if (sideHeight > goal && !inDoorway) sideHeight = Math.max(goal, sideHeight - step * 3.2);
      sideGate.art.root.position.y = sideHeight;
      sideGate.collider.enabled = sideHeight < sideRise;
      seepage.visible = !secured && drainTime === 0 && !inDoorway;
      root.updateMatrixWorld(true);
    },
    dispose() {
      colliders.forEach(c => { c.enabled = false; }); geometries.forEach(g => g.dispose()); cableMaterial.dispose(); specimenMaterials.forEach(m => m.dispose());
      for (const art of arts) { for (const layer of art.layers.values()) layer.geometry.dispose(); Object.values(art.materials).forEach(m => m.dispose()); }
      root.removeFromParent();
    },
  };
}
