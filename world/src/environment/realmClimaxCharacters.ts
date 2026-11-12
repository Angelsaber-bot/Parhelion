import * as THREE from 'three';
import type { RealmClimaxId } from '../story/realmClimaxes';
import { SiteArt } from '../story/campaignSites';

type Point = [number, number, number];
type Motion = { phase: number; charging: boolean; exposed: boolean; dt: number };
const cube = new THREE.BoxGeometry(1, 1, 1);
const ball = new THREE.SphereGeometry(1, 18, 12);
const cone = new THREE.ConeGeometry(.5, 1, 8);

class CharacterArt {
  private readonly pieces: SiteArt[] = [];
  group(parent: THREE.Object3D, name: string, p: Point = [0, 0, 0]) {
    const part = new SiteArt();
    part.root.position.fromArray(p);
    parent.add(part.root);
    this.pieces.push(part);
    part.root.name = name;
    return part;
  }
  box(part: SiteArt, p: Point, size: Point, tint: string, angles: Point = [0, 0, 0], metal = false) {
    part.add(cube, tint, p, size, false, metal ? 'metal' : 'body', angles);
  }
  ball(part: SiteArt, p: Point, size: Point, tint: string, metal = false) {
    part.add(ball, tint, p, size, false, metal ? 'metal' : 'body');
  }
  cone(part: SiteArt, p: Point, size: Point, tint: string, angles: Point = [0, 0, 0], metal = false) {
    part.add(cone, tint, p, size, false, metal ? 'metal' : 'body', angles);
  }
  lathe(part: SiteArt, p: Point, points: readonly (readonly [number, number])[], tint: string, scale: Point = [1, 1, 1], metal = false) {
    const g = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 22);
    part.add(g, tint, p, scale, false, metal ? 'metal' : 'body');
    g.dispose();
  }
  seal() {
    for (const part of this.pieces) {
      const name = part.root.name;
      part.finish('alpha');
      part.root.name = name;
      for (const mesh of part.layers.values()) mesh.castShadow = true;
    }
  }
  dispose() {
    for (const part of this.pieces) for (const material of Object.values(part.materials)) material.dispose();
  }
}

export function createRealmClimaxCharacter(id: RealmClimaxId, root: THREE.Group) {
  const art = new CharacterArt();
  const step = id === 'egypt' ? tideEater(root, art) : id === 'orleans' ? bridgefortVale(root, art) : sealingGeneral(root, art);
  art.seal();
  let t = 0, windup = 0, release = 0, previous = false;
  return {
    update({ phase, charging, exposed, dt }: Motion) {
      if (phase < 0) { t = windup = release = 0; previous = false; }
      else {
        t += dt;
        windup = THREE.MathUtils.damp(windup, charging ? 1 : 0, charging ? 3.5 : 10, dt);
        if (!charging && previous) release = 1;
        else release = Math.max(0, release - dt * 2.8);
        previous = charging;
      }
      step(t, windup, release, exposed, phase);
    },
    dispose: () => art.dispose(),
  };
}

function tideEater(root: THREE.Group, art: CharacterArt) {
  const skin = '#526e60', dark = '#283f39', flank = '#8d845c', amber = '#dbc06a', mineral = '#578b89';
  const trunk = art.group(root, 'TideEaterRibCage', [0, 1.02, -.14]);
  art.ball(trunk, [0, .04, -.23], [1.61, .87, 2.48], skin);
  art.ball(trunk, [0, -.21, -.19], [1.4, .53, 2.05], flank);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const z = .95 - i * .49, w = i === 0 || i === 6 ? 1.12 : 1.36;
      art.ball(trunk, [side * w, .16, z], [.22, .18, .3], i % 2 ? mineral : skin);
      art.cone(trunk, [side * .61, .75, z], [.62, .75 - i * .035, .58], i % 2 ? dark : mineral, [0, .22 * side, side * -.22]);
    }
    for (const z of [-1.49, 1.08]) {
      const leg = art.group(root, 'TideEaterRiverClaw', [side * 1.15, .49, z]);
      art.ball(leg, [side * .24, .08, -.08], [.61, .34, .47], skin);
      art.ball(leg, [side * .58, -.28, .32], [.42, .18, .54], dark);
      for (let i = 0; i < 4; i++) art.cone(leg, [side * .58 + .18 * (i - 1.5), -.3, .7], [.12, .35, .14], flank, [Math.PI / 2, 0, 0]);
    }
  }
  const head = art.group(trunk.root, 'TideEaterCrownAndSnout', [0, .19, 1.62]);
  art.ball(head, [0, .16, .34], [.99, .56, .9], skin);
  art.ball(head, [0, -.015, 1.07], [.79, .29, 1.08], dark);
  art.ball(head, [0, .147, 1.37], [.63, .22, .77], skin);
  for (const side of [-1, 1]) {
    art.ball(head, [side * .69, .43, .66], [.31, .225, .47], flank);
    art.ball(head, [side * .855, .436, .786], [.104, .065, .115], amber, true);
    art.ball(head, [side * .929, .44, .82], [.04, .05, .035], dark);
    art.ball(head, [side * .27, .274, 1.98], [.12, .053, .113], dark);
    for (let i = 0; i < 7; i++) art.cone(head, [side * (.59 - i * .044), -.16, .7 + i * .181],
      [.106, .28 - i * .016, .116], '#d9d0a5', [Math.PI, 0, side * .08]);
  }
  const jaw = art.group(head.root, 'TideEaterJaw', [0, -.14, .32]);
  art.ball(jaw, [0, -.18, .86], [.744, .2, .984], flank);
  art.ball(jaw, [0, -.075, .89], [.64, .055, .85], '#673f3a');
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++)
    art.cone(jaw, [side * (.55 - i * .042), -.065, .45 + i * .2], [.1, .22 - i * .014, .11], '#d9d0a5');

  const tail = art.group(trunk.root, 'TideEaterTailBase', [0, -.28, -2]);
  art.ball(tail, [0, -.04, -.6], [.63, .43, 1.19], skin);
  const tailTip = art.group(tail.root, 'TideEaterTailFin', [0, -.07, -1.34]);
  art.ball(tailTip, [0, .02, -.73], [.32, .29, 1.22], dark);
  for (let i = 0; i < 5; i++) art.cone(tailTip, [0, .26, -.22 - i * .27], [.34, .47 - i * .055, .4], mineral);
  const plates = art.group(trunk.root, 'TideEaterWaterArmor', [0, 0, 0]);
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    art.box(plates, [side * 1.35, .64, 1.05 - .51 * i], [.11, .54, .425], '#5babad', [0, side * .32, side * -.54], true);
  }
  return (time: number, charge: number, burst: number, exposed: boolean, phase: number) => {
    trunk.root.position.y = 1.02 + Math.sin(time * 2.1) * .035 + charge * .2;
    head.root.rotation.x = -.17 * charge + .14 * burst;
    jaw.root.rotation.x = .12 + .61 * charge + .28 * burst;
    tail.root.rotation.y = Math.sin(time * 2.9) * (.12 + charge * .26);
    tailTip.root.rotation.y = Math.sin(time * 3.1 + .82) * .28;
    plates.root.visible = !exposed && phase >= 0;
  };
}

function bridgefortVale(root: THREE.Group, art: CharacterArt) {
  const iron = '#66727a', bright = '#aeb9bc', dark = '#313940', red = '#7c343a', cloth = '#a95750', leather = '#543d34';
  const legs = art.group(root, 'ValeFieldBoots');
  for (const side of [-1, 1]) {
    art.ball(legs, [side * .22, .08, .13], [.157, .13, .288], leather);
    art.ball(legs, [side * .207, .34, 0], [.13, .34, .132], dark, true);
    art.ball(legs, [side * .21, .58, .074], [.165, .16, .147], iron, true);
    art.ball(legs, [side * .19, .76, 0], [.17, .28, .155], red);
  }
  const torso = art.group(root, 'ValeBascinetHarness', [0, 1.07, 0]);
  art.ball(torso, [0, .26, .02], [.49, .45, .296], iron, true);
  art.ball(torso, [0, .36, .103], [.387, .274, .24], bright, true);
  for (let i = 0; i < 4; i++) art.box(torso, [0, -.14 + i * .12, .098], [.66 + i * .052, .105, .46], i % 2 ? iron : dark, [0, 0, 0], true);
  art.box(torso, [0, .031, .331], [.67, .087, .064], leather);
  art.box(torso, [0, .031, .371], [.126, .099, .022], '#be9360', [0, 0, 0], true);
  for (const side of [-1, 1]) {
    art.box(torso, [side * .2, .25, .347], [.08, .43, .037], red, [0, 0, side * -.43]);
    art.box(torso, [side * .334, -.275, -.023], [.155, .595, .44], cloth, [0, 0, side * .16]);
  }
  const helmet = art.group(torso.root, 'ValeArticulatedVisor', [0, .81, .055]);
  art.lathe(helmet, [0, -.1, 0], [[.015, -.19], [.226, -.164], [.252, -.056], [.243, .137], [.19, .266], [.087, .369], [.003, .385]], iron, [1, 1, .93], true);
  art.ball(helmet, [0, -.025, .21], [.196, .15, .103], dark, true);
  art.ball(helmet, [0, -.079, .28], [.174, .095, .104], bright, true);
  art.box(helmet, [0, .02, .31], [.34, .042, .022], '#1f2629');
  for (let i = -2; i <= 2; i++) art.box(helmet, [.043 * i, -.089, .384 - Math.abs(i) * .007], [.02, .019, .016], dark);
  for (const side of [-1, 1]) art.ball(helmet, [side * .209, -.038, .113], [.045, .047, .045], '#bb9764', true);

  const hands = [-1, 1].map(side => {
    const hand = art.group(torso.root, side < 0 ? 'ValeShieldArm' : 'ValeCrossbowArm', [side * .48, .47, 0]);
    for (let i = 0; i < 3; i++) art.ball(hand, [side * .044, -.07 - i * .094, 0], [.19 - .025 * i, .14, .19 - .024 * i], i % 2 ? bright : iron, true);
    art.ball(hand, [side * .104, -.39, .065], [.13, .241, .124], red);
    art.ball(hand, [side * .14, -.56, .11], [.106, .154, .112], iron, true);
    art.ball(hand, [side * .14, -.655, .142], [.097, .078, .082], leather);
    return hand.root;
  });
  const shield = art.group(root, 'ValeLilyPavise', [-1.26, 1.12, -.12]);
  const outline = new THREE.Shape().moveTo(-.48, .69).lineTo(.48, .69).lineTo(.475, -.35).quadraticCurveTo(.32, -.74, 0, -.98)
    .quadraticCurveTo(-.32, -.74, -.475, -.35).closePath();
  const plate = new THREE.ExtrudeGeometry(outline, { depth: .13, bevelEnabled: true, bevelSegments: 2, bevelSize: .045, bevelThickness: .035 });
  shield.add(plate, '#af8758', [0, 0, 0], [1.05, 1.05, 1], false, 'metal');
  shield.add(plate, red, [0, .015, .075], [.85, .89, .55]); plate.dispose();
  art.box(shield, [0, .032, .167], [.083, .71, .025], '#dfc79a');
  for (const side of [-1, 1]) art.ball(shield, [side * .13, .03, .171], [.11, .194, .017], '#dfc79a');
  const bow = art.group(hands[1], 'ValeWindlassCrossbow', [.14, -.59, .39]);
  art.box(bow, [0, 0, .22], [.13, .12, .68], leather);
  for (const side of [-1, 1]) {
    art.box(bow, [side * .24, 0, .44], [.49, .052, .076], bright, [0, side * .28, 0], true);
    bow.beam([0, .017, .12], [side * .47, .017, .37], .017, '#d5c7a3');
  }
  return (time: number, charge: number, burst: number, exposed: boolean, phase: number) => {
    torso.root.rotation.x = .045 * Math.sin(time * 2) + .22 * charge - burst * .14;
    torso.root.position.y = 1.07 - .12 * charge + .06 * burst;
    helmet.root.rotation.y = Math.sin(time * 1.45) * .13 * (1 - charge);
    hands[0].rotation.x = -.12 - charge * .72;
    hands[1].rotation.x = -.24 - charge * 1.15 + .2 * burst;
    shield.root.rotation.y = (phase === 1 ? -.36 : .21) + (exposed ? .22 : -.16 * charge);
    shield.root.rotation.z = .075 - .13 * charge;
  };
}

function sealingGeneral(root: THREE.Group, art: CharacterArt) {
  const clay = '#9b735c', dark = '#5b483d', lacquer = '#433a30', bronze = '#958359', jade = '#637f72', pale = '#c2a073';
  const legs = art.group(root, 'GeneralRidingSkirt');
  for (const side of [-1, 1]) {
    art.ball(legs, [side * .245, .08, .15], [.191, .123, .302], dark);
    art.ball(legs, [side * .223, .32, 0], [.149, .292, .13], lacquer);
    art.box(legs, [side * .28, .48, .135], [.41, .76, .2], clay, [0, 0, side * .13]);
    for (let i = 0; i < 4; i++) art.box(legs, [side * .283, .4 + .115 * i, .26], [.44, .081, .055], i % 2 ? jade : bronze, [0, 0, side * .13], true);
  }
  const torso = art.group(root, 'GeneralBronzeLamellar', [0, 1.04, 0]);
  art.ball(torso, [0, .22, -.02], [.48, .49, .305], dark);
  for (let r = 0; r < 6; r++) for (let c = -3; c <= 3; c++) {
    const x = c * .119, y = r * .113 - .11;
    art.box(torso, [x, y, .345 - Math.abs(c) * .018], [.107, .13, .06], r % 3 ? jade : bronze, [0, -c * .095, c * .022], true);
    art.box(torso, [x, y + .022, .382 - Math.abs(c) * .018], [.022, .07, .009], '#b59a67');
  }
  for (const side of [-1, 1]) {
    art.box(torso, [side * .196, .53, .355], [.09, .34, .04], pale, [0, 0, side * .55]);
    art.box(torso, [side * .311, .06, -.27], [.25, .88, .17], lacquer, [0, 0, side * .14]);
  }
  const head = art.group(torso.root, 'GeneralClayPortrait', [0, .88, .033]);
  art.lathe(head, [0, 0, 0], [[.012, -.29], [.105, -.263], [.181, -.201], [.224, -.087], [.228, .13], [.181, .234], [.09, .277], [.01, .28]], clay, [1, 1, .88]);
  art.ball(head, [0, .007, .199], [.047, .114, .08], pale);
  art.ball(head, [0, -.195, .157], [.075, .095, .077], dark);
  for (const side of [-1, 1]) {
    art.ball(head, [side * .188, -.07, .08], [.061, .091, .059], clay);
    art.box(head, [side * .095, .042, .198], [.121, .036, .033], lacquer, [0, 0, side * .11]);
    art.box(head, [side * .085, .087, .2], [.137, .03, .026], dark, [0, 0, side * -.16]);
    art.ball(head, [side * .055, -.126, .211], [.096, .024, .031], dark);
  }
  art.ball(head, [0, .155, -.038], [.221, .163, .19], dark);
  art.box(head, [0, .178, .165], [.457, .092, .074], bronze, [0, 0, 0], true);
  art.ball(head, [.049, .309, -.086], [.105, .142, .109], lacquer);
  art.box(head, [.047, .347, -.054], [.132, .055, .174], '#a2664f');

  const arms = [-1, 1].map(side => {
    const arm = art.group(torso.root, side === 1 ? 'GeneralHalberdArm' : 'GeneralCommandHand', [side * .48, .446, 0]);
    art.ball(arm, [side * .06, .02, 0], [.194, .178, .185], bronze, true);
    for (let i = 0; i < 3; i++) art.box(arm, [side * .095, -.11 - .104 * i, .09], [.25, .087, .25], i % 2 ? lacquer : jade, [0, 0, side * .18], true);
    art.ball(arm, [side * .14, -.46, .04], [.125, .199, .139], clay);
    art.ball(arm, [side * .14, -.624, .112], [.105, .105, .101], clay);
    return arm.root;
  });
  const halberd = art.group(arms[1], 'GeneralBronzeHalberd', [.146, -.62, .13]);
  art.box(halberd, [0, .2, 0], [.083, 2.79, .082], dark, [0, 0, -.11]);
  art.cone(halberd, [.15, 1.77, 0], [.28, .52, .14], jade, [0, 0, -.11], true);
  const dagger = new THREE.Shape().moveTo(.13, 1.24).lineTo(.41, 1.31).lineTo(.75, 1.6).quadraticCurveTo(.47, 1.64, .24, 1.43).closePath();
  const blade = new THREE.ExtrudeGeometry(dagger, { depth: .046, bevelEnabled: true, bevelSize: .016, bevelThickness: .013, bevelSegments: 1 });
  halberd.add(blade, bronze, [0, 0, 0], [1, 1, 1], false, 'metal'); blade.dispose();
  const tally = art.group(arms[0], 'GeneralTigerTally', [-.147, -.635, .179]);
  art.box(tally, [0, 0, .05], [.23, .13, .15], bronze, [0, .17, 0], true);
  art.ball(tally, [-.102, .042, .081], [.068, .072, .066], jade, true);
  return (time: number, charge: number, burst: number, exposed: boolean, phase: number) => {
    torso.root.rotation.y = .04 * Math.sin(time * 1.8) - .16 * charge;
    head.root.rotation.x = (phase === 1 ? .18 : 0) + .07 * Math.sin(time * 1.6);
    arms[0].rotation.x = -.13 - charge * 1.18 + (exposed ? .13 : 0);
    arms[1].rotation.z = -.06 - .51 * charge + .25 * burst;
    halberd.root.rotation.x = -.08 - .49 * burst;
  };
}

export function createHelionCharacter(parent: THREE.Object3D, anchor: Point) {
  const root = new THREE.Group(); root.name = 'HelionObservationSuit'; root.visible = false;
  root.position.fromArray(anchor); root.position.y -= 2.3;
  parent.add(root);
  const art = new CharacterArt();
  const canvas = '#55626c', steel = '#536578', dark = '#34414f', pale = '#a3a29b', brass = '#b39a68', faceColor = '#a97157';
  const legs = art.group(root, 'HelionRepairGreaves');
  for (const side of [-1, 1]) {
    art.ball(legs, [side * .25, .1, .14], [.22, .138, .32], dark);
    art.ball(legs, [side * .244, .43, -.03], [.17, .41, .175], canvas);
    art.box(legs, [side * .24, .42, .147], [.26, .54, .103], side < 0 ? pale : steel, [.1, 0, side * .045], true);
    art.ball(legs, [side * .229, .744, .104], [.199, .19, .174], steel, true);
    art.ball(legs, [side * .235, .96, -.047], [.208, .383, .194], canvas);
  }
  const body = art.group(root, 'HelionRescueCuirass', [0, 1.35, 0]);
  art.ball(body, [0, .22, 0], [.561, .605, .385], canvas);
  art.ball(body, [0, .35, .115], [.497, .45, .32], steel, true);
  art.ball(body, [0, .41, -.284], [.383, .43, .175], dark, true);
  art.box(body, [-.245, .115, .367], [.17, .206, .034], pale, [0, -.26, .05], true);
  // Number 01 is cut into the patched breastplate.
  for (const [x, y, w, h] of [[-.254, .185, .064, .011], [-.254, .071, .064, .011], [-.282, .129, .009, .122], [-.226, .129, .009, .122], [-.166, .129, .011, .122]])
    art.box(body, [x, y, .398], [w, h, .012], dark);
  for (const side of [-1, 1]) {
    art.box(body, [side * .304, .47, .383], [.072, .44, .045], brass, [0, side * .14, side * .42], true);
    art.box(body, [side * .378, -.141, .061], [.175, .453, .31], pale, [0, 0, side * .16], true);
  }
  for (const y of [.03, -.1, -.22]) art.box(body, [0, y, .133], [.766, .073, .538], dark, [0, 0, 0], true);

  const head = art.group(body.root, 'HelionUnmaskedFace', [0, .96, .06]);
  art.lathe(head, [0, .005, 0], [[.01, -.238], [.126, -.215], [.218, -.148], [.245, -.034], [.233, .197], [.177, .276], [.08, .319], [.01, .32]], faceColor, [1, 1, .87]);
  art.ball(head, [0, .223, -.04], [.241, .138, .208], '#514c49');
  art.ball(head, [0, -.006, .21], [.047, .112, .07], '#b78064');
  art.box(head, [0, -.126, .193], [.093, .018, .024], '#704d42');
  for (const side of [-1, 1]) {
    art.ball(head, [side * .21, .015, .046], [.063, .15, .082], pale, true);
    art.box(head, [side * .097, .058, .196], [.118, .04, .04], '#392f30', [0, 0, side * .12]);
    art.box(head, [side * .092, .06, .218], [.069, .015, .014], '#cdb7a4');
    art.box(head, [side * .079, .06, .224], [.021, .019, .011], '#3e575a');
    art.box(head, [side * .096, .113, .205], [.133, .03, .031], '#57453e', [0, 0, side * -.105]);
  }
  art.box(head, [.144, -.027, .189], [.019, .133, .015], '#c1967b', [0, 0, -.37]);
  art.box(head, [-.039, .227, .153], [.171, .054, .033], '#77716d', [0, 0, .28]);

  const left = art.group(body.root, 'HelionRescueArm', [-.5, .548, -.02]);
  art.ball(left, [-.08, .01, 0], [.239, .205, .22], pale, true);
  art.ball(left, [-.102, -.323, .032], [.15, .384, .153], canvas);
  art.ball(left, [-.133, -.63, .081], [.115, .209, .13], dark, true);
  art.ball(left, [-.132, -.8, .115], [.115, .113, .091], faceColor);
  const writer = art.group(body.root, 'HelionExecutionArm', [.52, .58, -.034]);
  art.ball(writer, [.1, .04, -.01], [.28, .239, .25], steel, true);
  for (let i = 0; i < 3; i++) art.box(writer, [.139, -.17 - i * .161, .026], [.291, .143, .24], i % 2 ? pale : steel, [0, 0, -.135], true);
  art.box(writer, [.182, -.61, .225], [.215, .204, .64], dark, [0, 0, -.11], true);
  art.box(writer, [.18, -.605, .515], [.194, .151, .57], pale, [0, 0, -.08], true);
  art.box(writer, [.24, -.576, .821], [.07, .116, .118], brass, [0, 0, 0], true);
  const staff = art.group(left.root, 'HelionRangeStaff', [-.131, -.783, .162]);
  art.box(staff, [0, -.018, -.005], [.076, 1.43, .067], dark, [0, 0, -.11], true);
  for (let i = 0; i < 8; i++) art.box(staff, [.045, .195 + i * .075, .031], [.073, .023, .015], i % 2 ? brass : pale);
  art.box(staff, [.07, .845, .009], [.123, .24, .115], brass, [0, 0, -.11], true);

  const arc = art.group(body.root, 'HelionBrokenObservationArc', [.15, .651, -.427]);
  for (let i = 0; i < 18; i++) {
    const angle = -.98 + i * .252;
    const x = Math.cos(angle), y = Math.sin(angle);
    art.box(arc, [x * 1.05, y * 1.05, -.023], [.18, .273, .13], i % 3 ? pale : brass, [0, 0, angle], true);
    if (i % 4 === 0) art.box(arc, [x * 1.09, y * 1.09, .058], [.09, .127, .03], '#5d7d76', [0, 0, angle]);
  }
  const lensMaterial = new THREE.MeshStandardMaterial({ color: '#e7bb7a', emissive: '#d07e40', emissiveIntensity: .31, metalness: .32 });
  const lens = new THREE.Mesh(new THREE.IcosahedronGeometry(.18, 1), lensMaterial);
  lens.name = 'HelionChestLens'; lens.position.set(.045, .351, .416); body.root.add(lens);
  body.ring([.045, .351, .43], .208, .044, brass, 'metal');
  art.seal();

  return {
    root,
    update(seconds: number, phase: number, active: boolean, locked: boolean, vulnerable: boolean, yaw: number, settled: boolean) {
      root.visible = active || settled;
      root.rotation.y = yaw;
      const breath = Math.sin(seconds * 2.1) * .021;
      body.root.position.y = 1.35 + breath - (settled ? .42 : 0);
      body.root.rotation.x = settled ? .31 : locked ? -.11 : vulnerable ? .12 : breath;
      head.root.rotation.x = settled ? .27 : locked ? -.14 : phase === 2 ? .096 : 0;
      head.root.rotation.y = Math.sin(seconds * .8) * .07;
      writer.root.rotation.x = settled ? .1 : locked ? -1.19 : vulnerable ? -.16 : -.35;
      writer.root.rotation.z = phase === 1 && !settled ? -.52 : -.14;
      left.root.rotation.x = settled ? -.27 : locked && phase === 0 ? -.84 : -.29;
      left.root.rotation.z = .14;
      staff.root.rotation.z = phase === 2 ? -.29 : -.13;
      arc.root.scale.setScalar(phase === 1 && active ? 1.58 : phase === 2 || settled ? .83 : 1);
      arc.root.rotation.z = phase === 2 || settled ? -.42 : locked ? -.08 + Math.sin(seconds * .6) * .15 : .1;
      lensMaterial.emissiveIntensity = settled ? .06 : vulnerable ? 1.62 : .23;
      lens.visible = !settled && phase !== 1;
    },
    dispose() { art.dispose(); lensMaterial.dispose(); },
  };
}
