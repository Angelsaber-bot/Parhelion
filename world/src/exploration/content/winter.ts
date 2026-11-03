/** 永冬之城 exploration content — positions generated against map occupancy (trees/buildings) and terrain. */
import type { ChestDef, FeatherDef, StatueDef, PrismPuzzleDef, TrialDef, CampDef, DomainDef } from '../catalog';
export const WINTER_STATUES: readonly StatueDef[] = [
  { id: 'winter', region: "winter", p: [-68, -430], yaw: 0, title: ["日晕神像 · 永冬","Halo Statue · Eternal Winter"] },
];
export const WINTER_PUZZLES: readonly PrismPuzzleDef[] = [
  {"id":"frozen_chapel","region":"winter","title":["礼拜堂封印","Chapel Seal"],"range":20,"source":{"p":[-164,-786],"dir":2},"prisms":[{"p":[-164,-772],"start":6},{"p":[-150,-800],"start":0},{"p":[-150,-772],"start":2},{"p":[-136,-786],"start":1}],"receiver":[-164,-800],"blockers":[{"p":[-150,-786],"r":2.6,"h":6}],"hint":["绕着中央石碑把光送一圈，石碑会挡住捷径。","Carry the light around the central monument; it blocks the shortcut."]},
  {"id":"icelens","region":"winter","title":["冰透镜","Ice Lens"],"range":30,"source":{"p":[-110,-666],"dir":0},"prisms":[{"p":[-90,-666],"start":5},{"p":[-90,-642],"start":1}],"receiver":[-110,-642],"blockers":[],"hint":["把两座棱镜依次转向，让日光拐两次弯落进晶座。","Turn both prisms so the sunlight bends twice into the receiver."]},
  {"id":"riverprism","region":"winter","title":["冰河折光","Frozen River Prism"],"range":30,"source":{"p":[88,-570],"dir":0},"prisms":[{"p":[108,-570],"start":4},{"p":[128,-550],"start":0},{"p":[108,-530],"start":3}],"receiver":[88,-530],"blockers":[],"hint":["光线需要三次折射，留意哪座棱镜在水边。","The beam needs three bends; mind the prism by the water."]},
  {"id":"kremlin_wall","region":"winter","title":["城墙棱窗","Wall Prism Window"],"range":45,"source":{"p":[-160,-914],"dir":4},"prisms":[{"p":[-190,-914],"start":5},{"p":[-190,-874],"start":6,"raise":10},{"p":[-170,-854],"start":1},{"p":[-170,-834],"start":0}],"receiver":[-150,-854],"blockers":[{"p":[-160,-854],"r":1.3,"h":6}],"hint":["高台上的棱镜才能越过矮墙，石柱会挡住直射。","Only the raised prism clears the wall; the pillar blocks a straight shot."]},
];
export const WINTER_TRIALS: readonly TrialDef[] = [
  { id: 'snow_run', region: "winter", title: ["雪原疾行","Snowfield Dash"], stele: [-179, -601], seconds: 36, orbs: [{"p":[-157,-583]},{"p":[-150,-557]},{"p":[-162,-532]},{"p":[-186,-521]},{"p":[-213,-528]},{"p":[-229,-550]},{"p":[-226,-577]},{"p":[-207,-597]}], hint: ["踏雪奔跑，限时内收集全部光点。","Run through the snow and grab every light in time."] },
  { id: 'gorge_glide', region: "winter", title: ["峡谷滑翔","Gorge Glide"], stele: [207, -689], seconds: 20, orbs: [{"p":[218,-696],"y":30.9},{"p":[230,-702],"y":27.8},{"p":[241,-708],"y":24.6},{"p":[252,-715],"y":21.5},{"p":[263,-722],"y":18.4},{"p":[275,-728],"y":15.3},{"p":[286,-734],"y":12.2},{"p":[297,-741]}], hint: ["从峡谷高处跃下，展开滑翔翼穿过光圈。","Leap from the gorge rim and glide through the rings."] },
];
export const WINTER_CAMPS: readonly CampDef[] = [
  { id: 'frozen_chapel', region: "winter", title: ["冰封礼拜堂","Frozen Chapel"], anchor: [-150, -786], requires: 'xp_puzzle_frozen_chapel', style: 'domain', waves: [[{"role":"stalker","offset":[6,-4],"title":["霜之残影","Frost Echo"]},{"role":"lancer","offset":[-6,-4],"title":["霜之残影","Frost Echo"]},{"role":"bombardier","offset":[0,-7],"title":["冰甲卫士","Ice Warden"]}],[{"role":"duelist","offset":[7,3],"title":["冰甲卫士","Ice Warden"]},{"role":"breaker","offset":[-7,3],"title":["冰甲卫士","Ice Warden"]},{"role":"musketeer","offset":[0,-7],"title":["冰甲卫士","Ice Warden"]}],[{"role":"breaker","offset":[0,-6.5],"title":["冬夜司祭","Priest of the Winter Night"],"pattern":"echo-warden"},{"role":"duelist","offset":[6.5,2],"title":["钟楼卫士","Belfry Guard"]},{"role":"duelist","offset":[-6.5,2],"title":["钟楼卫士","Belfry Guard"]}]] },
  { id: 'bivouac_pickets', region: "winter", title: ["宿营哨线","Bivouac Pickets"], anchor: [-119, -514], waves: [[{"role":"stalker","offset":[6,-4],"title":["溃军掷弹兵","Grenadier Straggler"]},{"role":"lancer","offset":[-6,-4],"title":["溃军掷弹兵","Grenadier Straggler"]},{"role":"bombardier","offset":[0,-7],"title":["冻原枪手","Frost Rifleman"]}],[{"role":"duelist","offset":[6,3],"title":["近卫老兵","Old Guard Veteran"]},{"role":"breaker","offset":[-6,3],"title":["近卫老兵","Old Guard Veteran"]},{"role":"musketeer","offset":[0,-7],"title":["冻原枪手","Frost Rifleman"]}]] },
  { id: 'snowfield_raiders', region: "winter", title: ["雪原劫掠队","Snowfield Raiders"], anchor: [-267, -657], waves: [[{"role":"stalker","offset":[6,-4],"title":["哥萨克游骑","Cossack Rider"]},{"role":"lancer","offset":[-6,-4],"title":["哥萨克游骑","Cossack Rider"]},{"role":"bombardier","offset":[0,-7],"title":["雪原射手","Snow Marksman"]}],[{"role":"duelist","offset":[6,3],"title":["游骑首领","Rider Chief"]},{"role":"breaker","offset":[-6,3],"title":["游骑首领","Rider Chief"]},{"role":"musketeer","offset":[0,-7],"title":["雪原射手","Snow Marksman"]}]] },
  { id: 'moscow_outskirts', region: "winter", title: ["城郊残营","Outskirts Remnant"], anchor: [124, -766], waves: [[{"role":"stalker","offset":[6,-4],"title":["冻魂士兵","Frozen Soldier"]},{"role":"lancer","offset":[-6,-4],"title":["冻魂士兵","Frozen Soldier"]},{"role":"bombardier","offset":[0,-7],"title":["冻魂炮手","Frozen Gunner"]}],[{"role":"duelist","offset":[6,3],"title":["冻魂军官","Frozen Officer"]},{"role":"breaker","offset":[-6,3],"title":["冻魂军官","Frozen Officer"]},{"role":"musketeer","offset":[0,-7],"title":["冻魂炮手","Frozen Gunner"]}]] },
];
export const WINTER_DOMAINS: readonly DomainDef[] = [
  { id: 'frozen_chapel', region: "winter", title: ["秘境 · 冰封礼拜堂","Domain · Frozen Chapel"], center: [-150, -786], radius: 19, story: ["钟声停在了1812年的冬夜。执冬者的寒意把礼拜堂冻成了时间的牢笼。","The bells stopped on a winter night in 1812. The Winterkeeper's cold froze this chapel into a prison of time."] },
];
export const WINTER_CHESTS: readonly ChestDef[] = [
  { id: 'winter_domain_frozen_chapel', region: "winter", p: [-150, -777], tier: 'luxurious', requires: 'xp_camp_frozen_chapel' },
  { id: 'winter_camp_bivouac_pickets', region: "winter", p: [-119, -514], tier: 'precious', requires: 'xp_camp_bivouac_pickets' },
  { id: 'winter_camp_snowfield_raiders', region: "winter", p: [-267, -657], tier: 'precious', requires: 'xp_camp_snowfield_raiders' },
  { id: 'winter_camp_moscow_outskirts', region: "winter", p: [124, -766], tier: 'precious', requires: 'xp_camp_moscow_outskirts' },
  { id: 'winter_puzzle_icelens', region: "winter", p: [-104,-637], tier: 'precious', requires: 'xp_puzzle_icelens' },
  { id: 'winter_puzzle_riverprism', region: "winter", p: [82,-525], tier: 'precious', requires: 'xp_puzzle_riverprism' },
  { id: 'winter_puzzle_kremlin_wall', region: "winter", p: [-144,-849], tier: 'luxurious', requires: 'xp_puzzle_kremlin_wall' },
  { id: 'winter_trial_snow_run', region: "winter", p: [-176, -598], tier: 'exquisite', requires: 'xp_trial_snow_run' },
  { id: 'winter_trial_gorge_glide', region: "winter", p: [210, -686], tier: 'exquisite', requires: 'xp_trial_gorge_glide' },
  { id: 'winter_crossing_bank', region: "winter", p: [54, -430], tier: 'common' },
  { id: 'winter_bivouac_tent', region: "winter", p: [-204, -500], tier: 'common' },
  { id: 'winter_bivouac_wagon', region: "winter", p: [-244, -560], tier: 'common' },
  { id: 'winter_snow_pine', region: "winter", p: [-292, -730], tier: 'common' },
  { id: 'winter_snow_ridge', region: "winter", p: [-282, -808], tier: 'common' },
  { id: 'winter_field_cross', region: "winter", p: [-148, -720], tier: 'common' },
  { id: 'winter_river_bend', region: "winter", p: [106, -640], tier: 'common' },
  { id: 'winter_gorge_ice', region: "winter", p: [304, -738], tier: 'common' },
  { id: 'winter_gorge_rim', region: "winter", p: [292, -630], tier: 'common' },
  { id: 'winter_moscow_gate', region: "winter", p: [116, -862], tier: 'common' },
  { id: 'winter_moscow_lane', region: "winter", p: [58, -784], tier: 'common' },
  { id: 'winter_north_wood', region: "winter", p: [-152, -962], tier: 'common' },
  { id: 'winter_redsquare_side', region: "winter", p: [186, -956], tier: 'common' },
  { id: 'winter_west_hut', region: "winter", p: [-296, -540], tier: 'common' },
  { id: 'winter_east_hut', region: "winter", p: [292, -496], tier: 'common' },
  { id: 'winter_south_field', region: "winter", p: [-42, -552], tier: 'common' },
];
export const WINTER_FEATHERS: readonly FeatherDef[] = [
  { id: 'winter_statue', region: "winter", p: [-26, -426] },
  { id: 'winter_bivouac', region: "winter", p: [-172, -544] },
  { id: 'winter_snowfield', region: "winter", p: [-244, -704] },
  { id: 'winter_river', region: "winter", p: [46, -598] },
  { id: 'winter_gorge', region: "winter", p: [246, -722] },
  { id: 'winter_kremlin', region: "winter", p: [-64, -902] },
  { id: 'winter_moscow', region: "winter", p: [22, -840] },
  { id: 'winter_redsquare', region: "winter", p: [116, -932] },
  { id: 'winter_ice_ridge', region: "winter", p: [-304, -852] },
  { id: 'winter_east_ridge', region: "winter", p: [308, -880] },
];
