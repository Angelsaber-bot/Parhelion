/** A presentation-only bridge into the existing offline lobby. No save, loadout,
 * network, reward or simulation mutation. The user still chooses Start there.
 * arena-game/src/main.ts reads mode=online explicitly; all other values are offline.
 */
export const ARENA_TRAINING_HREF = '/arena/?mode=offline';
export type BridgeText = readonly [string, string];
export interface ArenaBridgeRow { readonly id: string; readonly title: BridgeText; readonly world: BridgeText; readonly arena: BridgeText }
export interface ArenaTrainingBriefing {
  readonly title: BridgeText;
  readonly introduction: BridgeText;
  readonly rows: readonly ArenaBridgeRow[];
  readonly practice: readonly BridgeText[];
  readonly warning: BridgeText;
  readonly fairness: BridgeText;
}
/** Pass live SettingsStore.label callbacks for BOTH modes: never hard-code keys
 * or copy World bindings over the player's independently saved Arena controls.
 * Consumers render these strings as text, not HTML.
 */
export function arenaTrainingBriefing(worldKey: (action: string) => string, arenaKey: (action: string) => string): ArenaTrainingBriefing {
  const row = (id: string, title: BridgeText, world: BridgeText, arena: BridgeText): ArenaBridgeRow => ({ id, title, world, arena });
  return {
    title: ['竞技场战术模拟', 'Arena tactical simulation'],
    introduction: ['在新标签打开离线竞技场大厅，选择简单 Bot 并点击开始；此处不会自动开局。世界现场留在本页，回来后继续。', 'Open the offline Arena lobby in a new tab, choose Easy bots and press Start. Nothing starts automatically. Your World session stays in this tab.'],
    rows: [
      row('aim', ['瞄准与射击', 'Aim and fire'], [`${worldKey('aim')} 瞄准 · ${worldKey('fire')} 射击`, `${worldKey('aim')} aim · ${worldKey('fire')} fire`], [`${arenaKey('aim')} 瞄准 · ${arenaKey('fire')} 射击`, `${arenaKey('aim')} aim · ${arenaKey('fire')} fire`]),
      row('movement', ['机动方式不同', 'Different movement tools'], [`${worldKey('sprint')} 奔跑 · ${worldKey('evade')} 闪避`, `${worldKey('sprint')} sprint · ${worldKey('evade')} evade`], [`${arenaKey('dash')} 冲刺；不是持续奔跑`, `${arenaKey('dash')} dash, not sustained sprint`]),
      row('defense', ['技能不通用', 'Different abilities'], [`${worldKey('skill')} 当前战技 · ${worldKey('ultimate')} 终结技`, `${worldKey('skill')} current skill · ${worldKey('ultimate')} ultimate`], [`${arenaKey('shield')} 护盾；不携带从者宝具`, `${arenaKey('shield')} shield; no companion ultimate transfer`]),
      row('melee', ['近战操作不同', 'Different melee input'], [`${worldKey('melee')} 近战连击`, `${worldKey('melee')} melee combo`], [`${arenaKey('weapon3')} 选近战槽，再按 ${arenaKey('fire')} 攻击`, `${arenaKey('weapon3')} selects melee, then ${arenaKey('fire')} attacks`]),
      row('loadout', ['枪械与装填', 'Weapons and reload'], ['原有世界枪械与进度保持不变', 'Your existing World weapon and progress stay unchanged'], [`${arenaKey('weapon1')} / ${arenaKey('weapon2')} 两把枪 · ${arenaKey('reload')} 装填；在大厅选择配装`, `${arenaKey('weapon1')} / ${arenaKey('weapon2')} two guns · ${arenaKey('reload')} reload; choose your loadout in the lobby`]),
    ],
    practice: [
      ['先在大厅查看两把枪与近战槽，再用简单 Bot 熟悉射击与装填。', 'Review the two guns and melee slot in the lobby, then practise firing and reloading against Easy bots.'],
      ['利用掩体侧移，试一次冲刺与护盾，再切近战；这是练习建议，不会自动判定或发奖励。', 'Strafe around cover, try a dash and shield, then switch to melee. These are practice suggestions, not automatic objectives or rewards.'],
    ],
    warning: [`两种模式按键分别保存。回到世界后：${worldKey('reset')} 是重置进度确认，${[1,2,3].map(n => worldKey(`teleport${n}`)).join(' / ')} 是调试传送，不是装填或换枪。`, `Controls are saved separately. Back in World, ${worldKey('reset')} opens reset confirmation and ${[1,2,3].map(n => worldKey(`teleport${n}`)).join(' / ')} are debug teleports, not reload or weapon slots.`],
    fairness: ['世界等级、从者、能量与解锁不会转换成竞技场伤害或装备优势；离线练习和联机竞技仍使用竞技场自己的规则。', 'World progression, companions, energy and unlocks grant no Arena damage or equipment advantage. Offline practice and online play retain Arena rules.'],
  };
}
