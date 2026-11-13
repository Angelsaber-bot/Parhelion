import type { Localized } from '../settlements/types';

export const EGYPT_WATER_PLAN = {
  marker: 'egypt_water_plan_table', locked: 'egypt_water_plan_departed',
  backup: 'parhelion.world.egypt.predeparture.v1',
} as const;
export const EGYPT_WATER_OPTIONS = {
  westBridge: {
    label: ['西线 · 港口高桥', 'West · Harbor high bridge'],
    description: ['保留旧港大船作业，架设港口高桥。西支流淹过旧大道，拆去旧堤段并以步行桥接回两端。新田仅保留基础灌溉；仓下捷径不开放。',
      'Keep large-boat operations and build the harbor high bridge. The west diversion replaces a section of the old avenue with a footbridge. Fields retain basic irrigation; the warehouse shortcut stays closed.'],
  },
  westStore: {
    label: ['西线 · 仓下通道', 'West · Warehouse passage'],
    description: ['保留旧港大船作业，打通货栈下的南北捷径。西支流淹过旧大道，拆去旧堤段并以步行桥接回两端；不另建港口高桥，新田仅保留基础灌溉。',
      'Keep large-boat operations and open the warehouse passage. The west diversion replaces a section of the old avenue with a footbridge. No additional harbor high bridge is built; fields retain basic irrigation.'],
  },
  eastBridge: {
    label: ['东线 · 跨田桥', 'East · Field bridge'],
    description: ['引水进入新田，架设跨田桥。旧大道保留；旧港保留饮水与小船作业，深吃水货船退出，仓前空地改作干集；汇水台不增加挡浪板。',
      'Feed the fields and build their crossing. Keep the old avenue. The harbor retains drinking water and small boats; deep-draft freight leaves, and the warehouse apron becomes a dry market. No extra surge baffle is installed.'],
  },
  eastBaffle: {
    label: ['东线 · 挡浪板', 'East · Surge baffle'],
    description: ['引水进入新田，在汇水台安装可避水击的挡浪板。旧大道保留；旧港仅留饮水和小船，仓前空地改作干集；田间走原有堤路。',
      'Feed the fields and install a baffle that shelters its lee from water strikes. Keep the old avenue; the harbor retains drinking water and small boats, with a dry market at the warehouses. Use the existing field banks.'],
  },
  balanced: {
    label: ['均分 · 保留两岸旧路', 'Balanced · Retain both bank routes'],
    description: ['两岸保留基础供水、小船和现有堤路。此次不增建港口高桥、仓下捷径、跨田桥或挡浪板。',
      'Keep basic water, small boats and existing bank routes on both sides. Build neither specialized bridge, warehouse shortcut nor surge baffle.'],
  },
} satisfies Record<string, { label: Localized; description: Localized }>;
export type EgyptWaterOption = keyof typeof EGYPT_WATER_OPTIONS;
export const EGYPT_WATER_IDS = Object.keys(EGYPT_WATER_OPTIONS) as EgyptWaterOption[];
export const egyptWaterFlag = (option: EgyptWaterOption) => `egypt_water_plan_${option}`;
export function selectedEgyptWaterPlan(done: ReadonlySet<string>): EgyptWaterOption | null {
  return EGYPT_WATER_IDS.find(option => done.has(egyptWaterFlag(option))) ?? null;
}
/** Change only the finite construction choice. Shared preparation is retained. */
export function setEgyptWaterPlan(done: Set<string>, option: EgyptWaterOption) {
  if (done.has(EGYPT_WATER_PLAN.locked)) return false;
  for (const id of EGYPT_WATER_IDS) done.delete(egyptWaterFlag(id));
  done.add(egyptWaterFlag(option)); return true;
}
