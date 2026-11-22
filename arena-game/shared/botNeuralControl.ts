import { botGunRecoil } from './aimRecoil.ts';
import { WEAPONS, loadoutWeapon } from './content.ts';
import { addSmokeDepths, explorationScene, EXPLORATION_TICKS, visibleSmokeDepths } from './exploration.ts';
import { humanObservation, wrapAngle, type CombatContact } from './humanCombat.ts';
import type { Match } from './match.ts';
import { createNeuralPolicy, type NeuralPolicyModel } from './neuralPolicy.ts';
import { perceptualMotor } from './perceptualMotor.ts';
import { BTN, type Input, type PlayerState } from './sim.ts';

const EDGE_BUTTONS = BTN.JUMP | BTN.DASH | BTN.RELOAD | BTN.THROW;
const BUTTONS = [BTN.FIRE, BTN.JUMP, BTN.DASH, BTN.SHIELD, BTN.RELOAD, BTN.CROUCH, BTN.THROW];

export interface NeuralAction {
  axes: readonly number[]; // Four unsquashed camera and movement controls.
  buttons: number; // Same mask as a player's Input.
  weapon: number;
}

type SelectAction = (observation: number[], logits: number[], firstInLife: boolean) => NeuralAction;

export function greedyAction(_observation: number[], logits: number[]): NeuralAction {
  const buttons = BUTTONS.reduce((mask, button, i) => logits[4 + i] > 0 ? mask | button : mask, 0);
  let weapon = 0;
  for (let i = 1; i < 3; i++) if (logits[11 + i] > logits[11 + weapon]) weapon = i;
  return { axes: logits, buttons, weapon };
}

/** Structured and rendered actors both emit ordinary player controls at the same cadence. */
export function applyNeuralAction(input: Input, me: PlayerState, raw: NeuralAction, choose: boolean): Input {
  const selected = WEAPONS[loadoutWeapon(me.loadout, raw.weapon)];
  const edge = EDGE_BUTTONS | (selected.auto && selected.kind === 'gun' ? 0 : BTN.FIRE) |
    (me.ability.phase === 'guard' ? 0 : BTN.SHIELD);
  input.yaw = wrapAngle(me.yaw + Math.tanh(raw.axes[0]) * .9 / EXPLORATION_TICKS);
  input.pitch = Math.max(-1.45, Math.min(1.45, me.pitch + Math.tanh(raw.axes[1]) * .55 / EXPLORATION_TICKS));
  input.mx = Math.tanh(raw.axes[2]);
  input.mz = Math.tanh(raw.axes[3]);
  input.buttons = choose ? raw.buttons : raw.buttons & ~edge;
  input.weapon = raw.weapon;
  return input;
}

/** Use the same observations, actuator limits and decision interval in the live game and RL rollouts. */
export function neuralBotControl(model: NeuralPolicyModel, selectAction: SelectAction = greedyAction, random?: () => number) {
  const policy = createNeuralPolicy(model);
  const recoil = model.version === 4 ? botGunRecoil() : undefined;
  let life = -1, next = -1, bearing = 0, seenAt = -Infinity;
  let motor: ReturnType<typeof perceptualMotor> | undefined;
  let prior: [number, number] = [0, 0];
  let action: NeuralAction = { axes: [0, 0, 0, 0], buttons: 0, weapon: 0 };

  // PPO samples these axes during training. Hold a correlated movement sample across
  // decisions so a deployed v3 bot can commit to a sidestep without jittering its aim.
  let lateralNoise = 0, forwardNoise = 0;
  const sampleMovement = (draw: () => number) => .35 * Math.sqrt(-2 * Math.log(Math.max(1e-9, draw()))) * Math.cos(2 * Math.PI * draw());

  function reset() {
    if (life === -1) return;
    policy.reset();
    life = next = -1;
    seenAt = -Infinity;
    prior = [0, 0];
    lateralNoise = forwardNoise = 0;
  }

  return {
    reset,
    apply(match: Match, me: PlayerState, input: Input): Input {
      if (life !== me.lifeId) {
        reset(); life = me.lifeId;
        // Versions 2 and 3 were trained with the legacy actuator in their environment.
        motor = model.version === 2 || model.version === 3 ? perceptualMotor(model.version === 3, model.version === 3 ? random : undefined) : undefined;
      }
      const choose = match.tick >= next;
      const contacts: CombatContact[] = [];
      for (const { state } of match.slots.values()) {
        if (state.alive && state.team !== me.team) contacts.push({ team: state.team, crouched: state.crouched, feet: [state.x, state.y, state.z] });
      }
      for (const decoy of match.heroes.decoys()) contacts.push({ team: decoy.team, crouched: decoy.crouched, feet: [decoy.x, decoy.y, decoy.z] });
      const observation = humanObservation(match.map, me, contacts, (from, to) => match.heroes.visible(from, to), prior,
        undefined, undefined, (from, to) => match.heroes.visible(from, to, true));
      if (observation[0]) { bearing = me.yaw + observation[1]; seenAt = match.tick; }
      if (choose) {
        const scene = explorationScene(match.map, me, [bearing, match.tick - seenAt]);
        if (model.version === 4) addSmokeDepths(scene, visibleSmokeDepths(match.map, me, match.smokes, match.shields));
        const features = [...observation, ...scene];
        action = selectAction(features, policy.think(features), next === -1);
        if (model.version === 3 && random && selectAction === greedyAction) {
          lateralNoise = .75 * lateralNoise + .66 * sampleMovement(random);
          forwardNoise = .75 * forwardNoise + .66 * sampleMovement(random);
          const axes = action.axes.slice(0, 4);
          axes[2] += lateralNoise; axes[3] += forwardNoise;
          action = { ...action, axes };
        }
        next = match.tick + EXPLORATION_TICKS;
      }
      applyNeuralAction(input, me, action, choose);
      motor?.(match.map, me, match.tick, observation, input, action.buttons, match.smokes, match.shields);
      recoil?.(me, input);
      prior = [wrapAngle(input.yaw - me.yaw), input.pitch - me.pitch];
      return input;
    },
  };
}
