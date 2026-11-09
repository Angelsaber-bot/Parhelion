/** 黑帆尽头 exploration content — positions generated against map occupancy (trees/buildings) and terrain. */
import type { ChestDef, FeatherDef, StatueDef, PrismPuzzleDef, TrialDef, CampDef, DomainDef } from '../catalog';
export const BLACKSAIL_STATUES: readonly StatueDef[] = [
  { id: 'blacksail', region: "blacksail", p: [456, 2], yaw: 0, title: ["日晕神像 · 黑帆","Halo Statue · Black Sail"] },
];
export const BLACKSAIL_PUZZLES: readonly PrismPuzzleDef[] = [
];
export const BLACKSAIL_TRIALS: readonly TrialDef[] = [
  { id: 'wreck_glide', region: "blacksail", title: ["沉船滑翔","Wreck Glide"], stele: [888, -156], seconds: 20, glide: true, orbs: [{"p":[892,-144],"y":27.5},{"p":[897,-132],"y":24.4},{"p":[901,-119],"y":21.2},{"p":[906,-107],"y":18.1},{"p":[910,-95],"y":15},{"p":[915,-83],"y":11.9},{"p":[919,-70],"y":8.8},{"p":[924,-58],"y":5.6}], hint: ["从石碑前方起跳，空中再按跳跃展开滑翔翼，沿光圈下降。","Jump forward from the stele, press Jump again in mid-air to open the glider, and follow the rings."] },
];
export const BLACKSAIL_CAMPS: readonly CampDef[] = [
  { id: 'sunken_vault', region: "blacksail", title: ["沉没金库","Sunken Vault"], anchor: [738, 24], requires: 'xp_dig_blackbeard', style: 'domain', waves: [[{"role":"powder","offset":[6,-4],"title":["金库守魂","Vault Shade"]},{"role":"powder","offset":[-6,-4],"title":["金库守魂","Vault Shade"]},{"role":"bombardier","offset":[0,-7],"title":["沉船卫兵","Wreck Guard"]}],[{"role":"duelist","offset":[7,3],"title":["沉船卫兵","Wreck Guard"]},{"role":"powder","offset":[-7,3],"title":["沉船卫兵","Wreck Guard"]},{"role":"musketeer","offset":[0,-7],"title":["沉船卫兵","Wreck Guard"]}],[{"role":"powder","offset":[0,-6.5],"title":["亡航大副","Drowned First Mate"],"pattern":"echo-warden"},{"role":"duelist","offset":[6.5,2],"title":["金库近卫","Vault Guard"]},{"role":"duelist","offset":[-6.5,2],"title":["金库近卫","Vault Guard"]}]] },
  { id: 'smugglers', region: "blacksail", title: ["走私者洞口","Smugglers' Den"], anchor: [702, -123], waves: [[{"role":"powder","offset":[6,-4],"title":["海寇火药手","Corsair Powder Monkey"]},{"role":"duelist","offset":[-6,-4],"title":["海寇刀手","Corsair Cutlass"]},{"role":"musketeer","offset":[0,-7],"title":["海寇火枪手","Corsair Musketeer"]}],[{"role":"powder","offset":[6,3],"title":["火药桶头目","Keg Boss"]},{"role":"powder","offset":[-6,3],"title":["海寇火药手","Corsair Powder Monkey"]},{"role":"bombardier","offset":[0,-7],"title":["海寇投弹手","Corsair Grenadier"]}]] },
  { id: 'fort_outer', region: "blacksail", title: ["外堡炮台","Outer Battery"], anchor: [814, -138], waves: [[{"role":"musketeer","offset":[6,-4],"title":["亡航火枪手","Drowned Musketeer"]},{"role":"musketeer","offset":[-6,-4],"title":["亡航火枪手","Drowned Musketeer"]},{"role":"lancer","offset":[0,-7],"title":["亡航登舷兵","Drowned Boarder"]}],[{"role":"bombardier","offset":[6,3],"title":["亡航炮手","Drowned Gunner"]},{"role":"breaker","offset":[-6,3],"title":["甲板长","Bosun"]},{"role":"musketeer","offset":[0,-7],"title":["亡航火枪手","Drowned Musketeer"]}]] },
  { id: 'reef', region: "blacksail", title: ["礁石营地","Reef Camp"], anchor: [790, 108], waves: [[{"role":"duelist","offset":[6,-4],"title":["礁石劫匪","Reef Cutthroat"]},{"role":"duelist","offset":[-6,-4],"title":["礁石劫匪","Reef Cutthroat"]},{"role":"powder","offset":[0,-7],"title":["礁石火药手","Reef Powder Monkey"]}],[{"role":"stalker","offset":[6,3],"title":["劫匪队长","Raider Captain"]},{"role":"powder","offset":[-6,3],"title":["礁石火药手","Reef Powder Monkey"]},{"role":"bombardier","offset":[0,-7],"title":["鱼叉投手","Harpoon Thrower"]}]] },
];
export const BLACKSAIL_DOMAINS: readonly DomainDef[] = [
  { id: 'sunken_vault', region: "blacksail", title: ["秘境 · 沉没金库","Domain · Sunken Vault"], center: [738, 24], radius: 19, story: ["黑胡子的金库沉进了潮汐之下。日光被锁在海水里，看守它的是亡航的大副。","Blackbeard's vault sank beneath the tide. Sunlight is locked in the water, guarded by the drowned first mate."] },
];
export const BLACKSAIL_CHESTS: readonly ChestDef[] = [
  { id: 'blacksail_domain_sunken_vault', region: "blacksail", p: [738, 33], tier: 'luxurious', requires: 'xp_camp_sunken_vault' },
  { id: 'blacksail_camp_smugglers', region: "blacksail", p: [702, -123], tier: 'precious', requires: 'xp_camp_smugglers' },
  { id: 'blacksail_camp_fort_outer', region: "blacksail", p: [814, -138], tier: 'precious', requires: 'xp_camp_fort_outer' },
  { id: 'blacksail_camp_reef', region: "blacksail", p: [790, 108], tier: 'precious', requires: 'xp_camp_reef' },
  { id: 'blacksail_trial_wreck_glide', region: "blacksail", p: [891, -153], tier: 'exquisite', requires: 'xp_trial_wreck_glide' },
  { id: 'blacksail_pass_bend', region: "blacksail", p: [448, -18], tier: 'common' },
  { id: 'blacksail_port_crates', region: "blacksail", p: [628, 182], tier: 'common' },
  { id: 'blacksail_port_pier', region: "blacksail", p: [574, 186], tier: 'common' },
  { id: 'blacksail_meadow_mill', region: "blacksail", p: [696, -74], tier: 'common' },
  { id: 'blacksail_meadow_ruin', region: "blacksail", p: [628, -90], tier: 'common' },
  { id: 'blacksail_cave_mouth', region: "blacksail", p: [712, -82], tier: 'exquisite' },
  { id: 'blacksail_wreck_field', region: "blacksail", p: [564, -134], tier: 'exquisite' },
  { id: 'blacksail_wreck_rocks', region: "blacksail", p: [622, -242], tier: 'common' },
  { id: 'blacksail_fort_gate', region: "blacksail", p: [876, -154], tier: 'common' },
  { id: 'blacksail_fort_wall', region: "blacksail", p: [954, -206], tier: 'exquisite' },
  { id: 'blacksail_reef_spit', region: "blacksail", p: [876, 206], tier: 'common' },
  { id: 'blacksail_nw_hills', region: "blacksail", p: [476, -252], tier: 'common' },
  { id: 'blacksail_north_ridge', region: "blacksail", p: [756, -292], tier: 'exquisite' },
  { id: 'blacksail_east_coast', region: "blacksail", p: [951, -98], tier: 'common' },
  { id: 'blacksail_west_meadow', region: "blacksail", p: [528, -62], tier: 'common' },
  { id: 'blacksail_inland_spring', region: "blacksail", p: [852, 36], tier: 'common' },
];
export const BLACKSAIL_FEATHERS: readonly FeatherDef[] = [
  { id: 'blacksail_pass_rock', region: "blacksail", p: [432, 52] },
  { id: 'blacksail_port_roof', region: "blacksail", p: [606, 118] },
  { id: 'blacksail_mill', region: "blacksail", p: [682, -32] },
  { id: 'blacksail_wreck_a', region: "blacksail", p: [584, -184] },
  { id: 'blacksail_fort_tower', region: "blacksail", p: [916, -202] },
  { id: 'blacksail_lighthouse', region: "blacksail", p: [971, -7] },
  { id: 'blacksail_dunes', region: "blacksail", p: [744, 186] },
  { id: 'blacksail_meadow_high', region: "blacksail", p: [758, -52] },
  { id: 'blacksail_cove', region: "blacksail", p: [532, 118] },
  { id: 'blacksail_north_peak', region: "blacksail", p: [680, -292] },
];
