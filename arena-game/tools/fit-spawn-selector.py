"""Fit an offline, once-per-life selector from paired simulator returns.

Input JSON contains an ordered "experts" list and "samples". Each sample has
"suite", "campaign", "observation" (the first ordinary policy input of a life)
and "returns" (one result per expert from the same start). The output tree
indexes experts in the supplied order. Requires NumPy and scikit-learn.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from sklearn.tree import DecisionTreeRegressor


def fit(data):
    experts = data["experts"]
    if not isinstance(experts, list) or len(experts) < 2 or not all(isinstance(v, str) and v for v in experts):
        raise ValueError("provide at least two named experts")
    if len(set(experts)) != len(experts):
        raise ValueError("expert names must be distinct")
    samples = data["samples"]
    features = np.asarray([r["observation"] for r in samples], dtype=float)
    returns = np.asarray([r["returns"] for r in samples], dtype=float)
    if features.ndim != 2 or features.shape[1] != 30 or not np.isfinite(features).all():
        raise ValueError("expected finite 30-component Arena observations")
    if returns.shape != (len(samples), len(experts)) or not np.isfinite(returns).all():
        raise ValueError("each start needs one finite return per expert")

    # Give each suite equal total weight and keep each campaign in one fold.
    suites = np.asarray([r["suite"] for r in samples])
    campaigns = [r["campaign"] for r in samples]
    groups = list(dict.fromkeys(campaigns))
    if len(groups) < 3:
        raise ValueError("at least three simulation campaigns are required")
    assignment = {key: i % 3 for i, key in enumerate(groups)}
    folds = np.asarray([assignment[key] for key in campaigns])
    _, indices, counts = np.unique(suites, return_inverse=True, return_counts=True)
    weights = 1.0 / counts[indices]
    targets = returns - returns.mean(axis=1, keepdims=True)

    best_score = -np.inf
    for depth in (3, 4, 5, 6):
        for leaf in (6, 14, 24):
            scores = []
            for fold in range(3):
                test = folds == fold
                reg = DecisionTreeRegressor(max_depth=depth, min_samples_leaf=leaf, random_state=241)
                reg.fit(features[~test], targets[~test], sample_weight=weights[~test])
                chosen = reg.predict(features[test]).argmax(axis=1)
                gain = targets[test][np.arange(len(chosen)), chosen]
                scores.append(float(np.average(gain, weights=weights[test])))
            score = np.mean(scores) + 0.4 * min(scores)
            if score > best_score:
                best_score = score
                best_depth, best_leaf, best_folds = depth, leaf, scores

    reg = DecisionTreeRegressor(max_depth=best_depth, min_samples_leaf=best_leaf, random_state=241)
    reg.fit(features, targets, sample_weight=weights)
    tree = reg.tree_
    nodes = [
        dict(feat=int(tree.feature[i]), thresh=float(tree.threshold[i]),
             left=int(tree.children_left[i]), right=int(tree.children_right[i]),
             expert=int(tree.value[i, :, 0].argmax()))
        for i in range(tree.node_count)
    ]
    return dict(format="arena-offline-spawn-selector-v1", experts=experts, tree=nodes,
                depth=best_depth, minLeaf=best_leaf, foldScores=best_folds)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    result = fit(json.loads(args.input.read_bytes()))
    args.output.write_text(json.dumps(result, allow_nan=False) + "\n", encoding="utf-8")
