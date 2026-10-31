import {Player} from './fixtures/player-pre-general-support';
import {installGroundActionSupportCandidate} from './combat-review/ground-action-support-candidate';
import {verifyGeneralGroundSupport} from './general-ground-support-contract.fixture';
verifyGeneralGroundSupport('frozen narrow Player + isolated candidate',Player,p=>installGroundActionSupportCandidate(p,()=>false,'general'));
