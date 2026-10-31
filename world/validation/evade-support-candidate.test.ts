import {Player} from './fixtures/player-pre-evade-support';
import {installEvadeSupportCandidate} from './combat-review/evade-support-candidate';
import {verifyEvadeSupport} from './evade-support-contract.fixture';
verifyEvadeSupport('historical Player + isolated candidate',Player,installEvadeSupportCandidate);
