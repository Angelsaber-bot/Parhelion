import { VALLEY_PROLOGUE } from './valleyPrologue';

export const HARBOR_RELIEF = {
  reserve: 'adventure_harbor_relief_reserve',
  launch: 'adventure_harbor_relief_launch',
  underway: 'adventure_harbor_relief_underway',
  delivered: 'adventure_harbor_relief_delivered',
  lookout: 'adventure_harbor_relief_lookout',
  crossing: 'adventure_harbor_relief_crossing',
  extra: 'adventure_harbor_relief_workboat_load',
} as const;
export const HARBOR_WORKBOAT = {
  inspect: 'field_workboat_inspect', access: 'field_workboat_access', gangway: 'field_workboat_gangway',
  fight: 'field_workboat_fight', signal: 'field_workboat_signal', fought: 'field_workboat_fought',
  release: 'field_workboat_release',
} as const;
export const HARBOR_WORKBOAT_ENCOUNTER = 'adventure_harbor_workboat';

const R = HARBOR_RELIEF;
export const harborReliefRequired = (done: ReadonlySet<string>) => done.has(R.reserve) ||
  (done.has(VALLEY_PROLOGUE.room) && !done.has('adventure_harbor_records') && !done.has('sea_core') && !done.has('blackbeard_contract'));
export const harborReliefPassage = (done: ReadonlySet<string>) => done.has(R.lookout) && done.has(R.crossing);
export const harborReliefReady = (done: ReadonlySet<string>) => !harborReliefRequired(done) || done.has(R.delivered);
export const HARBOR_RELIEF_STAGE_SECONDS = 5;
// Paths use the current Black Sail world coordinates. The medicine boat and
// the merchantman leave in separate channels between the existing piers.
export const HARBOR_MEDICINE_LANE = { x: 575, startZ: -501, endZ: -447 } as const;
export const HARBOR_MERCHANT_LANE = { x: 626, startZ: -494, endZ: -453 } as const;
