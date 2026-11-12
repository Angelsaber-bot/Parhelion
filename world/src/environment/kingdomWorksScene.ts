import * as THREE from 'three';
import type { Marker } from '../core/types';
import { SiteArt } from '../story/campaignSites';
import { gatePoint, type GatePoint } from '../story/kingdomGate';
import { KINGDOM_WORKS as K, KINGDOM_WORK_LABELS, kingdomWorkReady, kingdomWorksActive, type KingdomWork } from '../story/kingdomWorks';

export function createKingdomWorksScene(
  hearth: GatePoint,
  floor: (x: number, z: number, ceiling: number) => number | null,
  clear: (p: THREE.Vector3) => boolean,
) {
  const art = new SiteArt(), root = art.root;
  const markers: Marker[] = [], stands = new Map<KingdomWork, GatePoint>();
  const timber = '#805c41', pale = '#ceaa77', stone = '#847768';
  const reserved: GatePoint[] = [];
  function stand(id: KingdomWork, guess: GatePoint) {
    let p: GatePoint | undefined;
    for (const radius of [0, 1.8, 3.6, 5.4, 7.2]) {
      const spokes = radius === 0 ? 1 : 12;
      for (let i = 0; i < spokes && !p; i++) {
        const heading = i * Math.PI * 2 / spokes;
        const x = guess[0] + Math.cos(heading) * radius, z = guess[2] + Math.sin(heading) * radius;
        const y = floor(x, z, guess[1] + 1.7);
        if (y !== null && Math.abs(y - guess[1]) < 2.3 && clear(new THREE.Vector3(x, y, z)) &&
            reserved.every(other => Math.hypot(x - other[0], z - other[2]) > 2.45)) p = [x, y, z];
      }
      if (p) break;
    }
    const chosen = p ?? guess;
    reserved.push(chosen); stands.set(id, chosen);
    markers.push({ id, p: [chosen[0], chosen[1] + .9, chosen[2]], type: 'interact', label: KINGDOM_WORK_LABELS[id][0], radius: 2.05 });
    return chosen;
  }
  function beam(a: GatePoint, b: GatePoint) { art.beam(a, b, .17, timber); }
  function knob(p: GatePoint) {
    const [x, y, z] = p;
    art.box([x, y + .52, z - .9], [.48, 1.04, .45], timber);
    art.ring([x, y + 1.03, z - .59], .27, .045, pale);
  }
  const recall = stand(K.recall, [hearth[0] + 4.4, hearth[1], hearth[2] + 3]);
  const [rx, ry, rz] = recall;
  const recallStart = new THREE.Vector3(rx, ry + 2.95, rz - 2);
  const recallEnd = new THREE.Vector3(rx + 5.5, ry + 4.3, rz - 2);
  for (const x of [rx - 1.6, rx + 1.6, rx + 3.8, rx + 7.2]) beam([x, ry, rz - 2], [x, ry + (x > rx + 2 ? 4.3 : 3.1), rz - 2]);
  art.box([rx, ry + .72, rz - 1.27], [1.45, .14, .65], timber);
  art.box([rx, ry + .86, rz - 1.27], [.45, .16, .27], '#c9914c');
  const brandedBeam = new THREE.Group();
  brandedBeam.position.copy(recallStart);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(3.2, .24, .27), new THREE.MeshStandardMaterial({ color: timber }));
  const crest = new THREE.Mesh(new THREE.BoxGeometry(.36, .16, .028), new THREE.MeshStandardMaterial({ color: '#a88249', emissive: '#e59545', emissiveIntensity: 0 }));
  crest.position.z = .15; brandedBeam.add(shaft, crest); root.add(brandedBeam);

  const [hx, hy, hz] = stand(K.release, gatePoint(2, -18));
  const market = stand(K.market, gatePoint(6, -18)), abbey = stand(K.abbey, gatePoint(-3, -19));
  const patrol = stand(K.patrol, gatePoint(-1, -28)), lampStand = stand(K.lamp, gatePoint(1, -22));
  const bellStand = stand(K.bell, gatePoint(7, -28));
  const breadStand = stand(K.bread, gatePoint(8, -12));
  const wheelStand = stand(K.wheel, gatePoint(-8, -17));
  [market, abbey, lampStand].forEach(knob);
  const [px, py, pz] = patrol;
  for (const x of [px - 2.2, px + 2.2]) art.box([x, py + .41, pz - 1.45], [1.55, .82, .54], stone);
  beam([hx, hy, hz - 1.2], [hx, hy + 4.2, hz - 1.2]);
  const hoist = new THREE.Group(); hoist.position.set(hx, hy + 4.2, hz - 1.2); root.add(hoist);
  const wood = new THREE.MeshStandardMaterial({ color: timber });
  const bronze = new THREE.MeshStandardMaterial({ color: '#9f7950', metalness: .47, roughness: .47 });
  const glass = new THREE.MeshStandardMaterial({ color: '#eed898', emissive: '#dc9849', emissiveIntensity: .08 });
  function part(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
    const node = new THREE.Mesh(geometry, material); node.position.set(x, y, z); group.add(node); return node;
  }
  part(hoist, new THREE.BoxGeometry(.21, .22, 4.5), wood, 0, 0, -1.9);
  part(hoist, new THREE.BoxGeometry(.1, .66, .1), bronze, 0, -.37, -3.65);
  part(hoist, new THREE.BoxGeometry(.61, .82, .61), glass, 0, -1.04, -3.65);
  for (const y of [-1.49, -.59]) part(hoist, new THREE.BoxGeometry(.72, .13, .72), bronze, 0, y, -3.65);
  const pin = part(root, new THREE.BoxGeometry(.53, .52, .34), bronze, hx + .04, hy + 3.4, hz - .85);
  pin.name = 'KingdomWatchLampTie'; pin.userData.target = K.pin;
  markers.push({ id: K.pin, type: 'objective', p: pin.position.toArray(), label: KINGDOM_WORK_LABELS[K.pin][0] });

  const [bx, by, bz] = bellStand;
  for (const x of [bx - 1.2, bx + 1.2]) beam([x, by, bz - 1.24], [x, by + 3.35, bz - 1.24]);
  beam([bx - 1.35, by + 3.35, bz - 1.24], [bx + 1.35, by + 3.35, bz - 1.24]);
  const bell = new THREE.Group(); bell.position.set(bx, by + 3.2, bz - 1.24); root.add(bell);
  part(bell, new THREE.CylinderGeometry(.29, .52, .6, 12), bronze, 0, -.33, 0);
  part(bell, new THREE.SphereGeometry(.13, 8, 6), bronze, 0, -.68, 0);
  part(bell, new THREE.CylinderGeometry(.032, .032, 1.45, 6), wood, 0, -1.4, 0);
  const sign = part(root, new THREE.BoxGeometry(.67, .48, .08), wood, bx + 1.1, by + 1.25, bz - 1.04);
  const [sx, sy, sz] = breadStand;
  art.box([sx, sy + .79, sz - 1.1], [2, .15, .74], timber);
  const shutter = part(root, new THREE.BoxGeometry(1.86, .88, .12), wood, sx, sy + 1.78, sz - 1.2);
  const bread = part(root, new THREE.SphereGeometry(.22, 9, 7), bronze, sx, sy + .92, sz - 1.08); bread.scale.set(1.6, .57, .75);
  const [wx, wy, wz] = wheelStand;
  const wheel = new THREE.Group(); wheel.position.set(wx, wy + 1.04, wz - 1.27); root.add(wheel);
  part(wheel, new THREE.TorusGeometry(.87, .095, 6, 14), wood, 0, 0, 0);
  for (let i = 0; i < 8; i++) part(wheel, new THREE.BoxGeometry(.2, 1.58, .11), wood, 0, 0, 0).rotation.z = i * Math.PI / 8;
  art.finish('britain'); root.name = 'KingdomWatchAndEveningBell';

  let clock = 0, recallClock = 3, bellClock = 3, knownRecall = false, knownBell = false;
  function apply(done: ReadonlySet<string>, dt = 0, transition = false) {
    root.visible = kingdomWorksActive(done) && done.has('kingdom_gate_rescued');
    const recalled = done.has(K.recall), rang = done.has(K.bell);
    if (recalled !== knownRecall) { recallClock = recalled && transition ? 0 : 3; knownRecall = recalled; }
    if (rang !== knownBell) { bellClock = rang && transition ? 0 : 3; knownBell = rang; }
    recallClock += dt; bellClock += dt; clock += dt;
    const recallFraction = recalled ? THREE.MathUtils.smoothstep(recallClock, .35, 2.5) : 0;
    brandedBeam.position.lerpVectors(recallStart, recallEnd, recallFraction);
    crest.material.emissiveIntensity = recalled && recallClock < 2.5 ? 1.2 : .03;
    const direction = done.has(K.market) ? -1.28 : done.has(K.abbey) ? 1.26 : 0;
    hoist.rotation.y = dt > 0 ? THREE.MathUtils.damp(hoist.rotation.y, direction, 3.2, dt) : hoist.rotation.y;
    glass.emissiveIntensity = done.has(K.lamp) ? 1.5 + Math.sin(clock * 3) * .13 : direction !== 0 ? .32 : .08;
    pin.visible = root.visible && kingdomWorkReady(K.pin, done);
    bell.rotation.z = rang && bellClock < 3 ? Math.sin(bellClock * 10) * .65 * (1 - bellClock / 3) : 0;
    sign.rotation.y = rang ? Math.PI : 0;
    shutter.rotation.x = done.has(K.bread) ? 1.34 : 0;
    bread.visible = done.has(K.bread);
    if (done.has(K.wheel)) wheel.rotation.z -= dt * 1.25;
    else wheel.rotation.z = 0;
  }
  function dispose() {
    const materials = new Set<THREE.Material>();
    root.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
    });
    materials.forEach(material => material.dispose());
    root.removeFromParent();
  }
  return { root, markers, stands, target: pin, apply, dispose };
}
