"""Refit the four contact input columns of an exported single-block v4 Arena actor.

Input is a JSON list of paired simulator encounters. Each has a campaign integer
"seed" and a list "rec" of decisions, with ordinary policy "history" (oldest
first) and 14 target "logits". Supply entire validation campaigns via --holdout.
The emitted native actor can be compared with its parent by audit-spawn-contact.
"""
import argparse
import copy
import json
from pathlib import Path

import numpy as np


def linear(state, layer):
    return state @ layer["weight"].T + layer["bias"]


def normalize(state, layer):
    centered = state - state.mean(axis=-1, keepdims=True)
    return centered / np.sqrt((centered ** 2).mean(axis=-1, keepdims=True) + 1e-5) * layer["weight"] + layer["bias"]


def arrays(value):
    if isinstance(value, dict):
        return {name: arrays(item) for name, item in value.items()}
    result = np.asarray(value, dtype=float)
    if not np.isfinite(result).all():
        raise ValueError("Non-finite actor parameter")
    return result


class ContactActor:
    def __init__(self, model):
        if (model.get("version") != 4 or model.get("controller") != "learned-input-v1"
                or len(model["layers"]) != 1):
            raise ValueError("Expected a single-block v4 direct-input actor")
        self.embed = arrays(model["embed"])
        self.layer = arrays(model["layers"][0])
        self.position = arrays(model["position"])
        self.norm = arrays(model["norm"])
        self.out = arrays(model["out"])
        self.heads = model["heads"]

    def predict(self, histories, adjustment):
        weights = self.embed["weight"].copy()
        weights[:, :4] += adjustment
        state = histories @ weights.T + self.embed["bias"] + self.position
        batch, ticks, width = state.shape
        layer = self.layer
        qkv = linear(normalize(state, layer["norm1"]), layer["qkv"])
        query, key, value = np.split(qkv, 3, axis=-1)
        # For one causal block the final query attends to all history tokens.
        query = query[:, -1].reshape(batch, self.heads, -1)
        key = key.reshape(batch, ticks, self.heads, -1)
        value = value.reshape(batch, ticks, self.heads, -1)
        scores = np.einsum("nhd,nthd->nht", query, key) / np.sqrt(width / self.heads)
        attention = np.exp(scores - scores.max(axis=-1, keepdims=True))
        attention /= attention.sum(axis=-1, keepdims=True)
        mixed = np.einsum("nht,nthd->nhd", attention, value).reshape(batch, width)
        token = state[:, -1] + linear(mixed, layer["attn"])
        hidden = np.maximum(0, linear(normalize(token, layer["norm2"]), layer["up"]))
        token += linear(hidden, layer["down"])
        return linear(normalize(token, self.norm), self.out)


def action_targets(logits):
    values = logits.copy()
    values[:, 11:] -= values[:, 11:].mean(axis=-1, keepdims=True)
    # Keep large saturated button logits from dominating the camera/movement fit.
    values[:, 4:] *= .5
    return np.tanh(values) * [1.45, 1.1, 1, 1, .85, .35, .35, .35, .5, .35, .35, .7, .7, .7]


def split_decisions(encounters, holdout, context, rng):
    train, validation = [], []
    observed = set()
    for encounter in encounters:
        seed = encounter["seed"]
        records = encounter["rec"]
        if not records:
            continue
        # One decision per encounter avoids overweighting long misses.
        record = records[rng.integers(len(records))]
        history = np.asarray(record["history"], dtype=float)
        logits = np.asarray(record["logits"], dtype=float)
        if (history.ndim != 2 or history.shape[1] != 30 or not 0 < len(history) <= context
                or history[-1, 0] != 1 or logits.shape != (14,)
                or not np.isfinite(history).all() or not np.isfinite(logits).all()):
            raise ValueError("Expected a confirmed-contact decision with finite history and logits")
        padded = np.pad(history, ((context - len(history), 0), (0, 0)))
        group = validation if seed in holdout else train
        group.append((padded, logits))
        observed.add(seed)
    if not holdout <= observed or not train or not validation:
        raise ValueError("Missing requested holdout campaigns or training encounters")

    def stack(group):
        histories, logits = zip(*group)
        return np.stack(histories), action_targets(np.stack(logits))

    return stack(train), stack(validation)


def fit(model, encounters, holdout, seed):
    actor = ContactActor(model)
    rng = np.random.default_rng(seed)
    (states, targets), (validation, references) = split_decisions(encounters, holdout, model["context"], rng)
    delta = np.zeros((model["width"], 4))
    best = delta.copy()

    def validation_loss(adjustment):
        error = action_targets(actor.predict(validation, adjustment)) - references
        return float(np.mean(error ** 2))

    initial_loss = best_loss = validation_loss(delta)
    for _ in range(6):
        indices = rng.choice(len(states), min(240, len(states)), replace=False)
        batch = states[indices]
        prediction = action_targets(actor.predict(batch, delta))
        residual = (targets[indices] - prediction).ravel()
        jacobian = np.empty((residual.size, delta.size))
        for column in range(delta.size):
            probe = delta.copy()
            probe.flat[column] += .001
            jacobian[:, column] = ((action_targets(actor.predict(batch, probe)) - prediction) / .001).ravel()
        gram = jacobian.T @ jacobian / len(batch) + .007 * np.eye(delta.size)
        step = np.linalg.solve(gram, jacobian.T @ residual / len(batch))
        delta += .8 * np.clip(step.reshape(delta.shape), -.2, .2)
        loss = validation_loss(delta)
        if loss < best_loss:
            best, best_loss = delta.copy(), loss

    result = copy.deepcopy(model)
    for row, change in zip(result["embed"]["weight"], best):
        row[:4] = (row[:4] + change).tolist()
    return result, dict(train=len(states), validation=len(validation), initialLoss=initial_loss, bestLoss=best_loss)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("parent", type=Path)
    parser.add_argument("encounters", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--holdout", type=int, nargs="+", required=True)
    parser.add_argument("--seed", type=int, default=2357)
    args = parser.parse_args()
    if args.output.resolve() in {args.parent.resolve(), args.encounters.resolve()}:
        parser.error("Choose a distinct output path to preserve the inputs")
    trained, report = fit(json.loads(args.parent.read_bytes()), json.loads(args.encounters.read_bytes()),
                          set(args.holdout), args.seed)
    args.output.write_text(json.dumps(trained, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(report))
