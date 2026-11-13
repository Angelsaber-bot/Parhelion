import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import type { AdventureAction } from '../story/adventureSites';
import { SiteArt } from '../story/campaignSites';
import { KYOTO_WITNESS as Y, KYOTO_WITNESS_LABELS, kyotoHoistLowered, kyotoOrdersDelivered, kyotoRollStopped, kyotoWitnessActionReady, kyotoWitnessActive } from '../story/kyotoWitness';
import { createSettlementNpcs } from '../settlements/npcs';
import { kyotoStreetReady, kyotoStreetPoint } from '../story/kyotoStreetWorks';

export function createKyotoWitnessScene(actions: ReadonlyMap<string, AdventureAction>) {
  const art = new SiteArt(), root = art.root, targets: THREE.Mesh[] = [], markers: Marker[] = [];
  const wood = new THREE.MeshStandardMaterial({ color: '#75533e' });
  const metal = new THREE.MeshStandardMaterial({ color: '#725f40', metalness: .36 });
  const cloth = new THREE.MeshStandardMaterial({ color: '#dac9aa', side: THREE.DoubleSide });
  const highlighted = new THREE.MeshStandardMaterial({ color: '#dab16b', emissive: '#855830', emissiveIntensity: .55 });
  const red = new THREE.MeshStandardMaterial({ color: '#963e37' });
  function part(parent: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number]) {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.fromArray(p); parent.add(mesh); return mesh;
  }
  function target(id: typeof Y.cut | typeof Y.pin, name: string, p: [number, number, number]) {
    const mesh = part(root, new THREE.BoxGeometry(.51, .46, .29), highlighted, p);
    mesh.userData.target = id; mesh.name = name; targets.push(mesh);
    markers.push({ id, label: KYOTO_WITNESS_LABELS[id][0], p, type: 'objective' });
    return mesh;
  }
  const [rx, ry, rz] = actions.get(Y.stop)!.p;
  const spool = new THREE.Group(); spool.position.set(rx, ry + 1.3, rz - 1.3); root.add(spool);
  part(spool, new THREE.CylinderGeometry(.38, .38, 1.45, 14).rotateZ(Math.PI / 2), cloth, [0, 0, 0]);
  for (const side of [-1, 1]) {
    part(spool, new THREE.CylinderGeometry(.52, .52, .14, 16).rotateZ(Math.PI / 2), wood, [side * .8, 0, 0]);
    for (const angle of [0, Math.PI / 3, Math.PI * 2 / 3])
      part(spool, new THREE.BoxGeometry(.145, .78, .045), metal, [side * .89, 0, 0]).rotation.x = angle;
    art.box([rx + side * .9, ry + .52, rz - 1.3], [.18, 1.04, .17], '#795a42');
  }
  const belt = target(Y.cut, 'KyotoScrollBelt', [rx + .48, ry + 1.59, rz - .96]);
  const [lx, ly, lz] = actions.get(Y.winch)!.p;
  for (const side of [-1, 1]) {
    const px = lx + side * 1.45;
    art.box([px, ly + 2.45, lz - 1.8], [.22, 4.9, .24], '#795b47');
    art.beam([px, ly + 4.6, lz - 1.8], [px, ly, lz - 3.25], .14, '#685441');
  }
  art.box([lx, ly + 4.75, lz - 1.8], [3.25, .26, .3], '#886b55');
  const platform = new THREE.Group(); platform.position.set(lx, ly + 3.25, lz - 1.8); root.add(platform);
  part(platform, new THREE.BoxGeometry(2.55, .16, 1.3), wood, [0, -.085, 0]);
  part(platform, new THREE.BoxGeometry(2.55, .11, .16), wood, [0, .75, -.59]);
  for (const x of [-1.17, 1.17]) part(platform, new THREE.BoxGeometry(.15, .87, .16), wood, [x, .4, -.58]);
  const witness = createSettlementNpcs([{ id: 'kyoto_copyist_aki_lift', role: ['抄写人阿纪', 'Aki the copyist'],
    region: 'kyoto', position: [0, 0, 0], lines: [['我看见了那处改写。', 'I saw where they changed it.']] }]);
  platform.add(witness.group);
  const safetyPin = target(Y.pin, 'KyotoPaperLiftPin', [lx - .54, ly + 3.81, lz - 1.25]);

  const [bx, by, bz] = actions.get(Y.public)!.p;
  const bell = new THREE.Group(); bell.position.set(bx, by + 2.2, bz - 1.35); root.add(bell);
  art.box([bx - 1.15, by + 1.35, bz - 1.35], [.15, 2.7, .15], '#75533e');
  art.box([bx + 1.15, by + 1.35, bz - 1.35], [.15, 2.7, .15], '#75533e');
  art.box([bx, by + 2.7, bz - 1.35], [2.65, .15, .17], '#75533e');
  part(bell, new THREE.CylinderGeometry(.23, .43, .65, 12), metal, [0, 0, 0]);
  const notice = part(root, new THREE.BoxGeometry(1.62, .72, .052), cloth, [bx, by + 1.15, bz - 1.32]);
  const [sx, sy, sz] = actions.get(Y.private)!.p;
  const sealed = part(root, new THREE.BoxGeometry(.58, .09, .34), red, [sx, sy + .93, sz - 1.05]);
  const [gx, gy, gz] = actions.get(Y.gate)!.p;
  const screen = part(root, new THREE.BoxGeometry(4.25, 2.85, .25), wood, [gx, gy + 1.43, gz - 1.6]);
  const screenGeometry = screen.geometry.clone().translate(...screen.position.toArray());
  const screenCollider: Collider = { name: 'COL_KyotoWitnessFireScreen', bvh: new MeshBVH(screenGeometry), enabled: false };
  for (const x of [-2.2, 2.2]) art.box([gx + x, gy + 2.7, gz - 1.6], [.21, 5.4, .29], '#896d59');
  const survivors = createSettlementNpcs([
    { id: 'kyoto_nobunaga_court', role: ['织田信长', 'Oda Nobunaga'], region: 'kyoto', position: [gx, gy, gz - 3.3], lines: [['我会交出钥匙。', 'I will surrender the keys.']] },
    { id: 'kyoto_court_witness', role: ['外院证人', 'Court witness'], region: 'kyoto', position: [gx + 1.3, gy, gz - 3.15], lines: [['我还在这里。', 'I am still here.']] },
  ]);
  root.add(survivors.group);
  art.finish('kyoto'); root.name = 'KyotoWitnessAndDispatch';

  let seeded = false;
  function apply(done: ReadonlySet<string>, dt: number) {
    root.visible = kyotoWitnessActive(done) && done.has('musashi_meet');
    belt.visible = root.visible && kyotoWitnessActionReady(Y.cut, done);
    safetyPin.visible = root.visible && kyotoWitnessActionReady(Y.pin, done);
    if (!kyotoRollStopped(done)) spool.rotation.x += dt * 1.8;
    const liftY = ly + (kyotoHoistLowered(done) ? .06 : 3.25);
    const screenY = gy + (done.has(Y.gate) ? 4.28 : 1.43);
    screenCollider.enabled = root.visible && !done.has(Y.gate);
    if (!seeded) { platform.position.y = liftY; screen.position.y = screenY; seeded = true; }
    else {
      platform.position.y = THREE.MathUtils.damp(platform.position.y, liftY, 2.5, dt);
      screen.position.y = THREE.MathUtils.damp(screen.position.y, screenY, 3, dt);
    }
    // Aki is one resident: use the same model at the paper table before the
    // two-source inquiry, then at the existing lift scene. Never clone her.
    const atPaperShop = !kyotoStreetReady(done) && !done.has(Y.reel);
    const parent = atPaperShop ? root : platform;
    if (witness.group.parent !== parent) parent.add(witness.group);
    witness.group.position.fromArray(atPaperShop ? kyotoStreetPoint(180, 6.25, 51.6) : [0, 0, 0]);
    witness.group.visible = !done.has(Y.testimony);
    survivors.group.visible = kyotoOrdersDelivered(done);
    notice.visible = done.has(Y.public); sealed.visible = done.has(Y.private);
    bell.rotation.z = done.has(Y.public) ? .16 : 0;
  }
  function dispose() {
    screenCollider.enabled = false; screenGeometry.dispose();
    witness.dispose(); survivors.dispose();
    root.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose(); });
    for (const mat of [wood, metal, cloth, highlighted, red, ...Object.values(art.materials)]) mat.dispose();
    root.removeFromParent();
  }
  return { root, markers, targets, screenCollider, apply, dispose };
}
