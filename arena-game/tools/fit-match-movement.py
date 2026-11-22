"""Fit the two movement outputs of a released actor from selected, consenting Arena recordings."""
import argparse
from importlib import import_module
import json
from pathlib import Path
import torch
from torch.nn import functional as F

from arena_route_learning import route_indices, route_loss

bc = import_module("train-arena-policy")


def actor_from_json(model):
    cfg = bc.Config(model["context"], model["width"], model["heads"], len(model["layers"]),
                    len(model["layers"][0]["up"]["bias"]), 0.)
    actor = bc.ArenaPolicy(cfg).eval()
    params = {}
    for name in actor.state_dict():
        field = model
        for key in name.split("."):
            field = field[int(key)] if key.isdigit() else field[key]
        params[name] = torch.tensor(field)
    actor.load_state_dict(params)
    return actor


def movement_data(batches, actor):
    windows = list(bc.capture_windows(batches, include_smoke=True))
    if len(windows) < 60:
        raise ValueError("Too few continuous input windows for movement practice")
    data = bc.ArenaDataset([windows], actor.config.context)
    states, target = map(torch.stack, zip(*(data[i] for i in range(len(data)))))
    with torch.no_grad():
        encoded = actor.encode(states)
    # Reserve complete time blocks and purge the preceding context on transitions.
    block = 48
    index = torch.arange(len(states))
    held = (index // block) % 4 == 0
    usable = index % block >= actor.config.context
    train, test = ~held & usable, held & usable
    if not train.any() or not test.any():
        raise ValueError("Missing separate training and evaluation blocks")
    obs = states[:, -1]
    moves = target[:, 2:4]
    summary = {}
    for name, mask in (("search", (obs[:, 0] == 0) & (obs[:, 27] == 0)),
                       ("lost", (obs[:, 0] == 0) & (obs[:, 27] > 0)), ("visible", obs[:, 0] > 0)):
        motion = moves[mask]
        if len(motion):
            summary[name] = dict(windows=len(motion), forward=float((motion[:, 1] > .35).float().mean()),
                                 backward=float((motion[:, 1] < -.35).float().mean()),
                                 lateral=float((motion[:, 0].abs() > .35).float().mean()),
                                 still=float((motion.abs().max(1).values < .15).float().mean()),
                                 turnDegrees=float(target[mask, 0].abs().median() * .9 * 180 / 3.14159))
    routes = route_indices(data.starts, train.nonzero().flatten().tolist(), train)
    return encoded, moves, train, test, summary, routes, obs[:, 21:23]


def fit(model, recordings):
    torch.set_num_threads(2)
    actor = actor_from_json(model)
    groups = [movement_data(batch, actor) for batch in recordings]
    base_w = actor.out.weight[2:4].detach().clone()
    base_b = actor.out.bias[2:4].detach().clone()
    w, b = base_w.clone().requires_grad_(), base_b.clone().requires_grad_()
    optimizer = torch.optim.Adam([w, b], lr=.0012)
    for _ in range(100):
        losses = []
        for x, y, train, _, _, routes, heading in groups:
            predicted = F.linear(x, w, b).tanh()
            loss = F.smooth_l1_loss(predicted[train], y[train], beta=.25)
            if len(routes):
                loss = loss + .4 * route_loss(predicted[routes], y[routes], heading[routes])
            losses.append(loss)
        loss = sum(losses)/len(losses) + .5*((w-base_w)**2).mean() + .5*((b-base_b)**2).mean()
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
    result = dict(weights=w.detach().tolist(), bias=b.detach().tolist(), games=[])
    for x, y, train, test, summary, _, _ in groups:
        errors = {}
        for blend in (0,.05,.1,.2,.35,.5,1):
            pred = F.linear(x[test], base_w.lerp(w,blend),base_b.lerp(b,blend)).tanh()
            errors[str(blend)] = float((pred.detach()-y[test]).abs().mean())
        result["games"].append(dict(train=int(train.sum()), held=int(test.sum()), movement=summary, errors=errors))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("captures", type=Path, nargs="+", help="One directory of private input batches per game")
    parser.add_argument("--actor-output", type=Path, help="Write an actor for normal Arena evaluation")
    parser.add_argument("--blend", type=float, default=.5)
    args = parser.parse_args()
    if not 0 <= args.blend <= 1:
        parser.error("--blend must be in [0, 1]")
    model = json.loads(args.model.read_bytes())
    recordings = []
    for directory in args.captures:
        _, groups = bc.load_captures(directory, model["rulesVersion"])
        if len(groups) != 1:
            raise ValueError("Each selected game must contain exactly one capture")
        recordings.append(next(iter(groups.values())))
    result = fit(model, recordings)
    args.output.write_text(json.dumps(result) + "\n")
    if args.actor_output:
        for row, axis in enumerate((2, 3)):
            head = model["out"]
            head["weight"][axis] = [(1 - args.blend) * old + args.blend * new
                                    for old, new in zip(head["weight"][axis], result["weights"][row])]
            head["bias"][axis] += args.blend * (result["bias"][row] - head["bias"][axis])
        args.actor_output.write_text(json.dumps(model, separators=(",", ":")) + "\n")
