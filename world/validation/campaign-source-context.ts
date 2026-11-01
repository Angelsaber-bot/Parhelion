import * as campaignEpisodes from '../src/campaignEpisodes';
import { COMPACT_RELAY } from '../src/compactRelayCampaign';
/** Legacy exact-source slices do not instantiate new sites. Keep their tests
 * on the real old route while explicitly supplying the new optional adapter. */
export const campaignSourceContext = {
  ...campaignEpisodes,
  COMPACT_RELAY,
  compactRelayMarkerIds: new Set<string>(),
  compactRelayRuntime: undefined,
  compactRelaySites: { applyState() {} },
  questTrackedId: null,
  optionalPin: null,
  guideOn: false,
  campaignMarkerIds: new Set<string>(),
  falseDawnMarkerIds: new Set<string>(),
  falseDawnRuntime: undefined,
  falseDawnTracked: false,
  applyCampaignState() {},
  applyWeaponFinish() {},
  applyFalseDawnState() {},
};
