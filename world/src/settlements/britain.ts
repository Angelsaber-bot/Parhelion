import * as THREE from 'three';
import type { SettlementKit } from './types';
import { SettlementArt } from './valleyBritainArt';

/** A working castle-side craft court, not another row of sealed timber houses. */
export function buildBritainSettlement(): SettlementKit {
  const a = new SettlementArt();
  const limestone = '#c5b79d', pale = '#e2d2ad', timber = '#624936', beam = '#44392d', slate = '#69748b', iron = '#535c69', gold = '#b3925c';
  a.box('craft_court_foundation', [0, -.26, 0], [37, .36, 35], '#a59a86', true);
  a.box('craft_court_gravel', [0, -.015, 8], [34, .05, 16], '#bcac8f', true);
  for (let x = -16; x <= 16; x += 2) for (let z = 8; z < 16; z += 2) {
    if (Math.abs(x) > 3.5) a.box('court_pavers', [x + (z % 4 ? .3 : 0), .025, z], [1.7, .05, 1.7], (x + z) % 3 ? '#b8aa90' : '#c7b99e');
  }
  // Wide forge hall, with a real opening, full working interior and rear chimney.
  a.room('royal_forge', -10, -1, 12, 14, 4.3, limestone, 4.2);
  a.gable('royal_forge', -10, -1, 13.2, 15.4, 4.3, 2.4, '#a95f48', beam);
  const forgeGable = new THREE.Shape(); forgeGable.moveTo(-6, 0); forgeGable.lineTo(6, 0); forgeGable.lineTo(0, 2.25); forgeGable.closePath();
  const gableMat = a.mat(pale); gableMat.side = THREE.DoubleSide;
  a.mesh('forge_front_gable', new THREE.ShapeGeometry(forgeGable), gableMat, [-10, 4.3, 6.02], [1, 1, 1]);
  for (const side of [-1, 1]) a.beam('forge_gable_truss', [-10, 6.55, 6.24], [-10 + side * 4.7, 4.35, 6.24], .15, timber);
  a.beam('forge_gable_kingpost', [-10, 4.3, 6.24], [-10, 6.6, 6.24], .18, timber);
  for (const z of [-7.8, -4.4, -.7, 2.8, 5.8]) a.box('forge_side_stud', [-3.78, 2.15, z], [.19, 4.3, .19], timber);
  for (const y of [.3, 1.2, 4.05]) a.box('forge_side_timber_course', [-3.78, y, -1], [.2, .14, 14], timber);
  for (const z of [-6, -2.4, 1.2, 4.5]) a.beam('forge_side_diagonal', [-3.76, 1.28, z - 1.45], [-3.76, 3.95, z + 1.45], .13, timber);
  for (const x of [-15.8, -12.3, -7.7, -4.2]) {
    a.box('forge_front_timber', [x, 2.2, 6.24], [.23, 4.4, .25], timber);
    a.box('forge_post_foot', [x, .35, 6.28], [.42, .7, .38], '#96866e');
  }
  for (const y of [.35, 1.4, 3.85]) {
    if (y > 3.7) a.box('forge_timber_course', [-10, y, 6.22], [12.2, .16, .22], timber);
    else for (const side of [-1, 1]) a.box('forge_timber_course', [-10 + side * 4.1, y, 6.22], [3.9, .16, .22], timber);
  }
  // Remove visually spanning middle beam from the entrance: course pieces instead of a blocking rail.
  // These trim rails are render-only; the actual clear doorway stays 4.2 m wide and 3.7 m high.
  a.window('forge_window', -14.2, 2.4, 6.28, 1.3, 1.5, beam, '#b9b1a0');
  a.window('forge_window', -5.8, 2.4, 6.28, 1.3, 1.5, beam, '#b9b1a0');
  // Tall squat ashlar chimney, flared cap, fire opening and hood.
  a.box('forge_hearth_base', [-13.3, .45, -5.2], [3.6, .9, 3], '#77766f', true);
  for (const s of [-1, 1]) a.box('forge_fire_cheek', [-13.3 + s * 1.35, 1.4, -5.2], [.55, 1.9, 2.7], '#897d68', true);
  a.box('forge_fire_back', [-13.3, 1.5, -6.45], [3.3, 2.2, .35], '#736a5e', true);
  a.box('forge_fire_coals', [-13.3, .96, -5.35], [2.3, .12, 1.8], '#df7d38', false, 0, .65);
  for (let k = 0; k < 9; k++) a.mesh('forge_coal', new THREE.IcosahedronGeometry(.2, 0), a.mat(k % 3 ? '#6d3f2c' : '#f39f4c', 0, k % 3 ? 0 : .6), [-14.1 + (k % 3) * .8, 1.08, -5.95 + Math.floor(k / 3) * .65], [1, .5, 1]);
  const hood = a.mesh('forge_hood', new THREE.CylinderGeometry(.7, 1.7, 1.5, 4, 1), a.mat('#5e6263', .35), [-13.3, 3.25, -5.2], [1, 1, 1]); hood.rotation.y = Math.PI / 4;
  a.box('forge_chimney', [-13.3, 5.5, -5.2], [1.5, 4.3, 1.6], '#8d8170', true);
  a.box('forge_chimney_crown', [-13.3, 7.7, -5.2], [2, .28, 2.1], limestone);
  for (let y = 4.2; y < 7.5; y += .55) a.box('chimney_mortar', [-13.3, y, -4.38], [1.51, .045, .04], '#5d5a54');
  // Shaped anvil, not a box weapon prop.
  a.cyl('anvil_stump', [-10.2, .45, -.3], .68, .9, timber, true);
  const anvilShape = new THREE.Shape();
  anvilShape.moveTo(-.8, 0); anvilShape.lineTo(.6, 0); anvilShape.lineTo(.4, .22); anvilShape.lineTo(.25, .35);
  anvilShape.lineTo(.25, .55); anvilShape.lineTo(.7, .68); anvilShape.lineTo(1.1, .78); anvilShape.lineTo(.65, .9);
  anvilShape.lineTo(-.8, .9); anvilShape.lineTo(-.8, .65); anvilShape.lineTo(-.35, .55); anvilShape.lineTo(-.35, .25); anvilShape.closePath();
  const anvilGeo = new THREE.ExtrudeGeometry(anvilShape, { depth: .5, bevelEnabled: true, bevelThickness: .035, bevelSize: .035, bevelSegments: 1, steps: 1 });
  a.mesh('forged_anvil', anvilGeo, a.mat(iron, .55), [-10.2, .9, -.55], [1, 1, 1], true);
  a.table('forge_workbench', -6, -4.4, 2.4, 4.3, timber);
  for (let i = 0; i < 4; i++) {
    a.box('bench_ingot', [-6.5 + (i % 2) * .8, 1.05, -5.5 + Math.floor(i / 2) * 1.3], [.55, .18, .4], i % 2 ? '#8e8e83' : '#b39a70', false, .5);
  }
  a.beam('smith_hammer_handle', [-6.7, 1.04, -3.8], [-5.6, 1.04, -3.4], .075, '#8f6a42');
  a.box('smith_hammer_head', [-5.6, 1.07, -3.4], [.26, .3, .55], iron, false, .5);
  a.box('weapon_wall_rack', [-15.65, 1.7, -.8], [.2, .2, 5.1], timber);
  for (let i = 0; i < 5; i++) {
    const z = -2.8 + i;
    a.box('rack_sword_blade', [-15.42, 1.95, z], [.08, 1.5, .18], '#b2bbc0', false, .6);
    a.box('rack_sword_guard', [-15.42, 1.15, z], [.12, .1, .5], gold, false, .5);
    a.box('rack_sword_grip', [-15.42, .94, z], [.1, .32, .1], beam);
  }
  a.barrel('quench_barrel', -13.5, 2.8, '#7b6046');
  a.cyl('quench_water', [-13.5, .99, 2.8], .35, .035, '#758e97');
  // Forge sign: suspended horseshoe-like iron ring rather than unreadable texture lettering.
  a.beam('forge_sign_arm', [-4.3, 3.8, 6.4], [-4.3, 3.8, 7.6], .14, beam);
  a.beam('forge_sign_chain', [-4.3, 3.8, 7.5], [-4.3, 3.2, 7.5], .045, iron);
  const shoe = a.mesh('forge_horseshoe_sign', new THREE.TorusGeometry(.4, .075, 6, 16, Math.PI * 1.5), a.mat(gold, .45), [-4.3, 2.9, 7.5], [1, 1, 1]); shoe.rotation.z = -.25 * Math.PI;
  // Stable: open arcade, a walkable broad aisle and individual timber stalls.
  a.box('stable_floor', [10, -.1, -1], [11, .2, 16], '#9c8464', true);
  a.box('stable_back_wall', [10, 1.7, -9], [11, 3.4, .3], '#bdad89', true);
  a.box('stable_side_wall', [15.5, 1.5, -1], [.3, 3, 16], timber, true);
  a.gable('stable', 10, -1, 12.4, 17.3, 3.5, 2.1, slate, beam);
  for (let y = .3; y < 3; y += .38) a.box('stable_weatherboard_joint', [15.67, y, -1], [.035, .035, 15.7], '#947351');
  for (const z of [-6.5, -.8, 4.7]) {
    a.box('stable_outer_buttress', [15.8, 1.75, z], [.28, 3.5, .3], beam);
    a.beam('stable_outer_brace', [15.9, .6, z - 1.7], [15.9, 2.7, z + 1.7], .15, '#aa8657');
  }

  for (const z of [-8.7, -3.5, 1.7, 6.7]) for (const x of [4.5, 15.5]) {
    a.box('stable_arcade_post', [x, 1.75, z], [.26, 3.5, .26], timber, true);
    a.beam('stable_knee_brace', [x, 2.65, z], [x, 3.5, z + (z < 0 ? .8 : -.8)], .15, '#8b6a46');
  }
  a.box('stable_front_beam', [10, 3.42, 7], [11.3, .28, .32], timber);
  // Stalls are in the east half; west aisle remains 4 m wide and open end-to-end.
  for (const z of [-4, .8]) {
    a.box('stable_stall_partition', [12.8, .8, z], [5.2, 1.6, .18], timber, true);
    for (let x = 10.3; x < 15.6; x += .5) a.box('stable_partition_slat', [x, 1.28, z + .08], [.11, 1.1, .08], '#846549');
  }
  for (const z of [-6.5, -1.6, 3.4]) {
    a.box('stable_hay_bed', [13, .13, z], [4.1, .26, 3.2], '#c8ad69');
    for (let i = 0; i < 9; i++) a.beam('straw_strands', [11.2 + (i % 3) * 1.15, .28, z - 1 + Math.floor(i / 3) * .8], [12 + (i % 3) * 1.15, .29, z - .65 + Math.floor(i / 3) * .8], .025, '#dfc986');
    a.box('stable_manger', [14.9, .75, z], [.8, .55, 1.8], timber, true);
    a.box('stable_fodder', [14.9, 1.04, z], [.7, .06, 1.6], '#cbb572');
  }
  for (const z of [-6, -1]) a.barrel('stable_feed_barrel', 5.7, z, '#9c7b4c');
  a.box('stable_water_trough', [12.8, .45, 10], [4, .9, 1.2], '#8a8170', true);
  a.box('stable_water', [12.8, .86, 10], [3.65, .03, .85], '#829b9b');
  // Modest roofless abbey remnant beyond the court. The broad nave remains physically enterable.
  a.box('abbey_nave_floor', [0, -.09, -12.5], [7.6, .18, 8], '#bdb7a7', true);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const z = -15.8 + k * 1.55, h = [2.8, 2, 1.5, 2.2, 1.1][k] + (s > 0 ? .25 : 0);
      a.box('abbey_broken_side', [s * 3.8, h / 2, z], [.55, h, 1.45], k % 2 ? limestone : '#b8b09c', true);
      a.box('abbey_broken_coping', [s * 3.8, h + .1, z], [.7, .2, 1.4], pale);
      for (let y = .55; y < h; y += .6) a.box('abbey_mortar_joint', [s * 3.49, y, z], [.04, .035, 1.42], '#9b9788');
    }
    a.box('abbey_chancel_pier', [s * 2.55, 2, -16.1], [1.2, 4, .7], limestone, true);
    a.box('abbey_capital', [s * 2.55, 3.8, -16.1], [1.5, .28, .9], pale);
    a.beam('abbey_lancet', [s * 2.2, 3.9, -16.1], [0, 5.5, -16.1], .45, limestone, true);
    a.box('abbey_pew', [s * 2.3, .48, -11.9], [.8, .96, 2.5], '#75634d', true);
  }
  a.box('abbey_altar', [0, .62, -14.9], [2.6, 1.24, 1], pale, true);
  a.box('abbey_altar_cloth', [0, 1.26, -14.9], [2.2, .03, 1.1], '#7d8fa5');
  a.box('abbey_cross_vertical', [0, 6.1, -16.1], [.2, 1.3, .2], gold);
  a.box('abbey_cross_horizontal', [0, 6.25, -16.1], [.85, .18, .2], gold);
  for (const s of [-1, 1]) {
    a.cyl('court_lantern_post', [s * 3.4, 1.5, 13], .11, 3, beam, true);
    a.box('court_lantern', [s * 3.4, 3.13, 13], [.42, .55, .42], '#efc67b', false, 0, .45);
    a.box('court_lantern_cap', [s * 3.4, 3.45, 13], [.62, .12, .62], iron);
  }
  const group = a.finish('SET_Britain_CraftCourt');
  const light = new THREE.PointLight('#ffc17b', 24, 13, 2); light.name = 'Forge_WarmFill';
  light.position.set(-13.1, 2.25, -4.2); light.castShadow = false; group.add(light);
  return {
    id: 'britain', name: ['王城匠作庭院', 'Royal Craft Court'], group,
    footprint: [38, 36], entry: [0, 17.5],
    npcs: [
      { id: 'britain_smith', role: ['王城铁匠', 'Royal Smith'], position: [-7.5, .02, 2.8], yaw: .4,
        lines: [['铁器也会疲惫。这里打磨刀锋、修补铠甲，但不会改变你现在的装备。', 'Even iron grows tired. We tend blades and armor here; your current equipment will not be changed.'], ['炉边的水桶用来淬火，墙上的旧剑则属于再也没有归来的骑士。', 'The water barrel is for quenching. The old swords on the wall belonged to knights who never returned.']] },
      { id: 'britain_stable_keeper', role: ['马厩看守', 'Stable Keeper'], position: [7.2, .02, 8.8], yaw: -.4,
        lines: [['马厩的西侧留着宽走道。草料和清水已备好，长途赶路后应该让坐骑休息。', 'The west aisle is kept clear. Fodder and fresh water are ready; mounts deserve rest after a long ride.']] },
      { id: 'britain_abbey_keeper', role: ['修院守望者', 'Abbey Keeper'], position: [0, .02, -9.1], yaw: 0,
        lines: [['修院的屋顶早已坍塌，晚钟却仍有人记得。请从中间的通道慢慢走进去。', 'The abbey roof fell long ago, but someone still remembers its evening bell. The central aisle is open.']] },
    ],
  };
}
