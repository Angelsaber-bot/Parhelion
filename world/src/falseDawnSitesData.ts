/** Pure audited coordinates: safe for narrative/combat imports, no renderer dependencies. */
type V3=[number,number,number];
export type FalseDawnFieldId='alpha'|'blacksail'|'winter';
export const FALSE_DAWN_CENTERS:Readonly<Record<FalseDawnFieldId,V3>>=Object.freeze({alpha:[-52,3.642009056275299,-100],blacksail:[794,13.275502898034403,32],winter:[68,4.21505470550386,-628]});
export const FALSE_DAWN_ANCHORS:readonly V3[]=[[-59,3.977272086984698,-105],[-45,4.1914434830981975,-105],[-52,3.3727104581010395,-93]];
export const FALSE_DAWN_ACTOR_OFFSETS:readonly [number,number][]=[[-2,2],[2,2],[0,5]];
