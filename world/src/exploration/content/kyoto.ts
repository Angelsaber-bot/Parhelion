/** 京都 exploration content — positions generated against map occupancy (trees/buildings) and terrain. */
import type { ChestDef, FeatherDef, StatueDef, PrismPuzzleDef, TrialDef, CampDef, DomainDef } from '../catalog';
export const KYOTO_STATUES: readonly StatueDef[] = [
  { id: 'kyoto', region: "kyoto", p: [-48, 492], yaw: 0, title: ["日晕神像 · 京都","Halo Statue · Kyoto"] },
];
export const KYOTO_PUZZLES: readonly PrismPuzzleDef[] = [
  {"id":"lotus_hall","region":"kyoto","title":["莲华封印","Lotus Seal"],"range":20,"source":{"p":[-72,994],"dir":2},"prisms":[{"p":[-72,1008],"start":6},{"p":[-58,980],"start":0},{"p":[-58,1008],"start":2},{"p":[-44,994],"start":1}],"receiver":[-72,980],"blockers":[{"p":[-58,994],"r":2.6,"h":6}],"hint":["绕着中央石碑把光送一圈，石碑会挡住捷径。","Carry the light around the central monument; it blocks the shortcut."]},
  {"id":"lantern_road","region":"kyoto","title":["灯笼小径","Lantern Road"],"range":30,"source":{"p":[102,504],"dir":0},"prisms":[{"p":[122,504],"start":5},{"p":[122,528],"start":1}],"receiver":[102,528],"blockers":[],"hint":["把两座棱镜依次转向，让日光拐两次弯落进晶座。","Turn both prisms so the sunlight bends twice into the receiver."]},
  {"id":"bamboo_grove","region":"kyoto","title":["竹林折光","Bamboo Refraction"],"range":30,"source":{"p":[-186,930],"dir":0},"prisms":[{"p":[-166,930],"start":4},{"p":[-146,950],"start":0},{"p":[-166,970],"start":3}],"receiver":[-186,970],"blockers":[],"hint":["光线需要三次折射，留意哪座棱镜在水边。","The beam needs three bends; mind the prism by the water."]},
  {"id":"higashi_slope","region":"kyoto","title":["东山坡道","Higashiyama Slope"],"range":45,"source":{"p":[200,822],"dir":4},"prisms":[{"p":[170,822],"start":5},{"p":[170,862],"start":6,"raise":10},{"p":[190,882],"start":1},{"p":[190,902],"start":0}],"receiver":[210,882],"blockers":[{"p":[200,882],"r":1.3,"h":6}],"hint":["高台上的棱镜才能越过矮墙，石柱会挡住直射。","Only the raised prism clears the wall; the pillar blocks a straight shot."]},
];
export const KYOTO_TRIALS: readonly TrialDef[] = [
  { id: 'riverbank_run', region: "kyoto", title: ["鸭川疾行","Riverbank Dash"], stele: [195, 591], seconds: 36, orbs: [{"p":[223,595]},{"p":[242,615]},{"p":[245,642]},{"p":[229,664]},{"p":[202,671]},{"p":[178,660]},{"p":[166,635]},{"p":[173,609]}], hint: ["沿河岸奔跑，限时内收集全部光点。","Sprint the riverbank and grab every light in time."] },
  { id: 'temple_glide', region: "kyoto", title: ["寺檐滑翔","Temple Glide"], stele: [286, 792], seconds: 20, orbs: [{"p":[275,798],"y":31.4},{"p":[263,805],"y":28.3},{"p":[252,812],"y":25.1},{"p":[241,818],"y":22},{"p":[230,824],"y":18.9},{"p":[218,831],"y":15.8},{"p":[207,838],"y":12.7},{"p":[196,844],"y":9.5}], hint: ["从寺院高处跃下，展开滑翔翼穿过光圈。","Leap from the temple heights and glide through the rings."] },
];
export const KYOTO_CAMPS: readonly CampDef[] = [
  { id: 'lotus_hall', region: "kyoto", title: ["莲华堂","Lotus Hall"], anchor: [-58, 994], requires: 'xp_puzzle_lotus_hall', style: 'domain', waves: [[{"role":"stalker","offset":[6,-4],"title":["镜中武者","Mirror Warrior"]},{"role":"lancer","offset":[-6,-4],"title":["镜中武者","Mirror Warrior"]},{"role":"bombardier","offset":[0,-7],"title":["堂守","Hall Keeper"]}],[{"role":"duelist","offset":[7,3],"title":["堂守","Hall Keeper"]},{"role":"breaker","offset":[-7,3],"title":["堂守","Hall Keeper"]},{"role":"musketeer","offset":[0,-7],"title":["堂守","Hall Keeper"]}],[{"role":"breaker","offset":[0,-6.5],"title":["莲华剑豪","Lotus Swordmaster"],"pattern":"echo-warden"},{"role":"duelist","offset":[6.5,2],"title":["剑豪近侍","Swordmaster's Attendant"]},{"role":"duelist","offset":[-6.5,2],"title":["剑豪近侍","Swordmaster's Attendant"]}]] },
  { id: 'rice_field', region: "kyoto", title: ["稻田浪人","Paddy Ronin"], anchor: [110, 958], waves: [[{"role":"stalker","offset":[6,-4],"title":["浪人","Ronin"]},{"role":"lancer","offset":[-6,-4],"title":["浪人","Ronin"]},{"role":"bombardier","offset":[0,-7],"title":["弓足轻","Ashigaru Archer"]}],[{"role":"duelist","offset":[6,3],"title":["浪人头领","Ronin Leader"]},{"role":"breaker","offset":[-6,3],"title":["浪人头领","Ronin Leader"]},{"role":"musketeer","offset":[0,-7],"title":["弓足轻","Ashigaru Archer"]}]] },
  { id: 'east_bank', region: "kyoto", title: ["东岸关所","East Bank Checkpoint"], anchor: [232, 510], waves: [[{"role":"stalker","offset":[6,-4],"title":["关所守兵","Checkpoint Guard"]},{"role":"lancer","offset":[-6,-4],"title":["关所守兵","Checkpoint Guard"]},{"role":"bombardier","offset":[0,-7],"title":["铁炮足轻","Teppo Gunner"]}],[{"role":"duelist","offset":[6,3],"title":["关所奉行","Checkpoint Magistrate"]},{"role":"breaker","offset":[-6,3],"title":["关所奉行","Checkpoint Magistrate"]},{"role":"musketeer","offset":[0,-7],"title":["铁炮足轻","Teppo Gunner"]}]] },
  { id: 'west_road', region: "kyoto", title: ["西街盗贼","West Road Bandits"], anchor: [-269, 632], waves: [[{"role":"stalker","offset":[6,-4],"title":["夜盗","Night Thief"]},{"role":"lancer","offset":[-6,-4],"title":["夜盗","Night Thief"]},{"role":"bombardier","offset":[0,-7],"title":["投石手","Slinger"]}],[{"role":"duelist","offset":[6,3],"title":["盗贼头目","Bandit Boss"]},{"role":"breaker","offset":[-6,3],"title":["盗贼头目","Bandit Boss"]},{"role":"musketeer","offset":[0,-7],"title":["投石手","Slinger"]}]] },
];
export const KYOTO_DOMAINS: readonly DomainDef[] = [
  { id: 'lotus_hall', region: "kyoto", title: ["秘境 · 莲华堂","Domain · Lotus Hall"], center: [-58, 994], radius: 19, story: ["莲华堂的千盏灯曾为落日祈福。如今灯火被困在镜中，守堂的武者不再认得来客。","The thousand lamps of Lotus Hall once prayed for the sunset. Now the flames are trapped in mirrors, and the hall's warriors no longer know their guests."] },
];
export const KYOTO_CHESTS: readonly ChestDef[] = [
  { id: 'kyoto_domain_lotus_hall', region: "kyoto", p: [-58, 1003], tier: 'luxurious', requires: 'xp_camp_lotus_hall' },
  { id: 'kyoto_camp_rice_field', region: "kyoto", p: [110, 958], tier: 'precious', requires: 'xp_camp_rice_field' },
  { id: 'kyoto_camp_east_bank', region: "kyoto", p: [232, 510], tier: 'precious', requires: 'xp_camp_east_bank' },
  { id: 'kyoto_camp_west_road', region: "kyoto", p: [-269, 632], tier: 'precious', requires: 'xp_camp_west_road' },
  { id: 'kyoto_puzzle_lantern_road', region: "kyoto", p: [108,533], tier: 'precious', requires: 'xp_puzzle_lantern_road' },
  { id: 'kyoto_puzzle_bamboo_grove', region: "kyoto", p: [-192,975], tier: 'precious', requires: 'xp_puzzle_bamboo_grove' },
  { id: 'kyoto_puzzle_higashi_slope', region: "kyoto", p: [216,887], tier: 'luxurious', requires: 'xp_puzzle_higashi_slope' },
  { id: 'kyoto_trial_riverbank_run', region: "kyoto", p: [198, 594], tier: 'exquisite', requires: 'xp_trial_riverbank_run' },
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
