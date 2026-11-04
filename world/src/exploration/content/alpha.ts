/** 幻日谷 exploration content — positions generated against map occupancy (trees/buildings) and terrain. */
import type { ChestDef, FeatherDef, StatueDef, PrismPuzzleDef, TrialDef, CampDef, DomainDef } from '../catalog';
export const ALPHA_STATUES: readonly StatueDef[] = [
  { id: 'alpha', region: "alpha", p: [26, 148], yaw: 0, title: ["日晕神像 · 幻日谷","Halo Statue · Parhelion Valley"] },
];
export const ALPHA_PUZZLES: readonly PrismPuzzleDef[] = [
  {"id":"tutorial","region":"alpha","title":["初次折光","First Refraction"],"range":30,"source":{"p":[-196,2],"dir":0},"prisms":[{"p":[-176,2],"start":5},{"p":[-176,26],"start":1}],"receiver":[-196,26],"blockers":[],"hint":["把两座棱镜依次转向，让日光拐两次弯落进晶座。","Turn both prisms so the sunlight bends twice into the receiver."]},
];
export const ALPHA_TRIALS: readonly TrialDef[] = [
  { id: 'tower_glide', region: "alpha", title: ["塔顶滑翔","Tower Glide"], stele: [1, -141], seconds: 20, orbs: [{"p":[1,-128],"y":23.2},{"p":[1,-115],"y":20.1},{"p":[1,-102],"y":16.9},{"p":[1,-89],"y":13.8},{"p":[1,-76],"y":10.7},{"p":[1,-63],"y":7.6},{"p":[1,-50],"y":4.5}], hint: ["从塔顶跃下，展开滑翔翼穿过光圈。","Leap from the tower top and glide through the rings."] },
];
export const ALPHA_CAMPS: readonly CampDef[] = [
  { id: 'echo_ruins', region: "alpha", title: ["回声遗迹","Echo Ruins"], anchor: [150, -102], waves: [[{"role":"stalker","offset":[6,-4],"title":["回声幻影","Echo Phantom"]},{"role":"stalker","offset":[-6,-4],"title":["回声幻影","Echo Phantom"]},{"role":"bombardier","offset":[0,-7],"title":["回声射手","Echo Archer"]}],[{"role":"breaker","offset":[6,3],"title":["回声骑影","Echo Knight"]},{"role":"stalker","offset":[-6,3],"title":["回声骑影","Echo Knight"]},{"role":"bombardier","offset":[0,-7],"title":["回声射手","Echo Archer"]}]] },
];
export const ALPHA_DOMAINS: readonly DomainDef[] = [

];
export const ALPHA_CHESTS: readonly ChestDef[] = [
  { id: 'alpha_camp_echo_ruins', region: "alpha", p: [150, -102], tier: 'precious', requires: 'xp_camp_echo_ruins' },
  { id: 'alpha_puzzle_tutorial', region: "alpha", p: [-190,31], tier: 'precious', requires: 'xp_puzzle_tutorial' },
  { id: 'alpha_trial_tower_glide', region: "alpha", p: [4, -138], tier: 'exquisite', requires: 'xp_trial_tower_glide' },
  { id: 'alpha_camp_cliff', region: "alpha", p: [58, 204], tier: 'common' },
  { id: 'alpha_forest_glade', region: "alpha", p: [146, 38], tier: 'common' },
  { id: 'alpha_falls_ledge', region: "alpha", p: [158, -52], tier: 'common' },
  { id: 'alpha_lake_shore', region: "alpha", p: [44, 44], tier: 'common' },
  { id: 'alpha_station_yard', region: "alpha", p: [-172, -64], tier: 'common' },
  { id: 'alpha_ford_rocks', region: "alpha", p: [-110, 96], tier: 'common' },
  { id: 'alpha_north_wood', region: "alpha", p: [-224, -208], tier: 'common' },
  { id: 'alpha_east_field', region: "alpha", p: [226, 96], tier: 'common' },
  { id: 'alpha_south_meadow', region: "alpha", p: [-62, 304], tier: 'common' },
  { id: 'alpha_tower_steps', region: "alpha", p: [78, -150], tier: 'common' },
];
export const ALPHA_FEATHERS: readonly FeatherDef[] = [
  { id: 'alpha_statue', region: "alpha", p: [56, 128] },
  { id: 'alpha_tower_top', region: "alpha", p: [20, -160] },
  { id: 'alpha_falls', region: "alpha", p: [156, -64] },
  { id: 'alpha_forest', region: "alpha", p: [100, 74] },
  { id: 'alpha_station', region: "alpha", p: [-142, -44] },
  { id: 'alpha_lake_island', region: "alpha", p: [-60, 120] },
];
