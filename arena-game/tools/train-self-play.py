"""Update Arena's game-compatible transformer with on-policy self-play trajectories."""

import argparse
import hashlib
from importlib import import_module
import itertools
import json
import math
from pathlib import Path
import sys

import torch
from torch import nn
from torch.distributions import Bernoulli, Categorical, Normal, kl_divergence
from torch.nn import functional as F
from torch.utils.data import DataLoader
from arena_camera_intent import calibrate_yaw

bc = import_module("train-arena-policy")
AXIS_STD = 0.35
CHECKPOINT_KIND = "arena-self-play-v1"
PREDICTION_HORIZON = 3
CONTROLLER = "perceptual-options-v1"
UNLABELED = 2.0


def checked_vector(row, key, length, limit):
    values = row[key]
    if not isinstance(values, list) or len(values) != length or any(not bc.bounded(v, limit) for v in values):
        raise ValueError(f"Invalid rollout {key}")
    return values


def read_trajectories(path, parent_hash, rules, context):
    doc = json.loads(path.read_bytes())
    if (doc["version"] != 1 or doc["actorHash"] != parent_hash or doc["rulesVersion"] != rules
            or doc["axisStd"] != AXIS_STD or not doc["episodes"]):
        raise ValueError("Rollout does not match the frozen behavior policy, rules, or sampling distribution")
    observations, actions, logp, rewards, ends, resets = [], [], [], [], [], []
    env_ticks, coaching = 0, []
    for episode in doc["episodes"]:
        if not bc.integer(episode["ticks"], 1, 10**8):
            raise ValueError("Invalid number of simulated game ticks")
        env_ticks += episode["ticks"]
        steps = episode["steps"]
        if not steps or steps[0]["reset"] is not True:
            raise ValueError("A rollout episode must begin at a fresh policy context")
        history = []
        for step in steps:
            if type(step["reset"]) is not bool:
                raise ValueError("Invalid policy reset marker")
            resets.append(step["reset"])
            if step["reset"]:
                history = []
            history = (history + [checked_vector(step, "obs", bc.FEATURES, 64)])[-context:]
            observations.append([[0.0] * bc.FEATURES] * (context - len(history)) + history)
            axes = checked_vector(step, "axes", 4, 512)
            buttons = checked_vector(step, "buttons", bc.BUTTONS, 1)
            if not all(b in (0, 1) for b in buttons) or not bc.integer(step["weapon"], 0, 2):
                raise ValueError("Invalid rollout button or weapon")
            if not bc.bounded(step["logp"], 1e6) or not bc.bounded(step["reward"], 1e4):
                raise ValueError("Invalid rollout log probability or reward")
            actions.append([*axes, *buttons, step["weapon"]])
            logp.append(step["logp"])
            rewards.append(step["reward"])
            labels = step.get("coach", [None] * 5)
            if (not isinstance(labels, list) or len(labels) != 5
                    or any(value is not None and not bc.bounded(value, 1) for value in labels)
                    or labels[4] not in (None, 0, 1)):
                raise ValueError("Invalid corrective action labels")
            coaching.append([UNLABELED if value is None else value for value in labels])
        ends.append(len(actions))
    tensors = [torch.tensor(rows, dtype=torch.float32) for rows in (observations, actions, logp, rewards)]
    # Each episode begins with a reset. A successor belongs to the same life only
    # if it exists and the actor did not clear its memory at that decision.
    successors = ~torch.tensor(resets[1:] + [True], dtype=torch.bool)
    return (*tensors, ends, env_ticks, successors, torch.tensor(coaching, dtype=torch.float32))


def correction_loss(logits, labels):
    # Only supervised axes contribute. Compute a per-axis mean so rare escapes are not diluted
    # by thousands of ordinary no-contact decisions. Positive and negative triggers count equally.
    axes = labels[:, :4]
    known = axes != UNLABELED
    count = known.sum(dim=0)
    error = F.smooth_l1_loss(logits[:, :4].tanh(), axes, beta=.2, reduction="none")
    axes_loss = ((error * known).sum(dim=0) / count.clamp_min(1)).sum() / (count > 0).sum().clamp_min(1)
    fire = labels[:, 4]
    classes = torch.stack((fire == 0, fire == 1))
    count = classes.sum(dim=1)
    # A well separated trigger needs no further push toward saturation.
    margin = torch.stack((-logits[:, 4], logits[:, 4]))
    fire_loss = ((F.relu(.75 - margin) * classes).sum(dim=1) / count.clamp_min(1)).sum() / (count > 0).sum().clamp_min(1)
    return axes_loss + .5 * fire_loss


def aggregate_corrections(previous, states, labels, random):
    # Uniform priority reservoirs within behavior groups. Keep rare firing opportunities and
    # escapes across generations without storing trajectories or any human demonstration.
    keep = (labels != UNLABELED).any(dim=1)
    states, labels = states[keep].half(), labels[keep]
    keys = torch.rand(len(labels), generator=random)
    if previous:
        states = torch.cat((previous["states"], states))
        labels = torch.cat((previous["labels"], labels))
        keys = torch.cat((previous["keys"], keys))
    group = torch.zeros(len(labels), dtype=torch.long)
    group[labels[:, 0] != UNLABELED] = 1  # search turn
    group[states[:, -1, 0] > 0] = 2     # observed contact
    group[labels[:, 2] != UNLABELED] = 3  # blocked movement
    group[labels[:, 4] == 1] = 4          # actionable trigger
    picks = []
    for kind in range(5):
        indices = torch.where(group == kind)[0]
        picks.append(indices[keys[indices].argsort(descending=True)[:40]])
    selected = torch.cat(picks)
    return {"states": states[selected], "labels": labels[selected], "keys": keys[selected]}


def distributions(logits):
    return Normal(logits[:, :4], AXIS_STD), Bernoulli(logits=logits[:, 4:11]), Categorical(logits=logits[:, 11:])


def joint_log_probability(parts, actions):
    axes, buttons, weapon = parts
    return (axes.log_prob(actions[:, :4]).sum(-1) + buttons.log_prob(actions[:, 4:11]).sum(-1)
            + weapon.log_prob(actions[:, 11].long()))


def divergence(new, old):
    return (kl_divergence(new[0], old[0]).sum(-1) + kl_divergence(new[1], old[1]).sum(-1)
            + kl_divergence(new[2], old[2]))


def generalized_advantages(rewards, values, ends):
    # Death resets the actor's memory. Rewards continue through a respawn within the same game.
    advantages = torch.empty_like(values)
    start = 0
    for end in ends:
        tail = next_value = 0.0
        for step in range(end - 1, start - 1, -1):
            delta = rewards[step] + .99 * next_value - values[step]
            tail = delta + .99 * .95 * tail
            advantages[step], next_value = tail, values[step]
        start = end
    returns = advantages + values
    return (advantages - advantages.mean()) / advantages.std(unbiased=False).clamp_min(1e-6), returns


def human_data(path, split, rules, context, include_holdout):
    _, batches = bc.load_captures(path, rules, allow_empty=True)
    eligible = {"train", "holdout"} if include_holdout else {"train"}
    captures = bc.usable_captures({key: rows for key, rows in batches.items() if split.get(key) in eligible})
    groups = [[rows for capture, rows in captures.items() if split.get(capture) == name]
              for name in ("train", "holdout")]
    if not groups[0]:
        return None
    train = bc.ArenaDataset(groups[0], context)
    holdout = bc.ArenaDataset(groups[1], context) if include_holdout and groups[1] else None
    positive = train.targets[:, 4:11].sum(dim=0)
    weights = ((len(train) - positive) / positive.clamp_min(1)).sqrt().clamp(1, 12)
    capture_ends = list(itertools.accumulate(map(len, groups[0])))
    return train, holdout, weights, len(groups[1]), capture_ends


def replay_weights(dataset):
    # Keep half of the natural distribution. Allocate the other half across observed
    # quiet, turning and contact windows, capping repeat exposure for rare examples.
    turning = dataset.targets[:, 0].abs() * bc.YAW_SCALE >= bc.SEARCH_TURN_RADIANS
    contact = dataset.features[:, 0] > 0
    group = torch.where(contact, 2, turning.long())
    counts = torch.bincount(group, minlength=3)
    balanced = len(dataset) / (counts[group] * counts.count_nonzero())
    return .5 + .5 * balanced.clamp_max(7)


def load_saved(path):
    saved = torch.load(path, map_location="cpu", weights_only=True)
    if saved.get("kind") not in (None, CHECKPOINT_KIND) or "signature" not in saved or "model" not in saved:
        raise ValueError("Expected an Arena imitation or self-play checkpoint")
    return saved


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def actor_json(actor, signature, controller=None):
    model = bc.wire_model(actor, signature["rulesVersion"], signature["synthetic"])
    if controller is not None:
        if controller != CONTROLLER:
            raise ValueError("Unsupported Arena motor controller")
        model["version"] = 2
        model["controller"] = controller
    return model


@torch.no_grad()
def behavior(actor, critic, reference, states, actions, logged):
    latents, old_logits, reference_logits, parity_errors = [], [], [], []
    for x, a, p in zip(states.split(256), actions.split(256), logged.split(256)):
        encoded = actor.encode(x)
        latents.append(encoded)
        logits = actor.out(encoded)
        old_logits.append(logits)
        replayed = joint_log_probability(distributions(logits), a)
        parity_errors.append((replayed - p).abs().max())
        reference_logits.append(reference(x))
    error = torch.stack(parity_errors).max().item()
    if not math.isfinite(error) or error > .003:
        raise ValueError(f"PyTorch and game sampling log probabilities disagree (max error {error})")
    targets = torch.cat(latents)
    return critic(targets).squeeze(-1), targets, torch.cat(old_logits), torch.cat(reference_logits), error


class LatentDynamics(nn.Module):
    """Training-only recurrent transition from a decision embedding and the sampled control proposal."""

    def __init__(self, width):
        super().__init__()
        self.next_state = nn.GRUCell(4 + bc.BUTTONS + 3, width)

    def forward(self, state, actions):
        weapon = F.one_hot(actions[:, 11].long(), num_classes=3).to(state.dtype)
        controls = torch.cat([actions[:, :4].tanh(), actions[:, 4:11], weapon], dim=1)
        return self.next_state(controls, state)


def prediction_loss(dynamics, encoded, indices, actions, targets, successors):
    # The targets come from the frozen pre-update encoder. Roll forward with actual
    # sampled actions and discard the remainder of a sequence at death or game end.
    total, pairs = encoded.new_zeros(()), 0
    for _ in range(PREDICTION_HORIZON):
        valid = successors[indices]
        indices = indices[valid]
        if not len(indices):
            break
        encoded = dynamics(encoded[valid], actions[indices])
        indices = indices + 1
        total = total + (1 - F.cosine_similarity(encoded, targets[indices])).sum()
        pairs += len(indices)
    return total / max(1, pairs), pairs


@torch.no_grad()
def rollout_kl(actor, states, old_logits):
    total = 0.
    for x, old in zip(states.split(256), old_logits.split(256)):
        total += divergence(distributions(old), distributions(actor(x))).sum().item()
    return max(0., total / len(states))


def run(args):
    saved = load_saved(args.resume)
    signature = saved["signature"]
    config = bc.Config(**signature["config"])
    generation = saved.get("generation", 0)
    seed = getattr(args, "seed", 0) + generation
    torch.manual_seed(seed)
    torch.set_num_threads(min(4, torch.get_num_threads()))
    actor = bc.ArenaPolicy(config).eval()
    actor.load_state_dict(saved["model"])
    if args.command == "export":
        bc.write_json(args.output, actor_json(actor, signature, saved.get("controller")))
        return

    parent_hash = file_hash(args.actor)
    if json.loads(args.actor.read_bytes()) != actor_json(actor, signature, saved.get("controller")):
        raise ValueError("Rollout actor and source checkpoint weights differ")
    states, actions, logged, rewards, ends, env_ticks, successors, coaching = read_trajectories(
        args.rollout, parent_hash, signature["rulesVersion"], config.context)
    prior = load_saved(args.prior) if args.prior else saved
    if (args.prior and prior.get("kind") is not None) or prior["signature"] != signature:
        raise ValueError("Frozen reference must match the actor's model, rules, and human data split configuration")
    if any(saved["split"][capture] != group for capture, group in prior["split"].items() if capture in saved["split"]):
        raise ValueError("The new human reference reassigns a previously seen capture across train and holdout")
    reference = bc.ArenaPolicy(config).eval().requires_grad_(False)
    reference.load_state_dict(prior.get("reference", prior["model"]))
    human_split = {**saved["split"], **prior["split"]}
    human = human_data(args.dataset, human_split, signature["rulesVersion"], config.context,
                       not args.skip_holdout) if args.dataset else None
    if args.dataset and not human:
        print("The retained corpus has no assigned human training captures. Continuing with the frozen reference.",
              file=sys.stderr)
    critic = nn.Linear(config.width, 1)
    if generation:
        critic.load_state_dict(saved["critic"])
    else:
        nn.init.zeros_(critic.weight)
        nn.init.zeros_(critic.bias)
    params = list(itertools.chain(actor.parameters(), critic.parameters()))
    optimizer = torch.optim.Adam(params, lr=args.learning_rate)
    if generation:
        optimizer.load_state_dict(saved["optimizer"])
        for group in optimizer.param_groups:
            group["lr"] = args.learning_rate
    # A separate optimizer lets pre-SPR self-play checkpoints keep their actor and critic momentum.
    dynamics = LatentDynamics(config.width)
    dynamics_optimizer = torch.optim.Adam(dynamics.parameters(), lr=1e-3)
    if "dynamics" in saved:
        dynamics.load_state_dict(saved["dynamics"])
        dynamics_optimizer.load_state_dict(saved["dynamicsOptimizer"])
    values, targets, old_logits, prior_logits, parity_error = behavior(actor, critic, reference, states, actions, logged)
    demo_weights = replay_weights(human[0]) if human else None
    advantage, returns = generalized_advantages(rewards, values, ends)
    previous_updates = saved.get("optimizerSteps", 0)
    updates, objectives, prediction_sum, prediction_pairs = 0, [], 0., 0
    replayed_windows = 0
    coached_generations = saved.get("coachedGenerations", 0)
    coached_decisions = int((coaching != UNLABELED).any(dim=1).sum())
    coach_weight = args.coach_weight / math.sqrt(1 + coached_generations / 24) if coached_decisions else 0.
    previous_coaching = saved.get("coachArchive")
    coach_random = torch.Generator().manual_seed(seed + 9815)
    coach_replays = 0
    stopped = False
    # Observe a fixed, seeded sample after each optimizer step. Rollout-wide KL is
    # reported separately; the normal, Bernoulli and categorical KLs are all analytic.
    audit = torch.randperm(len(actions))[:256]
    audit_states, audit_logits = states[audit], old_logits[audit]
    for _ in range(args.epochs):
        for ix in torch.randperm(len(actions)).split(args.batch_size):
            encoded = actor.encode(states[ix])
            logits = actor.out(encoded)
            pred = critic(encoded).squeeze(-1)
            parts = distributions(logits)
            logp = joint_log_probability(parts, actions[ix])
            ratio = (logp - logged[ix]).clamp(-20, 20).exp()
            surrogate = torch.minimum(ratio * advantage[ix], ratio.clamp(.8, 1.2) * advantage[ix]).mean()
            value_loss = F.smooth_l1_loss(pred, returns[ix])
            prior_kl = divergence(parts, distributions(prior_logits[ix])).mean()
            entropy = parts[1].entropy().sum(-1).mean() + parts[2].entropy().mean()
            auxiliary, pairs = prediction_loss(dynamics, encoded, ix, actions, targets, successors)
            loss = -surrogate + .5 * value_loss + .08 * prior_kl - .001 * entropy + .1 * auxiliary
            if coach_weight:
                correction = correction_loss(logits, coaching[ix])
                if previous_coaching and len(previous_coaching["labels"]):
                    rows = torch.randint(len(previous_coaching["labels"]), (min(32, len(ix)),), generator=coach_random)
                    remembered = actor(previous_coaching["states"][rows].float())
                    correction = .75 * correction + .25 * correction_loss(remembered, previous_coaching["labels"][rows])
                    coach_replays += len(rows)
                loss = loss + coach_weight * correction
            if human:
                human_train, _, weights, _, _ = human
                selection = torch.multinomial(demo_weights, min(len(ix), 64), replacement=True)
                replayed_windows += len(selection)
                demo_x, demo_y = zip(*(human_train[i] for i in selection.tolist()))
                loss = loss + .15 * bc.losses(actor(torch.stack(demo_x)), torch.stack(demo_y), weights).mean()
            optimizer.zero_grad(set_to_none=True)
            dynamics_optimizer.zero_grad(set_to_none=True)
            loss.backward()
            nn.utils.clip_grad_norm_(params, .5, error_if_nonfinite=True)
            nn.utils.clip_grad_norm_(dynamics.parameters(), .5, error_if_nonfinite=True)
            optimizer.step()
            dynamics_optimizer.step()
            updates += 1
            objectives.append(loss.item())
            prediction_sum += auxiliary.item() * pairs
            prediction_pairs += pairs
            if rollout_kl(actor, audit_states, audit_logits) >= args.target_kl:
                stopped = True
                break
        if stopped:
            break

    behavior_kl = rollout_kl(actor, states, old_logits)
    camera_fit = {"status": "no_training_captures" if not human else "disabled"}
    if human and not args.skip_camera_calibration:
        camera_fit = calibrate_yaw(actor, reference, human[0], human[4], states, old_logits, behavior_kl, args.target_kl,
                                   AXIS_STD, bc.YAW_SCALE, bc.SEARCH_TURN_RADIANS)
        if camera_fit["status"] == "applied":
            behavior_kl = rollout_kl(actor, states, old_logits)
            for parameter in (actor.out.weight, actor.out.bias):
                optimizer.state[parameter]["exp_avg"][0].zero_()
    bc.write_json(args.output, actor_json(actor, signature, CONTROLLER))
    actor_hash = file_hash(args.output)
    if actor_hash == parent_hash:
        raise ValueError("Self-play update produced unchanged policy weights")
    archive = aggregate_corrections(previous_coaching, states, coaching, coach_random)
    metrics = {
        "generation": generation + 1, "optimizerSteps": previous_updates + updates, "updates": updates,
        "steps": len(rewards), "games": len(ends), "parentHash": parent_hash, "actorHash": actor_hash,
        "totalSteps": saved.get("totalSteps", 0) + len(rewards), "totalGames": saved.get("totalGames", 0) + len(ends),
        "environmentSteps": env_ticks, "totalEnvironmentSteps": saved.get("totalEnvironmentSteps", 0) + env_ticks,
        "samplingParityMaxError": parity_error, "objective": sum(objectives) / len(objectives),
        "behaviorKL": behavior_kl, "targetKL": args.target_kl, "klStopped": stopped, "cameraIntent": camera_fit,
        "predictionHorizon": PREDICTION_HORIZON, "predictionPairs": prediction_pairs,
        "predictionLoss": prediction_sum / prediction_pairs if prediction_pairs else None,
        "humanReplayWindows": replayed_windows,
        "coachedDecisions": coached_decisions, "coachWeight": coach_weight,
        "coachArchiveWindows": len(archive["labels"]), "coachReplayWindows": coach_replays,
        "coachTargetsByControl": (coaching != UNLABELED).sum(dim=0).tolist(),
        "coachPositiveTriggers": int((coaching[:, 4] == 1).sum()),
        "rewardSum": rewards.sum().item(), "nonzeroRewards": int(rewards.count_nonzero()),
        "holdoutWindows": 0, "holdoutCaptures": 0,
    }
    if human and human[1] is not None:
        _, test, weights, capture_count, _ = human
        loader = DataLoader(test, batch_size=256)
        metrics.update(holdout=bc.evaluate(actor, loader, "cpu", weights),
                       referenceHoldout=bc.evaluate(reference, loader, "cpu", weights),
                       holdoutWindows=len(test), holdoutCaptures=capture_count)
    state = {"kind": CHECKPOINT_KIND, "signature": signature, "model": actor.state_dict(), "critic": critic.state_dict(),
             "controller": CONTROLLER, "coachedGenerations": coached_generations + int(coach_weight > 0),
             "coachArchive": archive,
             "optimizer": optimizer.state_dict(), "reference": reference.state_dict(), "split": human_split,
             "dynamics": dynamics.state_dict(), "dynamicsOptimizer": dynamics_optimizer.state_dict(),
             **{k: metrics[k] for k in ("generation", "optimizerSteps", "totalSteps", "totalGames", "totalEnvironmentSteps", "actorHash")}}
    bc.atomic_write(args.checkpoint, lambda path: torch.save(state, path))
    bc.write_json(args.metrics, metrics)
    print(json.dumps(metrics, allow_nan=False), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    export = commands.add_parser("export")
    update = commands.add_parser("update")
    for command in (export, update):
        command.add_argument("--resume", type=Path, required=True)
        command.add_argument("--output", type=Path, required=True)
    for name in ("actor", "rollout", "checkpoint", "metrics"):
        update.add_argument("--" + name, type=Path, required=True)
    update.add_argument("--prior", type=Path)
    update.add_argument("--dataset", type=Path)
    update.add_argument("--skip-holdout", action="store_true",
                        help="Rehearse assigned human training captures and skip release evaluation for this update")
    update.add_argument("--epochs", type=int, default=3)
    update.add_argument("--batch-size", type=int, default=128)
    update.add_argument("--learning-rate", type=float, default=5e-5)
    update.add_argument("--target-kl", type=float, default=.03,
                        help="Stop PPO minibatches when the measured old-to-new joint action KL reaches this many nats")
    update.add_argument("--coach-weight", type=float, default=.65,
                        help="Initial corrective imitation weight; zero disables coaching for an ablation")
    update.add_argument("--skip-camera-calibration", action="store_true",
                        help="Keep the PPO yaw readout for a paired ablation")
    update.add_argument("--seed", type=int, default=61855)
    args = parser.parse_args()
    if args.command == "update" and not (1 <= args.epochs <= 50 and 1 <= args.batch_size <= 4096
                                          and 0 < args.learning_rate <= .01 and 0 < args.target_kl <= 10
                                          and 0 <= args.coach_weight <= 2):
        parser.error("Invalid PPO training settings")
    try:
        run(args)
    except (OSError, KeyError, ValueError, RuntimeError) as error:
        print(f"Arena self-play: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
