import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import { egyptToWorld } from '../map/egyptPlan';
import { GATES } from '../map/regions';
import { ORLEANS_WORKS } from '../map/orleansWorks';
import { qinToWorld } from '../map/qinPlan';
import { mergeParts } from '../settlements/merge';
import { createSettlementNpcs } from '../settlements/npcs';
import type { SettlementPlacement } from '../settlements/types';
import { SiteArt } from '../story/campaignSites';
import { createLookbackDeck } from './lookbackDeck';
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
  const regionalArt = { Egypt: new SiteArt(), Orleans: new SiteArt(), Qin: new SiteArt() };
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
  function stand(id: string, label: string, preferred: JourneyPoint, art: SiteArt | false = a) {
    const [x, y, z] = floor(preferred);
    markers.push({ id, label, type: 'interact', p: [x, y + .92, z], radius: 2.1 });
    if (art) {
      art.box([x, y + .45, z - .74], [.64, .88, .41], metal);
      art.box([x, y + .91, z - .74], [1.08, .14, .64], sandstone);
      art.box([x, y + 1, z - .66], [.72, .035, .35], verdigris, false, 'metal');
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
  const lake = stand(J.lake, '镜湖 · 与 Saber 会合', [-57, 4.5, 65]);
  const winch = stand(J.lakeWinch, '镜湖导架绞盘', [lake[0] + 6, lake[1], lake[2] + 1]);
  const lakePin = shotPin(J.lakePin, [winch[0] + 5, winch[1] + 1.42, winch[2] - 2]);
  const bracePosition = new THREE.Vector3(...floor([winch[0] + 1.6, winch[1], winch[2] - 1.85]));
  const guide = new SiteArt();
  guide.box([.65, .02, 0], [2.35, .15, .23], wood);
  for (const x of [-.39, .43, 1.69]) guide.box([x, 0, 0], [.13, .26, .31], metal, false, 'metal');
  guide.box([.2, -.09, -.16], [.29, .12, .13], amber, false, 'metal');
  guide.finish('alpha');
  guide.root.name = 'MirrorLakeGuideFrame';
  guide.root.position.copy(bracePosition).add(new THREE.Vector3(0, 1.18, .48));
  guide.root.rotation.z = .22;
  const grip = new THREE.Object3D();
  grip.name = 'MirrorLakeGuideGrip';
  grip.position.set(.2, -.19, -.16);
  guide.root.add(grip);
  a.root.add(guide.root);
  for (const x of [-.53, 1.78]) {
    a.box([bracePosition.x + x, bracePosition.y + .47, bracePosition.z + .48], [.17, .94, .22], wood);
    a.box([bracePosition.x + x, bracePosition.y + .05, bracePosition.z + .48], [.36, .1, .46], sandstone);
  }
  a.beam([winch[0] + .25, winch[1] + .84, winch[2] - .72], lakePin.position.toArray(), .046, metal, false, 'briefed');
  const braceTarget = new THREE.Vector3();
  const lakeBrace = { position: bracePosition, target: braceTarget };
  const lakeApproach = new THREE.Vector3(...lake);
  let lakeMeeting = false, lakeWaiting = false, lakeReleased: boolean | undefined, frameDrop = 0;

  const [ridgeX, , ridgeZ] = GATES.britain.p;
  const ridgeY = ground(ridgeX, ridgeZ, 40) ?? 4;
  const ridge = stand(J.ridge, '西岭 · 外勤路单', [ridgeX, ridgeY, ridgeZ], false);
  const ridgeLantern = new THREE.Mesh(
    new THREE.BoxGeometry(.24, .36, .25),
    new THREE.MeshStandardMaterial({ color: '#615949', emissive: '#ffcf6b', emissiveIntensity: 0 }),
  );
  ridgeLantern.name = 'WestRidgeRouteLamp';
  for (const side of [-1, 1]) {
    const x = ridge[0] - .55, z = ridge[2] + side * 1.36;
    const y = ground(x, z, ridge[1] + 3) ?? ridge[1];
    a.box([x, y + .17, z], [.54, .33, .5], sandstone, true);
    a.box([x, y + .93, z], [.19, 1.7, .22], wood);
    a.box([x, y + 2.12, z], [.4, .09, .37], metal);
    if (side === -1) ridgeLantern.position.set(x, y + 1.89, z);
  }
  a.root.add(ridgeLantern);
  a.box([ridge[0] - .22, ridge[1] + .42, ridge[2] - .68], [.72, .84, .35], wood);
  a.box([ridge[0] - .22, ridge[1] + .88, ridge[2] - .68], [.87, .10, .51], sandstone);
  a.paper(ridge[0] - .23, ridge[1] + .95, ridge[2] - .66, .5, .32);

  const [bx, by, bz] = stand(J.bridge, '回望桥 · 北侧踏桥', [-275, 5, -30]);
  const southZ = bz + 3.9, rearZ = bz - 4.6;
  stand(J.bridgeSouth, '回望桥 · 南侧踏桥', [bx - 1.2, by, southZ]);
  stand(J.bridgeRear, '前哨 · 旧路后门闩', [bx + 7, by, rearZ]);
  const visitor = stand(J.visitor, '回望桥 · 接应访客', [bx + 12, by, bz]);
  const townDesk = stand(J.visitorDesk, '生活馆外 · 访客的维修台', [ox + 7.4, oy, oz + 4.7], false);
  const bench = new SiteArt();
  bench.box([townDesk[0], townDesk[1] + .89, townDesk[2] - .68], [1.52, .14, .63], wood);
  for (const dx of [-.59, .59]) bench.box([townDesk[0] + dx, townDesk[1] + .43, townDesk[2] - .68], [.14, .83, .47], metal);
  bench.box([townDesk[0] + .36, townDesk[1] + 1.05, townDesk[2] - .7], [.47, .2, .35], verdigris);
  for (const dx of [-.42, -.14]) bench.ring([townDesk[0] + dx, townDesk[1] + 1, townDesk[2] - .63], .105, .025, metal, 'metal', [Math.PI / 2, 0, 0]);
  bench.finish('alpha');
  bench.root.name = 'LookbackVisitorWorkbench';
  a.root.add(bench.root);
  const townVisitor = new THREE.Vector3(...floor([townDesk[0] + 1.12, townDesk[1], townDesk[2] - .61]));
  stand(J.epilogue, '回望桥 · 填上回程时间', [bx + 17, by, bz - 1]);
  const homecoming = floor([bx - 2, by, bz]);
  const bridgeGround = (x: number, z: number) => ground(x, z, by + 2) ?? by;
  const bridgeSurface = bridgeGround(bx + 1.2, bz);
  const northDeck = createLookbackDeck('North', bx + .8, bx + 9.2, bz, x => bridgeGround(x, bz));
  const southDeck = createLookbackDeck('South', bx + .8, bx + 9.2, southZ, x => bridgeGround(x, southZ));
  a.root.add(northDeck.root, southDeck.root);
  for (const z of [bz, southZ]) for (const x of [bx + .8, bx + 9.2]) {
    const y = bridgeGround(x, z);
    for (const side of [-1, 1]) {
      a.box([x, y + .91, z + side * 1.36], [.2, 1.82, .23], metal, true);
      a.box([x, y + 1.72, z + side * 1.36], [.24, .13, .27], amber);
    }
  }
  for (const x of [bx - 1, bx + 2, bx + 5, bx + 8, bx + 11]) {
    const y = bridgeGround(x, rearZ - .87);
    a.box([x, y + .37, rearZ - .87], [.1, .74, .13], wood);
    a.box([x, y + .63, rearZ - .87], [2.86, .08, .08], wood, true);
  }
  const bridgeGateGeometry = new THREE.BoxGeometry(.18, 1.7, 2.8).translate(bx + 1.2, bridgeSurface + .85, bz);
  const bridgeGateMaterial = new THREE.MeshStandardMaterial({ color: metal });
  const bridgeGate = new THREE.Mesh(bridgeGateGeometry, bridgeGateMaterial);
  bridgeGate.name = 'JourneyLookbackGate'; a.root.add(bridgeGate);
  const rearGateGeometry = new THREE.BoxGeometry(.17, 1.5, 1.58).translate(bx + 7.7, bridgeGround(bx + 7.7, rearZ) + .75, rearZ);
  const rearGate = new THREE.Mesh(rearGateGeometry, bridgeGateMaterial);
  rearGate.name = 'JourneyLookbackRearGate'; a.root.add(rearGate);
  const repair = new SiteArt(), repairZ = southZ;
  const repairGround = (x: number) => ground(x, repairZ, by + 2.1) ?? by;
  const repairLeft = bx - 1, repairRight = bx + 10;
  const repairHeight = Math.max(...[1.5, 3.5, 5.5, 7.5].map(offset => repairGround(bx + offset))) + .18;
  const repairRoute: JourneyPoint[] = [
    [repairLeft, repairGround(repairLeft), repairZ], [bx + 2, repairHeight, repairZ],
    [bx + 7, repairHeight, repairZ], [repairRight, repairGround(repairRight), repairZ],
  ];
  for (let index = 1; index < repairRoute.length; index++) {
    const from = new THREE.Vector3(...repairRoute[index - 1]), to = new THREE.Vector3(...repairRoute[index]);
    const delta = to.clone().sub(from), mid = from.clone().lerp(to, .5);
    const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.clone().normalize());
    const angle = new THREE.Euler().setFromQuaternion(turn).toArray().slice(0, 3) as JourneyPoint;
    const deck = new THREE.PlaneGeometry(delta.length() + .22, 3.45).rotateX(-Math.PI / 2).applyQuaternion(turn).translate(mid.x, mid.y, mid.z);
    repair.solids.push(deck.toNonIndexed()); deck.dispose();
    repair.box([mid.x, mid.y - .12, mid.z], [delta.length() + .05, .23, 3.45], '#98846d', false, 'body', angle);
    for (const edge of [-1.59, 1.59]) {
      repair.box([mid.x, mid.y + .79, repairZ + edge], [delta.length(), .16, .14], wood, true, 'body', angle);
      for (const t of [.15, .85]) {
        const p = from.clone().lerp(to, t);
        repair.box([p.x, p.y + .42, p.z + edge], [.14, .83, .14], wood, true);
      }
    }
  }
  repair.finish('alpha'); repair.root.name = 'LookbackRepairedWalk'; a.root.add(repair.root);
  const repairGeometry = mergeParts(repair.solids); repair.solids.forEach(g => g.dispose());
  const repairCollider: Collider = { name: 'COL_LookbackRepairedWalk', bvh: new MeshBVH(repairGeometry), enabled: false };

  const meal = stand(J.meal, '生活馆 · 公共桌热饭', [ox - 3, oy, oz - 5], false);
  const windowSeat = stand(J.mealWindow, '生活馆 · 廊窗座位', [meal[0] - 3.1, meal[1], meal[2] - .4], false);
  const coatRack = stand(J.mealGear, '生活馆 · 暖廊衣架', [meal[0] + 2.8, meal[1], meal[2] - 1.1], false);
  const sketch = stand(J.mealSketch, '生活馆 · 给阿舟看撤离草图', [meal[0] - 1.3, meal[1], meal[2] + 2.6], false);
  const mealArt = new SiteArt();
  for (const [x, y, z] of [meal, windowSeat]) {
    mealArt.box([x, y + .82, z - .71], [1.34, .15, .67], wood);
    for (const dx of [-.54, .54]) mealArt.box([x + dx, y + .39, z - .71], [.13, .77, .5], wood);
    mealArt.box([x + .74, y + .43, z + .18], [.42, .13, .42], wood);
    mealArt.box([x + .74, y + .22, z + .18], [.29, .42, .29], wood);
  }
  for (const dx of [-.45, .45]) mealArt.box([coatRack[0] + dx, coatRack[1] + .81, coatRack[2] - .66], [.11, 1.62, .14], wood);
  mealArt.box([coatRack[0], coatRack[1] + 1.51, coatRack[2] - .66], [1.06, .11, .14], wood);
  mealArt.box([coatRack[0], coatRack[1] + 1.04, coatRack[2] - .66], [.49, .73, .15], '#5d7882', false, 'resolved');
  mealArt.box([sketch[0], sketch[1] + .49, sketch[2] - .68], [.87, .98, .46], wood);
  mealArt.paper(sketch[0], sketch[1] + 1, sketch[2] - .67, .57, .34, 'choiceB');
  mealArt.finish('alpha');
  mealArt.root.name = 'WinterReturnMealPorch';
  a.root.add(mealArt.root);
  const bowl = new THREE.Group();
  bowl.name = 'WinterReturnMealBowl';
  const ceramic = new THREE.MeshStandardMaterial({ color: '#ba8f67', roughness: .76 });
  const soup = new THREE.MeshStandardMaterial({ color: '#e1af5a', roughness: .43 });
  bowl.add(new THREE.Mesh(new THREE.CylinderGeometry(.14, .08, .11, 12), ceramic));
  const broth = new THREE.Mesh(new THREE.CylinderGeometry(.123, .123, .01, 12), soup);
  broth.position.y = .055;
  bowl.add(broth);
  mealArt.root.add(bowl);

  const medicineStart = new THREE.Vector3(...floor([windowSeat[0] - 3.6, windowSeat[1], windowSeat[2] - 4.6]));
  const medicineStore = new THREE.Vector3(...floor([meal[0] + 3.4, meal[1], meal[2] - 4.6]));
  const medicineCart = new THREE.Group();
  medicineCart.name = 'WinterReturnMedicineCart';
  const trolleyWood = new THREE.MeshStandardMaterial({ color: wood });
  const trolleyMetal = new THREE.MeshStandardMaterial({ color: metal });
  const medicalBoxMaterial = new THREE.MeshStandardMaterial({ color: '#8b9f7e' });
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.05, .15, 1.35), trolleyWood);
  trolley.position.y = .34;
  medicineCart.add(trolley);
  const wheels = new THREE.CylinderGeometry(.19, .19, .11, 12).rotateZ(Math.PI / 2);
  for (const x of [-.5, .5]) for (const z of [-.43, .43]) {
    const wheel = new THREE.Mesh(wheels, trolleyMetal);
    wheel.position.set(x, .19, z);
    medicineCart.add(wheel);
  }
  const box = new THREE.Mesh(new THREE.BoxGeometry(.64, .29, .81), medicalBoxMaterial);
  box.position.y = .56;
  medicineCart.add(box);
  const distributed = new THREE.Mesh(new THREE.BoxGeometry(.64, .29, .81), medicalBoxMaterial);
  distributed.name = 'WinterReturnMedicineDelivered';
  distributed.position.copy(medicineStore).add(new THREE.Vector3(.81, .145, .28));
  distributed.rotation.y = .24;
  mealArt.root.add(medicineCart, distributed);
  const medicinePoint = new THREE.Vector3();
  const medicineHeading = Math.atan2(medicineStore.x - medicineStart.x, medicineStore.z - medicineStart.z);
  const medicineTravelSeconds = Math.max(3, medicineStart.distanceTo(medicineStore) / 1.85);
  const medicineWorker = 'journey_winter_medicine_worker';
  let medicineTravel: number | undefined;
  let medicineAvailable = false;
  const cargo = stand(J.cargoCall, '东渡口 · 扣货记录', [269, 5, 77]);
  stand(J.cargoSwitch, '东渡口 · 本地支线道岔', [cargo[0] + 17, cargo[1], cargo[2] + 3]);
  stand(J.cargo, '东渡口 · 取回返程信标', [cargo[0] + 3, cargo[1], cargo[2] + 1.6], false);
  const cargoMarker = markers.at(-1)!;
  const railStart = cargo[0] + 2, railLength = 42, railZ = cargo[2] - 2.45;
  const cart = new THREE.Group(); cart.name = 'JourneyCargoCart'; a.root.add(cart);
  const cargoMaterials = [new THREE.MeshStandardMaterial({ color: wood }), new THREE.MeshStandardMaterial({ color: metal }), pinMaterial];
  const cartBed = new THREE.Mesh(new THREE.BoxGeometry(2.25, .25, 1.62), cargoMaterials[1]); cartBed.position.y = .43;
  const cargoCrate = new THREE.Mesh(new THREE.BoxGeometry(1.6, .83, 1.21), cargoMaterials[0]); cargoCrate.position.y = .95;
  const cartPin = new THREE.Mesh(new THREE.BoxGeometry(.42, .42, .27), pinMaterial); cartPin.name = 'JourneyCargoCoupler';
  cartPin.position.set(-.94, .71, .84); cartPin.userData.target = J.cargoPin; targets.push(cartPin);
  cart.add(cartBed, cargoCrate, cartPin);
  const railY = (x: number, z: number) => ground(x, z, cargo[1] + 3) ?? cargo[1];
  for (let offset = 0; offset <= railLength; offset += 2) {
    const x = railStart + offset, y = railY(x, railZ);
    a.box([x, y + .03, railZ], [.17, .07, 1.7], wood);
    if (offset < railLength) for (const z of [railZ - .62, railZ + .62]) a.beam([x, railY(x, z) + .072, z], [x + 2, railY(x + 2, z) + .072, z], .09, metal);
  }
  for (const offset of [18, 23, 28, 33]) {
    const x = railStart + offset, z = railZ + (offset - 18) * .24;
    a.box([x, railY(x, z) + .055, z], [2.6, .07, .42], verdigris);
  }
  const depotX = railStart + railLength;
  const depotY = railY(depotX, railZ);
  for (const dz of [-2.25, 2.25]) a.box([depotX, depotY + 1.6, railZ + dz], [.24, 3.2, .26], wood);
  a.box([depotX, depotY + 3.1, railZ], [5.5, .22, 5.3], metal);
  stand(J.signalLamp, '归航灯 · 照明支路', [ox - 1.9, oy, oz + 10.5]);
  const signal = stand(J.signal, '阿舟的便携接收器', [ox + 4.7, oy, oz + 10.7]);
  const lampMaterial = new THREE.MeshStandardMaterial({ color: '#f3d996', emissive: '#e2b560', emissiveIntensity: .65 });
  const transmitterMaterial = new THREE.MeshStandardMaterial({ color: '#5cb4a4', emissive: '#5cb4a4', emissiveIntensity: .65 });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(.28, .45, .3), lampMaterial);
  lamp.position.set(ox - 1.9, oy + 2.35, oz + 9.65); a.root.add(lamp);
  a.box([ox - 1.9, oy + 1.09, oz + 9.65], [.14, 2.18, .14], metal);
  const transmitter = new THREE.Mesh(new THREE.BoxGeometry(.41, .085, .22), transmitterMaterial);
  transmitter.position.set(signal[0], signal[1] + 1.08, signal[2] - .61); a.root.add(transmitter);
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

  stand(J.egyptRead, '绿洲 · 搁浅船只水尺', local(egyptToWorld, -164, 14.5, 114), regionalArt.Egypt);
  const weir = stand(J.egyptWeir, '水道独立泄洪杆', local(egyptToWorld, -30, 11, 141), regionalArt.Egypt);
  const river = stand(J.egyptDone, '下游水尺 · 验收渡航', local(egyptToWorld, 2, 9, 144), regionalArt.Egypt);
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
  stand(J.orleansRead, '奥尔良集市 · 城防分工', [-802, 14.5, -1350], regionalArt.Orleans);
  stand(J.orleansFlag, '河门 · 接应旗手', [-874, 8, -1512], regionalArt.Orleans);
  const orleans = stand(J.orleansDone, '桥头堡 · 两岸通行验收', [-725.5, 14.2, -1151], regionalArt.Orleans);
  const battery = stand(J.orleansBattery, '桥头堡炮台 · 拆下击发杆', [-716.5, 14.2, -1152.5], regionalArt.Orleans);
  const batteryBrace = shotPin(J.orleansBrace, [battery[0] + 3.5, battery[1] + 1.4, battery[2] - 2.4]);
  regionalArt.Orleans.cyl([battery[0] + 2.3, battery[1] + .52, battery[2] - 2.4], 1.2, 1.04, wood);
  regionalArt.Orleans.cyl([battery[0] + 2.35, battery[1] + 1.45, battery[2] - 1.9], .32, 2.4, metal, false, 'metal', [Math.PI / 2, 0, 0]);
  const reliefFlags = new THREE.Group(); a.root.add(reliefFlags);
  const flagMaterial = new THREE.MeshStandardMaterial({ color: '#a23836', side: THREE.DoubleSide });
  for (const x of [orleans[0] - 2, orleans[0] + 2]) {
    regionalArt.Orleans.box([x, orleans[1] + 1.65, orleans[2]], [.13, 3.3, .13], wood);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, .65), flagMaterial); flag.position.set(x + .48, orleans[1] + 2.7, orleans[2]); reliefFlags.add(flag);
  }
  stand(J.qinRead, '工匠镇 · 封陵册', local(qinToWorld, -182, 22.5, 103), regionalArt.Qin);
  const march = stand(J.qinMarch, '军阵中轴 · 行令', local(qinToWorld, -17, 28, -111), regionalArt.Qin);
  const halt = stand(J.qinHalt, '军阵中轴 · 驻令', local(qinToWorld, -17, 28, -149), regionalArt.Qin);
  stand(J.qinDone, '铜闸内侧 · 交出军令册', local(qinToWorld, -17, 28, -162), regionalArt.Qin);

  const firstBearing = stand(J.skyBearing, '镜湖北岸 · 第一组天穹方位', [-38, 2.5, -78]);
  const secondBearing = stand(J.skySight, '幻日塔外 · 第二组天穹方位', [13, 5, -111]);
  for (const [x, y, z] of [firstBearing, secondBearing]) a.beam([x - .22, y + 1.25, z - .73], [x + .4, y + 1.64, z - 1.58], .21, metal);
  stand(J.handover, '回望桥 · 地面维护交接', [bx + 11, by, bz + 3.3]);
  stand(J.groundWatch, '幻日塔 · 独立线路联检', [5, 5, -95]);
  stand(J.launch, '幻日塔顶 · 天穹接驳架', [4.5, 30.5, -151.2]);
  a.finish('alpha'); a.root.name = 'WorldJourneySites';
  // Keep each merged draw bounded to its own map, so distant fixtures can be culled.
  for (const [region, art] of Object.entries(regionalArt)) {
    art.finish('alpha');
    art.root.name = `WorldJourneyFixtures${region}`;
    a.root.add(art.root);
  }

  const residents = createSettlementNpcs([
    { id: medicineWorker, region: 'alpha', role: ['药箱搬运员', 'Medicine porter'], position: medicineStart.toArray(), yaw: medicineHeading, appearance: { coat: 0x637e73 }, lines: [] },
    { id: 'journey_visitor_actor', region: 'alpha', role: ['王城访客', 'Kingdom visitor'], position: [bx, by, bz], yaw: Math.PI / 2, appearance: { coat: 0xa4885a, carry: 'sack' }, lines: [] },
    { id: 'journey_qin_work_actor', region: 'alpha', worldRegion: 'qin', role: ['工匠', 'Worker'], position: [march[0] - 3.2, march[1], march[2]], appearance: { coat: 0x7f6249, carry: 'sack' }, lines: [] },
    { id: 'journey_orleans_relief_actor', region: 'alpha', worldRegion: 'orleans', role: ['接应队', 'Relief crew'], position: orleans, yaw: Math.PI / 2, appearance: { coat: 0x864b42, carry: 'sack' }, lines: [] },
  ]);
  const visitorActor = residents.group.getObjectByName('Resident_journey_visitor_actor');
  const medicineActor = residents.group.getObjectByName('Resident_' + medicineWorker);
  const workerActor = residents.group.getObjectByName('Resident_journey_qin_work_actor');
  const reliefActor = residents.group.getObjectByName('Resident_journey_orleans_relief_actor');
  a.root.add(residents.group);

  const fixtureSolids = [a, ...Object.values(regionalArt)].flatMap(art => art.solids);
  const solids = mergeParts(fixtureSolids);
  fixtureSolids.forEach(g => g.dispose());
  const bridgeCollider: Collider = { name: 'COL_JourneyLookbackGate', bvh: new MeshBVH(bridgeGateGeometry), enabled: false };
  const rearCollider: Collider = { name: 'COL_JourneyLookbackRearGate', bvh: new MeshBVH(rearGateGeometry), enabled: false };
  const colliders: Collider[] = [{ name: 'COL_JourneyFixtures', bvh: new MeshBVH(solids), enabled: true }, bridgeCollider, rearCollider,
    northDeck.collider, southDeck.collider, repairCollider, ...gates.map(gate => gate.collider)];
  let bridgeOpen = false, visitTravel = 0, waterOpen = false, boatTravel = 0;
  let visitorReceived = false, visitorAtTown = false;
  let route: 'north' | 'south' | 'rear' | undefined, bridgeDrop = 0, bridgeRepaired = false;
  let marchOrdered = false, halted = false, marchTravel = 0;
  let reliefMoving = false, reliefTravel = 0;
  let cartDistance = 0, brakeAt = 0, cartStarted = false, cartParked = false, cartTurned = false, cartBraked = false, cartClaimed = false;
  const brakingStops = [5, 9, 13, 17, 21, 25, 29, 33, 37, 42];
  const brakeFlag = (distance: number) => `journey_cargo_brake_${distance}`;
  function placeCart() {
    const x = railStart + cartDistance, z = railZ + (cartTurned ? Math.max(0, cartDistance - 18) * .24 : 0);
    const y = railY(x, z);
    cart.position.set(x, y + .045, z);
    cart.rotation.y = cartTurned && cartDistance > 18 ? -.235 : 0;
    const approachZ = z + 1.65;
    cargoMarker.p[0] = x; cargoMarker.p[1] = railY(x, approachZ) + .92; cargoMarker.p[2] = approachZ;
    cartPin.visible = cartStarted && !cartParked && !cartTurned && !cartBraked && cartDistance < railLength - 2;
    cart.updateMatrixWorld(true);
  }
  function apply(done: ReadonlySet<string>) {
    const nextOpen = done.has(J.bridge), nextRepaired = done.has(J.finish);
    const nextRoute = done.has(J.bridgeRear) ? 'rear' : done.has(J.bridgeSouth) ? 'south' : 'north';
    if (route === undefined || !nextOpen) bridgeDrop = nextOpen || !journeyEnabled(done) || nextRepaired ? 1 : 0;
    route = nextRoute;
    bridgeOpen = nextOpen;
    bridgeRepaired = nextRepaired;
    bridgeCollider.enabled = journeyEnabled(done) && !nextRepaired && (!nextOpen || route === 'rear' || route === 'south');
    rearCollider.enabled = journeyEnabled(done) && !nextRepaired && !done.has(J.visitor) && (!nextOpen || route !== 'rear');
    bridgeGate.visible = bridgeCollider.enabled;
    rearGate.visible = rearCollider.enabled;
    repair.root.visible = repairCollider.enabled = bridgeRepaired;
    placeBridge();
    lakeMeeting = !done.has('saber_contract') && journeyStepReady(J.lake, done);
    lakeWaiting = journeyStepReady(J.lakeWinch, done);
    lakePin.visible = lakeWaiting;
    const released = done.has(J.lakeWinch);
    const registered = done.has(J.ridge);
    ridgeLantern.material.emissiveIntensity = !released ? 0 : registered ? 1.35 : .83;
    ridgeLantern.material.color.set(released ? '#e8bd69' : '#615949');
    if (lakeReleased === undefined || lakeReleased && !released) {
      frameDrop = released ? 1 : 0;
      placeGuideFrame();
    }
    lakeReleased = released;
    tie.visible = journeyStepReady(J.egyptWeir, done);
    batteryBrace.visible = journeyStepReady(J.orleansBattery, done);
    plateMaterial.color.setHex(done.has(J.compare) ? 0x2a3848 : 0xf7f1d7);
    if (!bridgeOpen) visitTravel = 0;
    visitorReceived = done.has(J.visitor);
    bench.root.visible = visitorReceived;
    medicineAvailable = done.has(J.meal) || journeyStepReady(J.meal, done);
    mealArt.root.visible = medicineAvailable;
    if (medicineTravel === undefined || !medicineAvailable) medicineTravel = done.has(J.meal) ? 1 : 0;
    if (medicineAvailable) placeMedicine();
    mealArt.layers.get('resolved')!.visible = done.has(J.mealGear);
    mealArt.layers.get('choiceB')!.visible = done.has(J.mealSketch);
    const mealSeat = done.has(J.mealWindow) ? windowSeat : meal;
    bowl.position.set(mealSeat[0], mealSeat[1] + .945, mealSeat[2] - .68);
    if (!visitorReceived) visitorAtTown = false;
    if (visitorReceived) {
      visitTravel = 1;
      if (!visitorAtTown) residents.pose('journey_visitor_actor', [visitor[0] + .85, visitor[1], visitor[2]], Math.PI / 2);
    }
    waterOpen = done.has(J.egyptWeir); water.visible = waterOpen;
    if (!waterOpen) boatTravel = 0;
    if (done.has(J.egyptDone)) { boatTravel = 1; placeBoat(); }
    marchOrdered = done.has(J.qinMarch); halted = done.has(J.qinHalt);
    if (!marchOrdered) marchTravel = 0;
    if (halted) marchTravel = 1;
    reliefMoving = done.has(J.orleansFlag) && done.has(ORLEANS_WORKS.bellDone) && done.has(J.orleansBattery);
    if (!reliefMoving) reliefTravel = 0;
    if (done.has(J.orleansDone)) { reliefTravel = 1; placeRelief(); }
    for (const [i, gate] of gates.entries()) {
      gate.collider.enabled = done.has(J.compare) && !(i ? done.has(J.bypass) : done.has(J.cutoff));
      gate.mesh.visible = gate.collider.enabled;
    }
    reliefFlags.visible = done.has(J.orleansFlag);
    a.layers.get('briefed')!.visible = !done.has(J.lakeWinch);
    cartStarted = done.has(J.cargoCall); cartTurned = done.has(J.cargoSwitch); cartClaimed = done.has(J.cargo);
    if (done.has(J.cargoPin)) {
      brakeAt = brakingStops.find(distance => done.has(brakeFlag(distance))) ?? brakingStops[0];
      if (!cartBraked && !cartParked) cartDistance = Math.max(cartDistance, brakeAt - 4);
    }
    cartBraked = done.has(J.cargoPin);
    if (!cartStarted) cartDistance = 0;
    if (done.has(J.cargoParked) && !cartParked) cartDistance = cartTurned ? 33 : cartBraked ? brakeAt : railLength;
    cartParked = done.has(J.cargoParked);
    cargoCrate.visible = !cartClaimed;
    lampMaterial.emissiveIntensity = done.has(J.signalLamp) && !done.has(J.signal) ? 0 : .65;
    lampMaterial.color.setHex(lampMaterial.emissiveIntensity ? 0xf3d996 : 0x566061);
    transmitterMaterial.emissiveIntensity = done.has(J.signal) ? 0 : .65;
    placeCart();
    a.root.updateMatrixWorld(true);
  }
  function placeMedicine() {
    const travel = medicineTravel ?? 0;
    medicinePoint.copy(medicineStart).lerp(medicineStore, travel);
    medicinePoint.y = ground(medicinePoint.x, medicinePoint.z, medicinePoint.y + .8) ?? medicinePoint.y;
    medicineCart.position.copy(medicinePoint);
    medicineCart.rotation.y = medicineHeading;
    box.visible = travel < 1;
    distributed.visible = travel >= 1;
    const offset = travel >= 1 ? .95 : -.86;
    residents.pose(medicineWorker, [
      medicinePoint.x + Math.sin(medicineHeading) * offset, medicinePoint.y, medicinePoint.z + Math.cos(medicineHeading) * offset,
    ], medicineHeading);
  }
  function placeBridge() {
    northDeck.root.visible = !bridgeOpen || route === 'north';
    northDeck.lower(route === 'north' ? bridgeDrop : 0, route === 'north');
    southDeck.root.visible = !bridgeRepaired && (!bridgeOpen || route === 'south');
    southDeck.lower(route === 'south' ? bridgeDrop : 0, route === 'south' && !bridgeRepaired);
  }
  function placeGuideFrame() {
    const drop = THREE.MathUtils.smoothstep(frameDrop, 0, 1);
    guide.root.position.y = bracePosition.y + 1.18 - .31 * drop;
    guide.root.rotation.z = .22 * (1 - drop);
    guide.root.updateMatrixWorld(true);
  }
  const boatPoint = new THREE.Vector3();
  function placeBoat() {
    boatPoint.copy(startWater).lerp(endWater, boatTravel);
    boat.position.set(boatPoint.x, (ground(boatPoint.x, boatPoint.z, Math.max(weir[1], river[1]) + 2) ?? boatPoint.y) + .08, boatPoint.z);
  }
  function placeRelief() {
    const x = orleans[0] + 1.5, z = orleans[2] + THREE.MathUtils.lerp(7, 2.1, reliefTravel);
    residents.pose('journey_orleans_relief_actor', [x, ground(x, z, orleans[1] + 1.4) ?? orleans[1], z], Math.PI);
  }
  function update(dt: number, player: THREE.Vector3) {
    if (lakeReleased && frameDrop < 1 && dt > 0) {
      frameDrop = Math.min(1, frameDrop + dt / .54);
      placeGuideFrame();
    }
    if (bridgeOpen && bridgeDrop < 1 && dt > 0) {
      bridgeDrop = Math.min(1, bridgeDrop + dt / .66);
      placeBridge();
    }
    if (visitorReceived && !visitorAtTown && player.distanceToSquared(townVisitor) < 55 ** 2) {
      visitorAtTown = true;
      residents.pose('journey_visitor_actor', townVisitor.toArray(), -.6);
    }
    if (medicineAvailable && medicineTravel !== undefined && medicineTravel < 1 && dt > 0 && player.distanceToSquared(medicinePoint) < 42 ** 2) {
      medicineTravel = Math.min(1, medicineTravel + dt / medicineTravelSeconds);
      placeMedicine();
    }
    residents.update(dt, player);
    if (medicineActor) medicineActor.visible &&= medicineAvailable;
    if (visitorActor) visitorActor.visible &&= bridgeOpen;
    if (workerActor) workerActor.visible &&= marchOrdered;
    if (reliefActor) reliefActor.visible &&= reliefMoving;
    if (bridgeOpen && visitTravel < 1) {
      if (bridgeDrop >= 1 || route === 'rear') visitTravel = Math.min(1, visitTravel + dt / 5.55);
      const x = THREE.MathUtils.lerp(bx - .5, visitor[0] + .85, visitTravel);
      const pathZ = route === 'rear' ? rearZ : route === 'south' ? southZ : bz;
      const merge = THREE.MathUtils.smoothstep(visitTravel, .72, 1);
      const z = THREE.MathUtils.lerp(pathZ, visitor[2], merge);
      const y = bridgeGround(x, z);
      const yaw = Math.atan2(visitor[0] + 1.35 - bx, (visitor[2] - pathZ) * 6 * merge * (1 - merge));
      residents.pose('journey_visitor_actor', [x, y + .03, z], yaw);
    }
    if (marchOrdered && (workerActor?.visible || !halted)) {
      if (!halted && marchTravel < 1) marchTravel = Math.min(1, marchTravel + dt / 8);
      residents.pose('journey_qin_work_actor', [march[0] - 3.2, march[1], THREE.MathUtils.lerp(march[2], halt[2] - 2, marchTravel)], 0);
    }
    if (reliefMoving && reliefTravel < 1) {
      reliefTravel = Math.min(1, reliefTravel + dt / 4);
      placeRelief();
    }
    boat.visible = waterOpen;
    if (waterOpen && boatTravel < 1) {
      boatTravel = Math.min(1, boatTravel + dt / 11);
      placeBoat();
    }
    if (!cartStarted || cartParked || dt <= 0 || Math.hypot(player.x - cart.position.x, player.z - cart.position.z) > 90) return false;
    const stop = cartTurned ? 33 : cartBraked ? brakeAt : railLength;
    cartDistance = Math.min(stop, cartDistance + dt * (cartBraked ? 1.4 : 3.15));
    placeCart();
    return cartDistance >= stop;
  }
  return { root: a.root, markers, targets, colliders, homecoming, apply, update, visitorArrived: () => visitTravel >= 1,
    lakeBrace(player: THREE.Vector3) {
      if (!(lakeWaiting && player.distanceToSquared(bracePosition) < 34 ** 2 ||
        lakeMeeting && player.distanceToSquared(lakeApproach) < 24 ** 2)) return;
      grip.getWorldPosition(braceTarget);
      return lakeBrace;
    },
    ferryArrived: () => boatTravel >= 1,
    workersArrived: () => marchTravel >= 1,
    reliefArrived: () => reliefTravel >= 1,
    canSwitchCargo: () => cartDistance < 18.8,
    saveCargoBrake(done: Set<string>) {
      const stop = brakingStops.find(distance => distance >= cartDistance + 1.5) ?? railLength;
      done.add(brakeFlag(stop));
    },
    dispose() {
    residents.dispose();
    northDeck.dispose(); southDeck.dispose();
    a.root.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>();
    a.root.traverse(node => { if (node instanceof THREE.Mesh) geometries.add(node.geometry); });
    geometries.forEach(geometry => geometry.dispose());
    solids.dispose(); repairGeometry.dispose();
    [...Object.values(a.materials), ...Object.values(repair.materials), ...Object.values(guide.materials), ...Object.values(bench.materials), ...Object.values(mealArt.materials),
      ...Object.values(regionalArt).flatMap(art => Object.values(art.materials))].forEach(material => material.dispose());
    for (const material of new Set([pinMaterial, bridgeGateMaterial, plateMaterial, wetMaterial, flagMaterial, lampMaterial, transmitterMaterial, ridgeLantern.material, ceramic, soup, trolleyWood, trolleyMetal, medicalBoxMaterial, ...cargoMaterials, ...ferryMaterials])) material.dispose();
    for (const collider of colliders) collider.enabled = false;
  } };
}
