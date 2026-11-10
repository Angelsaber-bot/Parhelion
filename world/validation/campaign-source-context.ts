import {isKingdomGateOpen} from '../src/story/kingdomGate';
import {WORLD_RIFLE} from '../src/core/worldBalance';
import * as adventure from '../src/story/openWorldCampaign';
import * as drama from '../src/story/journeyDrama';
import * as campaignEpisodes from '../src/story/campaignEpisodes';
import { COMPACT_RELAY } from '../src/story/compactRelayCampaign';
import {ORLEANS_WORK_ACTIONS} from '../src/map/orleansWorks';
/** Legacy exact-source slices do not instantiate new sites. Keep their tests
 * on the real old route while explicitly supplying the new optional adapter. */
export const campaignSourceContext = {
  ...drama,
  ORLEANS_WORK_ACTIONS, orleansWorksMarkerIds:new Set<string>(), orleansWorksRuntime:undefined, orleansWorksScene:{apply(){}},
  parallaxMarkerIds: new Set<string>(), parallaxGarden: { apply() {} },
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
