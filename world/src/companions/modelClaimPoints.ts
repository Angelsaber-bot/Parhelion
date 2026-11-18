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

/** Where each servant waits; their contract arcs (story/servantPacts.ts) start and end here. Ids are the contract flags. */
export const MODEL_CLAIM_POINTS: readonly ModelClaimPoint[] = [
  {
    id: 'jeanne', region: 'orleans',
    title: ['从者契约 · 贞德', 'Servant pact · Jeanne'],
    label: ['奥尔良 · 守城集市 · 贞德', 'Orleans · Defenders Market · Jeanne'],
    hint: ['奥尔良主线完成后，到守城集市见贞德，开始她的契约（证言审理）。', 'After the Orleans main story, meet Jeanne at the Defenders Market to begin her pact (the testimony tribunal).'],
    marker: { id: 'servant_claim_jeanne', type: 'interact', label: '奥尔良 · 贞德', p: [-800, 14, -1350], radius: 7, note: 'Jeanne claim point' },
  },
  {
    id: 'ozymandias', region: 'egypt',
    title: ['从者契约 · 奥斯曼迪斯（奥兹曼迪亚斯）', 'Servant pact · Ozymandias'],
    label: ['古埃及 · 商队绿洲 · 奥斯曼迪斯', 'Solar Egypt · Caravan Oasis · Ozymandias'],
    hint: ['古埃及的河水恢复后，到商队绿洲觐见奥斯曼迪斯，开始他的契约（王名寻迹）。', 'Once the waters of Solar Egypt flow again, attend Ozymandias at the Caravan Oasis to begin his pact (the name hunt).'],
    marker: { id: 'servant_claim_ozymandias', type: 'interact', label: '古埃及 · 奥斯曼迪斯', p: [165, 14, -1550], radius: 7, note: 'Ozymandias claim point' },
  },
  {
    id: 'qinShiHuang', region: 'qin',
    title: ['从者契约 · 秦始皇', 'Servant pact · Qin Shi Huang'],
    label: ['秦地 · 骊山工匠集镇 · 秦始皇', 'Qin · Lishan Artisan Town · Qin Shi Huang'],
    hint: ['秦地主线完成后，到骊山工匠集镇见始皇帝，开始他的契约（驰道传诏）。', 'After the Qin main story, meet the First Emperor at Lishan Artisan Town to begin his pact (the imperial road).'],
    marker: { id: 'servant_claim_qin', type: 'interact', label: '秦地 · 始皇帝', p: [-535, 22, -820], radius: 7, note: 'Qin Shi Huang claim point' },
  },
];
