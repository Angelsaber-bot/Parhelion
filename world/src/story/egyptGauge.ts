import type { Localized } from '../settlements/types';

export const EGYPT_WATER_RECORD = 'journey_egypt_riverbed';
export const EGYPT_GAUGE = {
  trace: 'egypt_gauge_trace',
  align: 'egypt_gauge_align',
  report: 'egypt_gauge_report',
} as const;
export const EGYPT_GAUGE_TITLE: Localized = ['旧水尺的第二刻度', 'The Second Mark'];
export const EGYPT_GAUGE_KEEPER: Localized = ['河工帕赫', 'Pahek, river keeper'];

const G = EGYPT_GAUGE;
export const EGYPT_GAUGE_STEPS = [
  { id: G.trace, label: ['绿洲旧墙 · 查验湿痕', 'Oasis wall · Inspect the water stains'],
    hint: ['到搁浅船旁找一道反常湿痕。', 'Look for a strange water stain near the stranded boat.'] },
  { id: G.align, label: ['低井 · 校准旧水尺', 'Low well · Align the old gauge'],
    hint: ['沿潮痕找到低井，把水尺对到仍在往上渗水的那条痕迹。', 'Follow the damp stones to the low well and align the gauge with the mark where water still creeps upward.'] },
  { id: G.report, label: ['河工帕赫 · 交接读数', 'Pahek · Share the reading'],
    hint: ['和井边的帕赫一起核对提前出现的读数。', 'Check the early reading with Pahek beside the well.'] },
] as const;
export type EgyptGaugeAction = typeof EGYPT_GAUGE_STEPS[number]['id'];
export const EGYPT_GAUGE_BY_ID = new Map<string, typeof EGYPT_GAUGE_STEPS[number]>(EGYPT_GAUGE_STEPS.map(step => [step.id, step]));
export const EGYPT_GAUGE_CHOICES = [
  { id: 'salt', label: ['上层干白的盐线', 'The high, dry salt line'] },
  { id: 'seep', label: ['中层潮湿的渗水线', 'The damp seep line in the middle'] },
  { id: 'silt', label: ['井底平直的泥线', 'The low, level silt line'] },
] satisfies { id: string; label: Localized }[];

export function egyptGaugeNext(done: ReadonlySet<string>) {
  if (!done.has(EGYPT_WATER_RECORD)) return null;
  return EGYPT_GAUGE_STEPS.find(step => !done.has(step.id)) ?? null;
}
