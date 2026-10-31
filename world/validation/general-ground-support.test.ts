import {Player} from '../src/player';
import {verifyGeneralGroundSupport} from './general-ground-support-contract.fixture';
// No wrapper: exercise the committed production Player directly.
verifyGeneralGroundSupport('production general physical support',Player,p=>({get diagnostics(){return p.evadeSupport.diagnostics;},dispose(){}}));
