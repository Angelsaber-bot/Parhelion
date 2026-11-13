import type { Localized } from '../settlements/types';
export const WINTER_CUSTOMS_WORKS = {
  cart: 'winter_customs_cart_release', pin: 'winter_customs_cart_brace',
  westAmmo: 'winter_customs_west_ammo', eastAmmo: 'winter_customs_east_ammo',
} as const;
export const WINTER_CUSTOMS_LABELS = new Map<string, Localized>([
  [WINTER_CUSTOMS_WORKS.cart, ['空粮车 · 解除轮挡', 'Empty grain cart · Release the wheel chock']],
  [WINTER_CUSTOMS_WORKS.westAmmo, ['仓房外补给箱 · 补充基础弹药', 'Warehouse cache · Refill basic ammunition']],
  [WINTER_CUSTOMS_WORKS.eastAmmo, ['关卡侧补给箱 · 补充基础弹药', 'Checkpoint cache · Refill basic ammunition']],
]);
export const winterCustomsCartReleased = (done: ReadonlySet<string>) => done.has(WINTER_CUSTOMS_WORKS.cart) || done.has(WINTER_CUSTOMS_WORKS.pin);
