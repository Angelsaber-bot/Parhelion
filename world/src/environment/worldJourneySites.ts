import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import { egyptToWorld } from '../map/egyptPlan';
import { qinToWorld } from '../map/qinPlan';
import { mergeParts } from '../settlements/merge';
import { createSettlementNpcs } from '../settlements/npcs';
import type { SettlementPlacement } from '../settlements/types';
import { SiteArt } from '../story/campaignSites';
import { JOURNEY as J, JOURNEY_DISPATCH, journeyEnabled, journeyStepReady, type JourneyPoint } from '../story/worldJourney';

type Height = (x: number, z: number, ceiling?: number) => number | null;
type Clear = (p: THREE.Vector3) => boolean;
const local = (toWorld: (x: number, z: number) => [number, number], x: number, y: number, z: number): JourneyPoint => {
  const [wx, wz] = toWorld(x, z);
  return [wx, y, wz];
};

export function createWorldJourneySites(residence: SettlementPlacement, ground: Height, clear: Clear) {
  const [ox, oy, oz] = residence.position;
  const a = new SiteArt();
  const markers: Marker[] = [];
  const targets: THREE.Mesh[] = [];
  const metal = '#465966', sandstone = '#bda57d', amber = '#e4a447', verdigris = '#70b6a5', wood = '#796652';
  const pinMaterial = new THREE.MeshStandardMaterial({ color: amber, emissive: '#a35f14', emissiveIntensity: .36 });
  function floor(preferred: JourneyPoint): JourneyPoint {
    const [x, y, z] = preferred;
    for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [4, 2], [-4, 2], [4, -2], [-4, -2], [0, 6], [0, -6]]) {
      const sample = ground(x + dx, z + dz, y + 2.1);
      if (sample !== null && Math.abs(sample - y) <= 2.2 && sample > 1.15 && clear(new THREE.Vector3(x + dx, sample + .04, z + dz))) return [x + dx, sample, z + dz];
    }
    return [x, ground(x, z, y + 2.1) ?? y, z];
  }
  function stand(id: string, label: string, preferred: JourneyPoint, art = true) {
    const [x, y, z] = floor(preferred);
    markers.push({ id, label, type: 'interact', p: [x, y + .92, z], radius: 2.1 });
    if (art) {
      a.box([x, y + .45, z - .74], [.64, .88, .41], metal);
      a.box([x, y + .91, z - .74], [1.08, .14, .64], sandstone);
      a.box([x, y + 1, z - .66], [.72, .035, .35], verdigris, false, 'metal');
    }
    return [x, y, z] as JourneyPoint;
  }
  function shotPin(id: string, position: JourneyPoint) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(.5, .64, .5), pinMaterial);
    pin.position.fromArray(position); pin.name = `TGT_${id}`; pin.userData.target = id;
    targets.push(pin); a.root.add(pin);
    a.box([position[0], position[1] - .76, position[2]], [.23, .93, .23], metal);
    return pin;
  }
  const lake = stand(J.lake, '镜湖 · 与 Saber 会合', [-26, 4, 16]);
  const winch = stand(J.lakeWinch, '镜湖导架绞盘', [lake[0] + 6, lake[1], lake[2] + 1]);
  const lakePin = shotPin(J.lakePin, [winch[0] + 5, winch[1] + 1.42, winch[2] - 2]);
  a.beam([winch[0] + .65, winch[1] + .91, winch[2] - .65], lakePin.position.toArray(), .08, metal, false, 'briefed');
  for (const side of [-1, 1]) a.box([winch[0] + 2, winch[1] + .95, winch[2] + side * 1.6], [.18, 1.9, .18], wood);
  a.box([winch[0] + 2, winch[1] + .48, winch[2]], [3.4, .21, 2.7], wood, false, 'resolved');

  const [bx, by, bz] = stand(J.bridge, '回望桥 · 机械侧门', [-275, 5, -30]);
  const visitor = stand(J.visitor, '回望桥 · 接应访客', [bx + 12, by, bz]);
  stand(J.epilogue, '回望桥 · 填上回程时间', [bx + 17, by, bz - 1]);
  const homecoming = floor([bx - 2, by, bz]);
  const bridgeSurface = Math.max(by + .04, ground(bx + 4.5, bz, by + 2) ?? by);
  for (let i = 0; i < 15; i++) a.box([bx + 1.3 + i * .46, bridgeSurface, bz], [.43, .16, 3.05], wood, true);
  for (const z of [bz - 1.48, bz + 1.48]) {
    a.box([bx + 4.5, bridgeSurface + .83, z], [7.1, .13, .12], wood, true);
    for (const x of [bx + 1.15, bx + 4.5, bx + 7.85]) a.box([x, bridgeSurface + .45, z], [.16, .94, .16], wood);
    a.box([bx + 4.5, bridgeSurface + .47, z], [7.1, .12, .13], verdigris, false, 'choiceB');
  }
  const bridgeGateGeometry = new THREE.BoxGeometry(.18, 1.7, 2.8).translate(bx + 1.2, bridgeSurface + .85, bz);
  const bridgeGateMaterial = new THREE.MeshStandardMaterial({ color: metal });
  const bridgeGate = new THREE.Mesh(bridgeGateGeometry, bridgeGateMaterial);
  bridgeGate.name = 'JourneyLookbackGate'; a.root.add(bridgeGate);

  stand(J.meal, '生活馆 · 孟槐的热饭', [ox - 3, oy, oz - 5], false);
  const cargo = stand(J.cargo, '东渡口 · 返程货箱', [278, 16, 30], false);
  a.box([cargo[0], cargo[1] + .41, cargo[2] - 1], [1.9, .82, 1.35], wood);
  a.box([cargo[0], cargo[1] + .91, cargo[2] - 1], [.54, .17, .36], amber, false, 'briefed');
  stand(J.signal, '阿舟的便携接收器', [ox + 4.7, oy, oz + 10.7]);
  const comparison = stand(J.compare, '广播室 · 实况校准板', [-110, 10, 230]);
  stand(JOURNEY_DISPATCH, '出发台 · 埃及、奥尔良与秦', [-111, 10, 237]);
  const [cx, cy, cz] = comparison;
  for (const x of [cx - 1.2, cx + 1.2]) a.box([x, cy + 1.28, cz - 1.35], [.83, .73, .13], metal);
  a.box([cx + 1.2, cy + 1.28, cz - 1.265], [.66, .48, .05], '#f7f1d7');
  const plateGeometry = new THREE.BoxGeometry(.65, .48, .07);
  const plateMaterial = new THREE.MeshStandardMaterial({ color: '#f7f1d7' });
  const plate = new THREE.Mesh(plateGeometry, plateMaterial); plate.name = 'JourneyCalibrationPlate';
  plate.position.set(cx - 1.2, cy + 1.28, cz - 1.265); a.root.add(plate);
  const cutoff = stand(J.cutoff, '下堤闸门 · 执行器', [-106, 10, 240]);
  const bypass = stand(J.bypass, '下堤 · 手动便道', [-99, 10, 248]);
  const gates = [cutoff, bypass].map(([x, y, z], i) => {
    const geometry = new THREE.BoxGeometry(3.7, 1.7, .21).translate(x + (i ? 2.4 : 0), y + .85, z + 1.9);
    const mesh = new THREE.Mesh(geometry, bridgeGateMaterial); mesh.name = `JourneyValleyGate_${i}`; a.root.add(mesh);
    const collider: Collider = { name: `COL_JourneyValleyGate_${i}`, bvh: new MeshBVH(geometry), enabled: false };
    return { mesh, collider };
  });

  stand(J.egyptRead, '绿洲 · 搁浅船只水尺', local(egyptToWorld, -164, 14.5, 114));
  const weir = stand(J.egyptWeir, '水道独立泄洪杆', local(egyptToWorld, -30, 11, 141));
  const river = stand(J.egyptDone, '下游水尺 · 验收渡航', local(egyptToWorld, 2, 9, 144));
  const tie = shotPin(J.egyptTie, [weir[0] + 5, weir[1] + 1.55, weir[2] - 2]);
  const startWater = new THREE.Vector3(weir[0] + 3, weir[1] - .18, weir[2] - 1);
  const endWater = new THREE.Vector3(river[0] - 2, river[1] - .18, river[2] - 1);
  const wetMaterial = new THREE.MeshStandardMaterial({ color: '#39959c', transparent: true, opacity: .74, roughness: .24, side: THREE.DoubleSide });
  const waterLength = startWater.distanceTo(endWater), angle = Math.atan2(startWater.z - endWater.z, endWater.x - startWater.x);
  const waterGeometry = new THREE.PlaneGeometry(waterLength, 3.1, 16, 1).rotateX(-Math.PI / 2).rotateY(angle);
  const middle = startWater.clone().lerp(endWater, .5), verts = waterGeometry.attributes.position;
  for (let i = 0; i < verts.count; i++) {
    const x = middle.x + verts.getX(i), z = middle.z + verts.getZ(i);
    verts.setXYZ(i, x, (ground(x, z, Math.max(weir[1], river[1]) + 2) ?? middle.y) + .064, z);
  }
  waterGeometry.computeVertexNormals(); waterGeometry.computeBoundingSphere();
  const water = new THREE.Mesh(waterGeometry, wetMaterial); water.name = 'JourneyEgyptIndependentWater';
  a.root.add(water);
  const boat = new THREE.Group(); boat.name = 'JourneyEgyptFerry';
  const ferryMaterials = [new THREE.MeshStandardMaterial({ color: wood }), new THREE.MeshStandardMaterial({ color: sandstone })];
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, .38, 1.22), ferryMaterials[0]); hull.position.y = .2;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.18, .8, .8), ferryMaterials[1]); cabin.position.y = .71;
  boat.add(hull, cabin); boat.rotation.y = angle; a.root.add(boat);
  stand(J.orleansRead, '奥尔良集市 · 城防分工', [-802, 14.5, -1350]);
  stand(J.orleansFlag, '河门 · 接应旗手', [-874, 8, -1512]);
  const orleans = stand(J.orleansDone, '桥头堡 · 两岸通行验收', [-725.5, 14.2, -1151]);
  const battery = stand(J.orleansBattery, '桥头堡炮台 · 拆下击发杆', [-716.5, 14.2, -1152.5]);
  const batteryBrace = shotPin(J.orleansBrace, [battery[0] + 3.5, battery[1] + 1.4, battery[2] - 2.4]);
  a.cyl([battery[0] + 2.3, battery[1] + .52, battery[2] - 2.4], 1.2, 1.04, wood);
  a.cyl([battery[0] + 2.35, battery[1] + 1.45, battery[2] - 1.9], .32, 2.4, metal, false, 'metal', [Math.PI / 2, 0, 0]);
  const reliefFlags = new THREE.Group(); a.root.add(reliefFlags);
  const flagMaterial = new THREE.MeshStandardMaterial({ color: '#a23836', side: THREE.DoubleSide });
  for (const x of [orleans[0] - 2, orleans[0] + 2]) {
    a.box([x, orleans[1] + 1.65, orleans[2]], [.13, 3.3, .13], wood);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, .65), flagMaterial); flag.position.set(x + .48, orleans[1] + 2.7, orleans[2]); reliefFlags.add(flag);
  }
  stand(J.qinRead, '工匠镇 · 封陵册', local(qinToWorld, -182, 22.5, 103));
  const march = stand(J.qinMarch, '军阵中轴 · 行令', local(qinToWorld, -17, 28, -111));
  const halt = stand(J.qinHalt, '军阵中轴 · 驻令', local(qinToWorld, -17, 28, -149));
  stand(J.qinDone, '铜闸内侧 · 交出军令册', local(qinToWorld, -17, 28, -162));

  const firstBearing = stand(J.skyBearing, '镜湖北岸 · 第一组天穹方位', [-24, 5, -46]);
  const secondBearing = stand(J.skySight, '幻日塔外 · 第二组天穹方位', [13, 5, -111]);
  for (const [x, y, z] of [firstBearing, secondBearing]) a.beam([x - .22, y + 1.25, z - .73], [x + .4, y + 1.64, z - 1.58], .21, metal);
  stand(J.handover, '回望桥 · 地面维护交接', [bx + 11, by, bz + 3.3]);
  stand(J.groundWatch, '幻日塔 · 独立线路联检', [5, 5, -95]);
  stand(J.launch, '幻日塔顶 · 天穹接驳架', [4.5, 30.5, -151.2]);
  a.finish('alpha'); a.root.name = 'WorldJourneySites';

  const residents = createSettlementNpcs([
    { id: 'journey_visitor_actor', region: 'alpha', role: ['王城访客', 'Kingdom visitor'], position: [bx, by, bz], yaw: Math.PI / 2, appearance: { coat: 0xa4885a, carry: 'sack' }, lines: [] },
    { id: 'journey_qin_work_actor', region: 'alpha', worldRegion: 'qin', role: ['工匠', 'Worker'], position: [march[0] - 3.2, march[1], march[2]], appearance: { coat: 0x7f6249, carry: 'sack' }, lines: [] },
  ]);
  const visitorActor = residents.group.getObjectByName('Resident_journey_visitor_actor');
  const workerActor = residents.group.getObjectByName('Resident_journey_qin_work_actor');
  a.root.add(residents.group);

  const solids = mergeParts(a.solids); a.solids.forEach(g => g.dispose());
  const bridgeCollider: Collider = { name: 'COL_JourneyLookbackGate', bvh: new MeshBVH(bridgeGateGeometry), enabled: false };
  const colliders: Collider[] = [{ name: 'COL_JourneyFixtures', bvh: new MeshBVH(solids), enabled: true }, bridgeCollider, ...gates.map(gate => gate.collider)];
  let bridgeOpen = false, visitTravel = 0, waterOpen = false, boatTravel = 0, marchOrdered = false, halted = false, marchTravel = 0;
  function apply(done: ReadonlySet<string>) {
    bridgeCollider.enabled = journeyEnabled(done) && !done.has(J.bridge) && !done.has(J.finish);
    bridgeGate.visible = bridgeCollider.enabled;
    lakePin.visible = journeyStepReady(J.lakeWinch, done);
    tie.visible = journeyStepReady(J.egyptWeir, done);
    batteryBrace.visible = journeyStepReady(J.orleansBattery, done);
    plateMaterial.color.setHex(done.has(J.compare) ? 0x2a3848 : 0xf7f1d7);
    bridgeOpen = done.has(J.bridge);
    if (!bridgeOpen) visitTravel = 0;
    if (done.has(J.visitor)) {
      visitTravel = 1;
      residents.pose('journey_visitor_actor', [visitor[0] + .85, visitor[1], visitor[2]], Math.PI / 2);
    }
    waterOpen = done.has(J.egyptWeir); water.visible = waterOpen;
    if (!waterOpen) boatTravel = 0;
    marchOrdered = done.has(J.qinMarch); halted = done.has(J.qinHalt);
    if (!marchOrdered) marchTravel = 0;
    if (halted) marchTravel = 1;
    for (const [i, gate] of gates.entries()) {
      gate.collider.enabled = done.has(J.compare) && !(i ? done.has(J.bypass) : done.has(J.cutoff));
      gate.mesh.visible = gate.collider.enabled;
    }
    reliefFlags.visible = done.has(J.orleansFlag);
    a.layers.get('briefed')!.visible = !done.has(J.lakeWinch) || !done.has(J.cargo);
    a.layers.get('resolved')!.visible = done.has(J.lakeWinch);
    a.layers.get('choiceB')!.visible = done.has(J.finish);
    a.root.updateMatrixWorld(true);
  }
  const boatPoint = new THREE.Vector3();
  function update(dt: number, player: THREE.Vector3) {
    residents.update(dt, player);
    if (visitorActor) visitorActor.visible &&= bridgeOpen;
    if (workerActor) workerActor.visible &&= marchOrdered;
    if (bridgeOpen && visitTravel < 1) {
      visitTravel = Math.min(1, visitTravel + dt / 6);
      const x = THREE.MathUtils.lerp(bx + 1.5, visitor[0] + .85, visitTravel);
      const y = ground(x, bz, by + 1.6) ?? by;
      residents.pose('journey_visitor_actor', [x, y + .03, bz], Math.PI / 2);
    }
    if (marchOrdered) {
      if (!halted && marchTravel < 1) marchTravel = Math.min(1, marchTravel + dt / 8);
      residents.pose('journey_qin_work_actor', [march[0] - 3.2, march[1], THREE.MathUtils.lerp(march[2], halt[2] - 2, marchTravel)], 0);
    }
    boat.visible = waterOpen;
    if (waterOpen && boatTravel < 1) {
      boatTravel = Math.min(1, boatTravel + dt / 11);
      boatPoint.copy(startWater).lerp(endWater, boatTravel);
      boat.position.set(boatPoint.x, (ground(boatPoint.x, boatPoint.z, Math.max(weir[1], river[1]) + 2) ?? boatPoint.y) + .08, boatPoint.z);
    }
  }
  return { root: a.root, markers, targets, colliders, homecoming, apply, update, visitorArrived: () => visitTravel >= 1, dispose() {
    residents.dispose();
    a.root.removeFromParent();
    a.root.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose(); });
    solids.dispose(); Object.values(a.materials).forEach(material => material.dispose());
    for (const material of [pinMaterial, bridgeGateMaterial, plateMaterial, wetMaterial, flagMaterial, ...ferryMaterials]) material.dispose();
    for (const collider of colliders) collider.enabled = false;
  } };
}
