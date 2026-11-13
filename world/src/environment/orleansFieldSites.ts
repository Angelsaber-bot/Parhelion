import * as THREE from 'three';
import { ORLEANS_FIELD as O } from '../story/orleansFieldStories';
import { ORLEANS_WORK_ACTIONS } from '../map/orleansWorks';
import { JOURNEY } from '../story/worldJourney';
import { fieldSideReady } from '../story/fieldSideStories';
import { createSettlementNpcs } from '../settlements/npcs';
import type { FieldAuthoring } from './fieldSiteAuthoring';

type Point = [number, number, number];
const shift = ([x, y, z]: Point, dx = 0, dy = 0, dz = 0): Point => [x + dx, y + dy, z + dz];
const local = (x: number, y: number, z: number): Point => [x - 720, y, z - 1440];
const timberColor = '#77513c', limestone = '#af997b', iron = '#515761';

export function createOrleansFieldSites({ place, interact, scenery, finish, table, mesh, group, walkway, ground,
  materials, prior, updates, targets, actorCleanup }: FieldAuthoring) {
  const { bell, chart, rescue, timber, under, shields } = O;
  const belfry = ORLEANS_WORK_ACTIONS.find(action => action.flag === 'orleans_belfry_rung')!.position;
  const ear = place(local(-6, 24.1, -47), 10.5);
  const roof = place(local(belfry[0] + 3.15, belfry[1], belfry[2] + .65), 7.5);
  const window = place(local(-4, 24.1, -41), 12);
  if (ear && roof && window) {
    interact(bell.listen, ear); interact(bell.roof, roof); interact(bell.flag, window); interact(bell.handoff, window);
    const art = scenery('OrleansApprenticeBellFrame');
    const pivot = group(art.root, shift(roof, .47, 2.22, -1.21), 'OrleansApprenticeClapper');
    mesh(pivot, new THREE.CylinderGeometry(.037, .041, .83, 8), materials.metal, [0, -.42, 0]);
    mesh(pivot, new THREE.SphereGeometry(.114, 10, 8), materials.metal, [0, -.85, 0]);
    for (const x of [-.62, .62]) art.box(shift(roof, x + .47, 1.13, -1.24), [.15, 2.26, .22], timberColor, true);
    art.box(shift(roof, .47, 2.3, -1.23), [1.52, .14, .44], timberColor);
    const wedge = mesh(art.root, new THREE.BoxGeometry(.31, .23, .27), materials.red, shift(roof, .63, 1.48, -.94), 'OrleansBellWedge');
    wedge.rotation.z = .24; wedge.userData.target = bell.shot; targets.push(wedge);
    const pennant = mesh(art.root, new THREE.BoxGeometry(.81, .53, .043), materials.blue, shift(window, .48, 1.68, -.77), 'OrleansBelfrySpareSignal');
    art.beam(shift(window, 0, .25, -.8), shift(window, 0, 2.11, -.8), .064, iron, true);
    const actor = createSettlementNpcs([{
      id: 'orleans_spare_bell_apprentice', role: ['罗班', 'Robin'], region: 'britain', worldRegion: 'orleans', position: shift(ear, .76, 0, -.66),
      appearance: { coat: 0x54788b, trim: 0xc9a577, carry: 'bellrope' }, lines: [],
    }]);
    art.root.add(actor.group); actorCleanup.push(() => actor.dispose());
    finish(art, 'britain');
    let clock = 0;
    updates.push((done, dt, player) => {
      clock += dt;
      const freed = done.has(bell.roof);
      pivot.rotation.z = Math.sin(clock * 3.65) * (freed ? .35 : .08);
      wedge.visible = fieldSideReady(bell.roof, done);
      pennant.visible = done.has(bell.flag);
      if (pennant.visible) pennant.rotation.y = Math.sin(clock * 4.3) * .12;
      const p = done.has(bell.flag) ? window : ear;
      actor.pose('orleans_spare_bell_apprentice', shift(p, .76, 0, -.66), -.75);
      actor.update(dt, player);
    });
  }

  const chartDesk = place(local(-185.2, 8.45, 16), 7.5);
  const redCap = place(local(-187, 8.45, -31), 7.5);
  const notch = place(local(-187, 8.45, -12), 7.5);
  const stripe = place(local(-186.7, 8.45, 34), 7.5);
  const shadow = place(local(-186.2, 8.45, 55), 10.5);
  if (chartDesk && redCap && notch && stripe && shadow) {
    interact(chart.read, chartDesk); interact(chart.upstream, redCap); interact(chart.turn, notch); interact(chart.quay, stripe); interact(chart.shadow, shadow);
    const art = scenery('OrleansQuayChartAndPosts');
    table(art, chartDesk);
    art.box(shift(chartDesk, -.13, 1.25, -.8), [.91, .64, .075], timberColor, false, 'body', [0, 0, -.16]);
    for (let i = 0; i < 3; i++) art.beam(shift(chartDesk, -.43 + i * .21, 1.13, -.744),
      shift(chartDesk, -.36 + i * .18, 1.52, -.744), .021, ['#9d493b', '#404850', '#e0d7bc'][i]);
    for (const [i, p] of [redCap, notch, stripe].entries()) {
      const dx = -4.65, base = Math.min(p[1] - .4, 7.6);
      art.box([p[0] + dx, base - .28, p[2]], [.23, 2.18, .29], timberColor);
      art.box([p[0] + dx, base + .87 - i * .18, p[2]], [.25, .13, .31], ['#a94a42', '#333439', '#f0e0b4'][i]);
      art.beam(shift(p, -.55, 0, 0), shift(p, -.63, .79, 0), .078, limestone);
    }
    art.box(shift(shadow, -1.45, 1.55, .26), [1.8, .16, 2.27], limestone);
    art.box(shift(shadow, -1.38, .69, -1.02), [.4, 1.64, .44], limestone, true);
    const sign = mesh(art.root, new THREE.BoxGeometry(.4, .31, .075), materials.blue, shift(shadow, -.96, 1.09, -1.02), 'OrleansQuietBerthSign');
    const dock = walkway('OrleansChartLanding', 'britain', [shift(shadow, -.39, .04, -.32), shift(shadow, -4.65, -.88, -.32)], 1.45, timberColor, false, false);
    finish(art, 'britain');
    updates.push(done => {
      const marked = done.has(chart.shadow);
      sign.visible = dock.collider.enabled = dock.art.root.visible = marked;
    });
  }

  const bridge = prior.get(JOURNEY.orleansDone)?.p;
  const ditch = bridge && place(shift(bridge, -17, -2, 12), 12);
  const lift = ditch && place(shift(ditch, -2.5, 0, -2.9), 7.5);
  const shelter = ditch && place(shift(ditch, 8.3, .5, 1.1), 9);
  let rescueMotion = 0;
  if (ditch && lift && shelter) {
    interact(rescue.approach, ditch); interact(rescue.help, lift); interact(rescue.exchange, shelter);
    const art = scenery('OrleansDitchStretcherExchange');
    for (const x of [-1.65, 1.65]) for (const z of [-1.55, 1.55])
      art.box(shift(shelter, x, 1.16, z), [.15, 2.32, .16], timberColor, true);
    for (const x of [-.92, .92])
      art.box(shift(shelter, x, 2.43, 0), [2.06, .12, 3.46], '#d7c5a6', false, 'body', [0, 0, x * -.22]);
    const beam = mesh(art.root, new THREE.BoxGeometry(2.74, .19, .26), materials.wood, shift(lift, .31, .42, .57), 'OrleansTrenchFallenBeam');
    beam.rotation.y = -.44;
    const signal = mesh(art.root, new THREE.BoxGeometry(.52, .32, .043), materials.red, shift(lift, -.82, 1.23, -.71), 'OrleansMedicSignal');
    const litter = group(art.root, shift(lift, .42, .13, .88), 'OrleansEnemyStretcher');
    for (const x of [-.32, .32]) mesh(litter, new THREE.CylinderGeometry(.039, .044, 2.11, 9).rotateX(Math.PI / 2), materials.wood, [x, .033, 0]);
    mesh(litter, new THREE.BoxGeometry(.63, .085, 1.8), materials.blue, [0, .05, 0]);
    const figure = group(litter, [0, .08, -.05], 'OrleansWoundedShieldBearer');
    mesh(figure, new THREE.CapsuleGeometry(.193, .64, 4, 10).rotateX(Math.PI / 2), materials.red, [0, .13, .09]);
    mesh(figure, new THREE.SphereGeometry(.146, 12, 9), materials.wood, [0, .15, -.49]);
    for (const s of [-1, 1]) mesh(figure, new THREE.CapsuleGeometry(.07, .39, 4, 9).rotateX(Math.PI / 2), materials.dark, [s * .114, .08, .64]);
    const arm = mesh(figure, new THREE.CapsuleGeometry(.048, .26, 4, 9).rotateX(Math.PI / 2), materials.wood, [.27, .13, -.19]);
    mesh(figure, new THREE.CylinderGeometry(.21, .21, .06, 16), materials.metal, [.49, .036, -.24]);
    const carriers = createSettlementNpcs([0, 1].map(i => ({
      id: 'orleans_truce_medic_' + i, region: 'britain' as const, worldRegion: 'orleans' as const,
      role: ['临时接应医护', 'Exchange medic'], position: shift(lift, .42, 0, .6 + i * 1.3), lines: [],
      appearance: { coat: i ? 0x876751 : 0x637d83, trim: 0xd6c9a2 },
    })));
    art.root.add(carriers.group); actorCleanup.push(() => carriers.dispose());
    const medicModels = [0, 1].map(i => carriers.group.getObjectByName('Resident_orleans_truce_medic_' + i)!);
    finish(art, 'britain');
    const from = new THREE.Vector3(...shift(lift, .42, .08, .88)), to = new THREE.Vector3(...shift(shelter, .1, .1, -.36));
    const point = new THREE.Vector3();
    let clock = 0, initial = true;
    updates.push((done, dt, player) => {
      if (initial) rescueMotion = done.has(rescue.help) ? 1 : 0;
      initial = false;
      clock += dt;
      if (done.has(rescue.help)) rescueMotion = Math.min(1, rescueMotion + dt / (done.has(rescue.medic) ? 8 : 5.5));
      else rescueMotion = 0;
      const travel = THREE.MathUtils.smoothstep(rescueMotion, .29, 1);
      point.copy(from).lerp(to, travel);
      const surface = ground(point.x, point.z, point.y + 1.2) ?? point.y - .08;
      const heading = Math.atan2(to.x - from.x, to.z - from.z);
      litter.rotation.y = travel > 0 ? heading : 0;
      litter.position.set(point.x, surface + .08 + .65 * Math.sin(Math.PI * travel), point.z);
      beam.rotation.z = THREE.MathUtils.smoothstep(rescueMotion, 0, .38) * .89;
      signal.visible = done.has(rescue.medic);
      arm.position.y = .13 + (rescueMotion < .05 || rescueMotion >= 1 ? Math.max(0, Math.sin(clock * 8.2)) * .081 : 0);
      carriers.update(dt, player);
      for (const [i, model] of medicModels.entries()) {
        model.visible &&= rescueMotion > .14;
        const side = i === 0 ? -1 : 1;
        carriers.pose('orleans_truce_medic_' + i, [point.x + Math.sin(heading) * side * 1.06, surface,
          point.z + Math.cos(heading) * side * 1.06], heading);
      }
    });
  }

  const saw = bridge && place(shift(bridge, 16, -1, 13), 13.5);
  const sling = saw && place(shift(saw, 3.3, 0, 1.8), 6);
  const adjust = sling && place(shift(sling, 1.4, 0, 3.1), 6);
  const crossing = adjust && place(shift(adjust, 9.4, 0, .2), 7.5);
  let weight = -2;
  if (saw && sling && adjust && crossing) {
    interact(timber.inspect, saw); interact(timber.sling, sling); interact(timber.trim, adjust); interact(timber.cross, crossing);
    const art = scenery('OrleansBridgeLoadBench');
    table(art, saw); table(art, adjust);
    const loaded = group(art.root, shift(sling, -.66, 1.5, -.8), 'OrleansSlungBridgeLoad');
    mesh(loaded, new THREE.SphereGeometry(.35, 12, 9).scale(1, 1.44, .82), materials.wood, [0, -.77, 0]);
    mesh(loaded, new THREE.CylinderGeometry(.019, .019, .66, 6), materials.dark, [0, -.2, 0]);
    for (const x of [-1.02, 1.02]) art.box(shift(sling, x - .66, 1.16, -.8), [.15, 2.32, .19], timberColor, true);
    art.box(shift(sling, -.66, 2.29, -.8), [2.45, .15, .21], timberColor);
    const counterweight = mesh(art.root, new THREE.BoxGeometry(.25, .22, .41), materials.dark, shift(adjust, 0, 1.01, -.91), 'OrleansBridgeSlidingWeight');
    const needle = mesh(art.root, new THREE.BoxGeometry(.022, .037, .39), materials.beacon, shift(adjust, 0, 1.14, -.91), 'OrleansBridgeLoadMark');
    art.box(shift(adjust, 0, .928, -.9), [1.4, .04, .21], limestone);
    art.box(shift(adjust, 0, .97, -.69), [.035, .031, .19], '#eee1c6');
    for (const x of [-.5, -.25, .25, .5]) art.box(shift(adjust, x, .97, -.69), [.018, .021, .14], iron);
    const deck = walkway('OrleansCarpentersDitchBridge', 'britain',
      [shift(adjust, 1.1, .05, -.06), shift(crossing, -.58, .02)], 2.4, timberColor, false);
    const raised = mesh(art.root, new THREE.BoxGeometry(2.62, .17, 3.17), materials.wood, shift(crossing, -2.16, 1.45), 'OrleansUnbalancedTestDeck');
    raised.rotation.x = .72;
    finish(art, 'britain');
    let clock = 0;
    updates.push((done, dt) => {
      clock += dt;
      const hasLoad = done.has(timber.sling), ready = done.has(timber.trim);
      loaded.position.y = sling[1] + (hasLoad ? 2.08 : 1.21);
      loaded.rotation.z = hasLoad ? Math.sin(clock * 2) * .035 : 0;
      counterweight.position.x = adjust[0] + (hasLoad && !ready ? weight * .215 : 0);
      needle.position.x = counterweight.position.x;
      deck.collider.enabled = deck.art.root.visible = ready;
      raised.visible = !ready;
    });
  }

  const rail = bridge && place(shift(bridge, 7.8, 0, -12.5), 13.5);
  if (rail) {
    const art = scenery('OrleansPierServiceLandings');
    const lower = shift(rail, -3.7, -2.7, -9), upper = shift(rail, -3.7, -.95, -17);
    lower[1] = Math.max(lower[1], (ground(lower[0], lower[2], rail[1] + .65) ?? lower[1]) + .12);
    interact(under.toolbag, rail); interact(under.lower, lower); interact(under.upper, upper);
    art.box(shift(lower, 0, -.14), [3.6, .28, 4.4], timberColor, true);
    art.box(shift(upper, 0, -.14), [3.35, .28, 4.4], timberColor, true);
    for (const p of [lower, upper]) for (const x of [-1.48, 1.48]) {
      art.beam(shift(p, x, -2.75, -.66), shift(p, x, .92, -.66), .115, limestone, true);
      art.box(shift(p, x, .89, .08), [.14, .16, 3.5], timberColor, true);
    }
    art.box(shift(rail, .72, .57, -.58), [.39, .54, .26], timberColor);
    art.beam(shift(rail, .72, .35, -.54), shift(lower, 1.08, .25, .97), .036, '#897459');
    const entry = walkway('OrleansServiceBankSteps', 'britain', [shift(rail, -.95, .08, -.7), shift(lower, 0, 0, 1.37)], 2.32, timberColor, true);
    const flights = walkway('OrleansSecondServiceLadder', 'britain', [shift(lower, 0, .035, -1.36), shift(upper, 0, .015, 1.22)], 2.2, timberColor, false);
    const back = walkway('OrleansServiceEscapeDeck', 'britain', [shift(upper, .5, 0, -.47), shift(rail, 1.9, .08, -15.1)], 2.25, timberColor, false);
    finish(art, 'britain');
    updates.push(done => {
      entry.art.root.visible = true;
      flights.art.root.visible = flights.collider.enabled = done.has(under.lower);
      back.art.root.visible = back.collider.enabled = done.has(under.upper);
    });
  }

  const rack = bridge && place(shift(bridge, 3.1, 0, 12.4), 9);
  const blue = rack && place(shift(rack, -5.2, 0, 4.1), 9);
  const red = rack && place(shift(rack, 5.4, 0, 4.1), 9);
  const mural = rack && place(shift(rack, .6, 0, -4.15), 9);
  if (rack && blue && red && mural) {
    interact(shields.repair, rack); interact(shields.blue, blue); interact(shields.red, red); interact(shields.mural, mural);
    const art = scenery('OrleansShieldRepairsAndMural');
    for (const p of [rack, blue, red]) table(art, p);
    art.box(shift(mural, 0, 1.17, -.95), [3.2, 2.34, .26], limestone, true);
    function design(at: Point, indigo: boolean, painted = false) {
      const shield = group(art.root, at, indigo ? 'OrleansIndigoShield' : 'OrleansRedStitchedShield');
      const material = indigo ? materials.blue : materials.red;
      const shape = indigo ? new THREE.CylinderGeometry(.29, .29, .055, 16).rotateX(Math.PI / 2) : new THREE.BoxGeometry(.54, .57, .063);
      mesh(shield, shape, painted ? material : materials.wood, [0, 0, 0]);
      if (indigo) for (const x of [-.135, 0, .135])
        mesh(shield, new THREE.SphereGeometry(.037, 9, 7), painted ? materials.metal : material, [x, .077, .033]);
      else for (const slope of [-.78, .78])
        mesh(shield, new THREE.BoxGeometry(.042, .33, .027), painted ? materials.metal : material, [0, .065, .043]).rotation.z = slope;
      return shield;
    }
    const found = [design(shift(rack, -.36, 1.09, -.93), true), design(shift(rack, .36, 1.09, -.93), false)];
    const returned = [design(shift(blue, 0, 1.19, -.93), true), design(shift(red, 0, 1.19, -.93), false)];
    const painted = [design(shift(mural, -.54, 1.32, -.79), true, true), design(shift(mural, .54, 1.32, -.79), false, true)];
    for (const [p, color] of [[blue, '#41527d'], [red, '#a15450']] as const) {
      art.box(shift(p, .66, 1.47, -.98), [.1, 1.25, .1], timberColor, true);
      art.box(shift(p, .48, 1.92, -.93), [.52, .4, .046], color);
    }
    finish(art, 'britain');
    updates.push(done => {
      for (const [i, flag] of [shields.blue, shields.red].entries()) {
        found[i].visible = done.has(JOURNEY.orleansBattery) && !done.has(flag);
        returned[i].visible = painted[i].visible = done.has(flag);
      }
    });
  }

  return {
    get stretcherArrived() { return rescueMotion >= 1; },
    moveWeight(direction: -1 | 1) {
      weight = THREE.MathUtils.clamp(weight + direction, -2, 2);
      return weight === 0;
    },
  };
}
