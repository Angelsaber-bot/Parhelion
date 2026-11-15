/**
 * Enemy name plates are sized in metres so they read across a field; in a brawl the same plate filled half
 * the screen. Inside `fullBeyond` metres of the camera a plate holds the on-screen size it had at that range.
 */
export const NAMEPLATE = Object.freeze({ fullBeyond: 7, min: .3 });
/** Scale for an overhead name `distance` metres (horizontal) from the camera. */
export function nameplateScale(distance: number) { return Number.isFinite(distance) ? Math.min(1, Math.max(NAMEPLATE.min, distance / NAMEPLATE.fullBeyond)) : 1; }
