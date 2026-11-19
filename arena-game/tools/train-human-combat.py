"""Fit human camera turns and the trigger using player-exported Arena demos."""

import argparse
import json
from pathlib import Path

import numpy as np


SEED = 18437
BOUNDARIES = np.array([-.24, -.12, -.06, -.03, -.014, -.006, -.0015, .0015, .006, .014, .03, .06, .12, .24])
BINS = len(BOUNDARIES) + 1
ZERO = BINS // 2
ARCHITECTURES = [((0,), 32), ((0, 2, 5, 10, 18), 48), ((0, 1, 2, 5, 10, 18, 28), 64)]


def load(paths):
    captures = {}
    schema = None
    for path in paths:
        data = json.loads(path.read_text())
        features = data["features"]
        signature = (data["rulesVersion"], tuple(features))
        if data["version"] != 1 or data["tickHz"] != 60 or features[0] != "contact":
            raise ValueError(f"{path}: unsupported capture format")
        if schema is not None and signature != schema:
            raise ValueError(f"{path}: use captures from the same Arena rules version")
        schema = signature
        frames = np.array(data["frames"], dtype=np.float32)
        if frames.size == 0:
            continue
        if frames.ndim != 2 or frames.shape[1] != len(features) + 4 or not np.isfinite(frames).all():
            raise ValueError(f"{path}: invalid frame data")
        if not np.all(np.isin(frames[:, -1], [0, 1])) or not np.all(np.isin(frames[:, 1], [0, 1])):
            raise ValueError(f"{path}: invalid trigger or contact flags")
        engagement = frames[frames[:, 1] == 1]
        if len(engagement) < 120 or engagement[:, -1].sum() < 12 or (np.abs(engagement[:, -3:-1]) > .0015).any(axis=1).sum() < 20:
            print(f"Skipping {path.name}: needs more visible opponents, aiming, or live trigger input")
            continue
        key = data["capture"]
        if key not in captures or len(captures[key]) < len(frames):
            captures[key] = frames
    if len(captures) < 4:
        raise ValueError(f"Found {len(captures)} usable captures. Record at least four separately started matches.")
    return schema, [captures[key] for key in sorted(captures)]


def examples(captures, offsets):
    x, y = [], []
    for capture in captures:
        boundaries = np.flatnonzero(capture[:, 0][1:] != capture[:, 0][:-1]) + 1
        for life in np.split(capture, boundaries):
            i = np.arange(len(life))
            visible = life[:, 1] == 1
            since_visible = i - np.maximum.accumulate(np.where(visible, i, -100))
            # Include acquisition and brief loss of contact within the same life.
            rows = np.flatnonzero(since_visible <= 12)
            history = np.maximum(0, rows[:, None] - np.asarray(offsets)[None, :])
            x.append(life[history, 1:-3].reshape(len(rows), len(offsets) * (life.shape[1] - 4)))
            y.append(life[rows, -3:])
    return np.concatenate(x), np.concatenate(y)


def labels(y):
    return np.column_stack((np.digitize(y[:, :2], BOUNDARIES), y[:, 2].astype(np.intp)))


def probabilities(z):
    p = []
    for axis in (z[:, :BINS], z[:, BINS:2 * BINS]):
        dist = np.exp(axis - axis.max(axis=1, keepdims=True))
        p.append(dist / dist.sum(axis=1, keepdims=True))
    p.append(1 / (1 + np.exp(-np.clip(z[:, -1], -30, 30))))
    return p


def measure(probs, y):
    # Report both overall calibration and performance on turns and trigger presses.
    yaw, pitch, fire = probs
    i = np.arange(len(y))
    index = (y[:, 0] != ZERO, y[:, 1] != ZERO, y[:, 2] == 1)
    losses = [-np.log(np.maximum(p, 1e-9)) for p in (yaw[i, y[:, 0]], pitch[i, y[:, 1]], np.where(index[2], fire, 1 - fire))]
    balanced = [float((loss[active].mean() + loss[~active].mean()) / 2) if active.any() and (~active).any()
                else float(loss.mean()) for active, loss in zip(index, losses)]
    return {
        "frames": len(y), "balancedNll": round(sum(balanced) / 3, 5),
        "meanAimNll": round(float((losses[0].mean() + losses[1].mean()) / 2), 5),
        "triggerRate": round(float(index[2].mean()), 5), "predictedTriggerRate": round(float(fire.mean()), 5),
    }


def predict(x, params):
    w, b, output, output_bias = params
    return probabilities(np.tanh(x @ w + b) @ output + output_bias)


def fit(x, y, val_x, val_y, hidden):
    rng = np.random.default_rng(SEED)
    w = rng.normal(0, .07, (x.shape[1], hidden)).astype(np.float32)
    b = np.zeros(hidden, dtype=np.float32)
    output = rng.normal(0, .07, (hidden, BINS * 2 + 1)).astype(np.float32)
    output_bias = np.zeros(BINS * 2 + 1, dtype=np.float32)
    params = [w, b, output, output_bias]
    moments = [np.zeros_like(p) for p in params]
    scales = [np.zeros_like(p) for p in params]
    best, best_loss, stale, step = None, float("inf"), 0, 0

    for _ in range(36):
        order = rng.permutation(len(x))
        for start in range(0, len(x), 256):
            batch = order[start:start + 256]
            bx, by = x[batch], y[batch]
            h = np.tanh(bx @ w + b)
            yaw, pitch, fire = probabilities(h @ output + output_bias)
            indexes = np.arange(len(by))
            yaw[indexes, by[:, 0]] -= 1
            pitch[indexes, by[:, 1]] -= 1
            grad = np.column_stack((yaw, pitch, fire - by[:, 2])).astype(np.float32) / len(by)
            dh = (grad @ output.T) * (1 - h * h)
            step += 1
            gradients = [bx.T @ dh, dh.sum(axis=0), h.T @ grad, grad.sum(axis=0)]
            for p, g, m, s in zip(params, gradients, moments, scales):
                m[:] = .9 * m + .1 * g
                s[:] = .999 * s + .001 * g * g
                p -= (.002 / (1 - .9 ** step)) * m / (np.sqrt(s / (1 - .999 ** step)) + 1e-8)
        metrics = measure(predict(val_x, params), val_y)
        loss = metrics["balancedNll"]
        if loss < best_loss:
            best, best_loss, stale = [p.copy() for p in params], loss, 0
        else:
            stale += 1
            if stale == 5:
                break
    return best, best_loss


def centers(turns):
    clipped = np.clip(turns, *np.quantile(turns, [.003, .997]))
    digitized = np.digitize(turns, BOUNDARIES)
    edges = np.r_[-.36, BOUNDARIES, .36]
    return [0.0 if i == ZERO else round(float(np.median(clipped[digitized == i])), 6) if np.any(digitized == i)
            else round(float(np.clip((edges[i] + edges[i + 1]) / 2, clipped.min(), clipped.max())), 6) for i in range(BINS)]


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("captures", nargs="+", type=Path)
    cli.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "shared/botHumanModel.json")
    args = cli.parse_args()
    (rules_version, features), captures = load(args.captures)
    rng = np.random.default_rng(SEED)
    shuffled = [captures[i] for i in rng.permutation(len(captures))]
    holdout = max(1, len(captures) // 5)
    train, val, test = shuffled[2 * holdout:], shuffled[:holdout], shuffled[holdout:2 * holdout]
    candidate = None
    for offsets, hidden in ARCHITECTURES:
        x, raw = examples(train, offsets)
        val_x, val_raw = examples(val, offsets)
        params, loss = fit(x, labels(raw), val_x, labels(val_raw), hidden)
        print(f"{len(offsets)} history observations · {hidden} hidden units · validation balanced NLL {loss:.5f}")
        if candidate is None or loss < candidate[0]:
            candidate = loss, offsets, params, raw
    validation_loss, offsets, params, raw = candidate
    test_x, test_raw = examples(test, offsets)
    metrics = measure(predict(test_x, params), labels(test_raw))
    print(f"Selected offsets {offsets}; unseen capture metrics: {metrics}")
    w, b, output, output_bias = params
    model = {
        "version": 1, "rulesVersion": rules_version, "features": features, "offsets": offsets,
        "weights": w.T.tolist(), "bias": b.tolist(), "output": output.T.tolist(), "outputBias": output_bias.tolist(),
        "centers": [centers(raw[:, 0]), centers(raw[:, 1])],
        "training": {"trainCaptures": len(train), "validationCaptures": len(val), "testCaptures": len(test),
                     "trainFrames": len(raw), "validationBalancedNll": validation_loss, "test": metrics},
    }
    args.output.write_text(json.dumps(model, separators=(",", ":"), allow_nan=False) + "\n")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError) as exc:
        raise SystemExit(str(exc)) from None
