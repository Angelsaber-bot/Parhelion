/**
 * 落日王国主线 · 卡姆兰先锋 (The Road to Camlann). Once the first oath hearth is lit, the march
 * south from the Round Table Hall to the Sun Core crosses three story fights in order: the dead
 * of Camlann rise to hold the road, and Saber names what each line once was. The last stand ends on
 * an echo warden (a Britain shieldbearer whose tower shield turns on after its stance break).
 * Anchors are flat ground clear of colliders, 40 m+ from wild spawns and 30 m+ from other sites.
 */
import type { CampDef, ChestDef } from '../catalog';

const wraith = ['卡姆兰亡骑', 'Camlann Wraith'] as [string, string];
const flag = (id: string) => `xp_camp_${id}`;

export const VANGUARD_CAMPS: readonly CampDef[] = [
  { id: 'vanguard_first_line', region: 'britain', style: 'vanguard', requires: 'hall_brazier_1', title: ['卡姆兰先锋 · 第一道战线', 'Road to Camlann · The First Line'], anchor: [-946, -50],
    lines: {
      start: ['Saber：「这些骑士……曾在我的旗下冲锋。卡姆兰的号角还在召唤他们。」', 'Saber: "These knights once charged beneath my banner. Camlann\'s horn still calls them."'],
      end: ['Saber：「让他们安息吧。继续向南，号角声是从王座那边传来的。」', 'Saber: "Let them rest. On to the south: the horn sounds from the throne."'],
    },
    waves: [
      [{ role: 'lancer', offset: [6, -3], title: ['亡骑枪兵', 'Wraith Lancer'] }, { role: 'lancer', offset: [-6, -3], title: ['亡骑枪兵', 'Wraith Lancer'] }, { role: 'bombardier', offset: [0, -7], title: ['亡骑弩手', 'Wraith Crossbow'] }],
      [{ role: 'shieldbearer', offset: [0, 6], title: ['亡骑盾卫', 'Wraith Shieldbearer'] }, { role: 'duelist', offset: [6, -4], title: wraith }, { role: 'stalker', offset: [-6, -4], title: ['亡骑斥候', 'Wraith Outrider'] }],
    ] },
  { id: 'vanguard_broken_banner', region: 'britain', style: 'vanguard', requires: flag('vanguard_first_line'), title: ['卡姆兰先锋 · 断旗渡口', 'Road to Camlann · Broken Banner Ford'], anchor: [-962, 80],
    lines: {
      start: ['Saber：「他们在列阵拖住我们。空位之王怕的不是你的枪，是我们走到王座前。」', 'Saber: "They form ranks to hold us. The Vacant King fears not your rifle, but us reaching the throne."'],
      end: ['Saber：「旗还在一面面倒下……王座不远了。」', 'Saber: "The banners keep falling... the throne is close."'],
    },
    waves: [
      [{ role: 'stalker', offset: [5, 4], title: ['亡骑斥候', 'Wraith Outrider'] }, { role: 'stalker', offset: [-5, 4], title: ['亡骑斥候', 'Wraith Outrider'] }, { role: 'shieldbearer', offset: [0, -7], title: ['断旗旗手', 'Broken Banner Bearer'] }],
      [{ role: 'breaker', offset: [6, 3], title: ['亡骑重甲', 'Wraith Juggernaut'] }, { role: 'lancer', offset: [-6, 3], title: ['亡骑枪兵', 'Wraith Lancer'] }, { role: 'bombardier', offset: [0, -7], title: ['亡骑弩手', 'Wraith Crossbow'] }],
    ] },
  { id: 'vanguard_throne_guard', region: 'britain', style: 'vanguard', requires: flag('vanguard_broken_banner'), title: ['卡姆兰先锋 · 王座前卫', 'Road to Camlann · Guard of the Empty Throne'], anchor: [-995, 126],
    lines: {
      start: ['Saber：「……那个身影，我认得。别犹豫，它只是回声。」', 'Saber: "...I know that silhouette. Do not hesitate. It is only an echo."'],
      end: ['Saber：「卡姆兰就在前面。空位之王——这一次，由我们来结束。」', 'Saber: "Camlann lies ahead. Vacant King — this time, we end it."'],
    },
    waves: [
      [{ role: 'shieldbearer', offset: [6, -4], title: ['王座盾卫', 'Throne Shield'] }, { role: 'shieldbearer', offset: [-6, -4], title: ['王座盾卫', 'Throne Shield'] }, { role: 'bombardier', offset: [0, -7], title: ['亡骑弩手', 'Wraith Crossbow'] }],
      [{ role: 'duelist', offset: [7, 2.5], title: wraith }, { role: 'lancer', offset: [-7, 2.5], title: ['亡骑枪兵', 'Wraith Lancer'] }, { role: 'breaker', offset: [0, -7], title: ['亡骑重甲', 'Wraith Juggernaut'] }],
      [{ role: 'shieldbearer', offset: [0, -6], title: ['叛誓之子的残影', "Echo of the Oathbreaker's Son"], pattern: 'echo-warden' }, { role: 'duelist', offset: [6, 4], title: wraith }, { role: 'duelist', offset: [-6, 4], title: wraith }],
    ] },
];

export const VANGUARD_CHESTS: readonly ChestDef[] = [
  { id: 'britain_vanguard_throne', region: 'britain', p: [-995, 135.5], tier: 'precious', requires: flag('vanguard_throne_guard') },
];
