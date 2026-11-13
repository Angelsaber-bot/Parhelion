import type { Localized } from '../settlements/types';

export const EGYPT_TEMPLE_WORKS_STATE = {
  specimen: 'egypt_temple_gate_specimen', learned: 'egypt_temple_gate_observed',
  lower: 'egypt_temple_barge_lower_control', upper: 'egypt_temple_barge_upper_control',
  aboard: 'egypt_temple_barge_deck_control', raised: 'egypt_temple_barge_raised',
  seepage: 'egypt_temple_seepage_valve', sideLatch: 'egypt_temple_side_latch', shortcut: 'egypt_temple_service_shortcut',
} as const;
const S = EGYPT_TEMPLE_WORKS_STATE;
export const EGYPT_TEMPLE_WORK_LABELS = new Map<string, Localized>([
  [S.specimen, ['闸门试件 · 演示落翼与中门', 'Gate specimen · Demonstrate wings and center gate']],
  [S.seepage, ['日纹定流阀 · 暂停渗流并抬起侧门', 'Sun-marked valve · Arrest seepage and lift the side gate']],
  [S.sideLatch, ['侧门止回销 · 固定检修捷径', 'Side gate pin · Secure the maintenance shortcut']],
  ...[S.lower, S.upper, S.aboard].map(id => [id,
    ['祭舟浮架 · 切换高位平台与低位掩体', 'Ceremonial barge · Switch between upper platform and lower cover'] as Localized] as const),
]);
