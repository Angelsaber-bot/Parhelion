import * as THREE from 'three';
import type { SettlementKit } from './types';
import { SettlementArt } from './valleyBritainArt';

/** A quiet U-shaped residence annex: shared dining, two sleeping wings and a garden court. */
export function buildAlphaSettlement(): SettlementKit {
  const a = new SettlementArt();
  const ivory = '#e9e6d8', blue = '#344c69', bronze = '#b89c67', dark = '#314353', glass = '#87c7d4', wood = '#8d6951';
  a.box('residence_court_foundation', [0, -.24, 0], [34, .32, 29], '#adafba', true);
  a.box('residence_court_paving', [0, -.025, 5.6], [27, .07, 16], '#c9c9be', true);
  for (const side of [-1, 1]) {
    a.box('garden_foundation_border', [side * 16.4, .08, 0], [.36, .16, 28], '#d6d7c9');
    a.box('garden_front_border', [side * 9.9, .08, 14], [13, .16, .36], '#d6d7c9');
    a.box('garden_border_inlay', [side * 16.4, .17, 0], [.055, .025, 27.6], bronze);
    a.box('garden_gate_plinth', [side * 3.5, .42, 13.9], [.65, .84, .65], ivory, true);
    a.box('garden_gate_glow', [side * 3.5, .9, 13.9], [.48, .14, .48], '#d7e9d3', false, 0, .35);
  }
  // Fine joints and a deliberately clear central approach, not a decorative obstacle course.
  for (let x = -12; x <= 12; x += 3) a.box('paving_joint', [x, .018, 6], [.025, .012, 15], '#a1a7a5');
  for (let z = -1; z < 14; z += 3) a.box('paving_joint', [0, .018, z], [27, .012, .025], '#a1a7a5');
  a.room('residence', 0, -7, 28, 12, 4.7, ivory, 4.2);
  a.gable('residence', 0, -7, 30, 14, 4.7, 2.15, blue, bronze);
  // Copper-and-glass roof lantern repeats the observatory's celestial language at a domestic scale.
  a.cyl('roof_lantern_pedestal', [0, 6.98, -7], 1.5, .28, bronze, false, .35);
  a.cyl('roof_lantern_glass', [0, 7.56, -7], 1.22, .9, glass, false, .08);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    a.box('roof_lantern_rib', [Math.cos(angle) * 1.24, 7.56, -7 + Math.sin(angle) * 1.24], [.09, 1.05, .09], bronze);
  }
  a.cyl('roof_lantern_cap_ring', [0, 8.05, -7], 1.42, .15, bronze, false, .35);
  a.mesh('roof_lantern_copper_dome', new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), a.mat(blue, .25), [0, 8.1, -7], [1.55, .8, 1.55]);
  a.cyl('roof_lantern_finial', [0, 9.03, -7], .07, .5, bronze, false, .45);
  // Gable infill is transparent to neither shooting nor movement, while the doorway stays 4.2 m clear.
  for (const z of [-13.02, -.98]) {
    const shape = new THREE.Shape(); shape.moveTo(-14, 0); shape.lineTo(14, 0); shape.lineTo(0, 2); shape.closePath();
    const m = a.mesh('residence_gable_infill', new THREE.ShapeGeometry(shape), a.mat(ivory), [0, 4.7, z], [1, 1, 1]);
    m.material = a.mat(ivory); (m.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  }
  for (const x of [-13.8, -8, -2.25, 2.25, 8, 13.8]) {
    a.box('residence_facade_rib', [x, 2.35, -.76], [.18, 4.7, .2], bronze);
    a.box('residence_base_plinth', [x, .3, -.73], [.32, .6, .3], dark);
  }
  a.box('residence_door_crown', [0, 4.05, -.7], [5.3, .32, .32], dark);
  a.box('residence_door_inlay', [0, 4.05, -.5], [3.6, .075, .08], '#a4e8e6', false, 0, .5);
  for (const x of [-11, -5.5, 5.5, 11]) a.window('residence_window', x, 2.5, -.76, 2.4, 1.9, dark, glass);
  // Side-wing windows, stone skirting and slender downpipes keep every approach authored.
  for (const side of [-1, 1]) {
    a.box('side_stone_plinth', [side * 14.18, .27, -7], [.13, .54, 12.05], '#b4b8b5');
    a.box('side_roof_cornice', [side * 14.2, 4.4, -7], [.2, .22, 12.1], bronze);
    a.cyl('bronze_downpipe', [side * 14.3, 2.05, -1.3], .07, 4.1, bronze, false, .3);
    for (const z of [-10.5, -6.5, -3]) {
      a.box('sleepwing_side_glass', [side * 14.2, 2.35, z], [.08, 1.65, 2.1], glass, false, .05, .13);
      for (const d of [-1, 1]) {
        a.box('sleepwing_side_jamb', [side * 14.25, 2.35, z + d * 1.1], [.16, 1.85, .1], dark);
        a.box('sleepwing_side_rail', [side * 14.25, 2.35 + d * .85, z], [.16, .1, 2.3], dark);
      }
      a.box('sleepwing_side_mullion', [side * 14.28, 2.35, z], [.16, 1.75, .075], dark);
      a.box('sleepwing_side_sill', [side * 14.3, 1.4, z], [.4, .16, 2.5], bronze);
    }
  }
  // Two sleep wings open into a 4 m-deep shared circulation strip.
  for (const s of [-1, 1]) {
    a.box('sleeping_wing_partition', [s * 5, 1.8, -9], [.22, 3.6, 8], '#dedace', true);
    a.box('sleeping_wing_cornice', [s * 5, 3.65, -9], [.36, .2, 8.2], bronze);
    for (const z of [-10.8, -6.6]) {
      a.box('bed_frame', [s * 10.1, .32, z], [4, .64, 1.7], dark, true);
      a.box('bed_mattress', [s * 10.1, .72, z], [3.85, .18, 1.6], '#f1ece2');
      a.box('bed_folded_quilt', [s * 9.6, .84, z], [2.6, .13, 1.55], s < 0 ? '#619493' : '#8d86b1');
      a.box('bed_pillow', [s * 11.5, .86, z], [.75, .18, 1.35], '#fff7e5');
      a.box('bed_headboard', [s * 12.2, .82, z], [.16, 1.65, 1.9], wood);
      a.box('bedside_chest', [s * 12.5, .45, z + 1.25], [.8, .9, .75], wood, true);
      a.cyl('bedside_lamp', [s * 12.5, 1.17, z + 1.25], .2, .45, '#f2d593');
    }
    // Courtyard pergola side wings: visibly distinct from the modern research buildings nearby.
    for (const z of [1.4, 7.7]) a.box('pergola_column', [s * 14.5, 1.7, z], [.25, 3.4, .25], dark, true);
    a.box('pergola_beam', [s * 14.5, 3.45, 4.5], [.3, .22, 7.4], bronze);
    a.box('pergola_beam', [s * 11.8, 3.45, 4.5], [.3, .22, 7.4], bronze);
    for (let z = 1; z < 8.5; z += .8) a.box('pergola_slats', [s * 13.1, 3.56, z], [3.8, .1, .2], ivory);
    a.table('garden_bench', s * 12.5, 4.5, 1.3, 4.2, wood, -.4);
    a.box('garden_bench_back', [s * 13.2, 1.1, 4.5], [.16, .65, 4.2], dark);
    a.box('garden_planter', [s * 11.7, .55, 11.6], [4.7, 1.1, 1.7], dark, true);
    a.box('planter_soil', [s * 11.7, 1.12, 11.6], [4.4, .1, 1.4], '#473f38');
    for (let k = -2; k <= 2; k++) {
      a.mesh('garden_foliage', new THREE.IcosahedronGeometry(.65, 0), a.mat(k % 2 ? '#6a9a76' : '#85ab79'), [s * 11.7 + k * .8, 1.5, 11.6], [1, .7, 1]);
      a.cyl('garden_blossom', [s * 11.7 + k * .8, 1.98, 11.6], .12, .08, '#e8b4bc');
    }
  }
  a.table('communal_dining', 0, -8.3, 6, 2.2, wood);
  for (const z of [-10.1, -6.5]) a.table('dining_bench', 0, z, 5.7, .7, blue, -.4);
  for (const x of [-2, 0, 2]) {
    a.cyl('dining_plate', [x, 1.015, -8.3], .28, .035, '#e9eddf');
    a.cyl('dining_cup', [x + .4, 1.13, -8.6], .12, .25, '#a9c8cb');
  }
  a.box('residence_library', [0, 1.4, -12.55], [7.5, 2.8, .6], dark, true);
  for (const y of [.5, 1.25, 2]) {
    a.box('library_shelf', [0, y, -12.12], [7.2, .09, .45], wood);
    for (let i = 0; i < 20; i++) a.box('library_book', [-3.3 + i * .34, y + .29, -12.1], [.22, .5 + .06 * (i % 3), .32], ['#ad8461', '#7b8f98', '#9d807d', '#b4a36d'][i % 4]);
  }
  for (const x of [-2.6, 2.6]) {
    a.box('entry_lantern_bracket', [x, 3.35, -.42], [.2, .2, .7], dark);
    a.box('entry_lantern', [x, 2.95, -.15], [.37, .6, .37], '#eacb8b', false, 0, .5);
    a.box('entry_lantern_cap', [x, 3.29, -.15], [.5, .1, .5], bronze);
  }
  // A geometric sun emblem makes the residence read as part of Parhelion, not a second inn.
  const ring = a.mesh('residence_sun_emblem', new THREE.TorusGeometry(.75, .065, 6, 24), a.mat(bronze, .5), [0, 5.55, .12], [1, 1, 1]);
  ring.rotation.x = 0;
  a.box('residence_sun_spine', [0, 5.55, .12], [.07, 1.9, .09], bronze);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    a.beam('residence_sun_ray', [Math.cos(angle) * .88, 5.55 + Math.sin(angle) * .88, .13], [Math.cos(angle) * 1.12, 5.55 + Math.sin(angle) * 1.12, .13], .055, bronze);
  }
  for (const x of [-1.1, 1.1]) a.beam('dining_lantern_suspension', [x, 4.6, -8.3], [x, 3.55, -8.3], .04, bronze);
  a.box('dining_lantern_frame', [0, 3.55, -8.3], [3.2, .16, .65], dark);
  a.box('dining_lantern_glow', [0, 3.44, -8.3], [2.85, .12, .48], '#f2d7a3', false, 0, .65);
  const group = a.finish('SET_Alpha_CompanionResidence');
  const light = new THREE.PointLight('#ffe8bc', 28, 20, 2); light.name = 'Residence_WarmFill';
  light.position.set(0, 3.25, -7.4); light.castShadow = false; group.add(light);
  return {
    id: 'alpha', name: ['从者生活馆', 'Companion Residence'], group,
    footprint: [34, 30], entry: [0, 14.5],
    npcs: [
      { id: 'alpha_steward', role: ['生活馆管事', 'Residence Steward'], position: [3.2, .02, 1.5], yaw: 0,
        lines: [['这里是从者们的生活馆。餐桌和休息区已经备好，随时可以进来歇一会儿。', 'This residence is for our companions. The dining hall and rest rooms are ready; come in whenever you need a quiet moment.'], ['两侧是休息房间，后方书架收着各个时代留下的旅行笔记。', 'Rest rooms are on either side. The shelves at the back hold travel notes from many eras.']] },
      { id: 'alpha_archivist', role: ['驻地记录员', 'Residence Archivist'], position: [-3.2, .02, -4.2], yaw: 0,
        lines: [['每位同行者都有自己的故事。旅途结束后，不妨来这里听听他们的见闻。', 'Every companion has a story. After a journey, this is a place to exchange what you have seen.']] },
    ],
  };
}
