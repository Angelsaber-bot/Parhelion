"""Fit a direct actor from random search/shot outcomes and opted-in human inputs."""
import argparse
from importlib import import_module
import json
from pathlib import Path

import torch
from torch.nn import functional as F

rl = import_module("train-self-play")
bc = rl.bc


def train(args):
    torch.manual_seed(args.seed)
    torch.set_num_threads(2)
    prior = rl.load_saved(args.prior)
    config = bc.Config(**prior["signature"]["config"])
    actor = bc.ArenaPolicy(config).eval()
    initial = rl.load_saved(args.resume_practice) if args.resume_practice else prior
    if initial["signature"] != prior["signature"]:
        raise ValueError("Practice checkpoint must match the human reference")
    actor.load_state_dict(initial["model"])
    human, _, weights, _, _ = rl.human_data(args.corpus, prior["split"], prior["signature"]["rulesVersion"], config.context, False)
    hx, hy = (torch.stack(t) for t in zip(*(human[i] for i in range(len(human)))))
    rows = torch.tensor(json.loads(args.samples.read_bytes()), dtype=torch.float32)
    masks = [rows[:, 0] == 1, rows[:, 0] == 2,
             (rows[:, 0] == 0) & (rows[:, -2] == 1), (rows[:, 0] == 0) & (rows[:, -2] == 0)]
    groups = [rows[mask] for mask in masks]
    if any(not len(group) for group in groups):
        raise ValueError("Practice needs both shot outcomes and both types of successful camera trials")
    # Use on-policy histories to expose the learner to the inventory, smoke, motion
    # and recent-contact distributions it will actually encounter during a match.
    practice_histories = []
    travel, controls = [], []
    for episode in json.loads(args.rollout.read_bytes())["episodes"]:
        for trajectory in episode["trajectories"].values():
            recent = []
            for i, decision in enumerate(trajectory):
                if decision["reset"]:
                    recent = []
                recent = (recent + [decision["obs"]])[-config.context:]
                practice_histories.append([[0.] * hx.shape[-1]] * (config.context - len(recent)) + recent)
                later = trajectory[i + 1:i + 4]
                if len(later) == 3 and not any(frame["reset"] for frame in later):
                    start, end = decision["obs"], later[-1]["obs"]
                    travel.append((len(practice_histories) - 1, ((end[18] - start[18])**2 + (end[20] - start[20])**2)**.5))
                    controls.append(decision["axes"][2:4])
    memories = torch.tensor(practice_histories)
    traveled = torch.tensor(travel)
    useful = traveled[:, 1] > traveled[:, 1].quantile(.65)
    mobile = traveled[useful, 0].long()
    motion = torch.tensor(controls)[useful].tanh()
    unseen = (hx[:, -1, 0] == 0).nonzero().flatten()
    optimizer = torch.optim.AdamW(actor.parameters(), lr=.0004 if args.resume_practice else .001)
    for step in range(args.steps):
        group = torch.cat([g[torch.randint(len(g), (64,))] for g in groups])
        obs = group[:, 1:-2].clone()
        history = memories[torch.randint(len(memories), (len(obs),))].clone()
        # The independently sampled probe supplies current visibility, pose and
        # action outcomes. Preserve real histories and current ancillary sensors.
        history[:, -1, :5] = obs[:, :5]
        history[:, -1, 23] = obs[:, 23]
        smoky = (obs[:, 24:27] < 0).any(dim=1)
        history[smoky, -1, 24:27] = obs[smoky, 24:27]
        history[64:128, -1, 16:18] = obs[64:128, 16:18]
        history[64:128, -1, -3:] = obs[64:128, -3:]
        # Include short, persistent contacts as well as sudden changes of view.
        repeat = torch.rand(len(obs)) < .5
        history[repeat, -2, :5] = obs[repeat, :5]
        # Imitate human buttons and locomotion in varying inventories and arenas.
        logits = actor(history)
        axes = logits[:128, :2].tanh()
        # Outcome-weighted regression. These controls came from independent random
        # draws that hit or recovered contact, never from target-angle action labels.
        camera = F.smooth_l1_loss(axes[:64], group[:64, -2:], beta=.07)
        search = F.smooth_l1_loss(axes[64:], group[64:128, -2:], beta=.15)
        trigger = F.binary_cross_entropy_with_logits(logits[128:, 4], group[128:, -2])
        ids = torch.randint(len(hx), (64,))
        imitation = bc.losses(actor(hx[ids]), hy[ids], weights).mean()
        movers = torch.randint(len(mobile), (64,))
        movement = F.smooth_l1_loss(actor(memories[mobile[movers]])[:, 2:4].tanh(), motion[movers], beta=.2)
        quiet = unseen[torch.randint(len(unseen), (64,))]
        # Reacquisition trials overrepresent large turns. Ordinary human play
        # also includes waiting, moving through clear space and holding a view.
        glimpses = hx[quiet].clone()
        # Preserve the demonstrated sequence of sightings, previous turns and
        # local geometry while varying unrelated equipment and world coordinates.
        domain = memories[torch.randint(len(memories), (len(quiet),))]
        glimpses[:, :, 5:16] = domain[:, :, 5:16]
        glimpses[:, :, 18:23] = domain[:, :, 18:23]
        ordinary_turn = F.smooth_l1_loss(actor(glimpses)[:, :2].tanh(), hy[quiet, :2], beta=.08)
        loss = .12 * movement + 1.5 * camera + .12 * search + .6 * trigger + .06 * imitation + .5 * ordinary_turn
        optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(actor.parameters(), 1., error_if_nonfinite=True)
        optimizer.step()
    bc.write_json(args.output, rl.actor_json(actor, prior["signature"], rl.CONTROLLER))
    saved = rl.warm_start_controls(prior, prior)
    saved["model"] = actor.state_dict()
    bc.atomic_write(args.checkpoint, lambda path: torch.save(saved, path))
    print("Practice samples", [len(group) for group in groups], "optimizer steps", args.steps)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    for field in ("prior", "corpus", "samples", "rollout", "output", "checkpoint"):
        p.add_argument("--" + field, required=True, type=Path)
    p.add_argument("--resume-practice", type=Path)
    p.add_argument("--seed", type=int, default=37241)
    p.add_argument("--steps", type=int, default=1800)
    train(p.parse_args())
