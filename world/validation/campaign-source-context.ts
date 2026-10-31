import * as campaignEpisodes from '../src/campaignEpisodes';
/** Legacy exact-source slices do not instantiate new sites. Keep their tests
 * on the real old route while explicitly supplying the new optional adapter. */
export const campaignSourceContext = {
  ...campaignEpisodes,
  campaignMarkerIds: new Set<string>(),
  falseDawnMarkerIds: new Set<string>(),
  falseDawnRuntime: undefined,
  falseDawnTracked: false,
  applyCampaignState() {},
  applyWeaponFinish() {},
  applyFalseDawnState() {},
};
