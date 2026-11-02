import {isKingdomGateOpen} from '../src/kingdomGate';
import {WORLD_RIFLE} from '../src/worldBalance';
import * as adventure from '../src/openWorldCampaign';
import * as campaignEpisodes from '../src/campaignEpisodes';
import { COMPACT_RELAY } from '../src/compactRelayCampaign';
/** Legacy exact-source slices do not instantiate new sites. Keep their tests
 * on the real old route while explicitly supplying the new optional adapter. */
export const campaignSourceContext = {
  regionVisuals:{ready:()=>true},regionAt:()=>({id:'alpha'}),residentEventMarkerIds:new Set<string>(),residentEventRuntime:undefined,cavalrySupport:undefined,isKingdomGateOpen,WORLD_RIFLE,...adventure,adventureMarkerIds:new Set<string>(),adventureRuntime:undefined,adventureSites:{apply(){}},
  kingdomGateMarkerIds:new Set<string>(), kingdomGateRuntime:undefined, kingdomGateScene:{apply(){}}, KINGDOM_GATE:{latch:'kingdom_gate_latch'},
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
