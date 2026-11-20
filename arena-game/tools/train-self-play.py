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

bc = import_module("train-arena-policy")
AXIS_STD = 0.35
CHECKPOINT_KIND = "arena-self-play-v1"


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
    observations, actions, logp, rewards, ends = [], [], [], [], []
    env_ticks = 0
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
        ends.append(len(actions))
    tensors = [torch.tensor(rows, dtype=torch.float32) for rows in (observations, actions, logp, rewards)]
    return (*tensors, ends, env_ticks)


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


def human_data(path, split, rules, context):
    _, batches = bc.load_captures(path, rules, allow_empty=True)
    captures = bc.usable_captures(batches)
    groups = [[rows for capture, rows in captures.items() if split.get(capture) == name]
              for name in ("train", "holdout")]
    if not all(groups):
        return None
    train, holdout = (bc.ArenaDataset(sequences, context) for sequences in groups)
    positive = train.targets[:, 4:11].sum(dim=0)
    weights = ((len(train) - positive) / positive.clamp_min(1)).sqrt().clamp(1, 12)
    return train, holdout, weights, len(groups[1])


def load_saved(path):
    saved = torch.load(path, map_location="cpu", weights_only=True)
    if saved.get("kind") not in (None, CHECKPOINT_KIND) or "signature" not in saved or "model" not in saved:
        raise ValueError("Expected an Arena imitation or self-play checkpoint")
    return saved


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def actor_json(actor, signature):
    return bc.wire_model(actor, signature["rulesVersion"], signature["synthetic"])


@torch.no_grad()
def behavior(actor, critic, reference, states, actions, logged):
    values, reference_logits, parity_errors = [], [], []
    for x, a, p in zip(states.split(256), actions.split(256), logged.split(256)):
        encoded = actor.encode(x)
        values.append(critic(encoded).squeeze(-1))
        replayed = joint_log_probability(distributions(actor.out(encoded)), a)
        parity_errors.append((replayed - p).abs().max())
        reference_logits.append(reference(x))
    error = torch.stack(parity_errors).max().item()
    if not math.isfinite(error) or error > .003:
        raise ValueError(f"PyTorch and game sampling log probabilities disagree (max error {error})")
    return torch.cat(values), torch.cat(reference_logits), error


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
        bc.write_json(args.output, actor_json(actor, signature))
        return

    parent_hash = file_hash(args.actor)
    if json.loads(args.actor.read_bytes()) != actor_json(actor, signature):
        raise ValueError("Rollout actor and source checkpoint weights differ")
    states, actions, logged, rewards, ends, env_ticks = read_trajectories(
        args.rollout, parent_hash, signature["rulesVersion"], config.context)
    prior = load_saved(args.prior) if args.prior else saved
    if (args.prior and prior.get("kind") is not None) or prior["signature"] != signature:
        raise ValueError("Frozen reference must match the actor's model, rules, and human data split configuration")
    if any(saved["split"][capture] != group for capture, group in prior["split"].items() if capture in saved["split"]):
        raise ValueError("The new human reference reassigns a previously seen capture across train and holdout")
    reference = bc.ArenaPolicy(config).eval().requires_grad_(False)
    reference.load_state_dict(prior.get("reference", prior["model"]))
    human_split = {**saved["split"], **prior["split"]}
    human = human_data(args.dataset, human_split, signature["rulesVersion"], config.context) if args.dataset else None
    if args.dataset and not human:
        print("The retained human corpus lacks complete training and holdout partitions. "
              "Continuing self-play against the frozen reference without human replay or release evaluation.",
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
    values, prior_logits, parity_error = behavior(actor, critic, reference, states, actions, logged)
    advantage, returns = generalized_advantages(rewards, values, ends)
    previous_updates = saved.get("optimizerSteps", 0)
    updates, objectives = 0, []
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
            loss = -surrogate + .5 * value_loss + .08 * prior_kl - .001 * entropy
            if human:
                human_train, _, weights, _ = human
                selection = torch.randint(len(human_train), (min(len(ix), 64),))
                demo_x, demo_y = zip(*(human_train[i] for i in selection.tolist()))
                loss = loss + .15 * bc.losses(actor(torch.stack(demo_x)), torch.stack(demo_y), weights).mean()
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            nn.utils.clip_grad_norm_(params, .5, error_if_nonfinite=True)
            optimizer.step()
            updates += 1
            objectives.append(loss.item())

    bc.write_json(args.output, actor_json(actor, signature))
    actor_hash = file_hash(args.output)
    if actor_hash == parent_hash:
        raise ValueError("Self-play update produced unchanged policy weights")
    metrics = {
        "generation": generation + 1, "optimizerSteps": previous_updates + updates, "updates": updates,
        "steps": len(rewards), "games": len(ends), "parentHash": parent_hash, "actorHash": actor_hash,
        "totalSteps": saved.get("totalSteps", 0) + len(rewards), "totalGames": saved.get("totalGames", 0) + len(ends),
        "environmentSteps": env_ticks, "totalEnvironmentSteps": saved.get("totalEnvironmentSteps", 0) + env_ticks,
        "samplingParityMaxError": parity_error, "objective": sum(objectives) / len(objectives),
        "rewardSum": rewards.sum().item(), "nonzeroRewards": int(rewards.count_nonzero()),
        "holdoutWindows": 0, "holdoutCaptures": 0,
    }
    if human:
        _, test, weights, capture_count = human
        loader = DataLoader(test, batch_size=256)
        metrics.update(holdout=bc.evaluate(actor, loader, "cpu", weights),
                       referenceHoldout=bc.evaluate(reference, loader, "cpu", weights),
                       holdoutWindows=len(test), holdoutCaptures=capture_count)
    state = {"kind": CHECKPOINT_KIND, "signature": signature, "model": actor.state_dict(), "critic": critic.state_dict(),
             "optimizer": optimizer.state_dict(), "reference": reference.state_dict(), "split": human_split,
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
    update.add_argument("--epochs", type=int, default=3)
    update.add_argument("--batch-size", type=int, default=128)
    update.add_argument("--learning-rate", type=float, default=5e-5)
    update.add_argument("--seed", type=int, default=61855)
    args = parser.parse_args()
    if args.command == "update" and not (1 <= args.epochs <= 50 and 1 <= args.batch_size <= 4096 and 0 < args.learning_rate <= .01):
        parser.error("Invalid PPO training settings")
    try:
        run(args)
    except (OSError, KeyError, ValueError, RuntimeError) as error:
        print(f"Arena self-play: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
