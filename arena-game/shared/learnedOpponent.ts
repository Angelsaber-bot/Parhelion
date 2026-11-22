import weights from './directPolicy.json';
import { neuralBotControl } from './botNeuralControl.ts';
import type { Controller } from './match.ts';
import { parseNeuralPolicy, type NeuralPolicyModel } from './neuralPolicy.ts';

export function directPolicy(model?: NeuralPolicyModel | null): model is NeuralPolicyModel {
  return !!model && !model.synthetic && (model.version === 1 || model.version === 4);
}

function bundledPolicy(): NeuralPolicyModel {
  const parsed = parseNeuralPolicy(weights);
  if (!directPolicy(parsed)) throw Error('Invalid bundled Arena policy');
  return parsed;
}
export const bundledOpponent = bundledPolicy();

/** One policy context per seat. Outside play, send only the current pose. */
export function learnedOpponent(model?: NeuralPolicyModel | null): Controller {
  const actor = neuralBotControl(directPolicy(model) ? model : bundledOpponent);
  let seq = 0;
  return { think(match, id) {
    const me = match.player(id)!;
    const input = { seq: ++seq, view: match.tick, yaw: me.yaw, pitch: me.pitch,
      mx: 0, mz: 0, buttons: 0, weapon: me.weaponSlot };
    if (me.alive && match.phase === 'live') return actor.apply(match, me, input);
    actor.reset();
    return input;
  } };
}
