"""Fit player control readouts with capture-balanced imitation and a frozen perception encoder."""
from importlib import import_module

import torch
from torch.nn import functional as F

from arena_route_learning import route_indices, route_loss

bc = import_module("train-arena-policy")
actor_from_json = import_module("fit-match-movement").actor_from_json


def fit_player(model, recordings, holdout):
    torch.set_num_threads(2)
    actor = actor_from_json(model)
    groups = []
    for batches in recordings:
        samples = list(bc.capture_windows(batches, include_smoke=True))
        ds = bc.ArenaDataset([samples], actor.config.context)
        with torch.no_grad():
            x = actor.encode(torch.stack([ds[i][0] for i in range(len(ds))]))
        routes = route_indices(ds.starts, range(len(ds)))
        groups.append((x, ds.targets, routes, ds.features[:, 21:23]))

    def fit(indices):
        weight = actor.out.weight.detach().clone().requires_grad_()
        bias = actor.out.bias.detach().clone().requires_grad_()
        opt = torch.optim.AdamW([weight, bias], lr=.0015)
        for _ in range(64):
            losses = []
            for i in indices:
                x, y, routes, headings = groups[i]
                logits = F.linear(x, weight, bias)
                imitation = bc.losses(logits, y, torch.ones(7)).mean()
                if len(routes):
                    imitation += .3 * route_loss(logits[:, 2:4].tanh()[routes], y[routes, 2:4], headings[routes])
                losses.append(imitation)
            shrink = (weight - actor.out.weight.detach()).square().mean() + (bias - actor.out.bias.detach()).square().mean()
            opt.zero_grad()
            (torch.stack(losses).mean() + .6 * shrink).backward()
            opt.step()
        return actor.out.weight.detach().lerp(weight.detach(), .65), actor.out.bias.detach().lerp(bias.detach(), .65)

    def metrics(index, weight, bias):
        x, y, _, _ = groups[index]
        logits = F.linear(x, weight, bias)
        return dict(windows=len(x), loss=bc.losses(logits, y, torch.ones(7)).mean().item(),
                    movement=(logits[:, 2:4].tanh()-y[:, 2:4]).abs().mean().item(),
                    yaw=(logits[:, 0].tanh()-y[:, 0]).abs().mean().item(),
                    fire=(logits[:, 4].sigmoid()-y[:, 4]).square().mean().item())

    training = [i for i in range(len(groups)) if i != holdout]
    if len(training) < 2 or holdout not in range(len(groups)):
        raise ValueError("Need distinct training games and one whole reserved game")
    folds = []
    for test in training:
        folds.append(metrics(test, *fit([i for i in training if i != test])))
    w, b = fit(training)
    return dict(weights=w.tolist(), bias=b.tolist(), folds=folds,
                rows=[len(g[0]) for g in groups], before=metrics(holdout, actor.out.weight, actor.out.bias),
                after=metrics(holdout, w, b))
