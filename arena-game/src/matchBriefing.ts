import { bilingual } from '../../shared-client/i18n.ts';
import { MATCH_TICKS, SCORE_LIMIT, TEAM_CAPACITY, TICK_HZ, type TeamLayout } from '../shared/content.ts';

export type ArenaMode = 'offline' | 'online';
export interface MatchBriefingOptions { layout: TeamLayout; team: 'A' | 'B' | 'auto'; mode: ArenaMode; bots: boolean; }
/** Presentation only: never changes a seat, rule, connection, or saved preference. */
export function arenaMatchBriefing({ layout, team, mode, bots }: MatchBriefingOptions) {
  const capacity = TEAM_CAPACITY[layout], minutes = MATCH_TICKS / TICK_HZ / 60;
  const rules = bilingual(
    `团队先到 ${SCORE_LIMIT[layout]} 杀获胜；${minutes} 分钟到时比分高者胜，同分为平局。`,
    `First team to ${SCORE_LIMIT[layout]} kills wins; after ${minutes} minutes, higher score wins. Equal scores draw.`);
  const seats = bilingual(`西·青 ${capacity.A} 人 / 东·橙 ${capacity.B} 人`, `West/Cyan ${capacity.A} / East/Orange ${capacity.B}`);
  const selected = team === 'auto' ? bilingual('自动分队', 'automatic team') : team === 'A' ? bilingual('西·青', 'West/Cyan') : bilingual('东·橙', 'East/Orange');
  const teams = mode === 'offline'
    ? bilingual(`${seats}。你加入${selected}，其余位置由 Bot 补齐。`, `${seats}. You join ${selected}; Bots fill the other seats.`)
    : bilingual(`${seats}。偏好：${selected}；所选队伍满员时可能分到另一队。`, `${seats}. Preference: ${selected}; a full team may place you on the other side.`);
  const connection = mode === 'offline'
    ? bilingual('无需对战服务器。Esc 暂停整场单机对局，继续后才恢复。', 'No match server needed. Esc pauses the entire offline match until you resume.')
    : bilingual(`联机/LAN：使用同一服务器、地图、对局人数和补 Bot 选项。${bots ? '空位补 Bot。' : '不补 Bot；双方有人即可开局。'}Esc 只打开菜单，对局仍继续。`, `Online/LAN: use the same server, map, layout and Bot-fill option. ${bots ? 'Bots fill empty seats.' : 'No Bots; play starts when both teams have someone.'} Esc opens the menu; the match continues.`);
  return { rules, teams, connection };
}
export function arenaLimitLabel(layout: TeamLayout) {
  return bilingual(`${layout} · ${SCORE_LIMIT[layout]} 杀 / ${MATCH_TICKS / TICK_HZ / 60} 分钟`, `${layout} · ${SCORE_LIMIT[layout]} kills / ${MATCH_TICKS / TICK_HZ / 60} min`);
}
export function arenaPauseLabel(mode: ArenaMode) {
  return mode === 'online' ? bilingual('菜单 · 对局仍在继续', 'Menu · Match continues') : bilingual('已暂停', 'Paused');
}
export function arenaControlHints(k: (action: string) => string, mode: ArenaMode) {
  return bilingual(
    `${k('forward')}/${k('left')}/${k('back')}/${k('right')} 移动 · ${k('fire')} 射击 / 近战 · ${k('aim')} 按住瞄准 · ${k('jump')} 跳 · ${k('dash')} 冲刺 · ${k('shield')} 护盾 · ${k('reload')} 换弹 · ${k('crouch')} 按住下蹲 · ${k('weapon1')}/${k('weapon2')}/${k('weapon3')} 切换配装 · ${k('prevWeapon')}/${k('nextWeapon')} 循环切换 · ${k('scoreboard')} 计分板 · ${k('settings')} 设置 · Esc ${mode === 'online' ? '菜单（对局继续）' : '暂停'}`,
    `${k('forward')}/${k('left')}/${k('back')}/${k('right')} Move · ${k('fire')} Shoot / melee · ${k('aim')} Hold aim · ${k('jump')} Jump · ${k('dash')} Dash · ${k('shield')} Shield · ${k('reload')} Reload · ${k('crouch')} Hold crouch · ${k('weapon1')}/${k('weapon2')}/${k('weapon3')} Equipment slots · ${k('prevWeapon')}/${k('nextWeapon')} Cycle · ${k('scoreboard')} Scoreboard · ${k('settings')} Settings · Esc ${mode === 'online' ? 'Menu (match continues)' : 'Pause'}`);
}
