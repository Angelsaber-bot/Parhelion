import type { FieldAction, FieldChapterContent } from './fieldChapters';
import { EGYPT_CAMPAIGN as EC } from './egyptCampaign';

/** Egypt's dedicated beats: the Tide-Eater limb follows the strongest jet (shell it, then divert it —
 * fighting it remains the harder option); the stone-armour rig choice before the temple fight;
 * and E07's formal departure with a sun-boat or high-path approach to the confluence. */
export const EA = {
  shell: 'e03_limb_shell', divert: 'e03_limb_divert', high: 'e04_rig_high', low: 'e04_rig_low',
  launch: 'e07_launch', boat: 'e07_boat', boatShotA: 'e07_boat_shot_a', boatShotB: 'e07_boat_shot_b', boatLand: 'e07_boat_land',
  walk: 'e07_high_path', arrived: 'e07_arrived',
} as const;
const A = EA;
const climaxDone = (d: ReadonlySet<string>) => d.has('realm_egypt_phase_1') || d.has('journey_egypt_water_returned');
export const egyptApproachRequired = (d: ReadonlySet<string>) => d.has(EC.ready) && !climaxDone(d);
const a = (chapter: string, x: Omit<FieldAction, 'region' | 'chapter'>): FieldAction => ({ region: 'egypt', chapter, ...x });
export const EGYPT_APPROACH_ACTIONS: readonly FieldAction[] = [
  a('E03', { id: A.shell, near: 'egypt_campaign_limb', off: [-6, 3], kind: 'shot', after: [EC.started], gate: d => !d.has(EC.limb),
    label: ['异常喷口 · 打掉堵塞的甲壳', 'Anomalous jet · Shoot off the clogging shell'],
    line: ['甲片落进普通侧池就散开了，在带黑色细丝的喷口边却又慢慢凝起来。', 'The plates scatter in the ordinary side pool, but slowly gather again at the jet threaded with black filaments.'] }),
  a('E03', { id: A.divert, near: 'egypt_campaign_limb', off: [5, -4], after: [A.shell], gate: d => !d.has(EC.limb), adds: [EC.limb],
    label: ['侧泄口 · 放水把吞潮肢体引走', 'Side outlet · Release water to draw the limb away'],
    line: ['肢体跟着最强的喷流转身，离开了干床。你从另一侧过去，一发弹药都没多花。压差引它移动，异常水让它结壳。', 'The limb turns after the strongest jet and leaves the dry bed. You cross on the other side without spending a round. Pressure moves it; anomalous water armours it.'] }),
  a('E04', { id: A.high, near: 'egypt_solar_boat_temple', off: [6, 6], alt: 'e04_rig', after: [EC.limb], gate: d => !d.has(EC.temple),
    label: ['祭舟浮架 · 锁在高位当射击平台', 'Ritual-boat float · Lock it high as a firing platform'],
    line: ['浮架锁在高位。石甲群从下面来，你在上面看得清它们的接缝。', 'The float locks high. The stone-armoured pack comes from below, and from up here their seams are plain.'] }),
  a('E04', { id: A.low, near: 'egypt_solar_boat_temple', off: [-6, 6], alt: 'e04_rig', after: [EC.limb], gate: d => !d.has(EC.temple),
    label: ['祭舟浮架 · 降下当地面掩体', 'Ritual-boat float · Lower it as ground cover'],
    line: ['浮架落在维修层地面，成了一道矮墙。石甲只能绕着它走。', 'The float settles on the service floor as a low wall. The stone armour has to go round it.'] }),
  a('E07', { id: A.launch, near: 'egypt_campaign_relocated', off: [4, 4], gate: egyptApproachRequired,
    label: ['工程台 · 正式出发', 'Engineering table · Set out'],
    line: ['方案就此锁定。“把吞潮引到泄洪口，打开新的河床。”可以乘太阳舟沿新浅水段过去，也可以走神庙那边开出的高位检修路。', 'The plan is locked. “Draw the Tide-Eater to the spillway and open the new bed.” Take the sun-boat down the new shallows, or the high service path opened from the temple.'] }),
  a('E07', { id: A.boat, near: 'egypt_solar_boat_lower', off: [3, -4], kind: 'work', seconds: 8, alt: 'e07_way', after: [A.launch], gate: egyptApproachRequired,
    label: ['太阳舟 · 沿新浅水段驶向汇水台', 'Sun-boat · Run the new shallows to the confluence'],
    line: ['船身贴着新河床滑下去。两岸有东西在动。', 'The hull slides down the new bed. Something moves on both banks.'] }),
  a('E07', { id: A.boatShotA, near: 'egypt_waterwheel_lift_lower', off: [0, -6], kind: 'shot', after: [A.boat], gate: egyptApproachRequired,
    label: ['左岸 · 打掉扑上来的甲壳', 'Left bank · Shoot the shell lunging in'], line: ['左岸清了。', 'Left bank clear.'] }),
  a('E07', { id: A.boatShotB, near: 'realm_egypt_west', off: [-4, 8], kind: 'shot', after: [A.boat], gate: egyptApproachRequired,
    label: ['右岸 · 打掉第二块甲壳', 'Right bank · Shoot the second shell'], line: ['右岸也清了，船靠上高岸。', 'The right bank is clear too, and the boat noses in to the high bank.'] }),
  a('E07', { id: A.boatLand, near: 'realm_egypt_start', off: [-6, 6], after: [A.boatShotA, A.boatShotB], gate: egyptApproachRequired, adds: [A.arrived],
    label: ['高岸 · 下船', 'High bank · Step ashore'],
    line: ['舟行给了你一条移动的侧翼。汇水台就在前面。', 'The boat gave you a moving flank. The confluence is right ahead.'] }),
  a('E07', { id: A.walk, near: 'realm_egypt_start', off: [6, 6], alt: 'e07_way', after: [A.launch], gate: egyptApproachRequired, adds: [A.arrived],
    label: ['高位检修路 · 走到汇水台上方', 'High service path · Walk in above the confluence'],
    line: ['你从检修路上方进来，脚下是稳定的高地。', 'You enter from the service path above, on steady high ground.'] }),
];
export const EGYPT_APPROACH: FieldChapterContent = {
  set: { region: 'egypt', title: ['埃及 · 尼罗河的第二次黎明', 'Egypt · The Nile’s Second Dawn'], actions: EGYPT_APPROACH_ACTIONS },
  props: [
    { at: A.shell, off: [0, 1.2, -2], size: [1.4, 1.1, .6], color: 0x2f3a3a, target: A.shell },
    { at: A.shell, off: [1.5, .2, 1], size: [.6, .15, .4], color: 0x3f4a48, show: d => d.has(A.shell) },
    { at: A.divert, off: [1, .7, 0], size: [.5, .9, .5], color: 0xc2a462 },
    { at: A.high, off: [0, 3, -3], size: [3.4, .35, 2.2], color: 0x8a6a3e, show: d => !d.has(A.low), moved: { when: A.high, off: [0, 3.8, -3] } },
    { at: A.low, off: [0, .5, -3], size: [3.4, 1, .4], color: 0x8a6a3e, show: d => d.has(A.low) },
    { at: A.boatShotA, off: [0, 1, 0], size: [1, .8, .8], color: 0x2f3a3a, target: A.boatShotA },
    { at: A.boatShotB, off: [0, 1, 0], size: [1, .8, .8], color: 0x2f3a3a, target: A.boatShotB },
    { at: A.launch, off: [1.2, .9, 0], size: [1.4, .12, 1], color: 0x9b7b4b },
  ],
  actors: [
    { id: 'e_works_hand', role: ['工程队 · 现场接管', 'Works crew · Taking over'], coat: 0xc9b48a,
      place: d => d.has(EC.temple) && !d.has(EC.bed) ? [A.high, 2, -1] : d.has(A.launch) && !d.has(A.arrived) ? [A.launch, 2, 1] : null },
  ],
};
