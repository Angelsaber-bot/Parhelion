/** 京都 exploration content — positions generated against map occupancy (trees/buildings) and terrain. */
import type { ChestDef, FeatherDef, StatueDef, PrismPuzzleDef, TrialDef, CampDef, DomainDef } from '../catalog';
// 2026-11-13: the Lotus Hall domain and two south-edge chests moved inland; Kyoto's turned south edge is now the
// continent's north coast and their old ground lay at sea level.
export const KYOTO_STATUES: readonly StatueDef[] = [
  { id: 'kyoto', region: "kyoto", p: [768, -1212], yaw: Math.PI, title: ["日晕神像 · 京都","Halo Statue · Kyoto"] },
];
export const KYOTO_PUZZLES: readonly PrismPuzzleDef[] = [
];
export const KYOTO_TRIALS: readonly TrialDef[] = [
  { id: 'temple_glide', region: "kyoto", title: ["寺檐滑翔","Temple Glide"], stele: [434, -1512], seconds: 20, glide: true, orbs: [{"p":[445,-1518],"y":31.4},{"p":[457,-1525],"y":28.3},{"p":[468,-1532],"y":25.1},{"p":[479,-1538],"y":22},{"p":[490,-1544],"y":18.9},{"p":[502,-1551],"y":15.8},{"p":[513,-1558],"y":12.7},{"p":[524,-1564],"y":9.5}], hint: ["从石碑前方起跳，空中再按跳跃展开滑翔翼，沿光圈下降。","Jump forward from the stele, press Jump again in mid-air to open the glider, and follow the rings."] },
];
export const KYOTO_CAMPS: readonly CampDef[] = [
  { id: 'lotus_hall', region: "kyoto", title: ["莲华堂","Lotus Hall"], anchor: [778, -1685], requires: 'xp_fox_lotus_path', style: 'domain', waves: [[{"role":"shinobi","offset":[6,-4],"title":["镜中武者","Mirror Warrior"]},{"role":"lancer","offset":[-6,-4],"title":["镜中武者","Mirror Warrior"]},{"role":"bombardier","offset":[0,-7],"title":["堂守","Hall Keeper"]}],[{"role":"duelist","offset":[7,3],"title":["堂守","Hall Keeper"]},{"role":"shinobi","offset":[-7,3],"title":["堂守","Hall Keeper"]},{"role":"musketeer","offset":[0,-7],"title":["堂守","Hall Keeper"]}],[{"role":"shinobi","offset":[0,-6.5],"title":["莲华剑豪","Lotus Swordmaster"],"pattern":"echo-warden"},{"role":"duelist","offset":[6.5,2],"title":["剑豪近侍","Swordmaster's Attendant"]},{"role":"duelist","offset":[-6.5,2],"title":["剑豪近侍","Swordmaster's Attendant"]}]] },
  { id: 'rice_field', region: "kyoto", title: ["稻田浪人","Paddy Ronin"], anchor: [610, -1678], waves: [[{"role":"lancer","offset":[6,-4],"title":["枪足轻","Spear Ashigaru"]},{"role":"lancer","offset":[-6,-4],"title":["枪足轻","Spear Ashigaru"]},{"role":"bombardier","offset":[0,-7],"title":["弓足轻","Bow Ashigaru"]}],[{"role":"shinobi","offset":[6,3],"title":["浪人头领的影忍","Ronin Chief's Shinobi"]},{"role":"duelist","offset":[-6,3],"title":["浪人头领","Ronin Chief"]},{"role":"musketeer","offset":[0,-7],"title":["铁炮足轻","Teppō Ashigaru"]}]] },
  { id: 'east_bank', region: "kyoto", title: ["东岸关所","East Bank Checkpoint"], anchor: [488, -1230], waves: [[{"role":"shinobi","offset":[6,-4],"title":["关所影忍","Checkpoint Shinobi"]},{"role":"shinobi","offset":[-6,-4],"title":["关所影忍","Checkpoint Shinobi"]},{"role":"duelist","offset":[0,-7],"title":["关所守兵","Checkpoint Guard"]}],[{"role":"duelist","offset":[6,3],"title":["关所奉行","Checkpoint Magistrate"]},{"role":"lancer","offset":[-6,3],"title":["关所枪兵","Checkpoint Spearman"]},{"role":"bombardier","offset":[0,-7],"title":["焙烙玉足轻","Bomb Ashigaru"]}]] },
  { id: 'west_road', region: "kyoto", title: ["西街盗贼","West Road Bandits"], anchor: [989, -1352], waves: [[{"role":"duelist","offset":[6,-4],"title":["夜盗","Night Bandit"]},{"role":"lancer","offset":[-6,-4],"title":["夜盗枪手","Bandit Spearman"]},{"role":"musketeer","offset":[0,-7],"title":["夜盗铁炮","Bandit Teppō"]}],[{"role":"shinobi","offset":[6,3],"title":["盗贼影忍","Bandit Shinobi"]},{"role":"breaker","offset":[-6,3],"title":["盗贼头目","Bandit Chief"]},{"role":"lancer","offset":[0,-7],"title":["夜盗枪手","Bandit Spearman"]}]] },
];
export const KYOTO_DOMAINS: readonly DomainDef[] = [
  { id: 'lotus_hall', region: "kyoto", title: ["秘境 · 莲华堂","Domain · Lotus Hall"], center: [778, -1685], radius: 19, story: ["莲华堂的千盏灯曾为落日祈福。如今灯火被困在镜中，守堂的武者不再认得来客。","The thousand lamps of Lotus Hall once prayed for the sunset. Now the flames are trapped in mirrors, and the hall's warriors no longer know their guests."] },
];
export const KYOTO_CHESTS: readonly ChestDef[] = [
  { id: 'kyoto_domain_lotus_hall', region: "kyoto", p: [778, -1694], tier: 'luxurious', requires: 'xp_camp_lotus_hall' },
  { id: 'kyoto_camp_rice_field', region: "kyoto", p: [610, -1678], tier: 'precious', requires: 'xp_camp_rice_field' },
  { id: 'kyoto_camp_east_bank', region: "kyoto", p: [488, -1230], tier: 'precious', requires: 'xp_camp_east_bank' },
  { id: 'kyoto_camp_west_road', region: "kyoto", p: [989, -1352], tier: 'precious', requires: 'xp_camp_west_road' },
  { id: 'kyoto_trial_temple_glide', region: "kyoto", p: [431, -1515], tier: 'exquisite', requires: 'xp_trial_temple_glide' },
  { id: 'kyoto_inari_path', region: "kyoto", p: [642, -1178], tier: 'common' },
  { id: 'kyoto_torii_side', region: "kyoto", p: [800, -1156], tier: 'common' },
  { id: 'kyoto_kinkaku_pond', region: "kyoto", p: [1004, -1290], tier: 'common' },
  { id: 'kyoto_west_farm', region: "kyoto", p: [1018, -1522], tier: 'common' },
  { id: 'kyoto_akechi_edge', region: "kyoto", p: [902, -1568], tier: 'common' },
  { id: 'kyoto_south_paddy', region: "kyoto", p: [818, -1720], tier: 'common' },
  { id: 'kyoto_south_shrine', region: "kyoto", p: [574, -1744], tier: 'common' },
  { id: 'kyoto_river_east', region: "kyoto", p: [530, -1428], tier: 'common' },
  { id: 'kyoto_higashi_garden', region: "kyoto", p: [432, -1342], tier: 'common' },
  { id: 'kyoto_higashi_south', region: "kyoto", p: [424, -1524], tier: 'common' },
  { id: 'kyoto_east_far', region: "kyoto", p: [410, -1704], tier: 'common' },
  { id: 'kyoto_kamo_bank', region: "kyoto", p: [580, -1300], tier: 'common' },
  { id: 'kyoto_city_gate', region: "kyoto", p: [752, -1702], tier: 'common' },
  { id: 'kyoto_arashi_field', region: "kyoto", p: [1018, -1430], tier: 'common' },
  { id: 'kyoto_north_east', region: "kyoto", p: [482, -1212], tier: 'common' },
  { id: 'kyoto_bamboo_edge', region: "kyoto", p: [978, -1624], tier: 'common' },
];
export const KYOTO_FEATHERS: readonly FeatherDef[] = [
  { id: 'kyoto_statue', region: "kyoto", p: [756, -1196] },
  { id: 'kyoto_inari', region: "kyoto", p: [668, -1128] },
  { id: 'kyoto_kinkaku', region: "kyoto", p: [927, -1258] },
  { id: 'kyoto_higashi', region: "kyoto", p: [444, -1490] },
  { id: 'kyoto_river', region: "kyoto", p: [548, -1372] },
  { id: 'kyoto_south', region: "kyoto", p: [712, -1708] },
  { id: 'kyoto_akechi', region: "kyoto", p: [980, -1596] },
  { id: 'kyoto_east', region: "kyoto", p: [412, -1610] },
  { id: 'kyoto_west', region: "kyoto", p: [1050, -1480] },
  { id: 'kyoto_north', region: "kyoto", p: [844, -1154] },
];
