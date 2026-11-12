import { VALLEY_PROLOGUE } from './valleyPrologue';

export const WINTER_WITHDRAWAL = {
  redoubt: 'adventure_winter_redoubt_route',
  mill: 'adventure_winter_mill_route',
  retreat: 'adventure_winter_withdraw_high_ground',
} as const;

const W = WINTER_WITHDRAWAL;
export const WINTER_MILL_BRIDGE = {
  north: [62, 4.3, -613] as [number, number, number],
  south: [69, 4.25, -551] as [number, number, number],
  width: 6.8,
};

export const winterWithdrawalSelected = (done: ReadonlySet<string>) => done.has(W.redoubt) || done.has(W.mill);
export const winterWithdrawalRequired = (done: ReadonlySet<string>) => winterWithdrawalSelected(done) ||
  (done.has(VALLEY_PROLOGUE.room) && !done.has('winter_core') && !done.has('napoleon_contract') && !done.has('adventure_winter_convoy'));
export const winterWithdrawalReady = (done: ReadonlySet<string>) =>
  !winterWithdrawalRequired(done) || (winterWithdrawalSelected(done) && done.has(W.retreat));
export const WINTER_CART_PREFIX = 'adventure_cart_leg_';
export const WINTER_MILL_CART_PREFIX = 'adventure_mill_cart_leg_';
