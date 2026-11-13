import type { AdventureAction } from './adventureSites';
import type { Localized } from '../settlements/types';
import { flagshipPoint as P } from '../map/shipInteriorCut';

/** Independent structural checkpoints: inspecting a dock never lowers a bridge. */
export const FLAGSHIP_WORKS = {
  inspect: 'adventure_flagship_bearing',
  winch: 'adventure_flagship_winch',
  release: 'adventure_flagship_collar',
  pin: 'adventure_flagship_collar_pin',
} as const;
const F = FLAGSHIP_WORKS;
export const FLAGSHIP_WORK_IDS = new Set<string>(Object.values(F));
export const flagshipBridgeLowered = (done: ReadonlySet<string>) => done.has(F.winch) && (done.has(F.release) || done.has(F.pin));
export function flagshipWorkBlock(id: string, done: ReadonlySet<string>): Localized | null {
  if (!FLAGSHIP_WORK_IDS.has(id) || id === F.inspect) return null;
  if (!done.has(F.inspect)) return ['先查看承重图，辨认吊索、桅杆桥和保险扣。', 'Inspect the load diagram and identify the hoist, mast bridge and safety collar first.'];
  if ((id === F.release || id === F.pin) && !done.has(F.winch)) return ['先在后绞盘收紧承重索，再松开保险扣；侧边检修桥仍然能走。', 'Take the load on the aft winch before releasing the collar. The maintenance bridge remains open.'];
  return null;
}
export const FLAGSHIP_WORK_LINES: Record<string, Localized> = {
  [F.inspect]: ['吊架抬起了旗舰。旧桅杆仍由保险扣悬住；先收紧后绞盘承重索，再到前吊臂松扣，桅杆桥与船体将受控下降。下方承接网两端都有返回楼梯。', 'The hoist lifts the flagship. Take the old mast’s weight on the aft winch, then release the forward collar to lower both bridge and hull. Both ends of the catch-net have return stairs.'],
  [F.winch]: ['承重索已张紧，保险扣卸载。去前吊臂手动松扣，或射断金色销；不需要消耗弹药也能完成。', 'The load line is taut and the collar is unloaded. Release it by hand at the forward crane, or shoot its gold pin. Ammunition is optional.'],
  [F.release]: ['保险扣打开，旧桅杆与旗舰缓缓落下。等船体落稳、两端拦杆收起，再沿桅杆桥上船。', 'The collar opens and the mast and flagship lower. Wait for the hull to settle and both safety rails to withdraw, then cross to the ship.'],
  [F.pin]: ['保险销断开，桅杆由承重索控制着落下。等拦杆收起再通过。', 'The pin breaks and the load line controls the mast’s descent. Wait for the safety rails to withdraw before crossing.'],
};
export const FLAGSHIP_WORK_ACTIONS: readonly AdventureAction[] = [
  { id: F.inspect, region: 'blacksail', label: ['吊装台 · 查看承重图', 'Lifting dock · Read the load diagram'], p: P(0, -16.2, 14), flag: F.inspect },
  { id: F.winch, region: 'blacksail', label: ['后绞盘 · 接住桅杆重量', 'Aft winch · Take the mast’s weight'], p: P(12.2, -16.1, 14), seconds: 3, flag: F.winch },
  { id: F.release, region: 'blacksail', label: ['前吊臂 · 松开保险扣', 'Forward crane · Release the safety collar'], p: P(-12.1, -16.1, 14), seconds: 2, flag: F.release },
];
