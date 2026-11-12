import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import { mergeParts } from '../settlements/merge';
import { SiteArt } from '../story/campaignSites';
import { SKY_BOSS, SKY_ORIGIN, SKY_SHUTTERS, SHUTTER_SPAN, helionBeamDirection, type createHelionFight } from '../story/helionFight';
import { JOURNEY as J, SKY_MARKERS as M, type JourneyPoint } from '../story/worldJourney';

const [X, Y, Z] = SKY_ORIGIN;
const p = (x: number, y: number, z: number): JourneyPoint => [X + x, Y + y, Z + z];
export const SKY_LANDING = p(0, 0, 62);
export const SKY_CHECKPOINT = p(0, 0, 24);
export const insideSkyCrown = (position: { x: number; y: number; z: number }) => position.y > Y - 14 && Math.abs(position.x - X) < 55 && position.z > Z - 60 && position.z < Z + 91;

export function createSkyCrownScene() {
  const a = new SiteArt();
  const slate = '#384f68', ivory = '#c5c5b5', gold = '#d3a85f', steel = '#263c51', glass = '#66b8b7', red = '#a15143';
  const markers: Marker[] = [];
  const post = (id: string, label: string, x: number, z: number, plate = true) => {
    markers.push({ id, label, p: p(x, 1, z), type: 'interact', radius: 2.25 });
    if (plate) {
      a.box(p(x, .54, z - .88), [.65, 1.08, .42], slate, true);
      a.box(p(x, 1.12, z - .88), [1.12, .15, .68], ivory);
      a.box(p(x, 1.205, z - .84), [.73, .025, .35], gold);
    }
  };

  // Deck plates form a docking wing, a three-lane light throat, and the crown.
  a.box(p(0, -.5, 62), [21, 1, 17], slate, true);
  a.box(p(0, -.48, 45), [11, .96, 20], slate, true);
  a.box(p(0, -.55, 30), [37, 1.1, 13], slate, true);
  for (const x of [-15, 0, 15]) a.box(p(x, -.52, 19), [x === 0 ? 9 : 6, 1.04, 12], slate, true);
  a.box(p(0, -.7, -10), [58, 1.4, 47], slate, true);
  a.box(p(0, -.64, -36), [37, 1.28, 5.1], slate, true);
  a.box(p(0, -3.1, -10), [55, 4, 42], steel);
  for (const x of [-22, -11, 0, 11, 22]) a.beam(p(x, -1.5, 13), p(x * .65, -12, -22), .32, ivory);

  const rail = (x: number, z: number, span: number, alongX = false) => {
    const size: JourneyPoint = alongX ? [span, .12, .14] : [.14, .12, span];
    a.box(p(x, 1.04, z), size, gold, true);
    for (let offset = -span / 2 + .3; offset < span / 2; offset += 3.1) a.box(p(x + (alongX ? offset : 0), .52, z + (alongX ? 0 : offset)), [.11, 1.04, .11], ivory, true);
  };
  for (const side of [-1, 1]) {
    rail(side * 10.3, 62, 17); rail(side * 5.4, 45, 19); rail(side * 18.3, 30, 13);
    rail(side * 28.8, -10, 46); rail(side * 18.35, -36, 4.8);
    for (const x of [side * 11.9, side * 18.0]) rail(x, 19.2, 10.6);
    for (const z of [39, 45, 51, 56]) a.box(p(side * 4.6, .014, z), [.42, .026, 1.4], ivory);
    for (const z of [-26, -14, 1]) a.box(p(side * (z === -14 ? 20 : 24), .68, z), [3.8, 1.36, 1.6], steel, true);
    for (const z of [-27, -6]) {
      a.cyl(p(side * 19, 3, z), .58, 6, slate, true, 'metal');
      a.box(p(side * 19, 6.1, z), [2.2, .24, 2.2], gold);
    }
    a.beam(p(side * 18, 4, -36), p(side * 29, 11.8, -24), .36, ivory);
    a.beam(p(side * 29, 11.8, -24), p(side * 29, 11.8, 4), .29, ivory);
    a.beam(p(side * 29, 11.8, 4), p(side * 13, 9.1, 14), .29, ivory);
  }
  rail(0, -38.45, 36.6, true); rail(0, 70.35, 20.4, true);
  for (const x of [-21, 21]) rail(x, 13.4, 14, true);
  for (const x of [-16, 16]) rail(x, 36.4, 4, true);
  for (const y of [7.2, 11.9]) a.ring(p(0, y, -10), y === 7.2 ? 21 : 27, .17, gold, 'metal', [Math.PI / 2, 0, 0]);
  a.ring(p(0, 4.2, -30), 4.6, .23, gold);
  a.ring(p(0, 4.2, -30.3), 3.65, .09, glass);
  for (const x of [-12, 12]) {
    a.box(p(x, .42, -28), [3.9, .84, 3.7], steel, true);
    a.beam(p(x, .7, -28), p(x * .58, 4.8, -30), .42, gold);
    a.box(p(x, 1.6, -28), [1.25, 1.45, 1.25], red, false, 'briefed');
    a.box(p(x, .92, -28), [1.8, .09, 1.65], '#697775', false, 'resolved');
  }
  for (const x of [-15, 15]) {
    a.box(p(x, .03, 28), [3.2, .035, 1.2], red);
    a.box(p(x, .065, 28), [3.2, .035, 1.2], glass, false, 'choiceA');
  }
  a.box(p(0, .015, 19), [1.1, .028, 10.5], glass, false, 'choiceB');
  post(J.feed, '并联独立生活线路', -6.5, 58);
  post(J.test, '旁路负荷台', 15, 29);
  post(J.isolate, '机械隔离锁', -15, 29);
  post(M.start, '承日台 · 面对赫利昂', 0, 10);
  post(M.cache, '维修箱 · 战前补给', -3.4, 24);
  post(M.left, '转动西侧遮板', -8.75, -12, false);
  post(M.right, '转动东侧遮板', 8.75, -12, false);
  post(J.finish, '交接台 · 锁住紧急写入臂', 4.5, -24);
  post(J.returnHome, '接驳架 · 回到幻日谷', 0, 65);
  a.finish('alpha'); a.root.name = 'SkyCrown';

  const solids = mergeParts(a.solids); a.solids.forEach(geometry => geometry.dispose());
  const colliders: Collider[] = [{ name: 'COL_SkyCrownDecks', bvh: new MeshBVH(solids), enabled: true }];
  const shutterMat = new THREE.MeshStandardMaterial({ color: '#2f5862', metalness: .25, roughness: .45 });
  const slitMat = new THREE.MeshBasicMaterial({ color: glass });
  const shutterGeo = new THREE.BoxGeometry(SHUTTER_SPAN, 3.05, .32);
  const slitGeo = new THREE.BoxGeometry(SHUTTER_SPAN - .62, .14, .34);
  const shutters = SKY_SHUTTERS.map(([x, y, z], index) => {
    const node = new THREE.Group(); node.name = `SkyShutter_${index}`; node.position.set(x, y + 1.525, z);
    node.add(new THREE.Mesh(shutterGeo, shutterMat));
    const slit = new THREE.Mesh(slitGeo, slitMat); slit.position.y = .72; node.add(slit); a.root.add(node);
    const variants = [false, true].map(alternate => {
      const geometry = shutterGeo.clone().rotateY(alternate ? Math.PI / 2 : 0).translate(x, y + 1.525, z);
      const collider: Collider = { name: `COL_SkyShutter_${index}_${Number(alternate)}`, bvh: new MeshBVH(geometry), enabled: !alternate };
      colliders.push(collider); return collider;
    });
    return { node, variants };
  });

  const coreMat = new THREE.MeshStandardMaterial({ color: '#d28258', emissive: '#b34922', emissiveIntensity: .65, metalness: .3 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.28, 1), coreMat);
  core.name = 'HelionCore'; core.userData.target = M.target; core.position.fromArray(SKY_BOSS); core.visible = false;
  const emitterGeometry = new THREE.IcosahedronGeometry(1.12, 0);
  const emitters = [-12, 12].map((x, index) => {
    const emitter = new THREE.Mesh(emitterGeometry, coreMat.clone());
    emitter.name = `HelionEmitter_${index}`; emitter.userData.target = M.target; emitter.userData.helionWeakPoint = index;
    emitter.position.fromArray(p(x, 2.35, -27)); emitter.visible = false; a.root.add(emitter);
    return emitter;
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#a89875', metalness: .48, roughness: .42 });
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1.68, .18, 8, 32), frameMat);
  frame.position.copy(core.position); a.root.add(core, frame);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fac36b', opacity: .42, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const tellBeam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), beamMat);
  const pulse = new THREE.Mesh(new THREE.CircleGeometry(1, 42).rotateX(-Math.PI / 2), beamMat);
  tellBeam.visible = pulse.visible = false; a.root.add(tellBeam, pulse);

  function apply(done: ReadonlySet<string>) {
    a.layers.get('briefed')!.visible = !done.has(J.phase2);
    a.layers.get('resolved')!.visible = done.has(J.phase2);
    a.layers.get('choiceA')!.visible = done.has(J.feed);
    a.layers.get('choiceB')!.visible = done.has(J.isolate);
    frame.visible = !done.has(J.finish);
  }
  function update(fight: ReturnType<typeof createHelionFight>, seconds: number) {
    shutters.forEach(({ node, variants }, i) => {
      const turned = fight.shutters[i];
      node.rotation.y = turned ? Math.PI / 2 : 0;
      variants[0].enabled = !turned; variants[1].enabled = turned;
    });
    core.visible = fight.active && fight.phase !== 1;
    core.rotation.set(seconds * .57, seconds * .78, .12);
    coreMat.emissiveIntensity = fight.vulnerable ? 1.65 : .32;
    coreMat.color.setHex(fight.vulnerable ? 0xffdb9b : 0xb44828);
    for (const [index, emitter] of emitters.entries()) {
      emitter.visible = fight.phase === 1;
      emitter.rotation.y = seconds * .8;
      const open = fight.vulnerable && fight.exposedEmitter === index;
      emitter.material.color.setHex(open ? 0xffdb9b : 0x9b4733);
      emitter.material.emissiveIntensity = open ? 1.65 : .3;
    }
    const tell = fight.tell ?? fight.flash;
    tellBeam.visible = !!tell && tell.shape !== 'pulse'; pulse.visible = tell?.shape === 'pulse';
    if (!tell) return;
    beamMat.opacity = fight.flash ? .88 : fight.beat === 'locked' ? .58 : .27;
    beamMat.color.setHex(fight.flash ? 0xfff4d4 : fight.beat === 'locked' ? 0xf57845 : 0xffce72);
    if (tell.shape === 'pulse') {
      pulse.position.set(tell.x, Y + .035, tell.z); pulse.scale.set(tell.width, 1, tell.width); return;
    }
    const d = helionBeamDirection(tell);
    const distance = fight.flash ? fight.flashLength : 96;
    tellBeam.position.set(tell.from[0] + d.x * distance / 2, Y + .035, tell.from[2] + d.z * distance / 2);
    tellBeam.rotation.y = Math.atan2(d.x, d.z);
    tellBeam.scale.set(tell.width * 2, 1, distance);
  }
  return { root: a.root, markers, targets: [core, ...emitters], colliders, apply, update, dispose() {
    const geometries = new Set<THREE.BufferGeometry>(colliders.map(collider => collider.bvh.geometry));
    a.root.traverse(node => { if (node instanceof THREE.Mesh) geometries.add(node.geometry); });
    geometries.forEach(geometry => geometry.dispose());
    [...Object.values(a.materials), shutterMat, slitMat, coreMat, frameMat, beamMat, ...emitters.map(emitter => emitter.material)].forEach(material => material.dispose());
    colliders.forEach(collider => { collider.enabled = false; }); a.root.removeFromParent();
  } };
}
