/** 京都 exploration content — positions generated against map occupancy (trees/buildings) and terrain. */
import type { ChestDef, FeatherDef, StatueDef, PrismPuzzleDef, TrialDef, CampDef, DomainDef } from '../catalog';
export const KYOTO_STATUES: readonly StatueDef[] = [
  { id: 'kyoto', region: "kyoto", p: [-48, 492], yaw: 0, title: ["日晕神像 · 京都","Halo Statue · Kyoto"] },
];
export const KYOTO_PUZZLES: readonly PrismPuzzleDef[] = [
];
export const KYOTO_TRIALS: readonly TrialDef[] = [
  { id: 'temple_glide', region: "kyoto", title: ["寺檐滑翔","Temple Glide"], stele: [286, 792], seconds: 20, glide: true, orbs: [{"p":[275,798],"y":31.4},{"p":[263,805],"y":28.3},{"p":[252,812],"y":25.1},{"p":[241,818],"y":22},{"p":[230,824],"y":18.9},{"p":[218,831],"y":15.8},{"p":[207,838],"y":12.7},{"p":[196,844],"y":9.5}], hint: ["从石碑前方起跳，空中再按跳跃展开滑翔翼，沿光圈下降。","Jump forward from the stele, press Jump again in mid-air to open the glider, and follow the rings."] },
];
export const KYOTO_CAMPS: readonly CampDef[] = [
  { id: 'lotus_hall', region: "kyoto", title: ["莲华堂","Lotus Hall"], anchor: [-58, 994], requires: 'xp_fox_lotus_path', style: 'domain', waves: [[{"role":"shinobi","offset":[6,-4],"title":["镜中武者","Mirror Warrior"]},{"role":"lancer","offset":[-6,-4],"title":["镜中武者","Mirror Warrior"]},{"role":"bombardier","offset":[0,-7],"title":["堂守","Hall Keeper"]}],[{"role":"duelist","offset":[7,3],"title":["堂守","Hall Keeper"]},{"role":"shinobi","offset":[-7,3],"title":["堂守","Hall Keeper"]},{"role":"musketeer","offset":[0,-7],"title":["堂守","Hall Keeper"]}],[{"role":"shinobi","offset":[0,-6.5],"title":["莲华剑豪","Lotus Swordmaster"],"pattern":"echo-warden"},{"role":"duelist","offset":[6.5,2],"title":["剑豪近侍","Swordmaster's Attendant"]},{"role":"duelist","offset":[-6.5,2],"title":["剑豪近侍","Swordmaster's Attendant"]}]] },
  { id: 'rice_field', region: "kyoto", title: ["稻田浪人","Paddy Ronin"], anchor: [110, 958], waves: [[{"role":"lancer","offset":[6,-4],"title":["枪足轻","Spear Ashigaru"]},{"role":"lancer","offset":[-6,-4],"title":["枪足轻","Spear Ashigaru"]},{"role":"bombardier","offset":[0,-7],"title":["弓足轻","Bow Ashigaru"]}],[{"role":"shinobi","offset":[6,3],"title":["浪人头领的影忍","Ronin Chief's Shinobi"]},{"role":"duelist","offset":[-6,3],"title":["浪人头领","Ronin Chief"]},{"role":"musketeer","offset":[0,-7],"title":["铁炮足轻","Teppō Ashigaru"]}]] },
  { id: 'east_bank', region: "kyoto", title: ["东岸关所","East Bank Checkpoint"], anchor: [232, 510], waves: [[{"role":"shinobi","offset":[6,-4],"title":["关所影忍","Checkpoint Shinobi"]},{"role":"shinobi","offset":[-6,-4],"title":["关所影忍","Checkpoint Shinobi"]},{"role":"duelist","offset":[0,-7],"title":["关所守兵","Checkpoint Guard"]}],[{"role":"duelist","offset":[6,3],"title":["关所奉行","Checkpoint Magistrate"]},{"role":"lancer","offset":[-6,3],"title":["关所枪兵","Checkpoint Spearman"]},{"role":"bombardier","offset":[0,-7],"title":["焙烙玉足轻","Bomb Ashigaru"]}]] },
  { id: 'west_road', region: "kyoto", title: ["西街盗贼","West Road Bandits"], anchor: [-269, 632], waves: [[{"role":"duelist","offset":[6,-4],"title":["夜盗","Night Bandit"]},{"role":"lancer","offset":[-6,-4],"title":["夜盗枪手","Bandit Spearman"]},{"role":"musketeer","offset":[0,-7],"title":["夜盗铁炮","Bandit Teppō"]}],[{"role":"shinobi","offset":[6,3],"title":["盗贼影忍","Bandit Shinobi"]},{"role":"breaker","offset":[-6,3],"title":["盗贼头目","Bandit Chief"]},{"role":"lancer","offset":[0,-7],"title":["夜盗枪手","Bandit Spearman"]}]] },
];
export const KYOTO_DOMAINS: readonly DomainDef[] = [
  { id: 'lotus_hall', region: "kyoto", title: ["秘境 · 莲华堂","Domain · Lotus Hall"], center: [-58, 994], radius: 19, story: ["莲华堂的千盏灯曾为落日祈福。如今灯火被困在镜中，守堂的武者不再认得来客。","The thousand lamps of Lotus Hall once prayed for the sunset. Now the flames are trapped in mirrors, and the hall's warriors no longer know their guests."] },
];
export const KYOTO_CHESTS: readonly ChestDef[] = [
  { id: 'kyoto_domain_lotus_hall', region: "kyoto", p: [-58, 1003], tier: 'luxurious', requires: 'xp_camp_lotus_hall' },
  { id: 'kyoto_camp_rice_field', region: "kyoto", p: [110, 958], tier: 'precious', requires: 'xp_camp_rice_field' },
  { id: 'kyoto_camp_east_bank', region: "kyoto", p: [232, 510], tier: 'precious', requires: 'xp_camp_east_bank' },
  { id: 'kyoto_camp_west_road', region: "kyoto", p: [-269, 632], tier: 'precious', requires: 'xp_camp_west_road' },
  { id: 'kyoto_trial_temple_glide', region: "kyoto", p: [289, 795], tier: 'exquisite', requires: 'xp_trial_temple_glide' },
  { id: 'kyoto_inari_path', region: "kyoto", p: [78, 458], tier: 'common' },
  { id: 'kyoto_torii_side', region: "kyoto", p: [-80, 436], tier: 'common' },
  { id: 'kyoto_kinkaku_pond', region: "kyoto", p: [-284, 570], tier: 'common' },
  { id: 'kyoto_west_farm', region: "kyoto", p: [-298, 802], tier: 'common' },
  { id: 'kyoto_akechi_edge', region: "kyoto", p: [-182, 848], tier: 'common' },
  { id: 'kyoto_south_paddy', region: "kyoto", p: [-98, 1000], tier: 'common' },
  { id: 'kyoto_south_shrine', region: "kyoto", p: [146, 1024], tier: 'common' },
  { id: 'kyoto_river_east', region: "kyoto", p: [190, 708], tier: 'common' },
  { id: 'kyoto_higashi_garden', region: "kyoto", p: [288, 622], tier: 'common' },
  { id: 'kyoto_higashi_south', region: "kyoto", p: [296, 804], tier: 'common' },
  { id: 'kyoto_east_far', region: "kyoto", p: [310, 984], tier: 'common' },
  { id: 'kyoto_kamo_bank', region: "kyoto", p: [140, 580], tier: 'common' },
  { id: 'kyoto_city_gate', region: "kyoto", p: [-32, 1000], tier: 'common' },
  { id: 'kyoto_arashi_field', region: "kyoto", p: [-298, 710], tier: 'common' },
  { id: 'kyoto_north_east', region: "kyoto", p: [238, 492], tier: 'common' },
  { id: 'kyoto_bamboo_edge', region: "kyoto", p: [-258, 904], tier: 'common' },
];
export const KYOTO_FEATHERS: readonly FeatherDef[] = [
  { id: 'kyoto_statue', region: "kyoto", p: [-36, 476] },
  { id: 'kyoto_inari', region: "kyoto", p: [52, 408] },
  { id: 'kyoto_kinkaku', region: "kyoto", p: [-207, 538] },
  { id: 'kyoto_higashi', region: "kyoto", p: [276, 770] },
  { id: 'kyoto_river', region: "kyoto", p: [172, 652] },
  { id: 'kyoto_south', region: "kyoto", p: [10, 1016] },
  { id: 'kyoto_akechi', region: "kyoto", p: [-260, 876] },
  { id: 'kyoto_east', region: "kyoto", p: [308, 890] },
  { id: 'kyoto_west', region: "kyoto", p: [-330, 760] },
  { id: 'kyoto_north', region: "kyoto", p: [-124, 434] },
];
