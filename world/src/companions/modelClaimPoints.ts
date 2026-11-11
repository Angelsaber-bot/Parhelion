import type { Marker } from '../core/types';
import type { ExpansionRegionId } from '../core/regionIdentity';
import type { Localized } from '../settlements/types';
import type { ModelCompanionId } from '../characters/catalog';

interface ModelClaimPoint {
  id: ModelCompanionId;
  region: ExpansionRegionId;
  title: Localized;
  label: Localized;
  hint: Localized;
  marker: Marker;
}

/** Shared by physical interactions and quest navigation. Keep the existing hub positions. */
export const MODEL_CLAIM_POINTS: readonly ModelClaimPoint[] = [
  {
    id: 'jeanne', region: 'orleans',
    title: ['从者领取 · 贞德', 'Claim servant · Jeanne'],
    label: ['奥尔良 · 守城集市 · 贞德领取点', 'Orleans · Defenders Market · Jeanne claim point'],
    hint: ['沿大陆西北方向前往奥尔良守城集市，跟随金色标记到领取点，靠近后按交互键领取贞德。', 'Follow the world roads northwest to the Defenders Market in Orleans. Follow the gold marker and interact at the claim point to claim Jeanne.'],
    marker: { id: 'servant_claim_jeanne', type: 'interact', label: '奥尔良 · 贞德领取点', p: [-800, 14, -1350], radius: 7, note: 'Jeanne claim point' },
  },
  {
    id: 'ozymandias', region: 'egypt',
    title: ['从者领取 · 奥斯曼迪斯（奥兹曼迪亚斯）', 'Claim servant · Ozymandias'],
    label: ['古埃及 · 商队绿洲 · 奥斯曼迪斯领取点', 'Solar Egypt · Caravan Oasis · Ozymandias claim point'],
    hint: ['前往大陆北部古埃及的商队绿洲，跟随金色标记到领取点，靠近后按交互键领取奥斯曼迪斯。', 'Follow the world roads to the Caravan Oasis in Solar Egypt, in the north of the continent. Follow the gold marker and interact at the claim point to claim Ozymandias.'],
    marker: { id: 'servant_claim_ozymandias', type: 'interact', label: '古埃及 · 奥斯曼迪斯领取点', p: [165, 14, -1550], radius: 7, note: 'Ozymandias claim point' },
  },
  {
    id: 'qinShiHuang', region: 'qin',
    title: ['从者领取 · 秦始皇', 'Claim servant · Qin Shi Huang'],
    label: ['秦地 · 骊山工匠集镇 · 秦始皇领取点', 'Qin · Lishan Artisan Town · Qin Shi Huang claim point'],
    hint: ['前往大陆西部秦地的骊山工匠集镇，领取点在地面集镇，不必进入地下陵墓。跟随金色标记，靠近后按交互键领取秦始皇。', 'Follow the world roads to Lishan Artisan Town in Qin, in the west of the continent. The claim point is in the surface town, not the underground tomb. Follow the gold marker and interact to claim Qin Shi Huang.'],
    marker: { id: 'servant_claim_qin', type: 'interact', label: '秦地 · 始皇帝领取点', p: [-535, 22, -820], radius: 7, note: 'Qin Shi Huang claim point' },
  },
];
