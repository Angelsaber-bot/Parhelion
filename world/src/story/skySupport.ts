import type { Localized } from '../settlements/types';

type Effect = 'cover' | 'beam' | 'pulse' | 'delay' | 'opening';
interface Support {
  title: Localized;
  line: Localized;
  unlock: string;
  effect: Effect;
  seconds: number;
  color: number;
}

export const SKY_SUPPORT = {
  saber: { title: ['Saber · 定点遮护', 'Saber · Hold cover'], line: ['Saber 守住光圈，留在圈内可挡下一次命中。', 'Saber covers the circle. Stay within it to block the next hit.'], unlock: 'saber_contract', effect: 'cover', seconds: 7, color: 0x9bbfff },
  blackbeard: { title: ['黑胡子 · 炮击牵制', 'Blackbeard · Suppressing fire'], line: ['黑胡子的炮火压住执行器，趁这段时间换位置。', 'Blackbeard pins the rig with cannon fire. Move while it is held.'], unlock: 'blackbeard_contract', effect: 'delay', seconds: 1.7, color: 0xe7a165 },
  napoleon: { title: ['拿破仑 · 掩护转移', 'Napoleon · Cover the move'], line: ['拿破仑掩护撤线，攻击预警延长。离开锁定方向。', 'Napoleon covers the withdrawal. The warning lasts longer. Leave the locked line.'], unlock: 'napoleon_contract', effect: 'delay', seconds: 2.3, color: 0xdfae75 },
  musashi: { title: ['武藏 · 接续破绽', 'Musashi · Exploit the opening'], line: ['武藏牵制露出的机构。保持射线，把握延长的破绽。', 'Musashi pins the exposed mechanism. Keep your firing angle through the longer opening.'], unlock: 'musashi_contract', effect: 'opening', seconds: 2.1, color: 0xdf9789 },
  jeanne: { title: ['贞德 · 守住恢复点', 'Jeanne · Guard the recovery point'], line: ['贞德的旗守住这一点，圈内可安全补给或转移。', 'Jeanne holds the rally point. Resupply or move under her cover.'], unlock: 'journey_orleans_crossing_open', effect: 'cover', seconds: 9, color: 0xe9dfab },
  ozymandias: { title: ['奥斯曼迪斯 · 遮断射线', 'Ozymandias · Interrupt the beam'], line: ['日光遮断器已架好。留在圈内可挡住一束射线。', 'The sun screen is in place. Stay within the circle to block a beam.'], unlock: 'journey_egypt_water_returned', effect: 'beam', seconds: 8, color: 0xf3c375 },
  qinShiHuang: { title: ['秦始皇 · 稳住回廊', 'Qin Shi Huang · Brace the deck'], line: ['支架稳住短连接。留在圈内可抵御一次范围震荡。', 'The brace steadies the deck. Stay within the circle to withstand one pulse.'], unlock: 'journey_qin_public_order', effect: 'pulse', seconds: 9, color: 0x82d4bc },
} satisfies Record<string, Support>;

export type SkySupporter = keyof typeof SKY_SUPPORT;
export const SKY_SUPPORTERS = Object.keys(SKY_SUPPORT) as SkySupporter[];
export const skySupportFlag = (id: SkySupporter) => 'journey_helion_aid_' + id;
export const SKY_SHUTTER_FLAGS = ['journey_helion_west_turned', 'journey_helion_east_turned'] as const;
export const SKY_SUPPORT_RADIUS = 4.8;
