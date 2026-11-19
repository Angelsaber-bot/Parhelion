import { WEAPONS, loadoutWeapon } from './content.ts';
import { explorationScene, EXPLORATION_TICKS } from './exploration.ts';
import { humanObservation, wrapAngle, type CombatContact } from './humanCombat.ts';
import type { Match } from './match.ts';
import { createNeuralPolicy, type NeuralPolicyModel } from './neuralPolicy.ts';
import { BTN, type Input, type PlayerState } from './sim.ts';

const EDGE_BUTTONS = BTN.JUMP | BTN.DASH | BTN.RELOAD | BTN.THROW;
const BUTTONS = [BTN.FIRE, BTN.JUMP, BTN.DASH, BTN.SHIELD, BTN.RELOAD, BTN.CROUCH, BTN.THROW];

/** Convert predictions to player inputs. Match physics owns the outcome. */
export function neuralBotControl(model: NeuralPolicyModel) {
  const policy = createNeuralPolicy(model);
  let life = -1, next = -1, bearing = 0, seenAt = -Infinity;
  let prior: [number, number] = [0, 0];
  let yaw = 0, pitch = 0, mx = 0, mz = 0, buttons = 0, weapon = 0;

  function reset() {
    if (life === -1) return;
    policy.reset();
    life = next = -1;
    seenAt = -Infinity;
    prior = [0, 0];
  }

  return {
    reset,
    apply(match: Match, me: PlayerState, input: Input): Input {
      if (life !== me.lifeId) { reset(); life = me.lifeId; }
      const choose = match.tick >= next;
      const contacts: CombatContact[] = [];
      for (const { state } of match.slots.values()) {
        if (state.alive && state.team !== me.team) contacts.push({ team: state.team, crouched: state.crouched, feet: [state.x, state.y, state.z] });
      }
      for (const decoy of match.heroes.decoys()) contacts.push({ team: decoy.team, crouched: decoy.crouched, feet: [decoy.x, decoy.y, decoy.z] });
      const observation = humanObservation(match.map, me, contacts, (from, to) => match.heroes.visible(from, to), prior);
      if (observation[0]) { bearing = me.yaw + observation[1]; seenAt = match.tick; }
      if (choose) {
        const scene = explorationScene(match.map, me, [bearing, match.tick - seenAt]);
        const result = policy.think([...observation, ...scene]);
        yaw = Math.tanh(result[0]) * .9 / EXPLORATION_TICKS;
        pitch = Math.tanh(result[1]) * .55 / EXPLORATION_TICKS;
        mx = Math.tanh(result[2]);
        mz = Math.tanh(result[3]);
        buttons = BUTTONS.reduce((mask, button, i) => result[4 + i] > 0 ? mask | button : mask, 0);
        weapon = 0;
        for (let i = 1; i < 3; i++) if (result[11 + i] > result[11 + weapon]) weapon = i;
        next = match.tick + EXPLORATION_TICKS;
      }
      const selected = WEAPONS[loadoutWeapon(me.loadout, weapon)];
      const edge = EDGE_BUTTONS | (selected.auto && selected.kind === 'gun' ? 0 : BTN.FIRE) |
        (me.ability.phase === 'guard' ? 0 : BTN.SHIELD);
      input.yaw = wrapAngle(me.yaw + yaw);
      input.pitch = Math.max(-1.45, Math.min(1.45, me.pitch + pitch));
      input.mx = mx;
      input.mz = mz;
      input.buttons = choose ? buttons : buttons & ~edge;
      input.weapon = weapon;
      prior = [yaw, input.pitch - me.pitch];
      return input;
    },
  };
}
